/*
  O QUE A MEMÓRIA LÊ DA PLANILHA EXPORTADA SEM PRECISAR DO AVALIADOR: rótulo, unidade e formato de cada entrada,
  o aviso do solo (Entradas!A3) e a versão da conta.

  Ler daqui (e não copiar para dentro da memória) é o que mantém "γ adotado ... kN/m³ ... 0,0" igual ao que o Jose
  vê na aba Entradas: a casa decimal da memória é a da célula.
*/
import dados from '@/motor/planilha.gerada.json';
import type { EntradaMeta, PlanilhaExportada } from '@/motor/tipos';
import { casasDoFormato } from './formato';

const P = dados as unknown as PlanilhaExportada;

const POR_NOME = new Map<string, EntradaMeta>(P.entradas.map((e) => [e.nome, e]));

/** Metadados da entrada (aba Entradas), ou undefined se o nome não for de entrada. */
export function metaDaEntrada(nome: string): EntradaMeta | undefined {
  return POR_NOME.get(nome);
}

/** Todas as entradas, na ordem da aba. */
export const ENTRADAS: readonly EntradaMeta[] = P.entradas;

/** Casas da entrada pelo formato da célula; 'General' cai em 2. */
export function casasDaEntrada(nome: string): number {
  const m = POR_NOME.get(nome);
  return casasDoFormato(m?.formato) ?? 2;
}

/** Hash do gerador que produziu a conta — vai no rosto do memorial. */
export const VERSAO_DA_CONTA: string = P.versao;

/**
  O AVISO DO SOLO, palavra por palavra como está no topo das Entradas. Mora numa célula de texto (não tem nome
  definido); se o gerador mudar a célula de lugar, o teste da memória acusa.
*/
export const AVISO_DO_SOLO: string = (() => {
  const v = P.celulas['Entradas!A3'];
  return typeof v === 'string' ? v : '';
})();
