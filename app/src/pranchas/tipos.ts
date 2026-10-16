import type { SobreposicaoDaVista } from '@/desenhos/graficos';
/*
  PRANCHAS — o contrato entre as frentes do modo prancha (Jose, 14/10: "prancha pronta, de forma intuitiva e prática").

  Quem fala com quem:
    · desenhos/ (vistas 2D)  → entregam o SVG da vista E a lista de PRIMITIVAS (os mesmos traços, estruturados), numa
      escala fixa pedida pela prancha (VistaParaPrancha);
    · visor/ (3D)            → entrega a foto refeita do mesmo ponto de vista (Camera3d), para a prancha "viva";
    · pranchas/folha.ts      → compõe a folha em MILÍMETROS DE PAPEL: moldura, itens, quadro lateral e carimbo;
    · pranchas/dxf.ts        → lê só as primitivas da folha composta (nunca o SVG) e escreve o DXF;
    · o PDF sai do SVG da folha (impressão do navegador; no programa instalado, direto em arquivo).

  Por que primitivas e não "converter o SVG": o SVG é para olho (padrão de hachura, halo, marcador); o DXF precisa
  saber o que cada traço É (camada, padrão de hachura do CAD, texto editável, bloco do carimbo). Quem desenha sabe;
  quem lê o SVG depois teria de adivinhar.

  Unidades: as primitivas de uma VISTA vêm em px de desenho (o sistema da desenhos/prancha.ts, y para baixo); a folha
  converte para mm de papel com PX_POR_MM. Decisões do Jose (14/10): A0 a A4, deitada ou em pé; escalas 1:10, 1:20,
  1:25, 1:50, 1:75, 1:100 e "sem escala" (3D); desenho VIVO (mudou a conta, a prancha acompanha; o 3D é refeito do
  mesmo ponto de vista); carimbo do escritório guardado no app; DXF em mm de papel (como plotado); quadro lateral
  preenchido sozinho e editável.
*/

import type { VistaIso } from '@/desenhos/isometrico';
import type { EstiloVisual } from '@/visor/estiloVisual';

export type Pt = [number, number];

/**
 * Na Arial a maiúscula tem 1467/2048 = 0,716 do corpo. No SVG (e no PDF) o tamanho do texto é o CORPO; no CAD, e na
 * norma de letra técnica, é a altura da MAIÚSCULA — toda conversão entre os dois passa por aqui.
 */
export const MAIUSCULA_DA_ARIAL = 1467 / 2048;

/**
 * Altura mínima da maiúscula no papel, mm. NBR 8402 (de memória: a série dela começa em 2,5; a ISO 3098, que é a
 * base, desce a 1,8 — e era em 1,8 que a prancha saía até 15/10, quando o Jose pediu os 2,5).
 */
export const LETRA_MINIMA = 2.5;

/** Corpo do rótulo de cota, px de desenho: o menor texto que os desenhos escrevem e o que manda na escala abaixo. */
export const CORPO_DA_COTA = 11;

/** Corpo de texto (mm de papel) para a maiúscula sair com `h` mm. */
export const corpoDaLetra = (h: number): number => h / MAIUSCULA_DA_ARIAL;

/**
 * Quantos px de desenho viram 1 mm de papel. A anotação dos desenhos tem tamanho fixo em px (cota 11 px, título
 * 15 px, traço 0,9 px, afastamento das cotas): a escala sai da cota, para a maiúscula dela ter LETRA_MINIMA no
 * papel (≈ 3,15 px/mm; o título fica com 3,4 mm de maiúscula e o traço fino com 0,29 mm). Toda a anotação cresce
 * junto — letra, marca, afastamento, traço, ladrilho da hachura —, como o fator de escala de cota do CAD: o desenho
 * no papel continua com a mesma cara da tela, só o muro fica menor em relação à letra. A escala da vista não muda
 * nada disso (a escala muda o muro, não a letra).
 */
export const PX_POR_MM = (CORPO_DA_COTA * MAIUSCULA_DA_ARIAL) / LETRA_MINIMA;

/** px de desenho por mm do MURO numa escala 1:e — o S que a vista recebe para sair na escala da prancha. */
export const escalaDaVista = (e: number): number => PX_POR_MM / e;

// ── primitivas ───────────────────────────────────────────────────────────────

