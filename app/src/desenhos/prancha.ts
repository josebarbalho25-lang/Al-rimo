/*
  PRANCHA — o "papel" onde cada desenho é traçado, no estilo das figuras do projeto (figs/figlib.py): mesmas
  cores, mesma fonte, cota com marca oblíqua, solo hachurado a 45°, concreto pontilhado. O desenho do app
  conversa com as figuras de referência que o Jose já validou — mesmo vocabulário visual.

  Por que a prancha mede tudo o que desenha: o viewBox sai da caixa de TUDO o que foi traçado (inclusive a
  largura estimada dos textos). Assim nenhuma cota ou rótulo fica cortado na borda, qualquer que seja o tamanho
  do muro, sem ninguém ter de calcular margem à mão em cada vista. O teste confere isso de fora.

  Fundo sempre claro, papel branco também no tema escuro: as peças vão pintadas com as cores do Jose (cores.ts) e
  a folha dos desenhos não passa pelo filtro de inversão das outras pranchetas (Desenhos.tsx explica).
*/
import { esc, n } from './formato';

/** Cores das figuras (figlib.C) + as que os desenhos de obra pedem a mais (peça especial, brita). */
export const COR = {
  linha: '#262626',
  cota: '#404040',
  bloco: '#7f7f7f',
  blocoFundo: '#d9d9d9',
  graute: '#2e75b6',
  grauteFundo: '#bdd7ee',
  aco: '#c00000',
  solo: '#8d6e3f',
  soloFundo: '#e8d8b9',
  nota: '#595959',
  concreto: '#ececec',
  especial: '#b07d2b',
  especialFundo: '#f3e3c3',
  brita: '#8a8270',
  britaFundo: '#e6e1d6',
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
}

export interface OpcoesTexto {
  tam?: number;
  ancora?: 'start' | 'middle' | 'end';
  cor?: string;
  negrito?: boolean;
  vertical?: boolean;   // girado −90° (lê de baixo para cima), como cota vertical
  halo?: boolean;       // contorno branco por baixo: texto legível em cima de hachura
}

export type Pt = [number, number];

export class Prancha {
  private corpo: string[] = [];
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;

  constructor(readonly prefixo = 'des') {}

  /** Referência a um padrão de preenchimento desta prancha. */
  padrao(nome: 'solo' | 'conc' | 'alv' | 'brita' | 'graute'): string {
    return `url(#${this.prefixo}-${nome})`;
  }

  private estender(xa: number, ya: number, xb: number, yb: number): void {
    if (![xa, ya, xb, yb].every(Number.isFinite)) return;
    this.x0 = Math.min(this.x0, xa, xb);
    this.y0 = Math.min(this.y0, ya, yb);
    this.x1 = Math.max(this.x1, xa, xb);
    this.y1 = Math.max(this.y1, ya, yb);
  }

  private atributos(e: Estilo, fillPadrao = 'none', strokePadrao: string = COR.linha): string {
    const a = [`fill="${e.fill ?? fillPadrao}"`];
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
    this.corpo.push(`<rect x="${n(xa)}" y="${n(ya)}" width="${n(ww)}" height="${n(hh)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xa + ww, ya + hh);
  }

  linha(xa: number, ya: number, xb: number, yb: number, e: Estilo = {}): void {
    this.corpo.push(`<line x1="${n(xa)}" y1="${n(ya)}" x2="${n(xb)}" y2="${n(yb)}" ${this.atributos(e)}/>`);
    this.estender(xa, ya, xb, yb);
  }

  poligono(pts: Pt[], e: Estilo = {}): void {
    if (pts.length < 2) return;
    const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    this.corpo.push(`<polygon points="${p}" ${this.atributos(e)}/>`);
    for (const [x, y] of pts) this.estender(x, y, x, y);
  }

  polilinha(pts: Pt[], e: Estilo = {}): void {
    if (pts.length < 2) return;
    const p = pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    this.corpo.push(`<polyline points="${p}" ${this.atributos(e)} stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const [x, y] of pts) this.estender(x, y, x, y);
  }

  /** Contorno com furos num caminho só (regra par-ímpar): o furo do bloco fica vazado de verdade. */
  caminho(aneis: Pt[][], e: Estilo = {}): void {
    const d = aneis
      .filter((a) => a.length >= 3)
      .map((a) => 'M' + a.map(([x, y]) => `${n(x)},${n(y)}`).join('L') + 'Z')
      .join('');
    if (!d) return;
    this.corpo.push(`<path d="${d}" fill-rule="evenodd" ${this.atributos(e)}/>`);
    for (const a of aneis) for (const [x, y] of a) this.estender(x, y, x, y);
  }

