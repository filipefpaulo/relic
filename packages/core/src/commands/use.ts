import { join } from "path";
import { fileExists, dirExists, readSession, writeSession } from "@relic/utility";
import { availableSpecs } from "@relic/utility";

export interface UseOptions {
  specId?: string;
  fix?: string;
  clearFix?: boolean;
  relicDir: string;
}

export async function runUse(options: UseOptions): Promise<void> {
  const { relicDir } = options;

  // Guard: conflicting flags
  if (options.clearFix && options.fix) {
    console.error("Error: --fix and --clear-fix cannot be used together.");
    process.exit(1);
  }
  if (options.fix && options.specId) {
    console.error("Error: --fix and a spec ID cannot be used together.");
    process.exit(1);
  }

  // --clear-fix branch
  if (options.clearFix) {
    writeSession(relicDir, { ...readSession(relicDir), fix: null });
    console.log("Fix cleared.");
    return;
  }

  // --fix branch
  if (options.fix) {
    const fixDoc = join(relicDir, "fixes", options.fix + ".md");
    if (!fileExists(fixDoc)) {
      console.error(`Fix document not found: .relic/fixes/${options.fix}.md`);
      console.error("Run /relic.fix first to create a fix document.");
      process.exit(1);
    }
    writeSession(relicDir, { ...readSession(relicDir), fix: options.fix });
    console.log(`Active fix: ${options.fix}`);
    return;
  }

  // spec activation branch
  const specId = options.specId;
  if (!specId) {
    console.error("Error: provide a spec ID, --fix <fix-id>, or --clear-fix.");
    process.exit(1);
  }

  const specDir = join(relicDir, "specs", specId);
  if (!dirExists(specDir)) {
    const available = availableSpecs(join(relicDir, "specs"));
    console.error(`Spec not found: ${specId}`);
    if (available.length > 0) {
      console.error("Available specs:");
      for (const s of available) console.error(`  ${s}`);
    } else {
      console.error("No specs found. Run: relic init, then use /relic.specify");
    }
    process.exit(1);
  }

  writeSession(relicDir, { ...readSession(relicDir), spec: specId });
  console.log(`Now working on: ${specId}`);
}
