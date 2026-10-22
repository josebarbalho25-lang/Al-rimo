/*
  BARRAS — forma (polilinha do eixo, dobras já discretizadas) e comprimento desenvolvido.

  A regra da dobra é a da NBR 6118 (9.4.2.3 e Tab. 9.1), a mesma do A-PORT (trelicada/motor/dobra.js):
  pino 5φ (φ < 20) ou 8φ (φ ≥ 20) no CA-50; gancho de 90° com ponta reta de 8φ. Está repetida aqui (em mm) porque
  este app não importa do A-PORT — se a regra mudar lá, mudar aqui também.

  ESTRIBO (Jose, 15/10: "a forma exata do estribo está no Pró-Viga") — a forma é a do Pró-Viga 3D,
  proviga-3d-limpo/app/viewer3d.js, buildStirrupPoints (linhas 206–275; a mesma no ifc-writer.js, linha 147), e bate
  com o estribo do Revit dele (template "Al-rimo", elemento 338366: Ø8, sapata 1200 × 350, cobrimento 40):
    · os DOIS ganchos de 135° no MESMO canto, as pontas retas entrando na seção a 45°;
    · ponta reta 5φ ≥ 5 cm, a da NBR 6118 9.4.6.1 a) para o gancho de 135° (Jose, 15/10). O Pró-Viga usa 10φ ≥ 7 cm,
      que é a do gancho de ângulo reto (9.4.6.1 b); o Revit, 40 mm no Ø8 — o padrão dele, abaixo do mínimo da norma;
    · dobra no pino do estribo: 3φ até Ø10 (Pró-Viga: raio no eixo 2φ; Revit: pino 24 no Ø8; NBR 6118 Tab. 9.2) e,
      acima de Ø10, o pino da barra (5φ; 8φ a partir de Ø20 — Tab. 9.2, CA-50);
    · O ESTRIBO NÃO FECHA NO MESMO PLANO (regra do Jose no Pró-Viga, 09/ago): é uma volta de espiral — a barra não
      pode voltar ao lugar de onde saiu, senão o gancho bate nela mesma. A volta anda uma bitola ao longo da peça, e
      o degrau fica no ramo oposto ao primeiro (o de baixo, no Pró-Viga). O Revit desenha a volta plana.
  Aqui a volta anda ±φ/2 em torno do plano pedido (o Pró-Viga anda 0 → φ): o estribo do contraforte mora na junta
  de 10 mm e, centrado, o Ø5 cabe nela inteiro (2φ = 10 mm no canto dos ganchos).
  Duas adaptações do muro, que a viga do Pró-Viga não precisa: seção estreita encurta a ponta até caber (avisa) e a
  dobra encolhe se a seção for menor que dois raios (avisa também).
  O eixo do estribo é uma polilinha ABERTA, de uma ponta de gancho à outra (`fechada` ausente: quem desenha não
  fecha a volta) e marcada `estribo`. O comprimento é o desenvolvido de verdade — retos + arcos no raio do eixo +
  as duas pontas —, o mesmo que o IFC lê da polilinha (ifc/geometria.ts, eixoDaBarra).
*/
import type { Barra, Familia, PapelBarra, Vec3 } from '@/modelo/tipos';
import { arred } from './perfis';

/** Barra comercial: emenda por traspasse a cada 12 m. */
export const BARRA_COMERCIAL = 12000;
const SEG_DOBRA = 4;

export const pino = (phi: number): number => (phi >= 20 ? 8 : 5) * phi;
export const raioDoEixo = (phi: number): number => pino(phi) / 2 + phi / 2;
export const pontaGancho90 = (phi: number): number => 8 * phi;
/** Ponta reta do gancho de 135° do estribo, NBR 6118 9.4.6.1 a): 5φ ≥ 5 cm. Mais curta (seção apertada) avisa. */
export const ganchoEstribo = (phi: number): number => Math.max(5 * phi, 50);
/** Pino de dobra do estribo (NBR 6118 Tab. 9.2, CA-50): 3φ até Ø10; acima, o da barra. */
export const pinoEstribo = (phi: number): number => (phi <= 10 ? 3 * phi : pino(phi));
export const raioDoEstribo = (phi: number): number => pinoEstribo(phi) / 2 + phi / 2;

