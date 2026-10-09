/*
  MURO DE TESTE, montado à mão — SÓ para o teste do IFC, enquanto a modulação (modulacao/) não fica pronta.

  NÃO é modulação: não confere amarração, junta a prumo nem posição de furo; só produz um Modelo plausível e
  conhecido (números redondos que dá para conferir de cabeça) com todos os casos que o exportador precisa
  enfrentar: bloco, meio bloco, canaleta (extrusão em X), graute de furo e de canaleta, sapata com dente,
  bloco girado 90° (haste do contraforte), peça extrudada em Y (barbacã), barra com gancho em arco amostrado,
  estribo fechado, barras repetidas da mesma posição, dois trechos, peça de terreno (que NÃO pode ir para o IFC).

  Família 19x39 do curso: furo calibrado pela tabela (Ag = 170 cm²), largura t − 2hf = 120 mm.
*/
import type { Barra, Geometria, Modelo, Peca, Vec2, Vec3 } from '@/modelo/tipos';

export interface OpcoesDoMuroDeTeste {
  blocosPorFiada?: number;   // N: comprimento = N·400 − 10
  fiadas?: number;
  canaletas?: number[];      // fiadas em canaleta (0 = base)
  contrafortes?: boolean;    // um em cada ponta, haste de 1 bloco deitado em Y
  drenagem?: boolean;
  trechos?: number;          // trechos iguais separados por junta de 10 mm
}

const T = 190, LB = 390, LM = 190, HB = 190, HF = 35, J = 10, MOD = 400;
const FY = T - 2 * HF;          // 120: largura do furo
const FX = 17000 / FY;          // 141,67: comprimento do furo → área = Ag = 170 cm² exata
const SEPTO = (LB - 2 * FX) / 3;
// sapata da aula 12.2
const B = 1400, HS = 300, BD = 250, HD = 500, A_ATER = 950, COB = 40;
const Y_PE = T / 2 + A_ATER - B;  // −355

const ret = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const horario = (p: Vec2[]) => [...p].reverse();
const areaPoli = (p: Vec2[]) => p.reduce((s, [x0, y0], i) => { const [x1, y1] = p[(i + 1) % p.length]; return s + x0 * y1 - x1 * y0; }, 0) / 2;
const pad = (n: number, k: number) => String(n).padStart(k, '0');

function geo(chave: string, eixo: Geometria['eixo'], contorno: Vec2[], extensao: number, furos: Vec2[][] = [], catalogo?: string): Geometria {
  const area = Math.abs(areaPoli(contorno)) - furos.reduce((s, f) => s + Math.abs(areaPoli(f)), 0);
  return { chave, eixo, perfil: { contorno, furos: furos.length ? furos : undefined }, extensao, volume_mm3: area * extensao, catalogo };
}

function circulo(cx: number, cy: number, r: number, n = 16): Vec2[] {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)] as Vec2);
}

/** Arco amostrado no plano dado por (eixo u, eixo v) em torno de `c`, de a0 a a1 (rad), com `n` cordas, sem o 1º ponto. */
function arco(c: Vec3, u: Vec3, v: Vec3, r: number, a0: number, a1: number, n: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([0, 1, 2].map((k) => c[k] + r * (Math.cos(a) * u[k] + Math.sin(a) * v[k])) as Vec3);
  }
  return out;
}
const EY: Vec3 = [0, 1, 0], EZ: Vec3 = [0, 0, 1], EX: Vec3 = [1, 0, 0];

