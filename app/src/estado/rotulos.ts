// ═══════════════════════════════════════════════════════════════════════════
//  estado/rotulos.ts — o nome curto que a tela dá a cada entrada e a cada seção
// ---------------------------------------------------------------------------
//  O rótulo da planilha é frase ("Cobrimento ao eixo das barras (da ponta) —
//  opcional", 51 letras), e a coluna do painel cabe ~22. Cortar com
//  reticências esconderia justamente a palavra que distingue um campo do
//  vizinho. Então cada entrada ganha um rótulo CURTO escrito à mão, com o
//  SÍMBOLO da memória de cálculo sempre que existe (h, t, γ, φ', Ka, q, eenr,
//  tenr, B…): o símbolo amarra o painel ao glossário da memória. O rótulo
//  completo e a observação da planilha vão no `title` (pairar), nunca na tela.
//
//  O que sai: "— opcional" (o campo vazio já diz "auto"), "(aula 12.3)",
//  "(roteiro do Eng. Gilberto…)". Citação de fonte é da memória, não do painel.
//
//  Entrada nova na planilha que ainda não está aqui não quebra nada: cai no
//  `rotuloDeReserva`, que limpa o rótulo da planilha. O teste acusa a falta.
// ═══════════════════════════════════════════════════════════════════════════

