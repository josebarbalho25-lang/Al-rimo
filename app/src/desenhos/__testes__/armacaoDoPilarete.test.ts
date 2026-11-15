/*
  O MURO DE CIMA NOS DESENHOS (Jose, 15/11: "planta e armação do pilarete na prancha — isso é importante") — o que
  quebraria na obra:
  - a armação do pilarete com número quebrado (NaN), SVG torto, texto em cima de texto, chave de anotação repetida (a
    mexida na folha cairia na anotação errada);
  - pilarete que não entra em tipo nenhum, ou tipo que conta errado quantos são;
  - barra do pilarete ou da cinta que não aparece na lista de ferros, nem numa chamada, nem numa sombra (o armador
    não acha a barra);
  - a planta sem as fiadas do muro de cima, ou sem a cota dos pilaretes;
  - a vista frontal sem as barras do pilarete e da cinta, ou com a chamada delas contando como "muro";
  - o corte que passa no pilarete sem as barras descendo o traspasse no arrimo;
  - o pilarete da ponta passando do fim do muro (pilarete mais largo que o contraforte);
  - o DXF da folha com a armação do pilarete que o ezdxf recusa.
*/
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Modelo } from '@/modelo/tipos';
import { calcular } from '@/motor';
import { alteracoesDoExemplo } from '@/estado/novo';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { listaDeFerros } from '@/quantitativo/aco';
import { escalaDaVista, type Primitiva } from '@/pranchas/tipos';
import { criarDesenhista } from '@/pranchas/desenhista';
import { comporFolha, type ContextoDaFolha } from '@/pranchas/folha';
import { novaFolha } from '@/pranchas/padrao';
import { bytesDoDxf, gerarDxf } from '@/pranchas/dxf';
import { vistaParaPrancha } from '../paraPrancha';
import { desenharArmacaoDoPilarete, pilaretesDoModelo, tiposDePilarete } from '../armacaoDoPilarete';
import { desenharVistaFrontal } from '../vistaFrontal';
import { barrasNoCorte, cortesPadrao, desenharCorteLateral } from '../corteLateral';
import { desenharPlanta, fiadasDaPlanta, rotuloDaFiada } from '../planta';
import { elementoDaBarra, textoDaChamada } from '../chamadas';
import { Prancha } from '../prancha';
import { xmlBemFormado } from './lerSvg';

const MC = {
  mc_on: 'Sim', vento_on: 'Sim', h_mc: 2.0, t_mc: 11.5, g_mc: 1.4, arg_mc: '1,5 a 3,4 MPa', V0_v: 35, S1_v: 1.0,
  cat_v: 'III', cls_v: 'A', S3_v: 0.88, S3_e: 1.0, cin_mc: 'No topo',
};
const construido = (ex: Record<string, unknown>, L = 6): Modelo =>
  gerarModelo(calcular({ ...alteracoesDoExemplo(), ...MC, ...ex } as never), { ...padroesDoModelo(), L_total: L });

const CONSTRUIDOS: [string, Modelo][] = [
  ['balanço 19, concreto, cinta no topo', construido({ Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6 })],
  ['balanço 19, bloco grauteado, meia altura', construido({ Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6, pil_tipo: 'Bloco grauteado', cin_mc: 'A meia altura' })],
  ['balanço 19, as duas cintas com 4 barras', construido({ Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6, cin_mc: 'No topo e a meia altura', n_cin_mc: 4 })],
  ['balanço 19, gancho na cinta', construido({ Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6, cin_mc: 'No topo e a meia altura', h_mc: 2.4, s_pil: 4.4, phi_cin_mc: 6.3, n_cin_mc: 2 }, 9)],
  ['contrafortes 14·54, concreto', construido({ Tipo_muro: 'Contrafortes', t_bloco: 14, tenr_: 54, H_muro: 2.6, H_solo: 2.6, l_cf: 1.75 })],
  ['contrafortes 19·59, bloco, a cada 2', construido({ Tipo_muro: 'Contrafortes', t_bloco: 19, tenr_: 59, H_muro: 2.6, H_solo: 2.6, l_cf: 2.0, pil_tipo: 'Bloco grauteado', pil_ncf: 2, cin_mc: 'No topo e a meia altura' }, 9)],
];
const DO_GABARITO: [string, Modelo][] = cenariosDoGabarito()
  .map((c): [string, Modelo] => [c, gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6 })])
  .filter(([, m]) => !!m.dims.muroDeCima);
const MUROS = [...DO_GABARITO, ...CONSTRUIDOS];
const ESCALAS = [10, 20, 50];

