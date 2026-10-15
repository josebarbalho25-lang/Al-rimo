/*
  A FIGURA DE CADA PEÇA NA TABELA DE BLOCOS DA PRANCHA — em DESENHO, nunca em imagem (Jose, 15/10: "eu queria 0
  imagem vinculada no DXF"). A fonte é o mesmo arquivo do quantitativo (public/pecas, recorte '#icone'), que o
  gerador das figuras (figs/app/pecas) escreve só com polígonos: as três faces do bloco, a boca de cada furo e as
  faixas da parede de dentro do furo. Aqui o arquivo vira PRIMITIVAS da prancha — preenchimento sólido na cor da
  peça e contorno —, e a tela, o PDF e o DXF desenham as mesmas: sai igual nos três, e o DXF não leva imagem.

  O que o arquivo usa e o DXF 2004 não tem, resolvido aqui:
    · RECORTE (clip-path): as faixas de dentro do furo descem a altura do bloco e o arquivo as recorta pela boca do
      furo. A boca é convexa (retângulo de cantos redondos visto em isométrica): cada faixa é recortada na conta
      (Sutherland–Hodgman) e vai só o pedaço que aparece;
    · DEGRADÊ de profundidade (preto, de transparente a 38 %, por cima do furo e da parede de dentro da canaleta):
      o DXF 2004 não tem transparência; o degradê vira um escurecimento do que ele cobre, na média dele — a 8 mm de
      altura a diferença entre o degradê e a média não se vê;
    · traço da mesma cor do preenchimento (tapa a fresta entre faixas na tela): não é contorno e não vai — plotado
      em preto ele riscaria o furo inteiro;
    · as cotas e o fundo branco da figura grande ficam de fora (o grupo das cotas nem é lido).

  Camadas: o preenchimento vai para PECAS-FUNDO (cor verdadeira; o cadista congela para plotar em preto e branco,
  como os outros fundos) e o contorno para PECAS, "por camada"; a linha cinza tracejada (a parte que sai da canaleta
  cortada) leva a cor própria — o cinza ali é informação.
*/
import type { Primitiva, Pt, Traco } from './tipos';

/** A figura pronta para a folha: primitivas no sistema do arquivo (y para baixo) e a caixa do recorte '#icone'. */
export interface FiguraPronta {
  prims: Primitiva[];
  /** [x, y, largura, altura] do recorte '#icone', no sistema das primitivas. */
  caixa: [number, number, number, number];
  proporcao: number;
}

/** Contorno da peça no papel, mm: a espessura da camada PECAS (a menor que a plotadora marca). */
export const CONTORNO_DA_PECA = 0.13;
/** Tracejado da parte que sai (canaleta cortada), mm de papel. */
const TRACEJADO_DA_PECA = [0.5, 0.35];
const TINTA = '#262626';

type Atributos = Record<string, string>;

function atributos(tag: string): Atributos {
  const a: Atributos = {};
  for (const m of tag.matchAll(/([a-zA-Z][\w:-]*)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}

function pontos(s: string | undefined): Pt[] {
  if (!s) return [];
  const v = s.trim().split(/[\s,]+/).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) if (Number.isFinite(v[i]) && Number.isFinite(v[i + 1])) out.push([v[i], v[i + 1]]);
  return out;
}

const area2 = (p: Pt[]): number => p.reduce((s, [x, y], i) => {
  const [x2, y2] = p[(i + 1) % p.length];
  return s + x * y2 - x2 * y;
}, 0);

/** O polígono é convexo (todas as viradas para o mesmo lado)? Só assim o recorte pela conta vale. */
export function convexo(p: Pt[]): boolean {
  let sinal = 0;
  for (let i = 0; i < p.length; i++) {
    const [a, b, c] = [p[i], p[(i + 1) % p.length], p[(i + 2) % p.length]];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) continue;
    if (sinal === 0) sinal = Math.sign(z);
    else if (Math.sign(z) !== sinal) return false;
  }
  return true;
}

