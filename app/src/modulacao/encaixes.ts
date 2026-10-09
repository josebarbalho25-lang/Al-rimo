/*
  ENCAIXES DO CONTRAFORTE — tabela de receitas por família, não algoritmo. A fonte são os modelos do Revit do Jose
  (dados/encaixes_revit/); o teste dos gabaritos (gabaritos.test.ts) monta o muro e confere peça a peça contra eles.
  Template novo do Jose = linha nova aqui (e peça nova em catalogo.ts) + gabarito novo + caso no teste.

  Cada contraforte é um "nó" na linha do muro: uma faixa de largura Wn = t + 10 (o bloco deitado do contraforte
  + uma junta). Entre os nós, corridas de células de m (meio módulo). Para cada tipo de fiada a receita diz o que
  ocupa o nó:
    P  — "parede passa": o muro é contínuo e a haste do contraforte encosta nele (a partir de η = t + 10).
    I  — "contraforte passa": uma peça deitada (passante) atravessa o muro e já cobre as primeiras células da haste.
    C  — fiada de canaleta: a canaleta passa direto pelo contraforte (decisão do Jose, 08/10), a haste encosta.
  T = contraforte intermediário; L = contraforte de ponta, escrito para a ponta ESQUERDA (a direita é o espelho:
  peças em ordem inversa e cada peça girada 180°).

  LADO: as receitas estão escritas como o Jose montou, olhando do lado do solo com o contraforte ENTERRADO. Com o
  contraforte aparente o muro inteiro é o espelho (fiadas.ts espelha o T) — assim é a mesma peça de obra, só que do
  outro lado, e não uma montagem diferente.

  `parede`:
    'continua' — a linha do muro passa pelo nó como se ele fosse mais um trecho de corrida, preenchida pela busca
                 (fiadas.ts) com as peças `livres`. Na 19x39 o T e o L na fiada P são assim: com o vão do gabarito a
                 busca chega no que o Jose montou (meio bloco em cima do T; na ponta, o bloco do muro até o fim).
    { antes, depois, pecas } — peças fixas na linha do muro, em sequência a partir de (início do nó − antes·m) até
                 (fim do nó + depois·m − 10). Ex.: 54 = 1 célula + nó (150) + 1 célula − 10.
    null       — nada na linha do muro (fiada I: quem ocupa o nó é a passante).
  `passante`: peça deitada ao longo de Y, de η = 0 a t + celulas·m; cobre o muro e `celulas` células da haste.
  `haste`: forma das peças do resto da haste (padrão: bloco). A arrumação é a regra dos gabaritos (fiadas.ts:
             inteiros a partir do muro e meio na ponta; na canaleta, inteiras a partir da ponta e a cortada junto ao
             muro). `umaCelulaEncostada`: contraforte de 34 na 14x39 — a canaleta cortada em 20 encosta no muro.

  A FIADA DE CANALETA do muro com contrafortes não sai desta tabela: é sempre "canaletas corridas deslocadas 1/4 de
  bloco das fiadas vizinhas" (gabarito 14x39), e quem monta é fiadas.ts. Também é de lá a SEQUÊNCIA (que contraforte
  é P e qual é I em cada fiada); daqui só sai `primeira`.

  O VÃO entre contrafortes não é livre: cada receita só amarra (sem junta a prumo) com certos números de células
  no vão. Isso NÃO está escrito aqui — o gerador descobre sozinho, montando um muro de prova com a própria receita
  (fiadas.ts, `vaoAmarra`), e a regra modular escolhe o vão que amarra. Exemplo: com o 54/34 da 14x39 o vão só
  amarra com nº PAR de células (0,95 / 1,35 / 1,75 m).
*/
import { CATALOGO, JUNTA, meioModulo, pecaDoCatalogo, type NomeFamilia } from './catalogo';

export type TipoFiada = 'P' | 'I' | 'C';

export interface ParedeNoEncaixe { antes: number; depois: number; pecas: string[] }

export interface HasteNaFiada {
  forma: 'bloco' | 'canaleta';
  /** Haste de UMA célula: uma canaleta cortada em m, encostada na face do muro (sem junta). */
  umaCelulaEncostada?: boolean;
}

export interface ReceitaDaFiada {
  parede: 'continua' | ParedeNoEncaixe | null;
  passante?: { peca: string; celulas: number };
  haste?: HasteNaFiada;
}

export interface EncaixesDaFamilia {
  provisoria: boolean;
  /** Texto do aviso quando a receita é provisória. */
  aviso?: string;
  origem: string;
  /** Peças que preenchem as corridas livres (em ordem de preferência: a 1ª é a peça "cheia"). */
  livres: { bloco: string[]; canaleta: string[] };
  /**
   * Células da haste (tenr = t + n·m) que os gabaritos cobrem. Fora disso a haste é montada pela mesma regra, mas
   * é DEDUÇÃO nossa — vira aviso.
   */
  hastesDoGabarito: number[];
  /** Tipo do contraforte da ponta de referência na 1ª fiada (gabaritos: 14x39 P; 19x39 I). */
  primeira: 'P' | 'I';
  T: Record<TipoFiada, ReceitaDaFiada>;
  L: Record<TipoFiada, ReceitaDaFiada>;
}

