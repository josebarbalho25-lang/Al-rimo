/*
  CARDS — Fundação — DIMENSIONAMENTO da sapata corrida pela NBR 6118: flexão da ponta e do talão, armadura de flexão,
  cortante sem estribo e torção (só com contrafortes). A estabilidade (cargas, tombamento, deslizamento, tensões no
  solo) é de ./estabilidade.ts e vem antes, na mesma aba.

  A conta é a de tools/fundacao.py, seções 7 e 8 e a memória das fatias no fim da aba. Três escolhas de narração:
  - O momento e o cortante na face do muro saem de 20 FATIAS (a planilha integra a pressão do solo assim). A soma
    das fatias é o número publicado; uma conta fechada só coincidiria até a 4ª casa (regra do ponto médio). Para a
    soma não ser caixa-preta, o card abre a fatia 1 inteira (braço, posição, σ, carga líquida, momento) — a mesma
    conta das outras 19.
  - Unidades: a planilha mistura m, cm, MPa e multiplica por 100, 1000, 10000 dentro da fórmula. A memória troca a
    unidade NA LEITURA da folha (fator), para a linha numérica sair como conta de mão (d em cm, fcd em kN/cm²...).
  - Os IFs da planilha (ISNUMBER na flexão, trapézio × triângulo na pressão, T_sd > 0, he ≥ 2·c1) viram `if` aqui
    com a MESMA condição; célula que a planilha deixou em "—" não entra no card.
  Torção: TSd = Md do contraforte/2 é DEDUÇÃO nossa (modelo simplificado da planilha), marcada como tal.
*/
import dados from '@/motor/planilha.gerada.json';
import type { PlanilhaExportada } from '@/motor/tipos';
import type { AutorDeCards, Card, Expr, Passo, Ref } from '../tipos';
import { arredBaixo, arredCima, avaliar, cte, div, max, min, mul, nome, par, pi, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao } from '../passo';
import type { Memoria } from '../passo';
import { desenhoDaFlexaoDaSapata, desenhoDoCortanteDaSapata } from '../desenhoDaSapata';

/*
  Dono único dos símbolos da aba Fundação que os dois grupos desenham (B, h_s, a, b_t, b_p, γ_c, B_c, σmáx, σmín):
  combinado com cards/estabilidade.ts, que usa a mesma régua (nome → símbolo · casas) e não os descreve.
*/
export const SIMBOLOS_SAPATA: Readonly<Record<string, string>> = {
  // ── materiais e geometria da sapata ──
  'f_{ck}': 'resistência característica do concreto da sapata à compressão',
  'f_{cd}': 'resistência de cálculo do concreto da sapata à compressão',
  'f_{ctd}': 'resistência de cálculo do concreto da sapata à tração',
  // f_{yk} e \gamma_s (o mesmo aço do muro): descritos em SIMBOLOS_BALANCO
  '\\gamma_c': 'peso específico do concreto da sapata',
  B: 'largura da sapata corrida',
  h_s: 'altura da sapata',
  c_s: 'cobrimento da armadura da sapata',
  '\\phi_s': 'diâmetro da armadura principal (transversal) da sapata',
  '\\phi_{s2}': 'diâmetro da armadura secundária (longitudinal) da sapata',
  '\\phi_t': 'diâmetro do estribo de torção da sapata',
  d_s: 'altura útil da sapata',
  a: 'distância da borda aterrada ao eixo do muro',
  b_p: 'ponta: largura da sapata para fora, livre do muro',
  b_t: 'talão: largura da sapata sob o aterro, livre do muro',
  // ── pressão do solo nas fatias ──
  '\\sigma_{m\\acute{a}x}': 'tensão máxima no solo sob a sapata',
  '\\sigma_{m\\acute{\\imath}n}': 'tensão mínima no solo sob a sapata',
  B_c: 'largura comprimida da base (diagrama triangular)',
  'a_{p,1}': 'braço da fatia 1 da ponta até a face do muro',
  'a_{t,1}': 'braço da fatia 1 do talão até a face do muro',
  '\\bar{x}_{p,1}': 'abscissa do centro da fatia 1 da ponta, a partir da borda aterrada',
  '\\bar{x}_{t,1}': 'abscissa do centro da fatia 1 do talão, a partir da borda aterrada',
  '\\sigma_{p,1}': 'tensão do solo sob o centro da fatia 1 da ponta',
  '\\sigma_{t,1}': 'tensão do solo sob o centro da fatia 1 do talão',
  'q_{p,1}': 'carga líquida para cima na fatia 1 da ponta',
  'q_{t,1}': 'carga líquida para baixo na fatia 1 do talão',
  'M_{p,1}': 'momento da fatia 1 da ponta na face do muro, por metro',
  'M_{t,1}': 'momento da fatia 1 do talão na face do muro, por metro',
  'M_{p,i}': 'momento da fatia i da ponta na face do muro, por metro',
  'M_{t,i}': 'momento da fatia i do talão na face do muro, por metro',
  // ── flexão ──
  'M_{k,p}': 'momento característico da ponta na face do muro, por metro',
  'M_{k,t}': 'momento característico do talão na face do muro, por metro',
  'M_{d,p}': 'momento de cálculo da ponta na face do muro, por metro',
  'M_{d,t}': 'momento de cálculo do talão na face do muro, por metro',
  x_p: 'profundidade da linha neutra na flexão da ponta',
  x_t: 'profundidade da linha neutra na flexão do talão',
  'A_{s,p}': 'armadura de flexão necessária da ponta, por metro',
  'A_{s,t}': 'armadura de flexão necessária do talão, por metro',
  'A_{s,m\\acute{\\imath}n}': 'armadura mínima de flexão da sapata, por metro',
  'A_{s,princ}': 'armadura principal (transversal) da sapata, por metro',
  's_{princ}': 'espaçamento da armadura principal da sapata',
  'A_{s,sec}': 'armadura secundária (longitudinal) da sapata, por metro',
  's_{sec}': 'espaçamento da armadura secundária da sapata',
  // ── cortante ──
  k: 'coeficiente de altura útil do cortante sem estribo',
  '\\rho_1': 'taxa de armadura longitudinal de tração da sapata',
  'V_{Rd1}': 'cortante resistente de cálculo sem estribo da sapata, por metro',
  'V_{Sd,p}': 'cortante de cálculo da ponta a d da face do muro, por metro',
  'V_{Sd,t}': 'cortante de cálculo do talão a d da face do muro, por metro',
  'V_{p,i}': 'carga da fatia i da ponta além de d da face (zero até d)',
  'V_{t,i}': 'carga da fatia i do talão além de d da face (zero até d)',
  // ── torção ──
  // M_{d,cf}: descrito em SIMBOLOS_CONTRAFORTE (o card do contraforte publica a célula)
  'T_{Sd}': 'momento torçor de cálculo na sapata, junto ao contraforte',
  'A/u': 'relação área/perímetro da seção cheia da sapata (B × h)',
  c_1: 'distância da face ao eixo da barra longitudinal de canto',
  'h_{e,s}': 'espessura equivalente da seção vazada (torção da sapata)',
  A_e: 'área limitada pela linha média da seção vazada equivalente',
  u_e: 'perímetro da linha média da seção vazada equivalente',
  'T_{Rd2}': 'momento torçor resistente das diagonais comprimidas',
  'A_{90}/s': 'estribo de torção por metro, por ramo',
  '(A_{90}/s)_{m\\acute{\\imath}n}': 'estribo mínimo de torção por metro, por ramo (b_w = 2·he)',
  s_t: 'espaçamento do estribo de torção',
  'A_{sl}': 'armadura longitudinal de torção, total no perímetro',
  // ── esperas: dobra do pé na sapata (aba Fundação, seção 10) ──
  '\\phi_{cc}': 'diâmetro das barras construtivas do contraforte',
  'h_{dob}': 'altura de sapata que a dobra da espera da barra vertical pede',
  'h_{dob,v}': 'altura de sapata que a dobra da espera do painel pede',
  'h_{dob,cf}': 'altura de sapata que a dobra da espera do contraforte pede',
  'h_{dob,cc}': 'altura de sapata que a dobra da espera das construtivas pede',
  // ── traspasse espera × barra, no graute (aba Fundação, seção 10 — Jose, 13/10) ──
  'f_{bd}': 'resistência de aderência de cálculo da barra no graute',
  '\\ell_{b,gr}/\\phi': 'comprimento de ancoragem reto no graute, em diâmetros',
  '\\ell_{b,c}/\\phi': 'comprimento de ancoragem reto no concreto da sapata, em diâmetros',
  '\\alpha_{0t}': 'coeficiente da proporção de barras emendadas na mesma seção',
  r_v: 'As,nec/As,ef da barra vertical do painel (a face que pede mais)',
  'r_{cf}': 'As,nec/As,ef da armadura principal do contraforte',
  '\\ell_{0t}': 'traspasse da espera com a barra vertical, acima da sapata',
  '\\ell_{0t,v}': 'traspasse da espera com a barra vertical do painel',
  '\\ell_{0t,cf}': 'traspasse da espera com a principal do contraforte',
  '\\ell_{0t,cc}': 'traspasse da espera com as construtivas do contraforte',
};

