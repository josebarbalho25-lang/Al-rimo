/*
  A CANALETA COMO A OBRA DEIXA — o fundo furado onde sobe a barra vertical e a parede quebrada no encontro com o
  contraforte (o T de graute).

  POR QUÊ: a canaleta comprada é um U fechado embaixo. Desenhada inteira, a barra vertical que sobe pelo furo
  grauteado atravessava o fundo dela, e a barra em L do contraforte atravessava a parede do U do muro e a junta
  muro × haste (revisão do IFC com o muro real, 09/10 noite). Na obra:
    - o fundo é furado onde a barra passa, e o graute da coluna atravessa (brief §3.1: "o fundo da canaleta é quebrado
      nas células grauteadas para o graute vertical passar");
    - a parede da canaleta do muro é quebrada na largura do canal do contraforte, até o fundo, e as duas calhas viram
      uma só (Jose, 09/10: "quebra ou corta pra canaleta fechar um T" — Detalhe 1, figs/app/detalhes/d01_canaletas.py).
  Aqui isso vira geometria: a canaleta ganha os recortes (contexto.geoCanaletaRecortada — contrato Geometria.pedacos)
  e o graute ocupa o lugar do que saiu: uma peça de graute no furo do fundo (junta de baixo + fundo) e uma no T
  (junta muro × haste + parede quebrada + o canto arredondado dela). O quantitativo lê o volume das peças e
  acompanha sozinho.

  DEDUÇÃO (valores de obra adotados aqui, não da aula nem do Jose):
    - o furo do fundo tem a planta do furo do bloco por onde a coluna sobe (o da fiada de bloco mais perto, embaixo
      primeiro): a coluna continua com a mesma seção. Retangular (a caixa do furo) — a obra quebra, não serra o
      canto arredondado. Sem fiada de bloco na coluna (muro todo em canaleta), não há coluna de furo: o fundo é
      furado só para a barra passar, com o graute mínimo (15 mm, ABCP) em volta;
    - o furo fica no fundo, entre as paredes do U (as paredes não são quebradas);
    - a junta entre duas canaletas seguidas, dentro do furo, vai com o graute da canaleta de antes (a mesma regra do
      graute do miolo, gerar.ts).
*/
import type { Geometria, Peca, TipoPeca, Vec2, Vec3 } from '@/modelo/tipos';
import { H_BLOCO, H_FIADA, JUNTA, pecaDoCatalogo } from './catalogo';
import type { MapaDeCavidades } from './cavidades';
import type { TrechoModulado } from './modular';
import { arred, caixaGlobal, cantosDoFundo, paraLocalDe, prisma, retangulo } from './perfis';
import { COB_GRAUTE, fmt, geoCanaletaRecortada, pad, secaoCanaleta, type Ctx, type RecortesDaCanaleta, type SecaoCanaleta } from './contexto';

