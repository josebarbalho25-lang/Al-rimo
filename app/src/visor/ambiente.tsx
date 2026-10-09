// ═══════════════════════════════════════════════════════════════════════════
//  visor/ambiente.tsx — fundo, luz (por estilo), sombra do Realista e o terno de eixos
// ---------------------------------------------------------------------------
//  Fundo: o degradê com manchas do A-PORT (`visor/Fundo.tsx`, só o do tema);
//  no Opaco, papel liso (ver `estiloVisual.ts`).
//  Terno: o da prévia de carga do A-PORT, com a letra de cada eixo — a letra
//  aqui é SPRITE (desenhada no WebGL), não o Html do drei: com três Html
//  nascendo juntos, o primeiro ficava vazio (a letra X sumia; visto na
//  bancada). E sprite não pede DOM nem reposicionamento a cada quadro.
//
//  ⚠️ LUZ RECALIBRADA, não copiada. O visor roda SEM exposição (`flat` no
//  Canvas): o aço tem de sair na cor do estilo e o bloco na cor do Revit, e a
//  curva ACES que o r3f liga sozinha desbota e puxa o tom. Sem ela, com a luz
//  nas unidades do three (a face recebe luz/π), os números abaixo dão, na cor
//  do material: topo 1,00 · frente 0,86 · direita 0,76 · esquerda e fundo
//  0,74 · base 0,62 — três tons distintos na isométrica, que é o que separa as
//  faces de um muro de cor só. (DEDUÇÃO minha; conferir o tom com ele na tela.)
//
//  ⚠️ O REALISTA É O ÚNICO COM EXPOSIÇÃO (ACES) — é foto, não desenho: o sol
//  forte e o céu precisam da curva para o claro não estourar em branco. E é o
//  único com sombra projetada.
// ═══════════════════════════════════════════════════════════════════════════

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import { ANOTACAO } from './captura';
import type { EstiloVisual } from './estiloVisual';
import type { Caixa } from './perfil3d';
import { DIRECAO_DO_SOL, enquadrarSombra } from './sombraDoSol';
import type { PaletaVisor } from './tema3d';

function pintarFundo(p: PaletaVisor, liso: boolean): THREE.CanvasTexture {
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

export function Fundo({ paleta, liso = false }: { paleta: PaletaVisor; liso?: boolean }) {
  const cena = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = pintarFundo(paleta, liso);
    cena.background = t;
    invalidate();
    return () => {
      cena.background = null;
      t.dispose();
    };
  }, [cena, paleta, liso, invalidate]);
  return null;
}

/** Direções DE ONDE vem a luz (a luz direcional mira a origem). */
const SOL = DIRECAO_DO_SOL;
const CONTRA: Vec3 = [-0.6, 0.6, 0.53];
const PREENCHE: Vec3 = [-0.45, -0.75, 0.3];

/** A luz chapada do Cores (e do Opaco, que nem a lê: a massa dele não recebe luz). */
function LuzesChapadas() {
  return (
    <>
      <ambientLight intensity={1.95} />
      <directionalLight position={[SOL[0] * 50, SOL[1] * 50, SOL[2] * 50]} intensity={1.25} />
      <directionalLight position={[CONTRA[0] * 50, CONTRA[1] * 50, CONTRA[2] * 50]} intensity={0.6} />
    </>
  );
}

/*
  O REALISTA: céu em hemisfério (claro de cima, terra de baixo), sol quente com
  sombra, contraluz frio e um preenchimento fraco do lado da sombra — as quatro
  do A-PORT (`LuzesDoPalco.tsx`, o protótipo do Jose), com Z para cima.

  ⚠️ A SOMBRA NÃO SE REFAZ A CADA QUADRO. O sol é preso ao mundo, não à câmera:
  girar e dar zoom não mudam sombra nenhuma. Ela é desenhada uma vez e só se
  refaz quando o muro muda de verdade (modelo, ocultar, Raio-X, corte — quem
  avisa é o Visor3D, pela `versao`). Girar o muro de 7.000 blocos no Realista
  custa o mesmo que sem sombra.
*/
function LuzesRealistas({ caixa, versao }: { caixa: Caixa; versao: object }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const sol = useRef<THREE.DirectionalLight>(null);
  const alvo = useMemo(() => new THREE.Object3D(), []);
  const enq = useMemo(() => enquadrarSombra(caixa, SOL, gl.capabilities.maxTextureSize), [caixa, gl]);

  useLayoutEffect(() => {
    const l = sol.current;
    if (!l) return;
    l.target = alvo;
    const c = l.shadow.camera;
    c.up.set(...enq.vertical);
    c.left = enq.esquerda;
    c.right = enq.direita;
    c.bottom = enq.baixo;
    c.top = enq.cima;
    c.near = enq.perto;
    c.far = enq.longe;
    c.updateProjectionMatrix();
    // Mapa de outro tamanho: o three cria o mapa uma vez só — o velho tem de sair para nascer o novo.
    if (l.shadow.mapSize.x !== enq.mapa[0] || l.shadow.mapSize.y !== enq.mapa[1]) {
      l.shadow.mapSize.set(enq.mapa[0], enq.mapa[1]);
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
  }, [enq, alvo]);

  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, enq, versao, invalidate]);
  // Ao sair do Realista e voltar, a sombra tem de ser desenhada de novo.
  useEffect(
    () => () => {
      gl.shadowMap.needsUpdate = true;
    },
    [gl],
  );

  const [cx, cy, cz] = enq.alvo;
  const r = Math.max(5, (enq.longe - enq.perto) / 2);
  return (
    <>
      <hemisphereLight args={[0xc4d4e6, 0x4a3d30, 1.15]} position={[0, 0, 1]} />
      <primitive object={alvo} position={enq.alvo} />
      <directionalLight
        ref={sol}
        position={enq.posicao}
        color={0xfff4e6}
        intensity={2.7}
        castShadow
        shadow-bias={-0.0003}
        shadow-normalBias={0.012}
      />
      <directionalLight color={0xcfd8ff} intensity={0.9} position={[cx + CONTRA[0] * r, cy + CONTRA[1] * r, cz + CONTRA[2] * r]} />
      <directionalLight color={0xe8e4dc} intensity={0.55} position={[cx + PREENCHE[0] * r, cy + PREENCHE[1] * r, cz + PREENCHE[2] * r]} />
    </>
  );
}

