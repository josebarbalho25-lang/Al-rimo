/*
  FUNÇÕES — uma por função do Excel que a planilha usa, com o comportamento do Excel pt-BR (sondado).

  Nome em inglês porque é assim que o .xlsx guarda (o Excel traduz só na tela: IF = SE, IFERROR = SEERRO,
  FIXED = DEF.NÚM.DEC, MATCH = CORRESP, SUMPRODUCT = SOMARPRODUTO, CEILING = TETO, ROUNDUP =
  ARREDONDAR.PARA.CIMA, CHOOSE = ESCOLHER, VLOOKUP = PROCV, LEFT = ESQUERDA, MID = EXT.TEXTO, TEXT = TEXTO,
  SIN = SEN, SINH = SENH; COS, COSH e TANH têm o mesmo nome).

  Os argumentos chegam sem avaliar: SE, SEERRO e ESCOLHER só calculam o ramo que vale — como o Excel, e é
  isso que impede um ramo não usado (com divisão por zero, por exemplo) de "contaminar" o resultado.
*/
import {
  aLogico,
  aNumero,
  aTexto,
  comoMatriz,
  comparar,
  difundir,
  ehErro,
  ehMat,
  ehRef,
  ERRO,
  escalar,
  FALSO,
  igualExato,
  lerMatriz,
  operando,
  VERDADEIRO,
  type Escalar,
  type FuncaoExcel,
  type Intervalo,
  type Leitor,
  type Matriz,
  type Thunk,
  type V,
} from './avaliador';
import { arredondarParaBaixo, arredondarParaCima, fixo, numeroDeTexto, r15, texto } from './numeros';
import { div80, mult80, raiz80, soma80, tan80 } from './x87';

type Args = readonly (Thunk | null)[];

const arg = (a: Args, i: number, L: Leitor): V => {
  const t = a[i];
  return t ? t(L) : null;
};

/** Função de valores escalares, que vira elemento a elemento quando recebe matriz (dentro de SOMARPRODUTO). */
function porElemento(f: (...e: Escalar[]) => Escalar): FuncaoExcel {
  return (a, L, local) => {
    const vals = a.map((t) => operando(t ? t(L) : null, local, L));
    return difundir(vals, f);
  };
}

/** Atalho: f(número) com coerção do Excel e propagação de erro. */
const numerica =
  (f: (x: number) => Escalar) =>
  (e: Escalar): Escalar => {
    const n = aNumero(e);
    return typeof n === 'number' ? f(n) : n;
  };

/** Argumento opcional: ausente → padrão; omitido entre vírgulas (",,") → o Excel trata como 0/FALSO/"". */
const opcional = (e: Escalar | undefined, padrao: Escalar): Escalar => (e === undefined ? padrao : e);

// ───────────────────────────── agregadores ─────────────────────────────

/**
 * Números para MÁXIMO/MÍNIMO/SOMA. Regra do Excel (sondada): dentro de referência ou matriz só número conta
 * (texto, lógico e vazio são ignorados); digitado direto, lógico vale 1/0 e texto numérico é convertido
 * ("3" conta, "x" dá #VALOR!). Erro em qualquer lugar propaga.
 */
function numerosDe(a: Args, L: Leitor, cada: (n: number) => void): Escalar | undefined {
  for (const t of a) {
    const v = t ? t(L) : null;
    if (ehRef(v) || ehMat(v)) {
      const m = ehRef(v) ? lerMatriz(v, L) : v;
      for (const e of m.v) {
        if (typeof e === 'number') cada(e);
        else if (ehErro(e)) return e;
      }
      continue;
    }
    if (v === null) continue;
    if (ehErro(v)) return v;
    if (typeof v === 'number') cada(v);
    else if (typeof v === 'boolean') cada(v ? 1 : 0);
    else {
      const n = numeroDeTexto(v);
      if (n === null) return ERRO.VALOR;
      cada(n);
    }
  }
  return undefined;
}

const MAX: FuncaoExcel = (a, L) => {
  let m = -Infinity;
  const e = numerosDe(a, L, (n) => {
    if (n > m) m = n;
  });
  if (e !== undefined) return e;
  return m === -Infinity ? 0 : m;
};

const MIN: FuncaoExcel = (a, L) => {
  let m = Infinity;
  const e = numerosDe(a, L, (n) => {
    if (n < m) m = n;
  });
  if (e !== undefined) return e;
  return m === Infinity ? 0 : m;
};

