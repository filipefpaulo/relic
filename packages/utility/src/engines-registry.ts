import { join } from "path";
import { readJson, writeJson, fileExists } from "./fs.ts";

export function readEnginesRegistry(relicDir: string): string[] {
  const path = join(relicDir, "engines.json");
  if (!fileExists(path)) return [];
  try {
    const raw = readJson<unknown>(path);
    if (!Array.isArray(raw)) return [];
    return raw.filter((e): e is string => typeof e === "string");
  } catch {
    return [];
  }
}

export function writeEnginesRegistry(relicDir: string, engines: string[]): void {
  const deduped = [...new Set(engines)].sort();
  writeJson(join(relicDir, "engines.json"), deduped);
}
