/*
  O MEMORIAL EM WORD, EDITÁVEL — porte do memorial-word.js do Pró-Viga (26/ago).

  Régua do dono: "consegue fazer o memorial sair em Word? Aí eu formato do jeito que eu acredito ser o melhor".

  ESTE ARQUIVO NÃO REDESENHA NADA. É um TRADUTOR: pega a MESMA árvore que a impressão usa (MemorialImpresso) e a
  reescreve no dialeto de HTML que o Word abre. Um memorial próprio para o Word começaria igual e terminaria diferente.

  O que o Word aceita (medido no Pró-Viga abrindo .doc de bancada no Word 16 — não deduzido de documentação):
    ✓ fórmula do KaTeX → equação de verdade (o Word lê o MathML que o KaTeX publica e converte em OMML editável).
      Mexer nos atributos do <math> faz o Word descartá-lo em silêncio.
    ✓ tabela HTML → tabela do Word · ✓ <img> em data URI → imagem embutida
    ✗ SVG → descartado em silêncio: todo desenho é RASTERIZADO aqui (menos o SVG de dentro da fórmula)
    ✗ display:none, zoom, variável CSS → ignorados. Por isso o papel do Al-rimo já nasce inline, em pt e cor fixa
      (estilos.ts): não há o que reescrever.
  Diferença do porte: o Pró-Viga gravava pelo Electron; aqui é download (.doc com BOM — sem o BOM o Word abre em ANSI).
*/

const MM = 96 / 25.4;
/** Largura de LAYOUT da folha (A4 retrato, margens de 10 mm): é nela que a árvore é medida antes de virar Word. */
export const LARG_LAYOUT = Math.round((210 - 20) * MM);
const LARG_PAISAGEM = Math.round((297 - 20) * MM);
const ALT_PRANCHA = Math.round(120 * MM);
const ESCALA_PNG = 3;

// ── variáveis de cor do app, para dentro do SVG (imagem é documento à parte: var(--x) não chega lá) ──
function varsDoApp(): string {
  try {
    const cs = getComputedStyle(document.documentElement);
    const out: string[] = [];
    for (let i = 0; i < cs.length; i++) {
      const n = cs[i];
      if (n && n.startsWith('--')) out.push(`${n}:${cs.getPropertyValue(n)};`);
    }
    return out.join('');
  } catch {
    return '';
  }
}

interface Png { url: string; w: number; h: number }

function rasterizar(src: string, w: number, h: number): Promise<Png | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = Math.round(w * ESCALA_PNG);
        cv.height = Math.round(h * ESCALA_PNG);
        const ctx = cv.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ url: cv.toDataURL('image/png'), w, h });
      } catch {
        resolve(null); // imagem de outra origem "suja" o canvas: sai sem ela, não quebra o documento
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function svgParaPng(svgOrig: SVGSVGElement, vars: string): Promise<Png | null> {
  const r = svgOrig.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width || svgOrig.clientWidth || 300));
  const h = Math.max(1, Math.round(r.height || svgOrig.clientHeight || 150));
  const s = svgOrig.cloneNode(true) as SVGSVGElement;
  s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  s.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  s.setAttribute('width', String(w));
  s.setAttribute('height', String(h));
  if (!s.getAttribute('viewBox')) s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  st.textContent = `svg{${vars}}`;
  s.insertBefore(st, s.firstChild);
  const xml = new XMLSerializer().serializeToString(s);
  return rasterizar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml), w, h);
}

/** <img> com endereço vira data URI (o .doc é um arquivo só; figura em arquivo solto não viaja). */
function imgParaPng(img: HTMLImageElement): Promise<Png | null> {
  const r = img.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width || img.naturalWidth || 300));
  const h = Math.max(1, Math.round(r.height || img.naturalHeight || 150));
  if (img.src.startsWith('data:image/png') || img.src.startsWith('data:image/jpeg')) {
    return Promise.resolve({ url: img.src, w, h });
  }
  return rasterizar(img.src, w, h);
}

// ── as duas coisas que o Word entorta na fórmula (medido no Pró-Viga) ──
//   (1) letra acentuada vem como ACENTO SOBRE A LETRA (<mover accent>): o Word desmonta → vira a letra de uma peça só;
//   (2) o ";" do \min vem como SEPARADOR (<mo separator>): o Word reordena os argumentos → vira texto (<mtext>).
const ACENTOS: Record<string, string> = {
  'ˊ': '́', '´': '́', '^': '̂', 'ˆ': '̂', '~': '̃', '˜': '̃', 'ˋ': '̀',
};
const MATHML = 'http://www.w3.org/1998/Math/MathML';

