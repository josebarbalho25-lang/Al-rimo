/*
  GEOMETRIA DOS DESENHOS — a peça do Modelo vira sólido no mundo, e o sólido vira o que o desenho precisa:
  projeção (vista), seção (corte, planta), recorte (isométrico cortado) e faces (isométrico).

  Duas leituras do contrato (modelo/tipos.ts) que o contrato não escreve com todas as letras. São as MESMAS do
  visor (visor/perfil3d.ts) e do quantitativo (quantitativo/geometria.ts) — DEDUÇÃO comum, num lugar só aqui:
    1) Plano do perfil por eixo de extrusão: 'Z' → (x, y) planta do bloco; 'X' → (y, z) seção da canaleta e da
       sapata; 'Y' → (x, z) barbacã. Extrusão de 0 a +extensao.
    2) `Peca.origem` = canto mínimo da CAIXA da peça já girada. O giro (em Z) é aplicado ao perfil local e depois
       a caixa girada é transladada até a origem.
  Se a modulação adotar outra leitura, muda-se `pontoLocal` ou `solidoDaPeca` e os quatro desenhos acompanham.

  Tudo aqui é conta pura em mm, sem SVG — o desenho só escolhe estilo.
*/
import type { Geometria, Modelo, Peca, Vec2, Vec3 } from '@/modelo/tipos';

export type Eixo = 'X' | 'Y' | 'Z';
const IDX: Record<Eixo, 0 | 1 | 2> = { X: 0, Y: 1, Z: 2 };

/** Coordenadas 2D de cada plano de desenho: plano ⟂ X → (y, z); ⟂ Y → (x, z); ⟂ Z → (x, y). */
const PLANO: Record<Eixo, [0 | 1 | 2, 0 | 1 | 2]> = { X: [1, 2], Y: [0, 2], Z: [0, 1] };

export interface Solido {
  peca: Peca;
  geo: Geometria;
  eixo: Eixo;                 // direção da extrusão NO MUNDO (o giro troca X ↔ Y)
  base: Vec3[];               // contorno na posição 0 da extrusão
  topo: Vec3[];               // contorno na posição `extensao`
  furosBase: Vec3[][];
  furosTopo: Vec3[][];
  min: Vec3;
  max: Vec3;
  costuras?: number[];        // níveis Z onde a peça foi fatiada só para o desenho (ver fatiarEmZ)
}

/** Região num plano de desenho: contorno + furos, em mm do plano. */
export interface Regiao {
  contorno: Vec2[];
  furos: Vec2[][];
}

export function pontoLocal(eixo: Eixo, u: number, v: number, w: number): Vec3 {
  if (eixo === 'Z') return [u, v, w];
  if (eixo === 'X') return [w, u, v];
  return [u, w, v];
}

/** Giro exato em torno de Z: cos(π/2) em ponto flutuante não é zero, e junta de 10 mm não aceita ruído. */
function girar(p: Vec3, giro: Peca['giro']): Vec3 {
  const [x, y, z] = p;
  switch (giro) {
    case 90: return [-y, x, z];
    case 180: return [-x, -y, z];
    case 270: return [y, -x, z];
    default: return [x, y, z];
  }
}

function eixoNoMundo(eixo: Eixo, giro: Peca['giro']): Eixo {
  if (eixo === 'Z' || giro === 0 || giro === 180) return eixo;
  return eixo === 'X' ? 'Y' : 'X';
}

function caixaDe(pts: Vec3[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max };
}

export function solidoDaPeca(peca: Peca, geo: Geometria): Solido {
  const local = (q: Vec2, w: number) => girar(pontoLocal(geo.eixo, q[0], q[1], w), peca.giro);
  const crus = [...geo.perfil.contorno.map((q) => local(q, 0)), ...geo.perfil.contorno.map((q) => local(q, geo.extensao))];
  const { min: m0 } = caixaDe(crus);
  const d: Vec3 = [peca.origem[0] - m0[0], peca.origem[1] - m0[1], peca.origem[2] - m0[2]];
  const T = (q: Vec2, w: number): Vec3 => {
    const p = local(q, w);
    return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
  };
  const base = geo.perfil.contorno.map((q) => T(q, 0));
  const topo = geo.perfil.contorno.map((q) => T(q, geo.extensao));
  const furos = geo.perfil.furos ?? [];
  const { min, max } = caixaDe([...base, ...topo]);
  return {
    peca,
    geo,
    eixo: eixoNoMundo(geo.eixo, peca.giro),
    base,
    topo,
    furosBase: furos.map((f) => f.map((q) => T(q, 0))),
    furosTopo: furos.map((f) => f.map((q) => T(q, geo.extensao))),
    min,
    max,
  };
}

