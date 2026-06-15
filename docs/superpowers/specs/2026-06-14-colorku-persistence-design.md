# /colorku page with DB-backed board persistence

**Date:** 2026-06-14
**Status:** Implemented on branch `colorku-page` (not yet deployed)

## Goal

Add the existing colorku/sudoku generator (`sudoku-generator.jsx`) to the site at
`/colorku`. The in-progress board must persist to a database so it **survives a
page refresh**, and stay persisted **until a new board is generated**.

## Decisions

- **Board scope:** a single global shared board, mirroring the BBQ cook-clock
  (`board-lambda/board.mjs`). No auth, no per-user boards. Last writer wins.
- **What survives refresh:** the full working board — seed, difficulty, placed
  colors, pencil notes, and reveal state.
- **No** realtime polling between simultaneous visitors and **no** nav link from
  the main portfolio page (out of scope).

## What persists

The puzzle is regenerated deterministically from its seed, so only a tiny slice
is stored:

```
{ seed,           // uint32 → generatePuzzle(difficultyKey, seed) rebuilds the exact puzzle
  difficultyKey,  // "easy" | "medium" | "hard" | "expert"
  entries,        // number[81]  — givens + placed colors (0 = empty)
  pencil,         // number[81][] — candidate notes per cell
  revealed,       // bool
  updatedAt }     // server timestamp (set by the Lambda)
```

`generatePuzzle` uses a seeded mulberry32 PRNG and is fully deterministic, so
`(difficultyKey, seed)` reproduces the puzzle, solution, and validation report
bit-for-bit.

## Backend — `colorku-lambda/colorku.mjs` + DynamoDB

Mirrors the cook-clock pattern.

- DynamoDB table `rick-colorku-board` (pk/sk, PAY_PER_REQUEST). One item:
  `pk="board"`, `sk="state"`, attribute `doc` = the JSON above.
- Lambda `rick-colorku-board` (Node 20, AWS SDK v3 from the runtime, public
  Function URL, CORS `*`):
  - `GET` → the saved doc, or `{}` if none.
  - `POST` → `clean()` validates/bounds the board (81-length arrays, values 0–9,
    distinct pencil digits 1–9, known difficulty, uint32 seed) then overwrites
    the single item and returns it. Malformed input → 400.
- IAM: inline policy `colorku-board-dynamodb` on the existing
  `rick-portfolio-lambda-role` granting `GetItem`/`PutItem` on the new table only.

## Frontend — edits to `SudokuGenerator.jsx`

Generator/solver/validation logic untouched. Added:

- `discoverBoardUrl()` — fetches `/colorku/config.json` → `{ boardUrl }` (written
  at deploy time). Absent/unreachable ⇒ app runs local-only (graceful).
- **Load (mount effect):** replaced `useEffect(() => newPuzzle("medium"))` with a
  load-then-generate effect. GET the saved doc; if valid, rebuild the game from
  seed+difficulty and restore entries/pencil/revealed; else generate a fresh
  medium board. A `hydratedRef` gates saves until this settles.
- **Save effect (debounced ~600 ms):** serializes `{seed, difficultyKey, entries,
  pencil, revealed}` and POSTs it whenever that slice changes. Deduped via
  `lastSavedRef` so cursor moves / "check entries" don't write. Fires on Generate
  (replaces the board), on placing/erasing colors, on pencil edits, reveal, and
  reset.

## Build & deploy

- Source + build live in `colorku-src/` (`src/SudokuGenerator.jsx`, `src/main.jsx`,
  `build.mjs`, `package.json`). `npm run build` bundles via esbuild into a single
  self-contained `colorku/index.html` (`<title>Colorku</title>`), same shape as
  the original artifact. The built file is committed; **CI does not build** — it
  only syncs `colorku/`, exactly like crossword/bbq.
- `.github/workflows/deploy.yml` gains two steps mirroring the existing ones:
  - "Deploy Colorku app to /colorku/" — `aws s3 sync colorku/` (excluding
    `config.json`) + copy `index.html` to the extensionless `/colorku` key.
  - "Deploy Colorku shared-board backend" — create table + role policy + Lambda +
    Function URL (idempotent), then write `colorku/config.json` (no-cache).
- `.gitignore` negations keep `colorku-src/package.json` / `package-lock.json`
  tracked despite the repo's global ignore of those filenames.

## Verification

- esbuild build succeeds (170 KB single file); inline script parses.
- jsdom smoke test: mounts, renders 81 cells + given color discs + Generate
  button + validation report, and falls back to local-only play when no backend
  is reachable.
- Full interactive/persistence verification happens once deployed (the Function
  URL only exists after the deploy step runs).

## To rebuild after editing the app

```
cd colorku-src && npm install && npm run build   # writes ../colorku/index.html
```
