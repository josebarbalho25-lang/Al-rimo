/*
  PLANTA — seção horizontal na meia altura de uma fiada (padrão: a 1ª, a "planta de 1ª fiada" da alvenaria),
  olhando de cima. X para a direita, Y (lado do solo) para CIMA: a face aparente fica embaixo, alinhada com a
  vista frontal, como numa prancha de alvenaria.

  A sapata está abaixo do plano: só o contorno tracejado (e o dente, em traço mais curto). Barras que atravessam
  o plano são pontos; o que fica na própria fiada abaixo do plano (barra da canaleta, estribo na junta) aparece
  em linha.

  Os blocos cortados vão pintados com a cor do tipo (cores.ts), e não com a hachura de alvenaria do corte: a
  planta da fiada é a que o pedreiro segue para assentar, e é nela que ele precisa ver onde vai o meio bloco, o
  34, o 54. A hachura continua no corte lateral, onde é convenção de desenho.
*/
import type { Barra, Modelo, Vec2, Vec3 } from '@/modelo/tipos';
import { cm, cmCheio } from './formato';
import { ALVENARIA, contrafortesDoModelo, cruzamentos, faixa, secao, solidosDoModelo, type Regiao } from './geometria';
import { CAMADA_DA_SOMBRA, FILEIRA, LEGENDA_FORA, T, arrumarEmFileiras, escreverMedidas, grossa, medidasDasPernas, zDoMaiorTrecho, type Pegada } from './sombras';
import { estiloDaSecao } from './corteLateral';
import { desenharLegenda, estiloPintado, itensDasTintas, tintaDaPeca, tintasPresentes } from './cores';
import { cadeia } from './vistaFrontal';
import { COR, Prancha, escalaPara, type OpcoesDaVista, type Pt } from './prancha';
import { aparece as apareceNa, corDoAcoNoDesenho, naVista, pecaAparece } from './graficos';

/** `fiada` conta de 0 (0 = 1ª fiada). `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha. */
/** A planta com a tabela de gráficos dela (planta: graficos.ts, naVista). */
export function desenharPlanta(m: Modelo, fiada = 0, o: OpcoesDaVista = {}): Prancha {
  return naVista('planta', () => plantaNaVista(m, fiada, o), o.graficos);
}

