/*
  AS VISTAS DO PROJETO (Jose, 16/10: "como no Revit"). Cada vista é guardada com NOME numa lista: o que ela mostra (o
  tipo e os parâmetros — o lugar do corte, a fiada, o lado do isométrico, a câmera do 3D), a escala, o título na folha
  e as ANOTAÇÕES dela (as automáticas ajustadas, as cotas, os textos e as chamadas). A aba de cada tipo mostra a vista
  escolhida na lista; o que se cota na aba é o que está na prancha, porque é a MESMA vista. A folha só guarda onde a
  vista está, o número dela e o tamanho sem escala — tirar da folha não apaga a vista: ela volta pela lista
  ("apagou da prancha sem querer").

  As vistas de fábrica (uma por tipo 2D: "Vista frontal", "Corte", "Planta", "Isométrico", "Armação da sapata") nascem
  VIRTUAIS: valem enquanto ninguém mexe nelas, sem entrar no arquivo — abrir uma aba não acende o • de muro alterado.
  A primeira mexida (uma cota, o corte arrastado, o envio para a folha) grava a vista com o id fixo do tipo.

  O item da folha que aponta para uma vista guarda, além do lugar, um ESPELHO do conteúdo, da escala e do título
  (só para o tipo do item ficar inteiro); quem lê passa por `itemComVista`, que sempre põe o da vista por cima. No
  arquivo vai o espelho do conteúdo, da escala e do título (não as anotações): o app de antes de 16/10, que não
  conhece vistas, abre o arquivo de hoje com os desenhos no lugar (sem as anotações) em vez de folhas vazias — e o
  de hoje, se a vista não se entender, ainda salva o desenho pelo espelho.
*/
import type { ConteudoDaVista, ConteudoDoItem, Folha, ItemDaFolha, PedidoDeVista, PranchasDoProjeto, TipoDaVista, VistaDoProjeto } from './tipos';

export const NOMES_DO_CONTEUDO: Record<ConteudoDoItem['tipo'], string> = {
  frontal: 'Vista frontal',
  corte: 'Corte',
  planta: 'Planta',
  iso: 'Isométrico',
  armacao: 'Armação da sapata',
  '3d': 'Perspectiva',
  detalhe: 'Detalhe',
  tabela: 'Tabela',
};

/** Escala de partida de cada vista: o corte é a peça que se cota miúdo. */
export const ESCALA_INICIAL: Record<PedidoDeVista['tipo'], number> = { frontal: 50, corte: 25, planta: 50, iso: 50, armacao: 25 };

/** Os tipos de vista 2D, na ordem das abas. */
export const TIPOS_2D: readonly PedidoDeVista['tipo'][] = ['frontal', 'corte', 'planta', 'iso', 'armacao'];

/**
 * O projetista DEU nome à vista? ("Corte A" sim; "Corte", "Corte (2)" — os de fábrica e os da cópia — não.) Com nome
 * dado, o título na folha é o nome (como no Revit); sem, fica o título que diz o que a vista mostra ("Corte no
 * contraforte C2", "Planta — 3ª fiada").
 */
export function nomeDado(nome: string, tipo: ConteudoDoItem['tipo']): boolean {
  // o 3D nasce "3D" no envio do visor; o de arquivo de antes de 16/10 vira vista com o nome do tipo, "Perspectiva"
  const bases = tipo === '3d' ? ['3D', NOMES_DO_CONTEUDO['3d']] : [NOMES_DO_CONTEUDO[tipo]];
  const copia = /^(.*) \(\d+\)$/.exec(nome);
  return !bases.includes(nome) && !(copia && bases.includes(copia[1]));
}

/** O id fixo da vista de fábrica de cada tipo (a virtual ganha este id quando é gravada). */
const ID_DE_FABRICA: Record<PedidoDeVista['tipo'], string> = {
  frontal: 'vista-frontal', corte: 'corte', planta: 'planta', iso: 'isometrico', armacao: 'armacao',
};

export const ehConteudoDeVista = (c: ConteudoDoItem): c is ConteudoDaVista => c.tipo !== 'tabela' && c.tipo !== 'detalhe';

/** O conteúdo de partida de cada tipo: o corte padrão (meio do painel), a 1ª fiada, o isométrico pela direita. */
function conteudoDeFabrica(tipo: PedidoDeVista['tipo']): PedidoDeVista {
  switch (tipo) {
    case 'planta':
      return { tipo: 'planta', fiada: 0 };
    case 'iso':
      return { tipo: 'iso', vista: 'frente-direita', corteX: null };
    default:
      return { tipo };
  }
}

