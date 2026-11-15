/*
  O QUE ESTÁ EM VOLTA DA ALVENARIA — sapata (com armadura), drenagem (dreno, manta, barbacãs) e terreno (aterro e
  solo da frente, só para o 3D mostrar transparente; fora do IFC e do quantitativo).
*/
import type { Vec2, Vec3 } from '@/modelo/tipos';
import { H_BLOCO, H_FIADA, JUNTA } from './catalogo';
import type { Cavidade, MapaDeCavidades } from './cavidades';
import type { Parametros } from './leitura';
import { br, type TrechoModulado } from './modular';
import { arred, circulo, prisma, retangulo, retanguloArredondado } from './perfis';
import { corrida, distribuir, estribo, ganchoEstribo, medidasDoEstribo, pinoEstribo, reta } from './barras';
import { ESPESSURA_MANTA, SOBRA_TERRENO, fmt, geoPrismaReto, pad, type Ctx } from './contexto';
import { avisarMedidasDoEstribo, traspasse } from './armaduras';

export const temDente = (p: Parametros): boolean => p.b_den > 0 && p.h_den > 0;

// ── sapata ───────────────────────────────────────────────────────────────────

export function sapata(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number): void {
  const { p } = ctx;
  const B = p.B_sap;
  const h = p.h_sap;
  const L = tr.x1 - tr.x0;
  let contorno: Vec2[];
  if (temDente(p)) {
    // dente com o eixo a x_den do centro da sapata, + para o pé (Jose, 13/10; o peso dele na aba Fundação está em
    // x = B/2 + x_den, medido da borda aterrada). O pé fica no Y menor: + para o pé = Y diminui. Cortado na sapata.
    const yc = YbA - B / 2 - p.x_den;
    const yd0 = Math.max(Ype, yc - p.b_den / 2);
    const yd1 = Math.min(YbA, yc + p.b_den / 2);
    const zb = -h - p.h_den;
    contorno = [[yd0, zb], [yd1, zb], [yd1, -h], [YbA, -h], [YbA, 0], [Ype, 0], [Ype, -h], [yd0, -h]];
  } else {
    contorno = [[Ype, -h], [YbA, -h], [YbA, 0], [Ype, 0]];
  }
  contorno = contorno.filter((q, k) => k === 0 || q[0] !== contorno[k - 1][0] || q[1] !== contorno[k - 1][1]);
  const zMin = Math.min(...contorno.map((q) => q[1]));
  const chave = `sapata ${fmt(B)}x${fmt(h)}${temDente(p) ? ` dente ${fmt(p.b_den)}x${fmt(p.h_den)}` : ''} L${fmt(L)}`;
  geoPrismaReto(ctx, chave, 'X', contorno, L);
  ctx.pecas.push({ id: `SAP.T${tr.indice}`, tipo: 'SAPATA', grupo: 'fundacao', geometria: chave, origem: [tr.x0, arred(Ype), arred(zMin)], giro: 0, trecho: tr.indice });

  // armaduras (fundacao.py): transversal Ø phi_sap c/ s_ps, longitudinal Ø phi_sap2 c/ s_ss — em estribo fechado
  // (padrão desde 15/10) ou reta, como era antes (entrada do modelo sap_transv)
  const c = p.cob_sap;
  const s1 = p.s_ps && p.s_ps > 0 ? p.s_ps : 200;
  const s2 = p.s_ss && p.s_ss > 0 ? p.s_ss : 200;
  if (!(p.s_ps && p.s_ps > 0) || !(p.s_ss && p.s_ss > 0)) {
    ctx.avisos.push({ codigo: 'SAPATA_ESPACAMENTO', texto: 'Armadura da sapata sem espaçamento na conta — desenhada a cada 20 cm (dedução)' });
  }
  const T = `SAP.T${tr.indice}`;
  // as pernas do estribo do dente sobem por dentro da malha da sapata: a longitudinal que cairia em cima de uma
  // delas encosta ao lado (sem dente, ou sem perna no caminho, nada muda)
  const dente = estriboDoDente(ctx, Ype, YbA);
  const pernas = dente ? [dente.yA, dente.yB].map((y) => ({ y, meia: p.phi_den / 2 })) : [];
  const transversais = p.sapTransv === 'reta' ? sapataReta(ctx, tr, Ype, YbA, s1, s2, pernas) : sapataEmEstribos(ctx, tr, Ype, YbA, s1, s2, pernas);

  // torção (contrafortes): estribo fechado em volta de B × h no trecho todo (brief Q11, recomendação — DEDUÇÃO),
  // no espaçamento da aba Fundação ("Ø do estribo de torção: espaçamento", célula sem nome). É outro estribo, à
  // parte da transversal (a conta dimensiona os dois separados); onde cairia no lugar de uma transversal, encosta nela.
  if (p.contrafortes && p.T_sd > 0 && p.s_tor !== null && p.s_tor > 0) {
    const ph = p.phi_tor;
    const y0 = Ype + c + ph / 2;
    const y1 = YbA - c - ph / 2;
    const z0 = -h + c + ph / 2;
    const z1 = -c - ph / 2;
    // a volta em espiral ocupa x ± φ: o 1º e o último ficam a c das pontas do trecho
    const [xa, xb] = [tr.x0 + c + ph, tr.x1 - c - ph];
    const xs = encostar(distribuir(xa, xb, p.s_tor), transversais.xs, transversais.meia + ph, xa, xb);
    xs.forEach((x, k) => {
      // ganchos no canto de cima do lado do pé, como a transversal
      ctx.barras.push(estribo(`${T}.TOR${pad(k + 1, 4)}`, 'SAP_TORCAO', ph, [[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]], tr.indice));
    });
    avisarMedidasDoEstribo(ctx, 'Estribo de torção da sapata', ph, y1 - y0, z1 - z0, 'TORCAO');
    if (p.s_tor < 50) ctx.avisos.push({ codigo: 'TORCAO_ESPACAMENTO', texto: `Estribo de torção da sapata a cada ${br(p.s_tor / 10, 1)} cm` });
    if (p.Asl_s > 0) ctx.avisos.push({ codigo: 'TORCAO_LONGITUDINAL', texto: `Armadura longitudinal de torção da sapata (Asl ${br(p.Asl_s)} cm²) não desenhada` });
  }
  // depois de TODAS as barras do trecho que passam pela sapata (transversal, torção, esperas): o dente desvia delas
  if (dente) armarDente(ctx, tr, dente);
}

// ── dente armado ─────────────────────────────────────────────────────────────

/** O retângulo do EIXO do estribo do dente, na seção: yA do lado da ponta, yB do lado do talão; zI embaixo, zS em cima. */
export interface EstriboDoDente { yA: number; yB: number; zI: number; zS: number }

/**
 * A seção do estribo do dente (Jose, 15/11: "similar à da sapata corrida, porém na vertical, com estribos
 * adentrando a sapata corrida"): fechado, em pé, do cobrimento do fundo do dente até LOGO ABAIXO da armadura de cima
 * da sapata — as pernas atravessam a sapata, é isso que as ancora (aba Fundação, seção 11: ℓb,disp = h − c − Ø
 * principal − Ø secundária ≥ ℓb,nec). O ramo de cima não vai ao cobrimento: lá ele cruzaria as longitudinais de cima
 * da sapata e, com Ø do dente maior que o da sapata, entraria nelas (revisão de 15/11); a mesma altura com estribo
 * ou com barra reta, com ou sem malha em cima. Largura b do dente − 2c. null = sem dente, ou dente mais estreito que
 * o estribo fechado (2c + 2Ø + o pino, a regra da planilha: bmin_den) — com aviso.
 */
