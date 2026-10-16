/*
  A JANELA DE GRÁFICOS (ui/JanelaDeGraficos.tsx, a do A-PORT) montada sem navegador (renderToString: sem efeitos) — o
  que quebraria: a janela de um alvo não abrir; a tabela sem as colunas do A-PORT; a vista mostrando categoria que
  ela não desenha (a terra na planta); o 3D com a aba de anotações (o 3D não tem anotação) ou sem as bitolas; a geral
  sem as bitolas.
*/
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { JanelaDoAlvo } from './JanelaDeGraficos';

describe('janela de gráficos', () => {
  it('a sobreposição de uma vista: o título com o nome dela, a tabela do A-PORT, as categorias que ela desenha', () => {
    const corte = renderToString(<JanelaDoAlvo alvo={{ tipo: 'vista', id: 'corte', tipoDaVista: 'corte' }} />);
    expect(corte).toContain('Visibilidade/Gráficos · Corte');
    for (const t of ['Categorias de modelo', 'Categorias de anotação', 'Projeção/Superfície', 'Transparência', 'Meio-tom', 'Visibilidade', 'Terreno', 'Bloco inteiro']) {
      expect(corte, t).toContain(t);
    }
    expect(corte).not.toContain('>Bitolas<');
    expect(renderToString(<JanelaDoAlvo alvo={{ tipo: 'vista', id: 'planta', tipoDaVista: 'planta' }} />)).not.toContain('Terreno');
  });

  it('a aba de anotações da vista: as anotações que ela tem', () => {
    const f = renderToString(<JanelaDoAlvo alvo={{ tipo: 'vista', id: 'vista-frontal', tipoDaVista: 'frontal' }} abaInicial="anotacao" />);
    for (const r of ['Cotas', 'Textos', 'Chamadas e etiquetas das barras', 'Eixos e juntas', 'Número das fiadas', 'Legenda']) expect(f, r).toContain(r);
    // a sombra das armaduras só existe na armação
    expect(f).not.toContain('Sombras das armaduras');
    const a = renderToString(<JanelaDoAlvo alvo={{ tipo: 'vista', id: 'armacao', tipoDaVista: 'armacao' }} abaInicial="anotacao" />);
    expect(a).toContain('Sombras das armaduras');
  });

  it('o 3D do visor: sem anotações, com as bitolas; a geral: as três abas, sem a coluna de visibilidade', () => {
    const v = renderToString(<JanelaDoAlvo alvo={{ tipo: 'visor' }} />);
    expect(v).toContain('Visibilidade/Gráficos · 3D');
    expect(v).not.toContain('Categorias de anotação');
    expect(v).toContain('>Bitolas<');
    const g = renderToString(<JanelaDoAlvo alvo={{ tipo: 'geral' }} />);
    expect(g).toContain('Gráficos gerais');
    for (const t of ['Categorias de modelo', 'Categorias de anotação', '>Bitolas<', 'Restaurar padrão']) expect(g, t).toContain(t);
    expect(g).not.toContain('>Visibilidade<');
    const bit = renderToString(<JanelaDoAlvo alvo={{ tipo: 'geral' }} abaInicial="bitolas" />);
    expect(bit).toContain('Ø10');
  });
});
