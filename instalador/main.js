// ═══════════════════════════════════════════════════════════════════════════
//  main.js — o Al-rimo como programa instalado (Electron)
// ---------------------------------------------------------------------------
//  A receita é a do Pró-Viga 3D (splash → janela principal, sem menu, arquivo
//  por diálogo nativo, associação de arquivo), sem nada de licença: o Al-rimo
//  é gratuito (decisão de 15/11). O app de dentro é o MESMO do navegador — o
//  build de produção de app/ (app/dist, copiado para gerado/app pelo
//  montar.js). Este arquivo só dá a ele o que o navegador dava: endereço,
//  disco, impressão e janela.
//
//  Variáveis de ambiente (para conferir o pacote, nunca para o usuário):
//    ALRIMO_DIAGNOSTICO=arquivo.log  grava console, falhas de carga e arquivos
//    ALRIMO_TESTE_SAIDA=pasta        os diálogos de salvar respondem sozinhos
//                                    (pasta + nome sugerido) e o PDF não abre
//    ALRIMO_TESTE_ABRIR=arq.alrimo   o diálogo de abrir responde este arquivo
//    ALRIMO_DEVTOOLS=1               F12 abre as ferramentas do Chromium
//    ALRIMO_PERFIL=pasta             perfil separado (termo, preferências, último muro)
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const NOME = 'Al-rimo';
const ESQUEMA = 'app';
const HOST = 'alrimo';
const ORIGEM = `${ESQUEMA}://${HOST}`;
const EXTENSAO = '.alrimo';

/*
  A VERSÃO TEM UM DONO SÓ: app/package.json (é a que o memorial imprime). No
  pacote o montar.js a injeta no package.json daqui (extraMetadata), e
  app.getVersion() devolve ela; rodando da bancada, lê direto do app.
*/
function versaoDoPrograma() {
  if (app.isPackaged) return app.getVersion();
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'package.json'), 'utf8')).version;
  } catch (_) {
    return app.getVersion();
  }
}

/* O id do Windows (barra de tarefas, atalhos) vem do pacote: a variante de
   conferência ("Al-rimo Teste", montar.js --teste) não pode se agrupar com o
   programa de verdade nem herdar os atalhos fixados dele. */
function idDoPrograma() {
  try { return require('./package.json').idDoPrograma || 'com.jbarbalho.alrimo'; } catch (_) { return 'com.jbarbalho.alrimo'; }
}

const RAIZ_DO_APP = path.join(__dirname, 'gerado', 'app');
const ICONE = path.join(__dirname, 'gerado', 'icones', 'icon.ico');

const TESTE_SAIDA = process.env.ALRIMO_TESTE_SAIDA || '';
const TESTE_ABRIR = process.env.ALRIMO_TESTE_ABRIR || '';
const DIAGNOSTICO = process.env.ALRIMO_DIAGNOSTICO || '';
const FERRAMENTAS = !app.isPackaged || process.env.ALRIMO_DEVTOOLS === '1';

// Conferência de "primeira abertura" sem apagar o perfil de verdade (%APPDATA%\Al-rimo).
if (process.env.ALRIMO_PERFIL) app.setPath('userData', process.env.ALRIMO_PERFIL);

/* ── diagnóstico (só com a variável) ─────────────────────────────────────── */

function anotar(...partes) {
  if (!DIAGNOSTICO) return;
  const linha = `${new Date().toISOString()} ${partes.join(' ')}\n`;
  try { fs.appendFileSync(DIAGNOSTICO, linha, 'utf8'); } catch (_) { /* sem disco, sem diagnóstico */ }
}

/* ── o endereço do app: app://alrimo/ ────────────────────────────────────────
   O app foi feito para morar na raiz de um servidor ("/pecas/…", "/figuras/…",
   fetch de terceiros.txt, módulos ES). Abrir o index.html por file:// quebraria
   tudo isso (o fetch não lê file://, e "/pecas" viraria C:\pecas). Um esquema
   próprio, "padrão e seguro", é a raiz que o app espera: nada no app muda, e o
   localStorage (termo aceito, preferências, último muro) tem uma origem fixa. */

protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

/* Os componentes de terceiros do app (public/terceiros.txt) não sabem que vão
   dentro do Electron; o aviso dele (MIT, e o do Chromium que viaja ao lado do
   executável) entra no fim do mesmo arquivo, só no programa instalado. */
function avisoDoElectron() {
  const pasta = path.dirname(process.execPath);
  let licenca = '';
  for (const nome of ['LICENSE.electron.txt', 'LICENSE']) {
    try { licenca = fs.readFileSync(path.join(pasta, nome), 'utf8'); break; } catch (_) { /* próximo */ }
  }
  return [
    '',
    '='.repeat(78),
    'PROGRAMA INSTALADO',
    '='.repeat(78),
    '',
    `electron ${process.versions.electron} — MIT`,
    `Chromium ${process.versions.chrome} e Node.js ${process.versions.node} vão dentro do Electron.`,
    'Avisos de licença do Chromium: arquivo LICENSES.chromium.html na pasta do programa',
    `(${pasta}).`,
    '',
    licenca.trim(),
    '',
  ].join('\n');
}

async function servir(pedido) {
  const url = new URL(pedido.url);
  if (url.host !== HOST) return new Response('', { status: 404 });
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const arquivo = path.normalize(path.join(RAIZ_DO_APP, rel));
  if (!arquivo.startsWith(RAIZ_DO_APP + path.sep)) {
    anotar('[app://] fora da raiz:', rel);
    return new Response('', { status: 403 });
  }
  try {
    let corpo = await fs.promises.readFile(arquivo);
    if (rel === '/terceiros.txt') corpo = Buffer.concat([corpo, Buffer.from(avisoDoElectron(), 'utf8')]);
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
    return new Response(corpo, { status: 200, headers: { 'Content-Type': tipo, 'Cache-Control': 'no-cache' } });
  } catch (_) {
    anotar('[app://] 404', rel);
    return new Response('', { status: 404 });
  }
}

/* ── preferências da máquina (tamanho da janela, última pasta) ───────────── */

const ARQ_PREFS = () => path.join(app.getPath('userData'), 'programa.json');
let prefs = { janela: null, pasta: null };

function lerPrefs() {
  try { prefs = { ...prefs, ...JSON.parse(fs.readFileSync(ARQ_PREFS(), 'utf8')) }; } catch (_) { /* primeira vez */ }
}
function gravarPrefs() {
  try { fs.writeFileSync(ARQ_PREFS(), JSON.stringify(prefs, null, 2), 'utf8'); } catch (_) { /* sem disco: paciência */ }
}
function lembrarPasta(arquivo) {
  prefs.pasta = path.dirname(arquivo);
  gravarPrefs();
}
function pastaInicial() {
  if (prefs.pasta && fs.existsSync(prefs.pasta)) return prefs.pasta;
  return app.getPath('documents');
}

/* A janela volta onde estava — mas só se ainda couber numa tela que existe
   (o notebook que perdeu o monitor de fora abriria a janela no vazio). */
function lugarDaJanela() {
  const padrao = { width: 1440, height: 900 };
  const j = prefs.janela;
  if (!j || !Number.isFinite(j.width) || !Number.isFinite(j.height)) return padrao;
  const area = screen.getDisplayMatching({ x: j.x ?? 0, y: j.y ?? 0, width: j.width, height: j.height }).workArea;
  const cabe = Number.isFinite(j.x) && Number.isFinite(j.y)
    && j.x < area.x + area.width - 100 && j.y < area.y + area.height - 100
    && j.x + j.width > area.x + 100 && j.y >= area.y - 10;
  const w = Math.min(j.width, area.width);
  const h = Math.min(j.height, area.height);
  return cabe ? { x: j.x, y: j.y, width: w, height: h } : { width: w, height: h };
}
function guardarLugar(win) {
  if (!win || win.isDestroyed()) return;
  const maximizada = win.isMaximized();
  const b = maximizada ? (prefs.janela || win.getNormalBounds()) : win.getNormalBounds();
  prefs.janela = { x: b.x, y: b.y, width: b.width, height: b.height, maximizada };
  gravarPrefs();
}

