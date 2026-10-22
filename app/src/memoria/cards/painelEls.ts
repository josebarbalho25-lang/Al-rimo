/*
  CARDS — Painel não armado entre barras e canaletas + ELS do balanço (abas "Painel não armado" e "ELS").

  Cada `if` ESPELHA um IF da planilha (βf manual; LN na mesa × na alma; Ma ≤ Mr; σsg somado; vão 2h; grauteamento
  total) — a memória escolhe que conta CONTAR, nunca que número publicar.

  Aplicabilidade = o IF das verificações da planilha: o painel só existe com Tipo_muro = Balanço e s > m (barra em
  todos os furos → "não se aplica"); o ELS, com s > 0. Fora disso o card fica aplicavel = false, mas as seções são
  montadas assim mesmo (como o piloto faz com o balanço): o teste confere as expressões também nos cenários de
  contraforte, que calculam estas abas — mais cenários provando a mesma conta.

  Célula em "—" (IFERROR da planilha: campo apagado, s = 0) não vira passo — a planilha não calculou, a memória não
  narra. Verificação só leva a célula de veredito quando o card se aplica: fora dele a planilha escreve "— não se
  aplica" e o veredito não é o da desigualdade.
*/
import dados from '@/motor/planilha.gerada.json';
import type { PlanilhaExportada } from '@/motor/tipos';
import type { AutorDeCards, Card, Expr, Passo, Ref, Secao } from '../tipos';
import { cbrt, celulasDoIntervalo, cte, div, inteiro, max, min, mul, neg, par, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao, type Memoria } from '../passo';
import { desenhoDaSecaoI } from '../desenhoDaSecaoI';

export const SIMBOLOS_PAINELELS: Readonly<Record<string, string>> = {
  // ── painel não armado (Anexo E) ──
  s: 'espaçamento adotado das barras verticais',
  's_{can}': 'espaçamento vertical das canaletas',
  'l_{pan}': 'largura do painel não armado (entre barras verticais)',
  'h_{pan}': 'altura do painel não armado (entre canaletas)',
  'z_{pan}': 'profundidade do topo do painel de baixo',
  '\\sigma_{h,sup}': 'pressão horizontal no topo do painel de baixo',
  '\\sigma_{h,m}': 'pressão horizontal média no painel de baixo',
  w_d: 'pressão lateral de cálculo no painel',
  'f_{tk,\\perp}': 'resistência à tração na flexão, normal à fiada',
  'f_{tk,\\parallel}': 'resistência à tração na flexão, paralela à fiada',
  'f_{td,\\perp}': 'resistência de cálculo à tração na flexão, normal à fiada',
  'f_{td,\\parallel}': 'resistência de cálculo à tração na flexão, paralela à fiada',
  '\\gamma_m': 'coeficiente de ponderação da resistência da alvenaria',
  '\\mu': 'razão de ortogonalidade ftk,⊥/ftk,∥',
  'h/l': 'relação h/l do painel na Tab. E.1 (de 0,3 a 3,0)',
  '\\mu_{tab}': 'μ na Tab. E.1 (de 0,3 a 1,0)',
  t_x: 'fator de interpolação em h/l na Tab. E.1',
  t_y: 'fator de interpolação em μ na Tab. E.1',
  '\\beta_f': 'coeficiente de momento do painel (Tab. E.1)',
  'M_{d,\\parallel}': 'momento de cálculo com tração paralela à fiada, por metro',
  'M_{d,\\perp}': 'momento de cálculo com tração normal à fiada, por metro',
  W: 'módulo resistente da seção bruta, por metro',
  '\\sigma_{td,\\parallel}': 'tensão de tração de cálculo paralela à fiada',
  '\\sigma_{td,\\perp}': 'tensão de tração de cálculo normal à fiada',
  'V_{d,pan}': 'força cortante de cálculo no painel, por metro',
  '\\tau_{vd,pan}': 'tensão de cisalhamento de cálculo no painel',
  'f_{vd,pan}': 'resistência de cálculo ao cisalhamento do painel não armado',
  '\\sigma_{pc}': 'pré-compressão no painel (para o fvk)',

  // ── ELS do balanço (fissuração e flecha) ──
  // b_m, L_{bloco}, h_f, d, s, A_{s1}, f_{pk}, f_{pk}^{*}, f_{pk,liq}, γm: as mesmas grandezas do grupo balanco;
  // k_E, ψ_ELS, Δξ, f_{tk,⊥}, S_δ, n_adm: as mesmas dos grupos contraforte/painelCf — grafia e descrição iguais
  b_m: 'largura da mesa da seção (faixa de uma barra)',
  b_w: 'largura da alma da seção',
  'b_{w,inf}': 'largura da alma informada nas Entradas',
  'L_{bloco}': 'comprimento do bloco',
  h_f: 'espessura da parede do bloco (mesa da seção I)',
  d: 'altura útil',
  'A_{s1}': 'área de aço tracionado na faixa (uma barra)',
  '\\psi_{ELS}': 'relação Ma/Mk da combinação de serviço',
  M_a: 'momento fletor de serviço na faixa',
  'f_{pk}': 'resistência característica do prisma oco (área bruta)',
  'f_{pk}^{*}': 'resistência característica do prisma cheio (grauteado)',
  'f_{pk,liq}': 'resistência do prisma referida à área líquida',
  k_E: 'relação Em/fpk (800, bloco de concreto)',
  E_m: 'módulo de elasticidade da alvenaria',
  n: 'relação entre os módulos Es/Em',
  '\\sigma_{sg}': 'compressão 0,9·Psg/Ae somada no momento de fissuração',
  I_m: 'momento de inércia da seção bruta (estádio I)',
  M_r: 'momento de fissuração',
  'B_{II}': 'coeficiente B da linha neutra no estádio II: n·As',
  'C_{II}': 'coeficiente C da linha neutra no estádio II: n·As·d',
  'B_{IIw}': 'coeficiente B da linha neutra com a LN na alma da seção I',
  'C_{IIw}': 'coeficiente C da linha neutra com a LN na alma da seção I',
  'x_{II}': 'profundidade da linha neutra no estádio II',
  'I_{alv}': 'inércia da alvenaria comprimida (b × x) no estádio II',
  'I_{abas}': 'inércia das abas da mesa comprimida (LN na alma) no estádio II',
  'I_{s1}': 'inércia da barra tracionada homogeneizada (n·As) no estádio II',
  'I_{II}': 'momento de inércia da seção fissurada (estádio II)',
  'I_{eq}': 'momento de inércia equivalente (Branson)',
  'h_{eq}': 'altura do retângulo de largura bm com a inércia Ieq',
  '\\sigma_{s,ser}': 'tensão na armadura em serviço (estádio II)',
  'S_{\\delta}': 'soma da flecha no topo do muro (× Em·I), por metro',
  D_i: 'parcela V_i·a_i²·(3h_solo − a_i)/6 da fatia i (flecha no solo)',
  R_i: 'parcela V_i·a_i²/2 da fatia i (rotação acima do solo)',
  '\\delta_0': 'flecha imediata no topo',
  '\\Delta\\xi': 'coeficiente de fluência',
  '\\alpha_f': 'fator de acréscimo da flecha por fluência',
  '\\delta_\\infty': 'flecha final, com fluência',
  'n_{adm}': 'divisor do vão no deslocamento-limite (vão/n)',
  '\\delta_{adm}': 'deslocamento-limite',
};

