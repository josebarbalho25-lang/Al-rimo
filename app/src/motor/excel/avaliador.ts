/*
  AVALIADOR — transforma a árvore da fórmula numa função pronta para rodar (compila uma vez, roda a cada conta).

  Valores que circulam durante a conta:
    - escalar: número, texto, lógico, vazio (null) ou erro — o que cabe numa célula;
    - Intervalo: uma REFERÊNCIA (A1:B5) ainda não lida. Fica como referência porque várias funções tratam
      "texto vindo de referência" diferente de "texto digitado": MÁXIMO(Z5;-1) ignora o texto de Z5, mas
      MÁXIMO("x";1) dá #VALOR!; E(...) idem. E o ÍNDICE(ESCOLHER(...);i;j) precisa receber a tabela, não um valor;
    - Matriz: valores já lidos (matriz inline {1,2,3} ou resultado de conta sobre intervalo).

  Interseção implícita: a planilha é gerada pelo openpyxl, que grava fórmula "comum" (não matricial). No Excel,
  numa fórmula comum, um intervalo usado onde se espera UM valor vira a célula da mesma linha/coluna da
  fórmula (ou #VALOR!). Já dentro de SOMARPRODUTO tudo é calculado como matriz — é exatamente esse o truque que a
  planilha usa em SOMARPRODUTO(MÁXIMO((F155:F158="OK")*A155:A158)). O modo matriz é decidido na compilação:
  tudo que está dentro de um SOMARPRODUTO compila em modo matriz.
*/
import type { ErroExcel, Valor } from '../tipos';
import type { CodigoErro } from './lexico';
import { numeroDeTexto, r15, textoGeral, zeroForcado } from './numeros';
import { analisar, type No } from './sintaxe';
import { div80, mult80, potencia80, raiz80, soma80 } from './x87';

export type Escalar = Valor;

export interface Intervalo {
  readonly k: 'ref';
  readonly aba: number;
  readonly r1: number;
  readonly c1: number;
  readonly r2: number;
  readonly c2: number;
}

export interface Matriz {
  readonly k: 'mat';
  readonly nl: number;
  readonly nc: number;
  readonly v: Escalar[]; // por linha: v[i*nc + j]
}

export type V = Escalar | Intervalo | Matriz;

const E = (c: CodigoErro): ErroExcel => Object.freeze({ erro: c });
export const ERRO = {
  DIV0: E('#DIV/0!'),
  VALOR: E('#VALUE!'),
  ND: E('#N/A'),
  NUM: E('#NUM!'),
  REF: E('#REF!'),
  NOME: E('#NAME?'),
  NULO: E('#NULL!'),
} as const;
const POR_CODIGO = new Map<string, ErroExcel>(Object.values(ERRO).map((e) => [e.erro, e]));
export const erroDe = (c: CodigoErro): ErroExcel => POR_CODIGO.get(c)!;

export function ehErro(x: unknown): x is ErroExcel {
  return typeof x === 'object' && x !== null && (x as ErroExcel).erro !== undefined;
}
export function ehRef(x: V): x is Intervalo {
  return typeof x === 'object' && x !== null && (x as Intervalo).k === 'ref';
}
export function ehMat(x: V): x is Matriz {
  return typeof x === 'object' && x !== null && (x as Matriz).k === 'mat';
}

/** Quem fornece o valor das células durante uma conta (a planilha, com memória e detecção de ciclo). */
export interface Leitor {
  celula(aba: number, lin: number, col: number): Escalar;
}

/** Onde a fórmula está (para a interseção implícita) e se está em modo matriz. */
export interface Local {
  readonly aba: number;
  readonly lin: number;
  readonly col: number;
  readonly matriz: boolean;
}

export type Thunk = (L: Leitor) => V;
/** Função do Excel: recebe os argumentos SEM avaliar (SE/SEERRO/ESCOLHER só avaliam o ramo que vale). */
export type FuncaoExcel = (args: readonly (Thunk | null)[], L: Leitor, local: Local) => V;

