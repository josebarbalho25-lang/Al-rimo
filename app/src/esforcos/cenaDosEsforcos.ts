/*
  A CENA DOS ESFORÇOS em three — o desenho das barras analíticas (barrasAnaliticas.ts) para a tela e para a foto da
  prancha (os dois montam por aqui, só muda a paleta).

  Cada barra: o EIXO (linha), o MSd como faixa cheia deitada no plano de flexão (do eixo para o lado tracionado), o
  contorno do MSd (cheio na barra de verdade, TRACEJADO na esquemática: o traço diz o que é forma ilustrativa, sem
  precisar de texto), a linha do MRd por cima, e em VERMELHO a parte do MSd que passa do MRd.

  A ESCALA DO DESENHO: "Aproveitamento" põe o MRd de toda barra na mesma altura — a faixa lê MSd/MRd; "Valor" dá a
  mesma escala às barras da mesma unidade (kN·m/m com kN·m/m, kN·m com kN·m).

  Metros na cena (como o visor 3D: a câmera ortográfica do r3f tem zoom em pixels por metro); o modelo é em mm.
*/
import * as THREE from 'three';
import type { Modelo, Vec3 } from '@/modelo/tipos';
import { caixaGlobal } from '@/modulacao/perfis';
import type { Caixa } from '@/visor/perfil3d';
import type { PaletaVisor } from '@/visor/tema3d';
import type { BarraAnalitica, Estacao } from './tipos';

export type EscalaDosEsforcos = 'aproveitamento' | 'valor';

export interface CoresDosEsforcos {
  eixo: string;
  msd: string;
  mrd: string;
  excesso: string;
  fantasma: string;
  texto: string;
  fundoDoTexto: string;
  destaque: string;
}

/** As cores da tela, dos tokens do tema (as mesmas do visor). */
export function coresDaTela(p: PaletaVisor, tema: (nome: string, reserva: string) => string): CoresDosEsforcos {
  return {
    eixo: p.tinta,
    msd: p.selecionado,
    mrd: p.tinta,
    excesso: tema('--err', '#d64545'),
    fantasma: tema('--muted', '#969aa8'),
    texto: p.tinta,
    fundoDoTexto: p.fundo,
    destaque: p.enfase,
  };
}

/** As cores da prancha: papel branco, tinta escura, em qualquer tema. */
export const CORES_DO_PAPEL: CoresDosEsforcos = {
  eixo: '#1b1d22',
  msd: '#2f6fd6',
  mrd: '#1b1d22',
  excesso: '#d12c2c',
  fantasma: '#8a8d96',
  texto: '#1b1d22',
  fundoDoTexto: '#ffffff',
  destaque: '#1b1d22',
};

export interface OpcoesDaCena {
  escala: EscalaDosEsforcos;
  valores: boolean;
  muro: boolean;
  cores: CoresDosEsforcos;
}

export interface CenaDosEsforcos {
  grupo: THREE.Group;
  /** A caixa de tudo o que está desenhado, metro (o enquadrar usa). */
  caixa: Caixa;
  /** O id da barra que o raio pega primeiro (eixo ou faixa), ou null. */
  pegar: (raio: THREE.Raycaster) => string | null;
  /** Acende a barra com o mouse por cima e a escolhida. */
  destacar: (sobre: string | null, escolhida: string | null) => void;
  /** Os números ficam do mesmo tamanho na tela em qualquer zoom: altura da letra em metro. */
  tamanhoDaLetra: (metros: number) => void;
  centroDe: (id: string) => Vec3 | null;
  dispose: () => void;
}

const MM = 0.001;
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Número com vírgula e duas casas ("8,70"). */
export const numeroBr = (v: number, casas = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);

/** A referência de cada barra: o valor que vira a altura cheia do desenho. */
function referencias(barras: BarraAnalitica[], escala: EscalaDosEsforcos): Map<string, number> {
  const maxDe = (b: BarraAnalitica, comMsd: boolean) => {
    let m = 0;
    for (const e of b.estacoes) m = Math.max(m, e.mrd ?? 0, e.mrdOposto ?? 0, comMsd ? Math.abs(e.msd) : 0);
    return m;
  };
  const out = new Map<string, number>();
  if (escala === 'aproveitamento') {
    for (const b of barras) out.set(b.id, maxDe(b, false) || maxDe(b, true) || 1);
    return out;
  }
  const porUnidade = new Map<string, number>();
  for (const b of barras) porUnidade.set(b.unidade, Math.max(porUnidade.get(b.unidade) ?? 0, maxDe(b, true)));
  for (const b of barras) out.set(b.id, porUnidade.get(b.unidade) || 1);
  return out;
}

