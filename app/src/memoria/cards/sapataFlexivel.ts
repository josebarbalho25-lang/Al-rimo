/*
  CARDS — Fundação — SAPATA FLEXÍVEL CALCULADA e ANCORAGEM DA ESPERA (16/11; aba Fundação, seção 14,
  tools/fundacao.py).

  Decisão do Jose (16/11, "pode sim", estudo _trabalho/sapata_flexivel_16-11): a flexível deixa de ser barrada. A
  flexão por metro e a cortante VRd1 a d (cards/sapata.ts) já são as de laje (NBR 6118 22.6.4.1.3); a flexível ganha:
    · a PUNÇÃO — sob o muro contínuo, a cortante por metro a 2d da face contra o τRd1 da punção (19.5.3.2; o contorno
      C′ de uma carga em linha são duas retas: DEDUÇÃO aprovada); junto ao contraforte, o pilar tenr × eenr interno ou
      de borda (19.5.2.2 e 19.5.2.3); cortado nos dois lados, vale a torção (cards/sapata.ts);
    · o Ø ≤ h/8 (20.1);
    · com contrafortes, a CONCENTRAÇÃO junto ao contraforte (22.6.2.3 a): (βL/2)/th(βL/2) sobre o momento e a cortante
      do balanço solto naquela faixa (do ramo sapata-molas, 13/10; aplicar ao balanço inteiro é DEDUÇÃO a favor). O ks
      (opcional; em branco 120·σadm, Bowles) só entra aqui e no indicador λ·B.
  A distribuição de tensões continua plana nas duas classes (critério adotado; cards/estabilidade.ts).
  A ANCORAGEM DA ESPERA NA SAPATA (22.6.4.1.2) vale para qualquer classe; o nó de cachorro não é julgado (decisão do
  Jose, 15/10: a conta não o contabiliza) — o card mostra a altura disponível e não verifica.

  Cada `if` espelha um IF da planilha (flex_s, Tipo_muro, pos_cf, ks_dir, cas_pun, arranque, gancho_).
*/
import type { AutorDeCards, Card, Expr, Passo, Ref } from '../tipos';
import { arredCima, avaliar, cte, div, max, min, mul, nome, par, pi, pot, raiz, soma, sub, tanh } from '../expr';
import { intervalo } from './sapata';
import { memoriaDe, secao, type Memoria } from '../passo';
import {
  desenhoDaAncoragemDaEspera, desenhoDaPuncaoNoContraforte, desenhoDaPuncaoSobOMuro,
} from '../desenhoDaSapataFlexivel';

