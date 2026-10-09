/*
  A CONTA DO EXCEL NO ÚLTIMO BIT.

  O Excel guarda número em double (53 bits de mantissa), como o JavaScript — mas CALCULA cada operação com 64
  bits de mantissa (o formato "estendido" de 80 bits dos processadores x86) e só depois arredonda para 53. São dois
  arredondamentos seguidos: quase sempre dá o mesmo que arredondar direto, mas quando o resultado exato cai a menos
  de 1/4096 de unidade do meio entre dois doubles, o primeiro arredondamento o leva exatamente para o meio e o
  segundo desempata para o par — e o Excel fica um bit ao lado do JavaScript.

  Provado no Excel desta máquina: em 191 casos escolhidos para cair nessa borda (+, −, ×, ÷ e RAIZ), o Excel deu o
  arredondamento duplo nos 191 (100 deles ficaram como sondas permanentes em excel/sondas.py, também via SOMA e
  SOMARPRODUTO). Entre uma operação e a seguinte o resultado volta a ser double (A·B − fl(A·B) dá 0 em 30 de 30),
  então a regra é por operação. Isso explicou células do gabarito um bit fora, como Fundação!B62 (SOMA de 20
  parcelas: só a última soma cai na borda) e o 18,2^4.

  A potência fracionária do Excel é exp(y·ln x), com ln corretamente arredondado e a EXP do x87 (passos de 64
  bits, ver exp80): 1.640 de 1.640 potências sondadas, contra 16 a 66% do Math.pow. TAN corretamente arredondada,
  mas reduzindo o ângulo pelo π de 64 bits do x87: 820 de 820 (o Math.tan erra 3%). Como o Math.log/exp/tan do
  JavaScript não são corretamente arredondados, aqui eles são refeitos em "double-double" (dois doubles somados,
  ~106 bits) e arredondados no fim como o Excel arredonda.

  Nada disto muda um resultado da planilha hoje (a diferença é de um bit, e a lente semântica mostrou em 11.000
  cenários que nenhuma comparação de 15 dígitos cai ali). Serve para o motor ser o Excel também no último dígito:
  com isto, das 78.499 células numéricas do gabarito só 4 não são idênticas (eram 453), todas da mesma potência
  fracionária de um sorteio — e o gabarito passa a enxergar qualquer diferença de verdade.

  Limite conhecido: a instrução F2XM1 (2^x − 1) do processador não é corretamente arredondada (erra até 1 bit dos
  64), e o modelo daqui supõe que é. Em ~1 de cada 1.700 potências o Excel cai do outro lado do meio e fica um bit
  ao lado do motor (sondas.py, CONHECIDAS; é o caso do sorteio16 Contrafortes!B236). Reproduzir exigiria o
  microcódigo do processador — e o resultado do Excel muda de máquina para máquina ali.
*/

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);
// Ordem dos bytes da máquina (todo navegador real é little-endian, mas não custa conferir uma vez).
const LE = (() => {
  F64[0] = 1;
  return U32[1] === 0x3ff00000;
})();
const IHI = LE ? 1 : 0;
const ILO = LE ? 0 : 1;

// 2^(e−1075): o último bit (ulp) de um double cujo expoente armazenado é e.
const ULP = new Float64Array(2048);
for (let e = 1; e < 2047; e++) ULP[e] = Math.pow(2, e - 1075);

/** 2^−54, um pouco abaixo: erro menor que |s|·isto nunca está perto do meio do último bit (atalho barato). */
const LONGE_DO_MEIO = 5.551115123125783e-17 * (1 - 1 / 1024);

/**
 * O double que o Excel guarda para um resultado exato s + e, onde s é o double mais próximo (o que o JavaScript
 * dá) e e o resto (exato, ou com erro relativo desprezível). Muda s em um bit só no caso do arredondamento duplo.
 */
