/*
  A SEÇÃO REAL DO CONTRAFORTE — onde a barra principal passa, tirado da MONTAGEM (templates do Revit do Jose), não
  da conta simplificada "barra no meio do bloco" (d = tenr − eenr/2).

  POR QUE "TRECHO COMUM": a barra vertical atravessa todas as fiadas reta. As fiadas alternam P (o muro passa, a
  haste encosta) e I (o contraforte atravessa o muro), e a peça que fica no lugar da barra muda de uma para a outra —
  na ponta do contraforte de 54 da 14x39, por exemplo, a fiada P tem um bloco inteiro e a fiada I um meio bloco. A
  barra só pode ficar onde há furo nas DUAS: o trecho comum. O eixo do grupo de barras é o centro desse trecho.
    enterrado (contraforte do lado do solo): o furo da ponta; c é medido da PONTA (face tracionada) e d da face
      externa do muro (comprimida) — d = tenr − c.
    aparente (do lado de fora): a barra vai junto à face do solo, na célula do muro em que o contraforte nasce
      (furo da passante na fiada I × furo do bloco do muro na fiada P); c é medido da face do solo. DEDUÇÃO: os
      templates do Jose são todos enterrados; o aparente é o espelho deles (fiadas.ts faz o mesmo no 3D).

  Medido nos templates (dados/encaixes_revit/*_templates.json, conferido também direto nos pontos do Revit):
    14x39, contraforte de 34 e de 54 → furo comum da ponta de 2,5 a 16,5 cm da ponta → c = 9,5 cm (d = 24,5 e 44,5);
    19x39, contraforte de 59 e de 79 → de 3,5 a 16,5 cm da ponta → c = 10,0 cm (d = 49,0 e 69,0).
  A planilha guarda esses números numa tabela (aba Referências, "montagens do contraforte") — a conta é a planilha.
  O teste (secaoDoContraforte.test.ts) confere a tabela contra esta função: peça nova no catálogo ou receita nova
  nos encaixes que mude o furo da ponta quebra o teste, e não passa calada.

  Coordenadas (mm): X ao longo do muro, 0 no eixo do contraforte; η ao longo do contraforte, 0 na face do muro OPOSTA
  à haste (a mesma de fiadas.ts: enterrado → face externa; aparente → face do solo).
*/
import { CATALOGO, JUNTA, furosDaPeca, meioModulo, pecaDoCatalogo, type NomeFamilia } from './catalogo';
import { ENCAIXES, type ReceitaDaFiada } from './encaixes';
import { montarHaste } from './fiadas';
import { arrumarGrupo, type Arranjo } from './arranjo';
import { COB_GRAUTE } from './contexto';
import { areaPoligono, distanciaAoFuro, retanguloArredondado } from './perfis';
import type { Vec2 } from '@/modelo/tipos';

export type Posicao = 'enterrado' | 'aparente';
export type TipoDoNo = 'T' | 'L';

/** Furo em planta: centro (cx em X, cy em η), meias-medidas a (em X) e b (em η), raio dos cantos. */
export interface FuroEmPlanta { cx: number; cy: number; a: number; b: number; r: number }

/** Peça da haste numa fiada: de η a η + comp, com os furos em planta. */
export interface PecaDaHaste { chave: string; nome: string; eta: number; comp: number; passante: boolean; furos: FuroEmPlanta[] }

export interface FuroDaBarra {
  /** Furo onde a barra passa na fiada P e na fiada I. */
  P: FuroEmPlanta;
  I: FuroEmPlanta;
  /** Trecho comum (polígono em planta, X × η) e o que se mede nele. */
  poligono: Vec2[];
  area: number;        // mm²
  de: number;          // η do começo do trecho comum (mm)
  ate: number;         // η do fim
}

export interface SecaoDoContraforte {
  familia: NomeFamilia;
  t: number;
  tenr: number;
  posicao: Posicao;
  no: TipoDoNo;
  /** Peças da haste (com a passante) nas duas fiadas de bloco. */
  haste: Record<'P' | 'I', PecaDaHaste[]>;
  furo: FuroDaBarra;
  /** Face tracionada → eixo das barras (mm): enterrado, da ponta; aparente, da face do solo. */
  c: number;
  /** tenr − c (mm). */
  d: number;
}

const r1 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Furos de uma peça deitada na haste (comprimento ao longo de η), como gerar.ts os põe no mundo. */
function furosNaHaste(familia: NomeFamilia, chave: string, eta: number): FuroEmPlanta[] {
  const cat = CATALOGO[familia];
  const pc = pecaDoCatalogo(cat, chave);
  return furosDaPeca(cat, pc).map((f) => ({ cx: 0, cy: r1(eta + f.c), a: f.w / 2, b: f.l / 2, r: f.r }));
}

