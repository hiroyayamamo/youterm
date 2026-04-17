import { describe, it, expect, vi } from 'vitest'
import { createPtyHandle, type PtySpawn, type IPtyLike } from '../../src/main/pty'

const makeFakePty = (): IPtyLike & {
  _dataHandler?: (data: string) => void
  _exitHandler?: () => void
  _written: string[]
  _resized: Array<{ cols: number; rows: number }>
  _killed: boolean
} => {
  const fake = {
    _dataHandler: undefined as ((data: string) => void) | undefined,
    _exitHandler: undefined as (() => void) | undefined,
    _written: [] as string[],
    _resized: [] as Array<{ cols: number; rows: number }>,
    _killed: false,
    onData(cb: (data: string) => void) {
      fake._dataHandler = cb
      return { dispose() {} }
    },
    onExit(cb: () => void) {
      fake._exitHandler = cb
      return { dispose() {} }
    },
    write(data: string) {
      fake._written.push(data)
    },
    resize(cols: number, rows: number) {
      fake._resized.push({ cols, rows })
    },
    kill() {
      fake._killed = true
    },
  }
  return fake
}

describe('createPtyHandle', () => {
  it('spawns zsh with login flag and home cwd', () => {
    const fake = makeFakePty()
    const spawn: PtySpawn = vi.fn(() => fake)
    createPtyHandle({ spawn, cwd: '/Users/test', env: { PATH: '/bin' } })
    expect(spawn).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-l'],
      expect.objectContaining({
        cwd: '/Users/test',
        env: expect.objectContaining({ PATH: '/bin', TERM: 'xterm-256color', COLORTERM: 'truecolor' }),
      }),
    )
  })

  it('forwards pty data to onData subscribers', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    const received: string[] = []
    handle.onData(d => received.push(d))
    fake._dataHandler?.('hello\n')
    expect(received).toEqual(['hello\n'])
  })

  it('forwards write calls to underlying pty', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    handle.write('ls\n')
    expect(fake._written).toEqual(['ls\n'])
  })

  it('forwards resize calls', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    handle.resize(100, 40)
    expect(fake._resized).toEqual([{ cols: 100, rows: 40 }])
  })

  it('kill() terminates the pty', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    handle.kill()
    expect(fake._killed).toBe(true)
  })

  it('onData returns an unsubscriber that removes the handler', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    const received: string[] = []
    const unsubscribe = handle.onData(d => received.push(d))
    fake._dataHandler?.('first\n')
    unsubscribe()
    fake._dataHandler?.('second\n')
    expect(received).toEqual(['first\n'])
  })

  it('onExit forwards pty exit events to subscribers', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    let exited = 0
    handle.onExit(() => { exited++ })
    fake._exitHandler?.()
    expect(exited).toBe(1)
  })

  it('onExit returns an unsubscriber that removes the handler', () => {
    const fake = makeFakePty()
    const handle = createPtyHandle({ spawn: () => fake, cwd: '/', env: {} })
    let exited = 0
    const unsubscribe = handle.onExit(() => { exited++ })
    unsubscribe()
    fake._exitHandler?.()
    expect(exited).toBe(0)
  })
})
