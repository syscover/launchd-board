/**
 * Presentational: the single interactive panel, titled with the currently
 * viewed domain (scope) and its job count. Ink 7.1.1's Box has no `title`
 * prop, so the top edge is hand-drawn text (renderPanelTopBorder) and the
 * Box below renders with borderTop={false} so the edges do not double up.
 */

import { Box, Text } from 'ink';
import React from 'react';

import type { Job, JobDomain } from '../launchd/types.js';
import { renderPanelTopBorder } from './format.js';
import { JobTable } from './JobTable.js';
import { borderColorForFocus, DOMAIN_GLYPH, DOMAIN_LABEL } from './palette.js';

export interface JobsPanelProps {
  /** Already filtered to `scope` — this component does no filtering itself. */
  readonly jobs: readonly Job[];
  readonly scope: JobDomain;
  readonly selectedIndex: number;
  readonly terminalWidth: number;
}

const MIN_PANEL_WIDTH = 10;
// The two side border characters the Box below draws (│ left, │ right).
const BORDER_SIDE_WIDTH = 2;

export function JobsPanel({ jobs, scope, selectedIndex, terminalWidth }: JobsPanelProps): React.JSX.Element {
  const panelWidth = Math.max(terminalWidth, MIN_PANEL_WIDTH);
  const title = `${DOMAIN_LABEL[scope]} (${jobs.length})`;
  const topBorder = renderPanelTopBorder(panelWidth, title, DOMAIN_GLYPH[scope]);
  // v1 has exactly one panel and it is always the one receiving keyboard
  // input — there is nothing else to tab focus to.
  const borderColor = borderColorForFocus(true);
  const contentWidth = Math.max(1, panelWidth - BORDER_SIDE_WIDTH);

  return (
    <Box flexDirection="column">
      <Text color={borderColor}>{topBorder}</Text>
      <Box width={panelWidth} borderStyle="round" borderTop={false} borderColor={borderColor}>
        <JobTable jobs={jobs} selectedIndex={selectedIndex} terminalWidth={contentWidth} />
      </Box>
    </Box>
  );
}