const SUM: FuncaoExcel = (a, L) => {
  let s = 0;
  const e = numerosDe(a, L, (n) => {
    s = soma80(s, n); // parcela a parcela, na ordem, com o arredondamento do Excel (Fundação!B62 dependia disso)
  });
  return e !== undefined ? e : s;
};

/**
 * E / OU. Sondado: texto é ignorado (E(VERDADEIRO;"") = VERDADEIRO) mas, se nada lógico sobrar, #VALOR!
 * (E(célula vazia) = #VALOR!). Número conta como lógico (≠ 0). Erro propaga mesmo com FALSO ao lado.
 */
function logicos(e: boolean): FuncaoExcel {
  return (a, L) => {
    let algum = false;
    let acc = e;
    const usa = (b: boolean) => {
      algum = true;
      acc = e ? acc && b : acc || b;
    };
    for (const t of a) {
      const v = t ? t(L) : null;
      if (ehRef(v) || ehMat(v)) {
        const m = ehRef(v) ? lerMatriz(v, L) : v;
        for (const x of m.v) {
          if (typeof x === 'boolean') usa(x);
          else if (typeof x === 'number') usa(x !== 0);
          else if (ehErro(x)) return x;
        }
        continue;
      }
      if (ehErro(v)) return v;
      if (typeof v === 'boolean') usa(v);
      else if (typeof v === 'number') usa(v !== 0);
      else if (typeof v === 'string') {
        const u = v.toUpperCase();
        if (u === VERDADEIRO) usa(true);
        else if (u === FALSO) usa(false);
      }
    }
    return algum ? acc : ERRO.VALOR;
  };
}

// ───────────────────────────── condicionais ─────────────────────────────

/** SE: devolve o ramo cru (pode ser referência — ÍNDICE(SE(...);i) funciona como no Excel). */
const IF: FuncaoExcel = (a, L, local) => {
  const c = operando(arg(a, 0, L), local, L);
  if (ehMat(c)) {
    // Dentro de SOMARPRODUTO: SE elemento a elemento.
    const sim = a.length > 1 ? operando(arg(a, 1, L), local, L) : true;
    const nao = a.length > 2 ? operando(arg(a, 2, L), local, L) : false;
    return difundir([c, sim, nao], (cc, s, n) => {
      const b = aLogico(cc);
      if (typeof b !== 'boolean') return b;
      return b ? (s === null ? 0 : s) : n === null ? 0 : n;
    });
  }
  const b = aLogico(c);
  if (typeof b !== 'boolean') return b;
  if (b) {
    if (a.length < 2) return true;
    return a[1] ? a[1](L) : 0; // SE(c;;x) com c verdadeiro dá 0
  }
  if (a.length < 3) return false; // SE com 2 argumentos e condição falsa dá FALSO (sondado)
  return a[2] ? a[2](L) : 0;
};

const IFERROR: FuncaoExcel = (a, L, local) => {
  const x = operando(arg(a, 0, L), local, L);
  if (ehMat(x)) {
    if (!x.v.some(ehErro)) return x;
    const alt = operando(arg(a, 1, L), local, L);
    return difundir([x, alt], (e, s) => (ehErro(e) ? (s === null ? 0 : s) : e));
  }
  if (ehErro(x)) return a[1] ? a[1](L) : 0;
  return x;
};

const CHOOSE: FuncaoExcel = (a, L, local) => {
  const i0 = aNumero(escalar(arg(a, 0, L), local, L));
  if (typeof i0 !== 'number') return i0;
  const i = Math.trunc(i0);
  if (i < 1 || i >= a.length) return ERRO.VALOR;
  const t = a[i];
  return t ? t(L) : 0;
};

// ───────────────────────────── busca ─────────────────────────────

