// ═══════════════════════════════════════════════════════════════════════════
//  ui/Configuracoes.tsx — a janela de configurações (engrenagem da barra de cima)
// ---------------------------------------------------------------------------
//  Os ajustes de interface do A-PORT (Configurações > Interface e Aparência):
//  tamanho, densidade, tema e as cores de seleção e alerta. Lá são cinco
//  tópicos num menu vertical; aqui sobram estes, e cabem numa página só —
//  decide-se olhando, sem trocar de tópico.
//
//  Cada clique vale NA HORA (a janela cresce junto quando o tamanho muda: é a
//  prévia). Por isso não há "Aplicar" nem "Cancelar", e fechar com Esc ou
//  clique fora não perde nada — a mesma regra do modal da figura.
//
//  Linha = rótulo + controle. Sem texto explicando o ajuste (regra do dono).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CORES,
  DENSIDADES,
  ESCALAS,
  NOME_DA_DENSIDADE,
  NOME_DO_TEMA,
  TEMAS,
  corDoTema,
  definirPreferencia,
  restaurarCores,
  usePreferencias,
} from '@/estilo/preferenciasDaInterface';
import { IconeFechar } from './icones';
import { TabelaDeGraficos } from './TabelaDeGraficos';

export function Configuracoes({ aoFechar }: { aoFechar: () => void }) {
  const pref = usePreferencias();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Na captura e parando aí, como no modal da figura: o Esc que fecha a
    // janela não pode chegar a um campo de entrada aberto embaixo.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener('keydown', tecla, true);
    caixa.current?.focus();
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aoFechar]);

  // Portal para o <body>, pelo mesmo motivo do modal da figura: dentro da
  // barra de cima (camada própria) o véu ficaria preso nela.
  return createPortal(
    <div
      className="modal-fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div ref={caixa} className="modal-caixa cfg" role="dialog" aria-modal="true" aria-label="Configurações" tabIndex={-1}>
        <div className="modal-cabeca">
          <h3>Configurações</h3>
          <button className="btn-icone" title="Fechar  ·  Esc" onClick={aoFechar}>
            <IconeFechar tamanho={16} />
          </button>
        </div>

        <div className="cfg-corpo">
          <h4>Interface</h4>
          <Linha rotulo="Tamanho">
            {ESCALAS.map((e) => (
              <Opcao key={e} on={pref.escala === e} aoEscolher={() => definirPreferencia('escala', e)}>
                {Math.round(e * 100)}%
              </Opcao>
            ))}
          </Linha>
          <Linha rotulo="Densidade">
            {DENSIDADES.map((d) => (
              <Opcao key={d} on={pref.densidade === d} aoEscolher={() => definirPreferencia('densidade', d)}>
                {NOME_DA_DENSIDADE[d]}
              </Opcao>
            ))}
          </Linha>
          <Linha rotulo="Tema">
            {TEMAS.map((t) => (
              <Opcao key={t} on={pref.tema === t} aoEscolher={() => definirPreferencia('tema', t)}>
                {NOME_DO_TEMA[t]}
              </Opcao>
            ))}
          </Linha>

          {/* As cores com os nomes do painel de Cores do Revit, que ele já
              reconhece. Sem escolha, a amostra mostra a cor do tema em uso. */}
          <h4>Cores</h4>
          {CORES.map((c) => (
            <div className="cfg-linha" key={c.campo}>
              <label className="cfg-rotulo" htmlFor={`cfg-${c.campo}`}>{c.rotulo}</label>
              <input
                id={`cfg-${c.campo}`}
                type="color"
                className="cfg-cor"
                value={pref[c.campo] ?? corDoTema(c.token)}
                onChange={(ev) => definirPreferencia(c.campo, ev.target.value)}
              />
            </div>
          ))}
          <div className="cfg-linha">
            <span />
            <button
              type="button"
              className="btn-caixa"
              disabled={CORES.every((c) => !pref[c.campo])}
              onClick={() => restaurarCores()}
            >
              Restaurar cores do tema
            </button>
          </div>

          {/* Cores e hachuras dos desenhos e do 3D (Jose, 15/10): guardadas no app, valem para todo muro */}
          <h4>Desenhos e 3D</h4>
          <TabelaDeGraficos />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="cfg-linha">
      <span className="cfg-rotulo">{rotulo}</span>
      <div className="cad-escolha" role="radiogroup" aria-label={rotulo}>
        {children}
      </div>
    </div>
  );
}

function Opcao({ on, aoEscolher, children }: { on: boolean; aoEscolher: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={on ? 'on' : undefined} onClick={aoEscolher}>
      {children}
    </button>
  );
}