const ABA = 'Fundação';
const P = dados as unknown as PlanilhaExportada;

const NBR = (item?: string): Ref => (item ? { fonte: 'NBR 6118', item } : { fonte: 'NBR 6118' });
const GILBERTO: Ref = { fonte: 'Gilberto' };
const DEDUCAO: Ref = { fonte: 'Dedução' };

// O expoente de fct,m = 0,3·fck^(2/3) escrito "2/3" nas duas linhas, como na norma; vale 2/3, como na planilha.
const DOIS_TERCOS: Expr = { k: 'num', v: 2 / 3, casas: 3, tex: '2/3' };

/*
  Endereços tirados da PRÓPRIA planilha exportada, não digitados: as fatias pelo intervalo nomeado (T_dM...) e os
  vereditos pelo rótulo da coluna A. Se o gerador mudar uma linha de lugar, o card acompanha.
*/
function faixa(nomeDoIntervalo: string): { aba: string; col: string; l0: number; l1: number } {
  const ref = P.nomes[nomeDoIntervalo];
  const m = ref ? /^(.+)!\$?([A-Z]+)\$?(\d+):\$?[A-Z]+\$?(\d+)$/.exec(ref) : null;
  if (!m) throw new Error(`intervalo nomeado inexistente: ${nomeDoIntervalo}`);
  return { aba: m[1], col: m[2], l0: Number(m[3]), l1: Number(m[4]) };
}

const intervalo = (n: string) => {
  const f = faixa(n);
  return `${f.aba}!${f.col}${f.l0}:${f.col}${f.l1}`;
};

const PELO_ROTULO = new Map<string, string>();
function celulaDoRotulo(rotulo: string): string {
  const achada = PELO_ROTULO.get(rotulo);
  if (achada) return achada;
  const prefixo = `${ABA}!A`;
  for (const [k, v] of Object.entries(P.celulas)) {
    if (v === rotulo && k.startsWith(prefixo)) {
      const c = `${ABA}!B${k.slice(prefixo.length)}`;
      PELO_ROTULO.set(rotulo, c);
      return c;
    }
  }
  throw new Error(`rótulo não encontrado na aba ${ABA}: ${rotulo}`);
}

/** Ponta e talão: a mesma conta, nomes diferentes. */
interface Lado {
  i: 'p' | 't';
  largura: string; // 'toe' | 'heel'
  dM: string;      // intervalo dos momentos das fatias
  dV: string;      // intervalo das cargas além de d
  Mk: string;
  Md: string;
  x: string;
  As: string;
  Vsd: string;
}
const PONTA: Lado = { i: 'p', largura: 'toe', dM: 'T_dM', dV: 'T_dV', Mk: 'Mk_toe', Md: 'Md_ts', x: 'x_ts', As: 'As_ts', Vsd: 'Vsd_t' };
const TALAO: Lado = { i: 't', largura: 'heel', dM: 'H_dM', dV: 'H_dV', Mk: 'Mk_heel', Md: 'Md_hs', x: 'x_hs', As: 'As_hs', Vsd: 'Vsd_h' };

