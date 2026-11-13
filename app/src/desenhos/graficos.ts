/*
  GRÁFICOS — as cores, as hachuras, a transparência e o que aparece nos desenhos e no 3D.

  O MODELO (Jose, 16/10: "a configuração de gráficos do menu da engrenagem fosse a geral e a da vista fosse
  'Sobreposição' da vista", e a janela "igual no A-PORT"): o Estilos de objeto e o Visibilidade/Gráficos do Revit.
    · a tabela GERAL (a da engrenagem, guardada no app como os dados do escritório): a cor de cada material na pintura
      dos desenhos e no 3D, a cor do Opaco, a do traço do aço, a hachura de corte, a transparência; a cor de cada
      anotação; a cor de cada bitola no modo Armadura do 3D;
    · a SOBREPOSIÇÃO de uma vista (guardada NA VISTA, no arquivo do muro — pranchas/vistas.ts): só o que aquela vista
      muda — um material, uma anotação, o que ela não mostra (o "Mostrar"). O que a vista não muda segue a geral: a
      cor trocada na engrenagem chega a toda vista que não sobrepôs;
    · o 3D do visor não é vista da lista: a sobreposição dele fica no app (`visor`).
  Até 16/10 era uma tabela por TIPO de vista (manhã de 15/10: uma só); o guardado de antes abre com a da vista frontal
  como geral e a diferença do 3D como sobreposição do visor (lerGraficos).

  Os desenhos leem daqui na hora de desenhar. Cada desenho 2D roda dentro de `naVista(tipo, f, sobreposição)`: quem
  lê a tabela sem dizer a vista (hachuraDe, corDoAcoNoDesenho, a tinta do bloco) recebe a da vista que está sendo
  desenhada — a geral com a sobreposição dela por cima. Variável do módulo e não parâmetro de cada função: a cor chega
  a dezenas de pontos dos desenhos, e a vista, a prancha, o PDF e o DXF têm de sair da MESMA conta. A tela troca a
  geral com `usarGraficos()`, que sobe a `versaoDosGraficos()` — quem guarda desenho pronto põe a versão na
  dependência. Sem ninguém chamar `usarGraficos` (os testes), vale o de fábrica.
*/
import type { ClassePeca, TipoPeca } from '@/modelo/tipos';
import { CORES_DO_JOSE, COR_DO_TIJOLO } from '@/modulacao/catalogo';

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
  | 'inteiro' | 'meio' | 'canaleta' | 'bloco34' | 'bloco54' | 'tijolo'
  | 'alvenaria' | 'graute' | 'aco' | 'concreto' | 'brita' | 'areia' | 'manta' | 'tubo' | 'terra';

/**
 * O que cada material tem: `cor` = a SUPERFÍCIE (a pintura do bloco nos desenhos, a sombra do furo grauteado na vista
 * frontal e o 3D Cores; null = a cor do tema); `opaco` = 3D Opaco; `desenho` = a cor do traço nos desenhos (o aço);
 * `hachura` = o corte; `transparencia` = 0 a 100 %, de 5 em 5 (0 = cheio); `visivel` false = some; `meioTom` = vai para
 * perto do papel (o meio-tom do Revit). Campo ausente = o material não tem aquilo (ou, na sobreposição, não muda).
 */
export interface GraficoDoMaterial {
  cor?: string | null;
  opaco?: string;
  desenho?: string;
  hachura?: Hachura;
  transparencia?: number;
  visivel?: boolean;
  meioTom?: boolean;
}

export const MATERIAIS: readonly { id: Material; rotulo: string }[] = [
  { id: 'inteiro', rotulo: 'Bloco inteiro' },
  { id: 'meio', rotulo: 'Meio bloco' },
  { id: 'canaleta', rotulo: 'Canaleta' },
  { id: 'bloco34', rotulo: 'Bloco 34' },
  { id: 'bloco54', rotulo: 'Bloco 54' },
  { id: 'tijolo', rotulo: 'Tijolo cerâmico' },
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

export type TipoDeVista = 'frontal' | 'corte' | 'planta' | 'iso' | 'armacao';

/** O 3D e os tipos de vista 2D. */
export type VistaDosGraficos = '3d' | TipoDeVista;

export const VISTAS_DOS_GRAFICOS: readonly { id: VistaDosGraficos; rotulo: string }[] = [
  { id: '3d', rotulo: '3D' },
  { id: 'frontal', rotulo: 'Vista frontal' },
  { id: 'corte', rotulo: 'Corte' },
  { id: 'planta', rotulo: 'Planta' },
  { id: 'iso', rotulo: 'Isométrico' },
  { id: 'armacao', rotulo: 'Armação da sapata' },
];

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
  armacao: ['cotas'],
};

