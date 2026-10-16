/*
  AS FERRAMENTAS DA FOLHA (Jose, 15/10: "deletar ou criar cotas e mover anotações em geral, escrever de novo o que
  quiser") — as contas da tela da prancha, sem React, para teste:
    · a CAPTURA de ponto da ferramenta Cota: as pontas e os meios dos traços do desenho (o "osnap" de ponto final e
      ponto médio do CAD; no A-PORT, lancamento/snap.ts faz o mesmo com nós e barras). A anotação não é capturada —
      cotar uma cota não mede nada;
    · a DIREÇÃO da cota pelo lugar do terceiro clique, como o DIMLINEAR do CAD: acima ou abaixo dos dois pontos sai
      horizontal, ao lado sai vertical;
    · a volta de mm de papel para mm do muro, que é como a cota criada fica guardada (pranchas/tipos.ts, CotaNova):
      papel → px do desenho (÷ k, depois da origem) → mm do muro (÷ S).
*/
import type { CotaNova, Primitiva, Pt } from './tipos';

/** O que a captura não pega: a anotação (cota, chamada, texto, legenda, título). */
const NAO_CAPTURA = new Set(['cotas', 'chamadas', 'textos', 'legenda', 'titulos', 'tabelas']);

const camadaDe = (q: Primitiva): string =>
  q.k === 'linha' || q.k === 'polilinha' ? q.e.camada : q.k === 'circulo' ? q.e?.camada ?? '' : q.k === 'bloco' ? '' : q.camada;

/** Os pontos que a ferramenta Cota captura num desenho: as pontas e os meios dos traços, mm de papel, sem repetir. */
export function pontosDeCaptura(prims: readonly Primitiva[]): Pt[] {
  const vistos = new Set<string>();
  const pontos: Pt[] = [];
  const por = (p: Pt) => {
    const k = `${Math.round(p[0] * 100)}|${Math.round(p[1] * 100)}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    pontos.push(p);
  };
  const segmento = (a: Pt, b: Pt) => {
    por(a);
    por(b);
    por([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  };
  for (const q of prims) {
    if (NAO_CAPTURA.has(camadaDe(q))) continue;
    if (q.k === 'linha') segmento(q.a, q.b);
    else if (q.k === 'polilinha') {
      for (let i = 1; i < q.pts.length; i++) segmento(q.pts[i - 1], q.pts[i]);
      if (q.fechada && q.pts.length > 2) segmento(q.pts[q.pts.length - 1], q.pts[0]);
    } else if (q.k === 'hachura') {
      for (const anel of q.aneis) for (let i = 0; i < anel.length; i++) segmento(anel[i], anel[(i + 1) % anel.length]);
    } else if (q.k === 'circulo') por(q.c);
  }
  return pontos;
}

/** O ponto capturado mais perto de `p` a até `raio` (mm de papel), ou null. */
export function capturar(pontos: readonly Pt[], p: Pt, raio: number): Pt | null {
  let melhor: Pt | null = null;
  let d = raio;
  for (const q of pontos) {
    const dq = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dq <= d) [melhor, d] = [q, dq];
  }
  return melhor;
}

/**
 * Horizontal ou vertical pelo lugar do terceiro clique (o DIMLINEAR): fora da faixa dos dois pontos em y (acima ou
 * abaixo) e dentro dela em x, horizontal; o contrário, vertical; nos cantos, a maior distância entre os pontos.
 */
export function direcaoDaCota(a: Pt, b: Pt, cursor: Pt): 'h' | 'v' {
  const dentroX = cursor[0] >= Math.min(a[0], b[0]) && cursor[0] <= Math.max(a[0], b[0]);
  const dentroY = cursor[1] >= Math.min(a[1], b[1]) && cursor[1] <= Math.max(a[1], b[1]);
  if (dentroX && !dentroY) return 'h';
  if (dentroY && !dentroX) return 'v';
  return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'h' : 'v';
}

/** De onde o desenho está na folha: mm = origem + px·k; S = px de desenho por mm do muro. */
export interface LugarDoDesenho {
  origem: Pt;
  k: number;
  S: number;
}

/** Ponto de papel (mm) → mm do muro no plano da vista (o px do desenho ÷ S). */
export function paraOMuro(p: Pt, l: LugarDoDesenho): Pt {
  return [(p[0] - l.origem[0]) / l.k / l.S, (p[1] - l.origem[1]) / l.k / l.S];
}

/** Mm do muro no plano da vista → ponto de papel (mm). */
export function paraOPapel(p: Pt, l: LugarDoDesenho): Pt {
  return [l.origem[0] + p[0] * l.S * l.k, l.origem[1] + p[1] * l.S * l.k];
}

/** A cota que os três cliques dão (pontos em mm de papel), guardada em mm do muro. */
export function cotaDosCliques(id: string, a: Pt, b: Pt, terceiro: Pt, l: LugarDoDesenho, direcao: 'h' | 'v' = direcaoDaCota(a, b, terceiro)): CotaNova {
  return { id, a: paraOMuro(a, l), b: paraOMuro(b, l), linha: paraOMuro(terceiro, l), direcao };
}

/**
 * A direção de uma CADEIA pelo lugar da linha (o DIMLINEAR com todos os pontos): fora da faixa dos pontos em y e
 * dentro dela em x, horizontal; o contrário, vertical; nos cantos, a maior extensão entre os pontos.
 */
export function direcaoDaCadeia(pontos: readonly Pt[], lugar: Pt): 'h' | 'v' {
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const dentroX = lugar[0] >= x0 && lugar[0] <= x1;
  const dentroY = lugar[1] >= y0 && lugar[1] <= y1;
  if (dentroX && !dentroY) return 'h';
  if (dentroY && !dentroX) return 'v';
  return x1 - x0 >= y1 - y0 ? 'h' : 'v';
}

/**
 * As cotas de uma cadeia feita ponto a ponto (Jose, 16/10: "cota de verdade"; a cota do Revit: os pontos em
 * sequência e, no fim, o lugar da linha): uma por par de pontos vizinhos, todas na mesma direção e na mesma linha.
 * `ids` dá um id novo a cada chamada; com mais de uma cota, todas levam o nome da cadeia (a linha delas anda junto).
 */
export function cotasDaCadeia(ids: () => string, pontos: readonly Pt[], lugar: Pt, l: LugarDoDesenho, cadeia?: string): CotaNova[] {
  const direcao = direcaoDaCadeia(pontos, lugar);
  const cotas: CotaNova[] = [];
  for (let k = 1; k < pontos.length; k++) {
    const [a, b] = [pontos[k - 1], pontos[k]];
    // o par que não mede nada na direção da cadeia (dois pontos na mesma vertical numa cadeia horizontal) não vira cota
    if (Math.abs(direcao === 'h' ? b[0] - a[0] : b[1] - a[1]) < 0.05) continue;
    const c = cotaDosCliques(ids(), a, b, lugar, l, direcao);
    cotas.push(c);
  }
  if (cotas.length > 1 && cadeia) for (const c of cotas) c.cadeia = cadeia;
  return cotas;
}
