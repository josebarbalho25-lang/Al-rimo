/*
  TRASPASSE espera × barra (Jose, 13/10: "NBR 6118: 2,0 × ℓb no graute"). A conta é da planilha (aba Fundação, seção
  10: l0t_v no balanço; l0t_pv, l0t_cf e l0t_cc com contrafortes); o desenho só lê. Este teste prova, em todos os
  cenários do gabarito, que a espera desenhada sobe acima da sapata exatamente o traspasse da conta da barra dela —
  e que o digitado no app manda.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado } from '@/motor/tipos';
import { gerarModelo } from './index';

/** A célula do traspasse de cada espera, pelo id da barra (armaduras.ts: `.P<k>.E` principal, `.C<k>.E` construtiva). */
function celulaDaEspera(id: string, contrafortes: boolean): string {
  if (/\.P\d+\.E$/.test(id)) return 'l0t_cf';
  if (/\.C\d+\.E$/.test(id)) return 'l0t_cc';
  return contrafortes ? 'l0t_pv' : 'l0t_v';
}

const ehContrafortes = (r: Resultado) => String(r.v('Tipo_muro')).startsWith('Contra');

describe('a espera sobe o traspasse da conta (aba Fundação, seção 10)', () => {
  it.each(cenariosDoGabarito())('%s', (cenario) => {
    const r = resultadoDoGabarito(cenario);
    const m = gerarModelo(r, { L_total: 6 });
    const cf = ehContrafortes(r);
    const esperas = m.barras.filter((b) => b.papel === 'ESPERA');
    for (const b of esperas) {
      const l0t = r.num(celulaDaEspera(b.id, cf));
      const topo = Math.max(...b.eixo.map((p) => p[2]));
      if (l0t === null) {
        // conta sem número (ex.: tudo em branco, sem fyk): 50φ de reserva, e o aviso diz que é dedução
        expect(topo, b.id).toBeCloseTo(50 * b.diametro, 6);
        expect(m.avisos.some((a) => a.codigo === 'TRASPASSE_ADOTADO'), b.id).toBe(true);
      } else {
        expect(topo, b.id).toBeCloseTo(l0t * 10, 6);
      }
    }
  });

  it('o traspasse digitado no app manda (emendas defasadas)', () => {
    const r = resultadoDoGabarito('aula122');
    const m = gerarModelo(r, { L_total: 6, traspasse_dir: 45 });
    const esperas = m.barras.filter((b) => b.papel === 'ESPERA');
    expect(esperas.length).toBeGreaterThan(0);
    for (const b of esperas) expect(Math.max(...b.eixo.map((p) => p[2])), b.id).toBeCloseTo(450, 6);
  });

  it('balanço da aula 12.2: a conta da NBR 6118 refeita à mão bate com a planilha', () => {
    const r = resultadoDoGabarito('aula122');
    const n = (k: string) => r.num(k) as number;
    // fbd = 2,25·0,21·fgk^(2/3)/1,4 (η2 = η3 = 1); ℓb/φ = fyd/(4·fbd) — com fgk 20 dá 43,7
    const fbd = (2.25 * 0.21 * n('fgk_') ** (2 / 3)) / 1.4;
    expect(n('lbphi_gr')).toBeCloseTo(n('fyd_') / (4 * fbd), 9);
    const lb = (n('lbphi_gr') * n('phi_v')) / 10;
    const esperado = Math.ceil(Math.max(2 * lb * n('r_anc'), 0.3 * 2 * lb, 1.5 * n('phi_v'), 20) - 1e-9);
    expect(n('l0t_v')).toBe(esperado);
  });
});
