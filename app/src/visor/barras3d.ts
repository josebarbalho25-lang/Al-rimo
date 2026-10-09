// ═══════════════════════════════════════════════════════════════════════════
//  visor/barras3d.ts — as barras de aço como tubos, uma malha por diâmetro
// ---------------------------------------------------------------------------
//  A barra chega como polilinha do eixo (mm) com as dobras já discretizadas
//  pela modulação. Cada uma vira um tubo; todas as de mesmo Ø (e mesmo grupo
//  de ocultar) são JUNTADAS numa malha só — uma chamada de desenho por
//  diâmetro, e a faixa de triângulos de cada barra guardada para o clique
//  saber qual foi pega.
//
//  ⚠️ JUNTA EM ESQUADRO (meia-esquadria), não cilindro por trecho. Com um
//  cilindro por trecho, cada dobra de estribo abriria uma fenda no lado de
//  fora. O anel da junta mora no plano que divide o ângulo ao meio, e o
//  mesmo anel serve aos dois trechos.
//
//  ⚠️ O REFERENCIAL É TRANSPORTADO (não recalculado por trecho): um "cima"
//  escolhido de novo a cada trecho torceria o tubo nas dobras.
//
//  Puro (só a matemática do three): testado no Node.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Barra, Vec3 } from '@/modelo/tipos';
import { categoriasDaBarra, type Categoria } from './lotes';
import { MM } from './perfil3d';

/** Lados do tubo. O A-PORT usa 6; 8 fica redondo na foto em 2× sem pesar. */
export const LADOS_DO_TUBO = 8;

export interface FaixaDeBarra {
  id: string;
  /** Triângulos [ini, fim) na malha juntada — o `faceIndex` do raio cai aqui. */
  triIni: number;
  triFim: number;
  /** Vértices [ini, fim) — é o trecho da cor que o realce repinta. */
  vIni: number;
  vFim: number;
}

export interface LoteDeBarras {
  chave: string;
  diametro: number;
  categorias: Categoria[];
  geometria: THREE.BufferGeometry;
  faixas: FaixaDeBarra[];
}

interface Tubo {
  pos: number[];
  nor: number[];
  idx: number[];
}

/** Tira pontos repetidos (trecho de comprimento zero não tem direção). */
function limpar(pts: readonly THREE.Vector3[], fechada: boolean): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const p of pts) if (!out.length || out[out.length - 1]!.distanceTo(p) > 1e-9) out.push(p);
  if (fechada && out.length > 2 && out[0]!.distanceTo(out[out.length - 1]!) < 1e-9) out.pop();
  return out;
}

