import { join } from "path";
import { readJson, writeJson, fileExists } from "./fs.ts";

export interface SessionState {
  spec: string | null;
  fix: string | null;
}

const DEFAULT_SESSION: SessionState = { spec: null, fix: null };

export function readSession(relicDir: string): SessionState {
  const path = join(relicDir, "session.json");
  if (!fileExists(path)) return { ...DEFAULT_SESSION };
  try {
    const raw = readJson<Record<string, unknown>>(path);
    return {
      spec: typeof raw.spec === "string" ? raw.spec : null,
      fix: typeof raw.fix === "string" ? raw.fix : null,
    };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export function writeSession(relicDir: string, state: SessionState): void {
  writeJson(join(relicDir, "session.json"), state);
}
