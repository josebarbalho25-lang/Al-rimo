/*
  CARDS — CONTRAFORTE (aba "Contrafortes", seções 1 a 7 e as verificações da seção 15 que são do contraforte).
  O painel entre contrafortes (seção 8 em diante) é de ./painelCf.ts.

  Cinco cards, na ordem da aba: esforços (largura de influência), esbeltez (δ da Tab. 8, te, λ), flexão (seção T
  ou retangular, As, nº de barras, As,máx no furo), cisalhamento (Va, VRd2, estribos) e ELS (Branson, heq, δ∞).

  Cada `if` espelha um IF da planilha: intermediário × extremidade (tipo_cf); enterrado = seção T com fpk do bloco
  vazado × aparente = retangular com fpk* (cf_T); bloco de compressão dentro da mesa × entrando na alma (cf_TT);
  Vd ≤ Va (dispensa estribo pela conta); Ma ≤ Mr (não fissura). A memória escolhe a conta; o número é da célula.

  UNIDADES: a conta da seção é escrita como a conta de mão do contraforte: cm, kN, kN·cm e
  kN/cm². Onde a planilha guarda em outra unidade (Md em kN·m, fd em MPa) a FOLHA converte na leitura (`fator`),
  e a linha sai "4921,3/(0,5 × 86,7 × 52,0² × 0,210)" em vez de "49,21 × 100/(… × 2,100/10)". Onde a conversão é
  da própria fórmula (√fpk em MPa no VRd2, τ em MPa) o fator 10 fica escrito, como na conta de mão.

  Este grupo usa a aba inteira mesmo quando o muro é em balanço (a planilha calcula as duas coisas sempre): os cards
  saem com aplicavel = false e o teste confere a conta deles também — cobertura nos 61 cenários, não só nos de
  contraforte.
*/
import dados from '@/motor/planilha.gerada.json';
import type { PlanilhaExportada } from '@/motor/tipos';
import type { AutorDeCards, Card, Expr, Passo, Ref } from '../tipos';
import { arredCima, avaliar, cbrt, celulasDoIntervalo, cte, div, inteiro, max, min, mul, neg, par, pi, pot, raiz, soma, sub } from '../expr';
import { lerValor, memoriaDe, secao, type Memoria, type OpcoesDoPasso, type PedidoDeVerificacao } from '../passo';
import { casasDaEntrada } from '../metaDaPlanilha';
import { passoDaSomaDaFlecha } from './painelEls';
import { desenhoDaSecaoDoContraforte } from '../desenhoDaSecaoCf';
import { desenhoDasForcasNoContraforte } from '../desenhoDaSecaoI';

/*
  Grafias que outro grupo já descreve (uma letra, um significado no glossário): ℓcf, tenr, eenr em
  SIMBOLOS_ESTABILIDADE; fpk, fpk*, γm, γs, fyk em SIMBOLOS_BALANCO; n_adm em SIMBOLOS_PAINELELS. Aqui só o que é
  do contraforte e as cinco do ELS que o grupo do painel/ELS repete com o mesmo texto (combinado com ele).
*/
export const SIMBOLOS_CONTRAFORTE: Readonly<Record<string, string>> = {
  // ── geometria e esforços ──
  'b_{al}': 'balanço do muro além do contraforte de extremidade',
  'b_{inf}': 'largura de influência do contraforte',
  'q_{cf}': 'carga horizontal na base do contraforte',
  'M_{k,cf}': 'momento característico na base do contraforte',
  'V_{k,cf}': 'força cortante característica na base do contraforte',
  'M_{d,cf}': 'momento de cálculo na base do contraforte',
  'V_{d,cf}': 'força cortante de cálculo na base do contraforte',
  // ── esbeltez (NBR 16868-1, Tab. 8) ──
  '\\ell_{cf}/e_{enr}': 'relação ℓenr/eenr da NBR (linha da tabela de δ)',
  't_{enr}/t': 'relação tenr/t (coluna da tabela de δ)',
  't_{\\delta,x}': 'fração da interpolação de δ entre linhas da tabela',
  't_{\\delta,y}': 'fração da interpolação de δ entre colunas da tabela',
  '\\delta': 'coeficiente de espessura efetiva da parede com enrijecedores',
  't_e': 'espessura efetiva da parede com enrijecedores (só para a esbeltez)',
  // ── seção e materiais ──
  'h_{cf}': 'altura da seção do contraforte (= tenr)',
  'b_{w,cf}': 'largura da alma do contraforte (= eenr)',
  'c_{cf}': 'distância da face tracionada ao eixo das barras (enterrado: da ponta)',
  'c_{mont}': 'c medido no template do Revit: centro do furo comum às fiadas P e I',
  'd_{cf}': 'altura útil do contraforte',
  '0{,}5\\,d_{cf}': 'limite da espessura da mesa: metade da altura útil',
  'b_{f,1}': 'aba colaborante do lado do vão',
  'b_{f,2}': 'aba colaborante do outro lado do contraforte',
  'b_{m,cf}': 'largura colaborante da mesa do contraforte',
  'h_{f,cf}': 'espessura da mesa da seção T (= espessura do muro)',
  'f_{pk,cf}': 'fpk usado na flexão do contraforte',
  'K_{cf}': 'coeficiente da resistência à compressão na flexão do contraforte',
  'K\\,f_{d,cf}': 'resistência de cálculo à compressão na flexão do contraforte',
  'f_{sd,cf}': 'tensão de cálculo na armadura do contraforte',
  // ── flexão ──
  'k_{md,cf}': 'momento reduzido Md/(0,5·bm·d²·K·fd) do contraforte',
  'x_{r,cf}': 'linha neutra da seção retangular bm × d (bloco dentro da mesa)',
  'C_{f,cf}': 'força nas abas da mesa: fd·(bm − bw)·hf',
  'x_{w,cf}': 'linha neutra na alma, com a mesa inteira comprimida',
  '(x/d)_{cf}': 'posição relativa da linha neutra do contraforte',
  'z_{cf}': 'braço de alavanca do contraforte',
  'A_{s,cf}': 'armadura de flexão necessária do contraforte',
  'A_{s,m\\acute{\\imath}n,cf}': 'armadura mínima de flexão do contraforte',
  'A_{s,calc,cf}': 'armadura de cálculo do contraforte',
  '\\phi_{cf}': 'diâmetro da barra principal do contraforte',
  'A_{\\phi,cf}': 'área de uma barra principal do contraforte',
  'n_{b,cf}': 'número de barras principais do contraforte',
  'A_{s,ef,cf}': 'armadura efetiva do contraforte',
  'p_{m\\acute{a}x}': 'fração máxima de aço sobre a área de graute do furo',
  A_g: 'área de graute de um furo',
  'A_{s,m\\acute{a}x,cf}': 'armadura máxima no furo da ponta do contraforte',
  'n_{tr}': 'fator de traspasse no furo (2 barras na região de traspasse)',
  'A_{s,furo,cf}': 'armadura no furo da ponta, contando o traspasse',
  'A_{furo,cf}': 'área do furo comum às fiadas P e I, onde a barra passa reta',
  'n_{cabe,cf}': 'barras do Ø adotado que cabem no furo comum (graute de 15 mm)',
  'n_{8\\%,cf}': 'barras do Ø adotado pela taxa de 8% do furo comum, com traspasse',
  // ── cisalhamento ──
  '\\rho_{cf}': 'taxa de armadura longitudinal do contraforte',
  'f_{vk,cf}': 'resistência característica ao cisalhamento do contraforte',
  'f_{vd,cf}': 'resistência de cálculo ao cisalhamento do contraforte',
  '\\tau_{vd,cf}': 'tensão de cisalhamento de cálculo no contraforte',
  'V_{a,cf}': 'cortante resistida pela alvenaria, sem estribo',
  'V_{Rd2,cf}': 'cortante resistente das bielas comprimidas',
  'f_{ywd}': 'tensão de cálculo do estribo',
  'f_{gk}': 'resistência característica do graute',
  '(A_{sw}/s)_{nec}': 'estribo necessário por metro',
  '\\rho_{w,cf}': 'taxa mínima de estribo: 0,07% (fgk 15) a 0,14% (fgk 40)',
  '(A_{sw}/s)_{m\\acute{\\imath}n}': 'estribo mínimo por metro',
  '(A_{sw}/s)_{calc}': 'estribo de cálculo por metro',
  '\\phi_{est}': 'diâmetro do estribo do contraforte',
  'n_{ram}': 'número de ramos do estribo',
  's_{est}': 'espaçamento dos estribos',
  '\\phi_{est,nec}': 'diâmetro de estribo necessário com os ramos e o s adotados',
  '(A_{sw}/s)_{ef}': 'estribo efetivo por metro',
  'V_{Rd3,cf}': 'cortante resistente com os estribos adotados',
  'n_{est}': 'número de estribos na altura do muro',
  // ── ELS (n_adm: SIMBOLOS_PAINELELS; as cinco abaixo o ELS do balanço repete, com o mesmo texto) ──
  k_E: 'relação Em/fpk (800, bloco de concreto)',
  'f_{tk,\\perp}': 'resistência à tração na flexão, normal à fiada',
  '\\psi_{ELS}': 'relação Ma/Mk da combinação de serviço',
  'S_{\\delta}': 'soma da flecha no topo do muro (× Em·I), por metro',
  '\\Delta\\xi': 'coeficiente de fluência',
  'E_{m,cf}': 'módulo de deformação da alvenaria do contraforte',
  'n_{cf}': 'razão entre os módulos do aço e da alvenaria (Es/Em)',
  'A_{b,cf}': 'área bruta da seção do contraforte',
  'y_{G,cf}': 'centro de gravidade da seção bruta, medido da face comprimida',
  'I_{g,cf}': 'momento de inércia da seção bruta do contraforte',
  'M_{r,cf}': 'momento de fissuração do contraforte',
  'M_{a,cf}': 'momento de serviço na base do contraforte',
  'b_{II,cf}': 'largura comprimida no estádio II',
  'B_{II,cf}': 'coeficiente B da linha neutra no estádio II: n·As',
  'C_{II,cf}': 'coeficiente C da linha neutra no estádio II: n·As·d',
  'B_{IIw,cf}': 'coeficiente B da linha neutra com a LN na alma da seção T',
  'C_{IIw,cf}': 'coeficiente C da linha neutra com a LN na alma da seção T',
  'x_{II,cf}': 'linha neutra no estádio II (na mesa ou na seção retangular)',
  'x_{IIw,cf}': 'linha neutra no estádio II, na alma da seção T',
  'I_{alv,cf}': 'inércia da alvenaria comprimida (b × x) no estádio II',
  'I_{abas,cf}': 'inércia das abas da mesa comprimida (LN na alma) no estádio II',
  'I_{s,cf}': 'inércia da armadura tracionada homogeneizada (n·As) no estádio II',
  'I_{II,cf}': 'momento de inércia da seção fissurada (estádio II)',
  'I_{eq,cf}': 'momento de inércia equivalente (Branson)',
  'h_{eq,cf}': 'altura do retângulo de largura b com a inércia Ieq do contraforte',
  '\\delta_{0,cf}': 'flecha imediata no topo do contraforte',
  '\\delta_{\\infty,cf}': 'flecha final no topo do contraforte',
  '\\delta_{adm,cf}': 'flecha admissível do contraforte',
};

