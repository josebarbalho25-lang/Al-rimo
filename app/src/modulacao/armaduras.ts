/*
  ARMADURAS DO MURO — barras verticais (balanço, painel, contraforte), esperas e horizontais das canaletas.

  Toda barra vertical é posta procurando o furo de VERDADE de cada fiada (cavidades.ts): onde a conta pede a barra
  (d) e o furo não deixa (graute < 15 mm, ou a barra sai do furo), o desenho mostra onde ela cabe e avisa. O
  desenho não esconde o que a conta não viu — mas também não desenha barra dentro do bloco.
*/
import type { Aviso } from '@/modelo/tipos';
import { H_FIADA, JUNTA, pecaDoCatalogo, secaoDaPecaCanaleta } from './catalogo';
import type { MapaDeCavidades } from './cavidades';
import { br, type TrechoModulado } from './modular';
import { COB_GRAUTE, COB_PONTA, RECUO_ESTRIBO, RECUO_ESTRIBO_LATERAL, pad, zTopoBarra, type Ctx } from './contexto';
import {
  corrida, dobrada, espera, esperaNoDeCachorro, estribo, ganchoEstribo, medidasDoEstribo, medidasDoNo, pontaDoNo, pontaGancho90, raioDoEixo,
  raioDoEstribo, reta, type BarraNova, type SapataDoNo,
} from './barras';
import type { FiadaMontada } from './fiadas';
import { arred } from './perfis';
import { arrumarGrupo, type Arranjo } from './arranjo';
import { cDaMontagem } from './secaoDoContraforte';

export interface Vertical {
  barra: BarraNova;
  x: number;
  y: number;
  phi: number;
  grupo: string;               // barras do mesmo furo (não podem se atropelar)
  desvio: 'X' | 'Y';           // para onde a espera desvia primeiro (ao longo do furo)
  esperaEm?: [number, number]; // contraforte: a arrumação do grupo já reservou o lugar da espera
}

/** Barra isolada: fica no alvo se couber no furo em todas as fiadas; senão anda para o meio do bloco. */
function posicionarSimples(ctx: Ctx, mapa: MapaDeCavidades, x: number, yAlvo: number, phi: number): { y: number; folga: number } {
  const t = ctx.mod.cat.t;
  const z1 = zTopoBarra(ctx);
  let f = mapa.folga(x, yAlvo, phi / 2, 0, z1);
  if (f >= 0) return { y: yAlvo, folga: f };
  const passo = yAlvo <= t / 2 ? 1 : -1;
  for (let k = 1; k <= t; k++) {
    const y = yAlvo + passo * k;
    if ((passo > 0 && y > t / 2 + 1e-9) || (passo < 0 && y < t / 2 - 1e-9)) break;
    const fy = mapa.folga(x, y, phi / 2, 0, z1);
    if (fy >= 0) return { y, folga: fy };
  }
  f = mapa.folga(x, t / 2, phi / 2, 0, z1);
  return f >= 0 ? { y: t / 2, folga: f } : { y: yAlvo, folga: -Infinity };
}

function avisarFolga(ctx: Ctx, folga: number, ids: string[]): void {
  if (folga === -Infinity || folga < 0) {
    ctx.avisos.push({ codigo: 'BARRA_FORA_DO_FURO', texto: 'Barra vertical fora do furo do bloco', ids });
  } else if (folga < COB_GRAUTE - 0.05) {
    ctx.avisos.push({ codigo: 'COBRIMENTO_GRAUTE', texto: `Graute entre barra e bloco < ${COB_GRAUTE} mm`, ids });
  }
}

/** Barra vertical do muro e o registro dela para a espera e o graute. */
function vertical(ctx: Ctx, out: Vertical[], id: string, papel: BarraNova['papel'], phi: number, x: number, y: number, tr: number, grupo: string, desvio: 'X' | 'Y', cf?: number, esperaEm?: [number, number]): void {
  const b = reta(id, papel, phi, [x, y, 0], [x, y, zTopoBarra(ctx)], tr, cf);
  ctx.barras.push(b);
  const v: Vertical = { barra: b, x, y, phi, grupo, desvio };
  if (esperaEm) v.esperaEm = esperaEm;
  out.push(v);
}

