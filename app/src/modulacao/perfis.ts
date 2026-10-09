/*
  PERFIS E A REGRA DE POSICIONAMENTO — o que as frentes que LEEM o Modelo (3D, IFC, desenhos, quantitativo)
  precisam saber para pôr cada peça no lugar. Use `paraGlobal`/`caixaGlobal` daqui em vez de reescrever a conta:
  se cada um girasse a peça do seu jeito, cada um mostraria um muro diferente.

  COORDENADAS LOCAIS DE UMA GEOMETRIA (origem no canto mínimo, tudo ≥ 0):
    eixo 'Z': perfil (u, v) = (x, y) local, extrusão w = z local   → blocos (planta com furos), graute de furo.
    eixo 'X': perfil (u, v) = (y, z) local, extrusão w = x local   → canaleta, graute de canaleta, sapata, dreno,
                                                                     manta, terreno, barbacã.
    eixo 'Y': perfil (u, v) = (x, z) local, extrusão w = y local   → (não usado hoje; definido para completar).
  PEÇA NO MUNDO: gira em torno de Z por `giro` (anti-horário visto de cima: 90° leva +x local para +Y global) e
  translada de modo que o canto mínimo da CAIXA GIRADA caia em `origem`:
    global = origem + R(giro)·local − min(R(giro)·caixaLocal).
*/
import type { Geometria, Peca, Vec2, Vec3 } from '@/modelo/tipos';

/** Segmentos por quarto de círculo nos cantos dos furos. */
export const SEG_QUARTO = 6;
/**
 * Área que os 4 cantos arredondados (polígono inscrito, SEG_QUARTO segmentos cada) tiram do retângulo, por r².
 * Com isso a área do POLÍGONO (o que o 3D e o IFC desenham) bate exata com o Ag da aula — e não só a do círculo.
 */
export const C_CANTOS = 4 - 2 * SEG_QUARTO * Math.sin(Math.PI / (2 * SEG_QUARTO));

/** Furo: l ao longo da peça, w na largura, r raio dos cantos. */
export interface Furo { l: number; w: number; r: number }

/**
 * O furo do bloco inteiro com a área de graute da tabela da aula (só peça sem modelo no Revit — hoje nenhuma: as
 * famílias desenham o furo medido, catalogo.ts). Parte do retângulo da Fig. 2
 * (w = t − 2hf, l = (L − 3hf)/2) e arredonda os cantos até a área bater — com hf e Ag da tabela da aula dá
 * meia-lua nos blocos de 14 e r ≈ 11 mm no 19 [MEDIDO, brief §0.4]. Se a área pedida não cabe nem como
 * retângulo nem como meia-lua, o furo encolhe até bater. DEDUÇÃO.
 */
export function calibrarFuro(t: number, L: number, hf: number, ag: number): Furo {
  const w0 = t - 2 * hf;
  const l0 = (L - 3 * hf) / 2;
  if (w0 <= 0 || l0 <= 0 || ag <= 0) return { l: Math.max(l0, 1), w: Math.max(w0, 1), r: 0 };
  if (w0 * l0 <= ag) return { l: ag / w0, w: w0, r: 0 };
  const r = Math.sqrt((w0 * l0 - ag) / C_CANTOS);
  if (r <= w0 / 2 + 1e-9 && r <= l0 / 2 + 1e-9) return { l: l0, w: w0, r: Math.min(r, w0 / 2, l0 / 2) };
  // meia-lua (r = w/2) com l menor
  const lM = (ag + (C_CANTOS * w0 * w0) / 4) / w0;
  if (lM >= w0) return { l: lM, w: w0, r: w0 / 2 };
  // círculo de área ag
  const R = Math.sqrt(ag / (2 * SEG_QUARTO * Math.sin(Math.PI / (2 * SEG_QUARTO))));
  return { l: 2 * R, w: 2 * R, r: R };
}

export const areaDoFuro = (f: Furo): number => f.l * f.w - f.r * f.r * C_CANTOS;

