// ═══════════════════════════════════════════════════════════════════════════
//  estado/store.ts — o estado do app (zustand)
// ---------------------------------------------------------------------------
//  O que o usuário decide: as ALTERAÇÕES da planilha e as entradas do MODELO
//  (extras). Tudo o mais é consequência e se refaz a cada mudança: a conta
//  (`calcular` do motor), o muro peça a peça (gerador ligado pela integração)
//  e o veredito. Ninguém escreve no resultado nem no modelo — eles só nascem
//  das entradas, para a tela nunca mostrar um muro de uma conta e a memória
//  de outra.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { calcular, entradas, versao } from '@/motor';
import type { Alteracoes, EntradaMeta, Resultado, Valor } from '@/motor/tipos';
import type { Modelo } from '@/modelo/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import {
  ajustarAsListas,
  ajustarAosTetos,
  aplicarValor,
  LISTA_PELA_SAPATA,
  leitorDeValores,
  mesmoValor,
  valorAtual,
  montarSecoes,
  type AjusteDeLista,
  type Campo,
  type LerValor,
} from './campos';
import type { AvisoDaPlanilha } from './avisosDaPlanilha';
import { CHAVES, ehObjeto, guardarNaAba, lembrarDaAba } from './lembrete';
import { SEM_LIGACOES, type IdAba, type Ligacoes, type Veredito } from './ligacoes';
import { desserializarProjeto, projetoNovo, recadoDeAbertura, serializarProjeto, type Projeto } from './projeto';
import { padroesDe, recalcular } from './recalculo';
import { RECADO_RUIM, ruim } from './recadoRuim';

/* ── o catálogo das entradas (fixo enquanto o app está aberto) ────────── */

export const VERSAO_DA_CONTA = versao;
export const METAS: ReadonlyMap<string, EntradaMeta> = new Map(
  [...entradas, ...ENTRADAS_DO_MODELO].map((m) => [m.nome, m] as const),
);
export const NOMES_DA_PLANILHA: ReadonlySet<string> = new Set(entradas.map((e) => e.nome));
export const SECOES = montarSecoes(entradas, ENTRADAS_DO_MODELO);
/** Todos os campos do painel por nome — a porta por onde passa o que vem de arquivo. */
export const CAMPOS: ReadonlyMap<string, Campo> = new Map(SECOES.flatMap((s) => s.campos.map((c) => [c.meta.nome, c] as const)));
const PADROES_DO_MODELO = padroesDe(ENTRADAS_DO_MODELO);
/** As entradas da planilha cuja lista depende de outra entrada (altura, vão, contraforte, espaçamentos). */
const CAMPOS_EM_LISTA: readonly Campo[] = [...CAMPOS.values()].filter((c) => c.opcoesRef && c.origem === 'planilha');

export const ABAS: ReadonlyArray<{ id: IdAba; nome: string }> = [
  { id: '3d', nome: '3D' },
  { id: 'frontal', nome: 'Vista frontal' },
  { id: 'corte', nome: 'Corte' },
  { id: 'planta', nome: 'Planta' },
  { id: 'iso', nome: 'Isométrico' },
  { id: 'memoria', nome: 'Memória' },
  { id: 'quantitativo', nome: 'Quantitativo' },
];
const ehAba = (x: unknown): x is IdAba => ABAS.some((a) => a.id === x);

/* ── o estado ─────────────────────────────────────────────────────────── */

export interface EstadoDoApp {
  /** A identidade do muro: de onde saem os GUIDs do IFC (ver estado/projeto.ts). Nasce no Novo, viaja no arquivo. */
  idDoProjeto: string;
  titulo: string;
  /** Nome do arquivo em disco, quando há. */
  arquivo: string | null;
  sujo: boolean;

  alteracoes: Alteracoes;
  extras: Record<string, Valor>;

