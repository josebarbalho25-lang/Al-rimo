// ═══════════════════════════════════════════════════════════════════════════
//  visor/icones.tsx — os ícones da barra do visor
// ---------------------------------------------------------------------------
//  Mesma régua da família do A-PORT (`iconesBase.tsx`): grade de 24, traço de
//  1,75, peça com miolo pintado de leve (MASSA), o que some tracejado (SOME),
//  monocromático (`currentColor`). Ajustar, Corte, Olho, Cubo e Planta são os
//  do A-PORT; Frente, Lateral, Raio-X, Foto e Prancha são novos, na mesma régua.
// ═══════════════════════════════════════════════════════════════════════════

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { tamanho?: number };

const MASSA = { fill: 'currentColor', fillOpacity: 0.22 } as const;
const CHEIO = { fill: 'currentColor', stroke: 'none' } as const;
const SOME = { strokeDasharray: '2.4 2', strokeLinecap: 'butt' } as const;

function Svg({ tamanho = 17, children, ...resto }: P) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
      {children}
    </svg>
  );
}

/** Frente: a fachada do muro, fiadas em amarração. */
export const IconeFrente = (p: P) => (
  <Svg {...p}>
    <path d="M3 5.5h18v14H3z" {...MASSA} />
    <path d="M3 10.2h18M3 14.8h18M9 5.5v4.7M15 5.5v4.7M6 10.2v4.6M12 10.2v4.6M18 10.2v4.6M9 14.8v4.7M15 14.8v4.7" />
  </Svg>
);

/** Lateral: o perfil do arrimo — haste, sapata e o solo do lado de trás. */
export const IconeLateral = (p: P) => (
  <Svg {...p}>
    <path d="M9 4h3.5v13H9z" {...MASSA} />
    <path d="M4 17h16v3H4z" {...MASSA} />
    <path d="M12.5 6.5H21" {...SOME} />
    <path d="M15 9.5l3-3M15 13.5l6-6M15 17l6-6" opacity={0.42} />
  </Svg>
);

/** Topo: a planta (do A-PORT). */
export const IconeTopo = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 3.5h17v17h-17z" />
    <path d="M3.5 10h9M12.5 10v10.5M16 3.5v6.5" />
  </Svg>
);

/** Isométrica: o cubo liso (do A-PORT). */
export const IconeIso = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l8 4-8 4-8-4z" {...MASSA} />
    <path d="M4 7v9.5l8 4 8-4V7M12 11v9.5" />
  </Svg>
);

/** Enquadrar: o modelo inteiro na janela (o Ajustar do A-PORT). */
export const IconeEnquadrar = (p: P) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="1" {...MASSA} />
  </Svg>
);

/** Mostrar/ocultar: o olho (Visibilidade do A-PORT). */
export const IconeCamadas = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="1.2" {...CHEIO} />
  </Svg>
);

/** Armadura: o bloco apagado atrás e duas barras por cima, uma com a dobra (o "desobstruído" do Revit). */
export const IconeArmadura = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 5.5h17v13h-17z" {...SOME} />
    <path d="M9 3v18" strokeWidth={2.2} />
    <path d="M15 3v14a3 3 0 0 0 3 3h3" strokeWidth={2.2} />
  </Svg>
);

/** Corte: a linha tracejada com as duas pontas (o do Pró-Viga, via A-PORT). */
export const IconeCorte = (p: P) => (
  <Svg {...p}>
    <path d="M12 2v20" strokeDasharray="3.5 2" strokeLinecap="butt" />
    <path d="M9 5l3-3 3 3M9 19l3 3 3-3" />
  </Svg>
);

/** Foto: a câmera. */
export const IconeFoto = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h4l1.6-2.5h6.8L17 8h4v11.5H3z" {...MASSA} />
    <circle cx="12" cy="13.5" r="3.4" />
  </Svg>
);

/**
 * Enviar para a prancha: a folha deitada com o carimbo no canto (é o que faz uma folha ser prancha) e a seta
 * descendo para dentro dela.
 */
export const IconePrancha = (p: P) => (
  <Svg {...p}>
    <path d="M3 7.5h18v12.5H3z" />
    <path d="M14.5 16h6.5v4h-6.5z" {...MASSA} />
    <path d="M9 2.5v9.5" />
    <path d="M5.75 8.75L9 12l3.25-3.25" />
  </Svg>
);

/** Fechar (limpar a seleção). */
export const IconeFechar = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

/** A alça do corte: setas para os dois lados ao longo do muro. */
export const IconeArrastar = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h16" />
    <path d="M7.5 8.5L4 12l3.5 3.5M16.5 8.5L20 12l-3.5 3.5" />
  </Svg>
);

/** Estilo Cores: a fiada em amarração com cada peça num tom — é a modulação que este estilo mostra. */
export const IconeEstiloCores = (p: P) => (
  <Svg {...p}>
    <path d="M3 6h11v5.5H3z" {...CHEIO} />
    <path d="M14 6h7v5.5h-7z" {...MASSA} />
    <path d="M3 11.5h5v6.5H3z" {...MASSA} />
    <path d="M8 11.5h13v6.5H8z" fill="currentColor" fillOpacity={0.55} />
    <path d="M3 6h18v12H3zM3 11.5h18M14 6v5.5M8 11.5V18" />
  </Svg>
);

/** Estilo Realista: a esfera com luz e sombra — o ícone de "renderizado" que todo programa de 3D usa. */
export const IconeEstiloRealista = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M18.6 6.7A8.5 8.5 0 0 1 6.7 18.6 7 7 0 0 0 18.6 6.7z" {...CHEIO} opacity={0.75} />
    <circle cx="9" cy="9" r="1.6" {...CHEIO} opacity={0.35} />
  </Svg>
);

/** Estilo Opaco: o bloco só de contorno, sem massa — o linha oculta da prancha. */
export const IconeEstiloOpaco = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l8 4-8 4-8-4z" />
    <path d="M4 7v9.5l8 4 8-4V7M12 11v9.5" />
  </Svg>
);
