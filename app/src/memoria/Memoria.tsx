/*
  A TELA DA MEMÓRIA: índice dos cards à esquerda, cards à direita — só os que se aplicam a este muro. Painel é
  rótulo + conta + número; nada de texto explicando (regra do dono).
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import type { Card } from './tipos';
import { cardsDaMemoria, verificacoesDe } from './cards';
import { comDiagramasDosEsforcos } from './desenhoDosEsforcos';
import { CardMemoria } from './CardMemoria';
import { TabelaResumo } from './TabelaResumo';
import { TELA } from './estilos';
import { exportarWord, imprimirMemorial } from './imprimir';
import type { InfoDoMemorial } from './MemorialImpresso';
import './memoria.css';

export interface PropsDaMemoria {
  resultado: Resultado;
  /** O muro desenhado: o diagrama do aço de cada peça (vista Esforços) entra no card dela. Sem ele, sem diagrama. */
  modelo?: Modelo | null;
  /** Projeto, responsável, CREA, data — vão para o rosto do memorial impresso. */
  info?: InfoDoMemorial;
  urlDaFigura?: (figura: string) => string | null;
  /** Rolar até este card ao abrir (e a cada novo `pedido`): quem pede é a vista Esforços. */
  irParaCard?: { id: string; pedido: number } | null;
}

/** Cor do ponto do índice: verde se tudo passa, vermelho se algo não passa, nada se o card não verifica. */
function estado(card: Card): 'ok' | 'falha' | null {
  const vs = verificacoesDe([card]);
  if (vs.length === 0) return null;
  return vs.every((x) => x.v.passa) ? 'ok' : 'falha';
}

export function Memoria({ resultado, modelo, info, urlDaFigura, irParaCard }: PropsDaMemoria) {
  const cards = useMemo(() => comDiagramasDosEsforcos(cardsDaMemoria(resultado), resultado, modelo).filter((c) => c.aplicavel), [resultado, modelo]);
  const temResumo = useMemo(() => verificacoesDe(cards).length > 0, [cards]);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const folha = useRef<HTMLDivElement>(null);

  const ir = (id: string) => {
    setAtivo(id);
    folha.current?.querySelector(`[data-indice="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // o pedido de fora rola sem animação: a tela acabou de abrir e o card tem de estar lá na primeira olhada
  useEffect(() => {
    if (!irParaCard) return;
    const id = `mem-${irParaCard.id}`;
    // a tela acabou de montar: as contas (TeX) e as figuras ainda assentam a altura dos cards e a folha volta ao
    // topo; rola depois do quadro e de novo um instante depois, quando a altura já é a de verdade
    const rolar = () => {
      const el = folha.current?.querySelector(`[data-indice="${CSS.escape(id)}"]`);
      if (!el) return;
      setAtivo(id);
      el.scrollIntoView({ block: 'start' });
    };
    const q = requestAnimationFrame(rolar);
    const t = setTimeout(rolar, 200);
    return () => {
      cancelAnimationFrame(q);
      clearTimeout(t);
    };
  }, [irParaCard?.id, irParaCard?.pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  // O índice acompanha a rolagem: fica marcado o último card cujo topo já passou do alto da folha.
  const acompanhar = () => {
    const f = folha.current;
    if (!f) return;
    const topo = f.getBoundingClientRect().top + 40;
    let atual: string | null = null;
    f.querySelectorAll<HTMLElement>('[data-indice]').forEach((el) => {
      if (el.getBoundingClientRect().top <= topo) atual = el.dataset.indice ?? null;
    });
    if (atual !== ativo) setAtivo(atual);
  };

  const word = async () => {
    setOcupado(true);
    try {
      await exportarWord(resultado, { info, urlDaFigura, modelo });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mem-tela memoria" style={{ fontFamily: TELA.fonte, color: TELA.tinta }}>
      <nav className="mem-indice">
        {temResumo && (
          <button className="mem-item" aria-current={ativo === 'mem-resumo'} onClick={() => ir('mem-resumo')}>
            <span className="mem-ponto" />
            Resumo
          </button>
        )}
        {cards.map((c) => {
          const e = estado(c);
          const id = `mem-${c.id}`;
          return (
            <button key={c.id} className="mem-item" aria-current={ativo === id} onClick={() => ir(id)}>
              <span
                className="mem-ponto"
                style={{ background: e === 'ok' ? TELA.ok : e === 'falha' ? TELA.falha : 'transparent' }}
              />
              {c.titulo}
            </button>
          );
        })}
        <div className="mem-acoes">
          <button onClick={() => void imprimirMemorial(resultado, { info, urlDaFigura, modelo })}>Imprimir</button>
          <button onClick={() => void word()} disabled={ocupado}>
            Word
          </button>
        </div>
      </nav>

      <div className="mem-folha" ref={folha} onScroll={acompanhar}>
        {temResumo && (
          <div className="mem-bloco" data-indice="mem-resumo">
            <div style={{ fontSize: TELA.titulo, fontWeight: 700, marginBottom: 10 }}>Resumo</div>
            <TabelaResumo cards={cards} />
          </div>
        )}
        {cards.map((c) => (
          <div key={c.id} className="mem-bloco" data-indice={`mem-${c.id}`}>
            <CardMemoria card={c} r={resultado} urlDaFigura={urlDaFigura} />
          </div>
        ))}
      </div>
    </div>
  );
}
