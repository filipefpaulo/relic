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

export interface BuiltContext {
  preamble: string;
  constitution: string;
  spec: string | null;
  plan: string | null;
  artifacts: Record<string, string>;
  changelogExcerpt: string | null;
}
