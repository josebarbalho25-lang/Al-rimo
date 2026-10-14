/*
  DXF DA PRANCHA — uma folha por arquivo, tudo em MILÍMETROS DE PAPEL (a folha inteira 1:1, cada desenho já reduzido:
  "como plotado", decisão do José, 14/10). Lê só as primitivas da folha composta (pranchas/tipos.ts), nunca o SVG.

  Quem escreve o arquivo é a biblioteca @tarikjabiri/dxf (2.9.0, MIT; José, 14/10: "use uma biblioteca pronta" — o app
  só GERA DXF, nunca lê). Este arquivo é a camada fina por cima: converte cada primitiva e tapa os buracos que a
  biblioteca tem, cada um com o porquê ao lado. Os buracos, medidos com o ezdxf (tools/validar_dxf.py):
    · o IMAGEDEF_REACTOR sai sem dono (o ezdxf APAGA o reator) e cada imagem cria outra chave ACAD_IMAGE_DICT na
      raiz → a imagem é montada aqui com as peças da própria biblioteca, um dicionário só para todas;
    · CLASSES sai vazia → o IMAGE precisa da classe declarada (o AutoCAD carrega o módulo de imagem por ela);
    · o addAttrib põe um SEQEND depois de CADA atributo e deixa o atributo sem dono → o carimbo (INSERT + ATTRIB)
      é montado aqui: atributos pertencem ao INSERT e um SEQEND só no fim;
    · a tabela de padrões de hachura está embaralhada (o "EARTH" dela é o DOTS) e com nome errado (AR_CONC) → os
      padrões vêm de padroesDxf.ts (os do ezdxf, ISO);
    · a hachura sai com estilo "externo" fixo → aqui vai o estilo normal (par-ímpar), o que a primitiva pede;
    · não há espessura de linha (grupo 370) → acrescentada em cada entidade;
    · a imagem sai com pixel quadrado → o vetor V vem da altura real no papel.
  Os consertos que mexem no que a biblioteca grava passam por `corrigir` (um filtro nos pares código/valor de UMA
  entidade) — nada é remendado no texto final.

  Versão: AC1018 (DXF 2004), codificação ANSI_1252, e o texto 100 % ASCII — caractere fora do ASCII sai como
  \U+XXXX ("Ø" → \U+00D8), que é como o próprio AutoCAD grava DXF até 2004 e que todo CAD lê (o LibreCAD só decodifica
  o \U+ em arquivo anterior ao 2007; num 2007 ele mostraria o código cru).

  Eixo Y: a primitiva vem com y para BAIXO (como o SVG, origem no canto superior esquerdo da folha); no DXF y sobe:
  y_dxf = altura − y. Ângulo de texto já vem anti-horário (cota vertical = 90): passa direto.
*/

import {
  Attdef, Attrib, BlockFlags, DxfRasterVariables, DxfWriter, HatchBoundaryPaths, HatchPattern, HatchPolylineBoundary,
  Image, Insert, LWPolylineFlags, SeqEnd, Text, TextHorizontalAlignment, Units, aciHex, pattern, point2d, point3d,
  vertex,
  type CommonEntityOptions, type DxfDictionary, type DxfImageDef, type Dxfier, type EntitiesManager, type HatchPredefinedPatterns,
  type vec3_t,
} from '@tarikjabiri/dxf';
import { HACHURA } from '@/desenhos/hachuras';
import { PADRAO_DO_MATERIAL, linhasNaEscala, type PadraoNoDxf } from './padroesDxf';
import type { AtributoDoBloco, PadraoHachura, Primitiva, Pt, Traco } from './tipos';
import { dataUrlParaBytes, zipar } from './zip';

export interface FolhaDxf {
  nome: string;
  largura: number;   // mm
  altura: number;    // mm
  prims: Primitiva[];
}

/** Imagem que o DXF vincula: `arquivo` é o caminho relativo ao .dxf ("imagens/foto.png"), como vai no zip. */
export interface ImagemDoDxf {
  arquivo: string;
  dataUrl: string;
}