/** As CATEGORIAS de modelo da janela (o que se liga e desliga) e os materiais (as subcategorias) de cada uma. */
export const GRUPOS_DE_MATERIAIS: readonly { item: ItemDaVista; materiais: readonly Material[] }[] = [
  { item: 'blocos', materiais: ['inteiro', 'meio', 'canaleta', 'bloco34', 'bloco54', 'tijolo', 'alvenaria'] },
  { item: 'graute', materiais: ['graute'] },
  { item: 'armadura', materiais: ['aco'] },
  { item: 'sapata', materiais: ['concreto'] },
  { item: 'drenagem', materiais: ['brita', 'areia', 'manta', 'tubo'] },
  { item: 'terreno', materiais: ['terra'] },
];

/** As categorias de modelo que cada tipo de vista desenha (as linhas da janela), na ordem dela. */
export const MATERIAIS_DA_VISTA: Readonly<Record<TipoDeVista, readonly ItemDaVista[]>> = {
  frontal: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'terreno'],
  corte: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem', 'terreno'],
  planta: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem'],
  iso: ['blocos', 'graute', 'armadura', 'sapata', 'drenagem'],
  armacao: ['armadura', 'sapata'],
};

export const rotuloDoItem = (i: ItemDaVista): string => ROTULO_DO_ITEM[i];

/**
 * As anotações com cor própria (Jose, 15/10: "inclui as sombras, os textos, cotas e anotações de barras de aço"). O
 * id é a CAMADA do traço (prancha.ts): o que o desenho escreve na camada 'cotas' é cota. `item` = o liga/desliga da
 * vista que ela tem (sem item, o "visível" da anotação mesma: textos e sombras).
 */
export type Anotacao = 'cotas' | 'textos' | 'chamadas' | 'sombras' | 'eixos';

export const ANOTACOES: readonly { id: Anotacao; rotulo: string; item?: ItemDaVista }[] = [
  { id: 'cotas', rotulo: 'Cotas', item: 'cotas' },
  { id: 'textos', rotulo: 'Textos' },
  { id: 'chamadas', rotulo: 'Chamadas e etiquetas das barras', item: 'chamadas' },
  { id: 'sombras', rotulo: 'Sombras das armaduras' },
  { id: 'eixos', rotulo: 'Eixos e juntas', item: 'eixos' },
];

/** A cor da anotação: null = a do desenho. */
export interface GraficoDaAnotacao {
  cor: string | null;
}

/** Uma tabela de gráficos (a geral). */
export interface TabelaDaVista {
  materiais: Record<Material, GraficoDoMaterial>;
  anotacoes: Record<Anotacao, GraficoDaAnotacao>;
}

/** O que uma vista muda num material: os campos da geral, só os que ela troca (a hachura, campo a campo). */
export interface SobreposicaoDoMaterial extends Omit<GraficoDoMaterial, 'hachura'> {
  hachura?: Partial<Hachura>;
}

/**
 * A SOBREPOSIÇÃO de uma vista (o Visibilidade/Gráficos dela): só o que ela muda em relação à geral. `ocultos` = as
 * categorias que ela não mostra (o "Mostrar"); a anotação sem item (textos, sombras) some pelo `visivel` dela.
 */
export interface SobreposicaoDaVista {
  materiais?: Partial<Record<Material, SobreposicaoDoMaterial>>;
  anotacoes?: Partial<Record<Anotacao, { cor?: string; visivel?: boolean }>>;
  ocultos?: ItemDaVista[];
}

export interface Graficos {
  /** A tabela GERAL (a da engrenagem). */
  geral: TabelaDaVista;
  /** Cor de cada Ø no modo Armadura do 3D (as do Revit do Jose): a convenção da bitola, a mesma em todo lugar. */
  bitolas: [number, string][];
  /** A sobreposição do 3D do visor (o 3D não é vista da lista). */
  visor: SobreposicaoDaVista;
}

/**
 * Os materiais de fábrica: as cores e hachuras dos desenhos — as do Revit do Jose (blocos, bitolas, terra, concreto,
 * areia), a brita que ele escolheu e os neutros dos estilos do 3D. O graute vem SEM cor (null = o neutro de cada
 * lugar): na vista frontal a sombra do furo é um cinza escuro transparente (Jose, 16/10: "um tom de cinza
 * transparente"), que escurece qualquer bloco — o cinza claro sumia no inteiro (#787878); no 3D Cores o graute é
 * claro (o pilar grauteado não some entre os inteiros). A cor escolhida na tabela vale para os dois.
 */
