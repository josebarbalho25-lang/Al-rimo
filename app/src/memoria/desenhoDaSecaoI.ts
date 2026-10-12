/*
  A SEÇÃO DA FAIXA DO BALANÇO DESENHADA E COTADA — a figura do card de ELS do muro em balanço (Jose, 12/10:
  "cadê o cálculo da inércia com figura?").

  POR QUE EXISTE: o contraforte já tinha a seção real desenhada no card (desenhoDaSecaoCf.ts); a inércia do balanço
  aparecia só como conta. A seção é a da aula 12.2: uma faixa de largura bm (o espaçamento das barras), seção I com
  as MESAS = paredes do bloco (espessura hf, a largura toda) e a ALMA = furo grauteado + septos (bw), com a barra no
  furo; grauteamento total = retângulo cheio bm × t.

  DE ONDE VEM CADA NÚMERO: as CÉLULAS da planilha que as linhas da memória mostram (bm_els, bw_els, hf_bl, t_bloco,
  d_util, phi_v) — a figura nunca diz um número diferente da conta. Nada aqui é conta nova.

  Planta, solo em cima (régua das figuras, 12/10): a face do solo é a tracionada no balanço, a barra fica do lado de
  cima e o d é medido da face de baixo (externa, comprimida). Papel branco, traço escuro, sem <defs> nem ids (dois
  cards na mesma página não colidem); o Word recebe o SVG como PNG (word.ts).
*/
import type { Resultado } from '@/motor/tipos';
import { nbr } from './formato';
import type { DesenhoDoCard } from './desenhoDaSecaoCf';

const TINTA = '#1a1a1a';
const MESA = '#d6d6d6';        // paredes do bloco (mesas da seção I)
const GRAUTE = '#bdd7ee';      // alma grauteada (furo + septos) — o azul do graute das figuras
const GRAUTE_LINHA = '#2e75b6';
const VAZIO = '#ffffff';       // furo vazio: fora da seção
const SOLO = '#e8d8b9';
const ACO = '#c00000';
const COTA = '#3a3a3a';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Cota em cm vinda de célula: inteiro sem casa; senão uma casa (o que a linha da memória mostra). */
const cm = (v: number) => nbr(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);

function texto(x: number, y: number, s: string, tam = 12, ancora: 'start' | 'middle' | 'end' = 'middle', giro = false): string {
  const tr = giro ? ` transform="rotate(-90 ${x.toFixed(2)} ${y.toFixed(2)})"` : '';
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${tam}" text-anchor="${ancora}" fill="${TINTA}"${tr}>${esc(s)}</text>`;
}

/** Cota com traço oblíquo nas pontas; rótulo em cima (horizontal) ou ao lado, girado (vertical). */
function cota(x1: number, y1: number, x2: number, y2: number, rotulo: string, lado: 1 | -1): string {
  const tick = (x: number, y: number) =>
    `<line x1="${(x - 3).toFixed(2)}" y1="${(y + 3).toFixed(2)}" x2="${(x + 3).toFixed(2)}" y2="${(y - 3).toFixed(2)}" stroke="${COTA}" stroke-width="0.9"/>`;
  let s = `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COTA}" stroke-width="0.6"/>` + tick(x1, y1) + tick(x2, y2);
  // cota vertical curta (x, hf: 2 a 4 cm na escala da faixa): texto deitado ao lado, que girado não cabe
  if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y2 - y1) < 44) s += texto(x1 + lado * 6, (y1 + y2) / 2 + 4, rotulo, 12, lado > 0 ? 'start' : 'end');
  else if (Math.abs(x1 - x2) < 1e-6) s += texto(x1 + lado * (lado > 0 ? 13 : 5), (y1 + y2) / 2, rotulo, 12, 'middle', true);
  else s += texto((x1 + x2) / 2, Math.min(y1, y2) + (lado > 0 ? 15 : -4), rotulo);
  return s;
}

const chamada = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COTA}" stroke-width="0.4" stroke-dasharray="2 2"/>`;

