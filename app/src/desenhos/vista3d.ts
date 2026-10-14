/*
  VISTA 3D EM VETOR — o 3D do visor desenhado em traço, para a prancha sair em PDF e DXF com linha de verdade e não
  com foto. Decisão do Jose (14/10): o Realista vai para a prancha como imagem; o Cores e o Opaco, em VETOR.

  É o isométrico (isometrico.ts) com a câmera solta: a do visor é ortográfica, e o pintor exato do isométrico
  (quemNaFrente + ordemDePintura, de trás para a frente) vale para qualquer direção de olhar — só precisa de v
  (aponta para quem olha), dos eixos da tela e da luz. A base da câmera é a do lookAt do three, o mesmo do visor:
  v = posição − alvo, direita = cima × v, cima da tela = v × direita. Com isso o desenho não sai espelhado em
  relação à tela. A luz é a mesma conta do isométrico (o quadrante de onde se olha), e no Opaco não há luz: a
  massa é branca, como no visor ("com luz, o branco da prancha saía cinza").

  O que o visor mostra e o isométrico não desenhava, e como entra aqui:
  - TERRENO: no visor é um véu (opacidade do estilo) que nunca tapa o muro. Aqui vai primeiro, numa cor só (a do
    terreno misturada ao papel na opacidade do véu), e o resto é pintado por cima — some atrás das peças como no
    visor, e no DXF é um sólido claro na camada do terreno (o DXF não tem transparência);
  - DRENAGEM: brita, areia e manta entram no pintor. A areia e a manta são faixas em L em volta da brita: a caixa
    delas engole a da brita, e o pintor por caixas não decide quem tapa quem. Por isso toda peça de perfil
    retilíneo que não é retângulo (dreno em L, areia, manta, canaleta em U, sapata com dente) é partida em CAIXAS
    pela grade das quinas do perfil; as divisas internas não são desenhadas (nem face, nem aresta);
  - GRAUTE da canaleta: um prisma só por corrida, que cruza o do contraforte no "T" e fecha ciclo no pintor. Vai
    recortado canaleta por canaleta e pintado logo depois do fundo do U de cada uma (como no isométrico);
  - TUBO do dreno de fundo e BARBACÃ: atravessam a brita e o bloco (as caixas se interpenetram); a boca do tubo vai
    logo depois da peça que o contém, como o barbacã do isométrico. Sem essa peça (oculta ou cortada), o tubo
    entra no pintor como peça;
  - GRAUTE do furo: com os blocos à mostra, é a cor do furo na tampa do bloco (como no isométrico); com os blocos
    ocultos, os pilares de graute entram no pintor, fatiados por fiada;
  - ARMADURA (o modo do visor): as barras por cima de tudo, na cor da bitola, mais funda primeiro. Sem ela, a barra
    só aparece na face do corte — dentro do bloco e do graute ela está escondida;
  - CORTE: fica x ≤ X, como no visor (o lado de lá some, de onde quer que se olhe); a face cortada é desenhada,
    hachurada como no corte lateral, quando quem olha está do lado dela (v·x > 0).

  LIMITES do pintor (onde ele pode errar a ordem): peças cujas caixas se interpenetram e não caem nos casos acima
  — o "T" de graute no encontro do pilar com a canaleta, com os blocos ocultos (graute com graute, mesma cor: a
  troca quase não se vê); perfil não retilíneo e não convexo (hoje nenhum); e, DENTRO de uma peça não convexa
  que não foi partida, a ordem das faces é pela profundidade do centro. O véu do terreno fica sempre atrás.
*/
import type { Barra, Modelo, Vec2, Vec3 } from '@/modelo/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { acabamentoDaPeca, categoriasDaBarra, categoriasDaPeca, visivel, type Categoria } from '@/visor/lotes';
import { corDaPeca, corDoAco, opacidadeDoTerreno, tracoDoEstilo, type EstiloVisual } from '@/visor/estiloVisual';
import { lerPaleta } from '@/visor/tema3d';
import { corDaBitola, rotuloDaBitola } from '@/visor/coresDasBitolas';
import { metros } from './formato';
import {
  ALVENARIA, CANALETA, GRAUTE, ehCostura, escalar, facesDoSolido, fatiarEmZ, recortarEmX, secao, solidosDoModelo, type Face, type Solido,
} from './geometria';
import { barrasNoCorte, estiloDaSecao } from './corteLateral';
import { corBase, ordemDePintura, sombrear } from './isometrico';
import { desenharLegenda, itensDasTintas, tintasPresentes, TRACO_DA_PECA, type Amostra } from './cores';
import { COR, Prancha, type OpcoesDaVista, type Pt } from './prancha';

