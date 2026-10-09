/*
  Comportamento do Resultado e da Planilha que o gabarito não mostra: nome errado é defeito (lança erro),
  ciclo é defeito (lança ErroCiclo com o caminho), a conta é preguiçosa (só calcula o que foi pedido) — e a
  FRONTEIRA DE ENTRADA: o que o formulário manda (texto de <select>, "1,6", "", NaN, undefined, valor fora da lista)
  vira o que o Excel gravaria, ou é recusado alto. Cada caso aqui foi um defeito provado pela lente "contrato"
  na revisão adversarial: sem a conversão, a conta mudava em silêncio (t_bloco "19" mudava 78 células).
*/
import { describe, expect, it } from 'vitest';
import { ErroCiclo, Planilha } from './planilha';
import { calcular, entradas, planilha, versao } from './index';
import dados from './planilha.gerada.json';
import type { EntradaMeta, PlanilhaExportada, Valor } from './tipos';

const mini = (celulas: PlanilhaExportada['celulas'], nomes: Record<string, string> = {}, ents: EntradaMeta[] = []): Planilha =>
  new Planilha({ versao: 't', abas: ['A', 'B c'], nomes, entradas: ents, celulas });

const meta = (nome: string, ref: string, padrao: Valor, opcoes: Valor[] | null = null, formato = '0.00'): EntradaMeta => ({
  nome, rotulo: nome, padrao, unidade: '', nota: '', figura: null, opcoes, formato, secao: 'Teste', ref,
});

/** Mini-planilha com as quatro espécies de entrada do app: lista numérica escrita como texto (como o t_bloco sai
 *  do .xlsx), lista de texto, número livre e opcional em branco. */
function comEntradas(): Planilha {
  return mini(
    {
      'A!B1': 19, 'A!B2': 'Balanço', 'A!B3': 1.6, // B4 (s_dir) fica vazia: opcional em branco
      'A!C1': '=t_bloco=19', 'A!C2': '=IF(tipo="Contrafortes","cf","bal")', 'A!C3': '=h*2', 'A!C4': '=ISNUMBER(s_dir)',
      'A!C5': '=t_bloco&"x"&h',
    },
    { t_bloco: 'A!B1', tipo: 'A!B2', h: 'A!B3', s_dir: 'A!B4', dobro: 'A!C3' },
    [
      meta('t_bloco', 'A!B1', 19, ['14', '19'], '0'),
      meta('tipo', 'A!B2', 'Balanço', ['Balanço', 'Contrafortes'], 'General'),
      meta('h', 'A!B3', 1.6),
      meta('s_dir', 'A!B4', null, null, '0'),
    ],
  );
}

describe('Planilha / Resultado', () => {
  it('lê por nome, por endereço e devolve número ou null', () => {
    const p = mini(
      { 'A!A1': 2, 'A!A2': '=A1*3', 'A!A3': '=IF(A1>5,1,"—")', 'A!C5': 0, "B c!A1": "='A'!A2+1" },
      { x: 'A!A1', y: 'A!A2', z: 'A!A3' },
    );
    const r = p.calcular();
    expect(r.v('y')).toBe(6);
    expect(r.num('y')).toBe(6);
    expect(r.v('Z')).toBe('—'); // nome definido não diferencia caixa, como no Excel
    expect(r.num('z')).toBeNull();
    expect(r.cel("'B c'!A1")).toBe(7);
    expect(r.cel('A!B4')).toBeNull(); // célula vazia DENTRO da área usada
  });

  it('endereço além da área usada é defeito de quem leu, não "branco"', () => {
    // 'Contrafortes!B40000' aparecia na memória como célula vazia, escondendo o erro de digitação.
    const p = mini({ 'A!A1': 2, 'A!B3': '=A1' });
    expect(() => p.calcular().cel('A!Z99')).toThrow(/fora da área/);
    expect(() => p.calcular().cel('A!A4')).toThrow(/fora da área/);
    expect(() => p.calcular().cel('X!A1')).toThrow(/aba inexistente/);
    expect(() => p.calcular().cel('A1')).toThrow(/sem aba/);
  });

  it('simular(): escreve qualquer nome — valor, branco (null) e por cima de fórmula', () => {
    const p = mini({ 'A!A1': 2, 'A!A2': '=A1*3', 'A!A3': '=ISNUMBER(A1)', 'A!A4': '=A2+1', 'A!B9': 0 }, { x: 'A!A1', y: 'A!A2', w: 'A!A3', v: 'A!B8' });
    expect(p.simular({ x: 5 }).v('y')).toBe(15);
    const branco = p.simular({ x: null });
    expect(branco.v('w')).toBe(false);
    expect(branco.v('y')).toBe(0);
    expect(p.simular({ y: 100 }).cel('A!A4')).toBe(101);
    expect(p.simular({ v: 3 }).v('v')).toBe(3); // célula que não existia no arquivo
    expect(p.simular().v('y')).toBe(6); // cada conta é independente
    expect(() => p.simular({ x: undefined as unknown as Valor })).toThrow(/undefined/);
    expect(() => p.simular({ x: NaN })).toThrow(/inválido/);
  });

  it('nome errado é defeito, não "—"', () => {
    const p = mini({ 'A!A1': 1, 'A!B1': 2 }, { x: 'A!A1', faixa: 'A!A1:B1' });
    expect(() => p.calcular().v('nao_existe')).toThrow(/inexistente/);
    expect(() => p.calcular({ nao_existe: 1 })).toThrow(/inexistente/);
    expect(() => p.simular({ nao_existe: 1 })).toThrow(/inexistente/);
    expect(() => p.calcular().v('faixa')).toThrow(/intervalo/);
    expect(() => p.simular({ faixa: 1 })).toThrow(/intervalo/);
  });

  it('ciclo lança ErroCiclo com o caminho — e de novo igual na 2ª leitura', () => {
    const p = mini({ 'A!A1': '=A2+1', 'A!A2': '=A3', 'A!A3': '=A1' });
    const r = p.calcular();
    for (let vez = 0; vez < 2; vez++) {
      // Sem o try/finally em Calculo.celula a célula ficava presa em "calculando" depois da 1ª exceção, e a 2ª
      // leitura acusava um ciclo com outro caminho (falso).
      try {
        r.cel('A!A1');
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ErroCiclo);
        expect((e as ErroCiclo).caminho).toEqual(['A!A1', 'A!A2', 'A!A3', 'A!A1']);
      }
    }
  });

  it('SE só calcula o ramo que vale (ramo morto com ciclo não atrapalha)', () => {
    const p = mini({ 'A!A1': '=IF(TRUE,1,A1)' });
    expect(p.calcular().cel('A!A1')).toBe(1);
  });
});

