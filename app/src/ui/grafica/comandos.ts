// ═══════════════════════════════════════════════════════════════════════════
//  ui/grafica/comandos.ts — abrir, criar, duplicar, renomear e excluir
// ---------------------------------------------------------------------------
//  O que o navegador e a faixa fazem com as vistas e as folhas. A conta das
//  vistas é a de pranchas/vistas.ts (a mesma de antes, que a lista "Vista" da
//  aba de desenho usava); aqui só se decide QUAL vista e quem vem para a
//  frente depois.
//
//  A FRENTE é a aba aberta que o palco mostra: o tipo é a aba do palco
//  (`useApp.aba`), e qual vista/folha é a escolhida daquele tipo
//  (`usePranchasUi`). O navegador não guarda uma cópia disso: lê dos mesmos
//  lugares que a aba de desenho e a tela das pranchas leem.
// ═══════════════════════════════════════════════════════════════════════════

import { useApp } from '@/estado/store';
import type { IdAba } from '@/estado/ligacoes';
import { useGrafica, type Aberta } from '@/estado/grafica';
import { abaDaGrafica } from '@/ui/Palco';
import { usePranchasUi } from '@/pranchas/ui';
import { folhaAtiva, naFolha } from '@/pranchas/acoes';
import { novaFolha } from '@/pranchas/padrao';
import { acharVista, duplicarVista, excluirVista, novaVista, ondeEstaAVista, renomearVista, vistasDoTipo, TIPOS_2D } from '@/pranchas/vistas';
import type { PedidoDeVista, PranchasDoProjeto } from '@/pranchas/tipos';

export type Tipo2D = PedidoDeVista['tipo'];
export const eh2D = (aba: IdAba): aba is Tipo2D => (TIPOS_2D as readonly string[]).includes(aba);

/** Qual vista/folha a aba de um tipo mostra agora (a escolhida, ou a 1ª — como a aba de desenho faz). */
export function idNaAba(aba: IdAba, p: PranchasDoProjeto, vistaAtiva: Partial<Record<string, string>>, folhaDaVez: string | null): string | null {
  if (eh2D(aba)) {
    const vs = vistasDoTipo(p, aba);
    return (vs.find((v) => v.id === vistaAtiva[aba]) ?? vs[0]).id;
  }
  if (aba === 'pranchas') return folhaAtiva(p, folhaDaVez)?.id ?? null;
  return null;
}

/** A aba aberta que está na frente (null = fechou tudo). */
export function frente(): Aberta | null {
  if (useGrafica.getState().nadaAberto) return null;
  const aba = abaDaGrafica(useApp.getState().aba);
  const ui = usePranchasUi.getState();
  return { aba, id: idNaAba(aba, useApp.getState().pranchas, ui.vistaAtiva, ui.ativa) };
}

/** A frente, para quem desenha (refaz quando qualquer um dos lados muda). */
export function useFrente(): Aberta | null {
  const nada = useGrafica((s) => s.nadaAberto);
  const aba = useApp((s) => abaDaGrafica(s.aba));
  const pranchas = useApp((s) => s.pranchas);
  const vistaAtiva = usePranchasUi((s) => s.vistaAtiva);
  const ativa = usePranchasUi((s) => s.ativa);
  if (nada) return null;
  return { aba, id: idNaAba(aba, pranchas, vistaAtiva, ativa) };
}

/** Abre (se ainda não está aberta) e traz para a frente. */
export function trazer(a: Aberta): void {
  // "as pranchas" sem dizer qual folha: a ativa (a aba precisa saber qual é para não abrir duas da mesma folha)
  if (a.aba === 'pranchas' && a.id === null) a = { aba: 'pranchas', id: folhaAtiva(useApp.getState().pranchas, usePranchasUi.getState().ativa)?.id ?? null };
  if (eh2D(a.aba) && a.id) usePranchasUi.getState().escolherVista(a.aba, a.id);
  if (a.aba === 'pranchas') usePranchasUi.getState().definirAtiva(a.id);
  useApp.getState().escolherAba(a.aba);
  useGrafica.getState().abrir(a);
}

