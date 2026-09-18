import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job } from '../launchd/types.js';
import {
  columnWidthsFor,
  formatDisabledState,
  formatJobRow,
  formatLoadState,
  formatRunState,
  formatScopeLabel,
  formatTriggers,
  labelColumnWidth,
  nextDomain,
  renderPanelTopBorder,
  clampIndex,
  truncateLabel,
} from './format.js';

test('formatLoadState reports "not loaded" when the job is absent from launchctl list', () => {
  assert.equal(formatLoadState({ loaded: false }), 'not loaded');
});

test('formatLoadState reports "loaded" when present', () => {
  assert.equal(formatLoadState({ loaded: true, lastExitStatus: 0, process: { running: false } }), 'loaded');
});

test('formatRunState reports "-" when the job is not loaded at all', () => {
  assert.equal(formatRunState({ loaded: false }), '-');
});

test('formatRunState reports "stopped" when loaded but no process exists', () => {
  assert.equal(formatRunState({ loaded: true, lastExitStatus: 0, process: { running: false } }), 'stopped');
});

test('formatRunState reports "running" with the pid when a process exists', () => {
  assert.equal(
    formatRunState({ loaded: true, lastExitStatus: 0, process: { running: true, pid: 4242 } }),
    'running (4242)',
  );
});

test('formatDisabledState distinguishes disabled from enabled', () => {
  assert.equal(formatDisabledState(true), 'disabled');
  assert.equal(formatDisabledState(false), 'enabled');
});

test('formatTriggers joins multiple triggers with a comma', () => {
  assert.equal(
    formatTriggers([TRIGGER_TYPE.START_INTERVAL, TRIGGER_TYPE.RUN_AT_LOAD]),
    'start-interval, run-at-load',
  );
});

test('formatTriggers renders a single trigger with no separator', () => {
  assert.equal(formatTriggers([TRIGGER_TYPE.ON_DEMAND]), 'on-demand');
});

test('truncateLabel leaves a short label untouched', () => {
  assert.equal(truncateLabel('com.example.job', 40), 'com.example.job');
});

test('truncateLabel truncates a long label with an ellipsis, respecting maxWidth', () => {
  const result = truncateLabel('com.example.a-very-long-service-label-indeed', 20);
  assert.equal(result.length, 20);
  assert.ok(result.endsWith('…'));
  assert.ok('com.example.a-very-long-service-label-indeed'.startsWith(result.slice(0, -1)));
});

test('truncateLabel never wraps — it always returns a single line no wider than maxWidth', () => {
  const result = truncateLabel('x'.repeat(5), 3);
  assert.equal(result.length, 3);
});

// --- labelColumnWidth / columnWidthsFor ---------------------------------------

test('labelColumnWidth grows with the terminal and never drops below the minimum', () => {
  assert.equal(labelColumnWidth(160), 70);
  assert.equal(labelColumnWidth(10), 10); // clamped to MIN_LABEL_WIDTH
});

test('columnWidthsFor bundles the label width with the fixed column widths', () => {
  const widths = columnWidthsFor(160);
  assert.equal(widths.label, 70);
  assert.equal(widths.domain, 9);
  assert.equal(widths.trigger, 30);
  assert.equal(widths.loaded, 15);
  assert.equal(widths.running, 23);
  assert.equal(widths.disabled, 8);
});

test('labelColumnWidth pins the minimum usable width: the label floor does not budge until past 100 columns', () => {
  // Fixed columns (domain 9 + trigger 30 + loaded 15 + running 23 + disabled 8
  // = 85) plus 5 separators = 90. Because MIN_LABEL_WIDTH is itself 10, the
  // label column does not actually grow past that floor until
  // terminalWidth - 90 > 10, i.e. terminalWidth > 100. A reader should learn
  // that from this test, not by resizing a terminal — and it is exactly why
  // ink-testing-library's hardcoded 100-column render (see JobTable.test.tsx
  // and App.test.tsx) always shows a 10-character label column, no matter
  // what `terminalWidth` prop a component test passes.
  assert.equal(labelColumnWidth(90), 10);
  assert.equal(labelColumnWidth(100), 10);
  assert.equal(labelColumnWidth(101), 11);
});

// --- formatJobRow --------------------------------------------------------------

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

test('formatJobRow joins every column with a single space, each padded to its width', () => {
  const widths = { label: 12, domain: 6, trigger: 10, loaded: 10, running: 9, disabled: 8 };
  const job = makeJob({
    label: 'com.a',
    runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 99 } },
    disabled: true,
  });
  const row = formatJobRow(job, widths);
  const expected = [
    'com.a'.padEnd(12),
    'user'.padEnd(6),
    'on-demand'.padEnd(10),
    'loaded'.padEnd(10),
    'running (99)'.padEnd(9), // wider than the column — padEnd is a no-op here, not truncated
    'disabled',
  ].join(' ');
  assert.equal(row, expected);
});

