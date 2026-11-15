/*
  ESTRIBO DO CONTRAFORTE COM 2 OU 4 RAMOS (Jose, 15/11: "coloca 2 ou 4, 3 ramos não existe; 4 são 2 estribos
  menores — no Pró-Viga tem um modelo quando a viga tem uma base grande"). O que quebraria:
  - o desenho com outro número de ramos que o da conta (a planilha conta os que cabem, ram_ef; o modelo desenha esses);
  - o par do estribo de 4 ramos fora da regra do Pró-Viga (2/3 da largura, deslocados ±1/6, ganchos no canto de fora);
  - os dois estribos do par saindo com posições diferentes na lista de ferros (são a mesma barra, espelhada);
  - um ramo atravessando barra vertical do contraforte, espera ou o U da canaleta;
  - a planilha dizendo que cabe onde o desenho não comporta (gancho curto, ramo sobre a barra).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, lerGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { calcular } from '@/motor';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Barra, Modelo, Vec3 } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from './index';
import { RECUO_ESTRIBO_LATERAL } from './contexto';
import { ganchoEstribo, medidasDoEstribo } from './barras';
import { barrasQueCabem, faixaDosQuatroRamos } from './secaoDoContraforte';

const modelo = (r: Resultado, extras: Record<string, Valor> = {}): Modelo => gerarModelo(r, { ...padroesDoModelo(), ...extras });

/** Menor distância entre dois segmentos no espaço (mm). */
function distSegSeg(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  const cl = (x: number) => Math.min(1, Math.max(0, x));
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = cl(f / e); }
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) { t = 0; s = cl(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? cl((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
}

/** Barras que passam a menos de (φa + φb)/2 uma da outra (superfície dentro da outra), com folga de 0,05 mm. */
function choques(estribos: Barra[], outras: Barra[]): string[] {
  const out: string[] = [];
  const caixa = (b: Barra) => [0, 1, 2].map((k) => [Math.min(...b.eixo.map((p) => p[k]!)), Math.max(...b.eixo.map((p) => p[k]!))]);
  const caixas = new Map(outras.map((o) => [o, caixa(o)]));
  for (const e of estribos) {
    const ce = caixa(e);
    const zmin = ce[2]![0]! - 50;
    const zmax = ce[2]![1]! + 50;
    for (const o of outras) {
      const co = caixas.get(o)!;
      if ([0, 1, 2].some((k) => co[k]![0]! > ce[k]![1]! + 50 || co[k]![1]! < ce[k]![0]! - 50)) continue;
      const lim = (e.diametro + o.diametro) / 2 - 0.05;
      for (let i = 0; i + 1 < o.eixo.length; i++) {
        const [a, b] = [o.eixo[i]!, o.eixo[i + 1]!];
        if (Math.max(a[2], b[2]) < zmin || Math.min(a[2], b[2]) > zmax) continue;
        for (let j = 0; j + 1 < e.eixo.length; j++) {
          const d = distSegSeg(e.eixo[j]!, e.eixo[j + 1]!, a, b);
          if (d < lim) { out.push(`${e.id} × ${o.id} (${d.toFixed(2)} < ${lim.toFixed(2)})`); break; }
        }
      }
    }
  }
  return out;
}

/** Os estribos de cada junta de cada contraforte. */
function juntas(m: Modelo): Map<string, Barra[]> {
  const g = new Map<string, Barra[]>();
  for (const b of m.barras) {
    if (b.papel !== 'CF_ESTRIBO') continue;
    const k = b.id.replace(/b$/, '');
    g.set(k, [...(g.get(k) ?? []), b]);
  }
  return g;
}

const contrafortesComEstribo = cenariosDoGabarito()
  .map((c) => ({ c, r: resultadoDoGabarito(c) }))
  .filter(({ r }) => r.v('Tipo_muro') === 'Contrafortes' && r.num('Asw_c') !== 0 && r.num('Asw_c') !== null);

/** O cenário do gabarito com entradas trocadas, refeito pelo motor (a conta muda: ram_ef, Asw_e…). */
const refeito = (c: string, trocas: Record<string, Valor>): Resultado => calcular({ ...lerGabarito(c).alterado, ...trocas });

describe('estribo do contraforte: 2 ou 4 ramos', () => {
  it('o gabarito tem os três casos: 2, 4 que cabe e 4 que não cabe', () => {
    const quatroCabe = contrafortesComEstribo.filter(({ r }) => r.num('ram_ef') === 4);
    const quatroNao = contrafortesComEstribo.filter(({ r }) => r.num('ramos_est') === 4 && r.num('ram_ef') === 2);
    expect(quatroCabe.length).toBeGreaterThan(2);
    expect(quatroNao.length).toBeGreaterThan(1);
    // o que não cabe reprova dizendo; o que cabe passa nesta verificação
    for (const { c, r } of quatroNao) expect(String(r.v('chk_ram_cf')), c).toMatch(/^NÃO OK — 4 ramos não cabem na largura do contraforte/);
    for (const { c, r } of quatroCabe) expect(String(r.v('chk_ram_cf')), c).toMatch(/^OK/);
  });

  it('a conta só conta o que cabe: bloco 14 nunca (gancho), bloco 19 até as barras que cabem entre os ramos do meio', () => {
    for (const { c, r } of contrafortesComEstribo) {
      if (r.num('ramos_est') !== 4) { expect(r.num('ram_ef'), c).toBe(2); continue; }
      const t = r.num('t_bloco')!;
      const familia = t === 19 ? '19x39' : '14x39';
      const pos = String(r.v('pos_cf')).startsWith('Ente') ? 'enterrado' : 'aparente';
      const cabem = barrasQueCabem(familia, r.num('tenr_adot')! * 10, pos, r.num('phi_cf')!, faixaDosQuatroRamos(t * 10, r.num('phi_est')!));
      expect(r.num('nb4_cab'), c).toBe(cabem);
      expect(r.num('ram_ef'), c).toBe(t === 19 && r.num('n_cf')! <= cabem ? 4 : 2);
      // Asw,ef = ramos que cabem × área / s
      const asw = (r.num('ram_ef')! * Math.PI * r.num('phi_est')! ** 2) / 400 / r.num('s_est')! * 100;
      expect(r.num('Asw_e'), c).toBeCloseTo(asw, 9);
    }
  });

  it('a regra da planilha é a medida do desenho (o gancho do estribo menor e o ramo do meio)', () => {
    for (const t of [14, 19]) for (const phi of [5, 6.3]) {
      const e = t * 10 - 2 * RECUO_ESTRIBO_LATERAL;
      const w4 = (2 * e) / 3;
      const m = medidasDoEstribo(phi, w4, 500);
      // planilha: (w4 − φ − (1 + √2/2)·r)/(√2/2) ≥ 5φ ≥ 5 cm, r = 2φ (pino 3φ) — a mesma conta do desenho
      const pg = (w4 - phi - (1 + Math.SQRT1_2) * 2 * phi) / Math.SQRT1_2;
      expect(m.pontaCurta, `bloco ${t} Ø${phi}`).toBe(pg < ganchoEstribo(phi) - 0.05);
      expect(m.pontaCurta, `bloco ${t} Ø${phi}`).toBe(t === 14);
    }
  });

  it('desenho: um estribo por junta com 2, o par do Pró-Viga com 4 — mesma posição, ganchos fora, sem choque', () => {
    let pares = 0;
    for (const { c, r } of contrafortesComEstribo) {
      const m = modelo(r);
      const n = r.num('ram_ef') === 4 ? 2 : 1;
      const js = juntas(m);
      expect(js.size, c).toBeGreaterThan(0);
      for (const [k, es] of js) {
        expect(es.length, `${c} ${k}`).toBe(n);
        if (n === 2) {
          pares++;
          expect(es[0]!.posicao, `${c} ${k}`).toBe(es[1]!.posicao);
          const t = r.num('t_bloco')! * 10;
          const e = t - 2 * RECUO_ESTRIBO_LATERAL;
          const xs = es.map((b) => [Math.min(...b.eixo.map((p) => p[0])), Math.max(...b.eixo.map((p) => p[0]))]);
          const larg = xs.map(([a, b]) => b - a);
          // os dois de 2/3 da largura (o eixo dos ramos; a polilinha encosta nos ramos de fora + meia bitola não)
          for (const w of larg) expect(w, `${c} ${k}`).toBeCloseTo((2 * e) / 3, 0);
          // deslocados: os de fora nas duas faces, sobrepostos no terço do meio
          expect(Math.abs(xs[0]![0] - xs[1]![0]), `${c} ${k}`).toBeCloseTo(e / 3, 0);
        }
      }
      // o choque do gancho do estribo de 2 ramos com a construtiva do canto no bloco 14 é de antes (CLAUDE.md,
      // achado de 15/11): aqui se confere o par de 4 ramos
      if (n === 2) {
        const estribos = m.barras.filter((b) => b.papel === 'CF_ESTRIBO');
        const outras = m.barras.filter((b) => !b.estribo);
        expect(choques(estribos, outras), c).toEqual([]);
      }
    }
    expect(pares).toBeGreaterThan(0);
  }, 60_000);

  it('o mesmo muro com 4 ramos: Ø6,3 e Ø5 cabem no 19; enterrado e aparente; poucas e muitas barras; sem choque', () => {
    const base = contrafortesComEstribo.find(({ r }) => r.num('t_bloco') === 19)!;
    let feitos = 0;
    for (const pos of ['Enterrado (lado do solo)', 'Aparente (lado de fora)']) for (const phi_est of [5, 6.3]) for (const [phi_cf, n] of [[8, 2], [8, 8], [10, 4], [10, 6], [12.5, 2]] as const) {
      const r = refeito(base.c, { ramos_est: 4, phi_est, phi_cf, n_cf_dir: n, pos_cf: pos });
      const nome = `${base.c} ${pos} Ø${phi_est} ${n}Ø${phi_cf}`;
      if (r.num('Asw_c') === 0) continue;
      expect(r.num('ram_ef'), nome).toBe(4);
      feitos++;
      const m = modelo(r);
      const js = [...juntas(m).values()];
      expect(js.length, nome).toBeGreaterThan(0);
      for (const es of js) expect(es.length, nome).toBe(2);
      const outras = m.barras.filter((b) => !b.estribo);
      expect(choques(m.barras.filter((b) => b.papel === 'CF_ESTRIBO'), outras), nome).toEqual([]);
    }
    expect(feitos).toBeGreaterThan(10);
  }, 60_000);

  it('pedido 4 e não cabe: a conta fica com 2 e o desenho também', () => {
    const base = contrafortesComEstribo.find(({ r }) => r.num('t_bloco') === 19)!;
    const r = refeito(base.c, { ramos_est: 4, phi_cf: 10, n_cf_dir: 8 });
    expect(r.num('Asw_c')).toBeGreaterThan(0);
    expect(r.num('ram_ef')).toBe(2);
    expect(String(r.v('chk_ram_cf'))).toBe('NÃO OK — 4 ramos não cabem na largura do contraforte (8 barras e só 6 cabem entre os ramos do meio)');
    for (const es of juntas(modelo(r)).values()) expect(es.length).toBe(1);
  });
});