/** Um vetor qualquer perpendicular a `t`. */
function perpendicular(t: THREE.Vector3): THREE.Vector3 {
  const a = Math.abs(t.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  return a.sub(t.clone().multiplyScalar(a.dot(t))).normalize();
}

/**
 * O tubo de uma polilinha (metro). Devolve vértices, normais e índices a
 * partir do vértice `base` (para juntar várias barras num buffer só).
 */
export function tuboDaPolilinha(pontos: readonly THREE.Vector3[], raio: number, fechada: boolean, lados = LADOS_DO_TUBO, base = 0): Tubo {
  const pts = limpar(pontos, fechada);
  const n = pts.length;
  const tubo: Tubo = { pos: [], nor: [], idx: [] };
  if (n < 2) return tubo;
  const fecha = fechada && n > 2;
  const nTrechos = fecha ? n : n - 1;

  // Direção de cada trecho e o referencial (N, B) transportado ao longo dele.
  const T: THREE.Vector3[] = [];
  for (let k = 0; k < nTrechos; k++) T.push(pts[(k + 1) % n]!.clone().sub(pts[k]!).normalize());
  const N: THREE.Vector3[] = [perpendicular(T[0]!)];
  for (let k = 1; k < nTrechos; k++) {
    const giro = new THREE.Quaternion().setFromUnitVectors(T[k - 1]!, T[k]!);
    N.push(N[k - 1]!.clone().applyQuaternion(giro).normalize());
  }

  // Um anel por ponto. No ponto k, o anel é o círculo do trecho que CHEGA
  // (ou do que sai, na ponta inicial) levado ao plano da meia-esquadria.
  const anel = (k: number) => {
    const p = pts[k]!;
    const chega = fecha ? (k - 1 + nTrechos) % nTrechos : k - 1;
    const sai = fecha ? k % nTrechos : k;
    const temChega = chega >= 0 && chega < nTrechos;
    const temSai = sai >= 0 && sai < nTrechos;
    const ref = temChega ? chega : sai;
    const t = T[ref]!;
    const nn = N[ref]!;
    const bb = new THREE.Vector3().crossVectors(t, nn);
    // A normal do plano da junta: a bissetriz das duas direções.
    let m = t.clone();
    if (temChega && temSai) {
      const soma = T[chega]!.clone().add(T[sai]!);
      if (soma.lengthSq() > 1e-8) m = soma.normalize();
    }
    const cosM = Math.max(t.dot(m), 0.2); // dobra fechada demais: o esquadro não estica além de 5×
    for (let j = 0; j < lados; j++) {
      const a = (j / lados) * Math.PI * 2;
      const r = nn.clone().multiplyScalar(Math.cos(a)).addScaledVector(bb, Math.sin(a));
      // Leva o ponto do círculo até o plano da junta, ao longo do trecho.
      const q = p.clone().addScaledVector(r, raio);
      q.addScaledVector(t, -r.dot(m) * raio / cosM);
      tubo.pos.push(q.x, q.y, q.z);
      // Normal = do eixo para o ponto, já no plano da junta: meio-termo entre
      // os dois trechos, e a dobra sai lisa em vez de facetada.
      const nq = q.clone().sub(p).normalize();
      tubo.nor.push(nq.x, nq.y, nq.z);
    }
  };
  for (let k = 0; k < n; k++) anel(k);

  for (let k = 0; k < nTrechos; k++) {
    const a = base + k * lados;
    const b = base + ((k + 1) % n) * lados;
    for (let j = 0; j < lados; j++) {
      const j1 = (j + 1) % lados;
      tubo.idx.push(a + j, a + j1, b + j1, a + j, b + j1, b + j);
    }
  }

  // Tampas chapadas nas pontas da barra aberta: sem elas a ponta lê como cano.
  if (!fecha) {
    const tampa = (k: number, sentido: THREE.Vector3) => {
      const ini = base + tubo.pos.length / 3;
      const c = pts[k]!;
      tubo.pos.push(c.x, c.y, c.z);
      tubo.nor.push(sentido.x, sentido.y, sentido.z);
      for (let j = 0; j < lados; j++) {
        const o = (k * lados + j) * 3;
        tubo.pos.push(tubo.pos[o]!, tubo.pos[o + 1]!, tubo.pos[o + 2]!);
        tubo.nor.push(sentido.x, sentido.y, sentido.z);
      }
      for (let j = 0; j < lados; j++) {
        const j1 = (j + 1) % lados;
        // A ordem acompanha o sentido da normal (a face aponta para fora da ponta).
        if (sentido.dot(T[k === 0 ? 0 : nTrechos - 1]!) < 0) tubo.idx.push(ini, ini + 1 + j1, ini + 1 + j);
        else tubo.idx.push(ini, ini + 1 + j, ini + 1 + j1);
      }
    };
    tampa(0, T[0]!.clone().negate());
    tampa(n - 1, T[nTrechos - 1]!.clone());
  }
  return tubo;
}

const v3 = (p: Vec3) => new THREE.Vector3(p[0] * MM, p[1] * MM, p[2] * MM);

/** Junta as barras por Ø e por grupo de ocultar. */
export function montarBarras(barras: readonly Barra[], lados = LADOS_DO_TUBO): LoteDeBarras[] {
  const grupos = new Map<string, { diametro: number; categorias: Categoria[]; barras: Barra[] }>();
  for (const b of barras) {
    if (!(b.diametro > 0) || b.eixo.length < 2) continue;
    const categorias = categoriasDaBarra(b);
    const chave = `Ø${b.diametro}|${categorias.join('+')}`;
    let g = grupos.get(chave);
    if (!g) grupos.set(chave, (g = { diametro: b.diametro, categorias, barras: [] }));
    g.barras.push(b);
  }

  const lotes: LoteDeBarras[] = [];
  for (const [chave, g] of grupos) {
    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    const faixas: FaixaDeBarra[] = [];
    for (const b of g.barras) {
      const vIni = pos.length / 3;
      const triIni = idx.length / 3;
      const t = tuboDaPolilinha(b.eixo.map(v3), (b.diametro / 2) * MM, !!b.fechada, lados, vIni);
      if (!t.idx.length) continue;
      for (const x of t.pos) pos.push(x);
      for (const x of t.nor) nor.push(x);
      for (const x of t.idx) idx.push(x);
      faixas.push({ id: b.id, triIni, triFim: idx.length / 3, vIni, vFim: pos.length / 3 });
    }
    if (!faixas.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    lotes.push({ chave, diametro: g.diametro, categorias: g.categorias, geometria: geo, faixas });
  }
  lotes.sort((a, b) => a.diametro - b.diametro || (a.chave < b.chave ? -1 : 1));
  return lotes;
}

/** Qual barra contém o triângulo `faceIndex` (busca binária nas faixas, que estão em ordem). */
export function barraDoTriangulo(faixas: readonly FaixaDeBarra[], faceIndex: number): FaixaDeBarra | null {
  let lo = 0;
  let hi = faixas.length - 1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    const f = faixas[meio]!;
    if (faceIndex < f.triIni) hi = meio - 1;
    else if (faceIndex >= f.triFim) lo = meio + 1;
    else return f;
  }
  return null;
}
