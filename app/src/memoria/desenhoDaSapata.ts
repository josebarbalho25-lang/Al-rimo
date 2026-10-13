/*
  A SAPATA CORRIDA DESENHADA COM AS FORÇAS — as figuras dos cards de tombamento e de tensões no solo (Jose, 13/10:
  "o cálculo da sapata precisa de figuras lúdicas"; "separar a carga concentrada da terra sobre o talão e a distância
  dela"; "já são duas figuras separadas, uma para as forças que tombam e outra para as que estabilizam").

  Três desenhos, o mesmo corte (solo à direita, como os cortes da régua das figuras; o PÉ — a borda de fora da ponta —
  à esquerda, porque é em torno dele que a sapata tomba):
    1. FORÇAS QUE ESTABILIZAM: cada parcela da tabela de cargas verticais da aba Fundação (muro, contraforte, sapata,
       solo sobre o talão, sobrecarga, carga no topo, subpressão, aterro sobre a ponta, dente) como uma seta concentrada
       na posição dela, com o braço até o pé cotado embaixo — o M estabilizante é a soma de N × braço;
    2. FORÇAS QUE TOMBAM: o diagrama do empuxo até a base da sapata, a resultante H na altura y = M de tombamento / H e o
       giro no pé — o M de tombamento é H × y;
    3. TENSÕES NO SOLO: o centro da base (onde se mede a excentricidade), a resultante N a e do centro, o núcleo
       central (B/6 para cada lado) e o trapézio (ou triângulo) de pressão com σmáx e σmín.

  DE ONDE VEM CADA NÚMERO: das células da aba Fundação (a tabela de cargas, linhas 16 a 24: N na coluna B, x na C,
  medido da borda aterrada) e dos nomes que a memória mostra (H_k, M_tb, M_est, N_tot, e_f, s_hi, s_lo, c_len…). Nada
  aqui é conta nova: só a posição no papel. Escala única por desenho, para caber na largura do card.
*/
import type { Resultado } from '@/motor/tipos';
import dados from '@/motor/planilha.gerada.json';
import { nbr } from './formato';
import type { DesenhoDoCard } from './desenhoDaSecaoCf';

const TINTA = '#1a1a1a';
const COTA = '#3a3a3a';
const CONCRETO = '#ececec';
const BLOCO = '#d6d6d6';
const SOLO = '#e8d8b9';
const SOLO_LINHA = '#8d6e3f';
const EMPUXO = '#f8cbad';
const LARANJA = '#c55a11';      // forças (régua das figuras: carga em laranja)
const AZUL = '#2e75b6';         // tensão no solo
const AZUL_CLARO = '#ddebf7';
const FS = 14;                  // letra das cotas e dos rótulos
const LARGURA = 770;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f2 = (v: number) => v.toFixed(2);
const texto = (x: number, y: number, s: string, tam = FS, ancora: 'start' | 'middle' | 'end' = 'middle', cor = TINTA, peso = 'normal') =>
  `<text x="${f2(x)}" y="${f2(y)}" font-size="${tam}" text-anchor="${ancora}" fill="${cor}" font-weight="${peso}">${esc(s)}</text>`;
const lin = (x1: number, y1: number, x2: number, y2: number, cor = TINTA, sw = 1, extra = '') =>
  `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${cor}" stroke-width="${sw}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = TINTA, sw = 1, extra = '') =>
  `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;
