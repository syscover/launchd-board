# launchd-board

A read-only terminal UI (TUI) that shows the real state of macOS `launchd` jobs.

## The problem

`launchd` state has **three independent dimensions**, and no single command shows
all three at once:

| Dimension  | Meaning                                          | Source                              |
| ---------- | ------------------------------------------------- | ------------------------------------ |
| `loaded`   | launchd knows about the job in this boot          | `launchctl list`                     |
| `disabled` | persists across reboots, lives outside the plist  | `launchctl print-disabled gui/<uid>` |
| `running`  | a process exists right now                        | the PID column of `launchctl list`   |

A job can be present as a `.plist` file, **not loaded**, and **also disabled** — three
independent reasons it will not run. A tool that only reads the `.plist` file lies to
you about the other two. `launchd-board` reads all three sources and renders them
side by side, so each dimension is visible on its own.

It also classifies **how** each job fires (`StartInterval`, `StartCalendarInterval`,
`KeepAlive`, `WatchPaths`, `QueueDirectories`, `RunAtLoad`, or `on-demand` when none
of those apply) — a job can have several triggers at once.

## v1 is read-only

This tool only reads and displays state. It does **not** stop, start, disable,
enable, load, unload, or edit any job or plist — not even behind a flag. It cannot
break your machine.

## Install (local, global command)

```
pnpm install
pnpm build
npm link
```

This compiles TypeScript to `dist/` and registers the `launchd-board` command
globally (via npm's link mechanism, which pnpm's global bin directory also shares).
Run it from anywhere:

```
launchd-board
```

> `pnpm link --global` was tried first, per the usual pnpm convention. On the pnpm
> version this project was verified against (11.24), `pnpm link <dir>` no longer
> self-registers the current package — it links a directory in as a *dependency* of
> whatever project you run it from, which is not what a global CLI install needs.
> `npm link` does the traditional global-bin registration and was verified to work:
> the compiled binary was resolved and executed from a directory outside this repo.

To remove the global command later: `npm unlink -g launchd-board`.

## Usage

```
launchd-board          # your own agents only: ~/Library/LaunchAgents
launchd-board --all     # also fetch /Library/LaunchAgents and /Library/LaunchDaemons
launchd-board --system  # same as --all
launchd-board --help    # usage, exits immediately — never mounts the TUI
```

The listing defaults to your own agents because that is the set you actually manage
day to day. Widening the fetch requires root-owned files that are not always
readable by your user — a plist `launchd-board` cannot read (e.g. a permission-denied
system daemon) is skipped rather than crashing the whole list. An unrecognized flag
prints usage and exits non-zero, same as `--help` does but exiting 0 — neither ever
starts Ink, so both work even when stdout is not a real TTY (piped, redirected, or
called from a script).

Inside the app:

- `↑` / `↓` move the selection.
- `a` cycles which single domain the panel shows: user agents → system agents →
  daemons → back to user agents. (This filters what was already fetched — pass
  `--all` at launch to have anything to see once you cycle past user agents.)
- `?` toggles an expanded one-line reminder of these bindings.
- `q` quits.

The layout is a framed board: a top bar (scope fetched + global counts across
every fetched job), a single titled panel below it (`○ User agents (N)` / `◐ System
agents (N)` / `● Daemons (N)`, glyph and count reflecting whichever domain `a` has
selected), and a dim key-hint footer. The domain is a panel SCOPE, not one of
several side-by-side panels — a job is loaded, disabled, and running all at once,
so those three stay table columns; only the domain is mutually exclusive per job,
which is why it is the one dimension that becomes the panel's title instead of a
column. The selected row renders as a full-width inverse (reverse-video) bar rather
than a marker, so it stays findable at a glance in a long list. Labels truncate
(never wrap) to fit a narrow terminal, and the whole frame — top bar and panel
border alike — respects the terminal width, never overflowing horizontally.

The table is designed for a wide terminal: the four fixed data columns (domain,
trigger, loaded, running, disabled) need about 90 columns on their own, so a
terminal under roughly 100 columns wide leaves the label column at its
10-character floor — it still works, it just degrades by truncating the label
more aggressively. Widen the terminal to give labels more room.

## Development

```
pnpm dev              # run against the real data sources via tsx, no build needed
pnpm test             # node's built-in test runner, via tsx — no vitest/jest
pnpm build            # compile to dist/ (tsc), and chmod +x the entry point
```

## Architecture

Pure logic is separated from I/O so tests need no real `launchd`:

- `src/launchd/exec.ts` — the only module that shells out (`launchctl`, `plutil`).
  Exposes an injectable `CommandRunner` type plus the real implementation.
- `src/launchd/parse.ts` — pure functions. They take strings (real command output)
  and return typed records. No `child_process` import here, ever.
- `src/launchd/jobs.ts` — composes the three sources into one typed `Job[]`. Takes
  a `CommandRunner` as a parameter; never creates one itself.
- `src/ui/` — Ink (React for the terminal) components (`TopBar`, `JobsPanel`,
  `JobTable`, `Footer`). Presentational: they receive `Job[]` as props and render.
  No data fetching inside a component. `src/ui/format.ts` holds the pure
  display-formatting and layout-math helpers (column widths, row text, the
  hand-drawn panel border, scope cycling, selection-index clamping) — plain
  string/number functions with no Ink import, so they are unit-tested directly.
  `src/ui/palette.ts` holds the (muted, desaturated) color constants and the
  per-domain glyph/label pairs.
- `src/cli.ts` — pure CLI argument parsing (`--all`/`--system`/`--help`/`-h`, or an
  unrecognized flag) as a discriminated `{ command: 'run' | 'help' | 'error', ... }`
  result. No process exit and no Ink here either — just data in, data out.
- `src/index.tsx` — entry point. Resolves `--help`/an unrecognized flag and exits
  BEFORE ever mounting Ink (Ink's raw-mode stdin throws when stdout is not a real
  TTY), otherwise wires the real runner to the UI. The only place that does I/O,
  process exit, and rendering.

Test fixtures under `src/launchd/__fixtures__/` are verbatim output captured from a
real macOS machine (`launchctl list`, `launchctl print-disabled`, and `plutil`
JSON for real plists covering `StartInterval`, `KeepAlive`, `StartCalendarInterval`,
and a plist with no triggers and no `Label` key at all).
