/*
  PRANCHA — o "papel" onde cada desenho é traçado, no estilo das figuras do projeto (figs/figlib.py): mesmas
  cores, mesma fonte, cota com marca oblíqua; terra, concreto, areia e brita com as hachuras do Revit do Jose (14/10). O desenho do app
  conversa com as figuras de referência que o Jose já validou — mesmo vocabulário visual.

  Por que a prancha mede tudo o que desenha: o viewBox sai da caixa de TUDO o que foi traçado (inclusive a
  largura estimada dos textos). Assim nenhuma cota ou rótulo fica cortado na borda, qualquer que seja o tamanho
  do muro, sem ninguém ter de calcular margem à mão em cada vista. O teste confere isso de fora.

  Fundo claro no SVG autorado (exportar, imprimir); na tela do tema escuro o papel e a tinta trocam por CSS
  (componentes.css, .prancheta-cores — 14/10). Antes, papel branco também no tema escuro: as peças vão pintadas com as cores do Jose (cores.ts) e
  a folha dos desenhos não passa pelo filtro de inversão das outras pranchetas (Desenhos.tsx explica).

  PRIMITIVAS (modo prancha, 14/10): cada traço que vai para o SVG é anotado também como Primitiva (pranchas/tipos.ts),
  em px de desenho, para o gravador de DXF. O SVG é para olho (padrão de hachura, halo, marcador); o DXF precisa
  saber o que cada traço É — e quem sabe é quem desenha, aqui, na hora. Ler o SVG depois seria adivinhar. O SVG
  não muda nada com isso (o teste confere byte a byte nas provas).

  A CAMADA do DXF sai, nesta ordem, do primeiro que responder:
    1. `camada` dita no estilo — quem desenha sabe (estiloDaSecao, estiloPintado, eixos, legenda, barbacã, peças
       do isométrico, cotas);
    2. o padrão de preenchimento: solo → terreno · conc → concreto · alv → alvenaria · brita e areia → drenagem ·
       graute → graute;
    3. a cor da tinta (preenchimento, depois contorno): aço → aco · terra → terreno · graute → graute;
    4. o grupo aberto por abrir('data-camada="…"'): sapata → concreto · alvenaria e contraforte → alvenaria ·
       graute → graute · barras → aco · cotas → cotas · terreno → terreno (os grupos misturados — secao, pecas,
       corte — não dizem nada: lá cada peça já disse a sua no passo 1);
    5. 'geral'.
  Texto vai em 'textos', menos o rótulo de cota ('cotas', dito pela própria cota) e o da legenda ('legenda').
  Camadas que saem: alvenaria, graute, concreto, aco, terreno, drenagem, cotas, eixos (eixo de contraforte e
  junta de controle), textos, legenda, geral.

  O que fica FORA das primitivas, de propósito: o halo branco do texto e o filete branco sob a barra (`soTela`) —
  são truques de tela para ler por cima da hachura; plotados em monocromático, o branco vira preto grosso. A
  opacidade também não passa (o DXF não tem; hoje nenhum desenho usa).

  HACHURA EM VETOR (o SVG que vai para o PDF, `hachuraVetorial`): o Chrome — e o printToPDF do Electron, mesmo
  motor — imprime todo <pattern> como IMAGEM, numa resolução que ele escolhe (~37 dpi numa A1: 473 imagens, 51 MB
  em 3 folhas, a terra pixelada e desbotada no zoom). Linha e texto saem em vetor; só o padrão não. Então, no SVG de
  saída, área hachurada não usa <pattern>: vira
    1. o fundo do ladrilho como cor chapada da própria área;
    2. os riscos do ladrilho repetidos com <use> de um <symbol> (um por material, nos defs), recortados pela área
       (<clipPath> com o mesmo contorno, par-ímpar — o furo continua furo). O <symbol> recorta cada cópia no
       quadrado do ladrilho, como o <pattern> recorta: o risco que o ladrilho corta na borda sai cortado igual;
    3. o contorno por cima, como o traço sobre o padrão.
  Os ladrilhos ficam na mesma grade do <pattern> (origem em 0,0 do desenho; o giro de 45° do riscado da alvenaria e
  do graute também): tela e papel mostram o mesmo desenho, risco por risco. Os dois riscados de linha (alvenaria,
  graute) não precisam de ladrilho: a coluna de ladrilhos empilhados É um risco comprido, e sai assim, um traço por
  coluna. A tela não muda (sem a opção, o SVG é o de antes byte a byte) e as primitivas também não (o DXF tem as
  hachuras dele).
*/
import { CORPO_DA_COTA, type AnotacaoPosta, type ChamadaPosta, type CotaNova, type EtiquetaNova, type InfoDaAnotacao, type InfoDaChamada, type PadraoHachura, type Primitiva, type RegiaoDoDesenho, type TextoNovo, type Traco } from '@/pranchas/tipos';
import { cm, esc, n } from './formato';
import { HACHURA, ladrilhoDe, padraoDoLadrilho, type Ladrilho } from './hachuras';
import { anotacaoDaCamada, anotacaoVisivel, corDaAnotacao, corDoAcoNoDesenho, emMeioTom, hachuraDe, meioTomDe, naVista, opacidadeDe, sobreposicaoEmDesenho, vistaEmDesenho, type Hachura, type Material, type SobreposicaoDaVista, type VistaDosGraficos } from './graficos';

/** Cores das figuras (figlib.C) + as que os desenhos de obra pedem a mais (peça especial, brita). */
export const COR = {
  linha: '#262626',
  cota: '#404040',
  bloco: '#7f7f7f',
  blocoFundo: '#d9d9d9',
  graute: '#2e75b6',
  grauteFundo: '#bdd7ee',
  aco: '#c00000',
  solo: HACHURA.terra,          // a terra do Revit do Jose (14/10; antes #8d6e3f sobre #e8d8b9)
  soloFundo: HACHURA.terraFundo,
  nota: '#595959',
  concreto: HACHURA.concretoFundo,
  especial: '#b07d2b',
  especialFundo: '#f3e3c3',
  brita: HACHURA.brita,
  britaFundo: HACHURA.britaFundo,
  areia: HACHURA.areia,
  areiaFundo: HACHURA.areiaFundo,
  manta: '#5b7f3a',
  furo: '#ffffff',
  furoEscuro: '#6e6e6e',
} as const;

export const FONTE = "Arial,'DejaVu Sans',sans-serif";

/** Largura de um caractere de Arial em em (arredondada para cima) — estimativa só para a caixa do texto. */
function larguraDoCaractere(c: string): number {
  if (' '.includes(c)) return 0.28;
  if ('.,:;\'!|iljI'.includes(c)) return 0.28;
  if ('ftrª'.includes(c)) return 0.36;
  if (c === '—') return 1;      // o travessão da Arial é 1 em: com 0,86 o valor depois de " — " encostava nele
  if ('mwMW'.includes(c)) return 0.86;
  if (c >= '0' && c <= '9') return 0.56;
  if ('×=+−-<>'.includes(c)) return 0.6;
  if (c.toUpperCase() === c && c.toLowerCase() !== c) return 0.7;    // maiúscula (com acento também)
  return 0.56;
}

export interface Estilo {
  fill?: string;
  stroke?: string;
  sw?: number;
  dash?: string;
  opacidade?: number;
  id?: string;          // vira data-id: liga o traço à peça do modelo (seleção, teste)
  extra?: string;
  /** Camada do DXF, quando o grupo e o material não bastam para dizer o que o traço é (não vai para o SVG). */
  camada?: string;
  /** Só para a tela (o filete branco sob a barra): fica fora das primitivas — plotado em monocromático, o branco
   *  vira um traço preto grosso por baixo da barra. */
  soTela?: boolean;
  /** Só para o ARQUIVO (o DXF): não vai para o SVG. A sombra do graute vai em transparência na tela e no PDF; no DXF,
   *  que não tem transparência, vai já misturada com a cor do bloco de baixo, peça por peça (vistaFrontal.ts). */
  soArquivo?: boolean;
  /** O material da tabela de gráficos por trás do traço, quando o padrão e a camada não dizem (o bloco pintado):
   *  a transparência da vista vale para ele. */
  material?: Material;
}

export interface OpcoesTexto {
  tam?: number;
  ancora?: 'start' | 'middle' | 'end';
  cor?: string;
  negrito?: boolean;
  vertical?: boolean;   // girado −90° (lê de baixo para cima), como cota vertical
  /** Giro qualquer, graus anti-horários (a chamada que o Jose gira na folha); vale por cima de `vertical`. */
  giro?: number;
  halo?: boolean;       // contorno branco por baixo: texto legível em cima de hachura
  camada?: string;      // camada do DXF (padrão 'textos')
  /** A chave da anotação dita pelo desenho, quando ele sabe separar textos iguais (a sombra de baixo e a de cima):
   *  vale no lugar do "texto + ordem" (Prancha, "ANOTAÇÃO EDITÁVEL"). */
  chave?: string;
}

