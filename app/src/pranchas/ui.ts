/*
  O que a tela das pranchas lembra e que outros precisam saber: a FOLHA ATIVA. O "Enviar para a prancha" do 3D e das
  vistas manda o desenho para a folha que está aberta na aba Pranchas — mesmo com a aba fechada (a última aberta).
*/
import { create } from 'zustand';

export const usePranchasUi = create<{ ativa: string | null; definirAtiva: (id: string | null) => void }>()((set) => ({
  ativa: null,
  definirAtiva: (ativa) => set({ ativa }),
}));
