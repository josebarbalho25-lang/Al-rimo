/*
  CORTE LATERAL — seção YZ do muro num X escolhido, olhando ao longo de +X (de quem está na ponta esquerda).
  O aterro fica à ESQUERDA e o pé da sapata à direita, como na Fig. 15: o Jose já leu a sapata desse lado.

  O que entra no corte:
  - as peças que o plano atravessa (alvenaria hachurada, graute, sapata pontilhada, dreno de brita);
  - a armadura: barra que corre ao longo do muro aparece como ponto; barra que vive num plano X (vertical, espera
    com gancho, barra transversal da sapata) aparece inteira — a mais próxima do corte, de cada posição (N1, N2…),
    como no corte típico de prancha. Barra de contraforte só entra quando o corte passa NAQUELE contraforte;
  - o contraforte seguinte, além do corte, tracejado (está enterrado no aterro, escondido);
  - aterro e solo da frente hachurados (derivados das medidas do modelo: o terreno do 3D é só para ver).
*/
import type { Barra, Modelo, Vec2 } from '@/modelo/tipos';
import { cm, metros } from './formato';
import {
  ALVENARIA, barraNoPlanoX, contrafortesDoModelo, cruzamentos, faixa, projecao, projetarPontos, secao,
  solidosDoModelo, type Regiao, type Solido,
} from './geometria';
import { COR, Prancha, escalaPara, type Estilo, type OpcoesDaVista, type Pt } from './prancha';

export interface CortePadrao {
  rotulo: string;
  x: number;
}

/**
 * Cortes que o desenho oferece de saída: no meio de um painel (encostado na barra mais próxima do meio, para o
 * corte mostrar a barra e o graute, como no corte típico) e, havendo contraforte, um no eixo de um contraforte
 * intermediário (o de ponta, se não houver intermediário).
 */
export function cortesPadrao(m: Modelo): CortePadrao[] {
  const out: CortePadrao[] = [];
  const cfs = m.dims.contrafortes;
  const tr = m.dims.trechos[0] ?? { x0: 0, x1: m.dims.L_real };
  let a = tr.x0, b = tr.x1;
  const doTrecho = cfs.filter((c) => c.x >= tr.x0 && c.x <= tr.x1).map((c) => c.x).sort((u, v) => u - v);
  if (doTrecho.length >= 2) [a, b] = [doTrecho[0], doTrecho[1]];
  const meio = (a + b) / 2;
  const xs = m.barras.filter((q) => q.papel === 'VERT_MURO' && q.eixo[0][0] > a && q.eixo[0][0] < b).map((q) => q.eixo[0][0]);
  const x = xs.length ? xs.reduce((p, q) => (Math.abs(q - meio) < Math.abs(p - meio) ? q : p)) : meio;
  out.push({ rotulo: cfs.length ? 'Painel' : 'Muro', x });
  if (cfs.length) {
    const k = cfs.findIndex((c) => !c.ponta);
    const i = k >= 0 ? k : 0;
    out.push({ rotulo: `Contraforte C${i + 1}`, x: cfs[i].x });
  }
  return out;
}

export interface BarrasNoCorte {
  linhas: { barra: Barra; pts: Vec2[]; fechada: boolean }[];   // (y, z)
  pontos: { barra: Barra; p: Vec2 }[];                          // (y, z)
}

