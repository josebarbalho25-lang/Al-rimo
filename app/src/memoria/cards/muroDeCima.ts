/*
  MURO DE CIMA E VENTO (Jose, 13/11) — aba "Muro de cima e vento" da planilha (tools/muro_de_cima.py).

  Quatro cards, na ordem em que a carga anda:
    1. vento (NBR 6123): da velocidade básica à pressão no muro, e o que ela leva para a base do arrimo e para o
       contraforte que recebe o pilarete;
    2. muro de cima: peso por metro (o que pesa no arrimo) e os painéis entre cintas (NBR 16868-1 Anexo E);
    3. pilarete: balanço engastado no topo do arrimo, com o vento da largura inteira entre pilaretes;
    4. cinta do topo do arrimo (só com contrafortes): a parte do vento que o painel descarrega na base.
  Cada linha é a conta da célula de mesmo nome (o teste confere em todo cenário do gabarito). Os caminhos de carga
  escolhidos a favor da segurança estão explicados no cabeçalho de tools/muro_de_cima.py — aqui não se repete prosa.
*/
import type { AutorDeCards, Card, Ref } from '../tipos';
import { cte, div, max, min, mul, par, pi, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao, type Memoria } from '../passo';

const NBR6123 = (item: string): Ref => ({ fonte: 'NBR 6123', item });
const NBR16868 = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });
const NBR6118 = (item: string): Ref => ({ fonte: 'NBR 6118', item });
const CRITERIO: Ref = { fonte: 'Critério adotado' };