  resultado: Resultado | null;
  erroConta: string | null;
  /** Os avisos curtos que a planilha publicou nesta conta (c' > 0…). Ver estado/avisosDaPlanilha.ts. */
  avisosDaConta: AvisoDaPlanilha[];
  modelo: Modelo | null;
  erroModelo: string | null;
  veredito: Veredito | null;
  /** O arquivo aberto foi salvo com outra versão da conta. */
  contaDoArquivo: string | null;
  /**
   * Entradas que o app trocou sozinho porque saíram da lista (contraforte 79 com o bloco trocado para 14 → 54).
   * Fica até o usuário mexer naquela entrada ou abrir outro muro: é o "→ 54" ao lado do campo.
   */
  ajustesDeLista: Record<string, AjusteDeLista>;
  /**
   * Muda a cada projeto carregado (Novo, Abrir). O Salvar espera o disco; se
   * no meio o usuário trocou de muro, o que o disco respondeu é do muro
   * ANTERIOR e não pode virar o nome nem o arquivo do muro da tela.
   * (Não serve a identidade do muro para isso: reabrir o MESMO arquivo no meio
   * do Salvar traz a mesma identidade, mas é outra carga.)
   */
  carregamento: number;

  selecionado: string | null;
  aba: IdAba;
  recado: string | null;
  ligacoes: Ligacoes;

  definir: (nome: string, valor: Valor) => void;
  carregar: (p: Projeto, arquivo: string | null, opc?: { sujo?: boolean; contaDoArquivo?: string | null }) => void;
  /**
   * O disco gravou `gravado`. Só fica "salvo" (sem •) se o que está na tela
   * ainda é aquilo: o Salvar espera o disco (e a janela de permissão do
   * navegador), e o usuário pode ter digitado no meio.
   */
  marcarSalvo: (arquivo: string, titulo: string, gravado: Projeto) => void;
  selecionar: (id: string | null) => void;
  escolherAba: (aba: IdAba) => void;
  /** Recado da barra de estado; vive alguns segundos. Prefixe com RECADO_RUIM a má notícia. */
  dizer: (recado: string | null, ms?: number) => void;
  /** A integração liga as peças das outras frentes aqui (ver ligacoes.ts). */
  ligar: (parcial: Partial<Ligacoes>) => void;
}

/*
  O "l entre travamentos" da esbeltez (Jose, 12/10) é o muro desenhado: no balanço travado nas duas pontas, o
  comprimento do muro; com contrafortes, o espaçamento entre eles (a planilha já usa o l_cf_adot e ignora o l_trav).
  A planilha não tem o comprimento (é entrada só do modelo), então o app manda o comprimento para a conta como l_trav.
  No painel, a linha do l espelha o campo de verdade (campos.ts, campoEspelhado).
*/
function comTravamentoDoModelo(a: Alteracoes, L: number | null): Alteracoes {
  const meta = METAS.get('l_trav');
  const tipo = METAS.get('Tipo_muro');
  if (!meta || !tipo || L === null || valorAtual(tipo, a) === 'Contrafortes') return a;
  return aplicarValor(a, meta, L);
}

/** A esbeltez do balanço usa o comprimento do muro? (balanço com travamento lateral) */
function travadoPeloComprimento(a: Alteracoes): boolean {
  const tipo = METAS.get('Tipo_muro');
  const trav = METAS.get('Trav_lat');
  return !!tipo && !!trav && valorAtual(tipo, a) !== 'Contrafortes' && valorAtual(trav, a) === 'Sim';
}

