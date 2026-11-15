// Os Recentes do Início (15/11, o padrão do Pró-Viga): a conta da lista, a ficha do cartão e o caminho pelo
// programa instalado (a ponte de mentira guarda como o main guardaria). E o item que veio junto: o muro lembrado que
// não mudou desde o salvar volta SALVO ao reabrir o programa (acoesDeArquivo.ts, retomarOArquivo).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contagemDeArquivos, dataEHora, emOrdem, MAX_RECENTES, promover, semOsSumidos, chaveDoCaminho } from './recentes';
import { linhaDoRecente, numeroBR, resumoDoMuro } from './resumoDoMuro';
import type { RecenteDoPrograma } from './programa';

describe('a conta da lista', () => {
  const r = (chave: string, quando: number) => ({ chave, quando });

  it('o mais novo primeiro, sem repetidos, no teto de 12', () => {
    let l: { chave: string; quando: number }[] = [];
    for (let i = 0; i < 20; i++) l = promover(l, r(`m${i}`, i));
    expect(l).toHaveLength(MAX_RECENTES);
    expect(l[0].chave).toBe('m19');
    l = promover(l, r('m15', 99));
    expect(l.map((x) => x.chave).slice(0, 3)).toEqual(['m15', 'm19', 'm18']);
    expect(l.filter((x) => x.chave === 'm15')).toHaveLength(1);
  });

  it('em ordem pela hora, um por chave', () => {
    expect(emOrdem([r('a', 1), r('b', 3), r('a', 2), r('c', 0)]).map((x) => x.chave)).toEqual(['b', 'a', 'c']);
  });

  it('o mesmo arquivo escrito de dois jeitos é a mesma chave', () => {
    expect(chaveDoCaminho('C:/Obra/Muro A.alrimo')).toBe(chaveDoCaminho('c:\\OBRA\\muro a.alrimo'));
  });

  it('os que sumiram saem', () => {
    expect(semOsSumidos([r('a', 1), r('b', 2)], (x) => x.chave === 'b').map((x) => x.chave)).toEqual(['b']);
  });

  it('data, hora e a contagem', () => {
    expect(dataEHora(new Date(2026, 10, 15, 18, 4).getTime())).toBe('15/11/2026, 18:04');
    expect(contagemDeArquivos(0)).toBe('');
    expect(contagemDeArquivos(1)).toBe('1 arquivo');
    expect(contagemDeArquivos(3)).toBe('3 arquivos');
  });
});

describe('a ficha do muro (cartão e barra de estado)', () => {
  const ler = (v: Record<string, number | string | null>) => (n: string) => (n in v ? v[n] : null);

  it('balanço: tipo, bloco e altura', () => {
    const l = ler({ Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6, B_sap: 1.4, h_sap: 0.45 });
    expect(linhaDoRecente(l)).toBe('Balanço · bloco 19×39 · h 1,60 m');
    expect(resumoDoMuro(l, { comprimento: 6, vaoDosContrafortes: null })).toEqual([
      { k: 'Muro', v: 'Balanço · bloco 19×39' },
      { k: 'Altura', v: 'muro 1,60 · solo 1,60 m' },
      { k: 'Comprimento', v: '6,00 m' },
      { k: 'Sapata', v: 'B 1,40 · h 0,45 m' },
    ]);
  });

  it('contrafortes: o espaçamento entra antes do comprimento', () => {
    const l = ler({ Tipo_muro: 'Contrafortes', t_bloco: 14, H_muro: 2.6, H_solo: 2.4, B_sap: 1.8, h_sap: 0.4, l_cf: 1.4 });
    const p = resumoDoMuro(l, { comprimento: 8.35, vaoDosContrafortes: 1.35 });
    expect(p.map((x) => x.k)).toEqual(['Muro', 'Altura', 'Contrafortes', 'Comprimento', 'Sapata']);
    expect(p[2].v).toBe('a cada 1,35 m');
  });

  it('dado em branco (o Novo) vira traço, não "NaN"', () => {
    expect(linhaDoRecente(ler({ Tipo_muro: 'Balanço', t_bloco: 19 }))).toBe('Balanço · bloco 19×39 · h — m');
    expect(numeroBR(Number.NaN)).toBe('—');
  });
});

