/*
  A SEÇÃO DO CONTRAFORTE DESENHADA E COTADA — a figura do card de flexão (e do ELS) da memória.

  POR QUE EXISTE: o Jose confere pela memória, e o que mais pesa no contraforte é o braço de alavanca (d) e a inércia
  da seção real de cada montagem (09/10). A conta simplificada não mostrava ONDE a barra está; esta figura mostra: a
  planta da seção na base, com o muro como mesa (largura colaborante bm), a haste com os furos do bloco da fiada P,
  o furo da barra (trecho comum às fiadas P e I, grauteado) e as barras na posição em que o 3D as põe.

  DE ONDE VEM CADA COISA (nada aqui é conta nova):
    - números das cotas (bm, t, tenr, d, c, nº e Ø das barras): as CÉLULAS da planilha, os mesmos que as linhas da
      memória mostram — a figura nunca diz um número diferente da conta;
    - peças, furos e trecho comum: modulacao/secaoDoContraforte.ts (catálogo medido no Revit + receitas dos encaixes);
    - arrumação das barras e das esperas: modulacao/arranjo.ts, a mesma do 3D.
  Detalhe A (à direita): o furo da barra em escala maior, com as duas cotas que dão o c (face → começo do trecho comum
  e o comprimento dele) — o c sai à vista: c = a + ℓ/2.

  Desenho de papel (fundo branco, traço escuro): no tema escuro ele fica numa folha, como as figuras do acervo; na
  exportação para o Word o SVG vira PNG (word.ts). Sem <defs> nem ids: dois cards com a mesma figura na mesma página
  não colidem.
*/
import type { Resultado } from '@/motor/tipos';
import type { Vec2 } from '@/modelo/tipos';
import { arranjoNaSecao, etaDaBarra, secaoDoContraforte, type FuroEmPlanta, type SecaoDoContraforte } from '@/modulacao/secaoDoContraforte';
import { retanguloArredondado } from '@/modulacao/perfis';
import { nbr } from './formato';
import type { Desenho } from './tipos';

/** SVG completo (string), pronto para pôr na página, e o título dele (tipos.ts). */
export type DesenhoDoCard = Desenho;

const TINTA = '#1a1a1a';
const MURO = '#d6d6d6';        // alvenaria da seção (bruta)
const FORA = '#efefef';        // alvenaria que não entra na seção
const GRAUTE = '#bdbdbd';      // graute do furo da barra
const FURO = '#f7f7f7';        // furos grauteados da haste (desenho do bloco)
const COTA = '#3a3a3a';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Cota em cm a partir de mm: uma casa (as medidas dos templates são de meio milímetro, nada passa disso). */
const cm1 = (mm: number) => nbr(mm / 10, 1);
/** Cota que vem de célula (cm): inteiro sem casa; senão uma casa — o que a linha da memória mostra, sem o ",0". */
const cmCel = (v: number) => nbr(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);

interface Tela { x: (X: number) => number; y: (eta: number) => number; s: number }

function poligono(p: Vec2[], t: Tela, estilo: string): string {
  const pts = p.map(([X, e]) => `${t.x(X).toFixed(2)},${t.y(e).toFixed(2)}`).join(' ');
  return `<polygon points="${pts}" ${estilo}/>`;
}

const furoPoligono = (f: FuroEmPlanta): Vec2[] => retanguloArredondado(2 * f.a, 2 * f.b, f.r, f.cx - f.a, f.cy - f.b);

function retangulo(x0: number, e0: number, x1: number, e1: number, t: Tela, estilo: string): string {
  const xa = Math.min(t.x(x0), t.x(x1));
  const ya = Math.min(t.y(e0), t.y(e1));
  return `<rect x="${xa.toFixed(2)}" y="${ya.toFixed(2)}" width="${Math.abs(t.x(x1) - t.x(x0)).toFixed(2)}" height="${Math.abs(t.y(e1) - t.y(e0)).toFixed(2)}" ${estilo}/>`;
}

function texto(x: number, y: number, s: string, o: { tam?: number; ancora?: 'start' | 'middle' | 'end'; giro?: boolean; peso?: number } = {}): string {
  const tam = o.tam ?? 11.5;
  const tr = o.giro ? ` transform="rotate(-90 ${x.toFixed(2)} ${y.toFixed(2)})"` : '';
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${tam}" text-anchor="${o.ancora ?? 'middle'}"${o.peso ? ` font-weight="${o.peso}"` : ''} fill="${TINTA}"${tr}>${esc(s)}</text>`;
}

