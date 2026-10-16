/*
  DESENHOS — as vistas 2D do muro (vista frontal, corte, planta, isométrico, armação da sapata), com zoom na roda do
  mouse (em torno do cursor, como no CAD), arrasto para mover e duplo clique para enquadrar.

  VISTAS COMO NO REVIT (Jose, 16/10): cada aba mostra a VISTA escolhida na lista daquele tipo ("Corte A", "Frontal –
  graute"…). A vista é guardada no muro (pranchas/vistas.ts): o lugar do corte, a fiada, o lado do isométrico, a
  escala e as anotações dela. O desenho da aba é o MESMO da folha, na escala da vista (o que se vê aqui é o que vai
  para a prancha). "Nova vista" parte da pré-definida; "Duplicar" copia esta, anotações junto — outra visualização
  ("Frontal – graute", "Frontal – armadura"). Uma vista vai numa folha só; tirar da folha não apaga a vista.

  Dois jeitos de ligar:
  - `<Desenhos modelo={m} />`: as abas internas;
  - `<Desenhos modelo={m} vista="corte" />`: um tipo só, sem abas — para o palco, que já tem uma aba para cada
    desenho (ui/Palco.tsx).

  O zoom mexe só no viewBox: o desenho é vetor e não é refeito a cada giro da roda. O enquadramento volta sozinho
  quando muda a aba, a vista ou o muro; mexer no corte ou na fiada NÃO reenquadra — quem está olhando um detalhe e
  arrasta o corte quer continuar olhando o mesmo lugar.

  Seleção: cada traço leva o id da peça ou da barra do Modelo (data-id) — o mesmo id do 3D. Clique sem arrastar
  escolhe; a peça escolhida (no 3D ou aqui) acende em azul.

  ANOTAR NA ABA (Jose, 16/10: "liberar de fato essas manipulações nas abas"): a mesma edição da folha
  (pranchas/EdicaoDeAnotacoes.tsx) numa camada por cima do desenho — clicar e arrastar cota, texto e chamada, duplo
  clique reescreve, Delete esconde ou apaga, Cota (D) e Texto (T). O que se mexe é a VISTA: a folha mostra igual.

  TEMA ESCURO (14/10, Jose: todo SVG com fundo escuro no escuro): a folha NÃO passa pelo filtro de inversão; o papel e
  a tinta trocam por regra de CSS pelo valor que a prancha escreve (`.prancheta-cores`, estilo/componentes.css), e as
  cores das peças ficam as do Revit (o filtro levava o amarelo da canaleta a verde-oliva e a legenda mentia).

  Exportar (SVG e PNG) sai do SVG autorado, nunca da tela: as cores e a legenda vão iguais em qualquer tema, zoom ou
  seleção.
*/
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Modelo } from '@/modelo/tipos';
import { metros } from './formato';
import { cortesPadrao } from './corteLateral';
import type { VistaIso } from './isometrico';
import { vistaParaPrancha } from './paraPrancha';
import { enviarParaPrancha } from '@/pranchas/envio';
import { useGraficos } from './useGraficos';
import { comItemDaVista } from './graficos';
import { MenuMostrar } from './MenuMostrar';
import { useJanelaDeGraficos } from './useJanelaDeGraficos';
import { useApp } from '@/estado/store';
import { usePranchasUi } from '@/pranchas/ui';
import { ESCALAS, rotuloDaEscala } from '@/pranchas/formatos';
import { PX_POR_MM, type PedidoDeVista, type VistaDoProjeto, type VistaParaPrancha } from '@/pranchas/tipos';
import { duplicarVista, excluirVista, itemDaVista, naVistaComoItem, naVistaDoProjeto, novaVista, ondeEstaAVista, renomearVista, vistasDoTipo } from '@/pranchas/vistas';
import { posicionarVetor, type ItemPosto } from '@/pranchas/folha';
import { barraNaTela, useEdicaoDeAnotacoes, type DesenhoEditavel } from '@/pranchas/EdicaoDeAnotacoes';