/* ── pelo programa instalado ───────────────────────────────────────────── */

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

/** A ponte de mentira: o disco é um Map de caminho → texto; os recentes, uma lista como a do main. */
function ponteDeMentira() {
  const disco = new Map<string, string>();
  let lista: RecenteDoPrograma[] = [];
  let relogio = 1000;
  const chamadas: string[] = [];
  const ponte = {
    disco,
    chamadas,
    abrirProjeto: async () => null,
    escolherDestino: async (nome: string) => ({ caminho: `C:\\obra\\${nome}`, nome }),
    lerArquivo: async (c: string) => {
      const t = disco.get(c);
      if (t === undefined) throw new Error('ENOENT');
      return t;
    },
    gravarArquivo: async (c: string, t: string) => void disco.set(c, t),
    gravarPdf: async () => null,
    aoAbrirArquivo: () => {},
    pronto: () => void chamadas.push('pronto'),
    informarEstado: () => {},
    aoPedirSalvarEFechar: () => {},
    fechar: () => {},
    recentes: async () => (lista = lista.filter((r) => disco.has(r.caminho))),
    lembrarRecente: async (e: { caminho: string; nome: string; resumo: string; miniatura?: string | null }) => {
      const antes = lista.find((r) => r.caminho === e.caminho);
      lista = [
        { caminho: e.caminho, nome: e.nome, resumo: e.resumo, quando: ++relogio, miniatura: e.miniatura !== undefined ? e.miniatura : (antes?.miniatura ?? null) },
        ...lista.filter((r) => r.caminho !== e.caminho),
      ];
      return lista;
    },
    esquecerRecente: async (c: string) => (lista = lista.filter((r) => r.caminho !== c)),
  };
  return ponte;
}

async function abrirPrograma(m: Map<string, string>, ponte: ReturnType<typeof ponteDeMentira>) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  (globalThis as { alrimoPrograma?: unknown }).alrimoPrograma = ponte;
  vi.resetModules();
  const store = await import('./store');
  const acoes = await import('./acoesDeArquivo');
  const recentes = await import('./recentes');
  store.lembrarUltimoProjeto();
  return { ...store, ...acoes, ...recentes };
}

const esperar = () => new Promise((ok) => setTimeout(ok, 0));

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
  delete (globalThis as Record<string, unknown>).alrimoPrograma;
});

describe('os Recentes pelo programa instalado', () => {
  it('salvar e abrir sobem na lista, com a ficha; arquivo que sumiu sai ao clicar', async () => {
    const m = new Map<string, string>();
    const ponte = ponteDeMentira();
    const app = await abrirPrograma(m, ponte);
    await app.carregarRecentes();
    expect(app.useRecentes.getState().disponivel).toBe(true);

    app.abrirExemplo();
    await app.salvarProjeto();
    await esperar();
    let lista = app.useRecentes.getState().lista;
    expect(lista).toHaveLength(1);
    expect(lista[0].chave).toMatch(/\.alrimo$/);
    expect(lista[0].resumo).toBe('Balanço · bloco 19×39 · h 1,60 m');

    // outro nome: dois recentes, o último primeiro
    await app.salvarProjeto(true);
    await esperar();
    lista = app.useRecentes.getState().lista;
    expect(lista).toHaveLength(1); // o "Salvar como" sugere o mesmo nome: o mesmo arquivo

    ponte.escolherDestino = async () => ({ caminho: 'C:\\obra\\Outro.alrimo', nome: 'Outro.alrimo' });
    await app.salvarProjeto(true);
    await esperar();
    lista = app.useRecentes.getState().lista;
    expect(lista.map((r) => r.nome)).toEqual(['Outro.alrimo', 'Exemplo — muro em balanço.alrimo']);

    // o arquivo de baixo é apagado por fora: clicar nele avisa e tira da lista
    const velho = lista[1];
    ponte.disco.delete(velho.chave);
    await app.abrirRecente(velho.chave, velho.nome);
    await esperar();
    expect(app.useApp.getState().recado).toMatch(/não encontrado/);
    expect(app.useRecentes.getState().lista.map((r) => r.nome)).toEqual(['Outro.alrimo']);
  });

  it('abrir um recente põe o muro na tela com a alça: o Ctrl+S grava no mesmo arquivo', async () => {
    const m = new Map<string, string>();
    const ponte = ponteDeMentira();
    const app = await abrirPrograma(m, ponte);
    app.abrirExemplo();
    app.useApp.getState().definir('H_muro', 2.2);
    await app.salvarProjeto();
    const caminho = [...ponte.disco.keys()][0];
    app.novoProjeto();
    await app.abrirRecente(caminho, 'x');
    expect(app.useApp.getState().resultado?.num('H_muro')).toBe(2.2);
    expect(app.useApp.getState().sujo).toBe(false);
    app.useApp.getState().definir('H_muro', 2.4);
    ponte.escolherDestino = async () => {
      throw new Error('não devia perguntar onde');
    };
    await app.salvarProjeto();
    expect(JSON.parse(ponte.disco.get(caminho)!).alteracoes.H_muro).toBe(2.4);
  });
});

