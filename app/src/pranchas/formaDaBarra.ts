/*
  A FORMA DA BARRA NA LISTA DE FERROS (Jose, 15/10) — os trechos retos da barra no plano dela, com a medida de cada
  um em cm, para o desenho ao lado da linha da tabela: é o que o armador dobra.

  A barra do modelo vem com as dobras discretizadas no raio do pino (modelo/tipos.ts): os pedaços curtos do arco
  não são trecho. Fica trecho o pedaço reto com mais de 3φ (e 2 cm); a medida vai de vértice a vértice — o
  cruzamento dos eixos dos trechos vizinhos, a medida de eixo das tabelas de dobra. O comprimento de corte continua
  o desenvolvido (C=), que desconta a dobra; a soma dos trechos dá um pouco mais, como em toda prancha de armação.
  Estribo é o retângulo do eixo dos ramos, com as quatro medidas; os ganchos de 135° entram só no C. É o costume da
  tabela de ferros (a do Pró-Viga nem desenha a forma: estribo é marca, Ø e C). Desde 15/10 o estribo do modelo vem
  com a forma de verdade (modulacao/barras.ts: ganchos, dobras e a volta em espiral, polilinha aberta marcada
  `estribo`): o retângulo sai da caixa dos pontos no plano dos ramos — as pontas dos ganchos ficam dentro dela.
*/
import type { Barra, Vec3 } from '@/modelo/tipos';

export interface FormaDaBarra {
  /** Vértices no plano da barra, cm, com o trecho mais comprido deitado (eixo u). */
  pontos: [number, number][];
  /** Medida de cada trecho, cm (inteira): pontos[i] → pontos[i + 1] (fechada: o último volta ao primeiro). */
  trechos: number[];
  fechada: boolean;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const n = norma(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

interface Trecho { a: Vec3; b: Vec3; d: Vec3; L: number }

/** O ponto em que os eixos de dois trechos (coplanares) se cruzam; paralelos: o fim do primeiro. */
function cruzamento(p: Trecho, q: Trecho): Vec3 {
  // p.a + s·p.d = q.a + t·q.d, por mínimos quadrados
  const w = sub(p.a, q.a);
  const b = dot(p.d, q.d);
  const den = 1 - b * b;
  if (Math.abs(den) < 1e-9) return p.b;
  const s = (b * dot(q.d, w) - dot(p.d, w)) / den;
  return [p.a[0] + s * p.d[0], p.a[1] + s * p.d[1], p.a[2] + s * p.d[2]];
}

/** Os pedaços retos da polilinha, os seguidos na mesma direção juntos (os da dobra são curtos). */
function pedacosRetos(pts: Vec3[], fechada: boolean): Trecho[] {
  const pedacos: Trecho[] = [];
  const n = fechada ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, c] = [pts[i], pts[(i + 1) % pts.length]];
    const L = norma(sub(c, a));
    if (L < 1e-6) continue;
    const d = unit(sub(c, a));
    const u = pedacos[pedacos.length - 1];
    if (u && dot(u.d, d) > Math.cos((1 * Math.PI) / 180)) {
      u.b = c;
      u.L = norma(sub(c, u.a));
    } else pedacos.push({ a, b: c, d, L });
  }
  return pedacos;
}

/**
 * O estribo de ganchos (Barra.estribo): o retângulo do eixo dos ramos. Os dois lados vêm do ramo mais comprido e do
 * mais comprido perpendicular a ele; a caixa de todos os pontos nessas duas direções é o retângulo — os arcos não
 * passam do eixo dos ramos e as pontas dos ganchos ficam dentro. O degrau da volta (uma bitola na normal) some na
 * projeção. null = a polilinha não tem dois ramos perpendiculares (não é estribo).
 */
function retanguloDoEstribo(pts: Vec3[]): FormaDaBarra | null {
  const retos = pedacosRetos(pts, false).sort((x, y) => y.L - x.L);
  const e1 = retos[0]?.d;
  const outro = e1 && retos.find((t) => Math.abs(dot(t.d, e1)) < 0.1);
  if (!e1 || !outro) return null;
  const e2 = unit(sub(outro.d, [e1[0] * dot(outro.d, e1), e1[1] * dot(outro.d, e1), e1[2] * dot(outro.d, e1)]));
  const us = pts.map((p) => dot(p, e1) / 10);
  const vs = pts.map((p) => dot(p, e2) / 10);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const [W, H] = [u1 - u0, v1 - v0];
  return {
    pontos: [[0, 0], [W, 0], [W, H], [0, H]],
    trechos: [Math.round(W), Math.round(H), Math.round(W), Math.round(H)],
    fechada: true,
  };
}