export const MATERIAIS_DE_FABRICA: Readonly<Record<Material, GraficoDoMaterial>> = {
  inteiro: { cor: CORES_DO_JOSE.inteiro ?? '#787878' },
  meio: { cor: CORES_DO_JOSE.meio ?? '#004080' },
  canaleta: { cor: CORES_DO_JOSE.canaleta ?? '#ffff80' },
  bloco34: { cor: CORES_DO_JOSE.bloco34 ?? '#ff8040' },
  bloco54: { cor: CORES_DO_JOSE.bloco54 ?? '#ff0000' },
  tijolo: { cor: COR_DO_TIJOLO },
  alvenaria: { opaco: '#ffffff', hachura: { desenho: 'riscado', risco: '#7f7f7f', fundo: '#d9d9d9', escala: 1 } },
  graute: { cor: null, opaco: '#dcdcdc', hachura: { desenho: 'solido', risco: '#2e75b6', fundo: '#bdd7ee', escala: 1 } },
  aco: { cor: '#34373c', opaco: '#4a4a4a', desenho: '#c00000' },
  concreto: { cor: null, opaco: '#ffffff', hachura: { desenho: 'concreto', risco: '#5d5d5d', fundo: '#d4d4d4', escala: 1 } },
  brita: { cor: null, opaco: '#c4c4c4', hachura: { desenho: 'brita', risco: '#4a4a4a', fundo: '#c3bfb5', escala: 1 } },
  areia: { cor: null, opaco: '#e4e4e4', hachura: { desenho: 'areia', risco: '#5d5d5d', fundo: '#ffffb7', escala: 1 } },
  manta: { cor: null, opaco: '#f6f6f6', hachura: { desenho: 'solido', risco: '#5b7f3a', fundo: '#5b7f3a', escala: 1 } },
  tubo: { cor: null, opaco: '#8c8c8c' },
  terra: { cor: null, opaco: '#bdbdbd', hachura: { desenho: 'terra', risco: '#a67857', fundo: '#dbc9bb', escala: 1 } },
};

const ANOTACOES_DE_FABRICA: Readonly<Record<Anotacao, GraficoDaAnotacao>> = {
  cotas: { cor: null }, textos: { cor: null }, chamadas: { cor: null }, sombras: { cor: null }, eixos: { cor: null },
};

export const TABELA_DE_FABRICA: TabelaDaVista = { materiais: { ...MATERIAIS_DE_FABRICA }, anotacoes: { ...ANOTACOES_DE_FABRICA } };

export const GRAFICOS_DE_FABRICA: Graficos = {
  geral: TABELA_DE_FABRICA,
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
  visor: {},
};

let atual: Graficos = GRAFICOS_DE_FABRICA;
let versao = 0;
/** A vista que está sendo desenhada agora (naVista) e a sobreposição dela; fora de qualquer desenho, o 3D. */
let vistaAtual: VistaDosGraficos = '3d';
let sobreposicaoAtual: SobreposicaoDaVista | undefined;

/** Os gráficos em uso (a geral, as bitolas, o visor). */
export const graficos = (): Graficos => atual;

/** Sobe a cada troca: dependência de quem guarda desenho pronto. */
export const versaoDosGraficos = (): number => versao;

export function usarGraficos(g: Graficos): void {
  if (g === atual) return;
  atual = g;
  versao += 1;
}

/**
 * Desenha `f` com os gráficos da vista `v` — a geral com a sobreposição `s` por cima (no 3D, sem `s`, a do visor):
 * quem lê a tabela sem dizer a vista, lá dentro, recebe a dela. Volta à de antes no fim, com erro ou sem (um desenho
 * dentro do outro — a legenda da planta — não bagunça a de fora).
 */
export function naVista<T>(v: VistaDosGraficos, f: () => T, s?: SobreposicaoDaVista): T {
  const [vAntes, sAntes] = [vistaAtual, sobreposicaoAtual];
  vistaAtual = v;
  sobreposicaoAtual = s;
  try {
    return f();
  } finally {
    vistaAtual = vAntes;
    sobreposicaoAtual = sAntes;
  }
}

/** A vista que está sendo desenhada (a Prancha guarda a dela ao nascer). */
export const vistaEmDesenho = (): VistaDosGraficos => vistaAtual;

/** A sobreposição da vista que está sendo desenhada (a Prancha guarda a dela ao nascer, com a vista). */
export const sobreposicaoEmDesenho = (): SobreposicaoDaVista | undefined => sobreposicaoAtual;

