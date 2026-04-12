import { join } from "path";
import { findRelicDir, fileExists, readJson } from "../utils/fs.ts";
import type { ManifestEntry, SearchResult } from "../types.ts";

export interface SearchOptions {
  keywords: string[];
  relicDir?: string;
}

export interface DeepSearchOptions {
  relicDir?: string;
}

const SHARED_SUBDIRS = ["domains", "contracts", "rules", "assumptions"] as const;

function loadAllManifests(
  relicDir: string
): Array<{ subdir: string; entry: ManifestEntry }> {
  const results: Array<{ subdir: string; entry: ManifestEntry }> = [];
  for (const subdir of SHARED_SUBDIRS) {
    const manifestPath = join(relicDir, "shared", subdir, "manifest.json");
    if (!fileExists(manifestPath)) continue;
    try {
      const entries = readJson<ManifestEntry[]>(manifestPath);
      for (const entry of entries) {
        results.push({ subdir, entry });
      }
    } catch {
      console.error(`Warning: could not parse ${manifestPath} — skipping`);
    }
  }
  return results;
}

export async function runSearch(options: SearchOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const keywords = options.keywords.map((k) => k.toLowerCase());
  const all = loadAllManifests(relicDir);

  const results: SearchResult[] = [];
  for (const { subdir, entry } of all) {
    const score = entry.tags.filter((tag) =>
      keywords.some((kw) => tag.toLowerCase().includes(kw))
    ).length;
    if (score > 0) {
      results.push({
        ...entry,
        path: `shared/${subdir}/${entry.file}`,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  console.log(JSON.stringify(results, null, 2));
}

export async function runDeepSearch(options: DeepSearchOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const all = loadAllManifests(relicDir);
  const results = all.map(({ subdir, entry }) => ({
    path: `shared/${subdir}/${entry.file}`,
    name: entry.name,
    tldr: entry.tldr,
    tags: entry.tags,
  }));

  console.log(JSON.stringify(results, null, 2));
}
