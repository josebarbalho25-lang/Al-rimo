/*
  HACHURAS DE MATERIAL — as do Revit do Jose (14/10): terra (trançado de três riscos, deitado e em pé alternando),
  areia (pontinhos) e concreto (triângulos e riscos), nas cores dele; a brita, que no Revit dele não tinha uma boa,
  ficou em pedras de quina viva (escolha do Jose entre três opções, 14/10: "opção A" — brita é pedra britada; o
  círculo é a convenção de seixo rolado). Terra no trançado do EARTH. Tamanhos calibrados por ele na régua (ESCALA).

  Os pontos "aleatórios" saem de um sorteio com semente fixa: o mesmo desenho a cada vez (teste e exportação
  estáveis). Cada pedra perto da borda do ladrilho é desenhada também do outro lado, para o ladrilho emendar sem
  costura.
*/

export const HACHURA = {
  terra: '#a67857',        // RGB 166-120-087
  terraFundo: '#dbc9bb',   // RGB 219-201-187
  areia: '#5d5d5d',        // RGB 093-093-093
  areiaFundo: '#ffffb7',   // RGB 255-255-183
  concreto: '#5d5d5d',
  concretoFundo: '#d4d4d4', // RGB 212-212-212
  brita: '#4a4a4a',
  britaFundo: '#c3bfb5',
} as const;

function sorteio(semente: number): () => number {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const f1 = (x: number): string => (Math.round(x * 10) / 10).toString();

/**
 * O tamanho de cada hachura, calibrado pelo Jose na régua (14/10, `_trabalho/calibrar_hachuras.html`: "terra 0,40,
 * concreto 0,85, areia 0,25, brita 0,55" sobre a 1ª proposta — terra com casa de 48 e as outras no dobro da amostra).
 * Muda só o desenho; o traço fica fino em qualquer tamanho.
 */
const ESCALA = { terra: 48 * 0.4, concreto: 2 * 0.85, areia: 2 * 0.25, brita: 2 * 0.55 } as const;

function risco(E: number, x: number, y: number, ang: number, l: number, cor: string): string {
  [x, y, l] = [x * E, y * E, l * E];
  return `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + l * Math.cos(ang))}" y2="${f1(y + l * Math.sin(ang))}" stroke="${cor}" stroke-width="0.6"/>`;
}

function ladrilho(id: string, lado: number, fundo: string, miolo: string): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" fill="${fundo}"/>${miolo}</pattern>`;
}

/**
 * Terra: o trançado EARTH do AutoCAD (de onde vem a "Terra" do Revit), na proporção exata do .pat — casa c, três
 * riscos deitados a 0, 3/8 e 3/4 de c correndo a casa inteira, e na casa vizinha três em pé a 3/32, 15/32 e 27/32
 * de c, deslocados 15/16 de c para cima. Os riscos de um grupo quase encostam nos do outro: é o que dá o
 * entrelaçado (Jose, 14/10: "os traçados meio que se entrelaçam, isso que eu gosto dela"; os quadrados soltos da
 * 1ª tentativa não davam).
 */
function terra(id: string): string {
  const c = ESCALA.terra;
  const T = 2 * c;
  const seg: [number, number, number, number][] = [];
  for (const k of [0, 0.375, 0.75]) {
    seg.push([0, k * c, c, k * c]);                     // deitados: linha 0, coluna 0
    seg.push([c, (1 + k) * c, 2 * c, (1 + k) * c]);     // deitados: linha 1, coluna 1
  }
  for (const k of [0.09375, 0.46875, 0.84375]) {
    seg.push([k * c, 0.9375 * c, k * c, 1.9375 * c]);           // em pé: coluna 0, entre as linhas 0 e 1
    seg.push([(1 + k) * c, -0.0625 * c, (1 + k) * c, 0.9375 * c]); // em pé: coluna 1
  }
  let s = '';
  for (const [x1, y1, x2, y2] of seg) {
    for (const dx of [-T, 0, T]) {
      for (const dy of [-T, 0, T]) {
        if (Math.max(x1, x2) + dx < 0 || Math.min(x1, x2) + dx > T || Math.max(y1, y2) + dy < 0 || Math.min(y1, y2) + dy > T) continue;
        s += `<line x1="${f1(x1 + dx)}" y1="${f1(y1 + dy)}" x2="${f1(x2 + dx)}" y2="${f1(y2 + dy)}" stroke="${HACHURA.terra}" stroke-width="0.8"/>`;
      }
    }
  }
  return ladrilho(id, T, HACHURA.terraFundo, s);
}

