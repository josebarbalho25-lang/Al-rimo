/*
  PRANCHAS: o que nasce em branco e o que se aceita de um arquivo.

  O arquivo .alrimo guarda as folhas (o que o projetista montou) e os dados da obra que vão para o carimbo. Não guarda
  desenho nem foto: a prancha é VIVA (Jose, 14/10) — abre-se o arquivo, a conta roda, os desenhos saem de novo do
  muro do dia e o 3D é refeito do ponto de vista guardado. Guardar a foto seria guardar um muro que pode não ser mais
  o da conta, e o arquivo engordaria megabytes por foto.

  A leitura do arquivo é TOLERANTE: campo estranho cai, item quebrado sai da folha, e o resto abre. Uma folha mal
  escrita à mão não pode impedir de abrir o muro.
*/
import { CARIMBO_ANTIGO, CARIMBO_MIN, CARIMBO_PADRAO, ESCALAS, ORDEM_DOS_FORMATOS, quadroLateralPadrao } from './formatos';
import type { AnotacaoPosta, AnotacoesDaVista, Camera3d, ChamadaPosta, ConteudoDoItem, CotaNova, DadosDaObra, EtiquetaNova, Folha, Formato, ItemDaFolha, Orientacao, PranchasDoProjeto, TextoNovo, VistaDoProjeto } from './tipos';
import { ESCALA_INICIAL, NOMES_DO_CONTEUDO, ehConteudoDeVista, espelhoDaVista, nomeLivre, novoId } from './vistas';
import { lerSobreposicao } from '@/desenhos/graficos';

export const OBRA_EM_BRANCO: DadosDaObra = { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' };

export const SEM_PRANCHAS: PranchasDoProjeto = { folhas: [], obra: OBRA_EM_BRANCO, vistas: [] };

// o gerador de ids mora com as vistas (um contador só: dois contadores com o mesmo formato podiam repetir um id)
export { novoId } from './vistas';

/** Folha nova: A1 deitada (o formato mais comum para muro), carimbo de partida e quadro lateral na altura toda. */
export function novaFolha(conteudo = '', formato: Formato = 'A1', orientacao: Orientacao = 'deitada'): Folha {
  const carimbo = { ...CARIMBO_PADRAO };
  const q = quadroLateralPadrao(formato, orientacao, carimbo);
  return {
    id: novoId('f'),
    conteudo,
    formato,
    orientacao,
    itens: [],
    carimbo,
    quadro: { largura: q.largura, altura: q.altura, notas: null, legenda: true, quadroDeAco: true, listaDeFerros: true },
  };
}

// ── leitura tolerante ────────────────────────────────────────────────────────

const num = (v: unknown, padrao: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const txt = (v: unknown, padrao = ''): string => (typeof v === 'string' ? v : padrao);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const vec3 = (v: unknown): [number, number, number] | null =>
  Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1], v[2]] : null;

function lerCamera(v: unknown): Camera3d | null {
  const c = obj(v);
  if (!c) return null;
  const posicao = vec3(c.posicao), alvo = vec3(c.alvo), cima = vec3(c.cima);
  if (!posicao || !alvo || !cima) return null;
  const estilo = c.estilo === 'realista' || c.estilo === 'opaco' ? c.estilo : 'cores';
  return {
    posicao, alvo, cima,
    ortografica: c.ortografica !== false,
    zoom: num(c.zoom, 1),
    fov: num(c.fov, 35),
    estilo,
    armadura: c.armadura === true,
    corteX: typeof c.corteX === 'number' && Number.isFinite(c.corteX) ? c.corteX : null,
    ocultas: Array.isArray(c.ocultas) ? c.ocultas.filter((x): x is string => typeof x === 'string') : [],
  };
}

