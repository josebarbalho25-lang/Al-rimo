/*
  ARMAÇÃO DA SAPATA — o que quebraria a prancha de armação na obra:
  - longitudinal sem sombra, ou em duas (o armador corta a mais ou a menos);
  - quantidade ou C= da sombra diferente das barras que ela representa (o desenho diz uma coisa, a lista outra);
  - emenda que não se lê: as peças da barra emendada longe uma da outra, ou uma por cima da outra na mesma fileira;
  - a face trocada: a barra de cima desenhada embaixo da sapata;
  - legenda escrita em cima de outra (ninguém lê) — em qualquer muro e em qualquer escala;
  - a sombra do estribo com medida diferente da lista de ferros (formaDaBarra), ou a faixa com outro c/ que a chamada;
  - traço que o DXF não sabe em que camada pôr.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { PX_POR_MM, escalaDaVista, type Primitiva } from '@/pranchas/tipos';
import { formaDaBarra } from '@/pranchas/formaDaBarra';
import { desenharArmacaoDaSapata, legendaDaSombra, sombrasDaSapata } from '../armacaoDaSapata';
import { espacamentoDaPosicao, textoDaChamada } from '../chamadas';
import { faixa } from '../geometria';
import { Prancha } from '../prancha';
import { textos, textosForaDoViewBox, xmlBemFormado } from './lerSvg';

const muro = (c: string, extra: Record<string, number | string> = {}): Modelo =>
  gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6, ...extra });

const MUROS: [string, Modelo][] = [
  ['balanço 6 m', muro('aula122')],
  ['balanço 20 m sem junta (longitudinal emendada)', muro('aula122', { L_total: 20, junta_cada: 0 })],
  ['balanço 20 m com junta a cada 6 m', muro('aula122', { L_total: 20, junta_cada: 6 })],
  ['balanço, transversal reta', muro('aula122', { sap_transv: 'Reta' })],
  ['contrafortes 6 m (torção)', muro('aula123')],
  ['contrafortes 20 m sem junta', muro('aula123', { L_total: 20, junta_cada: 0 })],
  ['contrafortes, nó de cachorro', muro('aula123', { arranque: 'Nó de cachorro' })],
  ['sapata estreita (B = 40)', muro('alvo_compara15_sapata_a')],
];

/** As escalas em que a vista tem de sair legível: a da tela e as da prancha. */
const ESCALAS: [string, number | undefined][] = [['tela', undefined], ['1:25', 25], ['1:50', 50], ['1:100', 100]];

const desenho = (m: Modelo, e?: number, prefixo = 'v') =>
  desenharArmacaoDaSapata(m, e === undefined ? {} : { S: escalaDaVista(e), semTitulo: true, prefixo });

type Texto = Extract<Primitiva, { k: 'texto' }>;
const textosDe = (ps: Primitiva[]) => ps.filter((q): q is Texto => q.k === 'texto');

/** Caixa do texto, a mesma estimativa da Prancha (Prancha.largura; deitado ou a 90°). */
function caixa(q: Texto): [number, number, number, number] {
  const w = Prancha.largura(q.t, q.altura, q.negrito);
  const a0 = q.ancora === 'start' ? 0 : q.ancora === 'middle' ? -w / 2 : -w;
  const [x, y] = q.p;
  return q.angulo === 0 ? [x + a0, y - 0.85 * q.altura, x + a0 + w, y + 0.25 * q.altura] : [x - 0.85 * q.altura, y - a0 - w, x + 0.25 * q.altura, y - a0];
}

function textosSobrepostos(ps: Primitiva[]): string[] {
  const ts = textosDe(ps);
  const out: string[] = [];
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const [a, b] = [caixa(ts[i]), caixa(ts[j])];
      const dx = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      const dy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (dx > 0.5 && dy > 0.5) out.push(`"${ts[i].t}" × "${ts[j].t}"`);
    }
  }
  return out;
}

/** Um grupo do SVG pelos atributos de abertura (os grupos da armação não têm grupo dentro). */
function grupo(svg: string, atributos: string): string {
  const i = svg.indexOf(`<g ${atributos}`);
  return i < 0 ? '' : svg.slice(i, svg.indexOf('</g>', i));
}

