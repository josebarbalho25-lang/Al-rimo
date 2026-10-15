/*
  A TABELA DE MATERIAIS NA PRANCHA (Jose, 15/10: "a tabela de materiais com as imagens e quantidades dos blocos hoje
  não tá indo pra prancha") — o que quebraria:
  - número da prancha diferente do quantitativo (a mesma tabela, as mesmas casas);
  - a canaleta "para cortar" contada de novo, ou escrita com o "↳" que a fonte do CAD não tem;
  - letra abaixo de 2,5 mm de maiúscula, texto passando da célula ou encavalando no vizinho;
  - a tabela pulando de tamanho quando a figura da peça chega (ela vem depois, como a foto do 3D);
  - IMAGEM no DXF (Jose, 15/10: "0 imagem vinculada"): a figura da peça é desenho — preenchimento e contorno;
  - a faixa de dentro do furo vazando pela face do bloco (o recorte do arquivo não foi feito na conta), as cotas da
    figura grande entrando na célula, ou o traço que só tapa fresta virando contorno preto no DXF;
  - a tabela entrando como "sem escala" no carimbo, ou ganhando título embaixo além do de cima.
*/
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { formatarNaTela, quantificar, tabelasDoQuantitativo } from '@/quantitativo';
import { Prancha } from '@/desenhos/prancha';
import { xmlBemFormado } from '@/desenhos/__testes__/lerSvg';
import { CONTORNO_DA_PECA, convexo, recortar, vetorDaPeca, type FiguraPronta } from '../figurasDasPecas';
import { TITULO_DA_TABELA, desenharTabela, tabelaParaFolha } from '../tabelaDaFolha';
import { criarDesenhista } from '../desenhista';
import { comporFolha, type ContextoDaFolha } from '../folha';
import { itemDaTabela } from '../acoes';
import { lerPranchas, novaFolha, OBRA_EM_BRANCO } from '../padrao';
import { LETRA_MINIMA, MAIUSCULA_DA_ARIAL, type Primitiva } from '../tipos';

const muro = (c: string, extras: Record<string, string | number> = {}) => gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6, ...extras });
const contrafortes = muro('aula123');
const balanco = muro('aula122');

const PASTA_DAS_PECAS = fileURLToPath(new URL('../../../public/pecas/', import.meta.url));

/** A figura de verdade: o arquivo do app lido do disco e convertido como o app converte (o fetch é só no navegador). */
const real = (url: string): FiguraPronta => vetorDaPeca(readFileSync(join(PASTA_DAS_PECAS, url.split('#')[0].split('/').pop()!), 'utf8'))!;

const textosDe = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'texto' }> => p.k === 'texto');
const imagensDe = (ps: Primitiva[]) => ps.filter((p): p is Extract<Primitiva, { k: 'imagem' }> => p.k === 'imagem');
/** O que é da figura da peça (camada PECAS no DXF). */
const pecasDe = (ps: Primitiva[]) => ps.filter((p) => (p.k === 'hachura' ? p.camada : p.k === 'linha' || p.k === 'polilinha' ? p.e.camada : '') === 'pecas');
const pontosDe = (p: Primitiva): [number, number][] =>
  p.k === 'hachura' ? p.aneis.flat() : p.k === 'polilinha' ? p.pts : p.k === 'linha' ? [p.a, p.b] : [];

/** Onde o texto começa e termina no papel (mm), pela âncora. */
function extensao(t: Extract<Primitiva, { k: 'texto' }>): [number, number] {
  const w = Prancha.largura(t.t, t.altura, t.negrito);
  const x0 = t.ancora === 'start' ? t.p[0] : t.ancora === 'end' ? t.p[0] - w : t.p[0] - w / 2;
  return [x0, x0 + w];
}

