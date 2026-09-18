import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job } from '../launchd/types.js';
import { foregroundAnsi, INVERSE_END, INVERSE_START, stripAnsi } from '../test-support/ansi.js';
import { columnWidthsFor, formatJobRow } from './format.js';
import { JobTable } from './JobTable.js';

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

test('JobTable renders a header row with all required columns', () => {
  const { lastFrame } = render(<JobTable jobs={[]} selectedIndex={0} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /LABEL/);
  assert.match(frame, /DOMAIN/);
  assert.match(frame, /TRIGGER/);
  assert.match(frame, /LOADED/);
  assert.match(frame, /RUNNING/);
  assert.match(frame, /DISABLED/);
});

test('JobTable distinguishes the three state dimensions for a fully-loaded running job', () => {
  const job = makeJob({
    label: 'com.example.running',
    runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 4242 } },
    disabled: false,
  });
  const { lastFrame } = render(<JobTable jobs={[job]} selectedIndex={-1} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /loaded/);
  assert.match(frame, /running \(4242\)/);
  assert.match(frame, /enabled/);
});

test('JobTable distinguishes a job that is present as a plist but never loaded and disabled', () => {
  const job = makeJob({
    label: 'com.example.dormant',
    runtime: { loaded: false },
    disabled: true,
  });
  const { lastFrame } = render(<JobTable jobs={[job]} selectedIndex={-1} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /not loaded/);
  assert.match(frame, /disabled/);
});

test('JobTable no longer uses a marker glyph for the selected row (full-row inverse instead)', () => {
  const jobs = [
    makeJob({ label: 'com.example.first', plistPath: '/a.plist' }),
    makeJob({ label: 'com.example.second', plistPath: '/b.plist' }),
  ];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={1} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.equal(frame.includes('›'), false);
});

test('JobTable renders the selected row as the exact formatJobRow text', () => {
  const jobs = [
    makeJob({ label: 'com.example.first', plistPath: '/a.plist' }),
    makeJob({
      label: 'com.example.second',
      plistPath: '/b.plist',
      runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 55 } },
    }),
  ];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={1} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  const widths = columnWidthsFor(100);
  const expectedSelectedLine = formatJobRow(jobs[1] as Job, widths);
  assert.ok(frame.includes(expectedSelectedLine), `expected frame to contain:\n${expectedSelectedLine}`);
});

test('JobTable truncates a label that does not fit a narrow terminal instead of wrapping it', () => {
  const longLabel = 'com.example.a-very-long-service-label-that-will-not-fit-on-a-narrow-terminal';
  const job = makeJob({ label: longLabel });
  const { lastFrame } = render(<JobTable jobs={[job]} selectedIndex={-1} terminalWidth={40} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.equal(frame.includes(longLabel), false);
  assert.match(frame, /…/);
  const linesWithEllipsis = frame.split('\n').filter((line) => line.includes('…'));
  assert.equal(linesWithEllipsis.length, 1);
});

// --- Styling: the selected row is a real inverse bar spanning the full width ------------

test('JobTable wraps the selected row in inverse SGR codes that span the full terminal width', () => {
  // ink-testing-library is hardcoded to 100 columns, so 100 is the only
  // width this assertion can observe for real; the fixed columns (85) plus
  // 5 separators plus the label floor (10) sum to exactly 100, so the
  // padded inverse content is exactly 100 chars wide at this width.
  const jobs = [makeJob({ label: 'only-job', plistPath: '/a.plist' })];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={0} terminalWidth={100} />);
  const rawFrame = lastFrame() ?? '';

  const startIndex = rawFrame.indexOf(INVERSE_START);
  const endIndex = rawFrame.indexOf(INVERSE_END);
  assert.notEqual(startIndex, -1, 'expected the inverse-start SGR code (\\x1b[7m) in the raw frame');
  assert.notEqual(endIndex, -1, 'expected the inverse-end SGR code (\\x1b[27m) in the raw frame');
  assert.ok(startIndex < endIndex);

  // Nothing else styles the selected row (no other Text spans it), so the
  // span between the inverse markers is exactly the row's plain content —
  // and it must be padded to the FULL terminal width, not just its own text.
  const inverseContent = rawFrame.slice(startIndex + INVERSE_START.length, endIndex);
  assert.equal(stripAnsi(inverseContent), inverseContent, 'no other SGR codes should appear inside the inverse span');
  assert.equal(inverseContent.length, 100, 'the inverse bar must span the full panel width, not just its own text');
});

test('JobTable puts no inverse SGR anywhere on a NON-selected row', () => {
  // Short (<=10 char) fixture labels: at ink-testing-library's fixed 100
  // columns the label column floors at 10 chars (see format.test.ts's
  // pinning test), so anything longer truncates to an indistinguishable
  // "com.examp…" prefix. Truncation itself is covered at the formatJobRow
  // level, not here — this test is about the inverse SGR, not the label.
  const jobs = [makeJob({ label: 'alpha', plistPath: '/a.plist' }), makeJob({ label: 'bravo', plistPath: '/b.plist' })];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={0} terminalWidth={100} />);
  const rawFrame = lastFrame() ?? '';
  const notSelectedLine = rawFrame.split('\n').find((line) => line.includes('bravo'));
  assert.ok(notSelectedLine, 'expected to find the non-selected row');
  assert.equal(notSelectedLine.includes(INVERSE_START), false);
  assert.equal(notSelectedLine.includes(INVERSE_END), false);
});

// --- Styling: the two semantic state colors --------------------------------------------

test('JobTable colors a disabled job (non-selected) with the spec desaturated red #e06c75', () => {
  const jobs = [
    makeJob({ label: 'alpha', plistPath: '/a.plist' }),
    makeJob({ label: 'bravo', plistPath: '/b.plist', disabled: true }),
  ];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={0} terminalWidth={100} />);
  const rawFrame = lastFrame() ?? '';
  const disabledLine = rawFrame.split('\n').find((line) => line.includes('bravo'));
  assert.ok(disabledLine, 'expected to find the disabled job row');
  // #e06c75 = 224, 108, 117 — from the palette SPEC, not re-imported from palette.ts.
  const red = foregroundAnsi(224, 108, 117);
  assert.ok(disabledLine.includes(red), `expected the red SGR sequence ${JSON.stringify(red)} on the disabled row`);
});

test('JobTable colors a running job (non-selected) with the spec desaturated green #98c379', () => {
  const jobs = [
    makeJob({ label: 'alpha', plistPath: '/a.plist' }),
    makeJob({
      label: 'bravo',
      plistPath: '/b.plist',
      runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 7 } },
    }),
  ];
  const { lastFrame } = render(<JobTable jobs={jobs} selectedIndex={0} terminalWidth={100} />);
  const rawFrame = lastFrame() ?? '';
  const runningLine = rawFrame.split('\n').find((line) => line.includes('bravo'));
  assert.ok(runningLine, 'expected to find the running job row');
  // #98c379 = 152, 195, 121 — from the palette SPEC, not re-imported from palette.ts.
  const green = foregroundAnsi(152, 195, 121);
  assert.ok(runningLine.includes(green), `expected the green SGR sequence ${JSON.stringify(green)} on the running row`);
});