/** A sobreposição que vale para `v`: a do desenho em curso (se for desta vista); no 3D, sem ela, a do visor. */
function sobreposicaoDa(v: VistaDosGraficos): SobreposicaoDaVista | undefined {
  if (v === vistaAtual && sobreposicaoAtual) return sobreposicaoAtual;
  return v === '3d' ? atual.visor : undefined;
}

/** Um material da geral com o que a sobreposição muda por cima (a hachura campo a campo). */
function comPorCima(base: GraficoDoMaterial, o: SobreposicaoDoMaterial | undefined): GraficoDoMaterial {
  if (!o) return base;
  const { hachura, ...resto } = o;
  const r: GraficoDoMaterial = { ...base, ...resto };
  if (hachura && base.hachura) r.hachura = { ...base.hachura, ...hachura };
  return r;
}

/** A conta da tabela de uma sobreposição, guardada até os gráficos mudarem (é lida a cada traço). */
const resolvidas = new WeakMap<object, { versao: number; t: Record<Material, GraficoDoMaterial> }>();
const SEM = {};

/** Os materiais que valem na vista (a que está sendo desenhada, se não disser): a geral com a sobreposição dela. */
export function tabelaDaVista(v: VistaDosGraficos = vistaAtual): Record<Material, GraficoDoMaterial> {
  const s = sobreposicaoDa(v);
  if (!s?.materiais) return atual.geral.materiais;
  const ja = resolvidas.get(s ?? SEM);
  if (ja && ja.versao === versao) return ja.t;
  const t = { ...atual.geral.materiais };
  for (const { id } of MATERIAIS) t[id] = comPorCima(atual.geral.materiais[id] ?? MATERIAIS_DE_FABRICA[id], s.materiais[id]);
  resolvidas.set(s, { versao, t });
  return t;
}

/** O item aparece nesta vista? (a sobreposição da vista em desenho diz o que ela não mostra) */
export function aparece(vista: TipoDeVista, item: ItemDaVista): boolean {
  return !sobreposicaoDa(vista)?.ocultos?.includes(item);
}

/** A hachura de corte do material (a de fábrica se a tabela não tiver). */
export function hachuraDe(m: Material, v: VistaDosGraficos = vistaAtual): Hachura {
  return tabelaDaVista(v)[m]?.hachura ?? MATERIAIS_DE_FABRICA[m].hachura ?? { desenho: 'vazio', risco: '#000000', fundo: '#ffffff', escala: 1 };
}

/** A cor do traço do aço nos desenhos. */
export const corDoAcoNoDesenho = (v: VistaDosGraficos = vistaAtual): string => tabelaDaVista(v).aco?.desenho ?? '#c00000';

/** Quanto o material aparece na vista: 1 = cheio, 0 = some (a transparência de 0 a 100 %; o "visível" desligado). */
export function opacidadeDe(m: Material, v: VistaDosGraficos = vistaAtual): number {
  const g = tabelaDaVista(v)[m];
  if (g?.visivel === false) return 0;
  const t = g?.transparencia ?? 0;
  return 1 - Math.min(100, Math.max(0, t)) / 100;
}

/** Quanto a sombra do furo grauteado escurece o bloco na vista frontal, com a transparência do graute em 0 (Jose,
 *  16/10: "um tom de cinza transparente"). */
export const SOMBRA_DO_GRAUTE = 0.35;

/** A cor da sombra do furo grauteado sem cor escolhida: cinza escuro, que escurece o branco, o cinza, o azul e o
 *  amarelo dos blocos (sobre o branco dá um cinza médio). */
const SOMBRA_DE_FABRICA = '#3d3d3d';

/** A cor da sombra do graute na vista (a escolhida na tabela, ou o cinza escuro), sem o meio-tom. */
export const corDaSombraDoGraute = (v: VistaDosGraficos = vistaAtual): string => tabelaDaVista(v).graute?.cor ?? SOMBRA_DE_FABRICA;

/** Quanto o meio-tom leva a cor para o papel (o do A-PORT no tema claro, que é o do papel). */
const MEIO_TOM = 0.6;

/** A cor em meio-tom: misturada com o branco do papel (opaca e mais clara — não é transparência). */
export function emMeioTom(cor: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  if (!m) return cor;
  const v = parseInt(m[1], 16);
  const canal = (k: number) => Math.round(((v >> k) & 255) + (255 - ((v >> k) & 255)) * MEIO_TOM);
  return `#${[16, 8, 0].map((k) => canal(k).toString(16).padStart(2, '0')).join('')}`;
}

/** O material vai em meio-tom nesta vista? */
export const meioTomDe = (m: Material, v: VistaDosGraficos = vistaAtual): boolean => tabelaDaVista(v)[m]?.meioTom === true;

