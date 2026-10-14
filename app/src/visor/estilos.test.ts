/*
  OS TRÊS ESTILOS DO 3D (Cores, Realista, Opaco) — o que cada um promete, conferido sem WebGL.

  O que vale para o Jose: no Cores cada classe de bloco sai na cor do Revit dele e a legenda mostra só o que
  está na tela; no Opaco tudo é papel com traço preto; no Realista há pele e sombra; e em qualquer um a seleção,
  o Raio-X e o corte continuam funcionando — trocar de estilo não pode desfazer nada disso.
*/
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ClassePeca, Modelo } from '@/modelo/tipos';
import { CORES_DO_JOSE } from '@/modulacao/catalogo';
import { construirCena3D } from './cena3d';
import { COR_DA_CLASSE, corDaPeca, corDoAco, ehEstiloVisual, lembrarEstilo, guardarEstilo, ESTILO_PADRAO, opacidadeDoTerreno, tracoDoEstilo } from './estiloVisual';
import { muroDeExemplo } from './exemploDeModelo';
import { campoDaPele } from './geracaoDasPeles';
import { itensDaLegenda } from './LegendaDasCores';
import type { Categoria } from './lotes';
import { enquadrarSombra, ORCAMENTO_DA_SOMBRA } from './sombraDoSol';
import { lerPaleta } from './tema3d';

const paleta = lerPaleta();
const raioDe = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, -10, z), new THREE.Vector3(0, 1, 0));
const hex = (c: THREE.Color) => `#${c.getHexString()}`;

/** O muro de exemplo com a classe que a modulação põe em cada geometria de alvenaria. */
function muroComClasses(): Modelo {
  const m = muroDeExemplo({ blocosPorFiada: 6, fiadas: 6, terreno: true });
  const classe: Record<string, ClassePeca> = {
    'bloco 14x19x39': 'inteiro',
    'meio bloco 14x19x19': 'meio',
    'canaleta 14x19x39': 'canaleta',
    'meia canaleta 14x19x19': 'canaleta',
  };
  for (const [k, c] of Object.entries(classe)) m.geometrias[k]!.classe = c;
  return m;
}

describe('estilo: escolhas e cores', () => {
  it('as cores das classes são as do Revit do Jose (o bloco 44, sem cor no Revit, saiu com a família 14x29)', () => {
    for (const [c, cor] of Object.entries(CORES_DO_JOSE)) expect(COR_DA_CLASSE[c as ClassePeca]).toBe(cor);
    for (const c of Object.keys(COR_DA_CLASSE)) expect(CORES_DO_JOSE, c).toHaveProperty(c);
  });

  it('no Cores, graute e aço não repetem a cor de nenhum bloco (o pilar e a barra não se confundem com a modulação)', () => {
    const doBloco = Object.values(COR_DA_CLASSE).map((c) => c.toLowerCase());
    expect(doBloco).not.toContain(corDaPeca('cores', paleta, 'graute').toLowerCase());
    expect(doBloco).not.toContain(corDoAco('cores').toLowerCase());
    // A canaleta inteira, a meia e a cortada são uma classe só: a mesma cor.
    expect(corDaPeca('cores', paleta, 'alvenaria', 'canaleta')).toBe(COR_DA_CLASSE.canaleta);
  });

  it('o estilo lembrado: volta o que foi guardado; sem nada guardado, com lixo ou sem armazenamento, Cores', () => {
    expect(ESTILO_PADRAO).toBe('cores');
    expect(ehEstiloVisual('opaco')).toBe(true);
    expect(ehEstiloVisual('linha')).toBe(false);
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const guardado = new Map<string, string>();
    const falso = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v), removeItem: (k: string) => void guardado.delete(k) };
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: falso, configurable: true });
      expect(lembrarEstilo()).toBe('cores');
      guardarEstilo('realista');
      expect(lembrarEstilo()).toBe('realista');
      for (const k of guardado.keys()) guardado.set(k, '"linha oculta"');
      expect(lembrarEstilo()).toBe('cores');
      // Armazenamento que explode (janela anônima, bloqueado): o visor abre igual, no padrão.
      Object.defineProperty(globalThis, 'localStorage', {
        get: () => {
          throw new Error('bloqueado');
        },
        configurable: true,
      });
      expect(lembrarEstilo()).toBe('cores');
      expect(() => guardarEstilo('opaco')).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('o traço: preto e cheio no Opaco, nenhum no Realista', () => {
    expect(tracoDoEstilo('realista', paleta)).toBeNull();
    const op = tracoDoEstilo('opaco', paleta)!;
    const co = tracoDoEstilo('cores', paleta)!;
    expect(op.opacidade).toBeGreaterThan(co.opacidade);
    // O traço do Opaco só some bem mais de longe: é ele que desenha a peça branca.
    expect(op.some).toBeLessThan(co.some);
  });

  it('legenda: só as classes presentes, na ordem do bloco comum para o especial', () => {
    expect(itensDaLegenda(new Set<ClassePeca>(['bloco54', 'inteiro', 'canaleta']))).toEqual(['inteiro', 'canaleta', 'bloco54']);
    expect(itensDaLegenda(new Set())).toEqual([]);
  });
});

