/*
  AS FERRAMENTAS DA FOLHA (pranchas/ferramentas.ts) — o que quebraria:
  - a captura pegar o número de uma cota (cotar a cota) ou não pegar a ponta e o meio de um traço;
  - a captura pegar um ponto longe demais (fora do raio);
  - a cota sair vertical com o terceiro clique acima dos pontos (o DIMLINEAR: acima/abaixo = horizontal);
  - os três cliques em mm de papel guardados errado em mm do muro (a cota mediria outra coisa noutra escala).
*/
import { describe, expect, it } from 'vitest';
import { capturar, cotaDosCliques, direcaoDaCota, paraOMuro, paraOPapel, pontosDeCaptura } from '../ferramentas';
import type { Primitiva } from '../tipos';

const traco = { camada: 'concreto', cor: '#000000', espessura: 0.2 };

describe('captura de ponto', () => {
  it('pontas e meios dos traços; a anotação fica de fora', () => {
    const prims: Primitiva[] = [
      { k: 'linha', a: [0, 0], b: [10, 0], e: traco },
      { k: 'polilinha', pts: [[0, 5], [4, 5], [4, 9]], fechada: false, e: traco },
      { k: 'linha', a: [100, 100], b: [120, 100], e: { ...traco, camada: 'cotas' } },
      { k: 'texto', p: [50, 50], t: 'B = 140', altura: 2.5, ancora: 'start', angulo: 0, cor: '#000', camada: 'cotas' },
    ];
    const ps = pontosDeCaptura(prims);
    for (const p of [[0, 0], [10, 0], [5, 0], [0, 5], [4, 5], [2, 5], [4, 9], [4, 7]]) expect(ps).toContainEqual(p);
    expect(ps).not.toContainEqual([100, 100]);
    expect(ps).not.toContainEqual([110, 100]);
  });

  it('o mais perto dentro do raio; fora dele, nada', () => {
    const ps: [number, number][] = [[0, 0], [10, 0]];
    expect(capturar(ps, [9.2, 0.4], 1.5)).toEqual([10, 0]);
    expect(capturar(ps, [5, 0], 1.5)).toBeNull();
  });
});

describe('a cota dos três cliques', () => {
  it('acima ou abaixo dos pontos: horizontal; ao lado: vertical', () => {
    expect(direcaoDaCota([0, 0], [10, 3], [5, -8])).toBe('h');
    expect(direcaoDaCota([0, 0], [10, 3], [5, 20])).toBe('h');
    expect(direcaoDaCota([0, 0], [3, 10], [-6, 5])).toBe('v');
    // no canto: a maior distância entre os pontos manda
    expect(direcaoDaCota([0, 0], [10, 3], [-5, -8])).toBe('h');
  });

  it('guardada em mm do muro: papel → desenho (÷ k) → muro (÷ S), e a volta', () => {
    const l = { origem: [20, 30] as [number, number], k: 0.25, S: 0.2 };
    const c = cotaDosCliques('c1', [20, 30], [40, 30], [30, 20], l);
    expect(c.direcao).toBe('h');
    expect(c.a).toEqual([0, 0]);
    // 20 mm de papel ÷ 0,25 = 80 px ÷ 0,2 = 400 mm do muro
    expect(c.b[0]).toBeCloseTo(400, 9);
    const volta = paraOPapel(paraOMuro([33, 44], l), l);
    expect(volta[0]).toBeCloseTo(33, 9);
    expect(volta[1]).toBeCloseTo(44, 9);
  });
});