/** Recorta o polígono `alvo` pelo polígono CONVEXO `faca` (Sutherland–Hodgman). Vazio = fora. */
export function recortar(alvo: Pt[], faca: Pt[]): Pt[] {
  const s = Math.sign(area2(faca)) || 1;
  // dentro = o lado do miolo de cada aresta, no sentido em que a faca foi escrita
  const lado = (a: Pt, b: Pt, p: Pt) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  let saida = alvo;
  for (let i = 0; i < faca.length && saida.length; i++) {
    const [a, b] = [faca[i], faca[(i + 1) % faca.length]];
    const entrada = saida;
    saida = [];
    for (let j = 0; j < entrada.length; j++) {
      const p = entrada[j];
      const q = entrada[(j + 1) % entrada.length];
      const dp = lado(a, b, p);
      const dq = lado(a, b, q);
      if (dp >= -1e-9) saida.push(p);
      if ((dp >= -1e-9) !== (dq >= -1e-9)) {
        const t = dp / (dp - dq);
        saida.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return saida.length >= 3 && Math.abs(area2(saida)) > 1e-6 ? saida : [];
}

/** Recorta o segmento pelo polígono convexo (Cyrus–Beck); null = fora. */
function recortarSegmento(a: Pt, b: Pt, faca: Pt[]): [Pt, Pt] | null {
  const s = Math.sign(area2(faca)) || 1;
  let [t0, t1] = [0, 1];
  const d: Pt = [b[0] - a[0], b[1] - a[1]];
  for (let i = 0; i < faca.length; i++) {
    const [p, q] = [faca[i], faca[(i + 1) % faca.length]];
    // normal para o miolo
    const n: Pt = [-(q[1] - p[1]) * s, (q[0] - p[0]) * s];
    const num = n[0] * (a[0] - p[0]) + n[1] * (a[1] - p[1]);
    const den = n[0] * d[0] + n[1] * d[1];
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [[a[0] + d[0] * t0, a[1] + d[1] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1]];
}

/** #rrggbb escurecido pela fração f (a mistura com o preto que o degradê preto faz por cima). */
function escurecer(cor: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  if (!m) return cor;
  const v = parseInt(m[1], 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x * (1 - f)));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
}

const cor = (v: string | undefined): string | null => (v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

/**
 * O arquivo da figura (o texto do SVG) → as primitivas da peça. null = arquivo sem o recorte '#icone' ou sem o
 * grupo do conteúdo (o gerador das figuras mudou de jeito: o teste das figuras acusa).
 */
export function vetorDaPeca(texto: string): FiguraPronta | null {
  const vista = /<view\b[^>]*\bid="icone"[^>]*\bviewBox="([^"]+)"/.exec(texto) ?? /<view\b[^>]*\bviewBox="([^"]+)"[^>]*\bid="icone"/.exec(texto);
  const id = /\bdata-figura="([^"]+)"/.exec(texto)?.[1];
  if (!vista || !id) return null;
  const vb = vista[1].trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || !vb.every(Number.isFinite) || !(vb[2] > 0 && vb[3] > 0)) return null;
  const ini = texto.indexOf(`<g id="${id}-conteudo"`);
  if (ini < 0) return null;
  const fimDasCotas = texto.indexOf(`<g id="${id}-cotas"`, ini);
  const corpo = texto.slice(ini, fimDasCotas < 0 ? texto.lastIndexOf('</svg>') : fimDasCotas);

  // as facas dos recortes e o escurecimento médio de cada degradê
  const facas = new Map<string, Pt[]>();
  for (const m of texto.matchAll(/<clipPath\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/clipPath>/g)) {
    const poli = /<polygon\b[^>]*\bpoints="([^"]+)"/.exec(m[2]);
    if (poli) facas.set(m[1], pontos(poli[1]));
  }
  const degrades = new Map<string, number>();
  for (const m of texto.matchAll(/<linearGradient\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g)) {
    const op = [...m[2].matchAll(/stop-opacity="([^"]+)"/g)].map((x) => Number(x[1])).filter(Number.isFinite);
    if (op.length) degrades.set(m[1], op.reduce((s, x) => s + x, 0) / op.length);
  }

  const prims: Primitiva[] = [];
  // os preenchimentos de cada grupo, para o degradê de cima escurecer os que ele cobre
  type Preenchido = Extract<Primitiva, { k: 'hachura' }>;
  const pilha: { faca: Pt[] | null; cheios: Preenchido[] }[] = [{ faca: null, cheios: [] }];
  const faca = () => {
    for (let i = pilha.length - 1; i >= 0; i--) if (pilha[i].faca) return pilha[i].faca;
    return null;
  };
  const traco = (a: Atributos): Traco | null => {
    const c = cor(a.stroke);
    if (!c || Number(a['stroke-width'] ?? 1) <= 0) return null;
    const t: Traco = { camada: 'pecas', cor: c, espessura: CONTORNO_DA_PECA };
    if (a['stroke-dasharray']) t.tracejado = [...TRACEJADO_DA_PECA];
    if (c !== TINTA) t.corPropria = true;
    return t;
  };

  for (const m of corpo.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*)>/g)) {
    const [, fecha, nome, resto] = m;
    if (nome === 'g') {
      if (fecha) {
        if (pilha.length > 1) pilha.pop();
      } else if (!/\/\s*$/.test(resto)) {
        const clip = /clip-path="url\(#([^)]+)\)"/.exec(resto)?.[1];
        pilha.push({ faca: clip ? facas.get(clip) ?? null : null, cheios: [] });
      }
      continue;
    }
    if (fecha || !['polygon', 'polyline', 'line'].includes(nome)) continue;
    const a = atributos(resto);
    const f = faca();
    if (nome === 'line') {
      const p: [Pt, Pt] = [[Number(a.x1), Number(a.y1)], [Number(a.x2), Number(a.y2)]];
      const t = traco(a);
      const s = f ? recortarSegmento(p[0], p[1], f) : p;
      if (t && s) prims.push({ k: 'linha', a: s[0], b: s[1], e: t });
      continue;
    }
    let pts = pontos(a.points);
    if (pts.length < 2) continue;
    const degrade = /url\(#([^)]+)\)/.exec(a.fill ?? '')?.[1];
    if (degrade !== undefined) {
      // o degradê por cima escurece o que ele cobre: no furo, tudo o que o grupo recortado já pintou; na canaleta
      // (sem recorte), a face de mesmo contorno logo abaixo dele
      const fr = (degrades.get(degrade) ?? 0) * Number(a['fill-opacity'] ?? 1);
      const grupo = pilha[pilha.length - 1];
      const chave = JSON.stringify(pts);
      const alvo = grupo.faca ? grupo.cheios : grupo.cheios.filter((q) => JSON.stringify(q.aneis[0]) === chave);
      for (const q of alvo) q.fundo = escurecer(q.fundo ?? '#000000', fr);
      continue;
    }
    if (nome === 'polyline') {
      const t = traco(a);
      if (t) prims.push({ k: 'polilinha', pts, fechada: false, e: t });
      continue;
    }
    if (f) pts = recortar(pts, f);
    if (pts.length < 3) continue;
    const fundo = cor(a.fill);
    const t = traco(a);
    if (fundo) {
      // traço da cor do preenchimento só tapa fresta (não é contorno): não vai como borda
      const borda = t && t.cor !== fundo ? t : undefined;
      const q: Preenchido = { k: 'hachura', aneis: [pts], padrao: 'solido', fundo, camada: 'pecas', ...(borda ? { borda } : {}) };
      prims.push(q);
      pilha[pilha.length - 1].cheios.push(q);
    } else if (t) {
      prims.push({ k: 'polilinha', pts, fechada: true, e: t });
    }
  }
  return { prims, caixa: [vb[0], vb[1], vb[2], vb[3]], proporcao: vb[2] / vb[3] };
}

