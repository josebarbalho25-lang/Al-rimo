/*
  FIADAS — a arrumação das peças, conta pura (sem three, sem DOM), no estilo do fileira-de-blocos do A-PORT.

  Cada fiada de um trecho tem duas espécies de linha:
    linha do muro (ao longo de X): peças fixas dos encaixes + corridas livres;
    haste de cada contraforte (ao longo de η, a distância à face do muro oposta à haste): passante + o resto.
  As peças fixas vêm da tabela (encaixes.ts).

  SEQUÊNCIA DAS FIADAS (gabaritos do Jose, 10 fiadas: A B A B C A B A B C): as fiadas de bloco alternam, e a de
  canaleta entra no meio sem quebrar a alternância — depois de "B, canaleta" vem A. Em cada fiada de bloco cada
  contraforte é P (o muro passa, a haste encosta) ou I (o contraforte atravessa o muro):
    14x39 — todos os contrafortes do mesmo jeito na fiada (o 54 e o 34 obrigam; gabarito: fiada 1 toda P);
    19x39 — alternam de um contraforte para o outro quando o eixo a eixo tem nº ÍMPAR de meios módulos
      (gabarito 19x39, 180 cm = 9: "onde a ponta é I, o T é P"); é a paridade do bloco corrido. Fiada 1: a ponta é I.
  A ponta de referência (S) é a da ESQUERDA de quem olha do lado dos contrafortes — onde o Jose começou.

  LINHA DO MURO: cada corrida é resolvida por busca exata (programação dinâmica sobre as posições possíveis de
  junta), com custo = juntas que coincidem com a fiada de baixo e com a de cima, mais um custo pequeno por meio
  bloco e maior por peça cortada. A amarração é uma regra entre fiadas e a fiada de cima tem peças fixas (o 54, a
  passante) que não podem fugir — por isso a busca olha as duas vizinhas, partindo de arrumações diferentes e
  refazendo até ninguém melhorar. Determinístico. Na 19x39 o T não tem peça fixa: no gabarito do Jose o meio bloco
  em cima do contraforte (fiada P) e os meios dos dois lados (fiada I) são a ÚNICA arrumação sem junta a prumo, e a
  busca chega nela sozinha; num muro com dois T seguidos a regra "meio no T" não amarra, e a busca acha outra.

  FIADA DE CANALETA DO MURO COM CONTRAFORTES (gabarito 14x39): canaletas corridas deslocadas 1/4 de bloco das fiadas
  vizinhas, para nenhuma junta alinhar. Por que precisa: com a sequência do Jose a canaleta fica entre uma A e uma
  B, e as juntas das duas, juntas, ocupam todas as posições da grade de meio bloco. Começa na ponta S com a canaleta
  cortada que põe a 1ª junta a m/2 da face do contraforte (14x39: cortada em 24), segue com inteiras e fecha na outra
  ponta com o corte que sobrar (14x39: 19). Na 14x39 a grade anda 5 cm a cada contraforte, e no 3º vão a inteira
  cairia em cima de uma junta — aí a busca põe mais um corte (DEDUÇÃO: os gabaritos têm dois vãos).
  ATENÇÃO 19x39: no gabarito do Jose a canaleta da 19 ficou NA grade, com todas as juntas em cima das da fiada de
  baixo (fiadas 4/5 e 9/10). Aqui ela segue a regra da 14x39 (o "desencontro" que ele mesmo descreveu) — a confirmar
  com ele.

  HASTE: regra fixa, a dos gabaritos (as duas famílias): blocos inteiros a partir do muro (ou da passante) e o meio na
  ponta; na fiada de canaleta, canaletas inteiras a partir da ponta e a cortada junto ao muro (14x39 com UMA célula:
  a canaleta cortada em 20 encostada no muro, sem junta). Assim P e I nunca repetem junta na haste. A canaleta da
  haste pode repetir junta com a vizinha — o Jose aceitou no contraforte de 79.

  O mesmo motor decide se um VÃO amarra (`vaoAmarra`): monta um muro de prova com a receita da tabela e conta as
  juntas a prumo. A regra modular usa isso para escolher o eixo a eixo dos contrafortes.
*/
import { H_FIADA, JUNTA, chaveDoCorte, meioModulo, pecaDoCatalogo, type FamiliaDoCatalogo } from './catalogo';
import { ENCAIXES, espelhar, type ReceitaDaFiada, type TipoFiada } from './encaixes';
import type { No, TrechoModulado } from './modular';