function areia(id: string): string {
  const r = sorteio(11);
  let s = '';
  const E = ESCALA.areia;
  for (let i = 0; i < 70; i++) s += risco(E, r() * 60, r() * 60, r() * 6.28, 0.6 + r() * 0.9, HACHURA.areia);
  return ladrilho(id, 60 * E, HACHURA.areiaFundo, s);
}

function concreto(id: string): string {
  const r = sorteio(23);
  const E = ESCALA.concreto;
  let s = '';
  for (let i = 0; i < 22; i++) {
    const x = 6 + r() * 68, y = 6 + r() * 68, raio = 1.4 + r() * 1.6, a0 = r() * 6.28;
    const p = [0, 1, 2].map((v) => `${f1(E * (x + raio * Math.cos(a0 + v * 2.094)))},${f1(E * (y + raio * Math.sin(a0 + v * 2.094)))}`);
    s += `<polygon points="${p.join(' ')}" fill="none" stroke="${HACHURA.concreto}" stroke-width="0.6"/>`;
  }
  for (let i = 0; i < 45; i++) s += risco(E, r() * 80, r() * 80, r() * 6.28, 0.5 + r() * 1.2, HACHURA.concreto);
  return ladrilho(id, 80 * E, HACHURA.concretoFundo, s);
}

/** Brita: pedras de 5 a 7 lados, de quina viva, uma por casa de uma grade 8 × 8 com o centro sacudido. */
function brita(id: string): string {
  const r = sorteio(7);
  const T = 72, n = 8, passo = T / n, E = ESCALA.brita;
  let s = '';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = passo * (i + 0.5) + (r() - 0.5) * passo * 0.35;
      const cy = passo * (j + 0.5) + (r() - 0.5) * passo * 0.35;
      const raio = 2.8 + r() * 1.4, lados = 5 + Math.floor(r() * 3), a0 = r() * 6.28;
      const p: [number, number][] = [];
      for (let v = 0; v < lados; v++) {
        const b = a0 + (v * 6.28) / lados + (r() - 0.5) * 0.6, rr = raio * (0.7 + r() * 0.3);
        p.push([cx + rr * Math.cos(b), cy + rr * Math.sin(b)]);
      }
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      for (const dx of [-T, 0, T]) {
        for (const dy of [-T, 0, T]) {
          const fora = Math.min(...xs) + dx > T || Math.max(...xs) + dx < 0 || Math.min(...ys) + dy > T || Math.max(...ys) + dy < 0;
          if (fora) continue;
          s += `<polygon points="${p.map(([x, y]) => `${f1(E * (x + dx))},${f1(E * (y + dy))}`).join(' ')}" fill="none" stroke="${HACHURA.brita}" stroke-width="0.7"/>`;
        }
      }
    }
  }
  return ladrilho(id, T * E, HACHURA.britaFundo, s);
}

const cache = new Map<string, string>();

/** Os quatro ladrilhos, com o prefixo da prancha (`des-solo`, `des-conc`, `des-areia`, `des-brita`). */
export function hachurasDeMaterial(prefixo: string): string {
  let s = cache.get(prefixo);
  if (!s) {
    s = terra(`${prefixo}-solo`) + concreto(`${prefixo}-conc`) + areia(`${prefixo}-areia`) + brita(`${prefixo}-brita`);
    cache.set(prefixo, s);
  }
  return s;
}
