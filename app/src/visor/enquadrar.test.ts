import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import { DIRECOES, direcaoSegura, eixosDaTela, enquadramento, interpolarDirecao } from './enquadrar';

const caixa = { min: [0, 0, -0.55] as Vec3, max: [6, 0.14, 1.6] as Vec3 };

describe('enquadrar (caixa → câmera)', () => {
  it('de frente: o comprimento vai para a largura da tela, a altura para a altura', () => {
    const e = enquadramento(caixa, DIRECOES.frente, 1200, 600);
    expect(e.alvo[0]).toBeCloseTo(3);
    expect(e.alvo[2]).toBeCloseTo(0.525);
    // 6 m em 1200 px → 200 px/m; 2,15 m em 600 px → 279 px/m. Manda o menor, com 10% de folga.
    expect(e.zoom).toBeCloseTo(0.9 * 200, 6);
    expect(e.direcao).toEqual([0, -1, 0]);
  });

  it('a caixa cabe: os oito cantos projetados ficam dentro da tela', () => {
    for (const d of Object.values(DIRECOES)) {
      const w = 900;
      const h = 500;
      const e = enquadramento(caixa, d, w, h);
      const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -100, 100);
      cam.up.set(0, 0, 1);
      cam.position.set(...e.alvo).addScaledVector(new THREE.Vector3(...e.direcao), e.distancia);
      cam.lookAt(...e.alvo);
      cam.zoom = e.zoom;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      for (let k = 0; k < 8; k++) {
        const p = new THREE.Vector3(k & 1 ? 6 : 0, k & 2 ? 0.14 : 0, k & 4 ? 1.6 : -0.55).project(cam);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.9 + 1e-9);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.9 + 1e-9);
      }
    }
  });

  it('de cima: um fio para o sul, para a planta sair com X à direita e Y para cima', () => {
    const d = direcaoSegura(DIRECOES.topo);
    expect(d[2]).toBeGreaterThan(0.999);
    const { direita, cima } = eixosDaTela(d);
    expect(direita[0]).toBeCloseTo(1, 6);
    expect(cima[1]).toBeCloseTo(1, 3);
  });

  it('de frente, X cresce para a direita (a face aparente é vista de fora)', () => {
    const { direita, cima } = eixosDaTela(DIRECOES.frente);
    [1, 0, 0].forEach((x, i) => expect(direita[i]).toBeCloseTo(x, 12));
    [0, 0, 1].forEach((x, i) => expect(cima[i]).toBeCloseTo(x, 12));
  });
});

describe('voo do cubo', () => {
  it('pontas certas e passo unitário', () => {
    const a: Vec3 = [0, -1, 0];
    const b = DIRECOES.iso;
    expect(interpolarDirecao(a, b, 0)).toEqual(a.map((x) => x + 0) as Vec3);
    const fim = interpolarDirecao(a, b, 1);
    fim.forEach((x, i) => expect(x).toBeCloseTo(b[i]!, 9));
    const meio = interpolarDirecao(a, b, 0.5);
    expect(Math.hypot(...meio)).toBeCloseTo(1, 9);
  });

  it('direções opostas (Frente → Solo) passam por cima, não pelo zero', () => {
    const meio = interpolarDirecao([0, -1, 0], [0, 1, 0], 0.5);
    expect(meio[2]).toBeCloseTo(1, 9);
    for (const e of [0.1, 0.3, 0.7, 0.9]) expect(Math.hypot(...interpolarDirecao([0, -1, 0], [0, 1, 0], e))).toBeCloseTo(1, 9);
  });
});
