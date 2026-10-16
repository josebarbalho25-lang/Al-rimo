/*
  A REVISÃO DA LISTA DO JOSE DE 16/10 (vistas como no Revit, cota de verdade, etiqueta, gráficos gerais × sobreposição,
  sombra do graute, título numerado), por três revisores adversariais — o que cada um achou, para não voltar:
  - Cancelar a janela de gráficos numa vista de fábrica intocada gravava a vista e acendia o • (e a ordem dos campos
    também acendia);
  - as cores guardadas de 15/10 perdiam o que estava no corte (as hachuras só aparecem nele) e a transparência da
    frontal vazava para todas as vistas e para o 3D;
  - arquivo de hoje aberto no app de ontem perdia os desenhos; vista sem escala virava 1:50; vista que não se lê sumia
    calada; "Perspectiva (2)" virava título;
  - a vista não conseguia desfazer a transparência ou o meio-tom que a geral pôs;
  - a cota do traspasse ignorava o "Cotas" desligado; categoria desligada deixava alvo invisível e o desenho pulava;
  - a sombra do graute (#7a7a7a) sumia no bloco inteiro (#787878); o DXF pintava o fantasma do bloco escondido e
    deixava fresta branca na junta; meio-tom saía dobrado na faixa e no 3D da prancha, e sumia da borda no PDF;
  - número comprido saía do quadrado do título; a cota de comprimento em valor cheio perdia o ajuste de ontem.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { desenharVista3d, vistaParaPrancha } from '@/desenhos';
import { cm } from '@/desenhos/formato';
import {
  GRAFICOS_DE_FABRICA, emMeioTom, lerGraficos, naVista, noMaterialDaVista, tabelaDaVista, usarGraficos,
} from '@/desenhos/graficos';
import { corDaPeca } from '@/visor/estiloVisual';
import { lerPaleta } from '@/visor/tema3d';
import { comporFolha, ondeVaiOTitulo, type ContextoDaFolha } from '../folha';
import { lerPranchas, novaFolha, SEM_PRANCHAS } from '../padrao';
import { mesmoConteudo, naVistaDoProjeto, nomeDado, pranchasParaArquivo, renomearVista, vistaDeFabrica } from '../vistas';
import type { Camera3d, PranchasDoProjeto, Primitiva, VistaParaPrancha } from '../tipos';

const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
afterEach(() => usarGraficos(GRAFICOS_DE_FABRICA));

// ── dados e arquivo ─────────────────────────────────────────────────────────

describe('a vista de fábrica só entra no arquivo quando muda', () => {
  it('mudança que não muda nada (o Cancelar da janela de gráficos) devolve as mesmas pranchas', () => {
    const p = SEM_PRANCHAS;
    expect(naVistaDoProjeto(p, 'corte', (v) => ({ ...v }))).toBe(p);
    expect(naVistaDoProjeto(p, 'corte', ({ graficos: _g, ...v }) => v)).toBe(p);
    // a que muda de verdade grava
    const q = naVistaDoProjeto(p, 'corte', (v) => ({ ...v, graficos: { ocultos: ['cotas'] } }));
    expect(q.vistas.map((v) => v.id)).toEqual(['corte']);
  });

  it('o mesmo conteúdo com os campos em outra ordem é o mesmo (não acende o •)', () => {
    expect(mesmoConteudo({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } }, { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 })).toBe(true);
    expect(mesmoConteudo({ a: 1 }, { a: 2 })).toBe(false);
    expect(mesmoConteudo([1, 2], [2, 1])).toBe(false);
  });

  it('nome repetido ganha o (2), como no Revit', () => {
    let p: PranchasDoProjeto = { ...SEM_PRANCHAS, vistas: [{ ...vistaDeFabrica('corte'), id: 'a', nome: 'Corte A' }, { ...vistaDeFabrica('corte'), id: 'b', nome: 'Corte B' }] };
    p = renomearVista(p, 'b', 'Corte A');
    expect(p.vistas.map((v) => v.nome)).toEqual(['Corte A', 'Corte A (2)']);
    // renomear para o próprio nome não muda
    expect(renomearVista(p, 'a', 'Corte A').vistas[0].nome).toBe('Corte A');
  });
});

describe('o arquivo de hoje', () => {
  const comVista = (): PranchasDoProjeto => {
    const f = novaFolha('');
    f.itens.push({ id: 'i', vista: 'v1', conteudo: { tipo: 'corte' }, escala: 25, titulo: 'Corte A', x: 30, y: 30 });
    return {
      ...SEM_PRANCHAS, folhas: [f],
      vistas: [{ id: 'v1', nome: 'Corte A', conteudo: { tipo: 'corte' }, escala: 25, titulo: 'Corte A', cotas: [{ id: 'c', a: [0, 0], b: [100, 0], linha: [50, 50], direcao: 'h' }] }],
    };
  };

  it('leva o espelho do conteúdo, da escala e do título no item (o app de antes de 16/10 abre os desenhos), sem as anotações', () => {
    const [item] = pranchasParaArquivo(comVista()).folhas[0].itens;
    expect(item.conteudo).toEqual({ tipo: 'corte' });
    expect([item.escala, item.titulo, item.vista]).toEqual([25, 'Corte A', 'v1']);
    expect(item.cotas).toBeUndefined();
  });

  it('vista que não se lê: o desenho volta pelo espelho e o nome dela vai para o recado de abertura', () => {
    const bruto = JSON.parse(JSON.stringify(pranchasParaArquivo(comVista())));
    bruto.vistas[0].conteudo = { tipo: 'vista-do-futuro' };
    const perdidos: string[] = [];
    const p = lerPranchas(bruto, perdidos);
    expect(p.folhas[0].itens).toHaveLength(1);
    expect(p.folhas[0].itens[0].conteudo).toEqual({ tipo: 'corte' });
    expect(perdidos).toEqual(['vista: Corte A']);
  });

  it('vista 2D sem escala (de antes de 16/10) continua sem escala depois de salvar e abrir, com o tamanho', () => {
    const antiga = lerPranchas({ folhas: [{ formato: 'A1', orientacao: 'deitada', itens: [{ id: 'i', conteudo: { tipo: 'corte' }, escala: null, largura: 222, altura: 111, x: 30, y: 30, titulo: '' }] }] });
    expect(antiga.vistas[0].escala).toBeNull();
    const reaberta = lerPranchas(JSON.parse(JSON.stringify(pranchasParaArquivo(antiga))));
    expect(reaberta.vistas[0].escala).toBeNull();
    expect(reaberta.folhas[0].itens[0].largura).toBe(222);
  });

  it('as duas perspectivas de um arquivo antigo não viram título dado ("Perspectiva (2)" é cópia, não nome)', () => {
    expect(nomeDado('Perspectiva', '3d')).toBe(false);
    expect(nomeDado('Perspectiva (2)', '3d')).toBe(false);
    expect(nomeDado('3D (3)', '3d')).toBe(false);
    expect(nomeDado('Fachada', '3d')).toBe(true);
  });
});

describe('as cores guardadas de 15/10 (uma tabela por tipo de vista)', () => {
  const v2 = {
    vistas: {
      frontal: { materiais: { terra: { transparencia: 50 }, inteiro: { cor: '#111111' } } },
      corte: { materiais: { terra: { hachura: { escala: 0.5 } }, alvenaria: { hachura: { desenho: 'solido' } } }, anotacoes: { cotas: { cor: '#00ff00' } } },
      '3d': { materiais: { tubo: { transparencia: 30 } } },
    },
  };
  it('a hachura vem do corte (é só nele que ela aparece) e a cor da anotação, da vista que a trocou', () => {
    const g = lerGraficos(v2);
    expect(g.geral.materiais.terra.hachura!.escala).toBe(0.5);
    expect(g.geral.materiais.alvenaria.hachura!.desenho).toBe('solido');
    expect(g.geral.anotacoes.cotas.cor).toBe('#00ff00');
    expect(g.geral.materiais.inteiro.cor).toBe('#111111');
  });
  it('a transparência de uma vista não vira de todas (nem do 3D); a do 3D fica na sobreposição do visor', () => {
    const g = lerGraficos(v2);
    expect(g.geral.materiais.terra.transparencia).toBeUndefined();
    expect(g.visor.materiais?.tubo?.transparencia).toBe(30);
    expect(g.visor.materiais?.terra?.transparencia).toBeUndefined();
  });
  it('a cor de fábrica antiga do graute (o bege e o cinza claro da tarde de 16/10) volta à de hoje', () => {
    for (const cor of ['#c9c6bd', '#7a7a7a']) expect(lerGraficos({ geral: { materiais: { graute: { cor } } } }).geral.materiais.graute.cor).toBeNull();
  });
});

describe('a sobreposição da vista desfaz o que a geral pôs', () => {
  it('0 % e meio-tom desligado ficam na sobreposição e valem por cima dos da geral', () => {
    usarGraficos({ ...GRAFICOS_DE_FABRICA, geral: { ...GRAFICOS_DE_FABRICA.geral, materiais: { ...GRAFICOS_DE_FABRICA.geral.materiais, inteiro: { cor: '#787878', transparencia: 50, meioTom: true } } } });
    const s = noMaterialDaVista(undefined, 'inteiro', () => ({ transparencia: 0, meioTom: false }));
    expect(s?.materiais?.inteiro).toEqual({ transparencia: 0, meioTom: false });
    const t = naVista('frontal', () => tabelaDaVista(), s);
    expect([t.inteiro.transparencia, t.inteiro.meioTom]).toEqual([0, false]);
  });
});

// ── desenho e saída ─────────────────────────────────────────────────────────

const naCamada = (ps: Primitiva[], c: string) => ps.filter((p) => ('camada' in p && p.camada === c) || ('e' in p && (p.e as { camada?: string }).camada === c));

describe('categoria de anotação desligada', () => {
  it('corte sem cotas: nenhuma linha de cota (nem a do traspasse) e nenhuma cota editável', () => {
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v', { graficos: { ocultos: ['cotas'] } });
    expect(naCamada(v.primitivas, 'cotas')).toHaveLength(0);
    expect(v.anotacoes?.filter((a) => a.tipo === 'cota') ?? []).toHaveLength(0);
    expect(v.corpo).not.toContain('traspasse');
  });
  it('textos desligados na armação: o desenho não pula e não fica texto editável invisível', () => {
    const base = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a');
    const v = vistaParaPrancha(m, { tipo: 'armacao' }, 25, 'a', { graficos: { anotacoes: { textos: { visivel: false } } } });
    expect(v.referencia).toEqual(base.referencia);
    expect((v.anotacoes ?? []).length).toBeLessThan((base.anotacoes ?? []).length);
  });
});

describe('a sombra do graute', () => {
  const faixasNaTela = (v: VistaParaPrancha) => [...v.corpo.matchAll(/<rect [^>]*fill="(#[0-9a-f]{6})"[^>]*opacity="0\.35"/g)].map((q) => q[1]);
  const pecasDoDxf = (v: VistaParaPrancha) => naCamada(v.primitivas, 'graute').filter((p): p is Extract<Primitiva, { k: 'hachura' }> => p.k === 'hachura').map((p) => p.fundo);

  it('é um cinza escuro (o claro sumia no inteiro #787878); no 3D Cores o graute segue claro', () => {
    const v = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f');
    expect(new Set(faixasNaTela(v))).toEqual(new Set(['#3d3d3d']));
    expect(corDaPeca('cores', lerPaleta(), 'graute')).toBe('#c9c6bd');
  });

  it('meio-tom uma vez: a tela leva a cor crua (a Prancha clareia) e o DXF a mistura com o meio-tom uma vez', () => {
    const v = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f', { graficos: { materiais: { graute: { meioTom: true } } } });
    expect(new Set(faixasNaTela(v))).toEqual(new Set([emMeioTom('#3d3d3d')]));
  });

  it('DXF: com os blocos escondidos, a faixa vai só sobre o papel (sem o fantasma colorido dos blocos)', () => {
    const com = new Set(pecasDoDxf(vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f')));
    const sem = new Set(pecasDoDxf(vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f', { graficos: { ocultos: ['blocos'] } })));
    expect(com.size).toBeGreaterThan(1);
    expect(sem.size).toBe(1);
    // a única que sobra é a faixa sobre o papel (a 1ª peça, que também existe com os blocos)
    expect([...sem]).toEqual([[...com][0]]);
  });

  it('DXF: a primeira peça de cada coluna é a faixa inteira sobre o papel (a junta em pé não fica branca)', () => {
    const v = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f');
    const pecas = naCamada(v.primitivas, 'graute').filter((p): p is Extract<Primitiva, { k: 'hachura' }> => p.k === 'hachura');
    const sobreOPapel = pecas[0].fundo;
    const faixas = pecas.filter((p) => p.fundo === sobreOPapel);
    // uma faixa sobre o papel por coluna de graute (as da tela, no grupo do graute — a legenda tem a amostra dela)
    const grupo = /<g data-camada="graute">([\s\S]*?)<\/g>/.exec(v.corpo)![1];
    expect(faixas.length).toBe(faixasNaTela({ ...v, corpo: grupo }).length);
  });
});

describe('o 3D em vetor da prancha no Opaco: meio-tom uma vez, como o visor', () => {
  it('o concreto em meio-tom sai com a cor do visor, não clareada duas vezes', () => {
    const cam: Camera3d = {
      posicao: [12, -9.7, 11], alvo: [2, 0.3, 1], cima: [0, 0, 1], ortografica: true, zoom: 120, fov: 40,
      estilo: 'opaco', armadura: false, corteX: null, ocultas: [],
    };
    usarGraficos({ ...GRAFICOS_DE_FABRICA, visor: { materiais: { concreto: { meioTom: true, opaco: '#808080' } } } });
    const svg = desenharVista3d(m, cam, { S: 0.1 }).svg();
    expect(svg).toContain(`fill="${emMeioTom('#808080')}"`);
    expect(svg).not.toContain(`fill="${emMeioTom(emMeioTom('#808080'))}"`);
  });
});

describe('PDF: a borda da área hachurada leva o meio-tom do material', () => {
  it('alvenaria em meio-tom no corte: a borda do vetor sai clara como a da tela', () => {
    const o = { graficos: { materiais: { alvenaria: { meioTom: true } } } };
    const tela = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v', o);
    const pdf = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v', { ...o, hachuraVetorial: true });
    const bordas = (s: string) => new Set([...s.matchAll(/fill="url\(#v-alv\)"[^>]*stroke="(#[0-9a-f]{6})"/g)].map((q) => q[1]));
    const doPdf = new Set([...pdf.corpo.matchAll(/<path d="[^"]*" fill-rule="evenodd" fill="none" stroke="(#[0-9a-f]{6})"/g)].map((q) => q[1]));
    for (const c of bordas(tela.corpo)) expect(doPdf.has(c)).toBe(true);
  });
});

describe('o título numerado', () => {
  const vista: VistaParaPrancha = { corpo: '', defs: '', caixa: [0, 0, 440, 220], primitivas: [] };
  const ctx: ContextoDaFolha = {
    numero: 1, total: 1, obra: { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 }, desenhar: () => ({ tipo: 'vetor', vista }),
  };
  it('número comprido não sai do quadrado: a letra encolhe e o quadrado alarga; a caixa de reescrever vem depois dele', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Detalhe', numero: 'DET-12AB' });
    const c = comporFolha(f, ctx);
    const quadrado = c.primitivas.find((p): p is Extract<Primitiva, { k: 'hachura' }> => p.k === 'hachura' && p.camada === 'titulos')!;
    const xs = quadrado.aneis[0].map((q) => q[0]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    expect(x1 - x0).toBeGreaterThan(10);
    const titulo = c.primitivas.find((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.t === 'Detalhe')!;
    expect(titulo.p[0]).toBeGreaterThan(x1);
    expect(ondeVaiOTitulo(c.itens[0].titulo!, 'DET-12AB')[0]).toBeCloseTo(titulo.p[0], 6);
  });
});

describe('a cota de comprimento em valor cheio', () => {
  it('guarda a chave do valor sem a junta (a de até 15/10): o ajuste feito ontem continua achando a cota', () => {
    const v = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f');
    const total = v.anotacoes!.find((a) => a.tipo === 'cota' && a.chave === `cota:${cm(m.dims.L_real)}#0`);
    expect(total).toBeDefined();
    expect(total!.texto).not.toBe(cm(m.dims.L_real));
  });
});
