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
import type { Barra, Modelo, Vec2, Vec3 } from '@/modelo/tipos';
import { cm, metros } from './formato';
import { CAMADA_DA_SOMBRA, T, escreverMedidas, grossa, medidasDasPernas } from './sombras';
import { formaDaBarra, trechosNoModelo } from '@/pranchas/formaDaBarra';
import {
  ALVENARIA, barraNoPlanoX, contrafortesDoModelo, cruzamentos, faixa, projecao, projetarPontos, secao,
  solidosDoModelo, type Regiao, type Solido,
} from './geometria';
import { COR, Prancha, escalaPara, type Estilo, type OpcoesDaVista, type Pt } from './prancha';
import { ancoraNaBarra, desenharChamadas, desenharEtiquetas, elementoDaBarra, textoDaChamada, type Chamada } from './chamadas';
import { anotacaoVisivel, aparece, corDoAcoNoDesenho, hachuraDe, naVista, pecaAparece } from './graficos';

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
    // o estribo com os ganchos de 135° e o nó de cachorro (modulacao/barras.ts) saem até um φ do plano onde a barra
    // cruza a si mesma: ainda são barras do plano
    if (barraNoPlanoX(b.eixo, b.diametro + 0.5)) {
      // por elemento E posição: o mesmo N pode estar no painel e no contraforte (barra igual, mesmo N)
      const k = `${b.papel}|${b.posicao || b.diametro}`;
      planas.set(k, [...(planas.get(k) ?? []), b]);
    } else {
      // barra que corre DENTRO do plano do corte num trecho (a perna do U da canaleta, que entra no contraforte meia
      // bitola ao lado do eixo dele — a do vão vizinho encosta do outro lado): o trecho no plano aparece como linha;
      // o resto, como ponto onde atravessa
      const noPlano = trechoNoPlano(b.eixo, x0, b.diametro / 2 + 0.5);
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

/** A maior sequência de pontos seguidos da polilinha que está no plano X = x0 (a `folga`, mm, para cada lado). */
function trechoNoPlano(eixo: Barra['eixo'], x0: number, folga: number): Barra['eixo'] {
  let melhor: Barra['eixo'] = [];
  let atual: Barra['eixo'] = [];
  for (const p of eixo) {
    if (Math.abs(p[0] - x0) <= folga) atual.push(p);
    else atual = [];
    if (atual.length > melhor.length) melhor = [...atual];
  }
  return melhor;
}

/** Estilo da peça cortada, com a camada do DXF (a peça sabe o que é; a cor sozinha não diria — o barbacã e o
 *  tubo do dreno são brancos como o fundo do bloco). */
export function estiloDaSecao(s: Solido, pr: Prancha): Estilo | null {
  const tp = s.peca.tipo;
  // fundo e risco da tabela de gráficos (15/10); o contorno de cada peça no risco da hachura dela
  if (ALVENARIA.has(tp)) return { fill: pr.padrao('alv'), stroke: hachuraDe('alvenaria').risco, sw: 0.9, camada: 'alvenaria' };
  if (tp === 'GRAUTE_FURO' || tp === 'GRAUTE_CANALETA') return { fill: pr.padrao('grc'), stroke: hachuraDe('graute').risco, sw: 0.6, camada: 'graute' };
  if (tp === 'SAPATA') return { fill: pr.padrao('conc'), stroke: COR.linha, sw: 1.6, camada: 'concreto' };
  if (tp === 'PILARETE' && s.geo.catalogo?.includes('bloco')) return { fill: pr.padrao('grc'), stroke: hachuraDe('graute').risco, sw: 1.2, camada: 'graute' };
  if (tp === 'PILARETE' || tp === 'CINTA_MC') return { fill: pr.padrao('conc'), stroke: COR.linha, sw: 1.2, camada: 'concreto' };
  if (tp === 'DRENO') return { fill: pr.padrao('brita'), stroke: hachuraDe('brita').risco, sw: 0.8, camada: 'drenagem' };
  if (tp === 'AREIA') return { fill: pr.padrao('areia'), stroke: hachuraDe('areia').risco, sw: 0.6, camada: 'drenagem' };
  if (tp === 'MANTA') return { fill: pr.padrao('mnt'), stroke: hachuraDe('manta').risco, sw: 0.6, camada: 'drenagem' };
  if (tp === 'BARBACA' || tp === 'TUBO_DRENO') return { fill: '#ffffff', stroke: COR.linha, sw: 0.8, camada: 'drenagem', material: 'tubo' };
  return null;
}

/** Ordem de pintura na seção: o que é fundo primeiro, o que enche furo depois. */
const ORDEM: Partial<Record<Solido['peca']['tipo'], number>> = { PILARETE: 3, CINTA_MC: 3, SAPATA: 0, DRENO: 1, AREIA: 1, MANTA: 2, GRAUTE_FURO: 4, GRAUTE_CANALETA: 4, BARBACA: 5, TUBO_DRENO: 5 };

/** `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha (paraPrancha.ts). */
/** O corte com a tabela de gráficos dela (corte: graficos.ts, naVista). */
export function desenharCorteLateral(m: Modelo, xCorte?: number, o: OpcoesDaVista = {}): Prancha {
  return naVista('corte', () => corteNaVista(m, xCorte, o), o.graficos);
}

function corteNaVista(m: Modelo, xCorte: number | undefined, o: OpcoesDaVista): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  pr.ajustar(o.anotacoes, o.S);
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
  // com muro de cima (13/11) o corte vai até o topo dele
  const S = o.S ?? escalaPara(Math.max(yLonge - yPerto, (m.dims.muroDeCima?.z1 ?? H_muro) - zFundo), 530, 0.056, 0.42);
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
  const terra = aparece('corte', 'terreno');
  if (terra) pr.abrir('data-camada="terreno"');
  const contornoDaTerra: Vec2[] = [[yPerto, zFundo], [yLonge, zFundo], [yLonge, H_solo], [t, H_solo], [t, 0], [0, 0], [0, zFrente], [yPerto, zFrente]];
  const FURA_A_TERRA = new Set<string>(['SAPATA', 'DRENO', 'AREIA', 'MANTA', 'GRAUTE_CANALETA']);
  const furosDaTerra = cortados
    .filter(({ s }) => FURA_A_TERRA.has(s.peca.tipo) || ALVENARIA.has(s.peca.tipo))
    .flatMap(({ r }) => r.map((q) => q.contorno))
    .filter((c) => c.length >= 3 && dentroDoPoligono(centroDoAnel(c), contornoDaTerra));
  if (terra) {
    const corDaTerra = hachuraDe('terra').risco;
    pr.caminho([contornoDaTerra, ...furosDaTerra].map((a) => a.map(tela)), { fill: pr.padrao('solo'), stroke: 'none' });
    pr.linha(U(yPerto), V(zFrente), U(zFrente > 0 ? 0 : Math.min(0, yMin)), V(zFrente), { stroke: corDaTerra, sw: 1.8, material: 'terra' });
    pr.linha(U(t), V(H_solo), U(yLonge), V(H_solo), { stroke: corDaTerra, sw: 1.8, material: 'terra' });
    // o rótulo é do terreno (fica na cor da terra, não na dos textos) e se mexe na folha como os outros
    pr.texto(U(yLonge) + 8, V(H_solo) + 16, 'aterro', { tam: 11, ancora: 'start', cor: corDaTerra, negrito: true, halo: true, camada: 'terreno', chave: 'aterro' });
    pr.fechar();
  }

  // ── contraforte além do corte (escondido no aterro) ──────────────────────────────────────────────────────────
  if (!cfCortado && aparece('corte', 'blocos')) {
    const alem = cfs.filter((c) => c.x > x0).sort((a, b) => a.x - b.x)[0];
    if (alem) {
      pr.rect(U(alem.min[1]), V(alem.max[2]), (alem.min[1] - alem.max[1]) * S, (alem.max[2] - Math.max(alem.min[2], 0)) * S,
        { stroke: COR.linha, sw: 0.9, dash: '6,3', camada: 'alvenaria' });
    }
  }

  // ── seções ─────────────────────────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="secao"');
  for (const { s, r } of cortados) {
    if (!pecaAparece('corte', s.peca.tipo)) continue;
    const e = estiloDaSecao(s, pr);
    if (!e) continue;
    if (ALVENARIA.has(s.peca.tipo)) {
      // fundo branco na caixa da peça: furo sem graute é vazio, não é solo (a haste enterrada está no aterro)
      const ps = r.flatMap((q) => q.contorno);
      const ys = ps.map((p) => p[0]), zs = ps.map((p) => p[1]);
      pr.rect(U(Math.min(...ys)), V(Math.max(...zs)), (Math.min(...ys) - Math.max(...ys)) * S, (Math.max(...zs) - Math.min(...zs)) * S, { fill: '#ffffff', stroke: 'none', camada: 'alvenaria', material: 'alvenaria' });
    }
    for (const q of r) pr.caminho(aneis(q), { ...e, id: s.peca.id });
  }
  // barbacã fora do plano: o tubo mais próximo, tracejado (o corte típico do painel mostra a drenagem; no
  // corte do contraforte o tubo não existe — fica fora do contraforte — e confundiria com furo da haste)
  if (!cfCortado && aparece('corte', 'drenagem') && !cortados.some((q) => q.s.peca.tipo === 'BARBACA')) {
    const bb = sol.filter((s) => s.peca.tipo === 'BARBACA').sort((a, b) => Math.abs(a.min[0] - x0) - Math.abs(b.min[0] - x0))[0];
    if (bb) pr.caminho(aneis(projecao(bb, 'X')), { stroke: COR.linha, sw: 0.8, dash: '4,2', id: bb.peca.id, camada: 'drenagem' });
  }
  pr.fechar();

  // ── armadura ───────────────────────────────────────────────────────────────────────────────────────────────────
  const br = barrasNoCorte(m, x0);
  const ySecoes = br.linhas.filter((l) => l.barra.papel !== 'ESPERA').map((l) => l.pts[0][0]);
  const chamadas: Chamada[] = [];
  // as barras desenhadas de cada posição e elemento (a cortada é um ponto): a etiqueta posta acha a dela
  const barrasPorChave = new Map<string, Pt[][]>();
  const guardar = (b: { posicao: string; papel: Barra['papel']; contraforte?: number }, pts: Pt[]) => {
    const k = `${b.posicao}|${elementoDaBarra(b)}`;
    barrasPorChave.set(k, [...(barrasPorChave.get(k) ?? []), pts]);
  };
  const armadura = aparece('corte', 'armadura');
  // A barra de pé com sombra não leva chamada (Jose, 20/10): a sombra já diz o N, a quantidade, o Ø e o C, e a
  // chamada repetia a mesma legenda. Com as sombras desligadas a chamada volta — a barra nunca fica sem nome.
  const temSombra = (b: Barra) => SOBEM.has(b.papel) && anotacaoVisivel('sombras');
  pr.abrir('data-camada="barras"');
  for (const l of armadura ? br.linhas : []) {
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
    pr.polilinha(l.fechada ? [...tp, tp[0]] : tp, { stroke: corDoAcoNoDesenho(), sw: Math.max(1, l.barra.diametro * S), id: l.barra.id });
    if (!temSombra(l.barra)) chamadas.push({ posicao: l.barra.posicao, elemento: elementoDaBarra(l.barra), ancora: ancoraNaBarra(tp) });
    // a barra fechada com o lado que fecha: a etiqueta prende em qualquer lado do estribo
    guardar(l.barra, l.fechada ? [...tp, tp[0]] : tp);
  }
  // barra cortada (ponto): a chamada vai ao ponto mais perto da coluna das chamadas (à direita), o de cima no empate
  const pontoDaChamada = new Map<string, Chamada>();
  for (const p of armadura ? br.pontos : []) {
    const [u, v] = tela(p.p);
    pr.circulo(u, v, Math.max(1.6, (p.barra.diametro / 2) * S), { id: p.barra.id });
    guardar(p.barra, [[u, v]]);
    const el = elementoDaBarra(p.barra);
    const k = `${p.barra.posicao}|${el}`;
    const a = pontoDaChamada.get(k)?.ancora;
    if (!a || u > a[0] + 0.5 || (Math.abs(u - a[0]) <= 0.5 && v < a[1])) pontoDaChamada.set(k, { posicao: p.barra.posicao, elemento: el, ancora: [u, v] });
  }
  chamadas.push(...pontoDaChamada.values());
  pr.fechar();

  // ── cotas ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const cotas = aparece('corte', 'cotas');
  pr.abrir('data-camada="cotas"');
  const topo = V(H_muro);
  // t e d no alto do muro
  if (cotas) pr.cotaH(U(0), U(t), topo - 16, `t = ${cm(t)}`, { de: [topo, topo] });
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
  if (cotas && yd !== null) pr.cotaH(U(faceComprimida), U(yd), topo - 40, `d = ${cm(Math.abs(yd - faceComprimida))}`, { de: [topo - 30, topo - 30] });
  if (cotas && cfCortado) {
    const [ya, yb] = cfCortado.aparente ? [cfCortado.min[1], t] : [0, cfCortado.max[1]];
    pr.cotaH(U(ya), U(yb), topo - 64, `contraforte ${cm(yb - ya)}`, { de: [topo, V(cfCortado.max[2])] });
  }
  // alturas: muro (lado da frente) e solo (lado do aterro)
  const uFace = U(Math.min(0, cfCortado?.aparente ? cfCortado.min[1] : 0));
  // traspasse: quanto a espera sobe acima da sapata (é o que o pedreiro mede antes de descer a barra do muro). Uma
  // cota por altura: no contraforte cada espera tem o traspasse dela (a principal, a do painel, a construtiva —
  // ℓ0t próprio na conta), e a cota só da maior deixava o pedreiro sem a medida das outras. Com mais de uma, o
  // rótulo diz de quais posições é (o N da chamada); posições da mesma altura dividem a cota.
  const alturas = new Map<number, string[]>();
  for (const l of br.linhas) {
    if (l.barra.papel !== 'ESPERA') continue;
    const z = Math.round(Math.max(...l.pts.map((p) => p[1])));
    if (z <= 1) continue;
    const ns = alturas.get(z) ?? [];
    if (!ns.includes(l.barra.posicao)) ns.push(l.barra.posicao);
    alturas.set(z, ns);
  }
  const traspasses = H_muro > 0 ? [...alturas.entries()].sort((a, b) => a[0] - b[0]) : [];
  const ordemDoN = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });
  // a cota do traspasse é cota: some com o "Cotas" desligado (o lugar dela fica — a coluna da frente não anda)
  if (cotas) {
    traspasses.forEach(([z, ns], i) => {
      const rotulo = traspasses.length > 1 ? `traspasse ${ns.sort(ordemDoN).join(', ')} ${cm(z)}` : `traspasse ${cm(z)}`;
      pr.cotaV(uFace + 22 + 28 * i, V(0), V(z), rotulo, { lado: 1, de: [uFace, uFace] });
    });
  }
  const uFrente = uFace + (traspasses.length ? 22 + 28 * traspasses.length : 26);
  if (cotas) {
    pr.cotaV(uFrente, V(0), V(H_muro), `muro ${cm(H_muro)}`, { lado: 1, de: [uFace, uFace] });
    pr.cotaV(U(yLonge) - 22, V(0), V(H_solo), `solo ${cm(H_solo)}`, { lado: -1 });
  }
  // sapata: medidas tiradas do perfil cortado (o que está desenhado), não das entradas
  const sap = cortados.find((q) => q.s.peca.tipo === 'SAPATA');
  if (sap && (cotas || aparece('corte', 'eixos'))) {
    const ps = sap.r.flatMap((q) => q.contorno);
    const y0 = Math.min(...ps.map((p) => p[0])), y1 = Math.max(...ps.map((p) => p[0]));
    const z0 = Math.min(...ps.map((p) => p[1])), zTopo = Math.max(...ps.map((p) => p[1]));
    const zPe = Math.min(...ps.filter((p) => Math.abs(p[0] - y0) < 1).map((p) => p[1]));
    const fundo = ps.filter((p) => Math.abs(p[1] - z0) < 1).map((p) => p[0]);
    const temDente = z0 < zPe - 1 && fundo.length >= 2;
    if (cotas) pr.cotaV(U(y0) + 22, V(zPe), V(zTopo), cm(zTopo - zPe), { lado: 1, de: [U(y0), U(y0)] });
    let linha = V(z0) + 22;
    if (cotas && temDente) {
      const d0 = Math.min(...fundo), d1 = Math.max(...fundo);
      // altura do dente do lado do talão: do lado do pé passa o eixo do muro (cota do a)
      pr.cotaV(U(d1) - 18, V(z0), V(zPe), cm(zPe - z0), { lado: -1, de: [U(d1), U(d1)] });
      pr.cotaH(U(d0), U(d1), linha, cm(d1 - d0), { de: [V(z0), V(z0)] });
      linha += 24;
    }
    if (cotas) pr.cotaH(U(y0), U(y1), linha, `B = ${cm(y1 - y0)}`, { de: [V(zPe), V(zPe)] });
    // distância da borda aterrada ao eixo do muro (a_ater)
    if (aparece('corte', 'eixos')) pr.linha(U(t / 2), V(H_muro) + 6, U(t / 2), linha + 30, { stroke: COR.cota, sw: 0.6, dash: '14,3,2,3', camada: 'eixos' });
    if (cotas) pr.cotaH(U(t / 2), U(y1), linha + 24, cm(y1 - t / 2), { de: [linha + 24, V(zPe)] });
  }
  pr.fechar();

  // ── sombras das barras que sobem: à esquerda do desenho, na altura de verdade ──────────────────────────────────
  if (armadura) desenharSombrasDoCorte(pr, m, br.linhas, tela, S);

  // ── chamadas das barras: à direita, além do solo da frente ─────────────────────────────────────────────────────
  if (o.chamadas && aparece('corte', 'chamadas')) desenharChamadas(pr, m, chamadas, U(yPerto) + 24, o.chamadasPostas);
  if (o.etiquetas?.length && aparece('corte', 'chamadas')) desenharEtiquetas(pr, m, o.etiquetas, barrasPorChave, S);

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

