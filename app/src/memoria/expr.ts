/*
  A LINHA DE CONTA COMO EXPRESSÃO.

  Uma mesma árvore faz três coisas: desenha o TeX simbólico (h_e/t), desenha o TeX com os números (3,20/0,19) e é
  avaliada (16,84). O teste da memória exige, em todos os cenários do gabarito, que a avaliação dê o número da célula
  — então a linha que o engenheiro lê é a conta que a planilha fez, e não uma narração que pode ter ficado para trás.

  Folhas da árvore:
  - nome(): grandeza da planilha, lida do Resultado pelo NOME DEFINIDO. Também aceita endereço ('Aba!F84') para as
    células sem nome (a tabela de fatias do empuxo) e intervalo ('Aba!F45:F83') = a SOMA dele, como o SUM da planilha.
  - cte(): constante escrita na fórmula (0,7 · 2 · 45°), com as casas em que ela aparece na norma.
*/
import type { Resultado, Valor } from '@/motor/tipos';
import type { Expr } from './tipos';
import { nt, texUnidade } from './formato';

type Op = '+' | '-' | '*' | '/' | '^';

// ───────────────────────────── construtores ─────────────────────────────

/** Grandeza da planilha. `fator` converte unidade na leitura (t em cm → m: 0,01). */
export function nome(nome: string, tex: string, casas: number, unidade?: string, opcoes?: { fator?: number }): Expr {
  const e: Expr = { k: 'nome', nome, tex, casas };
  if (unidade !== undefined) e.unidade = unidade;
  if (opcoes?.fator !== undefined && opcoes.fator !== 1) e.fator = opcoes.fator;
  return e;
}

/** Constante escrita na fórmula. */
export const cte = (v: number, casas: number): Expr => ({ k: 'num', v, casas });

/** π — o PI() da planilha. Escreve-se "π" também na linha dos números, como na conta de mão (π × 1,0²/4). */
export const pi = (): Expr => ({ k: 'num', v: Math.PI, casas: 4, tex: '\\pi' });

const op = (o: Op, a: Expr, b: Expr): Expr => ({ k: 'op', op: o, a, b });
const dobra = (o: Op, xs: Expr[]): Expr => {
  if (xs.length === 0) throw new Error(`expressão vazia em "${o}"`);
  return xs.slice(1).reduce((acc, x) => op(o, acc, x), xs[0]);
};

export const soma = (...xs: Expr[]): Expr => dobra('+', xs);
export const sub = (a: Expr, b: Expr): Expr => op('-', a, b);
export const mul = (...xs: Expr[]): Expr => dobra('*', xs);
export const div = (a: Expr, b: Expr): Expr => op('/', a, b);
export const pot = (a: Expr, b: Expr | number): Expr => op('^', a, typeof b === 'number' ? cte(b, 0) : b);
export const neg = (a: Expr): Expr => ({ k: 'neg', a });
export const par = (a: Expr): Expr => ({ k: 'par', a });

/*
  ARREDONDAMENTOS DA PLANILHA — a inteiro, que é o único que ela usa (ROUNDUP(x;0), ROUNDDOWN(x;0), CEILING(x;1),
  INT). A linha mostra ⌈ ⌉ / ⌊ ⌋ em vez de esconder o arredondamento: "n = ⌈2,93⌉ = 3" é a conta que o engenheiro
  confere. A folga que a planilha subtrai antes do ROUNDUP (−0,005) vai escrita dentro, como está lá.
*/
/** ROUNDUP(x;0) e CEILING(x;1): ⌈x⌉. */
export const arredCima = (a: Expr): Expr => ({ k: 'par', a, arred: 'cima' });
/** ROUNDDOWN(x;0): ⌊x⌋ (corta em direção ao zero). */
export const arredBaixo = (a: Expr): Expr => ({ k: 'par', a, arred: 'baixo' });
/** INT(x): ⌊x⌋ (o inteiro de baixo, também para negativo). */
export const inteiro = (a: Expr): Expr => ({ k: 'par', a, arred: 'int' });

