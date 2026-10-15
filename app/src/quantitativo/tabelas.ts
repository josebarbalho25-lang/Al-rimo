/*
  AS TABELAS DO QUANTITATIVO — uma descrição só para a tela e para o CSV.

  Rótulo, unidade e casas decimais ficam escritos aqui uma vez; a tela e o arquivo leem a mesma tabela. Se
  cada um formatasse por conta própria, o número que o Jose vê e o que abre no Excel acabariam diferentes na
  última casa — e é exatamente isso que ele confere lado a lado.

  CSV para o Excel em português: separador ';', vírgula decimal, sem separador de milhar (o Excel lê "1234,5"
  como número; "1.234,5" depende da configuração), UTF-8 com BOM (sem ele o Excel estraga os acentos) e CRLF.
*/
import { blocosParaCompra, type Quantitativo } from './index';
import { figuraDaPeca, type FiguraDaPeca } from './pecas';

export type Celula = string | { n: number; casas: number } | null;

export interface Tabela {
  id: string;
  titulo: string;
  cabecalho: string[];
  linhas: Celula[][];
  total?: Celula[];
  /** Só a tela: a figura da peça de cada linha (mesma ordem de `linhas`; null = sem figura). O CSV não lê. */
  figuras?: (FiguraDaPeca | null)[];
  /** Linhas que detalham a de cima e ficam FORA do total (a canaleta para cortar, dentro das canaletas compradas). */
  recuadas?: boolean[];
}

/** O começo do rótulo da linha recuada na tela e no CSV; a prancha desenha o recuo e tira a marca. */
export const MARCA_DAS_QUAIS = '↳ ';

const num = (n: number, casas: number): Celula => ({ n, casas });
const bitola = (phi: number): Celula => num(phi, Number.isInteger(phi) ? 0 : 1);

// −0,000 na tela é ruído: o que arredonda para zero é zero.
function arredondado(n: number, casas: number): number {
  const f = 10 ** casas;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) || Math.abs(r) < 0.5 / f ? 0 : r;
}

const FORMATOS = new Map<number, Intl.NumberFormat>();
export function formatarNaTela(c: Celula): string {
  if (c === null) return '';
  if (typeof c === 'string') return c;
  let f = FORMATOS.get(c.casas);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: c.casas, maximumFractionDigits: c.casas });
    FORMATOS.set(c.casas, f);
  }
  return f.format(arredondado(c.n, c.casas));
}

export function formatarNoCsv(c: Celula): string {
  if (c === null) return '';
  if (typeof c !== 'string') return arredondado(c.n, c.casas).toFixed(c.casas).replace('.', ',');
  return /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
}