export interface Ambiente {
  aba(nome: string): number | undefined;
  nome(nome: string): Intervalo | undefined;
  funcao(nome: string): FuncaoExcel | undefined;
  /** Funções cujos argumentos o Excel avalia como matriz mesmo numa fórmula comum (SOMARPRODUTO). */
  matricial(nome: string): boolean;
}

// ───────────────────────────── leitura de intervalos ─────────────────────────────

export function lerMatriz(r: Intervalo, L: Leitor): Matriz {
  const nl = r.r2 - r.r1 + 1;
  const nc = r.c2 - r.c1 + 1;
  const v = new Array<Escalar>(nl * nc);
  let k = 0;
  for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) v[k++] = L.celula(r.aba, i, j);
  return { k: 'mat', nl, nc, v };
}

export function intersecao(r: Intervalo, local: Local, L: Leitor): Escalar {
  if (r.r1 === r.r2 && r.c1 === r.c2) return L.celula(r.aba, r.r1, r.c1);
  let lin: number;
  let col: number;
  if (r.r1 === r.r2) lin = r.r1;
  else if (local.lin >= r.r1 && local.lin <= r.r2) lin = local.lin;
  else return ERRO.VALOR;
  if (r.c1 === r.c2) col = r.c1;
  else if (local.col >= r.c1 && local.col <= r.c2) col = local.col;
  else return ERRO.VALOR;
  return L.celula(r.aba, lin, col);
}

/** Valor para um operador ou parâmetro de valor: referência vira escalar (fórmula comum) ou matriz (modo matriz). */
export function operando(v: V, local: Local, L: Leitor): Escalar | Matriz {
  if (typeof v !== 'object' || v === null) return v;
  if ((v as Intervalo).k === 'ref') {
    const r = v as Intervalo;
    if (local.matriz && !(r.r1 === r.r2 && r.c1 === r.c2)) return lerMatriz(r, L);
    return intersecao(r, local, L);
  }
  return v as Escalar | Matriz;
}

/** Um único valor: além do `operando`, matriz vira o elemento do canto (é o que a célula mostra). */
export function escalar(v: V, local: Local, L: Leitor): Escalar {
  const x = operando(v, local, L);
  return ehMat(x) ? x.v[0] : x;
}

/** Qualquer coisa como matriz (SOMARPRODUTO, CORRESP...): escalar vira 1×1. */
export function comoMatriz(v: V, L: Leitor): Matriz {
  if (ehRef(v)) return lerMatriz(v, L);
  if (ehMat(v)) return v;
  return { k: 'mat', nl: 1, nc: 1, v: [v] };
}

// ───────────────────────────── coerções ─────────────────────────────

export function aNumero(e: Escalar): number | ErroExcel {
  if (typeof e === 'number') return e;
  if (e === null) return 0;
  if (typeof e === 'boolean') return e ? 1 : 0;
  if (typeof e === 'string') {
    const n = numeroDeTexto(e);
    return n === null ? ERRO.VALOR : n;
  }
  return e;
}

/** Lógico em texto no Excel pt-BR (="a"&VERDADEIRO dá "aVERDADEIRO"; ESQUERDA(VERDADEIRO;3) dá "VER"). */
export const VERDADEIRO = 'VERDADEIRO';
export const FALSO = 'FALSO';

export function aTexto(e: Escalar): string | ErroExcel {
  if (typeof e === 'string') return e;
  if (typeof e === 'number') return textoGeral(e);
  if (e === null) return '';
  if (typeof e === 'boolean') return e ? VERDADEIRO : FALSO;
  return e;
}

/** SE("VERDADEIRO";...) funciona no pt-BR; SE("TRUE";...) dá #VALOR! (sondado). */
export function aLogico(e: Escalar): boolean | ErroExcel {
  if (typeof e === 'boolean') return e;
  if (typeof e === 'number') return e !== 0;
  if (e === null) return false;
  if (typeof e === 'string') {
    const u = e.trim().toUpperCase();
    if (u === VERDADEIRO) return true;
    if (u === FALSO) return false;
    return ERRO.VALOR;
  }
  return e;
}

