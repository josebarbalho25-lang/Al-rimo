/*
  O AÇO COLOCADO AO LONGO DE UMA BARRA ANALÍTICA — a envoltória verde do diagrama (2ª versão da vista Esforços, 15/11:
  o Jose quer o do Pró-Viga, "o solicitante de uma cor e o resistente englobando ele").

  ⚠️ GEOMETRIA, NÃO CONTA. Daqui só sai a soma das áreas das barras DESENHADAS pelo modelo (modelo.barras) que passam
  em cada seção, cada uma com o quanto ela já "pegou" de força naquela seção. Os comprimentos que dizem isso
  (ancoragem e traspasse) são células da planilha (lbn_*, lbg_*, l0t_*, aba Fundação seções 10 e 13); a área de
  uma barra é π·φ²/4. Conta de concreto ou alvenaria não entra aqui.

  As regras, as mesmas do Pró-Viga (dimensionamento.jsx, AsChart) e do TQS:
    · só conta o pedaço da barra PARALELO ao eixo da peça (um "trecho reto"), dentro do recorte (a faixa de 1 m, a
      seção do contraforte, a face tracionada);
    · a barra sobe de 0 à área cheia ao longo do comprimento de ancoragem a partir de cada ponta solta: ponta reta →
      ℓb,nec reto; ponta dobrada (gancho, dobra do estribo, o pé da espera) → ℓb,nec com α = 0,7 (NBR 6118 9.4.2.5);
    · ponta que passa do começo ou do fim da peça (a espera que desce na sapata, a barra que entra no apoio) já
      chega cheia: a ancoragem lá é a do apoio, que a planilha confere à parte (lb_adot, ℓ0t…);
    · traspasse (duas barras lado a lado, uma acabando onde a outra começa): cada uma sobe/desce ao longo do ℓ0t da
      planilha, e as duas juntas não passam da maior — a emenda não soma aço.
  Por metro (faixa do muro, sapata, dente): a soma no recorte dividida pela largura dele. A largura é um número
  inteiro de espaçamentos da conta, para o recorte pegar o mesmo número de barras em qualquer lugar.
*/
import type { Barra, PapelBarra, Vec3 } from '@/modelo/tipos';

export interface PontoDoDiagrama {
  s: number;
  v: number;
}

/** O contorno tracejado de uma posição (N): do começo ao fim dela no recorte, na altura da área dela. */
export interface FamiliaNoDiagrama {
  posicao: string;
  s0: number;
  s1: number;
  v: number;
}

export interface Ancoragens {
  /** ℓb,nec da ponta reta, mm. */
  reta: number;
  /** ℓb,nec da ponta dobrada (α = 0,7), mm. */
  dobrada: number;
  /** ℓ0t do traspasse, mm (null = a barra não emenda; vale a ancoragem da ponta). */
  traspasse: number | null;
}

export interface Recorte {
  /** O começo do eixo da peça e a direção dele (unitária), mm. */
  de: Vec3;
  u: Vec3;
  L: number;
  papeis: readonly PapelBarra[];
  /** Fica o trecho reto cujo MEIO está aqui (a faixa, a seção, a face); a barra vem junto (o papel decide às vezes). */
  dentro: (p: Vec3, b: Barra) => boolean;
  /** mm: soma × 1000/largura (cm²/m). null = a seção inteira (cm²). */
  largura: number | null;
  ancoragem: (b: Barra) => Ancoragens;
}

/** Um trecho reto de barra, projetado no eixo. */
export interface Trecho {
  barra: Barra;
  s0: number;
  s1: number;
  area: number;
  /** a ponta de s0/s1: 'solta' (fim da polilinha), 'dobrada' (a barra vira ali) */
  ponta0: 'reta' | 'dobrada';
  ponta1: 'reta' | 'dobrada';
  /** o ponto do meio, fora do eixo (para achar o par do traspasse) */
  lateral: Vec3;
}

const PARALELO = 0.995;
const TOL = 1; // mm

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norma = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Área de uma barra, cm² (φ em mm). */
export const areaDaBarra = (phi: number) => (Math.PI * phi * phi) / 400;

