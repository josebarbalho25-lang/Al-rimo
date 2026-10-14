/*
  CARDS — Fundação — estabilidade: cargas, tombamento, deslizamento e tensões no solo (aba "Fundação", seções 1 a 6).
  O dimensionamento da sapata (flexão, cortante, torção — seções 7 e 8) é do grupo cards/sapata.ts.

  Roteiro de sapata corrida de muro (critério adotado), com as escolhas do Jose: sobrecarga
  sobre o talão estabiliza (seletor q_est), deslizamento só com atrito N·tg δ_b (+ adesão opcional = 0 + passivo
  opcional), tombamento com FS em torno do pé E |e| ≤ B/4 — vale o pior (são duas verificações; o resumo reprova se
  qualquer uma falhar, que é o "vale o pior" da planilha).

  Cada `if` aqui espelha um IF da planilha (Tipo_muro, pos_cf, q_est, Agua, pass_on, phi_base, sig_adm_dir,
  M_tb > 0, |e| ≤ B/6). Parcela que a planilha zera pelo IF não vira passo — a soma continua dando o número da
  célula, porque somar zero não muda nada.

  RÉGUA DA ABA FUNDAÇÃO (nome definido → símbolo · casas), combinada com cards/sapata.ts. O teste exige o mesmo
  símbolo e as mesmas casas para o mesmo nome em todos os cards:
    B_sap B · 2        h_sap h_s · 2          a_ater a · 2          gama_c \gamma_c · 1
    heel b_t · 3       toe b_p · 3            c_len B_c · 3         s_hi \sigma_{m\acute{a}x} · 1
    s_lo \sigma_{m\acute{\imath}n} · 1        Lm L_{mod} · 2        t_m t · 2             N_tot N_{tot} · 3
    e_f e · 3          s_med \sigma_{m\acute{e}d} · 1               s_adm \sigma_{adm} · 0
    tenr_adot (×0,01, m) t_{enr} · 2          eenr (×0,01, m) e_{enr} · 2             l_cf_adot \ell_{cf} · 2
  B, h_s, a, b_t, b_p, \gamma_c, B_c, σmáx e σmín são descritos em SIMBOLOS_SAPATA (um dono por símbolo: a mesma
  chave com dois textos reprova no simbolos.test).
*/
import type { Resultado } from '@/motor/tipos';
import type { AutorDeCards, Card, Expr, Passo, Ref } from '../tipos';
import { abs, cte, div, max, min, mul, neg, nome, pot, rad, soma, sub, tan } from '../expr';
import { memoriaDe, secao, type Memoria, type PedidoDeVerificacao } from '../passo';
import { nt } from '../formato';
import { passoDoGamaCf, passosDoPeso } from './pesoProprio';
import { desenhoDasDistanciasAoCentro, desenhoDasForcasQueEstabilizam, desenhoDasForcasQueTombam, desenhoDasTensoes } from '../desenhoDaSapata';

const ABA = 'Fundação';
const cel = (endereco: string) => `${ABA}!${endereco}`;

// o roteiro da fundação (parcelas de carga, sobrecarga que estabiliza, atrito na base, e ≤ B/4, σmáx ≤ σadm):
// convenção de projeto sem norma que a fixe
const CRITERIO: Ref = { fonte: 'Critério adotado' };
// FS 2,0 e 1,5 "pelo que sei, NBR 11682 — conferir" (nota das Entradas): a norma ainda não está na biblioteca
const NBR_11682: Ref = { fonte: 'NBR 11682' };
// Ka/Kp e o empuxo continuado até a base da sapata
const RANKINE: Ref = { fonte: 'Rankine' };
// σadm = 20·N_SPT kPa (0,02·N MPa), de 5 a 20 golpes
const CINTRA: Ref = { fonte: 'Cintra, Aoki e Albiero' };
// peso específico da alvenaria grauteada (14 kN/m³ + graute) → γ do contraforte estimado
const NBR_PESO: Ref = { fonte: 'NBR 16868-1', item: '8.3.1.1' };

const DOIS = cte(2, 0);
// passivo reduzido por no mínimo 2,0 e só com solo da frente garantido na vida útil (Jose, 10/10, decisão pelo Bastos)
const NBR_PASSIVO: Ref = { fonte: 'NBR 6122', item: '7.6.3' };

