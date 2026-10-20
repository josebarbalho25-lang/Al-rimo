/*
  SOMBRAS DAS BARRAS — o que a armação da sapata, o corte lateral e a planta têm em comum (Jose, 15/10 na armação;
  20/10: "não temos sombra das barras no corte lateral — a vertical que sobe pelo muro e o arranque nas duas versões
  — e sombra na planta das barras nas canaletas"). A sombra é a barra tirada de dentro da peça e desenhada solta,
  grossa, ao lado do desenho: é ali que o armador lê a forma, a medida de cada perna e quantas são.

  Daqui saem: as fileiras com passo fixo (a regra do Pró-Viga, dxf-writer.js 1065–1134 — ver armacaoDaSapata.ts) e
  as MEDIDAS DAS PERNAS, os números da lista de ferros (pranchas/formaDaBarra.ts, trechosNoModelo) escritos do lado
  de fora de cada perna, longe do miolo da forma — do lado de dentro cairiam em cima da outra perna.
*/
import type { Barra, Vec2, Vec3 } from '@/modelo/tipos';
import { CORPO_DA_COTA } from '@/pranchas/tipos';
import { trechosNoModelo } from '@/pranchas/formaDaBarra';
import { Prancha, type Pt } from './prancha';

/** Toda letra das sombras: o corpo da cota, o menor que o papel aceita (2,5 mm de maiúscula na prancha). */
export const T = CORPO_DA_COTA;
/** Da linha da sombra à linha de base da legenda, do lado de fora (o Pró-Viga escreve a 8 cm, com letra de 9). */
export const LEGENDA_FORA = { embaixo: 4 + 0.85 * T, emCima: -(4 + 0.25 * T) };
/** De uma fileira de sombras à seguinte: o SHADOW_ROW do Pró-Viga (28 com letra de 9) na letra daqui. */
export const FILEIRA = 34;
/** Folga entre duas sombras lado a lado na mesma fileira (ROW_GAP_H) quando uma legenda está na ponta; entre dois
 *  traços, só o bastante para o vão aparecer (a junta de controle: ver armacaoDaSapata.ts). */
const FOLGA_NA_FILEIRA = 2 * T;
const FOLGA_ENTRE_TRACOS = 3;
/** A camada da sombra: a dela, não a do aço (a cor que a vista der vale para a sombra e não mexe na barra de dentro). */
export const CAMADA_DA_SOMBRA = 'sombras';
/** Da perna à linha de base da medida, do lado de fora. */
const AFASTA_A_MEDIDA = 4;

/** A sombra é a barra em destaque: mais grossa que a de dentro da peça (no Pró-Viga, 1,2φ contra 0,7φ). */
export const grossa = (phi: number, S: number): number => Math.max(1.8, 1.7 * phi * S);

/** O z (ou o y) do trecho reto mais comprido da barra projetada: é ele que deita na linha da sombra. */
export function zDoMaiorTrecho(pts: Vec2[]): number {
  let melhor = 0;
  let z = pts[0]?.[1] ?? 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L > melhor) [melhor, z] = [L, (pts[i][1] + pts[i - 1][1]) / 2];
  }
  return z;
}

/** O que a sombra ocupa na fileira, px: de onde a onde, e se cada ponta é o traço (ou a legenda, mais larga). */
export interface Pegada { lo: number; hi: number; loTraco: boolean; hiTraco: boolean }

function cabemLadoALado(p: Pegada, q: Pegada): boolean {
  const [e, d] = p.lo <= q.lo ? [p, q] : [q, p];
  return d.lo - e.hi >= (e.hiTraco && d.loTraco ? FOLGA_ENTRE_TRACOS : FOLGA_NA_FILEIRA);
}

/**
 * A fileira de cada sombra (0 = a mais perto da peça): a família (a barra emendada) entra inteira, a peça j na
 * fileira r0 + j, com r0 o primeiro em que todas cabem — fileira que ainda não existe conta como vazia.
 */
export function arrumarEmFileiras<S>(familias: S[][], pegada: (s: S) => Pegada): Map<S, number> {
  const fileiras: Pegada[][] = [];
  const out = new Map<S, number>();
  const cabe = (r: number, p: Pegada) => !fileiras[r] || fileiras[r].every((q) => cabemLadoALado(p, q));
  for (const fam of familias) {
    const ps = fam.map(pegada);
    let r0 = 0;
    while (!ps.every((p, j) => cabe(r0 + j, p))) r0++;
    fam.forEach((s, j) => {
      (fileiras[r0 + j] ??= []).push(ps[j]);
      out.set(s, r0 + j);
    });
  }
  return out;
}

