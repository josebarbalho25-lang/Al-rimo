/*
  ARMAÇÃO DO PILARETE (Jose, 15/11: "planta e armação do pilarete na prancha — isso é importante") — a prancha que o
  armador leva para montar o pilarete do muro de cima e a ligação dele com o arrimo. Na língua da armação da sapata
  (armacaoDaSapata.ts) e da armação de pilar do Pró-Viga:
    · ELEVAÇÃO de um pilarete, do pé do traspasse dentro do arrimo até o topo: as longitudinais (de frente as duas
      faces caem na mesma linha), um traço em cada estribo, o arrimo embaixo em traço fino (é onde as barras descem
      ℓ0t no graute), o tijolo e as cintas dos lados cortados na janela, com as barras da cinta que cruzam ou acabam
      nele — reta ou com o gancho, como a conta adotou (modulacao/muroDeCima.ts, comGancho). À direita, a FAIXA dos
      estribos ("N7 – 26 Ø5 c/12", em pé, como a faixa da sapata deitada) e as cotas do traspasse e da altura;
    · SEÇÃO do pilarete (planta na meia altura de uma fiada de tijolo): o contorno, o tijolo dos dois lados, o arrimo
      embaixo tracejado, o estribo com a forma de verdade (ganchos de 135°), as barras como ponto e o cobrimento;
    · SOMBRAS: a longitudinal em pé na altura de verdade, com a legenda em pé (a do corte, corteLateral.ts); a sombra
      do estribo embaixo da seção, com as medidas da lista de ferros; e as barras da cinta numa fileira embaixo de tudo,
      com o miolo encurtado (a barra corre o trecho inteiro: em 1:20 um muro de 6 m daria 30 cm de papel) — as pontas,
      onde estão o gancho e a medida, de verdade, e o C da legenda o desenvolvido inteiro.
  PILARETES DIFERENTES: o da ponta recebe a ponta da cinta (e o gancho), o de cima do contraforte pode ter a barra que
  não desce na haste, o primeiro tem o estribo girado — cada TIPO diferente sai uma vez, com os nomes e quantos são
  ("P1, P4 — 2 un."). Os nomes P1, P2… contam da esquerda para a direita, no muro todo.

  Só existe com muro de cima: sem pilarete a vista sai vazia (e o navegador não a oferece).
*/
import type { Barra, Modelo, Vec2, Vec3 } from '@/modelo/tipos';
import { cm } from './formato';
import { ALVENARIA, cruzamentos, faixa, projecao, projetarPontos, secao, solidosDoModelo, type Solido } from './geometria';
import { COR, Prancha, escalaPara, type OpcoesDaVista, type Pt } from './prancha';
import { espacamentoDaPosicao, textoDaChamada, textoDoEspacamento } from './chamadas';
import { estiloDaSecao } from './corteLateral';
import { aparece, corDoAcoNoDesenho, naVista } from './graficos';
import { CAMADA_DA_SOMBRA, FILEIRA, LEGENDA_FORA, T, escreverMedidas, grossa, medidasDasPernas } from './sombras';

/** Quanto de muro de cima (e de arrimo) se vê de cada lado do pilarete, mm. */
const JANELA = 250;
/** Abaixo do pé das barras, o arrimo ainda desenhado, mm. */
const ABAIXO_DO_PE = 120;
/** De uma parte à outra (elevação, seção, sombras, o tipo seguinte), px. */
const ENTRE_PARTES = 60;
const ENTRE_TIPOS = 110;
/** As pontas da barra da cinta que a sombra mostra de verdade (o miolo encolhe), mm; e o miolo encolhido, px. */
const PONTA_DA_CINTA = 450;
const MIOLO = 70;

const bitola = (phi: number): string => `Ø${String(Math.round(phi * 10) / 10).replace('.', ',')}`;
const ordemDoN = (a: string, b: string): number => a.localeCompare(b, 'pt-BR', { numeric: true });

