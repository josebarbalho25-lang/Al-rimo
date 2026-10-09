/*
  SELO DOS TEMPLATES DO REVIT — o app monta EXATAMENTE como o Jose monta.

  Para cada gabarito medido no Revit dele (dados/encaixes_revit/*.json), o teste gera o muro de uma configuração
  equivalente (bloco, comprimento do contraforte, eixo a eixo, fiadas, canaletas onde o template tem) e confere, peça
  a peça, tipo, comprimento, direção e faixa X/Y (tolerância 0,5 mm), e — nas peças de bloco — o lugar de cada furo,
  no mundo, contra a descrição da família do Revit (é o que prende o "giro" das peças assimétricas, o 34 e o 54).

  Template novo do Jose = gabarito novo em dados/encaixes_revit + um caso em CASOS abaixo.

  REVIT → APP: no Revit o contraforte sai para −Y; no app o contraforte enterrado sai para +Y (Y = 0 na face
  aparente). O mesmo muro visto do mesmo lado é o Revit GIRADO 180° em torno de Z (não espelhado — espelhar trocaria
  a peça por outra): X_app = (X_max − X)·10, Y_app = (Y_face − Y)·10, em mm. Fiada = (z − z_min)/20.

  O que fica de fora, com o porquê (vai no recado ao Jose):
    - 19x39, fiada de canaleta, linha do muro: no gabarito as juntas da canaleta caíram em cima das da fiada de baixo
      (fiadas 4/5 e 9/10); o app desloca 1/4 de bloco, como o Jose fez na 14x39. Aqui só se confere que a canaleta
      corre de ponta a ponta; a haste da canaleta é conferida peça a peça.
    - 19x39, contraforte de 59: deslize de modelagem no T (peças sobrepostas, "deslize_no_modelo" no JSON) — vale a
      montagem pretendida, a mesma das pontas e do de 79.
    - Casa R (contraforte de 39): é muro de casa, de 08/10, com o T montado de outro jeito (os dois contrafortes I na
      mesma fiada e o inteiro passando sobre o T na fiada P). Confere-se a ponta (L) e a haste de 39.
    - Volume da canaleta 19 CORTADA: a família "Canaleta 19 Corte 19cm" do Revit tem fundo de 3,91 (2864 cm³), 1 cm
      mais grosso que a inteira (2,91) — não sai de uma inteira serrada. O app corta a inteira (mesma seção); a
      inteira confere com o volume do Revit (5333 cm³), a cortada não entra na conferência de volume.
    - Contraforte dobrado (19x39_dobrado.json e o de 79 parcial): fora do app por decisão do Jose (09/10) — risco de
      execução errada, e a inércia vem do comprimento, não da largura. O gabarito fica só como arquivo.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo, TipoPeca, Vec3 } from '@/modelo/tipos';
import { caixaGlobal, gerarModelo, paraGlobal } from './index';
import { CORES_DO_JOSE } from './catalogo';

const PASTA = fileURLToPath(new URL('../../../dados/encaixes_revit/', import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ler = (arq: string): any => JSON.parse(readFileSync(PASTA + arq, 'utf8'));

const TOL = 0.5;
const ALVENARIA = new Set<TipoPeca>(['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);

/** Peça medida (do Revit, já no referencial do app) ou gerada pelo app. mm. */
interface Peca {
  chave: string;                       // chave do catálogo do app ('inteiro', '540', 'canaleta@240'...)
  fiada: number;
  x0: number; x1: number; y0: number; y1: number;
  furos?: [number, number, number, number][];   // caixa de cada furo no mundo: x0, x1, y0, y1
  volume?: number;                     // mm³
  id: string;
}

// ── a família do Revit: furos a partir da descrição ──────────────────────────

const num = (s: string): number => Number(s.replace(',', '.'));

