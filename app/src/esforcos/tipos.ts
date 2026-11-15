/*
  O CONTRATO DA VISTA "ESFORÇOS".

  1ª versão (15/11): MSd cheio e MRd em linha. O Jose viu e disse que não era isso: "quando falei sobre esforço
  solicitante e esforço resistente gostaria de visualizar algo nesse sentido" (o diagrama do Pró-Viga) — "o
  solicitante de uma cor e o resistente englobando ele". 2ª versão (15/11): em cada barra, deitado no plano de flexão,
  o AÇO — o necessário (vermelho, conta da planilha) por dentro e o colocado (verde, as barras do modelo) envolvendo;
  no cortante, o mesmo par (VSd × VRd, ou Asw/s necessário × colocado).

  Uma BarraAnalitica é uma peça que a conta dimensiona, reduzida ao eixo (como a barra do pórtico no A-PORT). Quem
  fabrica é `barrasAnaliticas.ts`: o necessário é célula com nome (ou nó de intervalo com nome), só trocado de unidade;
  o colocado é a geometria das barras (`acoColocado.ts`). Quem desenha (cenaDosEsforcos.ts) não sabe de onde o número
  veio — só o eixo, os lados e as curvas.

  UNIDADES: geometria em mm, nos eixos do modelo (modelo/tipos.ts: X ao longo do muro, Y da face aparente para o solo,
  Z para cima, 0 no topo da sapata). Valores na unidade da tela (`unidade` do diagrama).
*/
import type { Vec3 } from '@/modelo/tipos';
import type { FamiliaNoDiagrama, PontoDoDiagrama } from './acoColocado';

export type { FamiliaNoDiagrama, PontoDoDiagrama } from './acoColocado';

export type ModoDosEsforcos = 'flexao' | 'cortante';
export type UnidadeDoDiagrama = 'cm²/m' | 'cm²' | 'kN·m/m' | 'kN·m' | 'kN/m' | 'kN';
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
 * se eu quero ver só painéis?"). O muro de cima em três (Jose, 15/11, depois): painéis, cintas e pilaretes (com a
 * ligação no arrimo).
 */
export type GrupoDeBarra = 'parede' | 'contrafortes' | 'paineis' | 'canaletas' | 'sapata' | 'dente' | 'mcPaineis' | 'mcCintas' | 'mcPilaretes';

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
  pilarete: 'mcPilaretes',
  ligacao: 'mcPilaretes',
  painelMc: 'mcPaineis',
  cintaMc: 'mcCintas',
};

/** Os grupos na ordem do menu, com o nome da tela. */
export const GRUPOS: readonly { id: GrupoDeBarra; rotulo: string }[] = [
  { id: 'parede', rotulo: 'Parede' },
  { id: 'contrafortes', rotulo: 'Contrafortes' },
  { id: 'paineis', rotulo: 'Painéis' },
  { id: 'canaletas', rotulo: 'Canaletas e cinta' },
  { id: 'sapata', rotulo: 'Sapata' },
  { id: 'dente', rotulo: 'Dente' },
  { id: 'mcPaineis', rotulo: 'Muro de cima: painéis' },
  { id: 'mcCintas', rotulo: 'Muro de cima: cintas' },
  { id: 'mcPilaretes', rotulo: 'Muro de cima: pilaretes' },
];

export const ehGrupo = (x: unknown): x is GrupoDeBarra => GRUPOS.some((g) => g.id === x);

/** O grupo único do muro de cima, de antes de ele virar três (guardado na vista e nas pranchas até 15/11). */
const MURO_DE_CIMA_ANTIGO = 'muroDeCima';

/**
 * Os grupos desligados guardados (na vista ou na prancha): só os que existem, sem repetir; o "Muro de cima" antigo
 * desligado vira os três dele desligados.
 */
export function lerGrupos(x: unknown): GrupoDeBarra[] {
  if (!Array.isArray(x)) return [];
  const out = new Set<GrupoDeBarra>();
  for (const g of x) {
    if (g === MURO_DE_CIMA_ANTIGO) for (const n of ['mcPaineis', 'mcCintas', 'mcPilaretes'] as const) out.add(n);
    else if (ehGrupo(g)) out.add(g);
  }
  return GRUPOS.map((g) => g.id).filter((g) => out.has(g));
}

