/*
  Testes do quantitativo. Os números esperados saem de conta à mão sobre o modelo de modeloDeTeste.ts — cada
  um com a conta escrita ao lado, para quem for conferir não precisar abrir o código.
*/
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado, Valor } from '@/motor/tipos';
import {
  conferirGeometrias, csvDoQuantitativo, massaLinear, quantificar, tabelasDoQuantitativo, formatarNaTela,
  blocosParaCompra, type LinhaDeBloco, type LinhaDeCompra,
} from '@/quantitativo';
import { Quantitativo } from '@/quantitativo/Quantitativo';
import { areaDaFolha, caixaDaPeca } from './geometria';
import { modeloAMao } from './modeloDeTeste';

const PERTO = 9;   // casas para comparar m³/m² vindos de mm (tolerância de ponto flutuante)

describe('massa nominal (NBR 7480)', () => {
  it.each([
    [6.3, 0.245], [8, 0.395], [10, 0.617], [12.5, 0.963], [16, 1.578], [20, 2.466],
    [5, 0.154], [25, 3.853], [32, 6.313],
  ])('Ø%s → %s kg/m', (phi, kg) => {
    expect(massaLinear(phi)).toBe(kg);
  });

  it('bitola fora da tabela sai de área × 7850 kg/m³, 3 casas', () => {
    expect(massaLinear(9.5)).toBe(0.556);        // π·9,5²/4 = 70,88 mm² × 7,85e-3 = 0,5564
  });
});

describe('caixa da peça (convenção: origem = canto mínimo da caixa já girada)', () => {
  it('bloco deitado em Y (giro 90) troca as medidas em planta', () => {
    const m = modeloAMao();
    const p = m.pecas.find((x) => x.id === 'T1.CF1.f00.p00')!;
    expect(caixaDaPeca(p, m.geometrias[p.geometria])).toEqual({ x0: 0, x1: 190, y0: 200, y1: 590, z0: 10, z1: 200 });
  });
  it('barbacã (extrudado em X, girado 90°: atravessa o muro em Y)', () => {
    const m = modeloAMao();
    const p = m.pecas.find((x) => x.id === 'DRN.B1')!;
    expect(caixaDaPeca(p, m.geometrias[p.geometria])).toEqual({ x0: 275, x1: 325, y0: 0, y1: 190, z0: 75, z1: 125 });
  });
  it('canaleta (eixo X, perfil em YZ)', () => {
    const m = modeloAMao();
    const p = m.pecas.find((x) => x.id === 'T1.M.f02.p001')!;
    expect(caixaDaPeca(p, m.geometrias[p.geometria])).toEqual({ x0: 400, x1: 790, y0: 0, y1: 190, z0: 410, z1: 600 });
  });
});

