/*
  Figuras das peÃ§as na tabela de blocos (pecas.ts + public/pecas/, gerado por figs/app/pecas/gerar.py).
*/
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import type { ClassePeca, Modelo } from '@/modelo/tipos';
import type { Resultado, Valor } from '@/motor/tipos';
import { CATALOGO, CORES_DO_JOSE } from '@/modulacao/catalogo';
import { arquivoDaPeca, csvDoQuantitativo, figuraDaPeca, FIGURAS_DAS_PECAS, quantificar, tabelasDoQuantitativo } from '@/quantitativo';
import { Quantitativo } from '@/quantitativo/Quantitativo';
import { modeloAMao } from './modeloDeTeste';

const PASTA = fileURLToPath(new URL('../../public/pecas/', import.meta.url));
const ler = (arq: string) => readFileSync(PASTA + arq, 'utf8');

/** O modelo Ã  mÃ£o com a classe que a modulaÃ§Ã£o pÃµe nas geometrias de alvenaria. */
function comClasse(): Modelo {
  const m = modeloAMao();
  const classe: Record<string, ClassePeca> = { 'bloco 19x19x39': 'inteiro', 'meio 19x19x19': 'meio', 'canaleta 19x19x39': 'canaleta' };
  for (const [k, c] of Object.entries(classe)) m.geometrias[k].classe = c;
  return m;
}

describe('arquivos das figuras (public/pecas)', () => {
  const lista = Object.entries(FIGURAS_DAS_PECAS).flatMap(([fam, ps]) => ps.map((p) => ({ fam, p, arq: `${fam === '14x39' ? 'b14' : 'b19'}_${p}.svg` })));

  it('cada peÃ§a da lista tem arquivo, e nÃ£o sobra arquivo fora da lista', () => {
    for (const { arq } of lista) expect(existsSync(PASTA + arq), arq).toBe(true);
    const nos = readdirSync(PASTA).filter((n) => n.endsWith('.svg')).sort();
    expect(nos).toEqual(lista.map((x) => x.arq).sort());
  });

  it.each(lista)('$arq: recorte do Ã­cone, cotas que somem no pequeno, ids com prefixo, cor do Jose', ({ fam, p, arq }) => {
    const svg = ler(arq);
    expect(svg).toMatch(/<view id="icone" viewBox="[-\d.]+ [-\d.]+ [\d.]+ [\d.]+"\/>/);
    expect(svg).toMatch(/@media \(max-height: \d+px\)/);
    expect(svg).toContain('data-fundo');
    expect(svg).not.toContain('fig00-');                   // prefixo da applib trocado pelo da peÃ§a
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
    // a face comprida vai na cor exata do Jose (tom 0); as outras sÃ£o tons dela
    const classe: ClassePeca = p === 'bloco34' ? 'bloco34' : p === 'bloco54' ? 'bloco54' : p.includes('canaleta') ? 'canaleta' : (p as ClassePeca);
    expect(svg.toLowerCase()).toContain(`fill="${CORES_DO_JOSE[classe]!.toLowerCase()}"`);
    // cotas: largura e altura do catÃ¡logo, em cm
    const f = CATALOGO[fam as '14x39' | '19x39'];
    expect(svg).toContain(`>${f.t / 10}</text>`);
    expect(svg).toContain('>19</text>');
  });
});

describe('peÃ§a â†’ figura', () => {
  it('pela classe + tipo + famÃ­lia', () => {
    expect(arquivoDaPeca('14x39', 'bloco34', 'BLOCO_JUNCAO')).toBe('b14_bloco34.svg');
    expect(arquivoDaPeca('14x39', 'bloco54', 'BLOCO_JUNCAO')).toBe('b14_bloco54.svg');
    expect(arquivoDaPeca('19x39', 'inteiro', 'BLOCO')).toBe('b19_inteiro.svg');
    expect(arquivoDaPeca('19x39', 'meio', 'MEIO_BLOCO')).toBe('b19_meio.svg');
    expect(arquivoDaPeca('19x39', 'canaleta', 'CANALETA')).toBe('b19_canaleta.svg');
    expect(arquivoDaPeca('19x39', 'canaleta', 'MEIA_CANALETA')).toBe('b19_meia_canaleta.svg');
    expect(arquivoDaPeca('14x39', 'canaleta', 'CANALETA_CORTADA')).toBe('b14_canaleta_cortada.svg');
  });

  it('sem figura nÃ£o quebra: famÃ­lia sem desenho, geometria sem classe, peÃ§a que nÃ£o existe na famÃ­lia', () => {
    expect(arquivoDaPeca('19x39', undefined, 'BLOCO')).toBeNull();
    expect(arquivoDaPeca('19x39', 'bloco54', 'BLOCO_JUNCAO')).toBeNull();
    expect(arquivoDaPeca('19x39', 'inteiro', 'BLOCO_CORTADO')).toBeNull();
  });

  it('tÃ­tulo do modal = nome de catÃ¡logo da linha; Ã­cone = recorte #icone do mesmo arquivo', () => {
    const f = figuraDaPeca('14x39', { classe: 'bloco34', tipo: 'BLOCO_JUNCAO', catalogo: 'bloco 14x19x34 (amarraÃ§Ã£o em L)' })!;
    expect(f.titulo).toBe('Bloco 14x19x34 (amarraÃ§Ã£o em L)');
    expect(f.url).toMatch(/pecas\/b14_bloco34\.svg$/);
    expect(f.icone).toBe(f.url + '#icone');
  });
});

