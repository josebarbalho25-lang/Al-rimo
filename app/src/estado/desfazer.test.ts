/*
  DESFAZER E A SEÇÃO DO TRILHO (Jose, 20/10: a organização do Pró-Viga) — o que quebraria:
  - o Ctrl+Z não voltar a conta junto (a tela mostrar o número antigo com o muro novo);
  - cada tecla de "0,45" virar um passo (três Ctrl+Z para desfazer um número);
  - o Ctrl+Z atravessar de um muro para outro (desfazer o Abrir);
  - mexer depois de desfazer e o refazer trazer de volta o que foi descartado;
  - reescolher o mesmo valor virar passo vazio;
  - a mexida nas pranchas ficar de fora;
  - quem tinha a Memória ou o Quantitativo aberto (abas até 20/10) abrir na seção errada.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';

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

async function abrirApp(m = new Map<string, string>()) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  vi.resetModules();
  const store = await import('./store');
  const interfaceDoApp = await import('./interface');
  return { ...store, ...interfaceDoApp };
}

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).localStorage;
});

const altura = (app: Awaited<ReturnType<typeof abrirApp>>) => app.useApp.getState().resultado?.num('H_muro');

describe('desfazer e refazer', () => {
  it('volta a entrada e a conta; refazer leva de novo', async () => {
    const app = await abrirApp();
    const antes = altura(app);
    expect(app.useApp.getState().podeDesfazer).toBe(false);
    app.useApp.getState().definir('H_muro', 2.2);
    expect(altura(app)).toBe(2.2);
    expect(app.useApp.getState().podeDesfazer).toBe(true);
    app.useApp.getState().desfazer();
    expect(altura(app)).toBe(antes);
    expect(app.useApp.getState().podeDesfazer).toBe(false);
    expect(app.useApp.getState().podeRefazer).toBe(true);
    app.useApp.getState().refazer();
    expect(altura(app)).toBe(2.2);
    expect(app.useApp.getState().podeRefazer).toBe(false);
  });

  it('teclas seguidas no mesmo campo são um passo; campo diferente ou mão parada, outro', async () => {
    vi.useFakeTimers();
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    const b0 = s().alteracoes.B_sap;
    s().definir('B_sap', 1.5);
    vi.advanceTimersByTime(200);
    s().definir('B_sap', 1.55);
    s().definir('H_muro', 2.2);
    vi.advanceTimersByTime(5000);
    s().definir('H_muro', 2.4);
    s().desfazer(); // a 2ª mexida no H_muro, depois de parar
    expect(s().resultado?.num('H_muro')).toBe(2.2);
    s().desfazer(); // o H_muro inteiro
    expect(s().alteracoes.H_muro).not.toBe(2.2);
    expect(s().alteracoes.B_sap).toBe(1.55);
    s().desfazer(); // as duas teclas do B de uma vez
    expect(s().alteracoes.B_sap).toBe(b0);
    expect(s().podeDesfazer).toBe(false);
  });

  it('mexer depois de desfazer descarta o refazer; reescolher o mesmo valor não é passo', async () => {
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    s().definir('H_muro', 2.2);
    s().desfazer();
    s().definir('B_sap', 1.5);
    expect(s().podeRefazer).toBe(false);
    const tipo = app.leitorDoEstado(s())('Tipo_muro');
    const passos = () => {
      let n = 0;
      while (s().podeDesfazer) {
        s().desfazer();
        n++;
      }
      return n;
    };
    // o tipo de muro que já está: nada a desfazer além do B
    expect(tipo).not.toBeNull();
    s().definir('Tipo_muro', tipo!);
    expect(passos()).toBe(1);
  });

  it('a mexida nas pranchas é passo', async () => {
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    const antes = s().pranchas;
    s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, obra: 'Obra de teste' } }));
    expect(s().pranchas.obra.obra).toBe('Obra de teste');
    s().desfazer();
    expect(s().pranchas).toEqual(antes);
  });

  it('abrir outro muro zera os passos', async () => {
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    s().definir('H_muro', 2.2);
    s().carregar({ id: '0b9f3c1e-6a2d-4c8e-9f10-2a3b4c5d6e7f', titulo: 'Outro', alteracoes: {}, extras: {} }, null);
    expect(s().podeDesfazer).toBe(false);
    s().desfazer();
    expect(s().titulo).toBe('Outro');
    expect(s().alteracoes).toEqual({});
  });
});

describe('o que a revisão de 20/10 achou', () => {
  it('desfazer até o que está salvo apaga o •; refazer acende de novo', async () => {
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    s().marcarSalvo('Muro.alrimo', 'Muro', app.projetoAtual(s()));
    expect(s().sujo).toBe(false);
    s().definir('H_muro', 2.2);
    expect(s().sujo).toBe(true);
    s().desfazer();
    expect(s().sujo).toBe(false);
    s().refazer();
    expect(s().sujo).toBe(true);
  });

  it('muro aberto do disco: desfazer até ele apaga o •', async () => {
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    s().carregar({ id: '0b9f3c1e-6a2d-4c8e-9f10-2a3b4c5d6e7f', titulo: 'X', alteracoes: { H_muro: 2.2 }, extras: {} }, 'X.alrimo');
    s().definir('H_muro', 2.4);
    s().desfazer();
    expect(s().sujo).toBe(false);
  });

  it('nas pranchas, mexidas separadas por mais que uma rajada são passos separados', async () => {
    vi.useFakeTimers();
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, obra: 'O' } }));
    vi.advanceTimersByTime(100);
    s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, obra: 'Ob' } })); // a mesma rajada (digitando)
    vi.advanceTimersByTime(800);
    s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, desenhista: 'D' } }));
    s().desfazer();
    expect(s().pranchas.obra.obra).toBe('Ob');
    expect(s().pranchas.obra.desenhista).not.toBe('D');
    expect(s().podeDesfazer).toBe(true);
    s().desfazer();
    expect(s().pranchas.obra.obra).not.toBe('Ob');
    expect(s().podeDesfazer).toBe(false);
  });

  it('a janela de Gráficos: tudo o que uma abertura mexe é um passo; o Cancelar não deixa passo', async () => {
    vi.useFakeTimers();
    const app = await abrirApp();
    const s = () => app.useApp.getState();
    const antes = s().pranchas;
    const mexer = (obra: string) => s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, obra } }), { passo: 'graficos:1' });
    mexer('cor A');
    vi.advanceTimersByTime(5000);
    mexer('cor B');
    s().desfazer();
    expect(s().pranchas).toEqual(antes);
    expect(s().podeDesfazer).toBe(false);
    // de novo, e agora Cancelar: o "antes" volta e nenhum passo fica
    s().mudarPranchas((p) => ({ ...p, obra: { ...p.obra, obra: 'cor C' } }), { passo: 'graficos:2' });
    s().mudarPranchas(() => antes, { passo: 'graficos:2' });
    expect(s().podeDesfazer).toBe(false);
    expect(s().pranchas).toEqual(antes);
  });

  it('o Ctrl+Z é do campo só onde se digita', async () => {
    const { ehCampoDeTexto } = await import('@/ui/teclado');
    expect(ehCampoDeTexto({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(ehCampoDeTexto({ tagName: 'INPUT' })).toBe(true);
    expect(ehCampoDeTexto({ tagName: 'TEXTAREA' })).toBe(true);
    expect(ehCampoDeTexto({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(ehCampoDeTexto({ tagName: 'SELECT' })).toBe(false);
    expect(ehCampoDeTexto({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(ehCampoDeTexto({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(ehCampoDeTexto({ tagName: 'BUTTON' })).toBe(false);
    expect(ehCampoDeTexto(null)).toBe(false);
  });
});

describe('a seção do trilho', () => {
  it('sem seção lembrada, abre na Gráfica; com a Memória aberta antes de 20/10, na Memória', async () => {
    expect((await abrirApp()).useInterface.getState().secao).toBe('grafica');
    expect((await abrirApp(new Map([['alrimo.aba.v1', '"memoria"']]))).useInterface.getState().secao).toBe('memoria');
    expect((await abrirApp(new Map([['alrimo.aba.v1', '"quantitativo"']]))).useInterface.getState().secao).toBe('quantitativo');
    expect((await abrirApp(new Map([['alrimo.aba.v1', '"corte"']]))).useInterface.getState().secao).toBe('grafica');
  });

  it('a seção escolhida volta no F5; seção estragada vira a Gráfica', async () => {
    const m = new Map<string, string>();
    (await abrirApp(m)).useInterface.getState().irPara('entradas');
    expect((await abrirApp(m)).useInterface.getState().secao).toBe('entradas');
    expect((await abrirApp(new Map([['alrimo.secao.v1', '"nada"']]))).useInterface.getState().secao).toBe('grafica');
  });

  it('o "Faltam N dados" abre as Entradas no campo; sair delas esquece o campo', async () => {
    const app = await abrirApp();
    const i = () => app.useInterface.getState();
    i().abrirNoCampo('B_sap');
    expect(i().secao).toBe('entradas');
    expect(i().campoInicial).toBe('B_sap');
    const pedido = i().pedidoDeCampo;
    i().abrirNoCampo('B_sap');
    expect(i().pedidoDeCampo).toBe(pedido + 1);
    i().irPara('memoria');
    expect(i().campoInicial).toBeNull();
  });
});
