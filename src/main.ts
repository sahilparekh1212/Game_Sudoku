import { Sudoku, type Difficulty } from "./game.ts";
import { fetchSudokuHint } from "./hints.ts";

const game = new Sudoku();
// Expose a handle for debugging in the console (harmless in production).
(window as unknown as { game: Sudoku }).game = game;

const boardEl = document.getElementById("board") as HTMLDivElement;
const padEl = document.getElementById("pad") as HTMLDivElement;
const statusEl = document.getElementById("status-text") as HTMLElement;
const timerEl = document.getElementById("timer") as HTMLElement;

const hintBar = document.getElementById("hint-bar") as HTMLElement;
const hintText = document.getElementById("hint-text") as HTMLElement;
let hintsEnabled = localStorage.getItem("sudoku:hints") === "on";
const hintCache = new Map<string, string>(); // hint identity -> text
let hintKey = ""; // hint currently shown/fetching (guards stale async results)
let hintDebounce: number | undefined;
makeDraggable(hintBar, "sudoku:hintPos"); // let the user drag the hint anywhere

let selected = -1;
let startTime = 0;
let timerId: number | undefined;
let solved = false;

// Build the 9×9 board.
const cellEls: HTMLButtonElement[] = [];
for (let i = 0; i < 81; i++) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cell";
  const r = Math.floor(i / 9);
  const c = i % 9;
  if (c === 2 || c === 5) btn.classList.add("box-right");
  if (r === 2 || r === 5) btn.classList.add("box-bottom");
  if (c === 8) btn.classList.add("col-last");
  if (r === 8) btn.classList.add("row-last");
  btn.addEventListener("click", () => selectCell(i));
  boardEl.appendChild(btn);
  cellEls.push(btn);
}

// Build the number pad: 1–9 then erase.
for (let n = 1; n <= 9; n++) {
  const btn = document.createElement("button");
  btn.className = "pad-btn";
  btn.textContent = String(n);
  btn.addEventListener("click", () => inputNumber(n));
  padEl.appendChild(btn);
}
const eraseBtn = document.createElement("button");
eraseBtn.className = "pad-btn erase";
eraseBtn.textContent = "⌫";
eraseBtn.setAttribute("aria-label", "Erase");
eraseBtn.addEventListener("click", () => inputNumber(0));
padEl.appendChild(eraseBtn);

function selectCell(i: number): void {
  selected = i;
  render();
}

function inputNumber(n: number): void {
  if (solved || selected < 0 || game.given[selected]) return;
  if (n === 0) game.clearCell(selected);
  else game.setCell(selected, n);
  if (game.isSolved()) {
    solved = true;
    stopTimer();
  }
  render();
}

function render(): void {
  const conflicts = game.conflicts();
  const selVal = selected >= 0 ? game.cells[selected] : 0;
  const selR = selected >= 0 ? Math.floor(selected / 9) : -1;
  const selC = selected >= 0 ? selected % 9 : -1;
  const selBox = selected >= 0 ? Math.floor(selR / 3) * 3 + Math.floor(selC / 3) : -2;

  for (let i = 0; i < 81; i++) {
    const el = cellEls[i];
    const v = game.cells[i];
    el.textContent = v === 0 ? "" : String(v);
    const r = Math.floor(i / 9);
    const c = i % 9;
    const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    el.classList.toggle("given", game.given[i]);
    el.classList.toggle("conflict", conflicts[i]);
    el.classList.toggle("selected", i === selected);
    el.classList.toggle("peer", selected >= 0 && i !== selected && (r === selR || c === selC || box === selBox));
    el.classList.toggle("same", selVal !== 0 && v === selVal && i !== selected);
    el.classList.toggle("done", solved);
  }

  statusEl.textContent = solved ? "Solved! 🎉" : `${game.filledCount()} / 81`;
  statusEl.classList.toggle("win", solved);
  updateHintBar();
}

// ---- AI hint ---------------------------------------------------------------

/** Let the user drag an element around; its position persists in localStorage. */
function makeDraggable(el: HTMLElement, storageKey: string): void {
  const place = (x: number, y: number): void => {
    const w = el.offsetWidth || 220;
    const h = el.offsetHeight || 40;
    const cx = Math.max(4, Math.min(window.innerWidth - w - 4, x));
    const cy = Math.max(4, Math.min(window.innerHeight - h - 4, y));
    el.style.position = "fixed";
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.style.right = "auto";
    el.style.margin = "0";
    el.style.zIndex = "30";
  };
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const p = JSON.parse(saved) as { x: number; y: number };
      place(p.x, p.y);
    } catch {
      /* ignore a malformed saved position */
    }
  }
  let dragging = false;
  let dx = 0;
  let dy = 0;
  el.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".hint-bar-text")) return; // keep the text selectable
    const r = el.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (dragging) place(e.clientX - dx, e.clientY - dy);
  });
  const end = (): void => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("dragging");
    const r = el.getBoundingClientRect();
    localStorage.setItem(storageKey, JSON.stringify({ x: r.left, y: r.top }));
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  // Double-click to snap it back to its default spot above the board.
  el.addEventListener("dblclick", () => {
    localStorage.removeItem(storageKey);
    el.style.cssText = "";
  });
}