/** Os trechos retos de cada barra paralelos ao eixo e dentro do recorte. */
export function trechosNoRecorte(barras: readonly Barra[], r: Recorte): Trecho[] {
  const out: Trecho[] = [];
  const papeis = new Set(r.papeis);
  for (const b of barras) {
    if (!papeis.has(b.papel) || b.eixo.length < 2) continue;
    const n = b.eixo.length;
    let i = 0;
    while (i < n - 1) {
      const d0 = sub(b.eixo[i + 1]!, b.eixo[i]!);
      const l0 = norma(d0);
      const c0 = l0 > 0 ? dot(d0, r.u) / l0 : 0;
      if (Math.abs(c0) < PARALELO) {
        i++;
        continue;
      }
      // junta os segmentos seguidos com o mesmo sentido
      let j = i + 1;
      while (j < n - 1) {
        const d = sub(b.eixo[j + 1]!, b.eixo[j]!);
        const l = norma(d);
        if (!(l > 0) || dot(d, r.u) / l * Math.sign(c0) < PARALELO) break;
        j++;
      }
      const pa = b.eixo[i]!;
      const pb = b.eixo[j]!;
      const sa = dot(sub(pa, r.de), r.u);
      const sb = dot(sub(pb, r.de), r.u);
      const meio: Vec3 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
      if (Math.abs(sb - sa) > TOL && r.dentro(meio, b)) {
        // a ponta é "dobrada" quando a polilinha continua depois dela (o pé da espera, a volta do estribo)
        const kA: Trecho['ponta0'] = i === 0 && !b.fechada ? 'reta' : 'dobrada';
        const kB: Trecho['ponta1'] = j === n - 1 && !b.fechada ? 'reta' : 'dobrada';
        const sm = (sa + sb) / 2;
        const noEixo: Vec3 = [r.de[0] + r.u[0] * sm, r.de[1] + r.u[1] * sm, r.de[2] + r.u[2] * sm];
        out.push({
          barra: b, area: areaDaBarra(b.diametro), lateral: sub(meio, noEixo),
          ...(sa <= sb ? { s0: sa, s1: sb, ponta0: kA, ponta1: kB } : { s0: sb, s1: sa, ponta0: kB, ponta1: kA }),
        });
      }
      i = j;
    }
  }
  return out;
}

interface Pronto extends Trecho {
  /** comprimento da rampa em cada ponta (0 = chega cheia: a ponta passa da peça) */
  l0: number;
  l1: number;
}

/** Os pares de traspasse: lado a lado (a até 100 mm), um acabando dentro do outro. Um a um, os mais próximos antes. */
function pares(ts: Trecho[]): [number, number][] {
  const cand: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < ts.length; i++) {
    for (let j = 0; j < ts.length; j++) {
      if (i === j) continue;
      const a = ts[i]!;
      const b = ts[j]!;
      // a acaba dentro de b, b começa dentro de a (escalonadas)
      if (!(a.s0 < b.s0 - TOL && a.s1 < b.s1 - TOL && b.s0 < a.s1 - TOL)) continue;
      const d = norma(sub(a.lateral, b.lateral));
      if (d > 100) continue;
      cand.push({ i, j, d });
    }
  }
  cand.sort((x, y) => x.d - y.d);
  const fim = new Set<number>();
  const comeco = new Set<number>();
  const out: [number, number][] = [];
  for (const c of cand) {
    if (fim.has(c.i) || comeco.has(c.j)) continue;
    fim.add(c.i);
    comeco.add(c.j);
    out.push([c.i, c.j]);
  }
  return out;
}

const forca = (t: Pronto, s: number): number => {
  if (s < t.s0 - 1e-9 || s > t.s1 + 1e-9) return 0;
  const a = t.l0 > 0 ? (s - t.s0) / t.l0 : 1;
  const b = t.l1 > 0 ? (t.s1 - s) / t.l1 : 1;
  return t.area * Math.max(0, Math.min(1, a, b));
};

/**
 * A envoltória do aço colocado (cm² ou cm²/m) em pontos (s, v), de 0 a L, com as quinas exatas (as rampas são retas
 * entre os pontos), e o contorno de cada posição.
 */