describe('na tabela de blocos', () => {
  it('cada linha com a figura da peÃ§a; o CSV nÃ£o muda', () => {
    const sem = quantificar(modeloAMao());
    const com = quantificar(comClasse());
    const t = tabelasDoQuantitativo(com).find((x) => x.id === 'blocos')!;
    expect(t.figuras?.map((f) => f && f.url.replace(/^.*pecas\//, ''))).toEqual(['b19_inteiro.svg', 'b19_meio.svg', 'b19_canaleta.svg']);
    expect(csvDoQuantitativo(com)).toBe(csvDoQuantitativo(sem));
    expect(tabelasDoQuantitativo(sem).find((x) => x.id === 'blocos')!.figuras).toEqual([null, null, null]);
    // sÃ³ a tabela de blocos tem figura
    expect(tabelasDoQuantitativo(com).filter((x) => x.figuras).map((x) => x.id)).toEqual(['blocos']);
  });

  it('o painel pÃµe o Ã­cone (botÃ£o) Ã  esquerda do nome; sem classe, sem Ã­cone', () => {
    const html = renderToString(<Quantitativo modelo={comClasse()} />);
    expect(html).toMatch(/<button[^>]*class="qtd-peca"[^>]*title="Canaleta 19x19x39"[^>]*><img src="[^"]*pecas\/b19_canaleta\.svg#icone"/);
    expect(html.indexOf('b19_inteiro.svg#icone')).toBeLessThan(html.indexOf('Bloco inteiro'));
    expect(html).not.toContain('modal-fundo');               // o modal sÃ³ abre no clique
    expect(renderToString(<Quantitativo modelo={modeloAMao()} />)).not.toContain('qtd-peca');
  });
});

/* Com a modulaÃ§Ã£o de verdade: toda peÃ§a de alvenaria que ela fabrica nas famÃ­lias 39 tem figura. */
const modulacao = import.meta.glob<{
  gerarModelo: (r: Resultado, extras: Record<string, Valor>) => Modelo;
  padroesDoModelo: () => Record<string, Valor>;
}>('../modulacao/index.ts');

describe('com a modulaÃ§Ã£o de verdade', () => {
  const carregar = modulacao['../modulacao/index.ts'];

  it.skipIf(!carregar)('todos os cenÃ¡rios do gabarito: toda linha de bloco da famÃ­lia 39 tem figura', async (ctx) => {
    const { cenariosDoGabarito, resultadoDoGabarito } = await import('@/motor/resultadoDoGabarito');
    const { gerarModelo, padroesDoModelo } = await carregar!();
    const cenarios = cenariosDoGabarito();
    if (!cenarios.length) return ctx.skip('sem gabarito');
    let conferidas = 0;
    for (const c of cenarios) {
      let m: Modelo;
      try {
        m = gerarModelo(resultadoDoGabarito(c), padroesDoModelo());
      } catch {
        continue;                       // cenÃ¡rio que a modulaÃ§Ã£o ainda nÃ£o gera: Ã© teste da modulaÃ§Ã£o
      }
      if (!(m.familia.nome in FIGURAS_DAS_PECAS)) continue;
      const q = quantificar(m);
      for (const l of q.blocos) {
        expect(figuraDaPeca(m.familia.nome, l), `${c}: ${l.rotulo} ${l.catalogo}`).not.toBeNull();
        conferidas++;
      }
    }
    expect(conferidas).toBeGreaterThan(0);
  });
});