function lerConteudo(v: unknown): ConteudoDoItem | null {
  const c = obj(v);
  if (!c) return null;
  switch (c.tipo) {
    case 'frontal':
      return { tipo: 'frontal' };
    case 'corte':
      return typeof c.x === 'number' && Number.isFinite(c.x) ? { tipo: 'corte', x: c.x } : { tipo: 'corte' };
    case 'planta':
      return { tipo: 'planta', fiada: Math.max(0, Math.round(num(c.fiada, 0))) };
    case 'armacao':
      return { tipo: 'armacao' };
    case 'iso': {
      const vistas = ['frente-direita', 'frente-esquerda', 'fundo-direita', 'fundo-esquerda'] as const;
      const vista = vistas.find((x) => x === c.vista);
      return { tipo: 'iso', vista: vista ?? 'frente-direita', corteX: typeof c.corteX === 'number' ? c.corteX : null };
    }
    case '3d': {
      const camera = lerCamera(c.camera);
      return camera ? { tipo: '3d', camera, proporcao: Math.max(0.1, num(c.proporcao, 1.5)) } : null;
    }
    case 'detalhe':
      return typeof c.id === 'string' ? { tipo: 'detalhe', id: c.id } : null;
    case 'tabela':
      return c.id === 'aco' || c.id === 'blocos' || c.id === 'quantidades' || c.id === 'drenagem' ? { tipo: 'tabela', id: c.id } : null;
    default:
      return null;
  }
}

/** As anotações guardadas (as da vista; antes de 16/10, as do item da folha), no alvo. */
function lerAnotacoesEm<T extends AnotacoesDaVista>(i: Record<string, unknown>, alvo: T): T {
  const chamadas = lerChamadas(i.chamadas);
  if (chamadas) alvo.chamadas = chamadas;
  const anotacoes = lerAnotacoes(i.anotacoes);
  if (anotacoes) alvo.anotacoes = anotacoes;
  const cotas = Array.isArray(i.cotas) ? i.cotas.map(lerCotaNova).filter((c): c is CotaNova => !!c) : [];
  if (cotas.length) alvo.cotas = cotas;
  const textos = Array.isArray(i.textos) ? i.textos.map(lerTextoNovo).filter((t): t is TextoNovo => !!t) : [];
  if (textos.length) alvo.textos = textos;
  const etiquetas = Array.isArray(i.etiquetas) ? i.etiquetas.map(lerEtiqueta).filter((e): e is EtiquetaNova => !!e) : [];
  if (etiquetas.length) alvo.etiquetas = etiquetas;
  return alvo;
}

/** A escala guardada, se é uma das da lista; o isométrico e o 3D são sempre sem escala (a projeção encurta as medidas). */
function lerEscala(conteudo: ConteudoDoItem, e: unknown): number | null {
  if (conteudo.tipo === 'iso' || conteudo.tipo === '3d') return null;
  return typeof e === 'number' && ESCALAS.includes(e) ? e : null;
}

/** Uma vista do projeto (16/10). A que não se entende cai — e os desenhos que apontavam para ela saem da folha. */
function lerVista(v: unknown): VistaDoProjeto | null {
  const o = obj(v);
  const id = txt(o?.id);
  const conteudo = o ? lerConteudo(o.conteudo) : null;
  if (!o || !id || !conteudo || !ehConteudoDeVista(conteudo)) return null;
  // null guardado = sem escala (o desenho 2D de antes de 16/10 podia ser); faltando ou fora da lista, a de partida
  const escala = o.escala === null ? null : lerEscala(conteudo, o.escala) ?? (conteudo.tipo === 'iso' || conteudo.tipo === '3d' ? null : ESCALA_INICIAL[conteudo.tipo]);
  const vista = lerAnotacoesEm<VistaDoProjeto>(o, { id, nome: txt(o.nome).trim() || NOMES_DO_CONTEUDO[conteudo.tipo], conteudo, escala, titulo: txt(o.titulo) });
  const graficos = lerSobreposicao(o.graficos);
  if (graficos) vista.graficos = graficos;
  return vista;
}

/**
 * Um desenho da folha. O que aponta para uma vista (16/10) traz da vista o resto; o de antes das vistas, com o
 * conteúdo dentro, VIRA uma vista do projeto (com o título dele de nome) — `vistas` recebe as que nascem aqui.
 */
