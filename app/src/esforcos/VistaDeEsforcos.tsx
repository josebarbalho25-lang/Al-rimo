// ═══════════════════════════════════════════════════════════════════════════
//  esforcos/VistaDeEsforcos.tsx — a vista "Esforços" da Gráfica
// ---------------------------------------------------------------------------
//  Jose, 15/11: "um diagrama em 2D, só que num esquema 3D com barras
//  analíticas… cada barrinha com o seu desenho de momento solicitante e
//  momento resistente". O muro em arame (barrasAnaliticas.ts), cada barra com o
//  MSd cheio e o MRd em linha, deitados no plano de flexão; vermelho onde o
//  MSd passa do MRd.
//
//  A câmera e o mouse são os do visor 3D (visor/camera.tsx — roda = zoom no
//  cursor, meio = deslocar, Shift + meio = orbitar), o cubo de vistas é o
//  mesmo. O clique pega a barra e mostra rótulo + valor; o botão leva ao card
//  da memória onde está a conta.
//
//  A cena se refaz quando a conta, a escala, os números ou o fantasma do muro
//  mudam (é pouca coisa: algumas dezenas de linhas e faixas); a câmera NÃO —
//  digitar uma entrada não pode desfazer a órbita (regra do visor).
// ═══════════════════════════════════════════════════════════════════════════

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Modelo, Vec3 } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { CHAVES, guardar, lembrar } from '@/estado/lembrete';
import { useInterface } from '@/estado/interface';
import { enviarParaPrancha } from '@/pranchas/envio';
import { Fundo } from '@/visor/ambiente';
import { OrbitaNoShift, VooDaCamera, DURACAO_VOO, type Voo } from '@/visor/camera';
import { CuboDeVistas } from '@/visor/CuboDeVistas';
import { DIRECOES, enquadramento, type VistaNomeada } from '@/visor/enquadrar';
import { IconeEnquadrar, IconeFechar, IconeFrente, IconeIso, IconeLateral, IconePrancha, IconeTopo } from '@/visor/icones';
import { lerPontoDeVista, proporcaoDaCamera } from '@/visor/pontoDeVista';
import { lerPaleta, observarTema, themeColor, type PaletaVisor } from '@/visor/tema3d';
import { LIMIAR_CLIQUE_PX } from '@/visor/Visor3D';
import { barrasAnaliticas } from './barrasAnaliticas';
import { coresDaTela, montarCenaDosEsforcos, numeroBr, type CenaDosEsforcos, type EscalaDosEsforcos } from './cenaDosEsforcos';
import type { BarraAnalitica } from './tipos';
import '@/visor/visor.css';
import './esforcos.css';

/** Altura dos números na tela, px. */
const LETRA_PX = 13;

interface Preferencias {
  escala: EscalaDosEsforcos;
  valores: boolean;
  muro: boolean;
}
const PADRAO: Preferencias = { escala: 'aproveitamento', valores: true, muro: true };
const ehPreferencias = (x: unknown): x is Preferencias => {
  const o = x as Partial<Preferencias> | null;
  return !!o && (o.escala === 'aproveitamento' || o.escala === 'valor') && typeof o.valores === 'boolean' && typeof o.muro === 'boolean';
};
const CHAVE = CHAVES.esforcos;

