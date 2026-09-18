/**
 * Presentational: a static overview bar — what was fetched at startup (the
 * CLI scope) and the global summary across every fetched job, independent
 * of which single domain the panel below is currently showing.
 */

import { Box, Text } from 'ink';
import React from 'react';

import type { Job } from '../launchd/types.js';
import { formatScopeLabel } from './format.js';
import { PALETTE } from './palette.js';
import { Summary } from './Summary.js';

export interface TopBarProps {
  readonly jobs: readonly Job[];
  readonly includeSystem: boolean;
  readonly terminalWidth: number;
}

const MIN_TOP_BAR_WIDTH = 10;

export function TopBar({ jobs, includeSystem, terminalWidth }: TopBarProps): React.JSX.Element {
  const width = Math.max(terminalWidth, MIN_TOP_BAR_WIDTH);

  return (
    <Box flexDirection="column" width={width} borderStyle="round" borderColor={PALETTE.borderTopBar}>
      <Text color={PALETTE.bodyText}>Scope: {formatScopeLabel(includeSystem)}</Text>
      <Summary jobs={jobs} />
    </Box>
  );
}
