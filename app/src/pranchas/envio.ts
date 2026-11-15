/*
  PRANCHAS — o canal "Enviar para a prancha".

  Quem desenha (o 3D, as vistas 2D) não conhece a tela das pranchas, e ela não conhece quem desenha: o botão
  publica o pedido aqui e a tela, quando existir e estiver ouvindo, recebe. Assim o botão funciona antes de a tela
  existir (sem ninguém ouvindo, o pedido simplesmente não vai a lugar nenhum) e nenhuma das duas frentes precisa
  importar a outra.

  O que chega:
    · 3d    — a foto já tirada (PNG), o ponto de vista com que ela é refeita quando o muro muda (prancha viva) e a
              proporção da foto (largura ÷ altura). Quem refaz é `visor/fotoRefeita.ts` (refazerFoto).
    · vista — o pedido de uma vista 2D (frontal, corte, planta, isométrico), que a prancha desenha na escala dela;
    · tabela — uma tabela de materiais do quantitativo (blocos, materiais, drenagem), que a prancha tira do muro.
*/

import type { Camera3d, ConteudoDoItem } from './tipos';

export type PedidoParaPrancha =
  | { tipo: '3d'; dataUrl: string; camera: Camera3d; proporcao: number }
  /** A vista do projeto escolhida na aba (16/10: vistas como no Revit), pelo id — a de fábrica virtual também. */
  | { tipo: 'vista'; id: string }
  | { tipo: 'tabela'; id: Extract<ConteudoDoItem, { tipo: 'tabela' }>['id'] };

export type OuvinteDaPrancha = (pedido: PedidoParaPrancha) => void;

/*
  Cada assinatura é um objeto próprio (e não a função): a mesma função assinada duas vezes recebe duas vezes, e
  cancelar uma não cancela a outra — com um conjunto de funções, o segundo cancelamento tiraria a primeira.
*/
const ouvintes = new Set<{ fn: OuvinteDaPrancha }>();

/**
 * Publica o pedido para quem está ouvindo. Devolve quantos receberam (0 = não há
 * prancha ouvindo; não é erro). Um ouvinte que falha não impede os outros nem
 * quebra quem enviou.
 */
export function enviarParaPrancha(pedido: PedidoParaPrancha): number {
  let n = 0;
  // Cópia: um ouvinte pode cancelar a si mesmo (ou outro) no meio da entrega.
  for (const o of [...ouvintes]) {
    if (!ouvintes.has(o)) continue;
    try {
      o.fn(pedido);
      n++;
    } catch (e) {
      console.error('[prancha] o ouvinte do envio falhou:', e);
    }
  }
  return n;
}

/** Passa a receber os pedidos. Devolve a função de cancelar (chamar duas vezes não faz mal). */
export function ouvirEnvioParaPrancha(fn: OuvinteDaPrancha): () => void {
  const o = { fn };
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}