export const TIPOS_CANALETA: ReadonlySet<TipoPeca> = new Set<TipoPeca>(['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);

/** Retângulo em planta (global, mm). */
interface Ret { x0: number; x1: number; y0: number; y1: number }

/** Uma canaleta do trecho e onde ela está. `ao`: eixo da linha (X no muro, Y na haste). */
interface Can {
  p: Peca;
  g: Geometria;
  min: Vec3; max: Vec3;
  ao: 0 | 1;
  s: SecaoCanaleta;
  /** mundo → local da canaleta (a conta da peça feita uma vez) */
  aLocal: (P: Vec3) => Vec3;
  /** até onde vai o graute desta canaleta ao longo da linha: ela + a junta com a seguinte (se houver) */
  estendida: [number, number];
}

const sobre = (a0: number, a1: number, b0: number, b1: number): [number, number] => [Math.max(a0, b0), Math.min(a1, b1)];

/**
 * Colunas que se encostam viram um furo só (do tamanho das duas); a mesma coluna vinda de várias barras (duas barras
 * no furo, a espera ao lado) conta uma vez. Ordenadas (o resultado não depende da ordem das barras).
 */
function juntar(rets: Ret[]): Ret[] {
  const unicos = [...new Map(rets.map((r) => [`${r.x0}|${r.x1}|${r.y0}|${r.y1}`, r])).values()];
  unicos.sort((u, v) => u.x0 - v.x0 || u.y0 - v.y0);
  const encosta = (u: Ret, v: Ret): boolean => u.x0 < v.x1 - 1e-6 && v.x0 < u.x1 - 1e-6 && u.y0 < v.y1 - 1e-6 && v.y0 < u.y1 - 1e-6;
  const out: Ret[] = [];
  for (const r of unicos) {
    let cur = r;
    for (let k = out.length - 1; k >= 0; k--) {
      const u = out[k];
      if (!encosta(u, cur)) continue;
      cur = { x0: Math.min(u.x0, cur.x0), x1: Math.max(u.x1, cur.x1), y0: Math.min(u.y0, cur.y0), y1: Math.max(u.y1, cur.y1) };
      out.splice(k, 1);
    }
    out.push(cur);
  }
  // a união de duas pode encostar numa terceira já posta: repete até parar (cada volta tira pelo menos uma)
  return out.length < unicos.length ? juntar(out) : out.sort((u, v) => u.x0 - v.x0 || u.y0 - v.y0);
}

export function furarEQuebrarCanaletas(ctx: Ctx, tr: TrechoModulado, canaleta: boolean[], mapa: MapaDeCavidades, ini: number): void {
  const { mod, p, pecas } = ctx;
  const { cat } = mod;
  const t = cat.t;
  const nF = mapa.nFiadas;
  const T = `T${tr.indice}`;

  // ── 1) as canaletas do trecho, por fiada e por linha (o muro corre em X; cada haste, em Y) ──
  const linhas = new Map<string, Can[]>();
  for (let ip = ini; ip < pecas.length; ip++) {
    const pc = pecas[ip];
    if (!TIPOS_CANALETA.has(pc.tipo) || pc.trecho !== tr.indice || pc.fiada === undefined) continue;
    const g = ctx.geos[pc.geometria];
    const c = caixaGlobal(pc, g);
    const ao: 0 | 1 = pc.grupo === 'muro' ? 0 : 1;
    const k = `${pc.fiada}|${pc.grupo === 'muro' ? 'M' : `CF${pc.contraforte}`}`;
    (linhas.get(k) ?? linhas.set(k, []).get(k)!).push({ p: pc, g, min: c.min, max: c.max, ao, s: secaoCanaleta(mod, pc), aLocal: paraLocalDe(pc, g), estendida: [c.min[ao], c.max[ao]] });
  }
  // a junta vai com a canaleta de antes: no muro, a da esquerda; na haste, a mais perto do muro
  const sentido = (ao: 0 | 1): 1 | -1 => (ao === 0 || p.enterrado ? 1 : -1);
  for (const l of linhas.values()) {
    const sg = sentido(l[0].ao);
    l.sort((u, v) => sg * (u.min[u.ao] - v.min[v.ao]));
    l.forEach((c, k) => {
      const prox = l[k + 1];
      if (!prox) return;
      const gap = sg > 0 ? prox.min[c.ao] - c.max[c.ao] : c.min[c.ao] - prox.max[c.ao];
      if (gap > 1e-6 && gap <= JUNTA + 1e-6) c.estendida = sg > 0 ? [c.min[c.ao], prox.min[c.ao]] : [prox.max[c.ao], c.max[c.ao]];
    });
  }
  const recortes = new Map<Can, RecortesDaCanaleta>();
  const recorte = (c: Can): RecortesDaCanaleta => recortes.get(c) ?? recortes.set(c, { furos: [], quebras: [] }).get(c)!;
  /** Retângulo global → faixa local da canaleta (w ao longo, u na largura). */
  const local = (c: Can, r: Ret): { w0: number; w1: number; u0: number; u1: number } => {
    const a = c.aLocal([r.x0, r.y0, c.min[2]]);
    const b = c.aLocal([r.x1, r.y1, c.min[2]]);
    return { w0: arred(Math.min(a[0], b[0])), w1: arred(Math.max(a[0], b[0])), u0: arred(Math.min(a[1], b[1])), u1: arred(Math.max(a[1], b[1])) };
  };
  /** A faixa da largura onde o fundo pode ser furado: entre as paredes do U. */
  const miolo = (c: Can): [number, number] => {
    const at = c.ao === 0 ? 1 : 0;
    return [c.min[at] + c.s.parede, c.max[at] - c.s.parede];
  };

  // ── 2) as barras verticais do trecho (trechos retos do eixo) ──
  const segs: { x: number; y: number; z0: number; z1: number; r: number }[] = [];
  for (const b of ctx.barras) {
    if (b.trecho !== tr.indice) continue;
    for (let k = 0; k + 1 < b.eixo.length; k++) {
      const [a, c] = [b.eixo[k], b.eixo[k + 1]];
      if (Math.abs(a[0] - c[0]) > 1e-6 || Math.abs(a[1] - c[1]) > 1e-6 || Math.abs(a[2] - c[2]) < 1e-6) continue;
      segs.push({ x: a[0], y: a[1], z0: Math.min(a[2], c[2]), z1: Math.max(a[2], c[2]), r: b.diametro / 2 });
    }
  }

  segs.sort((u, v) => u.x - v.x || u.y - v.y);
  const RAIO_MAX = Math.max(0, ...segs.map((s) => s.r));
  // o fundo mais grosso da família (a cortada da 19): a faixa de altura que uma barra tem de cruzar para tocar um fundo
  const FUNDO_MAX = Math.max(cat.canaleta.fundo, cat.canaletaCortada?.fundo ?? 0);
  const segsDaFiada = new Map<number, typeof segs>();

  /**
   * A planta da coluna de graute por onde a barra sobe: o furo da fiada de bloco mais perto (embaixo primeiro). Sem
   * fiada de bloco na coluna (muro todo em canaleta) não há coluna de furo para continuar — o fundo é furado só para a
   * barra passar: um quadrado com o graute mínimo em volta dela (COB_GRAUTE).
   */
  const coluna = (i: number, x: number, y: number, r: number): Ret => {
    for (let d = 1; d < nF; d++) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= nF || canaleta[j]) continue;
        const a = mapa.achar(j, x, y);
        if (a && a.cav.tipo === 'furo') return { x0: a.cav.cx - a.cav.a, x1: a.cav.cx + a.cav.a, y0: a.cav.cy - a.cav.b, y1: a.cav.cy + a.cav.b };
      }
    }
    const e = r + COB_GRAUTE;
    return { x0: x - e, x1: x + e, y0: y - e, y1: y + e };
  };

  const novas: Peca[] = [];
  const nGraute = new Map<Peca, number>();

  /**
   * Os grautes de um trecho do canal que corta várias canaletas da linha (o furo de uma coluna, o canal do T): UM só
   * quando as canaletas tocadas têm a mesma seção (a junta entre elas fica dentro, sem emenda — e o muro inteiro usa
   * poucas formas); um por canaleta quando a seção muda (a cortada da 19 tem fundo mais grosso), cada um com a junta
   * seguinte junto. Devolve [início, fim] ao longo da linha e a canaleta dona (a de maior trecho).
   */
  const porSecao = (tocadas: { c: Can; a0: number; a1: number }[], lo: [number, number]): { c: Can; e0: number; e1: number }[] => {
    const iguais = tocadas.every((q) => q.c.s.propria === tocadas[0].c.s.propria);
    const grupos = iguais ? [tocadas] : tocadas.map((q) => [q]);
    return grupos.map((gr) => {
      const [e0, e1] = sobre(lo[0], lo[1], Math.min(...gr.map((q) => q.c.estendida[0])), Math.max(...gr.map((q) => q.c.estendida[1])));
      const dono = gr.reduce((a, b) => (b.a1 - b.a0 > a.a1 - a.a0 + 1e-6 ? b : a)).c;
      return { c: dono, e0, e1 };
    });
  };

  // ── 3) o fundo furado onde a barra vertical passa, e o graute da coluna no furo ──
  for (const [k, l] of linhas) {
    const i = Number(k.split('|')[0]);
    const z0 = i * H_FIADA + JUNTA;
    const ao = l[0].ao;
    const at = ao === 0 ? 1 : 0;
    // as canaletas da linha em ordem ao longo dela, para achar quem uma faixa [a0, a1] toca sem varrer todas
    const ordem = [...l].sort((u, v) => u.min[ao] - v.min[ao]);
    const maiorL = Math.max(...l.map((c) => c.max[ao] - c.min[ao]));
    const tocam = (a0: number, a1: number): Can[] => {
      let lo = 0;
      let hi = ordem.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (ordem[m].min[ao] < a1) lo = m + 1;
        else hi = m;
      }
      const out: Can[] = [];
      for (let j = lo - 1; j >= 0 && ordem[j].min[ao] > a0 - maiorL - 1; j--) if (ordem[j].max[ao] > a0) out.push(ordem[j]);
      return out.reverse();
    };
    // as barras que passam na altura do fundo desta fiada e na faixa da linha em X, uma vez cada (duas barras no
    // mesmo furo dão a mesma coluna)
    const zMax = z0 + FUNDO_MAX;
    const naFiada = segsDaFiada.get(i) ?? segsDaFiada.set(i, segs.filter((s) => Math.min(s.z1, zMax) - Math.max(s.z0, z0) > 1e-6)).get(i)!;
    const xa = Math.min(...l.map((c) => c.min[0])) - RAIO_MAX;
    const xb = Math.max(...l.map((c) => c.max[0])) + RAIO_MAX;
    let j0 = 0;
    for (let hi = naFiada.length; j0 < hi; ) {
      const m = (j0 + hi) >> 1;
      if (naFiada[m].x < xa) j0 = m + 1;
      else hi = m;
    }
    const rets: Ret[] = [];
    const vistas = new Set<string>();
    for (let j = j0; j < naFiada.length && naFiada[j].x <= xb; j++) {
      const s = naFiada[j];
      const pa = ao === 0 ? s.x : s.y;
      const pt = ao === 0 ? s.y : s.x;
      const c = tocam(pa - s.r, pa + s.r).find((q) => pt >= q.min[at] - s.r && pt <= q.max[at] + s.r && Math.min(s.z1, z0 + q.s.fundo) - Math.max(s.z0, z0) > 1e-6);
      if (!c) continue;
      const kb = `${s.x}|${s.y}`;
      if (vistas.has(kb)) continue;
      vistas.add(kb);
      rets.push(coluna(i, s.x, s.y, s.r));
    }
    const colunas = juntar(rets);
    const [m0, m1] = miolo(l[0]);
    for (const r of colunas) {
      const lo: [number, number] = ao === 0 ? [r.x0, r.x1] : [r.y0, r.y1];
      const [b0, b1] = sobre(...(ao === 0 ? [r.y0, r.y1] : [r.x0, r.x1]) as [number, number], m0, m1);
      if (b1 - b0 < 1) continue;
      const ret = (a0: number, a1: number): Ret => (ao === 0 ? { x0: a0, x1: a1, y0: b0, y1: b1 } : { x0: b0, x1: b1, y0: a0, y1: a1 });
      // o furo em cada canaleta que a coluna pega (a coluna pode cair na junta entre duas)
      const tocadas: { c: Can; a0: number; a1: number }[] = [];
      for (const c of tocam(lo[0], lo[1])) {
        const [a0, a1] = sobre(lo[0], lo[1], c.min[ao], c.max[ao]);
        if (a1 - a0 < 1) continue;
        recorte(c).furos.push(local(c, ret(a0, a1)));
        tocadas.push({ c, a0, a1 });
      }
      if (!tocadas.length) continue;
      // o graute da coluna no furo: da junta de baixo até o fundo
      for (const { c, e0, e1 } of porSecao(tocadas, lo)) {
        const g = ret(e0, e1);
        const lx = g.x1 - g.x0;
        const ly = g.y1 - g.y0;
        const h = JUNTA + c.s.fundo;
        const chave = `graute furo ${fmt(lx)}x${fmt(ly)} r0 h${fmt(h)}`;
        if (!ctx.geos[chave]) ctx.geos[chave] = prisma(chave, 'Z', retangulo(lx, ly), h);
        const n = (nGraute.get(c.p) ?? 0) + 1;
        nGraute.set(c.p, n);
        const gp: Peca = {
          id: `${c.p.id}.g${n}`, tipo: 'GRAUTE_FURO', grupo: c.p.grupo, geometria: chave,
          origem: [arred(g.x0), arred(g.y0), i * H_FIADA], giro: 0, trecho: tr.indice, fiada: i,
        };
        if (c.p.contraforte !== undefined) gp.contraforte = c.p.contraforte;
        novas.push(gp);
      }
    }
  }

  // ── 4) o T: a parede do muro quebrada no canal do contraforte, e o graute que liga as duas calhas ──
  for (const no of tr.nos) {
    for (let i = 0; i < nF; i++) {
      if (!canaleta[i]) continue;
      const muro = linhas.get(`${i}|M`) ?? [];
      const haste = linhas.get(`${i}|CF${no.cf}`) ?? [];
      if (!muro.length || !haste.length) continue;
      // o canal do contraforte: o miolo da canaleta da haste (mesma família, mesmas paredes)
      const pc = cat.canaleta.parede;
      const lo: [number, number] = [no.xc - t / 2 + pc, no.xc + t / 2 - pc];
      // onde começa a calha do contraforte: a face da canaleta da haste mais perto do muro
      const yH = p.enterrado ? Math.min(...haste.map((c) => c.min[1])) : Math.max(...haste.map((c) => c.max[1]));
      const tocadas: { c: Can; a0: number; a1: number }[] = [];
      for (const c of muro) {
        const [a0, a1] = sobre(lo[0], lo[1], c.min[0], c.max[0]);
        if (a1 - a0 < 1) continue;
        // o lado da parede quebrada, no referencial da canaleta (o do solo no enterrado; o da frente no aparente)
        const lado = c.aLocal([no.xc, p.enterrado ? t - c.s.parede / 2 : c.s.parede / 2, c.min[2]])[1] > t / 2 ? 1 : 0;
        const q = local(c, { x0: a0, x1: a1, y0: 0, y1: t });
        recorte(c).quebras.push({ lado, w0: q.w0, w1: q.w1 });
        tocadas.push({ c, a0, a1 });
      }
      let k = 0;
      for (const { c, e0, e1 } of tocadas.length ? porSecao(tocadas, lo) : []) {
        const { parede, fundo, r } = c.s;
        const yMiolo = p.enterrado ? t - parede - r : parede + r;   // onde termina o miolo do muro (o canto arredondado sai junto)
        const chave = geoGrauteDoT(ctx, c.s, Math.abs(yH - yMiolo), e1 - e0);
        novas.push({
          id: `${T}.CF${no.cf}.f${pad(i, 2)}.gT${++k}`, tipo: 'GRAUTE_CANALETA', grupo: 'contraforte', geometria: chave,
          // enterrado: o canto arredondado do lado de −Y (junto ao miolo do muro); aparente: a mesma peça girada 180°
          origem: [arred(e0), arred(Math.min(yH, yMiolo)), arred(i * H_FIADA + JUNTA + fundo)], giro: p.enterrado ? 0 : 180,
          trecho: tr.indice, fiada: i, contraforte: no.cf,
        });
      }
    }
  }

  // ── 5) as canaletas recortadas trocam de geometria ──
  for (const [c, rec] of recortes) {
    const prefixo = `canaleta ${cat.nome} `;
    const chavePc = c.p.geometria.startsWith(prefixo) ? c.p.geometria.slice(prefixo.length).split(' |')[0] : null;
    if (!chavePc) continue;
    c.p.geometria = geoCanaletaRecortada(ctx, pecaDoCatalogo(cat, chavePc), rec);
  }
  pecas.push(...novas);
}

