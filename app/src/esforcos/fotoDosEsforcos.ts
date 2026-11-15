/*
  A IMAGEM DOS ESFORÇOS PARA A PRANCHA — refeita fora da tela, do ponto de vista guardado, como a foto do 3D
  Realista (visor/fotoRefeita.ts): a prancha é viva, mudou a conta, a imagem acompanha.

  Papel: fundo transparente e as cores do papel (tinta escura, azul, vermelho) em qualquer tema — a folha é branca,
  e a tinta clara do tema escuro sumiria nela. A letra dos números sai na mesma proporção da altura da foto que
  tinha na tela (LETRA_DA_FOTO), para o desenho na folha ter a cara do que se viu.

  ⚠️ Uma imagem de cada vez (fila própria) e tudo liberado no fim, na ordem da foto do 3D: cena, renderizador,
  contexto. O Chrome derruba o contexto WebGL mais antigo (o do visor) quando passam de 16 abertos.
*/
import * as THREE from 'three';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { cameraDoPontoDeVista } from '@/visor/pontoDeVista';
import { tamanhoQueCabe } from '@/visor/fotoRefeita';
import { barrasAnaliticas } from './barrasAnaliticas';
import { CORES_DO_PAPEL, montarCenaDosEsforcos, type EscalaDosEsforcos } from './cenaDosEsforcos';

/** Altura da letra dos números ÷ altura da imagem (≈ 13 px numa tela de 560 px). */
export const LETRA_DA_FOTO = 0.024;

let fila: Promise<unknown> = Promise.resolve();

export async function fotoDosEsforcos(
  r: Resultado,
  modelo: Modelo,
  vista: { camera: Camera3d; escala: EscalaDosEsforcos; valores: boolean; muro: boolean },
  larguraPx: number,
  alturaPx: number,
  opcoes: { cancelado?: () => boolean } = {},
): Promise<string> {
  const vez = fila.then(() => {
    if (opcoes.cancelado?.()) throw new Error('esforços: pedido cancelado');
    return fotografar(r, modelo, vista, larguraPx, alturaPx);
  });
  fila = vez.catch(() => undefined);
  return vez;
}

function fotografar(r: Resultado, modelo: Modelo, vista: { camera: Camera3d; escala: EscalaDosEsforcos; valores: boolean; muro: boolean }, larguraPx: number, alturaPx: number): string {
  if (!(larguraPx >= 1 && alturaPx >= 1)) throw new Error(`esforços: tamanho inválido (${larguraPx} × ${alturaPx})`);
  const tela = document.createElement('canvas');
  const gl = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, preserveDrawingBuffer: true });
  const cena = montarCenaDosEsforcos(barrasAnaliticas(r, modelo), modelo, { escala: vista.escala, valores: vista.valores, muro: vista.muro, cores: CORES_DO_PAPEL });
  const scene = new THREE.Scene();
  try {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    const ctx = gl.getContext();
    const v = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as Int32Array;
    const lado = Math.min(ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number, v[0]!, v[1]!);
    const [w, h] = tamanhoQueCabe(larguraPx, alturaPx, lado);
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    gl.setClearColor(0x000000, 0);
    scene.add(cena.grupo);
    const camera = cameraDoPontoDeVista(vista.camera, w / h, cena.caixa);
    // a altura visível no alvo é 1/zoom guardado (pontoDeVista.ts): a letra é uma fração dela
    cena.tamanhoDaLetra(LETRA_DA_FOTO / Math.max(vista.camera.zoom, 1e-9));
    gl.render(scene, camera);
    return tela.toDataURL('image/png');
  } finally {
    scene.clear();
    cena.dispose();
    gl.dispose();
    gl.forceContextLoss();
  }
}
