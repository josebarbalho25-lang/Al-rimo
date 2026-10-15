/*
  O CONTEXTO DO GERADOR — o que as etapas (alvenaria, armaduras, entorno) compartilham: o estado em construção,
  as geometrias (uma por forma de peça, como InstancedMesh/IfcMappedItem) e as constantes de obra.

  Constantes marcadas DEDUÇÃO são valores de obra adotados aqui, não da norma nem da aula: viram aviso quando
  pesam no desenho.
*/
import type { Aviso, Geometria, PedacoDePrisma, Peca, TipoPeca, Vec2 } from '@/modelo/tipos';
import { H_BLOCO, furosDaPeca as furosDoCatalogo, raioDoFundoDaCanaleta, secaoDaPecaCanaleta, type FuroDaPeca, type PecaDoCatalogo } from './catalogo';
import type { Parametros } from './leitura';
import type { Modulo } from './modular';
import { areaPoligono, arred, perfisDaCanaleta, prisma, retangulo, retanguloArredondado, secaoDaCanaleta } from './perfis';
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
  /** Barbacãs pedidos × desenhados no muro todo (entorno.ts: drenagem conta por trecho, conferenciasGerais avisa). */
  barbacas?: { pedidos: number; desenhados: number; emCanaleta: boolean; acimaDoAterro?: boolean };
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
  // uma conta por seção (o catálogo é constante): a canaleta furada pede a seção de cada peça, e são milhares
  const k = `${mod.cat.nome}|${c === mod.cat.canaleta ? 'inteira' : 'propria'}`;
  const ja = SECOES.get(k);
  if (ja) return ja;
  const r = raioDoFundoDaCanaleta(mod.cat, c);
  const s = { ...secaoDaCanaleta(mod.cat.t, H_BLOCO, c.parede, c.fundo, r), parede: c.parede, fundo: c.fundo, r, propria: c !== mod.cat.canaleta };
  SECOES.set(k, s);
  return s;
}
const SECOES = new Map<string, SecaoCanaleta>();

export function geoCanaleta(ctx: Ctx, pc: PecaDoCatalogo): string {
  const { mod, geos } = ctx;
  const chave = `canaleta ${mod.cat.nome} ${pc.chave}`;
  if (!geos[chave]) {
    geos[chave] = prisma(chave, 'X', secaoCanaleta(mod, pc).U, pc.comprimento, undefined, pc.nome);
    geos[chave].classe = pc.classe;
  }
  return chave;
}

/**
 * O que a obra faz na canaleta comprada, em coordenadas LOCAIS dela (w ao longo da peça, u na largura, mm):
 * `furos` no fundo, onde sobe a barra vertical com o graute dela; `quebras` da parede de um lado (lado 0: u = 0;
 * lado 1: u = t), do topo até o fundo, onde a canaleta do contraforte encosta (o T de graute).
 */
export interface RecortesDaCanaleta {
  furos: { w0: number; w1: number; u0: number; u1: number }[];
  quebras: { lado: 0 | 1; w0: number; w1: number }[];
}

/**
 * A canaleta furada/quebrada: o envelope é o U da peça (o mesmo de geoCanaleta: caixa, cor e catálogo iguais) e o
 * sólido são os pedaços (contrato: Geometria.pedacos). A chave leva os recortes — canaletas furadas no mesmo lugar
 * dividem a geometria (InstancedMesh / IfcMappedItem), como as inteiras.
 */
