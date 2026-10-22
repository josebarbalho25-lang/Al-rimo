/*
  SOMBRAS NO CORTE E NA PLANTA (Jose, 20/10: "não temos sombra das barras no corte lateral — a vertical que sobe pelo
  muro e o arranque nas duas versões — e sombra na planta das barras nas canaletas") — o que quebraria na obra:
  - barra de pé sem sombra, ou duas sombras da mesma posição no mesmo elemento;
  - legenda diferente da chamada (o desenho diz uma quantidade, a lista outra);
  - medida de perna diferente da lista de ferros (formaDaBarra) — no arranque Padrão e no nó de cachorro;
  - a sombra fora de altura (o armador mede pelo muro do lado) ou em cima do corte;
  - uma legenda escrita em cima da outra;
  - a barra emendada da canaleta sem a sobreposição, ou os U repetidos um por vão;
  - sombra que não some com o "Sombras" desligado ou com a armadura escondida.
*/
import { describe, expect, it } from 'vitest';
import type { Barra, Modelo } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { escalaDaVista, type Primitiva } from '@/pranchas/tipos';
import { formaDaBarra } from '@/pranchas/formaDaBarra';
import { barrasNoCorte, cortesPadrao, desenharCorteLateral } from '../corteLateral';
import { desenharPlanta } from '../planta';
import { elementoDaBarra, textoDaChamada } from '../chamadas';
import { Prancha } from '../prancha';
import { T } from '../sombras';
import type { SobreposicaoDaVista } from '../graficos';

const muro = (c: string, extra: Record<string, number | string> = {}): Modelo =>
  gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6, ...extra });

type Texto = Extract<Primitiva, { k: 'texto' }>;
type Poli = Extract<Primitiva, { k: 'polilinha' }>;
const daSombra = (ps: Primitiva[]) => ({
  textos: ps.filter((q): q is Texto => q.k === 'texto' && q.camada === 'sombras'),
  linhas: ps.filter((q): q is Poli => q.k === 'polilinha' && q.e.camada === 'sombras'),
});
const S25 = escalaDaVista(25);
const corte = (m: Modelo, x: number, graficos?: SobreposicaoDaVista) =>
  desenharCorteLateral(m, x, { S: S25, semTitulo: true, prefixo: 'c', graficos }).primitivas();

/** A caixa do texto (deitado ou em pé, ancorado no meio), px. */
const caixa = (t: Texto): [number, number, number, number] => {
  const w = Prancha.largura(t.t, t.altura);
  return t.angulo === 90 ? [t.p[0] - 0.85 * t.altura, t.p[1] - w / 2, 0.85 * t.altura, w] : [t.p[0] - w / 2, t.p[1] - 0.85 * t.altura, w, 0.85 * t.altura];
};
const cruzam = (a: number[], b: number[]) => a[0] < b[0] + b[2] - 0.5 && b[0] < a[0] + a[2] - 0.5 && a[1] < b[1] + b[3] - 0.5 && b[1] < a[1] + a[3] - 0.5;

const SOBEM = new Set(['ESPERA', 'VERT_MURO', 'CF_PRINCIPAL', 'CF_CONSTRUTIVA']);
const deCadaUma = (m: Modelo, x: number): Barra[] => {
  const uma = new Map<string, Barra>();
  for (const l of barrasNoCorte(m, x).linhas) {
    const k = `${l.barra.posicao}|${elementoDaBarra(l.barra)}`;
    if (SOBEM.has(l.barra.papel) && !uma.has(k)) uma.set(k, l.barra);
  }
  return [...uma.values()];
};

const CORTES: [string, Modelo][] = [
  ['balanço, arranque Padrão', muro('aula122')],
  ['balanço, nó de cachorro', muro('aula122', { arranque: 'Nó de cachorro' })],
  ['contrafortes, Padrão', muro('aula123')],
  ['contrafortes, nó de cachorro', muro('aula123', { arranque: 'Nó de cachorro' })],
];