/** O padrão de preenchimento: os quatro do Revit do Jose (no DXF: EARTH, AR-CONC, AR-SAND, GRAVEL), mais a
 *  alvenaria hachurada a 45° (ANSI31), o graute visto (riscos sem fundo) e o sólido (cor chapada). */
export type PadraoHachura = 'solido' | 'terra' | 'concreto' | 'areia' | 'brita' | 'alvenaria' | 'graute';

export interface Traco {
  camada: string;          // 'alvenaria', 'graute', 'aco', 'cotas', 'textos', 'terreno', 'drenagem', 'moldura'…
  cor: string;             // #rrggbb (cor verdadeira; o DXF guarda a cor verdadeira, não só o índice do CAD)
  espessura: number;       // na unidade das coordenadas (px de desenho na vista; mm na folha)
  tracejado?: number[];    // comprimentos traço/espaço, na mesma unidade; ausente = contínuo
  /** A cor É informação (a bitola da barra no 3D com Armadura): o DXF grava a cor verdadeira em vez de "por
   *  camada". Sem isto, o traço sai na cor da camada — o cadista controla cor e pena pela camada. */
  corPropria?: boolean;
}

export type Primitiva =
  | { k: 'linha'; a: Pt; b: Pt; e: Traco }
  | { k: 'polilinha'; pts: Pt[]; fechada: boolean; e: Traco }
  | { k: 'circulo'; c: Pt; r: number; e: Traco | null; cheio?: string }
  /** Área preenchida: anéis pela regra par-ímpar (o furo do bloco vazado de verdade). `fundo` = cor do fundo do
   *  padrão (a terra é riscada sobre o bege; o sólido usa só ele). `borda` desenha o contorno junto. */
  | { k: 'hachura'; aneis: Pt[][]; padrao: PadraoHachura; fundo?: string; risco?: string; camada: string; borda?: Traco; escala?: number }
  /** Texto: `p` = ponto de inserção na linha de base; ângulo em graus, ANTI-horário (cota vertical = 90).
   *  `mascara`: texto escrito em cima de hachura (o halo branco do SVG) — no DXF vai como MTEXT com máscara de
   *  fundo na cor do desenho, que tapa a hachura só atrás da letra. */
  | { k: 'texto'; p: Pt; t: string; altura: number; ancora: 'start' | 'middle' | 'end'; angulo: number; cor: string; negrito?: boolean; italico?: boolean; mascara?: boolean; camada: string; corPropria?: boolean }
  /** Imagem (a foto do 3D): canto superior esquerdo, largura e altura. No DXF vai como imagem vinculada ao arquivo. */
  | { k: 'imagem'; p: Pt; largura: number; altura: number; arquivo: string; dataUrl: string; camada: string }
  /** Grupo que vira BLOCO no DXF (o carimbo: quem tem carimbo próprio troca o bloco inteiro de uma vez). Os
   *  atributos são os campos preenchíveis (texto com etiqueta). `base` = o ponto base do bloco (o do carimbo é o
   *  canto inferior direito dele: o carimbo do escritório, com o ponto base no canto, cai no mesmo lugar); sem
   *  ela, o DXF usa o canto inferior direito da geometria do bloco. */
  | { k: 'bloco'; nome: string; prims: Primitiva[]; atributos: AtributoDoBloco[]; base?: Pt };

export interface AtributoDoBloco {
  etiqueta: string;        // 'OBRA', 'CONTEUDO', 'FOLHA', 'ESCALA', 'DATA', 'RESPONSAVEL'…
  valor: string;
  p: Pt;
  altura: number;
  ancora: 'start' | 'middle' | 'end';
  cor: string;
  negrito?: boolean;
  camada: string;
}

/** Leva primitivas de um sistema para outro: x' = x·k + dx, y' = y·k + dy (espessura, altura de texto e raio × k). */
export function transformarPrimitivas(ps: Primitiva[], k: number, dx: number, dy: number): Primitiva[] {
  const P = ([x, y]: Pt): Pt => [x * k + dx, y * k + dy];
  const T = (e: Traco): Traco => ({ ...e, espessura: e.espessura * k, tracejado: e.tracejado?.map((v) => v * k) });
  return ps.map((q): Primitiva => {
    switch (q.k) {
      case 'linha': return { ...q, a: P(q.a), b: P(q.b), e: T(q.e) };
      case 'polilinha': return { ...q, pts: q.pts.map(P), e: T(q.e) };
      case 'circulo': return { ...q, c: P(q.c), r: q.r * k, e: q.e ? T(q.e) : null };
      case 'hachura': return { ...q, aneis: q.aneis.map((a) => a.map(P)), borda: q.borda ? T(q.borda) : undefined };
      case 'texto': return { ...q, p: P(q.p), altura: q.altura * k };
      case 'imagem': return { ...q, p: P(q.p), largura: q.largura * k, altura: q.altura * k };
      case 'bloco': return { ...q, prims: transformarPrimitivas(q.prims, k, dx, dy), atributos: q.atributos.map((a) => ({ ...a, p: P(a.p), altura: a.altura * k })), base: q.base ? P(q.base) : undefined };
    }
  });
}