function lerItem(v: unknown, vistas: VistaDoProjeto[]): ItemDaFolha | null {
  const i = obj(v);
  if (!i) return null;
  const lugar = { id: txt(i.id) || novoId('i'), x: num(i.x, 30), y: num(i.y, 20) };
  const numero = txt(i.numero).trim().slice(0, 8);
  const tamanho = (item: ItemDaFolha): ItemDaFolha => {
    if (item.escala !== null || item.conteudo.tipo === 'tabela') return item;
    return { ...item, largura: Math.max(20, num(i.largura, 150)), altura: Math.max(15, num(i.altura, 100)) };
  };
  if (typeof i.vista === 'string') {
    const vista = vistas.find((x) => x.id === i.vista);
    // a vista que não se entendeu: o espelho do conteúdo (gravado desde 16/10) salva o desenho, como vista nova
    if (!vista) return lerConteudo(i.conteudo) ? lerItem({ ...i, vista: undefined }, vistas) : null;
    const item = tamanho(espelhoDaVista({ ...lugar, conteudo: vista.conteudo, escala: vista.escala, titulo: vista.titulo }, vista));
    if (numero) item.numero = numero;
    return item;
  }
  const conteudo = lerConteudo(i.conteudo);
  if (!conteudo) return null;
  const item = tamanho({ ...lugar, conteudo, escala: lerEscala(conteudo, i.escala), titulo: txt(i.titulo) });
  if (conteudo.tipo !== 'tabela' && numero) item.numero = numero;
  lerAnotacoesEm(i, item);
  if (!ehConteudoDeVista(conteudo)) return item;
  // o desenho de antes de 16/10 vira uma vista do projeto: as anotações dele vão junto, o item fica com o lugar
  const nome = nomeLivre(vistas, item.titulo.trim() || NOMES_DO_CONTEUDO[conteudo.tipo]);
  const vista = lerAnotacoesEm(i, { id: novoId('v'), nome, conteudo, escala: item.escala, titulo: item.titulo } as VistaDoProjeto);
  vistas.push(vista);
  return espelhoDaVista(item, vista);
}

const finito = (y: unknown): y is number => typeof y === 'number' && Number.isFinite(y);
const ponto = (v: unknown): [number, number] | null => (Array.isArray(v) && v.length === 2 && finito(v[0]) && finito(v[1]) ? [v[0], v[1]] : null);

/** Os ajustes nas cotas e textos automáticos (AnotacaoPosta): o que não for do tipo certo cai. */
function lerAnotacoes(v: unknown): Record<string, AnotacaoPosta> | null {
  const o = obj(v);
  if (!o) return null;
  const r: Record<string, AnotacaoPosta> = {};
  for (const [chave, x] of Object.entries(o)) {
    const c = obj(x);
    if (!c) continue;
    const a: AnotacaoPosta = {};
    if (finito(c.dx) && finito(c.dy)) [a.dx, a.dy] = [c.dx, c.dy];
    if (finito(c.giro)) a.giro = c.giro;
    if (finito(c.afastamento)) a.afastamento = c.afastamento;
    if (typeof c.texto === 'string') a.texto = c.texto;
    if (typeof c.prefixo === 'string' && c.prefixo) a.prefixo = c.prefixo;
    if (typeof c.sufixo === 'string' && c.sufixo) a.sufixo = c.sufixo;
    if (c.oculta === true) a.oculta = true;
    const ref = ponto(c.ref);
    if (ref) a.ref = ref;
    if (typeof c.original === 'string') a.original = c.original;
    // lugar e texto de origem sozinhos não são ajuste
    if (Object.keys(a).some((k) => k !== 'ref' && k !== 'original')) r[chave] = a;
  }
  return Object.keys(r).length ? r : null;
}

