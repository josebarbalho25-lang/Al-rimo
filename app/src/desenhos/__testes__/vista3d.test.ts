/*
  O 3D EM VETOR — o que quebraria a prancha com o 3D desenhado em traço:
  - desenho espelhado ou de outro ângulo que o da tela (o engenheiro escolheu a vista no visor);
  - peça que estava oculta no visor aparecendo no papel (ou o contrário);
  - corte mostrando o lado que o visor apagou;
  - armadura escondida atrás das peças, quando o modo Armadura a mostra por cima;
  - o isométrico de sempre e o 3D na mesma direção dizendo coisas diferentes.
*/
import { describe, expect, it } from 'vitest';
import type { Geometria, Modelo, Peca, Vec3 } from '@/modelo/tipos';
import { PX_POR_MM, type Camera3d, type Primitiva } from '@/pranchas/tipos';
import { cortesPadrao, desenharIsometrico, desenharVista3d, vista3dParaPrancha } from '../index';
import { baseDaCamera } from '../vista3d';
import { Prancha } from '../prancha';
import { ALVENARIA, CANALETA, solidosDoModelo } from '../geometria';
import { modeloDeExemplo } from './modeloDeExemplo';
import { ids, xmlBemFormado } from './lerSvg';

const ALVO: Vec3 = [2, 0.3, 1];

function camera(dir: Vec3, o: Partial<Camera3d> = {}): Camera3d {
  return {
    posicao: [ALVO[0] + 10 * dir[0], ALVO[1] + 10 * dir[1], ALVO[2] + 10 * dir[2]],
    alvo: ALVO,
    cima: [0, 0, 1],
    ortografica: true,
    zoom: 120,
    fov: 40,
    estilo: 'cores',
    armadura: false,
    corteX: null,
    ocultas: [],
    ...o,
  };
}

const ISO: Vec3 = [1, -1, 1];
const m: Modelo = modeloDeExemplo({ tipo: 'contrafortes', areia: 150 });

/** Polígonos de uma peça no SVG: [fill, pontos]. */
function poligonos(svg: string, id: string): { fill: string; pts: number[] }[] {
  const out: { fill: string; pts: number[] }[] = [];
  for (const [tag] of svg.matchAll(/<polygon [^>]*>/g)) {
    if (!tag.includes(`data-id="${id}"`)) continue;
    out.push({ fill: tag.match(/fill="([^"]+)"/)![1], pts: tag.match(/points="([^"]+)"/)![1].split(/[ ,]/).map(Number) });
  }
  return out.sort((a, b) => a.pts[0] - b.pts[0] || a.pts[1] - b.pts[1]);
}

const camadaDe = (q: Primitiva): string | undefined =>
  q.k === 'linha' || q.k === 'polilinha' ? q.e.camada : q.k === 'circulo' ? q.e?.camada : 'camada' in q ? q.camada : undefined;

describe('base da câmera', () => {
  it('a do lookAt do three: direita = cima × v, cima da tela = v × direita (o desenho não sai espelhado)', () => {
    const { v, dir, cima } = baseDaCamera(camera(ISO));
    const k = 1 / Math.sqrt(3);
    [k, -k, k].forEach((x, i) => expect(v[i]).toBeCloseTo(x, 12));
    // olhando de frente pela direita: o X do muro corre para a direita, o lado do solo (+Y) também, e o Z sobe
    expect(dir[0]).toBeGreaterThan(0);
    expect(dir[1]).toBeGreaterThan(0);
    expect(cima[2]).toBeGreaterThan(0);
    const frente = baseDaCamera(camera([0, -1, 0]));
    // (+ 0 tira o −0 do arredondamento)
    expect(frente.dir.map((x) => Math.round(x * 1e9) / 1e9 + 0)).toEqual([1, 0, 0]);
    expect(frente.cima.map((x) => Math.round(x * 1e9) / 1e9 + 0)).toEqual([0, 0, 1]);
  });

  it('olhando exatamente de cima (planta), com o cima em Z, não quebra: desvia um fio, como o three', () => {
    const { v, dir, cima } = baseDaCamera(camera([0, 0, 1]));
    for (const x of [...v, ...dir, ...cima]) expect(Number.isFinite(x)).toBe(true);
    expect(Math.hypot(...dir)).toBeCloseTo(1, 9);
  });
});