/** Uma medida de perna pronta para escrever: o ponto da linha de base, o giro e o que ela ocupa (px). */
export interface MedidaDaPerna { p: Pt; giro: 0 | 90; texto: string; caixa: [number, number, number, number] }

/** A caixa encosta no traço? (o traço amostrado de px em px, com meio px de folga) */
function caixaNoTraco(c: readonly number[], a: Pt, b: Pt): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= n; i++) {
    const [x, y] = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n];
    if (x > c[0] - 0.5 && x < c[0] + c[2] + 0.5 && y > c[1] - 0.5 && y < c[1] + c[3] + 0.5) return true;
  }
  return false;
}

const caixasCruzam = (a: readonly number[], b: readonly number[]) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/**
 * As medidas das pernas da barra (cm, as da lista de ferros), cada uma ao lado da perna dela. O lugar de partida é
 * o do lado de FORA, no meio da perna — o lado que se afasta do miolo da forma. Quando ali o número encosta noutro
 * número ou no traço da própria barra (o nó de cachorro: a perna que desce do lado do talão corre a um φ da perna do
 * muro, e o miolo puxado para cima pela perna comprida manda o número para o lado errado), ele procura o outro lado
 * e depois anda ao longo da perna; sem lugar livre, fica no de partida. Perna em pé: o número em pé (lê de baixo para
 * cima, como a cota vertical); deitada: deitado. Barra reta (um trecho só) não leva: a medida é o C da legenda.
 * `tela` leva o ponto do modelo ao desenho; `textos` troca o número de uma perna (a faixa "45 a 63" das esperas de
 * comprimento variável, corteLateral.ts).
 */
export function medidasDasPernas(b: Barra, tela: (p: Vec3) => Pt, textos: readonly (string | undefined)[] = []): MedidaDaPerna[] {
  const trechos = trechosNoModelo(b);
  if (!trechos || trechos.length < 2) return [];
  const vs = trechos.flatMap((t) => [tela(t.a), tela(t.b)]);
  const miolo: Pt = [vs.reduce((s, p) => s + p[0], 0) / vs.length, vs.reduce((s, p) => s + p[1], 0) / vs.length];
  const traco = b.eixo.map(tela);
  const out: MedidaDaPerna[] = [];
  const livre = (c: readonly number[]) =>
    !out.some((q) => caixasCruzam(c, q.caixa)) && !traco.some((p, i) => i > 0 && caixaNoTraco(c, traco[i - 1], p));
  trechos.forEach((t, k) => {
    const [a, c] = [tela(t.a), tela(t.b)];
    const texto = textos[k] ?? String(t.cm);
    const w = Prancha.largura(texto, T);
    const emPe = Math.abs(c[1] - a[1]) > Math.abs(c[0] - a[0]);
    const ponto = (f: number): Pt => [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f];
    const meio = ponto(0.5);
    const fora = emPe ? (meio[0] >= miolo[0] ? 1 : -1) : (meio[1] >= miolo[1] ? 1 : -1);
    const candidata = (lado: number, f: number, longe: number): MedidaDaPerna => {
      const q = ponto(f);
      const d = AFASTA_A_MEDIDA + longe;
      if (emPe) {
        // em pé: o número gira 90° e a letra cresce para a esquerda da linha de base
        const x = lado > 0 ? q[0] + d + 0.85 * T : q[0] - d;
        return { p: [x, q[1]], giro: 90, texto, caixa: [x - 0.85 * T, q[1] - w / 2, 0.85 * T, w] };
      }
      const y = lado > 0 ? q[1] + d + 0.85 * T : q[1] - d;
      return { p: [q[0], y], giro: 0, texto, caixa: [q[0] - w / 2, y - 0.85 * T, w, 0.85 * T] };
    };
    // colado na perna primeiro; em 1:100 o nó de uma sapata baixa não tem perna onde o número caiba colado — ele se
    // afasta, uma e duas letras, e continua do lado da perna dele
    const ordem = [0.5, 0.3, 0.7, 0.15, 0.85];
    const tentativas = [0, T, 2 * T].flatMap((longe) => [fora, -fora].flatMap((lado) => ordem.map((f) => candidata(lado, f, longe))));
    out.push(tentativas.find((q) => livre(q.caixa)) ?? tentativas[0]);
  });
  return out;
}

/** Escreve as medidas na camada da sombra; a chave diz a sombra e a perna (o número igual em duas pernas não troca). */
export function escreverMedidas(pr: Prancha, ms: readonly MedidaDaPerna[], chave: string, dx = 0, dy = 0): void {
  ms.forEach((q, i) => pr.texto(q.p[0] + dx, q.p[1] + dy, q.texto, { tam: T, giro: q.giro, camada: CAMADA_DA_SOMBRA, chave: `${chave}:${i}` }));
}
