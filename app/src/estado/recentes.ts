// ═══════════════════════════════════════════════════════════════════════════
//  estado/recentes.ts — os RECENTES do Início (o padrão do Pró-Viga)
// ---------------------------------------------------------------------------
//  Jose, 15/11, comparando com o Pró-Viga: "ele deixa as vigas salvas por
//  último na tela inicial, olha a organização do negócio." Os últimos muros
//  abertos ou salvos, o mais novo primeiro, cada um com a foto do 3D Realista,
//  o nome do arquivo, a ficha curta e a data. Clique abre.
//
//  ONDE MORAM (nada vai dentro do .alrimo):
//   · programa instalado: no perfil do programa, pela ponte (o main sabe o
//     caminho de cada arquivo e tira da lista o que sumiu do disco);
//   · navegador com a janela de arquivo do sistema (Chrome/Edge): no IndexedDB,
//     com a ALÇA do arquivo — o navegador não abre por caminho, mas guarda a
//     alça, e ao clicar pede de novo a licença de ler e gravar (é ele que exige);
//   · outros navegadores (sem alça): não há como reabrir — o Início fica sem a
//     área dos Recentes.
//
//  A conta da lista (ordem, teto, repetidos, sumidos) é pura e testada; quem
//  guarda é a "loja" de cada caminho.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { Alca } from './arquivo';
import { alcaDoCaminho } from './arquivo';
import { ponteDoPrograma, type PonteDoPrograma, type RecenteDoPrograma } from './programa';
import { linhaDoRecente } from './resumoDoMuro';
import { leitorDoEstado, useApp } from './store';

/** O teto da lista (o do Pró-Viga). */
export const MAX_RECENTES = 12;

export interface Recente {
  /** Quem é: o caminho (programa) ou um número guardado com a alça (navegador). */
  chave: string;
  nome: string;
  resumo: string;
  quando: number;
  miniatura: string | null;
}

/* ── a conta da lista ──────────────────────────────────────────────────── */

/** O mesmo arquivo escrito de dois jeitos (barra, maiúscula — o Windows não distingue) é um recente só. */
export const chaveDoCaminho = (caminho: string): string => caminho.replace(/\//g, '\\').toLowerCase();

/** Põe `novo` no topo, tira o repetido (pela chave) e corta no teto. */
export function promover<T extends { chave: string }>(lista: readonly T[], novo: T, max = MAX_RECENTES): T[] {
  return [novo, ...lista.filter((r) => r.chave !== novo.chave)].slice(0, max);
}

/** O mais novo primeiro (o que foi aberto ou salvo por último), sem repetidos, no teto. */
export function emOrdem<T extends { chave: string; quando: number }>(lista: readonly T[], max = MAX_RECENTES): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const r of [...lista].sort((a, b) => b.quando - a.quando)) {
    if (vistos.has(r.chave)) continue;
    vistos.add(r.chave);
    out.push(r);
  }
  return out.slice(0, max);
}

/** Tira os que não existem mais (arquivo apagado ou movido). */
export function semOsSumidos<T>(lista: readonly T[], existe: (r: T) => boolean): T[] {
  return lista.filter((r) => existe(r));
}

