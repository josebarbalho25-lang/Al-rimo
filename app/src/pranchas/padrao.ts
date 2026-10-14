/*
  PRANCHAS: o que nasce em branco e o que se aceita de um arquivo.

  O arquivo .alrimo guarda as folhas (o que o projetista montou) e os dados da obra que vão para o carimbo. Não guarda
  desenho nem foto: a prancha é VIVA (Jose, 14/10) — abre-se o arquivo, a conta roda, os desenhos saem de novo do
  muro do dia e o 3D é refeito do ponto de vista guardado. Guardar a foto seria guardar um muro que pode não ser mais
  o da conta, e o arquivo engordaria megabytes por foto.

  A leitura do arquivo é TOLERANTE: campo estranho cai, item quebrado sai da folha, e o resto abre. Uma folha mal
  escrita à mão não pode impedir de abrir o muro.
*/
import { CARIMBO_MIN, CARIMBO_PADRAO, ESCALAS, ORDEM_DOS_FORMATOS, quadroLateralPadrao } from './formatos';
import type { Camera3d, ConteudoDoItem, DadosDaObra, Folha, Formato, ItemDaFolha, Orientacao, PranchasDoProjeto } from './tipos';

export const OBRA_EM_BRANCO: DadosDaObra = { obra: '', endereco: '', proprietario: '', art: '', data: '', revisao: 'R00' };

export const SEM_PRANCHAS: PranchasDoProjeto = { folhas: [], obra: OBRA_EM_BRANCO };

let contador = 0;
/** Id curto e único na sessão (folha e item): só precisa distinguir dentro do arquivo. */
export function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}${Date.now().toString(36)}${contador.toString(36)}`;
}

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
    quadro: { largura: q.largura, altura: q.altura, notas: null, legenda: true, quadroDeAco: true },
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

function lerItem(v: unknown): ItemDaFolha | null {
  const i = obj(v);
  if (!i) return null;
  const conteudo = lerConteudo(i.conteudo);
  if (!conteudo) return null;
  const escala = typeof i.escala === 'number' && ESCALAS.includes(i.escala) ? i.escala : null;
  const item: ItemDaFolha = { id: txt(i.id) || novoId('i'), conteudo, escala, x: num(i.x, 30), y: num(i.y, 20), titulo: txt(i.titulo) };
  if (escala === null) {
    item.largura = Math.max(20, num(i.largura, 150));
    item.altura = Math.max(15, num(i.altura, 100));
  }
  return item;
}

function lerFolha(v: unknown): Folha | null {
  const f = obj(v);
  if (!f) return null;
  const formato = ORDEM_DOS_FORMATOS.find((x) => x === f.formato) ?? 'A1';
  const orientacao: Orientacao = f.orientacao === 'em_pe' ? 'em_pe' : 'deitada';
  const base = novaFolha(txt(f.conteudo), formato, orientacao);
  const car = obj(f.carimbo);
  const qd = obj(f.quadro);
  return {
    ...base,
    id: txt(f.id) || base.id,
    itens: Array.isArray(f.itens) ? f.itens.map(lerItem).filter((x): x is ItemDaFolha => !!x) : [],
    carimbo: {
      largura: Math.max(CARIMBO_MIN.largura, num(car?.largura, base.carimbo.largura)),
      altura: Math.max(CARIMBO_MIN.altura, num(car?.altura, base.carimbo.altura)),
    },
    quadro: {
      largura: Math.max(0, num(qd?.largura, base.quadro.largura)),
      altura: Math.max(0, num(qd?.altura, base.quadro.altura)),
      notas: Array.isArray(qd?.notas) ? (qd.notas as unknown[]).filter((x): x is string => typeof x === 'string') : null,
      legenda: qd?.legenda !== false,
      quadroDeAco: qd?.quadroDeAco !== false,
    },
  };
}

/** As pranchas de um arquivo: o que não se entende fica de fora, sem impedir a abertura. */
export function lerPranchas(v: unknown): PranchasDoProjeto {
  const p = obj(v);
  if (!p) return SEM_PRANCHAS;
  const o = obj(p.obra);
  return {
    folhas: Array.isArray(p.folhas) ? p.folhas.map(lerFolha).filter((x): x is Folha => !!x) : [],
    obra: {
      obra: txt(o?.obra),
      endereco: txt(o?.endereco),
      proprietario: txt(o?.proprietario),
      art: txt(o?.art),
      data: txt(o?.data),
      revisao: txt(o?.revisao, 'R00'),
    },
  };
}

/** Prancha vazia não se grava: o arquivo de quem nunca abriu a aba fica igual ao de antes. */
export const temPranchas = (p: PranchasDoProjeto | undefined): p is PranchasDoProjeto =>
  !!p && (p.folhas.length > 0 || Object.entries(p.obra).some(([k, v]) => v !== OBRA_EM_BRANCO[k as keyof DadosDaObra]));
