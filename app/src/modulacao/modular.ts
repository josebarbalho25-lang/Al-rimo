/*
  A REGRA MODULAR — uma função só, que leva as entradas para o módulo do bloco.

  Por que aqui e por que uma só: a planilha publica os valores ajustados (m_mod, l_cf_adot, tenr_adot, H_muro_des,
  n_fiadas e s_adot já múltiplo do módulo — gerador de 09/10). Quando o nome existe no Resultado, ele manda e a
  regra só confere; sem ele (Resultado antigo, teste) a regra faz o ajuste. Cada ajuste vira um Ajuste ("1,50 → 1,60 m") para a
  tela mostrar — o projetista tem de ver que o desenho não é exatamente o que ele digitou.

  Lado da segurança (brief §5.1, decisão do orquestrador): vão entre contrafortes e comprimento do contraforte
  PARA CIMA; espaçamentos (barras, canaletas, estribos) PARA BAIXO. Altura: desde 09/10 (Jose) são duas entradas —
  a do muro (lista de fiadas inteiras, é a que se desenha) e a de solo (≤ muro, é até onde vão o aterro e a drenagem).

  O vão entre contrafortes, além de fechar no módulo, tem de AMARRAR com o encaixe da família (fiadas.ts prova
  montando um muro de ensaio). Por isso a tela não deve oferecer o l_cf livre: `vaosDoContraforte` dá a lista.
*/
import type { Ajuste, Aviso, Familia } from '@/modelo/tipos';
import { CATALOGO, H_FIADA, JUNTA, furoCalibrado, meioModulo, type FamiliaDoCatalogo, type NomeFamilia } from './catalogo';
import { ENCAIXES, minimosDaFamilia } from './encaixes';
import { vaoAmarra } from './fiadas';
import type { Parametros } from './leitura';
import type { Furo } from './perfis';

const EPS = 1e-6;

/** Contraforte como nó da linha do muro: faixa [xs, xe) = bloco deitado (t) + junta. */
export interface No {
  tipo: 'T' | 'L0' | 'L1';
  xs: number;
  xe: number;
  xc: number;          // eixo do contraforte (no dobrado, o eixo DESTA metade — o bloco dela)
  cf: number;          // nº do contraforte ao longo de X (1..); as duas metades do dobrado têm o MESMO número
  /**
   * Metade do contraforte DOBRADO (Jose, 16/11): 'a' = a da esquerda (o L1 do pano de antes), 'b' = a da direita (o
   * L0 do pano seguinte). Cada metade é o contraforte de ponta do gabarito (template L), as duas encostadas com 1 cm de
   * argamassa — a montagem que a junta de controle já desenha. Sem o campo: contraforte simples.
   */
  metade?: 'a' | 'b';
}

/**
 * Trecho = o pedaço do muro entre juntas de controle (sapata, dreno e terreno contínuos). Com contraforte dobrado, os
 * `panos` são os pedaços de um vão só (L0 … L1) em que os blocos se montam: cada um é montado como um trecho com o
 * gabarito de ponta nas duas pontas, e as fiadas se juntam na ordem de `nos` (fiadas.ts montarFiadasDoTrecho).
 */
export interface TrechoModulado { indice: number; x0: number; x1: number; nos: No[]; panos?: TrechoModulado[] }

/** Nome do nó nos ids (peças, barras): o nº do contraforte e, no dobrado, a letra da metade ("2a", "2b"). */
export const idDoNo = (no: No): string => `${no.cf}${no.metade ?? ''}`;

/** As duas metades de um contraforte dobrado (a e b), ou o nó sozinho. */
export function metadesDe(tr: TrechoModulado, no: No): No[] {
  return no.metade ? tr.nos.filter((n) => n.cf === no.cf) : [no];
}

/**
 * Os contrafortes do trecho como PEÇA (o dobrado é um só): eixo, faixa em X (o par inteiro no dobrado) e o tipo do
 * nó (o dobrado conta como intermediário, 'T').
 */
export interface ContraforteDoTrecho { cf: number; xc: number; xs: number; xe: number; tipo: No['tipo']; dobrado: boolean }

export function contrafortesDoTrecho(tr: TrechoModulado): ContraforteDoTrecho[] {
  const out: ContraforteDoTrecho[] = [];
  for (const no of tr.nos) {
    if (no.metade === 'b') continue;
    if (no.metade === 'a') {
      const b = tr.nos.find((n) => n.cf === no.cf && n.metade === 'b')!;
      out.push({ cf: no.cf, xc: (no.xc + b.xc) / 2, xs: no.xs, xe: b.xe, tipo: 'T', dobrado: true });
    } else {
      out.push({ cf: no.cf, xc: no.xc, xs: no.xs, xe: no.xe, tipo: no.tipo, dobrado: false });
    }
  }
  return out;
}

/**
 * Os vãos do trecho entre faces de contraforte, [x0, x1] (x0 = face do contraforte da esquerda, x1 = xs do da
 * direita): entre as duas metades do dobrado não há vão (é a junta de argamassa).
 */
export function vaosDoTrecho(tr: TrechoModulado): [number, number][] {
  const out: [number, number][] = [];
  for (let v = 0; v + 1 < tr.nos.length; v++) {
    const [a, b] = [tr.nos[v], tr.nos[v + 1]];
    if (a.metade && a.cf === b.cf) continue;
    out.push([a.xe - JUNTA, b.xs]);
  }
  return out;
}

