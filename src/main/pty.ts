export interface IPtyLike {
  onData(cb: (data: string) => void): { dispose(): void }
  onExit(cb: () => void): { dispose(): void }
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface PtySpawnOptions {
  cwd: string
  env: NodeJS.ProcessEnv
  cols?: number
  rows?: number
}

export type PtySpawn = (
  shell: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    cols: number
    rows: number
    name: string
  },
) => IPtyLike

export interface PtyHandle {
  onData(cb: (data: string) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}

export interface CreatePtyOptions {
  spawn: PtySpawn
  cwd: string
  env: NodeJS.ProcessEnv
  cols?: number
  rows?: number
}

export function createPtyHandle(opts: CreatePtyOptions): PtyHandle {
  const cols = opts.cols ?? 120
  const rows = opts.rows ?? 30
  const pty = opts.spawn('/bin/zsh', ['-l'], {
    cwd: opts.cwd,
    env: {
      ...opts.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
    cols,
    rows,
    name: 'xterm-256color',
  })

  const dataHandlers: Array<(data: string) => void> = []
  pty.onData(data => {
    for (const h of dataHandlers) h(data)
  })

  return {
    onData(cb) {
      dataHandlers.push(cb)
    },
    write(data) {
      pty.write(data)
    },
    resize(cols, rows) {
      pty.resize(cols, rows)
    },
    kill() {
      pty.kill()
    },
  }
}

export async function createRealPtySpawn(): Promise<PtySpawn> {
  const nodePty = await import('node-pty')
  return (shell, args, options) =>
    nodePty.spawn(shell, args, {
      cwd: options.cwd,
      env: options.env as Record<string, string>,
      cols: options.cols,
      rows: options.rows,
      name: options.name,
    }) as unknown as IPtyLike
}