/*
  A conta com as listas em dia. A lista dependente sai da própria conta (aba Referências), então a ordem é: conta →
  confere as listas → valor fora vai para a opção mais próxima → conta de novo. Desde 13/10 há UMA corrente: o
  bloco decide a lista do graute a cada X (até 6t), e o graute decide a lista do espaçamento das barras (múltiplos
  dele). Trocar o bloco de 19 para 14 com graute a 100 leva o graute a 80 na 1ª volta e as barras para a grade de 80
  na 2ª. As outras listas dependem só do bloco, do tipo de muro e da sapata; o laço de voltas cobre a corrente.
  Devolve as alterações JÁ AJUSTADAS — são elas que vão para o estado, o arquivo e a conta.

  O comprimento do muro que vai para a conta (l do balanço travado) é o MODULAR, como todo valor que a modulação
  ajusta (a conta usa o ajustado — decisão do Jose, como os *_adot da planilha): 1ª volta com o digitado; se a
  modulação arredondou o comprimento (o "→"), a conta refaz com o arredondado.
*/
function contaCom(lig: Ligacoes, alteracoes: Alteracoes, extras: Record<string, Valor>) {
  const digitado = typeof extras.L_total === 'number' ? extras.L_total : PADROES_DO_MODELO.L_total;
  const rodar = (L: number | null) => {
    let final = alteracoes;
    const ajustes: Record<string, AjusteDeLista> = {};
    const calcularComTravamento = (a: Alteracoes) => calcular(comTravamentoDoModelo(a, L));
    const calcularNaLista = (pedidas: Alteracoes): Resultado => {
      let a = pedidas;
      const anotar = (t: { alteracoes: Alteracoes; ajustes: AjusteDeLista[] }) => {
        for (const aj of t.ajustes) ajustes[aj.nome] = { ...aj, de: ajustes[aj.nome]?.de ?? aj.de };
        a = t.alteracoes;
      };
      // o solo acima do muro não vai para a conta nem uma vez (a planilha não deixaria digitar)
      anotar(ajustarAosTetos(METAS, a));
      let r = calcularComTravamento(a);
      for (let volta = 0; volta < 4; volta++) {
        const t = ajustarAsListas(CAMPOS_EM_LISTA, a, (ref) => r.cel(ref));
        if (t.ajustes.length === 0) break;
        anotar(t);
        // a lista pode ter baixado a altura do muro (tipo de muro trocado): o teto do solo desce junto
        anotar(ajustarAosTetos(METAS, a));
        r = calcularComTravamento(a);
      }
      final = a;
      return r;
    };
    const feito = recalcular(
      { calcular: calcularNaLista, gerador: lig.gerador, veredito: lig.veredito },
      alteracoes,
      extras,
      PADROES_DO_MODELO,
    );
    return { ...feito, alteracoes: final, ajustesNovos: ajustes };
  };
  const primeira = rodar(typeof digitado === 'number' ? digitado : null);
  if (!travadoPeloComprimento(primeira.alteracoes)) return primeira;
  const modular = primeira.modelo?.ajustes.find((x) => x.nome === 'L_total')?.para;
  return typeof modular === 'number' && modular !== digitado ? rodar(modular) : primeira;
}

/** O que vai para o estado: a conta, as alterações ajustadas e os "→" (os de antes, menos `limpar`, mais os novos). */
function comConta(
  lig: Ligacoes,
  alteracoes: Alteracoes,
  extras: Record<string, Valor>,
  antes: Record<string, AjusteDeLista>,
  limpar: string | null,
) {
  /*
    O Ø com espera que a lista trocou ("→") volta a ser PEDIDO a cada conta. A lista dele depende de número digitado
    (altura e cobrimento da sapata), e o campo numérico manda a conta a cada tecla: digitar "0,25" passa por "0,2", e
    o Ø16 escolhido virava 12,5 no meio da digitação e ficava. Pedindo de novo o Ø do "de", ele volta assim que couber
    (e o "→" some); se ainda não couber, a lista troca de novo e o "→" continua com o Ø que o usuário escolheu. As
    outras listas dependem de escolha (bloco, tipo de muro), não de digitação, e ficam como estão.
  */
  let pedidas = alteracoes;
  const devolvidos: string[] = [];
  for (const aj of Object.values(antes)) {
    const meta = METAS.get(aj.nome);
    if (aj.nome === limpar || !meta || !LISTA_PELA_SAPATA.has(aj.nome)) continue;
    if (!mesmoValor(valorAtual(meta, pedidas), aj.para)) continue;
    pedidas = aplicarValor(pedidas, meta, aj.de);
    devolvidos.push(aj.nome);
  }
  const { ajustesNovos, ...resto } = contaCom(lig, pedidas, extras);
  const ajustesDeLista = { ...antes };
  if (limpar) delete ajustesDeLista[limpar];
  for (const nome of devolvidos) if (!(nome in ajustesNovos)) delete ajustesDeLista[nome];
  Object.assign(ajustesDeLista, ajustesNovos);
  return { ...resto, ajustesDeLista, mudouNaLista: Object.keys(ajustesNovos).length > 0 };
}

/* ── o último projeto, para o app abrir onde parou ────────────────────── */

interface Ultimo {
  texto: string;
  arquivo: string | null;
  sujo: boolean;
  /**
   * A conta com que o ARQUIVO em disco foi salvo, quando não é a de hoje. Vai
   * junto porque o texto guardado no navegador é regravado com a conta de
   * hoje: sem isto, um F5 apagava o aviso "salvo com outra versão da conta"
   * sem o arquivo ter sido salvo de novo.
   */
  contaDoArquivo?: string | null;
}

const ehUltimo = (x: unknown): x is Ultimo => ehObjeto(x) && typeof x.texto === 'string';

