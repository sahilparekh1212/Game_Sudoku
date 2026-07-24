# Sudoku (TypeScript)

A responsive Sudoku built with **TypeScript** + **Vite**. Every puzzle is generated
fresh with a guaranteed **unique solution**.

**▶ Play online:** https://game-sudoku.sahilparekh1212.com

## Run it

```bash
cd Game_Sudoku
npm install     # first time only
npm run dev     # starts the dev server
```

Then open the URL it prints (usually **http://localhost:5173**).

## How to play

- **Difficulty** — **Easy / Medium / Hard** (fewer given numbers as it gets harder).
- Click / tap a cell, then a number on the pad — or use the **keyboard**: `1`–`9` to
  place, `0` / `Backspace` to erase, arrow keys to move.
- Given numbers are bold and locked. Selecting a cell highlights its row, column, box,
  and all matching numbers. **Duplicates turn red.**
- Fill every cell correctly to solve it — the timer stops and the board turns green.
- **New Puzzle** generates a fresh grid at the current difficulty.

Works on phones and laptops — the board scales to the screen with a tap‑friendly number pad.

## Build for production

```bash
npm run build     # type-checks and outputs to dist/
npm run preview   # serves the built version
```

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds with Vite and publishes `dist/` to **GitHub Pages**. The custom domain
(`game-sudoku.sahilparekh1212.com`) is a DNS `CNAME` pointing at `sahilparekh1212.github.io`.

## License

Released under the [MIT License](LICENSE).