/** Rótulo curto por nome definido (planilha) ou nome do modelo. */
export const ROTULO_CURTO: Record<string, string> = {
  // ── Geometria
  H_muro: 'Altura do muro',
  H_solo: 'Altura de solo',
  t_bloco: 'Espessura do bloco t',
  Graute: 'Graute a cada',
  bw_dir: 'Alma da seção I bw',
  Tipo_muro: 'Tipo de muro',
  Trav_lat: 'Travamento lateral',
  alfa_v: 'αv',
  alfa_h: 'αh',
  l_trav: 'Entre travamentos l',

  // ── Solo e cargas
  Tipo_solo: 'Tipo de solo',
  NSPT: 'NSPT',
  Umidade: 'Umidade (areia)',
  Classe_G: 'Classe do solo',
  gama_solo: 'Peso específico γ',
  phi_solo: "Ângulo de atrito φ'",
  Ka_dir: 'Coeficiente Ka',
  c_solo: "Coesão c'",
  q_sobre: 'Sobrecarga q',
  Agua: 'Água no solo',
  z_NA: 'Profundidade do NA',
  gama_w: 'γw',

  // ── Alvenaria e aço
  fbk_: 'fbk',
  fpk_ref: 'Área de referência fpk',
  reb_fac: 'Reboco',
  reb_esp: 'Espessura do reboco',
  peso_par: 'Peso da parede',
  fyk_: 'fyk',
  fgk_dir: 'fgk do graute',
  phi_v: 'Ø vertical',
  s_dir: 'Espaçamento s',
  d_dir: 'Altura útil d',
  K_dir: 'K do balanço',
  AsMin_crit: 'Critério As,mín',
  M2d_on: 'Somar M2d',

  // ── Ancoragem na fundação
  fck_fund: 'Concreto',
  zona_ad: 'Zona de aderência',
  gancho_: 'Gancho na espera',

  // ── Painel não armado
  h_pan: 'Entre canaletas h',
  arg_cls: 'Argamassa',
  caso_pan: 'Caso de vinculação',
  beta_dir: 'βf',
  sig_pan: 'Pré-compressão σ',

  // ── ELS
  psi_els: 'Ma/Mk',
  div_adm: 'Limite: vão /',
  vao_ref: 'Vão do balanço',
  dxi: 'Fluência Δξ',
  sg_on: 'Somar σsg',

  // ── Contrafortes
  l_cf: 'Eixo a eixo l',
  tenr_: 'Comprimento tenr',
  pos_cf: 'Posição',
  tipo_cf: 'Contraforte calculado',
  bal_cf: 'Balanço na ponta',
  phi_cf: 'Ø principal',
  n_cf_dir: 'Nº de barras',
  c_cf_dir: 'Cobrimento ao eixo',
  K_cf: 'K do contraforte',
  phi_cc: 'Ø construtivas',
  n_cc: 'Nº construtivas',
  phi_est: 'Ø do estribo',
  ramos_est: 'Ramos do estribo',
  s_est: 'Espaçamento do estribo',

  // ── Painel entre contrafortes
  lat_pan: 'Bordas laterais',
  phi_pv: 'Ø vertical',
  s_pv_dir: 'Espaçamento vertical',
  pos_pv: 'Barras verticais',
  c_pv: 'Cobrimento ao eixo',
  phi_ph: 'Ø horizontal',
  s_ph_dir: 'Entre canaletas',
  pos_ph: 'Barra horizontal',
  K_pv: 'K do painel vertical',
  K_ph: 'K do painel horizontal',
  bwv_dir: 'ELS: alma vertical bw',
  bwh_els: 'ELS: canaleta bw',

  // ── Fundação
  B_sap: 'Largura B',
  h_sap: 'Altura da sapata',
  a_ater: 'Borda aterrada ao eixo',
  b_den: 'Dente: largura',
  x_den: 'Dente: x do centro',
  h_den: 'Dente: altura',
  gama_c: 'γ do concreto',
  gama_cf: 'γ do contraforte',
  P_topo: 'Carga no topo P',
  q_est: 'q sobre o talão',
  phi_base: "φ' da base",
  dphi: "δ/φ'",
  ades_b: 'Adesão na base',
  pass_on: 'Frente garantida',
  h_fr: 'Aterro sobre a ponta',
  SPT_b: 'SPT da base',
  sig_adm_dir: 'σadm',
  ks_dir: 'k do solo',
  FS_tomb: 'FS tombamento',
  FS_desl: 'FS deslizamento',
  cob_sap: 'Cobrimento',
  phi_sap: 'Ø transversal',
  phi_sap2: 'Ø longitudinal',
  phi_tor: 'Ø estribo de torção',

  // ── Coeficientes
  gama_f: 'γf',
  gama_m: 'γm',
  gama_s: 'γs',

  // ── Modelo (entradas que só o 3D, os desenhos e o quantitativo usam)
  L_total: 'Comprimento do muro',
  junta_cada: 'Junta a cada',
  cinta_topo: 'Cinta no topo',
  phi_cinta: 'Ø da cinta',
  traspasse_dir: 'Traspasse',

  // ── Drenagem
  barbaca_on: 'Barbacãs',
  barbaca_phi: 'Ø do barbacã',
  barbaca_s: 'Espaçamento',
  dreno_on: 'Dreno no tardoz',
  dreno_esp: 'Espessura do dreno',
  dreno_folga: 'Abaixo do topo',
  imper_on: 'Impermeabilização',
};

/**
 * O rótulo da planilha, limpo, para a entrada que ainda não tem rótulo curto:
 * sem "— opcional", sem parênteses de fonte e sem o "?" de pergunta.
 */
export function rotuloDeReserva(rotulo: string): string {
  return rotulo
    .replace(/\s*[—-]\s*opcional\s*$/i, '')
    .replace(/\s*\(opcional\)\s*/i, ' ')
    .replace(/\?\s*$/, '')
    .trim();
}

export function rotuloCurto(nome: string, rotulo: string): string {
  return ROTULO_CURTO[nome] ?? rotuloDeReserva(rotulo);
}

/*
  Parêntese que CITA FONTE: "(curso)", "(NBR)", "(aula 12.3)", "(Gerscovich,
  RJ)", "(roteiro do Eng. Gilberto…)". O parêntese que DIZ o que é ("(CA-50)",
  "(seção I)", "(lado do solo)", "(2ª ordem)") fica — é parte do nome.
  "(ver Fig. N)" também sai: o botão da figura é quem diz a figura, e a
  revisão achou 14 entradas em que o número do texto não era o do botão.
*/
const PARENTESE_DE_FONTE =
  /\s*\((?:[^()]*\b(?:curso|NBR|aula|Gilberto|ABCP|Gerscovich|manual|slide|planilha)\b[^()]*|\s*ver\s+Fig\.?\s*\d+[^()]*)\)/gi;

