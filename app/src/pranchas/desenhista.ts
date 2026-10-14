/*
  O DESENHISTA DAS PRANCHAS — quem entrega à folha o desenho de cada item, já pronto para o papel, e guarda o que já
  desenhou: arrastar um desenho pela folha não pode redesenhar o muro a cada passo do mouse (a folha só se recompõe;
  o corte, a planta e o 3D ficam no cache enquanto o muro, a escala e o pedido forem os mesmos).

  Por enquanto todos os itens chegam "a caminho" (null): as vistas em escala e o 3D em vetor/foto entram aqui quando
  as frentes de desenhos/ e visor/ forem juntadas.
*/
import type { Modelo } from '@/modelo/tipos';
import type { ItemDesenhado } from './folha';
import type { ItemDaFolha } from './tipos';

export interface Desenhista {
  desenhar: (item: ItemDaFolha, prefixo: string) => ItemDesenhado | null;
}

export function criarDesenhista(_modelo: Modelo | null): Desenhista {
  return { desenhar: () => null };
}
