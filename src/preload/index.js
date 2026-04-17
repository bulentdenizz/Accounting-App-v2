import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// İleride Cloud API'e çevrilecek olan veri iletişim katmanı
const api = {
  auth: {
    login: (credentials) => ipcRenderer.invoke('api:auth:login', credentials),
    createUser: (payload) => ipcRenderer.invoke('api:auth:createUser', payload)
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
    delete: (id) => ipcRenderer.invoke('api:items:delete', id),
    bulkUpdatePrice: (data) => ipcRenderer.invoke('api:items:bulkUpdatePrice', data)
  },
  inventory: {
    getMovements: (params) => ipcRenderer.invoke('api:inventory:getMovements', params),
    adjustStock: (data) => ipcRenderer.invoke('api:inventory:adjustStock', data)
  },
  transactions: {
    getAll: () => ipcRenderer.invoke('api:transactions:getAll'),
    getPage: (params) => ipcRenderer.invoke('api:transactions:getPage', params),
    getItems: (id) => ipcRenderer.invoke('api:transactions:getItems', id),
    getOpenDocuments: (payload) => ipcRenderer.invoke('api:transactions:getOpenDocuments', payload),
    getDueList: () => ipcRenderer.invoke('api:transactions:getDueList'),
    getStatementByEntity: (entityId) => ipcRenderer.invoke('api:transactions:getStatementByEntity', entityId),
    create: (data) => ipcRenderer.invoke('api:transactions:create', data),
    update: (data) => ipcRenderer.invoke('api:transactions:update', data),
    delete: (id) => ipcRenderer.invoke('api:transactions:delete', id)
  },
  dashboard: {
    getStats: () => ipcRenderer.invoke('api:dashboard:getStats')
  },
  reports: {
    getStats: (dateRange) => ipcRenderer.invoke('api:reports:getStats', dateRange),
    getInventoryValue: () => ipcRenderer.invoke('api:reports:getInventoryValue')
  },
  settings: {
    getAll: () => ipcRenderer.invoke('api:settings:getAll'),
    update: (settings) => ipcRenderer.invoke('api:settings:update', settings)
  },
  pdf: {
    generate: (invoice) => ipcRenderer.invoke('api:pdf:generate', invoice)
  },
  system: {
    createBackup: () => ipcRenderer.invoke('api:system:createBackup'),
    restoreBackup: () => ipcRenderer.invoke('api:system:restoreBackup'),
    reconcileLedger: () => ipcRenderer.invoke('api:system:reconcileLedger')
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
