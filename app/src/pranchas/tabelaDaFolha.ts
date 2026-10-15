/*
  AS TABELAS DE MATERIAIS NA PRANCHA (Jose, 15/10: "a tabela de materiais com as imagens e quantidades dos blocos
  hoje não tá indo pra prancha").

  Os números vêm da MESMA tabela do quantitativo (quantitativo/tabelas.ts, tabelasDoQuantitativo): quem confere a
  prancha com a aba Quantitativo ou com o CSV acha os mesmos números, na mesma ordem, com as mesmas casas. Aqui só se
  arruma no papel:
    · blocos      — "Blocos e canaletas": a figura de cada peça (a mesma do quantitativo) e a quantidade de compra;
                    a canaleta cortada já vem somada na inteira, e a linha "das quais, para cortar" sai recuada, com
                    o gancho desenhado (o "↳" da tela não existe na fonte do CAD), fora do total;
    · quantidades — "Materiais": graute, argamassa e sapata numa tabela só, uma faixa para cada (as três tabelas
                    do quantitativo, com os totais delas);
    · drenagem    — a drenagem do quantitativo (item desligado nas entradas não aparece, como lá);
    · aco         — o resumo do aço do quantitativo (a tela não oferece: o quadro lateral já tem o dele; um arquivo
                    que o tenha abre desenhado).

  Tamanho FIXO, em milímetros de papel: a letra é a da folha (LETRA, maiúscula de 2,5 mm), não acompanha escala
  nem a largura de um quadro — por isso a tabela não tem alça de redimensionar. O título vai em cima (como as
  tabelas do quadro lateral), e o projetista troca o texto no painel.

  Sai o SVG (tela e PDF) e as primitivas (DXF), do mesmo traço: a figura da peça é DESENHO nos dois (Jose, 15/10:
  "0 imagem vinculada no DXF") — preenchimento e contorno lidos do arquivo da peça (figurasDasPecas.ts).
*/
import { esc } from '@/desenhos/formato';
import { Prancha } from '@/desenhos/prancha';
import { MARCA_DAS_QUAIS, formatarNaTela, tabelasDoQuantitativo, type Celula, type Quantitativo, type Tabela } from '@/quantitativo';
import { LETRA } from './formatos';
import { MAIUSCULA_DA_ARIAL, type ConteudoDoItem, type Primitiva, type Pt, type Traco, type VistaParaPrancha } from './tipos';
import type { FiguraPronta } from './figurasDasPecas';

export type IdDaTabela = Extract<ConteudoDoItem, { tipo: 'tabela' }>['id'];

/** O título de partida de cada tabela (o projetista escreve outro no painel). */
export const TITULO_DA_TABELA: Readonly<Record<IdDaTabela, string>> = {
  blocos: 'Blocos e canaletas',
  quantidades: 'Materiais',
  drenagem: 'Drenagem',
  aco: 'Resumo do aço',
};

export interface LinhaNoPapel {
  celulas: string[];
  /** corpo; faixa = o nome de uma das tabelas juntas (Graute, Argamassa…), de ponta a ponta; total = negrito. */
  tipo: 'corpo' | 'faixa' | 'total';
  /** Detalha a linha de cima e fica fora do total ("das quais, para cortar"): recuo com o gancho. */
  recuada?: boolean;
  /** Endereço da figura da peça (o do quantitativo, sem o '#icone'); null = linha sem figura. */
  figura?: string | null;
}

export interface TabelaNoPapel {
  cabecalho: string[];
  /** Coluna de número: alinhada à direita (o número e o cabeçalho), como na tela do quantitativo. */
  direita: boolean[];
  linhas: LinhaNoPapel[];
  /** A 1ª coluna guarda o lugar da figura (a tabela de blocos), com ou sem figura na linha. */
  comFiguras: boolean;
}

const ehNumero = (c: Celula) => c !== null && typeof c === 'object';

