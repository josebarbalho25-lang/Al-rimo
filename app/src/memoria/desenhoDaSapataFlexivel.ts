/*
  DESENHOS DA SAPATA FLEXÍVEL E DA ANCORAGEM DA ESPERA (16/11; aba Fundação, seções 9 e 14, tools/fundacao.py).
  Jose, 16/11: a sapata flexível passa a ser CALCULADA (não barrada). Quatro desenhos, todos cotados com os números
  das células (nada aqui é conta nova, só a posição no papel):
    1. a classe: os dois balanços medidos das faces do muro e a altura — rígida quando h ≥ 2/3 do maior balanço;
    2. a punção sob o muro: o contorno C′ a 2d das faces (duas retas: a carga é em linha) e as fatias além dele;
    3. a punção junto ao contraforte, em planta: o contorno a 2d em volta do contraforte, recortado pelas bordas;
    4. a ancoragem da espera: a altura disponível na sapata × o ℓb,nec da maior espera.
  O traço é o dos desenhos de desenhoDaSapata.ts (mesma régua: concreto, bloco, laranja das forças).
*/
import type { Resultado } from '@/motor/tipos';
import { nbr } from './formato';
import type { DesenhoDoCard } from './desenhoDaSecaoCf';
import { desenhoDaSecaoAFace } from './desenhoDaSapata';

const TINTA = '#1a1a1a';
const COTA = '#3a3a3a';
const CONCRETO = '#ececec';
const BLOCO = '#d6d6d6';
const LARANJA = '#c55a11';
const VERMELHO = '#c00000';
const VERDE = '#2f7d32';
const FS = 14;
const LARGURA = 770;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (v: number) => v.toFixed(2);
const texto = (x: number, y: number, s: string, tam = FS, ancora: 'start' | 'middle' | 'end' = 'middle', cor = TINTA, peso = 'normal') =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${tam}" text-anchor="${ancora}" fill="${cor}" font-weight="${peso}">${esc(s)}</text>`;
const lin = (x1: number, y1: number, x2: number, y2: number, cor = TINTA, sw = 1, extra = '') =>
  `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${cor}" stroke-width="${sw}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = TINTA, sw = 1, extra = '') =>
  `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;
const marca = (x: number, y: number) => lin(x - 4, y + 4, x + 4, y - 4, COTA, 1.1);
const cotaH = (xa: number, xb: number, y: number, rot: string) =>
  lin(xa, y, xb, y, COTA, 0.8) + marca(xa, y) + marca(xb, y) + texto((xa + xb) / 2, y - 5, rot, FS - 1);
const cotaV = (x: number, ya: number, yb: number, rot: string, lado: 1 | -1) =>
  lin(x, ya, x, yb, COTA, 0.8) + marca(x, ya) + marca(x, yb) + texto(x + lado * 7, (ya + yb) / 2 + 5, rot, FS - 1, lado > 0 ? 'start' : 'end');