/** Sólidos de todas as peças do modelo (as de geometria ausente são puladas: defeito da modulação, não do desenho). */
export function solidosDoModelo(m: Modelo): Solido[] {
  const out: Solido[] = [];
  for (const p of m.pecas) {
    const g = m.geometrias[p.geometria];
    if (!g || g.perfil.contorno.length < 3) continue;
    out.push(solidoDaPeca(p, g));
  }
  return out;
}

const no = (p: Vec3, [i, j]: [number, number]): Vec2 => [p[i], p[j]];

/**
 * Pontos onde os laços (contorno e furos) cruzam a reta coordenada[a] = c; devolve, na coordenada b, os
 * intervalos de material (regra par-ímpar: o furo vira vão).
 */
function intervalos(lacos: Vec3[][], a: number, b: number, c: number): [number, number][] {
  const xs: number[] = [];
  for (const l of lacos) {
    for (let k = 0; k < l.length; k++) {
      const p = l[k];
      const q = l[(k + 1) % l.length];
      // meio-aberto: o vértice exatamente em c conta uma vez só
      if ((p[a] <= c) !== (q[a] <= c)) xs.push(p[b] + ((c - p[a]) * (q[b] - p[b])) / (q[a] - p[a]));
    }
  }
  xs.sort((u, v) => u - v);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-6) out.push([xs[k], xs[k + 1]]);
  return out;
}

/**
 * Seção do sólido pelo plano coordenada(eixoPlano) = c, nas coordenadas 2D do plano (ver PLANO).
 * Peça que só encosta no plano não é cortada (desigualdade estrita): a junta de 10 mm não vira traço fantasma.
 */
export function secao(s: Solido, eixoPlano: Eixo, c: number): Regiao[] {
  const a = IDX[eixoPlano];
  if (!(s.min[a] < c && c < s.max[a])) return [];
  const pl = PLANO[eixoPlano];
  if (s.eixo === eixoPlano) {
    return [{ contorno: s.base.map((p) => no(p, pl)), furos: s.furosBase.map((f) => f.map((p) => no(p, pl))) }];
  }
  const e = IDX[s.eixo];
  const b = 3 - a - e;
  const e0 = s.min[e];
  const e1 = s.max[e];
  const P = (vb: number, ve: number): Vec2 => {
    const q: Vec3 = [0, 0, 0];
    q[b] = vb;
    q[e] = ve;
    return no(q, pl);
  };
  return intervalos([s.base, ...s.furosBase], a, b, c).map(([b0, b1]) => ({
    contorno: [P(b0, e0), P(b1, e0), P(b1, e1), P(b0, e1)],
    furos: [],
  }));
}

/**
 * Projeção do sólido olhando ao longo de `eixoVista`: o próprio perfil quando a extrusão é na direção do olhar
 * (barbacã visto de frente = círculo); senão, o retângulo da caixa (o perfil é conexo, a sombra é um retângulo).
 */
export function projecao(s: Solido, eixoVista: Eixo): Regiao {
  const pl = PLANO[eixoVista];
  if (s.eixo === eixoVista) {
    return { contorno: s.base.map((p) => no(p, pl)), furos: s.furosBase.map((f) => f.map((p) => no(p, pl))) };
  }
  const [i, j] = pl;
  return {
    contorno: [[s.min[i], s.min[j]], [s.max[i], s.min[j]], [s.max[i], s.max[j]], [s.min[i], s.max[j]]],
    furos: [],
  };
}

/** Recorte de um polígono plano pelo semiespaço coordenada[a] ≤ c (ou ≥ c) — Sutherland–Hodgman. */
function recortarLaco(l: Vec3[], a: number, c: number, manterMenor: boolean): Vec3[] {
  const dentro = (p: Vec3) => (manterMenor ? p[a] <= c : p[a] >= c);
  const out: Vec3[] = [];
  for (let k = 0; k < l.length; k++) {
    const p = l[k];
    const q = l[(k + 1) % l.length];
    const pd = dentro(p);
    const qd = dentro(q);
    if (pd) out.push(p);
    if (pd !== qd) {
      const t = (c - p[a]) / (q[a] - p[a]);
      const r: Vec3 = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])];
      r[a] = c;     // o ponto está NO plano: sem o resíduo de ponto flutuante (600,0000000000001 não é junta)
      out.push(r);
    }
  }
  return out;
}

