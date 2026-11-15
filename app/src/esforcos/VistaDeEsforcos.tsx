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
//  digitar uma entrada não pode desfazer a órbita (regra do visor). A única
//  exceção é o muro mudar de tamanho (outro tipo, outra altura, outro
//  comprimento): aí ela reenquadra, olhando da mesma direção.
//
//  Por que o "refaz" mora DENTRO do Canvas (15/11, achado na tela: o Jose ia
//  às Entradas, trocava balanço por contrafortes, voltava e via o balanço
//  velho até mexer no mouse): com a Gráfica escondida o Canvas não repassa os
//  filhos para a cena (tamanho zero), e o pedido de quadro feito de fora caía
//  antes de a cena nova entrar. De dentro, o pedido sai DEPOIS que ela entrou.
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
import { chaveDoEnquadramento, coresDaTela, montarCenaDosEsforcos, numeroBr, type CenaDosEsforcos, type EscalaDosEsforcos } from './cenaDosEsforcos';
import { GRUPOS, ehGrupo, filtrarPorGrupo, gruposPresentes, type BarraAnalitica, type GrupoDeBarra } from './tipos';
import '@/visor/visor.css';
import './esforcos.css';

/** Altura dos números na tela, px. */
const LETRA_PX = 13;

interface Preferencias {
  escala: EscalaDosEsforcos;
  valores: boolean;
  muro: boolean;
  /** Os grupos de peça desligados no "Mostrar" (15/11). */
  ocultos: GrupoDeBarra[];
}
const PADRAO: Preferencias = { escala: 'aproveitamento', valores: true, muro: true, ocultos: [] };
// o guardado antes de 15/11 não tem `ocultos`: vale, e entra com todos à mostra
const ehPreferencias = (x: unknown): x is Preferencias => {
  const o = x as Partial<Preferencias> | null;
  return !!o && (o.escala === 'aproveitamento' || o.escala === 'valor') && typeof o.valores === 'boolean' && typeof o.muro === 'boolean';
};
const normalizar = (p: Preferencias): Preferencias => ({ ...p, ocultos: Array.isArray(p.ocultos) ? [...new Set(p.ocultos.filter(ehGrupo))] : [] });

/**
 * O "Mostrar" dos esforços (Jose, 15/11: "dá pra isolar por esforço? por exemplo se eu quero ver só painéis?"): um
 * liga/desliga por grupo de peça que o muro TEM, "Todos" e "Nenhum", e o "só" de cada linha, que deixa só aquele.
 * Abre para cima (a barra fica no pé da vista) e fecha clicando fora, como o Mostrar das vistas 2D.
 */
function MostrarGrupos({ presentes, ocultos, aoMudar }: { presentes: GrupoDeBarra[]; ocultos: GrupoDeBarra[]; aoMudar: (ocultos: GrupoDeBarra[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener('pointerdown', fora, true);
    return () => window.removeEventListener('pointerdown', fora, true);
  }, [aberto]);
  if (presentes.length < 2) return null;
  const algum = presentes.some((g) => ocultos.includes(g));
  const fora = (gs: GrupoDeBarra[]) => aoMudar(GRUPOS.map((g) => g.id).filter((g) => gs.includes(g)));
  return (
    <div className="esf-mostrar" ref={caixa}>
      <Botao titulo="Mostrar" texto on={algum} aoClicar={() => setAberto((a) => !a)}>
        Mostrar
      </Botao>
      {aberto && (
        <div className="esf-menu" role="menu">
          {GRUPOS.filter((g) => presentes.includes(g.id)).map((g) => (
            <div key={g.id} className="esf-menu-linha">
              <label>
                <input
                  type="checkbox"
                  checked={!ocultos.includes(g.id)}
                  onChange={(e) => fora(e.target.checked ? ocultos.filter((x) => x !== g.id) : [...ocultos, g.id])}
                />
                {g.rotulo}
              </label>
              <button type="button" className="esf-menu-so" title={`Só ${g.rotulo.toLowerCase()}`} onClick={() => fora(presentes.filter((x) => x !== g.id))}>
                só
              </button>
            </div>
          ))}
          <div className="esf-menu-pe">
            <button type="button" onClick={() => fora([])}>Todos</button>
            <button type="button" onClick={() => fora([...presentes])}>Nenhum</button>
          </div>
        </div>
      )}
    </div>
  );
}
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

/**
 * Enquadra na isométrica ao abrir, quando já há controle e tela; depois, toda vez que o muro muda de tamanho, de
 * novo — olhando da direção em que a câmera está.
 */
function Enquadrar({ cena, muro, voo }: { cena: CenaDosEsforcos; muro: string; voo: React.RefObject<Voo | null> }) {
  const controles = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current === muro || !controles || width < 2 || height < 2) return;
    const primeira = feito.current === null;
    feito.current = muro;
    const alvo = (controles as unknown as { target?: THREE.Vector3 }).target ?? new THREE.Vector3();
    const v = camera.position.clone().sub(alvo);
    const dir: Vec3 = primeira || v.lengthSq() < 1e-12 ? DIRECOES.iso : [v.x, v.y, v.z];
    voo.current = { de: null, para: enquadramento(cena.caixa, dir, width, height), inicio: performance.now(), duracao: 0 };
    invalidate();
  }, [controles, camera, width, height, cena, muro, voo, invalidate]);
  return null;
}

