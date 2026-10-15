/*
  O VISOR CONTRA O MURO DE VERDADE — o Modelo que a modulação gera a partir da conta do Excel (gabarito).

  O exemplo montado à mão (exemploDeModelo.ts) prova a mecânica; este prova a CONCORDÂNCIA: o 3D põe cada peça
  exatamente onde a modulação diz (a mesma regra que o IFC, os desenhos e o quantitativo leem por
  `paraGlobal`). Se um dia o 3D e o IFC mostrarem muros diferentes, este teste quebra antes.
*/
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Valor } from '@/motor/tipos';
import type { Modelo, Peca, Vec3 } from '@/modelo/tipos';
import { caixaGlobal, gerarModelo, padroesDoModelo, paraGlobal } from '@/modulacao';
import { construirCena3D } from './cena3d';
import { caixaLocal, MM } from './perfil3d';
import { lerPaleta } from './tema3d';

const paleta = lerPaleta();
const ALVENARIA = new Set(['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);

function modelo(cenario: string, extras: Record<string, Valor> = {}): Modelo {
  return gerarModelo(resultadoDoGabarito(cenario), { ...padroesDoModelo(), ...extras });
}

/** Raio horizontal vindo de −Y (de quem olha a face aparente), em metro. */
const raioDeFrente = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, -50, z), new THREE.Vector3(0, 1, 0));

/** Os 8 cantos da caixa local (mm): o que a matriz da instância tem de levar onde a modulação leva. */
function cantos(p: Peca, m: Modelo): Vec3[] {
  const c = caixaLocal(m.geometrias[p.geometria]!);
  const out: Vec3[] = [];
  for (let k = 0; k < 8; k++) out.push([k & 1 ? c.max[0] : c.min[0], k & 2 ? c.max[1] : c.min[1], k & 4 ? c.max[2] : c.min[2]]);
  return out;
}

describe('o visor e a modulação põem cada peça no mesmo lugar', () => {
  const cenarios = cenariosDoGabarito().filter((c) => c === 'aula122' || c === 'aula123' || c.startsWith('sorteio'));

  it.for(cenarios)('%s: toda peça desenhada, matriz da instância = paraGlobal', (cenario, ctx) => {
    // Cenário que a modulação não consegue montar é defeito DELA (tem prova própria em modulacao/); aqui
    // ele fica de fora, à vista, em vez de derrubar a prova do visor.
    let m: Modelo;
    try {
      m = modelo(cenario, { L_total: 6, junta_cada: 0 });
    } catch (e) {
      ctx.skip(`a modulação não montou ${cenario}: ${(e as Error).message}`);
      return;
    }
    const c = construirCena3D(m, paleta);
    expect(c.semGeometria).toEqual([]);
    const instancias = c.lotes.reduce((s, l) => s + l.malha.count, 0);
    expect(instancias).toBe(m.pecas.length);
    const barrasDesenhadas = c.barras.reduce((s, b) => s + b.lote.faixas.length, 0);
    expect(barrasDesenhadas).toBe(m.barras.filter((b) => b.diametro > 0 && b.eixo.length >= 2).length);

    const mat = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let pior = 0;
    for (const l of c.lotes) {
      for (let i = 0; i < l.lote.ids.length; i++) {
        const p = c.achar(l.lote.ids[i]!);
        if (p?.tipo !== 'peca') throw new Error(`instância sem peça: ${l.lote.ids[i]}`);
        l.malha.getMatrixAt(i, mat);
        for (const q of cantos(p.peca, m)) {
          v.set(q[0] * MM, q[1] * MM, q[2] * MM).applyMatrix4(mat);
          const g = paraGlobal(p.peca, m.geometrias[p.peca.geometria]!, q);
          pior = Math.max(pior, Math.abs(v.x / MM - g[0]), Math.abs(v.y / MM - g[1]), Math.abs(v.z / MM - g[2]));
        }
      }
    }
    // Float32 na matriz da instância: 20 m em metro guarda ~1 µm; um centésimo de mm é folga de sobra.
    expect(pior).toBeLessThan(0.01);
    c.dispose();
  });

  it.each(['aula122', 'aula123'])('%s: o clique na face de fora de um bloco devolve aquele bloco', (cenario) => {
    const m = modelo(cenario, { L_total: 6 });
    const c = construirCena3D(m, paleta);
    // Fiada do meio (longe de barbacã e de cinta), peças de alvenaria do muro.
    const meio = Math.floor(m.dims.n_fiadas / 2);
    const alvos = m.pecas.filter((p) => p.grupo === 'muro' && ALVENARIA.has(p.tipo) && p.fiada === meio);
    expect(alvos.length).toBeGreaterThan(5);
    for (const p of alvos) {
      const k = caixaGlobal(p, m.geometrias[p.geometria]!);
      if (k.min[1] > 1) continue; // só as que encostam na face aparente
      const id = c.pegar(raioDeFrente(((k.min[0] + k.max[0]) / 2) * MM, ((k.min[2] + k.max[2]) / 2) * MM));
      expect(id, `${p.id} em x ${k.min[0]}–${k.max[0]}`).toBe(p.id);
    }
    c.dispose();
  });

  it('aula123 (contrafortes): ocultar Contrafortes leva bloco, graute e barra do contraforte juntos', () => {
    const m = modelo('aula123', { L_total: 6 });
    const c = construirCena3D(m, paleta);
    expect(m.dims.contrafortes.length).toBeGreaterThan(1);
    const doCf = c.lotes.filter((l) => l.lote.categorias.includes('contrafortes'));
    const barrasDoCf = c.barras.filter((b) => b.lote.categorias.includes('contrafortes'));
    expect(doCf.length).toBeGreaterThan(0);
    expect(barrasDoCf.length).toBeGreaterThan(0);
    c.aplicarVisibilidade(new Set(['contrafortes']));
    for (const l of doCf) expect(l.malha.visible).toBe(false);
    for (const b of barrasDoCf) expect(b.malha.visible).toBe(false);
    // Toda peça do grupo contraforte caiu num lote marcado como contraforte.
    const idsDoCf = new Set(doCf.flatMap((l) => l.lote.ids));
    for (const p of m.pecas) if (p.grupo === 'contraforte') expect(idsDoCf.has(p.id)).toBe(true);
    c.dispose();
  });

  it('aula122: com a Armadura o clique de frente numa barra do muro acha a barra, não o bloco da frente', () => {
    const m = modelo('aula122', { L_total: 6 });
    const c = construirCena3D(m, paleta);
    c.aplicarArmadura(true);
    const barra = m.barras.find((b) => b.papel === 'VERT_MURO')!;
    expect(barra).toBeDefined();
    // a meia altura da barra vertical, no x dela (eixo em mm, global do trecho 1)
    const [x, , z0] = barra.eixo[0];
    const z1 = barra.eixo[barra.eixo.length - 1][2];
    const id = c.pegar(raioDeFrente(x * MM, ((z0 + z1) / 2) * MM));
    const pego = id ? c.achar(id) : null;
    expect(pego?.tipo).toBe('barra');
    c.dispose();
  });
});

