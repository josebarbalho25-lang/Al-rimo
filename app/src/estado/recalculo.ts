// ═══════════════════════════════════════════════════════════════════════════
//  estado/recalculo.ts — a ordem das coisas a cada entrada mudada
// ---------------------------------------------------------------------------
//  Uma tecla no formulário refaz, NESTA ordem: a conta (planilha) → os
//  avisos que ela publica → o muro peça a peça (modulação) → o veredito. A ordem é a do contrato do modelo:
//  quem modula lê os valores já ajustados pela conta, então a conta vem antes.
//
//  Cada etapa pode falhar sem derrubar a anterior: conta com erro não gera
//  muro (não há o que modular), mas muro que não fecha não apaga a conta — a
//  memória continua de pé, e a barra de estado diz que o modelo falhou.
//  "Avisar, não travar".
// ═══════════════════════════════════════════════════════════════════════════

import type { Alteracoes, EntradaMeta, Resultado, Valor } from '@/motor/tipos';
import type { Modelo } from '@/modelo/tipos';
import { avisosDaPlanilha, type AvisoDaPlanilha } from './avisosDaPlanilha';
import type { GeradorDoModelo, JuizDoVeredito, Veredito } from './ligacoes';

export interface Recalculado {
  resultado: Resultado | null;
  erroConta: string | null;
  /** Os avisos curtos da planilha (c' > 0…): a marca ao lado do campo e o "N avisos" da barra leem daqui. */
  avisosDaConta: AvisoDaPlanilha[];
  modelo: Modelo | null;
  erroModelo: string | null;
  veredito: Veredito | null;
}

export interface Dependencias {
  calcular: (a: Alteracoes) => Resultado;
  gerador: GeradorDoModelo | null;
  veredito: JuizDoVeredito | null;
}

/** Os padrões das entradas do modelo (o mesmo que `padroesDoModelo()` da modulação devolve). */
export function padroesDe(metas: readonly EntradaMeta[]): Record<string, Valor> {
  const p: Record<string, Valor> = {};
  for (const m of metas) p[m.nome] = m.padrao;
  return p;
}

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function recalcular(
  dep: Dependencias,
  alteracoes: Alteracoes,
  extras: Record<string, Valor>,
  padroesDoModelo: Record<string, Valor>,
): Recalculado {
  let resultado: Resultado;
  try {
    resultado = dep.calcular(alteracoes);
  } catch (e) {
    return { resultado: null, erroConta: mensagem(e), avisosDaConta: [], modelo: null, erroModelo: null, veredito: null };
  }

  // Lidos uma vez por conta, aqui, e não a cada desenho do painel: o painel e a barra recebem a MESMA lista.
  // Célula de aviso que sumiu da planilha não derruba a conta (o teste dos avisos acusa o nome antes).
  let avisosDaConta: AvisoDaPlanilha[] = [];
  try {
    avisosDaConta = avisosDaPlanilha(resultado);
  } catch {
    avisosDaConta = [];
  }

  let modelo: Modelo | null = null;
  let erroModelo: string | null = null;
  if (dep.gerador) {
    try {
      // O gerador recebe as entradas do modelo COMPLETAS (padrão + o que mudou):
      // ele não tem de saber o que é padrão e o que foi digitado.
      modelo = dep.gerador(resultado, { ...padroesDoModelo, ...extras });
    } catch (e) {
      erroModelo = mensagem(e);
    }
  }

  let veredito: Veredito | null = null;
  if (dep.veredito) {
    try {
      veredito = dep.veredito(resultado);
    } catch {
      veredito = null;
    }
  }

  return { resultado, erroConta: null, avisosDaConta, modelo, erroModelo, veredito };
}