/** A vista de fábrica de um tipo 2D (o isométrico é sem escala: a projeção encurta as medidas). */
export function vistaDeFabrica(tipo: PedidoDeVista['tipo']): VistaDoProjeto {
  return { id: ID_DE_FABRICA[tipo], nome: NOMES_DO_CONTEUDO[tipo], conteudo: conteudoDeFabrica(tipo), escala: tipo === 'iso' ? null : ESCALA_INICIAL[tipo], titulo: '' };
}

/** As vistas guardadas de um tipo; sem nenhuma, a de fábrica (virtual). O 3D não tem de fábrica: nasce no envio. */
export function vistasDoTipo(p: PranchasDoProjeto, tipo: TipoDaVista): VistaDoProjeto[] {
  const guardadas = p.vistas.filter((v) => v.conteudo.tipo === tipo);
  if (guardadas.length || tipo === '3d') return guardadas;
  return [vistaDeFabrica(tipo)];
}

/** A vista pelo id: a guardada, ou a de fábrica virtual de um tipo que ainda não tem vista guardada. */
export function acharVista(p: PranchasDoProjeto, id: string): VistaDoProjeto | null {
  const v = p.vistas.find((x) => x.id === id);
  if (v) return v;
  const tipo = TIPOS_2D.find((t) => ID_DE_FABRICA[t] === id);
  return tipo && !p.vistas.some((x) => x.conteudo.tipo === tipo) ? vistaDeFabrica(tipo) : null;
}

/** A vista entra na lista (a virtual vira guardada); já guardada, nada muda. */
export function comVista(p: PranchasDoProjeto, v: VistaDoProjeto): PranchasDoProjeto {
  return p.vistas.some((x) => x.id === v.id) ? p : { ...p, vistas: [...p.vistas, v] };
}

/**
 * O mesmo conteúdo, campo a campo, sem ligar para a ORDEM dos campos (a vista refeita pelo item põe os gráficos antes
 * das anotações; a lida do arquivo, depois) — senão "nada mudou" acende o • de muro alterado.
 */
export function mesmoConteudo(a: unknown, b: unknown): boolean {
  return textoOrdenado(a) === textoOrdenado(b);
}
function textoOrdenado(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  });
}

/**
 * Muda uma vista. A virtual só é gravada se a mudança mudou alguma coisa (o Cancelar da janela de gráficos na vista
 * de fábrica intocada não pode gravá-la). Vista que não existe: nada muda.
 */
export function naVistaDoProjeto(p: PranchasDoProjeto, id: string, f: (v: VistaDoProjeto) => VistaDoProjeto): PranchasDoProjeto {
  const v = acharVista(p, id);
  if (!v) return p;
  const virtual = !p.vistas.includes(v);
  const depois = f(v);
  if (virtual && mesmoConteudo(depois, v)) return p;
  const base = comVista(p, v);
  return { ...base, vistas: base.vistas.map((x) => (x.id === id ? depois : x)) };
}

/**
 * O primeiro nome livre: "Corte", "Corte (2)", "Corte (3)"… Um " (n)" no fim do nome pedido sai antes (duplicar a
 * cópia dá "(3)", não "(2) (2)") — a regra do A-PORT.
 */