/** Um pilarete do modelo: a peça, o nome na prancha e as barras dele (pelo id: `T1.MC.P01.La1`, `T1.MC.P01.E03`). */
export interface PilareteDoDesenho {
  solido: Solido;
  nome: string;
  longs: Barra[];
  estribos: Barra[];
  /** As barras da cinta que acabam dentro dele (o pilarete da ponta: reta ou gancho). */
  pontasDaCinta: Barra[];
}

/** Um TIPO de pilarete: os iguais juntos (mesmas barras no mesmo lugar, mesma ponta de cinta). */
export interface TipoDePilarete {
  pilaretes: PilareteDoDesenho[];
  /** O que se desenha: o primeiro deles. */
  rep: PilareteDoDesenho;
}

const xMeio = (s: Solido): number => (s.min[0] + s.max[0]) / 2;

/** Os pilaretes do modelo, da esquerda para a direita, com o nome e as barras de cada um. */
export function pilaretesDoModelo(m: Modelo): PilareteDoDesenho[] {
  const sol = solidosDoModelo(m).filter((s) => s.peca.tipo === 'PILARETE').sort((a, b) => a.min[0] - b.min[0]);
  const cintas = m.barras.filter((b) => b.papel === 'CINTA_MC');
  return sol.map((s, k) => {
    const pre = `${s.peca.id}.`;
    const dentro = (x: number) => x > s.min[0] - 0.5 && x < s.max[0] + 0.5;
    return {
      solido: s,
      nome: `P${k + 1}`,
      longs: m.barras.filter((b) => b.papel === 'PIL_LONG' && b.id.startsWith(pre)),
      estribos: m.barras.filter((b) => b.papel === 'PIL_ESTRIBO' && b.id.startsWith(pre)),
      pontasDaCinta: cintas.filter((b) => {
        if (b.trecho !== s.peca.trecho) return false;
        const [a, c] = faixa(b.eixo, 0);
        return dentro(a) || dentro(c);
      }),
    };
  });
}

/** A assinatura do pilarete: o que muda de um para outro na obra (as barras relativas ao eixo dele). */
function assinatura(p: PilareteDoDesenho): string {
  const xc = xMeio(p.solido);
  const r = (v: number) => Math.round(v);
  const geo = `${r(p.solido.max[0] - p.solido.min[0])}x${r(p.solido.max[1] - p.solido.min[1])}x${r(p.solido.max[2] - p.solido.min[2])}|${p.solido.geo.catalogo ?? ''}`;
  const longs = p.longs.map((b) => `${b.posicao}:${r(b.eixo[0][0] - xc)},${r(b.eixo[0][1])},${r(faixa(b.eixo, 2)[0])},${r(faixa(b.eixo, 2)[1])}`).sort();
  const est = p.estribos.map((b) => `${b.posicao}:${r(faixa(b.eixo, 2)[0])},${r(b.eixo[0][0] - xc)},${r(b.eixo[0][1])}`).sort();
  const cin = p.pontasDaCinta.map((b) => {
    const [a] = faixa(b.eixo, 0);
    return `${b.posicao}:${a > p.solido.min[0] - 0.5 && a < p.solido.max[0] + 0.5 ? 'e' : 'd'}:${r(b.eixo[0][1])}`;
  }).sort();
  return [geo, ...longs, '|', ...est, '|', ...cin].join(';');
}

/** Os tipos de pilarete, na ordem do primeiro de cada um. */
export function tiposDePilarete(m: Modelo): TipoDePilarete[] {
  const grupos = new Map<string, PilareteDoDesenho[]>();
  for (const p of pilaretesDoModelo(m)) {
    const k = assinatura(p);
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.values()].map((ps) => ({ pilaretes: ps, rep: ps[0] }));
}