const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = TINTA, sw = 1) =>
  `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

/** Uma seção I (ou cheia) em cm: faixa bm, alma bw, mesas hf, espessura t, barras a d (e a d2) da face comprimida. */
interface SecaoI { bm: number; bw: number; hf: number; t: number; d: number; d2: number | null; phi: number | null; cheia: boolean; titulo: string }

/** O desenho de UMA seção, a partir de (ox, 0); devolve as partes e a largura ocupada. */
function desenharSecao(p: SecaoI, ox: number, s: number): { partes: string[]; largura: number; altura: number } {
  const { bm, bw, hf, t, d, phi, cheia } = p;
  const W = bm * s, T = t * s;
  const x0 = ox + 96, yS = 48;       // faixa de solo em cima (folga à esquerda para as cotas d e hf)
  const y0 = yS + 22;                // face do solo
  const y1 = y0 + T;                 // face externa
  const xc = x0 + W / 2;             // a barra no meio da faixa
  const partes: string[] = [texto(ox + 8, 16, p.titulo, 13, 'start')];

  partes.push(rect(x0 - 10, yS, W + 20, 22, SOLO, 'none'));
  partes.push(`<line x1="${(x0 - 10).toFixed(2)}" y1="${y0.toFixed(2)}" x2="${(x0 + W + 10).toFixed(2)}" y2="${y0.toFixed(2)}" stroke="#8d6e3f" stroke-width="1.6"/>`);
  if (cheia) {
    partes.push(rect(x0, y0, W, T, GRAUTE, GRAUTE_LINHA, 1.2));
  } else {
    // a faixa toda com o furo vazio, as duas mesas (paredes do bloco) e a alma grauteada no meio
    partes.push(rect(x0, y0, W, T, VAZIO, TINTA, 0.8));
    partes.push(rect(x0, y0, W, hf * s, MESA, TINTA, 1));
    partes.push(rect(x0, y1 - hf * s, W, hf * s, MESA, TINTA, 1));
    partes.push(rect(xc - (bw * s) / 2, y0, bw * s, T, GRAUTE, GRAUTE_LINHA, 1.2));
  }
  // as barras, a d (e a d2) da face comprimida
  const rb = Math.max(3, ((phi ?? 10) / 20) * s);
  const yb = y1 - d * s;
  partes.push(`<circle cx="${xc.toFixed(2)}" cy="${yb.toFixed(2)}" r="${rb.toFixed(2)}" fill="${ACO}"/>`);
  if (p.d2 !== null) partes.push(`<circle cx="${xc.toFixed(2)}" cy="${(y1 - p.d2 * s).toFixed(2)}" r="${rb.toFixed(2)}" fill="${ACO}"/>`);

  // cotas: bm embaixo, bw em cima (sobre o solo, fora da peça), t à direita, d e hf à esquerda
  const yCb = y1 + 26;
  partes.push(chamada(x0, y1, x0, yCb + 4), chamada(x0 + W, y1, x0 + W, yCb + 4));
  partes.push(cota(x0, yCb, x0 + W, yCb, `bm = ${cm(bm)}`, 1));
  if (!cheia) {
    const yCw = yS - 10;
    partes.push(chamada(xc - (bw * s) / 2, y0, xc - (bw * s) / 2, yCw - 4), chamada(xc + (bw * s) / 2, y0, xc + (bw * s) / 2, yCw - 4));
    partes.push(cota(xc - (bw * s) / 2, yCw, xc + (bw * s) / 2, yCw, `bw = ${cm(bw)}`, -1));
  }
  const xT = x0 + W + 30;
  partes.push(chamada(x0 + W, y0, xT + 4, y0), chamada(x0 + W, y1, xT + 4, y1));
  partes.push(cota(xT, y0, xT, y1, `t = ${cm(t)}`, 1));
  const xD = x0 - 22;
  partes.push(chamada(xc, yb, xD - 4, yb), chamada(x0, y1, xD - 4, y1));
  partes.push(cota(xD, yb, xD, y1, `d = ${cm(d)}`, -1));
  if (!cheia) {
    const xH = x0 - 48;
    partes.push(chamada(x0, y0, xH - 4, y0), chamada(x0, y0 + hf * s, xH - 4, y0 + hf * s));
    partes.push(cota(xH, y0, xH, y0 + hf * s, `hf = ${cm(hf)}`, -1));
  }
  return { partes, largura: x0 + W + 70 - ox, altura: yCb + 26 };
}

function folha(secoes: SecaoI[], titulo: string): DesenhoDoCard {
  const partes: string[] = [];
  let ox = 0, H = 0;
  // uma escala só na folha (a régua das figuras): a maior faixa ocupa até 420 px e a espessura até 170 px
  const s = Math.min(...secoes.map((p) => Math.min(420 / p.bm, 170 / p.t)));
  for (const p of secoes) {
    const d = desenharSecao(p, ox, s);
    partes.push(...d.partes);
    ox += d.largura + 20;
    H = Math.max(H, d.altura);
  }
  const Wt = Math.ceil(ox - 20), Ht = Math.ceil(H);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wt} ${Ht}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${Wt}" height="${Ht}" fill="#ffffff"/>${partes.join('')}</svg>`;
  return { svg, titulo };
}

