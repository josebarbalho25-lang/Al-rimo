/*
  CHAMADAS E LISTA DE FERROS NA PRANCHA (Jose, 15/10: "hoje o armador não monta só com a prancha") — o que quebraria:
  - a mesma barra (Ø, dobra, comprimento) com dois N porque está em elementos diferentes;
  - chamada com número diferente da lista de ferros (quantidade, c/, C=);
  - posição cortada no desenho sem chamada;
  - forma da barra com o arco da dobra contado como trecho, ou com a medida errada;
  - a lista sumindo do quadro, ou não saindo quando o projetista desliga.
*/
import { describe, expect, it } from 'vitest';
import { espera, estribo, numerarPosicoes, reta } from '@/modulacao/barras';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { listaDeFerros } from '@/quantitativo/aco';
import { elementoDaBarra, espacamentoDaPosicao, textoDaChamada, type ElementoDaBarra } from '@/desenhos/chamadas';
import { vistaParaPrancha } from '@/desenhos';
import { Prancha } from '@/desenhos/prancha';
import { formaDaBarra } from '../formaDaBarra';
import { listaDeFerrosDaFolha } from '../quadro';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { lerPranchas, novaFolha } from '../padrao';
import type { PedidoDeVista, Primitiva } from '../tipos';

const muro = (c: string) => gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6 });

describe('numeração: barra igual = mesmo N, de qualquer elemento', () => {
  it('a vertical do muro e a construtiva do contraforte iguais saem com o mesmo N; outra bitola, outro N', () => {
    const b = numerarPosicoes([
      reta('a', 'VERT_MURO', 10, [0, 50, 0], [0, 50, 2600], 1),
      reta('b', 'CF_CONSTRUTIVA', 10, [500, 300, 0], [500, 300, 2600], 1, 1),
      reta('c', 'CF_CONSTRUTIVA', 12.5, [500, 400, 0], [500, 400, 2600], 1, 1),
    ]);
    expect(b[0].posicao).toBe(b[1].posicao);
    expect(b[2].posicao).not.toBe(b[0].posicao);
    // e a lista de ferros diz os dois elementos na linha
    const l = listaDeFerros(b).linhas.find((x) => x.posicao === b[0].posicao)!;
    expect(l.quantidade).toBe(2);
    expect(l.elemento).toBe('Vertical do muro + Contraforte · construtiva');
  });
});

