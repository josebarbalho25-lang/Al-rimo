// ═══════════════════════════════════════════════════════════════════════════
//  App.tsx — a concha
// ---------------------------------------------------------------------------
//   ┌────┬─────────────────────────────────────────────────────────┐
//   │ ▣  │ Exemplo — muro em balanço •   │ salvar │ desfazer refazer │
//   │ ⌂  │ Gráfica                                                 │
//   │ ⚙  ├─────────────────────────────────────────────────────────┤
//   │ ✎  │                                                         │
//   │ ∑  │                    A SEÇÃO ABERTA                       │
//   │ ▦  │                                                         │
//   │ ▭  │                                                         │
//   │ ☾  ├─────────────────────────────────────────────────────────┤
//   │    │ Passa │ recado …              Balanço · bloco 19x39     │
//   └────┴─────────────────────────────────────────────────────────┘
//  A organização do Pró-Viga (Jose, 20/10; protótipo aprovado no mesmo dia):
//  o trilho de seções à esquerda e cada seção uma tela inteira — Início,
//  Configurações, Entradas, Memória de cálculo, Quantitativo e Gráfica (as
//  vistas e as pranchas). O que era a barra de cima foi para o Início (arquivo
//  e saídas), para o cabeçalho (salvar, desfazer) e para as Configurações.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { abrirProjeto, salvarProjeto } from '@/estado/acoesDeArquivo';
import { CHAVES, guardar, lembrarLarguraDoPainel } from '@/estado/lembrete';
import { aceiteVigente } from '@/estado/termo';
import { useApp } from '@/estado/store';
import { usePreferencias } from '@/estilo/preferenciasDaInterface';
import { BarraDeEstado } from '@/ui/BarraDeEstado';
import { TelaDeConfiguracoes } from '@/ui/Configuracoes';
import { Palco } from '@/ui/Palco';
import { SecaoGrafica } from '@/ui/grafica/SecaoGrafica';
import { useInterface } from '@/estado/interface';
import { TelaDeEntradas } from '@/ui/EntradaPorFiguras';
import { Chevron } from '@/ui/icones';
import { JanelaDeGraficos } from '@/ui/JanelaDeGraficos';
import { useJanelaDeGraficos } from '@/desenhos/useJanelaDeGraficos';
import { PainelDeEntradas } from '@/ui/PainelDeEntradas';
import { TelaInicio } from '@/ui/TelaInicio';
import { PortaDoTermo } from '@/ui/TermoDeUso';
import { CabecalhoDaSecao, Trilho } from '@/ui/Trilho';
import { ehCampoDeTexto } from '@/ui/teclado';

/** Faixa da largura do painel ao arrastar, em px de TELA. */
const LARGURA_MIN = 300;
const LARGURA_MAX = 720;

/*
  Sem o aceite do termo vigente, a casca NEM MONTA (item 2.1: o uso só é
  liberado depois do aceite). Não basta pôr a janela por cima: com a casca
  montada embaixo, o Ctrl+O e o Ctrl+S continuariam abrindo e salvando muro.
*/
export function App() {
  const [liberado, setLiberado] = useState(() => aceiteVigente() !== null);
  if (!liberado) return <PortaDoTermo aoLiberar={() => setLiberado(true)} />;
  return <Casca />;
}

function Casca() {
  useAtalhos();
  const secao = useInterface((s) => s.secao);
  // A janela de Gráficos de uma vista ou do 3D é da Gráfica: saindo dela, fecha como está (mexer numa vista que não
  // está à vista não serve). A geral (Configurações) fica.
  useEffect(() => {
    const j = useJanelaDeGraficos.getState();
    if (secao !== 'grafica' && j.alvo && j.alvo.tipo !== 'geral') j.fechar();
  }, [secao]);
  return (
    <div className="app" data-secao={secao}>
      <Trilho />
      <div className="secao">
        <CabecalhoDaSecao />
        <div className="secao-corpo">
          {secao === 'inicio' && <TelaInicio />}
          {secao === 'configuracoes' && <TelaDeConfiguracoes />}
          {secao === 'entradas' && <TelaDeEntradas />}
          {secao === 'memoria' && <SecaoDaMemoria />}
          {secao === 'quantitativo' && <Palco aba="quantitativo" />}
          {/* A Gráfica fica montada, escondida: ir às Entradas mudar um número e voltar acha o 3D na mesma câmera, com
              as ocultas, a Armadura e o corte como estavam, e a folha no mesmo zoom (antes de 20/10 as Entradas eram
              uma janela por cima, e o 3D nem saía de baixo). O teclado das vistas só responde à que está à vista. */}
          <SecaoGrafica escondida={secao !== 'grafica'} />
        </div>
      </div>
      <BarraDeEstado />
      <JanelaDeGraficos />
    </div>
  );
}

/**
 * A Memória com a lista de entradas ao lado (Jose, 20/10: "a entrada resumo como uma segunda aba lateral que abre e
 * recolhe do jeito que existe hoje, mas só na seção da memória de cálculo"): confere-se número contra entrada sem
 * trocar de tela.
 */
function SecaoDaMemoria() {
  const { escala } = usePreferencias();
  // Em px na escala 100%: a tela multiplica pela escala, e o painel que ele
  // alargou cresce junto quando a letra cresce (ver lembrarLarguraDoPainel).
  const [largura, setLargura] = useState<number | null>(lembrarLarguraDoPainel);
  // Sem largura escolhida, vale a do token (que também acompanha a escala).
  const estilo = largura
    ? ({ '--entradas-w': `calc(${largura}px * var(--escala-ui))` } as CSSProperties)
    : undefined;
  const recolhida = useInterface((s) => s.listaRecolhida);
  const alternarLista = useInterface((s) => s.alternarLista);
  return (
    <div className="secao-memoria" style={estilo} data-lista={recolhida ? 'recolhida' : undefined}>
      <div className="coluna-entradas">
        {recolhida ? (
          // A faixa fina: a memória fica com a tela; um clique traz a lista de volta como estava.
          <button type="button" className="faixa-entradas" title="Mostrar a lista" aria-label="Mostrar a lista" onClick={alternarLista}>
            <Chevron />
            <span>Entradas</span>
          </button>
        ) : (
          <>
            <PainelDeEntradas />
            <AlcaDeLargura escala={escala} aoMudar={setLargura} />
          </>
        )}
      </div>
      <Palco aba="memoria" />
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

/**
 * Ctrl+S salva, Ctrl+Shift+S salva como, Ctrl+O abre, Ctrl+Z desfaz, Ctrl+Y (ou Ctrl+Shift+Z) refaz. (Ctrl+N é do
 * navegador e não se toma.) Dentro de um campo de texto o Ctrl+Z é do campo — desfaz a letra, não o muro.
 */
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
      } else if (k === 'z' || k === 'y') {
        if (ehCampoDeTexto(e.target)) return;
        e.preventDefault();
        const s = useApp.getState();
        if (k === 'y' || e.shiftKey) s.refazer();
        else s.desfazer();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
}