const poli = (pts: Array<[number, number]>, fill: string, stroke: string, sw = 1) =>
  `<polygon points="${pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const marca = (x: number, y: number) => lin(x - 4, y + 4, x + 4, y - 4, COTA, 1.1);
const cotaH = (xa: number, xb: number, y: number, rot: string) =>
  lin(xa, y, xb, y, COTA, 0.8) + marca(xa, y) + marca(xb, y) + texto((xa + xb) / 2, y - 5, rot, FS - 1);
const cotaV = (x: number, ya: number, yb: number, rot: string, lado: 1 | -1) =>
  lin(x, ya, x, yb, COTA, 0.8) + marca(x, ya) + marca(x, yb) + texto(x + lado * 7, (ya + yb) / 2 + 5, rot, FS - 1, lado > 0 ? 'start' : 'end');
const chamada = (x1: number, y1: number, x2: number, y2: number) => lin(x1, y1, x2, y2, COTA, 0.4, ' stroke-dasharray="2 2"');
/** Seta de (x1, y1) até a ponta (x2, y2). */
function seta(x1: number, y1: number, x2: number, y2: number, cor = LARANJA, sw = 2.2): string {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 10, b = 5;
  const p1: [number, number] = [x2 - a * Math.cos(ang) + b * Math.sin(ang), y2 - a * Math.sin(ang) - b * Math.cos(ang)];
  const p2: [number, number] = [x2 - a * Math.cos(ang) - b * Math.sin(ang), y2 - a * Math.sin(ang) + b * Math.cos(ang)];
  return lin(x1, y1, x2 - 8 * Math.cos(ang), y2 - 8 * Math.sin(ang), cor, sw) + poli([[x2, y2], p1, p2], cor, cor, 0.5);
}
const svgDe = (partes: string[], H: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGURA} ${Math.ceil(H)}" style="width:100%;height:auto;display:block" font-family="Arial, Helvetica, sans-serif"><rect width="${LARGURA}" height="${Math.ceil(H)}" fill="#ffffff"/>${partes.join('')}</svg>`;
const m2 = (v: number) => nbr(v, 2);
const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** O que os três desenhos leem da conta; null quando a geometria não está toda em número. */
function geometria(r: Resultado) {
  const n = (id: string) => r.num(id);
  const B = n('B_sap'), h = n('h_sap'), a = n('a_ater'), t = n('t_m'), Hm = n('H_muro'), Hs = n('H_solo');
  if (![B, h, a, t, Hm, Hs].every(ok) || !(B! > 0) || !(h! > 0)) return null;
  const bden = n('b_den') ?? 0, hden = n('h_den') ?? 0, xden = n('x_den') ?? 0;
  const pass = r.v('pass_on') === 'Sim';
  return {
    B: B!, h: h!, a: a!, t: t!, Hm: Hm!, Hs: Hs!,
    dente: bden > 0 && hden > 0 ? { b: bden, h: hden, x: xden } : null,
    hfr: pass ? Math.max(0, n('h_fr') ?? 0) : 0,
  };
}
type Geo = NonNullable<ReturnType<typeof geometria>>;

/**
  O corte (muro, sapata, dente, solo do talão e aterro da frente), com o pé em xPe e o topo da sapata em yTopo. x da
  planilha é medido da BORDA ATERRADA: no papel, X(x) = xPe + (B − x)·s.
*/
function corte(g: Geo, xPe: number, yTopo: number, s: number, soloClaro = false): { partes: string[]; X: (x: number) => number; yBase: number; yFundo: number } {
  const X = (x: number) => xPe + (g.B - x) * s;
  const yBase = yTopo + g.h * s;
  const partes: string[] = [];
  const xFaceSolo = X(g.a - g.t / 2);          // face do muro do lado do solo
  const xFaceFora = X(g.a + g.t / 2);
  const xFim = X(0) + 0.35 * s;                // o solo continua além da borda aterrada
  // solo contido: do muro até além da borda aterrada, na altura de solo
  partes.push(rect(xFaceSolo, yTopo - g.Hs * s, xFim - xFaceSolo, g.Hs * s, SOLO, 'none', 0, soloClaro ? ' fill-opacity="0.5"' : ''));
  partes.push(lin(xFaceSolo, yTopo - g.Hs * s, xFim, yTopo - g.Hs * s, SOLO_LINHA, 1.6));
  // aterro sobre a ponta (só com a garantia do solo da frente)
  if (g.hfr > 0) partes.push(rect(xPe - 0.2 * s, yTopo - g.hfr * s, xFaceFora - xPe + 0.2 * s, g.hfr * s, SOLO, 'none', 0, ' fill-opacity="0.6"'));
  // muro
  partes.push(rect(xFaceFora, yTopo - g.Hm * s, g.t * s, g.Hm * s, BLOCO, TINTA, 1.2));
  // sapata e dente
  partes.push(rect(xPe, yTopo, g.B * s, g.h * s, CONCRETO, TINTA, 1.4));
  let yFundo = yBase;
  if (g.dente) {
    const xc = X(g.B / 2 + g.dente.x);
    partes.push(rect(xc - (g.dente.b * s) / 2, yBase, g.dente.b * s, g.dente.h * s, CONCRETO, TINTA, 1.4));
    partes.push(lin(xc - (g.dente.b * s) / 2 + 1.4, yBase, xc + (g.dente.b * s) / 2 - 1.4, yBase, CONCRETO, 2));
    yFundo = yBase + g.dente.h * s;
  }
  return { partes, X, yBase, yFundo };
}

/** O pé marcado como ponto de giro: um círculo e a seta curva do tombamento. */
function giroNoPe(x: number, y: number): string[] {
  return [
    `<circle cx="${f2(x)}" cy="${f2(y)}" r="5" fill="${LARANJA}"/>`,
    `<path d="M ${f2(x - 26)} ${f2(y - 4)} A 26 26 0 0 1 ${f2(x - 4)} ${f2(y - 26)}" fill="none" stroke="${LARANJA}" stroke-width="1.6"/>`,
    poli([[x - 2, y - 27], [x - 10, y - 31], [x - 9, y - 22]], LARANJA, LARANJA, 0.5),
    texto(x - 8, y + 20, 'pé (giro)', FS - 1, 'middle', LARANJA, 'bold'),
  ];
}

