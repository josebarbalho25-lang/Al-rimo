/*
  AS CORES DO JOSE NA PRANCHA — o que quebraria o código de cores na obra:
  - bloco pintado com a cor de outro tipo (o pedreiro assenta um inteiro onde ia o meio);
  - legenda com tipo que não está no muro, ou faltando o que está;
  - graute ou sombra tingindo a cor do bloco (o amarelo da canaleta virando oliva, o cinza virando azul);
  - barra vermelha sumindo em cima do bloco 54 vermelho.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import { CORES_DO_JOSE } from '@/modulacao/catalogo';
import { isometrico, planta, vistaFrontal } from '../index';
import { colunasDoGraute } from '../vistaFrontal';
import { corDaSombraDoGraute, MATERIAIS_DE_FABRICA } from '../graficos';
import { ALVENARIA, secao, solidosDoModelo } from '../geometria';
import { COR } from '../prancha';
import { modeloDeExemplo } from './modeloDeExemplo';
import { rotulos } from './lerSvg';

const NOMES_DA_LEGENDA = ['Inteiro', 'Meio bloco', 'Canaleta', 'Bloco 34', 'Bloco 54', 'Bloco 44', 'Peça especial'];

/** Preenchimentos de cada peça (data-id → fills), de todos os traços dela. */
function fills(svg: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [tag] of svg.matchAll(/<(?:path|rect|polygon|polyline)\s[^>]*>/g)) {
    const id = tag.match(/data-id="([^"]+)"/)?.[1];
    const f = tag.match(/fill="([^"]+)"/)?.[1];
    if (!id || !f) continue;
    out.set(id, [...(out.get(id) ?? []), f]);
  }
  return out;
}

const corPeloTipo = (tp: string): string | undefined =>
  tp === 'BLOCO' ? CORES_DO_JOSE.inteiro : tp === 'MEIO_BLOCO' ? CORES_DO_JOSE.meio : tp.includes('CANALETA') ? CORES_DO_JOSE.canaleta : undefined;

const rgb = (hex: string) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));

/** O mesmo modelo com a classe trocada na geometria de uma peça (como a modulação grava o 54). */
function comClasse(m: Modelo, tipo: string, classe: 'bloco54' | 'bloco34'): { m: Modelo; ids: string[] } {
  const alvo = m.pecas.find((p) => p.tipo === tipo && p.grupo === 'muro')!;
  const geometrias = { ...m.geometrias, [alvo.geometria]: { ...m.geometrias[alvo.geometria], classe } };
  return { m: { ...m, geometrias }, ids: m.pecas.filter((p) => p.geometria === alvo.geometria).map((p) => p.id) };
}