function hasteDa(familia: NomeFamilia, tenr: number, receita: ReceitaDaFiada): PecaDaHaste[] {
  const cat = CATALOGO[familia];
  const m = meioModulo(cat);
  const n_haste = Math.round((tenr - cat.t) / m);
  return montarHaste(cat, { cat, m, n_haste, tenr }, receita, true).map((h) => {
    const pc = pecaDoCatalogo(cat, h.chave);
    return { chave: h.chave, nome: pc.nome, eta: h.eta, comp: h.comp, passante: h.passante, furos: pc.forma === 'bloco' ? furosNaHaste(familia, h.chave, h.eta) : [] };
  });
}

/**
 * Furo do bloco do MURO na célula do contraforte, na fiada P (só o aparente usa: a barra fica dentro do muro).
 * Peças fixas dos encaixes (14x39: 540 no T, 340 na ponta) saem da receita; na 19x39 o muro é "continua" e a peça
 * sai da busca de fiadas.ts — aqui vale o que o Jose montou no template: meio bloco em cima do T; na ponta, o bloco
 * inteiro do muro correndo até o fim (a 1ª célula dele é a do contraforte).
 */
function furoDoMuroNoNo(familia: NomeFamilia, no: TipoDoNo, receitaP: ReceitaDaFiada): FuroEmPlanta {
  const cat = CATALOGO[familia];
  const m = meioModulo(cat);
  const t = cat.t;
  const xc = t / 2;                   // eixo do contraforte, com o nó começando em x = 0
  const pecas: { chave: string; x: number }[] = [];
  if (receitaP.parede && receitaP.parede !== 'continua') {
    let x = -receitaP.parede.antes * m;
    for (const ch of receitaP.parede.pecas) {
      pecas.push({ chave: ch, x });
      x += pecaDoCatalogo(cat, ch).comprimento + JUNTA;
    }
  } else {
    pecas.push({ chave: no === 'T' ? 'meio' : 'inteiro', x: 0 });
  }
  for (const { chave, x } of pecas) {
    const pc = pecaDoCatalogo(cat, chave);
    const parede = pc.medido?.parede ?? cat.hf;
    for (const f of furosDaPeca(cat, pc)) {
      const x0 = x + f.c - f.l / 2;
      const x1 = x + f.c + f.l / 2;
      if (x0 <= xc && xc <= x1) return { cx: r1((x0 + x1) / 2 - xc), cy: t / 2, a: f.l / 2, b: (t - 2 * parede) / 2, r: f.r };
    }
  }
  throw new Error(`${familia}: nenhum furo do muro na célula do contraforte (${no}, fiada P)`);
}

/** Furo da peça que chega mais perto de η (o da ponta: η = tenr; o junto à face do solo: η = 0). */
function furoMaisPerto(haste: PecaDaHaste[], eta: number): FuroEmPlanta {
  let melhor: FuroEmPlanta | null = null;
  let dist = Infinity;
  for (const p of haste) for (const f of p.furos) {
    const dd = Math.min(Math.abs(f.cy - f.b - eta), Math.abs(f.cy + f.b - eta));
    if (dd < dist) { dist = dd; melhor = f; }
  }
  if (!melhor) throw new Error('haste sem furo');
  return melhor;
}

const poligonoDoFuro = (f: FuroEmPlanta): Vec2[] => retanguloArredondado(2 * f.a, 2 * f.b, f.r, f.cx - f.a, f.cy - f.b);