export function arred80(s: number, e: number): number {
  if (e === 0 || e !== e) return s;
  const ae = Math.abs(e);
  if (ae < Math.abs(s) * LONGE_DO_MEIO || !Number.isFinite(s) || s === 0) return s;
  F64[0] = s;
  const hi = U32[IHI];
  const lo = U32[ILO];
  const exp = (hi >>> 20) & 0x7ff;
  if (exp === 0) return s; // subnormal: o avaliador zera depois (finito), como o Excel
  let passo = ULP[exp];
  // Indo para perto do zero a partir de uma potência de 2, o vizinho está na binade de baixo: passo pela metade.
  if ((e > 0) !== (s > 0) && (hi & 0xfffff) === 0 && lo === 0) passo /= 2;
  // Com 64 bits, o exato vira o MEIO entre s e o vizinho se estiver a até meio bit-de-64 (passo/4096) dele.
  if (passo / 2 - ae > passo / 4096) return s;
  // E o meio, arredondado a 53 bits, desempata para a mantissa par.
  if ((lo & 1) === 0) return s;
  return s + (e > 0 ? passo : -passo);
}

// ───────────────────── transformações exatas (Knuth, Dekker) ─────────────────────

const DIVISOR = 134217729; // 2^27 + 1: corta um double em duas metades de 26 bits (Veltkamp)
/** Acima disto a separação estoura; número assim não aparece na planilha, e ali fica o arredondamento simples. */
const GRANDE = 1e290;

let RESTO = 0; // resto da última transformação (evita criar objeto a cada operação: isto roda dezenas de milhares de vezes por conta)

function somaExata(a: number, b: number): number {
  const s = a + b;
  const bb = s - a;
  RESTO = a - (s - bb) + (b - bb);
  return s;
}

function produtoExato(a: number, b: number): number {
  const p = a * b;
  let c = DIVISOR * a;
  const ah = c - (c - a);
  const al = a - ah;
  c = DIVISOR * b;
  const bh = c - (c - b);
  const bl = b - bh;
  RESTO = ah * bh - p + ah * bl + al * bh + al * bl;
  return p;
}

const grande = (x: number) => !(Math.abs(x) < GRANDE);

// ───────────────────── as quatro operações e a raiz ─────────────────────

export function soma80(a: number, b: number): number {
  const s = somaExata(a, b);
  return Number.isFinite(s) ? arred80(s, RESTO) : s;
}

export function mult80(a: number, b: number): number {
  if (grande(a) || grande(b)) return a * b;
  const p = produtoExato(a, b);
  return p === 0 || !Number.isFinite(p) ? p : arred80(p, RESTO);
}

export function div80(a: number, b: number): number {
  const q = a / b;
  if (q === 0 || !Number.isFinite(q) || grande(q) || grande(b)) return q;
  // resto exato a − q·b (q·b fica a menos de um bit de a: a subtração não arredonda), dividido por b
  const p = produtoExato(q, b);
  const r = a - p - RESTO;
  return arred80(q, r / b);
}

export function raiz80(x: number): number {
  const s = Math.sqrt(x);
  if (s === 0 || !Number.isFinite(s) || grande(x)) return s;
  const p = produtoExato(s, s);
  const r = x - p - RESTO;
  return arred80(s, r / (2 * s));
}

// ───────────────────── double-double (para exp, ln e tan corretos) ─────────────────────

type DD = readonly [number, number];

function normal(hi: number, lo: number): DD {
  const s = hi + lo;
  return [s, lo - (s - hi)];
}

function ddSoma(a: DD, b: DD): DD {
  const s = somaExata(a[0], b[0]);
  let e = RESTO;
  const t = somaExata(a[1], b[1]);
  const f = RESTO;
  e += t;
  const x = normal(s, e);
  return normal(x[0], x[1] + f);
}

const ddNeg = (a: DD): DD => [-a[0], -a[1]];
const ddSub = (a: DD, b: DD): DD => ddSoma(a, ddNeg(b));

function ddMult(a: DD, b: DD): DD {
  const p = produtoExato(a[0], b[0]);
  return normal(p, RESTO + (a[0] * b[1] + a[1] * b[0]));
}

