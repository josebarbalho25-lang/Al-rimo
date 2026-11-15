/*
  AS ÁREAS DE UMA FACE DO DIAGRAMA — um lugar só para a vista 3D (cenaDosEsforcos.ts) e o desenho da memória
  (memoria/desenhoDosEsforcos.ts) pintarem o mesmo: o verde (colocado) de 0 até ele, o vermelho (necessário) de 0 até
  o menor dos dois, o vermelho forte (falta) do verde até o necessário onde este passa, e o "não resiste" cheio. Cada
  área é um trapézio exato entre duas quinas (as das duas curvas e os cruzamentos), sem serrilhado.
*/
import type { FaceDoDiagrama, PontoDoDiagrama } from './tipos';

/** Um trapézio: em s0 de a0 a b0, em s1 de a1 a b1 (valores na unidade do diagrama, ≥ 0). */
export interface Trapezio { tipo: 'colocado' | 'necessario' | 'falta'; s0: number; s1: number; a0: number; b0: number; a1: number; b1: number }

/** A reta de uma curva dentro do intervalo (a, b) (no degrau vale a de dentro do intervalo). Fora da curva: zero. */
export function retaEm(ps: readonly PontoDoDiagrama[], a: number, b: number): (s: number) => number {
  const m = (a + b) / 2;
  if (!ps.length || m < ps[0]!.s || m > ps[ps.length - 1]!.s) return () => 0;
  for (let i = 0; i + 1 < ps.length; i++) {
    const p = ps[i]!;
    const q = ps[i + 1]!;
    if (m >= p.s && m <= q.s && q.s > p.s) return (s) => p.v + ((q.v - p.v) * (s - p.s)) / (q.s - p.s);
  }
  return () => 0;
}

/**
 * Os trapézios de uma face. `fimLivre`: o trecho junto da ponta livre em que a sobra do necessário fica no tom
 * normal (o cobrimento depois da última barra — Diagrama.fimLivre). `topo`: a altura do "não resiste".
 */
export function areasDaFace(f: FaceDoDiagrama, L: number, fimLivre: number, topo: number): Trapezio[] {
  const out: Trapezio[] = [];
  for (let i = 0; i + 1 < f.colocado.length; i++) {
    const a = f.colocado[i]!;
    const b = f.colocado[i + 1]!;
    if (b.s > a.s) out.push({ tipo: 'colocado', s0: a.s, s1: b.s, a0: 0, b0: a.v, a1: 0, b1: b.v });
  }
  const ss = new Set<number>();
  for (const p of f.necessario) ss.add(p.s);
  for (const p of f.colocado) ss.add(p.s);
  let xs = [...ss].filter((s) => s >= 0 && s <= L).sort((a, b) => a - b);
  const cortes: number[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const [a, b] = [xs[i]!, xs[i + 1]!];
    if (!(b > a)) continue;
    const n = retaEm(f.necessario, a, b);
    const c = retaEm(f.colocado, a, b);
    const g0 = n(a) - c(a);
    const g1 = n(b) - c(b);
    if ((g0 < 0 && g1 > 0) || (g0 > 0 && g1 < 0)) cortes.push(a + ((b - a) * g0) / (g0 - g1));
  }
  xs = [...new Set([...xs, ...cortes])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const [a, b] = [xs[i]!, xs[i + 1]!];
    if (!(b > a)) continue;
    const n = retaEm(f.necessario, a, b);
    const c = retaEm(f.colocado, a, b);
    const na = n(a);
    const nb = n(b);
    if (na <= 0 && nb <= 0) continue;
    const ca = c(a);
    const cb = c(b);
    out.push({ tipo: 'necessario', s0: a, s1: b, a0: 0, b0: Math.min(na, ca), a1: 0, b1: Math.min(nb, cb) });
    if (na > ca + 1e-12 || nb > cb + 1e-12) {
      // além da última barra, no cobrimento da ponta livre, o resto do necessário fica no tom normal (não é falta)
      out.push({ tipo: a >= L - fimLivre - 1e-6 ? 'necessario' : 'falta', s0: a, s1: b, a0: Math.min(na, ca), b0: na, a1: Math.min(nb, cb), b1: nb });
    }
  }
  for (const [a, b] of f.naoResiste) if (b > a) out.push({ tipo: 'falta', s0: a, s1: b, a0: 0, b0: topo, a1: 0, b1: topo });
  return out;
}

/** O maior valor de uma face (colocado, necessário, mínimo): a régua do desenho. */
export const topoDaFace = (f: FaceDoDiagrama): number =>
  Math.max(f.minimo ?? 0, ...f.colocado.map((p) => p.v), ...f.necessario.map((p) => p.v), 0);