/** O texto sem a citação de fonte (e sem "(ver Fig. N)"). */
export function semCitacao(texto: string): string {
  return texto.replace(PARENTESE_DE_FONTE, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * O nome completo da grandeza, para o pairar: o rótulo da planilha sem fonte,
 * sem "— opcional" (o campo vazio já diz "auto") e sem o "?" de pergunta.
 */
export function rotuloCompleto(rotulo: string): string {
  return rotuloDeReserva(semCitacao(rotulo));
}

/** Uma seção do painel: como a tela a chama e onde ela fica na fila. */
export interface DefinicaoDeSecao {
  id: string;
  titulo: string;
  /** Posição no painel (menor sobe). */
  ordem: number;
  /** Só aparece com este tipo de muro. */
  soCom?: 'Contrafortes';
}

/*
  A seção vem da faixa da aba Entradas em que a linha está, e o texto da faixa
  muda quando a planilha muda ("Contrafortes (aula 12.3)"). Por isso a
  identificação é pelo COMEÇO do texto, não pelo texto inteiro: renomear o
  parêntese na planilha não pode jogar o grupo para o fim do painel.

  A ORDEM segue a da planilha, com duas decisões nossas (DEDUÇÃO, a conferir com
  o Jose): o que só o modelo usa (comprimento, juntas, cinta, drenagem) vem
  depois da fundação — primeiro a conta, depois o desenho —, e os coeficientes
  vão para o fim, porque raramente se mexe neles. Aberta ou fechada não é
  daqui: todos os grupos nascem fechados (PainelDeEntradas).
*/
const SECOES: Array<{ comeco: string } & DefinicaoDeSecao> = [
  { comeco: 'Geometria', id: 'geometria', titulo: 'Geometria', ordem: 10 },
  { comeco: 'Solo', id: 'solo', titulo: 'Solo e cargas', ordem: 20 },
  { comeco: 'Alvenaria', id: 'alvenaria', titulo: 'Alvenaria e aço', ordem: 30 },
  { comeco: 'Ancoragem', id: 'ancoragem', titulo: 'Ancoragem na fundação', ordem: 40 },
  { comeco: 'Painel entre barras', id: 'painelNaoArmado', titulo: 'Painel não armado', ordem: 50 },
  { comeco: 'ELS', id: 'els', titulo: 'ELS', ordem: 60 },
  { comeco: 'Contrafortes', id: 'contrafortes', titulo: 'Contrafortes', ordem: 70, soCom: 'Contrafortes' },
  {
    comeco: 'Painel entre contrafortes',
    id: 'painelContrafortes',
    titulo: 'Painel entre contrafortes',
    ordem: 80,
    soCom: 'Contrafortes',
  },
  { comeco: 'Fundação', id: 'fundacao', titulo: 'Fundação', ordem: 90 },
  { comeco: 'Modelo', id: 'modelo', titulo: 'Modelo', ordem: 100 },
  { comeco: 'Drenagem', id: 'drenagem', titulo: 'Drenagem', ordem: 110 },
  { comeco: 'Coeficientes', id: 'coeficientes', titulo: 'Coeficientes', ordem: 120 },
];

/** Seção que a planilha criou e o app ainda não conhece: entra depois das conhecidas da conta, antes do fim. */
const ORDEM_DESCONHECIDA = 500;

export function definicaoDaSecao(secao: string): DefinicaoDeSecao {
  const s = SECOES.find((x) => secao.startsWith(x.comeco));
  if (s) return { id: s.id, titulo: s.titulo, ordem: s.ordem, soCom: s.soCom };
  // O título é o começo da faixa, antes do parêntese ou do travessão da fonte.
  const titulo = secao.split(/\s+[(—]/)[0].trim() || secao;
  return { id: `secao:${titulo}`, titulo, ordem: ORDEM_DESCONHECIDA };
}
