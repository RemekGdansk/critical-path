// Fails unless every HTML page in dist/ enforces the no-egress Content Security
// Policy. Reads the built artifact, never astro.config.mjs: the config records
// what was requested, the HTML is what the browser enforces. The decision lives
// in scripts/csp/check-page.ts, next to its fixture tests.
//
// Usage: npm run build && npm run check:csp
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkBuild } from "./csp/check-page.ts";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

/** Every HTML file under dist/, in any case and with .htm too: the platform serves all of them as HTML. */
function builtPages(): { path: string; html: string }[] {
  return readdirSync(distDir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.html?$/i.test(file) && statSync(join(distDir, file)).isFile())
    .toSorted()
    .map((file) => ({ path: join("dist", file), html: readFileSync(join(distDir, file), "utf8") }));
}

const pages = existsSync(distDir) ? builtPages() : undefined;
const violations =
  pages === undefined
    ? ["rule 1 (at least one page): dist/ does not exist; run npm run build first"]
    : checkBuild(pages);

if (pages === undefined || violations.length > 0) {
  for (const violation of violations) process.stderr.write(`${violation}\n`);
  process.exit(1);
}
process.stdout.write(`CSP check passed: ${pages.length} page(s)\n`);
