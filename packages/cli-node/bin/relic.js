#!/usr/bin/env node
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binary = join(__dirname, "../dist/relic");

try {
  execFileSync(binary, process.argv.slice(2), { stdio: "inherit" });
} catch (e) {
  process.exit(e?.status ?? 1);
}