const ok = (...v: (number | null)[]) => v.every((x) => x !== null && Number.isFinite(x));

/** A seção da faixa do balanço, ou null quando a conta não tem faixa (contrafortes, sem espaçamento válido). */
export function desenhoDaSecaoI(r: Resultado): DesenhoDoCard | null {
  if (r.v('Tipo_muro') !== 'Balanço') return null;
  const bm = r.num('bm_els'), bw = r.num('bw_els'), hf = r.num('hf_bl'), t = r.num('t_bloco'), d = r.num('d_util');
  if (!ok(bm, bw, hf, t, d) || !(bm! > 0) || !(t! > 0)) return null;
  const cheia = String(r.v('Graute') ?? '').slice(0, 5).toLowerCase() === 'total' || bw! >= bm! - 1e-9;
  const titulo = cheia ? 'Faixa bm · retangular cheia' : 'Faixa bm · seção I';
  return folha([{ bm: bm!, bw: bw!, hf: hf!, t: t!, d: d!, d2: null, phi: r.num('phi_v'), cheia, titulo }], `Seção da faixa (cm)`);
}

/**
  As duas seções do painel entre contrafortes (ELS): vertical (faixa = espaçamento das barras verticais, alma = furo
  grauteado + septos, uma ou duas barras) e horizontal (faixa = espaçamento das canaletas, alma = canaleta grauteada).
  Mesmas células do card: bm_ev/bw_ev/d_pv e bm_eh/bw_eh/d_ph.
*/
export function desenhoDasSecoesDoPainel(r: Resultado): DesenhoDoCard | null {
  if (r.v('Tipo_muro') !== 'Contrafortes') return null;
  const hf = r.num('hf_bl'), t = r.num('t_bloco');
  const v = { bm: r.num('bm_ev'), bw: r.num('bw_ev'), d: r.num('d_pv') };
  const h = { bm: r.num('bm_eh'), bw: r.num('bw_eh'), d: r.num('d_ph') };
  const secoes: SecaoI[] = [];
  if (ok(hf, t, v.bm, v.bw, v.d) && v.bm! > 0) {
    const duas = r.num('nb_pv') === 2;
    secoes.push({ bm: v.bm!, bw: v.bw!, hf: hf!, t: t!, d: v.d!, d2: duas ? t! - v.d! : null, phi: r.num('phi_pv'),
      cheia: v.bw! >= v.bm! - 1e-9, titulo: 'Vertical · faixa s_v' });
  }
  if (ok(hf, t, h.bm, h.bw, h.d) && h.bm! > 0) {
    secoes.push({ bm: h.bm!, bw: h.bw!, hf: hf!, t: t!, d: h.d!, d2: null, phi: r.num('phi_ph'),
      cheia: h.bw! >= h.bm! - 1e-9, titulo: 'Horizontal · faixa s_h' });
  }
  return secoes.length ? folha(secoes, 'Seções I do painel (cm)') : null;
}