describe('os números da tabela são os do quantitativo', () => {
  it('blocos: as mesmas linhas, na mesma ordem e com as mesmas casas; a cortada recuada e sem o "↳"', () => {
    const q = quantificar(contrafortes);
    const tela = tabelasDoQuantitativo(q).find((t) => t.id === 'blocos')!;
    const papel = tabelaParaFolha(q, 'blocos');
    expect(papel.cabecalho).toEqual(tela.cabecalho);
    expect(papel.comFiguras).toBe(true);
    const corpo = papel.linhas.filter((l) => l.tipo === 'corpo');
    expect(corpo.map((l) => l.celulas.slice(1))).toEqual(tela.linhas.map((l) => l.slice(1).map(formatarNaTela)));
    // o muro de contrafortes do 14 corta canaleta: a linha existe, recuada, com o texto sem a marca da tela
    const recuadas = corpo.filter((l) => l.recuada);
    expect(recuadas.length).toBeGreaterThan(0);
    for (const l of recuadas) expect(l.celulas[0]).toBe('das quais, para cortar');
    expect(corpo.some((l) => l.celulas[0].includes('↳'))).toBe(false);
    // o total é o do quantitativo, e as recuadas não entram nele
    const total = papel.linhas.find((l) => l.tipo === 'total')!;
    expect(total.celulas[2]).toBe(formatarNaTela({ n: q.totalBlocos, casas: 0 }));
    const somaSemRecuadas = corpo.filter((l) => !l.recuada).reduce((s, l) => s + Number(l.celulas[2].replace(/\./g, '')), 0);
    expect(somaSemRecuadas).toBe(q.totalBlocos);
    // a figura de cada linha é a do quantitativo (o arquivo, sem o recorte)
    expect(corpo.map((l) => l.figura)).toEqual(tela.figuras!.map((f) => f?.url ?? null));
    expect(corpo.every((l) => l.figura && !l.figura.includes('#'))).toBe(true);
  });

  it('materiais: graute, argamassa e sapata numa tabela só, uma faixa para cada, com os totais de lá', () => {
    const q = quantificar(balanco);
    const papel = tabelaParaFolha(q, 'quantidades');
    const faixas = papel.linhas.filter((l) => l.tipo === 'faixa').map((l) => l.celulas[0]);
    expect(faixas).toEqual(['Graute', 'Argamassa de assentamento', 'Sapata']);
    const totais = papel.linhas.filter((l) => l.tipo === 'total').map((l) => l.celulas[1]);
    expect(totais).toEqual([formatarNaTela({ n: q.graute.total, casas: 3 }), formatarNaTela({ n: q.argamassa.total, casas: 3 })]);
    expect(papel.direita).toEqual([false, true, false]);
    expect(papel.comFiguras).toBe(false);
  });

  it('drenagem toda desligada: a tabela sai com o cabeçalho e um traço, sem número inventado', () => {
    const seco = muro('aula122', { barbaca_on: 'Não', dreno_on: 'Não', imper_on: 'Não', drenof_on: 'Não' });
    const papel = tabelaParaFolha(quantificar(seco), 'drenagem');
    expect(papel.linhas).toEqual([]);
    const v = desenharTabela(papel, 'Drenagem');
    expect(textosDe(v.primitivas).filter((t) => t.t === '—')).toHaveLength(3);
  });
});

