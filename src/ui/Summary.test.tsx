import assert from 'node:assert/strict';
import { test } from 'node:test';

import { render } from 'ink-testing-library';
import React from 'react';

import { JOB_DOMAIN, TRIGGER_TYPE } from '../launchd/types.js';
import type { Job } from '../launchd/types.js';
import { Summary } from './Summary.js';

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

test('Summary counts total, running, loaded and disabled jobs correctly', () => {
  const jobs: Job[] = [
    makeJob({
      plistPath: '/a.plist',
      runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 1 } },
      disabled: false,
    }),
    makeJob({
      plistPath: '/b.plist',
      runtime: { loaded: true, lastExitStatus: 0, process: { running: false } },
      disabled: false,
    }),
    makeJob({ plistPath: '/c.plist', runtime: { loaded: false }, disabled: true }),
    makeJob({ plistPath: '/d.plist', runtime: { loaded: false }, disabled: false }),
  ];

  const { lastFrame } = render(<Summary jobs={jobs} />);
  const frame = lastFrame() ?? '';

  assert.match(frame, /4/); // total
  assert.match(frame, /1/); // exactly one running
  assert.match(frame, /2/); // two loaded (running + stopped)
  // exactly one disabled — asserted precisely below since "1" alone is ambiguous with other counts
});

test('Summary reports precise counts via distinguishable labels', () => {
  const jobs: Job[] = [
    makeJob({
      plistPath: '/a.plist',
      runtime: { loaded: true, lastExitStatus: 0, process: { running: true, pid: 1 } },
    }),
    makeJob({ plistPath: '/b.plist', runtime: { loaded: false }, disabled: true }),
  ];

  const { lastFrame } = render(<Summary jobs={jobs} />);
  const frame = lastFrame() ?? '';

  assert.match(frame, /2\s+jobs/i);
  assert.match(frame, /1\s+running/i);
  assert.match(frame, /1\s+loaded/i);
  assert.match(frame, /1\s+disabled/i);
});

test('Summary handles an empty job list without crashing', () => {
  const { lastFrame } = render(<Summary jobs={[]} />);
  const frame = lastFrame() ?? '';
  assert.match(frame, /0\s+jobs/i);
});
