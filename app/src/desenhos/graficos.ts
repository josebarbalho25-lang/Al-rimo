/*
  GRÁFICOS — as cores, as hachuras e o que aparece em cada vista (Jose, 15/10: "quero controlar as cores… corte,
  planta e isométrico, também nas vistas em 3D, inclusive hachuras"; "controlar o que aparece ou não,
  principalmente na vista em planta"). É o Visibilidade/Gráficos do Revit dele, com as decisões de 15/10:
    · guardado NO APP (vale para todo muro, como os dados do escritório) e com volta ao padrão de fábrica;
    · o liga/desliga vale POR TIPO DE VISTA (toda planta igual, todo corte igual…), na tela e na prancha;
    · no 3D, a tabela vale para os estilos Cores e Opaco; o Realista continua foto.

  Os desenhos leem daqui na hora de desenhar (`graficos()`); a tela troca com `usarGraficos()`, que sobe a
  `versaoDosGraficos()` — quem guarda desenho pronto (memo da vista, cena do 3D) põe a versão na dependência.
  Variável do módulo e não parâmetro de cada função: a cor chega a dezenas de pontos dos desenhos, e a vista, a
  prancha, o PDF e o DXF têm de sair da MESMA tabela. Sem ninguém chamar `usarGraficos` (os testes), vale o padrão
  de fábrica — os mesmos números que os desenhos tinham escritos à mão até 15/10.
*/
import type { TipoPeca } from '@/modelo/tipos';
import { CORES_DO_JOSE } from '@/modulacao/catalogo';

/** O desenho de uma hachura de corte. Os quatro primeiros são os do Revit do Jose (hachuras.ts). */
export type DesenhoDeHachura = 'terra' | 'concreto' | 'areia' | 'brita' | 'riscado' | 'solido' | 'vazio';

export const DESENHOS_DE_HACHURA: readonly { id: DesenhoDeHachura; rotulo: string }[] = [
  { id: 'terra', rotulo: 'Terra' },
  { id: 'concreto', rotulo: 'Concreto' },
  { id: 'areia', rotulo: 'Areia' },
  { id: 'brita', rotulo: 'Brita' },
  { id: 'riscado', rotulo: 'Riscado 45°' },
  { id: 'solido', rotulo: 'Sólido' },
  { id: 'vazio', rotulo: 'Vazio' },
];

/** Hachura de corte: o desenho, a cor do risco, a do fundo e a escala (1 = o tamanho que o Jose calibrou). */
export interface Hachura {
  desenho: DesenhoDeHachura;
  risco: string;
  fundo: string;
  escala: number;
}

/**
 * Os materiais da tabela. Bloco por tipo (a cor do Revit, código de obra: vista, planta, isométrico e 3D Cores);
 * "alvenaria" é o bloco CORTADO (a hachura do corte) e a cor do Opaco, igual para todo bloco.
 */
export type Material =
  | 'inteiro' | 'meio' | 'canaleta' | 'bloco34' | 'bloco54'
  | 'alvenaria' | 'graute' | 'aco' | 'concreto' | 'brita' | 'areia' | 'manta' | 'tubo' | 'terra';

/**
 * O que cada material tem: `cor` = 3D Cores (no bloco, também a pintura das vistas 2D); `opaco` = 3D Opaco;
 * `desenho` = a cor do traço nas vistas 2D (só o aço); `hachura` = o corte nas vistas 2D. Campo ausente = o
 * material não tem aquilo. `cor` null = a cor do tema (o 3D escuro e o claro têm a sua).
 */
export interface GraficoDoMaterial {
  cor?: string | null;
  opaco?: string;
  desenho?: string;
  hachura?: Hachura;
}

export const MATERIAIS: readonly { id: Material; rotulo: string }[] = [
  { id: 'inteiro', rotulo: 'Bloco inteiro' },
  { id: 'meio', rotulo: 'Meio bloco' },
  { id: 'canaleta', rotulo: 'Canaleta' },
  { id: 'bloco34', rotulo: 'Bloco 34' },
  { id: 'bloco54', rotulo: 'Bloco 54' },
  { id: 'alvenaria', rotulo: 'Alvenaria cortada' },
  { id: 'graute', rotulo: 'Graute' },
  { id: 'aco', rotulo: 'Aço' },
  { id: 'concreto', rotulo: 'Sapata' },
  { id: 'brita', rotulo: 'Brita' },
  { id: 'areia', rotulo: 'Areia' },
  { id: 'manta', rotulo: 'Manta' },
  { id: 'tubo', rotulo: 'Tubo' },
  { id: 'terra', rotulo: 'Terra' },
];

