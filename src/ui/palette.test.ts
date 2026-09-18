import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JOB_DOMAIN } from '../launchd/types.js';
import { borderColorForFocus, DOMAIN_GLYPH, DOMAIN_LABEL, PALETTE } from './palette.js';

test('borderColorForFocus picks the amber focused border when focused', () => {
  assert.equal(borderColorForFocus(true), PALETTE.borderPanelFocused);
});

test('borderColorForFocus picks the slate unfocused border otherwise', () => {
  assert.equal(borderColorForFocus(false), PALETTE.borderPanelUnfocused);
});

test('DOMAIN_GLYPH has one glyph per job domain', () => {
  assert.equal(DOMAIN_GLYPH[JOB_DOMAIN.USER], '○');
  assert.equal(DOMAIN_GLYPH[JOB_DOMAIN.SYSTEM], '◐');
  assert.equal(DOMAIN_GLYPH[JOB_DOMAIN.DAEMON], '●');
});

test('DOMAIN_LABEL has a human-readable name per job domain', () => {
  assert.equal(DOMAIN_LABEL[JOB_DOMAIN.USER], 'User agents');
  assert.equal(DOMAIN_LABEL[JOB_DOMAIN.SYSTEM], 'System agents');
  assert.equal(DOMAIN_LABEL[JOB_DOMAIN.DAEMON], 'Daemons');
});
