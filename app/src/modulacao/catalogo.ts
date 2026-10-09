/*
  CATÁLOGO DE PEÇAS POR FAMÍLIA — dados, não algoritmo.

  DE ONDE VEM CADA MEDIDA
    - 14x39 e 19x39: as famílias do Revit do Jose (dados/encaixes_revit/*.json), peça a peça: paredes, septos, furos e
      volume. Decisão do Jose (09/10): a ÁREA DO FURO sai do bloco desenhado — quem projeta compra o bloco do mercado,
      não o da tabela da aula. Por isso o furo do 3D, do IFC e do quantitativo (graute) é o do Revit, não o calibrado
      no Ag da conta. O Revit não mostra o raio dos cantos do furo: ele sai do VOLUME da família (DEDUÇÃO no raio; a
      área fecha com o volume do Revit, que é o que pesa no graute).
    - Peça sem modelo no Revit (nenhuma hoje): um furo por célula, calibrado no Ag da tabela da aula — perfis.calibrarFuro.
    - Canaleta 14x39 (paredes 25, fundo 39,1) e 19x39 (paredes 25, fundo 29,1 — medida no Revit em 09/10): o volume
      do Revit tem ~1 cm² de seção a mais que o U reto — os dois cantos do fundo são arredondados por dentro ("2 faces
      curvas" na família), e o raio sai do volume, como nos furos.
    - Canaleta cortada: comprimento livre, chave 'canaleta@<mm>' (19, 20, 24 cm nos gabaritos) — não é linha da
      tabela. A SEÇÃO depende da família:
        14x39 — a inteira serrada, mesma seção (conferido no Revit: os cortes de 19, 20 e 24 cm têm 2492, 2624 e
                3148 cm³, o volume da inteira proporcional ao comprimento, ±0,02 %);
        19x39 — peça PRÓPRIA (Jose, 09/10): a família "Canaleta 19 Corte 19cm" tem fundo de 3,91 (a inteira, 2,91),
                paredes 2,5 e 2864 cm³ com 19 cm. Vale para todo comprimento cortado da 19 (o Revit só tem o de 19;
                os outros comprimentos que a modulação corta levam a mesma seção — DEDUÇÃO). Cantos pelo volume.

  ORDEM DOS FUROS NAS PEÇAS ASSIMÉTRICAS (34 e 54): o perfil aqui está no referencial do APP, que é o do Revit girado
  180° (no Revit o contraforte sai para −Y; no app, para +Y). Por isso o 34 aparece lido de trás para frente: no app
  a ponta local x = 0 é a que fica na face aparente do muro (η = 0). O teste dos gabaritos confere furo a furo,
  no mundo, contra a descrição do Revit — se alguém inverter a ordem aqui, ele pega.
*/
import type { ClassePeca, TipoPeca } from '@/modelo/tipos';
import { C_CANTOS, calibrarFuro, raioPelaArea, type Furo } from './perfis';

// Só a família 39 (decisão do Jose, 09/10). A 14x29 existia para a aula 12.3 em bloco cerâmico, que saiu do app.
export type NomeFamilia = '14x39' | '19x39';

/** Furo medido: trecho ao longo da peça, a partir da ponta local x = 0 (mm). */
export interface FuroMedido { de: number; ate: number }

/** Bloco medido no Revit do Jose. */
export interface BlocoMedido {
  /** Paredes longitudinais (as faces do muro), mm: a largura do furo é t − 2·parede. */
  parede: number;
  furos: FuroMedido[];
  /** Volume da família no Revit, mm³ (dá o raio dos cantos dos furos). */
  volume: number;
}

/** Uma peça que a obra compra (ou corta). */
export interface PecaDoCatalogo {
  /** Chave interna. O preenchimento das corridas usa as chaves listadas em encaixes.ts (`livres`). */
  chave: string;
  tipo: TipoPeca;
  forma: 'bloco' | 'canaleta';
  /** Comprimento real, mm. */
  comprimento: number;
  /**
   * Larguras das células que a peça cobre, com a junta (soma = comprimento + 10), na ordem do comprimento.
   * Sem isto: células de m. Na 14x39 a peça de amarração cobre a faixa do nó (150) e células de 200.
   */
  celulas?: number[];
  /** Furos e paredes medidos no Revit. Sem isto: um furo por célula, calibrado no Ag da aula. */
  medido?: BlocoMedido;
  /** Nome comercial — vai para o quantitativo e para o IFC. */
  nome: string;
  /** Classe para pintar por tipo (cores do Jose). */
  classe: ClassePeca;
}