describe('o mesmo muro, mesma direção: 3D em vetor × isométrico', () => {
  const S = 0.2;
  const iso = desenharIsometrico(m, { S }).svg();
  const v3 = desenharVista3d(m, camera(ISO), { S }).svg();

  it('cada bloco e meio bloco sai com as mesmas faces, na mesma cor e no mesmo lugar', () => {
    const blocos = m.pecas.filter((p) => p.tipo === 'BLOCO' || p.tipo === 'MEIO_BLOCO');
    expect(blocos.length).toBeGreaterThan(50);
    for (const p of blocos) {
      const a = poligonos(iso, p.id);
      const b = poligonos(v3, p.id);
      expect(b.length, p.id).toBe(a.length);
      a.forEach((q, k) => {
        expect(b[k].fill, p.id).toBe(q.fill);
        q.pts.forEach((x, i) => expect(Math.abs(b[k].pts[i] - x), p.id).toBeLessThanOrEqual(0.11));
      });
    }
  });

  it('a isométrica do visor (1, −1, 0,85) dá quase o mesmo desenho', () => {
    const quase = desenharVista3d(m, camera([1, -1, 0.85]), { S });
    const exata = desenharVista3d(m, camera(ISO), { S });
    const [, , wa, ha] = exata.partes(0).viewBox;
    const [, , wb, hb] = quase.partes(0).viewBox;
    expect(Math.abs(wb / wa - 1)).toBeLessThan(0.1);
    expect(Math.abs(hb / ha - 1)).toBeLessThan(0.15);
    expect(ids(quase.svg())).toEqual(ids(exata.svg()));
  });

  it('o que o isométrico não desenhava: areia (e o dreno em brita) na camada da drenagem', () => {
    const vis = ids(v3);
    expect(m.pecas.some((p) => p.tipo === 'AREIA' && vis.has(p.id))).toBe(true);
    const pr = desenharVista3d(m, camera(ISO), { S });
    // no DXF: as arestas da drenagem na camada dela (as faces vão todas para 3d-faces)
    expect(pr.primitivas().some((q) => q.k === 'linha' && q.e.camada === 'drenagem')).toBe(true);
  });
});

