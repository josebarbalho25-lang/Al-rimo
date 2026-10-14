/*
  O QUE ESTÁ EM VOLTA DA ALVENARIA — sapata (com armadura), drenagem (dreno, manta, barbacãs) e terreno (aterro e
  solo da frente, só para o 3D mostrar transparente; fora do IFC e do quantitativo).
*/
import type { Vec2 } from '@/modelo/tipos';
import { H_BLOCO, H_FIADA, JUNTA } from './catalogo';
import type { Cavidade, MapaDeCavidades } from './cavidades';
import type { Parametros } from './leitura';
import { br, type TrechoModulado } from './modular';
import { arred, circulo, prisma, retangulo, retanguloArredondado } from './perfis';
import { corrida, distribuir, estribo, reta } from './barras';
import { ESPESSURA_MANTA, SOBRA_TERRENO, fmt, geoPrismaReto, pad, type Ctx } from './contexto';
import { traspasse } from './armaduras';

export const temDente = (p: Parametros): boolean => p.b_den > 0 && p.h_den > 0;

// ── sapata ───────────────────────────────────────────────────────────────────

export function sapata(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number): void {
  const { p } = ctx;
  const B = p.B_sap;
  const h = p.h_sap;
  const L = tr.x1 - tr.x0;
  let contorno: Vec2[];
  if (temDente(p)) {
    // dente com o eixo a x_den do centro da sapata, + para o pé (Jose, 13/10; o peso dele na aba Fundação está em
    // x = B/2 + x_den, medido da borda aterrada). O pé fica no Y menor: + para o pé = Y diminui. Cortado na sapata.
    const yc = YbA - B / 2 - p.x_den;
    const yd0 = Math.max(Ype, yc - p.b_den / 2);
    const yd1 = Math.min(YbA, yc + p.b_den / 2);
    const zb = -h - p.h_den;
    contorno = [[yd0, zb], [yd1, zb], [yd1, -h], [YbA, -h], [YbA, 0], [Ype, 0], [Ype, -h], [yd0, -h]];
  } else {
    contorno = [[Ype, -h], [YbA, -h], [YbA, 0], [Ype, 0]];
  }
  contorno = contorno.filter((q, k) => k === 0 || q[0] !== contorno[k - 1][0] || q[1] !== contorno[k - 1][1]);
  const zMin = Math.min(...contorno.map((q) => q[1]));
  const chave = `sapata ${fmt(B)}x${fmt(h)}${temDente(p) ? ` dente ${fmt(p.b_den)}x${fmt(p.h_den)}` : ''} L${fmt(L)}`;
  geoPrismaReto(ctx, chave, 'X', contorno, L);
  ctx.pecas.push({ id: `SAP.T${tr.indice}`, tipo: 'SAPATA', grupo: 'fundacao', geometria: chave, origem: [tr.x0, arred(Ype), arred(zMin)], giro: 0, trecho: tr.indice });

  // armaduras (fundacao.py): transversal Ø phi_sap c/ s_ps na face de baixo (e na de cima quando o talão pede,
  // "mesma armadura nas duas faces"), longitudinal Ø phi_sap2 c/ s_ss sobre ela
  const c = p.cob_sap;
  const s1 = p.s_ps && p.s_ps > 0 ? p.s_ps : 200;
  const s2 = p.s_ss && p.s_ss > 0 ? p.s_ss : 200;
  if (!(p.s_ps && p.s_ps > 0) || !(p.s_ss && p.s_ss > 0)) {
    ctx.avisos.push({ codigo: 'SAPATA_ESPACAMENTO', texto: 'Armadura da sapata sem espaçamento na conta — desenhada a cada 20 cm (dedução)' });
  }
  const T = `SAP.T${tr.indice}`;
  const faces = p.Mk_heel > 0 ? ['I', 'S'] : ['I'];
  for (const face of faces) {
    const zT = face === 'I' ? -h + c + p.phi_sap / 2 : -c - p.phi_sap / 2;
    distribuir(tr.x0 + c, tr.x1 - c, s1).forEach((x, k) => {
      ctx.barras.push(reta(`${T}.T${face}${pad(k + 1, 3)}`, 'SAP_TRANSV', p.phi_sap, [x, Ype + c, zT], [x, YbA - c, zT], tr.indice));
    });
    const zL = face === 'I' ? -h + c + p.phi_sap + p.phi_sap2 / 2 : -c - p.phi_sap - p.phi_sap2 / 2;
    distribuir(Ype + c, YbA - c, s2).forEach((y, k) => {
      const bs = corrida(`${T}.L${face}${pad(k + 1, 2)}.`, 'SAP_LONG', p.phi_sap2, tr.x0 + c, tr.x1 - c, y, zL, traspasse(ctx, p.phi_sap2, 'concreto'), [0, p.phi_sap2, 0], tr.indice);
      ctx.barras.push(...bs);
    });
  }

  // torção (contrafortes): estribo fechado em volta de B × h no trecho todo (brief Q11, recomendação — DEDUÇÃO),
  // no espaçamento da aba Fundação ("Ø do estribo de torção: espaçamento", célula sem nome)
  if (p.contrafortes && p.T_sd > 0 && p.s_tor !== null && p.s_tor > 0) {
    const ph = p.phi_tor;
    const y0 = Ype + c + ph / 2;
    const y1 = YbA - c - ph / 2;
    const z0 = -h + c + ph / 2;
    const z1 = -c - ph / 2;
    distribuir(tr.x0 + c, tr.x1 - c, p.s_tor).forEach((x, k) => {
      ctx.barras.push(estribo(`${T}.TOR${pad(k + 1, 4)}`, 'SAP_TORCAO', ph, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], tr.indice));
    });
    if (p.s_tor < 50) ctx.avisos.push({ codigo: 'TORCAO_ESPACAMENTO', texto: `Estribo de torção da sapata a cada ${br(p.s_tor / 10, 1)} cm` });
    if (p.Asl_s > 0) ctx.avisos.push({ codigo: 'TORCAO_LONGITUDINAL', texto: `Armadura longitudinal de torção da sapata (Asl ${br(p.Asl_s)} cm²) não desenhada` });
  }
}