/**
 * Sólido recortado pelo plano X = c, ficando o lado `manterMenor` (x ≤ c) ou o outro. null = nada sobra.
 * Usado pelo isométrico com corte: a peça atravessada perde a parte da frente e mostra a face cortada.
 */
export function recortarEmX(s: Solido, c: number, manterMenor: boolean): Solido | null {
  return recortarNoEixo(s, 0, c, manterMenor);
}

/** O mesmo recorte, por um plano coordenada[a] = c qualquer (o fatiamento em Z usa o eixo 2). */
function recortarNoEixo(s: Solido, a: 0 | 1 | 2, c: number, manterMenor: boolean): Solido | null {
  if (manterMenor ? s.min[a] >= c : s.max[a] <= c) return null;
  if (manterMenor ? s.max[a] <= c : s.min[a] >= c) return s;
  let base: Vec3[], topo: Vec3[], furosBase: Vec3[][], furosTopo: Vec3[][];
  if (IDX[s.eixo] === a) {
    // extrusão ao longo do eixo do corte: só encurta o comprimento
    const lim = (p: Vec3): Vec3 => {
      const q: Vec3 = [p[0], p[1], p[2]];
      q[a] = manterMenor ? Math.min(p[a], c) : Math.max(p[a], c);
      return q;
    };
    base = s.base.map(lim);
    topo = s.topo.map(lim);
    furosBase = s.furosBase.map((f) => f.map(lim));
    furosTopo = s.furosTopo.map((f) => f.map(lim));
  } else {
    base = recortarLaco(s.base, a, c, manterMenor);
    topo = recortarLaco(s.topo, a, c, manterMenor);
    const fb = s.furosBase.map((f) => recortarLaco(f, a, c, manterMenor));
    const ft = s.furosTopo.map((f) => recortarLaco(f, a, c, manterMenor));
    furosBase = [];
    furosTopo = [];
    fb.forEach((f, k) => {
      if (f.length >= 3) {
        furosBase.push(f);
        furosTopo.push(ft[k]);
      }
    });
  }
  if (base.length < 3) return null;
  const { min, max } = caixaDe([...base, ...topo]);
  return { ...s, base, topo, furosBase, furosTopo, min, max };
}

/**
 * Fatias horizontais do sólido, nos planos Z = k·passo (as juntas das fiadas). Para o pintor do isométrico:
 * uma peça comprida e alta como o dreno (o vão inteiro, quase o muro todo de altura) fecha CICLO com os
 * blocos — o bloco da 1ª fiada tapa o dreno, o dreno tapa a haste do contraforte na 3ª, a haste tapa o
 * bloco da 2ª, que tapa o da 1ª — e não existe ordem certa para a peça inteira. Fatiada na altura das
 * fiadas, cada fatia só conversa com os blocos da própria fiada e o ciclo some.
 * `costuras` guarda os níveis dos cortes: o desenho não traça essas arestas (são internas à peça).
 */
export function fatiarEmZ(s: Solido, passo: number): Solido[] {
  const niveis: number[] = [];
  for (let z = (Math.floor(s.min[2] / passo) + 1) * passo; z < s.max[2] - 0.5; z += passo) {
    if (z > s.min[2] + 0.5) niveis.push(z);
  }
  if (!niveis.length) return [s];
  const limites = [s.min[2], ...niveis, s.max[2]];
  const out: Solido[] = [];
  for (let k = 0; k + 1 < limites.length; k++) {
    const abaixo = recortarNoEixo(s, 2, limites[k + 1], true);
    const fatia = abaixo && recortarNoEixo(abaixo, 2, limites[k], false);
    if (fatia) out.push({ ...fatia, costuras: niveis });
  }
  return out;
}

/** A aresta é costura de fatiamento (interna à peça original)? */
export function ehCostura(s: Solido, p: Vec3, q: Vec3): boolean {
  if (!s.costuras || Math.abs(p[2] - q[2]) > 0.01) return false;
  return s.costuras.some((z) => Math.abs(p[2] - z) < 0.01);
}

// ── faces (isométrico) ────────────────────────────────────────────────────────────────────────────────────────────

