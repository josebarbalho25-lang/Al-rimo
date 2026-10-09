/*
  PROVAS VISUAIS — grava os SVG dos desenhos numa pasta para virar PNG e ser olhado (Chrome sem janela).
  Só roda com DES_PROVAS=<pasta>; no `vitest run` comum é pulado (não suja disco de ninguém).
  Casos: os modelos de exemplo, as duas aulas e um sorteio de cada família × tipo de muro.
*/
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { corteLateral, cortesPadrao, isometrico, planta, vistaFrontal } from '../index';
import { modeloDeExemplo } from './modeloDeExemplo';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Modelo } from '@/modelo/tipos';

const PASTA = process.env.DES_PROVAS;

describe.skipIf(!PASTA)('provas visuais dos desenhos', () => {
  it('grava os SVG', async () => {
    // importada na hora: com a modulação em obra, as provas saem só com os modelos de exemplo
    const mod = await import('@/modulacao').catch(() => null);
    mkdirSync(PASTA!, { recursive: true });
    const casos: Record<string, Modelo> = {
      balanco: modeloDeExemplo({ tipo: 'balanco', H_solo: 1500, juntaNaCelula: 13, terreno: true }),
      cf: modeloDeExemplo({ tipo: 'contrafortes' }),
      cfap: modeloDeExemplo({ tipo: 'contrafortes', aparente: true, celulasPorVao: 10, tenr: 590 }),
    };
    const vistos = new Set<string>();
    for (const c of mod ? cenariosDoGabarito() : []) {
      let m: Modelo;
      try {
        m = mod!.gerarModelo(resultadoDoGabarito(c), mod!.padroesDoModelo());
      } catch {
        continue;
      }
      const chave = c.startsWith('aula') ? c : `${m.familia.nome}|${m.dims.contrafortes.length ? 'cf' : 'bal'}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      casos[`mod_${c}`] = m;
    }
    // índice: quem olha os PNG precisa saber qual cenário é qual família e tipo de muro sem abrir o gabarito
    writeFileSync(
      join(PASTA!, 'indice.txt'),
      Object.entries(casos)
        .map(([nome, m]) => `${nome}\t${m.familia.nome}\t${m.dims.contrafortes.length ? 'contrafortes' : 'balanço'}\t${m.dims.n_fiadas} fiadas\tL ${m.dims.L_real}`)
        .join('\n') + '\n',
    );
    for (const [nome, m] of Object.entries(casos)) {
      writeFileSync(join(PASTA!, `${nome}_frontal.svg`), vistaFrontal(m));
      writeFileSync(join(PASTA!, `${nome}_planta.svg`), planta(m));
      cortesPadrao(m).forEach((c, k) => writeFileSync(join(PASTA!, `${nome}_corte${k}.svg`), corteLateral(m, c.x)));
      writeFileSync(join(PASTA!, `${nome}_iso.svg`), isometrico(m));
      writeFileSync(join(PASTA!, `${nome}_isofundo.svg`), isometrico(m, { vista: 'fundo-esquerda' }));
      writeFileSync(join(PASTA!, `${nome}_isocorte.svg`), isometrico(m, { corteX: cortesPadrao(m)[0].x }));
    }
  });
});
