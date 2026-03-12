const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('neolutionDesktop', {
  platform: process.platform,
  isDesktop: true
});