/** Seção da canaleta (U) da família. */
export interface CanaletaDaFamilia {
  parede: number;   // mm
  fundo: number;    // mm
  /** Volume medido no Revit para um comprimento — dá o raio dos cantos do fundo. Sem isto: U de cantos vivos. */
  medida?: { comprimento: number; volume: number };
}

export interface FamiliaDoCatalogo {
  nome: NomeFamilia;
  t: number;        // largura do bloco
  L: number;        // inteiro
  Lm: number;       // meio
  hf: number;       // parede da tabela da aula (a da conta)
  agFuro: number;   // área de graute de UM furo do inteiro na tabela da aula, mm² (117 / 170 cm²) — só peça sem medida do Revit desenha com ela
  canaleta: CanaletaDaFamilia;
  /**
   * Seção da canaleta CORTADA quando ela é peça própria, com outro fundo (19x39). Sem isto, a cortada tem a seção da
   * inteira. As paredes têm de ser as da inteira: o graute e a barra correm de uma para a outra na mesma calha.
   */
  canaletaCortada?: CanaletaDaFamilia;
  pecas: PecaDoCatalogo[];
}

export const CATALOGO: Record<NomeFamilia, FamiliaDoCatalogo> = {
  // Revit do Jose, 'Al-rimo Templates.rvt' (09/10/2026): dados/encaixes_revit/14x39_templates.json.
  '14x39': {
    nome: '14x39', t: 140, L: 390, Lm: 190, hf: 27, agFuro: 11700,
    canaleta: { parede: 25, fundo: 39.1, medida: { comprimento: 390, volume: 5116e3 } },
    pecas: [
      // paredes 3,2; septos 2,5 nas pontas e no meio; 2 furos 7,6 × 15,75
      { chave: 'inteiro', classe: 'inteiro', tipo: 'BLOCO', forma: 'bloco', comprimento: 390, nome: 'bloco 14x19x39',
        medido: { parede: 32, furos: [{ de: 25, ate: 182.5 }, { de: 207.5, ate: 365 }], volume: 5883e3 } },
      // paredes 2,5 em volta; 1 furo 9,0 × 14,0
      { chave: 'meio', classe: 'meio', tipo: 'MEIO_BLOCO', forma: 'bloco', comprimento: 190, nome: 'meio bloco 14x19x19',
        medido: { parede: 25, furos: [{ de: 25, ate: 165 }], volume: 2690e3 } },
      // t + 10 = 150 ≠ m = 200: a junção não fecha com inteiro e meio; 34 (L) e 54 (T) são as peças do Jose.
      // 34 no app (Revit lido de trás para frente): ponta 3,2 | furo quadrado 7,6 | septo 6,7 | furo 14,0 | septo 2,5.
      // O furo quadrado cai no eixo do contraforte; as células: a faixa do nó (150) e uma célula (200).
      { chave: '340', classe: 'bloco34', tipo: 'BLOCO_JUNCAO', forma: 'bloco', comprimento: 340, celulas: [150, 200], nome: 'bloco 14x19x34 (amarração em L)',
        medido: { parede: 32, furos: [{ de: 32, ate: 108 }, { de: 175, ate: 315 }], volume: 5975e3 } },
      // 54 no app (Revit girado 180°): septo 2,5 | furo 15,0 | septo 5,7 | furo quadrado 7,6 | septo 6,7 | furo 14,0 | septo 2,5.
      { chave: '540', classe: 'bloco54', tipo: 'BLOCO_JUNCAO', forma: 'bloco', comprimento: 540, celulas: [200, 150, 200], nome: 'bloco 14x19x54 (amarração em T)',
        medido: { parede: 32, furos: [{ de: 25, ate: 175 }, { de: 232, ate: 308 }, { de: 375, ate: 515 }], volume: 9152e3 } },
      { chave: 'canaleta', classe: 'canaleta', tipo: 'CANALETA', forma: 'canaleta', comprimento: 390, nome: 'canaleta 14x19x39' },
      // só no muro em balanço (sem gabarito do Jose); no muro com contrafortes ele corta a 39 (canaleta@...)
      { chave: 'meia_canaleta', classe: 'canaleta', tipo: 'MEIA_CANALETA', forma: 'canaleta', comprimento: 190, nome: 'meia canaleta 14x19x19' },
    ],
  },
  // Revit do Jose, 'Casa R - A' (08/10/2026): dados/encaixes_revit/19x39_casaR.json. Canaleta: Al-rimo Templates (09/10).
  '19x39': {
    nome: '19x39', t: 190, L: 390, Lm: 190, hf: 35, agFuro: 17000,
    canaleta: { parede: 25, fundo: 29.1, medida: { comprimento: 390, volume: 5333e3 } },
    // "Canaleta 19 Corte 19cm" do Revit (Al-rimo Templates, 09/10)
    canaletaCortada: { parede: 25, fundo: 39.1, medida: { comprimento: 190, volume: 2864e3 } },
    pecas: [
      // paredes 3,2; septos 3,5 nas pontas e no meio; 2 furos 12,6 × 14,25
      { chave: 'inteiro', classe: 'inteiro', tipo: 'BLOCO', forma: 'bloco', comprimento: 390, nome: 'bloco 19x19x39',
        medido: { parede: 32, furos: [{ de: 35, ate: 177.5 }, { de: 212.5, ate: 355 }], volume: 7288.9e3 } },
      // paredes 2,5 em volta; 1 furo 14 × 14
      { chave: 'meio', classe: 'meio', tipo: 'MEIO_BLOCO', forma: 'bloco', comprimento: 190, nome: 'meio bloco 19x19x19',
        medido: { parede: 25, furos: [{ de: 25, ate: 165 }], volume: 3165.3e3 } },
      { chave: 'canaleta', classe: 'canaleta', tipo: 'CANALETA', forma: 'canaleta', comprimento: 390, nome: 'canaleta 19x19x39' },
      { chave: 'meia_canaleta', classe: 'canaleta', tipo: 'MEIA_CANALETA', forma: 'canaleta', comprimento: 190, nome: 'meia canaleta 19x19x19' },
    ],
  },
};

