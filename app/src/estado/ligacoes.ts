// ═══════════════════════════════════════════════════════════════════════════
//  estado/ligacoes.ts — as tomadas onde as outras frentes se ligam
// ---------------------------------------------------------------------------
//  A casca do app nasce antes das peças que ela segura (modulação, 3D,
//  desenhos, memória, quantitativo, IFC). Em vez de importar módulos
//  que ainda não existem — o que quebraria a compilação de todo mundo —, a
//  casca deixa TOMADAS: a integração liga cada peça com `ligar({...})` em
//  main.tsx, e a casca funciona com ou sem elas. Tomada vazia = marcador de
//  lugar na aba, botão apagado no topo, "—" no veredito.
//  (As figuras não passam por aqui: o mapa delas já existe e o painel o
//  importa direto de '@/figuras/mapa'.)
//
//  É a mesma ideia de um quadro de distribuição entregue com os disjuntores
//  marcados: cada circuito entra no seu lugar sem mexer na fiação dos outros.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo } from '@/modelo/tipos';

/** '@/modulacao' → gerarModelo. */
export type GeradorDoModelo = (r: Resultado, extras: Record<string, Valor>) => Modelo;

/** O veredito geral da barra de estado: "Passa" / "Não passa · 3". */
export interface Veredito {
  passa: boolean;
  /** Quantas verificações aplicáveis não passam. */
  falhas: number;
}
export type JuizDoVeredito = (r: Resultado) => Veredito | null;

/** '@/ifc' → exportarIfc. Devolve o texto do .ifc. */
export type ExportadorIfc = (
  modelo: Modelo,
  info: { projeto: string; autor?: string; data?: string; resultado?: Resultado },
) => string;

/** '@/memoria' → imprimirMemorial (que é assíncrono), embrulhado pela integração. */
export type ImpressoraDaMemoria = (r: Resultado, info: { projeto: string }) => void | Promise<void>;

/** As abas do palco, na ordem da barra. */
export type IdAba = '3d' | 'frontal' | 'corte' | 'planta' | 'iso' | 'memoria' | 'quantitativo';

/** O que a aba recebe para desenhar. */
export interface ContextoDaAba {
  modelo: Modelo | null;
  resultado: Resultado | null;
  selecionado: string | null;
  selecionar: (id: string | null) => void;
}
export type ConteudoDaAba = (ctx: ContextoDaAba) => ReactNode;

export interface Ligacoes {
  gerador: GeradorDoModelo | null;
  veredito: JuizDoVeredito | null;
  exportarIfc: ExportadorIfc | null;
  imprimirMemoria: ImpressoraDaMemoria | null;
  abas: Partial<Record<IdAba, ConteudoDaAba>>;
}

export const SEM_LIGACOES: Ligacoes = {
  gerador: null,
  veredito: null,
  exportarIfc: null,
  imprimirMemoria: null,
  abas: {},
};
