/*
  VISTA PARA A PRANCHA — o que o modo prancha (pranchas/) pede a desenhos/: a vista numa ESCALA FIXA (1:25 é 1:25
  no papel, não "o que couber na tela"), sem o título interno (a prancha escreve o dela embaixo, com a escala) e com
  os ids prefixados (a folha junta várias vistas num SVG só; dois "des-solo" fariam a segunda vista pintar com o
  padrão da primeira).

  Volta o SVG (corpo + defs) para o PDF e as PRIMITIVAS — o mesmo traço, estruturado — para o DXF. As duas saídas
  vêm da mesma passada do desenho: não há como o DXF mostrar uma coisa e o PDF outra.

  A anotação não acompanha a escala: cota, texto, marca e espessura de traço têm tamanho fixo em px, e a folha
  converte px em mm de papel com PX_POR_MM. Em 1:25 ou 1:50 a cota sai com a mesma altura no papel (2,5 mm); o
  que muda é o muro.
*/
import type { Modelo } from '@/modelo/tipos';
import { escalaDaVista, type PedidoDeVista, type VistaParaPrancha } from '@/pranchas/tipos';
import { desenharVistaFrontal } from './vistaFrontal';
import { desenharCorteLateral } from './corteLateral';
import { desenharPlanta } from './planta';
import { desenharIsometrico } from './isometrico';
import type { OpcoesDaVista, Prancha } from './prancha';

/**
 * A vista pedida, na escala 1:`escala`, com os ids começando por `prefixo`.
 * - corte sem `x`: o corte padrão (barra mais perto do meio do 1º painel), o mesmo da aba Corte;
 * - planta: `fiada` conta de 0 (0 = 1ª fiada), como no desenharPlanta;
 * - `caixa` justa (margem 0): o respiro em volta e o título são da folha.
 */
export function vistaParaPrancha(m: Modelo, pedido: PedidoDeVista, escala: number, prefixo: string): VistaParaPrancha {
  const o: OpcoesDaVista = { S: escalaDaVista(escala), semTitulo: true, prefixo };
  let pr: Prancha;
  switch (pedido.tipo) {
    case 'frontal':
      pr = desenharVistaFrontal(m, o);
      break;
    case 'corte':
      pr = desenharCorteLateral(m, pedido.x, o);
      break;
    case 'planta':
      pr = desenharPlanta(m, pedido.fiada, o);
      break;
    case 'iso':
      pr = desenharIsometrico(m, { ...o, vista: pedido.vista, corteX: pedido.corteX ?? null });
      break;
  }
  const { viewBox, defs, corpo } = pr.partes(0);
  return { corpo, defs, caixa: viewBox, primitivas: pr.primitivas() };
}