export const PASTA_DAS_IMAGENS = 'imagens';
export const ESTILO_DE_TEXTO = 'ALRIMO';
const ESTILO_NEGRITO = 'ALRIMO_NEGRITO';

/**
 * No CAD a altura do TEXT com fonte TrueType é a da LETRA MAIÚSCULA; no SVG (e no PDF) a altura do texto é o corpo
 * da fonte (o "em"). Na Arial a maiúscula tem 1467/2048 = 0,716 do corpo: sem esta conta a letra sairia 40 % maior no
 * DXF do que no PDF da mesma prancha.
 */
export const MAIUSCULA_DA_ARIAL = 1467 / 2048;

/** Espessuras de linha que o CAD aceita (grupo 370, centésimos de mm). */
const ESPESSURAS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];

export function espessuraDoCad(mm: number): number {
  const c = mm * 100;
  return ESPESSURAS.reduce((m, v) => (Math.abs(v - c) < Math.abs(m - c) ? v : m), 0);
}

// ── cor ─────────────────────────────────────────────────────────────────────

/** A paleta do CAD (índice → RGB), a da biblioteca, com o 8 e o 9 do AutoCAD (lá vêm um tom mais escuros). */
const PALETA: [number, number, number, number][] = (() => {
  const p: [number, number, number, number][] = [];
  for (let i = 1; i <= 255; i++) {
    if (i === 7) continue;   // 7 = "preto no papel, branco na tela": não é uma cor, fica para a tinta preta
    const h = i === 8 ? '808080' : i === 9 ? 'C0C0C0' : aciHex(i);
    p.push([i, parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  }
  return p;
})();

export interface CorDoCad {
  aci: number;
  verdadeira?: number;   // 0xRRGGBB (grupo 420)
}

/**
 * Cor da primitiva → índice do CAD (62) + cor verdadeira (420). Preto (ou quase) vira o 7 SEM cor verdadeira: preto
 * de verdade some no fundo preto do CAD (o TQS e muito AutoCAD trabalham assim); o 7 é branco na tela e preto no papel.
 */
export function corDoCad(cor: string | undefined): CorDoCad {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((cor ?? '').trim());
  if (!m) return { aci: 7 };
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (Math.max(r, g, b) < 0x30) return { aci: 7 };
  let aci = 7, d = Infinity;
  for (const [i, pr, pg, pb] of PALETA) {
    const di = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (di < d) [aci, d] = [i, di];
  }
  return { aci, verdadeira: (r << 16) | (g << 8) | b };
}

// ── texto e nomes em ASCII ──────────────────────────────────────────────────

/** Texto do desenho em ASCII: fora do ASCII vira \U+XXXX ("ção" → "\U+00E7\U+00E3o"). Quebra de linha vira espaço. */
export function textoAscii(s: string): string {
  let out = '';
  for (const ch of s.replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c < 127) out += ch;
    else if (c <= 0xffff) out += '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    else out += '?';   // fora do plano básico o \U+ do CAD não alcança (4 dígitos)
  }
  return out;
}

/** Nome de tabela do CAD (camada, bloco, etiqueta): sem acento, maiúsculo, só letra, número, - e _. */
export function nomeDoCad(s: string): string {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
  return n.replace(/^_+|_+$/g, '') || 'SEM_NOME';
}

/** Nome de arquivo em ASCII (o caminho da imagem vai dentro do DXF, que é ANSI). */
export function nomeDeArquivo(s: string): string {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  return n.replace(/^[_.]+|_+$/g, '') || 'arquivo';
}

// ── imagem: tamanho em pixels lido do próprio arquivo ───────────────────────

/** Largura × altura em pixels de um PNG (cabeçalho IHDR) ou JPEG (marcador SOF). null = formato que não sei ler. */
export function pixelsDaImagem(b: Uint8Array): [number, number] | null {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return [v.getUint32(16), v.getUint32(20)];   // assinatura (8) + tamanho (4) + "IHDR" (4) → largura, altura
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }                                   // byte de enchimento
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; }   // marcadores sem tamanho
      // SOF0…SOF15 dão o tamanho; C4 (Huffman), C8 (reservado) e CC (aritmética) usam a mesma faixa e não são SOF
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

