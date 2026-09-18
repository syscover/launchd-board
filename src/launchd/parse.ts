/**
 * PURE functions only. Every function here takes a STRING (the verbatim
 * stdout of a launchd command, or the JSON `plutil` emits) and returns a
 * typed record. Never import `node:child_process` here — that lives only in
 * exec.ts. This separation is what lets the tests run with no real launchd.
 */

import type { JobProcessState, LaunchctlListRow, PlistDefinition, TriggerType } from './types.js';
import { TRIGGER_TYPE } from './types.js';

/**
 * Parses `launchctl list` output (tab-separated: PID, last exit status,
 * label; header row "PID\tStatus\tLabel" first). A "-" PID means the job is
 * known to launchd but has no running process right now.
 */
export function parseLaunchctlList(output: string): LaunchctlListRow[] {
  const rows: LaunchctlListRow[] = [];

  for (const line of output.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }

    const fields = line.split('\t');
    if (fields.length !== 3) {
      continue;
    }

    const [pidField, exitField, labelField] = fields;
    if (pidField === 'PID' && exitField === 'Status' && labelField === 'Label') {
      continue; // header row
    }

    const label = labelField ?? '';
    const parsedExitStatus = Number.parseInt(exitField ?? '', 10);
    const lastExitStatus = Number.isNaN(parsedExitStatus) ? 0 : parsedExitStatus;

    const process: JobProcessState =
      pidField === '-' ? { running: false } : { running: true, pid: Number.parseInt(pidField ?? '', 10) };

    rows.push({ label, lastExitStatus, process });
  }

  return rows;
}

const DISABLED_ENTRY_PATTERN = /^\s*"([^"]+)"\s*=>\s*(enabled|disabled)\s*$/;

/**
 * Parses `launchctl print-disabled gui/<uid>` output. Format:
 * ```
 *     disabled services = {
 *         "label" => enabled
 *         "label" => disabled
 *     }
 * ```
 * Returns a map from label to `true` (disabled) / `false` (explicitly
 * enabled). A label absent from the map was never overridden — callers must
 * treat that as "not disabled", not as "unknown".
 */
export function parseDisabledServices(output: string): ReadonlyMap<string, boolean> {
  const disabled = new Map<string, boolean>();

  for (const line of output.split('\n')) {
    const match = DISABLED_ENTRY_PATTERN.exec(line);
    if (match === null) {
      continue;
    }
    const [, label, state] = match;
    if (label === undefined || state === undefined) {
      continue;
    }
    disabled.set(label, state === 'disabled');
  }

  return disabled;
}

function isNonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasStartCalendarIntervalTrigger(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === 'object' && value !== null;
}

function hasKeepAliveTrigger(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (value === false || value === undefined || value === null) {
    return false;
  }
  return typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0;
}

/**
 * Parses the JSON `plutil -convert json -o -` emits for one plist file into
 * the normalized shape the rest of the app consumes. Any key this app does
 * not care about is ignored.
 */
export function parsePlistJson(json: string): PlistDefinition {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('plutil output did not parse to a JSON object');
  }

  const plist = parsed as Record<string, unknown>;

  return {
    label: typeof plist.Label === 'string' ? plist.Label : null,
    hasStartInterval: typeof plist.StartInterval === 'number',
    hasStartCalendarInterval: hasStartCalendarIntervalTrigger(plist.StartCalendarInterval),
    hasKeepAlive: hasKeepAliveTrigger(plist.KeepAlive),
    hasWatchPaths: isNonEmptyStringArray(plist.WatchPaths),
    hasQueueDirectories: isNonEmptyStringArray(plist.QueueDirectories),
    runAtLoad: plist.RunAtLoad === true,
  };
}

/**
 * Derives every trigger that applies to a job. A job with none of the known
 * triggers is classified "on demand" (it only starts when something
 * explicitly loads and runs it).
 */
export function classifyTriggers(definition: PlistDefinition): TriggerType[] {
  const triggers: TriggerType[] = [];

  if (definition.hasStartInterval) {
    triggers.push(TRIGGER_TYPE.START_INTERVAL);
  }
  if (definition.hasStartCalendarInterval) {
    triggers.push(TRIGGER_TYPE.START_CALENDAR_INTERVAL);
  }
  if (definition.hasKeepAlive) {
    triggers.push(TRIGGER_TYPE.KEEP_ALIVE);
  }
  if (definition.hasWatchPaths) {
    triggers.push(TRIGGER_TYPE.WATCH_PATHS);
  }
  if (definition.hasQueueDirectories) {
    triggers.push(TRIGGER_TYPE.QUEUE_DIRECTORIES);
  }
  if (definition.runAtLoad) {
    triggers.push(TRIGGER_TYPE.RUN_AT_LOAD);
  }
  if (triggers.length === 0) {
    triggers.push(TRIGGER_TYPE.ON_DEMAND);
  }

  return triggers;
}
