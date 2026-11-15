/*
  MOMENTO RESISTENTE COM A ARMADURA ADOTADA (etapa 1b, 15/11) — a mesma conta de As da aba, DESFEITA: com o aço que
  foi para a obra, F = As,ef·fsd = C → x → M = F·z, limitado pelo x que a aba confere. As linhas seguem a cadeia que
  a planilha publica (Fas_ → xas_ → Mas_ → xlim_ → Mlim_ → MRf_ e MRd_ de cada peça) para o engenheiro ver de onde sai o MRd
  que a vista Esforços desenha, e terminam no aproveitamento (MSd/MRd).

  Só narra: nenhuma linha tem `verif` — o veredito dos cards continua sendo o das verificações que já existiam (o
  As,ef ≥ As,calc, o x/d). Cada linha some quando a célula dela não tem número (entrada em branco, peça que não há).
  Onde a fórmula da planilha tem IF, a linha recebe as formas possíveis e fica a que dá o número da célula.
*/
import type { Expr, Ref, Secao } from '../tipos';
import { cte, div, mul, soma, sub } from '../expr';
import { secao, type Memoria } from '../passo';

const NBR16868 = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });
const NBR6118 = (item: string): Ref => ({ fonte: 'NBR 6118', item });

export const SIMBOLOS_MRD: Readonly<Record<string, string>> = {
  'F_{s,ef}': 'força no aço com a armadura adotada (As,ef · fsd)',
  'x_{As}': 'linha neutra com a armadura adotada',
  'M_{As}': 'momento com a armadura adotada (força no aço × braço)',
  'x_{lim}': 'linha neutra limite que a aba confere',
  'F_{lim}': 'força de compressão com a linha neutra no limite',
  'M_{lim}': 'momento com a linha neutra no limite',
  'F_{mesa}': 'força de compressão que cabe na parede do bloco',
  'F_{b}': 'força de compressão que cabe na mesa do T',
  'M_{Rd,faixa}': 'momento resistente na largura da conta',
  'M_{Rd}': 'momento resistente de cálculo com a armadura adotada',
  'U_M': 'aproveitamento à flexão: momento de cálculo ÷ momento resistente',
  // o contraforte do outro tipo (extremidade × intermediário) e a ligação do pilarete no mesmo card
  'b_{m,cf,o}': 'largura colaborante da mesa do contraforte do outro tipo',
  'C_{f,cf,o}': 'força nas abas da mesa do contraforte do outro tipo',
  'M_{d,cf,o}': 'momento de cálculo na base do contraforte do outro tipo',
  'x_{As,o}': 'linha neutra com a armadura adotada, contraforte do outro tipo',
  'M_{As,o}': 'momento com a armadura adotada, contraforte do outro tipo',
  'F_{b,o}': 'força de compressão que cabe na mesa do T do outro tipo',
  'F_{lim,o}': 'força de compressão no limite, contraforte do outro tipo',
  'M_{lim,o}': 'momento no limite, contraforte do outro tipo',
  'M_{Rd,o}': 'momento resistente do contraforte do outro tipo',
  'U_{M,o}': 'aproveitamento à flexão do contraforte do outro tipo',
  'F_{s,lig}': 'força no aço do pilarete dentro do arrimo',
  'x_{As,lig}': 'linha neutra da ligação do pilarete com a armadura adotada',
  'M_{As,lig}': 'momento da ligação com a armadura adotada',
  'x_{lim,lig}': 'linha neutra limite da ligação',
  'M_{lim,lig}': 'momento da ligação com a linha neutra no limite',
  'M_{Rd,faixa,lig}': 'momento resistente da ligação na largura dela',
  'M_{Rd,lig}': 'momento resistente da ligação do pilarete no arrimo',
  'U_{M,lig}': 'aproveitamento à flexão da ligação do pilarete',
  'A_{s,ef,s}': 'armadura principal efetiva da sapata, por metro',
  'M_{Sd,cin}': 'momento de cálculo da canaleta do topo (empuxo + vento)',
  'M_{Rd,cin}': 'momento resistente da canaleta do topo na faixa dela',
  'U_{M,cin}': 'aproveitamento à flexão da canaleta do topo',
  'U_{M,solo}': 'aproveitamento à flexão do painel vertical, lado do solo',
  'U_{M,ext}': 'aproveitamento à flexão do painel vertical, face externa',
  'M_{R,\\parallel}': 'momento resistente da alvenaria não armada, paralelo às juntas',
  'M_{R,\\perp}': 'momento resistente da alvenaria não armada, normal às juntas',
  'U_{\\parallel}': 'aproveitamento paralelo às juntas (não armada)',
  'U_{\\perp}': 'aproveitamento normal às juntas (não armada)',
};

