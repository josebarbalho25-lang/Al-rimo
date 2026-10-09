// A identidade do muro de ponta a ponta: do Novo/Abrir/Salvar até os GUIDs do IFC que o botão baixa.
// O defeito que isto segura (revisão do IFC): os GUIDs saíam do TÍTULO — todo muro novo se chama "Sem título", então
// dois muros diferentes saíam com as mesmas peças no modelo federado, e renomear trocava todas as peças do vínculo.
// Cada teste "abre o app" (módulos novos) com um localStorage de mentira e o disco de mentira (estado/arquivo.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportarIfc as exportarIfcDeVerdade } from '@/ifc';
import { muroDeTeste } from '@/ifc/teste/muroDeTeste';

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

/** O disco: o que se baixou (IFC), o que se gravou (.alrimo) e o que o próximo Abrir vai ler. */
interface Disco {
  baixados: { conteudo: string; nome: string }[];
  gravados: { texto: string; nome: string }[];
  paraAbrir: { texto: string; nome: string } | null;
}

async function abrirApp(m: Map<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  vi.resetModules();
  const disco: Disco = { baixados: [], gravados: [], paraAbrir: null };
  vi.doMock('./arquivo', () => ({
    abrirDoDisco: async () => (disco.paraAbrir ? { ...disco.paraAbrir, alca: null } : null),
    salvarNoDisco: async (texto: string, nome: string) => {
      disco.gravados.push({ texto, nome });
      return { nome, alca: null };
    },
    baixar: (conteudo: string, nome: string) => void disco.baixados.push({ conteudo, nome }),
    foiCancelado: () => false,
  }));
  const store = await import('./store');
  const acoes = await import('./acoesDeArquivo');
  // o muro de teste do IFC no lugar da modulação (que outra frente está mexendo): aqui só importa a identidade
  store.useApp.getState().ligar({ gerador: () => muroDeTeste(), exportarIfc: exportarIfcDeVerdade });
  /** Exporta pelo botão e devolve os GUIDs do arquivo baixado, na ordem. */
  const guidsDoIfc = (): string[] => {
    const antes = disco.baixados.length;
    acoes.exportarIfc();
    expect(disco.baixados.length, String(store.useApp.getState().recado)).toBe(antes + 1);
    const t = disco.baixados[antes].conteudo;
    return [...t.matchAll(/=IFC[A-Z]+\('([0-3][0-9A-Za-z_$]{21})'/g)].map((x) => x[1]);
  };
  return { ...store, ...acoes, disco, guidsDoIfc };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
  vi.doUnmock('./arquivo');
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const arquivoSemId = (titulo: string) =>
  JSON.stringify({ formato: 'alrimo', versaoDoArquivo: 2, versaoDaConta: 'x', titulo, alteracoes: { H_muro: 2.2 }, extras: {} });

describe('dois muros novos não dividem GUID', () => {
  it('Novo → outra identidade → nenhum GUID em comum, mesmo os dois "Sem título"', async () => {
    const app = await abrirApp(new Map());
    const a = app.useApp.getState();
    expect(a.titulo).toBe('Sem título');
    expect(a.idDoProjeto).toMatch(UUID_V4);
    const g1 = app.guidsDoIfc();
    expect(g1.length).toBeGreaterThan(50);
    expect(new Set(g1).size).toBe(g1.length);

    app.novoProjeto();
    const b = app.useApp.getState();
    expect(b.titulo).toBe('Sem título');
    expect(b.idDoProjeto).toMatch(UUID_V4);
    expect(b.idDoProjeto).not.toBe(a.idDoProjeto);
    expect(b.sujo).toBe(false);
    const g2 = app.guidsDoIfc();
    expect(g2.filter((g) => g1.includes(g))).toEqual([]);
  });

  it('a primeira abertura em outra máquina (navegador vazio) também nasce com identidade própria', async () => {
    const a = await abrirApp(new Map());
    const g1 = a.guidsDoIfc();
    const b = await abrirApp(new Map());
    expect(b.useApp.getState().idDoProjeto).not.toBe(a.useApp.getState().idDoProjeto);
    expect(b.guidsDoIfc().filter((g) => g1.includes(g))).toEqual([]);
  });
});

describe('o mesmo muro guarda os GUIDs', () => {
  it('renomear (salvar com outro nome) não troca nenhum GUID', async () => {
    const app = await abrirApp(new Map());
    app.useApp.getState().definir('H_muro', 2.2);
    const antes = app.guidsDoIfc();
    const id = app.useApp.getState().idDoProjeto;
    app.useApp.getState().marcarSalvo('Muro da divisa.alrimo', 'Muro da divisa', app.projetoAtual(app.useApp.getState()));
    expect(app.useApp.getState().titulo).toBe('Muro da divisa');
    expect(app.useApp.getState().idDoProjeto).toBe(id);
    expect(app.guidsDoIfc()).toEqual(antes);
    // o nome novo vai no arquivo (IfcProject), só não nos GUIDs
    expect(app.disco.baixados.at(-1)!.nome).toBe('Muro da divisa.ifc');
    expect(app.disco.baixados.at(-1)!.conteudo).toContain("'Muro da divisa'");
  });

  it('salvar, abrir de novo (com outro nome de arquivo) e recarregar a página: os mesmos GUIDs', async () => {
    const m = new Map<string, string>();
    let app = await abrirApp(m);
    app.lembrarUltimoProjeto();
    const id = app.useApp.getState().idDoProjeto;
    const antes = app.guidsDoIfc();

    await app.salvarProjeto();
    const salvo = app.disco.gravados.at(-1)!;
    expect(JSON.parse(salvo.texto).id).toBe(id);

    // F5: o lembrete do navegador devolve a mesma identidade
    app = await abrirApp(m);
    expect(app.useApp.getState().idDoProjeto).toBe(id);
    expect(app.guidsDoIfc()).toEqual(antes);

    // o arquivo copiado/renomeado no Explorer e aberto: mesma identidade, nada a salvar
    app.disco.paraAbrir = { texto: salvo.texto, nome: 'Muro renomeado.alrimo' };
    app.novoProjeto();
    await app.abrirProjeto();
    const s = app.useApp.getState();
    expect(s.titulo).toBe('Muro renomeado');
    expect(s.idDoProjeto).toBe(id);
    expect(s.sujo).toBe(false);
    expect(app.guidsDoIfc()).toEqual(antes);
  });
});

describe('arquivo de antes da identidade', () => {
  it('ganha uma ao abrir, fica "não salvo", e depois de salvo a reabertura dá os mesmos GUIDs', async () => {
    const app = await abrirApp(new Map());
    app.disco.paraAbrir = { texto: arquivoSemId('Velho'), nome: 'Velho.alrimo' };
    await app.abrirProjeto();
    let s = app.useApp.getState();
    expect(s.arquivo).toBe('Velho.alrimo');
    expect(s.idDoProjeto).toMatch(UUID_V4);
    expect(s.sujo).toBe(true);
    const id = s.idDoProjeto;
    const g = app.guidsDoIfc();

    await app.salvarProjeto();
    expect(app.useApp.getState().sujo).toBe(false);
    const salvo = app.disco.gravados.at(-1)!;
    expect(JSON.parse(salvo.texto).id).toBe(id);

    app.disco.paraAbrir = { texto: salvo.texto, nome: 'Velho.alrimo' };
    await app.abrirProjeto();
    s = app.useApp.getState();
    expect(s.idDoProjeto).toBe(id);
    expect(s.sujo).toBe(false);
    expect(app.guidsDoIfc()).toEqual(g);
  });

  it('o último muro guardado no navegador antes da identidade: ganha uma, e o F5 seguinte a mantém', async () => {
    const m = new Map<string, string>();
    m.set('alrimo.ultimo.v1', JSON.stringify({ texto: arquivoSemId('Velho'), arquivo: 'Velho.alrimo', sujo: false }));
    let app = await abrirApp(m);
    app.lembrarUltimoProjeto();
    const s = app.useApp.getState();
    expect(s.idDoProjeto).toMatch(UUID_V4);
    // tem arquivo em disco, e o disco não tem a identidade: fica "não salvo"
    expect(s.sujo).toBe(true);
    app = await abrirApp(m);
    expect(app.useApp.getState().idDoProjeto).toBe(s.idDoProjeto);
  });

  it('muro só do navegador (sem arquivo, em branco) ganha identidade sem acender o "não salvo"', async () => {
    const m = new Map<string, string>();
    m.set('alrimo.ultimo.v1', JSON.stringify({ texto: arquivoSemId('Sem título'), arquivo: null, sujo: false }));
    const app = await abrirApp(m);
    expect(app.useApp.getState().idDoProjeto).toMatch(UUID_V4);
    expect(app.useApp.getState().sujo).toBe(false);
  });
});
