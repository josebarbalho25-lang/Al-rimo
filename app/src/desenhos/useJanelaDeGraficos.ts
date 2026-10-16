/*
  O que a janela de gráficos (ui/JanelaDeGraficos.tsx) está editando: a GERAL (a engrenagem), a sobreposição do 3D do
  visor, ou a sobreposição de uma vista da lista (16/10). Quem abre: as Configurações, o botão do 3D e o "Gráficos" de
  cada aba de desenho. `vez` sobe a cada abertura: abrir de novo é janela nova, com o "antes" do Cancelar tirado na
  hora.
*/
import { create } from 'zustand';
import type { TipoDeVista } from './graficos';

export type AlvoDosGraficos =
  | { tipo: 'geral' }
  | { tipo: 'visor' }
  | { tipo: 'vista'; id: string; tipoDaVista: TipoDeVista };

interface EstadoDaJanela {
  alvo: AlvoDosGraficos | null;
  vez: number;
  /** Abre no alvo; com a janela já aberta noutro, fecha a de antes (o OK/Cancelar é de uma coisa só) e abre esta. */
  abrir: (a: AlvoDosGraficos) => void;
  fechar: () => void;
}

export const useJanelaDeGraficos = create<EstadoDaJanela>()((set, get) => ({
  alvo: null,
  vez: 0,
  abrir: (alvo) => set({ alvo, vez: get().vez + 1 }),
  fechar: () => set({ alvo: null }),
}));
