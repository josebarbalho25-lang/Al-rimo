/*
  O motor contra as SONDAS: fórmulas avulsas que o Excel desta máquina respondeu (excel/sondas.py →
  sondas.gerado.json). Cobrem os cantos do Excel que a planilha não exercita hoje mas pode exercitar amanhã,
  quando o gerador mudar: comparação com 15 dígitos, "zero forçado", INT/TETO com 15 dígitos, formatos pt-BR,
  CORRESP por busca binária, interseção implícita, célula vazia em cada função, a aritmética de 80 bits etc.

  Aqui a comparação de número é EXATA (bit a bit): estas sondas existem justamente para pegar diferença de
  último dígito em arredondamento.

  As poucas sondas marcadas "conhecida" no gerador são diferenças que o motor NÃO consegue reproduzir (cada uma diz
  por quê). Elas não reprovam, mas são mostradas, e o teste exige que continuem a no máximo um bit do Excel — se
  piorarem, é defeito novo.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Planilha } from '../planilha';
import type { PlanilhaExportada, Valor } from '../tipos';

interface Sonda {
  f: string;
  ref: string;
  v: unknown;
  lida: string;
  conhecida?: string;
}
const arq = JSON.parse(readFileSync(fileURLToPath(new URL('./sondas.gerado.json', import.meta.url)), 'utf8')) as {
  versao_excel: string;
  aux: Record<string, Valor | string>;
  sondas: Sonda[];
};

const celulas: Record<string, Valor | string> = {};
for (const [ref, v] of Object.entries(arq.aux)) celulas[`Sonda!${ref}`] = v;
for (const s of arq.sondas) celulas[`Sonda!${s.ref}`] = s.f;
const dados: PlanilhaExportada = { versao: 'sondas', abas: ['Sonda'], nomes: {}, entradas: [], celulas };

function igual(excel: unknown, app: Valor): boolean {
  if (typeof excel === 'number' && typeof app === 'number') return excel === app || (excel === 0 && app === 0);
  if (typeof excel === 'object' && excel !== null) {
    return typeof app === 'object' && app !== null && app.erro === (excel as { erro: string }).erro;
  }
  return excel === app;
}

/** A um bit (no máximo) de distância: o vizinho do double, ou o texto com um algarismo a mais/menos no fim. */
function vizinho(excel: unknown, app: Valor): boolean {
  if (typeof excel === 'number' && typeof app === 'number') {
    const ulp = Math.abs(excel) * 2 ** -52;
    return Math.abs(excel - app) <= ulp;
  }
  if (typeof excel === 'string' && typeof app === 'string') {
    const n = Math.min(excel.length, app.length);
    return Math.abs(excel.length - app.length) <= 1 && excel.slice(0, n - 1) === app.slice(0, n - 1);
  }
  return false;
}

describe(`motor × sondas do Excel (${arq.versao_excel})`, () => {
  const r = new Planilha(dados).calcular();
  const normais = arq.sondas.filter((s) => !s.conhecida);
  const conhecidas = arq.sondas.filter((s) => s.conhecida);

  it(`as ${normais.length} sondas batem bit a bit`, () => {
    const difs: string[] = [];
    for (const s of normais) {
      const app = r.cel(`Sonda!${s.ref}`);
      if (!igual(s.v, app)) difs.push(`${s.ref} ${s.f}  Excel=${JSON.stringify(s.v)}  app=${JSON.stringify(app)}`);
    }
    if (difs.length) console.log(difs.join('\n'));
    expect(difs).toEqual([]);
  });

  it(`as ${conhecidas.length} divergências conhecidas continuam a um bit do Excel`, () => {
    const linhas: string[] = [];
    const longe: string[] = [];
    for (const s of conhecidas) {
      const app = r.cel(`Sonda!${s.ref}`);
      const ok = igual(s.v, app);
      linhas.push(`  ${s.f}  Excel=${JSON.stringify(s.v)}  app=${JSON.stringify(app)}${ok ? '  (agora bate!)' : ''}  — ${s.conhecida}`);
      if (!ok && !vizinho(s.v, app)) longe.push(s.f);
    }
    console.log(`DIVERGÊNCIAS CONHECIDAS:\n${linhas.join('\n')}`);
    expect(longe).toEqual([]);
  });
});
