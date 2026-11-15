/*
  PROVA DA ARMADURA DO DENTE (15/11; revisão do mesmo dia) — o estribo em pé e as longitudinais de montagem, lidos só
  do Modelo.
    · nos cenários do gabarito que têm dente (dos dois lados do muro, espaçamento automático e digitado);
    · numa VARREDURA: balanço e contrafortes, blocos 14 e 19, estribo de torção de 2 a 20 cm, dente de 15 × 15 a
      40 × 60 nas duas pontas do x permitido e no centro, Ø 5 a 12,5, espaçamento 5 a 20, estribo ou barra reta na
      sapata, espera padrão ou nó de cachorro, muro de 14 m (longitudinal emendada) e de 20 m com junta a cada 6 m.
      As entradas do dente entram por cima do Resultado do gabarito (comEntradas): o modelo só lê a conta.
  Em todos: distância de superfície a superfície, segmento a segmento, entre cada barra do dente e TODA outra barra —
  uma bitola de folga (a maior das duas) das barras de plano que atravessam o estribo (transversal e estribo da
  sapata, torção, espera, nó de cachorro, os outros estribos do dente) e nenhuma barra entrando em outra (as que se
  cruzam encostam: longitudinal no estribo). Única exceção: o aviso DENTE_APERTADO (sapata sem plano livre). E o vão
  entre estribos ≤ s, dentro do concreto com o cobrimento, e o estribo no corte em qualquer lugar do muro.
  Que nenhuma barra atravessa bloco, canaleta ou drenagem está em modulacao.test.ts (barrasEmPecaSolida).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, comEntradas, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Barra, Modelo, Vec3 } from '@/modelo/tipos';
import type { Resultado, Valor } from '@/motor/tipos';
import { barrasNoCorte } from '@/desenhos/corteLateral';
import { gerarModelo, padroesDoModelo } from './index';
import { pinoEstribo } from './barras';

const CENARIOS = cenariosDoGabarito();
const comDente = CENARIOS.filter((c) => resultadoDoGabarito(c).v('tem_den') === 'Sim');
const semDente = CENARIOS.filter((c) => resultadoDoGabarito(c).v('tem_den') !== 'Sim');

const doDente = (m: Modelo): Barra[] => m.barras.filter((b) => b.papel === 'DENTE_ESTRIBO' || b.papel === 'DENTE_LONG');
const TOL = 0.6;   // mm: as dobras vão em cordas (por dentro do arco) e as coordenadas em décimo de mm

// ── geometria: distância entre dois segmentos no espaço ─────────────────────────────────────────────────────────
type Seg = [Vec3, Vec3];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
function distSeg([p1, q1]: Seg, [p2, q2]: Seg): number {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s: number, t: number;
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = clamp(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = clamp(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
    }
  }
  const w = sub([p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t]);
  return Math.sqrt(dot(w, w));
}
interface Caixa { b: Barra; segs: Seg[]; lo: Vec3; hi: Vec3; dx: number }
function caixa(b: Barra): Caixa {
  const segs: Seg[] = [];
  for (let i = 1; i < b.eixo.length; i++) segs.push([b.eixo[i - 1], b.eixo[i]]);
  if (b.fechada) segs.push([b.eixo[b.eixo.length - 1], b.eixo[0]]);
  if (!segs.length) segs.push([b.eixo[0], b.eixo[0]]);
  const lo: Vec3 = [0, 1, 2].map((k) => Math.min(...b.eixo.map((p) => p[k])) - b.diametro / 2) as Vec3;
  const hi: Vec3 = [0, 1, 2].map((k) => Math.max(...b.eixo.map((p) => p[k])) + b.diametro / 2) as Vec3;
  return { b, segs, lo, hi, dx: hi[0] - lo[0] - b.diametro };
}
const longe = (a: Caixa, c: Caixa, folga: number): boolean =>
  [0, 1, 2].some((k) => a.hi[k] + folga < c.lo[k] || c.hi[k] + folga < a.lo[k]);
/** A menor distância LIVRE (superfície a superfície) entre duas barras. */
function livre(a: Caixa, c: Caixa): number {
  let d = Infinity;
  for (const s1 of a.segs) for (const s2 of c.segs) d = Math.min(d, distSeg(s1, s2));
  return d - (a.b.diametro + c.b.diametro) / 2;
}
/** Barra de plano (estribo, transversal, espera, nó de cachorro): pouco em x. A longitudinal corre o muro. */
const dePlano = (c: Caixa): boolean => c.dx <= 100;