function setHint(text: string, loading = false, muted = false): void {
  hintText.textContent = text;
  hintText.classList.toggle("loading", loading);
  hintText.classList.toggle("muted", muted);
}

/**
 * Keep the above-board hint bar in sync with the puzzle. When on, it explains
 * the next logical step, updated whenever that step changes. Results are cached
 * per step, fetches are debounced against fast typing, and stale replies drop.
 */
function updateHintBar(): void {
  document.body.classList.toggle("hints-on", hintsEnabled);
  hintBar.hidden = !hintsEnabled;
  if (!hintsEnabled) {
    hintKey = "";
    return;
  }
  if (solved) {
    hintKey = "solved";
    window.clearTimeout(hintDebounce);
    setHint("Solved! 🎉", false, true);
    return;
  }
  const h = game.hint();
  if (!h) {
    hintKey = "none";
    setHint("—", false, true);
    return;
  }
  const key = `${h.index}:${h.value}:${h.technique}`;
  if (key === hintKey) return; // recommended step unchanged — keep showing it
  hintKey = key;
  const cached = hintCache.get(key);
  if (cached !== undefined) {
    window.clearTimeout(hintDebounce);
    setHint(cached);
    return;
  }
  setHint("Thinking…", true);
  const payload = { cells: game.cells.slice(), index: h.index, value: h.value, technique: h.technique };
  window.clearTimeout(hintDebounce);
  hintDebounce = window.setTimeout(() => {
    fetchSudokuHint(payload)
      .then((text) => {
        hintCache.set(key, text);
        if (hintKey === key) setHint(text);
      })
      .catch(() => {
        if (hintKey === key) setHint("Couldn't fetch a hint — check the connection.", false, true);
      });
  }, 350);
}

// ---- Timer -----------------------------------------------------------------

function updateTimer(): void {
  const secs = Math.floor((performance.now() - startTime) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer(): void {
  stopTimer();
  startTime = performance.now();
  updateTimer();
  timerId = window.setInterval(updateTimer, 1000);
}

function stopTimer(): void {
  if (timerId !== undefined) {
    window.clearInterval(timerId);
    timerId = undefined;
  }
}

function newGame(): void {
  game.newGame();
  selected = -1;
  solved = false;
  startTimer();
  render();
}

// ---- Input -----------------------------------------------------------------

window.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "9") {
    inputNumber(Number(e.key));
    e.preventDefault();
  } else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
    inputNumber(0);
    e.preventDefault();
  } else if (e.key.startsWith("Arrow") && selected >= 0) {
    let r = Math.floor(selected / 9);
    let c = selected % 9;
    if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "ArrowDown") r = Math.min(8, r + 1);
    else if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
    else if (e.key === "ArrowRight") c = Math.min(8, c + 1);
    selectCell(r * 9 + c);
    e.preventDefault();
  }
});

const diffSeg = document.getElementById("difficulty") as HTMLElement;
diffSeg.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn || !diffSeg.contains(btn)) return;
  for (const child of Array.from(diffSeg.children)) child.classList.toggle("active", child === btn);
  game.setDifficulty(btn.dataset.diff as Difficulty);
  newGame();
  (document.activeElement as HTMLElement | null)?.blur();
});

document.getElementById("btn-new")?.addEventListener("click", () => {
  newGame();
  (document.activeElement as HTMLElement | null)?.blur();
});

const hintsSeg = document.getElementById("hints") as HTMLElement;
hintsSeg.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn || !hintsSeg.contains(btn)) return;
  for (const child of Array.from(hintsSeg.children)) child.classList.toggle("active", child === btn);
  hintsEnabled = btn.dataset.hints === "on";
  localStorage.setItem("sudoku:hints", hintsEnabled ? "on" : "off");
  updateHintBar();
  (document.activeElement as HTMLElement | null)?.blur();
});

// Reflect the persisted hints toggle in its segmented control on load.
for (const child of Array.from(hintsSeg.children)) {
  const el = child as HTMLElement;
  el.classList.toggle("active", el.dataset.hints === (hintsEnabled ? "on" : "off"));
}

newGame();
