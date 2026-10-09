/*
  CONTAS DE GEOMETRIA DO QUANTITATIVO — área de perfil, caixa de peça, manta.

  O quantitativo não modula nada: só mede o que a modulação entregou. Duas convenções do contrato
  (modelo/tipos.ts) não estão escritas com todas as letras, e o quantitativo precisa delas para achar as juntas
  verticais (peças vizinhas a 10 mm) e a altura da haste do contraforte. Ficam AQUI, num lugar só, para que a
  correção seja de uma linha se a modulação tiver adotado outra:

  1. Plano do perfil, por eixo de extrusão (local), na ordem (u, v) do Vec2:
       eixo 'Z' → (x, y)   blocos e graute de furo: perfil = planta
       eixo 'X' → (y, z)   canaleta, sapata, graute de canaleta: perfil = corte
       eixo 'Y' → (x, z)   barbacã atravessando o muro
  2. `Peca.origem` = canto mínimo da CAIXA da peça já girada (brief da modulação, §6). Com isso o giro em Z só
     troca as medidas em X e Y da caixa (90°/270°) — o quantitativo não precisa saber em torno de que ponto girou.
  São as mesmas de modulacao/perfis.ts (quem fabrica o Modelo); o teste de integração confere `caixaDaPeca`
  contra `caixaGlobal` de lá, peça a peça, em todos os cenários do gabarito. A conta fica repetida aqui de
  propósito: o quantitativo só LÊ o Modelo e não pode quebrar quando a modulação estiver em obra.
*/
import type { Geometria, Peca, Vec2 } from '@/modelo/tipos';

export interface Caixa { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type Eixo = 'X' | 'Y' | 'Z';

/** Área de um laço (fórmula do cadarço), sempre positiva: contorno anti-horário e furo horário dão o mesmo módulo. */
export function areaDoLaco(p: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function perimetroDoLaco(p: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

/** Área do perfil com os furos descontados (mm²). */
export function areaLiquida(g: Geometria): number {
  const furos = g.perfil.furos ?? [];
  return areaDoLaco(g.perfil.contorno) - furos.reduce((s, f) => s + areaDoLaco(f), 0);
}

/** Área do contorno, sem descontar furos (mm²). */
export function areaBruta(g: Geometria): number {
  return areaDoLaco(g.perfil.contorno);
}

/** Retângulo envolvente do perfil no plano (u, v). */
export function limitesDoPerfil(g: Geometria): { u0: number; u1: number; v0: number; v1: number } {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [u, v] of g.perfil.contorno) {
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { u0, u1, v0, v1 };
}

/** Medidas da caixa em coordenadas LOCAIS (antes do giro): [dx, dy, dz]. */
export function medidasLocais(g: Geometria): [number, number, number] {
  const { u0, u1, v0, v1 } = limitesDoPerfil(g);
  const du = u1 - u0, dv = v1 - v0, e = g.extensao;
  if (g.eixo === 'Z') return [du, dv, e];
  if (g.eixo === 'X') return [e, du, dv];
  return [du, e, dv];                       // eixo 'Y': perfil em (x, z)
}

/** Caixa global da peça (mm), na convenção 2 do cabeçalho. */
export function caixaDaPeca(p: Peca, g: Geometria): Caixa {
  const [lx, ly, lz] = medidasLocais(g);
  const deitada = p.giro === 90 || p.giro === 270;
  const dx = deitada ? ly : lx;
  const dy = deitada ? lx : ly;
  const [ox, oy, oz] = p.origem;
  return { x0: ox, x1: ox + dx, y0: oy, y1: oy + dy, z0: oz, z1: oz + lz };
}

/** Direção global da extrusão depois do giro em Z. */
export function eixoGlobal(g: Geometria, giro: Peca['giro']): Eixo {
  if (g.eixo === 'Z' || giro === 0 || giro === 180) return g.eixo;
  return g.eixo === 'X' ? 'Y' : 'X';
}

/**
 * Área de uma peça laminar (manta): a modulação pode desenhá-la de dois jeitos e os dois têm de dar a mesma área.
 *  (a) perfil fino (uma tira em corte, reta, em U ou anel) extrudado ao longo do muro → área = linha média × extensão;
 *  (b) perfil = a própria folha, extrudado pela espessura → área = área do perfil.
 * Linha média de uma tira de largura s e espessura e: P/2 = s + e e A = s·e ⇒ s = (P/2 + √((P/2)² − 4A))/2 —
 * exato na tira reta e no anel em volta de um retângulo; no U erra só a ordem da espessura nos cantos.
 */
export function areaDaFolha(g: Geometria): number {
  const A = areaLiquida(g);
  const semi = (perimetroDoLaco(g.perfil.contorno)
    + (g.perfil.furos ?? []).reduce((s, f) => s + perimetroDoLaco(f), 0)) / 2;
  const disc = semi * semi - 4 * A;
  const s = disc >= 0 ? (semi + Math.sqrt(disc)) / 2 : semi / 2;
  const espessura = s > 0 ? A / s : 0;
  return g.extensao >= espessura ? s * g.extensao : A;
}

/** Recorta um polígono simples ao semiplano v ≥ c (Sutherland–Hodgman com uma aresta só). */
export function recortarAcimaDe(p: Vec2[], c: number): Vec2[] {
  const saida: Vec2[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const aDentro = a[1] >= c, bDentro = b[1] >= c;
    if (aDentro) saida.push(a);
    if (aDentro !== bDentro) {
      const t = (c - a[1]) / (b[1] - a[1]);
      saida.push([a[0] + t * (b[0] - a[0]), c]);
    }
  }
  return saida;
}