// ── drenagem ─────────────────────────────────────────────────────────────────

/** O barbacã sai 5 cm para fora da face do muro e entra 5 cm no dreno (Jose, 14/10: "os barbacãs sumiram" — rente
 *  à face, o tubo ficava escondido dentro do bloco). */
export const SALIENCIA_BARBACA = 50;

/**
 * O PACOTE DO DRENO no corte, em coordenadas da face do tardoz (u = 0, cresce para o solo) e do topo da sapata
 * (v = 0): a brita é a união de dois retângulos encostados no muro e no talão — a camada do tardoz (dreno_esp de
 * espessura) e a envoltória quadrada do dreno de fundo (drenof_env de lado, o tubo no meio) —, um degrau quando a
 * envoltória é mais larga que a camada. Em volta, do lado do solo, a areia (filtro, Jose 14/10) e por fora a manta.
 * `dreno_folga` é medida do topo do solo até o topo do PACOTE (o lado de fora da manta).
 */
export interface PacoteDoDreno {
  retangulos: [number, number][];   // (largura, altura) da brita: camada do tardoz e/ou envoltória do tubo
  fora: number;                     // areia + manta: quanto o pacote cresce em volta da brita
  fundo: boolean;                   // tem dreno de fundo (tubo)
}

export function pacoteDoDreno(ctx: Ctx): PacoteDoDreno {
  const { p } = ctx;
  const fora = p.areia_esp + ESPESSURA_MANTA;
  const retangulos: [number, number][] = [];
  const hVert = p.H_solo - p.dreno_folga - fora;
  if (p.dreno && hVert > 0 && p.dreno_esp > 0) retangulos.push([p.dreno_esp, hVert]);
  const f = p.drenof_env;
  let fundo = p.drenof && p.drenof_phi > 0 && f > p.drenof_phi;
  if (fundo && f + fora > p.H_solo) {
    fundo = false;
    if (!ctx.avisos.some((a) => a.codigo === 'DRENO_FUNDO_NAO_CABE')) {
      ctx.avisos.push({ codigo: 'DRENO_FUNDO_NAO_CABE', texto: 'Dreno de fundo mais alto que o solo: não desenhado' });
    }
  }
  if (fundo) retangulos.push([f, f]);
  return { retangulos, fora, fundo };
}