/** O que a arrumação precisa saber do módulo (a regra modular entrega isto). */
export interface BaseDaArrumacao { cat: FamiliaDoCatalogo; m: number; n_haste: number; tenr: number; aparente?: boolean }

export interface ItemLinha { chave: string; x: number; comp: number; no?: No; espelhado?: boolean }
/** Peça da haste: de η a η + comp (ao longo de Y). */
export interface ItemHaste { chave: string; eta: number; comp: number; passante: boolean }

export interface FiadaMontada {
  i: number;
  /** Tipo do contraforte da ponta S nesta fiada ('C' = canaleta); os outros saem de `tiposDosNos`. */
  tipo: TipoFiada;
  tiposDosNos: TipoFiada[];           // P / I / C de cada nó do trecho (mesma ordem de trecho.nos)
  linha: ItemLinha[];                 // ordenada por x (sem a passante, que mora na haste)
  hastes: ItemHaste[][];              // uma por nó do trecho (mesma ordem de trecho.nos)
  juntasLinha: number[];              // x do início de cada junta vertical interna da linha do muro (inclui a passante)
  juntasHaste: number[][];            // η do início de cada junta da haste (inclui o fim da passante)
}

/** Fiadas de canaleta: o TOPO da canaleta cai em k·s (Fig. 5); a cinta (se pedida) é a última fiada. */
export function fiadasDeCanaleta(n: number, s_can: number, cinta: boolean): boolean[] {
  const c = Array.from({ length: n }, (_, i) => s_can > 0 && ((i + 1) * H_FIADA) % s_can === 0);
  if (cinta && n > 0) c[n - 1] = true;
  return c;
}

const outro = (t: TipoFiada): TipoFiada => (t === 'P' ? 'I' : t === 'I' ? 'P' : 'C');

/**
 * Tipo de cada fiada (o do contraforte da ponta S): as de bloco alternam a partir de `primeira`, e a de canaleta
 * entra no meio sem quebrar a alternância (gabaritos do Jose).
 */
export function tiposDasFiadas(canaleta: boolean[], primeira: TipoFiada = 'P'): TipoFiada[] {
  let k = 0;
  return canaleta.map((c) => (c ? 'C' : k++ % 2 === 0 ? primeira : outro(primeira)));
}

// ── a linha abstrata: o que a busca enxerga ───────────────────────────────────

/** `livre`: canaleta cortada na obra (comprimento livre) — custa pouco na ponta livre da corrida, mais no meio. */
interface Opcao { chave: string; comp: number; passo: number; classe: 'cheia' | 'meia' | 'corte'; livre?: boolean }

/**
 * Corrida livre: a primeira peça começa em `a`; a última termina em `b − 10` (b = onde começa o que vem depois).
 * `faces`: juntas nas faces dos contrafortes, com o peso da repetição ali (a passante da fiada I sempre deixa junta
 * nas duas faces; se alguma fiada tiver de repetir uma junta, que seja na face do contraforte e não no meio do vão).
 * `quinas`: a corrida começa / termina encostada num contraforte de ponta (ou na ponta do trecho).
 * `soltas`: início da faixa de cada nó que a corrida atravessa → custo de pôr ali uma peça que cobre SÓ o nó.
 * `pontaLivre`: ponta onde a canaleta cortada é a regra (a que fecha "o que sobrar").
 */
interface Corrida {
  a: number; b: number; opcoes: Opcao[]; centros: number[];
  faces: ReadonlyMap<number, number>;
  quinas: [boolean, boolean];
  soltas: ReadonlyMap<number, number>;
  larguraDoNo: number;
  pontaLivre?: 'inicio' | 'fim';
}

/** Uma linha a preencher numa fiada. */
interface Linha1D { corridas: Corrida[]; fixas: number[]; fim: number }

