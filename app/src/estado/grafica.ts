// ═══════════════════════════════════════════════════════════════════════════
//  estado/grafica.ts — o que a seção Gráfica lembra, fora do muro
// ---------------------------------------------------------------------------
//  A etapa 3 da moldura (Jose, 20/10: "o navegador do A-PORT na Gráfica"):
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Anotação  Vista  Prancha  Exportar          ← a FAIXA de ferramentas │
//   │ [Cota][Texto][Etiqueta] │ [Nova][Duplicar]…                          │
//   ├───────────────┬──────────────────────────────────────────────────────┤
//   │ Navegador |   │ Corte A × │ Vista frontal × │ 01 ×   ← as abas ABERTAS │
//   │  Propriedades │                                                      │
//   │ ▾ Cortes   2  │                 o desenho da aba                     │
//   │    Corte  1:25│                                                      │
//   │    Corte A    ├──────────────────────────────────────────────────────┤
//   │ ▾ Pranchas 1  │ Escala 1:25 · Enquadrar               ← o RODAPÉ     │
//   └───────────────┴──────────────────────────────────────────────────────┘
//
//  As abas abertas são como as do Revit: o navegador abre, o × fecha, e a que
//  está na frente é a que o palco mostra. Abrir de novo uma vista já aberta só
//  a traz para a frente. Não vai para o arquivo (como as janelas abertas do
//  Revit): é de quem usa, e começa com a vista que estava na tela.
//
//  ENCAIXES: a faixa, o painel Propriedades e o rodapé são da Gráfica, mas os
//  botões são de quem desenha (a aba de desenho tem a ferramenta Cota armada,
//  o zoom, a vista escolhida; a tela das pranchas tem a folha e a seleção). A
//  Gráfica publica aqui o lugar de cada encaixe e o desenho põe os botões lá
//  por portal (`ui/grafica/Encaixes.tsx`). Sem a Gráfica em volta (o desenho
//  sozinho, num teste), não há encaixe e os botões ficam na barra do próprio
//  desenho, como antes.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { IdAba } from './ligacoes';
import { CHAVES, guardar, lembrar } from './lembrete';

/** As abas da faixa de ferramentas, na ordem. */
export type IdFaixa = 'anotacao' | 'vista' | 'prancha' | 'exportar';
export const FAIXAS: ReadonlyArray<{ id: IdFaixa; nome: string }> = [
  { id: 'anotacao', nome: 'Anotação' },
  { id: 'vista', nome: 'Vista' },
  { id: 'prancha', nome: 'Prancha' },
  { id: 'exportar', nome: 'Exportar' },
];

/**
 * Uma aba aberta: o tipo (a aba do palco) e QUAL — a vista do projeto ("Corte A"), a folha ("01") ou nada (o 3D
 * do visor, que é um só).
 */
export interface Aberta {
  aba: IdAba;
  id: string | null;
}

export const chaveDaAberta = (a: Aberta): string => `${a.aba}:${a.id ?? ''}`;
const mesma = (a: Aberta, b: Aberta) => a.aba === b.aba && a.id === b.id;

const ehBooleano = (x: unknown): x is boolean => typeof x === 'boolean';
const ehFaixa = (x: unknown): x is IdFaixa => FAIXAS.some((f) => f.id === x);

interface EstadoDaGrafica {
  /** A aba da faixa que está à vista. */
  faixa: IdFaixa;
  escolherFaixa: (f: IdFaixa) => void;
  /** O painel da esquerda mostra o Navegador ou as Propriedades. */
  painel: 'navegador' | 'propriedades';
  verPainel: (p: 'navegador' | 'propriedades') => void;
  /** O painel da esquerda recolhido na faixa fina (como a lista da Memória). */
  recolhido: boolean;
  alternarPainel: () => void;
  /** As abas abertas, na ordem em que estão na tela. */
  abertas: Aberta[];
  /** Fechou a última: o palco fica vazio até o navegador abrir outra. */
  nadaAberto: boolean;
  /** Põe na lista (se ainda não está) e tira o "nada aberto". Quem traz para a frente é quem chama. */
  abrir: (a: Aberta) => void;
  /** Tira da lista; devolve a que deve vir para a frente (a vizinha), ou null se não sobrou nenhuma. */
  fechar: (a: Aberta) => Aberta | null;
  /** As abas que apontam para o que não existe mais (vista excluída, folha apagada, outro muro) saem. */
  podar: (existe: (a: Aberta) => boolean) => void;
  /** O nome sendo reescrito no navegador (o id da vista ou da folha), ou null. */
  renomeando: string | null;
  renomear: (id: string | null) => void;
}

export const useGrafica = create<EstadoDaGrafica>((set, get) => ({
  faixa: lembrar(CHAVES.faixa, 'anotacao', ehFaixa),
  escolherFaixa: (faixa) => {
    guardar(CHAVES.faixa, faixa);
    set({ faixa });
  },
  painel: 'navegador',
  verPainel: (painel) => set({ painel }),
  recolhido: lembrar(CHAVES.navegador, false, ehBooleano),
  alternarPainel: () => {
    const recolhido = !get().recolhido;
    guardar(CHAVES.navegador, recolhido);
    set({ recolhido });
  },
  abertas: [],
  nadaAberto: false,
  abrir: (a) => {
    const { abertas } = get();
    set({ abertas: abertas.some((b) => mesma(a, b)) ? abertas : [...abertas, a], nadaAberto: false });
  },
  fechar: (a) => {
    const { abertas } = get();
    const i = abertas.findIndex((b) => mesma(a, b));
    if (i < 0) return null;
    const resto = abertas.filter((_, j) => j !== i);
    // a da direita vem para a frente; fechou a última da fila, a da esquerda (como o navegador da internet)
    const vizinha = resto[i] ?? resto[i - 1] ?? null;
    set({ abertas: resto, nadaAberto: resto.length === 0 });
    return vizinha;
  },
  podar: (existe) => {
    const { abertas } = get();
    const resto = abertas.filter(existe);
    if (resto.length !== abertas.length) set({ abertas: resto });
  },
  renomeando: null,
  renomear: (renomeando) => set({ renomeando }),
}));

// ── os encaixes ─────────────────────────────────────────────────────────────

export type IdEncaixe = IdFaixa | 'propriedades' | 'rodape';

interface Encaixes {
  lugar: Partial<Record<IdEncaixe, HTMLElement>>;
  publicar: (id: IdEncaixe, el: HTMLElement | null) => void;
}

/** Onde cada encaixe da Gráfica está no DOM (vazio = não há Gráfica em volta: os botões ficam no desenho). */
export const useEncaixes = create<Encaixes>((set, get) => ({
  lugar: {},
  publicar: (id, el) => {
    const atual = get().lugar[id];
    if ((atual ?? null) === el) return;
    const lugar = { ...get().lugar };
    if (el) lugar[id] = el;
    else delete lugar[id];
    set({ lugar });
  },
}));
