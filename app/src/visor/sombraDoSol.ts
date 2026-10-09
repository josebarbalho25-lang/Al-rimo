// ═══════════════════════════════════════════════════════════════════════════
//  visor/sombraDoSol.ts — até onde a sombra do Realista enxerga, e com quantos pontos
// ---------------------------------------------------------------------------
//  A sombra projetada é desenhada por uma câmera presa ao sol. Ela tem de
//  cobrir o muro inteiro (senão a sombra some do que ficou fora) e só ele
//  (cada metro a mais é resolução jogada fora). Porte da ideia do A-PORT
//  (`enquadramentoDaSombra.ts`), com uma diferença que é do arrimo:
//
//  ⚠️ O MURO É COMPRIDO E BAIXO. Visto do sol, um muro de 120 m por 4 m é uma
//  faixa 20 vezes mais larga que alta; num mapa QUADRADO, 95 % dos pontos
//  cairiam no céu acima dele e a sombra do bloco sairia em degraus de 3 cm.
//  Aqui o mapa toma a proporção da faixa (largo e baixo), dentro de um
//  orçamento fixo de pontos — o mesmo custo de memória para o muro de 6 m e
//  para o de 120 m, e a resolução vai para onde há muro.
//  E a câmera do sol é GIRADA para o muro correr deitado no mapa: com o "cima"
//  padrão (Z), o sol de lado via o muro em diagonal, e a caixa que o contém
//  saía quase quadrada de novo (medido: 103 × 44 m para o muro de 120 m).
//
//  Puro: recebe a caixa e devolve números. Quem monta a luz é `ambiente.tsx`.
// ═══════════════════════════════════════════════════════════════════════════

import type { Vec3 } from '@/modelo/tipos';
import type { Caixa } from './perfil3d';

/** De onde vem o sol (direção a partir do muro): da frente, pela direita, alto — a face aparente fica no claro. */
export const DIRECAO_DO_SOL: Vec3 = [0.35, -0.6, 0.72];

/**
 * Pontos do mapa de sombra: 2048 × 4096 (≈ 34 MB de profundidade na placa).
 * No muro de 6 m dá ~2 mm por ponto; no de 120 m, ~1,5 cm ao longo e ~5 mm na altura.
 */
export const ORCAMENTO_DA_SOMBRA = 2048 * 4096;

export interface EnquadramentoDaSombra {
  /** Para onde o sol mira (o centro do que recebe sombra), metro. */
  alvo: Vec3;
  /** Onde fica o sol, metro. */
  posicao: Vec3;
  esquerda: number;
  direita: number;
  baixo: number;
  cima: number;
  perto: number;
  longe: number;
  /** Largura × altura do mapa, em pontos. */
  mapa: [number, number];
  /** O "cima" da câmera da sombra (vai em `shadow.camera.up`): é ele que deita o muro ao longo do mapa. */
  vertical: Vec3;
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ponto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * O enquadramento da câmera da sombra para a caixa (metro), com o sol na
 * direção `sol`. Os eixos são os que o three monta no `lookAt` com o "cima"
 * em `vertical` — quem usa tem de pôr `shadow.camera.up = vertical`.
 * `maxTextura` é o lado máximo que a placa aceita.
 */
export function enquadrarSombra(caixa: Caixa, sol: Vec3 = DIRECAO_DO_SOL, maxTextura = 8192): EnquadramentoDaSombra {
  const d = norm(sol);
  const alvo: Vec3 = [0, 1, 2].map((i) => (caixa.min[i]! + caixa.max[i]!) / 2) as Vec3;
  const raio = Math.max(0.5, Math.hypot(caixa.max[0] - caixa.min[0], caixa.max[1] - caixa.min[1], caixa.max[2] - caixa.min[2]) / 2);
  // A câmera olha de alvo + d·R para o alvo: z da câmera = d. O x dela é o eixo do muro (X) visto do sol
  // (tirada a parte ao longo de d); y = z × x. O `lookAt` do three monta exatamente esta base com up = y.
  const cx = norm([1 - d[0] * d[0], -d[0] * d[1], -d[0] * d[2]]);
  const cy = cruz(d, cx);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (let k = 0; k < 8; k++) {
    const c: Vec3 = [k & 1 ? caixa.max[0] : caixa.min[0], k & 2 ? caixa.max[1] : caixa.min[1], k & 4 ? caixa.max[2] : caixa.min[2]];
    const r: Vec3 = [c[0] - alvo[0], c[1] - alvo[1], c[2] - alvo[2]];
    const x = ponto(r, cx), y = ponto(r, cy), z = ponto(r, d);
    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
    zMin = Math.min(zMin, z); zMax = Math.max(zMax, z);
  }
  // Folga de 2 % + 10 cm: o filtro da sombra lê um vizinho além da borda.
  const fx = (xMax - xMin) * 0.02 + 0.1;
  const fy = (yMax - yMin) * 0.02 + 0.1;
  const largura = xMax - xMin + 2 * fx;
  const altura = yMax - yMin + 2 * fy;
  const distancia = raio * 2;
  const teto = Math.max(512, Math.min(maxTextura, 8192));
  let w = Math.sqrt((ORCAMENTO_DA_SOMBRA * largura) / altura);
  let h = ORCAMENTO_DA_SOMBRA / w;
  if (w > teto) { w = teto; h = Math.min(teto, ORCAMENTO_DA_SOMBRA / w); }
  if (h > teto) { h = teto; w = Math.min(teto, ORCAMENTO_DA_SOMBRA / h); }
  return {
    alvo,
    posicao: [alvo[0] + d[0] * distancia, alvo[1] + d[1] * distancia, alvo[2] + d[2] * distancia],
    esquerda: xMin - fx,
    direita: xMax + fx,
    baixo: yMin - fy,
    cima: yMax + fy,
    perto: Math.max(0.01, distancia - zMax - 0.5),
    longe: distancia - zMin + 0.5,
    mapa: [Math.max(256, Math.round(w)), Math.max(256, Math.round(h))],
    vertical: cy,
  };
}