const fn = (f: Extract<Expr, { k: 'fn' }>['fn'], ...args: Expr[]): Expr => ({ k: 'fn', fn: f, args });
export const raiz = (a: Expr): Expr => fn('sqrt', a);
export const cbrt = (a: Expr): Expr => fn('cbrt', a);
export const min = (...xs: Expr[]): Expr => fn('min', ...xs);
export const max = (...xs: Expr[]): Expr => fn('max', ...xs);
export const abs = (a: Expr): Expr => fn('abs', a);
export const tan = (a: Expr): Expr => fn('tan', a);
export const cos = (a: Expr): Expr => fn('cos', a);
export const sin = (a: Expr): Expr => fn('sin', a);
/** Graus → radianos. No desenho é invisível; as constantes somadas dentro dele ganham "°". */
export const rad = (a: Expr): Expr => fn('rad', a);

// ───────────────────────────── leitura da planilha ─────────────────────────────

const COL = (s: string) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const LETRAS = (n: number) => {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/*
  O Excel enxerga 15 algarismos antes de arredondar (o motor sondou: TETO(3 + 3·2⁻⁵⁰; 1) = 3). Sem este corte, um
  2,0000000000000004 vindo de soma em double subiria para 3 aqui e ficaria 2 na planilha.
*/
const r15 = (x: number) => (Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(15)) : x);

function arredonda(x: number, modo: 'cima' | 'baixo' | 'int'): number {
  const y = r15(x);
  if (modo === 'int') return Math.floor(y);
  const m = modo === 'cima' ? Math.ceil(Math.abs(y)) : Math.floor(Math.abs(y));
  return (y < 0 ? -m : m) || 0;
}

/*
  Célula VAZIA na conta vale zero — é o que o Excel faz (campo apagado no formulário: h em branco → Ea = 0). A linha
  numérica mostra esse zero, que é o número que a planilha de fato usou; o dado de entrada continua "—".
  Texto na conta ("—", "não resiste") não é número: NaN, e o teste acusa quem montou essa conta.
*/
function comoNumero(v: Valor): number {
  if (v === null || v === '') return 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

/** As células de um intervalo 'Aba!F45:F83', na ordem da planilha (linha a linha). */
export function celulasDoIntervalo(ref: string): string[] {
  const i = ref.lastIndexOf('!');
  const aba = ref.slice(0, i);
  const [a, b] = ref.slice(i + 1).replace(/\$/g, '').split(':');
  const pa = /^([A-Z]+)(\d+)$/.exec(a);
  const pb = /^([A-Z]+)(\d+)$/.exec(b ?? a);
  if (!pa || !pb) throw new Error(`intervalo inválido: ${ref}`);
  const out: string[] = [];
  for (let l = +pa[2]; l <= +pb[2]; l++) {
    for (let c = COL(pa[1]); c <= COL(pb[1]); c++) out.push(`${aba}!${LETRAS(c)}${l}`);
  }
  return out;
}

/**
  Número de uma folha 'nome': nome definido, endereço ou intervalo (somado, como o SUM: texto e vazio contam zero).
  Nome inexistente LANÇA — é defeito do autor do card, e o teste tem de ver.
*/
export function lerNumero(r: Resultado, ref: string): number {
  if (!ref.includes('!')) return comoNumero(r.v(ref));
  if (!ref.includes(':')) return comoNumero(r.cel(ref));
  let s = 0;
  for (const c of celulasDoIntervalo(ref)) {
    const v = r.cel(c);
    if (typeof v === 'number') s += v;
  }
  return s;
}

// ───────────────────────────── avaliação ─────────────────────────────

export function avaliar(e: Expr, r: Resultado): number {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'nome':
      return lerNumero(r, e.nome) * (e.fator ?? 1);
    case 'neg':
      return -avaliar(e.a, r);
    case 'par':
      return e.arred ? arredonda(avaliar(e.a, r), e.arred) : avaliar(e.a, r);
    case 'op': {
      const a = avaliar(e.a, r);
      const b = avaliar(e.b, r);
      switch (e.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
      }
      break;
    }
    case 'fn': {
      const v = e.args.map((x) => avaliar(x, r));
      switch (e.fn) {
        case 'sqrt': return Math.sqrt(v[0]);
        case 'cbrt': return Math.cbrt(v[0]);
        case 'min': return Math.min(...v);
        case 'max': return Math.max(...v);
        case 'abs': return Math.abs(v[0]);
        case 'tan': return Math.tan(v[0]);
        case 'cos': return Math.cos(v[0]);
        case 'sin': return Math.sin(v[0]);
        case 'rad': return (v[0] * Math.PI) / 180;
      }
    }
  }
  throw new Error('expressão desconhecida');
}

