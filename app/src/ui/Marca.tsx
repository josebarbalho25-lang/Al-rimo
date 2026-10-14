// ═══════════════════════════════════════════════════════════════════════════
//  ui/Marca.tsx — a logomarca do Al-rimo
// ---------------------------------------------------------------------------
//  Escolhida pelo Jose em 14/10, na linha da do Pró-Viga (quadrado azul-marinho
//  #0D1B4B, traço branco de ponta redonda, medidas de Fibonacci): o MURO (traço
//  vertical) passando da base para baixo como o DENTE da sapata, a BASE
//  (sapata) e o EMPUXO em três traços que crescem com a profundidade. A folga
//  entre os traços e o muro é 10 — o de cima vira quase um ponto, como o
//  empuxo, que nasce zero no topo.
//
//  ⚠️ Um desenho só: os SVG de `public/marca/` (ícone da aba, e o do instalador
//  quando o programa for empacotado) repetem estes números, e o teste
//  `marca.test.ts` confere que não se separaram.
// ═══════════════════════════════════════════════════════════════════════════

export const AZUL_DA_MARCA = '#0D1B4B';

/** Os traços, no quadrado 100 × 100: [x1, y1, x2, y2]. */
export const TRACOS_DA_MARCA: ReadonlyArray<readonly [number, number, number, number]> = [
  [34, 13, 34, 86],    // muro, com o dente abaixo da base
  [21, 76, 79, 76],    // base (sapata)
  [44, 31, 47, 31],    // empuxo no topo (quase zero)
  [44, 47, 56, 47],
  [44, 63, 66, 63],    // empuxo embaixo
];

/**
 * A marca. `traco` engrossa nos tamanhos pequenos (3,5 na tela grande; 5 no ícone de 32 px; 7 no de 16 px), senão o
 * traço some; `cantos` arredonda o quadrado (ícone de programa) ou deixa reto (dentro da interface, como o Pró-Viga).
 */
export function MarcaAlrimo({ traco = 3.5, cantos = 0 }: { traco?: number; cantos?: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden="true">
      <rect width="100" height="100" rx={cantos} fill={AZUL_DA_MARCA} />
      <g stroke="#FFFFFF" strokeWidth={traco} strokeLinecap="round" fill="none">
        {TRACOS_DA_MARCA.map(([x1, y1, x2, y2], k) => (
          <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}
