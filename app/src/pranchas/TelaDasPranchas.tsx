// ═══════════════════════════════════════════════════════════════════════════
//  pranchas/TelaDasPranchas.tsx — a aba Pranchas
// ---------------------------------------------------------------------------
//  Jose, 14/10: "prancha pronta de uma forma bem intuitiva e prática". À
//  esquerda as folhas (01, 02…) e o painel do que está selecionado (folha,
//  desenho, carimbo, quadro lateral); no meio a folha de papel, na mesa cinza.
//  O desenho se ARRASTA pela folha; o 3D e o isométrico (sem escala), o
//  carimbo e o quadro lateral se REDIMENSIONAM pela alça. Durante o arrasto só
//  a moldura azul se move — o papel se recompõe ao soltar (redesenhar a folha
//  a cada passo do mouse travaria a tela num A0 cheio).
//
//  Painel = rótulo + valor + controle, sem texto explicativo (regra do Jose).
//
//  ENTRAR NO DESENHO (Jose, 16/10: "1 clique só seleciona o desenho pra
//  posicionar ele; pra entrar e editar de verdade o que tem nele direto na
//  prancha tem de dar duplo clique e entrar nele, aí os outros desenhos ficam
//  mais clarinhos e o destaque vai pra quem está sendo editado"). Dentro do
//  desenho vale a MESMA edição da aba de desenho (EdicaoDeAnotacoes.tsx):
//  cotas, textos e chamadas — e o que se mexe aqui é a VISTA (vistas.ts), a
//  mesma que a aba mostra. Esc, duplo clique fora ou "Sair" saem do desenho.
//  Duplo clique no título reescreve o título no lugar.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { useApp } from '@/estado/store';
import { ruim } from '@/estado/recadoRuim';
import { nomeDeArquivo } from '@/estado/projeto';
import { comporFolha, numeroDoItem, ondeVaiOTitulo, type ChamadaNaFolha, type ContextoDaFolha, type FolhaComposta, type ItemPosto } from './folha';
import { cantosDoTexto } from '@/desenhos/chamadas';
import { CARIMBO_MIN, ESCALAS, LETRA, ORDEM_DOS_FORMATOS, quadroLateralPadrao, quadroUtil, rotuloDaEscala, tamanhoDaFolha } from './formatos';
import { encaixar } from './encaixe';
import { novaFolha } from './padrao';
import { dentroDaFolha, folhaAtiva, itemDaTabela, naAnotacao, naChamada, naFolha, noItem, NOMES_DO_CONTEUDO, numeroLivre, porNaFolha, porVistaNaFolha } from './acoes';
import { AZUL, barraNaTela, teclaDeCampo, useEdicaoDeAnotacoes, type DesenhoEditavel } from './EdicaoDeAnotacoes';
import { estiloDosCampos, Linha, Numero, Texto, TextoConfirmado } from './campos';
import { TIPOS_2D, acharVista, excluirVista, novaVista, ondeEstaAVista, pranchasComVistas, renomearVista, vistasDoTipo } from './vistas';
import type { IdDaTabela } from './tabelaDaFolha';
import { usePranchasUi } from './ui';
import { useGraficos } from '@/desenhos/useGraficos';
import { naVista, type TipoDeVista } from '@/desenhos/graficos';
import { useJanelaDeGraficos } from '@/desenhos/useJanelaDeGraficos';
import { legendaDasCores, listaDeFerrosDaFolha, notasAutomaticas, quadroDeAco } from './quadro';
import { criarDesenhista, type Desenhista } from './desenhista';
import { logoEmPng, useEscritorio } from './escritorio';
import { imprimirPranchas } from './pdf';
import { pacoteDxf } from './dxf';
import type { ConteudoDoItem, DadosDaObra, Folha, Formato, ItemDaFolha, Orientacao, PedidoDeVista, PranchasDoProjeto, Pt, VistaDoProjeto } from './tipos';

type Selecao = { tipo: 'item'; id: string } | { tipo: 'carimbo' } | { tipo: 'quadro' } | null;

/** O que está sendo arrastado: só a moldura azul anda; o papel muda ao soltar. */
type Arrasto =
  /** `w`, `h`: a caixa do desenho (o encaixe alinha por ela); `gx`, `gy`: as guias em que ele grudou. */
  | { tipo: 'mover'; id: string; x0: number; y0: number; w: number; h: number; px: number; py: number; dx: number; dy: number; solto: boolean; gx?: number; gy?: number }
  | { tipo: 'tamanho'; id: string; px: number; py: number; w0: number; h0: number; dw: number; dh: number }
  | { tipo: 'carimbo'; px: number; py: number; w0: number; h0: number; dw: number; dh: number }
  | { tipo: 'quadro'; px: number; py: number; w0: number; h0: number; dw: number; dh: number };

/** O título sendo reescrito no lugar (duplo clique nele). */
interface TituloNoLugar {
  id: string;
  p: Pt;
  texto: string;
}

/** Folga do clique: menos que isto (px de tela) é tremida da mão, não arrasto — o desenho não sai do lugar. */
const FOLGA_DO_CLIQUE_PX = 3;
/** Até onde (px de tela) o desenho arrastado gruda numa linha de alinhamento (encaixe.ts). */
const IMA_PX = 8;
/** A cor das guias do encaixe (a do ponto revelado do A-PORT: não se confunde com o azul da seleção). */
const MAGENTA = '#d946ef';
/** O véu sobre o que não está sendo editado (os outros desenhos, o carimbo, o quadro): mais claro, não some. */
const VEU = 'rgba(255,255,255,0.6)';
/** Espera depois da última tecla nas entradas para redesenhar a folha (cada tecla é um muro novo). */
const ESPERA_DO_MURO_MS = 300;

const s = {
  raiz: { position: 'absolute', inset: 0, display: 'flex', minHeight: 0 } as CSSProperties,
  lado: {
    width: 270, flex: '0 0 270px', borderRight: '1px solid var(--line, #d9dee4)', overflow: 'auto',
    padding: 'var(--gap-2, 8px)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-rotulo, 12.5px)',
  } as CSSProperties,
  folhas: { display: 'flex', flexWrap: 'wrap', gap: 6 } as CSSProperties,
  chip: {
    padding: '3px 9px', border: '1px solid var(--line, #d9dee4)', borderRadius: 4, cursor: 'pointer',
    background: 'transparent', color: 'var(--ink-2, inherit)', font: 'inherit',
  } as CSSProperties,
  chipOn: { borderColor: 'var(--accent-3, #3d8bfd)', color: 'var(--ink, inherit)', fontWeight: 600 } as CSSProperties,
  grupo: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--line, #d9dee4)' } as CSSProperties,
  tituloDoGrupo: { fontWeight: 600, color: 'var(--ink, inherit)' } as CSSProperties,
  linha: { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center', gap: 6 } as CSSProperties,
  rotulo: { color: 'var(--muted, #666)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSProperties,
  palco: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } as CSSProperties,
  barra: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--gap-2, 8px)', padding: 'var(--gap-2, 8px)',
    fontSize: 'var(--fs-rotulo, 12.5px)', borderBottom: '1px solid var(--line, #d9dee4)',
  } as CSSProperties,
  mesa: { flex: 1, minHeight: 0, overflow: 'auto', background: '#8f949a', padding: 24, outline: 'none' } as CSSProperties,
  botao: { flex: 'none', padding: '0 10px' } as CSSProperties,
};

