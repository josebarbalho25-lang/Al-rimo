// ═══════════════════════════════════════════════════════════════════════════
//  visor/Visor3D.tsx — o muro em 3D: orbitar, enquadrar, ocultar, selecionar,
//  cortar, fotografar e mandar a foto para a prancha. Só visualização: nada
//  aqui muda o modelo.
// ---------------------------------------------------------------------------
//  Molde: a prévia de carga do A-PORT (`ui/PreviaDaCarga.tsx`) — câmera
//  ortográfica, `frameloop="demand"` (só desenha quando algo muda: parado, o
//  visor não gasta nada), o mesmo cubo de vistas, eixos com letra. O mouse é o
//  do palco do A-PORT (ver `camera.tsx`).
//
//  Recebe o Modelo pronto (quem fabrica é a modulação) e devolve a seleção por
//  `onSelecionar`. Com `selecionado` passado, a seleção é do dono; sem ele, o
//  visor guarda a sua.
//
//  ⚠️ 5.000 BLOCOS GIRAM LEVES porque o custo de desenhar é o número de LOTES
//  (um InstancedMesh por forma × grupo de ocultar), não o de peças. Medido
//  (`integracao.test.ts` e bancada, 08/10/2026): o muro da aula 12.3 com
//  120 m — 7.313 peças de alvenaria, 13.608 peças, 5.281 barras — vira 18
//  lotes + 6 malhas de aço = 32 chamadas de desenho (2,3 milhões de
//  triângulos); girando com Shift + meio na RTX 3060 dele, cada quadro
//  custou 0,8 ms (mediana) / 1,4 ms (95%) — a tela de 60 Hz dá 16,7 ms.
//
//  ESTILOS (09/10/2026, `estiloVisual.ts`): Cores (padrão, legenda das classes
//  de bloco), Realista (pele de material, exposição e sombra do sol) e Opaco
//  (papel e aresta preta). O estilo é lembrado entre aberturas e troca só
//  material, cor e luz — a cena não se remonta.
// ═══════════════════════════════════════════════════════════════════════════

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Modelo, Vec3 } from '@/modelo/tipos';
import { enviarParaPrancha } from '@/pranchas/envio';
import { Fundo, Luzes, Terno } from './ambiente';
import { BarraDoVisor } from './BarraDoVisor';
import { OrbitaNoShift, VooDaCamera, DURACAO_VOO, type Voo } from './camera';
import { baixar, capturar, ESCALA_DA_FOTO } from './captura';
import { construirCena3D, type Cena3D } from './cena3d';
import { ControleDoCorte, CorteNoPalco, planoDoCorte } from './Corte';
import { CuboDeVistas } from './CuboDeVistas';
import { DIRECOES, enquadramento, type VistaNomeada } from './enquadrar';
import { guardarEstilo, lembrarEstilo, type EstiloVisual } from './estiloVisual';
import { desenharLegenda, LegendaDasCores } from './LegendaDasCores';
import { desenharLegendaDasBitolas, LegendaDasBitolas } from './LegendaDasBitolas';
import type { Categoria } from './lotes';
import { PainelDaPeca } from './PainelDaPeca';
import { palcoDoTema } from './palco3d';
import { lerPontoDeVista, proporcaoDaCamera } from './pontoDeVista';
import { lerPaleta, observarTema, type PaletaVisor } from './tema3d';
import './visor.css';

/** Clique × arraste: só é clique se o ponteiro andou menos que isto entre descer e subir (o LIMIAR_CAIXA_PX do A-PORT). */
export const LIMIAR_CLIQUE_PX = 4;

export interface PropsDoVisor3D {
  modelo: Modelo;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
}

/** O clique esquerdo seleciona: raio na cena, primeiro acerto visível. */
function CliqueDeSelecao({ cena, aoPegar }: { cena: Cena3D; aoPegar: (id: string | null) => void }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const tela = useThree((s) => s.gl.domElement);
  const atual = useRef({ cena, aoPegar });
  atual.current = { cena, aoPegar };
  useEffect(() => {
    let inicio: { x: number; y: number; id: number } | null = null;
    const desce = (e: PointerEvent) => {
      inicio = e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    };
    const sobe = (e: PointerEvent) => {
      const a = inicio;
      inicio = null;
      if (!a || e.button !== 0 || a.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > LIMIAR_CLIQUE_PX) return;
      const r = tela.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const raio = new THREE.Raycaster();
      raio.setFromCamera(ndc, camera);
      // Na ortográfica o raio nasce no meio da profundidade: recua até o plano de trás para não perder peça.
      raio.ray.origin.addScaledVector(raio.ray.direction, -Math.abs(camera.far));
      atual.current.aoPegar(atual.current.cena.pegar(raio));
    };
    tela.addEventListener('pointerdown', desce);
    tela.addEventListener('pointerup', sobe);
    return () => {
      tela.removeEventListener('pointerdown', desce);
      tela.removeEventListener('pointerup', sobe);
    };
  }, [camera, tela]);
  return null;
}