/** As sombras desenhadas: id da barra → pontos do traço. */
function sombrasDesenhadas(svg: string): Map<string, [number, number][]> {
  const out = new Map<string, [number, number][]>();
  for (const q of grupo(svg, 'data-camada="sombras"').matchAll(/<polyline points="([^"]+)"[^>]*?data-id="([^"]+)"/g)) {
    out.set(q[2], q[1].split(' ').map((p) => p.split(',').map(Number) as [number, number]));
  }
  return out;
}

/** Camadas que o DXF recebe deste desenho: as das vistas (paraPrancha.test.ts) e a das sombras. 'geral' seria traço
 *  que ninguém classificou. */
const CAMADAS = new Set(['alvenaria', 'concreto', 'aco', 'sombras', 'cotas', 'textos']);
const camadaDe = (q: Primitiva): string | undefined =>
  q.k === 'linha' || q.k === 'polilinha' ? q.e.camada : q.k === 'circulo' ? q.e?.camada : 'camada' in q ? q.camada : undefined;

describe.each(MUROS)('%s', (_, m) => {
  const familias = sombrasDaSapata(m);
  const sombras = familias.flat();
  const longs = m.barras.filter((b) => b.papel === 'SAP_LONG');

  it('toda longitudinal da sapata está em UMA sombra, e a sombra é de barras iguais (posição, C, Ø, trecho, estação)', () => {
    const ids = sombras.flatMap((s) => s.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(longs.map((b) => b.id).sort());
    const porId = new Map(longs.map((b) => [b.id, b]));
    for (const s of sombras) {
      for (const id of s.ids) {
        const b = porId.get(id)!;
        expect([b.posicao, b.comprimento, b.trecho, b.diametro]).toEqual([s.posicao, s.comprimento, s.trecho, s.diametro]);
        const [xa, xb] = faixa(b.eixo, 0);
        expect(Math.abs((xa + xb) / 2 - (s.xa + s.xb) / 2)).toBeLessThan(10);
      }
      expect(legendaDaSombra(s)).toBe(`${s.posicao} – ${s.ids.length} Ø${String(s.diametro).replace('.', ',')} C=${Math.round(s.comprimento / 10)}`);
    }
  });

  it('a face é a do z da barra; as de cima desenhadas acima da sapata, as de baixo embaixo', () => {
    const zs = longs.map((b) => b.eixo[0][2]);
    const corte = (Math.max(...zs) + Math.min(...zs)) / 2;
    for (const s of sombras) {
      for (const id of s.ids) {
        const z = longs.find((b) => b.id === id)!.eixo[0][2];
        // uma camada só (sem a de cima) é a de baixo
        expect(Math.max(...zs) - Math.min(...zs) > 1 && z > corte ? 'superior' : 'inferior', `${s.posicao} z=${z}`).toBe(s.face);
      }
    }
    const desenhadas = sombrasDesenhadas(desenho(m, 25).svg());
    const y = (face: string) => sombras.filter((s) => s.face === face).map((s) => desenhadas.get(s.ids[0])![0][1]);
    // o topo da sapata é o y = 0 do desenho: as de cima acima dele, as de baixo abaixo do fundo
    for (const q of y('superior')) expect(q).toBeLessThan(0);
    for (const q of y('inferior')) expect(q).toBeGreaterThan(-m.dims.sapata.z0 * escalaDaVista(25));
  });

  it.each(ESCALAS)('legendas (%s): cada sombra com a sua — a quantidade e o C das barras dela', (_e, e) => {
    const ts = textosDe(desenho(m, e).primitivas()).map((q) => q.t);
    // as das longitudinais (o estribo de torção também sai sem "c/" na chamada — chamadas.ts, DISTRIBUIDA)
    const nsLong = new Set(longs.map((b) => b.posicao));
    const legendas = ts.filter((t) => /^N\d+ – \d+ Ø[\d,]+ C=\d+$/.test(t) && nsLong.has(t.split(' ')[0]));
    expect(legendas.sort()).toEqual(sombras.map(legendaDaSombra).sort());
    expect(legendas.reduce((s, t) => s + Number(t.split(' ')[2]), 0)).toBe(longs.length);
  });

  it.each(ESCALAS)('nenhum texto em cima de outro, nada fora do desenho, SVG bom (%s)', (_e, e) => {
    const pr = desenho(m, e);
    expect(textosSobrepostos(pr.primitivas())).toEqual([]);
    const svg = pr.svg();
    expect(xmlBemFormado(svg)).toBeNull();
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    expect(textosForaDoViewBox(svg)).toEqual([]);
  });

  it('a barra emendada: as peças em fileiras vizinhas, sobrepostas no traspasse', () => {
    const desenhadas = sombrasDesenhadas(desenho(m, 50).svg());
    expect(desenhadas.size).toBe(sombras.length);
    for (const fam of familias) {
      for (let j = 1; j < fam.length; j++) {
        const [a, b] = [desenhadas.get(fam[j - 1].ids[0])!, desenhadas.get(fam[j].ids[0])!];
        // uma fileira para longe da sapata: para baixo nas de baixo, para cima nas de cima
        expect(b[0][1] - a[0][1]).toBeCloseTo(fam[0].face === 'inferior' ? 34 : -34, 6);
        expect(fam[j].xa).toBeLessThan(fam[j - 1].xb);
      }
    }
  });

  it('a faixa de cada estribo: a quantidade do grupo e o c/ da chamada', () => {
    const ts = textosDe(desenho(m, 50).primitivas()).map((q) => q.t);
    const transv = m.barras.filter((b) => b.papel === 'SAP_TRANSV' || b.papel === 'SAP_TORCAO');
    const grupos = new Map<string, typeof transv>();
    for (const b of transv) grupos.set(`${b.papel}|${b.posicao}`, [...(grupos.get(`${b.papel}|${b.posicao}`) ?? []), b]);
    expect(grupos.size).toBeGreaterThan(0);
    for (const bs of grupos.values()) {
      const s = espacamentoDaPosicao(bs);
      const inicio = `${bs[0].posicao} – ${bs.length} Ø${String(bs[0].diametro).replace('.', ',')}`;
      const rotulo = ts.find((t) => t === inicio || t.startsWith(`${inicio} c/`));
      expect(rotulo, inicio).toBeDefined();
      if (s !== null) expect(rotulo).toBe(`${inicio} c/${s}`);
    }
  });

  it('a sombra do estribo: as pernas da lista de ferros (a maior deitada, a menor em pé) e a legenda da chamada', () => {
    const svg = desenho(m, 25).svg();
    const posicoes = [...new Set(m.barras.filter((b) => b.papel === 'SAP_TRANSV' || b.papel === 'SAP_TORCAO').map((b) => b.posicao))];
    expect(posicoes.length).toBeGreaterThan(0);
    for (const n of posicoes) {
      const b = m.barras.find((q) => q.posicao === n)!;
      const g = textos(grupo(svg, `data-camada="sombra-estribo" data-posicao="${n}"`));
      expect(g.map((q) => q.t), n).toContain(textoDaChamada(m, n, 'sapata'));
      const f = formaDaBarra(b);
      const deitados = g.filter((q) => !q.vertical).map((q) => q.t);
      if (f.trechos.length === 1) {
        expect(deitados).toContain(String(f.trechos[0]));
        continue;
      }
      const [W, H] = [Math.max(f.trechos[0], f.trechos[1]), Math.min(f.trechos[0], f.trechos[1])];
      expect(deitados).toContain(String(W));
      expect(g.filter((q) => q.vertical).map((q) => q.t)).toEqual([String(H)]);
    }
  });

  it('a seção corta fora do traspasse: um ponto por longitudinal, e os rótulos das camadas contam todas', () => {
    const ts = textosDe(desenho(m, 25).primitivas()).map((q) => q.t).filter((t) => /^\d+ N\d+$/.test(t));
    expect(ts.length).toBeGreaterThan(0);
    // as longitudinais do 1º trecho perto do começo da sapata (antes de qualquer emenda): uma por linha
    const doTrecho = longs.filter((b) => b.trecho === Math.min(...longs.map((q) => q.trecho)));
    const x = Math.min(...doTrecho.map((b) => faixa(b.eixo, 0)[0])) + 300;
    const linhas = doTrecho.filter((b) => faixa(b.eixo, 0)[0] < x && x < faixa(b.eixo, 0)[1]).length;
    expect(ts.reduce((s, t) => s + Number(t.split(' ')[0]), 0)).toBe(linhas);
  });

  it('toda primitiva numa camada que o DXF conhece; a sombra na dela, a barra de dentro no aço', () => {
    const ps = desenho(m, 50).primitivas();
    expect(ps.length).toBeGreaterThan(50);
    for (const q of ps) expect(CAMADAS.has(camadaDe(q)!), `${q.k} ${camadaDe(q)}`).toBe(true);
    const polis = ps.filter((q): q is Extract<Primitiva, { k: 'polilinha' }> => q.k === 'polilinha');
    expect(polis.filter((q) => q.e.camada === 'sombras').length).toBeGreaterThanOrEqual(sombras.length + 1);
    expect(polis.some((q) => q.e.camada === 'aco' && q.e.cor === '#c00000')).toBe(true);
  });
});

describe('opções da vista', () => {
  const m = MUROS[0][1];

  it('na prancha: sem o título da vista, o nome da seção fica; prefixo nos padrões; a hachura em vetor sem <pattern>', () => {
    const tela = desenharArmacaoDaSapata(m).svg();
    expect(tela).toContain('>Armação da sapata</text>');
    expect(tela).toContain('>cotas em cm</text>');
    const pr = desenharArmacaoDaSapata(m, { S: escalaDaVista(25), semTitulo: true, prefixo: 'v7' }).svg();
    expect(pr).not.toContain('Armação da sapata');
    expect(pr).not.toContain('cotas em cm');
    expect(pr).toContain('>Seção transversal</text>');
    expect(pr).toContain('url(#v7-conc)');
    expect(pr).not.toContain('url(#des-');
    const vetor = desenharArmacaoDaSapata(m, { S: escalaDaVista(25), semTitulo: true, prefixo: 'v7', hachuraVetorial: true }).svg();
    expect(vetor).not.toContain('<pattern');
    expect(vetor).not.toContain('url(#v7-conc)');
  });

  it('escala fixa: 1:25 é 1:25 no papel — a sapata mede, em mm de papel, o comprimento ÷ 25; a letra não muda', () => {
    const comprimento = (e: number) => {
      const p = desenho(m, e).primitivas().find((q): q is Extract<Primitiva, { k: 'polilinha' }> => q.k === 'polilinha' && q.e.camada === 'concreto' && q.fechada)!;
      const xs = p.pts.map((q) => q[0]);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(comprimento(25) / PX_POR_MM).toBeCloseTo(m.dims.L_real / 25, 6);
    expect(comprimento(25) / comprimento(50)).toBeCloseTo(2, 9);
    const alturas = (e: number) => textosDe(desenho(m, e).primitivas()).map((q) => q.altura);
    expect(alturas(50)).toEqual(alturas(25));
  });

  it('a sombra é mais grossa que a barra dentro da sapata', () => {
    const svg = desenho(m, 25).svg();
    const larguras = (g: string) => [...grupo(svg, g).matchAll(/<polyline [^>]*stroke-width="([\d.]+)"/g)].map((q) => Number(q[1]));
    expect(Math.min(...larguras('data-camada="sombras"'))).toBeGreaterThan(Math.max(...larguras('data-camada="barras"')));
  });

  it('muro sem sapata (modelo vazio): prancha vazia, sem erro', () => {
    const vazio: Modelo = { ...m, pecas: m.pecas.filter((p) => p.tipo !== 'SAPATA'), barras: [] };
    expect(desenharArmacaoDaSapata(vazio).primitivas()).toEqual([]);
  });
});

describe('qualquer muro do gabarito', () => {
  it('sai sem erro, sem texto encavalado e com toda longitudinal numa sombra, na tela e em 1:25, 1:50 e 1:100', () => {
    const ruins: string[] = [];
    let n = 0;
    for (const c of cenariosDoGabarito()) {
      let m: Modelo;
      try {
        m = muro(c);
      } catch {
        continue;   // cenário que a modulação não monta: o teste dela acusa
      }
      n++;
      const nas = sombrasDaSapata(m).flat().reduce((s, q) => s + q.ids.length, 0);
      if (nas !== m.barras.filter((b) => b.papel === 'SAP_LONG').length) ruins.push(`${c}: ${nas} longitudinais nas sombras`);
      for (const [nome, e] of ESCALAS) {
        const pr = desenho(m, e);
        const encavalados = textosSobrepostos(pr.primitivas());
        if (encavalados.length) ruins.push(`${c} ${nome}: ${encavalados.join('; ')}`);
        if (/NaN|undefined|Infinity/.test(pr.svg())) ruins.push(`${c} ${nome}: número podre no SVG`);
      }
    }
    expect(n).toBeGreaterThan(20);
    expect(ruins).toEqual([]);
  }, 60_000);
});
