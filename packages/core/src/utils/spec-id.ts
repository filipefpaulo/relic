import { listDirs } from "./fs.ts";

export function nextSpecId(specsDir: string, slug: string): string {
  const existing = listDirs(specsDir);
  const max = existing.reduce((acc, name) => {
    const n = parseInt(name.slice(0, 3), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  const padded = String(max + 1).padStart(3, "0");
  return `${padded}-${slug}`;
}

export function inferSpecFromBranch(branch: string): string | null {
  const match = branch.match(/(\d{3}-[a-z0-9-]+)/);
  return match?.[1] ?? null;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function availableSpecs(specsDir: string): string[] {
  return listDirs(specsDir).filter((name) => /^\d{3}-/.test(name));
}
