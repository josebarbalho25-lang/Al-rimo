/*
  LEITURA DO SVG PARA OS TESTES — o teste olha o desenho como o navegador olharia: XML bem formado, textos
  com a caixa que ocupam, ids das peças. Sem DOM (o vitest roda em Node).
*/
import { Prancha } from '../prancha';

/** Confere a boa formação do XML: tags balanceadas, atributos entre aspas, texto sem '<' nem '&' solto. */
export function xmlBemFormado(xml: string): string | null {
  const pilha: string[] = [];
  const re = /<[^>]*>|[^<]+/g;
  let m: RegExpExecArray | null;
  let raiz = 0;
  while ((m = re.exec(xml))) {
    const tok = m[0];
    if (!tok.startsWith('<')) {
      if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(tok)) return `& solto em: ${tok.slice(0, 40)}`;
      continue;
    }
    if (!/^<\/?[A-Za-z][\w:-]*(\s+[\w:-]+="[^"<]*")*\s*\/?>$/.test(tok)) return `tag inválida: ${tok.slice(0, 80)}`;
    const nome = tok.match(/^<\/?([\w:-]+)/)![1];
    if (tok.startsWith('</')) {
      if (pilha.pop() !== nome) return `fechamento sem abertura: ${nome}`;
      if (!pilha.length) raiz++;
    } else if (!tok.endsWith('/>')) pilha.push(nome);
    else if (!pilha.length) raiz++;
  }
  if (pilha.length) return `tags abertas: ${pilha.join(',')}`;
  if (raiz !== 1) return `raízes: ${raiz}`;
  return null;
}

export function viewBox(svg: string): [number, number, number, number] {
  const v = svg.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
  return [v[0], v[1], v[2], v[3]];
}

const desescapar = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

export interface TextoLido { x: number; y: number; tam: number; anc: string; negrito: boolean; vertical: boolean; t: string }
export function textos(svg: string): TextoLido[] {
  const out: TextoLido[] = [];
  for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const a = m[1];
    const at = (n: string) => a.match(new RegExp(`${n}="([^"]*)"`))?.[1];
    out.push({
      x: Number(at('x')), y: Number(at('y')), tam: Number(at('font-size')), anc: at('text-anchor') ?? 'start',
      negrito: at('font-weight') === 'bold', vertical: /rotate\(-90/.test(at('transform') ?? ''), t: desescapar(m[2]),
    });
  }
  return out;
}

export function textosForaDoViewBox(svg: string): string[] {
  const [vx, vy, vw, vh] = viewBox(svg);
  const fora: string[] = [];
  for (const q of textos(svg)) {
    const w = Prancha.largura(q.t, q.tam, q.negrito);
    const a0 = q.anc === 'start' ? 0 : q.anc === 'middle' ? -w / 2 : -w;
    const [x0, y0, x1, y1] = q.vertical
      ? [q.x - 0.85 * q.tam, q.y - a0 - w, q.x + 0.25 * q.tam, q.y - a0]
      : [q.x + a0, q.y - 0.85 * q.tam, q.x + a0 + w, q.y + 0.25 * q.tam];
    if (x0 < vx - 0.5 || y0 < vy - 0.5 || x1 > vx + vw + 0.5 || y1 > vy + vh + 0.5) fora.push(q.t);
  }
  return fora;
}

export const rotulos = (svg: string) => textos(svg).map((q) => q.t);
export const ids = (svg: string) => new Set([...svg.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]));
