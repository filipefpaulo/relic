import { join } from "path";
import { findRelicDir } from "@relic/utility";
import { SHARED_SUBDIRS } from "../types.ts";
import { readManifestToon } from "./toon-migrate.ts";

export interface SearchResultEntry {
  source: "knowledge" | "spec" | "fix";
  name: string;
  path: string;
  tags: string[];
  tldr: string;
  score: number;
}

export interface SearchOptions {
  keywords: string[];
  deep: boolean;
  knowledge: boolean;
  spec: boolean;
  fix: boolean;
  json: boolean;
  relicDir?: string;
}

export async function runSearch(options: SearchOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  const keywords = options.keywords.map((k) => k.toLowerCase()).filter(Boolean);

  if (keywords.length === 0 && !options.deep) {
    console.error("Error: relic search requires keywords or --deep flag.");
    process.exit(1);
  }

  // Scope resolution: if none set, all active
  const scopeKnowledge = options.knowledge || (!options.knowledge && !options.spec && !options.fix);
  const scopeSpec = options.spec || (!options.knowledge && !options.spec && !options.fix);
  const scopeFix = options.fix || (!options.knowledge && !options.spec && !options.fix);

  const allEntries: SearchResultEntry[] = [];

  // Load knowledge entries
  if (scopeKnowledge) {
    for (const subdir of SHARED_SUBDIRS) {
      const subdirPath = join(relicDir, "shared", subdir);
      const entries = readManifestToon(subdirPath, `${subdir} manifest`);
      for (const entry of entries) {
        allEntries.push({
          source: "knowledge",
          name: entry.name,
          path: `shared/${subdir}/${entry.file}`,
          tags: entry.tags,
          tldr: entry.tldr,
          score: 0,
        });
      }
    }
  }

  // Load spec entries
  if (scopeSpec) {
    const specsDir = join(relicDir, "specs");
    const entries = readManifestToon(specsDir, "specs index");
    for (const entry of entries) {
      allEntries.push({
        source: "spec",
        name: entry.name,
        path: `specs/${entry.file}`,
        tags: entry.tags,
        tldr: entry.tldr,
        score: 0,
      });
    }
  }

  // Load fix entries
  if (scopeFix) {
    const fixesDir = join(relicDir, "fixes");
    const entries = readManifestToon(fixesDir, "fixes index");
    for (const entry of entries) {
      allEntries.push({
        source: "fix",
        name: entry.name,
        path: `fixes/${entry.file}`,
        tags: entry.tags,
        tldr: entry.tldr,
        score: 0,
      });
    }
  }

  let results: SearchResultEntry[];

  if (keywords.length === 0) {
    // --deep with no keywords: return all, score = 0, sorted by source then name
    results = [...allEntries].sort((a, b) => {
      if (a.source !== b.source) return a.source.localeCompare(b.source);
      return a.name.localeCompare(b.name);
    });
  } else {
    // Score and filter
    for (const entry of allEntries) {
      if (entry.source === "knowledge") {
        entry.score = entry.tags.filter((t) =>
          keywords.some((kw) => t.toLowerCase().includes(kw))
        ).length;
      } else {
        const text = (entry.name + " " + entry.tldr).toLowerCase();
        entry.score = keywords.filter((kw) => text.includes(kw)).length;
      }
    }
    results = allEntries.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Toon output: 6-field lines
  const scopeFlags = [
    options.deep ? "--deep" : "",
    options.knowledge ? "--knowledge" : "",
    options.spec ? "--spec" : "",
    options.fix ? "--fix" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const keywordsStr = keywords.length > 0 ? keywords.join(" ") : "";
  const headerSuffix = keywordsStr
    ? `${scopeFlags ? scopeFlags + " " : ""}: ${keywordsStr}`
    : scopeFlags || "--deep";
  console.log(`# relic search ${headerSuffix}`);

  for (const e of results) {
    const tagsStr = e.tags.join(" ");
    console.log(`${e.source} | ${e.name} | ${e.path} | ${tagsStr} | ${e.tldr} | ${e.score}`);
  }
}
