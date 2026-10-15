/*
  A folha composta e o que vai para o arquivo: tamanho pela norma, carimbo no canto inferior direito como bloco com
  os campos, desenho na escala pedida (1:25 → o px de desenho vira 1/PX_POR_MM mm), quadro lateral que avisa quando não
  cabe, e o .alrimo levando as folhas de ida e volta.
*/
import { describe, expect, it } from 'vitest';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { Prancha } from '@/desenhos/prancha';
import { novaFolha, lerPranchas, temPranchas, SEM_PRANCHAS } from '../padrao';
import { quadroUtil, tamanhoDaFolha } from '../formatos';
import { MAIUSCULA_DA_ARIAL, PX_POR_MM, type Primitiva, type VistaParaPrancha } from '../tipos';
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
    obra: { obra: 'Muro da divisa', endereco: 'Rua A, 10', proprietario: 'Fulano', art: '123', data: '14/10/2026', revisao: 'R00', codigo: 'ARR', desenhista: 'Ciclano', verificacao: 'Beltrano' },
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
  it('A1 deitada pela norma: 841 × 594, moldura a 20/10 mm, carimbo 180 × 65 no canto inferior direito', () => {
    const f = novaFolha('Formas');
    const c = comporFolha(f, ctx());
    expect([c.largura, c.altura]).toEqual([841, 594]);
    expect(quadroUtil('A1', 'deitada')).toEqual([20, 10, 831, 584]);
    expect(c.carimbo).toEqual([831 - 180, 584 - 65, 180, 65]);
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
    // cada dado num atributo próprio, inteiro (o cadista mapeia campo a campo ao trocar o carimbo)
    expect([v.OBRA, v.ENDERECO, v.PROPRIETARIO]).toEqual(['Muro da divisa', 'Rua A, 10', 'Fulano']);
    expect([v.RESPONSAVEL, v.CREA, v.ART]).toEqual(['Eng. Fulano', 'CREA MG-1', 'ART 123']);
    expect([v.DATA, v.REVISAO]).toEqual(['14/10/2026', 'R00']);
    // número do desenho = código-folha; desenhista e verificação, cada um no seu atributo (Jose, 15/10)
    expect([v.DESENHO, v.DESENHISTA, v.VERIFICACAO]).toEqual(['ARR-01', 'Ciclano', 'Beltrano']);
  });

  it('sem código, o número do desenho fica vazio, mas o atributo continua no bloco para o cadista preencher', () => {
    const c = comporFolha(novaFolha(''), ctx({ obra: { ...ctx().obra, codigo: ' ' } }));
    const v = Object.fromEntries(blocos(c.primitivas)[0].atributos.map((a) => [a.etiqueta, a.valor]));
    expect(v.DESENHO).toBe('');
  });

  it('todo texto do carimbo e do quadro lateral sai com a maiúscula de pelo menos 2,5 mm (carimbo de partida)', () => {
    const c = comporFolha(novaFolha('Formas'), ctx());
    const [b] = blocos(c.primitivas);
    const alturas = [
      ...b.prims.filter((p) => p.k === 'texto').map((p) => (p.k === 'texto' ? p.altura : 0)),
      ...b.atributos.map((a) => a.altura),
      ...c.primitivas.filter((p) => p.k === 'texto').map((p) => (p.k === 'texto' ? p.altura : 0)),
    ];
    for (const a of alturas) expect(a * MAIUSCULA_DA_ARIAL).toBeGreaterThanOrEqual(2.5 - 1e-9);
  });

  it('arquivo com o carimbo de partida antigo (180 × 50) abre com o de hoje, e o quadro lateral desce junto', () => {
    const p = lerPranchas({ folhas: [{ formato: 'A1', orientacao: 'deitada', carimbo: { largura: 180, altura: 50 }, quadro: { largura: 180, altura: 524 }, itens: [] }] });
    expect(p.folhas[0].carimbo).toEqual({ largura: 180, altura: 65 });
    expect(p.folhas[0].quadro.altura).toBe(574 - 65);
    // o regulado pelo projetista fica
    const q = lerPranchas({ folhas: [{ formato: 'A1', carimbo: { largura: 200, altura: 50 }, quadro: { largura: 180, altura: 300 }, itens: [] }] });
    expect(q.folhas[0].carimbo).toEqual({ largura: 200, altura: 50 });
    expect(q.folhas[0].quadro.altura).toBe(300);
  });

  it('desenho em 1:25: 440 px de desenho viram 440 ÷ PX_POR_MM mm de papel, e o título sai embaixo com a escala', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Corte A' });
    const c = comporFolha(f, ctx());
    expect(c.itens[0].caixa[2]).toBeCloseTo(440 / PX_POR_MM, 6);
    const linha = c.primitivas.find((p) => p.k === 'linha' && p.e.camada === 'alvenaria');
    expect(linha && linha.k === 'linha' && linha.b[0]).toBeCloseTo(40 + 440 / PX_POR_MM, 6);
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

  it('desenho por cima do carimbo ou fora da moldura: a folha marca para a tela avisar', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'ok', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'A' });
    f.itens.push({ id: 'carimbo', conteudo: { tipo: 'corte' }, escala: 25, x: 700, y: 520, titulo: 'B' });
    f.itens.push({ id: 'fora', conteudo: { tipo: 'corte' }, escala: 25, x: 10, y: 300, titulo: 'C' });
    const c = comporFolha(f, ctx());
    expect(Object.fromEntries(c.itens.map((i) => [i.id, i.invade]))).toEqual({ ok: false, carimbo: true, fora: true });
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
    expect(textos).toEqual(expect.arrayContaining(['NOTAS GERAIS', 'LEGENDA', 'RESUMO DO AÇO', 'Aço CA-50.']));
    // a massa com 10 % de perda sai da massa impressa (74,3 × 1,1 = 81,73 → 81,7), na linha e no total
    expect(textos).toEqual(expect.arrayContaining(['Massa + 10 % (kg)', '74,3', '81,7']));
    expect(textos.filter((t) => t === '81,7')).toHaveLength(2);
    expect(c.quadroEstourou).toBe(false);
    f.quadro.altura = 20;
    expect(comporFolha(f, ctx()).quadroEstourou).toBe(true);
  });

  it('desenho sem escala na folha (3D, isométrico): o carimbo diz "Indicadas"', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: 'Corte A' });
    f.itens.push({ id: 'b', conteudo: { tipo: 'iso', vista: 'frente-direita', corteX: null }, escala: null, x: 300, y: 30, largura: 100, altura: 60, titulo: '' });
    const v = Object.fromEntries(blocos(comporFolha(f, ctx()).primitivas)[0].atributos.map((a) => [a.etiqueta, a.valor]));
    expect(v.ESCALA).toBe('Indicadas');
  });

  it('quadro fechado: a vista traz a legenda das cores e a folha escreve "Cotas em centímetros" sobre o carimbo', () => {
    const f = novaFolha('', 'A4', 'deitada');
    f.itens.push({ id: 'a', conteudo: { tipo: 'frontal' }, escala: 50, x: 40, y: 30, titulo: '' });
    const pedidas: boolean[] = [];
    const c = comporFolha(f, ctx({ desenhar: (_i, _p, o) => (pedidas.push(o.legendaDeCores), { tipo: 'vetor', vista }) }));
    expect(pedidas).toEqual([true]);
    expect(c.primitivas.some((p) => p.k === 'texto' && p.t === 'Cotas em centímetros, exceto onde indicado.')).toBe(true);
    const aberta = novaFolha('');
    aberta.itens.push({ id: 'a', conteudo: { tipo: 'frontal' }, escala: 50, x: 40, y: 30, titulo: '' });
    const pedidas2: boolean[] = [];
    comporFolha(aberta, ctx({ desenhar: (_i, _p, o) => (pedidas2.push(o.legendaDeCores), { tipo: 'vetor', vista }) }));
    expect(pedidas2).toEqual([false]);
  });

  it('título em branco = automático; para o arquivo, desenho que não chegou não deixa o tracejado', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'planta', fiada: 2 }, escala: 50, x: 40, y: 30, titulo: '' });
    const c = comporFolha(f, ctx({ tituloAutomatico: () => 'Planta — 3ª fiada' }));
    expect(c.primitivas.some((p) => p.k === 'texto' && p.t === 'PLANTA — 3ª FIADA')).toBe(true);
    const saida = comporFolha(f, ctx({ desenhar: () => null, saida: true }));
    expect(saida.svg).not.toContain('stroke-dasharray="2,1.5"');
  });

  it('sem escala: manda a largura pedida, a altura sai da proporção do desenho', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'iso', vista: 'frente-direita', corteX: null }, escala: null, x: 40, y: 30, largura: 110, altura: 999, titulo: '' });
    const [, , w, h] = comporFolha(f, ctx()).itens[0].caixa;
    expect(w).toBeCloseTo(110, 6);
    expect(h).toBeCloseTo(110 * 220 / 440, 6);
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

