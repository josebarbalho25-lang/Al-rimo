'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// A versão vem do main (que a lê de app/package.json): uma fonte só.
const arg = process.argv.find((a) => a.startsWith('--alrimo-versao='));

contextBridge.exposeInMainWorld('splashPonte', {
  versao: arg ? arg.slice('--alrimo-versao='.length) : '',
  // O main avisa que a janela principal desenhou o app.
  aoAppPronto: (cb) => ipcRenderer.on('splash:app-pronto', () => cb()),
  // O splash terminou a barra e o esmaecer: pode mostrar o programa.
  fim: () => ipcRenderer.send('splash:fim'),
});
