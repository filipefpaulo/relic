import { join } from "path";
import { fileExists, readText, readSession } from "@relic/utility";
import { runModel } from "../core/model-runner.ts";

export interface RunSolveOptions {
  relicDir: string;
  fix?: string;
  noStream?: boolean;
}

export async function runSolve(options: RunSolveOptions): Promise<void> {
  const { relicDir, noStream } = options;

  // Resolve fix ID: arg → session.fix → error
  const fixId = options.fix ?? readSession(relicDir).fix ?? undefined;
  if (!fixId) {
    console.error("Error: no active fix. Set one with: relic use --fix <fix-id>");
    console.error("Or pass: relic solve --fix <fix-id>");
    process.exit(1);
  }

  const fixPath = join(relicDir, "fixes", `${fixId}.md`);
  if (!fileExists(fixPath)) {
    console.error(`Error: fix document not found: .relic/fixes/${fixId}.md`);
    process.exit(1);
  }

  const fixDocContent = readText(fixPath);

  // solve is a one-shot apply — no history (fixId passed but runner suppresses for solve)
  await runModel({
    command: "solve",
    userMessage: fixDocContent,
    relicDir,
    fixId,
    noStream,
  });
}
