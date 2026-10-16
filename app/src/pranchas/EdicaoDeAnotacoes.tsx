// ═══════════════════════════════════════════════════════════════════════════
//  pranchas/EdicaoDeAnotacoes.tsx — mexer nas anotações de um desenho
// ---------------------------------------------------------------------------
//  Jose, 15/10: "deletar ou criar cotas e mover anotações em geral, escrever de
//  novo o que quiser"; 16/10: "liberar de fato essas manipulações nas abas" e,
//  na folha, "duplo clique e entrar nele". A MESMA edição vale nos dois lugares:
//  a aba de desenho (a vista sozinha, na escala dela) e a folha (o desenho em
//  que se entrou com duplo clique). O que muda é só quem dá as coordenadas.
//
//  Clicar numa cota ou texto seleciona; arrastar o texto move o texto, arrastar
//  a linha da cota afasta a cota; duplo clique reescreve no lugar; Delete
//  esconde a automática (volta por "Mostrar ocultas") e apaga a criada.
//  Ferramentas Cota (D) e Texto (T), as teclas do A-PORT; Esc volta um passo.
//  Com a ferramenta armada nada se seleciona — o clique é da ferramenta.
//
//  COTA DE VERDADE (Jose, 16/10: "não limitar a cota a mover pra trás e pra
//  frente"): a cota escolhida mostra as duas ALÇAS das pontas (os pontos
//  medidos) — arrastada, a ponta captura outro ponto do desenho e a cota passa a
//  medir até ele (a automática puxada pela ponta vira cota do projetista: a
//  medida dela é a dele). A Cota cria em CADEIA, como a do Revit: os pontos em
//  sequência e, no fim, um clique no vazio — o lugar da linha; a linha da
//  cadeia anda junto. Prefixo e sufixo vão em volta do valor medido.
//
//  ETIQUETA DE AÇO (Jose, 16/10: "etiqueta de verdade de aço"; tecla I, a do
//  A-PORT): clica perto de uma barra e nasce a etiqueta dela ("N1 – 15 Ø10 c/40
//  C=210"), que se arrasta e gira como a chamada; com ou sem linha de chamada
//  (vale também para a chamada da coluna).
//
//  Tudo em mm de papel (a unidade da camada por cima do desenho): o arrasto
//  volta ao desenho dividido por k (mm por px de desenho), e o ponto da cota
//  criada vai para mm do MURO dividido por S (px de desenho por mm do muro) —
//  trocar a escala não tira a cota do lugar.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as PE, type ReactNode } from 'react';
import { ancoraDoTexto, cantosDoTexto, comecoDoTexto, girarNoMeio, normalizarGiro } from '@/desenhos/chamadas';
import { cm } from '@/desenhos/formato';
import { capturar, cotasDaCadeia, direcaoDaCadeia, paraOMuro, pontosDeCaptura, type LugarDoDesenho } from './ferramentas';
import { naAnotacao, naChamada, naCotaNova, naEtiqueta, noTextoNovo } from './acoes';
import { elementoDaBarra } from '@/desenhos/chamadas';
import type { Modelo } from '@/modelo/tipos';
import { novoId } from './padrao';
import { Linha, Numero, TextoConfirmado, estiloDosCampos as s } from './campos';
import type { AnotacaoNaFolha, ChamadaNaFolha, ItemPosto } from './folha';
import { CORPO_DA_COTA, type AnotacaoPosta, type ChamadaPosta, type CotaNova, type EtiquetaNova, type ItemDaFolha, type Primitiva, type Pt, type TextoNovo } from './tipos';

/** Um desenho que se pode anotar: onde ele está (mm), o que ele guarda (com a vista) e os traços dele (a captura). */
export interface DesenhoEditavel {
  posto: ItemPosto;
  item: ItemDaFolha;
  primitivas: readonly Primitiva[];
}

export type SelecaoDaEdicao = { tipo: 'chamada' | 'anotacao'; id: string; chave: string } | null;

/** A ferramenta armada (Cota: D; Texto: T; Etiqueta: I — as teclas do A-PORT). */
export type Ferramenta = 'cota' | 'texto' | 'etiqueta' | null;

/**
 * Os desenhos que desenham a etiqueta de barra (a vista frontal e o corte, onde a barra aparece inteira). Na planta e
 * na armação a ferramenta não arma: a etiqueta ficaria gravada sem nunca aparecer.
 */
export const aceitaEtiqueta = (d: DesenhoEditavel): boolean =>
  !!d.posto.S && (d.item.conteudo.tipo === 'frontal' || d.item.conteudo.tipo === 'corte');
/**
 * O teclado está num campo de escrever (as Entradas, o painel)? O Esc dali é do campo: não larga a seleção, não
 * desarma a ferramenta nem sai do desenho.
 */
