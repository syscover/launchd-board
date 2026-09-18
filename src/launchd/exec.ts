/**
 * The ONLY module in this project that shells out. Everything else — parse.ts,
 * jobs.ts, the UI — receives a `CommandRunner` and never imports
 * `node:child_process` directly. That is what makes parse.ts and jobs.ts
 * testable without a real launchd on the test machine.
 *
 * This module is intentionally untested: it is a thin, branch-free adapter
 * over `execFileSync`. There is no logic here to break — the logic lives in
 * parse.ts, which IS tested against real captured output.
 */

import { execFileSync } from 'node:child_process';

/** Runs a command and returns its stdout as a string. Throws on non-zero exit. */
export type CommandRunner = (argv: readonly string[]) => string;

export const runCommand: CommandRunner = (argv) => {
  const [command, ...args] = argv;
  if (command === undefined) {
    throw new Error('runCommand requires a non-empty argv (command name missing)');
  }
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
};