interface Inicio {
  p: Projeto;
  arquivo: string | null;
  sujo: boolean;
  contaDoArquivo: string | null;
  /** Má notícia para a barra de estado logo ao abrir, quando há. */
  recado: string | null;
}

/*
  O último projeto passa pela MESMA porta do Abrir (desserializarProjeto) e dá
  a MESMA notícia. Depois de uma atualização da conta, o texto guardado no
  navegador pode ter nome que a conta não tem mais, ou valor que o campo
  recusa (fbk 5 fora da lista nova): a entrada volta ao padrão — e isso pode
  ser um bloco MAIS FORTE que o pedido. Abrir calado e dizer "igual ao
  arquivo" escondia a troca; agora a barra avisa quantas ficaram de fora e o
  projeto fica marcado como alterado.
*/
function projetoInicial(): Inicio {
  // Primeira abertura (ou lembrete ilegível): o muro nasce aqui, com a identidade dele.
  const vazio: Inicio = { p: projetoNovo(), arquivo: null, sujo: false, contaDoArquivo: null, recado: null };
  const u = lembrarDaAba<Ultimo | null>(CHAVES.ultimoProjeto, null, (x): x is Ultimo | null => x === null || ehUltimo(x));
  if (!u) return vazio;
  const a = desserializarProjeto(u.texto, CAMPOS, VERSAO_DA_CONTA);
  if (!a.ok) return { ...vazio, recado: ruim(`Último muro não reaberto: ${a.motivo}`) };
  const guardada = typeof u.contaDoArquivo === 'string' ? u.contaDoArquivo : null;
  const fora = a.descartados.length + a.recusados.length;
  const arquivo = typeof u.arquivo === 'string' ? u.arquivo : null;
  return {
    p: a.projeto,
    arquivo,
    // Identidade nova num muro que tem arquivo em disco: o disco ainda não a tem, então o muro fica "não salvo"
    // até ir para lá. Muro só do navegador, sem arquivo, não tem para onde levá-la — o lembrete já a guarda, e
    // acender o • num muro em branco faria o Novo perguntar por "alterações" que não existem.
    sujo: !!u.sujo || fora > 0 || (a.ganhouId && arquivo !== null),
    contaDoArquivo: guardada ?? (a.outraVersao ? a.versaoDaConta : null),
    recado: fora > 0 ? recadoDeAbertura(a.projeto.titulo, a) : null,
  };
}

const inicio = projetoInicial();
const { mudouNaLista: inicioMudou, ...contaInicial } = comConta(SEM_LIGACOES, inicio.p.alteracoes, inicio.p.extras, {}, null);
let relogioDoRecado: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<EstadoDoApp>()((set, get) => ({
  idDoProjeto: inicio.p.id,
  titulo: inicio.p.titulo,
  arquivo: inicio.arquivo,
  sujo: inicio.sujo || inicioMudou,
  extras: inicio.p.extras,
  ...contaInicial,
  contaDoArquivo: inicio.contaDoArquivo,
  carregamento: 0,

  selecionado: null,
  aba: lembrarDaAba<IdAba>(CHAVES.aba, '3d', ehAba),
  recado: null,
  ligacoes: SEM_LIGACOES,

  definir(nome, valor) {
    const s = get();
    const meta = METAS.get(nome);
    if (!meta) return;
    if (NOMES_DA_PLANILHA.has(nome)) {
      const alteracoes = aplicarValor(s.alteracoes, meta, valor);
      const { mudouNaLista: _, ...conta } = comConta(s.ligacoes, alteracoes, s.extras, s.ajustesDeLista, nome);
      set({ sujo: true, ...conta });
    } else {
      const extras = aplicarValor(s.extras, meta, valor);
      const { mudouNaLista: _, ...conta } = comConta(s.ligacoes, s.alteracoes, extras, s.ajustesDeLista, nome);
      set({ extras, sujo: true, ...conta });
    }
  },

  carregar(p, arquivo, opc) {
    const s = get();
    // Arquivo com valor que saiu da lista (salvo antes das montagens fechadas): a conta ajusta e o muro fica
    // marcado como alterado — o que está na tela já não é o que está no disco.
    const { mudouNaLista, ...conta } = comConta(s.ligacoes, p.alteracoes, p.extras, {}, null);
    set({
      idDoProjeto: p.id,
      titulo: p.titulo,
      arquivo,
      sujo: (opc?.sujo ?? false) || mudouNaLista,
      extras: p.extras,
      contaDoArquivo: opc?.contaDoArquivo ?? null,
      carregamento: s.carregamento + 1,
      selecionado: null,
      ...conta,
    });
  },

  marcarSalvo(arquivo, titulo, gravado) {
    const s = get();
    const igual = s.alteracoes === gravado.alteracoes && s.extras === gravado.extras;
    set({ arquivo, titulo, sujo: !igual, contaDoArquivo: null });
  },

  selecionar(id) {
    set({ selecionado: id });
  },

  escolherAba(aba) {
    set({ aba });
    guardarNaAba(CHAVES.aba, aba);
  },

  dizer(recado, ms = 3500) {
    clearTimeout(relogioDoRecado);
    set({ recado });
    if (recado) relogioDoRecado = setTimeout(() => set({ recado: null }), ms);
  },

  ligar(parcial) {
    const s = get();
    const ligacoes: Ligacoes = { ...s.ligacoes, ...parcial, abas: { ...s.ligacoes.abas, ...(parcial.abas ?? {}) } };
    const { mudouNaLista: _, ...conta } = comConta(ligacoes, s.alteracoes, s.extras, s.ajustesDeLista, null);
    set({ ligacoes, ...conta });
  },
}));