export interface OpcoesVista3d extends OpcoesDaVista {
  /** Largura alvo do desenho (px) quando a escala S não vem. */
  largura?: number;
}

/** A câmera virada em eixos: v aponta para quem olha; (dir, cima) são a direita e o alto da tela. */
export interface BaseDaCamera {
  v: Vec3;
  dir: Vec3;
  cima: Vec3;
  luz: Vec3;
}

const IDX = { X: 0, Y: 1, Z: 2 } as const;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const l = norma(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A isométrica do visor (visor/enquadrar.ts, DIRECOES.iso): para onde olhar quando a câmera não diz. */
const ISO_DO_VISOR: Vec3 = [1, -1, 0.85];

/**
 * A base da câmera, como o lookAt do three a monta (o visor é three): v = posição − alvo; direita = cima × v; cima
 * da tela = v × direita. Olhando exatamente ao longo do "cima" (planta pura) o lookAt não tem solução, e o three
 * desvia a visada um fio — aqui, o mesmo desvio.
 */
export function baseDaCamera(cam: Pick<Camera3d, 'posicao' | 'alvo' | 'cima'>): BaseDaCamera {
  let v = sub(cam.posicao, cam.alvo);
  v = unit(norma(v) > 1e-12 ? v : ISO_DO_VISOR);
  const up: Vec3 = norma(cam.cima) > 1e-12 ? unit(cam.cima) : [0, 0, 1];
  let dir = cruz(up, v);
  if (norma(dir) < 1e-9) {
    v = unit(Math.abs(up[2]) > 0.999 ? [v[0] + 1e-4, v[1], v[2]] : [v[0], v[1], v[2] + 1e-4]);
    dir = cruz(up, v);
  }
  dir = unit(dir);
  const cima = cruz(v, dir);
  // a luz do isométrico: vem do lado de quem olha, de cima (a mesma conta, pelo quadrante da visada)
  const ax = v[0] >= 0 ? 1 : -1;
  const ay = v[1] >= 0 ? 1 : -1;
  return { v, dir, cima, luz: unit([0.3 * ax, 0.6 * ay, 1]) };
}

// ── peças partidas em caixas ─────────────────────────────────────────────────────────────────────────────────────

/** O perfil original de uma peça partida: a extrusão em `e`, o plano (a, b) e o polígono. */
interface Perfil {
  e: 0 | 1 | 2;
  a: 0 | 1 | 2;
  b: 0 | 1 | 2;
  Q: Vec2[];
}

/**
 * O que vai pintado logo depois de um pedaço, sem passar pelo pintor: a boca do tubo que o atravessa (barbacã,
 * dreno de fundo) ou o graute que enche o U da canaleta. `fim` = o comprimento original do graute no eixo dele: a
 * face de topo do graute só aparece onde ele acaba de verdade, não onde foi recortado na divisa de duas canaletas.
 */
interface Anexo {
  s: Solido;
  boca: boolean;
  fim?: { e: 0 | 1 | 2; lo: number; hi: number };
}

/** Um pedaço que o pintor ordena: o sólido (caixa), o perfil da peça de onde saiu (se partida) e os anexos. */
interface Pedaco {
  s: Solido;
  perfil?: Perfil;
  anexos: Anexo[];
}

/** Ponto dentro do polígono (par-ímpar). */
function dentro(Q: Vec2[], [x, y]: Vec2): boolean {
  let d = false;
  for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) {
    const [xi, yi] = Q[i];
    const [xj, yj] = Q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function unicos(xs: number[]): number[] {
  const out: number[] = [];
  for (const x of [...xs].sort((u, v) => u - v)) if (!out.length || x - out[out.length - 1] > 0.01) out.push(x);
  return out;
}

/**
 * Prisma de perfil retilíneo que não é retângulo → caixas, pela grade das quinas do perfil (ver o cabeçalho). O furo
 * do perfil (o do tubo na brita) fica na caixa que o contém, para a tampa mostrar o vão.
 */
function emCaixas(s: Solido): Pedaco[] {
  const e = IDX[s.eixo];
  const [a, b] = ([0, 1, 2] as const).filter((k) => k !== e) as [0 | 1 | 2, 0 | 1 | 2];
  const Q: Vec2[] = s.base.map((p) => [p[a], p[b]]);
  const retilineo = Q.every((p, k) => {
    const q = Q[(k + 1) % Q.length];
    return Math.abs(p[0] - q[0]) < 0.01 || Math.abs(p[1] - q[1]) < 0.01;
  });
  if (Q.length <= 4 || !retilineo) return [{ s, anexos: [] }];
  const as = unicos(Q.map((q) => q[0]));
  const bs = unicos(Q.map((q) => q[1]));
  const w0 = s.base[0][e];
  const w1 = s.topo[0][e];
  const P3 = (q: Vec2, w: number): Vec3 => {
    const p: Vec3 = [0, 0, 0];
    p[a] = q[0];
    p[b] = q[1];
    p[e] = w;
    return p;
  };
  const perfil: Perfil = { e, a, b, Q };
  const out: Pedaco[] = [];
  for (let i = 0; i + 1 < as.length; i++) {
    for (let j = 0; j + 1 < bs.length; j++) {
      if (!dentro(Q, [(as[i] + as[i + 1]) / 2, (bs[j] + bs[j + 1]) / 2])) continue;
      const r: Vec2[] = [[as[i], bs[j]], [as[i + 1], bs[j]], [as[i + 1], bs[j + 1]], [as[i], bs[j + 1]]];
      const base = r.map((q) => P3(q, w0));
      const topo = r.map((q) => P3(q, w1));
      const furosBase: Vec3[][] = [];
      const furosTopo: Vec3[][] = [];
      s.furosBase.forEach((f, k) => {
        const naCaixa = f.every((p) => p[a] >= as[i] - 0.5 && p[a] <= as[i + 1] + 0.5 && p[b] >= bs[j] - 0.5 && p[b] <= bs[j + 1] + 0.5);
        if (naCaixa) {
          furosBase.push(f);
          furosTopo.push(s.furosTopo[k]);
        }
      });
      const min: Vec3 = [0, 0, 0];
      const max: Vec3 = [0, 0, 0];
      for (const k of [0, 1, 2] as const) {
        const vs = [...base, ...topo].map((p) => p[k]);
        min[k] = Math.min(...vs);
        max[k] = Math.max(...vs);
      }
      out.push({ s: { ...s, base, topo, furosBase, furosTopo, min, max }, perfil, anexos: [] });
    }
  }
  return out.length ? out : [{ s, anexos: [] }];
}

/** Caixa [min, max] como sólido extrudado no mesmo eixo de `s` (o pedaço de graute recortado na canaleta). */
function caixaSolida(s: Solido, min: Vec3, max: Vec3): Solido {
  const e = IDX[s.eixo];
  const [a, b] = ([0, 1, 2] as const).filter((k) => k !== e);
  const anel = (w: number): Vec3[] =>
    ([[min[a], min[b]], [max[a], min[b]], [max[a], max[b]], [min[a], max[b]]] as Vec2[]).map((q) => {
      const p: Vec3 = [0, 0, 0];
      p[a] = q[0];
      p[b] = q[1];
      p[e] = w;
      return p;
    });
  return { ...s, base: anel(min[e]), topo: anel(max[e]), furosBase: [], furosTopo: [], min, max, costuras: undefined };
}

/** Meio milímetro: o passo para o lado com que se pergunta "há material ali?" na divisa entre duas caixas. */
const EPS = 0.5;

/** A aresta é interna à peça (divisa entre caixas ou costura de fatia) e não se desenha? */
function arestaInterna(pd: Pedaco, p: Vec3, q: Vec3): boolean {
  if (ehCostura(pd.s, p, q)) return true;
  const pf = pd.perfil;
  if (!pf) return false;
  const { a, b, Q } = pf;
  const da = q[a] - p[a];
  const db = q[b] - p[b];
  if (Math.abs(da) < 0.01 && Math.abs(db) < 0.01) {
    // aresta ao longo da extrusão: só é aresta de verdade na QUINA do perfil (material em 1 ou 3 dos 4 quadrantes,
    // ou em 2 opostos); em 2 vizinhos é meio de face, em 4 é miolo
    const ins = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([sa, sb]) => dentro(Q, [p[a] + sa * EPS, p[b] + sb * EPS]));
    const n = ins.filter(Boolean).length;
    return !(n === 1 || n === 3 || (n === 2 && ins[0] === ins[2]));
  }
  // aresta no plano do perfil: interna se há material dos dois lados
  const L = Math.hypot(da, db);
  const m: Vec2 = [(p[a] + q[a]) / 2, (p[b] + q[b]) / 2];
  const nr: Vec2 = [-db / L, da / L];
  return dentro(Q, [m[0] + EPS * nr[0], m[1] + EPS * nr[1]]) && dentro(Q, [m[0] - EPS * nr[0], m[1] - EPS * nr[1]]);
}

/** A face é interna (encosta noutra caixa da mesma peça, ou é o plano de uma fatia)? */
function faceInterna(pd: Pedaco, f: Face): boolean {
  if (pd.s.costuras && f.pts.every((p, k) => ehCostura(pd.s, p, f.pts[(k + 1) % f.pts.length]))) return true;
  const pf = pd.perfil;
  if (!pf || Math.abs(f.normal[pf.e]) > 0.5) return false;   // as tampas da extrusão são faces de verdade
  const c = f.pts.reduce((s, p) => [s[0] + p[0] / f.pts.length, s[1] + p[1] / f.pts.length, s[2] + p[2] / f.pts.length] as Vec3, [0, 0, 0] as Vec3);
  return dentro(pf.Q, [c[pf.a] + EPS * f.normal[pf.a], c[pf.b] + EPS * f.normal[pf.b]]);
}

// ── a cena ───────────────────────────────────────────────────────────────────────────────────────────────────────

const PARTIR = new Set<Solido['peca']['tipo']>(['DRENO', 'AREIA', 'MANTA']);
const TUBOS = new Set<Solido['peca']['tipo']>(['BARBACA', 'TUBO_DRENO']);

interface Cena {
  base: BaseDaCamera;
  estilo: Exclude<EstiloVisual, 'realista'>;
  ocultas: ReadonlySet<Categoria>;
  corte: number | null;
  /** O véu (terreno), já cortado. */
  terreno: Solido[];
  /** O que o pintor ordena. */
  pecas: Pedaco[];
  /** As peças visíveis sem o corte (a face cortada sai delas). */
  inteiras: Solido[];
  barras: Barra[];
}

function montarCena(m: Modelo, cam: Camera3d): Cena {
  const base = baseDaCamera(cam);
  // o Realista vai para a prancha como foto; se chegar aqui, sai no Cores
  const estilo = cam.estilo === 'opaco' ? 'opaco' : 'cores';
  const ocultas = new Set(cam.ocultas as Categoria[]);
  const corte = cam.corteX ?? null;
  const inteiras = solidosDoModelo(m).filter((s) => visivel(categoriasDaPeca(s.peca), ocultas));
  // o visor fica com x ≤ X, de onde quer que se olhe (visor/Corte.tsx)
  const cortadas = corte === null ? inteiras : inteiras.map((s) => recortarEmX(s, corte, true)).filter((s): s is Solido => !!s);
  const terreno = cortadas.filter((s) => s.peca.grupo === 'terreno');
  const blocosAMostra = !ocultas.has('blocos');

  const pecas: Pedaco[] = [];
  const tubos: Solido[] = [];
  const grautesDaCanaleta: Solido[] = [];
  for (const s of cortadas) {
    const tp = s.peca.tipo;
    if (s.peca.grupo === 'terreno') continue;
    if (TUBOS.has(tp)) {
      tubos.push(s);
      continue;
    }
    if (tp === 'GRAUTE_CANALETA') {
      grautesDaCanaleta.push(s);
      continue;
    }
    // o pilar de graute está dentro do bloco: com o bloco à mostra, é a cor do furo na tampa
    if (tp === 'GRAUTE_FURO' && blocosAMostra) continue;
    const partes = emCaixas(s);
    if (PARTIR.has(tp) || tp === 'GRAUTE_FURO') {
      // fatiado por fiada, como o dreno do isométrico: peça alta e comprida fecha ciclo com os blocos
      for (const pd of partes) for (const f of fatiarEmZ(pd.s, 200)) pecas.push({ s: f, perfil: pd.perfil, anexos: [] });
    } else {
      pecas.push(...partes);
    }
  }
  // cada tubo vai com a peça que o contém (o centro dele dentro da caixa dela); sem ela, é peça do pintor
  for (const t of tubos) {
    const c: Vec3 = [(t.min[0] + t.max[0]) / 2, (t.min[1] + t.max[1]) / 2, (t.min[2] + t.max[2]) / 2];
    const casa = t.peca.tipo === 'BARBACA' ? (tp: string) => ALVENARIA.has(tp as never) : (tp: string) => tp === 'DRENO';
    const dono = pecas.find((pd) => casa(pd.s.peca.tipo) && [0, 1, 2].every((k) => pd.s.min[k] < c[k] && c[k] < pd.s.max[k]));
    if (dono) dono.anexos.push({ s: t, boca: true });
    else pecas.push({ s: t, anexos: [] });
  }
  /*
    O graute da canaleta é UM prisma por corrida de canaletas (a parede inteira, às vezes) e cruza o graute do
    contraforte no "T": no pintor, essa peça comprida fecha ciclo, e o desempate deixava o bloco da fiada de cima
    ir antes dela — o graute aparecia por cima do bloco. Aqui ele é recortado canaleta por canaleta e pintado logo
    depois do FUNDO do U de cada uma (a caixa de baixo, do meio): quem tapa a canaleta tapa o graute dela, como
    no isométrico. Sem canaleta à mostra (blocos ocultos), o graute vira peça do pintor.
  */
  for (const g of grautesDaCanaleta) {
    const e = IDX[g.eixo];
    const lado = e === 0 ? 1 : 0;                       // o eixo horizontal de través do graute
    const meio = (g.min[lado] + g.max[lado]) / 2;
    const fundos = new Map<string, Pedaco>();
    for (const pd of pecas) {
      const s = pd.s;
      if (!CANALETA.has(s.peca.tipo) || IDX[s.eixo] !== e) continue;
      if (!(s.min[lado] < meio && meio < s.max[lado]) || s.max[e] <= g.min[e] + 0.5 || s.min[e] >= g.max[e] - 0.5) continue;
      if (s.min[2] > g.min[2] + 0.5 || s.max[2] < g.min[2] - 0.5) continue;    // o fundo: a caixa logo abaixo do graute
      const ja = fundos.get(s.peca.id);
      if (!ja || s.min[2] < ja.s.min[2]) fundos.set(s.peca.id, pd);
    }
    if (!fundos.size) {
      pecas.push({ s: g, anexos: [] });
      continue;
    }
    for (const pd of fundos.values()) {
      const min: Vec3 = [...g.min];
      const max: Vec3 = [...g.max];
      min[e] = Math.max(g.min[e], pd.s.min[e]);
      max[e] = Math.min(g.max[e], pd.s.max[e]);
      if (max[e] - min[e] > 0.5) pd.anexos.push({ s: caixaSolida(g, min, max), boca: false, fim: { e, lo: g.min[e], hi: g.max[e] } });
    }
  }
  const barras = m.barras.filter((b) => visivel(categoriasDaBarra(b), ocultas));
  return { base, estilo, ocultas, corte, terreno, pecas, inteiras: inteiras.filter((s) => s.peca.grupo !== 'terreno'), barras };
}

/** Polilinha recortada pelo plano X = c, ficando x ≤ c (a barra do lado de lá do corte some, como no visor). */
function cortarPolilinha(pts: Vec3[], c: number | null): Vec3[][] {
  if (c === null) return [pts];
  const dentroDoCorte = (p: Vec3) => p[0] <= c + 1e-9;
  const out: Vec3[][] = [];
  let atual: Vec3[] = [];
  pts.forEach((p, k) => {
    if (k > 0) {
      const q = pts[k - 1];
      if (dentroDoCorte(q) !== dentroDoCorte(p)) {
        const t = (c - q[0]) / (p[0] - q[0]);
        atual.push([c, q[1] + t * (p[1] - q[1]), q[2] + t * (p[2] - q[2])]);
        if (!dentroDoCorte(p)) {
          if (atual.length >= 2) out.push(atual);
          atual = [];
        }
      }
    }
    if (dentroDoCorte(p)) atual.push(p);
  });
  if (atual.length >= 2) out.push(atual);
  return out;
}

/** A extensão do desenho na tela (mm do muro, sem escala): [u0, u1, w0, w1] — u para a direita, w para cima. */
function extensao(c: Cena, armadura: boolean): [number, number, number, number] {
  let [u0, u1, w0, w1] = [Infinity, -Infinity, Infinity, -Infinity];
  const pt = (p: Vec3) => {
    const u = escalar(p, c.base.dir);
    const w = escalar(p, c.base.cima);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w);
  };
  for (const s of [...c.terreno, ...c.pecas.map((pd) => pd.s)]) for (const p of [...s.base, ...s.topo]) pt(p);
  if (armadura) for (const b of c.barras) for (const tr of cortarPolilinha(b.eixo, c.corte)) tr.forEach(pt);
  return Number.isFinite(u0) ? [u0, u1, w0, w1] : [0, 0, 0, 0];
}

