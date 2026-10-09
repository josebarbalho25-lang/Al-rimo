// ═══════════════════════════════════════════════════════════════════════════
//  estado/recadoRuim.ts — a marca da má notícia
// ---------------------------------------------------------------------------
//  Copiado do A-PORT, junto com o motivo: lá, em 20/09/2026, uma importação
//  falhou e a mensagem saiu na barra de estado na MESMA cor verde de "Salvo
//  em ..." — o Jose leu a tela e concluiu que o programa não tinha feito nada.
//  Notícia ruim pintada de notícia boa é pior que notícia nenhuma. Quem dá a
//  má notícia prefixa o texto com esta marca; a barra pinta na cor de aviso.
// ═══════════════════════════════════════════════════════════════════════════

/** O prefixo que faz a barra de estado pintar o recado como aviso. */
export const RECADO_RUIM = '⚠ ';

/** O texto marcado como má notícia. */
export const ruim = (texto: string) => `${RECADO_RUIM}${texto}`;

export const ehRuim = (recado: string | null | undefined): boolean => !!recado?.startsWith(RECADO_RUIM);
