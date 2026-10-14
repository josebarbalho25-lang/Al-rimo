// ═══════════════════════════════════════════════════════════════════════════
//  ui/icones.tsx — os ícones da casca
// ---------------------------------------------------------------------------
//  A régua é a do A-PORT (src/iconesBase.tsx), copiada para o Al-rimo ser da
//  mesma família: grade de 24, traço 1,75, tudo em `currentColor`
//  (monocromático — cor no ícone briga com a cor dos DADOS: passa/não passa).
//  Peça tem corpo (MASSA, miolo pintado de leve); linha é linha.
//  Os da barra de cima (novo, abrir, salvar, tema, engrenagem) e o 3D são cópias exatas
//  dos de lá, porque a mão dele já sabe onde clicar. Os novos são do muro.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactElement, SVGProps } from 'react';

export type PropsDoIcone = SVGProps<SVGSVGElement> & { tamanho?: number };
export type Icone = (p: PropsDoIcone) => ReactElement;

/** O traço da família, na grade de 24. */
export const TRACO = 1.75;
/** O corpo da peça: o miolo pintado de leve, na cor do traço. */
export const MASSA = { fill: 'currentColor', fillOpacity: 0.22 } as const;

export function Svg({ tamanho = 16, children, ...resto }: PropsDoIcone) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={TRACO}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...resto}
    >
      {children}
    </svg>
  );
}

/** A ponta de seta cheia, com o bico em (x, y). */
function Ponta({ x, y, graus, l = 5, a = 4.5 }: { x: number; y: number; graus: number; l?: number; a?: number }) {
  return (
    <path
      d={`M${x} ${y}l${-a} ${-l / 2}v${l}z`}
      transform={graus ? `rotate(${graus} ${x} ${y})` : undefined}
      fill="currentColor"
      strokeWidth={1}
    />
  );
}

/* ── a barra de cima (cópias do A-PORT) ───────────────────────────────── */

export const IconeNovo = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M6 3.5h7l5 5v12H6z" />
    <path d="M13 3.5v5h5" />
    <path d="M12 12v6M9 15h6" />
  </Svg>
);

/** O muro de exemplo (aula 12.2): um livro aberto. */
export const IconeExemplo = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3.5 6c3-1 6-1 8.5 1 2.5-2 5.5-2 8.5-1v12.5c-3-1-6-1-8.5 1-2.5-2-5.5-2-8.5-1z" />
    <path d="M12 7v12.5" />
  </Svg>
);

export const IconeAbrir = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3.5 6.5h6l2 2.5h9v10h-17z" />
  </Svg>
);

export const IconeSalvar = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M4.5 4.5h11L19.5 8.5v11h-15z" />
    <path d="M8 4.5v5h7v-5M8 19.5v-6h8v6" />
  </Svg>
);

export const IconeTema = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 108.5 8.5 6.6 6.6 0 01-8.5-8.5z" />
  </Svg>
);

export const IconeEngrenagem = (p: PropsDoIcone) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 00.32 1.77l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.6 1.6 0 00-1.77-.32 1.6 1.6 0 00-.97 1.47V21a2 2 0 11-4 0v-.1A1.6 1.6 0 009.1 19.4a1.6 1.6 0 00-1.77.32l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.6 1.6 0 004.82 15a1.6 1.6 0 00-1.47-.97H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9.1a1.6 1.6 0 00-.32-1.77l-.06-.06a2 2 0 112.83-2.83l.06.06A1.6 1.6 0 009 4.82h.08A1.6 1.6 0 0010 3.35V3a2 2 0 114 0v.1a1.6 1.6 0 00.97 1.47 1.6 1.6 0 001.77-.32l.06-.06a2 2 0 112.83 2.83l-.06.06A1.6 1.6 0 0019.18 9v.08a1.6 1.6 0 001.47.97H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5.95z" />
  </Svg>
);

