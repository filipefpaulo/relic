import { join } from "path";
import { writeText, dirExists } from "../utils/fs.ts";
import { availableSpecs } from "../utils/spec-id.ts";

export interface UseOptions {
  specId: string;
  relicDir: string;
}

export async function runUse(options: UseOptions): Promise<void> {
  const { specId, relicDir } = options;
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

  writeText(join(relicDir, "current-spec"), specId);
  console.log(`Now working on: ${specId}`);
}
