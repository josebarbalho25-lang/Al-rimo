/*
  ISOMÉTRICO — axonometria isométrica das peças, em SVG. Terreno omitido.

  Ordem de pintura (algoritmo do pintor) SEM chute de profundidade: as peças são caixas alinhadas aos eixos que
  não se interpenetram, e para duas caixas disjuntas dá para decidir EXATAMENTE quem tapa quem — as sombras das
  duas na tela só se cruzam se existir λ com (ponto de A) − (ponto de B) = λ·v (v aponta para quem olha); o sinal
  de λ diz quem está na frente. Com essas relações monta-se um grafo e ordena-se (Kahn). Ordenar só pela
  profundidade do centro erra com peça comprida (a sapata, a canaleta) ao lado de peça curta.

  O graute não entra como peça (está DENTRO do bloco: as caixas se interpenetram e o pintor não decide): aparece
  como a cor do furo na tampa do bloco e enchendo a canaleta. Com corte, a face cortada é pintada por último —
  nenhuma peça que sobrou pode tapá-la (todas ficam do lado oposto a quem olha) — com o graute e as barras.

  Cada bloco vai na cor do tipo (cores.ts — as cores do Jose no Revit), com legenda, como no 3D. O sombreamento
  das faces é brando nos blocos (fator de 0,8 a 1): escurecer o amarelo da canaleta até 60%, como no concreto,
  dá verde-oliva, e o código de cores deixa de valer justo na face que mais aparece.
*/
import type { Modelo, Vec3 } from '@/modelo/tipos';
import { metros } from './formato';
import {
  ALVENARIA, CANALETA, ESPECIAL, ehCostura, escalar, facesDoSolido, fatiarEmZ, recortarEmX, secao, solidosDoModelo,
  type Solido,
} from './geometria';
import { barrasNoCorte, estiloDaSecao } from './corteLateral';
import { desenharLegenda, itensDasTintas, tintaDaPeca, tintasPresentes } from './cores';
import { COR, Prancha, type OpcoesDaVista, type Pt } from './prancha';
import { aparece, corDoAcoNoDesenho, hachuraDe, pecaAparece } from './graficos';

export type VistaIso = 'frente-direita' | 'frente-esquerda' | 'fundo-direita' | 'fundo-esquerda';

/** As opções da prancha (S, semTitulo, prefixo) vêm junto: com S dado, a `largura` não manda. */
export interface OpcoesIso extends OpcoesDaVista {
  vista?: VistaIso;
  /** Corta o muro no plano X = corteX e tira a parte que fica do lado de quem olha. null/undefined = sem corte. */
  corteX?: number | null;
  /** Largura alvo do desenho, px. */
  largura?: number;
}

/** Camada do DXF da peça do isométrico: a cor sombreada da face não diz o material, a peça diz. */
function camadaDaPeca(s: Solido): string {
  if (s.peca.tipo === 'SAPATA') return 'concreto';
  if (s.peca.tipo === 'DRENO') return 'drenagem';
  return 'alvenaria';
}

const TIPOS_ISO = new Set<Solido['peca']['tipo']>([...ALVENARIA, 'SAPATA', 'DRENO']);

export function sentido(vista: VistaIso): { ax: number; ay: number } {
  return { ax: vista.endsWith('direita') ? 1 : -1, ay: vista.startsWith('frente') ? -1 : 1 };
}

/** Câmera ortográfica isométrica: v aponta para o observador; (direita, cima) são os eixos da tela. */
export function camera(vista: VistaIso) {
  const { ax, ay } = sentido(vista);
  const k = 1 / Math.sqrt(3);
  const v: Vec3 = [ax * k, ay * k, k];
  const d: Vec3 = [-v[0], -v[1], -v[2]];
  const dir = (() => {
    const r: Vec3 = [d[1], -d[0], 0];
    const l = Math.hypot(r[0], r[1]);
    return [r[0] / l, r[1] / l, 0] as Vec3;
  })();
  const zd = escalar([0, 0, 1], d);
  const c0: Vec3 = [-zd * d[0], -zd * d[1], 1 - zd * d[2]];
  const lc = Math.hypot(...c0);
  const cima: Vec3 = [c0[0] / lc, c0[1] / lc, c0[2] / lc];
  const luz = (() => {
    const l: Vec3 = [0.3 * ax, 0.6 * ay, 1];
    const n = Math.hypot(...l);
    return [l[0] / n, l[1] / n, l[2] / n] as Vec3;
  })();
  return { v, dir, cima, luz };
}

