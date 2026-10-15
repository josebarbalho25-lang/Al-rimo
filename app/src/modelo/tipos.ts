/*
  O CONTRATO DO MODELO — o muro peça a peça.

  Quem FABRICA: modulacao/ (entradas + resultado da conta → Modelo). Quem LÊ: visor/ (3D), ifc/, desenhos/,
  quantitativo/. Ninguém além da modulação decide onde fica um bloco: se o 3D, o IFC e o quantitativo
  modulassem cada um por conta própria, cada um mostraria um muro diferente.

  ORDEM OBRIGATÓRIA: modular → calcular → gerar peças. Os valores que não fecham no módulo do bloco (eixo a
  eixo dos contrafortes, comprimento do contraforte, espaçamento das barras) já chegam AJUSTADOS da planilha
  (nomes *_adot, ver abaixo) — a memória calcula o mesmo muro que o 3D desenha.
  ALTURA (Jose, 09/10/2026): duas entradas. H_muro = altura do muro (lista de fiadas inteiras; H_muro_des =
  fiadas × 20 cm é a mesma altura); H_solo = altura de solo contido, ≤ H_muro — até onde vão o aterro e a drenagem.
  (Até 08/10 era uma altura só, de solo, e o muro desenhado subia sozinho até fechar a fiada.)

  Nomes da planilha que a modulação lê (Resultado.v / .num):
    geometria: t_bloco, L_bloco, Graute, Tipo_muro, H_muro, H_solo, H_muro_des, n_fiadas, m_mod
    balanço:   phi_v, s_adot (cm, já múltiplo do módulo), d_util, h_pan (espaçamento das canaletas, m), lb_adot
    contrafortes: l_cf_adot (m), tenr_adot (cm), eenr, pos_cf, tipo_cf, phi_cf, n_cf, c_cf, phi_cc, n_cc,
               phi_est, ramos_est, s_est, phi_pv, s_pv, pos_pv, c_pv, phi_ph, s_ph, pos_ph
    fundação:  B_sap, h_sap, a_ater, b_den, h_den, cob_sap, phi_sap, phi_sap2, phi_tor (+ espaçamentos que a aba publicar)
  E as entradas próprias do modelo (modelo/entradasDoModelo.ts): comprimento, juntas, cinta, drenagem, traspasse.

  UNIDADES: mm em tudo o que é geometria (inteiro sempre que for modular — soma de ponto flutuante não fecha
  módulo). Bitola em mm decimal (6.3, 12.5). Quem precisa de metro (three, IFC) divide na hora.

  EIXOS (globais, destros, Z para cima — os mesmos do A-PORT):
    X ao longo do muro, crescendo para a direita de quem olha o muro DE FORA (face aparente); X = 0 na ponta esquerda.
    Y perpendicular ao muro, positivo para o lado do SOLO; Y = 0 na face aparente, Y = t na face do solo.
    Z vertical; Z = 0 no topo da sapata (base da junta de assentamento da 1ª fiada).
    Fiada i (i = 0 na base): junta em Z ∈ [200i, 200i+10], bloco em Z ∈ [200i+10, 200(i+1)].
*/

export type Vec3 = [number, number, number];          // mm, global
export type Vec2 = [number, number];                  // mm, no plano do perfil

/** Família de blocos em uso. Medidas REAIS (sem junta), mm. */
export interface Familia {
  nome: '14x39' | '19x39';
  t: number;          // largura (espessura do muro)
  L: number;          // bloco inteiro
  Lm: number;         // meio bloco
  m: number;          // meio módulo = (L + 10)/2 — o passo da grade de furos
  h: number;          // altura do bloco (190)
  hf: number;         // espessura da parede do bloco
  junta: number;      // 10
  provisoria?: boolean;  // encaixes do contraforte sem modelo do Jose no Revit (hoje nenhuma: a 14x39 e a 19x39
                         // seguem os gabaritos dele — modulacao/gabaritos.test.ts)
}

