/*
  LÉXICO — quebra o texto da fórmula em peças (números, textos, referências, nomes, operadores).

  As fórmulas chegam na sintaxe en-US, que é como o arquivo .xlsx guarda (vírgula separa argumento, ponto é
  decimal, nomes de função em inglês). O Excel pt-BR traduz isso só na tela; por dentro é o mesmo texto.
  Por isso aqui NÃO há ponto-e-vírgula como separador de argumento: ';' só aparece em matriz inline, separando
  linhas ({1,2;3,4}).
*/
import type { ErroExcel } from '../tipos';

export type CodigoErro = ErroExcel['erro'];

export type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'err'; v: CodigoErro }
  /** Referência a célula ou intervalo. `aba` null = a aba da própria fórmula. Linhas/colunas 1-based. */
  | { t: 'ref'; aba: string | null; r1: number; c1: number; r2: number; c2: number }
  | { t: 'nome'; v: string }
  /** Nome de função; o '(' já foi consumido. */
  | { t: 'func'; v: string }
  | { t: 'op'; v: string }
  | { t: '(' | ')' | ',' | ';' | '{' | '}' | 'fim' };

const ERROS: CodigoErro[] = ['#DIV/0!', '#VALUE!', '#N/A', '#NUM!', '#REF!', '#NAME?', '#NULL!'];

// Endereço de célula: até 3 letras (XFD é a última coluna) e linha até 1.048.576. Um nome definido como
// "tabB13" tem 4 letras, então não colide — e o gerador já proíbe nomes que pareçam célula.
const RE_CELULA = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/;
const MAX_COL = 16384;
const MAX_LIN = 1048576;

/** 'B12' → {lin: 12, col: 2}; null se o texto não for endereço válido. */
export function celulaDe(txt: string): { lin: number; col: number } | null {
  const m = RE_CELULA.exec(txt);
  if (!m) return null;
  const col = colunaDe(m[1]);
  const lin = Number(m[2]);
  if (col < 1 || col > MAX_COL || lin < 1 || lin > MAX_LIN) return null;
  return { lin, col };
}

/** 'A' → 1, 'Z' → 26, 'AA' → 27. */
export function colunaDe(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** 1 → 'A', 27 → 'AA'. */
export function letrasDe(col: number): string {
  let s = '';
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// Caracteres de identificador: letras (inclusive acentuadas — nomes de aba como "Fundação" aparecem sem aspas
// em alguns geradores), dígitos, '_', '.', '\' e '$' (este último só faz sentido em endereço absoluto).
function ehIdent(ch: string): boolean {
  return /[A-Za-z0-9_.\\$À-￿]/.test(ch);
}
function ehInicioIdent(ch: string): boolean {
  return /[A-Za-z_\\$À-￿]/.test(ch);
}

export class ErroSintaxe extends Error {}

/**
 * Número escrito na fórmula. O Excel lê no máximo 15 algarismos significativos e CORTA o resto (não
 * arredonda): =1234567890123456 vira 1234567890123450 e =2,99999999999999999 vira 2,99999999999999 (sondado).
 */
function numeroLiteral(mant: string, exp: string): number {
  let out = '';
  let sig = 0;
  let depoisPonto = false;
  for (const ch of mant) {
    if (ch === '.') {
      depoisPonto = true;
      out += ch;
      continue;
    }
    if (sig === 0 && ch === '0') {
      out += ch;
      continue;
    }
    sig++;
    if (sig <= 15) out += ch;
    else if (!depoisPonto) out += '0';
  }
  return Number(out + exp);
}

export function tokenizar(f: string): Token[] {
  const s = f.startsWith('=') ? f.slice(1) : f;
  const out: Token[] = [];
  let i = 0;
  const n = s.length;

  // Lê um endereço (com ou sem '$') a partir de i; devolve o fim do intervalo se houver ':'.
  const lerRef = (aba: string | null): Token => {
    let j = i;
    while (j < n && ehIdent(s[j])) j++;
    const a = celulaDe(s.slice(i, j));
    if (!a) throw new ErroSintaxe(`referência inválida em "${f}" (posição ${i})`);
    i = j;
    let b = a;
    if (s[i] === ':') {
      let k = i + 1;
      while (k < n && ehIdent(s[k])) k++;
      const bb = celulaDe(s.slice(i + 1, k));
      if (bb) {
        b = bb;
        i = k;
      }
    }
    return {
      t: 'ref',
      aba,
      r1: Math.min(a.lin, b.lin),
      c1: Math.min(a.col, b.col),
      r2: Math.max(a.lin, b.lin),
      c2: Math.max(a.col, b.col),
    };
  };

  while (i < n) {
    const ch = s[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      // Espaço entre duas referências seria o operador de interseção do Excel; a planilha não usa.
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let txt = '';
      for (;;) {
        if (j >= n) throw new ErroSintaxe(`texto sem fechar aspas em "${f}"`);
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            txt += '"';
            j += 2;
            continue;
          }
          break;
        }
        txt += s[j++];
      }
      out.push({ t: 'str', v: txt });
      i = j + 1;
      continue;
    }
    if (ch === '#') {
      const e = ERROS.find((x) => s.startsWith(x, i));
      if (!e) throw new ErroSintaxe(`erro literal desconhecido em "${f}"`);
      out.push({ t: 'err', v: e });
      i += e.length;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i))!;
      out.push({ t: 'num', v: numeroLiteral(m[1], m[2] ?? '') });
      i += m[0].length;
      continue;
    }
    if (ch === "'") {
      // 'Nome da aba'!A1 — aspas simples dobradas dentro do nome valem uma.
      let j = i + 1;
      let aba = '';
      for (;;) {
        if (j >= n) throw new ErroSintaxe(`nome de aba sem fechar aspas em "${f}"`);
        if (s[j] === "'") {
          if (s[j + 1] === "'") {
            aba += "'";
            j += 2;
            continue;
          }
          break;
        }
        aba += s[j++];
      }
      i = j + 1;
      if (s[i] !== '!') throw new ErroSintaxe(`esperado '!' depois da aba em "${f}"`);
      i++;
      out.push(lerRef(aba));
      continue;
    }
    if (ehInicioIdent(ch)) {
      let j = i;
      while (j < n && ehIdent(s[j])) j++;
      const id = s.slice(i, j);
      if (s[j] === '!') {
        i = j + 1;
        out.push(lerRef(id));
        continue;
      }
      if (s[j] === '(') {
        // _xlfn. é o prefixo que o arquivo usa para funções novas; a função é a mesma.
        out.push({ t: 'func', v: id.replace(/^_xlfn\./i, '').toUpperCase() });
        i = j + 1;
        continue;
      }
      const up = id.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') {
        out.push({ t: 'bool', v: up === 'TRUE' });
        i = j;
        continue;
      }
      if (celulaDe(id)) {
        out.push(lerRef(null));
        continue;
      }
      out.push({ t: 'nome', v: id });
      i = j;
      continue;
    }
    const dois = s.slice(i, i + 2);
    if (dois === '<=' || dois === '>=' || dois === '<>') {
      out.push({ t: 'op', v: dois });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%:'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if ('(),;{}'.includes(ch)) {
      out.push({ t: ch as '(' });
      i++;
      continue;
    }
    throw new ErroSintaxe(`caractere inesperado '${ch}' em "${f}"`);
  }
  out.push({ t: 'fim' });
  return out;
}