const chamada = (x1: number, y1: number, x2: number, y2: number) => lin(x1, y1, x2, y2, COTA, 0.4, ' stroke-dasharray="2 2"');
const svgDe = (partes: string[], H: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${Math.ceil(H)}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${LARGURA}" height="${Math.ceil(H)}" fill="#ffffff"/>${partes.join('')}</svg>`;
const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const m2 = (v: number) => nbr(v, 2);

/** O que os desenhos leem da geometria (m); null sem número. */
function geo(r: Resultado) {
  const n = (id: string) => r.num(id);
  const B = n('B_sap'), h = n('h_sap'), a = n('a_ater'), t = n('t_m'), toe = n('toe'), heel = n('heel');
  if (![B, h, a, t, toe, heel].every(ok) || !(B! > 0) || !(h! > 0)) return null;
  return { B: B!, h: h!, a: a!, t: t!, toe: toe!, heel: heel! };
}

/**
  1. A CLASSE DA SAPATA: os dois balanços cotados a partir das faces do muro e a altura. As retas tracejadas descem
  do topo de cada face na inclinação 1 : 1,5 (h = 2/3 do balanço): a sapata é rígida quando a do balanço MAIOR chega
  ao fundo antes da borda (NBR 6118 22.6.1 lida para o balanço maior — dedução).
*/
export function desenhoDaClasseDaSapata(r: Resultado): DesenhoDoCard | null {
  const g = geo(r);
  const hRig = r.num('h_rig');
  if (!g || !ok(hRig)) return null;
  const s = 540 / g.B;
  const xPe = 100, yTopo = 80;
  const hPx = Math.max(g.h * s, 18);
  const X = (x: number) => xPe + (g.B - x) * s;           // x da borda aterrada → papel (pé à esquerda)
  const xFaceFora = X(g.a + g.t / 2), xFaceSolo = X(g.a - g.t / 2), xFim = X(0);
  const yBase = yTopo + hPx;
  const partes: string[] = [];
  partes.push(rect(xPe, yTopo, g.B * s, hPx, CONCRETO, TINTA, 1.4));
  partes.push(rect(xFaceFora, yTopo - 50, xFaceSolo - xFaceFora, 50, BLOCO, TINTA, 1.2));
  partes.push(`<path d="M ${f2(xFaceFora - 4)} ${f2(yTopo - 50)} l 8 -5 l 6 10 l 8 -5" fill="none" stroke="${TINTA}" stroke-width="1"/>`);
  // a reta 1 : 1,5 a partir do topo de cada face; recortada na borda da sapata
  const desce = (x: number, dir: -1 | 1, limite: number) => {
    const xf = x + dir * 1.5 * hPx;
    const xc = dir < 0 ? Math.max(xf, limite) : Math.min(xf, limite);
    const yc = yTopo + (Math.abs(xc - x) / (1.5 * hPx)) * hPx;
    partes.push(lin(x, yTopo, xc, yc, LARANJA, 1.3, ' stroke-dasharray="6 4"'));
  };
  if (g.toe > 0.005) desce(xFaceFora, -1, xPe);
  if (g.heel > 0.005) desce(xFaceSolo, 1, xFim);
  const yC = yBase + 34;
  for (const x of [xPe, xFaceFora, xFaceSolo, xFim]) partes.push(chamada(x, yBase, x, yC + 4));
  if (g.toe > 0.005) partes.push(cotaH(xPe, xFaceFora, yC, `ponta ${m2(g.toe)} m`));
  partes.push(cotaH(xFaceFora, xFaceSolo, yC, `t ${m2(g.t)}`));
  if (g.heel > 0.005) partes.push(cotaH(xFaceSolo, xFim, yC, `talão ${m2(g.heel)} m`));
  partes.push(cotaV(xFim + 22, yTopo, yBase, `h = ${m2(g.h)} m`, 1));
  const rigida = g.h >= hRig - 0.0005;
  const yT = yC + 36;
  partes.push(texto(xPe, yT, `h,rig = 2/3 × ${m2(Math.max(g.toe, g.heel))} m = ${nbr(hRig, 3)} m ${rigida ? '≤' : '>'} h = ${m2(g.h)} m`, FS, 'start', TINTA, 'bold'));
  partes.push(texto(xPe, yT + 22, rigida ? 'rígida' : 'flexível: laje e punção', FS - 1, 'start', rigida ? VERDE : LARANJA, 'bold'));
  return { svg: svgDe(partes, yT + 34), titulo: 'Classe da sapata: os balanços medidos das faces do muro', largura: LARGURA };
}

/** 2. PUNÇÃO SOB O MURO: a seção a 2d das faces (o desenho do cortante, com 2d). */
export const desenhoDaPuncaoSobOMuro = (r: Resultado): DesenhoDoCard | null => desenhoDaSecaoAFace(r, 2);

/**
  3. PUNÇÃO JUNTO AO CONTRAFORTE, em planta: um trecho da sapata (largura B na vertical; borda do lado do contraforte
  em cima), o muro deitado na horizontal, o contraforte C1 × C2 (o comprimento inclui a parede), o contorno C′ a 2d
  (retas a 2d das faces, arcos de raio 2d nos cantos) recortado pelas bordas, e as distâncias às bordas.
*/
export function desenhoDaPuncaoNoContraforte(r: Resultado): DesenhoDoCard | null {
  const g = geo(r);
  const d = r.num('d_s'), C1 = r.num('tenr_adot'), C2 = r.num('eenr'), e1 = r.num('e1_pun'), e2 = r.num('e2_pun');
  if (!g || !ok(d) || !ok(C1) || !ok(C2) || !ok(e1) || !ok(e2) || r.v('Tipo_muro') !== 'Contrafortes') return null;
  const caso = String(r.v('cas_pun') ?? '');
  const Bcm = g.B * 100, tCm = g.t * 100;
  const R = 2 * d;
  const largura = Math.max(C2 + 2 * R + 100, 200);
  const s = Math.min(520 / largura, 340 / Bcm);
  const x0 = 130, y0 = 50;
  const X = (x: number) => x0 + (x + largura / 2) * s;     // x = 0 no eixo do contraforte (cm)
  const Y = (y: number) => y0 + y * s;                     // y = 0 na borda do lado do contraforte (cm)
  const ya = e1, yb = e1 + C1;                             // ponta do contraforte e a outra face do muro
  const partes: string[] = [];
  partes.push(rect(X(-largura / 2), Y(0), largura * s, Bcm * s, CONCRETO, TINTA, 1.4));
  partes.push(rect(X(-largura / 2), Y(yb - tCm), largura * s, tCm * s, BLOCO, TINTA, 1));
  partes.push(rect(X(-C2 / 2), Y(ya), C2 * s, C1 * s, '#c4c4c4', TINTA, 1.4));
  const xa = -C2 / 2, xb = C2 / 2, Rs = R * s;
  const caminho = `M ${f2(X(xa))} ${f2(Y(ya - R))} L ${f2(X(xb))} ${f2(Y(ya - R))} A ${f2(Rs)} ${f2(Rs)} 0 0 1 ${f2(X(xb + R))} ${f2(Y(ya))} `
    + `L ${f2(X(xb + R))} ${f2(Y(yb))} A ${f2(Rs)} ${f2(Rs)} 0 0 1 ${f2(X(xb))} ${f2(Y(yb + R))} L ${f2(X(xa))} ${f2(Y(yb + R))} `
    + `A ${f2(Rs)} ${f2(Rs)} 0 0 1 ${f2(X(xa - R))} ${f2(Y(yb))} L ${f2(X(xa - R))} ${f2(Y(ya))} A ${f2(Rs)} ${f2(Rs)} 0 0 1 ${f2(X(xa))} ${f2(Y(ya - R))} Z`;
  partes.push(`<defs><clipPath id="alrimoPunCf"><rect x="${f2(X(-largura / 2))}" y="${f2(Y(0))}" width="${f2(largura * s)}" height="${f2(Bcm * s)}"/></clipPath></defs>`);
  partes.push(`<path d="${caminho}" fill="none" stroke="${LARANJA}" stroke-width="1.8" stroke-dasharray="7 4" clip-path="url(#alrimoPunCf)"/>`);
  const xCota = X(-largura / 2) - 16;
  if (e1 > 0.05) partes.push(cotaV(xCota, Y(0), Y(ya), `e1 = ${nbr(e1, 1)}`, -1));
  partes.push(cotaV(xCota, Y(ya), Y(yb), `C1 = ${nbr(C1, 0)}`, -1));
  if (e2 > 0.05) partes.push(cotaV(xCota, Y(yb), Y(Bcm), `e2 = ${nbr(e2, 1)}`, -1));
  partes.push(cotaH(X(xa), X(xb), Y(Bcm) + 24, `C2 = ${nbr(C2, 0)}`));
  partes.push(cotaH(X(xb), X(xb + R), Y(ya) + 18, `2d = ${nbr(R, 1)}`));
  partes.push(texto(X(largura / 2) + 8, Y(0) + 14, 'borda', FS - 2, 'start', COTA));
  partes.push(texto(X(largura / 2) + 8, Y(Bcm) - 4, 'borda', FS - 2, 'start', COTA));
  partes.push(texto(X(largura / 2) + 8, Y(yb - tCm / 2) + 5, 'muro', FS - 2, 'start', COTA));
  const yT = Y(Bcm) + 60;
  partes.push(texto(x0, yT, `contorno C′ a 2d: ${caso}`, FS, 'start', TINTA, 'bold'));
  partes.push(texto(x0, yT + 20, 'cotas em cm', FS - 2, 'start', COTA));
  return { svg: svgDe(partes, yT + 30), titulo: 'Punção junto ao contraforte: o contorno C′ a 2d, em planta', largura: LARGURA };
}

/**
  4. ANCORAGEM DA ESPERA NA SAPATA (NBR 6118 22.6.4.1.2): o corte da sapata junto à face do muro, a espera descendo do
  topo até a malha, a altura disponível (h − c − Ø principal − Ø secundária) e o ℓb,nec da maior espera ao lado.
  O que passa da altura disponível sai em vermelho tracejado.
*/
export function desenhoDaAncoragemDaEspera(r: Resultado): DesenhoDoCard | null {
  const disp = r.num('lbd_esp'), nec = r.num('la_max'), c = r.num('cob_sap'), h = r.num('h_sap');
  const phiS = r.num('phi_sap'), phiS2 = r.num('phi_sap2');
  if (!ok(disp) || !ok(nec) || !ok(c) || !ok(h) || !ok(phiS) || !ok(phiS2) || !(nec > 0)) return null;
  const hCm = h * 100;
  const s = 300 / (Math.max(hCm, nec) + 6);
  const x0 = 140, yTopo = 70, L = 320;
  const Y = (cm: number) => yTopo + cm * s;
  const partes: string[] = [];
  partes.push(rect(x0, Y(0), L, hCm * s, CONCRETO, TINTA, 1.4));
  partes.push(rect(x0 + L / 2 - 40, Y(0) - 50, 80, 50, BLOCO, TINTA, 1.2));
  // malha: a principal (transversal, no plano do corte: linha) sobre o cobrimento e a secundária (longitudinal,
  // cortada: pontos) por cima dela
  const yP = hCm - c - phiS / 20, yS = hCm - c - phiS / 10 - phiS2 / 20;
  partes.push(lin(x0 + 8, Y(yP), x0 + L - 8, Y(yP), VERMELHO, Math.max(1.2, (phiS / 10) * s)));
  for (let k = 0; k < 9; k++) partes.push(`<circle cx="${f2(x0 + 20 + k * 35)}" cy="${f2(Y(yS))}" r="${f2(Math.max(2.2, (phiS2 / 20) * s))}" fill="${VERMELHO}"/>`);
  const xe = x0 + L / 2;
  const passa = nec <= disp + 0.00005;
  partes.push(lin(xe, Y(0) - 50, xe, Y(Math.min(nec, disp)), VERDE, 3));
  if (!passa) partes.push(lin(xe, Y(disp), xe, Y(nec), VERMELHO, 3, ' stroke-dasharray="5 3"'));
  partes.push(cotaV(x0 - 16, Y(0), Y(hCm), `h = ${nbr(hCm, 1)}`, -1));
  partes.push(cotaV(x0 - 80, Y(hCm - c), Y(hCm), `c = ${nbr(c, 1)}`, -1));
  partes.push(cotaV(x0 + L + 18, Y(0), Y(disp), `disponível ${nbr(disp, 1)}`, 1));
  partes.push(cotaV(x0 + L + 170, Y(0), Y(nec), `ℓb,nec ${nbr(nec, 0)}`, 1));
  const yT = Math.max(Y(hCm), Y(nec)) + 40;
  partes.push(texto(x0, yT, passa ? `ℓb,nec ${nbr(nec, 0)} ≤ ${nbr(disp, 1)} cm` : `ℓb,nec ${nbr(nec, 0)} > ${nbr(disp, 1)} cm: faltam ${nbr(nec - disp, 1)} cm`, FS, 'start', passa ? VERDE : VERMELHO, 'bold'));
  partes.push(texto(x0, yT + 20, 'cotas em cm', FS - 2, 'start', COTA));
  return { svg: svgDe(partes, yT + 30), titulo: 'Ancoragem da espera: altura disponível na sapata × ℓb,nec da maior espera', largura: LARGURA };
}
