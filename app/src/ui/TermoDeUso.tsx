// ═══════════════════════════════════════════════════════════════════════════
//  ui/TermoDeUso.tsx — a janela do Termo de Uso e a porta da primeira abertura
// ---------------------------------------------------------------------------
//  Dois jeitos de abrir a MESMA janela:
//   · ACEITE — na primeira abertura (ou com termo novo). Sem fechar, sem Esc,
//     sem clique fora: só "Não aceito" ou "Li e aceito" (item 2.1). Quem não
//     aceita fica com a tela vazia e um botão para reler; o app não sobe.
//   · LEITURA — pelo ícone da barra de cima, depois de aceito. Fecha como as
//     outras janelas, e o pé mostra quando foi aceito.
//  Nos dois, o link dos componentes de terceiros (item 10.3).
//
//  Na tela, só o termo: nada de texto explicando a janela (regra do dono).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { aceitarTermo, aceiteVigente, dataDoAceite, TEXTO_DO_TERMO } from '@/estado/termo';
import { blocosDoMarkdown, type Bloco, type Trecho } from './markdownSimples';
import { IconeFechar } from './icones';

/** O arquivo que scripts/terceiros.mjs gera em public/ — vai junto com o app. */
const URL_TERCEIROS = `${import.meta.env.BASE_URL}terceiros.txt`;

// O termo não muda com o app aberto: a árvore sai uma vez só.
const BLOCOS = blocosDoMarkdown(TEXTO_DO_TERMO);

type Props =
  | { modo: 'aceite'; aoAceitar: () => void; aoRecusar: () => void }
  | { modo: 'leitura'; aoFechar: () => void };

export function JanelaDoTermo(props: Props) {
  const corpo = useRef<HTMLDivElement>(null);
  const leitura = props.modo === 'leitura';
  const aoFechar = leitura ? props.aoFechar : null;

  useEffect(() => {
    // O foco no texto: PageDown e as setas rolam o termo logo de cara.
    corpo.current?.focus();
    if (!aoFechar) return;
    // Na captura e parando aí, como em Configurações: o Esc que fecha a janela
    // não pode chegar a um campo de entrada aberto embaixo.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aoFechar]);

  const aceite = leitura ? aceiteVigente() : null;

  // Portal para o <body>, pelo mesmo motivo das outras janelas: dentro da barra
  // de cima o véu ficaria preso na camada dela.
  return createPortal(
    <div
      className="modal-fundo"
      onMouseDown={(e) => {
        if (aoFechar && e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="modal-caixa termo" role="dialog" aria-modal="true" aria-labelledby="termo-titulo">
        <div className="modal-cabeca">
          <h3 id="termo-titulo">Termo de uso</h3>
          {aoFechar && (
            <button className="btn-icone" title="Fechar  ·  Esc" onClick={aoFechar}>
              <IconeFechar tamanho={16} />
            </button>
          )}
        </div>

        <div ref={corpo} className="termo-corpo" tabIndex={-1}>
          <Blocos blocos={BLOCOS} />
        </div>

        <div className="termo-pe">
          <a className="termo-link" href={URL_TERCEIROS} target="_blank" rel="noopener noreferrer">
            Componentes de terceiros
          </a>
          <span className="termo-espaco" />
          {props.modo === 'aceite' ? (
            <>
              <button type="button" className="btn-caixa" onClick={props.aoRecusar}>
                Não aceito
              </button>
              <button
                type="button"
                className="btn-caixa principal"
                onClick={() => {
                  aceitarTermo();
                  props.aoAceitar();
                }}
              >
                Li e aceito
              </button>
            </>
          ) : (
            aceite && (
              <span className="termo-aceite">
                <span className="cfg-rotulo">Aceito em</span> <span className="mono">{dataDoAceite(aceite)}</span>
              </span>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A porta da primeira abertura: o termo para aceitar; recusado, só o botão de
 * reler. `aoLiberar` só é chamado depois do aceite gravado.
 */
export function PortaDoTermo({ aoLiberar }: { aoLiberar: () => void }) {
  const [recusou, setRecusou] = useState(false);
  if (recusou) {
    return (
      <div className="termo-porta">
        <button type="button" className="btn-caixa" onClick={() => setRecusou(false)}>
          Reler o termo de uso
        </button>
      </div>
    );
  }
  return <JanelaDoTermo modo="aceite" aoAceitar={aoLiberar} aoRecusar={() => setRecusou(true)} />;
}

/* ── o texto ──────────────────────────────────────────────────────────── */

function Blocos({ blocos }: { blocos: Bloco[] }) {
  return (
    <>
      {blocos.map((b, i) => (
        <BlocoDoTermo key={i} bloco={b} />
      ))}
    </>
  );
}

function BlocoDoTermo({ bloco: b }: { bloco: Bloco }) {
  switch (b.tipo) {
    case 'titulo': {
      const filhos = <Trechos trechos={b.trechos} />;
      if (b.nivel === 1) return <h1>{filhos}</h1>;
      if (b.nivel === 2) return <h2>{filhos}</h2>;
      if (b.nivel === 3) return <h3>{filhos}</h3>;
      return <h4>{filhos}</h4>;
    }
    case 'paragrafo':
      return (
        <p className={b.recuado ? 'recuado' : undefined}>
          {b.linhas.map((l, i) => (
            <Linha key={i} quebra={i > 0}>
              <Trechos trechos={l} />
            </Linha>
          ))}
        </p>
      );
    case 'lista':
      return (
        <ol start={b.inicio}>
          {b.itens.map((it, i) => (
            <li key={i}>
              <Trechos trechos={it} />
            </li>
          ))}
        </ol>
      );
    case 'citacao':
      return (
        <blockquote>
          <Blocos blocos={b.blocos} />
        </blockquote>
      );
    case 'regua':
      return <hr />;
  }
}

function Linha({ quebra, children }: { quebra: boolean; children: ReactNode }) {
  return (
    <>
      {quebra && <br />}
      {children}
    </>
  );
}

function Trechos({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.negrito ? <strong key={i}>{t.texto}</strong> : t.italico ? <em key={i}>{t.texto}</em> : <span key={i}>{t.texto}</span>,
      )}
    </>
  );
}