test('formatJobRow places every column at its real character offset on a realistic wide terminal (160)', () => {
  // The rendering harness cannot exceed 100 columns (verified: ink-testing-
  // library hardcodes `Stdout.columns` to 100), so the WIDE layout — the
  // whole point of widening these columns — can only be verified here, at
  // the pure function, not through a rendered component.
  const widths = columnWidthsFor(160);
  const job = makeJob({
    label: 'com.example.wide-layout-job',
    domain: JOB_DOMAIN.SYSTEM,
    triggers: [TRIGGER_TYPE.KEEP_ALIVE],
    disabled: true,
    runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 321 } },
  });
  const row = formatJobRow(job, widths);
  assert.equal(row.length, 160);

  const domainStart = widths.label + 1;
  const triggerStart = domainStart + widths.domain + 1;
  const loadedStart = triggerStart + widths.trigger + 1;
  const runningStart = loadedStart + widths.loaded + 1;
  const disabledStart = runningStart + widths.running + 1;

  assert.equal(row.slice(0, 'com.example.wide-layout-job'.length), 'com.example.wide-layout-job');
  assert.equal(row.slice(domainStart, domainStart + 6), 'system');
  assert.equal(row.slice(triggerStart, triggerStart + 10), 'keep-alive');
  assert.equal(row.slice(loadedStart, loadedStart + 6), 'loaded');
  assert.equal(row.slice(runningStart, runningStart + 13), 'running (321)');
  assert.equal(row.slice(disabledStart), 'disabled');
});

test('formatJobRow truncates a label wider than its column instead of overflowing', () => {
  const widths = { label: 8, domain: 6, trigger: 10, loaded: 10, running: 9, disabled: 8 };
  const job = makeJob({ label: 'com.example.a-very-long-label' });
  const row = formatJobRow(job, widths);
  const firstColumn = row.split(' ')[0] ?? '';
  assert.equal(firstColumn.length, 8);
  assert.ok(firstColumn.endsWith('…'));
});

// --- renderPanelTopBorder ------------------------------------------------------

test('renderPanelTopBorder embeds the title between the corners, padded with fill to the exact width', () => {
  const border = renderPanelTopBorder(20, 'Jobs (17)');
  assert.equal(border.length, 20);
  assert.ok(border.startsWith('╭─ Jobs (17) ─'));
  assert.ok(border.endsWith('╮'));
});

test('renderPanelTopBorder prefixes the title with the glyph when one is given', () => {
  const border = renderPanelTopBorder(30, 'User agents (4)', '○');
  assert.equal(border.length, 30);
  assert.ok(border.includes('○ User agents (4)'));
});

test('renderPanelTopBorder truncates the title instead of exceeding the requested width', () => {
  const border = renderPanelTopBorder(10, 'A very long panel title indeed');
  assert.equal(border.length, 10);
  assert.ok(border.startsWith('╭'));
  assert.ok(border.endsWith('╮'));
});

test('renderPanelTopBorder degrades to a plain fill line when there is no room for any title', () => {
  const border = renderPanelTopBorder(3, 'Jobs');
  assert.equal(border.length, 3);
  assert.equal(border[0], '╭');
  assert.equal(border[border.length - 1], '╮');
});

// --- nextDomain -----------------------------------------------------------------

test('nextDomain cycles user -> system -> daemon -> user', () => {
  assert.equal(nextDomain(JOB_DOMAIN.USER), JOB_DOMAIN.SYSTEM);
  assert.equal(nextDomain(JOB_DOMAIN.SYSTEM), JOB_DOMAIN.DAEMON);
  assert.equal(nextDomain(JOB_DOMAIN.DAEMON), JOB_DOMAIN.USER);
});

// --- formatScopeLabel ------------------------------------------------------------

test('formatScopeLabel describes what was actually fetched at startup', () => {
  assert.equal(formatScopeLabel(false), 'user agents');
  assert.equal(formatScopeLabel(true), 'user, system & daemons');
});

// --- clampIndex ------------------------------------------------------------------
// Extracted as a pure function so the up/down bounds logic is testable without
// rendering anything — selection is shown only via color (inverse video),
// which is unobservable through ink-testing-library's plain-text frames.

test('clampIndex moves down within bounds', () => {
  assert.equal(clampIndex(0, 1, 5), 1);
});

test('clampIndex does not move past the last index', () => {
  assert.equal(clampIndex(4, 1, 5), 4);
});

test('clampIndex moves up within bounds', () => {
  assert.equal(clampIndex(2, -1, 5), 1);
});

test('clampIndex does not move before zero', () => {
  assert.equal(clampIndex(0, -1, 5), 0);
});

test('clampIndex is always 0 for an empty list', () => {
  assert.equal(clampIndex(3, 1, 0), 0);
  assert.equal(clampIndex(0, -1, 0), 0);
});
