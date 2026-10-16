/*
  O ENCAIXE DOS DESENHOS NA FOLHA (Jose, 16/10: "preciso de snap pros desenhos na prancha pra conseguir posicionar
  eles alinhados"). Arrastando um desenho, as bordas e o meio dele grudam nas bordas e no meio dos outros desenhos,
  na moldura e no começo do quadro lateral e do carimbo — a guia aparece na linha em que grudou. Perto de nada, ele
  anda livre; com Alt apertado, sem ímã (o jeito dos programas de desenho). Só a caixa do desenho conta (a que
  prende ele na folha): a chamada solta ou a cota arrastada para fora não desalinham nada.
*/

export type Caixa = readonly [number, number, number, number];

export interface Encaixe {
  /** O quanto somar ao deslocamento para grudar (0 = não grudou naquele eixo). */
  dx: number;
  dy: number;
  /** A linha em que grudou, mm de papel (a guia), em cada eixo. */
  gx?: number;
  gy?: number;
}

/**
 * Onde `caixa` gruda: o par (linha do desenho, linha alvo) mais perto, até `tol` mm, em cada eixo. As linhas do
 * desenho são a borda de um lado, o meio e a borda do outro; os alvos, as mesmas dos `outros` desenhos e as linhas
 * soltas (`linhasX`, `linhasY`: moldura, quadro, carimbo).
 */
export function encaixar(caixa: Caixa, outros: readonly Caixa[], linhasX: readonly number[], linhasY: readonly number[], tol: number): Encaixe {
  const [x, y, w, h] = caixa;
  const minhasX = [x, x + w / 2, x + w];
  const minhasY = [y, y + h / 2, y + h];
  const alvosX = [...linhasX, ...outros.flatMap(([ox, , ow]) => [ox, ox + ow / 2, ox + ow])];
  const alvosY = [...linhasY, ...outros.flatMap(([, oy, , oh]) => [oy, oy + oh / 2, oy + oh])];
  const melhor = (minhas: number[], alvos: number[]): { d: number; g?: number } => {
    let r: { d: number; g?: number } = { d: 0 };
    let dist = tol;
    for (const a of alvos) {
      for (const m of minhas) {
        const d = a - m;
        if (Math.abs(d) <= dist) {
          dist = Math.abs(d);
          r = { d, g: a };
        }
      }
    }
    return r;
  };
  const ex = melhor(minhasX, alvosX);
  const ey = melhor(minhasY, alvosY);
  const e: Encaixe = { dx: ex.d, dy: ey.d };
  if (ex.g !== undefined) e.gx = ex.g;
  if (ey.g !== undefined) e.gy = ey.g;
  return e;
}