/** As camadas do texto solto que o projetista mexe na folha: o rótulo, o do eixo (C1, JC), o da sombra e o do terreno
 *  ("aterro"). A cota, a chamada, a legenda e o título têm regra própria ou não se mexem. */
const TEXTO_EDITAVEL = new Set(['textos', 'eixos', 'sombras', 'terreno']);

/** Até onde (px de desenho) a anotação repetida pode ter andado e o ajuste ainda vale (AnotacaoPosta.ref). */
const ANDOU_DEMAIS = 30;

/**
 * O que a prancha (modo prancha, pranchas/) pede a cada vista: a escala fixa, sem o título interno e com o prefixo
 * dos ids. Ausente, a vista se ajeita para a tela como sempre.
 */
export interface OpcoesDaVista {
  /** px de desenho por mm do muro (escalaDaVista(25) para 1:25). Ausente = a que cabe na tela (escalaPara). */
  S?: number;
  /** Tira o título interno ("Corte em x = …", "Planta — 1ª fiada", "cotas em cm"): a prancha põe o dela embaixo. */
  semTitulo?: boolean;
  /** Prefixo dos ids dos padrões e marcadores: a folha tem várias vistas num SVG só, os ids não podem colidir. */
  prefixo?: string;
  /** Tira da legenda as cores dos blocos: na prancha elas estão no quadro lateral, uma vez para a folha toda. */
  semLegendaDeCores?: boolean;
  /** Hachura em traço de verdade, sem <pattern> (o SVG do PDF; ver "HACHURA EM VETOR" no cabeçalho). */
  hachuraVetorial?: boolean;
  /** Chamadas das barras ("N1 – 15 Ø10 c/40 C=210", desenhos/chamadas.ts) numa coluna à direita: a prancha pede. */
  chamadas?: boolean;
  /** As chamadas que o projetista tirou da coluna (lugar, giro, escondida), por chave — guardadas no item da folha. */
  chamadasPostas?: Readonly<Record<string, ChamadaPosta>>;
  /** Os ajustes do projetista nas cotas e textos automáticos, por chave (Prancha, "ANOTAÇÃO EDITÁVEL"). */
  anotacoes?: Readonly<Record<string, AnotacaoPosta>>;
  /** As etiquetas de aço que o projetista pôs (desenhos/chamadas.ts, desenharEtiquetas). */
  etiquetas?: readonly EtiquetaNova[];
  /** A sobreposição de gráficos da vista (graficos.ts): a geral com ela por cima. */
  graficos?: SobreposicaoDaVista;
}

export type Pt = [number, number];

/** Os preenchimentos de material da prancha: o nome vira o id do padrão (`des-solo`, `des-conc`…). */
export type NomeDoPadrao = 'solo' | 'conc' | 'alv' | 'brita' | 'areia' | 'graute' | 'grc' | 'mnt';
const NOMES_DOS_PADROES: readonly NomeDoPadrao[] = ['solo', 'conc', 'alv', 'brita', 'areia', 'graute', 'grc', 'mnt'];

/**
 * O material da tabela de gráficos (graficos.ts) por trás de cada padrão, e a camada do DXF dele. `graute` é o
 * graute VISTO atrás da face do bloco (vista frontal); `grc`, o graute cortado; `mnt`, a manta.
 */
const DO_PADRAO: Record<NomeDoPadrao, { material: Material; camada: string }> = {
  solo: { material: 'terra', camada: 'terreno' },
  conc: { material: 'concreto', camada: 'concreto' },
  alv: { material: 'alvenaria', camada: 'alvenaria' },
  brita: { material: 'brita', camada: 'drenagem' },
  areia: { material: 'areia', camada: 'drenagem' },
  graute: { material: 'graute', camada: 'graute' },
  grc: { material: 'graute', camada: 'graute' },
  mnt: { material: 'manta', camada: 'drenagem' },
};

/**
 * A hachura de um padrão na tabela em uso (o Jose controla desenho, cores e escala — 15/10). O graute visto é sempre
 * riscado, na cor do fundo do graute e SEM fundo próprio: a cor do tipo de bloco (o código de cor da obra)
 * continua aparecendo entre os riscos — um tom chapado por cima tingia o cinza do inteiro de azul e ele passava
 * por meio bloco.
 */
export function hachuraDoPadrao(nome: NomeDoPadrao, vista?: VistaDosGraficos): Hachura {
  const m = DO_PADRAO[nome].material;
  const h0 = hachuraDe(m, vista);
  // o meio-tom do material (16/10, o do A-PORT): o risco e o fundo vão para perto do papel
  const h = meioTomDe(m, vista) ? { ...h0, risco: emMeioTom(h0.risco), fundo: h0.fundo === 'none' ? 'none' : emMeioTom(h0.fundo) } : h0;
  if (nome === 'graute') return { desenho: 'riscado', risco: h.fundo, fundo: 'none', escala: h.escala };
  return h;
}

/**
 * O riscado de linha só: um risco vertical em x = 0 de cada ladrilho `passo` × `passo`, a grade girada de `giro`
 * graus. Daqui saem o <pattern> da tela e o traço do PDF — o mesmo desenho nos dois. Passo de 6 px (o da
 * alvenaria) e de 5 px mais grosso no graute visto.
 */
function riscadoDe(nome: NomeDoPadrao, h: Hachura): { passo: number; giro: number; fundo?: string; risco: string; sw: number } {
  const graute = nome === 'graute';
  return { passo: (graute ? 5 : 6) * h.escala, giro: 45, fundo: h.fundo === 'none' ? undefined : h.fundo, risco: h.risco, sw: graute ? 1.6 : 0.9 };
}
type Riscado = ReturnType<typeof riscadoDe>;

function padraoRiscado(id: string, r: Riscado): string {
  const fundo = r.fundo ? `<rect width="${r.passo}" height="${r.passo}" fill="${r.fundo}"/>` : '';
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r.passo}" height="${r.passo}" patternTransform="rotate(${r.giro})">` +
    `${fundo}<line x1="0" y1="0" x2="0" y2="${r.passo}" stroke="${r.risco}" stroke-width="${r.sw}"/></pattern>`
  );
}

/**
 * Padrão do SVG → hachura do DXF: o padrão do CAD, o fundo e o risco (as cores da tabela), a escala sobre a calibrada
 * e a camada do material. null = 'vazio' (sai só o contorno).
 */
function hachuraDxf(nome: NomeDoPadrao, vista: VistaDosGraficos): { padrao: PadraoHachura; fundo?: string; risco: string; camada: string; escala: number } | null {
  const h = hachuraDoPadrao(nome, vista);
  const camada = DO_PADRAO[nome].camada;
  const fundo = h.fundo === 'none' ? undefined : h.fundo;
  switch (h.desenho) {
    case 'vazio':
      return null;
    case 'solido':
      return { padrao: 'solido', fundo: h.fundo, risco: h.risco, camada, escala: 1 };
    case 'riscado':
      return { padrao: nome === 'graute' ? 'graute' : 'alvenaria', fundo, risco: h.risco, camada, escala: h.escala };
    default:
      return { padrao: h.desenho, fundo, risco: h.risco, camada, escala: h.escala };
  }
}

/** Número das posições da hachura em vetor: três casas (a grade não pode andar o 0,1 px do `n` a cada ladrilho). */
function n3(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Tintas que, sozinhas, já dizem o material (passo 3 do cabeçalho), pela tabela em uso. */
function camadaDaCor(cor: string, vista: VistaDosGraficos): string | undefined {
  if (cor === corDoAcoNoDesenho(vista)) return 'aco';
  if (cor === hachuraDe('terra', vista).risco) return 'terreno';
  const g = hachuraDe('graute', vista);
  if (cor === g.risco || cor === g.fundo) return 'graute';
  return undefined;
}

/** Grupo do SVG (data-camada) → camada do DXF (passo 4 do cabeçalho). */
const CAMADA_DO_GRUPO: Record<string, string> = {
  sapata: 'concreto',
  alvenaria: 'alvenaria',
  contraforte: 'alvenaria',
  graute: 'graute',
  barras: 'aco',
  cotas: 'cotas',
  terreno: 'terreno',
};

/**
 * A marca oblíqua da cota: um risco de (2,8) a (8,2) numa caixa 10 × 10 com a referência no centro, desenhado a
 * 8 px. Os números moram aqui uma vez só: o <marker> do SVG e os dois riscos do DXF saem da mesma conta.
 */
const MARCA = { caixa: 10, ref: 5, lado: 8, de: [2, 8] as Pt, ate: [8, 2] as Pt, sw: 1.5 };

function tracejado(dash: string | undefined): number[] | undefined {
  if (!dash) return undefined;
  const v = dash.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x));
  return v.length ? v : undefined;
}