/** Os itens que se ligam e desligam em cada tipo de vista 2D. */
export type ItemDaVista =
  | 'blocos' | 'graute' | 'armadura' | 'sapata' | 'drenagem' | 'terreno' | 'cotas' | 'eixos' | 'fiadas' | 'chamadas' | 'legenda';

export type TipoDeVista = 'frontal' | 'corte' | 'planta' | 'iso';

const ROTULO_DO_ITEM: Record<ItemDaVista, string> = {
  blocos: 'Blocos',
  graute: 'Graute',
  armadura: 'Armadura',
  sapata: 'Sapata',
  drenagem: 'Drenagem',
  terreno: 'Terreno',
  cotas: 'Cotas',
  eixos: 'Eixos e juntas',
  fiadas: 'Número das fiadas',
  chamadas: 'Chamadas das barras',
  legenda: 'Legenda',
};

/** O que cada tipo de vista desenha (e portanto oferece para desligar), na ordem do menu. */
export const ITENS_DA_VISTA: Readonly<Record<TipoDeVista, readonly ItemDaVista[]>> = {
  frontal: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'terreno', 'cotas', 'eixos', 'fiadas', 'chamadas', 'legenda'],
  corte: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'terreno', 'cotas', 'eixos', 'chamadas'],
  planta: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'cotas', 'eixos', 'legenda'],
  iso: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'legenda'],
};

export const rotuloDoItem = (i: ItemDaVista): string => ROTULO_DO_ITEM[i];

export interface Graficos {
  materiais: Record<Material, GraficoDoMaterial>;
  /** Cor de cada Ø no modo Armadura do 3D (as do Revit do Jose). */
  bitolas: [number, string][];
  /** Item desligado por tipo de vista (o que não está na lista aparece). */
  ocultos: Record<TipoDeVista, ItemDaVista[]>;
}

/**
 * O padrão de fábrica: as cores e hachuras que os desenhos tinham até 15/10 — as do Revit do Jose (blocos, bitolas,
 * terra, concreto, areia), a brita que ele escolheu e os neutros dos estilos do 3D.
 */
export const GRAFICOS_DE_FABRICA: Graficos = {
  materiais: {
    inteiro: { cor: CORES_DO_JOSE.inteiro ?? '#787878' },
    meio: { cor: CORES_DO_JOSE.meio ?? '#004080' },
    canaleta: { cor: CORES_DO_JOSE.canaleta ?? '#ffff80' },
    bloco34: { cor: CORES_DO_JOSE.bloco34 ?? '#ff8040' },
    bloco54: { cor: CORES_DO_JOSE.bloco54 ?? '#ff0000' },
    alvenaria: { opaco: '#ffffff', hachura: { desenho: 'riscado', risco: '#7f7f7f', fundo: '#d9d9d9', escala: 1 } },
    graute: { cor: '#c9c6bd', opaco: '#dcdcdc', hachura: { desenho: 'solido', risco: '#2e75b6', fundo: '#bdd7ee', escala: 1 } },
    aco: { cor: '#34373c', opaco: '#4a4a4a', desenho: '#c00000' },
    concreto: { cor: null, opaco: '#ffffff', hachura: { desenho: 'concreto', risco: '#5d5d5d', fundo: '#d4d4d4', escala: 1 } },
    brita: { cor: null, opaco: '#c4c4c4', hachura: { desenho: 'brita', risco: '#4a4a4a', fundo: '#c3bfb5', escala: 1 } },
    areia: { cor: null, opaco: '#e4e4e4', hachura: { desenho: 'areia', risco: '#5d5d5d', fundo: '#ffffb7', escala: 1 } },
    manta: { cor: null, opaco: '#f6f6f6', hachura: { desenho: 'solido', risco: '#5b7f3a', fundo: '#5b7f3a', escala: 1 } },
    tubo: { cor: null, opaco: '#8c8c8c' },
    terra: { cor: null, opaco: '#bdbdbd', hachura: { desenho: 'terra', risco: '#a67857', fundo: '#dbc9bb', escala: 1 } },
  },
  bitolas: [
    [5, '#00ffff'],
    [6.3, '#00ff00'],
    [8, '#ff8000'],
    [10, '#ff0000'],
    [12.5, '#ff00ff'],
    [16, '#8000ff'],
    [20, '#ffff00'],
    [25, '#0080ff'],
  ],
  ocultos: { frontal: [], corte: [], planta: [], iso: [] },
};

let atual: Graficos = GRAFICOS_DE_FABRICA;
let versao = 0;

/** A tabela em uso. */
export const graficos = (): Graficos => atual;

/** Sobe a cada troca: dependência de quem guarda desenho pronto. */
export const versaoDosGraficos = (): number => versao;

