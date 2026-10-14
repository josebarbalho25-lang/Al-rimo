/*
  O PONTO DE VISTA DA FOTO DA PRANCHA — ler do visor, montar a câmera de novo, e a foto refeita ver o muro no MESMO
  lugar da tela. A prova que importa é a da projeção: cada ponto do muro cai no mesmo lugar da foto (coordenada
  normalizada), seja qual for o tamanho em pixels.
*/
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { girarEmTorno } from './pivoDaCamera';
import { cameraDoPontoDeVista, estadoDoPontoDeVista, lerPontoDeVista, proporcaoDaCamera, type EstadoDaFoto } from './pontoDeVista';

/** A câmera como o r3f monta a do visor: ortográfica, quadro = tamanho da tela em px, zoom em px por metro, Z para cima. */
function cameraDoVisor(largura: number, altura: number, zoom: number, pos: Vec3, alvo: Vec3): THREE.OrthographicCamera {
  const c = new THREE.OrthographicCamera(-largura / 2, largura / 2, altura / 2, -altura / 2, -5000, 5000);
  c.zoom = zoom;
  c.up.set(0, 0, 1);
  c.position.set(...pos);
  c.lookAt(...alvo);
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return c;
}

const estado: EstadoDaFoto = { estilo: 'opaco', armadura: true, corte: 1.1, ocultas: ['terreno', 'blocos'] };

/** Pontos espalhados pelo muro (metro). */
const PONTOS: Vec3[] = [
  [0, 0, 0],
  [3, 0.5, 1.2],
  [6, 0.9, -0.3],
  [1.5, -0.2, 2.4],
  [4.2, 0.14, 0.6],
];
const naFoto = (cam: THREE.Camera, p: Vec3) => new THREE.Vector3(...p).project(cam);

function mesmoPontoDeVista(a: Camera3d, b: Camera3d) {
  for (const k of ['posicao', 'alvo', 'cima'] as const) for (let i = 0; i < 3; i++) expect(b[k][i]).toBeCloseTo(a[k][i]!, 9);
  expect(b.zoom).toBeCloseTo(a.zoom, 12);
  expect(b.fov).toBeCloseTo(a.fov, 9);
  expect(b.ortografica).toBe(a.ortografica);
  expect({ ...b, posicao: 0, alvo: 0, cima: 0, zoom: 0, fov: 0 }).toEqual({ ...a, posicao: 0, alvo: 0, cima: 0, zoom: 0, fov: 0 });
}