const NBR = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });
const RANKINE: Ref = { fonte: 'Rankine' };
// convenção de projeto sem outra fonte: pressão média do painel de baixo, alma = furo + 2 septos, h_eq, δadm = vão/250
const CRITERIO: Ref = { fonte: 'Critério adotado' };
// seção I fissurada e Branson
const NBR_ELS: Ref = NBR('9.2.3');
// interpolação linear na Tab. E.1 (Nota 1 da tabela)
const TAB_E1: Ref = NBR('Tab. E.1');
const DEDUCAO: Ref = { fonte: 'Dedução' };

const PAINEL = 'Painel não armado';

/*
  CONSTANTES DE TABELA (Tab. E.1 do βf, fvk0/fvk,máx da Tab. 4): são células fixas da aba Referências, não conta. O
  gabarito do Excel só guarda célula de fórmula, então elas são lidas da planilha exportada — o mesmo arquivo que o
  motor usa — e entram na linha como número escrito, como se copia de uma tabela de norma na conta de mão.
*/
const PLANILHA = dados as unknown as PlanilhaExportada;

function constante(ref: string): number | null {
  const v = PLANILHA.celulas[ref];
  return typeof v === 'number' ? v : null;
}

/** Tabela de nome definido ('tabela_13', 'hl_row') como matriz de endereços, linha a linha (1-based no uso). */
function tabela(nomeDefinido: string): string[][] {
  const ref = PLANILHA.nomes[nomeDefinido];
  if (!ref) throw new Error(`tabela inexistente na planilha: ${nomeDefinido}`);
  const cels = celulasDoIntervalo(ref);
  const linha = (a: string) => /(\d+)$/.exec(a)?.[1];
  const ncol = cels.filter((a) => linha(a) === linha(cels[0])).length;
  const out: string[][] = [];
  for (let i = 0; i < cels.length; i += ncol) out.push(cels.slice(i, i + ncol));
  return out;
}

/*
  CÉLULA DE VEREDITO pelo rótulo da coluna A ('σtd,par ≤ ftd,par' → B da mesma linha): as linhas de verificação
  não têm nome definido, e o endereço fixo mudaria calado se o gerador inserir uma linha acima. Rótulo sumido
  lança — o teste da memória acusa.
*/
function veredito(aba: string, rotulo: string): string {
  const prefixo = `${aba}!A`;
  for (const [ref, v] of Object.entries(PLANILHA.celulas)) {
    if (v === rotulo && ref.startsWith(prefixo)) return `${aba}!B${ref.slice(prefixo.length)}`;
  }
  throw new Error(`linha de verificação "${rotulo}" não encontrada na aba ${aba}`);
}

const VEREDITO = {
  tracaoPar: veredito(PAINEL, 'σtd,par ≤ ftd,par'),
  tracaoNor: veredito(PAINEL, 'σtd,nor ≤ ftd,nor'),
  cisalhamento: veredito(PAINEL, 'τvd ≤ fvd'),
  lados50t: veredito(PAINEL, 'l e h ≤ 50·t'),
  area: veredito(PAINEL, 'h·l ≤ coef·t²'),
  flecha: veredito('ELS', 'δ∞ ≤ δadm'),
} as const;

/** O Excel compara texto sem caixa: LEFT(Graute;5)="Total", vao_ref="2h", sg_on="Sim". */
const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** INT do Excel: ele enxerga 15 algarismos antes de cortar (o mesmo corte do expr.ts). */
const intExcel = (x: number) => Math.floor(Number(x.toPrecision(15)));

/** Seção sem passo (tudo em "—" na planilha: campo apagado) não deixa título solto no card. */
const comPassos = (secoes: Secao[]) => secoes.filter((s) => s.passos.length > 0);