/** "P1, P4 — 2 un." (com muitos, o primeiro e o último: "P2 a P9 — 8 un."). */
export function nomeDoTipo(t: TipoDePilarete): string {
  const ns = t.pilaretes.map((p) => p.nome);
  const lista = ns.length > 4 ? `${ns[0]} a ${ns[ns.length - 1]}` : ns.join(', ');
  return `${lista} — ${ns.length} un.`;
}

/** A polilinha cortada pela faixa xa ≤ x ≤ xb (o pedaço da barra da cinta que cai na janela da elevação). */
function recortarEmX(pts: Vec2[], xa: number, xb: number): Vec2[][] {
  const out: Vec2[][] = [];
  let atual: Vec2[] = [];
  const dentro = (p: Vec2) => p[0] >= xa - 1e-6 && p[0] <= xb + 1e-6;
  const corte = (p: Vec2, q: Vec2, x: number): Vec2 => [x, p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0] || 1)];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0) {
      const q = pts[i - 1];
      for (const x of [xa, xb]) if ((q[0] - x) * (p[0] - x) < 0) atual.push(corte(q, p, x));
    }
    if (dentro(p)) atual.push(p);
    else if (atual.length) {
      if (atual.length > 1) out.push(atual);
      atual = [];
    }
  }
  if (atual.length > 1) out.push(atual);
  return out;
}

/** `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha (paraPrancha.ts). */
export function desenharArmacaoDoPilarete(m: Modelo, o: OpcoesDaVista = {}): Prancha {
  return naVista('pilarete', () => pilareteNaVista(m, o), o.graficos);
}

