// ═══════════════════════════════════════════════════════════════════════════
//  ui/teclado.ts — de quem é a tecla
// ---------------------------------------------------------------------------
//  O Ctrl+Z do muro (App.tsx, useAtalhos) não pode roubar o do campo onde se
//  está digitando: ali ele desfaz a letra. Mas a lista (select), a caixinha de
//  marcar e o deslizador não têm o que desfazer — neles o Ctrl+Z é do muro:
//  escolher outro bloco e voltar atrás com o foco ainda na lista é o uso mais
//  comum (revisão de 20/10).
// ═══════════════════════════════════════════════════════════════════════════

/** Os tipos de <input> em que não se digita. */
const SEM_TEXTO = new Set(['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image']);

/** O alvo da tecla é um campo onde se DIGITA? (Sem `instanceof`: lê o elemento pelo que ele diz ser.) */
export function ehCampoDeTexto(alvo: unknown): boolean {
  const el = alvo as { tagName?: unknown; isContentEditable?: unknown; type?: unknown } | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable === true || el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  return !SEM_TEXTO.has(String(el.type ?? 'text').toLowerCase());
}
