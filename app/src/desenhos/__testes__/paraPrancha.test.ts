/*
  VISTA PARA A PRANCHA — o que quebraria a prancha plotada ou o DXF:
  - vista fora da escala pedida (1:25 que sai 1:23 — o engenheiro mede no papel e erra o muro);
  - letra que encolhe junto com o muro (cota de 1,2 mm em 1:50: ninguém lê);
  - DXF sem a hachura do material, sem a cota ou com a marca da cota sumida (o <marker> do SVG não existe no CAD);
  - duas vistas na mesma folha com o mesmo id de padrão (a segunda pinta a terra com o ladrilho da primeira);
  - primitivas que não batem com o SVG (o DXF mostra um desenho, o PDF outro).
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import { MAIUSCULA_DA_ARIAL, PX_POR_MM, type PedidoDeVista, type Primitiva, type Traco } from '@/pranchas/tipos';
import { cortesPadrao, desenharCorteLateral, desenharVistaFrontal, vistaParaPrancha } from '../index';
import { Prancha } from '../prancha';
import { ALVENARIA, solidosDoModelo } from '../geometria';
import { modeloDeExemplo } from './modeloDeExemplo';

const m: Modelo = modeloDeExemplo({ tipo: 'contrafortes', areia: 150 });

const PEDIDOS: [string, PedidoDeVista][] = [
  ['frontal', { tipo: 'frontal' }],
  ['corte', { tipo: 'corte' }],
  ['corte no contraforte', { tipo: 'corte', x: m.dims.contrafortes[1].x }],
  ['planta', { tipo: 'planta', fiada: 0 }],
  ['iso', { tipo: 'iso' }],
  ['iso cortado', { tipo: 'iso', vista: 'fundo-esquerda', corteX: cortesPadrao(m)[0].x }],
];

/** Camadas que o DXF recebe (prancha.ts, cabeçalho). */
const CAMADAS = new Set(['alvenaria', 'graute', 'concreto', 'aco', 'terreno', 'drenagem', 'cotas', 'eixos', 'textos', 'legenda', 'geral', '3d-faces', 'chamadas', 'sombras']);

type Caixa = [number, number, number, number];

/** Caixa [x0, y0, x1, y1] de primitivas; o texto pela mesma estimativa de largura da Prancha. */
function caixaDe(ps: Primitiva[]): Caixa {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const pt = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  for (const q of ps) {
    if (q.k === 'linha') { pt(...q.a); pt(...q.b); }
    else if (q.k === 'polilinha') q.pts.forEach((p) => pt(...p));
    else if (q.k === 'hachura') q.aneis.forEach((a) => a.forEach((p) => pt(...p)));
    else if (q.k === 'circulo') { pt(q.c[0] - q.r, q.c[1] - q.r); pt(q.c[0] + q.r, q.c[1] + q.r); }
    else if (q.k === 'texto') {
      const w = Prancha.largura(q.t, q.altura, q.negrito);
      const a0 = q.ancora === 'start' ? 0 : q.ancora === 'middle' ? -w / 2 : -w;
      const [x, y] = q.p;
      if (q.angulo === 0) { pt(x + a0, y - 0.85 * q.altura); pt(x + a0 + w, y + 0.25 * q.altura); }
      else { pt(x - 0.85 * q.altura, y - a0 - w); pt(x + 0.25 * q.altura, y - a0); }
    }
  }
  return [x0, y0, x1, y1];
}

function tracos(ps: Primitiva[]): Traco[] {
  return ps.flatMap((q) => {
    if (q.k === 'linha' || q.k === 'polilinha') return [q.e];
    if (q.k === 'circulo') return q.e ? [q.e] : [];
    if (q.k === 'hachura') return q.borda ? [q.borda] : [];
    return [];
  });
}

const camadaDe = (q: Primitiva): string | undefined =>
  q.k === 'linha' || q.k === 'polilinha' ? q.e.camada : q.k === 'circulo' ? q.e?.camada : 'camada' in q ? q.camada : undefined;