/** As barras de pé no plano do corte que ganham sombra: a vertical do muro, o arranque e as do contraforte. */
const SOBEM = new Set<Barra['papel']>(['ESPERA', 'VERT_MURO', 'CF_PRINCIPAL', 'CF_CONSTRUTIVA']);
/** Da borda do desenho à primeira sombra, e de uma sombra à outra, px. */
const ANTES_DAS_SOMBRAS = 30;
const ENTRE_SOMBRAS = 18;

/**
 * As SOMBRAS do corte (Jose, 20/10): cada barra de pé desenhada no corte — a vertical do muro, a espera (Padrão ou nó
 * de cachorro) e as do contraforte — tirada de dentro da peça e posta solta à ESQUERDA de tudo, além do aterro, NA
 * MESMA ALTURA (o armador lê onde ela começa e acaba olhando o muro do lado), uma por posição e elemento, lado a lado.
 * À esquerda porque a coluna das chamadas fica à direita: ali as linhas de chamada atravessavam as sombras. Barra reta: a
 * legenda corre em pé ao lado dela (a vertical tem a altura do muro: deitada, a legenda alargaria a coluna). Barra
 * com dobras: as medidas da lista de ferros em cada perna, do lado de fora, e a legenda deitada embaixo da forma. A
 * legenda é a da chamada ("N1 – 15 Ø10 c/40 C=210": a quantidade e o c/ do ELEMENTO). Cada sombra é uma parte com
 * origem própria: ela fica a uma distância em px da borda do desenho, que muda com a cota e a escala.
 */
