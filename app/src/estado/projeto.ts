// ═══════════════════════════════════════════════════════════════════════════
//  estado/projeto.ts — o arquivo .alrimo, sem disco
// ---------------------------------------------------------------------------
//  O arquivo guarda o que o USUÁRIO decidiu, não o que a conta deu: as
//  alterações da planilha, as entradas do modelo e a versão da conta que as
//  recebeu. Resultado não se grava — abre-se o arquivo e a conta roda de novo.
//  Gravar resultado seria guardar um número que pode não bater mais com a
//  conta do dia em que o arquivo for aberto, e ninguém perceberia.
//
//  A versão da conta (hash do gerador da planilha) vai junto para o dia em que
//  a conta mudar: o arquivo abre do mesmo jeito, mas a barra de estado avisa
//  que a conta é outra — o mesmo muro pode dar outro número.
// ═══════════════════════════════════════════════════════════════════════════

import type { Alteracoes, Valor } from '@/motor/tipos';
import { validarValor, type Campo } from './campos';
import { ruim } from './recadoRuim';

export const EXTENSAO = '.alrimo';
/** A versão da conta de um arquivo que não diz qual é. */
export const VERSAO_DESCONHECIDA = 'desconhecida';
const FORMATO = 'alrimo';
/*
  2 (09/10/2026): duas alturas, a do muro (H_muro) e a de solo (H_solo). Na versão 1 a altura única era a do SOLO e o
  muro subia sozinho até fechar a fiada — o arquivo v1 abre com o solo nessa altura (ver desserializarProjeto). O
  número da versão é o que separa os dois casos: um arquivo novo com só H_muro gravado quer dizer "solo no padrão",
  porque a entrada igual ao padrão não se grava.
*/
const VERSAO_DO_ARQUIVO = 2;

export interface Projeto {
  titulo: string;
  alteracoes: Alteracoes;
  extras: Record<string, Valor>;
}

interface Arquivo {
  formato: typeof FORMATO;
  versaoDoArquivo: number;
  /** Hash do gerador da planilha que fez a conta quando o arquivo foi salvo. */
  versaoDaConta: string;
  titulo: string;
  alteracoes: Alteracoes;
  extras: Record<string, Valor>;
}

export function serializarProjeto(p: Projeto, versaoDaConta: string): string {
  const a: Arquivo = {
    formato: FORMATO,
    versaoDoArquivo: VERSAO_DO_ARQUIVO,
    versaoDaConta,
    titulo: p.titulo,
    alteracoes: p.alteracoes,
    extras: p.extras,
  };
  return JSON.stringify(a, null, 2);
}

export type Aberto =
  | {
      ok: true;
      projeto: Projeto;
      /** Nomes que esta versão do app não conhece (a planilha mudou): ficaram de fora. */
      descartados: string[];
      /** Nomes conhecidos com valor que o campo não aceitaria (texto, negativo, fora da lista): ficaram no padrão. */
      recusados: string[];
      /** A conta que salvou o arquivo não é a de hoje. */
      outraVersao: boolean;
      versaoDaConta: string;
    }
  | { ok: false; motivo: string };

/**
 * Lê o texto do arquivo. Cada valor passa pela MESMA porta do campo da tela
 * (`validarValor`): o arquivo é texto, pode ter sido editado à mão, e a conta
 * não pode receber o que o formulário recusaria. Nome que a conta de hoje não
 * conhece SAI (a conta recusaria o arquivo inteiro por ele); valor que o campo
 * não aceita também sai, e a entrada fica no padrão. Os dois voltam contados,
 * para a barra de estado dizer quantos.
 *
 * `campos` é o catálogo do painel: a ORIGEM de cada campo diz se o nome vale
 * nas alterações (planilha) ou nos extras (modelo) — H_muro dentro de extras
 * não vale.
 */
export function desserializarProjeto(
  texto: string,
  campos: ReadonlyMap<string, Campo>,
  versaoDeHoje: string,
): Aberto {
  let a: Partial<Arquivo>;
  try {
    a = JSON.parse(texto) as Partial<Arquivo>;
  } catch {
    return { ok: false, motivo: 'arquivo ilegível' };
  }
  if (!a || typeof a !== 'object' || a.formato !== FORMATO) return { ok: false, motivo: 'não é um arquivo do Al-rimo' };
  if (typeof a.versaoDoArquivo === 'number' && a.versaoDoArquivo > VERSAO_DO_ARQUIVO) {
    return { ok: false, motivo: 'arquivo de uma versão mais nova do Al-rimo' };
  }

  const descartados: string[] = [];
  const recusados: string[] = [];
  const filtrar = (fonte: unknown, origem: Campo['origem']): Record<string, Valor> => {
    const saida: Record<string, Valor> = {};
    if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) return saida;
    for (const [k, v] of Object.entries(fonte as Record<string, unknown>)) {
      const c = campos.get(k);
      if (!c || c.origem !== origem) {
        descartados.push(k);
        continue;
      }
      const lido = validarValor(c, v);
      if (lido.ok) saida[k] = lido.valor;
      else recusados.push(k);
    }
    return saida;
  };

  // Arquivo sem versão (feito à mão, ou de formato antigo): a conta que o
  // salvou é DESCONHECIDA, e isso tem de acender o aviso como "outra versão".
  // Texto vazio aqui passava por "sem aviso" na barra de estado, enquanto o
  // recado dizia "outra versão" — a tela se contradizia.
  const versaoDaConta = typeof a.versaoDaConta === 'string' && a.versaoDaConta ? a.versaoDaConta : VERSAO_DESCONHECIDA;
  const alteracoes = filtrar(a.alteracoes, 'planilha');
  // Arquivo v1 (antes das duas alturas): a altura gravada era a do solo. O solo vai para ela, e o muro antigo abre
  // calculando o mesmo empuxo (o muro, se a altura não fechava a fiada, a lista sobe — como o desenho de antes subia).
  const versaoDoArquivo = typeof a.versaoDoArquivo === 'number' ? a.versaoDoArquivo : 1;
  if (versaoDoArquivo < 2 && typeof alteracoes.H_muro === 'number' && !('H_solo' in alteracoes) && campos.has('H_solo')) {
    alteracoes.H_solo = alteracoes.H_muro;
  }
  return {
    ok: true,
    projeto: {
      titulo: typeof a.titulo === 'string' && a.titulo.trim() ? a.titulo : 'Sem título',
      alteracoes,
      extras: filtrar(a.extras, 'modelo'),
    },
    descartados,
    recusados,
    outraVersao: versaoDaConta !== versaoDeHoje,
    versaoDaConta,
  };
}

/**
 * A frase da barra de estado depois de abrir. Notícia ruim tem prioridade: o
 * que ficou de fora (nome desconhecido ou valor que o campo recusaria) e a
 * conta de outra versão.
 */
export function recadoDeAbertura(
  nome: string,
  a: { descartados: string[]; recusados: string[]; outraVersao: boolean },
): string {
  const fora = a.descartados.length + a.recusados.length;
  if (fora) return ruim(`${nome} aberto · ${fora} ${fora === 1 ? 'entrada ignorada' : 'entradas ignoradas'}`);
  if (a.outraVersao) return ruim(`${nome} aberto · salvo com outra versão da conta`);
  return `${nome} aberto`;
}

/** "Muro da rua 3.alrimo" → "Muro da rua 3". */
export function tituloDoArquivo(nome: string): string {
  return nome.replace(/\.[^.\\/]+$/, '').trim() || 'Sem título';
}

/** Nome de arquivo sem os caracteres que o Windows recusa. */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = titulo.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem título';
  return base + extensao;
}