describe('calcular(): a fronteira de entrada do app', () => {
  it('lista com número escrito como texto vira número (nas opções e no valor), como o Excel grava', () => {
    const p = comEntradas();
    expect(p.entradas.find((e) => e.nome === 't_bloco')!.opcoes).toEqual([14, 19]);
    for (const bruto of [14, '14', ' 14 '] as Valor[]) {
      const r = p.calcular({ t_bloco: bruto });
      expect(r.v('t_bloco')).toBe(14);
      expect(r.cel('A!C1')).toBe(false);
      expect(r.cel('A!C5')).toBe('14x1,6');
    }
    expect(p.calcular({ t_bloco: '19' }).cel('A!C1')).toBe(true);
  });

  it('número digitado no jeito pt-BR: "1,6" e "1.600"; "1.6" é recusado (no pt-BR o ponto é milhar)', () => {
    const p = comEntradas();
    expect(p.calcular({ h: '1,6' }).num('h')).toBe(1.6);
    expect(p.calcular({ h: '2,5' }).num('dobro')).toBe(5);
    expect(p.calcular({ h: '1.600' }).num('h')).toBe(1600);
    expect(() => p.calcular({ h: '1.6' })).toThrow(/não é número/);
    expect(() => p.calcular({ h: 'abc' })).toThrow(/não é número/);
    expect(() => p.calcular({ h: true })).toThrow(/tipo não aceito/);
  });

  it('texto vazio é campo apagado (null), como apagar a célula no Excel', () => {
    const p = comEntradas();
    expect(p.calcular({ s_dir: '' }).cel('A!C4')).toBe(false);
    expect(p.calcular({ s_dir: '  ' }).v('s_dir')).toBeNull();
    expect(p.calcular({ s_dir: '60' }).cel('A!C4')).toBe(true); // antes o "60" ficava texto e ÉNÚM dava FALSO
    expect(p.calcular({ h: null }).num('dobro')).toBe(0); // campo obrigatório apagado: o Excel conta 0
  });

  it('lista de texto: sem diferenciar maiúscula, devolve a grafia da lista; fora da lista é erro', () => {
    const p = comEntradas();
    const r = p.calcular({ tipo: 'contrafortes' });
    expect(r.v('tipo')).toBe('Contrafortes');
    expect(r.alteracoes.tipo).toBe('Contrafortes');
    expect(r.cel('A!C2')).toBe('cf');
    // "Contraforte" sem o s caía no ramo do balanço sem aviso nenhum.
    expect(() => p.calcular({ tipo: 'Contraforte' })).toThrow(/não está na lista/);
    expect(() => p.calcular({ t_bloco: 15 })).toThrow(/não está na lista/);
    expect(() => p.calcular({ tipo: null })).toThrow(/em branco/);
  });

  it('NaN, infinito e undefined são recusados (o Excel não tem nenhum dos três)', () => {
    const p = comEntradas();
    expect(() => p.calcular({ h: NaN })).toThrow(/inválido/);
    expect(() => p.calcular({ h: Infinity })).toThrow(/inválido/);
    expect(() => p.calcular({ h: -Infinity })).toThrow(/inválido/);
    // {h: undefined} virava "em branco" e mudava a conta; manter o padrão é não mandar a chave.
    expect(() => p.calcular({ h: undefined as unknown as Valor })).toThrow(/undefined/);
    expect(() => p.calcular({ h: { erro: '#N/A' } })).toThrow(/tipo não aceito/);
  });

  it('só entrada: nome de resultado vai pelo simular(); chave repetida com outra caixa é erro', () => {
    const p = comEntradas();
    expect(() => p.calcular({ dobro: 1 })).toThrow(/não é entrada/);
    expect(p.simular({ dobro: 1 }).num('dobro')).toBe(1);
    expect(() => p.calcular({ h: 2, H: 3 })).toThrow(/repetida/);
    expect(p.calcular({ H: 2 }).alteracoes).toEqual({ h: 2 }); // grava com a grafia da planilha
    expect(() => p.converterEntrada('dobro', 1)).toThrow(/não é entrada/);
    expect(p.converterEntrada('T_BLOCO', '14')).toBe(14);
  });

  it('r.alteracoes é uma cópia congelada do que entrou na conta', () => {
    const p = comEntradas();
    const pedido: Record<string, Valor> = { h: '2,5' };
    const r = p.calcular(pedido);
    pedido.h = 9;
    expect(r.alteracoes).toEqual({ h: 2.5 });
    expect(Object.isFrozen(r.alteracoes)).toBe(true);
    expect(r.num('h')).toBe(2.5);
  });
});

