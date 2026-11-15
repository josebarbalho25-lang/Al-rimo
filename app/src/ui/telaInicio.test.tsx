/*
  O Início no padrão do Pró-Viga (15/11): a tela desenhada em texto (react-dom/server, sem jsdom) com dois recentes,
  e a régua dos temas — toda cor que o Início, o cabeçalho e a barra de estado pedem (var(--…)) existe no Claro, no
  Escuro e no Papel (ou é das que não mudam com o tema). Token que falta num tema só aparece nele, e calado: o botão
  primário sem fundo no Papel, por exemplo.
*/
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useRecentes } from '@/estado/recentes';
import { Recentes, TelaInicio } from './TelaInicio';

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Os blocos de tokens.css: o que não é tema (o 1º :root) e os três temas. */
function blocos(): { fixo: Set<string>; temas: Record<string, Set<string>> } {
  const css = ler('../estilo/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const nomes = (corpo: string) => new Set([...corpo.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const corpo = (seletor: RegExp) => {
    const m = seletor.exec(css);
    if (!m) throw new Error(`sem o bloco ${seletor}`);
    const i = css.indexOf('{', m.index) + 1;
    return css.slice(i, css.indexOf('\n}', i));
  };
  return {
    fixo: nomes(corpo(/^:root\s*\{/m)),
    temas: {
      Escuro: nomes(corpo(/^:root,\s*body\[data-theme='dark'\]\s*\{/m)),
      Claro: nomes(corpo(/^body\[data-theme='modern'\]\s*\{/m)),
      Papel: nomes(corpo(/^body\[data-theme='paper'\]\s*\{/m)),
    },
  };
}

/** Os var(--x) de um texto. */
const usados = (t: string) => new Set([...t.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));

/** O trecho do CSS entre o título da seção e o próximo título de seção (os "/* ── …" na coluna 0). */
function trecho(css: string, titulo: string): string {
  const i = css.indexOf(titulo);
  if (i < 0) throw new Error(`sem o trecho ${titulo}`);
  const j = css.indexOf('\n/* ──', i + titulo.length);
  return css.slice(i, j < 0 ? undefined : j);
}

describe('o Início do Pró-Viga', () => {
  it('desenha a coluna do arquivo, o Exportar e os Recentes em cartões, o mais novo primeiro', () => {
    const lista = [
      { chave: 'C:\\obra\\Muro B.alrimo', nome: 'Muro B.alrimo', resumo: 'Contrafortes · bloco 14×39 · h 2,60 m', quando: 2, miniatura: 'data:image/png;base64,AAAA' },
      { chave: 'C:\\obra\\Muro A.alrimo', nome: 'Muro A.alrimo', resumo: 'Balanço · bloco 19×39 · h 1,60 m', quando: 1, miniatura: null },
    ];
    // o desenho no servidor lê o estado INICIAL do store: a área dos Recentes vai com a lista na mão
    const html = renderToStaticMarkup(<TelaInicio />) + renderToStaticMarkup(<Recentes lista={lista} />);
    for (const t of ['Al-rimo', 'NBR 16868-1:2020', 'Novo muro…', 'Abrir…', 'Exemplo', 'Salvar', 'Salvar como…', 'Exportar', 'IFC', 'DXF', 'Memorial', 'Pranchas em PDF', 'Quantitativo', 'Recentes', '2 arquivos']) {
      expect(html, t).toContain(t);
    }
    expect(html.indexOf('Muro B.alrimo')).toBeLessThan(html.indexOf('Muro A.alrimo'));
    expect(html).toContain('Contrafortes · bloco 14×39 · h 2,60 m');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect((html.match(/class="inicio-cartao"/g) ?? []).length).toBe(2);
  });

  it('sem onde guardar (navegador sem a janela de arquivo), a área dos Recentes nem aparece', () => {
    // o estado de fábrica (o desenho no servidor lê o inicial): disponível só depois de achar onde guardar
    expect(useRecentes.getState().disponivel).toBe(false);
    const html = renderToStaticMarkup(<TelaInicio />);
    expect(html).not.toContain('Recentes');
    expect(html).toContain('Novo muro…');
  });

  it('toda cor do Início, do cabeçalho e da barra de estado existe nos três temas', () => {
    const { fixo, temas } = blocos();
    const componentes = ler('../estilo/componentes.css');
    const layout = ler('../estilo/layout.css');
    const pedidos = new Set([
      ...usados(trecho(componentes, '/* ── O INÍCIO (15/11')),
      ...usados(trecho(layout, '/* ── A SEÇÃO E O CABEÇALHO')),
      ...usados(trecho(layout, '/* ── BARRA DE ESTADO')),
      ...usados(ler('./TelaInicio.tsx')),
    ]);
    expect(pedidos.size).toBeGreaterThan(20);
    const faltam: string[] = [];
    for (const v of pedidos) {
      if (fixo.has(v)) continue;
      // as fontes moram no bloco do escuro, que é também o :root — valem para os três; cor ali, não (o Claro herdaria o escuro)
      if (v.startsWith('--font-') && temas.Escuro.has(v)) continue;
      for (const [tema, nomes] of Object.entries(temas)) if (!nomes.has(v)) faltam.push(`${v} no ${tema}`);
    }
    expect(faltam).toEqual([]);
  });
});
