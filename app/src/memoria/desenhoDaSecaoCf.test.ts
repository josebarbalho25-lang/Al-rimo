/*
  A FIGURA DA SEÇÃO DO CONTRAFORTE × AS CÉLULAS. A figura não pode dizer um número diferente da conta: em todo cenário
  do gabarito, as cotas (bm, t, tenr, d, c, bw) são as das células, e o número de barras desenhadas é o n da conta.
  E o c da linha da memória sai da montagem (template do Revit) quando as Entradas não impõem outro.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { nbr } from './formato';
import { autorContraforte } from './cards/contraforte';
import { desenhoDaSecaoDoContraforte } from './desenhoDaSecaoCf';

const cota = (v: number) => nbr(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);

describe('seção do contraforte desenhada e cotada', () => {
  const cenarios = cenariosDoGabarito();
  let comFigura = 0;
  for (const c of cenarios) {
    it(c, () => {
      const r = resultadoDoGabarito(c);
      const fig = desenhoDaSecaoDoContraforte(r);
      const n = r.num('n_cf');
      const d = r.num('d_cf');
      if (n === null || d === null) {
        expect(fig).toBeNull();
        return;
      }
      expect(fig).not.toBeNull();
      comFigura++;
      const svg = fig!.svg;
      expect(svg.match(/<svg/g)?.length).toBe(1);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).toContain(`d = ${cota(d)}`);
      expect(svg).toContain(`c = ${cota(r.num('c_cf')!)}`);
      expect(svg).toContain(`tenr = ${cota(r.num('tenr_adot')!)}`);
      expect(svg).toContain(`bw = ${cota(r.num('bw_cf')!)}`);
      if (r.num('cf_T') === 1) expect(svg).toContain(`bm = ${cota(r.num('bm_cf')!)}`);
      // barras cheias: n na vista geral + n no detalhe + 1 na legenda
      expect(svg.match(/<circle [^>]*fill="#1a1a1a"\/>/g)?.length).toBe(2 * n + 1);
      // a mesma figura nos dois cards que usam a seção (flexão: d; ELS: A, yG, I)
      const cards = autorContraforte(r);
      expect(cards.find((k) => k.id === 'contraforte.flexao')?.desenho?.svg).toBe(svg);
      expect(cards.find((k) => k.id === 'contraforte.els')?.desenho?.svg).toBe(svg);
    });
  }
  it('há cenários com figura (aula 12.3 e sorteios de contraforte)', () => {
    expect(comFigura).toBeGreaterThan(5);
  });

  it('c da memória: da montagem (template do Revit) sem valor nas Entradas; da entrada quando digitado', () => {
    for (const c of cenarios) {
      const r = resultadoDoGabarito(c);
      const secoes = autorContraforte(r).find((k) => k.id === 'contraforte.flexao')!.secoes;
      const montagem = secoes.find((s) => s.passos.some((p) => p.id === 'c_mont'));
      // a fonte aparece no título da seção: "Barra na montagem · Template do Revit · 14×39 · contraforte de 54"
      expect(montagem?.ref?.fonte, c).toBe('Template do Revit');
      expect(montagem?.ref?.item, c).toContain(`contraforte de ${r.num('tenr_adot')}`);
      const passo = secoes.flatMap((s) => s.passos).find((p) => p.id === 'c_cf');
      if (!passo) continue;
      if (r.num('c_cf_dir') === null) {
        expect(passo.expr, c).toMatchObject({ k: 'nome', nome: 'c_mont' });
        expect(passo.valor, c).toBe(r.num('c_mont'));
      } else {
        expect(passo.origem, c).toBe('entrada');
      }
    }
  });
});
