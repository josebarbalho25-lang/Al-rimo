// ═══════════════════════════════════════════════════════════════════════════
//  estado/acoesDeArquivo.ts — Novo, Abrir, Salvar, Exportar IFC, Imprimir
// ---------------------------------------------------------------------------
//  Quem chama é um botão ou um atalho; o que volta é uma frase curta para a
//  barra de estado — nada de `alert` no meio do trabalho (padrão do A-PORT).
//  A única pergunta que se faz é a de perder trabalho: perder um muro por um
//  clique é o pior defeito que um programa pode ter.
// ═══════════════════════════════════════════════════════════════════════════

import { abrirDoDisco, alcaDoCaminho, baixar, foiCancelado, salvarNoDisco, type Alca } from './arquivo';
import { CHAVES, ehObjeto, esquecer, guardar, lembrar } from './lembrete';
import { ponteDoPrograma, type ArquivoDoPrograma } from './programa';
import { carregarRecentes, esquecerRecente, lerRecente, registrarRecente } from './recentes';
import {
  desserializarProjeto,
  EXTENSAO,
  nomeDeArquivo,
  novoIdDeProjeto,
  projetoExemplo,
  projetoNovo,
  recadoDeAbertura,
  serializarProjeto,
  tituloDoArquivo,
} from './projeto';
import { ruim } from './recadoRuim';
import { CAMPOS, projetoAtual, useApp, VERSAO_DA_CONTA } from './store';

/** A alça do arquivo aberto (só existe no navegador com janela de arquivo). Não é estado de tela. */
let alcaAtual: Alca | null = null;

/*
  O CAMINHO DO ÚLTIMO MURO (programa instalado). O lembrete do muro (store.ts) guarda o texto e o NOME do arquivo;
  o caminho fica aqui, ao lado, amarrado à identidade e ao nome — se o muro lembrado não for mais o deste caminho,
  ele não vale. No navegador a alça não sobrevive a fechar e reabrir, e não se guarda nada.
*/
interface CaminhoLembrado {
  id: string;
  arquivo: string;
  caminho: string;
}
const ehCaminhoLembrado = (x: unknown): x is CaminhoLembrado =>
  ehObjeto(x) && typeof x.id === 'string' && typeof x.arquivo === 'string' && typeof x.caminho === 'string';

function lembrarOCaminho(): void {
  const s = useApp.getState();
  const caminho = (alcaAtual as (Alca & { caminho?: string }) | null)?.caminho;
  if (caminho && s.arquivo) guardar(CHAVES.caminho, { id: s.idDoProjeto, arquivo: s.arquivo, caminho } satisfies CaminhoLembrado);
  else esquecer(CHAVES.caminho);
}

/** O muro da tela veio de (ou foi para) `alca`: o caminho fica lembrado e o arquivo sobe nos Recentes. */
function noArquivo(alca: Alca | null, nome: string): void {
  lembrarOCaminho();
  if (alca) registrarRecente(alca, nome);
}

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
  lembrarOCaminho();
  avisar('Projeto novo');
  return true;
}

/** O muro de exemplo (aula 12.2), sem arquivo: salvar pede nome, como o Novo. */
export function abrirExemplo(): boolean {
  if (!perderAlteracoes('O muro tem alterações não salvas. Abrir o exemplo mesmo assim?')) return false;
  alcaAtual = null;
  useApp.getState().carregar(projetoExemplo(), null);
  lembrarOCaminho();
  avisar('Exemplo aberto');
  return true;
}

/** Põe na tela um .alrimo já lido do disco (pelo Abrir ou pelo duplo clique no programa instalado). */
function carregarLido(lido: { texto: string; nome: string; alca: Alca | null }): void {
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
  noArquivo(lido.alca, lido.nome);
  avisar(recadoDeAbertura(lido.nome, a));
}

/** Clique num cartão dos Recentes: abre como o Abrir (a mesma pergunta, a mesma alça para o Ctrl+S). */
export async function abrirRecente(chave: string, nome: string): Promise<void> {
  if (!perderAlteracoes(`O muro tem alterações não salvas. Abrir ${nome} mesmo assim?`)) return;
  try {
    const lido = await lerRecente(chave);
    if (!lido) return; // o navegador negou a licença do arquivo: desistência, como fechar a janela de arquivo
    carregarLido(lido);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotFoundError') {
      // apagado ou movido: sai da lista, que só serve se abrir
      void esquecerRecente(chave);
      avisar(ruim(`${nome}: arquivo não encontrado`));
    } else if (!foiCancelado(e)) avisar(naoDeuPara('abrir', e));
  }
}

export async function abrirProjeto(): Promise<void> {
  if (!perderAlteracoes('O muro tem alterações não salvas. Abrir outro mesmo assim?')) return;
  try {
    const lido = await abrirDoDisco();
    if (!lido) return;
    carregarLido(lido);
  } catch (e) {
    if (!foiCancelado(e)) avisar(naoDeuPara('abrir', e));
  }
}

/** Duplo clique num .alrimo (ou "Abrir com") no programa instalado: abre como o Abrir, com a alça do arquivo. */
export function abrirArquivoDoPrograma(a: ArquivoDoPrograma): void {
  if (!perderAlteracoes(`O muro tem alterações não salvas. Abrir ${a.nome} mesmo assim?`)) return;
  carregarLido({ texto: a.texto, nome: a.nome, alca: alcaDoCaminho(a.caminho, a.nome) });
}

/**
 * No programa instalado: recebe os .alrimo de fora, mantém o título da janela e o • em dia (a pergunta ao fechar é
 * do programa) e atende o "Salvar" dessa pergunta. No navegador não faz nada. Chamado uma vez em main.tsx.
 */
