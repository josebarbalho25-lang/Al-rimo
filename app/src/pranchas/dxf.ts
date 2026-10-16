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
    · toda camada sai com espessura 0,00 mm → aqui sai a da tabela (camadasDxf.ts);
    · a imagem sai com pixel quadrado → o vetor V vem da altura real no papel;
    · o MTEXT não tem máscara de fundo → acrescentada no texto que pede (mascara).
  Os consertos que mexem no que a biblioteca grava passam por `corrigir` (um filtro nos pares código/valor de UMA
  entidade) — nada é remendado no texto final.

  CAMADAS (camadasDxf.ts): tabela fixa, cor e espessura iguais em todo arquivo; a entidade vai "por camada", menos
  onde a cor é informação (fundo sólido, face do 3D, bitola no 3D). Todo fundo sólido vai para <MATERIAL>-FUNDO
  (e a face do 3D Cores para 3D-FACES): plotado em monocromático, o sólido colorido sai preto — o cadista congela
  essas camadas e fica o traço. Branco de papel (e o quase-branco, ≥ 240 nos três canais) não vai: no papel ele não
  se vê, e plotado em monocromático sairia preto.

  O QUE SE LIMPA antes de gravar: traço repetido (o mesmo segmento, na mesma camada, desenhado duas vezes — as
  faces vizinhas do 3D dividem a aresta, as cotas encadeadas dividem a marca) e texto vazio (a célula vazia do
  resumo do aço) — o cadista não tem de catar entidade fantasma.

  Versão: AC1018 (DXF 2004), codificação ANSI_1252 (o $DWGCODEPAGE): o que existe na página 1252 vai em byte
  (ç ã é ó Ø ² · — × °: o português inteiro), e só o resto (φ ≥ −…) sai como \U+XXXX, como o próprio AutoCAD grava
  até o 2004 e todo CAD lê. O texto é montado como string e vira bytes 1252 em `bytesDoDxf` — gravar a string
  direto (em UTF-8) quebraria todo acento.

  Eixo Y: a primitiva vem com y para BAIXO (como o SVG, origem no canto superior esquerdo da folha); no DXF y sobe:
  y_dxf = altura − y. Ângulo de texto já vem anti-horário (cota vertical = 90): passa direto.
*/

import {
  Attdef, Attrib, BlockFlags, DxfRasterVariables, DxfWriter, HatchBoundaryPaths, HatchPattern, HatchPolylineBoundary,
  Image, Insert, LWPolylineFlags, MText, MTextAttachmentPoint, SeqEnd, Text, TextHorizontalAlignment, Units, aciHex,
  pattern, point2d, point3d, vertex,
  type CommonEntityOptions, type DxfDictionary, type DxfImageDef, type Dxfier, type EntitiesManager, type HatchPredefinedPatterns,
  type vec3_t,
} from '@tarikjabiri/dxf';
import { HACHURA } from '@/desenhos/hachuras';
import { camadaDeFundo, camadaDoCad } from './camadasDxf';
import { PADRAO_DO_MATERIAL, linhasNaEscala, type PadraoNoDxf } from './padroesDxf';
import { MAIUSCULA_DA_ARIAL, type AtributoDoBloco, type PadraoHachura, type Primitiva, type Pt, type Traco } from './tipos';
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
/** O número do título dos desenhos (o quadrado azul): itálico, como na imagem do Jose (16/10). */
const ESTILO_ITALICO = 'ALRIMO_ITALICO';

/**
 * No CAD a altura do TEXT com fonte TrueType é a da LETRA MAIÚSCULA; no SVG (e no PDF) a altura do texto é o corpo
 * da fonte (o "em"). Sem a conversão (MAIUSCULA_DA_ARIAL, no contrato) a letra sairia 40 % maior no DXF do que no
 * PDF da mesma prancha.
 */
export { MAIUSCULA_DA_ARIAL };

/** Espessuras de linha que o CAD aceita (grupo 370, centésimos de mm). */
const ESPESSURAS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];

