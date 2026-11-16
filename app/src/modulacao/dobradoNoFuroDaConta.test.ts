/*
  CONTRAFORTE DOBRADO: AS BARRAS NO FURO DA CONTA (revisão de 16/11). No dobrado APARENTE a ponta do gancho de 135°
  do estribo do par caía sobre o furo da conta (o lado do muro é a face tracionada) e as barras da metade da esquerda
  fugiam para o furo da ponta da haste, sem aviso — 14×34 desenhado a d 9,5 cm com a conta em 27. Os ganchos agora vão
  para o canto comprimido (armaduras.ts, estribosDaJunta com ganchosNaPonta). O que se confere em TODO dobrado do
  gabarito (enterrado e aparente, blocos 14 e 19, os dois comprimentos) com 2 e com 4 ramos:
   - o d desenhado do grupo de barras principais de cada metade é o d da conta (até 3 mm: o arranjo arredonda);
   - as duas metades são o espelho uma da outra (mesmo d, mesma distância ao eixo do bloco);
   - nenhum aviso de barra fora do furo ou que não cabe — se um dia não couber, o modelo tem de dizer.
  E a memória (desenhoDaSecaoCf.ts) desenha as barras onde o 3D as põe (até 1 mm), pela mesma regra (arranjoNoDobrado).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, comEntradas, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from './index';
import { arranjoNoDobrado } from './armaduras';
import { secaoDoContraforte } from './secaoDoContraforte';

const DOBRADOS = cenariosDoGabarito().filter((c) => c.startsWith('alvo_dobrado'));
const modelo = (r: Resultado, extras: Record<string, Valor> = {}): Modelo => gerarModelo(r, { ...padroesDoModelo(), ...extras });

describe('contraforte dobrado: barras no furo da conta, nas duas metades', () => {
  for (const c of DOBRADOS) for (const ramos of [2, 4]) {
    it(`${c} · ${ramos} ramos`, () => {
      const r0 = resultadoDoGabarito(c);
      // 4 ramos forçado só onde a planilha deixaria (as barras de cada bloco cabem fora dos ramos do meio)
      const porBloco = r0.num('dob_cf') === 1 ? r0.num('n_cf')! / 2 : r0.num('n_cf')!;
      if (ramos === 4 && porBloco > r0.num('nb4d_cab')!) return;
      const r = comEntradas(r0, r0.num('dob_cf') === 1 ? { ram_ef: ramos } : { ram_o: ramos });
      const m = modelo(r);
      const t = m.familia.t;
      const enterrado = String(r.v('pos_cf')).startsWith('Ente');
      const tenr = r.num('tenr_adot')! * 10;
      const dConta = r.num('d_cf')! * 10;
      const dDe = (y: number) => (enterrado ? y : tenr - (t - y));
      const avisos = m.avisos.filter((a) => a.codigo === 'BARRAS_FORA_DO_FURO' || a.codigo === 'BARRAS_NAO_CABEM' || a.codigo === 'BARRAS_EM_MAIS_FUROS');
      expect(avisos.map((a) => a.texto), c).toEqual([]);
      let pares = 0;
      m.dims.contrafortes.forEach((q, k) => {
        if (!q.dobrado) return;
        pares++;
        const ps = m.barras.filter((b) => b.papel === 'CF_PRINCIPAL' && b.contraforte === k + 1);
        const a = ps.filter((b) => b.eixo[0][0] < q.x);
        const b = ps.filter((b) => b.eixo[0][0] > q.x);
        expect(a.length, `C${k + 1}`).toBe(b.length);
        const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
        const dA = media(a.map((x) => dDe(x.eixo[0][1])));
        const dB = media(b.map((x) => dDe(x.eixo[0][1])));
        expect(Math.abs(dA - dConta), `C${k + 1} metade a: d ${dA} × ${dConta}`).toBeLessThanOrEqual(3);
        expect(Math.abs(dB - dConta), `C${k + 1} metade b: d ${dB} × ${dConta}`).toBeLessThanOrEqual(3);
        // as duas metades com o mesmo arranjo: a distância de cada barra ao eixo do SEU bloco, e o d
        const meio = (t + 10) / 2;
        const assinatura = (xs: typeof ps, xb: number) => xs.map((x) => [Math.round(Math.abs(x.eixo[0][0] - xb)), Math.round(dDe(x.eixo[0][1]))].join(',')).sort();
        expect(assinatura(a, q.x - meio), `C${k + 1} as duas metades`).toEqual(assinatura(b, q.x + meio));
      });
      expect(pares, c).toBeGreaterThan(0);
    }, 60_000);
  }

  it('a memória desenha as barras do dobrado onde o 3D as põe (até 1 mm)', () => {
    let vistos = 0;
    for (const c of DOBRADOS) {
      const r = resultadoDoGabarito(c);
      if (r.num('dob_cf') !== 1) continue;
      const m = modelo(r);
      const t = m.familia.t;
      const familia = t === 190 ? '19x39' : '14x39';
      const enterrado = String(r.v('pos_cf')).startsWith('Ente');
      const tenr = r.num('tenr_adot')! * 10;
      const sec = secaoDoContraforte(familia, tenr, enterrado ? 'enterrado' : 'aparente', 'L');
      const ramos = r.num('ram_ef') === 4 ? 4 : 2;
      const nBloco = r.num('n_cf')! / 2;
      const mem = arranjoNoDobrado(sec, r.num('c_cf')! * 10, nBloco, r.num('phi_cf')!, ramos, r.num('phi_est')!);
      // η da seção (da face externa do muro) e x do eixo do par, nos dois
      const etaDe = (y: number) => (enterrado ? y : t - y);
      const q = m.dims.contrafortes.find((x) => x.dobrado)!;
      const k = m.dims.contrafortes.indexOf(q);
      const doModelo = m.barras.filter((b) => b.papel === 'CF_PRINCIPAL' && b.contraforte === k + 1)
        .map((b) => [b.eixo[0][0] - q.x, etaDe(b.eixo[0][1])] as [number, number]);
      const daMemoria = mem.flatMap((g) => g.arranjo.barras as [number, number][]);
      expect(daMemoria.length, c).toBe(doModelo.length);
      // EXCEÇÃO conhecida (anotada no caderno): com 14 barras por bloco no aparente a fila chega na parede do bloco do
      // muro no nó do par, que não é a do gabarito de ponta da seção — o 3D e a memória ficam a ~1 cm um do outro
      const tol = c === 'alvo_dobrado_4ramos_barras_demais' ? 12 : 1;
      for (const [x, e] of daMemoria) {
        const perto = Math.min(...doModelo.map(([xm, em]) => Math.hypot(xm - x, em - e)));
        expect(perto, `${c}: barra da memória em (${x}, ${e})`).toBeLessThanOrEqual(tol);
      }
      vistos++;
    }
    expect(vistos).toBeGreaterThan(3);
  }, 120_000);
});