/** A cor que a vista dá à anotação, ou null (fica a do desenho). */
export function corDaAnotacao(a: Anotacao, v: VistaDosGraficos = vistaAtual): string | null {
  return sobreposicaoDa(v)?.anotacoes?.[a]?.cor ?? atual.geral.anotacoes[a]?.cor ?? null;
}

/** A anotação aparece na vista? (cota, chamada e eixo têm o item deles; texto e sombra, o visível de cada um) */
export function anotacaoVisivel(a: Anotacao, v: VistaDosGraficos = vistaAtual): boolean {
  const def = ANOTACOES.find((x) => x.id === a);
  if (def?.item && v !== '3d' && !aparece(v, def.item)) return false;
  return sobreposicaoDa(v)?.anotacoes?.[a]?.visivel !== false;
}

/** A anotação da camada do traço (o id da anotação é a camada), ou undefined. */
export function anotacaoDaCamada(camada: string | undefined): Anotacao | undefined {
  return camada && camada in ANOTACOES_DE_FABRICA ? (camada as Anotacao) : undefined;
}

/** O material da tabela de uma peça do modelo (a alvenaria pela classe; sem classe, a alvenaria geral). */
export function materialDaPeca(tipo: TipoPeca, classe?: ClassePeca): Material | undefined {
  switch (tipo) {
    case 'GRAUTE_FURO':
    case 'GRAUTE_CANALETA':
      return 'graute';
    case 'SAPATA':
    case 'PILARETE':
    case 'CINTA_MC':
      return 'concreto';
    case 'DRENO':
      return 'brita';
    case 'AREIA':
      return 'areia';
    case 'MANTA':
      return 'manta';
    case 'TUBO_DRENO':
    case 'BARBACA':
      return 'tubo';
    case 'ATERRO':
    case 'SOLO_FRENTE':
      return 'terra';
    default:
      return ITEM_DO_TIPO[tipo] === 'blocos' ? (classe ?? 'alvenaria') : undefined;
  }
}

const ITEM_DO_TIPO: Partial<Record<TipoPeca, ItemDaVista>> = {
  BLOCO: 'blocos', MEIO_BLOCO: 'blocos', BLOCO_JUNCAO: 'blocos', BLOCO_CORTADO: 'blocos',
  CANALETA: 'blocos', MEIA_CANALETA: 'blocos', CANALETA_CORTADA: 'blocos',
  GRAUTE_FURO: 'graute', GRAUTE_CANALETA: 'graute',
  SAPATA: 'sapata',
  DRENO: 'drenagem', AREIA: 'drenagem', MANTA: 'drenagem', BARBACA: 'drenagem', TUBO_DRENO: 'drenagem',
  ATERRO: 'terreno', SOLO_FRENTE: 'terreno',
  TIJOLO: 'blocos', TIJOLO_CORTADO: 'blocos', PILARETE: 'sapata', CINTA_MC: 'sapata',
};

/** A peça aparece nesta vista? (o item dela não está desligado; tipo sem item sempre aparece) */
export function pecaAparece(vista: TipoDeVista, tipo: TipoPeca): boolean {
  const item = ITEM_DO_TIPO[tipo];
  return !item || aparece(vista, item);
}

// ── leitura tolerante do que veio guardado ──────────────────────────────────

const ehCor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
const DESENHOS = new Set<string>(DESENHOS_DE_HACHURA.map((d) => d.id));
const ITENS = new Set<string>(Object.keys(ROTULO_DO_ITEM));
const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** A transparência guardada, de 5 em 5 entre 0 e 100 (a régua do A-PORT). */
const transparenciaDe = (t: unknown): number | undefined =>
  typeof t === 'number' && Number.isFinite(t) ? Math.round(Math.min(100, Math.max(0, t)) / 5) * 5 : undefined;

/** Os campos de um material que vieram guardados e valem (o resto cai); a hachura, campo a campo. */
function camposDoMaterial(v: Record<string, unknown>, base: GraficoDoMaterial): SobreposicaoDoMaterial {
  const m: SobreposicaoDoMaterial = {};
  if ('cor' in base && (v.cor === null || ehCor(v.cor))) m.cor = v.cor as string | null;
  if ('opaco' in base && ehCor(v.opaco)) m.opaco = v.opaco;
  if ('desenho' in base && ehCor(v.desenho)) m.desenho = v.desenho;
  const h = objeto(v.hachura);
  if (base.hachura && h) {
    const hh: Partial<Hachura> = {};
    if (typeof h.desenho === 'string' && DESENHOS.has(h.desenho)) hh.desenho = h.desenho as DesenhoDeHachura;
    if (ehCor(h.risco)) hh.risco = h.risco;
    if (ehCor(h.fundo)) hh.fundo = h.fundo;
    if (typeof h.escala === 'number' && h.escala >= 0.1 && h.escala <= 10) hh.escala = h.escala;
    if (Object.keys(hh).length) m.hachura = hh;
  }
  const t = transparenciaDe(v.transparencia);
  if (t !== undefined) m.transparencia = t;
  if (v.visivel === false) m.visivel = false;
  // o meio-tom desligado vale na sobreposição (a vista desfaz o da geral); na geral é o mesmo que nada
  if (typeof v.meioTom === 'boolean') m.meioTom = v.meioTom;
  return m;
}

