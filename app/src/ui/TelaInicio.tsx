// ═══════════════════════════════════════════════════════════════════════════
//  ui/TelaInicio.tsx — a seção Início: arquivo, saídas e os Recentes
// ---------------------------------------------------------------------------
//  COPIADA DO INÍCIO DO PRÓ-VIGA 3D (Jose, 15/11: "precisamos manter esse
//  padrão… ele deixa as vigas salvas por último na tela inicial, olha a
//  organização do negócio"; fonte: proviga-3d-limpo/app/projects.jsx e as
//  classes home-* / export-* / recent-* do Proviga-3D.html). Duas colunas:
//   · a da esquerda, estreita: a marca, os botões de arquivo empilhados (o
//     primário cheio em cima), o EXPORTAR com uma linha por formato (ícone
//     colorido do tipo + nome; o Memorial com os modos num chip que abre) e a
//     linha do arquivo ("● Salvo · nome");
//   · a da direita: os RECENTES em cartões (foto do 3D Realista, nome, ficha
//     curta, data), o mais novo primeiro (estado/recentes.ts).
//  A saída que mora noutra seção (as pranchas na Gráfica) é pedida de lá:
//  o comando continua num lugar só (pranchas/pedidoDeSaida.ts).
//
//  Rótulo e controle, sem texto explicando (regra do dono). O porquê de um
//  botão apagado vai no chip curto dele e na dica do mouse.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from 'react';
import { baixar } from '@/estado/arquivo';
import {
  abrirExemplo,
  abrirProjeto,
  abrirRecente,
  exportarIfc,
  exportarWordDaMemoria,
  imprimirMemoria,
  novoProjeto,
  salvarProjeto,
} from '@/estado/acoesDeArquivo';
import { useInterface } from '@/estado/interface';
import { TITULO_DO_EXEMPLO } from '@/estado/novo';
import { ponteDoPrograma } from '@/estado/programa';
import { nomeDeArquivo } from '@/estado/projeto';
import { carregarRecentes, contagemDeArquivos, dataEHora, esquecerRecente, useRecentes, type Recente } from '@/estado/recentes';
import { useApp } from '@/estado/store';
import { pedirSaida, type SaidaDasPranchas } from '@/pranchas/pedidoDeSaida';
import { csvDoQuantitativo, quantificar } from '@/quantitativo';
import { MarcaAlrimo } from './Marca';
import { IconeAbrir, IconeExemplo, Svg, type PropsDoIcone } from './icones';
import { trazer } from './grafica/comandos';

/* ── os ícones (os do Pró-Viga: mais, pasta, seta para baixo) ─────────── */

const IconeMais = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

const IconeBaixar = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
  </Svg>
);

/*
  O TIPO DO ARQUIVO num ladrilho colorido, como o Pró-Viga — o olho acha o formato pela cor antes de ler. Desenho
  próprio, sem marca de terceiro: a sigla em branco sobre a cor do tipo (tokens --arq-*, iguais nos três temas,
  como as cores de material).
*/
function Ladrilho({ sigla, cor }: { sigla: string; cor: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3.5" fill={`var(${cor})`} />
      <text x="12" y="15.2" fontSize={sigla.length > 3 ? 5 : 6.3} fontWeight="700" textAnchor="middle" fill="#ffffff" fontFamily="var(--font-ui)">
        {sigla}
      </text>
    </svg>
  );
}

/** O muro em pé (os blocos de duas fiadas e a sapata), para o ladrilho do IFC: modelo 3D, não folha. */
function LadrilhoDoModelo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3.5" fill="var(--arq-ifc)" />
      <g fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M7.5 7.5h5v3h-5zM12.5 7.5h4v3h-4zM7.5 10.5h3v3h-3zM10.5 10.5h6v3h-6z" />
        <path d="M6 13.5h12v2.5H6z" />
      </g>
      <text x="12" y="20" fontSize="3.6" fontWeight="700" textAnchor="middle" fill="#ffffff" fontFamily="var(--font-ui)">
        IFC
      </text>
    </svg>
  );
}

/* ── a tela ─────────────────────────────────────────────────────────────── */

export function TelaInicio() {
  const disponivel = useRecentes((s) => s.disponivel);
  const lista = useRecentes((s) => s.lista);
  // a cada volta ao Início a lista é relida: o arquivo apagado ou movido por fora sai sem precisar de clique
  useEffect(() => {
    void carregarRecentes();
  }, []);
  return (
    <div className="tela-inicio">
      <ColunaDoArquivo />
      {disponivel && <Recentes lista={lista} />}
    </div>
  );
}

