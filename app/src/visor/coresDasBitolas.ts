// ═══════════════════════════════════════════════════════════════════════════
//  visor/coresDasBitolas.ts — a cor de cada Ø no modo Armadura
// ---------------------------------------------------------------------------
//  As cores do Jose, lidas no Revit dele pelo conector (14/10/2026): projeto
//  "Casa F.", vista "Iso Escada", filtros "Barra 5.0 mm" … "Barra 16.0 mm"
//  (cor do padrão de superfície), e a legenda "LEGENDA CORES VERGALHÕES" da
//  prancha. A mesma linguagem das pranchas dele: a obra reconhece o Ø pela cor.
//  Ø20 e Ø25 não estão no padrão dele (só a sapata pode usar): amarelo e azul,
//  PROVISÓRIOS até ele dizer.
// ═══════════════════════════════════════════════════════════════════════════

export const CORES_DAS_BITOLAS: ReadonlyArray<readonly [number, string]> = [
  [5, '#00ffff'],
  [6.3, '#00ff00'],
  [8, '#ff8000'],
  [10, '#ff0000'],
  [12.5, '#ff00ff'],
  [16, '#8000ff'],
  [20, '#ffff00'],
  [25, '#0080ff'],
];

/** A cor do Ø (mm): a da bitola comercial mais próxima. */
export function corDaBitola(phi: number): string {
  let melhor = CORES_DAS_BITOLAS[0];
  for (const c of CORES_DAS_BITOLAS) if (Math.abs(c[0] - phi) < Math.abs(melhor[0] - phi)) melhor = c;
  return melhor[1];
}

/** "Ø6,3", "Ø10", "Ø12,5" — como a legenda da prancha. */
export function rotuloDaBitola(phi: number): string {
  return `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;
}