describe('quantificar — modelo à mão', () => {
  const q = quantificar(modeloAMao());

  it('blocos por catálogo e tipo; terreno fora', () => {
    // inteiros: 2 (fiada 0) + 1 haste + 1 (fiada 1) = 4; meios 2; canaletas 2
    expect(q.blocos.map((l) => [l.rotulo, l.catalogo, l.quantidade])).toEqual([
      ['Bloco inteiro', '19x19x39', 4],
      ['Meio bloco', '19x19x19', 2],
      ['Canaleta', 'canaleta 19x19x39', 2],
    ]);
    expect(q.totalBlocos).toBe(8);
  });

  it('graute = furos + canaletas', () => {
    expect(q.graute.furos).toBeCloseTo(4 * 140 * 120 * 200 / 1e9, PERTO);      // 0,013 44
    expect(q.graute.canaletas).toBeCloseTo(120 * 170 * 790 / 1e9, PERTO);      // 0,016 116
    expect(q.graute.total).toBeCloseTo(0.029556, PERTO);
  });

  it('argamassa: juntas horizontais pela área líquida', () => {
    // fiada 0: 3 inteiros × 40 500; fiada 1: 2 meios × 21 700 + 1 inteiro × 40 500;
    // fiada 2: 2 canaletas sobre blocos → 390·190 × (40 500/74 100) = 40 500 cada. Tudo × 10 mm.
    const h = (3 * 40500 + (2 * 21700 + 40500) + 2 * 40500) * 10;
    expect(h).toBe(2_864_000);
    expect(q.argamassa.horizontal).toBeCloseTo(h / 1e9, PERTO);
  });

  it('argamassa: juntas verticais pelas peças vizinhas a 10 mm', () => {
    // fiada 0: inteiro|inteiro (190×190) + muro|haste em Y (190×190); fiada 1: 2 juntas 190×190;
    // fiada 2: canaleta|canaleta → só o U (15 700 mm²). Tudo × 10 mm.
    const v = (4 * 190 * 190 + 15700) * 10;
    expect(v).toBe(1_601_000);
    expect(q.argamassa.vertical).toBeCloseTo(v / 1e9, PERTO);
    expect(q.argamassa.total).toBeCloseTo((2_864_000 + 1_601_000) / 1e9, PERTO);
  });

  it('sapata: concreto e fôrma (dente contra o solo)', () => {
    expect(q.sapata.concreto).toBeCloseTo(545000 * 790 / 1e9, PERTO);           // 0,430 55
    // faces do pé e da borda aterrada: 2 × 300 × 790; topos: 2 × (1400 × 300), sem o dente
    expect(q.sapata.forma).toBeCloseTo((2 * 300 * 790 + 2 * 1400 * 300) / 1e6, PERTO);   // 1,314
  });

  it('drenagem e impermeabilização', () => {
    expect(q.drenagem.barbacas).toBe(2);
    expect(q.drenagem.tubo).toBeCloseTo(0.38, PERTO);                           // 2 × 190 mm
    expect(q.drenagem.brita).toBeCloseTo(198 * 248 * 790 / 1e9, PERTO);         // 0,038 79
    // manta em L de 2 mm: linha média = (250 − 1) + (200 − 1) = 448 mm, × 790
    expect(q.drenagem.manta).toBeCloseTo(448 * 790 / 1e6, PERTO);               // 0,353 92
    // tardoz 790 × 550 + 2 faces da haste (590 − 190 = 400) × 550
    expect(q.drenagem.impermeabilizacao).toBeCloseTo((790 * 550 + 2 * 400 * 550) / 1e6, PERTO);   // 0,8745
  });

  it('lista de ferros: C. unit. ao cm, C. total = Q × C, massa = C. total × kg/m', () => {
    expect(q.ferros.map((f) => [f.posicao, f.diametro, f.quantidade, f.comprimentoUnit])).toEqual([
      ['N1', 10, 3, 57], ['N2', 10, 3, 81], ['N3', 6.3, 2, 120], ['N4', 12.5, 4, 132],
      ['N5', 8, 5, 73], ['N6', 20, 1, 150], ['N10', 16, 2, 100],
    ]);
    const n2 = q.ferros.find((f) => f.posicao === 'N2')!;
    expect(n2.comprimentoTotal).toBeCloseTo(2.43, 12);                          // 3 × 81 cm
    expect(n2.massa).toBeCloseTo(2.43 * 0.617, 12);
  });

  it('resumo por Ø e total', () => {
    expect(q.resumoAco.map((r) => [r.diametro, +r.comprimento.toFixed(2)])).toEqual([
      [6.3, 2.4], [8, 3.65], [10, 4.14], [12.5, 5.28], [16, 2], [20, 1.5],
    ]);
    const esperado = 2.4 * 0.245 + 3.65 * 0.395 + 4.14 * 0.617 + 5.28 * 0.963 + 2 * 1.578 + 1.5 * 2.466;
    expect(esperado).toBeCloseTo(16.52377, 9);
    expect(q.massaAco).toBeCloseTo(esperado, 9);
    expect(q.massaAco).toBeCloseTo(q.ferros.reduce((s, f) => s + f.massa, 0), 9);
  });

  it('sem aviso no modelo coerente', () => {
    expect(q.avisos).toEqual([]);
    expect(conferirGeometrias(modeloAMao())).toEqual([]);
  });
});

