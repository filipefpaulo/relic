export { runInit } from "./commands/init.ts";
export { runContext } from "./commands/context.ts";
export { runScaffold } from "./commands/scaffold.ts";
export { runValidate } from "./commands/validate.ts";
export { runAddEngine, SUPPORTED_ENGINES } from "./commands/add-engine.ts";
export type { Engine } from "./commands/add-engine.ts";
export { runUse } from "./commands/use.ts";
export { runScan } from "./commands/scan.ts";
export { runSpecify } from "./commands/specify.ts";
export { runFix } from "./commands/fix.ts";
export { runClarify } from "./commands/clarify.ts";
export { runPlan } from "./commands/plan.ts";
export { runAnalyse } from "./commands/analyse.ts";
export { runTasks } from "./commands/tasks.ts";
export { runImplement } from "./commands/implement.ts";

export { loadRegistry, buildOwnershipMap } from "./core/artifact-registry.ts";
export { detectIntersections, formatIntersectionReport } from "./core/intersection.ts";
export { appendChangelog, filterChangelog } from "./core/changelog.ts";
export { buildContext, renderContext } from "./core/context-builder.ts";

export { findRelicDir } from "./utils/fs.ts";
export { nextSpecId, slugify, inferSpecFromBranch, availableSpecs } from "./utils/spec-id.ts";

export type {
  ArtifactsJson,
  SpecMeta,
  OwnershipConflict,
  FileOverlapWarning,
  IntersectionReport,
  BuiltContext,
} from "./types.ts";

export type { ChangelogEntry } from "./core/changelog.ts";