const textosDe = (ps: Primitiva[]) => ps.filter((q): q is Extract<Primitiva, { k: 'texto' }> => q.k === 'texto');
const hachurasDe = (ps: Primitiva[]) => ps.filter((q): q is Extract<Primitiva, { k: 'hachura' }> => q.k === 'hachura');

/** Comprimento de cada risco da marca oblíqua: o path (2,8)→(8,2) da caixa 10×10 desenhada a 8 px. */
const MARCA = 0.8 * Math.hypot(6, 6);
const ehMarca = (q: Primitiva) =>
  q.k === 'linha' && q.e.camada === 'cotas' && Math.abs(Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) - MARCA) < 1e-6 && Math.abs(q.e.espessura - 1.2) < 1e-9;

describe.each(PEDIDOS)('%s em 1:25', (_, pedido) => {
  const v = vistaParaPrancha(m, pedido, 25, 'v1');

  it('primitivas não vazias, com número de verdade e camada conhecida', () => {
    expect(v.primitivas.length).toBeGreaterThan(20);
    const podres: number[] = [];
    JSON.stringify(v.primitivas, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? podres.push(x) : x));
    expect(podres).toEqual([]);
    for (const q of v.primitivas) expect(CAMADAS.has(camadaDe(q)!), `${q.k} ${camadaDe(q)}`).toBe(true);
  });

  it('a caixa das primitivas é a caixa da vista (o DXF ocupa o mesmo lugar que o PDF)', () => {
    const [x0, y0, x1, y1] = caixaDe(v.primitivas);
    const [cx, cy, cw, ch] = v.caixa;
    // a caixa da vista é arredondada para px inteiro e a linha de cota estende 4 px além do ponto (a marca, 2,4)
    for (const [a, b] of [[x0, cx], [y0, cy], [x1, cx + cw], [y1, cy + ch]]) expect(Math.abs(a - b)).toBeLessThan(3);
  });

  it('sem o título interno (a prancha põe o dela); o corpo SVG também', () => {
    const t = textosDe(v.primitivas).map((q) => q.t);
    for (const proibido of ['cotas em cm', 'Vista frontal', 'Isométrico']) expect(t).not.toContain(proibido);
    expect(t.some((q) => q.startsWith('Corte em x') || q.startsWith('Planta —') || q.startsWith('Isométrico'))).toBe(false);
    expect(v.corpo).not.toContain('cotas em cm');
  });

  it('cada marca oblíqua de cota vira dois riscos de linha, centrados nas pontas da linha de cota', () => {
    const nCotas = (v.corpo.match(/marker-start=/g) ?? []).length;
    const marcas = v.primitivas.filter(ehMarca) as Extract<Primitiva, { k: 'linha' }>[];
    expect(marcas.length).toBe(2 * nCotas);
    const pontas = v.primitivas
      .filter((q): q is Extract<Primitiva, { k: 'linha' }> => q.k === 'linha' && q.e.camada === 'cotas' && q.e.espessura === 0.9)
      .flatMap((q) => [q.a, q.b]);
    expect(pontas.length).toBe(2 * nCotas);
    for (const q of marcas) {
      const meio = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2];
      expect(pontas.some((p) => Math.hypot(p[0] - meio[0], p[1] - meio[1]) < 1e-9)).toBe(true);
    }
  });

  it('o filete branco sob a barra (só de tela) e o halo do texto não vão para o DXF', () => {
    expect(tracos(v.primitivas).some((e) => e.cor === '#ffffff')).toBe(false);
  });
});

