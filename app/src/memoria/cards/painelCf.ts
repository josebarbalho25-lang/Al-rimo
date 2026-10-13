/*
  CARDS — Painel entre contrafortes (aba "Contrafortes", seções 8 a 12 e as verificações do painel na 15; aula 12.3).

  Cinco cards: momentos de Libânio, flexão vertical (barras nos furos), flexão horizontal (barras nas canaletas),
  alvenaria não armada entre barras e canaletas (Anexo E, caso 13) e ELS nas duas direções (seção I + flecha).

  Interpolação em tabela (μ e α de Libânio, βf do caso 13): os dois valores da tabela entram na linha como
  CONSTANTES lidas da planilha exportada (aba Referências), com o fator de interpolação publicado antes — a mesma
  saída do grupo do balanço. Folha nomeada não serve: a célula que é a "linha de baixo" num cenário é a "de cima" em
  outro, e a régua única não deixa a mesma célula ter dois símbolos.

  O mesmo para σh no topo do painel não armado: com perfil de empuxo linear a linha é a reta σh,topo → σh,base;
  com perfil quebrado (água no meio, coesão cortando o topo), a interpolação das 40 fatias com os dois valores.

  O que NÃO virou expressão, e por quê:
  - As ≤ As,máx do furo (nb·a·f_trasp ≤ ρmáx·Ag) e as dimensões-limite do subpainel (ℓ, h ≤ 50t; h·ℓ ≤ 2025t²):
    os dois lados são conta sem célula na planilha — ficam fora da memória até a planilha ganhar essas células.

  Cada `if` ESPELHA um IF da planilha (posição das barras, laterais, fpk líquido, critério de As,mín, espaçamento
  digitado, estádio, ramo da linha neutra). Onde a planilha usa MAX/MIN sobre células, o Excel ignora célula com
  texto ("—") ou vazia: a expressão leva só as folhas que têm número.

  Grafia: as grandezas que já existem no balanço (painel não armado, ELS) e no contraforte têm o MESMO símbolo e a
  MESMA descrição (μ, βf, Md,∥, σtd,⊥, k_E, ψ_ELS, Δξ, n_adm, ℓcf...) — um muro é balanço OU contrafortes, e o
  glossário fica igual nos dois. O que é só do painel entre contrafortes leva índice: v/h (direção) e p (painel).
*/
import dados from '@/motor/planilha.gerada.json';
import type { PlanilhaExportada } from '@/motor/tipos';
import type { AutorDeCards, Card, Expr, Passo, Ref } from '../tipos';
import { arredBaixo, avaliar, cbrt, celulasDoIntervalo, cte, div, inteiro, max, min, mul, neg, nome, par, pi, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao, type Memoria, type PedidoDeVerificacao } from '../passo';
import { desenhoDasSecoesDoPainel } from '../desenhoDaSecaoI';

/*
  Só os símbolos que nenhum outro grupo descreve. Os que este grupo USA e outros já descrevem (não redefinir aqui):
  ℓcf (estabilidade); f_pk, A_liq/A_br, f_yk, γm, γs, L_bloco, h_f (balanço); l_pan, h_pan, z_pan, σh,sup, w_d,
  h/l, μ, μ_tab, t_x, t_y, βf, Md,∥/⊥, σtd,∥/⊥, ftk e ftd ∥/⊥, b_w,inf, n_adm (painelEls); k_E, ψ_ELS, Δξ
  (painelEls e contraforte).
*/
export const SIMBOLOS_PAINELCF: Readonly<Record<string, string>> = {
  // ── geometria e carga do painel (Libânio) ──
  '\\gamma_p': 'relação h/ℓ do painel (tabelas de Libânio)',
  '\\gamma_{p,tab}': 'relação h/ℓ do painel limitada à tabela (0,30 a 2,00)',
  '\\ell_{ref}': 'menor vão do painel (referência das tabelas de Libânio)',
  'p_{tri}': 'parcela triangular da pressão no painel (característica)',
  'p_{uni}': 'parcela uniforme da pressão no painel (característica)',
  't_\\gamma': 'fator de interpolação em γ na tabela de Libânio',
  '\\mu_x': 'coef. de Libânio, carga triangular: vertical no vão',
  "\\mu'_x": 'coef. de Libânio, carga triangular: vertical no engaste da base',
  '\\mu_y': 'coef. de Libânio, carga triangular: horizontal no vão',
  '\\mu_{yb}': 'coef. de Libânio, carga triangular: horizontal na borda livre',
  "\\mu'_y": 'coef. de Libânio, carga triangular: horizontal no engaste lateral',
  '\\mu_{x,u}': 'coef. de Libânio, carga uniforme: vertical no vão',
  "\\mu'_{x,u}": 'coef. de Libânio, carga uniforme: vertical no engaste da base',
  '\\mu_{y,u}': 'coef. de Libânio, carga uniforme: horizontal no vão',
  '\\mu_{yb,u}': 'coef. de Libânio, carga uniforme: horizontal na borda livre',
  "\\mu'_{y,u}": 'coef. de Libânio, carga uniforme: horizontal no engaste lateral',
  'M_{dx}': 'momento de cálculo horizontal no vão do painel, por metro',
  'M_{dxb}': 'momento de cálculo horizontal na borda livre do painel, por metro',
  'M_{dy}': 'momento de cálculo vertical no vão do painel, por metro',
  'M_{dyei}': 'momento de cálculo vertical no engaste da base do painel, por metro',
  'M_{dxe}': 'momento de cálculo horizontal no engaste lateral, por metro',

  // ── flexão vertical e horizontal (barras nos furos e nas canaletas) ──
  'f_{pk,p}': 'resistência do prisma usada no painel (líquida ou bruta)',
  K_v: 'fator K da compressão na flexão vertical do painel',
  K_h: 'fator K da compressão na flexão horizontal do painel',
  K_vf_d: 'resistência de cálculo à compressão na flexão vertical do painel',
  K_hf_d: 'resistência de cálculo à compressão na flexão horizontal do painel',
  c_p: 'distância da face do bloco ao eixo das barras do painel',
  d_v: 'altura útil da barra vertical do painel',
  d_h: 'altura útil da barra horizontal do painel (canaleta)',
  'M_{v,solo}': 'momento vertical por metro para a barra do lado do solo',
  'M_{v,ext}': 'momento vertical por metro para a barra do lado externo',
  M_h: 'momento horizontal por metro para a barra da canaleta',
  's_{furo}': 'espaçamento entre furos do bloco',
  's_{v,dig}': 'espaçamento vertical digitado nas Entradas',
  's_{h,dig}': 'espaçamento das canaletas digitado nas Entradas',
  s_v: 'espaçamento adotado das barras verticais do painel',
  s_h: 'espaçamento adotado das canaletas armadas do painel',
  'M_{d,v}': 'momento de cálculo vertical na faixa s_v (barra do lado do solo)',
  'M_{d,h}': 'momento de cálculo horizontal na faixa s_h',
  x_v: 'profundidade da linha neutra no ELU, flexão vertical do painel',
  x_h: 'profundidade da linha neutra no ELU, flexão horizontal do painel',
  'f_{sd,v}': 'tensão de cálculo na barra vertical do painel',
  'f_{sd,h}': 'tensão de cálculo na barra horizontal do painel',
  'A_{s,solo}': 'armadura vertical na faixa s_v, barra do lado do solo',
  'A_{s,ext}': 'armadura vertical na faixa s_v, barra do lado externo',
  'A_{s,h}': 'armadura horizontal na faixa s_h (canaleta)',
  'A_{s,m\\acute{\\imath}n,v}': 'armadura mínima vertical na faixa s_v',
  'A_{s,m\\acute{\\imath}n,h}': 'armadura mínima horizontal na faixa s_h',
  '\\phi_v': 'diâmetro da barra vertical do painel',
  '\\phi_h': 'diâmetro da barra horizontal do painel',
  'a_{s,v}': 'área de uma barra vertical do painel',
  'a_{s,h}': 'área de uma barra horizontal do painel',

  // (alvenaria não armada entre barras e canaletas: toda a grafia é a do painel do balanço — SIMBOLOS_PAINELELS)

  // ── ELS do painel (seção I nas duas direções, flecha de Libânio) ──
  'E_{m,p}': 'módulo de elasticidade da alvenaria do painel',
  n_p: 'razão modular E_s/E_m do painel',
  'b_{m,v}': 'largura da mesa da seção I, ELS vertical (faixa s_v)',
  'b_{w,v}': 'largura da alma da seção I, ELS vertical',
  'b_{m,h}': 'largura da mesa da seção I, ELS horizontal (faixa s_h)',
  'b_{w,h}': 'largura da alma da seção I, ELS horizontal',
  'h_{can}': 'altura da canaleta grauteada (alma do ELS horizontal)',
  'M_{a,v}': 'momento de serviço na faixa b_m, flexão vertical',
  'M_{a,h}': 'momento de serviço na faixa b_m, flexão horizontal',
  'I_{m,v}': 'momento de inércia bruto da seção I, flexão vertical',
  'I_{m,h}': 'momento de inércia bruto da seção I, flexão horizontal',
  'M_{r,v}': 'momento de fissuração, flexão vertical',
  'M_{r,h}': 'momento de fissuração, flexão horizontal',
  'x_{1,v}': 'linha neutra no estádio II com a 2ª barra tracionada, vertical',
  'x_{II,v}': 'linha neutra no estádio II, flexão vertical',
  'x_{II,h}': 'linha neutra no estádio II, flexão horizontal',
  'I_{II,v}': 'momento de inércia no estádio II, flexão vertical',
  'I_{II,h}': 'momento de inércia no estádio II, flexão horizontal',
  'I_{eq,v}': 'momento de inércia equivalente (Branson), flexão vertical',
  'I_{eq,h}': 'momento de inércia equivalente (Branson), flexão horizontal',
  'h_{eq,v}': 'espessura equivalente para a flecha, rigidez vertical',
  'h_{eq,h}': 'espessura equivalente para a flecha, rigidez horizontal',
  '\\alpha': 'coef. de flecha de Libânio, carga triangular',
  '\\alpha_B': 'coef. de flecha de Libânio na borda livre, carga triangular',
  '\\alpha_u': 'coef. de flecha de Libânio, carga uniforme',
  '\\alpha_{B,u}': 'coef. de flecha de Libânio na borda livre, carga uniforme',
  'p_{\\alpha}': 'carga de serviço do painel ponderada pelos coeficientes α',
  'p_{\\alpha B}': 'carga de serviço do painel ponderada pelos coeficientes α_B',
  '\\delta_{0,v}': 'flecha imediata do painel com h_eq,v',
  '\\delta_{0B,v}': 'flecha imediata na borda livre com h_eq,v',
  '\\delta_{0,h}': 'flecha imediata do painel com h_eq,h',
  '\\delta_{0B,h}': 'flecha imediata na borda livre com h_eq,h',
  '\\delta_{adm,p}': 'deslocamento-limite do painel',
  '\\delta_{\\infty,p}': 'flecha final do painel (direção mais crítica)',
  'h/t': 'relação altura/espessura do painel (ábaco)',
  '\\ell_{cf}/t': 'relação vão/espessura do painel (ábaco)',
  '(h/t)_{lim}': 'limite de h/t do ábaco simplificado (borda superior livre)',
};

