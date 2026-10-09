// ═══════════════════════════════════════════════════════════════════════════
//  ui/markdownSimples.ts — o pedaço de Markdown que o Termo de Uso usa
// ---------------------------------------------------------------------------
//  Títulos (#), parágrafo, citação (>), régua (---), lista numerada ("1. "),
//  item recuado ("   a) ...") e, dentro da linha, **negrito** e *itálico*.
//  Só isso, de propósito: uma biblioteca de Markdown seria dependência nova
//  (e mais um componente de terceiros no termo) para mostrar UM documento que
//  nós mesmos escrevemos. Se o termo passar a usar tabela ou link, é aqui.
//
//  Sai uma árvore de dados, não HTML: a tela monta os elementos do React, e
//  nenhum texto do arquivo vira marcação (sem innerHTML).
//
//  Diferença do Markdown de verdade, de propósito: linhas seguidas do mesmo
//  parágrafo NÃO se juntam — cada uma é uma linha. O cabeçalho do termo
//  (versão, data, aplicativo) são três linhas que, juntas, virariam uma frase.
// ═══════════════════════════════════════════════════════════════════════════

export interface Trecho {
  texto: string;
  negrito?: boolean;
  italico?: boolean;
}

export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3 | 4; trechos: Trecho[] }
  | { tipo: 'paragrafo'; linhas: Trecho[][]; recuado: boolean }
  | { tipo: 'lista'; inicio: number; itens: Trecho[][] }
  | { tipo: 'citacao'; blocos: Bloco[] }
  | { tipo: 'regua' };

const VAZIA = /^\s*$/;
const CITACAO = /^\s*>/;
const REGUA = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TITULO = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM_NUMERADO = /^\s*(\d+)\.\s+(.*)$/;

const comecaBloco = (l: string) => VAZIA.test(l) || CITACAO.test(l) || REGUA.test(l) || TITULO.test(l);

/** **negrito**, *itálico* — o resto é texto. Asterisco sem par fica como está. */
export function trechosDaLinha(linha: string): Trecho[] {
  const out: Trecho[] = [];
  const re = /\*\*(.+?)\*\*|\*(\S(?:.*?\S)?)\*/g;
  let ultimo = 0;
  for (let m = re.exec(linha); m; m = re.exec(linha)) {
    if (m.index > ultimo) out.push({ texto: linha.slice(ultimo, m.index) });
    out.push(m[1] !== undefined ? { texto: m[1], negrito: true } : { texto: m[2], italico: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) out.push({ texto: linha.slice(ultimo) });
  return out;
}

export function blocosDoMarkdown(md: string): Bloco[] {
  const linhas = md.replace(/\r\n?/g, '\n').split('\n');
  const out: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (VAZIA.test(l)) {
      i++;
      continue;
    }
    if (CITACAO.test(l)) {
      const dentro: string[] = [];
      while (i < linhas.length && CITACAO.test(linhas[i])) dentro.push(linhas[i++].replace(/^\s*> ?/, ''));
      out.push({ tipo: 'citacao', blocos: blocosDoMarkdown(dentro.join('\n')) });
      continue;
    }
    if (REGUA.test(l)) {
      out.push({ tipo: 'regua' });
      i++;
      continue;
    }
    const t = TITULO.exec(l);
    if (t) {
      out.push({ tipo: 'titulo', nivel: Math.min(t[1].length, 4) as 1 | 2 | 3 | 4, trechos: trechosDaLinha(t[2]) });
      i++;
      continue;
    }
    // Parágrafo: até a linha vazia ou o começo de outro bloco.
    const grupo: string[] = [];
    while (i < linhas.length && (grupo.length === 0 || !comecaBloco(linhas[i]))) grupo.push(linhas[i++]);
    const numerados = grupo.map((g) => ITEM_NUMERADO.exec(g));
    if (numerados.every((m) => m)) {
      out.push({
        tipo: 'lista',
        inicio: Number(numerados[0]![1]),
        itens: numerados.map((m) => trechosDaLinha(m![2].trim())),
      });
    } else {
      out.push({
        tipo: 'paragrafo',
        // "   a) copiar..." — a alínea da cláusula: recuada, como no papel.
        recuado: /^\s{2,}\S/.test(grupo[0]),
        linhas: grupo.map((g) => trechosDaLinha(g.trim())),
      });
    }
  }
  return out;
}
