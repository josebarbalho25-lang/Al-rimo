/*
  A FOLHA COMPOSTA — moldura, desenhos, títulos, quadro lateral e carimbo, em MILÍMETROS DE PAPEL.

  Sai das mesmas contas o SVG (tela e PDF) e a lista de primitivas (DXF): o que se vê na tela é o que vai para o
  arquivo, sem segundo desenhista. Os desenhos chegam prontos de quem os faz (desenhos/ para as vistas 2D e o 3D em
  vetor; visor/ para a foto do Realista) por `ContextoDaFolha.desenhar` — a folha não sabe desenhar muro, só
  arrumar o que recebe no papel.

  Coordenadas: origem no canto superior esquerdo da folha, y para baixo (como o SVG e as primitivas do contrato).
*/
import { Prancha } from '@/desenhos/prancha';
import { esc } from '@/desenhos/formato';
import { CARIMBO_PADRAO, LETRA, quadroUtil, rotuloDaEscala, tamanhoDaFolha } from './formatos';
import { MAIUSCULA_DA_ARIAL, PX_POR_MM, transformarPrimitivas, type AtributoDoBloco, type DadosDaObra, type DadosDoEscritorio, type Folha, type ItemDaFolha, type Primitiva, type Pt, type Traco, type VistaParaPrancha } from './tipos';
import { comPerda, type ItemDaLegenda, type LinhaDeFerroDaFolha, type LinhaDoAco } from './quadro';
import type { FormaDaBarra } from './formaDaBarra';
import { dataUrlParaBytes } from './zip';
import { pixelsDaImagem } from './dxf';

/** O que a folha recebe de fora para um item: um desenho vetorial (em px de desenho) ou uma imagem. */
export type ItemDesenhado =
  | { tipo: 'vetor'; vista: VistaParaPrancha }
  | { tipo: 'imagem'; dataUrl: string; arquivo: string; proporcao: number };

export interface ContextoDaFolha {
  numero: number;
  total: number;
  obra: DadosDaObra;
  escritorio: DadosDoEscritorio;
  notasAutomaticas: string[];
  legenda: ItemDaLegenda[];
  aco: { linhas: LinhaDoAco[]; total: number };
  /** A lista de ferros com a forma de cada barra (quadro.ts); ausente = sem lista. */
  ferros?: LinhaDeFerroDaFolha[];
  /**
   * O desenho do item, ou null enquanto não chegou (a foto do 3D é assíncrona) ou se não pode ser feito.
   * `legendaDeCores`: a vista traz a legenda das cores dos blocos (quando o quadro lateral da folha não a mostra).
   */
  desenhar: (item: ItemDaFolha, prefixo: string, opcoes: { legendaDeCores: boolean; vetorial?: boolean }) => ItemDesenhado | null;
  /** O título do item quando o projetista não escreveu um ("Corte no contraforte C2", "Planta — 1ª fiada"). */
  tituloAutomatico?: (item: ItemDaFolha) => string;
  /** Composição para o ARQUIVO (PDF/DXF): o lugar tracejado de um desenho que não chegou não vai para o papel. */
  saida?: boolean;
  /** O muro não passa (ou a conta não deu veredito): a folha sai com a tarja NÃO VERIFICADO atravessada. */
  naoVerificado?: boolean;
  /** Começo dos ids dos padrões ('p' na tela): a cópia de impressão usa outro — dois ids iguais no mesmo documento
   *  e o padrão da cópia resolveria no da tela, escondido na impressão (o Chrome não pinta padrão de display:none). */
  prefixo?: string;
}

/** Onde o item ficou na folha (mm): o quadro do desenho e o do título — a tela usa para arrastar e redimensionar. */
export interface ItemPosto {
  id: string;
  caixa: [number, number, number, number];
  titulo: [number, number, number, number] | null;
  pendente: boolean;
  /** O desenho (ou o título) passa da moldura ou cai em cima do carimbo / do quadro lateral: a tela avisa. */
  invade: boolean;
}

export interface FolhaComposta {
  largura: number;
  altura: number;
  svg: string;
  primitivas: Primitiva[];
  itens: ItemPosto[];
  carimbo: [number, number, number, number];
  quadro: [number, number, number, number] | null;
  /** O quadro lateral não coube na altura dada (a tela avisa com a borda). */
  quadroEstourou: boolean;
}

const TINTA = '#262626';
const CINZA = '#595959';
const FINO = 0.18;     // mm — linha fina (divisões do carimbo, borda do papel)
const MEDIO = 0.35;    // mm — moldura do quadro do carimbo
const GROSSO = 0.5;    // mm — moldura da folha

const n = (x: number): string => (Math.round(x * 1000) / 1000).toString();
const larguraDoTexto = (t: string, altura: number, negrito = false): number => Prancha.largura(t, altura, negrito);

