/*
  BANCADA DE PAPEL (só roda com BANCADA=<pasta>): grava em HTML estático a tela da memória (tema claro e escuro) e
  o memorial impresso de alguns cenários, para fotografar com o Chrome sem subir servidor. Lição do Pró-Viga:
  "conferir trabalho de IMPRESSÃO lendo CSS não funciona" — tem de olhar a folha.
*/
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { Memoria } from './Memoria';
import { MemorialImpresso } from './MemorialImpresso';
import { CSS_IMPRESSAO } from './imprimir';
import { figuraDoCard } from './figuraDoCard';

const PASTA = process.env.BANCADA;
const arquivo = (rel: string) => fileURLToPath(new URL(rel, import.meta.url)).replace(/\\/g, '/');
const KATEX = arquivo('../../node_modules/katex/dist/katex.min.css');
const CSS_TELA = readFileSync(arquivo('./memoria.css'), 'utf8');
const TOKENS = arquivo('../estilo/tokens.css');
const PUBLICO = arquivo('../../public/');
// a página estática abre por file://: a figura do acervo vem do disco, não do servidor
const urlDaFigura = (fig: string) => {
  const f = figuraDoCard(fig);
  return f ? `file:///${PUBLICO}${f.url.replace(/^\//, '')}` : null;
};

const pagina = (corpo: string, css: string, tema = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="file:///${KATEX}"><link rel="stylesheet" href="file:///${TOKENS}"><style>${css}</style></head>
<body ${tema ? `data-theme="${tema}"` : ''} style="margin:0;background:var(--bg,#fff)">${corpo}</body></html>`;

describe.skipIf(!PASTA)('bancada de papel', () => {
  it('grava tela e memorial', () => {
    mkdirSync(PASTA!, { recursive: true });
    for (const c of ['aula122', 'sorteio06', 'sorteio00']) {
      const r = resultadoDoGabarito(c);
      const tela = renderToStaticMarkup(<Memoria resultado={r} urlDaFigura={urlDaFigura} />);
      writeFileSync(`${PASTA}/tela_${c}.html`, pagina(`<div style="height:1600px">${tela}</div>`, CSS_TELA), 'utf8');
      writeFileSync(`${PASTA}/tela_escuro_${c}.html`, pagina(`<div style="height:1600px">${tela}</div>`, CSS_TELA, 'dark'), 'utf8');
      const papel = renderToStaticMarkup(
        <MemorialImpresso
          resultado={r}
          urlDaFigura={urlDaFigura}
          info={{ projeto: 'Muro da divisa — bancada', responsavel: 'Eng. Teste', crea: '000000/D', data: '08/10/2026' }}
        />,
      );
      writeFileSync(`${PASTA}/papel_${c}.html`, pagina(`<div class="mp-raiz">${papel}</div>`, CSS_IMPRESSAO), 'utf8');
    }
  });
});
