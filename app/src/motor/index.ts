/*
  Porta de entrada do motor: o resto do app só importa daqui.

  A planilha é compilada uma vez (na primeira importação) e cada calcular() é uma conta nova, preguiçosa e
  memorizada — barata o bastante para rodar a cada tecla digitada no formulário.
*/
import dados from './planilha.gerada.json';
import { Planilha } from './planilha';
import type { Alteracoes, EntradaMeta, PlanilhaExportada, Resultado, Valor } from './tipos';

export type { Alteracoes, EntradaMeta, ErroExcel, PlanilhaExportada, Resultado, Valor } from './tipos';
export { ErroCiclo, Planilha } from './planilha';

/** A planilha do gerador, já compilada. */
export const planilha = new Planilha(dados as unknown as PlanilhaExportada);

/** Hash do gerador que produziu a conta (muda quando a planilha muda). */
export const versao: string = planilha.versao;

/** Entradas da aba Entradas, na ordem da aba (o formulário do app é montado daqui). */
export const entradas: readonly EntradaMeta[] = planilha.entradas;

/**
 * Calcula com as alterações (por nome definido) sobre o padrão da planilha. Só aceita entradas, e confere cada valor
 * como o Excel o gravaria se o usuário digitasse ("19" vira 19, "1,6" vira 1,6, "" vira em branco); valor que o
 * Excel recusaria (fora da lista, texto em campo numérico, NaN, undefined) faz LANÇAR erro com o motivo.
 */
export function calcular(alteracoes: Alteracoes = {}): Resultado {
  return planilha.calcular(alteracoes);
}

/** O valor que a conta usaria para o que foi digitado numa entrada, ou erro com o motivo: a mesma regra do
 *  calcular(), para o formulário avisar no campo antes de mandar. */
export function converterEntrada(nome: string, bruto: unknown): Valor {
  return planilha.converterEntrada(nome, bruto);
}
