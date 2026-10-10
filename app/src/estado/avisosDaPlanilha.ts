// ═══════════════════════════════════════════════════════════════════════════
//  estado/avisosDaPlanilha.ts — os avisos curtos que a PLANILHA publica
// ---------------------------------------------------------------------------
//  Algumas células da aba Entradas existem só para avisar: ficam VAZIAS
//  quando não há o que dizer e trazem um texto curto quando há. A primeira é
//  a da coesão (Jose, 08/10: "coesão liberada, com aviso" — aviso_coesao =
//  IF(c_solo>0; "c' > 0: escolha do projetista"; "")).
//
//  O app não escreve aviso próprio nem decide QUANDO avisar: lê a célula. Se
//  o texto ou a condição mudarem na planilha, mudam no campo, na barra de
//  estado, no card da memória e no rosto do memorial de uma vez — é uma
//  placa só, pendurada em quatro lugares, e não quatro placas pintadas à mão
//  que um dia discordam.
//
//  Cada aviso pertence a uma ENTRADA: é ao lado dela que a marca aparece no
//  painel. Aviso novo da planilha = linha nova em AVISOS.
//
//  Puro (sem React, sem store): o painel, a barra e a memória importam daqui.
// ═══════════════════════════════════════════════════════════════════════════

import type { Resultado, Valor } from '@/motor/tipos';

export interface AvisoDaPlanilha {
  /** Nome definido da célula do aviso ('aviso_coesao'). */
  nome: string;
  /** A entrada do painel ao lado da qual a marca aparece ('c_solo'). */
  campo: string;
  /** O texto da célula, como a planilha escreveu. */
  texto: string;
}

/**
 * As células de aviso e a entrada a que cada uma se refere. Só célula do
 * contrato "vazia = nada a avisar"; uma célula que publica "OK" quando está
 * tudo bem (lim_H, lim_Hs) não entra aqui sem tratar o "OK" — senão o "OK"
 * virava aviso.
 */
const AVISOS: ReadonlyArray<{ nome: string; campo: string }> = [
  { nome: 'aviso_coesao', campo: 'c_solo' },
  // passivo só com o solo da frente garantido na vida útil (Jose, 10/10: lembrar na hora de preencher)
  { nome: 'aviso_passivo', campo: 'pass_on' },
];

/** Só para o teste conferir que os nomes existem na planilha e no painel (nome errado não avisa nada). */
export const _avisos = AVISOS;

/**
 * O texto de uma célula de aviso, ou null quando ela não avisa. Vazio, "—"
 * (resultado embrulhado em IFERROR) e erro de fórmula não viram aviso: erro
 * na conta já aparece como erro, e um "#VALOR!" ao lado do campo não diria
 * nada a quem projeta.
 */
export function textoDoAviso(v: Valor): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t !== '' && t !== '—' ? t : null;
}

/** Os avisos que a conta atual levanta, na ordem de AVISOS. Sem conta (erro), nenhum. */
export function avisosDaPlanilha(r: Resultado | null): AvisoDaPlanilha[] {
  if (!r) return [];
  const out: AvisoDaPlanilha[] = [];
  for (const a of AVISOS) {
    const texto = textoDoAviso(r.v(a.nome));
    if (texto) out.push({ nome: a.nome, campo: a.campo, texto });
  }
  return out;
}

/** O texto de UM aviso da planilha pelo nome da célula, ou null — para o card da memória e o rosto. */
export function avisoDaPlanilha(r: Resultado, nome: string): string | null {
  return textoDoAviso(r.v(nome));
}

/** O que vai no pairar da marca ao lado do campo: os avisos dele, um por linha; null = sem marca. */
export function avisoDoCampo(avisos: readonly AvisoDaPlanilha[], campo: string): string | null {
  const daqui = avisos.filter((a) => a.campo === campo).map((a) => a.texto);
  return daqui.length ? daqui.join('\n') : null;
}

/**
 * A lista da barra de estado: os avisos da conta primeiro (são escolha de
 * projeto, pesam mais), depois os que a modulação deixou no muro. O número
 * da barra é o tamanho desta lista; o pairar mostra os textos.
 */
export function textosDosAvisos(
  daPlanilha: readonly AvisoDaPlanilha[],
  doModelo: readonly { texto: string }[] | null | undefined,
): string[] {
  return [...daPlanilha.map((a) => a.texto), ...(doModelo ?? []).map((a) => a.texto)];
}