export function usarGraficos(g: Graficos): void {
  if (g === atual) return;
  atual = g;
  versao += 1;
}

/** O item aparece nesta vista? */
export function aparece(vista: TipoDeVista, item: ItemDaVista): boolean {
  return !atual.ocultos[vista]?.includes(item);
}

/** A hachura de corte do material (a de fábrica se a tabela não tiver). */
export function hachuraDe(m: Material): Hachura {
  return atual.materiais[m]?.hachura ?? GRAFICOS_DE_FABRICA.materiais[m].hachura ?? { desenho: 'vazio', risco: '#000000', fundo: '#ffffff', escala: 1 };
}

/** A cor do traço do aço nas vistas 2D. */
export const corDoAcoNoDesenho = (): string => atual.materiais.aco?.desenho ?? '#c00000';

// ── leitura tolerante do que veio guardado ──────────────────────────────────

const ehCor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
const DESENHOS = new Set<string>(DESENHOS_DE_HACHURA.map((d) => d.id));
const ITENS = new Set<string>(Object.keys(ROTULO_DO_ITEM));

/**
 * O que veio do armazenamento, campo a campo por cima do padrão de fábrica: campo estranho cai, material novo
 * (de uma versão futura do app) entra com o de fábrica. Uma cor mal escrita não pode apagar a tabela inteira.
 */
export function lerGraficos(x: unknown): Graficos {
  const o = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const raiz = o(x);
  const fab = GRAFICOS_DE_FABRICA;
  if (!raiz) return fab;
  const materiais = { ...fab.materiais };
  const ms = o(raiz.materiais);
  for (const { id } of MATERIAIS) {
    const v = o(ms?.[id]);
    if (!v) continue;
    const base = fab.materiais[id];
    const m: GraficoDoMaterial = { ...base };
    if ('cor' in base && (v.cor === null || ehCor(v.cor))) m.cor = v.cor as string | null;
    if ('opaco' in base && ehCor(v.opaco)) m.opaco = v.opaco;
    if ('desenho' in base && ehCor(v.desenho)) m.desenho = v.desenho;
    const h = o(v.hachura);
    if (base.hachura && h) {
      m.hachura = {
        desenho: typeof h.desenho === 'string' && DESENHOS.has(h.desenho) ? (h.desenho as DesenhoDeHachura) : base.hachura.desenho,
        risco: ehCor(h.risco) ? h.risco : base.hachura.risco,
        fundo: ehCor(h.fundo) ? h.fundo : base.hachura.fundo,
        escala: typeof h.escala === 'number' && h.escala >= 0.1 && h.escala <= 10 ? h.escala : base.hachura.escala,
      };
    }
    materiais[id] = m;
  }
  const bitolas = fab.bitolas.map(([d, c]): [number, string] => {
    const achada = Array.isArray(raiz.bitolas) ? (raiz.bitolas as unknown[]).find((b) => Array.isArray(b) && b[0] === d) : undefined;
    return [d, Array.isArray(achada) && ehCor(achada[1]) ? achada[1] : c];
  });
  const ocultos = { ...fab.ocultos };
  const oc = o(raiz.ocultos);
  for (const v of Object.keys(ocultos) as TipoDeVista[]) {
    const lista = oc?.[v];
    if (Array.isArray(lista)) ocultos[v] = lista.filter((i): i is ItemDaVista => typeof i === 'string' && ITENS.has(i) && ITENS_DA_VISTA[v].includes(i as ItemDaVista));
  }
  return { materiais, bitolas, ocultos };
}

const ITEM_DO_TIPO: Partial<Record<TipoPeca, ItemDaVista>> = {
  BLOCO: 'blocos', MEIO_BLOCO: 'blocos', BLOCO_JUNCAO: 'blocos', BLOCO_CORTADO: 'blocos',
  CANALETA: 'blocos', MEIA_CANALETA: 'blocos', CANALETA_CORTADA: 'blocos',
  GRAUTE_FURO: 'graute', GRAUTE_CANALETA: 'graute',
  SAPATA: 'sapata',
  DRENO: 'drenagem', AREIA: 'drenagem', MANTA: 'drenagem', BARBACA: 'drenagem', TUBO_DRENO: 'drenagem',
  ATERRO: 'terreno', SOLO_FRENTE: 'terreno',
};

/** A peça aparece nesta vista? (o item dela não está desligado; tipo sem item sempre aparece) */
export function pecaAparece(vista: TipoDeVista, tipo: TipoPeca): boolean {
  const item = ITEM_DO_TIPO[tipo];
  return !item || aparece(vista, item);
}
