// ═══════════════════════════════════════════════════════════════════════════
//  visor/perfil3d.ts — da Geometria do contrato ao molde do three, e a matriz
//  que assenta cada peça
// ---------------------------------------------------------------------------
//  O bloco do A-PORT (`pecas3d/bloco.js`) extruda um PERFIL COM FUROS e não
//  sabe o que é EPS ou lajota. Aqui é a mesma ideia, mas o perfil e o eixo já
//  vêm prontos da modulação (modelo/tipos.ts → Geometria), em mm. Este arquivo
//  só traduz: perfil → THREE.ExtrudeGeometry com furos, orientada pelo eixo
//  local, em METRO (o three trabalha em metro; o contrato, em mm).
//
//  ⚠️ DUAS LEITURAS DO CONTRATO — nasceram como dedução minha e hoje são a
//  regra escrita da modulação (`modulacao/perfis.ts`, `paraGlobal`), que o
//  IFC e os desenhos também seguem. O visor não importa a modulação (recebe o
//  Modelo pronto), então a conta é refeita aqui em forma de matriz; o
//  `integracao.test.ts` confere, peça por peça e em todos os cenários do
//  gabarito, que a matriz leva cada canto aonde o `paraGlobal` leva:
//   1. EM QUE ORDEM ficam as coordenadas do perfil. O contrato diz "plano
//      local" sem dizer quais eixos. Adotei a ordem natural (tira-se o eixo
//      da extrusão e ficam os outros dois, em ordem): eixo Z → perfil (x, y),
//      a planta do bloco; eixo X → perfil (y, z), a seção da canaleta e da
//      sapata (é o que o brief do IFC usa para a sapata); eixo Y → (x, z).
//      Está num lugar só, `PLANO_DO_PERFIL`.
//   2. `Peca.origem` é o canto mínimo da caixa da peça JÁ GIRADA (o brief da
//      modulação diz "canto mínimo da caixa envolvente"). Assim a origem vale
//      igual para qualquer giro e para perfil com coordenada negativa (o
//      dente da sapata desce abaixo de z = 0 da seção).
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Geometria, Peca, Vec2, Vec3 } from '@/modelo/tipos';

/** mm → m. O modelo é em mm (inteiro onde é módulo); o three, em metro. */
export const MM = 0.001;

type Eixo = Geometria['eixo'];
type Indice = 0 | 1 | 2;

/** Para onde vão (u, v) do perfil e w (a extrusão) no sistema local da peça. Ver o cabeçalho. */
export const PLANO_DO_PERFIL: Record<Eixo, { u: Indice; v: Indice; w: Indice }> = {
  Z: { u: 0, v: 1, w: 2 },
  X: { u: 1, v: 2, w: 0 },
  Y: { u: 0, v: 2, w: 1 },
};

/** Caixa alinhada aos eixos, em mm ou m conforme quem usa. */
export interface Caixa {
  min: Vec3;
  max: Vec3;
}

/** A caixa LOCAL da geometria (antes do giro), em mm. Sai do perfil, sem montar malha. */
export function caixaLocal(g: Geometria): Caixa {
  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const [u, v] of g.perfil.contorno) {
    uMin = Math.min(uMin, u);
    uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v);
    vMax = Math.max(vMax, v);
  }
  if (!Number.isFinite(uMin)) uMin = uMax = vMin = vMax = 0;
  const p = PLANO_DO_PERFIL[g.eixo];
  const min: Vec3 = [0, 0, 0];
  const max: Vec3 = [0, 0, 0];
  min[p.u] = uMin;
  max[p.u] = uMax;
  min[p.v] = vMin;
  max[p.v] = vMax;
  min[p.w] = 0;
  max[p.w] = g.extensao;
  return { min, max };
}

/** Cosseno e seno EXATOS dos quatro giros: Math.cos(π/2) dá 6·10⁻¹⁷ e a junta de 10 mm não precisa de ruído. */
const GIROS: Record<Peca['giro'], [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };

/** Gira (x, y) em torno de Z, anti-horário visto de cima (regra da mão direita). */
function girar(giro: Peca['giro'], x: number, y: number): [number, number] {
  const [c, s] = GIROS[giro] ?? GIROS[0];
  return [c * x - s * y, s * x + c * y];
}

/** O canto mínimo da caixa local depois do giro (mm). É ele que vai parar em `origem`. */
function minimoGirado(giro: Peca['giro'], c: Caixa): [number, number] {
  let mx = Infinity;
  let my = Infinity;
  for (const x of [c.min[0], c.max[0]]) {
    for (const y of [c.min[1], c.max[1]]) {
      const [gx, gy] = girar(giro, x, y);
      mx = Math.min(mx, gx);
      my = Math.min(my, gy);
    }
  }
  return [mx, my];
}

/** A caixa GLOBAL de uma peça, em mm. Serve ao enquadrar, ao pivô do giro e ao teste. */
export function caixaDaPeca(p: Peca, local: Caixa): Caixa {
  const dx = local.max[0] - local.min[0];
  const dy = local.max[1] - local.min[1];
  const deitado = p.giro === 90 || p.giro === 270;
  const [sx, sy] = deitado ? [dy, dx] : [dx, dy];
  const [ox, oy, oz] = p.origem;
  return { min: [ox, oy, oz], max: [ox + sx, oy + sy, oz + (local.max[2] - local.min[2])] };
}

/**
 * A matriz que assenta a peça, em METRO: gira em torno de Z e leva o canto
 * mínimo da caixa girada até `origem`. Escrita direto no array (coluna-maior,
 * o formato do three) para montar 5.000 blocos sem criar 5.000 objetos.
 */
export function escreverMatriz(p: Peca, local: Caixa, destino: Float32Array | number[], deslocamento = 0): void {
  const [c, s] = GIROS[p.giro] ?? GIROS[0];
  const [mx, my] = minimoGirado(p.giro, local);
  const tx = (p.origem[0] - mx) * MM;
  const ty = (p.origem[1] - my) * MM;
  const tz = (p.origem[2] - local.min[2]) * MM;
  const e = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
  for (let k = 0; k < 16; k++) destino[deslocamento + k] = e[k]!;
}

/** Mesma matriz, como objeto (para quem precisa de uma só). */
export function matrizDaPeca(p: Peca, local: Caixa): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const a: number[] = new Array(16);
  escreverMatriz(p, local, a);
  return m.fromArray(a);
}

/** Área com sinal (shoelace): positiva = anti-horário. */
export function areaComSinal(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % n]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Garante o sentido: o contrato pede contorno anti-horário e furo horário, mas errar o sentido do furo é o furo sair tampado. */
function noSentido(pts: readonly Vec2[], antiHorario: boolean): readonly Vec2[] {
  return areaComSinal(pts) > 0 === antiHorario ? pts : [...pts].reverse();
}

/** Inverte a ordem dos vértices de cada triângulo (malha não indexada). Ver `moldeDaGeometria`. */
function inverterFaces(g: THREE.BufferGeometry): void {
  for (const nome of ['position', 'normal']) {
    const a = g.getAttribute(nome) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    for (let i = 0; i + 2 < a.count; i += 3) {
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.getComponent(i + 1, k);
        a.setComponent(i + 1, k, a.getComponent(i + 2, k));
        a.setComponent(i + 2, k, t);
      }
    }
    a.needsUpdate = true;
  }
}