describe('quantificar — variações', () => {
  it('impermeabilização desligada nas entradas do modelo (Modelo.extras)', () => {
    const m = modeloAMao();
    m.extras = { imper_on: 'Não' };
    const q = quantificar(m);
    expect(q.drenagem.impermeabilizacao).toBeNull();
    const dren = tabelasDoQuantitativo(q).find((t) => t.id === 'drenagem')!;
    expect(dren.linhas.map((l) => l[0])).not.toContain('Impermeabilização do tardoz');
  });

  it('sem drenagem nenhuma a tabela some', () => {
    const m = modeloAMao();
    m.pecas = m.pecas.filter((p) => p.grupo !== 'drenagem');
    m.extras = { imper_on: 'Não' };
    const q = quantificar(m);
    expect(tabelasDoQuantitativo(q).some((t) => t.id === 'drenagem')).toBe(false);
  });

  it('sem `extras` no Modelo vale o padrão de fábrica (impermeabilização ligada)', () => {
    const m = modeloAMao();
    delete m.extras;
    expect(quantificar(m).drenagem.impermeabilizacao).not.toBeNull();
    m.extras = { imper_on: 'Sim' };
    expect(quantificar(m).drenagem.impermeabilizacao).toBeCloseTo(0.8745, PERTO);
  });

  it('tardoz: haste que encara outra haste na junta de controle não leva impermeabilização nessa face', () => {
    const m = modeloAMao();
    // segundo contraforte encostado, haste em X [200, 390] — a 10 mm da primeira (X [0, 190])
    m.pecas.push({ id: 'T2.CF2.f00.p00', tipo: 'BLOCO', grupo: 'contraforte', geometria: 'bloco 19x19x39', origem: [200, 200, 10], giro: 90, trecho: 2, fiada: 0, contraforte: 2 });
    m.dims.contrafortes.push({ x: 295, trecho: 2, ponta: true });
    // 790 × 550 + 2 hastes × 1 face livre × 400 × 550
    expect(quantificar(m).drenagem.impermeabilizacao).toBeCloseTo((790 * 550 + 2 * 400 * 550) / 1e6, PERTO);
  });

  it('avisos da modulação que mudam quantidade vêm junto; os outros ficam na barra de estado', () => {
    const m = modeloAMao();
    m.avisos = [
      { codigo: 'TORCAO_LONGITUDINAL', texto: 'Armadura longitudinal de torção da sapata não desenhada' },
      { codigo: 'COBRIMENTO_GRAUTE', texto: 'Graute entre barra e bloco < 15 mm' },
    ];
    expect(quantificar(m).avisos).toEqual(['Armadura longitudinal de torção da sapata não desenhada']);
  });

  it('avisos novos da modulação dos gabaritos (estribo com ramos a menos, balanço) também vêm', () => {
    const m = modeloAMao();
    m.avisos = [
      { codigo: 'ESTRIBO_RAMOS', texto: 'Estribo do contraforte com 4 ramos: desenhado fechado, 2 ramos' },
      { codigo: 'BALANCO_ALEM_DO_CF', texto: 'Balanço além do contraforte de ponta não desenhado' },
      { codigo: 'CANALETA_SEM_ESPACAMENTO', texto: 'Canaletas intermediárias: só a cinta do topo' },
      // a perna do U mais curta que o ℓb é aviso de projeto: a quantidade é a desenhada
      { codigo: 'CANALETA_U_PERNA', texto: 'Barra em U da canaleta: perna reta no contraforte de 40,3 cm, menor que o ℓb no graute (55 cm)' },
      { codigo: 'D_GEOMETRICO_CF', texto: 'Contraforte: barra a 10 cm da face' },
    ];
    expect(quantificar(m).avisos).toEqual(m.avisos.slice(0, 3).map((a) => a.texto));
  });

  it('canaleta sobre canaleta: a junta horizontal é só a das duas paredes do U de baixo (o miolo é graute)', () => {
    const m = modeloAMao();
    m.pecas.push(
      { id: 'T1.M.f03.p000', tipo: 'CANALETA', grupo: 'muro', geometria: 'canaleta 19x19x39', origem: [0, 0, 610], giro: 0, trecho: 1, fiada: 3 },
      { id: 'T1.M.f03.p001', tipo: 'CANALETA', grupo: 'muro', geometria: 'canaleta 19x19x39', origem: [400, 0, 610], giro: 0, trecho: 1, fiada: 3 },
    );
    // U de baixo: paredes 35 + 35 = 70 de 190 → 390 × 70 × 10 por canaleta; as de baixo (fiada 2) seguem sobre blocos
    expect(quantificar(m).argamassa.horizontal).toBeCloseTo((2_864_000 + 2 * 390 * 70 * 10) / 1e9, PERTO);
  });

  it('muro todo em canaleta (sem bloco inteiro): 1ª fiada na área toda (sapata), as de cima nas paredes do U', () => {
    const m = modeloAMao();
    m.pecas = m.pecas.filter((p) => p.tipo !== 'BLOCO' && p.tipo !== 'MEIO_BLOCO' && p.tipo !== 'CANALETA');
    for (const f of [0, 1]) {
      for (const x of [0, 400]) {
        m.pecas.push({ id: `T1.M.f0${f}.${x}`, tipo: 'CANALETA', grupo: 'muro', geometria: 'canaleta 19x19x39', origem: [x, 0, 10 + 200 * f], giro: 0, trecho: 1, fiada: f });
      }
    }
    // antes: razão 1 nas duas fiadas (não havia bloco inteiro de onde tirar a razão) → 2 × 2 × 390 × 190 × 10
    expect(quantificar(m).argamassa.horizontal).toBeCloseTo((2 * 390 * 190 * 10 + 2 * 390 * 70 * 10) / 1e9, PERTO);
  });

  it('lista de ferros: o U da canaleta entre contrafortes não se confunde com a corrida reta', () => {
    const m = modeloAMao();
    m.barras.push({ id: 'T1.H.f02.U01', posicao: 'N11', papel: 'HORIZ', diametro: 10, comprimento: 2500, trecho: 1,
      eixo: [[100, 560, 470], [100, 125, 470], [130, 95, 470], [1490, 95, 470], [1520, 125, 470], [1520, 560, 470]] });
    const tab = tabelasDoQuantitativo(quantificar(m)).find((t) => t.id === 'ferros')!;
    expect(tab.linhas.find((l) => l[0] === 'N10')![1]).toBe('Horizontal na canaleta');
    expect(tab.linhas.find((l) => l[0] === 'N11')![1]).toBe('Horizontal na canaleta (U)');
  });

  it('junta de controle: peças de trechos diferentes a 10 mm não levam argamassa', () => {
    const m = modeloAMao();
    m.pecas.push({ id: 'T2.M.f00.p000', tipo: 'BLOCO', grupo: 'muro', geometria: 'bloco 19x19x39', origem: [800, 0, 10], giro: 0, trecho: 2, fiada: 0 });
    const q = quantificar(m);
    expect(q.argamassa.vertical).toBeCloseTo(1_601_000 / 1e9, PERTO);
    expect(q.argamassa.horizontal).toBeCloseTo((2_864_000 + 405_000) / 1e9, PERTO);
  });

  it('peça sem `fiada` é agrupada pela cota', () => {
    const m = modeloAMao();
    for (const p of m.pecas) delete p.fiada;
    expect(quantificar(m).argamassa.vertical).toBeCloseTo(1_601_000 / 1e9, PERTO);
  });

  it('graute só pelos furos marcados quando não há peça de graute de furo', () => {
    const m = modeloAMao();
    m.pecas = m.pecas.filter((p) => p.tipo !== 'GRAUTE_FURO');
    m.pecas[0].furosGrauteados = [0, 1];
    expect(quantificar(m).graute.furos).toBeCloseTo(2 * 140 * 120 * 200 / 1e9, PERTO);
  });

  it('com peça de graute, `furosGrauteados` não conta de novo', () => {
    const m = modeloAMao();
    m.pecas[0].furosGrauteados = [0, 1];
    expect(quantificar(m).graute.furos).toBeCloseTo(4 * 140 * 120 * 200 / 1e9, PERTO);
  });

  it('manta desenhada como folha (perfil = a folha, extrudada pela espessura)', () => {
    const folha = { chave: 'f', eixo: 'Y' as const, extensao: 2, perfil: { contorno: [[0, 0], [790, 0], [790, 250], [0, 250]] as [number, number][] }, volume_mm3: 395_000 };
    expect(areaDaFolha(folha)).toBeCloseTo(790 * 250, 6);
  });

  it('manta em U (tira fina em volta do dreno): linha média × extensão', () => {
    // U de 2 mm: base 200 (y) + 2 pernas de 250 (z), por fora → linha média ≈ 200 + 2·250 − cantos
    const u = { chave: 'u', eixo: 'X' as const, extensao: 1000, volume_mm3: 0,
      perfil: { contorno: [[0, 0], [204, 0], [204, 252], [202, 252], [202, 2], [2, 2], [2, 252], [0, 252]] as [number, number][] } };
    expect(areaDaFolha(u) / 1000).toBeGreaterThan(700);
    expect(areaDaFolha(u) / 1000).toBeLessThan(706);
  });

  it('posição com barras diferentes: uma linha por variante e aviso', () => {
    const m = modeloAMao();
    m.barras.push({ id: 'N1.x', posicao: 'N1', papel: 'VERT_MURO', diametro: 10, comprimento: 600, eixo: [], trecho: 1 });
    const q = quantificar(m);
    expect(q.ferros.filter((f) => f.posicao === 'N1').map((f) => [f.quantidade, f.comprimentoUnit])).toEqual([[3, 57], [1, 60]]);
    expect(q.avisos).toEqual(['N1: barras diferentes na mesma posição']);
  });

  it('família 14 provisória avisa quando há contraforte', () => {
    const m = modeloAMao();
    m.familia = { ...m.familia, nome: '14x39', provisoria: true };
    expect(quantificar(m).avisos).toEqual(['Peças do contraforte provisórias (família 14x39)']);
    m.pecas = m.pecas.filter((p) => p.grupo !== 'contraforte');
    expect(quantificar(m).avisos).toEqual([]);
  });

  it('conferirGeometrias pega volume que não bate com o perfil', () => {
    const m = modeloAMao();
    m.geometrias['meio 19x19x19'].volume_mm3 = 36100 * 190;   // esqueceu o furo
    expect(conferirGeometrias(m)).toHaveLength(1);
  });

  it('sapata em dois pedaços emendados: o topo do meio não leva fôrma', () => {
    const m = modeloAMao();
    m.geometrias['sapata'].extensao = 395;
    m.pecas.push({ id: 'SAP.T1b', tipo: 'SAPATA', grupo: 'fundacao', geometria: 'sapata', origem: [395, -800, -800], giro: 0, trecho: 1 });
    expect(quantificar(m).sapata.forma).toBeCloseTo((2 * 300 * 790 + 2 * 1400 * 300) / 1e6, PERTO);
  });
});

