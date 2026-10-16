/*
  ESTRIBO DE VERDADE, SAPATA EM ESTRIBOS E ARRANQUE (Jose, 15/10) — o que quebraria:
  - o comprimento de corte (C=) diferente da barra desenhada (o IFC lê a polilinha com os arcos verdadeiros);
  - o gancho saindo da seção, ou a ponta dele atravessando o ramo do outro lado;
  - o estribo da sapata comendo o cobrimento, ou a longitudinal por fora dele;
  - o estribo de torção no mesmo lugar de uma transversal;
  - a opção 'Reta' e a espera 'Padrão' deixando de ser o desenho de antes, barra por barra
    (__fixtures__/sapata_e_esperas_15-10.json: gravado do gerador de 15/10, antes do estribo novo);
  - o nó de cachorro diferente do Revit do Jose, saindo da sapata, ou desenhado onde a dobra não cabe.
*/
import { describe, expect, it } from 'vitest';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Barra, Modelo, Vec3 } from '@/modelo/tipos';
import { eixoDaBarra } from '@/ifc/geometria';
import { formaDaBarra } from '@/pranchas/formaDaBarra';
import { gerarModelo, padroesDoModelo } from './index';
import {
  PONTA_DO_NO, esperaNoDeCachorro, estribo, ganchoEstribo, medidasDoEstribo, medidasDoNo, pontaDoNo, raioDoEstribo, type BarraNova,
} from './barras';
import antes from './__fixtures__/sapata_e_esperas_15-10.json';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Comprimento da polilinha pelas cordas (o arco verdadeiro é um pouco maior). */
const cordas = (e: Vec3[]): number => e.slice(1).reduce((s, q, k) => s + Math.hypot(...sub(q, e[k])), 0);

const muro = (c: string, extras: Record<string, Valor> = {}): Modelo => gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), ...extras });