const P = dados as unknown as PlanilhaExportada;
const ABA = 'Contrafortes';

/*
  Linhas sem nome definido (coeficientes de Libânio, f_td e os vereditos da seção 15) são achadas pelo RÓTULO da
  coluna A, não pelo número da linha: se o gerador inserir uma linha, o card continua lendo a célula certa (e, se o
  rótulo mudar, o autor lança e o teste acusa — em vez de ler outra conta calado).
*/
const LINHA_DO_ROTULO = new Map<string, number>();
for (const [ref, v] of Object.entries(P.celulas)) {
  const achado = /^Contrafortes!A(\d+)$/.exec(ref);
  if (achado && typeof v === 'string' && !v.startsWith('=') && !LINHA_DO_ROTULO.has(v)) LINHA_DO_ROTULO.set(v, Number(achado[1]));
}
function celulaDoRotulo(rotulo: string, coluna = 'B'): string {
  const l = LINHA_DO_ROTULO.get(rotulo);
  if (l === undefined) throw new Error(`painelCf: rótulo não achado na aba Contrafortes: "${rotulo}"`);
  return `${ABA}!${coluna}${l}`;
}

/** Tabela constante da aba Referências (pelo nome definido do intervalo), linha a linha. */
function tabela(nomeDefinido: string): number[][] {
  const ref = P.nomes[nomeDefinido];
  if (!ref) throw new Error(`painelCf: tabela inexistente na planilha: ${nomeDefinido}`);
  const cels = celulasDoIntervalo(ref);
  const linha = (a: string) => /(\d+)$/.exec(a)?.[1];
  const ncol = cels.filter((a) => linha(a) === linha(cels[0])).length;
  const out: number[][] = [];
  for (let i = 0; i < cels.length; i += ncol) {
    out.push(cels.slice(i, i + ncol).map((c) => {
      const v = P.celulas[c];
      return typeof v === 'number' ? v : NaN;
    }));
  }
  return out;
}

const AULA: Ref = { fonte: 'Aula 12.3' };
const LIBANIO: Ref = { fonte: 'Libânio' };
const CURSO_11: Ref = { fonte: 'Curso', item: 'planilha 11' };
const NBR = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });

/** Card fora do muro com contrafortes: segura o lugar, sem passo (nada de "—" na tela). */
const vazio = (id: string, titulo: string, figura: string): Card => ({ id, titulo, figura, secoes: [], avisos: [], aplicavel: false });

/*
  Célula que a planilha deixou em "—" (ou vazia, ou erro) não vira linha: o passo sai, e a seção que ficar sem passo
  também. Texto que É resultado ("não resiste") fica — é o que a planilha publica.
*/
const mostra = (p: Passo) =>
  p.origem === 'entrada' || typeof p.valor === 'number'
  || (typeof p.valor === 'string' && p.valor.trim() !== '—' && !p.valor.startsWith('#'));
function limpo(card: Card): Card {
  const secoes = card.secoes
    .map((s) => ({ ...s, passos: s.passos.filter(mostra) }))
    .filter((s) => s.passos.length > 0);
  return { ...card, secoes };
}

/** O Excel compara texto sem caixa: LEFT(lat_pan;4)="Apoi". */
const comeca = (texto: string, prefixo: string) => texto.toLowerCase().startsWith(prefixo.toLowerCase());

/** Dos candidatos (nome, folha), a folha de MAIOR número — o MAX da planilha, que ignora célula com texto. */
function maiorFolha(m: Memoria, itens: [string, Expr][]): Expr | null {
  let melhor: Expr | null = null;
  let v = -Infinity;
  for (const [id, f] of itens) {
    const x = m.valor(id);
    if (x !== null && x > v) { v = x; melhor = f; }
  }
  return melhor;
}

/** x no ELU (curso, planilha 04): x = 1,25 d [1 − √(1 − Md/(0,5 b d² K fd))]. */
const xElu = (d: Expr, b: Expr, Md: Expr, kfd: Expr): Expr =>
  mul(cte(1.25, 2), d, par(sub(cte(1, 0), raiz(sub(cte(1, 0), div(Md, mul(cte(0.5, 1), b, pot(d, 2), kfd)))))));

/** As = Md/(fsd·z), z = mín(d − 0,4x; 0,95d). */
const asElu = (Md: Expr, fsd: Expr, d: Expr, x: Expr): Expr =>
  div(Md, mul(fsd, min(sub(d, mul(cte(0.4, 1), x)), mul(cte(0.95, 2), d))));

/** fsd = fyk/γs: bloco de concreto, todo Ø. */
function fsdExpr(m: Memoria): Expr {
  return div(m.ent('fyk_', 'f_{yk}'), m.ent('gama_s', '\\gamma_s'));
}

/*
  Linha neutra no estádio II da seção I (planilha 06 do curso), raiz da equação do 2º grau já arrumada:
    retângulo (LN na mesa): x = [−B + √(B² + 2·bm·C)]/bm,  B = n·As1 + n2·As2,  C = n·As1·d + n2·As2·d'
    T (LN na alma):         x = [−B + √(B² + 2·bw·C)]/bw,  B = (bm − bw)·hf + ...,  C = (bm − bw)·hf²/2 + ...
  É a mesma conta da planilha ((−B + √(B² − 4AC))/2A com A = bm/2 ou bw/2): só os sinais e o 4·A/2 arrumados.
*/
interface SecaoI {
  bm: Expr; bw: Expr; hf: Expr; n: Expr; as1: Expr; d: Expr;
  /** 2ª barra (a do lado comprimido no vão): ausente quando a planilha usa As2 = 0. */
  b2?: { as2: Expr; n2: Expr; dl: Expr };
}
function linhaNeutraII(s: SecaoI, naMesa: boolean): Expr {
  const B0 = s.b2 ? soma(mul(s.n, s.as1), mul(s.b2.n2, s.b2.as2)) : mul(s.n, s.as1);
  const C0 = s.b2 ? soma(mul(s.n, s.as1, s.d), mul(s.b2.n2, s.b2.as2, s.b2.dl)) : mul(s.n, s.as1, s.d);
  if (naMesa) return div(soma(neg(B0), raiz(soma(pot(B0, 2), mul(cte(2, 0), s.bm, C0)))), s.bm);
  const B = soma(mul(par(sub(s.bm, s.bw)), s.hf), B0);
  const C = soma(div(mul(par(sub(s.bm, s.bw)), pot(s.hf, 2)), cte(2, 0)), C0);
  return div(soma(neg(B), raiz(soma(pot(B, 2), mul(cte(2, 0), s.bw, C)))), s.bw);
}
/** As duas formas, primeiro a que a planilha escolheu: IF(x_retângulo ≤ hf; retângulo; T). */
function linhaNeutraEscolhida(m: Memoria, s: SecaoI): Expr[] {
  const ret = linhaNeutraII(s, true);
  const t = linhaNeutraII(s, false);
  return avaliar(ret, m.r) <= (m.valor('hf_bl') ?? 0) ? [ret, t] : [t, ret];
}