describe('CSV para o Excel pt-BR', () => {
  const csv = csvDoQuantitativo(quantificar(modeloAMao()));
  const linhas = csv.slice(1).split('\r\n');

  it('BOM, CRLF e ponto-e-vírgula', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1).replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('vírgula decimal, sem ponto em número', () => {
    expect(linhas).toContain('N1;Vertical do muro;10;3;57;1,71;1,06');
    expect(linhas).toContain('N3;Contraforte · estribo;6,3;2;120;2,40;0,59');
    expect(linhas).toContain('Total;;;16,52');
    expect(linhas).toContain('Fôrma;1,31;m²');
    for (const l of linhas) for (const campo of l.split(';')) expect(campo).not.toMatch(/^\d+\.\d+$/);
  });

  it('cada tabela: título, cabeçalho, linhas; separadas por linha em branco', () => {
    const i = linhas.indexOf('Lista de ferros');
    expect(linhas[i - 1]).toBe('');
    expect(linhas[i + 1]).toBe('N;Elemento;Ø (mm);Quant. (un);C. unit. (cm);C. total (m);Massa (kg)');
  });

  it('texto com ponto-e-vírgula vai entre aspas', () => {
    const m = modeloAMao();
    m.geometrias['meio 19x19x19'].catalogo = 'meio; especial "A"';
    expect(csvDoQuantitativo(quantificar(m))).toContain('Meio bloco;"meio; especial ""A""";2');
  });
});

