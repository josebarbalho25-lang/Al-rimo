/*
  CHAMADAS DAS BARRAS (Jose, 15/10: "hoje o armador não monta só com a prancha") — "N1 – 15 Ø10 c/40 C=210" numa
  coluna ao lado do desenho, cada uma com a linha de chamada até uma barra daquela posição. Os números são os da
  lista de ferros (quantitativo/aco.ts): a quantidade é a do muro inteiro, o C é o comprimento desenvolvido em cm
  e o "c/" só sai nas posições que vão distribuídas a cada tanto.

  Por que coluna e não texto encostado na barra: o desenho é automático e qualquer muro tem de sair legível. Uma
  coluna fora do desenho, com os textos empilhados na ordem da altura das âncoras, nunca escreve um em cima do outro
  nem em cima da hachura; a linha de chamada é que atravessa — como no corte típico de prancha.

  Barra igual tem o mesmo N em qualquer elemento (modulacao/barras.ts, numerarPosicoes): a vertical do painel e a
  construtiva do contraforte podem ser o mesmo N1. A chamada conta o ELEMENTO desenhado — muro, contraforte ou
  sapata —: "N1 – 30 Ø10 c/40" no painel e "N1 – 24 Ø10" no contraforte, como na prancha de armação, e a lista de
  ferros soma as duas. Por elemento e não por papel: a principal e a construtiva do mesmo contraforte com o mesmo N
  são o mesmo feixe (por papel saíam duas chamadas iguais), e a espera do contraforte não é a do painel (por papel
  as duas somavam e o c/ do painel valia para todas).

  CHAMADA SOLTA (Jose, 15/10: "deixar livre pra eu colocar quando quiser do jeito que quiser? Girar ele, por na
  vertical, pra um lado, por outro"): a coluna é o lugar de partida. A chamada que o projetista arrasta na folha
  guarda, no item da folha, o lugar do texto contado do ponto da barra e o giro (pranchas/tipos.ts, ChamadaPosta);
  a linha de chamada sai sempre da barra e encosta na ponta do texto mais perto dela, com o ombro na direção do
  texto. Quem ficou na coluna não anda quando outra sai (o lugar de cada uma na coluna conta todas), e a caixa que
  prende o desenho na folha é a da coluna inteira — o desenho não pula nem o título desce por causa de uma chamada.
*/
import type { Barra, Modelo, PapelBarra } from '@/modelo/tipos';
import { CORPO_DA_COTA, type ChamadaPosta, type EtiquetaNova } from '@/pranchas/tipos';
import { COR, Prancha, type Pt } from './prancha';

/** Eixo ao longo do qual a posição se distribui (0 = x, 1 = y, 2 = z): só as que vão "a cada tanto" levam c/. */
const DISTRIBUIDA: Partial<Record<PapelBarra, 0 | 1 | 2>> = {
  VERT_MURO: 0, ESPERA: 0, SAP_TRANSV: 0, SAP_TORCAO: 0, SAP_LONG: 1, HORIZ: 2, CF_ESTRIBO: 2,
};

