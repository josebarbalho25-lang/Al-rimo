/*
  A calculadora da Fig. 15 tem de dar o número da PLANILHA (Excel): σadm por 20·N e por Mello, e a faixa de cada
  uma, pelo mesmo SPT da base. Conferido contra o gabarito do Excel (dados/golden).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, lerGabarito } from '@/motor/resultadoDoGabarito';
import { tensaoPeloSpt } from './calculadoraDaTensao';

const CENARIOS = cenariosDoGabarito().map(lerGabarito);

describe('calculadora da Fig. 15 × planilha', () => {
  it('σadm e faixa pelo SPT = os da planilha', () => {
    const vistos = new Set<number>();
    for (const g of CENARIOS) {
      const n = g.nomes.SPT_b;
      if (typeof n !== 'number' || vistos.has(n)) continue;
      vistos.add(n);
      const t = tensaoPeloSpt(n)!;
      expect(t, g.cenario).not.toBeNull();
      expect(t.regra20N.sadm, g.cenario).toBe(g.nomes.sadm_20N);
      expect(t.regra20N.faixa, g.cenario).toBe(g.nomes.sadm_20N_fx);
      expect(t.mello.sadm, g.cenario).toBeCloseTo(g.nomes.sadm_mel as number, 9);
      expect(t.mello.faixa, g.cenario).toBe(g.nomes.sadm_mel_fx);
    }
    expect(vistos.size).toBeGreaterThan(1);
  });

  it('SPT 9: 20·N = 180 e Mello = 200 kPa, as duas dentro da faixa', () => {
    const t = tensaoPeloSpt(9)!;
    expect(t.regra20N.sadm).toBeCloseTo(180, 9);
    expect(t.mello.sadm).toBeCloseTo(200, 9);
    expect(t.regra20N.dentro && t.mello.dentro).toBe(true);
  });

  it('as faixas: 20·N vale de 5 a 20, Mello de 4 a 16', () => {
    expect(tensaoPeloSpt(4)!.regra20N.dentro).toBe(false);
    expect(tensaoPeloSpt(4)!.mello.dentro).toBe(true);
    expect(tensaoPeloSpt(20)!.regra20N.dentro).toBe(true);
    expect(tensaoPeloSpt(20)!.mello.dentro).toBe(false);
    expect(tensaoPeloSpt(25)!.regra20N.dentro).toBe(false);
  });

  it('SPT negativo ou NaN não calcula', () => {
    expect(tensaoPeloSpt(-1)).toBeNull();
    expect(tensaoPeloSpt(Number.NaN)).toBeNull();
  });
});