/** Balanço: barra na 1ª e na última célula do trecho e a cada s entre elas (brief §5.5 — borda livre armada). */
export function barrasDoBalanco(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades, out: Vertical[]): void {
  const { mod, p } = ctx;
  const { m, cat } = mod;
  const t = cat.t;
  const n = Math.round((tr.x1 + JUNTA - tr.x0) / m);
  const passo = Math.max(1, Math.round(mod.s_vert / m));
  const celulas: number[] = [];
  for (let k = 0; k < n - 1; k += passo) celulas.push(k);
  celulas.push(n - 1);
  // Fig. 4: barra do lado do solo, a d da face comprimida (a aparente)
  const yAlvo = p.d_util ?? t / 2;
  let movidas = 0;
  let pior = Infinity;
  const ids: string[] = [];
  celulas.forEach((k, j) => {
    const x = tr.x0 + k * m + (m - JUNTA) / 2;
    const { y, folga } = posicionarSimples(ctx, mapa, x, yAlvo, p.phi_v);
    if (Math.abs(y - yAlvo) > 0.5) movidas++;
    const id = `T${tr.indice}.V.${pad(j + 1, 3)}`;
    vertical(ctx, out, id, 'VERT_MURO', p.phi_v, x, y, tr.indice, id, 'X');
    if (folga < COB_GRAUTE - 0.05) ids.push(id);
    pior = Math.min(pior, folga);
  });
  if (ids.length) avisarFolga(ctx, pior, ids);
  if (movidas) {
    const y = out[out.length - 1].y;
    ctx.avisos.push({ codigo: 'D_GEOMETRICO', texto: `d desenhado ${br(y / 10, 1)} cm × d da conta ${br(yAlvo / 10, 1)} cm (barra puxada para dentro do furo)` });
  }
}

/**
 * Painel entre contrafortes: o contraforte conta como apoio; a 1ª barra fica a s da face dele e nenhum trecho
 * entre apoios (contraforte ou barra) passa de s (brief §5.5, DEDUÇÃO — a Fig. 13 cola a 1ª barra no contraforte).
 * Duas barras por furo, uma em cada face a c (Fig. 14), ou uma centralizada.
 */
export function barrasDoPainel(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades, out: Vertical[]): void {
  const { mod, p } = ctx;
  const { m, cat } = mod;
  const t = cat.t;
  const sc = Math.max(1, Math.round(mod.s_pv / m));
  const ys = p.duasBarrasPv ? [p.c_pv, t - p.c_pv] : [t / 2];
  let n = 0;
  const ruins: string[] = [];
  let pior = Infinity;
  let movidas = 0;
  for (let v = 0; v + 1 < tr.nos.length; v++) {
    const a = tr.nos[v];
    const b = tr.nos[v + 1];
    const k = Math.round((b.xs - a.xe) / m);
    const cel: number[] = [];
    let j = -1;
    while (k - j > sc) {
      j = Math.min(j + sc, k - 1);
      cel.push(j);
    }
    for (const c of cel) {
      const x = a.xe + c * m + (m - JUNTA) / 2;
      const grupo = `T${tr.indice}.V.c${pad(n + 1, 3)}`;
      for (const yAlvo of ys) {
        const { y, folga } = posicionarSimples(ctx, mapa, x, yAlvo, p.phi_pv);
        if (Math.abs(y - yAlvo) > 0.5) movidas++;
        const id = `T${tr.indice}.V.${pad(++n, 3)}`;
        vertical(ctx, out, id, 'VERT_MURO', p.phi_pv, x, y, tr.indice, grupo, 'X');
        if (folga < COB_GRAUTE - 0.05) ruins.push(id);
        pior = Math.min(pior, folga);
      }
    }
  }
  if (ruins.length) avisarFolga(ctx, pior, ruins);
  if (movidas) ctx.avisos.push({ codigo: 'D_GEOMETRICO', texto: 'Barra vertical do painel puxada para dentro do furo (d desenhado ≠ d da conta)' });
}

// ── contraforte ──────────────────────────────────────────────────────────────

/** O grupo no muro: a barra tem de caber em todas as fiadas que atravessa; a espera, nas do traspasse. */
function arranjar(ctx: Ctx, mapa: MapaDeCavidades, cx: number, cy: number, n: number, phi: number, eixo: 'X' | 'Y', l0: number): Arranjo {
  const z1 = zTopoBarra(ctx);
  return arrumarGrupo(
    (x, y, raio) => mapa.folga(x, y, raio, 0, z1),
    (x, y, raio) => mapa.folga(x, y, raio, 0, l0),
    cx, cy, n, phi, eixo,
  );
}

/**
 * As barras de um papel do contraforte, distribuídas pelos furos em ordem (o 1º é o da conta): todas no 1º se
 * couberem; senão o máximo que cabe em cada um, do 1º para dentro. Devolve a arrumação e quantos furos usou.
 */
