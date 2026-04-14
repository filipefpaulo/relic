import { describe, it, expect, vi } from "vitest";
import { encodeToon, decodeToon } from "../toon.ts";

describe("encodeToon", () => {
  it("empty rows → header-only string", () => {
    const result = encodeToon([]);
    expect(result).toBe("# manifest\n");
  });

  it("custom header is used", () => {
    const result = encodeToon([], "my header");
    expect(result).toBe("# my header\n");
  });

  it("string fields are written verbatim", () => {
    const result = encodeToon([["Alice", "alice.md", "auth user", "Manages auth"]]);
    expect(result).toBe("# manifest\nAlice | alice.md | auth user | Manages auth\n");
  });

  it("string field containing ` | ` is sanitised to ` - `", () => {
    const result = encodeToon([["A | B", "file.md", "", ""]]);
    expect(result).toBe("# manifest\nA - B | file.md |  | \n");
  });

  it("number field is serialised via .toString()", () => {
    const result = encodeToon([["entry", "file.md", "tag", 42]]);
    expect(result).toBe("# manifest\nentry | file.md | tag | 42\n");
  });

  it("boolean field is serialised via .toString()", () => {
    const result = encodeToon([["entry", "file.md", "tag", true]]);
    expect(result).toBe("# manifest\nentry | file.md | tag | true\n");
  });

  it("string[] field is space-joined", () => {
    const result = encodeToon([["entry", "file.md", ["auth", "session", "token"], "desc"]]);
    expect(result).toBe("# manifest\nentry | file.md | auth session token | desc\n");
  });

  it("string[] field containing ` | ` after join is sanitised", () => {
    const result = encodeToon([["entry", "file.md", ["a | b", "c"], "desc"]]);
    expect(result).toBe("# manifest\nentry | file.md | a - b c | desc\n");
  });

  it("multiple rows produce multiple lines", () => {
    const result = encodeToon([
      ["A", "a.md", "tag1", "First"],
      ["B", "b.md", "tag2", "Second"],
    ]);
    expect(result).toBe("# manifest\nA | a.md | tag1 | First\nB | b.md | tag2 | Second\n");
  });
});

describe("decodeToon", () => {
  it("round-trip with all-string rows", () => {
    const rows = [
      ["UserAuth", "UserAuth.md", "auth session token", "Handles auth"],
      ["Payment", "Payment.md", "payment billing", "Handles payments"],
    ];
    const encoded = encodeToon(rows);
    const decoded = decodeToon(encoded);
    expect(decoded).toEqual(rows);
  });

  it("blank lines are ignored", () => {
    const content = "# manifest\n\nFoo | foo.md | tag | desc\n\n";
    expect(decodeToon(content)).toEqual([["Foo", "foo.md", "tag", "desc"]]);
  });

  it("# comment lines are ignored", () => {
    const content = "# manifest\n# another comment\nFoo | foo.md | tag | desc\n";
    expect(decodeToon(content)).toEqual([["Foo", "foo.md", "tag", "desc"]]);
  });

  it("\\r\\n line endings are tolerated", () => {
    const content = "# manifest\r\nFoo | foo.md | tag | desc\r\n";
    expect(decodeToon(content)).toEqual([["Foo", "foo.md", "tag", "desc"]]);
  });

  it("long field is preserved without truncation", () => {
    const longTldr = "a".repeat(2000);
    const rows = [["entry", "file.md", "tag", longTldr]];
    const decoded = decodeToon(encodeToon(rows));
    expect(decoded[0][3]).toBe(longTldr);
  });

  it("malformed line (wrong field count) is skipped with console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = "# manifest\nonly-one-field\nFoo | foo.md | tag | desc\n";
    const result = decodeToon(content);
    expect(result).toEqual([["Foo", "foo.md", "tag", "desc"]]);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("leading/trailing whitespace on fields is trimmed", () => {
    const content = "# manifest\n  Foo  |  foo.md  |  tag  |  desc  \n";
    expect(decodeToon(content)).toEqual([["Foo", "foo.md", "tag", "desc"]]);
  });
});