describe('estribo com a forma do Pró-Viga (ganchos de 135°, dobra no pino, volta em espiral)', () => {
  const CASOS: [number, number, number][] = [
    [5, 70, 450], [6.3, 70, 450], [6.3, 120, 490], [10, 1300, 210], [12.5, 900, 300], [16, 1320, 124], [20, 1000, 400], [25, 2000, 600],
  ];

  it('comprimento desenvolvido = o da polilinha lida com os arcos verdadeiros (como o IFC lê): 5 dobras', () => {
    for (const [phi, a, b] of CASOS) {
      const s = estribo('s', 'SAP_TRANSV', phi, [[0, 0, 0], [0, a, 0], [0, a, -b], [0, 0, -b]], 1);
      expect(s.fechada, `Ø${phi}`).toBeUndefined();
      expect(s.estribo).toBe(true);
      const e = eixoDaBarra(s.eixo, phi)!;
      expect(e.arcos, `Ø${phi} ${a}×${b}`).toBe(5);
      expect(e.comprimento, `Ø${phi} ${a}×${b}`).toBeCloseTo(s.comprimento, 2);
      // as cordas ficam por dentro do arco: um pouco menos, nunca mais
      const c = cordas(s.eixo);
      expect(c).toBeLessThanOrEqual(s.comprimento + 1e-6);
      expect(s.comprimento - c).toBeLessThan(0.1 * medidasDoEstribo(phi, a, b).raio);
    }
  });

  it('fecha no canto dos ganchos: as duas pontas a 45° para dentro, dentro da seção e longe do ramo de lá', () => {
    for (const [phi, a, b] of CASOS) {
      const c0: Vec3 = [100, 200, 300];
      const s = estribo('s', 'CF_ESTRIBO', phi, [c0, [100 + a, 200, 300], [100 + a, 200 + b, 300], [100, 200 + b, 300]], 1);
      const { raio: r, ponta } = medidasDoEstribo(phi, a, b);
      const loc = (q: Vec3): [number, number, number] => [q[0] - c0[0], q[1] - c0[1], q[2] - c0[2]];
      // o eixo nunca sai do retângulo do eixo dos ramos (a superfície fica no cobrimento)
      for (const q of s.eixo) {
        const [x, y] = loc(q);
        expect(x, `Ø${phi}`).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(a + 1e-6);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeLessThanOrEqual(b + 1e-6);
      }
      // as pontas: dentro, a uma bitola (de eixo) dos ramos do outro lado — a superfície encosta, não atravessa
      for (const [ponta0, antes0] of [[s.eixo[0], s.eixo[1]], [s.eixo[s.eixo.length - 1], s.eixo[s.eixo.length - 2]]]) {
        const [x, y] = loc(ponta0);
        expect(x).toBeLessThanOrEqual(a - phi + 1e-6);
        expect(y).toBeLessThanOrEqual(b - phi + 1e-6);
        // a 45° dos ramos e com o comprimento pedido (ou o que coube)
        const d = unit(sub(ponta0, antes0));
        expect(Math.abs(d[0])).toBeCloseTo(Math.SQRT1_2, 6);
        expect(Math.abs(d[1])).toBeCloseTo(Math.SQRT1_2, 6);
        expect(Math.hypot(...sub(ponta0, antes0))).toBeCloseTo(ponta, 4);
      }
      // os dois ganchos abraçam o MESMO canto: o começo de cada dobra está no círculo do canto 1
      const O: [number, number] = [r, r];
      for (const q of [s.eixo[1], s.eixo[s.eixo.length - 2]]) {
        const [x, y] = loc(q);
        expect(Math.hypot(x - O[0], y - O[1])).toBeCloseTo(r, 4);
      }
      // a volta não fecha no mesmo plano: as duas passadas pelo canto dos ganchos a uma bitola uma da outra
      expect(loc(s.eixo[s.eixo.length - 1])[2] - loc(s.eixo[0])[2]).toBeCloseTo(phi, 6);
      expect(ponta).toBeLessThanOrEqual(ganchoEstribo(phi));
    }
  });

  it('ponta do gancho de 135° pela NBR (5φ ≥ 5 cm); seção estreita encurta e avisa', () => {
    expect(ganchoEstribo(6.3)).toBe(50);
    expect(ganchoEstribo(16)).toBe(80);
    // contraforte do bloco 14: 7 cm de eixo a eixo — os 5 cm cabem a 45°
    const m14 = medidasDoEstribo(6.3, 70, 450);
    expect(m14.ponta).toBe(50);
    expect(m14.pontaCurta).toBe(false);
    expect(m14.dobraApertada).toBe(false);
    expect(m14.raio).toBeCloseTo(raioDoEstribo(6.3), 9);
    // sapata de 20 cm com Ø16: a ponta não chega a 5φ e a dobra do pino da NBR (5φ) mal cabe
    expect(medidasDoEstribo(16, 1320, 124).pontaCurta).toBe(true);
    expect(medidasDoEstribo(16, 1320, 80).dobraApertada).toBe(true);
  });

  it('o estribo do Revit do Jose (338366: Ø8, sapata 1200 × 350, cobrimento 40): mesmos ramos, mesma dobra', () => {
    // eixo dos ramos: 1200 − 2·40 − 8 = 1112 por 350 − 2·40 − 8 = 262; Revit: ramos retos 1080 e 230, raio 16,
    // ponta 40 (o padrão dele), total 2851. Aqui a ponta é a da NBR (50) e a volta anda 8 mm num ramo de 1080
    const s = estribo('s', 'SAP_TRANSV', 8, [[0, 0, 0], [0, 1112, 0], [0, 1112, -262], [0, 0, -262]], 1);
    expect(medidasDoEstribo(8, 1112, 262).raio).toBe(16);
    const revit = 2 * 40 + 3 * Math.PI * 16 + 2 * 1080 + 2 * 230;   // 2850,8 — o Revit mostra 2851
    expect(Math.round(revit)).toBe(2851);
    expect(s.comprimento).toBeCloseTo(revit + 2 * (50 - 40) + (Math.hypot(1080, 8) - 1080), 3);
    const f = formaDaBarra(s);
    expect([...f.trechos].sort((a, b) => a - b)).toEqual([26, 26, 111, 111]);
  });

  it('pino do estribo: 3φ até Ø10 (o do Pró-Viga), o da barra acima (NBR 6118 Tab. 9.2)', () => {
    expect(raioDoEstribo(6.3)).toBeCloseTo(2 * 6.3, 9);
    expect(raioDoEstribo(10)).toBeCloseTo(20, 9);
    expect(raioDoEstribo(12.5)).toBeCloseTo(3 * 12.5, 9);
    expect(raioDoEstribo(20)).toBeCloseTo(4.5 * 20, 9);
  });

  it('o estribo do contraforte no muro de verdade: na junta, ganchos no canto do muro, a forma da lista é o retângulo', () => {
    for (const c of ['aula123', 'sorteio17']) {
      const m = muro(c);
      const es = m.barras.filter((b) => b.papel === 'CF_ESTRIBO');
      expect(es.length, c).toBeGreaterThan(0);
      for (const b of es) {
        expect(b.estribo && !b.fechada, b.id).toBe(true);
        // a volta inteira (as duas passadas no canto dos ganchos) dentro da junta de 10 mm da fiada
        const zs = b.eixo.map((q) => q[2]);
        const z0 = Math.round((Math.min(...zs) - 5) / 200) * 200;
        expect(Math.min(...zs) - b.diametro / 2, b.id).toBeGreaterThanOrEqual(z0 - 1e-5);
        expect(Math.max(...zs) + b.diametro / 2, b.id).toBeLessThanOrEqual(z0 + 10 + 1e-5);
        const e = eixoDaBarra(b.eixo, b.diametro)!;
        expect(e.comprimento, b.id).toBeCloseTo(b.comprimento, 2);
      }
      // mesma forma em todos: uma posição só na lista de ferros
      expect(new Set(es.map((b) => b.posicao)).size, c).toBe(1);
      // a forma da lista: o retângulo do eixo, (t − 7) cm na largura (contraforte.py: eenr − 7)
      const f = formaDaBarra(es[0]);
      expect(f.fechada).toBe(true);
      expect(f.trechos).toHaveLength(4);
      expect(Math.min(...f.trechos)).toBe(Math.round((m.familia.t - 70) / 10));
    }
  });
});