export const SIMBOLOS_SAPATA_FLEXIVEL: Readonly<Record<string, string>> = {
  'E_{ci}': 'módulo de elasticidade inicial do concreto da sapata',
  'E_{cs}': 'módulo de elasticidade secante do concreto da sapata',
  'EI_s': 'rigidez à flexão da faixa de 1 m da sapata (seção bruta)',
  'k_{s,sug}': 'coeficiente de reação do solo sugerido, 120·σadm',
  'k_s': 'coeficiente de reação do solo usado',
  '\\lambda_s': 'parâmetro da viga sobre base elástica da faixa de 1 m',
  '\\lambda B': 'rigidez relativa da sapata sobre o solo (indicador)',
  'k_{\\theta}': 'rigidez do solo ao giro da sapata, por metro',
  'G_c': 'módulo de elasticidade transversal do concreto da sapata',
  'J_s': 'constante de torção da seção B × h da sapata',
  'GJ_s': 'rigidez à torção fissurada da sapata',
  '\\beta L/2': 'parâmetro da torção sobre base elástica no meio vão',
  'f_{conc}': 'fator de concentração junto ao contraforte',
  'M_{d,p,cf}': 'momento de cálculo da ponta na faixa junto ao contraforte',
  'M_{d,t,cf}': 'momento de cálculo do talão na faixa junto ao contraforte',
  'V_{Sd,p,cf}': 'cortante de cálculo da ponta na faixa junto ao contraforte',
  'V_{Sd,t,cf}': 'cortante de cálculo do talão na faixa junto ao contraforte',
  'A_{s,ef,sec}': 'armadura secundária efetiva da sapata, por metro',
  '\\rho_p': 'taxa geométrica de armadura para a punção',
  'k_e': 'coeficiente de escala da punção (altura útil)',
  '\\tau_{Rd1}': 'tensão resistente de punção sem armadura no contorno a 2d',
  'V_{Sd,p,2d}': 'cortante de cálculo da ponta a 2d da face, por metro',
  'V_{Sd,t,2d}': 'cortante de cálculo do talão a 2d da face, por metro',
  '\\tau_{Sd,p}': 'tensão de punção da ponta no contorno a 2d',
  '\\tau_{Sd,t}': 'tensão de punção do talão no contorno a 2d',
  'V_{p,i,2d}': 'carga da fatia i da ponta além de 2d da face, por metro',
  'V_{t,i,2d}': 'carga da fatia i do talão além de 2d da face, por metro',
  'M_{Sd,cf}': 'momento de cálculo do contraforte que chega à sapata',
  'e_1':'distância da ponta do contraforte à borda da sapata',
  'e_2': 'distância da face do muro à borda do outro lado',
  'e_0': 'distância do contraforte à borda livre (de borda)',
  'u_{pun}': 'perímetro crítico a 2d do contraforte (ou o reduzido, de borda)',
  'W_{p}': 'módulo de resistência plástica do perímetro crítico',
  '\\tau_{Sd,cf}\'': 'tensão de punção junto ao contraforte no contorno a 2d',
  '\\ell_{b,disp}': 'altura disponível para a ancoragem da espera na sapata',
  '\\ell_{b,tab,v}': 'comprimento de ancoragem da tabela da espera do painel',
  '\\ell_{b,r,v}': 'comprimento de ancoragem reto da espera do painel',
  '\\ell_{b,tab,cf}': 'comprimento de ancoragem da tabela da espera do contraforte',
  '\\ell_{b,r,cf}': 'comprimento de ancoragem reto da espera do contraforte',
  '\\ell_{b,tab,cc}': 'comprimento de ancoragem da tabela da espera das construtivas',
  '\\ell_{b,r,cc}': 'comprimento de ancoragem reto da espera das construtivas',
  '\\ell_{b,m\\acute{\\imath}n,v}': 'comprimento de ancoragem mínimo da espera do painel',
  '\\ell_{b,m\\acute{\\imath}n,cf}': 'comprimento de ancoragem mínimo da espera do contraforte',
  '\\ell_{b,m\\acute{\\imath}n,cc}': 'comprimento de ancoragem mínimo da espera das construtivas',
  '\\phi_{m\\acute{a}x,s}': 'maior diâmetro da malha da sapata',
  '\\phi_{lim,s}': 'diâmetro máximo das barras da sapata flexível, h/8',
  '\\ell_{b,nec,m}': 'ancoragem necessária da espera do muro em balanço',
  '\\ell_{b,nec,v}': 'ancoragem necessária da espera do painel',
  '\\ell_{b,nec,cf}': 'ancoragem necessária da espera do contraforte',
  '\\ell_{b,nec,cc}': 'ancoragem necessária da espera das construtivas',
  '\\phi_{cc}': 'diâmetro das barras construtivas do contraforte',
};

const NBR = (item?: string): Ref => (item ? { fonte: 'NBR 6118', item } : { fonte: 'NBR 6118' });
const DEDUCAO: Ref = { fonte: 'Dedução' };
const ARAUJO: Ref = { fonte: 'Araújo (2014)' };
const UM_TERCO: Expr = { k: 'num', v: 1 / 3, casas: 3, tex: '1/3' };

const temNumero = (m: Memoria, id: string) => m.valor(id) !== null;