/**
 * As cores que o Jose usa no Revit por tipo de peça, para o pessoal da obra entender a montagem
 * (dados/encaixes_revit/cores_jose.json). O 3D e a vista frontal pintam com elas, com legenda.
 */
export const CORES_DO_JOSE: Partial<Record<ClassePeca, string>> = {
  inteiro: '#787878',
  meio: '#004080',
  canaleta: '#ffff80',
  bloco34: '#ff8040',
  bloco54: '#ff0000',
};

/** Canaleta cortada na obra: chave 'canaleta@<mm>'. */
export const chaveDoCorte = (comprimento: number): string => `canaleta@${Math.round(comprimento * 10) / 10}`;

const cortes = new Map<string, PecaDoCatalogo>();
const cm = (mm: number): string => String(Math.round(mm) / 10).replace('.', ',');

export function pecaDoCatalogo(f: FamiliaDoCatalogo, chave: string): PecaDoCatalogo {
  const p = f.pecas.find((x) => x.chave === chave);
  if (p) return p;
  const corte = /^canaleta@(\d+(?:\.\d+)?)$/.exec(chave);
  if (corte) {
    const c = Number(corte[1]);
    if (c > 0 && c < f.L) {
      const k = `${f.nome}|${chave}`;
      let pc = cortes.get(k);
      if (!pc) {
        pc = { chave, classe: 'canaleta', tipo: 'CANALETA_CORTADA', forma: 'canaleta', comprimento: c, nome: `canaleta ${f.t / 10}x19x${f.L / 10} cortada em ${cm(c)}` };
        cortes.set(k, pc);
      }
      return pc;
    }
  }
  throw new Error(`peça "${chave}" não existe no catálogo da família ${f.nome}`);
}

/** Meio módulo = passo da grade de furos: (L + 10)/2 → 150 ou 200. */
export const meioModulo = (f: { L: number }): number => (f.L + 10) / 2;

/** Células da peça (com junta), na ordem do comprimento. */
export function celulasDaPeca(pc: PecaDoCatalogo, m: number): number[] {
  if (pc.celulas) return pc.celulas;
  const n = Math.max(1, Math.round((pc.comprimento + JUNTA) / m));
  return Array.from({ length: n }, () => m);
}

/** Furo de uma peça, no comprimento dela: centro c, comprimento l (ao longo da peça), largura w, raio r. */
export interface FuroDaPeca { c: number; l: number; w: number; r: number }

/** O furo calibrado no Ag da aula (só peças sem medida do Revit — hoje, nenhuma). */
export const furoCalibrado = (f: FamiliaDoCatalogo): Furo => calibrarFuro(f.t, f.L, f.hf, f.agFuro);

/**
 * Furos de uma peça de bloco.
 * Medida do Revit: os furos como estão na família, raio dos cantos pelo volume.
 * Sem medida: um por célula, CENTRADO na célula — assim o furo de uma fiada cai em cima do da fiada de baixo em
 * qualquer amarração. Célula comum: o furo calibrado; célula do nó (150 na 14x39): o mesmo furo encurtado.
 */