function lerCotaNova(v: unknown): CotaNova | null {
  const c = obj(v);
  if (!c) return null;
  const [a, b, linha] = [ponto(c.a), ponto(c.b), ponto(c.linha)];
  if (!a || !b || !linha || (c.direcao !== 'h' && c.direcao !== 'v')) return null;
  const r: CotaNova = { id: txt(c.id) || novoId('c'), a, b, linha, direcao: c.direcao };
  if (typeof c.regiao === 'string' && c.regiao) r.regiao = c.regiao;
  // texto vazio de antes de 16/10 deixava a cota invisível: fica a medida
  if (typeof c.texto === 'string' && c.texto.trim()) r.texto = c.texto;
  if (typeof c.prefixo === 'string' && c.prefixo) r.prefixo = c.prefixo;
  if (typeof c.sufixo === 'string' && c.sufixo) r.sufixo = c.sufixo;
  if (finito(c.dx) && finito(c.dy)) [r.dx, r.dy] = [c.dx, c.dy];
  if (typeof c.cadeia === 'string' && c.cadeia) r.cadeia = c.cadeia;
  return r;
}

/** A etiqueta de aço (16/10): sem a barra ou sem o ponto, cai. */
function lerEtiqueta(v: unknown): EtiquetaNova | null {
  const e = obj(v);
  const p2 = ponto(e?.ponto);
  if (!e || !p2 || typeof e.barra !== 'string' || !e.barra.includes('|')) return null;
  const r: EtiquetaNova = { id: txt(e.id) || novoId('e'), barra: e.barra, ponto: p2, dx: finito(e.dx) ? e.dx : 14, dy: finito(e.dy) ? e.dy : -14 };
  if (finito(e.giro)) r.giro = e.giro;
  if (e.semLinha === true) r.semLinha = true;
  return r;
}

function lerTextoNovo(v: unknown): TextoNovo | null {
  const t = obj(v);
  const p = ponto(t?.p);
  if (!t || !p || typeof t.texto !== 'string' || !t.texto.trim()) return null;
  const r: TextoNovo = { id: txt(t.id) || novoId('t'), p, texto: t.texto };
  if (finito(t.giro)) r.giro = t.giro;
  if (typeof t.regiao === 'string' && t.regiao) r.regiao = t.regiao;
  return r;
}

/** As chamadas postas na folha (ChamadaPosta): o que não for número fica de fora; chamada sem nada guardado cai. */
function lerChamadas(v: unknown): Record<string, ChamadaPosta> | null {
  const o = obj(v);
  if (!o) return null;
  const r: Record<string, ChamadaPosta> = {};
  for (const [chave, x] of Object.entries(o)) {
    const c = obj(x);
    if (!c) continue;
    const p: ChamadaPosta = {};
    const fin = (y: unknown): y is number => typeof y === 'number' && Number.isFinite(y);
    if (fin(c.dx) && fin(c.dy)) [p.dx, p.dy] = [c.dx, c.dy];
    if (fin(c.giro) && p.dx !== undefined) p.giro = c.giro;
    if (c.oculta === true) p.oculta = true;
    if (c.semLinha === true) p.semLinha = true;
    if (Object.keys(p).length) r[chave] = p;
  }
  return Object.keys(r).length ? r : null;
}