// ───────────────────────────── desenho ─────────────────────────────

/*
  Precedência de quem está DENTRO, para decidir parênteses. A fração (\dfrac) agrupa sozinha como operando de soma e
  produto, mas não como base de potência — por isso tem degrau próprio.
*/
const SOMA = 1, PROD = 2, NEG = 3, FRAC = 4, ATOMO = 5;

interface Pedaco { s: string; p: number }

interface Contexto {
  r?: Resultado;          // presente = desenho com números
  grau: boolean;          // dentro de rad(), parcela de soma: a constante leva "°"
}

const embrulha = (x: Pedaco): string => `\\left(${x.s}\\right)`;
const comecaNegativo = (x: Pedaco) => x.s.startsWith('-');

function folha(e: Extract<Expr, { k: 'nome' }>, c: Contexto): Pedaco {
  if (!c.r) return { s: e.tex, p: ATOMO };
  const v = lerNumero(c.r, e.nome) * (e.fator ?? 1);
  const grau = e.unidade === '°' ? '^{\\circ}' : '';
  const s = nt(v, e.casas) + grau;
  return { s, p: s.startsWith('-') ? NEG : ATOMO };
}

function desenha(e: Expr, c: Contexto): Pedaco {
  switch (e.k) {
    case 'num': {
      if (e.tex) return { s: e.tex, p: ATOMO };
      const s = nt(e.v, e.casas) + (c.grau ? '^{\\circ}' : '');
      return { s, p: s.startsWith('-') ? NEG : ATOMO };
    }
    case 'nome':
      return folha(e, c);
    case 'par': {
      const a = desenha(e.a, { ...c });
      if (e.arred === 'cima') return { s: `\\left\\lceil ${a.s} \\right\\rceil`, p: ATOMO };
      if (e.arred) return { s: `\\left\\lfloor ${a.s} \\right\\rfloor`, p: ATOMO };
      return { s: `\\left(${a.s}\\right)`, p: ATOMO };
    }
    case 'neg': {
      const a = desenha(e.a, { ...c, grau: false });
      const s = a.p <= SOMA || comecaNegativo(a) ? embrulha(a) : a.s;
      return { s: `-${s}`, p: NEG };
    }
    case 'op':
      return desenhaOp(e, c);
    case 'fn':
      return desenhaFn(e, c);
  }
}

function desenhaOp(e: Extract<Expr, { k: 'op' }>, c: Contexto): Pedaco {
  const somaOuSub = e.op === '+' || e.op === '-';
  // a marca de grau só faz sentido em parcela de soma (45° − φ'/2): no divisor "2" ela mentiria
  const cf: Contexto = { ...c, grau: somaOuSub ? c.grau : false };
  const a = desenha(e.a, cf);
  const b = desenha(e.b, cf);
  switch (e.op) {
    case '+':
    case '-': {
      // à direita do sinal: negativo sempre entre parênteses; e "a − (b + c)" precisa deles
      const precisa = comecaNegativo(b) || (e.op === '-' && b.p <= SOMA);
      return { s: `${a.s} ${e.op} ${precisa ? embrulha(b) : b.s}`, p: SOMA };
    }
    case '*': {
      const sa = a.p < PROD ? embrulha(a) : a.s;
      const sb = b.p < PROD || comecaNegativo(b) ? embrulha(b) : b.s;
      // no simbólico o produto é justaposição (K_a\,q); entre dois números o "·" é obrigatório (0,5 · 100)
      // diante de parêntese, nada: "K_a(q + γh)" (o \, somado ao respiro do parêntese abria um buraco)
      const sep = c.r ? ' \\times ' : /^[0-9]/.test(sb) ? ' \\cdot ' : sb.startsWith('\\left(') ? '' : '\\,';
      return { s: `${sa}${sep}${sb}`, p: PROD };
    }
    case '/':
      return { s: `\\dfrac{${a.s}}{${b.s}}`, p: FRAC };
    case '^': {
      const ba = desenha(e.a, { ...c, grau: false });
      const ex = desenha(e.b, { ...c, grau: false });
      // potência de função trigonométrica: tg²(x), como se escreve à mão
      if (e.a.k === 'fn' && (e.a.fn === 'tan' || e.a.fn === 'sin' || e.a.fn === 'cos')) {
        const arg = desenha(e.a.args[0], { ...c, grau: false });
        return { s: `${NOME_FN[e.a.fn]}^{${ex.s}}${argumento(arg)}`, p: ATOMO };
      }
      let sb: string;
      if (ba.p < ATOMO || comecaNegativo(ba)) sb = embrulha(ba);
      else if (ba.s.includes("'")) sb = `{${ba.s}}`; // σ' já é um expoente: "σ'^2" é erro de TeX
      else sb = ba.s;
      return { s: `${sb}^{${ex.s}}`, p: ATOMO };
    }
  }
}

