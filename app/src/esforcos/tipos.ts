/*
  O CONTRATO DA VISTA "ESFORÇOS" (Jose, 15/11: "um diagrama em 2D, só que num esquema 3D com barras analíticas… cada
  barrinha com o seu desenho de momento solicitante e momento resistente").

  Uma BarraAnalitica é uma peça que a conta dimensiona, reduzida ao eixo (como a barra do pórtico no A-PORT), com o
  diagrama de MSd e a linha de MRd deitados no plano de flexão dela. Quem fabrica é `barrasAnaliticas.ts`, que só
  LÊ a planilha: todo número daqui é célula com nome (ou nó de intervalo com nome), no máximo trocado de unidade.
  Quem desenha (VistaDeEsforcos.tsx) não sabe de onde o número veio — só o eixo, o lado e as estações.

  UNIDADES: geometria em mm, nos eixos do modelo (modelo/tipos.ts: X ao longo do muro, Y da face aparente para o
  solo, Z para cima, 0 no topo da sapata). Momento já na unidade da tela (`unidade`).
*/
import type { Vec3 } from '@/modelo/tipos';

export type UnidadeDoMomento = 'kN·m/m' | 'kN·m';

export type TipoDeBarra =
  | 'balanco'          // faixa vertical de 1 m do muro em balanço
  | 'contraforte'      // haste de cada contraforte
  | 'painelVertical'   // faixa vertical no meio do vão entre contrafortes
  | 'canaleta'         // barra horizontal de cada fiada de canaleta entre dois contrafortes
  | 'cinta'            // a canaleta do topo do arrimo
  | 'naoArmado'        // painel não armado (balanço e subpainel entre contrafortes), as duas direções
  | 'ponta' | 'talao'  // a sapata em balanço a partir da face do muro
  | 'dente'
  | 'pilarete' | 'ligacao'   // muro de cima: o pilarete e a ligação dele no arrimo
  | 'painelMc';        // painéis A/B do muro de cima

/**
 * Uma estação ao longo do eixo. `s` = mm a partir do começo (`de`). `msd` com sinal: + = tração do lado `lado` da
 * barra, − = do outro. `mrd` = o resistente do lado +, `mrdOposto` = o do lado −, os dois ≥ 0; null = a conta não
 * dimensiona aquele lado (não há linha nem vermelho ali).
 */
export interface Estacao {
  s: number;
  msd: number;
  mrd: number | null;
  mrdOposto: number | null;
}

/** O número escrito na tela, e a célula de onde ele saiu (o teste confere um com o outro). */
export interface Pico {
  s: number;
  /** Valor com sinal, já na unidade da tela (+ do lado `lado`). */
  valor: number;
  qual: 'msd' | 'mrd';
  /** O nome definido da planilha; `celula` quando o número é um nó de intervalo ('Fundação!K149'). */
  nome: string;
  celula?: string;
  /** Unidade da planilha → unidade da tela (kN·cm → kN·m: 0,01). */
  fator: number;
}

export interface BarraAnalitica {
  id: string;
  tipo: TipoDeBarra;
  /** Rótulo curto da peça ("Contraforte 2", "Canaleta 3ª fiada · vão 1"). */
  nome: string;
  /** O card da memória onde a conta dessa peça está (Card.id). */
  card: string;
  trecho: number;
  de: Vec3;
  ate: Vec3;
  /** Unitário, perpendicular ao eixo: para onde se desenha o momento positivo (a face TRACIONADA). */
  lado: Vec3;
  estacoes: Estacao[];
  unidade: UnidadeDoMomento;
  picos: Pico[];
  /** MSd/MRd da planilha (o pior `ap_*` da peça). */
  aproveitamento: number | null;
  /** Os nomes `ap_*` que deram o aproveitamento. */
  nomesDoAproveitamento: string[];
  /** aproveitamento ≤ 1 (null sem aproveitamento publicado). */
  passa: boolean | null;
  /**
   * Há MSd mas a planilha não chega a um MRd (painel sem arranjo que resista, seção sem d): a peça reprova na aba e
   * a tela pinta o diagrama todo de vermelho, sem linha de MRd.
   */
  semMRd: boolean;
  /**
   * Só os picos são da conta e a curva entre eles é ilustrativa (painel por tabela de placa, canaleta, cinta,
   * ligação): a tela desenha com traço fino e tracejado.
   */
  esquematico: boolean;
}