export interface Modulo {
  cat: FamiliaDoCatalogo;
  familia: Familia;
  furo: Furo;            // furo calibrado no Ag da tabela da aula (só peças sem medida do Revit — hoje nenhuma)
  m: number;
  Wn: number;            // largura do nó do contraforte na linha do muro
  n_fiadas: number;
  H_des: number;
  s_vert: number;        // barras do balanço (mm, múltiplo de m)
  s_pv: number;          // barras do painel (mm, múltiplo de m)
  s_can: number;         // canaletas intermediárias (mm, múltiplo de 200; 0 = só a cinta)
  l_cf: number;          // eixo a eixo (mm); no dobrado, de centro a centro do par
  /** Dobrado: o eixo a eixo do simples com o mesmo vão livre (xs a xs dentro de um pano: t + 1 cm + k·m). */
  l_pano?: number;
  tenr: number;          // comprimento do contraforte, da face externa (mm)
  n_haste: number;       // células da haste além do muro
  s_est: number;         // estribos do contraforte (mm, múltiplo de 200)
  trechos: TrechoModulado[];
  L_real: number;
  ajustes: Ajuste[];
}

// Só a família 39 (14×39 e 19×39): o comprimento do bloco é fixo na planilha (L_bloco = 39).
function familiaDe(p: Parametros): NomeFamilia {
  return Math.round(p.t_bloco) === 19 ? '19x39' : '14x39';
}

const r2 = (x: number): number => Math.round(x * 100) / 100;
/** Número no formato da tela (vírgula decimal), sem depender do ICU do ambiente. */
export const br = (x: number, casas = 2): string => String(Math.round(x * 10 ** casas) / 10 ** casas).replace('.', ',');

