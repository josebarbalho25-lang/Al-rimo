// ═══════════════════════════════════════════════════════════════════════════
//  visor/exemploDeModelo.ts — um muro montado À MÃO, só para testar o visor
// ---------------------------------------------------------------------------
//  ⚠️ NÃO É A MODULAÇÃO. Quem decide onde vai cada bloco é `modulacao/`. Isto
//  é o muro de bancada dos testes de MECÂNICA do visor (clique, Raio-X,
//  corte, seleção pintada), com números redondos que se conferem de cabeça:
//  respeita o contrato (modelo/tipos.ts), mas furos, graute e barras são
//  aproximados de propósito — amarração corrida, família 14×39, furo
//  retangular. A concordância com o muro DE VERDADE (o que a modulação gera
//  da conta do Excel) é provada em `integracao.test.ts`. Não entra no app.
// ═══════════════════════════════════════════════════════════════════════════

import type { Barra, Familia, Geometria, Modelo, Peca, Vec2, Vec3 } from '@/modelo/tipos';

export interface OpcoesDoExemplo {
  blocosPorFiada?: number;
  fiadas?: number;
  contraforte?: boolean;
  terreno?: boolean;
  /** Barra vertical a cada quantos blocos (0 = sem barras). */
  barraACada?: number;
}

const FAMILIA: Familia = { nome: '14x39', t: 140, L: 390, Lm: 190, m: 200, h: 190, hf: 25, junta: 10 };

const ret = (u0: number, v0: number, u1: number, v1: number): Vec2[] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
];
const area = (p: Vec2[]) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]!;
    const [x2, y2] = p[(i + 1) % p.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
};

function geometria(chave: string, eixo: Geometria['eixo'], contorno: Vec2[], extensao: number, furos: Vec2[][] = [], catalogo?: string): Geometria {
  // Furo horário, como o contrato pede.
  const fs = furos.map((f) => [...f].reverse());
  const volume = (area(contorno) - furos.reduce((s, f) => s + area(f), 0)) * extensao;
  return { chave, eixo, perfil: fs.length ? { contorno, furos: fs } : { contorno }, extensao, volume_mm3: volume, ...(catalogo ? { catalogo } : {}) };
}

/** Furos de 145 × 90 centrados em L/4 e 3L/4 (aproximação; o real é arredondado). */
const FURO_1 = ret(25, 25, 170, 115);
const FURO_2 = ret(220, 25, 365, 115);

