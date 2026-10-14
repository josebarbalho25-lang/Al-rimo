// ═══════════════════════════════════════════════════════════════════════════
//  estado/campos.ts — o formulário das entradas, sem tela
// ---------------------------------------------------------------------------
//  Tudo o que o painel de entradas DECIDE mora aqui, puro e testável: que
//  controle cada entrada ganha, como ela se agrupa, quando a seção aparece,
//  quando o campo se apaga, como o texto digitado vira valor, e como o valor
//  vira "alteração" para a conta. A tela (ui/PainelDeEntradas.tsx) só desenha.
//
//  As entradas vêm de DUAS fontes com o mesmo formato (EntradaMeta): as da
//  planilha (motor) e as que só o modelo usa (modelo/entradasDoModelo.ts). O
//  painel junta as duas pela seção; a ORIGEM diz para onde o valor vai — a
//  conta só recebe nome da planilha (nome que ela não conhece é erro lá).
// ═══════════════════════════════════════════════════════════════════════════

import type { Alteracoes, EntradaMeta, Valor } from '@/motor/tipos';
import { lerNumero } from './numeros';
import { definicaoDaSecao, rotuloCompleto, rotuloCurto, semCitacao } from './rotulos';
import { LUGAR, type TipoDeMuro } from './abas';

export type Origem = 'planilha' | 'modelo';

/**
 * O controle de cada entrada. A regra é a do A-PORT (`camposDaCarga.tsx`):
 * poucas opções curtas → botões à vista, um clique; muitas ou longas → lista.
 */
export type Controle = 'numero' | 'simnao' | 'escolha' | 'lista';

export interface Opcao {
  valor: Valor;
  rotulo: string;
}

/** Faixa que o campo aceita além de "não negativo" (ver FAIXA). */
export interface Faixa {
  min?: number;
  max?: number;
  /** Zero vale mesmo abaixo do mínimo: é o "sem" (junta 0 = sem junta). */
  zeroVale?: boolean;
}

export interface Campo {
  meta: EntradaMeta;
  origem: Origem;
  /** O que a tela escreve na coluna do rótulo. */
  curto: string;
  /** O nome completo da grandeza, para o `title` (pairar). Sem observação, sem fonte. */
  dica: string;
  controle: Controle;
  /** As opções da lista FIXA. Na lista dependente (opcoesRef) as opções vêm da conta: `opcoesDoCampo`. */
  opcoes: Opcao[];
  /** Intervalo da lista que depende de outra entrada ('Referências!AK5:AK21'), ou null. */
  opcoesRef: string | null;
  /** Pode ficar em branco (a planilha escolhe sozinha). */
  opcional: boolean;
  /** Zero não vale (ver POSITIVO). */
  positivo: boolean;
  /** Só número inteiro (contagem de barras). */
  inteiro: boolean;
  /** Mínimo/máximo que o campo aceita, quando há (ver FAIXA). */
  faixa: Faixa | null;
  /** Subtítulo do grupo em que a entrada mora na tela (estado/abas.ts); ausente = entrada que a tela ainda não arrumou. */
  grupo?: string;
  /** Só aparece com este tipo de muro (estado/abas.ts). */
  soCom?: TipoDeMuro;
}

export interface Secao {
  id: string;
  titulo: string;
  ordem: number;
  soCom?: TipoDeMuro;
  campos: Campo[];
}

/* ── opções ───────────────────────────────────────────────────────────── */

const SO_NUMERO = /^-?\d+(\.\d+)?$/;

/**
 * A lista da validação de dados chega às vezes como TEXTO de número ("14",
 * "19" na espessura do bloco) e o padrão como número (19). No Excel, escolher
 * "14" na lista grava o NÚMERO 14 — então aqui também: se o padrão é número,
 * a opção que é número escrito vira número.
 */
export function normalizarOpcoes(meta: EntradaMeta): Valor[] {
  if (!meta.opcoes) return [];
  const numerico = typeof meta.padrao === 'number' || meta.padrao === null;
  return meta.opcoes.map((o) =>
    numerico && typeof o === 'string' && SO_NUMERO.test(o.trim()) ? Number(o) : o,
  );
}

// null = a célula vazia da lista (o "automático" das entradas opcionais): no campo numérico o vazio já se lê "auto".
const rotuloDeOpcao = (v: Valor): string =>
  typeof v === 'number' ? String(v).replace('.', ',') : v === null ? 'auto' : String(v);

/**
 * Os rótulos das opções, sem a citação de fonte ("Líquida (curso)" →
 * "Líquida", "Bruta (NBR)" → "Bruta"): fonte é da memória, não do painel. O
 * VALOR não muda — é o texto que a planilha compara. Se tirar a fonte deixar
 * duas opções com o mesmo nome, ficam as originais (a fonte era o que as
 * distinguia).
 */
