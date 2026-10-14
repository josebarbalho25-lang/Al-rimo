/*
  A logomarca tem UM desenho (ui/Marca.tsx); os SVG de public/marca repetem os números para a aba do navegador e o
  instalador. Este teste pega o dia em que alguém mexe num e esquece o outro.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AZUL_DA_MARCA, TRACOS_DA_MARCA } from './Marca';

describe('logomarca', () => {
  for (const arquivo of ['alrimo.svg', 'icone.svg']) {
    it(`public/marca/${arquivo} tem os mesmos traços e a mesma cor`, () => {
      const svg = readFileSync(new URL(`../../public/marca/${arquivo}`, import.meta.url), 'utf8');
      const linhas = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"\/>/g)].map((m) => m.slice(1).map(Number));
      expect(linhas).toEqual(TRACOS_DA_MARCA.map((t) => [...t]));
      expect(svg).toContain(`fill="${AZUL_DA_MARCA}"`);
    });
  }
});
