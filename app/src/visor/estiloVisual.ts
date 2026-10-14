// ═══════════════════════════════════════════════════════════════════════════
//  visor/estiloVisual.ts — como o 3D pinta o muro: Cores, Realista ou Opaco
// ---------------------------------------------------------------------------
//  Pedido do Jose (09/10/2026), um estilo para cada uso:
//    · CORES — "importante para o pessoal enxergar a modularização dos
//      blocos": cada tipo de bloco na cor que ele usa no Revit, com legenda;
//    · REALISTA — "legal para o pessoal fazer vídeo e publicar": bloco de
//      concreto, graute, aço e solo com cara de obra, luz e sombra;
//    · OPACO — "para prancha": massa branca, aresta preta, fundo claro (o
//      linha oculta do Revit; o mesmo Opaco do A-PORT, `estiloDaVista.ts`).
//
//  ⚠️ UMA ESCOLHA SÓ, COM NOME. O A-PORT já errou com três botões
//  independentes (linha · massa · aresta) que o usuário tinha de combinar de
//  cabeça; aqui o estilo é um, e este arquivo é a única fonte do que cada um
//  faz (cor, aresta, terreno, luz). Ninguém mais compara a string à mão.
//
//  Puro (sem three, sem DOM): é testado no Node.
// ═══════════════════════════════════════════════════════════════════════════

import { guardar, lembrar } from '@/estado/lembrete';
import type { ClassePeca } from '@/modelo/tipos';
import { CORES_DO_JOSE } from '@/modulacao/catalogo';
import type { Acabamento } from './lotes';
import type { PaletaVisor } from './tema3d';

export type EstiloVisual = 'cores' | 'realista' | 'opaco';

export const ESTILOS_VISUAIS: readonly { id: EstiloVisual; rotulo: string }[] = [
  { id: 'cores', rotulo: 'Cores' },
  { id: 'realista', rotulo: 'Realista' },
  { id: 'opaco', rotulo: 'Opaco' },
];

/** Cores é o padrão: a primeira coisa que o público precisa ver é como o muro se monta. */
export const ESTILO_PADRAO: EstiloVisual = 'cores';

const CHAVE_DO_ESTILO = 'alrimo.estilo3d.v1';

export const ehEstiloVisual = (x: unknown): x is EstiloVisual => x === 'cores' || x === 'realista' || x === 'opaco';

/** O último estilo escolhido nesta máquina (valor estranho ou armazenamento bloqueado → o padrão). */
export function lembrarEstilo(): EstiloVisual {
  return lembrar(CHAVE_DO_ESTILO, ESTILO_PADRAO, ehEstiloVisual);
}

export function guardarEstilo(e: EstiloVisual): void {
  guardar(CHAVE_DO_ESTILO, e);
}

// ── CORES: a cor de cada classe de bloco ──────────────────────────────────

/**
 * As cores do Revit dele (`modulacao/catalogo.ts`, lidas da vista 3D do
 * template em 09/10/2026) — importadas, não copiadas: a vista frontal pinta
 * com as mesmas, e duas listas acabariam discordando.
 *
 * Peça sem cor no Revit (hoje nenhuma: o bloco 44 saiu com a família 14x29)
 * fica com a reserva. Verde é DEDUÇÃO minha: o único matiz que não lembra
 * nenhum dos cinco dele. Peça nova com cor no catálogo usa a do catálogo.
 */
const COR_SEM_REVIT = '#3a9a5c';

/** A ordem da legenda: do bloco comum para o especial (é a ordem em que a obra os encontra). */
export const ORDEM_DAS_CLASSES: readonly ClassePeca[] = ['inteiro', 'meio', 'canaleta', 'bloco34', 'bloco54'];

export const COR_DA_CLASSE = Object.fromEntries(ORDEM_DAS_CLASSES.map((c) => [c, CORES_DO_JOSE[c] ?? COR_SEM_REVIT])) as Readonly<Record<ClassePeca, string>>;

/** O nome curto da legenda. Rótulo, não frase. */
export const ROTULO_DA_CLASSE: Readonly<Record<ClassePeca, string>> = {
  inteiro: 'Inteiro',
  meio: 'Meio bloco',
  canaleta: 'Canaleta',
  bloco34: 'Bloco 34',
  bloco54: 'Bloco 54',
};

/*
  ⚠️ NO CORES, GRAUTE E AÇO SAEM DO TOKEN. O token do graute (#7f7f7f) é quase o
  cinza do bloco inteiro do Revit (#787878): o pilar grauteado sumiria no meio
  dos inteiros. E o aço vermelho (#c00000) é o vermelho do bloco 54. Os dois
  ficam neutros aqui — graute claro, aço grafite — para a única cor forte da
  tela ser a da classe do bloco, que é o que este estilo existe para mostrar.
  Sapata, dreno, manta, barbacã e solo continuam no tema (neutros já).
*/
const NEUTRO_DAS_CORES = { graute: '#c9c6bd', aco: '#34373c' } as const;