type Texto = Extract<Primitiva, { k: 'texto' }>;
const textosDe = (ps: Primitiva[]): Texto[] => ps.filter((q): q is Texto => q.k === 'texto');
/** A caixa do texto (deitado ou em pé), px. */
function caixa(t: Texto): [number, number, number, number] {
  const w = Prancha.largura(t.t, t.altura, t.negrito);
  const a0 = t.ancora === 'start' ? 0 : t.ancora === 'middle' ? -w / 2 : -w;
  if (Math.abs(t.angulo) === 90) {
    const s = t.angulo > 0 ? -1 : 1;
    const ya = t.p[1] + s * a0;
    const yb = ya + s * w;
    return [t.p[0] - 0.85 * t.altura, Math.min(ya, yb), 0.85 * t.altura, w];
  }
  return [t.p[0] + a0, t.p[1] - 0.85 * t.altura, w, 0.85 * t.altura];
}
const cruzam = (a: number[], b: number[]) => a[0] < b[0] + b[2] - 0.5 && b[0] < a[0] + a[2] - 0.5 && a[1] < b[1] + b[3] - 0.5 && b[1] < a[1] + a[3] - 0.5;
const PAPEIS_MC = new Set(['PIL_LONG', 'PIL_ESTRIBO', 'CINTA_MC']);

describe('muros com muro de cima para o teste', () => {
  it('há muros do gabarito e construídos, com pilarete de concreto e de bloco, com e sem estribo', () => {
    expect(DO_GABARITO.length).toBeGreaterThanOrEqual(5);
    const todos = MUROS.map(([, m]) => m);
    expect(todos.some((m) => m.barras.some((b) => b.papel === 'PIL_ESTRIBO'))).toBe(true);
    expect(todos.some((m) => m.pecas.some((p) => p.tipo === 'PILARETE') && !m.barras.some((b) => b.papel === 'PIL_ESTRIBO'))).toBe(true);
    // gancho na ponta da cinta (eixo com mais de dois pontos) em pelo menos um
    expect(todos.some((m) => m.barras.some((b) => b.papel === 'CINTA_MC' && b.eixo.length > 2))).toBe(true);
  });
});

