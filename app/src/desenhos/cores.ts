/*
  CORES DO JOSE NA PRANCHA — cada tipo de bloco pintado com a cor que o Jose usa no Revit, para o pessoal da obra
  bater o olho na paginação e saber qual peça vai onde (inteiro cinza, meio bloco azul, canaleta amarela, 34
  laranja, 54 vermelho). Vale para a vista frontal, a planta e o isométrico; o corte fica com a hachura, que é
  convenção de desenho e não código de obra.

  A cor sai da tabela de gráficos (graficos.ts): de fábrica, a do Revit do Jose (modulacao/catalogo.ts,
  CORES_DO_JOSE); desde 15/10 ele troca na tela, e a vista, a prancha e o 3D Cores acompanham.

  De onde sai o tipo: `Geometria.classe`, que a modulação grava. Modelo sem classe (o de exemplo dos testes, ou
  um modelo salvo antes de 09/10) cai na leitura pelo `tipo` da peça — inteiro, meio e as três canaletas não têm
  dúvida. A peça de amarração sem classe e o bloco cortado não têm cor do Jose: ficam no ocre de "peça especial",
  que já era o destaque delas antes das cores.
*/
import type { ClassePeca, TipoPeca } from '@/modelo/tipos';
import { corDoAcoNoDesenho, graficos } from './graficos';
import { ALVENARIA, type Solido } from './geometria';
import { COR, Prancha, type Estilo } from './prancha';

/** Nome curto da legenda — o nome que a obra usa, sem frase. */
const NOME: Record<ClassePeca, string> = {
  inteiro: 'Inteiro',
  meio: 'Meio bloco',
  canaleta: 'Canaleta',
  bloco34: 'Bloco 34',
  bloco54: 'Bloco 54',
};

/** Ordem da legenda: a do Revit do Jose (cores_jose.json), depois o que não tem cor dele. */
const ORDEM = ['inteiro', 'meio', 'canaleta', 'bloco34', 'bloco54', 'especial'];

/** Contorno da peça pintada: escuro, porque o cinza do inteiro (#787878) engoliria o traço cinza de antes. */
export const TRACO_DA_PECA = COR.linha;

export interface Tinta {
  chave: string;      // a classe, ou 'especial'
  nome: string;       // rótulo da legenda
  cor: string;        // preenchimento
}

function classePeloTipo(tp: TipoPeca): ClassePeca | undefined {
  if (tp === 'BLOCO') return 'inteiro';
  if (tp === 'MEIO_BLOCO') return 'meio';
  if (tp === 'CANALETA' || tp === 'MEIA_CANALETA' || tp === 'CANALETA_CORTADA') return 'canaleta';
  return undefined;
}

/** A tinta da peça de alvenaria (null para o que não é alvenaria: graute, sapata, dreno...). */
export function tintaDaPeca(s: Solido): Tinta | null {
  if (!ALVENARIA.has(s.peca.tipo)) return null;
  const classe = s.geo.classe ?? classePeloTipo(s.peca.tipo);
  // a cor da tabela de gráficos (de fábrica, a do Revit do Jose; ele troca na tela — 15/10)
  const cor = classe && graficos().materiais[classe]?.cor;
  if (classe && cor) return { chave: classe, nome: NOME[classe], cor };
  // o bloco cortado: sem cor no Revit do Jose
  return { chave: classe ?? 'especial', nome: classe ? NOME[classe] : 'Peça especial', cor: COR.especialFundo };
}

/** Estilo de preenchimento da peça pintada (vista frontal e planta). Camada do DXF: alvenaria. */
export function estiloPintado(t: Tinta): Estilo {
  return { fill: t.cor, stroke: TRACO_DA_PECA, sw: 0.7, camada: 'alvenaria' };
}

/** As tintas presentes num conjunto de peças, uma vez cada, na ordem da legenda. */
export function tintasPresentes(solidos: Solido[]): Tinta[] {
  const vistas = new Map<string, Tinta>();
  for (const s of solidos) {
    const t = tintaDaPeca(s);
    if (t && !vistas.has(t.chave)) vistas.set(t.chave, t);
  }
  const pos = (k: string) => (ORDEM.includes(k) ? ORDEM.indexOf(k) : ORDEM.length);
  return [...vistas.values()].sort((a, b) => pos(a.chave) - pos(b.chave));
}

/** Item da legenda: amostra pintada, traço de barra (cheio ou tracejado) ou a hachura do graute. */
export type Amostra = Estilo | 'barra' | 'espera' | 'graute';

export function itensDasTintas(tintas: Tinta[]): [string, Amostra][] {
  return tintas.map((t) => [t.nome, estiloPintado(t)]);
}

/**
 * Legenda em linha: amostra + rótulo. Quebra a linha quando passaria de `largura` (px de prancha, a partir de x):
 * muro curto com sete itens não pode alargar a prancha só por causa da legenda — o enquadrar encolheria o muro.
 * No DXF tudo dela vai na camada 'legenda': a amostra do bloco não é alvenaria, e quem apaga a camada do aço
 * para ler a paginação não quer a legenda furada.
 */
export function desenharLegenda(pr: Prancha, x: number, y: number, itens: [string, Amostra][], largura = Infinity): void {
  const TAM = 11;
  let cx = x, cy = y;
  for (const [rot, e] of itens) {
    const w = 23 + Prancha.largura(rot, TAM);
    if (cx > x && cx + w > x + largura) {
      cx = x;
      cy += 18;
    }
    if (e === 'barra' || e === 'espera') {
      pr.linha(cx, cy - 4, cx + 18, cy - 4, { stroke: corDoAcoNoDesenho(), sw: 2, dash: e === 'espera' ? '5,3' : undefined, camada: 'legenda' });
    } else if (e === 'graute') {
      // a hachura do graute por cima do cinza do inteiro: é assim que ela aparece na vista
      pr.rect(cx, cy - 9, 18, 10, { fill: graficos().materiais.inteiro?.cor ?? COR.blocoFundo, stroke: TRACO_DA_PECA, sw: 0.7, camada: 'legenda' });
      pr.rect(cx, cy - 9, 18, 10, { fill: pr.padrao('graute'), stroke: 'none', camada: 'legenda' });
    } else {
      pr.rect(cx, cy - 9, 18, 10, { ...e, camada: 'legenda' });
    }
    pr.texto(cx + 23, cy, rot, { tam: TAM, ancora: 'start', camada: 'legenda' });
    cx += w + 18;
  }
}