export const SIMBOLOS_ESTABILIDADE: Readonly<Record<string, string>> = {
  // ── rígida ou flexível (NBR 6118 22.6.1) ──
  'h_{r\\acute{\\imath}g}': 'altura mínima para a sapata ser rígida, (B − t)/3',
  // ── geometria (B, h_s, a, b_t, b_p: SIMBOLOS_SAPATA) ──
  'b_{den}': 'largura média do dente',
  'h_{den}': 'altura do dente',
  'L_{mod}': 'comprimento do módulo de cálculo (entre contrafortes ou 1 m)',
  '\\ell_{cf}': 'distância eixo a eixo entre contrafortes, adotada no módulo do bloco',
  't_{enr}': 'comprimento do contraforte adotado (inclui a parede)',
  'e_{enr}': 'espessura do contraforte',
  // ── cargas verticais (\gamma_c: SIMBOLOS_SAPATA) ──
  '\\gamma_{cf}': 'peso específico do contraforte grauteado',
  'P_{topo}': 'carga vertical permanente no topo do muro, por metro',
  'N_{muro}': 'peso próprio do muro no módulo',
  'N_{cf}': 'peso do contraforte grauteado',
  'N_{sap}': 'peso da sapata no módulo',
  'N_{den}': 'peso do dente no módulo',
  'x_{den}': 'posição do eixo do dente a partir do centro da sapata (+ para o pé)',
  'N_{solo}': 'peso do solo sobre o talão no módulo',
  N_q: 'sobrecarga sobre o talão no módulo',
  'N_{topo}': 'carga permanente do topo do muro no módulo',
  'N_{fr}': 'peso do aterro sobre a ponta no módulo',
  'h_{fr}': 'altura do aterro sobre a ponta, acima do topo da sapata',
  N_w: 'subpressão da água sob a sapata no módulo (negativa)',
  'N_{tot}': 'resultante vertical na base da sapata, no módulo',
  'x_{cf}': 'posição do centro do contraforte, medida da borda aterrada',
  // ── empuxo até a base da sapata ──
  '\\sigma_{h,s}': 'pressão horizontal total na base da sapata',
  H_k: 'empuxo horizontal até a base da sapata, no módulo',
  'M_{tomb}': 'momento de tombamento do empuxo em relação à base da sapata',
  // ── tombamento ──
  'M_{est}': 'momento estabilizante das cargas verticais em relação ao pé',
  'FS_{tomb}': 'fator de segurança ao tombamento',
  'FS_{tomb,m\\acute{\\imath}n}': 'fator de segurança mínimo ao tombamento',
  M_N: 'momento das cargas verticais em relação ao centro da base',
  'M_{cen}': 'momento total em relação ao centro da base (+ para o pé)',
  e: 'excentricidade da resultante na base (+ para o pé)',
  'e_{lim}': 'excentricidade limite da resultante na base (B/4)',
  // braços até o pé (13/10): a mesma legenda do desenho das forças que estabilizam
  'x_{p,muro}': 'braço do peso do muro até o pé',
  'x_{p,cf}': 'braço do peso do contraforte até o pé',
  'x_{p,sap}': 'braço do peso da sapata até o pé',
  'x_{p,solo}': 'braço do peso do solo sobre o talão até o pé',
  'x_{p,q}': 'braço da sobrecarga sobre o talão até o pé',
  'x_{p,topo}': 'braço da carga do topo do muro até o pé',
  'x_{p,w}': 'braço da subpressão até o pé',
  'x_{p,fr}': 'braço do aterro sobre a ponta até o pé',
  'x_{p,den}': 'braço do peso do dente até o pé',
  // distâncias ao centro da base (13/10), + do lado do pé
  'd_{c,muro}': 'distância do peso do muro ao centro da base (+ lado do pé)',
  'd_{c,cf}': 'distância do contraforte ao centro da base (+ lado do pé)',
  'd_{c,solo}': 'distância do solo sobre o talão ao centro da base (+ lado do pé)',
  'd_{c,q}': 'distância da sobrecarga ao centro da base (+ lado do pé)',
  'd_{c,topo}': 'distância da carga do topo ao centro da base (+ lado do pé)',
  'd_{c,fr}': 'distância do aterro sobre a ponta ao centro da base (+ lado do pé)',
  'd_{c,den}': 'distância do dente ao centro da base (+ lado do pé)',
  // ── deslizamento ──
  "\\varphi'_b": 'ângulo de atrito efetivo do solo de apoio',
  'k_{\\delta}': "relação δ_b/φ' adotada para o atrito na base",
  '\\delta_b': 'ângulo de atrito solo-base da sapata',
  'R_{at}': 'resistência ao deslizamento por atrito na base',
  c_a: 'adesão solo-base',
  'R_{ad}': 'resistência ao deslizamento por adesão na base',
  E_p: 'empuxo passivo na frente da sapata, no módulo',
  'FS_{desl}': 'fator de segurança ao deslizamento',
  'FS_{desl,m\\acute{\\imath}n}': 'fator de segurança mínimo ao deslizamento',
  // ── tensões no solo (B_c, σmáx, σmín: SIMBOLOS_SAPATA) ──
  'N_{SPT}': 'índice SPT do solo abaixo da sapata',
  '\\sigma_{adm}': 'tensão admissível do solo de apoio',
  '\\sigma_{m\\acute{e}d}': 'tensão média do solo na base da sapata',
};

