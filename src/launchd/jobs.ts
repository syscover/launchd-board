/**
 * Composes the three launchd data sources — plist files, `launchctl list`,
 * and `launchctl print-disabled` — into one typed `Job[]`. This is the only
 * place that decides how those three sources reconcile into a single job
 * record. Takes a `CommandRunner` as a parameter; it never creates one
 * itself, so tests can supply a fake and never touch real launchd.
 */

import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import type { CommandRunner } from './exec.js';
import { classifyTriggers, parseDisabledServices, parseLaunchctlList, parsePlistJson } from './parse.js';
import type { Job, JobDomain, JobRuntimeState } from './types.js';
import { JOB_DOMAIN } from './types.js';

export interface ListJobsOptions {
  /** Widen the scan to system agents and daemons, not just the user's own. */
  readonly includeSystem?: boolean;
  /** Test-only overrides for the real launchd directories. */
  readonly userAgentsDir?: string;
  readonly systemAgentsDir?: string;
  readonly systemDaemonsDir?: string;
}

interface PlistFileRef {
  readonly path: string;
  readonly domain: JobDomain;
}

const PLIST_EXTENSION = '.plist';

function defaultUserAgentsDir(): string {
  return join(homedir(), 'Library', 'LaunchAgents');
}

function listPlistFiles(dir: string, domain: JobDomain): PlistFileRef[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Directory missing or unreadable — report nothing from it rather than crash.
    return [];
  }

  return entries
    .filter((entry) => entry.endsWith(PLIST_EXTENSION))
    .map((entry) => ({ path: join(dir, entry), domain }));
}

function fileLabelFromPath(path: string): string {
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName.slice(0, -PLIST_EXTENSION.length);
}

/** `process.getuid` is typed optional because it does not exist on Windows; this tool is macOS-only. */
function getCurrentUid(): number {
  if (typeof process.getuid !== 'function') {
    throw new Error('process.getuid is unavailable — launchd-board only runs on macOS');
  }
  return process.getuid();
}

export function listJobs(runner: CommandRunner, options: ListJobsOptions = {}): Job[] {
  const userAgentsDir = options.userAgentsDir ?? defaultUserAgentsDir();
  const systemAgentsDir = options.systemAgentsDir ?? '/Library/LaunchAgents';
  const systemDaemonsDir = options.systemDaemonsDir ?? '/Library/LaunchDaemons';

  const plistFiles: PlistFileRef[] = [...listPlistFiles(userAgentsDir, JOB_DOMAIN.USER)];
  if (options.includeSystem === true) {
    plistFiles.push(...listPlistFiles(systemAgentsDir, JOB_DOMAIN.SYSTEM));
    plistFiles.push(...listPlistFiles(systemDaemonsDir, JOB_DOMAIN.DAEMON));
  }

  const listRows = parseLaunchctlList(runner(['launchctl', 'list']));
  const listByLabel = new Map(listRows.map((row) => [row.label, row]));

  const disabledByLabel = parseDisabledServices(runner(['launchctl', 'print-disabled', `gui/${getCurrentUid()}`]));

  const jobs: Job[] = [];

  for (const file of plistFiles) {
    let json: string;
    try {
      json = runner(['plutil', '-convert', 'json', '-o', '-', file.path]);
    } catch {
      // Real macOS machines have plists the current user cannot read (e.g. a
      // root-owned daemon in /Library/LaunchDaemons). v1 is read-only and a
      // spectator: skip what it cannot see rather than crash the whole list.
      continue;
    }

    const definition = parsePlistJson(json);
    const label = definition.label ?? fileLabelFromPath(file.path);
    const listRow = listByLabel.get(label);

    const runtime: JobRuntimeState =
      listRow === undefined
        ? { loaded: false }
        : { loaded: true, lastExitStatus: listRow.lastExitStatus, process: listRow.process };

    jobs.push({
      label,
      domain: file.domain,
      plistPath: file.path,
      triggers: classifyTriggers(definition),
      disabled: disabledByLabel.get(label) ?? false,
      runtime,
    });
  }

  return jobs.sort((a, b) => a.label.localeCompare(b.label));
}
