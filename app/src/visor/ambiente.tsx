// ═══════════════════════════════════════════════════════════════════════════
//  visor/ambiente.tsx — fundo, luz (por estilo) e sombra do Realista
// ---------------------------------------------------------------------------
//  Fundo: o degradê com manchas do A-PORT (`visor/Fundo.tsx`, só o do tema);
//  no Opaco, papel liso (ver `estiloVisual.ts`).
//  Sem terno de eixos X/Y/Z (Jose, 15/10: "não são necessários nesse software")
//  — o muro se lê pelo cubo de vistas.
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

import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
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