/** III da seção I fissurada: alvenaria comprimida (mesa ou T) + 2ª barra + barra tracionada. */
function inerciaII(s: SecaoI, x: Expr, naMesa: boolean): Expr {
  const comprimido = naMesa
    ? div(mul(s.bm, pot(x, 3)), cte(3, 0))
    : soma(
        div(mul(s.bw, pot(x, 3)), cte(3, 0)),
        div(mul(par(sub(s.bm, s.bw)), pot(s.hf, 3)), cte(12, 0)),
        mul(par(sub(s.bm, s.bw)), s.hf, pot(sub(x, div(s.hf, cte(2, 0))), 2)),
      );
  const partes = [comprimido];
  if (s.b2) partes.push(mul(s.b2.n2, s.b2.as2, pot(sub(x, s.b2.dl), 2)));
  partes.push(mul(s.n, s.as1, pot(sub(s.d, x), 2)));
  return soma(...partes);
}

// ───────────────────────────── Libânio: tabela e interpolação ─────────────────────────────

// Colunas dos blocos da aba Referências (μx, μ'x, μy, μyb, μ'y, μ'yb, α, αB) — a ordem do CHOOSE/INDEX da planilha
const COEF = { mx: 1, mxe: 2, my: 3, myb: 4, mye: 5, a: 7, aB: 8 } as const;

/**
  Coeficiente de Libânio interpolado em γ como a planilha faz: μ = μ_i + t·(μ_{i+1} − μ_i). Os dois μ da tabela
  entram como constantes (o número que se lê no livro); t = fator publicado no card dos momentos. Com t = 0 (γ na
  própria linha, ou γ = 2,00) não há conta a mostrar: passo de tabela.
*/
function passoCoef(m: Memoria, celula: string, simbolo: string, k: number, uniforme: boolean): Passo {
  const engastadas = !comeca(m.texto('lat_pan'), 'Apoi');
  const T = tabela(uniforme ? (engastadas ? 'lib_UE' : 'lib_UA') : engastadas ? 'lib_TE' : 'lib_TA');
  const i = m.num('i_g');
  const t = m.num('t_g') ?? 0;
  if (i === null || t === 0) return m.passo(celula, simbolo, null, { casas: 4, origem: 'tabela', ref: LIBANIO });
  const a = T[i - 1][k - 1];
  const b = T[Math.min(35, i + 1) - 1][k - 1];
  return m.passo(celula, simbolo, soma(cte(a, 2), mul(m.g('t_g', 't_\\gamma', 3), par(sub(cte(b, 2), cte(a, 2))))), {
    casas: 4, ref: LIBANIO,
  });
}

// ───────────────────────────── 1 · momentos (Libânio) ─────────────────────────────

function cardMomentos(m: Memoria): Card {
  const engastadas = !comeca(m.texto('lat_pan'), 'Apoi');                     // LEFT(lat_pan;4)="Apoi"
  const temUni = (m.valor('p_uni') ?? 0) !== 0;
  const tipo = engastadas ? (temUni ? 'Tipos 22 e 10' : 'Tipo 22') : temUni ? 'Tipos 21 e 9' : 'Tipo 21';

  // a placa vai até o topo do MURO (borda livre); com o solo abaixo dele, o triângulo de carga vai de 0 no topo do muro
  // a p_tri na base — DEDUÇÃO da planilha, a favor da segurança (carga ≥ a real em todo ponto)
  const h = m.ent('H_muro', 'h_{muro}');
  const soloAbaixo = (m.num('H_solo') ?? 0) < (m.num('H_muro') ?? 0);
  const lp = m.g('l_p', '\\ell_{cf}', 2, 'm');
  const gp = m.g('gam_p', '\\gamma_p', 3);
  const lref = m.g('lref_p', '\\ell_{ref}', 2, 'm');
  const gf = m.ent('gama_f', '\\gamma_f');
  const shB = m.g('sh_base', '\\sigma_{h,base}', 2, 'kPa');
  const shT = m.g('sh_topo', '\\sigma_{h,topo}', 2, 'kPa');
  const pTri = m.g('p_tri', 'p_{tri}', 2, 'kPa');
  const pUni = m.g('p_uni', 'p_{uni}', 2, 'kPa');

  // γ fora de 0,30–2,00: a planilha limita (gam_c) e reprova. A desigualdade escrita é a do limite que pesa.
  const g = m.valor('gam_p');
  const abaixo = g !== null && g < 0.3;
  const fora = g !== null && (g < 0.3 || g > 2);
  const gUsado = fora ? m.g('gam_c', '\\gamma_{p,tab}', 3) : gp;

  // fator de interpolação: IF(i_g>=35;0;(γ − γ_i)/(γ_{i+1} − γ_i)), γ da tabela como constante
  const i = m.num('i_g');
  const t = m.num('t_g') ?? 0;
  const G = tabela('lib_g').map((x) => x[0]);

  const geometria = secao('Geometria e carga', [
    m.entrada('H_muro', 'h_{muro}'),
    soloAbaixo && m.entrada('H_solo', 'h_{solo}'),
    m.passo('l_p', '\\ell_{cf}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.passo('gam_p', '\\gamma_p', div(h, lp), {
      casas: 3,
      ref: LIBANIO,
      verif: {
        chave: 'painelCf.gama',
        rotulo: 'γp dentro da tabela (0,30 a 2,00)',
        limite: abaixo ? 0.3 : 2,
        relacao: abaixo ? '>=' : '<=',
        celula: celulaDoRotulo('Painel: γ dentro da tabela (0,30–2,00)'),
        casasLimite: 2,
      },
    }),
    fora && m.passo('gam_c', '\\gamma_{p,tab}', min(cte(2, 0), max(cte(0.3, 2), gp)), { casas: 3 }),
    m.passo('lref_p', '\\ell_{ref}', min(h, lp), { casas: 2, unidade: 'm' }),
    m.passo('p_tri', 'p_{tri}', [sub(shB, shT), max(cte(0, 0), sub(shB, shT))], {
      casas: 2, unidade: 'kPa', ...(soloAbaixo ? { ref: { fonte: 'Dedução' } as const } : {}),
    }),
    m.passo('p_uni', 'p_{uni}', shT, { casas: 2, unidade: 'kPa', ...(soloAbaixo ? { ref: { fonte: 'Dedução' } as const } : {}) }),
  ], AULA);

  const lin = (rotulo: string, col: 'B' | 'C') => celulaDoRotulo(rotulo, col);
  const coef = (rotulo: string, simbolo: string, k: number, uniforme = false) =>
    passoCoef(m, lin(rotulo, uniforme ? 'C' : 'B'), simbolo, k, uniforme);
  const coeficientes = secao(`Coeficientes · ${tipo}`, [
    i !== null && t !== 0 && m.passo('t_g', 't_\\gamma', div(sub(gUsado, cte(G[i - 1], 2)), sub(cte(G[i], 2), cte(G[i - 1], 2))), {
      casas: 3, ref: CURSO_11,
    }),
    coef('μy', '\\mu_y', COEF.my),
    coef('μyb', '\\mu_{yb}', COEF.myb),
    coef('μx', '\\mu_x', COEF.mx),
    coef("μ'x", "\\mu'_x", COEF.mxe),
    engastadas && coef("μ'y", "\\mu'_y", COEF.mye),
    temUni && coef('μy', '\\mu_{y,u}', COEF.my, true),
    temUni && coef('μyb', '\\mu_{yb,u}', COEF.myb, true),
    temUni && coef('μx', '\\mu_{x,u}', COEF.mx, true),
    temUni && coef("μ'x", "\\mu'_{x,u}", COEF.mxe, true),
    temUni && engastadas && coef("μ'y", "\\mu'_{y,u}", COEF.mye, true),
  ], LIBANIO);

  // m = μ·p·l²/100 em kN·m/m é o mesmo número de μ·p·l² em kN·cm/m: a planilha não escreve o /100 nem o ×100.
  const mom = (id: string, simbolo: string, rotulo: string, tri: string, uni: string) => {
    const muT = nome(lin(rotulo, 'B'), tri, 4);
    const carga = temUni ? par(soma(mul(muT, pTri), mul(nome(lin(rotulo, 'C'), uni, 4), pUni))) : mul(muT, pTri);
    return m.passo(id, simbolo, mul(gf, carga, pot(lref, 2)), { casas: 1, unidade: 'kN·cm/m' });
  };
  const momentos = secao('Momentos de cálculo', [
    mom('Mdx_p', 'M_{dx}', 'μy', '\\mu_y', '\\mu_{y,u}'),
    mom('Mdxb_p', 'M_{dxb}', 'μyb', '\\mu_{yb}', '\\mu_{yb,u}'),
    mom('Mdy_p', 'M_{dy}', 'μx', '\\mu_x', '\\mu_{x,u}'),
    mom('Mdyei_p', 'M_{dyei}', "μ'x", "\\mu'_x", "\\mu'_{x,u}"),
    // Tipo 21/9 (laterais apoiadas) não tem μ'y: o engaste lateral só existe com as laterais engastadas
    engastadas && mom('Mdxe_p', 'M_{dxe}', "μ'y", "\\mu'_y", "\\mu'_{y,u}"),
  ], { fonte: 'Libânio', item: tipo });

  return limpo({
    id: 'painelCf.momentos',
    titulo: 'Painel · momentos (Libânio)',
    ref: LIBANIO,
    figura: 'Fig. 13',
    secoes: [geometria, coeficientes, momentos],
    avisos: [],
    aplicavel: true,
  });
}

