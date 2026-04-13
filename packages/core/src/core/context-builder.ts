import { join } from "path";
import { fileExists, readText, readJson } from "@relic/utility";
import { filterChangelog } from "./changelog.ts";
import type { ArtifactsJson, BuiltContext } from "../types.ts";

export function buildContext(relicDir: string, specId: string | null): BuiltContext {
  const preamblePath = join(relicDir, "preamble.md");
  const preamble = fileExists(preamblePath) ? readText(preamblePath) : "";

  const constitutionPath = join(relicDir, "constitution.md");
  const constitution = fileExists(constitutionPath) ? readText(constitutionPath) : "";

  let spec: string | null = null;
  let plan: string | null = null;
  const artifacts: Record<string, string> = {};
  let changelogExcerpt: string | null = null;

  if (specId) {
    const specDir = join(relicDir, "specs", specId);
    const specPath = join(specDir, "spec.md");
    const planPath = join(specDir, "plan.md");
    const artifactsJsonPath = join(specDir, "artifacts.json");

    spec = fileExists(specPath) ? readText(specPath) : null;
    plan = fileExists(planPath) ? readText(planPath) : null;
    changelogExcerpt = filterChangelog(relicDir, specId) || null;

    if (fileExists(artifactsJsonPath)) {
      const artJson = readJson<ArtifactsJson>(artifactsJsonPath);
      const allRefs = [...artJson.owns, ...artJson.reads];
      for (const ref of allRefs) {
        if (!ref.startsWith("shared/")) continue;
        const absPath = join(relicDir, ref);
        if (fileExists(absPath)) {
          artifacts[ref] = readText(absPath);
        }
      }
    }
  }

  return { preamble, constitution, spec, plan, artifacts, changelogExcerpt };
}

export function renderContext(ctx: BuiltContext): string {
  const sections: string[] = [];
  if (ctx.preamble) sections.push(`# Preamble\n\n${ctx.preamble}`);
  if (ctx.constitution) sections.push(`# Constitution\n\n${ctx.constitution}`);
  if (ctx.spec) sections.push(`# Spec\n\n${ctx.spec}`);
  if (ctx.plan) sections.push(`# Plan\n\n${ctx.plan}`);
  for (const [refPath, content] of Object.entries(ctx.artifacts)) {
    sections.push(`# Shared Artifact: ${refPath}\n\n${content}`);
  }
  if (ctx.changelogExcerpt) sections.push(`# Relevant Changelog\n\n${ctx.changelogExcerpt}`);
  return sections.join("\n\n---\n\n");
}