/** Paredes e furos (ao longo da peça, a partir da ponta local x = 0), da descrição da família no JSON. cm. */
function furosDaDescricao(txt: string): { parede: number; furos: [number, number][] } {
  const parede = num((/paredes(?: longitudinais)? ([\d,]+)/.exec(txt) ?? [])[1] ?? 'NaN');
  if (txt.includes('|')) {
    const furos: [number, number][] = [];
    let x = 0;
    for (const seg of txt.slice(txt.indexOf('septo')).split(';')[0].split('|')) {
      const v = num((/([\d,]+)/.exec(seg) ?? [])[1] ?? 'NaN');
      if (/furo/.test(seg)) furos.push([x, x + v]);
      x += v;
    }
    return { parede, furos };
  }
  const [, n, , l] = /(\d+) furos? ([\d,]+) x ([\d,]+)/.exec(txt) ?? [];
  const septo = num((/septos ([\d,]+)/.exec(txt) ?? [])[1] ?? String(parede));
  const L = num(l);
  return { parede, furos: Array.from({ length: Number(n) }, (_, k) => [septo + k * (L + septo), septo + k * (L + septo) + L] as [number, number]) };
}

// ── os templates ─────────────────────────────────────────────────────────────

interface PecaRevit { familia: string; tipo: string; giro: number; x0: number; x1: number; y0: number; y1: number; z0: number; vol_cm3?: number; id: number | string }

/** Chave do catálogo do app para a peça do Revit. */
function chaveDoRevit(p: PecaRevit): string {
  const f = p.familia.normalize('NFC');
  if (f.startsWith('Bloco 54')) return '540';
  if (f.startsWith('Bloco 34')) return '340';
  if (f.startsWith('Meio Bloco')) return 'meio';
  if (f.startsWith('Blocos Padr')) return 'inteiro';
  if (f.startsWith('Canaleta')) {
    const c = /Corte (\d+)/.exec(p.tipo);
    if (c) return `canaleta@${Number(c[1]) * 10}`;
    return /x19x19$/.test(p.tipo) ? 'meia_canaleta' : 'canaleta';
  }
  throw new Error(`peça do Revit sem correspondente no app: ${p.familia} ${p.tipo}`);
}

/** Descrição da família do Revit para a chave (as de 19 vêm da Casa R, que descreve os furos). */
function descricao(fam: '14x39' | '19x39', chave: string): string | undefined {
  const fontes = fam === '14x39' ? [ler('14x39_templates.json').familias_revit] : [ler('19x39_casaR.json').familias_revit];
  const nomes: Record<string, string> = { inteiro: 'Blocos Padr', meio: 'Meio Bloco', '540': 'Bloco 54', '340': 'Bloco 34' };
  for (const f of fontes) for (const [k, v] of Object.entries(f)) if (nomes[chave] && k.normalize('NFC').startsWith(nomes[chave])) return v as string;
  return undefined;
}

/** Peças do template no referencial do app. */
function doRevit(pecas: PecaRevit[], fam: '14x39' | '19x39', xMax: number, yFace: number, zMin: number): Peca[] {
  const X = (x: number): number => Math.round((xMax - x) * 100) / 10;
  const Y = (y: number): number => Math.round((yFace - y) * 100) / 10;
  return pecas.map((p) => {
    const chave = chaveDoRevit(p);
    const out: Peca = {
      chave, fiada: Math.round((p.z0 - zMin) / 20), x0: X(p.x1), x1: X(p.x0), y0: Y(p.y1), y1: Y(p.y0), id: `Revit ${p.id}`,
    };
    // canaleta 19 cortada: a família do Revit tem outro fundo (ver cabeçalho) — fica fora da conferência de volume
    if (p.vol_cm3 && !(fam === '19x39' && chave.startsWith('canaleta@'))) out.volume = p.vol_cm3 * 1000;
    const d = descricao(fam, chave);
    if (d) {
      // furo no Revit: ao longo da peça a partir da ponta local x = 0, que o giro leva para o mundo
      const { parede, furos } = furosDaDescricao(d);
      out.furos = furos.map(([a, b]) => {
        let fx0: number, fx1: number, fy0: number, fy1: number;
        switch (p.giro) {
          case 90: [fy0, fy1, fx0, fx1] = [p.y0 + a, p.y0 + b, p.x0 + parede, p.x1 - parede]; break;
          case 180: [fx0, fx1, fy0, fy1] = [p.x1 - b, p.x1 - a, p.y0 + parede, p.y1 - parede]; break;
          case 270: [fy0, fy1, fx0, fx1] = [p.y1 - b, p.y1 - a, p.x0 + parede, p.x1 - parede]; break;
          default: [fx0, fx1, fy0, fy1] = [p.x0 + a, p.x0 + b, p.y0 + parede, p.y1 - parede];
        }
        return [X(fx1), X(fx0), Y(fy1), Y(fy0)];
      });
    }
    return out;
  });
}

