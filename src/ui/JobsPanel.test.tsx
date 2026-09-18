import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job } from '../launchd/types.js';
import { foregroundAnsi, stripAnsi } from '../test-support/ansi.js';
import { renderPanelTopBorder } from './format.js';
import { JobsPanel } from './JobsPanel.js';

function makeJob(overrides: Partial<Job>): Job {
  return {
    label: 'com.example.job',
    domain: JOB_DOMAIN.USER,
    plistPath: '/Users/test/Library/LaunchAgents/com.example.job.plist',
    triggers: [TRIGGER_TYPE.ON_DEMAND],
    disabled: false,
    runtime: { loaded: false },
    ...overrides,
  };
}

test('JobsPanel draws a hand-drawn title with the scope glyph, name, and job count', () => {
  const jobs = [makeJob({ plistPath: '/a.plist' }), makeJob({ plistPath: '/b.plist' })];
  const { lastFrame } = render(
    <JobsPanel jobs={jobs} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={60} />,
  );
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /○ User agents \(2\)/);
});

test('JobsPanel updates the glyph and name for the system scope', () => {
  const { lastFrame } = render(<JobsPanel jobs={[]} scope={JOB_DOMAIN.SYSTEM} selectedIndex={0} terminalWidth={60} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /◐ System agents \(0\)/);
});

test('JobsPanel updates the glyph and name for the daemon scope', () => {
  const { lastFrame } = render(<JobsPanel jobs={[]} scope={JOB_DOMAIN.DAEMON} selectedIndex={0} terminalWidth={60} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /● Daemons \(0\)/);
});

test('JobsPanel draws its own top border matching renderPanelTopBorder exactly (once color is stripped)', () => {
  const { lastFrame } = render(<JobsPanel jobs={[]} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={60} />);
  const frame = lastFrame() ?? '';
  const expectedTopBorder = renderPanelTopBorder(60, 'User agents (0)', '○');
  const firstLine = stripAnsi(frame.split('\n')[0] ?? '');
  assert.equal(firstLine, expectedTopBorder);
});

test('JobsPanel wraps the table in a bordered box (bottom corners and side rails present)', () => {
  const jobs = [makeJob({})];
  const { lastFrame } = render(
    <JobsPanel jobs={jobs} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={60} />,
  );
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /╰/);
  assert.match(frame, /╯/);
  assert.match(frame, /│/);
});

test('JobsPanel renders the given jobs inside the panel', () => {
  const jobs = [makeJob({ label: 'com.example.visible-job' })];
  const { lastFrame } = render(
    <JobsPanel jobs={jobs} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={120} />,
  );
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /com\.example\.visible-job/);
});

test('JobsPanel never lets a bordered line exceed the requested terminal width (visible columns, ANSI excluded)', () => {
  const jobs = [makeJob({ label: 'com.example.a-fairly-long-label-for-this-test' })];
  const { lastFrame } = render(
    <JobsPanel jobs={jobs} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={30} />,
  );
  const frame = lastFrame() ?? '';
  const borderedLines = frame
    .split('\n')
    .filter((line) => line.includes('│') || line.includes('╭') || line.includes('╰'))
    .map((line) => stripAnsi(line));
  for (const line of borderedLines) {
    assert.ok(line.length <= 30, `line exceeded width 30: "${line}" (${line.length})`);
  }
});

// --- Styling: the focused panel's border is the spec's amber, in the raw (unstripped) frame ---

test('JobsPanel colors its (always-focused, in v1) border with the spec amber #d19a66', () => {
  const { lastFrame } = render(<JobsPanel jobs={[]} scope={JOB_DOMAIN.USER} selectedIndex={0} terminalWidth={60} />);
  const frame = lastFrame() ?? '';
  // #d19a66 = 209, 154, 102 — from the palette SPEC, not re-imported from palette.ts.
  const amber = foregroundAnsi(209, 154, 102);
  assert.ok(frame.includes(amber), `expected the amber SGR sequence ${JSON.stringify(amber)} in the raw frame`);
});
