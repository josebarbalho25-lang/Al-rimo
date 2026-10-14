// ═══════════════════════════════════════════════════════════════════════════
//  visor/fotoRefeita.ts — a foto do 3D refeita fora da tela (prancha viva)
// ---------------------------------------------------------------------------
//  Jose, 14/10: a prancha é viva — mudou a conta, o desenho acompanha,
//  inclusive o 3D. A foto que foi para a prancha guarda o ponto de vista
//  (`pontoDeVista.ts`); quando o muro muda, ela é refeita daqui, num
//  renderizador próprio, sem a tela do visor (que pode nem estar aberta).
//
//  ⚠️ A MESMA CENA DO VISOR, PELOS MESMOS CONSTRUTORES: o muro por
//  `construirCena3D` (lotes, traço, barras, materiais do estilo), a luz, o
//  fundo e a exposição por `palco3d.ts`, o corte por `planoDoCorte`. Nada da
//  montagem é copiado aqui — se a tela mudar de luz ou de cor, a prancha muda
//  junto. Sai como a foto do botão Foto, sem as anotações (terno de eixos,
//  contorno do corte) e sem seleção; também sem a legenda pintada por cima: a
//  legenda das cores dos blocos é do quadro lateral da prancha.
//
//  ⚠️ O PONTO DE VISTA É ABSOLUTO, como a vista 3D numa folha do Revit: o muro
//  que cresceu muito pode sair do quadro. É de propósito — a câmera não se
//  re-mira sozinha (regra do visor, `enquadrar.ts`).
//
//  ⚠️ UMA FOTO DE CADA VEZ (fila). Cada foto abre um contexto WebGL próprio,
//  e o Chrome derruba o contexto MAIS ANTIGO quando passam de 16 abertos — o
//  mais antigo é o do visor. Com a prancha pedindo várias fotos de uma vez
//  (vários 3D na folha, todos refeitos a cada conta), sem a fila o visor
//  apagaria.
//
//  ⚠️ LIBERA TUDO NO FIM, NESTA ORDEM: primeiro a cena (geometrias, materiais,
//  texturas — o descarte de cada um avisa o renderizador, que solta o que
//  tinha na placa e tira o ouvinte que pendurou nele), depois o renderizador,
//  e por último o contexto. Ao contrário, os ouvintes ficariam pendurados
//  segurando o renderizador morto — e esta função roda a cada conta.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Modelo } from '@/modelo/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { ESCALA_DA_FOTO } from './captura';
import { construirCena3D, type Cena3D } from './cena3d';
import { planoDoCorte } from './Corte';
import { pelesProprias, type FonteDasPeles } from './materiaisDoEstilo';
import { exposicaoDoEstilo, montarLuzes, palcoDoTema, pintarFundo, type LuzesDoPalco } from './palco3d';
import { cameraDoPontoDeVista, estadoDoPontoDeVista } from './pontoDeVista';
import { lerPaleta, type PaletaVisor } from './tema3d';

export interface OpcoesDoPalco {
  /** A paleta do tema (a do visor: `lerPaleta()`). */
  paleta: PaletaVisor;
  /** Lado máximo de textura da placa (o mapa de sombra do Realista). */
  maxTextura: number;
  /** Pintar o fundo (precisa de documento). Sem ele o fundo fica vazio — só para os testes no Node. */
  fundo?: boolean;
  /** Texturas do Realista (ver `pelesProprias`); sem ela, as do visor. */
  peles?: FonteDasPeles;
  /** Foto para a PRANCHA: fundo transparente em qualquer tema e estilo — a folha é papel branco, e o fundo escuro
   *  do tema (ou o degradê do Cores) saía como um retângulo escuro no meio da prancha. */
  papel?: boolean;
}

export interface PalcoDaFoto {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  cena: Cena3D;
  luzes: LuzesDoPalco;
  /** A curva de exposição que o renderizador tem de usar (a do estilo). */
  exposicao: THREE.ToneMapping;
  /** Solta tudo o que o palco criou (as texturas de `peles` são de quem as deu). */
  dispose(): void;
}

/**
 * Monta o palco da foto: o muro como o visor o mostraria com este ponto de
 * vista (estilo, Armadura, corte, ocultas), a luz e o fundo do estilo, e a
 * câmera na proporção `larguraPx` ÷ `alturaPx`. Não desenha: quem desenha é
 * `refazerFoto` (ou o teste, que só confere a montagem).
 */
