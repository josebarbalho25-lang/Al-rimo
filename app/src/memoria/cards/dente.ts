/*
  CARD — Fundação — ARMADURA DO DENTE da sapata corrida (15/11; aba Fundação, seção 11, tools/fundacao.py).

  Jose: "a forma de armar é similar à da sapata corrida, porém na vertical, com estribos adentrando a sapata corrida e
  armadura de montagem / mínima no sentido longitudinal do dente; o esforço seria o de deslizamento / tombamento".
  O dente é um balanço pendurado na sapata, empurrado para trás pelo solo da frente:
  - carga = o passivo CHEIO na face da frente (sem dividir por 2, sem olhar a garantia do solo da frente nem a
    posição do dente): é o máximo que o solo devolve, o dente nunca recebe mais que isso;
  - seção da raiz 100 × b do dente, flexão e cortante sem estribo pela NBR 6118, como a sapata;
  - a armadura de flexão é a perna do estribo fechado em pé, ancorada dentro da sapata (sobe até o cobrimento de cima);
  - longitudinais de montagem pelo critério de armadura secundária de laje — DEDUÇÃO;
  - o momento do dente passado à sapata, numa verificação própria (não mexe no Md da sapata) — DEDUÇÃO.
  Sem dente o card não se aplica e não monta passo (as células ficam em "—").
*/
import type { AutorDeCards, Card, Expr, Ref } from '../tipos';
import { arredCima, cte, div, max, min, mul, neg, par, pi, pot, raiz, rad, soma, sub, tan } from '../expr';
import { memoriaDe, secao } from '../passo';
import type { Memoria } from '../passo';
import { desenhoDaSecaoDoDente, desenhoDasForcasNoDente } from '../desenhoDaSapata';

export const SIMBOLOS_DENTE: Readonly<Record<string, string>> = {
  'p_{1,den}': 'empuxo passivo na raiz do dente (face de baixo da sapata)',
  'p_{2,den}': 'empuxo passivo no fundo do dente',
  'E_{k,den}': 'resultante do passivo na face da frente do dente, por metro',
  'M_{k,den}': 'momento característico na raiz do dente, por metro',
  'y_{den}': 'braço da resultante do passivo até a raiz do dente',
  'M_{d,den}': 'momento de cálculo na raiz do dente, por metro',
  'V_{d,den}': 'cortante de cálculo na raiz do dente, por metro',
  'd_{den}': 'altura útil da seção do dente',
  'x_{LN,den}': 'profundidade da linha neutra na flexão do dente',
  '(x/d)_{den}': 'profundidade relativa da linha neutra do dente',
  'A_{s,den}': 'armadura de flexão calculada do dente, por metro',
  'A_{s,m\\acute{\\imath}n,den}': 'armadura mínima de flexão do dente, por metro',
  'A_{s,nec,den}': 'armadura necessária do dente (cálculo ou mínima), por metro',
  '\\phi_{den}': 'diâmetro do estribo do dente',
  'A_{\\phi,den}': 'área de um ramo do estribo do dente',
  's_{den}': 'espaçamento do estribo do dente',
  'A_{s,ef,den}': 'armadura efetiva do dente em cada face, por metro',
  'k_{den}': 'coeficiente de altura útil do cortante sem estribo do dente',
  '\\rho_{1,den}': 'taxa de armadura de tração do dente',
  'V_{Rd1,den}': 'cortante resistente de cálculo sem estribo do dente, por metro',
  '\\ell_{b,den}': 'comprimento de ancoragem reto do estribo do dente no concreto',
  '\\ell_{b,m\\acute{\\imath}n,den}': 'comprimento de ancoragem mínimo do estribo do dente',
  '\\ell_{b,nec,den}': 'comprimento de ancoragem necessário do estribo do dente',
  '\\ell_{b,disp,den}': 'ancoragem disponível do estribo do dente dentro da sapata',
  'A_{s,dist,den}': 'armadura de distribuição do dente, por face e por metro de altura',
  '\\phi_{l,den}': 'diâmetro da armadura longitudinal do dente',
  'n_{face,den}': 'longitudinais do dente em cada face',
  'n_{l,den}': 'longitudinais do dente nas duas faces',
  'M_{den,s}': 'momento do dente levado à face oposta da sapata, por metro',
  'M_{f,s}': 'momento da sapata que traciona a mesma face que o dente',
  'A_{s,ef,s}': 'armadura principal efetiva da sapata, por metro',
  'x_{R,s}': 'linha neutra da sapata com a armadura efetiva',
  'M_{Rd,s}': 'momento resistente de cálculo da seção da sapata, por metro',
  'M_{Sd,s}': 'momento de cálculo na sapata junto ao dente, por metro',
};