/*
  S_δ — A SOMA DA FLECHA NO TOPO DO MURO (aba ELS, sum_d; o ELS do contraforte usa a mesma célula). Viga em balanço
  com a força V_i de cada fatia a uma altura a_i da base, todas abaixo do topo do solo (a_i ≤ h_solo):
    flecha no nível do solo:  ΣD_i = Σ V_i·a_i²·(3·h_solo − a_i)/6   (coluna M do perfil, vezes Em·I)
    rotação acima do solo:    ΣR_i = Σ V_i·a_i²/2                    (coluna N, vezes Em·I), constante até o topo
  S_δ = ΣD_i + ΣR_i·(h_muro − h_solo). Com o solo no topo do muro a segunda parcela é zero e a linha mostra só ΣD_i
  (linha elástica do balanço). A planilha soma as duas sempre; com h_muro = h_solo, ΣR·0 = 0 e o número é o mesmo.
*/
export function passoDaSomaDaFlecha(m: Memoria): Passo {
  const somaD = m.g('Solo e Empuxo!M44:M83', '\\sum_{i=1}^{40} D_i', 4, 'kN·m³/m');
  const hm = m.num('H_muro'), hs = m.num('H_solo');
  const acima = hm !== null && hs !== null && hm !== hs;
  const expr = acima
    ? soma(somaD, mul(m.g('Solo e Empuxo!N44:N83', '\\sum_{i=1}^{40} R_i', 4, 'kN·m²/m'),
        par(sub(m.ent('H_muro', 'h_{muro}'), m.ent('H_solo', 'h_{solo}')))))
    : somaD;
  return m.passo('sum_d', 'S_{\\delta}', expr, { casas: 4, unidade: 'kN·m³/m', ...(acima ? { ref: DEDUCAO } : {}) });
}

// ───────────────────────────── painel não armado ─────────────────────────────