export class Prancha {
  private corpo: string[] = [];
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;
  private prims: Primitiva[] = [];
  /** Pilha dos grupos abertos (data-camada de cada um; quem abre sem camada herda a de fora). */
  private grupos: string[] = [];
  /** Hachura em vetor: os recortes (<clipPath>) de cada área e os ladrilhos que alguma área usou. */
  private recortes: string[] = [];
  private ladrilhosUsados = new Map<NomeDoPadrao, Ladrilho>();

  /** Item desligado na vista (Visibilidade, graficos.ts): o que se pede enquanto mudo não entra no desenho nem na
   *  caixa. Assim a vista desliga um bloco de cotas inteiro sem perder as contas de posição que vêm depois. */
  private mudo = false;

  /**
   * A caixa de REFERÊNCIA (VistaParaPrancha.referencia): a de tudo, menos a chamada que saiu da coluna — essa
   * reserva o lugar que tinha na coluna (desenhos/chamadas.ts). É ela que prende o desenho na folha.
   */
  private r0 = Infinity;
  private s0 = Infinity;
  private r1 = -Infinity;
  private s1 = -Infinity;
  private foraDaRef = false;

  /** As chamadas das barras como saíram (a tela da prancha pega e arrasta). */
  readonly chamadas: InfoDaChamada[] = [];

  /*
    ANOTAÇÃO EDITÁVEL (Jose, 15/10: "deletar ou criar cotas e mover anotações em geral, escrever de novo o que
    quiser"). Cada cota (cada trecho de uma cadeia) e cada texto solto (camada 'textos') ganha uma CHAVE: o tipo, o
    texto de origem e quantos iguais vieram antes nesta prancha ("cota:B = 140#0"). A folha guarda, por chave, o
    ajuste do projetista (AnotacaoPosta) e a prancha desenha com ele. A anotação mexida deixa o lugar de origem
    reservado na caixa de referência — o FANTASMA: desenha a original, fica só a caixa, o traço vai fora —, e o
    desenho não pula na folha nem o título desce. O lugar dos outros também não muda: a cadeia arranja os números
    pelos textos de origem.
  */
  private ajustes: Readonly<Record<string, AnotacaoPosta>> = {};
  private vezes = new Map<string, number>();
  /** As cotas e textos editáveis como saíram (a tela da prancha pega, arrasta e reescreve). */
  readonly anotacoes: InfoDaAnotacao[] = [];

  /** px de desenho por mm do muro (o S da vista): o lugar guardado no ajuste está em mm do muro. */
  private escalaDosAjustes = 0;

  /** Os ajustes que a folha guardou para as anotações desta prancha (antes de desenhar); S = px por mm do muro. */
  ajustar(a: Readonly<Record<string, AnotacaoPosta>> | undefined, S?: number): void {
    this.ajustes = a ?? {};
    this.escalaDosAjustes = S ?? 0;
  }

  /**
   * O ajuste guardado, se ainda vale. Com o lugar guardado (AnotacaoPosta.ref, mm do muro), só perto de onde foi
   * feito — senão é de outra anotação que herdou a chave. Com o texto de origem guardado e diferente do de agora (o
   * muro mudou), o texto reescrito e o esconder caem: o número certo volta; o lugar e o giro ficam.
   */
  private valeOAjuste(a: AnotacaoPosta | undefined, origem: Pt, original: string): AnotacaoPosta | undefined {
    if (!a) return a;
    const S = this.escalaDosAjustes;
    if (a.ref && S > 0 && Math.hypot(origem[0] - a.ref[0] * S, origem[1] - a.ref[1] * S) > ANDOU_DEMAIS) return undefined;
    if (a.original !== undefined && a.original !== original) {
      const { texto: _t, oculta: _o, ...resto } = a;
      return resto;
    }
    return a;
  }

  private chaveNova(tipo: 'texto' | 'cota', t: string): string {
    const base = `${tipo}:${t}`;
    const k = this.vezes.get(base) ?? 0;
    this.vezes.set(base, k + 1);
    return `${base}#${k}`;
  }

  /** Desenha `f` só para a caixa de referência: o traço e a caixa de verdade voltam ao que eram. */
  private fantasma(f: () => void): void {
    const [nc, np] = [this.corpo.length, this.prims.length];
    const caixa = [this.x0, this.y0, this.x1, this.y1];
    const antes = this.foraDaRef;
    this.foraDaRef = false;
    f();
    this.foraDaRef = antes;
    this.corpo.length = nc;
    this.prims.length = np;
    [this.x0, this.y0, this.x1, this.y1] = caixa;
  }

  /** Desenha `f` fora da caixa de referência (a anotação fora do lugar de origem, a criada na folha). */
  private foraDoLugar(f: () => void): void {
    const antes = this.foraDaRef;
    this.foraDaRef = true;
    f();
    this.foraDaRef = antes;
  }

  /** O que se desenha agora fica fora da caixa de referência (a chamada posta: desenhos/chamadas.ts). */
  foraDaReferencia(sim: boolean): void {
    this.foraDaRef = sim;
  }

  /** Reserva um retângulo na caixa de referência sem desenhar nada (o lugar que a chamada tinha na coluna). */
  reservar(xa: number, ya: number, xb: number, yb: number): void {
    if (![xa, ya, xb, yb].every(Number.isFinite)) return;
    this.r0 = Math.min(this.r0, xa, xb);
    this.s0 = Math.min(this.s0, ya, yb);
    this.r1 = Math.max(this.r1, xa, xb);
    this.s1 = Math.max(this.s1, ya, yb);
  }

  silenciar(mudo: boolean): void {
    this.mudo = mudo;
  }

  /**
   * `hachuraVetorial`: o SVG do PDF, sem <pattern> (cabeçalho, "HACHURA EM VETOR"). `vista`: a tabela de gráficos
   * desta prancha — a da vista que está sendo desenhada quando ela nasce (graficos.ts, naVista); guardada porque o
   * <defs> dos padrões sai depois que a função de desenho já voltou.
   */
  /** A sobreposição de gráficos da vista em que a prancha nasceu: o que se desenha DEPOIS (os <pattern> do partes(),
   *  as cotas e textos criados na folha) usa a mesma, e não a geral. */
  private readonly sobreposicao: SobreposicaoDaVista | undefined = sobreposicaoEmDesenho();

  constructor(readonly prefixo = 'des', readonly hachuraVetorial = false, readonly vista: VistaDosGraficos = vistaEmDesenho()) {}

  /** Roda `f` com os gráficos da vista desta prancha (a vista e a sobreposição com que ela nasceu). */
  private naMinhaVista<T>(f: () => T): T {
    return naVista(this.vista, f, this.sobreposicao);
  }

  /** A cor que a vista dá à anotação desta camada (cota, texto, chamada, sombra, eixo), ou a do desenho. */
  private corDe(camada: string | undefined, padrao: string): string {
    const a = anotacaoDaCamada(camada);
    return (a && corDaAnotacao(a, this.vista)) || padrao;
  }

  /** A opacidade do traço pela transparência da vista: o material dito, o do padrão ou o aço. 1 = cheio. */
  /** O material por trás do traço: o dito, o do padrão de preenchimento, ou o aço pela camada. */
  private materialDoTraco(e: Estilo, fill: string, stroke: string): Material | undefined {
    const nome = this.nomeDoPadrao(fill);
    return e.material ?? (nome ? DO_PADRAO[nome].material : this.camadaDe(e, fill, stroke) === 'aco' ? 'aco' : undefined);
  }

  /** A cor do traço com o meio-tom do material, se a vista pede (a cor de padrão url(#…) já vem clara do <pattern>). */
  private comMeioTom(e: Estilo, fill: string, stroke: string, cor: string): string {
    if (!cor.startsWith('#')) return cor;
    const m = this.materialDoTraco(e, fill, stroke);
    return m && meioTomDe(m, this.vista) ? emMeioTom(cor) : cor;
  }

  private opacidadeDoTraco(e: Estilo, fill: string, stroke: string): number {
    const m = this.materialDoTraco(e, fill, stroke);
    if (!m) return 1;
    // no 3D (visor e o 3D em vetor da prancha) a linha "Alvenaria" vale para todo bloco, por cima da do tipo dele;
    // no 2D ela é só o bloco cortado
    const doBloco = this.vista === '3d' && (m === 'inteiro' || m === 'meio' || m === 'canaleta' || m === 'bloco34' || m === 'bloco54');
    return opacidadeDe(m, this.vista) * (doBloco ? opacidadeDe('alvenaria', '3d') : 1);
  }

