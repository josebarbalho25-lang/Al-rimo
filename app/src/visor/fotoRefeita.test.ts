/*
  A FOTO REFEITA DA PRANCHA, SEM WEBGL — o que dá para provar no Node é a MONTAGEM: o palco da foto é o muro do
  visor (os mesmos construtores), com o estado guardado aplicado como o Visor3D aplica, a luz de cada estilo igual
  à que o visor tinha antes de ela sair do JSX, a câmera certa e o descarte de tudo. Desenhar de verdade pede a
  placa de vídeo: isso se confere na bancada (app/bancada/foto.html), lado a lado com a foto da tela.
*/
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Camera3d } from '@/pranchas/tipos';
import { construirCena3D, type Cena3D } from './cena3d';
import { FOLGA_DO_CORTE, planoDoCorte } from './Corte';
import { muroDeExemplo } from './exemploDeModelo';
import { montarPalcoDaFoto, tamanhoQueCabe, TETO_DE_PONTOS } from './fotoRefeita';
import type { Categoria } from './lotes';
import { pelesProprias, texturaDaPele } from './materiaisDoEstilo';
import { montarLuzes } from './palco3d';
import { DIRECAO_DO_SOL, enquadrarSombra } from './sombraDoSol';
import { lerPaleta } from './tema3d';

const paleta = lerPaleta(); // no Node, as reservas
const m = muroDeExemplo({ blocosPorFiada: 6, fiadas: 8, contraforte: true, terreno: true });
const opcoes = { paleta, maxTextura: 4096, fundo: false };

const base: Camera3d = {
  posicao: [20, -20, 17],
  alvo: [1.2, 0.3, 0.8],
  cima: [0, 0, 1],
  ortografica: true,
  zoom: 1 / 6, // 6 m de altura visível
  fov: 20,
  estilo: 'cores',
  armadura: false,
  corteX: null,
  ocultas: [],
};

/** O retrato do que se desenha: lote a lote e barra a barra, aceso ou não, com que material e em que ordem. */
function retrato(c: Cena3D) {
  return {
    lotes: c.lotes.map((l) => ({
      chave: l.lote.chave,
      n: l.malha.count,
      aceso: l.malha.visible,
      traco: l.traco ? { aceso: l.traco.visible, opacidade: (l.traco.material as THREE.LineBasicMaterial).opacity } : null,
      material: (l.malha.material as THREE.Material).type,
      sombra: [l.malha.castShadow, l.malha.receiveShadow],
      corte: ((l.malha.material as THREE.Material).clippingPlanes ?? []).map((p) => [p.normal.toArray(), p.constant]),
    })),
    barras: c.barras.map((b) => ({
      chave: b.lote.chave,
      vertices: b.lote.geometria.getAttribute('position').count,
      aceso: b.malha.visible,
      ordem: b.malha.renderOrder,
      material: (b.malha.material as THREE.Material).type,
    })),
    chamadas: c.chamadasDeDesenho(),
  };
}

