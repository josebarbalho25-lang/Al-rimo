/*
  TAMANHOS E CORES DA MEMÓRIA — um jogo para a tela, outro para o papel.

  O papel é escrito direto em PONTOS e com cor fixa, inline: o Word só lê estilo inline (ignora folha de impressão,
  `zoom` e variável CSS). Foi a lição do Pró-Viga — lá o papel nascia em px com `zoom: 1.11` e uma função reescrevia
  cada nó antes de imprimir; aqui não há o que reescrever. Régua do dono (26-28/ago, Pró-Viga): corpo 10 pt, título
  de seção 12, nome do documento 14, regiões miúdas (glossário, notas, tabelas) 8 pt.
*/
import { createContext, useContext } from 'react';

export interface Regua {
  corpo: string;
  titulo: string;        // título do card
  secao: string;         // "1 · Coeficientes de empuxo"
  nota: string;          // referência ao lado do título, legenda
  chip: string;
  tabela: string;
  fonte: string;
  tinta: string;
  tinta2: string;
  apagado: string;
  filete: string;
  ok: string;
  falha: string;
  aviso: string;
}

const UI = 'var(--font-ui, "Segoe UI", system-ui, -apple-system, Arial, sans-serif)';

// Na tela, os tamanhos seguem a escala da interface (--fs-*, que o Jose ajusta nas preferências); o número é a reserva.
export const TELA: Regua = {
  corpo: 'var(--fs-corpo, 13px)',
  titulo: 'var(--fs-corpo, 13px)',
  secao: 'var(--fs-rotulo, 12.5px)',
  nota: 'var(--fs-nota, 11.5px)',
  chip: 'var(--fs-nota, 11.5px)',
  tabela: 'var(--fs-rotulo, 12.5px)',
  fonte: UI,
  tinta: 'var(--ink, #1d232b)',
  tinta2: 'var(--ink-2, #3a4450)',
  apagado: 'var(--muted, #6b7480)',
  filete: 'var(--line, #d9dee4)',
  ok: 'var(--ok, #2F7A4A)',
  falha: 'var(--err, #B33A2C)',
  aviso: 'var(--warn, #A86A00)',
};

export const PAPEL: Regua = {
  corpo: '10pt',
  titulo: '11pt',
  secao: '10pt',
  nota: '8pt',
  chip: '8pt',
  tabela: '8pt',
  fonte: '"Segoe UI", Arial, sans-serif',
  tinta: '#111111',
  tinta2: '#333333',
  apagado: '#666666',
  filete: '#CCCCCC',
  ok: '#2F7A4A',
  falha: '#B33A2C',
  aviso: '#A86A00',
};

/** true = o componente está desenhando o PAPEL (impressão/Word): legenda some, tamanhos em pt, cor fixa. */
export const PapelCtx = createContext(false);

export function useRegua(): { papel: boolean; R: Regua } {
  const papel = useContext(PapelCtx);
  return { papel, R: papel ? PAPEL : TELA };
}