/**
  As folhas das contas, num lugar só: o mesmo nome definido desenha sempre o mesmo símbolo, com as mesmas casas
  (o teste da régua cobra). Folha com `fator` é a mesma célula lida em outra unidade.
*/
function folhas(m: Memoria) {
  return {
    // entradas
    B: m.ent('B_sap', 'B'),
    Bcm: m.ent('B_sap', 'B', { fator: 100, casas: 0, unidade: 'cm' }),
    hS: m.ent('h_sap', 'h_s'),
    hScm: m.ent('h_sap', 'h_s', { fator: 100, casas: 1, unidade: 'cm' }),
    cS: m.ent('cob_sap', 'c_s'),
    cSm: m.ent('cob_sap', 'c_s', { fator: 0.01, casas: 3, unidade: 'm' }),
    phi: m.ent('phi_sap', '\\phi_s', { fator: 0.1, casas: 2, unidade: 'cm' }),
    phiM: m.ent('phi_sap', '\\phi_s', { fator: 0.001, casas: 4, unidade: 'm' }),
    phi2: m.ent('phi_sap2', '\\phi_{s2}', { fator: 0.1, casas: 2, unidade: 'cm' }),
    phiT: m.ent('phi_tor', '\\phi_t', { fator: 0.1, casas: 2, unidade: 'cm' }),
    phiTm: m.ent('phi_tor', '\\phi_t', { fator: 0.001, casas: 4, unidade: 'm' }),
    a: m.ent('a_ater', 'a'),
    t: m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' }), // a planilha guarda t em cm
    gc: m.ent('gama_c', '\\gamma_c'),
    gama: m.ent('gama_solo', '\\gamma'),
    H: m.ent('H_solo', 'h_{solo}'),          // terra sobre o talão: altura de solo
    q: m.ent('q_sobre', 'q'),
    fyk: m.ent('fyk_', 'f_{yk}'),
    fykKN: m.ent('fyk_', 'f_{yk}', { fator: 0.1, casas: 1, unidade: 'kN/cm²' }),
    gs: m.ent('gama_s', '\\gamma_s'),
    // estabilidade (seção 6 da aba)
    sMax: m.g('s_hi', '\\sigma_{m\\acute{a}x}', 1, 'kPa'),
    sMin: m.g('s_lo', '\\sigma_{m\\acute{\\imath}n}', 1, 'kPa'),
    Bc: m.g('c_len', 'B_c', 3, 'm'),
    // calculadas aqui
    fck: m.g('fck_s', 'f_{ck}', 0, 'MPa'),
    fcd: m.g('fcd_s', 'f_{cd}', 2, 'MPa'),
    fcdKNcm: m.g('fcd_s', 'f_{cd}', 3, 'kN/cm²', { fator: 0.1 }),
    fcdKNm: m.g('fcd_s', 'f_{cd}', 0, 'kN/m²', { fator: 1000 }),
    fctdKNm: m.g('fctd_s', 'f_{ctd}', 0, 'kN/m²', { fator: 1000 }),
    d: m.g('d_s', 'd_s', 2, 'cm'),
    dM: m.g('d_s', 'd_s', 4, 'm', { fator: 0.01 }),
    AsMin: m.g('As_ms', 'A_{s,m\\acute{\\imath}n}', 2, 'cm²/m'),
    AsPrinc: m.g('As_ps', 'A_{s,princ}', 2, 'cm²/m'),
    AsSec: m.g('As_ss', 'A_{s,sec}', 2, 'cm²/m'),
    k: m.g('k_s', 'k', 3),
    rho: m.g('rho_s', '\\rho_1', 4),
    VRd1: m.g('VRd1_s', 'V_{Rd1}', 2, 'kN/m'),
    MdCf: m.g('Md_cf', 'M_{d,cf}', 2, 'kN·m'),
    T: m.g('T_sd', 'T_{Sd}', 2, 'kN·m'),
    Au: m.g('Au_s', 'A/u', 3, 'm'),
    c1: m.g('c_eixo_s', 'c_1', 3, 'm'),
    he: m.g('he_s', 'h_{e,s}', 3, 'm'),
    Ae: m.g('Ae_s', 'A_e', 4, 'm²'),
    ue: m.g('ue_s', 'u_e', 3, 'm'),
    TRd2: m.g('TRd2_s', 'T_{Rd2}', 2, 'kN·m'),
    A90: m.g('A90_s', 'A_{90}/s', 2, 'cm²/m'),
  };
}
type Folhas = ReturnType<typeof folhas>;

/** Célula com número (a planilha não deixou "—", "não resiste" nem erro): só ela entra com conta. */
const temNumero = (m: Memoria, id: string) => m.valor(id) !== null;

/** 1,4·M quando M ≥ 0; o "máx(0; M)" da planilha só aparece quando ele decide (M negativo). */
const majorado = (m: Memoria, id: string, folha: Expr): Expr =>
  (m.valor(id) ?? 0) < 0 ? mul(cte(1.4, 1), max(cte(0, 0), folha)) : mul(cte(1.4, 1), folha);

/** ⌊100·π·Ø²/(4·As)⌋: espaçamento (cm) que dá a área As (cm²/m) com a barra Ø (cm) — o ROUNDDOWN da planilha. */
const espacamento = (phi: Expr, as: Expr): Expr =>
  arredBaixo(div(mul(cte(100, 0), pi(), pot(phi, 2)), mul(cte(4, 0), as)));

// ───────────────────────────── fatia 1 (ponta ou talão) ─────────────────────────────