/**
 * Barras de dobra da mesma forma que só mudam numa perna — no contraforte, o nó de cachorro de cada furo corre até a
 * ponta e cada um tem o seu C (684, 686, 688…), cada um um N: uma sombra por N dava nove, doze sombras com a largura
 * da sapata, mais largas que o corte. Vão juntas numa sombra só (a mais comprida), com a perna que muda escrita em
 * faixa ("45 a 63") e a legenda com as posições, a soma e a faixa do C — como a "barra de comprimento variável" da
 * prancha de armação. Mesmo papel, mesmo Ø, mesmo número de pernas e as outras pernas iguais — e a que muda é
 * DEITADA (corre ao longo da sapata): a perna em pé que muda é o traspasse, e cada altura tem a sua cota no corte;
 * juntas, o armador não saberia qual N sobe até onde.
 */
interface GrupoDeSombra { barras: Barra[]; varia: number }

function agruparVariaveis(barras: Barra[]): GrupoDeSombra[] {
  const grupos: (GrupoDeSombra & { trechos: number[] })[] = [];
  for (const b of barras) {
    const tr = formaDaBarra(b).trechos;
    const pernas = trechosNoModelo(b) ?? [];
    const deitada = (i: number) => !!pernas[i] && Math.abs(pernas[i].b[2] - pernas[i].a[2]) < Math.abs(pernas[i].b[1] - pernas[i].a[1]);
    const g = tr.length >= 2 ? grupos.find((q) => {
      const r = q.barras[0];
      if (r.papel !== b.papel || r.diametro !== b.diametro || elementoDaBarra(r) !== elementoDaBarra(b) || q.trechos.length !== tr.length) return false;
      const dif = tr.map((c, i) => (c !== q.trechos[i] ? i : -1)).filter((i) => i >= 0);
      return dif.length === 0 || (dif.length === 1 && deitada(dif[0]) && (q.varia < 0 || q.varia === dif[0]));
    }) : undefined;
    if (!g) {
      grupos.push({ barras: [b], varia: -1, trechos: tr });
      continue;
    }
    const i = tr.findIndex((c, k) => c !== g.trechos[k]);
    if (i >= 0) g.varia = i;
    g.barras.push(b);
  }
  return grupos;
}

