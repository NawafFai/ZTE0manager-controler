'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Minimal, safe bridge for the "Set Router IP" prompt window only.
contextBridge.exposeInMainWorld('promptApi', {
  submit: (value) => ipcRenderer.send('prompt:submit', value),
  cancel: () => ipcRenderer.send('prompt:cancel'),
});