/*
  A FLEXÃO DA FAIXA DE 1 M DO BALANÇO, em DOIS desenhos, cada um perto da conta que mostra (Jose, 12/10: "visível por
  favor, tá pequeno" e depois "distribui os desenhos"):

  1. a faixa em PLANTA (b = 100 cm), no topo do card: as paredes do bloco (mesas), os furos grauteados a cada s com a
     barra, a zona comprimida sombreada e a linha neutra — só as cotas de largura (b, s, bw,f) e a espessura t;
  2. as FORÇAS NA SEÇÃO, junto da verificação da parede (ou da seção T), numa escala maior — a profundidade é o que
     importa: a parede comprimida (C mesa) e, em seção T, as almas comprimidas (C alma), com a largura proporcional à
     força por cm de profundidade (K·fd·b), a tração no aço (As·σs), a linha neutra, as profundidades (hf, y, x, d) e
     os braços até a barra.

  Os dois têm a mesma largura (LARGURA_FLEXAO) e o card os mostra nela: a letra sai do tamanho da do texto, igual nos
  dois. Números só das células (x_ln, y_alma, ln_mesa, d_util, hf_bl, t_bloco, s_adot, bw_f, bw_m, ffd_m, ffd_g, phi_v).
*/
const LARGURA_FLEXAO = 770;
const FS = 15;                                             // letra das cotas e dos rótulos
const COMPRIMIDA = 'fill="#f8cbad" fill-opacity="0.8" stroke="#c55a11" stroke-width="1.2"';
const LARANJA = '#c55a11';
const TRACO_LN = ' stroke-dasharray="9 4 2 4"';

const lin = (x1: number, y1: number, x2: number, y2: number, cor = TINTA, sw = 1, extra = '') =>
  `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${cor}" stroke-width="${sw}"${extra}/>`;
const zona = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" ${COMPRIMIDA}/>`;
const marca = (xx: number, yy: number) => lin(xx - 4, yy + 4, xx + 4, yy - 4, COTA, 1.1);
/** Cota vertical com o rótulo DEITADO ao lado, na altura do meio (lê-se sem virar a cabeça). */
const cotaV = (xx: number, ya: number, yb: number, rot: string, lado: 1 | -1) =>
  lin(xx, ya, xx, yb, COTA, 0.8) + marca(xx, ya) + marca(xx, yb) +
  texto(xx + lado * 7, (ya + yb) / 2 + FS * 0.35, rot, FS, lado > 0 ? 'start' : 'end');
const cotaH = (xa: number, xb: number, yy: number, rot: string, embaixo: boolean) =>
  lin(xa, yy, xb, yy, COTA, 0.8) + marca(xa, yy) + marca(xb, yy) +
  texto((xa + xb) / 2, embaixo ? yy + FS + 3 : yy - 6, rot, FS);
const seta = (xi: number, xf: number, yy: number, cor: string) => {
  const dir = Math.sign(xf - xi) || 1;
  return lin(xi, yy, xf, yy, cor, 1.8) + `<path d="M${xf.toFixed(2)},${yy.toFixed(2)} l${(-dir * 10).toFixed(2)},-5 l0,10 z" fill="${cor}"/>`;
};
const svgDe = (partes: string[], W: number, H: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(H)}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${Math.ceil(H)}" fill="#ffffff"/>${partes.join('')}</svg>`;

