import { contextBridge, ipcRenderer } from 'electron'
import type { AppState } from '../shared/types'

type StateHandler = (s: AppState) => void
type DataHandler = (d: string) => void

const stateHandlers = new Set<StateHandler>()
const dataHandlers = new Set<DataHandler>()

ipcRenderer.on('state:changed', (_e, state: AppState) => {
  for (const h of stateHandlers) h(state)
})
ipcRenderer.on('pty:data', (_e, data: string) => {
  for (const h of dataHandlers) h(data)
})

contextBridge.exposeInMainWorld('youtermAPI', {
  onStateChanged(cb: StateHandler) {
    stateHandlers.add(cb)
    return () => stateHandlers.delete(cb)
  },
  onPtyData(cb: DataHandler) {
    dataHandlers.add(cb)
    return () => dataHandlers.delete(cb)
  },
  ptyWrite(data: string) {
    ipcRenderer.send('pty:write', data)
  },
  ptyResize(size: { cols: number; rows: number }) {
    ipcRenderer.send('pty:resize', size)
  },
})
