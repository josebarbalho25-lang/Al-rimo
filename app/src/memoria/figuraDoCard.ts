/*
  A FIGURA DO CARD — o mesmo acervo do botão de imagem das entradas (dados/figuras.json, via '@/figuras/mapa').
  O card guarda só 'Fig. 11'; quem resolve o endereço e o título é o mapa da frente das figuras, para que a
  memória e o formulário nunca mostrem desenhos diferentes com o mesmo número.

  O RECORTE: a figura do acervo sai numa moldura única (1000 × 640, a do modal das entradas), e o desenho de
  algumas ocupa um quarto dela (a Fig. 4 são dois blocos). Na memória a figura vai no vão ao lado da conta, e a
  moldura vazia era o "espaço sobrando" (Jose, 12/10): então a tela mostra só a caixa do desenho, que o gerador
  das figuras grava (figs/app/gerar.py → recortes.gerado.json). Figura sem caixa sai com a moldura inteira.
*/
import { figuras, urlDaFigura } from '@/figuras/mapa';
import recortes from '@/figuras/recortes.gerado.json';

export interface FiguraDoCard {
  url: string;
  /** 'Fig. 11 — Pressões no muro' */
  titulo: string;
  /** A caixa do desenho no sistema do viewBox (x, y, largura, altura), quando o gerador a conhece. */
  recorte?: readonly [number, number, number, number];
}

// o JSON é gerado com quatro números por figura (o teste das figuras confere com o data-desenho de cada SVG)
const RECORTES = recortes as Record<string, number[]> as Record<string, [number, number, number, number]>;

/** 'Fig. 11' → endereço e título; null se o número não existir no acervo (o teste da memória acusa). */
export function figuraDoCard(figura: string | undefined): FiguraDoCard | null {
  const n = figura ? /(\d+)/.exec(figura)?.[1] : undefined;
  if (!n) return null;
  const f = figuras().find((x) => x.numero === Number(n));
  if (!f) return null;
  const recorte = RECORTES[f.id];
  return { url: urlDaFigura(f), titulo: `Fig. ${f.numero} — ${f.titulo}`, ...(recorte ? { recorte } : {}) };
}

/**
  O endereço da figura recortada: o fragmento svgView do próprio SVG troca o viewBox na hora de desenhar (o arquivo
  é o mesmo do modal). Quem mostra tem de dar à imagem a proporção do recorte (largura/altura), senão o desenho
  volta a ficar no meio de uma caixa 1000 × 640.
*/
export function urlRecortada(f: FiguraDoCard): string {
  if (!f.recorte) return f.url;
  const [x, y, w, h] = f.recorte;
  return `${f.url}#svgView(viewBox(${x},${y},${w},${h}))`;
}
