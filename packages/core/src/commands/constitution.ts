import { runModel } from "../core/model-runner.ts";

export interface RunConstitutionOptions {
  relicDir: string;
  noStream?: boolean;
}

export async function runConstitution(options: RunConstitutionOptions): Promise<void> {
  await runModel({
    command: "constitution",
    userMessage: "",
    relicDir: options.relicDir,
    noStream: options.noStream,
  });
}
