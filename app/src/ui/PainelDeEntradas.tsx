// ═══════════════════════════════════════════════════════════════════════════
//  ui/PainelDeEntradas.tsx — o painel da esquerda: todas as entradas do muro
// ---------------------------------------------------------------------------
//  Uma linha por entrada, sempre nas mesmas quatro colunas:
//
//     [ rótulo curto ][ controle ][ unidade ][ figura ]
//
//  A coluna da figura EXISTE SEMPRE, vazia quando a entrada não tem figura: o
//  olho acha o botão sempre no mesmo lugar e a unidade não dança de linha
//  para linha. O rótulo completo e a observação da planilha ficam no pairar
//  (`title`). Nada mais se escreve no painel — regra do dono: painel é rótulo
//  + valor + controle.
//
//  As seções vêm da planilha (+ as do modelo), em grupos recolhíveis que
//  NASCEM TODOS FECHADOS (Jose, 09/10: "pra não ficar com cara de lista
//  infinita, pra não assustar os usuários") — quem abre o app vê o índice das
//  seções, não cento e tantas linhas. O que o usuário abre ou fecha é lembrado
//  pela máquina, como no navegador do A-PORT.
//
//  A figura de cada entrada vem do mapa da frente das figuras
//  (dados/figuras.json → '@/figuras/mapa'), e não de `EntradaMeta.figura`: a
//  coluna Figura da planilha é o mapa antigo e já discorda dele.
// ═══════════════════════════════════════════════════════════════════════════

import { memo, useCallback, useMemo, useState } from 'react';
import type { Valor } from '@/motor/tipos';
import type { Ajuste } from '@/modelo/tipos';
import {
  entradaAtiva,
  entradaDoAjuste,
  opcoesDoCampo,
  secaoVisivel,
  valorTravado,
  type Campo,
  type Opcao,
  type Secao,
} from '@/estado/campos';
import { CHAVES, ehMapaDeBooleanos, guardar, lembrar } from '@/estado/lembrete';
import { escreverNoCampo } from '@/estado/numeros';
import { CAMPOS, leitorDoEstado, SECOES, useApp } from '@/estado/store';
import { figuraDaEntrada } from '@/figuras/mapa';
import { CampoNumero, Escolha, Lista } from './controles';
import { Chevron, IconeFigura } from './icones';
import { ModalDaFigura, type FiguraDaEntrada } from './ModalDaFigura';

const existeCampo = (nome: string) => CAMPOS.has(nome);

