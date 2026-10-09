/*
  NÚMEROS — como o Excel pt-BR enxerga um número quando ele vira texto, quando compara e quando arredonda.

  O Excel guarda e calcula em ponto flutuante de 64 bits (o mesmo double do JavaScript), mas em vários lugares
  ele primeiro "enxerga" o número com 15 algarismos significativos. Tudo aqui foi conferido no Excel desta
  máquina por sonda (excel/sondas.gerado.json), não de memória:

  - comparar (=, <, >=...): 0,1+0,2 = 0,3 dá VERDADEIRO. A regra que bate com todas as sondas é arredondar os
    dois lados a 15 significativos e só então comparar (1 − 5·2⁻⁵³ = 1 dá FALSO, 1 + 12·2⁻⁵² = 1 dá VERDADEIRO —
    uma tolerância relativa fixa não explica essa assimetria; os 15 dígitos explicam).
  - INT, ARREDONDAR.PARA.CIMA/BAIXO, TETO: INT((0,7+0,1)*10) dá 8, não 7 — o 7,999999999999999 é visto como 8.
  - DEF.NÚM.DEC (FIXED), TEXTO e número concatenado (&): 15 significativos, meio arredonda para longe do zero
    (DEF.NÚM.DEC(2,675;2) = "2,68", embora o double de 2,675 seja 2,67499999...).
  - PROCV/CORRESP (VLOOKUP/MATCH) NÃO usam os 15 dígitos: comparam o double exato (CORRESP(0,1+0,2;{…0,3};0) = #N/D).
*/

/** Arredonda a 15 algarismos significativos (o número "como o Excel enxerga"). */
export function r15(x: number): number {
  // Inteiro pequeno já é exato com 15 dígitos: atalho, porque isto roda em toda comparação.
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return x;
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(15));
}

/** x = ±d,dddddddddddddd × 10^exp com exatamente 15 dígitos em `dig` (podem sobrar zeros à direita). */
interface Decimal15 {
  neg: boolean;
  dig: string;
  exp: number;
}

function decompor15(x: number): Decimal15 {
  if (x === 0) return { neg: false, dig: '000000000000000', exp: 0 };
  const s = Math.abs(x).toExponential(14); // "1.23456789012345e+2"
  const e = s.indexOf('e');
  return { neg: x < 0, dig: s[0] + s.slice(2, e), exp: Number(s.slice(e + 1)) };
}

/** Parte inteira e fracionária (em dígitos decimais) do número visto com 15 significativos. */
function partes(x: number, deslocar = 0): { neg: boolean; int: string; frac: string } {
  const { neg, dig, exp } = decompor15(x);
  const pos = exp + 1 + deslocar; // quantos dígitos antes da vírgula
  let int: string;
  let frac: string;
  if (pos >= 15) {
    int = dig + '0'.repeat(pos - 15);
    frac = '';
  } else if (pos > 0) {
    int = dig.slice(0, pos);
    frac = dig.slice(pos);
  } else {
    int = '';
    frac = '0'.repeat(-pos) + dig;
  }
  return { neg, int, frac };
}

function somaUm(digitos: string): string {
  const a = digitos.split('');
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === '9') {
      a[i] = '0';
      i--;
    } else {
      a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1);
      return a.join('');
    }
  }
  return '1' + a.join('');
}

export interface Arredondado {
  neg: boolean;
  int: string; // sem zeros à esquerda ("0" se for zero)
  frac: string; // exatamente max(n,0) dígitos
  zero: boolean;
  cortouAlgo: boolean; // havia dígito não nulo além da casa n (para o ARREDONDAR.PARA.CIMA)
}

/**
 * Arredonda x a n casas decimais (n negativo = dezenas, centenas...) sobre a representação de 15 dígitos.
 * 'meio' = meio para longe do zero (DEF.NÚM.DEC, TEXTO); 'baixo' = trunca em direção ao zero.
 * `deslocar` multiplica por 10^deslocar sem erro de double (o "%" do TEXTO).
 */
