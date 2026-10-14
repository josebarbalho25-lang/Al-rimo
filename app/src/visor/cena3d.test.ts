import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { construirCena3D } from './cena3d';
import { corDoAco } from './estiloVisual';
import { corDaBitola } from './coresDasBitolas';
import { muroDeExemplo } from './exemploDeModelo';
import type { Categoria } from './lotes';
import { lerPaleta } from './tema3d';

const paleta = lerPaleta(); // no Node, as reservas
const raioDe = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, -10, z), new THREE.Vector3(0, 1, 0));
const cor = (hex: string) => new THREE.Color(hex);
/** A cor da instância é guardada em Float32: compara com tolerância. */
const igual = (a: THREE.Color, hex: string) => {
  const b = cor(hex);
  return Math.abs(a.r - b.r) < 1e-6 && Math.abs(a.g - b.g) < 1e-6 && Math.abs(a.b - b.b) < 1e-6;
};

describe('cena 3D montada (sem WebGL)', () => {
  const m = muroDeExemplo({ blocosPorFiada: 6, fiadas: 8, contraforte: true, terreno: true });
  const c = construirCena3D(m, paleta);

  it('cada lote é um InstancedMesh com a contagem certa; o traço vai junto', () => {
    const l = c.lotes.find((x) => x.lote.chave === 'bloco 14x19x39|alvenaria|blocos')!;
    expect(l.malha).toBeInstanceOf(THREE.InstancedMesh);
    expect(l.malha.count).toBe(39);
    expect(l.traco).not.toBeNull();
    // Graute não leva traço (riscaria o pilar a cada fiada).
    expect(c.lotes.find((x) => x.lote.acabamento === 'graute')!.traco).toBeNull();
    // Cor de instância criada ANTES do 1º quadro (senão o shader nasce sem ela).
    for (const x of c.lotes) expect(x.malha.instanceColor).not.toBeNull();
  });

  it('o clique devolve a peça certa: bloco da fiada 2, segundo da fila', () => {
    // Fiada 2 (par): blocos a cada 400 mm, z de 410 a 600. x = 0,6 m cai no 2º bloco, na parede entre os furos.
    const id = c.pegar(raioDe(0.6, 0.5));
    expect(id).toBe('T1.M.f02.p001');
  });

  it('o clique na barra acha a barra (pela faixa de triângulos)', () => {
    // A barra vertical V000 sobe em x = 97,5 mm, y = 70 mm: um raio de lado na altura da sapata, por dentro do bloco oculto.
    c.aplicarVisibilidade(new Set<Categoria>(['blocos', 'graute', 'fundacao', 'terreno', 'drenagem']));
    expect(c.pegar(raioDe(0.0975, 0.1))).toBe('B.V000');
    c.aplicarVisibilidade(new Set());
  });

  it('o que está oculto não se pega; o terreno nunca se pega', () => {
    c.aplicarVisibilidade(new Set<Categoria>(['blocos']));
    const id = c.pegar(raioDe(0.6, 0.5));
    // Sem os blocos, o raio passa pelo vão e acerta o que estiver atrás (dreno), nunca o aterro.
    expect(id === null || !id.startsWith('T1.M.')).toBe(true);
    expect(id).not.toBe('TER.ATERRO');
    c.aplicarVisibilidade(new Set());
  });

  it('Armadura: a barra vem por cima do bloco (o "desobstruído" do Revit) e o clique acha a barra através dele', () => {
    // A barra vertical V000 sobe em x = 97,5 mm, dentro do bloco 0: o raio de frente bate primeiro no bloco.
    expect(c.pegar(raioDe(0.0975, 0.5))).toBe('T1.M.f02.p000');
    c.aplicarArmadura(true);
    expect(c.pegar(raioDe(0.0975, 0.5))).toBe('B.V000');
    for (const b of c.barras) {
      const mat = b.malha.material as THREE.Material;
      expect(mat.depthTest).toBe(false);
      expect(b.malha.renderOrder).toBeGreaterThan(2);
    }
    // o bloco NÃO vira vidro (era o que poluía o Raio-X: as arestas de trás de todos os blocos)
    const bloco = c.lotes.find((l) => l.lote.acabamento === 'alvenaria')!;
    expect((bloco.malha.material as THREE.Material).transparent).toBe(false);
    c.aplicarArmadura(false);
    expect(c.pegar(raioDe(0.0975, 0.5))).toBe('T1.M.f02.p000');
    for (const b of c.barras) expect((b.malha.material as THREE.Material).depthTest).toBe(true);
  });

  it('Armadura: cada Ø na cor da bitola do Jose (Revit, "Iso Escada"); desligada, o aço do estilo', () => {
    c.aplicarArmadura(true);
    for (const b of c.barras) {
      const a = b.lote.geometria.getAttribute('color');
      const esperada = new THREE.Color(corDaBitola(b.lote.diametro));
      // a cor mora num Float32Array: confere com a tolerância do float
      expect(a.getX(0)).toBeCloseTo(esperada.r, 6);
      expect(a.getY(0)).toBeCloseTo(esperada.g, 6);
      expect(a.getZ(0)).toBeCloseTo(esperada.b, 6);
    }
    expect(c.diametrosVisiveis(new Set())).toEqual([...new Set(c.barras.map((b) => b.lote.diametro))].sort((x, y) => x - y));
    c.aplicarArmadura(false);
    const aco = new THREE.Color(corDoAco('cores'));
    const a = c.barras[0].lote.geometria.getAttribute('color');
    expect(a.getX(0)).toBeCloseTo(aco.r, 6);
    expect(a.getY(0)).toBeCloseTo(aco.g, 6);
    expect(a.getZ(0)).toBeCloseTo(aco.b, 6);
  });

  it('o corte: o lado cortado não se pega (o clique atravessa)', () => {
    // Plano que tira y < 0,05: a face de fora do bloco some, e o raio só vale dentro.
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
    c.aplicarCorte([plano]);
    const id = c.pegar(raioDe(0.6, 0.5));
    // Atravessa a casca de fora; ainda pega o mesmo bloco, mas pela parede de dentro (y > 0,05).
    expect(id).toBe('T1.M.f02.p001');
    c.aplicarCorte([new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.3)]); // fica x ≤ 0,3
    expect(c.pegar(raioDe(0.6, 0.5))).not.toBe('T1.M.f02.p001');
    c.aplicarCorte([]);
  });

  it('seleção pinta só a instância pega, e volta ao soltar', () => {
    const l = c.lotes.find((x) => x.lote.ids.includes('T1.M.f02.p001'))!;
    const i = l.lote.ids.indexOf('T1.M.f02.p001');
    const lida = new THREE.Color();
    c.pintarSelecao('T1.M.f02.p001');
    l.malha.getColorAt(i, lida);
    expect(igual(lida, paleta.selecionado)).toBe(true);
    l.malha.getColorAt(i + 1, lida);
    expect(igual(lida, paleta.bloco)).toBe(true);
    c.pintarSelecao(null);
    l.malha.getColorAt(i, lida);
    expect(igual(lida, paleta.bloco)).toBe(true);
  });

  it('seleção de barra repinta só a faixa dela', () => {
    c.pintarSelecao('B.V001');
    const b = c.barras.find((x) => x.lote.faixas.some((f) => f.id === 'B.V001'))!;
    const f = b.lote.faixas.find((x) => x.id === 'B.V001')!;
    const a = b.lote.geometria.getAttribute('color');
    const sel = cor(paleta.selecionado);
    const aco = cor(corDoAco('cores'));
    expect(a.getX(f.vIni)).toBeCloseTo(sel.r, 6);
    expect(a.getX(f.vIni - 1)).toBeCloseTo(aco.r, 6);
    c.pintarSelecao(null);
    expect(a.getX(f.vIni)).toBeCloseTo(aco.r, 6);
  });

  it('ocultar categoria apaga a malha e o traço juntos; peça de duas categorias some com qualquer uma', () => {
    const cf = c.lotes.find((x) => x.lote.chave === 'graute furo 14x39|graute|graute+contrafortes')!;
    c.aplicarVisibilidade(new Set<Categoria>(['contrafortes']));
    expect(cf.malha.visible).toBe(false);
    c.aplicarVisibilidade(new Set<Categoria>(['graute']));
    expect(cf.malha.visible).toBe(false);
    c.aplicarVisibilidade(new Set());
    expect(cf.malha.visible).toBe(true);
  });

  it('enquadrar só o que está aceso, sem o terreno', () => {
    const tudo = c.caixaVisivel();
    expect(tudo.max[1]).toBeCloseTo(0.9, 6); // talão da sapata, não o aterro (que vai a 1,64)
    c.aplicarVisibilidade(new Set<Categoria>(['fundacao', 'terreno', 'drenagem', 'contrafortes']));
    const soMuro = c.caixaVisivel();
    expect(soMuro.min[2]).toBeGreaterThan(-0.31); // a sapata saiu: a caixa começa na espera
    c.aplicarVisibilidade(new Set());
  });

  it('centro da peça (pivô do giro com Shift)', () => {
    const ctr = c.centroDe('T1.M.f02.p001')!;
    expect(ctr[0]).toBeCloseTo(0.595, 6);
    expect(ctr[1]).toBeCloseTo(0.07, 6);
    expect(ctr[2]).toBeCloseTo(0.505, 6);
    expect(c.achar('B.V000')!.tipo).toBe('barra');
    expect(c.achar('nada')).toBeNull();
  });
});

