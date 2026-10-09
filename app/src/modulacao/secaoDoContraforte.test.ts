/*
  A SEÇÃO REAL DO CONTRAFORTE × OS TEMPLATES DO REVIT × A TABELA DA PLANILHA.

  Três coisas presas umas às outras:
    1. o que foi MEDIDO nos templates do Jose (dados/encaixes_revit/*_templates.json, lido peça a peça em 09/10): em
       todas as fiadas de bloco, nos contrafortes de ponta e no intermediário, o furo da ponta comum às fiadas P e I
       vai de 2,5 a 16,5 cm da ponta no bloco 14 e de 3,5 a 16,5 cm no 19 → c = 9,5 / 10,0 cm, d = 24,5 / 44,5 /
       49,0 / 69,0 cm;
    2. a seção que o app monta com o catálogo e as receitas (secaoDoContraforte.ts) — tem de dar o mesmo;
    3. a tabela da planilha (aba Referências, colunas AT–BA), que é o que a CONTA usa — tem de ser igual à 2.
  Catálogo ou receita mudou e o furo da ponta andou → este teste quebra; refazer a tabela em tools/contrafortes.py.
*/
import { describe, expect, it } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import type { PlanilhaExportada } from '@/motor/tipos';
import { MONTAGENS, areaDoFuroComum, barrasQueCabem, cDaMontagem, secaoDoContraforte, arranjoNaSecao } from './secaoDoContraforte';

const P = dados as unknown as PlanilhaExportada;

/** Células de um nome de intervalo, linha a linha (a planilha exportada guarda o endereço de cada nome). */
function intervalo(nome: string): (string | number | null)[][] {
  const ref = P.nomes[nome];
  const m = /^(.+)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`${nome} não é intervalo: ${ref}`);
  const col = (s: string) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  const letra = (n: number) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const [, aba, c0, r0, c1, r1] = m;
  const out: (string | number | null)[][] = [];
  for (let r = Number(r0); r <= Number(r1); r++) {
    const linha: (string | number | null)[] = [];
    for (let c = col(c0); c <= col(c1); c++) linha.push((P.celulas[`${aba}!${letra(c)}${r}`] ?? null) as string | number | null);
    out.push(linha);
  }
  return out;
}
const coluna = (nome: string) => intervalo(nome).map((l) => l[0]);

describe('furo da ponta medido nos templates do Revit', () => {
  // [família, tenr (mm), da ponta até o começo do trecho comum, comprimento do trecho comum, c, d] — mm
  const MEDIDO = [
    ['14x39', 340, 25, 140, 95, 245],
    ['14x39', 540, 25, 140, 95, 445],
    ['19x39', 590, 35, 130, 100, 490],
    ['19x39', 790, 35, 130, 100, 690],
  ] as const;
  for (const [familia, tenr, a, l, c, d] of MEDIDO) {
    for (const no of ['T', 'L'] as const) {
      it(`${familia} contraforte de ${tenr / 10} (${no === 'T' ? 'intermediário' : 'de ponta'})`, () => {
        const s = secaoDoContraforte(familia, tenr, 'enterrado', no);
        expect(tenr - s.furo.ate).toBeCloseTo(a, 6);
        expect(s.furo.ate - s.furo.de).toBeCloseTo(l, 6);
        expect(s.c).toBeCloseTo(c, 6);
        expect(s.d).toBeCloseTo(d, 6);
        // as duas fiadas têm peças diferentes na ponta (é por isso que o trecho comum importa)
        const ponta = (f: 'P' | 'I') => s.haste[f].reduce((p, q) => (q.eta + q.comp > p.eta + p.comp ? q : p));
        expect(ponta('P').chave).not.toBe(ponta('I').chave);
      });
    }
  }

  it('aparente (espelho do template): barra na célula do muro, junto ao solo', () => {
    expect(secaoDoContraforte('14x39', 540, 'aparente', 'T').c).toBeCloseTo(70, 6);
    expect(secaoDoContraforte('14x39', 340, 'aparente', 'L').c).toBeCloseTo(70, 6);
    // 19x39: no T o bloco do muro é o meio (furo 14 × 14); na ponta, o inteiro (12,6 de largura) — vale o maior c
    expect(secaoDoContraforte('19x39', 590, 'aparente', 'T').c).toBeCloseTo(100, 6);
    expect(secaoDoContraforte('19x39', 590, 'aparente', 'L').c).toBeCloseTo(96.5, 6);
    expect(cDaMontagem('19x39', 790, 'aparente')).toBeCloseTo(100, 6);
  });

  it('o grupo de barras fica com o centro no c (é o que preserva o d da conta)', () => {
    const s = secaoDoContraforte('14x39', 540, 'enterrado', 'T');
    const a = arranjoNaSecao(s, 95, 4, 10);
    const eta = a.barras.reduce((x, b) => x + b[1], 0) / a.barras.length;
    expect(eta).toBeCloseTo(540 - 95, 6);
    expect(a.folga).toBeGreaterThanOrEqual(15);
  });
});

describe('tabela da planilha (Referências, montagens do contraforte) = seção do app', () => {
  const chaves = coluna('mont_ch');
  const ts = coluna('mont_t');
  const cE = coluna('mont_cE');
  const cA = coluna('mont_cA');
  const AE = coluna('mont_AE');
  const AA = coluna('mont_AA');
  const phis = intervalo('mont_phi')[0] as number[];
  const nE = intervalo('mont_nE');
  const nA = intervalo('mont_nA');

  it('as montagens da tabela são as do app (bloco 14: 34 e 54; bloco 19: 59 e 79)', () => {
    expect(chaves).toEqual(MONTAGENS.map((x) => `${x.familia.slice(0, 2)}x${x.tenr / 10}`));
    expect(ts).toEqual(MONTAGENS.map((x) => Number(x.familia.slice(0, 2))));
  });

  MONTAGENS.forEach(({ familia, tenr }, i) => {
    it(`${familia} · ${tenr / 10}: c, área do furo comum e barras que cabem`, () => {
      expect(Number(cE[i]) * 10).toBeCloseTo(cDaMontagem(familia, tenr, 'enterrado'), 6);
      expect(Number(cA[i]) * 10).toBeCloseTo(cDaMontagem(familia, tenr, 'aparente'), 6);
      // a tabela guarda cm² com 2 casas
      expect(Math.abs(Number(AE[i]) * 100 - areaDoFuroComum(familia, tenr, 'enterrado'))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(Number(AA[i]) * 100 - areaDoFuroComum(familia, tenr, 'aparente'))).toBeLessThanOrEqual(0.5);
      phis.forEach((phi, k) => {
        expect(nE[i][k], `enterrado Ø${phi}`).toBe(barrasQueCabem(familia, tenr, 'enterrado', phi));
        expect(nA[i][k], `aparente Ø${phi}`).toBe(barrasQueCabem(familia, tenr, 'aparente', phi));
      });
    });
  });
});
