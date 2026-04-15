import { join, dirname } from "path";
import { findRelicDir, writeText } from "@relic/utility";
import { encodeToon } from "@relic/utility";
import { appendChangelogEntry } from "../core/changelog.ts";
import { readManifestToon } from "./toon-migrate.ts";
import type { WritePayload, ManifestEntry } from "../types.ts";

export type WriteTarget =
  | "changelog"
  | "specs"
  | "fixes"
  | "knowledge-domains"
  | "knowledge-contracts"
  | "knowledge-rules"
  | "knowledge-assumptions";

export interface WriteOptions {
  target: WriteTarget;
  payload: string;
  relicDir?: string;
}

export interface WriteResult {
  target: WriteTarget;
  action: "appended" | "upserted";
  name: string;
}

function validateWritePayload(raw: unknown): WritePayload {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Payload must be a JSON object.");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["name"] !== "string" || obj["name"].trim() === "") {
    throw new Error('Payload missing required string field: "name".');
  }
  if (typeof obj["description"] !== "string" || obj["description"].trim() === "") {
    throw new Error('Payload missing required string field: "description".');
  }
  return {
    name: obj["name"] as string,
    description: obj["description"] as string,
    file: typeof obj["file"] === "string" ? obj["file"] : undefined,
    slash_command: typeof obj["slash_command"] === "string" ? obj["slash_command"] : undefined,
    tags: Array.isArray(obj["tags"]) ? (obj["tags"] as string[]) : undefined,
    metadata: typeof obj["metadata"] === "string" ? obj["metadata"] : undefined,
  };
}

function upsertToonEntry(
  toonPath: string,
  header: string,
  entry: ManifestEntry
): "appended" | "upserted" {
  const dir = dirname(toonPath);
  const existing = readManifestToon(dir, header);
  const idx = existing.findIndex((e) => e.name === entry.name);

  let action: "appended" | "upserted";
  let updated: ManifestEntry[];

  if (idx !== -1) {
    // Upsert: preserve existing file field if new entry has no file
    const preserved: ManifestEntry = {
      ...existing[idx]!,
      tags: entry.tags.length > 0 ? entry.tags : existing[idx]!.tags,
      tldr: entry.tldr !== "" ? entry.tldr : existing[idx]!.tldr,
    };
    updated = [...existing];
    updated[idx] = preserved;
    action = "upserted";
  } else {
    // Append: file is required for new entries
    if (entry.file.trim() === "") {
      throw new Error(
        `Cannot append new toon entry "${entry.name}": "file" field is required for new entries.`
      );
    }
    updated = [...existing, entry];
    action = "appended";
  }

  const rows = updated.map(
    (e): [string, string, string[], string] => [e.name, e.file, e.tags, e.tldr]
  );
  writeText(toonPath, encodeToon(rows, header));
  return action;
}

function resolveTargetPath(
  relicDir: string,
  target: WriteTarget
): { toonPath: string; header: string } | null {
  switch (target) {
    case "changelog":
      return null;
    case "specs":
      return { toonPath: join(relicDir, "specs", "manifest.toon"), header: "specs index" };
    case "fixes":
      return { toonPath: join(relicDir, "fixes", "manifest.toon"), header: "fixes index" };
    case "knowledge-domains":
      return {
        toonPath: join(relicDir, "shared", "domains", "manifest.toon"),
        header: "domains manifest",
      };
    case "knowledge-contracts":
      return {
        toonPath: join(relicDir, "shared", "contracts", "manifest.toon"),
        header: "contracts manifest",
      };
    case "knowledge-rules":
      return {
        toonPath: join(relicDir, "shared", "rules", "manifest.toon"),
        header: "rules manifest",
      };
    case "knowledge-assumptions":
      return {
        toonPath: join(relicDir, "shared", "assumptions", "manifest.toon"),
        header: "assumptions manifest",
      };
  }
}

export async function runWrite(options: WriteOptions): Promise<void> {
  const relicDir = options.relicDir ?? findRelicDir(process.cwd());
  if (!relicDir) {
    console.error("Error: not in a Relic project. Run: relic init");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(options.payload);
  } catch {
    console.error("Error: --payload is not valid JSON.");
    process.exit(1);
  }

  let payload: WritePayload;
  try {
    payload = validateWritePayload(parsed);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  let action: "appended" | "upserted";

  if (options.target === "changelog") {
    appendChangelogEntry(relicDir, payload);
    action = "appended";
  } else {
    const resolved = resolveTargetPath(relicDir, options.target);
    if (!resolved) {
      console.error(`Error: unknown target "${options.target}".`);
      process.exit(1);
    }

    const tldr = payload.metadata
      ? `${payload.description} — ${payload.metadata}`
      : payload.description;

    const entry: ManifestEntry = {
      name: payload.name,
      file: payload.file ?? "",
      tags: payload.tags ?? [],
      tldr,
    };

    try {
      action = upsertToonEntry(resolved.toonPath, resolved.header, entry);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const result: WriteResult = { target: options.target, action, name: payload.name };
  console.log(JSON.stringify(result));
}
