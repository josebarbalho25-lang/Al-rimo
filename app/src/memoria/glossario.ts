/*
  GLOSSÁRIO: latinas de A a Z, depois as gregas na ordem grega — como a NBR põe antes do texto. Pedido do Jose no
  Pró-Viga: "uma vez só, após o índice ... isso já ajuda na continuidade dos cálculos".

  A ordenação é a do Pró-Viga com os cinco defeitos medidos corrigidos (relatório da memória, §3.3/§7.4):
    ℓ ordenava pelo índice (\ell_b caía em "b")      → \ell conta como "l"
    \cot\theta virava raiz vazia e abria a lista      → a função conta pelo nome ("cot")
    "(EI)", "2A_c/u", "1/r" vinham antes de A         → pula dígito e pontuação do começo
    acento (s_{máx})                                  → á conta como a
    separador ":" fazia "A_0" vir antes de "a"        → separador \u0001, menor que qualquer caractere
  O glossário sai dos PRÓPRIOS passos (lado esquerdo e folhas das fórmulas), nunca de uma lista à parte.
*/
import type { Card, Passo } from './tipos';
import { simbolosDe } from './expr';
import { descricao } from './simbolos';

const GREGAS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda',
  'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];

// (?![A-Za-z]) e não \b: em "\ell_0" o "_" é caractere de palavra e o \b não casa (medido)
const FUNCOES = /\\(cot|tan|sin|cos|min|max|log|ln)(?![A-Za-z])/g;

function base(s: string): string {
  return s
    .replace(/\\ell(?![A-Za-z])/g, 'l')
    .replace(FUNCOES, '$1')
    .replace(/\\(?:acute|grave|hat|tilde|text|mathrm|mathit|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\\[A-Za-z]+/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .replace(/^[0-9]+/, '')
    .toLowerCase();
}

const S = '\u0001';

/** Chave de ordenação de um símbolo TeX (comparar por código: determinístico). */
export function chaveDeOrdem(tex: string): string {
  const s = tex.trim();
  const m = s.match(/^[^A-Za-z\\]*\\(?:var)?([A-Za-z]+)/);
  const g = m ? GREGAS.indexOf(m[1].toLowerCase()) : -1;
  if (g >= 0) {
    const resto = s.replace(/^[^\\]*\\(?:var)?[A-Za-z]+/, '');
    return `2${S}${String(g).padStart(2, '0')}${S}${base(resto)}${S}${s}`;
  }
  return `1${S}${base(s)}${S}${s}`;
}

export function ordenarSimbolos(lista: Iterable<string>): string[] {
  const unicos = [...new Set(lista)];
  const ch = new Map(unicos.map((s) => [s, chaveDeOrdem(s)]));
  return unicos.sort((a, b) => {
    const x = ch.get(a)!, y = ch.get(b)!;
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

/** "\sum_{i=1}^{39}\sigma'_{h,i}" desenha uma soma, mas o símbolo do glossário é a parcela: σ'_{h,i}. */
export function simboloDoGlossario(tex: string): string {
  return tex.replace(/^\\sum_\{[^}]*\}\^\{[^}]*\}\s*/, '').trim();
}

/** Os símbolos que UMA linha desenha: lado esquerdo, folhas da fórmula e o limite da desigualdade. */
export function simbolosDoPasso(p: Passo): string[] {
  const out = [p.simbolo];
  if (p.expr) out.push(...simbolosDe(p.expr));
  if (p.limiteExpr) out.push(...simbolosDe(p.limiteExpr));
  return out.map(simboloDoGlossario);
}

/** Todos os símbolos que um card desenha, sem repetição, na ordem do glossário. */
export function simbolosDoCard(card: Card): string[] {
  return ordenarSimbolos(card.secoes.flatMap((s) => s.passos.flatMap(simbolosDoPasso)));
}

/** O glossário do documento: [TeX, descrição] de todos os cards, na ordem latinas → gregas. */
export function glossarioDe(cards: Card[]): [string, string][] {
  const todos: string[] = [];
  for (const c of cards) todos.push(...simbolosDoCard(c));
  return ordenarSimbolos(todos).map((s) => [s, descricao(s)]);
}
