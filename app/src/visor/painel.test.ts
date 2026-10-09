import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { planoDoCorte } from './Corte';
import { muroDeExemplo } from './exemploDeModelo';
import { linhasDaPeca } from './PainelDaPeca';

describe('painel da peça (rótulo + valor)', () => {
  const m = muroDeExemplo({ contraforte: true });

  it('bloco: id, tipo, catálogo, fiada contada de 1, trecho', () => {
    const p = m.pecas.find((x) => x.id === 'T1.M.f03.p002')!;
    expect(linhasDaPeca({ tipo: 'peca', peca: p }, m)).toEqual([
      ['Peça', 'T1.M.f03.p002'],
      ['Tipo', 'Bloco'],
      ['Catálogo', '14x19x39'],
      ['Fiada', '4'],
      ['Trecho', '1'],
    ]);
  });

  it('barra: Ø com vírgula, comprimento em metro, contraforte quando houver', () => {
    const b = m.barras.find((x) => x.papel === 'CF_ESTRIBO')!;
    const l = Object.fromEntries(linhasDaPeca({ tipo: 'barra', barra: b }, m));
    expect(l['Ø']).toBe('6,3 mm');
    expect(l['Comprimento']).toBe('0,74 m');
    expect(l['Tipo']).toBe('Contraforte, estribo');
    expect(l['Contraforte']).toBe('1');
  });
});

describe('plano do corte', () => {
  it('fica o lado x ≤ X (o three apaga a distância negativa), com meio milímetro de folga', () => {
    const p = planoDoCorte(2);
    expect(p.distanceToPoint(new THREE.Vector3(1.9, 0, 0))).toBeGreaterThan(0);
    expect(p.distanceToPoint(new THREE.Vector3(2.0004, 0, 0))).toBeGreaterThan(0);
    expect(p.distanceToPoint(new THREE.Vector3(2.1, 0, 0))).toBeLessThan(0);
  });
});
