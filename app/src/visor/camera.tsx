// ═══════════════════════════════════════════════════════════════════════════
//  visor/camera.tsx — a câmera do visor: o voo e a órbita no Shift
// ---------------------------------------------------------------------------
//  A convenção é a do palco do A-PORT (`visor/CameraDoPalco.tsx`), que é a do
//  Revit — consistência com o programa dele:
//    roda ................. zoom no cursor
//    botão do meio ........ deslocar, sem inércia
//    Shift + botão do meio  orbitar em volta da peça selecionada (ou do centro)
//    botão esquerdo ....... seleciona (nunca navega)
//  E o direito faz o papel do meio (deslocar; com Shift, orbitar), para quem
//  está num touchpad sem botão do meio — acréscimo do Al-rimo, que é público.
//
//  ⚠️ `frameloop="demand"`: nada se redesenha sozinho. O controle de órbita do
//  drei já pede quadro a cada mudança; o voo e o giro no Shift são nossos e
//  pedem quadro (`invalidate`) a cada passo — sem isso a tela congela no meio
//  do gesto.
// ═══════════════════════════════════════════════════════════════════════════

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import { interpolarDirecao, suave, type Enquadramento } from './enquadrar';
import { alvoNoEixo, girarEmTorno } from './pivoDaCamera';

/** 450 ms: o valor calibrado no Pró-Viga — dá para o olho acompanhar de onde para onde o muro girou. */
export const DURACAO_VOO = 450;

export interface Voo {
  /** De onde parte. Capturado UMA vez no primeiro quadro (interpolar da posição atual faz o começo saltar). */
  de: { direcao: Vec3; alvo: Vec3; zoom: number } | null;
  para: Enquadramento;
  inicio: number;
  /** 0 = pula direto (abrir a tela não é voo). */
  duracao: number;
}

type Controles = { target: THREE.Vector3; update: () => void; enabled: boolean };

/** Recorte de profundidade folgado: a câmera ortográfica não perde peça que fique atrás dela depois de um giro no pivô. */
function ajustarProfundidade(camera: THREE.OrthographicCamera, distancia: number): void {
  const p = distancia * 3 + 10;
  camera.near = -p;
  camera.far = p;
}

/** Leva a câmera ao enquadramento pedido, em voo (ou de uma vez, se a duração for 0). */
export function VooDaCamera({ voo }: { voo: RefObject<Voo | null> }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const controles = useThree((s) => s.controls) as unknown as Controles | null;
  const invalidate = useThree((s) => s.invalidate);

  useFrame(() => {
    const v = voo.current;
    if (!v) return;
    const alvoAtual = controles?.target ?? new THREE.Vector3();
    if (!v.de) {
      const d = camera.position.clone().sub(alvoAtual).normalize();
      v.de = { direcao: [d.x, d.y, d.z], alvo: [alvoAtual.x, alvoAtual.y, alvoAtual.z], zoom: camera.zoom };
      v.inicio = performance.now();
    }
    const t = v.duracao > 0 ? Math.min(1, (performance.now() - v.inicio) / v.duracao) : 1;
    const e = suave(t);
    const dir = interpolarDirecao(v.de.direcao, v.para.direcao, e);
    const alvo = new THREE.Vector3(...v.de.alvo).lerp(new THREE.Vector3(...v.para.alvo), e);
    // Zoom em progressão geométrica: aproximar 10× e afastar 10× levam o mesmo tempo para o olho.
    const zoom = v.de.zoom * Math.pow(v.para.zoom / Math.max(v.de.zoom, 1e-9), e);
    ajustarProfundidade(camera, v.para.distancia);
    camera.position.copy(alvo).addScaledVector(new THREE.Vector3(...dir), v.para.distancia);
    camera.up.set(0, 0, 1);
    camera.lookAt(alvo);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    if (controles) controles.target.copy(alvo);
    if (t >= 1) {
      voo.current = null;
      controles?.update();
    }
    invalidate();
  });
  return null;
}

/*
  A ÓRBITA NO SHIFT — porte do `OrbitaNoShift` do A-PORT.
  ⚠️ O CONTROLE DE ÓRBITA NÃO PODE VER ESTE EVENTO: se vir, gira junto e a
  câmera recebe duas ordens por quadro — o tranco que ele chama de "sai
  desgovernado". Por isso o ouvinte mora na janela, em captura, e o evento
  morre aqui. E SÓ enquanto o botão está apertado: soltar devolve o alvo ao
  eixo de visada e o controle volta a mandar no deslocar e no zoom.
*/
export function OrbitaNoShift({ pivo }: { pivo: () => Vec3 | null }) {
  const camera = useThree((s) => s.camera);
  const tela = useThree((s) => s.gl.domElement);
  const controles = useThree((s) => s.controls) as unknown as Controles | null;
  const invalidate = useThree((s) => s.invalidate);
  // O pivô entra por REF: trocar a seleção não pode reinstalar o ouvinte no meio de um giro.
  const pegarPivo = useRef(pivo);
  pegarPivo.current = pivo;

  useEffect(() => {
    if (!controles) return;
    let centro: THREE.Vector3 | null = null;
    let distancia = 0;
    let ultimo: { x: number; y: number } | null = null;

    const desce = (e: PointerEvent) => {
      if ((e.button !== 1 && e.button !== 2) || !e.shiftKey || e.target !== tela) return;
      const p = pegarPivo.current();
      e.stopPropagation();
      e.preventDefault();
      centro = p ? new THREE.Vector3(...p) : controles.target.clone();
      distancia = Math.max(camera.position.distanceTo(controles.target), 1);
      ultimo = { x: e.clientX, y: e.clientY };
      controles.enabled = false;
      tela.setPointerCapture?.(e.pointerId);
    };
    const anda = (e: PointerEvent) => {
      if (!centro || !ultimo) return;
      girarEmTorno(camera, centro, e.clientX - ultimo.x, e.clientY - ultimo.y);
      ultimo = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    const sobe = (e: PointerEvent) => {
      if (!centro) return;
      centro = null;
      ultimo = null;
      controles.target.copy(alvoNoEixo(camera, distancia));
      controles.enabled = true;
      controles.update();
      tela.releasePointerCapture?.(e.pointerId);
      invalidate();
    };
    window.addEventListener('pointerdown', desce, true);
    window.addEventListener('pointermove', anda, true);
    window.addEventListener('pointerup', sobe, true);
    window.addEventListener('pointercancel', sobe, true);
    return () => {
      window.removeEventListener('pointerdown', desce, true);
      window.removeEventListener('pointermove', anda, true);
      window.removeEventListener('pointerup', sobe, true);
      window.removeEventListener('pointercancel', sobe, true);
      // Desmontar no meio de um giro não pode deixar o controle desligado.
      if (centro) controles.enabled = true;
    };
  }, [camera, controles, tela, invalidate]);

  return null;
}