describe('ponto de vista da foto (Camera3d)', () => {
  const tela = cameraDoVisor(800, 600, 40, [20, -20, 17], [2, 0.5, 1]);
  const alvo = new THREE.Vector3(2, 0.5, 1);

  it('ida e volta: ler → montar a câmera → ler de novo dá o mesmo ponto de vista', () => {
    const c1 = lerPontoDeVista(tela, alvo, estado);
    const cam = cameraDoPontoDeVista(c1, proporcaoDaCamera(tela));
    const c2 = lerPontoDeVista(cam, new THREE.Vector3(...c1.alvo), estado);
    mesmoPontoDeVista(c1, c2);
    // e a orientação da câmera montada é a da tela
    expect(cam.quaternion.angleTo(tela.quaternion)).toBeLessThan(1e-9);
  });

  it('a foto refeita vê cada ponto do muro no mesmo lugar da tela', () => {
    const c = lerPontoDeVista(tela, alvo, estado);
    const cam = cameraDoPontoDeVista(c, proporcaoDaCamera(tela));
    for (const p of PONTOS) {
      const a = naFoto(tela, p);
      const b = naFoto(cam, p);
      expect(b.x).toBeCloseTo(a.x, 9);
      expect(b.y).toBeCloseTo(a.y, 9);
    }
  });

  it('o zoom guardado é 1 ÷ altura visível: a tela de 600 px a 40 px/m vê 15 m de altura; proporção 4:3', () => {
    const c = lerPontoDeVista(tela, alvo, estado);
    expect(c.zoom).toBeCloseTo(1 / 15, 12);
    expect(proporcaoDaCamera(tela)).toBeCloseTo(4 / 3, 12);
    // o fov da ortográfica é o da perspectiva que, do mesmo lugar, vê os mesmos 15 m no alvo
    const d = new THREE.Vector3(20, -20, 17).distanceTo(alvo);
    expect(c.fov).toBeCloseTo((2 * Math.atan(7.5 / d) * 180) / Math.PI, 9);
  });

  it('a tela do dobro do tamanho com o mesmo enquadramento guarda o mesmo ponto de vista (não guarda pixel)', () => {
    const grande = cameraDoVisor(1600, 1200, 80, [20, -20, 17], [2, 0.5, 1]);
    mesmoPontoDeVista(lerPontoDeVista(tela, alvo, estado), lerPontoDeVista(grande, alvo, estado));
  });

  it('depois da órbita no Shift (alvo fora do eixo), o alvo vai para o eixo e a orientação se mantém', () => {
    const cam = cameraDoVisor(800, 600, 40, [20, -20, 17], [2, 0.5, 1]);
    girarEmTorno(cam, new THREE.Vector3(5, 0.3, 0.4), 140, -60);
    // o alvo dos controles ficou onde estava: fora da visada nova
    const c = lerPontoDeVista(cam, alvo, estado);
    const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const paraOAlvo = new THREE.Vector3(...c.alvo).sub(cam.position).normalize();
    expect(paraOAlvo.angleTo(frente)).toBeLessThan(1e-9);
    const refeita = cameraDoPontoDeVista(c, proporcaoDaCamera(cam));
    expect(refeita.quaternion.angleTo(cam.quaternion)).toBeLessThan(1e-7);
    for (const p of PONTOS) {
      expect(naFoto(refeita, p).x).toBeCloseTo(naFoto(cam, p).x, 7);
      expect(naFoto(refeita, p).y).toBeCloseTo(naFoto(cam, p).y, 7);
    }
  });

  it('perspectiva: o zoom do three entra no fov, e a foto vê igual', () => {
    const cam = new THREE.PerspectiveCamera(50, 1.6, 0.1, 500);
    cam.zoom = 1.5;
    cam.up.set(0, 0, 1);
    cam.position.set(9, -12, 6);
    cam.lookAt(2, 0.4, 1);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const c = lerPontoDeVista(cam, new THREE.Vector3(2, 0.4, 1), estado);
    expect(c.ortografica).toBe(false);
    expect(c.fov).toBeCloseTo((2 * Math.atan(Math.tan((25 * Math.PI) / 180) / 1.5) * 180) / Math.PI, 9);
    const refeita = cameraDoPontoDeVista(c, proporcaoDaCamera(cam));
    expect(refeita).toBeInstanceOf(THREE.PerspectiveCamera);
    for (const p of PONTOS) {
      expect(naFoto(refeita, p).x).toBeCloseTo(naFoto(cam, p).x, 9);
      expect(naFoto(refeita, p).y).toBeCloseTo(naFoto(cam, p).y, 9);
    }
    mesmoPontoDeVista(c, lerPontoDeVista(refeita, new THREE.Vector3(...c.alvo), estado));
  });

  it('o estado do visor: corte em mm (o visor mexe em metro), ocultas na ordem da lista; conferido na volta', () => {
    const c = lerPontoDeVista(tela, alvo, estado);
    expect(c.estilo).toBe('opaco');
    expect(c.armadura).toBe(true);
    expect(c.corteX).toBe(1100);
    expect(c.ocultas).toEqual(['blocos', 'terreno']);
    const volta = estadoDoPontoDeVista(c);
    expect(volta.corte).toBeCloseTo(1.1, 12);
    expect([...volta.ocultas]).toEqual(['blocos', 'terreno']);
    expect(lerPontoDeVista(tela, alvo, { ...estado, corte: null }).corteX).toBeNull();
    // arquivo de outra versão: estilo que não existe → o padrão; grupo que não existe → ignorado
    const estranho = estadoDoPontoDeVista({ ...c, estilo: 'aquarela' as never, ocultas: ['xpto', 'graute'], corteX: Number.NaN });
    expect(estranho.estilo).toBe('cores');
    expect([...estranho.ocultas]).toEqual(['graute']);
    expect(estranho.corte).toBeNull();
  });

  it('ponto de vista estragado não derruba a câmera (cima paralelo à visada, alvo em cima da câmera)', () => {
    const base = lerPontoDeVista(tela, alvo, estado);
    for (const ruim of [
      { ...base, posicao: [0, 0, 10] as Vec3, alvo: [0, 0, 0] as Vec3, cima: [0, 0, 1] as Vec3 },
      { ...base, alvo: base.posicao },
      { ...base, zoom: 0, cima: [0, 0, 0] as Vec3 },
    ]) {
      const cam = cameraDoPontoDeVista(ruim, 1.5);
      expect(cam.matrixWorld.elements.every(Number.isFinite)).toBe(true);
      expect(cam.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    }
  });

  it('a profundidade da câmera montada cobre a caixa inteira, de qualquer lado', () => {
    const c = lerPontoDeVista(tela, alvo, estado);
    const caixa = { min: [-1, -2, -0.5] as Vec3, max: [30, 3, 4] as Vec3 };
    const cam = cameraDoPontoDeVista(c, 4 / 3, caixa) as THREE.OrthographicCamera;
    const inv = cam.matrixWorldInverse;
    for (let k = 0; k < 8; k++) {
      const p = new THREE.Vector3(k & 1 ? caixa.max[0] : caixa.min[0], k & 2 ? caixa.max[1] : caixa.min[1], k & 4 ? caixa.max[2] : caixa.min[2]).applyMatrix4(inv);
      // a câmera olha para −z: está no recorte se near ≤ −z ≤ far
      expect(-p.z).toBeGreaterThanOrEqual(cam.near);
      expect(-p.z).toBeLessThanOrEqual(cam.far);
    }
  });
});
