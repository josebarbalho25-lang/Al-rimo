// ═══════════════════════════════════════════════════════════════════════════
//  recentes.js — a lista dos Recentes do Início, no perfil do programa
// ---------------------------------------------------------------------------
//  O Início do Pró-Viga (Jose, 15/11: "ele deixa as vigas salvas por último na
//  tela inicial"). No programa o caminho de cada .alrimo é conhecido, então a
//  lista mora aqui, no perfil (%APPDATA%\Al-rimo\recentes.json), e a foto de
//  cada um num PNG ao lado (recentes\<nome>.png). Nada vai dentro do .alrimo.
//
//  A conta da lista é pura (este arquivo, testado em teste/recentes.test.js);
//  o disco é do main.js. O mais novo primeiro, sem repetidos (o mesmo arquivo
//  escrito com outra maiúscula ou outra barra é o mesmo), no teto de 12, e o
//  que sumiu do disco sai.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const crypto = require('crypto');

const MAX = 12;
/** A foto do cartão tem 490 × 300; mais que isto não é foto de cartão. */
const TETO_DA_FOTO = 4 * 1024 * 1024;
const PREFIXO_PNG = 'data:image/png;base64,';

/** O Windows não distingue maiúscula nem a barra: um arquivo, uma chave. */
function chave(caminho) {
  return String(caminho).replace(/\//g, '\\').toLowerCase();
}

/** Só o que tem a cara de um recente (o JSON é de outra sessão, talvez de outra versão). */
function valido(r, extensao) {
  return !!r && typeof r === 'object'
    && typeof r.caminho === 'string' && r.caminho.toLowerCase().endsWith(extensao)
    && typeof r.nome === 'string'
    && Number.isFinite(r.quando);
}

/** Lê o texto de recentes.json. Estragado ou ausente: lista vazia (nunca impede o programa de subir). */
function lerLista(texto, extensao) {
  let v;
  try { v = JSON.parse(texto); } catch (_) { return []; }
  if (!Array.isArray(v)) return [];
  return emOrdem(v.filter((r) => valido(r, extensao)).map((r) => ({
    caminho: r.caminho,
    nome: r.nome,
    resumo: typeof r.resumo === 'string' ? r.resumo : '',
    quando: r.quando,
    foto: typeof r.foto === 'string' ? r.foto : null,
  })));
}

/** O mais novo primeiro, um por arquivo, no teto. */
function emOrdem(lista, max = MAX) {
  const vistos = new Set();
  const out = [];
  for (const r of [...lista].sort((a, b) => b.quando - a.quando)) {
    const k = chave(r.caminho);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(r);
  }
  return out.slice(0, max);
}

/** Põe no topo (ou promove). A foto de antes fica quando não vem outra. */
function promover(lista, entrada, agora, max = MAX) {
  const k = chave(entrada.caminho);
  const antes = lista.find((r) => chave(r.caminho) === k);
  const novo = {
    caminho: entrada.caminho,
    nome: entrada.nome,
    resumo: entrada.resumo || '',
    quando: agora,
    foto: entrada.foto !== undefined ? entrada.foto : (antes ? antes.foto : null),
  };
  return [novo, ...lista.filter((r) => chave(r.caminho) !== k)].slice(0, max);
}

/** Tira um arquivo da lista (o arquivo em si fica). */
function tirar(lista, caminho) {
  const k = chave(caminho);
  return lista.filter((r) => chave(r.caminho) !== k);
}

/** Os que existem no disco. */
function semOsSumidos(lista, existe) {
  return lista.filter((r) => existe(r.caminho));
}

/** O nome do PNG de um recente: sai do caminho (o mesmo arquivo, a mesma foto, sobrescrita). */
function nomeDaFoto(caminho) {
  return crypto.createHash('sha1').update(chave(caminho)).digest('hex').slice(0, 20) + '.png';
}

/** A foto que veio da página (data URL) em bytes. Qualquer outra coisa: null. */
function bytesDaFoto(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIXO_PNG)) return null;
  const b = Buffer.from(dataUrl.slice(PREFIXO_PNG.length), 'base64');
  // a assinatura do PNG: o que não começa por ela não vai para o disco
  if (b.length < 8 || b.length > TETO_DA_FOTO || b.readUInt32BE(0) !== 0x89504e47) return null;
  return b;
}