export function modular(p: Parametros, avisos: Aviso[]): Modulo {
  const ajustes: Ajuste[] = [];
  const ajuste = (nome: string, de: number, para: number, unidade: string): void => {
    if (Math.abs(de - para) > 1e-6) ajustes.push({ nome, de: r2(de), para: r2(para), unidade });
  };

  const nomeFam = familiaDe(p);
  const cat = CATALOGO[nomeFam];
  const enc = ENCAIXES[nomeFam];
  // O desenho é o do bloco do mercado (Revit do Jose) e não o da tabela da aula (decisão do Jose, 09/10: o furo sai
  // do bloco desenhado).
  const hf = cat.hf;
  const furo = furoCalibrado(cat);
  const mRegra = meioModulo(cat);
  const m = p.pl.m_mod ?? mRegra;
  if (m !== mRegra) avisos.push({ codigo: 'MODULO_PLANILHA', texto: `Módulo da planilha ${m / 10} cm ≠ ${mRegra / 10} cm da família` });
  const Wn = cat.t + JUNTA;
  const familia: Familia = { nome: nomeFam, t: cat.t, L: cat.L, Lm: cat.Lm, m, h: 190, hf, junta: JUNTA };
  if (enc.provisoria) familia.provisoria = true;

  // ── altura ──
  // Desde 09/10 a altura do MURO é entrada própria (lista de fiadas inteiras) e o solo fica abaixo dela ou no topo.
  // As fiadas cobrem o muro; o "→" só aparece se a altura digitada não fechar a fiada (valor fora da lista).
  const Hm = Math.round(p.H_muro);
  // As fiadas da planilha mandam quando cobrem a altura do muro. Com a altura em branco a planilha dá 1 fiada (do H
  // vazio) e a leitura desenha com a altura de obra padrão — aí vale a regra, senão o muro fica abaixo do aterro.
  const nPl = p.pl.n_fiadas;
  const daPlanilha = nPl !== null && nPl >= 1 && nPl * H_FIADA >= Hm - EPS;
  const n_fiadas = daPlanilha ? (nPl as number) : Math.max(1, Math.ceil(Hm / H_FIADA - EPS));
  const H_des = daPlanilha ? (p.pl.H_muro_des ?? n_fiadas * H_FIADA) : n_fiadas * H_FIADA;
  ajuste('H_muro', Hm / 1000, H_des / 1000, 'm');

  // ── espaçamentos, para baixo ──
  const paraBaixo = (v: number | null, passo: number, nome: string, rotulo: string, escala: number, unidade: string, codigo: string): number => {
    if (v === null || v <= 0) {
      avisos.push({ codigo, texto: `${rotulo}: sem espaçamento na conta — desenhado a cada ${br(passo / escala)} ${unidade}` });
      return passo;
    }
    const s = Math.floor(v / passo + EPS) * passo;
    if (s < passo) {
      avisos.push({ codigo, texto: `${rotulo}: ${br(v / escala)} ${unidade} menor que o módulo — desenhado a cada ${br(passo / escala)} ${unidade}` });
      ajuste(nome, v / escala, passo / escala, unidade);
      return passo;
    }
    ajuste(nome, v / escala, s / escala, unidade);
    return s;
  };

  let s_vert = m;
  let s_pv = m;
  let s_est = H_FIADA;
  let s_can = 0;
  let l_cf = 0;
  let tenr = 0;
  let n_haste = 0;

  // canaletas intermediárias: espaçamento da conta (h_pan no balanço, s_ph nos contrafortes), múltiplo da fiada
  const sCanBruto = p.contrafortes ? p.s_ph : p.s_can_bal;
  const nomeCan = p.contrafortes ? 's_ph' : 'h_pan';
  const escCan = p.contrafortes ? 10 : 1000;
  const uniCan = p.contrafortes ? 'cm' : 'm';
  if (sCanBruto !== null && sCanBruto > 0) {
    s_can = Math.max(H_FIADA, Math.floor(sCanBruto / H_FIADA + EPS) * H_FIADA);
    ajuste(nomeCan, sCanBruto / escCan, s_can / escCan, uniCan);
  } else {
    avisos.push({ codigo: 'CANALETA_SEM_ESPACAMENTO', texto: 'Canaletas intermediárias: sem espaçamento na conta — só a cinta do topo' });
  }

  if (!p.contrafortes) {
    s_vert = paraBaixo(p.s_vert, m, 's_adot', 'Barras verticais', 10, 'cm', 'ESPACAMENTO_BARRAS');
  } else {
    s_pv = paraBaixo(p.s_pv, m, 's_pv', 'Barras verticais do painel', 10, 'cm', 'ESPACAMENTO_PAINEL');
    // sem estribo (dispensa pela conta) não há espaçamento a ajustar nem aviso a dar
    if (p.estribos) s_est = paraBaixo(p.s_est, H_FIADA, 's_est', 'Estribos do contraforte', 10, 'cm', 'ESPACAMENTO_ESTRIBO');

    const min = minimosDaFamilia(nomeFam);
    // eixo a eixo = nó + k células; para cima, e só num vão que AMARRA com a receita da tabela (fiadas.ts prova).
    // Ex.: na 14x39 com o 54/34 só k par amarra — 1,50 vai a 1,75, não a 1,55 (que deixa junta a prumo no vão).
    // O vão da planilha (l_cf_adot) manda quando cai na grade E amarra. A planilha só conhece o módulo (t + 1 cm +
    // n·m); a paridade do encaixe (a 14x39, com o 54 e o 34 do Jose, só amarra com n par) é da receita, que mora aqui. Desenhar com um
    // vão que não amarra deixaria junta a prumo — então, nesse caso, a regra abaixo escolhe o vão e o aviso diz que o
    // desenho difere da conta. Com a lista das Entradas (só vãos que amarram) não acontece; fica como garantia.
    // Dobrado (16/11): o contraforte tem 2t + 1 cm, e o vão LIVRE é o do simples — o eixo a eixo é 2t + 2 cm + k·m
    // (a planilha, l_cf_adot), o do simples com o mesmo k mais uma largura de nó. A amarração é a do simples com k.
    const Wv = p.dobrado ? 2 * Wn : Wn;
    const plVao = p.pl.l_cf_adot;
    const kPl = plVao === null ? null : Math.round((plVao - Wv) / m);
    const vaoDaConta = plVao !== null && kPl !== null && Math.abs(Wv + kPl * m - plVao) <= 0.5 && kPl >= min.celulasNoVao && vaoAmarra(cat, kPl);
    if (vaoDaConta) {
      l_cf = plVao as number;
    } else {
      const k0 = Math.max(min.celulasNoVao, Math.ceil((p.l_cf - Wv) / m - EPS));
      let k = k0;
      while (k < k0 + 8 && !vaoAmarra(cat, k)) k++;
      if (!vaoAmarra(cat, k)) {
        k = k0;
        avisos.push({ codigo: 'VAO_NAO_AMARRA', texto: `Vão de ${br((Wv + k * m) / 1000)} m não amarra com o encaixe da família ${nomeFam}` });
      } else if (k !== k0) {
        avisos.push({ codigo: 'VAO_AMARRACAO', texto: `Vão de ${br((Wv + k0 * m) / 1000)} m deixa junta a prumo no encaixe da família ${nomeFam}: ${br((Wv + k * m) / 1000)} m` });
      }
      l_cf = Wv + k * m;
      if (plVao !== null && Math.abs(plVao - l_cf) > 0.5) {
        avisos.push({ codigo: 'VAO_DIFERE_DA_CONTA', texto: `Vão da conta ${br(plVao / 1000)} m não amarra na família ${nomeFam}: desenhado com ${br(l_cf / 1000)} m` });
      }
    }
    ajuste('l_cf', p.l_cf / 1000, l_cf / 1000, 'm');
    // comprimento do contraforte = t + n células; para cima
    if (p.pl.tenr_adot !== null) {
      tenr = p.pl.tenr_adot;
    } else {
      const n = Math.max(min.celulasNaHaste, Math.ceil((p.tenr - cat.t) / m - EPS));
      tenr = cat.t + n * m;
    }
    n_haste = Math.round((tenr - cat.t) / m);
    ajuste('tenr_', p.tenr / 10, tenr / 10, 'cm');
    // dobrado calculado: barras em número par, metade em cada bloco — o ímpar digitado vai ao par de cima (planilha)
    if (p.dobCalc && p.n_cf_dir !== null) ajuste('n_cf', p.n_cf_dir, p.n_cf, '');
    // dobrado (Jose, 16/11: "dois estribos por fiada"): com 2 nas Entradas a conta passa a 4 quando um estribo não
    // basta — o "→ 4" mostra o adotado (o do dobrado: o calculado, ou o outro tipo quando o calculado é a ponta)
    if (p.dobrado && p.ramos_dig !== null) ajuste('ramos_est', p.ramos_dig, p.dobCalc ? p.ramos_est : p.ramos_o, '');
    // espessura do contraforte = largura do bloco (brief Q5): eenr ≠ t não tem amarração simples. O dobrado (16/11)
    // é dois blocos com 1 cm de argamassa: 2t + 1 — a planilha publica o eenr do contraforte CALCULADO (dob_cf).
    ajuste('eenr', p.eenr / 10, (p.dobCalc ? 2 * cat.t + JUNTA : cat.t) / 10, 'cm');
    if (p.bal_cf > 0) {
      avisos.push({ codigo: 'BALANCO_ALEM_DO_CF', texto: 'Balanço além do contraforte de ponta não desenhado (contraforte rente à ponta)' });
    }
  }

  // ── comprimento e trechos ──
  const l_pano = p.contrafortes && p.dobrado ? l_cf - Wn : undefined;
  const { trechos, L_real } = !p.contrafortes
    ? trechosEmBalanco(p, m)
    : l_pano !== undefined
      ? trechosComDobrados(p, Wn, l_pano, vaosDeFechamento(nomeFam, l_pano))
      : trechosComContrafortes(p, Wn, l_cf, vaosDeFechamento(nomeFam, l_cf));
  // O comprimento digitado é o MODULAR (Jose: "comprimento fixado em múltiplos dos blocos"): células de bloco + junta
  // contadas com a junta da ponta, como na planta de modulação. O desenhado (L_real, que o quantitativo e os desenhos
  // usam) é 1 cm menor — a junta da ponta não tem bloco do outro lado. Comparar o digitado com o desenhado punha
  // "6,00 → 5,99" em todo muro que já fechava; comparando com o modular, a seta só aparece quando o valor não fecha.
  // A seta mostra o modular, e não o desenhado, para que digitar o valor dela a faça sumir.
  ajuste('L_total', p.L_total / 1000, (L_real + JUNTA) / 1000, 'm');

  const mod: Modulo = { cat, familia, furo, m, Wn, n_fiadas, H_des, s_vert, s_pv, s_can, l_cf, tenr, n_haste, s_est, trechos, L_real, ajustes };
  if (l_pano !== undefined) mod.l_pano = l_pano;
  return mod;
}

