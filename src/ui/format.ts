/**
 * Pure display-formatting helpers for the UI. No Ink imports here — these are
 * plain string functions so they can be unit-tested without rendering
 * anything, and reused identically by every column that needs them.
 */

import type { Job, JobDomain, JobRuntimeState, TriggerType } from '../launchd/types.js';
import { JOB_DOMAIN } from '../launchd/types.js';

export function formatLoadState(runtime: JobRuntimeState): string {
  return runtime.loaded ? 'loaded' : 'not loaded';
}

export function formatRunState(runtime: JobRuntimeState): string {
  if (!runtime.loaded) {
    return '-';
  }
  return runtime.process.running ? `running (${runtime.process.pid})` : 'stopped';
}

export function formatDisabledState(disabled: boolean): string {
  return disabled ? 'disabled' : 'enabled';
}

export function formatTriggers(triggers: readonly TriggerType[]): string {
  return triggers.join(', ');
}

/**
 * Truncates to at most `maxWidth` characters, replacing the tail with a
 * single ellipsis character when it does not fit. Never wraps — the UI's
 * narrow-terminal strategy is truncation, not multi-line rows.
 */
export function truncateLabel(label: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return '';
  }
  if (label.length <= maxWidth) {
    return label;
  }
  if (maxWidth === 1) {
    return '…';
  }
  return `${label.slice(0, maxWidth - 1)}…`;
}

// --- Column widths ---------------------------------------------------------

export interface JobRowColumnWidths {
  readonly label: number;
  readonly domain: number;
  readonly trigger: number;
  readonly loaded: number;
  readonly running: number;
  readonly disabled: number;
}

const FIXED_COLUMN_WIDTHS = {
  domain: 9,
  trigger: 30,
  loaded: 15,
  running: 23,
  disabled: 8,
} as const;

// 6 columns joined by a single space each = 5 separators.
const COLUMN_SEPARATOR_COUNT = 5;
const MIN_LABEL_WIDTH = 10;

/**
 * How wide the label column gets once every other (fixed-width) column and
 * separator has claimed its share of the terminal. Never shrinks below
 * MIN_LABEL_WIDTH — past that point truncation, not a narrower column, is
 * the readability strategy.
 */
export function labelColumnWidth(terminalWidth: number): number {
  const fixedWidth =
    FIXED_COLUMN_WIDTHS.domain +
    FIXED_COLUMN_WIDTHS.trigger +
    FIXED_COLUMN_WIDTHS.loaded +
    FIXED_COLUMN_WIDTHS.running +
    FIXED_COLUMN_WIDTHS.disabled +
    COLUMN_SEPARATOR_COUNT;
  return Math.max(MIN_LABEL_WIDTH, terminalWidth - fixedWidth);
}

export function columnWidthsFor(terminalWidth: number): JobRowColumnWidths {
  return { label: labelColumnWidth(terminalWidth), ...FIXED_COLUMN_WIDTHS };
}

// --- Row text ---------------------------------------------------------------

/**
 * Renders one job as a single plain-text line: every column padded to its
 * width and joined with a single space. Used for the selected row, which
 * renders as ONE `<Text inverse>` spanning the full panel width — building it
 * as one string (rather than several colored Text spans, as unselected rows
 * do) guarantees the inverse bar has no gaps.
 */
export function formatJobRow(job: Job, widths: JobRowColumnWidths): string {
  return [
    truncateLabel(job.label, widths.label).padEnd(widths.label),
    job.domain.padEnd(widths.domain),
    truncateLabel(formatTriggers(job.triggers), widths.trigger).padEnd(widths.trigger),
    formatLoadState(job.runtime).padEnd(widths.loaded),
    formatRunState(job.runtime).padEnd(widths.running),
    formatDisabledState(job.disabled),
  ].join(' ');
}

// --- Panel border -------------------------------------------------------------

const PANEL_CORNER_LEFT = '╭';
const PANEL_CORNER_RIGHT = '╮';
const PANEL_FILL = '─';

/**
 * Ink 7.1.1's Box has no `title` prop, so the panel's top edge — corners,
 * fill, and an embedded title — is drawn as plain text here. The Box
 * beneath it must be rendered with `borderTop={false}` and the SAME width,
 * so the two edges line up with no doubling.
 *
 * Always returns a string of exactly `width` characters (never wider —
 * the frame must never force a horizontal overflow), truncating the title
 * first when it does not fit.
 */
export function renderPanelTopBorder(width: number, title: string, glyph?: string): string {
  const decoratedTitle = glyph !== undefined && glyph.length > 0 ? `${glyph} ${title}` : title;
  const safeWidth = Math.max(width, 2);
  // left corner + one leading fill char + right corner; the rest is budget for " title ".
  const nonContentWidth = 3;
  const maxDecoratedWidth = Math.max(0, safeWidth - nonContentWidth);

  if (decoratedTitle.length === 0 || maxDecoratedWidth <= 2) {
    return `${PANEL_CORNER_LEFT}${PANEL_FILL.repeat(Math.max(0, safeWidth - 2))}${PANEL_CORNER_RIGHT}`;
  }

  const decorated = ` ${decoratedTitle} `;
  const content =
    decorated.length <= maxDecoratedWidth
      ? decorated
      : ` ${truncateLabel(decoratedTitle, Math.max(0, maxDecoratedWidth - 2))} `;

  const usedWidth = 1 + 1 + content.length + 1; // left corner + leading fill + content + right corner
  const trailingFill = Math.max(0, safeWidth - usedWidth);

  return `${PANEL_CORNER_LEFT}${PANEL_FILL}${content}${PANEL_FILL.repeat(trailingFill)}${PANEL_CORNER_RIGHT}`;
}

// --- Scope cycling --------------------------------------------------------------

const DOMAIN_CYCLE_ORDER: readonly JobDomain[] = [JOB_DOMAIN.USER, JOB_DOMAIN.SYSTEM, JOB_DOMAIN.DAEMON];

/** The 'a' key cycles the panel's displayed domain: user -> system -> daemon -> user. */
export function nextDomain(current: JobDomain): JobDomain {
  const currentIndex = DOMAIN_CYCLE_ORDER.indexOf(current);
  const nextIndex = (currentIndex + 1) % DOMAIN_CYCLE_ORDER.length;
  return DOMAIN_CYCLE_ORDER[nextIndex] ?? current;
}

/**
 * Describes what was actually fetched at startup (the CLI's --all/--system
 * scope) — distinct from which single domain the panel is currently showing,
 * which `nextDomain` cycles through client-side over that same fetch.
 */
export function formatScopeLabel(includeSystem: boolean): string {
  return includeSystem ? 'user, system & daemons' : 'user agents';
}

// --- Selection bounds -------------------------------------------------------------

/**
 * Moves a selected index by `delta`, clamped to `[0, length - 1]` (or 0 for
 * an empty list). Extracted as a pure function because the selection itself
 * is shown only via color (inverse video), which ink-testing-library's
 * plain-text frames cannot observe — this is the part of that logic that
 * CAN be unit-tested directly.
 */
export function clampIndex(current: number, delta: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(current + delta, 0), length - 1);
}