export function consertaFormulas(el: ParentNode): void {
  el.querySelectorAll('mover[accent="true"]').forEach((mv) => {
    const fs = mv.children;
    if (fs.length !== 2) return;
    const letra = (fs[0].textContent || '').replace('ı', 'i');
    const marca = ACENTOS[(fs[1].textContent || '').trim()];
    if (!letra || letra.length !== 1 || !marca) return;
    const mi = document.createElementNS(MATHML, 'mi');
    mi.textContent = (letra + marca).normalize('NFC');
    mv.parentNode?.replaceChild(mi, mv);
  });
  el.querySelectorAll('mo[separator]').forEach((mo) => {
    const mt = document.createElementNS(MATHML, 'mtext');
    mt.textContent = mo.textContent;
    mo.parentNode?.replaceChild(mt, mo);
  });
}

// ── o que a tela não pinta não entra (o Word ignora display:none) ──
const ETIQ = 'data-mp-oculto';
function marcaInvisiveis(root: HTMLElement) {
  root.querySelectorAll('*').forEach((n) => {
    if (getComputedStyle(n).display === 'none') n.setAttribute(ETIQ, '1');
  });
}
function limpaEtiquetas(root: HTMLElement) {
  root.querySelectorAll(`[${ETIQ}]`).forEach((n) => n.removeAttribute(ETIQ));
}

// ── o desenho mora num quadro: imagem solta no Word anda; tabela de 1 célula é a única caixa rígida ──
//   (régua do dono: "e se você travar quadros pra entrar os SVGs? tipo tabelas?")
function enquadraFiguras(el: HTMLElement) {
  el.querySelectorAll('img').forEach((img) => {
    const pai = img.parentNode;
    if (!pai || img.closest('table')) return;
    const larg = parseFloat(img.getAttribute('width') || '0');
    const alt = parseFloat(img.getAttribute('height') || '0');
    if (larg < 60 || alt < 60) return; // ícone não é figura: emoldurado, o Word o infla
    const tb = document.createElement('table');
    tb.setAttribute('cellspacing', '0');
    tb.setAttribute('cellpadding', '0');
    tb.setAttribute('border', '0');
    tb.setAttribute('width', String(Math.round(larg)));
    tb.setAttribute('style', `border-collapse:collapse;border:none;mso-table-lspace:0pt;mso-table-rspace:0pt;width:${Math.round(larg)}px;`);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('style', 'border:none;padding:0;');
    td.setAttribute('width', String(Math.round(larg)));
    tr.appendChild(td);
    tb.appendChild(tr);
    pai.replaceChild(tb, img);
    td.appendChild(img);
    // a legenda que vem logo abaixo entra na mesma célula — só se for MESMO legenda (nada de fórmula ou tabela)
    const seg = tb.nextElementSibling;
    if (seg && !seg.querySelector('img, table, .katex, math') && !/^(H[1-6]|TABLE)$/.test(seg.tagName)
      && (seg.textContent || '').trim().length > 0 && (seg.textContent || '').length < 260) {
      td.appendChild(seg);
    }
  });
}

/*
  O chip "OK · 65%" no mesmo parágrafo da equação faz o Word tratá-la como equação DE TEXTO (fração miúda, 2,71/0,14
  em corpo pequeno) — só a linha da verificação saía diferente das outras (medido no Word 16). No Word o chip desce
  para um parágrafo próprio, alinhado à direita, logo abaixo; a equação volta a ser de exibição como as demais.
*/
export function separaChips(el: ParentNode): void {
  el.querySelectorAll('.mem-linha').forEach((linha) => {
    const chip = linha.querySelector('.mem-chip');
    if (!chip || !linha.parentNode) return;
    // o espaço eme que separava o chip na mesma linha sobra sozinho no fim do parágrafo
    const antes = chip.previousSibling;
    if (antes && antes.nodeType === 3 && !(antes.textContent || '').trim()) antes.remove();
    const p = document.createElement('div');
    p.setAttribute('style', 'text-align:right;margin:0 0 2pt;');
    p.appendChild(chip);
    linha.parentNode.insertBefore(p, linha.nextSibling);
  });
  // A linha de dados é de equações EM TEXTO (várias no parágrafo): o recuo do papel vem de padding, que o Word
  // ignora — vira margem do parágrafo, igual ao recuo das equações de exibição (lMargin 15 pt).
  // Dado SOZINHO na linha volta a ser equação de exibição e já ganha o lMargin: margem nele recuaria em dobro.
  el.querySelectorAll<HTMLElement>('.mem-dados').forEach((d) => {
    d.style.paddingLeft = '0';
    d.style.marginLeft = d.querySelectorAll('math').length > 1 ? '15pt' : '0';
  });
}