const bitola = (phi: number): string => `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;

const media = (b: Barra, k: 0 | 1 | 2): number => b.eixo.reduce((s, p) => s + p[k], 0) / Math.max(1, b.eixo.length);

export type ElementoDaBarra = 'muro' | 'contraforte' | 'sapata';

/** O elemento da barra para a chamada: a da sapata é da sapata mesmo marcada com o contraforte de cima (torção). */
export function elementoDaBarra(b: Pick<Barra, 'papel' | 'contraforte'>): ElementoDaBarra {
  if (b.papel.startsWith('SAP_')) return 'sapata';
  return b.contraforte !== undefined ? 'contraforte' : 'muro';
}

/**
 * O espaçamento da posição, cm: a distância mais comum entre vizinhas do mesmo grupo (trecho e contraforte). A da
 * ponta e a da junta de controle não são espaçamento — por isso a mais comum, e não a média. Ao longo do muro (x, y)
 * a barra de contraforte não conta: lá elas vão juntas no feixe da haste, a 1 ou 2 cm, e sairia "c/1". null = não
 * distribuída (barra do contraforte, peça única) ou sem vizinha.
 */
export function espacamentoDaPosicao(barras: readonly Barra[]): number | null {
  if (!barras.length) return null;
  const k = DISTRIBUIDA[barras[0].papel];
  if (k === undefined) return null;
  const grupos = new Map<string, number[]>();
  for (const b of barras) {
    if (b.papel !== barras[0].papel || (k !== 2 && b.contraforte !== undefined)) continue;
    const g = `${b.trecho}|${b.contraforte ?? ''}`;
    grupos.set(g, [...(grupos.get(g) ?? []), Math.round(media(b, k))]);
  }
  // a barra emendada vai deslocada um φ ao lado da vizinha (modulacao/barras.ts, corrida): na mesma linha, não é
  // outra linha — junta as posições a menos de 2φ, senão a longitudinal da sapata de muro comprido saía "c/1"
  const junto = 2 * barras[0].diametro + 1;
  const vezes = new Map<number, number>();
  for (const xs of grupos.values()) {
    const u: number[] = [];
    for (const x of [...new Set(xs)].sort((a, b) => a - b)) if (!u.length || x - u[u.length - 1] > junto) u.push(x);
    for (let i = 1; i < u.length; i++) {
      const d = Math.round((u[i] - u[i - 1]) / 10);
      if (d > 0) vezes.set(d, (vezes.get(d) ?? 0) + 1);
    }
  }
  let melhor: number | null = null;
  for (const [d, n] of vezes) if (melhor === null || n > vezes.get(melhor)! || (n === vezes.get(melhor)! && d < melhor)) melhor = d;
  return melhor;
}

/** "N1 – 15 Ø10 c/40 C=210" da posição no elemento (sem ele, a posição inteira), no muro inteiro. */
export function textoDaChamada(m: Modelo, posicao: string, elemento?: ElementoDaBarra): string {
  const daPosicao = m.barras.filter((b) => b.posicao === posicao && (elemento === undefined || elementoDaBarra(b) === elemento));
  if (!daPosicao.length) return posicao;
  const b = daPosicao[0];
  const s = espacamentoDaPosicao(daPosicao);
  return `${posicao} – ${daPosicao.length} ${bitola(b.diametro)}${s !== null ? ` c/${s}` : ''} C=${Math.round(b.comprimento / 10)}`;
}

export interface Chamada {
  posicao: string;
  /** O elemento da barra desenhada: a quantidade e o c/ da chamada são os dele. */
  elemento?: ElementoDaBarra;
  /** Onde a linha de chamada toca a barra, px de desenho. */
  ancora: Pt;
}

/**
 * A âncora numa barra desenhada (polilinha em px): no trecho mais comprido, no meio se ele é de pé (vertical, espera)
 * e perto da ponta do lado da coluna se é deitado (a da canaleta corre o muro todo: no meio, a linha de chamada
 * atravessaria o desenho inteiro).
 */
export function ancoraNaBarra(pts: readonly Pt[], ladoDaColuna: 1 | -1 = 1): Pt {
  if (pts.length === 1) return pts[0];
  let [a, b] = [pts[0], pts[1]];
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(b[0] - a[0], b[1] - a[1])) [a, b] = [p, q];
  }
  const dePe = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
  if (dePe) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // a ponta do lado da coluna fica a 85 % do trecho
  const [p, q] = (b[0] - a[0]) * ladoDaColuna >= 0 ? [a, b] : [b, a];
  return [p[0] + 0.85 * (q[0] - p[0]), p[1] + 0.85 * (q[1] - p[1])];
}

/** A chave da chamada no item da folha: a posição e o elemento ("N1|muro"). */
export function chaveDaChamada(c: Pick<Chamada, 'posicao' | 'elemento'>): string {
  return `${c.posicao}|${c.elemento ?? ''}`;
}

/** O giro em (−180°, 180°]: 270 é o mesmo −90 (lê de cima para baixo). */
export function normalizarGiro(g: number): number {
  if (!Number.isFinite(g)) return 0;
  const r = ((g % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/** Folga entre a linha de chamada e o texto, e o ombro (o pedaço na direção do texto antes dele), px. */
const FOLGA = 3;
const OMBRO = 7;
/** A meia altura da maiúscula acima da linha de base, × corpo: onde a linha de chamada encosta. */
const MEIA_ALTURA = 0.35;

/** A direção da leitura (u) e o "para cima" da letra (v) do texto girado, com y para baixo (giro anti-horário). */
function eixosDoTexto(giro: number): { u: Pt; v: Pt } {
  const g = (giro * Math.PI) / 180;
  return { u: [Math.cos(g), -Math.sin(g)], v: [-Math.sin(g), -Math.cos(g)] };
}

/**
 * A linha de chamada da chamada solta: da barra até a ponta do texto mais perto dela, na meia altura da letra, com
 * o ombro na direção do texto — texto à esquerda da barra, a linha chega pela direita; girado, chega girada.
 */
export function linhaDaChamada(ancora: Pt, texto: Pt, giro: number, largura: number, tam: number): Pt[] {
  const { u, v } = eixosDoTexto(giro);
  const h = MEIA_ALTURA * tam;
  const inicio: Pt = [texto[0] - u[0] * FOLGA + v[0] * h, texto[1] - u[1] * FOLGA + v[1] * h];
  const fim: Pt = [texto[0] + u[0] * (largura + FOLGA) + v[0] * h, texto[1] + u[1] * (largura + FOLGA) + v[1] * h];
  const d = (p: Pt) => Math.hypot(p[0] - ancora[0], p[1] - ancora[1]);
  const [ponta, s]: [Pt, number] = d(inicio) <= d(fim) ? [inicio, -1] : [fim, 1];
  return [ancora, [ponta[0] + s * u[0] * OMBRO, ponta[1] + s * u[1] * OMBRO], ponta];
}

/** Os quatro cantos da caixa do texto girado (a da Prancha.texto: sobe 0,85 e desce 0,25 do corpo), px. */
export function cantosDoTexto(texto: Pt, giro: number, largura: number, tam: number): Pt[] {
  const { u, v } = eixosDoTexto(giro);
  return ([[0, -0.25], [largura, -0.25], [largura, 0.85], [0, 0.85]] as Pt[]).map(([a, b]): Pt => [
    texto[0] + u[0] * a + v[0] * b * tam,
    texto[1] + u[1] * a + v[1] * b * tam,
  ]);
}

/** O começo da linha de base de um texto com âncora no meio ou no fim (o ponto que as contas acima esperam). */
export function comecoDoTexto(p: Pt, ancora: 'start' | 'middle' | 'end', giro: number, largura: number): Pt {
  if (ancora === 'start') return p;
  const { u } = eixosDoTexto(giro);
  const k = ancora === 'middle' ? largura / 2 : largura;
  return [p[0] - u[0] * k, p[1] - u[1] * k];
}

/** O começo da linha de base de volta ao ponto da âncora. */
export function ancoraDoTexto(comeco: Pt, ancora: 'start' | 'middle' | 'end', giro: number, largura: number): Pt {
  if (ancora === 'start') return comeco;
  const { u } = eixosDoTexto(giro);
  const k = ancora === 'middle' ? largura / 2 : largura;
  return [comeco[0] + u[0] * k, comeco[1] + u[1] * k];
}

/**
 * O ponto de inserção do texto girado para `giro` em torno do MEIO dele: o texto gira no lugar, como no botão de
 * girar da folha (girar pela ponta jogava a chamada longe).
 */
export function girarNoMeio(texto: Pt, giroAntes: number, giro: number, largura: number, tam: number): Pt {
  const a = eixosDoTexto(giroAntes);
  const b = eixosDoTexto(giro);
  const [hu, hv] = [largura / 2, MEIA_ALTURA * tam];
  const c: Pt = [texto[0] + a.u[0] * hu + a.v[0] * hv, texto[1] + a.u[1] * hu + a.v[1] * hv];
  return [c[0] - b.u[0] * hu - b.v[0] * hv, c[1] - b.u[1] * hu - b.v[1] * hv];
}

/**
 * Uma chamada por posição e elemento, numa coluna à direita de TUDO o que já está desenhado (`coluna` é o mínimo):
 * presa só à geometria, em 1:75 e 1:100 a coluna entrava na cota "muro" e no "B =", que têm afastamento fixo em px. Os textos vão na ordem da altura das
 * âncoras, cada um pelo menos uma linha e meia abaixo do de cima; a linha sai da âncora (com um ponto) e chega
 * deitada no texto. `postas`: as que o projetista tirou da coluna (cabeçalho, "CHAMADA SOLTA").
 */
export function desenharChamadas(pr: Prancha, m: Modelo, chamadas: readonly Chamada[], coluna: number, postas: Readonly<Record<string, ChamadaPosta>> = {}): void {
  const uma = new Map<string, Chamada>();
  for (const c of chamadas) {
    const k = chaveDaChamada(c);
    if (!uma.has(k)) uma.set(k, c);
  }
  const lista = [...uma.values()].sort((a, b) => a.ancora[1] - b.ancora[1] || a.posicao.localeCompare(b.posicao, 'pt-BR', { numeric: true }));
  if (!lista.length) return;
  coluna = Math.max(coluna, pr.direita() + 14);
  const tam = CORPO_DA_COTA;
  const passo = tam * 1.6;
  let yAnterior = -Infinity;
  pr.abrir('data-camada="chamadas"');
  for (const c of lista) {
    // o lugar na coluna conta todas, as que saíram também: quem ficou não anda quando outra sai
    const y = Math.max(c.ancora[1], yAnterior + passo);
    yAnterior = y;
    const [ax, ay] = c.ancora;
    const chave = chaveDaChamada(c);
    const rotulo = textoDaChamada(m, c.posicao, c.elemento);
    const largura = Prancha.largura(rotulo, tam);
    const naColuna: Pt = [coluna, y + tam * 0.35];
    const p = postas[chave];
    const solta = !!p && Number.isFinite(p.dx) && Number.isFinite(p.dy);
    const texto: Pt = solta ? [ax + p.dx!, ay + p.dy!] : naColuna;
    const giro = solta ? normalizarGiro(p.giro ?? 0) : 0;
    const oculta = p?.oculta === true;
    const semLinha = p?.semLinha === true;
    pr.chamadas.push({ chave, ancora: c.ancora, texto, giro, largura, tam, rotulo, posta: solta, oculta, semLinha });
    if (solta || oculta) {
      // o lugar que ela tinha na coluna (e o ponto na barra) segura o desenho na folha
      pr.reservar(coluna, naColuna[1] - 0.85 * tam, coluna + largura, naColuna[1] + 0.25 * tam);
      pr.reservar(ax - 1.8, ay - 1.8, ax + 1.8, ay + 1.8);
      if (oculta) continue;
    }
    // sem a linha de chamada sai só o texto (a escolha da chamada; o ponto na barra vai junto com a linha)
    if (!semLinha) pr.circulo(ax, ay, 1.8, { fill: COR.cota, camada: 'chamadas' });
    pr.foraDaReferencia(solta);
    const linha: Pt[] = solta ? linhaDaChamada(c.ancora, texto, giro, largura, tam) : [[ax, ay], [coluna - 10, y], [coluna - 3, y]];
    if (!semLinha) pr.polilinha(linha, { stroke: COR.cota, sw: 0.6, camada: 'chamadas' });
    pr.texto(texto[0], texto[1], rotulo, { tam, ancora: 'start', cor: COR.linha, halo: true, camada: 'chamadas', giro });
    pr.foraDaReferencia(false);
  }
  pr.fechar();
}

/** O ponto das polilinhas (px) mais perto de `p`; polilinha de um ponto só é a barra cortada (o próprio ponto). */
export function pontoMaisPerto(polilinhas: readonly (readonly Pt[])[], p: Pt): Pt | null {
  let melhor: Pt | null = null;
  let d = Infinity;
  const ver = (q: Pt) => {
    const dq = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dq < d) [melhor, d] = [q, dq];
  };
  for (const l of polilinhas) {
    if (l.length === 1) ver(l[0]);
    for (let i = 1; i < l.length; i++) {
      const [a, b] = [l[i - 1], l[i]];
      const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
      const L2 = vx * vx + vy * vy;
      const t = L2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
      ver([a[0] + t * vx, a[1] + t * vy]);
    }
  }
  return melhor;
}

/**
 * As ETIQUETAS DE AÇO que o projetista pôs (pranchas/tipos.ts, EtiquetaNova): cada uma no ponto da barra dela mais
 * perto do ponto guardado (a barra que andou leva a etiqueta junto), o texto pelo afastamento, girado, com ou sem
 * a linha de chamada. `barras`: as polilinhas desenhadas de cada "posição|elemento", px. A barra que saiu do desenho
 * (o muro mudou) deixa a etiqueta guardada, sem desenho. Fora da caixa que prende o desenho na folha: pôr uma
 * etiqueta não empurra o desenho.
 */
export function desenharEtiquetas(pr: Prancha, m: Modelo, etiquetas: readonly EtiquetaNova[], barras: ReadonlyMap<string, readonly (readonly Pt[])[]>, S: number): void {
  if (!etiquetas.length) return;
  const tam = CORPO_DA_COTA;
  pr.abrir('data-camada="chamadas"');
  for (const e of etiquetas) {
    const linhas = barras.get(e.barra);
    const ancora = linhas ? pontoMaisPerto(linhas, [e.ponto[0] * S, e.ponto[1] * S]) : null;
    if (!ancora) continue;
    const [posicao, elemento] = e.barra.split('|');
    const rotulo = textoDaChamada(m, posicao, (elemento || undefined) as ElementoDaBarra | undefined);
    const largura = Prancha.largura(rotulo, tam);
    const texto: Pt = [ancora[0] + e.dx, ancora[1] + e.dy];
    const giro = normalizarGiro(e.giro ?? 0);
    const semLinha = e.semLinha === true;
    pr.chamadas.push({ chave: e.id, ancora, texto, giro, largura, tam, rotulo, posta: true, oculta: false, etiqueta: true, semLinha });
    pr.foraDaReferencia(true);
    if (!semLinha) {
      pr.circulo(ancora[0], ancora[1], 1.8, { fill: COR.cota, camada: 'chamadas' });
      pr.polilinha(linhaDaChamada(ancora, texto, giro, largura, tam), { stroke: COR.cota, sw: 0.6, camada: 'chamadas' });
    }
    pr.texto(texto[0], texto[1], rotulo, { tam, ancora: 'start', cor: COR.linha, halo: true, camada: 'chamadas', giro });
    pr.foraDaReferencia(false);
  }
  pr.fechar();
}
