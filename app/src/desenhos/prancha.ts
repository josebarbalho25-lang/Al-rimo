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
import type { PadraoHachura, Primitiva, Traco } from '@/pranchas/tipos';
import { esc, n } from './formato';
import { HACHURA, hachurasDeMaterial, ladrilhoDeMaterial, type MaterialComLadrilho } from './hachuras';

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
  if ('mwMW—'.includes(c)) return 0.86;
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
}

export interface OpcoesTexto {
  tam?: number;
  ancora?: 'start' | 'middle' | 'end';
  cor?: string;
  negrito?: boolean;
  vertical?: boolean;   // girado −90° (lê de baixo para cima), como cota vertical
  halo?: boolean;       // contorno branco por baixo: texto legível em cima de hachura
  camada?: string;      // camada do DXF (padrão 'textos')
}

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
}

export type Pt = [number, number];

type NomeDoPadrao = 'solo' | 'conc' | 'alv' | 'brita' | 'areia' | 'graute';

/**
 * Padrão de preenchimento do SVG → hachura do DXF: o padrão do CAD, o fundo e o risco (as mesmas cores do
 * ladrilho do SVG) e a camada do material. O graute visto não tem fundo — a cor do bloco aparece entre os riscos.
 */
const HACHURA_DO_PADRAO: Record<NomeDoPadrao, { padrao: PadraoHachura; fundo?: string; risco: string; camada: string }> = {
  solo: { padrao: 'terra', fundo: HACHURA.terraFundo, risco: HACHURA.terra, camada: 'terreno' },
  conc: { padrao: 'concreto', fundo: HACHURA.concretoFundo, risco: HACHURA.concreto, camada: 'concreto' },
  alv: { padrao: 'alvenaria', fundo: COR.blocoFundo, risco: COR.bloco, camada: 'alvenaria' },
  brita: { padrao: 'brita', fundo: HACHURA.britaFundo, risco: HACHURA.brita, camada: 'drenagem' },
  areia: { padrao: 'areia', fundo: HACHURA.areiaFundo, risco: HACHURA.areia, camada: 'drenagem' },
  graute: { padrao: 'graute', risco: COR.grauteFundo, camada: 'graute' },
};

/**
 * Os riscados de linha só: um risco vertical em x = 0 de cada ladrilho `passo` × `passo`, a grade girada de `giro`
 * graus. Daqui saem o <pattern> da tela e o traço do PDF — o mesmo desenho nos dois.
 */
const RISCADO: Record<'alv' | 'graute', { passo: number; giro: number; fundo?: string; risco: string; sw: number }> = {
  alv: { passo: 6, giro: 45, fundo: COR.blocoFundo, risco: COR.bloco, sw: 0.9 },
  // graute visto atrás da face do bloco (vista frontal): só riscos, SEM fundo — a cor do tipo de bloco (o código
  // de cor da obra) continua aparecendo entre eles. Um tom chapado por cima, como antes, tingia o cinza do
  // inteiro de azul e ele passava por meio bloco
  graute: { passo: 5, giro: 45, risco: COR.grauteFundo, sw: 1.6 },
};

function padraoRiscado(id: string, r: (typeof RISCADO)['alv']): string {
  const fundo = r.fundo ? `<rect width="${r.passo}" height="${r.passo}" fill="${r.fundo}"/>` : '';
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${r.passo}" height="${r.passo}" patternTransform="rotate(${r.giro})">` +
    `${fundo}<line x1="0" y1="0" x2="0" y2="${r.passo}" stroke="${r.risco}" stroke-width="${r.sw}"/></pattern>`
  );
}

