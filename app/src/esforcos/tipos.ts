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
  | 'painelMc'         // painéis A/B do muro de cima
  | 'cintaMc';         // cintas do muro de cima: cada uma com a flexão lateral e a de gravidade

/**
 * O GRUPO da barra: o que o "Mostrar" da vista liga e desliga (Jose, 15/11: "dá pra isolar por esforço? por exemplo
 * se eu quero ver só painéis?"). Um grupo por tipo de peça que o engenheiro reconhece no muro.
 */
export type GrupoDeBarra = 'parede' | 'contrafortes' | 'paineis' | 'canaletas' | 'sapata' | 'dente' | 'muroDeCima';

/** O grupo de cada tipo de barra (todo tipo tem um). */
export const GRUPO_DO_TIPO: Readonly<Record<TipoDeBarra, GrupoDeBarra>> = {
  balanco: 'parede',
  contraforte: 'contrafortes',
  painelVertical: 'paineis',
  naoArmado: 'paineis',
  canaleta: 'canaletas',
  cinta: 'canaletas',
  ponta: 'sapata',
  talao: 'sapata',
  dente: 'dente',
  pilarete: 'muroDeCima',
  ligacao: 'muroDeCima',
  painelMc: 'muroDeCima',
  cintaMc: 'muroDeCima',
};

/** Os grupos na ordem do menu, com o nome da tela. */
export const GRUPOS: readonly { id: GrupoDeBarra; rotulo: string }[] = [
  { id: 'parede', rotulo: 'Parede' },
  { id: 'contrafortes', rotulo: 'Contrafortes' },
  { id: 'paineis', rotulo: 'Painéis' },
  { id: 'canaletas', rotulo: 'Canaletas e cinta' },
  { id: 'sapata', rotulo: 'Sapata' },
  { id: 'dente', rotulo: 'Dente' },
  { id: 'muroDeCima', rotulo: 'Muro de cima' },
];

export const ehGrupo = (x: unknown): x is GrupoDeBarra => GRUPOS.some((g) => g.id === x);

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
  /** O grupo do "Mostrar" (GRUPO_DO_TIPO). */
  grupo: GrupoDeBarra;
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

/** Os grupos que o muro tem, na ordem do menu. */
export function gruposPresentes(barras: readonly BarraAnalitica[]): GrupoDeBarra[] {
  const tem = new Set(barras.map((b) => b.grupo));
  return GRUPOS.map((g) => g.id).filter((g) => tem.has(g));
}

/** As barras sem os grupos desligados. */
export function filtrarPorGrupo(barras: readonly BarraAnalitica[], ocultos: readonly GrupoDeBarra[]): BarraAnalitica[] {
  if (!ocultos.length) return [...barras];
  const fora = new Set(ocultos);
  return barras.filter((b) => !fora.has(b.grupo));
}