describe('o palco da foto refeita (sem WebGL)', () => {
  it('o muro é o do visor: os mesmos lotes, instâncias, traços e barras, e o traço desbota como na tela', () => {
    const p = montarPalcoDaFoto(m, base, 800, 600, opcoes);
    const visor = construirCena3D(m, paleta, 'cores');
    // 600 px × (1/6 alt. por metro) ÷ 2 (a foto sai com o dobro dos pixels da tela) = 50 px de tela por metro
    visor.aplicarZoom(50);
    expect(retrato(p.cena)).toEqual(retrato(visor));
    expect(p.scene.children).toContain(p.cena.grupo);
    // nem anotação (terno, contorno do corte) nem seleção: só o muro e a luz
    expect(p.scene.children).toHaveLength(2);
    p.dispose();
    visor.dispose();
  });

  it('o estado guardado é aplicado como o Visor3D aplica: ocultas, Armadura e corte', () => {
    const c: Camera3d = { ...base, estilo: 'opaco', armadura: true, corteX: 600, ocultas: ['terreno', 'drenagem'] };
    const p = montarPalcoDaFoto(m, c, 800, 600, opcoes);
    // A mesma sequência dos layoutEffects do Visor3D
    const v = construirCena3D(m, paleta, 'opaco');
    v.aplicarVisibilidade(new Set<Categoria>(['terreno', 'drenagem']));
    v.aplicarArmadura(true);
    v.aplicarCorte([planoDoCorte(0.6)]);
    v.aplicarZoom(50);
    const a = retrato(p.cena);
    expect(a).toEqual(retrato(v));
    expect(a.lotes.some((l) => !l.aceso)).toBe(true);
    expect(a.barras.every((b) => b.ordem === 10)).toBe(true);
    expect(a.lotes[0]!.corte).toEqual([[[-1, 0, 0], 0.6 + FOLGA_DO_CORTE]]);
    p.dispose();
    v.dispose();
  });

  it('o corte além da ponta do muro (o muro encurtou) encosta na ponta, como na tela', () => {
    const p = montarPalcoDaFoto(m, { ...base, corteX: 99_000 }, 800, 600, opcoes);
    const v = construirCena3D(m, paleta, 'cores');
    const ponta = v.caixaVisivel().max[0];
    const plano = (p.cena.lotes[0]!.malha.material as THREE.Material).clippingPlanes![0]!;
    expect(plano.constant).toBeCloseTo(ponta + FOLGA_DO_CORTE, 12);
    p.dispose();
    v.dispose();
  });

  it('a câmera da foto: a proporção da foto, a altura visível guardada e o muro inteiro na profundidade', () => {
    const p = montarPalcoDaFoto(m, base, 1000, 500, opcoes);
    const cam = p.camera as THREE.OrthographicCamera;
    expect(cam).toBeInstanceOf(THREE.OrthographicCamera);
    expect((cam.right - cam.left) / (cam.top - cam.bottom)).toBeCloseTo(2, 12);
    expect((cam.top - cam.bottom) / cam.zoom).toBeCloseTo(6, 12);
    const caixa = p.cena.caixaTotal();
    for (let k = 0; k < 8; k++) {
      const q = new THREE.Vector3(k & 1 ? caixa.max[0] : caixa.min[0], k & 2 ? caixa.max[1] : caixa.min[1], k & 4 ? caixa.max[2] : caixa.min[2]).applyMatrix4(cam.matrixWorldInverse);
      expect(-q.z).toBeGreaterThanOrEqual(cam.near);
      expect(-q.z).toBeLessThanOrEqual(cam.far);
    }
    p.dispose();
  });

  it('exposição e luz do estilo: chapada no Cores e no Opaco; céu, sol com sombra, contraluz e preenchimento no Realista', () => {
    const cores = montarPalcoDaFoto(m, base, 800, 600, opcoes);
    expect(cores.exposicao).toBe(THREE.NoToneMapping);
    expect(cores.luzes.sol).toBeNull();
    const realista = montarPalcoDaFoto(m, { ...base, estilo: 'realista' }, 800, 600, opcoes);
    expect(realista.exposicao).toBe(THREE.ACESFilmicToneMapping);
    expect(realista.luzes.sol!.castShadow).toBe(true);
    // a sombra cobre o muro inteiro, terreno junto (a mesma caixa que o visor dá à sombra)
    expect(realista.luzes.sombra).toEqual(enquadrarSombra(realista.cena.caixaTotal(), DIRECAO_DO_SOL, 4096));
    // e só no Realista as peças fazem e recebem sombra
    expect(retrato(realista.cena).lotes.some((l) => l.sombra[0])).toBe(true);
    expect(retrato(cores.cena).lotes.every((l) => !l.sombra[0] && !l.sombra[1])).toBe(true);
    cores.dispose();
    realista.dispose();
  });

  it('libera tudo: cada geometria, material e textura que o palco criou avisa o descarte', () => {
    const peles = pelesProprias();
    const p = montarPalcoDaFoto(m, { ...base, estilo: 'realista', armadura: true, corteX: 500 }, 800, 600, { ...opcoes, peles: peles.fonte });
    const coisas = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    p.scene.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      const mat = (o as THREE.Mesh).material;
      if (g) coisas.add(g);
      for (const x of mat ? (Array.isArray(mat) ? mat : [mat]) : []) coisas.add(x);
    });
    expect(coisas.size).toBeGreaterThan(10);
    const avisados = new Set<unknown>();
    for (const c of coisas) c.addEventListener('dispose', () => avisados.add(c));
    // as texturas próprias da pele também se vão; as do visor ficam
    const doVisor = texturaDaPele('bloco');
    let visorDescartado = false;
    doVisor.addEventListener('dispose', () => (visorDescartado = true));
    const propria = peles.fonte('bloco');
    let propriaDescartada = false;
    propria.addEventListener('dispose', () => (propriaDescartada = true));
    p.dispose();
    peles.dispose();
    expect([...coisas].filter((c) => !avisados.has(c))).toEqual([]);
    expect(propriaDescartada).toBe(true);
    expect(visorDescartado).toBe(false);
  });

  it('Realista com peles próprias: o material da foto lê a textura dela, feita dos mesmos bytes da do visor', () => {
    const peles = pelesProprias();
    const p = montarPalcoDaFoto(m, { ...base, estilo: 'realista' }, 800, 600, { ...opcoes, peles: peles.fonte });
    const bloco = p.cena.lotes.find((l) => l.lote.acabamento === 'alvenaria')!.malha.material as THREE.MeshStandardMaterial;
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <map_fragment>\n#include <roughnessmap_fragment>' };
    bloco.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    const usada = shader.uniforms.mapaDaPele!.value as THREE.DataTexture;
    expect(usada).toBe(peles.fonte('bloco'));
    expect(usada).not.toBe(texturaDaPele('bloco'));
    expect(usada.image.data).toBe(texturaDaPele('bloco').image.data);
    p.dispose();
    peles.dispose();
  });
});