/** As folhas que mais de um card lê — uma grafia só (régua do teste). */
function folhas(m: Memoria) {
  return {
    B: m.ent('B_sap', 'B'),
    hs: m.ent('h_sap', 'h_s'),
    xm: m.ent('a_ater', 'a'),
    bden: m.ent('b_den', 'b_{den}'),
    hden: m.ent('h_den', 'h_{den}'),
    xden: m.ent('x_den', 'x_{den}'),
    gc: m.ent('gama_c', '\\gamma_c'),
    // γ do contraforte e peso da parede: os USADOS (calculados ou digitados — cards/pesoProprio.ts)
    gcf: m.g('gama_cf_us', '\\gamma_{cf}', 2, 'kN/m³'),
    P: m.ent('P_topo', 'P_{topo}'),
    // peça pesa na altura do MURO (parede, contraforte); terra e água, na altura de SOLO
    hm: m.ent('H_muro', 'h_{muro}'),
    hso: m.ent('H_solo', 'h_{solo}'),
    q: m.ent('q_sobre', 'q'),
    gama: m.ent('gama_solo', '\\gamma'),
    gw: m.ent('gama_w', '\\gamma_w'),
    zna: m.ent('z_NA', 'z_{NA}'),
    gpar: m.g('peso_us', 'g_{par}', 2, 'kN/m²'),
    // (tenr − t)/100 da planilha escrito em metros: t_enr − t com as duas em m, como se confere à mão
    tb: m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' }),
    t: m.g('t_m', 't', 2, 'm'),
    L: m.g('Lm', 'L_{mod}', 2, 'm'),
    btal: m.g('heel', 'b_t', 3, 'm'),
    bpta: m.g('toe', 'b_p', 3, 'm'),
    tenr: m.g('tenr_adot', 't_{enr}', 2, 'm', { fator: 0.01 }),
    eenr: m.g('eenr', 'e_{enr}', 2, 'm', { fator: 0.01 }),
    N: m.g('N_tot', 'N_{tot}', 3, 'kN'),
    Ka: m.g('Ka_', 'K_a', 3),
    Kp: m.g('Kp_', 'K_p', 3),
    Vk: m.g('Vk_', 'V_k', 2, 'kN/m'),
    Mk: m.g('Mk_', 'M_k', 2, 'kN·m/m'),
    shBase: m.g('sh_base', '\\sigma_{h,base}', 2, 'kPa'),
    shSap: m.g('sh_b2', '\\sigma_{h,s}', 2, 'kPa'),
    Hk: m.g('H_k', 'H_k', 2, 'kN'),
    Mtb: m.g('M_tb', 'M_{tomb}', 2, 'kN·m'),
    Mest: m.g('M_est', 'M_{est}', 3, 'kN·m'),
    MN: m.g('M_vc', 'M_N', 3, 'kN·m'),
    Mcen: m.g('M_cen', 'M_{cen}', 3, 'kN·m'),
    e: m.g('e_f', 'e', 3, 'm'),
    elim: m.g('e_lim', 'e_{lim}', 3, 'm'),
    hfr: m.ent('h_fr', 'h_{fr}'),
    xcf: nome(cel('C17'), 'x_{cf}', 3, 'm'),
  };
}

type Folhas = ReturnType<typeof folhas>;

/*
  A TABELA DE PARCELAS da seção 2 da aba (uma linha por parcela: N, x, B − x, N·(B − x), x − B/2, N·(x − B/2)).
  `x` = braço medido da borda aterrada; null = B/2 (sapata e subpressão), que não dá momento em torno do centro.
  Só entra a parcela que a planilha não zera pelo IF — ver o comentário do topo.
*/
interface Parcela { linha: number; simbolo: string; x: Expr | null }

function parcelas(m: Memoria, f: Folhas): Parcela[] {
  const contrafortes = m.texto('Tipo_muro') === 'Contrafortes';
  const meioTalao = div(f.btal, DOIS);
  const lista: (Parcela | false)[] = [
    { linha: 16, simbolo: 'N_{muro}', x: f.xm },
    contrafortes && { linha: 17, simbolo: 'N_{cf}', x: f.xcf },
    { linha: 18, simbolo: 'N_{sap}', x: null },
    { linha: 19, simbolo: 'N_{solo}', x: meioTalao },
    m.texto('q_est') === 'Sim' && { linha: 20, simbolo: 'N_q', x: meioTalao },
    // P_topo·L sem IF na planilha: com P_topo = 0 a linha é zero e não acrescenta nada à conta
    (m.valor(cel('B21')) ?? 0) !== 0 && { linha: 21, simbolo: 'N_{topo}', x: f.xm },
    m.texto('Agua') === 'Sim' && { linha: 22, simbolo: 'N_w', x: null },
    // aterro sobre a ponta: só com a garantia do solo da frente; aterro zero dá linha zero e fica fora
    (m.valor(cel('B23')) ?? 0) !== 0 && { linha: 23, simbolo: 'N_{fr}', x: sub(f.B, div(f.bpta, DOIS)) },
    // dente na posição dele (13/10): x = B/2 + x_den, medido da borda aterrada; sem dente a linha é zero e fica fora
    (m.valor(cel('B24')) ?? 0) !== 0 && { linha: 24, simbolo: 'N_{den}', x: soma(div(f.B, DOIS), f.xden) },
  ];
  return lista.filter((p): p is Parcela => !!p);
}

const folhaDaParcela = (p: Parcela): Expr => nome(cel(`B${p.linha}`), p.simbolo, 3, 'kN');

/** Valor numérico presente (célula que a planilha não deixou em "—"). */
const temNumero = (m: Memoria, id: string) => m.valor(id) !== null;

// ───────────────────────────── 1 · cargas ─────────────────────────────