describe('estilo: a cena troca de cara sem se remontar', () => {
  const m = muroComClasses();
  const c = construirCena3D(m, paleta, 'cores');
  const lote = (geo: string) => c.lotes.find((l) => l.lote.geometria === geo && l.lote.acabamento === 'alvenaria')!;
  const corDaInstancia = (geo: string, i = 0) => {
    const k = new THREE.Color();
    lote(geo).malha.getColorAt(i, k);
    return hex(k);
  };

  it('Cores: cada classe na cor dela; luz chapada (Lambert)', () => {
    expect(corDaInstancia('bloco 14x19x39')).toBe(COR_DA_CLASSE.inteiro);
    expect(corDaInstancia('meio bloco 14x19x19')).toBe(COR_DA_CLASSE.meio);
    expect(corDaInstancia('canaleta 14x19x39')).toBe(COR_DA_CLASSE.canaleta);
    expect(corDaInstancia('meia canaleta 14x19x19')).toBe(COR_DA_CLASSE.canaleta);
    expect(lote('bloco 14x19x39').malha.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect([...c.classesVisiveis(new Set())].sort()).toEqual(['canaleta', 'inteiro', 'meio']);
    // Oculto o grupo Blocos, a legenda esvazia.
    expect(c.classesVisiveis(new Set<Categoria>(['blocos'])).size).toBe(0);
  });

  it('Opaco: massa branca SEM luz, traço aceso; o graute se distingue do bloco no corte', () => {
    c.aplicarEstilo('opaco');
    expect(lote('bloco 14x19x39').malha.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(corDaInstancia('bloco 14x19x39')).toBe('#ffffff');
    expect(corDaInstancia('meio bloco 14x19x19')).toBe('#ffffff');
    const graute = c.lotes.find((l) => l.lote.acabamento === 'graute')!;
    const k = new THREE.Color();
    graute.malha.getColorAt(0, k);
    expect(hex(k)).not.toBe('#ffffff');
    expect(lote('bloco 14x19x39').traco!.visible).toBe(true);
  });

  it('Realista: material com rugosidade, sem traço, com sombra — e o terreno não faz sombra', () => {
    c.aplicarEstilo('realista');
    const b = lote('bloco 14x19x39');
    expect(b.malha.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(b.traco!.visible).toBe(false);
    expect(b.malha.castShadow).toBe(true);
    expect(b.malha.receiveShadow).toBe(true);
    const terreno = c.lotes.find((l) => l.lote.acabamento === 'terreno')!;
    expect(terreno.malha.castShadow).toBe(false);
    expect((terreno.malha.material as THREE.Material).transparent).toBe(true);
    for (const x of c.barras) expect(x.malha.castShadow).toBe(true);
  });

  it('Armadura no Realista: o bloco continua sólido e com sombra; a barra, chapada e por cima, sem sombra', () => {
    c.aplicarArmadura(true);
    const b = lote('bloco 14x19x39');
    expect((b.malha.material as THREE.Material).transparent).toBe(false);
    expect(b.malha.castShadow).toBe(true);
    for (const x of c.barras) expect(x.malha.castShadow).toBe(false);
    // Trocar de estilo com a Armadura ligada: a barra continua por cima (o material dela não é o do estilo).
    c.aplicarEstilo('opaco');
    for (const x of c.barras) expect(x.malha.renderOrder).toBeGreaterThan(2);
    c.aplicarArmadura(false);
    for (const x of c.barras) expect(x.malha.renderOrder).toBe(0);
    expect(c.pegar(raioDe(0.1, 0.5))).toBe('T1.M.f02.p000');
  });

  it('o véu do terreno é de cada estilo: ligar a Armadura em um não muda o terreno do outro', () => {
    c.aplicarEstilo('realista');
    c.aplicarEstilo('cores');
    c.aplicarArmadura(true);
    c.aplicarArmadura(false);
    c.aplicarEstilo('realista');
    const terreno = c.lotes.find((l) => l.lote.acabamento === 'terreno')!;
    expect((terreno.malha.material as THREE.Material).opacity).toBe(opacidadeDoTerreno('realista'));
    c.aplicarEstilo('cores');
    expect((terreno.malha.material as THREE.Material).opacity).toBe(opacidadeDoTerreno('cores'));
  });

  it('a seleção sobrevive à troca de estilo, e volta à cor do estilo novo ao soltar', () => {
    c.aplicarEstilo('cores');
    c.pintarSelecao('T1.M.f02.p001');
    c.aplicarEstilo('opaco');
    const i = lote('bloco 14x19x39').lote.ids.indexOf('T1.M.f02.p001');
    expect(corDaInstancia('bloco 14x19x39', i)).toBe(`#${new THREE.Color(paleta.selecionado).getHexString()}`);
    c.pintarSelecao(null);
    expect(corDaInstancia('bloco 14x19x39', i)).toBe('#ffffff');
    c.aplicarEstilo('cores');
  });

  it('o corte vale no material de um estilo que nasce depois de o corte ser ligado', () => {
    const c2 = construirCena3D(m, paleta, 'cores');
    const plano = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.3);
    c2.aplicarCorte([plano]);
    c2.aplicarEstilo('realista');
    for (const l of c2.lotes) expect((l.malha.material as THREE.Material).clippingPlanes).toEqual([plano]);
    for (const b of c2.barras) expect((b.malha.material as THREE.Material).clippingPlanes).toEqual([plano]);
    expect(c2.pegar(raioDe(0.6, 0.5))).not.toBe('T1.M.f02.p001');
    c2.dispose();
  });

  it('o traço é INSTANCIADO: a mesma matriz do sólido, uma cópia das arestas da forma (não uma por peça)', () => {
    const b = lote('bloco 14x19x39');
    const g = b.traco!.geometry as THREE.InstancedBufferGeometry;
    expect(g).toBeInstanceOf(THREE.InstancedBufferGeometry);
    expect(g.instanceCount).toBe(b.malha.count);
    expect(g.getAttribute('instanceMatrix')).toBe(b.malha.instanceMatrix);
    // Duas formas iguais em lotes diferentes (muro × contraforte) dividiriam as arestas; aqui basta: a posição é
    // a de UMA peça.
    const pontos = g.getAttribute('position').count;
    expect(pontos).toBeLessThan(200);
    expect((b.traco!.material as THREE.LineBasicMaterial).defines).toHaveProperty('USE_INSTANCING');
  });
});

describe('pele do Realista', () => {
  it('determinística e em torno de 0,5 (é um modulador da cor do material, não a cor)', () => {
    for (const p of ['bloco', 'concreto', 'solo'] as const) {
      const a = campoDaPele(p, 64);
      const b = campoDaPele(p, 64);
      expect(a).toEqual(b);
      const media = a.reduce((s, v) => s + v, 0) / a.length;
      expect(media).toBeGreaterThan(0.4);
      expect(media).toBeLessThan(0.6);
    }
  });
});

describe('sombra do sol: enquadramento', () => {
  const cantos = (k: { readonly min: readonly number[]; readonly max: readonly number[] }) =>
    Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? k.max[0] : k.min[0], i & 2 ? k.max[1] : k.min[1], i & 4 ? k.max[2] : k.min[2]));

  it.each([
    ['muro de 6 m', { min: [0, -0.5, -0.6], max: [6, 1.6, 3.4] }],
    ['muro de 120 m', { min: [0, -0.8, -0.6], max: [120, 3, 4.2] }],
  ] as const)('%s: a câmera da sombra (como o three a monta) vê a caixa inteira', (_n, caixa) => {
    const e = enquadrarSombra({ min: [...caixa.min], max: [...caixa.max] } as never);
    const cam = new THREE.OrthographicCamera(e.esquerda, e.direita, e.cima, e.baixo, e.perto, e.longe);
    cam.up.set(...e.vertical);
    cam.position.set(...e.posicao);
    cam.lookAt(new THREE.Vector3(...e.alvo));
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    for (const p of cantos(caixa)) {
      const q = p.clone().project(cam);
      expect(Math.abs(q.x)).toBeLessThan(1);
      expect(Math.abs(q.y)).toBeLessThan(1);
      expect(Math.abs(q.z)).toBeLessThan(1);
    }
    expect(e.mapa[0] * e.mapa[1]).toBeLessThanOrEqual(ORCAMENTO_DA_SOMBRA * 1.01);
  });

  it('muro comprido: o mapa toma a forma da faixa (largo e baixo), e não quadrado', () => {
    const e = enquadrarSombra({ min: [0, -0.8, -0.6], max: [120, 3, 4.2] });
    expect(e.mapa[0]).toBeGreaterThan(4 * e.mapa[1]);
    const curto = enquadrarSombra({ min: [0, -0.5, -0.6], max: [6, 1.6, 3.4] });
    expect(curto.mapa[0] / curto.mapa[1]).toBeLessThan(3);
  });
});
