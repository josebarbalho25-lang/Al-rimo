/*
  DESENHOS — as quatro pranchas do muro (vista frontal, corte, planta, isométrico), com zoom na roda do mouse
  (em torno do cursor, como no CAD), arrasto para mover e duplo clique para enquadrar.

  Dois jeitos de ligar:
  - `<Desenhos modelo={m} />`: as quatro pranchas com as próprias abas;
  - `<Desenhos modelo={m} vista="corte" />`: uma prancha só, sem abas — para o palco, que já tem uma aba para
    cada desenho (ui/Palco.tsx). Os controles da prancha (posição do corte, fiada, vista do isométrico) ficam.

  O zoom mexe só no viewBox: o desenho é vetor e não é refeito a cada giro da roda. O enquadramento volta sozinho
  quando muda a aba ou o muro; mexer no corte ou na fiada NÃO reenquadra — quem está olhando um detalhe e arrasta
  o corte quer continuar olhando o mesmo lugar.

  Seleção: cada traço leva o id da peça ou da barra do Modelo (data-id) — o mesmo id do 3D. Clique sem arrastar
  escolhe; a peça escolhida (no 3D ou aqui) acende em azul.

  TEMA ESCURO (14/10, Jose: todo SVG com fundo escuro no escuro): a folha NÃO passa pelo filtro de inversão; o papel e
  a tinta trocam por regra de CSS pelo valor que a prancha escreve (`.prancheta-cores`, estilo/componentes.css), e as
  cores das peças ficam as do Revit. Antes de 14/10 era papel branco nos dois temas (`.prancheta.prancheta-cores`).
  As outras pranchetas do app (figuras) invertem no escuro por filtro — invert + hue-rotate, receita do Pró-Viga —,
  mas aqui as peças vão pintadas com as cores do Jose no Revit (desenhos/cores.ts), que são código de obra: o
  filtro levava o amarelo da canaleta a verde-oliva escuro e o azul do meio bloco a azul-claro, e a legenda
  mentia. Desfazer o filtro só nas peças pintadas não fecha: o invert(0,88) não alcança as cores cheias (o
  vermelho do 54 não volta a ser #ff0000) e o hue-rotate do CSS é aproximado. Papel branco é também o que o
  Revit mostra numa folha, com o resto da tela escura em volta.

  Exportar (SVG e PNG) sai do SVG autorado, nunca da tela: as cores e a legenda vão iguais em qualquer tema,
  zoom ou seleção.
*/
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Modelo } from '@/modelo/tipos';
import { metros } from './formato';
import { desenharVistaFrontal } from './vistaFrontal';
import { cortesPadrao, desenharCorteLateral } from './corteLateral';
import { desenharPlanta } from './planta';
import { desenharIsometrico, type VistaIso } from './isometrico';
import type { Prancha } from './prancha';
import { enviarParaPrancha } from '@/pranchas/envio';
import { useGraficos } from './useGraficos';
import { MenuMostrar } from './MenuMostrar';
import type { PedidoDeVista } from '@/pranchas/tipos';

export type AbaDesenho = 'frontal' | 'corte' | 'planta' | 'iso';
type Caixa = [number, number, number, number];

const ABAS: [AbaDesenho, string][] = [
  ['frontal', 'Vista frontal'],
  ['corte', 'Corte'],
  ['planta', 'Planta'],
  ['iso', 'Isométrico'],
];

const VISTAS: [VistaIso, string][] = [
  ['frente-direita', 'Frente, pela direita'],
  ['frente-esquerda', 'Frente, pela esquerda'],
  ['fundo-direita', 'Fundo, pela direita'],
  ['fundo-esquerda', 'Fundo, pela esquerda'],
];

const NOME_DO_ARQUIVO: Record<AbaDesenho, string> = {
  frontal: 'vista-frontal',
  corte: 'corte',
  planta: 'planta',
  iso: 'isometrico',
};

/** Azul da seleção na folha (papel branco nos dois temas). */
const COR_SELECAO = '#0080ff';

