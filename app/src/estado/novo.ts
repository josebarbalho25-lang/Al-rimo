// ═══════════════════════════════════════════════════════════════════════════
//  estado/novo.ts — o muro NOVO e o muro de EXEMPLO
// ---------------------------------------------------------------------------
//  Jose, 13/10 ("Branco + exemplo à parte"): o Novo abre com os dados do
//  terreno e do projeto EM BRANCO — o usuário é obrigado a pensar neles — e
//  os automáticos seguros; a aula 12.2 vira um muro de exemplo para abrir.
//  Os padrões da planilha continuam sendo a aula (a regressão confere a aula
//  por eles): o Novo é a planilha MENOS esses números, gravado como alteração.
//
//  Enquanto falta dado, a conta roda (a memória mostra o que dá), mas o muro
//  não é montado e não há veredito: nada de 3D ou "passa" com número inventado.
// ═══════════════════════════════════════════════════════════════════════════

import type { Alteracoes, Valor } from '@/motor/tipos';
import { campoVisivel, entradaAtiva, type Campo, type LerConta, type LerValor } from './campos';

/*
  O que é do TERRENO e do PROJETO, e só o engenheiro sabe: alturas, comprimento, solo contido, sobrecarga, sapata e
  solo de apoio. Escolha de lista (tipo de muro, bloco, graute, fbk) fica no padrão: tem sempre uma opção válida e o
  painel mostra qual. Material e critério de norma (fyk, γ, FS mínimos, cobrimentos) também ficam: são da norma.
*/
export const EM_BRANCO_NO_NOVO: readonly string[] = [
  'H_muro', 'H_solo', 'NSPT', 'gama_solo', 'phi_solo', 'q_sobre',
  'B_sap', 'h_sap', 'a_ater', 'SPT_b', 'phi_base',
];
/** Do modelo (fora da planilha): o comprimento do muro. */
export const EM_BRANCO_NO_NOVO_MODELO: readonly string[] = ['L_total'];

/*
  Opcionais que a planilha traz com o número da AULA (Ka 0,4, espaçamento 40, d 14): digitados, eles passam por cima
  do automático. No Novo ficam vazios e vale o automático — o Ka pelo φ' (Rankine), o espaçamento pela conta, o d pela
  geometria. O K da flexão fica em 1,0 (o do curso, a favor; o automático da NBR daria 1,5 ou 2,0).
*/
export const AUTOMATICO_NO_NOVO: readonly string[] = ['Ka_dir', 's_dir', 'd_dir'];

/** Sem dente no muro novo (a aula tem um de 0,25 × 0,50): dente é decisão de projeto, e sem ele não há passivo. */
const SEM_DENTE: Readonly<Record<string, Valor>> = { b_den: 0, h_den: 0 };

export function alteracoesDoNovo(): Alteracoes {
  const a: Alteracoes = { ...SEM_DENTE };
  for (const n of [...EM_BRANCO_NO_NOVO, ...AUTOMATICO_NO_NOVO]) a[n] = null;
  return a;
}

export function extrasDoNovo(): Record<string, Valor> {
  const e: Record<string, Valor> = {};
  for (const n of EM_BRANCO_NO_NOVO_MODELO) e[n] = null;
  return e;
}

/*
  O EXEMPLO = a aula 12.2 (os padrões da planilha) com o que a regressão aplica para reproduzir a aula
  (tools/cenarios.py, AULA_122_ENTRADAS: σsg desligado e peso 3,0 como na aula) e a sapata a 0,45 m — a da aula,
  0,30, é flexível pela NBR 6118 22.6.1: (1,40 − 0,19)/3 = 0,403, e 0,40 fica 3 mm abaixo (Jose, 14/10: "a gente
  sobe 5 cm na altura" — de 5 em 5 cm, a primeira que passa é 0,45).
*/
export const TITULO_DO_EXEMPLO = 'Exemplo — aula 12.2';
export function alteracoesDoExemplo(): Alteracoes {
  return { sg_on: 'Não', peso_par: 3.0, h_sap: 0.45 };
}

/**
 * Os dados que faltam: entrada que a conta usa (visível no tipo de muro, não apagada), sem valor e que não é opcional
 * nem "auto" por natureza (padrão vazio na planilha). Na ordem do catálogo — a 1ª é para onde a barra de estado leva.
 */
export function dadosFaltando(campos: Iterable<Campo>, ler: LerValor, conta?: LerConta): string[] {
  const out: string[] = [];
  for (const c of campos) {
    const nome = c.meta.nome;
    if (c.opcional || c.meta.padrao === null) continue;
    if (ler(nome) !== null) continue;
    if (!campoVisivel(c, ler) || !entradaAtiva(nome, ler, conta)) continue;
    out.push(nome);
  }
  return out;
}
