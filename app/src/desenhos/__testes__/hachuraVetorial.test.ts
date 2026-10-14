/*
  HACHURA EM VETOR — o SVG que vai para o PDF (prancha.ts, "HACHURA EM VETOR"). O que quebraria:
  - sobrar um <pattern> ou um fill="url(#…-solo)": o Chrome imprime o padrão como imagem de ~37 dpi e a terra volta
    pixelada (51 MB em 3 folhas);
  - recorte ou ladrilho apontando para um id que não existe (a área sai sem hachura, ou com a de outra vista);
  - <clipPath> com mais de um filho: o Chrome passa a recortar por máscara, e máscara o PDF guarda como imagem;
  - ladrilho fora da grade do <pattern> ou com outro miolo: o papel mostraria um desenho e a tela outro;
  - a tela ou o DXF mudarem junto (a opção é só do SVG de saída).
*/
import { describe, expect, it } from 'vitest';
import type { Modelo, Vec3 } from '@/modelo/tipos';
import type { Camera3d, PedidoDeVista } from '@/pranchas/tipos';
import { comporFolha, type ContextoDaFolha } from '@/pranchas/folha';
import { criarDesenhista } from '@/pranchas/desenhista';
import { novaFolha, OBRA_EM_BRANCO } from '@/pranchas/padrao';
import { cortesPadrao, vista3dParaPrancha, vistaParaPrancha } from '../index';
import { ladrilhoDeMaterial } from '../hachuras';
import { modeloDeExemplo } from './modeloDeExemplo';
import { xmlBemFormado } from './lerSvg';

const m: Modelo = modeloDeExemplo({ tipo: 'contrafortes', areia: 150 });

const PEDIDOS: [string, PedidoDeVista, number][] = [
  ['corte', { tipo: 'corte' }, 25],
  ['corte no contraforte', { tipo: 'corte', x: m.dims.contrafortes[1].x }, 25],
  ['frontal', { tipo: 'frontal' }, 50],
  ['planta', { tipo: 'planta', fiada: 0 }, 25],
  ['iso cortado', { tipo: 'iso', vista: 'fundo-esquerda', corteX: cortesPadrao(m)[0].x }, 50],
];

const PADROES = ['solo', 'conc', 'alv', 'brita', 'areia', 'graute'];

/** O SVG inteiro da vista, como a folha monta (defs + corpo). */
const svgDe = (v: { defs: string; corpo: string }) => `<svg xmlns="http://www.w3.org/2000/svg"><defs>${v.defs}</defs>${v.corpo}</svg>`;
const idsDefinidos = (s: string) => [...s.matchAll(/<(?:pattern|marker|symbol|clipPath) id="([^"]+)"/g)].map((q) => q[1]);

describe.each(PEDIDOS)('%s com hachuraVetorial', (_, pedido, escala) => {
  const v = vistaParaPrancha(m, pedido, escala, 'v1', { hachuraVetorial: true, legendaDeCores: true });
  const tela = vistaParaPrancha(m, pedido, escala, 'v1', { legendaDeCores: true });
  const svg = svgDe(v);

  it('nenhum <pattern> e nenhum preenchimento por padrão', () => {
    expect(svg).not.toContain('<pattern');
    for (const p of PADROES) expect(svg).not.toContain(`url(#v1-${p})`);
    expect(xmlBemFormado(svg)).toBeNull();
  });

  it('todo recorte e todo ladrilho apontam para um id da própria vista; recorte com um caminho só', () => {
    const def = new Set(idsDefinidos(v.defs));
    const recortes = [...v.corpo.matchAll(/clip-path="url\(#([^)]+)\)"/g)].map((q) => q[1]);
    const ladrilhos = [...v.corpo.matchAll(/<use href="#([^"]+)"/g)].map((q) => q[1]);
    for (const id of [...recortes, ...ladrilhos]) expect(def.has(id), id).toBe(true);
    for (const id of def) expect(id.startsWith('v1-'), id).toBe(true);
    for (const [, miolo] of v.defs.matchAll(/<clipPath id="[^"]+">(.*?)<\/clipPath>/g)) expect(miolo).toMatch(/^<path d="[^"]+" clip-rule="evenodd"\/>$/);
  });

  it('as primitivas (DXF) são as mesmas da tela', () => {
    expect(v.primitivas).toEqual(tela.primitivas);
    expect(v.caixa).toEqual(tela.caixa);
  });

  it('a tela segue com o <pattern>, sem recorte nem ladrilho em vetor', () => {
    expect(tela.defs).toContain('<pattern');
    expect(tela.corpo + tela.defs).not.toMatch(/<clipPath|<symbol|<use /);
  });
});

describe('o corte em vetor', () => {
  const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c', { hachuraVetorial: true });
  const tela = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c');

  it('terra, concreto, brita e areia em ladrilhos (<symbol> + <use>), cada área recortada pelo contorno', () => {
    for (const k of ['solo', 'conc', 'brita', 'areia']) {
      expect(v.defs, k).toContain(`<symbol id="c-lad-${k}"`);
      expect(v.corpo, k).toContain(`<use href="#c-lad-${k}"`);
    }
    expect(v.defs).toContain('<clipPath');
    // a alvenaria cortada: o riscado girado como o patternTransform, um traço por coluna
    expect(v.corpo).toMatch(/<path d="M[^"]+" transform="rotate\(45\)" fill="none" stroke="#7f7f7f" stroke-width="0.45"\/>/);
  });

  it('o miolo do ladrilho é o do <pattern> da tela, e o fundo vira a cor da área', () => {
    for (const k of ['solo', 'conc', 'brita', 'areia'] as const) {
      const l = ladrilhoDeMaterial(k);
      const padrao = tela.defs.match(new RegExp(`<pattern id="c-${k}"[^>]*><rect [^>]*fill="([^"]+)"/>(.*?)</pattern>`))!;
      const simbolo = v.defs.match(new RegExp(`<symbol id="c-lad-${k}"[^>]*>(.*?)</symbol>`))!;
      expect(simbolo[1], k).toBe(padrao[2]);
      expect(padrao[1], k).toBe(l.fundo);
      expect(v.corpo, k).toContain(`fill="${l.fundo}" stroke="none"/>`);
    }
  });

  it('os ladrilhos ficam na grade do <pattern>: origem em 0,0 do desenho, passo do lado do ladrilho', () => {
    for (const k of ['solo', 'conc', 'brita', 'areia'] as const) {
      const L = ladrilhoDeMaterial(k).lado;
      const usos = [...v.corpo.matchAll(new RegExp(`<use href="#c-lad-${k}" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/>`, 'g'))];
      expect(usos.length, k).toBeGreaterThan(0);
      for (const [, x, y, w, h] of usos) {
        for (const c of [x, y]) expect(Math.abs(Number(c) / L - Math.round(Number(c) / L)), `${k} ${c}`).toBeLessThan(1e-4);
        expect([Number(w), Number(h)]).toEqual([Math.round(L * 1000) / 1000, Math.round(L * 1000) / 1000]);
      }
    }
  });

  it('a terra com furo continua furada: o recorte é par-ímpar', () => {
    const solo = v.corpo.match(/<g><path d="([^"]+)" fill-rule="evenodd" fill="#dbc9bb" stroke="none"\/><g clip-path="url\(#([^)]+)\)"><use href="#c-lad-solo"/)!;
    expect(solo).not.toBeNull();
    // a terra do corte contorna a sapata, o dreno e a alvenaria: anéis de furo no mesmo caminho
    expect((solo[1].match(/M/g) ?? []).length).toBeGreaterThan(1);
    expect(v.defs).toContain(`<clipPath id="${solo[2]}"><path d="${solo[1]}" clip-rule="evenodd"/></clipPath>`);
  });
});