/** Fiada de canaleta: canaleta também na haste (gabaritos do Jose). */
const C_CANALETA: ReceitaDaFiada = { parede: 'continua', haste: { forma: 'canaleta' } };

/*
  Na 19x39 (o nó é uma célula da grade: t + 10 = m) o contraforte não tem peça especial: na fiada I o
  inteiro deitado atravessa o muro; na fiada P o muro passa e a busca de fiadas.ts escolhe como — no gabarito do
  Jose sai o meio bloco em cima do T (com meios dos dois lados do T na fiada I) e o bloco do muro correndo até o fim
  na ponta. Ficam como 'continua' porque, fixos, não amarram num muro com dois T seguidos (fiadas.ts explica).
*/
// função, e não objeto: cada família leva a sua cópia (trocar a linha de uma não pode mudar a outra)
const receitaDa19 = (): Pick<EncaixesDaFamilia, 'T' | 'L'> => ({
  T: {
    P: { parede: 'continua' },
    I: { parede: null, passante: { peca: 'inteiro', celulas: 1 } },
    C: { ...C_CANALETA },
  },
  L: {
    P: { parede: 'continua' },
    I: { parede: null, passante: { peca: 'inteiro', celulas: 1 } },
    C: { ...C_CANALETA },
  },
});

export const ENCAIXES: Record<NomeFamilia, EncaixesDaFamilia> = {
  // Revit do Jose, Al-rimo Templates (09/10): contraforte de 59 e de 79, eixo a eixo 180; Casa R (08/10): de 39.
  '19x39': {
    provisoria: false,
    origem: 'Revit do Jose: Al-rimo Templates (contraforte de 59 e 79) e Casa R (39)',
    livres: { bloco: ['inteiro', 'meio'], canaleta: ['canaleta', 'meia_canaleta'] },
    hastesDoGabarito: [1, 2, 3],
    primeira: 'I',
    ...receitaDa19(),
    // O contraforte DOBRADO (duas fileiras, 19x39_dobrado.json) ficou fora do app — decisão do Jose (09/10): risco de
    // execução errada, e a inércia vem do comprimento, não da largura. O gabarito fica só como arquivo.
  },
  // Revit do Jose, Al-rimo Templates (09/10): T e L, contraforte de 34 e de 54. t + 10 = 150 ≠ 200: 54 no T e 34 no
  // canto (fiada P), 34 deitado atravessando o muro (fiada I). Na fiada de canaleta com contraforte de 34, a canaleta
  // cortada em 20 encosta no muro.
  '14x39': {
    provisoria: false,
    origem: 'Revit do Jose: Al-rimo Templates (T e L; contraforte de 34 e de 54)',
    livres: { bloco: ['inteiro', 'meio'], canaleta: ['canaleta', 'meia_canaleta'] },
    hastesDoGabarito: [1, 2],
    primeira: 'P',
    T: {
      P: { parede: { antes: 1, depois: 1, pecas: ['540'] } },
      I: { parede: null, passante: { peca: '340', celulas: 1 } },
      C: { parede: 'continua', haste: { forma: 'canaleta', umaCelulaEncostada: true } },
    },
    L: {
      P: { parede: { antes: 0, depois: 1, pecas: ['340'] } },
      I: { parede: null, passante: { peca: '340', celulas: 1 } },
      C: { parede: 'continua', haste: { forma: 'canaleta', umaCelulaEncostada: true } },
    },
  },
};

/** Receita da ponta direita (ou do T no contraforte aparente): espelho — ordem inversa, cada peça girada 180°. */
export function espelhar(r: ReceitaDaFiada): ReceitaDaFiada & { espelhada?: boolean } {
  if (r.parede === null || r.parede === 'continua') return r;
  return { ...r, parede: { antes: r.parede.depois, depois: r.parede.antes, pecas: [...r.parede.pecas].reverse() }, espelhada: true };
}

/** Células da haste que a receita deixa para o preenchimento (as anteriores são da passante). */
export const hasteDesde = (r: ReceitaDaFiada): number => r.passante?.celulas ?? 0;

/**
 * Menor nº de células de uma corrida entre dois nós (o que as peças fixas comem de cada lado), e menor nº de
 * células da haste (o que a passante cobre). O ajuste modular de l_cf e tenr parte desses mínimos.
 */