/*
  REALISTA: a cor do material na obra (linear depois de convertida pelo three;
  aqui em sRGB, como se lê numa foto). A textura (`texturasRealistas.ts`) entra
  por cima, como variação em torno de 1 — estes são os tons MÉDIOS.
  Bloco de concreto vibroprensado é cinza claro e quente; o graute, mais escuro
  e mais liso; a sapata, o cinza do concreto de fôrma; o aço CA-50, cinza
  escuro puxando ao ferrugem. (Tons por DEDUÇÃO minha, conferidos na tela.)
*/
const REALISTA: Record<Acabamento, string> = {
  alvenaria: '#9b9a95',
  graute: '#85827b',
  concreto: '#8e8b84',
  brita: '#8d8981',
  areia: '#c9b98a',
  manta: '#d6d1c4',
  tubo: '#e6e6e1',
  terreno: '#7a5d3c',
};
const ACO_REALISTA = '#6a5e54';

/*
  OPACO: papel. Tudo branco, menos o que precisa se separar NO CORTE: o graute
  num cinza bem claro (o furo cheio lê diferente do furo vazio) e o aço num
  cinza escuro (vira linha na prancha). A massa não recebe luz — é o que faz o
  branco sair branco (lição do A-PORT, 15/09/2026: com luz, o "branco" da
  prancha saía cinza 191).
*/
const OPACO: Record<Acabamento, string> = {
  alvenaria: '#ffffff',
  graute: '#dcdcdc',
  concreto: '#ffffff',
  brita: '#ececec',
  areia: '#f4f4f4',
  manta: '#f6f6f6',
  tubo: '#ffffff',
  terreno: '#bdbdbd',
};
const ACO_OPACO = '#4a4a4a';

/** A cor de uma peça neste estilo. `classe` só vale para alvenaria. */
export function corDaPeca(estilo: EstiloVisual, p: PaletaVisor, a: Acabamento, classe?: ClassePeca): string {
  if (estilo === 'realista') return REALISTA[a];
  if (estilo === 'opaco') return OPACO[a];
  switch (a) {
    case 'alvenaria':
      // Sem classe (modelo antigo, ou de teste): o bloco neutro do tema.
      return classe ? COR_DA_CLASSE[classe] : p.bloco;
    case 'graute':
      return NEUTRO_DAS_CORES.graute;
    case 'concreto':
      return p.concreto;
    case 'brita':
      return p.brita;
    case 'areia':
      return p.areia;
    case 'manta':
      return p.manta;
    case 'tubo':
      return p.tubo;
    case 'terreno':
      return p.solo;
  }
}

export function corDoAco(estilo: EstiloVisual): string {
  return estilo === 'realista' ? ACO_REALISTA : estilo === 'opaco' ? ACO_OPACO : NEUTRO_DAS_CORES.aco;
}

/** Quanto o terreno aparece. É referência e nunca tapa o muro; no Realista pesa um pouco mais, para ler como chão. */
export function opacidadeDoTerreno(estilo: EstiloVisual): number {
  return estilo === 'realista' ? 0.32 : estilo === 'opaco' ? 0.12 : 0.2;
}

/**
 * O traço das peças: cor, opacidade e a faixa de zoom (pixels por FIADA de
 * 20 cm) em que ele aparece — abaixo de `some`, apagado; acima de `cheio`,
 * inteiro. Sem traço: `null`.
 *
 * ⚠️ NO REALISTA NÃO HÁ TRAÇO: quem separa um bloco do outro é a junta (a
 * fresta de 1 cm entre as peças) e a sombra, como na foto da obra; contorno
 * desenhado é coisa de prancha.
 * ⚠️ NO OPACO O TRAÇO É O DESENHO: preto e mais cheio, e só some bem mais
 * de longe que no Cores — sem ele a massa branca não tem forma.
 */
export function tracoDoEstilo(estilo: EstiloVisual, p: PaletaVisor): { cor: string; opacidade: number; some: number; cheio: number } | null {
  if (estilo === 'realista') return null;
  if (estilo === 'opaco') return { cor: '#1a1a1a', opacidade: 0.9, some: 2, cheio: 8 };
  return { cor: p.aresta, opacidade: 0.5, some: 5, cheio: 15 };
}

/** A massa recebe luz? No Opaco, não (ver acima). */
export const recebeLuz = (estilo: EstiloVisual): boolean => estilo !== 'opaco';

/**
 * A paleta do PALCO (fundo, letra dos eixos, contorno do corte). O tema manda,
 * exceto no Opaco, que é sempre papel: a imagem vai para a prancha, e prancha
 * não tem fundo escuro. A barra e o cubo continuam no tema — são a moldura da
 * tela, não a imagem.
 */
export function paletaDoPalco(p: PaletaVisor, estilo: EstiloVisual, papel: string, tintaDoPapel: string): PaletaVisor {
  if (estilo !== 'opaco') return p;
  return { ...p, fundo: papel, superficie: papel, tinta: tintaDoPapel, escuro: false };
}
