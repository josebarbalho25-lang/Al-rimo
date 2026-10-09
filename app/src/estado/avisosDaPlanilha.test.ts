// O aviso da coesão (Jose, 08/10: "coesão liberada, com aviso"). O texto e a
// condição são da PLANILHA (aviso_coesao); aqui se confere que o app lê a
// célula — com c' = 0 nada aparece, com c' > 0 aparece o texto dela — no
// estado, na lista da barra e no card do empuxo.
import { describe, expect, it } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import { calcular } from '@/motor';
import type { EntradaMeta, Resultado } from '@/motor/tipos';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { autorSolo } from '@/memoria/cards/solo';
import {
  _avisos,
  avisoDaPlanilha,
  avisoDoCampo,
  avisosDaPlanilha,
  textoDoAviso,
  textosDosAvisos,
} from './avisosDaPlanilha';
import { padroesDe, recalcular } from './recalculo';

const P = dados as unknown as { nomes: Record<string, string>; entradas: EntradaMeta[] };
const empuxo = (r: Resultado) => autorSolo(r).find((c) => c.id === 'solo.empuxo')!;

describe('a tabela dos avisos', () => {
  it('toda célula de aviso existe na planilha, e o campo dela existe no painel', () => {
    const campos = new Set([...P.entradas, ...ENTRADAS_DO_MODELO].map((e) => e.nome));
    for (const a of _avisos) {
      expect(P.nomes[a.nome], a.nome).toBeDefined();
      expect(campos.has(a.campo), a.campo).toBe(true);
    }
  });

  it('célula vazia, "—", número e erro de fórmula não avisam', () => {
    expect(textoDoAviso('')).toBeNull();
    expect(textoDoAviso('  ')).toBeNull();
    expect(textoDoAviso('—')).toBeNull();
    expect(textoDoAviso(null)).toBeNull();
    expect(textoDoAviso(0)).toBeNull();
    expect(textoDoAviso({ erro: '#VALUE!' })).toBeNull();
    expect(textoDoAviso('c > 0')).toBe('c > 0');
  });
});

describe("c' = 0: nada aparece", () => {
  const r = calcular({}); // o padrão da planilha despreza a coesão
  it('a conta', () => {
    expect(r.num('c_solo')).toBe(0);
    expect(avisosDaPlanilha(r)).toEqual([]);
    expect(avisoDaPlanilha(r, 'aviso_coesao')).toBeNull();
  });
  it('o campo, a barra e o card', () => {
    expect(avisoDoCampo(avisosDaPlanilha(r), 'c_solo')).toBeNull();
    expect(textosDosAvisos(avisosDaPlanilha(r), [])).toEqual([]);
    expect(empuxo(r).avisos).toEqual([]);
  });
});

describe("c' > 0: o aviso da planilha aparece, com o texto da célula", () => {
  const r = calcular({ c_solo: 10 });
  const daCelula = r.v('aviso_coesao');

  it('a planilha publicou um texto (é ele, e não outro, que o app mostra)', () => {
    expect(typeof daCelula).toBe('string');
    expect(String(daCelula).length).toBeGreaterThan(0);
  });

  it('no estado: um aviso, do campo da coesão', () => {
    expect(avisosDaPlanilha(r)).toEqual([{ nome: 'aviso_coesao', campo: 'c_solo', texto: daCelula }]);
    const feito = recalcular({ calcular, gerador: null, veredito: null }, { c_solo: 10 }, {}, padroesDe(ENTRADAS_DO_MODELO));
    expect(feito.avisosDaConta).toEqual(avisosDaPlanilha(r));
  });

  it('ao lado do campo: só na coesão', () => {
    const avisos = avisosDaPlanilha(r);
    expect(avisoDoCampo(avisos, 'c_solo')).toBe(daCelula);
    expect(avisoDoCampo(avisos, 'phi_solo')).toBeNull();
  });

  it('na barra: entra na contagem, antes dos avisos da modulação', () => {
    const lista = textosDosAvisos(avisosDaPlanilha(r), [{ texto: 'Junta fora do módulo' }]);
    expect(lista).toEqual([daCelula, 'Junta fora do módulo']);
  });

  it('no card do empuxo', () => {
    expect(empuxo(r).avisos).toEqual([daCelula]);
  });

  it('conta com erro: nenhum aviso (o erro já aparece como erro)', () => {
    expect(avisosDaPlanilha(null)).toEqual([]);
    const feito = recalcular(
      { calcular: () => { throw new Error('x'); }, gerador: null, veredito: null },
      {},
      {},
      padroesDe(ENTRADAS_DO_MODELO),
    );
    expect(feito.avisosDaConta).toEqual([]);
  });
});

describe('gabarito do Excel: aviso se, e só se, c\' > 0', () => {
  it('em todos os cenários', () => {
    const errados: string[] = [];
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      const tem = avisoDaPlanilha(r, 'aviso_coesao') !== null;
      if (tem !== (r.num('c_solo') ?? 0) > 0) errados.push(c);
      if (tem !== (empuxo(r).avisos.length > 0)) errados.push(`${c} (card)`);
    }
    expect(errados).toEqual([]);
  });
});