export function geoCanaletaRecortada(ctx: Ctx, pc: PecaDoCatalogo, rec: RecortesDaCanaleta): string {
  if (!rec.furos.length && !rec.quebras.length) return geoCanaleta(ctx, pc);
  const { mod, geos } = ctx;
  const t = mod.cat.t;
  const L = pc.comprimento;
  const furos = [...rec.furos].sort((a, b) => a.w0 - b.w0 || a.u0 - b.u0);
  const quebras = [...rec.quebras].sort((a, b) => a.lado - b.lado || a.w0 - b.w0);
  const chave = `canaleta ${mod.cat.nome} ${pc.chave} |`
    + furos.map((f) => ` f${fmt(f.w0)}-${fmt(f.w1)}x${fmt(f.u0)}-${fmt(f.u1)}`).join('')
    + quebras.map((q) => ` q${q.lado}:${fmt(q.w0)}-${fmt(q.w1)}`).join('');
  if (geos[chave]) return chave;
  const s = secaoCanaleta(mod, pc);
  // trechos ao longo da peça entre os cortes; cada trecho tem UMA seção (furo e paredes)
  const cortes = [...new Set([0, L, ...furos.flatMap((f) => [f.w0, f.w1]), ...quebras.flatMap((q) => [q.w0, q.w1])])]
    .filter((w) => w >= 0 && w <= L).sort((a, b) => a - b);
  const pedacos: PedacoDePrisma[] = [];
  const recortes: PedacoDePrisma[] = [];
  // folga das caixas de recorte além das faces de fora (a subtração do IFC não pode ter face coincidente)
  const F = 1;
  const caixa = (u0: number, u1: number, v0: number, v1: number): Vec2[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  let anterior: { k: string; de: number; perfis: Vec2[][]; furo: [number, number] | null; sem: [boolean, boolean] } | null = null;
  const fecha = (ate: number): void => {
    if (!anterior) return;
    for (const contorno of anterior.perfis) pedacos.push({ contorno, de: anterior.de, ate });
    const de = anterior.de === 0 ? -F : anterior.de;
    const fim = ate === L ? L + F : ate;
    // furo do fundo: a faixa do fundo, de baixo (passando F) até a face de cima do fundo — exatamente, sem passar: acima
    // dela, na faixa do furo, fica o canto arredondado das paredes, que os pedaços mantêm (passando, o IFC raspava ~1 cm³)
    if (anterior.furo) recortes.push({ contorno: caixa(anterior.furo[0], anterior.furo[1], -F, s.fundo), de, ate: fim });
    // parede quebrada até o fundo, com o canto arredondado dela (perfisDaCanaleta, `sem`)
    if (anterior.sem[0]) recortes.push({ contorno: caixa(-F, s.parede + s.r + F, s.fundo, H_BLOCO + F), de, ate: fim });
    if (anterior.sem[1]) recortes.push({ contorno: caixa(t - s.parede - s.r - F, t + F, s.fundo, H_BLOCO + F), de, ate: fim });
  };
  for (let i = 0; i + 1 < cortes.length; i++) {
    const [a, b] = [cortes[i], cortes[i + 1]];
    if (b - a < 1e-6) continue;
    const meio = (a + b) / 2;
    // dois furos na mesma faixa (colunas vizinhas) viram um só, do tamanho dos dois
    const aqui = furos.filter((f) => f.w0 < meio && f.w1 > meio);
    const furo: [number, number] | null = aqui.length ? [Math.min(...aqui.map((f) => f.u0)), Math.max(...aqui.map((f) => f.u1))] : null;
    const sem: [boolean, boolean] = [0, 1].map((lado) => quebras.some((q) => q.lado === lado && q.w0 < meio && q.w1 > meio)) as [boolean, boolean];
    const k = `${furo ? furo.join('-') : ''}|${sem.join()}`;
    if (anterior && anterior.k === k) continue;
    fecha(a);
    anterior = { k, de: a, perfis: perfisDaCanaleta(t, H_BLOCO, s.parede, s.fundo, s.r, furo, sem), furo, sem };
  }
  fecha(L);
  const volume = pedacos.reduce((v, q) => v + Math.abs(areaPoligono(q.contorno)) * (q.ate - q.de), 0);
  const g = prisma(chave, 'X', s.U, L, undefined, pc.nome);
  g.classe = pc.classe;
  g.pedacos = pedacos.map((q) => ({ contorno: q.contorno, de: arred(q.de), ate: arred(q.ate) }));
  g.recortes = recortes.map((q) => ({ contorno: q.contorno.map(([u, v]) => [arred(u), arred(v)] as Vec2), de: arred(q.de), ate: arred(q.ate) }));
  g.volume_mm3 = arred(volume);
  geos[chave] = g;
  return chave;
}

/** Graute que enche o miolo de canaletas seguidas da mesma seção, por `comprimento` (eixo local x). */
export function geoGrauteCanaleta(ctx: Ctx, comprimento: number, peca?: { tipo: TipoPeca }): string {
  const s = secaoCanaleta(ctx.mod, peca);
  const chave = `graute canaleta ${ctx.mod.cat.nome}${s.propria ? ' cortada' : ''} L${fmt(comprimento)}`;
  return geoPrismaReto(ctx, chave, 'X', s.miolo, comprimento);
}