export function PainelDeEntradas() {
  const alteracoes = useApp((s) => s.alteracoes);
  const extras = useApp((s) => s.extras);
  const ajustes = useApp((s) => s.modelo?.ajustes);
  const ajustesDeLista = useApp((s) => s.ajustesDeLista);
  const resultado = useApp((s) => s.resultado);
  const definir = useApp((s) => s.definir);

  const ler = useMemo(() => leitorDoEstado({ alteracoes, extras }), [alteracoes, extras]);
  // O ajuste chega com o nome que a modulação usa; a linha é a da entrada digitada.
  const ajustePorNome = useMemo(() => {
    const m = new Map<string, Ajuste>();
    for (const a of ajustes ?? []) {
      const nome = entradaDoAjuste(a.nome, existeCampo);
      if (nome) m.set(nome, a);
    }
    // A troca automática da lista (contraforte 79 → 54 ao trocar o bloco) aparece do mesmo jeito, e manda: o
    // valor do campo JÁ é o novo, e o "→" diz que não foi o usuário quem escolheu.
    for (const a of Object.values(ajustesDeLista)) {
      m.set(a.nome, { nome: a.nome, de: a.de, para: a.para, unidade: CAMPOS.get(a.nome)?.meta.unidade ?? '' });
    }
    return m;
  }, [ajustes, ajustesDeLista]);

  // Listas que dependem de outra entrada: as opções vêm da conta atual (aba Referências da planilha).
  const opcoesVivas = useMemo(() => {
    const m = new Map<string, Opcao[]>();
    for (const c of CAMPOS.values()) {
      if (c.opcoesRef) m.set(c.meta.nome, resultado ? opcoesDoCampo(c, (ref) => resultado.cel(ref)) : []);
    }
    return m;
  }, [resultado]);

  // Aberto/fechado escolhido pelo usuário; o que ele nunca tocou fica fechado.
  // Só a ESCOLHA é guardada (não o padrão): assim o padrão pode mudar sem
  // brigar com o que ficou gravado em navegador de versão antiga.
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>(() => lembrar(CHAVES.grupos, {}, ehMapaDeBooleanos));
  const alternar = useCallback((s: Secao, aberto: boolean) => {
    setEscolhas((e) => {
      const novo = { ...e, [s.id]: !aberto };
      guardar(CHAVES.grupos, novo);
      return novo;
    });
  }, []);

  const [aberta, setAberta] = useState<{ nome: string; figura: FiguraDaEntrada } | null>(null);
  const fecharFigura = useCallback(() => setAberta(null), []);
  const abrirFigura = useCallback((nome: string) => {
    const f = figuraDaEntrada(nome);
    if (f) setAberta({ nome, figura: f });
  }, []);

  return (
    <aside className="painel-entradas">
      <div className="painel-cabeca">
        <span className="rotulo">Entradas</span>
      </div>
      <div className="painel-corpo">
        {SECOES.filter((s) => secaoVisivel(s, ler)).map((s) => {
          const aberto = escolhas[s.id] ?? false;
          return (
            <div className="grupo" data-aberto={aberto} key={s.id}>
              <div
                className="grupo-cabeca"
                role="button"
                tabIndex={0}
                aria-expanded={aberto}
                onClick={() => alternar(s, aberto)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    alternar(s, aberto);
                  }
                }}
              >
                <Chevron className="chevron" />
                <span className="titulo">{s.titulo}</span>
              </div>
              {aberto && (
                <div className="grupo-corpo">
                  {s.campos.map((c) => (
                    <LinhaDeEntrada
                      key={c.meta.nome}
                      campo={c}
                      opcoes={opcoesVivas.get(c.meta.nome) ?? c.opcoes}
                      valor={valorTravado(c.meta.nome, ler) ?? ler(c.meta.nome)}
                      travado={valorTravado(c.meta.nome, ler) !== undefined}
                      ativa={entradaAtiva(c.meta.nome, ler)}
                      ajuste={ajustePorNome.get(c.meta.nome)}
                      figura={figuraDaEntrada(c.meta.nome)?.titulo ?? null}
                      figuraAberta={aberta?.nome === c.meta.nome}
                      definir={definir}
                      abrirFigura={abrirFigura}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {aberta && <ModalDaFigura figura={aberta.figura} aoFechar={fecharFigura} />}
    </aside>
  );
}

/**
 * Uma linha. `memo` porque o painel tem ~120 linhas e cada tecla refaz a
 * conta: só redesenha a linha cujo valor, estado ou ajuste mudou.
 */
const LinhaDeEntrada = memo(function LinhaDeEntrada({
  campo,
  opcoes,
  valor,
  travado,
  ativa,
  ajuste,
  figura,
  figuraAberta,
  definir,
  abrirFigura,
}: {
  campo: Campo;
  /** As opções de agora: as da lista fixa, ou as que a conta deu para a lista dependente. */
  opcoes: readonly Opcao[];
  valor: Valor;
  /** O campo mostra um valor fixo e não deixa escolher (classe de solo com argila → "Não se aplica"). */
  travado: boolean;
  ativa: boolean;
  ajuste: Ajuste | undefined;
  /** Título da figura de referência, ou null quando a entrada não tem figura. */
  figura: string | null;
  figuraAberta: boolean;
  definir: (nome: string, v: Valor) => void;
  abrirFigura: (nome: string) => void;
}) {
  const nome = campo.meta.nome;
  const mudar = (v: Valor) => definir(nome, v);

  let controle;
  switch (campo.controle) {
    case 'numero':
      controle = <CampoNumero campo={campo} valor={valor} aoMudar={mudar} />;
      break;
    case 'simnao':
    case 'escolha':
      controle = <Escolha opcoes={opcoes} valor={valor} rotulo={campo.curto} aoEscolher={mudar} />;
      break;
    case 'lista':
      controle = <Lista opcoes={opcoes} valor={valor} rotulo={campo.curto} aoEscolher={mudar} desabilitado={travado} />;
      break;
  }

  // A lista sem unidade ("Parcial (seção I)", "Solo residual maduro") toma
  // também a coluna da unidade, que ficaria vazia: o texto da opção corta menos.
  // O começo do controle continua alinhado com os outros.
  const largo = campo.controle === 'lista' && !campo.meta.unidade;

  return (
    <div className={`entrada${ativa ? '' : ' apagada'}`}>
      <label title={campo.dica}>{campo.curto}</label>
      <div className={`entrada-controle${largo ? ' largo' : ''}`}>
        {controle}
        {ajuste && (
          <span
            className="ajuste"
            title={`${escreverNoCampo(ajuste.de, campo.meta.formato)} → ${escreverNoCampo(ajuste.para, campo.meta.formato)} ${ajuste.unidade}`.trim()}
          >
            → {escreverNoCampo(ajuste.para, campo.meta.formato)}
          </span>
        )}
      </div>
      {!largo && <span className="unidade">{campo.meta.unidade}</span>}
      {figura ? (
        <button
          type="button"
          className={`btn-figura${figuraAberta ? ' on' : ''}`}
          title={figura}
          aria-label={`Figura de ${campo.curto}`}
          onClick={() => abrirFigura(nome)}
        >
          <IconeFigura tamanho={16} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
});