  /** Referência a um padrão de preenchimento desta prancha. */
  padrao(nome: NomeDoPadrao): string {
    return `url(#${this.prefixo}-${nome})`;
  }

  /**
   * O x mais à direita do que já foi traçado NO LUGAR DE ORIGEM (a caixa de referência; texto pela largura estimada),
   * px de desenho. A anotação que o projetista arrastou para fora não conta: senão arrastar uma cota para a direita
   * empurrava a coluna das chamadas e, na armação, a seção e a sombra do estribo.
   */
  direita(): number {
    return Number.isFinite(this.r1) ? this.r1 : this.x1;
  }

  /** As partes do desenho com origem própria (RegiaoDoDesenho), na ordem em que nasceram. */
  readonly regioes: RegiaoDoDesenho[] = [];

  /** Marca uma parte do desenho com origem própria (a seção da armação, a sombra de um estribo). */
  regiao(nome: string, origem: Pt, caixa: [number, number, number, number]): void {
    this.regioes.push({ nome, origem, caixa });
  }

  /**
   * O material a 100 % de transparência na vista: o traço sai da tela, do PDF e do DXF (e da captura da ferramenta
   * Cota, que lê as primitivas), mas o lugar fica na caixa — apagar a terra não faz o desenho pular na folha.
   */
  /**
   * A categoria de anotação da camada aparece nesta vista? A desligada (Mostrar, ou o visível da janela de gráficos)
   * guarda o lugar do que seria desenhado (o desenho não pula na folha), mas não publica a anotação editável: senão
   * a folha teria um alvo invisível de clique e arrasto, e a borda vermelha contaria o que não está lá.
   */
  private categoriaVisivel(camada: string | undefined): boolean {
    const a = anotacaoDaCamada(camada);
    return !a || anotacaoVisivel(a, this.vista);
  }

  private apagado(e: Estilo, fillPadrao = 'none', strokePadrao: string = COR.linha): boolean {
    const a = anotacaoDaCamada(e.camada);
    if (a && !anotacaoVisivel(a, this.vista)) return true;
    return this.opacidadeDoTraco(e, e.fill ?? fillPadrao, e.stroke ?? strokePadrao) <= 0;
  }

  /** Os traços já desenhados, estruturados para o DXF (px de desenho, y para baixo). */
  primitivas(): Primitiva[] {
    return [...this.prims];
  }

  /** O nome do padrão por trás de um `fill="url(#…)"` desta prancha (null para cor chapada ou 'none'). */
  private nomeDoPadrao(fill: string | undefined): NomeDoPadrao | null {
    const m = fill?.match(/^url\(#(.+)\)$/);
    if (!m || !m[1].startsWith(`${this.prefixo}-`)) return null;
    const nome = m[1].slice(this.prefixo.length + 1);
    return nome in DO_PADRAO ? (nome as NomeDoPadrao) : null;
  }

  /**
   * A área hachurada em vetor (cabeçalho, "HACHURA EM VETOR"): fundo chapado, riscos recortados pela área, contorno
   * por cima. Volta false quando a área vai como sempre (tela, ou preenchimento que não é padrão).
   */
  private areaEmVetor(aneis: Pt[][], e: Estilo): boolean {
    if (!this.hachuraVetorial) return false;
    const nome = this.nomeDoPadrao(e.fill);
    const fechados = aneis.filter((a) => a.length >= 3);
    if (!nome || !fechados.length) return false;
    const d = fechados.map((a) => 'M' + a.map(([x, y]) => `${n(x)},${n(y)}`).join('L') + 'Z').join('');
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const a of fechados) {
      for (const [x, y] of a) {
        [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      }
    }
    if (![x0, y0, x1, y1].every(Number.isFinite)) return false;
    const id = `${this.prefixo}-rec${this.recortes.length}`;
    // um <path> só dentro do <clipPath>: assim o Chrome recorta pelo caminho (vetor no PDF); com mais de um filho ele
    // passa a recortar por máscara, e máscara o PDF guarda como imagem — o defeito de volta por outra porta
    this.recortes.push(`<clipPath id="${id}"><path d="${d}" clip-rule="evenodd"/></clipPath>`);

    let fundo: string | undefined;
    let riscos = '';
    const h = hachuraDoPadrao(nome, this.vista);
    if (h.desenho === 'riscado') {
      const r = riscadoDe(nome, h);
      fundo = r.fundo;
      riscos = this.riscadoEmVetor(r, x0, y0, x1, y1);
    } else if (h.desenho === 'solido') {
      fundo = h.fundo;
    } else if (h.desenho !== 'vazio') {
      const l = ladrilhoDe(h);
      fundo = l.fundo;
      this.ladrilhosUsados.set(nome, l);
      // as casas da grade do <pattern> (origem 0,0) que a caixa da área toca; o recorte tira o que sobra
      const L = l.lado;
      for (let i = Math.floor(x0 / L); i * L < x1; i++) {
        for (let j = Math.floor(y0 / L); j * L < y1; j++) {
          riscos += `<use href="#${this.prefixo}-lad-${nome}" x="${n3(i * L)}" y="${n3(j * L)}" width="${n3(L)}" height="${n3(L)}"/>`;
        }
      }
    }

    const g: string[] = [];
    if (e.id) g.push(`data-id="${esc(e.id)}"`);
    const op = (e.opacidade ?? 1) * this.opacidadeDoTraco(e, e.fill ?? 'none', e.stroke ?? COR.linha);
    if (op < 1) g.push(`opacity="${Math.min(1, Math.max(0, op)).toFixed(2)}"`);
    if (e.extra) g.push(e.extra);
    let s = `<g${g.length ? ' ' + g.join(' ') : ''}>`;
    if (fundo) s += `<path d="${d}" fill-rule="evenodd" fill="${fundo}" stroke="none"/>`;
    s += `<g clip-path="url(#${id})">${riscos}</g>`;
    if ((e.stroke ?? COR.linha) !== 'none') {
      // o contorno sem miolo leva o material que o padrão dizia (sem ele, o meio-tom da hachura não chegava à borda)
      const material = this.materialDoTraco(e, e.fill ?? 'none', e.stroke ?? COR.linha);
      s += `<path d="${d}" fill-rule="evenodd" ${this.atributos({ ...e, fill: 'none', material, id: undefined, opacidade: undefined, extra: undefined })}/>`;
    }
    this.corpo.push(s + '</g>');
    return true;
  }

  /**
   * O riscado (alvenaria, graute) em vetor: um traço por coluna da grade girada, cobrindo a caixa da área. No
   * <pattern> o risco em x = 0 é cortado pela borda do próprio ladrilho — só a metade de dentro aparece, de 0 a
   * sw/2 —, então o traço do PDF sai com sw/2 de largura, centrado em sw/4: a mesma faixa pintada da tela.
   */
  private riscadoEmVetor(r: Riscado, x0: number, y0: number, x1: number, y1: number): string {
    const a = (r.giro * Math.PI) / 180;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    // a caixa da área levada para o sistema da grade (o inverso do rotate do patternTransform)
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]) {
      const [u, v] = [x * c + y * s, -x * s + y * c];
      [u0, v0, u1, v1] = [Math.min(u0, u), Math.min(v0, v), Math.max(u1, u), Math.max(v1, v)];
    }
    let d = '';
    for (let i = Math.floor(u0 / r.passo); i * r.passo < u1; i++) d += `M${n3(i * r.passo + r.sw / 4)},${n3(v0)}V${n3(v1)}`;
    if (!d) return '';
    return `<path d="${d}" transform="rotate(${r.giro})" fill="none" stroke="${r.risco}" stroke-width="${n3(r.sw / 2)}"/>`;
  }

  /** A camada do DXF de um traço (ordem no cabeçalho). */
  private camadaDe(e: Estilo, fill: string, stroke: string): string {
    if (e.camada) return e.camada;
    const nome = this.nomeDoPadrao(fill);
    if (nome) return DO_PADRAO[nome].camada;
    const porCor = camadaDaCor(fill, this.vista) ?? camadaDaCor(stroke, this.vista);
    if (porCor) return porCor;
    const grupo = this.grupos[this.grupos.length - 1];
    return (grupo && CAMADA_DO_GRUPO[grupo]) || 'geral';
  }

