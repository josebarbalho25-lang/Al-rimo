/*
  SINTAXE — monta a árvore da fórmula respeitando a precedência do Excel (não a da matemática de escola).

  Precedência do Excel, da mais forte para a mais fraca:
    :  (intervalo)  →  - unário  →  %  →  ^  →  * /  →  + -  →  &  →  = <> < > <= >=
  A pegadinha é o menos unário ANTES da potência: no Excel  =-2^2  dá 4 (é (-2)²), e  =1-2^2  dá -3 (aí o
  menos é binário). Uma fórmula como  =-x^2  na planilha vale +x²; o app tem de dar o mesmo.
  A potência é associativa à esquerda no Excel: 2^3^2 = (2^3)^2 = 64.
*/
import type { CodigoErro, Token } from './lexico';
import { ErroSintaxe, tokenizar } from './lexico';

export type Constante = number | string | boolean | { erro: CodigoErro } | null;

export type No =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: CodigoErro }
  | { k: 'ref'; aba: string | null; r1: number; c1: number; r2: number; c2: number }
  | { k: 'nome'; v: string }
  | { k: 'mat'; linhas: Constante[][] }
  /** args[i] null = argumento omitido, como em IF(a,,b). */
  | { k: 'fn'; nome: string; args: (No | null)[] }
  | { k: 'un'; op: '-' | '+' | '%'; a: No }
  /** Parênteses explícitos. Não mudam a conta, mas mudam o "zero forçado" do Excel (ver numeros.zeroForcado):
   *  =0,5-0,4-0,1 dá 0 e =(0,5-0,4-0,1) dá -2,78E-17. Por isso o parêntese fica na árvore. */
  | { k: 'par'; a: No }
  | { k: 'bin'; op: string; a: No; b: No };

// Força de ligação dos operadores binários (quanto maior, mais "gruda").
const BINARIOS: Record<string, number> = {
  '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
  '&': 2,
  '+': 3, '-': 3,
  '*': 4, '/': 4,
  '^': 5,
};
const UNARIO = 6; // menos/mais unário: acima do ^ (é isso que faz -2^2 = 4)
const PERCENT = 7;

export function analisar(formula: string): No {
  const tk = tokenizar(formula);
  let p = 0;
  const olha = (): Token => tk[p];
  const anda = (): Token => tk[p++];
  const espera = (t: Token['t']): void => {
    const x = anda();
    if (x.t !== t) throw new ErroSintaxe(`esperado '${t}', veio '${x.t}' em "${formula}"`);
  };

  function expr(minimo: number): No {
    let esq = prefixo();
    for (;;) {
      const t = olha();
      if (t.t !== 'op') break;
      if (t.v === '%') {
        if (PERCENT < minimo) break;
        anda();
        esq = { k: 'un', op: '%', a: esq };
        continue;
      }
      const bp = BINARIOS[t.v];
      if (bp === undefined || bp < minimo) break;
      anda();
      // Todos os binários do Excel são associativos à esquerda (inclusive ^): o lado direito liga com bp+1.
      const dir = expr(bp + 1);
      esq = { k: 'bin', op: t.v, a: esq, b: dir };
    }
    return esq;
  }

  function prefixo(): No {
    const t = anda();
    switch (t.t) {
      case 'num':
        return { k: 'num', v: t.v };
      case 'str':
        return { k: 'str', v: t.v };
      case 'bool':
        return { k: 'bool', v: t.v };
      case 'err':
        return { k: 'err', v: t.v };
      case 'ref':
        return { k: 'ref', aba: t.aba, r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2 };
      case 'nome':
        return { k: 'nome', v: t.v };
      case 'op':
        if (t.v === '-' || t.v === '+') return { k: 'un', op: t.v, a: expr(UNARIO) };
        break;
      case '(': {
        const e = expr(0);
        espera(')');
        return { k: 'par', a: e };
      }
      case '{':
        return matriz();
      case 'func': {
        const args: (No | null)[] = [];
        if (olha().t === ')') {
          anda();
          return { k: 'fn', nome: t.v, args };
        }
        for (;;) {
          const x = olha();
          if (x.t === ',' || x.t === ')') args.push(null);
          else args.push(expr(0));
          const sep = anda();
          if (sep.t === ')') break;
          if (sep.t !== ',') throw new ErroSintaxe(`esperado ',' ou ')' em "${formula}"`);
        }
        return { k: 'fn', nome: t.v, args };
      }
    }
    throw new ErroSintaxe(`token inesperado '${t.t}' em "${formula}"`);
  }

  // Matriz inline: só constantes. ',' separa colunas e ';' separa linhas (na sintaxe en-US do arquivo).
  function matriz(): No {
    const linhas: Constante[][] = [[]];
    for (;;) {
      let t = anda();
      let sinal = 1;
      if (t.t === 'op' && (t.v === '-' || t.v === '+')) {
        if (t.v === '-') sinal = -1;
        t = anda();
      }
      let v: Constante;
      if (t.t === 'num') v = sinal * t.v;
      else if (t.t === 'str') v = t.v;
      else if (t.t === 'bool') v = t.v;
      else if (t.t === 'err') v = { erro: t.v };
      else throw new ErroSintaxe(`matriz inline só aceita constantes em "${formula}"`);
      linhas[linhas.length - 1].push(v);
      const sep = anda();
      if (sep.t === '}') break;
      if (sep.t === ';') linhas.push([]);
      else if (sep.t !== ',') throw new ErroSintaxe(`separador inválido na matriz em "${formula}"`);
    }
    const largura = linhas[0].length;
    if (linhas.some((l) => l.length !== largura)) throw new ErroSintaxe(`matriz com linhas desiguais em "${formula}"`);
    return { k: 'mat', linhas };
  }

  const raiz = expr(0);
  if (olha().t !== 'fim') throw new ErroSintaxe(`sobrou texto depois da fórmula em "${formula}"`);
  return raiz;
}
