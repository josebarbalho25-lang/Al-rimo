/*
  AS MEXIDAS NAS PRANCHAS — funções puras (pranchas antes → pranchas depois), as mesmas para a tela das pranchas e
  para o "Enviar para a prancha" que chega do 3D e das vistas. Uma regra só para "onde o desenho novo cai" e "qual
  folha recebe": a ativa, ou uma nova se ainda não há folha.
*/
import { quadroUtil } from './formatos';
import { novaFolha, novoId } from './padrao';
import type { Camera3d, ConteudoDoItem, Folha, ItemDaFolha, PedidoDeVista, PranchasDoProjeto } from './tipos';

export function naFolha(p: PranchasDoProjeto, id: string, f: (x: Folha) => Folha): PranchasDoProjeto {
  return { ...p, folhas: p.folhas.map((x) => (x.id === id ? f(x) : x)) };
}

export function noItem(p: PranchasDoProjeto, folha: string, item: string, f: (x: ItemDaFolha) => ItemDaFolha): PranchasDoProjeto {
  return naFolha(p, folha, (x) => ({ ...x, itens: x.itens.map((i) => (i.id === item ? f(i) : i)) }));
}

/** Lugar de partida para um desenho novo: em cascata a partir do canto superior esquerdo do quadro útil. */
export function lugarNovo(folha: Folha): [number, number] {
  const [x0, y0] = quadroUtil(folha.formato, folha.orientacao);
  const k = folha.itens.length;
  return [x0 + 15 + 20 * (k % 6), y0 + 15 + 20 * (k % 6)];
}

export const NOMES_DO_CONTEUDO: Record<ConteudoDoItem['tipo'], string> = {
  frontal: 'Vista frontal',
  corte: 'Corte',
  planta: 'Planta',
  iso: 'Isométrico',
  '3d': 'Perspectiva',
  detalhe: 'Detalhe',
  tabela: 'Tabela',
};

/** Escala de partida de cada vista: o corte é a peça que se cota miúdo. */
export const ESCALA_INICIAL: Record<PedidoDeVista['tipo'], number> = { frontal: 50, corte: 25, planta: 50, iso: 50 };

/**
 * Põe um desenho na folha `alvo` (ou numa folha nova, se não há nenhuma ou a pedida sumiu). Devolve as pranchas
 * novas, a folha que recebeu e o item criado.
 */
export function porNaFolha(p: PranchasDoProjeto, alvo: string | null, fazer: (folha: Folha) => ItemDaFolha): { pranchas: PranchasDoProjeto; folha: string; item: ItemDaFolha } {
  let folha = p.folhas.find((f) => f.id === alvo) ?? p.folhas[p.folhas.length - 1];
  let base = p;
  if (!folha) {
    folha = novaFolha('');
    base = { ...p, folhas: [...p.folhas, folha] };
  }
  const item = fazer(folha);
  const id = folha.id;
  return { pranchas: naFolha(base, id, (f) => ({ ...f, itens: [...f.itens, item] })), folha: id, item };
}

/** Item de uma vista 2D, na escala de partida dela. */
export function itemDaVista(folha: Folha, pedido: PedidoDeVista): ItemDaFolha {
  const [x, y] = lugarNovo(folha);
  return { id: novoId('i'), conteudo: pedido, escala: ESCALA_INICIAL[pedido.tipo], x, y, titulo: NOMES_DO_CONTEUDO[pedido.tipo] };
}

/** Item do 3D: sem escala, com ~1/3 da largura útil da folha (até 180 mm) e a proporção da foto. */
export function itemDo3d(folha: Folha, camera: Camera3d, proporcao: number): ItemDaFolha {
  const [x0, , x1] = quadroUtil(folha.formato, folha.orientacao);
  const [x, y] = lugarNovo(folha);
  const largura = Math.round(Math.min(180, (x1 - x0) * 0.35));
  const prop = proporcao > 0.1 ? proporcao : 1.5;
  return { id: novoId('i'), conteudo: { tipo: '3d', camera, proporcao: prop }, escala: null, x, y, largura, altura: largura / prop, titulo: NOMES_DO_CONTEUDO['3d'] };
}