// ───────────────────────────── resistência do painel (vertical e horizontal) ─────────────────────────────

function passoFpk(m: Memoria): Passo {
  const fpk = m.g('fpk_oco', 'f_{pk}', 1, 'MPa');
  // graute a cada 20 = todos os furos (13/10): o painel é seção cheia, prisma cheio
  if (m.texto('gr_tot') === 'Sim') return m.passo('fpk_pn', 'f_{pk,p}', m.g('fpk_chei', 'f_{pk}^{*}', 1, 'MPa'), { casas: 2, unidade: 'MPa' });
  return comeca(m.texto('fpk_ref'), 'Líqu')                                     // LEFT(fpk_ref;4)="Líqu"
    ? m.passo('fpk_pn', 'f_{pk,p}', div(fpk, m.g('r_liq', 'A_{liq}/A_{br}', 2)), { casas: 2, unidade: 'MPa', ref: NBR('11.3.5') })
    : m.passo('fpk_pn', 'f_{pk,p}', fpk, { casas: 2, unidade: 'MPa' });
}

const cursoAsMin = (m: Memoria) => comeca(m.texto('AsMin_crit'), 'Curso');    // LEFT(AsMin_crit;5)="Curso"

// ───────────────────────────── 2 · flexão vertical ─────────────────────────────

function cardVertical(m: Memoria): Card {
  const duas = m.texto('pos_pv').startsWith('2');                              // LEFT(pos_pv;1)="2"
  const digitado = m.num('s_pv_dir') !== null;                                 // ISNUMBER(s_pv_dir)
  const curso = cursoAsMin(m);

  const t = m.ent('t_bloco', 't');
  const c = m.ent('c_pv', 'c_p');
  const fpkP = m.g('fpk_pn', 'f_{pk,p}', 2, 'MPa');
  const d = m.g('d_pv', 'd_v', 1, 'cm');
  const sv = m.g('s_pv', 's_v', 0, 'cm');
  const sfuro = m.g('s_furo', 's_{furo}', 1, 'cm');
  const Mvs = m.g('M_pvs', 'M_{v,solo}', 1, 'kN·cm/m');
  const Mve = m.g('M_pve', 'M_{v,ext}', 1, 'kN·cm/m');
  const Mdyei = m.g('Mdyei_p', 'M_{dyei}', 1, 'kN·cm/m');
  const Mdy = m.g('Mdy_p', 'M_{dy}', 1, 'kN·cm/m');
  const Md = m.g('Md_pvs', 'M_{d,v}', 1, 'kN·cm');
  // na conta de x e As a planilha divide por 10 (MPa → kN/cm²): a folha já lê em kN/cm², como a aula escreve
  const kfd = m.g('Kfd_pv', 'K_vf_d', 3, 'kN/cm²', { fator: 0.1 });
  const fsd = m.g('fsd_pv', 'f_{sd,v}', 2, 'kN/cm²', { fator: 0.1 });
  const x = m.g('x_pv', 'x_v', 2, 'cm');
  const asMin = m.g('As_pvm', 'A_{s,m\\acute{\\imath}n,v}', 2, 'cm²');
  const asSolo = m.g('As_pvs', 'A_{s,solo}', 2, 'cm²');
  const asExt = m.g('As_pve', 'A_{s,ext}', 2, 'cm²');

  const dados = secao('Dados', [
    m.entrada('t_bloco', 't'),
    duas && m.entrada('c_pv', 'c_p'),
    m.entrada('phi_pv', '\\phi_v'),
    m.entrada('K_pv', 'K_v'),
    m.entrada('gama_m', '\\gamma_m'),
    m.entrada('fyk_', 'f_{yk}'),
    m.entrada('gama_s', '\\gamma_s'),
    digitado && m.entrada('s_pv_dir', 's_{v,dig}'),
  ]);

  const resist = secao('Resistências', [
    passoFpk(m),
    m.passo('Kfd_pv', 'K_vf_d', div(mul(m.ent('K_pv', 'K_v'), cte(0.7, 1), fpkP), m.ent('gama_m', '\\gamma_m')), {
      casas: 3, unidade: 'MPa', ref: { fonte: 'Curso', item: 'planilha 04' },
    }),
    m.passo('fsd_pv', 'f_{sd,v}', fsdExpr(m), { casas: 1, unidade: 'MPa', ref: NBR('11.3.3') }),
  ]);

  // furo a furo = meio bloco (família 39)
  const furo = div(soma(m.g('L_bloco', 'L_{bloco}', 0, 'cm'), cte(1, 0)), cte(2, 0));

  const esforcos = secao('Esforços na faixa s_v', [
    m.passo('d_pv', 'd_v', duas ? sub(t, c) : div(t, cte(2, 0)), { casas: 1, unidade: 'cm' }),
    // 2 barras: cada face tem a sua (engaste da base → solo; vão → externa); 1 barra centralizada pega o maior
    m.passo('M_pvs', 'M_{v,solo}', duas ? Mdyei : max(Mdyei, Mdy), { casas: 1, unidade: 'kN·cm/m' }),
    duas && m.passo('M_pve', 'M_{v,ext}', Mdy, { casas: 1, unidade: 'kN·cm/m' }),
    // o espaçamento digitado cai na grade dos furos, para baixo (barra fora do furo não existe na obra)
    digitado && m.passo('s_furo', 's_{furo}', furo, { casas: 1, unidade: 'cm' }),
    digitado
      ? m.passo('s_pv', 's_v', mul(arredBaixo(div(m.ent('s_pv_dir', 's_{v,dig}'), sfuro)), sfuro), { casas: 0, unidade: 'cm' })
      : m.passo('s_pv', 's_v', null, { casas: 0, unidade: 'cm', origem: 'adotado' }),
    m.passo('Md_pvs', 'M_{d,v}', div(mul(Mvs, sv), cte(100, 0)), { casas: 1, unidade: 'kN·cm' }),
  ], AULA);

  // "não resiste": a raiz da conta de x fica negativa (ou a faixa é nula) — a planilha escreve o texto, sem conta
  const resiste = m.valor('x_pv') !== null && m.valor('As_pvs') !== null;
  const temExt = duas && m.valor('As_pve') !== null;
  // 0,01·M·s em vez de M·s/100: o mesmo número, sem fração dentro de fração na linha (que já é longa)
  const mdExt = mul(cte(0.01, 2), Mve, sv);
  const govSolo = resiste ? maiorFolha(m, [['As_pvs', asSolo], ['As_pvm', asMin]]) : null;
  const govExt = temExt ? maiorFolha(m, [['As_pve', asExt], ['As_pvm', asMin]]) : null;
  const barra = (chave: string, rotulo: string, rotuloCelula: string, gov: Expr | null): PedidoDeVerificacao => ({
    chave, rotulo, limite: gov, relacao: '>=', celula: celulaDoRotulo(rotuloCelula),
  });

  const armadura = secao('Armadura na faixa s_v', [
    resiste
      ? m.passo('x_pv', 'x_v', xElu(d, sv, Md, kfd), { casas: 2, unidade: 'cm', ref: { fonte: 'ABCP', item: '3.4' } })
      : m.passo('x_pv', 'x_v', null, { casas: 2, unidade: 'cm', origem: 'calculado' }),
    resiste
      ? m.passo('As_pvs', 'A_{s,solo}', asElu(Md, fsd, d, x), { casas: 2, unidade: 'cm²' })
      : m.passo('As_pvs', 'A_{s,solo}', null, { casas: 2, unidade: 'cm²', origem: 'calculado' }),
    // lado externo: a planilha faz x e z dentro da mesma célula — a linha leva a conta inteira
    temExt && m.passo('As_pve', 'A_{s,ext}', asElu(mdExt, fsd, d, xElu(d, sv, mdExt, kfd)), { casas: 2, unidade: 'cm²' }),
    m.passo('As_pvm', 'A_{s,m\\acute{\\imath}n,v}', curso ? mul(cte(0.0015, 4), sv, d) : mul(cte(0.001, 3), sv, t), {
      casas: 2, unidade: 'cm²', ref: curso ? { fonte: 'Curso', item: 'planilha 04' } : NBR('12.2'),
    }),
    m.passo('a_pv', 'a_{s,v}', div(mul(pi(), pot(m.ent('phi_pv', '\\phi_v'), 2)), cte(400, 0)), {
      casas: 3, unidade: 'cm²',
      verif: barra('painelCf.vertical.solo', 'Barra vertical do lado do solo', 'Painel vertical: barra do lado do solo', govSolo),
    }),
    duas && m.passo('a_pv', 'a_{s,v}', null, {
      casas: 3, unidade: 'cm²', origem: 'calculado',
      verif: barra('painelCf.vertical.ext', 'Barra vertical do lado externo', 'Painel vertical: barra do lado externo', govExt),
    }),
  ], NBR('11.3.3'));

  return limpo({
    id: 'painelCf.flexaoVertical',
    titulo: 'Painel · flexão vertical',
    ref: AULA,
    figura: 'Fig. 14',
    secoes: [dados, resist, esforcos, armadura],
    avisos: [],
    aplicavel: true,
  });
}