/** Largura do desenho em mm DO MURO (a prancha divide a largura do papel por ela para achar a escala). */
export function larguraProjetada(m: Modelo, cam: Camera3d): number {
  const [u0, u1] = extensao(montarCena(m, cam), cam.armadura);
  return u1 - u0;
}

// ── cores ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Cor de `hex` vista através de um véu de opacidade `op` sobre o papel branco (o terreno do visor). */
function veu(hex: string, op: number): string {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return '#' + c.map((x) => Math.round(255 + (x - 255) * op).toString(16).padStart(2, '0')).join('');
}

function camadaDaPeca(tp: Solido['peca']['tipo']): string {
  if (ALVENARIA.has(tp)) return 'alvenaria';
  if (GRAUTE.has(tp)) return 'graute';
  if (tp === 'SAPATA') return 'concreto';
  return 'drenagem';
}

export function desenharVista3d(m: Modelo, cam: Camera3d, o: OpcoesVista3d = {}): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des');
  const c = montarCena(m, cam);
  const { v, dir, cima, luz } = c.base;
  const opaco = c.estilo === 'opaco';
  // o Opaco do visor (visor/estiloVisual.ts): massa branca sem luz, graute cinza-claro, aço cinza-escuro, traço preto
  const paleta = opaco ? lerPaleta() : null;
  const corOpaca = (s: Solido) => corDaPeca('opaco', paleta!, acabamentoDaPeca(s.peca.tipo));
  const tracoOpaco = opaco ? tracoDoEstilo('opaco', paleta!)!.cor : '';

  const [u0, u1, w0, w1] = extensao(c, cam.armadura);
  const S = o.S ?? Math.min(0.6, Math.max(0.04, (o.largura ?? 1000) / Math.max(u1 - u0, (w1 - w0) * 1.3, 1)));
  const P = (p: Vec3): Pt => [escalar(p, dir) * S, -escalar(p, cima) * S];
  const frente = (f: Face) => escalar(f.normal, v) > 1e-6;
  const fundo = (f: Face) => escalar(f.pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as Vec3, [0, 0, 0] as Vec3), v) / f.pts.length;
  const grauteAMostra = !c.ocultas.has('graute');

  // ── terreno: o véu, antes de tudo ───────────────────────────────────────────────────────────────────────────────
  if (c.terreno.length) {
    const cor = veu(opaco ? corDaPeca('opaco', paleta!, 'terreno') : COR.solo, opacidadeDoTerreno(c.estilo));
    pr.abrir('data-camada="terreno"');
    const faces = c.terreno.flatMap((s) => facesDoSolido(s).filter(frente).map((f) => ({ s, f, prof: fundo(f) })));
    for (const { s, f } of faces.sort((a, b) => a.prof - b.prof)) {
      pr.poligono(f.pts.map(P), { fill: cor, stroke: cor, sw: 0.6, id: s.peca.id, camada: 'terreno' });
    }
    pr.fechar();
  }

  // ── as peças, de trás para a frente ─────────────────────────────────────────────────────────────────────────────
  const doSolido = new Map(c.pecas.map((pd) => [pd.s, pd]));
  const ordem = ordemDePintura(c.pecas.map((pd) => pd.s), v, P).map((s) => doSolido.get(s)!);
  pr.abrir('data-camada="pecas"');
  for (const pd of ordem) {
    const s = pd.s;
    const tp = s.peca.tipo;
    const alv = ALVENARIA.has(tp);
    const camada = camadaDaPeca(tp);
    const base = opaco ? corOpaca(s) : corDoCores(s);
    // traço escuro também no bloco (o cinza do inteiro engoliria um mais claro); no Opaco o traço é o desenho
    const traco = opaco ? tracoOpaco : alv ? '#2e2e2e' : '#404040';
    const partida = !!pd.perfil || !!s.costuras;
    const faces = facesDoSolido(s)
      .filter((f) => frente(f) && !faceInterna(pd, f))
      .map((f) => ({ f, prof: fundo(f) }))
      .sort((a, b) => a.prof - b.prof);
    for (const { f } of faces) {
      const luzDaFace = Math.max(0, escalar(f.normal, luz));
      const fator = opaco ? 1 : alv ? Math.min(1, 0.8 + 0.25 * luzDaFace) : 0.6 + 0.4 * luzDaFace;
      const cor = sombrear(base, fator);
      if (!partida) {
        pr.poligono(f.pts.map(P), { fill: cor, stroke: traco, sw: alv ? 0.4 : 0.6, id: s.peca.id, camada });
      } else {
        // peça partida: a divisa não aparece — o contorno na cor da face cobre a fresta, e só as arestas da peça
        // original levam traço
        pr.poligono(f.pts.map(P), { fill: cor, stroke: cor, sw: 0.6, id: s.peca.id, camada });
        f.pts.forEach((p, k) => {
          const q = f.pts[(k + 1) % f.pts.length];
          if (arestaInterna(pd, p, q)) return;
          const [a, b] = [P(p), P(q)];
          pr.linha(a[0], a[1], b[0], b[1], { stroke: traco, sw: 0.6, camada });
        });
      }
      // furo visto na tampa: graute se a peça diz que o furo é grauteado (e o graute está à mostra); vazio, senão
      if (f.tampa && f.furos.length) {
        const gr = new Set(s.peca.furosGrauteados ?? []);
        f.furos.forEach((furo, k) => {
          const cheio = grauteAMostra && gr.has(k);
          const corDoFuro = cheio
            ? opaco ? corDaPeca('opaco', paleta!, 'graute') : sombrear(COR.grauteFundo, fator)
            : opaco ? '#ffffff' : COR.furoEscuro;
          pr.poligono(furo.map(P), { fill: corDoFuro, stroke: traco, sw: 0.3, camada: cheio ? 'graute' : camada });
        });
      }
    }
    for (const an of pd.anexos) {
      const t = an.s;
      if (an.boca) {
        // a boca do tubo que atravessa esta peça (barbacã no bloco, tubo do dreno de fundo na brita)
        const lado = escalar(sub(t.topo[0], t.base[0]), v);
        if (Math.abs(lado) < 1e-9) continue;
        const boca = lado > 0 ? t.topo : t.base;
        pr.poligono(boca.map(P), { fill: opaco ? corOpaca(t) : COR.furoEscuro, stroke: traco, sw: 0.4, id: t.peca.id, camada: 'drenagem' });
        continue;
      }
      // o graute que enche o U: só a tampa de cima e, onde a corrida acaba de verdade, a de topo — as outras faces
      // encostam nas paredes e no fundo do U e ficam sempre atrás deles (pintadas aqui, depois da canaleta,
      // apareceriam por cima da parede da frente)
      const fim = an.fim!;
      const aparece = (f: Face) => {
        if (f.normal[2] > 0.5) return true;
        if (Math.abs(f.normal[fim.e]) < 0.5) return false;
        return Math.abs(f.pts[0][fim.e] - fim.lo) < 0.5 || Math.abs(f.pts[0][fim.e] - fim.hi) < 0.5;
      };
      for (const f of facesDoSolido(t).filter((q) => frente(q) && aparece(q)).sort((a, b) => fundo(a) - fundo(b))) {
        const cor = opaco ? corDaPeca('opaco', paleta!, 'graute') : sombrear(COR.grauteFundo, 0.6 + 0.4 * Math.max(0, escalar(f.normal, luz)));
        pr.poligono(f.pts.map(P), { fill: cor, stroke: opaco ? traco : COR.graute, sw: 0.3, id: t.peca.id, camada: 'graute' });
      }
    }
  }
  pr.fechar();

  // ── face cortada: só quem olha do lado dela a vê ─────────────────────────────────────────────────────────────────
  if (c.corte !== null && v[0] > 1e-6) {
    const x = c.corte;
    pr.abrir('data-camada="corte"');
    const P3 = (yz: Vec2): Pt => P([x, yz[0], yz[1]]);
    const cortados = c.inteiras
      .map((s) => ({ s, r: secao(s, 'X', x) }))
      .filter((q) => q.r.length && q.s.peca.tipo !== 'BARBACA')
      .sort((a, b) => (GRAUTE.has(a.s.peca.tipo) ? 1 : 0) - (GRAUTE.has(b.s.peca.tipo) ? 1 : 0));
    for (const { s, r } of cortados) {
      let e = estiloDaSecao(s, pr);
      if (!e) continue;
      // no Opaco, o que no corte lateral é cor (graute azul, manta verde) vai nos cinzas do Opaco do visor; as
      // hachuras de material (alvenaria, concreto, brita, areia) ficam — são convenção de prancha
      const tp = s.peca.tipo;
      if (opaco && (GRAUTE.has(tp) || tp === 'MANTA')) e = { ...e, fill: corOpaca(s), stroke: tracoOpaco };
      for (const q of r) pr.caminho([q.contorno, ...q.furos].map((a) => a.map(P3)), { ...e, sw: 0.6, id: s.peca.id });
    }
    if (!cam.armadura) {
      const aco = opaco ? corDoAco('opaco') : COR.aco;
      const br = barrasNoCorte(m, x);
      const ve = (b: Barra) => visivel(categoriasDaBarra(b), c.ocultas);
      for (const l of br.linhas.filter((q) => ve(q.barra))) {
        pr.polilinha((l.fechada ? [...l.pts, l.pts[0]] : l.pts).map(P3), { stroke: aco, sw: Math.max(0.8, l.barra.diametro * S), id: l.barra.id, camada: 'aco' });
      }
      for (const p of br.pontos.filter((q) => ve(q.barra))) {
        const [a, b] = P3(p.p);
        pr.circulo(a, b, Math.max(1.2, (p.barra.diametro / 2) * S), { fill: aco, id: p.barra.id, camada: 'aco' });
      }
    }
    pr.fechar();
  }

  // ── armadura por cima de tudo (o modo Armadura do visor), a mais funda primeiro ─────────────────────────────────
  const diametros = new Set<number>();
  if (cam.armadura) {
    pr.abrir('data-camada="armadura"');
    const trechos = c.barras
      .flatMap((b) => cortarPolilinha(b.fechada ? [...b.eixo, b.eixo[0]] : b.eixo, c.corte).map((pts) => ({ b, pts })))
      .map((q) => ({ ...q, prof: q.pts.reduce((s, p) => s + escalar(p, v), 0) / q.pts.length }))
      .sort((a, b) => a.prof - b.prof);
    for (const { b, pts } of trechos) {
      diametros.add(b.diametro);
      pr.polilinha(pts.map(P), { stroke: corDaBitola(b.diametro), sw: Math.max(0.8, b.diametro * S), id: b.id, camada: 'aco' });
    }
    pr.fechar();
  }

  // ── legenda embaixo, título em cima ──────────────────────────────────────────────────────────────────────────────
  const { viewBox } = pr.partes(0);
  const itens: [string, Amostra][] = opaco || o.semLegendaDeCores ? [] : itensDasTintas(tintasPresentes(ordem.map((pd) => pd.s)));
  for (const d of [...diametros].sort((a, b) => a - b)) itens.push([rotuloDaBitola(d), { fill: corDaBitola(d), stroke: TRACO_DA_PECA, sw: 0.7 }]);
  if (itens.length) desenharLegenda(pr, viewBox[0], viewBox[1] + viewBox[3] + 28, itens, Math.max(320, viewBox[2]));
  const titulo = c.corte !== null ? `Vista 3D — corte em x = ${metros(c.corte)} m` : 'Vista 3D';
  if (!o.semTitulo) pr.texto(viewBox[0], viewBox[1] - 14, titulo, { tam: 15, ancora: 'start', negrito: true });
  if (m.familia.provisoria && m.dims.contrafortes.length) {
    const x = viewBox[0] + (o.semTitulo ? 0 : Prancha.largura(titulo, 15, true) + 16);
    pr.texto(x, viewBox[1] - 14, 'PROVISÓRIO', { tam: 13, ancora: 'start', negrito: true, cor: COR.especial });
  }
  return pr;
}

/**
 * O estilo Cores: o bloco na cor do Jose e a sapata e o dreno como no isométrico (corBase); o resto na cor dos
 * desenhos 2D (corte lateral), para a prancha falar uma língua só: graute azul-claro, areia, manta, tubo branco.
 */
function corDoCores(s: Solido): string {
  const tp = s.peca.tipo;
  if (GRAUTE.has(tp)) return COR.grauteFundo;
  if (tp === 'AREIA') return COR.areiaFundo;
  if (tp === 'MANTA') return COR.manta;
  if (TUBOS.has(tp)) return '#ffffff';
  return corBase(s);
}