/** As linhas de uma tabela do quantitativo, como o papel as quer. */
function linhasDe(t: Tabela): LinhaNoPapel[] {
  const out: LinhaNoPapel[] = t.linhas.map((l, i) => {
    const recuada = t.recuadas?.[i] === true;
    const celulas = l.map(formatarNaTela);
    if (recuada && celulas[0].startsWith(MARCA_DAS_QUAIS)) celulas[0] = celulas[0].slice(MARCA_DAS_QUAIS.length);
    const figura = t.figuras?.[i]?.url ?? null;
    return { celulas, tipo: 'corpo', ...(recuada ? { recuada } : {}), ...(t.figuras ? { figura } : {}) };
  });
  if (t.total) out.push({ celulas: t.total.map(formatarNaTela), tipo: 'total' });
  return out;
}

function direitaDe(tabelas: Tabela[], colunas: number): boolean[] {
  return Array.from({ length: colunas }, (_, j) => tabelas.some((t) => t.linhas.some((l) => ehNumero(l[j]))));
}

/**
 * A tabela pedida, tirada do quantitativo do muro. Tabela que o muro não tem (drenagem toda desligada) volta com o
 * cabeçalho e nenhuma linha: o desenho escreve um traço.
 */
export function tabelaParaFolha(q: Quantitativo, id: IdDaTabela): TabelaNoPapel {
  const todas = tabelasDoQuantitativo(q);
  const achar = (x: string) => todas.find((t) => t.id === x);
  if (id === 'quantidades') {
    const partes = ['graute', 'argamassa', 'sapata'].map(achar).filter((t): t is Tabela => !!t);
    const cabecalho = partes[0]?.cabecalho ?? ['Item', 'Quantidade', 'Unidade'];
    return {
      cabecalho,
      direita: direitaDe(partes, cabecalho.length),
      linhas: partes.flatMap((t): LinhaNoPapel[] => [{ celulas: [t.titulo], tipo: 'faixa' }, ...linhasDe(t)]),
      comFiguras: false,
    };
  }
  const t = achar(id);
  if (!t) return { cabecalho: ['Item', 'Quantidade', 'Unidade'], direita: [false, true, false], linhas: [], comFiguras: false };
  return { cabecalho: t.cabecalho, direita: direitaDe([t], t.cabecalho.length), linhas: linhasDe(t), comFiguras: !!t.figuras?.some(Boolean) };
}

// ── o desenho ────────────────────────────────────────────────────────────────

const TINTA = '#262626';
const FINO = 0.18;     // mm — divisões (as mesmas do quadro lateral)
const MEDIO = 0.35;    // mm — borda da tabela
const PAD = 1.5;       // mm — folga do texto na célula
const LIN = LETRA.nota + 2.2;   // mm — linha de texto (a do quadro lateral)
/** Linha com a figura da peça: a peça com 8 mm de altura — o furo e a amarração se leem impressos. */
const FIG_H = 8;
const LIN_FIG = FIG_H + 2;
/** Lugar da figura na 1ª coluna: fixo (a figura chega depois, e a tabela não pode pular quando ela chega). */
const FIG_W = 10;
const RECUO = 3.5;     // mm — o gancho e o recuo da linha "das quais"
const CAP = LETRA.nota * MAIUSCULA_DA_ARIAL;

const n = (x: number): string => (Math.round(x * 1000) / 1000).toString();
const largura = (t: string, negrito = false) => Prancha.largura(t, LETRA.nota, negrito);

/** O papel da tabela: SVG e primitivas lado a lado (o mesmo traço nas duas saídas). */
class Riscador {
  svg: string[] = [];
  prims: Primitiva[] = [];

  linha(a: Pt, b: Pt, espessura: number): void {
    const e: Traco = { camada: 'tabelas', cor: TINTA, espessura };
    this.svg.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" stroke="${TINTA}" stroke-width="${n(espessura)}" stroke-linecap="square"/>`);
    this.prims.push({ k: 'linha', a, b, e });
  }

