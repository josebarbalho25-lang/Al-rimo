// ═══════════════════════════════════════════════════════════════════════════
//  visor/CuboDeVistas.tsx — o cubo do canto (porte do A-PORT, sem o tapete)
// ---------------------------------------------------------------------------
//  Vinte e seis direções: 6 faces + 12 arestas + 8 cantos. Não se lê a FACE
//  do triângulo (ela só sabe dizer 6 direções): lê-se ONDE dentro da face o
//  dedo caiu. Cada eixo em que o ponto está na faixa de borda entra na
//  direção com o seu sinal. É o mesmo cubo do A-PORT e do Pró-Viga.
//
//  O que mudou do A-PORT:
//   · rótulos do muro: FRENTE é a face aparente (olhando de −Y), SOLO o lado
//     do aterro (+Y), ESQUERDA/DIREITA as pontas, TOPO e BASE;
//   · saiu o TAPETE (a rosa dos ventos): o muro não tem norte, e o L de Leste
//     brigaria com o rótulo das faces;
//   · cada rótulo é girado na textura para ficar EM PÉ no mundo de Z para
//     cima — o BoxGeometry do three mapeia a textura das faces laterais com o
//     "cima" no Y, e palavra comprida deitada não se lê.
// ═══════════════════════════════════════════════════════════════════════════

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/modelo/tipos';
import { DIRECOES } from './enquadrar';
import { themeColor, type PaletaVisor } from './tema3d';

/** Na ordem das faces do BoxGeometry: +X −X +Y −Y +Z −Z, com o giro (graus) que põe a palavra em pé. */
const FACES: { rotulo: string; giro: number; tom: number }[] = [
  { rotulo: 'DIREITA', giro: -90, tom: 0.95 },
  { rotulo: 'ESQUERDA', giro: 90, tom: 0.95 },
  { rotulo: 'SOLO', giro: 180, tom: 0.97 },
  { rotulo: 'FRENTE', giro: 0, tom: 0.97 },
  { rotulo: 'TOPO', giro: 0, tom: 1 },
  { rotulo: 'BASE', giro: 180, tom: 0.92 },
];

/** Faixa de borda: 30% da meia-aresta. O miolo continua sendo face — o alvo maior e mais usado. */
const FAIXA_BORDA = 0.3;

/*
  ⚠️ O CUBO NÃO RECEBE LUZ NEM EXPOSIÇÃO (lição do A-PORT, 15/09/2026): com a
  exposição que o Canvas liga sozinho, a face branca do tema claro saía cinza.
  Quem separa uma face da outra é o TOM fixo por face.
*/
function textura(rotulo: string, giro: number, tom: number, paleta: PaletaVisor): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = paleta.superficie;
  g.fillRect(0, 0, S, S);
  g.fillStyle = `rgba(0, 0, 0, ${1 - tom})`;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = themeColor('--line-strong', '#3a3a45');
  g.lineWidth = 12;
  g.strokeRect(6, 6, S - 12, S - 12);
  g.save();
  g.translate(S / 2, S / 2);
  g.rotate((giro * Math.PI) / 180);
  g.fillStyle = themeColor('--ink-2', '#c8c8d3');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // A palavra cabe na face: ESQUERDA tem o dobro de TOPO.
  const fonte = (px: number) => `600 ${px}px "Segoe UI", system-ui, sans-serif`;
  g.font = fonte(60);
  const largura = g.measureText(rotulo).width || 1;
  g.font = fonte(Math.min(60, (60 * S * 0.78) / largura));
  g.fillText(rotulo, 0, 0);
  g.restore();
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Registrar = (invalidar: (() => void) | null) => void;

