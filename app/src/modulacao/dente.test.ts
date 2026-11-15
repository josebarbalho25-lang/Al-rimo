/*
  PROVA DA ARMADURA DO DENTE (15/11) — o estribo em pé e as longitudinais de montagem, lidos só do Modelo, em todos os
  cenários do gabarito que têm dente (dos dois lados do muro, com o espaçamento automático e o digitado).
  Que nenhuma barra atravessa bloco, canaleta ou drenagem está em modulacao.test.ts (barrasEmPecaSolida).
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Barra, Modelo } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from './index';

const CENARIOS = cenariosDoGabarito();
const comDente = CENARIOS.filter((c) => resultadoDoGabarito(c).v('tem_den') === 'Sim');
const semDente = CENARIOS.filter((c) => resultadoDoGabarito(c).v('tem_den') !== 'Sim');

const doDente = (m: Modelo): Barra[] => m.barras.filter((b) => b.papel === 'DENTE_ESTRIBO' || b.papel === 'DENTE_LONG');
const xDe = (b: Barra): number => b.eixo.reduce((s, p) => s + p[0], 0) / b.eixo.length;

describe('armadura do dente', () => {
  it('o gabarito tem dente dos dois lados do muro e muro sem dente', () => {
    const lados = new Set(comDente.map((c) => resultadoDoGabarito(c).v('lado_den')));
    expect(lados).toEqual(new Set(['Ponta', 'Talão']));
    expect(semDente.length).toBeGreaterThan(0);
  });

  it('sem dente não há barra de dente', () => {
    for (const c of semDente) expect(doDente(gerarModelo(resultadoDoGabarito(c), padroesDoModelo())).length, c).toBe(0);
  });

  for (const c of comDente) {
    it(`${c}: estribos no espaçamento da conta, longitudinais na quantidade da conta, tudo dentro do concreto`, () => {
      const r = resultadoDoGabarito(c);
      const num = (n: string) => r.num(n)!;
      for (const extras of [padroesDoModelo(), { ...padroesDoModelo(), L_total: 20, junta_cada: 6, sap_transv: 'Reta', arranque: 'Nó de cachorro' }]) {
        const m = gerarModelo(r, extras);
        const estribos = m.barras.filter((b) => b.papel === 'DENTE_ESTRIBO');
        const longs = m.barras.filter((b) => b.papel === 'DENTE_LONG');
        const c0 = num('cob_sap') * 10;
        const [B, h, bd, hd, xd] = ['B_sap', 'h_sap', 'b_den', 'h_den', 'x_den'].map((n) => num(n) * 1000);
        const phi = num('phi_den');
        const yTalao = m.dims.sapata.y1;
        const yPonta = yTalao - B;
        const yc = yTalao - B / 2 - xd;
        const [yd0, yd1] = [Math.max(yPonta, yc - bd / 2), Math.min(yTalao, yc + bd / 2)];
        // dente estreito demais para o estribo (o aviso diz): nenhuma barra
        if (yd1 - yd0 - 2 * c0 - phi < 3 * phi) {
          expect(estribos.length + longs.length, c).toBe(0);
          expect(m.avisos.some((a) => a.codigo === 'DENTE_ESTREITO'), c).toBe(true);
          continue;
        }
        expect(estribos.length, c).toBeGreaterThan(0);
        for (const tr of m.dims.trechos) {
          const k = m.dims.trechos.indexOf(tr) + 1;
          const doTrecho = estribos.filter((b) => b.trecho === k);
          // a cada ≤ s da conta (sem conta, 20 cm): tantos quantos cabem de cobrimento a cobrimento
          const s = (r.num('s_den') ?? 20) * 10;
          const vao = tr.x1 - tr.x0 - 2 * (c0 + phi);
          expect(doTrecho.length, `${c} T${k}`).toBe(Math.max(1, Math.ceil(vao / s - 1e-6)) + 1);
          // longitudinais: nf por face (duas faces), emendadas se o trecho passa de 12 m
          const nf = Math.round(r.num('nf_den') ?? Math.max(2, Math.ceil(hd / 330) + 1));
          const linhas = new Set(longs.filter((b) => b.trecho === k).map((b) => `${Math.round(b.eixo[0][2])}|${b.eixo[0][1] > yc ? 'T' : 'P'}`));
          expect(linhas.size, `${c} T${k} longitudinais`).toBe(2 * nf);
        }
        // forma: estribo de ganchos (polilinha aberta), do fundo do dente ao cobrimento de cima da sapata
        for (const b of estribos) {
          expect(b.estribo, b.id).toBe(true);
          expect(b.diametro).toBe(phi);
          const zs = b.eixo.map((p) => p[2]);
          expect(Math.min(...zs), b.id).toBeCloseTo(-h - hd + c0 + phi / 2, 1);
          expect(Math.max(...zs), b.id).toBeCloseTo(-c0 - phi / 2, 1);
        }
        // dentro do concreto com o cobrimento: abaixo da sapata, entre as faces do dente; acima, até o cobrimento de cima
        for (const b of [...estribos, ...longs]) {
          const f = b.diametro / 2 - 0.6;
          for (const [x, y, z] of b.eixo) {
            const onde = `${c} ${b.id} (${x}, ${y}, ${z})`;
            expect(z, onde).toBeGreaterThanOrEqual(-h - hd + c0 + f);
            expect(z, onde).toBeLessThanOrEqual(-c0 - f);
            if (z < -h + c0) {
              expect(y, onde).toBeGreaterThanOrEqual(yd0 + c0 + f);
              expect(y, onde).toBeLessThanOrEqual(yd1 - c0 - f);
            }
          }
        }
        // cada estribo do dente num plano livre: longe dos estribos da sapata, dos de torção e das esperas
        const vizinhos = m.barras.filter((b) => b.papel === 'SAP_TORCAO' || b.papel === 'ESPERA' || (b.papel === 'SAP_TRANSV' && b.estribo));
        let encostados = 0;
        for (const e of estribos) {
          for (const v of vizinhos) {
            if (v.trecho !== e.trecho) continue;
            const xv = v.papel === 'ESPERA' ? v.eixo[0][0] : xDe(v);
            if (Math.abs(xDe(e) - xv) < (v.diametro + phi) / 2 + phi - 0.6) encostados++;
          }
        }
        // estribo de torção a menos de 6 cm ou transversal a menos de 8 (muro que a conta já não deixa passar) não
        // deixa plano livre na sapata junto das esperas: ali o do dente fica no meio do maior vão, encostado — fora
        // disso, nenhum em cima de outra barra
        const cerrado = (r.num('s_tor_f') ?? 99) < 6 || (r.num('s_ps') ?? 99) < 8;
        if (!cerrado) expect(encostados, `${c}: estribos do dente em cima de outra barra`).toBe(0);
        // as longitudinais da sapata não passam por dentro das pernas do estribo do dente
        const pernas = [yd0 + c0 + phi / 2, yd1 - c0 - phi / 2];
        for (const l of m.barras.filter((b) => b.papel === 'SAP_LONG')) {
          for (const y of pernas) expect(Math.abs(l.eixo[0][1] - y), `${c} ${l.id}`).toBeGreaterThanOrEqual((l.diametro + phi) / 2 - 0.6);
        }
      }
    }, 60_000);
  }

  it('entra na lista de ferros e no aço do quantitativo com o nome do dente', async () => {
    const { listaDeFerros } = await import('@/quantitativo/aco');
    const m = gerarModelo(resultadoDoGabarito('aula122'), padroesDoModelo());
    const elementos = listaDeFerros(m.barras).linhas.map((p) => p.elemento).join(' | ');
    expect(elementos).toContain('Dente · estribo');
    expect(elementos).toContain('Dente · longitudinal');
  });
});
