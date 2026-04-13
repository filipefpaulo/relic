import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readSession, writeSession } from "../session.ts";

let relicDir: string;
beforeEach(() => {
  relicDir = mkdtempSync(join(tmpdir(), "relic-session-test-"));
});
afterEach(() => {
  rmSync(relicDir, { recursive: true, force: true });
});

describe("readSession", () => {
  test("returns { spec: null, fix: null } when session.json is absent", () => {
    const state = readSession(relicDir);
    expect(state.spec).toBeNull();
    expect(state.fix).toBeNull();
  });

  test("returns correct values when session.json exists", () => {
    writeFileSync(join(relicDir, "session.json"), JSON.stringify({ spec: "001-auth", fix: "2026-04-13-some-bug" }));
    const state = readSession(relicDir);
    expect(state.spec).toBe("001-auth");
    expect(state.fix).toBe("2026-04-13-some-bug");
  });

  test("returns defaults when session.json is malformed JSON", () => {
    writeFileSync(join(relicDir, "session.json"), "not-json");
    const state = readSession(relicDir);
    expect(state.spec).toBeNull();
    expect(state.fix).toBeNull();
  });
});

describe("writeSession", () => {
  test("creates session.json with both fields", () => {
    writeSession(relicDir, { spec: "002-payments", fix: null });
    const state = readSession(relicDir);
    expect(state.spec).toBe("002-payments");
    expect(state.fix).toBeNull();
  });

  test("round-trip: spec and fix values survive write then read", () => {
    writeSession(relicDir, { spec: "001-auth", fix: "2026-04-13-null-ptr" });
    const state = readSession(relicDir);
    expect(state.spec).toBe("001-auth");
    expect(state.fix).toBe("2026-04-13-null-ptr");
  });

  test("read-merge: write spec, then write fix independently — both fields present", () => {
    writeSession(relicDir, { spec: "001-auth", fix: null });
    const current = readSession(relicDir);
    writeSession(relicDir, { ...current, fix: "2026-04-13-some-bug" });
    const state = readSession(relicDir);
    expect(state.spec).toBe("001-auth");
    expect(state.fix).toBe("2026-04-13-some-bug");
  });
});
