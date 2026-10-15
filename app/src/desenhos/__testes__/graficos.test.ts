/*
  A TABELA DE GRÁFICOS (Jose, 15/10: cores, hachuras e o que aparece em cada vista) — o que quebraria:
  - uma cor mal guardada apagando a tabela inteira (ou a tabela de outra versão do app não abrindo);
  - a cor do bloco trocada na tabela e a vista, a planta ou o 3D Cores ainda na cor velha;
  - desligar a armadura na planta e a barra continuar no desenho (ou no DXF);
  - trocar a hachura e o PDF/DXF saírem com a de fábrica;
  - o Realista seguindo a tabela (decisão: só Cores e Opaco).
*/
import { afterEach, describe, expect, it } from 'vitest';
import type { Primitiva } from '@/pranchas/tipos';
import { corDaPeca, corDoAco } from '@/visor/estiloVisual';
import { lerPaleta } from '@/visor/tema3d';
import { corDaBitola } from '@/visor/coresDasBitolas';
import { GRAFICOS_DE_FABRICA, lerGraficos, usarGraficos, versaoDosGraficos, type Graficos } from '../graficos';
import { desenharPlanta } from '../planta';
import { desenharVistaFrontal } from '../vistaFrontal';
import { desenharCorteLateral } from '../corteLateral';
import { vistaParaPrancha } from '../index';
import { modeloDeExemplo } from './modeloDeExemplo';

const m = modeloDeExemplo({ tipo: 'contrafortes', areia: 150 });

afterEach(() => usarGraficos(GRAFICOS_DE_FABRICA));

const com = (f: (g: Graficos) => Graficos) => usarGraficos(f(GRAFICOS_DE_FABRICA));

describe('leitura tolerante do que veio guardado', () => {
  it('nada guardado ou lixo: o de fábrica', () => {
    expect(lerGraficos(null)).toBe(GRAFICOS_DE_FABRICA);
    expect(lerGraficos('xyz')).toBe(GRAFICOS_DE_FABRICA);
  });

  it('campo a campo: a cor boa fica, a mal escrita volta à de fábrica, item que a vista não tem cai', () => {
    const g = lerGraficos({
      materiais: { inteiro: { cor: '#123456' }, meio: { cor: 'azul' }, concreto: { hachura: { desenho: 'brita', escala: 2, risco: 'x' } } },
      bitolas: [[10, '#000000'], [6.3, 'verde']],
      ocultos: { planta: ['armadura', 'fiadas', 'nada'] },
    });
    expect(g.materiais.inteiro.cor).toBe('#123456');
    expect(g.materiais.meio.cor).toBe(GRAFICOS_DE_FABRICA.materiais.meio.cor);
    expect(g.materiais.concreto.hachura).toEqual({ ...GRAFICOS_DE_FABRICA.materiais.concreto.hachura, desenho: 'brita', escala: 2 });
    expect(g.bitolas.find(([d]) => d === 10)![1]).toBe('#000000');
    expect(g.bitolas.find(([d]) => d === 6.3)![1]).toBe('#00ff00');
    // a planta não tem número de fiada: o item cai
    expect(g.ocultos.planta).toEqual(['armadura']);
  });
});

describe('as vistas seguem a tabela', () => {
  it('a cor do bloco inteiro na tabela pinta a vista frontal e a planta', () => {
    const v0 = versaoDosGraficos();
    com((g) => ({ ...g, materiais: { ...g.materiais, inteiro: { cor: '#123456' } } }));
    expect(versaoDosGraficos()).toBeGreaterThan(v0);
    expect(desenharVistaFrontal(m).svg()).toContain('fill="#123456"');
    expect(desenharPlanta(m, 0).svg()).toContain('fill="#123456"');
  });

  it('armadura desligada na planta: nenhuma barra no SVG nem nas primitivas; o corte (outro tipo de vista) continua com ela', () => {
    com((g) => ({ ...g, ocultos: { ...g.ocultos, planta: ['armadura', 'cotas'] } }));
    const p = desenharPlanta(m, 0);
    const prims = p.primitivas();
    expect(prims.some((q) => q.k !== 'texto' && 'e' in q && q.e?.camada === 'aco')).toBe(false);
    expect(prims.some((q) => q.k === 'texto' && q.camada === 'cotas')).toBe(false);
    const c = desenharCorteLateral(m).primitivas();
    expect(c.some((q) => q.k === 'polilinha' && q.e.camada === 'aco')).toBe(true);
  });

  it('a hachura do concreto trocada por brita, na escala 2: o PDF (vetor) e o DXF levam a nova', () => {
    com((g) => ({ ...g, materiais: { ...g.materiais, concreto: { ...g.materiais.concreto, hachura: { desenho: 'brita', risco: '#112233', fundo: '#ddeeff', escala: 2 } } } }));
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c', { hachuraVetorial: true });
    expect(v.corpo).toContain('#ddeeff');
    const sapata = v.primitivas.filter((q): q is Extract<Primitiva, { k: 'hachura' }> => q.k === 'hachura' && q.camada === 'concreto');
    expect(sapata.length).toBeGreaterThan(0);
    for (const h of sapata) {
      expect(h.padrao).toBe('brita');
      expect(h.fundo).toBe('#ddeeff');
      expect(h.escala).toBe(2);
    }
  });

  it('hachura "vazio": sai só o contorno, sem preenchimento no DXF', () => {
    com((g) => ({ ...g, materiais: { ...g.materiais, terra: { ...g.materiais.terra, hachura: { ...g.materiais.terra.hachura!, desenho: 'vazio' } } } }));
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c');
    expect(v.primitivas.some((q) => q.k === 'hachura' && q.camada === 'terreno')).toBe(false);
  });
});

describe('o 3D segue a tabela no Cores e no Opaco, não no Realista', () => {
  it('bloco, sapata e aço', () => {
    const p = lerPaleta();
    const realistaAntes = corDaPeca('realista', p, 'concreto');
    com((g) => ({
      ...g,
      materiais: { ...g.materiais, bloco54: { cor: '#00aa00' }, concreto: { ...g.materiais.concreto, cor: '#334455', opaco: '#eeeeee' }, aco: { ...g.materiais.aco, cor: '#101010', opaco: '#202020' } },
      bitolas: g.bitolas.map(([d, c]): [number, string] => [d, d === 10 ? '#abcdef' : c]),
    }));
    expect(corDaPeca('cores', p, 'alvenaria', 'bloco54')).toBe('#00aa00');
    expect(corDaPeca('cores', p, 'concreto')).toBe('#334455');
    expect(corDaPeca('opaco', p, 'concreto')).toBe('#eeeeee');
    expect(corDaPeca('realista', p, 'concreto')).toBe(realistaAntes);
    expect(corDoAco('cores')).toBe('#101010');
    expect(corDoAco('opaco')).toBe('#202020');
    expect(corDaBitola(10)).toBe('#abcdef');
  });

  it('material sem cor escolhida (null): a do tema', () => {
    const p = lerPaleta();
    expect(corDaPeca('cores', p, 'concreto')).toBe(p.concreto);
  });
});