function distribuir(ctx: Ctx, mapa: MapaDeCavidades, cx: number, alvos: number[], n: number, phi: number, eixo: 'X' | 'Y', l0: number): { pares: { b: [number, number]; e: [number, number] }[]; furos: number; folga: number } {
  const tudo = arranjar(ctx, mapa, cx, alvos[0], n, phi, eixo, l0);
  const pares = (a: Arranjo) => a.barras.map((b, k) => ({ b, e: a.esperas[k] }));
  if (tudo.folga >= 0 || alvos.length < 2) return { pares: pares(tudo), furos: 1, folga: tudo.folga };
  const out: { b: [number, number]; e: [number, number] }[] = [];
  let resta = n;
  let furos = 0;
  let folga = Infinity;
  for (const cy of alvos) {
    if (!resta) break;
    // maior k que cabe neste furo (busca binária: se k cabe, k − 1 cabe)
    let lo = 0;
    let hi = resta;
    let achado: Arranjo | null = null;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const a = arranjar(ctx, mapa, cx, cy, mid, phi, eixo, l0);
      if (a.folga >= 0) {
        lo = mid;
        achado = a;
      } else {
        hi = mid - 1;
      }
    }
    if (lo > 0) {
      if (!achado || achado.barras.length !== lo) achado = arranjar(ctx, mapa, cx, cy, lo, phi, eixo, l0);
      out.push(...pares(achado));
      folga = Math.min(folga, achado.folga);
      resta -= lo;
      furos++;
    }
  }
  if (resta > 0) return { pares: pares(tudo), furos: 1, folga: tudo.folga };
  return { pares: out, furos, folga };
}

