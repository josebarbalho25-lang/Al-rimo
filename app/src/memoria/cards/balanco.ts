/*
  CARDS — Muro em balanço (depois do Md do piloto) e aba Arranjos: materiais e seção, flexão, barras adotadas,
  cisalhamento, ancoragem na fundação, barra centralizada (robustez) e arranjos por faixa.
  Regras em ./index.ts ("COMO ESCREVER UM CARD"). Símbolos novos deste grupo ficam em SIMBOLOS_BALANCO (abaixo).

  Cada `if` espelha um IF da planilha (build_new.py, aba "Muro em balanço"): grauteamento total → fpk*; área de
  referência líquida → fpk/(Aliq/Abr); K digitado ou da norma; critério do As,mín; s digitado ou automático; gancho.
  Linha cuja célula a planilha deixou em texto ("não resiste", "—", erro) não entra: o card mostra o que a planilha
  publicou como número. As verificações leem a célula de veredito da coluna B (linhas 77–89 da aba) — os endereços
  são fixos de propósito no gerador ("no fim da lista de propósito: linhas acima têm endereço lido pelo app").
*/
import type { AutorDeCards, Card, Expr, Ref, Secao } from '../tipos';
import { arredBaixo, arredCima, cte, div, max, min, mul, pi, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao, type Memoria } from '../passo';
import { nbr, nt } from '../formato';

export const SIMBOLOS_BALANCO: Readonly<Record<string, string>> = {
  // ── materiais ──
  'f_{bk}': 'resistência característica do bloco à compressão',
  // f_{pk}, f_{pk}^{*}, γm, fyk e γs: grafia e descrição iguais às do grupo contraforte (o mesmo dado)
  'f_{pk}': 'resistência característica do prisma oco (área bruta)',
  'f_{pk}^{*}': 'resistência característica do prisma cheio (grauteado)',
  'A_{liq}/A_{br}': 'relação entre a área líquida e a área bruta do bloco',
  'f_{pk,liq}': 'resistência do prisma referida à área líquida',
  f_k: 'resistência característica à compressão da alvenaria',
  '\\gamma_m': 'coeficiente de ponderação da resistência da alvenaria',
  f_d: 'resistência de cálculo à compressão da alvenaria',
  K: 'coeficiente da resistência à compressão na flexão',
  'K\\,f_d': 'resistência de cálculo à compressão na flexão',
  'f_{yk}': 'resistência característica de escoamento do aço',
  '\\gamma_s': 'coeficiente de ponderação da resistência do aço',
  'f_{sd}': 'tensão de cálculo na armadura tracionada',
  // ── seção ──
  'L_{bloco}': 'comprimento do bloco',
  m: 'módulo da grade dos furos (meio bloco)',
  h_f: 'espessura da parede do bloco (mesa da seção I)',
  '\\phi': 'diâmetro da barra vertical',
  'd_{sug}': 'altura útil com 15 mm de graute entre a barra e a parede',
  d: 'altura útil',
  // ── flexão ──
  'k_{md}': 'momento reduzido Md/(0,5·b·d²·K·fd)',
  x: 'profundidade da linha neutra',
  'x/d': 'profundidade relativa da linha neutra',
  z: 'braço de alavanca',
  '\\varepsilon_s': 'deformação da armadura tracionada',
  '\\sigma_s': 'tensão na armadura tracionada',
  'A_{s,nec}': 'armadura necessária para o momento de cálculo',
  'A_{s,1{,}4}': 'armadura para 1,4·Md (dispensa o mínimo da NBR)',
  'A_{s,min}': 'armadura mínima',
  'A_{s,calc}': 'armadura de cálculo (maior entre a necessária e a mínima)',
  'A_{s1}': 'área de aço tracionado na faixa (uma barra)',
  's_{calc}': 'espaçamento máximo pela armadura de cálculo',
  's_{dig}': 'espaçamento digitado nas Entradas',
  s: 'espaçamento adotado das barras verticais',
  'A_{s,ef}': 'armadura efetiva',
  // ── cisalhamento ──
  '\\rho': 'taxa de armadura no cisalhamento',
  'f_{vd}': 'resistência de cálculo da alvenaria ao cisalhamento',
  'V_{sd}': 'força cortante de cálculo',
  '\\tau_{vd}': 'tensão de cisalhamento de cálculo',
  V_a: 'força cortante resistida pela alvenaria, sem estribo',
  'V_{Rd2}': 'força cortante máxima das bielas comprimidas',
  // ── ancoragem na fundação ──
  '\\ell_b': 'comprimento de ancoragem reto (tabela)',
  '\\ell_{b,gancho}': 'comprimento de ancoragem com gancho (tabela)',
  'A_{s,nec}/A_{s,ef}': 'relação entre a armadura necessária e a efetiva',
  '\\ell_{b,nec}': 'comprimento de ancoragem necessário',
  '\\ell_{b,min}': 'comprimento de ancoragem mínimo',
  '\\ell_{b,adot}': 'comprimento de ancoragem adotado na fundação',
  // ── barra centralizada (d = t/2) ──
  d_c: 'altura útil com a barra no meio do furo (t/2)',
  'k_{md,c}': 'momento reduzido com a barra no meio do furo',
  x_c: 'profundidade da linha neutra com a barra no meio do furo',
  'x_c/d_c': 'profundidade relativa da linha neutra com a barra no meio do furo',
  'A_{s,c}': 'armadura necessária com a barra no meio do furo',
  // ── arranjos ──
  b_m: 'largura da mesa da seção (faixa de uma barra)',
  'M_{d,f}': 'momento de cálculo na faixa b_m',
  'A_{s,f}': 'armadura a adotar na faixa b_m',
  '\\phi_{sug}': 'diâmetro sugerido para a faixa b_m',
  'A_{s1,sug}': 'área da barra sugerida para a faixa',
  'A_{s,sug}': 'armadura por metro com a barra sugerida',
};

