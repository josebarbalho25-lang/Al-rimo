#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  gerar-icones.js — os ícones do programa e do arquivo .alrimo, da logomarca
// ---------------------------------------------------------------------------
//    node ferramentas/gerar-icones.js
//      app/public/marca/icone.svg → gerado/icones/icon.ico (16…256) + icon-N.png
//                                 → gerado/icones/arquivo-alrimo.ico (ícone do .alrimo)
//
//  O desenho tem UM lugar só: app/public/marca/icone.svg (que repete
//  app/src/ui/Marca.tsx; o marca.test.ts confere). Ninguém redesenha ícone à
//  mão. Quem pinta é o Chromium do próprio Electron (como no Pró-Viga,
//  _tools/gerar-icone.js), num canvas — o canal alfa sai intacto e os cantos
//  arredondados ficam transparentes.
//
//  Traço por tamanho, como o Marca.tsx manda: 7 no de 16 px, 6 no de 24, e o 5
//  do arquivo daí para cima — senão o traço some na barra de tarefas.
//
//  O ícone do arquivo é a folha (canto dobrado) com a marca dentro, montado
//  AQUI a partir do mesmo icone.svg.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const INSTALADOR = path.join(__dirname, '..');
const SVG = path.join(INSTALADOR, '..', 'app', 'public', 'marca', 'icone.svg');
const SAIDA = path.join(INSTALADOR, 'gerado', 'icones');
const NO_ICO = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const SOLTOS = [16, 32, 48, 64, 128, 256, 512, 1024];

/** A marca com o traço trocado (o resto do arquivo fica como está). */
function comTraco(svg, traco) {
  return svg.replace(/stroke-width="[\d.]+"/, `stroke-width="${traco}"`);
}
const tracoPara = (n) => (n <= 16 ? 7 : n <= 24 ? 6 : 5);

/** O conteúdo do icone.svg (o que está dentro do <svg>), sem os comentários. */
function miolo(svg) {
  return svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
}

/** A folha do arquivo, com a marca embaixo; em tamanho pequeno a marca cresce e o traço engrossa. */
function svgDoArquivo(svg, n) {
  const pequeno = n <= 32;
  const lado = pequeno ? 58 : 50;
  const x = 50 - lado / 2;
  const y = pequeno ? 34 : 38;
  const traco = n <= 16 ? 9 : n <= 32 ? 7 : 5;
  const marca = miolo(comTraco(svg, traco));
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 3 H64 L84 23 V97 H18 Z" fill="#FFFFFF" stroke="#6B7A99" stroke-width="${pequeno ? 3 : 2}" stroke-linejoin="round"/>
  <path d="M64 3 V23 H84" fill="#DDE3EE" stroke="#6B7A99" stroke-width="${pequeno ? 3 : 2}" stroke-linejoin="round"/>
  <g transform="translate(${x} ${y}) scale(${lado / 100})">${marca}</g>
</svg>`;
}

/* ── dentro do Electron: pinta os PNG ────────────────────────────────────── */
if (process.versions.electron) {
  const { app, BrowserWindow } = require('electron');
  const destino = process.env.ALRIMO_PNG_DIR;
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 200, height: 200, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadURL('data:text/html;charset=utf-8,<!doctype html><body></body>');
    const svg = fs.readFileSync(SVG, 'utf8');
    const pedidos = [];
    for (const n of new Set([...NO_ICO, ...SOLTOS])) pedidos.push({ nome: `icon-${n}`, n, svg: comTraco(svg, tracoPara(n)) });
    for (const n of NO_ICO) pedidos.push({ nome: `arquivo-${n}`, n, svg: svgDoArquivo(svg, n) });
    const script = `(async () => {
      const pedidos = ${JSON.stringify(pedidos)};
      const saida = {};
      for (const p of pedidos) {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(p.svg);
        await img.decode();
        const c = document.createElement('canvas');
        c.width = p.n; c.height = p.n;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, p.n, p.n);
        saida[p.nome] = c.toDataURL('image/png');
      }
      return saida;
    })()`;
    const png = await win.webContents.executeJavaScript(script, true);
    for (const [nome, url] of Object.entries(png)) {
      fs.writeFileSync(path.join(destino, `${nome}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    win.destroy();
    app.exit(0);
  });
  return;
}

/* ── fora do Electron: chama o Electron e costura os .ico ────────────────── */
async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alrimo-icones-'));
  const electron = require(path.join(INSTALADOR, 'node_modules', 'electron'));
  execFileSync(electron, [__filename], { cwd: INSTALADOR, stdio: 'inherit', env: { ...process.env, ALRIMO_PNG_DIR: tmp } });

  const mod = require(path.join(INSTALADOR, 'node_modules', 'png-to-ico'));
  const pngToIco = typeof mod === 'function' ? mod : mod.default;
  fs.mkdirSync(SAIDA, { recursive: true });

  const ico = await pngToIco(NO_ICO.map((n) => path.join(tmp, `icon-${n}.png`)));
  fs.writeFileSync(path.join(SAIDA, 'icon.ico'), ico);
  const icoArq = await pngToIco(NO_ICO.map((n) => path.join(tmp, `arquivo-${n}.png`)));
  fs.writeFileSync(path.join(SAIDA, 'arquivo-alrimo.ico'), icoArq);
  for (const n of SOLTOS) fs.copyFileSync(path.join(tmp, `icon-${n}.png`), path.join(SAIDA, `icon-${n}.png`));
  fs.copyFileSync(path.join(tmp, 'arquivo-256.png'), path.join(SAIDA, 'arquivo-alrimo-256.png'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`      ícones … icon.ico (${(ico.length / 1024).toFixed(0)} KB) e arquivo-alrimo.ico (${(icoArq.length / 1024).toFixed(0)} KB), ${NO_ICO.join(', ')} px`);
}

main().catch((e) => { console.error(`  ✗ ${e.message}`); process.exit(1); });