/**
 * Os conflitos de folga das barras do dente com as outras (e entre si): lista de textos, vazia = tudo certo.
 * Barra de plano × estribo do dente: uma bitola (a maior); o resto: não entrar uma na outra.
 */
function conflitos(m: Modelo, encostar = false): string[] {
  const todas = m.barras.map(caixa);
  const dente = todas.filter((c) => c.b.papel.startsWith('DENTE_'));
  const out: string[] = [];
  for (const d of dente) {
    for (const o of todas) {
      if (o === d || (o.b.papel.startsWith('DENTE_') && o.b.id <= d.b.id)) continue;
      const deFolga = d.b.papel === 'DENTE_ESTRIBO' && dePlano(o) && o.b.papel !== 'DENTE_LONG';
      // sapata cerrada (o aviso DENTE_APERTADO): o estribo do dente encosta ou entra na barra de plano vizinha — o
      // resto (longitudinais, os do dente entre si) continua sem entrar um no outro
      if (encostar && deFolga && !o.b.papel.startsWith('DENTE_')) continue;
      const exige = deFolga ? Math.max(d.b.diametro, o.b.diametro) : 0;
      if (longe(d, o, exige + 1)) continue;
      const l = livre(d, o);
      if (l < exige - TOL) out.push(`${d.b.id} × ${o.b.id}: ${l.toFixed(1)} < ${exige}`);
    }
  }
  return out;
}

const centroX = (b: Barra): number => (Math.min(...b.eixo.map((p) => p[0])) + Math.max(...b.eixo.map((p) => p[0]))) / 2;

