/*
  CONTRAFORTE DOBRADO (Jose, 16/11: "desenha um muro e coloca a distância de contrafortes igual à de juntas, voilà,
  gabarito pronto"). Dois blocos lado a lado (2t + 1 cm), só nos intermediários. O que quebraria:
  - a metade do dobrado sair diferente do contraforte de ponta do gabarito (o L validado no Revit): o mesmo muro com
    uma junta de controle em cada contraforte intermediário tem de dar as MESMAS peças e as mesmas barras verticais e
    U, peça a peça (o que muda é só o que a junta corta: sapata, dreno, terreno — e o estribo);
  - o par contado como dois contrafortes (numeração C1, C2…, IFC, quantitativo) ou o da ponta sair dobrado;
  - o estribo: um só abraçando os dois blocos em TODA fiada, na junta de assentamento, eixo dos ramos a 3,5 cm das
    faces de fora (eenr − 7 cm), cruzando a junta de argamassa entre os blocos, sem cortar barra, espera nem o U; com 4
    ramos (o estribo duplo do Pró-Viga), os dois estribos de 2/3 cruzando a junta;
  - as barras: n_cf (par) metade no furo da ponta de cada bloco; os simples do muro com a metade;
  - o comprimento e o vão de fechamento com os pares.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, comEntradas, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Barra, Modelo, Peca } from '@/modelo/tipos';
import { caixaGlobal, gerarModelo, padroesDoModelo } from './index';
import { RECUO_ESTRIBO_LATERAL } from './contexto';
import { vaosDoContraforte } from './modular';
import { choques } from './__testes__/choques';

const DOBRADOS = cenariosDoGabarito().filter((c) => c.startsWith('alvo_dobrado'));
const modelo = (r: Resultado, extras: Record<string, Valor> = {}): Modelo => gerarModelo(r, { ...padroesDoModelo(), ...extras });
const JUNTA = 10;

const ALVENARIA = new Set(['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA', 'GRAUTE_FURO', 'GRAUTE_CANALETA']);
const CANALETA = new Set(['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);
const BARRAS_DA_MONTAGEM = new Set(['CF_PRINCIPAL', 'CF_CONSTRUTIVA', 'ESPERA', 'VERT_MURO', 'HORIZ']);

const chaveDaPeca = (p: Peca): string => `${p.tipo}|${p.geometria}|${p.origem.join(',')}|${p.giro}`;
const chaveDaBarra = (b: Barra): string => `${b.papel}|${b.diametro}|${JSON.stringify(b.eixo)}`;

function contar(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}
function diferenca(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];
  for (const [k, n] of a) if ((b.get(k) ?? 0) !== n) out.push(`${k} (${n} × ${b.get(k) ?? 0})`);
  for (const [k, n] of b) if (!a.has(k)) out.push(`${k} (0 × ${n})`);
  return out;
}

/** O mesmo muro com contraforte SIMPLES e uma junta de controle em cada vão: cada trecho, um pano do dobrado. */
function comJuntas(r: Resultado, m: Modelo, L: number): Modelo {
  const t = m.familia.t;
  const lPano = (r.num('l_cf_adot')! * 1000 - (t + JUNTA)) / 1000;
  const nBloco = r.num('dob_cf') === 1 ? r.num('n_cf')! / 2 : r.num('n_cf')!;
  const simples = comEntradas(r, { larg_cf: 'Simples', dob_cf: 0, dob_o: 0, l_cf_adot: lPano, eenr: t / 10, n_cf: nBloco, ram_ef: 2 });
  const vaos = m.dims.contrafortes.length - 1;
  return modelo(simples, { L_total: L, junta_cada: L / vaos });
}

