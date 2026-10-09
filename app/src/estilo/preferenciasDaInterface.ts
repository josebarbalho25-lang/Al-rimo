// ═══════════════════════════════════════════════════════════════════════════
//  estilo/preferenciasDaInterface.ts — tamanho, tema, densidade e cores
// ---------------------------------------------------------------------------
//  Copiado do A-PORT (src/estilo/preferenciasDaInterface.ts) e editado na
//  janela de Configurações (ui/Configuracoes.tsx), aberta pela engrenagem da
//  barra de cima — o mesmo lugar e os mesmos controles do A-PORT.
//
//  ⚠️ ISTO É PREFERÊNCIA DA MÁQUINA, NÃO DO PROJETO. Vai para o navegador, e
//  não para dentro do `.alrimo`: o tamanho da letra é escolhido por causa DESTE
//  monitor. Se viajasse no arquivo, abrir o muro de um colega redimensionaria
//  a interface inteira.
//
//  ⚠️ E NÃO ALCANÇA O DESENHO. A escala é multiplicador de CSS e para na
//  moldura; por isso é uma variável (`--escala-ui`) e não um `zoom` na página —
//  `zoom` esticaria o `<canvas>` do 3D junto e a mira do clique erraria.
//
//  ⚠️ O NAVEGADOR GUARDA SÓ O QUE O USUÁRIO ESCOLHEU, não o objeto inteiro.
//  A versão 1 gravava tudo a cada clique: trocar o tema gravava junto a escala
//  de fábrica, e quando o padrão subiu (09/10) quem já tinha clicado no tema
//  ficaria preso no tamanho antigo sem nunca ter escolhido tamanho nenhum.
//  Guardando só a escolha, o padrão de fábrica pode mudar de novo e chega a
//  todo mundo que não mexeu naquele ajuste.
// ═══════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';

const CHAVE = 'alrimo.interface.v2';
/** A chave antiga (objeto inteiro). Lida uma vez, migrada e apagada. */
const CHAVE_V1 = 'alrimo.interface.v1';

export type Tema = 'dark' | 'modern' | 'paper';
export type Densidade = 'compact' | 'default' | 'cozy';

export interface PreferenciasDaInterface {
  /** Multiplicador da moldura. 1 = a régua de texto do A-PORT a 100%. */
  escala: number;
  /** Escuro, claro ou papel. */
  tema: Tema;
  /** O aperto das linhas: compacta, padrão, confortável. */
  densidade: Densidade;
  /** O que já foi pego (e a ênfase da tela). `null` = deixa o tema decidir. */
  corSelecao: string | null;
  /** Onde o muro não passa. `null` = deixa o tema decidir. */
  corAlerta: string | null;
}

/**
 * O PADRÃO DE FÁBRICA. 120%, e não os 110% do A-PORT: o Jose comparou lado a
 * lado com Revit e TQS e achou a letra pequena, duas vezes (09/10). O Al-rimo
 * é um programa de FORMULÁRIO — passa-se o tempo lendo rótulo e número —, e a
 * 120% o rótulo do painel fica em 15 px (12,5 × 1,2), a unidade e o título do
 * grupo em ~14 px, o número do campo em ~15,6 px. Nos 110% herdados o miúdo
 * (unidade, título de grupo, cabeçalho de tabela) ficava em 12,7 px.
 * Os degraus de texto (tokens.css) continuam os do A-PORT de propósito: 120%
 * aqui é o mesmo tamanho que 120% lá.
 */
export const PADRAO: PreferenciasDaInterface = {
  escala: 1.2,
  tema: 'dark',
  densidade: 'cozy',
  corSelecao: null,
  corAlerta: null,
};

/** Os degraus oferecidos, de 10 em 10%. Fora deles não há campo livre — não faz falta. */
export const ESCALAS = [0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

/** A ordem do botão de tema: escuro → claro → papel → escuro. */
export const TEMAS: readonly Tema[] = ['dark', 'modern', 'paper'];

/** O nome que o botão de tema e a janela mostram. */
export const NOME_DO_TEMA: Record<Tema, string> = { dark: 'Escuro', modern: 'Claro', paper: 'Papel' };

export const DENSIDADES: readonly Densidade[] = ['compact', 'default', 'cozy'];

export const NOME_DA_DENSIDADE: Record<Densidade, string> = {
  compact: 'Compacta',
  default: 'Padrão',
  cozy: 'Confortável',
};

/**
 * Onde cada cor escreve. O nome à esquerda é o do painel de cores do Revit.
 * A Pré-seleção do A-PORT não veio: aqui nada acende sob o cursor, e um
 * ajuste que não muda nada na tela é pior do que nenhum.
 */
export const CORES = [
  { campo: 'corSelecao', rotulo: 'Seleção', token: '--accent-3' },
  { campo: 'corAlerta', rotulo: 'Alerta', token: '--err' },
] as const satisfies ReadonlyArray<{ campo: keyof PreferenciasDaInterface; rotulo: string; token: string }>;

type Escolhas = Partial<PreferenciasDaInterface>;

const ehCor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);

/**
 * Só passa o que tem o formato certo. O que volta do navegador é JSON de outra
 * sessão (talvez de outra versão do app): um campo estragado vira "não
 * escolhido" e cai no padrão, sem levar os outros junto.
 */
