/*
  OS GRÁFICOS: a GERAL (a engrenagem) e a SOBREPOSIÇÃO de cada vista (Jose, 16/10: "a do menu da engrenagem fosse a
  geral e a da vista fosse 'Sobreposição' da vista") — o que quebraria:
  - uma cor mal guardada apagando a tabela inteira; o guardado de antes (uma tabela por tipo de vista, ou uma só) não
    abrindo, ou abrindo sem as cores do Jose;
  - a sobreposição de uma vista pintando outra vista (ou o 3D); a geral não chegando a quem não sobrepôs;
  - desligar a armadura numa vista e a barra continuar no desenho (ou no DXF);
  - trocar a hachura do corte e o PDF/DXF saírem com a de fábrica;
  - a transparência, a cor das anotações, o visível de textos e sombras e o meio-tom não chegarem ao desenho;
  - o Realista seguindo a cor da tabela (decisão: só Cores e Opaco), ou a sobreposição do visor não chegando ao 3D.
*/
import { afterEach, describe, expect, it } from 'vitest';
import type { Primitiva } from '@/pranchas/tipos';
import { corDaPeca, corDoAco } from '@/visor/estiloVisual';
import { lerPaleta } from '@/visor/tema3d';
import { corDaBitola } from '@/visor/coresDasBitolas';
import { construirCena3D } from '@/visor/cena3d';
import { muroDeExemplo } from '@/visor/exemploDeModelo';
import {
  comGeralDaAnotacao,
  comGeralDoMaterial,
  comItemDaVista,
  emMeioTom,
  GRAFICOS_DE_FABRICA,
  lerGraficos,
  lerSobreposicao,
  limparSobreposicao,
  MATERIAIS_DE_FABRICA,
  noMaterialDaVista,
  usarGraficos,
  versaoDosGraficos,
  type Graficos,
  type SobreposicaoDaVista,
} from '../graficos';
import { vistaParaPrancha } from '../index';
import { modeloDeExemplo } from './modeloDeExemplo';

const m = modeloDeExemplo({ tipo: 'contrafortes', areia: 150 });

afterEach(() => usarGraficos(GRAFICOS_DE_FABRICA));

const com = (f: (g: Graficos) => Graficos) => usarGraficos(f(GRAFICOS_DE_FABRICA));
const frontal = (graficos?: SobreposicaoDaVista, o: { hachuraVetorial?: boolean } = {}) => vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'f', { ...o, graficos });
const planta = (graficos?: SobreposicaoDaVista) => vistaParaPrancha(m, { tipo: 'planta', fiada: 0 }, 50, 'p', { graficos });
const corte = (graficos?: SobreposicaoDaVista, o: { hachuraVetorial?: boolean } = {}) => vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c', { ...o, graficos });

