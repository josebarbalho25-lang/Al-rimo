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

//  Desde 15/10 a cor de cada Ø sai da tabela de gráficos (o Jose troca na tela);
//  estas são as de fábrica, e moram lá (desenhos/graficos.ts).
import { GRAFICOS_DE_FABRICA, graficos } from '@/desenhos/graficos';

export const CORES_DAS_BITOLAS: ReadonlyArray<readonly [number, string]> = GRAFICOS_DE_FABRICA.bitolas;

/** A cor do Ø (mm): a da bitola comercial mais próxima, na tabela em uso. */
export function corDaBitola(phi: number): string {
  const tabela = graficos().bitolas;
  let melhor = tabela[0];
  for (const c of tabela) if (Math.abs(c[0] - phi) < Math.abs(melhor[0] - phi)) melhor = c;
  return melhor[1];
}

/** "Ø6,3", "Ø10", "Ø12,5" — como a legenda da prancha. */
export function rotuloDaBitola(phi: number): string {
  return `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;
}