describe('a planilha real', () => {
  it('carrega: versão, entradas e fórmulas', () => {
    expect(versao).toMatch(/^[0-9a-f]{16}$/);
    expect(entradas.length).toBeGreaterThan(50);
    expect(planilha.celulasComFormula().length).toBeGreaterThan(1000);
    const r = calcular(); // padrão do gerador = exemplo da aula 12.2
    expect(r.v('H_muro')).toBe(1.6);
    expect(planilha.formula('Entradas!B6')).toBeNull();
  });

  it('toda opção de lista tem o tipo do padrão, todo padrão é aceito e toda opção é aceita', () => {
    const refs = planilha.celulasComFormula();
    const base = calcular();
    const tudoPadrao: Record<string, Valor> = {};
    for (const e of entradas) {
      tudoPadrao[e.nome] = e.padrao;
      if (!e.opcoes) continue;
      // t_bloco e caso_pan saem do .xlsx como ["14","19"]; o padrão é número. O app recebe número. null = a célula
      // vazia da lista (o "automático" da entrada opcional).
      for (const o of e.opcoes) if (e.padrao !== null && o !== null) expect(typeof o, `${e.nome} ${String(o)}`).toBe(typeof e.padrao);
      expect(e.opcoes, e.nome).toContain(e.padrao);
      for (const o of e.opcoes) expect(() => calcular({ [e.nome]: o }), `${e.nome} = ${String(o)}`).not.toThrow();
    }
    // Mandar o padrão de tudo explicitamente dá a mesma conta que não mandar nada.
    const explicito = calcular(tudoPadrao);
    const difs = refs.filter((ref) => !Object.is(explicito.cel(ref), base.cel(ref)));
    expect(difs).toEqual([]);
  });

  it('o que o formulário manda como texto dá a MESMA conta que o número (as 1.415 células)', () => {
    const refs = planilha.celulasComFormula();
    const casos: [Record<string, Valor>, Record<string, Valor>][] = [
      [{ t_bloco: '19' }, { t_bloco: 19 }],
      [{ t_bloco: '14' }, { t_bloco: 14 }],
      [{ caso_pan: '18' }, { caso_pan: 18 }],
      [{ fbk_: '8' }, { fbk_: 8 }],
      [{ phi_v: '12,5', Tipo_muro: 'contrafortes', phi_pv: '6,3' }, { phi_v: 12.5, Tipo_muro: 'Contrafortes', phi_pv: 6.3 }],
      [{ H_muro: '1,6', s_dir: '60' }, { H_muro: 1.6, s_dir: 60 }],
      [{ s_dir: '' }, { s_dir: null }],
    ];
    for (const [texto, numero] of casos) {
      const a = calcular(texto);
      const b = calcular(numero);
      const difs = refs.filter((ref) => !Object.is(a.cel(ref), b.cel(ref)) && JSON.stringify(a.cel(ref)) !== JSON.stringify(b.cel(ref)));
      expect(difs, JSON.stringify(texto)).toEqual([]);
    }
  });

  it('compilar a planilha inteira é rápido', () => {
    const t0 = performance.now();
    const p = new Planilha(dados as unknown as PlanilhaExportada);
    const ms = performance.now() - t0;
    // Primeira conta completa logo depois de compilar: o JIT ainda está frio (é o que o usuário sente ao abrir).
    const refs = p.celulasComFormula();
    const t1 = performance.now();
    const r = p.calcular();
    for (const ref of refs) r.cel(ref);
    const frio = performance.now() - t1;
    console.log(`carregar + compilar ${refs.length} fórmulas: ${ms.toFixed(1)} ms; primeira conta completa (frio): ${frio.toFixed(1)} ms`);
    expect(ms).toBeLessThan(500);
  });
});