describe('tarja do muro que não passa (Jose, 15/10)', () => {
  const tarjas = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.t === 'NÃO VERIFICADO');

  it('muro que passa: folha limpa', () => {
    expect(tarjas(comporFolha(novaFolha(''), ctx()).primitivas)).toHaveLength(0);
  });

  it('muro que não passa: NÃO VERIFICADO na diagonal da área de desenho, em camada própria, vazado no PDF', () => {
    const f = novaFolha('');
    const c = comporFolha(f, ctx({ naoVerificado: true }));
    const [t] = tarjas(c.primitivas);
    expect(t.camada).toBe('aviso');
    expect(t.cor).toBe('#c00000');
    // a área de desenho é a útil sem o quadro lateral (A1 deitada: 20..651 × 10..584); sobe da esquerda para a direita
    const [x0, y0, x1, y1] = [20, 10, 831 - f.quadro.largura, 584];
    expect(t.angulo).toBeCloseTo((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, 6);
    expect(Math.abs(t.p[0] - (x0 + x1) / 2)).toBeLessThan(t.altura);
    expect(Math.abs(t.p[1] - (y0 + y1) / 2)).toBeLessThan(t.altura);
    expect(c.svg).toMatch(/<text [^>]*fill="none" stroke="#c00000"[^>]*>NÃO VERIFICADO<\/text>/);
  });
});