// ── vistas para a prancha ────────────────────────────────────────────────────

/** O que a prancha pede a desenhos/: a vista, numa escala fixa, sem o título interno (a prancha põe o dela). */
export type PedidoDeVista =
  | { tipo: 'frontal' }
  | { tipo: 'corte'; x?: number }                 // mm ao longo do muro; sem x = o corte padrão (meio do painel)
  | { tipo: 'planta'; fiada: number }
  | { tipo: 'iso'; vista?: VistaIso; corteX?: number | null }
  | { tipo: 'armacao' };                          // armação da sapata: elevação, sombras, seção e estribo

export interface VistaParaPrancha {
  /** Corpo SVG (sem <svg>), em px de desenho, e os <defs> que ele usa (padrões, marcadores). */
  corpo: string;
  defs: string;
  /** Caixa do desenho em px: [x, y, largura, altura] (o que a vista ocupa, já com as cotas e rótulos). */
  caixa: [number, number, number, number];
  /**
   * A caixa que segura o LUGAR do desenho na folha, px: a de tudo com as chamadas na coluna, como saem sozinhas.
   * Tirar uma chamada da coluna (ou escondê-la) não pode fazer o desenho pular nem o título descer. Ausente = `caixa`.
   */
  referencia?: [number, number, number, number];
  /** As chamadas das barras desenhadas, para a tela pegar e arrastar (desenhos/chamadas.ts). */
  chamadas?: InfoDaChamada[];
  /** As cotas e os textos editáveis desenhados (AnotacaoPosta, CotaNova, TextoNovo). */
  anotacoes?: InfoDaAnotacao[];
  /** As partes do desenho com origem própria (a seção da armação…): a anotação criada nelas conta dali. */
  regioes?: RegiaoDoDesenho[];
  /** px de desenho por mm do muro: o que a tela usa para guardar o ponto clicado em mm do muro (CotaNova). */
  S?: number;
  /** Os mesmos traços, estruturados, em px de desenho. */
  primitivas: Primitiva[];
}

/**
 * A chamada da barra que o projetista tirou da coluna e pôs onde quis (Jose, 15/10: "deixar livre pra eu colocar
 * quando quiser do jeito que quiser? Girar ele, por na vertical, pra um lado, por outro"). Fica no item da folha,
 * pela chave "posição|elemento" (chaveDaChamada). O texto anda com a barra: dx, dy contam do ponto da barra, em px
 * de desenho — no papel é sempre a mesma distância, em qualquer escala, como a letra.
 */
export interface ChamadaPosta {
  /** O ponto de inserção do texto (começo da linha de base) menos o ponto da barra, px. Ausente = na coluna. */
  dx?: number;
  dy?: number;
  /** Graus, anti-horário (90 = lê de baixo para cima). */
  giro?: number;
  oculta?: boolean;
  /** Sem a linha de chamada (Jose, 16/10: "opção de com linha de chamada e sem linha de chamada"): só o texto. */
  semLinha?: boolean;
}

/**
 * A ETIQUETA DE AÇO que o projetista põe (Jose, 16/10: "etiqueta de verdade de aço"): clica numa barra e a etiqueta
 * diz o N, a quantidade, a bitola, o espaçamento e o comprimento dela ("N1 – 15 Ø10 c/40 C=210"), lidos do muro do
 * dia. Não tem lugar, tem AFASTAMENTO (a lição do A-PORT): o texto conta do ponto da barra, e a barra que anda leva a
 * etiqueta junto.
 */
export interface EtiquetaNova {
  id: string;
  /** A barra: "posição|elemento" ("N1|muro") — a mesma chave da chamada da coluna. */
  barra: string;
  /** O ponto clicado, mm do muro no plano da vista: a âncora é o ponto da barra mais perto dele. */
  ponto: Pt;
  /** O texto (começo da linha de base) menos a âncora, px de desenho. */
  dx: number;
  dy: number;
  giro?: number;
  semLinha?: boolean;
}

