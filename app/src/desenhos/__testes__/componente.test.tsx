/*
  O COMPONENTE, SEM NAVEGADOR — renderToString monta a árvore inteira (os efeitos não rodam: zoom e arrasto
  ficam para a integração visual). Confere o que quebraria a aba: o desenho entrar na folha, as abas
  internas sumirem quando o palco já tem as dele, e nenhum texto de tutorial na barra.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Desenhos } from '../Desenhos';
import { modeloDeExemplo } from './modeloDeExemplo';

const m = modeloDeExemplo({ tipo: 'contrafortes' });

describe('Desenhos (componente)', () => {
  it('sozinho: quatro abas e a vista frontal na folha', () => {
    const html = renderToString(<Desenhos modelo={m} />);
    for (const nome of ['Vista frontal', 'Corte', 'Planta', 'Isométrico']) expect(html).toContain(`>${nome}</button>`);
    expect(html).toContain('class="prancheta prancheta-cores"');
    expect(html).toContain('data-camada="alvenaria"');
  });

  it('tema escuro: a folha dos desenhos não inverte (as cores do Jose são código de obra)', () => {
    // sem esta regra a folha herda o invert + hue-rotate das figuras: canaleta oliva, meio bloco azul-claro
    const css = readFileSync(new URL('../../estilo/componentes.css', import.meta.url), 'utf8');
    expect(css).toMatch(/body\[data-theme='dark'\] \.prancheta\.prancheta-cores \{\s*filter: none;\s*\}/);
  });

  it('no palco (vista fixa): sem abas internas, com os controles daquela prancha', () => {
    const corte = renderToString(<Desenhos modelo={m} vista="corte" />);
    expect(corte).not.toContain('role="tablist"');
    expect(corte).toContain('Posição');
    expect(corte).toContain('Contraforte C2');
    expect(corte).toContain('data-camada="secao"');
    const iso = renderToString(<Desenhos modelo={m} vista="iso" />);
    expect(iso).toContain('Frente, pela direita');
    expect(iso).toContain('data-camada="pecas"');
    expect(renderToString(<Desenhos modelo={m} vista="planta" />)).toContain('1ª');
  });

  it('a peça escolhida acende (regra presa a esta folha)', () => {
    const id = m.pecas[0].id;
    const html = renderToString(<Desenhos modelo={m} vista="frontal" selecionado={id} />);
    expect(html).toContain(`[data-frente="desenhos"] [data-id="${id}"]`);
  });

  it('a barra só tem rótulo, valor e controle', () => {
    const html = renderToString(<Desenhos modelo={m} vista="corte" />);
    const barra = html.slice(0, html.indexOf('class="prancheta'));
    const textos = [...barra.matchAll(/>([^<>]+)</g)].map((q) => q[1].trim()).filter(Boolean);
    for (const t of textos) expect(t.split(/\s+/).length, t).toBeLessThanOrEqual(3);
  });
});