  private traco(stroke: string, e: Estilo, camada: string): Traco {
    const t: Traco = { camada, cor: this.comMeioTom(e, e.fill ?? 'none', stroke, stroke), espessura: e.sw ?? 1 };
    const d = tracejado(e.dash);
    if (d) t.tracejado = d;
    return t;
  }

  /**
   * Área (retângulo, polígono, caminho com furos): hachura com o contorno junto (`borda`); sem preenchimento, só o
   * contorno, cada anel uma polilinha fechada. Mesmos padrões de fill/stroke do atributos().
   */
  private anotarArea(aneis: Pt[][], e: Estilo, fillPadrao = 'none', strokePadrao: string = COR.linha): void {
    if (e.soTela) return;
    const fill = e.fill ?? fillPadrao;
    const stroke = e.stroke ?? strokePadrao;
    const camada = this.camadaDe(e, fill, stroke);
    const borda = stroke !== 'none' ? this.traco(stroke, e, camada) : undefined;
    const fechados = aneis.filter((a) => a.length >= 3).map((a) => a.map(([x, y]): Pt => [x, y]));
    const nome = this.nomeDoPadrao(fill);
    const p = nome ? hachuraDxf(nome, this.vista) : null;
    // padrão 'vazio' da tabela: só o contorno, como área sem preenchimento
    if (fill !== 'none' && fechados.length && (p || !nome)) {
      const h: Extract<Primitiva, { k: 'hachura' }> = p
        ? { k: 'hachura', aneis: fechados, padrao: p.padrao, risco: p.risco, camada }
        : { k: 'hachura', aneis: fechados, padrao: 'solido', fundo: this.comMeioTom(e, fill, stroke, fill), camada };
      if (p?.fundo) h.fundo = p.fundo;
      if (p && p.escala !== 1) h.escala = p.escala;
      if (borda) h.borda = borda;
      this.prims.push(h);
      return;
    }
    if (!borda) return;
    for (const a of aneis) if (a.length >= 2) this.prims.push({ k: 'polilinha', pts: a.map(([x, y]): Pt => [x, y]), fechada: true, e: borda });
  }

  /** Linha de cota com as duas marcas oblíquas como riscos de verdade (o DXF não tem <marker>). */
  private anotarLinhaDeCota(xa: number, ya: number, xb: number, yb: number): void {
    const e: Traco = { camada: 'cotas', cor: this.corDe('cotas', COR.cota), espessura: 0.9 };
    this.prims.push({ k: 'linha', a: [xa, ya], b: [xb, yb], e });
    // orient="auto": o eixo x da marca acompanha a linha, de A para B, nas duas pontas
    const L = Math.hypot(xb - xa, yb - ya);
    const [dx, dy] = L > 0 ? [(xb - xa) / L, (yb - ya) / L] : [1, 0];
    const k = MARCA.lado / MARCA.caixa;
    const gira = ([u, v]: Pt): Pt => [((u - MARCA.ref) * dx - (v - MARCA.ref) * dy) * k, ((u - MARCA.ref) * dy + (v - MARCA.ref) * dx) * k];
    const [p, q] = [gira(MARCA.de), gira(MARCA.ate)];
    const marca: Traco = { camada: 'cotas', cor: this.corDe('cotas', COR.cota), espessura: MARCA.sw * k };
    for (const [x, y] of [[xa, ya], [xb, yb]] as Pt[]) {
      this.prims.push({ k: 'linha', a: [x + p[0], y + p[1]], b: [x + q[0], y + q[1]], e: marca });
    }
  }

  private estender(xa: number, ya: number, xb: number, yb: number): void {
    if (![xa, ya, xb, yb].every(Number.isFinite)) return;
    this.x0 = Math.min(this.x0, xa, xb);
    this.y0 = Math.min(this.y0, ya, yb);
    this.x1 = Math.max(this.x1, xa, xb);
    this.y1 = Math.max(this.y1, ya, yb);
    if (!this.foraDaRef) this.reservar(xa, ya, xb, yb);
  }

  private atributos(e: Estilo, fillPadrao = 'none', strokePadrao: string = COR.linha): string {
    let fill = e.fill ?? fillPadrao;
    const op = (e.opacidade ?? 1) * this.opacidadeDoTraco(e, fill, e.stroke ?? strokePadrao);
    // no SVG do PDF não há <pattern> para apontar: o que sobrar com padrão (área sem anel fechado, linha com fill)
    // não tem miolo para pintar, e o url(#…) órfão não pode ir para o papel
    let st = e.stroke ?? strokePadrao;
    // o meio-tom do material (a cor perto do papel, opaca) — decidido com o padrão ainda no fill: é ele que diz o
    // material da área hachurada
    [fill, st] = [this.comMeioTom(e, fill, st, fill), this.comMeioTom(e, fill, st, st)];
    if (this.hachuraVetorial && this.nomeDoPadrao(fill)) fill = 'none';
    // a anotação (cota, chamada, eixo, sombra) na cor que a vista der: traço e miolo chapado (o ponto da chamada)
    const anotada = anotacaoDaCamada(e.camada) && corDaAnotacao(anotacaoDaCamada(e.camada)!, this.vista);
    if (anotada) {
      if (st !== 'none') st = anotada;
      if (fill !== 'none' && !fill.startsWith('url(')) fill = anotada;
    }
    const a = [`fill="${fill}"`];
    a.push(`stroke="${st}"`);
    if (st !== 'none') a.push(`stroke-width="${n(e.sw ?? 1)}"`);
    if (e.dash) a.push(`stroke-dasharray="${e.dash}"`);
    if (op < 1) a.push(`opacity="${Math.min(1, Math.max(0, op)).toFixed(2)}"`);
    if (e.id) a.push(`data-id="${esc(e.id)}"`);
    if (e.extra) a.push(e.extra);
    return a.join(' ');
  }