/** "N5 a N8" quando os N são seguidos; senão a lista ("N5, N7, N9"). */
function posicoesEmFaixa(ns: string[]): string {
  const num = (n: string) => Number(n.replace(/\D/g, ''));
  const o = [...ns].sort((a, b) => num(a) - num(b));
  const seguidos = o.every((n, i) => i === 0 || num(n) === num(o[i - 1]) + 1);
  return o.length > 2 && seguidos ? `${o[0]} a ${o[o.length - 1]}` : o.join(', ');
}

function desenharSombrasDoCorte(pr: Prancha, m: Modelo, linhas: BarrasNoCorte['linhas'], tela: (p: Vec2) => Pt, S: number): void {
  const uma = new Map<string, Barra>();
  for (const l of linhas) {
    if (!SOBEM.has(l.barra.papel)) continue;
    const k = `${l.barra.posicao}|${elementoDaBarra(l.barra)}`;
    if (!uma.has(k)) uma.set(k, l.barra);
  }
  // o muro antes do contraforte; a espera antes da que sobe nela; depois pelo N
  const ordemDoPapel = (b: Barra) => ['ESPERA', 'VERT_MURO', 'CF_PRINCIPAL', 'CF_CONSTRUTIVA'].indexOf(b.papel);
  const barras = [...uma.values()].sort((a, b) =>
    (elementoDaBarra(a) === 'muro' ? 0 : 1) - (elementoDaBarra(b) === 'muro' ? 0 : 1) || ordemDoPapel(a) - ordemDoPapel(b) ||
    a.posicao.localeCompare(b.posicao, 'pt-BR', { numeric: true }));
  if (!barras.length) return;
  const aco = corDoAcoNoDesenho();
  // da borda esquerda para fora: a primeira da lista fica mais perto do muro
  let x = pr.esquerda() - ANTES_DAS_SOMBRAS;
  pr.abrir('data-camada="sombras"');
  for (const g of agruparVariaveis(barras)) {
    // a mais comprida desenha; a legenda e a perna que muda contam todas
    const b = g.barras.reduce((p, q) => (q.comprimento > p.comprimento ? q : p));
    const el = elementoDaBarra(b);
    const chave = `sombra:corte:${b.posicao}:${el}`;
    let legenda = textoDaChamada(m, b.posicao, el);
    const variaveis: (string | undefined)[] = [];
    if (g.barras.length > 1) {
      const doElemento = (n: string) => m.barras.filter((q) => q.posicao === n && elementoDaBarra(q) === el).length;
      const cs = g.barras.map((q) => Math.round(q.comprimento / 10));
      const n = g.barras.reduce((s, q) => s + doElemento(q.posicao), 0);
      const faixaDe = (vs: number[]) => (Math.min(...vs) === Math.max(...vs) ? String(vs[0]) : `${Math.min(...vs)} a ${Math.max(...vs)}`);
      legenda = `${posicoesEmFaixa(g.barras.map((q) => q.posicao))} – ${n} Ø${String(b.diametro).replace('.', ',')} C=${faixaDe(cs)}`;
      if (g.varia >= 0) variaveis[g.varia] = faixaDe(g.barras.map((q) => formaDaBarra(q).trechos[g.varia]));
    }
    const wl = Prancha.largura(legenda, T);
    const naTela = (p: Vec3): Pt => tela([p[1], p[2]]);
    const pts = projetarPontos(b.eixo, 'X').map(tela);
    const medidas = medidasDasPernas(b, naTela, variaveis);
    const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    // a caixa de tudo o que a sombra escreve, no lugar de origem (a barra dentro da peça)
    let [c0, c1, d1] = [u0, u1, v1];
    for (const q of medidas) {
      c0 = Math.min(c0, q.caixa[0]);
      c1 = Math.max(c1, q.caixa[0] + q.caixa[2]);
      d1 = Math.max(d1, q.caixa[1] + q.caixa[3]);
    }
    const reta = medidas.length === 0;
    // reta: a legenda em pé à esquerda dela; com dobras: deitada, centrada embaixo da forma
    if (reta) c0 = Math.min(c0, u0 - 5 - 0.85 * T);
    else {
      const meio = (u0 + u1) / 2;
      c0 = Math.min(c0, meio - wl / 2);
      c1 = Math.max(c1, meio + wl / 2);
    }
    const dx = x - c1;
    pr.polilinha(pts.map(([u, v]): Pt => [u + dx, v]), { stroke: aco, sw: grossa(b.diametro, S), id: b.id, camada: CAMADA_DA_SOMBRA });
    escreverMedidas(pr, medidas, chave, dx);
    // em cima e embaixo do que a sombra ocupa: a legenda em pé mais comprida que a barra sobra para os dois lados
    let [yAlto, yBaixo] = [v0, d1];
    if (reta) {
      pr.texto(u0 + dx - 5, (v0 + v1) / 2, legenda, { tam: T, giro: 90, camada: CAMADA_DA_SOMBRA, chave });
      yAlto = Math.min(v0, (v0 + v1) / 2 - wl / 2);
      yBaixo = Math.max(d1, (v0 + v1) / 2 + wl / 2);
    } else {
      yBaixo = d1 + 6 + 0.85 * T;
      pr.texto((u0 + u1) / 2 + dx, yBaixo, legenda, { tam: T, camada: CAMADA_DA_SOMBRA, chave });
    }
    // a origem é o (0, 0) do corte levado junto com a barra: a cota criada na sombra mede em mm do muro
    const [o0, o1] = tela([0, 0]);
    pr.regiao(chave, [o0 + dx, o1], [c0 + dx - 6, yAlto - 6, c1 - c0 + 12, yBaixo - yAlto + 12]);
    x -= c1 - c0 + ENTRE_SOMBRAS;
  }
  pr.fechar();
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
