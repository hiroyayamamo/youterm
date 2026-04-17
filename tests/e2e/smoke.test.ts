import { test, expect, _electron as electron } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('app launches cleanly and stays alive', async () => {
  const electronApp = await electron.launch({
    args: [resolve(__dirname, '../../out/main/index.js')],
  })

  // Wait for the main window to be created before asserting count.
  await electronApp.firstWindow()
  const windows = electronApp.windows()
  expect(windows.length).toBeGreaterThanOrEqual(1)

  // Wait 3 seconds to ensure the app doesn't crash during startup
  await new Promise(r => setTimeout(r, 3000))
  expect(electronApp.process().exitCode).toBeNull()

  await electronApp.close()
})