describe('leitura tolerante do que veio guardado', () => {
  it('nada guardado ou lixo: o de fábrica', () => {
    expect(lerGraficos(null)).toBe(GRAFICOS_DE_FABRICA);
    expect(lerGraficos('xyz')).toBe(GRAFICOS_DE_FABRICA);
  });

  it('o de hoje: a geral campo a campo, a sobreposição do visor, transparência de 5 em 5', () => {
    const g = lerGraficos({
      geral: { materiais: { inteiro: { cor: '#123456', transparencia: 52 }, meio: { cor: 'azul' } }, anotacoes: { cotas: { cor: '#ff0000' }, textos: { cor: 'x' } } },
      visor: { materiais: { terra: { transparencia: 140 } } },
      bitolas: [[10, '#000000'], [6.3, 'verde']],
    });
    expect(g.geral.materiais.inteiro).toEqual({ cor: '#123456', transparencia: 50 });
    expect(g.geral.materiais.meio.cor).toBe(MATERIAIS_DE_FABRICA.meio.cor);
    expect(g.geral.anotacoes.cotas.cor).toBe('#ff0000');
    expect(g.geral.anotacoes.textos.cor).toBeNull();
    expect(g.visor).toEqual({ materiais: { terra: { transparencia: 100 } } });
    expect(g.bitolas.find(([d]) => d === 10)![1]).toBe('#000000');
    expect(g.bitolas.find(([d]) => d === 6.3)![1]).toBe('#00ff00');
  });

  it('o de antes de 16/10 (uma tabela por tipo): a da frontal vira a geral, com o Opaco do 3D; a diferença do 3D vai para o visor', () => {
    const g = lerGraficos({
      vistas: {
        frontal: { materiais: { inteiro: { cor: '#111111' } } },
        planta: { materiais: { inteiro: { cor: '#222222' } } },
        '3d': { materiais: { inteiro: { cor: '#333333' }, concreto: { opaco: '#eeeeee' } } },
      },
    });
    expect(g.geral.materiais.inteiro.cor).toBe('#111111');
    expect(g.geral.materiais.concreto.opaco).toBe('#eeeeee');
    expect(g.visor.materiais?.inteiro?.cor).toBe('#333333');
  });

  it('a tabela única da manhã de 15/10 vira a geral', () => {
    const g = lerGraficos({ materiais: { inteiro: { cor: '#123456' }, concreto: { hachura: { desenho: 'brita', escala: 2, risco: 'x' } } } });
    expect(g.geral.materiais.inteiro.cor).toBe('#123456');
    expect(g.geral.materiais.concreto.hachura).toEqual({ ...MATERIAIS_DE_FABRICA.concreto.hachura, desenho: 'brita', escala: 2 });
  });

  it('a sobreposição guardada (na vista): o que não presta cai; vazia = nada', () => {
    expect(lerSobreposicao({ materiais: { inteiro: { cor: 'x' } }, ocultos: ['nada'] })).toBeUndefined();
    expect(lerSobreposicao({ materiais: { graute: { transparencia: 33, visivel: false, meioTom: true } }, anotacoes: { textos: { visivel: false } }, ocultos: ['armadura', 'armadura'] }))
      .toEqual({ materiais: { graute: { transparencia: 35, visivel: false, meioTom: true } }, anotacoes: { textos: { visivel: false } }, ocultos: ['armadura'] });
  });
});

describe('a geral e a sobreposição', () => {
  it('a sobreposição da planta pinta a planta e não a frontal; a geral chega às duas', () => {
    const verde: SobreposicaoDaVista = { materiais: { inteiro: { cor: '#123456' } } };
    expect(planta(verde).corpo).toContain('fill="#123456"');
    expect(frontal().corpo).not.toContain('fill="#123456"');
    const v0 = versaoDosGraficos();
    com((g) => comGeralDoMaterial(g, 'inteiro', (x) => ({ ...x, cor: '#654321' })));
    expect(versaoDosGraficos()).toBeGreaterThan(v0);
    expect(frontal().corpo).toContain('fill="#654321"');
    expect(planta().corpo).toContain('fill="#654321"');
    // a vista que sobrepôs fica com a dela
    expect(planta(verde).corpo).not.toContain('fill="#654321"');
  });

  it('armadura desligada numa vista: nenhuma barra no SVG nem nas primitivas; a outra vista continua com ela', () => {
    const sem = comItemDaVista(comItemDaVista(undefined, 'armadura', false), 'cotas', false);
    const p = planta(sem).primitivas;
    expect(p.some((q) => q.k !== 'texto' && 'e' in q && q.e?.camada === 'aco')).toBe(false);
    expect(p.some((q) => q.k === 'texto' && q.camada === 'cotas')).toBe(false);
    expect(corte().primitivas.some((q) => q.k === 'polilinha' && q.e.camada === 'aco')).toBe(true);
  });

  it('a hachura do concreto do corte trocada por brita, na escala 2: o PDF (vetor) e o DXF levam a nova; a frontal não', () => {
    const s = noMaterialDaVista(undefined, 'concreto', () => ({ hachura: { desenho: 'brita', risco: '#112233', fundo: '#ddeeff', escala: 2 } }));
    const v = corte(s, { hachuraVetorial: true });
    expect(v.corpo).toContain('#ddeeff');
    const sapata = v.primitivas.filter((q): q is Extract<Primitiva, { k: 'hachura' }> => q.k === 'hachura' && q.camada === 'concreto');
    expect(sapata.length).toBeGreaterThan(0);
    for (const h of sapata) expect([h.padrao, h.fundo, h.escala]).toEqual(['brita', '#ddeeff', 2]);
    expect(frontal(undefined, { hachuraVetorial: true }).corpo).not.toContain('#ddeeff');
  });

  it('a hachura da sobreposição chega ao <pattern> da TELA (montado depois do desenho) e à cota criada', () => {
    const s = noMaterialDaVista(undefined, 'concreto', () => ({ hachura: { fundo: '#abcdef' } }));
    const v = corte(s);
    expect(v.defs).toContain('#abcdef');
    expect(corte().defs).not.toContain('#abcdef');
  });

  it('hachura "vazio": sai só o contorno, sem preenchimento no DXF', () => {
    const v = corte(noMaterialDaVista(undefined, 'terra', () => ({ hachura: { desenho: 'vazio' } })));
    expect(v.primitivas.some((q) => q.k === 'hachura' && q.camada === 'terreno')).toBe(false);
  });
});