function plantaNaVista(m: Modelo, fiada: number, o: OpcoesDaVista): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  pr.ajustar(o.anotacoes, o.S);
  const sol = solidosDoModelo(m).filter((s) => s.peca.grupo !== 'terreno');
  const t = m.familia.t;
  const { trechos, sapata, L_real, n_fiadas } = m.dims;
  const f = Math.max(0, Math.min(n_fiadas - 1, Math.round(fiada)));
  const zc = 200 * f + 105;            // meia altura do bloco da fiada
  const zBaixo = 200 * f;              // o que está entre a base da fiada e o plano aparece em vista
  const xIni = trechos.length ? Math.min(...trechos.map((r) => r.x0)) : 0;
  const xFim = trechos.length ? Math.max(...trechos.map((r) => r.x1)) : L_real;
  const cfs = contrafortesDoModelo(m, sol);
  const yMin = Math.min(sapata.y0, 0, ...cfs.map((c) => c.min[1]));
  const yMax = Math.max(sapata.y1, t, ...cfs.map((c) => c.max[1]));
  const S = o.S ?? escalaPara(Math.max(xFim - xIni, 2.2 * (yMax - yMin)), 1000, 0.05, 0.5);
  const X = (x: number) => x * S;
  const Y = (y: number) => -y * S;
  const tela = (p: Vec2): Pt => [X(p[0]), Y(p[1])];
  const aneis = (r: Regiao): Pt[][] => [r.contorno, ...r.furos].map((a) => a.map(tela));
  // o que o Jose desligou na planta (Visibilidade, graficos.ts — 15/10)
  const aparece = (i: Parameters<typeof apareceNa>[1]) => apareceNa('planta', i);

  // ── sapata (abaixo): contorno e dente tracejados ──────────────────────────────────────────────────────────────
  pr.abrir('data-camada="sapata"');
  for (const s of aparece('sapata') ? sol.filter((q) => q.peca.tipo === 'SAPATA') : []) {
    pr.rect(X(s.min[0]), Y(s.max[1]), (s.max[0] - s.min[0]) * S, (s.max[1] - s.min[1]) * S, { stroke: COR.linha, sw: 1, dash: '8,4', id: s.peca.id });
    // dente: as arestas do perfil no nível mais baixo
    const zMin = s.min[2];
    const ys = [...new Set(s.base.filter((p) => Math.abs(p[2] - zMin) < 0.5).map((p) => Math.round(p[1])))];
    if (ys.length >= 2 && s.base.some((p) => p[2] > zMin + 0.5 && Math.abs(p[1] - s.min[1]) < 0.5)) {
      for (const y of [Math.min(...ys), Math.max(...ys)]) pr.linha(X(s.min[0]), Y(y), X(s.max[0]), Y(y), { stroke: COR.linha, sw: 0.7, dash: '3,3' });
    }
  }
  pr.fechar();

  // ── seção na fiada ────────────────────────────────────────────────────────────────────────────────────────────
  const cortados = sol
    .map((s) => ({ s, r: secao(s, 'Z', zc) }))
    .filter((q) => q.r.length && pecaAparece('planta', q.s.peca.tipo))
    .sort((a, b) => ordem(a.s.peca.tipo) - ordem(b.s.peca.tipo));
  pr.abrir('data-camada="secao"');
  for (const { s, r } of cortados) {
    const tinta = tintaDaPeca(s);
    const e = tinta ? estiloPintado(tinta) : estiloDaSecao(s, pr);
    if (!e) continue;
    for (const q of r) pr.caminho(aneis(q), { ...e, id: s.peca.id });
  }
  pr.fechar();

  // ── armadura ──────────────────────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="barras"');
  for (const b of aparece('armadura') ? m.barras : []) {
    const pts = b.fechada ? [...b.eixo, b.eixo[0]] : b.eixo;
    // trechos deitados dentro da fiada, abaixo do plano
    for (let k = 0; k + 1 < pts.length; k++) {
      const [p, q] = [pts[k], pts[k + 1]];
      const dentro = (z: number) => z >= zBaixo - 1 && z <= zc;
      if (dentro(p[2]) && dentro(q[2]) && Math.hypot(q[0] - p[0], q[1] - p[1]) > 1) {
        pr.linha(X(p[0]), Y(p[1]), X(q[0]), Y(q[1]), { stroke: corDoAcoNoDesenho(), sw: Math.max(0.9, b.diametro * S), id: b.id });
      }
    }
    for (const p of cruzamentos(b.eixo, 'Z', zc)) {
      const [u, v] = tela(p);
      pr.circulo(u, v, Math.max(1.4, (b.diametro / 2) * S), { id: b.id });
    }
  }
  pr.fechar();

  // ── eixos, juntas e cotas ─────────────────────────────────────────────────────────────────────────────────────
  const yTopo = Y(yMax);
  const yBase = Y(yMin);
  pr.abrir('data-camada="cotas"');
  pr.silenciar(!aparece('eixos'));
  for (const c of cfs) {
    pr.linha(X(c.x), yBase + 10, X(c.x), yTopo - 34, { stroke: COR.cota, sw: 0.6, dash: '14,3,2,3', camada: 'eixos' });
    pr.texto(X(c.x), yTopo - 38, `C${c.numero}`, { tam: 11, cor: COR.cota, negrito: true, camada: 'eixos', chave: `eixo:C${c.numero}` });
  }
  for (let k = 0; k + 1 < trechos.length; k++) {
    const xj = (trechos[k].x1 + trechos[k + 1].x0) / 2;
    pr.linha(X(xj), Y(-60), X(xj), Y(t + 60), { stroke: COR.linha, sw: 1.8, camada: 'eixos' });
    pr.texto(X(xj), yBase + 22, 'JC', { tam: 11, negrito: true, camada: 'eixos' });
  }
  pr.silenciar(!aparece('cotas'));
  // eixo a eixo dos contrafortes, por cima (lado do solo)
  for (const r of trechos) {
    const xs = cfs.filter((c) => c.x >= r.x0 && c.x <= r.x1).map((c) => c.x);
    if (xs.length) pr.cadeiaH(cadeia([r.x0, ...xs, r.x1]).map((c) => ({ a: X(c.a), b: X(c.b), rotulo: c.rotulo })), yTopo - 16);
  }
  // comprimento por trecho e total, por baixo
  let linha = yBase + (trechos.length > 1 ? 40 : 24);
  if (trechos.length > 1) {
    pr.cadeiaH(trechos.map((r) => ({ a: X(r.x0), b: X(r.x1), rotulo: cmCheio(r.x1 - r.x0), textoDaChave: cm(r.x1 - r.x0) })), linha, { de: [[Y(0), Y(0)]] });
    linha += 24;
  }
  pr.cotaH(X(xIni), X(xFim), linha, cmCheio(L_real), { de: [Y(0), Y(0)], textoDaChave: cm(L_real) });
  pr.silenciar(false);
  pr.fechar();

  // ── sombras das barras da canaleta, embaixo da cota ───────────────────────────────────────────────────────────
  const fimDasSombras = aparece('armadura') ? desenharSombrasDaPlanta(pr, m, zBaixo, zc, linha + 4, S) : linha;
  const linhaLegenda = fimDasSombras + 30;
  pr.abrir('data-camada="cotas"');
  pr.silenciar(!aparece('cotas'));
  // espessura do muro, na ponta esquerda
  pr.cotaV(X(xIni) - 18, Y(0), Y(t), `t = ${cm(t)}`, { de: [X(xIni), X(xIni)] });
  // comprimento do contraforte: no primeiro, por fora da ponta esquerda (dentro do desenho cairia em cima do dreno)
  const cf = cfs[0];
  if (cf) {
    const [ya, yb] = cf.aparente ? [cf.min[1], t] : [0, cf.max[1]];
    const xCota = Math.min(X(cf.min[0]), X(xIni)) - 50;
    pr.cotaV(xCota, Y(ya), Y(yb), `contraforte ${cm(yb - ya)}`, { de: [X(cf.min[0]), X(cf.min[0])] });
  }
  pr.silenciar(false);
  pr.fechar();

  // na prancha o título é dela (embaixo do desenho, com a escala); o PROVISÓRIO fica, é aviso e não título
  const yTit = yTopo - (cfs.length ? 66 : 30);
  if (!o.semTitulo) {
    pr.texto(X(xIni), yTit, `Planta — ${f + 1}ª fiada`, { tam: 15, ancora: 'start', negrito: true });
    pr.texto(X(xIni), yTit + 16, 'cotas em cm', { tam: 10, ancora: 'start', cor: COR.nota });
  }
  if (m.familia.provisoria && cfs.length) pr.texto(X(xIni) + (o.semTitulo ? 0 : 190), yTit, 'PROVISÓRIO', { tam: 13, ancora: 'start', negrito: true, cor: COR.especial });
  // legenda só com os tipos que aparecem NESTA fiada (a 1ª não tem canaleta; a do topo é só canaleta)
  if (!o.semLegendaDeCores && aparece('legenda')) desenharLegenda(pr, X(xIni), linhaLegenda, itensDasTintas(tintasPresentes(cortados.map((q) => q.s))), Math.max(320, X(xFim) - X(xIni)));
  return pr;
}

