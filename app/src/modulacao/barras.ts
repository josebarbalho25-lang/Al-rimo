/*
  BARRAS — forma (polilinha do eixo, dobras já discretizadas) e comprimento desenvolvido.

  A regra da dobra é a da NBR 6118 (9.4.2.3 e Tab. 9.1), a mesma do A-PORT (trelicada/motor/dobra.js):
  pino 5φ (φ < 20) ou 8φ (φ ≥ 20) no CA-50; gancho de 90° com ponta reta de 8φ. Está repetida aqui (em mm) porque
  este app não importa do A-PORT — se a regra mudar lá, mudar aqui também.
  Estribo fechado: ponta reta do gancho de fechamento 10φ ≥ 7 cm (NBR 6118 9.4.6.1, ângulo reto). O desenho do
  estribo é o retângulo do eixo (fechada = true); o gancho entra só no comprimento. DEDUÇÃO no desenho.
*/
import type { Barra, PapelBarra, Vec3 } from '@/modelo/tipos';
import { arred } from './perfis';

/** Barra comercial: emenda por traspasse a cada 12 m. */
export const BARRA_COMERCIAL = 12000;
const SEG_DOBRA = 4;

export const pino = (phi: number): number => (phi >= 20 ? 8 : 5) * phi;
export const raioDoEixo = (phi: number): number => pino(phi) / 2 + phi / 2;
export const pontaGancho90 = (phi: number): number => 8 * phi;
export const ganchoEstribo = (phi: number): number => Math.max(10 * phi, 70);

const p3 = (x: number, y: number, z: number): Vec3 => [arred(x), arred(y), arred(z)];

export interface BarraNova {
  id: string;
  papel: PapelBarra;
  diametro: number;
  eixo: Vec3[];
  fechada?: boolean;
  comprimento: number;
  trecho: number;
  contraforte?: number;
}

export function reta(id: string, papel: PapelBarra, phi: number, a: Vec3, b: Vec3, trecho: number, contraforte?: number): BarraNova {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const out: BarraNova = { id, papel, diametro: phi, eixo: [p3(...a), p3(...b)], comprimento: arred(c), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/**
 * Espera: sobe de zPe até zTopo em (x, y); com gancho, dobra 90° no pé apontando para `sentidoY` (±1).
 * zPe = cota do EIXO do trecho horizontal do gancho (apoiado na malha da sapata).
 */
export function espera(id: string, phi: number, x: number, y: number, zPe: number, zTopo: number, gancho: boolean, sentidoY: 1 | -1, trecho: number, contraforte?: number): BarraNova {
  if (!gancho) return reta(id, 'ESPERA', phi, [x, y, zTopo], [x, y, zPe], trecho, contraforte);
  const R = raioDoEixo(phi);
  const ponta = pontaGancho90(phi);
  const eixo: Vec3[] = [p3(x, y, zTopo), p3(x, y, zPe + R)];
  const cy = y + sentidoY * R;
  const cz = zPe + R;
  for (let k = 1; k <= SEG_DOBRA; k++) {
    const f = (k / SEG_DOBRA) * (Math.PI / 2);
    eixo.push(p3(x, cy - sentidoY * R * Math.cos(f), cz - R * Math.sin(f)));
  }
  eixo.push(p3(x, cy + sentidoY * ponta, zPe));
  const comprimento = zTopo - (zPe + R) + (Math.PI / 2) * R + ponta;
  const out: BarraNova = { id, papel: 'ESPERA', diametro: phi, eixo, comprimento: arred(comprimento), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/** Retângulo fechado (estribo) dado por 4 cantos do eixo, em ordem. */
export function estribo(id: string, papel: PapelBarra, phi: number, cantos: [Vec3, Vec3, Vec3, Vec3], trecho: number, contraforte?: number): BarraNova {
  let per = 0;
  for (let k = 0; k < 4; k++) {
    const a = cantos[k];
    const b = cantos[(k + 1) % 4];
    per += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  const out: BarraNova = {
    id, papel, diametro: phi, eixo: cantos.map((c) => p3(...c)), fechada: true,
    comprimento: arred(per + 2 * ganchoEstribo(phi)), trecho,
  };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/**
 * Corrida longa (horizontal da canaleta, longitudinal da sapata) quebrada em barras comerciais com traspasse.
 * As barras emendadas se alternam lado a lado (desloca `lado` de φ) para não ocuparem o mesmo lugar.
 */
export function corrida(
  idBase: string, papel: PapelBarra, phi: number, x0: number, x1: number, y: number, z: number,
  traspasse: number, lado: Vec3, trecho: number,
): BarraNova[] {
  const out: BarraNova[] = [];
  const L = x1 - x0;
  if (L <= BARRA_COMERCIAL) return [reta(idBase + '1', papel, phi, [x0, y, z], [x1, y, z], trecho)];
  // n barras de comprimento igual: n·c − (n−1)·l0 = L, c ≤ 12 m
  const n = Math.ceil((L - traspasse) / (BARRA_COMERCIAL - traspasse));
  const c = (L + (n - 1) * traspasse) / n;
  for (let k = 0; k < n; k++) {
    const a = x0 + k * (c - traspasse);
    const d = k % 2 ? 1 : 0;
    out.push(reta(idBase + (k + 1), papel, phi, [a, y + d * lado[1], z + d * lado[2]], [a + c, y + d * lado[1], z + d * lado[2]], trecho));
  }
  return out;
}

/** Posições a cada ≤ s entre a e b (inclusive), igualmente espaçadas. */
export function distribuir(a: number, b: number, s: number): number[] {
  if (b - a <= 1e-6) return [a];
  const n = Math.max(1, Math.ceil((b - a) / s - 1e-6));
  return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
}

/** N1, N2... — mesma forma, mesmo Ø e mesmo papel = mesma posição da lista de ferros (como prancha de armação). */
export function numerarPosicoes(barras: BarraNova[]): Barra[] {
  const mapa = new Map<string, string>();
  return barras.map((b) => {
    const o = b.eixo[0];
    const forma = b.eixo.map((q) => `${Math.round(q[0] - o[0])},${Math.round(q[1] - o[1])},${Math.round(q[2] - o[2])}`).join(';');
    const chave = `${b.papel}|${b.diametro}|${b.fechada ? 'F' : ''}|${Math.round(b.comprimento)}|${forma}`;
    let pos = mapa.get(chave);
    if (!pos) {
      pos = `N${mapa.size + 1}`;
      mapa.set(chave, pos);
    }
    const out: Barra = { id: b.id, posicao: pos, papel: b.papel, diametro: b.diametro, eixo: b.eixo, comprimento: b.comprimento, trecho: b.trecho };
    if (b.fechada) out.fechada = true;
    if (b.contraforte !== undefined) out.contraforte = b.contraforte;
    return out;
  });
}
