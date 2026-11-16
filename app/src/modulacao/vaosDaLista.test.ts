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
import { escolherVaos, modular, vaosDeFechamento, vaosDoContraforte } from './modular';

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
    // 6 m não fecha com vãos iguais: desde 16/11 o último vão é o de fechamento (menor), os outros são o escolhido
    // (1,35: a sobra fica abaixo do mínimo e os dois últimos dividem — 0,95 + 0,95)
    expect(new Set(passos(a).slice(0, -2))).toEqual(new Set([1350]));
    expect(new Set(passos(b).slice(0, -1))).toEqual(new Set([2150]));
    expect(Math.max(...passos(a))).toBe(1350);
    expect(Math.max(...passos(b))).toBe(2150);
  });
});

/*
  O VÃO DE FECHAMENTO (Jose, 16/11: "o último painel aceitar ser menor a distância entre contrafortes pra fechar o
  muro mais próximo da tolerância real"). O comprimento digitado manda; vãos cheios e um vão menor, o último, da
  lista; sobra abaixo do mínimo → os dois últimos dividem; nunca maior que o vão da conta.
*/
describe('vão de fechamento: o muro fecha no comprimento digitado', () => {
  const vaosDe = (a: Alteracoes, extras: Record<string, number>) => {
    const { mod, avisos, achados } = juntasAPrumo(a, extras);
    const porTrecho = mod.trechos.map((t) => t.nos.slice(1).map((n, i) => n.xs - t.nos[i].xs));
    const ajusteL = mod.ajustes.find((x) => x.nome === 'L_total');
    return { mod, avisos, achados, porTrecho, vaos: porTrecho.flat(), ajusteL };
  };
  const B19 = (l: number): Alteracoes => ({ Tipo_muro: 'Contrafortes', t_bloco: 19, tenr_: 59, l_cf: l, H_muro: 2.6, H_solo: 2.6 });
  const B14 = (l: number): Alteracoes => ({ Tipo_muro: 'Contrafortes', t_bloco: 14, tenr_: 54, l_cf: l, H_muro: 2.6, H_solo: 2.6 });

  it('bloco 19, vão 2,80, 13,00 m: quatro vãos cheios e um de 1,60, sem seta (antes: 14,20)', () => {
    const { vaos, ajusteL, achados, mod } = vaosDe(B19(2.8), { L_total: 13 });
    expect(vaos).toEqual([2800, 2800, 2800, 2800, 1600]);
    expect(mod.L_real + JUNTA).toBe(13000);
    expect(ajusteL).toBeUndefined();
    expect(achados).toEqual([]);
  });

  it('bloco 19, de 20 em 20 cm: todo comprimento da grade fecha sem seta e sem junta a prumo', () => {
    for (let L = 3.0; L <= 13.0 + 1e-9; L += 0.2) {
      const Lr = Math.round(L * 100) / 100;
      const { vaos, ajusteL, achados, mod } = vaosDe(B19(2.8), { L_total: Lr });
      expect(mod.L_real + JUNTA, `${Lr}`).toBe(Math.round(Lr * 1000));
      expect(ajusteL, `${Lr}`).toBeUndefined();
      expect(achados, `${Lr}`).toEqual([]);
      expect(Math.max(...vaos), `${Lr}`).toBeLessThanOrEqual(2800);
      expect(Math.min(...vaos), `${Lr}`).toBeGreaterThanOrEqual(800);
      // cheios primeiro; no máximo dois de fechamento, no fim, o menor por último
      const fech = vaos.filter((v) => v !== 2800);
      expect(fech.length, `${Lr}`).toBeLessThanOrEqual(2);
      expect(vaos.slice(vaos.length - fech.length), `${Lr}`).toEqual(fech);
      if (fech.length === 2) expect(fech[0], `${Lr}`).toBeGreaterThanOrEqual(fech[1]);
    }
  }, 120_000);

  it('sobra menor que o vão mínimo: os dois últimos dividem (11,80 m com 2,80 → …, 1,60, 1,60)', () => {
    const { vaos, ajusteL } = vaosDe(B19(2.8), { L_total: 11.8 });
    expect(vaos).toEqual([2800, 2800, 2800, 1600, 1600]);
    expect(ajusteL).toBeUndefined();
    // sobra 0,60: os dois últimos somam 3,40, o mais iguais na grade e o menor por último
    expect(vaosDe(B19(2.8), { L_total: 12.0 }).vaos).toEqual([2800, 2800, 2800, 1800, 1600]);
  });

  it('bloco 14 (só nº par de meios módulos): fecha de 40 em 40 cm e a seta vai ao mais perto', () => {
    // 2,55: 12,50 = 4 × 2,55 + 2,15 + 0,15
    expect(vaosDe(B14(2.55), { L_total: 12.5 }).vaos).toEqual([2550, 2550, 2550, 2550, 2150]);
    // 12,30 fica entre 12,10 e 12,50 (empate): vai ao maior, como o arredondamento de antes
    const r = vaosDe(B14(2.55), { L_total: 12.3 });
    expect(r.ajusteL).toEqual({ nome: 'L_total', de: 12.3, para: 12.5, unidade: 'm' });
    // o valor da seta é ponto fixo: digitado, a seta some e o muro é o mesmo
    const de = vaosDe(B14(2.55), { L_total: 12.5 });
    expect(de.ajusteL).toBeUndefined();
    expect(de.vaos).toEqual(r.vaos);
    // perto da troca do nº de vãos o passo não é 40 (13,00 → 13,05: os dois últimos 1,35 + 1,35)
    const t = vaosDe(B14(2.55), { L_total: 13 });
    expect(t.vaos).toEqual([2550, 2550, 2550, 2550, 1350, 1350]);
    expect(t.ajusteL?.para).toBe(13.05);
    expect(vaosDe(B14(2.55), { L_total: 13.05 }).ajusteL).toBeUndefined();
    for (const L of [4.6, 7.3, 9.9, 12.3, 13, 15.7]) {
      const x = vaosDe(B14(2.55), { L_total: L });
      expect(x.achados, `${L}`).toEqual([]);
      for (const v of x.vaos) expect(vaosDoContraforte('14x39', 2550).includes(v), `${L}: ${v}`).toBe(true);
      expect(Math.min(...x.vaos), `${L}`).toBeGreaterThanOrEqual(950);
      // ponto fixo da seta
      const fixo = (x.mod.L_real + JUNTA) / 1000;
      const y = vaosDe(B14(2.55), { L_total: fixo });
      expect(y.ajusteL, `${L} → ${fixo}`).toBeUndefined();
      expect(y.vaos, `${L} → ${fixo}`).toEqual(x.vaos);
    }
  }, 60_000);

  it('juntas de controle: trechos com o mesmo nº de vãos, o de fechamento no fim do último', () => {
    const { porTrecho, ajusteL, achados, mod } = vaosDe(B19(2.8), { L_total: 20, junta_cada: 6 });
    expect(ajusteL).toBeUndefined();
    expect(mod.L_real + JUNTA).toBe(20000);
    expect(achados).toEqual([]);
    const n = porTrecho.map((v) => v.length);
    expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(1);
    porTrecho.slice(0, -1).forEach((v) => expect(new Set(v)).toEqual(new Set([2800])));
    expect(porTrecho.at(-1)!.at(-1)).toBeLessThan(2800);
    // ponto fixo com juntas, várias medidas
    for (const L of [9.1, 13.3, 17.7, 25.5]) {
      const x = vaosDe(B19(2.8), { L_total: L, junta_cada: 6 });
      const fixo = (x.mod.L_real + JUNTA) / 1000;
      const y = vaosDe(B19(2.8), { L_total: fixo, junta_cada: 6 });
      expect(y.ajusteL, `${L} → ${fixo}`).toBeUndefined();
      expect(y.porTrecho, `${L}`).toEqual(x.porTrecho);
      expect(x.achados, `${L}`).toEqual([]);
    }
  }, 60_000);

  it('comprimento que já fechava com vãos iguais: o muro é o de antes (vãos iguais, mesmos nós)', () => {
    for (const [a, l] of [[B19(2.8), 2800], [B19(1.6), 1600], [B14(1.35), 1350], [B14(2.55), 2550]] as const) {
      const Wn = (a.t_bloco === 19 ? 190 : 140) + JUNTA;
      for (const N of [1, 2, 3, 5, 7]) {
        const L = (N * l + Wn) / 1000;
        const { vaos, ajusteL } = vaosDe(a, { L_total: L });
        expect(vaos, `${l} × ${N}`).toEqual(Array(N).fill(l));
        expect(ajusteL, `${l} × ${N}`).toBeUndefined();
      }
    }
  });

  it('a regra sozinha: nunca vão maior que o cheio, soma mais perto do alvo', () => {
    const val = vaosDeFechamento('19x39', 2800);
    expect(val[0]).toBe(800);
    expect(val.at(-1)).toBe(2800);
    expect(escolherVaos(12800, 2800, val, 1)).toEqual([2800, 2800, 2800, 2800, 1600]);
    // muro curto: um vão só, menor que o cheio
    expect(escolherVaos(1400, 2800, val, 1)).toEqual([1400]);
    // abaixo do mínimo: o mínimo
    expect(escolherVaos(300, 2800, val, 1)).toEqual([800]);
  });
});
