// ═══════════════════════════════════════════════════════════════════════════
//  estado/interface.ts — o que a tela mostra, fora do muro (Jose, 12/10)
// ---------------------------------------------------------------------------
//  A entrada por figuras virou a porta principal: o botão mora na barra de
//  cima e o "Novo" abre direto nela. A lista da esquerda ficou para ajuste
//  rápido e conferência, e recolhe para uma faixa fina (o 3D ganha a tela) —
//  como ficou é lembrado pela máquina, igual aos grupos abertos.
//
//  Não vai para o arquivo .alrimo: é preferência de quem usa, não do muro.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { CHAVES, guardar, lembrar } from './lembrete';

const ehBooleano = (x: unknown): x is boolean => typeof x === 'boolean';

interface EstadoDaInterface {
  /** A entrada por figuras está aberta. */
  porFiguras: boolean;
  abrirPorFiguras: () => void;
  /** Abre a entrada por figuras na aba do campo e com o foco nele (o "Faltam N dados" da barra de estado). */
  abrirNoCampo: (nome: string) => void;
  /** O campo em que a entrada por figuras abre (null = a 1ª aba). */
  campoInicial: string | null;
  fecharPorFiguras: () => void;
  /** A lista da esquerda está recolhida na faixa fina. */
  listaRecolhida: boolean;
  alternarLista: () => void;
}

export const useInterface = create<EstadoDaInterface>((set, get) => ({
  porFiguras: false,
  campoInicial: null,
  abrirPorFiguras: () => set({ porFiguras: true, campoInicial: null }),
  abrirNoCampo: (nome) => set({ porFiguras: true, campoInicial: nome }),
  fecharPorFiguras: () => set({ porFiguras: false }),
  listaRecolhida: lembrar(CHAVES.lista, false, ehBooleano),
  alternarLista: () => {
    const recolhida = !get().listaRecolhida;
    guardar(CHAVES.lista, recolhida);
    set({ listaRecolhida: recolhida });
  },
}));
