// A barra própria do programa instalado: o Electron só aceita cor em #rrggbb, e o navegador devolve rgb(...).
// Sem a ponte (navegador) não há barra própria — nada muda no app da web.
import { afterEach, describe, expect, it } from 'vitest';
import { corHex, temBarraPropria } from './barraDaJanela';

afterEach(() => {
  delete (globalThis as Record<string, unknown>).alrimoPrograma;
});

describe('barra da janela', () => {
  it('rgb() e rgba() do getComputedStyle viram #rrggbb', () => {
    expect(corHex('rgb(23, 23, 27)')).toBe('#17171b');
    expect(corHex('rgba(255, 255, 255, 1)')).toBe('#ffffff');
    expect(corHex(' #0e1424 ')).toBe('#0e1424');
  });

  it('no navegador não há barra própria; no programa de antes de 15/11 (sem barraDaJanela) também não', () => {
    expect(temBarraPropria()).toBe(false);
    (globalThis as Record<string, unknown>).alrimoPrograma = { pronto() {} };
    expect(temBarraPropria()).toBe(false);
    (globalThis as Record<string, unknown>).alrimoPrograma = { pronto() {}, barraDaJanela() {} };
    expect(temBarraPropria()).toBe(true);
  });
});