const ABA = 'Contrafortes';
const P = dados as unknown as PlanilhaExportada;

// convenção de projeto sem outra fonte: largura de influência, fpk vazado (T) × cheio (retangular), δadm = 2L/250
const CRITERIO: Ref = { fonte: 'Critério adotado' };
const NBR = (item: string): Ref => ({ fonte: 'NBR 16868-1', item });
const ABCP_34: Ref = { fonte: 'ABCP', item: '3.4' };
/** A montagem atual nos templates do Revit do Jose: "14×39 · contraforte de 54". */
const revit = (m: Memoria): Ref => ({ fonte: 'Template do Revit', item: `${m.num('t_bloco') ?? '—'}×39 · contraforte de ${m.num('tenr_adot') ?? '—'}` });

/** LEFT(texto;n)="X" do Excel: compara o começo, sem diferenciar maiúscula. */
const comeca = (texto: string, prefixo: string) => texto.slice(0, prefixo.length).toLowerCase() === prefixo.toLowerCase();

/*
  As células de veredito da seção 15 ('OK' / 'NÃO OK') são achadas pelo RÓTULO da coluna A no export, não por
  endereço fixo: linha inserida no gerador não desloca o veredito para a célula errada. Rótulo trocado lança —
  o card vira "Memória indisponível" e o teste acusa.
*/
const ROTULOS_DO_VEREDITO = {
  esbeltez: 'Esbeltez λ ≤ 30 (armada)',
  mesa: 'hf ≤ 0,5d (largura colaborante)',
  resiste: 'Contraforte: seção resiste',
  ductil: 'Contraforte: ductilidade x/d ≤ 0,45',
  As: 'Contraforte: As,ef ≥ As de cálculo',
  Asmax: 'Contraforte: As ≤ As,máx do furo',
  bielas: 'Contraforte: bielas Vd ≤ Vrd2',
  estribos: 'Contraforte: estribos',
  junta: 'Estribo cabe na junta (Ø ≤ 6,3 mm)',
  els: 'Contraforte: ELS δ∞ ≤ δadm',
} as const;
type Veredito = keyof typeof ROTULOS_DO_VEREDITO;

let cacheVeredito: Record<Veredito, string> | null = null;
function veredito(qual: Veredito): string {
  if (!cacheVeredito) {
    const achado = {} as Record<Veredito, string>;
    for (const [k, rotulo] of Object.entries(ROTULOS_DO_VEREDITO) as [Veredito, string][]) {
      let l = 1;
      while (l <= 1000 && P.celulas[`${ABA}!A${l}`] !== rotulo) l++;
      if (l > 1000) throw new Error(`veredito "${rotulo}" não está na aba ${ABA}`);
      achado[k] = `${ABA}!B${l}`;
    }
    cacheVeredito = achado;
  }
  return cacheVeredito[qual];
}

/*
  Pedido de verificação preso à célula de veredito da planilha. Veredito "—" ("— (retangular)", campo apagado que
  deixou a conta sem número) = a linha não verifica nada: sem isso o chip diria "NÃO PASSA", porque o verificacao()
  só aceita texto começando com "OK".
*/
function verifica(m: Memoria, qual: Veredito, p: Omit<PedidoDeVerificacao, 'celula'>): PedidoDeVerificacao | undefined {
  const celula = veredito(qual);
  const v = m.r.cel(celula);
  const temVeredito = typeof v === 'string' && v.trim() !== '' && !v.trim().startsWith('—');
  return temVeredito ? { ...p, celula } : undefined;
}

/*
  Tabela de δ (NBR 16868-1, Tab. 8) lida do export pelos nomes delta_le / delta_tab — os mesmos números que a
  planilha interpola, para a linha "δ = 1,4 + (1,2 − 1,4)·tx" não depender de uma cópia da tabela aqui.
*/
function tabelaDelta() {
  const num = (c: string) => Number(P.celulas[c]);
  const le = celulasDoIntervalo(P.nomes.delta_le).map(num);
  const tab = celulasDoIntervalo(P.nomes.delta_tab).map(num);
  const ncol = tab.length / le.length;
  return { le, valor: (i: number, j: number) => tab[(i - 1) * ncol + (j - 1)] };
}