/** A escolha: para cada corrida, a sequência de índices de `opcoes`. */
type Escolha = number[][];

const VAZIO: ReadonlySet<number> = new Set<number>();
const mdc = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mdc(b, a % b));

/**
 * Custos (adimensionais). Junta a prumo no vão = 3: nada compensa. Na face do contraforte = 0,5. O resto desempata.
 */
const PESO_JUNTA = 3;
const CUSTO_MEIA = 0.01;
const CUSTO_MEIA_NO_MEIO = 0.002;     // meio bloco fora da ponta da corrida (a regra da obra é meio na ponta)
const CUSTO_CORTE = 0.05;
const CUSTO_CORTE_LONGE = 1e-5;       // por mm entre a peça cortada e o contraforte mais perto
const PESO_FACE = 0.5;                // junta repetida na face de um contraforte
// Peça que cobre só o nó. No T, nada: é a regra do Jose na 19x39 (meio bloco no muro alinhado ao contraforte).
// Na ponta, o Jose corre o bloco do muro até o fim — meio solto na quina só quando o vão não deixa outra.
const SOLTA_T = 0;
const SOLTA_L = 0.3;
const SOLTA_CANALETA = 0.1;
const VIES = 0.004;                   // só na partida: empurra o meio bloco para um lado (ver arrumarPilha)
// Canaleta cortada fora da ponta livre: corte a mais para tirar a junta de cima da vizinha. Mais caro que o corte
// da ponta (que é a regra do Jose) e mais barato que junta repetida.
const CUSTO_REFASE = 0.3;
/** Passo dos comprimentos de corte da canaleta que a busca experimenta (mm). */
const PASSO_CORTE = 25;
/** Menor canaleta cortada (mm): menos que isso não para em pé na obra — DEDUÇÃO. */
const CORTE_MIN = 90;

/**
 * Viés de partida (só na 1ª passada): de que lado da corrida o meio bloco prefere ficar. A busca por fiada é exata,
 * mas a pilha inteira não — uma fiada só enxerga as vizinhas. Partir de arrumações diferentes e ficar com a de menor
 * custo total tira a busca dos mínimos locais.
 * 'pares': parte do par A–B resolvido junto (todas as A do trecho são a mesma fiada, e todas as B também) e só
 * depois encaixa as canaletas. Com peça fixa nas duas é a partida que não se prende.
 */
type Vies = 'nenhum' | 'inicio' | 'fim' | 'longeDaQuina' | 'pares';
const VIESES: Vies[] = ['pares', 'longeDaQuina', 'nenhum', 'inicio', 'fim'];

function pesoDaJunta(c: Corrida, xj: number, abaixo: ReadonlySet<number>, acima: ReadonlySet<number>): number {
  const n = (abaixo.has(xj) ? 1 : 0) + (acima.has(xj) ? 1 : 0);
  if (!n) return 0;
  return n * (c.faces.get(xj) ?? PESO_JUNTA);
}

function opcao(cat: FamiliaDoCatalogo, chave: string, m: number): Opcao {
  const comp = pecaDoCatalogo(cat, chave).comprimento;
  const passo = comp + JUNTA;
  return { chave, comp, passo, classe: passo === 2 * m ? 'cheia' : passo === m ? 'meia' : 'corte' };
}

/** Canaletas cortadas que a busca pode usar numa corrida de canaleta do muro com contrafortes. */
function opcoesDeCorte(m: number): Opcao[] {
  const out: Opcao[] = [];
  for (let passo = CORTE_MIN + JUNTA; passo < 2 * m; passo += PASSO_CORTE) {
    out.push({ chave: chaveDoCorte(passo - JUNTA), comp: passo - JUNTA, passo, classe: 'corte', livre: true });
  }
  return out;
}