/*
  A fatia 1 por inteiro — a mesma conta das outras 19, só que com números. Ponta: fatia 1 encostada na face do
  muro. Talão: fatia 1 na borda aterrada. σ(x) espelha o IF da planilha: trapézio se |e| ≤ B/6, triângulo a partir
  da borda mais comprimida se não; a borda mais comprimida é o pé se e ≥ 0, o talão se e < 0.
*/
function secaoFatia(m: Memoria, f: Folhas, L: Lado) {
  const fx = faixa(L.dM);
  const cel = (col: string) => `${fx.aba}!${col}${fx.l0}`;
  const [cX, cS, cQ, cA, cM] = ['B', 'C', 'D', 'E', 'F'].map(cel);
  const largura = m.num(L.largura) ?? 0;
  const e = m.num('e_f');
  const Bv = m.num('B_sap');
  // balanço de largura zero (sapata toda de um lado) não tem fatia a mostrar; célula sem número também não
  if (!(largura > 0) || e === null || Bv === null || ![cX, cS, cQ, cA, cM].every((c) => temNumero(m, c))) return null;

  const i = L.i;
  const b = m.g(L.largura, `b_${i}`, 3, 'm');
  const dx = div(b, cte(20, 0));
  const meio = mul(par(sub(cte(1, 0), cte(0.5, 1))), dx);                // (1 − 0,5)·b/20
  const xbar = nome(cX, `\\bar{x}_{${i},1}`, 3, 'm');
  const braco = nome(cA, `a_{${i},1}`, 3, 'm');
  const sig = nome(cS, `\\sigma_{${i},1}`, 3, 'kPa');
  const qq = nome(cQ, `q_{${i},1}`, 3, 'kPa');

  const meiaEspessura = div(f.t, cte(2, 0));
  const posicao = i === 'p'
    ? [
        m.passo(cA, `a_{p,1}`, meio, { casas: 3, unidade: 'm' }),
        m.passo(cX, `\\bar{x}_{p,1}`, soma(f.a, meiaEspessura, braco), { casas: 3, unidade: 'm' }),
      ]
    : [
        m.passo(cX, `\\bar{x}_{t,1}`, meio, { casas: 3, unidade: 'm' }),
        m.passo(cA, `a_{t,1}`, sub(sub(f.a, meiaEspessura), xbar), { casas: 3, unidade: 'm' }),
      ];

  const dist = e >= 0 ? sub(f.B, xbar) : xbar;                          // IF(e_f>=0; B − x; x)
  const sigma = Math.abs(e) <= Bv / 6
    ? sub(f.sMax, mul(par(sub(f.sMax, f.sMin)), div(dist, f.B)))
    : max(cte(0, 0), mul(f.sMax, par(sub(cte(1, 0), div(dist, f.Bc)))));

  // aterro sobre a ponta (12/10): só com a garantia do solo da frente — IF(pass_on="Sim";γ·h_fr;0)
  const aterro = i === 'p' && m.texto('pass_on') === 'Sim' && (m.num('h_fr') ?? 0) > 0;
  const liquida = i === 'p'
    ? aterro
      ? sub(sub(sig, mul(f.gc, f.hS)), mul(f.gama, m.ent('h_fr', 'h_{fr}')))   // solo empurra; sapata e aterro pesam
      : sub(sig, mul(f.gc, f.hS))                                       // solo empurra para cima, sapata pesa
    : sub(soma(mul(f.gama, f.H), f.q, mul(f.gc, f.hS)), sig);           // solo + sobrecarga + sapata − reação

  return secao('Fatia 1 de 20', [
    ...posicao,
    m.passo(cS, `\\sigma_{${i},1}`, sigma, { casas: 3, unidade: 'kPa' }),
    m.passo(cQ, `q_{${i},1}`, liquida, { casas: 3, unidade: 'kPa' }),
    m.passo(cM, `M_{${i},1}`, mul(qq, dx, braco), { casas: 3, unidade: 'kN·m/m' }),
  ], GILBERTO);
}

// ───────────────────────────── flexão ─────────────────────────────

function secaoMateriais(m: Memoria, f: Folhas) {
  return secao('Materiais e altura útil', [
    temNumero(m, 'fck_s') && m.passo('fck_s', 'f_{ck}', null, { casas: 0, unidade: 'MPa', origem: 'entrada' }),
    m.entrada('fyk_', 'f_{yk}'),
    m.entrada('gama_s', '\\gamma_s'),
    m.entrada('h_sap', 'h_s'),
    m.entrada('cob_sap', 'c_s'),
    m.entrada('phi_sap', '\\phi_s'),
    temNumero(m, 'fcd_s') && m.passo('fcd_s', 'f_{cd}', div(f.fck, cte(1.4, 1)), { casas: 2, unidade: 'MPa', ref: NBR('12.3.3') }),
    temNumero(m, 'd_s') && m.passo('d_s', 'd_s', sub(sub(f.hScm, f.cS), div(f.phi, cte(2, 0))), { casas: 2, unidade: 'cm' }),
  ], NBR());
}