function rotulosDasOpcoes(valores: Valor[]): string[] {
  const limpos = valores.map((v) => (typeof v === 'string' ? semCitacao(v) : rotuloDeOpcao(v)));
  const servem = new Set(limpos).size === limpos.length && limpos.every((r) => r !== '');
  return servem ? limpos : valores.map(rotuloDeOpcao);
}

/**
 * Cabe em botões? A coluna do controle tem ~104 px na escala 1; cada letra
 * gasta ~6,5 px e cada botão ~12 px de folga. "Sim | Não", "C20 | C25 | C30" e
 * "Curso | NBR" cabem; "Balanço | Contrafortes" não — vira lista, que é melhor
 * do que um botão com reticências no meio da palavra.
 */
function cabeEmBotoes(rotulos: string[]): boolean {
  if (rotulos.length < 2 || rotulos.length > 3) return false;
  const letras = rotulos.reduce((s, r) => s + r.length, 0);
  return letras + 2 * rotulos.length <= 16;
}

function controleDe(opcoes: Opcao[], dependente: boolean): Controle {
  if (dependente) return 'lista';
  if (opcoes.length === 0) return 'numero';
  const r = opcoes.map((o) => o.rotulo);
  if (r.length === 2 && r.includes('Sim') && r.includes('Não')) return 'simnao';
  return cabeEmBotoes(r) ? 'escolha' : 'lista';
}

/* ── um campo ─────────────────────────────────────────────────────────── */

export function ehOpcional(meta: EntradaMeta): boolean {
  return /opcional/i.test(meta.rotulo);
}

/*
  ZERO QUE QUEBRA A CONTA. MEDIDO, não suposto: cada entrada numérica da
  planilha foi zerada no motor (balanço, contrafortes e o antigo modo validação) e
  ficaram nesta lista as que fazem células novas virarem #DIV/0! ou "—" (a
  conta divide por elas: γf, γm, γs, K, fyk, espaçamentos, d, vãos…). Zero aí
  não é um muro, é um campo errado — então o campo fica vermelho e a conta
  segue com o último valor bom, como em qualquer texto que não é número.
  Medição de 08/10/2026 (scratchpad onda1/ui/medir/zero.txt). Se a planilha
  ganhar entrada nova, refazer a medição.

  As do MODELO (comprimento, barbacã, dreno, traspasse) são DEDUÇÃO: zero ali
  quer dizer "sem", e "sem" já é a chave Sim/Não ao lado; espaçamento zero de
  barbacã faria a modulação contar infinitos furos.
*/
const POSITIVO = new Set([
  // planilha (medido). As que viraram LISTA em 09/10 (altura, vão, contraforte, espaçamentos) saíram daqui: a
  // lista não tem zero, e o que vier de arquivo fora dela vai para a opção mais próxima (ajustarAsListas).
  'bw_dir', 'Ka_dir', 'fyk_', 'd_dir', 'K_dir', 'div_adm',
  // altura de solo (09/10): a conta divide por ela (posição no perfil de 40 fatias) e a planilha só aceita > 0
  'H_solo',
  'n_cf_dir', 'K_cf', 'ramos_est', 's_est', 'K_pv', 'K_ph', 'bwv_dir', 'bwh_els',
  'B_sap', 'h_sap', 'gama_f', 'gama_m', 'gama_s',
  // modelo (dedução)
  'L_total', 'barbaca_phi', 'barbaca_s', 'dreno_esp', 'traspasse_dir',
]);

/** Contagem de barras e de ramos: 2,5 barras não existe. */
const INTEIRO = new Set(['n_cf_dir', 'n_cc', 'ramos_est']);

/*
  VALOR QUE INVERTE O VEREDITO. A revisão mediu (balanço h = 2,6, com 10
  "NÃO OK"): γf = 0,14 — a vírgula escorregada de 1,4 — transforma três
  "NÃO OK" em "OK"; γm = 0,2 e FS = 0,2 idem; φ' = 90° (e até 300°) era aceito.
  O campo não pode deixar a conta aprovar um muro por erro de digitação.
  Aqui só o que é IMPOSSÍVEL, e o campo fica vermelho:
    · γf, γm, γs e FS abaixo de 1 deixam de ser coeficiente de SEGURANÇA —
      passam a reduzir a carga ou a aumentar a resistência;
    · φ' acima de 60° não existe em solo (DEDUÇÃO: pedregulho denso fica
      perto de 45°; 60° é folga larga para enrocamento);
    · junta de controle a menos de 2 m (DEDUÇÃO): 0,05 m é vírgula
      escorregada e fazia a modulação desenhar 120 trechos. Zero continua
      valendo — é "sem junta".
  Os números são DEDUÇÃO nossa, a confirmar com o Jose. Valor estranho mas
  possível (γ do solo 1,9, Ka 0,04, K 15, fyk 5000) NÃO trava aqui: virar
  aviso ou não é decisão dele.
*/
const FAIXA: Record<string, Faixa> = {
  gama_f: { min: 1 },
  gama_m: { min: 1 },
  gama_s: { min: 1 },
  FS_tomb: { min: 1 },
  FS_desl: { min: 1 },
  phi_solo: { max: 60 },
  phi_base: { max: 60 },
  junta_cada: { min: 2, zeroVale: true },
};