describe('desempenho com o muro de verdade', () => {
  it('muro longo de contrafortes (aula 12.3, 120 m): chamadas de desenho pelo número de formas', () => {
    const t0 = performance.now();
    const m = modelo('aula123', { L_total: 120, junta_cada: 0 });
    const tModelo = performance.now() - t0;
    const alvenaria = m.pecas.filter((p) => ALVENARIA.has(p.tipo)).length;
    const t1 = performance.now();
    const c = construirCena3D(m, paleta);
    const tCena = performance.now() - t1;
    const chamadas = c.chamadasDeDesenho();
    const formas = new Set(m.pecas.map((p) => p.geometria)).size;
    const diametros = new Set(m.barras.map((b) => b.diametro)).size;
    const triPecas = c.lotes.reduce((s, l) => s + (l.malha.geometry.getAttribute('position').count / 3) * l.malha.count, 0);
    const triAco = c.barras.reduce((s, b) => s + b.lote.geometria.index!.count / 3, 0);
    // O traço é instanciado: segmentos de uma peça × peças (o que a placa desenha; na memória fica uma peça só).
    const segTraco = c.lotes.reduce((s, l) => s + (l.traco ? (l.traco.geometry.getAttribute('position').count / 2) * l.malha.count : 0), 0);
    console.info(
      `[visor] aula123 120 m: ${alvenaria} peças de alvenaria, ${m.pecas.length} peças, ${m.barras.length} barras, ` +
        `${formas} formas, ${diametros} Ø → ${c.lotes.length} lotes, ${c.barras.length} malhas de aço, ${chamadas} chamadas de desenho; ` +
        `${(triPecas / 1e6).toFixed(2)} M triângulos de peça + ${(triAco / 1e6).toFixed(2)} M de aço, ${(segTraco / 1e6).toFixed(2)} M segmentos de traço ` +
        `(modelo ${tModelo.toFixed(0)} ms, cena ${tCena.toFixed(0)} ms)`,
    );
    expect(alvenaria).toBeGreaterThanOrEqual(5000);
    // Uma chamada por lote, mais o traço dos lotes de alvenaria/concreto, mais uma por Ø: nada cresce com o comprimento.
    expect(chamadas).toBeLessThanOrEqual(2 * c.lotes.length + c.barras.length);
    // Era < 80. Desde 09/10 noite (modulação) a canaleta tem o fundo furado onde sobe a barra e a parede quebrada no
    // contraforte, e cada posição de furo é uma forma: na 14x39 a grade da canaleta anda 5 cm a cada contraforte, então
    // o muro passa por ~70 posições antes de repetir — e para aí (30, 60, 120 e 240 m dão o mesmo tanto). O teto
    // acompanha; o que não pode é crescer com o comprimento (conferido abaixo, com metade do muro).
    expect(chamadas).toBeLessThan(220);
    const metade = construirCena3D(modelo('aula123', { L_total: 60, junta_cada: 0 }), paleta);
    expect(chamadas - metade.chamadasDeDesenho(), 'chamadas crescem com o comprimento').toBeLessThanOrEqual(6);
    metade.dispose();
    const t2 = performance.now();
    for (let k = 0; k < 10; k++) c.pegar(raioDeFrente(5 + k * 11, 1));
    console.info(`[visor] raio de seleção no muro de 120 m: ${((performance.now() - t2) / 10).toFixed(1)} ms por clique`);
    c.dispose();
  }, 30_000);   // muro de 120 m com todos os estribos e ganchos (15/10): passa de 5 s com a suíte inteira rodando junto
});
