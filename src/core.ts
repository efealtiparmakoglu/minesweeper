/* Pure game logic: board state, first-click-safe mine placement,
 * flood-fill reveal, flag mode and win/lose detection. No DOM here —
 * everything is testable in Node. */

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number; // mines among neighbors (computed after placement)
}

export interface Difficulty {
  name: string;
  width: number;
  height: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { name: "beginner", width: 9, height: 9, mines: 10 },
  { name: "intermediate", width: 16, height: 16, mines: 40 },
  { name: "expert", width: 30, height: 16, mines: 99 },
];

export type Phase = "ready" | "playing" | "won" | "lost";

export interface Board {
  width: number;
  height: number;
  mines: number;
  cells: Cell[]; // row-major, index = y * width + x
  phase: Phase;
  flags: number;
  revealedCount: number;
  /** ms timestamp of the first reveal; 0 until the game starts */
  startedAt: number;
  /** seconds on the clock when the game ended; -1 while running */
  finalSeconds: number;
}

export function createBoard(diff: Difficulty): Board {
  return {
    width: diff.width,
    height: diff.height,
    mines: diff.mines,
    cells: diff.width * diff.height > 0
      ? Array.from({ length: diff.width * diff.height }, () => ({
          mine: false,
          revealed: false,
          flagged: false,
          adjacent: 0,
        }))
      : [],
    phase: "ready",
    flags: 0,
    revealedCount: 0,
    startedAt: 0,
    finalSeconds: -1,
  };
}

export function index(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

export function neighbors(board: Board, x: number, y: number): number[] {
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < board.width && ny < board.height) {
        out.push(index(board, nx, ny));
      }
    }
  }
  return out;
}

/** Deterministic PRNG so tests (and replay-by-seed) are stable. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/**
 * Place mines AFTER the first reveal: the clicked cell and all of its
 * neighbors are guaranteed mine-free, so every game opens with progress.
 */
function placeMines(board: Board, safeIndex: number, rng: () => number): void {
  const forbidden = new Set<number>([safeIndex, ...neighborsOf(board, safeIndex)]);
  const candidates: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  // Fisher-Yates shuffle the tail, take the first `mines`
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }
  for (let i = 0; i < board.mines && i < candidates.length; i++) {
    board.cells[candidates[i] as number].mine = true;
  }
  for (let i = 0; i < board.cells.length; i++) {
    const { x, y } = xy(board, i);
    board.cells[i].adjacent = neighborsOf(board, index(board, x, y)).filter(
      (n) => board.cells[n]?.mine,
    ).length;
  }
}

function neighborsOf(board: Board, i: number): number[] {
  return neighbors(board, i % board.width, Math.floor(i / board.width));
}

function xy(board: Board, i: number): { x: number; y: number } {
  return { x: i % board.width, y: Math.floor(i / board.width) };
}

export type RevealResult = "revealed" | "flood" | "ignored" | "lost" | "won";

/** Reveal a cell. First reveal places mines (first-click safety). */
export function reveal(
  board: Board,
  x: number,
  y: number,
  rng: () => number = makeRng(1),
): RevealResult {
  if (board.phase === "won" || board.phase === "lost") return "ignored";
  const i = index(board, x, y);
  const cell = board.cells[i];
  if (!cell || cell.flagged || cell.revealed) return "ignored";

  if (board.phase === "ready") {
    placeMines(board, i, rng);
    board.phase = "playing";
    board.startedAt = Date.now();
  }

  if (cell.mine) {
    cell.revealed = true;
    board.phase = "lost";
    board.finalSeconds = elapsedSeconds(board);
    return "lost";
  }

  // flood fill: reveal this cell and every connected zero-adjacent region
  const stack = [i];
  while (stack.length > 0) {
    const current = stack.pop() as number;
    const c = board.cells[current] as Cell;
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    board.revealedCount++;
    if (c.adjacent === 0) {
      for (const n of neighborsOf(board, current)) {
        const nc = board.cells[n] as Cell;
        if (!nc.revealed && !nc.flagged && !nc.mine) stack.push(n);
      }
    }
  }

  const safeTotal = board.cells.length - board.mines;
  if (board.revealedCount === safeTotal) {
    board.phase = "won";
    board.finalSeconds = elapsedSeconds(board);
    return "won";
  }
  return "flood";
}

/** Flag mode toggle; flags only exist before the game ends. */
export function toggleFlag(board: Board, x: number, y: number): boolean {
  if (board.phase === "won" || board.phase === "lost") return false;
  const cell = board.cells[index(board, x, y)];
  if (!cell || cell.revealed) return false;
  cell.flagged = !cell.flagged;
  board.flags += cell.flagged ? 1 : -1;
  return true;
}

export function elapsedSeconds(board: Board): number {
  if (board.phase === "ready") return 0;
  if (board.finalSeconds >= 0) return board.finalSeconds;
  return Math.floor((Date.now() - board.startedAt) / 1000);
}

/** Records are per difficulty: name -> best seconds. Pure helper. */
export function isRecord(records: Record<string, number>, diff: string, seconds: number): boolean {
  const best = records[diff];
  return seconds >= 0 && (best === undefined || seconds < best);
}

/** Reveal all mines after a loss so the player sees the full board. */
export function exposeMines(board: Board): void {
  for (const cell of board.cells) {
    if (cell.mine) cell.revealed = true;
  }
}