/** Só para o teste conferir que todo nome destas listas existe (nome errado não protege nada). */
export const _regras = { POSITIVO, INTEIRO, FAIXA } as const;

export function campoDe(meta: EntradaMeta, origem: Origem): Campo {
  const valores = normalizarOpcoes(meta);
  const rotulos = rotulosDasOpcoes(valores);
  const opcoes = valores.map((valor, i) => ({ valor, rotulo: rotulos[i] }));
  return {
    meta,
    origem,
    curto: rotuloCurto(meta.nome, meta.rotulo),
    // Só o nome da grandeza. A observação da planilha (aula, aba do Excel,
    // "preencha se…", "conferir") é texto de tutorial e nota interna — regra
    // do dono: nada disso na tela, nem no pairar. O lugar dela é a memória.
    dica: rotuloCompleto(meta.rotulo),
    controle: controleDe(opcoes, !!meta.opcoesRef),
    opcoes,
    opcoesRef: meta.opcoesRef ?? null,
    opcional: ehOpcional(meta),
    positivo: POSITIVO.has(meta.nome),
    inteiro: INTEIRO.has(meta.nome),
    faixa: FAIXA[meta.nome] ?? null,
  };
}

/* ── as seções ────────────────────────────────────────────────────────── */

/**
 * Junta as entradas da planilha e as do modelo, pela seção, na ordem do
 * painel. Dentro de cada seção, a ordem é a da fonte (a da aba Entradas).
 */
export function montarSecoes(
  daPlanilha: readonly EntradaMeta[],
  doModelo: readonly EntradaMeta[],
): Secao[] {
  const porId = new Map<string, Secao>();
  const posicao = new Map<string, number>();
  const juntar = (meta: EntradaMeta, origem: Origem) => {
    // A tela arruma pela ordem do lançamento (estado/abas.ts); a entrada que ela ainda não conhece cai na seção da
    // faixa da planilha, no fim — não some.
    const lugar = LUGAR.get(meta.nome);
    const def = lugar
      ? { id: lugar.aba.id, titulo: lugar.aba.titulo, ordem: lugar.ordemDaAba, soCom: lugar.aba.soCom }
      : definicaoDaSecao(meta.secao);
    let s = porId.get(def.id);
    if (!s) {
      s = { id: def.id, titulo: def.titulo, ordem: lugar ? def.ordem : Math.max(def.ordem, 500), soCom: def.soCom, campos: [] };
      porId.set(def.id, s);
    }
    const c = campoDe(meta, origem);
    if (lugar) {
      c.grupo = lugar.grupo;
      if (lugar.soCom) c.soCom = lugar.soCom;
      posicao.set(meta.nome, lugar.posicao);
    }
    s.campos.push(c);
  };
  for (const m of daPlanilha) juntar(m, 'planilha');
  for (const m of doModelo) juntar(m, 'modelo');
  // dentro da aba, a ordem da tela; a entrada sem lugar vai depois, na ordem da fonte (sort estável)
  const fim = Number.MAX_SAFE_INTEGER;
  for (const s of porId.values()) s.campos.sort((a, b) => (posicao.get(a.meta.nome) ?? fim) - (posicao.get(b.meta.nome) ?? fim));
  // sort é estável: seções de mesma ordem (desconhecidas) ficam na ordem em que apareceram.
  return [...porId.values()].sort((a, b) => a.ordem - b.ordem);
}

/* ── o valor de cada entrada ──────────────────────────────────────────── */

/** Lê o valor ATUAL de um nome: o alterado, se houver; senão o padrão. */
export type LerValor = (nome: string) => Valor;

export function valorAtual(meta: EntradaMeta, alteracoes: Alteracoes): Valor {
  return Object.prototype.hasOwnProperty.call(alteracoes, meta.nome) ? alteracoes[meta.nome] : meta.padrao;
}

/** Igualdade de valor de entrada: 14 e "14" são a mesma escolha da lista. */
export function mesmoValor(a: Valor, b: Valor): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a === 'number' && typeof b === 'string') return SO_NUMERO.test(b.trim()) && Number(b) === a;
  if (typeof b === 'number' && typeof a === 'string') return SO_NUMERO.test(a.trim()) && Number(a) === b;
  return false;
}

/**
 * Grava o valor como ALTERAÇÃO: igual ao padrão, a chave sai. O arquivo e a
 * conta carregam só o que o usuário mudou — que é o que `Alteracoes` quer dizer
 * no contrato do motor.
 */
export function aplicarValor(alteracoes: Alteracoes, meta: EntradaMeta, valor: Valor): Alteracoes {
  const novo = { ...alteracoes };
  if (mesmoValor(valor, meta.padrao)) delete novo[meta.nome];
  else novo[meta.nome] = valor;
  return novo;
}

