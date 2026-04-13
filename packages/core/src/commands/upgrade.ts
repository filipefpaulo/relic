import { spawnSync } from "child_process";
import { join } from "path";
import { readEnginesRegistry, readText, writeText, fileExists, findRelicDir } from "@relic/utility";
import { runAddEngine } from "@relic/engines";
import { TEMPLATES } from "../generated/templates.ts";

// Injected at build time by bun build --define. Undefined in dev builds.
declare const INSTALL_CHANNEL: string | undefined;
const channel = typeof INSTALL_CHANNEL !== "undefined" ? INSTALL_CHANNEL : "dev";

export interface UpgradeOptions {
  check: boolean;
  promptsOnly: boolean;
  text: boolean;
  currentVersion: string;
  relicDir?: string;
  /** Override the resolved channel. Used in tests only. */
  _channel?: string;
}

export interface UpgradeCheckResult {
  current: string;
  latest: string;
  update_available: boolean;
  channel: string;
}

export interface UpgradeResult {
  check: UpgradeCheckResult | null;
  binary_upgraded: boolean;
  hooks_refreshed: string[];
  preamble_updated: boolean;
  warnings: string[];
}

async function checkVersion(
  currentVersion: string,
  resolvedChannel: string
): Promise<UpgradeCheckResult | null> {
  if (resolvedChannel === "dev") return null;

  let latest: string;
  try {
    if (resolvedChannel === "npm") {
      const res = await fetch("https://registry.npmjs.org/relic-cli/latest");
      if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
      const data = (await res.json()) as { version: string };
      latest = data.version;
    } else {
      // pypi
      const res = await fetch("https://pypi.org/pypi/relic-cli/json");
      if (!res.ok) throw new Error(`PyPI registry returned ${res.status}`);
      const data = (await res.json()) as { info: { version: string } };
      latest = data.info.version;
    }
  } catch (err) {
    throw new Error(`Failed to fetch latest version from ${resolvedChannel} registry: ${String(err)}`);
  }

  return {
    current: currentVersion,
    latest,
    update_available: latest !== currentVersion,
    channel: resolvedChannel,
  };
}

function upgradeBinary(targetVersion: string, resolvedChannel: string): void {
  if (resolvedChannel === "npm") {
    const result = spawnSync("npm", ["install", "-g", `relic-cli@${targetVersion}`], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(
        `npm install failed. Run manually: npm install -g relic-cli@${targetVersion}`
      );
    }
  } else {
    // pypi: try uv first, fall back to pip
    const uvResult = spawnSync("uv", ["tool", "upgrade", "relic-cli"], { stdio: "inherit" });
    if (uvResult.status !== 0) {
      const pipResult = spawnSync("pip", ["install", "--upgrade", "relic-cli"], {
        stdio: "inherit",
      });
      if (pipResult.status !== 0) {
        throw new Error(
          "Both uv and pip failed. Run manually: uv tool upgrade relic-cli  OR  pip install --upgrade relic-cli"
        );
      }
    }
  }
}

async function refreshHooks(
  relicDir: string,
  projectDir: string,
  result: UpgradeResult
): Promise<void> {
  const engines = readEnginesRegistry(relicDir);

  if (engines.length === 0) {
    result.warnings.push(
      "Warning: .relic/engines.json not found or empty. " +
        "Run `relic add-engine <engine>` to register your engines, then re-run upgrade."
    );
    return;
  }

  for (const engine of engines) {
    await runAddEngine({ engine: engine as Parameters<typeof runAddEngine>[0]["engine"], projectDir });
    result.hooks_refreshed.push(engine);
  }

  // Refresh preamble.md if content has changed
  const preamblePath = join(relicDir, "preamble.md");
  const newPreamble = TEMPLATES["preamble.md"] ?? "";
  const currentPreamble = fileExists(preamblePath) ? readText(preamblePath) : "";
  if (currentPreamble !== newPreamble) {
    writeText(preamblePath, newPreamble);
    result.preamble_updated = true;
  }
}

export async function runUpgrade(options: UpgradeOptions): Promise<void> {
  const resolvedChannel = options._channel ?? channel;
  const relicDir =
    options.relicDir ?? findRelicDir(process.cwd()) ?? undefined;

  // FR-4: dev channel warning
  if (resolvedChannel === "dev") {
    const output = {
      warning: "INSTALL_CHANNEL is not set (dev build). Cannot determine upgrade channel.",
      instructions: "Upgrade manually: npm install -g relic-cli  OR  uv tool upgrade relic-cli",
    };
    if (options.text) {
      console.log(output.warning);
      console.log(output.instructions);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
    return;
  }

  // --prompts: refresh hooks only, no version check or binary upgrade
  if (options.promptsOnly) {
    if (!relicDir) {
      console.error("Error: not in a Relic project. Run: relic init");
      process.exit(1);
    }
    const projectDir = join(relicDir, "..");
    const result: UpgradeResult = {
      check: null,
      binary_upgraded: false,
      hooks_refreshed: [],
      preamble_updated: false,
      warnings: [],
    };
    await refreshHooks(relicDir, projectDir, result);
    if (options.text) {
      if (result.warnings.length > 0) result.warnings.forEach((w) => console.log(w));
      if (result.hooks_refreshed.length > 0)
        console.log(`Hooks refreshed: ${result.hooks_refreshed.join(", ")}`);
      if (result.preamble_updated) console.log("preamble.md updated.");
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  // --check: version check only
  const checkResult = await checkVersion(options.currentVersion, resolvedChannel);

  if (options.check) {
    if (options.text) {
      console.log(
        `Current: ${checkResult!.current}  Latest: ${checkResult!.latest}  Channel: ${checkResult!.channel}`
      );
      console.log(checkResult!.update_available ? "Update available." : "Already up to date.");
    } else {
      console.log(JSON.stringify(checkResult, null, 2));
    }
    return;
  }

  // Default: upgrade if behind, then refresh hooks
  if (!checkResult!.update_available) {
    const output = { message: "Already up to date.", ...checkResult };
    if (options.text) {
      console.log(`Already up to date. (${checkResult!.current})`);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
    return;
  }

  const result: UpgradeResult = {
    check: checkResult,
    binary_upgraded: false,
    hooks_refreshed: [],
    preamble_updated: false,
    warnings: [],
  };

  upgradeBinary(checkResult!.latest, resolvedChannel);
  result.binary_upgraded = true;

  if (relicDir) {
    const projectDir = join(relicDir, "..");
    await refreshHooks(relicDir, projectDir, result);
  } else {
    result.warnings.push(
      "Not in a Relic project — engine hooks were not refreshed. " +
        "Run `relic upgrade --prompts` from inside your project to refresh hooks."
    );
  }

  if (options.text) {
    console.log(`Upgraded from ${result.check!.current} to ${result.check!.latest}.`);
    if (result.hooks_refreshed.length > 0)
      console.log(`Hooks refreshed: ${result.hooks_refreshed.join(", ")}`);
    if (result.preamble_updated) console.log("preamble.md updated.");
    if (result.warnings.length > 0) result.warnings.forEach((w) => console.log(w));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
