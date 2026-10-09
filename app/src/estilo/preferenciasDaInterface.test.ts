// As preferências da máquina sem tela. O defeito que isto guarda: o padrão de
// fábrica subiu (110% → 120%, 09/10) e quem já tinha clicado no botão de tema
// continuava a 110%, porque a v1 gravava o objeto INTEIRO a cada clique.
// Cada teste "recarrega a página" (módulo novo) com um navegador de mentira.
import { afterEach, describe, expect, it, vi } from 'vitest';

function armazenamento(m: Map<string, string>) {
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
}

// O mínimo de documento que `aplicarPreferencias` toca.
function documento() {
  const nada = () => {};
  return {
    documentElement: { style: { setProperty: nada } },
    body: { dataset: {} as Record<string, string>, style: { setProperty: nada, removeProperty: nada } },
  };
}

async function abrir(m: Map<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documento() });
  vi.resetModules();
  return import('./preferenciasDaInterface');
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
  delete (globalThis as Record<string, unknown>).document;
});

describe('preferências da interface', () => {
  it('máquina nova: o padrão de fábrica, a 120%', async () => {
    const p = await abrir(new Map());
    expect(p.preferenciasAtuais()).toEqual(p.PADRAO);
    expect(p.PADRAO.escala).toBe(1.2);
  });

  it('a v1 gravada pelo botão de tema não trava o tamanho novo; só o tema migra', async () => {
    const m = new Map([
      [
        'alrimo.interface.v1',
        '{"escala":1.1,"tema":"modern","densidade":"cozy","corSelecao":null,"corPreSelecao":null,"corAlerta":null}',
      ],
    ]);
    const p = await abrir(m);
    const a = p.preferenciasAtuais();
    expect(a.escala).toBe(1.2);
    expect(a.tema).toBe('modern');
    expect(m.has('alrimo.interface.v1')).toBe(false);
    expect(JSON.parse(m.get('alrimo.interface.v2')!)).toEqual({ tema: 'modern' });
  });

  it('o navegador guarda só o que foi escolhido: trocar o tema não grava tamanho', async () => {
    const m = new Map<string, string>();
    const p = await abrir(m);
    p.definirPreferencia('tema', 'paper');
    expect(JSON.parse(m.get('alrimo.interface.v2')!)).toEqual({ tema: 'paper' });
    p.definirPreferencia('escala', 1.4);
    const recarregado = await abrir(m);
    expect(recarregado.preferenciasAtuais()).toMatchObject({ tema: 'paper', escala: 1.4, densidade: 'cozy' });
  });

  it('campo estragado cai no padrão sem levar os outros', async () => {
    const p = await abrir(new Map([['alrimo.interface.v2', '{"escala":"grande","tema":"papel","densidade":"compact","corAlerta":"vermelho"}']]));
    expect(p.preferenciasAtuais()).toEqual({ ...p.PADRAO, densidade: 'compact' });
  });

  it('restaurar as cores apaga só as cores', async () => {
    const m = new Map<string, string>();
    const p = await abrir(m);
    p.definirPreferencia('escala', 1.1);
    p.definirPreferencia('corSelecao', '#ff0000');
    expect(p.restaurarCores()).toMatchObject({ escala: 1.1, corSelecao: null });
    expect(JSON.parse(m.get('alrimo.interface.v2')!)).toEqual({ escala: 1.1 });
  });

  it('o padrão está entre os degraus oferecidos (o botão dele aparece aceso)', async () => {
    const p = await abrir(new Map());
    expect(p.ESCALAS).toContain(p.PADRAO.escala);
  });
});
