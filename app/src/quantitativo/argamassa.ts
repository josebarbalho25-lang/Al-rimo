/*
  ARGAMASSA DE ASSENTAMENTO — medida pelas juntas que a modulação deixou entre as peças.

  Regra (DEDUÇÃO nossa; a aula e a planilha não quantificam argamassa):
  - Junta horizontal: debaixo de cada peça de alvenaria, espessura = junta da família (10 mm), na área LÍQUIDA da
    peça em planta (paredes e septos; sobre o furo não há argamassa — ali passa o graute, que a modulação desenha
    com 200 mm de altura, bloco + junta). A canaleta tem fundo cheio: a argamassa dela é a face de cima do que
    está EMBAIXO dela — bloco embaixo: as paredes dele, área em planta × (área líquida / área bruta) do bloco inteiro
    da família; canaleta embaixo (a cinta logo acima de uma canaleta intermediária, ou o muro todo em canaleta): só
    as duas paredes do U, porque o miolo é graute; sapata embaixo (1ª fiada): a área toda.
  - Junta vertical: entre duas peças do MESMO trecho e da mesma fiada que ficam a uma junta de distância (em X ou
    em Y — o encontro da haste do contraforte com o muro também é junta). Face = o retângulo comum às duas;
    na ponta da canaleta a face é só o U (o miolo é graute contínuo).
  Peças de trechos diferentes nunca levam argamassa entre si: ali é junta de controle, não de assentamento.
*/
import type { Geometria, Modelo, Peca, TipoPeca } from '@/modelo/tipos';
import { areaBruta, areaLiquida, caixaDaPeca, eixoGlobal, limitesDoPerfil, type Caixa, type Eixo } from './geometria';

export const ALVENARIA: ReadonlySet<TipoPeca> = new Set<TipoPeca>([
  'BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA',
]);

// Folga aceita na medida da junta: a modulação trabalha em mm inteiro, então 2 mm já é "outra coisa".
const TOL_JUNTA = 2;
// Contato mínimo para contar como face comum (evita contar quina com quina).
const TOL_CONTATO = 1;

interface PecaMedida { p: Peca; c: Caixa; eixo: Eixo; deitada: boolean; areaPerfil: number; g: Geometria }

/** Área líquida / bruta da própria peça (bloco embaixo quando o modelo não tem bloco inteiro). */
const razaoBloco = (g: Geometria): number => { const b = areaBruta(g); return b > 0 ? areaLiquida(g) / b : 1; };

/** Área líquida / bruta do bloco inteiro da família (planta); null se não houver bloco inteiro em pé no modelo. */
function razaoLiquida(m: Modelo): number | null {
  for (const p of m.pecas) {
    if (p.tipo !== 'BLOCO') continue;
    const g = m.geometrias[p.geometria];
    if (g && g.eixo === 'Z') {
      const b = areaBruta(g);
      if (b > 0) return areaLiquida(g) / b;
    }
  }
  return null;
}

/**
 * Fração da largura que a face de CIMA de uma peça deitada (canaleta) oferece para assentar a de cima: os lados do
 * perfil no topo (as duas paredes do U). O miolo é graute e não recebe argamassa.
 */
function razaoDoTopo(g: Geometria): number {
  const { u0, u1, v1 } = limitesDoPerfil(g);
  const c = g.perfil.contorno;
  let topo = 0;
  for (let k = 0; k < c.length; k++) {
    const [ua, va] = c[k], [ub, vb] = c[(k + 1) % c.length];
    if (va >= v1 - 0.5 && vb >= v1 - 0.5) topo += Math.abs(ub - ua);
  }
  return u1 > u0 ? Math.min(1, topo / (u1 - u0)) : 1;
}