/** O mouse por cima acende a barra; o clique (sem arrastar) escolhe. */
function MouseNasBarras({ cena, aoPassar, aoPegar }: { cena: CenaDosEsforcos; aoPassar: (id: string | null) => void; aoPegar: (id: string | null) => void }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const tela = useThree((s) => s.gl.domElement);
  const atual = useRef({ cena, aoPassar, aoPegar });
  atual.current = { cena, aoPassar, aoPegar };
  useEffect(() => {
    const raioEm = (x: number, y: number) => {
      const r = tela.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      const raio = new THREE.Raycaster();
      raio.setFromCamera(ndc, camera);
      raio.ray.origin.addScaledVector(raio.ray.direction, -Math.abs(camera.far));
      // o eixo é uma linha fina: pega a até 6 px dela
      raio.params.Line = { threshold: 6 / Math.max(camera.zoom, 1e-6) };
      return raio;
    };
    let inicio: { x: number; y: number; id: number } | null = null;
    let quadro = 0;
    const anda = (e: PointerEvent) => {
      if (e.buttons) return;
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => atual.current.aoPassar(atual.current.cena.pegar(raioEm(e.clientX, e.clientY))));
    };
    const sai = () => atual.current.aoPassar(null);
    const desce = (e: PointerEvent) => {
      inicio = e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    };
    const sobe = (e: PointerEvent) => {
      const a = inicio;
      inicio = null;
      if (!a || e.button !== 0 || a.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > LIMIAR_CLIQUE_PX) return;
      atual.current.aoPegar(atual.current.cena.pegar(raioEm(e.clientX, e.clientY)));
    };
    tela.addEventListener('pointermove', anda);
    tela.addEventListener('pointerleave', sai);
    tela.addEventListener('pointerdown', desce);
    tela.addEventListener('pointerup', sobe);
    return () => {
      cancelAnimationFrame(quadro);
      tela.removeEventListener('pointermove', anda);
      tela.removeEventListener('pointerleave', sai);
      tela.removeEventListener('pointerdown', desce);
      tela.removeEventListener('pointerup', sobe);
    };
  }, [camera, tela]);
  return null;
}

/** Os números ficam com a mesma altura na tela em qualquer zoom. */
function LetraPeloZoom({ cena }: { cena: CenaDosEsforcos }) {
  useFrame(({ camera }) => cena.tamanhoDaLetra(LETRA_PX / Math.max((camera as THREE.OrthographicCamera).zoom, 1e-6)));
  return null;
}

function AvisarOCubo({ cubo }: { cubo: React.RefObject<(() => void) | null> }) {
  useFrame(() => cubo.current?.());
  return null;
}

/** Enquadra na isométrica ao abrir — uma vez, quando já há controle e tela. */
function EnquadrarAoAbrir({ cena, voo }: { cena: CenaDosEsforcos; voo: React.RefObject<Voo | null> }) {
  const controles = useThree((s) => s.controls);
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current || !controles || width < 2 || height < 2) return;
    feito.current = true;
    voo.current = { de: null, para: enquadramento(cena.caixa, DIRECOES.iso, width, height), inicio: performance.now(), duracao: 0 };
    invalidate();
  }, [controles, width, height, cena, voo, invalidate]);
  return null;
}

/** O pico que governa a barra (o maior MSd) e o MRd do mesmo lado. */
export function leituraDaBarra(b: BarraAnalitica): { msd: number | null; mrd: number | null } {
  const msds = b.picos.filter((p) => p.qual === 'msd');
  const maior = msds.reduce<(typeof msds)[number] | null>((m, p) => (!m || Math.abs(p.valor) > Math.abs(m.valor) ? p : m), null);
  if (!maior) return { msd: null, mrd: null };
  const lado = maior.valor >= 0 ? 1 : -1;
  const mrd = b.picos.find((p) => p.qual === 'mrd' && Math.sign(p.valor || 1) === lado) ?? b.picos.find((p) => p.qual === 'mrd');
  return { msd: Math.abs(maior.valor), mrd: mrd ? Math.abs(mrd.valor) : null };
}

function Botao({ titulo, on, aoClicar, children, texto }: { titulo: string; on?: boolean; aoClicar: () => void; children: React.ReactNode; texto?: boolean }) {
  return (
    <button type="button" className={`v3-btn${texto ? ' esf-btn-texto' : ''}${on ? ' on' : ''}`} title={titulo} aria-label={titulo} aria-pressed={on} onClick={aoClicar}>
      {children}
    </button>
  );
}

