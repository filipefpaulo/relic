#!/usr/bin/env node
// Strips the Bun shebang and @bun marker that bun build --target node
// injects into the output file. These are harmless at runtime (Node.js
// treats the hashbang as a comment) but confuse tools that inspect shebangs.
import { readFileSync, writeFileSync } from "fs";

const outFile = new URL("../packages/cli-node/dist/relic.js", import.meta.url);
let src = readFileSync(outFile, "utf8");

// Replace Bun shebang with Node.js shebang, or prepend Node.js shebang if missing
if (src.startsWith("#!/usr/bin/env bun")) {
  src = src.replace(/^#!.*\n/, "#!/usr/bin/env node\n");
} else if (!src.startsWith("#!/usr/bin/env node")) {
  src = "#!/usr/bin/env node\n" + src;
}
// Remove the @bun marker comment if present
src = src.replace(/^\/\/ @bun\n/m, "");

writeFileSync(outFile, src, "utf8");
console.log("  Fixed shebang in dist/relic.js (#!/usr/bin/env node)");
