#!/usr/bin/env bun
import { Command } from "commander";
import { join } from "path";
import {
  runInit,
  runAddEngine,
  runUse,
  runScan,
  findRelicDir,
  SUPPORTED_ENGINES,
  type Engine,
} from "@relic/core";

const program = new Command();

program
  .name("relic")
  .description("Spec-driven development with a shared artifact layer")
  .version("0.1.9");

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
  });

program
  .command("use <spec-id>")
  .description("Set the active spec for this session")
  .action(async (specId: string) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runUse({ specId, relicDir });
  });

program
  .command("scan")
  .description("Scan existing codebase and output a project manifest for AI artifact generation")
  .option("--json", "Output manifest as JSON (for AI consumption)", false)
  .action(async (opts: { json: boolean }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    const projectDir = join(relicDir, "..");
    await runScan({ projectDir, relicDir, json: opts.json });
  });

program.parse(process.argv);
