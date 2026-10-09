import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Geometria, Peca } from '@/modelo/tipos';
import { caixaDaPeca, caixaLocal, matrizDaPeca, moldeDaGeometria, MM } from './perfil3d';

const ret = (u0: number, v0: number, u1: number, v1: number): [number, number][] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
];

const bloco: Geometria = {
  chave: 'bloco 14x19x39',
  eixo: 'Z',
  perfil: { contorno: ret(0, 0, 390, 140), furos: [ret(25, 25, 170, 115).reverse(), ret(220, 25, 365, 115).reverse()] },
  extensao: 190,
  volume_mm3: (390 * 140 - 2 * 145 * 90) * 190,
};
const canaleta: Geometria = {
  chave: 'canaleta',
  eixo: 'X',
  perfil: { contorno: [[0, 0], [140, 0], [140, 190], [115, 190], [115, 30], [25, 30], [25, 190], [0, 190]] },
  extensao: 390,
  volume_mm3: (140 * 190 - 90 * 160) * 390,
};
const tuboY: Geometria = { chave: 'em Y', eixo: 'Y', perfil: { contorno: ret(0, 0, 50, 80) }, extensao: 140, volume_mm3: 50 * 80 * 140 };

const peca = (giro: Peca['giro'], origem: [number, number, number] = [1000, 2000, 210]): Peca => ({
  id: 'p', tipo: 'BLOCO', grupo: 'muro', geometria: 'g', origem, giro, trecho: 1,
});

/** Caixa (mm) de uma geometria do three depois de uma matriz. */
function caixaMm(geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
  const g = geo.clone();
  if (m) g.applyMatrix4(m);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const r = (x: number) => Math.round(x / MM * 1000) / 1000;
  return { min: [r(b.min.x), r(b.min.y), r(b.min.z)], max: [r(b.max.x), r(b.max.y), r(b.max.z)] };
}

/** Volume pela divergência (soma de tetraedros); só dá certo se as faces estiverem para fora. */
function volumeMm3(geo: THREE.BufferGeometry): number {
  const p = geo.getAttribute('position');
  let v = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i);
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return v / MM ** 3;
}

/** Toda face com a ordem dos vértices concordando com a normal guardada (não está "do avesso"). */
function facesParaFora(geo: THREE.BufferGeometry): boolean {
  const p = geo.getAttribute('position');
  const n = geo.getAttribute('normal');
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i);
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const f = b.clone().sub(a).cross(c.clone().sub(a));
    if (f.lengthSq() < 1e-18) continue;
    if (f.dot(new THREE.Vector3().fromBufferAttribute(n, i)) <= 0) return false;
  }
  return true;
}

describe('molde da geometria', () => {
  it('bloco com dois furos: contagem de vértices e caixa iguais às medidas', () => {
    const g = moldeDaGeometria(bloco);
    // Não indexado. Lados: 12 arestas × 2 triângulos. Tampas: 12 cada — a conta de livro dá
    // N + 2·furos − 2 = 14, mas o earcut descarta os pontos alinhados da ponte entre os furos.
    // 48 triângulos / 144 vértices é o mesmo número medido no `bloco.js` do A-PORT (brief do visor).
    expect(g.index).toBeNull();
    expect(g.getAttribute('position').count).toBe(144);
    expect(caixaMm(g)).toEqual({ min: [0, 0, 0], max: [390, 140, 190] });
    expect(volumeMm3(g)).toBeCloseTo(bloco.volume_mm3, -2);
    expect(facesParaFora(g)).toBe(true);
  });

  it('canaleta (eixo X): perfil em (y, z), corre em x', () => {
    const g = moldeDaGeometria(canaleta);
    expect(caixaMm(g)).toEqual({ min: [0, 0, 0], max: [390, 140, 190] });
    expect(volumeMm3(g)).toBeCloseTo(canaleta.volume_mm3, -2);
    expect(facesParaFora(g)).toBe(true);
  });

  it('eixo Y (espelho): perfil em (x, z) e as faces continuam para fora', () => {
    const g = moldeDaGeometria(tuboY);
    expect(caixaMm(g)).toEqual({ min: [0, 0, 0], max: [50, 140, 80] });
    expect(volumeMm3(g)).toBeCloseTo(tuboY.volume_mm3, -1);
    expect(facesParaFora(g)).toBe(true);
  });

  it('caixaLocal (sem malha) bate com a malha nos três eixos', () => {
    for (const geo of [bloco, canaleta, tuboY]) {
      const c = caixaLocal(geo);
      expect(caixaMm(moldeDaGeometria(geo))).toEqual({ min: c.min, max: c.max });
    }
  });
});

describe('matriz da peça', () => {
  const g = moldeDaGeometria(bloco);
  const local = caixaLocal(bloco);

  it('giro 0: o canto mínimo vai para a origem', () => {
    expect(caixaMm(g, matrizDaPeca(peca(0), local))).toEqual({ min: [1000, 2000, 210], max: [1390, 2140, 400] });
  });

  it('giro 90 troca X por Y e mantém o canto mínimo na origem', () => {
    const c = caixaMm(g, matrizDaPeca(peca(90), local));
    expect(c).toEqual({ min: [1000, 2000, 210], max: [1140, 2390, 400] });
    expect(caixaDaPeca(peca(90), local)).toEqual(c);
  });

  it('giros 180 e 270 também assentam pelo canto mínimo', () => {
    expect(caixaMm(g, matrizDaPeca(peca(180), local))).toEqual({ min: [1000, 2000, 210], max: [1390, 2140, 400] });
    expect(caixaMm(g, matrizDaPeca(peca(270), local))).toEqual({ min: [1000, 2000, 210], max: [1140, 2390, 400] });
  });

  it('giro 90 leva o furo junto: o primeiro furo (x 25–170) fica em y 25–170 depois do giro', () => {
    // Giro anti-horário: x local → y global; o canto mínimo vai para a origem, então o furo
    // que estava perto de x = 0 fica perto de y = origem.
    const m = matrizDaPeca(peca(90, [0, 0, 0]), local);
    const centroDoFuro = new THREE.Vector3(97.5 * MM, 70 * MM, 0).applyMatrix4(m);
    expect(centroDoFuro.x / MM).toBeCloseTo(70, 6);
    expect(centroDoFuro.y / MM).toBeCloseTo(97.5, 6);
  });

  it('perfil com coordenada negativa (dente da sapata) assenta pelo canto mínimo', () => {
    const sapata: Geometria = {
      chave: 'sapata', eixo: 'X', extensao: 2000, volume_mm3: 0,
      perfil: { contorno: [[0, 0], [575, 0], [575, -250], [825, -250], [825, 0], [1400, 0], [1400, 300], [0, 300]] },
    };
    const c = caixaMm(moldeDaGeometria(sapata), matrizDaPeca(peca(0, [0, -500, -550]), caixaLocal(sapata)));
    expect(c).toEqual({ min: [0, -500, -550], max: [2000, 900, 0] });
  });
});