const ABA = 'Muro em balanço';
/** Células de veredito da aba (coluna B, "Verificações"). */
const VER = {
  classeA: `${ABA}!B77`,
  resiste: `${ABA}!B79`,
  ductil: `${ABA}!B80`,
  mesa: `${ABA}!B81`,
  coerente: `${ABA}!B82`,
  cabe: `${ABA}!B83`,
  As: `${ABA}!B84`,
  tau: `${ABA}!B85`,
  bielas: `${ABA}!B86`,
  seisT: `${ABA}!B89`,
} as const;

const NBR = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });
const AULA_122: Ref = { fonte: 'Aula 12.2' };
const BLOCOS_122: Ref = { fonte: 'Aula 12.2', item: 'tabela de blocos' };
const CURSO_04: Ref = { fonte: 'Curso', item: 'planilha 04' };
const NBR6118_ANC: Ref = { fonte: 'NBR 6118', item: '9.4.2.5' };

// Comparação de texto do Excel: "=" e LEFT() não diferenciam maiúscula de minúscula.
const comeca = (s: string, prefixo: string) => s.slice(0, prefixo.length).toLowerCase() === prefixo.toLowerCase();
const so = (secoes: Secao[]) => secoes.filter((s) => s.passos.length > 0);

/*
  A planilha testa "arg_x < 1" e o Excel compara com 15 algarismos: 0,9999999999999996 já é 1 para ele (seção não
  resiste — o gabarito alvo_compara15_flexao cai exatamente aí). O limite escrito é o maior double que o Excel ainda
  vê abaixo de 1; na linha ele sai "1", e a desigualdade escrita fica do mesmo lado do veredito da célula.
*/
const LIMITE_KMD = 0.9999999999999994;

/**
  As folhas que mais de um card usa — sempre com o mesmo símbolo e as mesmas casas (o teste cobra a régua única).
  Md e K·fd também em kN·cm e kN/cm² (fator), como a planilha 04 do curso escreve a conta da flexão.
*/
function folhas(m: Memoria) {
  return {
    t: m.ent('t_bloco', 't'),
    L: m.g('L_bloco', 'L_{bloco}', 0, 'cm'),
    phiCm: m.ent('phi_v', '\\phi', { fator: 0.1, casas: 2, unidade: 'cm' }),
    gm: m.ent('gama_m', '\\gamma_m'),
    gs: m.ent('gama_s', '\\gamma_s'),
    gf: m.ent('gama_f', '\\gamma_f'),
    fyk: m.ent('fyk_', 'f_{yk}'),
    sdir: m.ent('s_dir', 's_{dig}'),
    fpkOco: m.g('fpk_oco', 'f_{pk}', 1, 'MPa'),
    fpkChei: m.g('fpk_chei', 'f_{pk}^{*}', 1, 'MPa'),
    rliq: m.g('r_liq', 'A_{liq}/A_{br}', 2),
    fpkLiq: m.g('fpk_liq', 'f_{pk,liq}', 2, 'MPa'),
    fk: m.g('fk_', 'f_k', 2, 'MPa'),
    fd: m.g('fd_', 'f_d', 3, 'MPa'),
    K: m.g('k_flex', 'K', 2),
    Kfd01: m.g('ffd_', 'K\\,f_d', 4, 'kN/cm²', { fator: 0.1 }),
    fsd: m.g('fyd_', 'f_{sd}', 1, 'MPa'),
    fsd01: m.g('fyd_', 'f_{sd}', 2, 'kN/cm²', { fator: 0.1 }),
    hf: m.g('hf_bl', 'h_f', 1, 'cm'),
    mmod: m.g('m_mod', 'm', 0, 'cm'),
    d: m.g('d_util', 'd', 2, 'cm'),
    Md100: m.g('Md_', 'M_d', 1, 'kN·cm/m', { fator: 100 }),
    Md: m.g('Md_', 'M_d', 2, 'kN·m/m'),
    Vk: m.g('Vk_', 'V_k', 2, 'kN/m'),
    kmd: m.g('arg_x', 'k_{md}', 3),
    x: m.g('x_ln', 'x', 2, 'cm'),
    z: m.g('z_br', 'z', 2, 'cm'),
    eps: m.g('eps_s', '\\varepsilon_s', 3, '%'),
    sig01: m.g('sig_s', '\\sigma_s', 2, 'kN/cm²', { fator: 0.1 }),
    AsNec: m.g('As_nec', 'A_{s,nec}', 2, 'cm²/m'),
    As14: m.g('As_14', 'A_{s,1{,}4}', 2, 'cm²/m'),
    AsMin: m.g('As_min', 'A_{s,min}', 2, 'cm²/m'),
    AsCalc: m.g('As_calc', 'A_{s,calc}', 2, 'cm²/m'),
    Asb: m.g('As_barra', 'A_{s1}', 3, 'cm²'),
    scalc: m.g('s_calc', 's_{calc}', 1, 'cm'),
    s: m.g('s_adot', 's', 0, 'cm'),
    AsEf: m.g('As_ef', 'A_{s,ef}', 2, 'cm²/m'),
    rho: m.g('rho_v', '\\rho', 4),
    fvd: m.g('fvd', 'f_{vd}', 3, 'MPa'),
    Vsd: m.g('Vsd_', 'V_{sd}', 2, 'kN/m'),
    Va: m.g('Va_', 'V_a', 2, 'kN/m'),
    lbReta: m.g('lb_reta', '\\ell_b', 1, 'cm'),
    lbTab: m.g('lb_tab', '\\ell_{b,gancho}', 1, 'cm'),
    rAnc: m.g('r_anc', 'A_{s,nec}/A_{s,ef}', 3),
    lbNec: m.g('lb_nec', '\\ell_{b,nec}', 1, 'cm'),
    lbMin: m.g('lb_min', '\\ell_{b,min}', 1, 'cm'),
    dc: m.g('d_c', 'd_c', 2, 'cm'),
    kmdc: m.g('arg_c', 'k_{md,c}', 3),
    xc: m.g('x_c', 'x_c', 2, 'cm'),
  };
}

