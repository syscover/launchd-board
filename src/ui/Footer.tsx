/**
 * Presentational: the bottom key-hint bar. Lists ONLY bindings App.tsx
 * actually wires up — never advertise a key v1 does not implement.
 */

import { Box, Text } from 'ink';
import React from 'react';

import { PALETTE } from './palette.js';

export interface FooterProps {
  readonly showHelp: boolean;
}

interface KeyHint {
  readonly key: string;
  readonly label: string;
}

const KEY_HINTS: readonly KeyHint[] = [
  { key: '↑↓', label: 'Nav' },
  { key: 'a', label: 'Scope' },
  { key: '?', label: 'Help' },
  { key: 'q', label: 'Quit' },
];

export function Footer({ showHelp }: FooterProps): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box>
        {KEY_HINTS.map((hint, index) => (
          <Text key={hint.key} dimColor>
            <Text color={PALETTE.keyHint}>[{hint.key}]</Text>
            <Text color={PALETTE.footerLabel}> {hint.label}</Text>
            {index < KEY_HINTS.length - 1 ? <Text color={PALETTE.footerLabel}> | </Text> : null}
          </Text>
        ))}
      </Box>
      {showHelp ? (
        <Text color={PALETTE.bodyText} dimColor>
          Arrows move the selection · a cycles scope (user / system / daemon) · q quits
        </Text>
      ) : null}
    </Box>
  );
}
