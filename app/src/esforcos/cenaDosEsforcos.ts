/*
  A CENA DOS ESFORÇOS em three — o desenho das barras analíticas (barrasAnaliticas.ts) para a tela e para a foto da
  prancha (os dois montam por aqui, só muda a paleta).

  A linguagem é a do gráfico de As do Pró-Viga (dimensionamento.jsx, AsChart), que o Jose mostrou (15/11: "o
  solicitante de uma cor e o resistente englobando ele"): deitado no plano de flexão de cada barra, do eixo para a face,
    · o COLOCADO em verde, ao fundo (as barras do modelo, com as rampas de ancoragem e os traspasses);
    · o NECESSÁRIO em vermelho por cima — o verde só "vaza" onde há folga;
    · onde o vermelho passa do verde, vermelho forte (e o trecho "não resiste" da planilha, vermelho forte cheio);
    · o contorno tracejado de cada posição (N) que entra no colocado, do começo ao fim dela;
    · a linha tracejada do mínimo (As,mín) na face que ele vale;
    · as duas faces nos dois lados do eixo (cada uma do lado dela).
  Barra esquemática (só os picos são da conta): o contorno do vermelho e do verde tracejado — o traço diz, sem texto.
  A escala (as linhas de 1/3, 2/3 e o máximo, com o valor) só aparece na barra escolhida ou com o mouse em cima: com
  todas ao mesmo tempo ninguém leria nada.

  A ESCALA DO DESENHO: "Aproveitamento" põe o colocado de toda barra na mesma altura (o vermelho lê necessário ÷
  colocado); "Valor" dá a mesma escala às barras da mesma unidade (cm²/m com cm²/m, cm² com cm²).

  Metros na cena (como o visor 3D: a câmera ortográfica do r3f tem zoom em pixels por metro); o modelo é em mm.
*/
import * as THREE from 'three';
import type { Modelo, Vec3 } from '@/modelo/tipos';
import { caixaGlobal } from '@/modulacao/perfis';
import type { Caixa } from '@/visor/perfil3d';
import type { PaletaVisor } from '@/visor/tema3d';
import { areasDaFace } from './areas';
import { diagramaDe, type BarraAnalitica, type Diagrama, type FaceDoDiagrama, type ModoDosEsforcos, type PontoDoDiagrama } from './tipos';

export type EscalaDosEsforcos = 'aproveitamento' | 'valor';

export interface CoresDosEsforcos {
  eixo: string;
  colocado: string;
  necessario: string;
  excesso: string;
  fantasma: string;
  texto: string;
  fundoDoTexto: string;
  destaque: string;
  /** Opacidade das áreas: no fundo escuro elas precisam de mais corpo (o "pesar a mão" do Jose no Pró-Viga). */
  opColocado: number;
  opNecessario: number;
}

/**
 * A chave do tamanho do muro: muda quando o muro muda de forma (tipo, trechos, altura, sapata, contrafortes, muro de
 * cima) e NÃO quando só os números da conta mudam — é ela que decide reenquadrar.
 */
export function chaveDoEnquadramento(m: Modelo): string {
  const d = m.dims;
  const mm = (v: number) => Math.round(v);
  return JSON.stringify([
    d.trechos.map((t) => [mm(t.x0), mm(t.x1)]), mm(d.H_muro), [mm(d.sapata.y0), mm(d.sapata.y1), mm(d.sapata.z0), mm(d.sapata.z1)],
    d.contrafortes.length, d.muroDeCima ? [mm(d.muroDeCima.z0), mm(d.muroDeCima.z1)] : null,
  ]);
}

const escuro = (hex: string): boolean => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.4;
};

/** As cores da tela, dos tokens do tema: verde e vermelho os de "ok" e "erro" do app. */
export function coresDaTela(p: PaletaVisor, tema: (nome: string, reserva: string) => string): CoresDosEsforcos {
  const e = escuro(p.fundo);
  return {
    eixo: p.tinta,
    colocado: tema('--ok', '#2f9e4a'),
    necessario: tema('--err', '#d64545'),
    excesso: tema('--err', '#d64545'),
    fantasma: tema('--muted', '#969aa8'),
    texto: p.tinta,
    fundoDoTexto: p.fundo,
    destaque: p.enfase,
    opColocado: e ? 0.42 : 0.3,
    opNecessario: e ? 0.6 : 0.52,
  };
}