/** "15/11/2026, 18:34" — a data do cartão do Pró-Viga. */
export function dataEHora(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "3 arquivos". */
export const contagemDeArquivos = (n: number): string => (n === 0 ? '' : n === 1 ? '1 arquivo' : `${n} arquivos`);

/* ── as lojas ──────────────────────────────────────────────────────────── */

export interface Lido {
  texto: string;
  nome: string;
  alca: Alca | null;
}

interface Loja {
  listar(): Promise<Recente[]>;
  lembrar(alca: Alca, nome: string, resumo: string, miniatura: string | null | undefined): Promise<Recente[]>;
  esquecer(chave: string): Promise<Recente[]>;
  /** Lê o arquivo do recente. Arquivo que sumiu: erro NotFoundError. Licença negada no navegador: null. */
  ler(chave: string): Promise<Lido | null>;
}

/* programa instalado: a ponte guarda tudo; aqui só se traduz */

const doPrograma = (r: RecenteDoPrograma): Recente => ({
  chave: r.caminho,
  nome: r.nome,
  resumo: r.resumo,
  quando: r.quando,
  miniatura: r.miniatura,
});

function lojaDoPrograma(ponte: Required<Pick<PonteDoPrograma, 'recentes' | 'lembrarRecente' | 'esquecerRecente'>> & PonteDoPrograma): Loja {
  const lista = async (p: Promise<RecenteDoPrograma[]>) => (await p).map(doPrograma);
  return {
    listar: () => lista(ponte.recentes()),
    lembrar: (alca, nome, resumo, miniatura) => {
      const caminho = (alca as Alca & { caminho?: string }).caminho;
      if (!caminho) return lista(ponte.recentes());
      return lista(ponte.lembrarRecente({ caminho, nome, resumo, ...(miniatura !== undefined ? { miniatura } : {}) }));
    },
    esquecer: (chave) => lista(ponte.esquecerRecente(chave)),
    ler: async (chave) => {
      let texto: string;
      try {
        texto = await ponte.lerArquivo(chave);
      } catch {
        // o main só responde que não leu; para quem chama, é o arquivo que não está mais lá
        throw new DOMException('arquivo não encontrado', 'NotFoundError');
      }
      const nome = chave.split(/[\\/]/).pop() ?? chave;
      return { texto, nome, alca: alcaDoCaminho(chave, nome) };
    },
  };
}

/* navegador: a alça do arquivo no IndexedDB */

interface AlcaComLicenca extends Alca {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface Guardado extends Recente {
  alca: AlcaComLicenca;
}

const BANCO = 'alrimo.recentes';
const GAVETA = 'recentes';

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const p = indexedDB.open(BANCO, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(GAVETA, { keyPath: 'chave' });
    p.onsuccess = () => ok(p.result);
    p.onerror = () => falha(p.error);
  });
}

async function naGaveta<T>(modo: IDBTransactionMode, f: (g: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T | undefined>((ok, falha) => {
      const t = banco.transaction(GAVETA, modo);
      const pedido = f(t.objectStore(GAVETA));
      t.oncomplete = () => ok(pedido ? pedido.result : undefined);
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error);
    });
  } finally {
    banco.close();
  }
}

const todosGuardados = async (): Promise<Guardado[]> => ((await naGaveta<Guardado[]>('readonly', (g) => g.getAll())) ?? []) as Guardado[];
const semAlca = ({ alca: _a, ...r }: Guardado): Recente => r;

function lojaDoNavegador(): Loja {
  const listar = async () => emOrdem(await todosGuardados()).map(semAlca);
  return {
    listar,
    lembrar: async (alca, nome, resumo, miniatura) => {
      const todos = await todosGuardados();
      // o mesmo arquivo é o mesmo recente: quem diz é a alça (dois arquivos podem ter o mesmo nome em pastas diferentes)
      let igual: Guardado | undefined;
      for (const g of todos) {
        try {
          if (await g.alca.isSameEntry?.(alca)) {
            igual = g;
            break;
          }
        } catch {
          /* alça velha: não é este */
        }
      }
      const novo: Guardado = {
        chave: igual?.chave ?? (globalThis.crypto?.randomUUID?.() ?? `r${Date.now()}${Math.random()}`),
        nome,
        resumo,
        quando: Date.now(),
        miniatura: miniatura === undefined ? (igual?.miniatura ?? null) : miniatura,
        alca: alca as AlcaComLicenca,
      };
      const ficam = emOrdem([novo, ...todos.filter((g) => g.chave !== novo.chave)]);
      const fora = todos.filter((g) => !ficam.some((f) => f.chave === g.chave));
      await naGaveta('readwrite', (g) => {
        g.put(novo);
        for (const f of fora) g.delete(f.chave);
      });
      return ficam.map(semAlca);
    },
    esquecer: async (chave) => {
      await naGaveta('readwrite', (g) => void g.delete(chave));
      return listar();
    },
    ler: async (chave) => {
      const g = (await todosGuardados()).find((x) => x.chave === chave);
      if (!g) throw new DOMException('arquivo não encontrado', 'NotFoundError');
      // a licença de um arquivo dura a sessão: depois de fechar o navegador, ele pergunta de novo (no clique)
      const modo = { mode: 'readwrite' } as const;
      if ((await g.alca.queryPermission?.(modo)) !== 'granted' && (await g.alca.requestPermission?.(modo)) !== 'granted') return null;
      const f = await g.alca.getFile();
      return { texto: await f.text(), nome: f.name, alca: g.alca };
    },
  };
}

