/*
  ARMADURAS DO MURO — barras verticais (balanço, painel, contraforte), esperas e horizontais das canaletas.

  Toda barra vertical é posta procurando o furo de VERDADE de cada fiada (cavidades.ts): onde a conta pede a barra
  (d) e o furo não deixa (graute < 15 mm, ou a barra sai do furo), o desenho mostra onde ela cabe e avisa. O
  desenho não esconde o que a conta não viu — mas também não desenha barra dentro do bloco.
*/
import { H_FIADA, JUNTA } from './catalogo';
import type { MapaDeCavidades } from './cavidades';
import { br, type TrechoModulado } from './modular';
import { COB_GRAUTE, COB_PONTA, RECUO_ESTRIBO, RECUO_ESTRIBO_LATERAL, pad, zTopoBarra, type Ctx } from './contexto';
import { corrida, espera, estribo, pontaGancho90, raioDoEixo, reta, type BarraNova } from './barras';
import type { Vec3 } from '@/modelo/tipos';
import { arred } from './perfis';

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

interface Arranjo { barras: [number, number][]; esperas: [number, number][]; folga: number }

/**
 * Grupo de n barras num furo, cada uma com a sua espera AO LADO (emenda por contato), arrumadas em linhas:
 * ao longo da linha, passo 2φ (folga livre φ); entre linhas, passo 3φ (o par barra + espera ocupa 2φ). A linha
 * corre ao longo de `eixo`; o centro das BARRAS fica no alvo nas duas direções — é o que preserva o d da conta —
 * e a espera vai para o lado que couber. Tenta 1 linha, 2, 3...: fica a 1ª arrumação com 15 mm de graute; senão
 * a 1ª que cabe; senão a de maior folga.
 */
function arranjar(ctx: Ctx, mapa: MapaDeCavidades, cx: number, cy: number, n: number, phi: number, eixo: 'X' | 'Y', l0: number): Arranjo {
  const z1 = zTopoBarra(ctx);
  let melhor: Arranjo | null = null;
  let primeiroQueCabe: Arranjo | null = null;
  for (let linhas = 1; linhas <= n; linhas++) {
    for (const [e, lado] of [[eixo, 1], [eixo, -1], [eixo === 'X' ? 'Y' : 'X', 1], [eixo === 'X' ? 'Y' : 'X', -1]] as const) {
      const porLinha = Math.ceil(n / linhas);
      if (linhas > 1 && Math.ceil(n / (linhas - 1)) === porLinha) continue;   // mesma arrumação com uma linha vazia
      const barras: [number, number][] = [];
      const esperas: [number, number][] = [];
      let resta = n;
      for (let L = 0; L < linhas && resta > 0; L++) {
        const nesta = Math.min(porLinha, resta);
        resta -= nesta;
        const atravessa = (L - (linhas - 1) / 2) * 3 * phi;
        for (let k = 0; k < nesta; k++) {
          const ao = (k - (nesta - 1) / 2) * 2 * phi;
          const pe = atravessa + lado * phi;
          barras.push(e === 'Y' ? [cx + atravessa, cy + ao] : [cx + ao, cy + atravessa]);
          esperas.push(e === 'Y' ? [cx + pe, cy + ao] : [cx + ao, cy + pe]);
        }
      }
      let folga = Infinity;
      for (const [x, y] of barras) folga = Math.min(folga, mapa.folga(x, y, phi / 2, 0, z1));
      for (const [x, y] of esperas) if (folga > -Infinity) folga = Math.min(folga, mapa.folga(x, y, phi / 2, 0, l0));
      const a: Arranjo = { barras, esperas, folga };
      if (folga >= COB_GRAUTE) return a;
      if (folga >= 0 && !primeiroQueCabe) primeiroQueCabe = a;
      if (!melhor || folga > melhor.folga) melhor = a;
    }
  }
  return primeiroQueCabe ?? melhor!;
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
  // c da conta (Entradas ou eenr/2); o centro do furo da ponta fica a (m − 10)/2 — brief Q10
  const cCf = p.c_cf ?? t / 2;
  const cGeo = (m - JUNTA) / 2;
  if (Math.abs(cCf - cGeo) > 5) {
    ctx.avisos.push({ codigo: 'D_GEOMETRICO_CF', texto: `Contraforte: barra a ${br(cCf / 10, 1)} cm da ponta; centro do furo a ${br(cGeo / 10, 1)} cm` });
  }
  // furos do contraforte ao longo de η: o do muro (t/2) e os da haste (centro de cada célula)
  const celulas = Array.from({ length: mod.n_haste }, (_, j) => t + JUNTA + j * m + cGeo);
  // tracionada: enterrado → da ponta para o muro; aparente → do muro (junto ao solo) para a ponta (Fig. 12)
  const furosTracao = enterrado ? [...celulas].reverse().concat([t / 2]) : [t / 2, ...celulas];
  const furosCompressao = [...furosTracao].reverse();
  const l0P = traspasse(ctx, p.phi_cf);
  const l0C = traspasse(ctx, p.phi_cc);

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

    // estribos fechados na junta de assentamento, um a cada s_est, a partir da junta sobre a sapata
    const meia = t / 2 - RECUO_ESTRIBO_LATERAL;
    const ya = yDe(RECUO_ESTRIBO);
    const yb = yDe(mod.tenr - RECUO_ESTRIBO);
    const passoJ = Math.max(1, Math.round(mod.s_est / H_FIADA));
    for (let i = 0; i < mod.n_fiadas; i += passoJ) {
      const z = i * H_FIADA + JUNTA / 2;
      ctx.barras.push(estribo(`${base}.E${pad(i, 2)}`, 'CF_ESTRIBO', p.phi_est,
        [[no.xc - meia, ya, z], [no.xc + meia, ya, z], [no.xc + meia, yb, z], [no.xc - meia, yb, z]], tr.indice, no.cf));
    }
  }
  if (p.phi_est > 6.3) ctx.avisos.push({ codigo: 'ESTRIBO_NA_JUNTA', texto: `Estribo Ø${br(p.phi_est, 1)} na junta de 10 mm` });
  // na largura do bloco só cabe um estribo fechado (2 ramos); mais ramos não têm desenho simples — DEDUÇÃO
  if (p.ramos_est !== 2) ctx.avisos.push({ codigo: 'ESTRIBO_RAMOS', texto: `Estribo do contraforte com ${p.ramos_est} ramos: desenhado fechado, 2 ramos` });
}

