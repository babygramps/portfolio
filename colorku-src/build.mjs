// Build the /colorku page: bundle the React app into a single self-contained
// HTML file at ../colorku/index.html (same shape as the original hand-built
// artifact). The committed colorku/index.html is what the deploy syncs to S3 —
// CI does not run this build, so run `npm run build` here after editing src/.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../colorku/index.html");

const result = await build({
  entryPoints: [resolve(here, "src/main.jsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});

let js = result.outputFiles[0].text;
// Defensive: ensure no string literal can prematurely close our inline <script>.
js = js.replace(/<\/script>/gi, "<\\/script>");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#eef1f4" />
    <title>Colorku</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${(html.length / 1024).toFixed(1)} KB)`);
