/*
  JUNTAS DE CONTROLE × VÃO DE FECHAMENTO (revisão de 16/11).

  O cc7e17f deixou o último vão do muro com contrafortes ser menor (o de fechamento). Com juntas de controle, a regra de
  então repartia os vãos pela CONTAGEM (o vão a mais ia para os primeiros trechos, de vão cheio) e o nº de trechos
  oscilava — o trecho passava do "a cada X" (L 9,30 com junta a cada 6: trecho de 6,79 m) e a seta deixava de ser
  ponto fixo (5,85 → 6,10; digitando 6,10 → 6,25). A regra nova (modular.ts, arranjarComJuntas) reparte pelo
  COMPRIMENTO e escolhe o nº de trechos entre os que cabem.

  Varredura: L de 0,30 a 25,00 m de 5 em 5 cm × juntas a cada 6 / 2,5 / 4 m (e sem junta) × bloco 14 e 19 × simples
  e dobrado (e junta a cada 1 m, menor que um vão cheio). Conferências, todas pelo que sai do modular (nunca pelos intermediários):
   - PONTO FIXO: digitar o valor da seta dá o mesmo muro e nenhuma seta;
   - nenhum trecho maior que a junta, sempre que um vão cheio sozinho cabe nela (senão, nenhum maior que um vão
     cheio), e o muro não foge do digitado;
   - o comprimento fecha: a seta mostra o modular desenhado (L_real + 1 cm);
   - contra a regra de ANTES do vão de fechamento (f1ebc4f, copiada abaixo — vãos iguais, repartidos pela contagem):
     onde ela já cabia na junta, a nova não fica mais longe do digitado; e se a nova sai com os vãos todos iguais, o
     muro é o mesmo de lá.
*/
import { describe, expect, it } from 'vitest';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Aviso } from '@/modelo/tipos';
import { JUNTA } from './catalogo';
import { lerParametros } from './leitura';
import { modular, type Modulo } from './modular';

const BASES = ['aula123', 'sorteio17', 'alvo_dobrado_14x54_enterrado', 'alvo_dobrado_19x59_enterrado', 'alvo_dobrado_14x34_aparente'];
// 1,0: junta menor que um vão cheio — não há como caber; vale um vão por trecho e o muro não pode crescer
const JUNTAS: (number | null)[] = [null, 6, 2.5, 4, 1];

function mod(r: ReturnType<typeof resultadoDoGabarito>, L: number, J: number | null): Modulo {
  const av: Aviso[] = [];
  const p = lerParametros(r, J === null ? { L_total: L } : { L_total: L, junta_cada: J }, av);
  return modular(p, av);
}

/** Vãos de eixo a eixo, pano a pano (no dobrado o vão é o do pano). */
function vaosDe(m: Modulo): number[] {
  const out: number[] = [];
  for (const tr of m.trechos) for (const pn of tr.panos ?? [tr]) for (let k = 0; k + 1 < pn.nos.length; k++) out.push(pn.nos[k + 1].xs - pn.nos[k].xs);
  return out;
}

/** A regra de f1ebc4f (muro simples com juntas): N vãos iguais, nº de trechos pelo desenhado, repartidos pela contagem. */
function regraDeAntes(L: number, J: number, l_cf: number, Wn: number): { comprimentos: number[]; vaosPorTrecho: number[]; modular: number } {
  const b = Wn - JUNTA;
  const qt = (x: number): number => (J > 0 ? Math.max(1, Math.ceil(x / J - 1e-6)) : 1);
  const vaos = (n: number): number => Math.max(n, Math.round((L - n * Wn) / l_cf));
  let nT = qt(L - JUNTA);
  for (let i = 0; i < 4; i++) {
    const outro = qt(vaos(nT) * l_cf + nT * Wn - JUNTA);
    if (outro === nT) break;
    nT = outro;
  }
  const N = vaos(nT);
  const base = Math.floor(N / nT);
  const extra = N % nT;
  const vaosPorTrecho = Array.from({ length: nT }, (_, k) => base + (k < extra ? 1 : 0));
  return { comprimentos: vaosPorTrecho.map((nv) => nv * l_cf + b), vaosPorTrecho, modular: N * l_cf + nT * Wn };
}

