import { join } from "path";
import { writeText, readText, fileExists } from "../utils/fs.ts";

export interface ChangelogEntry {
  specId: string;
  command: string;
  message: string;
}

export function appendChangelog(relicDir: string, entry: ChangelogEntry): void {
  const path = join(relicDir, "changelog.md");
  const timestamp = new Date().toISOString();
  const heading = `## [${timestamp}] ${entry.command} — ${entry.specId}`;
  const block = `\n${heading}\n\n${entry.message}\n`;
  const existing = fileExists(path) ? readText(path) : "";
  writeText(path, existing + block);
}

export function filterChangelog(relicDir: string, specId: string): string {
  const path = join(relicDir, "changelog.md");
  if (!fileExists(path)) return "";
  const content = readText(path);
  const blocks = content.split(/\n(?=## \[)/);
  const relevant = blocks.filter((b) => b.includes(specId));
  return relevant.join("\n");
}