describe('cores do Jose', () => {
  const cf = modeloDeExemplo({ tipo: 'contrafortes' });
  const bal = modeloDeExemplo({ tipo: 'balanco', H_solo: 1500, juntaNaCelula: 13, terreno: true });

  it('vista frontal: cada peça da face na cor do tipo (sem classe gravada, vale o tipo da peça)', () => {
    const f = fills(vistaFrontal(cf));
    const t = cf.familia.t;
    let conferidas = 0;
    for (const s of solidosDoModelo(cf)) {
      const cor = corPeloTipo(s.peca.tipo);
      if (!ALVENARIA.has(s.peca.tipo) || !cor || s.min[1] >= t - 1) continue;
      expect(f.get(s.peca.id), s.peca.id).toEqual([cor]);
      conferidas++;
    }
    expect(conferidas).toBeGreaterThan(50);
  });

  it('a classe gravada na geometria manda: o 54 sai vermelho e entra na legenda', () => {
    const { m, ids } = comClasse(cf, 'BLOCO', 'bloco54');
    const svg = vistaFrontal(m);
    const f = fills(svg);
    // a mesma geometria também está na haste do contraforte, atrás do muro (não aparece na elevação)
    const naFace = ids.filter((id) => f.has(id));
    expect(naFace.length).toBeGreaterThan(10);
    for (const id of naFace) expect(f.get(id), id).toEqual([CORES_DO_JOSE.bloco54]);
    expect(rotulos(svg)).toContain('Bloco 54');
    expect(rotulos(vistaFrontal(cf))).not.toContain('Bloco 54');
  });

  it('legenda: só os tipos desenhados naquela prancha, na ordem do Revit', () => {
    const naLegenda = (svg: string) => rotulos(svg).filter((r) => NOMES_DA_LEGENDA.includes(r));
    const sol = solidosDoModelo(bal);
    const tem = (tp: string[]) => sol.some((s) => tp.includes(s.peca.tipo) && s.min[1] < bal.familia.t - 1);
    const esperado = [
      tem(['BLOCO']) && 'Inteiro',
      tem(['MEIO_BLOCO']) && 'Meio bloco',
      tem(['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']) && 'Canaleta',
    ].filter(Boolean);
    expect(naLegenda(vistaFrontal(bal))).toEqual(esperado);
    // planta: a 1ª fiada não tem canaleta; a legenda dela também não
    const cortaCanaleta = sol.some((s) => s.peca.tipo.includes('CANALETA') && secao(s, 'Z', 105).length);
    expect(naLegenda(planta(bal, 0)).includes('Canaleta')).toBe(cortaCanaleta);
    expect(naLegenda(isometrico(bal)).length).toBeGreaterThan(0);
  });

  it('o graute na elevação é uma SOMBRA VERTICAL por coluna (Jose, 16/10: "somente uma sombra vertical"): cinza transparente, sem o riscado', () => {
    const svg = vistaFrontal(cf);
    const camada = svg.match(/<g data-camada="graute">(.*?)<\/g>/)![1];
    const faixas = [...camada.matchAll(/<rect [^>]*>/g)].map((x) => x[0]);
    expect(faixas.length).toBeGreaterThan(0);
    for (const r of faixas) {
      // o graute de fábrica não tem cor: a sombra é o cinza escuro (o claro sumia no inteiro)
      expect(MATERIAIS_DE_FABRICA.graute.cor).toBeNull();
      expect(r).toContain(`fill="${corDaSombraDoGraute()}"`);
      expect(r).toMatch(/opacity="0\.35"/);
    }
    // uma faixa por coluna (os pedaços das fiadas emendados), e nada de riscado
    expect(faixas.length).toBeLessThan(cf.pecas.filter((p) => p.tipo === 'GRAUTE_FURO').length);
    expect(camada).not.toContain('url(#des-graute)');
  });

  it('as colunas: os pedaços de mesmo meio se emendam numa faixa reta, da largura MÉDIA dos furos (a união passava do furo)', () => {
    const cs = colunasDoGraute([
      { x0: 100, x1: 220, z0: 0, z1: 200 },
      { x0: 105, x1: 225, z0: 200, z1: 400 },
      { x0: 100, x1: 220, z0: 600, z1: 800 },
      { x0: 500, x1: 620, z0: 0, z1: 200 },
    ]);
    expect(cs).toEqual([
      { x0: 100, x1: 220, z0: 600, z1: 800 },
      { x0: 102.5, x1: 222.5, z0: 0, z1: 400 },
      { x0: 500, x1: 620, z0: 0, z1: 200 },
    ]);
  });

  it('a barra da elevação vai SEM o filete branco por baixo (Jose, 16/10: "acabou só poluindo mais")', () => {
    const svg = vistaFrontal(cf);
    const linhas = [...svg.matchAll(/<polyline points="([^"]+)" ([^>]*)\/>/g)];
    const barras = linhas.filter((q) => q[2].includes('data-id=') && q[2].includes(`stroke="${COR.aco}"`));
    expect(barras.length).toBeGreaterThan(0);
    expect(linhas.some((q) => /stroke="#ffffff"/.test(q[2]) && q[2].includes('pointer-events="none"'))).toBe(false);
  });

  it('planta: o bloco cortado na fiada vai na cor do tipo, não na hachura do corte', () => {
    const f = fills(planta(cf, 0));
    const cortados = solidosDoModelo(cf).filter((s) => ALVENARIA.has(s.peca.tipo) && secao(s, 'Z', 105).length);
    expect(cortados.length).toBeGreaterThan(0);
    for (const s of cortados) expect(f.get(s.peca.id)?.[0], s.peca.id).toBe(corPeloTipo(s.peca.tipo));
  });

  it('isométrico: a sombra é branda — o amarelo da canaleta não vira oliva', () => {
    const f = fills(isometrico(cf));
    const can = cf.pecas.filter((p) => p.tipo === 'CANALETA').map((p) => p.id).filter((id) => f.has(id));
    expect(can.length).toBeGreaterThan(0);
    const verdadeira = rgb(CORES_DO_JOSE.canaleta!);
    for (const id of can) {
      for (const c of f.get(id)!) {
        rgb(c).forEach((v, k) => expect(v, `${id} ${c}`).toBeGreaterThanOrEqual(Math.floor(0.8 * verdadeira[k])));
      }
    }
  });
});