export function VistaDeEsforcos({ modelo, resultado }: { modelo: Modelo; resultado: Resultado }) {
  const [paleta, setPaleta] = useState<PaletaVisor>(() => lerPaleta());
  useEffect(() => observarTema(setPaleta), []);
  const [pref, setPref] = useState<Preferencias>(() => lembrar(CHAVE, PADRAO, ehPreferencias));
  const mudar = (p: Partial<Preferencias>) =>
    setPref((a) => {
      const n = { ...a, ...p };
      guardar(CHAVE, n);
      return n;
    });

  const barras = useMemo(() => barrasAnaliticas(resultado, modelo), [resultado, modelo]);
  const cena = useMemo(
    () => montarCenaDosEsforcos(barras, modelo, { escala: pref.escala, valores: pref.valores, muro: pref.muro, cores: coresDaTela(paleta, themeColor) }),
    [barras, modelo, pref.escala, pref.valores, pref.muro, paleta],
  );
  // DESCARTE ADIADO (o do Visor3D): o modo estrito do React desmonta e remonta o efeito na primeira vez; a cena só
  // é jogada fora se ninguém a remontou nesse instante
  const montagens = useRef(new Map<CenaDosEsforcos, number>());
  useEffect(() => {
    const m = montagens.current;
    m.set(cena, (m.get(cena) ?? 0) + 1);
    return () => {
      m.set(cena, (m.get(cena) ?? 1) - 1);
      setTimeout(() => {
        if (m.get(cena)) return;
        m.delete(cena);
        cena.dispose();
      }, 0);
    };
  }, [cena]);

  const estado = useRef<RootState | null>(null);
  const agora = () => estado.current?.get() ?? null;
  const voo = useRef<Voo | null>(null);
  const invalidarCubo = useRef<(() => void) | null>(null);
  const registrarCubo = useCallback((f: (() => void) | null) => {
    invalidarCubo.current = f;
  }, []);

  const [sobre, setSobre] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const escolhida = sel ? barras.find((b) => b.id === sel) ?? null : null;
  // a barra escolhida que sumiu (o muro mudou) solta a escolha
  useEffect(() => {
    if (sel && !barras.some((b) => b.id === sel)) setSel(null);
  }, [barras, sel]);
  useLayoutEffect(() => {
    cena.destacar(sobre, sel);
    agora()?.invalidate();
  }, [cena, sobre, sel]);
  useLayoutEffect(() => {
    agora()?.invalidate();
  }, [cena]);

  const voar = useCallback(
    (dir: Vec3 | null) => {
      const st = agora();
      if (!st) return;
      const ctl = st.controls as unknown as { target: THREE.Vector3 } | null;
      const d = dir ?? (() => {
        const v = st.camera.position.clone().sub(ctl?.target ?? new THREE.Vector3());
        return [v.x, v.y, v.z] as Vec3;
      })();
      voo.current = { de: null, para: enquadramento(cena.caixa, d, st.size.width, st.size.height), inicio: performance.now(), duracao: DURACAO_VOO };
      st.invalidate();
    },
    [cena],
  );
  const selAtual = useRef(sel);
  selAtual.current = sel;
  const pivo = useCallback((): Vec3 | null => (selAtual.current ? cena.centroDe(selAtual.current) : null), [cena]);

  const enviar = () => {
    const st = agora();
    if (!st) return;
    const ctl = st.controls as unknown as { target: THREE.Vector3 } | null;
    const camera = lerPontoDeVista(st.camera, ctl?.target ?? null, { estilo: 'opaco', armadura: false, corte: null, ocultas: [] });
    enviarParaPrancha({ tipo: 'esforcos', camera, proporcao: proporcaoDaCamera(st.camera), escala: pref.escala, valores: pref.valores, muro: pref.muro });
  };

  const abrirNoCard = useInterface((s) => s.abrirNoCard);
  const vazio = barras.length === 0;

  return (
    <div
      className="visor3d esforcos"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && sel) setSel(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        orthographic
        flat
        frameloop="demand"
        camera={{ position: [20, -20, 17], zoom: 40, near: -5000, far: 5000, up: [0, 0, 1] }}
        gl={{ antialias: true }}
        onCreated={(st) => {
          estado.current = st;
        }}
      >
        <Fundo paleta={paleta} liso />
        <primitive object={cena.grupo} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          enableRotate={false}
          zoomSpeed={2}
          zoomToCursor
          minZoom={1}
          maxZoom={50000}
          mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        />
        <OrbitaNoShift pivo={pivo} />
        <VooDaCamera voo={voo} />
        <EnquadrarAoAbrir cena={cena} voo={voo} />
        <MouseNasBarras cena={cena} aoPassar={setSobre} aoPegar={setSel} />
        <LetraPeloZoom cena={cena} />
        <AvisarOCubo cubo={invalidarCubo} />
      </Canvas>
      <div className="v3-overlay">
        {escolhida && <Leitura barra={escolhida} aoFechar={() => setSel(null)} aoMemoria={() => abrirNoCard(escolhida.card)} />}
        {!vazio && (
          <div className="v3-legenda esf-legenda" aria-hidden="true">
            <div className="v3-legenda-linha"><span className="v3-legenda-cor esf-cor-msd" />M<sub>Sd</sub></div>
            <div className="v3-legenda-linha"><span className="esf-cor-mrd" />M<sub>Rd</sub></div>
            <div className="v3-legenda-linha"><span className="v3-legenda-cor esf-cor-exc" />M<sub>Sd</sub> &gt; M<sub>Rd</sub></div>
          </div>
        )}
        <CuboDeVistas paleta={paleta} obterQuaternion={() => estado.current?.camera.quaternion ?? null} aoVoar={voar} registrar={registrarCubo} />
        <div className="v3-barra" onPointerDown={(e) => e.stopPropagation()}>
          {(['frente', 'lateral', 'topo', 'iso'] as VistaNomeada[]).map((v) => {
            const I = { frente: IconeFrente, lateral: IconeLateral, topo: IconeTopo, iso: IconeIso }[v];
            const nome = { frente: 'Frente', lateral: 'Lateral', topo: 'Topo', iso: 'Isométrica' }[v];
            return (
              <Botao key={v} titulo={nome} aoClicar={() => voar(DIRECOES[v])}>
                <I />
              </Botao>
            );
          })}
          <span className="v3-fio" />
          <Botao titulo="Enquadrar" aoClicar={() => voar(null)}>
            <IconeEnquadrar />
          </Botao>
          <span className="v3-fio" />
          <Botao titulo="Escala: aproveitamento" texto on={pref.escala === 'aproveitamento'} aoClicar={() => mudar({ escala: 'aproveitamento' })}>
            Aproveitamento
          </Botao>
          <Botao titulo="Escala: valor" texto on={pref.escala === 'valor'} aoClicar={() => mudar({ escala: 'valor' })}>
            Valor
          </Botao>
          <span className="v3-fio" />
          <Botao titulo="Valores" texto on={pref.valores} aoClicar={() => mudar({ valores: !pref.valores })}>
            Valores
          </Botao>
          <Botao titulo="Muro" texto on={pref.muro} aoClicar={() => mudar({ muro: !pref.muro })}>
            Muro
          </Botao>
          <span className="v3-fio" />
          <Botao titulo="Enviar para a prancha" aoClicar={enviar}>
            <IconePrancha />
          </Botao>
        </div>
      </div>
    </div>
  );
}