export function nomeLivre(vistas: readonly VistaDoProjeto[], pedido: string): string {
  const base = pedido.replace(/\s*\(\d+\)$/, '').trim() || 'Vista';
  const usados = new Set(vistas.map((v) => v.nome));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

let contador = 0;
/** Id curto e único na sessão (folha, item, vista, cota): só precisa distinguir dentro do arquivo. */
export function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}${Date.now().toString(36)}${contador.toString(36)}`;
}
const idNovo = (): string => novoId('v');

/** Outra visualização a partir desta: tudo igual (as anotações também), com nome e id novos. */
export function duplicarVista(p: PranchasDoProjeto, id: string): { pranchas: PranchasDoProjeto; vista: VistaDoProjeto } | null {
  const v = acharVista(p, id);
  if (!v) return null;
  const base = comVista(p, v);
  const copia: VistaDoProjeto = { ...structuredClone(v), id: idNovo(), nome: nomeLivre(base.vistas, v.nome) };
  return { pranchas: { ...base, vistas: [...base.vistas, copia] }, vista: copia };
}

/** Uma vista nova da pré-definida do tipo (sem as anotações de ninguém). */
export function novaVista(p: PranchasDoProjeto, tipo: PedidoDeVista['tipo']): { pranchas: PranchasDoProjeto; vista: VistaDoProjeto } {
  // a de fábrica virtual entra primeiro: a lista não pode "sumir" com ela quando a nova é gravada
  const fabrica = acharVista(p, ID_DE_FABRICA[tipo]);
  const base = fabrica ? comVista(p, fabrica) : p;
  const nova: VistaDoProjeto = { ...vistaDeFabrica(tipo), id: idNovo(), nome: nomeLivre(base.vistas, NOMES_DO_CONTEUDO[tipo]) };
  return { pranchas: { ...base, vistas: [...base.vistas, nova] }, vista: nova };
}

/** A vista 3D que nasce do "Enviar para a prancha" do visor: "3D", "3D (2)"… com a câmera daquela hora. */
export function novaVista3d(p: PranchasDoProjeto, conteudo: Extract<ConteudoDaVista, { tipo: '3d' }>): { pranchas: PranchasDoProjeto; vista: VistaDoProjeto } {
  const nova: VistaDoProjeto = { id: idNovo(), nome: nomeLivre(p.vistas, '3D'), conteudo, escala: null, titulo: '' };
  return { pranchas: { ...p, vistas: [...p.vistas, nova] }, vista: nova };
}

/** O nome é único, como no Revit: o que já é de outra vista ganha o " (2)" (a lista e o "já está na folha" não podem confundir). */
export function renomearVista(p: PranchasDoProjeto, id: string, nome: string): PranchasDoProjeto {
  const limpo = nome.trim();
  if (!limpo) return p;
  const outras = p.vistas.filter((v) => v.id !== id);
  const livre = outras.some((v) => v.nome === limpo) ? nomeLivre(outras, limpo) : limpo;
  return naVistaDoProjeto(p, id, (v) => ({ ...v, nome: livre }));
}

/** Apaga a vista e os lugares dela nas folhas. A de fábrica volta sozinha (virtual) quando o tipo fica sem vista. */
export function excluirVista(p: PranchasDoProjeto, id: string): PranchasDoProjeto {
  return {
    ...p,
    vistas: p.vistas.filter((v) => v.id !== id),
    folhas: p.folhas.map((f) => (f.itens.some((i) => i.vista === id) ? { ...f, itens: f.itens.filter((i) => i.vista !== id) } : f)),
  };
}

/** Onde a vista está colocada (uma vista vai numa folha só, como no Revit), ou null. */
export function ondeEstaAVista(p: PranchasDoProjeto, id: string): { folha: Folha; item: ItemDaFolha; numero: number } | null {
  for (let k = 0; k < p.folhas.length; k++) {
    const item = p.folhas[k].itens.find((i) => i.vista === id);
    if (item) return { folha: p.folhas[k], item, numero: k + 1 };
  }
  return null;
}

// ── o item da folha × a vista dele ──────────────────────────────────────────

/** O item com o que é da vista dele (é isto que a folha desenha e o painel mostra). */
export function itemComVista(i: ItemDaFolha, vistas: readonly VistaDoProjeto[]): ItemDaFolha {
  if (!i.vista) return i;
  const v = vistas.find((x) => x.id === i.vista);
  if (!v) return i;
  const { chamadas: _c, anotacoes: _a, cotas: _co, textos: _t, etiquetas: _e, graficos: _g, ...lugar } = i;
  const r: ItemDaFolha = { ...lugar, conteudo: v.conteudo, escala: v.escala, titulo: v.titulo, nomeDaVista: v.nome };
  if (v.graficos) r.graficos = v.graficos;
  if (v.chamadas) r.chamadas = v.chamadas;
  if (v.anotacoes) r.anotacoes = v.anotacoes;
  if (v.cotas) r.cotas = v.cotas;
  if (v.textos) r.textos = v.textos;
  if (v.etiquetas) r.etiquetas = v.etiquetas;
  return r;
}

/** As folhas com cada item já com a vista dele. Sem vista nenhuma guardada, devolve as mesmas pranchas. */
export function pranchasComVistas(p: PranchasDoProjeto): PranchasDoProjeto {
  if (!p.vistas.length) return p;
  return { ...p, folhas: p.folhas.map((f) => (f.itens.some((i) => i.vista) ? { ...f, itens: f.itens.map((i) => itemComVista(i, p.vistas)) } : f)) };
}

/**
 * O que vai no arquivo: o item de vista com o lugar, o número, o tamanho sem escala e o espelho do conteúdo, da escala
 * e do título — as anotações e os gráficos ficam só na vista (guardar duas vezes deixaria as duas discordarem).
 */
export function pranchasParaArquivo(p: PranchasDoProjeto): PranchasDoProjeto {
  return {
    ...p,
    folhas: p.folhas.map((f) => ({
      ...f,
      itens: f.itens.map((i) => {
        if (!i.vista) return i;
        const v = p.vistas.find((x) => x.id === i.vista);
        const { chamadas: _ch, anotacoes: _a, cotas: _co, textos: _tx, etiquetas: _et, nomeDaVista: _n, graficos: _g, ...lugar } = i;
        return v ? { ...lugar, conteudo: v.conteudo, escala: v.escala, titulo: v.titulo } : lugar;
      }),
    })),
  };
}

/** O espelho do item de vista: o lugar dele, com o conteúdo, a escala e o título da vista (sem as anotações). */
export function espelhoDaVista(lugar: ItemDaFolha, v: VistaDoProjeto): ItemDaFolha {
  const { chamadas: _c, anotacoes: _a, cotas: _co, textos: _t, etiquetas: _e, nomeDaVista: _n, graficos: _g, ...resto } = lugar;
  return { ...resto, vista: v.id, conteudo: v.conteudo, escala: v.escala, titulo: v.titulo };
}

/**
 * A mudança feita no item como a folha o vê (com a vista): o que é DA VISTA (conteúdo, escala, título, anotações) vai
 * para a vista; o LUGAR (x, y, número, tamanho sem escala) fica no item. Assim todo "mudar o item" da tela das pranchas
 * — arrastar uma cota, trocar a escala, girar uma chamada — cai no lugar certo sem cada um saber das vistas.
 */
/** A vista com o que o item (visto com ela) passou a ter: conteúdo, escala, título e anotações. */
function vistaDoItem(v: VistaDoProjeto, depois: ItemDaFolha): VistaDoProjeto {
  const { chamadas: _c, anotacoes: _a, cotas: _co, textos: _t, etiquetas: _e, ...semAnotacoes } = v;
  const vista: VistaDoProjeto = { ...semAnotacoes, conteudo: ehConteudoDeVista(depois.conteudo) ? depois.conteudo : v.conteudo, escala: depois.escala, titulo: depois.titulo };
  if (depois.chamadas) vista.chamadas = depois.chamadas;
  if (depois.anotacoes) vista.anotacoes = depois.anotacoes;
  if (depois.cotas) vista.cotas = depois.cotas;
  if (depois.textos) vista.textos = depois.textos;
  if (depois.etiquetas) vista.etiquetas = depois.etiquetas;
  return vista;
}

/** A vista vista como um desenho fora de folha (a aba): o que a edição das anotações sabe mexer. */
export function itemDaVista(v: VistaDoProjeto): ItemDaFolha {
  return itemComVista({ id: v.id, vista: v.id, conteudo: v.conteudo, escala: v.escala, titulo: v.titulo, x: 0, y: 0 }, [v]);
}

/** A edição na ABA: a mudança feita no "item" da vista vai para a vista (a de fábrica virtual é gravada antes). */
export function naVistaComoItem(p: PranchasDoProjeto, id: string, f: (x: ItemDaFolha) => ItemDaFolha): PranchasDoProjeto {
  return naVistaDoProjeto(p, id, (v) => vistaDoItem(v, f(itemDaVista(v))));
}

export function gravarNoItem(p: PranchasDoProjeto, folhaId: string, itemId: string, f: (x: ItemDaFolha) => ItemDaFolha): PranchasDoProjeto {
  const folha = p.folhas.find((x) => x.id === folhaId);
  const guardado = folha?.itens.find((i) => i.id === itemId);
  if (!folha || !guardado) return p;
  const trocar = (novo: ItemDaFolha): PranchasDoProjeto => ({
    ...p,
    folhas: p.folhas.map((x) => (x.id === folhaId ? { ...x, itens: x.itens.map((i) => (i.id === itemId ? novo : i)) } : x)),
  });
  const v = guardado.vista ? p.vistas.find((x) => x.id === guardado.vista) : undefined;
  if (!v) return trocar(f(guardado));
  const depois = f(itemComVista(guardado, p.vistas));
  const vista = vistaDoItem(v, depois);
  const comItem = trocar(espelhoDaVista(depois, vista));
  return { ...comItem, vistas: comItem.vistas.map((x) => (x.id === v.id ? vista : x)) };
}