describe('sombras no corte', () => {
  for (const [nome, m] of CORTES) {
    for (const c of cortesPadrao(m)) {
      it(`${nome}, corte ${c.rotulo}: toda barra de pé numa sombra só, com a legenda da chamada e as medidas da lista`, () => {
        const ps = corte(m, c.x);
        const { textos, linhas } = daSombra(ps);
        const barras = deCadaUma(m, c.x);
        expect(barras.length).toBeGreaterThan(0);
        // a legenda de cada sombra: "N3 – …" (uma barra) ou "N5 a N8 – …" / "N5, N7 – …" (o nó de cada furo junto)
        const legendas = textos.filter((t) => / – \d+ Ø/.test(t.t));
        expect(linhas.length).toBe(legendas.length);
        const nsDa = (l: string): string[] => {
          const cab = l.split(' – ')[0];
          const faixa = cab.match(/^N(\d+) a N(\d+)$/);
          if (faixa) return Array.from({ length: +faixa[2] - +faixa[1] + 1 }, (_, i) => `N${+faixa[1] + i}`);
          return cab.split(', ');
        };
        for (const b of barras) {
          // o mesmo N pode estar no muro e no contraforte (barra igual): uma sombra em cada elemento
          const chamada = textoDaChamada(m, b.posicao, elementoDaBarra(b));
          const sozinha = legendas.some((l) => l.t === chamada);
          const junto = legendas.some((l) => nsDa(l.t).length > 1 && nsDa(l.t).includes(b.posicao));
          expect(sozinha || junto, b.posicao).toBe(true);
          if (sozinha && !junto) {
            // sozinha: cada perna tem a medida da lista de ferros
            const f = formaDaBarra(b);
            if (f.trechos.length > 1) for (const c of f.trechos) expect(textos.some((t) => t.t === String(c))).toBe(true);
          }
        }
        // nó de cachorro: só o nó junta (a perna que muda é a deitada, ao longo da sapata); o Padrão não junta nada
        if (!nome.includes('nó')) expect(legendas.length).toBe(barras.length);
        // na altura de verdade: a sombra tem a altura da barra
        for (const b of barras) {
          const zs = b.eixo.map((p) => p[2]);
          const alturas = linhas.map((l) => Math.max(...l.pts.map((p) => p[1])) - Math.min(...l.pts.map((p) => p[1])));
          expect(alturas.some((h) => Math.abs(h - (Math.max(...zs) - Math.min(...zs)) * S25) < 0.5)).toBe(true);
        }
      });

      it(`${nome}, corte ${c.rotulo}: à esquerda de tudo, sem legenda em cima de outra`, () => {
        const ps = corte(m, c.x);
        const { textos, linhas } = daSombra(ps);
        const xs = (q: Primitiva): number[] =>
          q.k === 'polilinha' ? q.pts.map((p) => p[0]) : q.k === 'linha' ? [q.a[0], q.b[0]] : q.k === 'texto' ? [q.p[0]] : q.k === 'hachura' ? q.aneis.flat().map((p) => p[0]) : [];
        const resto = ps.filter((q) => !(q.k === 'texto' && q.camada === 'sombras') && !(q.k === 'polilinha' && q.e.camada === 'sombras'));
        const maisAEsquerda = Math.min(...resto.flatMap(xs));
        const fimDasSombras = Math.max(...linhas.flatMap((l) => l.pts.map((p) => p[0])), ...textos.map((t) => caixa(t)[0] + caixa(t)[2]));
        expect(fimDasSombras).toBeLessThan(maisAEsquerda);
        for (let i = 0; i < textos.length; i++) for (let j = i + 1; j < textos.length; j++) {
          expect(cruzam(caixa(textos[i]), caixa(textos[j])), `${textos[i].t} × ${textos[j].t}`).toBe(false);
        }
      });
    }
  }

  // revisão de 20/10: no contraforte com nó de cachorro saíam 9 a 12 sombras, a faixa mais larga que o corte; e o
  // número de uma perna do nó caía em cima de outro número ou do traço da perna vizinha (1:50, 1:100)
  for (const [nome, m] of CORTES) {
    for (const c of cortesPadrao(m)) {
      for (const e of [25, 50, 100]) {
        it(`${nome}, corte ${c.rotulo}, 1:${e}: a faixa das sombras fica na ordem do corte; número livre`, () => {
          const S = escalaDaVista(e);
          const ps = desenharCorteLateral(m, c.x, { S, semTitulo: true, prefixo: 'c' }).primitivas();
          const { textos, linhas } = daSombra(ps);
          const dasSombras = new Set<Primitiva>([...textos, ...linhas]);
          const xs = ps.filter((q) => !dasSombras.has(q)).flatMap((q) =>
            q.k === 'polilinha' ? q.pts.map((p) => p[0]) : q.k === 'linha' ? [q.a[0], q.b[0]] : q.k === 'hachura' ? q.aneis.flat().map((p) => p[0])
              : q.k === 'texto' ? [caixa(q)[0], caixa(q)[0] + caixa(q)[2]] : []);
          const larguraDoCorte = Math.max(...xs) - Math.min(...xs);
          const xsSombra = [...linhas.flatMap((l) => l.pts.map((p) => p[0])), ...textos.flatMap((t) => [caixa(t)[0], caixa(t)[0] + caixa(t)[2]])];
          // a sombra do nó tem a largura da sapata (é a forma de verdade) e a letra não encolhe com a escala: até três
          // cortes de largura. Antes de juntar o nó de cada furo, a faixa chegava a cinco
          expect(Math.max(...xsSombra) - Math.min(...xsSombra)).toBeLessThan(3 * larguraDoCorte);
          const medidas = textos.filter((t) => !/ – /.test(t.t));
          for (let i = 0; i < medidas.length; i++) {
            for (let j = i + 1; j < medidas.length; j++) expect(cruzam(caixa(medidas[i]), caixa(medidas[j])), `${medidas[i].t} × ${medidas[j].t}`).toBe(false);
            for (const l of linhas) {
              const cx = caixa(medidas[i]);
              const toca = l.pts.some((p, k) => k > 0 && Array.from({ length: 41 }, (_, s) => s / 40).some((f) => {
                const [x, y] = [l.pts[k - 1][0] + (p[0] - l.pts[k - 1][0]) * f, l.pts[k - 1][1] + (p[1] - l.pts[k - 1][1]) * f];
                return x > cx[0] + 0.3 && x < cx[0] + cx[2] - 0.3 && y > cx[1] + 0.3 && y < cx[1] + cx[3] - 0.3;
              }));
              expect(toca, `${medidas[i].t} no traço`).toBe(false);
            }
          }
        });
      }
    }
  }

  // a varredura da revisão: todos os muros do gabarito, os dois arranques, cada corte, em 1:25, 1:50 e 1:100 — número
  // de perna em cima de outro número ou do traço da sombra (eram 81 em 1:100 e 22 em 1:50, todos no nó de cachorro)
  it('todos os muros do gabarito: nenhum número de perna em cima de outro nem do traço', () => {
    const ruins: string[] = [];
    for (const g of cenariosDoGabarito()) {
      for (const arranque of ['Padrão', 'Nó de cachorro']) {
        const m = muro(g, { arranque });
        for (const c of cortesPadrao(m)) {
          for (const e of [25, 50, 100]) {
            const { textos, linhas } = daSombra(desenharCorteLateral(m, c.x, { S: escalaDaVista(e), semTitulo: true, prefixo: 'c' }).primitivas());
            const medidas = textos.filter((t) => !/ – /.test(t.t));
            for (let i = 0; i < medidas.length; i++) {
              const cx = caixa(medidas[i]);
              for (let j = i + 1; j < medidas.length; j++) if (cruzam(cx, caixa(medidas[j]))) ruins.push(`${g} ${arranque} ${c.rotulo} 1:${e} ${medidas[i].t}×${medidas[j].t}`);
              const toca = linhas.some((l) => l.pts.some((p, k) => k > 0 && Array.from({ length: 41 }, (_, s) => s / 40).some((f) => {
                const [x, y] = [l.pts[k - 1][0] + (p[0] - l.pts[k - 1][0]) * f, l.pts[k - 1][1] + (p[1] - l.pts[k - 1][1]) * f];
                return x > cx[0] + 0.3 && x < cx[0] + cx[2] - 0.3 && y > cx[1] + 0.3 && y < cx[1] + cx[3] - 0.3;
              })));
              if (toca) ruins.push(`${g} ${arranque} ${c.rotulo} 1:${e} ${medidas[i].t} no traço`);
            }
          }
        }
      }
    }
    expect(ruins).toEqual([]);
  }, 120000);

  it('a barra de pé com sombra não leva chamada; com as sombras desligadas a chamada volta', () => {
    for (const [, m] of CORTES) {
      for (const c of cortesPadrao(m)) {
        const rotulos = (graficos?: SobreposicaoDaVista) =>
          desenharCorteLateral(m, c.x, { S: S25, semTitulo: true, prefixo: 'c', chamadas: true, graficos }).chamadas.map((q) => q.rotulo);
        const comSombra = deCadaUma(m, c.x).map((b) => textoDaChamada(m, b.posicao, elementoDaBarra(b)));
        const com = rotulos();
        for (const r of comSombra) expect(com).not.toContain(r);
        const sem = rotulos({ anotacoes: { sombras: { visivel: false } } });
        for (const r of comSombra) expect(sem).toContain(r);
      }
    }
  });

  it('somem com o "Sombras" desligado e com a armadura escondida', () => {
    const m = CORTES[0][1];
    const x = cortesPadrao(m)[0].x;
    expect(daSombra(corte(m, x)).linhas.length).toBeGreaterThan(0);
    expect(daSombra(corte(m, x, { anotacoes: { sombras: { visivel: false } } })).linhas.length).toBe(0);
    expect(daSombra(corte(m, x, { ocultos: ['armadura'] })).linhas.length).toBe(0);
  });
});

