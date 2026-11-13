/*
  LISTA DE FERROS E RESUMO DO AÇO — como na prancha de armação.

  Comprimento unitário arredondado ao centímetro e o resto sai DELE: C. total = quantidade × C. unit. e massa =
  C. total × massa nominal. Assim cada linha confere na calculadora (Q × C × kg/m) — quem audita é o engenheiro,
  e um total que não bate com a multiplicação da própria linha vira desconfiança da tabela inteira.
*/
import type { Barra, PapelBarra } from '@/modelo/tipos';

/**
 * Massa nominal por metro, NBR 7480 (barras CA-50 e fios CA-60 de uso corrente), kg/m.
 * A norma define a massa nominal como área nominal × 7850 kg/m³ arredondada a 3 casas — é a fórmula de
 * `massaLinear` para bitola fora da tabela; a tabela fica escrita para quem for conferir com a norma.
 */
export const MASSA_NOMINAL_NBR7480: Readonly<Record<string, number>> = {
  '4.2': 0.109, '5': 0.154, '6': 0.222, '6.3': 0.245, '8': 0.395, '10': 0.617, '12.5': 0.963,
  '16': 1.578, '20': 2.466, '22': 2.984, '25': 3.853, '32': 6.313, '40': 9.865,
};

const chaveDaBitola = (phi: number): string => String(Math.round(phi * 10) / 10);

/** kg/m da bitola (mm). */
export function massaLinear(phi: number): number {
  const t = MASSA_NOMINAL_NBR7480[chaveDaBitola(phi)];
  if (t !== undefined) return t;
  return Math.round((Math.PI * phi * phi / 4) * 7850e-6 * 1000) / 1000;
}

export const ROTULO_DO_PAPEL: Readonly<Record<PapelBarra, string>> = {
  VERT_MURO: 'Vertical do muro',
  ESPERA: 'Espera',
  HORIZ: 'Horizontal na canaleta',
  CF_PRINCIPAL: 'Contraforte · principal',
  CF_CONSTRUTIVA: 'Contraforte · construtiva',
  CF_ESTRIBO: 'Contraforte · estribo',
  SAP_TRANSV: 'Sapata · transversal',
  SAP_LONG: 'Sapata · longitudinal',
  SAP_TORCAO: 'Sapata · torção',
  PIL_LONG: 'Pilarete · longitudinal',
  PIL_ESTRIBO: 'Pilarete · estribo',
  CINTA_MC: 'Cinta do muro de cima',
};

export interface PosicaoDeFerro {
  posicao: string;            // 'N1'
  papel: PapelBarra;
  elemento: string;           // rótulo da coluna "Elemento" (rotuloDaBarra)
  diametro: number;           // mm
  quantidade: number;         // un
  comprimentoUnit: number;    // cm (inteiro)
  comprimentoTotal: number;   // m
  massa: number;              // kg
}

export interface ResumoPorBitola {
  diametro: number;           // mm
  massaLinear: number;        // kg/m
  comprimento: number;        // m
  massa: number;              // kg
}

/**
 * Rótulo da barra na lista. O papel sozinho não basta: HORIZ dobrada é o U da canaleta de um contraforte ao outro
 * (modulacao/armaduras.ts, barrasEmU) — com o mesmo rótulo da corrida reta, quem corta e dobra leria duas barras
 * diferentes como a mesma coisa.
 */
export function rotuloDaBarra(b: Pick<Barra, 'papel' | 'eixo'>): string {
  if (b.papel === 'HORIZ' && b.eixo.length > 2) return 'Horizontal na canaleta (U)';
  return ROTULO_DO_PAPEL[b.papel] ?? b.papel;
}

/** Ordem natural de prancha: N2 antes de N10. */
export function compararPosicoes(a: string, b: string): number {
  const ra = /^(\D*)(\d+)(.*)$/.exec(a);
  const rb = /^(\D*)(\d+)(.*)$/.exec(b);
  if (ra && rb && ra[1] === rb[1]) {
    const d = Number(ra[2]) - Number(rb[2]);
    if (d !== 0) return d;
    return ra[3].localeCompare(rb[3]);
  }
  return a.localeCompare(b);
}

/**
 * Agrupa por posição. Pelo contrato, mesma posição = mesma barra; se a modulação entregar barras diferentes
 * debaixo do mesmo N, a lista mostra uma linha por variante (o total continua certo) e devolve o aviso — esconder
 * a diferença numa média faria a lista de ferros mentir para quem corta a barra.
 */
export function listaDeFerros(barras: readonly Barra[]): { linhas: PosicaoDeFerro[]; avisos: string[] } {
  const porPosicao = new Map<string, Map<string, { b: Barra; n: number; cm: number; elementos: Set<string> }>>();
  for (const b of barras) {
    const cm = Math.round(b.comprimento / 10);
    const variante = `${chaveDaBitola(b.diametro)}|${cm}`;
    let vs = porPosicao.get(b.posicao);
    if (!vs) porPosicao.set(b.posicao, (vs = new Map()));
    const v = vs.get(variante);
    if (v) {
      v.n += 1;
      v.elementos.add(rotuloDaBarra(b));
    } else vs.set(variante, { b, n: 1, cm, elementos: new Set([rotuloDaBarra(b)]) });
  }
  const linhas: PosicaoDeFerro[] = [];
  const avisos: string[] = [];
  for (const posicao of [...porPosicao.keys()].sort(compararPosicoes)) {
    const vs = [...porPosicao.get(posicao)!.values()]
      .sort((a, b) => a.b.diametro - b.b.diametro || a.cm - b.cm);
    if (vs.length > 1) avisos.push(`${posicao}: barras diferentes na mesma posição`);
    for (const { b, n, cm, elementos } of vs) {
      const comprimentoTotal = (n * cm) / 100;
      // a mesma barra em elementos diferentes (numerarPosicoes): a linha diz todos, na ordem em que apareceram
      linhas.push({
        posicao, papel: b.papel, elemento: [...elementos].join(' + '), diametro: b.diametro, quantidade: n, comprimentoUnit: cm,
        comprimentoTotal, massa: comprimentoTotal * massaLinear(b.diametro),
      });
    }
  }
  return { linhas, avisos };
}

export function resumoDoAco(linhas: readonly PosicaoDeFerro[]): ResumoPorBitola[] {
  const porBitola = new Map<string, ResumoPorBitola>();
  for (const l of linhas) {
    const k = chaveDaBitola(l.diametro);
    const r = porBitola.get(k);
    if (r) {
      r.comprimento += l.comprimentoTotal;
      r.massa += l.massa;
    } else {
      porBitola.set(k, { diametro: l.diametro, massaLinear: massaLinear(l.diametro), comprimento: l.comprimentoTotal, massa: l.massa });
    }
  }
  return [...porBitola.values()].sort((a, b) => a.diametro - b.diametro);
}