describe('armação do pilarete', () => {
  for (const [nome, m] of MUROS) {
    it(`${nome}: cada pilarete num tipo só, e a contagem fecha`, () => {
      const pils = pilaretesDoModelo(m);
      const tipos = tiposDePilarete(m);
      expect(pils.length).toBe(m.pecas.filter((p) => p.tipo === 'PILARETE').length);
      expect(tipos.reduce((s, t) => s + t.pilaretes.length, 0)).toBe(pils.length);
      expect(new Set(tipos.flatMap((t) => t.pilaretes.map((p) => p.solido.peca.id))).size).toBe(pils.length);
      // as barras de cada pilarete são as dele (pelo id) e toda longitudinal e todo estribo tem dono
      const comDono = new Set(pils.flatMap((p) => [...p.longs, ...p.estribos].map((b) => b.id)));
      for (const b of m.barras.filter((q) => q.papel === 'PIL_LONG' || q.papel === 'PIL_ESTRIBO')) expect(comDono.has(b.id), b.id).toBe(true);
    });
    for (const e of ESCALAS) {
      it(`${nome}, 1:${e}: sem NaN, SVG bem formado, textos sem se encobrir, chaves únicas`, () => {
        const v = vistaParaPrancha(m, { tipo: 'pilarete' }, e, 'p');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${v.defs}</defs>${v.corpo}</svg>`;
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        expect(xmlBemFormado(svg)).toBeNull();
        expect(JSON.stringify(v.primitivas)).not.toMatch(/NaN|null,null/);
        expect(v.caixa.every(Number.isFinite)).toBe(true);
        const ts = textosDe(v.primitivas);
        const encobertos: string[] = [];
        for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
          if (cruzam(caixa(ts[i]), caixa(ts[j]))) encobertos.push(`"${ts[i].t}" × "${ts[j].t}"`);
        }
        expect(encobertos).toEqual([]);
        const chaves = (v.anotacoes ?? []).map((a) => a.chave);
        expect(new Set(chaves).size).toBe(chaves.length);
        // as partes (seção, sombras) com nome único
        const regioes = (v.regioes ?? []).map((r) => r.nome);
        expect(new Set(regioes).size).toBe(regioes.length);
      });
    }
    it(`${nome}: toda posição do pilarete e da cinta está na lista de ferros e numa sombra ou chamada`, () => {
      const lista = new Set(listaDeFerros(m.barras).linhas.map((l) => l.posicao));
      const ps = [
        ...desenharArmacaoDoPilarete(m, { S: escalaDaVista(20), semTitulo: true }).primitivas(),
        ...desenharVistaFrontal(m, { S: escalaDaVista(50), semTitulo: true, chamadas: true }).primitivas(),
      ];
      const escrito = textosDe(ps).map((t) => t.t).join('\n');
      for (const b of m.barras.filter((q) => PAPEIS_MC.has(q.papel))) {
        expect(lista.has(b.posicao), `${b.posicao} na lista`).toBe(true);
        expect(escrito, `${b.posicao} (${b.papel})`).toContain(`${b.posicao} – `);
      }
      // a legenda da sombra é a da chamada do elemento (a mesma quantidade e o mesmo C)
      const sombras = textosDe(desenharArmacaoDoPilarete(m, { S: escalaDaVista(20), semTitulo: true }).primitivas()).filter((t) => t.camada === 'sombras' && / – \d+ Ø/.test(t.t));
      for (const t of sombras) {
        const n = t.t.split(' – ')[0];
        const b = m.barras.find((q) => q.posicao === n && PAPEIS_MC.has(q.papel))!;
        expect(t.t).toBe(textoDaChamada(m, n, elementoDaBarra(b)));
      }
    });
  }

  it('sem muro de cima a vista sai vazia', () => {
    const m = gerarModelo(resultadoDoGabarito('aula122'), { ...padroesDoModelo(), L_total: 6 });
    expect(desenharArmacaoDoPilarete(m).primitivas()).toEqual([]);
  });

  it('pilaretes diferentes saem separados: o da ponta (que recebe a ponta da cinta) não é o do meio', () => {
    const [, m] = CONSTRUIDOS[0];
    const tipos = tiposDePilarete(m);
    expect(tipos.length).toBeGreaterThan(1);
    const doMeio = tipos.find((t) => t.rep.pontasDaCinta.length === 0);
    expect(doMeio).toBeDefined();
  });
});

describe('o muro de cima nas outras vistas', () => {
  for (const [nome, m] of MUROS) {
    it(`${nome}: planta nas fiadas do muro de cima, com os pilaretes cortados e cotados`, () => {
      const n = m.dims.n_fiadas;
      expect(fiadasDaPlanta(m)).toBe(n + Math.round((m.dims.muroDeCima!.z1 - m.dims.muroDeCima!.z0) / 200));
      expect(rotuloDaFiada(m, n)).toBe('1ª fiada do muro de cima');
      for (let f = n; f < fiadasDaPlanta(m); f++) {
        const pr = desenharPlanta(m, f, { S: escalaDaVista(25), semTitulo: true });
        const svg = pr.svg();
        expect(svg).not.toMatch(/NaN|Infinity/);
        expect(xmlBemFormado(svg)).toBeNull();
        // o pilarete cortado e as barras dele
        const ids = new Set([...svg.matchAll(/data-id="([^"]+)"/g)].map((x) => x[1]));
        expect([...ids].some((i) => /\.MC\.P\d\d$/.test(i))).toBe(true);
        expect([...ids].some((i) => /\.MC\.P\d\d\.L/.test(i))).toBe(true);
      }
      // a cota dos pilaretes: um trecho da cadeia de cima por vão entre eles (com o "n×" das corridas iguais)
      const ps = desenharPlanta(m, n + 1, { S: escalaDaVista(25), semTitulo: true }).primitivas();
      expect(textosDe(ps).some((t) => t.camada === 'cotas' && /^t = /.test(t.t))).toBe(true);
    });

    it(`${nome}: a vista frontal desenha as barras do pilarete e da cinta, com a chamada do elemento delas`, () => {
      const pr = desenharVistaFrontal(m, { S: escalaDaVista(50), semTitulo: true, chamadas: true });
      const svg = pr.svg();
      const els = new Set(pr.chamadas.map((c) => c.chave.split('|')[1]));
      for (const [p, el] of [['PIL_LONG', 'pilarete'], ['PIL_ESTRIBO', 'pilarete'], ['CINTA_MC', 'cinta']] as const) {
        const b = m.barras.find((q) => q.papel === p);
        if (!b) continue;
        expect(svg, p).toContain(`data-id="${b.id}"`);
        expect(els.has(el), el).toBe(true);
      }
      expect(els.has('pilarete')).toBe(true);
    });

    it(`${nome}: o corte que passa num pilarete mostra as barras dele descendo no arrimo`, () => {
      const H = m.dims.H_muro;
      const c = cortesPadrao(m).find((q) => barrasNoCorte(m, q.x).linhas.some((l) => l.barra.papel === 'PIL_LONG'));
      expect(c, 'um dos cortes de saída passa num pilarete').toBeDefined();
      const ls = barrasNoCorte(m, c!.x).linhas.filter((l) => l.barra.papel === 'PIL_LONG');
      // com a ligação por definir (aviso) a barra nasce no topo do arrimo; senão desce o traspasse
      if (!m.avisos.some((a) => a.codigo === 'PILARETE_LIGACAO')) expect(ls.some((l) => Math.min(...l.pts.map((p) => p[1])) < H - 1)).toBe(true);
      const ps = desenharCorteLateral(m, c!.x, { S: escalaDaVista(25), semTitulo: true, chamadas: true }).primitivas();
      expect(textosDe(ps).some((t) => t.camada === 'sombras' && t.t === textoDaChamada(m, ls[0].barra.posicao, 'pilarete'))).toBe(true);
    });
  }

  it('a chamada do pilarete e da cinta conta só o elemento dela', () => {
    const [, m] = CONSTRUIDOS[0];
    const est = m.barras.find((b) => b.papel === 'PIL_ESTRIBO')!;
    expect(elementoDaBarra(est)).toBe('pilarete');
    expect(textoDaChamada(m, est.posicao, 'pilarete')).toMatch(/c\/\d/);
    expect(elementoDaBarra(m.barras.find((b) => b.papel === 'CINTA_MC')!)).toBe('cinta');
  });
});

describe('pilarete mais largo que o contraforte (15/11)', () => {
  const r = calcular({ ...alteracoesDoExemplo(), ...MC, Tipo_muro: 'Contrafortes', t_bloco: 19, tenr_: 59, H_muro: 2.6, H_solo: 2.6, l_cf: 2.0, b_pil: 30 } as never);
  const m = gerarModelo(r, { ...padroesDoModelo(), L_total: 9 });
  it('a planilha reprova a montagem, com o motivo', () => {
    expect(String(r.v('chk_ligg'))).toMatch(/^NÃO OK — pilarete mais largo que o contraforte/);
  });
  it('nenhum pilarete passa da ponta do trecho', () => {
    for (const p of m.pecas.filter((q) => q.tipo === 'PILARETE')) {
      const tr = m.dims.trechos[p.trecho - 1];
      const L = 300;
      expect(p.origem[0]).toBeGreaterThanOrEqual(tr.x0 - 0.5);
      expect(p.origem[0] + L).toBeLessThanOrEqual(tr.x1 + 0.5);
    }
  });
});

// ── o DXF da folha com a armação do pilarete ──────────────────────────────────────────────────────────────────────
const PYTHON = process.env.ALRIMO_PYTHON ?? 'python';
const VALIDADOR = fileURLToPath(new URL('../../../../tools/validar_dxf.py', import.meta.url));
const temEzdxf = spawnSync(PYTHON, ['-I', '-c', 'import ezdxf'], { encoding: 'utf8' }).status === 0;
const PASTA = mkdtempSync(join(tmpdir(), 'alrimo-pil-'));
afterAll(() => rmSync(PASTA, { recursive: true, force: true }));

describe('dxf da armação do pilarete', { timeout: 60_000 }, () => {
  const contexto: ContextoDaFolha = {
    numero: 1, total: 1,
    obra: { obra: 'Muro', endereco: '', proprietario: '', art: '', data: '15/11/2026', revisao: 'R00', codigo: '', desenhista: '', verificacao: '' },
    escritorio: { empresa: '', responsavel: '', crea: '', contato: '', logo: null, logoLargura: 30 },
    notasAutomaticas: [], legenda: [], aco: { linhas: [], total: 0 }, desenhar: () => null, saida: true,
  };
  for (const [nome, m] of [CONSTRUIDOS[3], CONSTRUIDOS[5]]) {
    it.skipIf(!temEzdxf)(`${nome}: audit sem erro e recover sem conserto`, () => {
      const d = criarDesenhista(m, () => {});
      const f = novaFolha('Pilaretes');
      f.formato = 'A1';
      f.itens.push({ id: 'p', conteudo: { tipo: 'pilarete' }, escala: 20, x: 30, y: 30, titulo: '', numero: '1' });
      f.itens.push({ id: 'pl', conteudo: { tipo: 'planta', fiada: m.dims.n_fiadas + 1 }, escala: 50, x: 30, y: 400, titulo: '', numero: '2' });
      const c = comporFolha(f, { ...contexto, desenhar: (item, prefixo, o) => d.desenhar(item, prefixo, o) });
      const { dxf } = gerarDxf({ nome: 'pilarete', largura: c.largura, altura: c.altura, prims: c.primitivas });
      const arq = join(PASTA, `${nome.replace(/\W+/g, '_')}.dxf`);
      writeFileSync(arq, bytesDoDxf(dxf));
      const rel = spawnSync(PYTHON, ['-I', VALIDADOR, arq, '--estrito', '--json'], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 * 1024 * 1024 });
      const j = JSON.parse(rel.stdout) as { ok: boolean };
      expect(j.ok, rel.stdout.slice(0, 2000)).toBe(true);
    });
  }
});