describe('o que estava na tela', () => {
  it('câmera de frente: só as faces da frente (cada bloco, uma face; toda face é um retângulo de pé)', () => {
    const pr = desenharVista3d(m, camera([0, -1, 0]), { S: 0.2 });
    const svg = pr.svg();
    for (const p of m.pecas.filter((q) => q.tipo === 'BLOCO' || q.tipo === 'MEIO_BLOCO')) expect(poligonos(svg, p.id).length, p.id).toBe(1);
    // no DXF, de frente, toda aresta de bloco que se vê é deitada ou em pé
    const arestas = pr.primitivas().filter((q): q is Extract<Primitiva, { k: 'linha' }> => q.k === 'linha' && q.e.camada === 'alvenaria');
    expect(arestas.length).toBeGreaterThan(50);
    for (const q of arestas) expect(Math.abs(q.a[0] - q.b[0]) < 1e-6 || Math.abs(q.a[1] - q.b[1]) < 1e-6).toBe(true);
  });

  it('ocultar terreno e drenagem no visor tira as peças do desenho', () => {
    const b = modeloDeExemplo({ tipo: 'balanco', H_solo: 1500, terreno: true, areia: 120 });
    const terreno = b.pecas.filter((p) => p.grupo === 'terreno').map((p) => p.id);
    const drenagem = b.pecas.filter((p) => p.grupo === 'drenagem').map((p) => p.id);
    expect(terreno.length && drenagem.length).toBeTruthy();
    const todos = ids(desenharVista3d(b, camera(ISO)).svg());
    expect(terreno.every((id) => todos.has(id))).toBe(true);
    expect(drenagem.some((id) => todos.has(id))).toBe(true);
    const semTerreno = ids(desenharVista3d(b, camera(ISO, { ocultas: ['terreno'] })).svg());
    expect(terreno.some((id) => semTerreno.has(id))).toBe(false);
    expect(drenagem.some((id) => semTerreno.has(id))).toBe(true);
    const semDreno = ids(desenharVista3d(b, camera(ISO, { ocultas: ['drenagem'] })).svg());
    expect(drenagem.some((id) => semDreno.has(id))).toBe(false);
    // o véu do terreno vai antes de tudo, numa cor clara só
    const ps = desenharVista3d(b, camera(ISO)).primitivas();
    const iTerreno = ps.map((q) => camadaDe(q)).lastIndexOf('terreno');
    const iPeca = ps.findIndex((q) => camadaDe(q) === 'alvenaria');
    expect(iTerreno).toBeLessThan(iPeca);
  });

  it('ocultar os contrafortes leva o contraforte inteiro (bloco, graute e barra)', () => {
    const vis = ids(desenharVista3d(m, camera(ISO, { ocultas: ['contrafortes'], armadura: true })).svg());
    expect(m.pecas.filter((p) => p.grupo === 'contraforte').some((p) => vis.has(p.id))).toBe(false);
    expect(m.barras.filter((b) => b.papel.startsWith('CF_')).some((b) => vis.has(b.id))).toBe(false);
    expect(m.pecas.filter((p) => p.grupo === 'muro').some((p) => vis.has(p.id))).toBe(true);
  });

  it('com os blocos ocultos, o graute dos furos aparece como peça', () => {
    const vis = ids(desenharVista3d(m, camera(ISO, { ocultas: ['blocos'] })).svg());
    expect(m.pecas.some((p) => p.tipo === 'GRAUTE_FURO' && vis.has(p.id))).toBe(true);
    expect(m.pecas.some((p) => p.tipo === 'BLOCO' && p.grupo === 'muro' && vis.has(p.id))).toBe(false);
  });

  it('Armadura: as barras por cima de tudo, na cor da bitola, com legenda das bitolas', () => {
    const pr = desenharVista3d(m, camera(ISO, { armadura: true }));
    const ps = pr.primitivas();
    const i0 = ps.findIndex((q) => q.k === 'polilinha' && q.e.camada === 'aco');
    expect(i0).toBeGreaterThan(0);
    // depois da primeira barra: só barra e legenda (nenhuma peça pintada por cima dela)
    for (const q of ps.slice(i0)) expect(['aco', 'legenda', 'textos']).toContain(camadaDe(q));
    const cores = new Set(ps.filter((q) => q.k === 'polilinha' && q.e.camada === 'aco').map((q) => (q as { e: { cor: string } }).e.cor));
    expect(cores.has('#ff0000')).toBe(true);   // Ø10, o vermelho do Revit do Jose
    expect(ps.some((q) => q.k === 'texto' && q.t === 'Ø10')).toBe(true);
    // sem Armadura e sem corte, a barra fica dentro do bloco: não aparece
    expect(desenharVista3d(m, camera(ISO)).primitivas().some((q) => q.k === 'polilinha' && q.e.camada === 'aco')).toBe(false);
  });

  it('corte em X: o lado de lá some (como no visor, x ≤ X fica); a face cortada aparece para quem olha dela', () => {
    const x = cortesPadrao(m)[0].x;
    const svg = desenharVista3d(m, camera(ISO, { corteX: x })).svg();
    const vis = ids(svg);
    for (const p of m.pecas) {
      const alem = m.geometrias[p.geometria] && p.origem[0] >= x + 1;
      if (alem && p.tipo === 'BLOCO') expect(vis.has(p.id), p.id).toBe(false);
    }
    expect(svg).toContain('data-camada="corte"');
    expect(m.barras.some((b) => b.papel === 'VERT_MURO' && vis.has(b.id))).toBe(true);   // a barra na face do corte
    // olhando do outro lado (−X), a face cortada fica de costas: não é desenhada, mas o lado de lá continua fora
    const deCostas = desenharVista3d(m, camera([-1, -1, 1], { corteX: x })).svg();
    expect(deCostas).not.toContain('data-camada="corte"');
    expect(m.pecas.filter((p) => p.tipo === 'BLOCO' && p.origem[0] >= x + 1).some((p) => ids(deCostas).has(p.id))).toBe(false);
  });

  it('Opaco: massa branca, traço preto, sem a legenda das cores dos blocos', () => {
    const pr = desenharVista3d(m, camera(ISO, { estilo: 'opaco' }));
    // no SVG: a massa branca com o traço preto
    const svg = pr.svg();
    expect(svg).toMatch(/<polygon [^>]*fill="#ffffff" stroke="#1a1a1a"/);
    // no DXF: só as arestas que se veem, pretas; nenhuma face (o branco de papel não vai)
    const ps = pr.primitivas();
    expect(ps.some((q) => q.k === 'hachura')).toBe(false);
    const alv = ps.filter((q): q is Extract<Primitiva, { k: 'linha' }> => q.k === 'linha' && q.e.camada === 'alvenaria');
    expect(alv.length).toBeGreaterThan(50);
    expect(alv.every((q) => q.e.cor === '#1a1a1a')).toBe(true);
    expect(ps.some((q) => q.k === 'texto' && q.t === 'Inteiro')).toBe(false);
  });

  it('Cores: no DXF as faces vão na ordem do pintor (camada 3d-faces) e as arestas todas por cima', () => {
    const ps = desenharVista3d(m, camera(ISO)).primitivas();
    const faces = ps.map((q, i) => (q.k === 'hachura' && q.camada === '3d-faces' ? i : -1)).filter((i) => i >= 0);
    const arestas = ps.map((q, i) => (q.k === 'linha' ? i : -1)).filter((i) => i >= 0);
    expect(faces.length).toBeGreaterThan(50);
    expect(Math.max(...faces)).toBeLessThan(Math.min(...arestas));
    // a face não leva contorno: a aresta é que diz o que se vê
    expect(ps.some((q) => q.k === 'hachura' && q.camada === '3d-faces' && q.borda)).toBe(false);
  });

  it('peças partidas em caixas (canaleta em U, dreno em L) não mostram a divisa', () => {
    // a canaleta: as faces dela vêm com o contorno na própria cor, e as arestas desenhadas são as da peça
    const svg = desenharVista3d(m, camera(ISO), { S: 0.2 }).svg();
    const can = m.pecas.find((p) => p.tipo === 'CANALETA')!;
    const faces = [...svg.matchAll(new RegExp(`<polygon [^>]*data-id="${can.id.replace(/\./g, '\\.')}"[^>]*>`, 'g'))].map((q) => q[0]);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) expect(f.match(/fill="([^"]+)"/)![1]).toBe(f.match(/stroke="([^"]+)"/)![1]);
    expect(xmlBemFormado(svg)).toBeNull();
  });
});