// ── consertos por entidade ──────────────────────────────────────────────────

type Grupo = [number, number | string];
type Filtro = (codigo: number, valor: number | string) => Grupo[];

/**
 * Passa cada par (código, valor) que a biblioteca grava para ESTA entidade pelo filtro — é por aqui que entram a
 * espessura de linha, o estilo par-ímpar da hachura e o que é de versão posterior à 2004. Vale só durante a gravação
 * da entidade; o gravador volta ao normal logo depois.
 */
function corrigir<T extends { dxfy(dx: Dxfier): void }>(ent: T, filtro: Filtro): T {
  const original = ent.dxfy.bind(ent);
  ent.dxfy = (dx: Dxfier) => {
    const push = dx.push;
    dx.push = (codigo: number, valor?: string | number) => {
      if (valor == null) return;
      for (const [c, v] of filtro(codigo, valor)) push.call(dx, c, v);
    };
    try {
      original(dx);
    } finally {
      dx.push = push;
    }
  };
  return ent;
}

/**
 * Objeto com reatores: o DXF pede o grupo {ACAD_REACTORS} ANTES do dono (330); a biblioteca grava o dono primeiro.
 * O ezdxf aceita as duas ordens, o AutoCAD lê na ordem da norma — o dono fica guardado até o fim do grupo.
 */
function reatoresAntesDoDono(): Filtro {
  let dono: Grupo | null = null;
  let jaViuDono = false;
  return (c, v) => {
    if (c === 0) [dono, jaViuDono] = [null, false];               // começo do objeto (a cada gravação)
    if (c === 330 && !jaViuDono) {
      jaViuDono = true;
      dono = [c, v];
      return [];
    }
    if (c === 102 && v === '}' && dono) {
      const d = dono;
      dono = null;
      return [[c, v], d];
    }
    return [[c, v]];
  };
}

/** Espessura de linha (370) logo depois da camada (8), no bloco comum de toda entidade. */
const comEspessura = (lw: number): Filtro => (c, v) => (c === 8 ? [[8, v], [370, lw]] : [[c, v]]);

/** Arredonda a coordenada (6 casas = milésimo de mícron no papel): sem "0,30000000000000004" nem notação 1e-7. */
const r = (v: number): number => Math.round(v * 1e6) / 1e6 + 0;

// ── o gravador ──────────────────────────────────────────────────────────────

class Gravador {
  private readonly w = new DxfWriter();   // primeiro de tudo: o construtor zera o contador de handles
  private readonly H: number;
  private readonly usoDeCor = new Map<string, Map<string, number>>();   // camada → cor → quantas entidades
  private readonly tiposDeLinha = new Map<string, string>();            // traço/espaço → nome do LTYPE
  private readonly blocos = new Set<string>();
  private readonly imagens = new Map<string, { dataUrl: string; def: DxfImageDef }>();
  private dicionarioDeImagens: DxfDictionary | null = null;

  constructor(private readonly folha: FolhaDxf) {
    this.H = folha.altura;
  }

  gravar(): { dxf: string; imagens: ImagemDoDxf[] } {
    const { w, folha } = this;
    w.setVariable('$ACADVER', { 1: 'AC1018' });
    w.setVariable('$DWGCODEPAGE', { 3: 'ANSI_1252' });
    w.setVariable('$LASTSAVEDBY', { 1: 'Al-rimo' });
    w.setUnits(Units.Millimeters);                       // $INSUNITS = 4
    w.setVariable('$MEASUREMENT', { 70: 1 });            // métrico: o CAD procura os padrões no acadiso.pat
    w.setVariable('$EXTMIN', { 10: 0, 20: 0, 30: 0 });
    w.setVariable('$EXTMAX', { 10: r(folha.largura), 20: r(folha.altura), 30: 0 });
    w.setVariable('$LIMMIN', { 10: 0, 20: 0 });
    w.setVariable('$LIMMAX', { 10: r(folha.largura), 20: r(folha.altura) });
    w.setVariable('$LWDISPLAY', { 290: 1 });             // abre mostrando a espessura de linha, como no papel
    w.setVariable('$TEXTSTYLE', { 7: ESTILO_DE_TEXTO });

    const estilo = w.tables.addStyle(ESTILO_DE_TEXTO);
    estilo.fontFileName = 'arial.ttf';
    const negrito = w.tables.addStyle(ESTILO_NEGRITO);
    negrito.fontFileName = 'arialbd.ttf';

    // a vista inicial do CAD enquadra a folha (a da biblioteca enquadra caixas de ±100 em volta de cada texto)
    const ms = w.modelSpace;
    ms.centerView = () => point3d(r(folha.largura / 2), r(folha.altura / 2), 0);
    ms.viewHeight = () => r(folha.altura * 1.05);

    this.desenhar(folha.prims, ms);
    this.criarCamadas();
    this.declararClasses();

    const imagens = [...this.imagens.entries()].map(([arquivo, { dataUrl }]) => ({ arquivo, dataUrl }));
    return { dxf: w.stringify() + '\n', imagens };
  }

