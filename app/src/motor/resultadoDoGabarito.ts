/*
  RESULTADO TIRADO DO GABARITO DO EXCEL (dados/golden/*.json) — só para teste (Node/vitest).

  Serve a duas coisas: (1) as frentes que consomem a conta (modulação, memória, desenhos...) testam contra o
  número que o Excel deu, sem depender do avaliador em TS; (2) depois, conferir que o avaliador e o Excel
  contam a mesma história. Não importar em código que roda no navegador (usa node:fs).
*/
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado, Valor, Alteracoes } from './tipos';

const PASTA = fileURLToPath(new URL('../../../dados/golden/', import.meta.url));

interface ArquivoDoGabarito {
  cenario: string;
  alterado: Alteracoes;
  entradas: Record<string, Valor>;
  nomes: Record<string, Valor | Valor[][]>;
  celulas: Record<string, Valor>;
}

const cache = new Map<string, ArquivoDoGabarito>();

export function cenariosDoGabarito(): string[] {
  return readdirSync(PASTA).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

export function lerGabarito(cenario: string): ArquivoDoGabarito {
  let g = cache.get(cenario);
  if (!g) {
    g = JSON.parse(readFileSync(PASTA + cenario + '.json', 'utf8')) as ArquivoDoGabarito;
    cache.set(cenario, g);
  }
  return g;
}

// O Excel grava erro como texto ('#DIV/0!'); aqui ele vira ErroExcel, como no avaliador.
function comoValor(v: unknown): Valor {
  if (typeof v === 'string' && /^#(DIV\/0!|VALUE!|N\/A|NUM!|REF!|NAME\?|NULL!)$/.test(v)) {
    return { erro: v as '#DIV/0!' };
  }
  return v as Valor;
}

export function resultadoDoGabarito(cenario: string): Resultado {
  const g = lerGabarito(cenario);
  const v = (nome: string): Valor => {
    if (!(nome in g.nomes)) throw new Error(`nome inexistente na planilha: ${nome}`);
    const x = g.nomes[nome];
    if (Array.isArray(x)) throw new Error(`o nome ${nome} é um intervalo, não uma célula`);
    return comoValor(x);
  };
  return {
    v,
    num(nome) {
      const x = v(nome);
      return typeof x === 'number' && Number.isFinite(x) ? x : null;
    },
    cel(ref) {
      return ref in g.celulas ? comoValor(g.celulas[ref]) : null;
    },
    alteracoes: g.alterado,
  };
}