describe('com o muro da modulação (canaleta de verdade, dreno com areia, manta e tubo, sapata com dente)', async () => {
  // importada na hora, como em comModulacao.test.ts: modulação em obra não deixa este arquivo vermelho
  const mod = await import('@/modulacao').catch(() => null);
  const { resultadoDoGabarito } = await import('@/motor/resultadoDoGabarito');
  const real = mod ? mod.gerarModelo(resultadoDoGabarito('aula123'), mod.padroesDoModelo()) : null;

  it.skipIf(!real)('o graute da canaleta não aparece por cima do bloco da fiada de cima', () => {
    const m3 = real!;
    const svg = desenharVista3d(m3, camera([1, -1, 0.85])).svg();
    const prim = (id: string) => svg.indexOf(`data-id="${id}"`);
    const ult = (id: string) => svg.lastIndexOf(`data-id="${id}"`);
    const sol = solidosDoModelo(m3);
    const sobre = (a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }) => a.min[0] < b.max[0] - 1 && b.min[0] < a.max[0] - 1;
    // a corrida de graute é uma peça só (um id) recortada canaleta por canaleta: o pedaço de cada canaleta vem logo
    // depois dela — e tem de vir antes do bloco que senta em cima dela
    let conferidos = 0;
    for (const g of sol.filter((s) => s.peca.tipo === 'GRAUTE_CANALETA' && s.peca.grupo === 'muro')) {
      const f = g.peca.fiada ?? 0;
      const canaletas = sol.filter((s) => CANALETA.has(s.peca.tipo) && s.peca.grupo === 'muro' && s.peca.fiada === f && sobre(s, g));
      // do graute dentro do U só aparece a tampa de cima (e a de topo onde a corrida acaba): a face encostada na
      // parede da frente, pintada depois da canaleta, cobriria a parede
      const faces = (svg.match(new RegExp(`data-id="${g.peca.id.replace(/\./g, '\\.')}"`, 'g')) ?? []).length;
      expect(faces, g.peca.id).toBeLessThanOrEqual(canaletas.length + 2);
      for (const c of canaletas) {
        const pedaco = svg.indexOf(`data-id="${g.peca.id}"`, ult(c.peca.id));
        const deCima = sol.filter((s) => ALVENARIA.has(s.peca.tipo) && s.peca.grupo === 'muro' && s.peca.fiada === f + 1 && sobre(s, c) && prim(s.peca.id) >= 0);
        for (const b of deCima) {
          expect(pedaco, `${g.peca.id} em ${c.peca.id} × ${b.peca.id}`).toBeLessThan(prim(b.peca.id));
          conferidos++;
        }
      }
    }
    expect(conferidos).toBeGreaterThan(10);
    // e a drenagem toda entra: brita, areia e manta
    const vis = ids(svg);
    for (const tp of ['DRENO', 'AREIA', 'MANTA']) expect(m3.pecas.some((p) => p.tipo === tp && vis.has(p.id)), tp).toBe(true);
  });
});