// ───────────────────────────── comparação ─────────────────────────────

// Ordem do Excel entre tipos: número < texto < lógico.
function ordemTipo(e: number | string | boolean): number {
  return typeof e === 'number' ? 0 : typeof e === 'string' ? 1 : 2;
}

const COLADOR = new Intl.Collator('pt-BR', { sensitivity: 'accent', ignorePunctuation: true });

/** Texto: igualdade sem caixa ("OK" = "ok"), mas COM acento ("á" ≠ "a"), como sondado. */
function compararTexto(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 0;
  // Ordem (<, >) não é usada pela planilha; aproximação do Windows: pontuação pesa só no desempate
  // ("a-b" < "ab" dá FALSO no Excel).
  const c = COLADOR.compare(a, b);
  if (c !== 0) return c < 0 ? -1 : 1;
  return a.length === b.length ? (la < lb ? -1 : 1) : a.length < b.length ? -1 : 1;
}

/** −1, 0, 1. Vazio vira 0, "" ou FALSO conforme o outro lado. Números comparados com 15 significativos. */
export function comparar(a: Escalar, b: Escalar): number {
  if (a === null) {
    if (b === null) return 0;
    a = typeof b === 'number' ? 0 : typeof b === 'string' ? '' : false;
  } else if (b === null) {
    b = typeof a === 'number' ? 0 : typeof a === 'string' ? '' : false;
  }
  const ta = ordemTipo(a as number);
  const tb = ordemTipo(b as number);
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (typeof a === 'number') {
    if (a === b) return 0;
    const x = r15(a);
    const y = r15(b as number);
    return x === y ? 0 : x < y ? -1 : 1;
  }
  if (typeof a === 'string') return compararTexto(a, b as string);
  return a === b ? 0 : a ? 1 : -1;
}

/** Igualdade EXATA (CORRESP tipo 0, PROCV FALSO): sem os 15 dígitos — sondado: CORRESP(0,1+0,2;{…;0,3};0) = #N/D. */
export function igualExato(alvo: Escalar, x: Escalar, curinga: RegExp | null): boolean {
  if (typeof alvo === 'number') return typeof x === 'number' && x === alvo;
  if (typeof alvo === 'string') {
    if (typeof x !== 'string') return false;
    if (curinga) return curinga.test(x);
    return x.toLowerCase() === alvo.toLowerCase();
  }
  if (typeof alvo === 'boolean') return x === alvo;
  return false;
}

// ───────────────────────────── operadores ─────────────────────────────

type Op2 = (a: Escalar, b: Escalar) => Escalar;

/** Menor double "normal". Abaixo dele o Excel não guarda nada: =1E-308/1E10 dá 0 e =1E-308/1E10=0 dá VERDADEIRO
 * (sondado); o JavaScript guardaria 1E-318 (número subnormal) e a comparação com zero daria FALSO. */
const MENOR_NORMAL = 2.2250738585072014e-308;

/** Resultado de conta: estouro vira #NÚM! (o Excel não tem infinito) e subnormal vira 0 (ver MENOR_NORMAL). */
const finito = (n: number): number | ErroExcel => {
  if (!Number.isFinite(n)) return ERRO.NUM;
  return n > -MENOR_NORMAL && n < MENOR_NORMAL ? 0 : n;
};

function aritmetica(f: (a: number, b: number) => number | ErroExcel): Op2 {
  return (x, y) => {
    const a = aNumero(x);
    if (typeof a !== 'number') return a;
    const b = aNumero(y);
    if (typeof b !== 'number') return b;
    return f(a, b);
  };
}

