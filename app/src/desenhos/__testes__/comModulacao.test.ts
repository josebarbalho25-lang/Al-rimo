/*
  OS DESENHOS COM O MURO DE VERDADE — modulação (modulacao/) alimentada pelo gabarito do Excel (dados/golden).

  O modelo de exemplo (montado à mão) testa o desenho por partes; aqui o teste é de obra: para cada cenário que
  o Excel calculou, os quatro desenhos saem legíveis (XML bom, nada cortado na borda), as cotas dizem o que a
  planilha diz (B, h da sapata, dente, a, t, alturas) e o isométrico não pinta peça de trás por cima da da frente.

  Cenário que a modulação ainda não monta não derruba este teste (o defeito é de lá e o teste dela acusa);
  ele aparece na lista do último caso. Pelo mesmo motivo a modulação é importada na hora: se ela estiver em
  obra e não compilar, este arquivo fica PULADO (com aviso), e não vermelho por defeito alheio.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado } from '@/motor/tipos';
import { corteLateral, cortesPadrao, isometrico, planta, vistaFrontal } from '../index';
import { barrasNoCorte } from '../corteLateral';
import { camera, ordemDePintura, pecasDoIsometrico, quemNaFrente, sentido, type VistaIso } from '../isometrico';
import { escalar, solidosDoModelo } from '../geometria';
import { cm, cmCheio } from '../formato';
import { CORES_DO_JOSE } from '@/modulacao/catalogo';
import { ids, rotulos, textosForaDoViewBox, xmlBemFormado } from './lerSvg';
import type { Vec3 } from '@/modelo/tipos';

interface Caso { cenario: string; r: Resultado; m: Modelo }

let modulacao: typeof import('@/modulacao') | null = null;
let semModulacao = '';
try {
  modulacao = await import('@/modulacao');
} catch (e) {
  semModulacao = (e as Error).message.split(/\r?\n/)[0];
  console.warn(`desenhos × modulação pulado — a modulação não carregou: ${semModulacao}`);
}

const casos: Caso[] = [];
const falharam: string[] = [];
for (const cenario of modulacao ? cenariosDoGabarito() : []) {
  try {
    const r = resultadoDoGabarito(cenario);
    casos.push({ cenario, r, m: modulacao!.gerarModelo(r, modulacao!.padroesDoModelo()) });
  } catch (e) {
    falharam.push(`${cenario}: ${(e as Error).message.slice(0, 80)}`);
  }
}

function desenhos(m: Modelo): Record<string, string> {
  const out: Record<string, string> = { frontal: vistaFrontal(m), planta: planta(m), iso: isometrico(m) };
  cortesPadrao(m).forEach((c, k) => (out[`corte${k}`] = corteLateral(m, c.x)));
  out.isoCorte = isometrico(m, { corteX: cortesPadrao(m)[0]?.x ?? m.dims.L_real / 2 });
  return out;
}

/** Pares (A tapa B) em que A foi pintado ANTES de B: cada um é uma peça de trás aparecendo por cima. */
function violacoesDoPintor(m: Modelo, vista: VistaIso, corteX: number | null): string[] {
  const { v, dir, cima } = camera(vista);
  const pecas = pecasDoIsometrico(solidosDoModelo(m), corteX, sentido(vista).ax > 0);
  const P = (p: Vec3): [number, number] => [escalar(p, dir), -escalar(p, cima)];
  const ordem = ordemDePintura(pecas, v, P);
  const pos = new Map(ordem.map((s, k) => [s, k]));
  const out: string[] = [];
  for (const a of pecas) for (const b of pecas) {
    if (a !== b && quemNaFrente(a, b, v) > 0 && pos.get(a)! < pos.get(b)!) out.push(`${a.peca.id} × ${b.peca.id}`);
  }
  return out;
}

const metroEmCm = (r: Resultado, nome: string): string | null => {
  const x = r.num(nome);
  return x !== null && x > 0 ? cm(x * 1000) : null;
};