describe('juntas de controle com vão de fechamento', () => {
  for (const c of BASES) {
    it(c, () => {
      const r = resultadoDoGabarito(c);
      const falhas: string[] = [];
      let casos = 0;
      for (const J of JUNTAS) {
        for (let i = 0; i <= 494; i++) {
          const L = Math.round((0.3 + i * 0.05) * 100) / 100;
          const m = mod(r, L, J);
          casos++;
          const tag = `L=${L} J=${J}`;
          const dob = m.l_pano !== undefined;
          const lCheio = dob ? (m.l_pano as number) : m.l_cf;
          const modularL = (m.L_real + JUNTA) / 1000;

          // o comprimento fecha: trechos encadeados com 1 cm de junta e a seta = modular desenhado
          const fim = m.trechos[m.trechos.length - 1].x1;
          if (Math.abs(fim - m.L_real) > 1e-6) falhas.push(`${tag}: L_real ${m.L_real} ≠ fim do último trecho ${fim}`);
          m.trechos.forEach((tr, k) => {
            if (k > 0 && Math.abs(tr.x0 - (m.trechos[k - 1].x1 + JUNTA)) > 1e-6) falhas.push(`${tag}: trecho ${k + 1} não começa 1 cm depois do anterior`);
          });
          const aj = m.ajustes.find((a) => a.nome === 'L_total');
          if (aj && Math.abs(aj.para - modularL) > 1e-9) falhas.push(`${tag}: seta ${aj.para} ≠ modular ${modularL}`);
          if (!aj && Math.abs(modularL - L) > 1e-6) falhas.push(`${tag}: sem seta e o modular é ${modularL}`);

          // ponto fixo
          const m2 = mod(r, modularL, J);
          if (m2.ajustes.some((a) => a.nome === 'L_total')) falhas.push(`${tag}: a seta ${modularL} não é ponto fixo`);
          if (m2.L_real !== m.L_real || m2.trechos.length !== m.trechos.length || vaosDe(m2).join() !== vaosDe(m).join()) {
            falhas.push(`${tag}: digitar ${modularL} muda o muro`);
          }

          if (J === null) continue;
          // nenhum trecho maior que a junta, sempre que um vão cheio sozinho cabe nela
          const larguraDeUmVao = dob ? lCheio + 2 * m.Wn - 2 * JUNTA : lCheio + m.Wn - JUNTA;
          const maior = Math.max(...m.trechos.map((tr) => tr.x1 - tr.x0));
          if (maior > Math.max(J * 1000, larguraDeUmVao) + 0.5) falhas.push(`${tag}: trecho de ${maior} mm > junta (e > um vão cheio)`);
          if (Math.abs(modularL - L) > lCheio / 1000 + 0.5) falhas.push(`${tag}: ${modularL} longe demais do digitado`);

          // contra a regra de antes (só o simples: o dobrado não existia)
          if (dob) continue;
          const antes = regraDeAntes(L * 1000, J * 1000, m.l_cf, m.Wn);
          const cabiaAntes = antes.comprimentos.every((x) => x <= J * 1000 + 0.5);
          if (!cabiaAntes) continue;
          const dNova = Math.abs(modularL * 1000 - L * 1000);
          const dAntes = Math.abs(antes.modular - L * 1000);
          if (dNova > dAntes + 1e-6) falhas.push(`${tag}: ${modularL} mais longe que a regra de antes (${antes.modular / 1000})`);
          const vs = vaosDe(m);
          // o digitado já fechava com vãos iguais e cabia: o mesmo muro de antes, sem seta
          if (Math.abs(antes.modular - L * 1000) < 1e-6 && (vs.some((v) => Math.abs(v - m.l_cf) >= 0.5) || aj)) {
            falhas.push(`${tag}: fechava com vãos iguais e cabia, mas mudou (${vs})`);
          }
          if (vs.every((v) => Math.abs(v - m.l_cf) < 0.5) && Math.abs(antes.modular / 1000 - modularL) < 1e-9) {
            const porTrecho = m.trechos.map((tr) => tr.nos.length - 1);
            if (porTrecho.join() !== antes.vaosPorTrecho.join()) falhas.push(`${tag}: vãos iguais e outro arranjo que o de antes (${porTrecho} × ${antes.vaosPorTrecho})`);
          }
        }
      }
      expect(casos).toBe(495 * JUNTAS.length);
      expect(falhas.slice(0, 20)).toEqual([]);
    }, 120_000);
  }
});

describe('os casos da revisão', () => {
  it('sorteio17, L 9,30, junta a cada 6: nenhum trecho passa de 6 m, o do fechamento leva o vão a mais', () => {
    const m = mod(resultadoDoGabarito('sorteio17'), 9.3, 6);
    for (const tr of m.trechos) expect(tr.x1 - tr.x0).toBeLessThanOrEqual(6000);
    // o último trecho tem o(s) vão(s) de fechamento e é o que tem mais vãos
    const porTrecho = m.trechos.map((tr) => tr.nos.length - 1);
    expect(porTrecho[porTrecho.length - 1]).toBe(Math.max(...porTrecho));
  });

  it('aula123, L 5,85, junta a cada 6: a seta é ponto fixo', () => {
    const r = resultadoDoGabarito('aula123');
    const m = mod(r, 5.85, 6);
    const M = (m.L_real + JUNTA) / 1000;
    const m2 = mod(r, M, 6);
    expect(m2.ajustes.find((a) => a.nome === 'L_total')).toBeUndefined();
    expect(vaosDe(m2)).toEqual(vaosDe(m));
    for (const tr of m.trechos) expect(tr.x1 - tr.x0).toBeLessThanOrEqual(6000);
  });
});
