/*
  A folha composta e o que vai para o arquivo: tamanho pela norma, carimbo no canto inferior direito como bloco com
  os campos, desenho na escala pedida (1:25 → o px de desenho vira 1/4,4 mm), quadro lateral que avisa quando não
  cabe, e o .alrimo levando as folhas de ida e volta.
*/
import { describe, expect, it } from 'vitest';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { novaFolha, lerPranchas, temPranchas, SEM_PRANCHAS } from '../padrao';
import { quadroUtil, tamanhoDaFolha } from '../formatos';
import { PX_POR_MM, type Primitiva, type VistaParaPrancha } from '../tipos';
import { desserializarProjeto, serializarProjeto } from '@/estado/projeto';

const vista: VistaParaPrancha = {
  corpo: '<rect x="0" y="0" width="440" height="220" fill="#d9d9d9"/>',
  defs: '',
  caixa: [0, 0, 440, 220],
  primitivas: [{ k: 'linha', a: [0, 0], b: [440, 220], e: { camada: 'alvenaria', cor: '#262626', espessura: 0.9 } }],
};

function ctx(parcial: Partial<ContextoDaFolha> = {}): ContextoDaFolha {
  return {
    numero: 1,
    total: 2,
    obra: { obra: 'Muro da divisa', endereco: 'Rua A, 10', proprietario: 'Fulano', art: '123', data: '14/10/2026', revisao: 'R00' },
    escritorio: { empresa: 'Escritório X', responsavel: 'Eng. Fulano', crea: 'MG-1', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: ['Cotas em centímetros, exceto onde indicado.', 'Aço CA-50.'],
    legenda: [{ cor: '#787878', rotulo: 'Inteiro' }],
    aco: { linhas: [{ bitola: 'Ø10', comprimento: 120.5, massa: 74.3 }], total: 74.3 },
    desenhar: () => ({ tipo: 'vetor', vista }),
    ...parcial,
  };
}

const blocos = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'bloco' }> => p.k === 'bloco');

describe('folha composta', () => {
  it('A1 deitada pela norma: 841 × 594, moldura a 20/10 mm, carimbo 180 × 50 no canto inferior direito', () => {
    const f = novaFolha('Formas');
    const c = comporFolha(f, ctx());
    expect([c.largura, c.altura]).toEqual([841, 594]);
    expect(quadroUtil('A1', 'deitada')).toEqual([20, 10, 831, 584]);
    expect(c.carimbo).toEqual([831 - 180, 584 - 50, 180, 50]);
    expect(c.svg).toContain('viewBox="0 0 841 594"');
    expect(c.svg).toContain('width="841mm"');
  });

  it('o carimbo vai como bloco com os campos preenchidos (folha 01/02, escala da vista)', () => {
    const f = novaFolha('Formas: vista e corte');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Corte A' });
    const c = comporFolha(f, ctx());
    const [b] = blocos(c.primitivas);
    expect(b.nome).toBe('CARIMBO');
    const v = Object.fromEntries(b.atributos.map((a) => [a.etiqueta, a.valor]));
    expect(v.FOLHA).toBe('01/02');
    expect(v.ESCALA).toBe('1:25');
    expect(v.CONTEUDO).toBe('Formas: vista e corte');
    expect(v.OBRA).toBe('Muro da divisa — Rua A, 10 — Fulano');
    expect(v.RESPONSAVEL).toContain('CREA MG-1');
  });

  it('desenho em 1:25: 440 px de desenho viram 100 mm de papel, e o título sai embaixo com a escala', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Corte A' });
    const c = comporFolha(f, ctx());
    expect(c.itens[0].caixa[2]).toBeCloseTo(440 / PX_POR_MM, 6);
    const linha = c.primitivas.find((p) => p.k === 'linha' && p.e.camada === 'alvenaria');
    expect(linha && linha.k === 'linha' && linha.b[0]).toBeCloseTo(40 + 100, 6);
    const textos = c.primitivas.filter((p) => p.k === 'texto').map((p) => (p.k === 'texto' ? p.t : ''));
    expect(textos).toContain('CORTE A');
    expect(textos).toContain('ESC. 1:25');
  });

  it('duas escalas na folha: o carimbo diz "Indicadas"', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Corte A' });
    f.itens.push({ id: 'b', conteudo: { tipo: 'frontal' }, escala: 50, x: 300, y: 30, titulo: 'Vista' });
    const v = Object.fromEntries(blocos(comporFolha(f, ctx()).primitivas)[0].atributos.map((a) => [a.etiqueta, a.valor]));
    expect(v.ESCALA).toBe('Indicadas');
  });

  it('item sem desenho ainda (foto do 3D a caminho): marca o lugar na tela e não vai para o arquivo', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'frontal' }, escala: null, x: 40, y: 30, largura: 100, altura: 60, titulo: '3D' });
    const c = comporFolha(f, ctx({ desenhar: () => null }));
    expect(c.itens[0].pendente).toBe(true);
    expect(c.primitivas.some((p) => p.k === 'imagem')).toBe(false);
  });

  it('quadro lateral: notas, legenda e aço; num quadro baixo demais, avisa que estourou', () => {
    const f = novaFolha('');
    const c = comporFolha(f, ctx());
    const textos = c.primitivas.filter((p) => p.k === 'texto').map((p) => (p.k === 'texto' ? p.t : ''));
    expect(textos).toEqual(expect.arrayContaining(['NOTAS GERAIS', 'LEGENDA', 'RESUMO DO AÇO (CA-50)', 'Aço CA-50.']));
    expect(c.quadroEstourou).toBe(false);
    f.quadro.altura = 20;
    expect(comporFolha(f, ctx()).quadroEstourou).toBe(true);
  });

  it('A4 em pé: quadro lateral começa fechado e o carimbo ocupa a largura útil inteira', () => {
    const f = novaFolha('', 'A4', 'em_pe');
    expect(tamanhoDaFolha('A4', 'em_pe')).toEqual([210, 297]);
    expect(f.quadro.altura).toBe(0);
    const c = comporFolha(f, ctx());
    expect(c.quadro).toBeNull();
    expect(c.carimbo[0]).toBe(20);
  });
});