function cardCargas(r: Resultado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const contrafortes = m.texto('Tipo_muro') === 'Contrafortes';
  const enterrado = m.texto('pos_cf').startsWith('Ente');   // LEFT(pos_cf;4)="Ente"
  const agua = m.texto('Agua') === 'Sim';

  /*
    "Contraforte cabe na sapata?" (cf_cabe): enterrado exige talão ≥ tenr − t; aparente, ponta ≥ tenr − t, com a
    folga de 1 mm da planilha. A planilha não tem célula para (tenr − t)/100: o limite é refeito aqui com a MESMA
    conta (só para o sinal da desigualdade escrita) e o veredito continua sendo o da célula cf_cabe.
  */
  const tenrCm = m.num('tenr_adot') ?? 0;
  const tCm = m.num('t_bloco') ?? 0;
  const folgaCf = (tenrCm - tCm) / 100;
  const pedidoCf = (lado: 'talão' | 'ponta'): PedidoDeVerificacao => ({
    chave: 'fundacao.contraforte',
    rotulo: `Contraforte apoiado no ${lado}`,
    limite: folgaCf - 0.001,
    relacao: '>=',
    celula: cel('B12'),
  });
  const texCf = `t_{enr} - t = ${nt(tenrCm / 100, 2)} - ${nt(tCm / 100, 2)} = ${nt(folgaCf, 3)}\\,\\mathrm{m}`;
  const verifTalao = contrafortes && enterrado;
  const verifPonta = contrafortes && !enterrado;

  const meioT = div(f.t, DOIS);
  const talao = sub(f.xm, meioT);
  const ponta = sub(sub(f.B, f.xm), meioT);

  const geometria = secao('Geometria', [
    m.entrada('B_sap', 'B'),
    m.entrada('h_sap', 'h_s'),
    m.entrada('a_ater', 'a'),
    m.entrada('b_den', 'b_{den}'),
    m.entrada('h_den', 'h_{den}'),
    (m.num('b_den') ?? 0) > 0 && (m.num('h_den') ?? 0) > 0 && m.entrada('x_den', 'x_{den}'),
    contrafortes
      ? m.passo('Lm', 'L_{mod}', m.g('l_cf_adot', '\\ell_{cf}', 2, 'm'), { casas: 2, unidade: 'm' })
      : m.passo('Lm', 'L_{mod}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.passo('heel', 'b_t', [talao, max(cte(0, 0), talao)], {
      casas: 3, unidade: 'm',
      ...(verifTalao ? { verif: pedidoCf('talão'), limiteTex: texCf } : {}),
    }),
    m.passo('toe', 'b_p', [ponta, max(cte(0, 0), ponta)], {
      casas: 3, unidade: 'm',
      ...(verifPonta ? { verif: pedidoCf('ponta'), limiteTex: texCf } : {}),
    }),
  ]);

  // ── parcelas verticais (características, por módulo) ──
  const almaCf = sub(f.tenr, f.tb);       // trecho do contraforte além da parede: (tenr_adot − t_bloco)/100
  const exprParcela: Record<number, Expr> = {
    16: mul(f.gpar, f.hm, f.L),
    17: mul(f.gcf, f.eenr, almaCf, f.hm),
    18: mul(f.gc, f.B, f.hs, f.L),
    19: contrafortes && enterrado
      // o contraforte enterrado ocupa parte do talão: desconta o volume dele no peso do solo (só até onde há solo)
      ? sub(mul(f.gama, f.hso, f.btal, f.L), mul(f.gama, f.eenr, min(f.btal, almaCf), f.hso))
      : mul(f.gama, f.hso, f.btal, f.L),
    20: mul(f.q, f.btal, f.L),
    21: mul(f.P, f.L),
    22: neg(mul(f.gw, max(cte(0, 0), sub(soma(f.hso, f.hs), f.zna)), f.B, f.L)),
    23: contrafortes && !enterrado
      // o contraforte aparente ocupa parte da ponta: desconta o volume dele no aterro (espelho do talão)
      ? sub(mul(f.gama, f.hfr, f.bpta, f.L), mul(f.gama, f.eenr, min(f.bpta, almaCf), f.hfr))
      : mul(f.gama, f.hfr, f.bpta, f.L),
    24: mul(f.gc, f.bden, f.hden, f.L),
  };
  const ps = parcelas(m, f);
  const passosParcelas: Passo[] = [];
  for (const p of ps) {
    passosParcelas.push(m.passo(cel(`B${p.linha}`), p.simbolo, exprParcela[p.linha], {
      casas: 3, unidade: 'kN', ...(p.linha === 17 ? { ref: NBR_PESO } : {}),
    }));
    if (p.linha === 17) {
      const meiaAlma = div(almaCf, DOIS);
      passosParcelas.push(m.passo(cel('C17'), 'x_{cf}', enterrado
        ? sub(sub(f.xm, meioT), meiaAlma)
        : soma(f.xm, meioT, meiaAlma), { casas: 3, unidade: 'm' }));
    }
  }
  const peso = secao('Peso próprio', [
    ...passosDoPeso(m),
    ...(contrafortes ? passoDoGamaCf(m) : []),
  ]);
  const verticais = secao('Cargas verticais por módulo', [
    ...passosParcelas,
    m.passo('N_tot', 'N_{tot}', soma(...ps.map(folhaDaParcela)), { casas: 3, unidade: 'kN' }),
  ], CRITERIO);

  // ── empuxo continuado até a base da sapata ──
  // a água só entra no trecho da sapata se o NA estiver acima da base dela: AND(Agua="Sim"; H_solo + h_sap > z_NA)
  // (o NA é medido do topo do solo)
  const aguaNaSapata = agua && (m.num('H_solo') ?? 0) + (m.num('h_sap') ?? 0) > (m.num('z_NA') ?? 0);
  const empuxo = secao('Empuxo até a base da sapata', [
    m.passo('sh_b2', '\\sigma_{h,s}', aguaNaSapata
      ? soma(f.shBase, mul(f.hs, soma(mul(f.Ka, sub(f.gama, f.gw)), f.gw)))
      : soma(f.shBase, mul(f.hs, mul(f.Ka, f.gama))), { casas: 2, unidade: 'kPa' }),
    m.passo('H_k', 'H_k', mul(soma(f.Vk, mul(div(soma(f.shBase, f.shSap), DOIS), f.hs)), f.L), { casas: 2, unidade: 'kN' }),
  ], RANKINE);

  return {
    id: 'fundacao.cargas',
    titulo: 'Fundação · cargas',
    ref: CRITERIO,
    figura: 'Fig. 15',
    secoes: [geometria, peso, verticais, empuxo],
    avisos: [],
    aplicavel: true,
  };
}