/**
 * Quem está na frente, para duas caixas: +1 = A tapa B, −1 = B tapa A, 0 = as sombras não se cruzam.
 * Encolhe 0,05 mm de cada lado: peças que só se tocam (junta zero, face com face) não criam relação.
 */
export function quemNaFrente(a: Solido, b: Solido, v: Vec3): number {
  let lo = -Infinity, hi = Infinity;
  for (let k = 0; k < 3; k++) {
    const dmin = a.min[k] - b.max[k] + 0.05;
    const dmax = a.max[k] - b.min[k] - 0.05;
    if (dmin > dmax) return 0;
    if (Math.abs(v[k]) < 1e-12) {
      if (dmin > 0 || dmax < 0) return 0;
      continue;
    }
    let l1 = dmin / v[k], l2 = dmax / v[k];
    if (l1 > l2) [l1, l2] = [l2, l1];
    lo = Math.max(lo, l1);
    hi = Math.min(hi, l2);
    if (lo > hi) return 0;
  }
  const meio = (lo + hi) / 2;
  return meio > 0 ? 1 : meio < 0 ? -1 : 0;
}

/** Ordem de pintura (do fundo para a frente). */
export function ordemDePintura(sol: Solido[], v: Vec3, proj: (p: Vec3) => Pt): Solido[] {
  const n = sol.length;
  const caixa2d = sol.map((s) => {
    let x0 = Infinity, x1 = -Infinity;
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) {
      const [x] = proj([i ? s.max[0] : s.min[0], j ? s.max[1] : s.min[1], k ? s.max[2] : s.min[2]]);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    return [x0, x1];
  });
  const prof = sol.map((s) => escalar([(s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2], v));
  const idx = [...sol.keys()].sort((a, b) => caixa2d[a][0] - caixa2d[b][0]);
  const depois: number[][] = sol.map(() => []);   // i → quem vem depois de i
  const grau = new Array(n).fill(0);
  for (let p = 0; p < n; p++) {
    const i = idx[p];
    for (let q = p + 1; q < n; q++) {
      const j = idx[q];
      if (caixa2d[j][0] > caixa2d[i][1]) break;      // varredura: daqui para a frente ninguém cruza com i na tela
      const r = quemNaFrente(sol[i], sol[j], v);
      if (r > 0) { depois[j].push(i); grau[i]++; }
      else if (r < 0) { depois[i].push(j); grau[j]++; }
    }
  }
  // Kahn com fila por profundidade (o mais fundo primeiro); ciclo (não deveria haver) é quebrado pelo mais fundo
  const feito = new Array(n).fill(false);
  const out: Solido[] = [];
  const prontos = [...sol.keys()].filter((i) => grau[i] === 0);
  while (out.length < n) {
    if (!prontos.length) {
      let melhor = -1;
      for (let i = 0; i < n; i++) if (!feito[i] && (melhor < 0 || prof[i] < prof[melhor])) melhor = i;
      prontos.push(melhor);
      grau[melhor] = 0;
    }
    let kmin = 0;
    for (let k = 1; k < prontos.length; k++) if (prof[prontos[k]] < prof[prontos[kmin]]) kmin = k;
    const i = prontos.splice(kmin, 1)[0];
    if (feito[i]) continue;
    feito[i] = true;
    out.push(sol[i]);
    for (const j of depois[i]) if (!feito[j] && --grau[j] === 0) prontos.push(j);
  }
  return out;
}

/** A cor da peça antes da luz (a vista 3D em vetor, vista3d.ts, pinta o estilo Cores com esta mesma). */
export function corBase(s: Solido): string {
  const tinta = tintaDaPeca(s);
  if (tinta) return tinta.cor;
  if (ESPECIAL.has(s.peca.tipo)) return COR.especialFundo;
  // sapata e dreno no fundo da hachura deles (tabela de gráficos — 15/10)
  if (s.peca.tipo === 'SAPATA') return hachuraDe('concreto').fundo;
  if (s.peca.tipo === 'DRENO') return hachuraDe('brita').fundo;
  return COR.blocoFundo;
}

export function sombrear(hex: string, f: number): string {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
}

/**
 * As caixas que o pintor ordena: alvenaria, sapata e dreno, já recortadas pelo corte (se houver) e com o
 * dreno fatiado por fiada (ver fatiarEmZ). Exportada para o teste conferir a ordem com o modelo de verdade.
 */
export function pecasDoIsometrico(todos: Solido[], corte: number | null, manterMenor: boolean): Solido[] {
  let pecas = todos.filter((s) => TIPOS_ISO.has(s.peca.tipo) && pecaAparece('iso', s.peca.tipo));
  if (corte !== null) pecas = pecas.map((s) => recortarEmX(s, corte, manterMenor)).filter((s): s is Solido => !!s);
  return pecas.flatMap((s) => (s.peca.tipo === 'DRENO' ? fatiarEmZ(s, 200) : [s]));
}

export function desenharIsometrico(m: Modelo, o: OpcoesIso = {}): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  const vista = o.vista ?? 'frente-direita';
  const { v, dir, cima, luz } = camera(vista);
  const { ax } = sentido(vista);
  const manterMenor = ax > 0;     // quem olha do lado +X vê a face cortada se fica a parte x ≤ corte
  const todos = solidosDoModelo(m).filter((s) => s.peca.grupo !== 'terreno');
  const corte = o.corteX ?? null;
  const pecas = pecasDoIsometrico(todos, corte, manterMenor);

  // escala: a maior dimensão projetada vira ~`largura` px
  const P0 = (p: Vec3): Pt => [escalar(p, dir), -escalar(p, cima)];
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  for (const s of pecas) for (const p of [...s.base, ...s.topo]) {
    const [a, b] = P0(p);
    u0 = Math.min(u0, a); u1 = Math.max(u1, a); w0 = Math.min(w0, b); w1 = Math.max(w1, b);
  }
  const ext = Math.max(u1 - u0, (w1 - w0) * 1.3, 1);
  // na prancha a escala vem pedida: a isometria não encurta as medidas ao longo dos eixos (fator 0,816 sobre o
  // verdadeiro, como toda isometria ortográfica), então "1:50" aqui é a escala da projeção, não a do muro medido
  const S = o.S ?? Math.min(0.6, Math.max(0.04, (o.largura ?? 1000) / ext));
  const P = (p: Vec3): Pt => {
    const [a, b] = P0(p);
    return [a * S, b * S];
  };

  const comGraute = aparece('iso', 'graute');
  const grauteCanaleta = comGraute ? todos.filter((s) => s.peca.tipo === 'GRAUTE_CANALETA') : [];
  const gFundo = hachuraDe('graute').fundo;
  const gRisco = hachuraDe('graute').risco;
  const ordem = ordemDePintura(pecas, v, P);

  // cada barbacã vai com o bloco da parede em que está (o centro do tubo dentro da caixa do bloco)
  const tubos = new Map<Solido, Solido[]>();
  for (const b of aparece('iso', 'drenagem') ? todos.filter((q) => q.peca.tipo === 'BARBACA' && q.eixo === 'Y') : []) {
    const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const bloco = ordem.find((s) => ALVENARIA.has(s.peca.tipo) && [0, 1, 2].every((k) => s.min[k] < c[k] && c[k] < s.max[k]));
    if (bloco) tubos.set(bloco, [...(tubos.get(bloco) ?? []), b]);
  }

  pr.abrir('data-camada="pecas"');
  for (const s of ordem) {
    const base = corBase(s);
    const alv = ALVENARIA.has(s.peca.tipo);
    // traço escuro também no bloco: o cinza do inteiro (#787878) engoliria o #5f5f5f de antes
    const traco = alv ? '#2e2e2e' : '#404040';
    const camada = camadaDaPeca(s);
    const faces = facesDoSolido(s)
      .filter((f) => escalar(f.normal, v) > 1e-6)
      .map((f) => ({ f, prof: escalar(f.pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as Vec3, [0, 0, 0] as Vec3), v) / f.pts.length }))
      .sort((a, b) => a.prof - b.prof);
    for (const { f } of faces) {
      const luzDaFace = Math.max(0, escalar(f.normal, luz));
      const fator = alv ? Math.min(1, 0.8 + 0.25 * luzDaFace) : 0.6 + 0.4 * luzDaFace;
      const cor = sombrear(base, fator);
      if (!s.costuras) {
        pr.poligono(f.pts.map(P), { fill: cor, stroke: traco, sw: alv ? 0.4 : 0.6, id: s.peca.id, camada });
      } else {
        // fatia: a costura não pode aparecer. A face no plano do corte é interna (a fatia de cima senta nela) e
        // não é pintada — o tom mais claro dela vazaria pela fresta; nas outras, o contorno na cor da face cobre
        // a fresta do antisserrilhado, e só as arestas da peça original levam traço
        if (f.pts.every((p, k) => ehCostura(s, p, f.pts[(k + 1) % f.pts.length]))) continue;
        pr.poligono(f.pts.map(P), { fill: cor, stroke: cor, sw: 0.6, id: s.peca.id, camada });
        f.pts.forEach((p, k) => {
          const q = f.pts[(k + 1) % f.pts.length];
          if (ehCostura(s, p, q)) return;
          const [a, b] = [P(p), P(q)];
          pr.linha(a[0], a[1], b[0], b[1], { stroke: traco, sw: 0.6, camada });
        });
      }
      // furo visto na tampa: azul de graute se a peça diz que o furo é grauteado; escuro se é vazio
      if (f.tampa && f.furos.length) {
        const gr = new Set(comGraute ? (s.peca.furosGrauteados ?? []) : []);
        f.furos.forEach((furo, k) => {
          pr.poligono(furo.map(P), { fill: gr.has(k) ? sombrear(gFundo, fator) : COR.furoEscuro, stroke: traco, sw: 0.3, camada: gr.has(k) ? 'graute' : camada });
        });
      }
    }
    // canaleta: o graute que a enche, visto por cima (a tampa do graute, só no trecho desta canaleta)
    if (CANALETA.has(s.peca.tipo)) {
      for (const g of grauteCanaleta) {
        const xa = Math.max(g.min[0], s.min[0]), xb = Math.min(g.max[0], s.max[0]);
        if (xb - xa < 1 || g.min[2] < s.min[2] - 1 || g.max[2] > s.max[2] + 1 || g.min[1] < s.min[1] - 1 || g.max[1] > s.max[1] + 1) continue;
        const z = g.max[2];
        const quad: Vec3[] = [[xa, g.min[1], z], [xb, g.min[1], z], [xb, g.max[1], z], [xa, g.max[1], z]];
        pr.poligono(quad.map(P), { fill: sombrear(gFundo, 0.6 + 0.4 * luz[2]), stroke: gRisco, sw: 0.3, camada: 'graute' });
        // na ponta da corrida (ponta do trecho ou corte) o graute aparece de topo, enchendo o U da canaleta
        const xf = ax > 0 ? s.max[0] : s.min[0];
        if (Math.abs((ax > 0 ? xb : xa) - xf) < 1) {
          const tampa: Vec3[] = [[xf, g.min[1], g.min[2]], [xf, g.max[1], g.min[2]], [xf, g.max[1], z], [xf, g.min[1], z]];
          pr.poligono(tampa.map(P), { fill: sombrear(gFundo, 0.6 + 0.4 * Math.abs(luz[0])), stroke: gRisco, sw: 0.3, camada: 'graute' });
        }
      }
    }
    // barbacã: o tubo atravessa o bloco (as caixas se interpenetram, o pintor não decide), então a boca do tubo
    // é pintada logo depois do bloco que a contém — quem tapa o bloco tapa a boca também
    for (const b of tubos.get(s) ?? []) {
      const yFace = v[1] < 0 ? b.min[1] : b.max[1];
      const boca = [b.base, b.topo].reduce((m, l) => (Math.abs(l[0][1] - yFace) < Math.abs(m[0][1] - yFace) ? l : m));
      pr.poligono(boca.map(P), { fill: COR.furoEscuro, stroke: traco, sw: 0.4, id: b.peca.id, camada: 'drenagem' });
    }
  }
  pr.fechar();

  // ── face cortada ──────────────────────────────────────────────────────────────────────────────────────────────
  if (corte !== null) {
    pr.abrir('data-camada="corte"');
    const P3 = (yz: [number, number]): Pt => P([corte, yz[0], yz[1]]);
    const cortados = todos
      .map((s) => ({ s, r: secao(s, 'X', corte) }))
      .filter((q) => q.r.length && q.s.peca.tipo !== 'BARBACA' && pecaAparece('iso', q.s.peca.tipo))
      .sort((a, b) => (GRAUTE_DEPOIS(a.s) ? 1 : 0) - (GRAUTE_DEPOIS(b.s) ? 1 : 0));
    for (const { s, r } of cortados) {
      const e = estiloDaSecao(s, pr);
      if (!e) continue;
      for (const q of r) pr.caminho([q.contorno, ...q.furos].map((a) => a.map(P3)), { ...e, sw: 0.6, id: s.peca.id });
    }
    const br = aparece('iso', 'armadura') ? barrasNoCorte(m, corte) : { linhas: [], pontos: [] };
    for (const l of br.linhas) pr.polilinha((l.fechada ? [...l.pts, l.pts[0]] : l.pts).map(P3), { stroke: corDoAcoNoDesenho(), sw: Math.max(0.8, l.barra.diametro * S), id: l.barra.id });
    for (const p of br.pontos) {
      const [a, b] = P3(p.p);
      pr.circulo(a, b, Math.max(1.2, (p.barra.diametro / 2) * S), { id: p.barra.id });
    }
    pr.fechar();
  }

  // título acima e legenda abaixo de tudo o que foi desenhado
  const { viewBox } = pr.partes(0);
  if (!o.semLegendaDeCores && aparece('iso', 'legenda')) desenharLegenda(pr, viewBox[0], viewBox[1] + viewBox[3] + 28, itensDasTintas(tintasPresentes(pecas)), Math.max(320, viewBox[2]));
  // na prancha o título é dela (embaixo do desenho); o PROVISÓRIO fica, é aviso e não título
  const titulo = corte !== null ? `Isométrico — corte em x = ${metros(corte)} m` : 'Isométrico';
  if (!o.semTitulo) pr.texto(viewBox[0], viewBox[1] - 14, titulo, { tam: 15, ancora: 'start', negrito: true });
  if (m.familia.provisoria && m.dims.contrafortes.length) {
    const x = viewBox[0] + (o.semTitulo ? 0 : Prancha.largura(titulo, 15, true) + 16);
    pr.texto(x, viewBox[1] - 14, 'PROVISÓRIO', { tam: 13, ancora: 'start', negrito: true, cor: COR.especial });
  }
  return pr;
}

const GRAUTE_DEPOIS = (s: Solido) => s.peca.tipo === 'GRAUTE_FURO' || s.peca.tipo === 'GRAUTE_CANALETA';

export function isometrico(m: Modelo, o: OpcoesIso = {}): string {
  return desenharIsometrico(m, o).svg();
}