/**
 * Corta o trecho entre duas estações onde o regime muda (cruza o zero, cruza o MRd de um lado ou do outro): dentro
 * de cada pedaço a parte normal e a vermelha são trapézios exatos, sem serrilhado na quina do MRd.
 */
function pedacos(a: Estacao, b: Estacao): number[] {
  const ts = [0, 1];
  const raiz = (f0: number, f1: number) => {
    if ((f0 < 0 && f1 > 0) || (f0 > 0 && f1 < 0)) ts.push(f0 / (f0 - f1));
  };
  raiz(a.msd, b.msd);
  if (a.mrd !== null && b.mrd !== null) raiz(a.msd - a.mrd, b.msd - b.mrd);
  if (a.mrdOposto !== null && b.mrdOposto !== null) raiz(a.msd + a.mrdOposto, b.msd + b.mrdOposto);
  return [...new Set(ts)].sort((x, y) => x - y);
}

const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
const lerpN = (x: number | null, y: number | null, t: number) => (x === null || y === null ? null : lerp(x, y, t));

function rotulo(texto: string, cor: string, fundo: string): THREE.Sprite {
  const px = 64;
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g = cv?.getContext('2d') ?? null;
  let w = 4;
  if (cv && g) {
    g.font = `600 ${px}px Segoe UI, system-ui, sans-serif`;
    w = Math.ceil(g.measureText(texto).width) + px * 0.5;
    cv.width = w;
    cv.height = Math.ceil(px * 1.35);
    g.font = `600 ${px}px Segoe UI, system-ui, sans-serif`;
    g.fillStyle = fundo;
    g.globalAlpha = 0.82;
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalAlpha = 1;
    g.fillStyle = cor;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText(texto, cv.width / 2, cv.height / 2);
  }
  const tex = cv ? new THREE.CanvasTexture(cv) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  s.userData.proporcao = cv ? cv.width / cv.height : 3;
  return s;
}

/** O muro em fantasma: as caixas das peças grandes (parede por trecho, contrafortes, sapata, muro de cima). */
function caixasDoMuro(m: Modelo): Caixa[] {
  const caixas: Caixa[] = [];
  const t = m.familia.t;
  for (const tr of m.dims.trechos) caixas.push({ min: [tr.x0, 0, 0], max: [tr.x1, t, m.dims.H_muro] });
  const juntar = new Map<string, Caixa>();
  for (const p of m.pecas) {
    const chave = p.grupo === 'contraforte' ? `cf${p.trecho}.${p.contraforte}` : p.tipo === 'SAPATA' || p.tipo === 'PILARETE' || p.tipo === 'CINTA_MC' ? `${p.tipo}.${p.id}` : null;
    if (!chave) continue;
    const g = m.geometrias[p.geometria];
    if (!g) continue;
    const c = caixaGlobal(p, g);
    const j = juntar.get(chave);
    juntar.set(chave, j ? { min: [0, 1, 2].map((i) => Math.min(j.min[i]!, c.min[i]!)) as Vec3, max: [0, 1, 2].map((i) => Math.max(j.max[i]!, c.max[i]!)) as Vec3 } : c);
  }
  caixas.push(...juntar.values());
  const mc = m.dims.muroDeCima;
  if (mc) for (const tr of m.dims.trechos) caixas.push({ min: [tr.x0, (t - mc.t) / 2, mc.z0], max: [tr.x1, (t + mc.t) / 2, mc.z1] });
  return caixas;
}

