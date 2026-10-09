/*
  A calculadora da Fig. 22 tem de dar o número da PLANILHA (Excel), não um parecido: Ka e Kp pelo mesmo φ' com o
  "Ka direto" em branco, e a linha de argila pelo mesmo NSPT. Conferido contra o gabarito do Excel (dados/golden).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, lerGabarito } from '@/motor/resultadoDoGabarito';
import { argilaPeloNspt, rankine } from './calculadoraDoSolo';

const CENARIOS = cenariosDoGabarito().map(lerGabarito);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

describe('calculadora da Fig. 22 × planilha', () => {
  it('Ka e Kp pelo φ\' = Ka_ e Kp_ da planilha quando o Ka direto está em branco', () => {
    const porPhi = CENARIOS.filter((g) => g.nomes.Ka_dir === null && typeof g.nomes.phi_solo === 'number');
    expect(porPhi.length).toBeGreaterThan(5);
    for (const g of porPhi) {
      const k = rankine(g.nomes.phi_solo as number);
      expect(k, g.cenario).not.toBeNull();
      expect(k!.Ka, g.cenario).toBe(num(g.nomes.Ka_));
      expect(k!.Kp, g.cenario).toBe(num(g.nomes.Kp_));
    }
  });

  it('φ\' de 30° dá a conta de Rankine (tg² de 30° e de 60°)', () => {
    const k = rankine(30)!;
    expect(k.Ka).toBeCloseTo(1 / 3, 12);
    expect(k.Kp).toBeCloseTo(3, 12);
  });

  it('φ\' fora do campo (negativo, acima de 60°, NaN) não calcula', () => {
    expect(rankine(-1)).toBeNull();
    expect(rankine(61)).toBeNull();
    expect(rankine(Number.NaN)).toBeNull();
  });

  it('a linha de argila pelo NSPT é a da planilha (consistência, c\', φ\', su)', () => {
    const texto = (v: unknown) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v === null || v === '' ? '—' : String(v));
    const vistos = new Set<number>();
    for (const g of CENARIOS) {
      const n = g.nomes.NSPT;
      if (typeof n !== 'number' || vistos.has(n)) continue;
      vistos.add(n);
      const a = argilaPeloNspt(n)!;
      expect(a.consistencia, g.cenario).toBe(texto(g.nomes.cons_arg));
      expect(a.c, g.cenario).toBe(texto(g.nomes.c_arg));
      expect(a.phi, g.cenario).toBe(texto(g.nomes.phi_arg));
      expect(a.su, g.cenario).toBe(texto(g.nomes.su_arg));
    }
    expect(vistos.size).toBeGreaterThan(0);
  });

  it('as cinco consistências da NBR 6484 aparecem pelo NSPT', () => {
    const c = [0, 2, 3, 5, 6, 10, 11, 19, 20, 40].map((n) => argilaPeloNspt(n)!.consistencia);
    expect(new Set(c).size).toBe(5);
    expect(argilaPeloNspt(-1)).toBeNull();
  });
});