  rect(x: number, y: number, w: number, h: number, e: Estilo = {}): void {
    if (this.mudo) return;
    const xa = Math.min(x, x + w), ya = Math.min(y, y + h);
    const ww = Math.abs(w), hh = Math.abs(h);
    if (!(ww > 0 && hh > 0)) return;
    if (this.apagado(e)) return this.estender(xa, ya, xa + ww, ya + hh);
    const aneis: Pt[][] = [[[xa, ya], [xa + ww, ya], [xa + ww, ya + hh], [xa, ya + hh]]];
    if (!e.soArquivo && !this.areaEmVetor(aneis, e)) this.corpo.push(`<rect x="${n(xa)}" y="${n(ya)}" width="${n(ww)}" height="${n(hh)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xa + ww, ya + hh);
    this.anotarArea(aneis, e);
  }

  linha(xa: number, ya: number, xb: number, yb: number, e: Estilo = {}): void {
    if (this.mudo) return;
    if (this.apagado(e)) return this.estender(xa, ya, xb, yb);
    this.corpo.push(`<line x1="${n(xa)}" y1="${n(ya)}" x2="${n(xb)}" y2="${n(yb)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xb, yb);
    const stroke = e.stroke ?? COR.linha;
    if (!e.soTela && stroke !== 'none') {
      this.prims.push({ k: 'linha', a: [xa, ya], b: [xb, yb], e: this.traco(stroke, e, this.camadaDe(e, e.fill ?? 'none', stroke)) });
    }
  }

  poligono(pts: Pt[], e: Estilo = {}): void {
    if (this.mudo) return;
    if (pts.length < 2) return;
    if (this.apagado(e)) {
      for (const [x, y] of pts) this.estender(x, y, x, y);
      return;
    }
    if (!this.areaEmVetor([pts], e)) {
      const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
      this.corpo.push(`<polygon points="${p}" ${this.atributos(e)}/>`);
    }
    for (const [x, y] of pts) this.estender(x, y, x, y);
    this.anotarArea([pts], e);
  }

  /** Polilinha aberta (o preenchimento, se alguém passar, não vai para o DXF: nenhum desenho usa). */
  polilinha(pts: Pt[], e: Estilo = {}): void {
    if (this.mudo) return;
    if (pts.length < 2) return;
    if (this.apagado(e)) {
      for (const [x, y] of pts) this.estender(x, y, x, y);
      return;
    }
    const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    this.corpo.push(`<polyline points="${p}" ${this.atributos(e)} stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const [x, y] of pts) this.estender(x, y, x, y);
    const stroke = e.stroke ?? COR.linha;
    if (e.soTela || stroke === 'none') return;
    // estribo fechado vem com o 1º ponto repetido no fim: no DXF vira polilinha fechada de verdade
    const [a, z] = [pts[0], pts[pts.length - 1]];
    const fechada = pts.length >= 4 && Math.abs(a[0] - z[0]) < 1e-9 && Math.abs(a[1] - z[1]) < 1e-9;
    const q = (fechada ? pts.slice(0, -1) : pts).map(([x, y]): Pt => [x, y]);
    this.prims.push({ k: 'polilinha', pts: q, fechada, e: this.traco(stroke, e, this.camadaDe(e, e.fill ?? 'none', stroke)) });
  }

  /** Contorno com furos num caminho só (regra par-ímpar): o furo do bloco fica vazado de verdade. */
  caminho(aneis: Pt[][], e: Estilo = {}): void {
    if (this.mudo) return;
    const d = aneis
      .filter((a) => a.length >= 3)
      .map((a) => 'M' + a.map(([x, y]) => `${n(x)},${n(y)}`).join('L') + 'Z')
      .join('');
    if (!d) return;
    if (this.apagado(e)) {
      for (const a of aneis) for (const [x, y] of a) this.estender(x, y, x, y);
      return;
    }
    if (!this.areaEmVetor(aneis, e)) this.corpo.push(`<path d="${d}" fill-rule="evenodd" ${this.atributos(e)}/>`);
    for (const a of aneis) for (const [x, y] of a) this.estender(x, y, x, y);
    this.anotarArea(aneis.filter((a) => a.length >= 3), e);
  }

  circulo(cx: number, cy: number, r: number, e: Estilo = {}): void {
    if (this.mudo) return;
    const aco = corDoAcoNoDesenho(this.vista);
    if (this.apagado(e, aco, 'none')) return this.estender(cx - r, cy - r, cx + r, cy + r);
    this.corpo.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${this.atributos(e, aco, 'none')}/>`);
    this.estender(cx - r, cy - r, cx + r, cy + r);
    if (e.soTela) return;
    const fill = e.fill ?? aco;
    const stroke = e.stroke ?? 'none';
    const camada = this.camadaDe(e, fill, stroke);
    // o ponto da barra cortada é cheio e sem contorno; o contrato só guarda a camada no traço, então ele leva um
    // contorno da própria cor, espessura 0 — some no desenho e diz ao DXF que o ponto é aço
    const cheio = fill.startsWith('#') ? fill : undefined;
    const contorno = stroke !== 'none' ? this.traco(stroke, e, camada) : cheio ? { camada, cor: cheio, espessura: 0 } : null;
    // círculo sem traço e sem tinta não tem o que levar para o DXF
    if (!contorno) return;
    const c: Extract<Primitiva, { k: 'circulo' }> = { k: 'circulo', c: [cx, cy], r, e: contorno };
    if (cheio) c.cheio = cheio;
    this.prims.push(c);
  }

  /**
   * Largura estimada de um texto (px), caractere a caractere com as larguras da Arial arredondadas: uma média só
   * subestima o maiúsculo ("PROVISÓRIO") e o texto vazaria do viewBox na borda.
   */
  static largura(t: string, tam: number, negrito = false): number {
    let em = 0;
    for (const c of t) em += larguraDoCaractere(c);
    return em * tam * (negrito ? 1.08 : 1);
  }

  texto(x: number, y: number, t: string, o: OpcoesTexto = {}): void {
    if (this.mudo) return;
    // só o texto solto é anotação editável (TEXTO_EDITAVEL); cota, chamada, legenda escrevem direto
    if (!TEXTO_EDITAVEL.has(o.camada ?? 'textos')) {
      this.escrever(x, y, t, o);
      return;
    }
    const chave = o.chave !== undefined ? `texto:${o.chave}` : this.chaveNova('texto', t);
    // categoria desligada: só o lugar (a chave já andou: o "#n" dos textos iguais não muda com ela desligada)
    if (!this.categoriaVisivel(o.camada ?? 'textos')) {
      this.escrever(x, y, t, o);
      return;
    }
    const a = this.valeOAjuste(this.ajustes[chave], [x, y], t);
    const tam = o.tam ?? 12;
    const ancora = o.ancora ?? 'middle';
    const giro0 = o.giro ?? (o.vertical ? 90 : 0);
    const info = (texto: string, p: Pt, giro: number, oculta: boolean): InfoDaAnotacao => ({
      chave, tipo: 'texto', nova: false, texto, original: t, p, p0: [x, y], ancora, giro, largura: Prancha.largura(texto, tam, o.negrito), tam, oculta,
    });
    if (!a) {
      this.escrever(x, y, t, o);
      this.anotacoes.push(info(t, [x, y], giro0, false));
      return;
    }
    this.fantasma(() => this.escrever(x, y, t, o));
    const texto = a.texto ?? t;
    const p: Pt = [x + (a.dx ?? 0), y + (a.dy ?? 0)];
    const giro = a.giro ?? giro0;
    this.anotacoes.push(info(texto, p, giro, !!a.oculta || !texto.trim()));
    if (a.oculta || !texto.trim()) return;
    this.foraDoLugar(() => this.escrever(p[0], p[1], texto, { ...o, giro, vertical: undefined }));
  }

  /** O texto, sem chave nem ajuste (o traço de verdade). */
  private escrever(x: number, y: number, t: string, o: OpcoesTexto = {}): void {
    if (this.mudo) return;
    const tam = o.tam ?? 12;
    const anc = o.ancora ?? 'middle';
    const w = Prancha.largura(t, tam, o.negrito);
    const giro = o.giro ?? (o.vertical ? 90 : 0);
    // a caixa do texto: linha de base em y, sobe ~0,8·corpo e desce ~0,25·corpo (girada em torno do ponto de inserção)
    const a0 = anc === 'start' ? 0 : anc === 'middle' ? -w / 2 : -w;
    const caixa = (): void => {
      if (!giro) return this.estender(x + a0, y - 0.85 * tam, x + a0 + w, y + 0.25 * tam);
      // y para baixo: o giro anti-horário é −giro
      const g = (-giro * Math.PI) / 180;
      const [c, sn] = [Math.cos(g), Math.sin(g)];
      for (const [u, v] of [[a0, -0.85 * tam], [a0 + w, -0.85 * tam], [a0 + w, 0.25 * tam], [a0, 0.25 * tam]] as Pt[]) {
        const [px, py] = [x + u * c - v * sn, y + u * sn + v * c];
        this.estender(px, py, px, py);
      }
    };
    // a categoria desligada guarda a MESMA caixa que o texto ocuparia: o desenho não pula na folha
    if (!this.categoriaVisivel(o.camada ?? 'textos')) return caixa();
    const cor = this.corDe(o.camada ?? 'textos', o.cor ?? COR.linha);
    const rot = giro ? ` transform="rotate(${n(-giro)} ${n(x)} ${n(y)})"` : '';
    const halo = o.halo ? ' paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"' : '';
    this.corpo.push(
      `<text x="${n(x)}" y="${n(y)}" font-size="${n(tam)}" text-anchor="${anc}" fill="${cor}"` +
        `${o.negrito ? ' font-weight="bold"' : ''} font-family="${FONTE}"${halo}${rot}>${esc(t)}</text>`,
    );
    caixa();
    // o y do texto já é a linha de base, que é o ponto de inserção do DXF; o giro de −90° do SVG (y para baixo)
    // é o de +90° anti-horário do CAD (y para cima): a cota vertical lê de baixo para cima nos dois
    if (!t) return;
    const p: Extract<Primitiva, { k: 'texto' }> = {
      k: 'texto', p: [x, y], t, altura: tam, ancora: anc, angulo: giro, cor, camada: o.camada ?? 'textos',
    };
    if (o.negrito) p.negrito = true;
    // o halo do SVG (rótulo legível sobre hachura) vira MTEXT com máscara de fundo no DXF
    if (o.halo) p.mascara = true;
    this.prims.push(p);
  }

  /**
   * Cota horizontal com marca oblíqua (figlib.dim_h). `de` = y de onde partem as linhas de chamada (o ponto
   * medido). Rótulo acima da linha; se não cabe entre as marcas, vai para fora, à direita — nunca em cima de outro.
   */
  cotaH(xa: number, xb: number, y: number, rotulo: string, o: { de?: [number, number]; tam?: number; chave?: string; textoDaChave?: string } = {}): void {
    this.cadeiaH([{ a: xa, b: xb, rotulo, chave: o.chave, textoDaChave: o.textoDaChave }], y, { tam: o.tam, de: o.de ? [o.de] : undefined });
  }

  private linhaDeCotaH(xa: number, xb: number, y: number, de?: [number, number]): [number, number] {
    const [x1, x2] = xa <= xb ? [xa, xb] : [xb, xa];
    if (this.mudo) return [x1, x2];
    if (de) {
      for (const [x, y0] of [[x1, de[0]], [x2, de[1]]] as Pt[]) {
        const s = y > y0 ? 1 : -1;
        if (Math.abs(y - y0) > 3) this.linha(x, y0 + s * 2, x, y + s * 4, { stroke: COR.cota, sw: 0.6, camada: 'cotas' });
      }
    }
    this.estender(x1 - 4, y - 4, x2 + 4, y + 4);
    if (!this.categoriaVisivel('cotas')) return [x1, x2];
    this.corpo.push(
      `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${this.corDe('cotas', COR.cota)}" stroke-width="0.9"` +
        ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
    );
    this.anotarLinhaDeCota(x1, y, x2, y);
    return [x1, x2];
  }

  /**
   * Cotas em cadeia numa mesma linha. O rótulo vai acima, centrado; o que não cabe entre as marcas sai para fora
   * (ponta da cadeia) ou sobe um degrau (meio da cadeia) — e sobe mais se ainda bater num rótulo vizinho. Sem
   * isso, duas cotas curtas lado a lado (as duas pontas de uma junta) escrevem uma em cima da outra.
   * `de`: para cada segmento, os y de onde partem as linhas de chamada (ou um par para todos).
   */
  /**
   * `textoDaChave`: a chave sai deste texto e não do rótulo — a cota de comprimento mostra o valor cheio (16/10) e
   * guarda a chave do valor de antes, sem a junta: o ajuste feito nela até 15/10 continua achando a cota.
   */
  cadeiaH(segs: { a: number; b: number; rotulo: string; chave?: string; textoDaChave?: string }[], y: number, o: { tam?: number; de?: [number, number][] } = {}): void {
    this.cadeiaComChave(segs, y, o, (rotulo, k) => {
      const dita = segs[k]?.chave;
      const chave = dita !== undefined ? `cota:${dita}` : this.chaveNova('cota', segs[k]?.textoDaChave ?? rotulo);
      return { chave, ajuste: this.ajustes[chave], nova: false };
    });
  }

  /**
   * A cadeia, com a chave e o ajuste de cada trecho. O arranjo dos números (no meio, para fora, um degrau acima) sai
   * dos textos de ORIGEM: esconder ou reescrever um trecho não mexe no número do vizinho.
   */
  private cadeiaComChave(
    segs: { a: number; b: number; rotulo: string }[],
    y: number,
    o: { tam?: number; de?: [number, number][] },
    resolver: (rotulo: string, k: number) => { chave: string; ajuste?: AnotacaoPosta; nova: boolean; cadeia?: string },
  ): void {
    if (this.mudo) return;
    const tam = o.tam ?? CORPO_DA_COTA;
    const visiveis = this.categoriaVisivel('cotas');
    const ocupados: [number, number, number][] = [];
    segs.forEach((s, k) => {
      const de = o.de ? o.de[Math.min(k, o.de.length - 1)] : undefined;
      const [x1, x2] = s.a <= s.b ? [s.a, s.b] : [s.b, s.a];
      const w = Prancha.largura(s.rotulo, tam);
      let x0: number, nivel = 0;
      if (w + 6 <= x2 - x1) x0 = (x1 + x2) / 2 - w / 2;
      else if (k === 0 && segs.length > 1) x0 = x1 - 4 - w;
      else if (k === segs.length - 1) x0 = x2 + 4;
      else {
        x0 = (x1 + x2) / 2 - w / 2;
        nivel = 1;
      }
      while (ocupados.some(([a, b, nv]) => nv === nivel && x0 < b + 3 && x0 + w > a - 3)) nivel++;
      ocupados.push([x0, x0 + w, nivel]);
      const yt = y - 4 - nivel * (tam + 2);
      // halo branco: o rótulo fica legível quando um eixo ou uma chamada passa por baixo dele
      const desenhar = (yl: number, rot: string, xt: number, ytt: number) => {
        this.linhaDeCotaH(s.a, s.b, yl, de);
        this.escrever(xt, ytt, rot, { tam, cor: COR.cota, ancora: 'start', halo: true, camada: 'cotas' });
      };
      const r = resolver(s.rotulo, k);
      const { chave, nova } = r;
      const a = nova ? r.ajuste : this.valeOAjuste(r.ajuste, [x0, yt], s.rotulo);
      // os pontos medidos: de onde saem as linhas de chamada (sem elas, as pontas da própria linha)
      const pontas: [Pt, Pt] = de ? [[x1, de[0]], [x2, de[1]]] : [[x1, y], [x2, y]];
      const info = (rot: string, p: Pt, yl: number, oculta: boolean): InfoDaAnotacao => {
        const i: InfoDaAnotacao = {
          chave, tipo: 'cota', nova, texto: rot, original: s.rotulo, p, p0: [x0, yt], ancora: 'start', giro: 0, largura: Prancha.largura(rot, tam), tam,
          linha: [[x1, yl], [x2, yl]], eixo: 'h', pontas, oculta,
        };
        if (r.cadeia) i.cadeia = r.cadeia;
        return i;
      };
      if (!a) {
        desenhar(y, s.rotulo, x0, yt);
        if (visiveis) this.anotacoes.push(info(s.rotulo, [x0, yt], y, false));
        return;
      }
      if (!nova) this.fantasma(() => desenhar(y, s.rotulo, x0, yt));
      const af = a.afastamento ?? 0;
      const rot = a.texto ?? `${a.prefixo ?? ''}${s.rotulo}${a.sufixo ?? ''}`;
      // o número reescrito fica com o meio onde estava o de origem
      const p: Pt = [x0 + (w - Prancha.largura(rot, tam)) / 2 + (a.dx ?? 0), yt + af + (a.dy ?? 0)];
      const oculta = !!a.oculta || !rot.trim();
      if (visiveis) this.anotacoes.push(info(rot, p, y + af, oculta));
      if (oculta) return;
      this.foraDoLugar(() => desenhar(y + af, rot, p[0], p[1]));
    });
  }

  /** Cota vertical (figlib.dim_v). `lado` −1 escreve à esquerda da linha, +1 à direita. */
  cotaV(x: number, ya: number, yb: number, rotulo: string, o: { de?: [number, number]; lado?: -1 | 1; tam?: number; chave?: string } = {}): void {
    if (this.mudo) return;
    const chave = o.chave !== undefined ? `cota:${o.chave}` : this.chaveNova('cota', rotulo);
    this.cotaVComChave(x, ya, yb, rotulo, o, chave, this.ajustes[chave], false);
  }

  private cotaVComChave(
    x: number, ya: number, yb: number, rotulo: string, o: { de?: [number, number]; lado?: -1 | 1; tam?: number; cadeia?: string },
    chave: string, ajuste: AnotacaoPosta | undefined, nova: boolean,
  ): void {
    let a = ajuste;
    const tam = o.tam ?? CORPO_DA_COTA;
    const lado = o.lado ?? -1;
    const [y1, y2] = ya <= yb ? [ya, yb] : [yb, ya];
    const w = Prancha.largura(rotulo, tam);
    const cabe = w + 6 <= y2 - y1;
    const ancora = cabe ? 'middle' : 'start';
    const xt = lado < 0 ? x - 4 : x + 4 + 0.85 * tam;
    const yt = cabe ? (y1 + y2) / 2 : y1 - 5;
    const desenhar = (xl: number, rot: string, p: Pt) => {
      if (o.de) {
        for (const [y, x0] of [[y1, o.de[0]], [y2, o.de[1]]] as Pt[]) {
          const s = xl > x0 ? 1 : -1;
          this.linha(x0 + s * 2, y, xl + s * 4, y, { stroke: COR.cota, sw: 0.6, camada: 'cotas' });
        }
      }
      this.estender(xl - 4, y1 - 4, xl + 4, y2 + 4);
      if (this.categoriaVisivel('cotas')) {
        this.corpo.push(
          `<line x1="${n(xl)}" y1="${n(y1)}" x2="${n(xl)}" y2="${n(y2)}" stroke="${this.corDe('cotas', COR.cota)}" stroke-width="0.9"` +
            ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
        );
        this.anotarLinhaDeCota(xl, y1, xl, y2);
      }
      this.escrever(p[0], p[1], rot, { tam, cor: COR.cota, vertical: true, ancora, halo: true, camada: 'cotas' });
    };
    const pontas: [Pt, Pt] = o.de ? [[o.de[0], y1], [o.de[1], y2]] : [[x, y1], [x, y2]];
    const info = (rot: string, p: Pt, xl: number, oculta: boolean): InfoDaAnotacao => {
      const i: InfoDaAnotacao = {
        chave, tipo: 'cota', nova, texto: rot, original: rotulo, p, p0: [xt, yt], ancora, giro: 90, largura: Prancha.largura(rot, tam), tam,
        linha: [[xl, y1], [xl, y2]], eixo: 'v', pontas, oculta,
      };
      if (o.cadeia) i.cadeia = o.cadeia;
      return i;
    };
    const visiveis = this.categoriaVisivel('cotas');
    if (!nova) a = this.valeOAjuste(a, [xt, yt], rotulo);
    if (!a) {
      desenhar(x, rotulo, [xt, yt]);
      if (visiveis) this.anotacoes.push(info(rotulo, [xt, yt], x, false));
      return;
    }
    if (!nova) this.fantasma(() => desenhar(x, rotulo, [xt, yt]));
    const af = a.afastamento ?? 0;
    const rot = a.texto ?? `${a.prefixo ?? ''}${rotulo}${a.sufixo ?? ''}`;
    const p: Pt = [xt + af + (a.dx ?? 0), yt + (a.dy ?? 0)];
    const oculta = !!a.oculta || !rot.trim();
    if (visiveis) this.anotacoes.push(info(rot, p, x + af, oculta));
    if (oculta) return;
    this.foraDoLugar(() => desenhar(x + af, rot, p));
  }

  /**
   * As cotas e os textos criados na folha (pranchas/tipos.ts, CotaNova e TextoNovo): os pontos guardados em mm do
   * muro no plano da vista, aqui de volta a px (× S). Ficam fora da caixa de referência — criar uma cota fora do
   * desenho não empurra o desenho na folha. A chave é o id: a tela apaga de verdade, não esconde.
   */
  desenharNovas(cotas: readonly CotaNova[] = [], textos: readonly TextoNovo[] = [], S: number): void {
    if (this.mudo) return;
    // a folha pede depois que o desenho saiu da vista: a cota e o texto criados seguem a sobreposição dela
    if (this.vista !== vistaEmDesenho() || this.sobreposicao !== sobreposicaoEmDesenho()) {
      this.naMinhaVista(() => this.desenharNovas(cotas, textos, S));
      return;
    }
    // a parte do desenho em que o ponto foi tomado (a seção da armação…): conta da origem dela; a parte que sumiu
    // (o estribo que deixou de existir) cai na origem do desenho — fora do lugar, mas à vista para apagar
    const origemDe = (regiao: string | undefined): Pt => this.regioes.find((r) => r.nome === regiao)?.origem ?? [0, 0];
    this.foraDoLugar(() => {
      for (const c of cotas) {
        const o = origemDe(c.regiao);
        const px = (p: Pt): Pt => [o[0] + p[0] * S, o[1] + p[1] * S];
        const [a, b, l] = [px(c.a), px(c.b), px(c.linha)];
        const ajuste: AnotacaoPosta = {};
        if (c.texto !== undefined) ajuste.texto = c.texto;
        if (c.prefixo) ajuste.prefixo = c.prefixo;
        if (c.sufixo) ajuste.sufixo = c.sufixo;
        if (c.dx !== undefined) ajuste.dx = c.dx;
        if (c.dy !== undefined) ajuste.dy = c.dy;
        if (c.direcao === 'h') {
          const medida = cm(Math.abs(c.b[0] - c.a[0]));
          const de: [number, number] = a[0] <= b[0] ? [a[1], b[1]] : [b[1], a[1]];
          this.cadeiaComChave([{ a: a[0], b: b[0], rotulo: medida }], l[1], { de: [de] }, () => ({ chave: c.id, ajuste, nova: true, cadeia: c.cadeia }));
        } else {
          const medida = cm(Math.abs(c.b[1] - c.a[1]));
          const de: [number, number] = a[1] <= b[1] ? [a[0], b[0]] : [b[0], a[0]];
          // o número do lado de fora: à esquerda se a linha está à esquerda dos pontos
          const lado: -1 | 1 = l[0] < Math.min(a[0], b[0]) ? -1 : 1;
          this.cotaVComChave(l[0], a[1], b[1], medida, { de, lado, cadeia: c.cadeia }, c.id, ajuste, true);
        }
      }
      for (const t of textos) {
        const o = origemDe(t.regiao);
        const [x, y]: Pt = [o[0] + t.p[0] * S, o[1] + t.p[1] * S];
        const tam = CORPO_DA_COTA;
        const giro = t.giro ?? 0;
        this.escrever(x, y, t.texto, { tam, ancora: 'start', cor: COR.linha, halo: true, camada: 'textos', giro });
        if (this.categoriaVisivel('textos')) this.anotacoes.push({
          chave: t.id, tipo: 'texto', nova: true, texto: t.texto, original: t.texto, p: [x, y], p0: [x, y], ancora: 'start', giro,
          largura: Prancha.largura(t.texto, tam), tam, oculta: false,
        });
      }
    });
  }

  /** Grupo com atributos (ex.: data-camada) — para o componente e o teste acharem uma camada inteira. */
  abrir(atributos: string): void {
    this.corpo.push(`<g ${atributos}>`);
    // o grupo sem data-camada herda a do grupo de fora: a pilha anda junto com o <g>, o fechar() tira um de cada
    const c = atributos.match(/data-camada="([^"]*)"/)?.[1] ?? this.grupos[this.grupos.length - 1] ?? '';
    this.grupos.push(c);
  }