/** Os números da flexão que os dois desenhos usam; null quando a conta não tem faixa para desenhar. */
function faixaDaFlexao(r: Resultado) {
  if (r.v('Tipo_muro') !== 'Balanço') return null;
  const t = r.num('t_bloco'), d = r.num('d_util'), hf = r.num('hf_bl'), s = r.num('s_adot');
  if (!ok(t, d, hf, s) || !(s! > 0) || !(t! > 0)) return null;
  const x = r.num('x_ln'), y = r.num('y_alma');
  const temX = x !== null && x > 0 && x < t!;
  return {
    t: t!, d: d!, hf: hf!, s: s!,
    bw: r.num('bw_f') ?? r.num('bw_els') ?? 21,            // a alma de cada furo da conta da flexão
    x: temX ? x : null,
    y: y ?? 0,
    cheia: String(r.v('Graute') ?? '').slice(0, 5).toLowerCase() === 'total',
    // passou da parede: a compressão desce para os furos grauteados (ln_mesa, planilha)
    secaoT: temX && r.v('ln_mesa') !== 'Sim' && y !== null,
  };
}

/** 1. A faixa de 1 m em planta: o que é parede, o que é furo grauteado, onde está a barra e o que está comprimido. */
export function desenhoDaFaixaEmPlanta(r: Resultado): DesenhoDoCard | null {
  const f = faixaDaFlexao(r);
  if (!f) return null;
  const { t, d, hf, bw, x, y, cheia, secaoT } = f;
  const b = 100, s = 6.4;                                  // px por cm: o metro ocupa 640 px
  const W = b * s, T = t * s;
  const x0 = 46, yCs = 26, yS = 40, y0 = yS + 18, y1 = y0 + T;
  const partes: string[] = [];
  partes.push(rect(x0 - 10, yS, W + 20, 18, SOLO, 'none'));
  partes.push(lin(x0 - 10, y0, x0 + W + 10, y0, '#8d6e3f', 1.8));
  const xs: number[] = [];                                 // as barras, a cada s
  for (let k = 0; f.s / 2 + k * f.s < b; k++) xs.push(f.s / 2 + k * f.s);
  const almas: Array<[number, number]> = cheia ? [[0, b]] : xs.map((xb) => [Math.max(0, xb - bw / 2), Math.min(b, xb + bw / 2)]);
  if (cheia) partes.push(rect(x0, y0, W, T, GRAUTE, GRAUTE_LINHA, 1.2));
  else {
    partes.push(rect(x0, y0, W, T, VAZIO, TINTA, 0.8));
    partes.push(rect(x0, y0, W, hf * s, MESA, TINTA, 1));
    partes.push(rect(x0, y1 - hf * s, W, hf * s, MESA, TINTA, 1));
    for (const [a0, a1] of almas) partes.push(rect(x0 + a0 * s, y0, (a1 - a0) * s, T, GRAUTE, GRAUTE_LINHA, 1.2));
  }
  // a zona comprimida, junto da face externa (embaixo): 0,8x na parede, ou a parede inteira + y nas almas
  if (x !== null) {
    if (!secaoT) partes.push(zona(x0, y1 - 0.8 * x * s, W, 0.8 * x * s));
    else {
      partes.push(zona(x0, y1 - hf * s, W, hf * s));
      for (const [a0, a1] of almas) partes.push(zona(x0 + a0 * s, y1 - (hf + y) * s, (a1 - a0) * s, y * s));
    }
    partes.push(lin(x0 - 8, y1 - x * s, x0 + W + 8, y1 - x * s, LARANJA, 1.3, TRACO_LN));
    partes.push(texto(x0 - 12, y1 - x * s + 5, 'LN', 13, 'end'));
  }
  const rb = Math.max(3.5, ((r.num('phi_v') ?? 10) / 20) * s);
  const yb = y1 - d * s;
  for (const xb of xs) partes.push(`<circle cx="${(x0 + xb * s).toFixed(2)}" cy="${yb.toFixed(2)}" r="${rb.toFixed(2)}" fill="${ACO}"/>`);
  // cotas: s em cima (sobre o solo), b e bw,f embaixo, t à direita
  if (xs.length > 1) {
    const xa = x0 + xs[0] * s, xb = x0 + xs[1] * s;
    partes.push(chamada(xa, yb, xa, yCs - 4), chamada(xb, yb, xb, yCs - 4));
    partes.push(cotaH(xa, xb, yCs, `s = ${cm(f.s)}`, false));
  }
  let yBaixo = y1 + 30;
  partes.push(chamada(x0, y1, x0, yBaixo + 4), chamada(x0 + W, y1, x0 + W, yBaixo + 4));
  partes.push(cotaH(x0, x0 + W, yBaixo, 'b = 100', true));
  // a alma cotada é uma inteira (a da ponta pode sair cortada pela borda da faixa)
  const inteira = cheia ? undefined : almas.find(([a0, a1]) => a1 - a0 >= bw - 1e-6);
  if (inteira) {
    const [a0, a1] = inteira;
    yBaixo += 40;
    partes.push(chamada(x0 + a0 * s, y1, x0 + a0 * s, yBaixo + 4), chamada(x0 + a1 * s, y1, x0 + a1 * s, yBaixo + 4));
    // com as casas da linha da memória (bw,f = 21,25), não arredondado a uma
    partes.push(cotaH(x0 + a0 * s, x0 + a1 * s, yBaixo, `bw,f = ${nbr(bw, Math.abs(bw - Math.round(bw)) < 1e-9 ? 0 : 2)}`, true));
  }
  const xT = x0 + W + 24;
  partes.push(chamada(x0 + W, y0, xT + 4, y0), chamada(x0 + W, y1, xT + 4, y1));
  partes.push(cotaV(xT, y0, y1, `t = ${cm(t)}`, 1));
  return { svg: svgDe(partes, LARGURA_FLEXAO, yBaixo + FS + 10), titulo: 'Faixa de 1 m em planta (cm)', largura: LARGURA_FLEXAO };
}

