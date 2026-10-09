/*
  O PASSO: uma linha da memória. O número publicado é SEMPRE o da planilha (r.v(id)); a memória não calcula nada que
  apareça como resultado. A expressão só narra — e o teste confere que a narração dá o número publicado.

  Uso (dentro de um autor de cards):
    const m = memoriaDe(r);
    m.passo('lambda_', '\\lambda', div(m.g('he_', 'h_e', 2, 'm'), m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' })),
            { casas: 1, verif: { chave: 'balanco.esbeltez', rotulo: 'Esbeltez λ ≤ 30', limite: 30, relacao: '<=' } })

  Expressão com ALTERNATIVAS ([forma fechada, forma da planilha]): vale a primeira que dá o número da célula. Serve
  ao caso em que a conta de mão (forma fechada) só coincide com a planilha em parte dos casos — ex.: o empuxo, que a
  planilha integra em 40 fatias; com o NA fora da divisão das fatias, a soma das fatias e a fórmula fechada diferem na
  4ª casa. Aí a linha mostra a soma das fatias, que é o número publicado, em vez de uma fórmula que não o produz.
*/
import type { Resultado, Valor } from '@/motor/tipos';
import type { Expr, Passo, Ref, Secao, Verificacao } from './tipos';
import { avaliar, lerNumero, nome as folha } from './expr';
import { casasDaEntrada, metaDaEntrada } from './metaDaPlanilha';
import { nt, texUnidade } from './formato';

/** Tolerância relativa entre a expressão e a célula (a mesma do teste). Piso de 1e-9 para valores perto de zero. */
export const TOLERANCIA = 1e-6;

export function bate(calculado: number, publicado: number): boolean {
  if (!Number.isFinite(calculado) || !Number.isFinite(publicado)) return false;
  return Math.abs(calculado - publicado) <= TOLERANCIA * Math.max(Math.abs(publicado), 1e-3);
}

/** Valor de célula → valor de passo: erro do Excel viaja como o texto dele ('#DIV/0!'). */
export function comoValorDePasso(v: Valor): number | string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
  return v.erro;
}

/** Lê pelo nome definido, ou pelo endereço quando a célula não tem nome ('Solo e Empuxo!F84'). */
export function lerValor(r: Resultado, id: string): Valor {
  return id.includes('!') ? r.cel(id) : r.v(id);
}

export interface PedidoDeVerificacao {
  chave: string;                 // estável: 'balanco.esbeltez'
  rotulo: string;                // tabela-resumo: 'Esbeltez λ ≤ 30'
  /**
    Número fixo da norma (30), ou a GRANDEZA DA PLANILHA que é o limite: m.g('dadm_', '\\delta_{adm}', 1, 'mm').
    Grandeza → o número é lido da célula e o símbolo entra no glossário. Só folha ou constante: limite que é conta
    tem de ser publicado antes, como passo próprio (a memória não calcula).
  */
  limite: number | null | Expr;
  relacao: '<=' | '>=';
  /** Célula de veredito da planilha ('OK' / 'NÃO OK'): quando existe, ELA decide — a régua é uma só. */
  celula?: string;
  aplicavel?: boolean;
  casasLimite?: number;
}

export interface OpcoesDoPasso {
  casas: number;
  unidade?: string;
  ref?: Ref;
  origem?: Passo['origem'];
  verif?: PedidoDeVerificacao;
  limiteTex?: string;
}

/** O número do limite: constante, ou célula lida (nunca conta). */
export function numeroDoLimite(limite: PedidoDeVerificacao['limite'], r?: Resultado): number | null {
  if (limite === null || typeof limite === 'number') return limite;
  if (limite.k === 'num') return limite.v;
  if (limite.k === 'nome') {
    if (!r) throw new Error(`limite ${limite.nome}: precisa do Resultado para ler a célula`);
    const v = lerNumero(r, limite.nome) * (limite.fator ?? 1);
    return Number.isFinite(v) ? v : null;
  }
  throw new Error('limite composto: publique a conta do limite como passo e use a célula dele');
}

export function verificacao(valor: number | null, pedido: PedidoDeVerificacao, r?: Resultado): Verificacao {
  const { relacao } = pedido;
  const limite = numeroDoLimite(pedido.limite, r);
  const temNumeros = valor !== null && limite !== null && Number.isFinite(valor) && Number.isFinite(limite);
  let passa = temNumeros ? (relacao === '<=' ? valor <= limite : valor >= limite) : false;
  if (pedido.celula && r) {
    const v = r.cel(pedido.celula);
    if (typeof v === 'string') passa = v.trim().toUpperCase().startsWith('OK');
  }
  let util: number | null = null;
  if (temNumeros) {
    if (relacao === '<=') util = limite !== 0 ? (100 * valor) / limite : null;
    else util = valor !== 0 ? (100 * limite) / valor : null;
  }
  return {
    chave: pedido.chave,
    rotulo: pedido.rotulo,
    valor,
    limite,
    relacao,
    aplicavel: pedido.aplicavel ?? true,
    passa,
    util,
  };
}