const s = {
  raiz: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
    gap: 'var(--gap-1, 4px)', padding: 'var(--gap-2, 8px)',
  } as CSSProperties,
  barra: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--gap-2, 8px)',
    fontSize: 'var(--fs-rotulo, 12.5px)', color: 'var(--ink, inherit)', minHeight: 'var(--row, 26px)',
  } as CSSProperties,
  campo: { display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  rotulo: { color: 'var(--muted, #666)', whiteSpace: 'nowrap' } as CSSProperties,
  valor: { fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums', minWidth: 54 } as CSSProperties,
  lista: { width: 'auto' } as CSSProperties,
  // .cad-escolha reparte a largura por igual (flex 1 1 0); aqui cada botão fica do tamanho do nome
  botao: { flex: 'none', padding: '0 10px' } as CSSProperties,
  folha: {
    flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
    border: '1px solid var(--line-strong, #bbb)', borderRadius: 'var(--radius-sm, 2px)', touchAction: 'none',
  } as CSSProperties,
};

export interface PropsDesenhos {
  modelo: Modelo;
  /** Uma prancha só, sem as abas internas. */
  vista?: AbaDesenho;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
}

/** PNG com ~3000 px de largura (de 2 a 4× a prancha): dá para imprimir em A3 sem serrilhado. */
const LARGURA_DO_PNG = 3000;

/** Entrega um arquivo gerado na hora (o endereço temporário é liberado logo depois do clique). */
function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rasteriza o SVG da prancha (largura × altura em px de prancha) num PNG. */
async function pngDaPrancha(svg: string, w: number, h: number): Promise<Blob | null> {
  const k = Math.min(4, Math.max(2, LARGURA_DO_PNG / Math.max(1, w)));
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

export function Desenhos({ modelo, vista, selecionado = null, onSelecionar }: PropsDesenhos) {
  const [abaInterna, setAba] = useState<AbaDesenho>(vista ?? 'frontal');
  const aba = vista ?? abaInterna;
  const cortes = useMemo(() => cortesPadrao(modelo), [modelo]);
  const L = modelo.dims.L_real;
  const [xCorte, setXCorte] = useState<number | null>(null);      // null = o corte padrão (meio do painel)
  const [fiada, setFiada] = useState(0);
  const [vistaIso, setVistaIso] = useState<VistaIso>('frente-direita');
  const [isoCortado, setIsoCortado] = useState(false);
  const [xIso, setXIso] = useState<number | null>(null);

  const limitar = (x: number) => Math.min(L, Math.max(0, x));
  const xC = limitar(xCorte ?? cortes[0]?.x ?? L / 2);
  const xI = limitar(xIso ?? cortes[0]?.x ?? L / 2);
  const fiadaOk = Math.max(0, Math.min(modelo.dims.n_fiadas - 1, fiada));
  const enviar = () => {
    const pedido: PedidoDeVista =
      aba === 'corte' ? { tipo: 'corte', x: xC }
        : aba === 'planta' ? { tipo: 'planta', fiada: fiadaOk }
          : aba === 'iso' ? { tipo: 'iso', vista: vistaIso, corteX: isoCortado ? xI : null }
            : { tipo: 'frontal' };
    enviarParaPrancha({ tipo: 'vista', pedido });
  };

  // a tabela de gráficos (cores, hachuras e o que aparece em cada vista — 15/10) refaz o desenho quando muda
  const graficosEmUso = useGraficos((st) => st.dados);
  const prancha: Prancha = useMemo(() => {
    switch (aba) {
      case 'corte': return desenharCorteLateral(modelo, xC);
      case 'planta': return desenharPlanta(modelo, fiadaOk);
      case 'iso': return desenharIsometrico(modelo, { vista: vistaIso, corteX: isoCortado ? xI : null });
      default: return desenharVistaFrontal(modelo);
    }
  }, [aba, modelo, xC, fiadaOk, vistaIso, isoCortado, xI, graficosEmUso]);
  const partes = useMemo(() => prancha.partes(), [prancha]);

  // ── enquadramento, zoom e arrasto ─────────────────────────────────────────────────────────────────────────────
  const [vb, setVb] = useState<Caixa>(partes.viewBox);
  const enquadrado = useRef<Caixa>(partes.viewBox);
  enquadrado.current = partes.viewBox;
  const enquadrar = useCallback(() => setVb(enquadrado.current), []);
  useEffect(enquadrar, [aba, modelo, enquadrar]);

  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // ouvinte nativo e não passivo: o onWheel do React é passivo e não consegue impedir a rolagem da página
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const m = el.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const f = Math.exp(e.deltaY * 0.0015);
      setVb(([x, y, w, h]) => {
        const larguraCheia = enquadrado.current[2];
        const w2 = Math.min(larguraCheia * 8, Math.max(larguraCheia / 60, w * f));
        const k = w2 / w;
        return [p.x - (p.x - x) * k, p.y - (p.y - y) * k, w * k, h * k];
      });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  const arrasto = useRef<{ x: number; y: number; vb: Caixa; k: number; andou: boolean } | null>(null);
  const aoApertar = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    // unidades do desenho por pixel de tela, com o "meet" (o lado que manda é o mais apertado)
    const k = Math.max(vb[2] / Math.max(1, r.width), vb[3] / Math.max(1, r.height));
    arrasto.current = { x: e.clientX, y: e.clientY, vb, k, andou: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrasto.current;
    if (!a) return;
    // tremida de mão no clique não é arrasto: abaixo de 4 px a folha não se mexe e o clique escolhe a peça
    if (!a.andou && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 4) return;
    a.andou = true;
    const [x, y, w, h] = a.vb;
    setVb([x - (e.clientX - a.x) * a.k, y - (e.clientY - a.y) * a.k, w, h]);
  };
  const aoSoltar = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrasto.current;
    arrasto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!a || a.andou || e.button !== 0 || !onSelecionar) return;
    // com a captura do ponteiro o alvo do evento é o próprio <svg>: o traço clicado vem do ponto da tela
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]');
    onSelecionar(alvo && svgRef.current?.contains(alvo) ? alvo.getAttribute('data-id') : null);
  };

  const baixarSvg = () => baixar(new Blob([prancha.svg()], { type: 'image/svg+xml' }), `al-rimo-${NOME_DO_ARQUIVO[aba]}.svg`);
  const baixarPng = async () => {
    // o tamanho é o do viewBox que o svg() escreve (mesma margem padrão de partes())
    const [, , w, h] = partes.viewBox;
    const png = await pngDaPrancha(prancha.svg(), w, h).catch(() => null);
    if (png) baixar(png, `al-rimo-${NOME_DO_ARQUIVO[aba]}.png`);
  };

  // seleção: regra de estilo dentro do próprio SVG (o desenho não é refeito quando a seleção muda). <style> em
  // SVG embutido vale para a página toda: o seletor fica preso a esta folha
  const realce = selecionado
    ? `<style>[data-frente="desenhos"] [data-id="${selecionado.replace(/["\\]/g, '\\$&')}"]{stroke:${COR_SELECAO};stroke-width:2.5px;` +
      `vector-effect:non-scaling-stroke;stroke-dasharray:none}</style>`
    : '';
  const conteudo = useMemo(() => `<defs>${partes.defs}</defs>${partes.corpo}`, [partes]);

  const passo = Math.max(5, modelo.familia.m / 4);
  const deslizante = (valor: number, mudar: (x: number) => void) => (
    <input type="range" min={0} max={L} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} style={{ width: 160 }} />
  );
  const corteEscolhido = cortes.find((c) => Math.abs(c.x - xC) < 0.5);

  return (
    <div style={s.raiz} data-frente="desenhos">
      <div style={s.barra}>
        {!vista && (
          <div className="cad-escolha" role="tablist">
            {ABAS.map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : undefined} style={s.botao} onClick={() => setAba(id)}>
                {nome}
              </button>
            ))}
          </div>
        )}

        {aba === 'corte' && (
          <>
            <label style={s.campo}>
              <span style={s.rotulo}>Posição</span>
              <select className="campo" style={s.lista} value={corteEscolhido ? String(corteEscolhido.x) : ''}
                onChange={(e) => e.target.value && setXCorte(Number(e.target.value))}>
                {!corteEscolhido && <option value="">—</option>}
                {cortes.map((c) => <option key={c.rotulo} value={String(c.x)}>{c.rotulo}</option>)}
              </select>
            </label>
            <label style={s.campo}>
              <span style={s.rotulo}>x</span>
              {deslizante(xC, setXCorte)}
              <span style={s.valor}>{metros(xC)} m</span>
            </label>
          </>
        )}

        {aba === 'planta' && (
          <label style={s.campo}>
            <span style={s.rotulo}>Fiada</span>
            <select className="campo" style={s.lista} value={fiadaOk} onChange={(e) => setFiada(Number(e.target.value))}>
              {Array.from({ length: modelo.dims.n_fiadas }, (_, i) => <option key={i} value={i}>{i + 1}ª</option>)}
            </select>
          </label>
        )}

        {aba === 'iso' && (
          <>
            <label style={s.campo}>
              <span style={s.rotulo}>Vista</span>
              <select className="campo" style={s.lista} value={vistaIso} onChange={(e) => setVistaIso(e.target.value as VistaIso)}>
                {VISTAS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label style={s.campo}>
              <input type="checkbox" checked={isoCortado} onChange={(e) => setIsoCortado(e.target.checked)} />
              <span style={s.rotulo}>Corte</span>
            </label>
            {isoCortado && (
              <label style={s.campo}>
                <span style={s.rotulo}>x</span>
                {deslizante(xI, setXIso)}
                <span style={s.valor}>{metros(xI)} m</span>
              </label>
            )}
          </>
        )}

        <span style={{ flex: 1 }} />
        <div className="cad-escolha">
          <MenuMostrar vista={aba} estiloDoBotao={s.botao} />
          <button type="button" style={s.botao} onClick={enquadrar}>Enquadrar</button>
          <button type="button" style={s.botao} onClick={baixarSvg}>SVG</button>
          <button type="button" style={s.botao} onClick={baixarPng}>PNG</button>
          {/* a vista como está na tela (o corte nesta posição, esta fiada, este lado do isométrico) vai para a folha
              ativa da aba Pranchas, na escala de partida dela */}
          <button type="button" style={s.botao} onClick={enviar} title="Enviar para a prancha">Prancha</button>
        </div>
      </div>

      <div className="prancheta prancheta-cores" style={s.folha}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={vb.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
          onPointerDown={aoApertar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onDoubleClick={enquadrar}
          dangerouslySetInnerHTML={{ __html: realce + conteudo }}
        />
      </div>
    </div>
  );
}
