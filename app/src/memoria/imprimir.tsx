/*
  IMPRESSÃO E WORD — os dois destinos saem da MESMA árvore (MemorialImpresso), montada num nó filho direto do body.

  Impressão: window.print() com @page A4 e o resto do app escondido. "Salvar como PDF" é o próprio diálogo do
  navegador (no Pró-Viga era printToPDF do Electron).
*/
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Resultado } from '@/motor/tipos';
import { MemorialImpresso, type InfoDoMemorial } from './MemorialImpresso';
import { LARG_LAYOUT, baixarDoc, nomeDoArquivo, traduzirParaWord } from './word';

export interface OpcoesDoMemorial {
  info?: InfoDoMemorial;
  urlDaFigura?: (figura: string) => string | null;
}

/*
  Folha de impressão. O memorial é FILHO DIRETO DO BODY e imprime no fluxo (no Pró-Viga, `position:absolute` por cima
  de um body invisível ignorava a paginação). O app é tela cheia (height:100%, overflow:hidden) — no papel isso corta
  o documento na primeira folha, então a página volta a ser página.
*/
export const CSS_IMPRESSAO = `
.mp-raiz { position: absolute; left: -20000px; top: 0; width: ${LARG_LAYOUT}px; background: #fff; }
/* linha longa que quebra: sem esta folga a fração de uma linha encosta na de baixo (medido na bancada) */
.mp-raiz .mem-linha .katex .base { margin: 0.2em 0; }
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  /* o tema escuro do app declara color-scheme: dark, e o Chrome pinta a MARGEM da folha com a cor de fundo do
     esquema — o PDF saía com moldura preta (medido na bancada). No papel o esquema é sempre claro. */
  html, body { color-scheme: light !important; }
  body > *:not(.mp-raiz) { display: none !important; }
  .mp-raiz { position: static !important; left: auto !important; width: auto !important;
             -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 13mm 10mm; }
  /* a fórmula anda no corpo do texto, não 21 % acima dele (o KaTeX desenha em 1,21em) */
  .mp-raiz .katex { font-size: 1em !important; }
  .mp-raiz thead { display: table-header-group; }
  .mp-raiz tr, .mp-raiz .mem-linha { break-inside: avoid; }
  .mp-raiz .mp-titulo, .mp-raiz .mem-cab, .mp-raiz .mem-secao-titulo { break-after: avoid; }
  .mp-raiz .mp-rosto, .mp-raiz .mp-indice, .mp-raiz .mp-glossario { break-inside: avoid-page; }
  /* a legenda "Fig. 7 — ..." ficava no pé de uma folha e o desenho na seguinte (medido na bancada) */
  .mp-raiz .mem-fig { break-inside: avoid; }
  /* figuras iguais pela ALTURA; o SVG de dentro da fórmula (raiz, chave) não se toca */
  .mp-raiz .mem-fig img, .mp-raiz .mem-fig svg { max-height: 42mm !important; width: auto !important; max-width: 100% !important; }
}`;

/*
  AS FONTES DA FÓRMULA, CARREGADAS À FORÇA. Sintoma medido duas vezes no Pró-Viga: "as letras gregas sumiram" — o
  papel saía com o traço da fração e nenhum caractere dentro. O CSS do KaTeX usa font-display: block (glifo
  invisível até a fonte chegar) e só pede a fonte quando a primeira fórmula entra em layout; document.fonts.ready
  promete "nada pendente AGORA", antes disso. Então cada família é pedida na mão, e só então se imprime.
*/
const FAMILIAS_KATEX = ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4',
  'KaTeX_AMS', 'KaTeX_Caligraphic', 'KaTeX_Fraktur', 'KaTeX_SansSerif', 'KaTeX_Script', 'KaTeX_Typewriter'];

export async function carregarFontesDoKatex(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const pedidos: Promise<unknown>[] = [];
  for (const f of FAMILIAS_KATEX) {
    for (const peso of ['400 12px ', '700 12px ', 'italic 400 12px ']) {
      pedidos.push(document.fonts.load(`${peso}"${f}"`).catch(() => undefined));
    }
  }
  const teto = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
  // fonte que nunca responde (rede caída) não pode travar o botão para sempre
  await Promise.race([Promise.all(pedidos), teto(5000)]);
  await Promise.race([document.fonts.ready, teto(5000)]);
  // folga de um quadro de layout depois das fontes. O relógio de reserva é obrigatório: aba escondida (e o Chrome
  // sem tela da bancada) não desenha quadro, e o requestAnimationFrame sozinho nunca voltava (medido).
  await new Promise<void>((ok) => {
    let feito = false;
    const segue = () => {
      if (feito) return;
      feito = true;
      setTimeout(ok, 80);
    };
    requestAnimationFrame(segue);
    setTimeout(segue, 250);
  });
}

/*
  As figuras dos cards são <img> de arquivo: o navegador as busca depois de montar. Imprimir antes de chegarem
  sai com o quadro vazio — e o Word rasteriza o que estiver desenhado naquele instante. Teto de 5 s: figura que não
  chega não segura o botão.
*/
export async function esperarImagens(raiz: ParentNode): Promise<void> {
  const imgs = Array.from(raiz.querySelectorAll('img'));
  const pendentes = imgs.map((img) =>
    img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => undefined),
  );
  await Promise.race([Promise.all(pendentes), new Promise<void>((ok) => setTimeout(ok, 5000))]);
}

// Só um memorial montado por vez: se um afterprint nunca chegou, o próximo pedido limpa o anterior antes.
let anterior: (() => void) | null = null;

/** Monta o memorial num nó filho do body; devolve o nó e como desmontar. */
function montar(resultado: Resultado, o: OpcoesDoMemorial) {
  anterior?.();
  const estilo = document.createElement('style');
  estilo.textContent = CSS_IMPRESSAO;
  document.head.appendChild(estilo);
  const host = document.createElement('div');
  host.className = 'mp-raiz';
  document.body.appendChild(host);
  const raiz = createRoot(host);
  flushSync(() => raiz.render(<MemorialImpresso resultado={resultado} info={o.info} urlDaFigura={o.urlDaFigura} />));
  let feito = false;
  const desmontar = () => {
    if (feito) return;
    feito = true;
    raiz.unmount();
    host.remove();
    estilo.remove();
    if (anterior === desmontar) anterior = null;
  };
  anterior = desmontar;
  return { host, desmontar };
}

/** Imprime o memorial (impressora ou "Salvar como PDF" do navegador). */
export async function imprimirMemorial(resultado: Resultado, opcoes: OpcoesDoMemorial = {}): Promise<void> {
  const { host, desmontar } = montar(resultado, opcoes);
  try {
    await Promise.all([carregarFontesDoKatex(), esperarImagens(host)]);
  } catch {
    // sem a API de fontes, imprime assim mesmo
  }
  // Desmonta no afterprint, nunca por relógio: onde o print() não segura a página (Safari), desmontar cedo
  // imprimiria a folha em branco.
  window.addEventListener('afterprint', desmontar, { once: true });
  window.print();
}

/** Baixa o memorial como .doc editável (equações do Word). */
export async function exportarWord(resultado: Resultado, opcoes: OpcoesDoMemorial = {}): Promise<void> {
  const { host, desmontar } = montar(resultado, opcoes);
  try {
    await Promise.all([carregarFontesDoKatex(), esperarImagens(host)]);
    const projeto = opcoes.info?.projeto;
    const html = await traduzirParaWord(host, { titulo: `${projeto || 'Muro de arrimo'} — memorial de cálculo` });
    baixarDoc(html, nomeDoArquivo(projeto));
  } finally {
    desmontar();
  }
}