if (inicio.recado) useApp.getState().dizer(inicio.recado, 8000);

/* ── leitores ─────────────────────────────────────────────────────────── */

/** Valor atual de qualquer entrada (planilha ou modelo), para a tela e para as regras de visibilidade. */
export function leitorDoEstado(s: Pick<EstadoDoApp, 'alteracoes' | 'extras'>): LerValor {
  return leitorDeValores(METAS, s.alteracoes, s.extras);
}

/** O projeto como vai para o arquivo. */
export function projetoAtual(s: Pick<EstadoDoApp, 'idDoProjeto' | 'titulo' | 'alteracoes' | 'extras'>): Projeto {
  return { id: s.idDoProjeto, titulo: s.titulo, alteracoes: s.alteracoes, extras: s.extras };
}

/** O navegador guardou o último estado desta aba? (Se não, o F5 perde o que não foi salvo.) */
let lembrado = true;

function guardarUltimo(s: EstadoDoApp): void {
  const u: Ultimo = {
    texto: serializarProjeto(projetoAtual(s), VERSAO_DA_CONTA),
    arquivo: s.arquivo,
    sujo: s.sujo,
    contaDoArquivo: s.contaDoArquivo,
  };
  lembrado = guardarNaAba(CHAVES.ultimoProjeto, u);
}

/**
 * Fechar ou recarregar a aba pergunta antes SÓ quando há alteração não salva
 * E o navegador não conseguiu guardá-la (armazenamento cheio ou bloqueado).
 * Com o muro guardado, o F5 o devolve inteiro, e perguntar a cada F5 viraria
 * ruído que se aprende a ignorar.
 */
export function perguntarAoSair(): boolean {
  return useApp.getState().sujo && !lembrado;
}

/**
 * Grava o último projeto no navegador a cada mudança do que o usuário decide.
 * Chamado uma vez em main.tsx; devolve o desligador.
 */
export function lembrarUltimoProjeto(): () => void {
  // Já na largada: a aba fica com o SEU muro desde o primeiro quadro. Sem isto,
  // um F5 antes da primeira tecla lia de novo o da máquina — que outra aba pode
  // ter trocado nesse meio-tempo.
  guardarUltimo(useApp.getState());
  const parar = useApp.subscribe((s, a) => {
    if (
      s.idDoProjeto === a.idDoProjeto &&
      s.alteracoes === a.alteracoes &&
      s.extras === a.extras &&
      s.titulo === a.titulo &&
      s.arquivo === a.arquivo &&
      s.sujo === a.sujo &&
      s.contaDoArquivo === a.contaDoArquivo
    ) {
      return;
    }
    guardarUltimo(s);
  });
  const aoSair = (e: BeforeUnloadEvent) => {
    if (!perguntarAoSair()) return;
    e.preventDefault();
    e.returnValue = ''; // o Chrome só pergunta com isto preenchido
  };
  const w = globalThis.window as (Window & typeof globalThis) | undefined;
  const temEventos = typeof w?.addEventListener === 'function';
  if (temEventos) w.addEventListener('beforeunload', aoSair);
  return () => {
    parar();
    if (temEventos) w.removeEventListener('beforeunload', aoSair);
  };
}

export { RECADO_RUIM };
