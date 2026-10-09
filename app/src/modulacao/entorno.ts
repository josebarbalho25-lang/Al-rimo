/*
  O QUE ESTÁ EM VOLTA DA ALVENARIA — sapata (com armadura), drenagem (dreno, manta, barbacãs) e terreno (aterro e
  solo da frente, só para o 3D mostrar transparente; fora do IFC e do quantitativo).
*/
import type { Vec2 } from '@/modelo/tipos';
import { H_BLOCO, JUNTA } from './catalogo';
import type { Cavidade, MapaDeCavidades } from './cavidades';
import type { Parametros } from './leitura';
import { br, type TrechoModulado } from './modular';
import { arred, circulo, retangulo } from './perfis';
import { corrida, distribuir, estribo, reta } from './barras';
import { ESPESSURA_MANTA, SOBRA_TERRENO, fmt, geoPrismaReto, pad, type Ctx } from './contexto';
import { avisarTraspasseProporcional, traspasse } from './armaduras';

export const temDente = (p: Parametros): boolean => p.b_den > 0 && p.h_den > 0;

// ── sapata ───────────────────────────────────────────────────────────────────

export function sapata(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number): void {
  const { p } = ctx;
  const B = p.B_sap;
  const h = p.h_sap;
  const L = tr.x1 - tr.x0;
  let contorno: Vec2[];
  if (temDente(p)) {
    // dente centrado em B/2 (Fig. 15, e o peso dele em x = B/2 na aba Fundação)
    const yd0 = Math.max(Ype, YbA - B / 2 - p.b_den / 2);
    const yd1 = Math.min(YbA, yd0 + p.b_den);
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
      const bs = corrida(`${T}.L${face}${pad(k + 1, 2)}.`, 'SAP_LONG', p.phi_sap2, tr.x0 + c, tr.x1 - c, y, zL, traspasse(ctx, p.phi_sap2), [0, p.phi_sap2, 0], tr.indice);
      if (bs.length > 1) avisarTraspasseProporcional(ctx);
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

export function drenagem(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  const T = `T${tr.indice}`;

  // dreno de brita com manta no tardoz, do topo da sapata até `dreno_folga` abaixo do topo do solo; com
  // contraforte enterrado, um por vão (contorna as hastes)
  const zTopo = p.H_solo - p.dreno_folga;
  const e = p.dreno_esp;
  if (p.dreno && zTopo > 2 * ESPESSURA_MANTA && e > 2 * ESPESSURA_MANTA) {
    const vaos: [number, number][] = [];
    if (p.contrafortes && p.enterrado) {
      // de face a face dos contrafortes
      for (let v = 0; v + 1 < tr.nos.length; v++) vaos.push([tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs]);
    } else {
      vaos.push([tr.x0, tr.x1]);
    }
    const es = ESPESSURA_MANTA;
    vaos.forEach(([xa, xb], k) => {
      const L = xb - xa;
      if (L <= 0) return;
      const gB = geoPrismaReto(ctx, `dreno ${fmt(e - es)}x${fmt(zTopo - es)} L${fmt(L)}`, 'X', retangulo(e - es, zTopo - es), L, 'brita');
      ctx.pecas.push({ id: `${T}.DRN.v${k + 1}`, tipo: 'DRENO', grupo: 'drenagem', geometria: gB, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      const casca: Vec2[] = [[e - es, 0], [e, 0], [e, zTopo], [0, zTopo], [0, zTopo - es], [e - es, zTopo - es]];
      const gM = geoPrismaReto(ctx, `manta ${fmt(e)}x${fmt(zTopo)} L${fmt(L)}`, 'X', casca, L, 'manta geotêxtil');
      ctx.pecas.push({ id: `${T}.MNT.v${k + 1}`, tipo: 'MANTA', grupo: 'drenagem', geometria: gM, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
    });
  }

  // Barbacãs na 1ª fiada, no furo de um bloco do muro, fora do contraforte: numa célula sem graute; com graute
  // total, numa grauteada (o tubo vai antes do graute). Nunca numa célula com barra (o tubo atravessaria a barra) nem
  // na canaleta (o tubo furaria as paredes do U e passaria na altura da barra da canaleta). Sem célula assim — o muro
  // todo em canaleta, por exemplo —, o barbacã não é desenhado e o aviso diz (antes sumia calado, 09/10 noite).
  if (p.barbaca && p.barbaca_phi > 0 && p.barbaca_s > 0 && mod.n_fiadas > 0) {
    const d = p.barbaca_phi;
    const zc = JUNTA + H_BLOCO / 2;
    const foraDosNos = (x: number): boolean => !tr.nos.some((no) => x > no.xs - JUNTA - d / 2 && x < no.xe + d / 2);
    const comBarra = new Set<Cavidade>();
    for (const b of ctx.barras) {
      if (b.trecho !== tr.indice) continue;
      for (let k = 0; k + 1 < b.eixo.length; k++) {
        const [a, c] = [b.eixo[k], b.eixo[k + 1]];
        if (Math.abs(a[0] - c[0]) > 1e-6 || Math.abs(a[1] - c[1]) > 1e-6) continue;
        if (Math.min(a[2], c[2]) >= zc + d / 2 || Math.max(a[2], c[2]) <= zc - d / 2) continue;
        const f = mapa.achar(0, a[0], a[1]);
        if (f) comBarra.add(f.cav);
      }
    }
    const daParede = mapa.fiada(0).filter((c) => c.tipo === 'furo' && Math.abs(c.cy - t / 2) < 1e-6 && ctx.pecas[c.peca].grupo === 'muro' && foraDosNos(c.cx) && !comBarra.has(c));
    let cand = daParede.filter((c) => !c.grauteada).map((c) => c.cx);
    if (!cand.length) cand = daParede.map((c) => c.cx);
    const Lt = tr.x1 - tr.x0;
    const n = Math.max(1, Math.round(Lt / p.barbaca_s));
    const conta = ctx.barbacas ?? (ctx.barbacas = { pedidos: 0, desenhados: 0, emCanaleta: false });
    conta.pedidos += n;
    if (mapa.fiada(0).some((c) => c.tipo === 'canaleta' && Math.abs(c.cy - t / 2) < 1e-6)) conta.emCanaleta = true;
    const usados = new Set<number>();
    const geo = geoPrismaReto(ctx, `barbacã Ø${fmt(d)} L${fmt(t)}`, 'X', circulo(d), t, `tubo Ø${fmt(d)} mm`);
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
        origem: [arred(x - d / 2), 0, arred(zc - d / 2)], giro: 90, trecho: tr.indice, fiada: 0,
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

  // aterro atrás do muro até a altura de solo da conta (não até o topo do muro desenhado — decisão do Jose)
  const zDreno = p.H_solo - p.dreno_folga;
  const comDreno = p.dreno && zDreno > 2 * ESPESSURA_MANTA && p.dreno_esp > 2 * ESPESSURA_MANTA;
  const yA = t + (comDreno ? p.dreno_esp : 0);
  const y1 = Math.max(YbA, yA);
  const yFar = Math.max(y1, p.contrafortes && p.enterrado ? mod.tenr : t) + SOBRA_TERRENO;
  let aterro: Vec2[] = comDreno
    ? [[yA, 0], [y1, 0], [y1, zb], [yFar, zb], [yFar, H], [t, H], [t, zDreno], [yA, zDreno]]
    : [[yA, 0], [y1, 0], [y1, zb], [yFar, zb], [yFar, H], [t, H]];
  aterro = semDuplicados(aterro);
  if (H > 0) {
    const g = geoPrismaReto(ctx, `aterro ${T}`, 'X', aterro, L);
    ctx.pecas.push({ id: `${T}.ATERRO`, tipo: 'ATERRO', grupo: 'terreno', geometria: g, origem: [arred(xa), arred(Math.min(...aterro.map((q) => q[0]))), arred(zb)], giro: 0, trecho: tr.indice });
  }

  // solo da frente até o topo da sapata (Fig. 15; passivo com h da sapata + dente)
  const y0 = Math.min(Ype, 0);
  const yNear = Math.min(y0, p.contrafortes && !p.enterrado ? t - mod.tenr : 0) - SOBRA_TERRENO;
  const frente: Vec2[] = [[yNear, zb], [y0, zb], [y0, 0], [yNear, 0]];
  const gF = geoPrismaReto(ctx, `solo da frente ${T}`, 'X', frente, L);
  ctx.pecas.push({ id: `${T}.SOLO`, tipo: 'SOLO_FRENTE', grupo: 'terreno', geometria: gF, origem: [arred(xa), arred(yNear), arred(zb)], giro: 0, trecho: tr.indice });
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
  if (p.traspasse === null && p.lb === null) {
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
    if (p.traspasse === null) {
      ctx.avisos.push({ codigo: 'ANCORAGEM_CF', texto: 'Traspasse das barras do contraforte e do painel: ℓb da barra vertical proporcional ao Ø (dedução)' });
    }
    const fora = p.enterrado ? mod.tenr > YbA + 0.5 : t - mod.tenr < Ype - 0.5;
    if (fora) ctx.avisos.push({ codigo: 'CF_FORA_DA_SAPATA', texto: 'Contraforte passa da borda da sapata' });
  }
}