describe('contraforte dobrado (16/11)', () => {
  it('o gabarito tem os dois blocos, enterrado e aparente, o calculado dobrado e o calculado de extremidade', () => {
    expect(DOBRADOS.length).toBeGreaterThanOrEqual(8);
    const rs = DOBRADOS.map((c) => resultadoDoGabarito(c));
    expect(rs.some((r) => r.num('t_bloco') === 14) && rs.some((r) => r.num('t_bloco') === 19)).toBe(true);
    expect(rs.some((r) => r.num('dob_cf') === 1) && rs.some((r) => r.num('dob_o') === 1)).toBe(true);
  });

  for (const c of DOBRADOS) {
    describe(c, () => {
      const r = resultadoDoGabarito(c);
      const m = modelo(r);
      const t = m.familia.t;
      const W = 2 * t + JUNTA;

      it('o par é UM contraforte: só os intermediários, largura 2t + 1 cm, metades a 1 cm', () => {
        const cfs = m.dims.contrafortes;
        expect(cfs.length).toBeGreaterThanOrEqual(3);
        cfs.forEach((q, k) => expect(!!q.dobrado, `C${k + 1}`).toBe(k > 0 && k < cfs.length - 1));
        cfs.forEach((q, k) => {
          const alv = m.pecas.filter((p) => p.contraforte === k + 1 && p.grupo === 'contraforte' && p.tipo !== 'GRAUTE_FURO' && p.tipo !== 'GRAUTE_CANALETA');
          const xs = alv.flatMap((p) => { const b = caixaGlobal(p, m.geometrias[p.geometria]); return [b.min[0], b.max[0]]; });
          expect(Math.max(...xs) - Math.min(...xs), `C${k + 1} largura`).toBeCloseTo(q.dobrado ? W : t, 6);
          expect((Math.max(...xs) + Math.min(...xs)) / 2, `C${k + 1} eixo`).toBeCloseTo(q.x, 6);
          if (q.dobrado) {
            // nenhuma peça da haste no meio do par: a junta de argamassa de 1 cm
            for (const p of alv) {
              const b = caixaGlobal(p, m.geometrias[p.geometria]);
              expect(b.min[0] >= q.x + 5 - 1e-6 || b.max[0] <= q.x - 5 + 1e-6, `${p.id} na junta do par`).toBe(true);
            }
          }
        });
        // uma sapata por trecho (contínua sob o par), um dreno por vão
        expect(m.pecas.filter((p) => p.tipo === 'SAPATA').length).toBe(m.dims.trechos.length);
      });

      it('cada metade é o contraforte de ponta do gabarito: o muro com junta em cada vão dá as mesmas peças e barras', () => {
        // sem o muro de cima: os pilaretes da junta ficam um em cada ponta de trecho, os do dobrado um no eixo do par
        const rr = comEntradas(r, { mc_on: 'Não' });
        const L = m.dims.L_real / 1000 + 0.01;
        const a = modelo(rr, { L_total: L });
        const b = comJuntas(rr, a, L);
        expect(b.dims.trechos.length).toBe(a.dims.contrafortes.length - 1);
        expect(b.dims.L_real).toBe(a.dims.L_real);
        // o graute da canaleta do MURO: no dobrado ele corre pela junta de 1 cm entre as metades (o U não tem fundo nas
        // pontas, como em qualquer canaleta seguida); na junta de controle, não. Conferido pelo comprimento por fiada.
        const doMuro = (p: Peca) => p.tipo === 'GRAUTE_CANALETA' && p.grupo === 'muro';
        // Exceção (de antes, do contraforte simples): com muitas barras, a fila do furo do muro encosta no ramo do
        // estribo do lado do muro (bloco 14 aparente). No dobrado as barras ficam longe dos ramos do estribo dele —
        // então, quando o muro com juntas tem esse choque, as barras do contraforte (e os furos que elas abrem no fundo
        // da canaleta, com o graute da coluna) podem estar noutro lugar; os blocos e o resto, não.
        const choqueDeAntes = choques(b.barras.filter((x) => x.papel === 'CF_ESTRIBO'), b.barras.filter((x) => !x.estribo)).length > 0;
        const chave = (p: Peca) => (choqueDeAntes && CANALETA.has(p.tipo) ? `${p.tipo}|${p.origem.join(',')}|${p.giro}` : chaveDaPeca(p));
        const conta = (p: Peca) => ALVENARIA.has(p.tipo) && !doMuro(p) && !(choqueDeAntes && p.tipo === 'GRAUTE_FURO' && !p.geometria.endsWith(' h200'));
        const pa = contar(a.pecas.filter(conta).map(chave));
        const pb = contar(b.pecas.filter(conta).map(chave));
        expect(diferenca(pa, pb)).toEqual([]);
        const comprimento = (x: Modelo) => {
          const out = new Map<number, number>();
          for (const p of x.pecas.filter(doMuro)) {
            const c = caixaGlobal(p, x.geometrias[p.geometria]);
            out.set(p.fiada!, (out.get(p.fiada!) ?? 0) + c.max[0] - c.min[0]);
          }
          return out;
        };
        const pares = a.dims.contrafortes.filter((q) => q.dobrado).length;
        const [ca, cb] = [comprimento(a), comprimento(b)];
        expect([...ca.keys()].sort()).toEqual([...cb.keys()].sort());
        for (const [i, l] of ca) expect(l, `fiada ${i}`).toBeCloseTo(cb.get(i)! + JUNTA * pares, 6);
        const doCf = (x: Barra) => x.contraforte !== undefined;
        const ba = contar(a.barras.filter((x) => BARRAS_DA_MONTAGEM.has(x.papel) && !(choqueDeAntes && doCf(x))).map(chaveDaBarra));
        const bb = contar(b.barras.filter((x) => BARRAS_DA_MONTAGEM.has(x.papel) && !(choqueDeAntes && doCf(x))).map(chaveDaBarra));
        expect(diferenca(ba, bb)).toEqual([]);
        if (choqueDeAntes) {
          // as mesmas barras, mesmo Ø e comprimento, só noutro lugar do furo
          const forma = (x: Barra) => `${x.papel}|${x.diametro}|${Math.round(x.comprimento)}`;
          expect(diferenca(contar(a.barras.filter((x) => BARRAS_DA_MONTAGEM.has(x.papel) && doCf(x)).map(forma)),
            contar(b.barras.filter((x) => BARRAS_DA_MONTAGEM.has(x.papel) && doCf(x)).map(forma)))).toEqual([]);
        }
      });

      it('barras principais: n_cf metade em cada bloco do dobrado; os simples com a metade', () => {
        const nDob = r.num('dob_cf') === 1 ? r.num('n_cf')! : r.num('n_cfo')!;
        const nSim = r.num('dob_cf') === 1 ? r.num('n_cfo')! : r.num('n_cf')!;
        expect(nDob % 2).toBe(0);
        m.dims.contrafortes.forEach((q, k) => {
          const ps = m.barras.filter((b) => b.papel === 'CF_PRINCIPAL' && b.contraforte === k + 1);
          expect(ps.length, `C${k + 1}`).toBe(q.dobrado ? nDob : nSim);
          if (q.dobrado) {
            const esq = ps.filter((b) => b.eixo[0][0] < q.x).length;
            expect(esq, `C${k + 1} metade a`).toBe(nDob / 2);
          }
        });
      });

      it('estribo: um só abraçando os dois blocos em toda fiada, na junta, sem cortar barra', () => {
        const fiadas = m.dims.n_fiadas;
        const e = W - 2 * RECUO_ESTRIBO_LATERAL;
        const ramos = r.num('dob_cf') === 1 ? r.num('ram_ef')! : 2;
        m.dims.contrafortes.forEach((q, k) => {
          if (!q.dobrado) return;
          const es = m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && b.contraforte === k + 1);
          expect(es.length, `C${k + 1}`).toBe(fiadas * (ramos === 4 ? 2 : 1));
          for (const b of es) {
            const xs = b.eixo.map((p) => p[0]);
            const zs = b.eixo.map((p) => p[2]);
            const i = Math.round((Math.min(...zs) - JUNTA / 2) / 200);
            expect(Math.min(...zs), b.id).toBeGreaterThanOrEqual(i * 200 - 1e-6);
            expect(Math.max(...zs), b.id).toBeLessThanOrEqual(i * 200 + JUNTA + 1e-6);
            // cruza a junta de argamassa entre os blocos (é a ligação)
            expect(Math.min(...xs) < q.x - 5 && Math.max(...xs) > q.x + 5, `${b.id} cruza a junta`).toBe(true);
            if (ramos === 2) {
              // o retângulo do eixo: os ramos a 3,5 cm das faces de fora; o gancho volta para dentro, nunca para fora
              expect(Math.min(...xs), b.id).toBeGreaterThanOrEqual(q.x - e / 2 - b.diametro - 1e-6);
              expect(Math.max(...xs), b.id).toBeLessThanOrEqual(q.x + e / 2 + b.diametro + 1e-6);
            }
          }
        });
        const estribos = m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && m.dims.contrafortes[b.contraforte! - 1]?.dobrado);
        // fora a barra do pilarete do muro de cima que desce na haste: ela cruza o ramo do lado do muro também no
        // contraforte simples (de antes: alvo_mc_cf_duas, _meia, _pilarete_largo) — anotado como pendência
        expect(choques(estribos, m.barras.filter((b) => !b.estribo && b.papel !== 'PIL_LONG'))).toEqual([]);
      });
    });
  }

  it('4 ramos (decisão do Jose em aberto): dois estribos de 2/3 da largura do par, ±1/6, os dois cruzando a junta', () => {
    for (const c of ['alvo_dobrado_19x59_enterrado', 'alvo_dobrado_19x79_aparente', 'alvo_dobrado_14x54_enterrado']) {
      const r = comEntradas(resultadoDoGabarito(c), { ram_ef: 4 });
      const m = modelo(r);
      const t = m.familia.t;
      const e = 2 * t + JUNTA - 2 * RECUO_ESTRIBO_LATERAL;
      m.dims.contrafortes.forEach((q, k) => {
        if (!q.dobrado) return;
        const es = m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && b.contraforte === k + 1);
        expect(es.length, `${c} C${k + 1}`).toBe(2 * m.dims.n_fiadas);
        const porJunta = new Map<string, Barra[]>();
        for (const b of es) porJunta.set(b.id.replace(/b$/, ''), [...(porJunta.get(b.id.replace(/b$/, '')) ?? []), b]);
        for (const [id, par] of porJunta) {
          expect(par.length, id).toBe(2);
          expect(par[0].posicao, id).toBe(par[1].posicao);
          const faixas = par.map((b) => [Math.min(...b.eixo.map((p) => p[0])), Math.max(...b.eixo.map((p) => p[0]))]);
          for (const [a, b] of faixas) {
            expect(b - a, id).toBeCloseTo((2 * e) / 3, 0);
            expect(a < q.x - 5 && b > q.x + 5, `${id} cruza a junta`).toBe(true);
          }
          expect(Math.abs(faixas[0][0] - faixas[1][0]), id).toBeCloseTo(e / 3, 0);
        }
      });
      // simples do muro: 2 ramos (o 4 da conta é o do dobrado)
      m.dims.contrafortes.forEach((q, k) => {
        if (q.dobrado) return;
        expect(m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && b.contraforte === k + 1 && b.id.endsWith('b')).length).toBe(0);
      });
      const estribos = m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && m.dims.contrafortes[b.contraforte! - 1]?.dobrado);
      expect(choques(estribos, m.barras.filter((b) => !b.estribo)), c).toEqual([]);
    }
  }, 60_000);

  it('o calculado é a extremidade e dispensa estribo: o dobrado leva estribo do mesmo jeito, os simples não', () => {
    const r = comEntradas(resultadoDoGabarito('alvo_dobrado_extremidade'), { Asw_c: 0 });
    const m = modelo(r);
    m.dims.contrafortes.forEach((q, k) => {
      const n = m.barras.filter((b) => b.papel === 'CF_ESTRIBO' && b.contraforte === k + 1).length;
      expect(n > 0, `C${k + 1}`).toBe(!!q.dobrado);
    });
  });

  it('comprimento: o muro fecha no digitado com os pares; vão de fechamento menor e da lista', () => {
    const r = resultadoDoGabarito('alvo_dobrado_19x59_enterrado');
    const lCf = r.num('l_cf_adot')! * 1000;
    const t = 190;
    const livres = new Set(vaosDoContraforte('19x39', 6000).map((v) => v - t));
    for (const L of [6.0, 9.3, 12.0, 13.1, 20.0]) {
      const m = modelo(r, { L_total: L });
      // modular = desenhado + 1 cm; nenhum ajuste quando o digitado fecha
      const aj = m.ajustes.find((a) => a.nome === 'L_total');
      const modular = (m.dims.L_real + JUNTA) / 1000;
      if (aj) expect(aj.para).toBeCloseTo(modular, 6);
      expect(Math.abs(modular - L)).toBeLessThan(0.21);
      // vãos livres entre faces: todos da lista do simples (amarram); só o último pode ser menor que o cheio
      const cfs = m.dims.contrafortes;
      const larg = (q: { dobrado?: true }) => (q.dobrado ? 2 * t + JUNTA : t);
      const vaos = cfs.slice(1).map((q, k) => q.x - larg(q) / 2 - (cfs[k].x + larg(cfs[k]) / 2));
      for (const v of vaos) expect(livres.has(Math.round(v)), `${L}: vão livre ${v}`).toBe(true);
      const cheio = lCf - (2 * t + JUNTA);
      expect(vaos.slice(0, -2).every((v) => Math.abs(v - cheio) < 0.5), `${L}: ${vaos}`).toBe(true);
    }
  });

  it('"→" no nº de barras ímpar digitado (vai ao par de cima)', () => {
    const r = resultadoDoGabarito('alvo_dobrado_n_impar_digitado');
    const m = modelo(r);
    const aj = m.ajustes.find((a) => a.nome === 'n_cf');
    expect(aj).toEqual({ nome: 'n_cf', de: r.num('n_cf_dir'), para: r.num('n_cf'), unidade: '' });
    expect(r.num('n_cf')! % 2).toBe(0);
  });
});