  texto(p: Pt, t: string, altura: number, ancora: 'start' | 'middle' | 'end', negrito = false): void {
    if (!t) return;
    this.svg.push(
      `<text x="${n(p[0])}" y="${n(p[1])}" font-size="${n(altura)}" text-anchor="${ancora}" fill="${TINTA}"` +
        `${negrito ? ' font-weight="bold"' : ''} font-family="Arial,'DejaVu Sans',sans-serif">${esc(t)}</text>`,
    );
    this.prims.push({ k: 'texto', p, t, altura, ancora, angulo: 0, cor: TINTA, negrito, camada: 'tabelas' });
  }

  /**
   * A peça no retângulo w × h com canto em (x, y): os pontos vão para o papel, a espessura e o tracejado já vêm em
   * mm (o contorno da peça é o da camada, não encolhe com ela). No SVG o preenchimento ganha um traço da própria cor,
   * fino, que só tapa a fresta de meio pixel entre faixas vizinhas na tela.
   */
  figura(x: number, y: number, w: number, h: number, f: FiguraPronta): void {
    const [cx, cy] = f.caixa;
    const k = Math.min(w / f.caixa[2], h / f.caixa[3]);
    const P = ([px, py]: Pt): Pt => [x + (px - cx) * k, y + (py - cy) * k];
    const d = (pts: Pt[], fechar: boolean) => `M${pts.map(([a, b]) => `${n(a)},${n(b)}`).join('L')}${fechar ? 'Z' : ''}`;
    const tracoSvg = (e: Traco) => ` stroke="${e.cor}" stroke-width="${n(e.espessura)}" stroke-linejoin="round"${e.tracejado ? ` stroke-dasharray="${e.tracejado.map(n).join(' ')}"` : ''}`;
    for (const q of f.prims) {
      if (q.k === 'hachura') {
        const aneis = q.aneis.map((a) => a.map(P));
        const fundo = q.fundo ?? TINTA;
        this.svg.push(`<path d="${aneis.map((a) => d(a, true)).join('')}" fill="${fundo}" stroke="${fundo}" stroke-width="0.02" fill-rule="evenodd"/>`);
        if (q.borda) this.svg.push(`<path d="${aneis.map((a) => d(a, true)).join('')}" fill="none"${tracoSvg(q.borda)}/>`);
        this.prims.push({ ...q, aneis });
      } else if (q.k === 'polilinha') {
        const pts = q.pts.map(P);
        this.svg.push(`<path d="${d(pts, q.fechada)}" fill="none"${tracoSvg(q.e)}/>`);
        this.prims.push({ ...q, pts });
      } else if (q.k === 'linha') {
        const [a, b] = [P(q.a), P(q.b)];
        this.svg.push(`<path d="${d([a, b], false)}" fill="none"${tracoSvg(q.e)}/>`);
        this.prims.push({ ...q, a, b });
      }
    }
  }
}

/**
 * A tabela desenhada em mm de papel, com o canto superior esquerdo do título em (0, 0). `figura` devolve a figura
 * pronta de um endereço (null enquanto não chegou, ou se não há): a célula guarda o lugar dela de qualquer jeito.
 */
