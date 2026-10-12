// ═══════════════════════════════════════════════════════════════════════════
//  estado/abas.ts — onde cada entrada mora na tela (Jose, 12/10)
// ---------------------------------------------------------------------------
//  Até 12/10 as seções da tela eram as faixas da aba Entradas da planilha
//  (Geometria, Alvenaria e aço, Ancoragem, Painel não armado, ELS, Modelo...).
//  A proposta aprovada em 12/10 (https://claude.ai/artifact/XxiHij7TtwkNdtg5CrHmnw)
//  troca isso pela ORDEM EM QUE O ENGENHEIRO LANÇA O MURO: o muro, o solo, os
//  materiais, a armadura, a fundação, a drenagem — e o que é critério de norma,
//  que quase nunca muda, numa aba própria no fim. A planilha NÃO muda: ela
//  continua com as faixas dela; isto é só a arrumação da tela, e vale igual para
//  a lista da esquerda e para a entrada por figuras (aprendeu uma, sabe a outra).
//
//  Dentro de cada aba, as entradas vêm em GRUPOS com subtítulo. Grupo ou entrada
//  com `soCom` só aparece com aquele tipo de muro: a armadura do balanço e a do
//  contraforte não convivem na tela (antes uma ficava apagada embaixo da outra).
//  O apagado continua valendo para o que depende de outra escolha da MESMA tela
//  (αv sem travamento, NA sem água), para a linha não pular debaixo do mouse.
//
//  Entrada que a planilha criar e que não estiver aqui não some: vai para o fim
//  (montarSecoes); o teste acusa, para ela ganhar lugar.
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeMuro = 'Balanço' | 'Contrafortes';

/** Entrada com tipo de muro: [nome, só com este tipo]. */
type Item = string | readonly [string, TipoDeMuro];

export interface Grupo {
  titulo: string;
  soCom?: TipoDeMuro;
  campos: readonly Item[];
}

export interface Aba {
  id: string;
  titulo: string;
  soCom?: TipoDeMuro;
  grupos: readonly Grupo[];
}

const B = 'Balanço' as const;
const C = 'Contrafortes' as const;

