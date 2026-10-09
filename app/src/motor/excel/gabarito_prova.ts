/*
  Leitura do gabarito do Excel (dados/golden/*.json) para a PROVA do avaliador (golden.test.ts,
  cobertura.test.ts). Só testes importam isto (usa node:fs); o app no navegador nunca carrega este arquivo.
  (O motor/gabarito.ts é outra coisa: entrega um Resultado lido direto do gabarito para as frentes que
  consomem a conta.)
*/
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Valor } from '../tipos';

export const PASTA_GABARITO = fileURLToPath(new URL('../../../../dados/golden/', import.meta.url));

export interface Gabarito {
  cenario: string;
  alterado: Record<string, Valor>;
  nomes: Record<string, unknown>;
  celulas: Record<string, unknown>;
}

/** Todos os cenários (aula122, aula123, sorteioNN e, se existirem, alvo_*), em ordem alfabética. */
export function carregarGabarito(): Gabarito[] {
  return readdirSync(PASTA_GABARITO)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(PASTA_GABARITO, f), 'utf8')) as Gabarito);
}

const ERROS = new Set(['#DIV/0!', '#VALUE!', '#N/A', '#NUM!', '#REF!', '#NAME?', '#NULL!']);

/**
 * Mesmo valor que o Excel? Número com tolerância relativa 1e-9 (absoluta 1e-12): a mesma conta em double pode
 * mudar no último bit conforme a ordem interna das operações. Texto e lógico idênticos. Erro (que o openpyxl
 * lê como texto "#N/A") pelo código.
 */
export function igualAoExcel(excel: unknown, app: Valor): boolean {
  if (typeof excel === 'number' && typeof app === 'number') {
    const d = Math.abs(excel - app);
    return d <= 1e-12 || d <= 1e-9 * Math.max(Math.abs(excel), Math.abs(app));
  }
  if (typeof excel === 'string' && ERROS.has(excel)) return typeof app === 'object' && app !== null && app.erro === excel;
  // Fórmula que devolve texto vazio ("" — ex.: aviso_coesao com c' = 0): o Excel grava a célula com <v></v> e o
  // openpyxl lê None. Fórmula no Excel nunca fica "vazia" de verdade (referência a célula vazia dá 0), então o null
  // do gabarito numa célula de fórmula só pode ser esse texto vazio.
  if (excel === null && app === '') return true;
  return excel === app;
}
