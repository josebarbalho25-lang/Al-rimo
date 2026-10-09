/*
  A LINHA INTEIRA EM TEX, sempre na mesma ordem: símbolo = fórmula = números = resultado unidade [≤ limite].

  Puro (sem React): o mesmo texto vai para a tela, o papel e o Word, e o teste compila cada um com o KaTeX.
*/
import type { Resultado } from '@/motor/tipos';
import type { Passo, Verificacao } from './tipos';
import { texNumerico, texSimbolico } from './expr';
import { nt, texTexto, texUnidade } from './formato';

/** O resultado publicado: número com as casas da célula + unidade; texto vira \text{}. */
export function texDoValor(p: Passo): string {
  if (typeof p.valor === 'number') return nt(p.valor, p.casas) + texUnidade(p.unidade);
  if (typeof p.valor === 'string') return texTexto(p.valor);
  return '\\text{—}';
}

/**
  O sinal compara EXATAMENTE as duas grandezas da linha (regra medida no Pró-Viga: usar o veredito geral imprimia
  "1,57 < 1,35"). Quando quem decide é a célula de veredito da planilha e ela discorda da comparação, vale a
  comparação para o sinal — a desigualdade escrita nunca é falsa — e o chip mostra o veredito.
*/
export function sinal(v: Verificacao): string {
  const { valor, limite, relacao } = v;
  if (valor !== null && limite !== null) {
    const atende = relacao === '<=' ? valor <= limite : valor >= limite;
    if (relacao === '<=') return atende ? '\\le' : '>';
    return atende ? '\\ge' : '<';
  }
  return relacao === '<=' ? '\\le' : '\\ge';
}

export function texDaLinha(p: Passo, r: Resultado): string {
  const partes: string[] = [p.simbolo];
  const numerico = typeof p.valor === 'number';
  if (p.expr) {
    partes.push(texSimbolico(p.expr));
    // sem número publicado (célula com texto, "não resiste") a substituição não tem o que provar.
    // Expressão de UMA folha só (b_m = s) não tem conta a mostrar: o número já vem no resultado, com as casas da
    // célula — senão a linha repetia o mesmo número com outra casa ("b_m = s = 45 = 45,0 cm").
    const folhaSo = p.expr.k === 'nome' || p.expr.k === 'num';
    if (numerico && !folhaSo) partes.push(texNumerico(p.expr, r));
  }
  const res = texDoValor(p);
  const resSemUnidade = numerico ? nt(p.valor as number, p.casas) : res;
  // parte igual à anterior não se repete ("M_k = M_k"); números iguais ao resultado também não
  const limpas: string[] = [];
  for (const s of partes) if (limpas[limpas.length - 1] !== s) limpas.push(s);
  if (limpas.length > 1 && limpas[limpas.length - 1] === resSemUnidade) limpas.pop();
  limpas.push(res);
  let s = limpas.join(' = ');
  if (p.verif && p.limiteTex) s += ` \\;${sinal(p.verif)}\\; ${p.limiteTex}`;
  return s;
}

/** "OK · 56 %" / "NÃO PASSA · 112 %" — o chip à direita da linha que termina em desigualdade. */
export function textoDoChip(v: Verificacao): string {
  const pct = v.util === null || !Number.isFinite(v.util) ? '' : ` · ${Math.round(v.util)}%`;
  return (v.passa ? 'OK' : 'NÃO PASSA') + pct;
}
