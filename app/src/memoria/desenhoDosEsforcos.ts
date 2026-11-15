/*
  O DIAGRAMA DO AÇO NA MEMÓRIA — o mesmo desenho das barras da vista Esforços, chapado em 2D, no card de flexão (e no
  de cortante) de cada peça (Jose, 15/11: "os esforços a gente não vai mandar pra prancha, não. Eu nunca vi um projeto
  com um diagrama em prancha. Geralmente a gente guarda nas memórias").

  ⚠️ NENHUMA CONTA E NENHUMA SEGUNDA VERSÃO: os dados são os da vista (esforcos/barrasAnaliticas.ts — o necessário da
  planilha, o colocado das barras do modelo) e as áreas pintadas são as mesmas (esforcos/areas.ts). Aqui só se escolhe
  QUAL barra vai em QUAL card e se escreve o SVG, na régua dos outros desenhos gerados da memória (fundo branco, tinta
  escura, letra de 15 px; no tema escuro a .prancheta inverte, como os outros).

  A linguagem é a do gráfico de As do Pró-Viga: o eixo da peça na horizontal, do começo (base, face, raiz) à ponta;
  a face tracionada pelo esforço principal em cima, a outra embaixo; o colocado em verde envolvendo o necessário em
  vermelho, a falta em vermelho forte, o contorno tracejado de cada posição (N), o mínimo tracejado, a régua em cm² à
  esquerda e o comprimento cotado embaixo. Peça esquemática (só os picos são da conta): bordas tracejadas.
*/
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { barrasAnaliticas } from '@/esforcos/barrasAnaliticas';
import { areasDaFace, topoDaFace } from '@/esforcos/areas';
import type { BarraAnalitica, Diagrama, ModoDosEsforcos } from '@/esforcos/tipos';
import { nbr } from './formato';
import type { Card, Desenho } from './tipos';

const TINTA = '#1a1a1a';
const COTA = '#3a3a3a';
const VERDE = '#3f8a5c';
const VERMELHO = '#b0566a';
const FALTA = '#c62828';
const GRADE = '#c8c8c8';
const FS = 15;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (v: number) => (Number.isFinite(v) ? v : 0).toFixed(2);
const texto = (x: number, y: number, s: string, ancora: 'start' | 'middle' | 'end' = 'middle', cor = TINTA, tam = FS) =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${tam}" text-anchor="${ancora}" fill="${cor}">${esc(s)}</text>`;
const lin = (x1: number, y1: number, x2: number, y2: number, cor = TINTA, sw = 1, extra = '') =>
  `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${cor}" stroke-width="${sw}"${extra}/>`;
const marca = (x: number, y: number) => lin(x - 4, y + 4, x + 4, y - 4, COTA, 1.1);
const TRACO = ' stroke-dasharray="6 4"';

/** Os nomes das duas pontas da barra no desenho (a régua das outras figuras: começo à esquerda). */
function pontas(b: BarraAnalitica): [string, string] {
  switch (b.tipo) {
    case 'balanco': case 'contraforte': case 'painelVertical': case 'pilarete': return ['base', 'topo'];
    case 'naoArmado': case 'painelMc': return b.id.endsWith('.V') ? ['base', 'topo'] : ['apoio', 'apoio'];
    case 'ponta': return ['face do muro', 'ponta'];
    case 'talao': return ['face do muro', 'fim do talão'];
    case 'dente': return ['raiz', 'fundo'];
    case 'ligacao': return ['topo do arrimo', 'fim do traspasse'];
    default: return ['apoio', 'apoio'];
  }
}

const vertical = (b: BarraAnalitica) => Math.abs(b.ate[2] - b.de[2]) > Math.abs(b.ate[0] - b.de[0]) + Math.abs(b.ate[1] - b.de[1]);

