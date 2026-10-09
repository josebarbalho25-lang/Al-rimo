/*
  MODELO MONTADO À MÃO, para conferir o quantitativo por conta independente (só os testes importam isto).

  Muro de bloco 19×39, um trecho de 790 mm (4 células de 200 − 10), três fiadas:
    fiada 0 (Z 10–200):  inteiro [0, 390] · inteiro [400, 790] · + 1 inteiro deitado em Y (haste do contraforte
                         de ponta) em X [0, 190], Y [200, 590]
    fiada 1 (Z 210–400): meio [0, 190] · inteiro [200, 590] · meio [600, 790]
    fiada 2 (Z 410–600): canaleta [0, 390] · canaleta [400, 790]
  Furos RETANGULARES (não os arredondados da modulação) para a conta fechar de cabeça:
    inteiro 390×190 com 2 furos 140×120 → líquida 74 100 − 33 600 = 40 500 mm²
    meio    190×190 com 1 furo  120×120 → líquida 36 100 − 14 400 = 21 700 mm²
    canaleta U: 190×190 − 120×170 = 15 700 mm²
  Sapata B = 1400 (Y −800 a 600), h = 300, dente 250×500 centrado em B/2 (Y −225 a 25):
    área = 1400·300 + 250·500 = 545 000 mm².
  Drenagem no formato da modulação (gerar.ts): dreno de brita (e − 2) × (zTopo − 2) encostado no tardoz e a manta
  de 2 mm em L por trás e por cima dele (e = 200, zTopo = 250); barbacã extrudado em X e girado 90° (vira Y).
  Perfis com o canto mínimo em (0, 0), como pede o contrato.
  Os volumes `volume_mm3` abaixo estão escritos como número, feitos à mão — não saem das funções do quantitativo.
*/
import type { Barra, Geometria, Modelo, Peca, PapelBarra, Vec2 } from '@/modelo/tipos';

const ret = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const furo = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];

export const GEOMETRIAS: Record<string, Geometria> = {
  'bloco 19x19x39': {
    chave: 'bloco 19x19x39', eixo: 'Z', extensao: 190, catalogo: '19x19x39',
    perfil: { contorno: ret(0, 0, 390, 190), furos: [furo(35, 35, 175, 155), furo(215, 35, 355, 155)] },
    volume_mm3: 7_695_000,                       // 40 500 × 190
  },
  'meio 19x19x19': {
    chave: 'meio 19x19x19', eixo: 'Z', extensao: 190, catalogo: '19x19x19',
    perfil: { contorno: ret(0, 0, 190, 190), furos: [furo(35, 35, 155, 155)] },
    volume_mm3: 4_123_000,                       // 21 700 × 190
  },
  'canaleta 19x19x39': {
    chave: 'canaleta 19x19x39', eixo: 'X', extensao: 390, catalogo: 'canaleta 19x19x39',
    perfil: { contorno: [[0, 0], [190, 0], [190, 190], [155, 190], [155, 20], [35, 20], [35, 190], [0, 190]] },
    volume_mm3: 6_123_000,                       // 15 700 × 390
  },
  'graute furo h200': {
    chave: 'graute furo h200', eixo: 'Z', extensao: 200,
    perfil: { contorno: ret(0, 0, 140, 120) }, volume_mm3: 3_360_000,
  },
  'graute canaleta 790': {
    chave: 'graute canaleta 790', eixo: 'X', extensao: 790,
    perfil: { contorno: ret(0, 0, 120, 170) }, volume_mm3: 16_116_000,
  },
  sapata: {
    chave: 'sapata', eixo: 'X', extensao: 790,
    // corte em (y, z) a partir do canto mínimo: pé em u = 0, dente de u = 575 a 825, topo em v = 800
    perfil: { contorno: [[0, 500], [575, 500], [575, 0], [825, 0], [825, 500], [1400, 500], [1400, 800], [0, 800]] },
    volume_mm3: 430_550_000,                     // 545 000 × 790
  },
  'barbaca 50': {
    chave: 'barbaca 50', eixo: 'X', extensao: 190,
    perfil: { contorno: ret(0, 0, 50, 50) }, volume_mm3: 475_000,
  },
  dreno: {
    chave: 'dreno', eixo: 'X', extensao: 790,
    perfil: { contorno: ret(0, 0, 198, 248) }, volume_mm3: 38_792_160,          // 198 × 248 × 790
  },
  manta: {
    chave: 'manta', eixo: 'X', extensao: 790,
    perfil: { contorno: [[198, 0], [200, 0], [200, 250], [0, 250], [0, 248], [198, 248]] },
    volume_mm3: 707_840,                                                     // (2·250 + 198·2) × 790
  },
  aterro: {
    chave: 'aterro', eixo: 'X', extensao: 790,
    perfil: { contorno: ret(0, 0, 1000, 550) }, volume_mm3: 434_500_000,
  },
};

