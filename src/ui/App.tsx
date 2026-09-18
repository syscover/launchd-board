/**
 * Top-level presentational component. Receives Job[] as a prop — it never
 * fetches data itself, that is index.tsx's job. Owns only local UI state:
 * which row is selected, which single domain (scope) the panel is showing,
 * and whether the expanded help line is open.
 */

import { Box, useApp, useInput } from 'ink';
import React, { useState } from 'react';

import type { Job, JobDomain } from '../launchd/types.js';
import { JOB_DOMAIN } from '../launchd/types.js';
import { clampIndex, nextDomain } from './format.js';
import { Footer } from './Footer.js';
import { JobsPanel } from './JobsPanel.js';
import { TopBar } from './TopBar.js';

export interface AppProps {
  /** Every job fetched at startup — the panel filters this to one scope. */
  readonly jobs: readonly Job[];
  readonly includeSystem: boolean;
  readonly terminalWidth: number;
}

export function App({ jobs, includeSystem, terminalWidth }: AppProps): React.JSX.Element {
  const [scope, setScope] = useState<JobDomain>(JOB_DOMAIN.USER);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const { exit } = useApp();

  const visibleJobs = jobs.filter((job) => job.domain === scope);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    if (input === 'a') {
      setScope((current) => nextDomain(current));
      setSelectedIndex(0); // the previous index may not exist in the new scope's list
      return;
    }
    if (input === '?') {
      setShowHelp((current) => !current);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((current) => clampIndex(current, 1, visibleJobs.length));
    }
    if (key.upArrow) {
      setSelectedIndex((current) => clampIndex(current, -1, visibleJobs.length));
    }
  });

  return (
    <Box flexDirection="column">
      <TopBar jobs={jobs} includeSystem={includeSystem} terminalWidth={terminalWidth} />
      <JobsPanel jobs={visibleJobs} scope={scope} selectedIndex={selectedIndex} terminalWidth={terminalWidth} />
      <Footer showHelp={showHelp} />
    </Box>
  );
}