// ───────────────────────────── 2 · tombamento ─────────────────────────────

function cardTombamento(r: Resultado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const ps = parcelas(m, f);
  const meioB = div(f.B, DOIS);


  const momentoPositivo = (m.num('M_tb') ?? 0) > 0;          // IF(M_tb>0; M_est/M_tb; 99)
  const fsMin = m.ent('FS_tomb', 'FS_{tomb,m\\acute{\\imath}n}');
  const verifFS: PedidoDeVerificacao = {
    chave: 'fundacao.tombamento', rotulo: 'Tombamento FS ≥ FS mín', limite: fsMin, relacao: '>=', celula: 'chk_fs_t',
  };

  /*
    BRAÇOS ATÉ O PÉ, escritos a partir do pé (Jose, 13/10: "no desenho você bate o olho e vê a distância; na fórmula a
    referência pega a distância da outra ponta, ou divide a sapata por dois"). A planilha mede x da borda aterrada e
    usa B − x (coluna D da tabela de cargas); o número é o mesmo, mas aqui cada braço sai da geometria vista do pé —
    ponta, meia parede, talão —, com o nome da legenda do desenho. M_est fica Σ N × x_p, termo a termo.
  */
  const enterrado = m.texto('pos_cf').startsWith('Ente');
  const meiaT = div(f.t, DOIS);
  const almaCf = sub(f.tenr, f.tb);
  const BRACO: Record<number, { sim: string; expr: Expr }> = {
    16: { sim: 'x_{p,muro}', expr: soma(f.bpta, meiaT) },
    17: { sim: 'x_{p,cf}', expr: enterrado ? soma(f.bpta, f.t, div(almaCf, DOIS)) : sub(f.bpta, div(almaCf, DOIS)) },
    18: { sim: 'x_{p,sap}', expr: meioB },
    19: { sim: 'x_{p,solo}', expr: soma(f.bpta, f.t, div(f.btal, DOIS)) },
    20: { sim: 'x_{p,q}', expr: soma(f.bpta, f.t, div(f.btal, DOIS)) },
    21: { sim: 'x_{p,topo}', expr: soma(f.bpta, meiaT) },
    22: { sim: 'x_{p,w}', expr: meioB },
    23: { sim: 'x_{p,fr}', expr: div(f.bpta, DOIS) },
    24: { sim: 'x_{p,den}', expr: sub(meioB, f.xden) },
  };
  // Muro todo sobre a sapata (ponta e talão sem o MAX(0; …) da planilha agindo): a geometria vista do pé vale. Muro
  // saindo da sapata (a verificação "Muro apoiado na sapata" reprova): ponta ou talão cortados a zero e a soma
  // ponta + t + … deixa de ser a distância — aí fica a forma da planilha, B − x.
  const Bv = m.num('B_sap') ?? 0, av = m.num('a_ater') ?? 0, tv = m.num('t_m') ?? 0;
  const sobreASapata = av - tv / 2 >= 0 && Bv - av - tv / 2 >= 0;
  const bracos = ps.map((p) => m.passo(cel(`D${p.linha}`), BRACO[p.linha].sim,
    sobreASapata ? BRACO[p.linha].expr : p.x ? sub(f.B, p.x) : meioB, { casas: 3, unidade: 'm' }));
  const mEstPorBraco = soma(...ps.map((p) => mul(folhaDaParcela(p), nome(cel(`D${p.linha}`), BRACO[p.linha].sim, 3, 'm'))));
  const secBracos = secao('Braços até o pé', bracos);

  // Duas seções, cada uma com o seu desenho (Jose, 13/10: "duas figuras separadas, uma para as forças que tombam e
  // outra para as que estabilizam"): o momento das cargas verticais em torno do pé, e depois o do empuxo e o FS.
  const estab = secao('Momento estabilizante em torno do pé', [
    m.passo('M_est', 'M_{est}', mEstPorBraco, { casas: 3, unidade: 'kN·m' }),
  ]);
  const desEstab = desenhoDasForcasQueEstabilizam(r);
  if (desEstab) secBracos.desenho = desEstab;
  const fs = secao('Momento de tombamento e fator de segurança', [
    m.passo('M_tb', 'M_{tomb}', mul(
      soma(f.Mk, mul(f.Vk, f.hs), div(mul(pot(f.hs, 2), soma(mul(DOIS, f.shBase), f.shSap)), cte(6, 0))),
      f.L,
    ), { casas: 2, unidade: 'kN·m' }),
    momentoPositivo
      ? m.passo('FS_t', 'FS_{tomb}', div(f.Mest, f.Mtb), { casas: 2, ref: NBR_11682, verif: verifFS })
      // sem momento de tombamento a planilha publica 99 (convenção: nada tomba)
      : m.passo('FS_t', 'FS_{tomb}', null, { casas: 2, origem: 'adotado', ref: NBR_11682, verif: verifFS }),
  ], NBR_11682);

  /*
    |e| ≤ B/4 nos dois lados. A Verificacao compara uma grandeza com UM limite: com e ≥ 0 o limite é a célula
    e_lim (= B/4); com e < 0 a conta é e ≥ −e_lim, e o −e_lim é o da célula com o sinal trocado (a planilha não
    tem célula para ele). O veredito é o da célula da planilha (B99).
  */
  const eNum = m.valor('e_f');
  const elimNum = m.valor('e_lim') ?? 0;
  const verifE: PedidoDeVerificacao = eNum !== null && eNum < 0
    ? { chave: 'fundacao.excentricidade', rotulo: 'Tombamento |e| ≤ B/4', limite: -elimNum, relacao: '>=', celula: 'chk_e_t' }
    : { chave: 'fundacao.excentricidade', rotulo: 'Tombamento |e| ≤ B/4', limite: f.elim, relacao: '<=', celula: 'chk_e_t' };
  const texE = eNum !== null && eNum < 0 ? `-e_{lim} = ${nt(-elimNum, 3)}\\,\\mathrm{m}` : undefined;
  const passoE = eNum !== null && m.passo('e_f', 'e', div(f.Mcen, f.N), {
    casas: 3, unidade: 'm', verif: verifE, ...(texE ? { limiteTex: texE } : {}),
  });
  // e ≥ −e_lim com os dois negativos: o "% de uso" do passo.ts (limite/valor) sairia invertido (43% num e que
  // passa do limite). O uso é |e|/e_lim, as mesmas duas células.
  if (passoE && passoE.verif && eNum !== null && eNum < 0) {
    passoE.verif.util = elimNum !== 0 ? (100 * Math.abs(eNum)) / elimNum : null;
  }

  const desTomb = desenhoDasForcasQueTombam(r);
  if (desTomb) fs.desenho = desTomb;

  /*
    DISTÂNCIAS AO CENTRO (13/10, a mesma ideia dos braços): o centro está a B/2 do pé, a carga a x_p do pé, então a
    distância entre os dois é B/2 − x_p — positiva do lado do pé, negativa do lado do talão (a convenção do e). A
    planilha guarda x − B/2 (coluna F), o mesmo número. Carga no centro (sapata, subpressão, dente no meio) não entra.
  */
  const DIST: Record<number, string> = {
    16: 'd_{c,muro}', 17: 'd_{c,cf}', 19: 'd_{c,solo}', 20: 'd_{c,q}', 21: 'd_{c,topo}', 23: 'd_{c,fr}', 24: 'd_{c,den}',
  };
  const foraDoCentro = ps.filter((p) => DIST[p.linha] && Math.abs(m.valor(cel(`F${p.linha}`)) ?? 0) > 1e-12);
  const distancias = foraDoCentro.map((p) => m.passo(cel(`F${p.linha}`), DIST[p.linha],
    sobreASapata ? sub(meioB, nome(cel(`D${p.linha}`), BRACO[p.linha].sim, 3, 'm')) : sub(p.x as Expr, meioB),
    { casas: 3, unidade: 'm' }));
  const mN = foraDoCentro.length
    ? soma(...foraDoCentro.map((p) => mul(folhaDaParcela(p), nome(cel(`F${p.linha}`), DIST[p.linha], 3, 'm'))))
    : null;
  const secDist = secao('Distâncias ao centro (+ do lado do pé)', distancias);
  const desCentro = desenhoDasDistanciasAoCentro(r);
  if (desCentro) secDist.desenho = desCentro;

  const exc = secao('Excentricidade da resultante', [
    mN && m.passo('M_vc', 'M_N', mN, { casas: 3, unidade: 'kN·m' }),
    m.passo('M_cen', 'M_{cen}', soma(f.Mtb, f.MN), { casas: 3, unidade: 'kN·m' }),
    eNum !== null && m.passo('e_lim', 'e_{lim}', div(f.B, cte(4, 0)), { casas: 3, unidade: 'm' }),
    passoE,
  ], CRITERIO);

  return {
    id: 'fundacao.tombamento',
    titulo: 'Fundação · tombamento',
    ref: NBR_11682,
    secoes: [secBracos, estab, fs, ...(distancias.length ? [secDist] : []), exc],
    avisos: [],
    aplicavel: true,
  };
}

