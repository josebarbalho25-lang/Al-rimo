import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Barra } from '@/modelo/tipos';
import { barraDoTriangulo, LADOS_DO_TUBO, montarBarras, tuboDaPolilinha } from './barras3d';

const L = LADOS_DO_TUBO;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const barra = (id: string, diametro: number, eixo: [number, number, number][], extra: Partial<Barra> = {}): Barra => ({
  id, posicao: 'N1', papel: 'VERT_MURO', diametro, eixo, comprimento: 0, trecho: 1, ...extra,
});

function caixa(t: { pos: number[] }) {
  const b = new THREE.Box3();
  for (let i = 0; i < t.pos.length; i += 3) b.expandByPoint(v(t.pos[i]!, t.pos[i + 1]!, t.pos[i + 2]!));
  return b;
}

describe('tubo da barra', () => {
  it('barra reta: dois anéis + duas tampas; caixa = comprimento × Ø', () => {
    const t = tuboDaPolilinha([v(0, 0, 0), v(0, 0, 2)], 0.005, false);
    expect(t.pos.length / 3).toBe(2 * L + 2 * (L + 1));
    expect(t.idx.length / 3).toBe(2 * L + 2 * L);
    const b = caixa(t);
    expect(b.min.z).toBeCloseTo(0, 9);
    expect(b.max.z).toBeCloseTo(2, 9);
    // Octógono: o círculo cabe entre o apótema e o raio.
    expect(b.max.x - b.min.x).toBeGreaterThan(0.0092);
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(0.01 + 1e-9);
  });

  it('dobra de 90°: a junta em esquadro fica no plano a 45° (nenhum vértice passa do canto)', () => {
    const t = tuboDaPolilinha([v(0, 0, 1), v(0, 0, 0), v(0.3, 0, 0)], 0.01, false);
    const b = caixa(t);
    // Por fora do canto o esquadro chega a r em x e em z, e não além.
    expect(b.min.x).toBeCloseTo(-0.01, 6);
    expect(b.min.z).toBeCloseTo(-0.01, 6);
    expect(b.max.x).toBeCloseTo(0.3, 9);
    // O anel da junta: todos os pontos no plano bissetor x = z (o canto de fora é (−r, 0, −r)).
    for (let j = 0; j < L; j++) {
      const o = (L + j) * 3;
      expect(t.pos[o]! - t.pos[o + 2]!).toBeCloseTo(0, 9);
    }
  });

  it('estribo fechado: um anel por canto, sem tampas, e o tubo se fecha', () => {
    const t = tuboDaPolilinha([v(0, 0, 0), v(0.3, 0, 0), v(0.3, 0.5, 0), v(0, 0.5, 0)], 0.003, true);
    expect(t.pos.length / 3).toBe(4 * L);
    expect(t.idx.length / 3).toBe(4 * 2 * L);
    // Todo índice aponta para um vértice existente (o último trecho volta ao anel 0).
    expect(Math.max(...t.idx)).toBe(4 * L - 1);
  });

  it('ponto repetido não quebra (trecho de comprimento zero não tem direção)', () => {
    const t = tuboDaPolilinha([v(0, 0, 0), v(0, 0, 0), v(1, 0, 0)], 0.005, false);
    expect(t.pos.every(Number.isFinite)).toBe(true);
    expect(t.idx.length / 3).toBe(4 * L);
  });
});

describe('barras juntadas por Ø', () => {
  const barras = [
    barra('V1', 10, [[0, 0, 0], [0, 0, 1000]]),
    barra('V2', 10, [[400, 0, 0], [400, 0, 1000]]),
    barra('E1', 6.3, [[0, 0, 0], [300, 0, 0], [300, 500, 0], [0, 500, 0]], { fechada: true, papel: 'CF_ESTRIBO' }),
    barra('S1', 10, [[0, 0, -200], [0, 1000, -200]], { papel: 'SAP_TRANSV' }),
    barra('V3', 10, [[800, 0, 0], [800, 0, 1000]]),
  ];
  const lotes = montarBarras(barras);

  it('uma malha por Ø × grupo de ocultar', () => {
    expect(lotes.map((l) => l.chave)).toEqual(['Ø6.3|armadura+contrafortes', 'Ø10|armadura', 'Ø10|armadura+fundacao']);
    expect(lotes[1]!.faixas.map((f) => f.id)).toEqual(['V1', 'V2', 'V3']);
  });

  it('faceIndex → barra (busca nas faixas de triângulos)', () => {
    const l = lotes[1]!;
    const porBarra = 4 * L;
    expect(barraDoTriangulo(l.faixas, 0)!.id).toBe('V1');
    expect(barraDoTriangulo(l.faixas, porBarra - 1)!.id).toBe('V1');
    expect(barraDoTriangulo(l.faixas, porBarra)!.id).toBe('V2');
    expect(barraDoTriangulo(l.faixas, 3 * porBarra - 1)!.id).toBe('V3');
    expect(barraDoTriangulo(l.faixas, 3 * porBarra)).toBeNull();
  });

  it('o raio de verdade acerta a barra certa', () => {
    const l = lotes[1]!;
    const malha = new THREE.Mesh(l.geometria, new THREE.MeshBasicMaterial());
    // Raio horizontal vindo de −Y na altura de 0,5 m, passando em x = 0,4 m (a V2).
    const raio = new THREE.Raycaster(v(0.4, -5, 0.5), v(0, 1, 0));
    const h = raio.intersectObject(malha)[0]!;
    expect(barraDoTriangulo(l.faixas, h.faceIndex!)!.id).toBe('V2');
  });
});