/** Fecha a aba; a vizinha vem para a frente. */
export function fechar(a: Aberta): void {
  const f = frente();
  const vizinha = useGrafica.getState().fechar(a);
  const eraAFrente = !!f && f.aba === a.aba && f.id === a.id;
  if (eraAFrente && vizinha) trazer(vizinha);
}

const mudar = (f: (p: PranchasDoProjeto) => PranchasDoProjeto) => useApp.getState().mudarPranchas(f);

export function criarVista(tipo: Tipo2D): void {
  const r = novaVista(useApp.getState().pranchas, tipo);
  mudar(() => r.pranchas);
  trazer({ aba: tipo, id: r.vista.id });
}

export function duplicar(id: string): void {
  const v = acharVista(useApp.getState().pranchas, id);
  if (!v || v.conteudo.tipo === '3d') return;
  const r = duplicarVista(useApp.getState().pranchas, id);
  if (!r) return;
  mudar(() => r.pranchas);
  trazer({ aba: v.conteudo.tipo, id: r.vista.id });
}

/** A vista existe de verdade (gravada)? A de fábrica, virtual, não se exclui: ela é o que o tipo mostra sem nenhuma. */
export const vistaGravada = (id: string): boolean => useApp.getState().pranchas.vistas.some((v) => v.id === id);

export function excluir(id: string): void {
  const p = useApp.getState().pranchas;
  const v = p.vistas.find((x) => x.id === id);
  if (!v) return;
  const ja = ondeEstaAVista(p, id);
  const aviso = ja ? ` Ela sai da folha ${String(ja.numero).padStart(2, '0')}.` : '';
  if (!window.confirm(`Excluir a vista "${v.nome}"?${aviso}`)) return;
  const tipo = v.conteudo.tipo;
  mudar((q) => excluirVista(q, id));
  if (tipo === '3d') return;
  // a aba dela fecha; se era a da frente, a vizinha vem — e se a vista era a única do tipo, a de fábrica toma o lugar
  fechar({ aba: tipo, id });
  const resto = vistasDoTipo(useApp.getState().pranchas, tipo);
  if (usePranchasUi.getState().vistaAtiva[tipo] === id && resto[0]) usePranchasUi.getState().escolherVista(tipo, resto[0].id);
}

export function criarFolha(): void {
  const f = novaFolha('');
  mudar((p) => ({ ...p, folhas: [...p.folhas, f] }));
  trazer({ aba: 'pranchas', id: f.id });
}

export function excluirFolha(id: string): void {
  const p = useApp.getState().pranchas;
  const i = p.folhas.findIndex((f) => f.id === id);
  if (i < 0) return;
  const f = p.folhas[i];
  // a folha montada não some com um clique sem volta
  if (f.itens.length && !window.confirm(`Excluir a folha ${String(i + 1).padStart(2, '0')} com ${f.itens.length} desenho(s)?`)) return;
  mudar((q) => ({ ...q, folhas: q.folhas.filter((x) => x.id !== id) }));
  fechar({ aba: 'pranchas', id });
  if (usePranchasUi.getState().ativa === id) usePranchasUi.getState().definirAtiva(null);
}

/** O nome reescrito no navegador: da vista, ou o conteúdo da folha ("01 · Contrafortes"). */
export function confirmarNome(id: string, nome: string): void {
  const p = useApp.getState().pranchas;
  const limpo = nome.trim();
  const folha = p.folhas.find((f) => f.id === id);
  if (folha) {
    if (limpo !== folha.conteudo) mudar((q) => naFolha(q, id, (f) => ({ ...f, conteudo: limpo })));
    return;
  }
  const v = acharVista(p, id);
  if (v && limpo && limpo !== v.nome) mudar((q) => renomearVista(q, id, limpo));
}