/* ── o texto do campo ─────────────────────────────────────────────────── */

export type LidoDoCampo = { ok: true; valor: number | null } | { ok: false };

type Regras = Pick<Campo, 'opcional'> & Partial<Pick<Campo, 'positivo' | 'inteiro' | 'faixa'>>;

/** O número cabe nas regras do campo? */
function numeroAceito(v: number, campo: Regras): boolean {
  if (!Number.isFinite(v) || v < 0) return false;
  if (campo.positivo && v === 0) return false;
  if (campo.inteiro && !Number.isInteger(v)) return false;
  const f = campo.faixa;
  if (f && !(f.zeroVale && v === 0)) {
    if (f.min !== undefined && v < f.min) return false;
    if (f.max !== undefined && v > f.max) return false;
  }
  return true;
}

/**
 * O texto digitado num campo numérico → valor, ou recusa.
 * Vazio só vale em campo opcional (vira "auto": a planilha decide).
 * Negativo é recusado: nenhuma entrada do muro é negativa (DEDUÇÃO — conferir
 * se algum dia entrar cota de nível, que pode ser negativa). Zero, só onde a
 * conta aguenta (POSITIVO); fração, só onde não é contagem (INTEIRO).
 */
export function lerDoCampo(texto: string, campo: Regras): LidoDoCampo {
  const l = lerNumero(texto);
  if (l.tipo === 'vazio') return campo.opcional ? { ok: true, valor: null } : { ok: false };
  if (l.tipo === 'invalido' || !numeroAceito(l.valor, campo)) return { ok: false };
  return { ok: true, valor: l.valor };
}

/**
 * Um valor que veio de FORA da tela (arquivo .alrimo, último projeto do
 * navegador) → o valor que o campo aceitaria, ou recusa.
 *
 * O arquivo é texto e pode ter sido editado à mão, ou salvo por outra versão.
 * Sem esta porta, "2,6" (texto) ia para a conta como texto, 17 entrava na
 * espessura do bloco, e "contrafortes" em minúscula fazia a conta calcular
 * contraforte (o Excel compara sem caixa) com as seções de contraforte
 * escondidas no painel. Aqui:
 *   · número escrito como texto ("2,6") vira número — é o que o campo faria;
 *   · opção com outra caixa vira a opção da lista ("contrafortes" → "Contrafortes");
 *   · o resto que o campo recusaria é recusado (quem chama conta e avisa).
 */
export function validarValor(campo: Campo, v: unknown): { ok: true; valor: Valor } | { ok: false } {
  if (v === null) return campo.opcional || campo.meta.padrao === null ? { ok: true, valor: null } : { ok: false };
  // Lista dependente: o que vale depende das outras entradas do MESMO arquivo, que ainda não foram lidas. Aqui
  // passa o número que o campo aceitaria; o que sair da lista a conta ajusta depois (ajustarAsListas).
  if (campo.controle === 'numero' || campo.opcoesRef) {
    if (typeof v === 'number') return numeroAceito(v, campo) ? { ok: true, valor: v } : { ok: false };
    if (typeof v === 'string') {
      const l = lerDoCampo(v, campo);
      return l.ok ? { ok: true, valor: l.valor } : { ok: false };
    }
    return { ok: false };
  }
  if (typeof v !== 'number' && typeof v !== 'string' && typeof v !== 'boolean') return { ok: false };
  const exata = campo.opcoes.find((o) => mesmoValor(o.valor, v));
  if (exata) return { ok: true, valor: exata.valor };
  if (typeof v === 'string') {
    const t = v.trim().toLocaleLowerCase('pt-BR');
    const semCaixa = campo.opcoes.find((o) => typeof o.valor === 'string' && o.valor.toLocaleLowerCase('pt-BR') === t);
    if (semCaixa) return { ok: true, valor: semCaixa.valor };
  }
  return { ok: false };
}

/* ── as listas que dependem de outra entrada ──────────────────────────── */

/*
  Montagens fechadas (Jose, 09/10): altura, vão entre contrafortes, contraforte e espaçamentos só em valores da
  lista — e a lista muda com o tipo de muro ou com o bloco. Os Ø das barras com espera, com a sapata (só os que a
  dobra do pé cabe). Ela mora na planilha (aba Referências, células com fórmula), então as opções saem da CONTA
  ATUAL: o app não tem uma segunda cópia da regra para divergir.
*/

/** Lê uma célula do Resultado ('Referências!AK5'). */
export type LerCelula = (ref: string) => Valor;

const colunaParaNumero = (c: string): number => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const numeroParaColuna = (n: number): string => {
  let s = '';
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s;
  return s;
};

/** 'Referências!AK5:AK21' → ['Referências!AK5', …, 'Referências!AK21'] (linha a linha). */
export function celulasDoIntervalo(ref: string): string[] {
  const m = /^(.+)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`intervalo inválido: ${ref}`);
  const [, aba, c1, r1, c2, r2] = m;
  const out: string[] = [];
  for (let r = Number(r1); r <= Number(r2); r++) {
    for (let c = colunaParaNumero(c1); c <= colunaParaNumero(c2); c++) out.push(`${aba}!${numeroParaColuna(c)}${r}`);
  }
  return out;
}