/** Uma faixa do desenho: a barra com as duas faces, a régua e a cota; devolve o SVG da faixa e a altura dela. */
function faixa(b: BarraAnalitica, d: Diagrama, y0: number, W: number): { svg: string; altura: number } {
  const L = Math.hypot(b.ate[0] - b.de[0], b.ate[1] - b.de[1], b.ate[2] - b.de[2]);
  const ML = 130;
  const MR = 60;
  const PW = W - ML - MR;
  const HF = 110;                 // altura de cada face, px
  const faces = [...d.faces].sort((a, c) => c.face - a.face);
  const temCima = faces.some((f) => f.face === 1);
  const temBaixo = faces.some((f) => f.face === -1);
  const yTit = y0 + FS + 2;
  const yEixo = yTit + 24 + (temCima ? HF : 0);
  const X = (s: number) => ML + (s / L) * PW;
  const topo = Math.max(1e-9, ...faces.map(topoDaFace));
  const k = (HF * 0.88) / topo;
  const Y = (v: number, f: 1 | -1) => yEixo - f * v * k;
  const p: string[] = [];
  p.push(texto(ML, yTit, `${b.nome} · ${d.unidade}`, 'start', TINTA));
  // a régua: 1/3, 2/3 e o máximo de cada face, linhas finas
  for (const f of faces) {
    const t = topoDaFace(f);
    if (!(t > 0)) continue;
    for (let i = 1; i <= 3; i++) {
      const v = (i / 3) * t;
      p.push(lin(ML, Y(v, f.face), ML + PW, Y(v, f.face), GRADE, 0.6));
      p.push(texto(ML - 8, Y(v, f.face) + 5, nbr(v, 2), 'end', COTA, 13));
    }
  }
  p.push(texto(ML - 8, yEixo + 5, '0', 'end', COTA, 13));
  // as áreas (as mesmas da vista)
  const cores = { colocado: [VERDE, 0.32], necessario: [VERMELHO, 0.6], falta: [FALTA, 0.92] } as const;
  for (const f of faces) {
    for (const t of areasDaFace(f, L, d.fimLivre, topo)) {
      const [cor, op] = cores[t.tipo];
      const pts = [[t.s0, t.a0], [t.s0, t.b0], [t.s1, t.b1], [t.s1, t.a1]].map(([s, v]) => `${f2(X(s!))},${f2(Y(v!, f.face))}`).join(' ');
      p.push(`<polygon points="${pts}" fill="${cor}" fill-opacity="${op}" stroke="none"/>`);
    }
  }
  const tr = d.esquematico ? TRACO : '';
  for (const f of faces) {
    const poli = (ps: { s: number; v: number }[], cor: string) =>
      ps.length > 1 ? `<polyline points="${ps.map((q) => `${f2(X(q.s))},${f2(Y(q.v, f.face))}`).join(' ')}" fill="none" stroke="${cor}" stroke-width="1.4"${tr}/>` : '';
    p.push(poli(f.colocado, VERDE), poli(f.necessario, VERMELHO));
    // o contorno de cada posição (N), com o nome dela no canto
    for (const fam of f.familias) {
      const ya = Y(fam.v, f.face);
      p.push(`<polyline points="${f2(X(fam.s0))},${f2(yEixo)} ${f2(X(fam.s0))},${f2(ya)} ${f2(X(fam.s1))},${f2(ya)} ${f2(X(fam.s1))},${f2(yEixo)}" fill="none" stroke="${VERDE}" stroke-width="1"${TRACO}/>`);
      p.push(texto((X(fam.s0) + X(fam.s1)) / 2, ya + (f.face === 1 ? -5 : 15), fam.posicao, 'middle', VERDE, 13));
    }
    if (f.minimo !== null && f.minimo > 0) {
      p.push(lin(ML, Y(f.minimo, f.face), ML + PW, Y(f.minimo, f.face), VERMELHO, 1.2, TRACO));
      p.push(texto(ML + PW + 4, Y(f.minimo, f.face) + 5, 'mín', 'start', VERMELHO, 13));
    }
  }
  // os números dos picos: o necessário e o colocado na seção crítica
  for (const pk of d.picos) {
    if (pk.qual === 'min') continue;
    // o necessário por cima da curva dele; o colocado por dentro do verde, logo abaixo da borda
    const y = pk.qual === 'nec' ? Y(pk.valor, pk.face) + (pk.face === 1 ? -6 : 18) : Y(pk.valor, pk.face) + (pk.face === 1 ? 18 : -6);
    const direita = X(pk.s) > ML + PW * 0.6;
    // o colocado um pouco ao lado, para não cair em cima do necessário quando os dois se encostam
    const dx = pk.qual === 'col' ? 64 : 6;
    const x = direita ? Math.min(ML + PW, X(pk.s)) - dx : Math.max(ML, X(pk.s)) + dx;
    const falta = pk.qual === 'nec' && !d.envolve;
    p.push(texto(x, y, nbr(pk.valor, 2), direita ? 'end' : 'start', pk.qual === 'col' ? VERDE : falta ? FALTA : VERMELHO));
  }
  // o eixo, por cima de tudo
  p.push(lin(ML, yEixo, ML + PW, yEixo, TINTA, 1.6));
  // a cota do comprimento, com as pontas nomeadas
  const yC = yEixo + (temBaixo ? HF : 0) + 34;
  const [a, z] = pontas(b);
  p.push(lin(ML, yC, ML + PW, yC, COTA, 0.8), marca(ML, yC), marca(ML + PW, yC));
  p.push(lin(ML, yEixo + 3, ML, yC + 4, COTA, 0.4, ' stroke-dasharray="2 2"'), lin(ML + PW, yEixo + 3, ML + PW, yC + 4, COTA, 0.4, ' stroke-dasharray="2 2"'));
  p.push(texto(ML + PW / 2, yC - 6, `${vertical(b) ? 'h' : 'L'} = ${nbr(L / 1000, 2)} m`, 'middle', COTA));
  p.push(texto(ML, yC + FS + 4, a, 'start', COTA, 13), texto(ML + PW, yC + FS + 4, z, 'end', COTA, 13));
  return { svg: p.join(''), altura: yC + FS + 14 - y0 };
}