function folhas(m: Memoria) {
  return {
    B: m.ent('B_sap', 'B'),
    hS: m.ent('h_sap', 'h_s'),
    hScm: m.ent('h_sap', 'h_s', { fator: 100, casas: 1, unidade: 'cm' }),
    cS: m.ent('cob_sap', 'c_s'),
    phi: m.ent('phi_sap', '\\phi_s', { fator: 0.1, casas: 2, unidade: 'cm' }),
    phi2: m.ent('phi_sap2', '\\phi_{s2}', { fator: 0.1, casas: 2, unidade: 'cm' }),
    fck: m.g('fck_s', 'f_{ck}', 0, 'MPa'),
    d: m.g('d_s', 'd_s', 2, 'cm'),
    L: m.g('Lm', 'L_{mod}', 2, 'm'),
    Ase: m.g('Ase_s', 'A_{s,ef,s}', 2, 'cm²/m'),
    sSec: m.g('s_ss', 's_{sec}', 0, 'cm'),
    Ass: m.g('Ass_ef', 'A_{s,ef,sec}', 2, 'cm²/m'),
    Ecs: m.g('Ecs_s', 'E_{cs}', 0, 'MPa'),
    EI: m.g('EI_s', 'EI_s', 0, 'kN·m²/m'),
    ks: m.g('ks_us', 'k_s', 0, 'kN/m³'),
    fc: m.g('fcc_s', 'f_{conc}', 3),
    tRd1: m.g('tRd1_s', '\\tau_{Rd1}', 3, 'MPa'),
  };
}

// ───────────────────────────── punção, Ø ≤ h/8 e o indicador λ·B (só na flexível) ─────────────────────────────

