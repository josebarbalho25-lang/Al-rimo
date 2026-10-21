// ═══════════════════════════════════════════════════════════════════════════
//  estado/lembrete.ts — o que a MÁQUINA lembra entre uma sessão e outra
// ---------------------------------------------------------------------------
//  Conveniência, não dado: a aba aberta, os grupos recolhidos, a largura do
//  painel e o último projeto (para abrir o app e o muro estar lá). Tudo no
//  navegador, e tudo em try/catch: janela anônima, armazenamento cheio ou
//  bloqueado devolvem o padrão, e o app abre igual. Nada aqui pode impedir o
//  programa de subir.
//
//  ⚠️ O que volta do navegador é JSON de OUTRA sessão — pode ser de uma versão
//  antiga do app, ou "null" gravado por engano. Por isso quem lê diz o FORMATO
//  que espera (`valido`), e o que não tem esse formato vira o padrão. Sem isso,
//  um `null` guardado nos grupos derrubava o painel inteiro ao abrir.
// ═══════════════════════════════════════════════════════════════════════════

export const CHAVES = {
  aba: 'alrimo.aba.v1',
  /** O ícone do trilho aberto (estado/interface.ts). */
  secao: 'alrimo.secao.v1',
  grupos: 'alrimo.grupos.v1',
  /** A lista da esquerda recolhida (estado/interface.ts). */
  lista: 'alrimo.lista.v1',
  /** A aba da faixa de ferramentas da Gráfica (estado/grafica.ts). */
  faixa: 'alrimo.faixa.v1',
  /** O navegador da Gráfica recolhido (estado/grafica.ts). */
  navegador: 'alrimo.navegador.v1',
  /** Largura do painel em px na escala 100% (ver lembrarLarguraDoPainel). */
  largura: 'alrimo.largura.v2',
  ultimoProjeto: 'alrimo.ultimo.v1',
  /** Registro do aceite do Termo de Uso (estado/termo.ts). */
  termo: 'alrimo.termo.v1',
} as const;

export function lembrar<T>(chave: string, padrao: T, valido: (x: unknown) => x is T): T {
  try {
    const s = globalThis.localStorage?.getItem(chave);
    if (!s) return padrao;
    const v: unknown = JSON.parse(s);
    return valido(v) ? v : padrao;
  } catch {
    return padrao;
  }
}

export function guardar(chave: string, valor: unknown): void {
  try {
    globalThis.localStorage?.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem espaço ou bloqueado: na próxima sessão volta o padrão */
  }
}

/** Apaga uma chave (a de uma versão antiga, depois de migrada). */
export function esquecer(chave: string): void {
  try {
    globalThis.localStorage?.removeItem(chave);
  } catch {
    /* bloqueado: a chave velha fica, e não atrapalha — ninguém mais a lê */
  }
}

/*
  O QUE É DA ABA. O localStorage é UM para todas as abas do navegador: com dois
  muros abertos lado a lado (é assim que o Jose compara), o F5 numa aba trazia
  o muro da OUTRA, e o que não estava salvo nesta sumia sem pergunta. O
  sessionStorage é de cada aba e sobrevive ao F5 só nela. Então:
    · ler: primeiro o que ESTA aba guardou; aba nova (vazia) começa pelo que
      a máquina guardou por último — o "abrir o app e o muro estar lá";
    · gravar: nas duas — a da aba para o F5 dela, a da máquina para semear a
      próxima aba que abrir.
*/

const daAba = (): Storage | undefined => globalThis.sessionStorage;
const daMaquina = (): Storage | undefined => globalThis.localStorage;

export function lembrarDaAba<T>(chave: string, padrao: T, valido: (x: unknown) => x is T): T {
  for (const armazem of [daAba, daMaquina]) {
    try {
      const s = armazem()?.getItem(chave);
      if (!s) continue;
      const v: unknown = JSON.parse(s);
      if (valido(v)) return v;
    } catch {
      /* bloqueado ou estragado: tenta o próximo */
    }
  }
  return padrao;
}

/**
 * Grava na aba e na máquina. Devolve se o F5 DESTA aba vai achar o que foi
 * gravado (o da aba; onde não há armazenamento por aba, o da máquina) — quem
 * chama usa isso para perguntar antes de fechar quando nada ficou guardado.
 */
export function guardarNaAba(chave: string, valor: unknown): boolean {
  const texto = JSON.stringify(valor);
  let naAba: boolean | null = null; // null: este ambiente não tem armazenamento por aba
  try {
    const a = daAba();
    if (a) {
      a.setItem(chave, texto);
      naAba = true;
    }
  } catch {
    naAba = false;
  }
  let naMaquina = false;
  try {
    const m = daMaquina();
    if (m) {
      m.setItem(chave, texto);
      naMaquina = true;
    }
  } catch {
    /* sem espaço ou bloqueado */
  }
  return naAba ?? naMaquina;
}

/* ── formatos comuns ──────────────────────────────────────────────────── */

export const ehObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** { idDaSecao: aberta? } — o que o usuário abriu ou fechou no painel. */
export const ehMapaDeBooleanos = (x: unknown): x is Record<string, boolean> =>
  ehObjeto(x) && Object.values(x).every((v) => typeof v === 'boolean');

export const ehNumeroOuNulo = (x: unknown): x is number | null =>
  x === null || (typeof x === 'number' && Number.isFinite(x));

/* ── a largura do painel de entradas ─────────────────────────────────────
   Guardada em px na escala 100%, e a tela multiplica pela escala da vez. A v1
   guardava px de TELA: com a letra maior (o padrão subiu de 110% para 120%
   em 09/10, e a janela de Configurações deixa escolher), o painel que ele
   alargou ficaria do tamanho antigo, estreito para a letra nova, e o rótulo
   cortaria com reticências. Na escala, a largura acompanha a letra. */

const LARGURA_V1 = 'alrimo.largura.v1';
/** A escala em que a v1 foi gravada: 110% era a única que o app tinha. */
const ESCALA_DA_V1 = 1.1;

/** null = a largura de fábrica (duplo clique na alça). */
export const ehLarguraDoPainel = (x: unknown): x is number | null =>
  x === null || (typeof x === 'number' && x >= 150 && x <= 1000);

export function lembrarLarguraDoPainel(): number | null {
  try {
    if (globalThis.localStorage?.getItem(CHAVES.largura) == null) {
      // Ainda não há v2: converte a v1 (se houver) uma vez e apaga a velha.
      const v1 = lembrar(LARGURA_V1, null, ehNumeroOuNulo);
      esquecer(LARGURA_V1);
      const base = v1 === null ? null : Math.round(v1 / ESCALA_DA_V1);
      if (base === null || !ehLarguraDoPainel(base)) return null;
      guardar(CHAVES.largura, base);
      return base;
    }
  } catch {
    /* bloqueado: segue para a leitura comum, que devolve o padrão */
  }
  return lembrar(CHAVES.largura, null, ehLarguraDoPainel);
}