// ───────────────────────────── 3 · deslizamento ─────────────────────────────

function cardDeslizamento(r: Resultado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const temPhiB = m.num('phi_b') !== null;                 // IF(ISNUMBER(phi_base); phi_base; "—") — obrigatório (14/10)
  const comAdesao = (m.num('ades_b') ?? 0) !== 0;          // adesão opcional, 0 por padrão (escolha do Jose)
  const frenteGarantida = m.texto('pass_on') === 'Sim';
  // sem a garantia, o dente do centro para trás (x_den ≤ 0) mobiliza o passivo dele (Jose, 13/10: "para escavar até
  // a metade da sapata o cara tem que ser um tatu") — a planilha publica E_p > 0 só nesses dois casos
  const comPassivo = (m.num('E_p') ?? 0) > 0;

  const phib = m.g('phi_b', "\\varphi'_b", 1, '°');
  const delb = m.g('del_b', '\\delta_b', 1, '°');
  const Rat = m.g('R_at', 'R_{at}', 2, 'kN');
  const Rad = m.g('R_ad', 'R_{ad}', 2, 'kN');
  const Ep = m.g('E_p', 'E_p', 2, 'kN');
  const Kpb = m.g('Kp_b', 'K_{p,b}', 3);
  const tgDelta = tan(rad(delb));

  const resistencias = secao('Resistências na base', [
    temPhiB && m.passo('phi_b', "\\varphi'_b", null, { casas: 1, unidade: '°', origem: 'entrada' }),
    temPhiB && m.passo('del_b', '\\delta_b', mul(m.ent('dphi', 'k_{\\delta}'), phib), { casas: 1, unidade: '°' }),
    // N ≤ 0 (subpressão maior que o peso): a planilha zera o atrito com MAX(0; N)
    temPhiB && m.passo('R_at', 'R_{at}', [mul(f.N, tgDelta), mul(max(cte(0, 0), f.N), tgDelta)], { casas: 2, unidade: 'kN' }),
    comAdesao && m.passo('R_ad', 'R_{ad}', mul(m.ent('ades_b', 'c_a'), f.B, f.L), { casas: 2, unidade: 'kN' }),
    // Kp do solo de apoio (Jose, 14/10): o dente está cravado no solo natural sob a sapata
    comPassivo && temNumero(m, 'Kp_b') && m.passo('Kp_b', 'K_{p,b}', pot(tan(rad(soma(cte(45, 0), div(phib, DOIS)))), 2), { casas: 3, ref: RANKINE }),
    comPassivo && m.passo('E_p', 'E_p', mul(div(div(mul(Kpb, f.gama, pot(frenteGarantida ? soma(f.hfr, f.hs, f.hden) : f.hden, 2)), DOIS), DOIS), f.L), {
      casas: 2, unidade: 'kN', ref: NBR_PASSIVO,
    }),
  ], CRITERIO);

  // (R_at + R_ad + E_p)/H_k: parcela zerada pelo seletor fica fora (somar zero não muda o número)
  const resistentes = [Rat, ...(comAdesao ? [Rad] : []), ...(comPassivo ? [Ep] : [])];
  // H_k = 0 (nada empurra): a planilha publica "—" e não há o que verificar
  const fs = temNumero(m, 'FS_d') && secao('Fator de segurança', [
    m.passo('FS_d', 'FS_{desl}', div(soma(...resistentes), f.Hk), {
      casas: 2,
      ref: NBR_11682,
      verif: {
        chave: 'fundacao.deslizamento', rotulo: 'Deslizamento FS ≥ FS mín',
        limite: m.ent('FS_desl', 'FS_{desl,m\\acute{\\imath}n}'), relacao: '>=', celula: 'chk_fs_d',
      },
    }),
  ], NBR_11682);

  return {
    id: 'fundacao.deslizamento',
    titulo: 'Fundação · deslizamento',
    ref: NBR_11682,
    figura: 'Fig. 24',
    secoes: fs ? [resistencias, fs] : [resistencias],
    avisos: temPhiB ? [] : ["Digitar o φ' do solo de apoio (sondagem)"],
    aplicavel: true,
  };
}