// ───────────────────────────── 3 · flexão horizontal ─────────────────────────────

function cardHorizontal(m: Memoria): Card {
  const centralizada = comeca(m.texto('pos_ph'), 'Cent');                      // LEFT(pos_ph;4)="Cent"
  const engastadas = !comeca(m.texto('lat_pan'), 'Apoi');
  const digitado = m.num('s_ph_dir') !== null;
  const curso = cursoAsMin(m);

  const t = m.ent('t_bloco', 't');
  const fpkP = m.g('fpk_pn', 'f_{pk,p}', 2, 'MPa');
  const d = m.g('d_ph', 'd_h', 1, 'cm');
  const sh = m.g('s_ph', 's_h', 0, 'cm');
  const Mh = m.g('M_ph', 'M_h', 1, 'kN·cm/m');
  const Md = m.g('Md_ph', 'M_{d,h}', 1, 'kN·cm');
  const kfd = m.g('Kfd_ph', 'K_hf_d', 3, 'kN/cm²', { fator: 0.1 });
  const fsd = m.g('fsd_ph', 'f_{sd,h}', 2, 'kN/cm²', { fator: 0.1 });
  const x = m.g('x_ph', 'x_h', 2, 'cm');
  const asMin = m.g('As_phm', 'A_{s,m\\acute{\\imath}n,h}', 2, 'cm²');
  const asH = m.g('As_phc', 'A_{s,h}', 2, 'cm²');
  const Mdx = m.g('Mdx_p', 'M_{dx}', 1, 'kN·cm/m');
  const Mdxe = m.g('Mdxe_p', 'M_{dxe}', 1, 'kN·cm/m');

  const dados = secao('Dados', [
    m.entrada('t_bloco', 't'),
    !centralizada && m.entrada('c_pv', 'c_p'),
    m.entrada('phi_ph', '\\phi_h'),
    m.num('K_ph') !== null && m.entrada('K_ph', 'K_h'),
    digitado && m.entrada('s_ph_dir', 's_{h,dig}'),
  ]);

  const resist = secao('Resistências', [
    // K = 0,5: fk horizontal = 50% do vertical quando a seção horizontal não é toda grauteada
    // 0,5 se a seção horizontal não é toda grauteada, 1,0 com todos os furos (graute a cada 20, 13/10); em branco
    // nas Entradas = esse automático, digitado manda
    m.num('K_ph') === null && m.passo('K_ph_us', 'K_h', null, { casas: 2, origem: 'adotado', ref: NBR('6.2.2.4') }),
    m.passo('Kfd_ph', 'K_hf_d', div(mul(m.g('K_ph_us', 'K_h', 2), cte(0.7, 1), fpkP), m.ent('gama_m', '\\gamma_m')), {
      casas: 3, unidade: 'MPa', ref: NBR('6.2.2.4'),
    }),
    m.passo('fsd_ph', 'f_{sd,h}', fsdExpr(m), { casas: 1, unidade: 'MPa', ref: NBR('11.3.3') }),
  ]);

  // barra centralizada atende os dois sinais: vão (Mdx) e engaste lateral (Mdxe, só com laterais engastadas)
  const momentoH: Expr[] = centralizada ? (engastadas ? [max(Mdx, Mdxe)] : [Mdx, max(Mdx, Mdxe)]) : [Mdx];
  const esforcos = secao('Esforços na faixa s_h', [
    m.passo('d_ph', 'd_h', centralizada ? div(t, cte(2, 0)) : sub(t, m.ent('c_pv', 'c_p')), { casas: 1, unidade: 'cm' }),
    m.passo('M_ph', 'M_h', momentoH, { casas: 1, unidade: 'kN·cm/m' }),
    digitado
      ? m.passo('s_ph', 's_h', m.ent('s_ph_dir', 's_{h,dig}'), { casas: 0, unidade: 'cm' })
      : m.passo('s_ph', 's_h', null, { casas: 0, unidade: 'cm', origem: 'adotado' }),
    m.passo('Md_ph', 'M_{d,h}', div(mul(Mh, sh), cte(100, 0)), { casas: 1, unidade: 'kN·cm' }),
  ], AULA);

  const resiste = m.valor('x_ph') !== null && m.valor('As_phc') !== null;
  const gov = resiste ? maiorFolha(m, [['As_phc', asH], ['As_phm', asMin]]) : null;

  const armadura = secao('Armadura na faixa s_h', [
    resiste
      ? m.passo('x_ph', 'x_h', xElu(d, sh, Md, kfd), { casas: 2, unidade: 'cm', ref: { fonte: 'ABCP', item: '3.4' } })
      : m.passo('x_ph', 'x_h', null, { casas: 2, unidade: 'cm', origem: 'calculado' }),
    resiste
      ? m.passo('As_phc', 'A_{s,h}', asElu(Md, fsd, d, x), { casas: 2, unidade: 'cm²' })
      : m.passo('As_phc', 'A_{s,h}', null, { casas: 2, unidade: 'cm²', origem: 'calculado' }),
    m.passo('As_phm', 'A_{s,m\\acute{\\imath}n,h}', curso ? mul(cte(0.0015, 4), sh, d) : mul(cte(0.001, 3), sh, t), {
      casas: 2, unidade: 'cm²', ref: curso ? { fonte: 'Curso', item: 'planilha 04' } : NBR('12.2'),
    }),
    m.passo('a_ph', 'a_{s,h}', div(mul(pi(), pot(m.ent('phi_ph', '\\phi_h'), 2)), cte(400, 0)), {
      casas: 3, unidade: 'cm²',
      verif: {
        chave: 'painelCf.horizontal', rotulo: 'Barra horizontal na canaleta', limite: gov, relacao: '>=',
        celula: celulaDoRotulo('Painel horizontal: barra na canaleta'),
      },
    }),
  ], NBR('11.3.3'));

  // a planilha avisa quando a barra encostada na face externa não pega a tração do engaste lateral
  const textoAviso = m.r.cel(celulaDoRotulo('Precisa de barra do lado do solo junto ao contraforte?'));
  const aviso = typeof textoAviso === 'string' && textoAviso.startsWith('SIM');

  return limpo({
    id: 'painelCf.flexaoHorizontal',
    titulo: 'Painel · flexão horizontal',
    ref: AULA,
    figura: 'Fig. 14',
    secoes: [dados, resist, esforcos, armadura],
    avisos: aviso ? ['Mdxe traciona a face do solo junto ao contraforte: barra centralizada ou 2 barras na canaleta'] : [],
    aplicavel: true,
  });
}

// ───────────────────────────── 4 · alvenaria não armada entre barras e canaletas ─────────────────────────────