function custoDaPeca(c: Corrida, o: Opcao, noInicio: boolean, noFim: boolean, x0: number, vies: Vies): number {
  const solta = o.comp === c.larguraDoNo ? c.soltas.get(x0) ?? 0 : 0;
  if (o.livre) {
    const naPonta = (c.pontaLivre === 'inicio' && noInicio) || (c.pontaLivre === 'fim' && noFim);
    return (naPonta ? CUSTO_CORTE : CUSTO_REFASE) + solta;
  }
  if (o.classe === 'cheia') return solta;
  if (o.classe === 'meia') {
    let v = CUSTO_MEIA + (noInicio || noFim ? 0 : CUSTO_MEIA_NO_MEIO);
    if (vies === 'inicio' && !noInicio) v += VIES;
    else if (vies === 'fim' && !noFim) v += VIES;
    else if (vies === 'longeDaQuina' && ((noInicio && c.quinas[0]) || (noFim && c.quinas[1]))) v += VIES;
    return v + solta;
  }
  let d = 0;
  if (c.centros.length) {
    const xc = x0 + o.comp / 2;
    d = Math.min(...c.centros.map((k) => Math.abs(k - xc)));
  }
  return CUSTO_CORTE + CUSTO_CORTE_LONGE * d + solta;
}

/** Busca exata numa corrida: menor custo (juntas coincidentes + peças) do começo ao fim. */
function melhorDaCorrida(c: Corrida, abaixo: ReadonlySet<number>, acima: ReadonlySet<number>, vies: Vies): { seq: number[]; custo: number } {
  const L = c.b - c.a;
  if (L <= 0) return { seq: [], custo: 0 };
  let g = L;
  for (const o of c.opcoes) g = mdc(g, o.passo);
  const N = Math.round(L / g);
  const best = new Float64Array(N + 1).fill(Infinity);
  const de = new Int32Array(N + 1).fill(-1);
  best[0] = 0;
  for (let p = 1; p <= N; p++) {
    const xj = c.a + p * g - JUNTA;
    const jc = p < N ? pesoDaJunta(c, xj, abaixo, acima) : 0;
    for (let k = 0; k < c.opcoes.length; k++) {
      const o = c.opcoes[k];
      const s = o.passo / g;
      if (s > p || !Number.isInteger(s)) continue;
      const ant = best[p - s];
      if (ant === Infinity) continue;
      const v = ant + jc + custoDaPeca(c, o, p - s === 0, p === N, c.a + (p - s) * g, vies);
      if (v < best[p] - 1e-12) {
        best[p] = v;
        de[p] = k;
      }
    }
  }
  if (best[N] === Infinity) throw new Error(`corrida de ${L} mm não fecha com as peças ${c.opcoes.map((o) => o.chave).join(', ')}`);
  const seq: number[] = [];
  for (let p = N; p > 0; ) {
    const k = de[p];
    seq.push(k);
    p -= c.opcoes[k].passo / g;
  }
  seq.reverse();
  return { seq, custo: best[N] };
}

function custoDaCorrida(c: Corrida, seq: number[], abaixo: ReadonlySet<number>, acima: ReadonlySet<number>): number {
  let x = c.a;
  let v = 0;
  seq.forEach((k, j) => {
    const o = c.opcoes[k];
    v += custoDaPeca(c, o, j === 0, j === seq.length - 1, x, 'nenhum');
    x += o.passo;
    if (j < seq.length - 1) v += pesoDaJunta(c, x - JUNTA, abaixo, acima);
  });
  return v;
}

function juntasDe(l: Linha1D, e: Escolha): Set<number> {
  const s = new Set<number>(l.fixas);
  l.corridas.forEach((c, k) => {
    let x = c.a;
    for (const i of e[k]) {
      x += c.opcoes[i].passo;
      if (x - JUNTA < l.fim - 0.5) s.add(x - JUNTA);
    }
  });
  return s;
}

/**
 * Uma pilha de linhas do muro. Para cada partida: de baixo para cima olhando as juntas fixas de cima (ou o par A–B
 * primeiro), depois voltas de refazer cada fiada com as duas vizinhas até ninguém melhorar (cada troca só entra se
 * baixa o custo — então termina). Fica a partida de menor custo total (empate: a primeira da lista, para o
 * resultado não depender de nada além da entrada).
 */