/**
 * As opções que o campo oferece AGORA. Lista fixa: as da planilha. Lista dependente: os números do intervalo na
 * conta atual — célula vazia, "" e "—" ficam de fora (a planilha completa a coluna com "" quando o bloco tem menos
 * opções) —, com "auto" na frente quando a entrada é opcional (a célula vazia do topo da lista no Excel).
 */
export function opcoesDoCampo(campo: Campo, cel: LerCelula): Opcao[] {
  if (!campo.opcoesRef) return campo.opcoes;
  const ops: Opcao[] = [];
  for (const ref of celulasDoIntervalo(campo.opcoesRef)) {
    const v = cel(ref);
    if (typeof v === 'number' && Number.isFinite(v)) ops.push({ valor: v, rotulo: rotuloDeOpcao(v) });
  }
  return campo.opcional ? [{ valor: null, rotulo: rotuloDeOpcao(null) }, ...ops] : ops;
}

/*
  EMPATE entre duas opções (1,50 entre 1,40 e 1,60): fica a do lado da segurança, a mesma direção em que a planilha
  ajusta o digitado (l_cf_adot, tenr_adot para cima; s_adot para baixo). Espaçamento menor = mais barra; vão, altura
  e contraforte maiores = mais carga ou mais seção, e é para cima que a conta ajusta.
*/
const EMPATE_PARA_BAIXO = new Set(['s_dir', 's_pv_dir', 's_ph_dir', 'h_pan']);

/*
  Ø DA BARRA COM ESPERA (Jose, 09/10): a lista é dos Ø cuja dobra do pé cabe na sapata (Referências, coluna AS).
  Baixou a sapata e o Ø não cabe mais → fica o MAIOR que cabe, nunca um Ø maior que o escolhido. Como a dobra cresce
  com o Ø, a lista é sempre do 6,3 até um teto, e o "mais próximo" já daria isso; a regra fica escrita para não
  depender dessa coincidência. Diferente das outras listas, esta depende de número DIGITADO (altura e cobrimento da
  sapata): o store devolve o Ø escolhido quando ele volta a caber (store.ts, comConta).
*/
export const LISTA_PELA_SAPATA: ReadonlySet<string> = new Set(['phi_v', 'phi_pv', 'phi_cf', 'phi_cc']);

/*
  ESPAÇAMENTO DAS BARRAS NA GRADE DO GRAUTE (Jose, 13/10: "bloqueia de acordo com o campo de graute"). A lista do
  espaçamento só tem múltiplos do graute a cada X. Trocou o graute e o espaçamento saiu da lista → o MAIOR múltiplo
  abaixo dele (mais barra, a favor), como a planilha faz no s adotado (ROUNDDOWN); só sobe quando não há nenhum
  abaixo (graute a cada 80 com barra a 60: a lista é só 80).
*/
const ESPACAMENTO_NA_GRADE: ReadonlySet<string> = new Set(['s_dir', 's_pv_dir']);

/** O que a troca automática fez num campo, para a tela mostrar ("→ 54"). */
export interface AjusteDeLista {
  nome: string;
  de: number;
  para: number;
}

/**
 * Valor atual que saiu da lista dependente (ex.: contraforte 79 e o bloco trocado para 14, cuja lista é 34/54)
 * → a opção mais próxima; empate, a do lado da segurança (Ø com espera: a maior que cabe na sapata). No Excel a
 * lista só confere no momento em que se digita (lá a linha "Entradas nas listas" acusa); aqui a troca é na hora, e
 * o ajuste aparece ao lado do campo.
 * Só número sai da lista: em branco ("auto") é sempre aceito na entrada opcional.
 */
export function ajustarAsListas(
  campos: Iterable<Campo>,
  alteracoes: Alteracoes,
  cel: LerCelula,
): { alteracoes: Alteracoes; ajustes: AjusteDeLista[] } {
  let novas = alteracoes;
  const ajustes: AjusteDeLista[] = [];
  for (const campo of campos) {
    if (!campo.opcoesRef || campo.origem !== 'planilha') continue;
    const v = valorAtual(campo.meta, novas);
    if (typeof v !== 'number') continue;
    const nums = opcoesDoCampo(campo, cel)
      .map((o) => o.valor)
      .filter((x): x is number => typeof x === 'number');
    if (nums.length === 0 || nums.some((o) => mesmoValor(o, v))) continue;
    const paraBaixo = EMPATE_PARA_BAIXO.has(campo.meta.nome);
    let melhor = nums[0];
    for (const o of nums) {
      const d = Math.abs(o - v) - Math.abs(melhor - v);
      if (d < -1e-9 || (Math.abs(d) <= 1e-9 && (paraBaixo ? o < melhor : o > melhor))) melhor = o;
    }
    const abaixo = nums.filter((o) => o < v);
    if ((LISTA_PELA_SAPATA.has(campo.meta.nome) || ESPACAMENTO_NA_GRADE.has(campo.meta.nome)) && abaixo.length > 0) {
      melhor = Math.max(...abaixo);
    }
    novas = aplicarValor(novas, campo.meta, melhor);
    ajustes.push({ nome: campo.meta.nome, de: v, para: melhor });
  }
  return { alteracoes: novas, ajustes };
}

