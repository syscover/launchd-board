/**
 * Pure CLI argument parsing, kept out of index.tsx so it is testable without
 * spawning the Ink app. `--help`/`-h` and an unrecognized flag must both be
 * resolvable WITHOUT mounting Ink — a globally installed command that always
 * boots a raw-mode TUI crashes with "Raw mode is not supported" whenever
 * stdout is not a real TTY (piped, redirected, or run from a script).
 */

export const CLI_COMMAND = {
  RUN: 'run',
  HELP: 'help',
  ERROR: 'error',
} as const;

export type CliCommand = (typeof CLI_COMMAND)[keyof typeof CLI_COMMAND];

export type CliParseResult =
  | { readonly command: typeof CLI_COMMAND.RUN; readonly includeSystem: boolean }
  | { readonly command: typeof CLI_COMMAND.HELP }
  | { readonly command: typeof CLI_COMMAND.ERROR; readonly unrecognizedArg: string };

const SYSTEM_SCOPE_FLAGS = new Set(['--all', '--system']);
const HELP_FLAGS = new Set(['--help', '-h']);

export const USAGE_TEXT = `Usage: launchd-board [options]

Show the real state of macOS launchd jobs (read-only; no write actions).

Options:
  --all, --system   Also scan /Library/LaunchAgents and /Library/LaunchDaemons
                    (default: only ~/Library/LaunchAgents)
  -h, --help        Show this help and exit

Inside the app:
  Up / Down arrows  Move the selection
  a                 Cycle the panel's scope (user / system / daemon)
  ?                 Toggle an expanded key-hint line
  q                 Quit
`;

/**
 * Help wins over an unrecognized flag — `launchd-board --bogus --help`
 * should still show help, not an error, since help is always safe.
 */
export function parseCliArgs(argv: readonly string[]): CliParseResult {
  if (argv.some((arg) => HELP_FLAGS.has(arg))) {
    return { command: CLI_COMMAND.HELP };
  }

  for (const arg of argv) {
    if (!SYSTEM_SCOPE_FLAGS.has(arg)) {
      return { command: CLI_COMMAND.ERROR, unrecognizedArg: arg };
    }
  }

  return { command: CLI_COMMAND.RUN, includeSystem: argv.some((arg) => SYSTEM_SCOPE_FLAGS.has(arg)) };
}
