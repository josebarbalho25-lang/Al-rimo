/*
  O CONTRATO DA MEMÓRIA DE CÁLCULO.

  Padrão do Pró-Viga, que o Jose aprovou: CONTA, não prosa — símbolo = fórmula = números = resultado, a unidade
  e o item da norma. Glossário com as letras latinas primeiro (A→Z) e as gregas depois (ordem grega).

  Quem fabrica o número é a planilha (motor/). A memória NÃO calcula: ela narra. Para não haver narração
  mentirosa, cada linha é escrita como EXPRESSÃO (Expr), não como texto: a mesma árvore desenha o TeX simbólico,
  desenha o TeX com os números, e é avaliada — e o teste (memoria/*.test.ts) exige, em todos os cenários do
  gabarito, que a expressão avaliada dê o mesmo número que a célula da planilha (Passo.id = nome definido).
  Se alguém mudar a fórmula na planilha e esquecer a memória, o teste quebra.
*/
import type { Resultado } from '@/motor/tipos';

/**
  Como a fonte é desenhada: "NBR 16868-1 · 11.2" / "ABCP · Tab. 3.2" / "Critério adotado".

  Produto comercial (Jose, 14/10): a fonte é a ORIGEM da regra — norma, livro ou teoria —, nunca curso, aula ou
  pessoa. Convenção de projeto sem outra fonte (δadm = vão/250, K digitado, he da flecha, seção I com alma = furo +
  septos, largura de influência do contraforte, roteiro da fundação) é 'Critério adotado', sem item.
*/
export interface Ref {
  fonte: 'NBR 16868-1' | 'NBR 6118' | 'NBR 6122' | 'NBR 11682' | 'NBR 6120' | 'NBR 6136' | 'ABCP'
    | 'Libânio' | 'Rankine' | 'Cintra, Aoki e Albiero' | 'Critério adotado' | 'Dedução'
    // medida tirada dos templates de montagem que o Jose modelou no Revit (dados/encaixes_revit/)
    | 'Template do Revit'
    | 'NBR 6123';
  item?: string;
}

/** Árvore de expressão: desenha e avalia. Construída com os construtores de memoria/expr.ts. */
export type Expr =
  | { k: 'num'; v: number; casas: number; tex?: string }                    // constante escrita: 0,7 · 2,0
  // `tex` (opcional, frente MEM): constante com NOME, desenhada pelo símbolo nas duas linhas — π (PI() da planilha).
  | { k: 'nome'; nome: string; tex: string; casas: number; unidade?: string; fator?: number } // grandeza da planilha (lida do Resultado)
  // `fator` (opcional, acrescentado pela frente MEM): troca de unidade NA LEITURA — a planilha guarda t em cm e a conta
  // de mão escreve t em m (λ = he/t = 3,20/0,19). Sem ele a linha numérica sairia "3,20/(19/100)".
  | { k: 'op'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { k: 'neg'; a: Expr }
  | { k: 'fn'; fn: 'sqrt' | 'min' | 'max' | 'abs' | 'tan' | 'cos' | 'sin' | 'rad' | 'cbrt'; args: Expr[] }
  | { k: 'par'; a: Expr; arred?: 'cima' | 'baixo' | 'int' };                // parênteses explícitos
  // `arred` (opcional, frente MEM): o grupo é ARREDONDADO a inteiro como a planilha faz — 'cima' = ROUNDUP(x;0) e
  // CEILING(x;1), 'baixo' = ROUNDDOWN(x;0), 'int' = INT(x). Desenha ⌈ ⌉ / ⌊ ⌋. Sem isso, "3Ø10" (ROUNDUP de 2,93)
  // não teria como sair de uma expressão, e a diferença do arredondamento viraria tolerância no teste.

export interface Verificacao {
  chave: string;                 // estável: 'balanco.flexao.As'
  rotulo: string;                // curto, para a tabela-resumo: 'As,ef ≥ As,nec'
  valor: number | null;
  limite: number | null;
  relacao: '<=' | '>=';
  aplicavel: boolean;
  passa: boolean;
  util: number | null;           // % de uso
}

export interface Passo {
  id: string;                    // = NOME DEFINIDO da planilha quando existe → o teste confere com a célula
  simbolo: string;               // TeX do lado esquerdo: 'M_d'
  expr?: Expr;                   // a conta; ausente = valor de entrada, de tabela ou escolha
  valor: number | string | null; // o número publicado pela planilha (nunca recalculado aqui)
  casas: number;
  unidade: string;
  origem: 'entrada' | 'tabela' | 'calculado' | 'adotado';
  ref?: Ref;
  verif?: Verificacao;           // a linha termina numa desigualdade
  limiteTex?: string;            // lado direito da desigualdade
  // (opcional, frente MEM) o limite quando ele é grandeza da planilha (δ_adm, V_Rd2, A_s,mín): o símbolo entra no
  // glossário e no teste do dicionário, e o número do lado direito é LIDO da célula, nunca digitado no card.
  limiteExpr?: Expr;
}

/**
  Figura GERADA para o muro atual — ex.: a seção do contraforte da montagem, cotada com os números das células. SVG em
  texto (o autor continua puro e testável); vai para a tela, o papel e o Word como as outras.
*/
export interface Desenho {
  svg: string;
  titulo: string;
  // largura na tela, em px (sem ela, 660). Quem desenha na escala da letra do texto pede a largura do próprio SVG,
  // para a cota sair do tamanho da conta (Jose, 12/10: "visível por favor, tá pequeno").
  largura?: number;
}

// `desenho` (opcional): a figura que ilustra ESTA seção, posta logo antes dela (Jose, 12/10: "distribui os desenhos" —
// cada desenho perto da conta que ele mostra, e não todos juntos no topo do card).
export interface Secao { titulo: string; ref?: Ref; passos: Passo[]; desenho?: Desenho }

export interface Card {
  id: string;                    // 'balanco.flexao', 'contraforte.cisalhamento', 'fundacao.tombamento'
  titulo: string;                // 'Flexão · muro em balanço'
  ref?: Ref;
  figura?: string;               // 'Fig. 4' — o mesmo acervo do botão das entradas
  desenho?: Desenho;             // (opcional) a figura gerada do card inteiro, antes da primeira conta
  secoes: Secao[];
  avisos: string[];              // curtos
  aplicavel: boolean;            // ex.: cards de contraforte com Tipo_muro = Balanço → false (não aparece)
}

/** Um autor de cards: lê o Resultado da conta e devolve os cards do seu grupo. Puro. */
export type AutorDeCards = (r: Resultado) => Card[];
