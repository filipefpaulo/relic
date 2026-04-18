#!/usr/bin/env bun
import { Command } from "commander";
import { join } from "path";
import {
  runInit,
  runAddEngine,
  runUse,
  runScan,
  runSpecify,
  runFix,
  runClarify,
  runPlan,
  runAnalyse,
  runTasks,
  runImplement,
  runSolve,
  runConstitution,
  runContext,
  runScaffold,
  runValidate,
  runSearch,
  runToonMigrate,
  runUpgrade,
  runWrite,
  loadModelConfig,
  findRelicDir,
  SUPPORTED_ENGINES,
  type Engine,
} from "@relic/core";
import { readEnginesRegistry, writeEnginesRegistry, fileExists, writeJson, resolveSpec } from "@relic/utility";

const VERSION = "0.8.0";
const program = new Command();

program
  .name("relic")
  .description("Spec-driven development with a shared artifact layer")
  .version(VERSION);

program
  .command("init")
  .description("Initialise Relic in the current project")
  .option("--dir <path>", "Project root directory", process.cwd())
  .option("--force", "Reinitialise even if .relic/ already exists", false)
  .option(
    "--engine <engines>",
    `AI engines to configure, comma-separated (${SUPPORTED_ENGINES.join("|")})`,
    "claude"
  )
  .action(async (opts: { dir: string; force: boolean; engine: string }) => {
    const engines = opts.engine
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean) as Engine[];
    await runInit({ dir: opts.dir, force: opts.force, engines });
  });

program
  .command("add-engine <engine>")
  .description(`Add AI engine hooks to an existing Relic project (${SUPPORTED_ENGINES.join("|")})`)
  .action(async (engine: string) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    const projectDir = join(relicDir, "..");
    await runAddEngine({ engine: engine as Engine, projectDir });
    const engines = readEnginesRegistry(relicDir);
    writeEnginesRegistry(relicDir, [...engines, engine]);
  });