/**
 * A borda de fora da união dos retângulos [0, w] × [0, h], do talão (v = 0) até a face do muro (u = 0) — no
 * sentido anti-horário de quem fecha o polígono por (0, 0). `cresce` engorda cada retângulo para o lado do solo.
 */
export function bordaDoPacote(retangulos: [number, number][], cresce = 0): Vec2[] {
  const r = retangulos.map(([w, h]) => [w + cresce, h + cresce] as [number, number]).sort((a, b) => b[0] - a[0]);
  if (!r.length) return [];
  const [wL, hL] = r[0];
  const alto = r.find(([, h]) => h > hL + 1e-6);   // o estreito só entra se passar da altura do largo
  if (!alto) return [[wL, 0], [wL, hL], [0, hL]];
  const [wA, hA] = alto;
  return semDuplicados([[wL, 0], [wL, hL], [wA, hL], [wA, hA], [0, hA]]);
}

/** A faixa entre duas bordas (a areia, a manta): a de fora subindo, a de dentro descendo. */
function faixaDoPacote(retangulos: [number, number][], de: number, ate: number): Vec2[] {
  return semDuplicados([...bordaDoPacote(retangulos, ate), ...bordaDoPacote(retangulos, de).reverse()]);
}

export function drenagem(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  const T = `T${tr.indice}`;

  // Pacote do dreno no tardoz, do topo da sapata para cima; com contraforte enterrado, um por vão (contorna as
  // hastes — o tubo do dreno de fundo também para em cada contraforte)
  const pac = pacoteDoDreno(ctx);
  if (pac.retangulos.length) {
    const vaos: [number, number][] = [];
    if (p.contrafortes && p.enterrado) {
      for (let v = 0; v + 1 < tr.nos.length; v++) vaos.push([tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs]);
    } else {
      vaos.push([tr.x0, tr.x1]);
    }
    const a = p.areia_esp;
    const es = ESPESSURA_MANTA;
    const f = p.drenof_env;
    const d = p.drenof_phi;
    const medidas = pac.retangulos.map(([w, h]) => `${fmt(w)}x${fmt(h)}`).join('+');
    // o tubo atravessa a brita: furo no perfil dela (o volume de brita do quantitativo já sai sem o tubo)
    const furo = pac.fundo ? [retanguloArredondado(d, d, d / 2, f / 2 - d / 2, f / 2 - d / 2, true)] : undefined;
    vaos.forEach(([xa, xb], k) => {
      const L = xb - xa;
      if (L <= 0) return;
      const v = `v${k + 1}`;
      const gB = `dreno ${medidas}${pac.fundo ? ` tubo Ø${fmt(d)}` : ''} L${fmt(L)}`;
      if (!ctx.geos[gB]) ctx.geos[gB] = prisma(gB, 'X', [[0, 0], ...bordaDoPacote(pac.retangulos)], L, furo, 'brita');
      ctx.pecas.push({ id: `${T}.DRN.${v}`, tipo: 'DRENO', grupo: 'drenagem', geometria: gB, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      if (a > 0) {
        const gA = geoPrismaReto(ctx, `areia ${fmt(a)} sobre ${medidas} L${fmt(L)}`, 'X', faixaDoPacote(pac.retangulos, 0, a), L, 'areia');
        ctx.pecas.push({ id: `${T}.ARE.${v}`, tipo: 'AREIA', grupo: 'drenagem', geometria: gA, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      }
      const gM = geoPrismaReto(ctx, `manta sobre ${medidas} areia ${fmt(a)} L${fmt(L)}`, 'X', faixaDoPacote(pac.retangulos, a, a + es), L, 'manta geotêxtil');
      ctx.pecas.push({ id: `${T}.MNT.${v}`, tipo: 'MANTA', grupo: 'drenagem', geometria: gM, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      if (pac.fundo) {
        const gT = geoPrismaReto(ctx, `tubo do dreno Ø${fmt(d)} L${fmt(L)}`, 'X', circulo(d), L, `tubo perfurado Ø${fmt(d)} mm`);
        ctx.pecas.push({
          id: `${T}.TDF.${v}`, tipo: 'TUBO_DRENO', grupo: 'drenagem', geometria: gT,
          origem: [arred(xa), arred(t + f / 2 - d / 2), arred(f / 2 - d / 2)], giro: 0, trecho: tr.indice,
        });
      }
    });
  }

  // Barbacãs na 1ª fiada com o tubo todo acima do solo da frente (o aterro sobre a ponta, h_fr — Jose, 14/10), no
  // furo de um bloco do muro, fora do contraforte: numa célula sem graute; com graute total, numa grauteada (o tubo
  // vai antes do graute). Nunca numa célula com barra (o tubo atravessaria a barra) nem na canaleta (o tubo furaria as
  // paredes do U e passaria na altura da barra da canaleta): fiada assim, o barbacã sobe para a de cima, até o topo do
  // solo. Sem célula nenhuma — o muro todo em canaleta, por exemplo —, o barbacã não é desenhado e o aviso diz (antes
  // sumia calado, 09/10 noite).
  if (p.barbaca && p.barbaca_phi > 0 && p.barbaca_s > 0 && mod.n_fiadas > 0) {
    const d = p.barbaca_phi;
    const foraDosNos = (x: number): boolean => !tr.nos.some((no) => x > no.xs - JUNTA - d / 2 && x < no.xe + d / 2);
    const zDaFiada = (f: number): number => f * H_FIADA + JUNTA + H_BLOCO / 2;
    const celulas = (fiada: number): { cand: number[]; emCanaleta: boolean } => {
      const zc = zDaFiada(fiada);
      const daFiada = mapa.fiada(fiada);
      const comBarra = new Set<Cavidade>();
      for (const b of ctx.barras) {
        if (b.trecho !== tr.indice) continue;
        for (let k = 0; k + 1 < b.eixo.length; k++) {
          const [a, c] = [b.eixo[k], b.eixo[k + 1]];
          if (Math.abs(a[0] - c[0]) > 1e-6 || Math.abs(a[1] - c[1]) > 1e-6) continue;
          if (Math.min(a[2], c[2]) >= zc + d / 2 || Math.max(a[2], c[2]) <= zc - d / 2) continue;
          const f = mapa.achar(fiada, a[0], a[1]);
          if (f) comBarra.add(f.cav);
        }
      }
      const daParede = daFiada.filter((c) => c.tipo === 'furo' && Math.abs(c.cy - t / 2) < 1e-6 && ctx.pecas[c.peca].grupo === 'muro' && foraDosNos(c.cx) && !comBarra.has(c));
      let cand = daParede.filter((c) => !c.grauteada).map((c) => c.cx);
      if (!cand.length) cand = daParede.map((c) => c.cx);
      return { cand, emCanaleta: daFiada.some((c) => c.tipo === 'canaleta' && Math.abs(c.cy - t / 2) < 1e-6) };
    };
    let fiada = 0;
    while (zDaFiada(fiada) - d / 2 < p.h_fr - 1e-6) fiada++;
    const primeira = fiada < mod.n_fiadas ? celulas(fiada) : { cand: [], emCanaleta: false };
    let { cand } = primeira;
    while (!cand.length && fiada + 1 < mod.n_fiadas && zDaFiada(fiada + 1) + d / 2 <= p.H_solo) cand = celulas(++fiada).cand;
    const zc = zDaFiada(fiada);
    const Lt = tr.x1 - tr.x0;
    const n = Math.max(1, Math.round(Lt / p.barbaca_s));
    const conta = ctx.barbacas ?? (ctx.barbacas = { pedidos: 0, desenhados: 0, emCanaleta: false });
    conta.pedidos += n;
    if (primeira.emCanaleta) conta.emCanaleta = true;
    const usados = new Set<number>();
    const Lb = t + 2 * SALIENCIA_BARBACA;
    const geo = geoPrismaReto(ctx, `barbacã Ø${fmt(d)} L${fmt(Lb)}`, 'X', circulo(d), Lb, `tubo Ø${fmt(d)} mm`);
    for (let j = 0; j < n; j++) {
      const alvo = tr.x0 + ((j + 0.5) * Lt) / n;
      let melhor = -1;
      cand.forEach((x, k) => {
        if (usados.has(k)) return;
        if (melhor < 0 || Math.abs(x - alvo) < Math.abs(cand[melhor] - alvo) - 1e-9) melhor = k;
      });
      if (melhor < 0) break;
      usados.add(melhor);
      conta.desenhados++;
      const x = cand[melhor];
      ctx.pecas.push({
        id: `${T}.BBC.${pad(j + 1, 2)}`, tipo: 'BARBACA', grupo: 'drenagem', geometria: geo,
        origem: [arred(x - d / 2), -SALIENCIA_BARBACA, arred(zc - d / 2)], giro: 90, trecho: tr.indice, fiada,
      });
    }
  }
}

// ── terreno (só para ver) ────────────────────────────────────────────────────

export function terreno(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  const zb = -(p.h_sap + (temDente(p) ? p.h_den : 0));
  const ultimo = tr.indice === mod.trechos.length;
  const xa = tr.x0 - (tr.indice > 1 ? JUNTA / 2 : 0);
  const xb = tr.x1 + (ultimo ? 0 : JUNTA / 2);
  const L = xb - xa;
  const T = `T${tr.indice}`;
  const H = p.H_solo;

  // aterro atrás do muro até a altura de solo da conta (não até o topo do muro desenhado — decisão do Jose), sem o
  // pacote do dreno (brita, areia e manta: a borda de fora dele, em degrau quando há dreno de fundo)
  const pac = pacoteDoDreno(ctx);
  const borda = bordaDoPacote(pac.retangulos, pac.fora).map(([u, v]) => [t + u, v] as Vec2);
  const yA = borda.length ? borda[0][0] : t;
  const y1 = Math.max(YbA, yA);
  const yFar = Math.max(y1, p.contrafortes && p.enterrado ? mod.tenr : t) + SOBRA_TERRENO;
  const aterro = semDuplicados([[yA, 0], [y1, 0], [y1, zb], [yFar, zb], [yFar, H], [t, H], ...borda.slice(0, -1).reverse()]);
  if (H > 0) {
    const g = geoPrismaReto(ctx, `aterro ${T}`, 'X', aterro, L);
    ctx.pecas.push({ id: `${T}.ATERRO`, tipo: 'ATERRO', grupo: 'terreno', geometria: g, origem: [arred(xa), arred(Math.min(...aterro.map((q) => q[0]))), arred(zb)], giro: 0, trecho: tr.indice });
  }

  // solo da frente: ao lado da sapata até o topo dela (Fig. 15) e, com aterro sobre a ponta (h_fr), por cima da
  // ponta até a face do muro. Contraforte aparente: o aterro sobre a ponta para na ponta dele e entra por vão.
  const hf = p.h_fr;
  const y0 = Math.min(Ype, 0);
  const aparente = p.contrafortes && !p.enterrado;
  const yNear = Math.min(y0, aparente ? t - mod.tenr : 0) - SOBRA_TERRENO;
  const yC = aparente ? Math.max(y0, t - mod.tenr) : 0;
  const frente: Vec2[] = hf > 0
    ? semDuplicados([[yNear, zb], [y0, zb], [y0, 0], [yC, 0], [yC, hf], [yNear, hf]])
    : [[yNear, zb], [y0, zb], [y0, 0], [yNear, 0]];
  const gF = geoPrismaReto(ctx, `solo da frente ${T}`, 'X', frente, L);
  ctx.pecas.push({ id: `${T}.SOLO`, tipo: 'SOLO_FRENTE', grupo: 'terreno', geometria: gF, origem: [arred(xa), arred(yNear), arred(zb)], giro: 0, trecho: tr.indice });
  if (hf > 0 && aparente && yC < 0) {
    for (let v = 0; v + 1 < tr.nos.length; v++) {
      const [x0, x1] = [tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs];
      if (x1 <= x0) continue;
      const g = geoPrismaReto(ctx, `solo sobre a ponta ${fmt(-yC)}x${fmt(hf)} L${fmt(x1 - x0)}`, 'X', retangulo(-yC, hf), x1 - x0);
      ctx.pecas.push({ id: `${T}.SOLO.v${v + 1}`, tipo: 'SOLO_FRENTE', grupo: 'terreno', geometria: g, origem: [arred(x0), arred(yC), 0], giro: 0, trecho: tr.indice });
    }
  }
}

function semDuplicados(p: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const q of p) {
    const u = out[out.length - 1];
    if (!u || Math.abs(u[0] - q[0]) > 1e-6 || Math.abs(u[1] - q[1]) > 1e-6) out.push(q);
  }
  return out;
}

// ── conferências que não dependem do trecho ──────────────────────────────────

export function conferenciasGerais(ctx: Ctx, Ype: number, YbA: number): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  // espera: o trecho vertical dentro da sapata tem de ancorar ℓb (brief §7.1 — nenhuma aba confere)
  const disponivel = p.h_sap - p.cob_sap - p.phi_sap - p.phi_sap2;
  if (p.lb !== null && disponivel < p.lb - 0.5) {
    ctx.avisos.push({ codigo: 'ESPERA_NAO_CABE', texto: `Espera: ${br(disponivel / 10, 1)} cm na sapata para ℓb = ${br(p.lb / 10, 1)} cm` });
  }
  if (p.traspasse === null && (p.lbphi_gr === null || p.a0t === null)) {
    ctx.avisos.push({ codigo: 'TRASPASSE_ADOTADO', texto: 'Traspasse: ℓb da conta indisponível — adotado 50φ (dedução)' });
  }
  // barbacã pedido e não desenhado (drenagem.ts conta por trecho; o aviso é um só, do muro todo)
  const bb = ctx.barbacas;
  if (bb && bb.desenhados < bb.pedidos) {
    const onde = bb.emCanaleta ? '1ª fiada em canaleta' : '1ª fiada sem célula livre';
    ctx.avisos.push({
      codigo: 'BARBACA_SEM_CELULA',
      texto: bb.desenhados === 0 ? `Barbacã não desenhado: ${onde}` : `Barbacã: ${bb.desenhados} de ${bb.pedidos} desenhados (${onde})`,
    });
  }
  if (p.contrafortes) {
    const fora = p.enterrado ? mod.tenr > YbA + 0.5 : t - mod.tenr < Ype - 0.5;
    if (fora) ctx.avisos.push({ codigo: 'CF_FORA_DA_SAPATA', texto: 'Contraforte passa da borda da sapata' });
  }
}
