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
    return readJson<SessionState>(path);
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export function writeSession(relicDir: string, state: SessionState): void {
  writeJson(join(relicDir, "session.json"), state);
}
