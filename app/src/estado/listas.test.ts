// As listas que dependem de outra entrada (montagens fechadas, Jose 09/10): as opções saem da CONTA (aba Referências
// da planilha), e o valor que sai da lista ao trocar o bloco ou o tipo de muro vai para a opção mais próxima.
import { describe, expect, it } from 'vitest';
import { calcular, entradas } from '@/motor';
import type { Alteracoes } from '@/motor/tipos';
import { ajustarAsListas, campoDe, celulasDoIntervalo, opcoesDoCampo, type Campo } from './campos';

const CAMPOS: Campo[] = entradas.map((m) => campoDe(m, 'planilha'));
const campo = (nome: string) => CAMPOS.find((c) => c.meta.nome === nome)!;
const opcoes = (nome: string, a: Alteracoes = {}) => {
  const r = calcular(a);
  return opcoesDoCampo(campo(nome), (ref) => r.cel(ref)).map((o) => o.valor);
};

describe('listas dependentes', () => {
  it('são as da planilha: altura, vão, contraforte, os espaçamentos e os Ø com espera', () => {
    const dependentes = CAMPOS.filter((c) => c.opcoesRef).map((c) => c.meta.nome).sort();
    expect(dependentes).toEqual(['H_muro', 'l_cf', 'phi_cc', 'phi_cf', 'phi_pv', 'phi_v', 's_dir', 's_pv_dir', 'tenr_']);
    for (const c of CAMPOS.filter((x) => x.opcoesRef)) expect(c.controle, c.meta.nome).toBe('lista');
  });

  it('o intervalo vira células, linha a linha', () => {
    expect(celulasDoIntervalo('Referências!AL5:AL6')).toEqual(['Referências!AL5', 'Referências!AL6']);
    expect(celulasDoIntervalo('A!Z1:AB1')).toEqual(['A!Z1', 'A!AA1', 'A!AB1']);
  });

  it('altura: fiadas inteiras, até 3,0 m no balanço e 4,0 m com contrafortes', () => {
    const bal = opcoes('H_muro');
    expect(bal[0]).toBe(0.6);
    expect(bal[bal.length - 1]).toBe(3);
    expect(bal).toContain(1.6);
    expect(bal).not.toContain(1.5);
    const cf = opcoes('H_muro', { Tipo_muro: 'Contrafortes' });
    expect(cf[cf.length - 1]).toBe(4);
    expect(cf).toContain(2.6);
  });

  it('contraforte: 59/79 no bloco 19, 34/54 no bloco 14', () => {
    expect(opcoes('tenr_')).toEqual([59, 79]);
    expect(opcoes('tenr_', { t_bloco: 14 })).toEqual([34, 54]);
  });

  it('vão: 19×39 de 20 em 20 cm (0,80 a 4,00); 14×39 só os que amarram (0,95; 1,35 … 3,75)', () => {
    const v19 = opcoes('l_cf');
    expect(v19.length).toBe(17);
    expect(v19[0]).toBe(0.8);
    expect(v19[v19.length - 1]).toBe(4);
    expect(v19).toContain(1.6);
    expect(opcoes('l_cf', { t_bloco: 14 })).toEqual([0.95, 1.35, 1.75, 2.15, 2.55, 2.95, 3.35, 3.75]);
  });

  it('barras: auto + múltiplos de m até 6t', () => {
    expect(opcoes('s_dir')).toEqual([null, 20, 40, 60, 80, 100]);
    expect(opcoes('s_pv_dir', { t_bloco: 14 })).toEqual([null, 20, 40, 60, 80]);
  });

  it('valor que saiu da lista vai para a opção mais próxima (empate: o lado da segurança)', () => {
    const a: Alteracoes = { t_bloco: 14, tenr_: 79, l_cf: 1.5, s_dir: 100 };
    const r = calcular(a);
    const t = ajustarAsListas(CAMPOS, a, (ref) => r.cel(ref));
    expect(t.alteracoes).toEqual({ t_bloco: 14, tenr_: 54, l_cf: 1.35, s_dir: 80 });
    expect(t.ajustes).toEqual(
      expect.arrayContaining([
        { nome: 'tenr_', de: 79, para: 54 },
        { nome: 'l_cf', de: 1.5, para: 1.35 },
        { nome: 's_dir', de: 100, para: 80 },
      ]),
    );
    // empate no vão (1,50 entre 1,40 e 1,60): para cima, como o l_cf_adot da planilha (1,60 é o padrão: a chave sai)
    const b: Alteracoes = { l_cf: 1.5 };
    const rb = calcular(b);
    const tb = ajustarAsListas(CAMPOS, b, (ref) => rb.cel(ref));
    expect(tb.ajustes).toEqual([{ nome: 'l_cf', de: 1.5, para: 1.6 }]);
    expect(tb.alteracoes).toEqual({});
    // empate no espaçamento (50 entre 40 e 60): para baixo, como o s_adot (40 é o padrão)
    const c: Alteracoes = { s_dir: 50 };
    const rc = calcular(c);
    expect(ajustarAsListas(CAMPOS, c, (ref) => rc.cel(ref)).ajustes).toEqual([{ nome: 's_dir', de: 50, para: 40 }]);
  });

  /*
    Ø com espera (Jose, 09/10): só os Ø cuja dobra do pé cabe na sapata — 2c + malha + D + 2φ ≤ h (D = 5φ até Ø16,
    8φ no Ø20). Com c = 4 e a malha do padrão (10 + 6,3): Ø12,5 pede 18,4 cm, Ø16 20,8, Ø20 29,6. É o que o Jose
    viu no Revit: sapata de 20 cm não comporta a dobra a partir do Ø16.
  */
  it('Ø com espera: os que a dobra cabe na sapata (20/25/30/40 cm com c = 4)', () => {
    const ate = (n: number) => [6.3, 8, 10, 12.5, 16, 20].slice(0, n);
    expect(opcoes('phi_v', { h_sap: 0.2 })).toEqual(ate(4));
    expect(opcoes('phi_v', { h_sap: 0.25 })).toEqual(ate(5));
    expect(opcoes('phi_v')).toEqual(ate(6));                          // padrão: 30 cm
    expect(opcoes('phi_v', { h_sap: 0.4 })).toEqual(ate(6));
    // as quatro barras com espera leem a mesma lista
    for (const n of ['phi_pv', 'phi_cf', 'phi_cc']) expect(opcoes(n, { h_sap: 0.2 }), n).toEqual(ate(4));
    // a malha entra na conta: com Ø12,5 + Ø8 por baixo, o Ø12,5 já não cabe em 20 cm (2·4 + 1,25 + 0,8 + 8,75 = 18,8;
    // com cobrimento 5: 20,8)
    expect(opcoes('phi_v', { h_sap: 0.2, cob_sap: 5, phi_sap: 12.5, phi_sap2: 8 })).toEqual(ate(3));
    // espera reta (sem gancho) não dobra: todos
    expect(opcoes('phi_v', { h_sap: 0.2, gancho_: 'Não' })).toEqual(ate(6));
    // não teria nem o 6,3: lista vazia (a memória e a aba Fundação acusam)
    expect(opcoes('phi_v', { h_sap: 0.12 })).toEqual([]);
  });

  it('Ø com espera que deixou de caber vai para o MAIOR que cabe, com o "→"', () => {
    const a: Alteracoes = { h_sap: 0.2, phi_v: 20, phi_cf: 16, phi_pv: 12.5 };
    const r = calcular(a);
    const t = ajustarAsListas(CAMPOS, a, (ref) => r.cel(ref));
    expect(t.alteracoes).toEqual({ h_sap: 0.2, phi_v: 12.5, phi_cf: 12.5, phi_pv: 12.5 });
    expect(t.ajustes).toEqual(
      expect.arrayContaining([
        { nome: 'phi_v', de: 20, para: 12.5 },
        { nome: 'phi_cf', de: 16, para: 12.5 },
      ]),
    );
    expect(t.ajustes.find((x) => x.nome === 'phi_pv')).toBeUndefined();
  });

  it('dentro da lista, e em branco no opcional, nada muda', () => {
    const a: Alteracoes = { t_bloco: 14, tenr_: 54, l_cf: 1.35, s_dir: null, H_muro: 2.6, Tipo_muro: 'Contrafortes' };
    const r = calcular(a);
    const t = ajustarAsListas(CAMPOS, a, (ref) => r.cel(ref));
    expect(t.ajustes).toEqual([]);
    expect(t.alteracoes).toBe(a);
  });
});