export const Chevron = (p: PropsDoIcone) => (
  <Svg tamanho={14} {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

/** Exportar o modelo (IFC): o sólido com a seta saindo. */
export const IconeExportar = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M10 8.5l5.5 2.75v6.5L10 20.5l-5.5-2.75v-6.5z" {...MASSA} />
    <path d="M4.5 11.25L10 14l5.5-2.75M10 14v6.5" />
    <path d="M14.5 9.5l6-6" />
    <Ponta x={20.5} y={3.5} graus={-45} l={4.6} a={4.2} />
  </Svg>
);

/** Imprimir a memória: a impressora com a folha. */
export const IconeImprimir = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M7 8.5v-5h10v5" />
    <path d="M7 17H4.5V8.5h15V17H17" />
    <path d="M7 13.5h10v7H7z" {...MASSA} />
  </Svg>
);

/** O botão da figura de referência: a moldura com a paisagem. */
export const IconeFigura = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3.5 5h17v14h-17z" />
    <path d="M3.5 16.5l5-5 4.5 4.5 2.5-2.5 5 5" />
    <circle cx="15.5" cy="9" r="1.6" />
  </Svg>
);

/** O Termo de Uso: a folha com o visto. Folha como o "Novo", para ser da mesma família. */
export const IconeTermo = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M6 3.5h9l3 3v14H6z" />
    <path d="M9 8.5h5M9 11.5h6" />
    <path d="M9 16l2 2 4-4.5" />
  </Svg>
);

/** O aviso ao lado do campo (c' > 0…): a placa triangular de obra com o ponto de exclamação. */
export const IconeAlerta = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 3.75L21 19.5H3z" />
    <path d="M12 9.5v4.5" />
    <path d="M12 16.75v.01" strokeWidth={2.4} />
  </Svg>
);

export const IconeFechar = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

/* ── as abas do palco ─────────────────────────────────────────────────── */

/** 3D: o cubo com a volta da órbita (o mesmo do A-PORT). */
export const Icone3D = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 3.5l5 2.5v6l-5 2.5L7 12V6z" {...MASSA} />
    <path d="M7 6l5 2.5L17 6M12 8.5v6" />
    <path d="M3 13.5a9 4.5 0 0 0 18 0" />
    <Ponta x={21} y={9.5} graus={270} l={4.4} a={4} />
  </Svg>
);

/** Vista frontal: o pano de alvenaria com as fiadas em amarração. */
export const IconeFrontal = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3.5 5.5h17v13h-17z" />
    <path d="M3.5 9.83h17M3.5 14.17h17" />
    <path d="M9 5.5v4.33M15 5.5v4.33M6 9.83v4.34M12 9.83v4.34M18 9.83v4.34M9 14.17v4.33M15 14.17v4.33" />
  </Svg>
);

/** Corte: a seção do muro sobre a sapata (o T de cabeça para baixo). */
export const IconeCorteDoMuro = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M10 3.5h4v12h6.5v5h-17v-5H10z" {...MASSA} />
  </Svg>
);

/** Planta: o muro visto de cima, com dois contrafortes. */
export const IconePlantaDoMuro = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3 8h18v3.5H3z" {...MASSA} />
    <path d="M6.5 11.5V17H9v-5.5M15 11.5V17h2.5v-5.5" />
  </Svg>
);

/** Isométrico: o cubo em linha, sem corpo — é desenho, não sólido. */
export const IconeIsometrico = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M12 3.5l7.5 3.75v9.5L12 20.5l-7.5-3.75v-9.5z" />
    <path d="M4.5 7.25L12 11l7.5-3.75M12 11v9.5" />
  </Svg>
);

/** Memória de cálculo: a folha com as linhas da conta (o mesmo do memorial do A-PORT). */
export const IconeMemoria = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
    <path d="M15 3.5V7h3.5" />
    <path d="M8.75 11h7M8.75 14h7M8.75 17h4.5" />
  </Svg>
);

/** Quantitativo: a tabela com a grade. */
export const IconeQuantitativo = (p: PropsDoIcone) => (
  <Svg {...p}>
    <path d="M3.5 5h17v14h-17z" />
    <path d="M3.5 9.5h17M3.5 14.25h17M9.5 5v14" />
  </Svg>
);