describe('forma da barra para a lista', () => {
  it('reta: um trecho, o comprimento', () => {
    const f = formaDaBarra(reta('r', 'VERT_MURO', 10, [0, 0, 0], [0, 0, 2570], 1));
    expect(f.trechos).toEqual([257]);
  });

  it('espera com gancho: dois trechos, de vértice a vértice — o arco da dobra não é trecho', () => {
    const e = espera('e', 10, 0, 100, -250, 550, true, 1, 1);
    const f = formaDaBarra(e);
    expect(f.trechos).toHaveLength(2);
    // o trecho de pé vai do topo ao cruzamento com o eixo do gancho; o gancho tem 8φ de ponta reta + o raio
    expect(f.trechos[0] + f.trechos[1]).toBeGreaterThanOrEqual(Math.round(e.comprimento / 10));
    expect(Math.max(...f.trechos)).toBeGreaterThan(70);
  });

  it('estribo: o retângulo dos cantos, quatro trechos', () => {
    const s = estribo('s', 'CF_ESTRIBO', 6.3, [[0, 0, 0], [0, 490, 0], [0, 490, 140], [0, 0, 140]], 1, 1);
    const f = formaDaBarra(s);
    expect(f.fechada).toBe(true);
    expect([...f.trechos].sort((a, b) => a - b)).toEqual([14, 14, 49, 49]);
  });

  it('muro de verdade: toda barra tem forma, e nenhum trecho de 0 cm', () => {
    for (const c of ['aula122', 'aula123']) {
      const m = muro(c);
      for (const l of listaDeFerrosDaFolha(m)) {
        expect(l.forma.trechos.length, `${c} ${l.posicao}`).toBeGreaterThan(0);
        for (const t of l.forma.trechos) expect(t, `${c} ${l.posicao}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('chamadas', () => {
  it('"N – quantidade Ø c/ C=": os números da lista de ferros, c/ só na distribuída', () => {
    const m = muro('aula122');
    const linhas = listaDeFerros(m.barras).linhas;
    for (const l of linhas) {
      const t = textoDaChamada(m, l.posicao);
      expect(t.startsWith(`${l.posicao} – ${l.quantidade} Ø`), t).toBe(true);
      expect(t.endsWith(`C=${l.comprimentoUnit}`), t).toBe(true);
    }
    // a vertical do muro da aula 12.2 vai a cada 40
    const vert = m.barras.filter((b) => b.papel === 'VERT_MURO');
    expect(espacamentoDaPosicao(vert.filter((b) => b.posicao === vert[0].posicao))).toBe(40);
    expect(textoDaChamada(m, vert[0].posicao)).toContain(' c/40 ');
  });

  it('o corte e a vista na prancha chamam toda posição que desenham; na tela (sem pedido) não há chamada', () => {
    const m = muro('aula123');
    for (const pedido of [{ tipo: 'corte' as const }, { tipo: 'frontal' as const }]) {
      const v = vistaParaPrancha(m, pedido, 25, 'v');
      const chamadas = v.primitivas.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.camada === 'chamadas');
      expect(chamadas.length, pedido.tipo).toBeGreaterThan(0);
      for (const c of chamadas) expect(c.t).toMatch(/^N\d+ – \d+ Ø[\d,]+( c\/\d+)? C=\d+$/);
      // uma chamada por posição e elemento, e nenhum "c/" de feixe (as barras do contraforte vão a 1–2 cm)
      expect(new Set(chamadas.map((c) => c.t)).size).toBe(chamadas.length);
      for (const c of chamadas) expect(c.t, pedido.tipo).not.toMatch(/ c\/[1-9] /);
    }
  });
});

describe('chamada por elemento (muro, contraforte, sapata)', () => {
  const chamadasDe = (m: ReturnType<typeof muro>, pedido: PedidoDeVista) =>
    vistaParaPrancha(m, pedido, 25, 'v').primitivas.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.camada === 'chamadas').map((p) => p.t);

  it('o N que serve ao painel e ao contraforte: cada chamada conta o seu elemento, e as duas somam a lista', () => {
    const m = muro('aula123');
    const porN = new Map<string, Set<ElementoDaBarra>>();
    for (const b of m.barras) porN.set(b.posicao, (porN.get(b.posicao) ?? new Set()).add(elementoDaBarra(b)));
    const dividido = [...porN].find(([, es]) => es.size > 1);
    expect(dividido, 'algum N dividido entre elementos na aula 12.3').toBeDefined();
    const [n, elementos] = dividido!;
    const soma = [...elementos].reduce((s, e) => s + Number(textoDaChamada(m, n, e).split(' ')[2]), 0);
    expect(soma).toBe(listaDeFerros(m.barras).linhas.filter((l) => l.posicao === n).reduce((s, l) => s + l.quantidade, 0));
  });

  it('nenhuma chamada repetida no mesmo desenho, nem com a principal e a construtiva do contraforte com o mesmo N', () => {
    for (const c of ['aula123', 'sorteio04', 'sorteio06', 'sorteio25']) {
      const m = muro(c);
      const pedidos: PedidoDeVista[] = [{ tipo: 'frontal' }, { tipo: 'corte' }];
      if (m.dims.contrafortes.length) pedidos.push({ tipo: 'corte', x: m.dims.contrafortes[0].x });
      for (const pedido of pedidos) {
        const t = chamadasDe(m, pedido);
        expect(new Set(t).size, `${c} ${pedido.tipo}`).toBe(t.length);
      }
    }
  });

  it('em 1:75 e 1:100 a coluna das chamadas fica à direita de toda cota e legenda (o afastamento delas é fixo em px)', () => {
    const m = muro('aula122');
    for (const escala of [75, 100]) {
      for (const pedido of [{ tipo: 'corte' } as PedidoDeVista, { tipo: 'frontal' } as PedidoDeVista]) {
        const ts = vistaParaPrancha(m, pedido, escala, 'v').primitivas.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto');
        const outros = ts.filter((t) => t.camada !== 'chamadas');
        // borda direita de cada texto (vertical: a altura do corpo; deitado: a largura estimada)
        const direita = Math.max(...outros.map((t) => (t.angulo ? t.p[0] + 0.25 * t.altura : t.ancora === 'start' ? t.p[0] + Prancha.largura(t.t, t.altura) : t.ancora === 'middle' ? t.p[0] + Prancha.largura(t.t, t.altura) / 2 : t.p[0])));
        for (const c of ts.filter((t) => t.camada === 'chamadas')) expect(c.p[0], `${pedido.tipo} 1:${escala}`).toBeGreaterThan(direita);
      }
    }
  });

  it('muro de 20 m: a longitudinal da sapata emendada (uma barra um φ ao lado da outra) não vira "c/1"', () => {
    const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 20, junta_cada: 0 });
    for (const t of chamadasDe(m, { tipo: 'corte' })) expect(t).not.toMatch(/ c\/1 /);
  });
});

describe('lista de ferros no quadro lateral', () => {
  const ctx = (ferros = listaDeFerrosDaFolha(muro('aula122'))): ContextoDaFolha => ({
    numero: 1, total: 1,
    obra: { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 }, ferros,
    desenhar: () => null,
  });
  const textos = (ps: Primitiva[]) => ps.filter((p) => p.k === 'texto').map((p) => (p.k === 'texto' ? p.t : ''));

  it('sai com cabeçalho e uma linha por posição; desligada, some', () => {
    const f = novaFolha('');
    const fs = ctx().ferros!;
    const t = textos(comporFolha(f, ctx()).primitivas);
    expect(t).toEqual(expect.arrayContaining(['LISTA DE FERROS', 'N', 'Ø', 'Quant.', 'C. unit. (cm)', 'C. total (m)', 'Forma']));
    for (const l of fs) expect(t).toContain(l.posicao);
    f.quadro.listaDeFerros = false;
    expect(textos(comporFolha(f, ctx()).primitivas)).not.toContain('LISTA DE FERROS');
  });

  it('arquivo de antes da lista abre com ela ligada', () => {
    const p = lerPranchas({ folhas: [{ formato: 'A1', quadro: { largura: 180, altura: 400, legenda: true, quadroDeAco: true }, itens: [] }] });
    expect(p.folhas[0].quadro.listaDeFerros).toBe(true);
  });
});