/**
 * Juntas de controle: o muro vira trechos independentes, com 10 mm de folga entre eles (muro e sapata cortados
 * juntos). Os trechos saem do mesmo tamanho (± uma célula ou um vão) — DEDUÇÃO: "a cada X m" lido como
 * "nenhum trecho maior que X", com os trechos iguais em vez de sobrar um pedaço no fim.
 */
function quantosTrechos(L: number, J: number): number {
  return J > 0 ? Math.max(1, Math.ceil(L / J - EPS)) : 1;
}

function dividir(total: number, partes: number): number[] {
  const base = Math.floor(total / partes);
  const extra = total % partes;
  return Array.from({ length: partes }, (_, k) => base + (k < extra ? 1 : 0));
}

/** Largura de um trecho com contrafortes: Σ peso(vão) + fixo (simples: vão, + t do nó da ponta; dobrado: vão + t + 1 cm
 *  de cada pano, − a junta da ponta). Linear de propósito: as contas abaixo rodam a cada tecla e usam somas acumuladas. */
interface LarguraDoTrecho { peso: (v: number) => number; fixo: number }

/**
 * Juntas de controle com contrafortes: QUANTOS trechos e QUANTOS vãos em cada um (revisão de 16/11, depois do vão de
 * fechamento — a regra do cc7e17f repartia pela CONTAGEM e oscilava):
 *  - os vãos se repartem pelo COMPRIMENTO (`repartirPorComprimento`): o trecho mais comprido o mais curto possível.
 *    O trecho do fechamento (o mais curto) fica com o vão que sobra; pela contagem, o vão a mais ia para os primeiros,
 *    de vão cheio, e o trecho passava do "a cada X" (L 9,3 com junta a cada 6: trecho de 6,79 m);
 *  - os vãos de cada nº de trechos saem de escolherVaos SÓ entre as formas em que todo trecho cabe na junta, e o nº de
 *    trechos vai do menor que serve até o de antes (pelo desenhado): entre eles, o que fecha mais perto do digitado
 *    (empate: o mais comprido, como escolherVaos; depois o de antes; depois o de menos trechos). Se um vão cheio
 *    sozinho já passa da junta, vale um vão por trecho no máximo;
 *  - a seta tem de ser PONTO FIXO: só se devolve um muro que a própria regra devolve quando se digita o comprimento
 *    dele. Sem isso o nº de trechos oscilava (5,85 com junta a cada 6 → 6,10; digitando 6,10 → 6,25).
 * Sem junta de controle esta função não é chamada (o muro de um trecho só não mudou).
 */