function peca(id: string, tipo: Peca['tipo'], grupo: Peca['grupo'], geometria: string, origem: Peca['origem'],
  extra: Partial<Peca> = {}): Peca {
  return { id, tipo, grupo, geometria, origem, giro: 0, trecho: 1, ...extra };
}

function barras(n: number, posicao: string, papel: PapelBarra, diametro: number, comprimento: number, fechada = false): Barra[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${posicao}.${i + 1}`, posicao, papel, diametro, comprimento, trecho: 1,
    eixo: [[i * 200 + 95, 95, 0], [i * 200 + 95, 95, comprimento]], ...(fechada ? { fechada } : {}),
  }));
}

export function modeloAMao(): Modelo {
  const pecas: Peca[] = [
    peca('T1.M.f00.p000', 'BLOCO', 'muro', 'bloco 19x19x39', [0, 0, 10], { fiada: 0 }),
    peca('T1.M.f00.p001', 'BLOCO', 'muro', 'bloco 19x19x39', [400, 0, 10], { fiada: 0 }),
    peca('T1.CF1.f00.p00', 'BLOCO', 'contraforte', 'bloco 19x19x39', [0, 200, 10], { fiada: 0, giro: 90, contraforte: 1 }),
    peca('T1.M.f01.p000', 'MEIO_BLOCO', 'muro', 'meio 19x19x19', [0, 0, 210], { fiada: 1 }),
    peca('T1.M.f01.p001', 'BLOCO', 'muro', 'bloco 19x19x39', [200, 0, 210], { fiada: 1 }),
    peca('T1.M.f01.p002', 'MEIO_BLOCO', 'muro', 'meio 19x19x19', [600, 0, 210], { fiada: 1 }),
    peca('T1.M.f02.p000', 'CANALETA', 'muro', 'canaleta 19x19x39', [0, 0, 410], { fiada: 2 }),
    peca('T1.M.f02.p001', 'CANALETA', 'muro', 'canaleta 19x19x39', [400, 0, 410], { fiada: 2 }),
    peca('T1.GF.c000.f0', 'GRAUTE_FURO', 'muro', 'graute furo h200', [35, 35, 0]),
    peca('T1.GF.c000.f1', 'GRAUTE_FURO', 'muro', 'graute furo h200', [35, 35, 200]),
    peca('T1.GF.c003.f0', 'GRAUTE_FURO', 'muro', 'graute furo h200', [615, 35, 0]),
    peca('T1.GF.c003.f1', 'GRAUTE_FURO', 'muro', 'graute furo h200', [615, 35, 200]),
    peca('T1.GC.f02', 'GRAUTE_CANALETA', 'muro', 'graute canaleta 790', [0, 35, 430]),
    peca('SAP.T1', 'SAPATA', 'fundacao', 'sapata', [0, -800, -800]),
    peca('DRN.B1', 'BARBACA', 'drenagem', 'barbaca 50', [275, 0, 75], { giro: 90 }),
    peca('DRN.B2', 'BARBACA', 'drenagem', 'barbaca 50', [475, 0, 75], { giro: 90 }),
    peca('DRN.D1', 'DRENO', 'drenagem', 'dreno', [0, 190, 0]),
    peca('DRN.M1', 'MANTA', 'drenagem', 'manta', [0, 190, 0]),
    peca('TER.A', 'ATERRO', 'terreno', 'aterro', [0, 200, 0]),
  ];
  return {
    versao: 'teste',
    familia: { nome: '19x39', t: 190, L: 390, Lm: 190, m: 200, h: 190, hf: 35, junta: 10 },
    geometrias: structuredClone(GEOMETRIAS),
    pecas,
    barras: [
      ...barras(3, 'N1', 'VERT_MURO', 10, 570),
      ...barras(3, 'N2', 'ESPERA', 10, 812.4),
      ...barras(2, 'N3', 'CF_ESTRIBO', 6.3, 1203, true),
      ...barras(4, 'N4', 'SAP_TRANSV', 12.5, 1320),
      ...barras(5, 'N5', 'SAP_LONG', 8, 730),
      ...barras(2, 'N10', 'HORIZ', 16, 1000),
      ...barras(1, 'N6', 'CF_PRINCIPAL', 20, 1500),
    ],
    ajustes: [],
    avisos: [],
    dims: {
      L_real: 790, H_solo: 550, H_muro: 600, n_fiadas: 3,
      trechos: [{ x0: 0, x1: 790 }],
      contrafortes: [{ x: 95, trecho: 1, ponta: true }],
      sapata: { y0: -800, y1: 600, z0: -800, z1: 0 },
    },
  };
}