/**
 * As cores de fábrica que MUDARAM: a tabela guardada leva o material inteiro (com as de fábrica do dia), e a cor
 * antiga de fábrica guardada não é escolha de ninguém — volta à de fábrica de hoje. O graute era bege até 16/10; a
 * sombra do furo grauteado pediu o cinza.
 */
const FABRICA_ANTIGA: Partial<Record<Material, Partial<Record<keyof GraficoDoMaterial, readonly unknown[]>>>> = {
  graute: { cor: ['#c9c6bd', '#7a7a7a'] },
};

/** Os materiais de uma tabela guardada, campo a campo por cima do de fábrica. */
function lerMateriais(ms: Record<string, unknown> | null): Record<Material, GraficoDoMaterial> {
  const materiais = { ...MATERIAIS_DE_FABRICA };
  for (const { id } of MATERIAIS) {
    const v = objeto(ms?.[id]);
    if (!v) continue;
    const campos = camposDoMaterial(v, MATERIAIS_DE_FABRICA[id]);
    for (const [k, antigos] of Object.entries(FABRICA_ANTIGA[id] ?? {})) {
      if (antigos.includes((campos as Record<string, unknown>)[k])) delete (campos as Record<string, unknown>)[k];
    }
    materiais[id] = comPorCima(MATERIAIS_DE_FABRICA[id], campos);
  }
  return materiais;
}

function lerAnotacoes(as: Record<string, unknown> | null): Record<Anotacao, GraficoDaAnotacao> {
  const anotacoes = { ...ANOTACOES_DE_FABRICA };
  for (const { id } of ANOTACOES) {
    const v = objeto(as?.[id]);
    if (v && ehCor(v.cor)) anotacoes[id] = { cor: v.cor };
  }
  return anotacoes;
}

