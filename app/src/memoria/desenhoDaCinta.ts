/*
  A SEÇÃO DA CINTA DO MURO DE CIMA DESENHADA E COTADA — a figura do card das cintas (aba Muro de cima e vento,
  seção 9). Jose, 15/11: a cinta "sofre flexão no plano e fora do plano — no sentido da gravidade e na lateral".

  POR QUE EXISTE: a mesma barra trabalha nas duas flexões, com braços diferentes. Com 2 barras (uma em cada face, no
  meio da altura) o d da gravidade é só a metade da cinta — o desenho mostra por que a conta pede 4 barras quando a
  gravidade pesa (o d vai a h − 3).

  DE ONDE VEM CADA NÚMERO: as células que as linhas da memória mostram (tc_cmc, hc_cmc, ce_cmc, dl_cmc, dg_cmc,
  n_cin_a, phi_cin_mc). Corte transversal, solo à direita (régua das figuras): o vento sopra do aterro para a frente,
  a face de fora é a tracionada e o d lateral sai da face do solo; a gravidade traciona embaixo.
*/
import type { Resultado } from '@/motor/tipos';
import { nbr } from './formato';
import type { DesenhoDoCard } from './desenhoDaSecaoCf';

const TINTA = '#1a1a1a';
const CONCRETO = '#d4d4d4';
const ACO = '#c00000';
const COTA = '#3a3a3a';
const CARGA = '#2e75b6';
const FS = 15;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (v: number) => v.toFixed(2);
const texto = (x: number, y: number, s: string, ancora: 'start' | 'middle' | 'end' = 'middle', cor = TINTA) =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${FS}" text-anchor="${ancora}" fill="${cor}">${esc(s)}</text>`;
const lin = (x1: number, y1: number, x2: number, y2: number, cor = TINTA, sw = 1, extra = '') =>
  `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${cor}" stroke-width="${sw}"${extra}/>`;
const marca = (x: number, y: number) => lin(x - 4, y + 4, x + 4, y - 4, COTA, 1.1);
const chamada = (x1: number, y1: number, x2: number, y2: number) => lin(x1, y1, x2, y2, COTA, 0.4, ' stroke-dasharray="2 2"');
/** Seta cheia de (xi, yi) a (xf, yf). */
function seta(xi: number, yi: number, xf: number, yf: number, cor: string): string {
  const L = Math.hypot(xf - xi, yf - yi) || 1;
  const ux = (xf - xi) / L, uy = (yf - yi) / L;
  const p1 = [xf - ux * 10 - uy * 5, yf - uy * 10 + ux * 5];
  const p2 = [xf - ux * 10 + uy * 5, yf - uy * 10 - ux * 5];
  return lin(xi, yi, xf, yf, cor, 1.8) + `<path d="M${f2(xf)},${f2(yf)} L${f2(p1[0])},${f2(p1[1])} L${f2(p2[0])},${f2(p2[1])} z" fill="${cor}"/>`;
}

const cm = (v: number) => nbr(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);