export function formaDaBarra(b: Pick<Barra, 'eixo' | 'diametro' | 'fechada' | 'comprimento'> & Pick<Partial<Barra>, 'estribo'>): FormaDaBarra {
  const fechada = !!b.fechada;
  const reta = (): FormaDaBarra => ({ pontos: [[0, 0], [b.comprimento / 10, 0]], trechos: [Math.round(b.comprimento / 10)], fechada: false });
  const pts = b.eixo;
  if (pts.length < 2) return reta();
  if (b.estribo) {
    const r = retanguloDoEstribo(pts);
    if (r) return r;
  }

  const pedacos = pedacosRetos(pts, fechada);
  const limiar = Math.max(3 * b.diametro, 20);
  const trechos = fechada ? pedacos : pedacos.filter((t) => t.L >= limiar);
  if (trechos.length <= 1) return reta();

  // vértices: as pontas livres e o cruzamento dos vizinhos
  const v: Vec3[] = [];
  if (fechada) for (let i = 0; i < trechos.length; i++) v.push(cruzamento(trechos[(i + trechos.length - 1) % trechos.length], trechos[i]));
  else {
    v.push(trechos[0].a);
    for (let i = 1; i < trechos.length; i++) {
      const [p, q] = [trechos[i - 1], trechos[i]];
      if (dot(p.d, q.d) > -0.99) {
        v.push(cruzamento(p, q));
        continue;
      }
      // Volta de 180° (o U do nó de cachorro, dois arcos sem reta entre eles): os ramos são paralelos e não se
      // cruzam. O fundo do U vira trecho — do ramo que desce ao que sobe, no ponto mais fundo do arco —, com a
      // largura entre os eixos dos ramos, como a cota B da forma do Revit do Jose (15/10)
      const i0 = pts.indexOf(p.b);
      const i1 = pts.indexOf(q.a);
      const arco = i0 >= 0 && i1 >= i0 ? pts.slice(i0, i1 + 1) : [p.b, q.a];
      const fundo = arco.reduce((m, x) => (dot(sub(x, p.b), p.d) > dot(sub(m, p.b), p.d) ? x : m));
      const noRamo = (t: Trecho): Vec3 => {
        const k = dot(sub(fundo, t.a), t.d);
        return [t.a[0] + k * t.d[0], t.a[1] + k * t.d[1], t.a[2] + k * t.d[2]];
      };
      v.push(noRamo(p), noRamo(q));
    }
    v.push(trechos[trechos.length - 1].b);
  }

  // o plano: u ao longo do trecho mais comprido, v no plano dos outros
  const longo = trechos.reduce((x, y) => (y.L > x.L ? y : x));
  // o plano sai do trecho MAIS perpendicular ao maior: o ramo do nó de cachorro que sobe anda um φ de lado (a barra
  // não volta sobre si mesma) e, quase paralelo ao do muro, dava um plano torto e a forma saía embaralhada
  const outro = trechos.reduce((x, y) => (Math.abs(dot(y.d, longo.d)) < Math.abs(dot(x.d, longo.d)) ? y : x));
  const nrm = unit(cross(longo.d, outro.d));
  const eu = longo.d;
  const ev = norma(nrm) > 0.5 ? cross(nrm, eu) : ([0, 0, 1] as Vec3);
  const o = v[0];
  const pontos = v.map((p): [number, number] => [dot(sub(p, o), eu) / 10, dot(sub(p, o), ev) / 10]);
  const medidas: number[] = [];
  const m = fechada ? pontos.length : pontos.length - 1;
  for (let i = 0; i < m; i++) {
    const [p, q] = [pontos[i], pontos[(i + 1) % pontos.length]];
    medidas.push(Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])));
  }
  return { pontos, trechos: medidas, fechada };
}
