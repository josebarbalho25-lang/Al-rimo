/*
  ANOTAÇÕES EDITÁVEIS NA FOLHA (Jose, 15/10: "deletar ou criar cotas e mover anotações em geral, escrever de novo o
  que quiser") — o que quebraria:
  - a chave de uma cota mudar de um desenho para o outro do mesmo muro (o ajuste guardado cairia na cota errada);
  - esconder, afastar ou reescrever uma cota e o desenho pular na folha (a caixa de referência mudar);
  - a cota escondida continuar no PDF ou no DXF; a reescrita sair com o texto velho;
  - o muro mudar (B de 140 para 150) e o ajuste da cota velha esconder a nova;
  - a cota criada na folha medir errado (os pontos guardados em mm do muro) ou sumir ao trocar a escala;
  - o arquivo perder as anotações ou abrir lixo.
*/
import { pranchasComVistas } from '../vistas';
import { describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { vistaParaPrancha } from '@/desenhos';
import { naAnotacao, naCotaNova, noTextoNovo } from '../acoes';
import { lerPranchas } from '../padrao';
import type { AnotacaoPosta, CotaNova, ItemDaFolha, PedidoDeVista, Primitiva, TextoNovo } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
const CORTE: PedidoDeVista = { tipo: 'corte' };
const textos = (ps: Primitiva[], camada?: string) =>
  ps.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && (camada === undefined || p.camada === camada)).map((p) => p.t);
const corte = (o: { anotacoes?: Record<string, AnotacaoPosta>; cotas?: CotaNova[]; textos?: TextoNovo[] } = {}, escala = 25) =>
  vistaParaPrancha(m, CORTE, escala, 'v', o);

const base = corte();
const chaveB = base.anotacoes!.find((a) => a.tipo === 'cota' && a.texto.startsWith('B = '))!.chave;

