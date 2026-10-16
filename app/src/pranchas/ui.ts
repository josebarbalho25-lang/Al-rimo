/*
  O que a tela das pranchas lembra e que outros precisam saber: a FOLHA ATIVA. O "Enviar para a prancha" do 3D e das
  vistas manda o desenho para a folha que está aberta na aba Pranchas — mesmo com a aba fechada (a última aberta).

  E a VISTA escolhida em cada aba de desenho (16/10, vistas como no Revit): a aba Corte mostra o "Corte A" ou o
  "Corte B" que a pessoa escolheu na lista. Não vai para o arquivo (como a aba aberta no Revit): ao abrir um muro,
  cada aba começa pela primeira vista do tipo.
*/
import { create } from 'zustand';
import type { TipoDaVista } from './tipos';

interface PranchasUi {
  ativa: string | null;
  definirAtiva: (id: string | null) => void;
  vistaAtiva: Partial<Record<TipoDaVista, string>>;
  escolherVista: (tipo: TipoDaVista, id: string) => void;
}

export const usePranchasUi = create<PranchasUi>()((set) => ({
  ativa: null,
  definirAtiva: (ativa) => set({ ativa }),
  vistaAtiva: {},
  escolherVista: (tipo, id) => set((s) => ({ vistaAtiva: { ...s.vistaAtiva, [tipo]: id } })),
}));