/*
  TETO QUE É OUTRA ENTRADA. A altura de solo não passa da altura do muro (Jose, 09/10): na planilha a validação
  barra o número ao digitar; aqui o valor acima do teto vai para o teto e o "→" aparece ao lado do campo, como na
  lista. Pega os dois caminhos: digitar o solo acima do muro, e baixar o muro (ou trocar o tipo de muro, que encurta
  a lista da altura) com o solo lá em cima. O teto é lido das alterações JÁ ajustadas pela lista — por isso quem chama
  roda esta depois de ajustarAsListas.
*/
const TETO: Readonly<Record<string, string>> = { H_solo: 'H_muro' };

/** Só para o teste conferir que os nomes existem. */
export const _tetos = TETO;

export function ajustarAosTetos(
  metas: ReadonlyMap<string, EntradaMeta>,
  alteracoes: Alteracoes,
): { alteracoes: Alteracoes; ajustes: AjusteDeLista[] } {
  let novas = alteracoes;
  const ajustes: AjusteDeLista[] = [];
  for (const [nome, nomeDoTeto] of Object.entries(TETO)) {
    const meta = metas.get(nome);
    const metaTeto = metas.get(nomeDoTeto);
    if (!meta || !metaTeto) continue;
    const v = valorAtual(meta, novas);
    const teto = valorAtual(metaTeto, novas);
    if (typeof v !== 'number' || typeof teto !== 'number' || v <= teto) continue;
    novas = aplicarValor(novas, meta, teto);
    ajustes.push({ nome, de: v, para: teto });
  }
  return { alteracoes: novas, ajustes };
}

/* ── o que aparece e o que se apaga ───────────────────────────────────── */

/** A entrada aparece com o tipo de muro atual? (a armadura do balanço some com contrafortes, e vice-versa) */
export function campoVisivel(campo: Pick<Campo, 'soCom'>, ler: LerValor): boolean {
  return !campo.soCom || ler('Tipo_muro') === campo.soCom;
}

/** A seção aparece? (Armadura só no balanço; Contraforte e Painel só com contrafortes) */
export function secaoVisivel(secao: Pick<Secao, 'soCom'>, ler: LerValor): boolean {
  if (!secao.soCom) return true;
  return ler('Tipo_muro') === secao.soCom;
}

/*
  O campo que a conta IGNORA na situação atual fica apagado (como `.campo:disabled`
  do A-PORT), e não some: a planilha mantém todos à vista, e a linha que some
  faz o painel pular debaixo do mouse. As condições foram LIDAS nas fórmulas
  da planilha (planilha.gerada.json):
    · αv, αh, l     → 'Muro em balanço'!B7: IF(Trav_lat="Sim", …, 2·H)
    · zNA, γw       → 'Solo e Empuxo'!D44…: IF(Agua="Sim", …, 0)
    · balanço na ponta → Contrafortes!B9/B39: só com tipo_cf = Extremidade
    · γ do contraforte → só pesa com Tipo_muro = Contrafortes (está na seção
                       da fundação, que aparece nos dois tipos)
    · bw da seção I → só sem grauteamento total (seção cheia não tem alma)
    · o que é só do BALANÇO (bw, Ø vertical, s, d, K na flexão,
      M2d, o painel não armado entre canaletas menos a argamassa, σsg) → com
      contrafortes a conta passa para as abas Contrafortes e Fundação, que
      não os leem. Aceso, "Ø vertical" e "K na flexão" apareciam DUAS vezes
      e só uma das duas valia.
  Estas foram achadas pela revisão MEDINDO a conta: mudar o valor não mexia
  em nenhuma célula do tipo de muro ativo, nem no muro gerado — exceto Ø
  vertical, s e d, que a modulação ainda usa para o comprimento da espera do
  painel (defeito da modulação, avisado; a conta não os usa).
  As do modelo seguem a mesma ideia: barbacã e dreno só ligados. O Ø da cinta
  é o Ø de TODAS as canaletas no balanço (a planilha do balanço não tem Ø
  horizontal; DEDUÇÃO da modulação), então vale sempre no balanço; com
  contrafortes, só com cinta.
*/
const soNoBalanco = (l: LerValor) => l('Tipo_muro') !== 'Contrafortes';
// graute a cada X (13/10): 20 cm (o meio módulo) = todos os furos, seção cheia
const grauteTotal = (l: LerValor) => {
  const x = l('Graute');
  return typeof x === 'number' && x <= 20;
};