describe('a luz saiu do JSX sem mudar (palco3d.ts, a mesma para a tela e para a foto)', () => {
  const caixa = { min: [0, -0.5, -0.3] as [number, number, number], max: [6, 1.6, 1.8] as [number, number, number] };

  it('Cores e Opaco: ambiente 1,95; sol 1,25 e contraluz 0,6 de longe (os números da <LuzesChapadas> de antes)', () => {
    for (const e of ['cores', 'opaco'] as const) {
      const l = montarLuzes(e, caixa, 4096);
      const [amb, sol, contra, ...resto] = l.grupo.children as THREE.Light[];
      expect(resto).toHaveLength(0);
      expect(amb).toBeInstanceOf(THREE.AmbientLight);
      expect(amb!.intensity).toBe(1.95);
      expect(amb!.color.getHex()).toBe(0xffffff);
      expect(sol).toBeInstanceOf(THREE.DirectionalLight);
      expect(sol!.intensity).toBe(1.25);
      expect(sol!.position.toArray()).toEqual(DIRECAO_DO_SOL.map((v) => v * 50));
      expect(contra!.intensity).toBe(0.6);
      expect(contra!.position.toArray()).toEqual([-0.6 * 50, 0.6 * 50, 0.53 * 50]);
      expect(l.sol).toBeNull();
    }
  });

  it('Realista: céu 1,15, sol 2,7 com sombra (viés −0,0003 e 0,012), contraluz 0,9, preenchimento 0,55 (os da <LuzesRealistas>)', () => {
    const l = montarLuzes('realista', caixa, 4096);
    const enq = enquadrarSombra(caixa, DIRECAO_DO_SOL, 4096);
    const ceu = l.grupo.children.find((o) => o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
    expect(ceu.intensity).toBe(1.15);
    expect(ceu.color.getHex()).toBe(0xc4d4e6);
    expect(ceu.groundColor.getHex()).toBe(0x4a3d30);
    expect(ceu.position.toArray()).toEqual([0, 0, 1]);
    const dirs = l.grupo.children.filter((o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight);
    expect(dirs.map((d) => [d.color.getHex(), d.intensity, d.castShadow])).toEqual([
      [0xfff4e6, 2.7, true],
      [0xcfd8ff, 0.9, false],
      [0xe8e4dc, 0.55, false],
    ]);
    const sol = l.sol!;
    expect(sol).toBe(dirs[0]);
    expect(sol.position.toArray()).toEqual(enq.posicao);
    // o alvo do sol está na cena (é a matriz dele no mundo que dá a direção) e no centro do muro
    expect(l.grupo.children).toContain(sol.target);
    expect(sol.target.position.toArray()).toEqual(enq.alvo);
    expect([sol.shadow.bias, sol.shadow.normalBias]).toEqual([-0.0003, 0.012]);
    expect(sol.shadow.mapSize.toArray()).toEqual(enq.mapa);
    const c = sol.shadow.camera;
    expect([c.left, c.right, c.bottom, c.top, c.near, c.far]).toEqual([enq.esquerda, enq.direita, enq.baixo, enq.cima, enq.perto, enq.longe]);
    expect(c.up.toArray()).toEqual(enq.vertical);
    const [cx, cy, cz] = enq.alvo;
    const r = Math.max(5, (enq.longe - enq.perto) / 2);
    expect(dirs[1]!.position.toArray()).toEqual([cx + -0.6 * r, cy + 0.6 * r, cz + 0.53 * r]);
    expect(dirs[2]!.position.toArray()).toEqual([cx + -0.45 * r, cy + -0.75 * r, cz + 0.3 * r]);
    l.dispose();
  });
});

describe('o tamanho da foto que a placa aguenta', () => {
  it('cabe: sai do tamanho pedido', () => {
    expect(tamanhoQueCabe(1600, 1200, 16384)).toEqual([1600, 1200]);
  });
  it('lado maior que a placa: encolhe na mesma proporção', () => {
    expect(tamanhoQueCabe(20000, 10000, 16384, Infinity)).toEqual([16384, 8192]);
  });
  it('pontos demais: encolhe até o teto, na mesma proporção', () => {
    const [w, h] = tamanhoQueCabe(12000, 9000, 16384);
    expect(w * h).toBeLessThanOrEqual(TETO_DE_PONTOS * 1.001);
    expect(w / h).toBeCloseTo(12000 / 9000, 3);
  });
});

describe('refazerFoto', () => {
  // O Node não tem WebGL (nem canvas): a foto de verdade se confere na bancada, lado a lado com a da tela —
  // `npm run dev` e abrir /bancada/foto.html (Enviar para a prancha no visor da esquerda; à direita, a refeita).
  it.skip('desenha a foto refeita — precisa de WebGL; conferir em app/bancada/foto.html', () => {});
});
