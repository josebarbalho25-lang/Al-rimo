// ═══════════════════════════════════════════════════════════════════════════
//  pranchas/pedidoDeSaida.ts — o PDF e o DXF das pranchas pedidos de fora
// ---------------------------------------------------------------------------
//  O Exportar do Início (o do Pró-Viga: uma linha por formato) tem "Pranchas
//  em PDF" e "DXF". Quem sabe montar as folhas para o arquivo é a tela das
//  pranchas (o desenhista dela, com as fotos do Realista): o Início deixa o
//  pedido aqui e abre a Gráfica nas pranchas; a tela, de pé, atende uma vez.
//  O comando continua num lugar só.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

export type SaidaDasPranchas = 'pdf' | 'dxf';

interface PedidoDeSaida {
  pedido: SaidaDasPranchas | null;
}

export const usePedidoDeSaida = create<PedidoDeSaida>(() => ({ pedido: null }));

export function pedirSaida(s: SaidaDasPranchas): void {
  usePedidoDeSaida.setState({ pedido: s });
}

/** A tela das pranchas pega o pedido (e ele some: atende uma vez só). */
export function atenderSaida(): SaidaDasPranchas | null {
  const p = usePedidoDeSaida.getState().pedido;
  if (p) usePedidoDeSaida.setState({ pedido: null });
  return p;
}