export function ligarOPrograma(): void {
  const ponte = ponteDoPrograma();
  if (!ponte) return;
  let antes = '';
  const informar = () => {
    const s = useApp.getState();
    const agora = `${s.sujo ? 1 : 0}${s.titulo}`;
    if (agora === antes) return;
    antes = agora;
    ponte.informarEstado({ sujo: s.sujo, titulo: s.titulo });
  };
  useApp.subscribe(informar);
  informar();
  ponte.aoPedirSalvarEFechar(() => {
    void salvarProjeto().then(() => {
      if (!useApp.getState().sujo) ponte.fechar();
    });
  });
  // ANTES do pronto(): o .alrimo do duplo clique, que chega depois dele, troca o muro — retomar o caminho do
  // lembrado por cima seria do muro errado
  void retomarOArquivo().finally(() => {
    ponte.aoAbrirArquivo(abrirArquivoDoPrograma);
    ponte.pronto();
  });
}

/*
  O MURO LEMBRADO VOLTA COMO ESTAVA NO DISCO (Jose, 15/11: fechar o programa logo depois de reabrir perguntava se
  queria salvar, sem mudança nenhuma). O lembrete do muro é gravado a cada mexida, e o "salvo" do último Ctrl+S
  pode não chegar ao disco do navegador quando o programa fecha logo em seguida (o Chromium grava o armazenamento
  da página com atraso; o main agora força a gravação ao fechar, e isto aqui cobre o resto). Então, com o caminho
  lembrado: lê o arquivo e, se o muro da tela é o mesmo que está nele, fica SALVO; a alça volta, e o Ctrl+S grava
  no mesmo arquivo sem perguntar onde. Arquivo que mudou no disco, ou muro com alteração de verdade: fica como está.
  Muro nunca salvo (sem arquivo): fica como está.
*/
export async function retomarOArquivo(): Promise<void> {
  const ponte = ponteDoPrograma();
  if (!ponte) return;
  const l = lembrar<CaminhoLembrado | null>(CHAVES.caminho, null, (x): x is CaminhoLembrado | null => x === null || ehCaminhoLembrado(x));
  const s = useApp.getState();
  if (!l || !s.arquivo || l.arquivo !== s.arquivo || l.id !== s.idDoProjeto) return;
  const carregamento = s.carregamento;
  let texto: string;
  try {
    texto = await ponte.lerArquivo(l.caminho);
  } catch {
    return; // apagado ou movido: o muro fica com o • e o Ctrl+S pergunta onde
  }
  if (useApp.getState().carregamento !== carregamento) return; // outro muro entrou enquanto o disco respondia
  alcaAtual = alcaDoCaminho(l.caminho, l.arquivo);
  const a = desserializarProjeto(texto, CAMPOS, VERSAO_DA_CONTA);
  if (a.ok) useApp.getState().confirmarODisco(a.projeto);
}

/** Lê os Recentes guardados (uma vez, em main.tsx). */
export function ligarOsRecentes(): void {
  void carregarRecentes();
}

export async function salvarProjeto(comoNovo = false): Promise<void> {
  const s = useApp.getState();
  try {
    // O que vai para o disco é o retrato DESTE instante; se o usuário digitar
    // enquanto o disco responde, a tela continua com • (ver marcarSalvo).
    // Muro que já mora num arquivo, gravado em OUTRO arquivo, é outro muro: identidade nova, senão os IFC dos dois
    // saem com os mesmos GUIDs (projeto.ts). Vale o destino, não a tecla: "Salvar como" por cima do próprio arquivo
    // é o mesmo muro, e o Ctrl+S depois do F5 (sem a alça, o navegador pergunta onde) para outro nome é outro muro.
    // O primeiro salvar de um muro novo é o próprio muro.
    let gravado = projetoAtual(s);
    const montar = (mesmo: boolean): string => {
      if (s.arquivo !== null && !mesmo) gravado = { ...gravado, id: novoIdDeProjeto() };
      return serializarProjeto(gravado, VERSAO_DA_CONTA);
    };
    const r = await salvarNoDisco(montar, s.arquivo ?? nomeDeArquivo(s.titulo, EXTENSAO), comoNovo ? null : alcaAtual, { alca: alcaAtual, nome: s.arquivo });
    // O disco pode demorar (pasta de rede, OneDrive, a janela de permissão do
    // navegador aberta). Se no meio o usuário abriu outro muro ou começou um
    // novo, a gravação foi do muro ANTERIOR: guardar a alça dela agora faria
    // o próximo Ctrl+S gravar o muro da tela POR CIMA do arquivo anterior.
    // Então só se dá a notícia, que é verdadeira; o muro da tela fica como está.
    if (useApp.getState().carregamento === s.carregamento) {
      alcaAtual = r.alca;
      useApp.getState().marcarSalvo(r.nome, tituloDoArquivo(r.nome), gravado);
      noArquivo(r.alca, r.nome);
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

/** O memorial em Word (.doc editável, com as equações do Word): o mesmo documento do imprimir. */
export async function exportarWordDaMemoria(): Promise<void> {
  const s = useApp.getState();
  const exportar = s.ligacoes.exportarWord;
  if (!exportar) return;
  if (!s.resultado) {
    avisar(ruim('Conta com erro: nada a exportar'));
    return;
  }
  try {
    await exportar(s.resultado, { projeto: s.titulo });
  } catch (e) {
    avisar(naoDeuPara('exportar o Word', e));
  }
}
