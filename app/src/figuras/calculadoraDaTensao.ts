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

/*
  φ' DO SOLO DE APOIO PELO SPT — SÓ CONSULTA (Jose, 16/11). O φ' da base continua digitado (laudo de sondagem); aqui a
  referência que a planilha publica (aba Fundação, seção 6): areia por Godoy (28° + 0,4·N) e por Teixeira
  (15° + √(20·N)), argila pela tabela por consistência (Joppert; su = 10·N). Cada uma com a faixa, como a planilha
  escreve. Nada é calculado aqui.
*/
export interface AtritoPeloSpt {
  godoy: { phi: number; faixa: string } | null;
  teixeira: { phi: number; faixa: string } | null;
  argila: { consistencia: string; phi: string; c: string; su: number | null; faixa: string } | null;
}

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export function atritoPeloSpt(spt: number): AtritoPeloSpt | null {
  if (!Number.isFinite(spt) || spt < 0) return null;
  const r = calcular({ SPT_b: spt });
  const um = (nome: string, fx: string) => {
    const v = r.num(nome);
    return v === null || !Number.isFinite(v) ? null : { phi: v, faixa: texto(r.v(fx)) };
  };
  const cons = texto(r.v('cons_b'));
  return {
    godoy: um('phib_god', 'phib_god_fx'),
    teixeira: um('phib_tei', 'phib_tei_fx'),
    argila: cons && !cons.startsWith('—')
      ? { consistencia: cons, phi: texto(r.v('phib_arg')), c: texto(r.v('cb_arg')), su: r.num('sub_arg'), faixa: texto(r.v('phib_arg_fx')) }
      : null,
  };
}