export interface Face {
  pts: Vec3[];
  normal: Vec3;
  furos: Vec3[][];       // só nas tampas
  tampa: boolean;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const escalar = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Normal de Newell: robusta para polígono não convexo (a sapata com dente). */
function newell(l: Vec3[]): Vec3 {
  const nrm: Vec3 = [0, 0, 0];
  for (let k = 0; k < l.length; k++) {
    const p = l[k];
    const q = l[(k + 1) % l.length];
    nrm[0] += (p[1] - q[1]) * (p[2] + q[2]);
    nrm[1] += (p[2] - q[2]) * (p[0] + q[0]);
    nrm[2] += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return nrm;
}

/** Faces externas do prisma, com a normal para fora (o sentido do contorno pode ter virado com o giro). */
export function facesDoSolido(s: Solido): Face[] {
  const d = sub(s.topo[0], s.base[0]);
  const du = unit(d);
  const sinal = escalar(newell(s.base), d) >= 0 ? 1 : -1;
  const out: Face[] = [
    { pts: s.topo, normal: du, furos: s.furosTopo, tampa: true },
    { pts: s.base, normal: [-du[0], -du[1], -du[2]], furos: s.furosBase, tampa: true },
  ];
  for (let k = 0; k < s.base.length; k++) {
    const k2 = (k + 1) % s.base.length;
    const aresta = sub(s.base[k2], s.base[k]);
    if (Math.hypot(aresta[0], aresta[1], aresta[2]) < 1e-6) continue;
    const nr = cruz(aresta, d);
    out.push({
      pts: [s.base[k], s.base[k2], s.topo[k2], s.topo[k]],
      normal: unit([nr[0] * sinal, nr[1] * sinal, nr[2] * sinal]),
      furos: [],
      tampa: false,
    });
  }
  return out;
}

// ── barras ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A barra está toda num plano X = const? (vertical do muro, espera com gancho para o solo, barra da sapata em Y) */
export function barraNoPlanoX(eixo: Vec3[], tol = 0.5): boolean {
  let a = Infinity, b = -Infinity;
  for (const p of eixo) {
    a = Math.min(a, p[0]);
    b = Math.max(b, p[0]);
  }
  return b - a <= tol;
}

/** Pontos onde a polilinha atravessa o plano coordenada(eixo) = c, nas coordenadas 2D do plano. */
export function cruzamentos(eixo: Vec3[], plano: Eixo, c: number): Vec2[] {
  const a = IDX[plano];
  const pl = PLANO[plano];
  const out: Vec2[] = [];
  for (let k = 0; k + 1 < eixo.length; k++) {
    const p = eixo[k];
    const q = eixo[k + 1];
    if ((p[a] < c) !== (q[a] < c) && p[a] !== q[a]) {
      const t = (c - p[a]) / (q[a] - p[a]);
      const r: Vec3 = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])];
      out.push(no(r, pl));
    }
  }
  return out;
}

export function projetarPontos(eixo: Vec3[], vista: Eixo): Vec2[] {
  return eixo.map((p) => no(p, PLANO[vista]));
}

export function faixa(eixo: Vec3[], k: 0 | 1 | 2): [number, number] {
  let a = Infinity, b = -Infinity;
  for (const p of eixo) {
    a = Math.min(a, p[k]);
    b = Math.max(b, p[k]);
  }
  return [a, b];
}

// ── classificação das peças ───────────────────────────────────────────────────────────────────────────────────────

export const ALVENARIA = new Set<Peca['tipo']>([
  'BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA',
]);
export const CANALETA = new Set<Peca['tipo']>(['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);
/** Peças fora do catálogo comum (inteiro, meio, canaleta, meia): o desenho as destaca. */
export const ESPECIAL = new Set<Peca['tipo']>(['BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA_CORTADA']);
export const GRAUTE = new Set<Peca['tipo']>(['GRAUTE_FURO', 'GRAUTE_CANALETA']);

/** Espessura do muro (mm) e o lado em que fica cada contraforte. */
export function contrafortesDoModelo(m: Modelo, solidos: Solido[]): {
  numero: number;
  x: number;
  ponta: boolean;
  trecho: number;
  min: Vec3;
  max: Vec3;
  aparente: boolean;
}[] {
  const t = m.familia.t;
  return m.dims.contrafortes.map((c, k) => {
    const num = k + 1;
    const doCf = solidos.filter((s) => s.peca.grupo === 'contraforte' && s.peca.contraforte === num);
    const { min, max } = doCf.length
      ? caixaDe(doCf.flatMap((s) => [s.min, s.max]))
      : { min: [c.x - t / 2, 0, 0] as Vec3, max: [c.x + t / 2, t, m.dims.H_muro] as Vec3 };
    return { numero: num, x: c.x, ponta: c.ponta, trecho: c.trecho, min, max, aparente: min[1] < -1 };
  });
}
