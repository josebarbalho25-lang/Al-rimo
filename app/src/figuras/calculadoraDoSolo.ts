/*
  CALCULADORA DE CONSULTA DA FIG. 22 (Jose, 09/10) — abaixo das tabelas de solo, dentro do modal da figura:
    φ'           → Ka = tg²(45° − φ'/2) e Kp = tg²(45° + φ'/2) (Rankine, terreno horizontal)
    NSPT argila  → consistência, c', φ' e su de referência (tabela de argila da aba Solo e Empuxo)
  Só consulta: NÃO mexe no formulário. O engenheiro copia à mão o valor que quiser.

  Os números saem da MESMA conta do app — a planilha, pelo motor —, e não de uma fórmula escrita aqui: Ka_ e Kp_
  com o "Ka direto" em branco (o caminho por φ' da planilha), e as linhas de sugestão de argila (cons_arg, c_arg,
  phi_arg, su_arg) com o NSPT digitado. Assim a calculadora não tem como discordar da planilha; o teste
  (calculadoraDoSolo.test.ts) confere com o gabarito do Excel. O motor é preguiçoso: só as poucas células pedidas
  são calculadas.
*/
import { calcular } from '@/motor';
import type { Valor } from '@/motor/tipos';

/** φ' que a calculadora aceita: o mesmo teto do campo do formulário (estado/campos.ts, FAIXA de phi_solo). */
export const PHI_MAXIMO = 60;

export interface Rankine {
  Ka: number;
  Kp: number;
}

/** Ka e Kp da planilha para um φ' (°), ou null se o φ' não serve (negativo, acima de 60°, não número). */
export function rankine(phi: number): Rankine | null {
  if (!Number.isFinite(phi) || phi < 0 || phi > PHI_MAXIMO) return null;
  const r = calcular({ phi_solo: phi, Ka_dir: null });
  const Ka = r.num('Ka_');
  const Kp = r.num('Kp_');
  return Ka === null || Kp === null ? null : { Ka, Kp };
}

export interface ReferenciaDeArgila {
  consistencia: string;
  /** Cada um como a planilha escreve: número ou faixa em texto ("10 a 25"); "—" quando a fonte não traz. */
  c: string;
  phi: string;
  su: string;
}

const comoTexto = (v: Valor): string => {
  if (v === null || v === '') return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
  return '—';
};

/** A linha da tabela de argila para um NSPT (golpes), ou null se o NSPT não serve. */
export function argilaPeloNspt(nspt: number): ReferenciaDeArgila | null {
  if (!Number.isFinite(nspt) || nspt < 0) return null;
  const r = calcular({ NSPT: nspt });
  return {
    consistencia: comoTexto(r.v('cons_arg')),
    c: comoTexto(r.v('c_arg')),
    phi: comoTexto(r.v('phi_arg')),
    su: comoTexto(r.v('su_arg')),
  };
}
