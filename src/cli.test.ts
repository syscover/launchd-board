import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLI_COMMAND, parseCliArgs, USAGE_TEXT } from './cli.js';

test('parseCliArgs defaults to running with user-only scope', () => {
  assert.deepEqual(parseCliArgs([]), { command: CLI_COMMAND.RUN, includeSystem: false });
});

test('parseCliArgs widens scope on --all', () => {
  assert.deepEqual(parseCliArgs(['--all']), { command: CLI_COMMAND.RUN, includeSystem: true });
});

test('parseCliArgs widens scope on --system', () => {
  assert.deepEqual(parseCliArgs(['--system']), { command: CLI_COMMAND.RUN, includeSystem: true });
});

test('parseCliArgs recognizes --help', () => {
  assert.deepEqual(parseCliArgs(['--help']), { command: CLI_COMMAND.HELP });
});

test('parseCliArgs recognizes -h', () => {
  assert.deepEqual(parseCliArgs(['-h']), { command: CLI_COMMAND.HELP });
});

test('parseCliArgs treats help as taking precedence over an otherwise-unrecognized flag', () => {
  assert.deepEqual(parseCliArgs(['--bogus', '--help']), { command: CLI_COMMAND.HELP });
});

test('parseCliArgs reports the first unrecognized flag as an error', () => {
  assert.deepEqual(parseCliArgs(['--verbose']), { command: CLI_COMMAND.ERROR, unrecognizedArg: '--verbose' });
});

test('parseCliArgs reports an error even when a recognized flag is also present', () => {
  assert.deepEqual(parseCliArgs(['--all', '--bogus']), { command: CLI_COMMAND.ERROR, unrecognizedArg: '--bogus' });
});

test('USAGE_TEXT documents every recognized flag', () => {
  assert.match(USAGE_TEXT, /--all/);
  assert.match(USAGE_TEXT, /--system/);
  assert.match(USAGE_TEXT, /--help/);
  assert.match(USAGE_TEXT, /-h\b/);
});
