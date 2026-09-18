/**
 * The visual palette: muted, desaturated hex colors (never loud ANSI
 * green/red/cyan), plus the per-domain glyph/label pairs used in the panel
 * title. Pure constants — no Ink imports.
 */

import { JOB_DOMAIN } from '../launchd/types.js';
import type { JobDomain } from '../launchd/types.js';

export const PALETTE = {
  borderTopBar: '#56b6c2', // teal
  borderPanelFocused: '#d19a66', // amber — the single panel is always focused in v1
  borderPanelUnfocused: '#4b5263', // slate — reserved for a future multi-panel layout
  panelTitle: '#ffffff', // white, bold
  primaryText: '#ffffff', // white, bold — the job label
  secondaryTag: '#c678dd', // muted lavender — domain, trigger
  bodyText: '#abb2bf', // light gray
  keyHint: '#c678dd', // muted lavender — footer key names
  footerLabel: '#abb2bf', // light gray — footer descriptions
  stateRunning: '#98c379', // desaturated green
  stateDisabled: '#e06c75', // desaturated red
} as const;

/**
 * Which border color a panel gets. v1 has exactly one panel and it is
 * always the focused one (there is nothing else to tab between), but the
 * branch is real — not dead code — so a future second panel just works.
 */
export function borderColorForFocus(isFocused: boolean): string {
  return isFocused ? PALETTE.borderPanelFocused : PALETTE.borderPanelUnfocused;
}

export const DOMAIN_GLYPH: Record<JobDomain, string> = {
  [JOB_DOMAIN.USER]: '○',
  [JOB_DOMAIN.SYSTEM]: '◐',
  [JOB_DOMAIN.DAEMON]: '●',
};

export const DOMAIN_LABEL: Record<JobDomain, string> = {
  [JOB_DOMAIN.USER]: 'User agents',
  [JOB_DOMAIN.SYSTEM]: 'System agents',
  [JOB_DOMAIN.DAEMON]: 'Daemons',
};