export function montarCenaDosEsforcos(barras: BarraAnalitica[], modelo: Modelo, o: OpcoesDaCena): CenaDosEsforcos {
  const grupo = new THREE.Group();
  const descartar: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T): T => {
    descartar.push(x);
    return x;
  };
  const cor = (c: string) => new THREE.Color(c);
  // a altura cheia do desenho: 30 % da altura do muro (mínimo de 1,5 m de muro), em metro — menos que isso o
  // diagrama do painel some atrás do da haste; mais, um contraforte invade o vizinho
  const ALT = 0.3 * Math.max(modelo.dims.H_muro + (modelo.dims.muroDeCima ? modelo.dims.muroDeCima.z1 - modelo.dims.muroDeCima.z0 : 0), 1500) * MM;
  const ref = referencias(barras, o.escala);

  const matEixo = guardar(new THREE.LineBasicMaterial({ color: cor(o.cores.eixo), transparent: true, opacity: 0.9 }));
  const matMrd = guardar(new THREE.LineBasicMaterial({ color: cor(o.cores.mrd) }));
  const matFill = () => guardar(new THREE.MeshBasicMaterial({ color: cor(o.cores.msd), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  const matExc = () => guardar(new THREE.MeshBasicMaterial({ color: cor(o.cores.excesso), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  const matContorno = (tracejado: boolean) =>
    guardar(tracejado ? new THREE.LineDashedMaterial({ color: cor(o.cores.msd), dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.85 }) : new THREE.LineBasicMaterial({ color: cor(o.cores.msd) }));

  const pegaveis: THREE.Object3D[] = [];
  const porBarra = new Map<string, { eixo: THREE.Line; fill: THREE.MeshBasicMaterial; centro: Vec3 }>();
  const rotulos: THREE.Sprite[] = [];
  const caixa = new THREE.Box3();

  for (const b of barras) {
    const L = Math.hypot(b.ate[0] - b.de[0], b.ate[1] - b.de[1], b.ate[2] - b.de[2]);
    if (!(L > 0)) continue;
    const u: Vec3 = [(b.ate[0] - b.de[0]) / L, (b.ate[1] - b.de[1]) / L, (b.ate[2] - b.de[2]) / L];
    const k = ALT / (ref.get(b.id) || 1);
    const ponto = (s: number, v: number): Vec3 => {
      const p = add(b.de, u, s);
      return [p[0] * MM + b.lado[0] * v * k, p[1] * MM + b.lado[1] * v * k, p[2] * MM + b.lado[2] * v * k];
    };
    const sub = new THREE.Group();
    sub.userData.barra = b.id;

    // o eixo
    const gEixo = guardar(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...ponto(0, 0)), new THREE.Vector3(...ponto(L, 0))]));
    const eixo = new THREE.Line(gEixo, matEixo.clone());
    guardar(eixo.material as THREE.Material);
    eixo.userData.barra = b.id;
    sub.add(eixo);
    pegaveis.push(eixo);

    // a faixa do MSd (azul até o MRd, vermelho além dele)
    const normal: number[] = [];
    const excesso: number[] = [];
    const quad = (alvo: number[], s0: number, s1: number, a0: number, b0: number, a1: number, b1: number) => {
      // (s0, a0)–(s0, b0)–(s1, b1)–(s1, a1): dois triângulos
      const p = [ponto(s0, a0), ponto(s0, b0), ponto(s1, b1), ponto(s1, a1)];
      alvo.push(...p[0]!, ...p[1]!, ...p[2]!, ...p[0]!, ...p[2]!, ...p[3]!);
    };
    for (let i = 0; i + 1 < b.estacoes.length; i++) {
      const A = b.estacoes[i]!;
      const B = b.estacoes[i + 1]!;
      const ts = pedacos(A, B);
      for (let j = 0; j + 1 < ts.length; j++) {
        const [t0, t1] = [ts[j]!, ts[j + 1]!];
        const meio = (t0 + t1) / 2;
        const m = (t: number) => lerp(A.msd, B.msd, t);
        const r = (t: number) => lerpN(A.mrd, B.mrd, t);
        const q = (t: number) => lerpN(A.mrdOposto, B.mrdOposto, t);
        const s0 = lerp(A.s, B.s, t0);
        const s1 = lerp(A.s, B.s, t1);
        const vm = m(meio);
        const lim = (t: number): number | null => (vm >= 0 ? r(t) : (() => { const x = q(t); return x === null ? null : -x; })());
        const passa = b.semMRd || (lim(meio) !== null && Math.abs(vm) > Math.abs(lim(meio) as number) + 1e-12);
        if (b.semMRd) {
          quad(excesso, s0, s1, 0, m(t0), 0, m(t1));
        } else if (passa) {
          const l0 = lim(t0) as number;
          const l1 = lim(t1) as number;
          quad(normal, s0, s1, 0, l0, 0, l1);
          quad(excesso, s0, s1, l0, m(t0), l1, m(t1));
        } else {
          quad(normal, s0, s1, 0, m(t0), 0, m(t1));
        }
      }
    }
    const fill = matFill();
    for (const [pos, mat] of [[normal, fill], [excesso, matExc()]] as const) {
      if (!pos.length) continue;
      const g = guardar(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const malha = new THREE.Mesh(g, mat);
      malha.userData.barra = b.id;
      malha.renderOrder = mat === fill ? 1 : 2;
      sub.add(malha);
      pegaveis.push(malha);
    }

    // o contorno do MSd: cheio na barra de verdade, tracejado na esquemática
    const gCont = guardar(new THREE.BufferGeometry().setFromPoints(b.estacoes.map((e) => new THREE.Vector3(...ponto(e.s, e.msd)))));
    const contorno = new THREE.Line(gCont, matContorno(b.esquematico));
    if (b.esquematico) contorno.computeLineDistances();
    contorno.renderOrder = 3;
    sub.add(contorno);

    // as linhas do MRd (de cada lado que a conta dimensiona)
    const linhaMrd = (lado: 1 | -1, de: (e: Estacao) => number | null) => {
      const pts = b.estacoes.filter((e) => de(e) !== null).map((e) => new THREE.Vector3(...ponto(e.s, lado * (de(e) as number))));
      if (pts.length < 2) return;
      const l = new THREE.Line(guardar(new THREE.BufferGeometry().setFromPoints(pts)), matMrd);
      l.renderOrder = 4;
      sub.add(l);
    };
    linhaMrd(1, (e) => e.mrd);
    linhaMrd(-1, (e) => e.mrdOposto);

    // os números dos picos
    if (o.valores) {
      for (const p of b.picos) {
        const s = rotulo(numeroBr(Math.abs(p.valor)), p.qual === 'mrd' ? o.cores.mrd : b.semMRd || (p.qual === 'msd' && b.passa === false && Math.abs(p.valor) > 0) ? o.cores.excesso : o.cores.msd, o.cores.fundoDoTexto);
        guardar(s.material);
        if (s.material.map) guardar(s.material.map);
        const sinal = p.valor >= 0 ? 1 : -1;
        const base = ponto(p.s, p.valor);
        // um pouco além da ponta do desenho, do mesmo lado
        s.position.set(base[0] + b.lado[0] * sinal * ALT * 0.12, base[1] + b.lado[1] * sinal * ALT * 0.12, base[2] + b.lado[2] * sinal * ALT * 0.12);
        s.userData.barra = b.id;
        sub.add(s);
        rotulos.push(s);
      }
    }

    grupo.add(sub);
    const bx = new THREE.Box3().setFromObject(sub);
    caixa.union(bx);
    const c = new THREE.Vector3();
    new THREE.Box3().setFromPoints([new THREE.Vector3(...ponto(0, 0)), new THREE.Vector3(...ponto(L, 0))]).getCenter(c);
    porBarra.set(b.id, { eixo, fill, centro: [c.x, c.y, c.z] });
  }

  // o muro em fantasma, por trás de tudo
  if (o.muro) {
    const faces = guardar(new THREE.MeshBasicMaterial({ color: cor(o.cores.fantasma), transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    const arestas = guardar(new THREE.LineBasicMaterial({ color: cor(o.cores.fantasma), transparent: true, opacity: 0.45 }));
    const unitario = guardar(new THREE.BoxGeometry(1, 1, 1));
    const arestasUnit = guardar(new THREE.EdgesGeometry(unitario));
    for (const c of caixasDoMuro(modelo)) {
      const tam = [0, 1, 2].map((i) => Math.max((c.max[i]! - c.min[i]!) * MM, 1e-4)) as Vec3;
      const centro = [0, 1, 2].map((i) => ((c.max[i]! + c.min[i]!) / 2) * MM) as Vec3;
      const f = new THREE.Mesh(unitario, faces);
      f.scale.set(...tam);
      f.position.set(...centro);
      f.renderOrder = -1;
      const a = new THREE.LineSegments(arestasUnit, arestas);
      a.scale.set(...tam);
      a.position.set(...centro);
      grupo.add(f, a);
      caixa.union(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...centro), new THREE.Vector3(...tam)));
    }
  }
  if (caixa.isEmpty()) caixa.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

  const cores = { eixo: cor(o.cores.eixo), destaque: cor(o.cores.destaque), msd: cor(o.cores.msd) };
  return {
    grupo,
    caixa: { min: [caixa.min.x, caixa.min.y, caixa.min.z], max: [caixa.max.x, caixa.max.y, caixa.max.z] },
    pegar: (raio) => {
      const hits = raio.intersectObjects(pegaveis, false);
      for (const h of hits) {
        const id = h.object.userData.barra as string | undefined;
        if (id) return id;
      }
      return null;
    },
    destacar: (sobre, escolhida) => {
      for (const [id, v] of porBarra) {
        const ligado = id === sobre || id === escolhida;
        (v.eixo.material as THREE.LineBasicMaterial).color.copy(ligado ? cores.destaque : cores.eixo);
        (v.eixo.material as THREE.LineBasicMaterial).opacity = ligado ? 1 : 0.9;
        v.fill.opacity = id === escolhida ? 0.55 : id === sobre ? 0.45 : 0.32;
      }
    },
    tamanhoDaLetra: (h) => {
      for (const s of rotulos) s.scale.set(h * (s.userData.proporcao as number), h, 1);
    },
    centroDe: (id) => porBarra.get(id)?.centro ?? null,
    dispose: () => {
      for (const d of descartar) d.dispose();
      grupo.clear();
    },
  };
}