/** Tamanho de tela que tenha sobrado em px → pt (o papel já nasce em pt; isto é rede de segurança). */
function pxParaPt(el: HTMLElement) {
  el.querySelectorAll<HTMLElement>('[style]').forEach((n) => {
    const s = n.getAttribute('style');
    if (!s || !s.includes('px')) return;
    n.setAttribute('style', s.replace(/font-size:\s*([\d.]+)px/g, (_m, v) => `font-size:${Math.round(parseFloat(v) * 75) / 100}pt`));
  });
}

// ── o documento montado: seções retrato / paisagem (prancha) / retrato ──
const SEC = (n: number, larg: number, alt: number, mg: string, ori: string) =>
  `@page WordSection${n} {size:${larg}pt ${alt}pt; margin:${mg}; mso-page-orientation:${ori}; mso-paper-source:0;}\n`
  + `div.WordSection${n} {page:WordSection${n};}\n`;
// mso-break-type:section-break é o que VIRA A FOLHA (a quebra "normal" do Word só quebra a página)
const QUEBRA = '<br clear=all style="page-break-before:always;mso-break-type:section-break">';

const CSS_WORD =
  SEC(1, 595.3, 841.9, '37pt 28pt', 'portrait')
  + SEC(2, 841.9, 595.3, '28pt', 'landscape')
  + SEC(3, 595.3, 841.9, '37pt 28pt', 'portrait')
  + 'body { font-family:"Segoe UI",Arial,sans-serif; font-size:10pt; color:#111; }\n'
  + 'table { border-collapse:collapse; }\n'
  + 'p, div { margin:0; }\n';

/**
  O .doc a partir dos pedaços de corpo já traduzidos. Puro (testável sem navegador).
  `blocos`: [retrato, prancha?, retrato-depois?]. A caixa da seção NÃO carrega outra classe (medido: com classe
  extra o Word cria a seção e ignora o @page dela).
*/
export function montarDocumento(blocos: { retrato: string; prancha?: string; depois?: string }, titulo: string): string {
  const caixa = (n: number, dentro: string) => `<div class=WordSection${n}><div class="mp-doc-word">${dentro}</div></div>`;
  let corpo = caixa(1, blocos.retrato);
  if (blocos.prancha) {
    corpo += QUEBRA + caixa(2, blocos.prancha);
    if (blocos.depois) corpo += QUEBRA + caixa(3, blocos.depois);
  }
  const t = titulo.replace(/[<>&]/g, '');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office"\n'
    + '      xmlns:w="urn:schemas-microsoft-com:office:word"\n'
    + '      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"\n'
    + '      xmlns="http://www.w3.org/TR/REC-html40">\n<head>\n'
    + `<meta charset="utf-8">\n<title>${t}</title>\n`
    + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>'
    + '<w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>'
    // Equação sozinha no parágrafo o Word trata como "de exibição" e CENTRA — a memória virava uma coluna no meio
    // da folha. defJc=left alinha à esquerda, com o mesmo recuo das linhas do papel (lMargin em twips: 300 = 15 pt).
    // Medido abrindo o .doc no Word 16 (bancada da frente MEM, 08/10/2026).
    + '<m:mathPr><m:mathFont m:val="Cambria Math"/><m:dispDef/><m:lMargin m:val="300"/><m:rMargin m:val="0"/>'
    + '<m:defJc m:val="left"/><m:wrapIndent m:val="1440"/></m:mathPr>'
    + '</w:WordDocument></xml><![endif]-->\n'
    // o CSS do KaTeX NÃO vai junto, de propósito: o Word converte o MathML e ignora o desenho
    + `<style>\n${CSS_WORD}</style>\n</head>\n<body>\n${corpo}\n</body>\n</html>`;
}