function cardNaoArmado(m: Memoria): Card {
  const id = 'painelCf.naoArmado', titulo = 'Painel · alvenaria não armada', figura = 'Fig. 5';
  // barra em todo furo ou canaleta em toda fiada: não sobra painel sem armadura (a planilha escreve "Não — ...")
  if (m.texto('tem_sp') !== 'Sim') return vazio(id, titulo, figura);

  // subpainel: altura limitada pelo MURO; profundidade e carga pelo SOLO (o perfil cobre a altura de solo)
  const hm = m.ent('H_muro', 'h_{muro}');
  const h = m.ent('H_solo', 'h_{solo}');
  const t = m.ent('t_bloco', 't');
  const gf = m.ent('gama_f', '\\gamma_f');
  const gm = m.ent('gama_m', '\\gamma_m');
  const shB = m.g('sh_base', '\\sigma_{h,base}', 2, 'kPa');
  const shT = m.g('sh_topo', '\\sigma_{h,topo}', 2, 'kPa');
  const sCan = m.g('s_ph', 's_h', 2, 'm', { fator: 0.01 });
  const l = m.g('l_sp', 'l_{pan}', 2, 'm');
  const hp = m.g('h_sp', 'h_{pan}', 2, 'm');
  const zp = m.g('z_sp', 'z_{pan}', 2, 'm');
  const sSup = m.g('sp_t2', '\\sigma_{h,sup}', 2, 'kPa');
  const wd = m.g('fd_sp', 'w_d', 2, 'kN/m²');
  const hl = m.g('hl_sp', 'h/l', 3);
  const mu = m.g('mu_pan', '\\mu', 2);
  const beta = m.g('bf_sp', '\\beta_f', 4);
  const Mpar = m.g('Mpar_sp', 'M_{d,\\parallel}', 1, 'kN·cm/m');
  const Mnor = m.g('Mnor_sp', 'M_{d,\\perp}', 1, 'kN·cm/m');
  const ftkN = m.g('ftk_nor', 'f_{tk,\\perp}', 2, 'MPa');
  const ftkP = m.g('ftk_par', 'f_{tk,\\parallel}', 2, 'MPa');
  const ftdPar = celulaDoRotulo('ftd,par = ftk∥/γm');
  const ftdNor = celulaDoRotulo('ftd,nor = ftk⊥/γm');

  // σh no topo do subpainel: a planilha interpola o perfil de 40 fatias da aba Solo e Empuxo. Perfil linear → a
  // reta topo–base dá o mesmo número e é a conta de mão. Perfil quebrado (água no meio, coesão cortando o topo) →
  // a interpolação da planilha, com os dois valores da tabela escritos (a mesma saída do painel do balanço).
  const reta = (m.valor('sh_topo') ?? 0) === 0
    ? mul(shB, div(zp, h))
    : soma(shT, mul(par(sub(shB, shT)), div(zp, h)));
  const alternativasSup: Expr[] = [reta];
  const H = m.num('H_solo');
  if (H) {
    // INDEX(G44:G84; INT(z/H·40) + 1) e a linha seguinte (no máximo a 41ª); INT com o corte de 15 algarismos do Excel
    const k = Math.floor(Number((((m.num('z_sp') ?? 0) / H) * 40).toPrecision(15)));
    const gk = m.valor(`Solo e Empuxo!G${44 + k}`);
    const gk1 = m.valor(`Solo e Empuxo!G${Math.min(45 + k, 84)}`);
    if (gk !== null && gk1 !== null) {
      const pos = mul(div(zp, h), cte(40, 0));
      alternativasSup.push(soma(cte(gk, 2), mul(sub(pos, inteiro(pos)), sub(cte(gk1, 2), cte(gk, 2)))));
    }
  }

  const geometria = secao('Painel não armado de baixo', [
    m.passo('l_sp', 'l_{pan}', m.g('s_pv', 's_v', 2, 'm', { fator: 0.01 }), { casas: 2, unidade: 'm' }),
    // MIN do Excel pula célula vazia: sem h, h_pan = s_h
    m.passo('h_sp', 'h_{pan}', m.num('H_muro') === null ? sCan : min(sCan, hm), { casas: 2, unidade: 'm' }),
    // subpainel mais alto que o solo: z = 0, trapézio do solo no subpainel inteiro (dedução, a favor da segurança)
    m.passo('z_sp', 'z_{pan}', [sub(h, hp), max(cte(0, 0), sub(h, hp))], {
      casas: 2, unidade: 'm', ...((m.num('H_solo') ?? 0) < (m.num('h_sp') ?? 0) ? { ref: { fonte: 'Dedução' } as const } : {}),
    }),
    m.passo('sp_t2', '\\sigma_{h,sup}', alternativasSup, { casas: 2, unidade: 'kPa', ref: { fonte: 'Aula 12.1' } }),
    // a aula usa a pressão média do painel de baixo: (14,4 + 20,8)/2 = 17,6 → 1,4·17,6 = 24,64
    m.passo('fd_sp', 'w_d', mul(gf, div(soma(sSup, shB), cte(2, 0))), { casas: 2, unidade: 'kN/m²', ref: NBR('E.3') }),
  ], AULA);

  // ── βf: interpolado na Tab. E.1 (caso 13) em h/l e μ, como a planilha 11 do curso ──
  const muLimitado = m.num('mu_sp') !== m.num('mu_pan');
  const muTab = muLimitado ? m.g('mu_sp', '\\mu_{tab}', 3) : mu;
  const j = m.num('j_sp'), i = m.num('i_sp');
  const tx = m.num('tx_sp') ?? 0, ty = m.num('ty_sp') ?? 0;
  const passosBeta: (Passo | false)[] = [];
  let betaExpr: Expr | null = null;
  if (j !== null && i !== null) {
    const H = tabela('hl_row')[0];
    const M = tabela('mu_col').map((x) => x[0]);
    const T = tabela('tabela_13');
    const cH = (jj: number) => cte(H[jj - 1], 2);
    const cM = (ii: number) => cte(M[ii - 1], 2);
    const cB = (ii: number, jj: number) => cte(T[ii - 1][jj - 1], 3);
    const txE = m.g('tx_sp', 't_x', 3);
    const tyE = m.g('ty_sp', 't_y', 3);
    const um = cte(1, 0);
    // IF(j>=11;0;...) e IF(i>=9;0;...): fator nulo = ponto da própria tabela, sem conta a mostrar
    if (tx !== 0) passosBeta.push(m.passo('tx_sp', 't_x', div(sub(hl, cH(j)), sub(cH(j + 1), cH(j))), { casas: 3, ref: CURSO_11 }));
    if (ty !== 0) passosBeta.push(m.passo('ty_sp', 't_y', div(sub(cM(i), muTab), sub(cM(i), cM(i + 1))), { casas: 3, ref: CURSO_11 }));
    const j2 = Math.min(11, j + 1), i2 = Math.min(9, i + 1);
    const naLinha = (ii: number) => soma(mul(sub(um, txE), cB(ii, j)), mul(txE, cB(ii, j2)));
    if (tx !== 0 && ty !== 0) betaExpr = soma(mul(sub(um, tyE), naLinha(i)), mul(tyE, naLinha(i2)));
    else if (tx !== 0) betaExpr = naLinha(i);
    else if (ty !== 0) betaExpr = soma(mul(sub(um, tyE), cB(i, j)), mul(tyE, cB(i2, j)));
  }

  const coeficiente = secao('Coeficiente βf · caso 13', [
    m.passo('mu_pan', '\\mu', div(ftkN, ftkP), { casas: 2, ref: NBR('E.2') }),
    m.passo('hl_sp', 'h/l', [div(hp, l), min(cte(3, 0), max(cte(0.3, 1), div(hp, l)))], { casas: 3 }),
    muLimitado && m.passo('mu_sp', '\\mu_{tab}', min(cte(1, 0), max(cte(0.3, 1), mu)), { casas: 3 }),
    ...passosBeta,
    m.passo('bf_sp', '\\beta_f', betaExpr, { casas: 4, origem: betaExpr ? 'calculado' : 'tabela', ref: NBR('E.4.2, Tab. E.1') }),
  ], NBR('Tab. E.1'));

  // σ = M/W, W = 100·t²/6 (faixa de 1 m, em cm³); ×10: kN/cm² → MPa
  const sigma = (Mx: Expr) => mul(div(mul(cte(6, 0), Mx), mul(cte(100, 0), pot(t, 2))), cte(10, 0));
  const verifSp = (chave: string, rotulo: string, limite: string, tex: string, rotuloCelula: string): PedidoDeVerificacao => ({
    chave, rotulo, limite: nome(limite, tex, 3, 'MPa'), relacao: '<=', celula: celulaDoRotulo(rotuloCelula),
  });

  const tracao = secao('Momentos e tensões', [
    m.passo('Mpar_sp', 'M_{d,\\parallel}', mul(beta, wd, pot(l, 2), cte(100, 0)), { casas: 1, unidade: 'kN·cm/m', ref: NBR('E.3') }),
    m.passo('Mnor_sp', 'M_{d,\\perp}', mul(mu, Mpar), { casas: 1, unidade: 'kN·cm/m', ref: NBR('E.3') }),
    m.passo(ftdPar, 'f_{td,\\parallel}', div(ftkP, gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.5') }),
    m.passo('st_psp', '\\sigma_{td,\\parallel}', sigma(Mpar), {
      casas: 3, unidade: 'MPa', ref: NBR('11.3.1'),
      verif: verifSp('painelCf.naoArmado.par', 'Painel não armado: σtd,∥ ≤ ftd,∥', ftdPar, 'f_{td,\\parallel}', 'Painel não armado: σtd,par ≤ ftd,par'),
    }),
    m.passo(ftdNor, 'f_{td,\\perp}', div(ftkN, gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.5') }),
    m.passo('st_nsp', '\\sigma_{td,\\perp}', sigma(Mnor), {
      casas: 3, unidade: 'MPa', ref: NBR('11.3.1'),
      verif: verifSp('painelCf.naoArmado.nor', 'Painel não armado: σtd,⊥ ≤ ftd,⊥', ftdNor, 'f_{td,\\perp}', 'Painel não armado: σtd,nor ≤ ftd,nor'),
    }),
  ], NBR('E.3'));

  return limpo({ id, titulo, ref: NBR('Anexo E'), figura, secoes: [geometria, coeficiente, tracao], avisos: [], aplicavel: true });
}

// ───────────────────────────── 5 · ELS ─────────────────────────────

interface Direcao {
  s: 'v' | 'h';
  e: 'ev' | 'eh';
  titulo: string;
  bmFonte: Expr;       // s_v ou s_h
  bw: Expr[];          // b_w (com o MIN da planilha)
  momento: Expr;       // Mdyei ou M_h: de cálculo, por metro
  ftk: Expr;           // ftk ⊥ (vertical) ou ∥ (horizontal), em kN/cm²
  as1: Expr;
  d: Expr;
  segunda: boolean;    // 2ª barra: só na vertical com 2 barras por furo
}

function secaoDaDirecao(m: Memoria, D: Direcao) {
  const { s, e } = D;
  const id = (base: string) => `${base}_${e}`;
  const t = m.ent('t_bloco', 't');
  const gf = m.ent('gama_f', '\\gamma_f');
  const psi = m.ent('psi_els', '\\psi_{ELS}');
  const hf = m.g('hf_bl', 'h_f', 1, 'cm');
  const n = m.g('n_pn', 'n_p', 2);
  const cp = m.ent('c_pv', 'c_p');
  const bm = m.g(id('bm'), `b_{m,${s}}`, 1, 'cm');
  const bw = m.g(id('bw'), `b_{w,${s}}`, 2, 'cm');
  const Ma = m.g(id('Ma'), `M_{a,${s}}`, 1, 'kN·cm');
  const Im = m.g(id('Im'), `I_{m,${s}}`, 0, 'cm⁴');
  const Mr = m.g(id('Mr'), `M_{r,${s}}`, 1, 'kN·cm');
  const x = m.g(id('x'), `x_{II,${s}}`, 2, 'cm');
  const III = m.g(id('III'), `I_{II,${s}}`, 0, 'cm⁴');
  const Ieq = m.g(id('Ieq'), `I_{eq,${s}}`, 0, 'cm⁴');
  const c = m.valor('c_pv') ?? 0;

  // 2ª barra tracionada (entra com n) enquanto x ≤ d' = c; se a LN passar dela, comprimida (n − 1)
  const as2 = D.segunda && (m.valor('a_pv') ?? 0) !== 0;        // IF(nb_pv=2;a_pv;0) = 0 → OR(As2=0;...) verdadeiro
  const x1 = m.valor(id('x1'));
  const tracionada = !as2 || (x1 !== null && x1 <= c);
  const secaoI = (n2: Expr): SecaoI => ({ bm, bw, hf, n, as1: D.as1, d: D.d, ...(as2 ? { b2: { as2: D.as1, n2, dl: cp } } : {}) });
  const xv = m.valor(id('x'));
  const n2III = xv !== null && xv <= c ? n : sub(n, cte(1, 0));  // n2 = IF(x ≤ c; n; n − 1)
  const naMesa = xv !== null && xv <= (m.valor('hf_bl') ?? 0);
  const MaV = m.valor(id('Ma')), MrV = m.valor(id('Mr'));
  const estadioI = MaV !== null && MrV !== null && MaV <= MrV;
  const r3 = pot(par(div(Mr, Ma)), 3);
  const branson = soma(mul(r3, Im), mul(par(sub(cte(1, 0), r3)), III));

  return secao(D.titulo, [
    m.passo(id('bm'), `b_{m,${s}}`, D.bmFonte, { casas: 1, unidade: 'cm' }),
    m.passo(id('bw'), `b_{w,${s}}`, D.bw, { casas: 2, unidade: 'cm' }),
    m.passo(id('Ma'), `M_{a,${s}}`, mul(psi, div(D.momento, gf), div(bm, cte(100, 0))), { casas: 1, unidade: 'kN·cm', ref: NBR('9.2.3') }),
    m.passo(id('Im'), `I_{m,${s}}`, sub(
      div(mul(bm, pot(t, 3)), cte(12, 0)),
      div(mul(par(sub(bm, bw)), pot(sub(t, mul(cte(2, 0), hf)), 3)), cte(12, 0)),
    ), { casas: 0, unidade: 'cm⁴' }),
    m.passo(id('Mr'), `M_{r,${s}}`, div(mul(D.ftk, Im), mul(cte(0.5, 1), t)), { casas: 1, unidade: 'kN·cm', ref: NBR('9.2.3') }),
    !tracionada && m.passo(id('x1'), `x_{1,${s}}`, linhaNeutraEscolhida(m, secaoI(n)), { casas: 3, unidade: 'cm' }),
    m.passo(id('x'), `x_{II,${s}}`, linhaNeutraEscolhida(m, secaoI(tracionada ? n : sub(n, cte(1, 0)))), { casas: 2, unidade: 'cm' }),
    m.passo(id('III'), `I_{II,${s}}`, inerciaII(secaoI(n2III), x, naMesa), { casas: 0, unidade: 'cm⁴' }),
    m.passo(id('Ieq'), `I_{eq,${s}}`, estadioI ? Im : [branson, min(Im, branson)], { casas: 0, unidade: 'cm⁴', ref: NBR('9.2.3') }),
    m.passo(id('heq'), `h_{eq,${s}}`, cbrt(div(mul(cte(12, 0), Ieq), bm)), { casas: 2, unidade: 'cm', ref: AULA }),
  ], { fonte: 'Curso', item: 'planilha 06' });
}

function cardEls(m: Memoria): Card {
  const temUni = (m.valor('p_uni') ?? 0) !== 0;
  const t = m.ent('t_bloco', 't');
  const psi = m.ent('psi_els', '\\psi_{ELS}');
  const hf = m.g('hf_bl', 'h_f', 1, 'cm');
  const Em = m.g('Em_pn', 'E_{m,p}', 0, 'MPa');
  const lref = m.g('lref_p', '\\ell_{ref}', 2, 'm');
  const pTri = m.g('p_tri', 'p_{tri}', 2, 'kPa');
  const pUni = m.g('p_uni', 'p_{uni}', 2, 'kPa');

  const material = secao('Alvenaria do painel', [
    m.passo('Em_pn', 'E_{m,p}', mul(m.g('Em_coef', 'k_E', 0), m.g('fpk_pn', 'f_{pk,p}', 2, 'MPa')), {
      casas: 0, unidade: 'MPa', ref: NBR('6.2.1, Tab. 1'),
    }),
    m.passo('n_pn', 'n_p', div(cte(210000, 0), Em), { casas: 2 }),
  ]);

  // alma da seção I vertical: informada, ou furo grauteado + septos ((L − 3hf)/2 + 2hf); nunca maior que a faixa
  const bmV = m.g('bm_ev', 'b_{m,v}', 1, 'cm');
  const almaV = m.num('bwv_dir') !== null
    ? m.ent('bwv_dir', 'b_{w,inf}')
    : soma(div(sub(m.g('L_bloco', 'L_{bloco}', 0, 'cm'), mul(cte(3, 0), hf)), cte(2, 0)), mul(cte(2, 0), hf));
  const bmH = m.g('bm_eh', 'b_{m,h}', 1, 'cm');
  const almaH = m.ent('bwh_els', 'h_{can}');
  // graute a cada X (13/10): todos os furos → seção cheia (bw = bm); senão s_v/X almas na faixa vertical
  const cheia = m.texto('gr_tot') === 'Sim';
  const nAlmV = m.num('n_alm_v') ?? 1;
  const almaVn = nAlmV > 1 ? mul(m.g('n_alm_v', 'n_{alm}', 0), almaV) : almaV;

  const vertical = secaoDaDirecao(m, {
    s: 'v', e: 'ev',
    titulo: 'Seção I vertical (faixa s_v)',
    bmFonte: m.g('s_pv', 's_v', 0, 'cm'),
    bw: cheia ? [bmV] : [almaVn, min(bmV, almaVn)],
    momento: m.g('Mdyei_p', 'M_{dyei}', 1, 'kN·cm/m'),
    ftk: m.g('ftk_nor', 'f_{tk,\\perp}', 3, 'kN/cm²', { fator: 0.1 }),
    as1: m.g('a_pv', 'a_{s,v}', 3, 'cm²'),
    d: m.g('d_pv', 'd_v', 1, 'cm'),
    segunda: (m.num('nb_pv') ?? 0) === 2,
  });
  const horizontal = secaoDaDirecao(m, {
    s: 'h', e: 'eh',
    titulo: 'Seção I horizontal (faixa s_h)',
    bmFonte: m.g('s_ph', 's_h', 0, 'cm'),
    bw: cheia ? [bmH] : [almaH, min(bmH, almaH)],
    momento: m.g('M_ph', 'M_h', 1, 'kN·cm/m'),
    ftk: m.g('ftk_par', 'f_{tk,\\parallel}', 3, 'kN/cm²', { fator: 0.1 }),
    as1: m.g('a_ph', 'a_{s,h}', 3, 'cm²'),
    d: m.g('d_ph', 'd_h', 1, 'cm'),
    segunda: false,
  });

  // ── flecha pela tabela de Libânio: a = α/100 · p·l⁴/(E·t³), com t = h_eq de cada direção ──
  const cargaAlfa = (rotulo: string, tri: string, uni: string) => {
    const aT = nome(celulaDoRotulo(rotulo, 'B'), tri, 4);
    return temUni ? par(soma(mul(aT, pTri), mul(nome(celulaDoRotulo(rotulo, 'C'), uni, 4), pUni))) : mul(aT, pTri);
  };
  const pA = m.g('ap_c', 'p_{\\alpha}', 2, 'kN/m²');
  const pAB = m.g('apB_c', 'p_{\\alpha B}', 2, 'kN/m²');
  // E em MPa e h_eq em m: p·l⁴/(100·E·h³) sai direto em mm (a planilha escreve ×1000 em cima e embaixo)
  const flecha = (p: Expr, heq: 'heq_ev' | 'heq_eh', s: 'v' | 'h') =>
    div(mul(p, pot(lref, 4)), mul(cte(100, 0), Em, pot(m.g(heq, `h_{eq,${s}}`, 4, 'm', { fator: 0.01 }), 3)));
  const deltas: [string, string, Expr][] = [
    ['d0_ev', '\\delta_{0,v}', flecha(pA, 'heq_ev', 'v')],
    ['db0_ev', '\\delta_{0B,v}', flecha(pAB, 'heq_ev', 'v')],
    ['d0_eh', '\\delta_{0,h}', flecha(pA, 'heq_eh', 'h')],
    ['db0_eh', '\\delta_{0B,h}', flecha(pAB, 'heq_eh', 'h')],
  ];
  // MAX(d0_ev; db0_ev; d0_eh; db0_eh): o Excel pula a direção que ficou em "—"
  const comNumero = deltas.filter(([id]) => m.valor(id) !== null);
  const pior = comNumero.map(([id, s]) => m.g(id, s, 2, 'mm'));
  const umMaisXi = par(soma(cte(1, 0), m.ent('dxi', '\\Delta\\xi')));

  const secFlecha = secao('Flecha (vale a direção mais crítica)', [
    m.passo('ap_c', 'p_{\\alpha}', mul(psi, cargaAlfa('α', '\\alpha', '\\alpha_u')), { casas: 2, unidade: 'kN/m²' }),
    m.passo('apB_c', 'p_{\\alpha B}', mul(psi, cargaAlfa('αB', '\\alpha_B', '\\alpha_{B,u}')), { casas: 2, unidade: 'kN/m²' }),
    ...comNumero.map(([id, s, e]) => m.passo(id, s, e, { casas: 2, unidade: 'mm' })),
    m.passo('dadm_p', '\\delta_{adm,p}', div(m.g('lref_p', '\\ell_{ref}', 0, 'mm', { fator: 1000 }), m.ent('div_adm', 'n_{adm}')), {
      casas: 2, unidade: 'mm', ref: AULA,
    }),
    m.passo('dinf_p', '\\delta_{\\infty,p}', pior.length === 0 ? null : mul(umMaisXi, pior.length === 1 ? pior[0] : max(...pior)), {
      casas: 2, unidade: 'mm', origem: 'calculado', ref: NBR('9.2.4'),
      verif: {
        chave: 'painelCf.els.flecha', rotulo: 'Flecha do painel δ∞ ≤ δadm', limite: m.g('dadm_p', '\\delta_{adm,p}', 2, 'mm'),
        relacao: '<=', celula: celulaDoRotulo('Painel: ELS δ∞ ≤ δadm'),
      },
    }),
  ], LIBANIO);

  // ── ábaco simplificado da NBR (borda superior livre; engaste da base tomado como apoio) ──
  const lt = m.valor('lt_ab');
  const temLimite = m.valor('htl_ab') !== null;                     // "fora do ábaco" (l/t > 120): sem limite
  const ltF = m.g('lt_ab', '\\ell_{cf}/t', 1);
  const limiteAbaco: Expr | null = lt === null || lt <= 40
    ? null
    : lt <= 55
      ? sub(cte(60, 0), div(mul(par(sub(ltF, cte(40, 0))), cte(40, 0)), cte(15, 0)))
      : sub(cte(20, 0), div(mul(par(sub(ltF, cte(55, 0))), cte(5, 0)), cte(65, 0)));
  const abaco = secao('Ábaco simplificado', [
    m.passo('lt_ab', '\\ell_{cf}/t', div(m.g('l_cf_adot', '\\ell_{cf}', 0, 'cm', { fator: 100 }), t), { casas: 1 }),
    temLimite && m.passo('htl_ab', '(h/t)_{lim}', limiteAbaco, { casas: 1, origem: limiteAbaco ? 'calculado' : 'tabela' }),
    m.passo('ht_ab', 'h/t', div(m.ent('H_muro', 'h_{muro}', { fator: 100, casas: 0, unidade: 'cm' }), t), {
      casas: 1,
      // indicativo (aplicavel: false, fora do veredito): reprovado no ábaco, vale a flecha calculada acima
      verif: temLimite ? {
        chave: 'painelCf.els.abaco', rotulo: 'Ábaco NBR: h/t ≤ (h/t)lim', limite: m.g('htl_ab', '(h/t)_{lim}', 1), relacao: '<=',
        celula: celulaDoRotulo('Painel: ábaco simplificado da NBR'), aplicavel: false,
      } : undefined,
    }),
  ], NBR('E.5.1, Fig. E.1'));

  const desenhoDoPainel = desenhoDasSecoesDoPainel(m.r);
  return limpo({
    id: 'painelCf.els',
    titulo: 'Painel · ELS',
    ref: AULA,
    figura: 'Fig. 13',
    // as duas seções I desenhadas e cotadas, com os números das mesmas células (Jose, 12/10)
    ...(desenhoDoPainel ? { desenho: desenhoDoPainel } : {}),
    secoes: [material, vertical, horizontal, secFlecha, abaco],
    avisos: [],
    aplicavel: true,
  });
}

const CARDS: [string, string, string][] = [
  ['painelCf.momentos', 'Painel · momentos (Libânio)', 'Fig. 13'],
  ['painelCf.flexaoVertical', 'Painel · flexão vertical', 'Fig. 14'],
  ['painelCf.flexaoHorizontal', 'Painel · flexão horizontal', 'Fig. 14'],
  ['painelCf.naoArmado', 'Painel · alvenaria não armada', 'Fig. 5'],
  ['painelCf.els', 'Painel · ELS', 'Fig. 13'],
];

/** Painel entre contrafortes: só com Tipo_muro = Contrafortes (no balanço a aba calcula, mas o muro não tem painel). */
export const autorPainelCf: AutorDeCards = (r) => {
  const m = memoriaDe(r);
  if (m.texto('Tipo_muro') !== 'Contrafortes') return CARDS.map(([id, titulo, figura]) => vazio(id, titulo, figura));
  return [cardMomentos(m), cardVertical(m), cardHorizontal(m), cardNaoArmado(m), cardEls(m)];
};
