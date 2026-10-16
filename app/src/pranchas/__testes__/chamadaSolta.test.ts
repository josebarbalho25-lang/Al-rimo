/*
  CHAMADA SOLTA NA FOLHA (Jose, 15/10: "deixar livre pra eu colocar quando quiser do jeito que quiser? Girar ele,
  por na vertical, pra um lado, por outro") — o que quebraria:
  - a chamada arrastada não sair onde ficou, ou não andar junto com a barra;
  - girada no PDF e deitada no DXF (ou ao contrário);
  - a linha de chamada chegando na ponta errada do texto (texto à esquerda da barra, linha entrando pela esquerda);
  - tirar uma chamada da coluna, ou escondê-la, e o desenho pular na folha ou o título descer;
  - a escondida continuar no PDF ou no DXF;
  - o arquivo perdendo o lugar das chamadas, ou abrindo lixo.
*/
import { describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { vistaParaPrancha } from '@/desenhos';
import { cantosDoTexto, girarNoMeio, linhaDaChamada, normalizarGiro } from '@/desenhos/chamadas';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { naChamada } from '../acoes';
import { lerPranchas, novaFolha } from '../padrao';
import { pranchasComVistas } from '../vistas';
import type { ChamadaPosta, ItemDaFolha, PedidoDeVista, Primitiva, Pt } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
const CORTE: PedidoDeVista = { tipo: 'corte' };

const textosDasChamadas = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.camada === 'chamadas');
const linhasDasChamadas = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'polilinha' }> => p.k === 'polilinha' && p.e.camada === 'chamadas');
const perto = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;

const base = vistaParaPrancha(m, CORTE, 25, 'v');
const c0 = base.chamadas![0];
const comPostas = (postas: Record<string, ChamadaPosta>, escala = 25) => vistaParaPrancha(m, CORTE, escala, 'v', { chamadas: postas });

describe('no desenho', () => {
  it('a vista da prancha conta as chamadas que desenhou; sem nada guardado, todas na coluna e a referência é a caixa', () => {
    expect(base.chamadas!.length).toBe(textosDasChamadas(base.primitivas).length);
    expect(base.chamadas!.every((c) => !c.posta && !c.oculta && c.giro === 0)).toBe(true);
    expect(base.referencia).toEqual(base.caixa);
  });

  it('posta à esquerda da barra: o texto sai onde ficou, e a linha chega pela ponta direita do texto', () => {
    const dx = -(c0.largura + 60);
    const v = comPostas({ [c0.chave]: { dx, dy: 40 } });
    const c = v.chamadas!.find((x) => x.chave === c0.chave)!;
    expect(c.posta).toBe(true);
    expect(perto(c.texto, [c0.ancora[0] + dx, c0.ancora[1] + 40])).toBe(true);
    const t = textosDasChamadas(v.primitivas).find((p) => p.t === c0.rotulo)!;
    expect(perto(t.p, c.texto)).toBe(true);
    const linha = linhasDasChamadas(v.primitivas).find((p) => perto(p.pts[0], c0.ancora))!;
    const fim = linha.pts[linha.pts.length - 1];
    expect(fim[0]).toBeGreaterThan(c.texto[0] + c.largura);
    // o ombro: o último pedaço vai na direção do texto (deitado)
    expect(Math.abs(linha.pts[linha.pts.length - 2][1] - fim[1])).toBeLessThan(1e-6);
  });

  it('girada a 90°: vertical no PDF (rotate) e no DXF (ângulo 90), e a linha encosta na ponta de cima', () => {
    const v = comPostas({ [c0.chave]: { dx: 30, dy: c0.largura + 60, giro: 90 } });
    const c = v.chamadas!.find((x) => x.chave === c0.chave)!;
    const t = textosDasChamadas(v.primitivas).find((p) => p.t === c0.rotulo)!;
    expect(t.angulo).toBe(90);
    expect(v.corpo).toContain(`rotate(-90 `);
    const linha = linhasDasChamadas(v.primitivas).find((p) => perto(p.pts[0], c0.ancora))!;
    const fim = linha.pts[linha.pts.length - 1];
    // o texto sobe do ponto de inserção: a ponta de cima é a mais perto da barra
    expect(fim[1]).toBeLessThan(c.texto[1] - c.largura);
  });

  it('tirar da coluna ou esconder não mexe na referência (o lugar do desenho na folha); a escondida não sai', () => {
    const outra = base.chamadas![base.chamadas!.length - 1];
    const v = comPostas({ [c0.chave]: { dx: -400, dy: 300, giro: 45 }, [outra.chave]: { oculta: true } });
    expect(v.referencia).toEqual(base.caixa);
    // a caixa de verdade cresce para a esquerda (a chamada foi para lá)
    expect(v.caixa[0]).toBeLessThan(base.caixa[0]);
    expect(textosDasChamadas(v.primitivas).map((p) => p.t)).not.toContain(outra.rotulo);
    expect(v.chamadas!.find((x) => x.chave === outra.chave)!.oculta).toBe(true);
    // quem ficou na coluna não andou
    for (const c of v.chamadas!.filter((x) => !x.posta && !x.oculta)) {
      expect(perto(c.texto, base.chamadas!.find((x) => x.chave === c.chave)!.texto)).toBe(true);
    }
  });

  it('a mesma distância no papel em qualquer escala: o texto conta do ponto da barra, em px', () => {
    for (const escala of [20, 50]) {
      const v = comPostas({ [c0.chave]: { dx: -100, dy: 20 } }, escala);
      const c = v.chamadas!.find((x) => x.chave === c0.chave)!;
      expect(perto([c.texto[0] - c.ancora[0], c.texto[1] - c.ancora[1]], [-100, 20])).toBe(true);
    }
  });
});

