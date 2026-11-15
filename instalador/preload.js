// ═══════════════════════════════════════════════════════════════════════════
//  preload.js — a ponte entre o app e o programa instalado
// ---------------------------------------------------------------------------
//  Só isto atravessa. O app (app/src/estado/programa.ts) procura
//  window.alrimoPrograma: achou, usa o disco pelos diálogos do Windows; não
//  achou (navegador), segue pelo caminho de sempre. Nada de Node no app.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alrimoPrograma', {
  abrirProjeto: () => ipcRenderer.invoke('arquivo:abrir-projeto'),
  escolherDestino: (nomeSugerido) => ipcRenderer.invoke('arquivo:escolher-destino', nomeSugerido),
  lerArquivo: (caminho) => ipcRenderer.invoke('arquivo:ler', caminho),
  gravarArquivo: (caminho, texto) => ipcRenderer.invoke('arquivo:gravar', caminho, texto),
  gravarPdf: (nomeSugerido) => ipcRenderer.invoke('arquivo:gravar-pdf', nomeSugerido),

  // Duplo clique num .alrimo, "Abrir com", ou o arquivo dado a uma 2ª cópia do programa.
  aoAbrirArquivo: (cb) => { ipcRenderer.on('programa:abrir-arquivo', (_e, a) => cb(a)); },
  // O app está de pé e pode receber os arquivos que chegaram antes dele.
  pronto: () => ipcRenderer.send('programa:pronto'),

  // O • de alteração e o nome do muro (título da janela e a pergunta ao fechar).
  informarEstado: (e) => ipcRenderer.send('programa:estado', e),
  aoPedirSalvarEFechar: (cb) => { ipcRenderer.on('programa:salvar-e-fechar', () => cb()); },
  fechar: () => ipcRenderer.send('programa:fechar'),
});
