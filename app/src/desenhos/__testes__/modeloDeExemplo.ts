/*
  MODELO MONTADO À MÃO — só para os testes e as provas em PNG dos desenhos, enquanto a modulação (modulacao/)
  não fica pronta. Segue as regras do brief da modulação (§5.3–5.6: meia amarração, fiada P/I, peça passante,
  barra a cada s, contraforte nas duas pontas) apenas para a família em que t + 10 = m (19×39), que é o
  que o protótipo em Python conferiu (a 14×29, que também servia, saiu com o bloco cerâmico em 09/10). NÃO é a modulação: quem decide onde fica cada bloco é modulacao/.

  Respeita o contrato modelo/tipos.ts com as mesmas leituras de desenhos/geometria.ts (perfil 'Z' → (x, y),
  'X' → (y, z), 'Y' → (x, z); origem = canto mínimo da caixa já girada).
*/
import type { Barra, Familia, Geometria, Modelo, Peca, PapelBarra, Vec2, Vec3 } from '@/modelo/tipos';

export interface OpcoesExemplo {
  familia?: '19x39';
  tipo?: 'balanco' | 'contrafortes';
  celulas?: number;          // balanço: nº de meios-módulos no comprimento
  vaos?: number;             // contrafortes: nº de vãos
  celulasPorVao?: number;    // contrafortes: l_cf / m
  fiadas?: number;
  H_solo?: number;           // mm (a altura da conta; o muro desenhado é fiadas × 200)
  sBarra?: number;           // mm, múltiplo de m
  sCanaleta?: number;        // mm, múltiplo de 200
  cinta?: boolean;
  tenr?: number;             // mm
  aparente?: boolean;
  juntaNaCelula?: number;    // balanço: célula onde começa o 2º trecho (junta de controle)
  dreno?: boolean;
  /** Espessura da areia de filtro sobre o dreno (mm, do lado do aterro); 0 = sem (o padrão: os testes antigos não
   *  têm areia). A modulação põe a areia junto; aqui ela só existe para o corte ter as quatro hachuras. */
  areia?: number;
  barbaca?: boolean;
  terreno?: boolean;
  B?: number; h_sap?: number; a_ater?: number; b_den?: number; h_den?: number;   // mm
  d?: number;                // mm: Y da barra do balanço
}

const FAMILIAS: Record<'19x39', Familia & { r: number }> = {
  '19x39': { nome: '19x39', t: 190, L: 390, Lm: 190, m: 200, h: 190, hf: 35, junta: 10, r: 10.8 },
};

