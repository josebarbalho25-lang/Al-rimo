/*
  VISTA PARA A PRANCHA — o que o modo prancha (pranchas/) pede a desenhos/: a vista numa ESCALA FIXA (1:25 é 1:25
  no papel, não "o que couber na tela"), sem o título interno (a prancha escreve o dela embaixo, com a escala) e com
  os ids prefixados (a folha junta várias vistas num SVG só; dois "des-solo" fariam a segunda vista pintar com o
  padrão da primeira).

  Volta o SVG (corpo + defs) para o PDF e as PRIMITIVAS — o mesmo traço, estruturado — para o DXF. As duas saídas
  vêm da mesma passada do desenho: não há como o DXF mostrar uma coisa e o PDF outra. Com `hachuraVetorial` (o
  arquivo), a hachura do SVG sai em traço, sem <pattern> (prancha.ts, "HACHURA EM VETOR"); a tela segue com o
  padrão, e as primitivas são as mesmas nos dois casos.

  A anotação não acompanha a escala: cota, texto, marca e espessura de traço têm tamanho fixo em px, e a folha
  converte px em mm de papel com PX_POR_MM. Em 1:25 ou 1:50 a cota sai com a mesma altura no papel (2,5 mm); o
  que muda é o muro.
*/
import type { SobreposicaoDaVista } from './graficos';
import type { Modelo } from '@/modelo/tipos';
import { PX_POR_MM, escalaDaVista, type AnotacaoPosta, type Camera3d, type ChamadaPosta, type CotaNova, type EtiquetaNova, type PedidoDeVista, type Primitiva, type TextoNovo, type VistaParaPrancha } from '@/pranchas/tipos';
import { desenharVistaFrontal } from './vistaFrontal';
import { desenharCorteLateral } from './corteLateral';
import { desenharPlanta } from './planta';
import { desenharIsometrico } from './isometrico';
import { desenharArmacaoDaSapata } from './armacaoDaSapata';
import { aparece, naVista } from './graficos';
import { desenharVista3d, larguraProjetada, semArestasEscondidas } from './vista3d';
import type { OpcoesDaVista, Prancha } from './prancha';

/**
 * A vista pedida, na escala 1:`escala`, com os ids começando por `prefixo`.
 * - corte sem `x`: o corte padrão (barra mais perto do meio do 1º painel), o mesmo da aba Corte;
 * - planta: `fiada` conta de 0 (0 = 1ª fiada), como no desenharPlanta;
 * - `caixa` justa (margem 0): o respiro em volta e o título são da folha.
 */
export function vistaParaPrancha(
  m: Modelo,
  pedido: PedidoDeVista,
  escala: number,
  prefixo: string,
  opcoes: {
    legendaDeCores?: boolean;
    hachuraVetorial?: boolean;
    chamadas?: Readonly<Record<string, ChamadaPosta>>;
    /** O que o projetista fez nas anotações deste desenho na folha: ajustes nas automáticas e as criadas. */
    anotacoes?: Readonly<Record<string, AnotacaoPosta>>;
    cotas?: readonly CotaNova[];
    textos?: readonly TextoNovo[];
    etiquetas?: readonly EtiquetaNova[];
    /** A sobreposição de gráficos da vista. */
    graficos?: SobreposicaoDaVista;
  } = {},
): VistaParaPrancha {
  // a legenda das cores dos blocos vai uma vez só, no quadro lateral da folha — a não ser que a folha peça (quadro
  // fechado)
  // `hachuraVetorial`: a folha pede quando compõe para o arquivo — o <pattern> o Chrome imprime como imagem
  const S = escalaDaVista(escala);
  const o: OpcoesDaVista = {
    S, semTitulo: true, prefixo, semLegendaDeCores: !opcoes.legendaDeCores, hachuraVetorial: opcoes.hachuraVetorial,
    chamadas: true, chamadasPostas: opcoes.chamadas, anotacoes: opcoes.anotacoes, etiquetas: opcoes.etiquetas, graficos: opcoes.graficos,
  };
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
    case 'armacao':
      pr = desenharArmacaoDaSapata(m, o);
      break;
    case 'iso':
      pr = desenharIsometrico(m, { ...o, vista: pedido.vista, corteX: pedido.corteX ?? null });
      return semEscondidasNoIso(entregar(pr));
  }
  // as cotas e os textos criados na folha, por cima e fora da caixa que prende o desenho; a cota nova some junto
  // quando as cotas da vista estão desligadas (Mostrar)
  pr.desenharNovas(naVista(pedido.tipo, () => aparece(pedido.tipo, 'cotas'), opcoes.graficos) ? opcoes.cotas : [], opcoes.textos, S);
  return entregar(pr, S);
}

