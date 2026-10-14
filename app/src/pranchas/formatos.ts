/*
  A FOLHA DE PAPEL — formatos, margens, carimbo e as escalas que a prancha oferece.

  Norma: NBR 16752:2020 (Desenho técnico — requisitos para apresentação em folhas de desenho), que substituiu a
  NBR 10582 e, ao que tudo indica, a NBR 10068. Pelas apostilas que a citam: margem esquerda de 20 mm (furação e
  arquivo) e 10 mm nas outras; legenda (carimbo) no canto inferior direito. A largura de 180 mm do carimbo é a da
  ISO 7200, base da norma — DEDUÇÃO, a conferir no texto da NBR (o Jose tem acesso pelo CREA). Tudo aqui é número
  de partida: o carimbo e o quadro lateral se regulam na tela.
*/
import type { Formato, Orientacao } from './tipos';

/** Série ISO-A, mm: [lado maior, lado menor]. */
export const FORMATOS: Readonly<Record<Formato, readonly [number, number]>> = {
  A0: [1189, 841],
  A1: [841, 594],
  A2: [594, 420],
  A3: [420, 297],
  A4: [297, 210],
};

export const ORDEM_DOS_FORMATOS: readonly Formato[] = ['A0', 'A1', 'A2', 'A3', 'A4'];

/** Largura × altura da folha, mm. */
export function tamanhoDaFolha(f: Formato, o: Orientacao): [number, number] {
  const [a, b] = FORMATOS[f];
  return o === 'deitada' ? [a, b] : [b, a];
}

/** Margens até o quadro (moldura), mm. */
export const MARGEM = { esquerda: 20, direita: 10, cima: 10, baixo: 10 } as const;

/** O espaço útil dentro da moldura: [x0, y0, x1, y1], mm (origem no canto superior esquerdo da folha). */
export function quadroUtil(f: Formato, o: Orientacao): [number, number, number, number] {
  const [w, h] = tamanhoDaFolha(f, o);
  return [MARGEM.esquerda, MARGEM.cima, w - MARGEM.direita, h - MARGEM.baixo];
}

/** Carimbo de partida: 180 mm (ISO 7200; no A4 em pé é a largura útil inteira) × 50 mm (quatro faixas). */
export const CARIMBO_PADRAO = { largura: 180, altura: 50 } as const;

/** Limites do redimensionamento do carimbo, mm. */
export const CARIMBO_MIN = { largura: 120, altura: 35 } as const;

/** As escalas das vistas 2D (Jose, 14/10); `null` = sem escala (3D e imagem). */
export const ESCALAS: readonly number[] = [10, 20, 25, 50, 75, 100];

export const rotuloDaEscala = (e: number | null): string => (e === null ? 'Sem escala' : `1:${e}`);

/**
 * Quadro lateral de partida: na largura do carimbo, do alto da moldura até o carimbo nas folhas grandes (A0–A2);
 * nas pequenas (A3, A4) ele começa fechado — uma coluna de 180 mm comeria a folha — e o projetista abre se quiser.
 */
export function quadroLateralPadrao(f: Formato, o: Orientacao, carimbo: { largura: number; altura: number }): { largura: number; altura: number } {
  const [, y0, , y1] = quadroUtil(f, o);
  const grande = f === 'A0' || f === 'A1' || f === 'A2';
  return { largura: carimbo.largura, altura: grande ? Math.max(0, y1 - y0 - carimbo.altura) : 0 };
}

/** Altura dos textos da prancha, mm (NBR: 2,5 a 3,5 para texto corrente; 5 para títulos grandes). */
export const LETRA = { nota: 2.5, rotulo: 2, titulo: 3.5, tituloGrande: 5 } as const;