export function barrasDosContrafortes(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades, out: Vertical[]): void {
  const { mod, p } = ctx;
  const { m, cat } = mod;
  const t = cat.t;
  const enterrado = p.enterrado;
  const yDe = (eta: number): number => (enterrado ? eta : t - eta);
  // c da conta (planilha: o da montagem do Revit, ou o digitado nas Entradas). O furo onde a barra passa reta é o
  // trecho comum às fiadas P e I (secaoDoContraforte.ts) — a mesma conta que a planilha tabelou; só avisa se o c
  // digitado tirar a barra do centro dele.
  const meioCelula = (m - JUNTA) / 2;
  let cGeo = meioCelula;
  try {
    cGeo = cDaMontagem(cat.nome, mod.tenr, enterrado ? 'enterrado' : 'aparente');
  } catch {
    /* contraforte sem furo reconhecível na ponta: fica o centro da célula */
  }
  const cCf = p.c_cf ?? cGeo;
  if (Math.abs(cCf - cGeo) > 0.5) {
    ctx.avisos.push({ codigo: 'D_GEOMETRICO_CF', texto: `Contraforte: barra a ${br(cCf / 10, 1)} cm da ${enterrado ? 'ponta' : 'face do solo'}; centro do furo a ${br(cGeo / 10, 1)} cm` });
  }
  // furos do contraforte ao longo de η: o do muro (t/2) e os da haste (centro de cada célula)
  const celulas = Array.from({ length: mod.n_haste }, (_, j) => t + JUNTA + j * m + meioCelula);
  // tracionada: enterrado → da ponta para o muro; aparente → do muro (junto ao solo) para a ponta (Fig. 12)
  const furosTracao = enterrado ? [...celulas].reverse().concat([t / 2]) : [t / 2, ...celulas];
  const furosCompressao = [...furosTracao].reverse();
  const l0P = traspasse(ctx, p.phi_cf, 'cf');
  const l0C = traspasse(ctx, p.phi_cc, 'cc');

  for (const no of tr.nos) {
    const base = `T${tr.indice}.CF${no.cf}`;
    // principal: tracionada; o 1º alvo é o c da conta, os seguintes o centro dos furos
    const alvoConta = enterrado ? mod.tenr - cCf : cCf;
    let g = distribuir(ctx, mapa, no.xc, [yDe(alvoConta), ...furosTracao.slice(1).map(yDe)], p.n_cf, p.phi_cf, 'Y', l0P);
    if (g.folga < 0 || g.furos > 1) {
      const g2 = distribuir(ctx, mapa, no.xc, furosTracao.map(yDe), p.n_cf, p.phi_cf, 'Y', l0P);
      if (g2.furos < g.furos || (g2.furos === g.furos && g2.folga > g.folga)) g = g2;
    }
    const idsP: string[] = [];
    g.pares.forEach(({ b, e }, k) => {
      const id = `${base}.P${k + 1}`;
      vertical(ctx, out, id, 'CF_PRINCIPAL', p.phi_cf, b[0], b[1], tr.indice, `${base}.P`, 'X', no.cf, e);
      idsP.push(id);
    });
    if (g.folga < 0) {
      ctx.avisos.push({ codigo: 'BARRAS_NAO_CABEM', texto: `${p.n_cf} barras de Ø${br(p.phi_cf, 1)} não cabem no contraforte`, ids: idsP });
    } else {
      if (g.folga < COB_GRAUTE - 0.05) avisarFolga(ctx, g.folga, idsP);
      if (g.furos > 1) {
        const yc = g.pares.reduce((s, q) => s + q.b[1], 0) / g.pares.length;
        const dDes = enterrado ? yc : mod.tenr - (t - yc);
        const dConta = mod.tenr - cCf;
        ctx.avisos.push({ codigo: 'BARRAS_EM_MAIS_FUROS', texto: `${p.n_cf} barras de Ø${br(p.phi_cf, 1)} em ${g.furos} furos do contraforte: d desenhado ${br(dDes / 10, 1)} cm × d da conta ${br(dConta / 10, 1)} cm`, ids: idsP });
      }
    }

    // construtivas: na outra ponta do estribo (aula 12.3: estribo 50 × 7 com 2Ø10 numa ponta e 3Ø10 na outra)
    if (p.n_cc > 0) {
      const dC = RECUO_ESTRIBO + p.phi_est + p.phi_cc / 2;
      const etaC = enterrado ? dC : mod.tenr - dC;
      const gc = distribuir(ctx, mapa, no.xc, [yDe(etaC), ...furosCompressao.slice(1).map(yDe)], p.n_cc, p.phi_cc, 'X', l0C);
      const idsC: string[] = [];
      gc.pares.forEach(({ b, e }, k) => {
        const id = `${base}.C${k + 1}`;
        vertical(ctx, out, id, 'CF_CONSTRUTIVA', p.phi_cc, b[0], b[1], tr.indice, `${base}.C`, 'Y', no.cf, e);
        idsC.push(id);
      });
      if (gc.folga < 0) ctx.avisos.push({ codigo: 'BARRAS_NAO_CABEM', texto: `${p.n_cc} barras construtivas de Ø${br(p.phi_cc, 1)} não cabem no contraforte`, ids: idsC });
      else if (gc.folga < COB_GRAUTE - 0.05) avisarFolga(ctx, gc.folga, idsC);
    }

    // estribos fechados na junta de assentamento, um a cada s_est, a partir da junta sobre a sapata — só quando a
    // conta pede (leitura.ts, `estribos`): estribo sem necessidade não é usual em alvenaria (Jose, 13/10).
    // Os ganchos ficam no canto do lado do MURO (ya): é a ponta comprimida do contraforte, a das construtivas — o
    // gancho fora da zona tracionada, como na viga do Pró-Viga (ganchos em cima)
    const meia = t / 2 - RECUO_ESTRIBO_LATERAL;
    const ya = yDe(RECUO_ESTRIBO);
    const yb = yDe(mod.tenr - RECUO_ESTRIBO);
    const passoJ = Math.max(1, Math.round(mod.s_est / H_FIADA));
    for (let i = 0; p.estribos && i < mod.n_fiadas; i += passoJ) {
      const z = i * H_FIADA + JUNTA / 2;
      ctx.barras.push(estribo(`${base}.E${pad(i, 2)}`, 'CF_ESTRIBO', p.phi_est,
        [[no.xc - meia, ya, z], [no.xc + meia, ya, z], [no.xc + meia, yb, z], [no.xc - meia, yb, z]], tr.indice, no.cf, passoNaJunta(p.phi_est)));
    }
  }
  if (!p.estribos) return;
  if (p.phi_est > 6.3) ctx.avisos.push({ codigo: 'ESTRIBO_NA_JUNTA', texto: `Estribo Ø${br(p.phi_est, 1)} na junta de 10 mm` });
  avisarMedidasDoEstribo(ctx, 'Estribo do contraforte', p.phi_est, 2 * (t / 2 - RECUO_ESTRIBO_LATERAL), mod.tenr - 2 * RECUO_ESTRIBO, 'ESTRIBO');
  // na largura do bloco só cabe um estribo fechado (2 ramos); mais ramos não têm desenho simples — DEDUÇÃO
  if (p.ramos_est !== 2) ctx.avisos.push({ codigo: 'ESTRIBO_RAMOS', texto: `Estribo do contraforte com ${p.ramos_est} ramos: desenhado fechado, 2 ramos` });
}

/**
 * O degrau da volta do estribo do contraforte, que mora na junta de 10 mm: uma bitola (Pró-Viga) enquanto a volta
 * cabe na junta — o Ø5 cabe inteiro (2φ = 10 mm) —; acima disso, o que sobra da junta. No Ø6,3 a barra passa duas
 * vezes no canto dos ganchos (12,6 mm): desenhada com o degrau de 3,7 mm, as duas passadas ficam 2,6 mm uma dentro
 * da outra no desenho, mas nenhuma entra no bloco.
 */
function passoNaJunta(phi: number): number {
  return Math.max(0, Math.min(phi, JUNTA - phi));
}

