/*
  CALCULADORA DE CONSULTA DA FIG. 15 (Jose, 10/10) — abaixo do desenho da sapata, dentro do modal da figura:
    SPT na base → σadm por 20·N (aba do Gilberto) e por Mello 100·(√N − 1), cada uma com a faixa de N em que vale
  Só consulta: NÃO mexe no formulário. O engenheiro copia à mão o valor que quiser para o "σadm do solo".

  Mesma ideia da calculadoraDoSolo: os números saem da planilha, pelo motor (aba Fundação, seção 6: sadm_20N,
  sadm_20N_fx, sadm_mel, sadm_mel_fx com o SPT_b digitado), e não de uma fórmula escrita aqui. O teste
  (calculadoraDaTensao.test.ts) confere com o gabarito do Excel.
*/
import { calcular } from '@/motor';

export interface RegraDeTensao {
  /** σadm em kPa. */
  sadm: number;
  /** A planilha começa o texto da faixa com "Dentro" ou "Fora". */
  dentro: boolean;
  /** "Dentro (5 ≤ N ≤ 20)" / "Fora (vale para 5 ≤ N ≤ 20)", como a planilha escreve. */
  faixa: string;
}

export interface TensaoPeloSpt {
  regra20N: RegraDeTensao;
  mello: RegraDeTensao;
}

function regra(sadm: number | null, faixa: unknown): RegraDeTensao | null {
  if (sadm === null || !Number.isFinite(sadm) || typeof faixa !== 'string') return null;
  return { sadm, dentro: faixa.startsWith('Dentro'), faixa };
}

/** σadm da planilha pelas duas regras para um SPT (golpes), ou null se o SPT não serve (negativo, não número). */
export function tensaoPeloSpt(spt: number): TensaoPeloSpt | null {
  if (!Number.isFinite(spt) || spt < 0) return null;
  const r = calcular({ SPT_b: spt });
  const a = regra(r.num('sadm_20N'), r.v('sadm_20N_fx'));
  const b = regra(r.num('sadm_mel'), r.v('sadm_mel_fx'));
  return a && b ? { regra20N: a, mello: b } : null;
}
