#!/usr/bin/env bun
import { Command } from "commander";
import {
  runInit,
  runSpecify,
  runFix,
  runClarify,
  runPlan,
  runAnalyse,
  runTasks,
  runImplement,
  findRelicDir,
} from "@relic/core";

const program = new Command();

program
  .name("relic")
  .description("Spec-driven development with a shared artifact layer")
  .version("0.1.0");

program
  .command("init")
  .description("Initialise Relic in the current project")
  .option("--dir <path>", "Project root directory", process.cwd())
  .option("--force", "Reinitialise even if .relic/ already exists", false)
  .action(async (opts: { dir: string; force: boolean }) => {
    await runInit({ dir: opts.dir, force: opts.force });
  });

program
  .command("specify")
  .description("Create a new spec")
  .option("--title <title>", "Spec title")
  .action(async (opts: { title?: string }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runSpecify({ title: opts.title, relicDir });
  });

program
  .command("fix")
  .description("Fix a bug using the spec as context")
  .option("--spec <id>", "Spec ID (overrides branch inference and RELIC_SPEC env)")
  .option("--issue <description>", "Issue description to append to the assembled context")
  .action(async (opts: { spec?: string; issue?: string }) => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runFix({ spec: opts.spec, issue: opts.issue, relicDir });
  });

program
  .command("clarify")
  .description("Append details or change contracts for a spec (check intersections)")
  .option("--spec <id>", "Spec ID")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runClarify({ relicDir });
  });

program
  .command("plan")
  .description("Create an implementation plan")
  .option("--spec <id>", "Spec ID")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runPlan({ relicDir });
  });

program
  .command("analyse")
  .description("Non-destructive consistency check")
  .option("--spec <id>", "Spec ID")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runAnalyse({ relicDir });
  });

program
  .command("tasks")
  .description("Generate tasks from the current plan")
  .option("--spec <id>", "Spec ID")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runTasks({ relicDir });
  });

program
  .command("implement")
  .description("Build the plan")
  .option("--spec <id>", "Spec ID")
  .action(async () => {
    const relicDir = findRelicDir(process.cwd());
    if (!relicDir) {
      console.error("Not in a Relic project. Run: relic init");
      process.exit(1);
    }
    await runImplement({ relicDir });
  });

program.parse(process.argv);