/**
 * A altura de letra (até 1,5 mm) para o texto caber na largura, SEM cortar (o atributo do carimbo vai inteiro).
 * `medir` dá a largura com a letra `a` — medida do jeito que o texto é posto (com o negrito de cada parte): medido
 * sem o negrito, o nome da empresa cabia na conta e o contato vazava a borda do carimbo.
 */
function caberAltura(medir: (a: number) => number, altura: number, largura: number): number {
  let a = altura;
  while (a > 1.5 && medir(a) > largura) a -= 0.1;
  return a;
}

/** Quebra o texto em linhas que caibam na largura (por palavra). */
function quebrar(t: string, altura: number, largura: number): string[] {
  const palavras = t.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (atual && larguraDoTexto(tentativa, altura) > largura) {
      linhas.push(atual);
      atual = p;
    } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Um desenhista de folha: escreve o SVG e as primitivas lado a lado. */
class Papel {
  svg: string[] = [];
  prims: Primitiva[] = [];

  traco(camada: string, espessura: number, cor = TINTA, tracejado?: number[]): Traco {
    return tracejado ? { camada, cor, espessura, tracejado } : { camada, cor, espessura };
  }

  rect(x: number, y: number, w: number, h: number, e: Traco, fundo?: string, guardar = true): void {
    this.svg.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fundo ?? 'none'}" stroke="${e.cor}" stroke-width="${n(e.espessura)}"/>`);
    if (!guardar) return;
    const pts: Pt[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    if (fundo && fundo !== 'none') this.prims.push({ k: 'hachura', aneis: [pts], padrao: 'solido', fundo, camada: e.camada });
    this.prims.push({ k: 'polilinha', pts, fechada: true, e });
  }

  linha(a: Pt, b: Pt, e: Traco, guardar = true): void {
    this.svg.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" stroke="${e.cor}" stroke-width="${n(e.espessura)}"/>`);
    if (guardar) this.prims.push({ k: 'linha', a, b, e });
  }

  /** `angulo`: graus anti-horários (o do CAD; no SVG, y para baixo, vira rotate negativo). `contorno`: só o traço da
   *  letra, mm (a tarja: o desenho continua legível por baixo). */
  texto(
    p: Pt, t: string, altura: number,
    o: { ancora?: 'start' | 'middle' | 'end'; cor?: string; negrito?: boolean; camada?: string; angulo?: number; contorno?: number } = {},
    guardar = true,
  ): Primitiva {
    const ancora = o.ancora ?? 'start';
    const cor = o.cor ?? TINTA;
    const angulo = o.angulo ?? 0;
    const pintura = o.contorno ? `fill="none" stroke="${cor}" stroke-width="${n(o.contorno)}" stroke-linejoin="round"` : `fill="${cor}"`;
    const giro = angulo ? ` transform="rotate(${n(-angulo)} ${n(p[0])} ${n(p[1])})"` : '';
    // espaço na ponta (o separador " — " do carimbo): o SVG come por padrão, e o "—" grudava no valor de antes
    const espacos = /^\s|\s$/.test(t) ? ' xml:space="preserve"' : '';
    this.svg.push(
      `<text x="${n(p[0])}" y="${n(p[1])}" font-size="${n(altura)}" text-anchor="${ancora}" ${pintura}${espacos}` +
        `${o.negrito ? ' font-weight="bold"' : ''} font-family="Arial,'DejaVu Sans',sans-serif"${giro}>${esc(t)}</text>`,
    );
    const prim: Primitiva = { k: 'texto', p, t, altura, ancora, angulo, cor, negrito: o.negrito, camada: o.camada ?? 'textos' };
    if (guardar) this.prims.push(prim);
    return prim;
  }

  imagem(x: number, y: number, w: number, h: number, dataUrl: string, arquivo: string, camada: string): void {
    this.svg.push(`<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" href="${dataUrl}" preserveAspectRatio="xMidYMid meet"/>`);
    this.prims.push({ k: 'imagem', p: [x, y], largura: w, altura: h, arquivo, dataUrl, camada });
  }
}

/** Como o desenho do item cabe no quadro dele: escala k (mm por px de desenho) e o tamanho final, mm. */
function encaixe(item: ItemDaFolha, d: ItemDesenhado): { k: number; w: number; h: number } {
  if (d.tipo === 'imagem') {
    const w = item.largura ?? 150;
    const h = item.altura ?? w / d.proporcao;
    // a foto respeita a proporção dela dentro do quadro pedido
    const ww = Math.min(w, h * d.proporcao);
    return { k: 1, w: ww, h: ww / d.proporcao };
  }
  const [, , cw, ch] = d.vista.caixa;
  if (item.escala !== null) return { k: 1 / PX_POR_MM, w: cw / PX_POR_MM, h: ch / PX_POR_MM };
  // sem escala (3D em vetor, isométrico): manda a LARGURA pedida, e a altura sai da proporção do desenho — o campo
  // "Largura (mm)" do painel é a largura que sai no papel (com a proporção da foto, o 3D de um muro comprido saía
  // com um terço do pedido)
  const w = item.largura ?? 150;
  const k = w / cw;
  return { k, w, h: ch * k };
}

/** O título embaixo do desenho: "CORTE A" sublinhado, a escala ao lado. */
function titular(p: Papel, item: ItemDaFolha, nome: string, x: number, yBase: number): [number, number, number, number] | null {
  const titulo = nome.trim().toUpperCase();
  const escala = item.escala !== null ? `ESC. ${rotuloDaEscala(item.escala)}` : '';
  if (!titulo && !escala) return null;
  const y = yBase + 2 + LETRA.titulo;
  const wt = titulo ? larguraDoTexto(titulo, LETRA.titulo, true) : 0;
  if (titulo) {
    p.texto([x, y], titulo, LETRA.titulo, { negrito: true, camada: 'titulos' });
    p.linha([x, y + 0.9], [x + wt, y + 0.9], p.traco('titulos', MEDIO));
  }
  const xe = titulo ? x + wt + 3 : x;
  if (escala) p.texto([xe, y], escala, LETRA.nota, { camada: 'titulos' });
  const we = escala ? larguraDoTexto(escala, LETRA.nota) : 0;
  return [x, yBase, Math.max(wt, xe - x + we), 2 + LETRA.titulo + 1.5];
}

/**
 * O carimbo (Jose, 14/10 e 15/10): logo à esquerda, e as cinco faixas — empresa; obra; conteúdo + folha; desenho nº +
 * desenhista + verificação; responsável + escala + data.
 */
function carimbar(p: Papel, folha: Folha, ctx: ContextoDaFolha, x: number, y: number, w: number, h: number): void {
  const e = p.traco('carimbo', FINO);
  const prims: Primitiva[] = [];
  const atributos: AtributoDoBloco[] = [];
  const guardar = (q: Primitiva) => prims.push(q);
  // borda e divisões: no SVG agora, nas primitivas dentro do bloco
  p.rect(x, y, w, h, p.traco('carimbo', MEDIO), '#ffffff', false);
  guardar({ k: 'polilinha', pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fechada: true, e: p.traco('carimbo', MEDIO) });
  const L = Math.min(42, w * 0.24);      // a coluna da logo
  const xd = x + L;
  const wd = w - L;
  const fh = h / 5;
  const divisoes: [Pt, Pt][] = [
    [[xd, y], [xd, y + h]],
    [[xd, y + fh], [x + w, y + fh]],
    [[xd, y + 2 * fh], [x + w, y + 2 * fh]],
    [[xd, y + 3 * fh], [x + w, y + 3 * fh]],
    [[xd, y + 4 * fh], [x + w, y + 4 * fh]],
    [[xd + wd * 0.72, y + 2 * fh], [xd + wd * 0.72, y + 3 * fh]],
    [[xd + wd * 0.36, y + 3 * fh], [xd + wd * 0.36, y + 4 * fh]],
    [[xd + wd * 0.68, y + 3 * fh], [xd + wd * 0.68, y + 4 * fh]],
    [[xd + wd * 0.5, y + 4 * fh], [xd + wd * 0.5, y + h]],
    [[xd + wd * 0.72, y + 4 * fh], [xd + wd * 0.72, y + h]],
  ];
  for (const [a, b] of divisoes) {
    p.linha(a, b, e, false);
    guardar({ k: 'linha', a, b, e });
  }
  // uma escala só na folha toda: ela; mais de uma, ou escala e desenho sem escala juntos: "Indicadas" (cada desenho
  // tem a sua embaixo dele)
  const escalas = [...new Set(folha.itens.filter((i) => i.escala !== null).map((i) => i.escala as number))];
  const semEscala = folha.itens.some((i) => i.escala === null);
  const textoEscala = escalas.length === 0 ? 'Sem escala' : escalas.length === 1 && !semEscala ? rotuloDaEscala(escalas[0]) : 'Indicadas';
  // Cada dado é um ATRIBUTO próprio do bloco (obra, endereço e proprietário separados; responsável, CREA e ART
  // separados): o cadista que troca o carimbo pelo dele mapeia campo a campo. Na folha eles saem lado a lado na
  // mesma faixa, com o separador como texto do bloco. O valor vai INTEIRO no atributo (cortado com "…" o
  // proprietário sumia do arquivo); só a letra encolhe para caber.
  type Parte = { etiqueta: string; valor: string; negrito?: boolean };
  const folhaNo = `${String(ctx.numero).padStart(2, '0')}/${String(ctx.total).padStart(2, '0')}`;
  const codigo = ctx.obra.codigo.trim();
  const desenhoNo = codigo ? `${codigo}-${String(ctx.numero).padStart(2, '0')}` : '';
  const celulas: { rotulo: string; partes: Parte[]; sep: string; x0: number; x1: number; faixa: number }[] = [
    { rotulo: 'Empresa', partes: [{ etiqueta: 'EMPRESA', valor: ctx.escritorio.empresa, negrito: true }, { etiqueta: 'CONTATO', valor: ctx.escritorio.contato }], sep: ' — ', x0: xd, x1: x + w, faixa: 0 },
    { rotulo: 'Obra · endereço · proprietário', partes: [{ etiqueta: 'OBRA', valor: ctx.obra.obra }, { etiqueta: 'ENDERECO', valor: ctx.obra.endereco }, { etiqueta: 'PROPRIETARIO', valor: ctx.obra.proprietario }], sep: ' — ', x0: xd, x1: x + w, faixa: 1 },
    { rotulo: 'Conteúdo', partes: [{ etiqueta: 'CONTEUDO', valor: folha.conteudo }], sep: '', x0: xd, x1: xd + wd * 0.72, faixa: 2 },
    { rotulo: 'Folha', partes: [{ etiqueta: 'FOLHA', valor: folhaNo }], sep: '', x0: xd + wd * 0.72, x1: x + w, faixa: 2 },
    { rotulo: 'Desenho nº', partes: [{ etiqueta: 'DESENHO', valor: desenhoNo }], sep: '', x0: xd, x1: xd + wd * 0.36, faixa: 3 },
    { rotulo: 'Desenhista', partes: [{ etiqueta: 'DESENHISTA', valor: ctx.obra.desenhista }], sep: '', x0: xd + wd * 0.36, x1: xd + wd * 0.68, faixa: 3 },
    { rotulo: 'Verificação', partes: [{ etiqueta: 'VERIFICACAO', valor: ctx.obra.verificacao }], sep: '', x0: xd + wd * 0.68, x1: x + w, faixa: 3 },
    {
      rotulo: 'Resp. técnico · CREA · ART',
      partes: [
        { etiqueta: 'RESPONSAVEL', valor: ctx.escritorio.responsavel },
        { etiqueta: 'CREA', valor: ctx.escritorio.crea ? `CREA ${ctx.escritorio.crea}` : '' },
        { etiqueta: 'ART', valor: ctx.obra.art ? `ART ${ctx.obra.art}` : '' },
      ],
      sep: ' · ', x0: xd, x1: xd + wd * 0.5, faixa: 4,
    },
    { rotulo: 'Escala', partes: [{ etiqueta: 'ESCALA', valor: textoEscala }], sep: '', x0: xd + wd * 0.5, x1: xd + wd * 0.72, faixa: 4 },
    { rotulo: 'Data · rev.', partes: [{ etiqueta: 'DATA', valor: ctx.obra.data }, { etiqueta: 'REVISAO', valor: ctx.obra.revisao }], sep: ' · ', x0: xd + wd * 0.72, x1: x + w, faixa: 4 },
  ];
  const aRotulo = Math.min(LETRA.nota, fh * 0.28);
  const aValor = Math.min(LETRA.titulo, fh * 0.42);
  for (const c of celulas) {
    const y0 = y + c.faixa * fh;
    const largura = c.x1 - c.x0 - 2.4;
    const aR = caberAltura((a) => larguraDoTexto(c.rotulo, a), aRotulo, largura);
    const pr = p.texto([c.x0 + 1.2, y0 + 0.6 + aRotulo], c.rotulo, aR, { cor: CINZA, camada: 'carimbo' }, false);
    guardar(pr);
    const cheias = c.partes.filter((q) => q.valor.trim());
    const medir = (a: number) =>
      cheias.reduce((s, q) => s + larguraDoTexto(q.valor, a, q.negrito), 0) + Math.max(0, cheias.length - 1) * larguraDoTexto(c.sep, a);
    const altura = caberAltura(medir, aValor, largura);
    let xc = c.x0 + 1.2;
    const yv = y0 + fh - 1.2;
    c.partes.forEach((q) => {
      const cheia = q.valor.trim() !== '';
      if (cheia && cheias.indexOf(q) > 0 && c.sep) {
        const ps = p.texto([xc, yv], c.sep, altura, { camada: 'carimbo' }, false);
        guardar(ps);
        xc += larguraDoTexto(c.sep, altura);
      }
      // o atributo existe mesmo vazio (o campo fica no bloco para o cadista preencher)
      if (cheia) p.texto([xc, yv], q.valor, altura, { camada: 'carimbo', negrito: q.negrito }, false);
      atributos.push({ etiqueta: q.etiqueta, valor: q.valor, p: [xc, yv], altura, ancora: 'start', cor: TINTA, negrito: q.negrito, camada: 'carimbo' });
      if (cheia) xc += larguraDoTexto(q.valor, altura, q.negrito);
    });
  }
  // ponto base no canto inferior direito (o do carimbo do escritório, que o cadista põe no lugar deste); carimbo de
  // outro tamanho é outro bloco — com o mesmo nome, ao juntar folhas num arquivo o CAD fica com UMA definição de
  // CARIMBO, e a folha do carimbo 200 × 60 sairia com o de 180 × 65
  const padrao = Math.abs(w - CARIMBO_PADRAO.largura) < 0.01 && Math.abs(h - CARIMBO_PADRAO.altura) < 0.01;
  const nome = padrao ? 'CARIMBO' : `CARIMBO_${n(w)}x${n(h)}`;
  p.prims.push({ k: 'bloco', nome, prims, atributos, base: [x + w, y + h] });
  // a logomarca: fora do bloco (imagem dentro de bloco é o que mais quebra entre CADs)
  const logo = ctx.escritorio.logo;
  if (logo) {
    // na proporção do arquivo: o DXF estica a imagem até o retângulo dado (o SVG não estica, por isso o PDF saía
    // certo e o DXF com a logo três vezes mais alta)
    const ml = 2;
    let px: [number, number] | null = null;
    try {
      px = pixelsDaImagem(dataUrlParaBytes(logo));
    } catch {
      px = null;
    }
    const prop = px && px[1] > 0 ? px[0] / px[1] : 1;
    let lw = Math.min(L - 2 * ml, ctx.escritorio.logoLargura || L - 2 * ml);
    let lh = lw / prop;
    if (lh > h - 2 * ml) {
      lh = h - 2 * ml;
      lw = lh * prop;
    }
    p.imagem(x + (L - lw) / 2, y + (h - lh) / 2, lw, lh, logo, 'logo.png', 'carimbo');
  }
}

/** O quadro lateral: notas gerais numeradas, legenda das cores e o quadro de aço — o que couber na altura dada. */
function preencherQuadro(p: Papel, folha: Folha, ctx: ContextoDaFolha, x: number, y: number, w: number, h: number): boolean {
  const e = p.traco('quadro', FINO);
  p.rect(x, y, w, h, p.traco('quadro', MEDIO));
  const m = 3;
  const xi = x + m;
  const wi = w - 2 * m;
  let yc = y + m;
  const fim = y + h - m;
  let estourou = false;
  const cabe = (alt: number) => {
    if (yc + alt > fim) {
      estourou = true;
      return false;
    }
    return true;
  };
  const tituloDaSecao = (t: string) => {
    if (!cabe(LETRA.titulo + 2)) return;
    yc += LETRA.titulo;
    p.texto([xi, yc], t, LETRA.titulo, { negrito: true, camada: 'quadro' });
    yc += 2.5;
  };

  const notas = folha.quadro.notas ?? ctx.notasAutomaticas;
  if (notas.length) {
    tituloDaSecao('NOTAS GERAIS');
    notas.forEach((nota, k) => {
      const prefixo = `${k + 1}. `;
      const recuo = larguraDoTexto('00. ', LETRA.nota);
      const linhas = quebrar(nota, LETRA.nota, wi - recuo);
      linhas.forEach((l, j) => {
        if (!cabe(LETRA.nota + 1.2)) return;
        yc += LETRA.nota;
        if (j === 0) p.texto([xi, yc], prefixo, LETRA.nota, { camada: 'quadro' });
        p.texto([xi + recuo, yc], l, LETRA.nota, { camada: 'quadro' });
        yc += 1.2;
      });
      yc += 0.8;
    });
    yc += 2;
  }

  if (folha.quadro.legenda && ctx.legenda.length) {
    tituloDaSecao('LEGENDA');
    for (const it of ctx.legenda) {
      if (!cabe(5)) break;
      p.rect(xi, yc, 8, 4, p.traco('quadro', FINO), it.cor);
      p.texto([xi + 11, yc + 3.2], it.rotulo, LETRA.nota, { camada: 'quadro' });
      yc += 5.5;
    }
    yc += 2;
  }

  const lin = LETRA.nota + 2.2;
  const temResumo = folha.quadro.quadroDeAco && ctx.aco.linhas.length > 0;
  const alturaDoResumo = temResumo ? LETRA.titulo + 2.5 + lin * (ctx.aco.linhas.length + 2) : 0;

  if (folha.quadro.listaDeFerros !== false && ctx.ferros?.length) {
    // N, Ø, quantidade, comprimento unitário, comprimento total e o desenho da barra cotado
    const colunas = [0, 0.09, 0.19, 0.31, 0.46, 0.6];
    const alto = 14;          // linha com barra dobrada: o desenho e as cotas dos trechos
    const alturaDe = (f: LinhaDeFerroDaFolha) => (f.forma.trechos.length > 1 ? alto : lin);
    const alturaDaLista = LETRA.titulo + 2.5 + lin + ctx.ferros.reduce((s, f) => s + alturaDe(f), 0) + 4;
    // Inteira ou nada: a lista cortada no papel parece completa (o armador não sabe que faltam posições), e empurrava
    // o resumo para fora do quadro. Sem lugar para as duas, fica o resumo e a tela acende a borda do quadro.
    if (yc + alturaDaLista + alturaDoResumo > fim) estourou = true;
    else {
      tituloDaSecao('LISTA DE FERROS');
      const y0 = yc;
      const xs = colunas.map((c) => xi + c * wi);
      const larg = [...xs.slice(1), xi + wi].map((x, j) => x - xs[j] - 2);
      const celula = (cel: string[], h: number, negrito: boolean) =>
        cel.forEach((c, j) => {
          // a letra encolhe só se a coluna não comporta (quadro estreitado na tela)
          const a = caberAltura((x) => larguraDoTexto(c, x, negrito), LETRA.nota, larg[j]);
          p.texto([xs[j] + 1, yc + h / 2 + (a * MAIUSCULA_DA_ARIAL) / 2], c, a, { negrito, camada: 'quadro' });
        });
      celula(['N', 'Ø', 'Quant.', 'C. unit. (cm)', 'C. total (m)', 'Forma'], lin, true);
      yc += lin;
      p.linha([xi, yc], [xi + wi, yc], e);
      const larguraDaForma = xi + wi - xs[5] - 18;
      for (const f of ctx.ferros) {
        const h = alturaDe(f);
        const bit = String(Math.round(f.diametro * 10) / 10).replace('.', ',');
        celula([f.posicao, bit, String(f.quantidade), String(f.comprimentoUnit), f.comprimentoTotal.toFixed(2).replace('.', ',')], h, false);
        if (larguraDaForma >= 15) desenharForma(p, f.forma, xs[5] + 9, yc + (h > lin ? 4.2 : h / 2), larguraDaForma, h > lin ? 5.6 : 0);
        yc += h;
        p.linha([xi, yc], [xi + wi, yc], e);
      }
      p.linha([xi, y0], [xi + wi, y0], e);
      for (const x of [...xs, xi + wi]) p.linha([x, y0], [x, yc], e);
      yc += 4;
    }
  }

  if (temResumo) {
    tituloDaSecao('RESUMO DO AÇO');
    const colunas = [0, 0.27, 0.48, 0.69];
    const kg = (x: number) => x.toFixed(1).replace('.', ',');
    const cab = ['Bitola', 'Compr. (m)', 'Massa (kg)', 'Massa + 10 % (kg)'];
    // os totais são a soma das linhas já arredondadas, nas duas colunas de massa (quadro.ts)
    const perdas = ctx.aco.linhas.map((l) => comPerda(l.massa));
    const totalComPerda = Math.round(perdas.reduce((s, x) => s + x, 0) * 10) / 10;
    const corpo = [
      ...ctx.aco.linhas.map((l, i) => [l.bitola, l.comprimento.toFixed(1).replace('.', ','), kg(l.massa), kg(perdas[i])]),
      ['Total', '', kg(ctx.aco.total), kg(totalComPerda)],
    ];
    const linhasTab = [cab, ...corpo];
    if (cabe(lin * linhasTab.length)) {
      const y0 = yc;
      linhasTab.forEach((cel, i) => {
        cel.forEach((c, j) => p.texto([xi + 1 + colunas[j] * wi, yc + LETRA.nota + 0.9], c, LETRA.nota, { negrito: i === 0 || i === linhasTab.length - 1, camada: 'quadro' }));
        yc += lin;
        p.linha([xi, yc], [xi + wi, yc], e);
      });
      p.linha([xi, y0], [xi + wi, y0], e);
      for (const c of [0, ...colunas.slice(1), 1]) p.linha([xi + c * wi, y0], [xi + c * wi, yc], e);
    }
  }
  return estourou;
}

/**
 * A tarja do muro que não passa (Jose, 15/10): "NÃO VERIFICADO" em vermelho, atravessado na diagonal da área de
 * desenho (sem o quadro lateral), só o contorno da letra no PDF. Não trava a saída — a prancha serve de estudo —, mas
 * não deixa o papel ir para a obra parecendo um projeto que fechou: aviso só na tela não sai junto com a folha. No DXF
 * vai em camada própria (AVISO), texto normal: o CAD não tem letra vazada.
 */
const TEXTO_DA_TARJA = 'NÃO VERIFICADO';
const COR_DA_TARJA = '#c00000';

function tarjar(p: Papel, x0: number, y0: number, x1: number, y1: number): void {
  const [w, h] = [x1 - x0, y1 - y0];
  if (!(w > 0 && h > 0)) return;
  const a = Math.atan2(h, w);
  // a palavra ocupa 70 % da diagonal; o corpo sai da largura (negrito)
  const corpo = (0.7 * Math.hypot(w, h)) / Prancha.largura(TEXTO_DA_TARJA, 1, true);
  // linha de base abaixo do centro meia maiúscula, na perpendicular do texto: a palavra fica centrada na área
  const meio = (corpo * MAIUSCULA_DA_ARIAL) / 2;
  const base: Pt = [x0 + w / 2 + meio * Math.sin(a), y0 + h / 2 + meio * Math.cos(a)];
  p.texto(base, TEXTO_DA_TARJA, corpo, {
    ancora: 'middle', cor: COR_DA_TARJA, negrito: true, camada: 'aviso', angulo: (a * 180) / Math.PI, contorno: Math.max(0.5, corpo / 90),
  });
}

/**
 * A barra da lista de ferros num retângulo w × h (mm) com canto em (x, y): fora de escala, cada direção esticada
 * para caber (o gancho de 20 cm de uma barra de 260 tem de aparecer) — a medida de cada trecho vai escrita nele,
 * que é o que o armador lê. Reta: só o traço (o comprimento está na coluna ao lado). Estribo: duas medidas, uma
 * de cada lado diferente.
 */
function desenharForma(p: Papel, f: FormaDaBarra, x: number, y: number, w: number, h: number): void {
  const traco = p.traco('quadro', 0.35);
  if (f.trechos.length <= 1) {
    p.linha([x, y], [x + w, y], traco);
    return;
  }
  const us = f.pontos.map((q) => q[0]), vs = f.pontos.map((q) => q[1]);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const sx = u1 - u0 > 1e-6 ? w / (u1 - u0) : 0;
  const sy = v1 - v0 > 1e-6 ? h / (v1 - v0) : 0;
  // v para cima no desenho da barra; no papel y desce
  const P = (q: [number, number]): Pt => [x + (q[0] - u0) * sx + (sx ? 0 : w / 2), y + h - (q[1] - v0) * sy - (sy ? 0 : h / 2)];
  const pts = f.pontos.map(P);
  const fechar = f.fechada ? [pts[0]] : [];
  const linha = [...pts, ...fechar];
  for (let i = 1; i < linha.length; i++) p.linha(linha[i - 1], linha[i], traco);
  const meio = [x + w / 2, y + h / 2];
  const cap = LETRA.nota * MAIUSCULA_DA_ARIAL;
  const ditas = new Set<string>();
  f.trechos.forEach((t, i) => {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    const deitado = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    // estribo: cada medida uma vez (os lados opostos são iguais)
    const chave = `${deitado ? 'h' : 'v'}${t}`;
    if (f.fechada && ditas.has(chave)) return;
    ditas.add(chave);
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (deitado) {
      const acima = my <= meio[1];
      p.texto([mx, acima ? my - 0.9 : my + cap + 0.9], String(t), LETRA.nota, { ancora: 'middle', camada: 'quadro' });
    } else {
      const esquerda = mx <= meio[0];
      p.texto([esquerda ? mx - 1.2 : mx + 1.2, my + cap / 2], String(t), LETRA.nota, { ancora: esquerda ? 'end' : 'start', camada: 'quadro' });
    }
  });
}

/** Compõe a folha inteira. */
export function comporFolha(folha: Folha, ctx: ContextoDaFolha): FolhaComposta {
  const [W, H] = tamanhoDaFolha(folha.formato, folha.orientacao);
  const [x0, y0, x1, y1] = quadroUtil(folha.formato, folha.orientacao);
  const [x1Moldura, y1Moldura] = [x1, y1];
  const p = new Papel();
  const defs: string[] = [];
  const itens: ItemPosto[] = [];

  // o papel e a moldura
  p.svg.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  // a borda do papel tem camada própria: no DXF a espessura é a da camada, e ela é fina e a moldura, grossa
  p.rect(0, 0, W, H, p.traco('folha', FINO, '#a6a6a6'));
  p.rect(x0, y0, x1 - x0, y1 - y0, p.traco('moldura', GROSSO));

  // a legenda das cores vai no quadro lateral; com o quadro fechado (A3/A4 de partida) ou sem a legenda, volta
  // para dentro de cada vista — a frontal e a planta pintadas com as cores do Jose não podem sair sem legenda
  const quadroAberto = folha.quadro.altura > 1 && folha.quadro.largura > 1;
  const legendaDeCores = !(quadroAberto && folha.quadro.legenda);

  // os desenhos
  folha.itens.forEach((item, k) => {
    const prefixo = `${ctx.prefixo ?? 'p'}${ctx.numero}i${k}`;
    const d = ctx.desenhar(item, prefixo, { legendaDeCores, vetorial: ctx.saida === true });
    if (!d) {
      // ainda sem desenho (a foto do 3D vem depois): o lugar fica marcado só na tela, não no arquivo
      const w = item.largura ?? 120;
      const h = item.altura ?? 80;
      if (ctx.saida) return;
      p.svg.push(`<rect x="${n(item.x)}" y="${n(item.y)}" width="${n(w)}" height="${n(h)}" fill="#f2f2f2" stroke="#bfbfbf" stroke-width="0.3" stroke-dasharray="2,1.5"/>`);
      itens.push({ id: item.id, caixa: [item.x, item.y, w, h], titulo: null, pendente: true, invade: false });
      return;
    }
    const { k: escala, w, h } = encaixe(item, d);
    if (d.tipo === 'imagem') {
      p.imagem(item.x, item.y, w, h, d.dataUrl, d.arquivo, 'imagens');
    } else {
      const [cx, cy] = d.vista.caixa;
      const dx = item.x - cx * escala;
      const dy = item.y - cy * escala;
      defs.push(d.vista.defs);
      p.svg.push(`<g transform="matrix(${n(escala)} 0 0 ${n(escala)} ${n(dx)} ${n(dy)})">${d.vista.corpo}</g>`);
      p.prims.push(...transformarPrimitivas(d.vista.primitivas, escala, dx, dy));
    }
    const t = titular(p, item, item.titulo.trim() || (ctx.tituloAutomatico?.(item) ?? ''), item.x, item.y + h);
    itens.push({ id: item.id, caixa: [item.x, item.y, w, h], titulo: t, pendente: false, invade: false });
  });

  // quadro lateral e carimbo, no canto inferior direito
  const cw = folha.carimbo.largura || CARIMBO_PADRAO.largura;
  const ch = folha.carimbo.altura || CARIMBO_PADRAO.altura;

  // A tarja vai por cima dos desenhos e embaixo do quadro e do carimbo (o carimbo continua legível). Com o carimbo
  // tomando mais da metade da largura (A4 em pé), ela fica na faixa de cima: centrada na área toda, o "NÃO" caía
  // embaixo do carimbo e a folha dizia "…O VERIFICADO".
  if (ctx.naoVerificado) {
    const xd = quadroAberto ? x1 - folha.quadro.largura : x1;
    tarjar(p, x0, y0, xd, cw > (xd - x0) / 2 ? y1 - ch : y1);
  }
  const cx = x1 - cw;
  const cy = y1 - ch;
  let quadro: [number, number, number, number] | null = null;
  let quadroEstourou = false;
  if (folha.quadro.altura > 1 && folha.quadro.largura > 1) {
    const qh = Math.min(folha.quadro.altura, cy - y0);
    const qx = x1 - folha.quadro.largura;
    quadro = [qx, cy - qh, folha.quadro.largura, qh];
    quadroEstourou = preencherQuadro(p, folha, ctx, qx, cy - qh, folha.quadro.largura, qh);
  }
  carimbar(p, folha, ctx, cx, cy, cw, ch);

  // quem invade: passa da moldura, ou cai sobre o carimbo ou o quadro lateral (o desenho com o título)
  const cruza = (a: number[], b: number[]) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
  for (const it of itens) {
    const [ix, iy, iw, ih] = it.caixa;
    const t = it.titulo;
    const x1 = Math.max(ix + iw, t ? t[0] + t[2] : -Infinity);
    const y1 = Math.max(iy + ih, t ? t[1] + t[3] : -Infinity);
    const todo = [ix, iy, x1 - ix, y1 - iy];
    const fora = ix < x0 || iy < y0 || x1 > x1Moldura || y1 > y1Moldura;
    it.invade = fora || cruza(todo, [cx, cy, cw, ch]) || (!!quadro && cruza(todo, quadro));
  }
  // um desenho sobre o outro também acende (a letra de 15/10 engordou as vistas montadas antes: lado a lado ontem,
  // encavaladas hoje sem aviso)
  const inteiro = (it: ItemPosto): number[] => {
    const [ix, iy, iw, ih] = it.caixa;
    const t = it.titulo;
    const xa = Math.max(ix + iw, t ? t[0] + t[2] : -Infinity);
    const ya = Math.max(iy + ih, t ? t[1] + t[3] : -Infinity);
    return [ix, iy, xa - ix, ya - iy];
  };
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      if (itens[i].pendente || itens[j].pendente || !cruza(inteiro(itens[i]), inteiro(itens[j]))) continue;
      itens[i].invade = itens[j].invade = true;
    }
  }
  // sem o quadro, a nota que vale para todo desenho da folha fica escrita logo acima do carimbo
  if (!quadroAberto || folha.quadro.notas?.length === 0) {
    p.texto([cx, cy - 2], 'Cotas em centímetros, exceto onde indicado.', LETRA.nota, { camada: 'textos' });
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">` +
    `<defs>${defs.join('')}</defs>${p.svg.join('')}</svg>`;
  return { largura: W, altura: H, svg, primitivas: p.prims, itens, carimbo: [cx, cy, cw, ch], quadro, quadroEstourou };
}
