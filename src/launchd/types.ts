/**
 * Shared types for the launchd domain. No I/O here — only data shapes.
 */

export const JOB_DOMAIN = {
  USER: 'user',
  SYSTEM: 'system',
  DAEMON: 'daemon',
} as const;

export type JobDomain = (typeof JOB_DOMAIN)[keyof typeof JOB_DOMAIN];

/**
 * How a job fires. A job can carry several — e.g. StartInterval AND RunAtLoad
 * are both present on the same plist and both matter to the reader.
 */
export const TRIGGER_TYPE = {
  START_INTERVAL: 'start-interval',
  START_CALENDAR_INTERVAL: 'start-calendar-interval',
  KEEP_ALIVE: 'keep-alive',
  WATCH_PATHS: 'watch-paths',
  QUEUE_DIRECTORIES: 'queue-directories',
  RUN_AT_LOAD: 'run-at-load',
  ON_DEMAND: 'on-demand',
} as const;

export type TriggerType = (typeof TRIGGER_TYPE)[keyof typeof TRIGGER_TYPE];

/**
 * A running job always has a pid; a non-running job never does. Modeled as a
 * discriminated union instead of `{ running: boolean; pid: number | null }`
 * so a caller cannot read a pid off a stopped process.
 */
export type JobProcessState = { readonly running: false } | { readonly running: true; readonly pid: number };

/**
 * `launchctl list` is the single source for BOTH "is this job loaded in the
 * current boot" and, when it is, its exit status and process state. A job
 * absent from that listing has no exit status and no process — hence the
 * union instead of nullable fields bolted onto a flat shape.
 */
export type JobRuntimeState =
  | { readonly loaded: false }
  | { readonly loaded: true; readonly lastExitStatus: number; readonly process: JobProcessState };

/**
 * The normalized, already-classified shape of one plist file's launch
 * triggers and label. Raw plutil JSON is reduced to these booleans in
 * parse.ts so the rest of the app never re-inspects the original keys.
 */
export interface PlistDefinition {
  readonly label: string | null;
  readonly hasStartInterval: boolean;
  readonly hasStartCalendarInterval: boolean;
  readonly hasKeepAlive: boolean;
  readonly hasWatchPaths: boolean;
  readonly hasQueueDirectories: boolean;
  readonly runAtLoad: boolean;
}

/**
 * One row of `launchctl list`, already typed. The PID column collapses into
 * `JobProcessState` here rather than downstream.
 */
export interface LaunchctlListRow {
  readonly label: string;
  readonly lastExitStatus: number;
  readonly process: JobProcessState;
}

/**
 * A fully composed job: everything the UI needs, sourced from all three
 * launchd data sources and reconciled by jobs.ts.
 */
export interface Job {
  readonly label: string;
  readonly domain: JobDomain;
  readonly plistPath: string;
  readonly triggers: readonly TriggerType[];
  /** Persists across reboot; independent of whether the job is loaded right now. */
  readonly disabled: boolean;
  readonly runtime: JobRuntimeState;
}