  fechar(): void {
    this.corpo.push('</g>');
    this.grupos.pop();
  }

  private defs(): string {
    const p = this.prefixo;
    const M = MARCA;
    const marca =
      `<marker id="${p}-tick" viewBox="0 0 ${M.caixa} ${M.caixa}" refX="${M.ref}" refY="${M.ref}" markerWidth="${M.lado}" markerHeight="${M.lado}" markerUnits="userSpaceOnUse" orient="auto">` +
      `<path d="M${M.de[0]},${M.de[1]} L${M.ate[0]},${M.ate[1]}" stroke="${this.corDe('cotas', COR.cota)}" stroke-width="${M.sw}"/></marker>`;
    if (this.hachuraVetorial) {
      // só os ladrilhos que alguma área usou; overflow hidden: cada cópia recortada no quadrado dela, como no <pattern>
      const ladrilhos = [...this.ladrilhosUsados].map(([k, l]) => {
        return `<symbol id="${p}-lad-${k}" viewBox="0 0 ${n3(l.lado)} ${n3(l.lado)}" overflow="hidden">${l.miolo}</symbol>`;
      });
      return marca + ladrilhos.join('') + this.recortes.join('');
    }
    // cada material com a hachura da tabela em uso: ladrilho (terra, concreto, areia, brita, sólido, vazio) ou riscado
    const padroes = NOMES_DOS_PADROES.map((nome) => {
      const h = hachuraDoPadrao(nome, this.vista);
      return h.desenho === 'riscado' ? padraoRiscado(`${p}-${nome}`, riscadoDe(nome, h)) : padraoDoLadrilho(`${p}-${nome}`, ladrilhoDe(h));
    });
    return marca + padroes.join('');
  }