type Folhas = ReturnType<typeof folhas>;

/** O estado da conta que decide QUAL conta contar (espelho dos IFs da planilha). */
function contexto(m: Memoria) {
  const total = comeca(m.texto('Graute'), 'Total');              // LEFT(Graute,5)="Total"
  const liquida = comeca(m.texto('fpk_ref'), 'Líqu');            // LEFT(fpk_ref,4)="Líqu"
  const t = m.num('t_bloco') ?? 0;
  const d = m.num('d_util') ?? 0;
  return {
    balanco: m.texto('Tipo_muro') === 'Balanço',
    total,
    liquida,
    // fpk_ = IF(Líqu; fpk_liq; fpk_tab), e fpk_liq = fpk_tab quando o grauteamento é total
    usaLiq: liquida && !total,
    t,
    // IF(d_util<=t_bloco/2+0.01; "— (cálculo já está com a barra centralizada)"; ...)
    encostada: d > t / 2 + 0.01,
  };
}

type Ctx = ReturnType<typeof contexto>;

/** fpk_tab = IF(LEFT(Graute,5)="Total"; fpk*; fpk) — a folha da célula que de fato entra. */
const fpkDaTabela = (f: Folhas, c: Ctx): Expr => (c.total ? f.fpkChei : f.fpkOco);

/** O fpk usado na flexão (fpk_): líquido, ou o da tabela. */
const fpkUsado = (f: Folhas, c: Ctx): Expr => (c.usaLiq ? f.fpkLiq : fpkDaTabela(f, c));

// ───────────────────────────── 1 · materiais e seção ─────────────────────────────

