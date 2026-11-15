/*
  MURO DE CIMA E VENTO (Jose, 13/11) — aba "Muro de cima e vento" da planilha (tools/muro_de_cima.py).

  Quatro cards, na ordem em que a carga anda:
    1. vento (NBR 6123): da velocidade básica à pressão no muro, e o que ela leva para a base do arrimo e para o
       contraforte que recebe o pilarete;
    2. muro de cima: peso por metro (o que pesa no arrimo) e os painéis entre cintas (NBR 16868-1 Anexo E);
    3. pilarete: balanço engastado no topo do arrimo, com o vento da largura inteira entre pilaretes;
    4. cintas do muro de cima (15/11): concreto biapoiado entre pilaretes, flexão lateral (vento) e de gravidade,
       interação, cortante e ancoragem no pilarete da ponta;
    5. cinta do topo do arrimo (só com contrafortes): a parte do vento que o painel descarrega na base.
  Cada linha é a conta da célula de mesmo nome (o teste confere em todo cenário do gabarito). Os caminhos de carga
  escolhidos a favor da segurança estão explicados no cabeçalho de tools/muro_de_cima.py — aqui não se repete prosa.
*/
import type { AutorDeCards, Card, Ref } from '../tipos';
import { abs, cte, div, max, min, mul, par, pi, pot, raiz, soma, sub } from '../expr';
import { memoriaDe, secao, type Memoria } from '../passo';
import { secaoMRdNaoArmado, secoesMRdCintaMc, secoesMRdPilarete } from './momentoResistente';
import { desenhoDaCinta } from '../desenhoDaCinta';

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
  // cintas do muro de cima (15/11)
  'h_{cin}': 'altura da cinta do muro de cima',
  't_{cin}': 'largura da cinta (espessura do muro de cima)',
  '\\ell_{cin}': 'vão da cinta (eixo a eixo dos pilaretes)',
  'f_{ck,cin}': 'resistência característica do concreto da cinta (a do pilarete)',
  'f_{cd,cin}': 'resistência de cálculo do concreto da cinta',
  'f_{ctd,cin}': 'resistência de cálculo à tração do concreto da cinta',
  'f_{yd,cin}': 'resistência de cálculo do aço da cinta',
  '\\phi_{cin}': 'diâmetro das barras da cinta',
  'n_{cin,b}': 'barras da cinta adotadas',
  'A_{s,1,cin}': 'área de uma barra da cinta',
  'A_{s,min,cin}': 'armadura mínima da cinta em cada direção',
  'y_{p,1}': 'barra do pilarete mais longe do eixo do muro',
  'y_{p,2}': 'barra do pilarete mais perto do eixo do muro',
  's_{cin,p}': 'distância mínima entre os eixos da barra da cinta e da do pilarete',
  'a_{0}': 'distância ao eixo do muro da barra da cinta a 3 cm da face',
  'a_{1}': 'distância ao eixo do muro depois da barra do pilarete de fora',
  'a_{cin}': 'distância da barra da cinta ao eixo do muro',
  'a_{min}': 'menor distância ao eixo sem as barras das duas faces se encostarem',
  'M_{Rd,lat}': 'momento resistente lateral da cinta do muro de cima',
  'M_{Rd,grav}': 'momento resistente de gravidade da cinta do muro de cima',
  'c_{e,cin}': 'eixo da barra da cinta à face',
  'd_{lat}': 'altura útil da cinta na flexão lateral',
  'd_{grav}': 'altura útil da cinta na flexão de gravidade',
  'A_{s,lat}': 'armadura de uma face da cinta (flexão lateral)',
  'A_{s,grav}': 'armadura de baixo da cinta (gravidade)',
  'M_{R2,lat}': 'momento resistente lateral com 2 barras',
  'M_{R2,grav}': 'momento resistente de gravidade com 2 barras',
  'k_{lat}': 'fator de escala da cortante, direção lateral',
  'k_{grav}': 'fator de escala da cortante, gravidade',
  '\\rho_{lat}': 'taxa de armadura de tração, direção lateral',
  '\\rho_{grav}': 'taxa de armadura de tração, gravidade',
  'V_{Rd1,lat}': 'cortante resistente sem estribo, direção lateral',
  'V_{Rd1,grav}': 'cortante resistente sem estribo, gravidade',
  'f_{bd,cin}': 'resistência de aderência no concreto da cinta',
  '\\ell_{b,cin}': 'comprimento de ancoragem básico da barra da cinta',
  '\\ell_{b,min,cin}': 'comprimento de ancoragem mínimo da barra da cinta',
  '\\ell_{disp,r}': 'comprimento reto disponível no pilarete da ponta',
  'c_{g}': 'eixo da perna do gancho à face de fora do pilarete',
  '\\ell_{disp,g}': 'reto disponível até a dobra do gancho',
  'h_{t}': 'altura de painel que se apoia na cinta (carga lateral)',
  'h_{alv}': 'altura de alvenaria apoiada na cinta',
  'w_{lat}': 'carga lateral de vento na cinta, característica',
  'w_{grav}': 'carga de gravidade na cinta, característica',
  'M_{d,lat}': 'momento de cálculo lateral da cinta',
  'V_{d,lat}': 'cortante de cálculo lateral da cinta',
  'M_{d,grav}': 'momento de cálculo de gravidade da cinta',
  'V_{d,grav}': 'cortante de cálculo de gravidade da cinta',
  'x_{lat}': 'linha neutra da cinta na flexão lateral',
  'x_{grav}': 'linha neutra da cinta na gravidade',
  'A_{s,c,lat}': 'armadura de cálculo da cinta, lateral',
  'A_{s,c,grav}': 'armadura de cálculo da cinta, gravidade',
  'A_{s,n,lat}': 'armadura necessária da cinta, lateral (cálculo ou mínimo)',
  'A_{s,n,grav}': 'armadura necessária da cinta, gravidade (cálculo ou mínimo)',
  'x/d_{lat}': 'posição relativa da linha neutra, lateral',
  'x/d_{grav}': 'posição relativa da linha neutra, gravidade',
  'U_{lat}': 'aproveitamento à flexão lateral da cinta',
  'U_{grav}': 'aproveitamento à flexão de gravidade da cinta',
  'U_{cin}': 'interação das duas flexões da cinta',
  'r_{anc}': 'armadura a ancorar no apoio sobre a efetiva (lateral + gravidade)',
  '\\ell_{b,nec,r}': 'ancoragem necessária reta',
  '\\ell_{b,nec,g}': 'ancoragem necessária com gancho',
  '\\text{2 barras}': 'as duas barras da cinta passam na flexão (Sim ou Não)',
  '\\text{ancoragem}': 'ancoragem adotada no pilarete da ponta (reta ou com gancho)',
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
  // ftd·W de cada painel (W = t²/6 em m³/m; ×1000: MPa·m³ → kN·m)
  const resistentes = (['A', 'B'] as const)
    .map((k) => secaoMRdNaoArmado(m, {
      p: `MRp_p${k}`, n: `MRn_p${k}`, ap: `ap_pp${k}`, an: `ap_np${k}`, Mp: [`Mpa_p${k}`, `M_{d,\\parallel,${k}}`], Mn: [`Mno_p${k}`, `M_{d,\\perp,${k}}`],
      ftp: ['ftdp_mc', 'f_{td,\\parallel,mc}'], ftn: ['ftdn_mc', 'f_{td,\\perp,mc}'], W: m.g('W_mc', 'W_{mc}', 6, 'm³/m'), fator: cte(1000, 0), un: 'kN·m/m', casasM: 4,
      titulo: `Momento resistente da alvenaria · painel ${k}`,
    }))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return {
    id: 'murocima.muro',
    titulo: 'Muro de cima · peso e painéis',
    ref: { fonte: 'NBR 16868-1', item: 'Anexo E' },
    secoes: !comMc ? [] : temVento ? [peso, basePainel, ...paineis, ...resistentes] : [peso],
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
    secoes: comMc && (m.num('p_w') ?? 0) > 0 ? [esforcos, flexao, cortante, ligacao, ancoragem, ...secoesMRdPilarete(m)] : [],
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


function cardCintasDoMuroDeCima(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const aplica = ligado(m, 'mc_on') && m.texto('cin_mc') !== 'Nenhuma';
  const cem = cte(100, 0);
  const DEZ = cte(10, 0);
  const hc = m.g('hc_cmc', 'h_{cin}', 0, 'cm');
  const tc = m.g('tc_cmc', 't_{cin}', 1, 'cm');
  const l = m.g('l_cmc', '\\ell_{cin}', 2, 'm');
  const fck = m.g('fck_cmc', 'f_{ck,cin}', 0, 'MPa');
  const fcd = m.g('fcd_cmc', 'f_{cd,cin}', 2, 'MPa');
  const fctd = m.g('fctd_cmc', 'f_{ctd,cin}', 3, 'MPa');
  const fyd = m.g('fyd_cmc', 'f_{yd,cin}', 1, 'MPa');
  const phic = m.ent('phi_cin_mc', '\\phi_{cin}');
  const phip = m.ent('phi_pil', '\\phi_{pil}');
  const ceP = m.g('ce_pil', 'c_{e,pil}', 2, 'cm');
  const hsP = m.g('hs_pila', 'h_{pil}', 1, 'cm');
  const tA = m.ent('t_bloco', 't');
  const As1 = m.g('As1_cmc', 'A_{s,1,cin}', 3, 'cm²');
  const Asm = m.g('Asm_cmc', 'A_{s,min,cin}', 3, 'cm²');
  const pp1 = m.g('pp1_cmc', 'y_{p,1}', 2, 'cm');
  const pp2 = m.g('pp2_cmc', 'y_{p,2}', 2, 'cm');
  const sc = m.g('sc_cmc', 's_{cin,p}', 2, 'cm');
  const a0 = m.g('a0_cmc', 'a_{0}', 2, 'cm');
  const a1 = m.g('a1_cmc', 'a_{1}', 2, 'cm');
  const ac = m.g('ac_cmc', 'a_{cin}', 2, 'cm');
  const ce = m.g('ce_cmc', 'c_{e,cin}', 2, 'cm');
  const dl = m.g('dl_cmc', 'd_{lat}', 2, 'cm');
  const dg = m.g('dg_cmc', 'd_{grav}', 2, 'cm');
  const nb = m.g('n_cin_a', 'n_{cin,b}', 0);
  const Asl = m.g('Asl_cmc', 'A_{s,lat}', 3, 'cm²');
  const Asg = m.g('Asg_cmc', 'A_{s,grav}', 3, 'cm²');
  const lb = m.g('lb_cmc', '\\ell_{b,cin}', 1, 'cm');
  const lbm = m.g('lbm_cmc', '\\ell_{b,min,cin}', 1, 'cm');
  const um = cte(1, 0);
  const dois = cte(2, 0);
  const cf = m.texto('Tipo_muro') === 'Contrafortes';

  const dados = secao('Concreto, barras e onde elas passam', [
    m.passo('hc_cmc', 'h_{cin}', null, { casas: 0, unidade: 'cm', origem: 'adotado', ref: CRITERIO }),
    m.passo('tc_cmc', 't_{cin}', m.ent('t_mc', 't_{mc}'), { casas: 1, unidade: 'cm' }),
    m.passo('l_cmc', '\\ell_{cin}', null, { casas: 2, unidade: 'm', origem: 'adotado', ref: CRITERIO }),
    m.passo('fck_cmc', 'f_{ck,cin}', null, { casas: 0, unidade: 'MPa', origem: 'entrada' }),
    m.passo('fcd_cmc', 'f_{cd,cin}', div(fck, cte(1.4, 1)), { casas: 2, unidade: 'MPa', ref: NBR6118('12.3.3') }),
    m.passo('fctd_cmc', 'f_{ctd,cin}', div(mul(cte(0.21, 2), pot(fck, div(dois, cte(3, 0)))), cte(1.4, 1)), { casas: 3, unidade: 'MPa', ref: NBR6118('8.2.5') }),
    m.passo('fyd_cmc', 'f_{yd,cin}', div(m.ent('fyk_', 'f_{yk}'), m.ent('gama_s', '\\gamma_s')), { casas: 1, unidade: 'MPa' }),
    m.entrada('phi_cin_mc', '\\phi_{cin}'),
    m.passo('As1_cmc', 'A_{s,1,cin}', div(mul(pi(), pot(phic, 2)), cte(400, 0)), { casas: 3, unidade: 'cm²' }),
    m.passo('Asm_cmc', 'A_{s,min,cin}', mul(cte(0.0015, 4), hc, tc), { casas: 3, unidade: 'cm²', ref: NBR6118('17.3.5.2.1') }),
    m.passo('pp1_cmc', 'y_{p,1}', cf ? max(abs(sub(ceP, div(tA, dois))), abs(sub(sub(hsP, ceP), div(tA, dois)))) : sub(div(hsP, dois), ceP), { casas: 2, unidade: 'cm' }),
    m.passo('pp2_cmc', 'y_{p,2}', cf ? min(abs(sub(ceP, div(tA, dois))), abs(sub(sub(hsP, ceP), div(tA, dois)))) : sub(div(hsP, dois), ceP), { casas: 2, unidade: 'cm' }),
    m.passo('sc_cmc', 's_{cin,p}', div(soma(phic, phip), cte(20, 0)), { casas: 2, unidade: 'cm' }),
    m.passo('a0_cmc', 'a_{0}', sub(div(tc, dois), cte(3, 0)), { casas: 2, unidade: 'cm', ref: CRITERIO }),
    m.passo('a1_cmc', 'a_{1}', [a0, sub(pp1, sc)], { casas: 2, unidade: 'cm' }),
    m.passo('ac_cmc', 'a_{cin}', [a1, sub(pp2, sc)], {
      casas: 2, unidade: 'cm',
      verif: { chave: 'murocima.cintas.lugar', rotulo: 'Cintas: barras das duas faces sem se encostar', limite: m.g('acm_cmc', 'a_{min}', 2, 'cm'), relacao: '>=' },
    }),
    m.passo('ce_cmc', 'c_{e,cin}', sub(div(tc, dois), ac), { casas: 2, unidade: 'cm' }),
    m.passo('dl_cmc', 'd_{lat}', sub(tc, ce), { casas: 2, unidade: 'cm' }),
  ], NBR6118('17.2.2'));

  // a quantidade de barras: em branco, 2 quando 2 passam na flexão (As,mín e interação com o MRd de 2 barras)
  const MR2 = (As: ReturnType<typeof m.g>, b: ReturnType<typeof m.g>, d: ReturnType<typeof m.g>) => {
    const F = div(mul(As, fyd), DEZ);
    const x = div(F, mul(cte(0.68, 2), div(fcd, DEZ), b));
    return [div(mul(F, par(sub(d, mul(cte(0.4, 1), x)))), cem), div(mul(cte(0.68, 2), div(fcd, DEZ), b, cte(0.45, 2), d, par(sub(d, mul(cte(0.4, 1), cte(0.45, 2), d)))), cem)];
  };
  const MR2g = (() => {
    const As = mul(dois, As1);
    const F = div(mul(As, fyd), DEZ);
    const d = div(hc, dois);
    const x = div(F, mul(cte(0.68, 2), div(fcd, DEZ), tc));
    return [div(mul(F, par(sub(d, mul(cte(0.4, 1), x)))), cem), div(mul(cte(0.68, 2), div(fcd, DEZ), tc, cte(0.45, 2), d, par(sub(d, mul(cte(0.4, 1), cte(0.45, 2), d)))), cem)];
  })();
  const quantas = secao('Quantidade de barras', [
    m.passo('M2l_cmc', 'M_{R2,lat}', MR2(As1, hc, dl), { casas: 3, unidade: 'kN·m', ref: NBR6118('17.2.2') }),
    m.passo('M2g_cmc', 'M_{R2,grav}', MR2g, { casas: 3, unidade: 'kN·m', ref: NBR6118('17.2.2') }),
    m.passo('n_cin_a', 'n_{cin,b}', null, { casas: 0, origem: m.num('n_cin_mc') !== null ? 'entrada' : 'adotado', ref: CRITERIO }),
    m.passo('dg_cmc', 'd_{grav}', [div(hc, dois), sub(hc, cte(3, 0))], { casas: 2, unidade: 'cm' }),
    m.passo('Asl_cmc', 'A_{s,lat}', mul(div(nb, dois), As1), { casas: 3, unidade: 'cm²' }),
    m.passo('Asg_cmc', 'A_{s,grav}', mul(dois, As1), { casas: 3, unidade: 'cm²' }),
  ], CRITERIO);

  const cortanteComum = secao('Cortante resistente sem estribo', [
    ...(['l', 'g'] as const).flatMap((k) => {
      const lat = k === 'l';
      const b = lat ? hc : tc;
      const d = lat ? dl : dg;
      const As = lat ? Asl : Asg;
      const s = lat ? 'lat' : 'grav';
      const kk = m.g(`k${k}_cmc`, `k_{${s}}`, 3);
      const rho = m.g(`rho${k}_cmc`, `\\rho_{${s}}`, 4);
      return [
        m.passo(`k${k}_cmc`, `k_{${s}}`, max(um, sub(cte(1.6, 1), div(d, cem))), { casas: 3 }),
        m.passo(`rho${k}_cmc`, `\\rho_{${s}}`, min(cte(0.02, 2), div(As, mul(b, d))), { casas: 4 }),
        m.passo(`VR1${k}_cmc`, `V_{Rd1,${s}}`, mul(cte(0.25, 2), div(fctd, DEZ), kk, par(soma(cte(1.2, 1), mul(cte(40, 0), rho))), b, d), { casas: 2, unidade: 'kN', ref: NBR6118('19.4.1') }),
      ];
    }),
  ], NBR6118('19.4.1'));

  const ldr = m.g('ldr_cmc', '\\ell_{disp,r}', 1, 'cm');
  const ldg = m.g('ldg_cmc', '\\ell_{disp,g}', 1, 'cm');
  const cg = m.g('cg_cmc', 'c_{g}', 2, 'cm');
  const ancoragemComum = secao('Ancoragem no pilarete da ponta', [
    m.passo('fbd_cmc', 'f_{bd,cin}', mul(cte(2.25, 2), fctd), { casas: 3, unidade: 'MPa', ref: NBR6118('9.3.2.1') }),
    m.passo('lb_cmc', '\\ell_{b,cin}', mul(div(fyd, mul(cte(4, 0), m.g('fbd_cmc', 'f_{bd,cin}', 3, 'MPa'))), div(phic, DEZ)), { casas: 1, unidade: 'cm', ref: NBR6118('9.4.2.4') }),
    m.passo('lbm_cmc', '\\ell_{b,min,cin}', max(mul(cte(0.3, 1), lb), phic, DEZ), { casas: 1, unidade: 'cm', ref: NBR6118('9.4.2.5') }),
    m.passo('ldr_cmc', '\\ell_{disp,r}', sub(m.g('b_pila', 'b_{pil}', 1, 'cm'), cte(3, 0)), { casas: 1, unidade: 'cm' }),
    m.passo('cg_cmc', 'c_{g}', max(cte(3, 0), soma(sub(ceP, div(phip, cte(20, 0))), div(phic, cte(20, 0)))), { casas: 2, unidade: 'cm' }),
    m.passo('ldg_cmc', '\\ell_{disp,g}', [sub(sub(m.g('b_pila', 'b_{pil}', 1, 'cm'), cg), mul(cte(0.3, 1), phic)), cte(0, 0)], { casas: 1, unidade: 'cm', ref: NBR6118('Tab. 9.1') }),
  ], NBR6118('9.4.2.5'));

  const gf = m.ent('gama_f', '\\gamma_f');
  const pw = m.g('p_w', 'p_w', 3, 'kN/m²');
  const hA = m.g('h_pA', 'h_{p,A}', 2, 'm');
  const hB = m.g('h_pB', 'h_{p,B}', 2, 'm');
  const porCinta = (k: 'T' | 'M') => {
    if (m.texto(`on_c${k}`) !== 'Sim') return [];
    const desc = k === 'T' ? 'Cinta do topo' : 'Cinta de meia altura';
    const kk = k === 'T' ? 'topo' : 'meia';
    const ht = m.g(`ht_c${k}`, 'h_{t}', 2, 'm');
    const hm = m.g(`hm_c${k}`, 'h_{alv}', 2, 'm');
    const wl = m.g(`wl_c${k}`, 'w_{lat}', 3, 'kN/m');
    const wg = m.g(`wg_c${k}`, 'w_{grav}', 3, 'kN/m');
    const Mdl = m.g(`Mdl_c${k}`, 'M_{d,lat}', 3, 'kN·m');
    const Mdg = m.g(`Mdg_c${k}`, 'M_{d,grav}', 3, 'kN·m');
    const Vdl = m.g(`Vdl_c${k}`, 'V_{d,lat}', 3, 'kN');
    const Vdg = m.g(`Vdg_c${k}`, 'V_{d,grav}', 3, 'kN');
    const xl = m.g(`xl_c${k}`, 'x_{lat}', 2, 'cm');
    const xg = m.g(`xg_c${k}`, 'x_{grav}', 2, 'cm');
    const temXl = m.num(`xl_c${k}`) !== null;
    const temXg = m.num(`xg_c${k}`) !== null;
    const cargas = secao(`${desc}: cargas e esforços`, [
      m.passo(`ht_c${k}`, 'h_{t}', k === 'T' ? [div(hB, dois), div(hA, dois)] : [soma(div(hA, dois), div(hB, dois)), soma(div(hA, dois), hB)], { casas: 2, unidade: 'm', ref: CRITERIO }),
      k === 'M' && m.passo(`hm_c${k}`, 'h_{alv}', [sub(hB, div(hc, cem)), hB], { casas: 2, unidade: 'm', ref: CRITERIO }),
      m.passo(`wl_c${k}`, 'w_{lat}', mul(pw, ht), { casas: 3, unidade: 'kN/m', ref: NBR6123('4.2') }),
      m.passo(`wg_c${k}`, 'w_{grav}', k === 'T'
        ? soma(mul(par(soma(div(mul(m.ent('gama_c', '\\gamma_c'), tc), cem), m.g('g_mcr', 'g_{mc,r}', 2, 'kN/m²'))), div(hc, cem)), mul(m.g('g_mct', 'g_{mc,t}', 2, 'kN/m²'), hm))
        : soma(mul(par(soma(div(mul(m.ent('gama_c', '\\gamma_c'), tc), cem), m.g('g_mcr', 'g_{mc,r}', 2, 'kN/m²'))), div(hc, cem)), mul(m.g('g_mct', 'g_{mc,t}', 2, 'kN/m²'), hm)),
      { casas: 3, unidade: 'kN/m', ref: { fonte: 'NBR 6120' } }),
      m.passo(`Mdl_c${k}`, 'M_{d,lat}', div(mul(gf, wl, pot(l, 2)), cte(8, 0)), { casas: 3, unidade: 'kN·m' }),
      m.passo(`Vdl_c${k}`, 'V_{d,lat}', div(mul(gf, wl, l), dois), { casas: 3, unidade: 'kN' }),
      m.passo(`Mdg_c${k}`, 'M_{d,grav}', div(mul(gf, wg, pot(l, 2)), cte(8, 0)), { casas: 3, unidade: 'kN·m' }),
      m.passo(`Vdg_c${k}`, 'V_{d,grav}', div(mul(gf, wg, l), dois), { casas: 3, unidade: 'kN' }),
      m.passo(`t2_c${k}`, '\\text{2 barras}', null, { casas: 0, origem: 'calculado' }),
    ], CRITERIO);
    const xDe = (Md: typeof Mdl, b: typeof hc, d: typeof dl) => mul(cte(1.25, 2), d, par(sub(um, raiz(sub(um, div(mul(Md, cem), div(mul(cte(0.425, 3), b, pot(d, 2), fcd), DEZ)))))));
    const AsDe = (Md: typeof Mdl, d: typeof dl, x: typeof xl) => div(mul(Md, cem), mul(div(fyd, DEZ), par(sub(d, mul(cte(0.4, 1), x)))));
    const umaFlexao = (lat: boolean) => {
      const s = lat ? 'lat' : 'grav';
      const Md = lat ? Mdl : Mdg;
      const b = lat ? hc : tc;
      const d = lat ? dl : dg;
      const x = lat ? xl : xg;
      const temX = lat ? temXl : temXg;
      const id = lat ? 'l' : 'g';
      const As = lat ? Asl : Asg;
      return [
        temX && m.passo(`x${id}_c${k}`, `x_{${s}}`, xDe(Md, b, d), { casas: 2, unidade: 'cm', ref: NBR6118('17.2.2') }),
        temX && m.passo(`xd${id}_c${k}`, `x/d_{${s}}`, div(x, d), {
          casas: 3, ref: NBR6118('14.6.4.3'),
          verif: { chave: `murocima.cinta${kk}.xd${id}`, rotulo: `${desc}: x/d ≤ 0,45 (${lat ? 'lateral' : 'gravidade'})`, limite: 0.45, relacao: '<=', casasLimite: 2 },
        }),
        temX && m.passo(`As${id}c_c${k}`, `A_{s,c,${s}}`, AsDe(Md, d, x), { casas: 3, unidade: 'cm²' }),
        m.passo(`As${id}n_c${k}`, `A_{s,n,${s}}`, temX ? max(m.g(`As${id}c_c${k}`, `A_{s,c,${s}}`, 3, 'cm²'), Asm) : null, {
          casas: 3, unidade: 'cm²', origem: 'calculado',
          verif: { chave: `murocima.cinta${kk}.As${id}`, rotulo: `${desc}: As,ef ≥ As,nec (${lat ? 'lateral' : 'gravidade'})`, limite: As, relacao: '<=' },
        }),
      ];
    };
    const flexao = secao(`${desc}: flexão nas duas direções`, [
      ...umaFlexao(true),
      ...umaFlexao(false),
      m.num(`apl_c${k}`) !== null && m.passo(`apl_c${k}`, 'U_{lat}', div(Mdl, m.g('MRdl_cmc', 'M_{Rd,lat}', 3, 'kN·m')), { casas: 3 }),
      m.num(`apg_c${k}`) !== null && m.passo(`apg_c${k}`, 'U_{grav}', div(Mdg, m.g('MRdg_cmc', 'M_{Rd,grav}', 3, 'kN·m')), { casas: 3 }),
      m.passo(`ap_c${k}`, 'U_{cin}', m.num(`ap_c${k}`) !== null ? soma(m.g(`apl_c${k}`, 'U_{lat}', 3), m.g(`apg_c${k}`, 'U_{grav}', 3)) : null, {
        casas: 3, origem: 'calculado', ref: CRITERIO,
        verif: { chave: `murocima.cinta${kk}.interacao`, rotulo: `${desc}: Md,lat/MRd,lat + Md,grav/MRd,grav ≤ 1`, limite: 1, relacao: '<=', casasLimite: 0 },
      }),
    ], NBR6118('17.2.2'));
    const cortante = secao(`${desc}: cortante`, [
      m.passo(`Vdl_c${k}`, 'V_{d,lat}', null, {
        casas: 3, unidade: 'kN', origem: 'calculado',
        verif: { chave: `murocima.cinta${kk}.Vlat`, rotulo: `${desc}: Vd ≤ VRd1 (lateral)`, limite: m.g('VR1l_cmc', 'V_{Rd1,lat}', 2, 'kN'), relacao: '<=' },
      }),
      m.passo(`Vdg_c${k}`, 'V_{d,grav}', null, {
        casas: 3, unidade: 'kN', origem: 'calculado',
        verif: { chave: `murocima.cinta${kk}.Vgrav`, rotulo: `${desc}: Vd ≤ VRd1 (gravidade)`, limite: m.g('VR1g_cmc', 'V_{Rd1,grav}', 2, 'kN'), relacao: '<=' },
      }),
    ], NBR6118('19.4.1'));
    const ra = m.g(`ra_c${k}`, 'r_{anc}', 3);
    const reta = m.texto(`anc_c${k}`) === 'Reta';
    const fydKN = div(fyd, DEZ);
    const ancora = secao(`${desc}: ancoragem no pilarete da ponta`, [
      m.passo(`ra_c${k}`, 'r_{anc}', min(um, soma(div(div(mul(cte(1.5, 1), Vdl), fydKN), Asl), div(div(mul(cte(1.5, 1), Vdg), fydKN), Asg))), { casas: 3, ref: NBR6118('18.3.2.4') }),
      m.passo(`lbr_c${k}`, '\\ell_{b,nec,r}', max(mul(lb, ra), lbm), {
        casas: 1, unidade: 'cm', ref: NBR6118('9.4.2.5'),
        ...(reta ? { verif: { chave: `murocima.cinta${kk}.ancoragem`, rotulo: `${desc}: ancoragem reta no pilarete da ponta`, limite: ldr, relacao: '<=' as const } } : {}),
      }),
      !reta && m.passo(`lbg_c${k}`, '\\ell_{b,nec,g}', max(mul(cte(0.7, 1), lb, ra), lbm), {
        casas: 1, unidade: 'cm', ref: NBR6118('9.4.2.5'),
        verif: { chave: `murocima.cinta${kk}.ancoragem`, rotulo: `${desc}: ancoragem com gancho no pilarete da ponta`, limite: ldg, relacao: '<=' },
      }),
      m.passo(`anc_c${k}`, '\\text{ancoragem}', null, { casas: 0, origem: 'adotado' }),
    ], NBR6118('18.3.2.4'));
    return [cargas, flexao, cortante, ancora];
  };

  const card: Card = {
    id: 'murocima.cintas',
    titulo: 'Cintas do muro de cima · concreto',
    ref: { fonte: 'NBR 6118' },
    secoes: aplica ? [dados, quantas, ...secoesMRdCintaMc(m), cortanteComum, ancoragemComum, ...porCinta('T'), ...porCinta('M')] : [],
    avisos: [],
    aplicavel: aplica,
  };
  const desenho = aplica ? desenhoDaCinta(r) : null;
  if (desenho) card.desenho = desenho;
  return card;
}

/** Muro de cima e vento: vento, muro de cima, pilarete, cintas do muro de cima e cinta do topo do arrimo. */
export const autorMuroDeCima: AutorDeCards = (r) => [cardVento(r), cardMuroDeCima(r), cardPilarete(r), cardCintasDoMuroDeCima(r), cardCintaDoTopo(r)];

