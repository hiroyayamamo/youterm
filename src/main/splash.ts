/**
 * Build the startup splash screen — ANSI-colored ASCII art of "youterm"
 * with version and author, displayed in each initial terminal tab.
 */
export function buildSplash(version: string): string {
  const GREEN = '\x1b[38;2;40;254;20m'
  const CYAN = '\x1b[38;2;0;221;255m'
  const DIM = '\x1b[2m'
  const RESET = '\x1b[0m'
  const BOLD = '\x1b[1m'

  const art = [
    "                    _                       ",
    " _   _  ___  _   _ | |_  ___  _ __ _ __ ___ ",
    "| | | |/ _ \\| | | || __|/ _ \\| '__| '_ ` _ \\ ",
    "| |_| | (_) | |_| || |_|  __/| |  | | | | | |",
    " \\__, |\\___/ \\__,_| \\__|\\___||_|  |_| |_| |_|",
    " |___/                                        ",
  ].join('\r\n')

  const tagline = `${GREEN}v${version}${RESET}${DIM}  —  ${RESET}${CYAN}${BOLD}by Hiroya Yamamoto${RESET}`

  return (
    '\r\n' +
    `${GREEN}${BOLD}${art}${RESET}` +
    '\r\n\r\n' +
    `  ${tagline}` +
    '\r\n\r\n'
  )
}
