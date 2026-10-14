// ═══════════════════════════════════════════════════════════════════════════
//  visor/palco3d.ts — fundo, luz e exposição de cada estilo, fora do React
// ---------------------------------------------------------------------------
//  O palco tem dois donos: o Visor3D (na tela, por `ambiente.tsx`) e a FOTO
//  REFEITA da prancha (`fotoRefeita.ts`, num renderizador fora da tela). Os
//  dois montam o palco por AQUI — a luz, o fundo e a exposição saem do mesmo
//  lugar, e a foto refeita não tem como discordar da tela (era o risco de
//  copiar os números da luz para um segundo arquivo: mudar um e esquecer o
//  outro, e a prancha sair com outra luz que a tela).
//
//  Os valores e o porquê de cada um continuam explicados em `ambiente.tsx`
//  (luz recalibrada sem exposição; Realista com ACES e sombra).
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import { paletaDoPalco, type EstiloVisual } from './estiloVisual';
import type { Caixa } from './perfil3d';
import { DIRECAO_DO_SOL, enquadrarSombra, type EnquadramentoDaSombra } from './sombraDoSol';
import { themeColor, type PaletaVisor } from './tema3d';

/** A paleta do palco no tema de agora: a do tema, ou papel no Opaco (ver `paletaDoPalco`). */
export function palcoDoTema(p: PaletaVisor, estilo: EstiloVisual): PaletaVisor {
  return paletaDoPalco(p, estilo, themeColor('--papel', '#ffffff'), themeColor('--papel-tinta', '#262626'));
}

/** O fundo do palco: o degradê com manchas do A-PORT, ou papel liso (Opaco). Precisa de documento (canvas 2D). */
export function pintarFundo(p: PaletaVisor, liso: boolean): THREE.CanvasTexture {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  if (liso) {
    // Papel: nem degradê nem mancha — a imagem vai para a prancha e o recorte dela tem de ser limpo.
    g.fillStyle = p.fundo;
    g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const lin = g.createLinearGradient(0, 0, 0, S);
  lin.addColorStop(0, p.fundo);
  lin.addColorStop(0.45, p.superficie);
  lin.addColorStop(1, p.fundo);
  g.fillStyle = lin;
  g.fillRect(0, 0, S, S);
  const mancha = (cx: number, cy: number, r: number, cor: string, alpha: number) => {
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, cor);
    rg.addColorStop(1, 'transparent');
    g.globalAlpha = alpha;
    g.fillStyle = rg;
    g.fillRect(0, 0, S, S);
    g.globalAlpha = 1;
  };
  mancha(S * 0.22, S * 0.24, S * 0.62, p.enfase, 0.05);
  mancha(S * 0.82, S * 0.78, S * 0.58, p.tinta, 0.04);
  const vg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.78);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, p.escuro ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)');
  g.fillStyle = vg;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A curva de exposição do estilo: só o Realista tem (é foto, não desenho — ver `ambiente.tsx`). */
export function exposicaoDoEstilo(estilo: EstiloVisual): THREE.ToneMapping {
  return estilo === 'realista' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
}

/** Direções DE ONDE vem a luz (a luz direcional mira a origem). */
const SOL = DIRECAO_DO_SOL;
const CONTRA: Vec3 = [-0.6, 0.6, 0.53];
const PREENCHE: Vec3 = [-0.45, -0.75, 0.3];

export interface LuzesDoPalco {
  /** Pendurar na cena. */
  grupo: THREE.Group;
  /** O sol que faz sombra (só no Realista). */
  sol: THREE.DirectionalLight | null;
  /** Até onde a sombra do sol enxerga (só no Realista). */
  sombra: EnquadramentoDaSombra | null;
  /** Solta o mapa de sombra do sol. */
  dispose(): void;
}

/** A luz chapada do Cores (e do Opaco, que nem a lê: a massa dele não recebe luz). */
function luzesChapadas(grupo: THREE.Group): void {
  const sol = new THREE.DirectionalLight(0xffffff, 1.25);
  sol.position.set(SOL[0] * 50, SOL[1] * 50, SOL[2] * 50);
  const contra = new THREE.DirectionalLight(0xffffff, 0.6);
  contra.position.set(CONTRA[0] * 50, CONTRA[1] * 50, CONTRA[2] * 50);
  grupo.add(new THREE.AmbientLight(0xffffff, 1.95), sol, contra);
}

/**
 * O Realista: céu em hemisfério, sol quente com sombra, contraluz frio e um
 * preenchimento fraco do lado da sombra (as quatro do A-PORT, com Z para cima).
 * A câmera da sombra cobre a `caixa` (metro) e só ela (ver `sombraDoSol.ts`).
 */
function luzesRealistas(grupo: THREE.Group, caixa: Caixa, maxTextura: number): { sol: THREE.DirectionalLight; sombra: EnquadramentoDaSombra } {
  const enq = enquadrarSombra(caixa, SOL, maxTextura);
  const ceu = new THREE.HemisphereLight(0xc4d4e6, 0x4a3d30, 1.15);
  ceu.position.set(0, 0, 1);
  // O alvo do sol fica NA cena: é a matriz dele no mundo que dá a direção da luz e o centro da sombra.
  const alvo = new THREE.Object3D();
  alvo.position.set(...enq.alvo);
  const sol = new THREE.DirectionalLight(0xfff4e6, 2.7);
  sol.position.set(...enq.posicao);
  sol.target = alvo;
  sol.castShadow = true;
  sol.shadow.bias = -0.0003;
  sol.shadow.normalBias = 0.012;
  const c = sol.shadow.camera;
  c.up.set(...enq.vertical);
  c.left = enq.esquerda;
  c.right = enq.direita;
  c.bottom = enq.baixo;
  c.top = enq.cima;
  c.near = enq.perto;
  c.far = enq.longe;
  c.updateProjectionMatrix();
  sol.shadow.mapSize.set(enq.mapa[0], enq.mapa[1]);
  const [cx, cy, cz] = enq.alvo;
  const r = Math.max(5, (enq.longe - enq.perto) / 2);
  const contra = new THREE.DirectionalLight(0xcfd8ff, 0.9);
  contra.position.set(cx + CONTRA[0] * r, cy + CONTRA[1] * r, cz + CONTRA[2] * r);
  const preenche = new THREE.DirectionalLight(0xe8e4dc, 0.55);
  preenche.position.set(cx + PREENCHE[0] * r, cy + PREENCHE[1] * r, cz + PREENCHE[2] * r);
  grupo.add(ceu, alvo, sol, contra, preenche);
  return { sol, sombra: enq };
}

/**
 * As luzes de um estilo. `caixa` (metro, o muro com o terreno) e `maxTextura`
 * (o lado máximo de textura da placa) só servem à sombra do Realista.
 */
export function montarLuzes(estilo: EstiloVisual, caixa: Caixa, maxTextura: number): LuzesDoPalco {
  const grupo = new THREE.Group();
  grupo.name = `luzes ${estilo === 'realista' ? 'realistas' : 'chapadas'}`;
  if (estilo !== 'realista') {
    luzesChapadas(grupo);
    return { grupo, sol: null, sombra: null, dispose: () => {} };
  }
  const { sol, sombra } = luzesRealistas(grupo, caixa, maxTextura);
  return { grupo, sol, sombra, dispose: () => sol.dispose() };
}