describe('as contas da chamada', () => {
  it('girar no meio: o meio do texto não sai do lugar', () => {
    const meio = (p: Pt[]): Pt => [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2];
    for (const [g0, g1] of [[0, 90], [90, -90], [0, 37], [-90, 180]]) {
      const t0: Pt = [100, 50];
      const t1 = girarNoMeio(t0, g0, g1, 120, 11);
      // o retângulo de cálculo do meio é o da meia altura da letra (0,35 do corpo), não o da caixa inteira
      const a = cantosDoTexto(t0, g0, 120, 11);
      const b = cantosDoTexto(t1, g1, 120, 11);
      const [ma, mb] = [meio(a), meio(b)];
      // a caixa sobe 0,85 e desce 0,25: o meio dela fica 0,3 acima da base, perto da meia altura (0,35)
      expect(Math.hypot(ma[0] - mb[0], ma[1] - mb[1]), `${g0}→${g1}`).toBeLessThan(0.05 * 11 * 2 + 1e-9);
    }
  });

  it('giro em (−180°, 180°]', () => {
    expect(normalizarGiro(270)).toBe(-90);
    expect(normalizarGiro(-90)).toBe(-90);
    expect(normalizarGiro(180)).toBe(180);
    expect(normalizarGiro(450)).toBe(90);
    expect(normalizarGiro(Number.NaN)).toBe(0);
  });

  it('a linha de chamada encosta na ponta mais perto da barra', () => {
    const direita = linhaDaChamada([0, 0], [20, 0], 0, 100, 10);
    expect(direita[2][0]).toBeLessThan(20);
    const esquerda = linhaDaChamada([0, 0], [-130, 0], 0, 100, 10);
    expect(esquerda[2][0]).toBeGreaterThan(-30);
  });
});

describe('na folha', () => {
  const ctx = (): ContextoDaFolha => ({
    numero: 1, total: 1,
    obra: { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 },
    desenhar: (item, prefixo) => ({ tipo: 'vetor', vista: vistaParaPrancha(m, item.conteudo as PedidoDeVista, item.escala ?? 25, prefixo, { chamadas: item.chamadas }) }),
  });
  const folhaCom = (item: Partial<ItemDaFolha>) => {
    const f = novaFolha('');
    f.itens = [{ id: 'c', conteudo: CORTE, escala: 25, x: 60, y: 60, titulo: '', ...item }];
    return f;
  };
  const transformacao = (svg: string) => svg.match(/<g transform="matrix\([^"]*\)">/)![0];

  it('o desenho não pula nem o título desce quando a chamada sai da coluna', () => {
    const antes = comporFolha(folhaCom({}), ctx());
    const depois = comporFolha(folhaCom({ chamadas: { [c0.chave]: { dx: -300, dy: 400 } } }), ctx());
    expect(transformacao(depois.svg)).toBe(transformacao(antes.svg));
    expect(depois.itens[0].caixa).toEqual(antes.itens[0].caixa);
    expect(depois.itens[0].titulo).toEqual(antes.itens[0].titulo);
  });

  it('a tela recebe a chamada em mm, com o k para voltar o arrasto ao desenho', () => {
    const f = comporFolha(folhaCom({ chamadas: { [c0.chave]: { dx: -300, dy: 400 } } }), ctx());
    const c = f.itens[0].chamadas!.find((x) => x.chave === c0.chave)!;
    expect(c.posta).toBe(true);
    expect([c.dx, c.dy]).toEqual([-300, 400]);
    expect(c.texto[0] - c.ancora[0]).toBeCloseTo(-300 * c.k, 6);
    expect(c.texto[1] - c.ancora[1]).toBeCloseTo(400 * c.k, 6);
  });

  it('chamada posta fora da moldura acende o aviso do desenho', () => {
    expect(comporFolha(folhaCom({}), ctx()).itens[0].invade).toBe(false);
    expect(comporFolha(folhaCom({ chamadas: { [c0.chave]: { dx: -600, dy: 0 } } }), ctx()).itens[0].invade).toBe(true);
  });
});

describe('no arquivo', () => {
  it('guarda o lugar, o giro e a escondida; o que não é número cai', () => {
    const p = pranchasComVistas(lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [{
          id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 10, y: 10, titulo: '',
          chamadas: {
            'N1|muro': { dx: -10.5, dy: 4, giro: 90 },
            'N2|muro': { oculta: true },
            'N3|muro': { dx: 'x', dy: 1 },
            'N4|muro': { giro: 90 },
            'N5|sapata': 7,
          },
        }],
      }],
    }));
    expect(p.folhas[0].itens[0].chamadas).toEqual({ 'N1|muro': { dx: -10.5, dy: 4, giro: 90 }, 'N2|muro': { oculta: true } });
  });

  it('item sem chamada guardada fica sem o campo', () => {
    const p = pranchasComVistas(lerPranchas({ folhas: [{ formato: 'A1', itens: [{ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 10, y: 10, titulo: '', chamadas: {} }] }] }));
    expect('chamadas' in p.folhas[0].itens[0]).toBe(false);
  });

  it('voltar à coluna apaga o guardado; a última que volta leva o campo junto', () => {
    const item: ItemDaFolha = { id: 'c', conteudo: CORTE, escala: 25, x: 0, y: 0, titulo: '', chamadas: { a: { dx: 1, dy: 2 } } };
    const solto = naChamada(item, 'b', () => ({ oculta: true }));
    expect(solto.chamadas).toEqual({ a: { dx: 1, dy: 2 }, b: { oculta: true } });
    const volta = naChamada(naChamada(solto, 'a', () => null), 'b', () => null);
    expect('chamadas' in volta).toBe(false);
  });
});
