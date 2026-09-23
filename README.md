# minesweeper

Single-file **offline** Minesweeper — first-click-safe boards, flag
mode, per-difficulty best-time records in localStorage. Zero npm
dependencies; the single-file build uses Node's native TypeScript
stripping.

```text
$ npm test          # 10 core tests (Node)
$ npm run build     # -> dist/index.html (13 KB, open in any browser)
```

## The game

- **First click is always safe** — mines are placed after the first
  reveal; the clicked cell and its entire ring of neighbors are
  guaranteed mine-free, so every game opens with progress. Boards are
  seedable (`makeRng`, xorshift) and reproducible.
- **Flood fill** — revealing a zero-adjacency cell opens its whole
  connected region; revealed zero cells always show a fully-opened ring.
- **Flag mode** — a toggle button plus right-click; flags block reveals
  and count down the mine counter.
- **Best times** — per difficulty (beginner 9×9/10, intermediate 16×16/40,
  expert 30×16/99), stored in localStorage, only improvements stick.
- **Lost games expose the board**; timers freeze at the final second.

## Single-file build

`build.ts` reads `src/core.ts` and `src/ui.ts`, strips the types with
Node's built-in `stripTypeScriptTypes` (no tsc, no bundler), inlines
both into `index.template.html` and writes `dist/index.html`. The
script runs as an ES module; everything works from `file://` with no
network access. The core (`src/core.ts`) is pure logic with no DOM, so
the whole game is unit-tested in Node — placement safety across seeds,
flood-fill ring closure, flag blocking, win/lose transitions, record
semantics and the elapsed-time lifecycle.

## Development

```console
$ npm test                 # core logic
$ npm run build            # regenerate dist/index.html
```

Open `dist/index.html` and play — works offline forever.

## License

MIT — see [LICENSE](LICENSE).