function ddMultD(a: DD, b: number): DD {
  const p = produtoExato(a[0], b);
  return normal(p, RESTO + a[1] * b);
}

function ddDivD(a: DD, b: number): DD {
  const q1 = a[0] / b;
  const p = produtoExato(q1, b);
  const r = a[0] - p - RESTO + a[1];
  return normal(q1, r / b);
}

function ddDiv(a: DD, b: DD): DD {
  const q1 = a[0] / b[0];
  let r = ddSub(a, ddMultD(b, q1));
  const q2 = r[0] / b[0];
  r = ddSub(r, ddMultD(b, q2));
  const q3 = r[0] / b[0];
  return ddSoma(normal(q1, q2), [q3, 0]);
}

const LN2: DD = [0.6931471805599453, 2.3190468138462996e-17];

/**
 * Arredonda um double-double a 64 bits de mantissa (empate para o par): o registrador de 80 bits do x87, por
 * onde passam os passos intermediários da EXP do Excel.
 */
function rn64(a: DD): DD {
  const h = a[0];
  const l = a[1];
  if (l === 0 || h === 0 || !Number.isFinite(h)) return a;
  F64[0] = h;
  const hi = U32[IHI];
  const ex = (hi >>> 20) & 0x7ff;
  let passo = ULP[ex] / 2048;
  if ((l > 0) !== (h > 0) && (hi & 0xfffff) === 0 && U32[ILO] === 0) passo /= 2;
  const z = l / passo; // exato: passo é potência de 2
  let k = Math.floor(z);
  const d = z - k;
  // h é múltiplo par do passo, então a paridade da mantissa de 64 bits é a de k
  if (d > 0.5 || (d === 0.5 && k % 2 !== 0)) k += 1;
  return normal(h, k * passo);
}

/** e^x − 1 com ~100 bits, para |x| até ~0,35: divide por 2^10, série de Taylor e eleva ao quadrado 10 vezes
 *  ((1+s)² − 1 = 2s + s², que não perde dígito quando s é pequeno). */
function expm1DD(x: DD): DD {
  const y: DD = [x[0] / 1024, x[1] / 1024];
  let termo: DD = y;
  let s: DD = y;
  for (let n = 2; n < 20; n++) {
    termo = ddDivD(ddMult(termo, y), n);
    s = ddSoma(s, termo);
    if (!(Math.abs(termo[0]) >= 1e-36 * Math.abs(s[0]))) break;
  }
  for (let i = 0; i < 10; i++) s = ddSoma(ddMultD(s, 2), ddMult(s, s));
  return s;
}

/** ×2^n em dois passos (n pode passar de 1023 com o resultado ainda representável). */
function escala(x: number, n: number): number {
  const n1 = Math.trunc(n / 2);
  return x * Math.pow(2, n1) * Math.pow(2, n - n1);
}

/** e^t com ~100 bits (para o passo de Newton do ln): tira k·ln2 e usa a série. */
function expDD(t: number): DD {
  if (t > 709.8) return [Infinity, 0];
  if (t < -745.2) return [0, 0];
  const k = Math.round(t / LN2[0]);
  const um = ddSoma([1, 0], expm1DD(ddSub([t, 0], ddMultD(LN2, k))));
  return [escala(um[0], k), escala(um[1], k)];
}

/** ln x com ~100 bits (x > 0): parte do Math.log e corrige com um passo de Newton em double-double. */
function lnDD(x: number): DD {
  const y0 = Math.log(x);
  if (!Number.isFinite(y0)) return [y0, 0];
  const e = expDD(y0);
  const d = ddSub([x, 0], e)[0] / e[0]; // ln(x/e^y0) ≈ x/e^y0 − 1 (o termo seguinte é ~10⁻³² de y0)
  const s = somaExata(y0, d);
  return normal(s, RESTO);
}

// log2(e) e π/2 como o x87 os carrega (FLDL2E, FLDPI): arredondados a 64 bits, aqui em dois doubles exatos.
const L2E_64: DD = [1.4426950408889634, 2.0383000842727483e-17];
const PI2_64: DD = [1.5707963267948966, 6.1257422745431e-17];