/**
 * O estribo que a seção não comporta (barras.ts, medidasDoEstribo): dobra mais apertada que o pino da NBR, ou
 * ponta do gancho de 135° abaixo da NBR (5φ ≥ 5 cm).
 */
export function avisarMedidasDoEstribo(ctx: Ctx, quem: string, phi: number, a: number, b: number, prefixo: 'ESTRIBO' | 'SAPATA' | 'TORCAO'): void {
  const m = medidasDoEstribo(phi, a, b);
  const avisos: Aviso[] = [];
  if (m.dobraApertada) {
    avisos.push({ codigo: `${prefixo}_DOBRA`, texto: `${quem} Ø${br(phi, 1)}: dobra com raio ${br(m.raio / 10, 1)} cm no eixo (o pino da NBR pede ${br(raioDoEstribo(phi) / 10, 1)} cm)` });
  }
  if (m.pontaCurta) {
    avisos.push({ codigo: `${prefixo}_GANCHO`, texto: `${quem} Ø${br(phi, 1)}: ponta do gancho de ${br(m.ponta / 10, 1)} cm (a NBR pede ${br(ganchoEstribo(phi) / 10, 1)} cm)` });
  }
  // a mesma seção em todos os trechos: um aviso para o muro todo
  for (const av of avisos) if (!ctx.avisos.some((x) => x.codigo === av.codigo && x.texto === av.texto)) ctx.avisos.push(av);
}

// ── esperas ──────────────────────────────────────────────────────────────────

/**
 * Onde fica a emenda: as esperas têm a linha delas na planilha (v = balanço, pv = painel, cf = principal do
 * contraforte, cc = construtivas); as outras emendas, no graute (horizontal da canaleta) ou no concreto da sapata.
 */
export type Emenda = 'v' | 'pv' | 'cf' | 'cc' | 'graute' | 'concreto';

/**
 * Traspasse (mm). O digitado manda — quem defasa as emendas digita menos. Senão, a conta da NBR 6118 9.5.2.2.1
 * (Jose, 13/10: "2,0 × ℓb no graute"; aba Fundação, seção 10): ℓ0t = α0t·ℓb·As,calc/As,ef ≥ máx(0,3·α0t·ℓb; 15φ;
 * 20 cm). Esperas: a célula da planilha. Outras emendas: o mesmo α0t e o ℓb em diâmetros do material onde a emenda
 * fica, com As,calc/As,ef = 1 (a favor: a corrida da canaleta e a longitudinal da sapata não têm As de cálculo por
 * barra). Sem a conta: 50φ, com aviso (entorno.ts).
 */
export function traspasse(ctx: Ctx, phi: number, emenda: Emenda): number {
  const { p } = ctx;
  if (p.traspasse !== null) return p.traspasse;
  if (emenda !== 'graute' && emenda !== 'concreto') {
    const l = p.l0t[emenda];
    if (l !== null && l > 0) return l;
  }
  const lbphi = emenda === 'concreto' ? p.lbphi_c : p.lbphi_gr;
  if (lbphi !== null && lbphi > 0 && p.a0t !== null && p.a0t > 0) {
    return Math.ceil(Math.max(p.a0t * lbphi * phi, 15 * phi, 200) / 10) * 10;
  }
  return 50 * phi;
}

/** A emenda da espera de uma barra vertical: pelo papel da barra (o painel e o balanço usam o mesmo papel). */
function emendaDaEspera(ctx: Ctx, v: Vertical): Emenda {
  if (v.barra.papel === 'CF_PRINCIPAL') return 'cf';
  if (v.barra.papel === 'CF_CONSTRUTIVA') return 'cc';
  return ctx.p.contrafortes ? 'pv' : 'v';
}

/**
 * Uma espera por barra vertical (no painel com 2 barras, nas duas — brief Q9), Ø da barra, ao lado dela no mesmo
 * furo (emenda por contato), com gancho no pé apontando para o solo (Fig. 1 e 9) quando cabe no talão.
 */