function arrumarPilha(pilha: Linha1D[], tipos: TipoFiada[]): Escolha[] {
  const n = pilha.length;
  const fixas = pilha.map((l) => new Set<number>(l.fixas));
  const temEscolha = pilha.some((l) => l.corridas.length);
  let melhorTotal = Infinity;
  let melhorEsc: Escolha[] = pilha.map((l) => l.corridas.map(() => []));
  const iA = tipos.findIndex((t) => t !== 'C');
  const iB = iA < 0 ? -1 : tipos.findIndex((t) => t !== 'C' && t !== tipos[iA]);
  const vieses: Vies[] = temEscolha ? VIESES.filter((v) => v !== 'pares' || (iA >= 0 && iB >= 0)) : ['nenhum'];
  for (const vies of vieses) {
    const esc: Escolha[] = new Array(n);
    const juntas: Set<number>[] = new Array(n);
    const melhor = (i: number, abaixo: ReadonlySet<number>, acima: ReadonlySet<number>, v: Vies): { e: Escolha; custo: number } => {
      let custo = 0;
      const e = pilha[i].corridas.map((c) => {
        const r = melhorDaCorrida(c, abaixo, acima, v === 'pares' ? 'nenhum' : v);
        custo += r.custo;
        return r.seq;
      });
      return { e, custo };
    };
    if (vies === 'pares') {
      // a B sozinha (vendo só o que é fixo na A), depois as duas se acertando
      let eB = melhor(iB, VAZIO, fixas[iA], 'nenhum').e;
      let jB = juntasDe(pilha[iB], eB);
      let eA = melhor(iA, jB, jB, 'nenhum').e;
      let jA = juntasDe(pilha[iA], eA);
      for (let k = 0; k < 4; k++) {
        eB = melhor(iB, jA, jA, 'nenhum').e;
        jB = juntasDe(pilha[iB], eB);
        eA = melhor(iA, jB, jB, 'nenhum').e;
        jA = juntasDe(pilha[iA], eA);
      }
      for (let i = 0; i < n; i++) {
        if (tipos[i] === tipos[iA]) [esc[i], juntas[i]] = [eA, jA];
        else if (tipos[i] === tipos[iB]) [esc[i], juntas[i]] = [eB, jB];
      }
    }
    for (let i = 0; i < n; i++) {
      if (esc[i]) continue;
      const acima = i + 1 >= n ? VAZIO : juntas[i + 1] ?? fixas[i + 1];
      esc[i] = melhor(i, i > 0 ? juntas[i - 1] : VAZIO, acima, vies).e;
      juntas[i] = juntasDe(pilha[i], esc[i]);
    }
    for (let volta = 0; volta < 8; volta++) {
      let mudou = false;
      for (let i = 0; i < n; i++) {
        const abaixo = i > 0 ? juntas[i - 1] : VAZIO;
        const acima = i + 1 < n ? juntas[i + 1] : VAZIO;
        const atual = pilha[i].corridas.reduce((s, c, k) => s + custoDaCorrida(c, esc[i][k], abaixo, acima), 0);
        const novo = melhor(i, abaixo, acima, 'nenhum');
        if (novo.custo < atual - 1e-9) {
          esc[i] = novo.e;
          juntas[i] = juntasDe(pilha[i], esc[i]);
          mudou = true;
        }
      }
      if (!mudou) break;
    }
    // custo total: cada par de fiadas vizinhas contado uma vez (só a de baixo) + as peças
    let total = 0;
    for (let i = 0; i < n; i++) {
      const abaixo = i > 0 ? juntas[i - 1] : VAZIO;
      total += pilha[i].corridas.reduce((s, c, k) => s + custoDaCorrida(c, esc[i][k], abaixo, VAZIO), 0);
    }
    if (total < melhorTotal - 1e-9) {
      melhorTotal = total;
      melhorEsc = esc;
    }
  }
  return melhorEsc;
}

// ── o tipo de cada contraforte em cada fiada ─────────────────────────────────

/**
 * P ou I de cada nó numa fiada de tipo `tf` (o tipo do nó da ponta S). Na família em que o nó é uma célula da grade
 * (t + 10 = m) o tipo segue a paridade do bloco corrido: nó a um nº ímpar de células de S tem o tipo trocado.
 */
