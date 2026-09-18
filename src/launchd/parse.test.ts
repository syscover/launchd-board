import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyTriggers,
  parseDisabledServices,
  parseLaunchctlList,
  parsePlistJson,
} from './parse.js';
import { TRIGGER_TYPE } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '__fixtures__');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

// --- parseLaunchctlList -----------------------------------------------------

test('parseLaunchctlList skips the header row', () => {
  const rows = parseLaunchctlList(readFixture('launchctl-list.txt'));
  const labels = rows.map((row) => row.label);
  assert.equal(labels.includes('PID'), false);
  assert.equal(labels.includes('Label'), false);
});

test('parseLaunchctlList marks a "-" PID as not running', () => {
  const rows = parseLaunchctlList(readFixture('launchctl-list.txt'));
  const row = rows.find((entry) => entry.label === 'com.apple.enhancedloggingd');
  assert.ok(row, 'expected fixture to contain com.apple.enhancedloggingd');
  assert.deepEqual(row.process, { running: false });
  assert.equal(row.lastExitStatus, 0);
});

test('parseLaunchctlList captures a real PID and a negative exit status', () => {
  const rows = parseLaunchctlList(readFixture('launchctl-list.txt'));
  const row = rows.find((entry) => entry.label === 'com.apple.progressd');
  assert.ok(row, 'expected fixture to contain com.apple.progressd');
  assert.deepEqual(row.process, { running: true, pid: 89396 });
  assert.equal(row.lastExitStatus, -9);
});

test('parseLaunchctlList ignores blank trailing lines', () => {
  const rows = parseLaunchctlList(`${readFixture('launchctl-list.txt')}\n\n`);
  assert.ok(rows.length > 0);
});

// --- parseDisabledServices ---------------------------------------------------

test('parseDisabledServices marks an explicitly disabled label as true', () => {
  const disabled = parseDisabledServices(readFixture('print-disabled.txt'));
  assert.equal(disabled.get('com.apple.ManagedClientAgent.enrollagent'), true);
});

test('parseDisabledServices marks an explicitly enabled label as false', () => {
  const disabled = parseDisabledServices(readFixture('print-disabled.txt'));
  assert.equal(disabled.get('com.docker.helper'), false);
});

test('parseDisabledServices has no entry for a label the database never mentions', () => {
  const disabled = parseDisabledServices(readFixture('print-disabled.txt'));
  assert.equal(disabled.has('dev.aurora.backlog-dispatch'), false);
});

// --- parsePlistJson -----------------------------------------------------------

test('parsePlistJson reads a StartInterval job', () => {
  const definition = parsePlistJson(readFixture('plist-start-interval.json'));
  assert.equal(definition.label, 'dev.aurora.backlog-dispatch');
  assert.equal(definition.hasStartInterval, true);
  assert.equal(definition.runAtLoad, true);
  assert.equal(definition.hasKeepAlive, false);
});

test('parsePlistJson reads a KeepAlive dictionary as present', () => {
  const definition = parsePlistJson(readFixture('plist-keep-alive.json'));
  assert.equal(definition.label, 'com.fortinet.credential_store');
  assert.equal(definition.hasKeepAlive, true);
  assert.equal(definition.hasStartInterval, false);
});

test('parsePlistJson reads a KeepAlive boolean true as present', () => {
  const definition = parsePlistJson(readFixture('plist-keep-alive-bool.json'));
  assert.equal(definition.hasKeepAlive, true);
});

test('parsePlistJson reads a plist with no trigger keys and no Label', () => {
  const definition = parsePlistJson(readFixture('plist-no-trigger.json'));
  assert.equal(definition.label, null);
  assert.equal(definition.hasStartInterval, false);
  assert.equal(definition.hasStartCalendarInterval, false);
  assert.equal(definition.hasKeepAlive, false);
  assert.equal(definition.hasWatchPaths, false);
  assert.equal(definition.hasQueueDirectories, false);
  assert.equal(definition.runAtLoad, false);
});

test('parsePlistJson reads a StartCalendarInterval job', () => {
  const definition = parsePlistJson(readFixture('plist-start-calendar-interval.json'));
  assert.equal(definition.hasStartCalendarInterval, true);
});

// --- classifyTriggers ----------------------------------------------------------

test('classifyTriggers reports on-demand when nothing else fires', () => {
  const definition = parsePlistJson(readFixture('plist-no-trigger.json'));
  assert.deepEqual(classifyTriggers(definition), [TRIGGER_TYPE.ON_DEMAND]);
});

test('classifyTriggers reports start-interval and run-at-load together', () => {
  const definition = parsePlistJson(readFixture('plist-start-interval.json'));
  assert.deepEqual(classifyTriggers(definition), [TRIGGER_TYPE.START_INTERVAL, TRIGGER_TYPE.RUN_AT_LOAD]);
});

test('classifyTriggers reports keep-alive and run-at-load for a dict KeepAlive job', () => {
  const definition = parsePlistJson(readFixture('plist-keep-alive.json'));
  assert.deepEqual(classifyTriggers(definition), [TRIGGER_TYPE.KEEP_ALIVE, TRIGGER_TYPE.RUN_AT_LOAD]);
});

test('classifyTriggers reports start-calendar-interval alone when RunAtLoad is false', () => {
  const definition = parsePlistJson(readFixture('plist-start-calendar-interval.json'));
  assert.deepEqual(classifyTriggers(definition), [TRIGGER_TYPE.START_CALENDAR_INTERVAL]);
});

test('classifyTriggers reports queue-directories for a hand-built definition', () => {
  // No plist on this machine uses QueueDirectories; the array-of-strings shape
  // is already proven by the WatchPaths fixture, so a direct PlistDefinition
  // is enough to exercise this one boolean branch.
  const definition = {
    label: 'test.queue-directories',
    hasStartInterval: false,
    hasStartCalendarInterval: false,
    hasKeepAlive: false,
    hasWatchPaths: false,
    hasQueueDirectories: true,
    runAtLoad: false,
  };
  assert.deepEqual(classifyTriggers(definition), [TRIGGER_TYPE.QUEUE_DIRECTORIES]);
});

test('classifyTriggers can report multiple simultaneous triggers', () => {
  const definition = {
    label: 'test.multi-trigger',
    hasStartInterval: true,
    hasStartCalendarInterval: true,
    hasKeepAlive: true,
    hasWatchPaths: true,
    hasQueueDirectories: true,
    runAtLoad: true,
  };
  assert.deepEqual(classifyTriggers(definition), [
    TRIGGER_TYPE.START_INTERVAL,
    TRIGGER_TYPE.START_CALENDAR_INTERVAL,
    TRIGGER_TYPE.KEEP_ALIVE,
    TRIGGER_TYPE.WATCH_PATHS,
    TRIGGER_TYPE.QUEUE_DIRECTORIES,
    TRIGGER_TYPE.RUN_AT_LOAD,
  ]);
});