export function esperas(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades, vs: Vertical[], Ype: number, YbA: number): void {
  const { p } = ctx;
  const zPeBase = -p.h_sap + p.cob_sap + p.phi_sap + p.phi_sap2;
  const ocupadas = new Map<string, { x: number; y: number; phi: number }[]>();
  for (const v of vs) {
    const lista = ocupadas.get(v.grupo) ?? [];
    lista.push({ x: v.x, y: v.y, phi: v.phi });
    if (v.esperaEm) lista.push({ x: v.esperaEm[0], y: v.esperaEm[1], phi: v.phi });
    ocupadas.set(v.grupo, lista);
  }
  let n = 0;
  const fora: string[] = [];
  // o arranque escolhido (Jose, 15/10): a espera de sempre ou o nó de cachorro (barras.ts, a forma do Revit dele)
  const no = p.arranque === 'no';
  const sap: SapataDoNo = { h: p.h_sap, c: p.cob_sap, yFrente: Ype, yTalao: YbA };
  const nosX: number[] = [];
  for (const v of vs) {
    const l0 = traspasse(ctx, v.phi, emendaDaEspera(ctx, v));
    let pos: [number, number] | null = v.esperaEm ?? null;
    if (pos && mapa.folga(pos[0], pos[1], v.phi / 2, 0, l0) < 0) fora.push(v.barra.id);
    if (!pos) {
      const lista = ocupadas.get(v.grupo)!;
      const desvios: [number, number][] = v.desvio === 'X'
        ? [[v.phi, 0], [-v.phi, 0], [0, v.phi], [0, -v.phi]]
        : [[0, v.phi], [0, -v.phi], [v.phi, 0], [-v.phi, 0]];
      for (const [dx, dy] of desvios) {
        const x = v.x + dx;
        const y = v.y + dy;
        if (lista.some((o) => Math.hypot(o.x - x, o.y - y) < (o.phi + v.phi) / 2 - 0.01)) continue;
        if (mapa.folga(x, y, v.phi / 2, 0, l0) < 0) continue;
        pos = [x, y];
        break;
      }
      if (!pos) {
        pos = [v.x + v.phi, v.y];
        fora.push(v.barra.id);
      }
      lista.push({ x: pos[0], y: pos[1], phi: v.phi });
    }
    const R = raioDoEixo(v.phi);
    const alcance = R + pontaGancho90(v.phi) + v.phi / 2;
    const sentido: 1 | -1 = pos[1] + alcance <= YbA - p.cob_sap ? 1 : pos[1] - alcance >= Ype + p.cob_sap ? -1 : 1;
    const id = v.barra.contraforte !== undefined ? `${v.barra.id}.E` : `T${tr.indice}.E.${pad(++n, 3)}`;
    if (no) {
      const x = arred(pos[0]);
      // dois nós no mesmo plano (o painel com duas barras por furo, o feixe do contraforte): as pernas deitadas
      // correriam uma em cima da outra — o 2º anda a subida para o outro lado
      const lado: 1 | -1 = nosX.filter((q) => Math.abs(q - x) < 2 * v.phi + 1).length % 2 ? -1 : 1;
      const b = esperaNoDeCachorro(id, v.phi, x, arred(pos[1]), l0, sap, tr.indice, v.barra.contraforte, lado);
      if (!b) {
        // a barra não existe com essa dobra nessa sapata: não desenha, e o aviso diz por quê
        avisarNoQueNaoCabe(ctx, v.phi, id);
        continue;
      }
      nosX.push(x);
      ctx.barras.push(b);
    } else {
      ctx.barras.push(espera(id, v.phi, arred(pos[0]), arred(pos[1]), zPeBase + v.phi / 2, l0, p.gancho, sentido, tr.indice, v.barra.contraforte));
    }
    mapa.marcar(pos[0], pos[1], 0, l0);
  }
  if (fora.length) ctx.avisos.push({ codigo: 'ESPERA_FORA_DO_FURO', texto: 'Espera sem lugar no furo ao lado da barra', ids: fora });
  if (no) avisarPontaDoNo(ctx, vs, Ype);
}

/** O aviso que se repete por trecho junta os ids num só. */
function avisarJuntando(ctx: Ctx, a: Aviso): void {
  const ja = ctx.avisos.find((x) => x.codigo === a.codigo && x.texto === a.texto);
  if (!ja) ctx.avisos.push(a);
  else if (a.ids) ja.ids = [...(ja.ids ?? []), ...a.ids];
}

/** Por que o nó não coube: a altura da sapata para a dobra (Jose: "a dobra nó de cachorro tem limites pela curvatura
 *  do aço" — h ≥ 2c + pino + 2φ) ou a ponta (as duas dobras do pé não cabem entre a espera e a face da ponta). */
function avisarNoQueNaoCabe(ctx: Ctx, phi: number, id: string): void {
  const { p } = ctx;
  const { subida } = medidasDoNo(phi, p.h_sap, p.cob_sap);
  if (subida < -1e-6) {
    avisarJuntando(ctx, {
      codigo: 'NO_DE_CACHORRO_DOBRA',
      texto: `Nó de cachorro Ø${br(phi, 1)}: a dobra pede sapata de ${br((p.h_sap - subida) / 10, 1)} cm (tem ${br(p.h_sap / 10, 1)}) — espera não desenhada`,
      ids: [id],
    });
  } else {
    avisarJuntando(ctx, { codigo: 'NO_DE_CACHORRO_FORA', texto: `Nó de cachorro Ø${br(phi, 1)}: a ponta da sapata não comporta as dobras do pé — espera não desenhada`, ids: [id] });
  }
}

