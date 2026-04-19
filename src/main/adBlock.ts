import type { Session } from 'electron'

export interface AdBlockController {
  setEnabled(enabled: boolean): Promise<void>
  dispose(): void
}

// v0.14.2 bisect: adblocker-electron fully disabled to isolate freeze cause.
// The controller is preserved so the rest of the app (settings toggle, IPC,
// subscribe callbacks) keeps working; setEnabled is a no-op here.
export async function createAdBlockController(_session: Session): Promise<AdBlockController> {
  return {
    async setEnabled(_enabled: boolean): Promise<void> {},
    dispose() {},
  }
}
