import type {
  SpecMeta,
  IntersectionReport,
  OwnershipConflict,
  FileOverlapWarning,
} from "../types.ts";

export function detectIntersections(registry: SpecMeta[]): IntersectionReport {
  const conflicts: OwnershipConflict[] = [];
  const warnings: FileOverlapWarning[] = [];

  const ownershipMap = new Map<string, string>();
  for (const spec of registry) {
    for (const artifact of spec.artifacts.owns) {
      const existing = ownershipMap.get(artifact);
      if (existing) {
        conflicts.push({ artifact, specs: [existing, spec.id] });
      } else {
        ownershipMap.set(artifact, spec.id);
      }
    }
  }

  const touchMap = new Map<string, string>();
  for (const spec of registry) {
    for (const file of spec.artifacts.touches_files) {
      const normalised = file.replace(/\/$/, "");
      const existing = touchMap.get(normalised);
      if (existing) {
        warnings.push({ file, specs: [existing, spec.id] });
      } else {
        touchMap.set(normalised, spec.id);
      }
    }
  }

  return { conflicts, warnings };
}

export function formatIntersectionReport(report: IntersectionReport): string {
  const lines: string[] = [];
  if (report.conflicts.length > 0) {
    lines.push("OWNERSHIP CONFLICTS (must resolve before continuing):");
    for (const c of report.conflicts) {
      lines.push(
        `  [CONFLICT] "${c.artifact}" is owned by both ${c.specs[0]} and ${c.specs[1]}`
      );
    }
  }
  if (report.warnings.length > 0) {
    lines.push("FILE OVERLAP WARNINGS:");
    for (const w of report.warnings) {
      lines.push(
        `  [WARNING] "${w.file}" is touched by both ${w.specs[0]} and ${w.specs[1]}`
      );
    }
  }
  return lines.join("\n");
}
