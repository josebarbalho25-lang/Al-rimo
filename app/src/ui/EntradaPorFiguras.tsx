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

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { campoEspelhado, secaoVisivel } from '@/estado/campos';
import { CAMPOS, SECOES } from '@/estado/store';
import { figuraDaEntrada } from '@/figuras/mapa';
import { CorteDoMuro } from '@/figuras/dinamicas/CorteDoMuro';
import type { Valor } from '@/motor/tipos';
import { CalculadoraDoSolo } from './CalculadoraDoSolo';
import { CalculadoraDaTensao } from './CalculadoraDaTensao';
import { CampoNumero, Escolha, Lista } from './controles';
import { IconeFechar } from './icones';
import { LinhaDeEntrada, linhasDaSecao, useLinhasDeEntrada } from './PainelDeEntradas';

/** Abas em que o corte vivo é a figura. */
const ABAS_DO_CORTE = new Set(['muro', 'solo', 'fundacao']);
/** Campos que o corte vivo mostra (os outros campos dessas abas mostram a figura fixa deles). */
const NO_CORTE = new Set(['H_muro', 'H_solo', 't_bloco', 'Tipo_muro', 'q_sobre', 'Agua', 'z_NA', 'B_sap', 'h_sap', 'a_ater', 'h_fr']);

export function EntradaPorFiguras({ aoFechar }: { aoFechar: () => void }) {
  const { ler, propsDaLinha } = useLinhasDeEntrada();
  const secoes = SECOES.filter((s) => secaoVisivel(s, ler));
  const [aba, setAba] = useState(secoes[0]?.id ?? '');
  const [ativo, setAtivo] = useState<string | null>(null);
  const [focar, setFocar] = useState<string | null>(null);
  const campos = useRef<HTMLDivElement>(null);
  const caixaDaFigura = useRef<HTMLDivElement>(null);
  // A cota clicada no corte vivo: a caixinha do número abre em cima dela, como no CAD (Jose, 12/10).
  const [editando, setEditando] = useState<{ nome: string; x: number; y: number } | null>(null);
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

  // Clique numa cota: a caixinha do número abre ali mesmo, em cima da cota; a aba não troca (a figura fica).
  const irPara = useCallback((nome: string, e: MouseEvent) => {
    const r = caixaDaFigura.current?.getBoundingClientRect();
    setAtivo(nome);
    if (r) setEditando({ nome, x: e.clientX - r.left, y: e.clientY - r.top });
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
          <div className="pf-figura-caixa" ref={caixaDaFigura}>
            <div className="prancheta pf-figura">
              {figura === 'corte' ? (
                <CorteDoMuro ler={ler} aoClicar={irPara} ativo={ativo} />
              ) : figura ? (
                <img className="figura-img" src={figura.url} alt={figura.titulo} draggable={false} />
              ) : null}
              {figura && figura !== 'corte' && <div className="pf-legenda">{figura.titulo}</div>}
            </div>
            {/* fora da prancheta: ela inverte no tema escuro, a caixinha não */}
            {editando && figura === 'corte' && (
              <EditorDeCota
                {...editando}
                props={propsDaLinha(CAMPOS.get(editando.nome)!)}
                aoFechar={() => setEditando(null)}
              />
            )}
          </div>
          <div
            className="pf-campos"
            ref={campos}
            onFocusCapture={(e) => {
              const nome = (e.target as HTMLElement).closest<HTMLElement>('[data-campo]')?.dataset.campo;
              if (nome) setAtivo(nome);
            }}
          >
            {secao &&
              linhasDaSecao(secao.campos, ler).map((l) => {
                if ('grupo' in l) return <div className="entrada-grupo" key={`g:${l.grupo}`}>{l.grupo}</div>;
                const p = propsDaLinha(l.campo);
                return <LinhaDeEntrada key={l.campo.meta.nome} {...p} comDesenho figuraAberta={ativo === p.campo.meta.nome} abrirFigura={mostrarFigura} />;
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

/**
 * A caixinha do número em cima da cota clicada: o mesmo controle da linha (número, lista ou escolha), com as mesmas
 * travas. Cada tecla já vai para a conta e o desenho acompanha; Enter ou clique fora fecha; Esc desfaz e fecha.
 */
function EditorDeCota({
  x,
  y,
  props: p,
  aoFechar,
}: {
  nome: string;
  x: number;
  y: number;
  props: ReturnType<ReturnType<typeof useLinhasDeEntrada>['propsDaLinha']>;
  aoFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caixa.current?.querySelector<HTMLElement>('input, select, button')?.focus();
  }, []);
  const c = p.campo;
  const mudar = (v: Valor) => p.definir(c.meta.nome, v);
  let controle;
  if (c.controle === 'numero')
    controle = <CampoNumero campo={c} valor={p.valor} aoMudar={mudar} desabilitado={p.travado} auto={p.auto} />;
  else if (c.controle === 'lista')
    controle = <Lista opcoes={p.opcoes} valor={p.valor} rotulo={c.curto} aoEscolher={(v) => { mudar(v); aoFechar(); }} desabilitado={p.travado} />;
  else controle = <Escolha opcoes={p.opcoes} valor={p.valor} rotulo={c.curto} aoEscolher={(v) => { mudar(v); aoFechar(); }} />;
  return (
    <div
      ref={caixa}
      className="editor-cota"
      style={{ left: x, top: y }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) aoFechar();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();   // Esc fecha a caixinha, não a janela inteira
      }}
    >
      <span>{c.curto}</span>
      {controle}
      <span className="unidade">{c.meta.unidade}</span>
    </div>
  );
}