export function tabelasDoQuantitativo(q: Quantitativo): Tabela[] {
  const t: Tabela[] = [];

  const muro: Celula[][] = [
    ['Família', q.muro.familia, ''],
    ['Comprimento', num(q.muro.comprimento, 2), 'm'],
    ['Altura do muro', num(q.muro.alturaMuro, 2), 'm'],
    ['Altura de solo', num(q.muro.alturaSolo, 2), 'm'],
    ['Fiadas', num(q.muro.fiadas, 0), 'un'],
  ];
  if (q.muro.contrafortes > 0) muro.push(['Contrafortes', num(q.muro.contrafortes, 0), 'un']);
  if (q.muro.trechos > 1) muro.push(['Trechos', num(q.muro.trechos, 0), 'un']);
  t.push({ id: 'muro', titulo: 'Muro', cabecalho: ['Item', 'Valor', 'Unidade'], linhas: muro });

  // a compra: canaleta cortada vira inteira, com a parte para cortar logo abaixo (fora do total)
  const compra = blocosParaCompra(q.blocos);
  t.push({
    id: 'blocos',
    titulo: 'Blocos e canaletas',
    cabecalho: ['Peça', 'Catálogo', 'Quantidade (un)'],
    linhas: compra.map((l) => [l.dasQuais ? `${MARCA_DAS_QUAIS}${l.rotulo}` : l.rotulo, l.catalogo, num(l.quantidade, 0)]),
    total: ['Total', null, num(q.totalBlocos, 0)],
    figuras: compra.map((l) => figuraDaPeca(q.muro.familia, l)),
    recuadas: compra.map((l) => !!l.dasQuais),
  });

  t.push({
    id: 'graute',
    titulo: 'Graute',
    cabecalho: ['Item', 'Quantidade', 'Unidade'],
    linhas: [
      ['Furos verticais', num(q.graute.furos, 3), 'm³'],
      ['Canaletas', num(q.graute.canaletas, 3), 'm³'],
    ],
    total: ['Total', num(q.graute.total, 3), 'm³'],
  });

  t.push({
    id: 'argamassa',
    titulo: 'Argamassa de assentamento',
    cabecalho: ['Item', 'Quantidade', 'Unidade'],
    linhas: [
      ['Juntas horizontais', num(q.argamassa.horizontal, 3), 'm³'],
      ['Juntas verticais', num(q.argamassa.vertical, 3), 'm³'],
    ],
    total: ['Total', num(q.argamassa.total, 3), 'm³'],
  });

  t.push({
    id: 'ferros',
    titulo: 'Lista de ferros',
    cabecalho: ['N', 'Elemento', 'Ø (mm)', 'Quant. (un)', 'C. unit. (cm)', 'C. total (m)', 'Massa (kg)'],
    linhas: q.ferros.map((f) => [
      f.posicao, f.elemento, bitola(f.diametro), num(f.quantidade, 0),
      num(f.comprimentoUnit, 0), num(f.comprimentoTotal, 2), num(f.massa, 2),
    ]),
  });

  t.push({
    id: 'aco',
    titulo: 'Resumo do aço',
    cabecalho: ['Ø (mm)', 'Massa nominal (kg/m)', 'C. total (m)', 'Massa (kg)'],
    linhas: q.resumoAco.map((r) => [bitola(r.diametro), num(r.massaLinear, 3), num(r.comprimento, 2), num(r.massa, 2)]),
    total: ['Total', null, null, num(q.massaAco, 2)],
  });

  t.push({
    id: 'sapata',
    titulo: 'Sapata',
    cabecalho: ['Item', 'Quantidade', 'Unidade'],
    linhas: [
      ['Concreto', num(q.sapata.concreto, 3), 'm³'],
      ['Fôrma', num(q.sapata.forma, 2), 'm²'],
    ],
  });

  // Item desligado nas entradas não aparece: linha zerada na tela parece esquecimento, não escolha.
  const d = q.drenagem;
  const dren: Celula[][] = [];
  if (d.barbacas > 0) {
    dren.push(['Barbacãs', num(d.barbacas, 0), 'un']);
    dren.push(['Tubo dos barbacãs', num(d.tubo, 2), 'm']);
  }
  if (d.brita > 0) dren.push(['Brita do dreno', num(d.brita, 3), 'm³']);
  if (d.areia > 0) dren.push(['Areia do filtro', num(d.areia, 3), 'm³']);
  if (d.tuboFundo > 0) dren.push(['Tubo perfurado do dreno de fundo', num(d.tuboFundo, 2), 'm']);
  if (d.manta > 0) dren.push(['Manta geotêxtil', num(d.manta, 2), 'm²']);
  if (d.impermeabilizacao !== null) dren.push(['Impermeabilização do tardoz', num(d.impermeabilizacao, 2), 'm²']);
  if (dren.length) t.push({ id: 'drenagem', titulo: 'Drenagem', cabecalho: ['Item', 'Quantidade', 'Unidade'], linhas: dren });

  return t;
}

export function csvDoQuantitativo(q: Quantitativo): string {
  const linhas: string[] = [];
  const linha = (cs: Celula[]) => linhas.push(cs.map(formatarNoCsv).join(';'));
  tabelasDoQuantitativo(q).forEach((t, i) => {
    if (i > 0) linhas.push('');
    linha([t.titulo]);
    linha(t.cabecalho);
    t.linhas.forEach(linha);
    if (t.total) linha(t.total);
  });
  if (q.avisos.length) {
    linhas.push('');
    linha(['Avisos']);
    q.avisos.forEach((a) => linha([a]));
  }
  return '﻿' + linhas.join('\r\n') + '\r\n';
}
