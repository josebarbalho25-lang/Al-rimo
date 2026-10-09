/*
  ARGAMASSA DE ASSENTAMENTO — medida pelas juntas que a modulação deixou entre as peças.

  Regra (DEDUÇÃO nossa; a aula e a planilha não quantificam argamassa):
  - Junta horizontal: debaixo de cada peça de alvenaria, espessura = junta da família (10 mm), na área LÍQUIDA da
    peça em planta (paredes e septos; sobre o furo não há argamassa — ali passa o graute, que a modulação desenha
    com 200 mm de altura, bloco + junta). A canaleta assenta sobre os blocos de baixo: a argamassa dela é a das
    paredes desses blocos, então vale a área em planta × (área líquida / área bruta) do bloco inteiro da família.
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

interface PecaMedida { p: Peca; c: Caixa; eixo: Eixo; deitada: boolean; areaPerfil: number }

/** Área líquida / bruta do bloco inteiro da família (planta). 1 se não houver bloco inteiro em pé no modelo. */
function razaoLiquida(m: Modelo): number {
  for (const p of m.pecas) {
    if (p.tipo !== 'BLOCO') continue;
    const g = m.geometrias[p.geometria];
    if (g && g.eixo === 'Z') {
      const b = areaBruta(g);
      if (b > 0) return areaLiquida(g) / b;
    }
  }
  return 1;
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
  const r = razaoLiquida(m);
  let horizontal = 0;
  const grupos = new Map<string, PecaMedida[]>();

  for (const p of m.pecas) {
    if (!ALVENARIA.has(p.tipo)) continue;
    const g: Geometria | undefined = m.geometrias[p.geometria];
    if (!g) continue;
    const deitada = g.eixo !== 'Z';
    if (deitada) {
      const { u0, u1 } = limitesDoPerfil(g);
      horizontal += (u1 - u0) * g.extensao * r * junta;
    } else {
      horizontal += areaLiquida(g) * junta;
    }
    const c = caixaDaPeca(p, g);
    const fiada = p.fiada ?? Math.floor((c.z0 + 1) / passo);
    const k = `${p.trecho}|${fiada}`;
    let lista = grupos.get(k);
    if (!lista) grupos.set(k, (lista = []));
    lista.push({ p, c, eixo: eixoGlobal(g, p.giro), deitada, areaPerfil: areaLiquida(g) });
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
