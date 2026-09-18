/**
 * Presentational: renders the `Job[]` it is given. It fetches nothing —
 * index.tsx is the only place that calls listJobs().
 */

import { Box, Text } from 'ink';
import React from 'react';

import type { Job } from '../launchd/types.js';
import {
  columnWidthsFor,
  formatDisabledState,
  formatJobRow,
  formatLoadState,
  formatRunState,
  formatTriggers,
  truncateLabel,
} from './format.js';
import { PALETTE } from './palette.js';

export interface JobTableProps {
  readonly jobs: readonly Job[];
  readonly selectedIndex: number;
  readonly terminalWidth: number;
}

export function JobTable({ jobs, selectedIndex, terminalWidth }: JobTableProps): React.JSX.Element {
  const widths = columnWidthsFor(terminalWidth);
  const headerLine = [
    'LABEL'.padEnd(widths.label),
    'DOMAIN'.padEnd(widths.domain),
    'TRIGGER'.padEnd(widths.trigger),
    'LOADED'.padEnd(widths.loaded),
    'RUNNING'.padEnd(widths.running),
    'DISABLED'.padEnd(widths.disabled),
  ].join(' ');

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={PALETTE.primaryText} bold>
          {headerLine}
        </Text>
      </Box>
      {jobs.map((job, index) => {
        const isSelected = index === selectedIndex;

        if (isSelected) {
          // The selected row is ONE inverse Text spanning the full width — a
          // full-width bar is what makes it findable at a glance, not a
          // per-column marker easy to lose in a long list. Building it as a
          // single joined-and-padded string (rather than several colored
          // Text spans, as below) guarantees the inverse bar has no gaps.
          const line = formatJobRow(job, widths).padEnd(terminalWidth);
          return (
            <Box key={job.plistPath}>
              <Text inverse>{line}</Text>
            </Box>
          );
        }

        const isRunning = job.runtime.loaded && job.runtime.process.running;

        return (
          <Box key={job.plistPath}>
            <Text color={PALETTE.primaryText} bold>
              {truncateLabel(job.label, widths.label).padEnd(widths.label)}{' '}
            </Text>
            <Text color={PALETTE.secondaryTag}>{job.domain.padEnd(widths.domain)} </Text>
            <Text color={PALETTE.secondaryTag}>
              {truncateLabel(formatTriggers(job.triggers), widths.trigger).padEnd(widths.trigger)}{' '}
            </Text>
            <Text color={PALETTE.bodyText}>{formatLoadState(job.runtime).padEnd(widths.loaded)} </Text>
            <Text color={isRunning ? PALETTE.stateRunning : PALETTE.bodyText}>
              {formatRunState(job.runtime).padEnd(widths.running)}{' '}
            </Text>
            <Text color={job.disabled ? PALETTE.stateDisabled : PALETTE.bodyText}>
              {formatDisabledState(job.disabled)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
