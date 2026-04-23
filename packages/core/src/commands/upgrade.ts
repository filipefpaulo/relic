import { spawnSync } from "child_process";
import { join } from "path";
import {
  readEnginesRegistry,
  readText,
  writeText,
  fileExists,
  findRelicDir,
  fetchWithTimeout,
} from "@relic/utility";
import { runAddEngine, SUPPORTED_ENGINES } from "@relic/engines";
import { TEMPLATES } from "../generated/templates.ts";
import { runToonMigrate } from "./toon-migrate.ts";

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
  toon_migrated: boolean;
  toon_warnings: string[];
  warnings: string[];
}

/** Compare two semver strings. Returns true if `a` is greater than `b`. */
function semverGt(a: string, b: string): boolean {
  const parse = (v: string): number[] => v.split(".").map(Number);
  const [aMaj = 0, aMin = 0, aPat = 0] = parse(a);
  const [bMaj = 0, bMin = 0, bPat = 0] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

/** Return true when `v` is a valid X.Y.Z semver string. */
function isValidSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

async function checkVersion(
  currentVersion: string,
  resolvedChannel: string
): Promise<UpgradeCheckResult | null> {
  if (resolvedChannel === "dev") return null;

  let latest: string;
  try {
    if (resolvedChannel === "npm") {
      const res = await fetchWithTimeout("https://registry.npmjs.org/relic-cli/latest");
      if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
      const data = (await res.json()) as { version: string };
      latest = data.version;
    } else {
      // pypi
      const res = await fetchWithTimeout("https://pypi.org/pypi/relic-cli/json");
      if (!res.ok) throw new Error(`PyPI registry returned ${res.status}`);
      const data = (await res.json()) as { info: { version: string } };
      latest = data.info.version;
    }
  } catch (err) {
    throw new Error(
      `Failed to fetch latest version from ${resolvedChannel} registry: ${String(err)}`
    );
  }

  if (!isValidSemver(latest)) {
    throw new Error(
      `Registry returned an unexpected version string: "${latest}". ` +
        "Cannot determine if an update is available."
    );
  }
  if (!isValidSemver(currentVersion)) {
    throw new Error(
      `Current version "${currentVersion}" is not a valid semver string. ` +
        "Cannot compare versions."
    );
  }

  return {
    current: currentVersion,
    latest,
    update_available: semverGt(latest, currentVersion),
    channel: resolvedChannel,
  };
}

function upgradeBinary(targetVersion: string, resolvedChannel: string): void {
  if (resolvedChannel === "npm") {
    const result = spawnSync("npm", ["install", "-g", `relic-cli@${targetVersion}`], {
      stdio: "inherit",
    });
    if (result.error) {
      throw new Error(
        "npm not found on PATH. Install Node.js and npm, then run:\n" +
          `  npm install -g relic-cli@${targetVersion}`
      );
    }
    if (result.status !== 0) {
      throw new Error(`npm install failed. Run manually: npm install -g relic-cli@${targetVersion}`);
    }
  } else {
    // pypi: try uv first, fall back to pip.
    // Use stdio:"pipe" so uv's error output doesn't leak to the terminal when the
    // pip fallback succeeds — a successful upgrade shouldn't look like a failure.
    const uvResult = spawnSync("uv", ["tool", "upgrade", "relic-cli"], { stdio: "pipe" });
    if (uvResult.error || uvResult.status !== 0) {
      const uvNotFound = !!uvResult.error;
      const uvDiag = uvNotFound
        ? "uv not found on PATH"
        : "uv: relic-cli not in uv tool store";
      const uvStderr = uvResult.stderr?.toString().trim() ?? "";

      // Print a single explanatory line so the user knows why pip is running
      process.stderr.write(`${uvDiag} — falling back to pip.\n`);

      const pipResult = spawnSync("pip", ["install", "--upgrade", "relic-cli"], {
        stdio: "inherit",
      });
      if (pipResult.error) {
        throw new Error(
          `${uvDiag}; pip not found on PATH either.\n` +
            (uvStderr ? `uv output:\n  ${uvStderr}\n` : "") +
            "Install one of them, then run:\n" +
            "  uv tool install relic-cli  OR  pip install --upgrade relic-cli"
        );
      }
      if (pipResult.status !== 0) {
        throw new Error(
          `${uvDiag}; pip install also failed.\n` +
            (uvStderr ? `uv output:\n  ${uvStderr}\n` : "") +
            "Run manually:\n" +
            "  uv tool install relic-cli  OR  pip install --upgrade relic-cli"
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
    if (!(SUPPORTED_ENGINES as string[]).includes(engine)) {
      result.warnings.push(
        `Warning: unknown engine "${engine}" in engines.json — skipping. ` +
          `Supported engines: ${SUPPORTED_ENGINES.join(", ")}`
      );
      continue;
    }
    try {
      await runAddEngine({
        engine: engine as Parameters<typeof runAddEngine>[0]["engine"],
        projectDir,
      });
      result.hooks_refreshed.push(engine);
    } catch (err) {
      result.warnings.push(`Warning: failed to refresh hooks for engine "${engine}": ${String(err)}`);
    }
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
  const relicDir = options.relicDir ?? findRelicDir(process.cwd()) ?? undefined;

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
      toon_migrated: false,
      toon_warnings: [],
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
    const result: UpgradeResult = {
      check: checkResult,
      binary_upgraded: false,
      hooks_refreshed: [],
      preamble_updated: false,
      toon_migrated: false,
      toon_warnings: [],
      warnings: [],
    };
    if (options.text) {
      console.log(`Already up to date. (${checkResult!.current})`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  const result: UpgradeResult = {
    check: checkResult,
    binary_upgraded: false,
    hooks_refreshed: [],
    preamble_updated: false,
    toon_migrated: false,
    toon_warnings: [],
    warnings: [],
  };

  upgradeBinary(checkResult!.latest, resolvedChannel);
  result.binary_upgraded = true;

  if (relicDir) {
    // Spawn the NEW binary with --prompts so it uses its own fresh TEMPLATES map.
    // The current process still holds the old templates in memory — calling
    // refreshHooks() here would write stale content.
    const promptsResult = spawnSync(
      "relic",
      ["upgrade", "--prompts"],
      { stdio: "pipe", cwd: join(relicDir, "..") }
    );

    if (promptsResult.status === 0 && promptsResult.stdout) {
      try {
        const parsed = JSON.parse(promptsResult.stdout.toString()) as UpgradeResult;
        result.hooks_refreshed = parsed.hooks_refreshed;
        result.preamble_updated = parsed.preamble_updated;
        result.warnings.push(...parsed.warnings);
      } catch {
        // JSON parse failed — the new binary may have printed text instead.
        // Hooks were still refreshed by the child process; we just can't parse details.
        result.warnings.push("Hooks refreshed by new binary (output not parseable).");
      }
    } else {
      const stderr = promptsResult.stderr?.toString().trim() ?? "";
      result.warnings.push(
        "Warning: failed to refresh hooks via new binary." +
          (stderr ? ` ${stderr}` : "") +
          " Run `relic upgrade --prompts` manually."
      );
    }

    await runToonMigrate({ relicDir });
    result.toon_migrated = true;
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
    if (result.toon_migrated) console.log("Toon indexes migrated/rebuilt.");
    if (result.toon_warnings.length > 0) result.toon_warnings.forEach((w) => console.log(w));
    if (result.warnings.length > 0) result.warnings.forEach((w) => console.log(w));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