function arranjarComJuntas(
  L: number,
  J: number,
  vaosDe: (L: number, n: number, aceita?: (lista: number[]) => boolean) => number[],
  modularDe: (lista: number[], n: number) => number,
  largura: LarguraDoTrecho,
  vaoCheio: number,
): { lista: number[]; contagens: number[] } {
  // Vão cheio sozinho maior que a junta: não há como caber; o teto vira o trecho de um vão cheio (um vão por trecho,
  // no máximo). Sem isso nenhum nº de trechos servia e a busca do ponto fixo crescia o muro a cada volta (6 m com vão
  // 0,80 e junta a cada 0,79 virava 27 m).
  // O nº de partida também conta com esse teto: pela junta curta ele partiria de um trecho por metro, com vãos à força.
  const Jef = Math.max(J, largura.peso(vaoCheio) + largura.fixo);
  const teto = Jef + 0.5;
  type Arranjo = { lista: number[]; contagens: number[] };
  type Opcao = { lista: number[]; k: number; cabe: boolean; d: number; M: number };
  const arranjo = (o: { lista: number[]; k: number }): Arranjo =>
    ({ lista: o.lista, contagens: repartirPorComprimento(o.lista, Math.min(o.k, o.lista.length), largura) });
  // escolha(Lx, folga): a regra para um digitado Lx; devolve a escolhida e as opções que servem (com `folga` trechos a
  // mais depois do de partida, para a busca do ponto fixo abaixo).
  const escolha = (Lx: number, folga = 0): { r: Arranjo; opcoes: Opcao[] } => {
    // nº de partida: o de antes (pelo desenhado, repetindo até parar)
    let n = quantosTrechos(Lx - JUNTA, Jef);
    for (let i = 0; i < 4; i++) {
      const outro = quantosTrechos(modularDe(vaosDe(Lx, n), n) - JUNTA, Jef);
      if (outro === n) break;
      n = outro;
    }
    // O vão mais perto do digitado podia não caber quando outro, à mesma distância, cabia (2,50 com junta a cada
    // 2,50: um vão de 2,20 cabe, o par 1,20 + 1,20 da mesma distância não) — o filtro vai para dentro de escolherVaos.
    const cabeEm = (k: number) => (v: number[]): boolean => { const g = menosTrechos(v, largura, teto); return g <= k && k <= v.length; };
    const tenta = (k: number) => {
      const lista = vaosDe(Lx, k, cabeEm(k));
      const cabe = cabeEm(k)(lista);
      return { lista, k, cabe };
    };
    // Junta de controle não é botão de ajustar comprimento: só se olham do MENOR nº de trechos que serve até o de
    // partida (deixar o "mais perto" livre punha 10 trechos em 20 m com junta a cada 6, porque fechava exato). "Serve" =
    // cabe e fecha a até meio vão cheio do digitado, a garantia do arredondamento de antes — com poucos trechos o filtro
    // sempre acha ALGUMA forma que cabe, só que curta demais (7,50 com junta a cada 2,50 virava 5,45).
    // Busca até um trecho por vão mínimo: com vão curto e junta curta o menor que serve pode ficar bem acima do de
    // partida (vão 1,35 com junta a cada 2,50: um vão por trecho, 16 trechos em 25 m contra 10 de partida).
    const meioVao = largura.peso(vaoCheio) / 2 + EPS;
    const kMax = Math.max(n + 3, Math.ceil(Lx / VAO_MINIMO) + 2);
    const ganha = (a: Opcao, b: Opcao | null): boolean => !b || a.d < b.d - EPS ||
      (Math.abs(a.d - b.d) <= EPS && (a.M > b.M + EPS || (Math.abs(a.M - b.M) <= EPS && a.k === n && b.k !== n)));
    let melhor: Opcao | null = null;        // entre os que servem
    let qualquer: Opcao | null = null;      // entre os que só cabem (reserva)
    const opcoes: Opcao[] = [];
    let kMin = 0;
    for (let k = 1; k <= kMax + folga; k++) {
      if (kMin > 0 && k > Math.max(kMin, n) + folga) break;
      const t = tenta(k);
      if (!t.cabe) continue;
      const M = modularDe(t.lista, k);
      const o: Opcao = { ...t, M, d: Math.abs(M - Lx) };
      if (ganha(o, qualquer)) qualquer = o;
      if (o.d > meioVao) continue;
      if (kMin === 0) kMin = k;
      opcoes.push(o);
      if (k <= Math.max(kMin, n) && ganha(o, melhor)) melhor = o;
      // para a busca do ponto fixo, também o muro só de vãos cheios com k trechos (o da regra de antes): às vezes
      // é o ponto fixo mais perto (4,10 com junta a cada 4 → 4,35, como antes, e não 3,80)
      if (folga > 0) {
        const iguais = vaosDe(Lx, k, (v) => v.every((x) => Math.abs(x - vaoCheio) <= EPS) && cabeEm(k)(v));
        if (iguais.every((x) => Math.abs(x - vaoCheio) <= EPS) && cabeEm(k)(iguais)) {
          const Mi = modularDe(iguais, k);
          if (Math.abs(Mi - Lx) <= meioVao) opcoes.push({ lista: iguais, k, cabe: true, M: Mi, d: Math.abs(Mi - Lx) });
        }
      }
    }
    opcoes.sort((a, b) => (ganha(a, b) ? -1 : ganha(b, a) ? 1 : a.k - b.k));
    return { r: arranjo(melhor ?? qualquer ?? tenta(n)), opcoes };
  };
  const igual = (a: { lista: number[]; contagens: number[] }, b: { lista: number[]; contagens: number[] }): boolean =>
    a.lista.length === b.lista.length && a.contagens.length === b.contagens.length &&
    a.lista.every((v, i) => Math.abs(v - b.lista[i]) <= EPS) && a.contagens.every((c, i) => c === b.contagens[i]);
  // PONTO FIXO: só vale um muro que a regra devolve quando se digita o comprimento dele. Entre as opções que servem
  // (um trecho a mais de folga), a mais perto do digitado que passa nessa prova. Repetir a regra sobre o próprio
  // resultado também dá ponto fixo, mas pode andar para longe (4,10 com junta a cada 4: 3,95 → 3,80, onde 4,35, com
  // dois trechos de vãos iguais — o de antes —, é ponto fixo e fica a 0,25).
  const fixo = (a: Arranjo): boolean => igual(escolha(modularDe(a.lista, a.contagens.length)).r, a);
  const { r: primeira, opcoes } = escolha(L, 1);
  for (const o of opcoes) {
    const a = arranjo(o);
    if (fixo(a)) return a;
  }
  // nenhuma passou (não aconteceu na varredura do teste): repete a regra sobre o resultado até parar
  let r = primeira;
  for (let i = 0; i < 6; i++) {
    const de_novo = escolha(modularDe(r.lista, r.contagens.length)).r;
    if (igual(de_novo, r)) break;
    r = de_novo;
  }
  return r;
}

