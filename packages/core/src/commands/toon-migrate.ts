import { join, basename, extname } from "path";
import { readdirSync } from "fs";
import {
  fileExists,
  dirExists,
  readText,
  writeText,
  readJson,
  findRelicDir,
} from "@relic/utility";
import { encodeToon, decodeToon } from "@relic/utility";
import { SHARED_SUBDIRS } from "../types.ts";

export interface ManifestEntry {
  name: string;
  file: string;
  tags: string[];
  tldr: string;
}

export interface MigrateResult {
  converted: Array<{ dir: string; entries: number }>;
  spec_entries: number;
  fix_entries: number;
}

function rowToEntry(row: string[]): ManifestEntry {
  return {
    name: row[0] ?? "",
    file: row[1] ?? "",
    tags: row[2] ? row[2].split(/\s+/).filter(Boolean) : [],
    tldr: row[3] ?? "",
  };
}

function entryToRow(entry: ManifestEntry): [string, string, string[], string] {
  return [entry.name, entry.file, entry.tags, entry.tldr];
}

export function readManifestToon(subdirPath: string, header: string): ManifestEntry[] {
  const toonPath = join(subdirPath, "manifest.toon");
  const jsonPath = join(subdirPath, "manifest.json");

  if (fileExists(toonPath)) {
    const content = readText(toonPath);
    return decodeToon(content).map(rowToEntry);
  }

  if (fileExists(jsonPath)) {
    try {
      const entries = readJson<ManifestEntry[]>(jsonPath);
      const rows = entries.map(entryToRow);
      const toonContent = encodeToon(rows, header);
      writeText(toonPath, toonContent);
      console.warn(`Auto-migrating ${jsonPath} → manifest.toon`);
      return entries;
    } catch {
      console.error(`Warning: could not parse ${jsonPath} — skipping`);
      return [];
    }
  }

  return [];
}

export function buildSpecIndex(relicDir: string): ManifestEntry[] {
  const specsDir = join(relicDir, "specs");
  if (!dirExists(specsDir)) return [];

  const entries: ManifestEntry[] = [];
  let folderNames: string[];
  try {
    folderNames = readdirSync(specsDir).filter((f) => {
      return /^\d{3}-/.test(f) && dirExists(join(specsDir, f));
    });
  } catch {
    return [];
  }

  for (const folderName of folderNames) {
    const specMdPath = join(specsDir, folderName, "spec.md");
    let name = folderName;
    if (fileExists(specMdPath)) {
      const content = readText(specMdPath);
      const match = content.match(/^# Spec:\s*(.+)/m);
      if (match) name = match[1].trim();
    }
    entries.push({ name, file: folderName + "/", tags: [], tldr: "" });
  }

  return entries;
}

export function buildFixIndex(relicDir: string): ManifestEntry[] {
  const fixesDir = join(relicDir, "fixes");
  if (!dirExists(fixesDir)) return [];

  const entries: ManifestEntry[] = [];
  let files: string[];
  try {
    files = readdirSync(fixesDir).filter((f) => {
      return f.endsWith(".md") && f !== "manifest.toon" && f !== "manifest.json";
    });
  } catch {
    return [];
  }

  for (const filename of files) {
    const filePath = join(fixesDir, filename);
    const stem = basename(filename, extname(filename));
    let name = stem;
    if (fileExists(filePath)) {
      const content = readText(filePath);
      const match = content.match(/^# Fix:\s*(.+)/m);
      if (match) name = match[1].trim();
    }
    entries.push({ name, file: filename, tags: [], tldr: "" });
  }

  return entries;
}

export async function runToonMigrate(options: { relicDir?: string }): Promise<MigrateResult> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const result: MigrateResult = { converted: [], spec_entries: 0, fix_entries: 0 };
  let hasEmptyMetadata = false;

  // Convert shared/*/manifest.json → manifest.toon for subdirs that don't have .toon yet
  for (const subdir of SHARED_SUBDIRS) {
    const subdirPath = join(relicDir, "shared", subdir);
    const toonPath = join(subdirPath, "manifest.toon");
    const jsonPath = join(subdirPath, "manifest.json");

    if (fileExists(toonPath)) continue;
    if (!fileExists(jsonPath)) continue;

    try {
      const entries = readJson<ManifestEntry[]>(jsonPath);
      const rows = entries.map(entryToRow);
      const toonContent = encodeToon(rows, `# ${subdir} manifest`);
      writeText(toonPath, toonContent);

      // Validate round-trip
      const decoded = decodeToon(toonContent);
      if (decoded.length !== entries.length) {
        console.warn(`Warning: round-trip mismatch for shared/${subdir}: wrote ${entries.length} entries, decoded ${decoded.length}`);
      }

      result.converted.push({ dir: `shared/${subdir}`, entries: entries.length });

      for (const e of entries) {
        if (e.tags.length === 0 || e.tldr === "") hasEmptyMetadata = true;
      }
    } catch {
      console.error(`Warning: could not process ${jsonPath} — skipping`);
    }
  }

  // Build and write spec index
  const specsDir = join(relicDir, "specs");
  if (dirExists(specsDir)) {
    const specEntries = buildSpecIndex(relicDir);
    const specRows = specEntries.map(entryToRow);
    writeText(join(specsDir, "manifest.toon"), encodeToon(specRows, "specs index"));
    result.spec_entries = specEntries.length;
    for (const e of specEntries) {
      if (e.tags.length === 0 || e.tldr === "") hasEmptyMetadata = true;
    }
  }

  // Build and write fix index
  const fixesDir = join(relicDir, "fixes");
  if (dirExists(fixesDir)) {
    const fixEntries = buildFixIndex(relicDir);
    const fixRows = fixEntries.map(entryToRow);
    writeText(join(fixesDir, "manifest.toon"), encodeToon(fixRows, "fixes index"));
    result.fix_entries = fixEntries.length;
    for (const e of fixEntries) {
      if (e.tags.length === 0 || e.tldr === "") hasEmptyMetadata = true;
    }
  }

  if (hasEmptyMetadata) {
    console.warn("Warning: some entries have empty tags/tldr — ask your LLM to populate them.");
  }

  return result;
}