/** O desenho de um card: uma faixa por barra, uma embaixo da outra. */
export function desenhoDosEsforcos(barras: BarraAnalitica[], modo: ModoDosEsforcos, titulo: string): Desenho | null {
  const W = 900;
  const partes: string[] = [];
  let y = 8;
  for (const b of barras) {
    const d = modo === 'flexao' ? b.flexao : b.cortante;
    if (!d || !d.faces.length) continue;
    const f = faixa(b, d, y, W);
    partes.push(f.svg);
    y += f.altura + 18;
  }
  if (!partes.length) return null;
  const H = Math.ceil(y);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/>${partes.join('')}</svg>`,
    titulo,
    largura: W,
  };
}

/** A barra que representa cada "jeito" de peça no card (o 1º contraforte de cada tipo, a 1ª canaleta, o 1º vão…). */
function chaveDoJeito(b: BarraAnalitica): string {
  switch (b.tipo) {
    case 'contraforte': return `cf${b.nome.includes('extremidade') ? 'E' : 'I'}`;
    case 'naoArmado': case 'painelMc': return b.id.replace(/^T\d+\./, '');
    case 'cintaMc': return b.id.replace(/^T\d+\.V\d+\./, '');
    default: return b.tipo;
  }
}

/** Onde o desenho entra em cada card: a seção (pelo começo do título) e o modo. */
const LUGARES: { card: string; modo: ModoDosEsforcos; secao: string[]; tipos?: BarraAnalitica['tipo'][] }[] = [
  { card: 'balanco.flexao', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'balanco.cisalhamento', modo: 'cortante', secao: ['Cisalhamento'], tipos: ['balanco'] },
  { card: 'contraforte.flexao', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'contraforte.cisalhamento', modo: 'cortante', secao: ['Estribo adotado', 'Estribo necessário'], tipos: ['contraforte'] },
  { card: 'painelCf.flexaoVertical', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'painelCf.flexaoHorizontal', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'painelEls.painel', modo: 'flexao', secao: ['Momento resistente da alvenaria não armada'] },
  { card: 'painelCf.naoArmado', modo: 'flexao', secao: ['Momento resistente da alvenaria não armada'] },
  { card: 'sapata.flexao.ponta', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'sapata.flexao.talao', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'sapata.cortante', modo: 'cortante', secao: ['Cortante resistente sem estribo'], tipos: ['ponta', 'talao'] },
  { card: 'fundacao.dente', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'fundacao.dente', modo: 'cortante', secao: ['Cortante na raiz'] },
  { card: 'murocima.pilarete', modo: 'flexao', secao: ['Momento resistente com a armadura adotada'] },
  { card: 'murocima.pilarete', modo: 'cortante', secao: ['Cisalhamento'] },
  { card: 'murocima.cintas', modo: 'flexao', secao: ['Momento resistente lateral'] },
  { card: 'murocima.cintas', modo: 'cortante', secao: ['Cortante resistente sem estribo'] },
  { card: 'murocima.muro', modo: 'flexao', secao: ['Momento resistente da alvenaria · painel A', 'Momento resistente da alvenaria'] },
];

/** O card de cada barra na vista, para o cortante: o card de flexão leva a flexão; o de cortante, de onde sai. */
const CARD_DA_FLEXAO: Record<string, string> = { 'balanco.cisalhamento': 'balanco.flexao', 'contraforte.cisalhamento': 'contraforte.flexao', 'sapata.cortante': '' };

/**
 * Os cards com o diagrama do aço (e do cortante) nas seções de cada peça. Não muda conta nem verificação: só põe o
 * `desenho` numa seção que ainda não tem. Sem modelo (o muro sem dado), os cards voltam como vieram.
 */
export function comDiagramasDosEsforcos(cards: Card[], r: Resultado, modelo: Modelo | null | undefined): Card[] {
  if (!modelo) return cards;
  const barras = barrasAnaliticas(r, modelo);
  if (!barras.length) return cards;
  const inter = String(r.v('tipo_cf') ?? '').startsWith('Inter');
  const porCard = new Map<string, BarraAnalitica[]>();
  for (const b of barras) {
    const l = porCard.get(b.card) ?? [];
    if (!l.some((x) => chaveDoJeito(x) === chaveDoJeito(b))) l.push(b);
    porCard.set(b.card, l);
  }
  // o contraforte que a aba dimensiona primeiro (o "deste tipo"), depois o outro
  const cf = porCard.get('contraforte.flexao');
  if (cf) cf.sort((a, c) => Number(a.nome.includes('extremidade') === inter) - Number(c.nome.includes('extremidade') === inter));
  return cards.map((card) => {
    const lugares = LUGARES.filter((l) => l.card === card.id);
    if (!lugares.length || !card.aplicavel) return card;
    let secoes = card.secoes;
    for (const lugar of lugares) {
      const origem = lugar.card in CARD_DA_FLEXAO ? (CARD_DA_FLEXAO[lugar.card] || null) : lugar.card;
      const doCard = origem ? porCard.get(origem) ?? [] : barras.filter((b) => lugar.tipos?.includes(b.tipo) && b.trecho === 1);
      const bs = lugar.tipos ? doCard.filter((b) => lugar.tipos!.includes(b.tipo)) : doCard;
      const titulo = lugar.modo === 'flexao' ? 'Aço necessário e colocado ao longo da peça' : 'Cortante: necessário e resistente ao longo da peça';
      const des = desenhoDosEsforcos(bs, lugar.modo, titulo);
      if (!des) continue;
      // a seção pedida; já com desenho, a seguinte livre da lista; nenhuma, a última livre do card
      let i = -1;
      for (const nome of lugar.secao) {
        i = secoes.findIndex((s) => s.titulo.startsWith(nome) && !s.desenho);
        if (i >= 0) break;
      }
      if (i < 0) for (let k = secoes.length - 1; k >= 0; k--) if (!secoes[k]!.desenho) { i = k; break; }
      if (i < 0) continue;
      secoes = secoes.map((s, k) => (k === i ? { ...s, desenho: des } : s));
    }
    return secoes === card.secoes ? card : { ...card, secoes };
  });
}