/** tan x com ~100 bits, reduzindo por π/2 de 64 bits (é o que o Excel faz: com π exato, TAN(1,5738) — logo depois
 *  de 90° — saía um bit ao lado; com o π do x87, 820 de 820 sondas batem). */
function tanDD(x: number): DD {
  const k = Math.round(x / PI2_64[0]);
  let r: DD = [x, 0];
  if (k !== 0) {
    r = ddSub(r, normal(produtoExato(k, PI2_64[0]), RESTO));
    r = ddSub(r, normal(produtoExato(k, PI2_64[1]), RESTO));
  }
  const r2 = ddMult(r, r);
  let termo: DD = r;
  let sen: DD = r;
  for (let n = 1; n < 40; n++) {
    termo = ddNeg(ddDivD(ddMult(termo, r2), 2 * n * (2 * n + 1)));
    sen = ddSoma(sen, termo);
    if (!(Math.abs(termo[0]) >= 1e-36 * Math.abs(sen[0]))) break;
  }
  termo = [1, 0];
  let cos: DD = [1, 0];
  for (let n = 1; n < 40; n++) {
    termo = ddNeg(ddDivD(ddMult(termo, r2), (2 * n - 1) * (2 * n)));
    cos = ddSoma(cos, termo);
    if (!(Math.abs(termo[0]) >= 1e-36 * Math.abs(cos[0]))) break;
  }
  return k % 2 === 0 ? ddDiv(sen, cos) : ddNeg(ddDiv(cos, sen));
}

/**
 * e^t como o x87 faz (é a EXP por trás da potência do Excel): u = t·log2(e) em 64 bits, n = inteiro mais próximo,
 * 2^(u−n) − 1 (F2XM1) em 64 bits, +1 em 64 bits, ×2^n e grava em double. Bate 1.640 de 1.640 potências
 * fracionárias da lente semântica e 60 de 60 escolhidas para separar os modelos (a exp corretamente arredondada
 * acerta 16 dessas 60). Ver no cabeçalho o limite do F2XM1.
 */
export function exp80(t: number): number {
  if (t !== t) return t;
  if (t > 709.8) return Infinity;
  if (t < -745.2) return 0;
  const p = produtoExato(t, L2E_64[0]);
  const pe = RESTO;
  const q = produtoExato(t, L2E_64[1]);
  const u = rn64(ddSoma(normal(p, pe), normal(q, RESTO)));
  let n = Math.round(u[0]);
  let f = ddSub(u, [n, 0]);
  // FRNDINT: mais próximo, empate para o par (Math.round desempata para cima)
  if (f[0] > 0.5 || (f[0] === 0.5 && f[1] > 0)) {
    n += 1;
    f = ddSub(f, [1, 0]);
  } else if (f[0] < -0.5 || (f[0] === -0.5 && f[1] < 0)) {
    n -= 1;
    f = ddSoma(f, [1, 0]);
  } else if (Math.abs(f[0]) === 0.5 && f[1] === 0 && n % 2 !== 0) {
    const s = Math.sign(f[0]);
    n += s;
    f = ddSub(f, [s, 0]);
  }
  const g = rn64(expm1DD(ddMult(f, LN2)));
  const um = rn64(ddSoma([1, 0], g));
  // um[0] já é o double mais próximo do valor de 64 bits (empate para o par): é a gravação em double
  return escala(um[0], n);
}

export function ln80(x: number): number {
  const l = lnDD(x);
  return arred80(l[0], l[1]);
}

/** tan x para |x| < 2^27 (acima disso o Excel dá #NÚM!, e quem chama confere antes). */
export function tan80(x: number): number {
  if (!(Math.abs(x) < 134217728)) return NaN;
  const t = tanDD(x);
  return arred80(t[0], t[1]);
}

/** x^y com y fracionário e x > 0, como o Excel: exp(y · ln x), cada passo arredondado como ele arredonda. */
export function potencia80(x: number, y: number): number {
  return exp80(mult80(y, ln80(x)));
}