export function tiposDosNos(trecho: TrechoModulado, cat: FamiliaDoCatalogo, tf: TipoFiada, aparente: boolean): TipoFiada[] {
  if (tf === 'C' || !trecho.nos.length) return trecho.nos.map(() => tf);
  const m = meioModulo(cat);
  if (cat.t + JUNTA !== m) return trecho.nos.map(() => tf);
  const s = aparente ? trecho.nos[0] : trecho.nos[trecho.nos.length - 1];
  return trecho.nos.map((n) => (Math.round(Math.abs(n.xc - s.xc) / m) % 2 === 0 ? tf : outro(tf)));
}

function receitaDo(cat: FamiliaDoCatalogo, no: No, tf: TipoFiada, aparente: boolean): ReceitaDaFiada & { espelhada?: boolean } {
  const e = ENCAIXES[cat.nome];
  // contraforte aparente: o muro do Jose visto do outro lado — o T vira o espelho (as pontas já são espelho uma da outra)
  if (no.tipo === 'T') return aparente ? espelhar(e.T[tf]) : e.T[tf];
  return no.tipo === 'L0' ? e.L[tf] : espelhar(e.L[tf]);
}

// ── a haste: regra fixa, a dos gabaritos ─────────────────────────────────────

/**
 * Peças da haste de um nó numa fiada, de η = 0 (face do muro oposta à haste) até tenr. `daPonta`: na canaleta, as
 * inteiras começam pela ponta e a cortada fica junto ao muro (gabarito 19x39); com duas fiadas de canaleta seguidas,
 * a de cima inverte, para as juntas não se repetirem.
 */
export function montarHaste(cat: FamiliaDoCatalogo, base: BaseDaArrumacao, r: ReceitaDaFiada, daPonta: boolean): ItemHaste[] {
  const { m, tenr } = base;
  const t = cat.t;
  const itens: ItemHaste[] = [];
  let eta = t + JUNTA;
  if (r.passante) {
    const comp = pecaDoCatalogo(cat, r.passante.peca).comprimento;
    itens.push({ chave: r.passante.peca, eta: 0, comp, passante: true });
    eta = comp + JUNTA;
  }
  const n = Math.round((tenr + JUNTA - eta) / m);
  if (n <= 0) return itens;
  const forma = r.haste?.forma ?? 'bloco';
  const poe = (chave: string, e: number): void => {
    itens.push({ chave, eta: e, comp: pecaDoCatalogo(cat, chave).comprimento, passante: false });
  };
  if (forma === 'canaleta' && r.haste?.umaCelulaEncostada && n === 1 && !r.passante) {
    // gabarito 14x39 (contraforte de 34): a canaleta cortada em 20 encosta no muro, sem junta
    poe(chaveDoCorte(tenr - t), t);
  } else if (forma === 'bloco') {
    // inteiros a partir do muro (ou da passante), o meio na ponta
    let k = 0;
    for (; k + 2 <= n; k += 2) poe('inteiro', eta + k * m);
    if (k < n) poe('meio', eta + k * m);
  } else {
    // canaletas inteiras a partir da ponta; a cortada (meia célula a menos) junto ao muro
    const corte = chaveDoCorte(m - JUNTA);
    let k = 0;
    if (n % 2 === 1 && daPonta) poe(corte, eta + k++ * m);
    for (; k + 2 <= n; k += 2) poe('canaleta', eta + k * m);
    if (k < n) poe(corte, eta + k * m);
  }
  return itens;
}

// ── o esqueleto de cada fiada: o que é fixo e onde ficam as corridas ─────────

interface Esqueleto {
  fixos: ItemLinha[];
  linha: Linha1D;
  tiposDosNos: TipoFiada[];
}

/** Comprimento da 1ª canaleta da fiada de canaleta (cortada): junta a m/2 da face do contraforte de ponta. */
export const primeiraCanaleta = (cat: FamiliaDoCatalogo): number => cat.t + meioModulo(cat) / 2;

