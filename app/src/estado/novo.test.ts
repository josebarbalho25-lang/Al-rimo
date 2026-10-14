/*
  O MURO NOVO e o EXEMPLO (Jose, 13/10: "Branco + exemplo à parte"). O exemplo tem de ser a aula 12.2 — os números
  que a regressão confere — com a sapata rígida; o novo tem de pedir exatamente os dados do terreno e do projeto.
*/
import { describe, expect, it } from 'vitest';
import { calcular, entradas } from '@/motor';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { leitorDeValores, montarSecoes } from './campos';
import { alteracoesDoExemplo, alteracoesDoNovo, dadosFaltando, EM_BRANCO_NO_NOVO, EM_BRANCO_NO_NOVO_MODELO, extrasDoNovo } from './novo';

const METAS = new Map([...entradas, ...ENTRADAS_DO_MODELO].map((m) => [m.nome, m] as const));
const CAMPOS = montarSecoes(entradas, ENTRADAS_DO_MODELO).flatMap((s) => s.campos);

describe('o exemplo é a aula 12.2, com a sapata rígida', () => {
  const r = calcular(alteracoesDoExemplo());
  it('os números da aula (testar.py): Mr 42,45; heq 9,3; δadm 12,8; βf 0,118', () => {
    expect(r.num('Mr_')).toBeCloseTo(42.45, 1);
    expect(r.num('heq_')).toBeCloseTo(9.3, 1);
    expect(r.num('dadm_')).toBeCloseTo(12.8, 1);
    expect(r.num('beta_f')).toBeCloseTo(0.118, 3);
  });
  it('sapata de 0,45: rígida pela NBR 6118 22.6.1, (1,40 − 0,19)/3 = 0,403', () => {
    expect(r.num('h_rig')).toBeCloseTo((1.4 - 0.19) / 3, 9);
    expect(r.num('h_sap')).toBe(0.45);
    expect(String(r.v('chk_rig'))).toMatch(/^OK/);
  });
  it('nada falta no exemplo', () => {
    expect(dadosFaltando(CAMPOS, leitorDeValores(METAS, alteracoesDoExemplo(), {}))).toEqual([]);
  });
});

describe('o muro novo pede os dados do terreno e do projeto', () => {
  it('falta exatamente a lista do Novo (no balanço, o tipo padrão)', () => {
    const faltam = dadosFaltando(CAMPOS, leitorDeValores(METAS, alteracoesDoNovo(), extrasDoNovo()));
    expect([...faltam].sort()).toEqual([...EM_BRANCO_NO_NOVO, ...EM_BRANCO_NO_NOVO_MODELO].sort());
  });
  it('os opcionais com o número da aula ficam no automático; sem dente', () => {
    const a = alteracoesDoNovo();
    expect(a.Ka_dir).toBeNull();
    expect(a.s_dir).toBeNull();
    expect(a.d_dir).toBeNull();
    expect(a.b_den).toBe(0);
    expect(a.h_den).toBe(0);
  });
  it('preenchido o que falta, não falta mais nada', () => {
    const a = { ...alteracoesDoNovo(), H_muro: 1.6, H_solo: 1.6, NSPT: 5, gama_solo: 19, phi_solo: 25, q_sobre: 2, B_sap: 1.4, h_sap: 0.4, a_ater: 0.95, SPT_b: 10, phi_base: 25 };
    expect(dadosFaltando(CAMPOS, leitorDeValores(METAS, a, { L_total: 6 }))).toEqual([]);
  });
});
