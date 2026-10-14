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
//  nas unidades do three (a face recebe luz/π), os números (em `palco3d.ts`,
//  que monta a luz para a tela e para a foto refeita da prancha) dão, na cor
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
import { exposicaoDoEstilo, montarLuzes, pintarFundo } from './palco3d';
import type { Caixa } from './perfil3d';
import type { PaletaVisor } from './tema3d';

/*
  O fundo, a luz e a exposição são MONTADOS em `palco3d.ts` (a foto refeita da prancha monta o mesmo palco fora
  da tela, pela mesma função). Aqui fica só o que é da tela: pendurar no palco do r3f, pedir quadro e redesenhar a
  sombra na hora certa.
*/

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

/*
  A luz de cada estilo (ver o cabeçalho). Cores e Opaco dividem a mesma luz chapada: trocar um pelo outro não
  remonta luz nenhuma.

  ⚠️ A SOMBRA DO REALISTA NÃO SE REFAZ A CADA QUADRO. O sol é preso ao mundo, não à câmera: girar e dar zoom não
  mudam sombra nenhuma. Ela é desenhada uma vez e só se refaz quando o muro muda de verdade (modelo, ocultar,
  Armadura, corte — quem avisa é o Visor3D, pela `versao`). Girar o muro de 7.000 blocos no Realista custa o mesmo
  que sem sombra.
*/
export function Luzes({ estilo, caixa, versao }: { estilo: EstiloVisual; caixa: Caixa; versao: object }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const realista = estilo === 'realista';
  const luzes = useMemo(() => montarLuzes(realista ? 'realista' : 'cores', caixa, gl.capabilities.maxTextureSize), [realista, caixa, gl]);
  useEffect(() => () => luzes.dispose(), [luzes]);

  // A exposição do Realista entra e sai com ele.
  useLayoutEffect(() => {
    gl.toneMapping = exposicaoDoEstilo(estilo);
    gl.toneMappingExposure = 1;
    invalidate();
  }, [gl, estilo, invalidate]);

  // Sombra nova (luz nova, ao entrar no Realista ou com o muro novo) ou o que está aceso mudou: desenha a sombra uma vez.
  useLayoutEffect(() => {
    if (!luzes.sol) return;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, luzes, versao, invalidate]);

  /*
    ⚠️ O QUADRO DEPOIS DA SOMBRA PERDIA A COR NOVA (achado na bancada da foto refeita, 14/10: Realista → Opaco saía
    com os blocos no cinza do Realista, e ficava assim até o próximo giro). O three conta o quadro ANTES de desenhar
    a sombra: as peças que fazem sombra ficam marcadas como "já atualizadas" com o número do quadro SEGUINTE, e
    nele a cor nova da instância (estilo, seleção, Armadura) não sobe para a placa de vídeo. Pular um número depois
    do quadro que desenhou a sombra desfaz o encontro (o número só serve para "atualizar uma vez por quadro").
  */
  const palco = useThree((s) => s.scene);
  useEffect(() => {
    if (!luzes.sol) return;
    let comSombra = false;
    const antes = palco.onBeforeRender;
    const depois = palco.onAfterRender;
    palco.onBeforeRender = function (...a: Parameters<THREE.Object3D['onBeforeRender']>) {
      comSombra = gl.shadowMap.enabled && (gl.shadowMap.autoUpdate || gl.shadowMap.needsUpdate);
      antes.apply(this, a);
    };
    palco.onAfterRender = function (...a: Parameters<THREE.Object3D['onAfterRender']>) {
      if (comSombra) a[0].info.render.frame++;
      comSombra = false;
      depois.apply(this, a);
    };
    return () => {
      palco.onBeforeRender = antes;
      palco.onAfterRender = depois;
    };
  }, [gl, luzes, palco]);

  return <primitive object={luzes.grupo} />;
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
