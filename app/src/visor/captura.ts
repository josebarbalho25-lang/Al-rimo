// ═══════════════════════════════════════════════════════════════════════════
//  visor/captura.ts — a foto do 3D, no dobro do tamanho da tela
// ---------------------------------------------------------------------------
//  Molde: `proviga-3d-limpo/app/apresentacao3d.js` (foto) — o que vai para
//  proposta e rede social não pode sair do tamanho da janela. Aqui em r3f:
//  sobe a densidade de pixels, renderiza, lê o PNG e volta. Renderizando no
//  mesmo instante da leitura, dispensa `preserveDrawingBuffer` (que custa em
//  todo quadro). Seleção e anotação (terno, contorno do corte) saem da foto,
//  como o Pró-Viga faz. A foto sai no estilo que está na tela (é a mesma cena).
// ═══════════════════════════════════════════════════════════════════════════

import type { RootState } from '@react-three/fiber';
import type * as THREE from 'three';

/** Marca de objeto que é anotação do visor (não sai na foto). */
export const ANOTACAO = 'anotacaoDoVisor';

/**
 * Pinta por cima da foto (a legenda do Cores). Recebe o pincel, o tamanho da
 * foto em pixels e a escala dela.
 */
export type Decorar = (g: CanvasRenderingContext2D, largura: number, altura: number, escala: number) => void;

/** Fotografa a cena em `escala` × o tamanho CSS do canvas. Devolve o PNG como data URL. */
export function capturar(st: RootState, escala = 2, antes?: () => void, depois?: () => void, decorar?: Decorar): string {
  const { gl, scene, camera } = st;
  const densidade = gl.getPixelRatio();
  const escondidos: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData[ANOTACAO] && o.visible) {
      o.visible = false;
      escondidos.push(o);
    }
  });
  antes?.();
  try {
    gl.setPixelRatio(escala);
    gl.render(scene, camera);
    const tela = gl.domElement;
    if (!decorar) return tela.toDataURL('image/png');
    // ⚠️ Copiar no MESMO instante do desenho: sem `preserveDrawingBuffer`, o navegador limpa a tela do WebGL
    // assim que o quadro é entregue, e a cópia sairia preta.
    const copia = document.createElement('canvas');
    copia.width = tela.width;
    copia.height = tela.height;
    const g = copia.getContext('2d');
    if (!g) return tela.toDataURL('image/png');
    g.drawImage(tela, 0, 0);
    decorar(g, copia.width, copia.height, escala);
    return copia.toDataURL('image/png');
  } finally {
    gl.setPixelRatio(densidade);
    for (const o of escondidos) o.visible = true;
    depois?.();
    st.invalidate();
  }
}

/** Baixa o data URL como arquivo. */
export function baixar(url: string, nome: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