export function estriboDoDente(ctx: Pick<Ctx, 'p' | 'avisos'>, Ype: number, YbA: number): EstriboDoDente | null {
  const { p } = ctx;
  if (!temDente(p)) return null;
  const c = p.cob_sap;
  const ph = p.phi_den;
  const yc = YbA - p.B_sap / 2 - p.x_den;
  const yA = Math.max(Ype, yc - p.b_den / 2) + c + ph / 2;
  const yB = Math.min(YbA, yc + p.b_den / 2) - c - ph / 2;
  // as duas dobras de 90° no pino do estribo: de eixo a eixo dos ramos, pino + φ (a planilha: b ≥ 2c + 2φ + pino)
  if (yB - yA < pinoEstribo(ph) + ph - 1e-6) {
    const texto = `Dente de ${br(p.b_den / 10, 1)} cm: estreito para o estribo Ø${br(ph, 1)} com cobrimento de ${br(c / 10, 1)} cm — dente sem armadura`;
    if (!ctx.avisos.some((a) => a.codigo === 'DENTE_ESTREITO')) ctx.avisos.push({ codigo: 'DENTE_ESTREITO', texto });
    return null;
  }
  return { yA, yB, zI: -p.h_sap - p.h_den + c + ph / 2, zS: -c - p.phi_sap - p.phi_sap2 - ph / 2 };
}

/**
 * Estribos e longitudinais do dente num trecho.
 *   · estribo Ø phi_den c/ s_den (a conta; sem ela, 20 cm com aviso), ganchos de 135° no canto de BAIXO do lado do
 *     talão: dentro do dente, onde não passa barra da sapata, e na face comprimida (o passivo traciona a da frente).
 *     Cada um num plano livre (planosDoDente): uma bitola de folga de toda barra que atravessa a região dele.
 *   · longitudinais Ø phi_lden por dentro do estribo, nas duas faces do dente: a de baixo no canto, a de cima na raiz
 *     (face de baixo da sapata) e as do meio repartidas — quantas a conta disser (nf_den); emenda como a da sapata,
 *     a barra emendada deitada para CIMA ao longo da perna (para dentro, num dente estreito as das duas faces se
 *     encontravam) e a do canto dos ganchos pela diagonal (fica a um raio das duas pontas dos ganchos, como a do canto).
 */
function armarDente(ctx: Ctx, tr: TrechoModulado, e: EstriboDoDente): void {
  const { p } = ctx;
  const c = p.cob_sap;
  const ph = p.phi_den;
  const pl = p.phi_lden;
  const T = `SAP.T${tr.indice}`;
  const s = p.s_den && p.s_den > 0 ? p.s_den : 200;
  if (!(p.s_den && p.s_den > 0) && !ctx.avisos.some((a) => a.codigo === 'DENTE_ESPACAMENTO')) {
    ctx.avisos.push({ codigo: 'DENTE_ESPACAMENTO', texto: 'Estribo do dente sem espaçamento na conta — desenhado a cada 20 cm (dedução)' });
  }
  const proibidas = faixasProibidas(ctx, tr, e, ph);
  // a volta em espiral ocupa x ± φ: o 1º e o último ficam a c das pontas do trecho
  const { xs, apertado } = planosDoDente(tr.x0 + c + ph, tr.x1 - c - ph, s, 3 * ph, proibidas.centros, proibidas.encostos, proibidas.cruas);
  if (apertado && !ctx.avisos.some((a) => a.codigo === 'DENTE_APERTADO')) {
    ctx.avisos.push({ codigo: 'DENTE_APERTADO', texto: 'Estribo do dente sem plano livre entre as barras da sapata: encostado na barra vizinha (onde nem encostado cabe, o vão passa do espaçamento)' });
  }
  // A ponta do 2º gancho corre a 45° rente ao ramo de baixo, rumo ao outro canto de baixo: no dente estreito ela
  // cruzaria a longitudinal desse canto. A reta da ponta fica a |a − 2·canto − √2·r|/√2 do centro dela e passa mais
  // perto no λ = (a − 2r)/√2 do começo da ponta: a ponta para antes, e o aviso de ponta curta diz quanto ficou.
  const { raio, ponta } = medidasDoEstribo(ph, e.yB - e.yA, e.zS - e.zI);
  const canto = ph / 2 + Math.max(raio - ph / 2, pl / 2);
  const aDente = e.yB - e.yA;
  const R = ph / 2 + pl / 2 + 1;
  const dLinha = Math.abs(aDente - 2 * canto - Math.SQRT2 * raio) * Math.SQRT1_2;
  const pontaMax = dLinha >= R ? Infinity : Math.max(0, ((aDente - 2 * raio) * Math.SQRT1_2) - Math.sqrt(R * R - dLinha * dLinha));
  xs.forEach((x, k) => {
    // 1º canto = o dos ganchos (embaixo, talão); 1º ramo = o de baixo; o degrau da volta fica no ramo de cima
    const b = estribo(`${T}.DE${pad(k + 1, 3)}`, 'DENTE_ESTRIBO', ph, [[x, e.yB, e.zI], [x, e.yA, e.zI], [x, e.yA, e.zS], [x, e.yB, e.zS]], tr.indice, undefined, ph, pontaMax);
    // o "c/" da chamada é o da conta (o desenhado varia: desvia das barras da sapata); sem conta, os 20 cm do aviso
    b.espacamento = s;
    ctx.barras.push(b);
  });
  avisarMedidasDoEstribo(ctx, 'Estribo do dente', ph, e.yB - e.yA, e.zS - e.zI, 'DENTE');
  // a ponta encurtada aqui: o aviso de ponta curta diz a que ficou (no lugar do da seção, se houver)
  if (pontaMax < ponta - 0.01) {
    for (let i = ctx.avisos.length - 1; i >= 0; i--) if (ctx.avisos[i].codigo === 'DENTE_GANCHO') ctx.avisos.splice(i, 1);
    ctx.avisos.push({ codigo: 'DENTE_GANCHO', texto: `Estribo do dente Ø${br(ph, 1)}: ponta do gancho de ${br(pontaMax / 10, 1)} cm (a NBR pede ${br(ganchoEstribo(ph) / 10, 1)} cm) — dente estreito` });
  }
  // Dente do lado da ponta: o momento dele traciona a face de CIMA da sapata, e a conta (seção 11) confere com o aço
  // de cima. Com a transversal reta e o talão sem pedir barra em cima, esse aço não existe (a planilha reprova).
  if (p.denteNaPonta && p.sapTransv === 'reta' && !(p.Mk_heel > 0) && !ctx.avisos.some((a) => a.codigo === 'DENTE_SEM_BARRA_EM_CIMA')) {
    ctx.avisos.push({ codigo: 'DENTE_SEM_BARRA_EM_CIMA', texto: 'Dente do lado da ponta com a transversal reta: a sapata fica sem barra em cima para o momento do dente — usar a transversal em estribo' });
  }

  // longitudinais: a do canto de baixo encosta no ramo e na dobra, como a da sapata (canto, acima)
  const nf = Math.max(2, Math.round(p.nf_den ?? Math.max(2, Math.ceil(p.h_den / 330) + 1)));
  const zs = Array.from({ length: nf }, (_, k) => e.zI + canto + ((-p.h_sap - (e.zI + canto)) * k) / (nf - 1));
  const l0 = traspasse(ctx, pl, 'concreto');
  const D = pl * Math.SQRT1_2;
  (['P', 'T'] as const).forEach((face) => {
    zs.forEach((z, k) => {
      // a do canto fica onde a dobra começa; as de cima, encostadas na perna
      const dentro = k === 0 ? canto : ph / 2 + pl / 2;
      const y = face === 'P' ? e.yA + dentro : e.yB - dentro;
      // a emendada: para cima ao longo da perna; a do canto dos ganchos, pela diagonal, para dentro
      const lado: Vec3 = face === 'T' && k === 0 ? [0, -D, D] : [0, 0, pl];
      ctx.barras.push(...corrida(`${T}.DL${face}${pad(k + 1, 2)}.`, 'DENTE_LONG', pl, tr.x0 + c, tr.x1 - c, y, z, l0, lado, tr.indice));
    });
  });
}