describe('transparência, anotações, visível e meio-tom', () => {
  it('a terra do corte a 50 %: o SVG leva a opacidade na área do solo; a frontal não', () => {
    const s = noMaterialDaVista(undefined, 'terra', () => ({ transparencia: 50 }));
    expect(corte(s).corpo).toMatch(/fill="url\(#c-solo\)"[^>]*opacity="0\.50"/);
    expect(corte(s, { hachuraVetorial: true }).corpo).toContain('opacity="0.50"');
    expect(frontal().corpo).not.toContain('opacity="0.50"');
  });

  it('as cotas do corte em vermelho (sobreposição): a linha e o número; a frontal segue com a cor do desenho', () => {
    const s: SobreposicaoDaVista = { anotacoes: { cotas: { cor: '#ff0000' } } };
    const c = corte(s).corpo;
    expect(c).toMatch(/<line [^>]*stroke="#ff0000" stroke-width="0.9"/);
    expect(c).toMatch(/<text [^>]*fill="#ff0000"/);
    expect(frontal().corpo).not.toContain('#ff0000');
    // a cor das cotas na geral chega a toda vista
    com((g) => comGeralDaAnotacao(g, 'cotas', '#00aa00'));
    expect(frontal().corpo).toMatch(/<text [^>]*fill="#00aa00"/);
  });

  it('as chamadas das barras na cor da vista: linha, ponto e texto', () => {
    const v = corte({ anotacoes: { chamadas: { cor: '#00aa00' } } });
    expect(v.corpo).toMatch(/<polyline [^>]*stroke="#00aa00"/);
    expect(v.corpo).toMatch(/<circle [^>]*fill="#00aa00"/);
    expect(v.corpo).toMatch(/<text [^>]*fill="#00aa00"[^>]*>N\d/);
  });

  it('textos desligados na vista: o rótulo solto some (o desenho não pula); as cotas ficam', () => {
    const base = corte();
    const sem = corte({ anotacoes: { textos: { visivel: false } } });
    expect(base.primitivas.some((q) => q.k === 'texto' && q.camada === 'terreno' || (q.k === 'texto' && q.camada === 'textos'))).toBe(true);
    expect(sem.primitivas.some((q) => q.k === 'texto' && q.camada === 'textos')).toBe(false);
    expect(sem.primitivas.some((q) => q.k === 'texto' && q.camada === 'cotas')).toBe(true);
    expect(sem.referencia).toEqual(base.referencia);
  });

  it('o bloco inteiro em meio-tom: a pintura vai para perto do papel (opaca), no SVG e no DXF', () => {
    const cor = MATERIAIS_DE_FABRICA.inteiro.cor!;
    const v = frontal({ materiais: { inteiro: { meioTom: true } } });
    expect(v.corpo).toContain(`fill="${emMeioTom(cor)}"`);
    expect(v.corpo).not.toContain(`fill="${cor}"`);
    expect(v.primitivas.some((q) => q.k === 'hachura' && q.fundo === emMeioTom(cor))).toBe(true);
  });

  it('emMeioTom: 60 % do caminho até o branco', () => {
    expect(emMeioTom('#000000')).toBe('#999999');
    expect(emMeioTom('#ffffff')).toBe('#ffffff');
    expect(emMeioTom('none')).toBe('none');
  });
});

