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

/**
  A faixa de 1 m da flexão do balanço (Jose, 12/10: a figura também no card de flexão). A conta da flexão é por metro
  (b = 100 cm, aula 12.2): a mesma seção do bloco, agora com TODAS as barras do metro (uma a cada s, cada uma no seu
  furo grauteado), a linha neutra x e o bloco comprimido 0,8x junto da face externa — que tem de caber na parede do
  bloco comprimido junto da face externa: 0,8x na parede, ou (seção T) a parede inteira + y nas almas grauteadas.
*/
export function desenhoDaFlexao(r: Resultado): DesenhoDoCard | null {
  if (r.v('Tipo_muro') !== 'Balanço') return null;
  const t = r.num('t_bloco'), d = r.num('d_util'), hf = r.num('hf_bl'), sAd = r.num('s_adot');
  if (!ok(t, d, hf, sAd) || !(sAd! > 0) || !(t! > 0)) return null;
  const bw = r.num('bw_f') ?? r.num('bw_els') ?? 21;   // a alma de cada furo da conta da flexão (bw_f)
  const x = r.num('x_ln');
  const cheia = String(r.v('Graute') ?? '').slice(0, 5).toLowerCase() === 'total';
  const b = 100;
  const s = Math.min(600 / b, 170 / t!);
  const W = b * s, T = t! * s;
  const x0 = 150, yS = 48, y0 = yS + 22, y1 = y0 + T;
  const partes: string[] = [texto(8, 16, 'Faixa de 1 m · b = 100', 13, 'start')];
  partes.push(rect(x0 - 10, yS, W + 20, 22, SOLO, 'none'));
  partes.push(`<line x1="${(x0 - 10).toFixed(2)}" y1="${y0.toFixed(2)}" x2="${(x0 + W + 10).toFixed(2)}" y2="${y0.toFixed(2)}" stroke="#8d6e3f" stroke-width="1.6"/>`);
  // as barras do metro: uma a cada s, a primeira a s/2 da borda da faixa
  const xs: number[] = [];
  for (let k = 0; sAd! / 2 + k * sAd! < b; k++) xs.push(sAd! / 2 + k * sAd!);
  if (cheia) partes.push(rect(x0, y0, W, T, GRAUTE, GRAUTE_LINHA, 1.2));
  else {
    partes.push(rect(x0, y0, W, T, VAZIO, TINTA, 0.8));
    partes.push(rect(x0, y0, W, hf! * s, MESA, TINTA, 1));
    partes.push(rect(x0, y1 - hf! * s, W, hf! * s, MESA, TINTA, 1));
    for (const xb of xs) {
      const a = Math.max(0, xb - bw / 2), e = Math.min(b, xb + bw / 2);
      partes.push(rect(x0 + a * s, y0, (e - a) * s, T, GRAUTE, GRAUTE_LINHA, 1.2));
    }
  }
  // o bloco comprimido e a linha neutra, junto da face externa (embaixo). Na mesa: 0,8x na largura toda. Seção T
  // (12/10): a parede do bloco inteira (hf) + a altura y nas almas grauteadas, só onde há furo grauteado.
  const mesaSo = r.v('ln_mesa') === 'Sim';
  const yAlma = r.num('y_alma');
  const COMP = 'fill="#f8cbad" fill-opacity="0.75" stroke="#c55a11" stroke-width="1"';
  if (x !== null && x > 0 && x < t!) {
    if (mesaSo || yAlma === null) {
      partes.push(`<rect x="${x0.toFixed(2)}" y="${(y1 - 0.8 * x * s).toFixed(2)}" width="${W.toFixed(2)}" height="${(0.8 * x * s).toFixed(2)}" ${COMP}/>`);
    } else {
      partes.push(`<rect x="${x0.toFixed(2)}" y="${(y1 - hf! * s).toFixed(2)}" width="${W.toFixed(2)}" height="${(hf! * s).toFixed(2)}" ${COMP}/>`);
      const almas: Array<[number, number]> = cheia ? [[0, b]] : xs.map((xb) => [Math.max(0, xb - bw / 2), Math.min(b, xb + bw / 2)]);
      for (const [a0, a1] of almas)
        partes.push(`<rect x="${(x0 + a0 * s).toFixed(2)}" y="${(y1 - (hf! + yAlma) * s).toFixed(2)}" width="${((a1 - a0) * s).toFixed(2)}" height="${(yAlma * s).toFixed(2)}" ${COMP}/>`);
    }
    partes.push(`<line x1="${(x0 - 6).toFixed(2)}" y1="${(y1 - x * s).toFixed(2)}" x2="${(x0 + W + 6).toFixed(2)}" y2="${(y1 - x * s).toFixed(2)}" stroke="#c55a11" stroke-width="1.2" stroke-dasharray="8 4 2 4"/>`);
    partes.push(texto(x0 + W + 10, y1 - x * s + 4, 'LN', 11, 'start'));
  }
  const rb = Math.max(3, ((r.num('phi_v') ?? 10) / 20) * s);
  const yb = y1 - d! * s;
  for (const xb of xs) partes.push(`<circle cx="${(x0 + xb * s).toFixed(2)}" cy="${yb.toFixed(2)}" r="${rb.toFixed(2)}" fill="${ACO}"/>`);

  // cotas: b embaixo, s em cima (entre as duas primeiras barras), t à direita, hf, d, x e 0,8x à esquerda
  const yCb = y1 + 26;
  partes.push(chamada(x0, y1, x0, yCb + 4), chamada(x0 + W, y1, x0 + W, yCb + 4));
  partes.push(cota(x0, yCb, x0 + W, yCb, 'b = 100', 1));
  if (xs.length > 1) {
    const yCs = yS - 10, xa = x0 + xs[0] * s, xb2 = x0 + xs[1] * s;
    partes.push(chamada(xa, yb, xa, yCs - 4), chamada(xb2, yb, xb2, yCs - 4));
    partes.push(cota(xa, yCs, xb2, yCs, `s = ${cm(sAd!)}`, -1));
  }
  const xT = x0 + W + 40;
  partes.push(chamada(x0 + W, y0, xT + 4, y0), chamada(x0 + W, y1, xT + 4, y1));
  partes.push(cota(xT, y0, xT, y1, `t = ${cm(t!)}`, 1));
  const xD = x0 - 20;
  partes.push(chamada(x0 + xs[0] * s, yb, xD - 4, yb), chamada(x0, y1, xD - 4, y1));
  partes.push(cota(xD, yb, xD, y1, `d = ${cm(d!)}`, -1));
  if (x !== null && x > 0 && x < t!) {
    const xX = x0 - 60;
    partes.push(chamada(x0, y1 - x * s, xX - 4, y1 - x * s), chamada(x0, y1, xX - 4, y1));
    partes.push(cota(xX, y1 - x * s, xX, y1, `x = ${nbr(x, 2)}`, -1));
  }
  if (!cheia) {
    const xH = x0 + W + 90;
    partes.push(chamada(x0 + W, y1 - hf! * s, xH + 4, y1 - hf! * s), chamada(x0 + W, y1, xH + 4, y1));
    partes.push(cota(xH, y1 - hf! * s, xH, y1, `hf = ${cm(hf!)}`, 1));
  }
  const Wt = Math.ceil(x0 + W + 170), Ht = Math.ceil(yCb + 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wt} ${Ht}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${Wt}" height="${Ht}" fill="#ffffff"/>${partes.join('')}</svg>`;
  return { svg, titulo: 'Seção da flexão: faixa de 1 m (cm)' };
}