/** Pede o quadro quando a cena nova JÁ ESTÁ na árvore do Canvas (e quando a tela volta a ter tamanho). */
function RedesenharAoMudar({ cena }: { cena: CenaDosEsforcos }) {
  const invalidate = useThree((s) => s.invalidate);
  const { width, height } = useThree((s) => s.size);
  useLayoutEffect(() => {
    invalidate();
  }, [cena, width, height, invalidate]);
  return null;
}

/** Os números que se encobririam: a barra escolhida e a do mouse ficam na frente (cenaDosEsforcos, arrumarRotulos). */
function RotulosSemEncobrir({ cena, primeiros }: { cena: CenaDosEsforcos; primeiros: (string | null)[] }) {
  const invalidate = useThree((s) => s.invalidate);
  const chave = primeiros.join('|');
  useLayoutEffect(() => {
    invalidate();
  }, [chave, invalidate]);
  useFrame(({ camera, size }) => {
    cena.arrumarRotulos(camera, size.width, size.height, LETRA_PX / Math.max((camera as THREE.OrthographicCamera).zoom, 1e-6), primeiros);
  });
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
  const [pref, setPref] = useState<Preferencias>(() => normalizar(lembrar(CHAVE, PADRAO, ehPreferencias)));
  const mudar = (p: Partial<Preferencias>) =>
    setPref((a) => {
      const n = { ...a, ...p };
      guardar(CHAVE, n);
      return n;
    });

  const todas = useMemo(() => barrasAnaliticas(resultado, modelo), [resultado, modelo]);
  const presentes = useMemo(() => gruposPresentes(todas), [todas]);
  // o grupo desligado some: barra, diagrama e número, e não pega clique (a câmera não pula: o enquadrar é do muro)
  const barras = useMemo(() => filtrarPorGrupo(todas, pref.ocultos), [todas, pref.ocultos]);
  const muro = useMemo(() => chaveDoEnquadramento(modelo), [modelo]);
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
    // a folha leva o que se vê: os grupos desligados também
    const ocultos = pref.ocultos.filter((g) => presentes.includes(g));
    enviarParaPrancha({ tipo: 'esforcos', camera, proporcao: proporcaoDaCamera(st.camera), escala: pref.escala, valores: pref.valores, muro: pref.muro, ...(ocultos.length ? { ocultos } : {}) });
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
        <Enquadrar cena={cena} muro={muro} voo={voo} />
        <RedesenharAoMudar cena={cena} />
        <MouseNasBarras cena={cena} aoPassar={setSobre} aoPegar={setSel} />
        <LetraPeloZoom cena={cena} />
        <RotulosSemEncobrir cena={cena} primeiros={[sel, sobre]} />
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
          <MostrarGrupos presentes={presentes} ocultos={pref.ocultos} aoMudar={(ocultos) => mudar({ ocultos })} />
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