// ───────────────────────────── 4 · tensões no solo ─────────────────────────────

function cardTensoes(r: Resultado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const sigAdmDigitado = m.num('sig_adm_dir') !== null;    // ISNUMBER(sig_adm_dir)

  const sAdm = m.g('s_adm', '\\sigma_{adm}', 0, 'kPa');
  const sMed = m.g('s_med', '\\sigma_{m\\acute{e}d}', 1, 'kPa');
  const Bc = m.g('c_len', 'B_c', 3, 'm');

  // σadm sem número: SPT < 5 e nada digitado — a regra não vale em solo mole (planilha: "—", e a tensão reprova)
  const temAdm = temNumero(m, 's_adm');
  const admissivel = secao('Tensão admissível', [
    !temAdm ? null
      : sigAdmDigitado
        ? m.passo('s_adm', '\\sigma_{adm}', null, { casas: 0, unidade: 'kPa', origem: 'entrada' })
        // regra prática 2·SPT tf/m² = 20·SPT kPa (Cintra, Aoki e Albiero), só dentro da faixa: SPT acima de 20 conta 20
        // (Jose, 14/10) — IF(SPT_b>=5; 20·MIN(SPT_b;20); "—")
        : m.passo('s_adm', '\\sigma_{adm}', mul(cte(20, 0), min(m.ent('SPT_b', 'N_{SPT}'), cte(20, 0))), { casas: 0, unidade: 'kPa', ref: CINTRA }),
  ]);

  const secoes = admissivel.passos.length ? [admissivel] : [];
  const avisos: string[] = [];
  if (!temAdm) avisos.push('SPT < 5: digitar o σadm (ensaio)');
  const e = m.num('e_f');
  const B = m.num('B_sap') ?? 0;
  if (e !== null && temNumero(m, 's_med') && temNumero(m, 's_hi')) {
    const trapezio = Math.abs(e) <= B / 6;                 // IF(ABS(e_f) <= B_sap/6; trapézio; triângulo)
    if (Math.abs(e) >= B / 2) avisos.push('Resultante fora da base');
    const verifSigma: PedidoDeVerificacao | undefined = temAdm ? {
      chave: 'fundacao.tensao', rotulo: 'σmáx ≤ σadm', limite: sAdm, relacao: '<=', celula: 'chk_sig',
    } : undefined;
    const seisEB = div(mul(cte(6, 0), abs(f.e)), f.B);
    const diagrama = secao(trapezio ? 'Diagrama trapezoidal (|e| ≤ B/6)' : 'Diagrama triangular (|e| > B/6)', [
      m.passo('s_med', '\\sigma_{m\\acute{e}d}', div(f.N, mul(f.B, f.L)), { casas: 1, unidade: 'kPa' }),
      !trapezio && m.passo('c_len', 'B_c', mul(cte(3, 0), sub(div(f.B, DOIS), abs(f.e))), { casas: 3, unidade: 'm' }),
      m.passo('s_hi', '\\sigma_{m\\acute{a}x}', trapezio
        ? mul(sMed, soma(cte(1, 0), seisEB))
        : div(mul(DOIS, f.N), mul(Bc, f.L)), { casas: 1, unidade: 'kPa', verif: verifSigma }),
      trapezio
        ? m.passo('s_lo', '\\sigma_{m\\acute{\\imath}n}', mul(sMed, sub(cte(1, 0), seisEB)), { casas: 1, unidade: 'kPa' })
        // triângulo: parte da base descola (informativo na planilha, não reprova)
        : m.passo('s_lo', '\\sigma_{m\\acute{\\imath}n}', null, { casas: 1, unidade: 'kPa', origem: 'calculado' }),
    ]);
    const desTensoes = desenhoDasTensoes(r);
    if (desTensoes) diagrama.desenho = desTensoes;
    secoes.push(diagrama);
  }

  return {
    id: 'fundacao.tensoes',
    titulo: 'Fundação · tensões no solo',
    ref: CRITERIO,
    secoes,
    avisos,
    aplicavel: true,
  };
}