  // ── primitivas ──

  private P = ([x, y]: Pt): vec3_t => point3d(r(x), r(this.H - y), 0);

  private opcoes(camada: string, cor: string | undefined, tracejado?: number[]): CommonEntityOptions {
    const nome = nomeDoCad(camada);
    const c = corDoCad(cor);
    const chave = c.verdadeira === undefined ? 'preto' : `#${c.verdadeira.toString(16).padStart(6, '0')}`;
    const uso = this.usoDeCor.get(nome) ?? new Map<string, number>();
    uso.set(chave, (uso.get(chave) ?? 0) + 1);
    this.usoDeCor.set(nome, uso);
    return {
      layerName: nome,
      colorNumber: c.aci,
      trueColor: c.verdadeira === undefined ? undefined : String(c.verdadeira),
      lineType: tracejado?.length ? this.tipoDeLinha(tracejado) : undefined,
    };
  }

  /** Um LTYPE por padrão traço/espaço (mm de papel). Lista ímpar repete, como no SVG (2 1 3 → 2 1 3 2 1 3). */
  private tipoDeLinha(t: number[]): string | undefined {
    const v = (t.length % 2 ? [...t, ...t] : t).map((x) => Math.max(0, Math.round(x * 100) / 100));
    if (v.every((x) => x === 0)) return undefined;   // tracejado sem comprimento: contínuo
    const chave = v.join(' ');
    let nome = this.tiposDeLinha.get(chave);
    if (!nome) {
      const fmt = (x: number) => String(x).replace('.', 'p');
      nome = `TRACEJADO_${v.map(fmt).join('_')}`;
      // elemento ímpar = espaço (negativo no LTYPE); traço de comprimento zero = ponto
      this.w.addLType(nome, `Tracejado ${v.join('/')} mm`, v.map((x, i) => (i % 2 ? -x : x)));
      this.tiposDeLinha.set(chave, nome);
    }
    return nome;
  }

  private desenhar(prims: Primitiva[], alvo: EntitiesManager): void {
    for (const q of prims) {
      switch (q.k) {
        case 'linha':
          corrigir(alvo.addLine(this.P(q.a), this.P(q.b), this.opcoesDoTraco(q.e)), comEspessura(espessuraDoCad(q.e.espessura)));
          break;
        case 'polilinha':
          this.polilinha(alvo, q.pts, q.fechada, q.e);
          break;
        case 'circulo':
          if (q.cheio) {
            // disco cheio: HATCH sólido por baixo, contorno de dois arcos de 180° (bulge 1) — o círculo exato
            const [cx, cy] = q.c;
            this.preencher(alvo, [[[cx + q.r, cy], [cx - q.r, cy]]], PADRAO_DO_MATERIAL.solido, q.cheio, q.e?.camada ?? '0', [1, 1]);
          }
          if (q.e) corrigir(alvo.addCircle(this.P(q.c), r(q.r), this.opcoesDoTraco(q.e)), comEspessura(espessuraDoCad(q.e.espessura)));
          break;
        case 'hachura':
          this.hachura(alvo, q);
          break;
        case 'texto':
          this.texto(alvo, q);
          break;
        case 'imagem':
          this.imagem(alvo, q);
          break;
        case 'bloco':
          this.bloco(alvo, q.nome, q.prims, q.atributos);
          break;
      }
    }
  }

