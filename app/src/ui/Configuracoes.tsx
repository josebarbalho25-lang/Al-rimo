// ═══════════════════════════════════════════════════════════════════════════
//  ui/Configuracoes.tsx — a seção Configurações (a engrenagem do trilho)
// ---------------------------------------------------------------------------
//  Os ajustes de interface do A-PORT (Configurações > Interface e Aparência):
//  tamanho, densidade, tema e as cores de seleção e alerta. Lá são cinco
//  tópicos num menu vertical; aqui sobram estes, e cabem numa página só —
//  decide-se olhando, sem trocar de tópico. Era janela por cima até 20/10;
//  com o trilho virou seção, como no Pró-Viga.
//
//  Cada clique vale NA HORA (a tela inteira cresce junto quando o tamanho
//  muda: é a prévia). Por isso não há "Aplicar" nem "Cancelar".
//
//  Linha = rótulo + controle. Sem texto explicando o ajuste (regra do dono).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useState, type ReactNode } from 'react';
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
import { VERSAO_DA_CONTA } from '@/estado/store';
import { JanelaDoTermo } from './TermoDeUso';
import { useJanelaDeGraficos } from '@/desenhos/useJanelaDeGraficos';
import { useGraficos } from '@/desenhos/useGraficos';

export function TelaDeConfiguracoes() {
  const pref = usePreferencias();
  const [termo, setTermo] = useState(false);
  const fecharTermo = useCallback(() => setTermo(false), []);

  return (
    <div className="tela-cfg">
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

          {/* A tabela GERAL de gráficos (Jose, 16/10: "a do menu da engrenagem é a geral; a da vista, Sobreposição"):
              guardada no app, vale para toda vista que não sobrepõe */}
          <h4>Desenhos e 3D</h4>
          <Linha rotulo="Gráficos">
            <div className="cad-escolha">
              <button type="button" onClick={() => useJanelaDeGraficos.getState().abrir({ tipo: 'geral' })}>
                Gerais
              </button>
            </div>
          </Linha>
          <div className="cfg-linha">
            <span />
            <button type="button" className="btn-caixa" onClick={() => useGraficos.getState().restaurar()}>Restaurar padrão</button>
          </div>

          {/* o § e a versão saíram da barra de cima com o trilho (20/10) */}
          <h4>Sobre</h4>
          <div className="cfg-linha">
            <span className="cfg-rotulo">Termo de uso</span>
            <div>
              <button type="button" className="btn-caixa" onClick={() => setTermo(true)}>Ler</button>
            </div>
          </div>
          <div className="cfg-linha">
            <span className="cfg-rotulo">Conta</span>
            <span className="cfg-valor">{VERSAO_DA_CONTA.slice(0, 8)}</span>
          </div>
      </div>
      {termo && <JanelaDoTermo modo="leitura" aoFechar={fecharTermo} />}
    </div>
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
