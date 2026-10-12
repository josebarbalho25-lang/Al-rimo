// ═══════════════════════════════════════════════════════════════════════════
//  ui/EntradaPorFiguras.tsx — a entrada por figuras (PILOTO, Jose, 10/10)
// ---------------------------------------------------------------------------
//  Como os dados de vento do A-PORT: um modal grande, uma aba por grupo de
//  entradas, com a figura de um lado e os campos do outro. As abas são as
//  mesmas seções do painel lateral (que continua lá para o ajuste rápido).
//
//  A figura acompanha o que se edita:
//    - Geometria, Solo e cargas, Fundação: o corte do muro DESENHADO COM OS
//      VALORES (figuras/dinamicas/CorteDoMuro.tsx); clicar numa cota leva ao
//      campo dela, trocando de aba se precisar;
//    - nas outras abas, e nos campos que o corte não mostra (dente, armadura,
//      FS...), a figura fixa do campo em foco.
//  As calculadoras de consulta vão junto, na aba em que servem (Ka/Kp e argila
//  no Solo; σadm pelo SPT na Fundação) — a "mini conta no caminho".
//
//  Os campos são as mesmas linhas do painel (LinhaDeEntrada): a mesma conta,
//  as mesmas travas e avisos. Fecha com Esc ou ✕; clique fora não fecha (é
//  tela de edição).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { campoEspelhado, secaoVisivel } from '@/estado/campos';
import { SECOES } from '@/estado/store';
import { figuraDaEntrada } from '@/figuras/mapa';
import { CorteDoMuro } from '@/figuras/dinamicas/CorteDoMuro';
import { CalculadoraDoSolo } from './CalculadoraDoSolo';
import { CalculadoraDaTensao } from './CalculadoraDaTensao';
import { IconeFechar } from './icones';
import { LinhaDeEntrada, useLinhasDeEntrada } from './PainelDeEntradas';

/** Abas em que o corte vivo é a figura. */
const ABAS_DO_CORTE = new Set(['geometria', 'solo', 'fundacao']);
/** Campos que o corte vivo mostra (os outros campos dessas abas mostram a figura fixa deles). */
const NO_CORTE = new Set(['H_muro', 'H_solo', 't_bloco', 'Tipo_muro', 'q_sobre', 'Agua', 'z_NA', 'B_sap', 'h_sap', 'a_ater']);

export function EntradaPorFiguras({ aoFechar }: { aoFechar: () => void }) {
  const { ler, propsDaLinha } = useLinhasDeEntrada();
  const secoes = SECOES.filter((s) => secaoVisivel(s, ler));
  const [aba, setAba] = useState(secoes[0]?.id ?? '');
  const [ativo, setAtivo] = useState<string | null>(null);
  const [focar, setFocar] = useState<string | null>(null);
  const campos = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const secao = secoes.find((s) => s.id === aba) ?? secoes[0];

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (e.target as HTMLElement | null)?.tagName !== 'INPUT') {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener('keydown', tecla, true);
    caixa.current?.focus();
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aoFechar]);

  // Clique numa cota: vai para a aba do campo e põe o cursor nele.
  const irPara = useCallback((nome: string) => {
    const dono = SECOES.find((s) => s.campos.some((c) => c.meta.nome === nome));
    if (dono) setAba(dono.id);
    setAtivo(nome);
    setFocar(nome);
  }, []);
  useEffect(() => {
    if (!focar) return;
    const el = campos.current?.querySelector<HTMLElement>(`[data-campo="${focar}"] input, [data-campo="${focar}"] button`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
    setFocar(null);
  }, [focar, aba]);

  const figura = useMemo(() => {
    if (!secao) return null;
    const fixaDe = (nome: string | null) => (nome ? figuraDaEntrada(nome) : null);
    // a linha espelho (o "l" da Geometria) é o campo que ela espelha: foco nela mostra a figura dele
    const nomes = secao.campos.map((c) => campoEspelhado(c.meta.nome, ler)?.alvo ?? c.meta.nome);
    const ativoAqui = ativo && nomes.includes(ativo) ? ativo : null;
    if (ABAS_DO_CORTE.has(secao.id) && (!ativoAqui || NO_CORTE.has(ativoAqui) || !fixaDe(ativoAqui))) return 'corte' as const;
    return fixaDe(ativoAqui) ?? secao.campos.map((c) => fixaDe(c.meta.nome)).find(Boolean) ?? null;
  }, [secao, ativo, ler]);

  // O botão de figura de cada linha, aqui, só troca a figura da esquerda.
  const mostrarFigura = useCallback((nome: string) => setAtivo(nome), []);

  return createPortal(
    <div className="modal-fundo">
      <div ref={caixa} className="modal-caixa por-figuras" role="dialog" aria-modal="true" aria-label="Entrada por figuras" tabIndex={-1}>
        <div className="modal-cabeca">
          <h3>Entrada por figuras</h3>
          <button className="btn-icone" title="Fechar  ·  Esc" onClick={aoFechar}>
            <IconeFechar tamanho={16} />
          </button>
        </div>
        <div className="pf-abas" role="tablist">
          {secoes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === secao?.id}
              className={`pf-aba${s.id === secao?.id ? ' on' : ''}`}
              onClick={() => {
                setAba(s.id);
                setAtivo(null);
              }}
            >
              {s.titulo}
            </button>
          ))}
        </div>
        <div className="pf-corpo">
          <div className="prancheta pf-figura">
            {figura === 'corte' ? (
              <CorteDoMuro ler={ler} aoClicar={irPara} ativo={ativo} />
            ) : figura ? (
              <img className="figura-img" src={figura.url} alt={figura.titulo} draggable={false} />
            ) : null}
            {figura && figura !== 'corte' && <div className="pf-legenda">{figura.titulo}</div>}
          </div>
          <div
            className="pf-campos"
            ref={campos}
            onFocusCapture={(e) => {
              const nome = (e.target as HTMLElement).closest<HTMLElement>('[data-campo]')?.dataset.campo;
              if (nome) setAtivo(nome);
            }}
          >
            {secao?.campos.map((c) => {
              const p = propsDaLinha(c);
              return <LinhaDeEntrada key={c.meta.nome} {...p} figuraAberta={ativo === p.campo.meta.nome} abrirFigura={mostrarFigura} />;
            })}
            {secao?.id === 'solo' && <CalculadoraDoSolo />}
            {secao?.id === 'fundacao' && <CalculadoraDaTensao />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