  private opcoesDoTraco(e: Traco): CommonEntityOptions {
    return this.opcoes(e.camada, e.cor, e.tracejado);
  }

  private polilinha(alvo: EntitiesManager, pts: Pt[], fechada: boolean, e: Traco): void {
    const v = fechada ? semFechoRepetido(pts) : pts;
    if (v.length < 2) return;
    const pl = alvo.addLWPolyline(v.map((p) => ({ point: point2d(r(p[0]), r(this.H - p[1])) })), {
      ...this.opcoesDoTraco(e),
      flags: fechada ? LWPolylineFlags.Closed : LWPolylineFlags.None,
    });
    corrigir(pl, comEspessura(espessuraDoCad(e.espessura)));
  }

  private hachura(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'hachura' }>): void {
    const padrao = PADRAO_DO_MATERIAL[q.padrao];
    if (q.padrao === 'solido') {
      this.preencher(alvo, q.aneis, padrao, q.fundo ?? q.risco ?? '#000000', q.camada);
    } else {
      // o fundo vem antes (por baixo), o padrão por cima na cor do risco: a terra é risco marrom sobre bege
      if (q.fundo) this.preencher(alvo, q.aneis, PADRAO_DO_MATERIAL.solido, q.fundo, q.camada);
      this.preencher(alvo, q.aneis, padrao, q.risco ?? riscoPadrao(q.padrao), q.camada);
    }
    if (q.borda) for (const anel of q.aneis) this.polilinha(alvo, anel, true, q.borda);
  }

  /**
   * Um HATCH não associativo com os anéis como caminhos de polilinha, estilo normal (par-ímpar): o furo do bloco
   * vazado fica vazio de verdade. `bulges` (opcional) = curvatura de cada vértice do 1º anel (o disco cheio).
   */
  private preencher(alvo: EntitiesManager, aneis: Pt[][], padrao: PadraoNoDxf, cor: string, camada: string, bulges?: number[]): void {
    const caminhos = new HatchBoundaryPaths();
    for (const anel of aneis) {
      const v = bulges ? anel : semFechoRepetido(anel);
      if (v.length < (bulges ? 2 : 3)) continue;
      caminhos.addPolylineBoundary(new HatchPolylineBoundary(v.map((p, i) => vertex(r(p[0]), r(this.H - p[1]), bulges?.[i]))));
    }
    if (caminhos.length === 0) return;
    const h = alvo.addHatch(caminhos, pattern({ name: padrao.nome as HatchPredefinedPatterns }), this.opcoes(camada, cor));
    if (padrao.nome !== 'SOLID') {
      const nome = padrao.nome;
      // as linhas de definição saem de padroesDxf.ts (a tabela da biblioteca está trocada); 41 = a escala que o
      // editor de hachura do CAD mostra, as linhas já vão escaladas
      (h as unknown as { pattern: (dx: Dxfier) => void }).pattern = (dx: Dxfier) => {
        dx.push(52, 0);
        dx.push(41, r(padrao.escala));
        dx.push(77, 0);
        const hp = new HatchPattern(nome);
        for (const [a, [bx, by], [ox, oy], t] of linhasNaEscala(nome, padrao.escala)) {
          hp.add({ lineAngle: a, x: r(bx), y: r(by), offsetX: r(ox), offsetY: r(oy), dashLengthItems: t.map(r) });
        }
        hp.dxfy(dx);
      };
    }
    const lw = espessuraDoCad(padrao.espessura);
    // 75 = estilo da hachura: 0 = normal (par-ímpar, a regra da primitiva); a biblioteca grava 1 ("só o externo")
    corrigir(h, (c, v) => (c === 75 ? [[75, 0]] : comEspessura(lw)(c, v)));
  }

  private alinhamento(ancora: 'start' | 'middle' | 'end', p: vec3_t): { horizontalAlignment?: TextHorizontalAlignment; secondAlignmentPoint?: vec3_t } {
    if (ancora === 'start') return {};
    // centro/direita: o CAD alinha pelo 2º ponto (11/21); o 1º (10/20) ele recalcula ao abrir
    return { horizontalAlignment: ancora === 'middle' ? TextHorizontalAlignment.Center : TextHorizontalAlignment.Right, secondAlignmentPoint: p };
  }

  private texto(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'texto' }>): void {
    const p = this.P(q.p);
    const t = new Text(p, r(q.altura * MAIUSCULA_DA_ARIAL), textoAscii(q.t), {
      ...this.opcoes(q.camada, q.cor),
      ...this.alinhamento(q.ancora, p),
      rotation: q.angulo ? r(q.angulo) : undefined,
    });
    t.textStyle = q.negrito ? ESTILO_NEGRITO : ESTILO_DE_TEXTO;
    alvo.addEntity(t);
  }

  /** IMAGE vinculada a imagens/<arquivo>, do tamanho do papel; o tamanho em pixels vem do próprio PNG/JPEG. */
  private imagem(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'imagem' }>): void {
    const objetos = this.w.document.objects;
    if (!this.dicionarioDeImagens) {
      this.dicionarioDeImagens = objetos.addDictionary();
      objetos.root.addEntryObject('ACAD_IMAGE_DICT', this.dicionarioDeImagens.handle);
      const vars = objetos.addObject(new DxfRasterVariables());   // moldura da imagem desligada (70 = 0) na plotagem
      vars.ownerObjecthandle = objetos.root.handle;
      objetos.root.addEntryObject('ACAD_IMAGE_VARS', vars.handle);
    }
    // mesmo nome com conteúdo diferente ganha sufixo; mesmo conteúdo reaproveita a definição
    const base = nomeDeArquivo(q.arquivo);
    let arquivo = `${PASTA_DAS_IMAGENS}/${base}`;
    for (let n = 2; this.imagens.has(arquivo) && this.imagens.get(arquivo)!.dataUrl !== q.dataUrl; n++) {
      arquivo = `${PASTA_DAS_IMAGENS}/${base.replace(/(\.[^.]*)?$/, `_${n}$1`)}`;
    }
    let def = this.imagens.get(arquivo)?.def;
    let px: [number, number];
    if (!def) {
      let lido: [number, number] | null = null;
      try {
        lido = pixelsDaImagem(dataUrlParaBytes(q.dataUrl));
      } catch {
        lido = null;   // não é data URL: o CAD avisa que não achou a imagem; o resto da prancha sai igual
      }
      // formato que não sei ler (SVG, por exemplo — que o CAD também não abre): pixels na proporção do papel
      px = lido ?? [1000, Math.max(1, Math.round((1000 * q.altura) / q.largura))];
      def = objetos.addImageDef(arquivo);
      corrigir(def, reatoresAntesDoDono());
      [def.width, def.height] = px;
      def.ownerObjecthandle = this.dicionarioDeImagens.handle;
      def.acadImageDictHandle = this.dicionarioDeImagens.handle;
      this.dicionarioDeImagens.addEntryObject(nomeDoCad(arquivo.slice(PASTA_DAS_IMAGENS.length + 1)), def.handle);
      this.imagens.set(arquivo, { dataUrl: q.dataUrl, def });
    } else {
      px = [def.width, def.height];
    }
    const [wpx, hpx] = px;
    const img = new Image(
      { width: wpx, height: hpx, scale: r(q.largura), rotation: 0, insertionPoint: this.P([q.p[0], q.p[1] + q.altura]), imageDefHandle: def.handle },
      this.opcoes(q.camada, undefined),
    );
    // a biblioteca faz o pixel quadrado (V = U girado); aqui V sai da altura pedida no papel
    (img as unknown as { _vVector: () => vec3_t })._vVector = () => point3d(0, q.altura / hpx, 0);
    const reator = objetos.addImageDefReactor(img.handle);
    reator.ownerObjecthandle = img.handle;   // o dono do reator é a imagem (a biblioteca deixa "0")
    img.imageDefReactorHandle = reator.handle;
    def.addImageDefReactorHandle(reator.handle);
    // 290 (modo do recorte) é do DXF 2010; este arquivo é 2004
    corrigir(alvo.addEntity(img), (c, v) => (c === 290 ? [] : [[c, v]]));
  }

  /**
   * BLOCO (o carimbo): a geometria vai na definição, com o ponto base no 0,0 da folha, e cada atributo vira um ATTDEF;
   * na folha entra um INSERT no 0,0, escala 1, com os ATTRIB preenchidos. Quem tem carimbo próprio troca o bloco
   * inteiro de uma vez. Nome repetido usa a primeira definição (no CAD o nome É a definição).
   */
  private bloco(alvo: EntitiesManager, nomeOriginal: string, prims: Primitiva[], atributos: AtributoDoBloco[]): void {
    const nome = nomeDoCad(nomeOriginal);
    if (!this.blocos.has(nome)) {
      this.blocos.add(nome);
      const b = this.w.addBlock(nome);
      b.flags = atributos.length ? BlockFlags.HasNonConstantAttribute : BlockFlags.None;
      this.desenhar(prims, b);
      for (const a of atributos) {
        const p = this.P(a.p);
        const tag = nomeDoCad(a.etiqueta);
        const d = new Attdef(p, r(a.altura * MAIUSCULA_DA_ARIAL), tag, textoAscii(a.valor), { ...this.opcoes(a.camada, a.cor), ...this.alinhamento(a.ancora, p) });
        d.textStyle = ESTILO_DE_TEXTO;
        // 3 = a pergunta que o CAD faz ao inserir/editar (a biblioteca grava vazia); 280 é do DXF 2010
        corrigir(b.addEntity(d), (c, v) => (c === 3 ? [[3, tag]] : c === 280 ? [] : [[c, v]]));
      }
    }
    const camada = this.opcoes(nomeOriginal, undefined).layerName;
    const ins = alvo.addEntity(new Insert(nome, point3d(0, 0, 0), { layerName: camada }));
    if (!atributos.length) return;
    ins.attributesFollowFlag = 1;
    for (const a of atributos) {
      const p = this.P(a.p);
      const at = new Attrib(p, r(a.altura * MAIUSCULA_DA_ARIAL), nomeDoCad(a.etiqueta), textoAscii(a.valor), { ...this.opcoes(a.camada, a.cor), ...this.alinhamento(a.ancora, p) });
      at.textStyle = ESTILO_DE_TEXTO;
      corrigir(alvo.addEntity(at), (c, v) => (c === 280 ? [] : [[c, v]]));
      at.ownerBlockRecord = ins.handle;   // o atributo pertence ao INSERT, não ao espaço do desenho
    }
    const fim = alvo.addEntity(new SeqEnd());
    fim.ownerBlockRecord = ins.handle;
    fim.layerName = camada;
  }

  // ── tabelas e classes ──

  /** Uma camada por `camada` usada; a cor da camada é a mais frequente das entidades dela. */
  private criarCamadas(): void {
    for (const [nome, uso] of this.usoDeCor) {
      const [chave] = [...uso.entries()].sort((a, b) => b[1] - a[1])[0];
      const c = corDoCad(chave === 'preto' ? undefined : chave);
      const camada = this.w.addLayer(nome, c.aci, 'Continuous');
      if (c.verdadeira !== undefined) camada.trueColor = c.verdadeira;
    }
  }

  /** CLASSES: a biblioteca grava a seção vazia; IMAGE e as peças dela são classes que o CAD precisa ver declaradas. */
  private declararClasses(): void {
    if (!this.imagens.size) return;
    const n = (tipo: string) => this.contar(tipo);
    const classes: [string, string, number, number, number][] = [
      // nome DXF, classe C++, flags, nº de instâncias, é entidade (valores do ezdxf, sections/classes.py)
      ['IMAGE', 'AcDbRasterImage', 2175, n('IMAGE'), 1],
      ['IMAGEDEF', 'AcDbRasterImageDef', 0, this.imagens.size, 0],
      ['IMAGEDEF_REACTOR', 'AcDbRasterImageDefReactor', 1, n('IMAGE'), 0],
      ['RASTERVARIABLES', 'AcDbRasterVariables', 0, 1, 0],
    ];
    this.w.document.classes.dxfy = (dx: Dxfier) => {
      dx.start('CLASSES');
      for (const [nome, cpp, flags, qtd, entidade] of classes) {
        dx.push(0, 'CLASS');
        dx.push(1, nome);
        dx.push(2, cpp);
        dx.push(3, 'ISM');
        dx.push(90, flags);
        dx.push(91, qtd);
        dx.push(280, 0);
        dx.push(281, entidade);
      }
      dx.end();
    };
  }

  private contar(tipo: string): number {
    let n = 0;
    for (const b of this.w.document.blocks.blocks) n += b.entities.filter((e) => e.type === tipo).length;
    return n;
  }
}