/** Cota em tela: linha de cota entre (x1,y1)–(x2,y2) com traço oblíquo nas pontas (sem marcador: sem ids). */
function cota(x1: number, y1: number, x2: number, y2: number, rotulo: string, lado: 1 | -1, tam = 11): string {
  const vertical = Math.abs(x1 - x2) < 1e-6;
  const tick = (x: number, y: number) => `<line x1="${(x - 3).toFixed(2)}" y1="${(y + 3).toFixed(2)}" x2="${(x + 3).toFixed(2)}" y2="${(y - 3).toFixed(2)}" stroke="${COTA}" stroke-width="0.9"/>`;
  let s = `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COTA}" stroke-width="0.6"/>` + tick(x1, y1) + tick(x2, y2);
  if (vertical) s += texto(x1 + lado * 4, (y1 + y2) / 2, rotulo, { tam, giro: true, ancora: 'middle' }).replace('<text', `<text dy="${lado > 0 ? tam * 0.8 : -2}"`);
  else s += texto((x1 + x2) / 2, Math.min(y1, y2) + (lado > 0 ? tam + 3 : -3), rotulo, { tam });
  return s;
}

/** Linha de chamada (extensão) fina e tracejada, da peça até a cota. */
const chamada = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COTA}" stroke-width="0.4" stroke-dasharray="2 2"/>`;

interface Dados {
  sec: SecaoDoContraforte;
  bm: number;         // mm
  c: number;          // mm (célula c_cf)
  d: number;          // mm (célula d_cf)
  n: number;
  phi: number;        // mm
  T: boolean;         // seção T (enterrado)
}

function lerDados(r: Resultado): Dados | null {
  const t = r.num('t_bloco');
  const tenr = r.num('tenr_adot');
  const bm = r.num('bm_cf');
  const c = r.num('c_cf');
  const d = r.num('d_cf');
  const n = r.num('n_cf');
  const phi = r.num('phi_cf');
  if (t === null || tenr === null || bm === null || c === null || d === null || n === null || phi === null) return null;
  if (!(tenr > t) || !(n >= 1) || !(phi > 0) || !(bm > 0)) return null;
  const familia = Math.round(t) === 19 ? '19x39' : '14x39';
  const T = r.num('cf_T') === 1;
  const no = String(r.v('tipo_cf') ?? '').toLowerCase().startsWith('inter') ? 'T' : 'L';
  try {
    const sec = secaoDoContraforte(familia, Math.round(tenr * 10), T ? 'enterrado' : 'aparente', no);
    return { sec, bm: bm * 10, c: c * 10, d: d * 10, n: Math.round(n), phi, T };
  } catch {
    return null;
  }
}