/** Uma sobreposição guardada (no arquivo do muro, na vista; ou a do visor, no app). Vazia = undefined. */
export function lerSobreposicao(x: unknown): SobreposicaoDaVista | undefined {
  const o = objeto(x);
  if (!o) return undefined;
  const s: SobreposicaoDaVista = {};
  const ms = objeto(o.materiais);
  for (const { id } of MATERIAIS) {
    const v = objeto(ms?.[id]);
    if (!v) continue;
    const m = camposDoMaterial(v, MATERIAIS_DE_FABRICA[id]);
    if (Object.keys(m).length) (s.materiais ??= {})[id] = m;
  }
  const as = objeto(o.anotacoes);
  for (const { id } of ANOTACOES) {
    const v = objeto(as?.[id]);
    if (!v) continue;
    const a: { cor?: string; visivel?: boolean } = {};
    if (ehCor(v.cor)) a.cor = v.cor;
    if (v.visivel === false) a.visivel = false;
    if (Object.keys(a).length) (s.anotacoes ??= {})[id] = a;
  }
  if (Array.isArray(o.ocultos)) {
    const oc = [...new Set(o.ocultos.filter((i): i is ItemDaVista => typeof i === 'string' && ITENS.has(i)))];
    if (oc.length) s.ocultos = oc;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Os materiais sem a transparência (a do 3D de 15/10 vira sobreposição do visor, não geral). */
function semTransparencia(ms: Record<Material, GraficoDoMaterial>): Record<Material, GraficoDoMaterial> {
  return Object.fromEntries(Object.entries(ms).map(([id, m]) => {
    const { transparencia: _t, ...resto } = m;
    return [id, resto];
  })) as Record<Material, GraficoDoMaterial>;
}

/** O que uma tabela muda em relação à geral (a diferença do 3D de antes vira a sobreposição do visor). */
function diferenca(t: TabelaDaVista, geral: TabelaDaVista): SobreposicaoDaVista {
  const s: SobreposicaoDaVista = {};
  for (const { id } of MATERIAIS) {
    const [a, b] = [t.materiais[id], geral.materiais[id]];
    const d: SobreposicaoDoMaterial = {};
    for (const k of ['cor', 'opaco', 'desenho'] as const) if (a[k] !== b[k] && a[k] !== undefined) (d as Record<string, unknown>)[k] = a[k];
    // a transparência que falta é 0: o 3D sem transparência desfaz a da geral
    if ((a.transparencia ?? 0) !== (b.transparencia ?? 0)) d.transparencia = a.transparencia ?? 0;
    if (a.hachura && b.hachura && JSON.stringify(a.hachura) !== JSON.stringify(b.hachura)) d.hachura = { ...a.hachura };
    if (Object.keys(d).length) (s.materiais ??= {})[id] = d;
  }
  return s;
}

/**
 * A geral montada das tabelas por tipo de vista de 15/10: cada campo vem da 1ª vista que o MEXEU (a frontal primeiro;
 * a hachura, do corte primeiro — é só no corte que ela aparece; a cor da anotação, da 1ª que a trocou). Assim o que o
 * Jose acertou em qualquer vista continua valendo. A transparência NÃO vem: era escolha de uma vista e, na geral,
 * vazaria para todas (e para o 3D) — a vista que a quiser põe na sobreposição dela.
 */
function geralDasVistas(tabelas: Partial<Record<TipoDeVista, TabelaDaVista>>): TabelaDaVista {
  const ordem: TipoDeVista[] = ['frontal', 'corte', 'planta', 'iso', 'armacao'];
  const daHachura: TipoDeVista[] = ['corte', 'frontal', 'planta', 'iso', 'armacao'];
  const materiais = { ...MATERIAIS_DE_FABRICA };
  for (const { id } of MATERIAIS) {
    const fab = MATERIAIS_DE_FABRICA[id];
    const m: GraficoDoMaterial = { ...fab };
    for (const k of ['cor', 'opaco', 'desenho'] as const) {
      const achada = ordem.map((v) => tabelas[v]?.materiais[id]).find((x) => x && x[k] !== undefined && x[k] !== fab[k]);
      if (achada) (m as Record<string, unknown>)[k] = achada[k];
    }
    if (fab.hachura) {
      const achada = daHachura.map((v) => tabelas[v]?.materiais[id]?.hachura).find((h) => h && JSON.stringify(h) !== JSON.stringify(fab.hachura));
      if (achada) m.hachura = { ...achada };
    }
    materiais[id] = m;
  }
  const anotacoes = { ...ANOTACOES_DE_FABRICA };
  for (const { id } of ANOTACOES) {
    const cor = ordem.map((v) => tabelas[v]?.anotacoes[id]?.cor).find((c) => !!c);
    if (cor) anotacoes[id] = { cor };
  }
  return { materiais, anotacoes };
}

/**
 * O que veio do armazenamento, campo a campo por cima do de fábrica: campo estranho cai, material novo (de uma versão
 * futura do app) entra com o de fábrica — uma cor mal escrita não apaga a tabela inteira. O guardado de 15/10 (uma
 * tabela por tipo de vista; de manhã, uma só) abre com a geral montada das vistas (geralDasVistas), com o Opaco do
 * 3D, e a diferença do 3D vira a sobreposição do visor. O "Mostrar" de cada tipo de vista de 15/10 não tem para onde
 * ir: hoje ele é da vista, no arquivo do muro — volta tudo ligado uma vez.
 */
export function lerGraficos(x: unknown): Graficos {
  const raiz = objeto(x);
  const fab = GRAFICOS_DE_FABRICA;
  if (!raiz) return fab;
  let geral: TabelaDaVista = TABELA_DE_FABRICA;
  let visor: SobreposicaoDaVista = {};
  const g = objeto(raiz.geral);
  const vs = objeto(raiz.vistas);
  if (g) {
    geral = { materiais: lerMateriais(objeto(g.materiais)), anotacoes: lerAnotacoes(objeto(g.anotacoes)) };
    visor = lerSobreposicao(raiz.visor) ?? {};
  } else if (vs) {
    const ler = (id: string): TabelaDaVista | null => {
      const t = objeto(vs[id]);
      return t ? { materiais: lerMateriais(objeto(t.materiais)), anotacoes: lerAnotacoes(objeto(t.anotacoes)) } : null;
    };
    const tabelas: Partial<Record<TipoDeVista, TabelaDaVista>> = {};
    for (const v of ['frontal', 'corte', 'planta', 'iso', 'armacao'] as const) {
      const t = ler(v);
      if (t) tabelas[v] = t;
    }
    const tres = ler('3d');
    geral = Object.keys(tabelas).length ? geralDasVistas(tabelas) : tres ? { ...tres, materiais: semTransparencia(tres.materiais) } : TABELA_DE_FABRICA;
    if (tres) {
      const materiais = { ...geral.materiais };
      for (const { id } of MATERIAIS) if (tres.materiais[id].opaco) materiais[id] = { ...materiais[id], opaco: tres.materiais[id].opaco };
      geral = { ...geral, materiais };
      visor = diferenca(tres, geral);
    }
  } else if (objeto(raiz.materiais)) {
    // a tabela única da manhã de 15/10 valia para todas as vistas: a transparência dela continua de todas
    geral = { materiais: lerMateriais(objeto(raiz.materiais)), anotacoes: { ...ANOTACOES_DE_FABRICA } };
  }
  const bitolas = fab.bitolas.map(([d, c]): [number, string] => {
    const achada = Array.isArray(raiz.bitolas) ? (raiz.bitolas as unknown[]).find((b) => Array.isArray(b) && b[0] === d) : undefined;
    return [d, Array.isArray(achada) && ehCor(achada[1]) ? achada[1] : c];
  });
  return { geral, bitolas, visor };
}

// ── mudar a geral e as sobreposições (a janela de gráficos) ─────────────────

/** A geral com um material mudado. */
export function comGeralDoMaterial(g: Graficos, m: Material, f: (x: GraficoDoMaterial) => GraficoDoMaterial): Graficos {
  return { ...g, geral: { ...g.geral, materiais: { ...g.geral.materiais, [m]: f(g.geral.materiais[m]) } } };
}

/** A geral com a cor de uma anotação mudada. */
export function comGeralDaAnotacao(g: Graficos, a: Anotacao, cor: string | null): Graficos {
  return { ...g, geral: { ...g.geral, anotacoes: { ...g.geral.anotacoes, [a]: { cor } } } };
}

/** A sobreposição sem o que ficou vazio (o material que não muda nada, a lista de ocultos vazia); vazia = undefined. */
export function limparSobreposicao(s: SobreposicaoDaVista | undefined): SobreposicaoDaVista | undefined {
  if (!s) return undefined;
  const r: SobreposicaoDaVista = {};
  for (const [id, o] of Object.entries(s.materiais ?? {}) as [Material, SobreposicaoDoMaterial][]) {
    const m: SobreposicaoDoMaterial = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      if (k === 'hachura') {
        const h = Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined));
        if (Object.keys(h).length) m.hachura = h;
      } else if (!(k === 'visivel' && v === true)) {
        // 0 % e meio-tom desligado ficam: são a vista desfazendo o que a geral pôs (quem escreve não grava o igual à geral)
        (m as Record<string, unknown>)[k] = v;
      }
    }
    if (Object.keys(m).length) (r.materiais ??= {})[id] = m;
  }
  for (const [id, a] of Object.entries(s.anotacoes ?? {}) as [Anotacao, { cor?: string; visivel?: boolean }][]) {
    const x: { cor?: string; visivel?: boolean } = {};
    if (a.cor) x.cor = a.cor;
    if (a.visivel === false) x.visivel = false;
    if (Object.keys(x).length) (r.anotacoes ??= {})[id] = x;
  }
  if (s.ocultos?.length) r.ocultos = [...new Set(s.ocultos)];
  return Object.keys(r).length ? r : undefined;
}

