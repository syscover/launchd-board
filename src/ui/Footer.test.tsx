import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { stripAnsi } from '../test-support/ansi.js';
import { Footer } from './Footer.js';

test('Footer renders exactly the key-hint bar, only bindings that actually work', () => {
  const { lastFrame } = render(<Footer showHelp={false} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.equal(frame, '[↑↓] Nav | [a] Scope | [?] Help | [q] Quit');
});

test('Footer shows no expanded help line when showHelp is false', () => {
  const { lastFrame } = render(<Footer showHelp={false} />);
  const frame = lastFrame() ?? '';
  assert.equal(frame.split('\n').length, 1);
});

test('Footer shows an expanded help line when showHelp is true', () => {
  const { lastFrame } = render(<Footer showHelp />);
  const frame = lastFrame() ?? '';
  const lines = frame.split('\n');
  assert.equal(lines.length, 2);
  assert.match(stripAnsi(lines[1] ?? ''), /scope/i);
});