/** Peças de alvenaria do Modelo, no mesmo formato. */
function doApp(m: Modelo): Peca[] {
  const out: Peca[] = [];
  for (const p of m.pecas) {
    if (!ALVENARIA.has(p.tipo) || p.fiada === undefined) continue;
    const g = m.geometrias[p.geometria];
    const c = caixaGlobal(p, g);
    const chave = g.chave.split(' ').slice(2).join(' ');
    const r = (v: number): number => Math.round(v * 10) / 10;
    const q: Peca = { chave, fiada: p.fiada, x0: r(c.min[0]), x1: r(c.max[0]), y0: r(c.min[1]), y1: r(c.max[1]), id: p.id, volume: g.volume_mm3 };
    if (g.eixo === 'Z' && g.perfil.furos) {
      q.furos = g.perfil.furos.map((f) => {
        const pts = f.map(([u, v]) => paraGlobal(p, g, [u, v, 0] as Vec3));
        const xs = pts.map((k) => k[0]);
        const ys = pts.map((k) => k[1]);
        return [r(Math.min(...xs)), r(Math.max(...xs)), r(Math.min(...ys)), r(Math.max(...ys))];
      });
    }
    out.push(q);
  }
  return out;
}

const mesmaCaixa = (a: Peca, b: Peca): boolean =>
  Math.abs(a.x0 - b.x0) <= TOL && Math.abs(a.x1 - b.x1) <= TOL && Math.abs(a.y0 - b.y0) <= TOL && Math.abs(a.y1 - b.y1) <= TOL;
const fmt = (p: Peca): string => `${p.id} ${p.chave} f${p.fiada} x[${p.x0}, ${p.x1}] y[${p.y0}, ${p.y1}]`;
const ordenar = (f: [number, number, number, number][]) => [...f].sort((u, v) => u[0] - v[0] || u[2] - v[2]);

/**
 * Compara as peças esperadas (gabarito) com as do app: cada esperada tem de existir no app (mesma chave e caixa),
 * com os mesmos furos; com `exato`, o app também não pode ter peça a mais.
 */
function comparar(esperadas: Peca[], app: Peca[], exato: boolean): string[] {
  const erros: string[] = [];
  const usadas = new Set<Peca>();
  for (const e of esperadas) {
    const a = app.find((q) => !usadas.has(q) && q.fiada === e.fiada && mesmaCaixa(q, e));
    if (!a) {
      erros.push(`falta no app: ${fmt(e)}`);
      continue;
    }
    usadas.add(a);
    if (a.chave !== e.chave) erros.push(`peça trocada: ${fmt(e)} → app ${a.chave}`);
    if (e.furos) {
      const fa = ordenar(a.furos ?? []);
      const fe = ordenar(e.furos);
      const ok = fa.length === fe.length && fe.every((h, k) => h.every((v, j) => Math.abs(v - fa[k][j]) <= TOL));
      if (!ok) erros.push(`furos: ${fmt(e)} Revit ${JSON.stringify(fe)} × app ${JSON.stringify(fa)}`);
    }
    // volume: 0,2 % (o Revit arredonda o cm³)
    if (e.volume && a.volume && Math.abs(a.volume / e.volume - 1) > 2e-3) erros.push(`volume: ${fmt(e)} Revit ${e.volume / 1000} × app ${(a.volume / 1000).toFixed(1)} cm³`);
  }
  if (exato) for (const a of app) if (!usadas.has(a)) erros.push(`a mais no app: ${fmt(a)}`);
  return erros;
}

// ── a configuração equivalente ───────────────────────────────────────────────