export function teclaDeCampo(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Desenho em escala: onde dá para cotar e escrever (o isométrico e o 3D não têm medida). */
const emEscala = (d: DesenhoEditavel): boolean => !!(d.posto.S && d.posto.origem && d.posto.k);

/**
 * A barra embaixo do mouse, como "posição|elemento" (a chave da chamada), ou null. Procura no desenho (os traços
 * levam o id da barra) no ponto e, se não acha, numa roda de até 8 px em volta — a barra é um traço fino, e mirar
 * nela exata cansa.
 */
export function barraNaTela(e: { clientX: number; clientY: number }, raiz: Element | null, m: Modelo | null): string | null {
  if (!raiz || !m || typeof document.elementsFromPoint !== 'function') return null;
  const porId = new Map(m.barras.map((b) => [b.id, b]));
  // anel a anel, de 1 em 1 px: o traço da barra tem 1 a 2 px, e um anel de passo maior passava por cima dele
  for (const r of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    const passos = r ? 8 + 2 * r : 1;
    for (let k = 0; k < passos; k++) {
      const g = (2 * Math.PI * k) / passos;
      for (const el of document.elementsFromPoint(e.clientX + r * Math.cos(g), e.clientY + r * Math.sin(g))) {
        if (!raiz.contains(el)) continue;
        const b = porId.get(el.closest('[data-id]')?.getAttribute('data-id') ?? '');
        if (b) return `${b.posicao}|${elementoDaBarra(b)}`;
      }
    }
  }
  return null;
}

export interface OpcoesDaEdicao {
  desenhos: readonly DesenhoEditavel[];
  /** Grava a mudança no item (a folha manda para a vista; a aba muda a vista direto). */
  mudarItem: (id: string, f: (i: ItemDaFolha) => ItemDaFolha) => void;
  /** mm de papel por px de tela (as folgas do clique e da captura são em px de tela). */
  mmPorPx: number;
  /** O ponto do mouse na camada, mm. */
  ponto: (e: { clientX: number; clientY: number }) => Pt;
  /** O ponto da camada na tela (clientX, clientY): a caixa de escrever no lugar. */
  naTela: (p: Pt) => Pt | null;
  /** O foco do teclado na área do desenho (Delete só apaga com ele lá). */
  focar: () => void;
  temFoco: () => boolean;
  /** A edição pegou algo: quem tinha outra seleção (o desenho da folha) larga a dela. */
  aoSelecionar?: () => void;
  /** A barra embaixo do mouse (barraNaTela): sem isto, não há a ferramenta Etiqueta. */
  barraEm?: (e: { clientX: number; clientY: number }) => string | null;
}

/** O texto sendo escrito no lugar: o de uma anotação (chave) ou um novo (chave null), no ponto da linha de base. */
interface Escrita {
  id: string;
  chave: string | null;
  p: Pt;
  tam: number;
  texto: string;
}

/** O que está sendo arrastado: só a moldura azul anda; o desenho muda ao soltar. */
type Arrasto =
  | { tipo: 'chamada'; id: string; chave: string; px: number; py: number; dx: number; dy: number; solto: boolean }
  | { tipo: 'anotacao'; id: string; chave: string; parte: 'texto' | 'linha'; px: number; py: number; dx: number; dy: number; solto: boolean }
  /** A alça de uma ponta da cota: `p` = onde ela está agora (capturada num ponto do desenho, ou solta). */
  | { tipo: 'ponta'; id: string; chave: string; qual: 0 | 1; p: Pt; capturado: boolean; solto: boolean; px: number; py: number };

export const AZUL = '#0080ff';
/** A marca do ponto capturado (o laranja do osnap). */
const LARANJA = '#e8710a';
/** Raio da captura de ponto, px de tela (o do A-PORT é 14). */
const RAIO_DA_CAPTURA_PX = 12;
/** Folga do clique: menos que isto (px de tela) é tremida da mão, não arrasto. */
const FOLGA_DO_CLIQUE_PX = 3;

const dentro = (p: Pt, c: readonly number[]) => p[0] >= c[0] && p[0] <= c[0] + c[2] && p[1] >= c[1] && p[1] <= c[1] + c[3];

/** A caixa do texto da chamada (girada), deslocada de (dx, dy) mm, como pontos de <polygon>. */
function pontosDoTexto(c: ChamadaNaFolha, dx: number, dy: number): string {
  return cantosDoTexto([c.texto[0] + dx, c.texto[1] + dy], c.giro, c.largura, c.tam).map((p) => `${p[0]},${p[1]}`).join(' ');
}

export function useEdicaoDeAnotacoes(o: OpcoesDaEdicao) {
  const [sel, setSel] = useState<SelecaoDaEdicao>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(null);
  /** A cadeia que está saindo: os pontos já clicados (mm), no desenho em que começou. */
  const [cotaEmCurso, setCotaEmCurso] = useState<{ id: string; pontos: Pt[] } | null>(null);
  const [cursor, setCursor] = useState<{ p: Pt; capturado: boolean } | null>(null);
  const [escrita, setEscrita] = useState<Escrita | null>(null);
  const escritaRef = useRef<Escrita | null>(null);
  escritaRef.current = escrita;

  const selecionar = (x: SelecaoDaEdicao) => {
    setSel(x);
    if (x) o.aoSelecionar?.();
  };
  const desenho = (id: string) => o.desenhos.find((d) => d.posto.id === id) ?? null;

  // ── as chamadas ───────────────────────────────────────────────────────────
  const chamadaNaFolha = (id: string, chave: string): ChamadaNaFolha | null => desenho(id)?.posto.chamadas?.find((c) => c.chave === chave) ?? null;
  /**
   * Muda a chamada (ChamadaPosta). A etiqueta posta pelo projetista mora nas etiquetas da vista: o mesmo gesto (arrastar,
   * girar, a linha de chamada) cai nela, e esconder a etiqueta é apagá-la.
   */
  const mudarChamada = (id: string, chave: string, f: (c: ChamadaPosta) => ChamadaPosta | null) => {
    if (chamadaNaFolha(id, chave)?.etiqueta) {
      o.mudarItem(id, (i) =>
        naEtiqueta(i, chave, (e) => {
          const r = f({ dx: e.dx, dy: e.dy, ...(e.giro ? { giro: e.giro } : {}), ...(e.semLinha ? { semLinha: true } : {}) });
          if (!r || r.oculta) return null;
          const { giro: _g, semLinha: _s, ...base } = e;
          const n: EtiquetaNova = { ...base, dx: r.dx ?? e.dx, dy: r.dy ?? e.dy };
          if (r.giro) n.giro = r.giro;
          if (r.semLinha) n.semLinha = true;
          return n;
        }),
      );
      return;
    }
    o.mudarItem(id, (i) => naChamada(i, chave, f));
  };
  /** Liga ou desliga a linha de chamada da chamada (ou etiqueta) escolhida. */
  const comLinha = (id: string, chave: string, liga: boolean) =>
    mudarChamada(id, chave, ({ semLinha: _s, ...q }) => (liga ? q : { ...q, semLinha: true }));
  /** Esconde a chamada (volta por "Mostrar ocultas"); a etiqueta se apaga. */
  const esconderChamada = (id: string, chave: string) => {
    mudarChamada(id, chave, (c) => ({ ...c, oculta: true }));
    setSel(null);
  };
  /** Gira a chamada selecionada para `giro` em torno do meio do texto (px de desenho: o mm dividido por k). */
  const girarChamada = (giro: number) => {
    if (sel?.tipo !== 'chamada') return;
    const c = chamadaNaFolha(sel.id, sel.chave);
    if (!c) return;
    const g = normalizarGiro(giro);
    const [dx, dy] = girarNoMeio([c.dx, c.dy], c.giro, g, c.largura / c.k, c.tam / c.k);
    mudarChamada(sel.id, sel.chave, (q) => ({ ...q, dx, dy, giro: g }));
  };

  // ── as anotações (cota, texto) ────────────────────────────────────────────
  const anotacaoNaFolha = (id: string, chave: string): { a: AnotacaoNaFolha; posto: ItemPosto } | null => {
    const posto = desenho(id)?.posto;
    const a = posto?.anotacoes?.find((q) => q.chave === chave);
    return posto && a ? { a, posto } : null;
  };
  /** Muda o que se guarda da anotação: o ajuste da automática, ou a própria cota/texto criado. */
  const mudarAnotacao = (
    id: string,
    a: AnotacaoNaFolha,
    f: { auto?: (q: AnotacaoPosta) => AnotacaoPosta | null; cota?: (c: CotaNova) => CotaNova | null; texto?: (t: TextoNovo) => TextoNovo | null },
  ) => {
    // A automática guarda o texto de origem (muro mudou e o texto também: o reescrito e o esconder caem) e, se a
    // chave é pela ordem ("#n"), onde ela estava, em mm do muro e refeito a cada mexida (AnotacaoPosta.ref): se uma de
    // antes com o mesmo texto mudar, sumir ou aparecer, a herdeira da chave não herda o ajuste. Ajuste que ficou só
    // com o lugar e o texto de origem não é ajuste.
    const auto = f.auto;
    const S = desenho(id)?.posto.S;
    const pelaOrdem = /#\d+$/.test(a.chave);
    const comLugar = auto && ((q: AnotacaoPosta): AnotacaoPosta | null => {
      const r = auto(q);
      if (!r || !Object.keys(r).some((k) => k !== 'ref' && k !== 'original')) return null;
      const { ref: _r, ...resto } = r;
      const x: AnotacaoPosta = { ...resto, original: a.original };
      if (pelaOrdem && S) x.ref = [a.origemPx[0] / S, a.origemPx[1] / S];
      return x;
    });
    o.mudarItem(id, (i) => {
      if (!a.nova) return comLugar ? naAnotacao(i, a.chave, comLugar) : i;
      if (a.tipo === 'cota') return f.cota ? naCotaNova(i, a.chave, f.cota) : i;
      return f.texto ? noTextoNovo(i, a.chave, f.texto) : i;
    });
  };
  /** Delete: a automática se esconde (volta por "Mostrar ocultas"), a criada se apaga. */
  const tirarAnotacao = (id: string, chave: string) => {
    const r = anotacaoNaFolha(id, chave);
    if (!r) return;
    mudarAnotacao(id, r.a, { auto: (q) => ({ ...q, oculta: true }), cota: () => null, texto: () => null });
    setSel(null);
  };
  /** Escrever de novo: igual ao de origem volta ao automático; em branco, a automática se esconde e a criada se apaga. */
  const reescrever = (id: string, chave: string, texto: string) => {
    const r = anotacaoNaFolha(id, chave);
    if (!r) return;
    const vazio = !texto.trim();
    mudarAnotacao(id, r.a, {
      auto: ({ texto: _t, ...q }) => (vazio ? { ...q, oculta: true } : texto === r.a.original ? q : { ...q, texto }),
      cota: ({ texto: _t, ...c }) => (vazio ? null : texto === r.a.original ? c : { ...c, texto }),
      texto: (t) => (vazio ? null : { ...t, texto }),
    });
    if (vazio) setSel(null);
  };
  /** Gira o texto em torno do meio dele (as contas em px de desenho: o mm de papel ÷ k). */
  const girarAnotacao = (id: string, chave: string, giro: number) => {
    const r = anotacaoNaFolha(id, chave);
    if (!r || r.a.tipo !== 'texto' || !r.posto.k || !r.posto.origem) return;
    const { a, posto } = r;
    const k = posto.k!;
    const g = normalizarGiro(giro);
    const [w, tam] = [a.largura / k, a.tam / k];
    const p: Pt = [(a.p[0] - posto.origem![0]) / k, (a.p[1] - posto.origem![1]) / k];
    const novo = ancoraDoTexto(girarNoMeio(comecoDoTexto(p, a.ancora, a.giro, w), a.giro, g, w, tam), a.ancora, g, w);
    const [ddx, ddy] = [novo[0] - p[0], novo[1] - p[1]];
    const S = posto.S ?? 1;
    mudarAnotacao(id, a, {
      auto: (q) => ({ ...q, dx: (q.dx ?? 0) + ddx, dy: (q.dy ?? 0) + ddy, giro: g }),
      texto: (t) => ({ ...t, p: [t.p[0] + ddx / S, t.p[1] + ddy / S], giro: g }),
    });
  };
  /** Escreve no lugar: a caixa de texto em cima do texto (na linha de base dele). */
  const escreverNoLugar = (id: string, a: AnotacaoNaFolha) =>
    setEscrita({ id, chave: a.chave, p: comecoDoTexto(a.p, a.ancora, a.giro, a.largura), tam: a.tam, texto: a.texto });
  const confirmarEscrita = () => {
    // pela ref: o Enter confirma e tira a caixa, e a caixa que sai ainda dispara o blur — a segunda vez não acha nada
    const ed = escritaRef.current;
    escritaRef.current = null;
    setEscrita(null);
    if (!ed) return;
    if (ed.chave) {
      const r = anotacaoNaFolha(ed.id, ed.chave);
      if (r && ed.texto !== r.a.texto) reescrever(ed.id, ed.chave, ed.texto);
      return;
    }
    // texto novo: guardado em mm do muro, no ponto clicado
    const d = desenho(ed.id);
    const l = d && lugarDe(d.posto, ed.p);
    if (!ed.texto.trim() || !l) return;
    const t: TextoNovo = { id: novoId('t'), p: paraOMuro(ed.p, l), texto: ed.texto };
    if (l.regiao) t.regiao = l.regiao;
    o.mudarItem(ed.id, (i) => ({ ...i, textos: [...(i.textos ?? []), t] }));
    selecionar({ tipo: 'anotacao', id: ed.id, chave: t.id });
  };

  // o desenho anotado mudou (saiu-se dele, trocou a folha, a vista, o muro): a ferramenta armada, a cota pela metade e
  // a seleção eram do outro — sem isto a mira cobria a folha inteira com os botões já desabilitados (só o Esc soltava)
  const quais = o.desenhos.map((d) => d.posto.id).join('|');
  useEffect(() => {
    setFerramenta(null);
    setCotaEmCurso(null);
    setCursor(null);
    setSel(null);
  }, [quais]);

  // ── as ferramentas (Cota e Texto) ─────────────────────────────────────────
  /** Arma (ou desarma) uma ferramenta: o que estava em curso e a seleção vão embora. */
  const armar = (f: Ferramenta) => {
    setFerramenta(f);
    setCotaEmCurso(null);
    setCursor(null);
    if (f) setSel(null);
    o.focar();
  };
  /** O desenho em escala (onde dá para cotar e escrever) embaixo do ponto. */
  const desenhoEditavelEm = (p: Pt): DesenhoEditavel | null =>
    o.desenhos.find((d) => emEscala(d) && dentro(p, d.posto.caixa)) ?? null;
  const desenhoDaCota = (): DesenhoEditavel | null => (cotaEmCurso ? desenho(cotaEmCurso.id) : null);
  /**
   * Onde o desenho está para guardar o ponto em mm do muro. Ponto dentro de uma parte com origem própria (a seção da
   * armação, a sombra de um estribo): conta da origem dela, e a anotação leva o nome da parte. Duas partes que se
   * encostam: vale a menor, a mais específica.
   */
  const lugarDe = (it: ItemPosto, p?: Pt): (LugarDoDesenho & { regiao?: string }) | null => {
    if (!it.origem || !it.k || !it.S) return null;
    const r = p && it.regioes?.filter((q) => dentro(p, q.caixa)).sort((m, n) => m.caixa[2] * m.caixa[3] - n.caixa[2] * n.caixa[3])[0];
    return r ? { origem: r.origem, k: it.k, S: it.S, regiao: r.nome } : { origem: it.origem, k: it.k, S: it.S };
  };
  // os pontos que a captura pega, por desenho, refeitos quando os traços mudam
  const captura = useRef(new Map<readonly Primitiva[], Pt[]>());
  const pontosDoDesenho = (d: DesenhoEditavel): Pt[] => {
    let ps = captura.current.get(d.primitivas);
    if (!ps) {
      if (captura.current.size > 8) captura.current.clear();
      ps = pontosDeCaptura([...d.primitivas]);
      captura.current.set(d.primitivas, ps);
    }
    return ps;
  };
  /** O ponto da ferramenta: na cota, o ponto do desenho capturado perto do mouse (ou o próprio mouse). */
  const pontoDaFerramenta = (p: Pt, d: DesenhoEditavel | null, capturando: boolean): { p: Pt; capturado: boolean } => {
    if (!capturando || !d) return { p, capturado: false };
    const q = capturar(pontosDoDesenho(d), p, RAIO_DA_CAPTURA_PX * o.mmPorPx);
    return q ? { p: q, capturado: true } : { p, capturado: false };
  };

  /** O clique com a ferramenta armada. Devolve se era dela. */
  const apertarComFerramenta = (e: PE): boolean => {
    if (!ferramenta || e.button !== 0) return false;
    e.stopPropagation();
    o.focar();
    const bruto = o.ponto(e);
    if (ferramenta === 'etiqueta') {
      // clique perto da barra: a etiqueta nasce acima e à direita do ponto; a ferramenta fica armada para a próxima
      const d = desenhoEditavelEm(bruto);
      const barra = d && aceitaEtiqueta(d) && o.barraEm?.(e);
      const l = d && lugarDe(d.posto, bruto);
      if (!d || !barra || !l) return true;
      const nova: EtiquetaNova = { id: novoId('e'), barra, ponto: paraOMuro(bruto, l), dx: 14, dy: -14 };
      o.mudarItem(d.posto.id, (i) => ({ ...i, etiquetas: [...(i.etiquetas ?? []), nova] }));
      return true;
    }
    if (ferramenta === 'texto') {
      // clique e escreve; o Texto desarma depois de um (como no A-PORT)
      const d = desenhoEditavelEm(bruto);
      if (!d?.posto.k) return true;
      // sem o mousedown que vem depois deste pointerdown: ele levaria o foco para a prancheta e o campo de escrever,
      // que acabou de nascer, se fecharia vazio. E desarma sem o armar(null), que também puxaria o foco
      e.preventDefault();
      setEscrita({ id: d.posto.id, chave: null, p: bruto, tam: CORPO_DA_COTA * d.posto.k, texto: '' });
      setFerramenta(null);
      setCotaEmCurso(null);
      setCursor(null);
      return true;
    }
    // cota: os pontos em sequência (capturados no desenho) e, no fim, um clique no vazio — o lugar da linha. Os dois
    // primeiros cliques são sempre pontos; daí em diante, ponto capturado é mais um ponto da cadeia e clique solto é o
    // lugar da linha: a cadeia sai inteira, de uma vez (a cota do Revit)
    const d = cotaEmCurso ? desenhoDaCota() : desenhoEditavelEm(bruto);
    if (!d) {
      setCotaEmCurso(null);
      return true;
    }
    const q = pontoDaFerramenta(bruto, d, true);
    if (!cotaEmCurso) {
      setCotaEmCurso({ id: d.posto.id, pontos: [q.p] });
      return true;
    }
    const pts = cotaEmCurso.pontos;
    const ultimo = pts[pts.length - 1];
    if (pts.length < 2 || q.capturado) {
      // o mesmo ponto duas vezes não é cota: espera outro
      if (Math.hypot(q.p[0] - ultimo[0], q.p[1] - ultimo[1]) > 0.2) setCotaEmCurso({ ...cotaEmCurso, pontos: [...pts, q.p] });
      return true;
    }
    // a parte do desenho é a do PRIMEIRO ponto: a cadeia inteira conta da origem dela
    const l = lugarDe(d.posto, pts[0]);
    if (!l) {
      setCotaEmCurso(null);
      return true;
    }
    const novas = cotasDaCadeia(() => novoId('c'), pts, bruto, l, novoId('k'));
    if (l.regiao) for (const c of novas) c.regiao = l.regiao;
    if (novas.length) o.mudarItem(d.posto.id, (i) => ({ ...i, cotas: [...(i.cotas ?? []), ...novas] }));
    setCotaEmCurso(null);
    return true;
  };

  // ── arrastar ──────────────────────────────────────────────────────────────
  const pegar = (e: PE, a: Arrasto) => {
    e.stopPropagation();
    o.focar();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setArrasto(a);
  };
  const mover = (e: PE) => {
    if (ferramenta) {
      const p = o.ponto(e);
      setCursor(pontoDaFerramenta(p, desenhoDaCota() ?? desenhoEditavelEm(p), ferramenta === 'cota'));
    }
    if (!arrasto) return;
    const [x, y] = o.ponto(e);
    const solto = arrasto.solto || Math.hypot(x - arrasto.px, y - arrasto.py) > FOLGA_DO_CLIQUE_PX * o.mmPorPx;
    if (arrasto.tipo === 'ponta') {
      // a ponta procura um ponto do desenho perto do mouse (o osnap); longe de tudo, fica onde o mouse está
      const q = pontoDaFerramenta([x, y], desenho(arrasto.id), true);
      setArrasto({ ...arrasto, p: q.p, capturado: q.capturado, solto });
      return;
    }
    const dx = Math.round((x - arrasto.px) * 2) / 2;
    const dy = Math.round((y - arrasto.py) * 2) / 2;
    setArrasto({ ...arrasto, dx: solto ? dx : 0, dy: solto ? dy : 0, solto });
  };
  const soltar = () => {
    const a = arrasto;
    setArrasto(null);
    if (!a) return;
    if (a.tipo === 'ponta') {
      if (a.solto) levarAPonta(a.id, a.chave, a.qual, a.p);
      return;
    }
    if (!(a.dx || a.dy)) return;
    if (a.tipo === 'chamada') {
      // o arrasto (mm de papel) volta ao desenho (px): a chamada guarda o lugar contado do ponto da barra
      const c = chamadaNaFolha(a.id, a.chave);
      if (c) mudarChamada(a.id, a.chave, (q) => ({ ...q, dx: c.dx + a.dx / c.k, dy: c.dy + a.dy / c.k, giro: c.giro }));
      return;
    }
    // de mm de papel a px de desenho (÷ k); o texto criado anda em mm do muro (÷ S)
    const r = anotacaoNaFolha(a.id, a.chave);
    if (!r?.posto.k) return;
    const S = r.posto.S ?? 1;
    const [px, py] = [a.dx / r.posto.k, a.dy / r.posto.k];
    if (a.parte === 'linha') {
      const d = r.a.eixo === 'v' ? px : py;
      // a cadeia anda junto: todas as cotas dela ficam na mesma linha
      if (r.a.nova && r.a.cadeia) {
        const cadeia = r.a.cadeia;
        o.mudarItem(a.id, (i) => ({ ...i, cotas: (i.cotas ?? []).map((c) => (c.cadeia === cadeia ? { ...c, linha: [c.linha[0] + px / S, c.linha[1] + py / S] as Pt } : c)) }));
        return;
      }
      mudarAnotacao(a.id, r.a, {
        auto: (q) => ({ ...q, afastamento: (q.afastamento ?? 0) + d }),
        cota: (c) => ({ ...c, linha: [c.linha[0] + px / S, c.linha[1] + py / S] }),
      });
    } else {
      mudarAnotacao(a.id, r.a, {
        auto: (q) => ({ ...q, dx: (q.dx ?? 0) + px, dy: (q.dy ?? 0) + py }),
        cota: (c) => ({ ...c, dx: (c.dx ?? 0) + px, dy: (c.dy ?? 0) + py }),
        texto: (t) => ({ ...t, p: [t.p[0] + px / S, t.p[1] + py / S] }),
      });
    }
  };

  /**
   * A ponta `qual` da cota vai para `p` (mm). Na cota do projetista, o ponto guardado muda (na cadeia, a vizinha que
   * dividia o ponto vai junto, como a linha de chamada do Revit). A automática puxada pela ponta vira cota do
   * projetista no mesmo lugar (mesma linha, mesmo prefixo e sufixo) e a automática se esconde — a medida passa a ser
   * a do ponto que ele escolheu.
   */
  const levarAPonta = (id: string, chave: string, qual: 0 | 1, p: Pt) => {
    const r = anotacaoNaFolha(id, chave);
    if (!r) return;
    const { a, posto } = r;
    const [pontasA, linhaA] = [a.pontas, a.linha];
    if (!pontasA || !linhaA) return;
    if (a.nova) {
      const cota = desenho(id)?.item.cotas?.find((c) => c.id === chave);
      if (!cota) return;
      const reg = cota.regiao ? posto.regioes?.find((q) => q.nome === cota.regiao) : undefined;
      const l: LugarDoDesenho | null = posto.origem && posto.k && posto.S ? { origem: reg?.origem ?? posto.origem, k: posto.k, S: posto.S } : null;
      if (!l) return;
      const novo = paraOMuro(p, l);
      // qual ponto guardado é esta ponta: as pontas saem ordenadas (a de menor x ou y primeiro)
      const eixo = cota.direcao === 'h' ? 0 : 1;
      const daPonta: 'a' | 'b' = (cota.a[eixo] <= cota.b[eixo]) === (qual === 0) ? 'a' : 'b';
      const velho = cota[daPonta];
      const mesmo = (q: Pt) => Math.abs(q[0] - velho[0]) < 0.5 && Math.abs(q[1] - velho[1]) < 0.5;
      o.mudarItem(id, (i) => ({
        ...i,
        cotas: (i.cotas ?? []).map((c) => {
          if (c.id === cota.id) return { ...c, [daPonta]: novo };
          if (!cota.cadeia || c.cadeia !== cota.cadeia) return c;
          return mesmo(c.a) ? { ...c, a: novo } : mesmo(c.b) ? { ...c, b: novo } : c;
        }),
      }));
      return;
    }
    // a automática vira cota do projetista
    const l = lugarDe(posto, pontasA[0]);
    if (!l) return;
    const pontas: [Pt, Pt] = qual === 0 ? [p, pontasA[1]] : [pontasA[0], p];
    const direcao = a.eixo ?? 'h';
    const nova: CotaNova = { id: novoId('c'), a: paraOMuro(pontas[0], l), b: paraOMuro(pontas[1], l), linha: paraOMuro(linhaA[0], l), direcao };
    if (l.regiao) nova.regiao = l.regiao;
    const ajuste = desenho(id)?.item.anotacoes?.[chave];
    if (ajuste?.prefixo) nova.prefixo = ajuste.prefixo;
    if (ajuste?.sufixo) nova.sufixo = ajuste.sufixo;
    o.mudarItem(id, (i) => naAnotacao({ ...i, cotas: [...(i.cotas ?? []), nova] }, chave, (q) => ({ ...q, oculta: true, original: a.original })));
    selecionar({ tipo: 'anotacao', id, chave: nova.id });
  };

  /** Prefixo ou sufixo da cota escolhida: em volta do valor medido (vazio tira). */
  const mudarEmVolta = (id: string, chave: string, campo: 'prefixo' | 'sufixo', valor: string) => {
    const r = anotacaoNaFolha(id, chave);
    if (!r) return;
    const v = valor.length ? valor : undefined;
    const com = <T extends { prefixo?: string; sufixo?: string }>(x: T): T => {
      const y = { ...x };
      if (v === undefined) delete y[campo];
      else y[campo] = v;
      return y;
    };
    mudarAnotacao(id, r.a, { auto: (q) => com(q), cota: (c) => com(c) });
  };

  // ── o teclado ─────────────────────────────────────────────────────────────
  /** Esc volta um passo da ferramenta (ou larga a seleção); D e T armam; Delete tira a selecionada. Devolve se usou. */
  const teclar = (e: KeyboardEvent): boolean => {
    if (escritaRef.current || teclaDeCampo(e)) return false;
    if (e.key === 'Escape') {
      if (cotaEmCurso) setCotaEmCurso(cotaEmCurso.pontos.length > 1 ? { ...cotaEmCurso, pontos: cotaEmCurso.pontos.slice(0, -1) } : null);
      else if (ferramenta) armar(null);
      else if (sel) setSel(null);
      else return false;
      return true;
    }
    if (!o.temFoco() || !o.desenhos.some(emEscala)) return false;
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      armar('cota');
      return true;
    }
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      armar('texto');
      return true;
    }
    if ((e.key === 'i' || e.key === 'I') && o.barraEm && o.desenhos.some(aceitaEtiqueta)) {
      e.preventDefault();
      armar('etiqueta');
      return true;
    }
    if (!(e.key === 'Delete' || e.key === 'Backspace') || !sel) return false;
    if (sel.tipo === 'chamada') esconderChamada(sel.id, sel.chave);
    else tirarAnotacao(sel.id, sel.chave);
    e.preventDefault();
    return true;
  };

  // ── a caixa de escrever no lugar ──────────────────────────────────────────
  // Dentro do próprio desenho (foreignObject, em mm de papel): anda junto com o zoom e o arrasto. Posta na tela pela
  // conta da tela, ela ficava um passo atrás (a conta lia o quadro anterior) e parada quando a folha rolava.
  const LINHA_DA_CAIXA = 0.25;
  // (a alça da ponta da cota é #fefefe e não #ffffff: o tema escuro repinta o branco do desenho de escuro, e a alça
  // é da edição, não do desenho)
  const escritaNoLugar: ReactNode = escrita ? (
    <foreignObject
      x={escrita.p[0] - escrita.tam * 0.3} y={escrita.p[1] - escrita.tam * 1.3}
      width={Math.max(escrita.tam * 12, (escrita.texto.length + 3) * escrita.tam * 0.62)} height={escrita.tam * 1.75}
      style={{ overflow: 'visible' }}
    >
      <input
        autoFocus
        aria-label="Texto"
        data-edicao-no-lugar
        value={escrita.texto}
        onChange={(e) => setEscrita({ ...escrita, texto: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmarEscrita();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            escritaRef.current = null;
            setEscrita(null);
          }
        }}
        onBlur={confirmarEscrita}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          boxSizing: 'border-box', width: '100%', height: '100%', margin: 0,
          font: `${escrita.tam}px Arial, sans-serif`, padding: `0 ${escrita.tam * 0.15}px`,
          border: `${LINHA_DA_CAIXA}px solid ${AZUL}`, borderRadius: 0, background: '#ffffff', color: '#262626', outline: 'none',
        } as CSSProperties}
      />
    </foreignObject>
  ) : null;

  // ── o que vai na camada por cima do desenho ───────────────────────────────
  const camada: ReactNode = (
    <>
      {/* com a ferramenta armada o clique é dela: nada embaixo se pega */}
      {/* o duplo clique aqui é da edição (dois cliques rápidos da cota, a linha, a alça): não reenquadra a aba nem sai
          do desenho na folha */}
      {ferramenta && <rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill="transparent" style={{ cursor: 'crosshair', pointerEvents: 'all' }} onDoubleClick={(e) => e.stopPropagation()} />}
      <g style={{ pointerEvents: ferramenta ? 'none' : undefined }} onDoubleClick={(e) => e.stopPropagation()}>
        {/* as cotas e os textos: o texto se arrasta pelo texto, a cota se afasta pela linha; duplo clique reescreve */}
        {o.desenhos.map(({ posto: it }) =>
          it.anotacoes?.filter((q) => !q.oculta).map((q) => {
            const ar = arrasto?.tipo === 'anotacao' && arrasto.id === it.id && arrasto.chave === q.chave ? arrasto : null;
            const ligada = (sel?.tipo === 'anotacao' && sel.id === it.id && sel.chave === q.chave) || !!ar;
            const [tdx, tdy] = ar?.parte === 'texto' ? [ar.dx, ar.dy] : [0, 0];
            const [ldx, ldy] = ar?.parte === 'linha' ? (q.eixo === 'v' ? [ar.dx, 0] : [0, ar.dy]) : [0, 0];
            const caixa = cantosDoTexto(comecoDoTexto([q.p[0] + tdx + ldx, q.p[1] + tdy + ldy], q.ancora, q.giro, q.largura), q.giro, q.largura, q.tam)
              .map((p) => `${p[0]},${p[1]}`)
              .join(' ');
            const pegarParte = (parte: 'texto' | 'linha') => (e: PE) => {
              if (e.button !== 0) return;
              selecionar({ tipo: 'anotacao', id: it.id, chave: q.chave });
              const [px, py] = o.ponto(e);
              pegar(e, { tipo: 'anotacao', id: it.id, chave: q.chave, parte, px, py, dx: 0, dy: 0, solto: false });
            };
            return (
              <g key={`${it.id}|${q.chave}`}>
                {q.linha && (
                  <>
                    {ligada && (
                      <line x1={q.linha[0][0] + ldx} y1={q.linha[0][1] + ldy} x2={q.linha[1][0] + ldx} y2={q.linha[1][1] + ldy} stroke={AZUL} strokeWidth={0.35} style={{ pointerEvents: 'none' }} />
                    )}
                    <line
                      x1={q.linha[0][0]} y1={q.linha[0][1]} x2={q.linha[1][0]} y2={q.linha[1][1]}
                      stroke="transparent" strokeWidth={1.6}
                      style={{ cursor: q.eixo === 'v' ? 'ew-resize' : 'ns-resize', pointerEvents: 'stroke' }}
                      data-linha-da-cota={q.chave}
                      onPointerDown={pegarParte('linha')}
                    />
                  </>
                )}
                {/* as alças das pontas: a cota escolhida pode ir medir outro ponto */}
                {ligada && q.tipo === 'cota' && q.pontas && q.pontas.map((pt, k) => {
                  const ap = arrasto?.tipo === 'ponta' && arrasto.id === it.id && arrasto.chave === q.chave && arrasto.qual === k && arrasto.solto ? arrasto : null;
                  return (
                    <g key={`ponta${k}`}>
                      {ap && <line x1={pt[0]} y1={pt[1]} x2={ap.p[0]} y2={ap.p[1]} stroke={AZUL} strokeWidth={0.25} strokeDasharray="1,0.8" style={{ pointerEvents: 'none' }} />}
                      {ap?.capturado && <rect x={ap.p[0] - 1} y={ap.p[1] - 1} width={2} height={2} fill="none" stroke={LARANJA} strokeWidth={0.35} style={{ pointerEvents: 'none' }} />}
                      <circle
                        cx={pt[0]} cy={pt[1]} r={0.9} fill="#fefefe" stroke={AZUL} strokeWidth={0.3}
                        style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                        data-ponta-da-cota={`${q.chave}|${k}`}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          const [px, py] = o.ponto(e);
                          pegar(e, { tipo: 'ponta', id: it.id, chave: q.chave, qual: k as 0 | 1, p: pt, capturado: false, solto: false, px, py });
                        }}
                      />
                    </g>
                  );
                })}
                <polygon
                  points={caixa}
                  fill="transparent"
                  stroke={ligada ? AZUL : 'transparent'}
                  strokeWidth={0.3}
                  style={{ cursor: 'move', pointerEvents: 'all' }}
                  data-anotacao={q.chave}
                  onPointerDown={pegarParte('texto')}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    escreverNoLugar(it.id, q);
                  }}
                />
              </g>
            );
          }),
        )}
        {/* as chamadas das barras: clicar seleciona, arrastar põe onde quiser */}
        {o.desenhos.map(({ posto: it }) =>
          it.chamadas?.filter((c) => !c.oculta).map((c) => {
            const a = arrasto?.tipo === 'chamada' && arrasto.id === it.id && arrasto.chave === c.chave ? arrasto : null;
            const ligada = (sel?.tipo === 'chamada' && sel.id === it.id && sel.chave === c.chave) || !!a;
            const [dx, dy] = a ? [a.dx, a.dy] : [0, 0];
            return (
              <g key={`${it.id}|${c.chave}`}>
                {a && (a.dx || a.dy) ? (
                  <line x1={c.ancora[0]} y1={c.ancora[1]} x2={c.texto[0] + dx} y2={c.texto[1] + dy} stroke={AZUL} strokeWidth={0.25} strokeDasharray="1,0.8" style={{ pointerEvents: 'none' }} />
                ) : null}
                <polygon
                  points={pontosDoTexto(c, dx, dy)}
                  fill="transparent"
                  stroke={ligada ? AZUL : 'transparent'}
                  strokeWidth={0.3}
                  style={{ cursor: 'move', pointerEvents: 'all' }}
                  data-chamada={c.chave}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    selecionar({ tipo: 'chamada', id: it.id, chave: c.chave });
                    const [px, py] = o.ponto(e);
                    pegar(e, { tipo: 'chamada', id: it.id, chave: c.chave, px, py, dx: 0, dy: 0, solto: false });
                  }}
                />
              </g>
            );
          }),
        )}
      </g>
      {/* a ferramenta: o ponto capturado (quadrado laranja) e a cota que está saindo */}
      {ferramenta && (
        <g style={{ pointerEvents: 'none' }}>
          {cotaEmCurso && (() => {
            const pts = cotaEmCurso.pontos;
            const c = cursor?.p ?? pts[pts.length - 1];
            if (pts.length < 2) return <line x1={pts[0][0]} y1={pts[0][1]} x2={c[0]} y2={c[1]} stroke={AZUL} strokeWidth={0.25} strokeDasharray="1,0.8" />;
            const it = desenhoDaCota()?.posto;
            // com o cursor num ponto capturado, ele é o próximo ponto (a linha fica onde estava); solto, é o lugar da linha
            const [lista, lugar] = cursor?.capturado ? [[...pts, c], pts[0]] : [pts, c];
            const dir = direcaoDaCadeia(lista, cursor?.capturado ? [c[0] + 1e-3, c[1]] : lugar);
            const linhaEm = cursor?.capturado ? null : lugar;
            return (
              <g stroke={AZUL} fill="none">
                {lista.slice(1).map((b, k) => {
                  const a = lista[k];
                  const lv = linhaEm ?? (dir === 'h' ? [0, Math.min(a[1], b[1]) - 6] : [Math.min(a[0], b[0]) - 6, 0]);
                  const [p1, p2]: [Pt, Pt] = dir === 'h' ? [[a[0], lv[1]], [b[0], lv[1]]] : [[lv[0], a[1]], [lv[0], b[1]]];
                  const medida = it?.k && it.S ? cm((dir === 'h' ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1])) / it.k / it.S) : '';
                  return (
                    <g key={k}>
                      <line x1={a[0]} y1={a[1]} x2={p1[0]} y2={p1[1]} strokeWidth={0.2} strokeDasharray="0.8,0.6" />
                      <line x1={b[0]} y1={b[1]} x2={p2[0]} y2={p2[1]} strokeWidth={0.2} strokeDasharray="0.8,0.6" />
                      <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} strokeWidth={0.35} />
                      <text x={(p1[0] + p2[0]) / 2} y={(p1[1] + p2[1]) / 2 - 1} fontSize={2.5} fill={AZUL} stroke="none" textAnchor="middle" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {medida}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}
          {cotaEmCurso?.pontos.map((p, k) => <circle key={k} cx={p[0]} cy={p[1]} r={0.6} fill={AZUL} />)}
          {cursor?.capturado && <rect x={cursor.p[0] - 1} y={cursor.p[1] - 1} width={2} height={2} fill="none" stroke={LARANJA} strokeWidth={0.35} />}
        </g>
      )}
      {escritaNoLugar}
    </>
  );

  // ── o painel do que está selecionado ──────────────────────────────────────
  const chamadaSel = sel?.tipo === 'chamada' ? chamadaNaFolha(sel.id, sel.chave) : null;
  const anotSel = sel?.tipo === 'anotacao' ? anotacaoNaFolha(sel.id, sel.chave) : null;
  const ajustadaSel = sel?.tipo === 'anotacao' && !!desenho(sel.id)?.item.anotacoes?.[sel.chave];
  // o desenho que está sendo anotado (um só, na aba e na folha): as que se esconderam voltam por aqui
  const unico = o.desenhos.length === 1 ? o.desenhos[0] : null;
  const ocultas = unico ? (unico.posto.chamadas?.filter((c) => c.oculta).length ?? 0) + (unico.posto.anotacoes?.filter((a) => a.oculta && !a.nova).length ?? 0) : 0;
  const temAjuste = !!unico && !!(unico.item.chamadas || unico.item.anotacoes);
  const mostrarOcultas = () => {
    if (!unico) return;
    const { posto } = unico;
    o.mudarItem(posto.id, (i) => {
      const comChamadas = (posto.chamadas ?? []).filter((c) => c.oculta).reduce((x, c) => naChamada(x, c.chave, ({ oculta: _o, ...q }) => q), i);
      // o texto vazio guardado antes de 16/10 também escondia: sai junto
      return (posto.anotacoes ?? []).filter((a) => a.oculta && !a.nova).reduce((x, a) => naAnotacao(x, a.chave, ({ oculta: _o, ...q }) => (q.texto !== undefined && !q.texto.trim() ? (({ texto: _t, ...r }) => r)(q) : q)), comChamadas);
    });
  };

  const painel: ReactNode = (
    <>
      {sel?.tipo === 'chamada' && chamadaSel && (
        <div style={s.grupo}>
          <span style={s.tituloDoGrupo}>{chamadaSel.rotulo}</span>
          <Linha rotulo="Giro (°)"><Numero valor={chamadaSel.giro} min={-360} aoMudar={girarChamada} /></Linha>
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn-caixa" title="Girar 90° anti-horário" aria-label="Girar 90° anti-horário" onClick={() => girarChamada(chamadaSel.giro + 90)}>⟲ 90°</button>
            <button type="button" className="btn-caixa" title="Girar 90° horário" aria-label="Girar 90° horário" onClick={() => girarChamada(chamadaSel.giro - 90)}>⟳ 90°</button>
          </span>
          <Linha rotulo="Linha de chamada">
            <input type="checkbox" checked={!chamadaSel.semLinha} onChange={(e) => comLinha(sel.id, sel.chave, e.target.checked)} />
          </Linha>
          <span style={s.botoes}>
            <button type="button" className="btn-caixa" onClick={() => esconderChamada(sel.id, sel.chave)}>{chamadaSel.etiqueta ? 'Apagar' : 'Esconder'}</button>
            {chamadaSel.posta && !chamadaSel.etiqueta && <button type="button" className="btn-caixa" onClick={() => mudarChamada(sel.id, sel.chave, () => null)}>Voltar à coluna</button>}
          </span>
        </div>
      )}
      {sel?.tipo === 'anotacao' && anotSel && (
        <div style={s.grupo}>
          <span style={s.tituloDoGrupo}>{anotSel.a.tipo === 'cota' ? 'Cota' : 'Texto'}</span>
          <Linha rotulo="Texto"><TextoConfirmado valor={anotSel.a.texto} aoConfirmar={(v) => reescrever(sel.id, sel.chave, v)} /></Linha>
          {anotSel.a.tipo === 'cota' && (() => {
            const guardada = anotSel.a.nova ? desenho(sel.id)?.item.cotas?.find((c) => c.id === sel.chave) : desenho(sel.id)?.item.anotacoes?.[sel.chave];
            return (
              <>
                <Linha rotulo="Prefixo"><TextoConfirmado valor={guardada?.prefixo ?? ''} aoConfirmar={(v) => mudarEmVolta(sel.id, sel.chave, 'prefixo', v)} /></Linha>
                <Linha rotulo="Sufixo"><TextoConfirmado valor={guardada?.sufixo ?? ''} aoConfirmar={(v) => mudarEmVolta(sel.id, sel.chave, 'sufixo', v)} /></Linha>
              </>
            );
          })()}
          {anotSel.a.tipo === 'texto' && (
            <>
              <Linha rotulo="Giro (°)"><Numero valor={anotSel.a.giro} min={-360} aoMudar={(g) => girarAnotacao(sel.id, sel.chave, g)} /></Linha>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-caixa" title="Girar 90° anti-horário" aria-label="Girar 90° anti-horário" onClick={() => girarAnotacao(sel.id, sel.chave, anotSel.a.giro + 90)}>⟲ 90°</button>
                <button type="button" className="btn-caixa" title="Girar 90° horário" aria-label="Girar 90° horário" onClick={() => girarAnotacao(sel.id, sel.chave, anotSel.a.giro - 90)}>⟳ 90°</button>
              </span>
            </>
          )}
          <span style={s.botoes}>
            <button type="button" className="btn-caixa" onClick={() => tirarAnotacao(sel.id, sel.chave)}>{anotSel.a.nova ? 'Apagar' : 'Esconder'}</button>
            {ajustadaSel && <button type="button" className="btn-caixa" onClick={() => mudarAnotacao(sel.id, anotSel.a, { auto: () => null })}>Restaurar</button>}
          </span>
        </div>
      )}
      {!sel && unico && (ocultas > 0 || temAjuste) && (
        <div style={s.linha}>
          <span style={s.rotulo}>Anotações</span>
          <span style={s.botoes}>
            {ocultas > 0 && <button type="button" className="btn-caixa" onClick={mostrarOcultas}>Mostrar ocultas ({ocultas})</button>}
            {temAjuste && <button type="button" className="btn-caixa" onClick={() => o.mudarItem(unico.posto.id, ({ chamadas: _c, anotacoes: _a, ...i }) => i as ItemDaFolha)}>Voltar ao automático</button>}
          </span>
        </div>
      )}
    </>
  );

  /** O recado curto da ferramenta na barra (a linha de comando do CAD). */
  const dica = !ferramenta ? null
    : ferramenta === 'etiqueta' ? 'clique na barra'
      : ferramenta === 'texto' ? 'clique onde vai o texto'
      : !cotaEmCurso ? 'clique o primeiro ponto'
        : cotaEmCurso.pontos.length < 2 ? 'clique o segundo ponto'
          : 'clique mais pontos ou o lugar da cota';

  return {
    sel,
    /** Larga a seleção da edição (quem seleciona outra coisa chama). */
    limpar: () => setSel(null),
    ferramenta,
    armar,
    /** Dá para cotar e escrever (desenho em escala) e para etiquetar (frontal e corte): os botões seguem estes. */
    podeAnotar: o.desenhos.some(emEscala),
    podeEtiquetar: !!o.barraEm && o.desenhos.some(aceitaEtiqueta),
    dica,
    /** Há gesto em curso (arrasto, ferramenta, escrita): quem está por fora não mexe no desenho. */
    ocupado: !!arrasto || !!ferramenta || !!escrita,
    arrastando: !!arrasto,
    camada,
    painel,
    /** O painel tem o que mostrar (algo escolhido, ou anotações para voltar): a aba só abre o quadrinho com ele. */
    temPainel: (sel?.tipo === 'chamada' && !!chamadaSel) || (sel?.tipo === 'anotacao' && !!anotSel) || (!sel && !!unico && (ocultas > 0 || temAjuste)),
    teclar,
    mover,
    soltar,
    apertarComFerramenta,
  };
}

export type EdicaoDeAnotacoes = ReturnType<typeof useEdicaoDeAnotacoes>;
