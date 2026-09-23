/* DOM layer: renders the board, wires clicks (left = reveal, right = flag),
 * flag-mode toggle, difficulty switch, timer and localStorage records.
 * Built into the single-file dist/index.html by build.ts. */

import {
  DIFFICULTIES,
  createBoard,
  exposeMines,
  isRecord,
  makeRng,
  reveal,
  toggleFlag,
  type Board,
  type Difficulty,
} from "./core.ts";

const STORAGE_KEY = "minesweeper-records";

function loadRecords(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveRecord(diffName: string, seconds: number): void {
  const records = loadRecords();
  if (isRecord(records, diffName, seconds)) {
    records[diffName] = seconds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  renderRecords(diffName);
}

function renderRecords(active: string): void {
  const records = loadRecords();
  const list = document.getElementById("records") as HTMLElement;
  list.innerHTML = "";
  for (const diff of DIFFICULTIES) {
    const li = document.createElement("li");
    const best = records[diff.name];
    li.textContent =
      `${diff.name}: ${best === undefined ? "—" : best + "s"}${diff.name === active ? " ◀" : ""}`;
    list.appendChild(li);
  }
}

let current: Board;
let currentDiff: Difficulty = DIFFICULTIES[0] as Difficulty;
let flagMode = false;
let seedInput: number | null = null;

function buildBoard(): void {
  current = createBoard(currentDiff);
  const boardEl = document.getElementById("board") as HTMLElement;
  boardEl.style.gridTemplateColumns = `repeat(${currentDiff.width}, 26px)`;
  boardEl.innerHTML = "";
  for (let y = 0; y < currentDiff.height; y++) {
    for (let x = 0; x < currentDiff.width; x++) {
      const cellEl = document.createElement("button");
      cellEl.className = "cell";
      cellEl.dataset.x = String(x);
      cellEl.dataset.y = String(y);
      cellEl.addEventListener("click", () => onCell(x, y, false));
      cellEl.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        onCell(x, y, true);
      });
      boardEl.appendChild(cellEl);
    }
  }
  updateStatus();
  renderRecords(currentDiff.name);
}

function onCell(x: number, y: number, rightClick: boolean): void {
  if (flagMode || rightClick) {
    toggleFlag(current, x, y);
  } else {
    const rng = makeRng(seedInput ?? (Date.now() & 0x7fffffff));
    const result = reveal(current, x, y, rng);
    if (result === "lost") exposeMines(current);
    if (result === "won") {
      const seconds = current.finalSeconds;
      if (isRecord(loadRecords(), currentDiff.name, seconds)) {
        saveRecord(currentDiff.name, seconds);
      }
    }
  }
  paint();
}

function paint(): void {
  const cells = document.querySelectorAll<HTMLButtonElement>("#board .cell");
  cells.forEach((cellEl) => {
    const x = Number(cellEl.dataset.x);
    const y = Number(cellEl.dataset.y);
    const cell = current.cells[y * current.width + x]!;
    let text = "";
    if (cell.revealed) {
      if (cell.mine) {
        text = "✸";
        cellEl.classList.add("mine");
      } else if (cell.adjacent > 0) {
        text = String(cell.adjacent);
        cellEl.classList.add(`n${cell.adjacent}`);
      } else {
        cellEl.classList.add("empty");
      }
    } else if (cell.flagged) {
      text = "⚑";
      cellEl.classList.add("flag");
    }
    cellEl.textContent = text;
  });
  updateStatus();
}

function updateStatus(): void {
  const status = document.getElementById("status") as HTMLElement;
  const minesLeft = current.mines - current.flags;
  const seconds = current.phase === "ready" ? 0 : elapsedOf(current);
  status.textContent =
    `mines: ${minesLeft}   time: ${seconds}s   phase: ${current.phase}` +
    (flagMode ? "   [FLAG MODE]" : "");
}

function elapsedOf(board: Board): number {
  if (board.phase === "ready") return 0;
  if (board.finalSeconds >= 0) return board.finalSeconds;
  return Math.floor((Date.now() - board.startedAt) / 1000);
}

function setup(): void {
  const diffSelect = document.getElementById("difficulty") as HTMLSelectElement;
  for (const diff of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = diff.name;
    option.textContent = `${diff.name} (${diff.width}×${diff.height}, ${diff.mines} mines)`;
    diffSelect.appendChild(option);
  }
  diffSelect.addEventListener("change", () => {
    currentDiff = DIFFICULTIES.find((d) => d.name === diffSelect.value) as Difficulty;
    buildBoard();
  });

  const flagToggle = document.getElementById("flag-mode") as HTMLButtonElement;
  flagToggle.addEventListener("click", () => {
    flagMode = !flagMode;
    flagToggle.classList.toggle("active", flagMode);
    updateStatus();
  });

  const seedField = document.getElementById("seed") as HTMLInputElement;
  document.getElementById("new-game")?.addEventListener("click", () => {
    seedInput = seedField.value.trim() === "" ? null : Number(seedField.value);
    buildBoard();
  });

  document.getElementById("clear-records")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderRecords(currentDiff.name);
  });

  buildBoard();
}

if (typeof document !== "undefined" && document.getElementById("board")) {
  setup();
}
