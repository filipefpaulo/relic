export type ToonField = string | number | boolean | string[];

const PIPE_SEP = " | ";
const PIPE_REPLACEMENT = " - ";
const EXPECTED_FIELDS = 4;

function serializeField(field: ToonField): string {
  if (Array.isArray(field)) {
    return field.join(" ").replace(PIPE_SEP, PIPE_REPLACEMENT);
  }
  if (typeof field === "string") {
    return field.replace(PIPE_SEP, PIPE_REPLACEMENT);
  }
  return String(field);
}

export function encodeToon<T extends ToonField[]>(rows: T[], header?: string): string {
  const lines: string[] = [`# ${header ?? "manifest"}`];
  for (const row of rows) {
    lines.push(row.map(serializeField).join(PIPE_SEP));
  }
  return lines.join("\n") + "\n";
}

export function decodeToon(content: string): string[][] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const result: string[][] = [];
  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const fields = line.split(PIPE_SEP).map((f) => f.trim());
    if (fields.length !== EXPECTED_FIELDS) {
      console.warn(`decodeToon: skipping malformed line (${fields.length} fields, expected ${EXPECTED_FIELDS}): ${line}`);
      continue;
    }
    result.push(fields);
  }
  return result;
}
