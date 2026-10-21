// ═══════════════════════════════════════════════════════════════════════════
//  ui/TelaInicio.tsx — a seção Início: arquivo e saídas
// ---------------------------------------------------------------------------
//  O "Abrir / Salvar" do trilho do Pró-Viga (Jose, 20/10): o que era a fila de
//  ícones da barra de cima, agora com nome. Arquivo (novo, abrir, exemplo,
//  salvar, salvar como) e as saídas. A saída que mora noutra seção (as pranchas
//  na Gráfica, o CSV no Quantitativo) leva até ela — o comando fica num lugar
//  só. Rótulo e botão, sem texto explicando (regra do dono).
//
//  Sem "Recentes": no navegador o app não reabre um arquivo pelo caminho; entra
//  com o programa instalado.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import { abrirExemplo, abrirProjeto, exportarIfc, imprimirMemoria, novoProjeto, salvarProjeto } from '@/estado/acoesDeArquivo';
import { useInterface } from '@/estado/interface';
import { TITULO_DO_EXEMPLO } from '@/estado/novo';
import { useApp } from '@/estado/store';
import { IconeAbrir, IconeExemplo, IconeNovo, IconeSalvar, type Icone } from './icones';
import { trazer } from './grafica/comandos';

export function TelaInicio() {
  const temIfc = useApp((s) => !!s.ligacoes.exportarIfc && !!s.modelo);
  const temImpressao = useApp((s) => !!s.ligacoes.imprimirMemoria && !!s.resultado);
  const irPara = useInterface((s) => s.irPara);
  const abrirPorFiguras = useInterface((s) => s.abrirPorFiguras);
  return (
    <div className="tela-inicio">
      <section className="inicio-bloco">
        <h2 className="inicio-titulo">Arquivo</h2>
        <div className="inicio-grade">
          {/* Muro novo abre direto nas Entradas (Jose, 12/10). */}
          <Grande I={IconeNovo} titulo="Novo" aoClicar={() => novoProjeto() && abrirPorFiguras()}>Novo</Grande>
          <Grande I={IconeAbrir} titulo="Abrir  ·  Ctrl+O" aoClicar={() => void abrirProjeto()}>Abrir</Grande>
          <Grande I={IconeExemplo} titulo={TITULO_DO_EXEMPLO} aoClicar={() => abrirExemplo()}>Exemplo</Grande>
          <Grande I={IconeSalvar} titulo="Salvar  ·  Ctrl+S" aoClicar={() => void salvarProjeto()}>Salvar</Grande>
          <Grande I={IconeSalvar} titulo="Salvar como  ·  Ctrl+Shift+S" aoClicar={() => void salvarProjeto(true)}>Salvar como</Grande>
        </div>
      </section>
      <section className="inicio-bloco">
        <h2 className="inicio-titulo">Exportar</h2>
        <div className="inicio-lista">
          <Linha rotulo="Modelo IFC" formato=".ifc" desligado={!temIfc} aoClicar={exportarIfc} />
          <Linha rotulo="Memória de cálculo" formato="imprimir · PDF" desligado={!temImpressao} aoClicar={() => void imprimirMemoria()} />
          <Linha
            rotulo="Pranchas"
            formato=".pdf · .dxf"
            aoClicar={() => {
              trazer({ aba: 'pranchas', id: null });
              irPara('grafica');
            }}
          />
          <Linha rotulo="Quantitativo" formato=".csv" aoClicar={() => irPara('quantitativo')} />
        </div>
      </section>
    </div>
  );
}

function Grande({ I, titulo, aoClicar, children }: { I: Icone; titulo: string; aoClicar: () => void; children: ReactNode }) {
  return (
    <button type="button" className="inicio-grande" title={titulo} onClick={aoClicar}>
      <I tamanho={22} />
      {children}
    </button>
  );
}

function Linha({ rotulo, formato, desligado, aoClicar }: { rotulo: string; formato: string; desligado?: boolean; aoClicar: () => void }) {
  return (
    <button type="button" className="inicio-linha" disabled={desligado} onClick={aoClicar}>
      <span>{rotulo}</span>
      <span className="inicio-formato">{formato}</span>
    </button>
  );
}