/**
 * O 3D do visor em VETOR (estilos Cores e Opaco; o Realista vai como foto): o que estava na tela — a mesma direção
 * de olhar, o corte, o que estava oculto, a Armadura — com o desenho (tudo o que estava aceso, o véu do terreno
 * junto) ocupando `larguraMm` de papel; a legenda vem embaixo, dentro da caixa. A câmera do visor é ortográfica:
 * dá para pedir escala de verdade depois (desenharVista3d aceita S direto, como as outras vistas).
 */
export function vista3dParaPrancha(m: Modelo, camera: Camera3d, larguraMm: number, prefixo: string, opcoes: { legendaDeCores?: boolean; hachuraVetorial?: boolean } = {}): VistaParaPrancha {
  const w = larguraProjetada(m, camera);
  // muro sem largura (vazio, ou visto de quina exata): fica em 1:50, para a folha não receber escala infinita
  const S = w > 1e-6 ? (larguraMm * PX_POR_MM) / w : escalaDaVista(50);
  return entregar(desenharVista3d(m, camera, { S, semTitulo: true, prefixo, semLegendaDeCores: !opcoes.legendaDeCores, hachuraVetorial: opcoes.hachuraVetorial }));
}

/**
 * O isométrico usa o mesmo pintor do 3D: no PDF o pintor resolve, mas no DXF (com as faces numa camada que o
 * cadista congela para plotar em preto e branco) as arestas de trás apareciam todas. As primitivas das peças passam
 * pela mesma remoção de linhas ocultas do 3D; a legenda e os textos (o fim do rastro) seguem como estão.
 */
function semEscondidasNoIso(v: VistaParaPrancha): VistaParaPrancha {
  const ps = v.primitivas;
  const camada = (q: Primitiva): string =>
    q.k === 'linha' || q.k === 'polilinha' ? q.e.camada : q.k === 'circulo' ? q.e?.camada ?? '' : q.k === 'bloco' ? '' : q.camada;
  let fim = ps.findIndex((q) => ['legenda', 'textos', 'cotas', 'titulos'].includes(camada(q)));
  if (fim < 0) fim = ps.length;
  return { ...v, primitivas: [...semArestasEscondidas(ps.slice(0, fim), fim, false), ...ps.slice(fim)] };
}

/**
 * O que a folha recebe da vista. Anotação editável e parte com origem própria só nas vistas EM ESCALA (com S): o
 * isométrico e o 3D não aplicam ajuste — publicar o texto deles deixaria arrastar e o desenho voltaria sozinho.
 */
function entregar(pr: Prancha, S?: number): VistaParaPrancha {
  const { viewBox, referencia, defs, corpo } = pr.partes(0);
  const v: VistaParaPrancha = { corpo, defs, caixa: viewBox, referencia, primitivas: pr.primitivas() };
  if (pr.chamadas.length) v.chamadas = [...pr.chamadas];
  if (S === undefined) return v;
  v.S = S;
  if (pr.anotacoes.length) {
    // a repetida (mesmo tipo e texto de origem que outra automática, com a chave pela ordem "#n"): o ajuste dela
    // guarda o lugar (AnotacaoPosta.ref). A de chave dita pelo desenho (a sombra de baixo e a de cima) já é única.
    const pelaOrdem = (a: (typeof pr.anotacoes)[number]) => !a.nova && /#\d+$/.test(a.chave);
    const quantas = new Map<string, number>();
    for (const a of pr.anotacoes) if (pelaOrdem(a)) quantas.set(`${a.tipo}|${a.original}`, (quantas.get(`${a.tipo}|${a.original}`) ?? 0) + 1);
    v.anotacoes = pr.anotacoes.map((a) => (pelaOrdem(a) && (quantas.get(`${a.tipo}|${a.original}`) ?? 0) > 1 ? { ...a, repetida: true } : a));
  }
  if (pr.regioes.length) v.regioes = [...pr.regioes];
  return v;
}