export function minimosDaFamilia(nome: NomeFamilia): { celulasNoVao: number; celulasNaHaste: number } {
  const e = ENCAIXES[nome];
  let vao = 1;
  let haste = 1;
  const lados = (r: ReceitaDaFiada) =>
    r.parede && r.parede !== 'continua' ? { antes: r.parede.antes, depois: r.parede.depois } : { antes: 0, depois: 0 };
  for (const tf of ['P', 'I', 'C'] as TipoFiada[]) {
    const t = lados(e.T[tf]);
    const l = lados(e.L[tf]);
    // vão T–T, L(esq.)–T, T–L(dir., espelhada: antes = depois da esquerda) e L–L (trecho de um vão só); o T pode
    // estar espelhado (contraforte aparente): vale o pior dos dois lados
    const tA = Math.max(t.antes, t.depois);
    vao = Math.max(vao, t.depois + t.antes, l.depois + tA, tA + l.depois, 2 * l.depois);
    haste = Math.max(haste, hasteDesde(e.T[tf]), hasteDesde(e.L[tf]));
  }
  return { celulasNoVao: vao, celulasNaHaste: haste };
}

const mdc = (a: number, b: number): number => (b === 0 ? Math.abs(a) : mdc(b, a % b));

/**
 * Confere a tabela contra o catálogo: comprimentos fecham na grade, 'continua' só onde as peças livres conseguem
 * atravessar o nó, passante com o comprimento certo. Roda no carregamento do módulo — receita errada é defeito.
 */
export function conferirEncaixes(): string[] {
  const erros: string[] = [];
  for (const nome of Object.keys(ENCAIXES) as NomeFamilia[]) {
    const f = CATALOGO[nome];
    const m = meioModulo(f);
    const e = ENCAIXES[nome];
    for (const forma of ['bloco', 'canaleta'] as const) {
      for (const ch of e.livres[forma]) {
        try {
          if (pecaDoCatalogo(f, ch).forma !== forma) erros.push(`${nome} livres.${forma}: ${ch} não é ${forma}`);
        } catch (err) {
          erros.push(`${nome} livres.${forma}: ${(err as Error).message}`);
        }
      }
    }
    if (e.provisoria && !e.aviso) erros.push(`${nome}: receita provisória sem texto de aviso`);
    const Wn = f.t + JUNTA;
    for (const no of ['T', 'L'] as const) {
      for (const tf of ['P', 'I', 'C'] as TipoFiada[]) {
        const r = e[no][tf];
        const onde = `${nome} ${no}-${tf}`;
        const forma = tf === 'C' ? 'canaleta' : 'bloco';
        // na canaleta a corrida passa com canaleta cortada (comprimento livre): sempre fecha
        if (r.parede === 'continua' && forma === 'bloco') {
          // as peças livres têm de fechar a corrida que passa pelo nó: o passo comum delas divide m e Wn
          let g = 0;
          for (const ch of e.livres[forma]) {
            try {
              g = mdc(g, pecaDoCatalogo(f, ch).comprimento + JUNTA);
            } catch {
              /* já reportado acima */
            }
          }
          if (!g || m % g !== 0 || Wn % g !== 0) erros.push(`${onde}: 'continua' sem peça livre que feche o nó (${Wn} mm)`);
        }
        if (r.parede && r.parede !== 'continua') {
          if (no === 'L' && r.parede.antes !== 0) erros.push(`${onde}: na ponta não há células antes do nó`);
          let soma = 0;
          for (const ch of r.parede.pecas) {
            try {
              const p = pecaDoCatalogo(f, ch);
              soma += p.comprimento + JUNTA;
              if (p.forma !== forma) erros.push(`${onde}: ${ch} é ${p.forma} numa fiada de ${forma}`);
            } catch (err) {
              erros.push(`${onde}: ${(err as Error).message}`);
            }
          }
          const alvo = r.parede.antes * m + Wn + r.parede.depois * m;
          if (soma !== alvo) erros.push(`${onde}: peças somam ${soma - JUNTA} mm, o encaixe pede ${alvo - JUNTA} mm`);
        }
        if (r.passante) {
          try {
            const p = pecaDoCatalogo(f, r.passante.peca);
            if (p.comprimento !== f.t + r.passante.celulas * m) {
              erros.push(`${onde}: passante ${p.comprimento} mm ≠ t + ${r.passante.celulas}·m`);
            }
            if (p.forma !== 'bloco') erros.push(`${onde}: passante tem de ser bloco`);
          } catch (err) {
            erros.push(`${onde}: ${(err as Error).message}`);
          }
        }
        if (r.haste?.umaCelulaEncostada && r.haste.forma !== 'canaleta') erros.push(`${onde}: só a canaleta se corta para encostar no muro`);
        if (r.parede === null && !r.passante) erros.push(`${onde}: nó vazio (nem parede nem passante)`);
        if (r.parede !== null && r.passante) erros.push(`${onde}: passante e parede disputam o mesmo nó`);
        if (tf === 'I' && !r.passante) erros.push(`${onde}: fiada I sem passante`);
        if (tf !== 'I' && r.passante) erros.push(`${onde}: passante só na fiada I`);
      }
    }
  }
  return erros;
}

const ERROS = conferirEncaixes();
if (ERROS.length) throw new Error('Tabela de encaixes inconsistente:\n' + ERROS.join('\n'));