// nomes curtos das linhas da tabela de cargas (aba Fundação, coluna A)
const NOME_CURTO: Record<string, string> = {
  'Muro (peso próprio)': 'muro', Contraforte: 'contraforte', Sapata: 'sapata', 'Solo sobre o talão': 'solo do talão',
  'Sobrecarga sobre o talão': 'sobrecarga', 'Carga permanente no topo': 'carga no topo', 'Subpressão (água)': 'água',
  'Aterro sobre a ponta': 'aterro da frente', Dente: 'dente',
};

/** Número dentro de um círculo: liga a seta à linha da legenda e à cota do braço. */
function etiqueta(x: number, y: number, n: number): string {
  return `<circle cx="${f2(x)}" cy="${f2(y)}" r="10" fill="#ffffff" stroke="${LARANJA}" stroke-width="1.4"/>` +
    texto(x, y + 5, String(n), FS - 1, 'middle', LARANJA, 'bold');
}

/**
  1. As forças que ESTABILIZAM: cada peso concentrado na posição dele, numerado; a legenda à direita dá o nome, o N e o
  braço até o pé; as cotas dos braços ficam embaixo, com o mesmo número. O muro alto é interrompido (≈): aqui só a
  posição na horizontal importa, e a escala fica a da sapata.
*/
export function desenhoDasForcasQueEstabilizam(r: Resultado): DesenhoDoCard | null {
  return desenhoDasCargasVerticais(r, 'pe');
}

/**
  1b. As MESMAS cargas medidas do CENTRO da base (excentricidade): a distância de cada uma ao centro, + do lado do pé e
  − do lado do talão (a convenção do e), e a soma Σ N × d que, com o momento do empuxo, dá o momento no centro.
*/
export function desenhoDasDistanciasAoCentro(r: Resultado): DesenhoDoCard | null {
  return desenhoDasCargasVerticais(r, 'centro');
}