/** Barra "de plano" (estribo, transversal, espera, nó de cachorro): ocupa no máximo isto ao longo do muro, mm. */
const BARRA_DE_PLANO = 100;

/** O feixe que o estribo do dente pode pular quando nem encostado cabe (as esperas de um contraforte), mm. */
const FEIXE = 400;

/**
 * Onde o centro do estribo do dente NÃO pode ficar, ao longo do muro (x): cada barra do trecho que atravessa a região
 * do estribo (a transversal ou o estribo da sapata, o de torção, a espera e o nó de cachorro — barra de plano, que
 * ocupa pouco em x) proíbe o centro a menos de (meia dela + φ do dente + folga) dela; a folga é uma bitola, a maior
 * das duas (o armador amarra um ao lado do outro, com espaço para o concreto passar). A barra que corre ao longo do
 * muro (longitudinal) não entra: dela o estribo se afasta na seção (estriboDoDente e foraDasPernas).
 * `encostos`: onde o centro faria o estribo entrar na barra (sem folga nenhuma) — o limite do caso apertado;
 * `cruas`: os mesmos, barra a barra (sem juntar), para encostar numa delas quando a sapata está toda cerrada.
 */
function faixasProibidas(ctx: Ctx, tr: TrechoModulado, e: EstriboDoDente, ph: number): { centros: [number, number][]; encostos: [number, number][]; cruas: [number, number][] } {
  const centros: [number, number][] = [];
  const encostos: [number, number][] = [];
  // a caixa do estribo do dente na seção (eixo ± raio da barra), com os ganchos dentro dela
  const [ya, yb, za, zb] = [e.yA - ph / 2, e.yB + ph / 2, e.zI - ph / 2, e.zS + ph / 2];
  for (const b of ctx.barras) {
    if (b.trecho !== tr.indice || b.papel.startsWith('DENTE_')) continue;
    let [x0, x1, y0, y1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y, z] of b.eixo) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (z < z0) z0 = z;
      if (z > z1) z1 = z;
    }
    if (x1 - x0 > BARRA_DE_PLANO) continue;
    const r = b.diametro / 2;
    const folga = Math.max(ph, b.diametro);
    // longe da caixa na seção (em y ou em z) por mais que a folga: não atravessa a região do estribo
    if (y1 + r + folga <= ya || y0 - r - folga >= yb || z1 + r + folga <= za || z0 - r - folga >= zb) continue;
    centros.push([x0 - r - ph - folga, x1 + r + ph + folga]);
    encostos.push([x0 - r - ph, x1 + r + ph]);
  }
  return { centros: juntar(centros), encostos: juntar(encostos), cruas: encostos };
}