const NBR = (item?: string): Ref => (item ? { fonte: 'NBR 6118', item } : { fonte: 'NBR 6118' });
const RANKINE: Ref = { fonte: 'Rankine' };
const DEDUCAO: Ref = { fonte: 'Dedução' };

const temNumero = (m: Memoria, id: string) => m.valor(id) !== null;

export const autorDente: AutorDeCards = (r) => {
  const m = memoriaDe(r);
  const comDente = m.texto('tem_den') === 'Sim';
  const card: Card = {
    id: 'fundacao.dente',
    titulo: 'Dente · armadura',
    ref: NBR(),
    figura: 'Fig. 18',
    secoes: [],
    avisos: [],
    aplicavel: comDente,
  };
  if (!comDente) return [card];

  // ── folhas (o mesmo nome desenha sempre o mesmo símbolo, com as mesmas casas — a régua dos outros cards) ──
  const Kpb = m.g('Kp_b', 'K_{p,b}', 3);
  const phib = m.g('phi_b', "\\varphi'_b", 1, '°');
  const gama = m.ent('gama_solo', '\\gamma');
  const hfr = m.ent('h_fr', 'h_{fr}');
  const hs = m.ent('h_sap', 'h_s');
  const hsCm = m.ent('h_sap', 'h_s', { fator: 100, casas: 1, unidade: 'cm' });
  const hden = m.ent('h_den', 'h_{den}');
  const hdenCm = m.ent('h_den', 'h_{den}', { fator: 100, casas: 1, unidade: 'cm' });
  const bdenCm = m.ent('b_den', 'b_{den}', { fator: 100, casas: 1, unidade: 'cm' });
  const cs = m.ent('cob_sap', 'c_s');
  const phi = m.ent('phi_den', '\\phi_{den}', { fator: 0.1, casas: 2, unidade: 'cm' });
  const phiL = m.ent('phi_lden', '\\phi_{l,den}', { fator: 0.1, casas: 2, unidade: 'cm' });
  const phiS = m.ent('phi_sap', '\\phi_s', { fator: 0.1, casas: 2, unidade: 'cm' });
  const fykKN = m.ent('fyk_', 'f_{yk}', { fator: 0.1, casas: 1, unidade: 'kN/cm²' });
  const gs = m.ent('gama_s', '\\gamma_s');
  const fcdKNcm = m.g('fcd_s', 'f_{cd}', 3, 'kN/cm²', { fator: 0.1 });
  const fctdKNm = m.g('fctd_s', 'f_{ctd}', 0, 'kN/m²', { fator: 1000 });
  const dS = m.g('d_s', 'd_s', 2, 'cm');
  const sPs = m.g('s_ps', 's_{princ}', 0, 'cm');
  const lbphi = m.g('lbphi_c', '\\ell_{b,c}/\\phi', 1);

  const p1 = m.g('p1_den', 'p_{1,den}', 2, 'kPa');
  const p2 = m.g('p2_den', 'p_{2,den}', 2, 'kPa');
  const Ek = m.g('Ek_den', 'E_{k,den}', 2, 'kN/m');
  const Mk = m.g('Mk_den', 'M_{k,den}', 2, 'kN·m/m');
  const Md = m.g('Md_den', 'M_{d,den}', 2, 'kN·m/m');
  const MdCm = m.g('Md_den', 'M_{d,den}', 1, 'kN·cm/m', { fator: 100 });
  const Vd = m.g('Vd_den', 'V_{d,den}', 2, 'kN/m');
  const d = m.g('d_den', 'd_{den}', 2, 'cm');
  const dM = m.g('d_den', 'd_{den}', 4, 'm', { fator: 0.01 });
  const x = m.g('xln_den', 'x_{LN,den}', 2, 'cm');
  const As = m.g('As_den', 'A_{s,den}', 2, 'cm²/m');
  const AsMin = m.g('Asm_den', 'A_{s,m\\acute{\\imath}n,den}', 2, 'cm²/m');
  const AsNec = m.g('Asn_den', 'A_{s,nec,den}', 2, 'cm²/m');
  const Ab = m.g('Ab_den', 'A_{\\phi,den}', 3, 'cm²');
  const s = m.g('s_den', 's_{den}', 1, 'cm');
  const Ase = m.g('Ase_den', 'A_{s,ef,den}', 2, 'cm²/m');
  const k = m.g('k_den', 'k_{den}', 3);
  const rho = m.g('rho_den', '\\rho_{1,den}', 4);
  const VRd1 = m.g('VRd1_den', 'V_{Rd1,den}', 2, 'kN/m');
  const lb = m.g('lb_den', '\\ell_{b,den}', 1, 'cm');
  const lbMin = m.g('lbm_den', '\\ell_{b,m\\acute{\\imath}n,den}', 1, 'cm');
  const lbNec = m.g('lbn_den', '\\ell_{b,nec,den}', 1, 'cm');
  const Asd = m.g('Asd_den', 'A_{s,dist,den}', 2, 'cm²/m');
  const nf = m.g('nf_den', 'n_{face,den}', 0);
  const Mt = m.g('Mt_den', 'M_{den,s}', 2, 'kN·m/m');
  const Mf = m.g('Mf_den', 'M_{f,s}', 2, 'kN·m/m');
  const AseS = m.g('Ase_sap', 'A_{s,ef,s}', 2, 'cm²/m');
  const xR = m.g('xr_sap', 'x_{R,s}', 2, 'cm');
  const MRd = m.g('MRd_sap', 'M_{Rd,s}', 2, 'kN·m/m');

  const DOIS = cte(2, 0);
  const fyd = div(fykKN, gs);
  // o aterro da frente só aparece na conta quando existe (h_fr = 0 some da soma sem mudar o número)
  const comAterro = (m.num('h_fr') ?? 0) > 0;
  const hRaiz = comAterro ? soma(hfr, hs) : hs;
  const hFundo = comAterro ? soma(hfr, hs, hden) : soma(hs, hden);

  // ── 1. passivo na face da frente ──
  const passivo = secao('Passivo cheio na face da frente', [
    m.entrada('b_den', 'b_{den}'),
    m.entrada('h_den', 'h_{den}'),
    temNumero(m, 'Kp_b') && m.passo('Kp_b', 'K_{p,b}', pot(tan(rad(soma(cte(45, 0), div(phib, DOIS)))), 2), { casas: 3, ref: RANKINE }),
    temNumero(m, 'p1_den') && m.passo('p1_den', 'p_{1,den}', mul(Kpb, gama, comAterro ? par(hRaiz) : hRaiz), { casas: 2, unidade: 'kPa', ref: RANKINE }),
    temNumero(m, 'p2_den') && m.passo('p2_den', 'p_{2,den}', mul(Kpb, gama, par(hFundo)), { casas: 2, unidade: 'kPa', ref: RANKINE }),
    temNumero(m, 'Ek_den') && m.passo('Ek_den', 'E_{k,den}', mul(div(par(soma(p1, p2)), DOIS), hden), { casas: 2, unidade: 'kN/m' }),
    temNumero(m, 'Mk_den') && m.passo('Mk_den', 'M_{k,den}',
      soma(div(mul(p1, pot(hden, 2)), DOIS), div(mul(par(sub(p2, p1)), pot(hden, 2)), cte(3, 0))), { casas: 2, unidade: 'kN·m/m' }),
    temNumero(m, 'y_den') && m.passo('y_den', 'y_{den}', div(Mk, Ek), { casas: 3, unidade: 'm' }),
    temNumero(m, 'Md_den') && m.passo('Md_den', 'M_{d,den}', mul(cte(1.4, 1), Mk), { casas: 2, unidade: 'kN·m/m' }),
  ], RANKINE);
  const desF = desenhoDasForcasNoDente(r);
  if (desF) passivo.desenho = desF;

  // ── 2. flexão na raiz, seção 100 × b ──
  const xResiste = temNumero(m, 'xln_den');                   // IFERROR(...;"não resiste")
  const xExpr = mul(cte(1.25, 2), d, par(sub(cte(1, 0), raiz(sub(cte(1, 0),
    div(MdCm, mul(cte(0.425, 3), cte(100, 0), pot(d, 2), fcdKNcm)))))));
  const flexao = secao('Flexão na raiz (seção 100 × b)', [
    m.entrada('cob_sap', 'c_s'),
    m.entrada('phi_den', '\\phi_{den}'),
    temNumero(m, 'd_den') && m.passo('d_den', 'd_{den}', sub(sub(bdenCm, cs), div(phi, DOIS)), { casas: 2, unidade: 'cm' }),
    xResiste
      ? m.passo('xln_den', 'x_{LN,den}', xExpr, { casas: 2, unidade: 'cm', ref: NBR('17.2.2') })
      : m.valor('Md_den') !== null && m.passo('xln_den', 'x_{LN,den}', null, { casas: 2, unidade: 'cm', origem: 'calculado', ref: NBR('17.2.2') }),
    xResiste && temNumero(m, 'xd_den') && m.passo('xd_den', '(x/d)_{den}', div(x, d), {
      casas: 3, ref: NBR('14.6.4.3'),
      verif: { chave: 'dente.ductilidade', rotulo: 'Dente: x/d ≤ 0,45', limite: 0.45, relacao: '<=', casasLimite: 2 },
    }),
    xResiste && temNumero(m, 'As_den') && m.passo('As_den', 'A_{s,den}', div(MdCm, mul(fyd, par(sub(d, mul(cte(0.4, 1), x))))), { casas: 2, unidade: 'cm²/m', ref: NBR('17.2.2') }),
    temNumero(m, 'Asm_den') && m.passo('Asm_den', 'A_{s,m\\acute{\\imath}n,den}', mul(cte(0.0015, 4), cte(100, 0), bdenCm), {
      casas: 2, unidade: 'cm²/m', ref: NBR('17.3.5.2.1'),
      // sem As,ef (a seção não resiste, a série de espaçamentos não dá o aço, falta o φ' do solo de apoio): a
      // verificação da flexão não some — fica nesta linha, reprovada pela célula da planilha
      verif: temNumero(m, 'Ase_den') ? undefined
        : { chave: 'dente.flexao', rotulo: 'Dente: flexão As,ef ≥ As', limite: null, relacao: '>=', celula: 'chk_fl_den' },
    }),
    temNumero(m, 'Asn_den') && m.passo('Asn_den', 'A_{s,nec,den}', max(As, AsMin), { casas: 2, unidade: 'cm²/m' }),
    temNumero(m, 'Ab_den') && m.passo('Ab_den', 'A_{\\phi,den}', div(mul(pi(), pot(phi, 2)), cte(4, 0)), { casas: 3, unidade: 'cm²' }),
    temNumero(m, 's_den') && m.passo('s_den', 's_{den}', null, { casas: 1, unidade: 'cm', origem: 'adotado', ref: NBR('20.1') }),
    temNumero(m, 'Ase_den') && m.passo('Ase_den', 'A_{s,ef,den}', mul(div(Ab, s), cte(100, 0)), {
      casas: 2, unidade: 'cm²/m',
      verif: { chave: 'dente.flexao', rotulo: 'Dente: flexão As,ef ≥ As', limite: temNumero(m, 'Asn_den') ? AsNec : null, relacao: '>=', celula: 'chk_fl_den' },
    }),
  ], NBR('17.2.2'));
  const desS = desenhoDaSecaoDoDente(r);
  if (desS) flexao.desenho = desS;

  // ── 3. cortante sem estribo ──
  const cortante = secao('Cortante na raiz, sem armadura de cortante', [
    temNumero(m, 'k_den') && m.passo('k_den', 'k_{den}', max(cte(1, 0), sub(cte(1.6, 1), dM)), { casas: 3 }),
    temNumero(m, 'rho_den') && m.passo('rho_den', '\\rho_{1,den}', min(cte(0.02, 2), div(Ase, mul(cte(100, 0), d))), { casas: 4 }),
    temNumero(m, 'VRd1_den') && m.passo('VRd1_den', 'V_{Rd1,den}',
      mul(cte(0.25, 2), fctdKNm, k, par(soma(cte(1.2, 1), mul(cte(40, 0), rho))), dM), { casas: 2, unidade: 'kN/m' }),
    temNumero(m, 'Vd_den') && m.passo('Vd_den', 'V_{d,den}', mul(cte(1.4, 1), Ek), {
      casas: 2, unidade: 'kN/m',
      verif: { chave: 'dente.cortante', rotulo: 'Dente: cortante Vd ≤ VRd1', limite: temNumero(m, 'VRd1_den') ? VRd1 : null, relacao: '<=', celula: 'chk_v_den' },
    }),
  ], NBR('19.4.1'));

  // ── 4. ancoragem das pernas do estribo dentro da sapata ──
  const relacao = temNumero(m, 'As_den') && temNumero(m, 'Ase_den');
  const ancoragem = secao('Ancoragem do estribo na sapata', [
    temNumero(m, 'lb_den') && m.passo('lb_den', '\\ell_{b,den}', mul(lbphi, phi), { casas: 1, unidade: 'cm', ref: NBR('9.4.2.4') }),
    temNumero(m, 'lbm_den') && m.passo('lbm_den', '\\ell_{b,m\\acute{\\imath}n,den}', max(mul(cte(0.3, 1), lb), mul(cte(10, 0), phi), cte(10, 0)), { casas: 1, unidade: 'cm', ref: NBR('9.4.2.5') }),
    relacao && temNumero(m, 'lbn_den') && m.passo('lbn_den', '\\ell_{b,nec,den}',
      max(mul(cte(0.7, 1), lb, min(cte(1, 0), div(As, Ase))), lbMin), { casas: 1, unidade: 'cm', ref: NBR('9.4.2.5') }),
    temNumero(m, 'lbd_den') && m.passo('lbd_den', '\\ell_{b,disp,den}', sub(hsCm, cs), {
      casas: 1, unidade: 'cm',
      verif: { chave: 'dente.ancoragem', rotulo: 'Dente: ancoragem do estribo na sapata', limite: temNumero(m, 'lbn_den') ? lbNec : null, relacao: '>=', celula: 'chk_anc_den' },
    }),
  ], NBR('9.4.2.5'));

  // ── 5. longitudinais de montagem ──
  const longitudinais = secao('Longitudinais de montagem', [
    m.entrada('phi_lden', '\\phi_{l,den}'),
    temNumero(m, 'Asd_den') && m.passo('Asd_den', 'A_{s,dist,den}', max(cte(0.9, 1), mul(cte(0.2, 1), Ase)), { casas: 2, unidade: 'cm²/m', ref: NBR('Tab. 19.1') }),
    temNumero(m, 'nf_den') && m.passo('nf_den', 'n_{face,den}',
      max(DOIS,
        arredCima(sub(div(mul(Asd, hden), div(mul(pi(), pot(phiL, 2)), cte(4, 0))), cte(0.005, 3))),
        soma(arredCima(div(hdenCm, cte(33, 0))), cte(1, 0))), { casas: 0, ref: NBR('20.1') }),
    temNumero(m, 'n_lden') && m.passo('n_lden', 'n_{l,den}', mul(DOIS, nf), { casas: 0 }),
  ], DEDUCAO);

  // ── 6. o momento do dente passado à sapata ──
  // IF(lado_den="Ponta";Mk_toe;Mk_heel): do lado da ponta traciona a face de cima da sapata; do talão, a de baixo
  const naPonta = m.texto('lado_den') === 'Ponta';
  const MkS: Expr = naPonta ? m.g('Mk_toe', 'M_{k,p}', 2, 'kN·m/m') : m.g('Mk_heel', 'M_{k,t}', 2, 'kN·m/m');
  const sapata = secao(`Momento passado à sapata (dente do lado ${naPonta ? 'da ponta' : 'do talão'})`, [
    temNumero(m, 'Mt_den') && m.passo('Mt_den', 'M_{den,s}', soma(Md, mul(Vd, hs)), { casas: 2, unidade: 'kN·m/m', ref: DEDUCAO }),
    temNumero(m, 'Mf_den') && m.passo('Mf_den', 'M_{f,s}', mul(cte(1.4, 1), max(cte(0, 0), neg(MkS))), { casas: 2, unidade: 'kN·m/m', ref: DEDUCAO }),
    temNumero(m, 'Ase_sap') && m.passo('Ase_sap', 'A_{s,ef,s}', mul(div(div(mul(pi(), pot(phiS, 2)), cte(4, 0)), sPs), cte(100, 0)), { casas: 2, unidade: 'cm²/m' }),
    temNumero(m, 'xr_sap') && m.passo('xr_sap', 'x_{R,s}', div(mul(AseS, fyd), mul(cte(0.68, 2), cte(100, 0), fcdKNcm)), { casas: 2, unidade: 'cm', ref: NBR('17.2.2') }),
    temNumero(m, 'MRd_sap') && m.passo('MRd_sap', 'M_{Rd,s}', div(mul(AseS, fyd, par(sub(dS, mul(cte(0.4, 1), xR)))), cte(100, 0)), { casas: 2, unidade: 'kN·m/m', ref: NBR('17.2.2') }),
    temNumero(m, 'Ms_den') && m.passo('Ms_den', 'M_{Sd,s}', soma(Mt, Mf), {
      casas: 2, unidade: 'kN·m/m', ref: DEDUCAO,
      verif: { chave: 'dente.sapata', rotulo: 'Dente: momento passado à sapata MSd ≤ MRd', limite: temNumero(m, 'MRd_sap') ? MRd : null, relacao: '<=', celula: 'chk_tr_den' },
    }),
  ], DEDUCAO);

  card.secoes = [passivo, flexao, cortante, ancoragem, longitudinais, sapata].filter((sc) => sc.passos.length > 0);
  return [card];
};