/** Resultado do gabarito da aula 12.3 (muro com contrafortes) com a geometria do template. */
function configuracao(troca: Record<string, Valor>): Resultado {
  const r = resultadoDoGabarito('aula123');
  return {
    v: (n) => (n in troca ? troca[n] : r.v(n)),
    num: (n) => {
      const x = n in troca ? troca[n] : r.v(n);
      return typeof x === 'number' ? x : null;
    },
    cel: (ref) => r.cel(ref),
    alteracoes: r.alteracoes,
  };
}

interface Caso {
  nome: string;
  fam: '14x39' | '19x39';
  pecas: PecaRevit[];
  xMax: number; yFace: number; zMin: number;
  tenr: number;          // cm
  lcf: number;           // m
  fiadas: number;
  sCanaleta: number;     // cm (0 = sem canaleta intermediária)
  cinta: boolean;
  L: number;             // m
  /** só a vizinhança destes contrafortes (eixo X do Revit) — template parcial */
  soNos?: number[];
  /** canaleta da 19x39: só a haste é conferida peça a peça (ver cabeçalho) */
  canaletaSoNaHaste?: boolean;
}

const T14 = ler('14x39_templates.json').templates;
const T19 = ler('19x39_templates.json').templates;
const CR = ler('19x39_casaR.json');

/** O deslize do template de 59 no T, corrigido para a montagem pretendida (JSON: "deslize_no_modelo"). */
function semDeslize(pecas: PecaRevit[], eixoT: number): PecaRevit[] {
  const noT = (p: PecaRevit) => Math.abs((p.x0 + p.x1) / 2 - eixoT) < 1;
  const dentro = (a: PecaRevit, b: PecaRevit) => a !== b && a.z0 === b.z0 && noT(b) && a.y0 >= b.y0 - 0.05 && a.y1 <= b.y1 + 0.05 && a.y1 - a.y0 < b.y1 - b.y0;
  return pecas
    // fiadas ímpares: o meio bloco a mais, dentro do inteiro de fora
    .filter((p) => !(noT(p) && pecas.some((q) => dentro(p, q))))
    // fiadas pares: o inteiro recortado (4347 cm³) por cima do que atravessa → o meio por fora, como nas pontas
    .map((p) => (noT(p) && p.vol_cm3 === 4347 ? { ...p, familia: 'Meio Bloco', tipo: '19x19x19', y0: p.y0, y1: p.y0 + 19, vol_cm3: 3165 } : p));
}

const CASOS: Caso[] = [
  { nome: '14x39 contraforte de 34 (T e L)', fam: '14x39', pecas: T14.contraforte_curto_34.pecas, xMax: -1043.1, yFace: -8.1, zMin: 1, tenr: 34, lcf: 1.35, fiadas: 10, sCanaleta: 100, cinta: true, L: 2.84 },
  { nome: '14x39 contraforte de 54 (T e L)', fam: '14x39', pecas: T14.contraforte_longo_54.pecas, xMax: -1413.1, yFace: -8.1, zMin: 1, tenr: 54, lcf: 1.35, fiadas: 10, sCanaleta: 100, cinta: true, L: 2.84 },
  { nome: '19x39 contraforte de 79 (T e L)', fam: '19x39', pecas: T19.contraforte_79.pecas, xMax: -524.1, yFace: -8.1, zMin: 1, tenr: 79, lcf: 1.8, fiadas: 10, sCanaleta: 100, cinta: true, L: 3.79, canaletaSoNaHaste: true },
  { nome: '19x39 contraforte de 59 (T e L)', fam: '19x39', pecas: semDeslize(T19.contraforte_59.pecas, -194.1), xMax: -4.6, yFace: -8.1, zMin: 1, tenr: 59, lcf: 1.8, fiadas: 10, sCanaleta: 100, cinta: true, L: 3.79, canaletaSoNaHaste: true },
  {
    nome: '19x39 contraforte de 39 (Casa R: a ponta)', fam: '19x39', xMax: 50.5, yFace: 2496.2, zMin: 111, tenr: 39, lcf: 1.0, fiadas: 2, sCanaleta: 0, cinta: false, L: 2.19, soNos: [41],
    pecas: CR.fiadas.flatMap((f: { z: [number, number]; pecas: { id: number; peca: string; x: [number, number]; y: [number, number] }[] }) => f.pecas.map((p) => ({
      familia: p.peca.startsWith('meio') ? 'Meio Bloco' : 'Blocos Padrão', tipo: '19x19x39', giro: p.peca.includes('girado 90') ? 90 : 0,
      x0: p.x[0], x1: p.x[1], y0: p.y[0], y1: p.y[1], z0: f.z[0], id: p.id,
    }))),
  },
];

