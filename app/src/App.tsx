// ═══════════════════════════════════════════════════════════════════════════
//  App.tsx — a concha
// ---------------------------------------------------------------------------
//   ┌──────────────────────────────────────────────────────────────┐
//   │ TOPBAR  nome •  │ novo abrir salvar │ IFC imprimir │ ⚙  tema  │
//   ├──────────────────┬───────────────────────────────────────────┤
//   │ ENTRADAS         │ 3D │ Vista frontal │ Corte │ … │ Memória │  │
//   │ ▾ GEOMETRIA      ├───────────────────────────────────────────┤
//   │  h    1,60  m ▣  │                                           │
//   │ ▸ SOLO E CARGAS  │              PALCO / FOLHA                │
//   ├──────────────────┴───────────────────────────────────────────┤
//   │ Passa │ recado …                    Balanço · bloco 19x39 · conta │
//   └──────────────────────────────────────────────────────────────┘
//  Sem trilho e sem fita (o A-PORT tem os dois): aqui toda a modelagem é por
//  entradas, e não há comando de desenho para pôr em fita.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { abrirProjeto, salvarProjeto } from '@/estado/acoesDeArquivo';
import { CHAVES, guardar, lembrarLarguraDoPainel } from '@/estado/lembrete';
import { usePreferencias } from '@/estilo/preferenciasDaInterface';
import { BarraDeEstado } from '@/ui/BarraDeEstado';
import { AbasDoPalco, Palco } from '@/ui/Palco';
import { PainelDeEntradas } from '@/ui/PainelDeEntradas';
import { TopBar } from '@/ui/TopBar';

/** Faixa da largura do painel ao arrastar, em px de TELA. */
const LARGURA_MIN = 300;
const LARGURA_MAX = 720;

export function App() {
  useAtalhos();
  const { escala } = usePreferencias();
  // Em px na escala 100%: a tela multiplica pela escala, e o painel que ele
  // alargou cresce junto quando a letra cresce (ver lembrarLarguraDoPainel).
  const [largura, setLargura] = useState<number | null>(lembrarLarguraDoPainel);

  // Sem largura escolhida, vale a do token (que também acompanha a escala).
  const estilo = largura
    ? ({ '--entradas-w': `calc(${largura}px * var(--escala-ui))` } as CSSProperties)
    : undefined;

  return (
    <div className="app" style={estilo}>
      <TopBar />
      <div className="coluna-entradas">
        <PainelDeEntradas />
        <AlcaDeLargura escala={escala} aoMudar={setLargura} />
      </div>
      <AbasDoPalco />
      <Palco />
      <BarraDeEstado />
    </div>
  );
}

/** A alça na borda direita do painel: arrasta a largura; duplo clique volta ao padrão. */
function AlcaDeLargura({ escala, aoMudar }: { escala: number; aoMudar: (base: number | null) => void }) {
  const arrasto = useRef<{ x0: number; l0: number } | null>(null);
  // A mão arrasta px de tela; o que se guarda é px na escala 100%.
  const base = (a: { x0: number; l0: number }, x: number) =>
    Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, a.l0 + x - a.x0)) / escala);
  return (
    <div
      className="alca-largura"
      onPointerDown={(e) => {
        const painel = e.currentTarget.parentElement;
        if (!painel) return;
        arrasto.current = { x0: e.clientX, l0: painel.getBoundingClientRect().width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const a = arrasto.current;
        if (!a) return;
        aoMudar(base(a, e.clientX));
      }}
      onPointerUp={(e) => {
        const a = arrasto.current;
        arrasto.current = null;
        if (!a) return;
        guardar(CHAVES.largura, base(a, e.clientX));
      }}
      onDoubleClick={() => {
        aoMudar(null);
        guardar(CHAVES.largura, null);
      }}
    />
  );
}

/** Ctrl+S salva, Ctrl+Shift+S salva como, Ctrl+O abre. (Ctrl+N é do navegador e não se toma.) */
function useAtalhos() {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void salvarProjeto(e.shiftKey);
      } else if (k === 'o' && !e.shiftKey) {
        e.preventDefault();
        void abrirProjeto();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
}
