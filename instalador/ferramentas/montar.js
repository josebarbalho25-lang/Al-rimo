#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  montar.js — monta o instalador do Al-rimo (.exe do Windows)
// ---------------------------------------------------------------------------
//    node ferramentas/montar.js                 instalador completo (npm run dist)
//    node ferramentas/montar.js --pasta         só a pasta, sem instalador (npm run dist:dir)
//    node ferramentas/montar.js --sem-app       não remonta o app (usa o app/dist que já existe)
//    node ferramentas/montar.js --so-preparar   só copia/gera o que o "npm start" precisa
//
//  A receita é a do Pró-Viga (_tools/build-instalador.js de lá), sem licença
//  nem blindagem — o Al-rimo é gratuito (15/11). A ordem:
//    1. CONFERE  — versão, termo, imagens do splash, marca. Erro aqui para.
//    2. O APP    — "npm run build" em app/ (o mesmo build do navegador) e a
//                  cópia de app/dist para gerado/app.
//    3. GERA     — ícones (da marca) e a folha do termo (do TERMO_DE_USO.md).
//    4. EMPACOTA — electron-builder, alvo NSIS, com a versão de app/package.json.
//  Tudo o que sai em gerado/ é refeito a cada montagem e fica fora do git.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const INSTALADOR = path.join(__dirname, '..');
const RAIZ = path.join(INSTALADOR, '..');
const APP = path.join(RAIZ, 'app');
const GERADO = path.join(INSTALADOR, 'gerado');

const args = process.argv.slice(2);
const soPasta = args.includes('--pasta');
const semApp = args.includes('--sem-app');
const soPreparar = args.includes('--so-preparar');

const passo = (n, txt) => console.log(`\n[${n}/4] ${txt}`);
function erro(txt) { console.error(`\n  ✗ ${txt}\n`); process.exit(1); }
const naRaiz = (rel) => path.join(RAIZ, rel);

/* O npm do Windows é um .cmd: sem o shell ele não roda. */
function npm(argumentos, cwd) {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', argumentos, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}

/* A PEDRA DO WINDOWS (achada no Pró-Viga): o pacote de assinatura que o
   electron-builder baixa traz dois atalhos de uma pasta do macOS, e o Windows
   só cria atalho com administrador — a extração inteira falha por causa
   deles. O pacote fica no cache: extrai de novo sem a pasta do macOS. */
function preparaFerramentaDeAssinatura() {
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  const pronto = path.join(cache, 'winCodeSign-2.6.0');
  if (!process.env.LOCALAPPDATA || fs.existsSync(pronto)) return;
  let sobras;
  try { sobras = fs.readdirSync(cache).filter((f) => f.toLowerCase().endsWith('.7z')); } catch (_) { return; }
  if (!sobras.length) return;
  const zip7 = path.join(INSTALADOR, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
  if (!fs.existsSync(zip7)) return;
  try {
    execFileSync(zip7, ['x', '-bso0', '-bsp0', '-y', `-o${pronto}`, path.join(cache, sobras[0]), '-x!darwin']);
    console.log('      ferramenta de assinatura … remontada sem os atalhos do macOS');
    sobras.forEach((f) => { try { fs.rmSync(path.join(cache, f)); } catch (_) { /* fica */ } });
  } catch (_) { try { fs.rmSync(pronto, { recursive: true, force: true }); } catch (__) { /* fica */ } }
}

function copiarPasta(de, para) {
  fs.rmSync(para, { recursive: true, force: true });
  fs.cpSync(de, para, { recursive: true });
}

function main() {
  /* ── 1. confere ──────────────────────────────────────────────────────── */
  passo(1, 'Conferindo o que o pacote precisa…');
  if (!fs.existsSync(path.join(INSTALADOR, 'node_modules', 'electron'))) {
    erro('faltam as ferramentas do instalador. Rode, uma vez:  cd instalador  e  npm install');
  }
  const versao = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+/.test(versao || '')) erro(`app/package.json sem versão válida (${versao})`);
  const obrigatorios = [
    'TERMO_DE_USO.md',
    'app/public/marca/icone.svg',
    'dados/produto/splash/splash-bg1.png',
    'dados/produto/splash/splash-bg2.png',
    'dados/produto/splash/splash-bg3.png',
  ];
  for (const rel of obrigatorios) if (!fs.existsSync(naRaiz(rel))) erro(`falta ${rel}`);
  console.log(`      versão do programa ….. ${versao} (de app/package.json)`);

  /* ── 2. o app ────────────────────────────────────────────────────────── */
  const dist = path.join(APP, 'dist');
  if (soPreparar || semApp) {
    passo(2, 'App: usando o app/dist que já existe…');
  } else {
    passo(2, 'Montando o app (npm run build em app/)…');
    if (!fs.existsSync(path.join(APP, 'node_modules'))) npm(['install', '--no-audit', '--no-fund'], APP);
    npm(['run', 'build'], APP);
  }
  if (!fs.existsSync(path.join(dist, 'index.html'))) erro('app/dist não existe: rode  npm run build  em app/  (ou tire o --sem-app)');
  copiarPasta(dist, path.join(GERADO, 'app'));
  const splash = path.join(GERADO, 'splash');
  fs.mkdirSync(splash, { recursive: true });
  for (const n of [1, 2, 3]) fs.copyFileSync(naRaiz(`dados/produto/splash/splash-bg${n}.png`), path.join(splash, `splash-bg${n}.png`));
  console.log('      app/dist → gerado/app; imagens do splash → gerado/splash');

  /* ── 3. gera ─────────────────────────────────────────────────────────── */
  passo(3, 'Gerando ícones e a folha do termo…');
  execFileSync(process.execPath, [path.join(__dirname, 'gerar-icones.js')], { cwd: INSTALADOR, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(__dirname, 'gerar-termo.js')], { cwd: INSTALADOR, stdio: 'inherit' });
  if (soPreparar) return;

  /* ── 4. empacota ─────────────────────────────────────────────────────── */
  passo(4, soPasta ? 'Empacotando (só a pasta)…' : 'Empacotando o instalador…');
  const builder = path.join(INSTALADOR, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
  const argv = ['--win', '--x64', '--publish', 'never', `-c.extraMetadata.version=${versao}`];
  if (soPasta) argv.push('--dir');
  preparaFerramentaDeAssinatura();
  try {
    execFileSync(builder, argv, { cwd: INSTALADOR, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch (_) {
    erro('o electron-builder parou (a mensagem dele está acima).\n'
      + '    Se ela fala em "Cannot create symbolic link": rode de novo — o pacote já ficou no cache e se conserta sozinho.');
  }

  const saida = path.join(INSTALADOR, 'dist');
  const exe = path.join(saida, `Al-rimo-Setup-${versao}.exe`);
  console.log('');
  if (soPasta) console.log(`  ✓ pasta pronta: ${path.join(saida, 'win-unpacked', 'Al-rimo.exe')}`);
  else if (fs.existsSync(exe)) console.log(`  ✓ ${exe}  —  ${(fs.statSync(exe).size / 1024 / 1024).toFixed(1)} MB`);
  else erro(`o instalador não apareceu em ${saida}`);
  console.log('');
}

main();