describe('corte para a prancha', () => {
  const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c');

  it('hachuras de terra, concreto, brita e areia, com o fundo e o risco do ladrilho do SVG', () => {
    const h = hachurasDe(v.primitivas);
    const padroes = new Set(h.map((q) => q.padrao));
    for (const p of ['terra', 'concreto', 'brita', 'areia', 'alvenaria'] as const) expect(padroes.has(p), p).toBe(true);
    const terra = h.find((q) => q.padrao === 'terra')!;
    expect([terra.camada, terra.fundo, terra.risco]).toEqual(['terreno', '#dbc9bb', '#a67857']);
    expect(h.find((q) => q.padrao === 'concreto')!.camada).toBe('concreto');
    expect(h.find((q) => q.padrao === 'brita')!.camada).toBe('drenagem');
    expect(h.find((q) => q.padrao === 'areia')!.camada).toBe('drenagem');
    // graute cortado é cor chapada (sólido), na camada dele
    expect(h.some((q) => q.padrao === 'solido' && q.camada === 'graute')).toBe(true);
  });

  it('texto de cota na camada das cotas; a cota vertical gira 90° anti-horário', () => {
    const t = textosDe(v.primitivas);
    const tCota = t.find((q) => q.t === 't = 19')!;
    expect(tCota).toBeDefined();
    expect([tCota.camada, tCota.altura, tCota.angulo, tCota.ancora]).toEqual(['cotas', 11, 0, 'start']);
    const muro = t.find((q) => q.t.startsWith('muro '))!;
    expect([muro.camada, muro.angulo]).toEqual(['cotas', 90]);
    // o rótulo do aterro é do terreno (16/10: na cor da terra, fora da cor dos "Textos" da tabela de gráficos)
    expect(t.find((q) => q.t === 'aterro')!.camada).toBe('terreno');
  });

  it('as camadas do corte: cada material na sua', () => {
    const cs = new Set(v.primitivas.map(camadaDe));
    for (const c of ['alvenaria', 'graute', 'concreto', 'aco', 'terreno', 'drenagem', 'cotas', 'eixos']) expect(cs.has(c), c).toBe(true);
    // a barra vertical (polilinha) e o eixo do muro (traço-ponto)
    expect(v.primitivas.some((q) => q.k === 'polilinha' && q.e.camada === 'aco' && q.e.cor === '#c00000')).toBe(true);
    const eixo = v.primitivas.find((q) => q.k === 'linha' && q.e.camada === 'eixos') as Extract<Primitiva, { k: 'linha' }>;
    expect(eixo.e.tracejado).toEqual([14, 3, 2, 3]);
  });

  it('corte no contraforte: o estribo sai inteiro (fechado, ou a polilinha com os ganchos de 135°)', () => {
    const c = vistaParaPrancha(m, { tipo: 'corte', x: m.dims.contrafortes[1].x }, 25, 'c');
    const est = m.barras.filter((b) => b.papel === 'CF_ESTRIBO');
    expect(est.length).toBeGreaterThan(0);
    expect(c.primitivas.some((q) => q.k === 'polilinha' && q.e.camada === 'aco' && (q.fechada || q.pts.length >= 6))).toBe(true);
  });
});

