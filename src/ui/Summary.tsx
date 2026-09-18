/**
 * Presentational count summary. Receives Job[] as a prop; does no fetching.
 */

import { Box, Text } from 'ink';
import React from 'react';

import type { Job } from '../launchd/types.js';
import { PALETTE } from './palette.js';

export interface SummaryProps {
  readonly jobs: readonly Job[];
}

function countRunning(jobs: readonly Job[]): number {
  return jobs.filter((job) => job.runtime.loaded && job.runtime.process.running).length;
}

function countLoaded(jobs: readonly Job[]): number {
  return jobs.filter((job) => job.runtime.loaded).length;
}

function countDisabled(jobs: readonly Job[]): number {
  return jobs.filter((job) => job.disabled).length;
}

export function Summary({ jobs }: SummaryProps): React.JSX.Element {
  return (
    <Box>
      <Text color={PALETTE.bodyText}>
        {jobs.length} jobs · {countLoaded(jobs)} loaded · {countRunning(jobs)} running · {countDisabled(jobs)} disabled
      </Text>
    </Box>
  );
}
