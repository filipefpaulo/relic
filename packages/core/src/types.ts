export interface ArtifactsJson {
  owns: string[];
  reads: string[];
  touches_files: string[];
}

export interface SpecMeta {
  id: string;
  path: string;
  artifacts: ArtifactsJson;
}

export interface OwnershipConflict {
  artifact: string;
  specs: [string, string];
}

export interface FileOverlapWarning {
  file: string;
  specs: [string, string];
}

export interface IntersectionReport {
  conflicts: OwnershipConflict[];
  warnings: FileOverlapWarning[];
}

export const SHARED_SUBDIRS = ["domains", "contracts", "rules", "assumptions"] as const;
export type SharedSubdir = (typeof SHARED_SUBDIRS)[number];

export interface ManifestEntry {
  name: string;
  file: string;
  tldr: string;
  tags: string[];
}

export interface SearchResult extends ManifestEntry {
  path: string;
  score: number;
}

export interface WritePayload {
  name: string;
  description: string;
  file?: string;
  slash_command?: string;
  tags?: string[];
  metadata?: string;
}

export interface BuiltContext {
  preamble: string;
  constitution: string;
  spec: string | null;
  plan: string | null;
  artifacts: Record<string, string>;
  changelogExcerpt: string | null;
}
