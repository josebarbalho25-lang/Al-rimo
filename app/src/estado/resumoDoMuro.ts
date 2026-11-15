// ═══════════════════════════════════════════════════════════════════════════
//  estado/resumoDoMuro.ts — a ficha do muro em três ou quatro números
// ---------------------------------------------------------------------------
//  O que o Pró-Viga põe no meio da barra de estado ("VIGA VB2 · 15×40 cm
//  MATERIAL C30…") e na linha de baixo de cada cartão dos Recentes: o mínimo
//  que diz QUAL muro é este, sem abrir nada. Uma fonte só para os dois
//  lugares — o cartão do recente e a barra de estado não podem contar o muro
//  de jeitos diferentes.
//
//  Lido das ENTRADAS (o que foi pedido), não do resultado: a barra tem de dizer
//  o que se digitou mesmo com a conta em erro. O comprimento e o eixo a eixo
//  dos contrafortes são os AJUSTADOS (o muro desenhado), que é o que a conta usa.
// ═══════════════════════════════════════════════════════════════════════════

import type { LerValor } from './campos';

export interface ParDoResumo {
  /** O rótulo (a barra escreve em caixa alta e cinza). */
  k: string;
  /** O valor (em fonte de número). */
  v: string;
}

/** Número com vírgula; vazio ou não-número vira o traço (o Novo abre com o terreno em branco). */
export function numeroBR(x: unknown, casas = 2): string {
  return typeof x === 'number' && Number.isFinite(x) ? x.toFixed(casas).replace('.', ',') : '—';
}

const texto = (x: unknown): string => (typeof x === 'string' && x ? x : typeof x === 'number' ? String(x) : '—');

/** "bloco 19×39" (só a família 39 existe: o comprimento é fixo). */
function bloco(ler: LerValor): string {
  const t = ler('t_bloco');
  return `bloco ${typeof t === 'number' ? t : texto(t)}×39`;
}

/**
 * Os pares da barra de estado, na ordem de prioridade (a barra esconde de trás para a frente o que não cabe).
 * `comprimento` = o do muro desenhado (m); `vaoDosContrafortes` = o eixo a eixo adotado (m).
 */
export function resumoDoMuro(ler: LerValor, o: { comprimento: number | null; vaoDosContrafortes: number | null }): ParDoResumo[] {
  const tipo = ler('Tipo_muro');
  const contrafortes = tipo === 'Contrafortes';
  const pares: ParDoResumo[] = [
    { k: 'Muro', v: `${texto(tipo)} · ${bloco(ler)}` },
    { k: 'Altura', v: `muro ${numeroBR(ler('H_muro'))} · solo ${numeroBR(ler('H_solo'))} m` },
  ];
  // com contrafortes, o espaçamento identifica o muro mais que o comprimento: vem antes
  if (contrafortes) pares.push({ k: 'Contrafortes', v: `a cada ${numeroBR(o.vaoDosContrafortes ?? ler('l_cf'))} m` });
  pares.push({ k: 'Comprimento', v: `${numeroBR(o.comprimento)} m` });
  pares.push({ k: 'Sapata', v: `B ${numeroBR(ler('B_sap'))} · h ${numeroBR(ler('h_sap'))} m` });
  return pares;
}

/** A linha do cartão dos Recentes: "Balanço · bloco 19×39 · h 1,60 m". */
export function linhaDoRecente(ler: LerValor): string {
  return `${texto(ler('Tipo_muro'))} · ${bloco(ler)} · h ${numeroBR(ler('H_muro'))} m`;
}
