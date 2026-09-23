#!/usr/bin/env node
/* Single-file build: strip types from core.ts + ui.ts with Node's native
 * API and inline everything into dist/index.html. No npm dependencies. */

import { stripTypeScriptTypes } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL(".", import.meta.url).pathname;

function strip(file) {
  const source = readFileSync(ROOT + file, "utf8");
  const js = stripTypeScriptTypes(source, { mode: "strip" });
  // the UI imports core via a relative path — inline it instead
  return js.replace(/^import\s*{([\s\S]*?)}\s*from\s*"\.\/core\.ts";\n/m,
    "// core.ts (inlined below)\n__CORE__\n");
}

const coreJs = stripTypeScriptTypes(readFileSync(ROOT + "src/core.ts", "utf8"), {
  mode: "strip",
});
let uiJs = strip(readFileSync === undefined ? "" : "src/ui.ts");

// splice the inlined core into the ui module (replace the marker once)
uiJs = uiJs.replace("__CORE__", coreJs);

const template = readFileSync(ROOT + "index.template.html", "utf8");
const html = template.replace("/*__GAME__*/", uiJs);

mkdirSync(ROOT + "dist", { recursive: true });
writeFileSync(ROOT + "dist/index.html", html);
console.log(`dist/index.html written (${html.length} bytes) — open it in any browser, works offline`);