const temNum = (m: Memoria, id: string) => m.valor(id) !== null;
const DEZ = cte(10, 0);
const CEM = cte(100, 0);
const k = (v: number, casas: number) => cte(v, casas);

/** O braço da alvenaria (NBR 16868-1 11.3): 0,95d até x = 0,125d, d − 0,4x depois. */
const bracos = (F: Expr, d: Expr, x: Expr): Expr[] => [mul(F, k(0.95, 2), d), mul(F, sub(d, mul(k(0.4, 1), x)))];

interface Simbolos { F: string; x: string; M: string; xl: string; Ml: string; Mf: string; MRd: string; U: string }
const SIMB: Simbolos = { F: 'F_{s,ef}', x: 'x_{As}', M: 'M_{As}', xl: 'x_{lim}', Ml: 'M_{lim}', Mf: 'M_{Rd,faixa}', MRd: 'M_{Rd}', U: 'U_M' };
const SIMB_LIG: Simbolos = { F: 'F_{s,lig}', x: 'x_{As,lig}', M: 'M_{As,lig}', xl: 'x_{lim,lig}', Ml: 'M_{lim,lig}', Mf: 'M_{Rd,faixa,lig}', MRd: 'M_{Rd,lig}', U: 'U_{M,lig}' };

/**
 * A cadeia da seção retangular (painel, canaleta, pilarete, ligação, sapata, dente): F → x → M → x,lim → M,lim →
 * MRd na faixa. `tensao` = a tensão do bloco retangular já em kN/cm² (0,8·K·fd/10 na alvenaria, 0,68·fcd/10 no
 * concreto); `braco` = as formas do braço.
 */
function cadeiaRetangular(
  m: Memoria,
  s: string,
  o: {
    simb: Simbolos; F: Expr; tensao: (alternativa: number) => Expr; nTensoes: number; b: Expr; d: Expr; xlim: number; ref: Ref; alvenaria: boolean;
    uM: string; uF: string;
  },
) {
  const fF = m.g(`Fas_${s}`, o.simb.F, 2, o.uF);
  const fx = m.g(`xas_${s}`, o.simb.x, 2, 'cm');
  const fxl = m.g(`xlim_${s}`, o.simb.xl, 2, 'cm');
  const fM = m.g(`Mas_${s}`, o.simb.M, 1, o.uM);
  const fMl = m.g(`Mlim_${s}`, o.simb.Ml, 1, o.uM);
  const tensoes = Array.from({ length: o.nTensoes }, (_, i) => o.tensao(i));
  return {
    folhas: { fF, fx, fxl, fM, fMl, Mf: m.g(`MRf_${s}`, o.simb.Mf, 1, o.uM) },
    passos: [
      temNum(m, `Fas_${s}`) && m.passo(`Fas_${s}`, o.simb.F, o.F, { casas: 2, unidade: o.uF, ref: o.ref }),
      temNum(m, `xas_${s}`) && m.passo(`xas_${s}`, o.simb.x, tensoes.map((t) => div(fF, mul(t, o.b))), { casas: 2, unidade: 'cm', ref: o.ref }),
      temNum(m, `Mas_${s}`) && m.passo(`Mas_${s}`, o.simb.M, o.alvenaria ? bracos(fF, o.d, fx) : [mul(fF, sub(o.d, mul(k(0.4, 1), fx)))], { casas: 1, unidade: o.uM, ref: o.ref }),
      temNum(m, `xlim_${s}`) && m.passo(`xlim_${s}`, o.simb.xl, mul(k(o.xlim, 2), o.d), { casas: 2, unidade: 'cm', ref: o.ref }),
      temNum(m, `Mlim_${s}`) && m.passo(`Mlim_${s}`, o.simb.Ml, tensoes.map((t) => mul(t, o.b, fxl, sub(o.d, mul(k(0.4, 1), fxl)))), { casas: 1, unidade: o.uM, ref: o.ref }),
    ],
  };
}

