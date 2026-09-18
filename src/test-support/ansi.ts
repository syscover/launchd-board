/**
 * Test-support only: helpers for asserting on the real ANSI SGR sequences
 * Ink/chalk emit under FORCE_COLOR=3 (set in the `test` npm script). Nothing
 * here is imported by application code.
 */

const ANSI_SGR_PATTERN = /\x1b\[[0-9;]*m/g;

/** Removes every SGR escape sequence, leaving only the visible text. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_SGR_PATTERN, '');
}

/**
 * The truecolor (24-bit) foreground SGR sequence chalk emits for a hex
 * color, built from the decimal RGB triple — verified empirically against a
 * real Ink render under FORCE_COLOR=3. Tests should pass in the RGB values
 * from the palette SPEC directly, not a constant re-imported from
 * `palette.ts` — that would assert the wiring, never the value.
 */
export function foregroundAnsi(red: number, green: number, blue: number): string {
  return `\x1b[38;2;${red};${green};${blue}m`;
}

/** chalk's inverse-video start/end SGR codes. */
export const INVERSE_START = '\x1b[7m';
export const INVERSE_END = '\x1b[27m';