/** Menor nº de trechos seguidos em que a lista cabe com todo trecho ≤ teto (guloso: enche cada trecho até onde dá). */
function menosTrechos(lista: number[], largura: LarguraDoTrecho, teto: number): number {
  let n = 0;
  let acc = Infinity;
  for (const v of lista) {
    const w = largura.peso(v);
    if (w + largura.fixo > teto) return Infinity;
    if (acc + w + largura.fixo > teto) { n++; acc = w; } else acc += w;
  }
  return Math.max(1, n);
}

/**
 * Reparte a lista de vãos (na ordem) em `n` trechos seguidos, nenhum vazio, com o trecho mais comprido o menor
 * possível e, com esse maior, os trechos o mais iguais possível — com vãos iguais dá o mesmo que dividir() (os
 * primeiros com um vão a mais), a regra de antes, e o muro que já cabia não muda.
 */
function repartirPorComprimento(lista: number[], n: number, largura: LarguraDoTrecho): number[] {
  const N = lista.length;
  const k0 = Math.max(1, Math.min(n, N));
  const P = [0];
  for (const v of lista) P.push(P[P.length - 1] + largura.peso(v));
  const larg = (i: number, j: number): number => P[j] - P[i] + largura.fixo;
  // melhor[k][i]: o menor "trecho mais comprido" repartindo lista[i..N) em k trechos
  const melhor: number[][] = Array.from({ length: k0 + 1 }, () => Array<number>(N + 1).fill(Infinity));
  for (let i = 0; i < N; i++) melhor[1][i] = larg(i, N);
  for (let k = 2; k <= k0; k++) {
    for (let i = 0; i <= N - k; i++) {
      let b = Infinity;
      for (let j = i + 1; j <= N - k + 1; j++) b = Math.min(b, Math.max(larg(i, j), melhor[k - 1][j]));
      melhor[k][i] = b;
    }
  }
  const alvo = melhor[k0][0];
  // Com o maior trecho fixado, os trechos o mais iguais possível (menor soma dos quadrados): 10 vãos iguais em 3
  // trechos ficam 4 + 3 + 3, como dividir(), e não 4 + 4 + 2, que tem o mesmo maior.
  const cabe = (i: number, j: number): boolean => larg(i, j) <= alvo + EPS;
  const quad: number[][] = Array.from({ length: k0 + 1 }, () => Array<number>(N + 1).fill(Infinity));
  for (let i = 0; i < N; i++) if (cabe(i, N)) quad[1][i] = larg(i, N) ** 2;
  for (let k = 2; k <= k0; k++) {
    for (let i = 0; i <= N - k; i++) {
      let b = Infinity;
      for (let j = i + 1; j <= N - k + 1; j++) if (cabe(i, j)) b = Math.min(b, larg(i, j) ** 2 + quad[k - 1][j]);
      quad[k][i] = b;
    }
  }
  // reconstrução da frente para trás; empate (mesma soma): o trecho da frente o mais comprido — com vãos iguais os
  // primeiros ficam com o vão a mais, como antes
  const contagens: number[] = [];
  let i = 0;
  for (let k = k0; k > 1; k--) {
    const meta = quad[k][i];
    let j = N - k + 1;
    while (j > i + 1 && !(cabe(i, j) && Math.abs(larg(i, j) ** 2 + quad[k - 1][j] - meta) <= 1e-3)) j--;
    contagens.push(j - i);
    i = j;
  }
  contagens.push(N - i);
  return contagens;
}

function trechosEmBalanco(p: Parametros, m: number): { trechos: TrechoModulado[]; L_real: number } {
  const nCel = Math.max(2, Math.round((p.L_total + JUNTA) / m));
  const nT = Math.max(1, Math.min(quantosTrechos(nCel * m - JUNTA, p.junta_cada), Math.floor(nCel / 2)));
  const trechos: TrechoModulado[] = [];
  let c = 0;
  dividir(nCel, nT).forEach((n, k) => {
    trechos.push({ indice: k + 1, x0: c * m, x1: (c + n) * m - JUNTA, nos: [] });
    c += n;
  });
  return { trechos, L_real: nCel * m - JUNTA };
}

/**
 * Menor vão que a lista das Entradas oferece (0,80 m; na 14x39 o primeiro que amarra acima dele é 0,95). Abaixo disso
 * o vão também amarra (19: 0,40 e 0,60; 14: 0,55), mas fica fora pela decisão do vão mínimo (vaosDaLista.test.ts) — o
 * vão de fechamento obedece à mesma lista.
 */
