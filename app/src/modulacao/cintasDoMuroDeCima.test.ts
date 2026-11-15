// As CINTAS DO MURO DE CIMA montadas como a conta diz (aba Muro de cima e vento, seção 9, 15/11): a quantidade de
// barras (n_cin_a), o lugar delas (ce_cmc das faces; no meio da altura com 2, a 3 cm de cima e de baixo com 4), a
// ancoragem no pilarete da ponta (reta ou gancho, anc_cT / anc_cM) — e nenhuma barra fora do concreto ou cortando
// barra do pilarete (a longitudinal e o estribo).
import { describe, expect, it } from 'vitest';
import type { Barra, Modelo, Peca, Vec3 } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { caixaGlobal } from './perfis';
import { H_FIADA } from './catalogo';

const comMuroDeCima = cenariosDoGabarito().filter((c) => resultadoDoGabarito(c).v('mc_on') === 'Sim');

const montar = (r: Resultado, L = 6): Modelo => gerarModelo(r, { ...padroesDoModelo(), L_total: L });
const cintas = (m: Modelo) => m.barras.filter((b) => b.papel === 'CINTA_MC');

/** Menor distância entre dois segmentos 3D. */
function distSeg(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return Math.sqrt(dot(r, r));
  if (a <= 1e-12) t = Math.min(1, Math.max(0, f / e));
  else {
    const c = dot(d1, r);
    if (e <= 1e-12) s = Math.min(1, Math.max(0, -c / a));
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const c1 = [p1[0] + d1[0]! * s, p1[1] + d1[1]! * s, p1[2] + d1[2]! * s];
  const c2 = [p2[0] + d2[0]! * t, p2[1] + d2[1]! * t, p2[2] + d2[2]! * t];
  return Math.hypot(c1[0]! - c2[0]!, c1[1]! - c2[1]!, c1[2]! - c2[2]!);
}

const segmentos = (b: Barra): [Vec3, Vec3][] => b.eixo.slice(1).map((q, i) => [b.eixo[i]!, q]);
const dentro = (m: Modelo, ps: Peca[], q: Vec3, folga: number) => ps.some((p) => {
  const c = caixaGlobal(p, m.geometrias[p.geometria]!);
  return [0, 1, 2].every((i) => q[i]! >= c.min[i]! + folga - 1e-6 && q[i]! <= c.max[i]! - folga + 1e-6);
});

describe('cintas do muro de cima', () => {
  it('o gabarito tem os casos: topo, meia altura, as duas, 2 e 4 barras, gancho', () => {
    const rs = comMuroDeCima.map((c) => resultadoDoGabarito(c));
    expect(rs.some((r) => r.v('cin_mc') === 'No topo')).toBe(true);
    expect(rs.some((r) => r.v('cin_mc') === 'A meia altura')).toBe(true);
    expect(rs.some((r) => r.v('cin_mc') === 'No topo e a meia altura')).toBe(true);
    expect(rs.some((r) => r.num('n_cin_a') === 2)).toBe(true);
    expect(rs.some((r) => r.num('n_cin_a') === 4)).toBe(true);
    expect(rs.some((r) => r.v('anc_cM') === 'Gancho' || r.v('anc_cT') === 'Gancho')).toBe(true);
  });

  for (const cenario of comMuroDeCima) {
    it(`${cenario}: barras como a conta diz, dentro do concreto e sem cortar as do pilarete`, () => {
      const r = resultadoDoGabarito(cenario);
      const m = montar(r);
      const mc = m.dims.muroDeCima!;
      const n = r.num('n_cin_a')!;
      const ce = r.num('ce_cmc')! * 10;
      const phi = r.num('phi_cin_mc')!;
      const cs = cintas(m);
      const fiadas = (mc.cintas ?? []).length;
      expect(cs.length, 'uma barra por posição (muro de 6 m, sem emenda)').toBe(fiadas * n * m.dims.trechos.length);
      expect(new Set(cs.map((b) => b.diametro))).toEqual(new Set(fiadas ? [phi] : []));
      const y0 = (m.familia.t - mc.t) / 2;
      for (const b of cs) {
        const ys = new Set(b.eixo.map((q) => q[1]));
        expect(ys.size, b.id).toBe(1);
        const y = b.eixo[0]![1];
        expect(Math.min(Math.abs(y - (y0 + ce)), Math.abs(y - (y0 + mc.t - ce))), `${b.id}: eixo a ce_cmc da face`).toBeLessThan(1);
      }
      // camadas: no meio (2) ou a 3 cm de cima e de baixo (4)
      // o trecho deitado é o mais alto da barra (o gancho desce)
      const zDeitado = (b: Barra) => Math.max(...b.eixo.map((q) => q[2]));
      for (const c of mc.cintas ?? []) {
        const zb = c.z - H_FIADA / 2;
        const daCinta = cs.filter((b) => Math.abs(zDeitado(b) - c.z) < H_FIADA / 2);
        const esperado = n === 4 ? [zb + 30, zb + H_FIADA - 30] : [c.z];
        expect([...new Set(daCinta.map((b) => Math.round(zDeitado(b))))].sort((a, b) => a - b), `cinta ${c.qual}`).toEqual(esperado.map(Math.round));
        // a ancoragem: gancho quando a conta pede
        const k = c.qual === 'topo' ? 'T' : 'M';
        const gancho = r.v(`anc_c${k}`) === 'Gancho';
        for (const b of daCinta) {
          const zMin = Math.min(...b.eixo.map((q) => q[2]));
          const zMeio = zDeitado(b);
          if (gancho) {
            expect(zMeio - zMin, `${b.id}: gancho de 90° descendo`).toBeGreaterThan(8 * phi);
            // desenvolvido ≈ o da polilinha (o arco em 4 cordas fica um pouco abaixo)
            const L = segmentos(b).reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]), 0);
            expect(Math.abs(b.comprimento - L) / b.comprimento, b.id).toBeLessThan(0.01);
          } else {
            expect(zMeio - zMin, `${b.id}: reta`).toBeLessThan(1e-6);
          }
        }
      }
      // dentro do concreto: cinta ou pilarete, com o raio da barra de folga
      const concreto = m.pecas.filter((p) => p.tipo === 'CINTA_MC' || p.tipo === 'PILARETE');
      for (const b of cs) {
        for (const [p, q] of segmentos(b)) {
          for (const f of [0, 0.25, 0.5, 0.75, 1]) {
            const pt: Vec3 = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
            expect(dentro(m, concreto, pt, phi / 2 - 0.5), `${b.id} fora do concreto em ${pt.map(Math.round).join(', ')}`).toBe(true);
          }
        }
      }
      // sem cortar barra do pilarete: eixos a pelo menos a soma dos raios (encostar pode, cortar não)
      const doPilarete = m.barras.filter((b) => b.papel === 'PIL_LONG' || b.papel === 'PIL_ESTRIBO');
      const batidas: string[] = [];
      for (const b of cs) {
        for (const o of doPilarete) {
          const minimo = (b.diametro + o.diametro) / 2 - 0.5;
          for (const [p, q] of segmentos(b)) for (const [u, v] of segmentos(o)) {
            if (distSeg(p, q, u, v) < minimo) {
              batidas.push(`${b.id} × ${o.id}`);
              break;
            }
          }
        }
      }
      expect([...new Set(batidas)]).toEqual([]);
    });
  }

  it('sem muro de cima, sem barra de cinta', () => {
    const r = resultadoDoGabarito('aula122');
    expect(cintas(montar(r))).toEqual([]);
  });
});