/** Estabilidade da sapata corrida (os dois tipos de muro): cargas, tombamento, deslizamento e tensões no solo. */
// ───────────────────────────── 0 · rígida ou flexível ─────────────────────────────

/*
  A PRIMEIRA CONTA da sapata (Jose, 14/10: "antes de calcular a sapata essa vai ser a primeira conta"). NBR 6118
  22.6.1, h ≥ (a − ap)/3; na sapata corrida a = B e ap = espessura do muro (Bastos, Sapatas de Fundação, 1.7). Toda a
  conta seguinte supõe sapata rígida (pressão linear): flexível não é calculada — reprova e manda reavaliar as
  condições de contorno (Jose: "a planilha não vai fazer sapata flexível, vai verificar").
*/
function cardRigidez(r: Resultado): Card {
  const m = memoriaDe(r);
  const f = folhas(m);
  const temConta = temNumero(m, 'h_rig');
  const hRig = m.g('h_rig', 'h_{r\\acute{\\imath}g}', 3, 'm');
  const sec = secao('Sapata corrida: a = B e ap = t', [
    temConta && m.passo('h_rig', 'h_{r\\acute{\\imath}g}', div(sub(f.B, f.t), cte(3, 0)), { casas: 3, unidade: 'm' }),
    temConta && m.passo('h_sap', 'h_s', null, {
      casas: 2, unidade: 'm', origem: 'entrada',
      verif: { chave: 'fundacao.rigidez', rotulo: 'Sapata rígida: h ≥ (B − t)/3', limite: hRig, relacao: '>=', celula: 'chk_rig' },
    }),
  ], { fonte: 'NBR 6118', item: '22.6.1' });
  return {
    id: 'fundacao.rigidez',
    titulo: 'Fundação · sapata rígida',
    ref: { fonte: 'NBR 6118', item: '22.6.1' },
    avisos: [],
    secoes: sec.passos.length ? [sec] : [],
    aplicavel: temConta,
  };
}

export const autorEstabilidade: AutorDeCards = (r) => [cardRigidez(r), cardCargas(r), cardTombamento(r), cardDeslizamento(r), cardTensoes(r)];