function desenhoDasCargasVerticais(r: Resultado, ref: 'pe' | 'centro'): DesenhoDoCard | null {
  const g0 = geometria(r);
  if (!g0) return null;
  const cargas: Array<{ nome: string; N: number; x: number }> = [];
  for (let linha = 16; linha <= 24; linha++) {
    const nomeLinha = r.cel(`Fundação!A${linha}`);
    const N = r.cel(`Fundação!B${linha}`), x = r.cel(`Fundação!C${linha}`);
    if (typeof nomeLinha !== 'string' || !ok(N as number) || !ok(x as number) || Math.abs(N as number) < 1e-9) continue;
    cargas.push({ nome: NOME_CURTO[nomeLinha] ?? nomeLinha, N: N as number, x: x as number });
  }
  if (!cargas.length) return null;
  const doPe = ref === 'pe';
  // braço até o pé (B − x) ou distância ao centro (x − B/2, + para o pé); x medido da borda aterrada
  const dist = (x: number) => (doPe ? g0.B - x : x - g0.B / 2);
  const comSinal = (v: number) => (doPe ? m2(v) : `${v > 0 ? '+' : v < 0 ? '−' : ''}${m2(Math.abs(v))}`);
  const total = doPe ? r.num('M_est') : r.num('M_vc');
  const s = Math.min(470 / (g0.B + 0.45), 300);
  // muro e solo cortados na altura que cabe (1,0 m de desenho); o resto é interrupção
  const hVis = Math.min(Math.max(g0.Hm, g0.Hs), 1.0);
  const corta = Math.max(g0.Hm, g0.Hs) > hVis + 1e-9;
  const g = { ...g0, Hm: Math.min(g0.Hm, hVis), Hs: Math.min(g0.Hs, hVis) };
  const xPe = 70;
  const ySeta = 46;                                       // onde as setas começam (as etiquetas)
  const yTopo = ySeta + 40 + hVis * s;
  const c = corte(g, xPe, yTopo, s, true);
  const partes = [...c.partes];
  if (corta) {
    // o sinal de interrupção no topo do muro e do solo
    const yc = yTopo - hVis * s;
    const xa = c.X(g.a + g.t / 2) - 6, xb = c.X(0) + 0.35 * s;
    partes.push(`<path d="M ${f2(xa)} ${f2(yc)} l 10 -6 l 6 12 l 10 -6" fill="none" stroke="${TINTA}" stroke-width="1"/>`);
    partes.push(texto(xb + 4, yc + 4, '≈', FS + 2, 'start'));
  }
  // numeradas da esquerda (pé) para a direita. Duas cargas no mesmo ponto (sapata e dente no centro; solo e
  // sobrecarga no meio do talão) dividem a seta, que fica no lugar certo — só os números se empilham
  const xs: number[] = [];
  const ordenadas = [...cargas].sort((u, v) => c.X(u.x) - c.X(v.x)).map((q, k) => {
    const xd = c.X(q.x);
    const pilha = xs.filter((xa) => Math.abs(xa - xd) < 22).length;
    xs.push(xd);
    return { ...q, n: k + 1, xd, pilha };
  });
  ordenadas.forEach((q) => {
    const xq = q.xd;
    const ponta = q.nome === 'sapata' ? yTopo + (g.h * s) / 2 : q.nome === 'dente' ? c.yBase + ((g.dente?.h ?? 0) * s) / 2 : yTopo;
    if (q.N >= 0) partes.push(seta(xq, ySeta + 10, xq, ponta));
    else partes.push(seta(xq, c.yFundo + 44, xq, c.yBase, AZUL));
    partes.push(etiqueta(xq + q.pilha * 22, q.N >= 0 ? ySeta : c.yFundo + 56, q.n));
  });
  // a legenda, à direita
  const xLeg = c.X(0) + 0.35 * s + 34;
  let yL = ySeta;
  partes.push(texto(xLeg, yL - 20, doPe ? 'carga · N · braço até o pé' : 'carga · N · distância ao centro (+ pé)', FS - 1, 'start', COTA));
  ordenadas.forEach((q) => {
    partes.push(etiqueta(xLeg + 10, yL, q.n));
    partes.push(texto(xLeg + 28, yL + 5, `${q.nome}  ${m2(q.N)} kN · ${comSinal(dist(q.x))} m`, FS - 1, 'start'));
    yL += 28;
  });
  if (ok(total)) {
    partes.push(texto(xLeg, yL + 10, doPe ? `M est = Σ N × braço = ${m2(total)} kN·m` : `M N = Σ N × d = ${comSinal(total)} kN·m`, FS, 'start', TINTA, 'bold'));
  }
  // as distâncias, embaixo, da menor para a maior, a partir da referência (o pé, ou o centro)
  const xRef = doPe ? xPe : c.X(g.B / 2);
  let y = c.yFundo + 40 + (cargas.some((q) => q.N < 0) ? 30 : 0);
  for (const q of [...ordenadas].sort((u, v) => Math.abs(dist(u.x)) - Math.abs(dist(v.x)))) {
    if (Math.abs(dist(q.x)) < 0.0005) continue;           // no centro: distância zero, sem cota
    partes.push(chamada(q.xd, c.yBase, q.xd, y + 4));
    partes.push(cotaH(Math.min(xRef, q.xd), Math.max(xRef, q.xd), y, `(${q.n}) ${comSinal(dist(q.x))} m`));
    y += 28;
  }
  partes.push(chamada(xRef, c.yBase, xRef, y - 24));
  if (doPe) partes.push(...giroNoPe(xPe, c.yBase));
  else {
    partes.push(lin(xRef, yTopo - 30, xRef, c.yFundo + 20, COTA, 0.9, ' stroke-dasharray="8 4 2 4"'));
    partes.push(texto(xRef + 6, c.yFundo + 18, 'centro', FS - 1, 'start', COTA, 'bold'));
    partes.push(texto(xPe, c.yFundo + 18, '+ lado do pé', FS - 2, 'start', COTA));
  }
  return {
    svg: svgDe(partes, Math.max(y, yL + 30) + 4),
    titulo: doPe ? 'Forças que estabilizam (braços até o pé)' : 'Cargas verticais e distâncias ao centro (+ do lado do pé)',
    largura: LARGURA,
  };
}