function filtrar(x: unknown): Escolhas {
  if (typeof x !== 'object' || x === null) return {};
  const p = x as Record<string, unknown>;
  const e: Escolhas = {};
  if (typeof p.escala === 'number' && p.escala > 0.5 && p.escala < 3) e.escala = p.escala;
  if (TEMAS.includes(p.tema as Tema)) e.tema = p.tema as Tema;
  if (DENSIDADES.includes(p.densidade as Densidade)) e.densidade = p.densidade as Densidade;
  for (const c of CORES) {
    const v = p[c.campo];
    if (v === null || ehCor(v)) e[c.campo] = v;
  }
  return e;
}

function gravar(e: Escolhas): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* sem espaço ou navegador travado: volta ao padrão na próxima sessão, e tudo bem */
  }
}

/**
 * A v1 guardava o objeto inteiro, então não dá para saber o que foi escolha.
 * Só o TEMA era: era o único botão que existia (o da barra de cima). Escala,
 * densidade e cores eram o padrão de fábrica copiado junto — trazê-los para cá
 * travaria o padrão novo, que é exatamente o que esta migração evita.
 */
function migrarDaV1(): Escolhas {
  const s = localStorage.getItem(CHAVE_V1);
  if (!s) return {};
  let e: Escolhas = {};
  try {
    const tema = filtrar(JSON.parse(s)).tema;
    if (tema) e = { tema };
  } catch {
    /* v1 estragada: fica sem escolha nenhuma */
  }
  gravar(e);
  localStorage.removeItem(CHAVE_V1);
  return e;
}

function lerEscolhas(): Escolhas {
  try {
    const s = localStorage.getItem(CHAVE);
    return s ? filtrar(JSON.parse(s)) : migrarDaV1();
  } catch {
    return {};
  }
}

function montar(e: Escolhas): PreferenciasDaInterface {
  return { ...PADRAO, ...e };
}

/**
 * A cor que a amostra mostra quando ninguém escolheu nada: a do tema atual.
 * Sem isto o seletor de cor abriria em preto, mentindo sobre o que está na
 * tela. Lê do CORPO: é lá que o tema declara as cores.
 */
export function corDoTema(token: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(token).trim();
  return ehCor(v) ? v : '#000000';
}

let selo = 0;

/**
 * Escreve as preferências no documento. É o único ponto que toca o CSS — todo o
 * resto do app só lê as variáveis.
 */
export function aplicarPreferencias(p: PreferenciasDaInterface): void {
  // A ESCALA vai na RAIZ (é declarada no `:root` próprio, fora do tema); as
  // CORES vão no CORPO, porque é lá que o tema as declara — escritas na raiz,
  // o tema escuro as redeclararia por cima.
  document.documentElement.style.setProperty('--escala-ui', String(p.escala));
  const corpo = document.body;
  corpo.dataset.theme = p.tema;
  corpo.dataset.density = p.densidade;
  for (const c of CORES) {
    const valor = p[c.campo];
    if (valor) corpo.style.setProperty(c.token, valor);
    else corpo.style.removeProperty(c.token);
  }
  // O 3D não observa variável de CSS — observa ATRIBUTO no body (é como o
  // A-PORT repinta o palco). Sem este carimbo a moldura muda e o palco não.
  corpo.dataset.cores = String(++selo);
}

/* ── o estado vivo ──────────────────────────────────────────────────────────
   A barra de cima (botão de tema) e a janela de Configurações mostram a mesma
   preferência: as duas assinam aqui, e trocar o tema numa redesenha a outra.
   A fonte da verdade continua sendo o navegador; isto é só o espelho dele. */

let atual: PreferenciasDaInterface | null = null;
const ouvintes = new Set<() => void>();

function assinar(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** As preferências em vigor (lidas do navegador na primeira vez). */
export function preferenciasAtuais(): PreferenciasDaInterface {
  return (atual ??= montar(lerEscolhas()));
}

/** As preferências em vigor, redesenhando o componente quando mudam. */
export function usePreferencias(): PreferenciasDaInterface {
  return useSyncExternalStore(assinar, preferenciasAtuais);
}

function guardarEAplicar(e: Escolhas): PreferenciasDaInterface {
  gravar(e);
  const p = montar(e);
  aplicarPreferencias(p);
  atual = p;
  for (const f of ouvintes) f();
  return p;
}

/** Muda um ajuste, grava e aplica. Devolve o estado novo. */
export function definirPreferencia<K extends keyof PreferenciasDaInterface>(
  chave: K,
  valor: PreferenciasDaInterface[K],
): PreferenciasDaInterface {
  return guardarEAplicar({ ...lerEscolhas(), [chave]: valor });
}

/** Volta as cores ao que o tema manda, sem mexer no tamanho. */
export function restaurarCores(): PreferenciasDaInterface {
  const e = lerEscolhas();
  for (const c of CORES) delete e[c.campo];
  return guardarEAplicar(e);
}

/** O tema seguinte na roda do botão. */
export function proximoTema(tema: Tema): Tema {
  const i = TEMAS.indexOf(tema);
  return TEMAS[(i + 1) % TEMAS.length];
}