describe('escala fixa', () => {
  const alturaDaAlvenaria = (ps: Primitiva[]) => {
    const [, y0, , y1] = caixaDe(hachurasDe(ps).filter((q) => q.camada === 'alvenaria'));
    return y1 - y0;
  };

  it.each([['frontal', { tipo: 'frontal' }], ['corte', { tipo: 'corte' }], ['planta', { tipo: 'planta', fiada: 0 }]] as [string, PedidoDeVista][])(
    '%s: de 1:25 para 1:50 o muro cai à metade e a letra fica igual',
    (_, pedido) => {
      const a = vistaParaPrancha(m, pedido, 25, 'a');
      const b = vistaParaPrancha(m, pedido, 50, 'b');
      expect(alturaDaAlvenaria(a.primitivas) / alturaDaAlvenaria(b.primitivas)).toBeCloseTo(2, 9);
      expect(textosDe(b.primitivas).map((q) => q.altura)).toEqual(textosDe(a.primitivas).map((q) => q.altura));
      expect(textosDe(b.primitivas).map((q) => q.t)).toEqual(textosDe(a.primitivas).map((q) => q.t));
    },
  );

  it('1:25 é 1:25 no papel: a alvenaria da vista frontal mede, em mm de papel, o muro ÷ 25', () => {
    const v = vistaParaPrancha(m, { tipo: 'frontal' }, 25, 'f');
    const [x0, y0, x1, y1] = caixaDe(hachurasDe(v.primitivas).filter((q) => q.camada === 'alvenaria'));
    // as peças da face (o mesmo filtro da vista): do pé da 1ª fiada (junta de 10 mm) ao topo da cinta
    const face = solidosDoModelo(m).filter((s) => ALVENARIA.has(s.peca.tipo) && s.min[1] < m.familia.t - 1);
    const alto = Math.max(...face.map((s) => s.max[2])) - Math.min(...face.map((s) => s.min[2]));
    const largo = Math.max(...face.map((s) => s.max[0])) - Math.min(...face.map((s) => s.min[0]));
    expect((y1 - y0) / PX_POR_MM).toBeCloseTo(alto / 25, 9);
    expect((x1 - x0) / PX_POR_MM).toBeCloseTo(largo / 25, 9);
    expect(largo).toBeGreaterThan(m.dims.L_real - 20);
  });

  it('em 1:25 a cota sai com 2,5 mm de maiúscula e o traço mais fino do corte com ~0,19 mm', () => {
    const v = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'c');
    const cotas = textosDe(v.primitivas).filter((q) => q.camada === 'cotas');
    expect(cotas.length).toBeGreaterThan(0);
    for (const q of cotas) expect((q.altura / PX_POR_MM) * MAIUSCULA_DA_ARIAL).toBeCloseTo(2.5, 9);
    // (o contorno de espessura 0 do ponto de barra é só o portador da camada: fica de fora)
    const fino = Math.min(...tracos(v.primitivas).map((e) => e.espessura).filter((x) => x > 0));
    expect(fino / PX_POR_MM).toBeCloseTo(0.19, 2);
  });

  it('nenhum texto da vista frontal fica abaixo da letra mínima no papel, nem os números das fiadas em 1:100', () => {
    for (const e of [25, 50, 100]) {
      const v = vistaParaPrancha(m, { tipo: 'frontal' }, e, 'f');
      for (const q of textosDe(v.primitivas)) expect((q.altura / PX_POR_MM) * MAIUSCULA_DA_ARIAL).toBeGreaterThanOrEqual(2.5 - 1e-9);
    }
  });

  it('as assinaturas antigas continuam: sem opções, a vista escolhe a escala da tela e tem título', () => {
    expect(desenharVistaFrontal(m).svg()).toContain('>Vista frontal</text>');
    expect(desenharCorteLateral(m).svg()).toContain('>cotas em cm</text>');
    // e a escala fixa muda o desenho, não só o rótulo
    expect(desenharVistaFrontal(m, { S: 0.1 }).svg()).not.toBe(desenharVistaFrontal(m).svg());
  });
});

describe('várias vistas na mesma folha', () => {
  it('nenhum id de padrão ou marcador repetido entre dois prefixos; cada corpo só usa os seus', () => {
    const a = vistaParaPrancha(m, { tipo: 'corte' }, 25, 'v1');
    const b = vistaParaPrancha(m, { tipo: 'frontal' }, 50, 'v2');
    const ids = (defs: string) => [...defs.matchAll(/<(?:pattern|marker) id="([^"]+)"/g)].map((q) => q[1]);
    const [ia, ib] = [ids(a.defs), ids(b.defs)];
    expect(ia.length).toBeGreaterThanOrEqual(6);
    expect(ia.every((i) => i.startsWith('v1-'))).toBe(true);
    expect(ib.every((i) => i.startsWith('v2-'))).toBe(true);
    expect(ia.filter((i) => ib.includes(i))).toEqual([]);
    for (const [v, p] of [[a, 'v1'], [b, 'v2']] as const) {
      const usados = [...v.corpo.matchAll(/url\(#([^)]+)\)/g)].map((q) => q[1]);
      expect(usados.length).toBeGreaterThan(0);
      expect(usados.every((u) => u.startsWith(`${p}-`))).toBe(true);
    }
  });
});