describe('o U da canaleta no corte do contraforte', () => {
  it('as pernas dos dois vãos (φ/2 de cada lado do eixo) aparecem como linha em cada fiada de canaleta; no painel, ponto', () => {
    const m = muro('aula123');
    const cf = cortesPadrao(m).find((c) => c.rotulo.startsWith('Contraforte'))!;
    const fiadas = [...new Set(m.barras.filter((b) => b.papel === 'HORIZ').map((b) => Math.floor(b.eixo[0][2] / 200)))];
    const noCf = barrasNoCorte(m, cf.x);
    for (const f of fiadas) {
      const pernas = noCf.linhas.filter((l) => l.barra.papel === 'HORIZ' && Math.floor(l.barra.eixo[0][2] / 200) === f);
      // contraforte do meio: a perna do vão da esquerda e a do vão da direita, cada uma de um U
      expect(pernas.length, `fiada ${f}`).toBe(2);
      for (const l of pernas) expect(Math.max(...l.pts.map((p) => p[0])) - Math.min(...l.pts.map((p) => p[0])), `fiada ${f}`).toBeGreaterThan(300);
    }
    const painel = cortesPadrao(m).find((c) => c.rotulo === 'Painel')!;
    const noPainel = barrasNoCorte(m, painel.x);
    expect(noPainel.linhas.filter((l) => l.barra.papel === 'HORIZ')).toEqual([]);
    expect(noPainel.pontos.filter((p) => p.barra.papel === 'HORIZ').length).toBe(fiadas.length);
  });
});

