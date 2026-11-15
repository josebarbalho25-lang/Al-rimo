/*
  AS MEXIDAS NAS PRANCHAS — funções puras (pranchas antes → pranchas depois), as mesmas para a tela das pranchas e
  para o "Enviar para a prancha" que chega do 3D e das vistas. Uma regra só para "onde o desenho novo cai" e "qual
  folha recebe": a ativa, ou uma nova se ainda não há folha.
*/
import { quadroUtil } from './formatos';
import { novaFolha, novoId } from './padrao';
import type { AnotacaoPosta, AnotacoesDaVista, Camera3d, ChamadaPosta, CotaNova, EtiquetaNova, Folha, ItemDaFolha, PedidoDeVista, PranchasDoProjeto, TextoNovo, VistaDoProjeto } from './tipos';
import type { IdDaTabela } from './tabelaDaFolha';
import { ESCALA_INICIAL, comVista, espelhoDaVista, gravarNoItem } from './vistas';

export { ESCALA_INICIAL, NOMES_DO_CONTEUDO } from './vistas';

export function naFolha(p: PranchasDoProjeto, id: string, f: (x: Folha) => Folha): PranchasDoProjeto {
  return { ...p, folhas: p.folhas.map((x) => (x.id === id ? f(x) : x)) };
}

/**
 * Muda o item como a folha o vê (com a vista dele): o que é da vista (conteúdo, escala, título, anotações) vai para a
 * VISTA, o lugar fica no item (vistas.ts, gravarNoItem) — quem arrasta uma cota na folha está cotando a vista.
 */
export function noItem(p: PranchasDoProjeto, folha: string, item: string, f: (x: ItemDaFolha) => ItemDaFolha): PranchasDoProjeto {
  return gravarNoItem(p, folha, item, f);
}

/**
 * Muda o ajuste da anotação automática `chave` do item (AnotacaoPosta, desenhos/prancha.ts "ANOTAÇÃO EDITÁVEL").
 * null = volta ao automático; o item sem ajuste nenhum fica sem o campo.
 */
export function naAnotacao<T extends AnotacoesDaVista>(i: T, chave: string, f: (a: AnotacaoPosta) => AnotacaoPosta | null): T {
  const resto: Record<string, AnotacaoPosta> = { ...(i.anotacoes ?? {}) };
  const nova = f(resto[chave] ?? {});
  if (nova && Object.keys(nova).length) resto[chave] = nova;
  else delete resto[chave];
  const { anotacoes: _antes, ...sem } = i;
  return (Object.keys(resto).length ? { ...sem, anotacoes: resto } : sem) as T;
}

/** Muda (ou apaga, com null) a cota criada na folha `id`; o item sem nenhuma fica sem o campo. */
export function naCotaNova<T extends AnotacoesDaVista>(i: T, id: string, f: (c: CotaNova) => CotaNova | null): T {
  const cotas = (i.cotas ?? []).flatMap((c) => (c.id === id ? (f(c) ?? []) : [c]));
  const { cotas: _antes, ...sem } = i;
  return (cotas.length ? { ...sem, cotas } : sem) as T;
}

/** Muda (ou apaga, com null) o texto criado na folha `id`. */
export function noTextoNovo<T extends AnotacoesDaVista>(i: T, id: string, f: (t: TextoNovo) => TextoNovo | null): T {
  const textos = (i.textos ?? []).flatMap((t) => (t.id === id ? (f(t) ?? []) : [t]));
  const { textos: _antes, ...sem } = i;
  return (textos.length ? { ...sem, textos } : sem) as T;
}

/** Muda (ou apaga, com null) a etiqueta de aço `id`; quem fica sem nenhuma fica sem o campo. */
export function naEtiqueta<T extends AnotacoesDaVista>(i: T, id: string, f: (e: EtiquetaNova) => EtiquetaNova | null): T {
  const etiquetas = (i.etiquetas ?? []).flatMap((e) => (e.id === id ? (f(e) ?? []) : [e]));
  const { etiquetas: _antes, ...sem } = i;
  return (etiquetas.length ? { ...sem, etiquetas } : sem) as T;
}

/**
 * Muda a chamada `chave` do item (ChamadaPosta, desenhos/chamadas.ts "CHAMADA SOLTA"). null = volta à coluna, sem
 * nada guardado; o item sem nenhuma chamada guardada fica sem o campo (o arquivo não carrega lixo).
 */
export function naChamada<T extends AnotacoesDaVista>(i: T, chave: string, f: (c: ChamadaPosta) => ChamadaPosta | null): T {
  const resto: Record<string, ChamadaPosta> = { ...(i.chamadas ?? {}) };
  const nova = f(resto[chave] ?? {});
  if (nova && Object.keys(nova).length) resto[chave] = nova;
  else delete resto[chave];
  const { chamadas: _antes, ...sem } = i;
  return (Object.keys(resto).length ? { ...sem, chamadas: resto } : sem) as T;
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
/**
 * O primeiro número livre da folha (Jose, 16/10: numeração por folha, na ordem em que o desenho entrou). Quem sai da
 * folha deixa a vaga e o próximo a entrar ocupa; os outros NÃO mudam de número — a nota "ver detalhe 3" continua
 * apontando para o mesmo desenho.
 */
export function numeroLivre(folha: Folha): string {
  const usados = new Set(folha.itens.map((i) => i.numero).filter(Boolean));
  let n = 1;
  while (usados.has(String(n))) n++;
  return String(n);
}

export function itemDaVista(folha: Folha, pedido: PedidoDeVista): ItemDaFolha {
  const [x, y] = lugarNovo(folha);
  const numero = numeroLivre(folha);
  if (pedido.tipo === 'iso') return { id: novoId('i'), conteudo: pedido, escala: null, x, y, largura: 160, altura: 110, titulo: '', numero };
  return { id: novoId('i'), conteudo: pedido, escala: ESCALA_INICIAL[pedido.tipo], x, y, titulo: '', numero };
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
  return { id: novoId('i'), conteudo: { tipo: '3d', camera, proporcao: prop }, escala: null, x, y, largura, altura: largura / prop, titulo: '', numero: numeroLivre(folha) };
}

/**
 * Põe uma VISTA do projeto na folha `alvo` (ou numa nova): a vista entra na lista (a de fábrica virtual é gravada) e o
 * desenho da folha aponta para ela, com o primeiro número livre. Vista sem escala (isométrico, 3D) leva o tamanho de
 * partida no papel.
 */
export function porVistaNaFolha(p: PranchasDoProjeto, alvo: string | null, vista: VistaDoProjeto): { pranchas: PranchasDoProjeto; folha: string; item: ItemDaFolha } {
  const comA = comVista(p, vista);
  return porNaFolha(comA, alvo, (folha) => {
    const [x, y] = lugarNovo(folha);
    const lugar: ItemDaFolha = { id: novoId('i'), conteudo: vista.conteudo, escala: vista.escala, x, y, titulo: '', numero: numeroLivre(folha) };
    if (vista.escala === null) {
      const [x0, , x1] = quadroUtil(folha.formato, folha.orientacao);
      const prop = vista.conteudo.tipo === '3d' && vista.conteudo.proporcao > 0.1 ? vista.conteudo.proporcao : 160 / 110;
      const largura = vista.conteudo.tipo === '3d' ? Math.round(Math.min(180, (x1 - x0) * 0.35)) : 160;
      lugar.largura = largura;
      lugar.altura = largura / prop;
    }
    return espelhoDaVista(lugar, vista);
  });
}