function cardPuncao(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const flex = m.texto('flex_s') === 'Sim';
  const cf = m.texto('Tipo_muro') === 'Contrafortes';
  const card: Card = { id: 'sapata.puncao', titulo: 'Sapata flexível · punção', ref: NBR('19.5'), secoes: [], avisos: [], aplicavel: flex };
  if (!flex) return card;
  const f = folhas(m);
  const CEM = cte(100, 0);

  // resistência no contorno a 2d, sem armadura de punção
  const resist = secao('Resistência no contorno C′, sem armadura de punção', [
    temNumero(m, 'Ass_ef') && m.passo('Ass_ef', 'A_{s,ef,sec}', mul(div(div(mul(pi(), pot(f.phi2, 2)), cte(4, 0)), f.sSec), CEM), { casas: 2, unidade: 'cm²/m' }),
    temNumero(m, 'rho_p') && m.passo('rho_p', '\\rho_p', min(cte(0.02, 2), raiz(mul(div(f.Ase, mul(CEM, f.d)), div(f.Ass, mul(CEM, f.d))))), { casas: 5, ref: DEDUCAO }),
    temNumero(m, 'ke_p') && m.passo('ke_p', 'k_e', min(cte(2, 0), soma(cte(1, 0), raiz(div(cte(20, 0), f.d)))), { casas: 3 }),
    temNumero(m, 'tRd1_s') && m.passo('tRd1_s', '\\tau_{Rd1}',
      mul(cte(0.13, 2), m.g('ke_p', 'k_e', 3), pot(par(mul(CEM, m.g('rho_p', '\\rho_p', 5), f.fck)), UM_TERCO)), { casas: 3, unidade: 'MPa' }),
  ], NBR('19.5.3.2'));
  card.secoes.push(resist);

  // sob o muro contínuo: a cortante por metro a 2d das faces (com o fator junto ao contraforte, 1 fora dele)
  const lado = (i: 'p' | 't') => {
    const ponta = i === 'p';
    const b = m.num(ponta ? 'toe' : 'heel') ?? 0;
    if (!(b > 0.005)) return [];
    const V = ponta ? 'Vp2_t' : 'Vp2_h';
    const tau = ponta ? 'tp2_t' : 'tp2_h';
    const fator = m.num(ponta ? 'ft_s' : 'fh_s') ?? 1;
    // intervalo = a SOMA dele (coluna S das fatias: a carga além de 2d); o "máx(0; …)" só quando decide
    const soma20 = nome(intervalo(ponta ? 'T_dV2' : 'H_dV2'), `\\sum_{i=1}^{20} V_{${i},i,2d}`, 2, 'kN/m');
    const negativa = avaliar(soma20, r) < 0;
    const carga = negativa ? max(cte(0, 0), soma20) : soma20;
    const exprV = fator !== 1 ? mul(f.fc, cte(1.4, 1), carga) : mul(cte(1.4, 1), carga);
    return [
      temNumero(m, V) && m.passo(V, `V_{Sd,${i},2d}`, exprV, { casas: 2, unidade: 'kN/m', ref: DEDUCAO }),
      temNumero(m, tau) && m.passo(tau, `\\tau_{Sd,${i}}`, mul(div(m.g(V, `V_{Sd,${i},2d}`, 2, 'kN/m'), mul(CEM, f.d)), cte(10, 0)), {
        casas: 3, unidade: 'MPa', ref: NBR('19.5.2.1'),
        verif: { chave: `sapata.puncao.${ponta ? 'ponta' : 'talao'}`, rotulo: `Punção sob o muro (${ponta ? 'ponta' : 'talão'}) τSd ≤ τRd1`, limite: f.tRd1, relacao: '<=' },
      }),
    ];
  };
  const muro = secao('Sob o muro: contorno C′ a 2d das faces, por metro', [...lado('p'), ...lado('t')], DEDUCAO);
  const desM = desenhoDaPuncaoSobOMuro(r);
  if (desM) muro.desenho = desM;
  card.secoes.push(muro);

  if (cf) {
    const caso = m.texto('cas_pun');
    const C1 = m.g('tenr_adot', 't_{enr}', 1, 'cm');
    const C2 = m.g('eenr', 'e_{enr}', 1, 'cm');
    const d = f.d;
    const e0 = m.g('e0_pun', 'e_0', 1, 'cm');
    const enterrado = m.texto('pos_cf').startsWith('Ente');
    const heelCm = m.g('heel', 'b_t', 3, 'm');
    const toeCm = m.g('toe', 'b_p', 3, 'm');
    const tCm = m.ent('t_bloco', 't', { casas: 0, unidade: 'cm' });
    const passos = [
      temNumero(m, 'e1_pun') && m.passo('e1_pun', 'e_1', sub(mul(enterrado ? heelCm : toeCm, cte(100, 0)), par(sub(C1, tCm))), { casas: 1, unidade: 'cm' }),
      temNumero(m, 'e2_pun') && m.passo('e2_pun', 'e_2', mul(enterrado ? toeCm : heelCm, cte(100, 0)), { casas: 1, unidade: 'cm' }),
    ];
    const DOIS_PI_D = mul(cte(2, 0), pi(), d);
    if (caso === 'Interno') {
      passos.push(
        temNumero(m, 'u_pun') && m.passo('u_pun', 'u_{pun}', soma(mul(cte(2, 0), C1), mul(cte(2, 0), C2), mul(cte(4, 0), pi(), d)), { casas: 1, unidade: 'cm', ref: NBR('19.5.2.2') }),
        temNumero(m, 'Wp_pun') && m.passo('Wp_pun', 'W_{p}',
          soma(div(pot(C1, 2), cte(2, 0)), mul(C1, C2), mul(cte(4, 0), C2, d), mul(cte(16, 0), pot(d, 2)), mul(cte(2, 0), pi(), d, C1)), { casas: 0, unidade: 'cm²', ref: NBR('19.5.2.2') }),
      );
    } else if (caso === 'De borda') {
      passos.push(
        temNumero(m, 'e0_pun') && m.passo('e0_pun', 'e_0', min(m.g('e1_pun', 'e_1', 1, 'cm'), m.g('e2_pun', 'e_2', 1, 'cm')), { casas: 1, unidade: 'cm' }),
        temNumero(m, 'u_pun') && m.passo('u_pun', 'u_{pun}', soma(mul(cte(2, 0), min(mul(cte(1.5, 1), d), mul(cte(0.5, 1), C1))), C2, DOIS_PI_D), { casas: 1, unidade: 'cm', ref: NBR('19.5.2.3') }),
        temNumero(m, 'Wp_pun') && m.passo('Wp_pun', 'W_{p}',
          soma(pot(par(soma(e0, div(C1, cte(2, 0)))), 2), div(pot(C1, 2), cte(4, 0)), div(mul(C1, C2), cte(2, 0)), mul(cte(2, 0), C2, d), mul(pi(), d, C1), mul(cte(8, 0), pot(d, 2))),
          { casas: 0, unidade: 'cm²', ref: DEDUCAO }),
      );
    }
    if (caso === 'Interno' || caso === 'De borda') {
      const Fc = m.g('Fc_s', 'F_{Sd,cf}', 2, 'kN');
      const K = m.g('K_cc', 'K_{19}', 3);
      const Mc = m.g('Mc_s', 'M_{Sd,cf}', 2, 'kN·m');
      const u = m.g('u_pun', 'u_{pun}', 1, 'cm');
      const Wp = m.g('Wp_pun', 'W_{p}', 0, 'cm²');
      passos.push(temNumero(m, 'tp_cf') && m.passo('tp_cf', "\\tau_{Sd,cf}'",
        mul(par(soma(div(Fc, mul(u, d)), div(mul(K, Mc, cte(100, 0)), mul(Wp, d)))), cte(10, 0)), {
          casas: 3, unidade: 'MPa', ref: NBR(caso === 'Interno' ? '19.5.2.2' : '19.5.2.3'),
          verif: { chave: 'sapata.puncao.contraforte', rotulo: 'Punção junto ao contraforte τSd ≤ τRd1', limite: f.tRd1, relacao: '<=', celula: 'chk_pun_c' },
        }));
    }
    const sec = secao('Junto ao contraforte: pilar tenr × eenr, contorno C′ a 2d', passos, NBR('19.5.2'));
    const desC = desenhoDaPuncaoNoContraforte(r);
    if (desC) sec.desenho = desC;
    card.secoes.push(sec);
    if (caso === 'Cortado nos dois lados') card.avisos.push('Contorno C′ cortado nas duas bordas: vale a torção');
  }

  // Ø ≤ h/8 (20.1): a maior barra da malha
  card.secoes.push(secao('Detalhamento de laje', [
    temNumero(m, 'phi8_s') && m.passo('phi8_s', '\\phi_{lim,s}', div(m.ent('h_sap', 'h_s', { fator: 1000, casas: 0, unidade: 'mm' }), cte(8, 0)), { casas: 1, unidade: 'mm', ref: NBR('20.1') }),
    temNumero(m, 'phim_s') && m.passo('phim_s', '\\phi_{m\\acute{a}x,s}', max(m.ent('phi_sap', '\\phi_s', { casas: 1, unidade: 'mm' }), m.ent('phi_sap2', '\\phi_{s2}', { casas: 1, unidade: 'mm' })), {
      casas: 1, unidade: 'mm',
      verif: { chave: 'sapata.phi8', rotulo: 'Ø da armadura da sapata ≤ h/8', limite: m.g('phi8_s', '\\phi_{lim,s}', 1, 'mm'), relacao: '<=', celula: 'chk_phi8' },
    }),
  ], NBR('20.1')));
  card.secoes = card.secoes.filter((s) => s.passos.length > 0);
  return card;
}