/*
  Passo protegido para os cenários degenerados (campo apagado, seção que não resiste): célula com "—", vazia ou
  erro NÃO entra no card; texto ("não resiste") entra sem conta; número entra com a conta só se a conta tem
  número em todas as folhas (o IFERROR da planilha devolve "—" no meio da cadeia, e o MÁXIMO do Excel ignora texto
  de célula — a conta escrita daria NaN onde a planilha deu número). Fora desses casos é o m.passo de sempre.
*/
type Montador = (id: string, simbolo: string, expr: Expr | Expr[] | null, o: OpcoesDoPasso) => Passo | null;
function montador(m: Memoria): Montador {
  return (id, simbolo, expr, o) => {
    const v = lerValor(m.r, id);
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return null;
      if (expr === null) return m.passo(id, simbolo, null, o);
      const contas = (Array.isArray(expr) ? expr : [expr]).filter((e) => Number.isFinite(avaliar(e, m.r)));
      if (contas.length === 0) return m.passo(id, simbolo, null, { ...o, origem: o.origem ?? 'calculado' });
      return m.passo(id, simbolo, contas, o);
    }
    if (typeof v === 'string' && v.trim() !== '' && !v.trim().startsWith('—')) {
      return m.passo(id, simbolo, null, { ...o, origem: 'calculado' });
    }
    return null;
  };
}

const aplicavel = (m: Memoria) => m.texto('Tipo_muro') === 'Contrafortes';

// ───────────────────────────── 1 · esforços ─────────────────────────────