/**
 * O ajuste do projetista numa anotação AUTOMÁTICA do desenho (Jose, 15/10: "deletar ou criar cotas e mover
 * anotações em geral, escrever de novo o que quiser"), pela chave dela (desenhos/prancha.ts, "ANOTAÇÃO EDITÁVEL":
 * o tipo, o texto de origem e a ordem — "cota:B = 140#0"). Muro mudou e o texto de origem também: a chave não
 * casa e a anotação volta ao automático (melhor uma cota a mais no lugar certo que uma escondida errada).
 */
export interface AnotacaoPosta {
  /** O texto deslocado (texto solto; o número da cota), px de desenho — no papel, a mesma distância em toda escala. */
  dx?: number;
  dy?: number;
  /** Texto solto girado, graus anti-horários. */
  giro?: number;
  /** Cota: a linha de cota afastada da original, px de desenho (+ = para baixo / para a direita). */
  afastamento?: number;
  /** Escrito de novo. */
  texto?: string;
  /** Cota: antes e depois do valor medido (Jose, 16/10: "cota de verdade" — o número continua o do desenho). */
  prefixo?: string;
  sufixo?: string;
  oculta?: boolean;
  /**
   * Onde a anotação estava (o ponto de origem, em mm do muro: o px do desenho ÷ S) quando o ajuste foi feito — em
   * toda anotação de chave pela ordem ("#n"). Se uma de antes com o mesmo texto mudar, sumir ou aparecer, a ordem
   * anda e outra herda a chave; com o lugar guardado, o ajuste só vale perto de onde nasceu (a herdeira fica
   * automática). Em mm do muro para valer em qualquer escala.
   */
  ref?: Pt;
  /** O texto de origem quando o ajuste foi feito. Na chave dita pelo desenho (que não leva o texto), o texto de
   *  origem que mudou (muro mudou: "36 Ø10" virou "54 Ø10") tira o texto reescrito e o esconder — volta o número
   *  certo. */
  original?: string;
}

/**
 * Uma parte do desenho com origem própria (a seção e a sombra de cada estribo da armação, que ficam DEPOIS da
 * elevação, a uma distância que depende do comprimento do muro e da escala): a cota e o texto criados nela guardam
 * o ponto contado da origem da parte, e não da do desenho — senão saíam de cima da seção quando o muro crescia.
 */
export interface RegiaoDoDesenho {
  nome: string;
  /** O ponto (0, 0) da parte, px de desenho; o mm do muro dela é (px − origem) ÷ S. */
  origem: Pt;
  /** Onde ela fica, px de desenho [x, y, largura, altura]: o clique dentro dela cria a anotação nela. */
  caixa: [number, number, number, number];
}

/**
 * A cota que o projetista criou na folha (a ferramenta Cota: dois pontos e o lugar da linha). Os pontos ficam em mm
 * do muro no plano da vista (o px do desenho dividido pela escala dele): trocar a escala do desenho não tira a cota
 * do lugar. Horizontal mede o x, vertical o y.
 */
export interface CotaNova {
  id: string;
  a: Pt;
  b: Pt;
  /** Um ponto da linha de cota (o terceiro clique). */
  linha: Pt;
  direcao: 'h' | 'v';
  /** A parte do desenho em que os pontos foram tomados (RegiaoDoDesenho); sem = o desenho todo. */
  regiao?: string;
  /** Escrito de novo (sem = a medida, em cm). */
  texto?: string;
  /** Antes e depois da medida, que continua a medida de verdade. */
  prefixo?: string;
  sufixo?: string;
  /** O número deslocado, px de desenho. */
  dx?: number;
  dy?: number;
  /** As cotas feitas de uma vez, ponto a ponto (a cadeia, como a do Revit): a linha delas anda junto. */
  cadeia?: string;
}

/** O texto que o projetista escreveu na folha: o ponto de inserção em mm do muro no plano da vista. */
export interface TextoNovo {
  id: string;
  p: Pt;
  texto: string;
  giro?: number;
  /** A parte do desenho do ponto (RegiaoDoDesenho); sem = o desenho todo. */
  regiao?: string;
}

