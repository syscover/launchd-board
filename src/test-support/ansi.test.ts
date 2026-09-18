import assert from 'node:assert/strict';
import { test } from 'node:test';

import { foregroundAnsi, INVERSE_END, INVERSE_START, stripAnsi } from './ansi.js';

test('stripAnsi removes a truecolor foreground sequence and its reset', () => {
  const styled = '\x1b[38;2;209;154;102mamber\x1b[39m';
  assert.equal(stripAnsi(styled), 'amber');
});

test('stripAnsi removes an inverse start/end pair', () => {
  const styled = `${INVERSE_START}selected row${INVERSE_END}`;
  assert.equal(stripAnsi(styled), 'selected row');
});

test('stripAnsi leaves plain text with no escape sequences unchanged', () => {
  assert.equal(stripAnsi('plain text'), 'plain text');
});

test('stripAnsi removes several sequences in the same string', () => {
  const styled = '\x1b[1m\x1b[38;2;255;255;255mLABEL\x1b[39m\x1b[22m rest';
  assert.equal(stripAnsi(styled), 'LABEL rest');
});

test('foregroundAnsi builds the exact truecolor SGR sequence chalk emits for a hex color', () => {
  // #d19a66 (amber) = 209,154,102 — verified against a real chalk/Ink render
  // under FORCE_COLOR=3.
  assert.equal(foregroundAnsi(209, 154, 102), '\x1b[38;2;209;154;102m');
});