// ───────────────────────────── concentração junto ao contraforte (flexível com contrafortes) ─────────────────────────────

function cardConcentracao(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const aplica = m.texto('flex_s') === 'Sim' && m.texto('Tipo_muro') === 'Contrafortes';
  const card: Card = { id: 'sapata.concentracao', titulo: 'Sapata flexível · concentração junto ao contraforte', ref: NBR('22.6.2.3'), secoes: [], avisos: [], aplicavel: aplica };
  if (!aplica) return card;
  const f = folhas(m);
  const Bv = m.num('B_sap') ?? 0, hv = m.num('h_sap') ?? 0;
  const [a, b] = Bv >= hv ? [f.B, f.hS] : [f.hS, f.B];      // MAX e MIN da planilha
  const bL2 = m.g('bL2_s', '\\beta L/2', 3);
  const torcao = secao('Torção da sapata sobre o solo', [
    temNumero(m, 'kt_s') && m.passo('kt_s', 'k_{\\theta}', div(mul(f.ks, pot(f.B, 3)), cte(12, 0)), { casas: 1, unidade: 'kN·m/rad/m', ref: DEDUCAO }),
    temNumero(m, 'Gc_s') && m.passo('Gc_s', 'G_c', div(f.Ecs, cte(2.4, 1)), { casas: 0, unidade: 'MPa', ref: NBR('8.2.9') }),
    temNumero(m, 'J_s') && m.passo('J_s', 'J_s',
      mul(a, pot(b, 3), par(sub(UM_TERCO, mul(cte(0.21, 2), div(b, a), par(sub(cte(1, 0), div(pot(par(div(b, a)), 4), cte(12, 0)))))))), { casas: 6, unidade: 'm⁴' }),
    temNumero(m, 'GJ_s') && m.passo('GJ_s', 'GJ_s', mul(cte(0.15, 2), m.g('Gc_s', 'G_c', 0, 'MPa'), cte(1000, 0), m.g('J_s', 'J_s', 6, 'm⁴')), { casas: 0, unidade: 'kN·m²', ref: NBR('14.6.7.2') }),
    temNumero(m, 'bL2_s') && m.passo('bL2_s', '\\beta L/2', div(mul(raiz(div(m.g('kt_s', 'k_{\\theta}', 1, 'kN·m/rad/m'), m.g('GJ_s', 'GJ_s', 0, 'kN·m²'))), f.L), cte(2, 0)), { casas: 3 }),
    temNumero(m, 'fcc_s') && m.passo('fcc_s', 'f_{conc}', div(bL2, tanh(bL2)), { casas: 3, ref: DEDUCAO }),
  ], DEDUCAO);
  card.secoes.push(torcao);
  // o balanço solto junto ao contraforte: a ponta com o enterrado, o talão com o aparente
  const ponta = m.texto('pos_cf').startsWith('Ente');
  const idMd = ponta ? 'Md_tf' : 'Md_hf', idV = ponta ? 'Vsd_tf' : 'Vsd_hf';
  const i = ponta ? 'p' : 't';
  const Md = m.g(ponta ? 'Md_ts' : 'Md_hs', ponta ? 'M_{d,p}' : 'M_{d,t}', 2, 'kN·m/m');
  const V = m.g(ponta ? 'Vsd_t' : 'Vsd_h', ponta ? 'V_{Sd,p}' : 'V_{Sd,t}', 2, 'kN/m');
  const MRd = m.g(ponta ? 'MRd_toe' : 'MRd_heel', 'M_{Rd}', 2, 'kN·m/m');
  card.secoes.push(secao(ponta ? 'Ponta na faixa junto ao contraforte' : 'Talão na faixa junto ao contraforte', [
    temNumero(m, idMd) && m.passo(idMd, `M_{d,${i},cf}`, mul(f.fc, Md), {
      casas: 2, unidade: 'kN·m/m', ref: DEDUCAO,
      verif: { chave: 'sapata.concentracao.flexao', rotulo: 'Flexão na faixa junto ao contraforte MSd ≤ MRd', limite: temNumero(m, ponta ? 'MRd_toe' : 'MRd_heel') ? MRd : null, relacao: '<=', celula: 'chk_fc_fl' },
    }),
    temNumero(m, idV) && m.passo(idV, `V_{Sd,${i},cf}`, mul(f.fc, V), {
      casas: 2, unidade: 'kN/m', ref: DEDUCAO,
      verif: { chave: 'sapata.concentracao.cortante', rotulo: 'Cortante na faixa junto ao contraforte VSd ≤ VRd1', limite: m.g('VRd1_s', 'V_{Rd1}', 2, 'kN/m'), relacao: '<=', celula: 'chk_fc_v' },
    }),
  ], NBR('22.6.2.3')));
  return card;
}

