/*
  O CONTEXTO DO GERADOR — o que as etapas (alvenaria, armaduras, entorno) compartilham: o estado em construção,
  as geometrias (uma por forma de peça, como InstancedMesh/IfcMappedItem) e as constantes de obra.

  Constantes marcadas DEDUÇÃO são valores de obra adotados aqui, não da norma nem da aula: viram aviso quando
  pesam no desenho.
*/
import type { Aviso, Geometria, Peca, TipoPeca, Vec2 } from '@/modelo/tipos';
import { H_BLOCO, furosDaPeca as furosDoCatalogo, raioDoFundoDaCanaleta, secaoDaPecaCanaleta, type FuroDaPeca, type PecaDoCatalogo } from './catalogo';
import type { Parametros } from './leitura';
import type { Modulo } from './modular';
import { prisma, retangulo, retanguloArredondado, secaoDaCanaleta } from './perfis';
import type { BarraNova } from './barras';

/** Manta geotêxtil desenhada como casca fina do dreno (o quantitativo tira a área do volume ÷ espessura). */
export const ESPESSURA_MANTA = 2;
/** Cobrimento da barra vertical no topo do muro — DEDUÇÃO (valor de obra). */
export const COB_TOPO = 30;
/** Cobrimento das pontas da barra horizontal da canaleta — DEDUÇÃO. */
export const COB_PONTA = 30;
/** Graute entre barra e parede do bloco (Referências, "ABCP"). */
export const COB_GRAUTE = 15;
/** Estribo do contraforte: (eenr − 7) × (tenr − 9) cm da planilha (contrafortes.py) → eixo a 35 mm das faces
 *  laterais e a 45 mm da face do muro e da ponta. */
export const RECUO_ESTRIBO = 45;
export const RECUO_ESTRIBO_LATERAL = 35;
/** Terreno desenhado além da sapata/contraforte, só para ver — DEDUÇÃO. */
export const SOBRA_TERRENO = 1000;

export interface Ctx {
  p: Parametros;
  mod: Modulo;
  geos: Record<string, Geometria>;
  pecas: Peca[];
  barras: BarraNova[];
  avisos: Aviso[];
}

export const pad = (n: number, w: number): string => String(n).padStart(w, '0');
export const fmt = (x: number): string => String(Math.round(x * 100) / 100);

export const zTopoBarra = (ctx: Ctx): number => ctx.mod.H_des - COB_TOPO;

export function geoPrismaReto(ctx: Ctx, chave: string, eixo: Geometria['eixo'], contorno: Vec2[], extensao: number, catalogo?: string): string {
  if (!ctx.geos[chave]) ctx.geos[chave] = prisma(chave, eixo, contorno, extensao, undefined, catalogo);
  return chave;
}

export type { FuroDaPeca };

/** Furos da peça (medidos no Revit ou um por célula — catalogo.ts explica). */
export const furosDaPeca = (mod: Modulo, pc: PecaDoCatalogo): FuroDaPeca[] => furosDoCatalogo(mod.cat, pc);

export function geoBloco(ctx: Ctx, pc: PecaDoCatalogo): string {
  const { mod, geos } = ctx;
  const t = mod.cat.t;
  const chave = `bloco ${mod.cat.nome} ${pc.chave}`;
  if (!geos[chave]) {
    const furos = furosDaPeca(mod, pc).map((f) => retanguloArredondado(f.l, f.w, f.r, f.c - f.l / 2, t / 2 - f.w / 2, true));
    geos[chave] = prisma(chave, 'Z', retangulo(pc.comprimento, t), H_BLOCO, furos, pc.nome);
    geos[chave].classe = pc.classe;
  }
  return chave;
}

export interface SecaoCanaleta { U: Vec2[]; miolo: Vec2[]; parede: number; fundo: number; r: number; propria: boolean }

/**
 * Seção da canaleta (U e miolo): a da família, ou a da cortada quando ela é peça própria (19x39: fundo 3,91 —
 * catalogo.ts). `propria` separa as duas onde a chave da geometria precisa (o graute de uma não é o da outra).
 */
export function secaoCanaleta(mod: Modulo, peca?: { tipo: TipoPeca }): SecaoCanaleta {
  const c = peca ? secaoDaPecaCanaleta(mod.cat, peca) : mod.cat.canaleta;
  const r = raioDoFundoDaCanaleta(mod.cat, c);
  return { ...secaoDaCanaleta(mod.cat.t, H_BLOCO, c.parede, c.fundo, r), parede: c.parede, fundo: c.fundo, r, propria: c !== mod.cat.canaleta };
}

export function geoCanaleta(ctx: Ctx, pc: PecaDoCatalogo): string {
  const { mod, geos } = ctx;
  const chave = `canaleta ${mod.cat.nome} ${pc.chave}`;
  if (!geos[chave]) {
    geos[chave] = prisma(chave, 'X', secaoCanaleta(mod, pc).U, pc.comprimento, undefined, pc.nome);
    geos[chave].classe = pc.classe;
  }
  return chave;
}

/** Graute que enche o miolo de canaletas seguidas da mesma seção, por `comprimento` (eixo local x). */
export function geoGrauteCanaleta(ctx: Ctx, comprimento: number, peca?: { tipo: TipoPeca }): string {
  const s = secaoCanaleta(ctx.mod, peca);
  const chave = `graute canaleta ${ctx.mod.cat.nome}${s.propria ? ' cortada' : ''} L${fmt(comprimento)}`;
  return geoPrismaReto(ctx, chave, 'X', s.miolo, comprimento);
}