function potencia(a: number, b: number): number | ErroExcel {
  if (a === 0 && b === 0) return ERRO.NUM;
  if (a === 0 && b < 0) return ERRO.DIV0;
  // Expoente 2, 3 e 4 (os inteiros que a planilha usa): o Excel MULTIPLICA — x^2 = x·x, x^3 = x·x·x, x^4 = (x²)² —,
  // cada multiplicação com o arredondamento dele (x87.ts). Sondado bit a bit; o Math.pow erra o último bit em 25 a
  // 50% dos casos, e sem o arredondamento duplo o 18,2^4 já saía um bit ao lado.
  if (b === 2) return finito(mult80(a, a));
  if (b === 3) return finito(mult80(mult80(a, a), a));
  if (b === 4) {
    const q = mult80(a, a);
    return finito(mult80(q, q));
  }
  if (b === 0.5) return a < 0 ? ERRO.NUM : finito(raiz80(a)); // x^0,5 é a raiz (sondado bit a bit)
  // Outros inteiros (a planilha não usa): Math.pow, que bate com as sondas que existem (2^-1, 10^-2, (-8)^3...).
  if (Number.isInteger(b)) {
    const r = Math.pow(a, b);
    return Number.isNaN(r) ? ERRO.NUM : finito(r);
  }
  if (a === 0) return 0;
  // Fracionário: exp(b·ln a), como o Excel (x87.potencia80). Base negativa só com raiz ímpar ((−8)^(1/3) dá
  // −1,9999999999999998 no Excel, o mesmo caminho com o sinal de fora); fora disso, #NÚM!.
  if (a > 0) return finito(potencia80(a, b));
  const inv = 1 / b;
  if (Number.isInteger(inv) && Math.abs(inv) % 2 === 1) return finito(-potencia80(-a, b));
  return ERRO.NUM;
}

function comparacao(teste: (c: number) => boolean): Op2 {
  return (x, y) => {
    if (ehErro(x)) return x;
    if (ehErro(y)) return y;
    return teste(comparar(x, y));
  };
}

export const OPERADORES: Record<string, Op2> = {
  // Cada operação com o arredondamento do Excel (64 bits e depois 53 — ver x87.ts), não o do JavaScript.
  '+': aritmetica((a, b) => finito(soma80(a, b))),
  '-': aritmetica((a, b) => finito(soma80(a, -b))),
  '*': aritmetica((a, b) => finito(mult80(a, b))),
  '/': aritmetica((a, b) => (b === 0 ? ERRO.DIV0 : finito(div80(a, b)))),
  '^': aritmetica(potencia),
  '&': (x, y) => {
    const a = aTexto(x);
    if (typeof a !== 'string') return a;
    const b = aTexto(y);
    if (typeof b !== 'string') return b;
    return a + b;
  },
  '=': comparacao((c) => c === 0),
  '<>': comparacao((c) => c !== 0),
  '<': comparacao((c) => c < 0),
  '>': comparacao((c) => c > 0),
  '<=': comparacao((c) => c <= 0),
  '>=': comparacao((c) => c >= 0),
};

/** Aplica f elemento a elemento quando algum lado é matriz (com a expansão de linha/coluna única do Excel). */
export function difundir(vals: readonly (Escalar | Matriz)[], f: (...e: Escalar[]) => Escalar): Escalar | Matriz {
  let nl = 1;
  let nc = 1;
  let algum = false;
  for (const x of vals) {
    if (ehMat(x)) {
      algum = true;
      if (x.nl > nl) nl = x.nl;
      if (x.nc > nc) nc = x.nc;
    }
  }
  if (!algum) return f(...(vals as Escalar[]));
  const out = new Array<Escalar>(nl * nc);
  const tmp = new Array<Escalar>(vals.length);
  for (let i = 0; i < nl; i++) {
    for (let j = 0; j < nc; j++) {
      for (let k = 0; k < vals.length; k++) {
        const x = vals[k];
        if (!ehMat(x)) tmp[k] = x;
        else {
          const ii = x.nl === 1 ? 0 : i;
          const jj = x.nc === 1 ? 0 : j;
          tmp[k] = ii < x.nl && jj < x.nc ? x.v[ii * x.nc + jj] : ERRO.ND;
        }
      }
      out[i * nc + j] = f(...tmp);
    }
  }
  return { k: 'mat', nl, nc, v: out };
}