// ───────────────────────────── ancoragem da espera na sapata (qualquer classe) ─────────────────────────────

function cardAncoragem(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const no = m.texto('arranque').startsWith('N');
  const card: Card = { id: 'sapata.ancoragemEspera', titulo: 'Ancoragem da espera na sapata', ref: NBR('22.6.4.1.2'), figura: 'Fig. 9', secoes: [], avisos: [], aplicavel: temNumero(m, 'lbd_esp') };
  if (!card.aplicavel) return card;
  const disp = m.g('lbd_esp', '\\ell_{b,disp}', 1, 'cm');
  const dispPasso = m.passo('lbd_esp', '\\ell_{b,disp}', sub(sub(f.hScm, f.cS), par(soma(f.phi, f.phi2))), { casas: 1, unidade: 'cm', ref: DEDUCAO });
  // nó de cachorro: a conta não o julga (Jose, 15/10) — só a altura disponível, sem verificação
  if (no) {
    card.secoes.push(secao('Altura disponível na sapata', [dispPasso], NBR('22.6.4.1.2')));
    card.avisos.push('Nó de cachorro: ancoragem pela dobra por baixo');
    return card;
  }
  const emCm = { fator: 0.1, casas: 2, unidade: 'cm' };
  const verif = (sx: string, rot: string) => ({ chave: `sapata.ancoragemEspera.${sx}`, rotulo: `Ancoragem da espera ${rot} ℓb,nec ≤ ℓb,disp`, limite: disp, relacao: '<=' as const });
  const passos: (Passo | false)[] = [dispPasso];
  if (temNumero(m, 'la_v')) {
    passos.push(m.passo('la_v', '\\ell_{b,nec,m}', m.g('lb_adot', '\\ell_{b,adot}', 0, 'cm'), { casas: 0, unidade: 'cm', ref: NBR('9.4.2.5'), verif: verif('muro', 'do muro') }));
  }
  const ESP: Array<{ sx: string; i: string; phi: string; phiTex: string; r: Expr | null; rot: string }> = [
    { sx: 'pv', i: 'v', phi: 'phi_pv', phiTex: '\\phi_v', r: m.g('r_pv', 'r_v', 3), rot: 'do painel' },
    { sx: 'cf', i: 'cf', phi: 'phi_cf', phiTex: '\\phi_{cf}', r: m.g('r_cf', 'r_{cf}', 3), rot: 'do contraforte' },
    { sx: 'cc', i: 'cc', phi: 'phi_cc', phiTex: '\\phi_{cc}', r: null, rot: 'das construtivas' },
  ];
  for (const e of ESP) {
    if (!temNumero(m, `la_${e.sx}`)) continue;
    const sLbt = `\\ell_{b,tab,${e.i}}`, sLbr = `\\ell_{b,r,${e.i}}`, sLbm = `\\ell_{b,m\\acute{\\imath}n,${e.i}}`;
    const lbr = m.g(`lbr_${e.sx}`, sLbr, 1, 'cm');
    const lbm = m.g(`lbm_${e.sx}`, sLbm, 1, 'cm');
    const phiCm = m.ent(e.phi, e.phiTex, emCm);
    // construtiva (sem esforço de cálculo, 16/11): a ancoragem é o ℓb,mín — sem a tabela de ℓb nem a relação de áreas
    const construtiva = e.r === null;
    passos.push(
      !construtiva && m.passo(`lbt_${e.sx}`, sLbt, null, { casas: 1, unidade: 'cm', origem: 'tabela', ref: ARAUJO }),
      m.passo(`lbr_${e.sx}`, sLbr, null, { casas: 1, unidade: 'cm', origem: 'tabela', ref: ARAUJO }),
      m.passo(`lbm_${e.sx}`, sLbm, max(mul(cte(0.3, 1), lbr), mul(cte(10, 0), phiCm), cte(10, 0)), { casas: 1, unidade: 'cm', ref: NBR('9.4.2.5') }),
      m.passo(`la_${e.sx}`, `\\ell_{b,nec,${e.i}}`,
        construtiva ? arredCima(lbm) : arredCima(max(mul(m.g(`lbt_${e.sx}`, sLbt, 1, 'cm'), e.r as Expr), lbm)),
        { casas: 0, unidade: 'cm', ref: NBR('9.4.2.5'), verif: verif(e.sx, construtiva ? 'das construtivas (ℓb,mín)' : e.rot) }),
    );
  }
  const sec = secao('Altura disponível × ancoragem necessária', passos, NBR('22.6.4.1.2'));
  const des = desenhoDaAncoragemDaEspera(r);
  if (des) sec.desenho = des;
  card.secoes.push(sec);
  return card;
}

/** Sapata flexível (punção, concentração) e a ancoragem da espera, nos dois tipos de muro. */
export const autorSapataFlexivel: AutorDeCards = (r) => [cardPuncao(r), cardConcentracao(r), cardAncoragem(r)];
