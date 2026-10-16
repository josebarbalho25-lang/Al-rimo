/*
  A ETIQUETA DE AÇO (Jose, 16/10: "etiqueta de verdade de aço"; "opção de com linha de chamada e sem linha de
  chamada") — o que quebraria:
  - a etiqueta não dizer o que a chamada da coluna diz (N, quantidade, bitola, espaçamento, comprimento);
  - a âncora fora da barra (a etiqueta tem AFASTAMENTO, não lugar: o ponto guardado só escolhe o ponto da barra);
  - "sem linha" deixar a linha (ou tirar o texto); a etiqueta empurrar o desenho na folha;
  - a barra que saiu do desenho quebrar a vista (a etiqueta fica guardada, sem desenho);
  - o arquivo perder a etiqueta, ou a escolha de sem linha da chamada da coluna.
*/
import { describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { vistaParaPrancha } from '@/desenhos';
import { pontoMaisPerto, textoDaChamada } from '@/desenhos/chamadas';
import { lerPranchas } from '../padrao';
import { naEtiqueta } from '../acoes';
import { pranchasComVistas } from '../vistas';
import type { EtiquetaNova, PedidoDeVista, Primitiva } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
const FRONTAL: PedidoDeVista = { tipo: 'frontal' };
const vista = (o: Parameters<typeof vistaParaPrancha>[4] = {}) => vistaParaPrancha(m, FRONTAL, 50, 'v', o);
const base = vista();
// uma chamada da coluna: a barra dela e o ponto onde a linha toca
const daColuna = base.chamadas!.find((c) => c.chave.endsWith('|muro'))!;
const S = base.S!;

describe('o ponto da barra', () => {
  it('o mais perto num segmento, e o próprio ponto na barra cortada', () => {
    expect(pontoMaisPerto([[[0, 0], [10, 0]]], [4, 3])).toEqual([4, 0]);
    expect(pontoMaisPerto([[[5, 5]]], [0, 0])).toEqual([5, 5]);
    expect(pontoMaisPerto([], [0, 0])).toBeNull();
  });
});

describe('a etiqueta na vista', () => {
  // o ponto clicado: um pouco ao lado do ponto da chamada (a âncora volta para a barra)
  const etiqueta: EtiquetaNova = {
    id: 'e1', barra: daColuna.chave, ponto: [(daColuna.ancora[0] + 3) / S, daColuna.ancora[1] / S], dx: 20, dy: -15,
  };
  const v = vista({ etiquetas: [etiqueta] });
  const info = v.chamadas!.find((c) => c.chave === 'e1')!;

  it('diz o mesmo que a chamada da coluna, com a âncora na barra e o texto pelo afastamento', () => {
    const [posicao, elemento] = daColuna.chave.split('|');
    expect(info.rotulo).toBe(textoDaChamada(m, posicao, elemento as 'muro'));
    expect(info.etiqueta).toBe(true);
    expect(info.texto[0] - info.ancora[0]).toBeCloseTo(20, 6);
    expect(info.texto[1] - info.ancora[1]).toBeCloseTo(-15, 6);
    // a âncora fica na barra (a 3 px do clique, que foi ao lado dela)
    expect(Math.abs(info.ancora[0] - daColuna.ancora[0])).toBeLessThan(3.01);
  });

  it('não empurra o desenho na folha; sem linha, sai só o texto', () => {
    expect(v.referencia).toEqual(base.referencia);
    const linhas = (ps: Primitiva[]) => ps.filter((p) => p.k === 'polilinha' && p.e.camada === 'chamadas').length;
    const sem = vista({ etiquetas: [{ ...etiqueta, semLinha: true }] });
    expect(linhas(v.primitivas) - linhas(sem.primitivas)).toBe(1);
    expect(sem.primitivas.some((p) => p.k === 'texto' && p.t === info.rotulo && p.camada === 'chamadas')).toBe(true);
  });

  it('a barra que não está no desenho: a etiqueta não sai, e a vista não quebra', () => {
    const w = vista({ etiquetas: [{ ...etiqueta, barra: 'N99|muro' }] });
    expect(w.chamadas!.some((c) => c.chave === 'e1')).toBe(false);
  });

  it('a chamada da coluna sem linha: o texto fica, a linha e o ponto saem', () => {
    const w = vista({ chamadas: { [daColuna.chave]: { semLinha: true } } });
    const c = w.chamadas!.find((q) => q.chave === daColuna.chave)!;
    expect(c.semLinha).toBe(true);
    const contar = (ps: Primitiva[], k: Primitiva['k']) => ps.filter((p) => p.k === k && (p.k === 'circulo' ? p.e?.camada : p.k === 'polilinha' ? p.e.camada : '') === 'chamadas').length;
    expect(contar(base.primitivas, 'polilinha') - contar(w.primitivas, 'polilinha')).toBe(1);
    expect(contar(base.primitivas, 'circulo') - contar(w.primitivas, 'circulo')).toBe(1);
  });
});

describe('guardar', () => {
  it('a etiqueta se muda e se apaga; quem fica sem nenhuma fica sem o campo', () => {
    const e: EtiquetaNova = { id: 'e1', barra: 'N1|muro', ponto: [1, 2], dx: 3, dy: 4 };
    const i = { etiquetas: [e] };
    expect(naEtiqueta(i, 'e1', (q) => ({ ...q, giro: 90 })).etiquetas![0].giro).toBe(90);
    expect('etiquetas' in naEtiqueta(i, 'e1', () => null)).toBe(false);
  });

  it('o arquivo guarda a etiqueta e o sem linha da chamada; a etiqueta sem barra cai', () => {
    const p = pranchasComVistas(lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [{
          id: 'i', conteudo: { tipo: 'frontal' }, escala: 50, x: 1, y: 1, titulo: '',
          chamadas: { 'N1|muro': { semLinha: true } },
          etiquetas: [{ id: 'e1', barra: 'N1|muro', ponto: [10, -20], dx: 5, dy: -6, giro: 90, semLinha: true }, { id: 'e2', ponto: [0, 0] }],
        }],
      }],
    }));
    const i = p.folhas[0].itens[0];
    expect(i.chamadas).toEqual({ 'N1|muro': { semLinha: true } });
    expect(i.etiquetas).toEqual([{ id: 'e1', barra: 'N1|muro', ponto: [10, -20], dx: 5, dy: -6, giro: 90, semLinha: true }]);
  });
});
