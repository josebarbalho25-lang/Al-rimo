/*
  A FIGURA DO CARD — o mesmo acervo do botão de imagem das entradas (dados/figuras.json, via '@/figuras/mapa').
  O card guarda só 'Fig. 11'; quem resolve o endereço e o título é o mapa da frente das figuras, para que a
  memória e o formulário nunca mostrem desenhos diferentes com o mesmo número.
*/
import { figuras, urlDaFigura } from '@/figuras/mapa';

export interface FiguraDoCard {
  url: string;
  /** 'Fig. 11 — Pressões no muro' */
  titulo: string;
}

/** 'Fig. 11' → endereço e título; null se o número não existir no acervo (o teste da memória acusa). */
export function figuraDoCard(figura: string | undefined): FiguraDoCard | null {
  const n = figura ? /(\d+)/.exec(figura)?.[1] : undefined;
  if (!n) return null;
  const f = figuras().find((x) => x.numero === Number(n));
  return f ? { url: urlDaFigura(f), titulo: `Fig. ${f.numero} — ${f.titulo}` } : null;
}
