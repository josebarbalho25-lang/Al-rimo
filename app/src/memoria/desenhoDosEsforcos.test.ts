/*
  O DIAGRAMA DO AÇO NA MEMÓRIA (15/11): em todo cenário do gabarito, o card de cada peça que tem barra na vista
  Esforços leva o desenho dela, bem formado, sem NaN, com os números dos picos iguais às células; e nada mais muda no
  card (conta, verificação, veredito).
*/
import { describe, expect, it } from 'vitest';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { barrasAnaliticas } from '@/esforcos/barrasAnaliticas';
import { cardsDaMemoria, vereditoDaMemoria, verificacoesDe } from './cards';
import { comDiagramasDosEsforcos } from './desenhoDosEsforcos';
import { nbr } from './formato';

/** As tags abrem e fecham na ordem (o SVG sai de texto: o teste é o parser). */
function bemFormado(svg: string): boolean {
  const pilha: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)\b[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) {
      if (pilha.pop() !== m[2]) return false;
    } else pilha.push(m[2]!);
  }
  return pilha.length === 0 && (svg.match(/<svg/g)?.length ?? 0) === 1 && svg.endsWith('</svg>');
}

const DESENHO = /^(Aço necessário e colocado|Cortante: necessário e resistente)/;

describe('diagrama do aço no card de cada peça', () => {
  const casos = cenariosDoGabarito().flatMap((c) => {
    const r = resultadoDoGabarito(c);
    try {
      return [{ c, r, m: gerarModelo(r, { ...padroesDoModelo(), L_total: 6 }) }];
    } catch {
      return [];
    }
  });

  it('o gabarito tem muros', () => expect(casos.length).toBeGreaterThan(60));

  it('todo card de flexão das peças com barra leva o diagrama; o SVG é bem formado, sem NaN, com os picos da planilha', () => {
    const faltas: string[] = [];
    let desenhos = 0;
    let picos = 0;
    for (const { c, r, m } of casos) {
      const barras = barrasAnaliticas(r, m);
      const cards = comDiagramasDosEsforcos(cardsDaMemoria(r), r, m).filter((k) => k.aplicavel);
      const comDesenho = new Map<string, string[]>();
      for (const k of cards) for (const s of k.secoes) if (s.desenho && DESENHO.test(s.desenho.titulo)) (comDesenho.get(k.id) ?? comDesenho.set(k.id, []).get(k.id)!).push(s.desenho.svg);
      for (const b of barras) {
        if (!b.flexao?.faces.length) continue;
        if (!cards.some((k) => k.id === b.card)) continue; // card que não se aplica (não há conta para mostrar)
        const svgs = comDesenho.get(b.card);
        if (!svgs?.length) {
          faltas.push(`${c}: ${b.card} sem diagrama (${b.id})`);
          continue;
        }
        for (const svg of svgs) {
          if (!bemFormado(svg)) faltas.push(`${c}: ${b.card} SVG mal formado`);
          if (/NaN|Infinity/.test(svg)) faltas.push(`${c}: ${b.card} com NaN`);
        }
        // os números da planilha escritos no desenho
        for (const p of b.flexao.picos) {
          if (p.qual !== 'nec' || (!p.nome && !p.celula)) continue;
          const v = p.celula ? r.cel(p.celula) : r.num(p.nome!);
          if (typeof v !== 'number') continue;
          picos++;
          if (!svgs.some((s) => s.includes(`>${nbr(Math.max(0, v * p.fator), 2)}<`))) faltas.push(`${c}: ${b.card} sem o pico ${p.nome ?? p.celula} = ${nbr(v, 2)}`);
        }
      }
      desenhos += [...comDesenho.values()].flat().length;
    }
    expect([...new Set(faltas)]).toEqual([]);
    expect(desenhos).toBeGreaterThan(500);
    expect(picos).toBeGreaterThan(300);
  });

  it('o cortante entra nos cards de cortante onde a vista tem o diagrama', () => {
    for (const nome of ['aula122', 'aula123', 'alvo_cmc_duas']) {
      const r = resultadoDoGabarito(nome);
      const m = gerarModelo(r, { ...padroesDoModelo(), L_total: 6 });
      const cards = comDiagramasDosEsforcos(cardsDaMemoria(r), r, m);
      const tem = (id: string) => cards.find((k) => k.id === id)?.secoes.some((s) => s.desenho?.titulo.startsWith('Cortante:')) ?? false;
      if (r.v('Tipo_muro') === 'Balanço') expect(tem('balanco.cisalhamento')).toBe(true);
      else expect(tem('contraforte.cisalhamento')).toBe(true);
      expect(tem('sapata.cortante')).toBe(true);
      expect(tem('fundacao.dente')).toBe(r.v('tem_den') === 'Sim');
    }
  });

  it('nada mais muda: as mesmas seções, as mesmas contas, o mesmo veredito', () => {
    for (const { r, m } of casos.slice(0, 30)) {
      const antes = cardsDaMemoria(r);
      const depois = comDiagramasDosEsforcos(antes, r, m);
      expect(depois.map((k) => k.secoes.map((s) => [s.titulo, s.passos.length]))).toEqual(antes.map((k) => k.secoes.map((s) => [s.titulo, s.passos.length])));
      expect(verificacoesDe(depois).map((x) => x.v.passa)).toEqual(verificacoesDe(antes).map((x) => x.v.passa));
      expect(vereditoDaMemoria(r, depois)).toEqual(vereditoDaMemoria(r, antes));
      // o desenho que já existia na seção fica
      antes.forEach((k, i) => k.secoes.forEach((s, j) => s.desenho && expect(depois[i]!.secoes[j]!.desenho).toBe(s.desenho)));
    }
  });

  it('sem modelo, os cards voltam como vieram', () => {
    const r = resultadoDoGabarito('aula122');
    const antes = cardsDaMemoria(r);
    expect(comDiagramasDosEsforcos(antes, r, null)).toBe(antes);
  });
});