const curingas = new Map<string, RegExp | null>();
/** CORRESP/PROCV exatos aceitam curinga em texto: * ? e ~ para escapar (CORRESP("C*";...) acha "C25"). */
function curinga(alvo: Escalar): RegExp | null {
  if (typeof alvo !== 'string' || !/[*?~]/.test(alvo)) return null;
  let re = curingas.get(alvo);
  if (re !== undefined) return re;
  let s = '';
  for (let i = 0; i < alvo.length; i++) {
    const ch = alvo[i];
    if (ch === '~' && i + 1 < alvo.length) s += alvo[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (ch === '*') s += '[\\s\\S]*';
    else if (ch === '?') s += '[\\s\\S]';
    else s += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  re = new RegExp(`^${s}$`, 'i');
  curingas.set(alvo, re);
  return re;
}

const mesmoTipo = (a: Escalar, b: Escalar) => typeof a === typeof b && !ehErro(b) && b !== null;

/** Compara para as buscas aproximadas: double EXATO (sem os 15 dígitos), texto sem caixa. */
function cmpBusca(alvo: Escalar, x: Escalar): number {
  if (typeof alvo === 'number') return (x as number) < alvo ? -1 : (x as number) > alvo ? 1 : 0;
  if (typeof alvo === 'string') return comparar(x, alvo);
  return x === alvo ? 0 : x ? 1 : -1;
}

/**
 * CORRESP tipo 1 (e PROCV aproximado): o Excel faz BUSCA BINÁRIA, supondo a lista crescente. Sondado:
 * CORRESP(2;{1;2;3;2;5};1) = 2 e CORRESP(3;{5;4;3;2;1};1) = 3 (uma varredura daria 4 e 5). Achando o valor
 * exato, anda para frente sobre os iguais (CORRESP(2;{1;2;2;2;3};1) = 4). Elemento de outro tipo no meio é
 * pulado para o próximo do mesmo tipo. Em lista crescente — o caso da planilha — dá o "maior ≤ procurado".
 */
function buscaBinaria(alvo: Escalar, itens: readonly Escalar[]): number {
  let lo = 0;
  let hi = itens.length - 1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    let j = meio;
    while (j <= hi && !mesmoTipo(alvo, itens[j])) j++;
    if (j > hi) {
      hi = meio - 1;
      continue;
    }
    const c = cmpBusca(alvo, itens[j]);
    if (c === 0) {
      while (j + 1 < itens.length && mesmoTipo(alvo, itens[j + 1]) && cmpBusca(alvo, itens[j + 1]) === 0) j++;
      return j;
    }
    if (c < 0) lo = j + 1;
    else hi = meio - 1;
  }
  return hi; // −1 = não achou
}

/** CORRESP tipo −1 (lista decrescente): varredura até o primeiro menor que o procurado (sondado). */
function buscaDecrescente(alvo: Escalar, itens: readonly Escalar[]): number {
  let ultimo = -1;
  for (let i = 0; i < itens.length; i++) {
    const x = itens[i];
    if (!mesmoTipo(alvo, x)) continue;
    const c = cmpBusca(alvo, x);
    if (c === 0) return i;
    if (c < 0) return ultimo;
    ultimo = i;
  }
  return ultimo;
}

function vetor(v: V, L: Leitor): Matriz | null {
  const m = comoMatriz(v, L);
  return m.nl === 1 || m.nc === 1 ? m : null;
}

/**
 * Procurado VAZIO (célula em branco) vale o número 0 em CORRESP e PROCV — sondado: CORRESP(vazio;{0;5;9};0) = 1,
 * CORRESP(vazio;{1;5;9};1) = #N/D, PROCV(vazio;{0;1|5;2};2;FALSO) = 1. Antes o motor devolvia #N/D direto, e com o
 * NSPT em branco as sugestões do solo (Solo e Empuxo!B5:B7, tabela começando em NSPT ≥ 0) viravam erro onde o
 * Excel mostra a 1ª linha.
 */
const procurado = (v: Escalar): Escalar => (v === null ? 0 : v);

const MATCH: FuncaoExcel = (a, L, local) => {
  const alvo = procurado(escalar(arg(a, 0, L), local, L));
  if (ehErro(alvo)) return alvo;
  const m = vetor(arg(a, 1, L), L);
  if (!m) return ERRO.ND;
  let tipo = 1;
  if (a.length > 2) {
    const t = aNumero(escalar(arg(a, 2, L), local, L));
    if (typeof t !== 'number') return t;
    tipo = t > 0 ? 1 : t < 0 ? -1 : 0;
  }
  let i: number;
  if (tipo === 0) {
    const re = curinga(alvo);
    i = m.v.findIndex((x) => igualExato(alvo, x, re));
  } else if (tipo === 1) i = buscaBinaria(alvo, m.v);
  else i = buscaDecrescente(alvo, m.v);
  return i < 0 ? ERRO.ND : i + 1;
};

const VLOOKUP: FuncaoExcel = (a, L, local) => {
  const alvo = procurado(escalar(arg(a, 0, L), local, L));
  if (ehErro(alvo)) return alvo;
  const fonte = arg(a, 1, L);
  const m = comoMatriz(fonte, L);
  const c0 = aNumero(escalar(arg(a, 2, L), local, L));
  if (typeof c0 !== 'number') return c0;
  // Coluna vista com 15 dígitos, como o ÍNDICE: numa tabela de 1 linha e 4 colunas, a coluna 4−2⁻⁵⁰ devolve a
  // 4ª no Excel (sondado); cortar o número cru daria a 3ª.
  const col = Math.trunc(r15(c0));
  if (col < 1) return ERRO.VALOR;
  if (col > m.nc) return ERRO.REF;
  let aprox = true;
  if (a.length > 3) {
    const b = aLogico(opcional(escalar(arg(a, 3, L), local, L), false));
    if (typeof b !== 'boolean') return b;
    aprox = b;
  }
  const primeira: Escalar[] = [];
  for (let i = 0; i < m.nl; i++) primeira.push(m.v[i * m.nc]);
  let lin: number;
  if (aprox) lin = buscaBinaria(alvo, primeira);
  else {
    const re = curinga(alvo);
    lin = primeira.findIndex((x) => igualExato(alvo, x, re));
  }
  if (lin < 0) return ERRO.ND;
  const v = m.v[lin * m.nc + col - 1];
  return v === null ? 0 : v;
};

/**
 * ÍNDICE: com referência devolve REFERÊNCIA (1×1), como o Excel. Lista de uma linha só aceita o índice
 * único como coluna (ÍNDICE({6,3;8;10};2) = 8). Linha/coluna 0 = a coluna/linha inteira.
 */
const INDEX: FuncaoExcel = (a, L, local) => {
  const fonte = arg(a, 0, L);
  if (ehErro(fonte)) return fonte;
  let nl: number;
  let nc: number;
  if (ehRef(fonte)) {
    nl = fonte.r2 - fonte.r1 + 1;
    nc = fonte.c2 - fonte.c1 + 1;
  } else if (ehMat(fonte)) {
    nl = fonte.nl;
    nc = fonte.nc;
  } else {
    nl = 1;
    nc = 1;
  }
  const n = (i: number): number | Escalar => {
    if (a.length <= i || !a[i]) return 0;
    const x = aNumero(escalar(a[i]!(L), local, L));
    // O índice é visto com 15 dígitos antes de cortar: ÍNDICE({10;20;30};3−2⁻⁵¹) dá 30 no Excel (sondado).
    return typeof x === 'number' ? Math.trunc(r15(x)) : x;
  };
  let r = n(1);
  if (typeof r !== 'number') return r;
  const temCol = a.length > 2 && a[2] !== null;
  let c: number | Escalar = temCol ? n(2) : 0;
  if (typeof c !== 'number') return c;
  if (!temCol) {
    if (nl === 1) {
      c = r;
      r = 1;
    } else if (nc === 1) c = 1;
  }
  if (r < 0 || c < 0) return ERRO.VALOR;
  if (r > nl || c > nc) return ERRO.REF;
  if (ehRef(fonte)) {
    const r1 = r === 0 ? fonte.r1 : fonte.r1 + r - 1;
    const r2 = r === 0 ? fonte.r2 : r1;
    const c1 = c === 0 ? fonte.c1 : fonte.c1 + c - 1;
    const c2 = c === 0 ? fonte.c2 : c1;
    const sub: Intervalo = { k: 'ref', aba: fonte.aba, r1, c1, r2, c2 };
    return sub;
  }
  if (ehMat(fonte)) {
    if (r > 0 && c > 0) return fonte.v[(r - 1) * nc + c - 1];
    const v: Escalar[] = [];
    for (let i = 0; i < nl; i++)
      for (let j = 0; j < nc; j++) if ((r === 0 || i === r - 1) && (c === 0 || j === c - 1)) v.push(fonte.v[i * nc + j]);
    return { k: 'mat', nl: r === 0 ? nl : 1, nc: c === 0 ? nc : 1, v };
  }
  return fonte;
};

// ───────────────────────────── SOMARPRODUTO ─────────────────────────────

/**
 * Argumentos compilados em modo matriz (ver Ambiente.matricial). Só NÚMERO entra na soma: lógico conta 0
 * (SOMARPRODUTO({1;2;3}<2,5) = 0 — por isso a planilha multiplica por 1), texto conta 0. Tamanhos diferentes
 * dão #VALOR!.
 */
const SUMPRODUCT: FuncaoExcel = (a, L) => {
  const ms: Matriz[] = [];
  for (const t of a) {
    const v = t ? t(L) : null;
    // Referência a UMA célula vazia dá #VALOR! (sondado: SOMARPRODUTO(Z1), SOMARPRODUTO(SE(VERDADEIRO;Z1)) e
    // SOMARPRODUTO(Z1;Z2) com Z1 vazia), embora vazio dentro de intervalo maior conte 0 e uma célula com texto
    // também conte 0. A planilha só passa contas sobre intervalos de várias células; a regra fica para não
    // surpreender quando o gerador mudar.
    if (ehRef(v) && v.r1 === v.r2 && v.c1 === v.c2 && L.celula(v.aba, v.r1, v.c1) === null) return ERRO.VALOR;
    ms.push(comoMatriz(v, L));
  }
  if (ms.length === 0) return ERRO.VALOR;
  const { nl, nc } = ms[0];
  if (ms.some((m) => m.nl !== nl || m.nc !== nc)) return ERRO.VALOR;
  let s = 0;
  for (let i = 0; i < nl * nc; i++) {
    let p = 1;
    for (const m of ms) {
      const e = m.v[i];
      if (ehErro(e)) return e;
      p = mult80(p, typeof e === 'number' ? e : 0);
    }
    s = soma80(s, p);
  }
  return s;
};

// ───────────────────────────── texto ─────────────────────────────

const LEFT = porElemento((t, n) => {
  const s = aTexto(t);
  if (typeof s !== 'string') return s;
  const k = aNumero(opcional(n, 1));
  if (typeof k !== 'number') return k;
  if (k < 0) return ERRO.VALOR;
  // Nº de caracteres visto com 15 dígitos: ESQUERDA("abcdef";3−2⁻⁵¹) dá "abc" (sondado). O EXT.TEXTO, ao
  // contrário, corta o número cru (EXT.TEXTO("abcdef";2;3−2⁻⁵¹) dá "bc") — o Excel não é coerente aqui.
  return s.slice(0, Math.trunc(r15(k)));
});

const MID = porElemento((t, ini, n) => {
  const s = aTexto(t);
  if (typeof s !== 'string') return s;
  const i = aNumero(opcional(ini, null));
  if (typeof i !== 'number') return i;
  const k = aNumero(opcional(n, null));
  if (typeof k !== 'number') return k;
  if (i < 1 || k < 0) return ERRO.VALOR;
  const p = Math.trunc(i) - 1;
  return s.slice(p, p + Math.trunc(k));
});

/** VALOR("2,5") = 2,5 no pt-BR; VALOR("2.5") = #VALOR! (sondado). */
const VALUE = porElemento((t) => {
  if (typeof t === 'number') return t;
  if (t === null) return 0;
  if (typeof t === 'string') {
    const n = numeroDeTexto(t);
    return n === null ? ERRO.VALOR : n;
  }
  if (typeof t === 'boolean') return ERRO.VALOR;
  return t;
});

const FIXED = porElemento((x, d, sem) => {
  const n = aNumero(x);
  if (typeof n !== 'number') return n;
  const c = aNumero(opcional(d, 2));
  if (typeof c !== 'number') return c;
  if (c > 127) return ERRO.VALOR;
  const s = aLogico(opcional(sem, false));
  if (typeof s !== 'boolean') return s;
  // Casas vistas com 15 dígitos: DEF.NÚM.DEC(1,25;2−2⁻⁵²) dá "1,25" (sondado); cortar o cru daria 1 casa.
  return fixo(n, Math.trunc(r15(c)), s);
});

/** TEXTO: lógico sai como "VERDADEIRO"; texto não numérico volta igual (TEXTO("abc";"0%") = "abc"). */
const TEXT = porElemento((x, f) => {
  if (ehErro(x)) return x;
  const fmt = aTexto(opcional(f, ''));
  if (typeof fmt !== 'string') return fmt;
  if (typeof x === 'boolean') return x ? VERDADEIRO : FALSO;
  let n: number;
  if (typeof x === 'string') {
    const k = numeroDeTexto(x);
    if (k === null) return x;
    n = k;
  } else n = x === null ? 0 : x;
  // Formato vazio (célula em branco no lugar do formato): o Excel mostra só o sinal — "" ou "-" (sondado).
  if (fmt === '') return n < 0 ? '-' : '';
  const s = texto(n, fmt);
  return s === null ? ERRO.VALOR : s;
});

// ───────────────────────────── números ─────────────────────────────

const ISNUMBER = porElemento((e) => typeof e === 'number');

const ABS = porElemento(numerica((x) => Math.abs(x)));
const SQRT = porElemento(numerica((x) => (x < 0 ? ERRO.NUM : raiz80(x))));
// TAN corretamente arredondada (x87.tan80): o Math.tan erra o último bit em ~3% dos ângulos. A partir de 2^27 rad
// o Excel recusa (sondado: TAN(134217727) responde, TAN(134217728) dá #NÚM!).
const TAN = porElemento(numerica((x) => (Math.abs(x) >= 134217728 ? ERRO.NUM : tan80(x))));
// x·(π/180), nesta ordem: é o que o Excel faz (sondado, 410/410 no último bit); x·π/180 bate só 282/410.
const RADIANS = porElemento(numerica((x) => mult80(x, Math.PI / 180)));
const PI: FuncaoExcel = () => Math.PI;
// COS, SIN, COSH, SINH, TANH: só a aba Sapata sobre molas (funções de Krylov da viga sobre base elástica e a torção
// entre contrafortes). Math.* sem sonda de último bit (o TAN tem): os argumentos lá são pequenos (λ·x < 10) e o golden
// mede a diferença. Limites do Excel: SEN/COS recusam |x| ≥ 2^27 como a TAN; COSH/SENH estouram perto de 710.
const COS = porElemento(numerica((x) => (Math.abs(x) >= 134217728 ? ERRO.NUM : Math.cos(x))));
const SIN = porElemento(numerica((x) => (Math.abs(x) >= 134217728 ? ERRO.NUM : Math.sin(x))));
const COSH = porElemento(numerica((x) => (Number.isFinite(Math.cosh(x)) ? Math.cosh(x) : ERRO.NUM)));
const SINH = porElemento(numerica((x) => (Number.isFinite(Math.sinh(x)) ? Math.sinh(x) : ERRO.NUM)));
const TANH = porElemento(numerica((x) => Math.tanh(x)));

/** INT olha o número com 15 dígitos: INT((0,7+0,1)*10) = 8 no Excel, embora o double seja 7,999999999999999. */
const INT = porElemento(numerica((x) => Math.floor(r15(x)) || 0));

function casas(d: Escalar): number | Escalar {
  const n = aNumero(d);
  return typeof n === 'number' ? Math.trunc(n) : n;
}

const ROUNDUP = porElemento((x, d) => {
  const n = aNumero(x);
  if (typeof n !== 'number') return n;
  const c = casas(opcional(d, null));
  if (typeof c !== 'number') return c;
  return arredondarParaCima(n, c);
});

const ROUNDDOWN = porElemento((x, d) => {
  const n = aNumero(x);
  if (typeof n !== 'number') return n;
  const c = casas(opcional(d, null));
  if (typeof c !== 'number') return c;
  return arredondarParaBaixo(n, c);
});

/**
 * TETO (CEILING) clássico. Sondado: TETO(x;0) = 0; TETO(−2,5;1) = −2 (sobe em direção ao zero);
 * TETO(−2,5;−1) = −3; TETO(2,5;−1) = #NÚM!. Também enxerga 15 dígitos (TETO(3+3·2⁻⁵⁰;1) = 3).
 */
const CEILING = porElemento((x, s) => {
  const n = aNumero(x);
  if (typeof n !== 'number') return n;
  if (s === undefined) return ERRO.ND;
  const m = aNumero(s);
  if (typeof m !== 'number') return m;
  if (m === 0 || n === 0) return 0;
  if (n > 0 && m < 0) return ERRO.NUM;
  return mult80(Math.ceil(r15(div80(r15(n), m))), m) || 0;
});

// ───────────────────────────── tabela ─────────────────────────────

export const FUNCOES: Record<string, FuncaoExcel> = {
  IF,
  IFERROR,
  CHOOSE,
  MAX,
  MIN,
  SUM,
  AND: logicos(true),
  OR: logicos(false),
  INDEX,
  MATCH,
  VLOOKUP,
  SUMPRODUCT,
  ISNUMBER,
  LEFT,
  MID,
  VALUE,
  FIXED,
  TEXT,
  ABS,
  SQRT,
  TAN,
  COS,
  SIN,
  COSH,
  SINH,
  TANH,
  RADIANS,
  PI,
  INT,
  ROUNDUP,
  ROUNDDOWN,
  CEILING,
};

/** Funções que avaliam os argumentos como matriz numa fórmula comum. */
export const MATRICIAIS = new Set(['SUMPRODUCT']);