const p3 = (x: number, y: number, z: number): Vec3 => [arred(x), arred(y), arred(z)];

export interface BarraNova {
  id: string;
  papel: PapelBarra;
  diametro: number;
  eixo: Vec3[];
  fechada?: boolean;
  estribo?: boolean;
  comprimento: number;
  trecho: number;
  contraforte?: number;
}

export function reta(id: string, papel: PapelBarra, phi: number, a: Vec3, b: Vec3, trecho: number, contraforte?: number): BarraNova {
  const c = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const out: BarraNova = { id, papel, diametro: phi, eixo: [p3(...a), p3(...b)], comprimento: arred(c), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/**
 * Espera: sobe de zPe até zTopo em (x, y); com gancho, dobra 90° no pé apontando para `sentidoY` (±1).
 * zPe = cota do EIXO do trecho horizontal do gancho (apoiado na malha da sapata).
 */
export function espera(id: string, phi: number, x: number, y: number, zPe: number, zTopo: number, gancho: boolean, sentidoY: 1 | -1, trecho: number, contraforte?: number): BarraNova {
  if (!gancho) return reta(id, 'ESPERA', phi, [x, y, zTopo], [x, y, zPe], trecho, contraforte);
  const R = raioDoEixo(phi);
  const ponta = pontaGancho90(phi);
  const eixo: Vec3[] = [p3(x, y, zTopo), p3(x, y, zPe + R)];
  const cy = y + sentidoY * R;
  const cz = zPe + R;
  for (let k = 1; k <= SEG_DOBRA; k++) {
    const f = (k / SEG_DOBRA) * (Math.PI / 2);
    eixo.push(p3(x, cy - sentidoY * R * Math.cos(f), cz - R * Math.sin(f)));
  }
  eixo.push(p3(x, cy + sentidoY * ponta, zPe));
  const comprimento = zTopo - (zPe + R) + (Math.PI / 2) * R + ponta;
  const out: BarraNova = { id, papel: 'ESPERA', diametro: phi, eixo, comprimento: arred(comprimento), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/*
  NÓ DE CACHORRO (arranque = 'Nó de cachorro', Jose 15/10) — a forma do Revit dele (template "Al-rimo", sapata
  1200 × 350, cobrimento 40, muro de bloco 19 na borda da sapata; amostras Ø10 337807, Ø16 337808, Ø20 337806):
  a espera desce do muro até o cobrimento de BAIXO (eixo a c + φ/2 do fundo), vira 180° para a FRENTE (o pé) em duas
  dobras de 90° — sem reto entre elas (o desenho dele tem 5 a 9 mm, não é regra) —, sobe reta até o cobrimento de
  CIMA (eixo a c + φ/2 do topo), dobra 90° e corre deitada por cima, de volta por cima do muro, até a face da ponta
  do talão (a c + φ/2 dela), e desce essa face até o cobrimento de baixo. Toda dobra no pino da barra (5φ; 8φ a
  partir de Ø20): raio no eixo 30 no Ø10, 48 no Ø16, 90 no Ø20; a subida reta é (h − 2c − φ) − 2r — 200, 158 e 70 na
  sapata de 35 cm dele.
  O limite da curvatura (Jose: "a dobra nó de cachorro tem limites pela curvatura do aço"): subida ≥ 0, ou seja,
  h ≥ 2c + pino + 2φ. Abaixo disso a barra não existe — o gerador não desenha a espera e avisa.
  A perna deitada passa por cima da que desce (é o "nó"): a mesma barra não pode ocupar o lugar de onde saiu (a
  regra do estribo, acima), então a subida anda uma bitola ao longo do muro (`lado`) e a perna deitada passa ao lado
  da que desce. No Revit a forma é plana e as duas se cruzam no desenho.
  A planilha (h_dobra() do build_new.py) ainda escolhe as bitolas da espera pela dobra do Padrão (com a malha da
  sapata embaixo): para o nó, a régua é a desta função, sem a malha.
*/

/** A sapata para o nó (mm): altura, cobrimento e as faces da frente (y do pé) e da ponta do talão. */
export interface SapataDoNo { h: number; c: number; yFrente: number; yTalao: number }

/** Raio da dobra no eixo e a subida reta entre o U e a perna de cima (negativa = a dobra não cabe na altura). */
export function medidasDoNo(phi: number, h: number, c: number): { raio: number; subida: number } {
  const raio = raioDoEixo(phi);
  return { raio, subida: h - 2 * c - phi - 2 * raio };
}

/**
 * A espera em nó de cachorro na posição (x, y) do furo, do topo zTopo (o traspasse) até a sapata. null = não cabe:
 * a subida é negativa (sapata baixa para a dobra) ou a ponta da sapata não comporta as duas dobras do pé.
 *
 * Desde 15/10 o nó VAI ATÉ A PONTA (Jose: "quando usar nó de cachorro quero que ela vá até a ponta"): da espera ele
 * dobra para a frente e corre pelo fundo até a face da ponta da sapata, sobe essa face, volta deitado por cima de
 * tudo até a ponta do talão e desce — abraça a sapata inteira. No Revit dele a sapata não tinha pé (o muro na borda)
 * e o U ficava colado na espera; com pé, o U colado deixava a ponta sem o nó. Sem pé suficiente para as duas dobras
 * (fundo reto < 0), não cabe — é a tabela de pontas dele (PONTA_DO_NO), que avisa antes.
 * A conta não conta o nó (Jose, 15/10: "deixa quieto essa parte de contabilizar ela no cálculo"): é armação de
 * confiança da ligação muro–sapata, por cima do estribo da sapata.
 * O nó dobra para −Y (a frente), a perna deitada corre para +Y (o talão); `lado` (±1) é para onde a subida anda
 * em X — a perna deitada passa por cima da que desce, e a barra não volta ao lugar de onde saiu.
 */
export function esperaNoDeCachorro(id: string, phi: number, x: number, y: number, zTopo: number, sap: SapataDoNo, trecho: number, contraforte?: number, lado: 1 | -1 = 1): BarraNova | null {
  const { raio: r, subida } = medidasDoNo(phi, sap.h, sap.c);
  const zb = -sap.h + sap.c + phi / 2;        // eixo da perna do fundo e do pé das pernas de pé
  const zt = -sap.c - phi / 2;                // eixo da perna deitada de cima
  const yp = sap.yFrente + sap.c + phi / 2;   // a perna que sobe, na face da ponta da sapata
  const yf = sap.yTalao - sap.c - phi / 2;    // a perna que desce, na face da ponta do talão
  const fundo = (y - r) - (yp + r);           // reto do fundo, da espera à ponta
  const deitada = (yf - r) - (yp + r);        // reto de cima, da ponta ao talão
  if (subida < -1e-6 || fundo < -1e-6 || deitada < -1e-6) return null;
  const s = lado * phi;
  const P = (yy: number, z: number, dx: number): Vec3 => p3(x + dx, yy, z);
  const arco = (cy: number, cz: number, f: (t: number) => [number, number], dx: number): Vec3[] =>
    Array.from({ length: SEG_DOBRA }, (_, k) => {
      const t = ((k + 1) / SEG_DOBRA) * (Math.PI / 2);
      const [dy, dz] = f(t);
      return P(cy + dy, cz + dz, dx);
    });
  const eixo: Vec3[] = [P(y, zTopo, 0), P(y, zb + r, 0)];
  // dobra do pé da espera para a frente, o fundo até a ponta e a dobra para cima na face da ponta
  eixo.push(...arco(y - r, zb + r, (t) => [r * Math.cos(t), -r * Math.sin(t)], 0));
  eixo.push(P(yp + r, zb, 0));
  eixo.push(...arco(yp + r, zb + r, (t) => [-r * Math.sin(t), -r * Math.cos(t)], 0));
  // a subida na face da ponta (andando `lado`·φ em X) e a dobra para a perna deitada
  eixo.push(P(yp, zt - r, s));
  eixo.push(...arco(yp + r, zt - r, (t) => [-r * Math.cos(t), r * Math.sin(t)], s));
  // a perna deitada até a ponta do talão e a dobra para baixo
  eixo.push(P(yf - r, zt, s));
  eixo.push(...arco(yf - r, zt - r, (t) => [r * Math.sin(t), r * Math.cos(t)], s));
  eixo.push(P(yf, zb, s));
  const limpo = eixo.filter((q, k) => k === 0 || Math.hypot(q[0] - eixo[k - 1][0], q[1] - eixo[k - 1][1], q[2] - eixo[k - 1][2]) > 1e-6);
  // desenvolvido: a perna do muro, quatro dobras de 90° (2·π·r), o fundo, a subida, a deitada e a perna do talão
  const comprimento = (zTopo - zb - r) + 2 * Math.PI * r + fundo + Math.hypot(Math.max(0, subida), s) + deitada + (zt - r - zb);
  const out: BarraNova = { id, papel: 'ESPERA', diametro: phi, eixo: limpo, comprimento: arred(comprimento), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/*
  A PONTA DA SAPATA (o pé, na frente da face do muro) que o U do nó pede, em mm, pela bitola (Jose, 15/10). Bloco 14,
  cobrimento 4 cm: Ø5, 6,3 e 8 → 0 (o pé pode facear o muro: "até 8 mm conseguimos armar um muro com blocos de 14 com
  a ponta faceando o muro"); Ø10 e 12,5 → 4 cm; Ø16 e 20 → 7 cm; Ø25 não dá (a emenda no furo de 117 cm² passa de
  8 %: 2 × 4,91 / 117 = 8,4 %). Bloco 19: "seguindo a mesma lógica, as barras de 16 e 20 mm vão precisar no mínimo
  de 2 cm de ponta pra fora do muro; se facear não consegue alojar essa dobra" — até Ø12,5 → 0.
  A lógica que liga as duas tabelas: a largura que o nó pede, medida da face de trás do muro, é a mesma em qualquer
  bloco — 14 + ponta do bloco 14 (18 cm no Ø10–12,5, 21 cm no Ø16–20) —, e a ponta é o que passa da espessura do
  bloco (21 − 19 = 2 cm). O Ø25 no bloco 19 NÃO foi dado (A CONFIRMAR COM O JOSE): a largura do Ø20 (21 cm) mais o
  que o U cresce do Ø20 para o Ø25 (pino + 2φ: 20 → 25 cm, +5 cm) = 26 cm → ponta de 26 − 19 = 7 cm. No furo do
  bloco 19 (170 cm², catalogo.ts) a emenda dá 2 × 4,91 / 170 = 5,8 % (< 8 %).
  null = a bitola não cabe no bloco (avisa); bitola acima da tabela = sem regra (não avisa).
*/
export const PONTA_DO_NO: Readonly<Record<Familia['nome'], readonly { ate: number; ponta: number | null; aConfirmar?: true }[]>> = {
  '14x39': [{ ate: 8, ponta: 0 }, { ate: 12.5, ponta: 40 }, { ate: 20, ponta: 70 }, { ate: 25, ponta: null }],
  '19x39': [{ ate: 12.5, ponta: 0 }, { ate: 20, ponta: 20 }, { ate: 25, ponta: 70, aConfirmar: true }],
};

/** A ponta que o nó pede para a bitola no bloco (tabela acima); undefined = bitola fora da tabela. */
export function pontaDoNo(familia: Familia['nome'], phi: number): { ponta: number | null; aConfirmar: boolean } | undefined {
  const l = PONTA_DO_NO[familia].find((q) => phi <= q.ate + 1e-9);
  return l ? { ponta: l.ponta, aConfirmar: !!l.aConfirmar } : undefined;
}

/**
 * Barra dobrada a 90° num plano horizontal (z do 1º vértice): `vertices` são os cantos do EIXO (o encontro dos eixos
 * de dois trechos retos), da ponta à ponta; cada canto vira uma dobra no pino da NBR. Serve ao U da canaleta entre
 * dois contrafortes (perna, base, perna). Comprimento desenvolvido: os retos menos 2R por dobra, mais o arco (π/2)·R.
 */
export function dobrada(id: string, papel: PapelBarra, phi: number, vertices: Vec3[], trecho: number, contraforte?: number): BarraNova {
  const R = raioDoEixo(phi);
  const z = vertices[0][2];
  const eixo: Vec3[] = [p3(vertices[0][0], vertices[0][1], z)];
  let retos = 0;
  for (let i = 1; i < vertices.length; i++) retos += Math.hypot(vertices[i][0] - vertices[i - 1][0], vertices[i][1] - vertices[i - 1][1]);
  for (let i = 1; i + 1 < vertices.length; i++) {
    const [a, v, b] = [vertices[i - 1], vertices[i], vertices[i + 1]];
    const L1 = Math.hypot(v[0] - a[0], v[1] - a[1]);
    const L2 = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const d1: [number, number] = [(v[0] - a[0]) / L1, (v[1] - a[1]) / L1];
    const d2: [number, number] = [(b[0] - v[0]) / L2, (b[1] - v[1]) / L2];
    // centro da dobra: recua R no trecho que chega e anda R para o lado do que sai
    const c: [number, number] = [v[0] - d1[0] * R + d2[0] * R, v[1] - d1[1] * R + d2[1] * R];
    for (let k = 0; k <= SEG_DOBRA; k++) {
      const f = (k / SEG_DOBRA) * (Math.PI / 2);
      eixo.push(p3(c[0] - d2[0] * R * Math.cos(f) + d1[0] * R * Math.sin(f), c[1] - d2[1] * R * Math.cos(f) + d1[1] * R * Math.sin(f), z));
    }
  }
  const fim = vertices[vertices.length - 1];
  eixo.push(p3(fim[0], fim[1], z));
  const dobras = vertices.length - 2;
  const comprimento = retos - 2 * R * dobras + (Math.PI / 2) * R * dobras;
  const out: BarraNova = { id, papel, diametro: phi, eixo, comprimento: arred(comprimento), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/** O que a seção deixa o estribo ter: raio da dobra no eixo e ponta reta do gancho (mm). */
export interface MedidasDoEstribo {
  raio: number;
  ponta: number;
  /** A seção é menor que dois raios do pino da NBR: a dobra foi apertada (aviso). */
  dobraApertada: boolean;
  /** A ponta não chega ao mínimo da NBR para o gancho de 135° (5φ ≥ 5 cm) (aviso). */
  pontaCurta: boolean;
}

const S45 = Math.SQRT1_2;

/**
 * O estribo de lados a × b (de eixo a eixo dos ramos) e Ø phi. A ponta de cada gancho sai do canto a 45° para dentro
 * da seção; ela vai até 5φ ≥ 5 cm se couber e, se não, até encostar no ramo do outro lado (a ponta da barra para
 * uma bitola antes do eixo dele: a superfície encosta, não atravessa).
 */
export function medidasDoEstribo(phi: number, a: number, b: number): MedidasDoEstribo {
  const nbr = raioDoEstribo(phi);
  const raio = Math.max(0, Math.min(nbr, (a - 1) / 2, (b - 1) / 2));
  // ponta do 1º gancho: (1 − s)·r + s·L ao longo do 1º ramo, (1 + s)·r + s·L ao longo do outro (e o 2º, espelhado)
  const cabe = (Math.min(a, b) - phi - (1 + S45) * raio) / S45;
  const ponta = Math.max(0, Math.min(ganchoEstribo(phi), cabe));
  return { raio, ponta, dobraApertada: raio < nbr - 0.01, pontaCurta: ponta < ganchoEstribo(phi) - 0.01 };
}

/** Pontos de um arco de `de` a `ate` (rad) amostrado a cada ≤ 22,5° — a mesma corda das dobras de 90° (SEG_DOBRA). */
function arco(f: (t: number) => Vec3, de: number, ate: number): Vec3[] {
  const n = Math.max(1, Math.round((Math.abs(ate - de) / (Math.PI / 2)) * SEG_DOBRA));
  const out: Vec3[] = [];
  for (let k = 0; k <= n; k++) out.push(f(de + ((ate - de) * k) / n));
  return out;
}

/**
 * Estribo fechado com os ganchos de 135° (forma do Pró-Viga — cabeçalho deste arquivo). `cantos`: os 4 cantos do
 * retângulo do EIXO (cruzamento dos eixos dos ramos), em ordem; o 1º é o canto dos ganchos e o ramo 1º → 2º é o
 * primeiro depois do gancho. O degrau da volta (uma bitola, `passo`) fica no ramo 3º → 4º, o oposto ao primeiro.
 */
export function estribo(id: string, papel: PapelBarra, phi: number, cantos: [Vec3, Vec3, Vec3, Vec3], trecho: number, contraforte?: number, passo = phi): BarraNova {
  const [c0, c1, , c3] = cantos;
  const du: Vec3 = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
  const dw: Vec3 = [c3[0] - c0[0], c3[1] - c0[1], c3[2] - c0[2]];
  const a = Math.hypot(...du);
  const b = Math.hypot(...dw);
  const u = du.map((q) => q / a) as Vec3;
  const w = dw.map((q) => q / b) as Vec3;
  const nn: Vec3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const ln = Math.hypot(...nn) || 1;
  const n = nn.map((q) => q / ln) as Vec3;
  const { raio: r, ponta: L } = medidasDoEstribo(phi, a, b);

  // (x ao longo do 1º ramo, y ao longo do outro, h = quanto a volta já andou na normal)
  const P = (x: number, y: number, h: number): Vec3 => p3(
    c0[0] + x * u[0] + y * w[0] + h * n[0], c0[1] + x * u[1] + y * w[1] + h * n[1], c0[2] + x * u[2] + y * w[2] + h * n[2],
  );
  const hA = -passo / 2;
  const hB = passo / 2;
  // canto dos ganchos: ângulo 0 no ramo 4º → 1º (x = 0), π/2 no ramo 1º → 2º (y = 0)
  const canto0 = (h: number) => (t: number): Vec3 => P(r - r * Math.cos(t), r - r * Math.sin(t), h);

  const eixo: Vec3[] = [];
  // 1º gancho: a ponta, a dobra de 135° (de −45° a 90°) e o 1º ramo
  eixo.push(P((1 - S45) * r + S45 * L, (1 + S45) * r + S45 * L, hA));
  eixo.push(...arco(canto0(hA), -Math.PI / 4, Math.PI / 2));
  // 2º canto (x = a, y = 0) e 3º (x = a, y = b)
  eixo.push(...arco((t) => P(a - r + r * Math.sin(t), r - r * Math.cos(t), hA), 0, Math.PI / 2));
  eixo.push(...arco((t) => P(a - r + r * Math.cos(t), b - r + r * Math.sin(t), hA), 0, Math.PI / 2));
  // o degrau da volta: o ramo do 3º ao 4º canto anda `passo` na normal
  eixo.push(...arco((t) => P(r - r * Math.sin(t), b - r + r * Math.cos(t), hB), 0, Math.PI / 2));
  // de volta ao canto dos ganchos pelo ramo 4º → 1º: a dobra de 135° (de 0° a 135°) e a ponta do 2º gancho
  eixo.push(...arco(canto0(hB), 0, (3 * Math.PI) / 4));
  eixo.push(P((1 + S45) * r + S45 * L, (1 - S45) * r + S45 * L, hB));

  // sem ponto repetido (ramo de comprimento zero quando a seção tem só dois raios)
  const limpo = eixo.filter((q, k) => k === 0 || Math.hypot(q[0] - eixo[k - 1][0], q[1] - eixo[k - 1][1], q[2] - eixo[k - 1][2]) > 1e-6);
  // desenvolvido: as duas pontas, os retos e os arcos no raio do eixo (2 × 135° + 3 × 90° = 3π·r)
  const reto = (q: number) => Math.max(0, q - 2 * r);
  const comprimento = 2 * L + 3 * Math.PI * r + reto(a) + 2 * reto(b) + Math.hypot(reto(a), passo);
  const out: BarraNova = { id, papel, diametro: phi, eixo: limpo, estribo: true, comprimento: arred(comprimento), trecho };
  if (contraforte !== undefined) out.contraforte = contraforte;
  return out;
}

/**
 * Corrida longa (horizontal da canaleta, longitudinal da sapata) quebrada em barras comerciais com traspasse.
 * As barras emendadas se alternam lado a lado (desloca `lado` de φ) para não ocuparem o mesmo lugar.
 */
export function corrida(
  idBase: string, papel: PapelBarra, phi: number, x0: number, x1: number, y: number, z: number,
  traspasse: number, lado: Vec3, trecho: number,
): BarraNova[] {
  const out: BarraNova[] = [];
  const L = x1 - x0;
  if (L <= BARRA_COMERCIAL) return [reta(idBase + '1', papel, phi, [x0, y, z], [x1, y, z], trecho)];
  // n barras de comprimento igual: n·c − (n−1)·l0 = L, c ≤ 12 m
  const n = Math.ceil((L - traspasse) / (BARRA_COMERCIAL - traspasse));
  const c = (L + (n - 1) * traspasse) / n;
  for (let k = 0; k < n; k++) {
    const a = x0 + k * (c - traspasse);
    const d = k % 2 ? 1 : 0;
    out.push(reta(idBase + (k + 1), papel, phi, [a, y + d * lado[1], z + d * lado[2]], [a + c, y + d * lado[1], z + d * lado[2]], trecho));
  }
  return out;
}

/** Posições a cada ≤ s entre a e b (inclusive), igualmente espaçadas. */
export function distribuir(a: number, b: number, s: number): number[] {
  if (b - a <= 1e-6) return [a];
  const n = Math.max(1, Math.ceil((b - a) / s - 1e-6));
  return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
}

/*
  As 8 simetrias do quadrado no plano XY (giros de 90° e espelhos). A barra é a mesma peça de aço virada: o L da
  canaleta do contraforte da ponta direita é o da esquerda espelhado, a espera com o gancho para o solo é a do gancho
  para a frente girada. Na prancha de armação é UMA posição — a forma não depende de para onde a barra aponta. Não
  há barra torcida no espaço (que o espelho trocaria por outra) — todas são planas ou retas.
*/
const SIMETRIAS: ((x: number, y: number) => [number, number])[] = [
  (x, y) => [x, y], (x, y) => [-y, x], (x, y) => [-x, -y], (x, y) => [y, -x],
  (x, y) => [-x, y], (x, y) => [x, -y], (x, y) => [y, x], (x, y) => [-y, -x],
];

/** A forma da barra sem a orientação: a menor das leituras (8 simetrias × os dois sentidos do eixo). */
function formaDaBarra(eixo: Vec3[], fechada: boolean): string {
  const r = (v: number): number => Math.round(v) || 0;
  let melhor: string | null = null;
  for (const s of fechada ? [eixo] : [eixo, [...eixo].reverse()]) {
    const o = s[0];
    for (const T of SIMETRIAS) {
      const k = s.map((q) => {
        const [x, y] = T(q[0] - o[0], q[1] - o[1]);
        return `${r(x)},${r(y)},${r(q[2] - o[2])}`;
      }).join(';');
      if (melhor === null || k < melhor) melhor = k;
    }
  }
  return melhor ?? '';
}

/**
 * N1, N2... — mesma forma, mesmo Ø e mesmo comprimento = mesma posição da lista de ferros, de QUALQUER elemento
 * (Jose, 15/10): o armador corta e dobra por posição, e a vertical do painel igual à construtiva do contraforte é a
 * mesma barra no feixe. Até 15/10 o papel entrava na chave e a mesma barra saía com dois N.
 */
export function numerarPosicoes(barras: BarraNova[]): Barra[] {
  const mapa = new Map<string, string>();
  return barras.map((b) => {
    const forma = formaDaBarra(b.eixo, !!b.fechada);
    const chave = `${b.diametro}|${b.fechada ? 'F' : b.estribo ? 'E' : ''}|${Math.round(b.comprimento)}|${forma}`;
    let pos = mapa.get(chave);
    if (!pos) {
      pos = `N${mapa.size + 1}`;
      mapa.set(chave, pos);
    }
    const out: Barra = { id: b.id, posicao: pos, papel: b.papel, diametro: b.diametro, eixo: b.eixo, comprimento: b.comprimento, trecho: b.trecho };
    if (b.fechada) out.fechada = true;
    if (b.estribo) out.estribo = true;
    if (b.contraforte !== undefined) out.contraforte = b.contraforte;
    return out;
  });
}