const tensaoAlvenaria = (Kfd: Expr) => mul(k(0.8, 1), div(Kfd, DEZ));
const tensaoConcreto = (fcd: Expr) => mul(k(0.68, 2), div(fcd, DEZ));

// ───────────────────────────── balanço (seção T real da faixa de 1 m) ─────────────────────────────

export function secaoMRdBalanco(m: Memoria): Secao | null {
  if (!temNum(m, 'MRd_bal')) return null;
  const ref = NBR16868('11.3');
  const As = m.g('As_ef', 'A_{s,ef}', 2, 'cm²/m');
  const fyd = m.g('fyd_', 'f_{sd}', 1, 'MPa');
  const ffm = m.g('ffd_m', 'K\\,f_{d,mesa}', 3, 'MPa');
  const ffg = m.g('ffd_g', 'K\\,f_{d,alma}', 3, 'MPa');
  const bw = m.g('bw_m', 'b_{w,m}', 2, 'cm/m');
  const hf = m.g('hf_bl', 'h_f', 1, 'cm');
  const d = m.g('d_util', 'd', 2, 'cm');
  const F = m.g('Fas_bal', SIMB.F, 2, 'kN/m');
  const Fm = m.g('Fm_bal', 'F_{mesa}', 2, 'kN/m');
  const x = m.g('xas_bal', SIMB.x, 2, 'cm');
  const xl = m.g('xlim_bal', SIMB.xl, 2, 'cm');
  const Mas = m.g('Mas_bal', SIMB.M, 1, 'kN·cm/m');
  const Mlim = m.g('Mlim_bal', SIMB.Ml, 1, 'kN·cm/m');
  const mesa = mul(div(ffm, DEZ), CEM);
  const alma = mul(div(ffg, DEZ), bw);
  const fora = (y: Expr) => sub(mul(k(0.8, 1), y), hf);
  return secao('Momento resistente com a armadura adotada', [
    m.passo('Fas_bal', SIMB.F, div(mul(As, fyd), DEZ), { casas: 2, unidade: 'kN/m', ref }),
    m.passo('Fm_bal', 'F_{mesa}', mul(mesa, hf), { casas: 2, unidade: 'kN/m', ref }),
    temNum(m, 'xas_bal') && m.passo('xas_bal', SIMB.x, [div(F, mul(k(0.8, 1), mesa)), div(soma(hf, div(sub(F, Fm), alma)), k(0.8, 1))], { casas: 2, unidade: 'cm', ref }),
    temNum(m, 'Mas_bal') && m.passo('Mas_bal', SIMB.M, [
      ...bracos(F, d, x),
      soma(mul(Fm, sub(d, div(hf, cte(2, 0)))), mul(sub(F, Fm), sub(sub(d, hf), div(fora(x), cte(2, 0))))),
    ], { casas: 1, unidade: 'kN·cm/m', ref }),
    m.passo('xlim_bal', SIMB.xl, mul(k(0.45, 2), d), { casas: 2, unidade: 'cm', ref: NBR16868('11.3.3') }),
    m.passo('Flim_bal', 'F_{lim}', [mul(mesa, k(0.8, 1), xl), soma(Fm, mul(alma, fora(xl)))], { casas: 2, unidade: 'kN/m', ref }),
    m.passo('Mlim_bal', SIMB.Ml, [
      mul(mesa, k(0.8, 1), xl, sub(d, mul(k(0.4, 1), xl))),
      soma(mul(Fm, sub(d, div(hf, cte(2, 0)))), mul(alma, fora(xl), sub(sub(d, hf), div(fora(xl), cte(2, 0))))),
    ], { casas: 1, unidade: 'kN·cm/m', ref }),
    m.passo('MRd_bal', SIMB.MRd, [div(Mas, CEM), div(Mlim, CEM)], { casas: 2, unidade: 'kN·m/m', ref }),
    temNum(m, 'ap_bal') && m.passo('ap_bal', SIMB.U, div(m.g('Md_', 'M_d', 2, 'kN·m/m'), m.g('MRd_bal', SIMB.MRd, 2, 'kN·m/m')), { casas: 3 }),
  ], ref);
}