/** Uma anotação editável como saiu no desenho, px de desenho (a tela pega, arrasta e reescreve). */
export interface InfoDaAnotacao {
  chave: string;
  tipo: 'texto' | 'cota';
  /** Criada na folha (CotaNova, TextoNovo: a chave é o id): apaga de verdade; a automática só se esconde. */
  nova: boolean;
  /** O texto como está, e o de origem (o que a chave guarda). */
  texto: string;
  original: string;
  /** O ponto de inserção do texto (na linha de base), a âncora, o giro (graus anti-horários), o comprimento e o corpo. */
  p: Pt;
  /** O ponto de inserção de ORIGEM (sem ajuste), e se outra anotação do desenho tem o mesmo texto de origem: o
   *  ajuste dela guarda o lugar (AnotacaoPosta.ref). */
  p0: Pt;
  repetida?: boolean;
  ancora: 'start' | 'middle' | 'end';
  giro: number;
  largura: number;
  tam: number;
  /** Cota: as pontas da linha de cota e para onde ela anda quando arrastada. */
  linha?: [Pt, Pt];
  eixo?: 'h' | 'v';
  /** Cota: os dois pontos MEDIDOS (de onde saem as linhas de chamada) — as alças que levam a cota a outro ponto. */
  pontas?: [Pt, Pt];
  /** Cota criada em cadeia: o nome da cadeia (a linha de todas anda junto). */
  cadeia?: string;
  oculta: boolean;
}

/** Uma chamada como saiu no desenho, px de desenho. */
export interface InfoDaChamada {
  chave: string;
  /** O ponto da barra (onde a linha de chamada encosta). */
  ancora: Pt;
  /** O ponto de inserção do texto (começo da linha de base) e o giro, graus anti-horários. */
  texto: Pt;
  giro: number;
  /** Comprimento e corpo do texto. */
  largura: number;
  tam: number;
  /** "N1 – 15 Ø10 c/40 C=210" (o painel mostra). */
  rotulo: string;
  /** Saiu da coluna (tem lugar guardado no item). */
  posta: boolean;
  oculta: boolean;
  /** É uma etiqueta posta pelo projetista (EtiquetaNova; a chave é o id): apagar apaga de verdade. */
  etiqueta?: boolean;
  semLinha?: boolean;
}

// ── a folha ──────────────────────────────────────────────────────────────────

export type Formato = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type Orientacao = 'deitada' | 'em_pe';

/** Ponto de vista do 3D guardado com a foto: com ele a foto é refeita quando o muro muda (prancha viva). */
export interface Camera3d {
  posicao: [number, number, number];
  alvo: [number, number, number];
  cima: [number, number, number];
  ortografica: boolean;
  zoom: number;            // câmera ortográfica
  fov: number;             // câmera perspectiva
  estilo: EstiloVisual;
  armadura: boolean;
  corteX: number | null;   // corte do 3D ligado (mm) ou não
  /** Categorias apagadas no visor (Mostrar/ocultar) na hora da foto. */
  ocultas: string[];
}

export type ConteudoDoItem =
  | PedidoDeVista
  | { tipo: '3d'; camera: Camera3d; proporcao: number }            // largura/altura da foto
  | { tipo: 'detalhe'; id: string }                                 // det01…det05 (figs/app/detalhes)
  | { tipo: 'tabela'; id: 'aco' | 'blocos' | 'quantidades' | 'drenagem' };

/** O que uma vista do projeto desenha: as vistas 2D (com o lugar do corte, a fiada, o lado do isométrico) e o 3D. */
export type ConteudoDaVista = PedidoDeVista | Extract<ConteudoDoItem, { tipo: '3d' }>;
export type TipoDaVista = ConteudoDaVista['tipo'];

/** As anotações que uma vista guarda (até 16/10 ficavam no item da folha). */
export interface AnotacoesDaVista {
  chamadas?: Record<string, ChamadaPosta>;
  anotacoes?: Record<string, AnotacaoPosta>;
  cotas?: CotaNova[];
  textos?: TextoNovo[];
  etiquetas?: EtiquetaNova[];
}

/**
 * UMA VISTA DO PROJETO (Jose, 16/10: "como no Revit"; pranchas/vistas.ts): nome na lista da aba, o que ela mostra,
 * a escala (null = sem escala: isométrico e 3D), o título na folha (vazio = o automático) e as anotações. Vai numa
 * folha só; tirar da folha não apaga a vista.
 */
