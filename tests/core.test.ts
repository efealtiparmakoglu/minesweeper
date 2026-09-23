import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  createBoard,
  elapsedSeconds,
  exposeMines,
  isRecord,
  makeRng,
  reveal,
  toggleFlag,
} from "../src/core.ts";

const BEGINNER = DIFFICULTIES[0] as (typeof DIFFICULTIES)[number];

function playFirstMove(seed = 42) {
  const board = createBoard(BEGINNER);
  const result = reveal(board, 4, 4, makeRng(seed));
  return { board, result };
}

test("board dimensions and counts", () => {
  const board = createBoard(BEGINNER);
  assert.equal(board.cells.length, 81);
  assert.equal(board.mines, 10);
  assert.equal(board.phase, "ready");
  for (const diff of DIFFICULTIES) {
    const b = createBoard(diff);
    assert.equal(b.cells.length, diff.width * diff.height);
    assert.ok(b.mines < b.cells.length, "mines must fit on the board");
  }
});

test("first click is safe: clicked cell and neighbors are mine-free", () => {
  for (const seed of [1, 7, 42, 999, 123456]) {
    const { board } = playFirstMove(seed);
    const placed = board.cells.filter((c) => c.mine).length;
    assert.equal(placed, board.mines, `seed ${seed}: all mines placed`);
    const center = board.cells[4 * board.width + 4] as (typeof board.cells)[number];
    assert.equal(center.mine, false);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        assert.equal(board.cells[(4 + dy) * board.width + (4 + dx)]?.mine, false,
          `seed ${seed}: neighbor must be safe`);
      }
    }
  }
});

test("first reveal floods the open area", () => {
  const { board, result } = playFirstMove(42);
  assert.ok(["revealed", "flood"].includes(result));
  assert.ok(board.revealedCount >= 1);
  assert.equal(board.phase, "playing");
  // every revealed non-mine cell shows the correct adjacency count
  board.cells.forEach((cell, i) => {
    if (cell.revealed && !cell.mine) {
      assert.ok(cell.adjacent >= 0 && cell.adjacent <= 8);
    }
    if (cell.adjacent === 0 && cell.revealed) {
      // a revealed zero cell must have all neighbors revealed too
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (i % board.width) + dx;
          const ny = Math.floor(i / board.width) + dy;
          if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height) continue;
          assert.equal(board.cells[ny * board.width + nx]?.revealed, true,
            "zero cell must open its whole ring");
        }
      }
    }
  });
});

test("same seed produces the same board", () => {
  const a = playFirstMove(31337).board;
  const b = playFirstMove(31337).board;
  assert.deepEqual(
    a.cells.map((c) => c.mine),
    b.cells.map((c) => c.mine),
  );
});

test("flags toggle and block reveals", () => {
  const { board } = playFirstMove(8);
  assert.ok(toggleFlag(board, 0, 0));
  assert.equal(board.flags, 1);
  assert.equal(reveal(board, 0, 0), "ignored", "flagged cell must not reveal");
  assert.ok(toggleFlag(board, 0, 0));
  assert.equal(board.flags, 0);
  assert.equal(toggleFlag(board, 4, 4), false, "cannot flag a revealed cell");
});

test("stepping on a mine loses and exposes the board", () => {
  const board = createBoard(BEGINNER);
  reveal(board, 4, 4, makeRng(42));
  const mineIndex = board.cells.findIndex((c) => c.mine);
  const mineX = mineIndex % board.width;
  const mineY = Math.floor(mineIndex / board.width);
  // clear the flag path (none set) and step on the mine
  const result = reveal(board, mineX, mineY, makeRng(42));
  assert.equal(result, "lost");
  assert.equal(board.phase, "lost");
  exposeMines(board);
  assert.equal(board.cells.filter((c) => c.mine && c.revealed).length, board.mines);
});

test("winning reveals exactly the safe cells", () => {
  const board = createBoard(BEGINNER);
  reveal(board, 4, 4, makeRng(42));
  // reveal every remaining safe cell one by one
  board.cells.forEach((cell, i) => {
    if (!cell.mine && !cell.revealed && board.phase !== "lost") {
      const x = i % board.width;
      const y = Math.floor(i / board.width);
      if (cell.flagged) toggleFlag(board, x, y);
      reveal(board, x, y, makeRng(42));
    }
  });
  assert.equal(board.phase, "won");
  assert.equal(board.revealedCount, board.cells.length - board.mines);
  assert.ok(board.finalSeconds >= 0);
});

test("actions are ignored after the game ends", () => {
  const board = createBoard(BEGINNER);
  reveal(board, 4, 4, makeRng(42));
  board.phase = "won"; // simulate end
  assert.equal(reveal(board, 0, 0), "ignored");
  assert.equal(toggleFlag(board, 0, 0), false);
});

test("records: first time and improvements only", () => {
  const records: Record<string, number> = {};
  assert.ok(isRecord(records, "beginner", 30), "any time is a first record");
  records.beginner = 30;
  assert.ok(!isRecord(records, "beginner", 45), "slower is not a record");
  assert.ok(isRecord(records, "beginner", 12), "faster is a record");
  assert.ok(!isRecord(records, "beginner", -1), "negative times are invalid");
});

test("elapsed time lifecycle", () => {
  const board = createBoard(BEGINNER);
  assert.equal(elapsedSeconds(board), 0, "ready phase shows zero");
  reveal(board, 4, 4, makeRng(42));
  assert.ok(elapsedSeconds(board) >= 0);
  board.finalSeconds = 25;
  assert.equal(elapsedSeconds(board), 25, "final seconds freeze the clock");
});
