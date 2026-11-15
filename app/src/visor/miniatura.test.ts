// A foto do cartão dos Recentes: o muro inteiro no quadro, do lado isométrico, no Realista e sem nada aceso que a
// tela possa ter deixado (corte, Armadura, ocultas). Desenhar de verdade pede a placa de vídeo (conferido no
// programa empacotado); aqui, o ponto de vista e o enquadramento.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraDoPontoDeVista } from './pontoDeVista';
import { pontoDeVistaDaMiniatura, TAMANHO_DA_MINIATURA } from './miniatura';

describe('a miniatura do muro', () => {
  const caixa = { min: [0, -0.5, -0.45] as [number, number, number], max: [6, 1.2, 1.6] as [number, number, number] };
  const [w, h] = TAMANHO_DA_MINIATURA;
  const c = pontoDeVistaDaMiniatura(caixa, w / h);

  it('Realista, ortográfica, sem corte, sem Armadura, sem o terreno', () => {
    expect(c.estilo).toBe('realista');
    expect(c.ortografica).toBe(true);
    expect(c.corteX).toBeNull();
    expect(c.armadura).toBe(false);
    expect(c.ocultas).toEqual(['terreno']);
  });

  it('olha o meio da caixa, do lado da face aparente, de cima', () => {
    c.alvo.forEach((v, i) => expect(v).toBeCloseTo([3, 0.35, 0.575][i]!, 9));
    expect(c.posicao[0]).toBeGreaterThan(c.alvo[0]);
    expect(c.posicao[1]).toBeLessThan(c.alvo[1]);
    expect(c.posicao[2]).toBeGreaterThan(c.alvo[2]);
  });

  it('os oito cantos cabem no quadro, com folga', () => {
    const cam = cameraDoPontoDeVista(c, w / h, caixa) as THREE.OrthographicCamera;
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    let maxX = 0;
    let maxY = 0;
    for (let k = 0; k < 8; k++) {
      const p = new THREE.Vector3(k & 1 ? caixa.max[0] : caixa.min[0], k & 2 ? caixa.max[1] : caixa.min[1], k & 4 ? caixa.max[2] : caixa.min[2]).project(cam);
      maxX = Math.max(maxX, Math.abs(p.x));
      maxY = Math.max(maxY, Math.abs(p.y));
    }
    expect(Math.max(maxX, maxY)).toBeLessThan(0.95);
    expect(Math.max(maxX, maxY)).toBeGreaterThan(0.7);
  });
});
