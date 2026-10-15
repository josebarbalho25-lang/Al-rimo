/*
  AS MEXIDAS NAS PRANCHAS — funções puras (pranchas antes → pranchas depois), as mesmas para a tela das pranchas e
  para o "Enviar para a prancha" que chega do 3D e das vistas. Uma regra só para "onde o desenho novo cai" e "qual
  folha recebe": a ativa, ou uma nova se ainda não há folha.
*/
import { quadroUtil } from './formatos';
import { novaFolha, novoId } from './padrao';
import type { Camera3d, ConteudoDoItem, Folha, ItemDaFolha, PedidoDeVista, PranchasDoProjeto } from './tipos';
import type { IdDaTabela } from './tabelaDaFolha';

export function naFolha(p: PranchasDoProjeto, id: string, f: (x: Folha) => Folha): PranchasDoProjeto {
  return { ...p, folhas: p.folhas.map((x) => (x.id === id ? f(x) : x)) };
}

export function noItem(p: PranchasDoProjeto, folha: string, item: string, f: (x: ItemDaFolha) => ItemDaFolha): PranchasDoProjeto {
  return naFolha(p, folha, (x) => ({ ...x, itens: x.itens.map((i) => (i.id === item ? f(i) : i)) }));
}

/** Lugar de partida para um desenho novo: em cascata a partir do canto superior esquerdo do quadro útil (a cada
 *  6 a cascata recomeça um pouco ao lado — o 7º não cai em cima do 1º). */
export function lugarNovo(folha: Folha): [number, number] {
  const [x0, y0] = quadroUtil(folha.formato, folha.orientacao);
  const k = folha.itens.length;
  const volta = Math.floor(k / 6);
  return [x0 + 15 + 20 * (k % 6) + 8 * volta, y0 + 15 + 20 * (k % 6)];
}

/** A folha ativa: a escolhida, ou a 1ª. A MESMA regra para a tela e para o "Enviar para a prancha". */
export function folhaAtiva(p: PranchasDoProjeto, ativa: string | null): Folha | null {
  return p.folhas.find((f) => f.id === ativa) ?? p.folhas[0] ?? null;
}

/** Prende o desenho na folha: pelo menos um canto de 10 mm dentro do papel (desenho fora fica inalcançável). */
export function dentroDaFolha(item: ItemDaFolha, larguraDaFolha: number, alturaDaFolha: number): ItemDaFolha {
  const x = Math.min(Math.max(item.x, -((item.largura ?? 100) - 10)), larguraDaFolha - 10);
  const y = Math.min(Math.max(item.y, 0), alturaDaFolha - 10);
  return x === item.x && y === item.y ? item : { ...item, x, y };
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
  let folha = folhaAtiva(p, alvo);
  let base = p;
  if (!folha) {
    folha = novaFolha('');
    base = { ...p, folhas: [...p.folhas, folha] };
  }
  const item = fazer(folha);
  const id = folha.id;
  return { pranchas: naFolha(base, id, (f) => ({ ...f, itens: [...f.itens, item] })), folha: id, item };
}

/**
 * Item de uma vista 2D, na escala de partida dela, com o título em branco (= automático: "Corte no contraforte C2",
 * "Planta — 1ª fiada"; o projetista escreve outro se quiser). O isométrico vai SEM escala: a projeção isométrica
 * encurta as medidas (fator 0,82), e "1:50" embaixo dele seria mentira.
 */
export function itemDaVista(folha: Folha, pedido: PedidoDeVista): ItemDaFolha {
  const [x, y] = lugarNovo(folha);
  if (pedido.tipo === 'iso') return { id: novoId('i'), conteudo: pedido, escala: null, x, y, largura: 160, altura: 110, titulo: '' };
  return { id: novoId('i'), conteudo: pedido, escala: ESCALA_INICIAL[pedido.tipo], x, y, titulo: '' };
}

/**
 * Item de uma tabela de materiais (blocos, materiais, drenagem): sem escala e sem tamanho próprio — a tabela tem o
 * tamanho que a letra da folha dá (tabelaDaFolha.ts); título em branco = o automático.
 */
export function itemDaTabela(folha: Folha, id: IdDaTabela): ItemDaFolha {
  const [x, y] = lugarNovo(folha);
  return { id: novoId('i'), conteudo: { tipo: 'tabela', id }, escala: null, x, y, titulo: '' };
}

/** Item do 3D: sem escala, com ~1/3 da largura útil da folha (até 180 mm) e a proporção da foto. */
export function itemDo3d(folha: Folha, camera: Camera3d, proporcao: number): ItemDaFolha {
  const [x0, , x1] = quadroUtil(folha.formato, folha.orientacao);
  const [x, y] = lugarNovo(folha);
  const largura = Math.round(Math.min(180, (x1 - x0) * 0.35));
  const prop = proporcao > 0.1 ? proporcao : 1.5;
  return { id: novoId('i'), conteudo: { tipo: '3d', camera, proporcao: prop }, escala: null, x, y, largura, altura: largura / prop, titulo: '' };
}
