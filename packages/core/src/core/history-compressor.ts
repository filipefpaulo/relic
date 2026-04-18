/**
 * Deterministic structural extract for conversation history compression.
 * Pure function — no I/O, no model calls, no side effects.
 *
 * Rules:
 * - Heading lines (starting with #) are kept verbatim
 * - Bullet lines (starting with "- " or "* ") are kept verbatim
 * - Fenced code blocks (``` to ```) are dropped entirely
 * - Prose lines: only the first sentence is kept (up to first ., !, or ?)
 */
export function compressMessage(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    // Detect fenced code block boundaries
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip lines inside code blocks
    if (inCodeBlock) continue;

    // Headings — keep verbatim
    if (trimmed.startsWith("#")) {
      output.push(line);
      continue;
    }

    // Bullets — keep verbatim
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      output.push(line);
      continue;
    }

    // Empty lines — keep for structure
    if (trimmed === "") {
      output.push(line);
      continue;
    }

    // Prose — keep only the first sentence
    const match = line.match(/^(.*?[.!?])/);
    if (match?.[1] !== undefined) {
      output.push(match[1]);
    } else {
      // No sentence terminator — keep the full line
      output.push(line);
    }
  }

  return output.join("\n");
}
