import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { adsLists } from '@ghostery/adblocker'
import type { Session } from 'electron'

export interface AdBlockController {
  setEnabled(enabled: boolean): Promise<void>
  dispose(): void
}

export async function createAdBlockController(session: Session): Promise<AdBlockController> {
  let blocker: ElectronBlocker | null = null
  try {
    // `adsLists` is deliberate: `adsAndTrackingLists` was breaking YouTube's
    // player (black iframe) because the privacy / tracking rules also catch
    // google-analytics and similar endpoints the player relies on. Cosmetic
    // filters need session.registerPreloadScript (Electron 35+), which we're
    // not on yet — network rules alone still handle googleads.g.doubleclick
    // and the DOM-level skip below mops up anything that leaks through.
    blocker = await ElectronBlocker.fromLists(fetch, adsLists, {
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
