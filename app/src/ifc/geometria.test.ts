import { describe, expect, it } from 'vitest';
import type { Geometria, Peca, Vec3 } from '@/modelo/tipos';
import { caixaDaPeca, eixoDaBarra, perfilOrientado, areaAssinada, pontoDeInsercao } from './geometria';
import { muroDeTeste } from './teste/muroDeTeste';

const barra = (posicao: string, m = muroDeTeste({ contrafortes: true })) => m.barras.find((b) => b.posicao === posicao)!;

describe('barra: polilinha → retas + arco verdadeiro', () => {
  it('espera com gancho de 90° amostrado em 4 cordas vira 1 arco; comprimento = o do arco verdadeiro', () => {
    const b = barra('N1');
    const e = eixoDaBarra(b.eixo, b.diametro)!;
    expect(e.arcos).toBe(1);
    expect(e.segmentos.map((s) => s.tipo)).toEqual(['linha', 'arco', 'linha']);
    expect(e.pontos.length).toBe(5);     // 2 da cauda/tangente + 1 do meio do arco + tangente + topo
    expect(e.comprimento).toBeCloseTo(b.comprimento, 6);
  });

  it('transversal da sapata com dois ganchos: 2 arcos', () => {
    const b = barra('N4');
    const e = eixoDaBarra(b.eixo, b.diametro)!;
    expect(e.arcos).toBe(2);
    expect(e.segmentos.map((s) => s.tipo)).toEqual(['linha', 'arco', 'linha', 'arco', 'linha']);
    expect(e.comprimento).toBeCloseTo(b.comprimento, 6);
  });

  it('estribo fechado: 4 cantos em arco e volta ao 1º ponto', () => {
    const b = barra('N7');
    const e = eixoDaBarra(b.eixo, b.diametro, b.fechada)!;
    expect(e.arcos).toBe(4);
    const ultimo = e.segmentos[e.segmentos.length - 1];
    expect(ultimo.idx[ultimo.idx.length - 1]).toBe(1);
    expect(e.comprimento).toBeCloseTo(b.comprimento, 6);
  });

  it('canto vivo de 90° NÃO vira arco; reta fica reta; ponto repetido some', () => {
    const q: Vec3[] = [[0, 0, 0], [100, 0, 0], [100, 100, 0], [0, 100, 0]];
    const v = eixoDaBarra(q, 10, true)!;
    expect(v.arcos).toBe(0);
    // fechamento num canto vivo: o laço passa a começar no meio do lado mais comprido (o ifcopenshell não monta
    // o tubo fechado num canto); a forma e o comprimento não mudam
    expect(v.pontos[0]).toEqual([50, 0, 0]);
    expect(v.segmentos).toEqual([{ tipo: 'linha', idx: [1, 2, 3, 4, 5, 1] }]);
    expect(v.comprimento).toBe(400);
    const r = eixoDaBarra([[0, 0, 0], [0, 0, 0], [0, 0, 500]], 10)!;
    expect(r.segmentos).toEqual([{ tipo: 'linha', idx: [1, 2] }]);
    expect(r.comprimento).toBe(500);
    expect(eixoDaBarra([[1, 1, 1]], 10)).toBeNull();
  });

  it('curva larga (raio > 15Ø) fica polilinha: não é dobra', () => {
    const pts: Vec3[] = Array.from({ length: 7 }, (_, i) => {
      const a = (i * Math.PI) / 12;
      return [1000 * Math.cos(a), 1000 * Math.sin(a), 0];
    });
    expect(eixoDaBarra(pts, 10)!.arcos).toBe(0);
    expect(eixoDaBarra(pts, 100)!.arcos).toBe(1);
  });

  it('meia volta amostrada em 8 cordas (180°) é partida em 2 arcos', () => {
    const pts: Vec3[] = Array.from({ length: 9 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      return [30 * Math.cos(a), 30 * Math.sin(a), 0];
    });
    const e = eixoDaBarra(pts, 10)!;
    expect(e.arcos).toBe(2);
    expect(e.comprimento).toBeCloseTo(Math.PI * 30, 6);
  });
});