export function espessuraDoCad(mm: number): number {
  // traço fino abaixo de 0,13 mm não sai na plotadora (o contorno do furo no isométrico tem 0,07 mm no papel)
  const c = (mm > 0 ? Math.max(mm, 0.13) : 0) * 100;
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

function rgb(cor: string | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((cor ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Cor da primitiva → índice do CAD (62) + cor verdadeira (420). Preto (ou quase) vira o 7 SEM cor verdadeira: preto
 * de verdade some no fundo preto do CAD (o TQS e muito AutoCAD trabalham assim); o 7 é branco na tela e preto no papel.
 */
export function corDoCad(cor: string | undefined): CorDoCad {
  const c = rgb(cor);
  if (!c) return { aci: 7 };
  const [r, g, b] = c;
  if (Math.max(r, g, b) < 0x30) return { aci: 7 };
  let aci = 7, d = Infinity;
  for (const [i, pr, pg, pb] of PALETA) {
    const di = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (di < d) [aci, d] = [i, di];
  }
  return { aci, verdadeira: (r << 16) | (g << 8) | b };
}

/**
 * Branco de papel, ou quase (≥ 240 nos três canais: o #f6f6f6 da manta do Opaco, o #f7f7f7 do véu do terreno): no
 * papel não se vê, e plotado em monocromático um sólido branco sai PRETO. Não vai para o DXF.
 */
export function quaseBranco(cor: string | undefined): boolean {
  const c = rgb(cor);
  return !!c && c.every((v) => v >= 0xf0);
}

// ── texto em cp1252 e nomes em ASCII ────────────────────────────────────────

/** Os caracteres que a página 1252 põe em 0x80–0x9F (no resto, de 0xA0 a 0xFF, o byte é o próprio código). */
const CP1252_ALTO: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** O byte do caractere na página 1252, ou null se ela não o tem. */
function byte1252(c: number): number | null {
  if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) return c;
  return CP1252_ALTO[c] ?? null;
}

/**
 * Texto do desenho para o DXF: o que a página 1252 tem fica como está (vira byte em `bytesDoDxf`); o resto vira
 * \U+XXXX ("φ" → "\U+03C6"). Quebra de linha e controle viram espaço.
 */
export function textoDoCad(s: string): string {
  let out = '';
  for (const ch of s.replace(/[\r\n\t]+/g, ' ')) {
    const c = ch.codePointAt(0)!;
    if (c < 32 || c === 127) out += ' ';
    else if (byte1252(c) !== null) out += ch;
    else if (c <= 0xffff) out += '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    else out += '?';   // fora do plano básico o \U+ do CAD não alcança (4 dígitos)
  }
  return out;
}

/** No MTEXT a barra invertida e as chaves são comando de formatação: o texto as escapa antes do \U+. */
function textoDoMtext(s: string): string {
  return textoDoCad(s.replace(/\\/g, '\\\\').replace(/[{}]/g, (c) => '\\' + c));
}

/** O DXF montado (string) → os bytes do arquivo, na página 1252 que o cabeçalho declara. */
export function bytesDoDxf(dxf: string): Uint8Array {
  const out = new Uint8Array(dxf.length);
  let n = 0;
  for (const ch of dxf) {
    const b = byte1252(ch.codePointAt(0)!);
    out[n++] = b ?? 0x3f;   // não acontece: textoDoCad já escapou o que a página não tem
  }
  return out.subarray(0, n);
}

/** Nome de tabela do CAD (camada, bloco, etiqueta): sem acento, maiúsculo, só letra, número, - e _. */
export function nomeDoCad(s: string): string {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
  return n.replace(/^_+|_+$/g, '') || 'SEM_NOME';
}

/** Nome de arquivo em ASCII (o caminho da imagem vai dentro do DXF). */
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

// ── limpeza: traço repetido e texto vazio ───────────────────────────────────

/** A chave do estilo de um traço no DXF: camada, cor (só a que vai própria) e tracejado — a espessura é a da camada. */
const estiloDoTraco = (e: Traco): string => `${nomeDoCad(e.camada)}|${e.corPropria ? e.cor.toLowerCase() : ''}|${e.tracejado?.join(',') ?? ''}`;

/** Ponto arredondado a 0,1 µm de papel: o mesmo vértice calculado por dois caminhos dá a mesma chave. */
const chaveDoPonto = ([x, y]: Pt): string => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;

/**
 * Tira o repetido: a mesma linha (nos dois sentidos), a mesma polilinha (em qualquer vértice de partida e sentido,
 * se fechada) ou a mesma hachura, com o mesmo estilo. Fica a ÚLTIMA cópia — a que estava por cima de tudo o que veio
 * antes —, para nenhum preenchimento pintado entre as duas passar a cobri-la. A borda da hachura entra como
 * polilinha logo depois dela (é o que o DXF grava), para valer a mesma regra contra o contorno desenhado à parte.
 * Texto sem letra também sai. Dentro do bloco, a mesma limpeza.
 */
export function semRepetidas(prims: Primitiva[]): Primitiva[] {
  const abertas = prims.flatMap((q): Primitiva[] =>
    q.k === 'hachura' && q.borda
      ? [{ ...q, borda: undefined }, ...q.aneis.map((pts): Primitiva => ({ k: 'polilinha', pts, fechada: true, e: q.borda! }))]
      : [q],
  );
  const vistas = new Set<string>();
  const out: Primitiva[] = [];
  for (let i = abertas.length - 1; i >= 0; i--) {
    const q = abertas[i];
    let chave: string | null = null;
    if (q.k === 'linha') {
      const [a, b] = [chaveDoPonto(q.a), chaveDoPonto(q.b)];
      chave = `L|${estiloDoTraco(q.e)}|${a < b ? a + ';' + b : b + ';' + a}`;
    } else if (q.k === 'polilinha') {
      chave = `P|${estiloDoTraco(q.e)}|${q.fechada ? 1 : 0}|${formaCanonica(q.pts.map(chaveDoPonto), q.fechada)}`;
    } else if (q.k === 'hachura') {
      const aneis = q.aneis.map((a) => formaCanonica(a.map(chaveDoPonto), true)).sort().join('/');
      chave = `H|${nomeDoCad(q.camada)}|${q.padrao}|${q.fundo ?? ''}|${q.risco ?? ''}|${aneis}`;
    } else if (q.k === 'texto') {
      if (!q.t.trim()) continue;
    } else if (q.k === 'bloco') {
      out.push({ ...q, prims: semRepetidas(q.prims) });
      continue;
    }
    if (chave !== null) {
      if (vistas.has(chave)) continue;
      vistas.add(chave);
    }
    out.push(q);
  }
  return out.reverse();
}

/** A sequência de vértices na forma que não depende de onde começa nem do sentido (a menor das leituras). */
function formaCanonica(v: string[], fechada: boolean): string {
  if (fechada && v.length > 1 && v[0] === v[v.length - 1]) v = v.slice(0, -1);
  const leituras: string[][] = [v, [...v].reverse()];
  if (fechada) {
    for (const base of [v, [...v].reverse()]) {
      const k = base.indexOf([...base].sort()[0]);
      leituras.push([...base.slice(k), ...base.slice(0, k)]);
    }
  }
  return leituras.map((l) => l.join(';')).sort()[0];
}

// ── consertos por entidade ──────────────────────────────────────────────────

type Grupo = [number, number | string];
type Filtro = (codigo: number, valor: number | string) => Grupo[];

/**
 * Passa cada par (código, valor) que a biblioteca grava para ESTA entidade pelo filtro — é por aqui que entram a
 * espessura da camada, o estilo par-ímpar da hachura e o que é de versão posterior à 2004. Vale só durante a
 * gravação da entidade; o gravador volta ao normal logo depois.
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

/** Arredonda a coordenada (6 casas = milésimo de mícron no papel): sem "0,30000000000000004" nem notação 1e-7. */
const r = (v: number): number => Math.round(v * 1e6) / 1e6 + 0;

// ── o gravador ──────────────────────────────────────────────────────────────

class Gravador {
  private readonly w = new DxfWriter();   // primeiro de tudo: o construtor zera o contador de handles
  /** Para onde vão as coordenadas: x − ox, oy − y. No espaço do desenho (0, altura da folha); dentro de um bloco, o
   *  ponto base dele (a geometria do bloco é relativa ao ponto base). */
  private ox = 0;
  private oy: number;
  private readonly camadasUsadas = new Set<string>();
  private readonly tiposDeLinha = new Map<string, string>();            // traço/espaço → nome do LTYPE
  private readonly blocos = new Set<string>();
  private readonly imagens = new Map<string, { dataUrl: string; def: DxfImageDef }>();
  private dicionarioDeImagens: DxfDictionary | null = null;

  constructor(private readonly folha: FolhaDxf) {
    this.oy = folha.altura;
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
    const italico = w.tables.addStyle(ESTILO_ITALICO);
    italico.fontFileName = 'ariali.ttf';

    // a vista inicial do CAD enquadra a folha (a da biblioteca enquadra caixas de ±100 em volta de cada texto)
    const ms = w.modelSpace;
    ms.centerView = () => point3d(r(folha.largura / 2), r(folha.altura / 2), 0);
    ms.viewHeight = () => r(folha.altura * 1.05);

    this.desenhar(semRepetidas(folha.prims), ms);
    this.criarCamadas();
    this.declararClasses();

    const imagens = [...this.imagens.entries()].map(([arquivo, { dataUrl }]) => ({ arquivo, dataUrl }));
    return { dxf: w.stringify() + '\n', imagens };
  }

  // ── coordenadas ──

  private X = (x: number): number => r(x - this.ox);
  private Y = (y: number): number => r(this.oy - y);
  private P = ([x, y]: Pt): vec3_t => point3d(this.X(x), this.Y(y), 0);

  // ── camada e cor ──

  /** A camada no CAD, guardada para a tabela. */
  private camada(nome: string): string {
    const n = nomeDoCad(nome);
    this.camadasUsadas.add(n);
    return n;
  }

  /** Entidade "por camada": nem cor nem espessura própria (o CAD lê da camada). */
  private porCamada(camada: string, tracejado?: number[]): CommonEntityOptions {
    return { layerName: this.camada(camada), lineType: tracejado?.length ? this.tipoDeLinha(tracejado) : undefined };
  }

  /** Entidade com a cor verdadeira (a cor é informação) e o índice mais próximo para quem não lê o 420. */
  private corVerdadeira(cor: string): Pick<CommonEntityOptions, 'colorNumber' | 'trueColor'> {
    const c = corDoCad(cor);
    return { colorNumber: c.aci, trueColor: c.verdadeira === undefined ? undefined : String(c.verdadeira) };
  }

  private opcoesDoTraco(e: Traco): CommonEntityOptions {
    return { ...this.porCamada(e.camada, e.tracejado), ...(e.corPropria ? this.corVerdadeira(e.cor) : {}) };
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

  // ── primitivas ──

  private desenhar(prims: Primitiva[], alvo: EntitiesManager): void {
    for (const q of prims) {
      switch (q.k) {
        case 'linha':
          if (!quaseBranco(q.e.cor)) alvo.addLine(this.P(q.a), this.P(q.b), this.opcoesDoTraco(q.e));
          break;
        case 'polilinha':
          this.polilinha(alvo, q.pts, q.fechada, q.e);
          break;
        case 'circulo':
          if (q.cheio && !quaseBranco(q.cheio)) {
            // disco cheio (a barra cortada): HATCH sólido de dois arcos de 180° (bulge 1) — o círculo exato. Não é
            // fundo: é o desenho da barra, e fica na camada dela, na cor dela
            const [cx, cy] = q.c;
            this.preencher(alvo, [[[cx + q.r, cy], [cx - q.r, cy]]], PADRAO_DO_MATERIAL.solido, this.porCamada(q.e?.camada ?? '0'), [1, 1]);
          }
          // o contorno de espessura 0 é só o recado da camada (o ponto sem contorno, desenhos/prancha.ts): na
          // espessura da camada ele engordaria o ponto
          if (q.e && !quaseBranco(q.e.cor) && !(q.cheio && q.e.espessura === 0)) alvo.addCircle(this.P(q.c), r(q.r), this.opcoesDoTraco(q.e));
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
          this.bloco(alvo, q);
          break;
      }
    }
  }

  private polilinha(alvo: EntitiesManager, pts: Pt[], fechada: boolean, e: Traco): void {
    if (quaseBranco(e.cor)) return;
    const v = fechada ? semFechoRepetido(pts) : pts;
    if (v.length < 2) return;
    alvo.addLWPolyline(v.map((p) => ({ point: point2d(this.X(p[0]), this.Y(p[1])) })), {
      ...this.opcoesDoTraco(e),
      flags: fechada ? LWPolylineFlags.Closed : LWPolylineFlags.None,
    });
  }

  private hachura(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'hachura' }>): void {
    // O fundo sólido vai para a camada -FUNDO do material, na cor verdadeira (a cor do bloco é informação). O branco
    // de papel não vai: no DXF ninguém fica por baixo dele (a terra do corte já contorna as peças), e plotado em
    // monocromático ele sairia PRETO.
    const fundo = (cor: string) => {
      if (!quaseBranco(cor)) this.preencher(alvo, q.aneis, PADRAO_DO_MATERIAL.solido, { layerName: this.camada(camadaDeFundo(nomeDoCad(q.camada))), ...this.corVerdadeira(cor) });
    };
    if (q.padrao === 'solido') {
      fundo(q.fundo ?? q.risco ?? '#000000');
    } else {
      // o fundo vem antes (por baixo), o padrão por cima, na camada do material: a terra é risco sobre o bege
      if (q.fundo) fundo(q.fundo);
      // a escala da tabela de gráficos (o Jose engrossa ou afina a hachura na tela) vai por cima da calibrada
      const base = PADRAO_DO_MATERIAL[q.padrao];
      const padrao = q.escala && q.escala !== 1 ? { ...base, escala: base.escala * q.escala } : base;
      if (!quaseBranco(q.risco ?? riscoPadrao(q.padrao))) this.preencher(alvo, q.aneis, padrao, this.porCamada(q.camada));
    }
    if (q.borda) for (const anel of q.aneis) this.polilinha(alvo, anel, true, q.borda);
  }

  /**
   * Um HATCH não associativo com os anéis como caminhos de polilinha, estilo normal (par-ímpar): o furo do bloco
   * vazado fica vazio de verdade. `bulges` (opcional) = curvatura de cada vértice do 1º anel (o disco cheio).
   */
  private preencher(alvo: EntitiesManager, aneis: Pt[][], padrao: PadraoNoDxf, opcoes: CommonEntityOptions, bulges?: number[]): void {
    const caminhos = new HatchBoundaryPaths();
    for (const anel of aneis) {
      const v = bulges ? anel : semFechoRepetido(anel);
      if (v.length < (bulges ? 2 : 3)) continue;
      caminhos.addPolylineBoundary(new HatchPolylineBoundary(v.map((p, i) => vertex(this.X(p[0]), this.Y(p[1]), bulges?.[i]))));
    }
    if (caminhos.length === 0) return;
    const h = alvo.addHatch(caminhos, pattern({ name: padrao.nome as HatchPredefinedPatterns }), opcoes);
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
    // 75 = estilo da hachura: 0 = normal (par-ímpar, a regra da primitiva); a biblioteca grava 1 ("só o externo")
    corrigir(h, (c, v) => (c === 75 ? [[75, 0]] : [[c, v]]));
  }

  private alinhamento(ancora: 'start' | 'middle' | 'end', p: vec3_t): { horizontalAlignment?: TextHorizontalAlignment; secondAlignmentPoint?: vec3_t } {
    if (ancora === 'start') return {};
    // centro/direita: o CAD alinha pelo 2º ponto (11/21); o 1º (10/20) ele recalcula ao abrir
    return { horizontalAlignment: ancora === 'middle' ? TextHorizontalAlignment.Center : TextHorizontalAlignment.Right, secondAlignmentPoint: p };
  }

  private estiloDoTexto(q: Extract<Primitiva, { k: 'texto' }>): string {
    return q.negrito ? ESTILO_NEGRITO : q.italico ? ESTILO_ITALICO : ESTILO_DE_TEXTO;
  }

  private texto(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'texto' }>): void {
    if (!q.t.trim()) return;   // texto vazio não vai (a célula vazia de uma tabela): no CAD é entidade fantasma
    if (q.mascara) {
      this.textoComMascara(alvo, q);
      return;
    }
    const p = this.P(q.p);
    const t = new Text(p, r(q.altura * MAIUSCULA_DA_ARIAL), textoDoCad(q.t), {
      ...this.porCamada(q.camada),
      // a cor que é informação (o número branco no quadrado azul do título) vai de verdade, não pela camada
      ...(q.corPropria ? this.corVerdadeira(q.cor) : {}),
      ...this.alinhamento(q.ancora, p),
      rotation: q.angulo ? r(q.angulo) : undefined,
    });
    t.textStyle = this.estiloDoTexto(q);
    alvo.addEntity(t);
  }

  /**
   * Texto em cima de hachura (o halo branco do SVG): MTEXT com máscara de fundo na cor do desenho (90 = 3: máscara
   * ligada, cor do fundo da tela; plotado, a cor do papel) — tapa a hachura só atrás da letra, como o halo. O
   * MTEXT não tem linha de base: o ponto vai no MEIO da altura da maiúscula (anexo "meio"), e o giro pelo vetor
   * de direção (11/21/31), que não tem a dúvida de grau × radiano do grupo 50.
   */
  private textoComMascara(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'texto' }>): void {
    const h = q.altura * MAIUSCULA_DA_ARIAL;
    const a = (q.angulo * Math.PI) / 180;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];   // direção do texto no DXF (y para cima)
    // meio da maiúscula: sobe h/2 na perpendicular à direção (no papel y desce, por isso o sinal)
    const p: Pt = [q.p[0] - (h / 2) * dy, q.p[1] - (h / 2) * dx];
    const anexo = q.ancora === 'start' ? MTextAttachmentPoint.MiddleLeft : q.ancora === 'middle' ? MTextAttachmentPoint.MiddleCenter : MTextAttachmentPoint.MiddleRight;
    const t = new MText(this.P(p), r(h), textoDoMtext(q.t), { ...this.porCamada(q.camada), ...(q.corPropria ? this.corVerdadeira(q.cor) : {}), attachmentPoint: anexo });
    t.textStyle = this.estiloDoTexto(q);
    corrigir(alvo.addEntity(t), (c, v) => {
      if (c !== 7) return [[c, v]];
      const giro: Grupo[] = q.angulo ? [[11, r(dx)], [21, r(dy)], [31, 0]] : [];
      // 63 é obrigatório com a máscara (ignorado com a cor da tela); 45 = a folga em volta da letra (× altura)
      return [[7, v], ...giro, [90, 3], [63, 0], [45, 1.2]];
    });
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
      this.porCamada(q.camada),
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
   * BLOCO (o carimbo): a geometria vai na definição RELATIVA ao ponto base — o canto inferior direito do carimbo —,
   * e cada atributo vira um ATTDEF; na folha entra um INSERT nesse canto, escala 1, com os ATTRIB preenchidos. O
   * carimbo do escritório, desenhado com o ponto base no canto (o costume), cai no mesmo lugar quando o cadista
   * redefine o bloco. Nome repetido usa a primeira definição (no CAD o nome É a definição).
   */
  private bloco(alvo: EntitiesManager, q: Extract<Primitiva, { k: 'bloco' }>): void {
    const nome = nomeDoCad(q.nome);
    const [bx, by] = q.base ?? cantoInferiorDireito(q.prims, q.atributos);
    const estiloDoAtributo = (a: AtributoDoBloco) => (a.negrito ? ESTILO_NEGRITO : ESTILO_DE_TEXTO);
    if (!this.blocos.has(nome)) {
      this.blocos.add(nome);
      const b = this.w.addBlock(nome);
      b.flags = q.atributos.length ? BlockFlags.HasNonConstantAttribute : BlockFlags.None;
      const [ox, oy] = [this.ox, this.oy];
      [this.ox, this.oy] = [bx, by];   // dentro do bloco, tudo relativo ao ponto base (y para cima)
      try {
        this.desenhar(q.prims, b);
        for (const a of q.atributos) {
          const p = this.P(a.p);
          const tag = nomeDoCad(a.etiqueta);
          const d = new Attdef(p, r(a.altura * MAIUSCULA_DA_ARIAL), tag, textoDoCad(a.valor), { ...this.porCamada(a.camada), ...this.alinhamento(a.ancora, p) });
          d.textStyle = estiloDoAtributo(a);
          // 3 = a pergunta que o CAD faz ao inserir/editar (a biblioteca grava vazia); 280 é do DXF 2010
          corrigir(b.addEntity(d), (c, v) => (c === 3 ? [[3, tag]] : c === 280 ? [] : [[c, v]]));
        }
      } finally {
        [this.ox, this.oy] = [ox, oy];
      }
    }
    // a camada do INSERT é a do conteúdo do bloco (a de um carimbo 200 × 60 é CARIMBO, não CARIMBO_200X60)
    const camada = this.camada(q.atributos[0]?.camada ?? camadaDaPrimitiva(q.prims[0]) ?? q.nome);
    const ins = alvo.addEntity(new Insert(nome, this.P([bx, by]), { layerName: camada }));
    if (!q.atributos.length) return;
    ins.attributesFollowFlag = 1;
    for (const a of q.atributos) {
      const p = this.P(a.p);
      // o valor vai inteiro (a folha só encolhe a letra para caber); o atributo vazio fica, para o cadista preencher
      const at = new Attrib(p, r(a.altura * MAIUSCULA_DA_ARIAL), nomeDoCad(a.etiqueta), textoDoCad(a.valor), { ...this.porCamada(a.camada), ...this.alinhamento(a.ancora, p) });
      at.textStyle = estiloDoAtributo(a);
      corrigir(alvo.addEntity(at), (c, v) => (c === 280 ? [] : [[c, v]]));
      at.ownerBlockRecord = ins.handle;   // o atributo pertence ao INSERT, não ao espaço do desenho
    }
    const fim = alvo.addEntity(new SeqEnd());
    fim.ownerBlockRecord = ins.handle;
    fim.layerName = camada;
  }

  // ── tabelas e classes ──

  /** Uma camada por nome usado, com a cor e a espessura da TABELA (camadasDxf.ts) — iguais em todo arquivo. */
  private criarCamadas(): void {
    for (const nome of [...this.camadasUsadas].sort()) {
      if (nome === '0') continue;
      const c = camadaDoCad(nome);
      const lw = espessuraDoCad(c.espessura);
      // a biblioteca grava 370 = 0 (espessura 0,00 mm) em toda camada
      corrigir(this.w.addLayer(nome, c.aci, 'Continuous'), (k, v) => (k === 370 ? [[370, lw]] : [[k, v]]));
    }
    // a camada 0 fica com a espessura padrão do CAD (−3), não 0,00 mm
    const zero = this.w.tables.layerTable.layer('0');
    if (zero) corrigir(zero, (k, v) => (k === 370 ? [[370, -3]] : [[k, v]]));
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

/** Canto inferior direito (y para baixo: o maior x e o maior y) do que o bloco desenha — o ponto base padrão. */
function cantoInferiorDireito(prims: Primitiva[], atributos: AtributoDoBloco[]): Pt {
  let [x, y] = [-Infinity, -Infinity];
  const ver = (p: Pt) => ([x, y] = [Math.max(x, p[0]), Math.max(y, p[1])]);
  for (const q of prims) {
    if (q.k === 'linha') [q.a, q.b].forEach(ver);
    else if (q.k === 'polilinha') q.pts.forEach(ver);
    else if (q.k === 'hachura') q.aneis.flat().forEach(ver);
    else if (q.k === 'circulo') ver([q.c[0] + q.r, q.c[1] + q.r]);
    else if (q.k === 'texto') ver(q.p);
  }
  atributos.forEach((a) => ver(a.p));
  return Number.isFinite(x) ? [x, y] : [0, 0];
}

function camadaDaPrimitiva(q: Primitiva | undefined): string | undefined {
  if (!q) return undefined;
  if (q.k === 'linha' || q.k === 'polilinha') return q.e.camada;
  if (q.k === 'circulo') return q.e?.camada;
  if (q.k === 'bloco') return undefined;
  return q.camada;
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

/** Uma folha → o texto do DXF e as imagens que ele vincula (caminho relativo ao .dxf). Para o arquivo: bytesDoDxf. */
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
 * O .zip que o app baixa: um .dxf por folha (em bytes da página 1252, a que o cabeçalho declara) e a pasta imagens/
 * que eles vinculam. Entre as folhas, a mesma imagem (mesmo conteúdo) vai uma vez só; nome igual com conteúdo
 * diferente ganha sufixo — senão uma prancha abriria com a foto da outra.
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
    // em bytes 1252: a string iria para o zip em UTF-8, e o "ç" viraria "Ã§" no CAD
    arquivos.push({ nome, dados: bytesDoDxf(dxf) });
    for (const im of imagens) {
      if (!arquivos.some((a) => a.nome === im.arquivo)) arquivos.push({ nome: im.arquivo, dados: dataUrlParaBytes(im.dataUrl) });
    }
  }
  return zipar(arquivos, data);
}
