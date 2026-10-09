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
  xc: number;          // eixo do contraforte
  cf: number;          // nº do contraforte ao longo de X (1..)
}

export interface TrechoModulado { indice: number; x0: number; x1: number; nos: No[] }

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
  l_cf: number;          // eixo a eixo (mm)
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
    s_est = paraBaixo(p.s_est, H_FIADA, 's_est', 'Estribos do contraforte', 10, 'cm', 'ESPACAMENTO_ESTRIBO');

    const min = minimosDaFamilia(nomeFam);
    // eixo a eixo = nó + k células; para cima, e só num vão que AMARRA com a receita da tabela (fiadas.ts prova).
    // Ex.: na 14x39 com o 54/34 só k par amarra — 1,50 vai a 1,75, não a 1,55 (que deixa junta a prumo no vão).
    // O vão da planilha (l_cf_adot) manda quando cai na grade E amarra. A planilha só conhece o módulo (t + 1 cm +
    // n·m); a paridade do encaixe (a 14x39, com o 54 e o 34 do Jose, só amarra com n par) é da receita, que mora aqui. Desenhar com um
    // vão que não amarra deixaria junta a prumo — então, nesse caso, a regra abaixo escolhe o vão e o aviso diz que o
    // desenho difere da conta. Com a lista das Entradas (só vãos que amarram) não acontece; fica como garantia.
    const plVao = p.pl.l_cf_adot;
    const kPl = plVao === null ? null : Math.round((plVao - Wn) / m);
    const vaoDaConta = plVao !== null && kPl !== null && Math.abs(Wn + kPl * m - plVao) <= 0.5 && kPl >= min.celulasNoVao && vaoAmarra(cat, kPl);
    if (vaoDaConta) {
      l_cf = plVao as number;
    } else {
      const k0 = Math.max(min.celulasNoVao, Math.ceil((p.l_cf - Wn) / m - EPS));
      let k = k0;
      while (k < k0 + 8 && !vaoAmarra(cat, k)) k++;
      if (!vaoAmarra(cat, k)) {
        k = k0;
        avisos.push({ codigo: 'VAO_NAO_AMARRA', texto: `Vão de ${br((Wn + k * m) / 1000)} m não amarra com o encaixe da família ${nomeFam}` });
      } else if (k !== k0) {
        avisos.push({ codigo: 'VAO_AMARRACAO', texto: `Vão de ${br((Wn + k0 * m) / 1000)} m deixa junta a prumo no encaixe da família ${nomeFam}: ${br((Wn + k * m) / 1000)} m` });
      }
      l_cf = Wn + k * m;
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
    // espessura do contraforte = largura do bloco (brief Q5): eenr ≠ t não tem amarração simples. (O contraforte de
    // duas fileiras que o Jose modelou ficou fora do app — decisão dele, 09/10.)
    ajuste('eenr', p.eenr / 10, cat.t / 10, 'cm');
    if (p.bal_cf > 0) {
      avisos.push({ codigo: 'BALANCO_ALEM_DO_CF', texto: 'Balanço além do contraforte de ponta não desenhado (contraforte rente à ponta)' });
    }
  }

  // ── comprimento e trechos ──
  const { trechos, L_real } = p.contrafortes
    ? trechosComContrafortes(p, Wn, l_cf)
    : trechosEmBalanco(p, m);
  // O comprimento digitado é o MODULAR (Jose: "comprimento fixado em múltiplos dos blocos"): células de bloco + junta
  // contadas com a junta da ponta, como na planta de modulação. O desenhado (L_real, que o quantitativo e os desenhos
  // usam) é 1 cm menor — a junta da ponta não tem bloco do outro lado. Comparar o digitado com o desenhado punha
  // "6,00 → 5,99" em todo muro que já fechava; comparando com o modular, a seta só aparece quando o valor não fecha.
  // A seta mostra o modular, e não o desenhado, para que digitar o valor dela a faça sumir.
  ajuste('L_total', p.L_total / 1000, (L_real + JUNTA) / 1000, 'm');

  return { cat, familia, furo, m, Wn, n_fiadas, H_des, s_vert, s_pv, s_can, l_cf, tenr, n_haste, s_est, trechos, L_real, ajustes };
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

function trechosComContrafortes(p: Parametros, Wn: number, l_cf: number): { trechos: TrechoModulado[]; L_real: number } {
  const b = Wn - JUNTA;           // largura do contraforte (t)
  // Comprimento modular com nT trechos e N vãos: N·l_cf + nT·Wn (cada trecho fecha com o nó da ponta; o desenhado é
  // esse menos a junta da ponta). N sai do digitado; nT, como no balanço, do DESENHADO — contar os trechos pelo
  // digitado fazia o modular mudar quando o usuário digitava o valor da seta (junta a cada 6 m: 5,90 → 6,20 e, ao
  // digitar 6,20, → 6,40). Partindo do digitado menos a junta e repetindo até o nº de trechos parar, o valor da seta
  // é ponto fixo: digitado de novo, dá o mesmo muro e nenhuma seta.
  const vaos = (n: number): number => Math.max(n, Math.round((p.L_total - n * Wn) / l_cf));
  let nT = quantosTrechos(p.L_total - JUNTA, p.junta_cada);
  for (let i = 0; i < 4; i++) {
    const outro = quantosTrechos(vaos(nT) * l_cf + nT * Wn - JUNTA, p.junta_cada);
    if (outro === nT) break;
    nT = outro;
  }
  const N = vaos(nT);
  const trechos: TrechoModulado[] = [];
  let x = 0;
  let cf = 1;
  dividir(N, nT).forEach((nv, k) => {
    const x0 = x;
    const x1 = x0 + nv * l_cf + b;
    const nos: No[] = [];
    for (let j = 0; j <= nv; j++) {
      const xs = x0 + j * l_cf;
      const tipo: No['tipo'] = j === 0 ? 'L0' : j === nv ? 'L1' : 'T';
      nos.push({ tipo, xs, xe: xs + Wn, xc: xs + b / 2, cf: cf++ });
    }
    trechos.push({ indice: k + 1, x0, x1, nos });
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
