/*
  A linha do "l" na Geometria (Jose, 12/10): com contrafortes ela É o espaçamento entre contrafortes — a lista dos
  vãos que amarram com o bloco e o valor de verdade —, e escolher nela muda o espaçamento (o 3D refaz). No balanço
  ela é o comprimento do muro. Desenhada como o painel desenha, pelo mesmo hook.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { Valor } from '@/motor/tipos';

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

async function abrir(valores: Record<string, Valor>) {
  // O desenho no servidor (renderToString) lê o estado INICIAL do store: os valores entram como o último muro da
  // aba e o app "recarrega" (F5) — como no store.test.
  const m = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  vi.resetModules();
  const antes = await import('@/estado/store');
  antes.lembrarUltimoProjeto();
  for (const [k, v] of Object.entries(valores)) antes.useApp.getState().definir(k, v);
  vi.resetModules();
  const store = await import('@/estado/store');
  const painel = await import('./PainelDeEntradas');
  let definido: { nome: string; v: Valor } | null = null;
  function Linha() {
    const { propsDaLinha } = painel.useLinhasDeEntrada();
    const p = propsDaLinha(store.CAMPOS.get('l_trav')!);
    definido = null;
    return (
      <painel.LinhaDeEntrada
        {...p}
        definir={(nome, v) => (definido = { nome, v })}
        figuraAberta={false}
        abrirFigura={() => {}}
      />
    );
  }
  return { html: renderToString(<Linha />), escolhido: () => definido, store };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

const opcoesDoHtml = (html: string) => [...html.matchAll(/<option value="\d+"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);

describe('a linha do "l" na Geometria', () => {
  it('contrafortes, bloco 14: é o espaçamento, com a lista dos vãos que amarram e o valor escolhido', async () => {
    const { html } = await abrir({ Tipo_muro: 'Contrafortes', t_bloco: 14, l_cf: 2.15 });
    expect(html).toContain('Entre contrafortes l');
    expect(html).toContain('data-campo="l_cf"');
    expect(opcoesDoHtml(html)).toEqual(['0,95', '1,35', '1,75', '2,15', '2,55', '2,95', '3,35', '3,75']);
    expect(html).toMatch(/<select[^>]*>/);
    // o selecionado é o 2,15 (posição 3 da lista)
    expect(html).toMatch(/<option value="3" selected=""/);
    expect(html).not.toContain('apagada');
  });

  it('contrafortes, bloco 19: de 20 em 20 cm, 0,80 a 4,00', async () => {
    const { html } = await abrir({ Tipo_muro: 'Contrafortes' });
    const o = opcoesDoHtml(html);
    // os rótulos da lista saem como a planilha escreve o número (0,8 … 4), como nas outras listas
    expect(o[0]).toBe('0,8');
    expect(o[o.length - 1]).toBe('4');
    expect(o.length).toBe(17);
  });

  it('balanço: é o comprimento do muro, apagado sem travamento lateral', async () => {
    const sem = await abrir({});
    expect(sem.html).toContain('Comprimento do muro l');
    expect(sem.html).toContain('data-campo="L_total"');
    expect(sem.html).toContain('apagada');
    const com = await abrir({ Trav_lat: 'Sim' });
    expect(com.html).not.toContain('apagada');
  });
});
