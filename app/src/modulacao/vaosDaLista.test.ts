/*
  OS VÃOS ENTRE CONTRAFORTES QUE A LISTA OFERECE (Jose, 12/10): "pega a modulação dos blocos de 14 e 19 e descobre
  quais os valores possíveis". Três provas, todas pela própria modulação (receitas do Revit, encaixes.ts):

  1. a lista das Entradas da planilha (Referências!AK) é exatamente o conjunto dos eixos a eixo que fecham no módulo
     E amarram (vaosDoContraforte, muro de ensaio L–T–T–L), dentro dos limites do app (0,80 a 4,00 m);
  2. cada valor da lista, num muro de verdade (3 vãos, h 2,60 com canaletas e cinta, contraforte enterrado e
     aparente, os dois comprimentos de contraforte da família), é desenhado com o próprio valor (sem "→", sem aviso
     de vão) e não deixa junta a prumo em nenhuma fiada de bloco do muro;
  3. trocar o vão refaz o muro: os contrafortes do modelo andam para o eixo a eixo novo.
*/
import { describe, expect, it } from 'vitest';
import { calcular } from '@/motor';
import type { Alteracoes } from '@/motor/tipos';
import type { Aviso } from '@/modelo/tipos';
import { campoDe, opcoesDoCampo } from '@/estado/campos';
import { entradas } from '@/motor';
import { JUNTA, CATALOGO, pecaDoCatalogo } from './catalogo';
import { ENCAIXES } from './encaixes';
import { fiadasDeCanaleta, montarFiadas, tiposDasFiadas } from './fiadas';
import { gerarModelo } from './gerar';
import { lerParametros } from './leitura';
import { modular, vaosDoContraforte } from './modular';

const L_CF = campoDe(entradas.find((e) => e.nome === 'l_cf')!, 'planilha');
const TENR = campoDe(entradas.find((e) => e.nome === 'tenr_')!, 'planilha');
const opcoes = (campo: typeof L_CF, a: Alteracoes): number[] => {
  const r = calcular(a);
  return opcoesDoCampo(campo, (ref) => r.cel(ref)).map((o) => o.valor as number);
};

const FAMILIAS = [
  { t: 14, nome: '14x39' as const },
  { t: 19, nome: '19x39' as const },
];

describe('vãos entre contrafortes: a lista × a modulação', () => {
  for (const f of FAMILIAS) {
    it(`bloco ${f.t}: a lista da planilha = os vãos que amarram, de 0,80 a 4,00 m`, () => {
      const daModulacao = vaosDoContraforte(f.nome, 4000).filter((v) => v >= 800).map((v) => v / 1000);
      const daLista = opcoes(L_CF, { Tipo_muro: 'Contrafortes', t_bloco: f.t });
      expect(daLista).toEqual(daModulacao);
    });
  }
});

/** Juntas verticais coincidentes entre fiadas vizinhas da linha do muro, fora das faces dos contrafortes. */
function juntasAPrumo(a: Alteracoes, extras: Record<string, number>) {
  const r = calcular(a);
  const avisos: Aviso[] = [];
  const p = lerParametros(r, extras, avisos);
  const mod = modular(p, avisos);
  const canaleta = fiadasDeCanaleta(mod.n_fiadas, mod.s_can, p.cinta);
  const tipos = tiposDasFiadas(canaleta, ENCAIXES[mod.cat.nome].primeira);
  const achados: string[] = [];
  for (const tr of mod.trechos) {
    const fiadas = montarFiadas(tr, { ...mod, aparente: !p.enterrado }, tipos);
    const faces = new Set<number>(tr.nos.flatMap((n) => [n.xs - JUNTA, n.xs + mod.cat.t]));
    for (let i = 0; i + 1 < fiadas.length; i++) {
      const deCanaleta = (k: number) => fiadas[k].linha.some((it) => pecaDoCatalogo(mod.cat, it.chave).forma === 'canaleta');
      const cima = new Set(fiadas[i + 1].juntasLinha);
      const iguais = fiadas[i].juntasLinha.filter((x) => cima.has(x) && !faces.has(x));
      if (iguais.length) achados.push(`fiadas ${i + 1}/${i + 2}${deCanaleta(i) || deCanaleta(i + 1) ? ' (canaleta)' : ''}: x = ${iguais.join(', ')}`);
    }
  }
  return { mod, avisos, achados };
}

describe('cada vão da lista num muro de verdade', () => {
  for (const f of FAMILIAS) {
    const tenrs = opcoes(TENR, { Tipo_muro: 'Contrafortes', t_bloco: f.t });
    const vaos = opcoes(L_CF, { Tipo_muro: 'Contrafortes', t_bloco: f.t });
    for (const pos of ['Enterrado (lado do solo)', 'Aparente (lado de fora)']) {
      it(`bloco ${f.t}, ${pos.split(' ')[0].toLowerCase()}, contraforte ${tenrs.join('/')}: desenhado com o vão da lista, sem junta a prumo`, () => {
        for (const tenr of tenrs) {
          for (const l of vaos) {
            const Wn = CATALOGO[f.nome].t + JUNTA;
            const L = (3 * l * 1000 + Wn) / 1000;          // 3 vãos, contraforte nas duas pontas
            const a: Alteracoes = { Tipo_muro: 'Contrafortes', t_bloco: f.t, tenr_: tenr, l_cf: l, pos_cf: pos, H_muro: 2.6, H_solo: 2.6 };
            const { mod, avisos, achados } = juntasAPrumo(a, { L_total: L });
            const vao = avisos.filter((x) => x.codigo.startsWith('VAO_'));
            expect(mod.l_cf, `${tenr} ${l}`).toBe(Math.round(l * 1000));
            expect(vao, `${tenr} ${l}`).toEqual([]);
            // nem nas fiadas de bloco nem nas de canaleta (a canaleta corre deslocada 1/4 de bloco)
            expect(achados, `${tenr} ${l}`).toEqual([]);
          }
        }
      });
    }
  }
});

describe('trocar o vão refaz o muro', () => {
  it('os contrafortes do modelo andam para o eixo a eixo novo (bloco 14: 1,35 → 2,15)', () => {
    const base: Alteracoes = { Tipo_muro: 'Contrafortes', t_bloco: 14, tenr_: 54, H_muro: 2.6, H_solo: 2.6 };
    const xs = (l: number) => gerarModelo(calcular({ ...base, l_cf: l }), { L_total: 6 }).dims.contrafortes.map((c) => c.x);
    const a = xs(1.35);
    const b = xs(2.15);
    const passos = (v: number[]) => v.slice(1).map((x, i) => x - v[i]);
    expect(new Set(passos(a))).toEqual(new Set([1350]));
    expect(new Set(passos(b))).toEqual(new Set([2150]));
  });
});