describe('o desenho da tabela no papel', () => {
  const q = quantificar(contrafortes);
  const papel = tabelaParaFolha(q, 'blocos');
  const sem = desenharTabela(papel, TITULO_DA_TABELA.blocos);
  const com = desenharTabela(papel, TITULO_DA_TABELA.blocos, real);

  it('letra: toda maiúscula com pelo menos 2,5 mm; o título em cima, em negrito e maiúsculo', () => {
    for (const t of textosDe(com.primitivas)) expect(t.altura * MAIUSCULA_DA_ARIAL).toBeGreaterThanOrEqual(LETRA_MINIMA - 1e-9);
    const [titulo] = textosDe(com.primitivas);
    expect(titulo.t).toBe('BLOCOS E CANALETAS');
    expect(titulo.negrito).toBe(true);
    expect(Math.min(...textosDe(com.primitivas).map((t) => t.p[1]))).toBe(titulo.p[1]);
  });

  it('todo texto dentro da tabela e nenhum encavalado com o vizinho da mesma linha', () => {
    const [, , W] = com.caixa;
    const porLinha = new Map<number, [number, number][]>();
    for (const t of textosDe(com.primitivas)) {
      const [a, b] = extensao(t);
      expect(a).toBeGreaterThanOrEqual(-1e-6);
      expect(b).toBeLessThanOrEqual(W + 1e-6);
      const k = Math.round(t.p[1] * 100);
      porLinha.set(k, [...(porLinha.get(k) ?? []), [a, b]]);
    }
    for (const xs of porLinha.values()) {
      xs.sort((u, v) => u[0] - v[0]);
      for (let i = 1; i < xs.length; i++) expect(xs[i][0]).toBeGreaterThan(xs[i - 1][1]);
    }
  });

  it('a figura chega depois e a tabela não muda de tamanho; cada linha ganha a peça em DESENHO, nenhuma imagem', () => {
    expect(com.caixa).toEqual(sem.caixa);
    expect(pecasDe(sem.primitivas)).toHaveLength(0);
    expect(imagensDe(com.primitivas)).toHaveLength(0);
    expect(com.corpo).not.toMatch(/<image|data:|url\(/);
    expect(xmlBemFormado(`<svg xmlns="http://www.w3.org/2000/svg">${com.corpo}</svg>`)).toBeNull();
    // a peça de cada linha fica no lugar da figura: 1ª coluna, entre o cabeçalho e o total
    const ps = pecasDe(com.primitivas).flatMap(pontosDe);
    const ys = ps.map((p) => p[1]);
    const cabecalho = textosDe(com.primitivas).find((t) => t.t === 'Peça')!.p[1];
    const total = textosDe(com.primitivas).find((t) => t.t === 'Total')!.p[1];
    expect(Math.max(...ps.map((p) => p[0]))).toBeLessThan(12);
    expect(Math.min(...ps.map((p) => p[0]))).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeGreaterThan(cabecalho);
    expect(Math.max(...ys)).toBeLessThan(total - 2);
    const faces = pecasDe(com.primitivas).filter((p) => p.k === 'hachura' && p.borda);
    expect(faces.length).toBeGreaterThanOrEqual(3 * papel.linhas.filter((l) => l.figura).length);
  });

  it('a linha "das quais" sai recuada, com o gancho desenhado, e o número dela continua alinhado à direita', () => {
    const ts = textosDe(com.primitivas);
    const recuada = ts.find((t) => t.t === 'das quais, para cortar')!;
    const canaleta = ts.find((t) => t.t === 'Canaleta')!;
    expect(recuada.p[0] - canaleta.p[0]).toBeCloseTo(3.5, 6);
    const gancho = com.primitivas.filter((p): p is Extract<Primitiva, { k: 'linha' }> => p.k === 'linha' && [p.a[0], p.b[0]].every((x) => x > canaleta.p[0] && x < recuada.p[0]));
    expect(gancho.length).toBe(2 * papel.linhas.filter((l) => l.recuada).length);
    const numeros = ts.filter((t) => t.ancora === 'end');
    expect(new Set(numeros.map((t) => Math.round(t.p[0] * 1000))).size).toBe(1);
  });

  it('a camada é a da tabela (TABELAS no DXF), menos a figura da peça (PECAS)', () => {
    const camadas = new Set(com.primitivas.map((p) => (p.k === 'linha' || p.k === 'polilinha' ? p.e.camada : 'camada' in p ? p.camada : '')));
    expect([...camadas].sort()).toEqual(['pecas', 'tabelas']);
  });
});

describe('a figura da peça em desenho', () => {
  const arquivos = readdirSync(PASTA_DAS_PECAS).filter((a) => a.endsWith('.svg'));
  const ler = (a: string) => readFileSync(join(PASTA_DAS_PECAS, a), 'utf8');
  const bocasDe = (texto: string) =>
    [...texto.matchAll(/<clipPath\b[\s\S]*?points="([^"]+)"/g)].map((m) => m[1].trim().split(/\s+/).map((x) => x.split(',').map(Number) as [number, number]));

  it('recorte pela conta: quadrado cortado pela metade, triângulo de fora some; toda boca de furo é convexa', () => {
    const quadrado: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const faca: [number, number][] = [[5, -1], [20, -1], [20, 20], [5, 20]];
    const r = recortar(quadrado, faca);
    expect(Math.min(...r.map((p) => p[0]))).toBeCloseTo(5, 9);
    expect(Math.max(...r.map((p) => p[0]))).toBeCloseTo(10, 9);
    expect(recortar([[30, 30], [31, 30], [30, 31]], faca)).toEqual([]);
    // a faca escrita no outro sentido corta igual
    expect(recortar(quadrado, [...faca].reverse()).length).toBe(r.length);
    expect(convexo(faca)).toBe(true);
    expect(convexo([[0, 0], [10, 0], [5, 2], [10, 10], [0, 10]])).toBe(false);
    // o recorte pela conta só vale para faca convexa: toda boca de furo de toda figura é
    for (const a of arquivos) for (const b of bocasDe(ler(a))) expect(convexo(b), a).toBe(true);
  });

  it('toda figura vira desenho: só preenchimento e contorno, dentro do recorte #icone, sem cota nem fundo branco', () => {
    expect(arquivos.length).toBeGreaterThan(0);
    for (const a of arquivos) {
      const f = vetorDaPeca(ler(a));
      expect(f, a).not.toBeNull();
      const [x, y, w, h] = f!.caixa;
      expect(f!.proporcao).toBeCloseTo(w / h, 9);
      expect(f!.prims.every((p) => ['hachura', 'polilinha', 'linha'].includes(p.k)), a).toBe(true);
      for (const p of f!.prims.flatMap(pontosDe)) {
        expect(p[0], a).toBeGreaterThanOrEqual(x - 1e-6);
        expect(p[0], a).toBeLessThanOrEqual(x + w + 1e-6);
        expect(p[1], a).toBeGreaterThanOrEqual(y - 1e-6);
        expect(p[1], a).toBeLessThanOrEqual(y + h + 1e-6);
      }
      const cheios = f!.prims.filter((p): p is Extract<Primitiva, { k: 'hachura' }> => p.k === 'hachura');
      // nada branco (o fundo da figura grande) e nenhuma borda da cor do próprio preenchimento (o traço que tapa
      // fresta não é contorno: plotado em preto riscaria o furo)
      expect(cheios.some((q) => q.fundo === '#ffffff'), a).toBe(false);
      expect(cheios.some((q) => q.borda && q.borda.cor === q.fundo), a).toBe(false);
      // as faces da peça, com contorno de 0,13 mm "por camada"
      const faces = cheios.filter((q) => q.borda);
      expect(faces.length, a).toBeGreaterThanOrEqual(3);
      for (const q of faces) expect([q.borda!.espessura, q.borda!.corPropria ?? false], a).toEqual([CONTORNO_DA_PECA, false]);
      expect(pecasDe(f!.prims), a).toHaveLength(f!.prims.length);
    }
  });

  it('furo: as faixas de dentro ficam dentro da boca (recortadas), e o degradê de cima vira escurecimento', () => {
    const texto = ler('b14_inteiro.svg');
    const f = vetorDaPeca(texto)!;
    const bocas = bocasDe(texto);
    expect(bocas).toHaveLength(2);
    const dentroDeAlguma = (p: [number, number]) => bocas.some((b) => {
      const xs = b.map((q) => q[0]), ys = b.map((q) => q[1]);
      return p[0] >= Math.min(...xs) - 1e-6 && p[0] <= Math.max(...xs) + 1e-6 && p[1] >= Math.min(...ys) - 1e-6 && p[1] <= Math.max(...ys) + 1e-6;
    });
    const internas = f.prims.filter((p): p is Extract<Primitiva, { k: 'hachura' }> => p.k === 'hachura' && !p.borda);
    expect(internas.length).toBeGreaterThan(10);
    for (const q of internas) for (const p of q.aneis[0]) expect(dentroDeAlguma(p)).toBe(true);
    // o fundo do furo (#242424) escurecido pela média do degradê (0 e 38 % → 19 %)
    expect(internas.some((q) => q.fundo === '#1d1d1d')).toBe(true);
    expect(internas.some((q) => q.fundo === '#242424')).toBe(false);
    // canaleta: a parede de dentro, sem recorte, escurecida pelo degradê com 45 % de opacidade (19 % × 0,45)
    const can = vetorDaPeca(ler('b14_canaleta.svg'))!;
    const fundos = can.prims.flatMap((p) => (p.k === 'hachura' ? [p.fundo] : []));
    expect(fundos).not.toContain('#e0e071');
    expect(fundos).toContain('#cdcd67');
  });

  it('canaleta cortada: a parte que sai vai tracejada, em cinza próprio (o cinza é informação)', () => {
    const f = vetorDaPeca(ler('b19_canaleta_cortada.svg'))!;
    const tracejadas = f.prims.flatMap((p) => (p.k === 'linha' || p.k === 'polilinha') && p.e.tracejado ? [p.e] : []);
    expect(tracejadas.length).toBeGreaterThan(0);
    for (const e of tracejadas) expect([e.cor, e.corPropria]).toEqual(['#a6a6a6', true]);
    expect(vetorDaPeca('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull();
  });
});

describe('a tabela na folha', () => {
  const ctx = (desenhar: ContextoDaFolha['desenhar'], parcial: Partial<ContextoDaFolha> = {}): ContextoDaFolha => ({
    numero: 1, total: 1, obra: OBRA_EM_BRANCO,
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 },
    desenhar, ...parcial,
  });

  it('o desenhista busca cada figura uma vez, a folha se recompõe quando ela chega, e o arquivo espera por ela', async () => {
    const pedidas: string[] = [];
    const aoMudar = vi.fn();
    const d = criarDesenhista(contrafortes, aoMudar, async (url) => {
      pedidas.push(url);
      return real(url);
    });
    const f = novaFolha('Materiais');
    const item = itemDaTabela(f, 'blocos');
    const primeira = d.desenhar(item, 'p');
    expect(primeira?.tipo).toBe('papel');
    if (primeira?.tipo !== 'papel') return;
    expect(pecasDe(primeira.vista.primitivas)).toHaveLength(0);
    d.desenhar(item, 'p');   // a segunda passada não pede de novo
    const distintas = new Set(tabelaParaFolha(quantificar(contrafortes), 'blocos').linhas.map((l) => l.figura).filter(Boolean));
    expect(pedidas.sort()).toEqual([...distintas].sort());
    await d.esperarFotos();
    expect(aoMudar).toHaveBeenCalled();
    const depois = d.desenhar(item, 'p');
    if (depois?.tipo !== 'papel') throw new Error('sem desenho');
    expect(pecasDe(depois.vista.primitivas).length).toBeGreaterThan(0);
    expect(imagensDe(depois.vista.primitivas)).toHaveLength(0);
    expect(depois.vista.caixa).toEqual(primeira.vista.caixa);
    expect(d.tituloAutomatico(item)).toBe('Blocos e canaletas');
  });

  it('muro novo (desenhista novo a cada tecla): a figura que já chegou vale na hora — a tabela não pisca sem as peças', () => {
    const prontas = new Map<string, FiguraPronta>();
    const carregar = Object.assign(async (url: string) => real(url), { pronta: (url: string) => prontas.get(url) ?? null });
    for (const l of tabelaParaFolha(quantificar(balanco), 'blocos').linhas) if (l.figura) prontas.set(l.figura, real(l.figura));
    const pedidas = vi.fn(carregar);
    const d = criarDesenhista(balanco, () => {}, Object.assign(pedidas, { pronta: carregar.pronta }));
    const v = d.desenhar(itemDaTabela(novaFolha(''), 'blocos'), 'p');
    if (v?.tipo !== 'papel') throw new Error('sem desenho');
    // inteiro, meio, canaleta e meia canaleta do 19: as quatro com as faces contornadas
    expect(pecasDe(v.vista.primitivas).filter((p) => p.k === 'hachura' && p.borda).length).toBeGreaterThanOrEqual(12);
    expect(pedidas).not.toHaveBeenCalled();
  });

  it('figura que não chega: a tabela sai igual, com o lugar vazio, e o arquivo não fica esperando para sempre', async () => {
    const d = criarDesenhista(balanco, () => {}, () => Promise.reject(new Error('sem rede')));
    const item = itemDaTabela(novaFolha(''), 'blocos');
    d.desenhar(item, 'p');
    await d.esperarFotos();
    const v = d.desenhar(item, 'p');
    expect(v?.tipo).toBe('papel');
    if (v?.tipo === 'papel') expect(pecasDe(v.vista.primitivas)).toHaveLength(0);
  });

  it('na folha: tamanho em mm como desenhada (sem escala), título só em cima, e o carimbo segue com a escala do corte', () => {
    const d = criarDesenhista(contrafortes, () => {}, async (url) => real(url));
    const f = novaFolha('Formas e materiais');
    f.itens.push({ id: 'c', conteudo: { tipo: 'corte' }, escala: 25, x: 40, y: 30, titulo: '' });
    const t = { ...itemDaTabela(f, 'blocos'), id: 't', x: 400, y: 40 };
    f.itens.push(t);
    const composta = comporFolha(f, ctx((item, prefixo, o) => d.desenhar(item, prefixo, o)));
    const posto = composta.itens.find((i) => i.id === 't')!;
    const v = d.desenhar(t, 'x');
    if (v?.tipo !== 'papel') throw new Error('sem desenho');
    expect(posto.caixa).toEqual([400, 40, v.vista.caixa[2], v.vista.caixa[3]]);
    expect(posto.titulo).toBeNull();
    const ts = textosDe(composta.primitivas);
    expect(ts.filter((x) => x.t === 'BLOCOS E CANALETAS')).toHaveLength(1);
    expect(ts.some((x) => x.t.startsWith('ESC.') && x.p[0] >= 400)).toBe(false);
    const carimbo = composta.primitivas.find((p): p is Extract<Primitiva, { k: 'bloco' }> => p.k === 'bloco')!;
    expect(carimbo.atributos.find((a) => a.etiqueta === 'ESCALA')!.valor).toBe('1:25');
    // o título escrito pelo projetista troca o de cima
    const renomeada = comporFolha({ ...f, itens: [f.itens[0], { ...t, titulo: 'Blocos do muro' }] }, ctx((item, prefixo, o) => d.desenhar(item, prefixo, o)));
    expect(textosDe(renomeada.primitivas).some((x) => x.t === 'BLOCOS DO MURO')).toBe(true);
  });

  it('a tabela sobre o carimbo acende o aviso, como qualquer desenho', () => {
    const d = criarDesenhista(balanco, () => {}, async (url) => real(url));
    const f = novaFolha('');
    f.itens.push({ ...itemDaTabela(f, 'blocos'), id: 't', x: 700, y: 540 });
    const composta = comporFolha(f, ctx((item, prefixo, o) => d.desenhar(item, prefixo, o)));
    expect(composta.itens[0].invade).toBe(true);
  });

  it('vai e volta no arquivo .alrimo, sem escala', () => {
    const f = novaFolha('');
    f.itens.push(itemDaTabela(f, 'quantidades'));
    const lido = lerPranchas(JSON.parse(JSON.stringify({ folhas: [f], obra: OBRA_EM_BRANCO })));
    expect(lido.folhas[0].itens[0].conteudo).toEqual({ tipo: 'tabela', id: 'quantidades' });
    expect(lido.folhas[0].itens[0].escala).toBeNull();
  });
});