export const VAO_MINIMO = 800;

/** Vãos que podem fechar o muro: os da lista (amarram, ≥ VAO_MINIMO) até o vão cheio, que entra sempre. */
export function vaosDeFechamento(familia: NomeFamilia, l_cf: number): number[] {
  const v = vaosDoContraforte(familia, l_cf + 0.5).filter((x) => x >= VAO_MINIMO - 0.5 && x < l_cf - 0.5);
  return [...v, l_cf];
}

/**
 * Os vãos do muro, em ordem (Jose, 16/11: "o último painel aceitar ser menor a distância entre contrafortes pra fechar
 * o muro mais próximo da tolerância real"). Antes o muro só fechava em N vãos iguais (13 m com vão 2,80 virava 11,40
 * ou 14,20). Regra combinada com ele:
 *  - o comprimento digitado manda: soma dos vãos mais perto de `alvo` (empate: o mais comprido, como o arredondamento
 *    de antes);
 *  - vãos cheios (l_cf) e UM vão de fechamento menor, o último, tirado da lista (`validos`) — vão fora da lista
 *    deixaria junta a prumo;
 *  - sobra abaixo do vão mínimo: os DOIS últimos dividem vão cheio + sobra, os dois da lista, o mais iguais possível,
 *    o menor por último;
 *  - nunca vão maior que l_cf: a conta (painel, contraforte) é feita com o vão cheio, que é o pior caso — o vão
 *    menor fica a favor, sem conta nova.
 * Soma que já fecha com vãos iguais dá exatamente os vãos iguais de antes (distância zero e nenhuma outra forma
 * chega à mesma soma).
 */
export function escolherVaos(alvo: number, l: number, validos: number[], nMin: number, aceita?: (vaos: number[]) => boolean): number[] {
  const vmin = validos[0];
  let melhor: { soma: number; vaos: number[]; fech: number } | null = null;
  const considera = (vaos: number[], fech: number): void => {
    if (aceita && !aceita(vaos)) return;
    const soma = vaos.reduce((s, v) => s + v, 0);
    const d = Math.abs(soma - alvo);
    const dm = melhor ? Math.abs(melhor.soma - alvo) : Infinity;
    if (!melhor || d < dm - EPS || (Math.abs(d - dm) <= EPS && (soma > melhor.soma + EPS || (Math.abs(soma - melhor.soma) <= EPS && fech < melhor.fech)))) {
      melhor = { soma, vaos, fech };
    }
  };
  const n0 = Math.max(nMin, Math.floor(alvo / l) - 1);
  const n1 = Math.max(n0, Math.ceil(alvo / l) + 1);
  for (let N = n0; N <= n1; N++) {
    for (const v of validos) {
      const vaos = [...Array<number>(N - 1).fill(l), v];
      considera(vaos, v === l ? 0 : 1);
    }
    if (N < 2) continue;
    // par de fechamento: só quando a sobra (soma − l) não chega ao vão mínimo — senão um vão só resolve
    const porSoma = new Map<number, [number, number]>();
    for (const a of validos) {
      for (const b of validos) {
        if (b > a) continue;
        const r = a + b - l;
        if (r <= EPS || r >= vmin - EPS) continue;
        const ja = porSoma.get(a + b);
        if (!ja || b > ja[1]) porSoma.set(a + b, [a, b]);     // o mais iguais: o menor dos dois é o maior possível
      }
    }
    for (const [a, b] of porSoma.values()) considera([...Array<number>(N - 2).fill(l), a, b], 2);
  }
  if (!melhor && aceita) return escolherVaos(alvo, l, validos, nMin);   // nenhuma forma aceita: a regra sem o filtro
  return melhor ? (melhor as { vaos: number[] }).vaos : Array<number>(Math.max(1, nMin)).fill(l);
}

function trechosComContrafortes(p: Parametros, Wn: number, l_cf: number, validos: number[]): { trechos: TrechoModulado[]; L_real: number } {
  const b = Wn - JUNTA;           // largura do contraforte (t)
  // Comprimento modular com nT trechos: Σvãos + nT·Wn (cada trecho fecha com o nó da ponta; o desenhado é esse menos
  // a junta da ponta). Os vãos saem do digitado (escolherVaos); nT, como no balanço, do DESENHADO — contar os trechos
  // pelo digitado fazia o modular mudar quando o usuário digitava o valor da seta (junta a cada 6 m: 5,90 → 6,20 e, ao
  // digitar 6,20, → 6,40). Partindo do digitado menos a junta e repetindo até o nº de trechos parar, o valor da seta
  // é ponto fixo: digitado de novo, dá o mesmo muro e nenhuma seta.
  const soma = (v: number[]): number => v.reduce((s, x) => s + x, 0);
  let lista: number[];
  let contagens: number[];
  if (p.junta_cada > 0) {
    // Juntas de controle: vãos e trechos escolhidos juntos (arranjarComJuntas) — cada trecho ≤ "a cada X" e o valor
    // da seta é ponto fixo. Largura do trecho = vãos dele + t (o nó da ponta).
    ({ lista, contagens } = arranjarComJuntas(
      p.L_total, p.junta_cada,
      (L, n, aceita) => escolherVaos(L - n * Wn, l_cf, validos, n, aceita),
      (v, n) => soma(v) + n * Wn,
      { peso: (v) => v, fixo: b },
      l_cf,
    ));
  } else {
    // Sem junta de controle: um trecho só, exatamente como antes (cc7e17f).
    lista = escolherVaos(p.L_total - Wn, l_cf, validos, 1);
    contagens = [lista.length];
  }
  const trechos: TrechoModulado[] = [];
  let x = 0;
  let cf = 1;
  let iv = 0;
  contagens.forEach((nv, k) => {
    const x0 = x;
    const nos: No[] = [];
    let xs = x0;
    for (let j = 0; j <= nv; j++) {
      const tipo: No['tipo'] = j === 0 ? 'L0' : j === nv ? 'L1' : 'T';
      nos.push({ tipo, xs, xe: xs + Wn, xc: xs + b / 2, cf: cf++ });
      if (j < nv) xs += lista[iv++];
    }
    const x1 = nos[nos.length - 1].xs + b;
    trechos.push({ indice: k + 1, x0, x1, nos });
    x = x1 + JUNTA;
  });
  return { trechos, L_real: x - JUNTA };
}

