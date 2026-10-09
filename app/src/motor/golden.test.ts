/*
  PROVA DO MOTOR CONTRA O EXCEL.

  dados/golden/*.json foi gerado pelo Excel desta máquina (tools/golden.py: aula 12.2, aula 12.3 e 40 sorteios;
  tools/golden_alvos.py: os alvo_*.json — bordas de 15 dígitos, ramos que os sorteios nunca tomam e campos
  apagados): o Excel abriu a planilha em cada cenário, recalculou tudo e gravou o valor de TODA célula com fórmula
  e de todo nome definido. Aqui o motor TypeScript refaz cada cenário pela MESMA porta do app (calcular(), com a
  conferência das entradas) e tem de bater célula por célula:
    - número: tolerância relativa 1e-9 (absoluta 1e-12). O motor reproduz a aritmética do Excel no último bit
      (excel/x87.ts) e o relatório imprime quantas células ficam fora do bit — hoje 4 de 78.499, todas de uma
      potência fracionária em que o F2XM1 do processador decide (ver a divergência conhecida em sondas.py). A
      tolerância fica para que um bit assim, propagado por uma subtração que cancela dígitos, não vire alarme falso;
    - texto: idêntico, caractere por caractere (é o que vai para a memória de cálculo);
    - lógico: idêntico; erro (que o openpyxl lê como texto "#N/A") pelo código.
*/
import { describe, expect, it } from 'vitest';
import { carregarGabarito, igualAoExcel as igual } from './excel/gabarito_prova';
import { calcular, planilha } from './index';
import type { Valor } from './tipos';

const cenarios = carregarGabarito();

const mostra = (v: unknown): string => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));

describe('motor × Excel (gabarito)', () => {
  it(`tem gabarito (${cenarios.length} cenários)`, () => {
    expect(cenarios.length).toBeGreaterThanOrEqual(42);
  });

  it('todas as células com fórmula e todos os nomes de célula única batem com o Excel', () => {
    const linhas: string[] = [];
    let totCel = 0;
    let totNome = 0;
    let difCel = 0;
    let difNome = 0;
    let numeros = 0;
    let foraDoBit = 0;
    for (const g of cenarios) {
      const r = calcular(g.alterado);
      const difs: string[] = [];
      let ok = 0;
      for (const [ref, excel] of Object.entries(g.celulas)) {
        const app = r.cel(ref);
        if (typeof excel === 'number' && typeof app === 'number') {
          numeros++;
          if (excel !== app) foraDoBit++;
        }
        if (igual(excel, app)) ok++;
        else difs.push(`  ${ref}  Excel=${mostra(excel)}  app=${mostra(app)}\n      ${planilha.formula(ref)}`);
      }
      let okN = 0;
      const difsN: string[] = [];
      let nN = 0;
      for (const [nome, excel] of Object.entries(g.nomes)) {
        if (Array.isArray(excel)) continue; // nome de intervalo: as células dele já entram acima ou são constantes
        nN++;
        const app = r.v(nome);
        if (igual(excel, app)) okN++;
        else difsN.push(`  nome ${nome}  Excel=${mostra(excel)}  app=${mostra(app)}`);
      }
      const n = Object.keys(g.celulas).length;
      totCel += n;
      totNome += nN;
      difCel += difs.length;
      difNome += difsN.length;
      linhas.push(
        `${g.cenario.padEnd(12)} células ${ok}/${n} iguais` +
          `${difs.length ? ` (${difs.length} diferentes)` : ''} · nomes ${okN}/${nN}` +
          `${difsN.length ? ` (${difsN.length} diferentes)` : ''}`,
      );
      for (const d of [...difs, ...difsN].slice(0, 8)) linhas.push(d);
    }
    linhas.push(
      `TOTAL ${cenarios.length} cenários: ${totCel - difCel}/${totCel} células e ${totNome - difNome}/${totNome} nomes iguais`,
      `      (bit a bit: ${numeros - foraDoBit}/${numeros} células numéricas idênticas; as outras diferem só no último dígito binário)`,
    );
    console.log(linhas.join('\n'));
    expect(difCel + difNome).toBe(0);
  });

  it('calcular() completo (todas as células) é rápido', () => {
    const refs = planilha.celulasComFormula();
    const alt = cenarios.map((g) => g.alterado);
    const rodada = (a: Record<string, Valor>) => {
      const r = calcular(a);
      for (const ref of refs) r.cel(ref);
    };
    for (let k = 0; k < 20; k++) rodada(alt[k % alt.length]); // aquecimento (JIT)
    const tempos: number[] = [];
    for (let k = 0; k < 100; k++) {
      const t0 = performance.now();
      rodada(alt[k % alt.length]);
      tempos.push(performance.now() - t0);
    }
    tempos.sort((a, b) => a - b);
    const med = tempos[50];
    console.log(
      `calcular() + ${refs.length} células: mediana ${med.toFixed(2)} ms, ` +
        `mín ${tempos[0].toFixed(2)} ms, p95 ${tempos[95].toFixed(2)} ms`,
    );
    expect(med).toBeLessThan(30);
  });
});