// ── a sapata em estribos ─────────────────────────────────────────────────────

interface Sapata { h: number; c: number; phi: number; phi2: number; y0: number; y1: number; trechos: { x0: number; x1: number }[] }
const daSapata = (cenario: string, m: Modelo): Sapata => {
  const r = resultadoDoGabarito(cenario);
  return {
    h: (r.num('h_sap') as number) * 1000, c: (r.num('cob_sap') as number) * 10,
    phi: Number(r.v('phi_sap')), phi2: Number(r.v('phi_sap2')),
    y0: m.dims.sapata.y0, y1: m.dims.sapata.y1, trechos: m.dims.trechos,
  };
};
const xDoEstribo = (b: Barra): number => {
  const xs = b.eixo.map((q) => q[0]);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
};

describe('sapata em estribos (sap_transv = Estribo, o padrão)', () => {
  // balanço com talão (aula 12.2), contrafortes com torção (aula 12.3 e sorteio17, este sem Mk do talão), Ø16 em
  // sapata de 20 cm (sorteio01) e torção a cada 2 cm (alvo_cob_T_na_alma)
  const CENARIOS = ['aula122', 'aula123', 'sorteio17', 'sorteio01', 'alvo_cob_T_na_alma'];

  it('ramos dentro da sapata com o cobrimento, nas pontas do trecho também; longitudinal por dentro do estribo', () => {
    for (const c of CENARIOS) {
      const m = muro(c);
      const s = daSapata(c, m);
      const tol = 1e-6;
      const est = m.barras.filter((b) => b.papel === 'SAP_TRANSV' || b.papel === 'SAP_TORCAO');
      expect(est.filter((b) => b.papel === 'SAP_TRANSV').length, c).toBeGreaterThan(0);
      for (const b of est) {
        expect(b.estribo, b.id).toBe(true);
        const tr = s.trechos[b.trecho - 1];
        const R = b.diametro / 2;
        for (const [x, y, z] of b.eixo) {
          expect(y - R, `${c} ${b.id}`).toBeGreaterThanOrEqual(s.y0 + s.c - tol);
          expect(y + R, `${c} ${b.id}`).toBeLessThanOrEqual(s.y1 - s.c + tol);
          expect(z - R, `${c} ${b.id}`).toBeGreaterThanOrEqual(-s.h + s.c - tol);
          expect(z + R, `${c} ${b.id}`).toBeLessThanOrEqual(-s.c + tol);
          expect(x - R, `${c} ${b.id}`).toBeGreaterThanOrEqual(tr.x0 + s.c - tol);
          expect(x + R, `${c} ${b.id}`).toBeLessThanOrEqual(tr.x1 - s.c + tol);
        }
      }
      // longitudinal: por dentro dos ramos do estribo transversal (face de dentro = c + φ)
      const longs = m.barras.filter((b) => b.papel === 'SAP_LONG');
      expect(longs.length).toBeGreaterThan(0);
      for (const b of longs) {
        const [, y, z] = b.eixo[0];
        const R = b.diametro / 2;
        expect(y - R, `${c} ${b.id}`).toBeGreaterThanOrEqual(s.y0 + s.c + s.phi - tol);
        expect(y + R, `${c} ${b.id}`).toBeLessThanOrEqual(s.y1 - s.c - s.phi + tol);
        expect(z - R, `${c} ${b.id}`).toBeGreaterThanOrEqual(-s.h + s.c + s.phi - tol);
        expect(z + R, `${c} ${b.id}`).toBeLessThanOrEqual(-s.c - s.phi + tol);
      }
      // em cima sempre há longitudinal (no mínimo a dos cantos, que segura o estribo)
      expect(longs.some((b) => b.eixo[0][2] > -s.h / 2), c).toBe(true);
    }
  }, 60_000);

  it('ramo de baixo na altura da barra reta de antes; com Mk do talão, o de cima também, mesmo Ø, a cada ≤ s da conta', () => {
    for (const c of ['aula122', 'aula123']) {
      const r = resultadoDoGabarito(c);
      expect(r.num('Mk_heel'), c).toBeGreaterThan(0);
      const m = muro(c);
      const s = daSapata(c, m);
      const reta = muro(c, { sap_transv: 'Reta' });
      const zDe = (face: 'I' | 'S') => reta.barras.find((b) => b.papel === 'SAP_TRANSV' && b.id.includes(`.T${face}`))!.eixo[0][2];
      const est = m.barras.filter((b) => b.papel === 'SAP_TRANSV');
      for (const b of est) {
        const zs = b.eixo.map((q) => q[2]);
        expect(Math.min(...zs), b.id).toBeCloseTo(zDe('I'), 6);
        expect(Math.max(...zs), b.id).toBeCloseTo(zDe('S'), 6);
        expect(b.diametro).toBe(s.phi);
      }
      const sPs = (r.num('s_ps') as number) * 10;
      for (let t = 1; t <= s.trechos.length; t++) {
        const xs = est.filter((b) => b.trecho === t).map(xDoEstribo).sort((a, b) => a - b);
        for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1], `${c} T${t}`).toBeLessThanOrEqual(sPs + 1e-6);
      }
    }
  });

  it('estribo de torção não cai no lugar de uma transversal: encosta nela', () => {
    for (const c of ['aula123', 'sorteio17']) {
      const m = muro(c);
      const tor = m.barras.filter((b) => b.papel === 'SAP_TORCAO');
      const tra = m.barras.filter((b) => b.papel === 'SAP_TRANSV');
      expect(tor.length, c).toBeGreaterThan(0);
      for (const q of tor) {
        for (const b of tra.filter((x) => x.trecho === q.trecho)) {
          expect(Math.abs(xDoEstribo(q) - xDoEstribo(b)), `${q.id} × ${b.id}`).toBeGreaterThanOrEqual(q.diametro + b.diametro - 1e-6);
        }
      }
    }
  });

  it('forma na lista de ferros: o retângulo do eixo, B − 2c − φ por h − 2c − φ', () => {
    const m = muro('aula122');
    const s = daSapata('aula122', m);
    const b = m.barras.find((x) => x.papel === 'SAP_TRANSV')!;
    const f = formaDaBarra(b);
    expect(f.fechada).toBe(true);
    const W = Math.round((s.y1 - s.y0 - 2 * s.c - s.phi) / 10);
    const H = Math.round((s.h - 2 * s.c - s.phi) / 10);
    expect([...f.trechos].sort((x, y) => x - y)).toEqual([H, H, W, W].sort((x, y) => x - y));
  });
});

