// ═══════════════════════════════════════════════════════════════════════════
//  visor/miniatura.ts — a foto do muro no cartão dos Recentes
// ---------------------------------------------------------------------------
//  Jose, 15/11, comparando o Início com o do Pró-Viga: "coloca o 3D realista".
//  A foto é a da prancha (`fotoRefeita.ts`, fora da tela, a mesma cena do
//  visor), no estilo Realista, do lado isométrico de sempre (o da abertura do
//  visor e da casinha do cubo), com o muro inteiro no quadro. Fundo
//  transparente: o cartão pinta o dele, e a foto serve nos três temas.
//
//  Ponto de vista PELA CAIXA do muro, e não o da tela: a câmera que o
//  engenheiro deixou no visor pode estar colada num detalhe, e o cartão tem de
//  mostrar o muro. SEM O TERRENO: com o aterro da frente e o de trás, o muro
//  de 1,60 virava uma faixa cinza entre dois caixotes de terra no cartão de
//  245 px (visto no programa, 15/11) — e o que identifica o muro é a parede,
//  os contrafortes e a sapata.
// ═══════════════════════════════════════════════════════════════════════════

import type { Modelo } from '@/modelo/tipos';
import type { Camera3d } from '@/pranchas/tipos';
import { DIRECOES, eixosDaTela, enquadramento } from './enquadrar';
import { refazerFoto } from './fotoRefeita';
import type { Caixa } from './perfil3d';

/** O tamanho da foto do cartão (pontos). O cartão mostra uns 245 px de largura: o dobro para tela de alta densidade. */
export const TAMANHO_DA_MINIATURA: readonly [number, number] = [490, 300];

/** Sobra em volta do muro no quadro (0,86 = 14 %). */
const FOLGA = 0.86;

/**
 * O ponto de vista do cartão: ortográfico, do lado isométrico, o muro (a caixa, em metro) inteiro numa foto de
 * proporção `proporcao` (largura ÷ altura). Puro: testado no Node.
 */
export function pontoDeVistaDaMiniatura(caixa: Caixa, proporcao: number): Camera3d {
  const prop = proporcao > 0 && Number.isFinite(proporcao) ? proporcao : 1;
  // a conta do cubo de vistas em "pixels": uma foto de 1000 de altura; o zoom guardado é 1 ÷ altura visível (m)
  const e = enquadramento(caixa, DIRECOES.iso, 1000 * prop, 1000, FOLGA);
  const { cima } = eixosDaTela(e.direcao);
  const posicao: [number, number, number] = [
    e.alvo[0] + e.direcao[0] * e.distancia,
    e.alvo[1] + e.direcao[1] * e.distancia,
    e.alvo[2] + e.direcao[2] * e.distancia,
  ];
  const altura = 1000 / e.zoom;
  return {
    posicao,
    alvo: [e.alvo[0], e.alvo[1], e.alvo[2]],
    cima: [cima[0], cima[1], cima[2]],
    ortografica: true,
    zoom: 1 / altura,
    fov: (2 * Math.atan(altura / 2 / e.distancia) * 180) / Math.PI,
    estilo: 'realista',
    armadura: false,
    corteX: null,
    ocultas: ['terreno'],
  };
}

/** A miniatura do muro (PNG em data URL). Falha (sem placa de vídeo, contexto perdido) devolve null: o cartão fica com a marca. */
export async function miniaturaDoMuro(modelo: Modelo): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const [w, h] = TAMANHO_DA_MINIATURA;
  const base = pontoDeVistaDaMiniatura({ min: [0, 0, 0], max: [1, 1, 1] }, w / h);
  try {
    return await refazerFoto(modelo, base, w, h, { papel: true, enquadrar: pontoDeVistaDaMiniatura });
  } catch (e) {
    console.warn('miniatura do muro:', e);
    return null;
  }
}