function area(p: Vec2[]): number {
  let s = 0;
  for (let k = 0; k < p.length; k++) {
    const [x1, y1] = p[k];
    const [x2, y2] = p[(k + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Retângulo de cantos arredondados, anti-horário. */
function retArredondado(x0: number, y0: number, x1: number, y1: number, r: number, seg = 3): Vec2[] {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const cantos: [number, number, number][] = [
    [x1 - rr, y0 + rr, -90],
    [x1 - rr, y1 - rr, 0],
    [x0 + rr, y1 - rr, 90],
    [x0 + rr, y0 + rr, 180],
  ];
  const out: Vec2[] = [];
  for (const [cx, cy, a0] of cantos) {
    for (let k = 0; k <= seg; k++) {
      const a = ((a0 + (90 * k) / seg) * Math.PI) / 180;
      out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  }
  return out;
}

const ret = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

function circulo(cx: number, cy: number, r: number, seg = 16): Vec2[] {
  return Array.from({ length: seg }, (_, k): Vec2 => [cx + r * Math.cos((2 * Math.PI * k) / seg), cy + r * Math.sin((2 * Math.PI * k) / seg)]);
}

function geometria(chave: string, eixo: Geometria['eixo'], contorno: Vec2[], extensao: number, furos: Vec2[][] = [], catalogo?: string): Geometria {
  const furosH = furos.map((f) => (area(f) > 0 ? [...f].reverse() : f));
  const a = Math.abs(area(contorno)) - furosH.reduce((s, f) => s + Math.abs(area(f)), 0);
  return { chave, eixo, perfil: { contorno, furos: furosH.length ? furosH : undefined }, extensao, volume_mm3: a * extensao, catalogo };
}

/** Meia amarração (brief §5.4): na fiada i a fronteira k é junta ⇔ (k + i) par; as pontas são sempre junta. */
function preencher(b0: number, b1: number, i: number): [number, 1 | 2][] {
  const out: [number, 1 | 2][] = [];
  let k = b0;
  while (k < b1) {
    if ((k + 1 + i) % 2 === 0 || k + 1 === b1) {
      out.push([k, 1]);
      k += 1;
    } else {
      out.push([k, 2]);
      k += 2;
    }
  }
  return out;
}

function comprimento(p: Vec3[], fechada = false): number {
  let s = 0;
  const q = fechada ? [...p, p[0]] : p;
  for (let k = 0; k + 1 < q.length; k++) s += Math.hypot(q[k + 1][0] - q[k][0], q[k + 1][1] - q[k][1], q[k + 1][2] - q[k][2]);
  return s;
}

export function modeloDeExemplo(o: OpcoesExemplo = {}): Modelo {
  const fam = FAMILIAS[o.familia ?? '19x39'];
  const { t, L, Lm, m, hf } = fam;
  const tipo = o.tipo ?? 'balanco';
  const nf = o.fiadas ?? (tipo === 'balanco' ? 8 : 13);
  const H = nf * 200;
  const H_solo = o.H_solo ?? H;
  const sBar = o.sBarra ?? (tipo === 'balanco' ? 2 * m : 2 * m);
  const sCan = o.sCanaleta ?? 800;
  const cinta = o.cinta ?? true;
  const B = o.B ?? 1400, h_sap = o.h_sap ?? 300, a_ater = o.a_ater ?? 950, b_den = o.b_den ?? 250, h_den = o.h_den ?? 500;
  const cob = 40;
  const tenr = o.tenr ?? t + 2 * m;
  const ns = (tenr - t) / m;
  const aparente = !!o.aparente;
  const w = t - 2 * hf;                    // largura do furo
  const lF = (L - 3 * hf) / 2;              // comprimento do furo do inteiro
  const c0 = (m - 10) / 2;                  // centro da célula a partir do início dela

  const g: Record<string, Geometria> = {};
  const nome = `${t / 10}x19x${L / 10}`;
  const gBloco = `bloco ${nome}`;
  const gMeio = `meio bloco ${t / 10}x19x${Lm / 10}`;
  const gCan = `canaleta ${nome}`;
  const gMeiaCan = `meia canaleta ${t / 10}x19x${Lm / 10}`;
  g[gBloco] = geometria(gBloco, 'Z', ret(0, 0, L, t), 190,
    [retArredondado(hf, hf, hf + lF, t - hf, fam.r), retArredondado(2 * hf + lF, hf, 2 * hf + 2 * lF, t - hf, fam.r)], nome);
  g[gMeio] = geometria(gMeio, 'Z', ret(0, 0, Lm, t), 190, [retArredondado(hf, hf, Lm - hf, t - hf, fam.r)], `${t / 10}x19x${Lm / 10}`);
  const U = (len: number): [Vec2[], number] => [[[0, 0], [t, 0], [t, 190], [t - hf, 190], [t - hf, 20], [hf, 20], [hf, 190], [0, 190]], len];
  g[gCan] = geometria(gCan, 'X', ...U(L), [], `canaleta ${nome}`);
  g[gMeiaCan] = geometria(gMeiaCan, 'X', ...U(Lm), [], `canaleta ${t / 10}x19x${Lm / 10}`);
  const gGrauteCol = `graute furo ${fam.nome} h${H}`;
  g[gGrauteCol] = geometria(gGrauteCol, 'Z', retArredondado(0, 0, lF, w, fam.r), H);

  const pecas: Peca[] = [];
  const barras: Barra[] = [];
  let nPeca = 0;
  const id = (pref: string) => `${pref}.p${String(++nPeca).padStart(4, '0')}`;

  // ── comprimento: células e trechos ─────────────────────────────────────────────────────────────────────────────
  let n: number;
  let hastes: number[] = [];
  let trechos: [number, number][];
  if (tipo === 'balanco') {
    n = o.celulas ?? 25;
    trechos = o.juntaNaCelula ? [[0, o.juntaNaCelula], [o.juntaNaCelula, n]] : [[0, n]];
  } else {
    const cpv = o.celulasPorVao ?? 8;
    const N = o.vaos ?? 2;
    n = N * cpv + 1;
    hastes = Array.from({ length: N + 1 }, (_, j) => j * cpv);
    trechos = [[0, n]];
  }
  const trechoDaCelula = (k: number) => trechos.findIndex(([a, b]) => k >= a && k < b) + 1;

  const can = new Set<number>();
  for (let i = 0; i < nf; i++) if (((i + 1) * 200) % sCan === 0) can.add(i);
  if (cinta) can.add(nf - 1);
  const parP = Math.min(...can) % 2;

  // ── células com barra e células grauteadas ─────────────────────────────────────────────────────────────────────
  const sc = sBar / m;
  const celBarra: number[] = [];
  if (tipo === 'balanco') {
    for (const [a, b] of trechos) {
      const s = new Set<number>();
      for (let k = a; k < b; k += sc) s.add(k);
      s.add(b - 1);
      celBarra.push(...[...s].sort((x, y) => x - y));
    }
  } else {
    for (let j = 0; j + 1 < hastes.length; j++) {
      const [a, b] = [hastes[j], hastes[j + 1]];
      for (let k = a + sc; k < b; k += sc) {
        celBarra.push(k);
        if (b - k <= sc) break;
      }
    }
  }
  const grauteadas = new Set<number>([...celBarra, ...hastes]);

  const furosDoBloco = (k: number, larg: 1 | 2) =>
    (larg === 2 ? [k, k + 1] : [k]).map((c, idx) => (grauteadas.has(c) ? idx : -1)).filter((v) => v >= 0);

  // ── parede ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const corrida = (a: number, b: number, i: number) => {
    const z = 200 * i + 10;
    for (const [k, larg] of preencher(a, b, i)) {
      const tr = trechoDaCelula(k);
      const ehCan = can.has(i);
      pecas.push({
        id: id(`T${tr}.M.f${String(i).padStart(2, '0')}`),
        tipo: ehCan ? (larg === 2 ? 'CANALETA' : 'MEIA_CANALETA') : larg === 2 ? 'BLOCO' : 'MEIO_BLOCO',
        grupo: 'muro',
        geometria: ehCan ? (larg === 2 ? gCan : gMeiaCan) : larg === 2 ? gBloco : gMeio,
        origem: [k * m, 0, z],
        giro: 0,
        trecho: tr,
        fiada: i,
        furosGrauteados: ehCan ? undefined : furosDoBloco(k, larg),
      });
    }
  };
  // Y da peça da haste (enterrado: atrás do muro; aparente: espelho na frente)
  const yHaste = (y0: number, comp: number) => (aparente ? t - y0 - comp : y0);

  for (let i = 0; i < nf; i++) {
    const P = can.has(i) || i % 2 === parP;
    if (tipo === 'balanco') {
      for (const [a, b] of trechos) corrida(a, b, i);
      continue;
    }
    if (P) corrida(0, n, i);
    else for (let j = 0; j + 1 < hastes.length; j++) corrida(hastes[j] + 1, hastes[j + 1], i);
    hastes.forEach((s, j) => {
      const z = 200 * i + 10;
      const x = s * m;
      const cf = j + 1;
      const pref = `T1.CF${cf}.f${String(i).padStart(2, '0')}`;
      let inicio = 0;
      if (!P) {
        pecas.push({ id: id(pref), tipo: 'BLOCO', grupo: 'contraforte', contraforte: cf, geometria: gBloco,
          origem: [x, yHaste(0, L), z], giro: 90, trecho: 1, fiada: i, furosGrauteados: [0, 1] });
        inicio = 1;
      }
      for (const [jj, larg] of preencher(inicio, ns, P ? i + 1 : i)) {
        const comp = larg === 2 ? L : Lm;
        pecas.push({ id: id(pref), tipo: larg === 2 ? 'BLOCO' : 'MEIO_BLOCO', grupo: 'contraforte', contraforte: cf,
          geometria: larg === 2 ? gBloco : gMeio, origem: [x, yHaste(t + 10 + jj * m, comp), z], giro: 90, trecho: 1, fiada: i,
          furosGrauteados: larg === 2 ? [0, 1] : [0] });
      }
    });
  }

  // ── graute ──────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const k of [...grauteadas].sort((a, b) => a - b)) {
    const xc = k * m + c0;
    pecas.push({ id: `T${trechoDaCelula(k)}.GF.c${String(k).padStart(3, '0')}`, tipo: 'GRAUTE_FURO', grupo: hastes.includes(k) ? 'contraforte' : 'muro',
      geometria: gGrauteCol, origem: [xc - lF / 2, hf, 0], giro: 0, trecho: trechoDaCelula(k),
      contraforte: hastes.includes(k) ? hastes.indexOf(k) + 1 : undefined });
  }
  hastes.forEach((s, j) => {
    for (let jj = 0; jj < ns; jj++) {
      const yc = t + 10 + jj * m + c0;
      pecas.push({ id: `T1.CF${j + 1}.GF.h${jj}`, tipo: 'GRAUTE_FURO', grupo: 'contraforte', contraforte: j + 1, geometria: gGrauteCol,
        origem: [s * m + hf, aparente ? t - yc - lF / 2 : yc - lF / 2, 0], giro: 90, trecho: 1 });
    }
  });
  for (const i of can) {
    for (const [a, b] of trechos) {
      const len = b * m - 10 - a * m;
      const chave = `graute canaleta ${len}`;
      g[chave] ??= geometria(chave, 'X', ret(0, 0, w, 170), len);
      pecas.push({ id: `T${trechoDaCelula(a)}.GC.f${String(i).padStart(2, '0')}`, tipo: 'GRAUTE_CANALETA', grupo: 'muro', geometria: chave,
        origem: [a * m, hf, 200 * i + 30], giro: 0, trecho: trechoDaCelula(a), fiada: i });
    }
  }

  // ── fundação, drenagem, terreno ────────────────────────────────────────────────────────────────────────────────
  const yPe = t / 2 + a_ater - B;
  const yAt = t / 2 + a_ater;
  for (const [a, b] of trechos) {
    const x0 = a * m;
    const len = b * m - 10 - x0;
    const tr = trechoDaCelula(a);
    const chave = `sapata ${len}`;
    const yd0 = B / 2 - b_den / 2, yd1 = B / 2 + b_den / 2;
    g[chave] ??= geometria(chave, 'X', [[0, h_den], [yd0, h_den], [yd0, 0], [yd1, 0], [yd1, h_den], [B, h_den], [B, h_den + h_sap], [0, h_den + h_sap]], len, [], 'sapata corrida');
    pecas.push({ id: `SAP.T${tr}`, tipo: 'SAPATA', grupo: 'fundacao', geometria: chave, origem: [x0, yPe, -h_sap - h_den], giro: 0, trecho: tr });
    if (o.terreno) {
      const ca = `aterro ${len}`;
      g[ca] ??= geometria(ca, 'X', ret(0, 0, 1500, H_solo), len);
      pecas.push({ id: `TER.A.T${tr}`, tipo: 'ATERRO', grupo: 'terreno', geometria: ca, origem: [x0, t, 0], giro: 0, trecho: tr });
    }
  }
  if (o.dreno ?? true) {
    const ed = 200;
    const hd = H_solo - 300;
    const vaos: [number, number][] =
      tipo === 'balanco'
        ? trechos.map(([a, b]) => [a * m, b * m - 10])
        : aparente
          ? [[0, n * m - 10]]
          : hastes.slice(0, -1).map((s, j) => [s * m + t, hastes[j + 1] * m]);
    vaos.forEach(([x0, x1], j) => {
      const chave = `dreno ${x1 - x0}`;
      g[chave] ??= geometria(chave, 'X', ret(0, 0, ed, hd), x1 - x0);
      pecas.push({ id: `DRN.v${j + 1}`, tipo: 'DRENO', grupo: 'drenagem', geometria: chave, origem: [x0, t, 0], giro: 0, trecho: 1 });
      const a = o.areia ?? 0;
      if (a > 0) {
        const ca = `areia ${a} ${x1 - x0}`;
        g[ca] ??= geometria(ca, 'X', ret(0, 0, a, hd), x1 - x0);
        pecas.push({ id: `ARE.v${j + 1}`, tipo: 'AREIA', grupo: 'drenagem', geometria: ca, origem: [x0, t + ed, 0], giro: 0, trecho: 1 });
      }
    });
  }
  if (o.barbaca ?? true) {
    const gb = 'barbaca 50';
    g[gb] = geometria(gb, 'Y', circulo(25, 25, 25), t);
    for (let alvo = 750; alvo < n * m - 200; alvo += 1500) {
      let k = Math.round((alvo - c0) / m);
      while (grauteadas.has(k) && k < n - 1) k++;
      if (grauteadas.has(k)) continue;
      pecas.push({ id: `DRN.b${k}`, tipo: 'BARBACA', grupo: 'drenagem', geometria: gb, origem: [k * m + c0 - 25, 0, 75], giro: 0, trecho: trechoDaCelula(k) });
    }
  }

  // ── barras ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const posicoes = new Map<string, string>();
  const pos = (papel: PapelBarra, phi: number, forma: string) => {
    const k = `${papel}|${phi}|${forma}`;
    if (!posicoes.has(k)) posicoes.set(k, `N${posicoes.size + 1}`);
    return posicoes.get(k)!;
  };
  let nb = 0;
  const barra = (papel: PapelBarra, phi: number, eixo: Vec3[], trecho: number, forma: string, extra: Partial<Barra> = {}) =>
    barras.push({ id: `B${++nb}`, posicao: pos(papel, phi, forma), papel, diametro: phi, eixo, comprimento: comprimento(eixo, extra.fechada), trecho, ...extra });

  const phiSap = 10, phiSap2 = 6.3;
  const zEsp = (phi: number) => -h_sap + cob + phiSap + phiSap2 + phi / 2;
  const l0 = 440;
  const vertical = (x: number, y: number, phi: number, tr: number, papel: PapelBarra, extra: Partial<Barra> = {}) => {
    barra(papel, phi, [[x, y, 0], [x, y, H - 30]], tr, 'reta', extra);
    const xe = x + phi;
    barra('ESPERA', phi, [[xe, y + 12 * phi, zEsp(phi)], [xe, y, zEsp(phi)], [xe, y, l0]], tr, 'gancho', extra);
  };
  for (const k of celBarra) {
    const xc = k * m + c0;
    const tr = trechoDaCelula(k);
    if (tipo === 'balanco') vertical(xc, o.d ?? t - 50, 10, tr, 'VERT_MURO');
    else for (const y of [50, t - 50]) vertical(xc, y, 10, tr, 'VERT_MURO');
  }
  hastes.forEach((s, j) => {
    const xc = s * m + c0;
    const cf = j + 1;
    if (!aparente) for (const dy of [-20, 0, 20]) vertical(xc, tenr - c0 + dy, 10, 1, 'CF_PRINCIPAL', { contraforte: cf });
    else for (const dx of [-20, 0, 20]) vertical(xc + dx, t - 70, 10, 1, 'CF_PRINCIPAL', { contraforte: cf });
    for (const y of [60, 80]) barra('CF_CONSTRUTIVA', 10, [[xc, aparente ? t - tenr + y : y, 0], [xc, aparente ? t - tenr + y : y, H - 30]], 1, 'reta', { contraforte: cf });
    const [y0, y1] = aparente ? [t - tenr + 45, t - 45] : [45, tenr - 45];
    for (let i = 0; i < nf; i++) {
      const z = 200 * i + 5;
      barra('CF_ESTRIBO', 6.3, [[xc - 60, y0, z], [xc + 60, y0, z], [xc + 60, y1, z], [xc - 60, y1, z]], 1, 'estribo', { contraforte: cf, fechada: true });
    }
  });
  for (const i of [...can].sort((a, b) => a - b)) {
    const phi = i === nf - 1 && cinta ? 10 : tipo === 'balanco' ? 10 : 12.5;
    const z = 200 * i + 10 + 20 + 15 + phi / 2;
    for (const [a, b] of trechos) {
      const x0 = a * m + 30, x1 = b * m - 10 - 30;
      barra('HORIZ', phi, [[x0, t / 2, z - 10 * phi], [x0, t / 2, z], [x1, t / 2, z], [x1, t / 2, z - 10 * phi]], trechoDaCelula(a), `h${b - a}`);
    }
  }
  for (const [a, b] of trechos) {
    const x0 = a * m, x1 = b * m - 10;
    const tr = trechoDaCelula(a);
    const z = -h_sap + cob + phiSap / 2;
    const hg = h_sap - 2 * cob;
    for (let x = x0 + cob; x <= x1 - cob + 0.1; x += 150)
      barra('SAP_TRANSV', phiSap, [[x, yPe + cob, z + hg], [x, yPe + cob, z], [x, yAt - cob, z], [x, yAt - cob, z + hg]], tr, 'U');
    const zl = z + phiSap / 2 + phiSap2 / 2;
    for (let y = yPe + cob + 20; y <= yAt - cob - 20 + 0.1; y += 200)
      barra('SAP_LONG', phiSap2, [[x0 + cob, y, zl], [x1 - cob, y, zl]], tr, `l${b - a}`);
  }

  const L_real = n * m - 10;
  return {
    versao: 'exemplo-desenhos',
    familia: { nome: fam.nome, t, L, Lm, m, h: fam.h, hf, junta: 10, provisoria: fam.provisoria },
    geometrias: g,
    pecas,
    barras,
    ajustes: [],
    avisos: [],
    dims: {
      L_real,
      H_solo,
      H_muro: H,
      n_fiadas: nf,
      trechos: trechos.map(([a, b]) => ({ x0: a * m, x1: b * m - 10 })),
      contrafortes: hastes.map((s) => ({ x: s * m + c0, trecho: 1, ponta: s === 0 || s === n - 1 })),
      sapata: { y0: yPe, y1: yAt, z0: -h_sap - h_den, z1: 0 },
    },
  };
}