describe('várias vistas em vetor na mesma folha', () => {
  it('nenhum id repetido entre dois prefixos', () => {
    const a = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'imp1i0', { hachuraVetorial: true });
    const b = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'imp1i1', { hachuraVetorial: true });
    const [ia, ib] = [idsDefinidos(a.defs), idsDefinidos(b.defs)];
    expect(ia.some((i) => i.includes('-rec'))).toBe(true);
    expect(ib.some((i) => i.includes('-rec'))).toBe(true);
    expect(new Set(ia).size).toBe(ia.length);
    expect(ia.every((i) => i.startsWith('imp1i0-'))).toBe(true);
    expect(ib.every((i) => i.startsWith('imp1i1-'))).toBe(true);
    expect(ia.filter((i) => ib.includes(i))).toEqual([]);
  });
});

describe('o 3D em vetor', () => {
  it('sem <pattern> nos defs (o 3D pinta cor chapada, mas os defs iam com os padrões de qualquer jeito)', () => {
    const ALVO: Vec3 = [2, 0.3, 1];
    const cam: Camera3d = {
      posicao: [12, -9.7, 11], alvo: ALVO, cima: [0, 0, 1], ortografica: true, zoom: 120, fov: 40, estilo: 'cores',
      armadura: false, corteX: null, ocultas: [],
    };
    const v = vista3dParaPrancha(m, cam, 160, 'q', { hachuraVetorial: true, legendaDeCores: true });
    expect(svgDe(v)).not.toContain('<pattern');
    expect(vista3dParaPrancha(m, cam, 160, 'q').defs).toContain('<pattern');
    expect(v.primitivas).toEqual(vista3dParaPrancha(m, cam, 160, 'q', { legendaDeCores: true }).primitivas);
  });
});

describe('a folha de saída (PDF)', () => {
  const d = criarDesenhista(m);
  const f = novaFolha('Formas');
  f.itens.push({ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: '' });
  f.itens.push({ id: 'f', conteudo: { tipo: 'frontal' }, escala: 50, x: 260, y: 30, titulo: '' });
  const ctx = (saida: boolean): ContextoDaFolha => ({
    numero: 1, total: 1, obra: OBRA_EM_BRANCO,
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 },
    desenhar: (item, prefixo, o) => d.desenhar(item, prefixo, o),
    saida, prefixo: saida ? 'imp' : 'p',
  });

  it('composta para o arquivo, a folha não leva padrão nenhum; na tela, leva', () => {
    const arquivo = comporFolha(f, ctx(true));
    expect(arquivo.svg).not.toContain('<pattern');
    expect(arquivo.svg).toContain('<use href="#imp1i0-lad-solo"');
    expect(xmlBemFormado(arquivo.svg)).toBeNull();
    expect(comporFolha(f, ctx(false)).svg).toContain('<pattern id="p1i0-solo"');
    // o DXF lê as primitivas: as mesmas nas duas composições
    expect(arquivo.primitivas).toEqual(comporFolha(f, ctx(false)).primitivas);
  });
});