describe('mexer na sobreposição', () => {
  it('o que volta a seguir a geral sai; 0 % e meio-tom desligado ficam (a vista desfaz o da geral); vazia = undefined', () => {
    const s = noMaterialDaVista(undefined, 'graute', () => ({ transparencia: 40, meioTom: true }));
    expect(s).toEqual({ materiais: { graute: { transparencia: 40, meioTom: true } } });
    expect(noMaterialDaVista(s, 'graute', () => ({ transparencia: undefined, meioTom: undefined }))).toBeUndefined();
    expect(noMaterialDaVista(s, 'graute', () => ({ transparencia: 0, meioTom: false }))).toEqual({ materiais: { graute: { transparencia: 0, meioTom: false } } });
    const oc = comItemDaVista(undefined, 'legenda', false);
    expect(oc).toEqual({ ocultos: ['legenda'] });
    expect(comItemDaVista(oc, 'legenda', true)).toBeUndefined();
    expect(limparSobreposicao({ materiais: {}, anotacoes: { cotas: {} }, ocultos: [] })).toBeUndefined();
  });
});

describe('o 3D segue a geral com a sobreposição do visor', () => {
  it('cor: Cores e Opaco seguem, o Realista não; a sobreposição de uma vista 2D não pinta o 3D', () => {
    const p = lerPaleta();
    const realistaAntes = corDaPeca('realista', p, 'concreto');
    com((g) => ({
      ...comGeralDoMaterial(g, 'concreto', (x) => ({ ...x, cor: '#334455', opaco: '#eeeeee' })),
      bitolas: g.bitolas.map(([d, c]): [number, string] => [d, d === 10 ? '#abcdef' : c]),
      visor: { materiais: { bloco54: { cor: '#00aa00' }, aco: { cor: '#101010', opaco: '#202020' } } },
    }));
    expect(corDaPeca('cores', p, 'alvenaria', 'bloco54')).toBe('#00aa00');
    expect(corDaPeca('cores', p, 'concreto')).toBe('#334455');
    expect(corDaPeca('opaco', p, 'concreto')).toBe('#eeeeee');
    expect(corDaPeca('realista', p, 'concreto')).toBe(realistaAntes);
    expect(corDoAco('cores')).toBe('#101010');
    expect(corDoAco('opaco')).toBe('#202020');
    expect(corDaBitola(10)).toBe('#abcdef');
  });

  it('meio-tom no visor: a peça vai para perto do claro (no Realista não)', () => {
    const p = lerPaleta();
    const antes = corDaPeca('cores', p, 'alvenaria', 'inteiro');
    com((g) => ({ ...g, visor: { materiais: { inteiro: { meioTom: true } } } }));
    expect(corDaPeca('cores', p, 'alvenaria', 'inteiro')).toBe(emMeioTom(antes));
  });

  it('material sem cor escolhida (null): a do tema', () => {
    const p = lerPaleta();
    expect(corDaPeca('cores', p, 'concreto')).toBe(p.concreto);
  });

  it('transparência do visor: o material fica transparente (no Realista também) e o terreno soma ao véu dele', () => {
    const muro = muroDeExemplo({ blocosPorFiada: 6, fiadas: 4, contraforte: false, terreno: true });
    const c = construirCena3D(muro, lerPaleta());
    const sapata = c.lotes.find((l) => l.lote.acabamento === 'concreto')!;
    const terreno = c.lotes.find((l) => l.lote.acabamento === 'terreno')!;
    const mat = (l: typeof sapata) => l.malha.material as import('three').Material;
    expect(mat(sapata).opacity).toBe(1);
    const veu = mat(terreno).opacity;
    usarGraficos({ ...GRAFICOS_DE_FABRICA, visor: { materiais: { concreto: { transparencia: 60 }, terra: { transparencia: 50 } } } });
    c.aplicarPaleta(lerPaleta());
    expect(mat(sapata).opacity).toBeCloseTo(0.4, 6);
    expect(mat(sapata).transparent).toBe(true);
    expect(mat(sapata).depthWrite).toBe(false);
    expect(mat(terreno).opacity).toBeCloseTo(veu * 0.5, 6);
    c.aplicarEstilo('realista');
    expect(mat(sapata).opacity).toBeCloseTo(0.4, 6);
    c.dispose();
  });
});
