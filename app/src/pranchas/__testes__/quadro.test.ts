/*
  As notas gerais automáticas dizem só o que a conta e o muro desenhado sustentam (revisão de 14/10): o graute do
  contraforte e das canaletas, o solo da frente garantido, o barbacã no espaçamento que ficou de fato, o dreno que
  existe, e o aço com a categoria de cada bitola.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { maiorAfastamentoDosBarbacas, notasAutomaticas, quadroDeAco } from '../quadro';

const muro = (c: string, extras: Record<string, string | number> = {}) => {
  const r = resultadoDoGabarito(c);
  return { r, m: gerarModelo(r, { ...padroesDoModelo(), L_total: 6, ...extras }) };
};

describe('notas gerais automáticas', () => {
  it('com contrafortes: o graute vai em todos os furos dos contrafortes e nas canaletas', () => {
    const { r, m } = muro('aula123');
    const graute = notasAutomaticas(r, m).find((n) => n.startsWith('Graute'));
    expect(graute).toContain('em todos os furos dos contrafortes');
    expect(graute).toContain('em todas as canaletas');
  });

  it('solo da frente garantido na conta: a prancha diz que ele não pode ser escavado', () => {
    const cen = cenariosDoGabarito().find((c) => resultadoDoGabarito(c).v('pass_on') === 'Sim');
    expect(cen).toBeDefined();
    const { r, m } = muro(cen!);
    expect(notasAutomaticas(r, m).some((n) => n.includes('não pode ser escavado nem removido'))).toBe(true);
    const sem = muro('aula122');
    expect(notasAutomaticas(sem.r, sem.m).some((n) => n.includes('escavado'))).toBe(false);
  });

  it('barbacã: a nota escreve o maior afastamento que ficou no muro, e ele não passa do pedido mais um furo', () => {
    for (const L of [6, 6.6, 9.4]) {
      const { r, m } = muro('aula122', { L_total: L });
      const { maior } = maiorAfastamentoDosBarbacas(m);
      expect(maior).not.toBeNull();
      // o pedido é 1,50 m; o barbacã cai no furo livre mais perto do alvo (a barra ocupa um furo a cada 40)
      expect(maior!).toBeLessThanOrEqual(1500 + 400);
      expect(notasAutomaticas(r, m).find((n) => n.startsWith('Barbacãs'))).toContain(`${(maior! / 1000).toFixed(2).replace('.', ',')} m`);
    }
  });

  it('só o dreno de fundo ligado: a nota não fala em dreno no tardoz', () => {
    const { r, m } = muro('aula122', { dreno_on: 'Não' });
    const notas = notasAutomaticas(r, m);
    expect(notas.some((n) => n.startsWith('Dreno no tardoz'))).toBe(false);
    expect(notas.some((n) => n.startsWith('Dreno de fundo'))).toBe(true);
  });

  it('nada de "caimento" (o barbacã do modelo é reto) nem de curso, aula ou nome próprio', () => {
    for (const c of ['aula122', 'aula123']) {
      const { r, m } = muro(c);
      const tudo = notasAutomaticas(r, m).join(' ');
      expect(tudo).not.toMatch(/caimento|Carini|Gilberto|aula|curso/i);
    }
  });
});

describe('resumo do aço', () => {
  it('categoria por bitola: Ø5,0 é CA-60; o total é a soma das linhas arredondadas', () => {
    for (const c of cenariosDoGabarito().slice(0, 15)) {
      const { r, m } = muro(c);
      const q = quadroDeAco(m, r);
      for (const l of q.linhas) {
        if (l.bitola.startsWith('Ø5 ') || l.bitola.startsWith('Ø5,0')) expect(l.bitola).toContain('CA-60');
      }
      const soma = Math.round(q.linhas.reduce((s, l) => s + l.massa, 0) * 10) / 10;
      expect(q.total).toBeCloseTo(soma, 9);
    }
  });
});