/** A figura da seção do contraforte da montagem atual; null quando a planilha não tem os números (campo apagado). */
export function desenhoDaSecaoDoContraforte(r: Resultado): DesenhoDoCard | null {
  const D = lerDados(r);
  if (!D) return null;
  const { sec, bm, c, d, n, phi, T } = D;
  const { t, tenr } = sec;
  const etaBarra = etaDaBarra(sec, c);
  const arr = arranjoNaSecao(sec, c, n, phi);
  const furo = sec.furo;
  const faceTracionada = T ? tenr : 0;     // enterrado: ponta; aparente: face do solo
  const faceComprimida = T ? 0 : tenr;

  // largura fixa; a altura acompanha o desenho (contraforte curto não deixa folha vazia embaixo)
  const W = 640;
  const partes: string[] = [];

  // ── vista geral (esquerda) ──
  const larguraMesa = T ? bm : t;
  const sobra = Math.max(1.2 * t, 0.12 * larguraMesa);          // muro além da mesa colaborante (fora da seção)
  const Wtot = larguraMesa + 2 * sobra;
  const area = { x0: 62, x1: 392, y0: 46 };
  const s1 = Math.min((area.x1 - area.x0) / Wtot, 300 / tenr);
  const cx1 = (area.x0 + area.x1) / 2;
  const v1: Tela = { s: s1, x: (X) => cx1 + X * s1, y: (e) => area.y0 + e * s1 };
  const linhaFina = `stroke="${TINTA}" stroke-width="0.5"`;
  const contorno = `fill="none" stroke="${TINTA}" stroke-width="1.3"`;
  // muro: o trecho fora da seção mais claro; a mesa colaborante (enterrado) com a cor da seção
  partes.push(retangulo(-Wtot / 2, 0, Wtot / 2, t, v1, `fill="${FORA}" stroke="none"`));
  if (T) partes.push(retangulo(-bm / 2, 0, bm / 2, t, v1, `fill="${MURO}" stroke="none"`));
  // alma (haste) — no aparente, a seção é só ela (com o pedaço de muro da célula do contraforte)
  partes.push(retangulo(-t / 2, T ? t : 0, t / 2, tenr, v1, `fill="${MURO}" stroke="none"`));
  // furos da fiada P na haste (grauteados) e as juntas entre as peças
  for (const p of sec.haste.P) {
    for (const f of p.furos) partes.push(poligono(furoPoligono(f), v1, `fill="${FURO}" ${linhaFina}`));
    partes.push(`<line x1="${v1.x(-t / 2).toFixed(2)}" y1="${v1.y(p.eta).toFixed(2)}" x2="${v1.x(t / 2).toFixed(2)}" y2="${v1.y(p.eta).toFixed(2)}" ${linhaFina}/>`);
  }
  // furo da barra: trecho comum grauteado + o contorno da fiada P (cheio) e da fiada I (tracejado)
  partes.push(poligono(furo.poligono, v1, `fill="${GRAUTE}" stroke="none"`));
  partes.push(poligono(furoPoligono(furo.P), v1, `fill="none" ${linhaFina}`));
  partes.push(poligono(furoPoligono(furo.I), v1, `fill="none" stroke="${TINTA}" stroke-width="0.5" stroke-dasharray="3 2"`));
  // contorno da seção de cálculo (T ou retângulo)
  if (T) {
    const xm = bm / 2;
    const xa = t / 2;
    partes.push(poligono([[-xm, 0], [xm, 0], [xm, t], [xa, t], [xa, tenr], [-xa, tenr], [-xa, t], [-xm, t]], v1, contorno));
  } else {
    partes.push(retangulo(-t / 2, 0, t / 2, tenr, v1, contorno));
  }
  // limites do muro desenhado (linha fina nas pontas: o muro continua)
  partes.push(`<line x1="${v1.x(-Wtot / 2).toFixed(2)}" y1="${v1.y(0).toFixed(2)}" x2="${v1.x(Wtot / 2).toFixed(2)}" y2="${v1.y(0).toFixed(2)}" ${linhaFina}/>`);
  partes.push(`<line x1="${v1.x(-Wtot / 2).toFixed(2)}" y1="${v1.y(t).toFixed(2)}" x2="${v1.x(Wtot / 2).toFixed(2)}" y2="${v1.y(t).toFixed(2)}" ${linhaFina}/>`);
  // barras (pontos cheios) e esperas (vazados), mesmo pequenos: mostram onde o grupo está
  const rb1 = Math.max(1.3, (phi / 2) * s1);
  for (const [X, e] of arr.esperas) partes.push(`<circle cx="${v1.x(X).toFixed(2)}" cy="${v1.y(e).toFixed(2)}" r="${rb1.toFixed(2)}" fill="#ffffff" stroke="${TINTA}" stroke-width="0.4"/>`);
  for (const [X, e] of arr.barras) partes.push(`<circle cx="${v1.x(X).toFixed(2)}" cy="${v1.y(e).toFixed(2)}" r="${rb1.toFixed(2)}" fill="${TINTA}"/>`);
  // chamada do detalhe A
  const rA = Math.max(furo.P.b, furo.I.b, furo.P.a, furo.I.a) * s1 + 7;
  const cyA = (furo.de + furo.ate) / 2;
  partes.push(`<circle cx="${v1.x(0).toFixed(2)}" cy="${v1.y(cyA).toFixed(2)}" r="${rA.toFixed(2)}" fill="none" stroke="${COTA}" stroke-width="0.6" stroke-dasharray="4 2"/>`);
  partes.push(texto(v1.x(0) + rA * 0.75 + 4, v1.y(cyA) - rA * 0.75, 'A', { tam: 13, ancora: 'start', peso: 700 }));

  // cotas da vista geral
  const yTopo = v1.y(0) - 16;
  if (T) {
    partes.push(chamada(v1.x(-bm / 2), v1.y(0), v1.x(-bm / 2), yTopo - 3), chamada(v1.x(bm / 2), v1.y(0), v1.x(bm / 2), yTopo - 3));
    partes.push(cota(v1.x(-bm / 2), yTopo, v1.x(bm / 2), yTopo, `bm = ${cmCel(bm / 10)}`, -1));
  }
  const xEsq = v1.x(-Wtot / 2) - 12;
  partes.push(chamada(v1.x(-Wtot / 2), v1.y(t), xEsq - 3, v1.y(t)));
  partes.push(cota(xEsq, v1.y(0), xEsq, v1.y(t), `t = ${cmCel(t / 10)}`, -1));
  const xT = Math.min(v1.x(-t / 2) - 30, xEsq - 22);
  partes.push(chamada(v1.x(-t / 2), v1.y(tenr), xT - 3, v1.y(tenr)));
  partes.push(cota(xT, v1.y(0), xT, v1.y(tenr), `tenr = ${cmCel(tenr / 10)}`, -1));
  const xDir = v1.x(t / 2) + 16;
  partes.push(chamada(v1.x(0), v1.y(etaBarra), xDir + 3, v1.y(etaBarra)));
  partes.push(cota(xDir, v1.y(faceComprimida), xDir, v1.y(etaBarra), `d = ${cmCel(d / 10)}`, 1));
  partes.push(cota(xDir + 22, v1.y(etaBarra), xDir + 22, v1.y(faceTracionada), `c = ${cmCel(c / 10)}`, 1));
  partes.push(chamada(v1.x(t / 2), v1.y(faceTracionada), xDir + 25, v1.y(faceTracionada)));
  const yBase = v1.y(tenr) + 14;
  partes.push(cota(v1.x(-t / 2), yBase, v1.x(t / 2), yBase, `bw = ${cmCel(t / 10)}`, 1));
  // de que lado está o solo (enterrado: o da haste; aparente: o oposto)
  partes.push(texto(v1.x(Wtot / 2) - 2, T ? v1.y(t) + 14 : v1.y(0) - 6, 'solo', { tam: 10.5, ancora: 'end' }));

  // ── detalhe A (direita) ──
  const d0 = { x0: 430, x1: W - 16, y0: 40 };
  const furos = [furo.P, furo.I];
  const ax = Math.max(...furos.map((f) => Math.abs(f.cx) + f.a)) + 14;
  let e0 = Math.min(...furos.map((f) => f.cy - f.b)) - 14;
  let e1 = Math.max(...furos.map((f) => f.cy + f.b)) + 14;
  e0 = Math.min(e0, faceTracionada - (T ? 0 : 8));
  e1 = Math.max(e1, faceTracionada + (T ? 8 : 0));
  const s2 = Math.min((d0.x1 - d0.x0 - 64) / (2 * ax), 240 / (e1 - e0));
  const cx2 = d0.x0 + 12 + ax * s2;
  const v2: Tela = { s: s2, x: (X) => cx2 + X * s2, y: (e) => d0.y0 + (e - e0) * s2 };
  partes.push(texto((d0.x0 + d0.x1) / 2 - 20, d0.y0 - 16, 'Detalhe A', { tam: 13, peso: 700 }));
  // alvenaria no recorte: a haste (largura t); no aparente também o muro (a barra está nele)
  const clipX = (X: number) => Math.max(-ax, Math.min(ax, X));
  const eAlma0 = Math.max(e0, T ? t : 0);
  const eAlma1 = Math.min(e1, tenr);
  partes.push(retangulo(-t / 2, eAlma0, t / 2, eAlma1, v2, `fill="${MURO}" stroke="none"`));
  if (!T) partes.push(retangulo(clipX(-ax), Math.max(e0, 0), clipX(ax), Math.min(e1, t), v2, `fill="${MURO}" stroke="none"`));
  partes.push(poligono(furo.poligono, v2, `fill="${GRAUTE}" stroke="none"`));
  partes.push(poligono(furoPoligono(furo.P), v2, `fill="none" stroke="${TINTA}" stroke-width="1"`));
  partes.push(poligono(furoPoligono(furo.I), v2, `fill="none" stroke="${TINTA}" stroke-width="1" stroke-dasharray="5 3"`));
  // bordas da alvenaria no recorte
  partes.push(`<line x1="${v2.x(-t / 2).toFixed(2)}" y1="${v2.y(eAlma0).toFixed(2)}" x2="${v2.x(-t / 2).toFixed(2)}" y2="${v2.y(eAlma1).toFixed(2)}" stroke="${TINTA}" stroke-width="1.3"/>`);
  partes.push(`<line x1="${v2.x(t / 2).toFixed(2)}" y1="${v2.y(eAlma0).toFixed(2)}" x2="${v2.x(t / 2).toFixed(2)}" y2="${v2.y(eAlma1).toFixed(2)}" stroke="${TINTA}" stroke-width="1.3"/>`);
  const xf0 = T ? -t / 2 : clipX(-ax);
  const xf1 = T ? t / 2 : clipX(ax);
  partes.push(`<line x1="${v2.x(xf0).toFixed(2)}" y1="${v2.y(faceTracionada).toFixed(2)}" x2="${v2.x(xf1).toFixed(2)}" y2="${v2.y(faceTracionada).toFixed(2)}" stroke="${TINTA}" stroke-width="1.3"/>`);
  // barras e esperas em escala
  const rb2 = (phi / 2) * s2;
  for (const [X, e] of arr.esperas) partes.push(`<circle cx="${v2.x(X).toFixed(2)}" cy="${v2.y(e).toFixed(2)}" r="${rb2.toFixed(2)}" fill="#ffffff" stroke="${TINTA}" stroke-width="0.7"/>`);
  for (const [X, e] of arr.barras) partes.push(`<circle cx="${v2.x(X).toFixed(2)}" cy="${v2.y(e).toFixed(2)}" r="${rb2.toFixed(2)}" fill="${TINTA}"/>`);
  // eixo das barras
  partes.push(`<line x1="${v2.x(-ax).toFixed(2)}" y1="${v2.y(etaBarra).toFixed(2)}" x2="${v2.x(ax).toFixed(2)}" y2="${v2.y(etaBarra).toFixed(2)}" stroke="${COTA}" stroke-width="0.5" stroke-dasharray="8 2 2 2"/>`);
  // cotas do c: face tracionada → começo do trecho comum (a) e o comprimento dele (ℓ); do outro lado, o c
  const perto = T ? furo.ate : furo.de;          // borda do trecho comum do lado da face tracionada
  const longe = T ? furo.de : furo.ate;
  const xc1 = v2.x(ax) + 8;
  partes.push(chamada(v2.x(t / 2), v2.y(faceTracionada), xc1 + 3, v2.y(faceTracionada)));
  partes.push(chamada(v2.x(0), v2.y(perto), xc1 + 3, v2.y(perto)), chamada(v2.x(0), v2.y(longe), xc1 + 3, v2.y(longe)));
  partes.push(cota(xc1, v2.y(faceTracionada), xc1, v2.y(perto), cm1(Math.abs(faceTracionada - perto)), 1, 10.5));
  partes.push(cota(xc1, v2.y(perto), xc1, v2.y(longe), cm1(Math.abs(longe - perto)), 1, 10.5));
  const xc2 = v2.x(-ax) - 8;
  partes.push(chamada(v2.x(-t / 2), v2.y(faceTracionada), xc2 - 3, v2.y(faceTracionada)), chamada(v2.x(0), v2.y(etaBarra), xc2 - 3, v2.y(etaBarra)));
  partes.push(cota(xc2, v2.y(faceTracionada), xc2, v2.y(etaBarra), `c = ${cmCel(c / 10)}`, -1, 11));
  // legenda curta (rótulo, não explicação)
  const fimDetalhe = v2.y(e1);
  const H = Math.ceil(Math.max(yBase + 40, fimDetalhe + 62));
  partes.unshift(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  const yl = fimDetalhe + 24;
  const phiTxt = nbr(phi, Number.isInteger(phi) ? 0 : 1);
  partes.push(`<line x1="${d0.x0}" y1="${yl}" x2="${d0.x0 + 22}" y2="${yl}" stroke="${TINTA}" stroke-width="1"/>`, texto(d0.x0 + 27, yl + 3.5, 'furo na fiada P', { tam: 10.5, ancora: 'start' }));
  partes.push(`<line x1="${d0.x0}" y1="${yl + 15}" x2="${d0.x0 + 22}" y2="${yl + 15}" stroke="${TINTA}" stroke-width="1" stroke-dasharray="5 3"/>`, texto(d0.x0 + 27, yl + 19, 'furo na fiada I', { tam: 10.5, ancora: 'start' }));
  partes.push(`<circle cx="${d0.x0 + 120}" cy="${yl}" r="3.2" fill="${TINTA}"/>`, texto(d0.x0 + 127, yl + 3.5, `${n} Ø${phiTxt}`, { tam: 10.5, ancora: 'start' }));
  partes.push(`<circle cx="${d0.x0 + 120}" cy="${yl + 15}" r="3.2" fill="#ffffff" stroke="${TINTA}" stroke-width="0.7"/>`, texto(d0.x0 + 127, yl + 19, 'espera', { tam: 10.5, ancora: 'start' }));
  partes.push(texto(12, H - 8, 'cotas em cm', { tam: 10, ancora: 'start' }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif">${partes.join('')}</svg>`;
  const titulo = `Seção na base · bloco ${sec.familia.replace('x', '×')} · contraforte de ${cmCel(tenr / 10)} cm (template do Revit)`;
  return { svg, titulo };
}
