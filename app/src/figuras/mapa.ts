/*
  MAPA ENTRADA → FIGURA DE REFERÊNCIA (o botão ao lado de cada entrada).

  A fonte é dados/figuras.json, e só ela: hoje existem três mapas parecidos (FIG_OF no build_new.py, CAMPOS
  no make_pdf.py e a coluna Figura da planilha), e mapa duplicado diverge. O app lê o JSON; a planilha passa
  a ler o mesmo arquivo numa etapa própria. Por isso NÃO usar EntradaMeta.figura das entradas da planilha:
  ele vem do FIG_OF antigo e já discorda deste mapa em várias entradas (z_NA, Ka_dir, bwv_dir...).

  Os SVG ficam em app/public/figuras (gerados por figs/app/gerar.py). Cada grandeza que corresponde a uma
  entrada está num <g data-campo="nome">, e o `campo` do JSON aponta para ela. A tela não usa mais o campo (o
  modal mostra a figura limpa, sem destacar a grandeza — pedido do Jose, 09/10); ele fica no JSON porque é o
  mesmo arquivo que a planilha vai ler, e o teste segue conferindo que aponta para algo que existe no desenho.
*/
import dados from '../../../dados/figuras.json';

export interface Figura {
  id: string;          // 'fig12'
  numero: number;      // 12
  titulo: string;      // 'Contraforte em planta' (sem o número)
  arquivo: string;     // 'fig12.svg'
  planilha?: string;   // figura equivalente da planilha ('fig12_contraforte'), quando existe
}

interface Ligacao { figura: string; campo?: string }

const FIGURAS: readonly Figura[] = dados.figuras;
const POR_ID = new Map(FIGURAS.map((f) => [f.id, f]));
const ENTRADAS = dados.entradas as Record<string, Ligacao>;
const SEM_FIGURA = dados.sem_figura as Record<string, string>;

/** Todas as figuras do app, em ordem. */
export function figuras(): readonly Figura[] {
  return FIGURAS;
}

/** Endereço público do SVG (respeita o base do Vite, para o app funcionar fora da raiz do site). */
export function urlDaFigura(f: Figura): string {
  return `${import.meta.env.BASE_URL}figuras/${f.arquivo}`;
}

/**
 * A figura de referência de uma entrada (nome definido da planilha ou entrada do modelo).
 * `titulo` já vem no formato do cabeçalho do modal ("Fig. 12 — Contraforte em planta").
 * null = a entrada não tem figura (a coluna do botão fica vazia).
 */
export function figuraDaEntrada(nome: string): { id: string; titulo: string; url: string } | null {
  const lig = Object.prototype.hasOwnProperty.call(ENTRADAS, nome) ? ENTRADAS[nome] : undefined;
  if (!lig) return null;
  const f = POR_ID.get(lig.figura);
  if (!f) return null;
  // id: o modal põe a calculadora de consulta embaixo da figura dos solos (fig22)
  return { id: f.id, titulo: `Fig. ${f.numero} — ${f.titulo}`, url: urlDaFigura(f) };
}

/** Por que a entrada não tem figura (para quem mantém o mapa; não vai para a tela). */
export function motivoSemFigura(nome: string): string | null {
  return Object.prototype.hasOwnProperty.call(SEM_FIGURA, nome) ? SEM_FIGURA[nome] : null;
}

/** Uso interno dos testes: o mapa cru. */
export const _mapa = { entradas: ENTRADAS, semFigura: SEM_FIGURA };
