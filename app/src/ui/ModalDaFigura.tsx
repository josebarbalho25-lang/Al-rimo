// ═══════════════════════════════════════════════════════════════════════════
//  ui/ModalDaFigura.tsx — a figura de referência de uma entrada
// ---------------------------------------------------------------------------
//  Abre por cima de tudo e fecha com Esc, com o ✕ ou com clique fora — não há
//  edição a perder (mesma regra da janela de consulta do A-PORT; a ficha que
//  EDITA não fecha com clique fora). Cabeçalho = título da figura; corpo = só
//  o desenho. Sem legenda, sem rodapé, sem texto de ajuda. Exceção: a figura
//  dos solos (fig22) traz embaixo a calculadora de consulta (Ka/Kp e argila),
//  que só mostra — não edita nada, então clique fora continua fechando.
//
//  A figura aparece LIMPA, como foi desenhada. Ela já acendeu a grandeza da
//  entrada com um halo laranja e esmaeceu as outras; o Jose tirou (09/10):
//  "essa cor no SVG tá poluindo". Sem o destaque o SVG não precisa mais ser
//  injetado no documento: vai numa <img>, que o navegador guarda em cache e
//  que não deixa o desenho mexer na página.
//
//  As figuras são desenhadas CLARAS (papel branco). No tema escuro a placa
//  inverte (`.prancheta`, componentes.css) — receita aprovada pelo Jose no
//  Pró-Viga: cada matiz volta ao lugar e o papel vira cinza-escuro.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { figuraDaEntrada } from '@/figuras/mapa';
import { IconeFechar } from './icones';
import { CalculadoraDoSolo } from './CalculadoraDoSolo';

/** A figura de uma entrada (com id) ou de uma peça do quantitativo (sem id: nunca é a dos solos). */
export type FiguraDaEntrada = Omit<NonNullable<ReturnType<typeof figuraDaEntrada>>, 'id'> & { id?: string };

export function ModalDaFigura({ figura, aoFechar }: { figura: FiguraDaEntrada; aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Na captura, e parando aí: o Esc que fecha a figura não pode chegar ao
    // campo de baixo (que desfaria a edição em curso).
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener('keydown', tecla, true);
    // O foco vai para a CAIXA, não para o ✕: com o ✕ focado o navegador
    // desenha o sublinhado de foco nele, e o modal abria com um botão aceso.
    caixa.current?.focus();
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aoFechar]);

  // ⚠️ PORTAL para o <body>: o painel de entradas é uma camada própria (z-index
  // da coluna), e um `position: fixed` lá dentro ficava preso nela — o véu
  // escurecia o painel e o palco, mas a barra de cima e a de estado passavam
  // por cima do modal, acesas.
  return createPortal(
    <div
      className="modal-fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div ref={caixa} className="modal-caixa figura" role="dialog" aria-modal="true" aria-label={figura.titulo} tabIndex={-1}>
        <div className="modal-cabeca">
          <h3>{figura.titulo}</h3>
          <button className="btn-icone" title="Fechar  ·  Esc" onClick={aoFechar}>
            <IconeFechar tamanho={16} />
          </button>
        </div>
        <div className="figura-corpo">
          <div className="prancheta figura-placa">
            <img className="figura-img" src={figura.url} alt={figura.titulo} draggable={false} />
          </div>
          {/* tabelas de solo: a consulta de Ka/Kp e da argila fica embaixo, sem mexer no formulário (Jose, 09/10) */}
          {figura.id === 'fig22' && <CalculadoraDoSolo />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