function ColunaDoArquivo() {
  const temModelo = useApp((s) => !!s.modelo);
  const temIfc = useApp((s) => !!s.ligacoes.exportarIfc && !!s.modelo);
  const temImpressao = useApp((s) => !!s.ligacoes.imprimirMemoria && !!s.resultado);
  const temWord = useApp((s) => !!s.ligacoes.exportarWord && !!s.resultado);
  const folhas = useApp((s) => s.pranchas.folhas.length);
  const irPara = useInterface((s) => s.irPara);
  const abrirPorFiguras = useInterface((s) => s.abrirPorFiguras);
  const [modos, setModos] = useState(false);

  const daPrancha = (s: SaidaDasPranchas) => () => {
    pedirSaida(s);
    trazer({ aba: 'pranchas', id: null });
    irPara('grafica');
  };
  const quantitativo = () => {
    const s = useApp.getState();
    if (!s.modelo) return;
    baixar(csvDoQuantitativo(quantificar(s.modelo)), nomeDeArquivo(`${s.titulo} - quantitativo`, '.csv'), 'text/csv;charset=utf-8');
  };
  // no programa instalado o memorial vai direto para PDF em arquivo; no navegador, pelo diálogo de impressão
  const nomeDaImpressao = ponteDoPrograma() ? 'PDF' : 'Imprimir';
  const nModos = 1 + (temWord ? 1 : 0);

  return (
    <aside className="inicio-lado">
      <div className="inicio-marca">
        <div className="inicio-marca-ladrilho">
          <MarcaAlrimo traco={5} />
        </div>
        <div>
          <div className="inicio-marca-nome">Al-rimo</div>
          <div className="inicio-marca-norma">NBR 16868-1:2020</div>
        </div>
      </div>

      {/* Muro novo abre direto nas Entradas (Jose, 12/10). */}
      <button type="button" className="inicio-primario" onClick={() => novoProjeto() && abrirPorFiguras()}>
        <IconeMais tamanho={14} /> Novo muro…
      </button>
      <button type="button" className="inicio-botao" title="Ctrl+O" onClick={() => void abrirProjeto()}>
        <IconeAbrir tamanho={15} /> Abrir…
      </button>
      <button type="button" className="inicio-botao" title={TITULO_DO_EXEMPLO} onClick={() => abrirExemplo()}>
        <IconeExemplo tamanho={15} /> Exemplo
      </button>
      <button type="button" className="inicio-botao" title="Ctrl+S" onClick={() => void salvarProjeto()}>
        <IconeBaixar tamanho={15} /> Salvar
      </button>
      <button type="button" className="inicio-botao" title="Ctrl+Shift+S" onClick={() => void salvarProjeto(true)}>
        Salvar como…
      </button>

      <div className="inicio-exportar">
        <div className="inicio-rotulo">Exportar</div>
        <LinhaDeSaida icone={<LadrilhoDoModelo />} rotulo="IFC" dica="Modelo 3D do muro (IFC4)" bloqueio={temIfc ? null : 'Sem modelo'} aoClicar={exportarIfc} />
        <LinhaDeSaida
          icone={<Ladrilho sigla="DXF" cor="--arq-dxf" />}
          rotulo="DXF"
          dica="Pranchas em DXF (.zip)"
          bloqueio={folhas ? null : '0 folhas'}
          aoClicar={daPrancha('dxf')}
        />
        <LinhaDeSaida
          icone={<Ladrilho sigla="PDF" cor="--arq-pdf" />}
          rotulo="Memorial"
          dica="Memorial de cálculo"
          bloqueio={temImpressao ? null : 'Conta com erro'}
          chip={modos ? 'escolha ▴' : `${nModos} ${nModos === 1 ? 'modo' : 'modos'} ▾`}
          aoClicar={() => setModos((m) => !m)}
        />
        {modos && temImpressao && (
          <div className="inicio-submodos">
            <button
              type="button"
              className="inicio-submodo"
              onClick={() => {
                setModos(false);
                void imprimirMemoria();
              }}
            >
              {nomeDaImpressao}
            </button>
            {temWord && (
              <button
                type="button"
                className="inicio-submodo"
                title="Documento editável (.doc)"
                onClick={() => {
                  setModos(false);
                  void exportarWordDaMemoria();
                }}
              >
                Word
              </button>
            )}
          </div>
        )}
        <LinhaDeSaida
          icone={<Ladrilho sigla="PDF" cor="--arq-pdf" />}
          rotulo="Pranchas em PDF"
          dica="As folhas da Gráfica, uma página por folha"
          bloqueio={folhas ? null : '0 folhas'}
          aoClicar={daPrancha('pdf')}
        />
        <LinhaDeSaida
          icone={<Ladrilho sigla="CSV" cor="--arq-csv" />}
          rotulo="Quantitativo"
          dica="Blocos, graute, argamassa, aço e drenagem (.csv)"
          bloqueio={temModelo ? null : 'Sem modelo'}
          aoClicar={quantitativo}
        />
      </div>

      <EstadoDoArquivo />
    </aside>
  );
}