// ───────────────────────────── contraforte (T enterrado / retangular aparente) ─────────────────────────────

export function secoesMRdContraforte(m: Memoria): Secao[] {
  if (!temNum(m, 'MRd_cf')) return [];
  const ref = NBR16868('11.3');
  const As = m.g('As_cfe', 'A_{s,ef,cf}', 2, 'cm²');
  const fsd = m.g('fsd_cf', 'f_{sd,cf}', 1, 'MPa');
  const Kfd = m.g('Kfd_cf', 'K\\,f_{d,cf}', 3, 'MPa');
  const bw = m.g('bw_cf', 'b_{w,cf}', 1, 'cm');
  const hf = m.g('hf_cf', 'h_{f,cf}', 1, 'cm');
  const d = m.g('d_cf', 'd_{cf}', 1, 'cm');
  const F = m.g('Fas_cf', SIMB.F, 2, 'kN');
  const xl = m.g('xlim_cf', SIMB.xl, 2, 'cm');
  const sig = mul(k(0.8, 1), div(Kfd, DEZ));
  const umLado = (o: { bm: Expr; Cf: Expr; Fb: string; x: string; M: string; Fl: string; Ml: string; MRd: string; ap: string; Md: Expr; s: Partial<Record<'Fb' | 'x' | 'M' | 'Fl' | 'Ml' | 'MRd' | 'U', string>> }) => {
    const S = { Fb: o.s.Fb ?? 'F_{b}', x: o.s.x ?? SIMB.x, M: o.s.M ?? SIMB.M, Fl: o.s.Fl ?? 'F_{lim}', Ml: o.s.Ml ?? SIMB.Ml, MRd: o.s.MRd ?? SIMB.MRd, U: o.s.U ?? SIMB.U };
    const x = m.g(o.x, S.x, 2, 'cm');
    const Mas = m.g(o.M, S.M, 1, 'kN·cm');
    const Mlim = m.g(o.Ml, S.Ml, 1, 'kN·cm');
    return [
      temNum(m, o.Fb) && m.passo(o.Fb, S.Fb, mul(div(Kfd, DEZ), o.bm, hf), { casas: 2, unidade: 'kN', ref }),
      temNum(m, o.x) && m.passo(o.x, S.x, [div(sub(F, o.Cf), mul(sig, bw)), div(F, mul(sig, o.bm))], { casas: 2, unidade: 'cm', ref }),
      temNum(m, o.M) && m.passo(o.M, S.M, [soma(mul(o.Cf, sub(d, div(hf, cte(2, 0)))), mul(sub(F, o.Cf), sub(d, mul(k(0.4, 1), x)))), ...bracos(F, d, x)], { casas: 1, unidade: 'kN·cm', ref }),
      temNum(m, o.Fl) && m.passo(o.Fl, S.Fl, [soma(o.Cf, mul(sig, bw, xl)), mul(sig, o.bm, xl)], { casas: 2, unidade: 'kN', ref }),
      temNum(m, o.Ml) && m.passo(o.Ml, S.Ml, [
        soma(mul(o.Cf, sub(d, div(hf, cte(2, 0)))), mul(sig, bw, xl, sub(d, mul(k(0.4, 1), xl)))),
        mul(sig, o.bm, xl, sub(d, mul(k(0.4, 1), xl))),
      ], { casas: 1, unidade: 'kN·cm', ref }),
      temNum(m, o.MRd) && m.passo(o.MRd, S.MRd, [div(Mas, CEM), div(Mlim, CEM)], { casas: 2, unidade: 'kN·m', ref }),
      temNum(m, o.ap) && m.passo(o.ap, S.U, div(o.Md, m.g(o.MRd, S.MRd, 2, 'kN·m')), { casas: 3 }),
    ];
  };
  const este = secao('Momento resistente com a armadura adotada', [
    m.passo('Fas_cf', SIMB.F, div(mul(As, fsd), DEZ), { casas: 2, unidade: 'kN', ref }),
    m.passo('xlim_cf', SIMB.xl, mul(k(0.45, 2), d), { casas: 2, unidade: 'cm', ref: NBR16868('11.3.3') }),
    ...umLado({
      bm: m.g('bm_cf', 'b_{m,cf}', 1, 'cm'), Cf: m.g('Cf_cf', 'C_{f,cf}', 2, 'kN'), Fb: 'Fb_cf', x: 'xas_cf', M: 'Mas_cf', Fl: 'Flim_cf', Ml: 'Mlim_cf',
      MRd: 'MRd_cf', ap: 'ap_cf', Md: m.g('Md_cf', 'M_{d,cf}', 2, 'kN·m'), s: {},
    }),
  ], ref);
  // o contraforte do outro tipo (extremidade × intermediário): mesma barra e mesmo d, a mesa dele
  const outro = temNum(m, 'MRd_cfo')
    ? secao(`Momento resistente · contraforte ${String(m.texto('tipo_cfo')).toLowerCase()}`, [
      ...umLado({
        bm: m.g('bm_cfo', 'b_{m,cf,o}', 1, 'cm'), Cf: m.g('Cf_cfo', 'C_{f,cf,o}', 2, 'kN'), Fb: 'Fb_cfo', x: 'xas_cfo', M: 'Mas_cfo', Fl: 'Flim_cfo', Ml: 'Mlim_cfo',
        MRd: 'MRd_cfo', ap: 'ap_cfo', Md: m.g('Md_cfo', 'M_{d,cf,o}', 2, 'kN·m'),
        s: { Fb: 'F_{b,o}', x: 'x_{As,o}', M: 'M_{As,o}', Fl: 'F_{lim,o}', Ml: 'M_{lim,o}', MRd: 'M_{Rd,o}', U: 'U_{M,o}' },
      }),
    ], ref)
    : null;
  return [este, outro].filter((s): s is Secao => !!s && s.passos.length > 0);
}