program
  .command("use [spec-id]")
  .description("Set the active spec, fix, or clear the active fix")
  .option("--fix <fix-id>", "Set active fix")
  .option("--clear-fix", "Clear active fix", false)
  .action(async (specId: string | undefined, opts: { fix?: string; clearFix: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runUse({ specId, fix: opts.fix, clearFix: opts.clearFix, relicDir });
  });

program
  .command("scan")
  .description("Run the AI scan workflow (default) or output the project manifest with --manifest")
  .option("--manifest", "Output raw project manifest instead of running AI workflow", false)
  .option("--json", "Output manifest as JSON; implies --manifest", false)
  .option("--no-stream", "Disable streaming output")
  .action(async (opts: { manifest: boolean; json: boolean; stream: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    const projectDir = join(relicDir, "..");
    await runScan({
      projectDir,
      relicDir,
      json: opts.json,
      manifest: opts.manifest || opts.json,
      noStream: !opts.stream,
    });
  });

program
  .command("specify")
  .description("Create a new spec and run the AI specify workflow")
  .option("--title <title>", "Spec title")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { title?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runSpecify({
      title: opts.title,
      relicDir,
      noStream: !opts.stream,
      resetContext: opts.resetContext,
    });
  });

program
  .command("clarify")
  .description("Append details or change contracts for a spec")
  .option("--spec <id>", "Spec ID")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runClarify({ relicDir, spec: opts.spec, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("plan")
  .description("Create an implementation plan")
  .option("--spec <id>", "Spec ID")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runPlan({ relicDir, spec: opts.spec, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("analyse")
  .description("Non-destructive consistency check")
  .option("--spec <id>", "Spec ID")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runAnalyse({ relicDir, spec: opts.spec, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("tasks")
  .description("Generate tasks from the current plan")
  .option("--spec <id>", "Spec ID")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runTasks({ relicDir, spec: opts.spec, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("implement")
  .description("Build the plan")
  .option("--spec <id>", "Spec ID")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runImplement({ relicDir, spec: opts.spec, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("fix")
  .description("Fix a bug using the spec as context")
  .option("--spec <id>", "Spec ID (overrides branch inference and RELIC_SPEC env)")
  .option("--issue <description>", "Issue description to append to the assembled context")
  .option("--no-stream", "Disable streaming output")
  .option("--reset-context", "Clear conversation history before running", false)
  .action(async (opts: { spec?: string; issue?: string; stream: boolean; resetContext: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runFix({ spec: opts.spec, issue: opts.issue, relicDir, noStream: !opts.stream, resetContext: opts.resetContext });
  });

program
  .command("solve")
  .description("Apply a fix document to the codebase")
  .option("--fix <id>", "Fix ID (overrides active fix from session)")
  .option("--no-stream", "Disable streaming output")
  .action(async (opts: { fix?: string; stream: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runSolve({ relicDir, fix: opts.fix, noStream: !opts.stream });
  });

program
  .command("constitution")
  .description("Regenerate .relic/constitution.md from the codebase")
  .option("--no-stream", "Disable streaming output")
  .action(async (opts: { stream: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runConstitution({ relicDir, noStream: !opts.stream });
  });

program
  .command("model")
  .description("Model management (e.g. reset conversation history)")
  .option("--reset-context", "Clear conversation history for the active spec", false)
  .option("--spec <id>", "Spec ID (overrides branch inference)")
  .action(async (opts: { resetContext: boolean; spec?: string }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }

    if (!opts.resetContext) {
      console.error("Error: specify an operation (e.g. --reset-context)");
      process.exit(1);
    }

    // Validate config exists
    loadModelConfig(relicDir);

    // Resolve spec using the canonical four-step chain
    const specId = resolveSpec(opts.spec, relicDir);
    if (!specId) {
      console.error("Error: no active spec. Use --spec <id> or relic use <spec-id>");
      process.exit(1);
    }

    const historyPath = join(relicDir, "specs", specId, "history.json");
    if (fileExists(historyPath)) {
      writeJson(historyPath, []);
      console.log(`History cleared: .relic/specs/${specId}/history.json`);
    } else {
      console.log(`No history found for spec: ${specId}`);
    }
  });

program
  .command("context")
  .description("Resolve active spec and report context (files, shared artifacts)")
  .option("--spec <id>", "Spec ID (overrides branch inference and RELIC_SPEC env)")
  .option("--text", "Human-readable output instead of JSON", false)
  .action(async (opts: { spec?: string; text: boolean }) => {
    await runContext({ spec: opts.spec, text: opts.text });
  });

program
  .command("scaffold")
  .description("Ensure a spec folder exists; create from templates if new")
  .option("--title <title>", "Title for a new spec")
  .option("--spec <id>", "Spec ID for an existing spec")
  .action(async (opts: { title?: string; spec?: string }) => {
    await runScaffold({ title: opts.title, spec: opts.spec });
  });

program
  .command("validate")
  .description("Check artifact integrity and ownership conflicts")
  .option("--text", "Human-readable output instead of JSON", false)
  .action(async (opts: { text: boolean }) => {
    await runValidate({ text: opts.text });
  });

program
  .command("search [keywords...]")
  .description("Search manifest indexes by keyword; use --deep for all entries")
  .option("--deep", "Return all entries without filtering", false)
  .option("--knowledge", "Scope to shared knowledge artifacts only", false)
  .option("--spec", "Scope to spec index only", false)
  .option("--fix", "Scope to fix index only", false)
  .option("--json", "Output as JSON array instead of toon lines", false)
  .action(async (keywords: string[], opts: { deep: boolean; knowledge: boolean; spec: boolean; fix: boolean; json: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runSearch({ keywords, deep: opts.deep, knowledge: opts.knowledge, spec: opts.spec, fix: opts.fix, json: opts.json, relicDir });
  });

program
  .command("write")
  .description("Write a structured entry to a toon index or changelog")
  .option("--changelog", "Target: .relic/changelog.md", false)
  .option("--specs", "Target: specs/manifest.toon", false)
  .option("--fixes", "Target: fixes/manifest.toon", false)
  .option("--knowledge-domains", "Target: shared/domains/manifest.toon", false)
  .option("--knowledge-contracts", "Target: shared/contracts/manifest.toon", false)
  .option("--knowledge-rules", "Target: shared/rules/manifest.toon", false)
  .option("--knowledge-assumptions", "Target: shared/assumptions/manifest.toon", false)
  .requiredOption("--payload <json>", "Compact JSON payload (WritePayload schema)")
  .action(async (opts: {
    changelog: boolean;
    specs: boolean;
    fixes: boolean;
    knowledgeDomains: boolean;
    knowledgeContracts: boolean;
    knowledgeRules: boolean;
    knowledgeAssumptions: boolean;
    payload: string;
  }) => {
    const targets = [
      opts.changelog && "changelog",
      opts.specs && "specs",
      opts.fixes && "fixes",
      opts.knowledgeDomains && "knowledge-domains",
      opts.knowledgeContracts && "knowledge-contracts",
      opts.knowledgeRules && "knowledge-rules",
      opts.knowledgeAssumptions && "knowledge-assumptions",
    ].filter(Boolean) as string[];
    if (targets.length !== 1) {
      console.error("Error: exactly one target flag must be provided (e.g. --changelog, --specs).");
      process.exit(1);
    }
    await runWrite({ target: targets[0] as import("@relic/core").WriteTarget, payload: opts.payload });
  });

program
  .command("toon-migrate")
  .description("Convert shared/*/manifest.json → manifest.toon; rebuild spec and fix indexes")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    const result = await runToonMigrate({ relicDir });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("upgrade")
  .description("Upgrade relic-cli and refresh AI engine hook files")
  .option("--check", "Check for updates only, do not install", false)
  .option("--prompts", "Refresh engine hook files only, skip binary upgrade", false)
  .option("--text", "Human-readable output instead of JSON", false)
  .action(async (opts: { check: boolean; prompts: boolean; text: boolean }) => {
    const relicDir = findRelicDir(process.cwd()) ?? undefined;
    await runUpgrade({
      check: opts.check,
      promptsOnly: opts.prompts,
      text: opts.text,
      currentVersion: VERSION,
      relicDir,
    });
  });

program.parse(process.argv);