  /** Pedaços do desenho para quem quer controlar o viewBox (zoom/arrasto do componente). */
  partes(margem = 14): { viewBox: [number, number, number, number]; referencia: [number, number, number, number]; defs: string; corpo: string } {
    const caixa = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => {
      if (!Number.isFinite(x0)) return [0, 0, 100, 100];
      const [x, y] = [Math.floor(x0 - margem), Math.floor(y0 - margem)];
      return [x, y, Math.ceil(x1 + margem) - x, Math.ceil(y1 + margem) - y];
    };
    const viewBox = caixa(this.x0, this.y0, this.x1, this.y1);
    // sem chamada fora da coluna as duas são a mesma
    const referencia = Number.isFinite(this.r0) ? caixa(this.r0, this.s0, this.r1, this.s1) : viewBox;
    // os <pattern> saem com as hachuras da vista desta prancha (a sobreposição dela), não com as da geral
    return { viewBox, referencia, defs: this.naMinhaVista(() => this.defs()), corpo: this.corpo.join('') };
  }

  svg(margem = 14): string {
    const { viewBox: [x, y, w, h], defs, corpo } = this.partes(margem);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">` +
      `<defs>${defs}</defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>${corpo}</svg>`
    );
  }
}

/**
 * Escala (px por mm) para a maior medida caber em `alvo` px, dentro de limites que mantêm o texto proporcional.
 * O `alvo` é também o botão da LETRA na tela: a anotação (texto, cota, marca, espessura de traço) tem tamanho
 * fixo em px de prancha e o componente enquadra a prancha inteira na folha — alvo menor = desenho menor na
 * prancha = enquadrar amplia mais = letra maior na tela, toda ela na mesma proporção.
 */
export function escalaPara(extensaoMm: number, alvo = 1000, min = 0.05, max = 0.6): number {
  if (!(extensaoMm > 0)) return max;
  return Math.min(max, Math.max(min, alvo / extensaoMm));
}