/** Vão ≤ s entre estribos do dente, o 1º e o último a ≤ s/2 das pontas; dentro do concreto com o cobrimento. */
function conferirDente(m: Modelo, r: Resultado, rotulo: string): void {
  const num = (n: string) => r.num(n)!;
  const c0 = num('cob_sap') * 10;
  const [B, h, bd, hd, xd] = ['B_sap', 'h_sap', 'b_den', 'h_den', 'x_den'].map((n) => num(n) * 1000);
  const phi = num('phi_den');
  const yTalao = m.dims.sapata.y1;
  const yc = yTalao - B / 2 - xd;
  const [yd0, yd1] = [Math.max(yTalao - B, yc - bd / 2), Math.min(yTalao, yc + bd / 2)];
  const estribos = m.barras.filter((b) => b.papel === 'DENTE_ESTRIBO');
  const longs = m.barras.filter((b) => b.papel === 'DENTE_LONG');
  // estreito demais para o estribo fechado (a regra da planilha, bmin_den): nenhuma barra, com aviso
  if (yd1 - yd0 - 2 * c0 - phi < pinoEstribo(phi) + phi - 1e-6) {
    expect(estribos.length + longs.length, rotulo).toBe(0);
    expect(m.avisos.some((a) => a.codigo === 'DENTE_ESTREITO'), rotulo).toBe(true);
    return;
  }
  expect(estribos.length, rotulo).toBeGreaterThan(0);
  const s = (r.num('s_den') ?? 20) * 10;
  for (const [k, tr] of m.dims.trechos.entries()) {
    const xs = estribos.filter((b) => b.trecho === k + 1).map(centroX).sort((a, b) => a - b);
    const [lo, hi] = [tr.x0 + c0 + phi, tr.x1 - c0 - phi];
    expect(xs.length, `${rotulo} T${k + 1}`).toBeGreaterThan(0);
    if (m.avisos.some((a) => a.codigo === 'DENTE_APERTADO')) continue;
    // até s/2 da ponta; até s quando uma barra da sapata tapa esse pedaço (a planosDoDente diz)
    expect(xs[0] - lo, `${rotulo} T${k + 1}: o 1º longe da ponta`).toBeLessThanOrEqual(s + TOL);
    expect(xs[0], `${rotulo} T${k + 1}`).toBeGreaterThanOrEqual(lo - TOL);
    expect(hi - xs[xs.length - 1], `${rotulo} T${k + 1}: o último longe da ponta`).toBeLessThanOrEqual(s + TOL);
    // o vão passa de s só onde nem encostado cabe (feixe de esperas do contraforte, torção cerrada): o aviso diz
    if (!m.avisos.some((a) => a.codigo === 'DENTE_APERTADO')) {
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${rotulo} T${k + 1}: vão ${i}`).toBeLessThanOrEqual(s + TOL);
    }
  }
  // o "c/" da chamada é o da conta
  for (const b of estribos) expect(b.espacamento, b.id).toBe(s);
  // forma: estribo de ganchos (polilinha aberta), do fundo do dente até logo abaixo da armadura de cima da sapata
  const zTopo = -c0 - num('phi_sap') - num('phi_sap2') - phi / 2;
  for (const b of estribos) {
    expect(b.estribo, b.id).toBe(true);
    expect(b.diametro).toBe(phi);
    const zs = b.eixo.map((p) => p[2]);
    expect(Math.min(...zs), b.id).toBeCloseTo(-h - hd + c0 + phi / 2, 1);
    expect(Math.max(...zs), b.id).toBeCloseTo(zTopo, 1);
    // os ganchos (as duas pontas da polilinha) dentro do dente, embaixo da sapata
    for (const p of [b.eixo[0], b.eixo[b.eixo.length - 1]]) expect(p[2], `${b.id}: gancho`).toBeLessThan(-h);
  }
  // dentro do concreto com o cobrimento: abaixo da sapata, entre as faces do dente; acima, até o cobrimento de cima
  for (const b of [...estribos, ...longs]) {
    const f = b.diametro / 2 - TOL;
    for (const [x, y, z] of b.eixo) {
      const onde = `${rotulo} ${b.id} (${x}, ${y}, ${z})`;
      expect(z, onde).toBeGreaterThanOrEqual(-h - hd + c0 + f);
      expect(z, onde).toBeLessThanOrEqual(-c0 - f);
      if (z < -h + c0) {
        expect(y, onde).toBeGreaterThanOrEqual(yd0 + c0 + f);
        expect(y, onde).toBeLessThanOrEqual(yd1 - c0 - f);
      }
    }
  }
  // a longitudinal da sapata que encosta na perna do dente nunca sai do cobrimento (a do canto, com o dente rente à
  // borda); a emendada da reta deita +φ desde 15/10 (o desenho de antes, barra por barra) e não entra aqui
  for (const b of m.barras.filter((q) => q.papel === 'SAP_LONG' && Number(q.id.split('.').pop()) % 2 === 1)) {
    for (const [, y] of b.eixo) {
      expect(y, `${rotulo} ${b.id}`).toBeGreaterThanOrEqual(yTalao - B + c0 - TOL);
      expect(y, `${rotulo} ${b.id}`).toBeLessThanOrEqual(yTalao - c0 + TOL);
    }
  }
  // folgas: sem exceção, a não ser a sapata sem plano livre (o aviso diz, uma vez): ali encostado, nunca entrando
  const apertado = m.avisos.filter((a) => a.codigo === 'DENTE_APERTADO').length;
  expect(apertado, rotulo).toBeLessThanOrEqual(1);
  expect(conflitos(m, apertado > 0), rotulo).toEqual([]);
  // o estribo do dente aparece no corte em qualquer lugar do muro
  for (const [k, tr] of m.dims.trechos.entries()) {
    for (const f of [0.02, 0.37, 0.5, 0.81, 0.98]) {
      const x = tr.x0 + f * (tr.x1 - tr.x0);
      expect(barrasNoCorte(m, x).linhas.some((l) => l.barra.papel === 'DENTE_ESTRIBO'), `${rotulo} T${k + 1} corte em ${Math.round(x)}`).toBe(true);
    }
  }
}

describe('armadura do dente', () => {
  it('o gabarito tem dente dos dois lados do muro e muro sem dente', () => {
    const lados = new Set(comDente.map((c) => resultadoDoGabarito(c).v('lado_den')));
    expect(lados).toEqual(new Set(['Ponta', 'Talão']));
    expect(semDente.length).toBeGreaterThan(0);
  });

  it('sem dente não há barra de dente', () => {
    for (const c of semDente) expect(doDente(gerarModelo(resultadoDoGabarito(c), padroesDoModelo())).length, c).toBe(0);
  });

  for (const c of comDente) {
    it(`${c}: estribos a cada ≤ s, longitudinais na quantidade da conta, folgas, dentro do concreto, no corte`, () => {
      const r0 = resultadoDoGabarito(c);
      for (const [r, extras] of [
        [r0, padroesDoModelo()],
        [comEntradas(r0, { sap_transv: 'Reta' }), { ...padroesDoModelo(), L_total: 20, junta_cada: 6, arranque: 'Nó de cachorro' }],
      ] as const) {
        const m = gerarModelo(r, extras);
        conferirDente(m, r, c);
        const nf = Math.max(2, Math.round(r.num('nf_den') ?? Math.max(2, Math.ceil((r.num('h_den')! * 1000) / 330) + 1)));
        const yc = m.dims.sapata.y1 - r.num('B_sap')! * 500 - r.num('x_den')! * 1000;
        for (const [k] of m.dims.trechos.entries()) {
          const longs = m.barras.filter((b) => b.papel === 'DENTE_LONG' && b.trecho === k + 1);
          if (!m.barras.some((b) => b.papel === 'DENTE_ESTRIBO')) continue;
          // nf por face (duas faces); a emendada deita ao lado da outra e não conta como outra linha
          const linhas = new Set(longs.map((b) => `${b.id.split('.')[2]}`));
          expect(linhas.size, `${c} T${k + 1} longitudinais`).toBe(2 * nf);
          expect(new Set(longs.map((b) => b.eixo[0][1] > yc)).size, `${c} T${k + 1}: as duas faces`).toBe(2);
        }
      }
    }, 120_000);
  }

  // ── a varredura ────────────────────────────────────────────────────────────────────────────────────────────────
  const tipoDe = (c: string) => `${resultadoDoGabarito(c).v('Tipo_muro')}|${resultadoDoGabarito(c).num('t_bloco')}`;
  const BASES = ['Balanço|19', 'Balanço|14', 'Contrafortes|14', 'Contrafortes|19']
    .map((t) => ['aula122', 'aula123', ...CENARIOS].find((c) => tipoDe(c) === t && resultadoDoGabarito(c).num('s_ps') !== null))
    .filter((c): c is string => !!c);
  const DENTES: [number, number][] = [[0.15, 0.15], [0.25, 0.5], [0.4, 0.6], [0.2, 0.3]];
  const PHIS = [5, 6.3, 8, 10, 12.5];
  const ESPACOS = [5, 7.5, 12.5, 20];
  const TORCAO = [2, 3, 5, 10, 20];
  const MUROS: Record<string, Valor>[] = [{ L_total: 14, junta_cada: 0 }, { L_total: 20, junta_cada: 6 }];

  it('a varredura tem os quatro muros', () => expect(BASES.length).toBe(4));

  // combinações por índice (uma "latina": cada valor de cada eixo aparece muitas vezes, sem o produto cheio)
  const N = 96;
  for (let i = 0; i < N; i++) {
    const base = BASES[i % BASES.length];
    const [bd, hd] = DENTES[Math.floor(i / 4) % DENTES.length];
    const phi = PHIS[(i * 3) % PHIS.length];
    const s = ESPACOS[(i * 7 + 1) % ESPACOS.length];
    const lado = [-1, 0, 1][(i * 5) % 3];
    const reta = i % 2 === 1;
    const no = Math.floor(i / 2) % 2 === 1;
    const muro = MUROS[Math.floor(i / 8) % MUROS.length];
    const tor = TORCAO[(i * 11) % TORCAO.length];
    const pl = PHIS[(i * 2 + 1) % 4];
    const rotulo = `${base} dente ${bd * 100}×${hd * 100} x${lado > 0 ? '+' : lado < 0 ? '−' : '0'} Ø${phi} c/${s} Ø${pl} ${reta ? 'reta' : 'estribo'} ${no ? 'nó' : 'padrão'} ${muro.L_total} m torção ${tor}`;
    it(`varredura ${i}: ${rotulo}`, () => {
      const r0 = resultadoDoGabarito(base);
      const B = r0.num('B_sap')!;
      const x = lado * (B - bd) / 2;
      const r = comEntradas(r0, {
        b_den: bd, h_den: hd, x_den: x, phi_den: phi, s_den: s, phi_lden: pl, nf_den: hd > 0.4 ? 3 : 2, tem_den: 'Sim',
        lado_den: B / 2 + x > r0.num('a_ater')! + 0.0005 ? 'Ponta' : 'Talão', sap_transv: reta ? 'Reta' : 'Estribo',
        ...(String(r0.v('Tipo_muro')).startsWith('Contra') ? { s_tor_f: tor, T_sd: Math.max(1, r0.num('T_sd') ?? 0) } : {}),
      });
      const m = gerarModelo(r, { ...padroesDoModelo(), ...muro, arranque: no ? 'Nó de cachorro' : 'Padrão' });
      conferirDente(m, r, rotulo);
      // o caso apertado só existe quando uma faixa proibida é mais larga que s (não há como passar por ela com a
      // folga: o feixe de esperas do contraforte, a torção cerrada): no balanço, com Ø pequeno e espaçamento folgado, nunca
      if (phi <= 8 && s >= 12.5 && !String(r0.v('Tipo_muro')).startsWith('Contra')) {
        expect(m.avisos.some((a) => a.codigo === 'DENTE_APERTADO'), rotulo).toBe(false);
      }
    }, 60_000);
  }

  it('chamada: o c/ do estribo do dente é o da conta, com a vírgula; o dente é elemento próprio (quantidade e c/ dele)', async () => {
    const { textoDaChamada, elementoDaBarra } = await import('@/desenhos/chamadas');
    const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 20, junta_cada: 6 });
    const est = m.barras.find((b) => b.papel === 'DENTE_ESTRIBO')!;
    expect(elementoDaBarra(est)).toBe('dente');
    expect(textoDaChamada(m, est.posicao, 'dente')).toMatch(/ c\/12,5 C=/);
    // a longitudinal do dente igual à da sapata leva o mesmo N, mas cada chamada conta só as do seu elemento
    for (const l of m.barras.filter((b) => b.papel === 'DENTE_LONG')) {
      const daSapata = m.barras.filter((b) => b.posicao === l.posicao && b.papel === 'SAP_LONG').length;
      const doDente = m.barras.filter((b) => b.posicao === l.posicao && b.papel === 'DENTE_LONG').length;
      expect(textoDaChamada(m, l.posicao, 'dente')).toContain(`${l.posicao} – ${doDente} `);
      if (daSapata) expect(textoDaChamada(m, l.posicao, 'sapata')).toContain(`${l.posicao} – ${daSapata} `);
    }
  });

  it('entra na lista de ferros e no aço do quantitativo com o nome do dente', async () => {
    const { listaDeFerros } = await import('@/quantitativo/aco');
    const m = gerarModelo(resultadoDoGabarito('aula122'), padroesDoModelo());
    const elementos = listaDeFerros(m.barras).linhas.map((p) => p.elemento).join(' | ');
    expect(elementos).toContain('Dente · estribo');
    expect(elementos).toContain('Dente · longitudinal');
  });
});