/** Armadura que aparece num corte X = x0 (regras no cabeçalho). Usado também pelo isométrico cortado. */
export function barrasNoCorte(m: Modelo, x0: number): BarrasNoCorte {
  const t = m.familia.t;
  const cfCortado = m.dims.contrafortes.findIndex((c) => Math.abs(c.x - x0) <= t / 2) + 1;   // 0 = nenhum
  const linhas: BarrasNoCorte['linhas'] = [];
  const pontos: BarrasNoCorte['pontos'] = [];
  const planas = new Map<string, Barra[]>();
  for (const b of m.barras) {
    if (b.contraforte && b.contraforte !== cfCortado) continue;
    if (b.papel === 'CF_ESTRIBO') {
      const [xa, xb] = faixa(b.eixo, 0);
      if (xa <= x0 && x0 <= xb) linhas.push({ barra: b, pts: projetarPontos(b.eixo, 'X'), fechada: !!b.fechada });
      continue;
    }
    if (barraNoPlanoX(b.eixo)) {
      const k = b.posicao || `${b.papel}|${b.diametro}`;
      planas.set(k, [...(planas.get(k) ?? []), b]);
    } else {
      // barra que corre DENTRO do plano do corte num trecho (a da canaleta do contraforte, que vem pelo eixo dele e
      // dobra em L na canaleta do muro): o trecho no plano aparece como linha; o resto, como ponto onde atravessa
      const noPlano = trechoNoPlano(b.eixo, x0);
      if (noPlano.length >= 2) linhas.push({ barra: b, pts: projetarPontos(noPlano, 'X'), fechada: false });
      else for (const p of cruzamentos(b.eixo, 'X', x0)) pontos.push({ barra: b, p });
    }
  }
  for (const grupo of planas.values()) {
    const xs = [...new Set(grupo.map((b) => Math.round(b.eixo[0][0])))].sort((u, v) => u - v);
    let passo = Infinity;
    for (let k = 1; k < xs.length; k++) passo = Math.min(passo, xs[k] - xs[k - 1]);
    const tol = Math.max(m.familia.m / 2 + 1, Number.isFinite(passo) ? passo / 2 + 1 : 0);
    const perto = xs.reduce((p, q) => (Math.abs(q - x0) < Math.abs(p - x0) ? q : p));
    if (Math.abs(perto - x0) > tol) continue;
    for (const b of grupo) {
      if (Math.abs(b.eixo[0][0] - perto) < 1) linhas.push({ barra: b, pts: projetarPontos(b.eixo, 'X'), fechada: !!b.fechada });
    }
  }
  return { linhas, pontos };
}

/** A maior sequência de pontos seguidos da polilinha que está no plano X = x0 (meio milímetro de folga). */
function trechoNoPlano(eixo: Barra['eixo'], x0: number): Barra['eixo'] {
  let melhor: Barra['eixo'] = [];
  let atual: Barra['eixo'] = [];
  for (const p of eixo) {
    if (Math.abs(p[0] - x0) <= 0.5) atual.push(p);
    else atual = [];
    if (atual.length > melhor.length) melhor = [...atual];
  }
  return melhor;
}

/** Estilo da peça cortada, com a camada do DXF (a peça sabe o que é; a cor sozinha não diria — o barbacã e o
 *  tubo do dreno são brancos como o fundo do bloco). */
export function estiloDaSecao(s: Solido, pr: Prancha): Estilo | null {
  const tp = s.peca.tipo;
  if (ALVENARIA.has(tp)) return { fill: pr.padrao('alv'), stroke: COR.bloco, sw: 0.9, camada: 'alvenaria' };
  if (tp === 'GRAUTE_FURO' || tp === 'GRAUTE_CANALETA') return { fill: COR.grauteFundo, stroke: COR.graute, sw: 0.6, camada: 'graute' };
  if (tp === 'SAPATA') return { fill: pr.padrao('conc'), stroke: COR.linha, sw: 1.6, camada: 'concreto' };
  if (tp === 'DRENO') return { fill: pr.padrao('brita'), stroke: COR.brita, sw: 0.8, camada: 'drenagem' };
  if (tp === 'AREIA') return { fill: pr.padrao('areia'), stroke: COR.areia, sw: 0.6, camada: 'drenagem' };
  if (tp === 'MANTA') return { fill: COR.manta, stroke: COR.manta, sw: 0.6, camada: 'drenagem' };
  if (tp === 'BARBACA' || tp === 'TUBO_DRENO') return { fill: '#ffffff', stroke: COR.linha, sw: 0.8, camada: 'drenagem' };
  return null;
}

/** Ordem de pintura na seção: o que é fundo primeiro, o que enche furo depois. */
const ORDEM: Partial<Record<Solido['peca']['tipo'], number>> = { SAPATA: 0, DRENO: 1, AREIA: 1, MANTA: 2, GRAUTE_FURO: 4, GRAUTE_CANALETA: 4, BARBACA: 5, TUBO_DRENO: 5 };

