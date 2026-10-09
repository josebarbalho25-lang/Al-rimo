// ═══════════════════════════════════════════════════════════════════════════
//  visor/lotes.ts — o muro separado em LOTES: um por forma × grupo de ocultar
// ---------------------------------------------------------------------------
//  Cada lote vira UM InstancedMesh (uma chamada de desenho), não importa
//  quantos blocos tenha. É o que deixa 5.000 blocos girarem leves: o custo
//  de desenhar é o número de lotes (~15), não o de peças.
//
//  A chave do lote é a Geometria + o acabamento + as categorias de ocultar:
//  o mesmo bloco 14×19×39 no muro e no contraforte cai em lotes diferentes,
//  porque "ocultar Contrafortes" tem de levar só os do contraforte.
//
//  Puro (sem three, sem DOM): é testado no Node.
// ═══════════════════════════════════════════════════════════════════════════

import type { Barra, Modelo, Peca, TipoPeca } from '@/modelo/tipos';
import { caixaDaPeca, caixaLocal, escreverMatriz, MM, type Caixa } from './perfil3d';

/** Os grupos de mostrar/ocultar da barra do visor. */
export type Categoria = 'blocos' | 'graute' | 'armadura' | 'contrafortes' | 'fundacao' | 'drenagem' | 'terreno';

export const CATEGORIAS: readonly { id: Categoria; rotulo: string }[] = [
  { id: 'blocos', rotulo: 'Blocos' },
  { id: 'graute', rotulo: 'Graute' },
  { id: 'armadura', rotulo: 'Armadura' },
  { id: 'contrafortes', rotulo: 'Contrafortes' },
  { id: 'fundacao', rotulo: 'Fundação' },
  { id: 'drenagem', rotulo: 'Drenagem' },
  { id: 'terreno', rotulo: 'Terreno' },
];

/** O material de cada tipo de peça — decide a cor e se o Raio-X o deixa translúcido. */
export type Acabamento = 'alvenaria' | 'graute' | 'concreto' | 'brita' | 'manta' | 'tubo' | 'terreno';

const ACABAMENTO: Record<TipoPeca, Acabamento> = {
  BLOCO: 'alvenaria',
  MEIO_BLOCO: 'alvenaria',
  BLOCO_JUNCAO: 'alvenaria',
  BLOCO_CORTADO: 'alvenaria',
  CANALETA: 'alvenaria',
  MEIA_CANALETA: 'alvenaria',
  CANALETA_CORTADA: 'alvenaria',
  GRAUTE_FURO: 'graute',
  GRAUTE_CANALETA: 'graute',
  SAPATA: 'concreto',
  DRENO: 'brita',
  MANTA: 'manta',
  BARBACA: 'tubo',
  ATERRO: 'terreno',
  SOLO_FRENTE: 'terreno',
};

export function acabamentoDaPeca(tipo: TipoPeca): Acabamento {
  return ACABAMENTO[tipo] ?? 'alvenaria';
}

/*
  ⚠️ UMA PEÇA PODE SER DE DUAS CATEGORIAS, e só aparece com as DUAS acesas.
  O graute do contraforte é Graute E Contraforte: apagar "Graute" tem de levar
  todo o graute, e apagar "Contrafortes" tem de levar o contraforte inteiro —
  bloco, graute e barra. Com uma categoria só por peça, um dos dois botões
  deixaria pedaço para trás.
*/
export function categoriasDaPeca(p: Peca): Categoria[] {
  if (p.grupo === 'terreno') return ['terreno'];
  if (p.grupo === 'drenagem') return ['drenagem'];
  if (p.grupo === 'fundacao') return ['fundacao'];
  const graute = p.tipo === 'GRAUTE_FURO' || p.tipo === 'GRAUTE_CANALETA';
  const base: Categoria = graute ? 'graute' : 'blocos';
  return p.grupo === 'contraforte' ? [base, 'contrafortes'] : [base];
}