export function arredondarDecimal(x: number, n: number, modo: 'meio' | 'baixo', deslocar = 0): Arredondado {
  const { neg, int: i0, frac: f0 } = partes(x, deslocar);
  let int: string;
  let frac: string;
  let resto: string;
  if (n >= 0) {
    int = i0;
    frac = f0.slice(0, n).padEnd(n, '0');
    resto = f0.slice(n);
  } else {
    const k = i0.length + n; // dígitos inteiros que ficam
    if (k > 0) {
      int = i0.slice(0, k);
      resto = i0.slice(k) + f0;
    } else {
      int = '';
      resto = '0'.repeat(-k) + i0 + f0;
    }
    frac = '';
  }
  const cortouAlgo = /[1-9]/.test(resto);
  if (modo === 'meio' && resto.length > 0 && resto[0] >= '5') {
    const junto = somaUm((int || '0') + frac);
    int = junto.slice(0, junto.length - frac.length);
    frac = junto.slice(junto.length - frac.length);
  }
  if (n < 0 && int !== '') int = int + '0'.repeat(-n);
  int = int.replace(/^0+(?=\d)/, '');
  if (int === '') int = '0';
  const zero = /^0*$/.test(int) && /^0*$/.test(frac);
  return { neg, int, frac, zero, cortouAlgo };
}

function paraNumero(a: Arredondado): number {
  const s = (a.neg ? '-' : '') + a.int + (a.frac ? '.' + a.frac : '');
  return Number(s);
}

/** ARREDONDAR.PARA.BAIXO (ROUNDDOWN): corta em direção ao zero, sobre os 15 dígitos. */
export function arredondarParaBaixo(x: number, n: number): number {
  if (n === 0) return Math.trunc(r15(x)) || 0;
  return paraNumero(arredondarDecimal(x, n, 'baixo')) || 0;
}

/**
 * ARREDONDAR.PARA.CIMA (ROUNDUP). O Excel corta (como acima) e, se cortou algo, SOMA 10^-n em double —
 * por isso ARREDONDAR.PARA.CIMA(2,675;2) dá 2,6799999999999997 (= 2,67 + 0,01) e não o double de 2,68.
 * A planilha só usa n = 0, onde isso dá inteiro exato; o detalhe fica aqui para não surpreender depois.
 */
export function arredondarParaCima(x: number, n: number): number {
  const a = arredondarDecimal(x, n, 'baixo');
  const base = paraNumero(a) || 0;
  if (!a.cortouAlgo) return base;
  return base + (a.neg ? -1 : 1) * Math.pow(10, -n);
}