/* ── diálogos (com resposta automática no modo de teste) ─────────────────── */

const FILTROS = {
  '.alrimo': { name: 'Muro do Al-rimo', extensions: ['alrimo'] },
  '.ifc': { name: 'Modelo IFC', extensions: ['ifc'] },
  '.csv': { name: 'Planilha CSV', extensions: ['csv'] },
  '.doc': { name: 'Documento do Word', extensions: ['doc'] },
  '.zip': { name: 'Pacote ZIP', extensions: ['zip'] },
  '.dxf': { name: 'Desenho DXF', extensions: ['dxf'] },
  '.svg': { name: 'Imagem SVG', extensions: ['svg'] },
  '.png': { name: 'Imagem PNG', extensions: ['png'] },
  '.pdf': { name: 'PDF', extensions: ['pdf'] },
};

function filtrosPara(nome) {
  const f = FILTROS[path.extname(nome).toLowerCase()];
  return f ? [f, { name: 'Todos os arquivos', extensions: ['*'] }] : [{ name: 'Todos os arquivos', extensions: ['*'] }];
}

/** Onde gravar. null = desistiu. */
async function perguntarOndeGravar(win, nomeSugerido, titulo) {
  const nome = path.basename(nomeSugerido || 'arquivo');
  if (TESTE_SAIDA) {
    fs.mkdirSync(TESTE_SAIDA, { recursive: true });
    return path.join(TESTE_SAIDA, nome);
  }
  const r = await dialog.showSaveDialog(win, {
    title: titulo,
    defaultPath: path.join(pastaInicial(), nome),
    filters: filtrosPara(nome),
  });
  if (r.canceled || !r.filePath) return null;
  lembrarPasta(r.filePath);
  return r.filePath;
}

/* ── janelas ─────────────────────────────────────────────────────────────── */

let splash = null;
let principal = null;
let podeFechar = false;     // o usuário já respondeu à pergunta das alterações
let estado = { sujo: false, titulo: '' };
let rendererPronto = false;
const pendentes = [];       // .alrimo pedidos antes de o app estar de pé

function criarSplash() {
  splash = new BrowserWindow({
    width: 987,
    height: 610,
    frame: false,
    resizable: false,
    movable: true,
    center: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#07080D',
    icon: ICONE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'splash-preload.js'),
      additionalArguments: [`--alrimo-versao=${versaoDoPrograma()}`],
    },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash && splash.show());
  splash.on('closed', () => { splash = null; });
}

function mostrarPrincipal() {
  if (splash && !splash.isDestroyed()) splash.close();
  if (!principal || principal.isDestroyed()) return;
  if (prefs.janela && prefs.janela.maximizada) principal.maximize();
  principal.show();
  principal.focus();
  anotar('[janela] principal visível');
  // um respiro para o primeiro quadro do app chegar à tela antes de qualquer pergunta
  setTimeout(entregarPendentes, 150);
}

function tituloDaJanela() {
  const t = estado.titulo ? `${estado.titulo}${estado.sujo ? ' •' : ''} — ${NOME}` : NOME;
  if (principal && !principal.isDestroyed()) principal.setTitle(t);
}

function abrirPorFora(url) {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
}

