import { describe, it, expect } from "bun:test";
import { compressMessage } from "../core/history-compressor.ts";

describe("compressMessage", () => {
  it("preserves heading lines verbatim", () => {
    const input = "# My Heading";
    expect(compressMessage(input)).toBe("# My Heading");
  });

  it("preserves bullet lines verbatim", () => {
    const input = "- item one\n* item two";
    expect(compressMessage(input)).toBe("- item one\n* item two");
  });

  it("truncates prose at first period", () => {
    const input = "This is a sentence. This part should be dropped.";
    expect(compressMessage(input)).toBe("This is a sentence.");
  });

  it("truncates prose at first exclamation mark", () => {
    const input = "Watch out! Something happened here.";
    expect(compressMessage(input)).toBe("Watch out!");
  });

  it("keeps full line when no sentence terminator found", () => {
    const input = "This line has no terminator";
    expect(compressMessage(input)).toBe("This line has no terminator");
  });

  it("drops fenced code blocks entirely", () => {
    const input = "Before code.\n```\nconst x = 1;\nconsole.log(x);\n```\nAfter code.";
    const result = compressMessage(input);
    expect(result).not.toContain("const x");
    expect(result).not.toContain("console.log");
    expect(result).toContain("Before code.");
    expect(result).toContain("After code.");
  });

  it("handles mixed content: headings and bullets preserved, prose truncated, code dropped", () => {
    const input = [
      "# Section Heading",
      "Some prose paragraph that goes on and on. This sentence should be dropped.",
      "- Bullet one",
      "- Bullet two",
      "```",
      "const secret = 42;",
      "```",
      "* Another bullet",
    ].join("\n");

    const result = compressMessage(input);
    expect(result).toContain("# Section Heading");
    expect(result).toContain("Some prose paragraph that goes on and on.");
    expect(result).not.toContain("This sentence should be dropped.");
    expect(result).toContain("- Bullet one");
    expect(result).toContain("- Bullet two");
    expect(result).not.toContain("const secret");
    expect(result).toContain("* Another bullet");
  });

  it("returns empty string for empty input", () => {
    expect(compressMessage("")).toBe("");
  });
});