/** Agrupa a parte inteira de 3 em 3 com ponto (milhar do pt-BR). */
function milhar(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** DEF.NÚM.DEC (FIXED) do Excel pt-BR: vírgula decimal, ponto de milhar, sem "-0,00". */
export function fixo(x: number, casas: number, semMilhar: boolean): string {
  const a = arredondarDecimal(x, casas, 'meio');
  const int = semMilhar ? a.int : milhar(a.int);
  const corpo = casas > 0 ? `${int},${a.frac}` : int;
  return (a.neg && !a.zero ? '-' : '') + corpo;
}

/**
 * TEXTO (TEXT) — só o subconjunto de formatos que a planilha usa ("0%") e vizinhos óbvios, lidos como o
 * Excel pt-BR lê: vírgula é decimal e ponto é milhar (TEXTO(0,123;"0.0%") dá "12%" no pt-BR, não "12,3%").
 * Formato fora disso devolve null (o chamador transforma em #VALOR! e o teste acusa).
 */
export function texto(x: number, formato: string): string | null {
  const m = /^([0#.]*0)(,(0+))?(%?)$/.exec(formato);
  if (!m) return null;
  const casas = m[3] ? m[3].length : 0;
  const pct = m[4] === '%';
  const a = arredondarDecimal(x, casas, 'meio', pct ? 2 : 0);
  const int = m[1].includes('.') ? milhar(a.int) : a.int;
  const corpo = casas > 0 ? `${int},${a.frac}` : int;
  return (a.neg && !a.zero ? '-' : '') + corpo + (pct ? '%' : '');
}

/**
 * Número → texto como no "&" e no ESQUERDA(número): formato Geral do pt-BR com 15 significativos.
 * Sondado: fica em notação fixa enquanto couber em 20 caracteres (sem contar o sinal) — 1E-18 vira
 * "0,000000000000000001", 1E-19 vira "1E-19", 1E+19 sai por extenso e 1E+20 vira "1E+20".
 * Divergência conhecida: com o double exatamente no meio do 15º algarismo o Excel às vezes arredonda para baixo
 * (1 caso em 300 sondas; ver CONHECIDAS em sondas.py). A planilha só concatena inteiros e entradas digitadas.
 */
export function textoGeral(x: number): string {
  if (x === 0) return '0';
  const { neg, dig, exp } = decompor15(x);
  const d = dig.replace(/0+$/, '');
  let fixa: string;
  if (exp >= 0) {
    if (exp + 1 >= d.length) fixa = d + '0'.repeat(exp + 1 - d.length);
    else fixa = d.slice(0, exp + 1) + ',' + d.slice(exp + 1);
  } else {
    fixa = '0,' + '0'.repeat(-exp - 1) + d;
  }
  if (fixa.length <= 20) return (neg ? '-' : '') + fixa;
  const mant = d.length > 1 ? `${d[0]},${d.slice(1)}` : d;
  const e = `E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  return (neg ? '-' : '') + mant + e;
}

/**
 * Texto → número como o Excel pt-BR converte ("2,5"*2 = 5; "1.234,5" = 1234,5; "2.5" é #VALOR!; "50%" = 0,5).
 * Datas e horas escritas como texto não são reconhecidas (a planilha não usa). null = não é número.
 */
export function numeroDeTexto(s: string): number | null {
  let t = s.trim();
  let fator = 1;
  if (t.endsWith('%')) {
    fator = 0.01;
    t = t.slice(0, -1).trim();
  }
  const m = /^([+-]?)(\d{1,3}(?:\.\d{3})+|\d*)(?:,(\d*))?(?:[eE]([+-]?\d+))?$/.exec(t);
  if (!m) return null;
  const int = m[2].replace(/\./g, '');
  const frac = m[3] ?? '';
  if (int === '' && frac === '') return null;
  const n = Number(`${m[1]}${int || '0'}.${frac || '0'}e${m[4] ?? '0'}`);
  return Number.isFinite(n) ? n * fator : null;
}

const VISTA = new DataView(new ArrayBuffer(8));

/** Expoente binário de x (x = m·2^e com 1 ≤ m < 2). */
export function expoente2(x: number): number {
  VISTA.setFloat64(0, x);
  const bits = (VISTA.getUint16(0) >> 4) & 0x7ff;
  if (bits === 0) return -1023; // subnormal: tratamos como "minúsculo"
  return bits - 1023;
}

/**
 * O "zero forçado" do Excel: quando a ÚLTIMA operação da fórmula é + ou − (fora de parênteses) e o resultado
 * é minúsculo perto do primeiro operando, o Excel grava 0. Sondado: =0,5-0,4-0,1 dá 0, mas =(0,5-0,4-0,1),
 * =1*(0,5-0,4-0,1) e =SEERRO(0,5-0,4-0,1;"x") dão -2,78E-17. O limiar é binário: |resultado| < 2^(e−49),
 * com e = expoente do operando da esquerda — (1+7·2⁻⁵²)−1 vira 0 e (1+8·2⁻⁵²)−1 não; com o operando da
 * esquerda em [0,5;1) o limiar cai pela metade, como as sondas mostraram.
 */
export function zeroForcado(esq: number, r: number): number {
  if (r === 0 || esq === 0 || !Number.isFinite(r)) return r;
  return Math.abs(r) < Math.pow(2, expoente2(esq) - 49) ? 0 : r;
}