function cardFlexao(r: Parameters<AutorDeCards>[0], L: Lado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const i = L.i;
  const Mk = m.g(L.Mk, `M_{k,${i}}`, 2, 'kN·m/m');
  const Md = m.g(L.Md, `M_{d,${i}}`, 1, 'kN·cm/m', { fator: 100 });
  const x = m.g(L.x, `x_${i}`, 2, 'cm');

  // Bloco retangular 0,8x com 0,85fcd, faixa b = 100 cm: x = 1,25d[1 − √(1 − Md/(0,425·b·d²·fcd))]
  const xExpr = mul(cte(1.25, 2), f.d, par(sub(cte(1, 0), raiz(sub(cte(1, 0),
    div(Md, mul(cte(0.425, 3), cte(100, 0), pot(f.d, 2), f.fcdKNcm)))))));
  const asExpr = div(Md, mul(div(f.fykKN, f.gs), par(sub(f.d, mul(cte(0.4, 1), x)))));
  const xResiste = temNumero(m, L.x);                                   // IFERROR(...;"não resiste")

  const momento = secao('Momento na face e armadura', [
    temNumero(m, L.Mk) && m.passo(L.Mk, `M_{k,${i}}`,
      nome(intervalo(L.dM), `\\sum_{i=1}^{20} M_{${i},i}`, 2, 'kN·m/m'), { casas: 2, unidade: 'kN·m/m', ref: GILBERTO }),
    temNumero(m, L.Md) && m.passo(L.Md, `M_{d,${i}}`, majorado(m, L.Mk, Mk), { casas: 2, unidade: 'kN·m/m' }),
    xResiste
      ? m.passo(L.x, `x_${i}`, xExpr, { casas: 2, unidade: 'cm', ref: NBR('17.2.2') })
      : m.valor(L.Md) !== null && m.passo(L.x, `x_${i}`, null, { casas: 2, unidade: 'cm', origem: 'calculado', ref: NBR('17.2.2') }),
    xResiste && temNumero(m, L.As) && m.passo(L.As, `A_{s,${i}}`, asExpr, { casas: 2, unidade: 'cm²/m', ref: NBR('17.2.2') }),
  ], NBR());

  // o balanço desenhado com as fatias (Jose, 13/10: "quanto mais lúdico, melhor"), antes da fatia 1 aberta
  const fatia = secaoFatia(m, f, L);
  const des = desenhoDaFlexaoDaSapata(r, i === 'p' ? 'ponta' : 'talao');
  if (des) (fatia ?? momento).desenho = des;

  return {
    id: `sapata.flexao.${i === 'p' ? 'ponta' : 'talao'}`,
    titulo: `Sapata · flexão ${i === 'p' ? 'da ponta' : 'do talão'}`,
    ref: NBR(),
    secoes: [i === 'p' && secaoMateriais(m, f), fatia, momento].filter((s) => !!s && s.passos.length > 0) as Card['secoes'],
    avisos: [],
    aplicavel: true,
  };
}

// ───────────────────────────── armadura de flexão ─────────────────────────────

function cardArmadura(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  // MAX(IF(ISNUMBER(As_ts);As_ts;0); IF(ISNUMBER(As_hs);As_hs;0); As_ms): o lado que "não resiste" sai do máximo
  // (o zero no lugar dele nunca decide, As,mín ≥ 0)
  const partes = [
    temNumero(m, 'As_ts') && m.g('As_ts', 'A_{s,p}', 2, 'cm²/m'),
    temNumero(m, 'As_hs') && m.g('As_hs', 'A_{s,t}', 2, 'cm²/m'),
    f.AsMin,
  ].filter((x): x is Expr => !!x);

  const principal = secao('Armadura principal (transversal)', [
    temNumero(m, 'As_ms') && m.passo('As_ms', 'A_{s,m\\acute{\\imath}n}', mul(cte(0.0015, 4), cte(100, 0), f.hScm), {
      casas: 2, unidade: 'cm²/m', ref: NBR('17.3.5.2.1'),
    }),
    temNumero(m, 'As_ps') && m.passo('As_ps', 'A_{s,princ}', partes.length > 1 ? max(...partes) : partes[0], {
      casas: 2, unidade: 'cm²/m',
      verif: { chave: 'sapata.flexao', rotulo: 'Flexão da sapata', limite: null, relacao: '>=', celula: celulaDoRotulo('Flexão da sapata') },
    }),
    m.entrada('phi_sap', '\\phi_s'),
    temNumero(m, 's_ps') && m.passo('s_ps', 's_{princ}',
      min(cte(20, 0), mul(cte(2, 0), f.hScm), espacamento(f.phi, f.AsPrinc)), { casas: 0, unidade: 'cm', ref: NBR('20.1') }),
  ], NBR());

  const secundaria = secao('Armadura secundária (longitudinal)', [
    temNumero(m, 'As_ss') && m.passo('As_ss', 'A_{s,sec}',
      max(cte(0.9, 1), mul(cte(0.2, 1), f.AsPrinc), mul(cte(0.5, 1), f.AsMin)), { casas: 2, unidade: 'cm²/m', ref: NBR('19.3.3.2') }),
    m.entrada('phi_sap2', '\\phi_{s2}'),
    temNumero(m, 's_ss') && m.passo('s_ss', 's_{sec}',
      min(cte(33, 0), espacamento(f.phi2, f.AsSec)), { casas: 0, unidade: 'cm', ref: NBR('20.1') }),
  ], NBR());

  return {
    id: 'sapata.armadura',
    titulo: 'Sapata · armadura de flexão',
    ref: NBR(),
    figura: 'Fig. 18',
    secoes: [principal, secundaria],
    avisos: [],
    aplicavel: true,
  };
}

// ───────────────────────────── cortante ─────────────────────────────

function cardCortante(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const f = folhas(m);

  const resistencia = secao('Cortante resistente sem estribo', [
    temNumero(m, 'fctd_s') && m.passo('fctd_s', 'f_{ctd}',
      div(mul(cte(0.7, 1), cte(0.3, 1), pot(f.fck, DOIS_TERCOS)), cte(1.4, 1)), { casas: 3, unidade: 'MPa', ref: NBR('8.2.5 e 12.3.2') }),
    temNumero(m, 'k_s') && m.passo('k_s', 'k', max(cte(1, 0), sub(cte(1.6, 1), f.dM)), { casas: 3 }),
    temNumero(m, 'rho_s') && m.passo('rho_s', '\\rho_1', min(cte(0.02, 2), div(f.AsPrinc, mul(cte(100, 0), f.d))), { casas: 4 }),
    temNumero(m, 'VRd1_s') && m.passo('VRd1_s', 'V_{Rd1}',
      mul(cte(0.25, 2), f.fctdKNm, f.k, par(soma(cte(1.2, 1), mul(cte(40, 0), f.rho))), f.dM), { casas: 2, unidade: 'kN/m' }),
  ], NBR('19.4.1'));

  const solicitante = (L: Lado) => {
    if (!temNumero(m, L.Vsd)) return null;
    const soma20 = nome(intervalo(L.dV), `\\sum_{i=1}^{20} V_{${L.i},i}`, 2, 'kN/m');
    const somaV = avaliar(soma20, r);
    // 1,4·MAX(0;SUM(dV)): o "máx" só quando decide
    const expr = somaV < 0 ? mul(cte(1.4, 1), max(cte(0, 0), soma20)) : mul(cte(1.4, 1), soma20);
    const vale = temNumero(m, 'VRd1_s');
    return m.passo(L.Vsd, `V_{Sd,${L.i}}`, expr, {
      casas: 2, unidade: 'kN/m', ref: GILBERTO,
      verif: vale
        ? { chave: `sapata.cortante.${L.i === 'p' ? 'ponta' : 'talao'}`, rotulo: `Cortante ${L.i === 'p' ? 'na ponta' : 'no talão'} VSd ≤ VRd1`, limite: f.VRd1, relacao: '<=' }
        : undefined,
    });
  };

  const solicitantes = secao('Cortante de cálculo a d da face', [solicitante(PONTA), solicitante(TALAO)]);
  const desV = desenhoDoCortanteDaSapata(r);
  if (desV) solicitantes.desenho = desV;

  return {
    id: 'sapata.cortante',
    titulo: 'Sapata · cortante',
    ref: NBR('19.4.1'),
    secoes: [resistencia, solicitantes],
    avisos: [],
    aplicavel: true,
  };
}