describe('3D para a prancha', () => {
  it('o desenho ocupa a largura pedida no papel, com a caixa e as primitivas batendo', () => {
    const v = vista3dParaPrancha(m, camera(ISO), 120, 'p3d');
    const fora = (q: Primitiva) => camadaDe(q) !== 'legenda';
    let [x0, x1] = [Infinity, -Infinity];
    for (const q of v.primitivas.filter(fora)) {
      const pts = q.k === 'hachura' ? q.aneis.flat() : q.k === 'polilinha' ? q.pts : q.k === 'linha' ? [q.a, q.b] : [];
      for (const p of pts) [x0, x1] = [Math.min(x0, p[0]), Math.max(x1, p[0])];
    }
    expect((x1 - x0) / PX_POR_MM).toBeCloseTo(120, 6);
    expect(v.caixa[2] / PX_POR_MM).toBeGreaterThanOrEqual(119);
    expect(v.defs).toContain('id="p3d-tick"');
    expect([...v.corpo.matchAll(/url\(#([^)]+)\)/g)].every((q) => q[1].startsWith('p3d-'))).toBe(true);
    expect(v.primitivas.every((q) => q.k !== 'texto' || q.t !== 'Vista 3D')).toBe(true);
    // em dobro de papel, dobro de desenho; a letra da legenda não muda
    const d = vista3dParaPrancha(m, camera(ISO), 240, 'p3d');
    const alturas = (ps: Primitiva[]) => ps.filter((q) => q.k === 'texto').map((q) => (q as { altura: number }).altura);
    expect(alturas(d.primitivas)).toEqual(alturas(v.primitivas));
    expect(Prancha.largura('Ø10', 11)).toBeGreaterThan(0);
  });

  it('modelo vazio não derruba', () => {
    const vazio: Modelo = {
      versao: 'x', familia: { nome: '19x39', t: 190, L: 390, Lm: 190, m: 200, h: 190, hf: 35, junta: 10 },
      geometrias: {}, pecas: [], barras: [], ajustes: [], avisos: [],
      dims: { L_real: 0, H_solo: 0, H_muro: 0, n_fiadas: 0, trechos: [], contrafortes: [], sapata: { y0: 0, y1: 0, z0: 0, z1: 0 } },
    };
    const v = vista3dParaPrancha(vazio, camera(ISO, { corteX: 0, armadura: true }), 100, 'z');
    expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity/);
  });
});

describe('DXF do 3D: só o que se vê', () => {
  // duas caixas de 1 m: A atrás, B na frente (mais perto de quem olha), deslocada para cobrir só parte de A
  const caixa: Geometria = { chave: 'caixa', eixo: 'Z', perfil: { contorno: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] }, extensao: 1000, volume_mm3: 1e9 };
  const peca = (id: string, origem: Vec3): Peca => ({ id, tipo: 'SAPATA', grupo: 'fundacao', geometria: 'caixa', origem, giro: 0, trecho: 1 });
  const duas: Modelo = { ...modeloDeExemplo({ tipo: 'balanco' }), geometrias: { caixa }, pecas: [peca('A', [0, 1500, 0]), peca('B', [500, 0, 400])], barras: [] };

  type P2 = [number, number];
  /** Ponto dentro do polígono e a mais de `folga` da borda (na borda, a aresta é de verdade; o SVG arredonda a 0,1 px). */
  const dentro = (p: P2, q: P2[], folga = 0.1): boolean => {
    let d = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if (q[i][1] > p[1] !== q[j][1] > p[1] && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) d = !d;
    }
    if (!d) return false;
    return q.every((a, i) => {
      const b = q[(i + 1) % q.length];
      const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey)));
      return Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey) > folga;
    });
  };
  const faces = (svg: string, id: string): P2[][] =>
    poligonos(svg, id).map((f) => Array.from({ length: f.pts.length / 2 }, (_, k): P2 => [f.pts[2 * k], f.pts[2 * k + 1]]));
  /** Os segmentos que passam POR DENTRO de alguma face de B (amostrados a cada décimo). */
  const escondidos = (segs: [P2, P2][], fb: P2[][]) =>
    segs.filter(([a, b]) => Array.from({ length: 9 }, (_, k) => (k + 1) / 10).some((t) => fb.some((f) => dentro([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], f))));

  for (const estilo of ['opaco', 'cores'] as const) {
    it(`${estilo}: nenhuma aresta de A atravessa B; o que de A fica à vista continua lá`, () => {
      const pr = desenharVista3d(duas, camera(ISO, { estilo }), { S: 0.2 });
      const svg = pr.svg();
      const fa = faces(svg, 'A');
      const fb = faces(svg, 'B');
      expect([fa.length, fb.length]).toEqual([3, 3]);
      // o caso tem dente: no rastro do pintor (o SVG), as arestas de A passam por dentro das faces de B
      const deA = fa.flatMap((f) => f.map((p, k): [P2, P2] => [p, f[(k + 1) % f.length]]));
      expect(escondidos(deA, fb).length).toBeGreaterThan(0);
      // no DXF, nenhuma
      const linhas = pr.primitivas().filter((q): q is Extract<Primitiva, { k: 'linha' }> => q.k === 'linha');
      expect(escondidos(linhas.map((q) => [q.a, q.b]), fb)).toEqual([]);
      // e A não sumiu: as arestas de A fora de B continuam (as 9 de B mais pedaços das de A)
      expect(linhas.length).toBeGreaterThan(9);
      const foraDeB = linhas.filter((q) => fa.some((f) => f.some((p) => Math.hypot(p[0] - q.a[0], p[1] - q.a[1]) < 0.1)));
      expect(foraDeB.length).toBeGreaterThan(0);
    });
  }
});