function semFechoRepetido(pts: Pt[]): Pt[] {
  const n = pts.length;
  if (n > 1 && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1]) return pts.slice(0, -1);
  return pts;
}

/** Risco de cada material quando a primitiva não diz: as cores do Revit do José (desenhos/hachuras.ts). */
function riscoPadrao(p: PadraoHachura): string {
  switch (p) {
    case 'terra': return HACHURA.terra;
    case 'concreto': return HACHURA.concreto;
    case 'areia': return HACHURA.areia;
    case 'brita': return HACHURA.brita;
    default: return '#000000';
  }
}

/** Uma folha → o texto do DXF e as imagens que ele vincula (caminho relativo ao .dxf). */
export function gerarDxf(folha: FolhaDxf): { dxf: string; imagens: ImagemDoDxf[] } {
  return new Gravador(folha).gravar();
}

// ── o pacote baixado ────────────────────────────────────────────────────────

/** Troca o nome do arquivo de cada imagem (também dentro de blocos), sem mexer no resto. */
function renomearImagens(prims: Primitiva[], nomear: (arquivo: string, dataUrl: string) => string): Primitiva[] {
  return prims.map((q): Primitiva => {
    if (q.k === 'imagem') return { ...q, arquivo: nomear(q.arquivo, q.dataUrl) };
    if (q.k === 'bloco') return { ...q, prims: renomearImagens(q.prims, nomear) };
    return q;
  });
}

