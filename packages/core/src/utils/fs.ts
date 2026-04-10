import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";

export function fileExists(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

export function dirExists(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function readText(p: string): string {
  return readFileSync(p, "utf8");
}

export function writeText(p: string, content: string): void {
  writeFileSync(p, content, "utf8");
}

export function readJson<T>(p: string): T {
  return JSON.parse(readText(p)) as T;
}

export function writeJson(p: string, data: unknown): void {
  writeText(p, JSON.stringify(data, null, 2) + "\n");
}

export function listDirs(p: string): string[] {
  if (!dirExists(p)) return [];
  return readdirSync(p).filter((name: string) =>
    statSync(join(p, name)).isDirectory()
  );
}

export function findRelicDir(startDir: string): string | null {
  let current = startDir;
  while (true) {
    const candidate = join(current, ".relic");
    if (dirExists(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