/**
 * Forma de uma peça, compartilhada por todas as peças iguais (InstancedMesh no 3D, IfcMappedItem no IFC).
 * Perfil num plano local, extrudado ao longo de `eixo` (local) por `extensao`. Origem local no canto mínimo.
 */
export interface Geometria {
  chave: string;                 // 'bloco 14x19x39', 'graute furo 14x39 h1800', 'sapata'...
  eixo: 'X' | 'Y' | 'Z';         // direção da extrusão, em coordenadas LOCAIS (antes do giro)
  perfil: { contorno: Vec2[]; furos?: Vec2[][] };   // anti-horário; furos horários
  extensao: number;              // mm ao longo do eixo
  volume_mm3: number;            // do perfil × extensão, furos descontados (com `pedacos`: o da união deles)
  catalogo?: string;             // nome comercial: '14x19x39', 'canaleta 19x19x39', 'bloco 54 (amarração em T)'
  /**
   * Só alvenaria (acrescentado pela modulação, 09/10): a classe para pintar por tipo, com as cores que o Jose usa no
   * Revit para a obra entender a montagem (modulacao/catalogo.ts, CORES_DO_JOSE). A canaleta inteira, a meia e as
   * cortadas são uma classe só.
   */
  classe?: ClassePeca;
  /**
   * Peça que não é UM prisma só (acrescentado pela modulação, 09/10 noite): a canaleta com o fundo furado onde sobe a
   * barra vertical e com a parede quebrada no encontro com o contraforte (o T de graute). Na obra é a mesma canaleta
   * comprada, furada ou quebrada no lugar.
   * O SÓLIDO é a união destes pedaços: mesmo `eixo`, contorno no mesmo plano (u, v) e na mesma origem do `perfil`,
   * extrudado de `de` a `ate` ao longo do eixo (0 ≤ de < ate ≤ extensao). Pedaços vizinhos só se encostam.
   * `perfil` e `extensao` continuam sendo o ENVELOPE (a peça inteira, sem furo nem quebra) e a caixa do envelope é a
   * da união — posição, caixa, cor e silhueta saem dele como sempre. Quem desenha o sólido de verdade (IFC, 3D) usa
   * os pedaços. `volume_mm3` é o da UNIÃO (concreto que fica).
   */
  pedacos?: PedacoDePrisma[];
  /**
   * O que SAIU do envelope (acrescentado em 14/10, junto com `pedacos`): um prisma por furo do fundo e por quebra de
   * parede, no mesmo plano (u, v) e na mesma origem do `perfil`, de `de` a `ate`. envelope − recortes = união dos
   * pedaços. O IFC usa isto (U inteiro menos os recortes, uma peça só no Revit — Jose, 14/10: em pedaços aparecia
   * segmentada); o 3D continua nos pedaços. As caixas passam um pouco das faces de fora (para a subtração não ficar
   * com face coincidente) e entram no vazio do U, onde não tiram nada.
   */
  recortes?: PedacoDePrisma[];
}

/** Um pedaço de prisma (ver Geometria.pedacos): contorno anti-horário, extrudado de `de` a `ate`. */
export interface PedacoDePrisma { contorno: Vec2[]; de: number; ate: number }

export type ClassePeca = 'inteiro' | 'meio' | 'canaleta' | 'bloco34' | 'bloco54';

export type TipoPeca =
  | 'BLOCO' | 'MEIO_BLOCO' | 'BLOCO_JUNCAO' | 'BLOCO_CORTADO'
  | 'CANALETA' | 'MEIA_CANALETA' | 'CANALETA_CORTADA'
  | 'GRAUTE_FURO' | 'GRAUTE_CANALETA'
  | 'SAPATA'
  | 'DRENO' | 'AREIA' | 'MANTA' | 'BARBACA' | 'TUBO_DRENO'   // brita, filtro de areia, manta, barbacã, dreno de fundo
  | 'ATERRO' | 'SOLO_FRENTE';   // terreno: só para ver (transparente); fora do IFC e do quantitativo

export type GrupoPeca = 'muro' | 'contraforte' | 'fundacao' | 'drenagem' | 'terreno';

