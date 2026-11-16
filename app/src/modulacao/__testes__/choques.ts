/*
  CHOQUE ENTRE BARRAS (só para os testes): duas barras que passam a menos de (φa + φb)/2 uma da outra — a superfície de
  uma dentro da outra. Usado pelo estribo de 4 ramos e pelo estribo do contraforte dobrado.
*/
import type { Barra, Vec3 } from '@/modelo/tipos';

/** Menor distância entre dois segmentos no espaço (mm). */
export function distSegSeg(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
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
export function choques(estribos: Barra[], outras: Barra[]): string[] {
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
