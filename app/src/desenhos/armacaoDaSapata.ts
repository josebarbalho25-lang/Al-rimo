/*
  ARMAÇÃO DA SAPATA (Jose, 15/10: "sombra das armaduras — precisamos implementar aqui, principalmente pra detalhar a
  sapata corrida; isso tem no Pró-Viga-3D") — a sapata corrida é uma viga deitada ao longo do muro, e a prancha dela
  fala a língua da viga do Pró-Viga 3D (proviga-3d-limpo/app: dxf-writer.js, drawElevation e drawSection; armadura.jsx,
  o retrato 2D), que o Jose já lê de olho fechado:
    · a ELEVAÇÃO da sapata ao longo do muro (x para a direita, como a vista frontal): o contorno, as longitudinais de
      baixo e de cima dentro dela, um traço em cada estribo e as esperas do muro entrando nela. Em cima, o toco do
      muro cortado pela linha de interrupção (o pilar que nasce na viga do Pró-Viga, com o zigue-zague dele) e, acima
      do toco, a FAIXA de cada família de estribo: o trecho que ela cobre, ponto nas pontas e "N4 – 36 Ø10 c/17"
      embaixo do traço, no começo — a faixa única do Pró-Viga (dxf-writer.js 878–949, estY = topo + 32);
    · as SOMBRAS: cada longitudinal tirada de dentro da peça e desenhada solta, grossa, no x de verdade — é ali que o
      armador lê onde a barra começa, onde acaba e onde emenda. As da face de BAIXO vão embaixo da sapata e as da face
      de CIMA em cima, acima das faixas: as positivas e as negativas do Pró-Viga (dxf-writer.js 540–554). A face não
      precisa ser escrita — o lado diz;
    · à direita, a SEÇÃO (B × h, com o dente) com o estribo e as longitudinais cortadas, e ao lado dela a sombra do
      estribo: a forma dele fora da seção, na mesma altura, com a medida de cada perna (as da lista de ferros) e a
      legenda — a "sombra do estribo desenvolvida" do drawSection do Pró-Viga (dxf-writer.js 1594–1669).

  AS SOMBRAS, regra por regra do Pró-Viga:
    · UMA SOMBRA POR MARCA + ESTAÇÃO + FACE (dxf-writer.js 953–980; armadura.jsx 940–962; o `uid` de detailing.js
      4245–4251: "mesma tag + mesmo x = uma sombra/stack só"): as barras iguais no mesmo x e na mesma face viram UMA
      sombra e a quantidade é a SOMA — as onze longitudinais de baixo são "N5 – 11 Ø6,3", e as de cima, a sombra delas;
    · fileiras com passo FIXO (SHADOW_ROW = 28 com letra de 9 → 34 px com a letra de 11), afastando-se da peça; cada
      sombra entra na primeira fileira em que a pegada dela — o traço ou a legenda, o que for mais largo — não encosta
      em outra (ROW_GAP_H; dxf-writer.js 1065–1134). Lá em cima o Pró-Viga dá uma fileira para cada negativa; aqui as
      duas faces empacotam igual (na junta de controle, o trecho do lado cabe na mesma fileira);
    · a FAMÍLIA da barra emendada vai em fileiras CONSECUTIVAS (familiasDeEmenda, armadura.jsx 321–356 e 1119–1149):
      "o transpasse se lê na SOMBRA" — dentro da peça as duas peças ficam no mesmo eixo, e na sombra uma fica ao lado
      da outra, sobrepostas no traspasse. Aqui a família é geométrica (mesma face, mesmo trecho, x que se sobrepõem):
      é assim que a corrida de modulacao/barras.ts emenda, e não depende de como o id é escrito;
    · a legenda vai centrada do lado de fora do traço (embaixo na de baixo, em cima na de cima), no formato das
      chamadas do app (chamadas.ts): "N5 – 11 Ø6,3 C=591", sem "c/" — a sombra conta as barras DELA, não a posição
      inteira; o C é o desenvolvido, o mesmo da lista de ferros.

  O QUE FICA FIXO EM PX (a letra, os afastamentos, o passo das fileiras) e o que segue a escala (o muro, a barra):
  como em toda vista (paraPrancha.ts), a anotação não encolhe em 1:50 — o desenho fica do tamanho que a escala der.
*/
import type { Barra, Modelo, PapelBarra, Vec2, Vec3 } from '@/modelo/tipos';
import { CORPO_DA_COTA } from '@/pranchas/tipos';
import { formaDaBarra } from '@/pranchas/formaDaBarra';
import { cm } from './formato';
import { cruzamentos, faixa, projecao, projetarPontos, secao, solidosDoModelo, type Solido } from './geometria';
import { COR, Prancha, escalaPara, type OpcoesDaVista, type Pt } from './prancha';
import { espacamentoDaPosicao, textoDaChamada } from './chamadas';
import { estiloDaSecao } from './corteLateral';
import { aparece, corDoAcoNoDesenho, naVista } from './graficos';

/** Toda letra da vista: o corpo da cota, o menor que o papel aceita (2,5 mm de maiúscula na prancha). */
const T = CORPO_DA_COTA;
/** Da linha da sombra à linha de base da legenda, do lado de fora (o Pró-Viga escreve a 8 cm, com letra de 9). */
const LEGENDA_FORA = { embaixo: 4 + 0.85 * T, emCima: -(4 + 0.25 * T) };
/** De uma fileira de sombras à seguinte: o SHADOW_ROW do Pró-Viga (28 com letra de 9) na letra daqui. */
const FILEIRA = 34;
/** Folga entre duas sombras lado a lado na mesma fileira (ROW_GAP_H, 20 com letra de 9) quando uma legenda está na
 *  ponta; entre dois traços, só o bastante para o vão aparecer: na junta de controle as barras dos dois trechos
 *  ficam a 2 cobrimentos + a junta uma da outra, e cada trecho é uma sapata — as sombras dele ficam na mesma
 *  fileira das do vizinho enquanto o vão se enxerga (até 1:50); abaixo disso a de lá desce uma fileira. */