const NOME_FN = { tan: '\\operatorname{tg}', sin: '\\operatorname{sen}', cos: '\\cos' } as const;

const argumento = (a: Pedaco) => (a.s.startsWith('\\left(') && a.p === ATOMO ? a.s : `\\left(${a.s}\\right)`);

function desenhaFn(e: Extract<Expr, { k: 'fn' }>, c: Contexto): Pedaco {
  if (e.fn === 'rad') return desenha(e.args[0], { ...c, grau: true });
  const cs: Contexto = { ...c, grau: false };
  const args = e.args.map((x) => desenha(x, cs));
  switch (e.fn) {
    case 'sqrt':
      return { s: `\\sqrt{${args[0].s}}`, p: ATOMO };
    case 'cbrt':
      return { s: `\\sqrt[3]{${args[0].s}}`, p: ATOMO };
    case 'abs':
      return { s: `\\left|${args[0].s}\\right|`, p: ATOMO };
    case 'min':
    case 'max':
      // "\," + ";" + "\,": o Word lê o ";" como texto e não reordena os argumentos (medido no Pró-Viga)
      return { s: `\\${e.fn}\\left(${args.map((a) => a.s).join('\\,;\\,')}\\right)`, p: ATOMO };
    case 'tan':
    case 'sin':
    case 'cos':
      return { s: `${NOME_FN[e.fn]}${argumento(args[0])}`, p: ATOMO };
  }
}

/** TeX com os símbolos: K_a\,(q + \gamma\,h). */
export function texSimbolico(e: Expr): string {
  return desenha(e, { grau: false }).s;
}

/** TeX com os números da planilha: 0{,}400 \times (2{,}0 + 19{,}0 \times 1{,}60). */
export function texNumerico(e: Expr, r: Resultado): string {
  return desenha(e, { r, grau: false }).s;
}

/** Os símbolos que a expressão desenha (para o glossário e para o teste do dicionário). */
export function simbolosDe(e: Expr, out: string[] = []): string[] {
  switch (e.k) {
    case 'nome': out.push(e.tex); break;
    case 'op': simbolosDe(e.a, out); simbolosDe(e.b, out); break;
    case 'neg': case 'par': simbolosDe(e.a, out); break;
    case 'fn': e.args.forEach((x) => simbolosDe(x, out)); break;
  }
  return out;
}

/** As folhas 'nome' (para o teste: o mesmo nome definido desenha sempre o mesmo símbolo). */
export function folhasDe(e: Expr, out: Extract<Expr, { k: 'nome' }>[] = []): Extract<Expr, { k: 'nome' }>[] {
  switch (e.k) {
    case 'nome': out.push(e); break;
    case 'op': folhasDe(e.a, out); folhasDe(e.b, out); break;
    case 'neg': case 'par': folhasDe(e.a, out); break;
    case 'fn': e.args.forEach((x) => folhasDe(x, out)); break;
  }
  return out;
}

/** Unidade em TeX, reexportada para quem monta a linha. */
export { texUnidade };
