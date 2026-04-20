/**
 * Build the startup splash screen — ANSI-colored ASCII art of "youterm"
 * with a small alien mascot and scattered stars.
 */
export function buildSplash(version: string): string {
  const GREEN = '\x1b[38;2;40;254;20m'
  const CYAN = '\x1b[38;2;0;221;255m'
  const DIM = '\x1b[2m'
  const RESET = '\x1b[0m'
  const BOLD = '\x1b[1m'

  // Colors for each visual element.
  const LOGO = (s: string): string => `${GREEN}${BOLD}${s}${RESET}`   // neon green, bold
  const ALIEN = (s: string): string => `${GREEN}${s}${RESET}`         // neon green, regular
  const GEM = `${CYAN}${BOLD}♦${RESET}`                               // cyan accent
  const STAR = (s: string): string => `${CYAN}${DIM}${s}${RESET}`     // dim cyan sparkle

  // Logo lines padded to a fixed width so the alien column lines up.
  const pad = (s: string): string => s.padEnd(47)

  const lines: string[] = [
    '',
    STAR('    ·   .   ✦   *   ·      °   .    *    ✦     ·    °      .   ✦   ·'),
    '',
    LOGO(pad('                    _                       ')) + '     ' + STAR('.'),
    LOGO(pad(' _   _  ___  _   _ | |_  ___  _ __ _ __ ___ ')) + '  ' + ALIEN('( •_• )') + '        ' + STAR('✦'),
    LOGO(pad("| | | |/ _ \\| | | || __|/ _ \\| '__| '_ ` _ \\ ")) + ' ' + ALIEN('/  ') + GEM + ALIEN('  \\') + '      ' + STAR('.'),
    LOGO(pad('| |_| | (_) | |_| || |_|  __/| |  | | | | | |')) + ' ' + ALIEN('=========') + '      ' + STAR('✦'),
    LOGO(pad(' \\__, |\\___/ \\__,_| \\__|\\___||_|  |_| |_| |_|')) + '   ' + ALIEN('|   |') + '          ' + STAR('·'),
    LOGO(pad(' |___/                                        ')) + ALIEN('(_)   (_)') + '     ' + STAR('.'),
    '',
    STAR('    ✦   ·    .    °    *    ·     ✦    .    *    ·     °     ✦    *   .'),
    '',
  ]

  const tagline = `${GREEN}v${version}${RESET}${DIM}  —  ${RESET}${CYAN}${BOLD}by Hiroya Yamamoto${RESET}`

  return (
    '\r\n' +
    lines.join('\r\n') +
    '\r\n' +
    `  ${tagline}` +
    '\r\n\r\n'
  )
}
