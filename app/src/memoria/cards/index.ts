/*
  REGISTRO DOS AUTORES DE CARDS.

  ── COMO ESCREVER UM CARD (leia antes de abrir um arquivo novo aqui) ─────────────────────────────────────────────
  1. Um arquivo por grupo (cards/balanco.ts, cards/contrafortes.ts...) exportando um AutorDeCards: (r) => Card[].
     Puro: lê o Resultado, não guarda estado, não importa React.
  2. Comece com `const m = memoriaDe(r)` (../passo). Folhas da conta: m.ent('H_muro', 'h') para ENTRADA (casas e
     unidade saem da célula), m.g('Md_', 'M_d', 2, 'kN·m/m') para grandeza CALCULADA (casas = as da célula na
     planilha). Célula sem nome: nome('Aba!F84', ...) de ../expr; intervalo 'Aba!F45:F83' = a SOMA dele.
  3. Cada linha: m.passo(NOME_DEFINIDO, simboloTeX, expressão, { casas, unidade, ref, verif }). O número publicado
     é lido da planilha pelo nome — a expressão só narra, e o teste exige que ela dê o mesmo número em todos os
     cenários do gabarito. Arredondamento que a planilha faz TEM de estar na expressão (não se tolera diferença).
     Expressão = construtores de ../expr (soma, sub, mul, div, pot, raiz, min, max, tan(rad(...)), cte(0.7, 1)...).
     PI() → pi(); ROUNDUP(x;0)/CEILING(x;1) → arredCima(x); ROUNDDOWN(x;0) → arredBaixo(x); INT → inteiro(x).
     A folga que a planilha põe antes do ROUNDUP (−0,005) entra na expressão como está lá.
     Dado sem conta: m.entrada('gama_f', '\\gamma_f'). Conta de mão que só coincide em parte dos casos: passe a
     lista [formaFechada, formaDaPlanilha] — vale a primeira que reproduz a célula (ver cards/solo.ts, empuxo).
  4. IF da planilha vira `if` no autor, espelhando a MESMA condição (ISNUMBER(Ka_dir) → m.num('Ka_dir') !== null).
     A memória escolhe que conta mostrar; nunca qual número publicar.
  5. Verificação: verif: { chave estável 'grupo.item', rotulo curto 'λ ≤ 30', limite, relacao, celula de veredito
     da planilha quando houver }. A mesma Verificacao alimenta o chip, a tabela-resumo e o rosto — régua única.
     Limite de norma fixo: número (30). Limite que é célula (δadm, VRd2, As,mín): a FOLHA dela, m.g('dadm_',
     '\\delta_{adm}', 1, 'mm') — o número é lido da planilha e o símbolo entra no glossário. Limite que é conta:
     publique-o antes como passo próprio e use a célula dele.
     IF de aplicabilidade (contraforte num muro em balanço): card.aplicavel = false; não monte passo com "—".
  6. Símbolo novo → acrescente no SIMBOLOS_<GRUPO> do seu arquivo (≤ 70 caracteres, sem ponto final); ../simbolos.ts junta. O teste barra símbolo sem
     descrição e o mesmo nome definido desenhado com dois símbolos diferentes.
  7. Tela: só rótulo, conta e número. Nada de frase explicando; o "porquê" vai em comentário de código.
  8. Registre o autor em AUTORES (abaixo) e rode `npx vitest run src/memoria`.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
*/
import type { Resultado } from '@/motor/tipos';
import type { AutorDeCards, Card, Verificacao } from '../tipos';
import { autorSolo } from './solo';
import { autorBalanco } from './balanco';
import { autorPainelEls } from './painelEls';
import { autorContraforte } from './contraforte';
import { autorPainelCf } from './painelCf';
import { autorEstabilidade } from './estabilidade';
import { autorSapata } from './sapata';
import { autorMuroDeCima } from './muroDeCima';

/** Na ordem do documento (a mesma das abas da planilha). */
export const AUTORES: readonly AutorDeCards[] = [
  autorSolo, autorBalanco, autorPainelEls, autorContraforte, autorPainelCf, autorEstabilidade, autorSapata, autorMuroDeCima,
];

/**
  Todos os cards, aplicáveis ou não (a tela e o papel mostram só `aplicavel`). Um autor que quebra NÃO derruba a
  memória inteira: vira um card com o defeito escrito — e o teste, que chama os autores direto, acusa antes.
*/
export function cardsDaMemoria(r: Resultado): Card[] {
  const out: Card[] = [];
  AUTORES.forEach((autor, i) => {
    try {
      out.push(...autor(r));
    } catch (e) {
      out.push({
        id: `defeito.${i}`,
        titulo: 'Memória indisponível',
        secoes: [],
        avisos: [e instanceof Error ? e.message : String(e)],
        aplicavel: true,
      });
    }
  });
  return out;
}

/**
  Veredito geral do muro ("Passa" / "Não passa · 3") — a barra de estado, o rosto e a cor do 3D leem DAQUI, da
  mesma Verificacao do chip da linha. null = nenhum card aplicável verifica nada (a barra mostra "—").
*/
export function vereditoDaMemoria(r: Resultado, cards?: Card[]): { passa: boolean; falhas: number } | null {
  const vs = verificacoesDe(cards ?? cardsDaMemoria(r));
  if (vs.length === 0) return null;
  const falhas = vs.filter((x) => !x.v.passa).length;
  return { passa: falhas === 0, falhas };
}

/** As verificações que valem (card aplicável e verificação aplicável) — a régua do resumo, do rosto e do 3D. */
export function verificacoesDe(cards: Card[]): { card: Card; v: Verificacao; casas: number; unidade: string }[] {
  const out: { card: Card; v: Verificacao; casas: number; unidade: string }[] = [];
  for (const c of cards) {
    if (!c.aplicavel) continue;
    for (const s of c.secoes) for (const p of s.passos) {
      if (p.verif && p.verif.aplicavel) out.push({ card: c, v: p.verif, casas: p.casas, unidade: p.unidade });
    }
  }
  return out;
}