/** Zoom da mesa: 1 = a folha inteira cabe; 12 dá para ler a cota de uma A0 de perto. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 12;

/** O valor, só depois que ele parou de mudar por `ms` (o muro novo a cada tecla não redesenha a folha a cada tecla). */
function useAssentado<T>(valor: T, ms: number): T {
  const [assentado, setAssentado] = useState(valor);
  useEffect(() => {
    const r = setTimeout(() => setAssentado(valor), ms);
    return () => clearTimeout(r);
  }, [valor, ms]);
  return assentado;
}

/** Prende na folha nova os desenhos de uma folha que mudou de formato ou de orientação. */
function prenderNaFolha(f: Folha): Folha {
  const [W, H] = tamanhoDaFolha(f.formato, f.orientacao);
  return { ...f, itens: f.itens.map((i) => dentroDaFolha(i, W, H)) };
}

export function TelaDasPranchas({ modelo, resultado }: { modelo: Modelo | null; resultado: Resultado | null }) {
  // as folhas como a tela as vê: cada desenho com a VISTA dele (conteúdo, escala, título e anotações — 16/10). As
  // mexidas vão no que está guardado (useApp), e o `noItem` manda cada coisa para o seu lugar (vistas.ts)
  const guardadas = useApp((st) => st.pranchas);
  const pranchas = useMemo(() => pranchasComVistas(guardadas), [guardadas]);
  const tituloDoMuro = useApp((st) => st.titulo);
  const carregamento = useApp((st) => st.carregamento);
  const mudar = useApp((st) => st.mudarPranchas);
  const dizer = useApp((st) => st.dizer);
  const veredito = useApp((st) => st.veredito);
  const graficosEmUso = useGraficos((st) => st.dados);
  const escritorio = useEscritorio((st) => st.dados);
  const mudarEscritorio = useEscritorio((st) => st.mudar);
  const ativa = usePranchasUi((st) => st.ativa);
  const setAtiva = usePranchasUi((st) => st.definirAtiva);
  const [sel, setSel] = useState<Selecao>(null);
  const [zoom, setZoom] = useState(1);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  /** O desenho em que se entrou (duplo clique): as anotações dele ficam editáveis, os outros ficam mais claros. */
  const [ativo, setAtivo] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<TituloNoLugar | null>(null);
  const [exportando, setExportando] = useState(false);
  const mesaRef = useRef<HTMLDivElement>(null);
  const papelRef = useRef<HTMLDivElement>(null);
  const [mesa, setMesa] = useState<[number, number]>([900, 600]);

  const folha = folhaAtiva(pranchas, ativa);
  const numero = folha ? pranchas.folhas.indexOf(folha) + 1 : 0;

  // outro muro aberto: a seleção do muro anterior não vale (Delete nela acenderia o • num arquivo recém-aberto)
  useEffect(() => {
    setSel(null);
    setAtivo(null);
  }, [carregamento]);
  // trocou de folha: sai do desenho
  useEffect(() => setAtivo(null), [folha?.id]);

  // o tamanho da mesa: no zoom 1 a folha INTEIRA cabe (carimbo à vista, como o "ajustar à janela" do CAD) e o zoom
  // amplia a partir daí
  useEffect(() => {
    const el = mesaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMesa([Math.max(300, el.clientWidth - 48), Math.max(200, el.clientHeight - 48)]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── zoom pela rodinha e arrasto pelo botão do meio, como no CAD (Jose, 15/10) ─────────────────────────────────
  // A rodinha amplia em torno do ponto do mouse: o pedaço da folha que está embaixo do cursor fica embaixo dele.
  // O "onde estava" é guardado como fração da folha e reposto depois que o React redesenha no tamanho novo (antes
  // da pintura, sem piscar). Ouvinte nativo e não o onWheel do React: o do React é passivo e não impede a mesa de
  // rolar junto.
  const ancoraDoZoom = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  useEffect(() => {
    const el = mesaRef.current;
    if (!el) return;
    const aoRolar = (e: WheelEvent) => {
      const papel = papelRef.current;
      if (!papel || e.ctrlKey) return;   // Ctrl+rodinha fica com o zoom do navegador (a letra da tela toda)
      e.preventDefault();
      const r = papel.getBoundingClientRect();
      ancoraDoZoom.current = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, cx: e.clientX, cy: e.clientY };
      // um dente da rodinha = 15 %; o touchpad manda passos pequenos e amplia aos poucos
      const passo = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      const fator = Math.min(2, Math.max(0.5, Math.exp(-passo * 0.0014)));
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * fator)));
    };
    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  }, []);
  useLayoutEffect(() => {
    const a = ancoraDoZoom.current;
    const el = mesaRef.current;
    const papel = papelRef.current;
    ancoraDoZoom.current = null;
    if (!a || !el || !papel) return;
    const r = papel.getBoundingClientRect();
    el.scrollLeft += r.left + a.fx * r.width - a.cx;
    el.scrollTop += r.top + a.fy * r.height - a.cy;
  }, [zoom]);
  // botão do meio arrastado: a folha anda junto com o mouse (o pan do CAD); pego na captura, antes de qualquer
  // desenho, quadro ou carimbo — com o botão do meio nada é selecionado nem movido
  const panear = (e: PE) => {
    if (e.button !== 1) return;
    const el = mesaRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const [x0, y0, sl, st] = [e.clientX, e.clientY, el.scrollLeft, el.scrollTop];
    const mover = (m: PointerEvent) => {
      el.scrollLeft = sl - (m.clientX - x0);
      el.scrollTop = st - (m.clientY - y0);
    };
    const parar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', parar);
      window.removeEventListener('pointercancel', parar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', parar);
    window.addEventListener('pointercancel', parar);
  };

  // O desenhista nasce e morre DENTRO do efeito: no modo de desenvolvimento o React monta, desmonta e monta de novo
  // — criado num useMemo e descartado na limpeza, o desenhista guardado ficava morto e a foto do Realista nunca
  // chegava. A foto do 3D chega depois: quando chega, `versao` sobe e a folha se recompõe.
  const muro = useAssentado(modelo, ESPERA_DO_MURO_MS);
  const [desenhista, setDesenhista] = useState<Desenhista | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const d = criarDesenhista(muro, () => setVersao((v) => v + 1));
    setDesenhista(d);
    return () => d.descartar();
  }, [muro]);

  const base = useMemo(
    () => ({
      escritorio,
      notasAutomaticas: notasAutomaticas(resultado, muro),
      // a tabela de gráficos é por vista: a legenda do quadro sai da vista que pinta os blocos na folha (folha.ts)
      legenda: naVista('frontal', () => legendaDasCores(muro)),
      legendaPorVista: ((cache: Map<string, ReturnType<typeof legendaDasCores>>) => (v: Parameters<typeof naVista>[0], sob?: Parameters<typeof naVista>[2]) => {
        const k = `${v}|${JSON.stringify(sob ?? {})}`;
        if (!cache.has(k)) cache.set(k, naVista(v, () => legendaDasCores(muro), sob));
        return cache.get(k)!;
      })(new Map()),
      aco: quadroDeAco(muro, resultado),
      ferros: listaDeFerrosDaFolha(muro),
      // muro desenhado sem "Passa" na conta (não passa, ou a conta não deu veredito): tarja na folha
      naoVerificado: !!muro && !veredito?.passa,
    }),
    // a tabela de gráficos entra: trocou cor, hachura ou o que aparece, a folha se recompõe (legenda inclusive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [escritorio, resultado, muro, veredito, graficosEmUso],
  );
  const contexto = useCallback(
    (n: number, total: number, obra: DadosDaObra, saida = false): ContextoDaFolha => ({
      ...base,
      numero: n,
      total,
      obra,
      desenhar: (item, prefixo, o) => desenhista?.desenhar(item, prefixo, o) ?? null,
      tituloAutomatico: (item) => desenhista?.tituloAutomatico(item) ?? NOMES_DO_CONTEUDO[item.conteudo.tipo],
      saida,
      prefixo: saida ? 'imp' : 'p',
    }),
    // `versao` entra para a folha se recompor quando a foto do 3D chega
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, desenhista, versao],
  );
  const composta: FolhaComposta | null = useMemo(
    () => (folha ? comporFolha(folha, contexto(numero, pranchas.folhas.length, pranchas.obra)) : null),
    [folha, numero, pranchas.folhas.length, pranchas.obra, contexto],
  );

  /**
   * Todas as folhas para o ARQUIVO: compõe uma vez (o que pede as fotos do Realista das folhas que não estavam na
   * tela), espera as fotos e compõe de novo — o PDF e o DXF nunca saem com o lugar tracejado.
   */
  const todasParaSaida = async (p: PranchasDoProjeto): Promise<FolhaComposta[]> => {
    const compor = () => p.folhas.map((f, i) => comporFolha(f, contexto(i + 1, p.folhas.length, p.obra, true)));
    compor();
    await desenhista?.esperarFotos();
    return compor();
  };

  const exportar = async (fazer: (c: FolhaComposta[]) => void | Promise<void>) => {
    if (exportando) return;
    setExportando(true);
    try {
      await fazer(await todasParaSaida(pranchas));
    } finally {
      setExportando(false);
    }
  };

  /** DXF: uma prancha por arquivo, num .zip com a pasta das imagens (o 3D do Realista e a logo vão vinculados). */
  const baixarDxf = (compostas: FolhaComposta[]) => {
    const folhas = compostas.map((c, i) => {
      const f = pranchas.folhas[i];
      const nome = `${String(i + 1).padStart(2, '0')}${f.conteudo ? ` - ${f.conteudo}` : ''}`;
      return { nome, largura: c.largura, altura: c.altura, prims: c.primitivas };
    });
    const bytes = pacoteDxf(folhas);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDeArquivo(`${tituloDoMuro} - pranchas`, '.zip');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const mudarObra = (parcial: Partial<DadosDaObra>) => mudar((p) => ({ ...p, obra: { ...p.obra, ...parcial } }));
  const mudarFolha = (f: (x: Folha) => Folha) => folha && mudar((p) => naFolha(p, folha.id, f));

  const adicionarFolha = () => {
    const f = novaFolha('');
    mudar((p) => ({ ...p, folhas: [...p.folhas, f] }));
    setAtiva(f.id);
    setSel(null);
  };
  const excluirFolha = () => {
    if (!folha) return;
    // a folha montada não some com um clique sem volta
    if (folha.itens.length && !window.confirm(`Excluir a folha ${String(numero).padStart(2, '0')} com ${folha.itens.length} desenho(s)?`)) return;
    mudar((p) => ({ ...p, folhas: p.folhas.filter((f) => f.id !== folha.id) }));
    setAtiva(null);
    setSel(null);
  };
  /**
   * "vista:<id>": uma vista do projeto que não está em folha nenhuma (é por aqui que volta a vista tirada da folha);
   * "nova:<tipo>": uma vista nova da pré-definida do tipo. A conta parte do que está GUARDADO (sem os espelhos).
   */
  const adicionarVista = (valor: string) => {
    let base = useApp.getState().pranchas;
    let vista: VistaDoProjeto | null;
    if (valor.startsWith('vista:')) vista = acharVista(base, valor.slice(6));
    else {
      const r = novaVista(base, valor.slice(5) as PedidoDeVista['tipo']);
      [base, vista] = [r.pranchas, r.vista];
    }
    if (!vista) return;
    const r = porVistaNaFolha(base, folha?.id ?? null, vista);
    mudar(() => r.pranchas);
    setAtiva(r.folha);
    setSel({ tipo: 'item', id: r.item.id });
  };
  const adicionarTabela = (id: IdDaTabela) => {
    const r = porNaFolha(useApp.getState().pranchas, folha?.id ?? null, (f) => itemDaTabela(f, id));
    mudar(() => r.pranchas);
    setAtiva(r.folha);
    setSel({ tipo: 'item', id: r.item.id });
  };
  const excluirItem = useCallback(
    (id: string) => {
      if (!folha) return;
      mudar((p) => naFolha(p, folha.id, (f) => ({ ...f, itens: f.itens.filter((i) => i.id !== id) })));
      setSel(null);
    },
    [folha, mudar],
  );

  // ── o papel e o mouse ──────────────────────────────────────────────────────
  const capaRef = useRef<SVGSVGElement>(null);
  const [W, H] = folha ? tamanhoDaFolha(folha.formato, folha.orientacao) : [841, 594];
  const larguraPx = Math.min(mesa[0], (mesa[1] * W) / H) * zoom;
  const mmPorPx = W / Math.max(1, larguraPx);
  const mm = (e: { clientX: number; clientY: number }): Pt => {
    const svg = capaRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const naTela = (p: Pt): Pt | null => {
    const m = capaRef.current?.getScreenCTM();
    if (!m) return null;
    const q = new DOMPoint(p[0], p[1]).matrixTransform(m);
    return [q.x, q.y];
  };
  const focarMesa = () => mesaRef.current?.focus({ preventScroll: true });

  // ── dentro do desenho (duplo clique) ──────────────────────────────────────
  const postoAtivo = ativo ? composta?.itens.find((i) => i.id === ativo) ?? null : null;
  const itemAtivo = ativo ? folha?.itens.find((i) => i.id === ativo) ?? null : null;
  // o desenho em que se entrou saiu da folha (Excluir da folha, outra folha, outro muro): sai dele também — senão o
  // véu some mas os outros desenhos continuam sem pegar clique e o "Sair" fica na barra
  useEffect(() => {
    if (ativo && composta && !composta.itens.some((i) => i.id === ativo)) setAtivo(null);
  }, [ativo, composta]);
  const desenhosEditaveis = useMemo<DesenhoEditavel[]>(
    () => (postoAtivo && itemAtivo && composta && postoAtivo.prims
      ? [{ posto: postoAtivo, item: itemAtivo, primitivas: composta.primitivas.slice(postoAtivo.prims[0], postoAtivo.prims[1]) }]
      : []),
    [postoAtivo, itemAtivo, composta],
  );
  const edicao = useEdicaoDeAnotacoes({
    desenhos: desenhosEditaveis,
    mudarItem: (id, f) => folha && mudar((p) => noItem(p, folha.id, id, f)),
    mmPorPx,
    ponto: mm,
    naTela,
    focar: focarMesa,
    temFoco: () => !!mesaRef.current && document.activeElement === mesaRef.current,
    aoSelecionar: () => setSel(null),
    barraEm: (e) => barraNaTela(e, papelRef.current, muro),
  });
  /** Entra no desenho: só os em escala têm anotação para mexer (o 3D e o isométrico não; a tabela também não). */
  const entrar = (id: string) => {
    const it = composta?.itens.find((i) => i.id === id);
    if (!it?.S) return;
    setAtivo(id);
    setSel(null);
    edicao.limpar();
    focarMesa();
  };
  const sair = () => {
    edicao.armar(null);
    edicao.limpar();
    setAtivo(null);
  };

  /** Reescreve o título no lugar (duplo clique nele): vazio volta ao automático. */
  const reescreverTitulo = (it: ItemPosto) => {
    const item = folha?.itens.find((i) => i.id === it.id);
    if (!item || !it.titulo) return;
    // o número que a folha escreveu (sem número guardado, ela numera pela ordem): a caixa vai depois do quadrado dele
    const q = ondeVaiOTitulo(it.titulo, folha ? numeroDoItem(folha, item) : '');
    setTitulo({ id: it.id, p: q, texto: item.titulo.trim() || desenhista?.tituloAutomatico(item) || '' });
  };
  const tituloRef = useRef<TituloNoLugar | null>(null);
  tituloRef.current = titulo;
  const confirmarTitulo = () => {
    const t = tituloRef.current;
    tituloRef.current = null;
    setTitulo(null);
    if (!t || !folha) return;
    const item = folha.itens.find((i) => i.id === t.id);
    if (!item) return;
    // igual ao automático continua automático (o título acompanha a vista quando ela muda)
    const auto = desenhista?.tituloAutomatico({ ...item, titulo: '' }) ?? '';
    const novo = t.texto.trim() === auto ? '' : t.texto;
    if (novo !== item.titulo) mudar((p) => noItem(p, folha.id, t.id, (i) => ({ ...i, titulo: novo })));
  };

  // O teclado da folha. Delete apaga SÓ com o foco na mesa (clicar na folha a foca): digitando no painel de
  // entradas, o Enter tira o foco do campo e um Backspace seguinte apagava o desenho sem a pessoa ver. Dentro do
  // desenho, quem responde primeiro é a edição (Esc volta um passo, D e T armam, Delete tira a anotação); o Esc que
  // sobra sai do desenho. Pela ref: o ouvinte é um só, e lê o estado da vez.
  const teclar = useRef<(e: KeyboardEvent) => void>(() => undefined);
  teclar.current = (e: KeyboardEvent) => {
    if (titulo) return;
    if (edicao.teclar(e)) return;
    if (e.key === 'Escape') {
      if (ativo && !teclaDeCampo(e)) sair();
      return;
    }
    if (!mesaRef.current || document.activeElement !== mesaRef.current) return;
    if (!(e.key === 'Delete' || e.key === 'Backspace') || !sel || ativo) return;
    if (sel.tipo === 'item') excluirItem(sel.id);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => teclar.current(e);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // ── arrastar no papel ─────────────────────────────────────────────────────
  const apertar = (e: PE, a: Arrasto) => {
    e.stopPropagation();
    focarMesa();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setArrasto(a);
  };
  const mover = (e: PE) => {
    edicao.mover(e);
    if (!arrasto) return;
    const [x, y] = mm(e);
    const dx = Math.round((x - arrasto.px) * 2) / 2;
    const dy = Math.round((y - arrasto.py) * 2) / 2;
    if (arrasto.tipo === 'mover') {
      const solto = arrasto.solto || Math.hypot(x - arrasto.px, y - arrasto.py) > FOLGA_DO_CLIQUE_PX * mmPorPx;
      if (!solto) return setArrasto({ ...arrasto, dx: 0, dy: 0, solto });
      // o encaixe: as bordas e o meio grudam nos outros desenhos, na moldura, no quadro e no carimbo (Alt: livre)
      if (e.altKey || !composta || !folha) return setArrasto({ ...arrasto, dx, dy, solto, gx: undefined, gy: undefined });
      const [mx0, my0, mx1, my1] = quadroUtil(folha.formato, folha.orientacao);
      const outros = composta.itens.filter((i) => i.id !== arrasto.id && !i.pendente).map((i) => i.caixa);
      const linhasX = [mx0, mx1, composta.carimbo[0], ...(composta.quadro ? [composta.quadro[0]] : [])];
      const linhasY = [my0, my1, composta.carimbo[1]];
      const g = encaixar([arrasto.x0 + dx, arrasto.y0 + dy, arrasto.w, arrasto.h], outros, linhasX, linhasY, IMA_PX * mmPorPx);
      setArrasto({ ...arrasto, dx: dx + g.dx, dy: dy + g.dy, solto, gx: g.gx, gy: g.gy });
    } else setArrasto({ ...arrasto, dw: dx, dh: dy });
  };
  /** O tamanho que o redimensionar dá, já com a proporção travada (a moldura-fantasma mostra o resultado). */
  const tamanhoTravado = (a: Extract<Arrasto, { tipo: 'tamanho' }>): [number, number] => {
    const prop = a.w0 / Math.max(1, a.h0);
    const w = Math.max(20, Math.abs(a.dw) >= Math.abs(a.dh) * prop ? a.w0 + a.dw : (a.h0 + a.dh) * prop);
    return [w, w / prop];
  };
  const soltar = () => {
    edicao.soltar();
    const a = arrasto;
    setArrasto(null);
    if (!a || !folha) return;
    if (a.tipo === 'mover' && (a.dx || a.dy)) {
      mudar((p) => noItem(p, folha.id, a.id, (i) => dentroDaFolha({ ...i, x: a.x0 + a.dx, y: a.y0 + a.dy }, W, H)));
    }
    if (a.tipo === 'tamanho' && (a.dw || a.dh)) {
      const [w, h] = tamanhoTravado(a);
      mudar((p) => noItem(p, folha.id, a.id, (i) => ({ ...i, largura: w, altura: h })));
    }
    if (a.tipo === 'carimbo' && (a.dw || a.dh)) {
      // a alça fica no canto de cima à esquerda: puxar para a esquerda/para cima aumenta
      mudarFolha((f) => ({ ...f, carimbo: { largura: Math.max(CARIMBO_MIN.largura, a.w0 - a.dw), altura: Math.max(CARIMBO_MIN.altura, a.h0 - a.dh) } }));
    }
    if (a.tipo === 'quadro' && (a.dw || a.dh)) {
      mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, largura: Math.max(40, a.w0 - a.dw), altura: Math.max(0, a.h0 - a.dh) } }));
    }
  };

  // ── o painel do que está selecionado ──────────────────────────────────────
  // dentro do desenho, sem anotação escolhida, o painel é o do desenho (título, número, escala…)
  const idDoPainel = sel?.tipo === 'item' ? sel.id : ativo && !edicao.sel ? ativo : null;
  const itemSel = folha && idDoPainel ? folha.itens.find((i) => i.id === idDoPainel) ?? null : null;
  const postoSel = itemSel ? composta?.itens.find((i) => i.id === itemSel.id) ?? null : null;
  const caixaSel = postoSel?.caixa ?? null;
  const ocultasSel = (postoSel?.chamadas?.filter((c) => c.oculta).length ?? 0) + (postoSel?.anotacoes?.filter((a) => a.oculta && !a.nova).length ?? 0);
  const mudarItem = (f: (i: ItemDaFolha) => ItemDaFolha) => folha && itemSel && mudar((p) => noItem(p, folha.id, itemSel.id, f));

  const subirLogo = (alvo: HTMLInputElement) => {
    const arquivo = alvo.files?.[0];
    // o mesmo arquivo de novo (depois de Remover) tem de disparar outra vez
    alvo.value = '';
    if (!arquivo) return;
    logoEmPng(arquivo).then((logo) => mudarEscritorio({ logo }), () => dizer(ruim('Imagem da logo não reconhecida')));
  };

  const desenhosDaFolha = composta?.itens ?? [];
  // as vistas que não estão em folha nenhuma, de todos os tipos (as de fábrica que ninguém pôs também), na ordem das abas
  const vistasLivres = useMemo(
    () => [...TIPOS_2D, '3d' as const].flatMap((t) => vistasDoTipo(guardadas, t)).filter((v) => !ondeEstaAVista(guardadas, v.id)),
    [guardadas],
  );
  // as vistas 3D fora das folhas: o 3D não tem aba, então é aqui que a câmera guardada se apaga (cada "Enviar para a
  // prancha" do visor cria uma; sem isto elas se acumulam no arquivo para sempre)
  const tresDLivres = vistasLivres.filter((v) => v.conteudo.tipo === '3d');
  const excluirVista3d = (v: VistaDoProjeto) => {
    if (window.confirm(`Excluir a vista "${v.nome}"?`)) mudar((p) => excluirVista(p, v.id));
  };

  return (
    <div style={s.raiz} data-frente="pranchas">
      <aside style={s.lado}>
        <div style={s.folhas}>
          {pranchas.folhas.map((f, i) => (
            <button key={f.id} type="button" style={{ ...s.chip, ...(f === folha ? s.chipOn : null) }} onClick={() => { setAtiva(f.id); setSel(null); }} title={f.conteudo || undefined}>
              {String(i + 1).padStart(2, '0')}{f.conteudo ? ` · ${f.conteudo}` : ''}
            </button>
          ))}
          <button type="button" style={s.chip} onClick={adicionarFolha} title="Nova folha" aria-label="Nova folha">+</button>
        </div>

        {folha && !sel && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Folha {String(numero).padStart(2, '0')}</span>
            <Linha rotulo="Conteúdo"><Texto valor={folha.conteudo} aoMudar={(v) => mudarFolha((f) => ({ ...f, conteudo: v }))} /></Linha>
            <Linha rotulo="Formato">
              <select className="campo" value={folha.formato} onChange={(e) => {
                const formato = e.target.value as Formato;
                mudarFolha((f) => prenderNaFolha({ ...f, formato, quadro: { ...f.quadro, ...quadroLateralPadrao(formato, f.orientacao, f.carimbo) } }));
              }}>
                {ORDEM_DOS_FORMATOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Linha>
            <Linha rotulo="Orientação">
              <select className="campo" value={folha.orientacao} onChange={(e) => {
                const orientacao = e.target.value as Orientacao;
                mudarFolha((f) => prenderNaFolha({ ...f, orientacao, quadro: { ...f.quadro, ...quadroLateralPadrao(f.formato, orientacao, f.carimbo) } }));
              }}>
                <option value="deitada">Deitada</option>
                <option value="em_pe">Em pé</option>
              </select>
            </Linha>
            <button type="button" className="btn-caixa" onClick={excluirFolha}>Excluir folha</button>
          </div>
        )}

        {!sel && tresDLivres.length > 0 && (
          <div style={s.grupo} data-vistas-3d-livres>
            <span style={s.tituloDoGrupo}>Vistas 3D fora das folhas</span>
            {tresDLivres.map((v) => (
              <div key={v.id} style={estiloDosCampos.linha}>
                <span style={estiloDosCampos.rotulo} title={v.nome}>{v.nome}</span>
                <button type="button" className="btn-caixa" onClick={() => excluirVista3d(v)}>Excluir vista</button>
              </div>
            ))}
          </div>
        )}

        {itemSel && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>{NOMES_DO_CONTEUDO[itemSel.conteudo.tipo]}</span>
            {itemSel.vista && (
              <Linha rotulo="Vista">
                <TextoConfirmado valor={acharVista(guardadas, itemSel.vista)?.nome ?? ''} aoConfirmar={(v) => mudar((p) => renomearVista(p, itemSel.vista!, v))} />
              </Linha>
            )}
            {/* a sobreposição de gráficos da vista deste desenho (a mesma do botão Gráficos da aba) */}
            {itemSel.vista && itemSel.conteudo.tipo !== '3d' && itemSel.conteudo.tipo !== 'tabela' && itemSel.conteudo.tipo !== 'detalhe' && (
              <Linha rotulo="Gráficos">
                <button
                  type="button" className="btn-caixa"
                  onClick={() => useJanelaDeGraficos.getState().abrir({ tipo: 'vista', id: itemSel.vista!, tipoDaVista: itemSel.conteudo.tipo as TipoDeVista })}
                >
                  Sobrepor…
                </button>
              </Linha>
            )}
            {itemSel.conteudo.tipo !== 'tabela' && (
              <Linha rotulo="Número">
                {/* vazio volta ao primeiro número livre da folha (o desenho não fica sem número) */}
                <TextoConfirmado
                  valor={itemSel.numero ?? ''}
                  aoConfirmar={(v) => mudarItem((i) => ({ ...i, numero: v.trim().slice(0, 8) || numeroLivre({ ...folha!, itens: folha!.itens.filter((x) => x.id !== i.id) }) }))}
                />
              </Linha>
            )}
            <Linha rotulo="Título">
              <Texto valor={itemSel.titulo} sugestao={desenhista?.tituloAutomatico(itemSel)} aoMudar={(v) => mudarItem((i) => ({ ...i, titulo: v }))} />
            </Linha>
            {itemSel.conteudo.tipo === 'tabela' ? null : itemSel.escala !== null ? (
              <Linha rotulo="Escala">
                <select className="campo" value={String(itemSel.escala)} onChange={(e) => mudarItem((i) => ({ ...i, escala: Number(e.target.value) }))}>
                  {ESCALAS.map((x) => <option key={x} value={x}>{rotuloDaEscala(x)}</option>)}
                </select>
              </Linha>
            ) : (
              <Linha rotulo="Largura (mm)">
                <Numero
                  valor={caixaSel?.[2] ?? itemSel.largura ?? 150}
                  min={20}
                  aoMudar={(v) => {
                    // a altura acompanha a proporção do desenho que está na folha
                    const prop = caixaSel ? caixaSel[2] / Math.max(1, caixaSel[3]) : (itemSel.largura ?? 150) / Math.max(1, itemSel.altura ?? 100);
                    mudarItem((i) => ({ ...i, largura: v, altura: v / prop }));
                  }}
                />
              </Linha>
            )}
            {itemSel.conteudo.tipo === 'planta' && modelo && (
              <Linha rotulo="Fiada">
                <select className="campo" value={itemSel.conteudo.fiada} onChange={(e) => mudarItem((i) => ({ ...i, conteudo: { tipo: 'planta', fiada: Number(e.target.value) } }))}>
                  {Array.from({ length: modelo.dims.n_fiadas }, (_, k) => <option key={k} value={k}>{k + 1}ª</option>)}
                </select>
              </Linha>
            )}
            {itemSel.conteudo.tipo === 'iso' && (
              <Linha rotulo="Vista">
                <select className="campo" value={itemSel.conteudo.vista ?? 'frente-direita'} onChange={(e) => mudarItem((i) => ({ ...i, conteudo: { ...(i.conteudo as Extract<ConteudoDoItem, { tipo: 'iso' }>), vista: e.target.value as 'frente-direita' } }))}>
                  <option value="frente-direita">Frente, pela direita</option>
                  <option value="frente-esquerda">Frente, pela esquerda</option>
                  <option value="fundo-direita">Fundo, pela direita</option>
                  <option value="fundo-esquerda">Fundo, pela esquerda</option>
                </select>
              </Linha>
            )}
            {!ativo && (ocultasSel > 0 || itemSel.chamadas || itemSel.anotacoes) && (
              <div style={s.linha}>
                <span style={s.rotulo}>Anotações</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ocultasSel > 0 && (
                    <button
                      type="button" className="btn-caixa"
                      onClick={() =>
                        mudarItem((i) => {
                          const comChamadas = (postoSel?.chamadas ?? []).filter((c) => c.oculta).reduce((x, c) => naChamada(x, c.chave, ({ oculta: _o, ...q }) => q), i);
                          // o texto vazio guardado antes de 16/10 também escondia: sai junto
                          return (postoSel?.anotacoes ?? []).filter((a) => a.oculta && !a.nova).reduce((x, a) => naAnotacao(x, a.chave, ({ oculta: _o, ...q }) => (q.texto !== undefined && !q.texto.trim() ? (({ texto: _t, ...r }) => r)(q) : q)), comChamadas);
                        })
                      }
                    >
                      Mostrar ocultas ({ocultasSel})
                    </button>
                  )}
                  {(itemSel.chamadas || itemSel.anotacoes) && (
                    <button type="button" className="btn-caixa" onClick={() => mudarItem(({ chamadas: _c, anotacoes: _a, ...i }) => i)}>Voltar ao automático</button>
                  )}
                </span>
              </div>
            )}
            <button type="button" className="btn-caixa" onClick={() => excluirItem(itemSel.id)}>Excluir da folha</button>
          </div>
        )}

        {edicao.painel}

        {folha && sel?.tipo === 'carimbo' && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Carimbo</span>
            <Linha rotulo="Obra"><Texto valor={pranchas.obra.obra} aoMudar={(v) => mudarObra({ obra: v })} /></Linha>
            <Linha rotulo="Endereço"><Texto valor={pranchas.obra.endereco} aoMudar={(v) => mudarObra({ endereco: v })} /></Linha>
            <Linha rotulo="Proprietário"><Texto valor={pranchas.obra.proprietario} aoMudar={(v) => mudarObra({ proprietario: v })} /></Linha>
            <Linha rotulo="ART"><Texto valor={pranchas.obra.art} aoMudar={(v) => mudarObra({ art: v })} /></Linha>
            <Linha rotulo="Data"><Texto valor={pranchas.obra.data} aoMudar={(v) => mudarObra({ data: v })} /></Linha>
            <Linha rotulo="Revisão"><Texto valor={pranchas.obra.revisao} aoMudar={(v) => mudarObra({ revisao: v })} /></Linha>
            <Linha rotulo="Código do desenho"><Texto valor={pranchas.obra.codigo} aoMudar={(v) => mudarObra({ codigo: v })} /></Linha>
            <Linha rotulo="Desenhista"><Texto valor={pranchas.obra.desenhista} aoMudar={(v) => mudarObra({ desenhista: v })} /></Linha>
            <Linha rotulo="Verificação"><Texto valor={pranchas.obra.verificacao} aoMudar={(v) => mudarObra({ verificacao: v })} /></Linha>
            <span style={{ ...s.tituloDoGrupo, marginTop: 6 }}>Escritório</span>
            <Linha rotulo="Empresa"><Texto valor={escritorio.empresa} aoMudar={(v) => mudarEscritorio({ empresa: v })} /></Linha>
            <Linha rotulo="Contato"><Texto valor={escritorio.contato} aoMudar={(v) => mudarEscritorio({ contato: v })} /></Linha>
            <Linha rotulo="Responsável"><Texto valor={escritorio.responsavel} aoMudar={(v) => mudarEscritorio({ responsavel: v })} /></Linha>
            <Linha rotulo="CREA"><Texto valor={escritorio.crea} aoMudar={(v) => mudarEscritorio({ crea: v })} /></Linha>
            <Linha rotulo="Logomarca">
              <span style={{ display: 'flex', gap: 6 }}>
                <label className="btn-caixa" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                  {escritorio.logo ? 'Trocar' : 'Carregar'}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={(e) => subirLogo(e.target)} />
                </label>
                {escritorio.logo && <button type="button" className="btn-caixa" onClick={() => mudarEscritorio({ logo: null })}>Remover</button>}
              </span>
            </Linha>
            {escritorio.logo && <Linha rotulo="Largura da logo (mm)"><Numero valor={escritorio.logoLargura} min={5} aoMudar={(v) => mudarEscritorio({ logoLargura: v })} /></Linha>}
            <Linha rotulo="Largura (mm)"><Numero valor={folha.carimbo.largura} min={CARIMBO_MIN.largura} aoMudar={(v) => mudarFolha((f) => ({ ...f, carimbo: { ...f.carimbo, largura: v } }))} /></Linha>
            <Linha rotulo="Altura (mm)"><Numero valor={folha.carimbo.altura} min={CARIMBO_MIN.altura} aoMudar={(v) => mudarFolha((f) => ({ ...f, carimbo: { ...f.carimbo, altura: v } }))} /></Linha>
          </div>
        )}

        {folha && sel?.tipo === 'quadro' && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Quadro lateral</span>
            <Linha rotulo="Largura (mm)"><Numero valor={folha.quadro.largura} min={40} aoMudar={(v) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, largura: v } }))} /></Linha>
            <Linha rotulo="Altura (mm)"><Numero valor={folha.quadro.altura} aoMudar={(v) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, altura: v } }))} /></Linha>
            <Linha rotulo="Legenda"><input type="checkbox" checked={folha.quadro.legenda} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, legenda: e.target.checked } }))} /></Linha>
            <Linha rotulo="Lista de ferros"><input type="checkbox" checked={folha.quadro.listaDeFerros} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, listaDeFerros: e.target.checked } }))} /></Linha>
            <Linha rotulo="Resumo do aço"><input type="checkbox" checked={folha.quadro.quadroDeAco} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, quadroDeAco: e.target.checked } }))} /></Linha>
            <Linha rotulo="Notas">
              <select className="campo" value={folha.quadro.notas === null ? 'auto' : 'proprias'} onChange={(e) => {
                const auto = e.target.value === 'auto';
                // voltar ao automático joga fora o texto digitado: só com confirmação
                if (auto && folha.quadro.notas && folha.quadro.notas.join('\n') !== base.notasAutomaticas.join('\n') && !window.confirm('Voltar às notas automáticas e descartar as editadas?')) return;
                mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, notas: auto ? null : [...base.notasAutomaticas] } }));
              }}>
                <option value="auto">Automáticas</option>
                <option value="proprias">Editadas</option>
              </select>
            </Linha>
            {folha.quadro.notas !== null && (
              <textarea
                className="campo"
                rows={10}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={folha.quadro.notas.join('\n')}
                onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, notas: e.target.value.split('\n') } }))}
              />
            )}
          </div>
        )}
      </aside>

      <div style={s.palco}>
        <div style={s.barra}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <span style={{ ...s.rotulo, overflow: 'visible' }}>Adicionar</span>
            <select
              className="campo"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('tabela:')) adicionarTabela(v.slice(7) as IdDaTabela);
                else if (v) adicionarVista(v);
              }}
              disabled={!modelo}
            >
              <option value="">—</option>
              {vistasLivres.length > 0 && (
                <optgroup label="Vistas">
                  {vistasLivres.map((v) => <option key={v.id} value={`vista:${v.id}`}>{v.nome}</option>)}
                </optgroup>
              )}
              <optgroup label="Nova vista">
                {TIPOS_2D.map((t) => <option key={t} value={`nova:${t}`}>{NOMES_DO_CONTEUDO[t]}</option>)}
              </optgroup>
              <optgroup label="Tabela">
                <option value="tabela:blocos">Blocos e canaletas</option>
                <option value="tabela:quantidades">Materiais</option>
                <option value="tabela:drenagem">Drenagem</option>
              </optgroup>
            </select>
          </label>
          <span style={{ flex: 1 }} />
          {edicao.dica && (
            <span style={{ ...s.rotulo, overflow: 'visible' }} data-dica-da-ferramenta>{edicao.dica}</span>
          )}
          {/* as ferramentas valem dentro do desenho (duplo clique nele): é a vista dele que se anota */}
          <div className="cad-escolha">
            <button type="button" style={s.botao} className={edicao.ferramenta === 'cota' ? 'on' : undefined} disabled={!ativo || !edicao.podeAnotar} title="Cota  ·  D" onClick={() => edicao.armar(edicao.ferramenta === 'cota' ? null : 'cota')}>Cota</button>
            <button type="button" style={s.botao} className={edicao.ferramenta === 'texto' ? 'on' : undefined} disabled={!ativo || !edicao.podeAnotar} title="Texto  ·  T" onClick={() => edicao.armar(edicao.ferramenta === 'texto' ? null : 'texto')}>Texto</button>
            <button type="button" style={s.botao} className={edicao.ferramenta === 'etiqueta' ? 'on' : undefined} disabled={!ativo || !edicao.podeEtiquetar} title="Etiqueta  ·  I" onClick={() => edicao.armar(edicao.ferramenta === 'etiqueta' ? null : 'etiqueta')}>Etiqueta</button>
            {ativo && <button type="button" style={s.botao} title="Sair do desenho  ·  Esc" onClick={sair}>Sair</button>}
          </div>
          <div className="cad-escolha">
            <button type="button" style={s.botao} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.25))} title="Diminuir" aria-label="Diminuir">−</button>
            <button type="button" style={s.botao} onClick={() => setZoom(1)}>Ajustar</button>
            <button type="button" style={s.botao} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.25))} title="Aumentar" aria-label="Aumentar">+</button>
          </div>
          <div className="cad-escolha">
            <button type="button" style={s.botao} disabled={!pranchas.folhas.length || exportando} onClick={() => void exportar((c) => imprimirPranchas(c))}>
              PDF
            </button>
            <button type="button" style={s.botao} disabled={!pranchas.folhas.length || exportando} onClick={() => void exportar(baixarDxf)}>
              DXF
            </button>
          </div>
        </div>

        <div
          ref={mesaRef} style={s.mesa} tabIndex={0} onPointerDownCapture={panear}
          onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
          onPointerDown={() => { setSel(null); edicao.limpar(); focarMesa(); }}
          onDoubleClick={() => { if (ativo) sair(); }}
        >
          {composta && folha ? (
            <div ref={papelRef} style={{ position: 'relative', width: larguraPx, height: (larguraPx * H) / W, margin: '0 auto', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
              <div style={{ position: 'absolute', inset: 0, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: composta.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"') }} />
              <svg
                ref={capaRef}
                viewBox={`0 0 ${W} ${H}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: edicao.ferramenta ? 'crosshair' : undefined }}
                onPointerMove={mover}
                onPointerDown={(e) => { edicao.apertarComFerramenta(e); }}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onDoubleClick={(e) => {
                  // duplo clique fora do desenho em que se entrou: sai dele. Dentro (no vazio, na linha da cota, na
                  // alça) ou com a ferramenta armada (dois cliques rápidos da cota) fica — e a mesa não fica sabendo
                  e.stopPropagation();
                  if (!postoAtivo || edicao.ferramenta) return;
                  const p = mm(e);
                  const [x, y, w, h] = postoAtivo.caixa;
                  if (p[0] < x || p[0] > x + w || p[1] < y || p[1] > y + h) sair();
                }}
              >
                {/* dentro de um desenho, o resto da folha não se pega (nem se move): o clique é da edição */}
                <g style={{ pointerEvents: ativo || edicao.ferramenta ? 'none' : undefined }}>
                {/* quadro lateral: a alça no canto de cima à esquerda puxa largura e altura (por baixo dos desenhos:
                    um desenho em cima do quadro ainda se pega) */}
                {composta.quadro && (() => {
                  const [qx, qy, qw, qh] = composta.quadro;
                  const a = arrasto?.tipo === 'quadro' ? arrasto : null;
                  const ligado = sel?.tipo === 'quadro';
                  return (
                    <g>
                      <rect
                        x={qx + (a?.dw ?? 0)} y={qy + (a?.dh ?? 0)} width={qw - (a?.dw ?? 0)} height={qh - (a?.dh ?? 0)}
                        fill="transparent" stroke={ligado || a ? AZUL : composta.quadroEstourou ? '#e0685a' : 'transparent'} strokeWidth={0.6}
                        onPointerDown={(e) => { e.stopPropagation(); mesaRef.current?.focus({ preventScroll: true }); setSel({ tipo: 'quadro' }); }}
                      />
                      {ligado && (
                        <rect
                          x={qx + (a?.dw ?? 0) - 2.5} y={qy + (a?.dh ?? 0) - 2.5} width={5} height={5} fill={AZUL} style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'quadro', px, py, w0: folha.quadro.largura, h0: qh, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })()}
                {/* carimbo: mesma alça, no canto de cima à esquerda */}
                {(() => {
                  const [cx, cy, cw, ch] = composta.carimbo;
                  const a = arrasto?.tipo === 'carimbo' ? arrasto : null;
                  const ligado = sel?.tipo === 'carimbo';
                  return (
                    <g>
                      <rect
                        x={cx + (a?.dw ?? 0)} y={cy + (a?.dh ?? 0)} width={cw - (a?.dw ?? 0)} height={ch - (a?.dh ?? 0)}
                        fill="transparent" stroke={ligado || a ? AZUL : 'transparent'} strokeWidth={0.6}
                        onPointerDown={(e) => { e.stopPropagation(); mesaRef.current?.focus({ preventScroll: true }); setSel({ tipo: 'carimbo' }); }}
                      />
                      {ligado && (
                        <rect
                          x={cx + (a?.dw ?? 0) - 2.5} y={cy + (a?.dh ?? 0) - 2.5} width={5} height={5} fill={AZUL} style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'carimbo', px, py, w0: cw, h0: ch, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })()}
                {/* os desenhos: clicar seleciona, arrastar move, duplo clique entra (as anotações dele ficam editáveis) */}
                {desenhosDaFolha.map((it) => {
                  const item = folha.itens.find((i) => i.id === it.id);
                  if (!item) return null;
                  const ligado = sel?.tipo === 'item' && sel.id === it.id;
                  const a = arrasto && 'id' in arrasto && arrasto.id === it.id ? arrasto : null;
                  const dx = a?.tipo === 'mover' ? a.dx : 0;
                  const dy = a?.tipo === 'mover' ? a.dy : 0;
                  const [x, y, w, h] = it.caixa;
                  const [ww, hh] = a?.tipo === 'tamanho' ? tamanhoTravado(a) : [w, h];
                  const pegarParaMover = (e: PE) => {
                    if (e.button !== 0) return;
                    setSel({ tipo: 'item', id: it.id });
                    edicao.limpar();
                    const [px, py] = mm(e);
                    apertar(e, { tipo: 'mover', id: it.id, x0: item.x, y0: item.y, w: it.caixa[2], h: it.caixa[3], px, py, dx: 0, dy: 0, solto: false });
                  };
                  return (
                    <g key={it.id}>
                      <rect
                        x={x + dx} y={y + dy} width={ww} height={hh}
                        fill="transparent"
                        // vermelho: passa da moldura ou cai sobre o carimbo / o quadro lateral
                        stroke={ligado || a ? AZUL : it.invade ? '#e0685a' : 'transparent'}
                        strokeWidth={0.6}
                        style={{ cursor: 'move' }}
                        onPointerDown={pegarParaMover}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          entrar(it.id);
                        }}
                      />
                      {/* o título: pega o desenho como o resto dele; duplo clique reescreve no lugar */}
                      {it.titulo && (
                        <rect
                          x={it.titulo[0] + dx} y={it.titulo[1] + dy} width={it.titulo[2]} height={it.titulo[3]}
                          fill="transparent" style={{ cursor: 'move' }}
                          data-titulo={it.id}
                          onPointerDown={pegarParaMover}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            reescreverTitulo(it);
                          }}
                        />
                      )}
                      {pendenteRotulo(it.pendente, x + dx, y + dy, ww, hh, NOMES_DO_CONTEUDO[item.conteudo.tipo])}
                      {/* durante o arrasto do desenho, as chamadas soltas andam junto na moldura azul */}
                      {a?.tipo === 'mover' && it.chamadas?.filter((c) => c.posta && !c.oculta).map((c) => (
                        <polygon key={c.chave} points={pontosDoTexto(c, dx, dy)} fill="none" stroke={AZUL} strokeWidth={0.3} style={{ pointerEvents: 'none' }} />
                      ))}
                      {/* a tabela não tem alça: o tamanho dela é o da letra da folha */}
                      {ligado && item.escala === null && item.conteudo.tipo !== 'tabela' && (
                        <rect
                          x={x + ww - 2.5} y={y + hh - 2.5} width={5} height={5} fill={AZUL}
                          style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'tamanho', id: it.id, px, py, w0: w, h0: h, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })}
                </g>
                {/* dentro de um desenho: o resto da folha fica mais claro e o desenho ganha a moldura (só a tela) */}
                {postoAtivo && (
                  <g style={{ pointerEvents: 'none' }} data-veu>
                    {desenhosDaFolha.filter((it) => it.id !== postoAtivo.id).flatMap((it) => [it.caixa, ...(it.titulo ? [it.titulo] : [])]).map((r, k) => (
                      <rect key={`d${k}`} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={VEU} />
                    ))}
                    <rect x={composta.carimbo[0]} y={composta.carimbo[1]} width={composta.carimbo[2]} height={composta.carimbo[3]} fill={VEU} />
                    {composta.quadro && <rect x={composta.quadro[0]} y={composta.quadro[1]} width={composta.quadro[2]} height={composta.quadro[3]} fill={VEU} />}
                    <rect
                      x={postoAtivo.caixa[0] - 1} y={postoAtivo.caixa[1] - 1} width={postoAtivo.caixa[2] + 2} height={postoAtivo.caixa[3] + 2}
                      fill="none" stroke={AZUL} strokeWidth={0.4} strokeDasharray="2,1"
                    />
                  </g>
                )}
                {/* as guias do encaixe: a linha em que o desenho arrastado grudou */}
                {arrasto?.tipo === 'mover' && (
                  <g style={{ pointerEvents: 'none' }} data-guias>
                    {arrasto.gx !== undefined && <line x1={arrasto.gx} y1={0} x2={arrasto.gx} y2={H} stroke={MAGENTA} strokeWidth={0.25} strokeDasharray="1.2,0.8" />}
                    {arrasto.gy !== undefined && <line x1={0} y1={arrasto.gy} x2={W} y2={arrasto.gy} stroke={MAGENTA} strokeWidth={0.25} strokeDasharray="1.2,0.8" />}
                  </g>
                )}
                {edicao.camada}
              </svg>
              {/* reescrever o título no lugar: a caixa na linha de base dele */}
              {titulo && (() => {
                // no papel (absoluta dentro dele, pela escala do papel na tela): anda com o zoom e com a folha rolando
                const pxPorMm = larguraPx / W;
                const base: Pt = [titulo.p[0] * pxPorMm, titulo.p[1] * pxPorMm];
                const fonte = Math.max(10, LETRA.titulo * pxPorMm);
                return (
                  <input
                    autoFocus
                    aria-label="Título"
                    data-titulo-no-lugar
                    value={titulo.texto}
                    onChange={(e) => setTitulo({ ...titulo, texto: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmarTitulo();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        tituloRef.current = null;
                        setTitulo(null);
                      }
                    }}
                    onBlur={confirmarTitulo}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', left: base[0] - 3, top: base[1] - fonte * 1.05, zIndex: 50,
                      font: `${fonte}px Arial, sans-serif`, padding: '0 2px', border: `1px solid ${AZUL}`, background: '#ffffff', color: '#262626',
                      outline: 'none', width: Math.max(140, (titulo.texto.length + 2) * fonte * 0.6),
                    }}
                  />
                );
              })()}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <button type="button" className="btn-caixa" onClick={adicionarFolha}>Nova folha</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A caixa do texto da chamada (girada), deslocada de (dx, dy) mm, como pontos de <polygon>. */
function pontosDoTexto(c: ChamadaNaFolha, dx: number, dy: number): string {
  return cantosDoTexto([c.texto[0] + dx, c.texto[1] + dy], c.giro, c.largura, c.tam).map((p) => `${p[0]},${p[1]}`).join(' ');
}

/** O lugar de um desenho que ainda não chegou: o nome no meio do quadro tracejado. */
function pendenteRotulo(pendente: boolean, x: number, y: number, w: number, h: number, nome: string) {
  if (!pendente) return null;
  return (
    <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize={Math.min(6, h / 6)} fill="#8a8a8a" style={{ pointerEvents: 'none', fontFamily: 'Arial, sans-serif' }}>
      {nome}
    </text>
  );
}