export function desenharTabela(t: TabelaNoPapel, titulo: string, figura: (url: string) => FiguraPronta | null = () => null): VistaParaPrancha {
  const r = new Riscador();
  const ncol = t.cabecalho.length;
  const corpo = t.linhas.length ? t.linhas : [{ celulas: t.cabecalho.map(() => '—'), tipo: 'corpo' as const }];

  // larguras: o texto mais largo de cada coluna (negrito no cabeçalho e no total) + a folga; a 1ª guarda a figura
  const w = t.cabecalho.map((c, j) => largura(c, true) + 2 * PAD + (j === 0 && t.comFiguras ? FIG_W : 0));
  for (const l of corpo) {
    if (l.tipo === 'faixa') continue;
    l.celulas.forEach((c, j) => {
      if (j >= ncol) return;
      const extra = j === 0 ? (t.comFiguras ? FIG_W : 0) + (l.recuada ? RECUO : 0) : 0;
      w[j] = Math.max(w[j], largura(c, l.tipo === 'total') + 2 * PAD + extra);
    });
  }
  // a faixa vai de ponta a ponta: se o nome dela não cabe na largura toda, a 1ª coluna cresce
  const faixaMaior = Math.max(0, ...corpo.filter((l) => l.tipo === 'faixa').map((l) => largura(l.celulas[0], true) + 2 * PAD));
  const soma = w.reduce((s, x) => s + x, 0);
  if (faixaMaior > soma) w[0] += faixaMaior - soma;
  const W = w.reduce((s, x) => s + x, 0);
  const xs = w.reduce<number[]>((acc, x, j) => [...acc, acc[j] + x], [0]);

  // título
  const tituloTxt = titulo.trim().toUpperCase();
  let y = 0;
  if (tituloTxt) {
    y += LETRA.titulo;
    r.texto([0, y], tituloTxt, LETRA.titulo, 'start', true);
    y += 2.5;
  }
  const y0 = y;

  const escrever = (cel: string[], topo: number, h: number, negrito: boolean, recuada = false, comFigura = false) => {
    const base = topo + h / 2 + CAP / 2;
    cel.slice(0, ncol).forEach((c, j) => {
      if (t.direita[j]) r.texto([xs[j + 1] - PAD, base], c, LETRA.nota, 'end', negrito);
      else {
        const x = xs[j] + PAD + (j === 0 && comFigura ? FIG_W : 0) + (j === 0 && recuada ? RECUO : 0);
        r.texto([x, base], c, LETRA.nota, 'start', negrito);
      }
    });
  };

  // cabeçalho
  escrever(t.cabecalho, y, LIN, true);
  y += LIN;
  // as linhas: corridas sem faixa levam as divisões verticais; a faixa é uma célula só
  const verticais: [number, number][] = [];
  let inicio = y0;
  const horizontais: number[] = [y];
  for (const l of corpo) {
    const h = l.figura !== undefined && t.comFiguras ? LIN_FIG : LIN;
    if (l.tipo === 'faixa') {
      if (y > inicio) verticais.push([inicio, y]);
      r.texto([PAD, y + h / 2 + CAP / 2], l.celulas[0], LETRA.nota, 'start', true);
      inicio = y + h;
    } else {
      escrever(l.celulas, y, h, l.tipo === 'total', l.recuada, t.comFiguras);
      if (l.recuada) {
        // o gancho do "das quais": desce do alto da letra até o meio dela e vira para o texto
        const xg = xs[0] + PAD + (t.comFiguras ? FIG_W : 0) + 0.6;
        const meio = y + h / 2;
        r.linha([xg, meio - CAP / 2], [xg, meio], FINO);
        r.linha([xg, meio], [xg + RECUO - 1.4, meio], FINO);
      }
      const f = l.figura ? figura(l.figura) : null;
      if (f) {
        // a peça cabe no lugar dela pela altura; peça larga encolhe pela largura
        const fw = Math.min(FIG_W - 1, FIG_H * f.proporcao);
        const fh = fw / f.proporcao;
        r.figura(xs[0] + PAD + (FIG_W - 1 - fw) / 2 - 0.5, y + (h - fh) / 2, fw, fh, f);
      }
    }
    y += h;
    horizontais.push(y);
  }
  if (y > inicio) verticais.push([inicio, y]);

  // a grade: divisões finas, borda média
  for (const yy of horizontais.slice(0, -1)) r.linha([0, yy], [W, yy], FINO);
  for (const [a, b] of verticais) for (const x of xs.slice(1, -1)) r.linha([x, a], [x, b], FINO);
  r.linha([0, y0], [W, y0], MEDIO);
  r.linha([W, y0], [W, y], MEDIO);
  r.linha([W, y], [0, y], MEDIO);
  r.linha([0, y], [0, y0], MEDIO);

  const larguraDoTitulo = tituloTxt ? Prancha.largura(tituloTxt, LETRA.titulo, true) : 0;
  return { corpo: r.svg.join(''), defs: '', caixa: [0, 0, Math.max(W, larguraDoTitulo), y], primitivas: r.prims };
}
