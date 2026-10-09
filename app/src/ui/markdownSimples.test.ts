// O Markdown do termo vira árvore de dados: título, citação, régua, parágrafo,
// alínea recuada e lista numerada — e o termo de verdade passa inteiro.
import { describe, expect, it } from 'vitest';
import { blocosDoMarkdown, trechosDaLinha, type Bloco } from './markdownSimples';
import { TEXTO_DO_TERMO } from '@/estado/termo';

describe('trechos da linha', () => {
  it('negrito, itálico e texto', () => {
    expect(trechosDaLinha('1.1. **LICENCIANTE:** a *empresa* X')).toEqual([
      { texto: '1.1. ' },
      { texto: 'LICENCIANTE:', negrito: true },
      { texto: ' a ' },
      { texto: 'empresa', italico: true },
      { texto: ' X' },
    ]);
  });
  it('asterisco sem par fica como está', () => {
    expect(trechosDaLinha('a * b')).toEqual([{ texto: 'a * b' }]);
  });
});

describe('blocos', () => {
  it('o cabeçalho do termo: títulos, linhas separadas e a citação', () => {
    const b = blocosDoMarkdown(
      '# TERMO\n## AL-RIMO\n\n**Versão:** 1.0\n**Data:** out\n\n---\n\n> ### Leia\n> Texto **forte**.\n>\n> Outro.',
    );
    expect(b.map((x) => x.tipo)).toEqual(['titulo', 'titulo', 'paragrafo', 'regua', 'citacao']);
    const p = b[2] as Extract<Bloco, { tipo: 'paragrafo' }>;
    expect(p.linhas).toHaveLength(2); // não vira uma frase só
    const q = b[4] as Extract<Bloco, { tipo: 'citacao' }>;
    expect(q.blocos.map((x) => x.tipo)).toEqual(['titulo', 'paragrafo', 'paragrafo']);
  });

  it('alínea recuada e lista numerada; "1.1." não é lista', () => {
    const b = blocosDoMarkdown('1.1. Cláusula.\n\n   a) copiar;\n\n1. leu;\n2. sabe.');
    expect(b[0]).toMatchObject({ tipo: 'paragrafo', recuado: false });
    expect(b[1]).toMatchObject({ tipo: 'paragrafo', recuado: true });
    expect(b[2]).toMatchObject({ tipo: 'lista', inicio: 1 });
    expect((b[2] as Extract<Bloco, { tipo: 'lista' }>).itens).toHaveLength(2);
  });

  it('o termo de verdade: as 15 cláusulas e a declaração com os 6 itens', () => {
    const b = blocosDoMarkdown(TEXTO_DO_TERMO);
    const titulos = b.filter((x): x is Extract<Bloco, { tipo: 'titulo' }> => x.tipo === 'titulo');
    const clausulas = titulos.filter((x) => /^\d+\.\s/.test(x.trechos.map((t) => t.texto).join('')));
    expect(clausulas).toHaveLength(15);
    const listas = b.filter((x) => x.tipo === 'lista');
    expect(listas).toHaveLength(1);
    expect((listas[0] as Extract<Bloco, { tipo: 'lista' }>).itens).toHaveLength(6);
    // nenhum ** sobrando: todo negrito do termo fechou
    const texto = JSON.stringify(b);
    expect(texto).not.toContain('**');
  });
});