/**
  Traduz a árvore do memorial (já montada no DOM) para o HTML que o Word abre. A árvore é aberta FORA DA TELA na
  largura da folha (sem layout, todo desenho mede zero e a rasterização sai em branco) e volta como estava.
*/
export async function traduzirParaWord(raiz: HTMLElement, opcoes: { titulo: string }): Promise<string> {
  const vars = varsDoApp();
  const antes = raiz.getAttribute('style') || '';
  raiz.setAttribute('style', `${antes};display:block;position:absolute;left:-20000px;top:0;width:${LARG_LAYOUT}px;background:#fff;`);
  try {
    marcaInvisiveis(raiz);
    const desenhos: (SVGSVGElement | HTMLImageElement)[] = [];
    raiz.querySelectorAll<SVGSVGElement | HTMLImageElement>('svg, img').forEach((n) => {
      if (n.closest('.katex') || n.closest(`[${ETIQ}]`)) return;
      desenhos.push(n);
    });
    const pngs = await Promise.all(desenhos.map((n) => (n instanceof HTMLImageElement ? imgParaPng(n) : svgParaPng(n, vars))));

    const clone = raiz.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('style').forEach((s) => s.remove());
    clone.querySelectorAll(`[${ETIQ}]`).forEach((n) => n.remove());
    // desenho por desenho, na MESMA ordem em que foram medidos
    const alvos: Element[] = [];
    clone.querySelectorAll('svg, img').forEach((n) => { if (!n.closest('.katex')) alvos.push(n); });
    alvos.forEach((n, i) => {
      const png = pngs[i];
      if (!png) { n.remove(); return; }
      const img = document.createElement('img');
      img.setAttribute('src', png.url);
      img.setAttribute('width', String(Math.round(png.w)));
      img.setAttribute('height', String(Math.round(png.h)));
      img.setAttribute('style', 'max-width:100%;height:auto;');
      n.parentNode?.replaceChild(img, n);
    });
    // a prancha (desenho largo e baixo) ocupa a folha deitada, com o teto de altura do papel
    clone.querySelectorAll('.mp-prancha img').forEach((img) => {
      const w0 = parseFloat(img.getAttribute('width') || '0');
      const h0 = parseFloat(img.getAttribute('height') || '0');
      if (!(w0 > 0) || !(h0 > 0)) return;
      let lw = LARG_PAISAGEM, lh = Math.round((h0 * LARG_PAISAGEM) / w0);
      if (lh > ALT_PRANCHA) { lw = Math.round((lw * ALT_PRANCHA) / lh); lh = ALT_PRANCHA; }
      img.setAttribute('width', String(lw));
      img.setAttribute('height', String(lh));
    });
    enquadraFiguras(clone);
    consertaFormulas(clone);
    separaChips(clone);
    pxParaPt(clone);

    // seções: o que vier marcado .mp-prancha vai para a folha deitada
    const doc = clone.querySelector('.mp-doc') ?? clone;
    const filhos = Array.from(doc.children) as HTMLElement[];
    const iPr = filhos.findIndex((f) => f.classList.contains('mp-prancha') || !!f.querySelector('.mp-prancha'));
    const html = (de: number, ate: number) => filhos.slice(de, ate + 1).map((f) => f.outerHTML).join('');
    if (iPr < 0) return montarDocumento({ retrato: doc.innerHTML }, opcoes.titulo);
    let iFim = iPr;
    while (iFim + 1 < filhos.length && filhos[iFim + 1].classList.contains('mp-prancha')) iFim++;
    return montarDocumento({
      retrato: html(0, iPr - 1),
      prancha: html(iPr, iFim),
      depois: iFim + 1 < filhos.length ? html(iFim + 1, filhos.length - 1) : undefined,
    }, opcoes.titulo);
  } finally {
    raiz.setAttribute('style', antes); // a tela volta ao que era, sempre
    limpaEtiquetas(raiz);
  }
}

/** Nome de arquivo seguro: "Muro da divisa" → "Muro_da_divisa_memorial.doc". */
export function nomeDoArquivo(projeto: string | undefined): string {
  const base = (projeto || 'Arrimo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Arrimo';
  return `${base}_memorial.doc`;
}

/** Entrega o .doc ao usuário (download). BOM na frente: sem ele o Word abre o arquivo em ANSI. */
export function baixarDoc(html: string, arquivo: string): void {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