function LinhaDeSaida(p: { icone: ReactNode; rotulo: string; dica: string; bloqueio: string | null; chip?: string; aoClicar: () => void }) {
  return (
    <button type="button" className="inicio-saida" disabled={p.bloqueio !== null} title={p.bloqueio ?? p.dica} onClick={p.aoClicar}>
      <span className="inicio-saida-icone">{p.icone}</span>
      <span className="inicio-saida-nome">{p.rotulo}</span>
      {(p.bloqueio ?? p.chip) && <span className="inicio-chip">{p.bloqueio ?? p.chip}</span>}
    </button>
  );
}

/** "● Salvo · Muro da divisa.alrimo" — ou só o nome, apagado, quando há alteração (o • fica no cabeçalho). */
function EstadoDoArquivo() {
  const arquivo = useApp((s) => s.arquivo);
  const sujo = useApp((s) => s.sujo);
  const titulo = useApp((s) => s.titulo);
  const salvo = !!arquivo && !sujo;
  return (
    <div className={`inicio-arquivo${salvo ? ' salvo' : ''}`} title={arquivo ?? titulo}>
      {salvo ? (
        <>
          <span className="ponto" />
          Salvo · {arquivo}
        </>
      ) : (
        (arquivo ?? titulo)
      )}
    </div>
  );
}

/* ── os Recentes ────────────────────────────────────────────────────────── */

/** A área dos Recentes (exportada para o teste, que a desenha com uma lista dada). */
export function Recentes({ lista }: { lista: readonly Recente[] }) {
  const [menu, setMenu] = useState<{ r: Recente; x: number; y: number } | null>(null);

  // o menu do botão direito fecha no clique fora, no Esc e na rolagem (como o menu de contexto do Windows)
  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('pointerdown', fechar);
    window.addEventListener('keydown', tecla);
    window.addEventListener('wheel', fechar, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', fechar);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('wheel', fechar);
    };
  }, [menu]);

  return (
    <section className="inicio-recentes">
      <div className="inicio-cabeca">
        <h3>Recentes</h3>
        <span>{contagemDeArquivos(lista.length)}</span>
      </div>
      {lista.length === 0 ? (
        <div className="inicio-vazio">
          <div className="inicio-vazio-marca">
            <MarcaAlrimo traco={5} cantos={22} />
          </div>
          <div>Nenhum recente</div>
        </div>
      ) : (
        <div className="inicio-grade-recentes">
          {lista.map((r) => (
            <CartaoDoRecente key={r.chave} r={r} aoMenu={(x, y) => setMenu({ r, x, y })} />
          ))}
        </div>
      )}
      {menu && (
        <div className="menu-contexto inicio-menu" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void esquecerRecente(menu.r.chave);
              setMenu(null);
            }}
          >
            Remover da lista
          </button>
        </div>
      )}
    </section>
  );
}

function CartaoDoRecente({ r, aoMenu }: { r: Recente; aoMenu: (x: number, y: number) => void }) {
  const abrir = () => void abrirRecente(r.chave, r.nome);
  return (
    <div
      className="inicio-cartao"
      role="button"
      tabIndex={0}
      title={r.chave.includes('\\') || r.chave.includes('/') ? r.chave : r.nome}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrir();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        aoMenu(e.clientX, e.clientY);
      }}
    >
      <div className="inicio-cartao-foto">
        {r.miniatura ? (
          <img src={r.miniatura} alt="" draggable={false} />
        ) : (
          <div className="inicio-cartao-marca">
            <MarcaAlrimo traco={5} cantos={22} />
          </div>
        )}
      </div>
      <div className="inicio-cartao-texto">
        <div className="inicio-cartao-nome">{r.nome}</div>
        <div className="inicio-cartao-ficha">{r.resumo}</div>
        <div className="inicio-cartao-data">{dataEHora(r.quando)}</div>
      </div>
      <button
        type="button"
        className="inicio-cartao-tirar"
        aria-label="Remover da lista"
        title="Remover da lista"
        onClick={(e) => {
          e.stopPropagation();
          void esquecerRecente(r.chave);
        }}
      >
        ×
      </button>
    </div>
  );
}