/**
 * Muro com contraforte DOBRADO (Jose, 16/11: "desenha um muro e coloca a distância de contrafortes igual à de juntas,
 * voilà, gabarito pronto"): cada vão é um PANO montado como um trecho de um vão só — L0 numa ponta, L1 na outra, os
 * gabaritos de ponta do Revit — e os panos ficam a 1 cm um do outro (a argamassa do dobrado). O L1 de um pano e o L0
 * do seguinte são as duas metades do mesmo contraforte (mesmo nº). Só a junta de controle separa trechos: dentro do
 * trecho a sapata, o dreno e o terreno são contínuos.
 * Comprimento: cada pano soma o vão (xs a xs, `l_pano`) + t + 1 cm (a metade e a junta) — a mesma conta de cada vão
 * do simples com uma largura de nó a mais. Os vãos saem do digitado pela mesma regra (escolherVaos) nessa unidade, e o
 * vão de fechamento continua valendo (o último pano, menor).
 */
function trechosComDobrados(p: Parametros, Wn: number, l_pano: number, validos: number[]): { trechos: TrechoModulado[]; L_real: number } {
  const b = Wn - JUNTA;
  const vaos = (n: number): number[] => escolherVaos(p.L_total, l_pano + Wn, validos.map((v) => v + Wn), n).map((v) => v - Wn);
  const modularDe = (v: number[]): number => v.reduce((s, x) => s + x + Wn, 0);
  let lista: number[];
  let contagens: number[];
  if (p.junta_cada > 0) {
    // Juntas de controle: a mesma regra do simples (arranjarComJuntas); aqui o trecho é a soma dos panos (vão + t +
    // 1 cm cada) menos a junta da ponta, e o nº de trechos não muda o comprimento.
    ({ lista, contagens } = arranjarComJuntas(
      p.L_total, p.junta_cada,
      (L, n, aceita) => escolherVaos(L, l_pano + Wn, validos.map((v) => v + Wn), n, aceita && ((w) => aceita(w.map((v) => v - Wn)))).map((v) => v - Wn),
      (v) => modularDe(v),
      { peso: (v) => v + Wn, fixo: -JUNTA },
      l_pano,
    ));
  } else {
    // Sem junta de controle: um trecho só, exatamente como antes.
    lista = vaos(1);
    contagens = [lista.length];
  }
  const trechos: TrechoModulado[] = [];
  let x = 0;
  let cf = 1;
  let iv = 0;
  contagens.forEach((nv, k) => {
    const x0 = x;
    const nos: No[] = [];
    const panos: TrechoModulado[] = [];
    for (let j = 0; j < nv; j++) {
      const v = lista[iv++];
      const L0: No = { tipo: 'L0', xs: x, xe: x + Wn, xc: x + b / 2, cf: j === 0 ? cf++ : cf - 1 };
      if (j > 0) L0.metade = 'b';
      const L1: No = { tipo: 'L1', xs: x + v, xe: x + v + Wn, xc: x + v + b / 2, cf: cf++ };
      if (j < nv - 1) L1.metade = 'a';
      panos.push({ indice: k + 1, x0: x, x1: x + v + b, nos: [L0, L1] });
      nos.push(L0, L1);
      x += v + Wn;
    }
    // o último L1 do pano de dentro levou um nº que a metade 'b' do pano seguinte repete (cf − 1 acima)
    const x1 = x - JUNTA;
    trechos.push({ indice: k + 1, x0, x1, nos, panos });
    x = x1 + JUNTA;
  });
  return { trechos, L_real: x - JUNTA };
}

/**
 * Eixos a eixo de contraforte (mm) que fecham no módulo E amarram com o encaixe da família, até `ate` — a lista que
 * a tela oferece no lugar do campo livre (brief §5.1: "melhor oferecer como lista de valores válidos").
 */
export function vaosDoContraforte(familia: NomeFamilia, ate = 6000): number[] {
  const cat = CATALOGO[familia];
  const m = meioModulo(cat);
  const Wn = cat.t + JUNTA;
  const out: number[] = [];
  for (let k = minimosDaFamilia(familia).celulasNoVao; Wn + k * m <= ate; k++) if (vaoAmarra(cat, k)) out.push(Wn + k * m);
  return out;
}