const FOLGA_NA_FILEIRA = 2 * T;
const FOLGA_ENTRE_TRACOS = 3;
/** Da cota do comprimento (o que a elevação tem de mais baixo) à primeira fileira de baixo. */
const ANTES_DAS_SOMBRAS = 3 * T;
/** Da faixa de estribo mais alta à primeira fileira de cima (NEG_INITIAL_GAP, 30 com letra de 9). */
const ACIMA_DAS_FAIXAS = 26;
/** Da linha de interrupção à faixa de estribos de baixo, e de uma faixa à outra (a legenda vai embaixo do traço). */
const ACIMA_DO_TOCO = 22;
const PASSO_DA_FAIXA = 32;
/** Zigue-zague da linha de interrupção (o _breakLine do Pró-Viga), px. */
const AMPLITUDE = 5;
/**
 * A camada do traço da sombra: a dela, não a do aço — como no DXF do Pró-Viga (SOMBRA e SOMBRA_EST, à parte da
 * armadura de dentro da peça, com cor própria: o shadowColor de lá). É a anotação 'sombras' da tabela de gráficos
 * (graficos.ts): a cor que a vista der vale para a sombra e não mexe na barra de dentro.
 */
const CAMADA_DA_SOMBRA = 'sombras';

const bitola = (phi: number): string => `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;

/** Ordem das posições: N2 antes de N10. */
const ordemDoN = (a: string, b: string): number => a.localeCompare(b, 'pt-BR', { numeric: true });

const meioEmX = (b: Barra): number => {
  const [a, c] = faixa(b.eixo, 0);
  return (a + c) / 2;
};

// ── a seção da sapata ─────────────────────────────────────────────────────────────────────────────────────────────

/** A seção da sapata lida do perfil desenhado (não das entradas): é o que está na prancha que a cota tem de medir. */
interface MedidasDaSapata {
  y0: number;       // face da ponta (o pé, na frente do muro)
  y1: number;       // face do talão
  zTopo: number;
  zCorpo: number;   // fundo do corpo (acima do dente)
  zFundo: number;   // fundo do dente (sem dente, o do corpo)
}

function medidasDaSapata(s: Solido): MedidasDaSapata {
  const ps: Vec2[] = s.base.map((p) => [p[1], p[2]]);
  const ys = ps.map((p) => p[0]);
  const zs = ps.map((p) => p[1]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  // o corpo é o que as DUAS faces têm: o dente pode encostar numa delas (x_den no limite), nunca nas duas
  const fundoNaFace = (y: number) => Math.min(...ps.filter((p) => Math.abs(p[0] - y) < 1).map((p) => p[1]));
  return { y0, y1, zTopo: Math.max(...zs), zCorpo: Math.max(fundoNaFace(y0), fundoNaFace(y1)), zFundo: Math.min(...zs) };
}

// ── as sombras das longitudinais ──────────────────────────────────────────────────────────────────────────────────

export type FaceDaSapata = 'inferior' | 'superior';

export interface SombraDaSapata {
  posicao: string;
  face: FaceDaSapata;
  diametro: number;
  /** Desenvolvido, mm: o C= da legenda e da lista de ferros. */
  comprimento: number;
  trecho: number;
  /** Extensão ao longo do muro, mm. */
  xa: number;
  xb: number;
  /** As barras desta sombra (mesma posição, mesma estação, mesma face): a quantidade da legenda é quantas são. */
  ids: string[];
  /** O eixo da primeira delas: é a forma que a sombra desenha (as outras são iguais, ao lado na largura da sapata). */
  eixo: Vec3[];
}

/**
 * As sombras das longitudinais da sapata (SAP_LONG), já em FAMÍLIAS: cada família é a barra emendada — as peças de
 * uma corrida, em ordem de x — e vai em fileiras consecutivas. Sem emenda, família de uma sombra só. Ordem: a face de
 * baixo primeiro, depois a de cima; dentro da face, pela posição e pelo trecho.
 */
export function sombrasDaSapata(m: Modelo): SombraDaSapata[][] {
  const meioPorTrecho = new Map<number, number>();
  for (const s of solidosDoModelo(m)) {
    if (s.peca.tipo !== 'SAPATA') continue;
    const md = medidasDaSapata(s);
    meioPorTrecho.set(s.peca.trecho, (md.zTopo + md.zCorpo) / 2);
  }
  const meioGeral = (m.dims.sapata.z0 + m.dims.sapata.z1) / 2;

  const grupos = new Map<string, SombraDaSapata>();
  for (const b of m.barras) {
    if (b.papel !== 'SAP_LONG') continue;
    const [xa, xb] = faixa(b.eixo, 0);
    const z = b.eixo.reduce((s, p) => s + p[2], 0) / Math.max(1, b.eixo.length);
    const face: FaceDaSapata = z > (meioPorTrecho.get(b.trecho) ?? meioGeral) ? 'superior' : 'inferior';
    // a estação em cm, como o Pró-Viga (Math.round(x_center·100)): a peça emendada que anda um φ de lado é a mesma
    const k = `${b.trecho}|${face}|${b.posicao}|${Math.round((xa + xb) / 20)}`;
    const g = grupos.get(k);
    if (g) {
      g.ids.push(b.id);
      g.xa = Math.min(g.xa, xa);
      g.xb = Math.max(g.xb, xb);
    } else {
      grupos.set(k, { posicao: b.posicao, face, diametro: b.diametro, comprimento: b.comprimento, trecho: b.trecho, xa, xb, ids: [b.id], eixo: b.eixo });
    }
  }
  const lista = [...grupos.values()].sort((a, b) =>
    (a.face === b.face ? 0 : a.face === 'inferior' ? -1 : 1) || ordemDoN(a.posicao, b.posicao) || a.trecho - b.trecho || a.xa - b.xa);

  // famílias: mesma face e mesmo trecho, x que se sobrepõem (o traspasse); a raiz é sempre o menor índice, e a
  // família sai na ordem dele — sem emenda, a ordem da lista não muda
  const pai = lista.map((_, i) => i);
  const raiz = (i: number): number => {
    while (pai[i] !== i) i = pai[i] = pai[pai[i]];
    return i;
  };
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const [p, q] = [lista[i], lista[j]];
      if (p.face !== q.face || p.trecho !== q.trecho) continue;
      if (Math.min(p.xb, q.xb) - Math.max(p.xa, q.xa) > 1) {
        const [a, b] = [raiz(i), raiz(j)];
        if (a !== b) pai[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }
  const membros = new Map<number, SombraDaSapata[]>();
  lista.forEach((s, i) => {
    const r = raiz(i);
    membros.set(r, [...(membros.get(r) ?? []), s]);
  });
  return [...membros.entries()].sort((a, b) => a[0] - b[0]).map(([, fam]) => fam.sort((a, b) => a.xa - b.xa));
}

/** A legenda da sombra: o formato das chamadas, sem "c/" (a sombra conta as barras dela, não a posição inteira). */
export function legendaDaSombra(s: SombraDaSapata): string {
  return `${s.posicao} – ${s.ids.length} ${bitola(s.diametro)} C=${Math.round(s.comprimento / 10)}`;
}

/** O z do trecho reto mais comprido da barra projetada: é ele que deita na linha da sombra (os ganchos saem dele). */
function zDoMaiorTrecho(pts: Vec2[]): number {
  let melhor = 0;
  let z = pts[0]?.[1] ?? 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L > melhor) [melhor, z] = [L, (pts[i][1] + pts[i - 1][1]) / 2];
  }
  return z;
}

/** O que a sombra ocupa na fileira, px: de onde a onde, e se cada ponta é o traço (ou a legenda, mais larga). */
interface Pegada { lo: number; hi: number; loTraco: boolean; hiTraco: boolean }

function cabemLadoALado(p: Pegada, q: Pegada): boolean {
  const [e, d] = p.lo <= q.lo ? [p, q] : [q, p];
  return d.lo - e.hi >= (e.hiTraco && d.loTraco ? FOLGA_ENTRE_TRACOS : FOLGA_NA_FILEIRA);
}

/**
 * A fileira de cada sombra (0 = a mais perto da sapata): a família entra inteira, a peça j na fileira r0 + j, com r0
 * o primeiro em que todas cabem — fileira que ainda não existe conta como vazia, então r0 nunca passa do fim.
 */
function arrumarEmFileiras(familias: SombraDaSapata[][], pegada: (s: SombraDaSapata) => Pegada): Map<SombraDaSapata, number> {
  const fileiras: Pegada[][] = [];
  const out = new Map<SombraDaSapata, number>();
  const cabe = (r: number, p: Pegada) => !fileiras[r] || fileiras[r].every((q) => cabemLadoALado(p, q));
  for (const fam of familias) {
    const ps = fam.map(pegada);
    let r0 = 0;
    while (!ps.every((p, j) => cabe(r0 + j, p))) r0++;
    fam.forEach((s, j) => {
      (fileiras[r0 + j] ??= []).push(ps[j]);
      out.set(s, r0 + j);
    });
  }
  return out;
}

// ── as faixas de estribo ──────────────────────────────────────────────────────────────────────────────────────────

interface FaixaDeEstribos {
  papel: PapelBarra;
  posicao: string;
  diametro: number;
  qtd: number;
  /** cm (o da chamada, ou a mediana entre estações vizinhas); null = uma estação só. */
  passo: number | null;
  zonas: { trecho: number; xa: number; xb: number }[];
}

/**
 * Uma faixa por família de estribo (papel e posição): a transversal (estribo ou reta) e o estribo de torção. Cada
 * trecho é uma zona — a junta de controle interrompe a sapata — e a legenda é uma só, com a quantidade do grupo
 * inteiro (Pró-Viga: "zonas com mesma bitola e mesmo espaçamento são UMA posição só").
 * O passo é o da chamada (chamadas.ts, espacamentoDaPosicao), para a faixa e a sombra do estribo dizerem o mesmo
 * c/. Onde a chamada não dá passo (o estribo de torção não está na tabela das distribuídas dela), a MEDIANA da
 * distância entre estações vizinhas: o de torção que encostou numa transversal (modulacao/entorno.ts, encostar)
 * muda duas distâncias e não pode mudar o c/ da faixa.
 */
function faixasDeEstribos(barras: Barra[]): FaixaDeEstribos[] {
  const grupos = new Map<string, Barra[]>();
  for (const b of barras) {
    const k = `${b.papel}|${b.posicao}`;
    grupos.set(k, [...(grupos.get(k) ?? []), b]);
  }
  const out: FaixaDeEstribos[] = [];
  for (const bs of grupos.values()) {
    const trechos = [...new Set(bs.map((b) => b.trecho))].sort((a, b) => a - b);
    const zonas: FaixaDeEstribos['zonas'] = [];
    const vaos: number[] = [];
    for (const tr of trechos) {
      const xs = [...new Set(bs.filter((b) => b.trecho === tr).map((b) => Math.round(meioEmX(b) * 10) / 10))].sort((a, b) => a - b);
      zonas.push({ trecho: tr, xa: xs[0], xb: xs[xs.length - 1] });
      for (let i = 1; i < xs.length; i++) vaos.push(xs[i] - xs[i - 1]);
    }
    vaos.sort((a, b) => a - b);
    const mediana = vaos.length ? Math.round(vaos[Math.floor((vaos.length - 1) / 2)] / 10) : null;
    out.push({ papel: bs[0].papel, posicao: bs[0].posicao, diametro: bs[0].diametro, qtd: bs.length, passo: espacamentoDaPosicao(bs) ?? mediana, zonas });
  }
  // a transversal mais perto da sapata, a torção acima dela
  return out.sort((a, b) => (a.papel === b.papel ? 0 : a.papel === 'SAP_TRANSV' ? -1 : 1) || ordemDoN(a.posicao, b.posicao));
}

/** A barra é de pé no plano X (estribo)? Senão é a transversal reta, que de frente é um ponto. */
const ehDePe = (b: Barra): boolean => {
  const [za, zb] = faixa(b.eixo, 2);
  return zb - za > 2 * b.diametro;
};

// ── o corte ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Onde a seção é tirada: numa estação de transversal do 1º trecho (o estribo fica no plano do corte, como o corte
 * típico do Pró-Viga), a mais perto do meio FORA do traspasse — no traspasse cada longitudinal sairia em dobro.
 * Fora do traspasse é onde menos longitudinais atravessam; mas nunca nenhuma: a transversal reta da 1ª e da última
 * estação fica no mesmo x da ponta da longitudinal, e ali o corte sairia sem os pontos.
 */
function xDoCorte(sap: Solido, longs: Barra[], transv: Barra[]): number {
  const meio = (sap.min[0] + sap.max[0]) / 2;
  const estacoes = [...new Set(transv.filter((b) => b.trecho === sap.peca.trecho && b.papel === 'SAP_TRANSV').map(meioEmX))];
  const cruzam = (x: number) => longs.filter((b) => {
    const [a, c] = faixa(b.eixo, 0);
    return a < x - 0.5 && x + 0.5 < c;
  }).length;
  const contagem = estacoes.map((x) => ({ x, n: cruzam(x) }));
  const comBarra = contagem.filter((q) => q.n > 0);
  const menor = Math.min(...comBarra.map((q) => q.n));
  const candidatos = comBarra.length ? comBarra.filter((q) => q.n === menor).map((q) => q.x) : estacoes;
  if (!candidatos.length) return meio;
  return candidatos.reduce((melhor, x) => (Math.abs(x - meio) < Math.abs(melhor - meio) ? x : melhor));
}

/** Centro do círculo que passa pelos três pontos; null se estão em linha. */
function centroDoCirculo(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-6) return null;
  const [a2, b2, c2] = [a[0] ** 2 + a[1] ** 2, b[0] ** 2 + b[1] ** 2, c[0] ** 2 + c[1] ** 2];
  return [
    (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
    (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
  ];
}

/**
 * O canto dos ganchos do estribo (modulacao/barras.ts, estribo), na forma projetada (y, z): o centro da dobra de 135°
 * do 1º gancho — os pontos logo depois da ponta — fica a (r, r) do canto, sempre no quadrante dele (o raio nunca
 * passa da meia seção). A ponta da barra não serve: com gancho comprido numa seção baixa (Ø16 numa sapata de 30)
 * ela passa do meio e o número da ponta ia parar no canto errado. Sem arco (três pontos em linha), o meio das pontas.
 * Volta [perto de ya — o pé, à direita no desenho espelhado —, perto de zb — em cima].
 */
function cantoDosGanchos(pts: Vec2[], ya: number, yb: number, za: number, zb: number): [boolean, boolean] {
  const [p, q] = [pts[0], pts[pts.length - 1]];
  const c = (pts.length >= 4 ? centroDoCirculo(pts[1], pts[2], pts[3]) : null) ?? [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  return [Math.abs(c[0] - ya) < Math.abs(c[0] - yb), Math.abs(c[1] - zb) < Math.abs(c[1] - za)];
}

/** Linha de interrupção (o _breakLine do Pró-Viga): reta de a a b em y, com o zigue-zague no meio. */
function linhaDeInterrupcao(pr: Prancha, a: number, b: number, y: number): void {
  const c = (a + b) / 2;
  pr.polilinha([[a, y], [c - AMPLITUDE, y], [c, y - AMPLITUDE], [c, y + AMPLITUDE], [c + AMPLITUDE, y], [b, y]],
    { stroke: COR.linha, sw: 0.7, camada: 'alvenaria' });
}

// ── o desenho ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha (paraPrancha.ts). Com a tabela de
 *  gráficos da armação (graficos.ts, naVista). */
export function desenharArmacaoDaSapata(m: Modelo, o: OpcoesDaVista = {}): Prancha {
  return naVista('armacao', () => armacaoNaVista(m, o), o.graficos);
}

function armacaoNaVista(m: Modelo, o: OpcoesDaVista): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  pr.ajustar(o.anotacoes, o.S);
  const cotasAcesas = aparece('armacao', 'cotas');
  const sapatas = solidosDoModelo(m).filter((s) => s.peca.tipo === 'SAPATA').sort((a, b) => a.min[0] - b.min[0]);
  if (!sapatas.length) return pr;
  const aco = corDoAcoNoDesenho();
  const med = medidasDaSapata(sapatas[0]);
  const xIni = sapatas[0].min[0];
  const xFim = Math.max(...sapatas.map((s) => s.max[0]));
  const B = med.y1 - med.y0;
  // na tela, o muro inteiro mais a seção e a sombra do estribo ao lado; na prancha a escala vem pedida
  const S = o.S ?? escalaPara(xFim - xIni + 2.5 * B, 900, 0.045, 0.45);
  const X = (x: number) => x * S;
  const Y = (z: number) => -z * S;
  const fina = (phi: number) => Math.max(0.9, phi * S);
  // a sombra é a barra em destaque: mais grossa que a de dentro da peça (no Pró-Viga, 1,2φ contra 0,7φ)
  const grossa = (phi: number) => Math.max(1.8, 1.7 * phi * S);

  const longs = m.barras.filter((b) => b.papel === 'SAP_LONG');
  const transv = m.barras.filter((b) => b.papel === 'SAP_TRANSV' || b.papel === 'SAP_TORCAO');
  const esperas = m.barras.filter((b) => b.papel === 'ESPERA');

  // ── a sapata em elevação ──────────────────────────────────────────────────────────────────────────────────────
  // Só o contorno: na prancha de armação o concreto visto não leva hachura — a barra é que tem de ser lida (a
  // hachura fica na seção, que é cortada). A aresta do corpo sobre o dente é cada vértice do perfil ao longo do muro.
  pr.abrir('data-camada="sapata"');
  for (const s of sapatas) {
    const r = projecao(s, 'Y');
    pr.caminho([r.contorno.map(([x, z]): Pt => [X(x), Y(z)])], { fill: 'none', stroke: COR.linha, sw: 1.2, id: s.peca.id, camada: 'concreto' });
    const niveis = [...new Set(s.base.map((p) => Math.round(p[2])))].filter((z) => z > s.min[2] + 0.5 && z < s.max[2] - 0.5);
    for (const z of niveis) pr.linha(X(s.min[0]), Y(z), X(s.max[0]), Y(z), { stroke: COR.linha, sw: 0.9, camada: 'concreto' });
  }
  pr.fechar();

  // ── o toco do muro, cortado ───────────────────────────────────────────────────────────────────────────────────
  // O muro nasce na sapata como o pilar nasce na viga do Pró-Viga (pilH = 25 cm, com a linha de interrupção): o
  // toco diz onde ele senta e corta as esperas na mesma altura, sem a prancha mentir o traspasse (a medida dele é a
  // do corte lateral). Mínimo de 24 px: em 1:100 os 25 cm do Pró-Viga não deixariam lugar para o zigue-zague.
  const hToco = Math.max(24, 250 * S);
  const yToco = Y(0) - hToco;
  pr.abrir('data-camada="alvenaria"');
  for (const s of sapatas) {
    const [a, b] = [X(s.min[0]), X(s.max[0])];
    pr.linha(a, Y(0), a, yToco, { stroke: COR.linha, sw: 0.9, camada: 'alvenaria' });
    pr.linha(b, Y(0), b, yToco, { stroke: COR.linha, sw: 0.9, camada: 'alvenaria' });
    linhaDeInterrupcao(pr, a - 6, b + 6, yToco);
  }
  pr.fechar();

  // ── as barras dentro da sapata ────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="barras"');
  // esperas: tracejadas, do pé até o toco — leves, são do muro; aqui só se vê onde entram na armação da sapata
  const xsEsperas = new Set<number>();
  for (const b of esperas) {
    const [za, zb] = faixa(b.eixo, 2);
    if (za >= 0) continue;
    const x = b.eixo[0][0];
    if (xsEsperas.has(Math.round(x))) continue;
    xsEsperas.add(Math.round(x));
    pr.linha(X(x), Y(za), X(x), Math.max(Y(zb), yToco), { stroke: aco, sw: 0.7, dash: '5,3', id: b.id, camada: 'aco' });
  }
  // longitudinais: cada peça no seu z (as emendadas, no mesmo eixo: o traspasse se lê na sombra, não aqui)
  const vistas = new Set<string>();
  for (const b of longs) {
    const pts = projetarPontos(b.eixo, 'Y');
    const [xa, xb] = faixa(b.eixo, 0);
    const k = `${Math.round(zDoMaiorTrecho(pts))}|${Math.round(xa)}|${Math.round(xb)}`;
    if (vistas.has(k)) continue;
    vistas.add(k);
    pr.polilinha(pts.map(([x, z]): Pt => [X(x), Y(z)]), { stroke: aco, sw: fina(b.diametro), id: b.id, camada: 'aco' });
  }
  // estribos: um traço de pé em cada um (o "estribo na elevação" do Pró-Viga); a transversal reta, de frente, é ponto
  for (const b of transv) {
    const x = meioEmX(b);
    if (ehDePe(b)) {
      const [za, zb] = faixa(b.eixo, 2);
      pr.linha(X(x), Y(za), X(x), Y(zb), { stroke: aco, sw: fina(b.diametro) * 0.8, id: b.id, camada: 'aco' });
    } else {
      const z = b.eixo.reduce((s, p) => s + p[2], 0) / b.eixo.length;
      pr.circulo(X(x), Y(z), Math.max(1.4, (b.diametro / 2) * S), { fill: aco, id: b.id, camada: 'aco' });
    }
  }
  pr.fechar();

  // ── faixas de estribo, acima do toco ──────────────────────────────────────────────────────────────────────────
  const faixas = faixasDeEstribos(transv);
  const yFaixa = (i: number) => yToco - AMPLITUDE - ACIMA_DO_TOCO - i * PASSO_DA_FAIXA;
  pr.abrir('data-camada="faixas"');
  faixas.forEach((f, i) => {
    const y = yFaixa(i);
    for (const z of f.zonas) {
      pr.linha(X(z.xa), y, X(z.xb), y, { stroke: aco, sw: 0.9, camada: 'aco' });
      pr.circulo(X(z.xa), y, 2, { fill: aco, camada: 'aco' });
      pr.circulo(X(z.xb), y, 2, { fill: aco, camada: 'aco' });
    }
    // embaixo do traço, no começo da 1ª zona — a legenda única da faixa do Pró-Viga
    const rotulo = `${f.posicao} – ${f.qtd} ${bitola(f.diametro)}${f.passo !== null ? ` c/${f.passo}` : ''}`;
    pr.texto(X(f.zonas[0].xa), y + LEGENDA_FORA.embaixo, rotulo, { tam: T, ancora: 'start', camada: 'textos', chave: `faixa:${f.papel}:${f.posicao}` });
    // a faixa fica a uma altura fixa em px acima do toco: parte com origem própria (a cota criada nela não sai dela
    // ao trocar a escala); o x é o do muro, como a elevação
    const xa = Math.min(...f.zonas.map((z) => z.xa));
    const xb = Math.max(...f.zonas.map((z) => z.xb));
    pr.regiao(`faixa:${f.papel}:${f.posicao}`, [0, y], [X(xa) - 10, y - 12, X(xb) - X(xa) + 20, 24 + T]);
  });
  pr.fechar();
  // o que a elevação tem de mais alto até aqui (o ponto da ponta da faixa, ou o zigue-zague)
  const yAlto = faixas.length ? yFaixa(faixas.length - 1) - 2 : yToco - AMPLITUDE;

  // ── comprimento: por trecho (havendo junta) e o total ─────────────────────────────────────────────────────────
  const yFundo = Y(med.zFundo);
  let yCota = yFundo + 24;
  pr.abrir('data-camada="cotas"');
  pr.silenciar(!cotasAcesas);
  if (sapatas.length > 1) {
    pr.cadeiaH(sapatas.map((s) => ({ a: X(s.min[0]), b: X(s.max[0]), rotulo: cm(s.max[0] - s.min[0]) })), yCota, { de: [[yFundo, yFundo]] });
    yCota += 24;
  }
  pr.cotaH(X(xIni), X(xFim), yCota, cm(xFim - xIni), { de: [yFundo, yFundo] });
  pr.silenciar(false);
  pr.fechar();

  // ── sombras: as de baixo embaixo da cota, as de cima acima das faixas ─────────────────────────────────────────
  const familias = sombrasDaSapata(m);
  const legendaDe = new Map<SombraDaSapata, { texto: string; cx: number; w: number }>();
  for (const s of familias.flat()) {
    const texto = legendaDaSombra(s);
    legendaDe.set(s, { texto, cx: (X(s.xa) + X(s.xb)) / 2, w: Prancha.largura(texto, T) });
  }
  const pegada = (s: SombraDaSapata): Pegada => {
    const { cx, w } = legendaDe.get(s)!;
    const [a, b] = [X(s.xa), X(s.xb)];
    return { lo: Math.min(a, cx - w / 2), hi: Math.max(b, cx + w / 2), loTraco: a <= cx - w / 2, hiTraco: b >= cx + w / 2 };
  };
  let yMaisAlto = yAlto;
  pr.abrir('data-camada="sombras"');
  for (const face of ['inferior', 'superior'] as const) {
    const fams = familias.filter((f) => f[0].face === face);
    const fileira = arrumarEmFileiras(fams, pegada);
    // embaixo: fileiras descendo a partir da cota; em cima: subindo a partir da faixa mais alta
    const [y0, passo, fora] = face === 'inferior'
      ? [yCota + 4 + ANTES_DAS_SOMBRAS, FILEIRA, LEGENDA_FORA.embaixo]
      : [yAlto - ACIMA_DAS_FAIXAS, -FILEIRA, LEGENDA_FORA.emCima];
    for (const s of fams.flat()) {
      const y = y0 + fileira.get(s)! * passo;
      const pts = projetarPontos(s.eixo, 'Y');
      const zRef = zDoMaiorTrecho(pts);
      // a forma de verdade, com o trecho comprido na linha: o gancho, se houver, sai para o lado da peça
      pr.polilinha(pts.map(([x, z]): Pt => [X(x), y - (z - zRef) * S]), { stroke: aco, sw: grossa(s.diametro), id: s.ids[0], camada: CAMADA_DA_SOMBRA });
      const l = legendaDe.get(s)!;
      // a chave diz a face e o pedaço (a de baixo e a de cima saem com o mesmo texto); a camada é a da sombra
      const nome = `sombra:${s.face}:${s.posicao}:${s.trecho}:${Math.round(s.xa)}`;
      pr.texto(l.cx, y + fora, l.texto, { tam: T, camada: CAMADA_DA_SOMBRA, chave: nome });
      // cada fileira de sombra fica a uma distância fixa em px da elevação: parte com origem própria
      pr.regiao(nome, [0, y], [Math.min(X(s.xa), l.cx - l.w / 2) - 10, y - FILEIRA / 2, Math.max(X(s.xb), l.cx + l.w / 2) - Math.min(X(s.xa), l.cx - l.w / 2) + 20, FILEIRA]);
      if (face === 'superior') yMaisAlto = Math.min(yMaisAlto, y + fora - 0.85 * T);
    }
  }
  pr.fechar();

  // ── a seção, à direita de tudo ────────────────────────────────────────────────────────────────────────────────
  const sCorte = sapatas[0];
  const xC = xDoCorte(sCorte, longs, transv);
  // a cota da altura vai à esquerda da seção (lado do talão): o espaço dela entra no afastamento
  const xSec = pr.direita() + 60;
  // aterro à esquerda e pé à direita, como o corte lateral (U espelhado): o Jose já lê a sapata desse lado
  const U = (y: number) => xSec + (med.y1 - y) * S;
  const V = Y;
  const estilo = estiloDaSecao(sCorte, pr)!;
  pr.abrir('data-camada="secao"');
  for (const q of secao(sCorte, 'X', xC)) {
    pr.caminho([q.contorno, ...q.furos].map((a) => a.map(([y, z]): Pt => [U(y), V(z)])), { ...estilo, id: sCorte.peca.id });
  }
  // o toco do muro sobre a seção: onde ele senta, entre o pé e o talão
  const t = m.familia.t;
  pr.linha(U(0), V(0), U(0), V(0) - hToco, { stroke: COR.linha, sw: 0.9, camada: 'alvenaria' });
  pr.linha(U(t), V(0), U(t), V(0) - hToco, { stroke: COR.linha, sw: 0.9, camada: 'alvenaria' });
  linhaDeInterrupcao(pr, U(t) - 6, U(0) + 6, V(0) - hToco);
  pr.fechar();

  // as barras da seção: de cada família de estribo, a estação mais perto do corte (o de torção encosta na
  // transversal ou cai entre duas — sai o mais perto); as longitudinais que o plano atravessa, como ponto
  const noCorte = new Map<string, Barra[]>();
  for (const b of transv) {
    if (b.trecho !== sCorte.peca.trecho) continue;
    const k = `${b.papel}|${b.posicao}`;
    noCorte.set(k, [...(noCorte.get(k) ?? []), b]);
  }
  const representantes: Barra[][] = [];
  for (const bs of noCorte.values()) {
    const perto = bs.map(meioEmX).reduce((p, q) => (Math.abs(q - xC) < Math.abs(p - xC) ? q : p));
    representantes.push(bs.filter((b) => Math.abs(meioEmX(b) - perto) < 0.5));
  }
  representantes.sort((a, b) => (a[0].papel === b[0].papel ? 0 : a[0].papel === 'SAP_TRANSV' ? -1 : 1) || ordemDoN(a[0].posicao, b[0].posicao));
  // a barra marcada `fechada` (o estribo de antes dos ganchos) volta ao primeiro ponto; o de ganchos é aberto
  const forma = (b: Barra): Vec2[] => {
    const pts = projetarPontos(b.eixo, 'X');
    return b.fechada && pts.length > 2 ? [...pts, pts[0]] : pts;
  };
  pr.abrir('data-camada="barras"');
  for (const b of representantes.flat()) {
    pr.polilinha(forma(b).map(([y, z]): Pt => [U(y), V(z)]), { stroke: aco, sw: Math.max(1, b.diametro * S), id: b.id, camada: 'aco' });
  }
  const camadas = new Map<string, { z: number; n: number; posicao: string }>();
  for (const b of longs) {
    for (const [y, z] of cruzamentos(b.eixo, 'X', xC)) {
      pr.circulo(U(y), V(z), Math.max(1.6, (b.diametro / 2) * S), { fill: aco, id: b.id, camada: 'aco' });
      const k = `${Math.round(z)}|${b.posicao}`;
      const c = camadas.get(k);
      if (c) c.n++;
      else camadas.set(k, { z, n: 1, posicao: b.posicao });
    }
  }
  pr.fechar();

  // "11 N5" à direita do pé, na altura de cada camada (o rótulo por camada do corte do Pró-Viga); camadas muito
  // juntas para a letra (1:100) descem uma linha e meia uma da outra
  let yAnterior = -Infinity;
  for (const c of [...camadas.values()].sort((a, b) => V(a.z) - V(b.z) || ordemDoN(a.posicao, b.posicao))) {
    const y = Math.max(V(c.z) + 0.35 * T, yAnterior + 1.4 * T);
    yAnterior = y;
    pr.texto(U(med.y0) + 10, y, `${c.n} ${c.posicao}`, { tam: T, ancora: 'start', camada: 'textos', chave: `camada:${c.posicao}:${Math.round(c.z)}` });
  }

  // cotas da seção: a altura do corpo à esquerda, o dente (se houver) e a largura B embaixo — abaixo do último
  // rótulo de camada: na sapata estreita em escala pequena a cota não cabe entre as marcas e sai para a direita,
  // justo na coluna dos rótulos
  pr.abrir('data-camada="cotas"');
  pr.silenciar(!cotasAcesas);
  const xh = U(med.y1) - 22;
  pr.cotaV(xh, V(med.zCorpo), V(med.zTopo), cm(med.zTopo - med.zCorpo), { lado: -1, de: [U(med.y1), U(med.y1)] });
  let linhaB = Math.max(V(med.zFundo) + 22, yAnterior + 0.25 * T + 7 + 0.85 * T);
  if (med.zFundo < med.zCorpo - 1) {
    const fundo = sCorte.base.filter((p) => Math.abs(p[2] - med.zFundo) < 1).map((p) => p[1]);
    const [d0, d1] = [Math.min(...fundo), Math.max(...fundo)];
    // a altura do dente do lado do talão; encostado no talão, ela vai por fora da do corpo — na mesma linha, em
    // escala pequena os dois números saem para cima da cota e um escreveria em cima do outro
    const xd = U(d1) - xh < 30 ? xh - 18 : U(d1) - 18;
    pr.cotaV(xd, V(med.zFundo), V(med.zCorpo), cm(med.zCorpo - med.zFundo), { lado: -1, de: [U(d1), U(d1)] });
    pr.cotaH(U(d1), U(d0), linhaB, cm(d1 - d0), { de: [V(med.zFundo), V(med.zFundo)] });
    linhaB += 24;
  }
  pr.cotaH(U(med.y1), U(med.y0), linhaB, `B = ${cm(B)}`, { de: [V(med.zCorpo), V(med.zCorpo)] });
  pr.silenciar(false);
  pr.fechar();
  // a seção é uma parte com origem própria (fica depois da elevação, a uma distância que depende do muro e da
  // escala): a cota e o texto criados nela contam daqui
  pr.regiao('secao', [U(0), V(0)], [U(med.y1) - 60, V(med.zTopo) - hToco - 30, (med.y1 - med.y0) * S + 140, linhaB + 30 - (V(med.zTopo) - hToco - 30)]);

  // ── a sombra de cada estribo, ao lado da seção ────────────────────────────────────────────────────────────────
  // A forma fora da seção, na MESMA altura (a sombra do estribo do drawSection do Pró-Viga, que lá vai embaixo): as
  // pernas com as medidas da lista de ferros (formaDaBarra — o que o armador dobra), a altura do lado oposto aos
  // ganchos, a ponta do gancho escrita junto dele (como lá) e a legenda da chamada embaixo, com o c/ e o C da
  // posição inteira. Uma por POSIÇÃO: com o Ø da torção igual ao da transversal, os dois estribos são a mesma barra
  // (modulacao/barras.ts, numerarPosicoes) — duas faixas, uma sombra só.
  const porPosicao = new Map<string, Barra>();
  for (const g of representantes) if (!porPosicao.has(g[0].posicao)) porPosicao.set(g[0].posicao, g[0]);
  for (const b of porPosicao.values()) {
    const pts = forma(b);
    const [ya, yb] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
    const [za, zb] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
    const legenda = textoDaChamada(m, b.posicao, 'sapata');
    const ws = (yb - ya) * S;
    const wl = Prancha.largura(legenda, T);
    // a legenda é centrada na forma e pode ser mais larga que ela: o bloco começa depois do anterior sem encostar
    const x0 = pr.direita() + 24 + Math.max(36, (wl - ws) / 2);
    const Us = (y: number) => x0 + (yb - y) * S;
    pr.abrir(`data-camada="sombra-estribo" data-posicao="${b.posicao}"`);
    pr.polilinha(pts.map(([y, z]): Pt => [Us(y), V(z)]), { stroke: aco, sw: grossa(b.diametro), id: b.id, camada: CAMADA_DA_SOMBRA });
    const f = formaDaBarra(b);
    let yBaixo = V(za) + 20;
    pr.silenciar(!cotasAcesas);
    if (zb - za < 2 * b.diametro) {
      // deitada (a transversal reta): uma medida só
      pr.cotaH(Us(yb), Us(ya), yBaixo, String(f.trechos[0]), { de: [V(za), V(za)] });
    } else {
      // as medidas da forma (cm) postas na perna certa: a maior na direção mais comprida da forma desenhada
      const [m1, m2] = [Math.max(f.trechos[0], f.trechos[1] ?? 0), Math.min(f.trechos[0], f.trechos[1] ?? 0)];
      const [wCm, hCm] = yb - ya >= zb - za ? [m1, m2] : [m2, m1];
      const [ganchoNaDireita, ganchoEmCima] = cantoDosGanchos(pts, ya, yb, za, zb);
      pr.cotaH(Us(yb), Us(ya), yBaixo, String(wCm), { de: [V(za), V(za)] });
      // a altura do lado oposto aos ganchos: do lado deles vai o número da ponta
      const lado = ganchoNaDireita ? -1 : 1;
      const xBorda = ganchoNaDireita ? Us(yb) : Us(ya);
      pr.cotaV(xBorda + lado * 18, V(zb), V(za), String(hCm), { lado, de: [xBorda, xBorda] });
      if (b.estribo && b.eixo.length > 1) {
        const [p, q] = [b.eixo[0], b.eixo[1]];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        // por fora do canto, acima da perna dele (embaixo, acima da perna de baixo: a cota da largura está ali)
        const yt = ganchoEmCima ? V(zb) - 5 : V(za) - 4;
        if (ganchoNaDireita) pr.texto(Us(ya) + 5, yt, cm(L), { tam: T, ancora: 'start', cor: COR.cota, camada: 'cotas' });
        else pr.texto(Us(yb) - 5, yt, cm(L), { tam: T, ancora: 'end', cor: COR.cota, camada: 'cotas' });
      }
    }
    pr.silenciar(false);
    yBaixo += 6 + 0.85 * T;
    pr.texto((Us(ya) + Us(yb)) / 2, yBaixo, legenda, { tam: T, camada: CAMADA_DA_SOMBRA, chave: `estribo:${b.posicao}` });
    pr.fechar();
    // a sombra do estribo é uma parte com origem própria: a cota criada nela anda junto quando o muro cresce
    pr.regiao(`estribo:${b.posicao}`, [Us(0), V(0)], [Us(yb) - 30, V(zb) - 30, (yb - ya) * S + 60, (zb - za) * S + 70]);
  }

  // ── títulos ───────────────────────────────────────────────────────────────────────────────────────────────────
  // A seção leva o nome sempre (o "Corte A" que o Pró-Viga escreve sobre cada corte): a prancha dá um título só, para
  // a vista inteira. O título da vista e o "cotas em cm" são da tela — na prancha quem escreve é a folha.
  const ySecao = yToco - AMPLITUDE - 12;
  pr.texto(U(med.y1), ySecao, 'Seção transversal', { tam: 13, ancora: 'start', negrito: true });
  if (!o.semTitulo) {
    // acima das sombras de cima e do título da seção: muro curto em escala pequena põe os dois lado a lado
    const y = Math.min(yMaisAlto, ySecao - 13) - 30;
    pr.texto(X(xIni), y, 'Armação da sapata', { tam: 15, ancora: 'start', negrito: true });
    pr.texto(X(xIni), y + 16, 'cotas em cm', { tam: 10, ancora: 'start', cor: COR.nota });
  }
  return pr;
}

export function armacaoDaSapata(m: Modelo): string {
  return desenharArmacaoDaSapata(m).svg();
}
