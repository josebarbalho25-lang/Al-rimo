// ═══════════════════════════════════════════════════════════════════════════
//  estado/termo.ts — o Termo de Uso: o texto, a versão e o registro do aceite
// ---------------------------------------------------------------------------
//  O texto vem do PRÓPRIO TERMO_DE_USO.md da raiz do projeto, importado como
//  texto no build. Uma cópia dentro do app envelheceria calada: o Jose mexe
//  no termo e a tela continuaria mostrando o antigo.
//
//  A VERSÃO é o número que o termo declara ("Versão do documento: 1.0") MAIS
//  uma impressão digital do texto mostrado. O número é o que se lê no
//  memorial; a impressão digital garante que QUALQUER mudança no texto (até
//  preencher o foro, até uma vírgula) peça aceite de novo — o item 13.1 diz
//  que o uso só continua com novo aceite, e um termo editado sem subir o
//  número passaria batido se valesse só o número. As notas internas e as
//  "Fontes consultadas" ficam FORA (não são o termo); mexer nelas não incomoda
//  ninguém.
//
//  O aceite fica no navegador (item 2.2), com o mesmo cuidado do lembrete.ts:
//  sem armazenamento (janela anônima, bloqueado) o app não trava — pede o
//  aceite a cada abertura e guarda o desta sessão na memória, para o rosto
//  do memorial ainda sair com a data.
// ═══════════════════════════════════════════════════════════════════════════

import bruto from '../../../TERMO_DE_USO.md?raw';
import { CHAVES, ehObjeto, guardar, lembrar } from './lembrete';

/** Onde o termo acaba e começa a pesquisa que o embasou (não é cláusula). */
const FIM_DO_TERMO = /^##\s+Fontes consultadas\s*$/m;

/*
  Quebra de linha e espaço sobrando no fim não são texto: o mesmo arquivo salvo
  no Windows (CRLF) e no Linux (LF) tem de dar a MESMA versão — senão o build
  do servidor pediria aceite de novo a todo mundo sem o termo ter mudado.
*/
function normalizar(md: string): string {
  return md
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n');
}

/** O termo como o usuário lê: do começo até antes de "Fontes consultadas", sem as réguas que sobram no fim. */
export function textoDoTermo(md: string): string {
  const t = normalizar(md);
  const m = FIM_DO_TERMO.exec(t);
  const linhas = (m ? t.slice(0, m.index) : t).split('\n');
  while (linhas.length && /^(\s*|-{3,}|\*{3,}|_{3,})$/.test(linhas[linhas.length - 1])) linhas.pop();
  return linhas.join('\n');
}

/** "**Versão do documento:** 1.0" → "1.0". Sem a linha, "?" — o rosto mostra, e a impressão digital ainda vale. */
export function numeroDoTermo(texto: string): string {
  const m = /\*\*Versão do documento:\*\*\s*([^\s*]+)/.exec(texto);
  return m ? m[1] : '?';
}

/*
  Impressão digital curta (FNV-1a de 32 bits, 8 dígitos hexadecimais). Não é
  segurança, é identidade: serve para dizer "este aceite foi DESTE texto".
  Síncrona de propósito — a decisão de mostrar ou não o termo sai antes do
  primeiro quadro, sem tela piscando.
*/
export function impressaoDigital(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const TEXTO_DO_TERMO = textoDoTermo(bruto);
export const NUMERO_DO_TERMO = numeroDoTermo(TEXTO_DO_TERMO);
/** O que se grava no aceite e se compara na abertura: "1.0+3fa2c19b". */
export const VERSAO_DO_TERMO = `${NUMERO_DO_TERMO}+${impressaoDigital(TEXTO_DO_TERMO)}`;

/** "1.0+3fa2c19b" → "1.0 (3fa2c19b)": o número para quem lê, a digital para quem dá suporte. */
export function rotuloDaVersao(versao: string): string {
  const i = versao.lastIndexOf('+');
  return i < 0 ? versao : `${versao.slice(0, i)} (${versao.slice(i + 1)})`;
}

/* ── o aceite ─────────────────────────────────────────────────────────── */

export interface Aceite {
  /** VERSAO_DO_TERMO do texto aceito. */
  versao: string;
  /** Data e hora do aceite, ISO 8601 (UTC): sem ambiguidade de fuso no arquivo. */
  em: string;
}

const ehAceite = (x: unknown): x is Aceite =>
  ehObjeto(x) && typeof x.versao === 'string' && typeof x.em === 'string' && !Number.isNaN(Date.parse(x.em));

/** O aceite desta sessão: vale quando o navegador não guarda nada. */
let daSessao: Aceite | null = null;

/** O último aceite registrado, de qualquer versão (null = nunca aceitou neste navegador). */
export function aceiteGuardado(): Aceite | null {
  return daSessao ?? lembrar<Aceite | null>(CHAVES.termo, null, (x): x is Aceite | null => x === null || ehAceite(x));
}

/** O aceite que libera o uso: só o do termo de AGORA. Termo novo → null → a tela pede de novo (13.1). */
export function aceiteVigente(versao: string = VERSAO_DO_TERMO): Aceite | null {
  const a = aceiteGuardado();
  return a && a.versao === versao ? a : null;
}

/** "Li e aceito": grava data, hora e versão (2.2). Se o navegador recusar, vale para esta sessão. */
export function aceitarTermo(agora: Date = new Date()): Aceite {
  const a: Aceite = { versao: VERSAO_DO_TERMO, em: agora.toISOString() };
  daSessao = a;
  guardar(CHAVES.termo, a);
  return a;
}

/** "09/10/2026 14:32" na hora local de quem aceitou — como se escreve a data numa folha. */
export function dataDoAceite(a: Aceite): string {
  const d = new Date(a.em);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