// ───────────────────────────── torção ─────────────────────────────

function cardTorcao(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const contrafortes = m.texto('Tipo_muro') === 'Contrafortes';     // IF(Tipo_muro="Contrafortes";Md_cf/2;0)
  const T = m.num('T_sd') ?? 0;
  const base = {
    id: 'sapata.torcao',
    titulo: 'Sapata · torção',
    ref: NBR('17.5'),
    figura: 'Fig. 18',
    avisos: [],
    aplicavel: contrafortes,
  };
  if (!contrafortes) return { ...base, secoes: [] };

  const torcor = (comVerif: boolean) => temNumero(m, 'T_sd') && m.passo('T_sd', 'T_{Sd}', div(f.MdCf, cte(2, 0)), {
    casas: 2, unidade: 'kN·m', ref: DEDUCAO,
    verif: comVerif
      ? { chave: 'sapata.torcao', rotulo: 'Torção TSd ≤ TRd2', limite: f.TRd2, relacao: '<=', celula: celulaDoRotulo('Torção: TSd ≤ TRd2') }
      : undefined,
  });

  // T_sd = 0: a planilha zera a armadura (IF(T_sd>0;...;0)) e dá a torção por "— (sem contrafortes)"
  if (!(T > 0)) return { ...base, secoes: [secao('Momento torçor', [torcor(false)], DEDUCAO)] };

  // he = A/u; Ae e ue pela linha média (he ≥ 2·c1) ou pelos eixos das barras de canto (he < 2·c1) — 17.5.1.4.1
  const he = m.num('he_s');
  const c1 = m.num('c_eixo_s');
  const pelaLinhaMedia = he !== null && c1 !== null && he >= 2 * c1;
  const recuo = pelaLinhaMedia ? f.he : mul(cte(2, 0), f.c1);

  const vazada = secao('Seção vazada equivalente', [
    m.entrada('B_sap', 'B'),
    m.entrada('h_sap', 'h_s'),
    m.entrada('cob_sap', 'c_s'),
    m.entrada('phi_sap', '\\phi_s'),
    m.entrada('phi_tor', '\\phi_t'),
    temNumero(m, 'Au_s') && m.passo('Au_s', 'A/u', div(mul(f.B, f.hS), mul(cte(2, 0), par(soma(f.B, f.hS)))), { casas: 3, unidade: 'm' }),
    temNumero(m, 'c_eixo_s') && m.passo('c_eixo_s', 'c_1', soma(f.cSm, f.phiTm, div(f.phiM, cte(2, 0))), { casas: 3, unidade: 'm' }),
    temNumero(m, 'he_s') && m.passo('he_s', 'h_{e,s}', f.Au, {
      casas: 3, unidade: 'm',
      verif: { chave: 'sapata.torcao.he', rotulo: 'Torção: espessura he', limite: null, relacao: '<=', celula: celulaDoRotulo('Torção: espessura equivalente he') },
    }),
    temNumero(m, 'Ae_s') && m.passo('Ae_s', 'A_e', mul(par(sub(f.B, recuo)), par(sub(f.hS, recuo))), { casas: 4, unidade: 'm²' }),
    temNumero(m, 'ue_s') && m.passo('ue_s', 'u_e', mul(cte(2, 0), par(soma(par(sub(f.B, recuo)), par(sub(f.hS, recuo))))), { casas: 3, unidade: 'm' }),
  ], NBR('17.5.1.4.1'));

  const diagonais = secao('Diagonais comprimidas (θ = 45°)', [
    temNumero(m, 'TRd2_s') && m.passo('TRd2_s', 'T_{Rd2}',
      mul(cte(0.5, 1), par(sub(cte(1, 0), div(f.fck, cte(250, 0)))), f.fcdKNm, f.Ae, f.he), { casas: 2, unidade: 'kN·m' }),
  ], NBR('17.5.1.5'));

  const momento = secao('Momento torçor', [torcor(temNumero(m, 'TRd2_s'))], DEDUCAO);

  // f_ywd = f_yk/γs em kN/cm²: com T em kN·m e Ae em m², T/(2·Ae·fywd) já sai em cm²/m (e o Asl em cm²)
  const fywd = div(f.fykKN, f.gs);
  const espT = celulaDoRotulo('Ø do estribo de torção: espaçamento');
  const a90 = m.num('A90_s') ?? 0;
  const a90m = m.num('A90_m') ?? 0;
  const A90m = m.g('A90_m', '(A_{90}/s)_{m\\acute{\\imath}n}', 2, 'cm²/m');
  const armadura = secao('Armadura de torção', [
    temNumero(m, 'A90_s') && m.passo('A90_s', 'A_{90}/s', div(f.T, mul(cte(2, 0), f.Ae, fywd)), { casas: 2, unidade: 'cm²/m', ref: NBR('17.5.1.6') }),
    // bw = 2·he: as duas paredes da seção vazada (Jose, 14/10; dedução) — 2·he (m)·100 cm·100 por metro ÷ 2 ramos
    temNumero(m, 'A90_m') && m.passo('A90_m', '(A_{90}/s)_{m\\acute{\\imath}n}',
      mul(cte(0.2, 1), div(mul(cte(0.3, 1), pot(f.fck, DOIS_TERCOS)), f.fyk), div(mul(cte(2, 0), f.he, cte(100, 0), cte(100, 0)), cte(2, 0))),
      { casas: 2, unidade: 'cm²/m', ref: NBR('17.4.1.1.1') }),
    // MIN(20; ROUNDDOWN(π·Ø²/400/MAX(A90_s; A90_m; 0,0001)·100;0)) — vale o maior entre o cálculo e o mínimo; o piso
    // 0,0001 só aparece quando decide
    temNumero(m, espT) && m.passo(espT, 's_t',
      min(cte(20, 0), espacamento(f.phiT, Math.max(a90, a90m) < 0.0001 ? max(f.A90, A90m, cte(0.0001, 4)) : max(f.A90, A90m))), { casas: 0, unidade: 'cm' }),
    temNumero(m, 'Asl_s') && m.passo('Asl_s', 'A_{sl}', div(mul(f.T, f.ue), mul(cte(2, 0), f.Ae, fywd)), { casas: 2, unidade: 'cm²', ref: NBR('17.5.1.6') }),
  ], NBR('17.5.1.6'));

  return { ...base, secoes: [vazada, diagonais, momento, armadura] };
}