/** Um número escrito na tela, e a célula de onde ele saiu (o teste confere um com o outro). */
export interface Pico {
  s: number;
  /** ≥ 0, na unidade do diagrama. */
  valor: number;
  /** 'nec' = necessário (planilha); 'col' = colocado (modelo, ou planilha na barra esquemática); 'min' = As,mín. */
  qual: 'nec' | 'col' | 'min';
  face: 1 | -1;
  /** O nome definido da planilha; `celula` quando o número é um nó de intervalo ('Fundação!O149'). Ausente no
   * colocado que vem do modelo — então `planilha` diz o nome com que ele deve bater. */
  nome?: string;
  celula?: string;
  planilha?: string;
  /** Unidade da planilha → unidade da tela (kN·cm → kN·m: 0,01). */
  fator: number;
}

/** Um lado da barra: o lado `face` do vetor `lado` (1 = o lado, −1 = o oposto). */
export interface FaceDoDiagrama {
  face: 1 | -1;
  /** O necessário (vermelho), v ≥ 0. */
  necessario: PontoDoDiagrama[];
  /** Trechos em que a planilha diz "não resiste" (há esforço e não há aço que dê): vermelho cheio. */
  naoResiste: [number, number][];
  /** O colocado (verde), v ≥ 0. */
  colocado: PontoDoDiagrama[];
  /** O contorno tracejado de cada posição (N) que entra no colocado. */
  familias: FamiliaNoDiagrama[];
  /** A linha do mínimo (As,mín, Asw,mín), ou null. */
  minimo: number | null;
}

export interface Diagrama {
  unidade: UnidadeDoDiagrama;
  faces: FaceDoDiagrama[];
  picos: Pico[];
  /**
   * Só os picos são da conta e a curva entre eles é ilustrativa (painel por tabela de placa, canaleta, cinta,
   * ligação): a tela desenha o contorno tracejado.
   */
  esquematico: boolean;
  /**
   * mm junto da ponta LIVRE (o fim da barra: o topo do muro, a ponta da sapata, o fundo do dente) que não se compara:
   * é o cobrimento depois da última barra, onde a conta pede um resto de aço (centésimos de cm²) que nenhuma barra
   * alcança. Lá o vermelho que sobra fica no tom normal, não no de falta.
   */
  fimLivre: number;
  /** O verde envolve o vermelho em toda a barra, fora do `fimLivre` (e não há trecho "não resiste"). */
  envolve: boolean;
}

export interface BarraAnalitica {
  id: string;
  tipo: TipoDeBarra;
  grupo: GrupoDeBarra;
  /** Rótulo curto da peça ("Contraforte 2", "Canaleta 3ª fiada · vão 1"). */
  nome: string;
  /** O card da memória onde a conta dessa peça está (Card.id). */
  card: string;
  trecho: number;
  de: Vec3;
  ate: Vec3;
  /** Unitário, perpendicular ao eixo: o lado da face 1 (a face TRACIONADA pelo esforço principal). */
  lado: Vec3;
  flexao: Diagrama | null;
  cortante: Diagrama | null;
  /** A leitura do clique: MSd e MRd da planilha (nomes), com a unidade; As na seção crítica. */
  leitura: {
    msd: number | null;
    mrd: number | null;
    unidade: UnidadeDoMomento;
    nomes: string[];
    /** As necessário (planilha) e colocado (desenho) na seção crítica, na unidade do diagrama de flexão. */
    asNec: number | null;
    asEf: number | null;
  };
  /** MSd/MRd da planilha (o pior `ap_*` da peça). */
  aproveitamento: number | null;
  nomesDoAproveitamento: string[];
  /** aproveitamento ≤ 1 (null sem aproveitamento publicado). */
  passa: boolean | null;
}

/** O diagrama da barra no modo. */
export const diagramaDe = (b: BarraAnalitica, modo: ModoDosEsforcos): Diagrama | null => (modo === 'flexao' ? b.flexao : b.cortante);

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