export type AbaDesenho = PedidoDeVista['tipo'];
type Caixa = [number, number, number, number];

const ABAS: [AbaDesenho, string][] = [
  ['frontal', 'Vista frontal'],
  ['corte', 'Corte'],
  ['planta', 'Planta'],
  ['iso', 'Isométrico'],
  ['armacao', 'Armação da sapata'],
];

const VISTAS_ISO: [VistaIso, string][] = [
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
  armacao: 'armacao-da-sapata',
};

/** Azul da seleção na folha (papel branco nos dois temas). */
const COR_SELECAO = '#0080ff';
/** mm de papel por px de desenho: a aba mostra a vista como ela sai na folha (a mesma conta de folha.ts). */
const K = 1 / PX_POR_MM;
/** Margem em volta do desenho na aba, mm de papel. */
const MARGEM = 6;
/** Valor do item "Nova vista" na lista (não é id de vista). */
const NOVA = '\u0000nova';

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
  nomeDaVista: { width: 200 } as CSSProperties,
  // .cad-escolha reparte a largura por igual (flex 1 1 0); aqui cada botão fica do tamanho do nome
  botao: { flex: 'none', padding: '0 10px' } as CSSProperties,
  folha: {
    flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', outline: 'none',
    border: '1px solid var(--line-strong, #bbb)', borderRadius: 'var(--radius-sm, 2px)', touchAction: 'none',
  } as CSSProperties,
  camada: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' } as CSSProperties,
  // o quadrinho do que está escolhido (a cota, o texto, a chamada), no canto, por cima do desenho
  painel: {
    position: 'absolute', top: 8, right: 8, zIndex: 3, width: 270, padding: '2px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6,
    background: 'var(--surface, #fff)', color: 'var(--ink, #222)', border: '1px solid var(--line-strong, #bbb)', borderRadius: 6,
    boxShadow: '0 4px 14px rgba(0,0,0,0.18)', fontSize: 'var(--fs-rotulo, 12.5px)',
  } as CSSProperties,
};