// ───────────────────────────── esperas: dobra do pé ─────────────────────────────

/*
  A dobra do pé da espera tem de caber na sapata (Jose, 09/10: "sapata corrida de 20 cm não comporta nó de cachorro
  com barra de 20 mm"). A conta é a h_dobra do gerador (aba Fundação, seção 10; a mesma que monta a lista dos Ø):
  h_dob = 2·c + φs + φs2 + D + 2φ ≤ h. Só o pino D é da NBR 6118 (Tab. 9.1, CA-50: 5φ com φ < 20 mm, 8φ com φ ≥ 20);
  o cobrimento em cima e embaixo e o pé apoiado nas duas camadas da malha são DEDUÇÃO — por isso a seção leva a
  marca de dedução e o passo, a da tabela. O IF(φ<20;5;8) da planilha vira o `if` do pino aqui.
  Sem verificação com célula de veredito: a célula dob_esp julga a MAIOR das esperas do muro, e cada linha aqui é
  uma espera — a desigualdade de cada uma é a régua dela.
*/
export interface Espera {
  id: string;          // nome da célula da aba Fundação (hdob_v, hdob_pv...)
  simbolo: string;
  phi: Expr;           // Ø da barra, em cm (a folha da entrada com fator 0,1)
  phiMm: number | null;
  chave: string;
  rotulo: string;
}

/** Uma espera: h_dob = 2·c_s + φ_s + φ_s2 + D + 2φ, com h_dob ≤ h_s. null quando a planilha deixou "—". */
export function passoDaDobra(m: Memoria, e: Espera): Passo | null {
  if (m.valor(e.id) === null) return null;
  const pino = (e.phiMm ?? 0) < 20 ? 5 : 8;                      // IF(φ<20;5;8)
  const cS = m.ent('cob_sap', 'c_s');
  const phiS = m.ent('phi_sap', '\\phi_s', { fator: 0.1, casas: 2, unidade: 'cm' });
  const phiS2 = m.ent('phi_sap2', '\\phi_{s2}', { fator: 0.1, casas: 2, unidade: 'cm' });
  const hS = m.ent('h_sap', 'h_s', { fator: 100, casas: 1, unidade: 'cm' });
  return m.passo(e.id, e.simbolo, soma(mul(cte(2, 0), cS), phiS, phiS2, mul(cte(pino, 0), e.phi), mul(cte(2, 0), e.phi)), {
    casas: 2, unidade: 'cm', ref: NBR('Tab. 9.1'),
    verif: { chave: e.chave, rotulo: e.rotulo, limite: hS, relacao: '<=' },
  });
}

/*
  TRASPASSE espera × barra do muro (Jose, 13/10: "NBR 6118: 2,0 × ℓb no graute"; aba Fundação, seção 10). A emenda
  fica dentro do furo grauteado: a aderência é a do graute (fgk no lugar do fck). α0t = 2,0 porque todas as esperas
  emendam na base (Tab. 9.4, mais de 50% na mesma seção). ℓ0t = α0t·ℓb·As,nec/As,ef ≥ máx(0,3·α0t·ℓb; 15φ; 20 cm),
  arredondado para cima ao cm como a planilha (CEILING). Construtiva não tem conta: sem a relação de áreas (vale 1).
  O ℓb no concreto da sapata entra aqui porque usa o mesmo α0t: é o das emendas da armadura longitudinal da sapata.
*/
export interface BarraEmendada {
  id: string;          // nome da célula do traspasse (l0t_v, l0t_pv...)
  simbolo: string;
  phi: Expr;           // Ø em cm
  r: Expr | null;      // As,nec/As,ef (null: construtiva, vale 1)
}

/** O ℓb no graute (fbd e ℓb/φ) e o α0t: os passos comuns a todas as esperas. */
function passosDoLbNoGraute(m: Memoria): Passo[] {
  const fgk = m.g('fgk_', 'f_{gk}', 1, 'MPa');
  const fyd = m.g('fyd_', 'f_{sd}', 1, 'MPa');
  const fbd = m.g('fbd_gr', 'f_{bd}', 3, 'MPa');
  const out: Passo[] = [];
  if (temNumero(m, 'fbd_gr')) {
    out.push(m.passo('fbd_gr', 'f_{bd}', div(mul(cte(2.25, 2), cte(0.21, 2), pot(fgk, DOIS_TERCOS)), cte(1.4, 1)),
      { casas: 3, unidade: 'MPa', ref: NBR('9.3.2.1') }));
  }
  if (temNumero(m, 'lbphi_gr')) {
    out.push(m.passo('lbphi_gr', '\\ell_{b,gr}/\\phi', div(fyd, mul(cte(4, 0), fbd)), { casas: 1, ref: NBR('9.4.2.4') }));
  }
  if (temNumero(m, 'a0t')) out.push(m.passo('a0t', '\\alpha_{0t}', null, { casas: 1, origem: 'tabela', ref: NBR('Tab. 9.4') }));
  return out;
}