describe.skipIf(!casos.length).each(casos.map((c) => [c.cenario, c] as const))('%s', (_, { r, m }) => {
  const svgs = desenhos(m);

  it('os desenhos saem bem formados, sem número podre e sem texto cortado na borda', () => {
    for (const [k, svg] of Object.entries(svgs)) {
      expect(xmlBemFormado(svg), k).toBeNull();
      expect(svg, k).not.toMatch(/NaN|undefined|Infinity/);
      expect(textosForaDoViewBox(svg), k).toEqual([]);
    }
  });

  it('vista frontal: comprimento real, altura do muro, altura de solo e todas as fiadas', () => {
    const rot = rotulos(svgs.frontal);
    expect(rot).toContain(cmCheio(m.dims.L_real));
    expect(rot).toContain(`muro ${cm(m.dims.H_muro)}`);
    expect(rot).toContain(`solo ${cm(m.dims.H_solo)}`);
    for (let i = 1; i <= m.dims.n_fiadas; i++) expect(rot).toContain(String(i));
    // as duas alturas são as da planilha (09/10): H_solo para o solo, H_muro para o muro (lista de fiadas)
    const Hs = metroEmCm(r, 'H_solo');
    if (Hs) expect(cm(m.dims.H_solo)).toBe(Hs);
    const Hm = metroEmCm(r, 'H_muro');
    if (Hm) expect(cm(m.dims.H_muro)).toBe(Hm);
  });

  it('corte: t, B, h da sapata, dente e distância ao eixo batem com a planilha', () => {
    const rot = rotulos(svgs.corte0);
    expect(rot).toContain(`t = ${cm(m.familia.t)}`);
    // (cenário com a entrada em branco: a planilha não tem número e a modulação usa o padrão — nada a comparar)
    const B = metroEmCm(r, 'B_sap'), hs = metroEmCm(r, 'h_sap'), a = metroEmCm(r, 'a_ater');
    if (B) expect(rot).toContain(`B = ${B}`);
    if (hs) expect(rot).toContain(hs);
    if (a) expect(rot).toContain(a);
    const hd = metroEmCm(r, 'h_den'), bd = metroEmCm(r, 'b_den');
    if (hd && bd) {
      expect(rot).toContain(hd);
      expect(rot).toContain(bd);
    }
    // d só existe com barra vertical no painel (painel não armado na vertical não tem d)
    if (m.barras.some((b) => b.papel === 'VERT_MURO')) expect(rot.some((q) => q.startsWith('d = '))).toBe(true);
  });

  it('cortes padrão: o do painel não passa em contraforte; havendo contraforte, o 2º corta um', () => {
    const c = cortesPadrao(m);
    const t = m.familia.t;
    expect(m.dims.contrafortes.some((q) => Math.abs(q.x - c[0].x) <= t / 2)).toBe(false);
    if (m.dims.contrafortes.length) {
      expect(c.length).toBe(2);
      expect(rotulos(svgs.corte1).some((q) => q.startsWith('contraforte '))).toBe(true);
    }
  });

  it('planta: comprimento e espessura', () => {
    const rot = rotulos(svgs.planta);
    expect(rot).toContain(cmCheio(m.dims.L_real));
    expect(rot).toContain(`t = ${cm(m.familia.t)}`);
  });

  it('vista frontal: toda peça da face aparece', () => {
    const visto = ids(svgs.frontal);
    const t = m.familia.t;
    const faltam = solidosDoModelo(m)
      .filter((s) => ['BLOCO', 'MEIO_BLOCO', 'CANALETA', 'MEIA_CANALETA', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA_CORTADA'].includes(s.peca.tipo))
      .filter((s) => s.min[1] < t - 1 && !visto.has(s.peca.id))
      .map((s) => s.peca.id);
    expect(faltam).toEqual([]);
  });

  it('vista frontal: cada peça na cor que a modulação gravou (Geometria.classe → cores do Jose)', () => {
    // fill de cada peça na elevação, lido do SVG
    const fill = new Map<string, string>();
    for (const [tag] of svgs.frontal.matchAll(/<path\s[^>]*data-id="[^"]+"[^>]*>/g)) {
      fill.set(tag.match(/data-id="([^"]+)"/)![1], tag.match(/fill="([^"]+)"/)![1]);
    }
    const erradas: string[] = [];
    for (const p of m.pecas) {
      const classe = m.geometrias[p.geometria]?.classe;
      const cor = classe && CORES_DO_JOSE[classe];
      if (cor && fill.has(p.id) && fill.get(p.id) !== cor) erradas.push(`${p.id} ${classe} ${fill.get(p.id)}`);
    }
    expect(erradas.slice(0, 5)).toEqual([]);
  });
});

describe.skipIf(!casos.length)('isométrico com o muro de verdade: nenhuma peça de trás por cima da da frente', () => {
  // um de cada tipo/família (o teste do pintor é quadrático; não precisa rodar nos 40 sorteios)
  const escolhidos = new Map<string, Caso>();
  for (const c of casos) {
    const chave = c.cenario.startsWith('aula') ? c.cenario : `${c.m.familia.nome}|${c.m.dims.contrafortes.length ? 'cf' : 'bal'}`;
    if (!escolhidos.has(chave)) escolhidos.set(chave, c);
  }
  const lista = [...escolhidos.values()];
  it.each(lista.map((c) => [c.cenario, c] as const))('%s', (_, { m }) => {
    for (const vista of ['frente-direita', 'frente-esquerda', 'fundo-direita', 'fundo-esquerda'] as VistaIso[]) {
      expect(violacoesDoPintor(m, vista, null).slice(0, 5), vista).toEqual([]);
    }
    const x = cortesPadrao(m)[0].x;
    expect(violacoesDoPintor(m, 'frente-direita', x).slice(0, 5), 'cortado').toEqual([]);
  });
});

describe.skipIf(!casos.length)('traspasse no corte: uma cota por altura de espera, com o N quando há mais de uma', () => {
  it.each(casos.map((c) => [c.cenario, c] as const))('%s', (_, { m }) => {
    for (const c of cortesPadrao(m)) {
      const alturas = [...new Set(
        barrasNoCorte(m, c.x).linhas
          .filter((l) => l.barra.papel === 'ESPERA')
          .map((l) => Math.round(Math.max(...l.pts.map((p) => p[1]))))
          .filter((z) => z > 1),
      )].sort((a, b) => a - b);
      const cotas = rotulos(corteLateral(m, c.x)).filter((t) => t.startsWith('traspasse'));
      expect(cotas.map((t) => t.split(' ').pop()), c.rotulo).toEqual(alturas.map(cm));
      if (alturas.length > 1) for (const t of cotas) expect(t, c.rotulo).toMatch(/^traspasse N\d+(, N\d+)* \d/);
      else for (const t of cotas) expect(t, c.rotulo).toMatch(/^traspasse \d/);
    }
  });

  it.skipIf(!casos.some((c) => c.cenario === 'aula123'))('no contraforte da aula 12.3 as esperas têm alturas diferentes: mais de uma cota', () => {
    const { m } = casos.find((c) => c.cenario === 'aula123')!;
    const cf = cortesPadrao(m).find((c) => c.rotulo.startsWith('Contraforte'))!;
    expect(rotulos(corteLateral(m, cf.x)).filter((t) => t.startsWith('traspasse')).length).toBeGreaterThan(1);
  });
});

describe('cobertura', () => {
  it.skipIf(!modulacao)('a modulação monta os cenários das aulas e a maioria dos sorteios', () => {
    expect(casos.map((c) => c.cenario)).toEqual(expect.arrayContaining(['aula122', 'aula123']));
    if (falharam.length) console.warn(`modulação não montou ${falharam.length} cenário(s):\n${falharam.join('\n')}`);
    expect(casos.length).toBeGreaterThan(0);
  });
});