export function muroDeExemplo(o: OpcoesDoExemplo = {}): Modelo {
  const nB = o.blocosPorFiada ?? 6;
  const nF = o.fiadas ?? 8;
  const barraACada = o.barraACada ?? 2;
  const L = nB * 400 - 10;
  const H = nF * 200;
  const B = 1400;
  const hs = 300;
  const hd = 250;
  const y0 = -500;

  const geos: Geometria[] = [
    geometria('bloco 14x19x39', 'Z', ret(0, 0, 390, 140), 190, [FURO_1, FURO_2], '14x19x39'),
    geometria('meio bloco 14x19x19', 'Z', ret(0, 0, 190, 140), 190, [ret(25, 25, 165, 115)], '14x19x19'),
    // Canaleta: U na seção (y, z), corre em X.
    geometria('canaleta 14x19x39', 'X', [[0, 0], [140, 0], [140, 190], [115, 190], [115, 30], [25, 30], [25, 190], [0, 190]], 390, [], 'canaleta 14x19x39'),
    geometria('meia canaleta 14x19x19', 'X', [[0, 0], [140, 0], [140, 190], [115, 190], [115, 30], [25, 30], [25, 190], [0, 190]], 190, [], 'canaleta 14x19x19'),
    geometria('graute furo 14x39', 'Z', ret(0, 0, 145, 90), 200),
    geometria('graute canaleta', 'X', ret(0, 0, 90, 160), L),
    // Sapata com dente no meio, seção (y, z): o dente desce abaixo de z = 0 da seção.
    geometria('sapata', 'X', [[0, 0], [B / 2 - 125, 0], [B / 2 - 125, -hd], [B / 2 + 125, -hd], [B / 2 + 125, 0], [B, 0], [B, hs], [0, hs]], L),
  ];
  if (o.terreno) {
    geos.push(geometria('aterro', 'X', ret(0, 0, 1500, H - 100), L));
    geos.push(geometria('dreno', 'X', ret(0, 0, 200, H - 300), L));
    geos.push(geometria('barbaca', 'Y', [[-25, 0], [0, -25], [25, 0], [0, 25]].map(([u, v]) => [u! + 25, v! + 25] as Vec2), 140));
  }

  const pecas: Peca[] = [];
  const barras: Barra[] = [];
  const id3 = (n: number) => String(n).padStart(3, '0');
  const id2 = (n: number) => String(n).padStart(2, '0');

  for (let f = 0; f < nF; f++) {
    const z = 200 * f + 10;
    const topo = f === nF - 1;
    const par = f % 2 === 0;
    const inteiro = topo ? 'canaleta 14x19x39' : 'bloco 14x19x39';
    const meio = topo ? 'meia canaleta 14x19x19' : 'meio bloco 14x19x19';
    const tipoI = topo ? 'CANALETA' : 'BLOCO';
    const tipoM = topo ? 'MEIA_CANALETA' : 'MEIO_BLOCO';
    let k = 0;
    const assentar = (x: number, geometria: string, tipo: Peca['tipo']) =>
      pecas.push({ id: `T1.M.f${id2(f)}.p${id3(k++)}`, tipo, grupo: 'muro', geometria, origem: [x, 0, z], giro: 0, trecho: 1, fiada: f });
    if (par) for (let b = 0; b < nB; b++) assentar(b * 400, inteiro, tipoI);
    else {
      assentar(0, meio, tipoM);
      for (let b = 0; b < nB - 1; b++) assentar(200 + b * 400, inteiro, tipoI);
      assentar(nB * 400 - 200, meio, tipoM);
    }
  }

  // Graute e barra vertical a cada `barraACada` blocos, no 1º furo.
  if (barraACada > 0) {
    let c = 0;
    for (let b = 0; b < nB; b += barraACada) {
      const xf = b * 400 + 25;
      for (let f = 0; f < nF - 1; f++)
        pecas.push({ id: `T1.GF.c${id3(c)}.f${id2(f)}`, tipo: 'GRAUTE_FURO', grupo: 'muro', geometria: 'graute furo 14x39', origem: [xf, 25, 200 * f], giro: 0, trecho: 1, fiada: f });
      const x = xf + 72.5;
      const eixo: Vec3[] = [[x, 70, -hs + 60], [x, 70, H - 30]];
      barras.push({ id: `B.V${id3(c)}`, posicao: 'N1', papel: 'VERT_MURO', diametro: 10, eixo, comprimento: H - 30 + hs - 60, trecho: 1 });
      const espera: Vec3[] = [[x, 70, 400], [x, 70, -hs + 50], [x, 300, -hs + 50]];
      barras.push({ id: `B.E${id3(c)}`, posicao: 'N2', papel: 'ESPERA', diametro: 10, eixo: espera, comprimento: 400 + hs - 50 + 230, trecho: 1 });
      c++;
    }
  }
  pecas.push({ id: 'T1.GC', tipo: 'GRAUTE_CANALETA', grupo: 'muro', geometria: 'graute canaleta', origem: [0, 25, 200 * (nF - 1) + 40], giro: 0, trecho: 1, fiada: nF - 1 });
  barras.push({ id: 'B.H001', posicao: 'N3', papel: 'HORIZ', diametro: 10, eixo: [[30, 70, 200 * (nF - 1) + 85], [L - 30, 70, 200 * (nF - 1) + 85]], comprimento: L - 60, trecho: 1 });

  pecas.push({ id: 'SAP.T1', tipo: 'SAPATA', grupo: 'fundacao', geometria: 'sapata', origem: [0, y0, -hs - hd], giro: 0, trecho: 1 });
  for (let x = 50, i = 0; x < L; x += 200, i++)
    barras.push({ id: `S.T${id3(i)}`, posicao: 'N4', papel: 'SAP_TRANSV', diametro: 8, eixo: [[x, y0 + 40, -hs + 40], [x, y0 + B - 40, -hs + 40]], comprimento: B - 80, trecho: 1 });
  for (let y = y0 + 60, i = 0; y < y0 + B - 40; y += 300, i++)
    barras.push({ id: `S.L${id3(i)}`, posicao: 'N5', papel: 'SAP_LONG', diametro: 6.3, eixo: [[40, y, -hs + 50], [L - 40, y, -hs + 50]], comprimento: L - 80, trecho: 1 });

  const contrafortes: Modelo['dims']['contrafortes'] = [];
  if (o.contraforte) {
    // Haste com blocos deitados em Y (giro 90): ocupa x ∈ [xc, xc + 140].
    const xc = Math.floor(nB / 2) * 400;
    contrafortes.push({ x: xc + 70, trecho: 1, ponta: false });
    for (let f = 0; f < nF; f++)
      pecas.push({ id: `T1.CF1.f${id2(f)}.p01`, tipo: 'BLOCO', grupo: 'contraforte', geometria: 'bloco 14x19x39', origem: [xc, 150, 200 * f + 10], giro: 90, trecho: 1, fiada: f, contraforte: 1 });
    for (let f = 0; f < nF; f++)
      pecas.push({ id: `T1.CF1.GF.f${id2(f)}`, tipo: 'GRAUTE_FURO', grupo: 'contraforte', geometria: 'graute furo 14x39', origem: [xc + 25, 325, 200 * f], giro: 90, trecho: 1, fiada: f, contraforte: 1 });
    for (let k = 0; k < nF; k++) {
      const z = 200 * k + 5;
      barras.push({
        id: `CF1.E${id2(k)}`,
        posicao: 'N6',
        papel: 'CF_ESTRIBO',
        diametro: 6.3,
        eixo: [[xc + 35, 195, z], [xc + 105, 195, z], [xc + 105, 495, z], [xc + 35, 495, z]],
        fechada: true,
        comprimento: 2 * (70 + 300),
        trecho: 1,
        contraforte: 1,
      });
    }
  }

  if (o.terreno) {
    pecas.push({ id: 'TER.ATERRO', tipo: 'ATERRO', grupo: 'terreno', geometria: 'aterro', origem: [0, 140, 0], giro: 0, trecho: 1 });
    pecas.push({ id: 'DRN.1', tipo: 'DRENO', grupo: 'drenagem', geometria: 'dreno', origem: [0, 140, 0], giro: 0, trecho: 1 });
    for (let x = 300, i = 0; x < L - 100; x += 1500, i++)
      pecas.push({ id: `BAR.${id2(i)}`, tipo: 'BARBACA', grupo: 'drenagem', geometria: 'barbaca', origem: [x, 0, 75], giro: 0, trecho: 1, fiada: 0 });
  }

  return {
    versao: 'exemplo-do-visor',
    familia: FAMILIA,
    geometrias: Object.fromEntries(geos.map((g) => [g.chave, g])),
    pecas,
    barras,
    ajustes: [],
    avisos: [],
    dims: {
      L_real: L,
      H_solo: H - 100,
      H_muro: H,
      n_fiadas: nF,
      trechos: [{ x0: 0, x1: L }],
      contrafortes,
      sapata: { y0, y1: y0 + B, z0: -hs - hd, z1: 0 },
    },
  };
}
