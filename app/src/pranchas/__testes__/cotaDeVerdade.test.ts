/*
  A COTA DE VERDADE (Jose, 16/10: "cota de verdade… não limitar a cota a mover pra trás e pra frente") — o que
  quebraria:
  - a cadeia ponto a ponto sair com direções diferentes, linhas diferentes, ou com a cota de comprimento zero;
  - a cota não dizer onde ficam os pontos medidos (sem eles não há alça para levar a ponta a outro ponto);
  - prefixo e sufixo trocarem o valor medido (eles vão EM VOLTA dele);
  - o arquivo perder prefixo, sufixo ou a cadeia.
*/
import { describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { vistaParaPrancha } from '@/desenhos';
import { cotasDaCadeia, direcaoDaCadeia } from '../ferramentas';
import { lerPranchas } from '../padrao';
import { pranchasComVistas } from '../vistas';
import type { CotaNova, PedidoDeVista, Pt } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
const CORTE: PedidoDeVista = { tipo: 'corte' };
const lugar = { origem: [0, 0] as Pt, k: 1, S: 1 };

describe('a cadeia ponto a ponto', () => {
  let n = 0;
  const ids = () => `c${++n}`;

  it('três pontos numa horizontal e a linha acima: duas cotas, mesma direção, mesma linha, mesma cadeia', () => {
    const cs = cotasDaCadeia(ids, [[0, 100], [40, 100], [100, 100]], [50, 60], lugar, 'k1');
    expect(cs.map((c) => [c.a, c.b, c.direcao, c.linha[1], c.cadeia])).toEqual([
      [[0, 100], [40, 100], 'h', 60, 'k1'],
      [[40, 100], [100, 100], 'h', 60, 'k1'],
    ]);
  });

  it('a linha ao lado dos pontos dá cadeia vertical; o par que não mede nada nela não vira cota', () => {
    expect(direcaoDaCadeia([[0, 0], [0, 50], [0, 120]], [-30, 60])).toBe('v');
    const cs = cotasDaCadeia(ids, [[0, 0], [10, 0], [10, 50]], [-30, 25], lugar, 'k2');
    expect(cs).toHaveLength(1);
    expect(cs[0].direcao).toBe('v');
    // uma cota só não leva o nome da cadeia (não há com quem andar junto)
    expect(cs[0].cadeia).toBeUndefined();
  });
});

describe('a cota no desenho', () => {
  const corte = (o: Parameters<typeof vistaParaPrancha>[4] = {}) => vistaParaPrancha(m, CORTE, 25, 'v', o);
  const base = corte();

  it('toda cota diz os dois pontos medidos (as alças das pontas), nas pontas da linha', () => {
    const cotas = base.anotacoes!.filter((a) => a.tipo === 'cota');
    expect(cotas.length).toBeGreaterThan(3);
    for (const c of cotas) {
      expect(c.pontas).toHaveLength(2);
      const [p, q] = c.pontas!;
      const [l1, l2] = c.linha!;
      // a linha de chamada sai do ponto medido e vai até a linha: mesmo x (horizontal) ou mesmo y (vertical)
      if (c.eixo === 'h') expect([p[0], q[0]]).toEqual([l1[0], l2[0]]);
      else expect([p[1], q[1]]).toEqual([l1[1], l2[1]]);
    }
  });

  it('prefixo e sufixo vão em volta do valor medido, na automática e na criada', () => {
    const chaveB = base.anotacoes!.find((a) => a.tipo === 'cota' && a.texto.startsWith('B = '))!.chave;
    const v = corte({ anotacoes: { [chaveB]: { prefixo: '(', sufixo: ' cm)' } } });
    expect(v.anotacoes!.find((a) => a.chave === chaveB)!.texto).toMatch(/^\(B = \d+ cm\)$/);
    const nova: CotaNova = { id: 'n1', a: [0, 0], b: [-1400, 0], linha: [-700, -300], direcao: 'h', prefixo: 'L = ', sufixo: ' cm' };
    const w = corte({ cotas: [nova] });
    expect(w.anotacoes!.find((a) => a.chave === 'n1')!.texto).toBe('L = 140 cm');
  });

  it('a criada em cadeia diz a cadeia (a tela move a linha de todas juntas)', () => {
    const cs: CotaNova[] = [
      { id: 'a1', a: [0, 0], b: [-500, 0], linha: [0, -300], direcao: 'h', cadeia: 'k' },
      { id: 'a2', a: [-500, 0], b: [-1400, 0], linha: [0, -300], direcao: 'h', cadeia: 'k' },
    ];
    const v = corte({ cotas: cs });
    expect(v.anotacoes!.filter((a) => a.cadeia === 'k').map((a) => a.chave)).toEqual(['a1', 'a2']);
  });
});

describe('o arquivo', () => {
  it('guarda prefixo, sufixo e a cadeia (na vista)', () => {
    const p = pranchasComVistas(lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [{
          id: 'i', conteudo: { tipo: 'corte' }, escala: 25, x: 1, y: 1, titulo: '',
          anotacoes: { 'cota:B = 140#0': { prefixo: '(', sufixo: ')' } },
          cotas: [{ id: 'c1', a: [0, 0], b: [100, 0], linha: [50, 20], direcao: 'h', prefixo: 'L=', sufixo: ' cm', cadeia: 'k9' }],
        }],
      }],
    }));
    const i = p.folhas[0].itens[0];
    expect(i.anotacoes).toEqual({ 'cota:B = 140#0': { prefixo: '(', sufixo: ')' } });
    expect(i.cotas![0]).toMatchObject({ prefixo: 'L=', sufixo: ' cm', cadeia: 'k9' });
  });
});