  circulo(cx: number, cy: number, r: number, e: Estilo = {}): void {
    this.corpo.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${this.atributos(e, COR.aco, 'none')}/>`);
    this.estender(cx - r, cy - r, cx + r, cy + r);
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
        if (Math.abs(y - y0) > 3) this.linha(x, y0 + s * 2, x, y + s * 4, { stroke: COR.cota, sw: 0.6 });
      }
    }
    this.corpo.push(
      `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="${COR.cota}" stroke-width="0.9"` +
        ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
    );
    this.estender(x1 - 4, y - 4, x2 + 4, y + 4);
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
      this.texto(x0, y - 4 - nivel * (tam + 2), s.rotulo, { tam, cor: COR.cota, ancora: 'start', halo: true });
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
        this.linha(x0 + s * 2, y, x + s * 4, y, { stroke: COR.cota, sw: 0.6 });
      }
    }
    this.corpo.push(
      `<line x1="${n(x)}" y1="${n(y1)}" x2="${n(x)}" y2="${n(y2)}" stroke="${COR.cota}" stroke-width="0.9"` +
        ` marker-start="url(#${this.prefixo}-tick)" marker-end="url(#${this.prefixo}-tick)"/>`,
    );
    this.estender(x - 4, y1 - 4, x + 4, y2 + 4);
    const w = Prancha.largura(rotulo, tam);
    const xt = lado < 0 ? x - 4 : x + 4 + 0.85 * tam;
    if (w + 6 <= y2 - y1) this.texto(xt, (y1 + y2) / 2, rotulo, { tam, cor: COR.cota, vertical: true, halo: true });
    else this.texto(xt, y1 - 5, rotulo, { tam, cor: COR.cota, vertical: true, ancora: 'start', halo: true });
  }

  /** Grupo com atributos (ex.: data-camada) — para o componente e o teste acharem uma camada inteira. */
  abrir(atributos: string): void {
    this.corpo.push(`<g ${atributos}>`);
  }

  fechar(): void {
    this.corpo.push('</g>');
  }

  private defs(): string {
    const p = this.prefixo;
    return (
      `<marker id="${p}-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">` +
      `<path d="M2,8 L8,2" stroke="${COR.cota}" stroke-width="1.5"/></marker>` +
      `<pattern id="${p}-solo" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">` +
      `<rect width="10" height="10" fill="${COR.soloFundo}"/><line x1="0" y1="0" x2="0" y2="10" stroke="${COR.solo}" stroke-width="1" opacity="0.45"/></pattern>` +
      `<pattern id="${p}-conc" patternUnits="userSpaceOnUse" width="14" height="14"><rect width="14" height="14" fill="${COR.concreto}"/>` +
      `<circle cx="3" cy="4" r="1" fill="#9a9a9a"/><circle cx="10" cy="9" r="0.8" fill="#9a9a9a"/><circle cx="6" cy="12" r="0.6" fill="#9a9a9a"/></pattern>` +
      `<pattern id="${p}-alv" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">` +
      `<rect width="6" height="6" fill="${COR.blocoFundo}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${COR.bloco}" stroke-width="0.9"/></pattern>` +
      `<pattern id="${p}-brita" patternUnits="userSpaceOnUse" width="12" height="12"><rect width="12" height="12" fill="${COR.britaFundo}"/>` +
      `<circle cx="3" cy="3" r="2" fill="none" stroke="${COR.brita}" stroke-width="0.8"/><circle cx="9" cy="8" r="2.4" fill="none" stroke="${COR.brita}" stroke-width="0.8"/>` +
      `<circle cx="4" cy="10" r="1.2" fill="none" stroke="${COR.brita}" stroke-width="0.7"/></pattern>` +
      // graute visto atrás da face do bloco (vista frontal): só riscos, SEM fundo — a cor do tipo de bloco (o código
      // de cor da obra) continua aparecendo entre eles. Um tom chapado por cima, como antes, tingia o cinza do
      // inteiro de azul e ele passava por meio bloco
      `<pattern id="${p}-graute" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">` +
      `<line x1="0" y1="0" x2="0" y2="5" stroke="${COR.grauteFundo}" stroke-width="1.6"/></pattern>`
    );
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