/** 2. As forças que TOMBAM: o empuxo até a base da sapata, a resultante H na altura y e o giro no pé. */
export function desenhoDasForcasQueTombam(r: Resultado): DesenhoDoCard | null {
  const g = geometria(r);
  const H = r.num('H_k'), Mtb = r.num('M_tb');
  const sTopo = r.num('sh_topo') ?? 0, sBase = r.num('sh_base'), sSap = r.num('sh_b2');
  if (!g || !ok(H) || !ok(Mtb) || !(H > 0) || !ok(sBase) || !ok(sSap)) return null;
  const s = Math.min(420 / (g.B + 0.6), 330 / (g.Hs + g.h + (g.dente?.h ?? 0)));
  const xPe = 90;
  const yTopo = 30 + Math.max(g.Hm, g.Hs) * s;
  const c = corte(g, xPe, yTopo, s);
  const partes = [...c.partes];
  // o diagrama do empuxo no plano da borda aterrada, do topo do solo à base da sapata
  const xPl = c.X(0);
  const kp = 140 / Math.max(Math.abs(sTopo), Math.abs(sBase), Math.abs(sSap), 1e-9);   // px por kPa
  const ySolo = yTopo - g.Hs * s;
  partes.push(poli([[xPl, ySolo], [xPl + sTopo * kp, ySolo], [xPl + sBase * kp, yTopo], [xPl + sSap * kp, c.yBase], [xPl, c.yBase]], EMPUXO, LARANJA, 1));
  partes.push(lin(xPl, ySolo, xPl, c.yBase, TINTA, 1, ' stroke-dasharray="6 4"'));
  for (let k = 1; k <= 4; k++) {
    const yy = ySolo + (k / 5) * (c.yBase - ySolo);
    const frac = (yy - ySolo) / (yTopo - ySolo);
    const w = yy <= yTopo ? sTopo + (sBase - sTopo) * frac : sBase + ((sSap - sBase) * (yy - yTopo)) / (c.yBase - yTopo);
    if (w * kp > 16) partes.push(seta(xPl + w * kp - 2, yy, xPl + 3, yy, LARANJA, 1));
  }
  partes.push(texto(xPl + sSap * kp + 8, c.yBase + 4, `${m2(sSap)} kPa`, FS - 1, 'start'));
  partes.push(texto(xPl + sTopo * kp + 8, ySolo + 12, `${m2(sTopo)} kPa`, FS - 1, 'start'));
  // a resultante: H na altura y = M de tombamento / H acima da base
  const yH = Mtb / H;
  const yy = c.yBase - yH * s;
  const xFimSeta = xPl + Math.max(sBase, sSap) * kp + 120;
  partes.push(seta(xFimSeta, yy, xPl + 2, yy, LARANJA, 3));
  partes.push(texto(xFimSeta - 4, yy - 9, `H = ${m2(H)} kN`, FS, 'end', LARANJA, 'bold'));
  partes.push(chamada(xPl, yy, xFimSeta + 34, yy), chamada(xPe, c.yBase, xFimSeta + 34, c.yBase));
  partes.push(cotaV(xFimSeta + 30, yy, c.yBase, `y = ${m2(yH)} m`, 1));
  partes.push(...giroNoPe(xPe, c.yBase));
  const yRodape = c.yFundo + 44;
  partes.push(texto(xPe, yRodape, `M de tombamento = H × y = ${m2(H)} × ${m2(yH)} = ${m2(Mtb)} kN·m (em torno do pé, na base da sapata)`, FS, 'start', TINTA, 'bold'));
  return { svg: svgDe(partes, yRodape + 14), titulo: 'Forças que tombam (empuxo até a base da sapata)', largura: LARGURA };
}

