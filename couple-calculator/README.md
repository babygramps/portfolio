# Couple calculator

Static calculator for two couples buying a home. Open `/couple-calculator/` after running `python3 -m http.server 8765` from the repository root.

- `index.html`: page structure and copy
- `style.css`: responsive layout
- `app.mjs`: inputs and results
- `math.mjs`: mortgage, contribution and stress-test calculations

Inputs remain in memory and reset on reload. No backend or build step is needed.

The portfolio deployment workflow publishes the page at `https://rickrothbart.com/couple-calculator`, with assets under `/couple-calculator/`. JavaScript modules require an `application/javascript` content type. Assets use absolute paths so the page works with or without a trailing slash.