/** O número que a CONTA deu (nome definido da planilha); null sem conta ou com "—". */
export type LerConta = (nome: string) => number | null;

const ATIVA_SE: Record<string, (ler: LerValor, conta?: LerConta) => boolean> = {
  alfa_v: (l) => l('Trav_lat') === 'Sim',
  alfa_h: (l) => l('Trav_lat') === 'Sim',
  l_trav: (l) => l('Trav_lat') === 'Sim',
  z_NA: (l) => l('Agua') === 'Sim',
  gama_w: (l) => l('Agua') === 'Sim',
  bal_cf: (l) => String(l('tipo_cf') ?? '').startsWith('Extrem'),
  gama_cf: (l) => l('Tipo_muro') === 'Contrafortes',
  // área de referência do fpk: com grauteamento total a planilha usa fpk* e ignora a escolha — no balanço
  // (fpk_liq = fpk_tab) e, desde 13/10, também no painel entre contrafortes (fpk_pn = fpk*)
  fpk_ref: (l) => !grauteTotal(l),
  // espessura do reboco só pesa com reboco (Entradas, g_reb: IF(reb_fac=…;…;0))
  reb_esp: (l) => l('reb_fac') !== 'Nenhum',
  // o aterro da frente só conta com a garantia do solo da frente (Fundação: IF(pass_on="Sim";…;0))
  h_fr: (l) => l('pass_on') === 'Sim',
  // posição do dente: só com dente (largura e altura > 0)
  x_den: (l) => Number(l('b_den') ?? 0) > 0 && Number(l('h_den') ?? 0) > 0,
  bw_dir: (l) => soNoBalanco(l) && !grauteTotal(l),
  // alma da seção I do ELS do painel: seção cheia não tem alma (Contrafortes: bw_ev, bw_eh = bm com total)
  bwv_dir: (l) => !grauteTotal(l),
  bwh_els: (l) => !grauteTotal(l),
  phi_v: soNoBalanco,
  s_dir: soNoBalanco,
  d_dir: soNoBalanco,
  K_dir: soNoBalanco,
  M2d_on: soNoBalanco,
  h_pan: soNoBalanco,
  caso_pan: soNoBalanco,
  beta_dir: soNoBalanco,
  sig_pan: soNoBalanco,
  sg_on: soNoBalanco,
  phi_cinta: (l) => soNoBalanco(l) || l('cinta_topo') === 'Sim',
  barbaca_phi: (l) => l('barbaca_on') === 'Sim',
  barbaca_s: (l) => l('barbaca_on') === 'Sim',
  dreno_esp: (l) => l('dreno_on') === 'Sim',
  dreno_folga: (l) => l('dreno_on') === 'Sim',
  // estribo do contraforte só quando a conta pede (Jose, 13/10; planilha 05 do Carini): com Asw/s de cálculo = 0 a
  // planilha zera Asw,ef e o nº de estribos e o muro sai sem estribo — Ø, ramos e s não mexem em nada. É a única
  // regra que lê a CONTA e não uma entrada; sem conta (ou com "—") o campo fica aceso, como antes.
  phi_est: (_, conta) => conta?.('Asw_c') !== 0,
  ramos_est: (_, conta) => conta?.('Asw_c') !== 0,
  s_est: (_, conta) => conta?.('Asw_c') !== 0,
  // a tabela de Gerscovich não tem argila: com Argila a planilha escreve "—" na sugestão pela classe
  Classe_G: (l) => l('Tipo_solo') !== 'Argila',
};

export function entradaAtiva(nome: string, ler: LerValor, conta?: LerConta): boolean {
  const regra = ATIVA_SE[nome];
  return regra ? regra(ler, conta) : true;
}

/*
  CAMPO TRAVADO NUM VALOR. Mais que apagado: a entrada não se aplica e o campo MOSTRA isso no lugar do valor, sem
  deixar escolher. A classe de solo com argila (Jose, 09/10) fica em "Não se aplica" — opção que a lista da planilha
  tem. A conta não precisa receber o valor (a planilha já ignora a classe com argila), então o que o usuário tinha
  escolhido não se perde: voltando para areia, a classe dele reaparece.
*/
const TRAVADO_SE: Record<string, (ler: LerValor) => Valor | undefined> = {
  Classe_G: (l) => (l('Tipo_solo') === 'Argila' ? 'Não se aplica' : undefined),
};

