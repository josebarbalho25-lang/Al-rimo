// ═══════════════════════════════════════════════════════════════════════════
//  visor/Corte.tsx — o corte transversal: um plano em X que se arrasta ao
//  longo do muro
// ---------------------------------------------------------------------------
//  Um plano só, atravessado ao muro (normal em X): é o "corte lateral" que o
//  engenheiro faz na prancha, agora andando. Fica o lado x ≤ X, de modo que a
//  vista Lateral (da direita) e a isométrica olham direto para a face cortada.
//  O corte é `clippingPlanes` por material (local), como no A-PORT: o corte
//  global do renderer cortaria também o terno e o contorno do próprio corte.
//
//  Dois jeitos de mover, para as duas mãos: a ALÇA no palco (arrasta ao
//  longo do muro, na direção em que o X aparece na tela) e o campo + régua
//  na barra (valor exato).
// ═══════════════════════════════════════════════════════════════════════════

import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ANOTACAO } from './captura';
import { IconeArrastar } from './icones';
import type { Caixa } from './perfil3d';
import type { PaletaVisor } from './tema3d';

/**
 * Quanto o recorte fica além do plano (metro). Meio milímetro: sem folga o
 * arredondamento da GPU fura a face no plano (lição do A-PORT, `planoDoCorte.ts`).
 */
export const FOLGA_DO_CORTE = 5e-4;

/** Mantém x ≤ X (o three apaga o lado de distância negativa). */
export function planoDoCorte(x: number, alvo = new THREE.Plane()): THREE.Plane {
  return alvo.set(new THREE.Vector3(-1, 0, 0), x + FOLGA_DO_CORTE);
}

/** O contorno do plano no palco e a alça de arrastar. */
export function CorteNoPalco({ x, caixa, paleta, aoMover }: { x: number; caixa: Caixa; paleta: PaletaVisor; aoMover: (x: number) => void }) {
  const camera = useThree((s) => s.camera);
  const tela = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const folga = 0.08 * Math.max(caixa.max[2] - caixa.min[2], caixa.max[1] - caixa.min[1], 0.5);
  const y0 = caixa.min[1] - folga;
  const y1 = caixa.max[1] + folga;
  const z0 = caixa.min[2] - folga;
  const z1 = caixa.max[2] + folga;

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, y0, z0, 0, y1, z0, 0, y1, z0, 0, y1, z1, 0, y1, z1, 0, y0, z1, 0, y0, z1, 0, y0, z0], 3));
    return g;
  }, [y0, y1, z0, z1]);
  useEffect(() => () => geo.dispose(), [geo]);
  // O Html do drei só se reposiciona quando o palco renderiza: com frameloop "demand", mover pede quadro.
  useEffect(() => invalidate(), [x, invalidate]);

  // Arrastar: o deslocamento do mouse projetado na direção em que o X do mundo aparece na tela.
  const arraste = useRef<{ px: number; py: number; x: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const pixelsPorMetroEmX = (): THREE.Vector2 => {
    const yc = (y0 + y1) / 2;
    const a = new THREE.Vector3(x, yc, z1).project(camera);
    const b = new THREE.Vector3(x + 1, yc, z1).project(camera);
    return new THREE.Vector2(((b.x - a.x) * tela.width) / 2, (-(b.y - a.y) * tela.height) / 2);
  };
  const desce = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    arraste.current = { px: e.clientX, py: e.clientY, x };
    setArrastando(true);
  };
  const anda = (e: React.PointerEvent) => {
    const a = arraste.current;
    if (!a) return;
    const s = pixelsPorMetroEmX();
    const s2 = s.lengthSq();
    // Olhando ao longo do X (vista Lateral) a alça não tem para onde andar: aí vale o campo da barra.
    if (s2 < 1) return;
    const dx = ((e.clientX - a.px) * s.x + (e.clientY - a.py) * s.y) / s2;
    aoMover(Math.min(caixa.max[0], Math.max(caixa.min[0], a.x + dx)));
  };
  const sobe = (e: React.PointerEvent) => {
    arraste.current = null;
    setArrastando(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <group position={[x, 0, 0]} userData={{ [ANOTACAO]: true }}>
      <lineSegments geometry={geo} renderOrder={3}>
        <lineBasicMaterial color={paleta.tinta} transparent opacity={0.7} depthTest={false} toneMapped={false} />
      </lineSegments>
      <Html position={[0, (y0 + y1) / 2, z1]} center zIndexRange={[12, 9]}>
        <div
          className={`v3-alca-corte${arrastando ? ' on' : ''}`}
          title="Arrastar o corte"
          onPointerDown={desce}
          onPointerMove={anda}
          onPointerUp={sobe}
          onPointerCancel={sobe}
        >
          <IconeArrastar tamanho={15} />
        </div>
      </Html>
    </group>
  );
}

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O campo e a régua do corte, na barra (fora do Canvas). Valor em metro. */
export function ControleDoCorte({ x, min, max, aoMudar }: { x: number; min: number; max: number; aoMudar: (x: number) => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const confirmar = () => {
    if (texto == null) return;
    const v = Number(texto.replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(v)) aoMudar(Math.min(max, Math.max(min, v)));
    setTexto(null);
  };
  return (
    <div className="v3-corte">
      <span className="v3-rotulo">X</span>
      <input
        className="v3-campo"
        inputMode="decimal"
        value={texto ?? fmt.format(x)}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar();
          if (e.key === 'Escape') setTexto(null);
          e.stopPropagation();
        }}
      />
      <span className="v3-unidade">m</span>
      <input
        className="v3-regua"
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={x}
        onChange={(e) => aoMudar(Number(e.target.value))}
      />
    </div>
  );
}
