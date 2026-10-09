// ═══════════════════════════════════════════════════════════════════════════
//  visor/enquadrar.ts — olhar a caixa de uma direção e cabê-la na tela
// ---------------------------------------------------------------------------
//  Porte do `enquadrar` da prévia de carga do A-PORT (`ui/PreviaDaCarga.tsx`),
//  separado em conta PURA (caixa + direção + tamanho da tela → câmera) e
//  aplicação. A conta é testada no Node; quem mexe na câmera é o voo.
//
//  ⚠️ A câmera só se re-mira ao ABRIR e quando o usuário pede (cubo, vistas,
//  Enquadrar). NUNCA por mudança no modelo: digitar a altura do muro não pode
//  desfazer a órbita que ele escolheu (regra do A-PORT, "deixa o trabalho
//  inviável").
// ═══════════════════════════════════════════════════════════════════════════

import type { Vec3 } from '@/modelo/tipos';
import type { Caixa } from './perfil3d';

const norma = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const unit = (v: Vec3): Vec3 => {
  const n = norma(v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * As vistas nomeadas — direção do ALVO para a CÂMERA. Eixos do contrato:
 * X ao longo do muro, +Y para o solo, Z para cima. Frente = de quem olha a
 * face aparente (de −Y); Lateral = da direita (+X), onde se lê o perfil do
 * muro com a sapata; Isométrica = a mesma da casinha do cubo do A-PORT.
 */
export const DIRECOES = {
  frente: [0, -1, 0] as Vec3,
  lateral: [1, 0, 0] as Vec3,
  topo: [0, 0, 1] as Vec3,
  iso: unit([1, -1, 0.85]),
};
export type VistaNomeada = keyof typeof DIRECOES;

/** O "cima" da câmera é sempre o Z do mundo: o muro não tomba. */
export const CIMA: Vec3 = [0, 0, 1];

/**
 * Olhar exatamente de cima (ou de baixo) deixa o "cima" da câmera paralelo à
 * visada e o lookAt sem solução. Um fio para o sul: a planta sai com X à
 * direita e Y para cima, e não num giro qualquer (mesma saída do A-PORT).
 */
export function direcaoSegura(dir: Vec3): Vec3 {
  const d = unit(dir);
  if (Math.abs(d[2]) > 0.999) return unit([0, -1e-3, Math.sign(d[2])]);
  return d;
}

export interface Enquadramento {
  /** Para onde a câmera olha (centro da caixa), metro. */
  alvo: Vec3;
  /** Do alvo para a câmera, unitário. */
  direcao: Vec3;
  /** Distância da câmera ao alvo (ortográfica: não muda o que se vê, só o recorte de profundidade). */
  distancia: number;
  /** Pixels por metro (zoom da câmera ortográfica do r3f, cujo frustum é o tamanho da tela em pixels). */
  zoom: number;
}

/** Os eixos da tela para quem olha de `d` com o Z para cima (o mesmo que o lookAt do three monta). */
export function eixosDaTela(d: Vec3): { direita: Vec3; cima: Vec3 } {
  const direita = unit(cross(CIMA, d));
  return { direita, cima: cross(d, direita) };
}

/**
 * Olha a caixa da direção `dir` e a cabe na tela, com `folga` (0,9 = sobra
 * 10%). É o que o cubo faz a cada clique: virou a face, a peça aparece
 * inteira daquele lado — o "ajustar à vista" do ViewCube do Revit.
 */
export function enquadramento(caixa: Caixa, dir: Vec3, largura: number, altura: number, folga = 0.9): Enquadramento {
  const d = direcaoSegura(dir);
  const alvo: Vec3 = [(caixa.min[0] + caixa.max[0]) / 2, (caixa.min[1] + caixa.max[1]) / 2, (caixa.min[2] + caixa.max[2]) / 2];
  const raio = Math.max(norma([caixa.max[0] - caixa.min[0], caixa.max[1] - caixa.min[1], caixa.max[2] - caixa.min[2]]) / 2, 0.5);
  const { direita, cima } = eixosDaTela(d);
  // Os oito cantos projetados nos eixos da tela dão a largura e a altura aparentes.
  let w = 0;
  let h = 0;
  for (let k = 0; k < 8; k++) {
    const c: Vec3 = [
      (k & 1 ? caixa.max[0] : caixa.min[0]) - alvo[0],
      (k & 2 ? caixa.max[1] : caixa.min[1]) - alvo[1],
      (k & 4 ? caixa.max[2] : caixa.min[2]) - alvo[2],
    ];
    w = Math.max(w, 2 * Math.abs(dot(c, direita)));
    h = Math.max(h, 2 * Math.abs(dot(c, cima)));
  }
  const zoom = folga * Math.min(Math.max(largura, 1) / Math.max(w, 1e-6), Math.max(altura, 1) / Math.max(h, 1e-6));
  return { alvo, direcao: d, distancia: raio * 4, zoom };
}

/**
 * A direção no meio do voo: giro pelo arco maior-círculo (slerp), não
 * interpolação reta. A reta passa por ZERO quando as duas pontas são opostas
 * (Frente → Solo) e a câmera sumiria; aí o giro vai por cima, pelo Z.
 */
export function interpolarDirecao(de: Vec3, para: Vec3, e: number): Vec3 {
  const a = unit(de);
  const b = unit(para);
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  const th = Math.acos(c);
  if (th < 1e-6) return b;
  if (th > Math.PI - 1e-3) {
    // Opostas: escolhe o eixo de giro deitado, para passar por cima do modelo.
    const eixo = unit(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0]));
    const ang = e * Math.PI;
    // Rodrigues: a·cos + (k × a)·sen (k ⟂ a).
    const ka = cross(eixo, a);
    return unit([a[0] * Math.cos(ang) + ka[0] * Math.sin(ang), a[1] * Math.cos(ang) + ka[1] * Math.sin(ang), a[2] * Math.cos(ang) + ka[2] * Math.sin(ang)]);
  }
  const s = Math.sin(th);
  const fa = Math.sin((1 - e) * th) / s;
  const fb = Math.sin(e * th) / s;
  return unit([a[0] * fa + b[0] * fb, a[1] * fa + b[1] * fb, a[2] * fa + b[2] * fb]);
}

/** Suave nas duas pontas (smoothstep), o mesmo do voo do cubo do A-PORT. */
export const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