// ── o desenho de antes, barra por barra ──────────────────────────────────────

const FIXTURE = antes as Record<string, string[]>;
const caso = (chave: string): [string, Record<string, Valor>] => {
  const [c, json] = chave.split(' ');
  return [c, json ? (JSON.parse(json) as Record<string, Valor>) : {}];
};
const linha = (b: Barra | BarraNova): string => `${b.id}|${b.papel}|${b.diametro}|${b.comprimento}|${b.eixo.map((q) => q.join(',')).join(';')}`;

describe('o desenho de 15/10 continua disponível, barra por barra', () => {
  it("sap_transv = 'Reta': a transversal e a longitudinal da sapata iguais às de antes (ids, posições, comprimentos)", () => {
    for (const chave of Object.keys(FIXTURE)) {
      const [c, extras] = caso(chave);
      const m = muro(c, { ...extras, sap_transv: 'Reta' });
      const agora = m.barras.filter((b) => b.papel === 'SAP_TRANSV' || b.papel === 'SAP_LONG').map(linha);
      const era = FIXTURE[chave].filter((l) => l.includes('|SAP_'));
      expect(era.length, chave).toBeGreaterThan(0);
      expect(agora, chave).toEqual(era);
    }
  }, 60_000);

  it("arranque = 'Padrão' (o padrão): a espera igual à de antes, sem aviso do nó", () => {
    for (const chave of Object.keys(FIXTURE)) {
      const [c, extras] = caso(chave);
      const era = FIXTURE[chave].filter((l) => l.includes('|ESPERA|'));
      expect(era.length, chave).toBeGreaterThan(0);
      const padrao = muro(c, extras);
      expect(padrao.barras.filter((b) => b.papel === 'ESPERA').map(linha), chave).toEqual(era);
      expect(padrao.avisos.some((a) => a.codigo.startsWith('NO_DE_CACHORRO')), chave).toBe(false);
    }
  }, 60_000);
});