/** As cores da prancha: papel branco, as tintas do gráfico do Pró-Viga, em qualquer tema. */
export const CORES_DO_PAPEL: CoresDosEsforcos = {
  eixo: '#1b1d22',
  colocado: '#3f8a5c',
  necessario: '#b0566a',
  excesso: '#c62828',
  fantasma: '#8a8d96',
  texto: '#1b1d22',
  fundoDoTexto: '#ffffff',
  destaque: '#1b1d22',
  opColocado: 0.3,
  opNecessario: 0.55,
};

export interface OpcoesDaCena {
  modo: ModoDosEsforcos;
  escala: EscalaDosEsforcos;
  valores: boolean;
  muro: boolean;
  cores: CoresDosEsforcos;
}

export interface CenaDosEsforcos {
  grupo: THREE.Group;
  /** A caixa de tudo o que está desenhado, metro (o enquadrar usa). */
  caixa: Caixa;
  /** O id da barra que o raio pega primeiro (eixo ou área), ou null. */
  pegar: (raio: THREE.Raycaster) => string | null;
  /** Acende a barra com o mouse por cima e a escolhida, e mostra a escala delas. */
  destacar: (sobre: string | null, escolhida: string | null) => void;
  /** Os números ficam do mesmo tamanho na tela em qualquer zoom: altura da letra em metro. */
  tamanhoDaLetra: (metros: number) => void;
  /**
   * Os números que se encobririam na tela: fica o de mais prioridade e o outro se apaga (volta quando o mouse passa
   * na barra dele, que sobe para o topo da fila). Ordem fixa: a barra escolhida, a do mouse, depois o maior
   * aproveitamento, o necessário antes do colocado, e a ordem de montagem — o mesmo quadro sempre dá o mesmo resultado.
   */
  arrumarRotulos: (camera: THREE.Camera, larguraPx: number, alturaPx: number, letraMetros: number, primeiros: (string | null)[]) => void;
  centroDe: (id: string) => Vec3 | null;
  dispose: () => void;
}

const MM = 0.001;
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Número com vírgula e duas casas ("8,70"). */
export const numeroBr = (v: number, casas = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);

const maxDe = (ps: readonly PontoDoDiagrama[]) => ps.reduce((m, p) => Math.max(m, p.v), 0);

/** A referência de cada barra: o valor que vira a altura cheia do desenho. */
function referencias(barras: BarraAnalitica[], modo: ModoDosEsforcos, escala: EscalaDosEsforcos): Map<string, number> {
  const topo = (d: Diagrama, comNec: boolean) =>
    d.faces.reduce((m, f) => Math.max(m, maxDe(f.colocado), comNec ? Math.max(maxDe(f.necessario), f.minimo ?? 0) : 0), 0);
  const out = new Map<string, number>();
  if (escala === 'aproveitamento') {
    for (const b of barras) {
      const d = diagramaDe(b, modo);
      out.set(b.id, d ? topo(d, false) || topo(d, true) || 1 : 1);
    }
    return out;
  }
  const porUnidade = new Map<string, number>();
  for (const b of barras) {
    const d = diagramaDe(b, modo);
    if (d) porUnidade.set(d.unidade, Math.max(porUnidade.get(d.unidade) ?? 0, topo(d, true)));
  }
  for (const b of barras) {
    const d = diagramaDe(b, modo);
    out.set(b.id, (d && porUnidade.get(d.unidade)) || 1);
  }
  return out;
}