/** A ponta da sapata (o pé, na frente da face do muro) contra a tabela do Jose para o bloco (barras.ts, PONTA_DO_NO). */
function avisarPontaDoNo(ctx: Ctx, vs: Vertical[], Ype: number): void {
  const familia = ctx.mod.cat.nome;
  const ponta = -Ype;
  for (const phi of [...new Set(vs.map((v) => v.phi))].sort((a, b) => a - b)) {
    const r = pontaDoNo(familia, phi);
    if (!r) continue;
    const bloco = familia === '14x39' ? 'bloco 14' : 'bloco 19';
    if (r.ponta === null) {
      avisarJuntando(ctx, { codigo: 'NO_DE_CACHORRO_PONTA', texto: `Nó de cachorro Ø${br(phi, 1)} não cabe no ${bloco} (a emenda passa de 8 % do furo)` });
    } else if (ponta < r.ponta - 0.5) {
      avisarJuntando(ctx, {
        codigo: 'NO_DE_CACHORRO_PONTA',
        texto: `Nó de cachorro Ø${br(phi, 1)}: ponta da sapata de ${br(ponta / 10, 1)} cm, o ${bloco} pede ${br(r.ponta / 10, 0)} cm${r.aConfirmar ? ' (a confirmar)' : ''}`,
      });
    }
  }
}

// ── horizontais nas canaletas ────────────────────────────────────────────────

/** A barra da canaleta do muro numa fiada: Ø, eixo (y, z) e o desvio das barras emendadas (lado a lado, em y). */
export interface BarraDaCanaleta { phi: number; y: number; z: number; lado: number }

export function barraDaCanaletaDoMuro(ctx: Ctx, f: FiadaMontada): BarraDaCanaleta {
  const { mod, p } = ctx;
  const t = mod.cat.t;
  const { parede } = mod.cat.canaleta;
  // canaleta da conta (espaçamento s): Ø e posição da conta; só cinta: Ø da cinta, centralizada — DEDUÇÃO no
  // balanço, que não tem Ø de barra horizontal nas Entradas (a aula usou Ø10)
  const daConta = mod.s_can > 0 && ((f.i + 1) * H_FIADA) % mod.s_can === 0;
  const phi = p.contrafortes && daConta ? p.phi_ph : p.phi_cinta;
  const y = p.contrafortes && daConta && !p.phCentralizada ? p.c_pv : t / 2;
  // a barra é reta e corre por canaletas de fundos diferentes (a cortada da 19 tem 1 cm a mais): fica no mais alto,
  // para ter o graute mínimo em cima de todas — também nas da haste, onde corre a barra do contraforte (mesmo z)
  let fundo = mod.cat.canaleta.fundo;
  const pecas = [...f.linha.map((it) => it.chave), ...f.hastes.flatMap((h) => h.map((it) => it.chave))];
  for (const ch of pecas) {
    const pc = pecaDoCatalogo(mod.cat, ch);
    if (pc.forma === 'canaleta') fundo = Math.max(fundo, secaoDaPecaCanaleta(mod.cat, pc).fundo);
  }
  const z = f.i * H_FIADA + JUNTA + fundo + COB_GRAUTE + phi / 2;
  // barras emendadas (a corrida do balanço): a 2ª encosta ao lado da 1ª
  const lado = y + 1.5 * phi <= t - parede ? phi : -phi;
  return { phi, y, z, lado };
}

/**
 * Horizontais das canaletas. Balanço: a corrida reta de ponta a ponta do trecho, em barras comerciais com traspasse.
 * Com contrafortes: o U de cada vão (barrasEmU).
 */
export function horizontais(ctx: Ctx, tr: TrechoModulado, fiadas: FiadaMontada[], canaleta: boolean[]): void {
  if (tr.nos.length >= 2) {
    barrasEmU(ctx, tr, fiadas, canaleta);
    return;
  }
  for (const f of fiadas) {
    if (!canaleta[f.i]) continue;
    const { phi, y, z, lado } = barraDaCanaletaDoMuro(ctx, f);
    const barras = corrida(`T${tr.indice}.H.f${pad(f.i, 2)}.`, 'HORIZ', phi, tr.x0 + COB_PONTA, tr.x1 - COB_PONTA, y, z, traspasse(ctx, phi, 'graute'), [0, lado, 0], tr.indice);
    ctx.barras.push(...barras);
  }
}

/** α da ancoragem com gancho (NBR 6118 9.4.2.5): a dobra de 90° da perna do U conta como gancho (Jose, 22/10). */
export const ALFA_GANCHO = 0.7;