function Leitura({ barra, aoFechar, aoMemoria }: { barra: BarraAnalitica; aoFechar: () => void; aoMemoria: () => void }) {
  const { msd, mrd } = leituraDaBarra(barra);
  const u = barra.unidade;
  const uso = barra.aproveitamento;
  return (
    <div className="v3-props esf-leitura" role="dialog" aria-label={barra.nome}>
      <div className="v3-props-cabeca">
        <span>{barra.nome}</span>
        <button type="button" className="v3-btn v3-btn-mini" title="Fechar" aria-label="Fechar" onClick={aoFechar}>
          <IconeFechar />
        </button>
      </div>
      <dl className="v3-props-corpo">
        <div className="v3-prop">
          <dt>M<sub>Sd</sub></dt>
          <dd className="v3-mono">{msd === null ? '—' : `${numeroBr(msd)} ${u}`}</dd>
        </div>
        <div className="v3-prop">
          <dt>M<sub>Rd</sub></dt>
          <dd className="v3-mono">{mrd === null ? '—' : `${numeroBr(mrd)} ${u}`}</dd>
        </div>
        <div className="v3-prop">
          <dt>Uso</dt>
          <dd className={`v3-mono${barra.passa === false || barra.semMRd ? ' esf-falha' : ''}`}>{uso === null ? '—' : `${numeroBr(uso * 100, 0)} %`}</dd>
        </div>
      </dl>
      <div className="esf-leitura-pe">
        <button type="button" className="esf-btn-memoria" onClick={aoMemoria}>
          Memória
        </button>
      </div>
    </div>
  );
}