export function muroDeTeste(op: OpcoesDoMuroDeTeste = {}): Modelo {
  const N = op.blocosPorFiada ?? 5;
  const NF = op.fiadas ?? 8;
  const CAN = new Set(op.canaletas ?? [3, 7]);
  const NT = op.trechos ?? 1;
  const L = N * MOD - J;
  const H = NF * 200;

  const geometrias: Record<string, Geometria> = {};
  const usa = (g: Geometria) => { geometrias[g.chave] = g; return g.chave; };
  const furo1 = horario(ret(SEPTO, HF, SEPTO + FX, HF + FY));
  const furo2 = horario(ret(2 * SEPTO + FX, HF, 2 * SEPTO + 2 * FX, HF + FY));
  const gBloco = usa(geo('bloco 19x19x39', 'Z', ret(0, 0, LB, T), HB, [furo1, furo2], '19x19x39'));
  const gMeio = usa(geo('meio bloco 19x19x19', 'Z', ret(0, 0, LM, T), HB, [horario(ret(HF, HF, LM - HF, T - HF))], '19x19x19'));
  const U: Vec2[] = [[0, 0], [T, 0], [T, HB], [T - HF, HB], [T - HF, HF], [HF, HF], [HF, HB], [0, HB]];
  const gCan = usa(geo('canaleta 19x19x39', 'X', U, LB, [], 'canaleta 19x19x39'));
  const gMeiaCan = usa(geo('meia canaleta 19x19x19', 'X', U, LM, [], 'canaleta 19x19x19'));
  const gGrauteFuro = usa(geo(`graute furo 19x39 h${H - J}`, 'Z', ret(0, 0, FX, FY), H - J));
  const gGrauteCan = usa(geo(`graute canaleta 19x39 L${L}`, 'X', ret(0, 0, FY, HB - HF), L));
  const secaoSapata: Vec2[] = [[0, HD], [B / 2 - BD / 2, HD], [B / 2 - BD / 2, 0], [B / 2 + BD / 2, 0], [B / 2 + BD / 2, HD], [B, HD], [B, HD + HS], [0, HD + HS]];
  const gSapata = usa(geo(`sapata L${L}`, 'X', secaoSapata, L));
  const gAterro = usa(geo(`aterro L${L}`, 'X', ret(0, 0, 1000, H), L));

  const pecas: Peca[] = [];
  const barras: Barra[] = [];
  const contrafortes: Modelo['dims']['contrafortes'] = [];
  const trechos: Modelo['dims']['trechos'] = [];

  for (let t = 1; t <= NT; t++) {
    const x0 = (t - 1) * (L + J);
    trechos.push({ x0, x1: x0 + L });
    const P = (id: string, tipo: Peca['tipo'], grupo: Peca['grupo'], geometria: string, origem: Vec3, extra: Partial<Peca> = {}) =>
      pecas.push({ id: `T${t}.${id}`, tipo, grupo, geometria, origem, giro: 0, trecho: t, ...extra });

    // ── fiadas ──
    for (let f = 0; f < NF; f++) {
      const z = 200 * f + J;
      const can = CAN.has(f);
      const [gI, gM] = can ? [gCan, gMeiaCan] : [gBloco, gMeio];
      const [tI, tM]: Peca['tipo'][] = can ? ['CANALETA', 'MEIA_CANALETA'] : ['BLOCO', 'MEIO_BLOCO'];
      if (f % 2 === 0) {
        for (let k = 0; k < N; k++) P(`M.f${pad(f, 2)}.p${pad(k, 3)}`, tI, 'muro', gI, [x0 + k * MOD, 0, z], { fiada: f });
      } else {
        P(`M.f${pad(f, 2)}.p000`, tM, 'muro', gM, [x0, 0, z], { fiada: f });
        for (let k = 0; k < N - 1; k++) P(`M.f${pad(f, 2)}.p${pad(k + 1, 3)}`, tI, 'muro', gI, [x0 + 200 + k * MOD, 0, z], { fiada: f });
        P(`M.f${pad(f, 2)}.p${pad(N, 3)}`, tM, 'muro', gM, [x0 + 200 + (N - 1) * MOD, 0, z], { fiada: f });
      }
      if (can) P(`GC.f${pad(f, 2)}`, 'GRAUTE_CANALETA', 'muro', gGrauteCan, [x0, HF, z + HF], { fiada: f });
    }
    // ── graute dos furos armados (um por bloco: s = 40) ──
    for (let k = 0; k < N; k++) P(`GF.c${pad(k, 3)}`, 'GRAUTE_FURO', 'muro', gGrauteFuro, [x0 + k * MOD + SEPTO, HF, J]);
    // ── sapata ──
    P('SAP', 'SAPATA', 'fundacao', gSapata, [x0, Y_PE, -HS - HD]);
    P('ATR', 'ATERRO', 'terreno', gAterro, [x0, T + 200, 0]);

    // ── barras ──
    const r10 = 30, cauda = 80, yb = 140, z0 = -HS + COB + 10 + 5;
    for (let k = 0; k < N; k++) {
      const x = x0 + k * MOD + SEPTO + FX / 2;
      // N1: espera com gancho de 90° no pé (arco amostrado em 4 cordas), cauda para o lado de fora
      const eixo: Vec3[] = [[x, yb - r10 - cauda, z0], [x, yb - r10, z0],
        ...arco([x, yb - r10, z0 + r10], EY, EZ, r10, -Math.PI / 2, 0, 4), [x, yb, 600]];
      barras.push({ id: `T${t}.N1.${k}`, posicao: 'N1', papel: 'ESPERA', diametro: 10, eixo, trecho: t,
        comprimento: cauda + (Math.PI / 2) * r10 + (600 - z0 - r10) });
      barras.push({ id: `T${t}.N2.${k}`, posicao: 'N2', papel: 'VERT_MURO', diametro: 10, eixo: [[x + 12, yb, 200], [x + 12, yb, H - 30]],
        trecho: t, comprimento: H - 30 - 200 });
    }
    for (const f of CAN) {
      const z = 200 * f + J + HF + 40;
      barras.push({ id: `T${t}.N3.f${f}`, posicao: 'N3', papel: 'HORIZ', diametro: 10, eixo: [[x0 + 30, T / 2, z], [x0 + L - 30, T / 2, z]],
        trecho: t, comprimento: L - 60 });
    }
    // N4: transversal da sapata, gancho de 90° para cima nas duas pontas (3 cordas por dobra)
    const zs = -HS + COB + 5, ya = Y_PE + COB, ybb = Y_PE + B - COB, sobe = 100;
    for (let x = x0 + 50, k = 0; x <= x0 + L - 50; x += 150, k++) {
      const eixo: Vec3[] = [[x, ya, zs + r10 + sobe], [x, ya, zs + r10],
        ...arco([x, ya + r10, zs + r10], EY, EZ, r10, Math.PI, 1.5 * Math.PI, 3), [x, ybb - r10, zs],
        ...arco([x, ybb - r10, zs + r10], EY, EZ, r10, -Math.PI / 2, 0, 3), [x, ybb, zs + r10 + sobe]];
      barras.push({ id: `T${t}.N4.${k}`, posicao: 'N4', papel: 'SAP_TRANSV', diametro: 10, eixo, trecho: t,
        comprimento: 2 * sobe + Math.PI * r10 + (ybb - ya - 2 * r10) });
    }
    for (let j = 0; j < 6; j++) {
      const y = Y_PE + 60 + j * 250;
      barras.push({ id: `T${t}.N5.${j}`, posicao: 'N5', papel: 'SAP_LONG', diametro: 8, eixo: [[x0 + 30, y, zs + 9], [x0 + L - 30, y, zs + 9]],
        trecho: t, comprimento: L - 60 });
    }

    // ── contrafortes: um em cada ponta, haste = 1 bloco deitado em Y (giro 90) por fiada ──
    if (op.contrafortes) {
      for (const [n, xc] of [[2 * t - 1, x0 + 95], [2 * t, x0 + L - 95]] as const) {
        contrafortes.push({ x: xc, trecho: t, ponta: true });
        for (let f = 0; f < NF; f++) {
          // origem = canto mínimo da caixa JÁ GIRADA (convenção de modulacao/perfis.ts)
          P(`CF${n}.f${pad(f, 2)}.p01`, 'BLOCO', 'contraforte', gBloco, [xc - 95, T + J, 200 * f + J], { giro: 90, fiada: f, contraforte: n });
        }
        P(`CF${n}.GF.c01`, 'GRAUTE_FURO', 'contraforte', gGrauteFuro, [xc - FY / 2, T + J + SEPTO, J], { giro: 90, contraforte: n });
        barras.push({ id: `T${t}.N6.${n}`, posicao: 'N6', papel: 'CF_PRINCIPAL', diametro: 10, eixo: [[xc, T + J + 300, z0], [xc, T + J + 300, H - 30]],
          trecho: t, contraforte: n, comprimento: H - 30 - z0 });
        // N7: estribo fechado em planta, cantos em arco de 2 cordas (r 10 no eixo, Ø5)
        const r = 10, xa = xc - 60, xb = xc + 60, y0 = T + J + 15, y1 = T + J + LB - 15;
        for (let f = 1; f < NF; f += 3) {
          const z = 200 * f + 100;
          const e: Vec3[] = [[xc, y0, z], [xb - r, y0, z], ...arco([xb - r, y0 + r, z], EX, EY, r, -Math.PI / 2, 0, 2),
            [xb, y1 - r, z], ...arco([xb - r, y1 - r, z], EX, EY, r, 0, Math.PI / 2, 2),
            [xa + r, y1, z], ...arco([xa + r, y1 - r, z], EX, EY, r, Math.PI / 2, Math.PI, 2),
            [xa, y0 + r, z], ...arco([xa + r, y0 + r, z], EX, EY, r, Math.PI, 1.5 * Math.PI, 2)];
          barras.push({ id: `T${t}.N7.${n}.f${f}`, posicao: 'N7', papel: 'CF_ESTRIBO', diametro: 5, eixo: e, fechada: true, trecho: t, contraforte: n,
            comprimento: 2 * (xb - xa - 2 * r) + 2 * (y1 - y0 - 2 * r) + 2 * Math.PI * r });
        }
        // N8: estribo como a modulação desenha hoje — retângulo de cantos vivos (o gancho só entra no comprimento)
        const zt = 200 * (NF - 1) + 100;
        barras.push({ id: `T${t}.N8.${n}`, posicao: 'N8', papel: 'CF_ESTRIBO', diametro: 6.3, fechada: true, trecho: t, contraforte: n,
          eixo: [[xa, y0, zt], [xb, y0, zt], [xb, y1, zt], [xa, y1, zt]], comprimento: 2 * (xb - xa) + 2 * (y1 - y0) + 2 * 70 });
      }
    }

    // ── drenagem ──
    if (op.drenagem) {
      const hd = H - 300;
      geometrias[`dreno L${L}`] = geo(`dreno L${L}`, 'X', ret(0, 0, 200, hd), L);
      geometrias[`manta L${L}`] = geo(`manta L${L}`, 'X', ret(0, 0, 2, hd), L);
      geometrias['barbaca 50'] = geo('barbaca 50', 'Y', circulo(25, 25, 25), T, [horario(circulo(25, 25, 22))]);
      P('DRN', 'DRENO', 'drenagem', `dreno L${L}`, [x0, T + 2, 0]);
      P('MAN', 'MANTA', 'drenagem', `manta L${L}`, [x0, T, 0]);
      P('BBC.1', 'BARBACA', 'drenagem', 'barbaca 50', [x0 + 600, 0, 75]);
    }
  }

  return {
    versao: 'teste-ifc',
    familia: { nome: '19x39', t: T, L: LB, Lm: LM, m: 200, h: HB, hf: HF, junta: J },
    geometrias, pecas, barras, ajustes: [], avisos: [],
    dims: {
      L_real: NT * L + (NT - 1) * J, H_solo: H - 50, H_muro: H, n_fiadas: NF, trechos, contrafortes,
      sapata: { y0: Y_PE, y1: Y_PE + B, z0: -HS - HD, z1: 0 },
    },
  };
}

/** Números do muro de teste que o teste confere contra o que o ifcopenshell lê. */
export const MEDIDAS = { T, LB, HB, HF, FX, FY, SEPTO, B, HS, BD, HD, Y_PE, Ag: 17000 };
