#!/usr/bin/env node
/**
 * Entry point. The only place that wires the real CommandRunner to the UI —
 * every other module in this project receives its dependencies as
 * parameters and creates nothing itself.
 *
 * --help/-h and an unrecognized flag are resolved and exited on BEFORE Ink
 * ever mounts: Ink needs raw-mode stdin, which throws when stdout is not a
 * real TTY (piped, redirected, or invoked from a script) — a globally
 * installed command must not crash on `launchd-board --help | cat`.
 */

import { render } from 'ink';
import process from 'node:process';
import React from 'react';

import { CLI_COMMAND, parseCliArgs, USAGE_TEXT } from './cli.js';
import { runCommand } from './launchd/exec.js';
import { listJobs } from './launchd/jobs.js';
import { App } from './ui/App.js';

const parsed = parseCliArgs(process.argv.slice(2));

if (parsed.command === CLI_COMMAND.HELP) {
  process.stdout.write(USAGE_TEXT);
  process.exit(0);
}

if (parsed.command === CLI_COMMAND.ERROR) {
  process.stderr.write(`Unrecognized option: ${parsed.unrecognizedArg}\n\n`);
  process.stderr.write(USAGE_TEXT);
  process.exit(1);
}

const jobs = listJobs(runCommand, { includeSystem: parsed.includeSystem });
const terminalWidth = process.stdout.columns ?? 80;

render(<App jobs={jobs} includeSystem={parsed.includeSystem} terminalWidth={terminalWidth} />);