describe('o muro lembrado ao reabrir o programa (item de 15/11)', () => {
  it('sem mudança desde o salvar, volta SALVO mesmo se o "salvo" não chegou ao lembrete', async () => {
    const m = new Map<string, string>();
    const ponte = ponteDeMentira();
    let app = await abrirPrograma(m, ponte);
    app.abrirExemplo();
    app.useApp.getState().definir('H_muro', 2.2);
    const comAlteracao = m.get('alrimo.ultimo.v1')!; // o lembrete com o • (antes do Ctrl+S)
    await app.salvarProjeto();
    expect(app.useApp.getState().sujo).toBe(false);
    // o programa fecha logo depois do Ctrl+S e o armazenamento da página não grava a última vez
    m.set('alrimo.ultimo.v1', JSON.stringify({ ...JSON.parse(comAlteracao), arquivo: app.useApp.getState().arquivo }));

    app = await abrirPrograma(m, ponte);
    expect(app.useApp.getState().sujo).toBe(true);
    await app.retomarOArquivo();
    expect(app.useApp.getState().sujo).toBe(false);
    // e a alça voltou: o Ctrl+S grava no mesmo caminho, sem perguntar onde
    ponte.escolherDestino = async () => {
      throw new Error('não devia perguntar onde');
    };
    app.useApp.getState().definir('H_muro', 2.4);
    await app.salvarProjeto();
    expect([...ponte.disco.keys()]).toHaveLength(1);
  });

  it('com alteração de verdade depois do salvar ("Não salvar" ao fechar), continua com o •', async () => {
    const m = new Map<string, string>();
    const ponte = ponteDeMentira();
    let app = await abrirPrograma(m, ponte);
    app.abrirExemplo();
    await app.salvarProjeto();
    app.useApp.getState().definir('H_muro', 2.2);
    app = await abrirPrograma(m, ponte);
    await app.retomarOArquivo();
    expect(app.useApp.getState().sujo).toBe(true);
    expect(app.useApp.getState().resultado?.num('H_muro')).toBe(2.2);
  });

  it('muro nunca salvo fica como está; arquivo apagado também', async () => {
    const m = new Map<string, string>();
    const ponte = ponteDeMentira();
    let app = await abrirPrograma(m, ponte);
    app.abrirExemplo();
    app.useApp.getState().definir('H_muro', 2.2);
    app = await abrirPrograma(m, ponte);
    await app.retomarOArquivo();
    expect(app.useApp.getState().arquivo).toBeNull();
    expect(app.useApp.getState().sujo).toBe(true);

    vi.stubGlobal('window', { confirm: () => true }); // "abrir o exemplo mesmo assim?" — sim
    app.abrirExemplo();
    vi.unstubAllGlobals();
    await app.salvarProjeto();
    app.useApp.getState().definir('H_muro', 2.4);
    ponte.disco.clear();
    app = await abrirPrograma(m, ponte);
    await app.retomarOArquivo();
    expect(app.useApp.getState().sujo).toBe(true);
  });
});