function cardMateriais(m: Memoria, f: Folhas, c: Ctx): Card {
  const num = (id: string) => m.valor(id) !== null;
  const kDigitado = m.num('K_dir') !== null;                      // ISNUMBER(K_dir)
  const dDigitado = m.num('d_dir') !== null;                      // ISNUMBER(d_dir)
  const daTabela = 'tabela';
  const refBloco = BLOCOS_122;

  const resistencia = secao('Resistência da alvenaria', [
    m.passo('fbk_', 'f_{bk}', null, {
      casas: 1, unidade: 'MPa', origem: 'entrada', ref: { fonte: 'Aula 12.1', item: 'slide 2' },
      verif: { chave: 'balanco.classeA', rotulo: 'Bloco classe A: fbk ≥ 8 MPa', limite: 8, relacao: '>=', celula: VER.classeA, casasLimite: 0 },
    }),
    c.total
      ? m.passo('fpk_chei', 'f_{pk}^{*}', null, { casas: 1, unidade: 'MPa', origem: daTabela, ref: { fonte: 'ABCP', item: 'Tab. 3.2' } })
      : m.passo('fpk_oco', 'f_{pk}', null, { casas: 1, unidade: 'MPa', origem: daTabela, ref: { fonte: 'ABCP', item: 'Tab. 3.2' } }),
    c.usaLiq && m.passo('r_liq', 'A_{liq}/A_{br}', null, { casas: 2, origem: daTabela, ref: refBloco }),
    c.usaLiq && num('fpk_liq') && m.passo('fpk_liq', 'f_{pk,liq}', div(f.fpkOco, f.rliq), { casas: 2, unidade: 'MPa', ref: NBR('11.3.5') }),
    num('fk_') && m.passo('fk_', 'f_k', mul(cte(0.7, 1), fpkUsado(f, c)), { casas: 2, unidade: 'MPa', ref: NBR('6.2.2.3') }),
    m.entrada('gama_m', '\\gamma_m', { ref: NBR('6.2.2.2') }),
    num('fd_') && m.passo('fd_', 'f_d', div(f.fk, f.gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.1') }),
    // K = IF(ISNUMBER(K_dir); K_dir; IF(Total; 2; 1,5)): digitado (a planilha 04 do curso usa 1) ou o da norma
    m.passo('k_flex', 'K', null, { casas: 2, origem: kDigitado ? 'entrada' : 'tabela', ref: kDigitado ? undefined : NBR('6.2.2.4') }),
    num('ffd_') && m.passo('ffd_', 'K\\,f_d', mul(f.K, f.fd), { casas: 3, unidade: 'MPa', ref: CURSO_04 }),
  ]);

  // fsd = fyd no bloco de concreto (todo Ø)
  const fyd = div(f.fyk, f.gs);
  const aco = secao('Aço', [
    m.entrada('fyk_', 'f_{yk}'),
    m.entrada('gama_s', '\\gamma_s', { ref: NBR('6.2.2.2') }),
    num('fyd_') && m.passo('fyd_', 'f_{sd}', fyd, { casas: 1, unidade: 'MPa', ref: NBR('11.3.3') }),
  ]);

  // m = (L + 1)/2 — família 39 (14×39 e 19×39)
  const L = f.L;
  // d sugerido = t − parede (3,5 no 19; 2,7 no 14, constante da planilha) − 1,5 cm de graute − Ø/2
  const parede = c.t === 19 ? 3.5 : 2.7;
  const secaoI = secao('Seção (faixa b = 100 cm)', [
    m.entrada('t_bloco', 't'),
    m.passo('hf_bl', 'h_f', null, { casas: 1, unidade: 'cm', origem: daTabela, ref: refBloco }),
    num('m_mod') && m.passo('m_mod', 'm', div(soma(L, cte(1, 0)), cte(2, 0)), { casas: 0, unidade: 'cm' }),
    m.passo('d_sug', 'd_{sug}', sub(sub(sub(f.t, cte(parede, 1)), cte(1.5, 1)), div(f.phiCm, cte(2, 0))), {
      casas: 2, unidade: 'cm', ref: NBR('12.1'),
    }),
    dDigitado
      ? m.passo('d_util', 'd', null, { casas: 2, unidade: 'cm', origem: 'entrada', ref: AULA_122 })
      : m.passo('d_util', 'd', div(f.t, cte(2, 0)), { casas: 2, unidade: 'cm' }),
  ]);

  return {
    id: 'balanco.materiais',
    titulo: 'Materiais e seção · muro em balanço',
    ref: AULA_122,
    figura: 'Fig. 3',
    secoes: so([resistencia, aco, secaoI]),
    avisos: [],
    aplicavel: c.balanco,
  };
}

// ───────────────────────────── 2 · flexão ─────────────────────────────

function cardFlexao(m: Memoria, f: Folhas, c: Ctx): Card {
  const v = (id: string) => m.valor(id);
  const xN = v('x_ln');
  const Md = v('Md_');
  const asNec = v('As_nec');
  const asCalc = v('As_calc');
  const sAdot = v('s_adot') ?? 0;
  const sDigitado = m.num('s_dir') !== null;                     // ISNUMBER(s_dir)
  const minCurso = comeca(m.texto('AsMin_crit'), 'Curso');        // LEFT(AsMin_crit,5)="Curso"

  // A verificação "0,8x ≤ hf" só vale com fpk líquido e seção I (parcial) — a célula diz "não se aplica" no resto.
  // A planilha não tem célula para 0,8x: o limite sai da célula de x, e quem decide é o veredito B81.
  const mesa = c.usaLiq && xN !== null && v('hf_bl') !== null;

  const linhaNeutra = secao('Linha neutra (b = 100 cm)', [
    v('arg_x') !== null && m.passo('arg_x', 'k_{md}', div(f.Md100, mul(cte(0.5, 1), cte(100, 0), pot(f.d, 2), f.Kfd01)), {
      casas: 3, ref: { fonte: 'ABCP', item: '3.4' },
      verif: { chave: 'balanco.flexao.resiste', rotulo: 'Armadura simples: k_md < 1', limite: LIMITE_KMD, relacao: '<=', celula: VER.resiste, casasLimite: 0 },
    }),
    xN !== null && m.passo('x_ln', 'x', mul(cte(1.25, 2), f.d, sub(cte(1, 0), raiz(sub(cte(1, 0), f.kmd)))), {
      casas: 2, unidade: 'cm', ref: NBR('11.3.3'),
    }),
    mesa && m.passo('hf_bl', 'h_f', null, {
      casas: 1, unidade: 'cm', origem: 'tabela', ref: { fonte: 'Dedução' },
      verif: { chave: 'balanco.flexao.mesa', rotulo: 'Compressão na parede do bloco: 0,8x ≤ hf', limite: 0.8 * xN!, relacao: '>=', celula: VER.mesa },
      limiteTex: `0{,}8\\,x = 0{,}8 \\times ${nt(xN!, 2)} = ${nt(0.8 * xN!, 2)}\\,\\mathrm{cm}`,
    }),
    v('x_d') !== null && m.passo('x_d', 'x/d', div(f.x, f.d), {
      casas: 3, ref: NBR('11.3.3'),
      verif: { chave: 'balanco.flexao.ductilidade', rotulo: 'Ductilidade x/d ≤ 0,45', limite: 0.45, relacao: '<=', celula: VER.ductil, casasLimite: 2 },
    }),
    v('z_br') !== null && m.passo('z_br', 'z', min(sub(f.d, mul(cte(0.4, 1), f.x)), mul(cte(0.95, 2), f.d)), {
      casas: 2, unidade: 'cm', ref: NBR('11.3.3'),
    }),
    v('eps_s') !== null && m.passo('eps_s', '\\varepsilon_s', min(cte(1, 0), div(mul(cte(0.3, 2), sub(f.d, f.x)), f.x)), {
      casas: 3, unidade: '%', ref: NBR('11.1.2'),
    }),
    // Es = 210 GPa; εs em %
    v('sig_s') !== null && m.passo('sig_s', '\\sigma_s', min(div(mul(cte(210000, 0), f.eps), cte(100, 0)), f.fsd), {
      casas: 1, unidade: 'MPa', ref: NBR('11.1.2'),
    }),
  ]);

  // As_14 = IFERROR(1,4·Md/(fyd·z(1,4·Md)); 0,10%·b·t): a conta, ou o valor de reserva quando ela dá erro
  const zDe14 = min(
    sub(f.d, mul(cte(0.4, 1), cte(1.25, 2), f.d, sub(cte(1, 0), raiz(sub(cte(1, 0), mul(cte(1.4, 1), f.kmd)))))),
    mul(cte(0.95, 2), f.d),
  );
  const minNbr = mul(cte(0.001, 3), cte(100, 0), f.t);
  const armadura = secao('Armadura vertical', [
    asNec !== null && (Md !== null && Md <= 0
      ? m.passo('As_nec', 'A_{s,nec}', null, { casas: 2, unidade: 'cm²/m', origem: 'calculado' })
      : m.passo('As_nec', 'A_{s,nec}', div(f.Md100, mul(f.sig01, f.z)), { casas: 2, unidade: 'cm²/m', ref: NBR('11.3.3') })),
    !minCurso && v('As_14') !== null && m.passo('As_14', 'A_{s,1{,}4}', [div(mul(cte(1.4, 1), f.Md100), mul(f.fsd01, zDe14)), minNbr], {
      casas: 2, unidade: 'cm²/m', ref: NBR('12.2'),
    }),
    v('As_min') !== null && m.passo('As_min', 'A_{s,min}', minCurso ? mul(cte(0.0015, 4), cte(100, 0), f.d) : min(minNbr, f.As14), {
      casas: 2, unidade: 'cm²/m', ref: minCurso ? CURSO_04 : NBR('12.2'),
    }),
    asCalc !== null && m.passo('As_calc', 'A_{s,calc}', max(f.AsNec, f.AsMin), { casas: 2, unidade: 'cm²/m' }),
  ]);

  // s_calc = IFERROR(As,barra/As,calc·100; 0); s = múltiplo de m, para baixo; As,ef = IF(s>0; As,barra·100/s; 0)
  const sCalcConta = asCalc !== null && asCalc > 0;
  const barras = secao('Barras adotadas', [
    m.entrada('phi_v', '\\phi'),
    m.passo('As_barra', 'A_{s1}', div(mul(pi(), pot(f.phiCm, 2)), cte(4, 0)), { casas: 3, unidade: 'cm²' }),
    sCalcConta
      ? m.passo('s_calc', 's_{calc}', mul(div(f.Asb, f.AsCalc), cte(100, 0)), { casas: 1, unidade: 'cm' })
      : m.passo('s_calc', 's_{calc}', null, { casas: 1, unidade: 'cm', origem: 'calculado' }),
    sDigitado && m.entrada('s_dir', 's_{dig}'),
    m.passo('s_adot', 's', sDigitado
      ? mul(arredBaixo(div(f.sdir, f.mmod)), f.mmod)
      : mul(min(arredBaixo(div(f.scalc, f.mmod)), arredBaixo(div(mul(cte(6, 0), f.t), f.mmod))), f.mmod), {
      casas: 0, unidade: 'cm', ref: NBR('11.3.5'),
      verif: { chave: 'balanco.flexao.cabe', rotulo: 'Barra cabe na grade: s ≥ m', limite: f.mmod, relacao: '>=', celula: VER.cabe },
    }),
    m.passo('As_ef', 'A_{s,ef}', sAdot > 0 ? div(mul(f.Asb, cte(100, 0)), f.s) : null, {
      casas: 2, unidade: 'cm²/m', origem: 'calculado',
      verif: asCalc !== null
        ? { chave: 'balanco.flexao.As', rotulo: 'As,ef ≥ As,calc', limite: f.AsCalc, relacao: '>=', celula: VER.As }
        : undefined,
    }),
  ]);

  const avisos: string[] = [];
  if (c.encostada) avisos.push('Barra encostada no lado do solo (d > t/2): indicar em planta, corte e notas');
  const coerente = m.r.cel(VER.coerente);
  if (typeof coerente === 'string' && comeca(coerente, 'ATENÇÃO')) avisos.push('Barra em todos os furos: grautear todos (seção cheia)');

  return {
    id: 'balanco.flexao',
    titulo: 'Flexão · muro em balanço',
    ref: AULA_122,
    figura: 'Fig. 4',
    secoes: so([linhaNeutra, armadura, barras]),
    avisos,
    aplicavel: c.balanco,
  };
}

// ───────────────────────────── 3 · cisalhamento ─────────────────────────────

function cardCisalhamento(m: Memoria, f: Folhas, c: Ctx): Card {
  const v = (id: string) => m.valor(id);
  const fvdOk = v('fvd') !== null;
  // fvk = 0,35 + 17,5ρ ≤ 0,7 com ρ ≤ 2%: como 0,35 + 17,5·0,02 = 0,70, o teto de ρ nunca muda o número e a
  // forma do curso basta; a da planilha (com o mín de ρ) fica de rede.
  const fvk = (rho: Expr) => min(soma(cte(0.35, 2), mul(cte(17.5, 1), rho)), cte(0.7, 1));

  const cis = secao('Cisalhamento (b = 100 cm)', [
    v('rho_v') !== null && m.passo('rho_v', '\\rho', div(f.AsEf, mul(cte(100, 0), f.d)), { casas: 4, ref: NBR('6.2.2.6') }),
    fvdOk && m.passo('fvd', 'f_{vd}', [div(fvk(f.rho), f.gm), div(fvk(min(f.rho, cte(0.02, 2))), f.gm)], {
      casas: 3, unidade: 'MPa', ref: NBR('6.2.2.6'),
    }),
    v('Vsd_') !== null && m.passo('Vsd_', 'V_{sd}', mul(f.gf, f.Vk), { casas: 2, unidade: 'kN/m' }),
    // τvd = γf·Vk/(b·d), em kN/cm² × 10 = MPa
    v('tau_vd') !== null && m.passo('tau_vd', '\\tau_{vd}', mul(div(f.Vsd, mul(cte(100, 0), f.d)), cte(10, 0)), {
      casas: 3, unidade: 'MPa', ref: NBR('11.4.1'),
      verif: fvdOk
        ? { chave: 'balanco.cisalhamento', rotulo: 'Cisalhamento τvd ≤ fvd', limite: f.fvd, relacao: '<=', celula: VER.tau }
        : undefined,
    }),
    v('Va_') !== null && m.passo('Va_', 'V_a', mul(div(f.fvd, cte(10, 0)), cte(100, 0), f.d), { casas: 2, unidade: 'kN/m', ref: NBR('11.4.3') }),
    // VRd2 = Va + 0,4·√fpk/γm·b·d (MPa·cm² ÷ 10 = kN); fpk da tabela, área bruta
    v('Vrd2_') !== null && m.passo('Vrd2_', 'V_{Rd2}',
      soma(f.Va, div(mul(cte(0.4, 1), raiz(fpkDaTabela(f, c)), cte(100, 0), f.d), mul(cte(10, 0), f.gm))), {
        casas: 2, unidade: 'kN/m', ref: NBR('11.4.3'),
        verif: { chave: 'balanco.bielas', rotulo: 'Bielas Vsd ≤ VRd2', limite: f.Vsd, relacao: '>=', celula: VER.bielas },
      }),
  ]);

  return {
    id: 'balanco.cisalhamento',
    titulo: 'Cisalhamento · muro em balanço',
    ref: { fonte: 'Curso', item: 'planilha 05' },
    figura: 'Fig. 4',
    secoes: so([cis]),
    avisos: [],
    aplicavel: c.balanco,
  };
}

// ───────────────────────────── 4 · ancoragem na fundação ─────────────────────────────

function cardAncoragem(m: Memoria, f: Folhas, c: Ctx): Card {
  const v = (id: string) => m.valor(id);
  const gancho = m.texto('gancho_').toLowerCase() === 'sim';     // IF(gancho_="Sim"; tabela com gancho; reta)
  const asNec = v('As_nec');
  const asEf = v('As_ef');
  const lbReta = m.r.v('lb_reta');

  // r = IFERROR(MIN(1; As,nec/As,ef); 1): sem As,nec (seção não resiste) ou com As,ef = 0, a planilha usa 1
  const rConta = asNec !== null && asEf !== null && asEf !== 0;
  const tabela = [
    m.texto('fck_fund'),
    `aderência ${m.texto('zona_ad').toLowerCase()}`,
    gancho ? 'com gancho' : 'reta',
  ].join(' · ');

  const comprimento = secao(`Tabela ${tabela}`, [
    // "Ø fora da tabela" é texto da planilha: sai como está, sem conta
    typeof lbReta === 'number' || typeof lbReta === 'string'
      ? m.passo('lb_reta', '\\ell_b', null, { casas: 1, unidade: 'cm', origem: 'tabela' })
      : null,
    gancho && v('lb_tab') !== null && m.passo('lb_tab', '\\ell_{b,gancho}', null, { casas: 1, unidade: 'cm', origem: 'tabela' }),
  ], AULA_122);

  const adotado = secao('Comprimento adotado', [
    rConta
      ? m.passo('r_anc', 'A_{s,nec}/A_{s,ef}', min(cte(1, 0), div(f.AsNec, f.AsEf)), { casas: 3 })
      : m.passo('r_anc', 'A_{s,nec}/A_{s,ef}', null, { casas: 3, origem: 'adotado' }),
    v('lb_nec') !== null && m.passo('lb_nec', '\\ell_{b,nec}', mul(gancho ? f.lbTab : f.lbReta, f.rAnc), {
      casas: 1, unidade: 'cm',
    }),
    // 10Ø em cm = Ø em mm, como a planilha escreve
    v('lb_min') !== null && m.passo('lb_min', '\\ell_{b,min}', max(mul(cte(0.3, 1), f.lbReta), mul(cte(10, 0), f.phiCm), cte(10, 0)), {
      casas: 1, unidade: 'cm',
    }),
    v('lb_adot') !== null && m.passo('lb_adot', '\\ell_{b,adot}', arredCima(max(f.lbNec, f.lbMin)), { casas: 0, unidade: 'cm' }),
  ], NBR6118_ANC);

  return {
    id: 'balanco.ancoragem',
    titulo: 'Ancoragem na fundação · muro em balanço',
    ref: NBR('12.7.2'),
    figura: 'Fig. 9',
    secoes: so([comprimento, adotado]),
    avisos: [],
    aplicavel: c.balanco,
  };
}

// ───────────────────────────── 5 · barra centralizada (robustez) ─────────────────────────────

/*
  "E se a barra for centralizada na obra?" — a conta com d = t/2, para mostrar se o projeto tolera o erro de obra
  mais comum. Não é verificação de norma (a célula responde SIM/NÃO, não OK): sem chip, com aviso quando NÃO.
  Só aparece quando o cálculo foi feito com a barra encostada (d > t/2), como a célula rob_c.
*/
function cardBarraCentralizada(m: Memoria, f: Folhas, c: Ctx): Card {
  const v = (id: string) => m.valor(id);
  const Md = v('Md_');
  const asC = v('As_c');
  const zc = min(sub(f.dc, mul(cte(0.4, 1), f.xc)), mul(cte(0.95, 2), f.dc));
  // Com x/d ≤ 0,45 (condição para a planilha publicar As) o aço escoa e σs = fsd: a forma curta reproduz a célula;
  // a da planilha (σs = mín(Es·εs; fsd)) fica de rede.
  const epsc = min(cte(1, 0), div(mul(cte(0.3, 2), sub(f.dc, f.xc)), f.xc));
  const sigc = min(div(mul(cte(210000, 0), epsc), cte(100, 0)), f.fsd);
  const asCurta = max(div(f.Md100, mul(f.fsd01, zc)), f.AsMin);
  const asPlanilha = max(div(f.Md100, mul(div(sigc, cte(10, 0)), zc)), f.AsMin);

  const sec = secao('Barra no meio do furo (d = t/2)', [
    m.passo('d_c', 'd_c', div(f.t, cte(2, 0)), { casas: 2, unidade: 'cm' }),
    v('arg_c') !== null && m.passo('arg_c', 'k_{md,c}', div(f.Md100, mul(cte(0.5, 1), cte(100, 0), pot(f.dc, 2), f.Kfd01)), { casas: 3 }),
    v('x_c') !== null && m.passo('x_c', 'x_c', mul(cte(1.25, 2), f.dc, sub(cte(1, 0), raiz(sub(cte(1, 0), f.kmdc)))), { casas: 2, unidade: 'cm' }),
    v('xd_c') !== null && m.passo('xd_c', 'x_c/d_c', div(f.xc, f.dc), { casas: 3 }),
    asC !== null && (Md !== null && Md <= 0
      ? m.passo('As_c', 'A_{s,c}', f.AsMin, { casas: 2, unidade: 'cm²/m' })
      : m.passo('As_c', 'A_{s,c}', [asCurta, asPlanilha], { casas: 2, unidade: 'cm²/m' })),
  ]);

  const rob = m.texto('rob_c');
  const avisos = comeca(rob, 'NÃO') ? ['Com a barra no meio do furo não atende: o projeto depende da barra encostada'] : [];

  return {
    id: 'balanco.centralizada',
    titulo: 'Barra centralizada · muro em balanço',
    ref: { fonte: 'Dedução' },
    figura: 'Fig. 4',
    secoes: so([sec]),
    avisos,
    aplicavel: c.balanco && c.encostada,
  };
}

// ───────────────────────────── 6 · arranjos por faixa ─────────────────────────────

/*
  A aba Arranjos: um furo armado a cada bm = m, 2m … 6m (linhas 5 a 10). A linha neutra não depende de bm, então
  a armadura da faixa é a do metro × bm/100. A faixa do espaçamento adotado sai com a conta inteira; as outras,
  só com a armadura e o Ø sugerido. Sem As do momento (seção não resiste) a tabela é "—" e não entra.
*/
function cardArranjos(m: Memoria, f: Folhas, c: Ctx): Card {
  const s = m.num('s_adot') ?? 0;
  const cel = (col: string, lin: number) => `Arranjos!${col}${lin}`;

  const largura = secao('Largura por barra', [
    // A planilha não tem célula para 6t: o limite sai da espessura t (entrada), e quem decide é o veredito B89.
    m.passo('s_adot', 's', null, {
      casas: 0, unidade: 'cm', origem: 'calculado', ref: NBR('11.3.5'),
      verif: { chave: 'balanco.largura6t', rotulo: 'Largura por barra: s ≤ 6t', limite: 6 * c.t, relacao: '<=', celula: VER.seisT },
      limiteTex: `6\\,t = 6 \\times ${nt(c.t, 0)} = ${nt(6 * c.t, 0)}\\,\\mathrm{cm}`,
    }),
  ]);

  const faixas: Secao[] = [];
  for (let i = 0; i < 6; i++) {
    const lin = 5 + i;
    const bmN = m.valor(cel('A', lin));
    if (bmN === null || m.valor(cel('E', lin)) === null) continue;
    const bm = m.g(cel('A', lin), 'b_m', 0, 'cm');
    const asFaixa = max(div(mul(f.AsNec, bm), cte(100, 0)), div(mul(f.AsMin, bm), cte(100, 0)));
    const phiSug = m.valor(cel('F', lin));                   // número (mm)
    const phiTxt = m.r.cel(cel('F', lin));                   // ou o texto "> Ø20" (nenhuma barra da lista atende)
    const mostraPhi = phiSug !== null || (typeof phiTxt === 'string' && phiTxt.trim() !== '' && !phiTxt.startsWith('—'));
    const detalhe = bmN === s;
    const fora = comeca(String(m.r.cel(cel('J', lin)) ?? ''), 'não');
    const phiSugCm = m.g(cel('F', lin), '\\phi_{sug}', 2, 'cm', { fator: 0.1 });
    const asPhi = m.g(cel('G', lin), 'A_{s1,sug}', 3, 'cm²');
    faixas.push(secao(`Faixa de ${nbr(bmN, 0)} cm${detalhe ? ' (espaçamento adotado)' : ''}${fora ? ' · acima de 6t' : ''}`, [
      detalhe && m.passo(cel('A', lin), 'b_m', mul(cte(i + 1, 0), f.mmod), { casas: 0, unidade: 'cm' }),
      detalhe && m.valor(cel('B', lin)) !== null && m.passo(cel('B', lin), 'M_{d,f}', mul(f.Md, bm), { casas: 0, unidade: 'kN·cm' }),
      m.passo(cel('E', lin), 'A_{s,f}', asFaixa, { casas: 2, unidade: 'cm²' }),
      mostraPhi && m.passo(cel('F', lin), '\\phi_{sug}', null, { casas: 1, unidade: 'mm', origem: 'tabela' }),
      detalhe && phiSug !== null && m.valor(cel('G', lin)) !== null
        && m.passo(cel('G', lin), 'A_{s1,sug}', div(mul(pi(), pot(phiSugCm, 2)), cte(4, 0)), { casas: 3, unidade: 'cm²' }),
      detalhe && m.valor(cel('H', lin)) !== null
        && m.passo(cel('H', lin), 'A_{s,sug}', div(mul(asPhi, cte(100, 0)), bm), { casas: 2, unidade: 'cm²/m' }),
    ]));
  }

  return {
    id: 'balanco.arranjos',
    titulo: 'Arranjos de barras · muro em balanço',
    ref: AULA_122,
    figura: 'Fig. 5',
    secoes: so([largura, ...faixas]),
    avisos: [],
    aplicavel: c.balanco,
  };
}

/** Autor do grupo: aba "Muro em balanço" (depois do Md) e aba "Arranjos". Só aparece no muro em balanço. */
export const autorBalanco: AutorDeCards = (r) => {
  const m = memoriaDe(r);
  const f = folhas(m);
  const c = contexto(m);
  return [
    cardMateriais(m, f, c),
    cardFlexao(m, f, c),
    cardCisalhamento(m, f, c),
    cardAncoragem(m, f, c),
    cardBarraCentralizada(m, f, c),
    cardArranjos(m, f, c),
  ];
};