export function desenhoDaCinta(r: Resultado): DesenhoDoCard | null {
  const n = (k: string) => r.num(k);
  const t = n('tc_cmc'), h = n('hc_cmc'), ce = n('ce_cmc'), dl = n('dl_cmc'), dg = n('dg_cmc'), phi = n('phi_cin_mc');
  const nb = n('n_cin_a') === 4 ? 4 : 2;
  if ([t, h, ce, dl, dg, phi].some((v) => v === null || !Number.isFinite(v)) || !(t! > 0) || !(h! > 0)) return null;
  const k = 12;                                   // px por cm
  const x0 = 230, y0 = 70;                         // canto de cima, face de fora (esquerda)
  const W = t! * k, H = h! * k;
  const X = (y: number) => x0 + y * k;             // y = cm da face de fora
  const Z = (z: number) => y0 + (h! - z) * k;      // z = cm do fundo da cinta
  const partes: string[] = [];
  partes.push(`<rect x="${f2(x0)}" y="${f2(y0)}" width="${f2(W)}" height="${f2(H)}" fill="${CONCRETO}" stroke="${TINTA}" stroke-width="1.4"/>`);
  // as barras: no meio da altura (2) ou a 3 cm de cima e de baixo (4), com o eixo a ce das duas faces
  const zs = nb === 4 ? [3, h! - 3] : [h! / 2];
  const raio = Math.max(3.5, (phi! / 20) * k);
  for (const z of zs) for (const y of [ce!, t! - ce!]) partes.push(`<circle cx="${f2(X(y))}" cy="${f2(Z(z))}" r="${f2(raio)}" fill="${ACO}"/>`);
  // carga lateral: o vento do aterro (direita) empurra para a frente; carga de gravidade: de cima para baixo
  const xs = x0 + W + 110;
  for (const z of [h! * 0.25, h! / 2, h! * 0.75]) partes.push(seta(xs, Z(z), x0 + W + 14, Z(z), CARGA));
  partes.push(texto(xs + 8, Z(h! / 2) + 5, 'lateral (vento)', 'start', CARGA));
  for (const y of [t! * 0.2, t! / 2, t! * 0.8]) partes.push(seta(X(y), y0 - 52, X(y), y0 - 10, CARGA));
  partes.push(texto(x0 + W / 2, y0 - 58, 'gravidade', 'middle', CARGA));
  // d lateral: da face do solo (comprimida) à barra da face de fora
  const yCota = y0 + H + 34;
  partes.push(chamada(X(t!), y0 + H + 4, X(t!), yCota + 4), chamada(X(ce!), Z(zs[0]!) + raio + 2, X(ce!), yCota + 4));
  partes.push(lin(X(ce!), yCota, X(t!), yCota, COTA, 0.8), marca(X(ce!), yCota), marca(X(t!), yCota));
  partes.push(texto((X(ce!) + X(t!)) / 2, yCota + FS + 4, `d lateral = ${cm(dl!)}`));
  // t embaixo de tudo
  const yT = yCota + 46;
  partes.push(chamada(x0, y0 + H + 4, x0, yT + 4));
  partes.push(lin(x0, yT, x0 + W, yT, COTA, 0.8), marca(x0, yT), marca(x0 + W, yT), texto(x0 + W / 2, yT + FS + 4, `t = ${cm(t!)}`));
  // d de gravidade: do topo (comprimido) à barra de baixo; h à esquerda
  const xD = x0 - 40, xH = x0 - 130;
  const zb = zs[0]!;
  partes.push(chamada(x0 - 4, Z(zb), xD - 4, Z(zb)), chamada(x0 - 4, y0, xH - 4, y0), chamada(x0 - 4, y0 + H, xH - 4, y0 + H));
  partes.push(lin(xD, y0, xD, Z(zb), COTA, 0.8), marca(xD, y0), marca(xD, Z(zb)), texto(xD - 7, (y0 + Z(zb)) / 2 + 5, `d = ${cm(dg!)}`, 'end'));
  partes.push(lin(xH, y0, xH, y0 + H, COTA, 0.8), marca(xH, y0), marca(xH, y0 + H), texto(xH - 7, y0 + H / 2 + 5, `h = ${cm(h!)}`, 'end'));
  // eixo da barra à face
  partes.push(texto(X(ce!), y0 + H + 18, `${cm(ce!)}`, 'middle', COTA));
  partes.push(texto(x0 + W + 14, y0 + H + 18, 'lado do aterro', 'start', COTA));
  const Wt = Math.ceil(xs + 150), Ht = Math.ceil(yT + FS + 16);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wt} ${Ht}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${Wt}" height="${Ht}" fill="#ffffff"/>${partes.join('')}</svg>`,
    titulo: `Seção da cinta do muro de cima: ${nb} barras Ø${nbr(phi!, phi! % 1 ? 1 : 0)} (cm)`,
    largura: Wt,
  };
}
