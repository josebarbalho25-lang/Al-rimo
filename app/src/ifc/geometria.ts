/*
  GEOMETRIA DO IFC — como o perfil de uma Geometria vira sólido, onde a peça vai parar, e como o eixo de uma barra
  vira curva com arco verdadeiro. Conta pura (mm), sem STEP: o escritor (exportarIfc.ts) só traduz.

  Duas leituras do contrato (modelo/tipos.ts) que ele não escreve com todas as letras. São as MESMAS da
  modulação (modulacao/perfis.ts, quem FABRICA o Modelo), do visor (visor/perfil3d.ts), dos desenhos
  (desenhos/geometria.ts) e do quantitativo (quantitativo/geometria.ts) — o teste confere contra a modulação:

  1) PLANO DO PERFIL por eixo de extrusão:
        eixo 'Z' → perfil (u, v) = (x, y)   bloco e graute de furo: planta do bloco
        eixo 'X' → perfil (u, v) = (y, z)   canaleta, graute de canaleta, sapata, dreno, manta
        eixo 'Y' → perfil (u, v) = (x, z)
     A extrusão vai de 0 a +extensao no eixo. No caso 'Y' o par (x, z) é canhoto em relação a +Y; para não
     espelhar a peça no IFC, o sólido nasce em y = extensao e é extrudado para −Y (ver posicaoDoSolido).

  2) GIRO E ORIGEM: o giro (em Z, anti-horário visto de cima: 90° leva +x local para +Y) é aplicado à peça local,
     e a CAIXA girada é transladada até o canto mínimo dela cair em `origem`:
        global = origem + R(giro)·local − min(R(giro)·caixa local)
     Assim `origem` é sempre o canto mínimo da caixa no mundo, para qualquer giro.
*/
import type { Geometria, Peca, Vec2, Vec3 } from '@/modelo/tipos';

export type Eixo = Geometria['eixo'];

// ── perfil ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function areaAssinada(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/** Tira ponto repetido (inclusive o último igual ao primeiro): um lado de comprimento zero quebra o perfil. */
export function limparPoligono(pts: Vec2[], tol = 1e-3): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > tol) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= tol) out.pop();
  return out;
}

/**
 * Contorno anti-horário e furos horários, como o contrato pede. Reorienta em vez de confiar: um furo no sentido
 * errado alguns leitores tratam como sólido, e o erro só apareceria no Revit.
 */
export function perfilOrientado(perfil: Geometria['perfil']): { contorno: Vec2[]; furos: Vec2[][] } | null {
  const c = limparPoligono(perfil.contorno);
  if (c.length < 3 || Math.abs(areaAssinada(c)) < 1) return null;
  const contorno = areaAssinada(c) > 0 ? c : [...c].reverse();
  const furos: Vec2[][] = [];
  for (const f0 of perfil.furos ?? []) {
    const f = limparPoligono(f0);
    if (f.length < 3 || Math.abs(areaAssinada(f)) < 1) continue;
    furos.push(areaAssinada(f) < 0 ? f : [...f].reverse());
  }
  return { contorno, furos };
}

export function areaDoPerfil(perfil: Geometria['perfil']): number {
  const p = perfilOrientado(perfil);
  if (!p) return 0;
  return areaAssinada(p.contorno) + p.furos.reduce((s, f) => s + areaAssinada(f), 0);
}

/** Ponto do plano do perfil + posição ao longo do eixo → ponto local da peça (antes do giro). */
export function pontoLocal(eixo: Eixo, u: number, v: number, w: number): Vec3 {
  if (eixo === 'Z') return [u, v, w];
  if (eixo === 'X') return [w, u, v];
  return [u, w, v];
}

/**
 * Posição do IfcExtrudedAreaSolid dentro da peça (mm). O sólido é extrudado sempre no +z do próprio sistema
 * (ExtrudedDirection = (0,0,1)), então basta escolher os eixos: x do perfil = `ref`, z da extrusão = `axis`.
 */