export const ABAS: readonly Aba[] = [
  {
    id: 'muro', titulo: 'Muro', grupos: [
      { titulo: 'Tipo e bloco', campos: ['Tipo_muro', 't_bloco'] },
      { titulo: 'Medidas', campos: ['H_muro', 'L_total', 'junta_cada'] },
      { titulo: 'Topo', campos: ['cinta_topo', 'phi_cinta'] },
      { titulo: 'Travamento lateral', campos: ['Trav_lat', 'alfa_v', 'alfa_h', 'l_trav'] },
      { titulo: 'Contrafortes', soCom: C, campos: ['l_cf', 'tenr_', 'pos_cf'] },
    ],
  },
  {
    id: 'solo', titulo: 'Solo e cargas', grupos: [
      { titulo: 'Solo contido', campos: ['H_solo', 'Tipo_solo', 'NSPT', 'Umidade', 'Classe_G', 'gama_solo', 'phi_solo', 'c_solo', 'Ka_dir'] },
      { titulo: 'Sobrecarga', campos: ['q_sobre'] },
      { titulo: 'Água', campos: ['Agua', 'z_NA', 'gama_w'] },
      { titulo: 'Solo da frente', campos: ['pass_on'] },
    ],
  },
  {
    id: 'materiais', titulo: 'Materiais', grupos: [
      { titulo: 'Alvenaria', campos: ['fbk_', 'fpk_ref', 'fgk_dir', 'arg_cls'] },
      { titulo: 'Peso próprio', campos: ['reb_fac', 'reb_esp', 'peso_par', ['gama_cf', C]] },
      { titulo: 'Concreto e aço', campos: ['fck_fund', 'gama_c', 'fyk_'] },
    ],
  },
  {
    id: 'armadura', titulo: 'Armadura', soCom: B, grupos: [
      { titulo: 'Seção', campos: ['Graute', 'bw_dir'] },
      { titulo: 'Barras verticais', campos: ['phi_v', 's_dir', 'd_dir'] },
      { titulo: 'Canaletas', campos: ['h_pan'] },
    ],
  },
  {
    id: 'contraforte', titulo: 'Contraforte', soCom: C, grupos: [
      { titulo: 'Contraforte calculado', campos: ['tipo_cf', 'bal_cf'] },
      { titulo: 'Armadura principal', campos: ['phi_cf', 'n_cf_dir', 'c_cf_dir'] },
      { titulo: 'Barras construtivas', campos: ['phi_cc', 'n_cc'] },
      { titulo: 'Estribos', campos: ['phi_est', 'ramos_est', 's_est'] },
    ],
  },
  {
    id: 'painel', titulo: 'Painel', soCom: C, grupos: [
      { titulo: 'Bordas', campos: ['lat_pan'] },
      { titulo: 'Barras verticais', campos: ['phi_pv', 's_pv_dir', 'pos_pv', 'c_pv'] },
      { titulo: 'Canaletas', campos: ['phi_ph', 's_ph_dir', 'pos_ph'] },
    ],
  },
  {
    id: 'fundacao', titulo: 'Fundação', grupos: [
      { titulo: 'Geometria', campos: ['B_sap', 'h_sap', 'a_ater', 'b_den', 'h_den'] },
      { titulo: 'Cargas', campos: ['P_topo', 'q_est'] },
      { titulo: 'Solo de apoio', campos: ['SPT_b', 'sig_adm_dir', 'phi_base', 'dphi', 'ades_b'] },
      { titulo: 'Espera', campos: ['zona_ad', 'gancho_', 'traspasse_dir'] },
      { titulo: 'Armadura da sapata', campos: ['cob_sap', 'phi_sap', 'phi_sap2', ['phi_tor', C]] },
    ],
  },
  {
    id: 'drenagem', titulo: 'Drenagem', grupos: [
      { titulo: 'Barbacãs', campos: ['barbaca_on', 'barbaca_phi', 'barbaca_s'] },
      { titulo: 'Dreno', campos: ['dreno_on', 'dreno_esp', 'dreno_folga'] },
      { titulo: 'Impermeabilização', campos: ['imper_on'] },
    ],
  },
  {
    id: 'criterios', titulo: 'Critérios de cálculo', grupos: [
      { titulo: 'Norma', campos: ['gama_f', 'gama_m', 'gama_s', 'FS_tomb', 'FS_desl'] },
      { titulo: 'Flexão', campos: [['K_dir', B], ['K_cf', C], ['K_pv', C], ['K_ph', C], 'AsMin_crit', ['M2d_on', B]] },
      { titulo: 'ELS', campos: ['psi_els', 'div_adm', 'vao_ref', 'dxi', ['sg_on', B], ['bwv_dir', C], ['bwh_els', C]] },
      { titulo: 'Painel não armado', soCom: B, campos: ['caso_pan', 'beta_dir', 'sig_pan'] },
    ],
  },
];

/** Onde a entrada mora: aba, grupo e tipo de muro (o da entrada, senão o do grupo, senão o da aba). */
export interface Lugar {
  aba: Aba;
  ordemDaAba: number;
  grupo: string;
  soCom?: TipoDeMuro;
  /** Posição na tela, contando todas as abas: ordena as entradas dentro da aba. */
  posicao: number;
}

export const LUGAR: ReadonlyMap<string, Lugar> = (() => {
  const m = new Map<string, Lugar>();
  let posicao = 0;
  ABAS.forEach((aba, i) => {
    for (const g of aba.grupos) {
      for (const item of g.campos) {
        const [nome, so] = typeof item === 'string' ? [item, undefined] : item;
        if (m.has(nome)) throw new Error(`entrada em dois lugares da tela: ${nome}`);
        m.set(nome, { aba, ordemDaAba: (i + 1) * 10, grupo: g.titulo, soCom: so ?? g.soCom ?? aba.soCom, posicao: posicao++ });
      }
    }
  });
  return m;
})();
