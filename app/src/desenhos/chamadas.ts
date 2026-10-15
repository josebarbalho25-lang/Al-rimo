/*
  CHAMADAS DAS BARRAS (Jose, 15/10: "hoje o armador não monta só com a prancha") — "N1 – 15 Ø10 c/40 C=210" numa
  coluna ao lado do desenho, cada uma com a linha de chamada até uma barra daquela posição. Os números são os da
  lista de ferros (quantitativo/aco.ts): a quantidade é a do muro inteiro, o C é o comprimento desenvolvido em cm
  e o "c/" só sai nas posições que vão distribuídas a cada tanto.

  Por que coluna e não texto encostado na barra: o desenho é automático e qualquer muro tem de sair legível. Uma
  coluna fora do desenho, com os textos empilhados na ordem da altura das âncoras, nunca escreve um em cima do outro
  nem em cima da hachura; a linha de chamada é que atravessa — como no corte típico de prancha.

  Barra igual tem o mesmo N em qualquer elemento (modulacao/barras.ts, numerarPosicoes): a vertical do painel e a
  construtiva do contraforte podem ser o mesmo N1. A chamada conta o ELEMENTO desenhado — muro, contraforte ou
  sapata —: "N1 – 30 Ø10 c/40" no painel e "N1 – 24 Ø10" no contraforte, como na prancha de armação, e a lista de
  ferros soma as duas. Por elemento e não por papel: a principal e a construtiva do mesmo contraforte com o mesmo N
  são o mesmo feixe (por papel saíam duas chamadas iguais), e a espera do contraforte não é a do painel (por papel
  as duas somavam e o c/ do painel valia para todas).
*/
import type { Barra, Modelo, PapelBarra } from '@/modelo/tipos';
import { CORPO_DA_COTA } from '@/pranchas/tipos';
import { COR, type Prancha, type Pt } from './prancha';

/** Eixo ao longo do qual a posição se distribui (0 = x, 1 = y, 2 = z): só as que vão "a cada tanto" levam c/. */
const DISTRIBUIDA: Partial<Record<PapelBarra, 0 | 1 | 2>> = {
  VERT_MURO: 0, ESPERA: 0, SAP_TRANSV: 0, SAP_LONG: 1, HORIZ: 2, CF_ESTRIBO: 2,
};

