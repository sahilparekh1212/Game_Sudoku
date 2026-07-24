/**
 * Sudoku logic: puzzle generation (guaranteed unique solution), conflict
 * detection, and solve checking.
 */

export type Difficulty = "easy" | "medium" | "hard";

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