/**
 * Quem busca a figura de uma peça pelo endereço. `pronta` (opcional) devolve na hora a que já chegou: o desenhista
 * nasce de novo a cada muro (a prancha é viva), e sem ela a tabela piscaria sem as peças a cada tecla nas entradas.
 */
export interface CarregarFigura {
  (url: string): Promise<FiguraPronta>;
  pronta?: (url: string) => FiguraPronta | null;
}

async function lerFigura(endereco: string): Promise<FiguraPronta> {
  const resposta = await fetch(endereco);
  if (!resposta.ok) throw new Error(`figura da peça não encontrada: ${endereco}`);
  const f = vetorDaPeca(await resposta.text());
  if (!f) throw new Error(`figura da peça sem o recorte #icone: ${endereco}`);
  return f;
}

// a figura não depende do muro: uma leitura por arquivo enquanto o app estiver aberto (a que falha tenta de novo)
const guardadas = new Map<string, FiguraPronta>();
const aCaminho = new Map<string, Promise<FiguraPronta>>();

/** O carregador do app: a figura da peça pelo endereço do quantitativo (com ou sem o '#icone'). */
export const carregarFigura: CarregarFigura = Object.assign(
  (url: string): Promise<FiguraPronta> => {
    const endereco = url.split('#')[0];
    const ja = guardadas.get(endereco);
    if (ja) return Promise.resolve(ja);
    let pedido = aCaminho.get(endereco);
    if (!pedido) {
      pedido = lerFigura(endereco).then((f) => {
        guardadas.set(endereco, f);
        return f;
      });
      aCaminho.set(endereco, pedido);
      void pedido.catch(() => undefined).finally(() => aCaminho.delete(endereco));
    }
    return pedido;
  },
  { pronta: (url: string): FiguraPronta | null => guardadas.get(url.split('#')[0]) ?? null },
);