function sobreposicao(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** Volume (mm³) da junta vertical entre a e b, ou 0 se não forem vizinhas de junta. */
function juntaEntre(a: PecaMedida, b: PecaMedida, junta: number): number {
  const oz = sobreposicao(a.c.z0, a.c.z1, b.c.z0, b.c.z1);
  if (oz <= TOL_CONTATO) return 0;
  const face = (largura: number, normal: Eixo): number => {
    let f = largura * oz;
    // Ponta de peça deitada (canaleta) virada para a junta: a face é o perfil, não o retângulo cheio.
    if (a.deitada && a.eixo === normal) f = Math.min(f, a.areaPerfil);
    if (b.deitada && b.eixo === normal) f = Math.min(f, b.areaPerfil);
    return f;
  };
  const vizinhas = (gap: number) => Math.abs(gap - junta) <= TOL_JUNTA;
  let v = 0;
  const gx = Math.max(b.c.x0 - a.c.x1, a.c.x0 - b.c.x1);
  const oy = sobreposicao(a.c.y0, a.c.y1, b.c.y0, b.c.y1);
  if (vizinhas(gx) && oy > TOL_CONTATO) v += gx * face(oy, 'X');
  const gy = Math.max(b.c.y0 - a.c.y1, a.c.y0 - b.c.y1);
  const ox = sobreposicao(a.c.x0, a.c.x1, b.c.x0, b.c.x1);
  if (vizinhas(gy) && ox > TOL_CONTATO) v += gy * face(ox, 'Y');
  return v;
}

export interface Argamassa { horizontal: number; vertical: number }   // mm³

export function medirArgamassa(m: Modelo): Argamassa {
  const junta = m.familia.junta;
  const passo = m.familia.h + junta;
  const rInteiro = razaoLiquida(m);
  let horizontal = 0;
  const grupos = new Map<string, PecaMedida[]>();
  const fiadaDe = new Map<PecaMedida, number>();

  for (const p of m.pecas) {
    if (!ALVENARIA.has(p.tipo)) continue;
    const g: Geometria | undefined = m.geometrias[p.geometria];
    if (!g) continue;
    const deitada = g.eixo !== 'Z';
    if (!deitada) horizontal += areaLiquida(g) * junta;
    const c = caixaDaPeca(p, g);
    const fiada = p.fiada ?? Math.floor((c.z0 + 1) / passo);
    const k = `${p.trecho}|${fiada}`;
    let lista = grupos.get(k);
    if (!lista) grupos.set(k, (lista = []));
    const pm: PecaMedida = { p, c, eixo: eixoGlobal(g, p.giro), deitada, areaPerfil: areaLiquida(g), g };
    lista.push(pm);
    fiadaDe.set(pm, fiada);
  }

  // Junta horizontal debaixo da canaleta: a face de cima do que está embaixo, ponderada pela área de contato em planta.
  // A razão do bloco inteiro não serve para todas: sobre outra canaleta (a cinta logo acima de uma intermediária) só
  // as duas paredes do U recebem argamassa, e no muro todo em canaleta (s = 20 cm) nem existe bloco inteiro de onde
  // tirar a razão — ali a conta caía na área toda e a argamassa saía 2,5 vezes a das paredes do U de baixo.
  for (const [pm, fiada] of fiadaDe) {
    if (!pm.deitada) continue;
    const { c } = pm;
    const area = (c.x1 - c.x0) * (c.y1 - c.y0);
    const embaixo = fiada > 0 ? grupos.get(`${pm.p.trecho}|${fiada - 1}`) ?? [] : [];
    let contato = 0;
    let comArgamassa = 0;
    for (const b of embaixo) {
      const ox = sobreposicao(c.x0, c.x1, b.c.x0, b.c.x1);
      const oy = sobreposicao(c.y0, c.y1, b.c.y0, b.c.y1);
      if (ox <= TOL_CONTATO || oy <= TOL_CONTATO) continue;
      const r = b.deitada ? razaoDoTopo(b.g) : rInteiro ?? razaoBloco(b.g);
      contato += ox * oy;
      comArgamassa += ox * oy * r;
    }
    // sem nada embaixo: 1ª fiada (sapata, a área toda); fiada de cima sem vizinho medido, a razão do bloco
    const razao = contato > 0 ? comArgamassa / contato : fiada === 0 ? 1 : rInteiro ?? 1;
    horizontal += area * razao * junta;
  }

  let vertical = 0;
  for (const lista of grupos.values()) {
    lista.sort((a, b) => a.c.x0 - b.c.x0);
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j];
        // Ordenadas por x0: daqui em diante nenhuma encosta em X nem cruza a faixa de a.
        if (b.c.x0 > a.c.x1 + junta + TOL_JUNTA) break;
        vertical += juntaEntre(a, b, junta);
      }
    }
  }
  return { horizontal, vertical };
}