export function posicaoDoSolido(eixo: Eixo, extensao: number, de = 0): { local: Vec3; axis: Vec3 | null; ref: Vec3 | null } {
  // `de` (acrescentado pela modulação, 09/10 noite): o sólido de um PEDAÇO da peça (Geometria.pedacos) começa em `de`
  // ao longo do eixo e vai até `extensao`; a peça inteira é de = 0.
  if (eixo === 'Z') return { local: [0, 0, de], axis: null, ref: null };
  // x do perfil → Y, extrusão → X; o y do perfil sai X × Y = Z. Destro, sem espelho.
  if (eixo === 'X') return { local: [de, 0, 0], axis: [1, 0, 0], ref: [0, 1, 0] };
  // x do perfil → X, extrusão → −Y; o y do perfil sai (−Y) × X = Z. Nasce em y = extensao e desce até `de`.
  return { local: [0, extensao, 0], axis: [0, -1, 0], ref: [1, 0, 0] };
}

// ── colocação da peça ─────────────────────────────────────────────────────────────────────────────────────────────
// Cosseno e seno EXATOS: Math.cos(π/2) dá 6·10⁻¹⁷, e junta de 10 mm não precisa de ruído.
const COS: Record<Peca['giro'], number> = { 0: 1, 90: 0, 180: -1, 270: 0 };
const SIN: Record<Peca['giro'], number> = { 0: 0, 90: 1, 180: 0, 270: -1 };

/** Direção do x local da peça depois do giro (RefDirection do placement). */
export function direcaoDoGiro(giro: Peca['giro']): Vec3 {
  return [COS[giro] ?? 1, SIN[giro] ?? 0, 0];
}

function girar(giro: Peca['giro'], p: Vec3): Vec3 {
  const c = COS[giro] ?? 1, s = SIN[giro] ?? 0;
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

/**
 * Onde o ponto local (0,0,0) da geometria vai parar no mundo: origem − min(R·caixa local). É a Location do
 * IfcLocalPlacement da peça (com o giro na RefDirection).
 */
export function pontoDeInsercao(peca: Pick<Peca, 'origem' | 'giro'>, geo: Geometria): Vec3 {
  const m: Vec3 = [Infinity, Infinity, Infinity];
  for (const [u, v] of geo.perfil.contorno) {
    for (const w of [0, geo.extensao]) {
      const g = girar(peca.giro, pontoLocal(geo.eixo, u, v, w));
      for (let k = 0; k < 3; k++) m[k] = Math.min(m[k], g[k]);
    }
  }
  return [peca.origem[0] - m[0], peca.origem[1] - m[1], peca.origem[2] - m[2]];
}

export function paraGlobal(peca: Pick<Peca, 'origem' | 'giro'>, geo: Geometria, p: Vec3): Vec3 {
  const o = pontoDeInsercao(peca, geo);
  const r = girar(peca.giro, p);
  return [r[0] + o[0], r[1] + o[1], r[2] + o[2]];
}

export interface Caixa { min: Vec3; max: Vec3 }

/** Caixa global da peça (mm), pelos vértices do contorno nas duas pontas da extrusão. `min` = `origem`. */
export function caixaDaPeca(peca: Pick<Peca, 'origem' | 'giro'>, geo: Geometria): Caixa {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const [u, v] of geo.perfil.contorno) {
    for (const w of [0, geo.extensao]) {
      const g = paraGlobal(peca, geo, pontoLocal(geo.eixo, u, v, w));
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g[k]); max[k] = Math.max(max[k], g[k]); }
    }
  }
  return { min, max };
}