export function categoriasDaBarra(b: Barra): Categoria[] {
  if (b.papel.startsWith('CF_')) return ['armadura', 'contrafortes'];
  if (b.papel.startsWith('SAP_')) return ['armadura', 'fundacao'];
  return ['armadura'];
}

/** Visível só se TODAS as categorias estiverem acesas. */
export function visivel(categorias: readonly Categoria[], ocultas: ReadonlySet<Categoria>): boolean {
  return categorias.every((c) => !ocultas.has(c));
}

export interface Lote {
  chave: string;
  /** Chave em Modelo.geometrias. */
  geometria: string;
  acabamento: Acabamento;
  categorias: Categoria[];
  /** instanceId → Peca.id. É o que o clique devolve. */
  ids: string[];
  /** 16 números por instância, coluna-maior, em METRO. */
  matrizes: Float32Array;
  /** Envoltória do lote, em metro (para enquadrar o que está visível). */
  caixa: Caixa;
}

export interface MontagemDosLotes {
  lotes: Lote[];
  /** Peças cuja geometria não está em Modelo.geometrias: defeito da modulação, não do visor. */
  semGeometria: string[];
}

function unir(a: Caixa | null, b: Caixa): Caixa {
  if (!a) return { min: [...b.min], max: [...b.max] };
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

export function emMetro(c: Caixa): Caixa {
  return { min: [c.min[0] * MM, c.min[1] * MM, c.min[2] * MM], max: [c.max[0] * MM, c.max[1] * MM, c.max[2] * MM] };
}

export function montarLotes(m: Modelo): MontagemDosLotes {
  const grupos = new Map<string, { geometria: string; acabamento: Acabamento; categorias: Categoria[]; pecas: Peca[] }>();
  const semGeometria: string[] = [];
  for (const p of m.pecas) {
    if (!m.geometrias[p.geometria]) {
      semGeometria.push(p.id);
      continue;
    }
    const acabamento = acabamentoDaPeca(p.tipo);
    const categorias = categoriasDaPeca(p);
    const chave = `${p.geometria}|${acabamento}|${categorias.join('+')}`;
    let g = grupos.get(chave);
    if (!g) grupos.set(chave, (g = { geometria: p.geometria, acabamento, categorias, pecas: [] }));
    g.pecas.push(p);
  }

  const lotes: Lote[] = [];
  for (const [chave, g] of grupos) {
    const local = caixaLocal(m.geometrias[g.geometria]!);
    const matrizes = new Float32Array(g.pecas.length * 16);
    let caixa: Caixa | null = null;
    g.pecas.forEach((p, i) => {
      escreverMatriz(p, local, matrizes, i * 16);
      caixa = unir(caixa, caixaDaPeca(p, local));
    });
    lotes.push({
      chave,
      geometria: g.geometria,
      acabamento: g.acabamento,
      categorias: g.categorias,
      ids: g.pecas.map((p) => p.id),
      matrizes,
      caixa: emMetro(caixa!),
    });
  }
  // Ordem estável: o mesmo modelo dá os mesmos lotes na mesma ordem (teste e depuração).
  lotes.sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
  return { lotes, semGeometria };
}

/** Caixa de uma barra (polilinha do eixo, mm), engordada pelo raio. */
export function caixaDaBarra(b: Barra): Caixa {
  let c: Caixa | null = null;
  const r = b.diametro / 2;
  for (const [x, y, z] of b.eixo) c = unir(c, { min: [x - r, y - r, z - r], max: [x + r, y + r, z + r] });
  return c ?? { min: [0, 0, 0], max: [0, 0, 0] };
}

/** Uma união de caixas em metro (ou null se vazia). */
export function unirCaixas(caixas: readonly Caixa[]): Caixa | null {
  let c: Caixa | null = null;
  for (const k of caixas) c = unir(c, k);
  return c;
}
