/**
 * Sudoku logic: puzzle generation (guaranteed unique solution), conflict
 * detection, and solve checking.
 */

export type Difficulty = "easy" | "medium" | "hard";

/** The deduction that justifies a hinted cell (drives the coach's explanation). */
export type Technique = "naked" | "hidden-row" | "hidden-col" | "hidden-box" | "reveal";
export interface SudokuHint {
  index: number;
  value: number;
  technique: Technique;
}

/** How many of the 81 cells to try to blank out per difficulty. */
const REMOVALS: Record<Difficulty, number> = {
  easy: 44,
  medium: 50,
  hard: 54,
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Sudoku {
  solution: number[] = Array(81).fill(0);
  given: boolean[] = Array(81).fill(false);
  cells: number[] = Array(81).fill(0);
  difficulty: Difficulty = "easy";

  newGame(d: Difficulty = this.difficulty): void {
    this.difficulty = d;
    this.solution = this.generateSolved();
    const puzzle = this.makePuzzle(this.solution, REMOVALS[d]);
    this.given = puzzle.map((v) => v !== 0);
    this.cells = puzzle.slice();
  }

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
  }

  setCell(i: number, val: number): void {
    if (!this.given[i]) this.cells[i] = val;
  }

  clearCell(i: number): void {
    if (!this.given[i]) this.cells[i] = 0;
  }

  isSolved(): boolean {
    for (let i = 0; i < 81; i++) if (this.cells[i] !== this.solution[i]) return false;
    return true;
  }

  filledCount(): number {
    let n = 0;
    for (let i = 0; i < 81; i++) if (this.cells[i] !== 0) n++;
    return n;
  }

  /** Cells that duplicate a value within their row, column, or 3×3 box. */
  conflicts(): boolean[] {
    const bad: boolean[] = Array(81).fill(false);
    const check = (idxs: number[]): void => {
      const seen: Record<number, number[]> = {};
      for (const i of idxs) {
        const v = this.cells[i];
        if (v !== 0) {
          if (!seen[v]) seen[v] = [];
          seen[v].push(i);
        }
      }
      for (const v in seen) if (seen[v].length > 1) for (const i of seen[v]) bad[i] = true;
    };
    for (let r = 0; r < 9; r++) check(Array.from({ length: 9 }, (_, c) => r * 9 + c));
    for (let c = 0; c < 9; c++) check(Array.from({ length: 9 }, (_, r) => r * 9 + c));
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const g: number[] = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.push((br * 3 + i) * 9 + (bc * 3 + j));
        check(g);
      }
    }
    return bad;
  }

  // ---- Hints ---------------------------------------------------------------

  /** Candidate digits that could legally go in empty cell `i` right now. */
  private candidates(i: number): number[] {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const used = new Set<number>();
    for (let k = 0; k < 9; k++) {
      used.add(this.cells[r * 9 + k]);
      used.add(this.cells[k * 9 + c]);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) used.add(this.cells[(br + a) * 9 + (bc + b)]);
    const out: number[] = [];
    for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
    return out;
  }

  /**
   * Pick the next cell to reveal, preferring a genuinely deducible one:
   *   naked single  → only one digit fits the cell
   *   hidden single → a digit fits only one cell in its row/column/box
   * Falls back to revealing a correct cell from the solution. Every returned
   * value is cross-checked against the solution, so a hint is always correct
   * even if the player has entered wrong digits.
   */
  hint(): SudokuHint | null {
    if (this.isSolved()) return null;
    const empties: number[] = [];
    for (let i = 0; i < 81; i++) if (this.cells[i] === 0) empties.push(i);
    if (empties.length === 0) return null;

    // 1. Naked single.
    for (const i of empties) {
      const cs = this.candidates(i);
      if (cs.length === 1 && cs[0] === this.solution[i]) {
        return { index: i, value: cs[0], technique: "naked" };
      }
    }

    // 2. Hidden single within a unit (row / column / box).
    const inUnit = (idxs: number[], technique: Technique): SudokuHint | null => {
      for (let n = 1; n <= 9; n++) {
        if (idxs.some((i) => this.cells[i] === n)) continue; // already placed
        const spots = idxs.filter((i) => this.cells[i] === 0 && this.candidates(i).includes(n));
        if (spots.length === 1 && this.solution[spots[0]] === n) {
          return { index: spots[0], value: n, technique };
        }
      }
      return null;
    };
    for (let r = 0; r < 9; r++) {
      const hit = inUnit(Array.from({ length: 9 }, (_, c) => r * 9 + c), "hidden-row");
      if (hit) return hit;
    }
    for (let c = 0; c < 9; c++) {
      const hit = inUnit(Array.from({ length: 9 }, (_, r) => r * 9 + c), "hidden-col");
      if (hit) return hit;
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const g: number[] = [];
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) g.push((br * 3 + a) * 9 + (bc * 3 + b));
        const hit = inUnit(g, "hidden-box");
        if (hit) return hit;
      }
    }

    // 3. Fallback: reveal a correct cell (prefer one not currently in conflict).
    const conflicts = this.conflicts();
    const clean = empties.find((i) => !conflicts[i]) ?? empties[0];
    return { index: clean, value: this.solution[clean], technique: "reveal" };
  }

  // ---- Generation ----------------------------------------------------------

  private valid(grid: number[], pos: number, n: number): boolean {
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    for (let i = 0; i < 9; i++) {
      if (grid[r * 9 + i] === n) return false;
      if (grid[i * 9 + c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) if (grid[(br + i) * 9 + (bc + j)] === n) return false;
    }
    return true;
  }

  private generateSolved(): number[] {
    const grid = Array(81).fill(0);
    this.fill(grid);
    return grid;
  }

  private fill(grid: number[]): boolean {
    const pos = grid.indexOf(0);
    if (pos === -1) return true;
    for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (this.valid(grid, pos, n)) {
        grid[pos] = n;
        if (this.fill(grid)) return true;
        grid[pos] = 0;
      }
    }
    return false;
  }

  /** Count solutions up to `limit`, choosing the most-constrained cell (fast). */
  private countSolutions(grid: number[], limit: number): number {
    let best = -1;
    let bestCands: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const cands: number[] = [];
      for (let n = 1; n <= 9; n++) if (this.valid(grid, i, n)) cands.push(n);
      if (cands.length === 0) return 0; // dead end
      if (bestCands === null || cands.length < bestCands.length) {
        best = i;
        bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) return 1; // solved
    let count = 0;
    for (const n of bestCands as number[]) {
      grid[best] = n;
      count += this.countSolutions(grid, limit - count);
      grid[best] = 0;
      if (count >= limit) break;
    }
    return count;
  }

  private makePuzzle(solution: number[], removals: number): number[] {
    const puzzle = solution.slice();
    let removed = 0;
    for (const pos of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
      if (removed >= removals) break;
      const backup = puzzle[pos];
      puzzle[pos] = 0;
      if (this.countSolutions(puzzle.slice(), 2) !== 1) {
        puzzle[pos] = backup; // removal would make the solution ambiguous — keep it
      } else {
        removed++;
      }
    }
    return puzzle;
  }
}
