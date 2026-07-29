// Build the /toilet page (Fieldhouse Restroom Co.): bundle the React app AND its
// stylesheet into a single self-contained HTML file at ../toilet/index.html.
//
// The committed toilet/index.html is what the deploy syncs to S3 — CI does NOT run
// this build, so run `npm run build` here after editing anything in src/. A stale
// commit means a stale site.
//
// Because of that, this build is the LAST action before staging a commit, after
// every src/ edit is in the tree. An earlier build is not evidence the output is
// current: nothing in the pipeline compares the two, and a deploy from a stale
// artifact looks completely healthy.
//
// Single-file output is deliberate: with no separate .js/.css URLs there is nothing
// for Cloudflare to cache under an asset path, which is the failure mode that hit
// /rockfire. Target: under 400 KB total.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../toilet/index.html");
const SIZE_BUDGET_KB = 400;

const shared = {
  bundle: true,
  minify: true,
  write: false,
  charset: "utf8",
  logLevel: "warning",
};

let js;
let css;

try {
  const jsResult = await build({
    ...shared,
    entryPoints: [resolve(here, "src/main.jsx")],
    format: "iife",
    target: ["es2019"],
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".jsx": "jsx" },
  });
  js = jsResult.outputFiles[0].text;

  const cssResult = await build({
    ...shared,
    entryPoints: [resolve(here, "src/styles.css")],
    loader: { ".css": "css" },
  });
  css = cssResult.outputFiles[0].text;
} catch (err) {
  console.error("\nBuild FAILED — nothing was written to ../toilet/index.html");
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}

// Defensive: no string literal inside the bundle may prematurely close our inline
// <script> or <style> element.
js = js.replace(/<\/script>/gi, "<\\/script>");
css = css.replace(/<\/style>/gi, "<\\/style>");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#F6F2EA" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#14140F" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="Fieldhouse Restroom Co. — restroom trailers and jobsite units for the Bay Area. Published prices, live availability, and online booking in under two minutes. No quote forms." />
    <meta name="robots" content="noindex" />
    <title>Fieldhouse Restroom Co. — book online</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);

const kb = html.length / 1024;
console.log(`Wrote ${OUT} (${kb.toFixed(1)} KB)`);
console.log(`  css ${(css.length / 1024).toFixed(1)} KB  js ${(js.length / 1024).toFixed(1)} KB`);
if (kb > SIZE_BUDGET_KB) {
  console.warn(`  WARNING: over the ${SIZE_BUDGET_KB} KB single-file budget.`);
}