const simples = (x: V): x is Exclude<Escalar, ErroExcel> => typeof x !== 'object' || x === null;

// ───────────────────────────── compilação ─────────────────────────────

export function compilar(no: No, local: Local, amb: Ambiente): Thunk {
  switch (no.k) {
    case 'num':
    case 'str':
    case 'bool': {
      const v = no.v;
      return () => v;
    }
    case 'err': {
      const e = erroDe(no.v);
      return () => e;
    }
    case 'ref': {
      const aba = no.aba === null ? local.aba : amb.aba(no.aba);
      if (aba === undefined) return () => ERRO.REF;
      const r: Intervalo = { k: 'ref', aba, r1: no.r1, c1: no.c1, r2: no.r2, c2: no.c2 };
      return () => r;
    }
    case 'nome': {
      const r = amb.nome(no.v);
      if (!r) return () => ERRO.NOME;
      return () => r;
    }
    case 'mat': {
      const nl = no.linhas.length;
      const nc = no.linhas[0].length;
      const v: Escalar[] = [];
      for (const l of no.linhas) for (const c of l) v.push(ehErro(c) ? erroDe(c.erro) : c);
      const m: Matriz = { k: 'mat', nl, nc, v };
      return () => m;
    }
    case 'par':
      return compilar(no.a, local, amb);
    case 'un': {
      const fa = compilar(no.a, local, amb);
      if (no.op === '+') return fa; // o + unário do Excel não faz nada (nem converte)
      const f: (e: Escalar) => Escalar =
        no.op === '-'
          ? (e) => {
              const n = aNumero(e);
              return typeof n === 'number' ? -n || 0 : n;
            }
          : (e) => {
              const n = aNumero(e);
              return typeof n === 'number' ? div80(n, 100) : n;
            };
      return (L) => {
        const a = fa(L);
        if (simples(a)) return f(a);
        return difundir([operando(a, local, L)], f);
      };
    }
    case 'bin': {
      const fa = compilar(no.a, local, amb);
      const fb = compilar(no.b, local, amb);
      const op = OPERADORES[no.op];
      if (!op) throw new Error(`operador desconhecido ${no.op}`);
      return (L) => {
        const a = fa(L);
        const b = fb(L);
        if (simples(a) && simples(b)) return op(a, b);
        return difundir([operando(a, local, L), operando(b, local, L)], op);
      };
    }
    case 'fn': {
      const f = amb.funcao(no.nome);
      if (!f) return () => ERRO.NOME;
      const loc = amb.matricial(no.nome) && !local.matriz ? { ...local, matriz: true } : local;
      const args = no.args.map((a) => (a ? compilar(a, loc, amb) : null));
      return (L) => f(args, L, loc);
    }
  }
}

/** Fórmula de célula: devolve sempre um escalar (célula não guarda referência nem matriz; vazio vira 0). */
export type FormulaCompilada = (L: Leitor) => Escalar;

export function compilarFormula(texto: string, local: Local, amb: Ambiente): FormulaCompilada {
  const raiz = analisar(texto);
  const fim = (v: V, L: Leitor): Escalar => {
    const e = escalar(v, local, L);
    return e === null ? 0 : e;
  };
  if (raiz.k === 'bin' && (raiz.op === '+' || raiz.op === '-')) {
    // Última operação é + ou − fora de parênteses: vale o "zero forçado" do Excel (numeros.zeroForcado).
    const fa = compilar(raiz.a, local, amb);
    const fb = compilar(raiz.b, local, amb);
    const op = OPERADORES[raiz.op];
    return (L) => {
      const a = escalar(fa(L), local, L);
      const b = escalar(fb(L), local, L);
      const r = op(a, b);
      if (typeof r !== 'number') return r;
      return zeroForcado(aNumero(a) as number, r);
    };
  }
  const t = compilar(raiz, local, amb);
  return (L) => fim(t(L), L);
}
