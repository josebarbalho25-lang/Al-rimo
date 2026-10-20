// ═══════════════════════════════════════════════════════════════════════════
//  estado/interface.ts — o que a tela mostra, fora do muro
// ---------------------------------------------------------------------------
//  A SEÇÃO do trilho (Jose, 20/10: a organização do Pró-Viga e do A-PORT): seis
//  ícones fixos à esquerda — Início, Configurações, Entradas, Memória,
//  Quantitativo e Gráfica — e cada um é uma tela inteira. A entrada por
//  figuras deixou de ser janela por cima: é a seção Entradas. A lista de
//  entradas mora só na Memória (para conferir número contra entrada) e
//  recolhe para uma faixa fina, como antes.
//
//  Não vai para o arquivo .alrimo: é preferência de quem usa, não do muro.
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { CHAVES, guardar, guardarNaAba, lembrar, lembrarDaAba } from './lembrete';

const ehBooleano = (x: unknown): x is boolean => typeof x === 'boolean';

export type Secao = 'inicio' | 'configuracoes' | 'entradas' | 'memoria' | 'quantitativo' | 'grafica';
export const SECOES_DO_TRILHO: readonly Secao[] = ['inicio', 'configuracoes', 'entradas', 'memoria', 'quantitativo', 'grafica'];
const ehSecao = (x: unknown): x is Secao => SECOES_DO_TRILHO.includes(x as Secao);

/**
 * A seção ao abrir: a lembrada; sem ela (o app de antes de 20/10), a da aba que estava aberta — a Memória e o
 * Quantitativo eram abas e viraram seção; as outras abas são vistas da Gráfica.
 */
function secaoInicial(): Secao {
  const lembrada = lembrarDaAba<Secao | null>(CHAVES.secao, null, (x): x is Secao | null => x === null || ehSecao(x));
  if (lembrada) return lembrada;
  const aba = lembrarDaAba<string | null>(CHAVES.aba, null, (x): x is string | null => x === null || typeof x === 'string');
  return aba === 'memoria' || aba === 'quantitativo' ? aba : 'grafica';
}

interface EstadoDaInterface {
  secao: Secao;
  irPara: (secao: Secao) => void;
  /** Abre as Entradas (o Novo abre direto nelas, Jose 12/10). */
  abrirPorFiguras: () => void;
  /** Abre as Entradas na aba do campo e com o foco nele (o "Faltam N dados" da barra de estado). */
  abrirNoCampo: (nome: string) => void;
  /** O campo em que as Entradas abrem (null = a 1ª aba). Muda a cada pedido: quem abre lê e segue. */
  campoInicial: string | null;
  /** Cada pedido de campo ganha um número: o mesmo campo pedido duas vezes leva o foco de novo. */
  pedidoDeCampo: number;
  /** A lista da Memória está recolhida na faixa fina. */
  listaRecolhida: boolean;
  alternarLista: () => void;
}

export const useInterface = create<EstadoDaInterface>((set, get) => ({
  secao: secaoInicial(),
  irPara: (secao) => {
    guardarNaAba(CHAVES.secao, secao);
    // sair das Entradas esquece o campo pedido: voltar pelo trilho abre na 1ª aba, não no campo de antes
    set({ secao, campoInicial: secao === 'entradas' ? get().campoInicial : null });
  },
  campoInicial: null,
  pedidoDeCampo: 0,
  abrirPorFiguras: () => {
    get().irPara('entradas');
    set({ campoInicial: null });
  },
  abrirNoCampo: (nome) => {
    get().irPara('entradas');
    set({ campoInicial: nome, pedidoDeCampo: get().pedidoDeCampo + 1 });
  },
  listaRecolhida: lembrar(CHAVES.lista, false, ehBooleano),
  alternarLista: () => {
    const recolhida = !get().listaRecolhida;
    guardar(CHAVES.lista, recolhida);
    set({ listaRecolhida: recolhida });
  },
}));