export interface VistaDoProjeto extends AnotacoesDaVista {
  id: string;
  nome: string;
  conteudo: ConteudoDaVista;
  escala: number | null;
  titulo: string;
  /** A sobreposição de gráficos da vista (desenhos/graficos.ts): só o que ela muda em relação à geral. */
  graficos?: SobreposicaoDaVista;
}

export interface ItemDaFolha {
  id: string;
  /** A vista do projeto que este desenho mostra. Com ela, o conteúdo, a escala, o título e as anotações são DA VISTA
   *  (o que está aqui é espelho; quem lê passa por `itemComVista`) — o item é só o lugar, o número e o tamanho. */
  vista?: string;
  conteudo: ConteudoDoItem;
  /** Escala 1:e (e = 25 → 1:25). null = sem escala (3D, imagem): aí vale largura × altura. */
  escala: number | null;
  /** Posição do canto superior esquerdo do QUADRO do item, mm na folha (origem no canto superior esquerdo). */
  x: number;
  y: number;
  /** Só para "sem escala": o tamanho no papel, mm. */
  largura?: number;
  altura?: number;
  /** Título embaixo do item, do jeito que o projetista escreveu (sem caixa alta forçada); vazio = o automático. */
  titulo: string;
  /** A sobreposição de gráficos da vista, só na LEITURA (itemComVista): a folha desenha com ela. */
  graficos?: SobreposicaoDaVista;
  /** O nome da vista, só na LEITURA (itemComVista; não vai para o arquivo): se o projetista deu nome à vista ("Corte
   *  A"), é o título quando ele não escreve outro — como no Revit. */
  nomeDaVista?: string;
  /** O número do desenho na folha, no quadrado do título (Jose, 16/10: numeração POR FOLHA, na ordem em que o
   *  desenho entrou, editável). A tabela não tem. Ausente = o arquivo de antes: ganha ao abrir (padrao.ts). */
  numero?: string;
  /** As chamadas das barras que saíram da coluna, por chave (ChamadaPosta). Ausente = todas na coluna. */
  chamadas?: Record<string, ChamadaPosta>;
  /** Ajustes nas cotas e textos automáticos, por chave (AnotacaoPosta). */
  anotacoes?: Record<string, AnotacaoPosta>;
  /** Cotas, textos e etiquetas criados na folha. */
  cotas?: CotaNova[];
  textos?: TextoNovo[];
  etiquetas?: EtiquetaNova[];
}

export interface QuadroLateral {
  largura: number;         // mm (padrão = a do carimbo)
  altura: number;          // mm
  /** Notas gerais: null = automáticas (materiais da conta); lista = o que o projetista escreveu. */
  notas: string[] | null;
  legenda: boolean;        // legenda de cores dos blocos
  quadroDeAco: boolean;    // resumo do aço por bitola
  /** Lista de ferros com o desenho de cada barra (Jose, 15/10). Arquivo de antes: ligada. */
  listaDeFerros: boolean;
}

export interface Folha {
  id: string;
  /** O conteúdo da folha, que vai para o carimbo ("Formas: vista, corte e planta"). */
  conteudo: string;
  formato: Formato;
  orientacao: Orientacao;
  itens: ItemDaFolha[];
  carimbo: { largura: number; altura: number };
  quadro: QuadroLateral;
}

/** O que é do escritório (vale para todo projeto; guardado no app). */
export interface DadosDoEscritorio {
  empresa: string;
  responsavel: string;
  crea: string;
  contato: string;
  /** Logomarca como data URL (PNG/JPG/SVG) e a largura dela no carimbo, mm (a altura segue a proporção). */
  logo: string | null;
  logoLargura: number;
}

/** O que é do projeto (vai no arquivo .alrimo). */
export interface DadosDaObra {
  obra: string;
  endereco: string;
  proprietario: string;
  art: string;
  data: string;
  revisao: string;
  /** Código do desenho (Jose, 15/10): o carimbo escreve código-folha ("ARR" → ARR-01, ARR-02…). Vazio = campo vazio. */
  codigo: string;
  desenhista: string;
  verificacao: string;
}

/** Tudo das pranchas que se grava no arquivo .alrimo (o escritório não: ele é do app). */
export interface PranchasDoProjeto {
  folhas: Folha[];
  obra: DadosDaObra;
  /** As vistas do projeto (as guardadas; as de fábrica que ninguém mexeu valem sem estar aqui — vistas.ts). */
  vistas: VistaDoProjeto[];
}