describe('desempenho: 5.000 blocos', () => {
  // 250 blocos × 20 fiadas = 5.010 peças de alvenaria (as ímpares têm dois meios).
  const m = muroDeExemplo({ blocosPorFiada: 250, fiadas: 20, barraACada: 2, terreno: true });
  const alvenaria = m.pecas.filter((p) => p.grupo === 'muro' && !p.tipo.startsWith('GRAUTE')).length;

  it('o custo de desenhar é o número de LOTES, não o de blocos', () => {
    const t0 = performance.now();
    const c = construirCena3D(m, paleta);
    const montagem = performance.now() - t0;
    expect(alvenaria).toBeGreaterThanOrEqual(5000);
    const chamadas = c.chamadasDeDesenho();
    // 5.010 blocos + 2.375 grautes + ~380 barras cabem em menos de 20 chamadas de desenho.
    expect(chamadas).toBeLessThan(20);
    const triangulos = c.lotes.reduce((s, l) => s + (l.malha.geometry.getAttribute('position').count / 3) * l.malha.count, 0);
    console.info(`[visor] ${alvenaria} blocos, ${m.pecas.length} peças, ${m.barras.length} barras → ${chamadas} chamadas de desenho, ${Math.round(triangulos / 1000)} mil triângulos; montagem ${montagem.toFixed(0)} ms`);
    // Raio de seleção (um por clique; não há realce ao passar o mouse).
    const t1 = performance.now();
    for (let k = 0; k < 10; k++) c.pegar(raioDe(10 + k * 7, 1.5));
    const raio = (performance.now() - t1) / 10;
    console.info(`[visor] raio de seleção: ${raio.toFixed(1)} ms por clique`);
    expect(raio).toBeLessThan(50);
    c.dispose();
  });
});

describe('traço pelo zoom', () => {
  it('de longe o traço some (e deixa de ser chamada de desenho); de perto volta', () => {
    const c = construirCena3D(muroDeExemplo({ blocosPorFiada: 6, fiadas: 4 }), paleta);
    const comTraco = c.chamadasDeDesenho();
    c.aplicarZoom(10); // 2 px por fiada
    expect(c.chamadasDeDesenho()).toBeLessThan(comTraco);
    c.aplicarZoom(200); // 40 px por fiada
    expect(c.chamadasDeDesenho()).toBe(comTraco);
    c.dispose();
  });
});