/** Recorte de um polígono convexo por outro (Sutherland–Hodgman); os dois anti-horários. */
function recortar(sujeito: Vec2[], faca: Vec2[]): Vec2[] {
  let out = sujeito;
  for (let i = 0; i < faca.length && out.length; i++) {
    const [ax, ay] = faca[i];
    const [bx, by] = faca[(i + 1) % faca.length];
    const dentro = ([x, y]: Vec2) => (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= -1e-9;
    const corte = ([px, py]: Vec2, [qx, qy]: Vec2): Vec2 => {
      const a1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
      const a2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      const s = a1 / (a1 - a2);
      return [px + s * (qx - px), py + s * (qy - py)];
    };
    const ent = out;
    out = [];
    for (let k = 0; k < ent.length; k++) {
      const p = ent[k];
      const q = ent[(k + 1) % ent.length];
      if (dentro(q)) {
        if (!dentro(p)) out.push(corte(p, q));
        out.push(q);
      } else if (dentro(p)) {
        out.push(corte(p, q));
      }
    }
  }
  return out;
}

function furoComum(P: FuroEmPlanta, I: FuroEmPlanta): FuroDaBarra {
  const poligono = recortar(poligonoDoFuro(P), poligonoDoFuro(I));
  const de = Math.max(P.cy - P.b, I.cy - I.b);
  const ate = Math.min(P.cy + P.b, I.cy + I.b);
  return { P, I, poligono, area: Math.abs(areaPoligono(poligono)), de: r1(de), ate: r1(ate) };
}

/** A seção de um contraforte (T = intermediário, L = de ponta) de comprimento tenr (mm) na família. */
export function secaoDoContraforte(familia: NomeFamilia, tenr: number, posicao: Posicao, no: TipoDoNo): SecaoDoContraforte {
  const cat = CATALOGO[familia];
  const enc = ENCAIXES[familia][no];
  const haste = { P: hasteDa(familia, tenr, enc.P), I: hasteDa(familia, tenr, enc.I) };
  let furo: FuroDaBarra;
  if (posicao === 'enterrado') {
    furo = furoComum(furoMaisPerto(haste.P, tenr), furoMaisPerto(haste.I, tenr));
  } else {
    const passante = haste.I.filter((p) => p.passante);
    furo = furoComum(furoDoMuroNoNo(familia, no, enc.P), furoMaisPerto(passante, 0));
  }
  const centro = (furo.de + furo.ate) / 2;
  const c = r1(posicao === 'enterrado' ? tenr - centro : centro);
  return { familia, t: cat.t, tenr, posicao, no, haste, furo, c, d: r1(tenr - c) };
}

/** η do eixo das barras para um c (mm) medido da face tracionada. */
export const etaDaBarra = (s: { tenr: number; posicao: Posicao }, c: number): number => (s.posicao === 'enterrado' ? s.tenr - c : c);

/**
 * O c da MONTAGEM (o que vai para a tabela da planilha): o maior dos centros do T e da ponta — o menor d, a favor da
 * segurança. Nos templates os dois coincidem no enterrado; no aparente da 19x39 o furo do bloco do muro na ponta
 * (inteiro) é mais estreito que o do T (meio) e o centro anda 3,5 mm.
 */
export function cDaMontagem(familia: NomeFamilia, tenr: number, posicao: Posicao): number {
  return Math.max(secaoDoContraforte(familia, tenr, posicao, 'T').c, secaoDoContraforte(familia, tenr, posicao, 'L').c);
}

/** Folga de uma barra no furo comum de todas as seções dadas (T e ponta): a pior delas. */
function folgaNoComum(secoes: SecaoDoContraforte[]) {
  const furos = secoes.flatMap((s) => [s.furo.P, s.furo.I]);
  return (x: number, y: number, raio: number): number => {
    let f = Infinity;
    for (const h of furos) f = Math.min(f, -distanciaAoFuro(x - h.cx, y - h.cy, h.a, h.b, h.r) - raio);
    return f;
  };
}

/**
 * As n barras de Ø no furo da barra, com a espera ao lado (é a seção da BASE, na emenda), arrumadas pela mesma regra
 * do 3D (arranjo.ts), centradas no eixo do c dado.
 */
export function arranjoNaSecao(s: SecaoDoContraforte, c: number, n: number, phi: number): Arranjo {
  const f = folgaNoComum([s]);
  return arrumarGrupo(f, f, 0, etaDaBarra(s, c), n, phi, 'Y');
}

/**
 * Quantas barras de Ø cabem no furo comum com 15 mm de graute até a parede do bloco (item 12.1 do curso; a mesma
 * regra do d sugerido do balanço) e a espera ao lado — no T e na ponta ao mesmo tempo, com o eixo no c da montagem.
 * Só INFORMA (decisão do Jose: a régua é o curso; nenhuma verificação nova).
 */
export function barrasQueCabem(familia: NomeFamilia, tenr: number, posicao: Posicao, phi: number): number {
  const secoes = [secaoDoContraforte(familia, tenr, posicao, 'T'), secaoDoContraforte(familia, tenr, posicao, 'L')];
  const f = folgaNoComum(secoes);
  const eta = etaDaBarra(secoes[0], cDaMontagem(familia, tenr, posicao));
  let n = 0;
  while (n < 99 && arrumarGrupo(f, f, 0, eta, n + 1, phi, 'Y').folga >= COB_GRAUTE) n++;
  return n;
}

/** Área (mm²) do furo comum à T e à ponta — a que a taxa de 8% com traspasse usa na memória. */
export function areaDoFuroComum(familia: NomeFamilia, tenr: number, posicao: Posicao): number {
  const T = secaoDoContraforte(familia, tenr, posicao, 'T').furo.poligono;
  const L = secaoDoContraforte(familia, tenr, posicao, 'L').furo.poligono;
  return Math.abs(areaPoligono(recortar(T, L)));
}

/** As montagens do app (Jose, 09/10): bloco 14x39 → contraforte de 34 e 54; 19x39 → 59 e 79 (mm). */
export const MONTAGENS: readonly { familia: NomeFamilia; tenr: number }[] = [
  { familia: '14x39', tenr: 340 }, { familia: '14x39', tenr: 540 },
  { familia: '19x39', tenr: 590 }, { familia: '19x39', tenr: 790 },
];
