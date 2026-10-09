// ═══════════════════════════════════════════════════════════════════════════
//  ui/TopBar.tsx — a barra de cima
// ---------------------------------------------------------------------------
//  Nome do projeto (com • quando há alteração não salva), os comandos de
//  arquivo, as duas saídas (IFC e memória impressa), a engrenagem das
//  configurações e o tema. Só ícones: o nome do comando e o atalho moram no
//  `title`, como no A-PORT. Engrenagem e tema lado a lado, nessa ordem, como
//  no pé do trilho do A-PORT — a mão dele já sabe onde fica.
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
import { useApp } from '@/estado/store';
import { definirPreferencia, NOME_DO_TEMA, proximoTema, usePreferencias } from '@/estilo/preferenciasDaInterface';
import { Configuracoes } from './Configuracoes';
import {
  IconeAbrir,
  IconeEngrenagem,
  IconeExportar,
  IconeImprimir,
  IconeNovo,
  IconeSalvar,
  IconeTema,
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
        <button className="btn-icone" title="Novo" onClick={novoProjeto}>
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

      <div className="grupo-botoes">
        <button className="btn-icone" title="Exportar IFC" disabled={!temIfc} onClick={exportarIfc}>
          <IconeExportar tamanho={16} />
        </button>
        <button className="btn-icone" title="Imprimir memória" disabled={!temImpressao} onClick={() => void imprimirMemoria()}>
          <IconeImprimir tamanho={16} />
        </button>
      </div>

      <div className="direita">
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
    </header>
  );
}