// ── barra: polilinha → linhas + arcos verdadeiros ─────────────────────────────────────────────────────────────────
/*
  O contrato entrega a barra como polilinha com as dobras já discretizadas. O IFC do Revit grava a dobra como ARCO
  verdadeiro (IfcArcIndex, 3 pontos) — medido no IFC do José —, e é isso que faz o Revit reconhecer a dobra e a
  tabela de dobramento sair certa. Então aqui a polilinha é lida de volta: uma corrida de ≥ 2 lados IGUAIS, com a
  MESMA deflexão em cada vértice, no MESMO plano e no mesmo sentido, é uma dobra amostrada sobre o arco; o arco
  passa pelo 1º vértice, por um do meio e pelo último — é o mesmo círculo, porque todos os vértices estão nele.

  Proteções (DEDUÇÃO, valores meus):
    · deflexão por lado ≤ 50°: canto vivo de estribo (90°) nunca vira arco;
    · raio no eixo ≤ 15·Ø: o pino de dobra da NBR 6118 (Tab. 9.1) dá no máximo 4,5·Ø no eixo; acima disso não
      é dobra, é outra coisa, e fica como polilinha;
    · arco de no máximo 179°: 3 pontos não definem um arco de 180° ou mais sem ambiguidade; corrida maior é
      partida em pedaços.
  Se nada disso casar, a barra sai como polilinha — continua exata em relação ao que a modulação mandou.
*/
export type Segmento = { tipo: 'linha'; idx: number[] } | { tipo: 'arco'; idx: [number, number, number] };

export interface EixoDaBarra {
  pontos: Vec3[];            // mm, só os que a curva usa
  segmentos: Segmento[];     // índices em `pontos`, base 1 (como o IfcLineIndex/IfcArcIndex)
  comprimento: number;       // da curva com os arcos verdadeiros, mm
  arcos: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const n = norma(a); return [a[0] / n, a[1] / n, a[2] / n]; };

const DEFLEXAO_MAX = (50 * Math.PI) / 180;
const ARCO_MAX = (179 * Math.PI) / 180;
const TOL_ANG = (0.5 * Math.PI) / 180;