/**
 * Perfil do graute do T (plano y, z), no referencial do contraforte ENTERRADO: começa onde termina o miolo do muro (o
 * pé do canto arredondado, que sai com a parede) e vai até a calha do contraforte (`prof`, passando pela parede
 * quebrada e pela junta muro × haste); do fundo da canaleta do muro até o topo. O lado do miolo segue o arco do canto
 * — o graute do miolo do muro termina nele (secaoDaCanaleta), e os dois encostam sem sobrar nem faltar.
 */
function geoGrauteDoT(ctx: Ctx, s: SecaoCanaleta, prof: number, comprimento: number): string {
  const t = ctx.mod.cat.t;
  const chave = `graute T ${ctx.mod.cat.nome}${s.propria ? ' cortada' : ''} e${fmt(prof)} L${fmt(comprimento)}`;
  if (ctx.geos[chave]) return chave;
  const { parede, fundo, r } = s;
  const H = H_BLOCO - fundo;
  // o canto do lado do solo, do pé da parede (t − p, f + r) até o fundo (t − p − r, f): os mesmos pontos (com o
  // mesmo arred) em que o miolo do muro termina — os dois grautes encostam sem fresta
  const u0 = t - parede - r;
  const rel = (q: Vec2): Vec2 => [arred(arred(q[0]) - arred(u0)), arred(arred(q[1]) - fundo)];
  const pts: Vec2[] = [[0, 0], [prof, 0], [prof, H], [arred(t - parede - u0), H], ...cantosDoFundo(t, parede, fundo, r).dir.map(rel)];
  const semRep: Vec2[] = [];
  for (const q of pts) {
    const u = semRep[semRep.length - 1];
    if (!u || Math.abs(u[0] - q[0]) > 1e-6 || Math.abs(u[1] - q[1]) > 1e-6) semRep.push(q);
  }
  const a = semRep[0];
  const b = semRep[semRep.length - 1];
  if (Math.abs(a[0] - b[0]) <= 1e-6 && Math.abs(a[1] - b[1]) <= 1e-6) semRep.pop();
  ctx.geos[chave] = prisma(chave, 'X', semRep, comprimento);
  return chave;
}