/** A sobreposição com um material mudado (o que fica vazio sai). */
export function noMaterialDaVista(s: SobreposicaoDaVista | undefined, m: Material, f: (x: SobreposicaoDoMaterial) => SobreposicaoDoMaterial): SobreposicaoDaVista | undefined {
  return limparSobreposicao({ ...s, materiais: { ...s?.materiais, [m]: f(s?.materiais?.[m] ?? {}) } });
}

/** A sobreposição com uma anotação mudada. */
export function naAnotacaoDaVista(s: SobreposicaoDaVista | undefined, a: Anotacao, f: (x: { cor?: string; visivel?: boolean }) => { cor?: string; visivel?: boolean }): SobreposicaoDaVista | undefined {
  return limparSobreposicao({ ...s, anotacoes: { ...s?.anotacoes, [a]: f(s?.anotacoes?.[a] ?? {}) } });
}

/** A sobreposição com um item ligado ou desligado (o "Mostrar" da vista). */
export function comItemDaVista(s: SobreposicaoDaVista | undefined, item: ItemDaVista, mostra: boolean): SobreposicaoDaVista | undefined {
  const lista = (s?.ocultos ?? []).filter((i) => i !== item);
  return limparSobreposicao({ ...s, ocultos: mostra ? lista : [...lista, item] });
}