export function montarPalcoDaFoto(modelo: Modelo, c: Camera3d, larguraPx: number, alturaPx: number, o: OpcoesDoPalco): PalcoDaFoto {
  const { estilo, armadura, corte, ocultas } = estadoDoPontoDeVista(c);
  const cena = construirCena3D(modelo, o.paleta, estilo, { peles: o.peles });

  // A régua do corte é a do Visor3D: o muro aceso ao montar a cena (antes de ocultar). Um muro que encurtou não
  // deixa o plano no vazio — o corte encosta na ponta, como na tela.
  const regua = cena.caixaVisivel();
  cena.aplicarVisibilidade(ocultas);
  cena.aplicarArmadura(armadura);
  if (corte !== null) cena.aplicarCorte([planoDoCorte(Math.min(regua.max[0], Math.max(regua.min[0], corte)))]);

  const total = cena.caixaTotal();
  const camera = cameraDoPontoDeVista(c, larguraPx / alturaPx, total);
  // O traço desbota pelo tamanho do bloco NA TELA (pixels de tela por metro): a foto sai com ESCALA_DA_FOTO pixels
  // por pixel de tela, então refeita no tamanho da foto enviada ela desbota igual à enviada.
  cena.aplicarZoom((alturaPx * c.zoom) / ESCALA_DA_FOTO);

  const scene = new THREE.Scene();
  scene.add(cena.grupo);
  const luzes = montarLuzes(estilo, total, o.maxTextura);
  scene.add(luzes.grupo);
  const fundo = o.fundo === false || o.papel ? null : pintarFundo(palcoDoTema(o.paleta, estilo), estilo === 'opaco');
  scene.background = fundo;

  return {
    scene,
    camera,
    cena,
    luzes,
    exposicao: exposicaoDoEstilo(estilo),
    dispose: () => {
      scene.background = null;
      fundo?.dispose();
      luzes.dispose();
      cena.dispose();
      scene.clear();
    },
  };
}

/**
 * Teto de pontos da foto: 32 milhões (≈ 6.900 × 4.600). A placa de vídeo de
 * notebook não segura muito mais com o antisserrilhado ligado. (DEDUÇÃO minha;
 * uma vista 3D de 40 × 30 cm a 300 dpi tem 16,7 milhões.)
 */
export const TETO_DE_PONTOS = 32e6;

/** O tamanho que cabe na placa (`lado` = maior lado aceito), mantendo a proporção. */
export function tamanhoQueCabe(largura: number, altura: number, lado: number, teto = TETO_DE_PONTOS): [number, number] {
  const k = Math.min(1, lado / Math.max(largura, altura), Math.sqrt(teto / (largura * altura)));
  return [Math.max(1, Math.round(largura * k)), Math.max(1, Math.round(altura * k))];
}

let fila: Promise<unknown> = Promise.resolve();

/**
 * Refaz a foto do 3D com o ponto de vista guardado, no tamanho pedido (pontos).
 * Devolve o PNG como data URL. A proporção da foto é `larguraPx` ÷ `alturaPx`;
 * a altura visível do muro é a guardada (a mesma foto em qualquer tamanho). Se
 * o tamanho passar do que a placa aguenta, sai menor, na mesma proporção.
 */
export async function refazerFoto(modelo: Modelo, camera: Camera3d, larguraPx: number, alturaPx: number, opcoes: { papel?: boolean } = {}): Promise<string> {
  const vez = fila.then(() => fotografarFora(modelo, camera, larguraPx, alturaPx, opcoes.papel === true));
  // A fila anda mesmo quando uma foto falha (a falha vai para quem pediu aquela foto).
  fila = vez.catch(() => undefined);
  return vez;
}

async function fotografarFora(modelo: Modelo, camera: Camera3d, larguraPx: number, alturaPx: number, papel: boolean): Promise<string> {
  if (!(larguraPx >= 1 && alturaPx >= 1 && Number.isFinite(larguraPx * alturaPx))) throw new Error(`foto refeita: tamanho inválido (${larguraPx} × ${alturaPx})`);
  const tela = document.createElement('canvas');
  // As mesmas escolhas do Canvas do visor (o r3f liga antisserrilhado, alfa e a placa rápida; o visor liga o corte
  // por material). `preserveDrawingBuffer`: a leitura do PNG vem depois de esperar a compilação.
  const gl = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  const peles = pelesProprias();
  let palco: PalcoDaFoto | null = null;
  try {
    gl.localClippingEnabled = true;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    // `shadows="percentage"` do Canvas: só o sol do Realista liga a sombra; nos outros estilos ela nem é desenhada.
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    const ctx = gl.getContext();
    const vista = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as Int32Array;
    const lado = Math.min(ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number, vista[0]!, vista[1]!);
    const [w, h] = tamanhoQueCabe(larguraPx, alturaPx, lado);
    gl.setPixelRatio(1);
    gl.setSize(w, h, false);
    palco = montarPalcoDaFoto(modelo, camera, w, h, { paleta: lerPaleta(), maxTextura: gl.capabilities.maxTextureSize, peles: peles.fonte, papel });
    // sem fundo, o renderizador com alfa limpa transparente: no papel, o muro fica sobre a folha branca
    if (papel) gl.setClearColor(0x000000, 0);
    gl.toneMapping = palco.exposicao;
    gl.toneMappingExposure = 1;
    // Compila os sombreadores sem travar a tela (o Realista tem vários): a prancha refaz as fotos enquanto o
    // engenheiro digita.
    await gl.compileAsync(palco.scene, palco.camera);
    gl.render(palco.scene, palco.camera);
    return tela.toDataURL('image/png');
  } finally {
    palco?.dispose();
    peles.dispose();
    gl.dispose();
    gl.forceContextLoss();
  }
}