export function acoColocado(barras: readonly Barra[], r: Recorte): { pontos: PontoDoDiagrama[]; familias: FamiliaNoDiagrama[]; trechos: Trecho[] } {
  const ts = trechosNoRecorte(barras, r);
  const ps = pares(ts);
  const emTraspasse0 = new Set(ps.map((p) => p[1])); // começo de j
  const emTraspasse1 = new Set(ps.map((p) => p[0])); // fim de i
  const prontos: Pronto[] = ts.map((t, k) => {
    const a = r.ancoragem(t.barra);
    const rampa = (ponta: 'reta' | 'dobrada', traspasse: boolean) =>
      Math.max(TOL, traspasse && a.traspasse !== null ? a.traspasse : ponta === 'reta' ? a.reta : a.dobrada);
    return {
      ...t,
      l0: t.s0 < -TOL ? 0 : rampa(t.ponta0, emTraspasse0.has(k)),
      l1: t.s1 > r.L + TOL ? 0 : rampa(t.ponta1, emTraspasse1.has(k)),
    };
  });
  const k = r.largura && r.largura > 0 ? 1000 / r.largura : 1;
  const total = (s: number) => {
    let v = 0;
    for (const t of prontos) v += forca(t, s);
    for (const [i, j] of ps) {
      const a = prontos[i]!;
      const b = prontos[j]!;
      v -= Math.max(0, forca(a, s) + forca(b, s) - Math.max(a.area, b.area));
    }
    return v * k;
  };
  // as quinas: pontas, fins das rampas e o ponto em que o par do traspasse encosta na maior área
  const qs = new Set<number>([0, r.L]);
  for (const t of prontos) for (const s of [t.s0, t.s1, t.s0 + t.l0, t.s1 - t.l1]) if (s > 0 && s < r.L) qs.add(s);
  let ss = [...qs].sort((a, b) => a - b);
  for (const [i, j] of ps) {
    const a = prontos[i]!;
    const b = prontos[j]!;
    const g = (s: number) => forca(a, s) + forca(b, s) - Math.max(a.area, b.area);
    for (let q = 0; q + 1 < ss.length; q++) {
      const g0 = g(ss[q]!);
      const g1 = g(ss[q + 1]!);
      if ((g0 < 0 && g1 > 0) || (g0 > 0 && g1 < 0)) qs.add(ss[q]! + ((ss[q + 1]! - ss[q]!) * g0) / (g0 - g1));
    }
  }
  ss = [...qs].sort((a, b) => a - b);
  const pontos: PontoDoDiagrama[] = [];
  for (const s of ss) {
    const v = total(s);
    // o ponto exatamente na ponta de uma barra que chega cheia na borda da peça: degrau (o valor de dentro)
    pontos.push({ s, v: Math.max(0, v) });
  }
  const porPosicao = new Map<string, FamiliaNoDiagrama>();
  for (const t of prontos) {
    const s0 = Math.max(0, t.s0);
    const s1 = Math.min(r.L, t.s1);
    if (!(s1 > s0)) continue;
    const f = porPosicao.get(t.barra.posicao);
    if (f) {
      f.s0 = Math.min(f.s0, s0);
      f.s1 = Math.max(f.s1, s1);
      f.v += t.area * k;
    } else porPosicao.set(t.barra.posicao, { posicao: t.barra.posicao, s0, s1, v: t.area * k });
  }
  return { pontos, familias: [...porPosicao.values()].sort((a, b) => a.s0 - b.s0 || a.posicao.localeCompare(b.posicao)), trechos: ts };
}

/** O valor de uma envoltória num ponto (interpolada; no degrau, o de dentro do intervalo pedido). */
export function valorEm(pontos: readonly PontoDoDiagrama[], s: number): number {
  if (!pontos.length) return 0;
  if (s <= pontos[0]!.s) return pontos[0]!.v;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const a = pontos[i]!;
    const b = pontos[i + 1]!;
    if (s >= a.s && s <= b.s) return b.s > a.s ? a.v + ((b.v - a.v) * (s - a.s)) / (b.s - a.s) : Math.max(a.v, b.v);
  }
  return pontos[pontos.length - 1]!.v;
}

/** Estribos a menos que isto um do outro são da mesma junta (o par do estribo de 4 ramos do contraforte). */
const MESMA_JUNTA = 15;

/**
 * Estribos ao longo da peça (Asw/s colocado, cm²/m): entre duas juntas seguidas vale ramos·área/distância, com os
 * ramos de TODOS os estribos da junta (`posicoes` tem um item por estribo; os de uma mesma junta somam — o de 4 ramos
 * são dois estribos de 2, armaduras.ts estribosDaJunta); entre juntas com números diferentes, vale a de menos. Fora
 * da primeira e da última, nada. Degraus exatos (dois pontos no mesmo s).
 */
export function estribosAoLongo(posicoes: readonly number[], areaDoRamo: number, ramosPorEstribo: number, L: number): PontoDoDiagrama[] {
  const ordem = posicoes.filter((z) => z >= -TOL && z <= L + TOL).sort((a, b) => a - b);
  const juntas: { z: number; n: number }[] = [];
  for (const z of ordem) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && z - ultima.z < MESMA_JUNTA) ultima.n++;
    else juntas.push({ z: Math.round(z * 10) / 10, n: 1 });
  }
  if (juntas.length < 2) return [];
  const out: PontoDoDiagrama[] = [];
  for (let i = 0; i + 1 < juntas.length; i++) {
    const a = juntas[i]!.z;
    const b = juntas[i + 1]!.z;
    if (!(b > a)) continue;
    const ramos = ramosPorEstribo * Math.min(juntas[i]!.n, juntas[i + 1]!.n);
    const v = (ramos * areaDoRamo * 1000) / (b - a);
    out.push({ s: a, v }, { s: b, v });
  }
  // fecha no eixo: antes do 1º e depois do último não há estribo
  return [{ s: out[0]!.s, v: 0 }, ...out, { s: out[out.length - 1]!.s, v: 0 }];
}