// ───────────────────────────── painel entre contrafortes ─────────────────────────────

export function secaoMRdPainelVertical(m: Memoria): Secao | null {
  if (!temNum(m, 'MRf_pv')) return null;
  const ref = NBR16868('11.3');
  const s = m.g('s_pv', 's_v', 0, 'cm');
  const c = cadeiaRetangular(m, 'pv', {
    simb: SIMB, F: div(mul(m.g('a_pv', 'a_{s,v}', 3, 'cm²'), m.g('fsd_pv', 'f_{sd,v}', 1, 'MPa')), DEZ), nTensoes: 1,
    tensao: () => tensaoAlvenaria(m.g('Kfd_pv', 'K_vf_d', 3, 'MPa')), b: s, d: m.g('d_pv', 'd_v', 1, 'cm'), xlim: 1.25, ref, alvenaria: true, uM: 'kN·cm', uF: 'kN',
  });
  const MRd = m.g('MRd_pvs', SIMB.MRd, 1, 'kN·cm/m');
  return secao('Momento resistente com a armadura adotada', [
    ...c.passos,
    m.passo('MRf_pv', SIMB.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm', ref }),
    temNum(m, 'MRd_pvs') && m.passo('MRd_pvs', SIMB.MRd, div(mul(c.folhas.Mf, CEM), s), { casas: 1, unidade: 'kN·cm/m', ref }),
    temNum(m, 'ap_pvs') && m.passo('ap_pvs', 'U_{M,solo}', div(m.g('M_pvs', 'M_{v,solo}', 1, 'kN·cm/m'), MRd), { casas: 3 }),
    temNum(m, 'ap_pve') && m.passo('ap_pve', 'U_{M,ext}', div(m.g('M_pve', 'M_{v,ext}', 1, 'kN·cm/m'), m.g('MRd_pve', SIMB.MRd, 1, 'kN·cm/m')), { casas: 3 }),
  ], ref);
}

export function secaoMRdPainelHorizontal(m: Memoria): Secao | null {
  if (!temNum(m, 'MRf_ph')) return null;
  const ref = NBR16868('11.3');
  const s = m.g('s_ph', 's_h', 0, 'cm');
  const c = cadeiaRetangular(m, 'ph', {
    simb: SIMB, F: div(mul(m.g('a_ph', 'a_{s,h}', 3, 'cm²'), m.g('fsd_ph', 'f_{sd,h}', 1, 'MPa')), DEZ), nTensoes: 1,
    tensao: () => tensaoAlvenaria(m.g('Kfd_ph', 'K_hf_d', 3, 'MPa')), b: s, d: m.g('d_ph', 'd_h', 1, 'cm'), xlim: 1.25, ref, alvenaria: true, uM: 'kN·cm', uF: 'kN',
  });
  const MRd = m.g('MRd_ph', SIMB.MRd, 1, 'kN·cm/m');
  const cin = temNum(m, 'Msd_cin') && temNum(m, 'MRd_cin');
  return secao('Momento resistente com a armadura adotada', [
    ...c.passos,
    m.passo('MRf_ph', SIMB.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm', ref }),
    temNum(m, 'MRd_ph') && m.passo('MRd_ph', SIMB.MRd, div(mul(c.folhas.Mf, CEM), s), { casas: 1, unidade: 'kN·cm/m', ref }),
    temNum(m, 'ap_ph') && m.passo('ap_ph', SIMB.U, div(m.g('M_ph', 'M_h', 1, 'kN·cm/m'), MRd), { casas: 3 }),
    // a canaleta do topo (cinta): na faixa s, com o vento somado quando há
    cin && m.passo('Msd_cin', 'M_{Sd,cin}', soma(m.g('Md_cin', 'M_{d,cin}', 1, 'kN·cm'), m.g('Mde_cin', 'M_{d,e,cin}', 1, 'kN·cm')), { casas: 1, unidade: 'kN·cm' }),
    cin && m.passo('MRd_cin', 'M_{Rd,cin}', c.folhas.Mf, { casas: 1, unidade: 'kN·cm' }),
    cin && temNum(m, 'ap_cin') && m.passo('ap_cin', 'U_{M,cin}', div(m.g('Msd_cin', 'M_{Sd,cin}', 1, 'kN·cm'), m.g('MRd_cin', 'M_{Rd,cin}', 1, 'kN·cm')), { casas: 3 }),
  ], ref);
}

// ───────────────────────────── sapata e dente (concreto, NBR 6118) ─────────────────────────────

export function secaoMRdSapata(m: Memoria, lado: 'ponta' | 'talao'): Secao | null {
  if (!temNum(m, 'MRf_s')) return null;
  const ref = NBR6118('17.2.2');
  const c = cadeiaRetangular(m, 's', {
    simb: SIMB, F: div(div(mul(m.g('Ase_s', 'A_{s,ef,s}', 2, 'cm²/m'), m.ent('fyk_', 'f_{yk}')), m.ent('gama_s', '\\gamma_s')), DEZ), nTensoes: 1,
    tensao: () => tensaoConcreto(m.g('fcd_s', 'f_{cd}', 2, 'MPa')), b: CEM, d: m.g('d_s', 'd_s', 2, 'cm'), xlim: 1.25, ref, alvenaria: false, uM: 'kN·cm/m', uF: 'kN/m',
  });
  const Mf = c.folhas.Mf;
  const ponta = lado === 'ponta';
  const idMRd = ponta ? 'MRd_toe' : 'MRd_heel';
  const idAp = ponta ? 'ap_toe' : 'ap_heel';
  const Md = m.g(ponta ? 'Md_ts' : 'Md_hs', ponta ? 'M_{d,p}' : 'M_{d,t}', 2, 'kN·m/m');
  const MRd = m.g(idMRd, SIMB.MRd, 2, 'kN·m/m');
  return secao('Momento resistente com a armadura adotada', [
    ...c.passos,
    m.passo('MRf_s', SIMB.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm/m', ref }),
    // o talão só resiste com barra em cima (sup_s): sem ela, 0
    temNum(m, idMRd) && m.passo(idMRd, SIMB.MRd, [div(Mf, CEM), cte(0, 0)], { casas: 2, unidade: 'kN·m/m', ref }),
    temNum(m, idAp) && m.passo(idAp, SIMB.U, [div(Md, MRd), cte(0, 0)], { casas: 3 }),
  ], ref);
}

export function secaoMRdDente(m: Memoria): Secao | null {
  if (!temNum(m, 'MRd_den')) return null;
  const ref = NBR6118('17.2.2');
  const c = cadeiaRetangular(m, 'den', {
    simb: SIMB, F: div(div(mul(m.g('Ase_den', 'A_{s,ef,den}', 2, 'cm²/m'), m.ent('fyk_', 'f_{yk}')), m.ent('gama_s', '\\gamma_s')), DEZ), nTensoes: 1,
    tensao: () => tensaoConcreto(m.g('fcd_s', 'f_{cd}', 2, 'MPa')), b: CEM, d: m.g('d_den', 'd_{den}', 2, 'cm'), xlim: 0.45, ref, alvenaria: false, uM: 'kN·cm/m', uF: 'kN/m',
  });
  return secao('Momento resistente com a armadura adotada', [
    ...c.passos,
    m.passo('MRf_den', SIMB.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm/m', ref }),
    m.passo('MRd_den', SIMB.MRd, div(c.folhas.Mf, CEM), { casas: 2, unidade: 'kN·m/m', ref }),
    temNum(m, 'ap_den') && m.passo('ap_den', SIMB.U, div(m.g('Md_den', 'M_{d,den}', 2, 'kN·m/m'), m.g('MRd_den', SIMB.MRd, 2, 'kN·m/m')), { casas: 3 }),
  ], ref);
}

// ───────────────────────────── pilarete e a ligação dele no arrimo ─────────────────────────────

export function secoesMRdPilarete(m: Memoria): Secao[] {
  const out: Secao[] = [];
  const As = m.g('As_pile', 'A_{s,ef,pil}', 2, 'cm²');
  const fyd = m.g('fyd_pil', 'f_{yd,pil}', 1, 'MPa');
  const Md = m.g('Md_pil', 'M_{d,pil}', 2, 'kN·m');
  const conc = String(m.texto('pil_tipo')).startsWith('Conc');
  if (temNum(m, 'MRf_pil')) {
    const ref = conc ? NBR6118('17.2.2') : NBR16868('11.3');
    const c = cadeiaRetangular(m, 'pil', {
      simb: SIMB, F: div(mul(As, fyd), DEZ), nTensoes: 1,
      tensao: () => (conc ? tensaoConcreto(m.g('fcd_pil', 'f_{cd,pil}', 2, 'MPa')) : tensaoAlvenaria(m.g('Kfd_pil', 'K_{f_d,pil}', 3, 'MPa'))),
      b: m.g('b_pila', 'b_{pil}', 1, 'cm'), d: m.g('d_pil', 'd_{pil}', 1, 'cm'), xlim: 0.45, ref, alvenaria: !conc, uM: 'kN·cm', uF: 'kN',
    });
    out.push(secao('Momento resistente com a armadura adotada', [
      ...c.passos,
      m.passo('MRf_pil', SIMB.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm', ref }),
      m.passo('MRd_pil', SIMB.MRd, div(c.folhas.Mf, CEM), { casas: 2, unidade: 'kN·m', ref }),
      temNum(m, 'ap_pil') && m.passo('ap_pil', SIMB.U, div(Md, m.g('MRd_pil', SIMB.MRd, 2, 'kN·m')), { casas: 3 }),
    ], ref));
  }
  if (temNum(m, 'MRf_lig')) {
    const ref = NBR16868('11.3');
    const c = cadeiaRetangular(m, 'lig', {
      simb: SIMB_LIG, F: div(mul(As, fyd), DEZ), nTensoes: 1,
      tensao: () => tensaoAlvenaria(m.g('Kfd_lig', 'K_{f_d,lig}', 3, 'MPa')),
      b: m.g('b_lig', 'b_{lig}', 1, 'cm'), d: m.g('d_lig', 'd_{lig}', 1, 'cm'), xlim: 0.45, ref, alvenaria: true, uM: 'kN·cm', uF: 'kN',
    });
    out.push(secao('Momento resistente da ligação no arrimo', [
      ...c.passos,
      m.passo('MRf_lig', SIMB_LIG.Mf, [c.folhas.fM, c.folhas.fMl], { casas: 1, unidade: 'kN·cm', ref }),
      m.passo('MRd_lig', SIMB_LIG.MRd, div(c.folhas.Mf, CEM), { casas: 2, unidade: 'kN·m', ref }),
      temNum(m, 'ap_lig') && m.passo('ap_lig', SIMB_LIG.U, div(Md, m.g('MRd_lig', SIMB_LIG.MRd, 2, 'kN·m')), { casas: 3 }),
    ], ref));
  }
  return out.filter((s) => s.passos.length > 0);
}

// ───────────────────────────── alvenaria não armada: ftd·W ─────────────────────────────

/** Os dois momentos resistentes do painel não armado (ftd · W) e o aproveitamento de cada direção. */
export function secaoMRdNaoArmado(
  m: Memoria,
  o: { p: string; n: string; ap: string; an: string; Mp: [string, string]; Mn: [string, string]; ftp: [string, string]; ftn: [string, string]; W: Expr; fator: Expr; un: string; titulo?: string; casasM: number },
): Secao | null {
  if (!temNum(m, o.p) && !temNum(m, o.n)) return null;
  const ref = NBR16868('Anexo E');
  return secao(o.titulo ?? 'Momento resistente da alvenaria não armada', [
    temNum(m, o.p) && m.passo(o.p, 'M_{R,\\parallel}', mul(m.g(o.ftp[0], o.ftp[1], 3, 'MPa'), o.W, o.fator), { casas: 2, unidade: o.un, ref }),
    temNum(m, o.n) && m.passo(o.n, 'M_{R,\\perp}', mul(m.g(o.ftn[0], o.ftn[1], 3, 'MPa'), o.W, o.fator), { casas: 2, unidade: o.un, ref }),
    temNum(m, o.ap) && m.passo(o.ap, 'U_{\\parallel}', div(m.g(o.Mp[0], o.Mp[1], o.casasM, o.un), m.g(o.p, 'M_{R,\\parallel}', 2, o.un)), { casas: 3 }),
    temNum(m, o.an) && m.passo(o.an, 'U_{\\perp}', div(m.g(o.Mn[0], o.Mn[1], o.casasM, o.un), m.g(o.n, 'M_{R,\\perp}', 2, o.un)), { casas: 3 }),
  ], ref);
}