/** Lado direito da desigualdade: "30" ou "δ_adm = 12,8 mm" (símbolo da grandeza, número da célula). */
function texDoLimite(pedido: PedidoDeVerificacao, v: Verificacao, o: OpcoesDoPasso): string | undefined {
  const lim = pedido.limite;
  if (v.limite === null || lim === null) return undefined;
  if (typeof lim === 'number') return nt(v.limite, pedido.casasLimite ?? o.casas);
  if (lim.k === 'num') return lim.tex ?? nt(v.limite, pedido.casasLimite ?? lim.casas);
  if (lim.k !== 'nome') return undefined; // composto: numeroDoLimite já recusou
  return `${lim.tex} = ${nt(v.limite, pedido.casasLimite ?? lim.casas)}${texUnidade(lim.unidade ?? o.unidade)}`;
}

/** Entre as alternativas, a primeira que reproduz a célula; nenhuma bate → a última (o teste acusa). */
export function escolherExpr(alternativas: Expr[], publicado: number | string | null, r: Resultado): Expr {
  if (typeof publicado !== 'number') return alternativas[0];
  for (const e of alternativas) if (bate(avaliar(e, r), publicado)) return e;
  return alternativas[alternativas.length - 1];
}

/** Monta um passo lendo o número publicado pela planilha. */
export function passo(
  r: Resultado,
  id: string,
  simbolo: string,
  expr: Expr | Expr[] | null,
  o: OpcoesDoPasso,
): Passo {
  const valor = comoValorDePasso(lerValor(r, id));
  const p: Passo = {
    id,
    simbolo,
    valor,
    casas: o.casas,
    unidade: o.unidade ?? '',
    origem: o.origem ?? (expr ? 'calculado' : 'entrada'),
  };
  if (expr) p.expr = Array.isArray(expr) ? escolherExpr(expr, valor, r) : expr;
  if (o.ref) p.ref = o.ref;
  if (o.verif) {
    p.verif = verificacao(typeof valor === 'number' ? valor : null, o.verif, r);
    const lim = o.verif.limite;
    if (lim !== null && typeof lim === 'object') p.limiteExpr = lim;
    const tl = o.limiteTex ?? texDoLimite(o.verif, p.verif, o);
    if (tl !== undefined) p.limiteTex = tl;
  } else if (o.limiteTex) {
    p.limiteTex = o.limiteTex;
  }
  return p;
}

/** Seção numerada do card; aceita null/false para montar a lista com condições ("água? então u_base"). */
export function secao(titulo: string, passos: (Passo | null | false | undefined)[], ref?: Ref): Secao {
  const s: Secao = { titulo, passos: passos.filter((p): p is Passo => !!p) };
  if (ref) s.ref = ref;
  return s;
}

/**
  As ferramentas de um autor, já presas ao Resultado. É por aqui que um card é escrito — ver cards/index.ts.
*/
export function memoriaDe(r: Resultado) {
  return {
    r,
    /** Grandeza calculada da planilha como folha de expressão. */
    g: (nome: string, tex: string, casas: number, unidade?: string, opcoes?: { fator?: number }): Expr =>
      folha(nome, tex, casas, unidade, opcoes),
    /** Entrada da aba Entradas como folha: casas e unidade vêm da célula (dá para trocar com `fator`). */
    ent: (nome: string, tex: string, opcoes?: { fator?: number; casas?: number; unidade?: string }): Expr => {
      const meta = metaDaEntrada(nome);
      if (!meta) throw new Error(`não é entrada da planilha: ${nome}`);
      return folha(nome, tex, opcoes?.casas ?? casasDaEntrada(nome), opcoes?.unidade ?? meta.unidade, opcoes);
    },
    passo: (id: string, simbolo: string, expr: Expr | Expr[] | null, o: OpcoesDoPasso): Passo =>
      passo(r, id, simbolo, expr, o),
    /** Dado de entrada (sem conta): casas e unidade da célula. */
    entrada: (nome: string, simbolo: string, o?: { ref?: Ref }): Passo => {
      const meta = metaDaEntrada(nome);
      if (!meta) throw new Error(`não é entrada da planilha: ${nome}`);
      return passo(r, nome, simbolo, null, { casas: casasDaEntrada(nome), unidade: meta.unidade, origem: 'entrada', ref: o?.ref });
    },
    /** Texto de uma célula nomeada ('Sim', 'Balanço'), para decidir o que a memória mostra. */
    texto: (nome: string): string => {
      const v = r.v(nome);
      return typeof v === 'string' ? v : v === null ? '' : String(v);
    },
    num: (nome: string): number | null => r.num(nome),
    /** Número de nome ou endereço (para escolher a forma da conta; nunca para publicar). */
    valor: (id: string): number | null => {
      const v = lerValor(r, id);
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },
  };
}

export type Memoria = ReturnType<typeof memoriaDe>;
