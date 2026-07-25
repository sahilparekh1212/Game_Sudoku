# 🔢 Sudoku

A responsive **Sudoku** built from scratch with **TypeScript + Vite**. Every puzzle is generated
fresh with a **guaranteed unique solution**, and an optional **AI hint** explains the *next logical
step* — not just the answer.

**▶️ Play:** **https://game-sudoku.sahilparekh1212.com** &nbsp;·&nbsp; 🕹️ [All games](https://games.sahilparekh1212.com)

## 📑 Contents

- [✨ Features](#-features)
- [🚀 Run locally](#-run-locally)
- [🎯 How to play](#-how-to-play)
- [🧩 How puzzles are generated](#-how-puzzles-are-generated)
- [🧠 How the AI hint works](#-how-the-ai-hint-works)
- [🏗️ Design & project structure](#️-design--project-structure)
- [🧪 Testing & verification](#-testing--verification)
- [🚀 Deployment](#-deployment)
- [📄 License](#-license)

## ✨ Features

- 🧩 **Freshly generated** puzzles, each with a **provably unique** solution.
- 🟢🟡🔴 Three difficulties (more blanks as it gets harder) · ⏱️ timer · conflict highlighting.
- ⌨️ Full keyboard support (`1`–`9`, erase, arrow-key navigation) + a tap-friendly number pad.
- 💡 **AI hint** — an optional, draggable bar that explains the next deducible cell using a *named
  solving technique*, updating as you fill each step. Toggle on/off; it never covers the board.

## 🚀 Run locally

```bash
git clone https://github.com/sahilparekh1212/Game_Sudoku
cd Game_Sudoku
npm install       # first time only
npm run dev       # → http://localhost:5173
```

Other scripts:

```bash
npm run build     # type-check (tsc, strict) + Vite production build → dist/
npm run preview   # serve the production build locally
```

The AI hint needs the [`hints-api`](https://github.com/sahilparekh1212/games#-the-ai-backend--endpoints)
backend. To point local dev at a Worker, run in the browser console:
`localStorage.setItem("hintsApi", "http://localhost:8787")`.

## 🎯 How to play

- **Difficulty** — Easy / Medium / Hard (fewer givens as it gets harder).
- Tap a cell then a number — or use the **keyboard**: `1`–`9` to place, `0`/`Backspace` to erase,
  arrows to move.
- Givens are bold and locked; selecting a cell highlights its row, column, box and matching numbers.
  **Duplicates turn red.**
- Fill every cell correctly to solve — the timer stops and the board turns green.

## 🧩 How puzzles are generated

Generation guarantees a **single** solution (in [`src/game.ts`](src/game.ts)):

1. 🎲 Fill an empty grid with a randomized backtracking solver → a complete, valid solution.
2. ✂️ Remove cells one at a time, but only if the puzzle **still has exactly one solution** (checked
   with a most-constrained-cell solution counter that early-exits at 2). Ambiguous removals are
   reverted.

## 🧠 How the AI hint works

The hint follows one rule used across all my games:

> **The solver finds the step. Claude only explains it.**

1. [`Sudoku.hint()`](src/game.ts) scans for a genuinely deducible cell — a **naked single** (only one
   digit fits the cell) or a **hidden single** (a digit fits only one cell in a row/column/box). Every
   candidate is **cross-checked against the stored solution**, so a hint is correct even if you've
   entered a wrong digit.
2. The browser POSTs the grid + that step to the **`hints-api`** Worker (see
   [`src/hints.ts`](src/hints.ts)).
3. **Claude** explains *how to deduce it* using the named technique — without revealing any other cell.

```mermaid
flowchart LR
  A["Current grid"] --> B["Sudoku.hint()<br/>naked / hidden single"]
  B --> C["POST /hint/sudoku<br/>(hints-api Worker)"]
  C --> D["✨ Claude explains the deduction"]
  D --> E["💡 Hint bar (updates each step)"]
```

Because the *cell and value* come from the solver, the hint is **always right**; Claude only supplies
the human-readable reasoning. The bar caches per step and advances as you fill the suggested cell.

**Endpoint contract** — `POST /hint/sudoku`:

```jsonc
// request  (cells: 81 numbers, 0 = empty)
{ "cells": [5,3,0, ...], "index": 2, "value": 4, "technique": "naked" }
// response
{ "hint": "Row 1, column 3 must be 4 — every other digit already appears in its row, column, or box." }
```

## 🏗️ Design & project structure

Logic (generation, solving, conflict detection) is fully separated from DOM/rendering.

```
Game_Sudoku/
├── index.html                      # page shell + all styling
├── src/
│   ├── game.ts                     # Sudoku class: generation, unique-solution check, solver, hint()
│   ├── main.ts                     # DOM wiring, rendering, hint bar, dropdown controls
│   └── hints.ts                    # thin client for the hints-api Worker
├── .github/workflows/deploy.yml    # CI: build + publish to GitHub Pages
├── package.json · tsconfig.json
└── LICENSE
```

- 🧠 [`src/game.ts`](src/game.ts) — the `Sudoku` engine: backtracking generator, uniqueness
  guarantee, conflict detection, and `hint()` (naked/hidden single finder).
- 🎨 [`src/main.ts`](src/main.ts) — board + pad rendering, keyboard input, dropdown controls, and the
  draggable hint bar.
- 🔌 [`src/hints.ts`](src/hints.ts) — one `fetch` wrapper around the Worker endpoint.
- 🚢 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — the deploy pipeline.

## 🧪 Testing & verification

- ✅ **Type safety + build** — `npm run build` runs `tsc` (strict) then a Vite build — the CI gate.
- 🧩 **Solver correctness** — the hint engine is stress-tested by **solving whole puzzles through
  repeated hints**: across many generated boards and difficulties, *every* suggested value is asserted
  to equal the solution and every claimed naked/hidden-single deduction is re-verified.
- 🔌 **Hint flow** — verified against a local mock (loading → explanation → cache), and the live
  Worker is contract-tested with `curl` (origin allowlist, body validation, happy path).

## 🚀 Deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
type-checks, builds with Vite, and publishes `dist/` to **GitHub Pages**. The custom domain
`game-sudoku.sahilparekh1212.com` is a DNS `CNAME` → `sahilparekh1212.github.io`.

## 📄 License

Released under the [MIT License](LICENSE).