/*
  DESCARTE ADIADO da cena. O React em modo estrito (o main.tsx do app liga) monta, desmonta e remonta cada
  efeito na primeira vez: um `useEffect(() => () => cena.dispose())` jogava fora a cena que continuava em
  uso, e o three tinha de subir de novo à placa de vídeo os 5.000 blocos e recompilar os materiais. Aqui o
  descarte espera um instante e só acontece se ninguém remontou a mesma cena nesse meio-tempo.
*/
function useDescarteAdiado(cena: Cena3D) {
  const montagens = useRef(new Map<Cena3D, number>());
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
}

/** O cubo desenha só quando o palco desenha (os dois na mesma batida, e parado nenhum gasta nada). */
function AvisarOCubo({ cubo }: { cubo: React.RefObject<(() => void) | null> }) {
  useFrame(() => cubo.current?.());
  return null;
}

/** O traço desbota com o zoom (ver `Cena3D.aplicarZoom`). Antes de cada quadro, barato. */
function TracoPeloZoom({ cena }: { cena: Cena3D }) {
  useFrame(({ camera }) => cena.aplicarZoom((camera as THREE.OrthographicCamera).zoom));
  return null;
}

/** Enquadra na isométrica ao abrir — uma vez, quando já há controle, tela e peça. */
function EnquadrarAoAbrir({ cena, voo }: { cena: Cena3D; voo: React.RefObject<Voo | null> }) {
  const controles = useThree((s) => s.controls);
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current || !controles || width < 2 || height < 2) return;
    if (!cena.lotes.length && !cena.barras.length) return;
    feito.current = true;
    voo.current = { de: null, para: enquadramento(cena.caixaVisivel(), DIRECOES.iso, width, height), inicio: performance.now(), duracao: 0 };
    invalidate();
  }, [controles, width, height, cena, voo, invalidate]);
  return null;
}

