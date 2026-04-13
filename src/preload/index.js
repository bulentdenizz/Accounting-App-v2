import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// İleride Cloud API'e çevrilecek olan veri iletişim katmanı
const api = {
  auth: {
    login: (credentials) => ipcRenderer.invoke('api:auth:login', credentials)
  },
  customers: {
    getAll: () => ipcRenderer.invoke('api:customers:getAll'),
    create: (data) => ipcRenderer.invoke('api:customers:create', data),
    update: (data) => ipcRenderer.invoke('api:customers:update', data),
    delete: (id) => ipcRenderer.invoke('api:customers:delete', id)
  },
  items: {
    getAll: () => ipcRenderer.invoke('api:items:getAll'),
    create: (data) => ipcRenderer.invoke('api:items:create', data),
    update: (data) => ipcRenderer.invoke('api:items:update', data),
    delete: (id) => ipcRenderer.invoke('api:items:delete', id)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
