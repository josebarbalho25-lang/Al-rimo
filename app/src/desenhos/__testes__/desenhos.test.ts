/*
  TESTES DOS DESENHOS — o que um desenho errado faria na obra:
  - SVG malformado: a aba fica em branco (o navegador não desenha XML quebrado);
  - cota com número diferente do modelo: o pedreiro levanta outro muro;
  - texto fora do viewBox: cota cortada na borda, ninguém lê;
  - peça que some da elevação: bloco que não é contado nem conferido.
  Os modelos são montados à mão (modeloDeExemplo) enquanto a modulação não fica pronta; quando ela existir,
  o último bloco roda os mesmos testes com o modelo dela, a partir do gabarito do Excel.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import { corteLateral, cortesPadrao, isometrico, planta, vistaFrontal } from '../index';
import { cadeia } from '../vistaFrontal';
import { quemNaFrente, camera, desenharIsometrico } from '../isometrico';
import { ehCostura, fatiarEmZ, solidoDaPeca, solidosDoModelo, secao } from '../geometria';
import { cm } from '../formato';
import { modeloDeExemplo } from './modeloDeExemplo';
import { ids, rotulos, textos, textosForaDoViewBox, xmlBemFormado } from './lerSvg';

// ── modelos ───────────────────────────────────────────────────────────────────────────────────────────────────────

const MODELOS: Record<string, Modelo> = {
  'balanço 19x39 com junta': modeloDeExemplo({ tipo: 'balanco', H_solo: 1500, juntaNaCelula: 13, terreno: true }),
  'contrafortes 19x39 enterrado': modeloDeExemplo({ tipo: 'contrafortes' }),
  'contrafortes 19x39 aparente': modeloDeExemplo({ tipo: 'contrafortes', aparente: true, celulasPorVao: 10, tenr: 590 }),
};

function todosOsDesenhos(m: Modelo): Record<string, string> {
  const out: Record<string, string> = { frontal: vistaFrontal(m), planta: planta(m), planta2: planta(m, 1), iso: isometrico(m) };
  for (const [k, c] of cortesPadrao(m).entries()) {
    out[`corte${k}`] = corteLateral(m, c.x);
    out[`iso-corte${k}`] = isometrico(m, { corteX: c.x });
  }
  out['iso-fundo-esquerda'] = isometrico(m, { vista: 'fundo-esquerda', corteX: m.dims.L_real / 3 });
  return out;
}

describe.each(Object.entries(MODELOS))('%s', (_, m) => {
  const svgs = todosOsDesenhos(m);

  it.each(Object.keys(svgs))('%s: SVG bem formado, sem número podre', (k) => {
    const svg = svgs[k];
    expect(xmlBemFormado(svg)).toBeNull();
    expect(svg).not.toMatch(/NaN|undefined|Infinity|null/);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it.each(Object.keys(svgs))('%s: nenhum texto fora do viewBox', (k) => {
    expect(textos(svgs[k]).length).toBeGreaterThan(0);
    expect(textosForaDoViewBox(svgs[k])).toEqual([]);
  });

  it('vista frontal: comprimento, alturas e eixo a eixo saem do modelo', () => {
    const r = rotulos(svgs.frontal);
    expect(r).toContain(cm(m.dims.L_real));
    expect(r).toContain(`muro ${cm(m.dims.H_muro)}`);
    expect(r).toContain(`solo ${cm(m.dims.H_solo)}`);
    if (m.dims.trechos.length > 1) for (const t of m.dims.trechos) expect(r).toContain(cm(t.x1 - t.x0));
    const cf = m.dims.contrafortes;
    if (cf.length >= 2) {
      const passo = cf[1].x - cf[0].x;
      expect(r.some((q) => q === cm(passo) || q.endsWith(`×${cm(passo)}`))).toBe(true);
    }
    // fiadas numeradas 1..n
    for (let i = 1; i <= m.dims.n_fiadas; i++) expect(r).toContain(String(i));
  });

  it('vista frontal: toda peça de alvenaria da face aparece (e a haste enterrada não é pintada)', () => {
    const t = m.familia.t;
    const visto = ids(svgs.frontal);
    for (const s of solidosDoModelo(m)) {
      const alv = ['BLOCO', 'MEIO_BLOCO', 'CANALETA', 'MEIA_CANALETA', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA_CORTADA'].includes(s.peca.tipo);
      if (!alv) continue;
      if (s.min[1] < t - 1) expect(visto.has(s.peca.id), s.peca.id).toBe(true);
      else expect(visto.has(s.peca.id), s.peca.id).toBe(false);
    }
    for (const b of m.barras.filter((q) => q.papel === 'VERT_MURO' || q.papel === 'ESPERA')) expect(visto.has(b.id)).toBe(true);
  });

  it('corte no painel: t, B, a, sapata, dente, alturas e d com os números do modelo', () => {
    const r = rotulos(svgs.corte0);
    const { sapata } = m.dims;
    const t = m.familia.t;
    expect(r).toContain(`t = ${cm(t)}`);
    expect(r).toContain(`B = ${cm(sapata.y1 - sapata.y0)}`);
    expect(r).toContain(cm(sapata.y1 - t / 2));                 // a_ater: eixo do muro → borda aterrada
    expect(r).toContain(cm(300));                               // h_sap do exemplo
    expect(r).toContain(cm(500));                               // h_den
    expect(r).toContain(cm(250));                               // b_den
    expect(r).toContain(`solo ${cm(m.dims.H_solo)}`);
    expect(r).toContain(`muro ${cm(m.dims.H_muro)}`);
    const dEsperado = Math.max(...m.barras.filter((b) => b.papel === 'VERT_MURO' && Math.abs(b.eixo[0][0] - cortesPadrao(m)[0].x) < 1).map((b) => b.eixo[0][1]));
    expect(r).toContain(`d = ${cm(dEsperado)}`);
    // o corte mostra a barra vertical do painel e a espera
    const visto = ids(svgs.corte0);
    expect(m.barras.some((b) => b.papel === 'VERT_MURO' && visto.has(b.id))).toBe(true);
    expect(m.barras.some((b) => b.papel === 'ESPERA' && visto.has(b.id))).toBe(true);
  });

  it('isométrico cortado: nada do lado de quem olha sobra', () => {
    const c = cortesPadrao(m)[0].x;
    const visto = ids(svgs['iso-corte0']);
    for (const s of solidosDoModelo(m)) {
      if (s.min[0] >= c && ['BLOCO', 'MEIO_BLOCO', 'CANALETA', 'MEIA_CANALETA'].includes(s.peca.tipo)) {
        expect(visto.has(s.peca.id), s.peca.id).toBe(false);
      }
    }
  });
});

describe('contrafortes', () => {
  const m = MODELOS['contrafortes 19x39 enterrado'];
  const ap = MODELOS['contrafortes 19x39 aparente'];

  it('cortes padrão: um no painel (na barra mais perto do meio) e um no contraforte intermediário', () => {
    const c = cortesPadrao(m);
    expect(c.map((q) => q.rotulo)).toEqual(['Painel', 'Contraforte C2']);
    expect(c[1].x).toBe(m.dims.contrafortes[1].x);
    expect(m.barras.some((b) => b.papel === 'VERT_MURO' && Math.abs(b.eixo[0][0] - c[0].x) < 0.5)).toBe(true);
  });

  it('corte no contraforte enterrado: tenr e d até as barras da ponta', () => {
    const r = rotulos(corteLateral(m, m.dims.contrafortes[1].x));
    expect(r).toContain('contraforte 59');
    expect(r).toContain('d = 49,5');          // 590 − 95 (centro do furo da ponta)
    expect(r.some((q) => q.includes('C2'))).toBe(true);
  });

  it('corte no contraforte aparente: d medido da ponta comprimida', () => {
    const r = rotulos(corteLateral(ap, ap.dims.contrafortes[1].x));
    expect(r).toContain('contraforte 59');
    expect(r).toContain('d = 52');            // barras a 7 cm da face do solo: 59 − 7
  });

  it('planta: eixo a eixo, comprimento total, t e tenr', () => {
    const r = rotulos(planta(m));
    expect(r).toContain('2×160');
    expect(r).toContain(cm(m.dims.L_real));
    expect(r).toContain('t = 19');
    expect(r).toContain('contraforte 59');
    expect(r).toContain('Planta — 1ª fiada');
  });

  it('família com encaixe provisório leva o carimbo; as do Revit (hoje todas) não', () => {
    const prov = { ...ap, familia: { ...ap.familia, provisoria: true } };
    expect(rotulos(vistaFrontal(prov))).toContain('PROVISÓRIO');
    expect(rotulos(vistaFrontal(ap))).not.toContain('PROVISÓRIO');
    expect(rotulos(vistaFrontal(m))).not.toContain('PROVISÓRIO');
  });
});

describe('peças da conta do desenho', () => {
  it('o conferente de XML e o de viewBox acusam quando devem', () => {
    expect(xmlBemFormado('<svg><g></svg>')).not.toBeNull();
    expect(xmlBemFormado('<svg><text>a & b</text></svg>')).not.toBeNull();
    expect(xmlBemFormado('<svg><rect x=1/></svg>')).not.toBeNull();
    expect(textosForaDoViewBox('<svg viewBox="0 0 100 100"><text x="95" y="50" font-size="12" text-anchor="start">999</text></svg>')).toEqual(['999']);
  });

  it('cadeia de cotas: corridas iguais viram n×s', () => {
    expect(cadeia([0, 95, 495, 895, 1295, 1695])).toEqual([
      { a: 0, b: 95, rotulo: '9,5' },
      { a: 95, b: 1695, rotulo: '4×40' },
    ]);
  });

  it('cm(): vírgula decimal, sem casa à toa', () => {
    expect([cm(4990), cm(95), cm(495), cm(0), cm(-0.2)]).toEqual(['499', '9,5', '49,5', '0', '0']);
  });

  it('fatiar em Z: fatias nas juntas das fiadas, sem sobra nem buraco; a costura não é aresta da peça', () => {
    const geo = { chave: 'd', eixo: 'X' as const, perfil: { contorno: [[0, 0], [200, 0], [200, 1530], [0, 1530]] as [number, number][] }, extensao: 1360, volume_mm3: 0 };
    const dreno = solidoDaPeca({ id: 'DRN', tipo: 'DRENO', grupo: 'drenagem', geometria: 'd', origem: [140, 140, 0], giro: 0, trecho: 1 }, geo);
    const f = fatiarEmZ(dreno, 200);
    expect(f.map((q) => [q.min[2], q.max[2]])).toEqual([0, 200, 400, 600, 800, 1000, 1200, 1400].map((z) => [z, Math.min(z + 200, 1530)]));
    for (const q of f) {
      expect([q.min[0], q.max[0], q.min[1], q.max[1]]).toEqual([140, 1500, 140, 340]);
      expect(q.peca.id).toBe('DRN');                        // a fatia continua sendo a mesma peça (seleção, teste)
    }
    expect(ehCostura(f[0], [140, 140, 200], [1500, 140, 200])).toBe(true);
    expect(ehCostura(f[0], [140, 140, 0], [1500, 140, 0])).toBe(false);     // o fundo é aresta de verdade
    expect(fatiarEmZ(solidoDaPeca({ id: 'b', tipo: 'BLOCO', grupo: 'muro', geometria: 'b', origem: [0, 0, 10], giro: 0, trecho: 1 },
      { ...geo, eixo: 'Z', extensao: 190 }), 200)).toHaveLength(1);        // bloco não atravessa junta: fica inteiro
  });

  it('vista frontal com contrafortes: a cadeia das barras parte do eixo do contraforte', () => {
    const m = MODELOS['contrafortes 19x39 enterrado'];
    const c1 = m.dims.contrafortes[0].x;
    const prox = Math.min(...m.barras.filter((b) => b.papel === 'VERT_MURO' && b.eixo[0][0] > c1 + 1).map((b) => b.eixo[0][0]));
    const r = rotulos(vistaFrontal(m));
    expect(r.some((q) => q === cm(prox - c1) || q.endsWith(`×${cm(prox - c1)}`))).toBe(true);
  });

  it('giro de 90° com origem no canto mínimo da caixa girada (mesma leitura da modulação)', () => {
    const geo = { chave: 'b', eixo: 'Z' as const, perfil: { contorno: [[0, 0], [390, 0], [390, 190], [0, 190]] as [number, number][] }, extensao: 190, volume_mm3: 0 };
    const s = solidoDaPeca({ id: 'p', tipo: 'BLOCO', grupo: 'contraforte', geometria: 'b', origem: [1000, 200, 10], giro: 90, trecho: 1 }, geo);
    expect(s.min).toEqual([1000, 200, 10]);
    expect(s.max).toEqual([1190, 590, 200]);
    expect(s.eixo).toBe('Z');
  });

  it('seção: o furo do bloco vira vão; o perfil da canaleta sai inteiro', () => {
    const m = MODELOS['balanço 19x39 com junta'];
    const bloco = solidosDoModelo(m).find((s) => s.peca.tipo === 'BLOCO')!;
    const r = secao(bloco, 'X', bloco.min[0] + 100);             // atravessa o 1º furo
    expect(r.length).toBe(2);                                    // as duas paredes do bloco
    const can = solidosDoModelo(m).find((s) => s.peca.tipo === 'CANALETA')!;
    expect(secao(can, 'X', can.min[0] + 100)[0].contorno.length).toBe(8);
    expect(secao(bloco, 'X', bloco.max[0])).toEqual([]);         // encostar não é cortar
  });

  it('pintor do isométrico: entre vizinhos, quem está do lado de quem olha vem depois', () => {
    const { v } = camera('frente-direita');
    const caixa = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
      ({ min: [x0, y0, z0], max: [x1, y1, z1] }) as never;
    expect(quemNaFrente(caixa(400, 0, 0, 790, 190, 190), caixa(0, 0, 0, 390, 190, 190), v)).toBe(1);     // à direita
    expect(quemNaFrente(caixa(0, 0, 200, 390, 190, 390), caixa(0, 0, 0, 390, 190, 190), v)).toBe(1);    // em cima
    expect(quemNaFrente(caixa(0, 200, 0, 390, 590, 190), caixa(0, 0, 0, 390, 190, 190), v)).toBe(-1);   // atrás (haste)
    // em diagonal (de cima à esquerda × de baixo à direita): as sombras não se cruzam, nenhuma ordem é imposta
    expect(quemNaFrente(caixa(0, 0, 210, 390, 190, 400), caixa(400, 0, 10, 790, 190, 200), v)).toBe(0);
  });

  it('isométrico: a peça de trás é pintada antes da que a tapa', () => {
    const m = MODELOS['contrafortes 19x39 enterrado'];
    const svg = desenharIsometrico(m).svg();
    const ordem = [...svg.matchAll(/data-id="([^"]+)"/g)].map((q) => q[1]);
    const primeira = (id: string) => ordem.indexOf(id);
    const sol = solidosDoModelo(m);
    // haste do contraforte (atrás do muro, mesma fiada) antes do bloco do muro na frente dela
    const haste = sol.find((s) => s.peca.grupo === 'contraforte' && s.peca.tipo === 'MEIO_BLOCO' && s.peca.fiada === 0)!;
    const frente = sol.find((s) => s.peca.grupo === 'muro' && s.peca.fiada === 0 && s.min[0] <= haste.min[0] && s.max[0] >= haste.max[0]);
    if (frente) expect(primeira(haste.peca.id)).toBeLessThan(primeira(frente.peca.id));
    // sapata antes de qualquer bloco
    const sap = sol.find((s) => s.peca.tipo === 'SAPATA')!;
    expect(primeira(sap.peca.id)).toBeLessThan(Math.min(...sol.filter((s) => s.peca.tipo === 'BLOCO').map((s) => primeira(s.peca.id)).filter((k) => k >= 0)));
  });

  it('modelo vazio ou mínimo não derruba nenhum desenho', () => {
    const vazio: Modelo = {
      versao: 'x', familia: { nome: '19x39', t: 190, L: 390, Lm: 190, m: 200, h: 190, hf: 35, junta: 10 },
      geometrias: {}, pecas: [], barras: [], ajustes: [], avisos: [],
      dims: { L_real: 0, H_solo: 0, H_muro: 0, n_fiadas: 0, trechos: [], contrafortes: [], sapata: { y0: 0, y1: 0, z0: 0, z1: 0 } },
    };
    for (const svg of [vistaFrontal(vazio), corteLateral(vazio), planta(vazio), isometrico(vazio), isometrico(vazio, { corteX: 0 })]) {
      expect(xmlBemFormado(svg)).toBeNull();
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