/** Intervalos ordenados e juntados (os que se tocam viram um). */
function juntar(lista: [number, number][]): [number, number][] {
  const ord = [...lista].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of ord) {
    const u = out[out.length - 1];
    if (u && a <= u[1] + 1e-9) u[1] = Math.max(u[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** O índice do primeiro intervalo que termina depois de q (busca binária; lista ordenada e sem sobreposição). */
function primeiroDepois(lista: [number, number][], q: number): number {
  let [e, d] = [0, lista.length];
  while (e < d) {
    const m = (e + d) >> 1;
    if (lista[m][1] <= q) e = m + 1;
    else d = m;
  }
  return e;
}

/** O ponto de [a, b] fora das faixas proibidas (abertas: a borda vale) mais perto de t; null se não houver. */
function livreMaisPerto(proibidas: [number, number][], t: number, a: number, b: number): number | null {
  if (b < a - 1e-9) return null;
  let melhor: number | null = null;
  let borda = a;
  for (let i = primeiroDepois(proibidas, a); i <= proibidas.length; i++) {
    const f = proibidas[i];
    const fim = f ? Math.min(b, f[0]) : b;
    if (fim >= borda - 1e-9) {
      const q = Math.min(fim, Math.max(borda, t));
      if (melhor === null || Math.abs(q - t) < Math.abs(melhor - t) - 1e-9) melhor = q;
    }
    if (!f || f[0] >= b) break;
    borda = Math.max(borda, f[1]);
    if (borda > b + 1e-9) break;
  }
  return melhor;
}

/**
 * Os pontos SEM SAÍDA: o estribo posto ali não acha ponto livre para o seguinte — a janela dele, [x + mínimo, x + s],
 * cai inteira dentro de uma faixa proibida (a faixa é mais larga que s − mínimo). Para a faixa (zl, zr), são os x de
 * (zl − mínimo, zr − s); entram como proibidos e a conta se repete até não aparecer mais nenhum (a faixa nova pode
 * fechar outra janela). Perto do fim (hi − x ≤ s) não há sem saída: ali o estribo pode ser o último.
 */
function comSemSaida(proibidas: [number, number][], s: number, minimo: number, hi: number): [number, number][] {
  let F = proibidas;
  for (let volta = 0; volta < 50; volta++) {
    const mortos: [number, number][] = [];
    for (const [zl, zr] of F) {
      const [a, b] = [zl - minimo, Math.min(zr, hi) - s];
      if (b > a + 1e-6) mortos.push([a, b]);
    }
    const G = juntar([...F, ...mortos]);
    if (G.length === F.length && G.every((g, i) => Math.abs(g[0] - F[i][0]) < 1e-6 && Math.abs(g[1] - F[i][1]) < 1e-6)) break;
    F = G;
  }
  return F;
}

/**
 * Os planos dos estribos do dente num trecho, de lo a hi (centros), a cada ≤ s (revisão de 15/11 — antes eles
 * desviavam um a um e podiam cair juntos, em cima de outra barra, ou abrir um vão maior que s):
 *   · o 1º no ponto livre mais perto de lo, até s/2 adiante (se uma barra tapa esse pedaço, logo depois dela, até s);
 *   · cada seguinte no ponto livre mais perto do passo que reparte o que falta em partes iguais ≤ s, nunca a menos de
 *     `minimo` do anterior (a folga entre dois do dente) nem a mais de s dele — onde o passo cai numa barra, pode
 *     entrar estribo a mais, e a quantidade passar a da conta (L/s). Livre quer dizer também "com saída"
 *     (comSemSaida): a barra cuja faixa é mais larga que s − mínimo pede o anterior logo antes dela;
 *   · acaba quando chega a hi, ou quando não há ponto livre e o que falta é ≤ s/2 (≤ s se uma barra tapa o fim).
 * Sem ponto livre ao alcance (barras da sapata cerradas, faixa mais larga que s): encostado na barra mais perto do
 * passo e, onde nem encostado cabe, logo depois do feixe (o vão passa de s) — `apertado`. Determinístico: só depende das barras e dos números.
 */
export function planosDoDente(
  lo: number, hi: number, s: number, minimo: number, proibidas0: [number, number][], encostos: [number, number][],
  barras: [number, number][] = encostos,
): { xs: number[]; apertado: boolean } {
  let apertado = false;
  if (hi < lo) return { xs: [(lo + hi) / 2], apertado };
  const proibidas = comSemSaida(proibidas0, s, minimo, hi);
  // Sem ponto livre: encostado na barra mais perto do ponto pedido (amarrado nela, como na obra); onde nem encostado
  // cabe, logo depois do feixe se ele é curto (as esperas do contraforte: o vão passa de s ali); com a sapata inteira
  // cerrada (torção a 2 ou 3 cm), rente à barra mais perto — entra na vizinha, e o aviso diz. Nunca dente sem estribo.
  const encostado = (t: number, a: number, b: number): number => {
    apertado = true;
    const q = livreMaisPerto(encostos, t, a, b) ?? livreMaisPerto(encostos, b, b, Math.min(hi, b + FEIXE));
    if (q !== null) return q;
    let melhor = Math.min(Math.max(t, a), b);
    for (const [e0, e1] of barras) for (const v of [e0, e1]) {
      if (v >= a - 1e-9 && v <= b + 1e-9 && Math.abs(v - t) < Math.abs(melhor - t)) melhor = v;
    }
    return melhor;
  };
  const primeiro = livreMaisPerto(proibidas, lo, lo, Math.min(hi, lo + s / 2))
    ?? livreMaisPerto(proibidas, lo, lo, Math.min(hi, lo + s))
    ?? encostado(lo, lo, Math.min(hi, lo + s / 2));
  const xs: number[] = [primeiro];
  for (let guarda = 0; guarda < 1e6; guarda++) {
    const ant = xs[xs.length - 1];
    const falta = hi - ant;
    if (falta <= 1e-6) break;
    const passo = falta / Math.max(1, Math.ceil(falta / s - 1e-9));
    const [a, b] = [ant + minimo, Math.min(hi, ant + s)];
    let x = livreMaisPerto(proibidas, ant + passo, a, b);
    if (x === null) {
      if (falta <= s + 1e-6) break;
      x = encostado(ant + passo, a, b);
    }
    xs.push(x);
  }
  return { xs, apertado };
}

/**
 * Para que lado a barra emendada da longitudinal da sapata deita (`padrao`, ±φ): o de sempre, a não ser que ele a
 * ponha em cima de uma perna do estribo do dente — então o outro, se ficar na faixa da camada. Sem dente, o de sempre.
 */
function ladoDaEmenda(y: number, padrao: number, phi: number, pernas: { y: number; meia: number }[], lo: number, hi: number): number {
  const bate = (q: number) => pernas.some((pn) => Math.abs(q - pn.y) < pn.meia + phi / 2 - 1e-6);
  if (!bate(y + padrao)) return padrao;
  const outro = y - padrao;
  return !bate(outro) && outro >= lo - 1e-6 && outro <= hi + 1e-6 ? -padrao : padrao;
}

/**
 * A longitudinal da sapata que cairia em cima de uma perna do estribo do dente encosta ao lado dela — do lado em que
 * já estava, a não ser que esse lado a tire da faixa da camada [lo, hi] (a do canto, com o dente rente à borda da
 * sapata, sairia do cobrimento): então do outro lado.
 */
function foraDasPernas(ys: number[], phi: number, pernas: { y: number; meia: number }[], lo: number, hi: number): number[] {
  return ys.map((y) => {
    for (const pn of pernas) {
      const folga = pn.meia + phi / 2;
      if (Math.abs(y - pn.y) < folga - 1e-6) {
        const [perto, longe] = y >= pn.y ? [pn.y + folga, pn.y - folga] : [pn.y - folga, pn.y + folga];
        return perto >= lo - 1e-6 && perto <= hi + 1e-6 ? perto : longe;
      }
    }
    return y;
  });
}

/** Onde estão as transversais ao longo do trecho (x do plano de cada uma) e quanto cada uma ocupa para cada lado. */
interface Transversais { xs: number[]; meia: number }

/**
 * A transversal RETA, como era até 15/10 (sap_transv = 'Reta'): Ø phi_sap c/ s_ps na face de baixo (e na de cima
 * quando o talão pede, "mesma armadura nas duas faces"), longitudinal Ø phi_sap2 c/ s_ss sobre ela. Não mexer: a
 * opção existe para reproduzir o desenho de antes, barra por barra (modulacao.test.ts confere contra o de 15/10).
 */
function sapataReta(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number, s1: number, s2: number, pernas: { y: number; meia: number }[]): Transversais {
  const { p } = ctx;
  const h = p.h_sap;
  const c = p.cob_sap;
  const T = `SAP.T${tr.indice}`;
  const xs = distribuir(tr.x0 + c, tr.x1 - c, s1);
  const faces = p.Mk_heel > 0 ? ['I', 'S'] : ['I'];
  for (const face of faces) {
    const zT = face === 'I' ? -h + c + p.phi_sap / 2 : -c - p.phi_sap / 2;
    xs.forEach((x, k) => {
      ctx.barras.push(reta(`${T}.T${face}${pad(k + 1, 3)}`, 'SAP_TRANSV', p.phi_sap, [x, Ype + c, zT], [x, YbA - c, zT], tr.indice));
    });
    const zL = face === 'I' ? -h + c + p.phi_sap + p.phi_sap2 / 2 : -c - p.phi_sap - p.phi_sap2 / 2;
    foraDasPernas(distribuir(Ype + c, YbA - c, s2), p.phi_sap2, pernas, Ype + c, YbA - c).forEach((y, k) => {
      const lado = ladoDaEmenda(y, p.phi_sap2, p.phi_sap2, pernas, Ype + c, YbA - c);
      const bs = corrida(`${T}.L${face}${pad(k + 1, 2)}.`, 'SAP_LONG', p.phi_sap2, tr.x0 + c, tr.x1 - c, y, zL, traspasse(ctx, p.phi_sap2, 'concreto'), [0, lado, 0], tr.indice);
      ctx.barras.push(...bs);
    });
  }
  return { xs, meia: p.phi_sap / 2 };
}

/**
 * A transversal em ESTRIBO FECHADO em volta da seção B × h (sem o dente), Jose 15/10: "do jeito que sai a armação
 * hoje não se sustenta na obra; se fizer como estribos a armadura ganha estrutura sem gambiarra". Ø phi_sap c/ s_ps,
 * cobrimento cob_sap até a superfície dos ramos. A forma do estribo é a do Pró-Viga (barras.ts), ganchos no canto de
 * cima do lado do pé — fora do talão, onde a face de cima pode tracionar.
 *   · ramo de baixo = a armadura principal da conta, na mesma altura da barra reta de antes;
 *   · ramo de cima = a armadura de cima quando o talão pede (Mk_heel > 0: mesmo Ø e espaçamento da reta de cima de
 *     antes, na mesma altura, e agora contínua com os ramos em pé e dobrada nos cantos — ancora melhor que a reta);
 *     sem Mk_heel ele é construtivo, é o que fecha o estribo;
 *   · ramos em pé: só montagem — a conta não dá crédito a eles (cortante da sapata sem estribo, VRd1).
 * Longitudinal Ø phi_sap2 por DENTRO do estribo: embaixo, c/ s_ss, apoiada no ramo de baixo, a dos cantos dentro da
 * dobra; em cima, a malha c/ s_ss quando o talão pede e, sem ele, só as duas dos cantos (o porta-estribo).
 */
function sapataEmEstribos(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number, s1: number, s2: number, pernas: { y: number; meia: number }[]): Transversais {
  const { p } = ctx;
  const h = p.h_sap;
  const c = p.cob_sap;
  const phi = p.phi_sap;
  const phi2 = p.phi_sap2;
  const T = `SAP.T${tr.indice}`;
  // eixo dos ramos a c + φ/2 das faces
  const y0 = Ype + c + phi / 2;
  const y1 = YbA - c - phi / 2;
  const zI = -h + c + phi / 2;
  const zS = -c - phi / 2;
  // a volta em espiral ocupa x ± φ (±φ/2 do degrau + o raio da barra): o 1º e o último ficam a c das pontas do trecho
  const xs = distribuir(tr.x0 + c + phi, tr.x1 - c - phi, s1);
  xs.forEach((x, k) => {
    ctx.barras.push(estribo(`${T}.T${pad(k + 1, 3)}`, 'SAP_TRANSV', phi, [[x, y0, zS], [x, y1, zS], [x, y1, zI], [x, y0, zI]], tr.indice));
  });
  avisarMedidasDoEstribo(ctx, 'Estribo da sapata', phi, y1 - y0, zS - zI, 'SAPATA');

  // longitudinal: a do canto encosta no ramo e na dobra (a barra mais fina que o raio de dentro da dobra fica onde a
  // dobra começa: dali para o canto, a curva a levantaria do ramo)
  const { raio } = medidasDoEstribo(phi, y1 - y0, zS - zI);
  const encosto = phi / 2 + Math.max(raio - phi / 2, phi2 / 2);
  const [ya, yb] = [y0 + encosto, y1 - encosto];
  const l0 = traspasse(ctx, phi2, 'concreto');
  for (const face of ['I', 'S'] as const) {
    const zL = face === 'I' ? zI + phi / 2 + phi2 / 2 : zS - phi / 2 - phi2 / 2;
    const ys = foraDasPernas(face === 'I' || p.Mk_heel > 0 ? distribuir(ya, yb, s2) : [ya, yb], phi2, pernas, ya, yb);
    ys.forEach((y, k) => {
      // a barra emendada deita ao lado da outra, para DENTRO do estribo (a do canto do talão iria para a dobra)
      const lado: Vec3 = [0, ladoDaEmenda(y, y > (ya + yb) / 2 ? -phi2 : phi2, phi2, pernas, ya, yb), 0];
      ctx.barras.push(...corrida(`${T}.L${face}${pad(k + 1, 2)}.`, 'SAP_LONG', phi2, tr.x0 + c, tr.x1 - c, y, zL, l0, lado, tr.indice));
    });
  }
  return { xs, meia: phi };
}

/**
 * O estribo de torção que cairia no lugar de uma transversal (centros a menos de `folga`) vai para o lado dela,
 * encostado — o mais perto de onde estava, dentro de [lo, hi] e sem cair em outra. Sem lugar, fica onde estava.
 */
function encostar(xs: number[], ocupados: number[], folga: number, lo: number, hi: number): number[] {
  const livre = (q: number) => ocupados.every((o) => Math.abs(o - q) >= folga - 1e-6);
  return xs.map((x) => {
    if (livre(x)) return x;
    const cands = ocupados
      .filter((o) => Math.abs(o - x) < folga)
      .flatMap((o) => [o - folga, o + folga])
      .filter((q) => q >= lo - 1e-6 && q <= hi + 1e-6 && livre(q));
    return cands.length ? cands.reduce((m, q) => (Math.abs(q - x) < Math.abs(m - x) ? q : m)) : x;
  });
}

// ── drenagem ─────────────────────────────────────────────────────────────────

/** O barbacã sai 5 cm para fora da face do muro e entra 5 cm no dreno (Jose, 14/10: "os barbacãs sumiram" — rente
 *  à face, o tubo ficava escondido dentro do bloco). */
export const SALIENCIA_BARBACA = 50;

/** Barbacã atravessando a canaleta: o tubo fica 2 cm abaixo da borda do U (mm). */
const FOLGA_DA_BORDA_DO_U = 20;

/**
 * O PACOTE DO DRENO no corte, em coordenadas da face do tardoz (u = 0, cresce para o solo) e do topo da sapata
 * (v = 0): a brita é a união de dois retângulos encostados no muro e no talão — a camada do tardoz (dreno_esp de
 * espessura) e a envoltória quadrada do dreno de fundo (drenof_env de lado, o tubo no meio) —, um degrau quando a
 * envoltória é mais larga que a camada. Em volta, do lado do solo, a areia (filtro, Jose 14/10) e por fora a manta.
 * `dreno_folga` é medida do topo do solo até o topo do PACOTE (o lado de fora da manta).
 */
export interface PacoteDoDreno {
  retangulos: [number, number][];   // (largura, altura) da brita: camada do tardoz e/ou envoltória do tubo
  fora: number;                     // areia + manta: quanto o pacote cresce em volta da brita
  fundo: boolean;                   // tem dreno de fundo (tubo)
}

export function pacoteDoDreno(ctx: Ctx): PacoteDoDreno {
  const { p } = ctx;
  const fora = p.areia_esp + ESPESSURA_MANTA;
  const retangulos: [number, number][] = [];
  const hVert = p.H_solo - p.dreno_folga - fora;
  if (p.dreno && hVert > 0 && p.dreno_esp > 0) retangulos.push([p.dreno_esp, hVert]);
  const f = p.drenof_env;
  let fundo = p.drenof && p.drenof_phi > 0 && f > p.drenof_phi;
  if (fundo && f + fora > p.H_solo) {
    fundo = false;
    if (!ctx.avisos.some((a) => a.codigo === 'DRENO_FUNDO_NAO_CABE')) {
      ctx.avisos.push({ codigo: 'DRENO_FUNDO_NAO_CABE', texto: 'Dreno de fundo mais alto que o solo: não desenhado' });
    }
  }
  if (fundo) retangulos.push([f, f]);
  return { retangulos, fora, fundo };
}

/**
 * A borda de fora da união dos retângulos [0, w] × [0, h], do talão (v = 0) até a face do muro (u = 0) — no
 * sentido anti-horário de quem fecha o polígono por (0, 0). `cresce` engorda cada retângulo para o lado do solo.
 */
export function bordaDoPacote(retangulos: [number, number][], cresce = 0): Vec2[] {
  const r = retangulos.map(([w, h]) => [w + cresce, h + cresce] as [number, number]).sort((a, b) => b[0] - a[0]);
  if (!r.length) return [];
  const [wL, hL] = r[0];
  const alto = r.find(([, h]) => h > hL + 1e-6);   // o estreito só entra se passar da altura do largo
  if (!alto) return [[wL, 0], [wL, hL], [0, hL]];
  const [wA, hA] = alto;
  return semDuplicados([[wL, 0], [wL, hL], [wA, hL], [wA, hA], [0, hA]]);
}

/** A faixa entre duas bordas (a areia, a manta): a de fora subindo, a de dentro descendo. */
function faixaDoPacote(retangulos: [number, number][], de: number, ate: number): Vec2[] {
  return semDuplicados([...bordaDoPacote(retangulos, ate), ...bordaDoPacote(retangulos, de).reverse()]);
}

export function drenagem(ctx: Ctx, tr: TrechoModulado, mapa: MapaDeCavidades): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  const T = `T${tr.indice}`;

  // Pacote do dreno no tardoz, do topo da sapata para cima; com contraforte enterrado, um por vão (contorna as
  // hastes — o tubo do dreno de fundo também para em cada contraforte)
  const pac = pacoteDoDreno(ctx);
  if (pac.retangulos.length) {
    const vaos: [number, number][] = [];
    if (p.contrafortes && p.enterrado) {
      for (let v = 0; v + 1 < tr.nos.length; v++) vaos.push([tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs]);
    } else {
      vaos.push([tr.x0, tr.x1]);
    }
    const a = p.areia_esp;
    const es = ESPESSURA_MANTA;
    const f = p.drenof_env;
    const d = p.drenof_phi;
    const medidas = pac.retangulos.map(([w, h]) => `${fmt(w)}x${fmt(h)}`).join('+');
    // o tubo atravessa a brita: furo no perfil dela (o volume de brita do quantitativo já sai sem o tubo)
    const furo = pac.fundo ? [retanguloArredondado(d, d, d / 2, f / 2 - d / 2, f / 2 - d / 2, true)] : undefined;
    vaos.forEach(([xa, xb], k) => {
      const L = xb - xa;
      if (L <= 0) return;
      const v = `v${k + 1}`;
      const gB = `dreno ${medidas}${pac.fundo ? ` tubo Ø${fmt(d)}` : ''} L${fmt(L)}`;
      if (!ctx.geos[gB]) ctx.geos[gB] = prisma(gB, 'X', [[0, 0], ...bordaDoPacote(pac.retangulos)], L, furo, 'brita');
      ctx.pecas.push({ id: `${T}.DRN.${v}`, tipo: 'DRENO', grupo: 'drenagem', geometria: gB, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      if (a > 0) {
        const gA = geoPrismaReto(ctx, `areia ${fmt(a)} sobre ${medidas} L${fmt(L)}`, 'X', faixaDoPacote(pac.retangulos, 0, a), L, 'areia');
        ctx.pecas.push({ id: `${T}.ARE.${v}`, tipo: 'AREIA', grupo: 'drenagem', geometria: gA, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      }
      const gM = geoPrismaReto(ctx, `manta sobre ${medidas} areia ${fmt(a)} L${fmt(L)}`, 'X', faixaDoPacote(pac.retangulos, a, a + es), L, 'manta geotêxtil');
      ctx.pecas.push({ id: `${T}.MNT.${v}`, tipo: 'MANTA', grupo: 'drenagem', geometria: gM, origem: [arred(xa), t, 0], giro: 0, trecho: tr.indice });
      if (pac.fundo) {
        const gT = geoPrismaReto(ctx, `tubo do dreno Ø${fmt(d)} L${fmt(L)}`, 'X', circulo(d), L, `tubo perfurado Ø${fmt(d)} mm`);
        ctx.pecas.push({
          id: `${T}.TDF.${v}`, tipo: 'TUBO_DRENO', grupo: 'drenagem', geometria: gT,
          origem: [arred(xa), arred(t + f / 2 - d / 2), arred(f / 2 - d / 2)], giro: 0, trecho: tr.indice,
        });
      }
    });
  }

  // Barbacãs na 1ª fiada com o tubo todo acima do solo da frente (o aterro sobre a ponta, h_fr — Jose, 14/10), no
  // furo de um bloco do muro, fora do contraforte: numa célula sem graute; com graute total, numa grauteada (o tubo
  // vai antes do graute). Nunca numa célula com barra (o tubo atravessaria a barra) nem na canaleta (o tubo furaria as
  // paredes do U e passaria na altura da barra da canaleta): fiada assim, o barbacã sobe para a de cima, até o topo do
  // solo. Sem célula nenhuma até o topo do solo — o muro todo em canaleta, por exemplo —, o barbacã ATRAVESSA a
  // canaleta da 1ª fiada acima do solo da frente (Jose, 15/10: muro sem barbacã é pior que canaleta furada): o tubo
  // passa pelas duas paredes do U no alto, acima da barra, posto antes do graute, e longe das barras verticais que
  // sobem pela canaleta. Só quando nem assim cabe o barbacã não é desenhado, e o aviso diz.
  if (p.barbaca && p.barbaca_phi > 0 && p.barbaca_s > 0 && mod.n_fiadas > 0) {
    const d = p.barbaca_phi;
    const foraDosNos = (x: number): boolean => !tr.nos.some((no) => x > no.xs - JUNTA - d / 2 && x < no.xe + d / 2);
    const zDaFiada = (f: number): number => f * H_FIADA + JUNTA + H_BLOCO / 2;
    const celulas = (fiada: number): { cand: number[]; emCanaleta: boolean } => {
      const zc = zDaFiada(fiada);
      const daFiada = mapa.fiada(fiada);
      const comBarra = new Map<Cavidade, { x: number; r: number }[]>();
      for (const b of ctx.barras) {
        if (b.trecho !== tr.indice) continue;
        for (let k = 0; k + 1 < b.eixo.length; k++) {
          const [a, c] = [b.eixo[k], b.eixo[k + 1]];
          if (Math.abs(a[0] - c[0]) > 1e-6 || Math.abs(a[1] - c[1]) > 1e-6) continue;
          if (Math.min(a[2], c[2]) >= zc + d / 2 || Math.max(a[2], c[2]) <= zc - d / 2) continue;
          const f = mapa.achar(fiada, a[0], a[1]);
          if (f) comBarra.set(f.cav, [...(comBarra.get(f.cav) ?? []), { x: a[0], r: b.diametro / 2 }]);
        }
      }
      const naParede = daFiada.filter((c) => c.tipo === 'furo' && Math.abs(c.cy - t / 2) < 1e-6 && ctx.pecas[c.peca].grupo === 'muro' && foraDosNos(c.cx));
      const daParede = naParede.filter((c) => !comBarra.has(c));
      let cand = daParede.filter((c) => !c.grauteada).map((c) => c.cx);
      if (!cand.length) cand = daParede.map((c) => c.cx);
      // Furo com barra vertical (Jose, 13/11: "ou só deslocar o barbacã do ferro vertical"): o tubo passa no mesmo
      // furo, ao lado da barra — a 1 cm dela — se couber inteiro no furo, também a 1 cm da borda. O tubo vai antes do
      // graute. Só quando a fiada não tem furo livre: furo sem barra continua sendo o primeiro lugar.
      if (!cand.length) {
        for (const c of naParede) {
          const barras = comBarra.get(c);
          if (!barras) continue;
          for (const lado of [-1, 1]) {
            const ref: number = lado < 0 ? Math.min(...barras.map((q) => q.x - q.r)) : Math.max(...barras.map((q) => q.x + q.r));
            const x: number = ref + lado * (10 + d / 2);
            const livre = barras.every((q) => Math.abs(x - q.x) >= q.r + d / 2 + 10 - 1e-6);
            if (livre && Math.abs(x - c.cx) + d / 2 <= c.a - 10 + 1e-6) cand.push(arred(x));
          }
        }
      }
      return { cand, emCanaleta: daFiada.some((c) => c.tipo === 'canaleta' && Math.abs(c.cy - t / 2) < 1e-6) };
    };
    /** O furo na canaleta da fiada `f`: o tubo no alto do U (2 cm abaixo da borda), 1 cm acima da barra mais alta da
     *  canaleta, e x a cada 5 cm onde não passa barra vertical nem contraforte. null = não cabe. */
    const naCanaleta = (f: number): { zc: number; cand: number[] } | null => {
      const base = f * H_FIADA;
      const zc = base + JUNTA + H_BLOCO - FOLGA_DA_BORDA_DO_U - d / 2;
      let topoDaBarra = base + JUNTA;
      const verticais: { x: number; r: number }[] = [];
      for (const b of ctx.barras) {
        if (b.trecho !== tr.indice) continue;
        for (let k = 0; k + 1 < b.eixo.length; k++) {
          const [a, c] = [b.eixo[k], b.eixo[k + 1]];
          const deitado = Math.abs(a[2] - c[2]) < 1e-6;
          if (deitado && a[2] >= base && a[2] <= base + H_FIADA) topoDaBarra = Math.max(topoDaBarra, a[2] + b.diametro / 2);
          const empe = Math.abs(a[0] - c[0]) < 1e-6 && Math.abs(a[1] - c[1]) < 1e-6;
          if (empe && Math.min(a[2], c[2]) < zc + d / 2 && Math.max(a[2], c[2]) > zc - d / 2) verticais.push({ x: a[0], r: b.diametro / 2 });
        }
      }
      // acima do aterro não há o que drenar (o tubo sairia por cima do dreno)
      if (zc - d / 2 < topoDaBarra + 10 || zc + d / 2 > p.H_solo) return null;
      const folga = (x: number) => verticais.every((v) => Math.abs(x - v.x) > d / 2 + v.r + 10);
      const cand: number[] = [];
      for (let x = tr.x0 + d; x <= tr.x1 - d; x += 50) if (foraDosNos(x) && folga(x)) cand.push(x);
      return cand.length ? { zc, cand } : null;
    };
    let fiada = 0;
    while (zDaFiada(fiada) - d / 2 < p.h_fr - 1e-6) fiada++;
    const fiadaAcimaDaFrente = fiada;
    const abaixoDoAterro = fiada < mod.n_fiadas && zDaFiada(fiada) + d / 2 <= p.H_solo;
    const primeira = abaixoDoAterro ? celulas(fiada) : { cand: [], emCanaleta: false };
    let { cand } = primeira;
    while (!cand.length && fiada + 1 < mod.n_fiadas && zDaFiada(fiada + 1) + d / 2 <= p.H_solo) cand = celulas(++fiada).cand;
    let zc = zDaFiada(fiada);
    if (!cand.length && primeira.emCanaleta) {
      const furo = naCanaleta(fiadaAcimaDaFrente);
      if (furo) [fiada, zc, cand] = [fiadaAcimaDaFrente, furo.zc, furo.cand];
    }
    // ALTURA PEDIDA (Jose, 13/11): o eixo do barbacã acima do topo da sapata, na fiada em que ele cai; ligado ao dreno
    // de fundo, a altura é a do centro do tubo perfurado e o barbacã vai da face do muro até lá (a saída do dreno de
    // cada vão, sem furar o contraforte). Fiada sem célula livre nessa altura: fica a automática, com aviso.
    const ligado = p.barbaca_dreno && pac.fundo;
    const zPedido = ligado ? p.drenof_env / 2 : p.barbaca_z;
    let Lb = t + 2 * SALIENCIA_BARBACA;
    if (zPedido !== null && zPedido > 0) {
      const fz = Math.min(mod.n_fiadas - 1, Math.max(0, Math.floor(zPedido / H_FIADA)));
      const livres = celulas(fz).cand;
      if (livres.length) {
        [fiada, zc, cand] = [fz, zPedido, livres];
        if (ligado) Lb = t + SALIENCIA_BARBACA + p.drenof_env / 2;
      } else if (!ctx.avisos.some((a) => a.codigo === 'BARBACA_ALTURA')) {
        ctx.avisos.push({ codigo: 'BARBACA_ALTURA', texto: `Barbacã a ${br(zPedido / 1000, 2)} m: a fiada não tem célula livre, ficou na altura automática` });
      }
      if (zc - d / 2 < p.h_fr - 1e-6 && !ctx.avisos.some((a) => a.codigo === 'BARBACA_ABAIXO_DA_FRENTE')) {
        ctx.avisos.push({ codigo: 'BARBACA_ABAIXO_DA_FRENTE', texto: 'Barbacã abaixo do aterro da frente: a saída fica enterrada' });
      }
    }
    const conta = ctx.barbacas ?? (ctx.barbacas = { pedidos: 0, desenhados: 0, emCanaleta: false });
    if (primeira.emCanaleta) conta.emCanaleta = true;
    if (!abaixoDoAterro) conta.acimaDoAterro = true;
    // Com contraforte enterrado o dreno é um por vão e o contraforte não é furado (Jose, 14/10: "cada contraforte com
    // seu dreno, vamos furar eles não"): cada vão precisa da sua saída, então os barbacãs se distribuem VÃO A VÃO, no
    // mínimo um em cada. Sem isso, vão de 1,35 com barbacã a cada 1,50 deixava vão com o dreno sem saída.
    const faixas: [number, number][] = [];
    if (p.contrafortes && p.enterrado && tr.nos.length > 1) {
      for (let v = 0; v + 1 < tr.nos.length; v++) faixas.push([tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs]);
    } else {
      faixas.push([tr.x0, tr.x1]);
    }
    const usados = new Set<number>();
    const geo = geoPrismaReto(ctx, `barbacã Ø${fmt(d)} L${fmt(Lb)}`, 'X', circulo(d), Lb, `tubo Ø${fmt(d)} mm`);
    let j = 0;
    for (const [xa, xb] of faixas) {
      const Lf = xb - xa;
      if (Lf <= 0) continue;
      // espaçamento pedido é o MÁXIMO (Jose: barbacã "a cada 1,50 m"): arredondar para baixo o número de barbacãs
      // deixava 2,00 m entre dois deles num muro de 6,6 m (medido na revisão de 14/10)
      const n = Math.max(1, Math.ceil(Lf / p.barbaca_s - 1e-9));
      conta.pedidos += n;
      for (let i = 0; i < n; i++) {
        const alvo = xa + ((i + 0.5) * Lf) / n;
        let melhor = -1;
        cand.forEach((x, k) => {
          if (usados.has(k) || x < xa || x > xb) return;
          if (melhor < 0 || Math.abs(x - alvo) < Math.abs(cand[melhor] - alvo) - 1e-9) melhor = k;
        });
        if (melhor < 0) break;
        usados.add(melhor);
        conta.desenhados++;
        const x = cand[melhor];
        ctx.pecas.push({
          id: `${T}.BBC.${pad(++j, 2)}`, tipo: 'BARBACA', grupo: 'drenagem', geometria: geo,
          origem: [arred(x - d / 2), -SALIENCIA_BARBACA, arred(zc - d / 2)], giro: 90, trecho: tr.indice, fiada,
        });
      }
    }
  }
}

// ── terreno (só para ver) ────────────────────────────────────────────────────

export function terreno(ctx: Ctx, tr: TrechoModulado, Ype: number, YbA: number): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  const zb = -(p.h_sap + (temDente(p) ? p.h_den : 0));
  const ultimo = tr.indice === mod.trechos.length;
  const xa = tr.x0 - (tr.indice > 1 ? JUNTA / 2 : 0);
  const xb = tr.x1 + (ultimo ? 0 : JUNTA / 2);
  const L = xb - xa;
  const T = `T${tr.indice}`;
  const H = p.H_solo;

  // aterro atrás do muro até a altura de solo da conta (não até o topo do muro desenhado — decisão do Jose), sem o
  // pacote do dreno (brita, areia e manta: a borda de fora dele, em degrau quando há dreno de fundo)
  const pac = pacoteDoDreno(ctx);
  const borda = bordaDoPacote(pac.retangulos, pac.fora).map(([u, v]) => [t + u, v] as Vec2);
  const yA = borda.length ? borda[0][0] : t;
  const y1 = Math.max(YbA, yA);
  const yFar = Math.max(y1, p.contrafortes && p.enterrado ? mod.tenr : t) + SOBRA_TERRENO;
  // do topo do solo DESCE pela face do muro até o topo do pacote e só então contorna o pacote: o último ponto da borda
  // é esse canto (face do muro, topo do pacote). Sem ele (14/10 a 15/10) o aterro ia em diagonal do topo do solo ao
  // canto de fora do pacote e deixava um triângulo vazio junto do muro, logo abaixo do topo (Jose, 15/10)
  const aterro = semDuplicados([[yA, 0], [y1, 0], [y1, zb], [yFar, zb], [yFar, H], [t, H], ...[...borda].reverse()]);
  if (H > 0) {
    const g = geoPrismaReto(ctx, `aterro ${T}`, 'X', aterro, L);
    ctx.pecas.push({ id: `${T}.ATERRO`, tipo: 'ATERRO', grupo: 'terreno', geometria: g, origem: [arred(xa), arred(Math.min(...aterro.map((q) => q[0]))), arred(zb)], giro: 0, trecho: tr.indice });
  }

  // solo da frente: ao lado da sapata até o topo dela (Fig. 15) e, com aterro sobre a ponta (h_fr), por cima da
  // ponta até a face do muro. Contraforte aparente: o aterro sobre a ponta para na ponta dele e entra por vão.
  const hf = p.h_fr;
  const y0 = Math.min(Ype, 0);
  const aparente = p.contrafortes && !p.enterrado;
  const yNear = Math.min(y0, aparente ? t - mod.tenr : 0) - SOBRA_TERRENO;
  const yC = aparente ? Math.max(y0, t - mod.tenr) : 0;
  const frente: Vec2[] = hf > 0
    ? semDuplicados([[yNear, zb], [y0, zb], [y0, 0], [yC, 0], [yC, hf], [yNear, hf]])
    : [[yNear, zb], [y0, zb], [y0, 0], [yNear, 0]];
  const gF = geoPrismaReto(ctx, `solo da frente ${T}`, 'X', frente, L);
  ctx.pecas.push({ id: `${T}.SOLO`, tipo: 'SOLO_FRENTE', grupo: 'terreno', geometria: gF, origem: [arred(xa), arred(yNear), arred(zb)], giro: 0, trecho: tr.indice });
  if (hf > 0 && aparente && yC < 0) {
    for (let v = 0; v + 1 < tr.nos.length; v++) {
      const [x0, x1] = [tr.nos[v].xe - JUNTA, tr.nos[v + 1].xs];
      if (x1 <= x0) continue;
      const g = geoPrismaReto(ctx, `solo sobre a ponta ${fmt(-yC)}x${fmt(hf)} L${fmt(x1 - x0)}`, 'X', retangulo(-yC, hf), x1 - x0);
      ctx.pecas.push({ id: `${T}.SOLO.v${v + 1}`, tipo: 'SOLO_FRENTE', grupo: 'terreno', geometria: g, origem: [arred(x0), arred(yC), 0], giro: 0, trecho: tr.indice });
    }
  }
}

function semDuplicados(p: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const q of p) {
    const u = out[out.length - 1];
    if (!u || Math.abs(u[0] - q[0]) > 1e-6 || Math.abs(u[1] - q[1]) > 1e-6) out.push(q);
  }
  return out;
}

// ── conferências que não dependem do trecho ──────────────────────────────────

export function conferenciasGerais(ctx: Ctx, Ype: number, YbA: number): void {
  const { p, mod } = ctx;
  const t = mod.cat.t;
  // espera: o trecho vertical dentro da sapata tem de ancorar ℓb (brief §7.1 — nenhuma aba confere)
  const disponivel = p.h_sap - p.cob_sap - p.phi_sap - p.phi_sap2;
  if (p.lb !== null && disponivel < p.lb - 0.5) {
    ctx.avisos.push({ codigo: 'ESPERA_NAO_CABE', texto: `Espera: ${br(disponivel / 10, 1)} cm na sapata para ℓb = ${br(p.lb / 10, 1)} cm` });
  }
  if (p.traspasse === null && (p.lbphi_gr === null || p.a0t === null)) {
    ctx.avisos.push({ codigo: 'TRASPASSE_ADOTADO', texto: 'Traspasse: ℓb da conta indisponível — adotado 50φ (dedução)' });
  }
  // barbacã pedido e não desenhado (drenagem.ts conta por trecho; o aviso é um só, do muro todo)
  const bb = ctx.barbacas;
  if (bb && bb.desenhados < bb.pedidos) {
    const onde = bb.acimaDoAterro ? 'sem fiada entre o solo da frente e o topo do aterro' : bb.emCanaleta ? 'canaleta sem lugar para o tubo' : '1ª fiada sem célula livre';
    ctx.avisos.push({
      codigo: 'BARBACA_SEM_CELULA',
      texto: bb.desenhados === 0 ? `Barbacã não desenhado: ${onde}` : `Barbacã: ${bb.desenhados} de ${bb.pedidos} desenhados (${onde})`,
    });
  }
  if (p.contrafortes) {
    const fora = p.enterrado ? mod.tenr > YbA + 0.5 : t - mod.tenr < Ype - 0.5;
    if (fora) ctx.avisos.push({ codigo: 'CF_FORA_DA_SAPATA', texto: 'Contraforte passa da borda da sapata' });
  }
}