describe('as chaves', () => {
  it('toda cota e o texto solto do corte têm chave, a mesma de um desenho para o outro', () => {
    const cotas = base.anotacoes!.filter((a) => a.tipo === 'cota');
    expect(cotas.length).toBe(textos(base.primitivas, 'cotas').length);
    expect(base.anotacoes!.some((a) => a.tipo === 'texto' && a.chave === 'texto:aterro')).toBe(true);
    expect(chaveB).toMatch(/^cota:B = \d+#0$/);
    expect(corte().anotacoes!.map((a) => a.chave)).toEqual(base.anotacoes!.map((a) => a.chave));
    // duas cotas com o mesmo número viram #0 e #1
    const repetidas = cotas.filter((a) => a.chave.endsWith('#1'));
    for (const r of repetidas) expect(cotas.some((a) => a.chave === r.chave.replace(/#1$/, '#0'))).toBe(true);
  });
});

describe('ajustes nas automáticas', () => {
  it('escondida: some do desenho e do DXF; a caixa que prende o desenho na folha não muda', () => {
    const v = corte({ anotacoes: { [chaveB]: { oculta: true } } });
    expect(textos(v.primitivas, 'cotas')).not.toContain(chaveB.slice(5, -2));
    expect(v.referencia).toEqual(base.referencia);
    expect(v.anotacoes!.find((a) => a.chave === chaveB)!.oculta).toBe(true);
    // as outras ficam onde estavam
    const outras = (x: typeof v) => x.anotacoes!.filter((a) => a.chave !== chaveB).map((a) => [a.chave, a.p]);
    expect(outras(v)).toEqual(outras(base));
  });

  it('afastada: a linha e o número descem juntos; reescrita: sai o texto novo, a chave fica a de origem', () => {
    const v = corte({ anotacoes: { [chaveB]: { afastamento: 30, texto: 'B = 1,40 m' } } });
    const a0 = base.anotacoes!.find((a) => a.chave === chaveB)!;
    const a1 = v.anotacoes!.find((a) => a.chave === chaveB)!;
    expect(a1.linha![0][1]).toBeCloseTo(a0.linha![0][1] + 30, 6);
    expect(a1.p[1]).toBeCloseTo(a0.p[1] + 30, 6);
    expect(a1.texto).toBe('B = 1,40 m');
    expect(a1.original).toBe(a0.texto);
    expect(textos(v.primitivas, 'cotas')).toContain('B = 1,40 m');
    expect(textos(v.primitivas, 'cotas')).not.toContain(a0.texto);
    expect(v.referencia).toEqual(base.referencia);
  });

  it('texto solto movido e girado: sai no lugar novo, com o giro no DXF', () => {
    const v = corte({ anotacoes: { 'texto:aterro': { dx: -40, dy: 25, giro: 90 } } });
    const t0 = base.anotacoes!.find((a) => a.chave === 'texto:aterro')!;
    const p = v.primitivas.find((q): q is Extract<Primitiva, { k: 'texto' }> => q.k === 'texto' && q.t === 'aterro')!;
    expect(p.p[0]).toBeCloseTo(t0.p[0] - 40, 6);
    expect(p.p[1]).toBeCloseTo(t0.p[1] + 25, 6);
    expect(p.angulo).toBe(90);
  });

  it('o muro mudou (B de outro tamanho): a chave não casa e a cota volta ao automático', () => {
    const outro = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
    // a mesma chave num desenho em que o número é outro: simulado com uma chave que não existe
    const v = vistaParaPrancha(outro, CORTE, 25, 'v', { anotacoes: { 'cota:B = 999#0': { oculta: true } } });
    expect(textos(v.primitivas, 'cotas').some((t) => t.startsWith('B = '))).toBe(true);
  });
});

describe('cotas e textos criados na folha', () => {
  // no corte o x do desenho é −y·S: o ponto guardado é o px ÷ S (mm do muro, com o sinal da vista)
  const nova: CotaNova = { id: 'c1', a: [0, 0], b: [-1400, 0], linha: [-700, -300], direcao: 'h' };

  it('a horizontal mede o x em cm e sai na linha do terceiro ponto; fora da caixa que prende o desenho', () => {
    const v = corte({ cotas: [nova] });
    const a = v.anotacoes!.find((q) => q.chave === 'c1')!;
    expect(a.nova).toBe(true);
    expect(a.texto).toBe('140');
    expect(a.linha![0][1]).toBeCloseTo(-300 * v.S!, 6);
    expect(textos(v.primitivas, 'cotas').filter((t) => t === '140').length).toBeGreaterThan(textos(base.primitivas, 'cotas').filter((t) => t === '140').length);
    expect(v.referencia).toEqual(base.referencia);
  });

  it('a mesma cota em 1:50 fica no mesmo lugar do muro e com a mesma medida', () => {
    const v = corte({ cotas: [nova] }, 50);
    const a = v.anotacoes!.find((q) => q.chave === 'c1')!;
    expect(a.texto).toBe('140');
    expect(a.linha![0][1]).toBeCloseTo(-300 * v.S!, 6);
  });

  it('vertical mede o y; reescrita e número deslocado valem nela também', () => {
    const v = corte({ cotas: [{ id: 'c2', a: [0, 0], b: [0, -1600], linha: [200, -800], direcao: 'v', texto: 'h = 160', dx: 5, dy: 0 }] });
    const a = v.anotacoes!.find((q) => q.chave === 'c2')!;
    expect(a.texto).toBe('h = 160');
    expect(a.original).toBe('160');
    expect(a.eixo).toBe('v');
  });

  it('o texto novo sai no ponto guardado, na camada dos textos', () => {
    const v = corte({ textos: [{ id: 't1', p: [-500, -2000], texto: 'VER DETALHE 3' }] });
    expect(textos(v.primitivas, 'textos')).toContain('VER DETALHE 3');
    const a = v.anotacoes!.find((q) => q.chave === 't1')!;
    expect(a.p[0]).toBeCloseTo(-500 * v.S!, 6);
  });

  it('cotas desligadas na vista (Mostrar, a sobreposição dela): a cota criada some junto; o texto criado fica', () => {
    const v = vistaParaPrancha(m, CORTE, 25, 'v', { cotas: [nova], textos: [{ id: 't1', p: [-500, -2000], texto: 'VER DETALHE 3' }], graficos: { ocultos: ['cotas'] } });
    expect(v.anotacoes?.some((q) => q.chave === 'c1') ?? false).toBe(false);
    expect(textos(v.primitivas, 'textos')).toContain('VER DETALHE 3');
  });
});

describe('a armação da sapata na folha', () => {
  it('sai em escala, com as sombras na camada delas e as cotas editáveis', () => {
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    expect(v.primitivas.some((p) => p.k === 'polilinha' && p.e.camada === 'sombras')).toBe(true);
    expect(v.anotacoes!.some((a) => a.tipo === 'cota')).toBe(true);
    expect(v.S).toBeGreaterThan(0);
  });
});

describe('no item e no arquivo', () => {
  const item: ItemDaFolha = { id: 'i', conteudo: CORTE, escala: 25, x: 0, y: 0, titulo: '' };

  it('ajuste que volta ao automático leva o campo junto; cota e texto criados se apagam de verdade', () => {
    const a = naAnotacao(item, 'cota:B = 140#0', () => ({ oculta: true }));
    expect(a.anotacoes).toEqual({ 'cota:B = 140#0': { oculta: true } });
    expect('anotacoes' in naAnotacao(a, 'cota:B = 140#0', () => null)).toBe(false);
    const c = { ...item, cotas: [{ id: 'c1', a: [0, 0], b: [1, 0], linha: [0, 1], direcao: 'h' } as CotaNova] };
    expect('cotas' in naCotaNova(c, 'c1', () => null)).toBe(false);
    const t = { ...item, textos: [{ id: 't1', p: [0, 0], texto: 'x' } as TextoNovo] };
    expect(noTextoNovo(t, 't1', (q) => ({ ...q, texto: 'y' })).textos![0].texto).toBe('y');
  });

  it('o arquivo guarda tudo e larga o que não presta', () => {
    const p = pranchasComVistas(lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [{
          id: 'i', conteudo: { tipo: 'armacao' }, escala: 25, x: 10, y: 10, titulo: '',
          anotacoes: { 'cota:B = 140#0': { afastamento: 12, texto: 'B' }, 'texto:aterro': { dx: 'x' }, ruim: 3 },
          cotas: [{ id: 'c1', a: [0, 0], b: [100, 0], linha: [50, 20], direcao: 'h' }, { id: 'c2', a: [0, 0], direcao: 'x' }],
          textos: [{ id: 't1', p: [1, 2], texto: 'NOTA', giro: 90 }, { id: 't2', p: [1, 2], texto: '  ' }],
        }],
      }],
    }));
    const i = p.folhas[0].itens[0];
    expect(i.conteudo).toEqual({ tipo: 'armacao' });
    expect(i.anotacoes).toEqual({ 'cota:B = 140#0': { afastamento: 12, texto: 'B' } });
    expect(i.cotas).toEqual([{ id: 'c1', a: [0, 0], b: [100, 0], linha: [50, 20], direcao: 'h' }]);
    expect(i.textos).toEqual([{ id: 't1', p: [1, 2], texto: 'NOTA', giro: 90 }]);
  });
});
