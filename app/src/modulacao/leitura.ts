/*
  LEITURA DA CONTA — o que a modulação pega do Resultado (por nome definido) e das entradas do modelo.

  A modulação não recalcula nada da planilha: lê. Nome que ainda não existe (os *_adot que a planilha vai
  publicar numa etapa própria) não é erro aqui — Resultado.v lança, e a leitura devolve `undefined` para a regra
  modular entrar no lugar. Nome que DEVIA existir e veio texto/erro ("—", #DIV/0!) cai num valor de obra com
  Aviso: o desenho não pode sumir porque uma conta da planilha ficou sem resposta.
*/
import type { Resultado, Valor } from '@/motor/tipos';
import type { Aviso } from '@/modelo/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';

export function lerValor(r: Resultado, nome: string): Valor | undefined {
  try {
    return r.v(nome);
  } catch {
    return undefined;
  }
}

/** Número de um Valor (aceita '19' e '12,5' das listas de validação). */
export function comoNumero(v: Valor | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    if (s === '' || !/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const comoTexto = (v: Valor | undefined): string => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'object' ? v.erro : String(v));

export function padroesDoModelo(): Record<string, Valor> {
  const out: Record<string, Valor> = {};
  for (const e of ENTRADAS_DO_MODELO) out[e.nome] = e.padrao;
  return out;
}

/** Tudo que a modulação usa, já em mm (geometria) e com os textos das listas resolvidos. */
export interface Parametros {
  // geometria
  t_bloco: number; L_bloco: number;
  grauteTotal: boolean;
  s_graute: number;                    // mm — graute a cada X (grade dos furos grauteados da parede; 200 = todos)
  contrafortes: boolean;
  H_muro: number;                      // mm — altura do muro (entrada, lista de fiadas inteiras)
  H_solo: number;                      // mm — altura de solo contido (o aterro e a drenagem vão até aqui)
  // balanço
  phi_v: number; s_vert: number | null; d_util: number | null; s_can_bal: number | null; lb: number | null;
  // contrafortes
  l_cf: number; tenr: number; eenr: number; enterrado: boolean; bal_cf: number;
  phi_cf: number; n_cf: number; c_cf: number | null; phi_cc: number; n_cc: number;
  phi_est: number; s_est: number | null; ramos_est: number;
  estribos: boolean;                   // o contraforte leva estribo? (a conta pediu: Asw/s de cálculo > 0)
  phi_pv: number; s_pv: number | null; duasBarrasPv: boolean; c_pv: number;
  phi_ph: number; s_ph: number | null; phCentralizada: boolean;
  phDuas: boolean;                     // 2 barras na canaleta, uma encostada em cada face (Jose, 13/11)
  // fundação
  B_sap: number; h_sap: number; a_ater: number; b_den: number; h_den: number; x_den: number; cob_sap: number;
  phi_sap: number; phi_sap2: number; phi_tor: number; s_ps: number | null; s_ss: number | null; s_tor: number | null;
  Mk_heel: number; T_sd: number; Asl_s: number;
  gancho: boolean;
  // traspasse da conta (aba Fundação, seção 10): o de cada espera (mm) e, para as outras emendas, o α0t e o ℓb em
  // diâmetros no graute e no concreto da sapata
  l0t: { v: number | null; pv: number | null; cf: number | null; cc: number | null };
  a0t: number | null; lbphi_gr: number | null; lbphi_c: number | null;
  // nomes modulares da planilha (quando ela publicar)
  pl: { m_mod: number | null; l_cf_adot: number | null; tenr_adot: number | null; H_muro_des: number | null; n_fiadas: number | null };
  // entradas do modelo
  L_total: number; junta_cada: number; cinta: boolean; phi_cinta: number; traspasse: number | null;
  sapTransv: 'estribo' | 'reta';       // transversal da sapata: estribo fechado (padrão, 15/10) ou a barra reta de antes
  arranque: 'padrao' | 'no';           // espera: a de sempre ou o nó de cachorro (forma a confirmar no Revit)
  barbaca: boolean; barbaca_phi: number; barbaca_s: number;
  dreno: boolean; dreno_esp: number; dreno_folga: number;
  drenof: boolean; drenof_phi: number; drenof_env: number; areia_esp: number;
  h_fr: number;                        // mm — aterro sobre a ponta (solo da frente acima do topo da sapata)
  extras: Record<string, Valor>;
}

export function lerParametros(r: Resultado, extrasIn: Record<string, Valor>, avisos: Aviso[]): Parametros {
  const n = (nome: string): number | null => comoNumero(lerValor(r, nome));
  const txt = (nome: string): string => comoTexto(lerValor(r, nome));
  const faltou = new Set<string>();
  // valor de obra quando a conta não respondeu — com aviso, porque é DEDUÇÃO nossa e não a conta
  const ou = (nome: string, padrao: number): number => {
    const v = n(nome);
    if (v === null) {
      faltou.add(nome);
      return padrao;
    }
    return v;
  };

  const extras: Record<string, Valor> = { ...padroesDoModelo(), ...extrasIn };
  const xn = (nome: string, padrao: number): number => comoNumero(extras[nome]) ?? padrao;
  const sim = (nome: string): boolean => comoTexto(extras[nome]).trim().toLowerCase().startsWith('s');

  const cm = (v: number | null): number | null => (v === null ? null : v * 10);
  const m_ = (v: number | null): number | null => (v === null ? null : v * 1000);

  // Duas alturas desde 09/10: o muro (H_muro) e o solo contido (H_solo ≤ H_muro). Solo sem valor (campo apagado,
  // Resultado antigo sem o nome) = solo no topo do muro, que era a regra de antes.
  const H_muro = ou('H_muro', 1.6) * 1000;
  const solo = n('H_solo');
  const p: Parametros = {
    t_bloco: ou('t_bloco', 19),
    L_bloco: ou('L_bloco', 39),
    // graute a cada X cm (Jose, 13/10): 20 = todos os furos; a planilha publica o "Sim" em gr_tot
    grauteTotal: txt('gr_tot').trim() === 'Sim' || (n('Graute') ?? 40) <= 20,
    s_graute: (n('Graute') ?? 40) * 10,
    contrafortes: txt('Tipo_muro').trim().toLowerCase().startsWith('contra'),
    H_muro,
    H_solo: solo !== null && solo > 0 ? Math.min(solo * 1000, H_muro) : H_muro,

    phi_v: ou('phi_v', 10),
    s_vert: cm(n('s_adot')),
    d_util: cm(n('d_util')),
    s_can_bal: m_(n('h_pan')),
    lb: cm(n('lb_adot')),

    l_cf: ou('l_cf', 1.5) * 1000,
    tenr: ou('tenr_', 59) * 10,
    eenr: (n('eenr') ?? n('t_bloco') ?? 19) * 10,
    enterrado: !txt('pos_cf').trim().toLowerCase().startsWith('apar'),
    bal_cf: (n('bal_cf') ?? 0) * 1000,
    phi_cf: ou('phi_cf', 10),
    n_cf: Math.max(1, Math.round(ou('n_cf', 2))),
    c_cf: cm(n('c_cf')),
    phi_cc: ou('phi_cc', 10),
    n_cc: Math.max(0, Math.round(n('n_cc') ?? 2)),
    phi_est: ou('phi_est', 6.3),
    s_est: cm(n('s_est')),
    ramos_est: Math.max(2, Math.round(n('ramos_est') ?? 2)),
    // Estribo só quando a conta pede (Jose, 13/10; planilha 05 do Carini): Asw_c = 0 é "dispensa pela conta".
    // Conta sem número ("—": a seção não resiste e o cortante nem chega a ser decidido) continua desenhando o
    // estribo, como antes — sumir com ele ali esconderia a peça justo no muro que precisa de revisão.
    estribos: n('Asw_c') !== 0,
    phi_pv: ou('phi_pv', 10),
    s_pv: cm(n('s_pv')),
    duasBarrasPv: txt('pos_pv').trim().startsWith('2'),
    c_pv: ou('c_pv', 5) * 10,
    phi_ph: ou('phi_ph', 12.5),
    s_ph: cm(n('s_ph')),
    phCentralizada: !txt('pos_ph').trim().toLowerCase().startsWith('enc') && !txt('pos_ph').trim().startsWith('2'),
    phDuas: txt('pos_ph').trim().startsWith('2'),

    B_sap: ou('B_sap', 1.4) * 1000,
    h_sap: ou('h_sap', 0.3) * 1000,
    a_ater: ou('a_ater', 0.95) * 1000,
    b_den: (n('b_den') ?? 0) * 1000,
    h_den: (n('h_den') ?? 0) * 1000,
    // eixo do dente a partir do centro da sapata, + para o pé (Jose, 13/10)
    x_den: (n('x_den') ?? 0) * 1000,
    cob_sap: ou('cob_sap', 4) * 10,
    phi_sap: ou('phi_sap', 10),
    phi_sap2: ou('phi_sap2', 6.3),
    phi_tor: n('phi_tor') ?? 6.3,
    s_ps: cm(n('s_ps')),
    s_ss: cm(n('s_ss')),
    // O espaçamento do estribo de torção não tem nome definido na aba Fundação: lido pela célula.
    s_tor: cm(comoNumero(r.v('s_tor_f'))),
    Mk_heel: n('Mk_heel') ?? 0,
    T_sd: n('T_sd') ?? 0,
    Asl_s: n('Asl_s') ?? 0,
    gancho: txt('gancho_').trim().toLowerCase().startsWith('s'),
    l0t: { v: cm(n('l0t_v')), pv: cm(n('l0t_pv')), cf: cm(n('l0t_cf')), cc: cm(n('l0t_cc')) },
    a0t: n('a0t'),
    lbphi_gr: n('lbphi_gr'),
    lbphi_c: n('lbphi_c'),

    pl: {
      m_mod: cm(n('m_mod')),
      l_cf_adot: m_(n('l_cf_adot')),
      tenr_adot: cm(n('tenr_adot')),
      H_muro_des: m_(n('H_muro_des')),
      n_fiadas: n('n_fiadas'),
    },

    L_total: xn('L_total', 6) * 1000,
    junta_cada: xn('junta_cada', 0) * 1000,
    cinta: sim('cinta_topo'),
    phi_cinta: xn('phi_cinta', 10),
    traspasse: comoNumero(extras.traspasse_dir) === null ? null : (comoNumero(extras.traspasse_dir) as number) * 10,
    sapTransv: comoTexto(extras.sap_transv).trim().toLowerCase().startsWith('r') ? 'reta' : 'estribo',
    arranque: comoTexto(extras.arranque).trim().toLowerCase().startsWith('n') ? 'no' : 'padrao',
    barbaca: sim('barbaca_on'),
    barbaca_phi: xn('barbaca_phi', 50),
    barbaca_s: xn('barbaca_s', 1.5) * 1000,
    dreno: sim('dreno_on'),
    dreno_esp: xn('dreno_esp', 0.2) * 1000,
    dreno_folga: xn('dreno_folga', 0.3) * 1000,
    drenof: sim('drenof_on'),
    drenof_phi: xn('drenof_phi', 100),
    drenof_env: xn('drenof_env', 0.3) * 1000,
    areia_esp: Math.max(0, xn('areia_esp', 0.1)) * 1000,
    // O solo da frente está lá com ou sem a garantia da conta (pass_on só decide se ele CONTA): o barbacã sai
    // acima dele e o 3D o desenha sempre.
    h_fr: Math.max(0, n('h_fr') ?? 0) * 1000,
    extras,
  };

  // Só reclama do que aquele tipo de muro usa.
  const doBalanco = new Set(['phi_v']);
  const doCf = new Set(['l_cf', 'tenr_', 'phi_cf', 'n_cf', 'phi_est', 'phi_pv', 'c_pv', 'phi_ph']);
  const relevantes = [...faltou].filter((x) => (p.contrafortes ? !doBalanco.has(x) : !doCf.has(x)));
  if (relevantes.length) {
    avisos.push({ codigo: 'CONTA_SEM_VALOR', texto: `Sem valor na conta: ${relevantes.join(', ')} (desenhado com valor de obra)` });
  }
  return p;
}