/**
 * Ancoragem da perna do U no contraforte, mm (NBR 6118 9.4.2.5): ℓb,nec = α·ℓb ≥ ℓb,mín = máx(0,3·ℓb; 10φ; 100 mm),
 * com α = 0,7 — a dobra de 90° no pino da Tab. 9.1 conta como gancho (Jose, 22/10: "dobra conta como gancho") —
 * e As,calc/As,ef = 1 (a favor: a canaleta não tem As de cálculo por barra). ℓb = o da barra reta no graute (aba
 * Fundação, seção 10: fbd = 2,25·0,21·fgk^(2/3)/1,4; fgk 20 → 43,7φ). null = sem a conta.
 */
export function ancoragemDaPernaDoU(ctx: Ctx, phi: number): { lb: number; nec: number; peloMinimo: boolean } | null {
  const { lbphi_gr } = ctx.p;
  if (lbphi_gr === null || !(lbphi_gr > 0)) return null;
  const lb = lbphi_gr * phi;
  const minimo = Math.max(0.3 * lb, 10 * phi, 100);
  return { lb, nec: Math.max(ALFA_GANCHO * lb, minimo), peloMinimo: minimo > ALFA_GANCHO * lb };
}

/**
 * Barra da canaleta com contrafortes (Jose, 12/10): em vez da corrida com traspasse e do L de cada contraforte, um U
 * por vão — "é mais fácil dobrar a barra em U do que fazer um traspasse e depois um L". Em cada fiada de canaleta
 * (intermediárias e cinta) e em cada vão: a base corre na canaleta do muro, de um contraforte ao outro, e as duas
 * pernas entram nas canaletas dos contrafortes até a ponta deles (cobrimento COB_PONTA) — cada barra engastada duas
 * vezes; vários U em sequência, sem emenda. No contraforte do meio as pernas dos dois vãos ficam lado a lado,
 * encostadas, φ/2 de cada lado do eixo; no da ponta, a perna fica no mesmo lugar (φ/2 para dentro do vão) — assim
 * todo U do trecho é a MESMA barra (uma posição só na lista de ferros). A parede da canaleta do muro é quebrada no
 * encontro e o graute vira um T (canaletas.ts).
 * Ø: o da barra da canaleta do muro na fiada (a planilha não dimensiona a canaleta do contraforte). A perna reta (da
 * dobra à ponta) é conferida contra o ℓb,nec com a dobra como gancho (ancoragemDaPernaDoU): mais curta avisa
 * (contraforte curto).
 */
function barrasEmU(ctx: Ctx, tr: TrechoModulado, fiadas: FiadaMontada[], canaleta: boolean[]): void {
  const { mod, p } = ctx;
  const t = mod.cat.t;
  const yPonta = p.enterrado ? mod.tenr - COB_PONTA : t - (mod.tenr - COB_PONTA);
  const nos = tr.nos;
  const curtas: { id: string; perna: number; lb: number; nec: number; peloMinimo: boolean }[] = [];
  for (const f of fiadas) {
    if (!canaleta[f.i]) continue;
    const { phi, y, z } = barraDaCanaletaDoMuro(ctx, f);
    const perna = Math.abs(yPonta - y) - raioDoEixo(phi);
    const anc = ancoragemDaPernaDoU(ctx, phi);
    for (let k = 0; k + 1 < nos.length; k++) {
      const xa = nos[k].xc + phi / 2;
      const xb = nos[k + 1].xc - phi / 2;
      const id = `T${tr.indice}.H.f${pad(f.i, 2)}.U${pad(k + 1, 2)}`;
      ctx.barras.push(dobrada(id, 'HORIZ', phi, [[xa, yPonta, z], [xa, y, z], [xb, y, z], [xb, yPonta, z]], tr.indice));
      if (anc !== null && perna < anc.nec - 0.5) curtas.push({ id, perna, ...anc });
    }
  }
  if (curtas.length) {
    const pior = curtas.reduce((a, b) => (b.perna / b.nec < a.perna / a.nec ? b : a));
    const conta = pior.peloMinimo
      ? `ℓb,mín = ${br(pior.nec / 10, 1)} cm`
      : `ℓb,nec = α·ℓb = ${br(ALFA_GANCHO, 1)} × ${br(pior.lb / 10, 1)} = ${br(pior.nec / 10, 1)} cm`;
    ctx.avisos.push({
      codigo: 'CANALETA_U_PERNA',
      texto: `Barra em U da canaleta: perna reta no contraforte de ${br(pior.perna / 10, 1)} cm, menor que ${conta} no graute `
        + `(dobra como gancho, α = ${br(ALFA_GANCHO, 1)}, NBR 6118 9.4.2.5)`,
      ids: curtas.map((c) => c.id),
    });
  }
}