function pilareteNaVista(m: Modelo, o: OpcoesDaVista): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  pr.ajustar(o.anotacoes, o.S);
  const mc = m.dims.muroDeCima;
  const tipos = tiposDePilarete(m);
  if (!mc || !tipos.length) return pr;
  const cotasAcesas = aparece('pilarete', 'cotas');
  const alvenaria = aparece('pilarete', 'blocos');
  const aco = corDoAcoNoDesenho();
  const sol = solidosDoModelo(m);
  const Z0 = mc.z0;
  const zPeMin = Math.min(...tipos.flatMap((t) => t.rep.longs.map((b) => faixa(b.eixo, 2)[0])), Z0);
  const zBase = zPeMin - ABAIXO_DO_PE;
  // na tela, o pilarete do pé do traspasse ao topo cabe na altura; na prancha a escala vem pedida
  const S = o.S ?? escalaPara(1.25 * (mc.z1 - zBase), 700, 0.05, 0.6);
  const Y = (z: number) => -z * S;
  const fina = (phi: number) => Math.max(0.9, phi * S);

  let ox = 0;                 // onde começa o tipo, px
  let fundo = Y(zBase);       // o mais baixo desenhado até aqui (as sombras da cinta vão embaixo)

  tipos.forEach((tipo, i) => {
    const p = tipo.rep;
    const s = p.solido;
    const [xw0, xw1] = [s.min[0] - JANELA, s.max[0] + JANELA];
    const X = (x: number) => ox + (x - xw0) * S;
    const tr = s.peca.trecho;

    // ── nome do tipo ────────────────────────────────────────────────────────────────────────────────────────────
    pr.texto(X(xw0), Y(mc.z1) - 34, nomeDoTipo(tipo), { tam: 13, ancora: 'start', negrito: true, chave: `pilarete:tipo:${i}` });

    // ── elevação: o arrimo embaixo, o muro de cima e as cintas dos lados, o pilarete ────────────────────────────
    pr.abrir('data-camada="alvenaria"');
    if (alvenaria) {
      // o arrimo: a face na janela, as juntas das fiadas em traço fino, cortado embaixo e dos lados (tracejado)
      pr.linha(X(xw0), Y(Z0), X(xw1), Y(Z0), { stroke: COR.linha, sw: 0.7, camada: 'alvenaria' });
      for (let z = Z0 - 200; z > zBase; z -= 200) pr.linha(X(xw0), Y(z), X(xw1), Y(z), { stroke: COR.linha, sw: 0.3, camada: 'alvenaria' });
      for (const x of [xw0, xw1]) pr.linha(X(x), Y(Z0), X(x), Y(zBase), { stroke: COR.linha, sw: 0.5, dash: '6,3', camada: 'alvenaria' });
      pr.linha(X(xw0), Y(zBase), X(xw1), Y(zBase), { stroke: COR.linha, sw: 0.5, dash: '6,3', camada: 'alvenaria' });
      // o tijolo e a cinta dos lados, na janela (o contorno de cada peça, cortado nas bordas)
      for (const q of sol) {
        if (q.peca.trecho !== tr || (q.peca.tipo !== 'TIJOLO' && q.peca.tipo !== 'TIJOLO_CORTADO' && q.peca.tipo !== 'CINTA_MC')) continue;
        const [a, b] = [Math.max(q.min[0], xw0), Math.min(q.max[0], xw1)];
        if (b - a < 1) continue;
        const cinta = q.peca.tipo === 'CINTA_MC';
        pr.rect(X(a), Y(q.max[2]), (b - a) * S, (q.max[2] - q.min[2]) * S, cinta
          ? { fill: 'none', stroke: COR.linha, sw: 0.8, camada: 'concreto', id: q.peca.id }
          : { fill: 'none', stroke: COR.linha, sw: 0.35, camada: 'alvenaria', id: q.peca.id });
      }
    }
    pr.fechar();
    pr.abrir('data-camada="concreto"');
    const r = projecao(s, 'Y');
    pr.caminho([r.contorno.map(([x, z]): Pt => [X(x), Y(z)])], { fill: 'none', stroke: COR.linha, sw: 1.3, id: s.peca.id, camada: s.geo.catalogo?.includes('bloco') ? 'graute' : 'concreto' });
    pr.fechar();

    // ── barras na elevação ─────────────────────────────────────────────────────────────────────────────────────
    pr.abrir('data-camada="barras"');
    for (const b of p.longs) {
      pr.polilinha(projetarPontos(b.eixo, 'Y').map(([x, z]): Pt => [X(x), Y(z)]), { stroke: aco, sw: fina(b.diametro), id: b.id, camada: 'aco' });
    }
    for (const b of p.estribos) {
      const [xa, xb] = faixa(b.eixo, 0);
      const z = b.eixo.reduce((q, v) => q + v[2], 0) / b.eixo.length;
      pr.linha(X(xa), Y(z), X(xb), Y(z), { stroke: aco, sw: fina(b.diametro) * 0.8, id: b.id, camada: 'aco' });
    }
    // as barras da cinta deste trecho na janela: as que passam e as que acabam aqui (com o gancho, se houver)
    for (const b of m.barras) {
      if (b.papel !== 'CINTA_MC' || b.trecho !== tr) continue;
      for (const pedaco of recortarEmX(projetarPontos(b.eixo, 'Y'), xw0, xw1)) {
        pr.polilinha(pedaco.map(([x, z]): Pt => [X(x), Y(z)]), { stroke: aco, sw: fina(b.diametro), id: b.id, camada: 'aco' });
      }
    }
    pr.fechar();

    // ── a faixa dos estribos, em pé à direita ──────────────────────────────────────────────────────────────────
    let xDireita = X(xw1);
    if (p.estribos.length) {
      const zs = p.estribos.map((b) => b.eixo.reduce((q, v) => q + v[2], 0) / b.eixo.length);
      const [za, zb] = [Math.min(...zs), Math.max(...zs)];
      const xf = X(xw1) + 18;
      const est = p.estribos[0];
      const todos = m.barras.filter((b) => b.posicao === est.posicao && b.papel === 'PIL_ESTRIBO');
      const passo = espacamentoDaPosicao(todos);
      const qtd = p.estribos.length * tipo.pilaretes.length;
      const rotulo = `${est.posicao} – ${qtd} ${bitola(est.diametro)}${passo !== null ? ` c/${textoDoEspacamento(passo)}` : ''}`;
      pr.abrir('data-camada="faixas"');
      pr.linha(xf, Y(za), xf, Y(zb), { stroke: aco, sw: 0.9, camada: 'aco' });
      pr.circulo(xf, Y(za), 2, { fill: aco, camada: 'aco' });
      pr.circulo(xf, Y(zb), 2, { fill: aco, camada: 'aco' });
      // em pé, lendo de baixo para cima, do lado de fora do traço
      pr.texto(xf + 5 + 0.85 * T, (Y(za) + Y(zb)) / 2, rotulo, { tam: T, giro: 90, camada: 'textos', chave: `pilarete:${i}:faixa:${est.posicao}` });
      pr.fechar();
      xDireita = xf + 5 + 0.85 * T;
    }

    // ── cotas da elevação: o traspasse e a altura à esquerda, a largura em cima ────────────────────────────────
    pr.abrir('data-camada="cotas"');
    pr.silenciar(!cotasAcesas);
    const zPe = p.longs.length ? Math.min(...p.longs.map((b) => faixa(b.eixo, 2)[0])) : Z0;
    const xc0 = X(s.min[0]);
    // o traspasse numa linha própria, por fora da altura: na mesma linha, em 1:50 os dois textos em pé se encostam
    if (zPe < Z0 - 1) pr.cotaV(X(xw0) - 46, Y(zPe), Y(Z0), `traspasse ${cm(Z0 - zPe)}`, { lado: -1, de: [xc0, X(xw0)] });
    pr.cotaV(X(xw0) - 20, Y(Z0), Y(s.max[2]), cm(s.max[2] - Z0), { lado: -1, de: [xc0, X(xw0)] });
    pr.cotaH(X(s.min[0]), X(s.max[0]), Y(s.max[2]) - 14, cm(s.max[0] - s.min[0]), { de: [Y(s.max[2]), Y(s.max[2])] });
    pr.silenciar(false);
    pr.fechar();
    pr.regiao(`pilarete:${i}:elevacao`, [ox - xw0 * S, 0], [X(xw0) - 70, Y(s.max[2]) - 50, xDireita - X(xw0) + 80, Y(zBase) - Y(s.max[2]) + 60]);

    // ── a seção, à direita da elevação ─────────────────────────────────────────────────────────────────────────
    // na meia altura de uma fiada de tijolo (a 2ª do muro de cima, ou a 1ª que não é cinta): o estribo mais perto
    const cintas = new Set((mc.cintas ?? []).map((c) => Math.round((c.z - Z0 - 100) / 200)));
    const nF = Math.max(1, Math.round((mc.z1 - Z0) / 200));
    let fs = [1, 0, 2, 3, 4].find((f) => f < nF && !cintas.has(f)) ?? 0;
    if (fs >= nF) fs = 0;
    const zc = Z0 + 200 * fs + 105;
    const yb = s.max[1] + 120;
    const xs0 = xDireita + ENTRE_PARTES;
    const U = (x: number) => xs0 + (x - xw0) * S;
    const V = (y: number) => Y(mc.z1) + 40 + (yb - y) * S;
    pr.texto(U(xw0), V(yb) - 14, 'Seção', { tam: 11, ancora: 'start', negrito: true, chave: `pilarete:${i}:titulo-secao` });
    pr.abrir('data-camada="secao"');
    if (alvenaria) {
      for (const q of sol) {
        if (q.peca.trecho !== tr || q === s) continue;
        const ehTijolo = q.peca.tipo === 'TIJOLO' || q.peca.tipo === 'TIJOLO_CORTADO';
        const doArrimo = ALVENARIA.has(q.peca.tipo) && !ehTijolo;
        if (!ehTijolo && !doArrimo) continue;
        // o arrimo da fiada do topo, embaixo do pilarete (tracejado fino: está abaixo do plano)
        const z = ehTijolo ? zc : Z0 - 105;
        // o contorno de fora da peça (o furo do tijolo cortado viraria uma escada de tiras: o que importa aqui é onde
        // a parede encosta no pilarete)
        const pts = secao(q, 'Z', z).flatMap((reg) => reg.contorno);
        if (!pts.length) continue;
        {
          const [a, b] = [Math.max(Math.min(...pts.map((v) => v[0])), xw0), Math.min(Math.max(...pts.map((v) => v[0])), xw1)];
          if (b - a < 1) continue;
          const [c0, c1] = [Math.min(...pts.map((v) => v[1])), Math.max(...pts.map((v) => v[1]))];
          pr.rect(U(a), V(c1), (b - a) * S, (c1 - c0) * S, ehTijolo
            ? { fill: 'none', stroke: COR.linha, sw: 0.5, camada: 'alvenaria', id: q.peca.id }
            : { fill: 'none', stroke: COR.linha, sw: 0.35, dash: '4,2', camada: 'alvenaria', id: q.peca.id });
        }
      }
    }
    const estilo = estiloDaSecao(s, pr);
    for (const reg of secao(s, 'Z', zc)) {
      pr.caminho([reg.contorno, ...reg.furos].map((a) => a.map(([x, y]): Pt => [U(x), V(y)])), { ...(estilo ?? {}), id: s.peca.id });
    }
    pr.fechar();
    pr.abrir('data-camada="barras"');
    const estribo = p.estribos.length
      ? p.estribos.reduce((a, b) => (Math.abs(faixa(b.eixo, 2)[0] - zc) < Math.abs(faixa(a.eixo, 2)[0] - zc) ? b : a))
      : null;
    if (estribo) pr.polilinha(projetarPontos(estribo.eixo, 'Z').map(([x, y]): Pt => [U(x), V(y)]), { stroke: aco, sw: Math.max(1, estribo.diametro * S), id: estribo.id, camada: 'aco' });
    const pontos: { x: number; y: number; b: Barra }[] = [];
    for (const b of p.longs) for (const [x, y] of cruzamentos(b.eixo, 'Z', zc)) pontos.push({ x, y, b });
    for (const q of pontos) pr.circulo(U(q.x), V(q.y), Math.max(1.6, (q.b.diametro / 2) * S), { fill: aco, id: q.b.id, camada: 'aco' });
    pr.fechar();
    // cotas da seção: b embaixo, h à esquerda, o cobrimento (da face ao estribo; sem estribo, à barra) na de baixo
    pr.abrir('data-camada="cotas"');
    pr.silenciar(!cotasAcesas);
    const [sx0, sx1, sy0, sy1] = [s.min[0], s.max[0], s.min[1], s.max[1]];
    pr.cotaV(U(xw0) - 14, V(sy1), V(sy0), cm(sy1 - sy0), { lado: -1, de: [U(sx0), U(sx0)] });
    let yCota = V(sy0) + 20;
    pr.cotaH(U(sx0), U(sx1), yCota, cm(sx1 - sx0), { de: [V(sy0), V(sy0)] });
    const face = estribo
      ? Math.min(...estribo.eixo.map((v) => v[0])) - estribo.diametro / 2
      : pontos.length ? Math.min(...pontos.map((q) => q.x - q.b.diametro / 2)) : null;
    if (face !== null && face > sx0 + 1) {
      yCota += 22;
      // o cobrimento com o meio centímetro (2,5 é o de pilar de muro — c_pil): o cm inteiro diria 3
      pr.cotaH(U(sx0), U(face), yCota, `c = ${String(Math.round((face - sx0) / 5) / 2).replace('.', ',')}`, { de: [V(sy0), V(sy0)] });
    }
    pr.silenciar(false);
    pr.fechar();
    let yBaixo = yCota + 10;
    const chaveSecao = `pilarete:${i}:secao`;
    pr.regiao(chaveSecao, [U(0), V(0)], [U(xw0) - 50, V(yb) - 30, (xw1 - xw0) * S + 60, yBaixo - V(yb) + 30]);
    let xFim = U(xw1);

    // ── a sombra do estribo, embaixo da seção ──────────────────────────────────────────────────────────────────
    if (estribo) {
      const pts = projetarPontos(estribo.eixo, 'Z');
      const [ex0, ex1] = faixa(estribo.eixo, 0);
      const [ey0, ey1] = faixa(estribo.eixo, 1);
      const legenda = textoDaChamada(m, estribo.posicao, 'pilarete');
      const wl = Prancha.largura(legenda, T);
      const meio = U((ex0 + ex1) / 2);
      const topo = yBaixo + 2 * T + 6;
      const Us = (x: number) => U(x);
      const Vs = (y: number) => topo + (ey1 - y) * S;
      const chave = `pilarete:${i}:sombra:${estribo.posicao}`;
      pr.abrir(`data-camada="sombra-estribo" data-posicao="${estribo.posicao}"`);
      pr.polilinha(pts.map(([x, y]): Pt => [Us(x), Vs(y)]), { stroke: aco, sw: grossa(estribo.diametro, S), id: estribo.id, camada: CAMADA_DA_SOMBRA });
      const medidas = medidasDasPernas(estribo, (q: Vec3): Pt => [Us(q[0]), Vs(q[1])]);
      escreverMedidas(pr, medidas, chave);
      const fim = Math.max(Vs(ey0), ...medidas.map((q) => q.caixa[1] + q.caixa[3]));
      pr.texto(meio, fim + 6 + 0.85 * T, legenda, { tam: T, camada: CAMADA_DA_SOMBRA, chave });
      pr.fechar();
      yBaixo = fim + 10 + 0.85 * T;
      const c0 = Math.min(Us(ex0), meio - wl / 2, ...medidas.map((q) => q.caixa[0]));
      const c1 = Math.max(Us(ex1), meio + wl / 2, ...medidas.map((q) => q.caixa[0] + q.caixa[2]));
      pr.regiao(chave, [Us(0), Vs(0)], [c0 - 6, topo - 2 * T, c1 - c0 + 12, yBaixo - topo + 2 * T + 6]);
      xFim = Math.max(xFim, c1);
    }
    fundo = Math.max(fundo, yBaixo);

    // ── as sombras das longitudinais: em pé, na altura de verdade, à direita da seção ───────────────────────────
    const uma = new Map<string, Barra>();
    for (const b of p.longs) if (!uma.has(b.posicao)) uma.set(b.posicao, b);
    let xs = xFim + ENTRE_PARTES;
    pr.abrir('data-camada="sombras"');
    for (const b of [...uma.values()].sort((a, c) => ordemDoN(a.posicao, c.posicao))) {
      const [za, zb] = faixa(b.eixo, 2);
      const legenda = textoDaChamada(m, b.posicao, 'pilarete');
      const wl = Prancha.largura(legenda, T);
      const x = xs + 0.85 * T + 5;
      const chave = `pilarete:${i}:sombra:${b.posicao}`;
      pr.linha(x, Y(za), x, Y(zb), { stroke: aco, sw: grossa(b.diametro, S), id: b.id, camada: CAMADA_DA_SOMBRA });
      pr.texto(x - 5, (Y(za) + Y(zb)) / 2, legenda, { tam: T, giro: 90, camada: CAMADA_DA_SOMBRA, chave });
      const meioV = (Y(za) + Y(zb)) / 2;
      pr.regiao(chave, [x, 0], [xs - 6, Math.min(Y(zb), meioV - wl / 2) - 6, x - xs + 18, Math.max(Y(za) - Y(zb), wl) + 12]);
      xs = x + 6 + ENTRE_PARTES / 2;
    }
    pr.fechar();
    ox = xs + ENTRE_TIPOS;
  });

  // ── as sombras das barras da cinta, embaixo de tudo, uma por posição ─────────────────────────────────────────
  const daCinta = new Map<string, Barra>();
  for (const b of m.barras) {
    if (b.papel !== 'CINTA_MC') continue;
    // a mais comprida de cada posição (a que tem as duas pontas, quando há emenda, é a do meio: vale qualquer uma)
    const a = daCinta.get(b.posicao);
    if (!a || b.comprimento > a.comprimento) daCinta.set(b.posicao, b);
  }
  let y = fundo + 3 * T + 20;
  pr.abrir('data-camada="sombras"');
  for (const b of [...daCinta.values()].sort((a, c) => ordemDoN(a.posicao, c.posicao))) {
    const [xa, xb] = faixa(b.eixo, 0);
    const L = xb - xa;
    // o miolo encolhe: as pontas (PONTA_DA_CINTA) de verdade, o meio em MIOLO px
    const curta = L <= 2 * PONTA_DA_CINTA + MIOLO / S;
    const Xc = (x: number): number => {
      if (curta) return (x - xa) * S;
      if (x <= xa + PONTA_DA_CINTA) return (x - xa) * S;
      if (x >= xb - PONTA_DA_CINTA) return PONTA_DA_CINTA * S + MIOLO + (x - (xb - PONTA_DA_CINTA)) * S;
      return PONTA_DA_CINTA * S + ((x - xa - PONTA_DA_CINTA) / (L - 2 * PONTA_DA_CINTA)) * MIOLO;
    };
    const pts = projetarPontos(b.eixo, 'Y');
    const zRef = pts.reduce((q, v) => Math.max(q, v[1]), -Infinity);
    const tela = (q: Vec3): Pt => [Xc(q[0]), y + (zRef - q[2]) * S];
    const desenho = b.eixo.map(tela);
    const chave = `pilarete:cinta:${b.posicao}`;
    pr.polilinha(desenho, { stroke: aco, sw: grossa(b.diametro, S), id: b.id, camada: CAMADA_DA_SOMBRA });
    // o miolo encolhido: dois traços inclinados atravessando a barra, a marca de interrupção de prancha
    if (!curta) {
      // fora do meio: no meio vai a medida do trecho comprido
      const xm = PONTA_DA_CINTA * S + MIOLO * 0.2;
      pr.polilinha([[xm - 6, y - 5], [xm - 2, y + 5]], { stroke: COR.linha, sw: 0.7, camada: CAMADA_DA_SOMBRA });
      pr.polilinha([[xm + 2, y - 5], [xm + 6, y + 5]], { stroke: COR.linha, sw: 0.7, camada: CAMADA_DA_SOMBRA });
    }
    const medidas = medidasDasPernas(b, tela);
    escreverMedidas(pr, medidas, chave);
    const fim = Math.max(...desenho.map((q) => q[1]), ...medidas.map((q) => q.caixa[1] + q.caixa[3]), y);
    const legenda = textoDaChamada(m, b.posicao, 'cinta');
    const meio = (Xc(xa) + Xc(xb)) / 2;
    pr.texto(meio, fim + LEGENDA_FORA.embaixo, legenda, { tam: T, camada: CAMADA_DA_SOMBRA, chave });
    const w = Math.max(Xc(xb) - Xc(xa), Prancha.largura(legenda, T));
    pr.regiao(chave, [0, y], [meio - w / 2 - 10, y - FILEIRA / 2 - T, w + 20, fim - y + FILEIRA / 2 + 2 * T + 6]);
    y = fim + LEGENDA_FORA.embaixo + FILEIRA;
  }
  pr.fechar();

  if (!o.semTitulo) {
    pr.texto(0, Y(mc.z1) - 70, 'Armação do pilarete', { tam: 15, ancora: 'start', negrito: true });
    pr.texto(0, Y(mc.z1) - 54, 'cotas em cm', { tam: 10, ancora: 'start', cor: COR.nota });
  }
  return pr;
}

export function armacaoDoPilarete(m: Modelo): string {
  return desenharArmacaoDoPilarete(m).svg();
}
