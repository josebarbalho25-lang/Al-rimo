// O aviso da coesão na TELA: a placa ao lado do campo c' e o "1 aviso" da barra.
// Sem jsdom: a tela é desenhada em texto (react-dom/server), como no teste do
// rosto do memorial. O desenho no servidor lê o estado INICIAL do store, então
// o muro com c' > 0 chega como chega o do F5 — pelo último projeto guardado.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

function armazenamento(m: Map<string, string>) {
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

async function abrirApp(m: Map<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  vi.resetModules();
  const store = await import('@/estado/store');
  const lembrete = await import('@/estado/lembrete');
  const { BarraDeEstado } = await import('./BarraDeEstado');
  const { PainelDeEntradas } = await import('./PainelDeEntradas');
  return { ...store, ...lembrete, BarraDeEstado, PainelDeEntradas };
}

/** O muro com c' = `c`, reaberto (F5) com a seção do solo aberta no painel. */
async function muroComCoesao(c: number) {
  const m = new Map<string, string>();
  let app = await abrirApp(m);
  app.lembrarUltimoProjeto();
  app.useApp.getState().definir('c_solo', c);
  app.guardar(app.CHAVES.grupos, { solo: true });
  app = await abrirApp(m);
  return app;
}

// O React escreve o texto dos atributos escapado (c&#x27; &gt; 0…).
const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('aviso da coesão no estado', () => {
  it("c' > 0 acende, c' = 0 apaga — com o texto da célula aviso_coesao", async () => {
    const app = await abrirApp(new Map());
    expect(app.useApp.getState().avisosDaConta).toEqual([]);
    app.useApp.getState().definir('c_solo', 8);
    const s = app.useApp.getState();
    expect(s.avisosDaConta).toEqual([{ nome: 'aviso_coesao', campo: 'c_solo', texto: s.resultado?.v('aviso_coesao') }]);
    app.useApp.getState().definir('c_solo', 0);
    expect(app.useApp.getState().avisosDaConta).toEqual([]);
  });
});

describe('aviso da coesão na tela', () => {
  it("c' = 0: sem placa no campo e sem aviso na barra", async () => {
    const app = await muroComCoesao(0);
    const painel = renderToStaticMarkup(<app.PainelDeEntradas />);
    const barra = renderToStaticMarkup(<app.BarraDeEstado />);
    expect(painel).toContain('aria-label="Coesão c&#x27;"'); // a seção do solo está aberta: o campo está lá
    expect(painel).not.toContain('class="aviso"');
    expect(barra).not.toMatch(/avisos?</);
  });

  it("c' > 0: a placa ao lado do campo e \"1 aviso\" na barra, o texto só no pairar", async () => {
    const app = await muroComCoesao(10);
    const texto = app.useApp.getState().resultado?.v('aviso_coesao');
    expect(typeof texto).toBe('string');
    const t = escapar(String(texto));

    const painel = renderToStaticMarkup(<app.PainelDeEntradas />);
    expect(painel).toContain(`<span class="aviso" role="img" aria-label="${t}" title="${t}">`);
    // uma placa só, e nenhuma frase solta no painel: o texto aparece só dentro dos atributos
    expect(painel.split('class="aviso"').length - 1).toBe(1);
    expect(painel.split(t).length - 1).toBe(2);

    const barra = renderToStaticMarkup(<app.BarraDeEstado />);
    expect(barra).toContain(`title="${t}"`);
    expect(barra).toContain('<span class="valor">1</span> aviso');
  });
});