export const SIMBOLOS_MURODECIMA: Readonly<Record<string, string>> = {
  V_0: 'velocidade básica do vento (isopletas)',
  S_1: 'fator topográfico',
  S_2: 'fator de rugosidade, dimensões e altura',
  S_3: 'fator estatístico da estrutura (pilarete e arrimo)',
  'S_{3,v}': 'fator estatístico da vedação (painéis do muro de cima)',
  'v_{k,v}': 'velocidade característica do vento na vedação',
  'q_{v,v}': 'pressão dinâmica do vento na vedação',
  'p_{w,v}': 'pressão do vento no painel de vedação, característica',
  'z_v': 'altura do topo do muro de cima acima do terreno da frente',
  'z_{S2}': 'altura usada no S2 (no mínimo a da tabela)',
  'b_{S2}': 'parâmetro meteorológico b do S2',
  'F_r': 'fator de rajada',
  'p_{S2}': 'expoente da lei potencial do S2',
  'v_k': 'velocidade característica do vento',
  'q_v': 'pressão dinâmica do vento',
  'C_f': 'coeficiente de força do muro isolado',
  'p_w': 'pressão do vento no muro, característica',
  'h_{mc}': 'altura do muro de cima',
  'h_{exp}': 'altura do arrimo acima do solo contido',
  'h_{liv}': 'altura livre exposta ao vento, do solo ao topo do muro de cima',
  'V_{k,w}': 'força do vento na base do arrimo, por metro',
  'M_{k,w}': 'momento do vento na base do arrimo, por metro',
  'n_{pil}': 'contrafortes por pilarete (pilarete a cada n contrafortes)',
  'F_{w,p}': 'vento do muro de cima levado pelo contraforte com pilarete',
  'F_{w,e}': 'vento no arrimo acima do solo, na largura do contraforte',
  'V_{k,w,cf}': 'força do vento na base do contraforte',
  'M_{k,w,cf}': 'momento do vento na base do contraforte',
  'g_{mc}': 'peso da alvenaria do muro de cima, sem reboco',
  'g_{mc,r}': 'peso do reboco do muro de cima',
  'e_{reb,mc}': 'espessura do reboco em cada face do muro de cima',
  'g_{mc,t}': 'peso da parede do muro de cima com reboco',
  '\\gamma_{pil}': 'peso específico do pilarete',
  'n_{cin}': 'número de cintas do muro de cima',
  's_{pil}': 'eixo a eixo dos pilaretes',
  '\\ell_{mc}': 'largura do painel do muro de cima (eixo a eixo dos pilaretes)',
  'b_{pil}': 'largura do pilarete, ao longo do muro',
  'h_{pil}': 'altura da seção do pilarete, na direção do vento',
  'c_{e,pil}': 'cobrimento ao eixo das barras do pilarete',
  'b_{lig}': 'largura da ligação do pilarete no arrimo (frente ou haste)',
  'h_{lig}': 'altura da ligação na direção do vento (muro ou contraforte)',
  'd_{lig}': 'altura útil das barras do pilarete dentro da ligação',
  'f_{pk*,lig}': 'resistência do prisma cheio do bloco do arrimo',
  'K_{f_d,lig}': 'resistência de cálculo da alvenaria grauteada da ligação',
  'x_{lig}': 'linha neutra na ligação',
  'x/d_{lig}': 'posição relativa da linha neutra na ligação',
  'A_{s,lig}': 'armadura de uma face do pilarete pedida na ligação',
  'f_{vd,lig}': 'resistência de cálculo ao cisalhamento na ligação',
  '\\tau_{vd,lig}': 'tensão de cisalhamento na ligação',
  't_{mc}': 'espessura do bloco do muro de cima',
  'P_{mc}': 'peso do muro de cima por metro de arrimo',
  'f_{d,mc}': 'pressão de cálculo do vento no painel',
  'W_{mc}': 'módulo resistente do painel do muro de cima, por metro',
  '\\mu_{mc}': 'razão de ortogonalidade do muro de cima',
  'f_{tk,\\parallel,mc}': 'resistência à tração na flexão paralela à fiada',
  'f_{tk,\\perp,mc}': 'resistência à tração na flexão normal à fiada',
  'f_{td,\\parallel,mc}': 'resistência de cálculo à tração paralela à fiada',
  'f_{td,\\perp,mc}': 'resistência de cálculo à tração normal à fiada',
  'f_{vd,mc}': 'resistência de cálculo ao cisalhamento do muro de cima',
  'h_{p,A}': 'altura do painel de baixo',
  'h_{p,B}': 'altura do painel de cima',
  '\\beta_{f,A}': 'coeficiente do momento de ruptura, painel de baixo',
  '\\beta_{f,B}': 'coeficiente do momento de ruptura, painel de cima',
  'M_{d,\\parallel,A}': 'momento de cálculo paralelo à fiada, painel de baixo',
  'M_{d,\\perp,A}': 'momento de cálculo normal à fiada, painel de baixo',
  'M_{d,\\parallel,B}': 'momento de cálculo paralelo à fiada, painel de cima',
  'M_{d,\\perp,B}': 'momento de cálculo normal à fiada, painel de cima',
  '\\sigma_{td,\\parallel,A}': 'tração de cálculo paralela à fiada, painel de baixo',
  '\\sigma_{td,\\perp,A}': 'tração de cálculo normal à fiada, painel de baixo',
  '\\sigma_{td,\\parallel,B}': 'tração de cálculo paralela à fiada, painel de cima',
  '\\sigma_{td,\\perp,B}': 'tração de cálculo normal à fiada, painel de cima',
  '\\tau_{vd,A}': 'cisalhamento de cálculo, painel de baixo',
  '\\tau_{vd,B}': 'cisalhamento de cálculo, painel de cima',
  'V_{k,pil}': 'força do vento na base do pilarete',
  'M_{k,pil}': 'momento do vento na base do pilarete',
  'M_{d,pil}': 'momento de cálculo na base do pilarete',
  'V_{d,pil}': 'força cortante de cálculo na base do pilarete',
  'd_{pil}': 'altura útil do pilarete',
  'c_{pil}': 'cobrimento do pilarete (até o estribo; no bloco, até a barra)',
  'n_{b,pil}': 'barras em cada face do pilarete',
  '\\phi_{pil}': 'diâmetro das barras do pilarete',
  'A_{s,ef,pil}': 'armadura efetiva de uma face do pilarete',
  'f_{yd,pil}': 'resistência de cálculo do aço do pilarete',
  'f_{cd,pil}': 'resistência de cálculo do concreto do pilarete',
  'x_{pil}': 'profundidade da linha neutra do pilarete',
  'A_{s,pil}': 'armadura de cálculo do pilarete',
  'A_{s,min,pil}': 'armadura mínima do pilarete',
  'A_{s,nec,pil}': 'armadura necessária do pilarete',
  'V_{Rd2,pil}': 'resistência da diagonal comprimida do pilarete',
  'f_{pk*,pil}': 'resistência do prisma cheio do pilarete de bloco',
  'K_{f_d,pil}': 'resistência de cálculo à compressão na flexão do pilarete',
  'f_{vd,pil}': 'resistência de cálculo ao cisalhamento do pilarete de bloco',
  'x/d_{pil}': 'posição relativa da linha neutra do pilarete',
  '\\ell_{0t,pil}': 'traspasse da barra do pilarete no graute do arrimo',
  '\\eta_{cin}': 'parte do vento do muro de cima que desce pela base do painel',
  'w_{cin}': 'carga de vento na cinta do topo do arrimo',
  'M_{d,cin}': 'momento de cálculo do vento na cinta do topo',
  'M_{d,e,cin}': 'momento de cálculo do empuxo na canaleta do topo',
  'x_{cin}': 'profundidade da linha neutra da cinta do topo',
  'A_{s,cin}': 'armadura necessária da cinta do topo (empuxo + vento)',
  'A_{s,1\\phi}': 'área de uma barra horizontal',
};

const ligado = (m: Memoria, nome: string) => m.texto(nome) === 'Sim';