describe('tela', () => {
  it('formata em pt-BR com milhar', () => {
    expect(formatarNaTela({ n: 1234.5, casas: 2 })).toBe('1.234,50');
    expect(formatarNaTela({ n: -0.0001, casas: 3 })).toBe('0,000');
  });

  it('o painel monta as tabelas e o botão do CSV', () => {
    const html = renderToString(<Quantitativo modelo={modeloAMao()} />);
    expect(html).toContain('Exportar CSV');
    for (const t of ['Blocos e canaletas', 'Graute', 'Argamassa de assentamento', 'Lista de ferros', 'Resumo do aço', 'Sapata', 'Drenagem']) {
      expect(html).toContain(t);
    }
    expect(html).toContain('16,52');
  });
});

/*
  Integração com a modulação (frente MOD): liga sozinho quando `modulacao/index.ts` existir. Confere só
  invariantes do quantitativo sobre o muro de verdade — as contagens da modulação são teste da MOD.
*/
const modulacao = import.meta.glob<{
  gerarModelo: (r: Resultado, extras: Record<string, Valor>) => Modelo;
  padroesDoModelo: () => Record<string, Valor>;
}>('../modulacao/index.ts');

describe('com a modulação de verdade', () => {
  const carregar = modulacao['../modulacao/index.ts'];

  async function gerar(cenario: string): Promise<{ m: Modelo; r: Resultado } | string> {
    try {
      const { gerarModelo, padroesDoModelo } = await carregar!();
      const { resultadoDoGabarito } = await import('@/motor/resultadoDoGabarito');
      const r = resultadoDoGabarito(cenario);
      return { m: gerarModelo(r, padroesDoModelo()), r };
    } catch (e) {
      return `modulação ainda não gera este cenário: ${(e as Error).message}`;
    }
  }

  it.skipIf(!carregar).for(['aula122', 'aula123', 'sorteio00', 'sorteio07', 'sorteio13'])('%s: invariantes', async (cenario, ctx) => {
    const g = await gerar(cenario);
    if (typeof g === 'string') return ctx.skip(g);
    const { m } = g;
    const q = quantificar(m);
    const alvenaria = m.pecas.filter((p) => ['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA'].includes(p.tipo));
    expect(q.totalBlocos).toBe(alvenaria.length);
    expect(q.totalBlocos).toBeGreaterThan(0);
    expect(q.blocos.reduce((s, l) => s + l.quantidade, 0)).toBe(q.totalBlocos);
    expect(q.massaAco).toBeCloseTo(q.resumoAco.reduce((s, r) => s + r.massa, 0), 9);
    expect(q.ferros.reduce((s, f) => s + f.quantidade, 0)).toBe(m.barras.length);
    // aço por conta independente: Σ comprimento × kg/m, sem o arredondamento ao cm da lista de ferros
    // (cada barra pode mudar até 0,5 cm)
    const kgSemArredondar = m.barras.reduce((s, b) => s + (b.comprimento / 1000) * massaLinear(b.diametro), 0);
    const folga = m.barras.reduce((s, b) => s + 0.005 * massaLinear(b.diametro), 0);
    expect(Math.abs(q.massaAco - kgSemArredondar)).toBeLessThanOrEqual(folga + 1e-9);
    expect(q.argamassa.horizontal).toBeGreaterThan(0);
    expect(q.argamassa.vertical).toBeGreaterThan(0);
    expect(q.sapata.concreto).toBeGreaterThan(0);
    const csv = csvDoQuantitativo(q);
    expect(csv).not.toMatch(/NaN|Infinity|undefined/);
    expect(conferirGeometrias(m)).toEqual([]);
  });

  // A caixa da peça é conta do quantitativo (geometria.ts) e da modulação (perfis.ts): tem de ser a mesma, senão a
  // junta vertical e a haste do contraforte são medidas num muro diferente do que o 3D mostra.
  it.skipIf(!carregar)('todos os cenários do gabarito: geometria no contrato, caixas iguais às da modulação, CSV limpo', async (ctx) => {
    const { cenariosDoGabarito } = await import('@/motor/resultadoDoGabarito');
    const { caixaGlobal } = await import('@/modulacao/perfis');
    const cenarios = cenariosDoGabarito();
    if (!cenarios.length) return ctx.skip('sem gabarito');
    for (const c of cenarios) {
      const g = await gerar(c);
      expect(typeof g, `${c}: ${g}`).toBe('object');
      if (typeof g === 'string') continue;
      const q = quantificar(g.m);
      expect(conferirGeometrias(g.m), c).toEqual([]);
      expect(csvDoQuantitativo(q), c).not.toMatch(/NaN|Infinity|undefined/);
      expect(q.blocos.reduce((s, l) => s + l.quantidade, 0), c).toBe(q.totalBlocos);
      for (const p of g.m.pecas) {
        const geo = g.m.geometrias[p.geometria];
        const a = caixaDaPeca(p, geo);
        const b = caixaGlobal(p, geo);
        const dif = Math.max(...[a.x0 - b.min[0], a.y0 - b.min[1], a.z0 - b.min[2], a.x1 - b.max[0], a.y1 - b.max[1], a.z1 - b.max[2]].map(Math.abs));
        expect(dif, `${c} ${p.id}`).toBeLessThan(1e-6);
      }
    }
    // os 63 cenários num teste só: sozinho leva segundos, mas com a máquina ocupada (servidor subindo, Excel do
    // gabarito) passava do prazo padrão e caía como falha sem ser (13/10)
  }, 120_000);

  // Graute pelo CATÁLOGO do Revit do Jose (volume da família → área dos furos e do U), não pelas geometrias do Modelo:
  // pega furo do 34/54 trocado, a cortada da 19 com o fundo da inteira, e junta de canaleta contada duas vezes.
  it.skipIf(!carregar)('contrafortes 14x39 (34/54) e 19x39 com junta: graute dos furos e das canaletas pelo catálogo', async (ctx) => {
    const { gerarModelo, padroesDoModelo } = await carregar!();
    const { resultadoDoGabarito } = await import('@/motor/resultadoDoGabarito');
    // família → largura, U da canaleta (inteira e cortada, mm²) e, por comprimento de bloco: parede, furos ao longo da
    // peça (de, até) e volume do Revit (mm³)
    const CAT: Record<string, { t: number; U: number; Ucortada: number; fundo: number; fundoCortada: number; blocos: Record<number, [number, [number, number][], number]> }> = {
      '14x39': { t: 140, U: 5116e3 / 390, Ucortada: 5116e3 / 390, fundo: 39.1, fundoCortada: 39.1,
        blocos: { 390: [32, [[25, 182.5], [207.5, 365]], 5883e3], 190: [25, [[25, 165]], 2690e3], 340: [32, [[32, 108], [175, 315]], 5975e3], 540: [32, [[25, 175], [232, 308], [375, 515]], 9152e3] } },
      '19x39': { t: 190, U: 5333e3 / 390, Ucortada: 2864e3 / 190, fundo: 29.1, fundoCortada: 39.1,
        blocos: { 390: [32, [[35, 177.5], [212.5, 355]], 7288.9e3], 190: [25, [[25, 165]], 3165.3e3] } },
    };
    const PAREDE_U = 25;
    for (const [cenario, extras] of [['aula123', {}], ['sorteio17', { L_total: 12, junta_cada: 6 }]] as const) {
      let m: Modelo;
      try {
        m = gerarModelo(resultadoDoGabarito(cenario), { ...padroesDoModelo(), ...extras });
      } catch (e) {
        return ctx.skip(`modulação ainda não gera este cenário: ${(e as Error).message}`);
      }
      const c = CAT[m.familia.nome];
      // comprimento da peça: extensão da canaleta (eixo X); no bloco (eixo Z), o maior u do perfil em planta
      const comp = (p: Modelo['pecas'][number]): number => {
        const g = m.geometrias[p.geometria];
        return g.eixo === 'Z' ? Math.max(...g.perfil.contorno.map(([u]) => u)) : g.extensao;
      };
      let furos = 0;
      for (const p of m.pecas) {
        if (!p.furosGrauteados?.length) continue;
        const L = Math.round(comp(p));
        const [parede, fs, vol] = c.blocos[L];
        const w = c.t - 2 * parede;
        const ret = fs.map(([a, b]) => (b - a) * w);
        // os cantos arredondados tiram a mesma área de cada furo; a soma fecha com o volume do Revit
        const perda = (ret.reduce((s, x) => s + x, 0) - (c.t * L - vol / 190)) / ret.length;
        for (const i of p.furosGrauteados) furos += (ret[i] - perda) * 200;
      }
      const CANALETAS = ['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA'];
      const cortada = (tipo: string) => tipo === 'CANALETA_CORTADA';
      const miolo = (tipo: string) => c.t * 190 - (cortada(tipo) ? c.Ucortada : c.U);
      // graute da coluna no fundo FURADO da canaleta (09/10 noite): o retângulo do furo × (junta + fundo do catálogo)
      const porId = new Map(m.pecas.map((p) => [p.id, p]));
      for (const p of m.pecas) {
        const host = p.tipo === 'GRAUTE_FURO' ? porId.get(p.id.replace(/\.g\d+$/, '')) : undefined;
        if (!host || !CANALETAS.includes(host.tipo)) continue;
        const k = caixaDaPeca(p, m.geometrias[p.geometria]);
        const h = 10 + (cortada(host.tipo) ? c.fundoCortada : c.fundo);
        expect(k.z1 - k.z0, `${cenario} ${p.id}`).toBeCloseTo(h, 6);
        furos += (k.x1 - k.x0) * (k.y1 - k.y0) * h;
      }
      let can = 0;
      // linha do muro e haste de cada contraforte: o miolo de cada canaleta e a junta com a seguinte, que vai com a de
      // antes (no muro, a da esquerda; na haste, a mais perto do muro — desde 09/10 noite a haste também é corrida)
      const corridas = new Map<string, { p: Modelo['pecas'][number]; a: number; b: number }[]>();
      const enterrado = m.pecas.some((p) => p.grupo === 'contraforte' && caixaDaPeca(p, m.geometrias[p.geometria]).y1 > c.t + 0.5);
      for (const p of m.pecas) {
        if (!CANALETAS.includes(p.tipo)) continue;
        const k = caixaDaPeca(p, m.geometrias[p.geometria]);
        const [a, b] = p.grupo === 'muro' ? [k.x0, k.x1] : enterrado ? [k.y0, k.y1] : [-k.y1, -k.y0];
        const chave = `${p.trecho}|${p.fiada}|${p.grupo === 'muro' ? 'M' : p.contraforte}`;
        corridas.set(chave, [...(corridas.get(chave) ?? []), { p, a, b }]);
      }
      for (const l of corridas.values()) {
        l.sort((u, v) => u.a - v.a);
        l.forEach(({ p, a, b }, i) => {
          can += miolo(p.tipo) * (b - a);
          const prox = l[i + 1];
          if (prox && Math.abs(prox.a - b - 10) < 1e-6) can += miolo(p.tipo) * 10;   // a junta vai com a de antes
        });
      }
      // o T (09/10 noite): parede quebrada do muro + a junta muro × haste, na largura do canal, do fundo ao topo, mais o
      // canto arredondado do fundo que sai com a parede — a metade do que o U do Revit tem a mais que o U reto
      const C_CANTOS = 4 - 12 * Math.sin(Math.PI / 12);
      for (const p of m.pecas) {
        if (p.tipo !== 'GRAUTE_CANALETA' || !/\.gT\d+$/.test(p.id)) continue;
        const k = caixaDaPeca(p, m.geometrias[p.geometria]);
        const f = k.z0 - (p.fiada! * 200 + 10);
        const ehCortada = Math.abs(f - c.fundoCortada) < 1e-6 && c.fundoCortada !== c.fundo;
        const reta = c.t * 190 - (c.t - 2 * PAREDE_U) * (190 - f);
        const canto = ((ehCortada ? c.Ucortada : c.U) - reta) / 2;
        const r = Math.sqrt((4 * canto) / C_CANTOS);
        can += (k.x1 - k.x0) * ((k.y1 - k.y0 - r) * (190 - f) + canto);
      }
      const q = quantificar(m);
      expect(q.graute.furos, cenario).toBeCloseTo(furos / 1e9, 4);
      expect(q.graute.canaletas, cenario).toBeCloseTo(can / 1e9, 4);
      // o U de cada vão tem posição e rótulo próprios, e a soma dá um por vão em cada fiada de canaleta
      const emU = q.ferros.filter((f) => f.elemento === 'Horizontal na canaleta (U)');
      expect(emU.length, cenario).toBeGreaterThan(0);
      expect(emU.reduce((s, f) => s + f.quantidade, 0), cenario).toBe(m.barras.filter((b) => b.papel === 'HORIZ').length);
      expect(q.ferros.some((f) => f.elemento === 'Horizontal na canaleta'), cenario).toBe(false);
    }
  });

  it.skipIf(!carregar)('aula123 com junta de controle a cada 3 m: tardoz e fôrma por conta independente', async (ctx) => {
    let m: Modelo, r: Resultado;
    try {
      const { gerarModelo, padroesDoModelo } = await carregar!();
      const { resultadoDoGabarito } = await import('@/motor/resultadoDoGabarito');
      r = resultadoDoGabarito('aula123');
      m = gerarModelo(r, { ...padroesDoModelo(), L_total: 12, junta_cada: 3 });
    } catch (e) {
      return ctx.skip(`modulação ainda não gera este cenário: ${(e as Error).message}`);
    }
    const { caixaGlobal } = await import('@/modulacao/perfis');
    const q = quantificar(m);
    const nTrechos = m.dims.trechos.length;
    expect(nTrechos).toBeGreaterThan(1);
    const somaL = m.dims.trechos.reduce((s, t) => s + (t.x1 - t.x0), 0);
    const H = m.dims.H_solo;
    // profundidade da haste pela caixa da modulação (não pela conta do quantitativo)
    const fundo = Math.max(...m.pecas.filter((p) => p.grupo === 'contraforte').map((p) => caixaGlobal(p, m.geometrias[p.geometria]).max[1]));
    const haste = fundo - m.familia.t;
    // cada contraforte 2 faces laterais, menos as 2 que se encaram em cada junta
    const faces = 2 * m.dims.contrafortes.length - 2 * (nTrechos - 1);
    expect(q.drenagem.impermeabilizacao).toBeCloseTo((somaL * H + faces * haste * H) / 1e6, 6);
    // fôrma: cada trecho tem a sua sapata, com as 2 faces de h e os 2 topos B × h (a junta leva fôrma dos dois lados)
    const h = r.num('h_sap')! * 1000;
    const B = r.num('B_sap')! * 1000;
    expect(q.sapata.forma).toBeCloseTo((2 * h * somaL + nTrechos * 2 * B * h) / 1e6, 6);
  });

  it.skipIf(!carregar)('aula122 (balanço): sapata, tardoz, graute de canaleta e juntas verticais por conta independente', async (ctx) => {
    const g = await gerar('aula122');
    if (typeof g === 'string') return ctx.skip(g);
    const { m, r } = g;
    const q = quantificar(m);
    const L = m.dims.L_real / 1000;
    const n = (k: string) => r.num(k) ?? 0;
    // concreto = (B·h + b_den·h_den)·L — a mesma área que a aba Fundação usa para o peso da sapata
    expect(q.sapata.concreto).toBeCloseTo((n('B_sap') * n('h_sap') + n('b_den') * n('h_den')) * L, 6);
    // fôrma: 2 faces de h ao longo de L + 2 topos de B × h (dente contra o solo)
    expect(q.sapata.forma).toBeCloseTo(2 * n('h_sap') * L + 2 * n('B_sap') * n('h_sap'), 6);
    // balanço sem contraforte: tardoz = L × altura de solo
    expect(q.drenagem.impermeabilizacao).toBeCloseTo(L * m.dims.H_solo / 1000, 6);
    // graute da canaleta: miolo (o vazio do U) em cada fiada de canaleta, corrida inteira. A seção vem do perfil
    // que a modulação desenhou (canaleta do Revit do Jose: paredes, fundo e cantos arredondados — 09/10), não de hf.
    const { t } = m.familia;
    const perfilU = m.geometrias[m.pecas.find((p) => p.tipo === 'CANALETA')!.geometria].perfil.contorno;
    const areaU = Math.abs(perfilU.reduce((a, [x1, y1], i) => { const [x2, y2] = perfilU[(i + 1) % perfilU.length]; return a + x1 * y2 - x2 * y1; }, 0) / 2);
    const miolo = t * 190 - areaU;
    const fiadasDeCanaleta = new Set(m.pecas.filter((p) => p.tipo === 'CANALETA' || p.tipo === 'MEIA_CANALETA').map((p) => p.fiada));
    expect(q.graute.canaletas).toBeCloseTo(fiadasDeCanaleta.size * miolo * m.dims.L_real / 1e9, 9);
    // juntas verticais: numa parede reta, (peças da fiada − 1) juntas por fiada; face t × 190 no bloco e
    // só o U na canaleta
    const porFiada = new Map<number, { n: number; canaleta: boolean }>();
    for (const p of m.pecas) {
      if (!['BLOCO', 'MEIO_BLOCO', 'CANALETA', 'MEIA_CANALETA'].includes(p.tipo)) continue;
      const f = porFiada.get(p.fiada!) ?? { n: 0, canaleta: false };
      f.n += 1;
      f.canaleta ||= p.tipo === 'CANALETA' || p.tipo === 'MEIA_CANALETA';
      porFiada.set(p.fiada!, f);
    }
    const faceU = areaU;
    let v = 0;
    for (const f of porFiada.values()) v += (f.n - 1) * (f.canaleta ? faceU : t * 190) * 10;
    expect(q.argamassa.vertical).toBeCloseTo(v / 1e9, 9);
  });
});