/** Uma emenda: ℓ0t = ⌈máx(α0t·ℓb/φ·φ·r; 0,3·α0t·ℓb/φ·φ; 15φ; 20)⌉. null quando a planilha deixou "—". */
export function passoDoTraspasse(m: Memoria, b: BarraEmendada): Passo | null {
  if (m.valor(b.id) === null) return null;
  const a0t = m.g('a0t', '\\alpha_{0t}', 1);
  const lbphi = m.g('lbphi_gr', '\\ell_{b,gr}/\\phi', 1);
  const nec = b.r ? mul(a0t, lbphi, b.phi, b.r) : mul(a0t, lbphi, b.phi);
  return m.passo(b.id, b.simbolo, arredCima(max(nec, mul(cte(0.3, 1), a0t, lbphi, b.phi), mul(cte(15, 0), b.phi), cte(20, 0))),
    { casas: 0, unidade: 'cm', ref: NBR('9.5.2.2.1') });
}

/**
 * A seção do traspasse: o ℓb no graute, as relações de área (antes da emenda que as usa), as emendas e, por último,
 * o ℓb no concreto da sapata. Seção vazia quando nenhuma emenda tem número.
 */
export function secaoDoTraspasse(m: Memoria, barras: BarraEmendada[], relacoes: (Passo | null | false)[] = []) {
  const emendas = barras.map((b) => passoDoTraspasse(m, b));
  const titulo = 'Traspasse espera × barra, no graute';
  if (!emendas.some(Boolean)) return secao(titulo, []);
  const fyd = m.g('fyd_', 'f_{sd}', 1, 'MPa');
  const fctd = m.g('fctd_s', 'f_{ctd}', 3, 'MPa');
  return secao(titulo, [
    ...passosDoLbNoGraute(m),
    ...relacoes,
    ...emendas,
    temNumero(m, 'lbphi_c') && m.passo('lbphi_c', '\\ell_{b,c}/\\phi', div(fyd, mul(cte(4, 0), cte(2.25, 2), fctd)), { casas: 1, ref: NBR('9.4.2.4') }),
  ], NBR('9.5.2.2'));
}

/** Contrafortes: as esperas do painel, do contraforte e das construtivas. (No balanço, a do card de ancoragem.) */
function cardEsperas(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const contrafortes = m.texto('Tipo_muro') === 'Contrafortes';
  const emCm = { fator: 0.1, casas: 2, unidade: 'cm' };
  const passos = contrafortes
    ? [
        passoDaDobra(m, {
          id: 'hdob_pv', simbolo: 'h_{dob,v}', phi: m.ent('phi_pv', '\\phi_v', emCm), phiMm: m.num('phi_pv'),
          chave: 'sapata.espera.painel', rotulo: 'Dobra da espera do painel ≤ altura da sapata',
        }),
        passoDaDobra(m, {
          id: 'hdob_cf', simbolo: 'h_{dob,cf}', phi: m.ent('phi_cf', '\\phi_{cf}', emCm), phiMm: m.num('phi_cf'),
          chave: 'sapata.espera.contraforte', rotulo: 'Dobra da espera do contraforte ≤ altura da sapata',
        }),
        passoDaDobra(m, {
          id: 'hdob_cc', simbolo: 'h_{dob,cc}', phi: m.ent('phi_cc', '\\phi_{cc}', emCm), phiMm: m.num('phi_cc'),
          chave: 'sapata.espera.construtivas', rotulo: 'Dobra da espera das construtivas ≤ altura da sapata',
        }),
      ]
    : [];
  const sec = secao('Dobra do pé na sapata', passos, DEDUCAO);
  const trasp = contrafortes
    ? secaoDoTraspasse(m, [
        { id: 'l0t_pv', simbolo: '\\ell_{0t,v}', phi: m.ent('phi_pv', '\\phi_v', emCm), r: m.g('r_pv', 'r_v', 3) },
        { id: 'l0t_cf', simbolo: '\\ell_{0t,cf}', phi: m.ent('phi_cf', '\\phi_{cf}', emCm), r: m.g('r_cf', 'r_{cf}', 3) },
        { id: 'l0t_cc', simbolo: '\\ell_{0t,cc}', phi: m.ent('phi_cc', '\\phi_{cc}', emCm), r: null },
      ], [
        // IF(ISNUMBER(As_...); MIN(1; As/As,ef); 1) — a planilha publica a relação já decidida
        temNumero(m, 'r_pv') && m.passo('r_pv', 'r_v', null, { casas: 3, origem: 'calculado' }),
        temNumero(m, 'r_cf') && m.passo('r_cf', 'r_{cf}', null, { casas: 3, origem: 'calculado' }),
      ])
    : null;
  const secoes = [sec, trasp].filter((s): s is NonNullable<typeof s> => !!s && s.passos.length > 0);
  return {
    id: 'sapata.esperas',
    titulo: 'Esperas na fundação · contrafortes',
    ref: NBR('Tab. 9.1'),
    figura: 'Fig. 9',
    secoes,
    avisos: [],
    aplicavel: contrafortes && secoes.length > 0,
  };
}

/** Dimensionamento da sapata: flexão (ponta, talão), armadura, cortante e torção — nos dois tipos de muro. */
export const autorSapata: AutorDeCards = (r) => [
  cardFlexao(r, PONTA),
  cardFlexao(r, TALAO),
  cardArmadura(r),
  cardCortante(r),
  cardTorcao(r),
  cardEsperas(r),
];