// ── esperas ──────────────────────────────────────────────────────────────────

/** Traspasse espera × barra: o digitado; senão o ℓb da conta (Ø da barra do balanço) proporcional ao Ø — DEDUÇÃO. */
export function traspasse(ctx: Ctx, phi: number): number {
  const { p } = ctx;
  if (p.traspasse !== null) return p.traspasse;
  if (p.lb !== null) return Math.ceil((p.lb * phi) / p.phi_v);
  return 50 * phi;
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
  for (const v of vs) {
    const l0 = traspasse(ctx, v.phi);
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
    ctx.barras.push(espera(id, v.phi, arred(pos[0]), arred(pos[1]), zPeBase + v.phi / 2, l0, p.gancho, sentido, tr.indice, v.barra.contraforte));
    mapa.marcar(pos[0], pos[1], 0, l0);
  }
  if (fora.length) ctx.avisos.push({ codigo: 'ESPERA_FORA_DO_FURO', texto: 'Espera sem lugar no furo ao lado da barra', ids: fora });
}

// ── horizontais nas canaletas ────────────────────────────────────────────────

export function horizontais(ctx: Ctx, tr: TrechoModulado, fiadas: { i: number }[], canaleta: boolean[]): void {
  const { mod, p } = ctx;
  const t = mod.cat.t;
  // parede e fundo da canaleta da família (na 14x39, a do Revit: fundo de 39 mm)
  const { parede, fundo } = mod.cat.canaleta;
  for (const f of fiadas) {
    if (!canaleta[f.i]) continue;
    // canaleta da conta (espaçamento s): Ø e posição da conta; só cinta: Ø da cinta, centralizada — DEDUÇÃO no
    // balanço, que não tem Ø de barra horizontal nas Entradas (a aula usou Ø10)
    const daConta = mod.s_can > 0 && ((f.i + 1) * H_FIADA) % mod.s_can === 0;
    const phi = p.contrafortes && daConta ? p.phi_ph : p.phi_cinta;
    const y = p.contrafortes && daConta && !p.phCentralizada ? p.c_pv : t / 2;
    const z = f.i * H_FIADA + JUNTA + fundo + COB_GRAUTE + phi / 2;
    const lado: Vec3 = [0, y + 1.5 * phi <= t - parede ? phi : -phi, 0];
    const barras = corrida(`T${tr.indice}.H.f${pad(f.i, 2)}.`, 'HORIZ', phi, tr.x0 + COB_PONTA, tr.x1 - COB_PONTA, y, z, traspasse(ctx, phi), lado, tr.indice);
    if (barras.length > 1) avisarTraspasseProporcional(ctx);
    ctx.barras.push(...barras);
  }
}

export function avisarTraspasseProporcional(ctx: Ctx): void {
  if (ctx.p.traspasse === null) {
    ctx.avisos.push({ codigo: 'TRASPASSE_ADOTADO', texto: 'Traspasse das emendas: ℓb da conta proporcional ao Ø (dedução)' });
  }
}