/** A exposição do Realista entra e sai com ele (ver o cabeçalho). */
function Exposicao({ realista }: { realista: boolean }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    gl.toneMapping = realista ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = 1;
    invalidate();
  }, [gl, realista, invalidate]);
  return null;
}

/** A luz de cada estilo. `caixa` e `versao` só servem à sombra do Realista. */
export function Luzes({ estilo, caixa, versao }: { estilo: EstiloVisual; caixa: Caixa; versao: object }) {
  return (
    <>
      <Exposicao realista={estilo === 'realista'} />
      {estilo === 'realista' ? <LuzesRealistas caixa={caixa} versao={versao} /> : <LuzesChapadas />}
    </>
  );
}

/** Altura da letra do eixo, em pixels de tela. */
const LETRA_PX = 13;

function texturaDaLetra(letra: string, cor: string, halo: string): THREE.CanvasTexture {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  g.font = '600 46px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = halo;
  g.strokeText(letra, S / 2, S / 2 + 2);
  g.fillStyle = cor;
  g.fillText(letra, S / 2, S / 2 + 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** O terno X/Y/Z na origem do muro (ponta esquerda, face aparente, topo da sapata). */
export function Terno({ haste, paleta }: { haste: number; paleta: PaletaVisor }) {
  const cores = useMemo(() => [paleta.eixoX, paleta.eixoY, paleta.eixoZ], [paleta]);
  const geometria = useMemo(() => {
    const pos: number[] = [];
    const cor: number[] = [];
    const eixos: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    eixos.forEach((e, k) => {
      const c = new THREE.Color(cores[k]!);
      const d = new THREE.Vector3(...e);
      const fim = d.clone().multiplyScalar(haste);
      // A ponta abre no plano do eixo seguinte: as três se leem de qualquer lado.
      const abre = new THREE.Vector3(...eixos[(k + 1) % 3]!);
      const base = fim.clone().addScaledVector(d, -haste * 0.22);
      const tracos = [new THREE.Vector3(), fim, fim, base.clone().addScaledVector(abre, haste * 0.09), fim, base.clone().addScaledVector(abre, -haste * 0.09)];
      for (const p of tracos) {
        pos.push(p.x, p.y, p.z);
        cor.push(c.r, c.g, c.b);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    return g;
  }, [haste, cores]);
  useEffect(() => () => geometria.dispose(), [geometria]);

  const letras = useMemo(
    () => cores.map((c, k) => new THREE.SpriteMaterial({ map: texturaDaLetra('XYZ'[k]!, c, paleta.fundo), depthTest: false, toneMapped: false })),
    [cores, paleta.fundo],
  );
  useEffect(
    () => () => {
      for (const m of letras) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [letras],
  );
  // Na ortográfica o sprite mede em METRO: para a letra ter tamanho de tela fixo, escala = pixels ÷ zoom.
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ camera }) => {
    const z = (camera as THREE.OrthographicCamera).zoom || 1;
    for (const s of sprites.current) s?.scale.setScalar((LETRA_PX * 1.4) / z);
  });

  const pontas: Vec3[] = [
    [haste * 1.2, 0, 0],
    [0, haste * 1.2, 0],
    [0, 0, haste * 1.2],
  ];
  return (
    <group userData={{ [ANOTACAO]: true }}>
      <lineSegments geometry={geometria} frustumCulled={false} renderOrder={40}>
        <lineBasicMaterial vertexColors depthTest={false} toneMapped={false} />
      </lineSegments>
      {pontas.map((p, k) => (
        <sprite
          key={k}
          ref={(s) => {
            sprites.current[k] = s;
          }}
          position={p}
          material={letras[k]}
          renderOrder={41}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
