import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { listJobs } from './jobs.js';
import { JOB_DOMAIN, TRIGGER_TYPE } from './types.js';

const LAUNCHCTL_LIST_OUTPUT = ['PID\tStatus\tLabel', '4242\t0\tcom.example.loaded-running', '-\t1\tcom.example.loaded-stopped'].join(
  '\n',
);

const PRINT_DISABLED_OUTPUT = [
  '',
  '\tdisabled services = {',
  '\t\t"com.example.disabled-job" => disabled',
  '\t\t"com.example.loaded-running" => enabled',
  '\t}',
].join('\n');

function makeUserAgentsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'launchd-board-agents-'));
  writeFileSync(
    join(dir, 'com.example.loaded-running.plist'),
    'not-real-xml, plutil is faked by the test CommandRunner',
  );
  writeFileSync(join(dir, 'com.example.loaded-stopped.plist'), 'stub');
  writeFileSync(join(dir, 'com.example.never-loaded.plist'), 'stub');
  writeFileSync(join(dir, 'com.example.disabled-job.plist'), 'stub');
  writeFileSync(join(dir, 'not-a-plist.txt'), 'ignored, wrong extension');
  return dir;
}

const PLIST_JSON_BY_LABEL: Record<string, string> = {
  'com.example.loaded-running': JSON.stringify({
    Label: 'com.example.loaded-running',
    StartInterval: 300,
  }),
  'com.example.loaded-stopped': JSON.stringify({
    Label: 'com.example.loaded-stopped',
    KeepAlive: true,
  }),
  'com.example.never-loaded': JSON.stringify({
    Label: 'com.example.never-loaded',
  }),
  'com.example.disabled-job': JSON.stringify({
    Label: 'com.example.disabled-job',
    RunAtLoad: true,
  }),
};

function fakeRunner(userAgentsDir: string): (argv: readonly string[]) => string {
  return (argv) => {
    const [command, ...args] = argv;
    if (command === 'launchctl' && args[0] === 'list') {
      return LAUNCHCTL_LIST_OUTPUT;
    }
    if (command === 'launchctl' && args[0] === 'print-disabled') {
      return PRINT_DISABLED_OUTPUT;
    }
    if (command === 'plutil') {
      const plistPath = args[args.length - 1] ?? '';
      const fileName = plistPath.slice(userAgentsDir.length + 1).replace(/\.plist$/, '');
      const json = PLIST_JSON_BY_LABEL[fileName];
      if (json === undefined) {
        throw new Error(`unexpected plist path in test: ${plistPath}`);
      }
      return json;
    }
    throw new Error(`unexpected command in test: ${argv.join(' ')}`);
  };
}

test('listJobs composes loaded, disabled and running state from all three sources', () => {
  const userAgentsDir = makeUserAgentsDir();
  try {
    const jobs = listJobs(fakeRunner(userAgentsDir), { userAgentsDir });
    const byLabel = new Map(jobs.map((job) => [job.label, job]));

    const running = byLabel.get('com.example.loaded-running');
    assert.ok(running);
    assert.deepEqual(running.runtime, { loaded: true, lastExitStatus: 0, process: { running: true, pid: 4242 } });
    assert.equal(running.disabled, false);
    assert.deepEqual(running.triggers, [TRIGGER_TYPE.START_INTERVAL]);
    assert.equal(running.domain, JOB_DOMAIN.USER);

    const stopped = byLabel.get('com.example.loaded-stopped');
    assert.ok(stopped);
    assert.deepEqual(stopped.runtime, { loaded: true, lastExitStatus: 1, process: { running: false } });

    const neverLoaded = byLabel.get('com.example.never-loaded');
    assert.ok(neverLoaded);
    assert.deepEqual(neverLoaded.runtime, { loaded: false });
    assert.equal(neverLoaded.disabled, false);

    const disabledJob = byLabel.get('com.example.disabled-job');
    assert.ok(disabledJob);
    assert.equal(disabledJob.disabled, true);
    assert.deepEqual(disabledJob.runtime, { loaded: false });
  } finally {
    rmSync(userAgentsDir, { recursive: true, force: true });
  }
});

test('listJobs ignores files that are not *.plist', () => {
  const userAgentsDir = makeUserAgentsDir();
  try {
    const jobs = listJobs(fakeRunner(userAgentsDir), { userAgentsDir });
    assert.equal(jobs.length, 4);
  } finally {
    rmSync(userAgentsDir, { recursive: true, force: true });
  }
});

test('listJobs skips a plist the runner cannot read instead of throwing', () => {
  const userAgentsDir = makeUserAgentsDir();
  writeFileSync(join(userAgentsDir, 'com.example.permission-denied.plist'), 'stub');
  try {
    const jobs = listJobs(fakeRunner(userAgentsDir), { userAgentsDir });
    assert.equal(jobs.some((job) => job.plistPath.includes('permission-denied')), false);
    // the other four jobs are still reported
    assert.equal(jobs.length, 4);
  } finally {
    rmSync(userAgentsDir, { recursive: true, force: true });
  }
});
