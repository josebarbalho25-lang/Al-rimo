// ═══════════════════════════════════════════════════════════════════════════
//  estado/acoesDeArquivo.ts — Novo, Abrir, Salvar, Exportar IFC, Imprimir
// ---------------------------------------------------------------------------
//  Quem chama é um botão ou um atalho; o que volta é uma frase curta para a
//  barra de estado — nada de `alert` no meio do trabalho (padrão do A-PORT).
//  A única pergunta que se faz é a de perder trabalho: perder um muro por um
//  clique é o pior defeito que um programa pode ter.
// ═══════════════════════════════════════════════════════════════════════════

import { abrirDoDisco, baixar, foiCancelado, salvarNoDisco, type Alca } from './arquivo';
import {
  desserializarProjeto,
  EXTENSAO,
  nomeDeArquivo,
  projetoNovo,
  recadoDeAbertura,
  serializarProjeto,
  tituloDoArquivo,
} from './projeto';
import { ruim } from './recadoRuim';
import { CAMPOS, projetoAtual, useApp, VERSAO_DA_CONTA } from './store';

/** A alça do arquivo aberto (só existe no navegador com janela de arquivo). Não é estado de tela. */
let alcaAtual: Alca | null = null;

const avisar = (recado: string) => {
  if (recado) useApp.getState().dizer(recado);
};

const perderAlteracoes = (pergunta: string): boolean => {
  const s = useApp.getState();
  return !s.sujo || window.confirm(pergunta);
};

/*
  O MOTIVO DO ERRO, EM PORTUGUÊS. A mensagem crua do navegador vem em inglês
  ("The request is not allowed by the user agent…") e não diz nada a quem
  está na obra. Os casos conhecidos do disco viram uma frase; o resto fica só
  com o "Não deu para…", e o detalhe vai para o console de quem for consertar.
*/
const MOTIVO: Record<string, string> = {
  NotFoundError: 'arquivo não encontrado',
  NotReadableError: 'arquivo em uso ou sem permissão de leitura',
  NoModificationAllowedError: 'arquivo protegido contra gravação',
  InvalidModificationError: 'o arquivo mudou no disco enquanto era gravado',
  InvalidStateError: 'o arquivo mudou no disco enquanto era gravado',
  QuotaExceededError: 'disco cheio',
  SecurityError: 'o navegador bloqueou o acesso ao arquivo',
};

function naoDeuPara(acao: string, e: unknown): string {
  console.error(e);
  const nome = e instanceof DOMException || e instanceof Error ? e.name : '';
  const motivo = MOTIVO[nome];
  return ruim(motivo ? `Não deu para ${acao}: ${motivo}` : `Não deu para ${acao}`);
}

/** Começa um muro novo. false = o usuário desistiu (tinha alteração não salva). */
export function novoProjeto(): boolean {
  if (!perderAlteracoes('O muro tem alterações não salvas. Começar outro mesmo assim?')) return false;
  alcaAtual = null;
  useApp.getState().carregar(projetoNovo(), null);
  avisar('Projeto novo');
  return true;
}

export async function abrirProjeto(): Promise<void> {
  if (!perderAlteracoes('O muro tem alterações não salvas. Abrir outro mesmo assim?')) return;
  try {
    const lido = await abrirDoDisco();
    if (!lido) return;
    const a = desserializarProjeto(lido.texto, CAMPOS, VERSAO_DA_CONTA);
    if (!a.ok) {
      avisar(ruim(`${lido.nome}: ${a.motivo}`));
      return;
    }
    alcaAtual = lido.alca;
    const projeto = { ...a.projeto, titulo: tituloDoArquivo(lido.nome) };
    useApp.getState().carregar(projeto, lido.nome, {
      contaDoArquivo: a.outraVersao ? a.versaoDaConta : null,
      // arquivo sem identidade ganhou uma agora: ela só vale de verdade depois de ir para o disco (ver projeto.ts)
      sujo: a.ganhouId,
    });
    avisar(recadoDeAbertura(lido.nome, a));
  } catch (e) {
    if (!foiCancelado(e)) avisar(naoDeuPara('abrir', e));
  }
}

export async function salvarProjeto(comoNovo = false): Promise<void> {
  const s = useApp.getState();
  try {
    // O que vai para o disco é o retrato DESTE instante; se o usuário digitar
    // enquanto o disco responde, a tela continua com • (ver marcarSalvo).
    const gravado = projetoAtual(s);
    const texto = serializarProjeto(gravado, VERSAO_DA_CONTA);
    const r = await salvarNoDisco(texto, s.arquivo ?? nomeDeArquivo(s.titulo, EXTENSAO), comoNovo ? null : alcaAtual);
    // O disco pode demorar (pasta de rede, OneDrive, a janela de permissão do
    // navegador aberta). Se no meio o usuário abriu outro muro ou começou um
    // novo, a gravação foi do muro ANTERIOR: guardar a alça dela agora faria
    // o próximo Ctrl+S gravar o muro da tela POR CIMA do arquivo anterior.
    // Então só se dá a notícia, que é verdadeira; o muro da tela fica como está.
    if (useApp.getState().carregamento === s.carregamento) {
      alcaAtual = r.alca;
      useApp.getState().marcarSalvo(r.nome, tituloDoArquivo(r.nome), gravado);
    }
    avisar(`Salvo em ${r.nome}`);
  } catch (e) {
    if (!foiCancelado(e)) avisar(naoDeuPara('salvar', e));
  }
}

export function exportarIfc(): void {
  const s = useApp.getState();
  const exportar = s.ligacoes.exportarIfc;
  if (!exportar) return;
  if (!s.modelo) {
    avisar(ruim('Sem modelo para exportar'));
    return;
  }
  try {
    const texto = exportar(s.modelo, {
      // Os GUIDs saem da identidade do muro, não do nome: dois muros "Sem título" não podem sair com as mesmas
      // peças no modelo federado, e renomear não pode trocar as peças do vínculo no Revit (ver estado/projeto.ts).
      chave: s.idDoProjeto,
      projeto: s.titulo,
      data: new Date().toISOString().slice(0, 10),
      resultado: s.resultado ?? undefined,
    });
    const nome = nomeDeArquivo(s.titulo, '.ifc');
    baixar(texto, nome, 'application/x-step');
    avisar(`IFC exportado: ${nome}`);
  } catch (e) {
    avisar(naoDeuPara('exportar o IFC', e));
  }
}

export async function imprimirMemoria(): Promise<void> {
  const s = useApp.getState();
  const imprimir = s.ligacoes.imprimirMemoria;
  if (!imprimir) return;
  if (!s.resultado) {
    avisar(ruim('Conta com erro: nada a imprimir'));
    return;
  }
  try {
    await imprimir(s.resultado, { projeto: s.titulo });
  } catch (e) {
    avisar(naoDeuPara('imprimir', e));
  }
}