/**
 * O .zip que o app baixa: um .dxf por folha e a pasta imagens/ que eles vinculam. Entre as folhas, a mesma imagem
 * (mesmo conteúdo) vai uma vez só; nome igual com conteúdo diferente ganha sufixo — senão uma prancha abriria com a
 * foto da outra.
 */
export function pacoteDxf(folhas: FolhaDxf[], data?: Date): Uint8Array {
  const nomePorConteudo = new Map<string, string>();
  const nomesUsados = new Set<string>();
  const arquivos: { nome: string; dados: Uint8Array | string }[] = [];
  const nomesDxf = new Set<string>();
  for (const f of folhas) {
    const prims = renomearImagens(f.prims, (arquivo, dataUrl) => {
      const ja = nomePorConteudo.get(dataUrl);
      if (ja) return ja;
      const base = nomeDeArquivo(arquivo);
      let nome = base;
      for (let n = 2; nomesUsados.has(nome); n++) nome = base.replace(/(\.[^.]*)?$/, `_${n}$1`);
      nomesUsados.add(nome);
      nomePorConteudo.set(dataUrl, nome);
      return nome;
    });
    const { dxf, imagens } = gerarDxf({ ...f, prims });
    let nome = `${nomeDeArquivo(f.nome)}.dxf`;
    for (let n = 2; nomesDxf.has(nome.toLowerCase()); n++) nome = `${nomeDeArquivo(f.nome)}_${n}.dxf`;
    nomesDxf.add(nome.toLowerCase());
    arquivos.push({ nome, dados: dxf });
    for (const im of imagens) {
      if (!arquivos.some((a) => a.nome === im.arquivo)) arquivos.push({ nome: im.arquivo, dados: dataUrlParaBytes(im.dataUrl) });
    }
  }
  return zipar(arquivos, data);
}