/** Prisma do perfil (u, v) de w = de a w = ate, ainda no plano do three (x, y) e extrudado em z, em metro. */
function extrudar(contorno: readonly Vec2[], furos: readonly Vec2[][], de: number, ate: number): THREE.BufferGeometry {
  const forma = new THREE.Shape(noSentido(contorno, true).map(([u, v]) => new THREE.Vector2(u * MM, v * MM)));
  for (const furo of furos) {
    if (furo.length < 3) continue;
    forma.holes.push(new THREE.Path(noSentido(furo, false).map(([u, v]) => new THREE.Vector2(u * MM, v * MM))));
  }
  const geo = new THREE.ExtrudeGeometry(forma, { depth: (ate - de) * MM, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geo.deleteAttribute('uv');
  if (de) geo.translate(0, 0, de * MM);
  return geo;
}

/** Uma malha só com os triângulos de todas (posição e normal; malhas não indexadas, como a ExtrudeGeometry). */
function juntarMalhas(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const nome of ['position', 'normal']) {
    const arrays = partes.map((p) => (p.getAttribute(nome) as THREE.BufferAttribute).array as Float32Array);
    const tudo = new Float32Array(arrays.reduce((s, a) => s + a.length, 0));
    let k = 0;
    for (const a of arrays) {
      tudo.set(a, k);
      k += a.length;
    }
    out.setAttribute(nome, new THREE.BufferAttribute(tudo, 3));
  }
  for (const p of partes) p.dispose();
  return out;
}

/**
 * As arestas do traço de uma Geometria. Peça em pedaços: as do ENVELOPE (a peça inteira) — as dos pedaços riscariam
 * a face de fora da canaleta em cada ponta de furo, como se fossem peças separadas. O furo do fundo fica escondido
 * pelo graute e pela fiada de baixo; a parede quebrada, pelo graute do T, que tem o traço dele.
 */
export function arestasDaGeometria(g: Geometria, molde: THREE.BufferGeometry): Float32Array {
  if (!g.pedacos?.length) return arestasDoMolde(molde);
  const envelope = moldeDaGeometria({ ...g, pedacos: undefined });
  const a = arestasDoMolde(envelope);
  envelope.dispose();
  return a;
}

/**
 * O MOLDE de uma Geometria: a malha de UMA peça, em metro, no sistema local
 * (antes do giro, origem local do perfil). Todas as peças de mesma chave
 * desenham este molde, cada uma com a sua matriz (InstancedMesh).
 */
export function moldeDaGeometria(g: Geometria): THREE.BufferGeometry {
  // Peça em pedaços (Geometria.pedacos: a canaleta com o fundo furado e a parede quebrada — acrescentado pela
  // modulação, 09/10 noite): a malha é a dos pedaços. Desenhar o envelope punha a parede quebrada e o graute do T no
  // mesmo lugar — as duas faces de cima brigando na tela.
  const geo = g.pedacos?.length
    ? juntarMalhas(g.pedacos.map((q) => extrudar(q.contorno, [], q.de, q.ate)))
    : extrudar(g.perfil.contorno, g.perfil.furos ?? [], 0, g.extensao);

  // A Shape vive em (x, y) e extruda em z: aqui (u, v, w). A troca de eixos
  // leva cada um para o lugar que o `PLANO_DO_PERFIL` manda.
  const p = PLANO_DO_PERFIL[g.eixo];
  const eixo = (i: Indice) => new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  const troca = new THREE.Matrix4().makeBasis(eixo(p.u), eixo(p.v), eixo(p.w));
  geo.applyMatrix4(troca);
  // ⚠️ A troca do eixo Y (x, z, y) é um ESPELHO (determinante −1): as normais
  // giram certo, mas a ordem dos vértices não — a face sairia "do avesso" e a
  // luz a pintaria por dentro. O mesmo aviso do `bloco.js` do A-PORT.
  if (troca.determinant() < 0) inverterFaces(geo);

  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * As ARESTAS do molde, para o traço das peças. 25° separa a quina do bloco
 * (90°) da faceta do furo arredondado (o perfil de meia-lua vem em segmentos
 * de ~15–22°), que riscaria o furo de traço.
 */
export function arestasDoMolde(molde: THREE.BufferGeometry): Float32Array {
  const e = new THREE.EdgesGeometry(molde, 25);
  const pos = (e.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const copia = new Float32Array(pos);
  e.dispose();
  return copia;
}
