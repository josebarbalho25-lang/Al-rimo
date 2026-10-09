// ═══════════════════════════════════════════════════════════════════════════
//  visor/pivoDaCamera.ts — girar em torno do que está selecionado
//  (porte do A-PORT, `visor/pivoDaCamera.ts`, sem o `centroDaSelecao`, que
//  aqui sai da cena: `Cena3D.centroDe`)
// ---------------------------------------------------------------------------
//  O giro é RÍGIDO: a câmera inteira — posição e orientação — roda em volta
//  do ponto P. Como ela gira em bloco, P continua caindo no MESMO PIXEL do
//  começo ao fim do gesto: a peça fica parada na tela e o mundo gira em volta
//  dela. Mudar só o `target` do controle traria a peça para o meio da tela
//  num salto — o "sai voando" que o Jose já reclamou no A-PORT.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';

/** Radianos por pixel de arraste — o mesmo do A-PORT, calibrado na mão dele. */
export const RADIANOS_POR_PIXEL = 0.005;

/**
 * GIRA A CÂMERA EM BLOCO em torno de `p`, pelos deslocamentos do mouse em pixels.
 *
 * ⚠️ O EIXO VERTICAL É O Z DO MUNDO, e não o "cima" da câmera: com o eixo da
 * câmera o muro tomba depois de duas voltas. O eixo horizontal é o da TELA,
 * porque arrastar para cima tem de levantar o que está na frente.
 */
export function girarEmTorno(camera: THREE.Camera, p: THREE.Vector3, dx: number, dy: number, radianosPorPixel = RADIANOS_POR_PIXEL): void {
  const giroZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -dx * radianosPorPixel);
  const direita = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const giroX = new THREE.Quaternion().setFromAxisAngle(direita, -dy * radianosPorPixel);
  const r = giroZ.multiply(giroX);
  camera.position.sub(p).applyQuaternion(r).add(p);
  camera.quaternion.premultiply(r);
  camera.updateMatrixWorld();
}

/**
 * O ALVO REALINHADO no eixo de visada, para devolver ao controle depois do
 * giro. Sem isto o próximo deslocar salta: o controle reorientaria tudo para
 * trazer o alvo antigo ao centro.
 */
export function alvoNoEixo(camera: THREE.Camera, distancia: number): THREE.Vector3 {
  const frente = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  return camera.position.clone().addScaledVector(frente, distancia);
}
