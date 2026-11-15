/*
  A ENVOLTÓRIA DO AÇO COLOCADO com barras feitas à mão: as rampas, os degraus e o traspasse saem exatamente como a
  regra diz (acoColocado.ts) — sem depender do modelo nem da planilha.
*/
import { describe, expect, it } from 'vitest';
import type { Barra, Vec3 } from '@/modelo/tipos';
import { acoColocado, areaDaBarra, estribosAoLongo, valorEm, type Recorte } from './acoColocado';

let n = 0;
const barra = (eixo: Vec3[], phi = 10, posicao = 'N1', papel: Barra['papel'] = 'VERT_MURO'): Barra =>
  ({ id: `b${++n}`, posicao, papel, diametro: phi, eixo, comprimento: 0, trecho: 1 });

const A10 = areaDaBarra(10);
const rec = (o: Partial<Recorte> = {}): Recorte => ({
  de: [0, 0, 0], u: [0, 0, 1], L: 2000, papeis: ['VERT_MURO', 'ESPERA'], largura: null, dentro: () => true,
  ancoragem: () => ({ reta: 400, dobrada: 280, traspasse: 600 }),
  ...o,
});
const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('acoColocado — barras à mão', () => {
  it('barra reta solta nas duas pontas: sobe ℓb,nec, fica cheia, desce ℓb,nec', () => {
    const { pontos } = acoColocado([barra([[0, 0, 300], [0, 0, 1700]])], rec());
    expect(valorEm(pontos, 300)).toBe(0);
    expect(perto(valorEm(pontos, 500), A10 / 2)).toBe(true);
    expect(perto(valorEm(pontos, 700), A10)).toBe(true);
    expect(perto(valorEm(pontos, 1300), A10)).toBe(true);
    expect(valorEm(pontos, 1700)).toBe(0);
    // as quinas exatas: 300, 700, 1300, 1700
    expect(pontos.map((p) => p.s)).toEqual(expect.arrayContaining([300, 700, 1300, 1700]));
  });

  it('ponta que passa do começo da peça (a espera na sapata) chega cheia; ponta dobrada usa o α = 0,7', () => {
    // desce abaixo de 0 e dobra lá (o pé): na peça ela já está cheia em s = 0
    const espera = barra([[0, 0, 900], [0, 0, -200], [0, 100, -300]]);
    const { pontos } = acoColocado([espera], rec({ ancoragem: () => ({ reta: 400, dobrada: 280, traspasse: null }) }));
    expect(perto(valorEm(pontos, 0), A10)).toBe(true);
    expect(perto(valorEm(pontos, 500), A10)).toBe(true);
    expect(perto(valorEm(pontos, 700), A10 / 2)).toBe(true);
    // a outra ponta, dobrada dentro da peça: rampa de 280
    const gancho = barra([[0, 0, -100], [0, 0, 1000], [0, 100, 1100]]);
    const g = acoColocado([gancho], rec()).pontos;
    expect(perto(valorEm(g, 1000 - 140), A10 / 2)).toBe(true);
    expect(perto(valorEm(g, 720), A10)).toBe(true);
  });

  it('traspasse: espera + barra do muro lado a lado — as duas juntas não passam da maior', () => {
    const espera = barra([[0, 0, -300], [0, 0, 600]], 10, 'N1', 'ESPERA');
    const muro = barra([[20, 0, 0], [20, 0, 1970]], 10, 'N2');
    const { pontos, familias } = acoColocado([espera, muro], rec());
    // rampas de 600 (o ℓ0t) nas duas: no traspasse a soma é constante
    for (const s of [0, 150, 300, 450, 600, 900]) expect(perto(valorEm(pontos, s), A10)).toBe(true);
    // a de cima solta no topo: ℓb,nec
    expect(perto(valorEm(pontos, 1970 - 200), A10 / 2)).toBe(true);
    // um contorno por posição
    expect(familias.map((f) => f.posicao)).toEqual(['N1', 'N2']);
    expect(familias[0]).toMatchObject({ s0: 0, s1: 600 });
    expect(perto(familias[0]!.v, A10)).toBe(true);
  });

  it('traspasse mais curto que o ℓ0t da planilha: a envoltória desce (a emenda não ancora)', () => {
    const espera = barra([[0, 0, -300], [0, 0, 300]], 10, 'N1', 'ESPERA');
    const muro = barra([[20, 0, 0], [20, 0, 1970]], 10, 'N2');
    const { pontos } = acoColocado([espera, muro], rec());
    expect(valorEm(pontos, 150)).toBeLessThan(A10 - 1e-6);
  });

  it('traspasse com ℓ0t menor que a sobreposição: a soma para na maior área (não soma aço)', () => {
    const espera = barra([[0, 0, -300], [0, 0, 1000]], 10, 'N1', 'ESPERA');
    const muro = barra([[20, 0, 0], [20, 0, 1970]], 10, 'N2');
    const { pontos } = acoColocado([espera, muro], rec());
    expect(Math.max(...pontos.map((p) => p.v))).toBeLessThanOrEqual(A10 + 1e-9);
    expect(perto(valorEm(pontos, 700), A10)).toBe(true);
  });

  it('por metro: a soma no recorte dividida pela largura', () => {
    const bs = [0, 400, 800].map((x) => barra([[x, 0, -100], [x, 0, 2100]]));
    const { pontos } = acoColocado(bs, rec({ largura: 1200 }));
    expect(perto(valorEm(pontos, 1000), (3 * A10 * 1000) / 1200)).toBe(true);
  });

  it('fora do recorte, outro papel ou atravessada: não conta', () => {
    const bs = [barra([[0, 0, -100], [0, 0, 2100]]), barra([[0, 0, 500], [500, 0, 500]]), barra([[0, 0, -100], [0, 0, 2100]], 10, 'N9', 'HORIZ')];
    const so = acoColocado(bs, rec({ dentro: (p) => p[0] < 100 }));
    expect(so.trechos.length).toBe(1);
    expect(acoColocado(bs, rec({ dentro: () => false })).pontos.every((p) => p.v === 0)).toBe(true);
  });

  it('estribos: ramos·área/distância entre dois seguidos, degrau exato, zero fora', () => {
    const ps = estribosAoLongo([0, 200, 400, 800], areaDaBarra(5), 2, 1000);
    expect(valorEm(ps, 100)).toBeCloseTo((2 * areaDaBarra(5) * 1000) / 200, 12);
    expect(valorEm(ps, 600)).toBeCloseTo((2 * areaDaBarra(5) * 1000) / 400, 12);
    expect(ps[0]!.v).toBe(0);
    expect(ps[ps.length - 1]!.v).toBe(0);
    expect(estribosAoLongo([100], 1, 2, 1000)).toEqual([]);
  });

  it('estribos de 4 ramos: os dois estribos da mesma junta somam os ramos', () => {
    // a junta a cada 400 com o par (os dois começam na mesma cota; um deles 1,85 mm acima, o degrau da volta)
    const ps = estribosAoLongo([5, 5, 405, 406.85, 805, 805], areaDaBarra(6.3), 2, 1000);
    expect(valorEm(ps, 200)).toBeCloseTo((4 * areaDaBarra(6.3) * 1000) / 400, 12);
    expect(valorEm(ps, 600)).toBeCloseTo((4 * areaDaBarra(6.3) * 1000) / 400, 12);
    // junta com um estribo só ao lado de uma com o par: vale a de menos
    const meio = estribosAoLongo([5, 5, 405], areaDaBarra(5), 2, 1000);
    expect(valorEm(meio, 200)).toBeCloseTo((2 * areaDaBarra(5) * 1000) / 400, 12);
  });
});
