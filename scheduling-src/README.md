# Crab Fit at rickrothbart.com/scheduling

This is the frontend of [Crab Fit](https://github.com/GRA0007/crab.fit) by Ben Grant
(GPL-3.0, see `LICENSE`), vendored from upstream commit `628f9ee` and modified
to run as a static export under `/scheduling`:

- `next.config.js`: `output: 'export'`, `basePath: '/scheduling'`, `trailingSlash`.
- Events live at `/scheduling/event/?id=<id>` (the client looks the event up)
  instead of the server-rendered `/<id>` route.
- The API URL is read at runtime from `/scheduling/config.json`, which the
  deploy workflow writes; set `NEXT_PUBLIC_API_URL` to override it locally.
- Server-rendered text is English; client components follow the visitor's
  language setting. The stats are fetched in the browser.
- Vercel analytics are removed. Share links point at rickrothbart.com.
- Rebranded as "Ricky Dicky's Schedule Time" with its own icon. The about section, stats,
  promo video, app/extension downloads, donate footer, translation prompt,
  easter egg, how-to, privacy and extension (`/create`) pages are removed.

The API is `../scheduling-lambda/`, a Node port of upstream's Rust API onto
DynamoDB (passwords are hashed with scrypt instead of bcrypt).

## Rebuilding

```bash
cd scheduling-src
yarn install --frozen-lockfile
yarn build
rm -rf ../scheduling && cp -r out ../scheduling
```

`scheduling/` is the committed build output that `.github/workflows/deploy.yml`
syncs to S3.
