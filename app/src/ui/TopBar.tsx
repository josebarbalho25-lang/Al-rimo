// ═══════════════════════════════════════════════════════════════════════════
//  ui/TopBar.tsx — a barra de cima
// ---------------------------------------------------------------------------
//  Nome do projeto (com • quando há alteração não salva), os comandos de
//  arquivo, as duas saídas (IFC e memória impressa), a engrenagem das
//  configurações e o tema. Só ícones: o nome do comando e o atalho moram no
//  `title`, como no A-PORT. Engrenagem e tema lado a lado, nessa ordem, como
//  no pé do trilho do A-PORT — a mão dele já sabe onde fica. O Termo de Uso
//  entra ANTES da engrenagem, e não entre ela e o tema, para não separar o par.
//
//  Comando cuja peça ainda não foi ligada (IFC, impressão) aparece apagado e
//  não responde — melhor do que sumir e o botão mudar de lugar depois.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import {
  exportarIfc,
  imprimirMemoria,
  abrirProjeto,
  novoProjeto,
  salvarProjeto,
} from '@/estado/acoesDeArquivo';
import { useInterface } from '@/estado/interface';
import { useApp } from '@/estado/store';
import { definirPreferencia, NOME_DO_TEMA, proximoTema, usePreferencias } from '@/estilo/preferenciasDaInterface';
import { Configuracoes } from './Configuracoes';
import { JanelaDoTermo } from './TermoDeUso';
import {
  IconeAbrir,
  IconeEngrenagem,
  IconeExportar,
  IconeFigura,
  IconeImprimir,
  IconeNovo,
  IconeSalvar,
  IconeTema,
  IconeTermo,
} from './icones';

export function TopBar() {
  const titulo = useApp((s) => s.titulo);
  const sujo = useApp((s) => s.sujo);
  const arquivo = useApp((s) => s.arquivo);
  const temIfc = useApp((s) => !!s.ligacoes.exportarIfc && !!s.modelo);
  const temImpressao = useApp((s) => !!s.ligacoes.imprimirMemoria && !!s.resultado);
  const { tema } = usePreferencias();
  const [config, setConfig] = useState(false);
  const fecharConfig = useCallback(() => setConfig(false), []);
  const [termo, setTermo] = useState(false);
  const abrirPorFiguras = useInterface((s) => s.abrirPorFiguras);
  const porFiguras = useInterface((s) => s.porFiguras);
  const fecharTermo = useCallback(() => setTermo(false), []);

  return (
    <header className="topbar">
      <div className="titulo">
        <h1 title={arquivo ?? undefined}>
          {titulo}
          {sujo ? ' •' : ''}
        </h1>
      </div>

      <div className="separador" />

      <div className="grupo-botoes">
        {/* Muro novo abre direto na entrada por figuras (Jose, 12/10). */}
        <button className="btn-icone" title="Novo" onClick={() => novoProjeto() && abrirPorFiguras()}>
          <IconeNovo tamanho={16} />
        </button>
        <button className="btn-icone" title="Abrir  ·  Ctrl+O" onClick={() => void abrirProjeto()}>
          <IconeAbrir tamanho={16} />
        </button>
        <button
          className="btn-icone"
          title={arquivo ? `Salvar em ${arquivo}  ·  Ctrl+S` : 'Salvar  ·  Ctrl+S'}
          onClick={() => void salvarProjeto()}
        >
          <IconeSalvar tamanho={16} />
        </button>
      </div>

      <div className="separador" />

      {/* A porta principal das entradas (Jose, 12/10): com nome, não só ícone — é o comando que mais se usa. */}
      <div className="grupo-botoes">
        <button type="button" className={`btn-por-figuras${porFiguras ? ' on' : ''}`} title="Entrada por figuras" onClick={abrirPorFiguras}>
          <IconeFigura tamanho={15} />
          Entradas
        </button>
      </div>

      <div className="separador" />

      <div className="grupo-botoes">
        <button className="btn-icone" title="Exportar IFC" disabled={!temIfc} onClick={exportarIfc}>
          <IconeExportar tamanho={16} />
        </button>
        <button className="btn-icone" title="Imprimir memória" disabled={!temImpressao} onClick={() => void imprimirMemoria()}>
          <IconeImprimir tamanho={16} />
        </button>
      </div>

      <div className="direita">
        <button className={`btn-icone${termo ? ' on' : ''}`} title="Termo de uso" onClick={() => setTermo(true)}>
          <IconeTermo tamanho={16} />
        </button>
        <button className={`btn-icone${config ? ' on' : ''}`} title="Configurações" onClick={() => setConfig(true)}>
          <IconeEngrenagem tamanho={16} />
        </button>
        <button
          className="btn-icone"
          title={`Tema: ${NOME_DO_TEMA[tema]}`}
          onClick={() => definirPreferencia('tema', proximoTema(tema))}
        >
          <IconeTema tamanho={16} />
        </button>
      </div>

      {config && <Configuracoes aoFechar={fecharConfig} />}
      {termo && <JanelaDoTermo modo="leitura" aoFechar={fecharTermo} />}
    </header>
  );
}