/** Número das posições da hachura em vetor: três casas (a grade não pode andar o 0,1 px do `n` a cada ladrilho). */
function n3(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Tintas que, sozinhas, já dizem o material (passo 3 do cabeçalho). As outras cores repetem entre materiais. */
const CAMADA_DA_COR: Record<string, string> = {
  [COR.aco]: 'aco',
  [COR.solo]: 'terreno',
  [COR.graute]: 'graute',
  [COR.grauteFundo]: 'graute',
};

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
  private ladrilhosUsados = new Set<MaterialComLadrilho>();

  /** `hachuraVetorial`: o SVG do PDF, sem <pattern> (cabeçalho, "HACHURA EM VETOR"). */
  constructor(readonly prefixo = 'des', readonly hachuraVetorial = false) {}

  /** Referência a um padrão de preenchimento desta prancha. */
  padrao(nome: NomeDoPadrao): string {
    return `url(#${this.prefixo}-${nome})`;
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
    return nome in HACHURA_DO_PADRAO ? (nome as NomeDoPadrao) : null;
  }

  /** O padrão do SVG por trás de um `fill="url(#…)"` desta prancha (null para cor chapada ou 'none'). */
  private padraoDoFill(fill: string | undefined): (typeof HACHURA_DO_PADRAO)[NomeDoPadrao] | null {
    const nome = this.nomeDoPadrao(fill);
    return nome ? HACHURA_DO_PADRAO[nome] : null;
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
    if (nome === 'alv' || nome === 'graute') {
      const r = RISCADO[nome];
      fundo = r.fundo;
      riscos = this.riscadoEmVetor(r, x0, y0, x1, y1);
    } else {
      const l = ladrilhoDeMaterial(nome);
      fundo = l.fundo;
      this.ladrilhosUsados.add(nome);
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
    if (e.opacidade !== undefined) g.push(`opacity="${Math.min(1, Math.max(0, e.opacidade)).toFixed(2)}"`);
    if (e.extra) g.push(e.extra);
    let s = `<g${g.length ? ' ' + g.join(' ') : ''}>`;
    if (fundo) s += `<path d="${d}" fill-rule="evenodd" fill="${fundo}" stroke="none"/>`;
    s += `<g clip-path="url(#${id})">${riscos}</g>`;
    if ((e.stroke ?? COR.linha) !== 'none') {
      s += `<path d="${d}" fill-rule="evenodd" ${this.atributos({ ...e, fill: 'none', id: undefined, opacidade: undefined, extra: undefined })}/>`;
    }
    this.corpo.push(s + '</g>');
    return true;
  }

  /**
   * O riscado (alvenaria, graute) em vetor: um traço por coluna da grade girada, cobrindo a caixa da área. No
   * <pattern> o risco em x = 0 é cortado pela borda do próprio ladrilho — só a metade de dentro aparece, de 0 a
   * sw/2 —, então o traço do PDF sai com sw/2 de largura, centrado em sw/4: a mesma faixa pintada da tela.
   */
  private riscadoEmVetor(r: (typeof RISCADO)['alv'], x0: number, y0: number, x1: number, y1: number): string {
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
    const p = this.padraoDoFill(fill);
    if (p) return p.camada;
    const porCor = CAMADA_DA_COR[fill] ?? CAMADA_DA_COR[stroke];
    if (porCor) return porCor;
    const grupo = this.grupos[this.grupos.length - 1];
    return (grupo && CAMADA_DO_GRUPO[grupo]) || 'geral';
  }

  private traco(stroke: string, e: Estilo, camada: string): Traco {
    const t: Traco = { camada, cor: stroke, espessura: e.sw ?? 1 };
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
    if (fill !== 'none' && fechados.length) {
      const p = this.padraoDoFill(fill);
      const h: Extract<Primitiva, { k: 'hachura' }> = p
        ? { k: 'hachura', aneis: fechados, padrao: p.padrao, risco: p.risco, camada }
        : { k: 'hachura', aneis: fechados, padrao: 'solido', fundo: fill, camada };
      if (p?.fundo) h.fundo = p.fundo;
      if (borda) h.borda = borda;
      this.prims.push(h);
      return;
    }
    if (!borda) return;
    for (const a of aneis) if (a.length >= 2) this.prims.push({ k: 'polilinha', pts: a.map(([x, y]): Pt => [x, y]), fechada: true, e: borda });
  }

  /** Linha de cota com as duas marcas oblíquas como riscos de verdade (o DXF não tem <marker>). */
  private anotarLinhaDeCota(xa: number, ya: number, xb: number, yb: number): void {
    const e: Traco = { camada: 'cotas', cor: COR.cota, espessura: 0.9 };
    this.prims.push({ k: 'linha', a: [xa, ya], b: [xb, yb], e });
    // orient="auto": o eixo x da marca acompanha a linha, de A para B, nas duas pontas
    const L = Math.hypot(xb - xa, yb - ya);
    const [dx, dy] = L > 0 ? [(xb - xa) / L, (yb - ya) / L] : [1, 0];
    const k = MARCA.lado / MARCA.caixa;
    const gira = ([u, v]: Pt): Pt => [((u - MARCA.ref) * dx - (v - MARCA.ref) * dy) * k, ((u - MARCA.ref) * dy + (v - MARCA.ref) * dx) * k];
    const [p, q] = [gira(MARCA.de), gira(MARCA.ate)];
    const marca: Traco = { camada: 'cotas', cor: COR.cota, espessura: MARCA.sw * k };
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
  }

  private atributos(e: Estilo, fillPadrao = 'none', strokePadrao: string = COR.linha): string {
    let fill = e.fill ?? fillPadrao;
    // no SVG do PDF não há <pattern> para apontar: o que sobrar com padrão (área sem anel fechado, linha com fill)
    // não tem miolo para pintar, e o url(#…) órfão não pode ir para o papel
    if (this.hachuraVetorial && this.nomeDoPadrao(fill)) fill = 'none';
    const a = [`fill="${fill}"`];
    const st = e.stroke ?? strokePadrao;
    a.push(`stroke="${st}"`);
    if (st !== 'none') a.push(`stroke-width="${n(e.sw ?? 1)}"`);
    if (e.dash) a.push(`stroke-dasharray="${e.dash}"`);
    if (e.opacidade !== undefined) a.push(`opacity="${Math.min(1, Math.max(0, e.opacidade)).toFixed(2)}"`);
    if (e.id) a.push(`data-id="${esc(e.id)}"`);
    if (e.extra) a.push(e.extra);
    return a.join(' ');
  }

  rect(x: number, y: number, w: number, h: number, e: Estilo = {}): void {
    const xa = Math.min(x, x + w), ya = Math.min(y, y + h);
    const ww = Math.abs(w), hh = Math.abs(h);
    if (!(ww > 0 && hh > 0)) return;
    const aneis: Pt[][] = [[[xa, ya], [xa + ww, ya], [xa + ww, ya + hh], [xa, ya + hh]]];
    if (!this.areaEmVetor(aneis, e)) this.corpo.push(`<rect x="${n(xa)}" y="${n(ya)}" width="${n(ww)}" height="${n(hh)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xa + ww, ya + hh);
    this.anotarArea(aneis, e);
  }

  linha(xa: number, ya: number, xb: number, yb: number, e: Estilo = {}): void {
    this.corpo.push(`<line x1="${n(xa)}" y1="${n(ya)}" x2="${n(xb)}" y2="${n(yb)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xb, yb);
    const stroke = e.stroke ?? COR.linha;
    if (!e.soTela && stroke !== 'none') {
      this.prims.push({ k: 'linha', a: [xa, ya], b: [xb, yb], e: this.traco(stroke, e, this.camadaDe(e, e.fill ?? 'none', stroke)) });
    }
  }

  poligono(pts: Pt[], e: Estilo = {}): void {
    if (pts.length < 2) return;
    if (!this.areaEmVetor([pts], e)) {
      const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
      this.corpo.push(`<polygon points="${p}" ${this.atributos(e)}/>`);
    }
    for (const [x, y] of pts) this.estender(x, y, x, y);
    this.anotarArea([pts], e);
  }

  /** Polilinha aberta (o preenchimento, se alguém passar, não vai para o DXF: nenhum desenho usa). */
  polilinha(pts: Pt[], e: Estilo = {}): void {
    if (pts.length < 2) return;
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
    const d = aneis
      .filter((a) => a.length >= 3)
      .map((a) => 'M' + a.map(([x, y]) => `${n(x)},${n(y)}`).join('L') + 'Z')
      .join('');
    if (!d) return;
    if (!this.areaEmVetor(aneis, e)) this.corpo.push(`<path d="${d}" fill-rule="evenodd" ${this.atributos(e)}/>`);
    for (const a of aneis) for (const [x, y] of a) this.estender(x, y, x, y);
    this.anotarArea(aneis.filter((a) => a.length >= 3), e);
  }

  circulo(cx: number, cy: number, r: number, e: Estilo = {}): void {
    this.corpo.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${this.atributos(e, COR.aco, 'none')}/>`);
    this.estender(cx - r, cy - r, cx + r, cy + r);
    if (e.soTela) return;
    const fill = e.fill ?? COR.aco;
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
    const tam = o.tam ?? 12;
    const anc = o.ancora ?? 'middle';
    const cor = o.cor ?? COR.linha;
    const w = Prancha.largura(t, tam, o.negrito);
    const rot = o.vertical ? ` transform="rotate(-90 ${n(x)} ${n(y)})"` : '';
    const halo = o.halo ? ' paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"' : '';
    this.corpo.push(
      `<text x="${n(x)}" y="${n(y)}" font-size="${n(tam)}" text-anchor="${anc}" fill="${cor}"` +
        `${o.negrito ? ' font-weight="bold"' : ''} font-family="${FONTE}"${halo}${rot}>${esc(t)}</text>`,
    );
    // caixa do texto: linha de base em y, sobe ~0,8·corpo e desce ~0,25·corpo
    const a0 = anc === 'start' ? 0 : anc === 'middle' ? -w / 2 : -w;
    if (!o.vertical) this.estender(x + a0, y - 0.85 * tam, x + a0 + w, y + 0.25 * tam);
    else this.estender(x - 0.85 * tam, y - a0 - w, x + 0.25 * tam, y - a0);
    // o y do texto já é a linha de base, que é o ponto de inserção do DXF; o giro de −90° do SVG (y para baixo)
    // é o de +90° anti-horário do CAD (y para cima): a cota vertical lê de baixo para cima nos dois
    if (!t) return;
    const p: Extract<Primitiva, { k: 'texto' }> = {
      k: 'texto', p: [x, y], t, altura: tam, ancora: anc, angulo: o.vertical ? 90 : 0, cor, camada: o.camada ?? 'textos',
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
  cotaH(xa: number, xb: number, y: number, rotulo: string, o: { de?: [number, number]; tam?: number } = {}): void {
    this.cadeiaH([{ a: xa, b: xb, rotulo }], y, { tam: o.tam, de: o.de ? [o.de] : undefined });
  }

  private linhaDeCotaH(xa: number, xb: number, y: number, de?: [number, number]): [number, number] {
    const [x1, x2] = xa <= xb ? [xa, xb] : [xb, xa];
    if (de) {
      for (const [x, y0] of [[x1, de[0]], [x2, de[1]]] as Pt[]) {
        const s = y > y0 ? 1 : -1;
        if (Math.abs(y - y0) > 3) this.linha(x, y0 + s * 2, x, y + s * 4, { stroke: COR.cota, sw: 0.6, camada: 'cotas' });
      }
    }
    this.corpo.push(
      `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${COR.cota}" stroke-width="0.9"` +
        ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
    );
    this.estender(x1 - 4, y - 4, x2 + 4, y + 4);
    this.anotarLinhaDeCota(x1, y, x2, y);
    return [x1, x2];
  }

  /**
   * Cotas em cadeia numa mesma linha. O rótulo vai acima, centrado; o que não cabe entre as marcas sai para fora
   * (ponta da cadeia) ou sobe um degrau (meio da cadeia) — e sobe mais se ainda bater num rótulo vizinho. Sem
   * isso, duas cotas curtas lado a lado (as duas pontas de uma junta) escrevem uma em cima da outra.
   * `de`: para cada segmento, os y de onde partem as linhas de chamada (ou um par para todos).
   */
  cadeiaH(segs: { a: number; b: number; rotulo: string }[], y: number, o: { tam?: number; de?: [number, number][] } = {}): void {
    const tam = o.tam ?? 11;
    const ocupados: [number, number, number][] = [];
    segs.forEach((s, k) => {
      const de = o.de ? o.de[Math.min(k, o.de.length - 1)] : undefined;
      const [x1, x2] = this.linhaDeCotaH(s.a, s.b, y, de);
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
      // halo branco: o rótulo fica legível quando um eixo ou uma chamada passa por baixo dele
      this.texto(x0, y - 4 - nivel * (tam + 2), s.rotulo, { tam, cor: COR.cota, ancora: 'start', halo: true, camada: 'cotas' });
    });
  }

  /** Cota vertical (figlib.dim_v). `lado` −1 escreve à esquerda da linha, +1 à direita. */
  cotaV(x: number, ya: number, yb: number, rotulo: string, o: { de?: [number, number]; lado?: -1 | 1; tam?: number } = {}): void {
    const tam = o.tam ?? 11;
    const lado = o.lado ?? -1;
    const [y1, y2] = ya <= yb ? [ya, yb] : [yb, ya];
    if (o.de) {
      for (const [y, x0] of [[y1, o.de[0]], [y2, o.de[1]]] as Pt[]) {
        const s = x > x0 ? 1 : -1;
        this.linha(x0 + s * 2, y, x + s * 4, y, { stroke: COR.cota, sw: 0.6, camada: 'cotas' });
      }
    }
    this.corpo.push(
      `<line x1="${n(x)}" y1="${n(y1)}" x2="${n(x)}" y2="${n(y2)}" stroke="${COR.cota}" stroke-width="0.9"` +
        ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
    );
    this.estender(x - 4, y1 - 4, x + 4, y2 + 4);
    this.anotarLinhaDeCota(x, y1, x, y2);
    const w = Prancha.largura(rotulo, tam);
    const xt = lado < 0 ? x - 4 : x + 4 + 0.85 * tam;
    if (w + 6 <= y2 - y1) this.texto(xt, (y1 + y2) / 2, rotulo, { tam, cor: COR.cota, vertical: true, halo: true, camada: 'cotas' });
    else this.texto(xt, y1 - 5, rotulo, { tam, cor: COR.cota, vertical: true, ancora: 'start', halo: true, camada: 'cotas' });
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
      `<path d="M${M.de[0]},${M.de[1]} L${M.ate[0]},${M.ate[1]}" stroke="${COR.cota}" stroke-width="${M.sw}"/></marker>`;
    if (this.hachuraVetorial) {
      // só os ladrilhos que alguma área usou; overflow hidden: cada cópia recortada no quadrado dela, como no <pattern>
      const ladrilhos = [...this.ladrilhosUsados].map((k) => {
        const l = ladrilhoDeMaterial(k);
        return `<symbol id="${p}-lad-${k}" viewBox="0 0 ${n3(l.lado)} ${n3(l.lado)}" overflow="hidden">${l.miolo}</symbol>`;
      });
      return marca + ladrilhos.join('') + this.recortes.join('');
    }
    // terra, concreto, areia e brita: as hachuras do Revit do Jose (hachuras.ts); alvenaria e graute: RISCADO
    return marca + hachurasDeMaterial(p) + padraoRiscado(`${p}-alv`, RISCADO.alv) + padraoRiscado(`${p}-graute`, RISCADO.graute);
  }

  /** Pedaços do desenho para quem quer controlar o viewBox (zoom/arrasto do componente). */
  partes(margem = 14): { viewBox: [number, number, number, number]; defs: string; corpo: string } {
    const vazio = !Number.isFinite(this.x0);
    const x = vazio ? 0 : Math.floor(this.x0 - margem);
    const y = vazio ? 0 : Math.floor(this.y0 - margem);
    const w = vazio ? 100 : Math.ceil(this.x1 + margem) - x;
    const h = vazio ? 100 : Math.ceil(this.y1 + margem) - y;
    return { viewBox: [x, y, w, h], defs: this.defs(), corpo: this.corpo.join('') };
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
