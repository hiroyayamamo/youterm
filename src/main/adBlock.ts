import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { adsAndTrackingLists } from '@ghostery/adblocker'
import type { Session } from 'electron'

export interface AdBlockController {
  setEnabled(enabled: boolean): Promise<void>
  dispose(): void
}

export async function createAdBlockController(session: Session): Promise<AdBlockController> {
  let blocker: ElectronBlocker | null = null
  try {
    // Cosmetic filters need session.registerPreloadScript (Electron 35+).
    // We're on Electron 32, so network filters only — plenty to block
    // googleads.g.doubleclick.net and friends.
    blocker = await ElectronBlocker.fromLists(fetch, adsAndTrackingLists, {
      loadCosmeticFilters: false,
      loadNetworkFilters: true,
    })
  } catch (err) {
    console.error('[adBlock] failed to fetch filter lists; ad blocking disabled:', err)
  }

  let active = false

  const setEnabled = async (enabled: boolean): Promise<void> => {
    if (!blocker) return
    if (enabled === active) return
    try {
      if (enabled) {
        blocker.enableBlockingInSession(session)
      } else {
        blocker.disableBlockingInSession(session)
      }
      active = enabled
    } catch (err) {
      console.error('[adBlock] failed to toggle blocker:', err)
    }
  }

  return {
    setEnabled,
    dispose() {
      if (blocker && active) {
        try {
          blocker.disableBlockingInSession(session)
        } catch {}
      }
      active = false
    },
  }
}