/** Peças que encostam na faixa do nó [a, b] (qualquer Y) e as do muro vizinhas delas (uma junta de distância). */
function vizinhanca(pecas: Peca[], a: number, b: number, t: number): Peca[] {
  const noNo = pecas.filter((p) => p.x0 < b - TOL && p.x1 > a + TOL);
  const doMuro = (p: Peca) => p.y0 < TOL && p.y1 > t - TOL;
  const viz = pecas.filter((p) => doMuro(p) && !noNo.includes(p) && noNo.some((q) => q.fiada === p.fiada && doMuro(q) && (Math.abs(p.x0 - q.x1 - 10) <= TOL || Math.abs(q.x0 - p.x1 - 10) <= TOL)));
  return [...noNo, ...viz];
}

describe('gabaritos do Revit do Jose (selo dos templates)', () => {
  for (const c of CASOS) {
    it(c.nome, () => {
      const t = c.fam === '14x39' ? 14 : 19;
      const m = gerarModelo(
        configuracao({
          t_bloco: t, L_bloco: 39, eenr: t, m_mod: 20, Ag_furo: t === 14 ? 117 : 170, hf_bl: t === 14 ? 2.7 : 3.5,
          l_cf: c.lcf, l_cf_adot: c.lcf, tenr_: c.tenr, tenr_adot: c.tenr,
          H_muro: c.fiadas * 0.2, n_fiadas: c.fiadas, H_muro_des: c.fiadas * 0.2, s_ph: c.sCanaleta || null,
          pos_cf: 'Enterrado (lado do solo)',
        }),
        { L_total: c.L, cinta_topo: c.cinta ? 'Sim' : 'Não', junta_cada: 0 },
      );
      const tm = t * 10;
      expect(m.dims.n_fiadas).toBe(c.fiadas);
      expect(m.dims.L_real).toBe(Math.round(c.L * 1000));
      let esperadas = doRevit(c.pecas, c.fam, c.xMax, c.yFace, c.zMin);
      let app = doApp(m);

      // fiadas de canaleta (as do template), e a canaleta da 19x39: linha do muro de ponta a ponta, haste peça a peça
      const fiadasC = new Set(esperadas.filter((p) => p.chave.startsWith('canaleta')).map((p) => p.fiada));
      expect([...fiadasC].sort(), 'fiadas de canaleta').toEqual([...new Set(app.filter((p) => p.chave.startsWith('canaleta')).map((p) => p.fiada))].sort());
      if (c.canaletaSoNaHaste) {
        for (const i of fiadasC) {
          const muro = app.filter((p) => p.fiada === i && p.y1 <= tm + TOL).sort((u, v) => u.x0 - v.x0);
          expect(muro.every((p) => p.chave.startsWith('canaleta')), `fiada ${i}: só canaleta no muro`).toBe(true);
          expect(muro[0].x0).toBe(0);
          expect(muro[muro.length - 1].x1).toBe(m.dims.L_real);
          for (let k = 1; k < muro.length; k++) expect(muro[k].x0 - muro[k - 1].x1, `fiada ${i}: junta`).toBeCloseTo(10, 6);
        }
        const doMuroC = (p: Peca) => fiadasC.has(p.fiada) && p.y1 <= tm + TOL;
        esperadas = esperadas.filter((p) => !doMuroC(p));
        app = app.filter((p) => !doMuroC(p));
      }

      expect(esperadas.length, 'peças do gabarito conferidas').toBeGreaterThan(c.soNos ? 0 : 90);
      if (c.soNos) {
        // template parcial: só a vizinhança dos contrafortes pedidos, no app e no gabarito
        for (const xr of c.soNos) {
          const xc = (c.xMax - xr) * 10;
          const [a, b] = [xc - tm / 2, xc + tm / 2];
          const viz = vizinhanca(esperadas, a, b, tm);
          expect(viz.length, 'peças da ponta no gabarito').toBe(5);   // fiada I: passante + bloco; P: bloco, meio de fora, bloco
          expect(comparar(viz, vizinhanca(app, a, b, tm), true)).toEqual([]);
        }
      } else {
        expect(comparar(esperadas, app, true)).toEqual([]);
      }
    });
  }

  it('cores do Jose por classe de peça: o catálogo bate com cores_jose.json e toda peça de alvenaria tem classe', () => {
    const cores = ler('cores_jose.json').cores as Record<string, string>;
    const doJose = Object.entries(cores).map(([k, v]) => [k.normalize('NFC'), v.toLowerCase()] as const);
    const acha = (inicio: string) => doJose.find(([k]) => k.startsWith(inicio))?.[1];
    expect(CORES_DO_JOSE).toEqual({
      inteiro: acha('bloco inteiro'), meio: acha('meio bloco'), canaleta: acha('canaleta'), bloco34: acha('bloco 34'), bloco54: acha('bloco 54'),
    });
    const vistas = new Set<string>();
    for (const c of CASOS) {
      const t = c.fam === '14x39' ? 14 : 19;
      const m = gerarModelo(
        configuracao({ t_bloco: t, L_bloco: 39, eenr: t, m_mod: 20, l_cf: c.lcf, l_cf_adot: c.lcf, tenr_: c.tenr, tenr_adot: c.tenr, H_muro: c.fiadas * 0.2, n_fiadas: c.fiadas, H_muro_des: c.fiadas * 0.2, s_ph: c.sCanaleta || null }),
        { L_total: c.L, cinta_topo: c.cinta ? 'Sim' : 'Não' },
      );
      for (const p of m.pecas) {
        if (!ALVENARIA.has(p.tipo)) continue;
        const g = m.geometrias[p.geometria];
        expect(g.classe, `${c.nome} ${p.id}`).toBeDefined();
        vistas.add(`${g.classe}|${g.catalogo}`);
      }
    }
    const classes = new Set([...vistas].map((v) => v.split('|')[0]));
    expect([...classes].sort()).toEqual(['bloco34', 'bloco54', 'canaleta', 'inteiro', 'meio']);
    // o 34 e o 54 nunca se confundem com outro nome comercial
    for (const v of vistas) {
      const [cl, nome] = v.split('|');
      if (cl === 'bloco34') expect(nome).toContain('14x19x34');
      if (cl === 'bloco54') expect(nome).toContain('14x19x54');
    }
  });

  it('furo quadrado do 54 em cima do furo quadrado do 34, no eixo do contraforte (coluna de graute no encontro)', () => {
    const m = gerarModelo(
      configuracao({ t_bloco: 14, L_bloco: 39, eenr: 14, m_mod: 20, l_cf: 1.35, l_cf_adot: 1.35, tenr_: 34, tenr_adot: 34, H_muro: 2, n_fiadas: 10, H_muro_des: 2, s_ph: 100, pos_cf: 'Enterrado (lado do solo)' }),
      { L_total: 2.84, cinta_topo: 'Sim' },
    );
    const app = doApp(m);
    const eixoT = m.dims.contrafortes[1].x;
    const quadrados = app.filter((p) => p.chave === '540' || p.chave === '340').flatMap((p) => (p.furos ?? []).filter(([x0, x1, y0, y1]) => Math.abs(x1 - x0 - 76) < 1 && Math.abs(y1 - y0 - 76) < 1).map((f) => ({ p, f })));
    const noT = quadrados.filter(({ f }) => Math.abs((f[0] + f[1]) / 2 - eixoT) < TOL);
    expect(noT.length).toBe(8);                       // 4 fiadas de 54 + 4 de 34
    for (const { f } of noT) expect([f[2], f[3]]).toEqual([32, 108]);   // na faixa dos furos do muro
  });
});