function rotulo(texto: string, cor: string, fundo: string): THREE.Sprite {
  const px = 64;
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g = cv?.getContext('2d') ?? null;
  if (cv && g) {
    g.font = `600 ${px}px Segoe UI, system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(texto).width) + px * 0.5;
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

/**
 * A sapata no fantasma com a seção dela (e o DENTE embaixo, quando há): a caixa da sapata com dente era a envoltória,
 * um bloco da largura toda até o fundo do dente. Prisma ao longo de X, o perfil no plano (Y, Z) — o da modulação.
 */
export function sapatasDoMuro(m: Modelo): { contorno: [number, number][]; origem: Vec3; extensao: number }[] {
  const out: { contorno: [number, number][]; origem: Vec3; extensao: number }[] = [];
  for (const p of m.pecas) {
    if (p.tipo !== 'SAPATA' || p.giro) continue;
    const g = m.geometrias[p.geometria];
    if (!g || g.eixo !== 'X' || g.perfil.contorno.length < 3) continue;
    out.push({ contorno: g.perfil.contorno.map(([u, v]) => [u, v]), origem: p.origem, extensao: g.extensao });
  }
  return out;
}

/** O muro em fantasma: as caixas das peças grandes (parede por trecho, contrafortes, pilaretes, cintas, muro de cima). */
export function caixasDoMuro(m: Modelo): Caixa[] {
  const caixas: Caixa[] = [];
  const t = m.familia.t;
  for (const tr of m.dims.trechos) caixas.push({ min: [tr.x0, 0, 0], max: [tr.x1, t, m.dims.H_muro] });
  const juntar = new Map<string, Caixa>();
  for (const p of m.pecas) {
    // a sapata de perfil reto vai pela seção dela (sapatasDoMuro); a girada, que não há hoje, ficaria pela caixa
    const sapataPelaSecao = p.tipo === 'SAPATA' && !p.giro && m.geometrias[p.geometria]?.eixo === 'X';
    const chave = p.grupo === 'contraforte' ? `cf${p.trecho}.${p.contraforte}` : (p.tipo === 'SAPATA' && !sapataPelaSecao) || p.tipo === 'PILARETE' || p.tipo === 'CINTA_MC' ? `${p.tipo}.${p.id}` : null;
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
  const ref = referencias(barras, o.modo, o.escala);
  const C = o.cores;

  const matEixo = guardar(new THREE.LineBasicMaterial({ color: cor(C.eixo), transparent: true, opacity: 0.9 }));
  const matEixoVazio = guardar(new THREE.LineBasicMaterial({ color: cor(C.eixo), transparent: true, opacity: 0.25 }));
  const area = (c: string, op: number, ordem: number) => {
    const m = guardar(new THREE.MeshBasicMaterial({ color: cor(c), transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    m.userData.ordem = ordem;
    return m;
  };
  const matNec = area(C.necessario, C.opNecessario, 2);
  const matExc = area(C.excesso, 0.92, 3);
  const linha = (c: string, op: number, tracejado: boolean, traco = 0.05) =>
    guardar(tracejado
      ? new THREE.LineDashedMaterial({ color: cor(c), dashSize: traco, gapSize: traco * 0.7, transparent: true, opacity: op })
      : new THREE.LineBasicMaterial({ color: cor(c), transparent: true, opacity: op }));
  const matBordaCol = linha(C.colocado, 0.95, false);
  const matBordaColTr = linha(C.colocado, 0.95, true);
  const matBordaNec = linha(C.necessario, 0.95, false);
  const matBordaNecTr = linha(C.necessario, 0.95, true);
  const matFamilia = linha(C.colocado, 0.85, true, 0.03);
  const matMinimo = linha(C.necessario, 0.9, true, 0.035);
  const matGrade = linha(C.texto, 0.28, false);

  const pegaveis: THREE.Object3D[] = [];
  const porBarra = new Map<string, { eixo: THREE.Line; col: THREE.MeshBasicMaterial | null; centro: Vec3; escala: () => THREE.Group | null; escalaFeita: THREE.Group | null }>();
  const rotulos: THREE.Sprite[] = [];
  let letraAtual = 0.05;
  const filaDosRotulos: { s: THREE.Sprite; barra: string; chave: [number, number, number] }[] = [];
  const caixa = new THREE.Box3();

  for (const b of barras) {
    const L = Math.hypot(b.ate[0] - b.de[0], b.ate[1] - b.de[1], b.ate[2] - b.de[2]);
    if (!(L > 0)) continue;
    const u: Vec3 = [(b.ate[0] - b.de[0]) / L, (b.ate[1] - b.de[1]) / L, (b.ate[2] - b.de[2]) / L];
    const d = diagramaDe(b, o.modo);
    const k = ALT / (ref.get(b.id) || 1);
    const ponto = (s: number, v: number, f: 1 | -1 = 1): Vec3 => {
      const p = add(b.de, u, s);
      const w = v * k * f;
      return [p[0] * MM + b.lado[0] * w, p[1] * MM + b.lado[1] * w, p[2] * MM + b.lado[2] * w];
    };
    const sub = new THREE.Group();
    sub.userData.barra = b.id;

    // o eixo (sem diagrama neste modo: só o arame, apagado)
    const gEixo = guardar(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...ponto(0, 0)), new THREE.Vector3(...ponto(L, 0))]));
    const eixo = new THREE.Line(gEixo, (d ? matEixo : matEixoVazio).clone());
    guardar(eixo.material as THREE.Material);
    eixo.userData.barra = b.id;
    sub.add(eixo);
    pegaveis.push(eixo);

    let matCol: THREE.MeshBasicMaterial | null = null;
    if (d) {
      matCol = area(C.colocado, C.opColocado, 1);
      const verde: number[] = [];
      const verm: number[] = [];
      const forte: number[] = [];
      const quad = (alvo: number[], f: 1 | -1, s0: number, s1: number, a0: number, b0: number, a1: number, b1: number) => {
        if (!(s1 > s0)) return;
        const p = [ponto(s0, a0, f), ponto(s0, b0, f), ponto(s1, b1, f), ponto(s1, a1, f)];
        alvo.push(...p[0]!, ...p[1]!, ...p[2]!, ...p[0]!, ...p[2]!, ...p[3]!);
      };
      const tracar = (pts: Vec3[], mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial, ordem: number) => {
        if (pts.length < 2) return;
        const l = new THREE.Line(guardar(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)))), mat);
        if (mat instanceof THREE.LineDashedMaterial) l.computeLineDistances();
        l.renderOrder = ordem;
        sub.add(l);
      };
      for (const f of d.faces) desenharFace(f, d, L, quad, tracar, verde, verm, forte, ponto, ref.get(b.id) || 1, {
        bordaCol: d.esquematico ? matBordaColTr : matBordaCol, bordaNec: d.esquematico ? matBordaNecTr : matBordaNec, familia: matFamilia, minimo: matMinimo,
      });
      for (const [pos, mat] of [[verde, matCol], [verm, matNec], [forte, matExc]] as const) {
        if (!pos.length) continue;
        const g = guardar(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const malha = new THREE.Mesh(g, mat);
        malha.userData.barra = b.id;
        malha.renderOrder = mat.userData.ordem as number;
        sub.add(malha);
        pegaveis.push(malha);
      }

      // os números dos picos: necessário (vermelho) e colocado (verde) na seção crítica
      if (o.valores) {
        for (const p of d.picos) {
          if (p.qual === 'min') continue;
          const falha = p.qual === 'nec' && !d.envolve;
          const s = rotulo(numeroBr(p.valor), p.qual === 'col' ? C.colocado : falha ? C.excesso : C.necessario, C.fundoDoTexto);
          guardar(s.material);
          if (s.material.map) guardar(s.material.map);
          const base = ponto(p.s, p.valor, p.face);
          const fora = ALT * (p.qual === 'col' ? 0.14 : 0.06) * p.face;
          // o do colocado um pouco além da ponta do verde; o do necessário dentro, junto do vermelho
          s.position.set(base[0] + b.lado[0] * fora, base[1] + b.lado[1] * fora, base[2] + b.lado[2] * fora);
          s.userData.barra = b.id;
          sub.add(s);
          rotulos.push(s);
          filaDosRotulos.push({ s, barra: b.id, chave: [-(b.aproveitamento ?? -1), p.qual === 'nec' ? 0 : 1, filaDosRotulos.length] });
        }
      }
    }

    grupo.add(sub);
    caixa.union(new THREE.Box3().setFromObject(sub));
    const c = new THREE.Vector3();
    new THREE.Box3().setFromPoints([new THREE.Vector3(...ponto(0, 0)), new THREE.Vector3(...ponto(L, 0))]).getCenter(c);
    // a escala da barra (feita na 1ª vez que ela é escolhida ou tem o mouse em cima)
    const escala = (): THREE.Group | null => {
      if (!d) return null;
      const g = new THREE.Group();
      const refB = ref.get(b.id) || 1;
      for (const f of d.faces) {
        const topo = Math.max(maxDe(f.colocado), maxDe(f.necessario), f.minimo ?? 0);
        if (!(topo > 0)) continue;
        for (let i = 1; i <= 3; i++) {
          const v = (i / 3) * topo;
          const l = new THREE.Line(guardar(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...ponto(0, v, f.face)), new THREE.Vector3(...ponto(L, v, f.face))])), matGrade);
          l.renderOrder = 0;
          g.add(l);
          const sp = rotulo(i === 3 ? `${numeroBr(v)} ${d.unidade}` : numeroBr(v), C.texto, C.fundoDoTexto);
          guardar(sp.material);
          if (sp.material.map) guardar(sp.material.map);
          const p0 = ponto(0, v, f.face);
          // antes do começo da barra, para não cair em cima do desenho
          const recuo = Math.min(ALT * 0.25, (L * MM) * 0.15);
          sp.position.set(p0[0] - u[0] * recuo, p0[1] - u[1] * recuo, p0[2] - u[2] * recuo);
          sp.scale.set(letraAtual * 0.85 * (sp.userData.proporcao as number), letraAtual * 0.85, 1);
          sp.userData.barra = b.id;
          sp.userData.escala = true;
          rotulos.push(sp);
          g.add(sp);
        }
      }
      void refB;
      g.visible = false;
      sub.add(g);
      return g;
    };
    porBarra.set(b.id, { eixo, col: matCol, centro: [c.x, c.y, c.z], escala, escalaFeita: null });
  }

  // o muro em fantasma, por trás de tudo
  if (o.muro) {
    const faces = guardar(new THREE.MeshBasicMaterial({ color: cor(C.fantasma), transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    const arestas = guardar(new THREE.LineBasicMaterial({ color: cor(C.fantasma), transparent: true, opacity: 0.45 }));
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
    for (const sp of sapatasDoMuro(modelo)) {
      const forma = new THREE.Shape(sp.contorno.map(([u, v]) => new THREE.Vector2(u * MM, v * MM)));
      const g = guardar(new THREE.ExtrudeGeometry(forma, { depth: sp.extensao * MM, bevelEnabled: false }));
      // (u, v, w) do perfil → (X, Y, Z) do muro: w ao longo do muro, u = Y, v = Z
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, sp.origem[0] * MM, 1, 0, 0, sp.origem[1] * MM, 0, 1, 0, sp.origem[2] * MM, 0, 0, 0, 1));
      const f = new THREE.Mesh(g, faces);
      f.renderOrder = -1;
      const a = new THREE.LineSegments(guardar(new THREE.EdgesGeometry(g, 30)), arestas);
      grupo.add(f, a);
      g.computeBoundingBox();
      if (g.boundingBox) caixa.union(g.boundingBox);
    }
  }
  if (caixa.isEmpty()) caixa.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

  const cores = { eixo: cor(C.eixo), destaque: cor(C.destaque) };
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
        if (v.col) v.col.opacity = id === escolhida ? Math.min(0.75, C.opColocado * 1.6) : id === sobre ? Math.min(0.65, C.opColocado * 1.3) : C.opColocado;
        if (ligado && !v.escalaFeita) v.escalaFeita = v.escala();
        if (v.escalaFeita) v.escalaFeita.visible = ligado;
      }
    },
    tamanhoDaLetra: (h) => {
      letraAtual = h;
      for (const s of rotulos) {
        const k = s.userData.escala ? 0.85 : 1;
        s.scale.set(h * k * (s.userData.proporcao as number), h * k, 1);
      }
    },
    arrumarRotulos: (camera, W, H, letra, primeiros) => {
      if (!filaDosRotulos.length || !(W > 0) || !(H > 0)) return;
      camera.updateMatrixWorld();
      const cima = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(letra);
      const px = (v: THREE.Vector3) => {
        const q = v.clone().project(camera);
        return [((q.x + 1) / 2) * W, ((1 - q.y) / 2) * H] as const;
      };
      const ordem = (barra: string) => {
        const i = primeiros.indexOf(barra);
        return i < 0 ? primeiros.length : i;
      };
      const fila = [...filaDosRotulos].sort((a, b) => ordem(a.barra) - ordem(b.barra) || a.chave[0] - b.chave[0] || a.chave[1] - b.chave[1] || a.chave[2] - b.chave[2]);
      const postos: [number, number, number, number][] = [];
      const FOLGA = 2;
      for (const r of fila) {
        const [cx, cy] = px(r.s.position);
        const [, cy2] = px(r.s.position.clone().add(cima));
        const h = Math.abs(cy - cy2);
        const w = h * (r.s.userData.proporcao as number);
        const cx4: [number, number, number, number] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        const bate = postos.some((q) => cx4[0] < q[2] + FOLGA && cx4[2] > q[0] - FOLGA && cx4[1] < q[3] + FOLGA && cx4[3] > q[1] - FOLGA);
        r.s.visible = !bate;
        if (!bate) postos.push(cx4);
      }
    },
    centroDe: (id) => porBarra.get(id)?.centro ?? null,
    dispose: () => {
      for (const x of descartar) x.dispose();
      grupo.clear();
    },
  };
}

/** Uma face: as áreas (areas.ts, as mesmas da memória) e as linhas (bordas, posições, mínimo). */
function desenharFace(
  f: FaceDoDiagrama,
  d: Diagrama,
  L: number,
  quad: (alvo: number[], f: 1 | -1, s0: number, s1: number, a0: number, b0: number, a1: number, b1: number) => void,
  tracar: (pts: Vec3[], mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial, ordem: number) => void,
  verde: number[],
  verm: number[],
  forte: number[],
  ponto: (s: number, v: number, f?: 1 | -1) => Vec3,
  refB: number,
  mats: { bordaCol: THREE.LineBasicMaterial | THREE.LineDashedMaterial; bordaNec: THREE.LineBasicMaterial | THREE.LineDashedMaterial; familia: THREE.LineDashedMaterial | THREE.LineBasicMaterial; minimo: THREE.LineDashedMaterial | THREE.LineBasicMaterial },
): void {
  const F = f.face;
  for (const t of areasDaFace(f, L, d.fimLivre, refB)) quad(t.tipo === 'colocado' ? verde : t.tipo === 'necessario' ? verm : forte, F, t.s0, t.s1, t.a0, t.b0, t.a1, t.b1);
  if (f.colocado.length) tracar(f.colocado.map((p) => ponto(p.s, p.v, F)), mats.bordaCol, 4);
  if (f.necessario.length) tracar(f.necessario.map((p) => ponto(p.s, p.v, F)), mats.bordaNec, 5);
  // o contorno de cada posição (N), do começo ao fim dela, na altura dela
  for (const fam of f.familias) {
    tracar([ponto(fam.s0, 0, F), ponto(fam.s0, fam.v, F), ponto(fam.s1, fam.v, F), ponto(fam.s1, 0, F)], mats.familia, 4);
  }
  // o mínimo, tracejado, na barra inteira
  if (f.minimo !== null && f.minimo > 0) tracar([ponto(0, f.minimo, F), ponto(L, f.minimo, F)], mats.minimo, 5);
}