function cardVento(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const vento = ligado(m, 'vento_on');
  const comCf = m.texto('Tipo_muro') === 'Contrafortes';
  const hM = m.ent('H_muro', 'h_{muro}');
  const hS = m.ent('H_solo', 'h_{solo}');
  const hmc = m.g('h_mce', 'h_{mc}', 2, 'm');
  const zv = m.g('z_v', 'z_v', 2, 'm');
  const z2 = m.g('z_s2', 'z_{S2}', 2, 'm');
  const b = m.g('b_s2', 'b_{S2}', 2);
  const fr = m.g('Fr_s2', 'F_r', 2);
  const p = m.g('p_s2', 'p_{S2}', 3);
  const S2 = m.g('S2_v', 'S_2', 3);
  const vk = m.g('Vk_v', 'v_k', 2, 'm/s');
  const q = m.g('q_v', 'q_v', 3, 'kN/m²');
  const Cf = m.g('Cf_v', 'C_f', 2);
  const pw = m.g('p_w', 'p_w', 3, 'kN/m²');
  const hexp = m.g('h_exp', 'h_{exp}', 2, 'm');
  const hliv = m.g('h_liv', 'h_{liv}', 2, 'm');
  const Vkw = m.g('Vk_w', 'V_{k,w}', 2, 'kN/m');
  const binf = m.g('binf', 'b_{inf}', 2, 'm');
  const Fwp = m.g('F_wpc', 'F_{w,p}', 2, 'kN');
  const Fwe = m.g('F_wec', 'F_{w,e}', 2, 'kN');
  const zMin = m.texto('cat_v') === 'V' ? 10 : 5;

  const pressao = secao('Pressão dinâmica', [
    m.entrada('V0_v', 'V_0'),
    m.entrada('S1_v', 'S_1'),
    m.entrada('S3_e', 'S_3'),
    m.entrada('S3_v', 'S_{3,v}'),
    m.passo('h_mce', 'h_{mc}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.passo('z_v', 'z_v', soma(hM, hmc), { casas: 2, unidade: 'm' }),
    m.passo('z_s2', 'z_{S2}', max(cte(zMin, 0), zv), { casas: 2, unidade: 'm', ref: NBR6123('Tab. 1') }),
    m.passo('b_s2', 'b_{S2}', null, { casas: 2, origem: 'tabela', ref: NBR6123('Tab. 1') }),
    m.passo('Fr_s2', 'F_r', null, { casas: 2, origem: 'tabela', ref: NBR6123('Tab. 1') }),
    m.passo('p_s2', 'p_{S2}', null, { casas: 3, origem: 'tabela', ref: NBR6123('Tab. 1') }),
    m.passo('S2_v', 'S_2', mul(b, fr, pot(div(z2, cte(10, 0)), p)), { casas: 3, ref: NBR6123('5.3.3') }),
    m.passo('Vk_v', 'v_k', mul(m.ent('V0_v', 'V_0'), m.ent('S1_v', 'S_1'), S2, m.ent('S3_e', 'S_3')), { casas: 2, unidade: 'm/s', ref: NBR6123('4.2') }),
    m.passo('q_v', 'q_v', div(mul(cte(0.613, 3), pot(vk, 2)), cte(1000, 0)), { casas: 3, unidade: 'kN/m²', ref: NBR6123('4.2') }),
    m.passo('Cf_v', 'C_f', null, { casas: 2, origem: m.num('Cf_dir') !== null ? 'entrada' : 'tabela', ref: NBR6123('8.1, Tab. 16') }),
    m.passo('p_w', 'p_w', mul(Cf, q), {
      casas: 3, unidade: 'kN/m²',
      verif: { chave: 'vento.dados', rotulo: 'Dados do vento', limite: 0, relacao: '>=', celula: 'chk_dv', aplicavel: vento },
    }),
    // a vedação (painéis do muro de cima) com o S3 dela (Jose, 13/11: "vedação é vedação, estrutura é estrutura")
    m.passo('Vk_vv', 'v_{k,v}', mul(m.ent('V0_v', 'V_0'), m.ent('S1_v', 'S_1'), S2, m.ent('S3_v', 'S_{3,v}')), { casas: 2, unidade: 'm/s' }),
    m.passo('q_vv', 'q_{v,v}', div(mul(cte(0.613, 3), pot(m.g('Vk_vv', 'v_{k,v}', 2, 'm/s'), 2)), cte(1000, 0)), { casas: 3, unidade: 'kN/m²' }),
    m.passo('p_wv', 'p_{w,v}', mul(Cf, m.g('q_vv', 'q_{v,v}', 3, 'kN/m²')), { casas: 3, unidade: 'kN/m²' }),
  ], NBR6123('4.2'));

  const noArrimo = secao('Na base do arrimo, por metro', [
    m.passo('h_exp', 'h_{exp}', max(cte(0, 0), sub(hM, hS)), { casas: 2, unidade: 'm' }),
    m.passo('h_liv', 'h_{liv}', soma(hexp, hmc), { casas: 2, unidade: 'm' }),
    m.passo('Vk_w', 'V_{k,w}', mul(pw, hliv), { casas: 2, unidade: 'kN/m' }),
    m.passo('Mk_w', 'M_{k,w}', mul(Vkw, par(soma(hS, div(hliv, cte(2, 0))))), { casas: 2, unidade: 'kN·m/m' }),
  ], CRITERIO);

  const noContraforte = comCf && secao('No contraforte com pilarete', [
    m.entrada('pil_ncf', 'n_{pil}'),
    m.passo('F_wpc', 'F_{w,p}', mul(pw, hmc, m.ent('pil_ncf', 'n_{pil}'), binf), { casas: 2, unidade: 'kN' }),
    m.passo('F_wec', 'F_{w,e}', mul(pw, hexp, binf), { casas: 2, unidade: 'kN' }),
    m.passo('Vk_wcf', 'V_{k,w,cf}', soma(Fwp, Fwe), { casas: 2, unidade: 'kN' }),
    m.passo('Mk_wcf', 'M_{k,w,cf}', soma(mul(Fwp, par(soma(hM, div(hmc, cte(2, 0))))), mul(Fwe, par(soma(hS, div(hexp, cte(2, 0)))))), {
      casas: 2, unidade: 'kN·m',
    }),
  ], CRITERIO);

  return {
    id: 'murocima.vento',
    titulo: 'Vento · NBR 6123',
    ref: { fonte: 'NBR 6123' },
    secoes: !vento ? [] : noContraforte ? [pressao, noArrimo, noContraforte] : [pressao, noArrimo],
    avisos: [],
    aplicavel: vento,
  };
}

function cardMuroDeCima(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const comMc = ligado(m, 'mc_on');
  const faces = m.texto('reb_mc') === 'Nas duas faces' ? 2 : m.texto('reb_mc') === 'Só na frente' ? 1 : 0;
  const hmc = m.ent('h_mc', 'h_{mc}');
  const tmc = m.ent('t_mc', 't_{mc}');
  const gmc = m.ent('g_mc', 'g_{mc}');
  const gmcr = m.g('g_mcr', 'g_{mc,r}', 2, 'kN/m²');
  const gmct = m.g('g_mct', 'g_{mc,t}', 2, 'kN/m²');
  const gpil = m.g('g_pil', '\\gamma_{pil}', 2, 'kN/m³');
  const ncin = m.g('n_cin', 'n_{cin}', 0);
  const s = m.g('s_trib', 's_{pil}', 2, 'm');
  const bp = m.g('b_pila', 'b_{pil}', 1, 'cm');
  const hp = m.g('hs_pila', 'h_{pil}', 1, 'cm');
  const gc = m.ent('gama_c', '\\gamma_c');
  const gf = m.ent('gama_f', '\\gamma_f');
  const l = m.g('l_mc', '\\ell_{mc}', 2, 'm');
  const fd = m.g('fd_mc', 'f_{d,mc}', 3, 'kN/m²');
  const W = m.g('W_mc', 'W_{mc}', 6, 'm³/m');
  const mu = m.g('mu_mc', '\\mu_{mc}', 2);
  const ftkp = m.g('ftkp_mc', 'f_{tk,\\parallel,mc}', 2, 'MPa');
  const ftkn = m.g('ftkn_mc', 'f_{tk,\\perp,mc}', 2, 'MPa');
  const gm = m.ent('gama_m', '\\gamma_m');
  const cem = cte(100, 0);

  const peso = secao('Peso por metro de arrimo', [
    m.entrada('g_mc', 'g_{mc}'),
    m.passo('g_mcr', 'g_{mc,r}', mul(cte(21, 0), div(m.ent('reb_mc_esp', 'e_{reb,mc}'), cem), cte(faces, 0)), { casas: 2, unidade: 'kN/m²', ref: { fonte: 'NBR 6120' } }),
    m.passo('g_mct', 'g_{mc,t}', soma(gmc, gmcr), { casas: 2, unidade: 'kN/m²' }),
    m.passo('g_pil', '\\gamma_{pil}', null, { casas: 2, unidade: 'kN/m³', origem: 'adotado' }),
    m.passo('n_cin', 'n_{cin}', null, { casas: 0, origem: 'adotado' }),
    m.passo('s_trib', 's_{pil}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    // a seção do pilarete (em branco = a que o tipo de muro pede) e a MONTAGEM dele no arrimo: balanço só em bloco 19
    // e com 20 cm de frente (Jose, 13/11) — reprova com ou sem vento
    m.passo('b_pila', 'b_{pil}', null, { casas: 1, unidade: 'cm', origem: m.num('b_pil') !== null ? 'entrada' : 'adotado' }),
    m.passo('hs_pila', 'h_{pil}', null, {
      casas: 1, unidade: 'cm', origem: m.num('hs_pil') !== null ? 'entrada' : 'adotado',
      verif: { chave: 'murocima.pilarete.montagem', rotulo: 'Pilarete: montagem no arrimo', limite: m.g('h_lig', 'h_{lig}', 1, 'cm'), relacao: '<=', celula: 'chk_ligg', aplicavel: comMc },
    }),
    m.passo('P_mc', 'P_{mc}', soma(...[
      mul(gmct, hmc),
      ...((m.num('s_trib') ?? 0) > 0 ? [mul(par(sub(div(mul(gpil, bp, hp), cte(10000, 0)), div(mul(gmct, bp), cem))), div(hmc, s))] : []),
      mul(ncin, par(sub(div(mul(gc, tmc), cem), gmct)), cte(0.2, 1)),
    ]), {
      casas: 2, unidade: 'kN/m', ref: CRITERIO,
      verif: { chave: 'murocima.dados', rotulo: 'Muro de cima: dados', limite: 0, relacao: '>=', celula: 'chk_dmc', aplicavel: comMc },
    }),
  ], { fonte: 'NBR 6120' });

  const basePainel = secao('Painéis entre pilaretes e cintas', [
    m.passo('l_mc', '\\ell_{mc}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.passo('ftkn_mc', 'f_{tk,\\perp,mc}', null, { casas: 2, unidade: 'MPa', origem: m.num('ftkn_mc_dir') !== null ? 'entrada' : 'tabela', ref: NBR16868('Tab. 3') }),
    m.passo('ftkp_mc', 'f_{tk,\\parallel,mc}', null, { casas: 2, unidade: 'MPa', origem: m.num('ftkp_mc_dir') !== null ? 'entrada' : 'tabela', ref: NBR16868('Tab. 3') }),
    m.passo('mu_mc', '\\mu_{mc}', div(ftkn, ftkp), { casas: 2, ref: NBR16868('E.2') }),
    m.passo('ftdp_mc', 'f_{td,\\parallel,mc}', div(ftkp, gm), { casas: 3, unidade: 'MPa' }),
    m.passo('ftdn_mc', 'f_{td,\\perp,mc}', div(ftkn, gm), { casas: 3, unidade: 'MPa' }),
    m.passo('fvd_mc', 'f_{vd,mc}', null, { casas: 3, unidade: 'MPa', origem: m.num('fvk_mc_dir') !== null ? 'entrada' : 'tabela', ref: NBR16868('Tab. 4') }),
    m.passo('fd_mc', 'f_{d,mc}', mul(gf, m.g('p_wv', 'p_{w,v}', 3, 'kN/m²')), { casas: 3, unidade: 'kN/m²' }),
    m.passo('W_mc', 'W_{mc}', div(pot(div(tmc, cem), 2), cte(6, 0)), { casas: 6, unidade: 'm³/m' }),
  ], NBR16868('Anexo E'));

  const painel = (k: 'A' | 'B') => {
    const h = m.num(`h_p${k}`) ?? 0;
    if (h <= 0) return null;
    const bf = m.g(`bf_p${k}`, `\\beta_{f,${k}}`, 4);
    const Mpa = m.g(`Mpa_p${k}`, `M_{d,\\parallel,${k}}`, 4, 'kN·m/m');
    const Mno = m.g(`Mno_p${k}`, `M_{d,\\perp,${k}}`, 4, 'kN·m/m');
    const desc = k === 'A' ? (m.num('h_pB') ?? 0) > 0 ? 'Painel de baixo' : 'Painel' : 'Painel de cima';
    return secao(desc, [
      m.passo(`h_p${k}`, `h_{p,${k}}`, null, { casas: 2, unidade: 'm', origem: 'adotado' }),
      m.passo(`bf_p${k}`, `\\beta_{f,${k}}`, null, { casas: 4, origem: 'tabela', ref: NBR16868('E.4.2, Tab. E.1') }),
      m.passo(`Mpa_p${k}`, `M_{d,\\parallel,${k}}`, mul(bf, fd, pot(l, 2)), { casas: 4, unidade: 'kN·m/m' }),
      m.passo(`Mno_p${k}`, `M_{d,\\perp,${k}}`, mul(mu, Mpa), { casas: 4, unidade: 'kN·m/m' }),
      m.passo(`sp_p${k}`, `\\sigma_{td,\\parallel,${k}}`, div(div(Mpa, W), cte(1000, 0)), {
        casas: 4, unidade: 'MPa',
        verif: { chave: `murocima.painel${k}.par`, rotulo: `Muro de cima: σtd,∥ ≤ ftd,∥ (${k})`, limite: m.g('ftdp_mc', 'f_{td,\\parallel,mc}', 3, 'MPa'), relacao: '<=', celula: `res_p${k}` },
      }),
      m.passo(`sn_p${k}`, `\\sigma_{td,\\perp,${k}}`, div(div(Mno, W), cte(1000, 0)), {
        casas: 4, unidade: 'MPa',
        verif: { chave: `murocima.painel${k}.nor`, rotulo: `Muro de cima: σtd,⊥ ≤ ftd,⊥ (${k})`, limite: m.g('ftdn_mc', 'f_{td,\\perp,mc}', 3, 'MPa'), relacao: '<=' },
      }),
      m.passo(`tv_p${k}`, `\\tau_{vd,${k}}`, div(div(div(mul(fd, l), cte(2, 0)), div(tmc, cem)), cte(1000, 0)), {
        casas: 4, unidade: 'MPa', ref: NBR16868('11.4.1'),
        verif: { chave: `murocima.painel${k}.tau`, rotulo: `Muro de cima: τvd ≤ fvd (${k})`, limite: m.g('fvd_mc', 'f_{vd,mc}', 3, 'MPa'), relacao: '<=' },
      }),
    ], NBR16868('Anexo E'));
  };
  const paineis = (['A', 'B'] as const).map(painel).filter((x): x is NonNullable<typeof x> => x !== null);
  const temVento = (m.num('p_w') ?? 0) > 0;

  return {
    id: 'murocima.muro',
    titulo: 'Muro de cima · peso e painéis',
    ref: { fonte: 'NBR 16868-1', item: 'Anexo E' },
    secoes: !comMc ? [] : temVento ? [peso, basePainel, ...paineis] : [peso],
    avisos: [],
    aplicavel: comMc,
  };
}

function cardPilarete(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const comMc = ligado(m, 'mc_on');
  const concreto = m.texto('pil_tipo').startsWith('Conc');
  const pw = m.g('p_w', 'p_w', 3, 'kN/m²');
  const hmc = m.g('h_mce', 'h_{mc}', 2, 'm');
  const s = m.g('s_trib', 's_{pil}', 2, 'm');
  const gf = m.ent('gama_f', '\\gamma_f');
  const gm = m.ent('gama_m', '\\gamma_m');
  const b = m.g('b_pila', 'b_{pil}', 1, 'cm');
  const hs = m.g('hs_pila', 'h_{pil}', 1, 'cm');
  const c = m.g('ce_pil', 'c_{e,pil}', 2, 'cm');
  const balanco = m.texto('Tipo_muro') !== 'Contrafortes';
  const phi = m.ent('phi_pil', '\\phi_{pil}');
  const nb = m.ent('n_pil', 'n_{b,pil}');
  const Vk = m.g('Vk_pil', 'V_{k,pil}', 2, 'kN');
  const Mk = m.g('Mk_pil', 'M_{k,pil}', 2, 'kN·m');
  const Md = m.g('Md_pil', 'M_{d,pil}', 2, 'kN·m');
  const d = m.g('d_pil', 'd_{pil}', 1, 'cm');
  const Asef = m.g('As_pile', 'A_{s,ef,pil}', 2, 'cm²');
  const fyd = m.g('fyd_pil', 'f_{yd,pil}', 1, 'MPa');
  const fcd = m.g('fcd_pil', 'f_{cd,pil}', 2, 'MPa');
  const Kfd = m.g('Kfd_pil', 'K_{f_d,pil}', 3, 'MPa');
  const cem = cte(100, 0);
  const fck = Number(String(m.texto('fck_pil')).slice(1, 3)) || 0;
  const xNum = m.num(concreto ? 'xc_pil' : 'xb_pil') !== null;
  const x = m.g(concreto ? 'xc_pil' : 'xb_pil', 'x_{pil}', 2, 'cm');
  const As = m.g(concreto ? 'Asc_pil' : 'Asb_pil', 'A_{s,pil}', 2, 'cm²');

  const esforcos = secao('Esforços na base do pilarete', [
    m.passo('Vk_pil', 'V_{k,pil}', mul(pw, hmc, s), { casas: 2, unidade: 'kN', ref: CRITERIO }),
    m.passo('Mk_pil', 'M_{k,pil}', div(mul(Vk, hmc), cte(2, 0)), { casas: 2, unidade: 'kN·m' }),
    m.passo('Md_pil', 'M_{d,pil}', mul(gf, Mk), { casas: 2, unidade: 'kN·m' }),
    m.passo('Vd_pil', 'V_{d,pil}', mul(gf, Vk), { casas: 2, unidade: 'kN' }),
  ], CRITERIO);

  const kNumero = m.num('K_cf');
  const flexao = secao(concreto ? 'Flexão (NBR 6118)' : 'Flexão (NBR 16868-1)', [
    // cobrimento ao eixo: c + estribo (Ø5 na conta) + Ø/2, e a barra dentro do bloco do arrimo (≥ parede + Ø/2)
    m.passo('ce_pil', 'c_{e,pil}', (() => {
      const cob = soma(m.ent('c_pil', 'c_{pil}'), ...(concreto ? [cte(0.5, 1)] : []), div(phi, cte(20, 0)));
      const hf = m.g('hf_bl', 'h_f', 1, 'cm');
      return balanco
        ? max(cob, soma(div(sub(m.ent('t_bloco', 't'), hs), cte(2, 0)), hf, div(phi, cte(20, 0))))
        : max(cob, soma(hf, div(phi, cte(20, 0))));
    })(), { casas: 2, unidade: 'cm', ref: concreto ? NBR6118('7.4.7.5') : CRITERIO }),
    m.passo('d_pil', 'd_{pil}', sub(hs, c), { casas: 1, unidade: 'cm' }),
    m.passo('As_pile', 'A_{s,ef,pil}', div(mul(nb, pi(), pot(phi, 2)), cte(400, 0)), { casas: 2, unidade: 'cm²' }),
    m.passo('fyd_pil', 'f_{yd,pil}', div(m.ent('fyk_', 'f_{yk}'), m.ent('gama_s', '\\gamma_s')), { casas: 1, unidade: 'MPa' }),
    concreto && m.passo('fcd_pil', 'f_{cd,pil}', div(cte(fck, 0), cte(1.4, 1)), { casas: 2, unidade: 'MPa', ref: NBR6118('12.3.3') }),
    !concreto && m.passo('fpk_pil', 'f_{pk*,pil}', null, { casas: 1, unidade: 'MPa', origem: 'tabela', ref: { fonte: 'ABCP', item: 'Tab. 3.2' } }),
    !concreto && m.passo('Kfd_pil', 'K_{f_d,pil}', div(mul(kNumero !== null ? m.ent('K_cf', 'K_{cf}') : cte(2, 1), cte(0.7, 1), m.g('fpk_pil', 'f_{pk*,pil}', 1, 'MPa')), gm), {
      casas: 3, unidade: 'MPa', ref: NBR16868('6.2.2.4'),
    }),
    xNum && m.passo(concreto ? 'xc_pil' : 'xb_pil', 'x_{pil}', concreto
      ? mul(cte(1.25, 2), d, par(sub(cte(1, 0), raiz(sub(cte(1, 0), div(mul(Md, cem), div(mul(cte(0.425, 3), b, pot(d, 2), fcd), cte(10, 0))))))))
      : mul(cte(1.25, 2), d, par(sub(cte(1, 0), raiz(sub(cte(1, 0), div(mul(Md, cem), div(mul(cte(0.5, 1), b, pot(d, 2), Kfd), cte(10, 0)))))))),
    { casas: 2, unidade: 'cm', ref: concreto ? NBR6118('17.2.2') : NBR16868('11.3') }),
    xNum && m.passo('xd_pil', 'x/d_{pil}', div(x, d), {
      casas: 3, verif: { chave: 'murocima.pilarete.xd', rotulo: 'Pilarete: x/d ≤ 0,45', limite: 0.45, relacao: '<=', casasLimite: 2, aplicavel: (m.num('p_w') ?? 0) > 0 },
    }),
    xNum && m.passo(concreto ? 'Asc_pil' : 'Asb_pil', 'A_{s,pil}', concreto
      ? div(mul(Md, cem), mul(div(fyd, cte(10, 0)), par(sub(d, mul(cte(0.4, 1), x)))))
      : div(mul(Md, cem), mul(div(fyd, cte(10, 0)), min(sub(d, mul(cte(0.4, 1), x)), mul(cte(0.95, 2), d)))),
    { casas: 2, unidade: 'cm²' }),
    m.passo(concreto ? 'Asm_pil' : 'Asmb_pil', 'A_{s,min,pil}', mul(cte(0.0015, 4), b, concreto ? hs : d), {
      casas: 2, unidade: 'cm²', ref: concreto ? NBR6118('17.3.5.2.1') : CRITERIO,
    }),
    xNum && m.passo('Asn_pil', 'A_{s,nec,pil}', max(As, m.g(concreto ? 'Asm_pil' : 'Asmb_pil', 'A_{s,min,pil}', 2, 'cm²')), {
      casas: 2, unidade: 'cm²',
      verif: { chave: 'murocima.pilarete.As', rotulo: 'Pilarete: As,ef ≥ As,nec', limite: Asef, relacao: '<=', celula: 'res_pil', aplicavel: (m.num('p_w') ?? 0) > 0 },
    }),
  ], concreto ? NBR6118('17.2') : NBR16868('11.3'));

  const cortante = secao('Cisalhamento', [
    m.passo('Vd_pil', 'V_{d,pil}', null, { casas: 2, unidade: 'kN', origem: 'calculado' }),
    concreto
      ? m.passo('VR2c_pil', 'V_{Rd2,pil}', mul(cte(0.27, 2), par(sub(cte(1, 0), div(cte(fck, 0), cte(250, 0)))), div(fcd, cte(10, 0)), b, d), {
        casas: 2, unidade: 'kN', ref: NBR6118('17.4.2.2'),
      })
      : m.passo('fvd_pil', 'f_{vd,pil}', div(min(cte(0.7, 1), soma(cte(0.35, 2), mul(cte(17.5, 1), div(Asef, mul(b, d))))), gm), {
        casas: 3, unidade: 'MPa', ref: NBR16868('11.4'),
      }),
  ], concreto ? NBR6118('17.4') : NBR16868('11.4'));

  // A ligação dentro do arrimo: alvenaria grauteada com as barras do pilarete (dedução, a parede em volta não conta)
  const bL = m.g('b_lig', 'b_{lig}', 1, 'cm');
  const dL = m.g('d_lig', 'd_{lig}', 1, 'cm');
  const KfdL = m.g('Kfd_lig', 'K_{f_d,lig}', 3, 'MPa');
  const xLNum = m.num('x_lig') !== null;
  const xL = m.g('x_lig', 'x_{lig}', 2, 'cm');
  const cf = m.texto('Tipo_muro') === 'Contrafortes';
  const ligacao = secao('Ligação no arrimo', [
    m.passo('b_lig', 'b_{lig}', null, { casas: 1, unidade: 'cm', origem: 'adotado', ref: CRITERIO }),
    m.passo('h_lig', 'h_{lig}', null, { casas: 1, unidade: 'cm', origem: 'adotado', ref: CRITERIO }),
    m.passo('d_lig', 'd_{lig}', sub(min(hs, m.g('h_lig', 'h_{lig}', 1, 'cm')), c), { casas: 1, unidade: 'cm' }),
    m.passo('fpk_lig', 'f_{pk*,lig}', null, { casas: 1, unidade: 'MPa', origem: 'tabela', ref: { fonte: 'ABCP', item: 'Tab. 3.2' } }),
    m.passo('Kfd_lig', 'K_{f_d,lig}', div(mul(kNumero !== null ? m.ent('K_cf', 'K_{cf}') : cte(2, 1), cte(0.7, 1), m.g('fpk_lig', 'f_{pk*,lig}', 1, 'MPa')), gm), {
      casas: 3, unidade: 'MPa', ref: NBR16868('6.2.2.4'),
    }),
    xLNum && m.passo('x_lig', 'x_{lig}', mul(cte(1.25, 2), dL, par(sub(cte(1, 0), raiz(sub(cte(1, 0), div(mul(Md, cem), div(mul(cte(0.5, 1), bL, pot(dL, 2), KfdL), cte(10, 0)))))))), {
      casas: 2, unidade: 'cm', ref: NBR16868('11.3'),
    }),
    xLNum && m.passo('xd_lig', 'x/d_{lig}', div(xL, dL), {
      casas: 3, verif: { chave: 'murocima.ligacao.xd', rotulo: 'Ligação: x/d ≤ 0,45', limite: 0.45, relacao: '<=', casasLimite: 2 },
    }),
    xLNum && m.passo('As_lig', 'A_{s,lig}', div(mul(Md, cem), mul(div(fyd, cte(10, 0)), min(sub(dL, mul(cte(0.4, 1), xL)), mul(cte(0.95, 2), dL)))), {
      casas: 2, unidade: 'cm²',
      verif: { chave: 'murocima.ligacao.As', rotulo: 'Ligação: As,ef ≥ As', limite: Asef, relacao: '<=' },
    }),
    m.passo('fvd_lig', 'f_{vd,lig}', div(min(cte(0.7, 1), soma(cte(0.35, 2), mul(cte(17.5, 1), div(Asef, mul(bL, dL))))), gm), {
      casas: 3, unidade: 'MPa', ref: NBR16868('11.4'),
    }),
    m.passo('tvd_lig', '\\tau_{vd,lig}', mul(div(m.g('Vd_pil', 'V_{d,pil}', 2, 'kN'), mul(bL, dL)), cte(10, 0)), {
      casas: 3, unidade: 'MPa',
      verif: { chave: 'murocima.ligacao', rotulo: cf ? 'Ligação no contraforte' : 'Ligação no muro', limite: m.g('fvd_lig', 'f_{vd,lig}', 3, 'MPa'), relacao: '<=', celula: 'res_lig' },
    }),
  ], NBR16868('11.3'));

  const ancoragem = secao('Emenda no arrimo', [
    m.passo('l0t_pil', '\\ell_{0t,pil}', null, { casas: 0, unidade: 'cm', origem: 'calculado', ref: NBR6118('9.5.2.2.1') }),
  ], NBR6118('9.5.2.2.1'));

  return {
    id: 'murocima.pilarete',
    titulo: concreto ? 'Pilarete de concreto' : 'Pilarete de bloco grauteado',
    ref: concreto ? { fonte: 'NBR 6118' } : { fonte: 'NBR 16868-1' },
    secoes: comMc && (m.num('p_w') ?? 0) > 0 ? [esforcos, flexao, cortante, ligacao, ancoragem] : [],
    avisos: [],
    aplicavel: comMc && (m.num('p_w') ?? 0) > 0,
  };
}

function cardCintaDoTopo(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const aplica = m.texto('Tipo_muro') === 'Contrafortes' && (m.num('w_cin') ?? 0) > 0;
  const pw = m.g('p_w', 'p_w', 3, 'kN/m²');
  const hmc = m.g('h_mce', 'h_{mc}', 2, 'm');
  const hexp = m.g('h_exp', 'h_{exp}', 2, 'm');
  const eta = m.g('sh_cin', '\\eta_{cin}', 2);
  const w = m.g('w_cin', 'w_{cin}', 2, 'kN/m');
  const Md = m.g('Md_cin', 'M_{d,cin}', 1, 'kN·cm');
  const Mde = m.g('Mde_cin', 'M_{d,e,cin}', 1, 'kN·cm');
  const sph = m.g('s_ph', 's_h', 0, 'cm');
  const dph = m.g('d_ph', 'd_h', 1, 'cm');
  const Kfd = m.g('Kfd_ph', 'K_hf_d', 3, 'MPa');
  const x = m.g('x_cin', 'x_{cin}', 2, 'cm');
  const xNum = m.num('x_cin') !== null;
  const cem = cte(100, 0);
  const secaoCinta = secao('Cinta do topo do arrimo', [
    m.passo('sh_cin', '\\eta_{cin}', null, { casas: 2, origem: 'adotado', ref: CRITERIO }),
    m.passo('w_cin', 'w_{cin}', mul(pw, par(soma(mul(hmc, eta), div(hexp, cte(2, 0))))), { casas: 2, unidade: 'kN/m', ref: CRITERIO }),
    m.passo('Md_cin', 'M_{d,cin}', mul(div(mul(m.ent('gama_f', '\\gamma_f'), w, pot(m.g('l_cf_adot', '\\ell_{cf}', 2, 'm'), 2)), cte(8, 0)), cem), { casas: 1, unidade: 'kN·cm' }),
    m.passo('Mde_cin', 'M_{d,e,cin}', div(mul(max(m.g('Mdxb_p', 'M_{dxb}', 1, 'kN·cm/m'), m.g('M_ph', 'M_h', 1, 'kN·cm/m')), sph), cem), { casas: 1, unidade: 'kN·cm' }),
    xNum && m.passo('x_cin', 'x_{cin}', mul(cte(1.25, 2), dph, par(sub(cte(1, 0), raiz(sub(cte(1, 0), div(soma(Md, Mde), div(mul(cte(0.5, 1), sph, pot(dph, 2), Kfd), cte(10, 0)))))))), {
      casas: 2, unidade: 'cm',
    }),
    xNum && m.passo('Ast_cin', 'A_{s,cin}', div(soma(Md, Mde), mul(div(div(m.ent('fyk_', 'f_{yk}'), m.ent('gama_s', '\\gamma_s')), cte(10, 0)), min(sub(dph, mul(cte(0.4, 1), x)), mul(cte(0.95, 2), dph)))), {
      casas: 2, unidade: 'cm²',
      verif: { chave: 'murocima.cinta', rotulo: 'Cinta do topo: As ≤ uma barra', limite: m.g('Asb_cin', 'A_{s,1\\phi}', 2, 'cm²'), relacao: '<=', celula: 'res_cin' },
    }),
  ], CRITERIO);
  return {
    id: 'murocima.cinta',
    titulo: 'Cinta do topo do arrimo · vento',
    ref: CRITERIO,
    secoes: aplica ? [secaoCinta] : [],
    avisos: [],
    aplicavel: aplica,
  };
}

/** Muro de cima e vento: vento, muro de cima, pilarete e cinta do topo do arrimo. */
export const autorMuroDeCima: AutorDeCards = (r) => [cardVento(r), cardMuroDeCima(r), cardPilarete(r), cardCintaDoTopo(r)];

