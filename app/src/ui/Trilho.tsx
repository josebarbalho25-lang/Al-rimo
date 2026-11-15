// ═══════════════════════════════════════════════════════════════════════════
//  ui/Trilho.tsx — o trilho da esquerda e o cabeçalho de cada seção
// ---------------------------------------------------------------------------
//  A organização do Pró-Viga (Jose, 20/10; protótipo aprovado no mesmo dia):
//  um trilho fino azul-marinho, a logomarca no alto, um ícone por seção e o
//  tema no pé. Seis seções, nesta ordem: Início, Configurações, Entradas,
//  Memória de cálculo, Quantitativo e Gráfica. Só ícone: o nome mora no
//  `title`, como no Pró-Viga.
//
//  O cabeçalho é o mesmo em toda seção (o `topbar` de cada tela do Pró-Viga),
//  numa linha como a dele: o nome da seção em negrito e, depois do ponto, o
//  contexto apagado — no Início "Projetos do Al-rimo" (o "Início · Projetos do
//  Pró-Viga 3D"), nas outras o nome do muro com o •. Depois, os comandos que
//  valem em qualquer lugar — salvar, desfazer, refazer.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { salvarProjeto } from '@/estado/acoesDeArquivo';
import { useInterface, type Secao } from '@/estado/interface';
import { useApp } from '@/estado/store';
import { definirPreferencia, NOME_DO_TEMA, proximoTema, usePreferencias } from '@/estilo/preferenciasDaInterface';
import { MarcaAlrimo } from './Marca';
import { temBarraPropria } from './barraDaJanela';
import {
  IconeDesfazer,
  IconeEngrenagem,
  IconeEntradas,
  IconeGrafica,
  IconeInicio,
  IconeMemoria,
  IconeQuantitativo,
  IconeRefazer,
  IconeSalvar,
  IconeTema,
  type Icone,
} from './icones';

export const NOME_DA_SECAO: Record<Secao, string> = {
  inicio: 'Início',
  configuracoes: 'Configurações',
  entradas: 'Entradas',
  memoria: 'Memória de cálculo',
  quantitativo: 'Quantitativo',
  grafica: 'Gráfica',
};

const ICONE_DA_SECAO: Record<Secao, Icone> = {
  inicio: IconeInicio,
  configuracoes: IconeEngrenagem,
  entradas: IconeEntradas,
  memoria: IconeMemoria,
  quantitativo: IconeQuantitativo,
  grafica: IconeGrafica,
};

/** O que o `title` diz, quando o nome da seção não basta. */
const DICA: Partial<Record<Secao, string>> = { grafica: 'Gráfica: vistas e pranchas' };

const ORDEM: readonly Secao[] = ['inicio', 'configuracoes', 'entradas', 'memoria', 'quantitativo', 'grafica'];

export function Trilho() {
  const secao = useInterface((s) => s.secao);
  const irPara = useInterface((s) => s.irPara);
  const { tema } = usePreferencias();
  return (
    <nav className="trilho" aria-label="Seções">
      <div className="trilho-marca" title="Al-rimo">
        <MarcaAlrimo cantos={22} traco={5} />
      </div>
      {ORDEM.map((id) => {
        const I = ICONE_DA_SECAO[id];
        return (
          <button
            key={id}
            type="button"
            className={`trilho-botao${secao === id ? ' on' : ''}`}
            aria-label={NOME_DA_SECAO[id]}
            aria-current={secao === id ? 'page' : undefined}
            title={DICA[id] ?? NOME_DA_SECAO[id]}
            onClick={() => irPara(id)}
          >
            <I tamanho={22} />
          </button>
        );
      })}
      <div className="trilho-pe">
        <button
          type="button"
          className="trilho-botao"
          aria-label={`Tema: ${NOME_DO_TEMA[tema]}`}
          title={`Tema: ${NOME_DO_TEMA[tema]}`}
          onClick={() => definirPreferencia('tema', proximoTema(tema))}
        >
          <IconeTema tamanho={20} />
        </button>
      </div>
    </nav>
  );
}

export function CabecalhoDaSecao({ children }: { children?: ReactNode }) {
  const secao = useInterface((s) => s.secao);
  const titulo = useApp((s) => s.titulo);
  const sujo = useApp((s) => s.sujo);
  const arquivo = useApp((s) => s.arquivo);
  const podeDesfazer = useApp((s) => s.podeDesfazer);
  const podeRefazer = useApp((s) => s.podeRefazer);
  const desfazer = useApp((s) => s.desfazer);
  const refazer = useApp((s) => s.refazer);
  const barraPropria = temBarraPropria();
  return (
    <header className="cabecalho">
      <div className="cabecalho-titulo">
        <h1 title={arquivo ?? undefined}>
          {NOME_DA_SECAO[secao]}
          <span className="cabecalho-contexto">
            {' · '}
            {secao === 'inicio' ? (
              'Projetos do Al-rimo'
            ) : (
              <>
                {titulo}
                {sujo ? ' •' : ''}
                {/* No programa instalado o cabeçalho é a barra de título: leva o nome do programa, como a do Windows
                    levava. No navegador quem diz "Al-rimo" é a aba; no Início o nome já está dito. */}
                {barraPropria && ' — Al-rimo'}
              </>
            )}
          </span>
        </h1>
      </div>
      <div className="separador" />
      <button
        type="button"
        className="btn-icone"
        aria-label="Salvar"
        title={arquivo ? `Salvar em ${arquivo}  ·  Ctrl+S` : 'Salvar  ·  Ctrl+S'}
        onClick={() => void salvarProjeto()}
      >
        <IconeSalvar tamanho={18} />
      </button>
      <div className="separador" />
      <button type="button" className="btn-icone" aria-label="Desfazer" title="Desfazer  ·  Ctrl+Z" disabled={!podeDesfazer} onClick={desfazer}>
        <IconeDesfazer tamanho={18} />
      </button>
      <button type="button" className="btn-icone" aria-label="Refazer" title="Refazer  ·  Ctrl+Y" disabled={!podeRefazer} onClick={refazer}>
        <IconeRefazer tamanho={18} />
      </button>
      {children && <div className="cabecalho-direita">{children}</div>}
    </header>
  );
}