function cardPainel(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const tem = (id: string) => m.valor(id) !== null;

  const sAdot = m.num('s_adot');
  const mMod = m.num('m_mod');
  // IF(AND(s_adot>0;s_adot<=m_mod);"não se aplica";IF(s_adot>0;...;"sem espaçamento válido"))
  const aplicavel = m.texto('Tipo_muro') === 'Balanço' && sAdot !== null && mMod !== null && sAdot > 0 && sAdot > mMod;

  const s = m.g('s_adot', 's', 0, 'cm');
  const sCan = m.ent('h_pan', 's_{can}');
  // o painel é peça do MURO (não passa do topo dele); a profundidade e a carga são do SOLO
  const hm = m.ent('H_muro', 'h_{muro}');
  const hs = m.ent('H_solo', 'h_{solo}');
  const l = m.g('l_pan', 'l_{pan}', 2, 'm');
  const hp = m.g('hp_', 'h_{pan}', 2, 'm');
  const t = m.g('t_pan', 't', 2, 'm');
  const zp = m.g('z_pan', 'z_{pan}', 2, 'm');
  const sSup = m.g('sp_top', '\\sigma_{h,sup}', 2, 'kPa');
  const sBase = m.g('sp_base', '\\sigma_{h,base}', 2, 'kPa');
  const sMed = m.g('sp_med', '\\sigma_{h,m}', 2, 'kPa');
  const gf = m.ent('gama_f', '\\gamma_f');
  const gm = m.ent('gama_m', '\\gamma_m');
  const wd = m.g('fd_pan', 'w_d', 2, 'kN/m²');

  // ── σh no topo do painel de baixo ──
  // A planilha interpola na tabela de 40 fatias da aba Solo e Empuxo. A conta de mão é a pressão no ponto,
  // com a mesma lei da tabela (σ'h = máx(0; Ka·σ'v − 2c'√Ka), u = γw·máx(0; z − zNA)); ela coincide com a
  // interpolação sempre que a quebra do diagrama (NA, coesão) não cai DENTRO da fatia do ponto. Quando cai,
  // a linha mostra a interpolação da planilha, com os dois valores da tabela escritos.
  const q = m.ent('q_sobre', 'q');
  const gama = m.ent('gama_solo', '\\gamma');
  const Ka = m.g('Ka_', 'K_a', 3);
  const c = m.ent('c_solo', "c'");
  const gw = m.ent('gama_w', '\\gamma_w');
  const zna = m.ent('z_NA', 'z_{NA}');
  const coesao = (m.num('c_solo') ?? 0) > 0;
  const zPan = m.num('z_pan') ?? 0;
  const uAtivo = m.texto('Agua') === 'Sim' && (m.num('z_NA') ?? 0) < zPan;
  const u = mul(gw, sub(zp, zna));
  const sigV = uAtivo ? sub(soma(q, mul(gama, zp)), u) : soma(q, mul(gama, zp));
  const efetivas: Expr[] = coesao
    ? [max(cte(0, 0), sub(mul(Ka, sigV), mul(cte(2, 0), c, raiz(Ka))))]
    : [mul(Ka, sigV), max(cte(0, 0), mul(Ka, sigV))];
  const alternativasSup: Expr[] = efetivas.map((e) => (uAtivo ? soma(e, u) : e));
  // o perfil de 40 fatias cobre a altura de SOLO: a posição na tabela é z/h solo
  const H = m.num('H_solo');
  if (H) {
    const k = intExcel((zPan / H) * 40);
    const gk = m.valor(`Solo e Empuxo!G${44 + k}`);
    const gk1 = m.valor(`Solo e Empuxo!G${Math.min(45 + k, 84)}`);
    if (gk !== null && gk1 !== null) {
      const pos = mul(div(zp, hs), cte(40, 0));
      alternativasSup.push(soma(cte(gk, 2), mul(sub(pos, inteiro(pos)), sub(cte(gk1, 2), cte(gk, 2)))));
    }
  }

  const geometria = secao('Geometria e carga', [
    tem('l_pan') && m.passo('l_pan', 'l_{pan}', div(s, cte(100, 0)), { casas: 2, unidade: 'm' }),
    tem('hp_') && m.passo('hp_', 'h_{pan}', min(sCan, hm), { casas: 2, unidade: 'm' }),
    // painel de baixo mais alto que o solo: z = 0 e o trapézio do solo vale no painel inteiro (dedução, a favor da
    // segurança — acima do solo não há carga)
    tem('z_pan') && m.passo('z_pan', 'z_{pan}', [sub(hs, hp), max(cte(0, 0), sub(hs, hp))], {
      casas: 2, unidade: 'm', ...((m.num('H_solo') ?? 0) < (m.num('hp_') ?? 0) ? { ref: DEDUCAO } : {}),
    }),
    tem('sp_top') && m.passo('sp_top', '\\sigma_{h,sup}', alternativasSup, { casas: 2, unidade: 'kPa', ref: RANKINE }),
    tem('sp_med') && m.passo('sp_med', '\\sigma_{h,m}', div(soma(sSup, sBase), cte(2, 0)), { casas: 2, unidade: 'kPa' }),
    tem('fd_pan') && m.passo('fd_pan', 'w_d', mul(gf, sMed), { casas: 2, unidade: 'kN/m²', ref: NBR('E.3') }),
  ], CRITERIO);

  // ── tração na flexão (Tab. 3) ──
  const ftkN = m.g('ftk_nor', 'f_{tk,\\perp}', 2, 'MPa');
  const ftkP = m.g('ftk_par', 'f_{tk,\\parallel}', 2, 'MPa');
  const arg = m.texto('arg_cls');
  const tracao = secao(arg ? `Tração na flexão · argamassa ${arg}` : 'Tração na flexão', [
    tem('ftk_nor') && m.passo('ftk_nor', 'f_{tk,\\perp}', null, { casas: 2, unidade: 'MPa', origem: 'tabela', ref: NBR('Tab. 3') }),
    tem('ftk_par') && m.passo('ftk_par', 'f_{tk,\\parallel}', null, { casas: 2, unidade: 'MPa', origem: 'tabela', ref: NBR('Tab. 3') }),
    tem('mu_pan') && m.passo('mu_pan', '\\mu', div(ftkN, ftkP), { casas: 2, ref: NBR('E.2') }),
    tem('ftd_par') && m.passo('ftd_par', 'f_{td,\\parallel}', div(ftkP, gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.2') }),
    tem('ftd_nor') && m.passo('ftd_nor', 'f_{td,\\perp}', div(ftkN, gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.2') }),
  ], NBR('6.2.2.5'));

  // ── βf: manual (Entradas) ou interpolado na tabela do caso em h/l e μ ──
  const caso = m.num('caso_pan');
  const passosBeta: (Passo | false)[] = [];
  if (m.num('beta_dir') !== null) {
    // IF(ISNUMBER(beta_dir);beta_dir;beta_tab)
    passosBeta.push(tem('beta_f') && m.passo('beta_f', '\\beta_f', null, { casas: 4, origem: 'adotado' }));
  } else if (tem('hl_p') && caso !== null) {
    const mu = m.g('mu_pan', '\\mu', 2);
    const hl = m.g('hl_p', 'h/l', 3);
    const muLimitado = m.num('mu_p') !== m.num('mu_pan');
    const muTab = muLimitado ? m.g('mu_p', '\\mu_{tab}', 3) : mu;
    const jp = m.num('jp');
    const ip = m.num('ip');
    const tx = m.num('txp') ?? 0;
    const ty = m.num('typ') ?? 0;
    passosBeta.push(
      m.passo('hl_p', 'h/l', [div(hp, l), min(cte(3, 0), max(cte(0.3, 1), div(hp, l)))], { casas: 3 }),
      muLimitado && tem('mu_p') && m.passo('mu_p', '\\mu_{tab}', min(cte(1, 0), max(cte(0.3, 1), mu)), { casas: 3 }),
    );
    // caso fora de 13/18/11: o MATCH da planilha falha e o βf sai "—" (não há tabela a citar)
    if (jp !== null && ip !== null && PLANILHA.nomes[`tabela_${caso}`]) {
      const colunasHl = tabela('hl_row')[0];
      const linhasMu = tabela('mu_col').map((x) => x[0]);
      const T = tabela(`tabela_${caso}`);
      const cH = (j: number) => cte(constante(colunasHl[j - 1]) ?? NaN, 2);
      const cMu = (i: number) => cte(constante(linhasMu[i - 1]) ?? NaN, 2);
      const cB = (i: number, j: number) => cte(constante(T[i - 1][j - 1]) ?? NaN, 3);
      const txE = m.g('txp', 't_x', 3);
      const tyE = m.g('typ', 't_y', 3);
      const um = cte(1, 0);
      // interpolação linear na tabela (Nota 1 da Tab. E.1 permite).
      // IF(jp>=11;0;...) e IF(ip>=9;0;...): fator nulo = ponto da própria tabela, sem conta a mostrar
      if (tx !== 0) passosBeta.push(m.passo('txp', 't_x', div(sub(hl, cH(jp)), sub(cH(jp + 1), cH(jp))), { casas: 3, ref: TAB_E1 }));
      if (ty !== 0) passosBeta.push(m.passo('typ', 't_y', div(sub(cMu(ip), muTab), sub(cMu(ip), cMu(ip + 1))), { casas: 3, ref: TAB_E1 }));
      const j2 = Math.min(11, jp + 1), i2 = Math.min(9, ip + 1);
      const naLinha = (i: number) => soma(mul(sub(um, txE), cB(i, jp)), mul(txE, cB(i, j2)));
      let beta: Expr | null = null;
      if (tx !== 0 && ty !== 0) beta = soma(mul(sub(um, tyE), naLinha(ip)), mul(tyE, naLinha(i2)));
      else if (tx !== 0) beta = naLinha(ip);
      else if (ty !== 0) beta = soma(mul(sub(um, tyE), cB(ip, jp)), mul(tyE, cB(i2, jp)));
      passosBeta.push(tem('beta_f') && m.passo('beta_f', '\\beta_f', beta, {
        casas: 4, origem: beta ? 'calculado' : 'tabela',
      }));
    }
  }
  const coeficiente = secao(caso !== null ? `Coeficiente βf · caso ${caso}` : 'Coeficiente βf', passosBeta, NBR('Tab. E.1'));

  // ── momentos e tensões de tração ──
  const beta = m.g('beta_f', '\\beta_f', 4);
  const mu = m.g('mu_pan', '\\mu', 2);
  const Mpar = m.g('Mpar', 'M_{d,\\parallel}', 4, 'kN·m/m');
  const Mnor = m.g('Mnor', 'M_{d,\\perp}', 4, 'kN·m/m');
  const W = m.g('W_pan', 'W', 6, 'm³/m');
  const ftdP = m.g('ftd_par', 'f_{td,\\parallel}', 3, 'MPa');
  const ftdN = m.g('ftd_nor', 'f_{td,\\perp}', 3, 'MPa');
  const momentos = secao('Momentos e tensões', [
    tem('Mpar') && m.passo('Mpar', 'M_{d,\\parallel}', mul(beta, wd, pot(l, 2)), { casas: 4, unidade: 'kN·m/m', ref: NBR('E.3') }),
    tem('Mnor') && m.passo('Mnor', 'M_{d,\\perp}', mul(mu, Mpar), { casas: 4, unidade: 'kN·m/m', ref: NBR('E.3') }),
    tem('W_pan') && m.passo('W_pan', 'W', div(pot(t, 2), cte(6, 0)), { casas: 6, unidade: 'm³/m' }),
    tem('st_par') && m.passo('st_par', '\\sigma_{td,\\parallel}', div(Mpar, mul(cte(1000, 0), W)), {
      casas: 4, unidade: 'MPa', ref: NBR('11.3.1'),
      verif: aplicavel && tem('ftd_par') ? {
        chave: 'painel.tracao.paralela', rotulo: 'Tração ∥ fiada σtd ≤ ftd', limite: ftdP, relacao: '<=',
        celula: VEREDITO.tracaoPar,
      } : undefined,
    }),
    tem('st_nor') && m.passo('st_nor', '\\sigma_{td,\\perp}', div(Mnor, mul(cte(1000, 0), W)), {
      casas: 4, unidade: 'MPa', ref: NBR('11.3.1'),
      verif: aplicavel && tem('ftd_nor') ? {
        chave: 'painel.tracao.normal', rotulo: 'Tração ⊥ fiada σtd ≤ ftd', limite: ftdN, relacao: '<=',
        celula: VEREDITO.tracaoNor,
      } : undefined,
    }),
  ], NBR('E.3'));

  // ── cisalhamento (Vsd = fd·l/2: hipótese nossa, faixa horizontal biapoiada nas barras) ──
  const V = m.g('V_pan', 'V_{d,pan}', 3, 'kN/m');
  const fvd = m.g('fvd_pan', 'f_{vd,pan}', 3, 'MPa');
  const sig = m.ent('sig_pan', '\\sigma_{pc}');
  // fvk0 e fvk,máx: a linha da argamassa em Referências!L16:L18, como o MATCH da planilha
  const argamassas = celulasDoIntervalo('Referências!L16:L18');
  const iArg = argamassas.findIndex((a) => PLANILHA.celulas[a] === arg);
  const fvk0 = iArg >= 0 ? constante(`Referências!O${16 + iArg}`) : null;
  const fvkMax = iArg >= 0 ? constante(`Referências!P${16 + iArg}`) : null;
  const cisalhamento = secao('Cisalhamento', [
    tem('V_pan') && m.passo('V_pan', 'V_{d,pan}', div(mul(wd, l), cte(2, 0)), { casas: 3, unidade: 'kN/m', ref: DEDUCAO }),
    tem('fvd_pan') && fvk0 !== null && fvkMax !== null && m.passo('fvd_pan', 'f_{vd,pan}',
      div(min(soma(cte(fvk0, 2), mul(cte(0.5, 1), sig)), cte(fvkMax, 2)), gm),
      { casas: 3, unidade: 'MPa', ref: NBR('Tab. 4') }),
    tem('tau_pan') && m.passo('tau_pan', '\\tau_{vd,pan}', div(V, mul(cte(1000, 0), t)), {
      casas: 4, unidade: 'MPa', ref: NBR('11.4.1'),
      verif: aplicavel && tem('fvd_pan') ? {
        chave: 'painel.cisalhamento', rotulo: 'Cisalhamento τvd ≤ fvd', limite: fvd, relacao: '<=',
        celula: VEREDITO.cisalhamento,
      } : undefined,
    }),
  ], NBR('11.4.1'));

  /*
    As outras duas verificações da planilha (E.4.1: l e h ≤ 50t; h·l ≤ 2025t² ou 1350t²) não têm célula com o número
    da esquerda nem do limite — o número só existe dentro do texto do veredito. Sem célula não há expressão a
    conferir; o veredito da planilha aparece como aviso quando reprova, para a memória não dizer "passa" sozinha.
  */
  const avisos: string[] = [];
  const reprova = (ref: string) => {
    const v = r.cel(ref);
    return typeof v === 'string' && v.trim().toUpperCase().startsWith('NÃO');
  };
  if (aplicavel && reprova(VEREDITO.lados50t)) avisos.push('NBR 16868-1 E.4.1: l ou h > 50·t');
  if (aplicavel && reprova(VEREDITO.area)) avisos.push(`NBR 16868-1 E.4.1: h·l > ${m.num('coef_area') ?? ''}·t²`);

  return {
    id: 'painelEls.painel',
    titulo: 'Painel não armado · balanço',
    ref: NBR('Anexo E'),
    figura: 'Fig. 5',
    secoes: comPassos([geometria, tracao, coeficiente, momentos, cisalhamento]),
    avisos,
    aplicavel,
  };
}

// ───────────────────────────── ELS do balanço ─────────────────────────────

function cardEls(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const tem = (id: string) => m.valor(id) !== null;

  const sAdot = m.num('s_adot');
  // IF(s_adot>0;...;"— (sem espaçamento de barras válido)")
  const aplicavel = m.texto('Tipo_muro') === 'Balanço' && sAdot !== null && sAdot > 0;

  const cheia = m.texto('gr_tot') === 'Sim';                      // graute a cada 20 = todos os furos (13/10)
  const s = m.g('s_adot', 's', 0, 'cm');
  const bm = m.g('bm_els', 'b_m', 1, 'cm');
  const bw = m.g('bw_els', 'b_w', 2, 'cm');
  const hf = m.g('hf_bl', 'h_f', 1, 'cm');
  const L = m.g('L_bloco', 'L_{bloco}', 0, 'cm');
  const t = m.ent('t_bloco', 't');
  const d = m.g('d_util', 'd', 2, 'cm');
  const As = m.g('As_barra', 'A_{s1}', 3, 'cm²');
  const Im = m.g('Im_', 'I_m', 0, 'cm⁴');

  // bw: IF(gr_tot="Sim";bm;MIN(bm;n_alm·IF(ISNUMBER(bw_dir);bw_dir;(L − 3hf)/2 + 2hf))); n_alm = s/X furos
  // grauteados na faixa da barra (graute a cada X, 13/10) — com uma alma só a linha fica a de uma alma
  const bwDigitado = m.num('bw_dir') !== null;
  const nAlm = m.num('n_alm') ?? 1;
  const bwUma = bwDigitado
    ? m.ent('bw_dir', 'b_{w,inf}')
    : soma(div(sub(L, mul(cte(3, 0), hf)), cte(2, 0)), mul(cte(2, 0), hf));
  const bwExpr = cheia ? bm : min(bm, nAlm > 1 ? mul(m.g('n_alm', 'n_{alm}', 0), bwUma) : bwUma);
  // Mesma fórmula de Im nos dois casos; com bw = bm a alma é a seção toda e o segundo termo é zero
  const alma = !cheia && m.num('bw_els') !== m.num('bm_els');
  const brutaRet = div(mul(bm, pot(t, 3)), cte(12, 0));
  const imExpr = alma
    ? sub(brutaRet, div(mul(sub(bm, bw), pot(sub(t, mul(cte(2, 0), hf)), 3)), cte(12, 0)))
    : brutaRet;
  const secaoFaixa = secao(cheia ? 'Seção da faixa · retangular cheia' : 'Seção da faixa · seção I', [
    tem('bm_els') && m.passo('bm_els', 'b_m', s, { casas: 1, unidade: 'cm' }),
    !cheia && nAlm > 1 && m.passo('n_alm', 'n_{alm}', div(bm, m.ent('Graute', 's_{gr}')), { casas: 0 }),
    tem('bw_els') && m.passo('bw_els', 'b_w', bwExpr, { casas: 2, unidade: 'cm', ref: CRITERIO }),
    tem('Im_') && m.passo('Im_', 'I_m', imExpr, { casas: 0, unidade: 'cm⁴' }),
  ], NBR_ELS);

  // ── momento de serviço e de fissuração ──
  const psi1 = m.num('psi_els') === 1;                       // ψ = 1 (carga de serviço inteira): a linha fica Mk·bm
  const psi = m.ent('psi_els', '\\psi_{ELS}');
  const Mk = m.g('Mk_', 'M_k', 2, 'kN·m/m');
  const Ma = m.g('Ma_', 'M_a', 1, 'kN·cm');
  const Mr = m.g('Mr_', 'M_r', 1, 'kN·cm');
  const comSg = igual(m.texto('sg_on'), 'Sim');               // IF(sg_on="Sim";0,9·Psg/Ae;0)
  const gpar = m.g('peso_us', 'g_{par}', 2, 'kN/m²');   // o peso usado: calculado ou digitado (cards/pesoProprio.ts)
  const h = m.ent('H_muro', 'h_{muro}');                        // peso da parede: altura do muro
  const tM = m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' });
  // ftk e σsg em kN/cm² na leitura: Im em cm⁴ e yt em cm dão Mr direto em kN·cm, como na conta de mão
  const ftk = m.g('ftk_nor', 'f_{tk,\\perp}', 3, 'kN/cm²', { fator: 0.1 });
  const sg = m.g('sig_sg', '\\sigma_{sg}', 5, 'kN/cm²', { fator: 0.1 });
  const meiaAltura = mul(cte(0.5, 1), t);                     // yt = h/2 (seção simétrica)
  const fissuracao = secao('Momento de fissuração', [
    tem('Ma_') && m.passo('Ma_', 'M_a', psi1 ? mul(Mk, bm) : mul(psi, Mk, bm), { casas: 1, unidade: 'kN·cm', ref: NBR_ELS }),
    comSg && tem('sig_sg') && m.passo('sig_sg', '\\sigma_{sg}', div(mul(cte(0.9, 1), gpar, h), mul(cte(1000, 0), tM)), {
      casas: 4, unidade: 'MPa',
    }),
    tem('Mr_') && m.passo('Mr_', 'M_r', div(mul(comSg ? soma(ftk, sg) : ftk, Im), meiaAltura), { casas: 1, unidade: 'kN·cm' }),
  ], NBR('9.2.3'));

  // ── inércia equivalente: IF(Ma_<=Mr_;Im_;MIN(Im_;Branson)) ──
  const MaV = m.num('Ma_'), MrV = m.num('Mr_');
  const fissurada = MaV !== null && MrV !== null && MaV > MrV;
  // fpk_ = IF(Líquida;fpk_liq;fpk_tab), fpk_tab = IF(Total;fpk_chei;fpk_oco) e, com Total, fpk_liq = fpk_tab:
  // a linha mostra o fpk que a planilha de fato pegou, com a grafia da aba Muro em balanço
  const liquida = igual(m.texto('fpk_ref').slice(0, 4), 'Líqu');
  const fpk = cheia
    ? m.g('fpk_chei', 'f_{pk}^{*}', 1, 'MPa')
    : liquida ? m.g('fpk_liq', 'f_{pk,liq}', 2, 'MPa') : m.g('fpk_oco', 'f_{pk}', 1, 'MPa');
  const Em = m.g('Em_', 'E_m', 0, 'MPa');
  const n = m.g('n_els', 'n', 2);
  const x = m.g('xII', 'x_{II}', 2, 'cm');
  const III = m.g('III_', 'I_{II}', 0, 'cm⁴');
  const Ieq = m.g('Ieq_', 'I_{eq}', 0, 'cm⁴');
  // LN e III em pedaços (Jose, 14/10: a conta inteira numa linha só ficava grande demais), um termo por linha como a
  // planilha: b·x²/2 + B·x − C = 0 com B e C publicados; III = alvenaria comprimida + abas da mesa + barra.
  // LN na mesa: B = n·As, C = n·As·d; na alma: Bw = (bm − bw)·hf + B, Cw = (bm − bw)·hf²/2 + C
  // seção cheia (bw = bm): na alma dá o mesmo número da mesa — a linha fica a da mesa, sem abas de largura zero
  const naMesa = !alma || (m.num('x_rect') ?? Infinity) <= (m.num('hf_bl') ?? -Infinity);
  const B = m.g('lnB_els', 'B_{II}', 2, 'cm²');
  const C = m.g('lnC_els', 'C_{II}', 2, 'cm³');
  const Bw = m.g('lnBw_els', 'B_{IIw}', 2, 'cm²');
  const Cw = m.g('lnCw_els', 'C_{IIw}', 2, 'cm³');
  const xExpr = naMesa
    ? div(soma(neg(B), raiz(soma(pot(B, 2), mul(cte(2, 0), bm, C)))), bm)
    : div(soma(neg(Bw), raiz(soma(pot(Bw, 2), mul(cte(2, 0), bw, Cw)))), bw);
  const Ialv = m.g('IIc_els', 'I_{alv}', 0, 'cm⁴');
  const Iabas = m.g('IIf_els', 'I_{abas}', 0, 'cm⁴');
  const Is1 = m.g('IIs_els', 'I_{s1}', 0, 'cm⁴');
  const razao3 = pot(div(Mr, Ma), 3);
  const branson = soma(mul(razao3, Im), mul(sub(cte(1, 0), razao3), III));
  const inercia = secao(fissurada ? 'Inércia equivalente · fissurada (Ma > Mr)' : 'Inércia equivalente · não fissurada (Ma ≤ Mr)', [
    // Em_coef = 800 (bloco de concreto): constante da planilha, escrita como número
    tem('Em_') && m.passo('Em_', 'E_m', mul(cte(800, 0), fpk), {
      casas: 0, unidade: 'MPa', ref: NBR('Tab. 1'),
    }),
    fissurada && tem('n_els') && m.passo('n_els', 'n', div(cte(210000, 0), Em), { casas: 2 }),
    fissurada && tem('lnB_els') && m.passo('lnB_els', 'B_{II}', mul(n, As), { casas: 2, unidade: 'cm²' }),
    fissurada && tem('lnC_els') && m.passo('lnC_els', 'C_{II}', mul(n, As, d), { casas: 2, unidade: 'cm³' }),
    fissurada && !naMesa && tem('lnBw_els') && m.passo('lnBw_els', 'B_{IIw}', soma(mul(sub(bm, bw), hf), B), {
      casas: 2, unidade: 'cm²',
    }),
    fissurada && !naMesa && tem('lnCw_els') && m.passo('lnCw_els', 'C_{IIw}', soma(div(mul(sub(bm, bw), pot(hf, 2)), cte(2, 0)), C), {
      casas: 2, unidade: 'cm³',
    }),
    fissurada && tem('xII') && m.passo('xII', 'x_{II}', xExpr, { casas: 2, unidade: 'cm', ref: NBR_ELS }),
    fissurada && tem('IIc_els') && m.passo('IIc_els', 'I_{alv}', div(mul(naMesa ? bm : bw, pot(x, 3)), cte(3, 0)), {
      casas: 0, unidade: 'cm⁴',
    }),
    fissurada && !naMesa && tem('IIf_els') && m.passo('IIf_els', 'I_{abas}', soma(
      div(mul(sub(bm, bw), pot(hf, 3)), cte(12, 0)),
      mul(sub(bm, bw), hf, pot(sub(x, div(hf, cte(2, 0))), 2)),
    ), { casas: 0, unidade: 'cm⁴' }),
    fissurada && tem('IIs_els') && m.passo('IIs_els', 'I_{s1}', mul(n, As, pot(sub(d, x), 2)), { casas: 0, unidade: 'cm⁴' }),
    fissurada && tem('III_') && m.passo('III_', 'I_{II}', naMesa ? soma(Ialv, Is1) : soma(Ialv, Iabas, Is1), {
      casas: 0, unidade: 'cm⁴', ref: NBR_ELS,
    }),
    tem('Ieq_') && m.passo('Ieq_', 'I_{eq}', fissurada ? [branson, min(Im, branson)] : Im, { casas: 0, unidade: 'cm⁴' }),
    tem('heq_') && m.passo('heq_', 'h_{eq}', cbrt(div(mul(cte(12, 0), Ieq), bm)), { casas: 2, unidade: 'cm', ref: CRITERIO }),
    fissurada && tem('sig_s_els') && m.passo('sig_s_els', '\\sigma_{s,ser}', div(mul(n, Ma, sub(d, x)), III), {
      casas: 2, unidade: 'kN/cm²', ref: NBR_ELS,
    }),
  ], NBR('9.2.3'));

  // ── deslocamento no topo ──
  /*
    δ0 = ψ·S·bm/(Em·Ieq) com S em kN·m³/m, bm em cm, Em em MPa e Ieq em cm⁴ dá o resultado em mm vezes 10⁻⁶:
    kN·m³·cm/m = 10¹⁰ N·mm³ e MPa·cm⁴ = 10⁴ N·mm². O 10⁶ é só a troca de unidade (a planilha escreve
    /100, ·1000, /10⁸ e ·1000 separados); assim os números da linha são os publicados nas células.
  */
  const S = m.g('sum_d', 'S_{\\delta}', 4, 'kN·m³/m');
  const d0 = m.g('delta0', '\\delta_0', 2, 'mm');
  const af = m.g('alfa_f', '\\alpha_f', 2);
  const dxi = m.ent('dxi', '\\Delta\\xi');
  const nAdm = m.ent('div_adm', 'n_{adm}');
  const hMm = m.ent('H_muro', 'h_{muro}', { fator: 1000, casas: 0, unidade: 'mm' });   // vão: o balanço é o muro todo
  const dadm = m.g('dadm_', '\\delta_{adm}', 2, 'mm');
  const vao2h = igual(m.texto('vao_ref'), '2h');             // IF(vao_ref="2h";2;1)·H
  const dez6 = pot(cte(10, 0), cte(6, 0));
  const deslocamento = secao('Deslocamento no topo', [
    tem('sum_d') && passoDaSomaDaFlecha(m),
    tem('delta0') && m.passo('delta0', '\\delta_0', div(psi1 ? mul(dez6, S, bm) : mul(dez6, psi, S, bm), mul(Em, Ieq)), {
      casas: 2, unidade: 'mm', ref: NBR_ELS,
    }),
    // ρ' = 0 (sem armadura comprimida): a planilha escreve Δξ/(1 + 50·0)
    tem('alfa_f') && m.passo('alfa_f', '\\alpha_f', div(dxi, soma(cte(1, 0), mul(cte(50, 0), cte(0, 0)))), { casas: 2, ref: NBR('9.2.4') }),
    tem('dadm_') && m.passo('dadm_', '\\delta_{adm}', div(vao2h ? mul(cte(2, 0), hMm) : hMm, nAdm), { casas: 2, unidade: 'mm', ref: CRITERIO }),
    tem('delta_') && m.passo('delta_', '\\delta_\\infty', mul(d0, soma(cte(1, 0), af)), {
      casas: 2, unidade: 'mm', ref: NBR('9.2.4'),
      verif: aplicavel && tem('dadm_') ? {
        chave: 'els.flecha', rotulo: 'Flecha δ∞ ≤ δadm', limite: dadm, relacao: '<=', celula: VEREDITO.flecha,
      } : undefined,
    }),
  ], NBR('9.2.4'));

  const desenho = desenhoDaSecaoI(r);
  return {
    id: 'painelEls.els',
    titulo: 'ELS · fissuração e deslocamento · balanço',
    ref: NBR('9.2'),
    figura: 'Fig. 10',
    // a seção da faixa desenhada e cotada, com os números das mesmas células (Jose, 12/10)
    ...(desenho ? { desenho } : {}),
    secoes: comPassos([secaoFaixa, fissuracao, inercia, deslocamento]),
    avisos: [],
    aplicavel,
  };
}

/** Painel não armado entre barras e canaletas, e ELS do muro em balanço. */
export const autorPainelEls: AutorDeCards = (r) => [cardPainel(r), cardEls(r)];
