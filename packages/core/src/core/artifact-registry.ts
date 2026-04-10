import { join } from "path";
import { listDirs, fileExists, readJson } from "../utils/fs.ts";
import type { ArtifactsJson, SpecMeta } from "../types.ts";

export function loadRegistry(relicDir: string): SpecMeta[] {
  const specsDir = join(relicDir, "specs");
  const specIds = listDirs(specsDir);

  return specIds.flatMap((id) => {
    const specPath = join(specsDir, id);
    const artifactsPath = join(specPath, "artifacts.json");
    if (!fileExists(artifactsPath)) return [];
    const artifacts = readJson<ArtifactsJson>(artifactsPath);
    return [{ id, path: specPath, artifacts }];
  });
}

export function buildOwnershipMap(registry: SpecMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const spec of registry) {
    for (const artifact of spec.artifacts.owns) {
      map.set(artifact, spec.id);
    }
  }
  return map;
}