describe('revisão de 15/10', () => {
  it('A4 em pé: a tarja fica acima do carimbo (centrada na área toda, o NÃO caía embaixo dele)', () => {
    const f = novaFolha('', 'A4', 'em_pe');
    const c = comporFolha(f, ctx({ naoVerificado: true }));
    const t = c.primitivas.find((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto' && p.t === 'NÃO VERIFICADO')!;
    const [, cy] = c.carimbo;
    // a palavra inteira (meia largura na diagonal) acima do carimbo
    const meia = (Prancha.largura('NÃO VERIFICADO', t.altura, true) / 2) * Math.sin((t.angulo * Math.PI) / 180);
    expect(t.p[1] + meia).toBeLessThanOrEqual(cy + 1);
  });

  it('dois desenhos encavalados acendem os dois (a vista de ontem engordou com a letra de hoje)', () => {
    const f = novaFolha('');
    f.itens.push({ id: 'a', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: '' });
    f.itens.push({ id: 'b', conteudo: { tipo: 'corte' }, escala: 25, x: 60, y: 40, titulo: '' });
    f.itens.push({ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 400, y: 300, titulo: '' });
    const c = comporFolha(f, ctx());
    expect(c.itens.map((i) => i.invade)).toEqual([true, true, false]);
  });
});