/** 2. As forças na seção: os blocos comprimidos, o aço tracionado, a linha neutra, as profundidades e os braços. */
export function desenhoDasForcasNaFaixa(r: Resultado): DesenhoDoCard | null {
  const f = faixaDaFlexao(r);
  const fM = r.num('ffd_m'), fA = r.num('ffd_g'), bwM = r.num('bw_m');
  if (!f || f.x === null || !ok(fM) || !(fM! > 0)) return null;
  const { t, d, hf, x, y } = f;
  const secaoT = f.secaoT && ok(fA, bwM);
  const k = 14;                                            // px por cm de profundidade
  const yTopo = 22, yB = yTopo + t * k;                    // face do solo (em cima) e face externa, comprimida (embaixo)
  const nivel = (prof: number) => yB - prof * k;           // profundidade medida da face comprimida
  const xa = 280, wM = 140;                                // a face da seção; o bloco da parede (K·fd,mesa·100)
  // largura ∝ força por cm de profundidade: a alma é K·fd,alma·bw,m contra K·fd,mesa·100 da parede
  const wA = secaoT ? (wM * fA! * bwM!) / (fM! * 100) : 0;
  const wMax = Math.max(wM, wA);
  const partes: string[] = [];
  // a seção de perfil, com o solo em cima (a mesma orientação da planta)
  partes.push(rect(xa - 22, yTopo - 12, 32, 12, SOLO, 'none'));
  partes.push(lin(xa - 22, yTopo, xa + 10, yTopo, '#8d6e3f', 1.8));
  partes.push(rect(xa - 14, yTopo, 14, t * k, MESA, TINTA, 0.8));
  partes.push(lin(xa, yTopo, xa, yB, TINTA, 1.5));
  // os blocos comprimidos e as resultantes
  const xSeta = xa + wMax + 52;
  const bracos: Array<[number, string]> = [];
  if (secaoT) {
    partes.push(zona(xa, nivel(hf), wM, hf * k), zona(xa, nivel(hf + y), wA, y * k));
    partes.push(seta(xSeta, xa + wM + 4, nivel(hf / 2), LARANJA), texto(xSeta + 6, nivel(hf / 2) + 5, 'C mesa', FS, 'start'));
    partes.push(seta(xSeta, xa + wA + 4, nivel(hf + y / 2), LARANJA), texto(xSeta + 6, nivel(hf + y / 2) + 5, 'C alma', FS, 'start'));
    // o braço do C alma (o mais alto) na coluna de perto: a chamada do C mesa passa por baixo dela; na ordem inversa
    // a chamada do C alma cortava o rótulo "d − hf/2" e lia-se "C alma ··· d − hf/2"
    bracos.push([nivel(hf + y / 2), 'd − hf − y/2'], [nivel(hf / 2), 'd − hf/2']);
  } else {
    partes.push(zona(xa, nivel(0.8 * x), wM, 0.8 * x * k));
    partes.push(seta(xSeta, xa + wM + 4, nivel(0.4 * x), LARANJA), texto(xSeta + 6, nivel(0.4 * x) + 5, 'C', FS, 'start'));
    bracos.push([nivel(0.4 * x), 'z = d − 0,4x']);
  }
  // a linha neutra e o aço. Os dois rótulos vão EM CIMA das linhas: com x perto de d (s = 60 do Jose, x = 9,37 e
  // d = 9,5) a LN passa rente à barra, e o rótulo na ponta da linha encavalava no do aço e no do C.
  const fimLN = xa + wMax + 30;
  partes.push(lin(xa - 20, nivel(x), fimLN, nivel(x), LARANJA, 1.3, TRACO_LN));
  partes.push(texto(fimLN, nivel(x) - 5, 'LN', 13, 'end'));
  partes.push(`<circle cx="${xa}" cy="${nivel(d).toFixed(2)}" r="5" fill="${ACO}"/>`);
  partes.push(seta(xa + 7, xa + 80, nivel(d), ACO), texto(xa + 44, nivel(d) - 9, 'As·σs', FS));
  // as profundidades, à esquerda (da face comprimida): hf e y, x, d
  const cA = xa - 34, cB = xa - 118, cC = xa - 202;
  partes.push(chamada(xa - 14, yB, cC - 4, yB));
  partes.push(chamada(xa - 14, nivel(hf), cA - 4, nivel(hf)));
  partes.push(cotaV(cA, nivel(hf), yB, `hf = ${cm(hf)}`, -1));
  if (secaoT) {
    partes.push(chamada(xa - 14, nivel(hf + y), cA - 4, nivel(hf + y)));
    partes.push(cotaV(cA, nivel(hf + y), nivel(hf), `y = ${nbr(y, 2)}`, -1));
  } else {
    // a verificação da parede: o bloco comprimido (0,8x) contra a parede (hf) — o hf cotado, o 0,8x escrito embaixo
    partes.push(texto(xa + wM / 2, yB + 20, `0,8x = ${nbr(0.8 * x, 2)} ≤ hf`, FS));
  }
  partes.push(chamada(xa - 20, nivel(x), cB - 4, nivel(x)));
  partes.push(cotaV(cB, nivel(x), yB, `x = ${nbr(x, 2)}`, -1));
  partes.push(chamada(xa - 5, nivel(d), cC - 4, nivel(d)));
  partes.push(cotaV(cC, nivel(d), yB, `d = ${cm(d)}`, -1));
  // os braços até a barra, à direita
  const xr0 = xSeta + 84, passo = 112;
  partes.push(chamada(fimLN + 6, nivel(d), xr0 + (bracos.length - 1) * passo + 4, nivel(d)));   // depois do rótulo da LN
  bracos.forEach(([yy, rot], i) => {
    const xr = xr0 + i * passo;
    partes.push(chamada(xSeta + 60, yy, xr + 4, yy));
    partes.push(cotaV(xr, nivel(d), yy, rot, 1));
  });
  const Ht = yB + (secaoT ? 16 : 30);
  // a alma mais forte que a parede (fd,alma·bw,m > fd,mesa·100) alarga o desenho: aí a folha cresce em vez de cortar
  const Wt = Math.max(LARGURA_FLEXAO, Math.ceil(xr0 + (bracos.length - 1) * passo + 100));
  return {
    svg: svgDe(partes, Wt, Ht),
    titulo: secaoT ? 'Forças na seção T (cm)' : 'Forças na parede do bloco (cm)',
    largura: LARGURA_FLEXAO,
  };
}