/** 3. As tensões no solo: o centro da base, a resultante a e dele, o núcleo central e o diagrama de pressão. */
export function desenhoDasTensoes(r: Resultado): DesenhoDoCard | null {
  const g = geometria(r);
  const N = r.num('N_tot'), e = r.num('e_f'), sHi = r.num('s_hi'), sLo = r.num('s_lo') ?? 0, cLen = r.num('c_len');
  if (!g || !ok(N) || !ok(e) || !ok(sHi) || !(sHi > 0)) return null;
  const s = 520 / g.B;
  const xPe = 110;
  const yTopo = 70;
  const yBase = yTopo + Math.min(g.h * s, 60);
  const partes: string[] = [];
  const X = (x: number) => xPe + (g.B - x) * s;             // x da borda aterrada
  partes.push(rect(xPe, yTopo, g.B * s, yBase - yTopo, CONCRETO, TINTA, 1.4));
  partes.push(texto(xPe - 8, yBase + 4, 'pé', FS - 1, 'end'));
  partes.push(texto(X(0) + 8, yBase + 4, 'borda aterrada', FS - 1, 'start'));
  // o centro da base e o núcleo central (B/6 para cada lado)
  const xc = X(g.B / 2);
  partes.push(lin(xc, yTopo - 40, xc, yBase + 150, COTA, 0.8, ' stroke-dasharray="8 4 2 4"'));
  partes.push(texto(xc, yTopo - 46, 'centro (giro da excentricidade)', FS - 1));
  const n6 = (g.B / 6) * s;
  partes.push(rect(xc - n6, yBase - 5, 2 * n6, 5, '#fff2cc', '#bf9000', 0.8));
  partes.push(texto(xc + n6 + 4, yBase - 8, 'núcleo B/6', FS - 2, 'start', '#7f6000'));
  // a resultante N, a e do centro (+ para o pé = para a esquerda no papel)
  const xN = xc - e * s;
  partes.push(seta(xN, yTopo - 34, xN, yBase - 2, LARANJA, 3));
  partes.push(texto(xN + (e >= 0 ? -8 : 8), yTopo - 20, `N = ${m2(N)} kN`, FS, e >= 0 ? 'end' : 'start', LARANJA, 'bold'));
  if (Math.abs(e * s) > 2) partes.push(cotaH(Math.min(xN, xc), Math.max(xN, xc), yTopo + 22, `e = ${nbr(e, 3)} m`));
  // o diagrama de pressão embaixo da base: trapézio, ou triângulo a partir da borda mais comprimida
  const kp = 110 / sHi;
  const trapezio = Math.abs(e) <= g.B / 6 + 1e-12;
  const xMax = e >= 0 ? xPe : X(0);                       // a borda mais comprimida
  const xOutra = e >= 0 ? X(0) : xPe;
  if (trapezio) {
    partes.push(poli([[xMax, yBase], [xOutra, yBase], [xOutra, yBase + sLo * kp], [xMax, yBase + sHi * kp]], AZUL_CLARO, AZUL, 1.2));
    partes.push(texto(xOutra + (e >= 0 ? 8 : -8), yBase + sLo * kp + 5, `σmín = ${nbr(sLo, 1)} kPa`, FS - 1, e >= 0 ? 'start' : 'end', AZUL));
  } else {
    const comp = (ok(cLen) ? cLen : 3 * (g.B / 2 - Math.abs(e))) * s;
    const xZero = e >= 0 ? xMax + comp : xMax - comp;
    partes.push(poli([[xMax, yBase], [xZero, yBase], [xMax, yBase + sHi * kp]], AZUL_CLARO, AZUL, 1.2));
    partes.push(texto(xZero, yBase - 8, 'descola', FS - 2, 'middle', AZUL));
  }
  partes.push(texto(xMax + (e >= 0 ? 6 : -6), yBase + sHi * kp + 18, `σmáx = ${nbr(sHi, 1)} kPa`, FS - 1, e >= 0 ? 'start' : 'end', AZUL, 'bold'));
  for (let k = 1; k < 8; k++) {
    const xx = xPe + (k / 8) * g.B * s;
    const prof = trapezio
      ? (e >= 0 ? sHi + ((sLo - sHi) * (xx - xPe)) / (g.B * s) : sLo + ((sHi - sLo) * (xx - xPe)) / (g.B * s))
      : 0;
    if (trapezio && prof * kp > 14) partes.push(seta(xx, yBase + prof * kp - 2, xx, yBase + 3, AZUL, 1));
  }
  const yRod = yBase + sHi * kp + 50;
  partes.push(texto(xPe, yRod, trapezio ? '|e| ≤ B/6 → toda comprimida' : '|e| > B/6 → parte descola', FS - 1, 'start'));
  return { svg: svgDe(partes, yRod + 14), titulo: 'Tensões no solo (excentricidade medida do centro)', largura: LARGURA };
}

// ───────────────────────────── a sapata como laje em balanço ─────────────────────────────

/*
  AS FATIAS DA PLANILHA: aba Fundação, memória no fim — 20 por balanço, colunas B (x da borda aterrada), C (σ do
  solo), D (carga líquida), E (braço até a face), F (dM) e G (dV além de d). As linhas saem do intervalo nomeado
  (T_dM, H_dM), como em cards/sapata.ts: se o gerador mudar a memória de lugar, o desenho acompanha.
*/
interface Fatia { x: number; sigma: number; q: number; braco: number; dM: number; dV: number }
function fatias(r: Resultado, intervaloDM: string): Fatia[] | null {
  const ref = (dados as unknown as { nomes: Record<string, string> }).nomes[intervaloDM];
  const m = ref ? /^(.+)!\$?[A-Z]+\$?(\d+):\$?[A-Z]+\$?(\d+)$/.exec(ref) : null;
  if (!m) return null;
  const aba = m[1], l0 = Number(m[2]), l1 = Number(m[3]);
  const out: Fatia[] = [];
  for (let l = l0; l <= l1; l++) {
    const v = ['B', 'C', 'D', 'E', 'F', 'G'].map((c) => r.cel(`${aba}!${c}${l}`));
    if (!v.every((x) => ok(x as number))) return null;
    const [x, sigma, q, braco, dM, dV] = v as number[];
    out.push({ x, sigma, q, braco, dM, dV });
  }
  return out;
}

/** O corte da sapata inteira (com o toco do muro), visto como laje: x da borda aterrada → papel, pé à esquerda. */
function sapataComoLaje(g: Geo, xPe: number, yTopo: number, s: number, hPx: number) {
  const X = (x: number) => xPe + (g.B - x) * s;
  const partes: string[] = [];
  const xFaceFora = X(g.a + g.t / 2), xFaceSolo = X(g.a - g.t / 2);
  partes.push(rect(xPe, yTopo, g.B * s, hPx, CONCRETO, TINTA, 1.4));
  // o toco do muro, interrompido: é o engaste dos dois balanços
  partes.push(rect(xFaceFora, yTopo - 46, xFaceSolo - xFaceFora, 46, BLOCO, TINTA, 1.2));
  partes.push(`<path d="M ${f2(xFaceFora - 4)} ${f2(yTopo - 46)} l 8 -5 l 6 10 l 8 -5" fill="none" stroke="${TINTA}" stroke-width="1"/>`);
  return { X, partes, xFaceFora, xFaceSolo, yBase: yTopo + hPx };
}