function esqueleto(trecho: TrechoModulado, base: BaseDaArrumacao, tf: TipoFiada, sNaDireita: boolean): Esqueleto {
  const { cat, m } = base;
  const t = cat.t;
  const enc = ENCAIXES[cat.nome];
  const forma = tf === 'C' ? 'canaleta' : 'bloco';
  const aparente = !!base.aparente;
  // Canaleta do muro com contrafortes: inteira + cortadas (o Jose corta a 39); no balanço, inteira e meia.
  const canaletaDeslocada = forma === 'canaleta' && trecho.nos.length > 0;
  const opcoes = canaletaDeslocada
    ? [opcao(cat, 'canaleta', m), ...opcoesDeCorte(m)]
    : enc.livres[forma].map((ch) => opcao(cat, ch, m));
  const centros = trecho.nos.map((n) => n.xc);
  const faces = new Map<number, number>();
  const soltas = new Map<number, number>();
  for (const n of trecho.nos) {
    faces.set(n.xs - JUNTA, PESO_FACE);
    faces.set(n.xs + t, PESO_FACE);
    soltas.set(n.xs, forma === 'canaleta' ? SOLTA_CANALETA : n.tipo === 'T' ? SOLTA_T : SOLTA_L);
  }
  // a corrida que começa no começo do trecho (ou termina no fim) encosta na quina: contraforte de ponta ou ponta livre
  const quinaEm = (x: number): boolean => Math.abs(x - trecho.x0) < 0.5 || Math.abs(x - (trecho.x1 + JUNTA)) < 0.5
    || trecho.nos.some((n) => n.tipo !== 'T' && x >= n.xs - 0.5 - 2 * m && x <= n.xe + 2 * m + 0.5);

  const fixos: ItemLinha[] = [];
  const ocupados: { a: number; b: number; fins: number[] }[] = [];
  const tipos = tiposDosNos(trecho, cat, tf, aparente);

  // a canaleta cortada da ponta S, fixa (a do fim sai da busca: é "o que sobrar")
  if (canaletaDeslocada) {
    const comp = primeiraCanaleta(cat);
    const x = sNaDireita ? trecho.x1 - comp : trecho.x0;
    fixos.push({ chave: chaveDoCorte(comp), x, comp });
    ocupados.push({ a: x, b: x + comp + JUNTA, fins: sNaDireita ? [] : [x + comp] });
  }

  trecho.nos.forEach((no, k) => {
    const r = receitaDo(cat, no, tipos[k], aparente);
    if (r.passante) {
      ocupados.push({ a: no.xs, b: no.xe, fins: [no.xs + t] });
    } else if (r.parede && r.parede !== 'continua') {
      let x = no.xs - r.parede.antes * m;
      const a = x;
      const fins: number[] = [];
      for (const ch of r.parede.pecas) {
        const comp = pecaDoCatalogo(cat, ch).comprimento;
        const it: ItemLinha = { chave: ch, x, comp, no };
        if (r.espelhada) it.espelhado = true;
        fixos.push(it);
        x += comp + JUNTA;
        fins.push(x - JUNTA);
      }
      ocupados.push({ a, b: x, fins });
    }
  });

  ocupados.sort((u, v) => u.a - v.a);
  const corridas: Corrida[] = [];
  const fixas = new Set<number>();
  // a canaleta cortada "do que sobrar" fica na ponta oposta a S
  const pontaLivre: Corrida['pontaLivre'] = canaletaDeslocada ? (sNaDireita ? 'inicio' : 'fim') : undefined;
  let x = trecho.x0;
  for (const o of ocupados) {
    if (o.a < x - 1e-6) throw new Error(`encaixes se sobrepõem na linha do muro (trecho ${trecho.indice})`);
    if (o.a > x + 1e-6) corridas.push({ a: x, b: o.a, opcoes, centros, faces, quinas: [quinaEm(x), quinaEm(o.a)], soltas, larguraDoNo: t, pontaLivre });
    if (o.a > trecho.x0 + 0.5) fixas.add(o.a - JUNTA);
    for (const f of o.fins) if (f < trecho.x1 - 0.5) fixas.add(f);
    x = o.b;
  }
  if (trecho.x1 + JUNTA > x + 1e-6) corridas.push({ a: x, b: trecho.x1 + JUNTA, opcoes, centros, faces, quinas: [quinaEm(x), true], soltas, larguraDoNo: t, pontaLivre });
  return { fixos, linha: { corridas, fixas: [...fixas].sort((a, b) => a - b), fim: trecho.x1 }, tiposDosNos: tipos };
}