/** A loja deste lugar, ou null (sem como reabrir: o Início fica sem os Recentes). */
function loja(): Loja | null {
  const ponte = ponteDoPrograma();
  if (ponte) {
    return ponte.recentes && ponte.lembrarRecente && ponte.esquecerRecente
      ? lojaDoPrograma(ponte as Parameters<typeof lojaDoPrograma>[0])
      : null;
  }
  const w = globalThis as { showOpenFilePicker?: unknown; indexedDB?: unknown };
  return typeof w.showOpenFilePicker === 'function' && !!w.indexedDB ? lojaDoNavegador() : null;
}

/* ── o estado da tela ──────────────────────────────────────────────────── */

interface EstadoDosRecentes {
  /** Há onde guardar e de onde reabrir (senão o Início esconde a área). */
  disponivel: boolean;
  lista: Recente[];
}

export const useRecentes = create<EstadoDosRecentes>(() => ({ disponivel: false, lista: [] }));

const publicar = (lista: Recente[]) => useRecentes.setState({ lista });

/** Lê a lista guardada (uma vez, ao abrir o app). */
export async function carregarRecentes(): Promise<void> {
  const l = loja();
  useRecentes.setState({ disponivel: l !== null });
  if (!l) return;
  try {
    publicar(await l.listar());
  } catch (e) {
    console.warn('recentes:', e);
  }
}

/*
  A FOTO DEPOIS. Abrir e salvar entram na lista NA HORA (com a foto de antes, se havia); a foto nova vem depois,
  fora da tela — o Realista compila sombreadores e não pode segurar o Ctrl+S. Uma por vez: salvar três vezes
  seguidas tira uma foto, a do último.
*/
let fotoEmCurso: Promise<void> | null = null;
let proximaFoto: (() => Promise<void>) | null = null;

function fotografarDepois(tirar: () => Promise<void>): void {
  if (fotoEmCurso) {
    proximaFoto = tirar;
    return;
  }
  fotoEmCurso = tirar()
    .catch((e) => console.warn('recentes (foto):', e))
    .finally(() => {
      fotoEmCurso = null;
      const p = proximaFoto;
      proximaFoto = null;
      if (p) fotografarDepois(p);
    });
}

/** O muro da tela acabou de ser aberto de `alca` ou salvo nela: vai para o topo dos Recentes. */
export function registrarRecente(alca: Alca, nome: string): void {
  const l = loja();
  if (!l) return;
  const s = useApp.getState();
  const resumo = linhaDoRecente(leitorDoEstado(s));
  const modelo = s.modelo;
  const carregamento = s.carregamento;
  void l
    .lembrar(alca, nome, resumo, undefined)
    .then(publicar)
    .catch((e) => console.warn('recentes:', e));
  if (!modelo) return;
  fotografarDepois(async () => {
    const { miniaturaDoMuro } = await import('@/visor/miniatura');
    const foto = await miniaturaDoMuro(modelo);
    // Outro muro entrou enquanto a foto saía: gravar agora levaria o arquivo anterior de volta ao topo, por cima do
    // que acabou de ser aberto. Fica a foto que ele tinha; a próxima abertura dele refaz.
    const agora = useApp.getState();
    if (!foto || agora.carregamento !== carregamento || agora.arquivo !== nome) return;
    publicar(await l.lembrar(alca, nome, resumo, foto));
  });
}

/** Tira da lista (não apaga o arquivo). */
export async function esquecerRecente(chave: string): Promise<void> {
  const l = loja();
  if (!l) return;
  try {
    publicar(await l.esquecer(chave));
  } catch (e) {
    console.warn('recentes:', e);
  }
}

/** Lê o arquivo do recente (quem põe na tela é acoesDeArquivo, com a pergunta das alterações). */
export async function lerRecente(chave: string): Promise<Lido | null> {
  const l = loja();
  if (!l) return null;
  return l.ler(chave);
}