function lerFolha(v: unknown, vistas: VistaDoProjeto[], perdidos?: string[]): Folha | null {
  const f = obj(v);
  if (!f) return null;
  const formato = ORDEM_DOS_FORMATOS.find((x) => x === f.formato) ?? 'A1';
  const orientacao: Orientacao = f.orientacao === 'em_pe' ? 'em_pe' : 'deitada';
  const base = novaFolha(txt(f.conteudo), formato, orientacao);
  const car = obj(f.carimbo);
  const qd = obj(f.quadro);
  // o carimbo de partida antigo (quatro faixas) abre com o de partida de hoje; o que o projetista regulou fica
  const antigo = num(car?.largura, 0) === CARIMBO_ANTIGO.largura && num(car?.altura, 0) === CARIMBO_ANTIGO.altura;
  const quadroAntigo = antigo && num(qd?.altura, -1) === quadroLateralPadrao(formato, orientacao, CARIMBO_ANTIGO).altura;
  const itens = Array.isArray(f.itens)
    ? f.itens.map((x) => {
        const i = lerItem(x, vistas);
        if (!i && obj(x)) perdidos?.push(`prancha: ${txt(obj(obj(x)!.conteudo)?.tipo) || 'desenho'}`);
        return i;
      }).filter((x): x is ItemDaFolha => !!x)
    : [];
  // a folha de antes da numeração (16/10): cada desenho ganha o primeiro número livre, na ordem em que entrou
  const usados = new Set(itens.map((i) => i.numero).filter(Boolean));
  let livre = 1;
  for (const i of itens) {
    if (i.numero || i.conteudo.tipo === 'tabela') continue;
    while (usados.has(String(livre))) livre++;
    i.numero = String(livre);
    usados.add(i.numero);
  }
  return {
    ...base,
    id: txt(f.id) || base.id,
    itens,
    carimbo: antigo ? base.carimbo : {
      largura: Math.max(CARIMBO_MIN.largura, num(car?.largura, base.carimbo.largura)),
      altura: Math.max(CARIMBO_MIN.altura, num(car?.altura, base.carimbo.altura)),
    },
    quadro: {
      largura: Math.max(0, num(qd?.largura, base.quadro.largura)),
      // o quadro que descia até o carimbo antigo desce até o novo (senão os dois se encavalam)
      altura: quadroAntigo ? base.quadro.altura : Math.max(0, num(qd?.altura, base.quadro.altura)),
      notas: Array.isArray(qd?.notas) ? (qd.notas as unknown[]).filter((x): x is string => typeof x === 'string') : null,
      legenda: qd?.legenda !== false,
      quadroDeAco: qd?.quadroDeAco !== false,
      listaDeFerros: qd?.listaDeFerros !== false,
    },
  };
}

/** As pranchas de um arquivo: o que não se entende fica de fora, sem impedir a abertura. */
/**
 * As pranchas do arquivo, com tolerância. `perdidos`: quem quer saber recebe aqui um nome por desenho de folha que
 * ficou de fora (um tipo de desenho de versão mais nova do app) — vai para o recado de abertura, para o salvar de
 * depois não apagar calado o que este app não sabe desenhar.
 */
export function lerPranchas(v: unknown, perdidos?: string[]): PranchasDoProjeto {
  const p = obj(v);
  if (!p) return SEM_PRANCHAS;
  const o = obj(p.obra);
  // as vistas primeiro: o desenho da folha aponta para elas (e o de antes de 16/10 cria a sua aqui)
  const vistas: VistaDoProjeto[] = [];
  for (const x of Array.isArray(p.vistas) ? p.vistas : []) {
    const v = lerVista(x);
    if (v && !vistas.some((y) => y.id === v.id)) vistas.push(v);
    // a vista que não se entende (de versão mais nova) vai para o recado: o salvar de depois a apagaria calado
    else if (!v && obj(x)) perdidos?.push(`vista: ${txt(obj(x)!.nome) || txt(obj(obj(x)!.conteudo)?.tipo) || 'sem nome'}`);
  }
  return {
    folhas: Array.isArray(p.folhas) ? p.folhas.map((f) => lerFolha(f, vistas, perdidos)).filter((x): x is Folha => !!x) : [],
    vistas,
    obra: {
      obra: txt(o?.obra),
      endereco: txt(o?.endereco),
      proprietario: txt(o?.proprietario),
      art: txt(o?.art),
      data: txt(o?.data),
      revisao: txt(o?.revisao, 'R00'),
      codigo: txt(o?.codigo),
      desenhista: txt(o?.desenhista),
      verificacao: txt(o?.verificacao),
    },
  };
}

/** Prancha vazia não se grava: o arquivo de quem nunca abriu a aba fica igual ao de antes. */
export const temPranchas = (p: PranchasDoProjeto | undefined): p is PranchasDoProjeto =>
  !!p && (p.folhas.length > 0 || p.vistas.length > 0 || Object.entries(p.obra).some(([k, v]) => v !== OBRA_EM_BRANCO[k as keyof DadosDaObra]));
