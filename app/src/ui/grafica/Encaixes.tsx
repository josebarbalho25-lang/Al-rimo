// ═══════════════════════════════════════════════════════════════════════════
//  ui/grafica/Encaixes.tsx — os botões do desenho vão para a faixa da Gráfica
// ---------------------------------------------------------------------------
//  Quem desenha (a aba de desenho, a tela das pranchas) diz ONDE cada grupo de
//  botões mora — "Anotar" na aba Anotação da faixa, a escala no rodapé, os
//  parâmetros da vista nas Propriedades — e o encaixe leva o grupo para lá por
//  portal. O estado continua no desenho (a Cota armada, o zoom, a seleção):
//  só o lugar na tela muda.
//
//  Sem a Gráfica em volta não há encaixe publicado, e o grupo fica onde foi
//  escrito, na barra do próprio desenho — é assim que o desenho sozinho (e o
//  teste dele, que roda sem navegador) continua inteiro.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEncaixes, type IdEncaixe, type IdFaixa } from '@/estado/grafica';
import { Svg, type PropsDoIcone } from '@/ui/icones';

/** O lugar do encaixe, se a Gráfica estiver em volta. */
export const useLugar = (id: IdEncaixe): HTMLElement | null => useEncaixes((s) => s.lugar[id] ?? null);

/** Há Gráfica em volta? (o desenho esconde o que a Gráfica já faz por ele, como a lista das vistas) */
export const useNaGrafica = (): boolean => useEncaixes((s) => !!s.lugar.anotacao);

/** Leva os filhos para o encaixe; sem ele, ficam aqui. */
export function NoEncaixe({ em, children }: { em: IdEncaixe; children: ReactNode }) {
  const lugar = useLugar(em);
  return lugar ? createPortal(children, lugar) : <>{children}</>;
}

/**
 * Um grupo da faixa: os botões grandes (ícone em cima, nome embaixo) e o nome do grupo no pé, como no A-PORT. Fora da
 * Gráfica o grupo vira a fileira de botões de sempre (`cad-escolha`).
 */
export function GrupoDaFaixa({ faixa, nome, children }: { faixa: IdFaixa; nome: string; children: ReactNode }) {
  const lugar = useLugar(faixa);
  if (!lugar) return <div className="cad-escolha">{children}</div>;
  return createPortal(
    <div className="faixa-grupo" data-grupo={nome}>
      <div className="faixa-botoes">{children}</div>
      <span className="faixa-grupo-nome">{nome}</span>
    </div>,
    lugar,
  );
}

export type Desenho = (p: PropsDoIcone) => ReactNode;

/** O ícone de um botão da faixa, na grade de 24 (os traços do protótipo de 20/10). */
export const icone = (d: string): Desenho => (p) => (
  <Svg {...p}>
    <path d={d} />
  </Svg>
);

/**
 * O botão da faixa. Dentro dela: ícone e nome empilhados; fora (o desenho sozinho): só o nome, como os botões da
 * barra eram — o texto do botão é o mesmo nos dois lugares.
 */
export function BotaoDaFaixa({
  nome, dica, desenho, ligado, desligado, aoClicar,
}: {
  nome: string;
  dica?: string;
  desenho?: Desenho;
  ligado?: boolean;
  desligado?: boolean;
  aoClicar: () => void;
}) {
  const naGrafica = useNaGrafica();
  if (!naGrafica || !desenho) {
    return (
      <button type="button" style={{ flex: 'none', padding: '0 10px' }} className={ligado ? 'on' : undefined} disabled={desligado} title={dica} onClick={aoClicar}>
        {nome}
      </button>
    );
  }
  return (
    <button type="button" className={`faixa-botao${ligado ? ' on' : ''}`} disabled={desligado} title={dica ?? nome} aria-pressed={ligado} onClick={aoClicar}>
      {desenho({ tamanho: 22 })}
      <span>{nome}</span>
    </button>
  );
}

/** Os traços dos ícones da faixa (o protótipo da Gráfica, 20/10). */
export const ICONES = {
  cota: icone('M4 18h16M4 15v6M20 15v6M8 4h8l-4 7z'),
  texto: icone('M5 5h14M12 5v14M9 19h6'),
  etiqueta: icone('M4 20l6-6M10 14h10M10 10h8'),
  sair: icone('M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'),
  ocultas: icone('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 20L20 4'),
  automatico: icone('M4 12a8 8 0 1 0 3-6.2M4 4v5h5'),
  nova: icone('M4 4h16v16H4zM12 8v8M8 12h8'),
  duplicar: icone('M8 8h12v12H8zM4 16V4h12'),
  renomear: icone('M4 20h4l11-11-4-4L4 16zM14 6l4 4'),
  excluir: icone('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'),
  graficos: icone('M4 20l16-16M4 14l10-10M10 20l10-10'),
  mostrar: icone('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
  enquadrar: icone('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'),
  folha: icone('M4 5h16v14H4zM14 19v-5h6'),
  enviar: icone('M3 4h18v16H3zM12 8v8M8 12l4 4 4-4'),
  tabela: icone('M4 4h16v16H4zM4 10h16M10 10v10'),
  pdf: icone('M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4'),
  dxf: icone('M4 4h16v16H4zM4 4l16 16M20 4L4 20'),
  imagem: icone('M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6'),
  vetor: icone('M5 19L19 5M5 19a2 2 0 1 0 0 .01M19 5a2 2 0 1 0 0 .01M8 5h5M19 11v5'),
} satisfies Record<string, Desenho>;