/** `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha (paraPrancha.ts). */
export function desenharCorteLateral(m: Modelo, xCorte?: number, o: OpcoesDaVista = {}): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des');
  const todos = solidosDoModelo(m);
  const sol = todos.filter((s) => s.peca.grupo !== 'terreno');
  // o solo da frente sobe sobre a ponta quando há aterro (h_fr): a altura sai do terreno do modelo
  const zFrente = Math.max(0, ...todos.filter((s) => s.peca.tipo === 'SOLO_FRENTE').map((s) => s.max[2]));
  const t = m.familia.t;
  const { H_muro, H_solo, sapata } = m.dims;
  const x0 = xCorte ?? cortesPadrao(m)[0]?.x ?? m.dims.L_real / 2;
  const cfs = contrafortesDoModelo(m, sol);
  const cfCortado = cfs.find((c) => Math.abs(c.x - x0) <= t / 2);

  const yMin = Math.min(sapata.y0, 0, ...sol.map((s) => s.min[1]));
  const yMax = Math.max(sapata.y1, t, ...sol.map((s) => s.max[1]));
  const yLonge = yMax + 450;      // fim do aterro desenhado
  const yPerto = yMin - 450;      // fim do solo da frente desenhado
  const zFundo = sapata.z0 - 250;
  // 530 (era 760): com 760 a cota saía com ~11 px na tela cheia (1920×1080, painel aberto) e a nota com ~10 —
  // o Jose achou a letra pequena (09/10). Com o desenho menor na folha, o enquadrar amplia mais e TODA a anotação
  // cresce junto (~1,3×): cota ~15 px, a mesma altura do rótulo do painel. Os limites acompanham na mesma razão.
  // Na prancha a escala vem pedida (1:25, 1:50…).
  const S = o.S ?? escalaPara(Math.max(yLonge - yPerto, H_muro - zFundo), 530, 0.056, 0.42);
  const U = (y: number) => -y * S;
  const V = (z: number) => -z * S;
  const tela = (p: Vec2): Pt => [U(p[0]), V(p[1])];
  const aneis = (r: Regiao): Pt[][] => [r.contorno, ...r.furos].map((a) => a.map(tela));

  // as seções primeiro (só os dados): a terra precisa delas para contorná-las
  const cortados = sol
    .map((s) => ({ s, r: secao(s, 'X', x0) }))
    .filter((q) => q.r.length)
    .sort((a, b) => (ORDEM[a.s.peca.tipo] ?? 3) - (ORDEM[b.s.peca.tipo] ?? 3));

  // ── terreno ────────────────────────────────────────────────────────────────────────────────────────────────────
  // A terra CONTORNA a sapata, o dreno e o contraforte enterrado (furos no polígono, regra par-ímpar): no SVG a peça
  // pintada por cima já tapava, mas no DXF as duas hachuras ficavam uma em cima da outra (EARTH sob AR-CONC).
  // Entra como furo só o CONTORNO de fora de cada peça que está dentro da terra — o graute do furo mora dentro do
  // bloco, e o furo do tubo dentro da brita: contá-los de novo inverteria a regra e a terra voltaria lá dentro.
  pr.abrir('data-camada="terreno"');
  const contornoDaTerra: Vec2[] = [[yPerto, zFundo], [yLonge, zFundo], [yLonge, H_solo], [t, H_solo], [t, 0], [0, 0], [0, zFrente], [yPerto, zFrente]];
  const FURA_A_TERRA = new Set<string>(['SAPATA', 'DRENO', 'AREIA', 'MANTA', 'GRAUTE_CANALETA']);
  const furosDaTerra = cortados
    .filter(({ s }) => FURA_A_TERRA.has(s.peca.tipo) || ALVENARIA.has(s.peca.tipo))
    .flatMap(({ r }) => r.map((q) => q.contorno))
    .filter((c) => c.length >= 3 && dentroDoPoligono(centroDoAnel(c), contornoDaTerra));
  pr.caminho([contornoDaTerra, ...furosDaTerra].map((a) => a.map(tela)), { fill: pr.padrao('solo'), stroke: 'none' });
  pr.linha(U(yPerto), V(zFrente), U(zFrente > 0 ? 0 : Math.min(0, yMin)), V(zFrente), { stroke: COR.solo, sw: 1.8 });
  pr.linha(U(t), V(H_solo), U(yLonge), V(H_solo), { stroke: COR.solo, sw: 1.8 });
  pr.texto(U(yLonge) + 8, V(H_solo) + 16, 'aterro', { tam: 11, ancora: 'start', cor: COR.solo, negrito: true, halo: true });
  pr.fechar();

  // ── contraforte além do corte (escondido no aterro) ──────────────────────────────────────────────────────────
  if (!cfCortado) {
    const alem = cfs.filter((c) => c.x > x0).sort((a, b) => a.x - b.x)[0];
    if (alem) {
      pr.rect(U(alem.min[1]), V(alem.max[2]), (alem.min[1] - alem.max[1]) * S, (alem.max[2] - Math.max(alem.min[2], 0)) * S,
        { stroke: COR.linha, sw: 0.9, dash: '6,3', camada: 'alvenaria' });
    }
  }

  // ── seções ─────────────────────────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="secao"');
  for (const { s, r } of cortados) {
    const e = estiloDaSecao(s, pr);
    if (!e) continue;
    if (ALVENARIA.has(s.peca.tipo)) {
      // fundo branco na caixa da peça: furo sem graute é vazio, não é solo (a haste enterrada está no aterro)
      const ps = r.flatMap((q) => q.contorno);
      const ys = ps.map((p) => p[0]), zs = ps.map((p) => p[1]);
      pr.rect(U(Math.min(...ys)), V(Math.max(...zs)), (Math.min(...ys) - Math.max(...ys)) * S, (Math.max(...zs) - Math.min(...zs)) * S, { fill: '#ffffff', stroke: 'none', camada: 'alvenaria' });
    }
    for (const q of r) pr.caminho(aneis(q), { ...e, id: s.peca.id });
  }
  // barbacã fora do plano: o tubo mais próximo, tracejado (o corte típico do painel mostra a drenagem; no
  // corte do contraforte o tubo não existe — fica fora do contraforte — e confundiria com furo da haste)
  if (!cfCortado && !cortados.some((q) => q.s.peca.tipo === 'BARBACA')) {
    const bb = sol.filter((s) => s.peca.tipo === 'BARBACA').sort((a, b) => Math.abs(a.min[0] - x0) - Math.abs(b.min[0] - x0))[0];
    if (bb) pr.caminho(aneis(projecao(bb, 'X')), { stroke: COR.linha, sw: 0.8, dash: '4,2', id: bb.peca.id, camada: 'drenagem' });
  }
  pr.fechar();

  // ── armadura ───────────────────────────────────────────────────────────────────────────────────────────────────
  const br = barrasNoCorte(m, x0);
  const ySecoes = br.linhas.filter((l) => l.barra.papel !== 'ESPERA').map((l) => l.pts[0][0]);
  pr.abrir('data-camada="barras"');
  for (const l of br.linhas) {
    let pts = l.pts;
    // espera e barra no mesmo Y se confundem no corte: a espera é afastada um diâmetro e meio para o miolo do
    // furo, só no desenho, para o traspasse aparecer como duas linhas lado a lado
    if (l.barra.papel === 'ESPERA') {
      // Y do trecho vertical = Y do ponto mais alto (a espera pode vir escrita de cima para baixo ou ao contrário)
      const yTopo = pts.reduce((a, p) => (p[1] > a[1] ? p : a))[0];
      if (ySecoes.some((y) => Math.abs(y - yTopo) < l.barra.diametro)) {
        const d = 1.5 * l.barra.diametro * (yTopo > t / 2 ? -1 : 1);
        pts = pts.map(([y, z]): Vec2 => [y + d, z]);
      }
    }
    const tp = pts.map(tela);
    pr.polilinha(l.fechada ? [...tp, tp[0]] : tp, { stroke: COR.aco, sw: Math.max(1, l.barra.diametro * S), id: l.barra.id });
  }
  for (const p of br.pontos) {
    const [u, v] = tela(p.p);
    pr.circulo(u, v, Math.max(1.6, (p.barra.diametro / 2) * S), { id: p.barra.id });
  }
  pr.fechar();

  // ── cotas ──────────────────────────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="cotas"');
  const topo = V(H_muro);
  // t e d no alto do muro
  pr.cotaH(U(0), U(t), topo - 16, `t = ${cm(t)}`, { de: [topo, topo] });
  let yd: number | null = null;
  let faceComprimida = 0;
  if (cfCortado) {
    const pr2 = br.linhas.filter((l) => l.barra.papel === 'CF_PRINCIPAL').map((l) => l.pts[0][0]);
    if (pr2.length) yd = pr2.reduce((a, b) => a + b, 0) / pr2.length;
    if (cfCortado.aparente) faceComprimida = cfCortado.min[1];
  } else {
    const ys = br.linhas.filter((l) => l.barra.papel === 'VERT_MURO').map((l) => l.pts[0][0]);
    if (ys.length) yd = Math.max(...ys);
  }
  // d: as chamadas param acima do rótulo do t (a face já está marcada pela cota do t; a barra não chega ao topo)
  if (yd !== null) pr.cotaH(U(faceComprimida), U(yd), topo - 40, `d = ${cm(Math.abs(yd - faceComprimida))}`, { de: [topo - 30, topo - 30] });
  if (cfCortado) {
    const [ya, yb] = cfCortado.aparente ? [cfCortado.min[1], t] : [0, cfCortado.max[1]];
    pr.cotaH(U(ya), U(yb), topo - 64, `contraforte ${cm(yb - ya)}`, { de: [topo, V(cfCortado.max[2])] });
  }
  // alturas: muro (lado da frente) e solo (lado do aterro)
  const uFace = U(Math.min(0, cfCortado?.aparente ? cfCortado.min[1] : 0));
  // traspasse: quanto a espera sobe acima da sapata (é o que o pedreiro mede antes de descer a barra do muro)
  const esperas = br.linhas.filter((l) => l.barra.papel === 'ESPERA');
  const zTraspasse = esperas.length ? Math.max(...esperas.flatMap((l) => l.pts.map((p) => p[1]))) : 0;
  const comTraspasse = zTraspasse > 1 && H_muro > 0;
  if (comTraspasse) pr.cotaV(uFace + 22, V(0), V(zTraspasse), `traspasse ${cm(zTraspasse)}`, { lado: 1, de: [uFace, uFace] });
  const uFrente = uFace + (comTraspasse ? 50 : 26);
  pr.cotaV(uFrente, V(0), V(H_muro), `muro ${cm(H_muro)}`, { lado: 1, de: [uFace, uFace] });
  pr.cotaV(U(yLonge) - 22, V(0), V(H_solo), `solo ${cm(H_solo)}`, { lado: -1 });
  // sapata: medidas tiradas do perfil cortado (o que está desenhado), não das entradas
  const sap = cortados.find((q) => q.s.peca.tipo === 'SAPATA');
  if (sap) {
    const ps = sap.r.flatMap((q) => q.contorno);
    const y0 = Math.min(...ps.map((p) => p[0])), y1 = Math.max(...ps.map((p) => p[0]));
    const z0 = Math.min(...ps.map((p) => p[1])), zTopo = Math.max(...ps.map((p) => p[1]));
    const zPe = Math.min(...ps.filter((p) => Math.abs(p[0] - y0) < 1).map((p) => p[1]));
    const fundo = ps.filter((p) => Math.abs(p[1] - z0) < 1).map((p) => p[0]);
    const temDente = z0 < zPe - 1 && fundo.length >= 2;
    pr.cotaV(U(y0) + 22, V(zPe), V(zTopo), cm(zTopo - zPe), { lado: 1, de: [U(y0), U(y0)] });
    let linha = V(z0) + 22;
    if (temDente) {
      const d0 = Math.min(...fundo), d1 = Math.max(...fundo);
      // altura do dente do lado do talão: do lado do pé passa o eixo do muro (cota do a)
      pr.cotaV(U(d1) - 18, V(z0), V(zPe), cm(zPe - z0), { lado: -1, de: [U(d1), U(d1)] });
      pr.cotaH(U(d0), U(d1), linha, cm(d1 - d0), { de: [V(z0), V(z0)] });
      linha += 24;
    }
    pr.cotaH(U(y0), U(y1), linha, `B = ${cm(y1 - y0)}`, { de: [V(zPe), V(zPe)] });
    // distância da borda aterrada ao eixo do muro (a_ater)
    pr.linha(U(t / 2), V(H_muro) + 6, U(t / 2), linha + 30, { stroke: COR.cota, sw: 0.6, dash: '14,3,2,3', camada: 'eixos' });
    pr.cotaH(U(t / 2), U(y1), linha + 24, cm(y1 - t / 2), { de: [linha + 24, V(zPe)] });
  }
  pr.fechar();

  // ── título ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // na prancha o título é dela (embaixo do desenho, com a escala); o PROVISÓRIO fica, é aviso e não título
  const yTit = topo - (cfCortado ? 100 : 76);
  if (!o.semTitulo) {
    pr.texto(U(yLonge), yTit, `Corte em x = ${metros(x0)} m${cfCortado ? ` · C${cfCortado.numero}` : ''}`, { tam: 15, ancora: 'start', negrito: true });
    pr.texto(U(yLonge), yTit + 16, 'cotas em cm', { tam: 10, ancora: 'start', cor: COR.nota });
  }
  if (m.familia.provisoria && cfs.length) pr.texto(U(yLonge), yTit - 20, 'PROVISÓRIO', { tam: 13, ancora: 'start', negrito: true, cor: COR.especial });
  return pr;
}

export function corteLateral(m: Modelo, x?: number): string {
  return desenharCorteLateral(m, x).svg();
}

/** Centro de área de um anel (para saber de que lado da terra a peça está). */
function centroDoAnel(a: Vec2[]): Vec2 {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < a.length; i++) {
    const [x1, y1] = a[i];
    const [x2, y2] = a[(i + 1) % a.length];
    const c = x1 * y2 - x2 * y1;
    A += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  if (Math.abs(A) < 1e-9) return [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length];
  return [cx / (3 * A), cy / (3 * A)];
}

/** Ponto dentro do polígono (regra par-ímpar). */
function dentroDoPoligono([x, y]: Vec2, poli: Vec2[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