export interface PropsDesenhos {
  modelo: Modelo;
  /** Um tipo só, sem as abas internas. */
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

/** Rasteriza o SVG (largura × altura em px de desenho) num PNG. */
async function pngDoSvg(svg: string, w: number, h: number): Promise<Blob | null> {
  const k = Math.min(4, Math.max(2, LARGURA_DO_PNG / Math.max(1, w)));
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

/** O SVG da vista sozinha, em px de desenho, com uma margem (o que se exporta). */
function svgDaVista(d: VistaParaPrancha): { svg: string; w: number; h: number } {
  const [x, y, w, h] = d.caixa;
  const m = MARGEM / K;
  const vb = [x - m, y - m, w + 2 * m, h + 2 * m];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">` +
    `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#ffffff"/><defs>${d.defs}</defs>${d.corpo}</svg>`;
  return { svg, w: vb[2], h: vb[3] };
}

/** A vista na escala dela, como sai na folha (o isométrico na letra de 1:50, como a folha faz). */
function desenhoDaVista(m: Modelo, v: VistaDoProjeto): VistaParaPrancha | null {
  const c = v.conteudo;
  if (c.tipo === '3d') return null;
  try {
    return vistaParaPrancha(m, c, v.escala ?? 50, 'des', { legendaDeCores: true, chamadas: v.chamadas, anotacoes: v.anotacoes, cotas: v.cotas, textos: v.textos, etiquetas: v.etiquetas, graficos: v.graficos });
  } catch {
    return null;
  }
}

export function Desenhos({ modelo, vista: tipoFixo, selecionado = null, onSelecionar }: PropsDesenhos) {
  const [abaInterna, setAba] = useState<AbaDesenho>(tipoFixo ?? 'frontal');
  const aba = tipoFixo ?? abaInterna;
  const pranchas = useApp((st) => st.pranchas);
  const mudarPranchas = useApp((st) => st.mudarPranchas);
  const dizer = useApp((st) => st.dizer);
  const idEscolhida = usePranchasUi((st) => st.vistaAtiva[aba]);
  const escolher = usePranchasUi((st) => st.escolherVista);

  const vistas = useMemo(() => vistasDoTipo(pranchas, aba), [pranchas, aba]);
  const vista = vistas.find((v) => v.id === idEscolhida) ?? vistas[0];
  const mudarVista = (f: (v: VistaDoProjeto) => VistaDoProjeto) => mudarPranchas((p) => naVistaDoProjeto(p, vista.id, f));
  const mudarConteudo = <T extends PedidoDeVista>(f: (c: T) => T) =>
    mudarVista((v) => ({ ...v, conteudo: f(v.conteudo as T) }));
  const onde = useCallback((id: string) => ondeEstaAVista(pranchas, id), [pranchas]);

  // ── a lista das vistas ────────────────────────────────────────────────────
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const criarNova = () => {
    const r = novaVista(pranchas, aba);
    mudarPranchas(() => r.pranchas);
    escolher(aba, r.vista.id);
  };
  const duplicar = () => {
    const r = duplicarVista(pranchas, vista.id);
    if (!r) return;
    mudarPranchas(() => r.pranchas);
    escolher(aba, r.vista.id);
  };
  const confirmarNome = () => {
    if (renomeando !== null && renomeando.trim() && renomeando.trim() !== vista.nome) mudarPranchas((p) => renomearVista(p, vista.id, renomeando));
    setRenomeando(null);
  };
  // a de fábrica que ninguém gravou não se exclui (ela é o que a aba mostra quando o tipo não tem vista)
  const gravada = pranchas.vistas.some((v) => v.id === vista.id);
  const excluir = () => {
    const ja = onde(vista.id);
    const aviso = ja ? ` Ela sai da folha ${String(ja.numero).padStart(2, '0')}.` : '';
    if (!window.confirm(`Excluir a vista "${vista.nome}"?${aviso}`)) return;
    mudarPranchas((p) => excluirVista(p, vista.id));
    const resto = vistas.filter((v) => v.id !== vista.id);
    if (resto[0]) escolher(aba, resto[0].id);
  };

  // ── os parâmetros da vista (o corte, a fiada, o lado do isométrico) ────────
  const cortes = useMemo(() => cortesPadrao(modelo), [modelo]);
  const L = modelo.dims.L_real;
  const limitar = (x: number) => Math.min(L, Math.max(0, x));
  const c = vista.conteudo;
  const xC = c.tipo === 'corte' ? limitar(c.x ?? cortes[0]?.x ?? L / 2) : 0;
  const fiada = c.tipo === 'planta' ? Math.max(0, Math.min(modelo.dims.n_fiadas - 1, c.fiada)) : 0;
  const isoCortado = c.tipo === 'iso' && c.corteX != null;
  const xI = c.tipo === 'iso' ? limitar(c.corteX ?? cortes[0]?.x ?? L / 2) : 0;

  const enviar = () => enviarParaPrancha({ tipo: 'vista', id: vista.id });

  // a tabela de gráficos (cores, hachuras e o que aparece em cada vista — 15/10) refaz o desenho quando muda
  const graficosEmUso = useGraficos((st) => st.dados);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const desenho = useMemo(() => desenhoDaVista(modelo, vista), [modelo, vista, graficosEmUso]);
  const caixaMm: Caixa = useMemo(() => {
    if (!desenho) return [0, 0, 100, 60];
    const [x, y, w, h] = desenho.caixa;
    return [x * K - MARGEM, y * K - MARGEM, w * K + 2 * MARGEM, h * K + 2 * MARGEM];
  }, [desenho]);

  // ── a edição das anotações (a mesma da folha) ─────────────────────────────
  // O desenho posto com o canto da referência no próprio lugar (origem 0, k = mm por px): a camada da edição fala
  // em mm de papel, como na folha
  const posto = useMemo(() => {
    if (!desenho) return null;
    const [rx, ry] = desenho.referencia ?? desenho.caixa;
    const pos = posicionarVetor({ x: rx * K, y: ry * K }, desenho, K);
    const p: ItemPosto = {
      id: vista.id, caixa: caixaMm, titulo: null, pendente: false, invade: false, origem: pos.origem, k: K, prims: [0, pos.primitivas.length],
    };
    if (desenho.S) p.S = desenho.S;
    if (pos.anotacoes?.length) p.anotacoes = pos.anotacoes;
    if (pos.chamadas?.length) p.chamadas = pos.chamadas;
    if (pos.regioes?.length) p.regioes = pos.regioes;
    return { posto: p, primitivas: pos.primitivas, svg: pos.svg };
  }, [desenho, vista.id, caixaMm]);
  const desenhos = useMemo<DesenhoEditavel[]>(() => (posto ? [{ posto: posto.posto, item: itemDaVista(vista), primitivas: posto.primitivas }] : []), [posto, vista]);
  const folhaRef = useRef<HTMLDivElement>(null);
  const capaRef = useRef<SVGSVGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pontoNaCamada = (e: { clientX: number; clientY: number }): [number, number] => {
    const m = capaRef.current?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  // o tamanho da área do desenho na tela: as folgas do clique e da captura são em px de tela
  const [tela, setTela] = useState<[number, number]>([800, 500]);
  useEffect(() => {
    const el = folhaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTela([Math.max(1, el.clientWidth), Math.max(1, el.clientHeight)]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── enquadramento, zoom e arrasto ─────────────────────────────────────────────────────────────────────────────
  const [vb, setVb] = useState<Caixa>(caixaMm);
  const enquadrado = useRef<Caixa>(caixaMm);
  enquadrado.current = caixaMm;
  const enquadrar = useCallback(() => setVb(enquadrado.current), []);
  useEffect(enquadrar, [aba, vista.id, vista.escala, modelo, enquadrar]);

  const edicao = useEdicaoDeAnotacoes({
    desenhos,
    mudarItem: (id, f) => mudarPranchas((p) => naVistaComoItem(p, id, f)),
    // mm de papel por px de tela, com o "meet" (o lado que manda é o mais apertado)
    mmPorPx: Math.max(vb[2] / tela[0], vb[3] / tela[1]),
    ponto: pontoNaCamada,
    naTela: (p) => {
      const m = capaRef.current?.getScreenCTM();
      if (!m) return null;
      const q = new DOMPoint(p[0], p[1]).matrixTransform(m);
      return [q.x, q.y];
    },
    focar: () => folhaRef.current?.focus({ preventScroll: true }),
    temFoco: () => !!folhaRef.current && document.activeElement === folhaRef.current,
    barraEm: (e) => barraNaTela(e, svgRef.current, modelo),
  });
  // trocar de vista ou de aba larga a ferramenta e a seleção da outra (a edição faz isso sozinha quando o desenho
  // muda) — sem puxar o foco: a aba monta quando o último dado que faltava é digitado, e o foco roubado engolia o
  // resto do número
  // outro muro aberto: a vista de fábrica tem o mesmo id em todo muro, então a edição não percebe a troca — a seleção do
  // muro de antes sai aqui (um Delete nela esconderia uma cota do muro recém-aberto)
  const carregamento = useApp((st) => st.carregamento);
  useEffect(() => edicao.limpar(), [carregamento]); // eslint-disable-line react-hooks/exhaustive-deps
  // o teclado da edição (Esc, D, T, Delete) — só a aba que está na tela responde
  const teclar = useRef<(e: KeyboardEvent) => void>(() => undefined);
  teclar.current = (e) => {
    if (!folhaRef.current?.offsetParent) return;
    edicao.teclar(e);
  };
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => teclar.current(e);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    const el = folhaRef.current;
    if (!el) return;
    // ouvinte nativo e não passivo: o onWheel do React é passivo e não consegue impedir a rolagem da página
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const m = capaRef.current?.getScreenCTM();
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
  const aoApertar = (e: PointerEvent<HTMLDivElement>) => {
    folhaRef.current?.focus({ preventScroll: true });
    if (e.button !== 0 && e.button !== 1) return;
    // clique no vazio larga a anotação escolhida (a cota, o texto, a chamada); arrastar move a folha
    if (e.button === 0) edicao.limpar();
    const k = Math.max(vb[2] / tela[0], vb[3] / tela[1]);
    arrasto.current = { x: e.clientX, y: e.clientY, vb, k, andou: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: PointerEvent<HTMLDivElement>) => {
    edicao.mover(e);
    const a = arrasto.current;
    if (!a) return;
    // tremida de mão no clique não é arrasto: abaixo de 4 px a folha não se mexe e o clique escolhe a peça
    if (!a.andou && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 4) return;
    a.andou = true;
    const [x, y, w, h] = a.vb;
    setVb([x - (e.clientX - a.x) * a.k, y - (e.clientY - a.y) * a.k, w, h]);
  };
  const aoSoltar = (e: PointerEvent<HTMLDivElement>) => {
    edicao.soltar();
    const a = arrasto.current;
    arrasto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!a || a.andou || e.button !== 0 || !onSelecionar) return;
    // com a captura do ponteiro o alvo do evento é a área: o traço clicado vem do ponto da tela
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-id]');
    onSelecionar(alvo && svgRef.current?.contains(alvo) ? alvo.getAttribute('data-id') : null);
  };

  const baixarSvg = () => {
    if (!desenho) return;
    baixar(new Blob([svgDaVista(desenho).svg], { type: 'image/svg+xml' }), `al-rimo-${NOME_DO_ARQUIVO[aba]}.svg`);
  };
  const baixarPng = async () => {
    if (!desenho) return;
    const { svg, w, h } = svgDaVista(desenho);
    const png = await pngDoSvg(svg, w, h).catch(() => null);
    if (png) baixar(png, `al-rimo-${NOME_DO_ARQUIVO[aba]}.png`);
    else dizer('Não deu para gerar o PNG');
  };

  // seleção: regra de estilo dentro do próprio SVG (o desenho não é refeito quando a seleção muda). <style> em
  // SVG embutido vale para a página toda: o seletor fica preso a esta folha
  const realce = selecionado
    ? `<style>[data-frente="desenhos"] [data-id="${selecionado.replace(/["\\]/g, '\\$&')}"]{stroke:${COR_SELECAO};stroke-width:2.5px;` +
      `vector-effect:non-scaling-stroke;stroke-dasharray:none}</style>`
    : '';
  const conteudo = useMemo(() => (desenho && posto ? `<defs>${desenho.defs}</defs>${posto.svg}` : ''), [desenho, posto]);

  const passo = Math.max(5, modelo.familia.m / 4);
  const deslizante = (valor: number, mudar: (x: number) => void) => (
    <input type="range" min={0} max={L} step={passo} value={valor} onChange={(e) => mudar(Number(e.target.value))} style={{ width: 160 }} />
  );
  const corteEscolhido = cortes.find((q) => Math.abs(q.x - xC) < 0.5);
  const naFolha = onde(vista.id);

  return (
    <div style={s.raiz} data-frente="desenhos">
      <div style={s.barra}>
        {!tipoFixo && (
          <div className="cad-escolha" role="tablist">
            {ABAS.map(([id, nome]) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : undefined} style={s.botao} onClick={() => setAba(id)}>
                {nome}
              </button>
            ))}
          </div>
        )}

        <label style={s.campo}>
          <span style={s.rotulo}>Vista</span>
          {renomeando !== null ? (
            <input
              className="campo" style={s.nomeDaVista} autoFocus aria-label="Nome da vista" value={renomeando}
              onChange={(e) => setRenomeando(e.target.value)}
              onBlur={confirmarNome}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarNome();
                if (e.key === 'Escape') setRenomeando(null);
              }}
            />
          ) : (
            <select
              className="campo" style={s.lista} value={vista.id} aria-label="Vista"
              onChange={(e) => (e.target.value === NOVA ? criarNova() : escolher(aba, e.target.value))}
            >
              {vistas.map((v) => {
                const ja = onde(v.id);
                return <option key={v.id} value={v.id}>{v.nome}{ja ? ` · folha ${String(ja.numero).padStart(2, '0')}` : ''}</option>;
              })}
              <option value={NOVA}>Nova vista</option>
            </select>
          )}
        </label>
        <div className="cad-escolha">
          <button type="button" style={s.botao} onClick={duplicar}>Duplicar</button>
          <button type="button" style={s.botao} onClick={() => setRenomeando(vista.nome)}>Renomear</button>
          <button type="button" style={s.botao} onClick={excluir} disabled={!gravada}>Excluir</button>
        </div>

        {c.tipo === 'corte' && (
          <>
            <label style={s.campo}>
              <span style={s.rotulo}>Posição</span>
              <select className="campo" style={s.lista} value={corteEscolhido ? String(corteEscolhido.x) : ''}
                onChange={(e) => e.target.value && mudarConteudo<Extract<PedidoDeVista, { tipo: 'corte' }>>((q) => ({ ...q, x: Number(e.target.value) }))}>
                {!corteEscolhido && <option value="">—</option>}
                {cortes.map((q) => <option key={q.rotulo} value={String(q.x)}>{q.rotulo}</option>)}
              </select>
            </label>
            <label style={s.campo}>
              <span style={s.rotulo}>x</span>
              {deslizante(xC, (x) => mudarConteudo<Extract<PedidoDeVista, { tipo: 'corte' }>>((q) => ({ ...q, x })))}
              <span style={s.valor}>{metros(xC)} m</span>
            </label>
          </>
        )}

        {c.tipo === 'planta' && (
          <label style={s.campo}>
            <span style={s.rotulo}>Fiada</span>
            <select className="campo" style={s.lista} value={fiada}
              onChange={(e) => mudarConteudo<Extract<PedidoDeVista, { tipo: 'planta' }>>((q) => ({ ...q, fiada: Number(e.target.value) }))}>
              {Array.from({ length: modelo.dims.n_fiadas }, (_, i) => <option key={i} value={i}>{`${i + 1}ª`}</option>)}
            </select>
          </label>
        )}

        {c.tipo === 'iso' && (
          <>
            <label style={s.campo}>
              <span style={s.rotulo}>Lado</span>
              <select className="campo" style={s.lista} value={c.vista ?? 'frente-direita'}
                onChange={(e) => mudarConteudo<Extract<PedidoDeVista, { tipo: 'iso' }>>((q) => ({ ...q, vista: e.target.value as VistaIso }))}>
                {VISTAS_ISO.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label style={s.campo}>
              <input type="checkbox" checked={isoCortado}
                onChange={(e) => mudarConteudo<Extract<PedidoDeVista, { tipo: 'iso' }>>((q) => ({ ...q, corteX: e.target.checked ? xI : null }))} />
              <span style={s.rotulo}>Corte</span>
            </label>
            {isoCortado && (
              <label style={s.campo}>
                <span style={s.rotulo}>x</span>
                {deslizante(xI, (x) => mudarConteudo<Extract<PedidoDeVista, { tipo: 'iso' }>>((q) => ({ ...q, corteX: x })))}
                <span style={s.valor}>{metros(xI)} m</span>
              </label>
            )}
          </>
        )}

        {vista.escala !== null && (
          <label style={s.campo}>
            <span style={s.rotulo}>Escala</span>
            <select className="campo" style={s.lista} value={String(vista.escala)} onChange={(e) => mudarVista((v) => ({ ...v, escala: Number(e.target.value) }))}>
              {ESCALAS.map((x) => <option key={x} value={x}>{rotuloDaEscala(x)}</option>)}
            </select>
          </label>
        )}

        <span style={{ flex: 1 }} />
        {edicao.dica && <span style={s.rotulo} data-dica-da-ferramenta>{edicao.dica}</span>}
        {/* o isométrico não tem escala: nada para cotar nele */}
        <div className="cad-escolha">
          <button type="button" style={s.botao} className={edicao.ferramenta === 'cota' ? 'on' : undefined} disabled={!edicao.podeAnotar} title="Cota  ·  D" onClick={() => edicao.armar(edicao.ferramenta === 'cota' ? null : 'cota')}>Cota</button>
          <button type="button" style={s.botao} className={edicao.ferramenta === 'texto' ? 'on' : undefined} disabled={!edicao.podeAnotar} title="Texto  ·  T" onClick={() => edicao.armar(edicao.ferramenta === 'texto' ? null : 'texto')}>Texto</button>
          <button type="button" style={s.botao} className={edicao.ferramenta === 'etiqueta' ? 'on' : undefined} disabled={!edicao.podeEtiquetar} title="Etiqueta  ·  I" onClick={() => edicao.armar(edicao.ferramenta === 'etiqueta' ? null : 'etiqueta')}>Etiqueta</button>
        </div>
        <div className="cad-escolha">
          <MenuMostrar
            vista={aba} estiloDoBotao={s.botao} ocultos={vista.graficos?.ocultos ?? []}
            aoMudar={(item, mostra) => mudarVista((v) => ({ ...v, graficos: comItemDaVista(v.graficos, item, mostra) }))}
          />
          {/* a sobreposição de gráficos DESTA vista (a geral fica na engrenagem) */}
          <button type="button" style={s.botao} onClick={() => useJanelaDeGraficos.getState().abrir({ tipo: 'vista', id: vista.id, tipoDaVista: aba })}>Gráficos</button>
          <button type="button" style={s.botao} onClick={enquadrar}>Enquadrar</button>
          <button type="button" style={s.botao} onClick={baixarSvg} disabled={!desenho}>SVG</button>
          <button type="button" style={s.botao} onClick={baixarPng} disabled={!desenho}>PNG</button>
          {/* a vista vai para a folha ativa da aba Pranchas — uma vez: já colocada, a barra diz em qual folha está */}
          <button type="button" style={s.botao} onClick={enviar} title={naFolha ? `Na folha ${String(naFolha.numero).padStart(2, '0')}` : 'Enviar para a prancha'}>
            Prancha
          </button>
        </div>
      </div>

      <div
        ref={folhaRef} className="prancheta prancheta-cores" style={s.folha} tabIndex={0}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onDoubleClick={enquadrar}
      >
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={vb.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          style={{ ...s.camada, cursor: 'grab' }}
          dangerouslySetInnerHTML={{ __html: realce + conteudo }}
        />
        {/* a camada da edição: só o que se pega (cota, texto, chamada) recebe o clique; o resto passa para o desenho */}
        <svg
          ref={capaRef}
          viewBox={vb.join(' ')}
          preserveAspectRatio="xMidYMid meet"
          style={{ ...s.camada, pointerEvents: 'none', overflow: 'visible' }}
          onPointerDown={(e) => { edicao.apertarComFerramenta(e); }}
        >
          {edicao.camada}
        </svg>
        {edicao.temPainel && (
          <div style={s.painel} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {edicao.painel}
          </div>
        )}
      </div>
    </div>
  );
}
