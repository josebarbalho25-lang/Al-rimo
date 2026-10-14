/*
  PDF DAS PRANCHAS — pelo diálogo de impressão do navegador ("Salvar como PDF"), como o memorial. Cada folha numa
  página do tamanho DELA (A1 deitada, A3 em pé… no mesmo PDF): página nomeada (`@page fN { size: … }` + `page: fN`),
  que o Chrome respeita desde a versão 85. O desenho vai em vetor (o SVG da folha), e o PDF sai com linha nítida em
  qualquer zoom. No programa instalado (Electron, como o Pró-Viga) isto vira printToPDF direto em arquivo.

  Mesmo cuidado do memorial: a folha é filha direta do body e o resto do app some no papel; o esquema de cor é
  forçado para claro (no tema escuro o Chrome pintava a margem de preto).
*/
import type { FolhaComposta } from './folha';

const CLASSE = 'pr-impressao';
let anterior: (() => void) | null = null;

/** O CSS da impressão: uma página nomeada por folha, sem margem (a moldura da norma já está no desenho). */
export function cssDaImpressao(folhas: readonly Pick<FolhaComposta, 'largura' | 'altura'>[]): string {
  const paginas = folhas
    .map((f, i) => `@page f${i} { size: ${f.largura}mm ${f.altura}mm; margin: 0; }\n.${CLASSE} .f${i} { page: f${i}; width: ${f.largura}mm; height: ${f.altura}mm; }`)
    .join('\n');
  return `
.${CLASSE} { position: absolute; left: -40000px; top: 0; }
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; color-scheme: light !important; }
  body > *:not(.${CLASSE}) { display: none !important; }
  .${CLASSE} { position: static !important; left: auto !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .${CLASSE} .folha { overflow: hidden; break-after: page; }
  .${CLASSE} .folha:last-child { break-after: auto; }
  .${CLASSE} .folha > svg { display: block; width: 100%; height: 100%; }
}
${paginas}`;
}

/** Espera as imagens da folha (a foto do 3D, a logo) carregarem antes de abrir o diálogo — senão saem em branco. */
async function esperarImagens(host: HTMLElement): Promise<void> {
  const imgs = [...host.querySelectorAll('image')];
  const pendentes = imgs.map((im) => {
    const href = im.getAttribute('href') ?? '';
    if (!href) return Promise.resolve();
    return new Promise<void>((ok) => {
      const i = new Image();
      i.onload = () => ok();
      i.onerror = () => ok();
      i.src = href;
    });
  });
  await Promise.race([Promise.all(pendentes), new Promise<void>((ok) => setTimeout(ok, 5000))]);
}

/** Abre o diálogo de impressão com todas as folhas (impressora ou "Salvar como PDF"). */
export async function imprimirPranchas(folhas: readonly FolhaComposta[]): Promise<void> {
  if (!folhas.length) return;
  anterior?.();
  const estilo = document.createElement('style');
  estilo.textContent = cssDaImpressao(folhas);
  document.head.appendChild(estilo);
  const host = document.createElement('div');
  host.className = CLASSE;
  host.innerHTML = folhas.map((f, i) => `<div class="folha f${i}">${f.svg}</div>`).join('');
  document.body.appendChild(host);
  let feito = false;
  const desmontar = () => {
    if (feito) return;
    feito = true;
    host.remove();
    estilo.remove();
    if (anterior === desmontar) anterior = null;
  };
  anterior = desmontar;
  await esperarImagens(host);
  // desmonta no afterprint, nunca por relógio (onde o print() não segura a página, desmontar cedo sai em branco)
  window.addEventListener('afterprint', desmontar, { once: true });
  window.print();
}