/*
  O "AUTO" COM NÚMERO (Jose, 12/10: o peso próprio deixou de ser digitado). A entrada opcional vazia mostrava só
  "auto"; quando a planilha publica o valor que usou no lugar dela, o campo vazio mostra esse número, apagado como
  todo texto de exemplo — o engenheiro vê o que a conta adotou sem abrir a memória, e digitar por cima continua
  mandando. Mesma unidade da entrada (o nome da direita é a célula "usado" da planilha).
*/
export const VALOR_AUTO: Readonly<Record<string, string>> = {
  peso_par: 'peso_us',
  gama_cf: 'gama_cf_us',
  sig_adm_dir: 's_adm',
  ks_dir: 'k_mola',
  s_pv_dir: 's_pv',
  s_ph_dir: 's_ph',
  // fgk preso à linha do fbk da Fig. 23 (Jose, 13/10: "vincular com a seleção na tabela, mas deixa aberto"): vazio
  // mostra o fgk da tabela e acompanha a troca do fbk; digitado manda. É o fgk_ da planilha:
  // IF(ISNUMBER(fgk_dir); fgk_dir; PROCV(fbk_; tabela)).
  fgk_dir: 'fgk_',
  // K da flexão horizontal do painel (13/10): vazio = 0,5 (seção horizontal não toda grauteada) ou 1,0 (total)
  K_ph: 'K_ph_us',
  // traspasse (13/10): vazio = 2,0 × ℓb no graute (NBR 6118). Só o balanço mostra o número — com contrafortes são
  // três barras com traspasses diferentes (painel, contraforte, construtivas) e o campo fica "auto"
  traspasse_dir: 'l0t_v',
};

/** O valor em que o campo fica travado na situação atual, ou undefined (campo livre). */
export function valorTravado(nome: string, ler: LerValor): Valor | undefined {
  const regra = TRAVADO_SE[nome];
  return regra ? regra(ler) : undefined;
}

/*
  CAMPO ESPELHO (Jose, 12/10). O "l entre travamentos" da Geometria não é um número à parte: é o muro desenhado.
    - contrafortes: l = espaçamento entre contrafortes (eixo a eixo) — a lista dos vãos que amarram com o bloco, a
      mesma do grupo Contrafortes; a planilha usa o adotado (l_cf_adot) no he_;
    - balanço (travado nas duas pontas): l = comprimento do muro (grupo Modelo); o store manda o comprimento para a
      conta como l_trav, porque a planilha não tem o comprimento.
  A linha mostra e EDITA o campo de verdade (mesma lista, mesmo "→"), e o 3D se refaz. Na planilha o l_trav continua
  entrada — lá o projetista digita o comprimento entre travamentos.
*/
const ESPELHO_SE: Record<string, { alvo: (ler: LerValor) => string; rotulo: (ler: LerValor) => string; ativa: (ler: LerValor) => boolean }> = {
  l_trav: {
    alvo: (l) => (l('Tipo_muro') === 'Contrafortes' ? 'l_cf' : 'L_total'),
    rotulo: (l) => (l('Tipo_muro') === 'Contrafortes' ? 'Entre contrafortes l' : 'Comprimento do muro l'),
    // com contrafortes é o próprio espaçamento, que a conta usa sempre (painel, contraforte, sapata); no balanço só
    // a esbeltez usa, e só com travamento lateral
    ativa: (l) => l('Tipo_muro') === 'Contrafortes' || l('Trav_lat') === 'Sim',
  },
};

/** O campo que esta linha espelha na situação atual (nome, rótulo e se está ativo), ou null. */
export function campoEspelhado(nome: string, ler: LerValor): { alvo: string; rotulo: string; ativa: boolean } | null {
  const e = ESPELHO_SE[nome];
  return e ? { alvo: e.alvo(ler), rotulo: e.rotulo(ler), ativa: e.ativa(ler) } : null;
}

/* ── o valor que a modulação ajustou ──────────────────────────────────── */

/*
  A modulação diz o que ajustou pelo nome que ELA usa (Modelo.ajustes): às
  vezes o da entrada (H_muro, l_cf, tenr_), às vezes o da célula adotada da
  planilha (s_adot) ou o nome sem o "_dir" das entradas opcionais (s_pv, s_ph,
  eenr). O "→ 1,60" tem de aparecer na linha que o usuário digitou — senão o
  ajuste existe e ninguém vê.
*/
const AJUSTE_PARA_ENTRADA: Record<string, string> = { s_adot: 's_dir' };

/** A entrada do painel a que um ajuste da modulação se refere, ou null. */
export function entradaDoAjuste(nome: string, existe: (n: string) => boolean): string | null {
  if (existe(nome)) return nome;
  const apelido = AJUSTE_PARA_ENTRADA[nome];
  if (apelido && existe(apelido)) return apelido;
  if (existe(`${nome}_dir`)) return `${nome}_dir`;
  return null;
}

/** Um leitor de valor atual sobre as duas fontes (planilha + modelo). */
export function leitorDeValores(
  metas: ReadonlyMap<string, EntradaMeta>,
  alteracoes: Alteracoes,
  extras: Record<string, Valor>,
): LerValor {
  return (nome) => {
    const m = metas.get(nome);
    if (!m) return null;
    if (Object.prototype.hasOwnProperty.call(alteracoes, nome)) return alteracoes[nome];
    if (Object.prototype.hasOwnProperty.call(extras, nome)) return extras[nome];
    return m.padrao;
  };
}