export interface Peca {
  id: string;                    // estável e legível: 'T1.M.f03.p012', 'T1.CF2.f05.p01', 'T1.GF.c017', 'SAP.T1'
  tipo: TipoPeca;
  grupo: GrupoPeca;
  geometria: string;             // chave em Modelo.geometrias
  origem: Vec3;                  // mm: onde o canto mínimo local vai parar (depois do giro)
  giro: 0 | 90 | 180 | 270;      // em torno de Z, graus, aplicado ao perfil local antes de transladar
  trecho: number;                // 1.. (trechos separados por junta de controle)
  fiada?: number;                // 0 na base
  contraforte?: number;          // 1.. ao longo de X
  furosGrauteados?: number[];    // índices dos furos da geometria que levam graute
}

/**
 * HORIZ = barra horizontal de canaleta. Sem `contraforte`: a corrida reta da canaleta do muro. COM `contraforte`
 * (acrescentado pela modulação, 09/10): a barra da canaleta do contraforte, que entra na canaleta do muro dobrada em
 * L e deita ao lado da barra dele (Detalhe 1) — o eixo dela não é reto.
 */
export type PapelBarra =
  | 'VERT_MURO' | 'ESPERA' | 'HORIZ'
  | 'CF_PRINCIPAL' | 'CF_CONSTRUTIVA' | 'CF_ESTRIBO'
  | 'SAP_TRANSV' | 'SAP_LONG' | 'SAP_TORCAO';

export interface Barra {
  id: string;
  posicao: string;               // 'N1', 'N2'... — mesma posição = mesma barra na lista de ferros
  papel: PapelBarra;
  diametro: number;              // mm
  eixo: Vec3[];                  // polilinha do eixo da barra, mm (dobras já discretizadas com o raio do pino)
  fechada?: boolean;             // a polilinha volta ao 1º ponto (quem desenha fecha a volta)
  /**
   * Estribo fechado com os dois ganchos de 135° (acrescentado pela modulação, 15/10 — a forma do Pró-Viga, ver
   * modulacao/barras.ts): o `eixo` vai da ponta de um gancho à do outro, com as dobras e a volta em espiral (anda
   * uma bitola na normal). É polilinha ABERTA — `fechada` fica ausente, senão quem desenha ligaria as duas pontas.
   * Quem precisa saber que a barra é estribo (lista de ferros, tipo SHEAR no IFC) lê este campo, não `fechada`.
   */
  estribo?: boolean;
  comprimento: number;           // desenvolvido, mm
  trecho: number;
  contraforte?: number;
}

/** Valor da entrada que não fechou no módulo e foi ajustado — a tela mostra "1,50 → 1,60". */
export interface Ajuste { nome: string; de: number; para: number; unidade: string }

export interface Aviso { codigo: string; texto: string; ids?: string[] }

export interface Modelo {
  versao: string;                // versão da conta + do gerador de peças
  familia: Familia;
  geometrias: Record<string, Geometria>;
  pecas: Peca[];
  barras: Barra[];
  ajustes: Ajuste[];
  avisos: Aviso[];
  dims: {
    L_real: number;              // comprimento total desenhado, mm
    H_solo: number;              // altura de solo contido (a da conta), mm
    H_muro: number;              // altura do muro desenhado (fiadas × 200), mm
    n_fiadas: number;
    trechos: { x0: number; x1: number }[];
    contrafortes: { x: number; trecho: number; ponta: boolean }[];   // x do eixo, mm
    sapata: { y0: number; y1: number; z0: number; z1: number };      // envoltória da seção, mm
  };
  /**
   * OPCIONAL (acrescentado pela modulação, 08/10): as entradas do modelo efetivamente usadas (padrões de
   * ENTRADAS_DO_MODELO + alterações). Quem só recebe o Modelo precisa de algumas delas — o quantitativo, por
   * exemplo, lê `imper_on` (impermeabilização só entra na quantidade, não vira peça).
   */
  extras?: Record<string, import('@/motor/tipos').Valor>;
}