/**
  4. FLEXÃO DA PONTA / DO TALÃO: o balanço engastado na face do muro, com a pressão do solo empurrando para cima
  (azul) e o peso por cima (laranja: sapata, e no talão a terra e a sobrecarga; na ponta, o aterro da frente se houver).
  A diferença é a carga líquida das 20 fatias; a soma de q × Δx × braço é o Mk na face.
*/
export function desenhoDaFlexaoDaSapata(r: Resultado, lado: 'ponta' | 'talao'): DesenhoDoCard | null {
  const g = geometria(r);
  const fs = fatias(r, lado === 'ponta' ? 'T_dM' : 'H_dM');
  const Mk = r.num(lado === 'ponta' ? 'Mk_toe' : 'Mk_heel');
  const b = r.num(lado === 'ponta' ? 'toe' : 'heel');
  if (!g || !fs || !ok(Mk) || !ok(b) || !(b > 0.005)) return null;
  const ponta = lado === 'ponta';
  // peso por área sobre o balanço = σ − q (ponta, q para cima) ou q + σ (talão, q para baixo): o mesmo em toda fatia
  const peso = ponta ? fs[0].sigma - fs[0].q : fs[0].q + fs[0].sigma;
  const s = 500 / g.B;
  // os rótulos vão do lado da borda livre do balanço: à esquerda na ponta, à direita no talão
  const xPe = ponta ? 190 : 80;
  const sMax = Math.max(...fs.map((f) => f.sigma));
  const kq = 95 / Math.max(sMax, Math.abs(peso), 1e-9);   // px por kPa
  const yTopo = 30 + Math.max(peso, 0) * kq + 40;
  const hPx = Math.min(Math.max(g.h * s, 26), 56);
  const c = sapataComoLaje(g, xPe, yTopo, s, hPx);
  const partes = [...c.partes];
  const dx = (b / 20) * s;
  const xFace = ponta ? c.xFaceFora : c.xFaceSolo;
  const xLivre = ponta ? xPe : c.X(0);
  const x0 = Math.min(xFace, xLivre), x1 = Math.max(xFace, xLivre);
  // o balanço em destaque
  partes.push(rect(x0, yTopo, x1 - x0, hPx, '#fff2cc', '#bf9000', 1.2));
  // peso de cima (laranja) e pressão do solo de baixo (azul), fatia a fatia
  if (peso > 0) partes.push(rect(x0, yTopo - peso * kq, x1 - x0, peso * kq, EMPUXO, LARANJA, 0.8, ' fill-opacity="0.7"'));
  const base = c.yBase;
  const porX = fs.map((f) => ({ xx: c.X(f.x), f })).sort((u, v) => u.xx - v.xx);
  const pts: Array<[number, number]> = [[x0, base], ...porX.map(({ xx, f }): [number, number] => [xx, base + f.sigma * kq]), [x1, base]];
  partes.push(poli(pts, AZUL_CLARO, AZUL, 1));
  porX.forEach(({ xx, f }, k) => {
    if (k % 4 !== 1) return;
    if (peso * kq > 14) partes.push(seta(xx, yTopo - peso * kq + 2, xx, yTopo - 2, LARANJA, 1.2));
    if (f.sigma * kq > 14) partes.push(seta(xx, base + f.sigma * kq - 2, xx, base + 3, AZUL, 1.2));
  });
  const xRot = ponta ? x0 - 8 : x1 + 8, anc = ponta ? 'end' : 'start';
  if (peso > 0) partes.push(texto(xRot, yTopo - (peso * kq) / 2 + 5, `peso ${nbr(peso, 1)} kPa`, FS - 1, anc, LARANJA));
  const sMin = Math.min(...fs.map((f) => f.sigma));
  partes.push(texto(xRot, base + 20, `solo ${nbr(sMin, 1)} a ${nbr(sMax, 1)} kPa`, FS - 1, anc, AZUL));
  // o engaste e o momento (meia-volta em volta da face, para o lado que traciona)
  partes.push(lin(xFace, yTopo - 6, xFace, base + 6, TINTA, 2.4));
  const cy = yTopo + hPx / 2;
  const r0 = 22;
  partes.push(`<path d="M ${f2(xFace)} ${f2(cy - r0)} A ${r0} ${r0} 0 1 ${ponta ? 0 : 1} ${f2(xFace)} ${f2(cy + r0)}" fill="none" stroke="${LARANJA}" stroke-width="1.8"/>`);
  partes.push(texto(xFace + (ponta ? -30 : 30), cy + 6, 'Mk', FS, 'middle', LARANJA, 'bold'));
  // cotas: o balanço e as 20 fatias
  const yC = base + sMax * kq + 30;
  partes.push(chamada(x0, base, x0, yC + 4), chamada(x1, base, x1, yC + 4));
  partes.push(cotaH(x0, x1, yC, `${ponta ? 'ponta' : 'talão'} = ${m2(b)} m (20 fatias de ${nbr((b / 20) * 100, 2)} cm)`));
  for (let k = 1; k < 20; k++) partes.push(lin(x0 + k * dx, yTopo + hPx - 6, x0 + k * dx, yTopo + hPx, '#bf9000', 0.6));
  const yR = yC + 34;
  const sentido = ponta ? 'traciona embaixo' : 'traciona em cima';
  partes.push(texto(80, yR, `Mk na face do muro = Σ q × Δx × braço = ${m2(Mk)} kN·m/m (${sentido})`, FS, 'start', TINTA, 'bold'));
  partes.push(texto(80, yR + 20, 'sapata rígida: pressão do solo em reta', FS - 2, 'start', COTA));
  return { svg: svgDe(partes, yR + 30), titulo: `Flexão ${ponta ? 'da ponta' : 'do talão'}: balanço engastado na face do muro`, largura: LARGURA };
}