export function eixoDaBarra(eixo: Vec3[], diametro: number, fechada = false): EixoDaBarra | null {
  // 1) limpa pontos repetidos (lado de comprimento zero quebra o IfcSweptDiskSolid)
  const P: Vec3[] = [];
  for (const p of eixo) {
    const q = P[P.length - 1];
    if (!q || norma(sub(p, q)) > 0.01) P.push(p);
  }
  let fecha = false;
  if (fechada && P.length > 2) {
    if (norma(sub(P[0], P[P.length - 1])) <= 0.01) P.pop();
    fecha = true;   // "fechada" = o último ponto volta ao primeiro (a mesma leitura do visor e dos desenhos)
    // Se o fechamento cai num CANTO VIVO (estribo desenhado como retângulo), o ifcopenshell não monta o
    // IfcSweptDiskSolid — medido: o mesmo retângulo aberto monta, fechado no canto falha. Então o laço passa a
    // começar no meio do lado mais comprido: o fechamento vira emenda reta, e a forma não muda nada.
    if (P.length > 2) {
      const n = P.length;
      const dEnt = unit(sub(P[0], P[n - 1])), dSai = unit(sub(P[1], P[0]));
      if (dot(dEnt, dSai) < 1 - 1e-6) {
        let k = 0;
        for (let i = 1; i < n; i++) if (norma(sub(P[(i + 1) % n], P[i])) > norma(sub(P[(k + 1) % n], P[k]))) k = i;
        const a = P[k], b = P[(k + 1) % n];
        const meio: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
        const giro = [...P.slice(k + 1), ...P.slice(0, k + 1)];
        P.length = 0;
        P.push(meio, ...giro);
      }
    }
  }
  if (P.length < 2) return null;

  const nSeg = P.length - 1;
  const L = Array.from({ length: nSeg }, (_, i) => norma(sub(P[i + 1], P[i])));
  const D = Array.from({ length: nSeg }, (_, i) => unit(sub(P[i + 1], P[i])));
  // deflexão e normal no vértice i (entre o lado i−1 e o lado i), i = 1..nSeg−1
  const defl = (i: number) => Math.acos(Math.max(-1, Math.min(1, dot(D[i - 1], D[i]))));
  const normal = (i: number): Vec3 | null => {
    const c = cross(D[i - 1], D[i]);
    return norma(c) < 1e-9 ? null : unit(c);
  };
  const igual = (a: number, b: number) => Math.abs(a - b) <= 0.02 * Math.max(a, b) + 0.01;

  // 2) corridas de arco: [lado inicial, nº de lados]
  const corridas: [number, number][] = [];
  let i = 0;
  while (i < nSeg - 1) {
    const th = defl(i + 1);
    const n0 = normal(i + 1);
    if (!n0 || th < TOL_ANG || th > DEFLEXAO_MAX || !igual(L[i], L[i + 1])) { i++; continue; }
    let k = 2;   // lados i e i+1
    while (i + k < nSeg) {
      const j = i + k;   // próximo lado; vértice j entre j−1 e j
      const n = normal(j);
      if (!n || !igual(L[j], L[i]) || Math.abs(defl(j) - th) > TOL_ANG || dot(n, n0) < 0.9999) break;
      k++;
    }
    const raio = L[i] / (2 * Math.sin(th / 2));
    if (raio <= 15 * diametro) corridas.push([i, k]);
    i += k;
  }

  // 3) monta pontos e segmentos
  const pontos: Vec3[] = [];
  const indice = new Map<number, number>();   // vértice de P → índice base 1 em `pontos`
  const usa = (v: number) => {
    let r = indice.get(v);
    if (r === undefined) { pontos.push(P[v]); r = pontos.length; indice.set(v, r); }
    return r;
  };
  const segmentos: Segmento[] = [];
  const linha = (a: number, b: number) => {
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.tipo === 'linha' && ultimo.idx[ultimo.idx.length - 1] === usa(a)) ultimo.idx.push(usa(b));
    else segmentos.push({ tipo: 'linha', idx: [usa(a), usa(b)] });
  };
  let comprimento = 0;
  let arcos = 0;
  let v = 0;
  for (const [s0, k] of corridas) {
    for (; v < s0; v++) { linha(v, v + 1); comprimento += L[v]; }
    const th = defl(s0 + 1);
    const raio = L[s0] / (2 * Math.sin(th / 2));
    const pedacos = Math.ceil((k * th) / ARCO_MAX - 1e-9);
    // divide os k lados em `pedacos` arcos de ≥ 2 lados cada
    let ini = s0;
    for (let p = 0; p < pedacos; p++) {
      const lados = Math.round((k * (p + 1)) / pedacos) - Math.round((k * p) / pedacos);
      const fim = ini + lados;
      const meio = ini + Math.floor(lados / 2);   // lados ≥ 2 → vértice de dentro, sobre o mesmo círculo
      segmentos.push({ tipo: 'arco', idx: [usa(ini), usa(meio), usa(fim)] });
      comprimento += raio * lados * th;
      arcos++;
      ini = fim;
    }
    v = s0 + k;
  }
  for (; v < nSeg; v++) { linha(v, v + 1); comprimento += L[v]; }
  if (fecha) {
    // volta ao 1º ponto: reaproveita o índice 1 em vez de repetir o ponto
    const ultimo = segmentos[segmentos.length - 1];
    const a = usa(nSeg), b = usa(0);
    if (ultimo && ultimo.tipo === 'linha' && ultimo.idx[ultimo.idx.length - 1] === a) ultimo.idx.push(b);
    else segmentos.push({ tipo: 'linha', idx: [a, b] });
    comprimento += norma(sub(P[0], P[nSeg]));
  }
  return { pontos, segmentos, comprimento, arcos };
}

/** Massa linear nominal do vergalhão (kg/m), NBR 7480 Tab. B.1. Bitola fora da tabela: 7850 kg/m³ × área. */
export function massaLinear(diametro: number): number {
  const tab: Record<string, number> = {
    '5': 0.154, '6.3': 0.245, '8': 0.395, '10': 0.617, '12.5': 0.963, '16': 1.578, '20': 2.466, '25': 3.853, '32': 6.313,
  };
  return tab[String(diametro)] ?? 7850 * (Math.PI * (diametro / 1000) ** 2) / 4;
}