// ── montagem ─────────────────────────────────────────────────────────────────

/**
 * Ponta S de cada fiada de canaleta: a da esquerda de quem olha do lado dos contrafortes (enterrado: X máximo;
 * aparente: X mínimo). Canaleta logo acima de outra canaleta começa na outra ponta.
 */
function pontasS(tipos: TipoFiada[], aparente: boolean): boolean[] {
  const out: boolean[] = [];
  tipos.forEach((tf, i) => {
    out.push(tf === 'C' && i > 0 && tipos[i - 1] === 'C' ? !out[i - 1] : !aparente);
  });
  return out;
}

export function montarFiadas(trecho: TrechoModulado, base: BaseDaArrumacao, tipos: TipoFiada[]): FiadaMontada[] {
  const aparente = !!base.aparente;
  const sDir = pontasS(tipos, aparente);
  const esqs = tipos.map((tf, i) => esqueleto(trecho, base, tf, sDir[i]));
  const escLinha = arrumarPilha(esqs.map((e) => e.linha), tipos);

  return esqs.map((e, i) => {
    const linha: ItemLinha[] = [...e.fixos];
    e.linha.corridas.forEach((c, k) => {
      let x = c.a;
      for (const j of escLinha[i][k]) {
        const o = c.opcoes[j];
        linha.push({ chave: o.chave, x, comp: o.comp });
        x += o.passo;
      }
    });
    linha.sort((u, v) => u.x - v.x);

    const daPonta = sDir[i] === !aparente;
    const hastes = trecho.nos.map((no, k) => montarHaste(base.cat, base, receitaDo(base.cat, no, e.tiposDosNos[k], aparente), daPonta));
    const juntasHaste = hastes.map((h) => h.map((p) => p.eta + p.comp).filter((eta) => eta < base.tenr - 0.5).sort((a, b) => a - b));
    const juntasLinha = [...juntasDe(e.linha, escLinha[i])].sort((a, b) => a - b);
    return { i, tipo: tipos[i], tiposDosNos: e.tiposDosNos, linha, hastes, juntasLinha, juntasHaste };
  });
}

// ── o vão que amarra ─────────────────────────────────────────────────────────

const cacheDoVao = new Map<string, boolean>();

/**
 * O vão com `k` células livres entre dois contrafortes amarra (nenhuma junta a prumo fora das faces do
 * contraforte) com a receita da tabela? Prova: muro L–T–T–L de 6 fiadas alternando. A chave do cache leva a
 * própria receita — trocar a linha da tabela (modelo do Revit) refaz a prova.
 */
export function vaoAmarra(cat: FamiliaDoCatalogo, k: number): boolean {
  const enc = ENCAIXES[cat.nome];
  const chave = `${cat.nome}|${k}|${JSON.stringify(enc)}`;
  const ja = cacheDoVao.get(chave);
  if (ja !== undefined) return ja;
  const m = meioModulo(cat);
  const t = cat.t;
  const Wn = t + JUNTA;
  const l = Wn + k * m;
  const nos: No[] = [0, 1, 2, 3].map((j) => ({ tipo: j === 0 ? 'L0' : j === 3 ? 'L1' : 'T', xs: j * l, xe: j * l + Wn, xc: j * l + t / 2, cf: j + 1 }));
  const trecho: TrechoModulado = { indice: 1, x0: 0, x1: 3 * l + t, nos };
  let ok = true;
  try {
    const p = enc.primeira;
    const f = montarFiadas(trecho, { cat, m, n_haste: 2, tenr: t + 2 * m }, [p, outro(p), p, outro(p), p, outro(p)]);
    const faces = new Set<number>(nos.flatMap((n) => [n.xs - JUNTA, n.xs + t]));
    for (let i = 0; i + 1 < f.length && ok; i++) {
      const cima = new Set(f[i + 1].juntasLinha);
      if (f[i].juntasLinha.some((x) => cima.has(x) && !faces.has(x))) ok = false;
    }
  } catch {
    ok = false;
  }
  cacheDoVao.set(chave, ok);
  return ok;
}
