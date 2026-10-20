/*
  A REVISÃO DE 15/10 À NOITE, CORRIGIDA EM 16/10 (três revisores adversariais sobre os gráficos por vista, as
  anotações editáveis, a chamada solta e a armação) — o que cada um tinha achado, para não voltar:
  - arrastar uma cota para a direita empurrava a coluna das chamadas (e, na armação, a seção) e engordava a caixa;
  - cota criada em cima da seção da armação saía de cima dela quando o muro crescia ou a escala mudava;
  - duas sombras com o mesmo texto: se a primeira mudasse, a segunda herdava o ajuste dela;
  - material a 100 % de transparência sumia do PDF mas continuava no DXF (e na captura da ferramenta Cota);
  - "aplicar às outras vistas" zerava o que a janela da vista nem mostra; "restaurar" do 3D esquecia as bitolas;
  - a legenda do quadro saía com as cores do 3D; cota arrastada para fora da moldura não acendia a borda;
  - isométrico e 3D publicavam texto editável que não aplicavam; arquivo com desenho desconhecido perdia calado;
  - no 3D, a peça a 100 % pegava clique (a barra), mantinha o traço e a linha "Alvenaria" não fazia nada.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { vistaParaPrancha } from '@/desenhos';
import { GRAFICOS_DE_FABRICA, naVista, usarGraficos } from '@/desenhos/graficos';
import { desenharVista3d } from '@/desenhos';
import { construirCena3D } from '@/visor/cena3d';
import { muroDeExemplo } from '@/visor/exemploDeModelo';
import { lerPaleta } from '@/visor/tema3d';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { pontosDeCaptura } from '../ferramentas';
import { lerPranchas, novaFolha } from '../padrao';
import { pranchasComVistas } from '../vistas';
import type { Camera3d, CotaNova, ItemDaFolha, PedidoDeVista, Primitiva } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
afterEach(() => usarGraficos(GRAFICOS_DE_FABRICA));

const textosDasChamadas = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.camada === 'chamadas');

describe('a caixa de referência manda no lugar dos outros', () => {
  it('cota arrastada para a direita: a coluna das chamadas não anda e a referência não engorda', () => {
    const base = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v');
    const chave = base.anotacoes!.find((a) => a.tipo === 'cota' && a.texto.startsWith('B = '))!.chave;
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v', { anotacoes: { [chave]: { dx: 400, dy: 0 } } });
    expect(v.referencia).toEqual(base.referencia);
    const x = (ps: Primitiva[]) => textosDasChamadas(ps).map((t) => Math.round(t.p[0] * 10));
    expect(x(v.primitivas)).toEqual(x(base.primitivas));
  });

  it('armação: legenda arrastada não empurra a seção', () => {
    const base = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    const faixa = base.anotacoes!.find((a) => a.tipo === 'texto' && a.texto.includes(' c/'))!;
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a', { anotacoes: { [faixa.chave]: { dx: 2000, dy: 0 } } });
    const secao = (x: typeof v) => x.regioes!.find((r) => r.nome === 'secao')!.origem;
    expect(secao(v)).toEqual(secao(base));
  });
});

describe('a cota criada na seção da armação fica na seção', () => {
  // a cota do B, tomada na seção: em mm do muro contados da origem da seção (o y da sapata, invertido como o desenho)
  const daSecao = (mm: typeof m, escala: number) => {
    const v = vistaParaPrancha(mm, { tipo: 'armacao' }, escala, 'a');
    return v.regioes!.find((r) => r.nome === 'secao')!;
  };
  it('muro mais comprido e outra escala: a linha da cota acompanha a origem da seção', () => {
    const cota: CotaNova = { id: 'c1', a: [0, 0], b: [1400, 0], linha: [700, 200], direcao: 'h', regiao: 'secao' };
    for (const [mm, escala] of [[m, 25], [gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 9 }), 25], [m, 50]] as const) {
      const v = vistaParaPrancha(mm, { tipo: 'armacao' }, escala, 'a', { cotas: [cota] });
      const a = v.anotacoes!.find((q) => q.chave === 'c1')!;
      const o = daSecao(mm, escala).origem;
      // o começo da linha da cota é a origem da seção + o ponto guardado × S (e não a origem do desenho)
      expect(a.linha![0][0]).toBeCloseTo(o[0] + 0 * v.S!, 6);
      expect(a.linha![0][1]).toBeCloseTo(o[1] + 200 * v.S!, 6);
      expect(a.texto).toBe('140');
    }
  });
});

describe('textos repetidos não herdam ajuste', () => {
  it('as legendas das sombras de baixo e de cima têm chave própria (face), não "#0/#1"', () => {
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    const sombras = v.anotacoes!.filter((a) => a.chave.startsWith('texto:sombra:'));
    expect(sombras.some((a) => a.chave.includes(':inferior:'))).toBe(true);
    expect(sombras.some((a) => a.chave.includes(':superior:'))).toBe(true);
    expect(new Set(sombras.map((a) => a.chave)).size).toBe(sombras.length);
  });

  it('a repetida (as duas "9,5" da frontal) sai marcada; ajuste com o lugar guardado longe de onde ela nasceu não vale', () => {
    const frontal = (anotacoes?: Record<string, { oculta: true; ref: [number, number] }>) => vistaParaPrancha(m, { tipo: 'frontal' }, 25, 'v', { anotacoes });
    const v = frontal();
    const reps = v.anotacoes!.filter((a) => a.repetida);
    expect(reps.map((a) => a.chave)).toEqual(expect.arrayContaining(['cota:9,5#0', 'cota:9,5#1']));
    const rep = reps.find((a) => a.chave === 'cota:9,5#1')!;
    // o lugar guardado é em mm do muro (px ÷ S)
    const mm = (q: [number, number]): [number, number] => [q[0] / v.S!, q[1] / v.S!];
    // o ajuste feito na #0 (com o lugar dela) e aplicado na chave #1 — o caso da herança — não vale
    const da0 = v.anotacoes!.find((a) => a.chave === 'cota:9,5#0')!;
    expect(frontal({ [rep.chave]: { oculta: true, ref: mm(da0.p0) } }).anotacoes!.find((a) => a.chave === rep.chave)!.oculta).toBe(false);
    expect(frontal({ [rep.chave]: { oculta: true, ref: mm(rep.p0) } }).anotacoes!.find((a) => a.chave === rep.chave)!.oculta).toBe(true);
    // e continua valendo em outra escala (o lugar em mm do muro não muda com o S)
    const em50 = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'v', { anotacoes: { [rep.chave]: { oculta: true, ref: mm(rep.p0) } } });
    expect(em50.anotacoes!.find((a) => a.chave === rep.chave)!.oculta).toBe(true);
    // a sombra da armação, de chave própria, não é marcada
    expect(vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a').anotacoes!.some((a) => a.repetida && a.chave.startsWith('texto:sombra:'))).toBe(false);
  });
});

describe('transparência total sai do DXF e da captura', () => {
  it('terra a 100 % no corte: sem hachura nem linha do terreno nas primitivas; o desenho não muda de lugar', () => {
    const base = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v');
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v', { graficos: { materiais: { terra: { transparencia: 100 } } } });
    expect(v.primitivas.some((q) => q.k === 'hachura' && q.camada === 'terreno')).toBe(false);
    expect(v.primitivas.some((q) => q.k === 'linha' && q.e.camada === 'terreno')).toBe(false);
    expect(v.referencia).toEqual(base.referencia);
    // a captura lê as primitivas: os cantos da terra sumiram de lá também
    expect(pontosDeCaptura(v.primitivas).length).toBeLessThan(pontosDeCaptura(base.primitivas).length);
  });
});


describe('a folha', () => {
  const ctx = (pedidos: Record<string, boolean>): ContextoDaFolha => ({
    numero: 1, total: 1,
    obra: { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 },
    desenhar: (item, prefixo, o) => {
      pedidos[item.id] = o.legendaDeCores;
      return { tipo: 'vetor', vista: vistaParaPrancha(m, item.conteudo as PedidoDeVista, item.escala ?? 50, prefixo, { anotacoes: item.anotacoes, cotas: item.cotas, textos: item.textos }) };
    },
  });
  const folha = (itens: ItemDaFolha[]) => {
    const f = novaFolha('');
    f.itens = itens;
    return f;
  };

  it('com o quadro mostrando a legenda: a planta com cores próprias leva a legenda dela; a frontal não', () => {
    const pedidos: Record<string, boolean> = {};
    comporFolha(
      folha([
        { id: 'f', conteudo: { tipo: 'frontal' }, escala: 50, x: 30, y: 30, titulo: '' },
        { id: 'p', conteudo: { tipo: 'planta', fiada: 0 }, escala: 50, x: 30, y: 200, titulo: '', graficos: { materiais: { inteiro: { cor: '#00ff00' } } } },
      ]),
      ctx(pedidos),
    );
    expect(pedidos.f).toBe(false);
    expect(pedidos.p).toBe(true);
  });

  it('texto criado fora da moldura acende a borda do desenho', () => {
    const pedidos: Record<string, boolean> = {};
    const dentro = comporFolha(folha([{ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 60, y: 60, titulo: '' }]), ctx(pedidos));
    expect(dentro.itens[0].invade).toBe(false);
    const fora = comporFolha(
      folha([{ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 60, y: 60, titulo: '', textos: [{ id: 't', p: [-40000, 0], texto: 'LONGE' }] }]),
      ctx(pedidos),
    );
    expect(fora.itens[0].invade).toBe(true);
  });

  it('cota puxada para baixo do desenho: o título desce para baixo dela, e o desenho não pula', () => {
    const pedidos: Record<string, boolean> = {};
    const item = { id: 'c', conteudo: { tipo: 'corte' } as PedidoDeVista, escala: 25, x: 60, y: 60, titulo: '' };
    const antes = comporFolha(folha([item]), ctx(pedidos)).itens[0];
    const chave = vistaParaPrancha(m, item.conteudo, 25, 'v').anotacoes!.find((a) => a.tipo === 'cota' && a.texto.startsWith('B = '))!.chave;
    const depois = comporFolha(folha([{ ...item, anotacoes: { [chave]: { afastamento: 400 } } }]), ctx(pedidos)).itens[0];
    expect(depois.caixa).toEqual(antes.caixa);
    expect(depois.titulo![1]).toBeGreaterThan(antes.titulo![1] + 5);
    const cota = depois.anotacoes!.find((a) => a.chave === chave)!;
    expect(depois.titulo![1]).toBeGreaterThanOrEqual(cota.p[1]);
  });
});

describe('vistas sem escala e arquivo', () => {
  it('isométrico não publica anotação editável (não aplicaria o ajuste)', () => {
    expect(vistaParaPrancha(m, { tipo: 'iso' }, 50, 'i').anotacoes).toBeUndefined();
  });

  it('desenho de folha de tipo desconhecido entra no recado de abertura', () => {
    const perdidos: string[] = [];
    const p = lerPranchas({ folhas: [{ formato: 'A1', itens: [{ conteudo: { tipo: 'futuro' }, x: 1, y: 1 }, { conteudo: { tipo: 'corte' }, escala: 25, x: 1, y: 1 }] }] }, perdidos);
    expect(p.folhas[0].itens.length).toBe(1);
    expect(perdidos).toEqual(['prancha: futuro']);
  });
});

describe('o 3D a 100 %', () => {
  it('a linha "Alvenaria" vale para todo bloco; bloco apagado não pega clique e perde o traço', () => {
    const muro = muroDeExemplo({ blocosPorFiada: 6, fiadas: 4, contraforte: false, terreno: true });
    const c = construirCena3D(muro, lerPaleta());
    const blocos = c.lotes.filter((l) => l.lote.acabamento === 'alvenaria');
    const op = (l: (typeof blocos)[number]) => (l.malha.material as import('three').Material).opacity;
    usarGraficos({ ...GRAFICOS_DE_FABRICA, visor: { materiais: { alvenaria: { transparencia: 50 } } } });
    c.aplicarPaleta(lerPaleta());
    for (const l of blocos) expect(op(l)).toBeCloseTo(0.5, 6);
    usarGraficos({ ...GRAFICOS_DE_FABRICA, visor: { materiais: { alvenaria: { transparencia: 100 } } } });
    c.aplicarPaleta(lerPaleta());
    for (const l of blocos) {
      expect(op(l)).toBe(0);
      if (l.traco) expect(l.traco.visible).toBe(false);
    }
    c.dispose();
  });
});

describe('a conferência das correções (16/10, à tarde)', () => {
  it('o arquivo guarda a parte do desenho, o lugar e o texto de origem (reabrir não tira a cota da seção)', () => {
    const p = pranchasComVistas(lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [{
          id: 'a', conteudo: { tipo: 'armacao' }, escala: 25, x: 1, y: 1, titulo: '',
          anotacoes: { 'cota:9,5#1': { oculta: true, ref: [10, 20], original: '9,5' } },
          cotas: [{ id: 'c1', a: [0, 0], b: [1400, 0], linha: [700, 200], direcao: 'h', regiao: 'secao', texto: '' }],
          textos: [{ id: 't1', p: [1, 2], texto: 'NOTA', regiao: 'estribo:N4' }],
        }],
      }],
    }));
    const i = p.folhas[0].itens[0];
    expect(i.anotacoes!['cota:9,5#1']).toEqual({ oculta: true, ref: [10, 20], original: '9,5' });
    // texto vazio da cota criada (de antes de 16/10) cai: fica a medida
    expect(i.cotas![0]).toEqual({ id: 'c1', a: [0, 0], b: [1400, 0], linha: [700, 200], direcao: 'h', regiao: 'secao' });
    expect(i.textos![0].regiao).toBe('estribo:N4');
  });

  it('chave dita pelo desenho: o muro mudou o texto, o reescrito e o esconder caem; o lugar fica', () => {
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    const faixa = v.anotacoes!.find((a) => a.chave.startsWith('texto:faixa:'))!;
    const ajuste = { texto: 'ERRADO', oculta: true as const, dx: 30, dy: 0, original: 'N9 – 99 Ø10 c/99' };
    const w = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a', { anotacoes: { [faixa.chave]: ajuste } });
    const a = w.anotacoes!.find((q) => q.chave === faixa.chave)!;
    expect(a.oculta).toBe(false);
    expect(a.texto).toBe(faixa.texto);
    expect(a.p[0]).toBeCloseTo(faixa.p0[0] + 30, 6);
    // com o texto de origem igual, o ajuste vale inteiro
    const z = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a', { anotacoes: { [faixa.chave]: { ...ajuste, original: faixa.original } } });
    expect(z.anotacoes!.find((q) => q.chave === faixa.chave)!.oculta).toBe(true);
  });


  it('o 3D em vetor da prancha: a linha "Alvenaria" a 100 % apaga todo bloco, como no visor', () => {
    const cam: Camera3d = {
      posicao: [12, -9.7, 11], alvo: [2, 0.3, 1], cima: [0, 0, 1], ortografica: true, zoom: 120, fov: 40,
      estilo: 'cores', armadura: false, corteX: null, ocultas: [],
    };
    // as faces de bloco no SVG (o polígono leva o id da peça: "T1.M.f02.p001" é bloco; "T1.ATERRO", o terreno)
    const facesDeBloco = (svg: string) => (svg.match(/<polygon [^>]*data-id="T\d+\.M\./g) ?? []).length;
    expect(facesDeBloco(desenharVista3d(m, cam, { S: 0.1 }).svg())).toBeGreaterThan(0);
    usarGraficos({ ...GRAFICOS_DE_FABRICA, visor: { materiais: { alvenaria: { transparencia: 100 } } } });
    expect(facesDeBloco(desenharVista3d(m, cam, { S: 0.1 }).svg())).toBe(0);
  });

  it('armação: as fileiras de sombra e as faixas são partes; a cota criada numa fileira fica nela em outra escala', () => {
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    const nomes = v.regioes!.map((r) => r.nome);
    expect(nomes.some((n) => n.startsWith('sombra:inferior:'))).toBe(true);
    expect(nomes.some((n) => n.startsWith('faixa:'))).toBe(true);
    const fileira = v.regioes!.find((r) => r.nome.startsWith('sombra:inferior:'))!;
    const cota: CotaNova = { id: 'c', a: [0, 0], b: [2000, 0], linha: [1000, 40], direcao: 'h', regiao: fileira.nome };
    for (const escala of [25, 50]) {
      const w = vistaParaPrancha(m, { tipo: 'armacao' }, escala, 'a', { cotas: [cota] });
      const o = w.regioes!.find((r) => r.nome === fileira.nome)!.origem;
      const a = w.anotacoes!.find((q) => q.chave === 'c')!;
      expect(a.linha![0][1]).toBeCloseTo(o[1] + 40 * w.S!, 6);
    }
  });

  it('folha só com uma planta de cores próprias: a legenda do quadro é a da planta, e a planta não repete a dela', () => {
    const pedidas: string[] = [];
    const legendas: Record<string, boolean> = {};
    const f = novaFolha('');
    f.itens = [{ id: 'p', conteudo: { tipo: 'planta', fiada: 0 }, escala: 50, x: 30, y: 30, titulo: '', graficos: { materiais: { inteiro: { cor: '#00ff00' } } } }];
    comporFolha(f, {
      numero: 1, total: 1,
      obra: { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
      escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
      notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 },
      legendaPorVista: (v, sob) => {
        pedidas.push(v);
        return naVista(v, () => [{ cor: '#000000', rotulo: v }], sob);
      },
      desenhar: (item, prefixo, o) => {
        legendas[item.id] = o.legendaDeCores;
        return { tipo: 'vetor', vista: vistaParaPrancha(m, item.conteudo as PedidoDeVista, 50, prefixo) };
      },
    });
    expect(pedidas).toEqual(['planta']);
    expect(legendas.p).toBe(false);
  });
});