/** As fotos que não são de nenhum recente (o que saiu da lista). */
function fotosSoltas(arquivos, lista) {
  const ficam = new Set(lista.map((r) => r.foto).filter(Boolean));
  return arquivos.filter((a) => a.toLowerCase().endsWith('.png') && !ficam.has(a));
}

/*
  O DISCO. `pasta` = o perfil do programa (app.getPath('userData')). Cada pedido lê o arquivo de novo: a lista é
  pequena (12) e assim duas janelas — ou o programa de antes e o de agora — não brigam por uma cópia na memória.
  A página recebe a foto já em data URL (ela não lê o disco).
*/
function criarArquivoDeRecentes(pasta, extensao, fs = require('fs'), path = require('path')) {
  const arquivo = path.join(pasta, 'recentes.json');
  const pastaDasFotos = path.join(pasta, 'recentes');
  const existe = (c) => { try { return fs.statSync(c).isFile(); } catch (_) { return false; } };

  function ler() {
    try { return lerLista(fs.readFileSync(arquivo, 'utf8'), extensao); } catch (_) { return []; }
  }
  function gravar(lista) {
    fs.mkdirSync(pasta, { recursive: true });
    // temporário e troca: queda no meio não deixa o arquivo pela metade (o lerLista daria lista vazia)
    const temp = `${arquivo}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(lista, null, 2), 'utf8');
    fs.renameSync(temp, arquivo);
    let soltas = [];
    try { soltas = fotosSoltas(fs.readdirSync(pastaDasFotos), lista); } catch (_) { /* sem pasta de fotos */ }
    for (const f of soltas) { try { fs.unlinkSync(path.join(pastaDasFotos, f)); } catch (_) { /* fica para a próxima */ } }
  }
  function paraPagina(lista) {
    return lista.map((r) => {
      let miniatura = null;
      if (r.foto) {
        try { miniatura = PREFIXO_PNG + fs.readFileSync(path.join(pastaDasFotos, r.foto)).toString('base64'); } catch (_) { /* foto perdida: o cartão fica com a marca */ }
      }
      return { caminho: r.caminho, nome: r.nome, resumo: r.resumo, quando: r.quando, miniatura };
    });
  }
  function vivos() {
    const l = ler();
    const v = semOsSumidos(l, existe);
    if (v.length !== l.length) gravar(v);
    return v;
  }
  const ehDoPrograma = (c) => typeof c === 'string' && c.toLowerCase().endsWith(extensao);

  return {
    listar: () => paraPagina(vivos()),
    lembrar(e, agora = Date.now()) {
      if (!e || !ehDoPrograma(e.caminho)) return paraPagina(vivos());
      let foto;
      if (e.miniatura === null) foto = null;
      else if (e.miniatura !== undefined) {
        const bytes = bytesDaFoto(e.miniatura);
        if (bytes) {
          foto = nomeDaFoto(e.caminho);
          fs.mkdirSync(pastaDasFotos, { recursive: true });
          fs.writeFileSync(path.join(pastaDasFotos, foto), bytes);
        }
      }
      const l = promover(vivos(), { caminho: e.caminho, nome: String(e.nome || path.basename(e.caminho)), resumo: String(e.resumo || ''), foto }, agora);
      gravar(l);
      return paraPagina(l);
    },
    esquecer(caminho) {
      const l = tirar(vivos(), String(caminho));
      gravar(l);
      return paraPagina(l);
    },
  };
}

module.exports = {
  MAX, PREFIXO_PNG, chave, lerLista, emOrdem, promover, tirar, semOsSumidos, nomeDaFoto, bytesDaFoto, fotosSoltas, criarArquivoDeRecentes,
};