const bitola = (phi: number): string => `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;

const media = (b: Barra, k: 0 | 1 | 2): number => b.eixo.reduce((s, p) => s + p[k], 0) / Math.max(1, b.eixo.length);

export type ElementoDaBarra = 'muro' | 'contraforte' | 'sapata';

/** O elemento da barra para a chamada: a da sapata é da sapata mesmo marcada com o contraforte de cima (torção). */
export function elementoDaBarra(b: Pick<Barra, 'papel' | 'contraforte'>): ElementoDaBarra {
  if (b.papel.startsWith('SAP_')) return 'sapata';
  return b.contraforte !== undefined ? 'contraforte' : 'muro';
}

/**
 * O espaçamento da posição, cm: a distância mais comum entre vizinhas do mesmo grupo (trecho e contraforte). A da
 * ponta e a da junta de controle não são espaçamento — por isso a mais comum, e não a média. Ao longo do muro (x, y)
 * a barra de contraforte não conta: lá elas vão juntas no feixe da haste, a 1 ou 2 cm, e sairia "c/1". null = não
 * distribuída (barra do contraforte, peça única) ou sem vizinha.
 */
export function espacamentoDaPosicao(barras: readonly Barra[]): number | null {
  if (!barras.length) return null;
  const k = DISTRIBUIDA[barras[0].papel];
  if (k === undefined) return null;
  const grupos = new Map<string, number[]>();
  for (const b of barras) {
    if (b.papel !== barras[0].papel || (k !== 2 && b.contraforte !== undefined)) continue;
    const g = `${b.trecho}|${b.contraforte ?? ''}`;
    grupos.set(g, [...(grupos.get(g) ?? []), Math.round(media(b, k))]);
  }
  // a barra emendada vai deslocada um φ ao lado da vizinha (modulacao/barras.ts, corrida): na mesma linha, não é
  // outra linha — junta as posições a menos de 2φ, senão a longitudinal da sapata de muro comprido saía "c/1"
  const junto = 2 * barras[0].diametro + 1;
  const vezes = new Map<number, number>();
  for (const xs of grupos.values()) {
    const u: number[] = [];
    for (const x of [...new Set(xs)].sort((a, b) => a - b)) if (!u.length || x - u[u.length - 1] > junto) u.push(x);
    for (let i = 1; i < u.length; i++) {
      const d = Math.round((u[i] - u[i - 1]) / 10);
      if (d > 0) vezes.set(d, (vezes.get(d) ?? 0) + 1);
    }
  }
  let melhor: number | null = null;
  for (const [d, n] of vezes) if (melhor === null || n > vezes.get(melhor)! || (n === vezes.get(melhor)! && d < melhor)) melhor = d;
  return melhor;
}

/** "N1 – 15 Ø10 c/40 C=210" da posição no elemento (sem ele, a posição inteira), no muro inteiro. */
export function textoDaChamada(m: Modelo, posicao: string, elemento?: ElementoDaBarra): string {
  const daPosicao = m.barras.filter((b) => b.posicao === posicao && (elemento === undefined || elementoDaBarra(b) === elemento));
  if (!daPosicao.length) return posicao;
  const b = daPosicao[0];
  const s = espacamentoDaPosicao(daPosicao);
  return `${posicao} – ${daPosicao.length} ${bitola(b.diametro)}${s !== null ? ` c/${s}` : ''} C=${Math.round(b.comprimento / 10)}`;
}

export interface Chamada {
  posicao: string;
  /** O elemento da barra desenhada: a quantidade e o c/ da chamada são os dele. */
  elemento?: ElementoDaBarra;
  /** Onde a linha de chamada toca a barra, px de desenho. */
  ancora: Pt;
}

/**
 * A âncora numa barra desenhada (polilinha em px): no trecho mais comprido, no meio se ele é de pé (vertical, espera)
 * e perto da ponta do lado da coluna se é deitado (a da canaleta corre o muro todo: no meio, a linha de chamada
 * atravessaria o desenho inteiro).
 */
export function ancoraNaBarra(pts: readonly Pt[], ladoDaColuna: 1 | -1 = 1): Pt {
  if (pts.length === 1) return pts[0];
  let [a, b] = [pts[0], pts[1]];
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(b[0] - a[0], b[1] - a[1])) [a, b] = [p, q];
  }
  const dePe = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
  if (dePe) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // a ponta do lado da coluna fica a 85 % do trecho
  const [p, q] = (b[0] - a[0]) * ladoDaColuna >= 0 ? [a, b] : [b, a];
  return [p[0] + 0.85 * (q[0] - p[0]), p[1] + 0.85 * (q[1] - p[1])];
}

/**
 * Uma chamada por posição e elemento, numa coluna à direita de TUDO o que já está desenhado (`coluna` é o mínimo):
 * presa só à geometria, em 1:75 e 1:100 a coluna entrava na cota "muro" e no "B =", que têm afastamento fixo em px. Os textos vão na ordem da altura das
 * âncoras, cada um pelo menos uma linha e meia abaixo do de cima; a linha sai da âncora (com um ponto) e chega
 * deitada no texto.
 */
export function desenharChamadas(pr: Prancha, m: Modelo, chamadas: readonly Chamada[], coluna: number): void {
  const uma = new Map<string, Chamada>();
  for (const c of chamadas) {
    const k = `${c.posicao}|${c.elemento ?? ''}`;
    if (!uma.has(k)) uma.set(k, c);
  }
  const lista = [...uma.values()].sort((a, b) => a.ancora[1] - b.ancora[1] || a.posicao.localeCompare(b.posicao, 'pt-BR', { numeric: true }));
  if (!lista.length) return;
  coluna = Math.max(coluna, pr.direita() + 14);
  const tam = CORPO_DA_COTA;
  const passo = tam * 1.6;
  let yAnterior = -Infinity;
  pr.abrir('data-camada="chamadas"');
  for (const c of lista) {
    const y = Math.max(c.ancora[1], yAnterior + passo);
    yAnterior = y;
    const [ax, ay] = c.ancora;
    const joelho = coluna - 10;
    pr.polilinha([[ax, ay], [joelho, y], [coluna - 3, y]], { stroke: COR.cota, sw: 0.6, camada: 'chamadas' });
    pr.circulo(ax, ay, 1.8, { fill: COR.cota, camada: 'chamadas' });
    pr.texto(coluna, y + tam * 0.35, textoDaChamada(m, c.posicao, c.elemento), { tam, ancora: 'start', cor: COR.linha, halo: true, camada: 'chamadas' });
  }
  pr.fechar();
}