function Cubo({ obterQuaternion, aoEscolher, paleta, registrar }: { obterQuaternion: () => THREE.Quaternion | null; aoEscolher: (d: Vec3) => void; paleta: PaletaVisor; registrar?: Registrar }) {
  const malha = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const invalidate = useThree((s) => s.invalidate);
  // O palco avisa quando desenha; o cubo, que só copia a câmera dele, desenha junto e fica parado com ele.
  useEffect(() => {
    registrar?.(() => invalidate());
    return () => registrar?.(null);
  }, [registrar, invalidate]);

  // Trocar o tema troca a paleta, e a paleta nova repinta as faces.
  const materiais = useMemo(
    () => FACES.map((f) => new THREE.MeshBasicMaterial({ map: textura(f.rotulo, f.giro, f.tom, paleta), toneMapped: false })),
    [paleta],
  );
  const geo = useMemo(() => new THREE.BoxGeometry(1.5, 1.5, 1.5), []);
  const arestas = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(
    () => () => {
      for (const m of materiais) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [materiais],
  );
  useEffect(
    () => () => {
      geo.dispose();
      arestas.dispose();
    },
    [geo, arestas],
  );

  // O cubo copia a orientação da câmera principal, invertida: o que se vê nele
  // é a face do muro que está de frente para você.
  useFrame(() => {
    const q = obterQuaternion();
    if (q && malha.current) malha.current.quaternion.copy(q).invert();
  });

  useEffect(() => {
    const cv = gl.domElement;
    const raio = new THREE.Raycaster();
    const ponto = new THREE.Vector2();
    const clicar = (ev: PointerEvent) => {
      const m = malha.current;
      if (!m || ev.button !== 0) return;
      const r = cv.getBoundingClientRect();
      ponto.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raio.setFromCamera(ponto, camera);
      const acerto = raio.intersectObject(m, false)[0];
      if (!acerto) return;
      // Lê ONDE dentro da face caiu: é assim que aresta e canto ganham direção sem exigir pontaria.
      const meia = 0.75;
      const p = m.worldToLocal(acerto.point.clone());
      const eixo = (v: number) => (Math.abs(v) > meia * (1 - FAIXA_BORDA) ? Math.sign(v) : 0);
      const d = new THREE.Vector3(eixo(p.x), eixo(p.y), eixo(p.z));
      if (d.lengthSq() > 0) {
        d.normalize();
        aoEscolher([d.x, d.y, d.z]);
      }
    };
    cv.addEventListener('pointerdown', clicar);
    return () => cv.removeEventListener('pointerdown', clicar);
  }, [camera, gl, aoEscolher]);

  return (
    <mesh ref={malha} geometry={geo} material={materiais}>
      <lineSegments geometry={arestas}>
        <lineBasicMaterial color={paleta.arestaDoCubo} toneMapped={false} />
      </lineSegments>
    </mesh>
  );
}

export function CuboDeVistas({
  obterQuaternion,
  paleta,
  aoVoar,
  registrar,
}: {
  obterQuaternion: () => THREE.Quaternion | null;
  paleta: PaletaVisor;
  /** Direção do alvo para a câmera. */
  aoVoar: (d: Vec3) => void;
  /**
   * Recebe o "desenhe" do cubo. Sem ele o cubo desenha sem parar (60 vezes por segundo com o palco parado);
   * com ele, só quando o palco desenha.
   */
  registrar?: Registrar;
}) {
  return (
    <div className="v3-cubo">
      <div className="v3-cubo-tela">
        <Canvas
          orthographic
          frameloop={registrar ? 'demand' : 'always'}
          camera={{ position: [0, 0, 4], zoom: 1, left: -1.45, right: 1.45, top: 1.45, bottom: -1.45, near: 0.1, far: 10 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Cubo obterQuaternion={obterQuaternion} aoEscolher={aoVoar} paleta={paleta} {...(registrar ? { registrar } : {})} />
        </Canvas>
      </div>
      <button type="button" className="v3-cubo-casa" title="Isométrica" onClick={() => aoVoar(DIRECOES.iso)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.2 10.6 12 3.4l8.8 7.2" />
          <path d="M5.8 9.6V20h12.4V9.6" />
        </svg>
      </button>
    </div>
  );
}
