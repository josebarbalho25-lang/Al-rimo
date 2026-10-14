// ═══════════════════════════════════════════════════════════════════════════
//  visor/pontoDeVista.ts — o ponto de vista do 3D guardado com a foto da prancha
// ---------------------------------------------------------------------------
//  A prancha é VIVA (Jose, 14/10): mudou a conta, o desenho acompanha — e o 3D
//  também, refeito do MESMO ponto de vista. Para isso a foto vai para a prancha
//  com o `Camera3d` (pranchas/tipos.ts): onde a câmera está, para onde olha,
//  quanto do muro cabe na foto, e o estado do visor naquela hora (estilo,
//  Armadura, corte, o que estava oculto). Aqui: ler isso do visor e, do outro
//  lado, montar a câmera do three que olha igual (a foto refeita é
//  `fotoRefeita.ts`).
//
//  ⚠️ O ZOOM GUARDADO NÃO É O ZOOM DA TELA. Na câmera ortográfica do r3f o
//  zoom é "pixels de tela por metro": o mesmo número numa foto do dobro do
//  tamanho mostraria o dobro do muro. A prancha pede a foto no tamanho do papel,
//  que não é o da janela; então o que se guarda é o ENQUADRAMENTO, que não
//  depende de pixel:
//      zoom = 1 ÷ (altura visível da foto, em metro)
//  (o "1 alt. de foto por metro"; a largura vem da proporção). Na perspectiva,
//  o `fov` é o ângulo vertical de verdade (o zoom do three já embutido). Os dois
//  campos saem sempre preenchidos e coerentes entre si: na ortográfica, o `fov`
//  é o da perspectiva que, do mesmo lugar, veria a mesma altura no alvo.
//
//  ⚠️ O "CIMA" GUARDADO É O CIMA DA FOTO (o eixo Y da câmera no mundo), não o
//  `camera.up` (que no visor é sempre o Z). Com ele, o `lookAt` refaz a
//  orientação exata, sem depender de como a câmera chegou lá (voo, órbita no
//  Shift, cubo).
//
//  Puro (three sem WebGL, sem DOM): é testado no Node.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { ehEstiloVisual, ESTILO_PADRAO, type EstiloVisual } from './estiloVisual';
import { CATEGORIAS, type Categoria } from './lotes';
import type { Caixa } from './perfil3d';

/** O estado do visor que entra na foto (além da câmera). */
export interface EstadoDaFoto {
  estilo: EstiloVisual;
  armadura: boolean;
  /** Corte ligado: o x do plano, em METRO (o do visor). Desligado: null. */
  corte: number | null;
  ocultas: Iterable<Categoria>;
}

/** Distância ao alvo quando não há alvo à frente da câmera (não muda o que a ortográfica vê). */
const DISTANCIA_DE_RESERVA = 10;

const vec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
const graus = (rad: number) => (rad * 180) / Math.PI;
const radianos = (g: number) => (g * Math.PI) / 180;

const ehOrtografica = (c: THREE.Camera): c is THREE.OrthographicCamera => (c as THREE.OrthographicCamera).isOrthographicCamera === true;
const ehPerspectiva = (c: THREE.Camera): c is THREE.PerspectiveCamera => (c as THREE.PerspectiveCamera).isPerspectiveCamera === true;

/** Largura ÷ altura do que a câmera vê (a proporção da foto). */
export function proporcaoDaCamera(camera: THREE.Camera): number {
  if (ehOrtografica(camera)) return (camera.right - camera.left) / (camera.top - camera.bottom);
  if (ehPerspectiva(camera)) return camera.aspect;
  return 1;
}

/**
 * Lê o ponto de vista de uma câmera do three. `alvo` = o alvo dos controles
 * (o ponto em volta do qual se navega); ele é levado para o eixo de visada (o
 * que a câmera mira de fato). `estado` = o resto do visor naquela hora.
 */
export function lerPontoDeVista(camera: THREE.Camera, alvo: THREE.Vector3 | null, estado: EstadoDaFoto): Camera3d {
  // No mundo (no visor a câmera é solta na cena, mas quem chama de outro lugar pode tê-la pendurada num grupo).
  const pos = camera.getWorldPosition(new THREE.Vector3());
  const giro = camera.getWorldQuaternion(new THREE.Quaternion());
  const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(giro).normalize();
  const cima = new THREE.Vector3(0, 1, 0).applyQuaternion(giro).normalize();
  const d0 = alvo ? alvo.clone().sub(pos).dot(frente) : NaN;
  const d = d0 > 1e-6 ? d0 : DISTANCIA_DE_RESERVA;
  const mira = pos.clone().addScaledVector(frente, d);

  // A altura visível NO ALVO, em metro: é ela que fica igual em qualquer tamanho de foto.
  let altura: number;
  let fov: number;
  if (ehPerspectiva(camera)) {
    const meio = Math.atan(Math.tan(radianos(camera.fov) / 2) / (camera.zoom || 1));
    altura = 2 * d * Math.tan(meio);
    fov = graus(2 * meio);
  } else if (ehOrtografica(camera)) {
    altura = (camera.top - camera.bottom) / (camera.zoom || 1);
    fov = graus(2 * Math.atan(altura / 2 / d));
  } else {
    altura = 1;
    fov = 50;
  }

  const ocultas = new Set(estado.ocultas);
  return {
    posicao: vec(pos),
    alvo: vec(mira),
    cima: vec(cima),
    ortografica: !ehPerspectiva(camera),
    zoom: 1 / altura,
    fov,
    estilo: estado.estilo,
    armadura: estado.armadura,
    // O contrato guarda o corte em mm (como o resto do modelo); o visor mexe em metro. Arredondado ao milésimo de
    // mm: o arquivo não ganha "1100.0000000000002" de herança do ponto flutuante.
    corteX: estado.corte === null ? null : Math.round(estado.corte * 1e6) / 1e3,
    // Na ordem da lista do visor: o mesmo estado dá sempre o mesmo texto no arquivo.
    ocultas: CATEGORIAS.filter((c) => ocultas.has(c.id)).map((c) => c.id),
  };
}