interface SombraDaPlanta {
  barra: Barra;
  /** As barras iguais na mesma estação (posição, trecho, x; a do contraforte, todas da posição): a quantidade. */
  n: number;
  xa: number;
  xb: number;
}

/**
 * As SOMBRAS da planta (Jose, 20/10: "sombra na planta das barras nas canaletas"): cada barra deitada na canaleta da
 * fiada — a corrida reta do balanço, com as emendas, e o U de cada vão entre contrafortes — tirada de dentro e posta
 * solta embaixo da cota do comprimento, no x de verdade, como as longitudinais da armação da sapata: uma por posição e
 * estação (a dobrada, uma só para todos os vãos, no x da primeira), as peças da barra emendada em fileiras
 * seguidas (o traspasse se lê na sobreposição), as pernas do U com a
 * medida da lista de ferros, a legenda do lado oposto ao das pernas. Fiada sem canaleta não tem sombra. Volta o y px
 * do que a sombra mais baixa ocupa (a legenda das cores vem depois).
 */
function desenharSombrasDaPlanta(pr: Prancha, m: Modelo, zBaixo: number, zc: number, yCota: number, S: number): number {
  const naFiada = m.barras.filter((b) => b.papel === 'HORIZ' && b.eixo.every((p) => p[2] >= zBaixo - 1 && p[2] <= zc));
  const grupos = new Map<string, SombraDaPlanta>();
  for (const b of naFiada) {
    const [xa, xb] = faixa(b.eixo, 0);
    // a dobrada (o U de cada vão) é a mesma barra em todo vão: uma sombra só, na primeira, com a soma — seis sombras
    // iguais "N8 – 1" só repetiam o que a planta já mostra
    const k = b.eixo.length > 2 ? `${b.posicao}|dobrada` : `${b.posicao}|${b.trecho}|${Math.round((xa + xb) / 20)}`;
    const g = grupos.get(k);
    if (g) g.n++;
    else grupos.set(k, { barra: b, n: 1, xa, xb });
  }
  const lista = [...grupos.values()].sort((a, b) => a.barra.posicao.localeCompare(b.barra.posicao, 'pt-BR', { numeric: true }) || a.xa - b.xa);
  if (!lista.length) return yCota;
  // famílias: a corrida reta emendada (mesma posição e trecho, x que se sobrepõem)
  const reta = (b: Barra) => b.eixo.length === 2;
  const familias: SombraDaPlanta[][] = [];
  for (const s of lista) {
    const fam = reta(s.barra)
      ? familias.find((f) => reta(f[0].barra) && f[0].barra.posicao === s.barra.posicao && f[0].barra.trecho === s.barra.trecho &&
        f.some((q) => Math.min(q.xb, s.xb) - Math.max(q.xa, s.xa) > 1))
      : undefined;
    if (fam) fam.push(s);
    else familias.push([s]);
  }
  const X = (x: number) => x * S;
  const legendaDe = (s: SombraDaPlanta) =>
    `${s.barra.posicao} – ${s.n} Ø${String(Math.round(s.barra.diametro * 10) / 10).replace('.', ',')} C=${Math.round(s.barra.comprimento / 10)}`;
  // a forma no lugar de origem: x de verdade, y contado do trecho comprido (a perna do L sai dele)
  const forma = (s: SombraDaPlanta) => {
    const pts = s.barra.eixo.map((p): Vec2 => [p[0], p[1]]);
    const yRef = zDoMaiorTrecho(pts);
    const tela = (p: Vec3): Pt => [X(p[0]), -(p[1] - yRef) * S];
    const desenho = s.barra.eixo.map(tela);
    const medidas = medidasDasPernas(s.barra, tela);
    const v0 = Math.min(0, ...desenho.map((p) => p[1]), ...medidas.map((q) => q.caixa[1]));
    const v1 = Math.max(0, ...desenho.map((p) => p[1]), ...medidas.map((q) => q.caixa[1] + q.caixa[3]));
    // a legenda vai do lado sem perna: embaixo, a não ser que a perna desça
    const emCima = v1 > 1 && v0 > -1;
    return { desenho, medidas, v0, v1, emCima };
  };
  const formas = new Map(lista.map((s) => [s, forma(s)]));
  const altura = Math.max(...[...formas.values()].map((f) => f.v1 - f.v0));
  const passo = FILEIRA + altura;
  const pegada = (s: SombraDaPlanta): Pegada => {
    const w = Prancha.largura(legendaDe(s), T);
    const cx = (X(s.xa) + X(s.xb)) / 2;
    const [a, b] = [X(s.xa), X(s.xb)];
    return { lo: Math.min(a, cx - w / 2), hi: Math.max(b, cx + w / 2), loTraco: a <= cx - w / 2, hiTraco: b >= cx + w / 2 };
  };
  const fileira = arrumarEmFileiras(familias, pegada);
  const aco = corDoAcoNoDesenho();
  // a primeira fileira desce o bastante para a perna que sobe e a legenda de cima não tocarem a cota
  const y0 = yCota + 3 * T + Math.max(0, -Math.min(...[...formas.values()].map((f) => f.v0)));
  let fundo = yCota;
  pr.abrir('data-camada="sombras"');
  for (const s of lista) {
    const f = formas.get(s)!;
    const y = y0 + fileira.get(s)! * passo;
    const chave = `sombra:planta:${s.barra.posicao}:${s.barra.trecho}:${s.barra.contraforte ?? ''}:${Math.round(s.xa)}`;
    pr.polilinha(f.desenho.map(([u, v]): Pt => [u, v + y]), { stroke: aco, sw: grossa(s.barra.diametro, S), id: s.barra.id, camada: CAMADA_DA_SOMBRA });
    escreverMedidas(pr, f.medidas, chave, 0, y);
    const cx = (X(s.xa) + X(s.xb)) / 2;
    const yl = f.emCima ? y + f.v0 + LEGENDA_FORA.emCima : y + f.v1 + LEGENDA_FORA.embaixo;
    pr.texto(cx, yl, legendaDe(s), { tam: T, camada: CAMADA_DA_SOMBRA, chave });
    const w = Prancha.largura(legendaDe(s), T);
    const lo = Math.min(X(s.xa), cx - w / 2);
    const hi = Math.max(X(s.xb), cx + w / 2);
    // cada fileira fica a uma distância fixa em px da cota: parte com origem própria (x do muro, y da fileira)
    pr.regiao(chave, [0, y], [lo - 10, y + f.v0 - T - 6, hi - lo + 20, f.v1 - f.v0 + 2 * T + 12]);
    fundo = Math.max(fundo, y + f.v1 + (f.emCima ? 0 : LEGENDA_FORA.embaixo));
  }
  pr.fechar();
  return fundo;
}

function ordem(tp: string): number {
  if (tp === 'DRENO' || tp === 'AREIA' || tp === 'MANTA') return 0;
  if (ALVENARIA.has(tp as never)) return 1;
  if (tp === 'GRAUTE_FURO' || tp === 'GRAUTE_CANALETA') return 2;
  return 3;
}

export function planta(m: Modelo, fiada = 0): string {
  return desenharPlanta(m, fiada).svg();
}