export function Visor3D({ modelo, selecionado, onSelecionar }: PropsDoVisor3D) {
  const [paleta, setPaleta] = useState<PaletaVisor>(() => lerPaleta());
  useEffect(() => observarTema(setPaleta), []);
  const paletaAtual = useRef(paleta);
  paletaAtual.current = paleta;

  const [estilo, setEstilo] = useState<EstiloVisual>(lembrarEstilo);
  const escolherEstilo = (e: EstiloVisual) => {
    setEstilo(e);
    guardarEstilo(e);
  };
  const estiloAtual = useRef(estilo);
  estiloAtual.current = estilo;
  // O Opaco é papel nos dois temas: fundo, letra dos eixos e contorno do corte saem desta paleta, não da do tema.
  const palco = useMemo(() => palcoDoTema(paleta, estilo), [paleta, estilo]);

  // A cena só se remonta quando o MODELO muda; tema, estilo, ocultar, Raio-X, corte e seleção se aplicam por cima.
  const cena = useMemo(() => construirCena3D(modelo, paletaAtual.current, estiloAtual.current), [modelo]);
  useDescarteAdiado(cena);
  useEffect(() => {
    if (cena.semGeometria.length) console.warn(`[visor] ${cena.semGeometria.length} peça(s) sem geometria no modelo:`, cena.semGeometria.slice(0, 5));
  }, [cena]);

  /*
    ⚠️ O ESTADO DO r3f É TROCADO A CADA MUDANÇA, não alterado: o objeto que o `onCreated` entrega fica com o
    tamanho e os controles daquele instante. Quem guardava ele e lia `st.size` enquadrava com o tamanho da
    tela de quando o visor abriu — depois de arrastar o painel, o Enquadrar errava a moldura. Lê-se sempre
    pelo `get()`, que devolve o estado de agora.
  */
  const estado = useRef<RootState | null>(null);
  const agora = () => estado.current?.get() ?? null;
  const voo = useRef<Voo | null>(null);
  const invalidar = () => agora()?.invalidate();

  // ── Seleção (controlada pelo dono, se ele passar `selecionado`) ──
  const [selInterna, setSelInterna] = useState<string | null>(null);
  const sel = selecionado !== undefined ? selecionado : selInterna;
  const selecionar = useCallback(
    (id: string | null) => {
      if (selecionado === undefined) setSelInterna(id);
      onSelecionar?.(id);
    },
    [selecionado, onSelecionar],
  );
  const selAtual = useRef(sel);
  selAtual.current = sel;

  const [ocultas, setOcultas] = useState<ReadonlySet<Categoria>>(() => new Set());
  const [armadura, setArmadura] = useState(false);
  const caixaTotal = useMemo(() => cena.caixaVisivel(), [cena]);
  const [corte, setCorte] = useState<{ ligado: boolean; x: number }>(() => ({ ligado: false, x: (caixaTotal.min[0] + caixaTotal.max[0]) / 2 }));
  // O corte sobrevive à troca do modelo, mas não fora dele: um muro mais curto não pode ficar com o plano no vazio.
  const xCorte = Math.min(caixaTotal.max[0], Math.max(caixaTotal.min[0], corte.x));
  const plano = useRef(new THREE.Plane());
  const invalidarCubo = useRef<(() => void) | null>(null);
  const registrarCubo = useCallback((f: (() => void) | null) => {
    invalidarCubo.current = f;
  }, []);

  // Antes do quadro (layout), não depois: com a cena nova (o modelo mudou), o primeiro quadro já sai com o
  // que estava oculto, o Raio-X, o corte e a seleção — sem piscar o muro inteiro aceso por um quadro.
  useLayoutEffect(() => {
    cena.aplicarPaleta(paleta);
    invalidar();
  }, [cena, paleta]);
  useLayoutEffect(() => {
    cena.aplicarEstilo(estilo);
    invalidar();
  }, [cena, estilo]);
  useLayoutEffect(() => {
    cena.aplicarVisibilidade(ocultas);
    invalidar();
  }, [cena, ocultas]);
  useLayoutEffect(() => {
    cena.aplicarArmadura(armadura);
    invalidar();
  }, [cena, armadura]);
  useLayoutEffect(() => {
    planoDoCorte(xCorte, plano.current);
    cena.aplicarCorte(corte.ligado ? [plano.current] : []);
    invalidar();
  }, [cena, corte.ligado, xCorte]);
  useLayoutEffect(() => {
    cena.pintarSelecao(sel);
    invalidar();
  }, [cena, sel]);

  // A sombra do Realista se redesenha só quando o que está aceso muda (ver `ambiente.tsx`): este objeto
  // muda de identidade exatamente nessas horas.
  const versaoDaSombra = useMemo(() => ({}), [cena, ocultas, armadura, corte.ligado, xCorte]);
  const caixaDaSombra = useMemo(() => cena.caixaTotal(), [cena]);
  const classes = useMemo(() => cena.classesVisiveis(ocultas), [cena, ocultas]);
  const diametros = useMemo(() => cena.diametrosVisiveis(ocultas), [cena, ocultas]);

  const presentes = useMemo(() => {
    const s = new Set<Categoria>();
    for (const l of cena.lotes) for (const c of l.lote.categorias) s.add(c);
    for (const b of cena.barras) for (const c of b.lote.categorias) s.add(c);
    return s;
  }, [cena]);

  // ── Câmera ──
  const voar = useCallback(
    (dir: Vec3 | null) => {
      const st = agora();
      if (!st) return;
      const ctl = st.controls as unknown as { target: THREE.Vector3 } | null;
      const d = dir ?? (() => {
        const v = st.camera.position.clone().sub(ctl?.target ?? new THREE.Vector3());
        return [v.x, v.y, v.z] as Vec3;
      })();
      voo.current = { de: null, para: enquadramento(cena.caixaVisivel(), d, st.size.width, st.size.height), inicio: performance.now(), duracao: DURACAO_VOO };
      st.invalidate();
    },
    [cena],
  );
  const pivo = useCallback((): Vec3 | null => (selAtual.current ? cena.centroDe(selAtual.current) : null), [cena]);

  const fotografar = () => {
    const st = agora();
    if (!st) return;
    // No Cores a legenda vai junto: a foto vai para a obra, e cor sem legenda não diz qual é o bloco. Com a Armadura
    // ligada, vai a das bitolas (é ela que está na tela).
    const legenda = armadura && diametros.length
      ? (g: CanvasRenderingContext2D, w: number, _h: number, e: number) => desenharLegendaDasBitolas(g, w, diametros, palco, e)
      : estilo === 'cores' && classes.size ? (g: CanvasRenderingContext2D, w: number, _h: number, e: number) => desenharLegenda(g, w, classes, palco, e) : undefined;
    const url = capturar(st, ESCALA_DA_FOTO, () => cena.pintarSelecao(null), () => cena.pintarSelecao(selAtual.current), legenda);
    baixar(url, 'al-rimo-3d.png');
  };

  /*
    ENVIAR PARA A PRANCHA: a mesma foto (mesma cena, sem anotações nem seleção), sem a legenda pintada — a prancha
    tem a dela no quadro lateral — e com o ponto de vista, para a prancha refazer a foto quando o muro mudar
    (`fotoRefeita.ts`). Sem prancha ouvindo, o pedido não vai a lugar nenhum.
  */
  const enviarFoto = () => {
    const st = agora();
    if (!st) return;
    const ctl = st.controls as unknown as { target: THREE.Vector3 } | null;
    const camera = lerPontoDeVista(st.camera, ctl?.target ?? null, { estilo, armadura, corte: corte.ligado ? xCorte : null, ocultas });
    const dataUrl = capturar(st, ESCALA_DA_FOTO, () => cena.pintarSelecao(null), () => cena.pintarSelecao(selAtual.current));
    enviarParaPrancha({ tipo: '3d', dataUrl, camera, proporcao: proporcaoDaCamera(st.camera) });
  };

  const alternar = (c: Categoria) =>
    setOcultas((o) => {
      const n = new Set(o);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const ligarCorte = () =>
    setCorte((c) => {
      const dentro = c.x >= caixaTotal.min[0] && c.x <= caixaTotal.max[0];
      return { ligado: !c.ligado, x: dentro ? c.x : (caixaTotal.min[0] + caixaTotal.max[0]) / 2 };
    });
  const moverCorte = useCallback((x: number) => setCorte((c) => ({ ...c, x })), []);

  const pego = sel ? cena.achar(sel) : null;
  const diagonal = Math.hypot(caixaTotal.max[0] - caixaTotal.min[0], caixaTotal.max[1] - caixaTotal.min[1], caixaTotal.max[2] - caixaTotal.min[2]);

  return (
    <div
      className="visor3d"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && sel) selecionar(null);
      }}
      // O direito navega (ver `camera.tsx`): o menu do navegador não pode abrir no fim do arraste.
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        orthographic
        flat
        // Só o sol do Realista projeta sombra; nos outros estilos nenhuma luz a liga e o mapa nem é desenhado.
        shadows="percentage"
        frameloop="demand"
        camera={{ position: [20, -20, 17], zoom: 40, near: -5000, far: 5000, up: [0, 0, 1] }}
        gl={{ antialias: true, localClippingEnabled: true }}
        onCreated={(st) => {
          estado.current = st;
          // Bancada: o estado do palco à mão no console (medir quadro, ler a cena). Só no desenvolvimento.
          if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__visor3d = st;
        }}
      >
        <Fundo paleta={palco} liso={estilo === 'opaco'} />
        <Luzes estilo={estilo} caixa={caixaDaSombra} versao={versaoDaSombra} />
        <primitive object={cena.grupo} />
        <Terno haste={Math.min(2, Math.max(0.3, diagonal * 0.08))} paleta={palco} />
        {corte.ligado && <CorteNoPalco x={xCorte} caixa={caixaTotal} paleta={palco} aoMover={moverCorte} />}
        <OrbitControls
          makeDefault
          enableDamping={false}
          enableRotate={false}
          zoomSpeed={2}
          zoomToCursor
          minZoom={1}
          maxZoom={50000}
          // O direito também desloca: quem está no touchpad do notebook não tem botão do meio (o app é aberto
          // ao público). O direito não tem outro uso no visor, então não briga com o jeito do A-PORT.
          mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        />
        <OrbitaNoShift pivo={pivo} />
        <VooDaCamera voo={voo} />
        <EnquadrarAoAbrir cena={cena} voo={voo} />
        <CliqueDeSelecao cena={cena} aoPegar={selecionar} />
        <TracoPeloZoom cena={cena} />
        <AvisarOCubo cubo={invalidarCubo} />
      </Canvas>
      <div className="v3-overlay">
        {pego && <PainelDaPeca pego={pego} modelo={modelo} aoFechar={() => selecionar(null)} />}
        {armadura ? <LegendaDasBitolas diametros={diametros} /> : estilo === 'cores' && <LegendaDasCores classes={classes} />}
        <CuboDeVistas paleta={paleta} obterQuaternion={() => estado.current?.camera.quaternion ?? null} aoVoar={voar} registrar={registrarCubo} />
        <BarraDoVisor
          aoVista={(v: VistaNomeada) => voar(DIRECOES[v])}
          aoEnquadrar={() => voar(null)}
          ocultas={ocultas}
          presentes={presentes}
          aoAlternar={alternar}
          armadura={armadura}
          aoArmadura={() => setArmadura((a) => !a)}
          corte={corte.ligado}
          aoCorte={ligarCorte}
          aoFoto={fotografar}
          aoEnviarParaPrancha={enviarFoto}
          estilo={estilo}
          aoEstilo={escolherEstilo}
          extra={corte.ligado ? <ControleDoCorte x={xCorte} min={caixaTotal.min[0]} max={caixaTotal.max[0]} aoMudar={moverCorte} /> : null}
        />
      </div>
    </div>
  );
}
