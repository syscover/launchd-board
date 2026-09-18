import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job, JobDomain } from '../launchd/types.js';
import { stripAnsi } from '../test-support/ansi.js';
import { App } from './App.js';

function makeJob(label: string, domain: JobDomain = JOB_DOMAIN.USER): Job {
  return {
    label,
    domain,
    plistPath: `/Users/test/Library/LaunchAgents/${label}.plist`,
    triggers: [TRIGGER_TYPE.ON_DEMAND],
    disabled: false,
    runtime: { loaded: false },
  };
}

const ARROW_DOWN = '[B';
const ARROW_UP = '[A';

test('App defaults to the user scope and shows only user-domain jobs', () => {
  // ink-testing-library is hardcoded to 100 columns (verified in its own
  // source), and at 100 columns the label column is at its 10-char floor
  // (see labelColumnWidth's pinning test in format.test.ts) — so these
  // fixture labels stay at or under 10 characters, short enough to render
  // untruncated and unambiguous. The truncation behavior itself is covered
  // at the pure-function level (formatJobRow), not the renderer.
  const jobs = [makeJob('usr-job', JOB_DOMAIN.USER), makeJob('sys-job', JOB_DOMAIN.SYSTEM)];
  const { lastFrame } = render(<App jobs={jobs} includeSystem terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /○ User agents \(1\)/);
  assert.match(frame, /usr-job/);
  assert.equal(frame.includes('sys-job'), false);
});

test('pressing "a" cycles the panel to the system scope', async () => {
  const jobs = [makeJob('usr-job', JOB_DOMAIN.USER), makeJob('sys-job', JOB_DOMAIN.SYSTEM)];
  const { lastFrame, stdin } = render(<App jobs={jobs} includeSystem terminalWidth={100} />);
  stdin.write('a');
  await delay(50);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /◐ System agents \(1\)/);
  assert.match(frame, /sys-job/);
  assert.equal(frame.includes('usr-job'), false);
});

test('pressing "a" three times cycles back to the user scope', async () => {
  const jobs = [makeJob('com.example.user-job', JOB_DOMAIN.USER)];
  const { lastFrame, stdin } = render(<App jobs={jobs} includeSystem terminalWidth={100} />);
  stdin.write('a');
  stdin.write('a');
  stdin.write('a');
  await delay(50);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /○ User agents \(1\)/);
});

test('the top bar summary always reflects every fetched job, not just the current scope', async () => {
  const jobs = [makeJob('com.example.user-job', JOB_DOMAIN.USER), makeJob('com.example.system-job', JOB_DOMAIN.SYSTEM)];
  const { lastFrame, stdin } = render(<App jobs={jobs} includeSystem terminalWidth={100} />);
  stdin.write('a'); // switch to system scope
  await delay(50);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /2\s+jobs/i); // both jobs still counted in the top bar
});

test('pressing "?" toggles the expanded help line', async () => {
  const jobs = [makeJob('com.example.job')];
  const { lastFrame, stdin } = render(<App jobs={jobs} includeSystem={false} terminalWidth={100} />);
  const before = stripAnsi(lastFrame() ?? '');
  assert.equal(before.includes('cycles scope'), false);

  stdin.write('?');
  await delay(50);
  const afterOpen = stripAnsi(lastFrame() ?? '');
  assert.ok(afterOpen.includes('cycles scope'));

  stdin.write('?');
  await delay(50);
  const afterClose = stripAnsi(lastFrame() ?? '');
  assert.equal(afterClose.includes('cycles scope'), false);
});

test('arrow keys do not crash the app, even past the list bounds', async () => {
  const jobs = [makeJob('com.example.first'), makeJob('com.example.second')];
  const { stdin } = render(<App jobs={jobs} includeSystem={false} terminalWidth={100} />);
  assert.doesNotThrow(() => {
    stdin.write(ARROW_DOWN);
    stdin.write(ARROW_DOWN);
    stdin.write(ARROW_DOWN);
    stdin.write(ARROW_UP);
    stdin.write(ARROW_UP);
    stdin.write(ARROW_UP);
  });
  await delay(50);
});

test('pressing q does not crash the app', async () => {
  const jobs = [makeJob('com.example.first')];
  const { stdin } = render(<App jobs={jobs} includeSystem={false} terminalWidth={100} />);
  assert.doesNotThrow(() => stdin.write('q'));
  await delay(50);
});

test('App renders the footer key hints', () => {
  const jobs = [makeJob('com.example.first')];
  const { lastFrame } = render(<App jobs={jobs} includeSystem={false} terminalWidth={100} />);
  const frame = stripAnsi(lastFrame() ?? '');
  assert.match(frame, /\[↑↓\] Nav \| \[a\] Scope \| \[\?\] Help \| \[q\] Quit/);
});