describe('sombras na planta', () => {
  const planta = (m: Modelo, f: number) => desenharPlanta(m, f, { S: escalaDaVista(50), semTitulo: true, prefixo: 'p' }).primitivas();
  const fiadasComCanaleta = (m: Modelo) => [...new Set(m.barras.filter((b) => b.papel === 'HORIZ').map((b) => Math.floor(b.eixo[0][2] / 200)))];

  it('fiada sem canaleta não tem sombra', () => {
    const m = muro('aula122');
    expect(fiadasComCanaleta(m)).not.toContain(0);
    expect(daSombra(planta(m, 0)).linhas.length).toBe(0);
  });

  it('a barra da canaleta emendada (muro de 20 m): as peças em fileiras seguidas, sobrepostas no traspasse', () => {
    const m = muro('aula122', { L_total: 20, junta_cada: 0 });
    const f = fiadasComCanaleta(m)[0];
    const { linhas, textos } = daSombra(planta(m, f));
    const naFiada = m.barras.filter((b) => b.papel === 'HORIZ' && Math.floor(b.eixo[0][2] / 200) === f);
    expect(linhas.length).toBe(naFiada.length);
    expect(linhas.length).toBeGreaterThan(1);
    const pecas = linhas.map((l) => ({ x0: Math.min(...l.pts.map((p) => p[0])), x1: Math.max(...l.pts.map((p) => p[0])), y: l.pts[0][1] })).sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < pecas.length; i++) {
      expect(pecas[i].x0).toBeLessThan(pecas[i - 1].x1);           // sobrepostas: o traspasse
      expect(Math.abs(pecas[i].y - pecas[i - 1].y)).toBeGreaterThan(T); // em fileiras diferentes
    }
    for (const b of naFiada) expect(textos.some((t) => t.t === `${b.posicao} – 1 Ø${String(b.diametro).replace('.', ',')} C=${Math.round(b.comprimento / 10)}`)).toBe(true);
  });

  it('contrafortes: o U de cada vão é uma sombra só por posição, com a soma, e as medidas da lista (perna, base, perna)', () => {
    const m = muro('aula123', { L_total: 6 });
    const f = fiadasComCanaleta(m)[0];
    const { linhas, textos } = daSombra(planta(m, f));
    const emU = m.barras.filter((b) => b.papel === 'HORIZ' && Math.floor(b.eixo[0][2] / 200) === f);
    expect(emU.length).toBeGreaterThan(1);
    expect(emU.every((b) => b.eixo.length > 2)).toBe(true);
    const posicoes = [...new Set(emU.map((b) => b.posicao))];
    expect(linhas.length).toBe(posicoes.length);
    for (const p of posicoes) {
      const n = emU.filter((b) => b.posicao === p).length;
      expect(textos.filter((t) => t.t.startsWith(`${p} – ${n} Ø`)).length).toBe(1);
      const forma = formaDaBarra(emU.find((b) => b.posicao === p)!);
      expect(forma.trechos.length).toBe(3);
      for (const medida of forma.trechos) expect(textos.some((t) => t.t === String(medida))).toBe(true);
    }
  });
});