function cardEsforcos(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const ps = montador(m);
  const intermediario = comeca(m.texto('tipo_cf'), 'Inter');   // IF(LEFT(tipo_cf,5)="Inter";l;l/2 + balanço)

  const lenr = m.g('l_cf_adot', '\\ell_{cf}', 2, 'm');
  const bal = m.ent('bal_cf', 'b_{al}');
  const binf = m.g('binf', 'b_{inf}', 2, 'm');
  const gf = m.ent('gama_f', '\\gamma_f');

  const dados = secao('Dados', [
    ps('l_cf_adot', '\\ell_{cf}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    !intermediario && m.entrada('bal_cf', 'b_{al}'),
    m.entrada('gama_f', '\\gamma_f'),
  ]);

  const influencia = secao('Largura de influência', [
    ps('binf', 'b_{inf}', intermediario ? lenr : soma(div(lenr, cte(2, 0)), bal), { casas: 2, unidade: 'm' }),
  ], CRITERIO);

  const tab7 = NBR('8.8.3, Tab. 7');
  const ventoCf = m.texto('vento_on') === 'Sim';
  const esforcos = secao('Esforços na base do contraforte', [
    ps('q_cf', 'q_{cf}', mul(m.g('sh_base', '\\sigma_{h,base}', 2, 'kPa'), binf), { casas: 2, unidade: 'kN/m' }),
    // vento (13/11): o contraforte com pilarete leva o vento do muro de cima e da parte do arrimo acima do solo
    ventoCf && ps('Mk_wcf', 'M_{k,w,cf}', null, { casas: 2, unidade: 'kN·m', origem: 'calculado' }),
    ventoCf && ps('Vk_wcf', 'V_{k,w,cf}', null, { casas: 2, unidade: 'kN', origem: 'calculado' }),
    ps('Mk_cf', 'M_{k,cf}', ventoCf
      ? soma(mul(m.g('Mk_', 'M_k', 2, 'kN·m/m'), binf), m.g('Mk_wcf', 'M_{k,w,cf}', 2, 'kN·m'))
      : mul(m.g('Mk_', 'M_k', 2, 'kN·m/m'), binf), { casas: 2, unidade: 'kN·m' }),
    ps('Vk_cf', 'V_{k,cf}', ventoCf
      ? soma(mul(m.g('Vk_', 'V_k', 2, 'kN/m'), binf), m.g('Vk_wcf', 'V_{k,w,cf}', 2, 'kN'))
      : mul(m.g('Vk_', 'V_k', 2, 'kN/m'), binf), { casas: 2, unidade: 'kN' }),
    ps('Md_cf', 'M_{d,cf}', mul(gf, m.g('Mk_cf', 'M_{k,cf}', 2, 'kN·m')), { casas: 2, unidade: 'kN·m', ref: tab7 }),
    ps('Vd_cf', 'V_{d,cf}', mul(gf, m.g('Vk_cf', 'V_{k,cf}', 2, 'kN')), { casas: 2, unidade: 'kN', ref: tab7 }),
  ], CRITERIO);

  return {
    id: 'contraforte.esforcos',
    titulo: 'Contraforte · esforços',
    ref: CRITERIO,
    figura: 'Fig. 12',
    secoes: [dados, influencia, esforcos],
    avisos: [],
    aplicavel: aplicavel(m),
  };
}

// ───────────────────────────── 2 · esbeltez ─────────────────────────────

function cardEsbeltez(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const ps = montador(m);
  const travado = m.texto('Trav_lat') === 'Sim';

  const h = m.ent('H_muro', 'h_{muro}');
  const t = m.ent('t_bloco', 't');
  const av = m.ent('alfa_v', '\\alpha_v');
  const ah = m.ent('alfa_h', '\\alpha_h');
  // com contrafortes o travamento lateral é o próprio contraforte: l = espaçamento adotado (planilha, he_; Jose 12/10)
  const comCf = m.texto('Tipo_muro') === 'Contrafortes';
  const l = comCf ? m.g('l_cf_adot', '\\ell_{cf}', 2, 'm') : m.ent('l_trav', '\\ell');
  const tenr = m.g('tenr_adot', 't_{enr}', 1, 'cm');
  const eenr = m.g('eenr', 'e_{enr}', 1, 'cm');
  const lenrCm = m.g('l_cf_adot', '\\ell_{cf}', 0, 'cm', { fator: 100 });
  const rle = m.g('r_le', '\\ell_{cf}/e_{enr}', 3);
  const rtt = m.g('r_tt', 't_{enr}/t', 3);
  const tx = m.g('tx_dl', 't_{\\delta,x}', 3);
  const ty = m.g('ty_dl', 't_{\\delta,y}', 3);
  const delta = m.g('delta_e', '\\delta', 3);
  const he = m.g('he_', 'h_e', 2, 'm');
  const teM = m.g('te_cf', 't_e', 3, 'm', { fator: 0.01 });     // te em m: λ = he/te = 5,20/0,192

  const dados = secao('Dados', [
    m.entrada('H_muro', 'h_{muro}'),
    travado && m.entrada('alfa_v', '\\alpha_v'),
    travado && m.entrada('alfa_h', '\\alpha_h'),
    travado && !comCf && m.entrada('l_trav', '\\ell'),
    travado && comCf && ps('l_cf_adot', '\\ell_{cf}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.entrada('t_bloco', 't'),
    ps('tenr_adot', 't_{enr}', null, { casas: 1, unidade: 'cm', origem: 'adotado' }),
    // eenr = t_bloco: o contraforte tem a largura do bloco (montagem fechada)
    ps('eenr', 'e_{enr}', t, { casas: 1, unidade: 'cm' }),
  ]);

  /*
    δ: interpolação bilinear da planilha (linha i por ℓenr/eenr limitado a 6–20, coluna j por tenr/t limitado a
    1–3). A conta mostrada é a que de fato interpolou: tx = 0 e ty = 0 → valor da tabela; só um deles → a
    interpolação linear de mão; os dois → a bilinear com tx e ty publicados. tx ≠ 0 só acontece com ℓenr/eenr
    dentro da tabela (aí o valor limitado é o próprio r_le), idem ty com tenr/t — por isso as folhas são r_le/r_tt.
  */
  const T = tabelaDelta();
  const i = m.num('i_dl') ?? 1;
  const j = m.num('j_dl') ?? 1;
  const txv = m.num('tx_dl') ?? 0;
  const tyv = m.num('ty_dl') ?? 0;
  const d1 = (a: number) => cte(T.valor(a, j), 1);
  const linha = (ii: number, jj: number) => cte(T.valor(ii, jj), 1);
  const interpola = (a: Expr, b: Expr, f: Expr) => soma(a, mul(sub(b, a), f));
  let contaDelta: Expr | null = null;
  if (txv !== 0 && tyv === 0) contaDelta = interpola(d1(i), d1(i + 1), tx);
  else if (txv === 0 && tyv !== 0) contaDelta = interpola(linha(i, j), linha(i, j + 1), ty);
  else if (txv !== 0 && tyv !== 0) {
    contaDelta = soma(
      mul(sub(cte(1, 0), tx), interpola(linha(i, j), linha(i, j + 1), ty)),
      mul(tx, interpola(linha(i + 1, j), linha(i + 1, j + 1), ty)),
    );
  }
  const tab8 = NBR('9.4.2, Tab. 8');
  const efetiva = secao('Espessura efetiva', [
    ps('r_le', '\\ell_{cf}/e_{enr}', div(lenrCm, eenr), { casas: 3 }),
    ps('r_tt', 't_{enr}/t', div(tenr, t), { casas: 3 }),
    txv !== 0 && i < T.le.length
      && ps('tx_dl', 't_{\\delta,x}', div(sub(rle, cte(T.le[i - 1], 0)), sub(cte(T.le[i], 0), cte(T.le[i - 1], 0))), { casas: 3 }),
    tyv !== 0 && ps('ty_dl', 't_{\\delta,y}', sub(rtt, cte(j, 0)), { casas: 3 }),
    contaDelta
      ? ps('delta_e', '\\delta', contaDelta, { casas: 3, ref: tab8 })
      : ps('delta_e', '\\delta', null, { casas: 3, origem: 'tabela', ref: tab8 }),
    ps('te_cf', 't_e', mul(delta, t), { casas: 2, unidade: 'cm', ref: NBR('9.4.2') }),
  ], tab8);

  const esbeltez = secao('Esbeltez', [
    // mesma altura efetiva do muro em balanço (o card dele não aparece com contrafortes): copiada de ./solo.ts
    ps('he_', 'h_e', travado
      ? min(mul(av, h), mul(cte(0.7, 1), raiz(mul(av, h, ah, l))))
      : mul(cte(2, 0), h), { casas: 2, unidade: 'm', ref: NBR('9.4.1') }),
    ps('lam_cf', '\\lambda', div(he, teM), {
      casas: 1,
      ref: NBR('10.1.2, Tab. 9'),
      verif: verifica(m, 'esbeltez', { chave: 'contraforte.esbeltez', rotulo: 'Esbeltez λ ≤ 30', limite: 30, relacao: '<=', casasLimite: 0 }),
    }),
  ], NBR('9.4.1 e 10.1.2'));

  return {
    id: 'contraforte.esbeltez',
    titulo: 'Contraforte · esbeltez',
    ref: NBR('9.4'),
    figura: 'Fig. 12',
    secoes: [dados, efetiva, esbeltez],
    avisos: [],
    aplicavel: aplicavel(m),
  };
}

// ───────────────────────────── 3 · flexão ─────────────────────────────

function cardFlexao(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const ps = montador(m);
  const T = m.num('cf_T') === 1;                // enterrado (lado do solo): seção T
  const TT = m.num('cf_TT') === 1;              // T com o bloco 0,8x passando da mesa
  const intermediario = comeca(m.texto('tipo_cf'), 'Inter');
  // critério do As,mín: 'Viga (b·d)' = 0,15%·bw·d; 'Parede (b·t)' = 0,10%·bw·h (NBR 16868-1 12.2)
  const viga = comeca(m.texto('AsMin_crit'), 'Viga');

  const t = m.ent('t_bloco', 't');
  const hCm = m.ent('H_muro', 'h_{muro}', { fator: 100, casas: 0, unidade: 'cm' });
  const balCm = m.ent('bal_cf', 'b_{al}', { fator: 100, casas: 0, unidade: 'cm' });
  const lenrCm = m.g('l_cf_adot', '\\ell_{cf}', 0, 'cm', { fator: 100 });
  const tenr = m.g('tenr_adot', 't_{enr}', 1, 'cm');
  const eenr = m.g('eenr', 'e_{enr}', 1, 'cm');
  const hcf = m.g('h_cf', 'h_{cf}', 1, 'cm');
  const bw = m.g('bw_cf', 'b_{w,cf}', 1, 'cm');
  const c = m.g('c_cf', 'c_{cf}', 1, 'cm');
  const d = m.g('d_cf', 'd_{cf}', 1, 'cm');
  const bfa = m.g('bf_a', 'b_{f,1}', 1, 'cm');
  const bfb = m.g('bf_b', 'b_{f,2}', 1, 'cm');
  const bm = m.g('bm_cf', 'b_{m,cf}', 1, 'cm');
  const hf = m.g('hf_cf', 'h_{f,cf}', 1, 'cm');
  const fpkcf = m.g('fpk_cf', 'f_{pk,cf}', 2, 'MPa');
  const K = m.g('K_cfu', 'K_{cf}', 2);
  const gm = m.ent('gama_m', '\\gamma_m');
  const gs = m.ent('gama_s', '\\gamma_s');
  const fyk = m.ent('fyk_', 'f_{yk}');
  const fd = m.g('Kfd_cf', 'K\\,f_{d,cf}', 3, 'kN/cm²', { fator: 0.1 });
  const fsd = m.g('fsd_cf', 'f_{sd,cf}', 2, 'kN/cm²', { fator: 0.1 });
  const Md = m.g('Md_cf', 'M_{d,cf}', 1, 'kN·cm', { fator: 100 });
  const kM = m.g('arg_cf', 'k_{md,cf}', 3);
  const xr = m.g('x_cfr', 'x_{r,cf}', 2, 'cm');
  const xw = m.g('x_cfw', 'x_{w,cf}', 2, 'cm');
  const Cf = m.g('Cf_cf', 'C_{f,cf}', 2, 'kN');
  const z = m.g('z_cf', 'z_{cf}', 2, 'cm');
  const As = m.g('As_cfn', 'A_{s,cf}', 2, 'cm²');
  const Asmin = m.g('As_cfm', 'A_{s,m\\acute{\\imath}n,cf}', 2, 'cm²');
  const Ascalc = m.g('As_cfc', 'A_{s,calc,cf}', 2, 'cm²');
  const aPhi = m.g('a_cf', 'A_{\\phi,cf}', 3, 'cm²');
  const phiCm = m.ent('phi_cf', '\\phi_{cf}', { fator: 0.1, casas: 2, unidade: 'cm' });
  const nb = m.g('n_cf', 'n_{b,cf}', 0);
  const Asef = m.g('As_cfe', 'A_{s,ef,cf}', 2, 'cm²');
  const Asmax = m.g('As_cfx', 'A_{s,m\\acute{a}x,cf}', 2, 'cm²');

  // ── seção ──
  const cDigitado = m.num('c_cf_dir') !== null;
  // A posição da barra é da MONTAGEM: centro do trecho comum aos furos das fiadas P e I, medido no template do Revit
  // (célula c_mont, tabela da aba Referências). Seção própria para a FONTE aparecer na tela e no papel — é o número
  // que o Jose vai querer conferir primeiro (a figura do card mostra de onde ele sai: a + ℓ/2).
  const montagem = secao('Barra na montagem', [
    ps('c_mont', 'c_{mont}', null, { casas: 1, unidade: 'cm', origem: 'tabela' }),
  ], revit(m));
  const secaoT = secao(T ? 'Seção T (contraforte enterrado)' : 'Seção retangular (contraforte aparente)', [
    ps('h_cf', 'h_{cf}', tenr, { casas: 1, unidade: 'cm' }),
    ps('bw_cf', 'b_{w,cf}', eenr, { casas: 1, unidade: 'cm' }),
    // c digitado nas Entradas manda; em branco, o da montagem
    cDigitado
      ? ps('c_cf', 'c_{cf}', null, { casas: 1, unidade: 'cm', origem: 'entrada' })
      : ps('c_cf', 'c_{cf}', m.g('c_mont', 'c_{mont}', 1, 'cm'), { casas: 1, unidade: 'cm' }),
    ps('d_cf', 'd_{cf}', sub(hcf, c), { casas: 1, unidade: 'cm' }),
    T && ps('bf_a', 'b_{f,1}', min(mul(cte(6, 0), t), div(sub(lenrCm, bw), cte(2, 0))), { casas: 1, unidade: 'cm', ref: NBR('10.1.3') }),
    T && ps('bf_b', 'b_{f,2}', intermediario ? bfa : min(mul(cte(6, 0), t), balCm), { casas: 1, unidade: 'cm', ref: NBR('10.1.3') }),
    ps('bm_cf', 'b_{m,cf}', T ? min(soma(bw, bfa, bfb), div(hCm, cte(3, 0))) : bw, { casas: 1, unidade: 'cm', ref: NBR('11.3.4') }),
    // hf ≤ 0,5d: o limite não tem célula própria — a folha é d_cf lida com fator 0,5 (o número sai da célula de d)
    T && ps('hf_cf', 'h_{f,cf}', t, {
      casas: 1,
      unidade: 'cm',
      ref: NBR('11.3.4'),
      verif: verifica(m, 'mesa', {
        chave: 'contraforte.mesa', rotulo: 'Mesa hf ≤ 0,5d', relacao: '<=',
        limite: m.g('d_cf', '0{,}5\\,d_{cf}', 1, 'cm', { fator: 0.5 }),
      }),
    }),
  ], NBR('11.3.4'));

  // ── materiais ──
  const kDigitado = m.num('K_cf') !== null;    // IF(ISNUMBER(K_cf);K_cf;IF(cf_T=1;1,5;2))
  const fsdConta = div(fyk, gs);                // bloco de concreto: fsd = fyd (todo Ø)
  const materiais = secao('Materiais', [
    ps('fpk_cf', 'f_{pk,cf}', T ? m.g('fpk_oco', 'f_{pk}', 1, 'MPa') : m.g('fpk_chei', 'f_{pk}^{*}', 1, 'MPa'), { casas: 2, unidade: 'MPa', ref: CRITERIO }),
    kDigitado
      ? ps('K_cfu', 'K_{cf}', null, { casas: 2, origem: 'entrada' })
      : ps('K_cfu', 'K_{cf}', null, { casas: 2, origem: 'tabela', ref: NBR('6.2.2.4') }),
    m.entrada('gama_m', '\\gamma_m'),
    ps('Kfd_cf', 'K\\,f_{d,cf}', div(mul(K, cte(0.7, 1), fpkcf), gm), { casas: 3, unidade: 'MPa', ref: NBR('6.2.2.3') }),
    m.entrada('fyk_', 'f_{yk}'),
    m.entrada('gama_s', '\\gamma_s'),
    ps('fsd_cf', 'f_{sd,cf}', fsdConta, { casas: 1, unidade: 'MPa', ref: NBR('11.3.3') }),
  ]);

  // ── flexão: linha neutra ──
  const resiste = (limite: number | null, rotulo = 'Seção resiste') =>
    verifica(m, 'resiste', { chave: 'contraforte.resiste', rotulo, relacao: '<=', limite, casasLimite: 0 });
  const kMnum = m.valor('arg_cf') !== null;
  const passosLN: (Passo | null | false)[] = [
    ps('arg_cf', 'k_{md,cf}', div(Md, mul(cte(0.5, 1), bm, pot(d, 2), fd)), {
      casas: 3,
      verif: TT ? undefined : resiste(1, 'Seção resiste: kmd < 1'),
    }),
    ps('x_cfr', 'x_{r,cf}', mul(cte(1.25, 2), d, sub(cte(1, 0), raiz(sub(cte(1, 0), kM)))), {
      casas: 2,
      unidade: 'cm',
      // sem kM publicado ("—"), quem diz que não resiste é a linha de x
      verif: !TT && !kMnum ? resiste(null) : undefined,
    }),
  ];
  if (TT) {
    passosLN.push(
      ps('Cf_cf', 'C_{f,cf}', mul(fd, sub(bm, bw), hf), { casas: 2, unidade: 'kN' }),
      ps('x_cfw', 'x_{w,cf}', mul(cte(1.25, 2), d, sub(cte(1, 0), raiz(sub(cte(1, 0),
        div(sub(Md, mul(Cf, sub(d, div(hf, cte(2, 0))))), mul(cte(0.5, 1), bw, pot(d, 2), fd)))))), {
        casas: 2, unidade: 'cm', verif: resiste(null),
      }),
    );
  }
  const x = TT ? xw : xr;
  const xNum = m.valor(TT ? 'x_cfw' : 'x_cfr') !== null;
  const secLN = secao('Linha neutra', passosLN, ABCP_34);

  // as forças, a LN e o braço de alavanca desenhados ao lado da conta da LN (Jose, 13/11: "pra confirmar a posição dela")
  const forcas = desenhoDasForcasNoContraforte(r);
  if (forcas) secLN.desenho = forcas;
  const secoes = [montagem, secaoT, materiais, secLN];
  if (xNum) {
    // ── armadura ── (a seção que não resiste para em "não resiste": As, nº de barras e As,máx ficam de fora)
    const md = m.num('Md_cf');
    const semMomento = md !== null && md <= 0;            // IF(Md_cf<=0;0;…)
    const nDigitado = m.num('n_cf_dir') !== null;
    const AsNum = m.valor('As_cfn') !== null;
    const armadura = secao('Armadura', [
      ps('xd_cf', '(x/d)_{cf}', div(x, d), {
        casas: 3,
        ref: NBR('11.3.3'),
        verif: verifica(m, 'ductil', { chave: 'contraforte.ductilidade', rotulo: 'Ductilidade x/d ≤ 0,45', limite: 0.45, relacao: '<=', casasLimite: 2 }),
      }),
      !TT && ps('z_cf', 'z_{cf}', min(sub(d, mul(cte(0.4, 1), xr)), mul(cte(0.95, 2), d)), { casas: 2, unidade: 'cm' }),
      semMomento
        ? ps('As_cfn', 'A_{s,cf}', null, { casas: 2, unidade: 'cm²', origem: 'calculado' })
        : ps('As_cfn', 'A_{s,cf}', TT ? div(soma(Cf, mul(fd, bw, cte(0.8, 1), xw)), fsd) : div(Md, mul(fsd, z)), { casas: 2, unidade: 'cm²' }),
      ps('As_cfm', 'A_{s,m\\acute{\\imath}n,cf}', viga ? mul(cte(0.0015, 4), bw, d) : mul(cte(0.001, 3), bw, hcf), {
        casas: 2, unidade: 'cm²', ref: NBR('12.2'),
      }),
      // MÁXIMO do Excel ignora o texto de célula: As "—" deixa As,calc = As,mín
      ps('As_cfc', 'A_{s,calc,cf}', AsNum ? max(As, Asmin) : Asmin, { casas: 2, unidade: 'cm²' }),
      m.entrada('phi_cf', '\\phi_{cf}'),
      ps('a_cf', 'A_{\\phi,cf}', div(mul(pi(), pot(phiCm, 2)), cte(4, 0)), { casas: 3, unidade: 'cm²' }),
      nDigitado
        ? ps('n_cf', 'n_{b,cf}', null, { casas: 0, origem: 'entrada' })
        : ps('n_cf', 'n_{b,cf}', max(cte(2, 0), arredCima(sub(div(Ascalc, aPhi), cte(0.005, 3)))), { casas: 0 }),
      ps('As_cfe', 'A_{s,ef,cf}', mul(nb, aPhi), {
        casas: 2,
        unidade: 'cm²',
        verif: verifica(m, 'As', { chave: 'contraforte.As', rotulo: 'As,ef ≥ As,calc', limite: Ascalc, relacao: '>=' }),
      }),
    ], ABCP_34);

    const furo = secao('Armadura máxima no furo da ponta', [
      ps('As_cfx', 'A_{s,m\\acute{a}x,cf}', mul(m.g('pAs_max', 'p_{m\\acute{a}x}', 2), m.g('Ag_furo', 'A_g', 0, 'cm²')), { casas: 2, unidade: 'cm²' }),
      ps('As_cfx2', 'A_{s,furo,cf}', mul(Asef, m.g('f_trasp', 'n_{tr}', 0)), {
        casas: 2,
        unidade: 'cm²',
        verif: verifica(m, 'Asmax', { chave: 'contraforte.Asmax', rotulo: 'As no furo ≤ As,máx', limite: Asmax, relacao: '<=' }),
      }),
    ], NBR('12.3'));
    // O furo REAL da barra (montagem do Revit): só informa — a régua do As,máx é a da linha de cima. Decisão do
    // Jose (09/10): nenhuma verificação nova; por isso nenhuma destas linhas leva verif.
    const real = secao('Furo da barra na montagem', [
      ps('A_fcm', 'A_{furo,cf}', null, { casas: 2, unidade: 'cm²', origem: 'tabela' }),
      ps('nb_cab', 'n_{cabe,cf}', null, { casas: 0, origem: 'tabela', ref: NBR('12.1') }),
      ps('nb_tx', 'n_{8\\%,cf}', inteiro(div(mul(m.g('pAs_max', 'p_{m\\acute{a}x}', 2), m.g('A_fcm', 'A_{furo,cf}', 2, 'cm²')),
        mul(m.g('f_trasp', 'n_{tr}', 0), aPhi))), { casas: 0 }),
    ], revit(m));
    secoes.push(armadura, furo, real);
  }

  const desenho = desenhoDaSecaoDoContraforte(r);
  return {
    id: 'contraforte.flexao',
    titulo: 'Contraforte · flexão',
    ref: ABCP_34,
    figura: 'Fig. 12',
    ...(desenho ? { desenho } : {}),
    secoes,
    avisos: [],
    aplicavel: aplicavel(m),
  };
}

// ───────────────────────────── 4 · cisalhamento ─────────────────────────────

function cardCisalhamento(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const ps = montador(m);

  const bw = m.g('bw_cf', 'b_{w,cf}', 1, 'cm');
  const d = m.g('d_cf', 'd_{cf}', 1, 'cm');
  const hCm = m.ent('H_muro', 'h_{muro}', { fator: 100, casas: 0, unidade: 'cm' });
  const Asef = m.g('As_cfe', 'A_{s,ef,cf}', 2, 'cm²');
  const rho = m.g('rho_cf', '\\rho_{cf}', 6);
  const fvk = m.g('fvk_cf', 'f_{vk,cf}', 3, 'MPa');
  const fvdK = m.g('fvd_cf', 'f_{vd,cf}', 4, 'kN/cm²', { fator: 0.1 });
  const Vd = m.g('Vd_cf', 'V_{d,cf}', 2, 'kN');
  const Va = m.g('Va_cf', 'V_{a,cf}', 2, 'kN');
  const gm = m.ent('gama_m', '\\gamma_m');
  const gs = m.ent('gama_s', '\\gamma_s');
  const fyk = m.ent('fyk_', 'f_{yk}');
  const fpkc = m.g('fpk_chei', 'f_{pk}^{*}', 1, 'MPa');
  const fywdK = m.g('fywd', 'f_{ywd}', 2, 'kN/cm²', { fator: 0.1 });
  const fgk = m.g('fgk_', 'f_{gk}', 1, 'MPa');
  const rhow = m.g('rhow_cf', '\\rho_{w,cf}', 5, '', { fator: 0.01 });   // % → fração: 0,00084
  const Aswn = m.g('Asw_n', '(A_{sw}/s)_{nec}', 2, 'cm²/m');
  const Aswm = m.g('Asw_m', '(A_{sw}/s)_{m\\acute{\\imath}n}', 2, 'cm²/m');
  const Aswc = m.g('Asw_c', '(A_{sw}/s)_{calc}', 2, 'cm²/m');
  const Aswe = m.g('Asw_e', '(A_{sw}/s)_{ef}', 2, 'cm²/m');
  const nram = m.ent('ramos_est', 'n_{ram}');
  const s = m.ent('s_est', 's_{est}');
  const phiEstCm = m.ent('phi_est', '\\phi_{est}', { fator: 0.1, casas: 2, unidade: 'cm' });

  const tab4 = NBR('6.2.2.6');
  const resistencia = secao('Resistência sem estribo', [
    ps('rho_cf', '\\rho_{cf}', [div(Asef, mul(bw, d)), min(div(Asef, mul(bw, d)), cte(0.02, 2))], { casas: 6, ref: tab4 }),
    ps('fvk_cf', 'f_{vk,cf}', [soma(cte(0.35, 2), mul(cte(17.5, 1), rho)), min(soma(cte(0.35, 2), mul(cte(17.5, 1), rho)), cte(0.7, 1))], {
      casas: 3, unidade: 'MPa', ref: tab4,
    }),
    m.entrada('gama_m', '\\gamma_m'),
    ps('fvd_cf', 'f_{vd,cf}', div(fvk, gm), { casas: 3, unidade: 'MPa' }),
    ps('tau_cf', '\\tau_{vd,cf}', mul(div(Vd, mul(bw, d)), cte(10, 0)), { casas: 3, unidade: 'MPa', ref: NBR('11.4.1') }),
    ps('Va_cf', 'V_{a,cf}', mul(fvdK, bw, d), { casas: 2, unidade: 'kN', ref: NBR('11.4.3') }),
    ps('Vrd2_cf', 'V_{Rd2,cf}', soma(Va, div(mul(cte(0.4, 1), bw, d, raiz(fpkc)), mul(cte(10, 0), gm))), {
      casas: 2,
      unidade: 'kN',
      ref: NBR('11.4.3'),
      verif: verifica(m, 'bielas', { chave: 'contraforte.bielas', rotulo: 'Bielas VRd2 ≥ Vd', limite: Vd, relacao: '>=' }),
    }),
  ], NBR('11.4'));

  // IF(Vd_cf<=Va_cf;0;MÁXIMO(Asw_n;Asw_m)): Vd ≤ Va dispensa o estribo pela conta
  const vd = m.num('Vd_cf');
  const va = m.num('Va_cf');
  const dispensa = vd !== null && va !== null ? vd <= va : m.num('Asw_c') === 0;
  const nec = secao('Estribo necessário', dispensa
    ? [ps('Asw_c', '(A_{sw}/s)_{calc}', null, { casas: 2, unidade: 'cm²/m', origem: 'calculado' })]
    : [
        m.entrada('fyk_', 'f_{yk}'),
        m.entrada('gama_s', '\\gamma_s'),
        ps('fywd', 'f_{ywd}', div(fyk, gs), { casas: 1, unidade: 'MPa' }),
        ps('Asw_n', '(A_{sw}/s)_{nec}', mul(div(sub(Vd, Va), mul(cte(0.75, 2), fywdK, d)), cte(100, 0)), {
          casas: 2, unidade: 'cm²/m', ref: NBR('11.4.3'),
        }),
        ps('rhow_cf', '\\rho_{w,cf}', [
          soma(cte(0.07, 2), div(mul(sub(fgk, cte(15, 0)), cte(0.07, 2)), cte(25, 0))),
          min(cte(0.14, 2), max(cte(0.07, 2), soma(cte(0.07, 2), div(mul(sub(fgk, cte(15, 0)), cte(0.07, 2)), cte(25, 0))))),
        ], { casas: 3, unidade: '%', ref: NBR('12.2') }),
        ps('Asw_m', '(A_{sw}/s)_{m\\acute{\\imath}n}', mul(rhow, bw, cte(100, 0)), { casas: 2, unidade: 'cm²/m', ref: NBR('12.2') }),
        ps('Asw_c', '(A_{sw}/s)_{calc}', max(Aswn, Aswm), { casas: 2, unidade: 'cm²/m' }),
        ps('phi_wn', '\\phi_{est,nec}', mul(raiz(div(mul(cte(4, 0), s, Aswc), mul(cte(100, 0), nram, pi()))), cte(10, 0)), {
          casas: 1, unidade: 'mm',
        }),
      ], NBR('11.4.3'));

  // Dispensa pela conta = muro SEM estribo (Jose, 13/10; fvd ≥ τvd): Ø, ramos e s das Entradas não
  // entram (a planilha zera Asw,ef e o nº de estribos), então a seção só registra o nº de estribos = 0.
  const adotado = dispensa
    ? secao('Estribo adotado', [ps('n_est', 'n_{est}', null, { casas: 0, origem: 'calculado' })])
    : secao('Estribo adotado', [
        ps('phi_est', '\\phi_{est}', null, {
          casas: casasDaEntrada('phi_est'),
          unidade: 'mm',
          origem: 'entrada',
          ref: NBR('12.4'),
          verif: verifica(m, 'junta', { chave: 'contraforte.estriboJunta', rotulo: 'Estribo na junta Ø ≤ 6,3', limite: 6.3, relacao: '<=', casasLimite: 1 }),
        }),
        m.entrada('ramos_est', 'n_{ram}'),
        m.entrada('s_est', 's_{est}'),
        ps('Asw_e', '(A_{sw}/s)_{ef}', mul(div(mul(nram, pi(), pot(phiEstCm, 2)), mul(cte(4, 0), s)), cte(100, 0)), {
          casas: 2,
          unidade: 'cm²/m',
          verif: verifica(m, 'estribos', { chave: 'contraforte.estribos', rotulo: 'Estribo Asw,ef ≥ Asw,calc', limite: Aswc, relacao: '>=' }),
        }),
        ps('Vrd3_cf', 'V_{Rd3,cf}', soma(Va, div(mul(cte(0.75, 2), fywdK, d, Aswe), cte(100, 0))), { casas: 2, unidade: 'kN', ref: NBR('11.4.3') }),
        ps('n_est', 'n_{est}', arredCima(div(hCm, s)), { casas: 0 }),
      ]);

  return {
    id: 'contraforte.cisalhamento',
    titulo: 'Contraforte · cisalhamento',
    ref: NBR('11.4'),
    figura: 'Fig. 21',
    secoes: [resistencia, nec, adotado],
    avisos: [],
    aplicavel: aplicavel(m),
  };
}

// ───────────────────────────── 5 · ELS ─────────────────────────────

function cardEls(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const ps = montador(m);
  const T = m.num('cf_T') === 1;
  const x2r = m.num('x2r_cf');
  const hfv = m.num('hf_cf');
  // IF(OR(cf_T=0;x2r_cf<=hf_cf);…): LN no estádio II dentro da mesa (ou seção retangular)
  const naMesa = !T || (x2r !== null && hfv !== null && x2r <= hfv);
  const ma = m.num('Ma_cf');
  const mr = m.num('Mr_cf');
  const naoFissura = ma !== null && mr !== null && ma <= mr;
  const vao2h = (m.texto('vao_ref') || '').toLowerCase() === '2h';

  const hcf = m.g('h_cf', 'h_{cf}', 1, 'cm');
  const bw = m.g('bw_cf', 'b_{w,cf}', 1, 'cm');
  const bm = m.g('bm_cf', 'b_{m,cf}', 1, 'cm');
  const hf = m.g('hf_cf', 'h_{f,cf}', 1, 'cm');
  const d = m.g('d_cf', 'd_{cf}', 1, 'cm');
  const fpkcf = m.g('fpk_cf', 'f_{pk,cf}', 2, 'MPa');
  const kE = m.g('Em_coef', 'k_E', 0);
  const Em = m.g('Em_cf', 'E_{m,cf}', 0, 'MPa');
  const EmKNm2 = m.g('Em_cf', 'E_{m,cf}', 0, 'kN/m²', { fator: 1000 });
  const ncf = m.g('n_cfe', 'n_{cf}', 2);
  const ftkK = m.g('ftk_nor', 'f_{tk,\\perp}', 3, 'kN/cm²', { fator: 0.1 });
  const A = m.g('A_cfg', 'A_{b,cf}', 1, 'cm²');
  const y = m.g('y_cfg', 'y_{G,cf}', 2, 'cm');
  const Ig = m.g('Ig_cf', 'I_{g,cf}', 0, 'cm⁴');
  const Mr = m.g('Mr_cf', 'M_{r,cf}', 1, 'kN·cm');
  const Ma = m.g('Ma_cf', 'M_{a,cf}', 1, 'kN·cm');
  const MkCm = m.g('Mk_cf', 'M_{k,cf}', 1, 'kN·cm', { fator: 100 });
  const psi = m.ent('psi_els', '\\psi_{ELS}');
  const Asef = m.g('As_cfe', 'A_{s,ef,cf}', 2, 'cm²');
  const b2 = m.g('b2_cf', 'b_{II,cf}', 1, 'cm');
  const xr = m.g('x2r_cf', 'x_{II,cf}', 2, 'cm');
  const xt = m.g('x2t_cf', 'x_{IIw,cf}', 2, 'cm');
  const III = m.g('III_cf', 'I_{II,cf}', 0, 'cm⁴');
  const Ieq = m.g('Ieq_cf', 'I_{eq,cf}', 0, 'cm⁴');
  const IeqM4 = m.g('Ieq_cf', 'I_{eq,cf}', 7, 'm⁴', { fator: 1e-8 });
  const binf = m.g('binf', 'b_{inf}', 2, 'm');
  const S = m.g('sum_d', 'S_{\\delta}', 4, 'kN·m³/m');
  const nAdm = m.ent('div_adm', 'n_{adm}');
  const d0 = m.g('d0_cf', '\\delta_{0,cf}', 2, 'mm');
  const dxi = m.ent('dxi', '\\Delta\\xi');
  const hMm = m.ent('H_muro', 'h_{muro}', { fator: 1000, casas: 0, unidade: 'mm' });

  const dois = cte(2, 0);
  const abas = sub(bm, bw);
  const nAs = mul(ncf, Asef);

  const bruta = secao(T ? 'Seção T bruta' : 'Seção retangular bruta', [
    ps('Em_cf', 'E_{m,cf}', mul(kE, fpkcf), { casas: 0, unidade: 'MPa', ref: NBR('6.2.1, Tab. 1') }),
    ps('n_cfe', 'n_{cf}', div(cte(210000, 0), Em), { casas: 2 }),
    ps('A_cfg', 'A_{b,cf}', T ? soma(mul(abas, hf), mul(bw, hcf)) : mul(bw, hcf), { casas: 1, unidade: 'cm²' }),
    ps('y_cfg', 'y_{G,cf}', T
      ? div(soma(div(mul(abas, pot(hf, 2)), dois), div(mul(bw, pot(hcf, 2)), dois)), A)
      : div(hcf, dois), { casas: 2, unidade: 'cm' }),
    ps('Ig_cf', 'I_{g,cf}', T
      ? soma(
          div(mul(abas, pot(hf, 3)), cte(12, 0)),
          mul(abas, hf, pot(sub(y, div(hf, dois)), 2)),
          div(mul(bw, pot(hcf, 3)), cte(12, 0)),
          mul(bw, hcf, pot(sub(div(hcf, dois), y), 2)),
        )
      : div(mul(bw, pot(hcf, 3)), cte(12, 0)), { casas: 0, unidade: 'cm⁴' }),
    ps('Mr_cf', 'M_{r,cf}', div(mul(ftkK, Ig), sub(hcf, y)), { casas: 1, unidade: 'kN·cm', ref: NBR('9.2.3') }),
    // o vento não entra no ELS (combinação quase permanente: ψ2 = 0 para o vento)
    ps('Ma_cf', 'M_{a,cf}', m.texto('vento_on') === 'Sim'
      ? mul(psi, par(sub(MkCm, m.g('Mk_wcf', 'M_{k,w,cf}', 1, 'kN·cm', { fator: 100 })))) : mul(psi, MkCm), { casas: 1, unidade: 'kN·cm' }),
  ], NBR('9.2.3'));

  // estádio II: armadura comprimida (construtivas) desprezada. LN e III em pedaços, um termo por linha como a planilha:
  // b·x²/2 + B·x − C = 0 com B e C publicados; III = alvenaria comprimida + abas da mesa + barra
  const xII = naMesa ? xr : xt;
  const B = m.g('lnB_cf', 'B_{II,cf}', 2, 'cm²');
  const C = m.g('lnC_cf', 'C_{II,cf}', 2, 'cm³');
  const Bw = m.g('lnBw_cf', 'B_{IIw,cf}', 2, 'cm²');
  const Cw = m.g('lnCw_cf', 'C_{IIw,cf}', 2, 'cm³');
  const Ialv = m.g('IIc_cf', 'I_{alv,cf}', 0, 'cm⁴');
  const Iabas = m.g('IIf_cf', 'I_{abas,cf}', 0, 'cm⁴');
  const Is = m.g('IIs_cf', 'I_{s,cf}', 0, 'cm⁴');
  const fissurada = secao('Seção fissurada (estádio II)', [
    ps('b2_cf', 'b_{II,cf}', T ? bm : bw, { casas: 1, unidade: 'cm' }),
    ps('lnB_cf', 'B_{II,cf}', nAs, { casas: 2, unidade: 'cm²' }),
    ps('lnC_cf', 'C_{II,cf}', mul(nAs, d), { casas: 2, unidade: 'cm³' }),
    ps('x2r_cf', 'x_{II,cf}', div(soma(neg(B), raiz(soma(pot(B, 2), mul(dois, b2, C)))), b2), { casas: 2, unidade: 'cm' }),
    !naMesa && ps('lnBw_cf', 'B_{IIw,cf}', soma(mul(abas, hf), B), { casas: 2, unidade: 'cm²' }),
    !naMesa && ps('lnCw_cf', 'C_{IIw,cf}', soma(div(mul(abas, pot(hf, 2)), dois), C), { casas: 2, unidade: 'cm³' }),
    !naMesa && ps('x2t_cf', 'x_{IIw,cf}', div(soma(neg(Bw), raiz(soma(pot(Bw, 2), mul(dois, bw, Cw)))), bw), { casas: 2, unidade: 'cm' }),
    ps('IIc_cf', 'I_{alv,cf}', div(mul(naMesa ? b2 : bw, pot(xII, 3)), cte(3, 0)), { casas: 0, unidade: 'cm⁴' }),
    !naMesa && ps('IIf_cf', 'I_{abas,cf}', soma(
      div(mul(abas, pot(hf, 3)), cte(12, 0)),
      mul(abas, hf, pot(sub(xII, div(hf, dois)), 2)),
    ), { casas: 0, unidade: 'cm⁴' }),
    ps('IIs_cf', 'I_{s,cf}', mul(nAs, pot(sub(d, xII), 2)), { casas: 0, unidade: 'cm⁴' }),
    ps('III_cf', 'I_{II,cf}', naMesa ? soma(Ialv, Is) : soma(Ialv, Iabas, Is), { casas: 0, unidade: 'cm⁴' }),
  ], NBR('9.2.3'));

  const razao3 = pot(div(Mr, Ma), 3);
  const branson = soma(mul(razao3, Ig), mul(sub(cte(1, 0), razao3), III));
  const flecha = secao('Flecha no topo', [
    ps('Ieq_cf', 'I_{eq,cf}', naoFissura ? Ig : [branson, min(Ig, branson)], { casas: 0, unidade: 'cm⁴', ref: NBR('9.2.3') }),
    ps('heq_cf', 'h_{eq,cf}', cbrt(div(mul(cte(12, 0), Ieq), b2)), { casas: 2, unidade: 'cm' }),
    // a mesma soma da flecha do balanço (célula sum_d): o card do ELS do balanço não aparece com contrafortes, e com o
    // solo abaixo do topo do muro ela tem a parcela da rotação — tem de estar à vista aqui
    m.valor('sum_d') !== null && passoDaSomaDaFlecha(m),
    ps('d0_cf', '\\delta_{0,cf}', mul(div(mul(psi, S, binf), mul(EmKNm2, IeqM4)), cte(1000, 0)), { casas: 2, unidade: 'mm' }),
    m.entrada('dxi', '\\Delta\\xi'),
    ps('dinf_cf', '\\delta_{\\infty,cf}', mul(d0, soma(cte(1, 0), dxi)), {
      casas: 2,
      unidade: 'mm',
      ref: NBR('9.2.4'),
      verif: verifica(m, 'els', {
        chave: 'contraforte.els', rotulo: 'Flecha δ∞ ≤ δadm', relacao: '<=',
        limite: m.g('dadm_cf', '\\delta_{adm,cf}', 2, 'mm'),
      }),
    }),
    // δadm = 2L/250 (balanço, L = h): critério adotado, a mesma conta de dadm_ (aba ELS), que a célula repete
    ps('dadm_cf', '\\delta_{adm,cf}', div(vao2h ? mul(dois, hMm) : hMm, nAdm), { casas: 2, unidade: 'mm', ref: CRITERIO }),
  ], NBR('9.2.4'));

  // a mesma seção cotada da flexão: A, yG e I são desta figura (mesa bm × t + alma bw × tenr, seção bruta)
  const desenho = desenhoDaSecaoDoContraforte(r);
  return {
    id: 'contraforte.els',
    titulo: 'Contraforte · ELS',
    ref: NBR('9.2'),
    figura: 'Fig. 21',
    ...(desenho ? { desenho } : {}),
    secoes: [bruta, fissurada, flecha],
    avisos: [],
    aplicavel: aplicavel(m),
  };
}

/** Contraforte: esforços, esbeltez, flexão, cisalhamento e ELS — só aparece com Tipo_muro = Contrafortes. */
export const autorContraforte: AutorDeCards = (r) => [
  cardEsforcos(r), cardEsbeltez(r), cardFlexao(r), cardCisalhamento(r), cardEls(r),
];
