import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job } from '../launchd/types.js';
import { foregroundAnsi, stripAnsi } from '../test-support/ansi.js';
import { TopBar } from './TopBar.js';

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

test('TopBar shows the user-only scope when includeSystem is false', () => {
  const { lastFrame } = render(<TopBar jobs={[]} includeSystem={false} terminalWidth={60} />);
  assert.match(stripAnsi(lastFrame() ?? ''), /user agents/);
});

test('TopBar shows the widened scope when includeSystem is true', () => {
  const { lastFrame } = render(<TopBar jobs={[]} includeSystem terminalWidth={60} />);
  assert.match(stripAnsi(lastFrame() ?? ''), /user, system & daemons/);
});

test('TopBar shows the global summary counts across all fetched jobs, regardless of scope', () => {
  const jobs = [
    makeJob({
      plistPath: '/a.plist',
      domain: JOB_DOMAIN.USER,
      runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 1 } },
    }),
    makeJob({ plistPath: '/b.plist', domain: JOB_DOMAIN.SYSTEM, runtime: { loaded: false }, disabled: true }),
  ];
  const { lastFrame } = render(<TopBar jobs={jobs} includeSystem terminalWidth={60} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /2\s+jobs/i);
  assert.match(frame, /1\s+running/i);
  assert.match(frame, /1\s+disabled/i);
});

test('TopBar renders inside a bordered box', () => {
  const { lastFrame } = render(<TopBar jobs={[]} includeSystem={false} terminalWidth={60} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /╭/);
  assert.match(frame, /╮/);
  assert.match(frame, /╰/);
  assert.match(frame, /╯/);
});

test('TopBar never lets a bordered line exceed the requested terminal width (visible columns, ANSI excluded)', () => {
  const { lastFrame } = render(<TopBar jobs={[]} includeSystem terminalWidth={25} />);
  const frame = lastFrame() ?? '';
  for (const line of frame.split('\n')) {
    const visible = stripAnsi(line);
    assert.ok(visible.length <= 25, `line exceeded width 25: "${visible}" (${visible.length})`);
  }
});

// --- Styling: the top bar's border is the spec's teal, in the raw (unstripped) frame ---

test('TopBar colors its border with the spec teal #56b6c2', () => {
  const { lastFrame } = render(<TopBar jobs={[]} includeSystem={false} terminalWidth={60} />);
  const frame = lastFrame() ?? '';
  // #56b6c2 = 86, 182, 194 — from the palette SPEC, not re-imported from palette.ts.
  const teal = foregroundAnsi(86, 182, 194);
  assert.ok(frame.includes(teal), `expected the teal SGR sequence ${JSON.stringify(teal)} in the raw frame`);
});