/**
 * Raio dos cantos de n furos retangulares (soma das áreas dos retângulos `somaRet`) para que a área desenhada
 * (polígono) dê `area` — a do bloco do Revit, que informa o volume mas não o raio.
 */
export function raioPelaArea(somaRet: number, area: number, n: number): number {
  const perda = somaRet - area;
  return perda > 0 && n > 0 ? Math.sqrt(perda / (n * C_CANTOS)) : 0;
}

/**
 * Seção da canaleta no plano (y, z): o U (anti-horário) e o miolo que leva graute (anti-horário), com os dois cantos
 * do fundo arredondados por dentro (raio r; 0 = canto vivo). O miolo é exatamente o vazio do U.
 */
export function secaoDaCanaleta(t: number, h: number, parede: number, fundo: number, r: number): { U: Vec2[]; miolo: Vec2[] } {
  const arco = (cx: number, cy: number, a0: number, a1: number): Vec2[] => {
    if (r <= 1e-9) return [[cx, cy]];
    const pts: Vec2[] = [];
    for (let k = 0; k <= SEG_QUARTO; k++) {
      const a = a0 + ((a1 - a0) * k) / SEG_QUARTO;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  // canto direito do fundo (centro do arco em t − p − r, f + r) e canto esquerdo (p + r, f + r)
  const dirDesce = r > 1e-9 ? arco(t - parede - r, fundo + r, 0, -Math.PI / 2) : [[t - parede, fundo] as Vec2];
  const esqDesce = r > 1e-9 ? arco(parede + r, fundo + r, -Math.PI / 2, -Math.PI) : [[parede, fundo] as Vec2];
  const limpa = (p: Vec2[]): Vec2[] => semRepetidos(p.map(([x, y]) => [arred(x), arred(y)] as Vec2));
  const U = limpa([[0, 0], [t, 0], [t, h], [t - parede, h], ...dirDesce, ...esqDesce, [parede, h], [0, h]]);
  const miolo = limpa([...[...esqDesce].reverse(), ...[...dirDesce].reverse(), [t - parede, h], [parede, h]]);
  return { U, miolo };
}

/** Retângulo arredondado [x0, x0+l] × [y0, y0+w], anti-horário (ou horário, para furo). */
export function retanguloArredondado(l: number, w: number, r: number, x0 = 0, y0 = 0, horario = false): Vec2[] {
  const pts: Vec2[] = [];
  if (r <= 1e-9) {
    pts.push([x0, y0], [x0 + l, y0], [x0 + l, y0 + w], [x0, y0 + w]);
  } else {
    const cantos: [number, number, number][] = [
      [x0 + l - r, y0 + r, -Math.PI / 2],
      [x0 + l - r, y0 + w - r, 0],
      [x0 + r, y0 + w - r, Math.PI / 2],
      [x0 + r, y0 + r, Math.PI],
    ];
    for (const [cx, cy, a0] of cantos) {
      for (let k = 0; k <= SEG_QUARTO; k++) {
        const a = a0 + (k * Math.PI) / 2 / SEG_QUARTO;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
  }
  const limpo = semRepetidos(pts.map(([x, y]) => [arred(x), arred(y)] as Vec2));
  return horario ? limpo.reverse() : limpo;
}

/** Arredonda a 1e-6 mm: o JSON fica estável e igual entre chamadas. */
export const arred = (x: number): number => Math.round(x * 1e6) / 1e6;

function semRepetidos(p: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const q of p) {
    const u = out[out.length - 1];
    if (!u || Math.abs(u[0] - q[0]) > 1e-6 || Math.abs(u[1] - q[1]) > 1e-6) out.push(q);
  }
  const a = out[0];
  const b = out[out.length - 1];
  if (out.length > 1 && Math.abs(a[0] - b[0]) <= 1e-6 && Math.abs(a[1] - b[1]) <= 1e-6) out.pop();
  return out;
}

/** Área com sinal (positiva = anti-horário). */
export function areaPoligono(p: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function volumeDoPerfil(contorno: Vec2[], furos: Vec2[][] | undefined, extensao: number): number {
  let a = Math.abs(areaPoligono(contorno));
  for (const f of furos ?? []) a -= Math.abs(areaPoligono(f));
  return a * extensao;
}

/** Monta uma Geometria de prisma; o perfil é deslocado para o canto mínimo ficar em (0, 0). */
export function prisma(chave: string, eixo: Geometria['eixo'], contorno: Vec2[], extensao: number, furos?: Vec2[][], catalogo?: string): Geometria {
  let umin = Infinity;
  let vmin = Infinity;
  for (const [u, v] of contorno) {
    umin = Math.min(umin, u);
    vmin = Math.min(vmin, v);
  }
  const des = (p: Vec2[]): Vec2[] => p.map(([u, v]) => [arred(u - umin), arred(v - vmin)] as Vec2);
  const c = des(contorno);
  const fs = furos?.map(des);
  const g: Geometria = { chave, eixo, perfil: fs && fs.length ? { contorno: c, furos: fs } : { contorno: c }, extensao, volume_mm3: arred(volumeDoPerfil(c, fs, extensao)) };
  if (catalogo) g.catalogo = catalogo;
  return g;
}

export function retangulo(l: number, w: number): Vec2[] {
  return [[0, 0], [l, 0], [l, w], [0, w]];
}

/** Círculo como polígono inscrito (4·SEG_QUARTO lados), na caixa [0, d]². */
export function circulo(d: number): Vec2[] {
  return retanguloArredondado(d, d, d / 2);
}

// ── posicionamento ────────────────────────────────────────────────────────────

export function girar(giro: Peca['giro'], [x, y, z]: Vec3): Vec3 {
  switch (giro) {
    case 90: return [-y, x, z];
    case 180: return [-x, -y, z];
    case 270: return [y, -x, z];
    default: return [x, y, z];
  }
}

/** Ponto do perfil (u, v) na extrusão w → coordenada local (x, y, z). */
export function localDoPerfil(eixo: Geometria['eixo'], u: number, v: number, w: number): Vec3 {
  if (eixo === 'Z') return [u, v, w];
  if (eixo === 'X') return [w, u, v];
  return [u, w, v];
}

/** Caixa local da geometria (o canto mínimo é a origem). */
export function caixaLocal(g: Geometria): { min: Vec3; max: Vec3 } {
  let U = 0;
  let V = 0;
  for (const [u, v] of g.perfil.contorno) {
    U = Math.max(U, u);
    V = Math.max(V, v);
  }
  return { min: [0, 0, 0], max: localDoPerfil(g.eixo, U, V, g.extensao) };
}

function deslocamento(p: Peca, g: Geometria): Vec3 {
  const c = caixaLocal(g);
  const a = girar(p.giro, c.max);
  return [Math.min(0, a[0]), Math.min(0, a[1]), Math.min(0, a[2])];
}

/** Ponto em coordenadas locais da geometria → mundo (mm). */
export function paraGlobal(p: Peca, g: Geometria, local: Vec3): Vec3 {
  const r = girar(p.giro, local);
  const d = deslocamento(p, g);
  return [p.origem[0] + r[0] - d[0], p.origem[1] + r[1] - d[1], p.origem[2] + r[2] - d[2]];
}

/** Caixa envolvente da peça no mundo (mm). `min` = `origem`. */
export function caixaGlobal(p: Peca, g: Geometria): { min: Vec3; max: Vec3 } {
  const c = caixaLocal(g);
  const a = girar(p.giro, c.max);
  const tam: Vec3 = [Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2])];
  return { min: [...p.origem] as Vec3, max: [p.origem[0] + tam[0], p.origem[1] + tam[1], p.origem[2] + tam[2]] };
}

/**
 * Distância com sinal de um ponto (no plano do furo, relativo ao CENTRO) à borda do retângulo arredondado
 * de meias-medidas a, b e raio r. Negativo = dentro. (SDF de caixa arredondada.)
 */
export function distanciaAoFuro(px: number, py: number, a: number, b: number, r: number): number {
  const qx = Math.abs(px) - (a - r);
  const qy = Math.abs(py) - (b - r);
  const fora = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return fora + Math.min(Math.max(qx, qy), 0) - r;
}