describe('pranchas no arquivo .alrimo', () => {
  const campos = new Map();

  it('vão e voltam iguais', () => {
    const f = novaFolha('Formas');
    f.itens.push({ id: 'a', conteudo: { tipo: 'planta', fiada: 2 }, escala: 50, x: 40, y: 30, titulo: 'Planta' });
    f.itens.push({
      id: 'b',
      conteudo: {
        tipo: '3d',
        camera: { posicao: [1, 2, 3], alvo: [0, 0, 0], cima: [0, 0, 1], ortografica: true, zoom: 2, fov: 35, estilo: 'opaco', armadura: true, corteX: 1500, ocultas: ['terreno'] },
        proporcao: 1.6,
      },
      escala: null, x: 300, y: 30, largura: 160, altura: 100, titulo: '3D',
    });
    const pranchas = { folhas: [f], obra: { ...SEM_PRANCHAS.obra, obra: 'Muro' } };
    const texto = serializarProjeto({ id: '00000000-0000-4000-8000-000000000000', titulo: 'x', alteracoes: {}, extras: {}, pranchas }, 'v');
    const a = desserializarProjeto(texto, campos, 'v');
    expect(a.ok && a.projeto.pranchas).toEqual(pranchas);
  });

  it('muro sem prancha: o arquivo não ganha o campo', () => {
    const texto = serializarProjeto({ id: '00000000-0000-4000-8000-000000000000', titulo: 'x', alteracoes: {}, extras: {}, pranchas: SEM_PRANCHAS }, 'v');
    expect(texto).not.toContain('pranchas');
    expect(temPranchas(SEM_PRANCHAS)).toBe(false);
  });

  it('item quebrado sai, o resto abre', () => {
    const p = lerPranchas({ folhas: [{ formato: 'A9', itens: [{ conteudo: { tipo: 'xyz' } }, { conteudo: { tipo: 'frontal' }, escala: 33 }] }], obra: 7 });
    expect(p.folhas).toHaveLength(1);
    expect(p.folhas[0].formato).toBe('A1');
    expect(p.folhas[0].itens).toHaveLength(1);
    expect(p.folhas[0].itens[0].escala).toBeNull();
    expect(p.obra.revisao).toBe('R00');
  });
});