describe('peça: plano do perfil, giro e origem', () => {
  const bloco: Geometria = {
    chave: 'b', eixo: 'Z', extensao: 190, volume_mm3: 0,
    perfil: { contorno: [[0, 0], [390, 0], [390, 190], [0, 190]] },
  };
  it('giro 90: o x local vira +Y, o y local vira −X; a origem é o canto mínimo da caixa girada', () => {
    const c = caixaDaPeca({ origem: [1000, 200, 10], giro: 90 }, bloco);
    expect(c.min).toEqual([1000, 200, 10]);
    expect(c.max).toEqual([1190, 590, 200]);
    // o ponto local (0,0,0) vai para o canto de X máximo: é ali que o IfcLocalPlacement fica
    expect(pontoDeInsercao({ origem: [1000, 200, 10], giro: 90 }, bloco)).toEqual([1190, 200, 10]);
    expect(pontoDeInsercao({ origem: [1000, 200, 10], giro: 180 }, bloco)).toEqual([1390, 390, 10]);
    expect(caixaDaPeca({ origem: [0, 0, 0], giro: 270 }, bloco)).toEqual({ min: [0, 0, 0], max: [190, 390, 190] });
  });
  it('eixo X: perfil em (y, z), extrusão em X; eixo Y: perfil em (x, z), extrusão em Y', () => {
    const sec: Geometria = { ...bloco, eixo: 'X', extensao: 1000, perfil: { contorno: [[0, 0], [190, 0], [190, 50], [0, 50]] } };
    expect(caixaDaPeca({ origem: [0, 0, 0], giro: 0 }, sec)).toEqual({ min: [0, 0, 0], max: [1000, 190, 50] });
    const tubo: Geometria = { ...sec, eixo: 'Y', extensao: 190 };
    expect(caixaDaPeca({ origem: [600, 0, 75], giro: 0 }, tubo)).toEqual({ min: [600, 0, 75], max: [790, 190, 125] });
  });
  it('perfil sai com contorno anti-horário e furos horários, venha como vier', () => {
    const p = perfilOrientado({ contorno: [[0, 0], [0, 10], [10, 10], [10, 0]], furos: [[[2, 2], [4, 2], [4, 4], [2, 4]]] })!;
    expect(areaAssinada(p.contorno)).toBeGreaterThan(0);
    expect(areaAssinada(p.furos[0])).toBeLessThan(0);
    expect(perfilOrientado({ contorno: [[0, 0], [1, 0], [2, 0]] })).toBeNull();
  });
});

// A modulação é quem FABRICA o Modelo e escreveu a regra de posição em modulacao/perfis.ts. Enquanto o arquivo
// existir, a leitura do IFC tem de dar exatamente a mesma caixa, peça a peça, em todos os giros.
const perfisDaModulacao = import.meta.glob('../modulacao/perfis.ts');
describe.skipIf(!Object.keys(perfisDaModulacao).length)('mesma regra de posição da modulação', () => {
  it('caixa de cada peça (giros 0, 90, 180, 270) = caixaGlobal da modulação', async () => {
    const mod = (await Object.values(perfisDaModulacao)[0]()) as {
      caixaGlobal: (p: Peca, g: Geometria) => { min: Vec3; max: Vec3 };
    };
    const m = muroDeTeste({ contrafortes: true, drenagem: true });
    let n = 0;
    for (const giro of [0, 90, 180, 270] as const) {
      for (const p0 of m.pecas) {
        const p = { ...p0, giro };
        const g = m.geometrias[p.geometria];
        const a = caixaDaPeca(p, g), b = mod.caixaGlobal(p, g);
        for (let k = 0; k < 3; k++) {
          expect(a.min[k]).toBeCloseTo(b.min[k], 6);
          expect(a.max[k]).toBeCloseTo(b.max[k], 6);
        }
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
});

// O gancho que a modulação desenha (modulacao/barras.ts) tem de ser reconhecido como arco verdadeiro.
const barrasDaModulacao = import.meta.glob('../modulacao/barras.ts');
describe.skipIf(!Object.keys(barrasDaModulacao).length)('dobra amostrada pela modulação vira arco', () => {
  it('espera com gancho de 90° (Ø8 a Ø25, para os dois lados)', async () => {
    const mod = (await Object.values(barrasDaModulacao)[0]()) as {
      espera: (id: string, phi: number, x: number, y: number, zPe: number, zTopo: number, gancho: boolean, sentidoY: 1 | -1, trecho: number) =>
        { eixo: Vec3[]; comprimento: number; diametro: number };
    };
    for (const phi of [8, 10, 12.5, 16, 20, 25]) {
      for (const s of [1, -1] as const) {
        const b = mod.espera('E', phi, 100, 140, -250, 900, true, s, 1);
        const e = eixoDaBarra(b.eixo, b.diametro)!;
        expect(e.arcos, `Ø${phi} sentido ${s}`).toBe(1);
        expect(e.comprimento).toBeCloseTo(b.comprimento, 3);
      }
    }
  });
});