// ── o nó de cachorro (o Revit do Jose, 15/10) ────────────────────────────────

/** O Resultado com alguns nomes trocados (sem refazer a conta: só para o desenho ler outra entrada). */
const trocar = (r: Resultado, t: Record<string, Valor>): Resultado => ({
  v: (n) => (n in t ? t[n] : r.v(n)),
  num: (n) => {
    const x = n in t ? t[n] : r.v(n);
    return typeof x === 'number' ? x : null;
  },
  cel: (ref) => r.cel(ref),
  alteracoes: r.alteracoes,
});

describe('nó de cachorro (arranque = Nó de cachorro)', () => {
  // a sapata do template dele: 1200 × 350, cobrimento 40, muro na borda (sem pé)
  const SAP = { h: 350, c: 40, yFrente: 0, yTalao: 1200 };

  it('as medidas das amostras do Revit: raio no eixo e subida reta na sapata de 35 cm', () => {
    expect(medidasDoNo(10, 350, 40)).toEqual({ raio: 30, subida: 200 });
    expect(medidasDoNo(16, 350, 40)).toEqual({ raio: 48, subida: 158 });
    expect(medidasDoNo(20, 350, 40)).toEqual({ raio: 90, subida: 70 });
  });

  it('a forma: desce, corre pelo fundo ATÉ A PONTA, sobe a face da ponta, deitada por cima até a ponta do talão e desce', () => {
    // a amostra Ø10 (337807): perna do muro 2239, total 3870 com o U colado na espera (o muro dele na borda da
    // sapata, a espera a 143 mm da face). Desde 15/10 o nó vai até a face da ponta (Jose: "quero que ela vá até a
    // ponta"): o fundo e a deitada crescem os 38 mm entre o U colado (subida a 83) e a face (subida a 45)
    const zb = -350 + 40 + 5;
    const b = esperaNoDeCachorro('e', 10, 500, 143, 2239 + zb + 30, SAP, 1)!;
    expect(b).not.toBeNull();
    expect(b.comprimento).toBeCloseTo(3870 + 2 * 38, -1);
    // o comprimento é o da polilinha com os arcos verdadeiros: U (2 arcos de 90°), dobra de cima e da ponta
    const e = eixoDaBarra(b.eixo, 10)!;
    expect(e.comprimento).toBeCloseTo(b.comprimento, 2);
    expect(e.arcos).toBe(4);
    const tol = 1e-6;
    for (const [, y, z] of b.eixo) {
      expect(y - 5).toBeGreaterThanOrEqual(SAP.yFrente + 40 - tol);
      expect(y + 5).toBeLessThanOrEqual(SAP.yTalao - 40 + tol);
      if (z < 0) {
        expect(z - 5).toBeGreaterThanOrEqual(-350 + 40 - tol);
        expect(z + 5).toBeLessThanOrEqual(-40 + tol);
      }
    }
    // a perna que sobe fica na face da ponta, no cobrimento (40 + φ/2)
    const ys = b.eixo.map((q) => q[1]);
    expect(Math.min(...ys)).toBeCloseTo(SAP.yFrente + 45, 6);
    // termina embaixo, na face da ponta do talão
    const fim = b.eixo[b.eixo.length - 1];
    expect(fim[1]).toBeCloseTo(1200 - 45, 6);
    expect(fim[2]).toBeCloseTo(zb, 6);
    // a deitada passa AO LADO da que desce (uma bitola em X): a barra não volta ao lugar de onde saiu
    const deitada = b.eixo.filter((q) => Math.abs(q[2] - (-45)) < 1e-6);
    expect(deitada.length).toBeGreaterThan(0);
    for (const q of deitada) expect(q[0]).toBeCloseTo(510, 6);
  });

  it('não existe onde a dobra não cabe: sapata baixa (h < 2c + pino + 2φ) ou sem pé para o U', () => {
    // Ø20: 2·40 + 160 + 40 = 280
    expect(esperaNoDeCachorro('e', 20, 0, 400, 1000, { ...SAP, h: 279 }, 1)).toBeNull();
    expect(esperaNoDeCachorro('e', 20, 0, 400, 1000, { ...SAP, h: 280 }, 1)).not.toBeNull();
    // Ø10 a 143 da face: as duas dobras do pé pedem 2r = 60 entre a espera e a perna da ponta (a 45 da face): com a
    // frente a 50 o fundo reto ficaria negativo
    expect(esperaNoDeCachorro('e', 10, 0, 143, 1000, { ...SAP, yFrente: 50 }, 1)).toBeNull();
    expect(esperaNoDeCachorro('e', 10, 0, 143, 1000, { ...SAP, yFrente: 38 }, 1)).not.toBeNull();
  });

  it('ponta da sapata pela tabela do Jose (bloco 14 e 19); a mesma largura do nó nos dois blocos', () => {
    const p14 = (phi: number) => pontaDoNo('14x39', phi)?.ponta;
    const p19 = (phi: number) => pontaDoNo('19x39', phi)?.ponta;
    expect([5, 6.3, 8, 10, 12.5, 16, 20, 25].map(p14)).toEqual([0, 0, 0, 40, 40, 70, 70, null]);
    expect([5, 6.3, 8, 10, 12.5, 16, 20, 25].map(p19)).toEqual([0, 0, 0, 0, 0, 20, 20, 70]);
    expect(pontaDoNo('19x39', 25)?.aConfirmar).toBe(true);
    expect(PONTA_DO_NO['14x39'].some((l) => l.aConfirmar)).toBe(false);
    // a régua que liga as duas: largura do nó = espessura + ponta, a mesma no 14 e no 19 (o que passa de 19 cm)
    for (const phi of [10, 12.5, 16, 20]) expect(Math.max(0, 140 + p14(phi)! - 190), `Ø${phi}`).toBe(p19(phi));
  });

  it('no muro: desenhado onde cabe; sapata baixa → não desenha e avisa; pé curto → avisa pela tabela', () => {
    const r = resultadoDoGabarito('aula122');
    const m = gerarModelo(r, { ...padroesDoModelo(), arranque: 'Nó de cachorro' });
    const es = m.barras.filter((b) => b.papel === 'ESPERA');
    expect(es.length).toBe(m.barras.filter((b) => b.papel === 'VERT_MURO').length);
    const s = daSapata('aula122', m);
    for (const b of es) {
      const zs = b.eixo.map((q) => q[2]);
      expect(Math.min(...zs), b.id).toBeCloseTo(-s.h + s.c + b.diametro / 2, 6);
      expect(Math.max(...b.eixo.map((q) => q[1])), b.id).toBeCloseTo(s.y1 - s.c - b.diametro / 2, 6);
      expect(eixoDaBarra(b.eixo, b.diametro)!.comprimento, b.id).toBeCloseTo(b.comprimento, 2);
    }
    expect(m.avisos.filter((a) => a.codigo.startsWith('NO_DE_CACHORRO'))).toEqual([]);

    // sapata de 14 cm com Ø10: a dobra pede 2·4 + 5 + 2 = 15 cm
    const baixa = gerarModelo(trocar(r, { h_sap: 0.14 }), { ...padroesDoModelo(), arranque: 'Nó de cachorro' });
    expect(baixa.barras.filter((b) => b.papel === 'ESPERA')).toEqual([]);
    const dobra = baixa.avisos.filter((a) => a.codigo === 'NO_DE_CACHORRO_DOBRA');
    expect(dobra).toHaveLength(1);
    expect(dobra[0].ids).toHaveLength(es.length);
    expect(dobra[0].texto).toBe('Nó de cachorro Ø10: a dobra pede sapata de 15 cm (tem 14) — espera não desenhada');

    // Ø16 no bloco 19 com o muro na borda da sapata (sem pé): a tabela pede 2 cm, e o U sai pela frente
    const B = r.num('B_sap')!;
    const borda = gerarModelo(trocar(r, { phi_v: 16, a_ater: B - 0.095 }), { ...padroesDoModelo(), arranque: 'Nó de cachorro' });
    const codigos = borda.avisos.map((a) => a.codigo);
    expect(codigos).toContain('NO_DE_CACHORRO_PONTA');
    expect(borda.avisos.find((a) => a.codigo === 'NO_DE_CACHORRO_PONTA')!.texto).toBe('Nó de cachorro Ø16: ponta da sapata de 0 cm, o bloco 19 pede 2 cm');
    expect(codigos).toContain('NO_DE_CACHORRO_FORA');
  }, 60_000);
});
