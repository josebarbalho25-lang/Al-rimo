/*
  ARRUMAÇÃO DE UM GRUPO DE BARRAS NUM FURO — pura (a folga vem de quem chama). Mora aqui, sozinha, porque duas
  frentes a usam e têm de concordar: o 3D (armaduras.ts, com o mapa de cavidades do muro inteiro) e a seção do
  contraforte da memória de cálculo (secaoDoContraforte.ts, com o furo comum da ponta). Se cada uma arrumasse do seu
  jeito, o "quantas barras cabem" da memória e o desenho poderiam discordar.
*/
import { COB_GRAUTE } from './contexto';

export interface Arranjo { barras: [number, number][]; esperas: [number, number][]; folga: number }

/** Folga (mm) entre a superfície de uma barra de raio `raio` centrada em (x, y) e a parede do furo; < 0 = fora. */
export type FolgaNoPonto = (x: number, y: number, raio: number) => number;

/**
 * Grupo de n barras num furo, cada uma com a sua espera AO LADO (emenda por contato), arrumadas em linhas:
 * ao longo da linha, passo 2φ (folga livre φ); entre linhas, passo 3φ (o par barra + espera ocupa 2φ). A linha
 * corre ao longo de `eixo`; o centro das BARRAS fica no alvo nas duas direções — é o que preserva o d da conta —
 * e a espera vai para o lado que couber. Tenta 1 linha, 2, 3...: fica a 1ª arrumação com 15 mm de graute; senão
 * a 1ª que cabe; senão a de maior folga.
 */
export function arrumarGrupo(folgaBarra: FolgaNoPonto, folgaEspera: FolgaNoPonto, cx: number, cy: number, n: number, phi: number, eixo: 'X' | 'Y'): Arranjo {
  let melhor: Arranjo | null = null;
  let primeiroQueCabe: Arranjo | null = null;
  for (let linhas = 1; linhas <= n; linhas++) {
    for (const [e, lado] of [[eixo, 1], [eixo, -1], [eixo === 'X' ? 'Y' : 'X', 1], [eixo === 'X' ? 'Y' : 'X', -1]] as const) {
      const porLinha = Math.ceil(n / linhas);
      if (linhas > 1 && Math.ceil(n / (linhas - 1)) === porLinha) continue;   // mesma arrumação com uma linha vazia
      const barras: [number, number][] = [];
      const esperas: [number, number][] = [];
      let resta = n;
      for (let L = 0; L < linhas && resta > 0; L++) {
        const nesta = Math.min(porLinha, resta);
        resta -= nesta;
        const atravessa = (L - (linhas - 1) / 2) * 3 * phi;
        for (let k = 0; k < nesta; k++) {
          const ao = (k - (nesta - 1) / 2) * 2 * phi;
          const pe = atravessa + lado * phi;
          barras.push(e === 'Y' ? [cx + atravessa, cy + ao] : [cx + ao, cy + atravessa]);
          esperas.push(e === 'Y' ? [cx + pe, cy + ao] : [cx + ao, cy + pe]);
        }
      }
      let folga = Infinity;
      for (const [x, y] of barras) folga = Math.min(folga, folgaBarra(x, y, phi / 2));
      for (const [x, y] of esperas) if (folga > -Infinity) folga = Math.min(folga, folgaEspera(x, y, phi / 2));
      const a: Arranjo = { barras, esperas, folga };
      if (folga >= COB_GRAUTE) return a;
      if (folga >= 0 && !primeiroQueCabe) primeiroQueCabe = a;
      if (!melhor || folga > melhor.folga) melhor = a;
    }
  }
  return primeiroQueCabe ?? melhor!;
}