export function furosDaPeca(f: FamiliaDoCatalogo, pc: PecaDoCatalogo): FuroDaPeca[] {
  if (pc.forma !== 'bloco') return [];
  if (pc.medido) {
    const { parede, furos, volume } = pc.medido;
    const w = f.t - 2 * parede;
    const somaRet = furos.reduce((s, h) => s + (h.ate - h.de) * w, 0);
    const area = f.t * pc.comprimento - volume / H_BLOCO;
    const lMin = Math.min(...furos.map((h) => h.ate - h.de));
    const r = Math.min(raioPelaArea(somaRet, area, furos.length), w / 2, lMin / 2);
    return furos.map((h) => ({ c: (h.de + h.ate) / 2, l: h.ate - h.de, w, r }));
  }
  const m = meioModulo(f);
  const furo = furoCalibrado(f);
  const out: FuroDaPeca[] = [];
  let x = 0;
  for (const W of celulasDaPeca(pc, m)) {
    const livre = W - JUNTA;
    const l = W === m ? Math.min(furo.l, livre - 2) : Math.min(furo.l, livre - 2 * f.hf);
    out.push({ c: x + livre / 2, l, w: furo.w, r: Math.min(furo.r, furo.w / 2, l / 2) });
    x += W;
  }
  return out;
}

/**
 * Seção de uma peça de canaleta (pelo tipo): a da cortada quando ela é peça própria (19x39), senão a da família.
 * Recebe só o tipo para servir tanto à peça do catálogo quanto à Peca do modelo (o graute da haste sai da Peca).
 */
export function secaoDaPecaCanaleta(f: FamiliaDoCatalogo, pc: { tipo: TipoPeca }): CanaletaDaFamilia {
  return pc.tipo === 'CANALETA_CORTADA' && f.canaletaCortada ? f.canaletaCortada : f.canaleta;
}

/** Raio dos cantos do fundo da canaleta (por dentro) que fecha a seção com o volume do Revit. 0 sem medida. */
export function raioDoFundoDaCanaleta(f: FamiliaDoCatalogo, c: CanaletaDaFamilia = f.canaleta): number {
  if (!c.medida) return 0;
  const secao = c.medida.volume / c.medida.comprimento;
  const reta = f.t * H_BLOCO - (f.t - 2 * c.parede) * (H_BLOCO - c.fundo);
  // cada canto arredondado (polígono) acrescenta r²·C_CANTOS/4 de concreto
  const extra = secao - reta;
  if (extra <= 0) return 0;
  return Math.min(Math.sqrt((2 * extra) / C_CANTOS), (f.t - 2 * c.parede) / 2, H_BLOCO - c.fundo);
}

/** Confere o catálogo: células somam o comprimento; furos medidos cabem na peça. Roda no carregamento. */
export function conferirCatalogo(): string[] {
  const erros: string[] = [];
  for (const f of Object.values(CATALOGO)) {
    const m = meioModulo(f);
    const cc = f.canaletaCortada;
    if (cc && cc.parede !== f.canaleta.parede) erros.push(`${f.nome}: canaleta cortada com parede ${cc.parede} ≠ ${f.canaleta.parede} da inteira`);
    if (cc?.medida && cc.medida.volume >= f.t * cc.medida.comprimento * H_BLOCO) erros.push(`${f.nome}: canaleta cortada com volume maior que a peça cheia`);
    for (const pc of f.pecas) {
      if (pc.forma !== 'bloco') continue;
      const soma = celulasDaPeca(pc, m).reduce((a, b) => a + b, 0);
      if (soma !== pc.comprimento + JUNTA) erros.push(`${f.nome} ${pc.chave}: células somam ${soma}, peça + junta = ${pc.comprimento + JUNTA}`);
      if (pc.medido) {
        let fim = 0;
        for (const h of pc.medido.furos) {
          if (h.de < fim || h.ate <= h.de || h.ate > pc.comprimento) erros.push(`${f.nome} ${pc.chave}: furo ${h.de}–${h.ate} fora de ordem ou da peça`);
          fim = h.ate;
        }
        if (f.t - 2 * pc.medido.parede <= 0) erros.push(`${f.nome} ${pc.chave}: paredes maiores que a peça`);
        if (pc.medido.volume >= f.t * pc.comprimento * H_BLOCO) erros.push(`${f.nome} ${pc.chave}: volume maior que a peça cheia`);
      }
    }
  }
  return erros;
}

/** Altura do bloco e da fiada (Fig. 5: fiadas de 20 cm). */
export const H_BLOCO = 190;
export const JUNTA = 10;
export const H_FIADA = 200;

const ERROS = conferirCatalogo();
if (ERROS.length) throw new Error('Catálogo inconsistente:\n' + ERROS.join('\n'));