/** O estado do visor guardado no ponto de vista, conferido (o arquivo pode vir de outra versão do app). */
export function estadoDoPontoDeVista(c: Camera3d): { estilo: EstiloVisual; armadura: boolean; corte: number | null; ocultas: Set<Categoria> } {
  const validas = new Set<string>(CATEGORIAS.map((k) => k.id));
  return {
    estilo: ehEstiloVisual(c.estilo) ? c.estilo : ESTILO_PADRAO,
    armadura: c.armadura === true,
    corte: typeof c.corteX === 'number' && Number.isFinite(c.corteX) ? c.corteX / 1000 : null,
    ocultas: new Set((c.ocultas ?? []).filter((x): x is Categoria => validas.has(x))),
  };
}

const finito = (v: readonly number[] | undefined): v is Vec3 => !!v && v.length === 3 && v.every(Number.isFinite);

/**
 * A câmera do three que olha como o ponto de vista guardado, numa foto de
 * proporção `proporcao` (largura ÷ altura). A altura visível no alvo é a
 * guardada; a largura acompanha a proporção. `caixa` (metro) = o que tem de
 * caber na profundidade (sem ela, uma folga em volta do alvo).
 */
export function cameraDoPontoDeVista(c: Camera3d, proporcao: number, caixa?: Caixa): THREE.OrthographicCamera | THREE.PerspectiveCamera {
  const prop = proporcao > 0 && Number.isFinite(proporcao) ? proporcao : 1;
  const pos = finito(c.posicao) ? new THREE.Vector3(...c.posicao) : new THREE.Vector3(20, -20, 17);
  let alvo = finito(c.alvo) ? new THREE.Vector3(...c.alvo) : new THREE.Vector3();
  if (alvo.distanceTo(pos) < 1e-9) alvo = pos.clone().add(new THREE.Vector3(0, DISTANCIA_DE_RESERVA, 0));
  const frente = alvo.clone().sub(pos).normalize();
  // O cima não pode ser paralelo à visada (o lookAt não tem solução): aí vale o Z, ou o Y se olhar na vertical.
  const serve = (v: THREE.Vector3) => v.lengthSq() > 1e-12 && Math.abs(v.clone().normalize().dot(frente)) < 0.999999;
  const cima = finito(c.cima) ? new THREE.Vector3(...c.cima) : new THREE.Vector3();
  if (!serve(cima)) cima.set(0, 0, 1);
  if (!serve(cima)) cima.set(0, 1, 0);
  cima.normalize();

  // A profundidade: tudo o que está na caixa, de qualquer lado da câmera (como o recorte folgado do visor).
  const centro = caixa ? new THREE.Vector3((caixa.min[0] + caixa.max[0]) / 2, (caixa.min[1] + caixa.max[1]) / 2, (caixa.min[2] + caixa.max[2]) / 2) : alvo;
  const raio = caixa ? Math.hypot(caixa.max[0] - caixa.min[0], caixa.max[1] - caixa.min[1], caixa.max[2] - caixa.min[2]) / 2 : DISTANCIA_DE_RESERVA;
  const longe = pos.distanceTo(centro) + raio + 1;

  let cam: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  if (c.ortografica) {
    // Quadro de altura 1: com zoom = 1 ÷ altura visível, a câmera vê exatamente a altura guardada.
    const meiaLargura = prop / 2;
    cam = new THREE.OrthographicCamera(-meiaLargura, meiaLargura, 0.5, -0.5, -longe, longe);
    cam.zoom = c.zoom > 0 && Number.isFinite(c.zoom) ? c.zoom : 1 / DISTANCIA_DE_RESERVA;
  } else {
    const fov = c.fov > 0 && c.fov < 179 ? c.fov : 50;
    const perto = Math.max(0.01, pos.distanceTo(centro) - raio - 1);
    cam = new THREE.PerspectiveCamera(fov, prop, perto, Math.max(longe, perto * 2));
  }
  cam.up.copy(cima);
  cam.position.copy(pos);
  cam.lookAt(alvo);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return cam;
}
