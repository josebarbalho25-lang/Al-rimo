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
 * Quantos px de desenho viram 1 mm de papel. A anotação dos desenhos tem tamanho fixo em px (cota 11 px, título
 * 15 px, traço 0,9 px): com 4,4 px/mm a cota sai com 2,5 mm de altura no papel, o título com 3,4 mm e o traço fino
 * com 0,2 mm — a letra técnica de prancha, em qualquer escala do desenho (a escala muda o muro, não a letra).
 */
export const PX_POR_MM = 4.4;

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
  | { k: 'hachura'; aneis: Pt[][]; padrao: PadraoHachura; fundo?: string; risco?: string; camada: string; borda?: Traco }
  /** Texto: `p` = ponto de inserção na linha de base; ângulo em graus, ANTI-horário (cota vertical = 90).
   *  `mascara`: texto escrito em cima de hachura (o halo branco do SVG) — no DXF vai como MTEXT com máscara de
   *  fundo na cor do desenho, que tapa a hachura só atrás da letra. */
  | { k: 'texto'; p: Pt; t: string; altura: number; ancora: 'start' | 'middle' | 'end'; angulo: number; cor: string; negrito?: boolean; mascara?: boolean; camada: string }
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
  | { tipo: 'iso'; vista?: VistaIso; corteX?: number | null };

export interface VistaParaPrancha {
  /** Corpo SVG (sem <svg>), em px de desenho, e os <defs> que ele usa (padrões, marcadores). */
  corpo: string;
  defs: string;
  /** Caixa do desenho em px: [x, y, largura, altura] (o que a vista ocupa, já com as cotas e rótulos). */
  caixa: [number, number, number, number];
  /** Os mesmos traços, estruturados, em px de desenho. */
  primitivas: Primitiva[];
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

export interface ItemDaFolha {
  id: string;
  conteudo: ConteudoDoItem;
  /** Escala 1:e (e = 25 → 1:25). null = sem escala (3D, imagem): aí vale largura × altura. */
  escala: number | null;
  /** Posição do canto superior esquerdo do QUADRO do item, mm na folha (origem no canto superior esquerdo). */
  x: number;
  y: number;
  /** Só para "sem escala": o tamanho no papel, mm. */
  largura?: number;
  altura?: number;
  /** Título embaixo do item ("CORTE A", "VISTA FRONTAL"); a escala vai ao lado, sozinha. */
  titulo: string;
}

export interface QuadroLateral {
  largura: number;         // mm (padrão = a do carimbo)
  altura: number;          // mm
  /** Notas gerais: null = automáticas (materiais da conta); lista = o que o projetista escreveu. */
  notas: string[] | null;
  legenda: boolean;        // legenda de cores dos blocos
  quadroDeAco: boolean;    // resumo do aço por bitola
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
}

/** Tudo das pranchas que se grava no arquivo .alrimo (o escritório não: ele é do app). */
export interface PranchasDoProjeto {
  folhas: Folha[];
  obra: DadosDaObra;
}