describe('compra: canaleta cortada vira canaleta inteira (Jose, 15/10)', () => {
  const L = (tipo: LinhaDeBloco['tipo'], catalogo: string, quantidade: number): LinhaDeBloco => ({ tipo, rotulo: tipo, catalogo, quantidade });

  it('cada cortada soma uma inteira na compra e aparece logo abaixo como "das quais, para cortar"; o total fica igual', () => {
    const pecas = [L('BLOCO', 'bloco 19x19x39', 100), L('CANALETA', 'canaleta 19x19x39', 30), L('MEIA_CANALETA', 'meia', 4), L('CANALETA_CORTADA', 'canaleta 19x19x39 cortada em 24', 6)];
    const c = blocosParaCompra(pecas);
    expect(c.map((l) => [l.tipo, l.quantidade, !!l.dasQuais])).toEqual([
      ['BLOCO', 100, false], ['CANALETA', 36, false], ['CANALETA_CORTADA', 6, true], ['MEIA_CANALETA', 4, false],
    ]);
    const total = (ls: LinhaDeCompra[]) => ls.filter((l) => !l.dasQuais).reduce((s, l) => s + l.quantidade, 0);
    expect(total(c)).toBe(pecas.reduce((s, l) => s + l.quantidade, 0));
    // a lista de peças (montagem) não muda
    expect(pecas[1].quantidade).toBe(30);
  });

  it('sem cortada, a compra é a lista de peças', () => {
    const pecas = [L('BLOCO', 'b', 10), L('CANALETA', 'c', 3)];
    expect(blocosParaCompra(pecas)).toEqual(pecas);
  });

  it('na tabela da tela e do CSV: a linha da canaleta já com as cortadas, e a das cortadas fora do total', () => {
    const q = quantificar(modeloAMao());
    const t = tabelasDoQuantitativo(q).find((x) => x.id === 'blocos')!;
    expect(t.total?.[2]).toEqual({ n: q.totalBlocos, casas: 0 });
    const soma = t.linhas.filter((l) => !String(l[0]).startsWith('↳')).reduce((s, l) => s + (l[2] as { n: number }).n, 0);
    expect(soma).toBe(q.totalBlocos);
  });
});