/**
  5. CORTANTE: os dois balanços com a seção de cálculo a d da face do muro (NBR 6118: a carga entre a face e d desce
  direto para o apoio). As fatias além de d, em destaque, somam o VSd/1,4 de cada lado.
*/
export function desenhoDoCortanteDaSapata(r: Resultado): DesenhoDoCard | null {
  const g = geometria(r);
  const d = r.num('d_s');
  const T = fatias(r, 'T_dM'), H = fatias(r, 'H_dM');
  if (!g || !ok(d) || !T || !H) return null;
  const s = 560 / g.B;
  const xPe = 90;
  const yTopo = 70;
  const hPx = Math.min(Math.max(g.h * s, 26), 56);
  const c = sapataComoLaje(g, xPe, yTopo, s, hPx);
  const partes = [...c.partes];
  const dPx = (d / 100) * s;
  const lados: Array<{ nome: string; fs: Fatia[]; face: number; dir: -1 | 1; Vsd: number | null; b: number | null }> = [
    { nome: 'ponta', fs: T, face: c.xFaceFora, dir: -1, Vsd: r.num('Vsd_t'), b: r.num('toe') },
    { nome: 'talão', fs: H, face: c.xFaceSolo, dir: 1, Vsd: r.num('Vsd_h'), b: r.num('heel') },
  ];
  let yTxt = c.yBase + 80;
  for (const L of lados) {
    if (!ok(L.b) || !(L.b > 0.005)) continue;
    const xd = L.face + L.dir * dPx;
    const dx = (L.b / 20) * s;
    // as fatias além de d (as que entram no VSd), em destaque
    for (const f of L.fs) {
      if (f.braco <= d / 100) continue;
      const xx = c.X(f.x);
      partes.push(rect(xx - dx / 2, yTopo, dx, hPx, '#fbe5d6', 'none', 0, ' fill-opacity="0.9"'));
    }
    partes.push(lin(xd, yTopo - 30, xd, c.yBase + 26, LARANJA, 1.6, ' stroke-dasharray="7 4"'));
    partes.push(texto(xd, yTopo - 36, 'a d da face', FS - 2, 'middle', LARANJA));
    partes.push(chamada(L.face, c.yBase, L.face, c.yBase + 34));
    partes.push(cotaH(Math.min(L.face, xd), Math.max(L.face, xd), c.yBase + 30, `d = ${nbr(d, 1)} cm`));
    if (ok(L.Vsd)) {
      partes.push(texto(xPe, yTxt, `${L.nome}: VSd = 1,4 × Σ (fatias além de d) = ${m2(L.Vsd)} kN/m`, FS - 1, 'start', TINTA, 'bold'));
      yTxt += 22;
    }
  }
  // a face do muro (o apoio dos dois balanços)
  partes.push(lin(c.xFaceFora, yTopo - 6, c.xFaceFora, c.yBase + 6, TINTA, 2.4));
  partes.push(lin(c.xFaceSolo, yTopo - 6, c.xFaceSolo, c.yBase + 6, TINTA, 2.4));
  partes.push(texto(xPe, yTxt + 4, 'em destaque: o trecho cuja carga passa pela seção a d da face', FS - 2, 'start', COTA));
  return { svg: svgDe(partes, yTxt + 16), titulo: 'Cortante: a seção a d da face do muro, nos dois balanços', largura: LARGURA };
}
