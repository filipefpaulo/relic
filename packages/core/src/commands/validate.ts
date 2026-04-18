import { join } from "path";
import { readdirSync, statSync } from "fs";
import { findRelicDir, fileExists, dirExists, readJson, readText, decodeToon } from "@relic/utility";
import { loadRegistry } from "../core/artifact-registry.ts";
import { SHARED_SUBDIRS } from "../types.ts";

export interface ValidateOptions {
  text?: boolean;
  relicDir?: string;
}

const ALLOWED_SPEC_FILES = new Set(["spec.md", "plan.md", "tasks.md", "artifacts.json", "history.json"]);

interface ValidateResult {
  valid: boolean;
  conflicts: Array<{ artifact: string; specs: string[] }>;
  missing_owned: Array<{ artifact: string; spec: string }>;
  missing_reads: Array<{ artifact: string; spec: string }>;
  illegal_files: Array<{ file: string; spec: string }>;
  invalid_paths: Array<{ path: string; spec: string; field: string }>;
  missing_manifests: Array<{ subdir: string }>;
  invalid_manifests: Array<{ subdir: string }>;
  unregistered_files: Array<{ subdir: string; file: string }>;
  warnings: string[];
}

export async function runValidate(options: ValidateOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const registry = loadRegistry(relicDir);

  const conflicts: ValidateResult["conflicts"] = [];
  const missingOwned: ValidateResult["missing_owned"] = [];
  const missingReads: ValidateResult["missing_reads"] = [];
  const illegalFiles: ValidateResult["illegal_files"] = [];
  const invalidPaths: ValidateResult["invalid_paths"] = [];
  const missingManifests: ValidateResult["missing_manifests"] = [];
  const invalidManifests: ValidateResult["invalid_manifests"] = [];
  const unregisteredFiles: ValidateResult["unregistered_files"] = [];
  const warnings: ValidateResult["warnings"] = [];

  // Build ownership map to detect conflicts
  const ownershipMap = new Map<string, string[]>();
  for (const spec of registry) {
    for (const artifact of spec.artifacts.owns) {
      const owners = ownershipMap.get(artifact) ?? [];
      owners.push(spec.id);
      ownershipMap.set(artifact, owners);
    }
  }

  for (const [artifact, specs] of ownershipMap.entries()) {
    if (specs.length > 1) conflicts.push({ artifact, specs });
  }

  for (const spec of registry) {
    // Check owned artifacts exist and have valid paths
    for (const artifact of spec.artifacts.owns) {
      if (!artifact.startsWith("shared/")) {
        invalidPaths.push({ path: artifact, spec: spec.id, field: "owns" });
      } else if (!fileExists(join(relicDir, artifact))) {
        missingOwned.push({ artifact, spec: spec.id });
      }
    }

    // Check read artifacts exist and have valid paths
    for (const artifact of spec.artifacts.reads) {
      if (!artifact.startsWith("shared/")) {
        invalidPaths.push({ path: artifact, spec: spec.id, field: "reads" });
      } else if (!fileExists(join(relicDir, artifact))) {
        missingReads.push({ artifact, spec: spec.id });
      }
    }

    // Check for illegal files in spec dir
    if (dirExists(spec.path)) {
      const entries = readdirSync(spec.path);
      for (const entry of entries) {
        if (statSync(join(spec.path, entry)).isFile() && !ALLOWED_SPEC_FILES.has(entry)) {
          illegalFiles.push({ file: entry, spec: spec.id });
        }
      }
    }
  }

  // Check shared/ subdirs for missing manifests and unregistered files
  for (const subdir of SHARED_SUBDIRS) {
    const subdirPath = join(relicDir, "shared", subdir);
    if (!dirExists(subdirPath)) continue;
    const mdFiles = readdirSync(subdirPath).filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 0) continue;

    const toonPath = join(subdirPath, "manifest.toon");
    const jsonPath = join(subdirPath, "manifest.json");

    let registered: Set<string>;

    if (fileExists(toonPath)) {
      // Prefer toon
      try {
        const rows = decodeToon(readText(toonPath));
        registered = new Set(rows.map((r) => r[1] ?? ""));
      } catch {
        invalidManifests.push({ subdir });
        continue;
      }
    } else if (fileExists(jsonPath)) {
      // JSON fallback — warn but still validate
      warnings.push(
        `shared/${subdir}: manifest.json found without manifest.toon — run: relic toon-migrate`
      );
      try {
        const parsed = readJson<unknown>(jsonPath);
        if (!Array.isArray(parsed)) {
          invalidManifests.push({ subdir });
          continue;
        }
        registered = new Set((parsed as Array<{ file: string }>).map((e) => e.file));
      } catch {
        invalidManifests.push({ subdir });
        continue;
      }
    } else {
      missingManifests.push({ subdir });
      continue;
    }

    for (const mdFile of mdFiles) {
      if (!registered.has(mdFile)) {
        unregisteredFiles.push({ subdir, file: mdFile });
      }
    }
  }

  const result: ValidateResult = {
    valid: conflicts.length === 0 && missingOwned.length === 0 && missingReads.length === 0 && illegalFiles.length === 0 && invalidPaths.length === 0 && missingManifests.length === 0 && invalidManifests.length === 0 && unregisteredFiles.length === 0,
    conflicts,
    missing_owned: missingOwned,
    missing_reads: missingReads,
    illegal_files: illegalFiles,
    invalid_paths: invalidPaths,
    missing_manifests: missingManifests,
    invalid_manifests: invalidManifests,
    unregistered_files: unregisteredFiles,
    warnings,
  };

  if (options.text) {
    console.log(result.valid ? "✓ All artifacts valid" : "✗ Validation failed");
    if (conflicts.length > 0) {
      console.log("\nOwnership conflicts:");
      for (const c of conflicts) console.log(`  ${c.artifact} claimed by: ${c.specs.join(", ")}`);
    }
    if (missingOwned.length > 0) {
      console.log("\nMissing owned artifacts:");
      for (const m of missingOwned) console.log(`  [${m.spec}] ${m.artifact}`);
    }
    if (missingReads.length > 0) {
      console.log("\nMissing read artifacts:");
      for (const m of missingReads) console.log(`  [${m.spec}] ${m.artifact}`);
    }
    if (illegalFiles.length > 0) {
      console.log("\nIllegal files in spec dirs:");
      for (const f of illegalFiles) console.log(`  [${f.spec}] ${f.file}`);
    }
    if (invalidPaths.length > 0) {
      console.log("\nInvalid paths (must start with shared/):");
      for (const p of invalidPaths) console.log(`  [${p.spec}] ${p.field}: ${p.path}`);
    }
    if (missingManifests.length > 0) {
      console.log("\nMissing manifests (shared/<subdir>/manifest.json required):");
      for (const m of missingManifests) console.log(`  shared/${m.subdir}/manifest.json`);
    }
    if (invalidManifests.length > 0) {
      console.log("\nInvalid manifests (must be a JSON array):");
      for (const m of invalidManifests) console.log(`  shared/${m.subdir}/manifest.json`);
    }
    if (unregisteredFiles.length > 0) {
      console.log("\nUnregistered files (add to manifest.toon or manifest.json):");
      for (const u of unregisteredFiles) console.log(`  shared/${u.subdir}/${u.file}`);
    }
    if (warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of warnings) console.log(`  ${w}`);
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