function criarPrincipal() {
  principal = new BrowserWindow({
    ...lugarDaJanela(),
    minWidth: 960,
    minHeight: 600,
    title: NOME,
    show: false,
    backgroundColor: '#1b1f27',
    icon: ICONE,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false,
    },
  });
  principal.setMenu(null);

  const wc = principal.webContents;
  wc.on('console-message', (e, nivel, mensagem, linha, fonte) => {
    // Electron novo manda tudo no evento; o antigo, em argumentos. Vale o que vier.
    const level = e.level ?? nivel;
    const message = e.message ?? mensagem;
    const sourceId = e.sourceId ?? fonte;
    const lineNumber = e.lineNumber ?? linha;
    anotar(`[console:${level}]`, message, sourceId ? `(${sourceId}:${lineNumber})` : '');
  });
  wc.on('did-fail-load', (_e, codigo, descricao, url) => anotar('[carga] falhou', codigo, descricao, url));
  wc.on('render-process-gone', (_e, d) => anotar('[renderer] caiu', d.reason, d.exitCode));
  wc.on('did-finish-load', () => anotar('[carga] app carregado'));

  // A página-título acompanha o muro: "Muro da divisa • — Al-rimo".
  principal.on('page-title-updated', (e) => { e.preventDefault(); tituloDaJanela(); });

  // Links de fora vão para o navegador do sistema; páginas do próprio app
  // (Componentes de terceiros) abrem numa janela simples, sem menu.
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGEM + '/')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 900, height: 800, autoHideMenuBar: true, icon: ICONE,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    abrirPorFora(url);
    return { action: 'deny' };
  });
  wc.on('did-create-window', (w) => w.setMenu(null));
  wc.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGEM + '/')) return;
    e.preventDefault();
    abrirPorFora(url);
  });

  // Sem menu: recarregar fica desligado no pacote (o F5 do navegador não tem
  // sentido num programa e jogaria fora a alça do arquivo aberto); as
  // ferramentas do Chromium só com ALRIMO_DEVTOOLS=1.
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = (input.key || '').toLowerCase();
    const recarregar = k === 'f5' || ((input.control || input.meta) && k === 'r');
    if (recarregar && app.isPackaged) { e.preventDefault(); return; }
    const ferramentas = k === 'f12' || ((input.control || input.meta) && input.shift && k === 'i');
    if (ferramentas) {
      e.preventDefault();
      if (FERRAMENTAS) wc.toggleDevTools();
    }
  });

  /* FECHAR COM ALTERAÇÃO NÃO SALVA. O app guarda o último muro na máquina e o
     devolve ao reabrir — mas programa instalado pergunta, como o Pró-Viga e o
     Revit. "Salvar" passa a vez ao app (Ctrl+S de sempre) e ele fecha quando
     o muro estiver gravado; desistir do diálogo de salvar deixa aberto. */
  principal.on('close', (e) => {
    guardarLugar(principal);
    if (podeFechar || !estado.sujo) return;
    e.preventDefault();
    if (TESTE_SAIDA) {               // no teste ninguém responde: fecha sem salvar
      anotar('[fechar] alterações não salvas — teste, fecha sem salvar');
      podeFechar = true;
      principal.close();
      return;
    }
    const r = dialog.showMessageBoxSync(principal, {
      type: 'question',
      title: NOME,
      message: 'O muro tem alterações não salvas.',
      detail: 'Salvar antes de fechar?',
      buttons: ['Salvar', 'Não salvar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (r === 1) { podeFechar = true; principal.close(); }
    else if (r === 0) wc.send('programa:salvar-e-fechar');
  });
  // O app pede para segurar a página quando não conseguiu guardar o muro na
  // máquina (beforeunload). A pergunta já foi feita acima: aqui só se obedece.
  wc.on('will-prevent-unload', (e) => { if (podeFechar) e.preventDefault(); });
  principal.on('closed', () => { principal = null; });

  let pronto = 0;
  const umPasso = () => {
    if (++pronto < 2) return;
    if (splash && !splash.isDestroyed()) splash.webContents.send('splash:app-pronto');
    else mostrarPrincipal();
  };
  principal.once('ready-to-show', umPasso);
  wc.once('did-finish-load', umPasso);
  // Se o splash travar por qualquer motivo, o programa aparece assim mesmo.
  setTimeout(() => { if (principal && !principal.isVisible()) mostrarPrincipal(); }, 20000);

  principal.loadURL(`${ORIGEM}/index.html`);
}

/* ── arquivos .alrimo pedidos de fora (duplo clique, "Abrir com", 2ª cópia) ─ */

function arquivoDosArgumentos(argv) {
  return argv.find((a) => typeof a === 'string' && a.toLowerCase().endsWith(EXTENSAO) && fs.existsSync(a)) || null;
}

function entregar(caminho) {
  let texto;
  try { texto = fs.readFileSync(caminho, 'utf8'); }
  catch (err) { anotar('[abrir] não deu para ler', caminho, err.message); return; }
  pendentes.push({ caminho, nome: path.basename(caminho), texto });
  entregarPendentes();
}

/* Só com o app de pé E a janela à vista: o app pode perguntar "o muro tem
   alterações não salvas, abrir mesmo assim?" — pergunta feita com a janela
   ainda escondida atrás do splash (ou antes do primeiro desenho) aparecia
   sobre uma tela vazia. */
function entregarPendentes() {
  if (!rendererPronto || !principal || principal.isDestroyed() || !principal.isVisible()) return;
  while (pendentes.length) {
    const p = pendentes.shift();
    principal.webContents.send('programa:abrir-arquivo', p);
    anotar('[abrir] entregue ao app', p.caminho);
  }
}

/* ── download (IFC, CSV, Word, DXF .zip, SVG, PNG) ───────────────────────────
   O app entrega esses arquivos como download do navegador (<a download>). Aqui
   o download vai primeiro para uma pasta temporária — o app libera o endereço
   do arquivo um segundo depois do clique, e o diálogo de salvar pode ficar
   aberto muito mais que isso — e só então pergunta onde guardar. */

function ligarDownloads() {
  const pastaTemp = path.join(os.tmpdir(), 'alrimo-baixados');
  session.defaultSession.on('will-download', (_e, item) => {
    const nome = item.getFilename() || 'arquivo';
    fs.mkdirSync(pastaTemp, { recursive: true });
    const temp = path.join(pastaTemp, `${crypto.randomUUID()}-${nome}`);
    item.setSavePath(temp);
    item.once('done', async (_ev, situacao) => {
      if (situacao !== 'completed') {
        anotar('[download] não completou', nome, situacao);
        fs.rm(temp, { force: true }, () => {});
        return;
      }
      try {
        const destino = await perguntarOndeGravar(principal, nome, `Salvar ${nome}`);
        if (destino) {
          await fs.promises.copyFile(temp, destino);
          anotar('[arquivo] gravado', destino, fs.statSync(destino).size, 'bytes');
        }
      } catch (err) {
        anotar('[download] erro', nome, err.message);
        dialog.showErrorBox(NOME, `Não deu para gravar ${nome}: ${err.message}`);
      } finally {
        fs.rm(temp, { force: true }, () => {});
      }
    });
  });
}

/* ── a ponte com o app (preload.js ↔ app/src/estado/programa.ts) ─────────── */

function ligarPonte() {
  ipcMain.on('programa:pronto', () => {
    rendererPronto = true;
    entregarPendentes();
  });

  ipcMain.on('programa:estado', (_e, e) => {
    estado = { sujo: !!(e && e.sujo), titulo: (e && typeof e.titulo === 'string') ? e.titulo : '' };
    anotar('[estado]', estado.sujo ? 'alterado' : 'salvo', estado.titulo);
    tituloDaJanela();
  });

  ipcMain.on('programa:fechar', () => {
    podeFechar = true;
    if (principal && !principal.isDestroyed()) principal.close();
  });

  ipcMain.handle('arquivo:abrir-projeto', async () => {
    let caminho = null;
    if (TESTE_ABRIR) caminho = TESTE_ABRIR;
    else if (!TESTE_SAIDA) {
      const r = await dialog.showOpenDialog(principal, {
        title: 'Abrir muro',
        defaultPath: pastaInicial(),
        filters: [FILTROS['.alrimo'], { name: 'Todos os arquivos', extensions: ['*'] }],
        properties: ['openFile'],
      });
      if (!r.canceled && r.filePaths.length) caminho = r.filePaths[0];
    }
    if (!caminho) return null;
    lembrarPasta(caminho);
    return { caminho, nome: path.basename(caminho), texto: await fs.promises.readFile(caminho, 'utf8') };
  });

  ipcMain.handle('arquivo:escolher-destino', async (_e, nomeSugerido) => {
    let nome = path.basename(String(nomeSugerido || `Muro${EXTENSAO}`));
    if (!nome.toLowerCase().endsWith(EXTENSAO)) nome += EXTENSAO;
    anotar('[diálogo] salvar muro como', nome);
    const caminho = await perguntarOndeGravar(principal, nome, 'Salvar muro');
    return caminho ? { caminho, nome: path.basename(caminho) } : null;
  });

  ipcMain.handle('arquivo:ler', async (_e, caminho) => fs.promises.readFile(String(caminho), 'utf8'));

  // Grava num temporário ao lado e troca: queda de energia no meio não deixa
  // o .alrimo pela metade.
  ipcMain.handle('arquivo:gravar', async (_e, caminho, texto) => {
    const destino = String(caminho);
    const temp = `${destino}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, String(texto), 'utf8');
    await fs.promises.rename(temp, destino);
    anotar('[arquivo] gravado', destino, Buffer.byteLength(String(texto)), 'bytes');
  });

  /* PDF DIRETO EM ARQUIVO (memorial e pranchas). O diálogo de impressão do
     Windows escolhe o papel pela impressora — a prancha A1 sairia em A4 — e a
     impressora virtual rasteriza do jeito dela (no Pró-Viga as letras gregas
     sumiam). O printToPDF é o mesmo Chromium que desenhou a tela, com a página
     do tamanho que o CSS pede (@page). Depois de gravado, o PDF abre no leitor
     do sistema: imprimir no papel é de lá. */
  ipcMain.handle('arquivo:gravar-pdf', async (e, nomeSugerido) => {
    const win = BrowserWindow.fromWebContents(e.sender) || principal;
    let nome = path.basename(String(nomeSugerido || 'Al-rimo.pdf'));
    if (!nome.toLowerCase().endsWith('.pdf')) nome += '.pdf';
    const destino = await perguntarOndeGravar(win, nome, 'Salvar PDF');
    if (!destino) return null;
    const pdf = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
    await fs.promises.writeFile(destino, pdf);
    anotar('[arquivo] gravado', destino, pdf.length, 'bytes');
    if (!TESTE_SAIDA) shell.openPath(destino);
    return { caminho: destino };
  });
}

/* ── ciclo de vida ───────────────────────────────────────────────────────── */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (principal && !principal.isDestroyed()) {
      if (principal.isMinimized()) principal.restore();
      principal.focus();
    }
    const arq = arquivoDosArgumentos(argv.slice(1));
    if (arq) entregar(arq);
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(idDoPrograma());
    Menu.setApplicationMenu(null);
    lerPrefs();
    anotar('[programa] Al-rimo', versaoDoPrograma(), 'electron', process.versions.electron, 'empacotado', app.isPackaged);

    protocol.handle(ESQUEMA, servir);
    session.defaultSession.webRequest.onErrorOccurred((d) => anotar('[rede] erro', d.error, d.url));
    session.defaultSession.webRequest.onCompleted((d) => { if (d.statusCode >= 400) anotar('[rede]', d.statusCode, d.url); });
    // Nada de câmera, microfone, localização ou notificação: o app não pede.
    session.defaultSession.setPermissionRequestHandler((_wc, permissao, responder) => {
      responder(['clipboard-sanitized-write', 'fullscreen'].includes(permissao));
    });

    ligarDownloads();
    ligarPonte();
    ipcMain.on('splash:fim', mostrarPrincipal);

    const arq = arquivoDosArgumentos(process.argv.slice(1));
    if (arq) entregar(arq);

    criarSplash();
    criarPrincipal();
  });

  app.on('window-all-closed', () => app.quit());
}
