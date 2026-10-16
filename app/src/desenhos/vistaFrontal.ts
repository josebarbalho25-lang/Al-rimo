/*
  VISTA FRONTAL — elevação XZ olhando a face aparente (de −Y para +Y), X para a direita, Z para cima.

  O que se vê é o que está mais perto: as peças são pintadas da mais funda para a mais rasa (algoritmo do
  pintor em Y). A haste do contraforte enterrado fica toda atrás do muro: não é pintada, aparece só o contorno
  tracejado (escondido) e o eixo — como numa elevação de obra. A sapata está abaixo do terreno: tracejada.

  Cada bloco vai pintado com a cor do tipo (cores.ts — as cores do Jose no Revit), com legenda: a vista frontal é
  a paginação que vai para a obra, e o pedreiro acha o meio bloco e o 54 pela cor.

  O graute dos furos aparece por cima do bloco (como na Fig. 5): é escondido de verdade, mas é a informação que o
  pedreiro precisa na elevação — onde grautear. Vai como uma SOMBRA VERTICAL (Jose, 16/10: "esse graute com hachura
  diagonal polui; temos de criar somente uma sombra vertical pra representar o furo grauteado"): uma faixa só por
  coluna de furo, num cinza transparente — o bloco continua com a cor dele por baixo (o código de cores vale nas
  fiadas grauteadas também). A cor e a transparência são as do graute na tabela de gráficos (superfície).
*/
import type { Barra, Modelo } from '@/modelo/tipos';
import { cm, cmCheio } from './formato';
import {
  ALVENARIA, contrafortesDoModelo, projecao, projetarPontos, solidosDoModelo, type Regiao, type Solido,
} from './geometria';
import { desenharLegenda, estiloPintado, itensDasTintas, tintaDaPeca, tintasPresentes, type Amostra } from './cores';
import { COR, Prancha, escalaPara, type Estilo, type OpcoesDaVista, type Pt } from './prancha';
import { CORPO_DA_COTA, MAIUSCULA_DA_ARIAL } from '@/pranchas/tipos';
import { ancoraNaBarra, desenharChamadas, desenharEtiquetas, elementoDaBarra, type Chamada } from './chamadas';
import { SOMBRA_DO_GRAUTE, aparece as apareceNa, corDaSombraDoGraute, corDoAcoNoDesenho, emMeioTom, hachuraDe, meioTomDe, naVista, opacidadeDe, type Material } from './graficos';

/** Corridas de intervalos iguais viram uma cota só: "12×40" em vez de doze "40" espremidos. */
export function cadeia(pontos: number[]): { a: number; b: number; rotulo: string }[] {
  const p = [...new Set(pontos.map((x) => Math.round(x)))].sort((u, v) => u - v);
  const out: { a: number; b: number; rotulo: string }[] = [];
  let k = 0;
  while (k + 1 < p.length) {
    const s = p[k + 1] - p[k];
    let j = k + 1;
    while (j + 1 < p.length && Math.abs(p[j + 1] - p[j] - s) < 0.5) j++;
    const vezes = j - k;
    out.push({ a: p[k], b: p[j], rotulo: vezes > 1 ? `${vezes}×${cm(s)}` : cm(s) });
    k = j;
  }
  return out;
}

/** A peça de alvenaria na elevação: a cor do tipo de bloco (a amarração do contraforte se lê pelo 34 e pelo 54). */
export function estiloDaAlvenaria(s: Solido): Estilo {
  const t = tintaDaPeca(s);
  return t ? estiloPintado(t) : { fill: COR.blocoFundo, stroke: COR.linha, sw: 0.7, camada: 'alvenaria' };
}

const PAPEIS_VISTOS = new Set<Barra['papel']>(['VERT_MURO', 'ESPERA', 'HORIZ', 'CF_PRINCIPAL', 'CF_CONSTRUTIVA']);


/** Uma coluna de furo grauteado na elevação: o x dela e as alturas em que ela corre sem parar (mm). */
interface ColunaDeGraute {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Até onde (mm) o meio do furo pode andar de uma fiada para a outra e ainda ser a mesma coluna (na amarração o
 *  furo da fiada de cima fica meio centímetro ao lado do de baixo). */
const MESMA_COLUNA = 25;

/**
 * As colunas de graute: os pedaços de furo (um por fiada, e o do fundo da canaleta) com o meio no mesmo lugar (até
 * MESMA_COLUNA), emendados onde se encostam, numa faixa RETA da largura de todos juntos. Uma faixa por coluna e não
 * uma por fiada: com transparência, faixa sobre faixa escurece a emenda, e o furo que anda meio centímetro entre
 * fiadas deixava a sombra em zigue-zague.
 */
export function colunasDoGraute(pedacos: readonly { x0: number; x1: number; z0: number; z1: number }[]): ColunaDeGraute[] {
  const meio = (p: { x0: number; x1: number }) => (p.x0 + p.x1) / 2;
  const grupos: { x: number; pedacos: ColunaDeGraute[] }[] = [];
  for (const p of [...pedacos].sort((a, b) => meio(a) - meio(b))) {
    const g = grupos.find((q) => Math.abs(q.x - meio(p)) <= MESMA_COLUNA);
    if (g) g.pedacos.push({ ...p });
    else grupos.push({ x: meio(p), pedacos: [{ ...p }] });
  }
  const colunas: ColunaDeGraute[] = [];
  for (const { pedacos: lista } of grupos) {
    lista.sort((a, b) => a.z0 - b.z0);
    // a faixa tem a largura MÉDIA dos furos da coluna (pesada pela altura): a união das fiadas pares e ímpares, que
    // não se alinham ao milímetro, passava do furo e cobria bloco cheio
    let atual: (ColunaDeGraute & { sx0: number; sx1: number; sh: number }) | null = null;
    const fechar = () => {
      if (!atual) return;
      const { sx0, sx1, sh, ...c } = atual;
      colunas.push(sh > 0 ? { ...c, x0: sx0 / sh, x1: sx1 / sh } : c);
    };
    for (const p of lista) {
      const h = Math.max(0, p.z1 - p.z0);
      if (atual && p.z0 <= atual.z1 + 1) {
        atual.z1 = Math.max(atual.z1, p.z1);
        atual.sx0 += p.x0 * h;
        atual.sx1 += p.x1 * h;
        atual.sh += h;
      } else {
        fechar();
        atual = { ...p, sx0: p.x0 * h, sx1: p.x1 * h, sh: h };
      }
    }
    fechar();
  }
  return colunas.sort((a, b) => a.x0 - b.x0 || a.z0 - b.z0);
}

/** A cor `de` vista através da sombra `cor` com opacidade `a` (a mistura que a tela faz; o DXF recebe pronta). */
function misturar(de: string, cor: string, a: number): string {
  const rgb = (c: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    const v = m ? parseInt(m[1], 16) : 0xffffff;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const [p, q] = [rgb(de), rgb(cor)];
  return `#${p.map((x, k) => Math.round(x * (1 - a) + q[k] * a).toString(16).padStart(2, '0')).join('')}`;
}

/** `o`: escala fixa, sem título e prefixo dos ids — o pedido do modo prancha (paraPrancha.ts). */
/** A vista frontal com a tabela de gráficos dela (frontal: graficos.ts, naVista). */
export function desenharVistaFrontal(m: Modelo, o: OpcoesDaVista = {}): Prancha {
  return naVista('frontal', () => frontalNaVista(m, o), o.graficos);
}

function frontalNaVista(m: Modelo, o: OpcoesDaVista): Prancha {
  const pr = new Prancha(o.prefixo ?? 'des', o.hachuraVetorial);
  pr.ajustar(o.anotacoes, o.S);
  const sol = solidosDoModelo(m).filter((s) => s.peca.grupo !== 'terreno');
  const t = m.familia.t;
  const { H_muro, H_solo, n_fiadas, trechos, sapata, L_real } = m.dims;
  const xIni = trechos.length ? Math.min(...trechos.map((r) => r.x0)) : 0;
  const xFim = trechos.length ? Math.max(...trechos.map((r) => r.x1)) : L_real;
  // 900 (era 1000): a cota saía com ~13,7 px na tela cheia (1920×1080, painel aberto); com o desenho 10% menor
  // na folha, o enquadrar amplia mais e toda a anotação cresce junto — cota ~15 px, como o rótulo do painel e a
  // cota da planta. Os limites acompanham na mesma razão.
  // Na prancha a escala vem pedida (1:25, 1:50…) e o desenho fica do tamanho que ela der.
  const S = o.S ?? escalaPara(Math.max(xFim - xIni, 1.6 * (H_muro - sapata.z0)), 900, 0.045, 0.45);
  const X = (x: number) => x * S;
  const Y = (z: number) => -z * S;
  const aneis = (r: Regiao): Pt[][] => [r.contorno, ...r.furos].map((a) => a.map(([x, z]): Pt => [X(x), Y(z)]));
  const cfs = contrafortesDoModelo(m, sol);
  const fiadaPx = 200 * S;
  const aparece = (i: Parameters<typeof apareceNa>[1]) => apareceNa('frontal', i);

  // ── sapata: abaixo do terreno, tracejada ──────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="sapata"');
  for (const s of aparece('sapata') ? sol.filter((q) => q.peca.tipo === 'SAPATA') : []) {
    pr.caminho(aneis(projecao(s, 'Y')), { fill: pr.padrao('conc'), stroke: COR.linha, sw: 1, dash: '7,4', id: s.peca.id });
    // cada vértice do perfil é uma aresta ao longo do muro: a linha do fundo da sapata acima do dente
    const niveis = [...new Set(s.base.map((p) => Math.round(p[2])))].filter((z) => z > s.min[2] + 0.5 && z < s.max[2] - 0.5);
    for (const z of niveis) pr.linha(X(s.min[0]), Y(z), X(s.max[0]), Y(z), { stroke: COR.linha, sw: 0.8, dash: '7,4' });
  }
  pr.fechar();
  // terreno na frente (topo da sapata) e nível do aterro atrás do muro
  if (aparece('terreno')) pr.linha(X(xIni) - 40, Y(0), X(xFim) + 40, Y(0), { stroke: hachuraDe('terra').risco, sw: 1.8, material: 'terra' });

  // ── alvenaria (pintor em Y: do fundo para a frente) ───────────────────────────────────────────────────────────
  const alv = sol.filter((s) => ALVENARIA.has(s.peca.tipo) && s.min[1] < t - 1).sort((a, b) => b.min[1] - a.min[1]);
  const noPlano = alv.filter((s) => s.min[1] > -1);
  const naFrente = alv.filter((s) => s.min[1] <= -1);
  pr.abrir('data-camada="alvenaria"');
  // a passante do contraforte que aparece na face vai na cor do tipo, como as outras: o tom mais escuro que ela
  // levava antes misturaria um segundo código com o das cores do Jose
  for (const s of aparece('blocos') ? noPlano : []) pr.caminho(aneis(projecao(s, 'Y')), { ...estiloDaAlvenaria(s), id: s.peca.id });
  pr.fechar();
  // nível do aterro atrás do muro (escondido): só quando o muro sobe além do solo
  if (aparece('terreno') && H_solo < H_muro - 0.5) pr.linha(X(xIni), Y(H_solo), X(xFim), Y(H_solo), { stroke: hachuraDe('terra').risco, sw: 1.2, dash: '10,4', material: 'terra' });
  const grautes = aparece('graute') ? sol.filter((q) => q.peca.tipo === 'GRAUTE_FURO' && q.min[1] < t && q.max[1] > 0) : [];
  // a sombra vertical do furo grauteado (cabeçalho): na tela e no PDF, uma faixa por coluna com a transparência; no
  // DXF (sem transparência), a mesma faixa já misturada com a cor de cada bloco de baixo e com o papel nas juntas
  // a faixa da tela leva a cor crua e o material: o meio-tom é a Prancha que aplica (aplicado aqui também, saía duas
  // vezes). O DXF, misturado na conta, leva o meio-tom uma vez, como a tela
  const corCrua = corDaSombraDoGraute();
  const corDoGraute = meioTomDe('graute') ? emMeioTom(corCrua) : corCrua;
  const alfa = SOMBRA_DO_GRAUTE * opacidadeDe('graute');
  const colunas = colunasDoGraute(grautes.map((s) => ({ x0: s.min[0], x1: s.max[0], z0: Math.max(0, s.min[2]), z1: s.max[2] })));
  // a cor que a tela mostra embaixo da faixa: o bloco com o meio-tom e a transparência dele sobre o papel; o bloco que
  // não aparece (Mostrar desligado, 100 % transparente, invisível) é papel — senão o DXF pintava o fantasma dele
  const corDoBloco = (s: Solido): string => {
    const e = estiloDaAlvenaria(s);
    const m = e.material as Material | undefined;
    const c = e.fill ?? '#ffffff';
    const op = aparece('blocos') ? (m ? opacidadeDe(m) : 1) : 0;
    return misturar('#ffffff', m && meioTomDe(m) ? emMeioTom(c) : c, op);
  };
  pr.abrir('data-camada="graute"');
  for (const c of colunas) {
    pr.rect(X(c.x0), Y(c.z1), (c.x1 - c.x0) * S, (c.z1 - c.z0) * S, { fill: corCrua, stroke: 'none', opacidade: SOMBRA_DO_GRAUTE, material: 'graute', soTela: true });
    if (alfa <= 0) continue;
    // o DXF: a faixa inteira sobre o papel (as juntas, em pé e deitadas) e, por cima, cada pedaço de bloco embaixo
    // dela na cor que a tela mostra (o CAD desenha na ordem em que as peças entram)
    pr.rect(X(c.x0), Y(c.z1), (c.x1 - c.x0) * S, (c.z1 - c.z0) * S, { fill: misturar('#ffffff', corDoGraute, alfa), stroke: 'none', camada: 'graute', soArquivo: true });
    for (const b of noPlano) {
      const [bx0, bx1, bz0, bz1] = [Math.max(c.x0, b.min[0]), Math.min(c.x1, b.max[0]), Math.max(c.z0, b.min[2]), Math.min(c.z1, b.max[2])];
      if (bx1 - bx0 < 0.5 || bz1 - bz0 < 0.5) continue;
      const embaixo = corDoBloco(b);
      if (embaixo === '#ffffff') continue;
      pr.rect(X(bx0), Y(bz1), (bx1 - bx0) * S, (bz1 - bz0) * S, { fill: misturar(embaixo, corDoGraute, alfa), stroke: 'none', camada: 'graute', soArquivo: true });
    }
  }
  pr.fechar();
  pr.abrir('data-camada="contraforte"');
  for (const s of aparece('blocos') ? naFrente : []) pr.caminho(aneis(projecao(s, 'Y')), { ...estiloDaAlvenaria(s), id: s.peca.id });
  // haste enterrada: escondida atrás do muro
  for (const c of aparece('blocos') ? cfs : []) {
    if (!c.aparente && c.max[1] > t + 1) {
      pr.rect(X(c.min[0]), Y(c.max[2]), (c.max[0] - c.min[0]) * S, (c.max[2] - Math.max(0, c.min[2])) * S,
        { stroke: COR.linha, sw: 0.9, dash: '6,3' });
    }
  }
  pr.fechar();

  // barbacãs: o tubo atravessa o muro, de frente é um círculo
  for (const s of aparece('drenagem') ? sol.filter((q) => q.peca.tipo === 'BARBACA') : []) {
    pr.caminho(aneis(projecao(s, 'Y')), { fill: '#ffffff', stroke: COR.linha, sw: 0.8, id: s.peca.id, camada: 'drenagem', material: 'tubo' });
  }

  // ── armaduras ─────────────────────────────────────────────────────────────────────────────────────────────────
  // Sem o filete branco que ia por baixo de cada barra (para o vermelho do aço não sumir no vermelho do 54): o
  // Jose achou que poluía mais do que ajudava (16/10). Quem quiser a barra destacada troca a cor do aço na vista.
  const barras = aparece('armadura') ? m.barras.filter((b) => PAPEIS_VISTOS.has(b.papel)) : [];
  // chamada de cada posição na barra dela mais à direita (a coluna das chamadas fica depois da ponta do muro)
  const daChamada = new Map<string, { x: number; pts: Pt[]; b: Barra }>();
  // todas as barras desenhadas de cada posição e elemento: a etiqueta posta acha o ponto dela mais perto
  const barrasPorChave = new Map<string, Pt[][]>();
  pr.abrir('data-camada="barras"');
  for (const b of barras) {
    const pts = projetarPontos(b.eixo, 'Y').map(([x, z]): Pt => [X(x), Y(z)]);
    const sw = Math.max(0.9, b.diametro * S);
    const dash = b.papel === 'ESPERA' ? '5,3' : undefined;
    pr.polilinha(pts, { stroke: corDoAcoNoDesenho(), sw, dash, id: b.id });
    const xMax = Math.max(...pts.map((q) => q[0]));
    const k = `${b.posicao}|${elementoDaBarra(b)}`;
    barrasPorChave.set(k, [...(barrasPorChave.get(k) ?? []), pts]);
    const antes = daChamada.get(k);
    if (!antes || xMax > antes.x + 0.5) daChamada.set(k, { x: xMax, pts, b });
  }
  pr.fechar();
  const chamadas: Chamada[] = [...daChamada.values()].map(({ pts, b }) => ({ posicao: b.posicao, elemento: elementoDaBarra(b), ancora: ancoraNaBarra(pts) }));

  // ── eixos dos contrafortes e juntas de controle ──────────────────────────────────────────────────────────────
  const topo = Y(H_muro);
  const temBarras = m.barras.some((b) => b.papel === 'VERT_MURO');
  const linhaBarras = topo - 22;
  const linhaCf = temBarras ? topo - 50 : topo - 22;
  for (const c of aparece('eixos') ? cfs : []) {
    pr.linha(X(c.x), Y(sapata.z0) + 8, X(c.x), linhaCf - 22, { stroke: COR.cota, sw: 0.6, dash: '14,3,2,3', camada: 'eixos' });
    pr.texto(X(c.x), linhaCf - 26, `C${c.numero}`, { tam: 11, cor: COR.cota, negrito: true, camada: 'eixos', chave: `eixo:C${c.numero}` });
  }
  for (let k = 0; aparece('eixos') && k + 1 < trechos.length; k++) {
    const xj = (trechos[k].x1 + trechos[k + 1].x0) / 2;
    pr.linha(X(xj), Y(sapata.z0) + 8, X(xj), topo - 8, { stroke: COR.linha, sw: 1.8, camada: 'eixos' });
    pr.texto(X(xj), Y(sapata.z0) + 22, 'JC', { tam: 11, negrito: true, camada: 'eixos' });
  }

  // ── números das fiadas ────────────────────────────────────────────────────────────────────────────────────────
  // Na tela o número acompanha a altura da fiada (até 10 px). Na prancha ele tem a letra mínima do papel, como a
  // cota: encolher com a fiada daria número de 2 mm em 1:50; quando a fiada fica mais baixa que a letra (1:75,
  // 1:100) numera de 2 em 2 (ou mais), em vez de encolher ou encavalar
  const naPrancha = o.S !== undefined;
  const tamFiada = naPrancha ? CORPO_DA_COTA : Math.max(4, Math.min(10, fiadaPx * 0.7));
  const folgaDoNumero = 1.25 * CORPO_DA_COTA * MAIUSCULA_DA_ARIAL;
  const passoFiada = naPrancha ? ([1, 2, 5, 10].find((k) => k * fiadaPx >= folgaDoNumero) ?? 10) : 1;
  for (let i = 0; aparece('fiadas') && i < n_fiadas; i++) {
    if (i % passoFiada !== 0) continue;
    pr.texto(X(xIni) - 6, Y(200 * i + 105) + tamFiada * 0.35, String(i + 1), { tam: tamFiada, ancora: 'end', cor: COR.nota });
  }

  // ── cotas ─────────────────────────────────────────────────────────────────────────────────────────────────────
  pr.abrir('data-camada="cotas"');
  pr.silenciar(!aparece('cotas'));
  // espaçamento das barras (por trecho): da ponta à 1ª barra, entre barras, da última à ponta
  // (uma cadeia só para todos os trechos: os rótulos das duas pontas de uma junta não se atropelam).
  // Com contrafortes, o eixo do contraforte entra na cadeia: o painel é armado a partir do apoio, e a cota
  // que o armador confere é "45 do contraforte à 1ª barra", não a distância entre barras de vãos vizinhos.
  if (temBarras) {
    const segs = trechos.flatMap((r) => {
      const dentro = (x: number) => x >= r.x0 && x <= r.x1;
      const xs = m.barras.filter((b) => b.papel === 'VERT_MURO' && dentro(b.eixo[0][0])).map((b) => b.eixo[0][0]);
      const apoios = cfs.filter((c) => dentro(c.x)).map((c) => c.x);
      return xs.length ? cadeia([r.x0, ...apoios, ...xs, r.x1]) : [];
    });
    pr.cadeiaH(segs.map((c) => ({ a: X(c.a), b: X(c.b), rotulo: c.rotulo })), linhaBarras, { de: [[topo - 2, topo - 2]] });
  }
  // eixo a eixo dos contrafortes
  const segsCf = trechos.flatMap((r) => {
    const xs = cfs.filter((c) => c.x >= r.x0 && c.x <= r.x1).map((c) => c.x);
    return xs.length ? cadeia([r.x0, ...xs, r.x1]) : [];
  });
  pr.cadeiaH(segsCf.map((c) => ({ a: X(c.a), b: X(c.b), rotulo: c.rotulo })), linhaCf);
  // comprimento: por trecho (se houver junta) e total
  const base = Y(sapata.z0) + 40;
  if (trechos.length > 1) pr.cadeiaH(trechos.map((r) => ({ a: X(r.x0), b: X(r.x1), rotulo: cmCheio(r.x1 - r.x0), textoDaChave: cm(r.x1 - r.x0) })), base);
  const linhaTotal = trechos.length > 1 ? base + 24 : base;
  pr.cotaH(X(xIni), X(xFim), linhaTotal, cmCheio(L_real), { de: [Y(0), Y(0)], textoDaChave: cm(L_real) });
  // altura do muro desenhado × altura de solo (a da conta)
  // as linhas de chamada partem do lado de fora dos números das fiadas, para não riscar os números
  const xNum = X(xIni) - 10 - Prancha.largura(String(n_fiadas), tamFiada);
  const xc1 = xNum - 16;
  pr.cotaV(xc1, Y(0), Y(H_muro), `muro ${cm(H_muro)}`, { de: [X(xIni), xNum] });
  pr.cotaV(xc1 - 30, Y(0), Y(H_solo), `solo ${cm(H_solo)}`, { de: [xNum, xNum] });
  pr.silenciar(false);
  pr.fechar();

  // ── título e legenda ──────────────────────────────────────────────────────────────────────────────────────────
  // na prancha o título é dela (embaixo do desenho, com a escala); o PROVISÓRIO fica, é aviso e não título
  const yTit = cfs.length ? linhaCf - 66 : temBarras ? linhaBarras - 44 : topo - 34;
  if (!o.semTitulo) {
    pr.texto(X(xIni), yTit, 'Vista frontal', { tam: 15, ancora: 'start', negrito: true });
    pr.texto(X(xIni), yTit + 16, 'cotas em cm', { tam: 10, ancora: 'start', cor: COR.nota });
  }
  if (m.familia.provisoria && cfs.length) {
    pr.texto(X(xIni) + (o.semTitulo ? 0 : 150), yTit, 'PROVISÓRIO', { tam: 13, ancora: 'start', negrito: true, cor: COR.especial });
  }
  // legenda: só o que está desenhado (o tipo de bloco que não entrou no muro não aparece)
  const itens: [string, Amostra][] = o.semLegendaDeCores ? [] : itensDasTintas(tintasPresentes([...noPlano, ...naFrente]));
  if (grautes.length) itens.push(['Graute', 'graute']);
  if (barras.some((b) => b.papel !== 'ESPERA')) itens.push(['Barra', 'barra']);
  if (barras.some((b) => b.papel === 'ESPERA')) itens.push(['Espera', 'espera']);
  if (itens.length && aparece('legenda')) desenharLegenda(pr, X(xIni), linhaTotal + 30, itens, Math.max(320, X(xFim) - X(xIni)));
  // ── chamadas das barras: por último, à direita de tudo (o fim da linha do terreno, as cotas e a legenda) ────────
  if (o.chamadas && aparece('chamadas')) desenharChamadas(pr, m, chamadas, X(xFim) + 52, o.chamadasPostas);
  if (o.etiquetas?.length && aparece('chamadas')) desenharEtiquetas(pr, m, o.etiquetas, barrasPorChave, S);
  return pr;
}

export function vistaFrontal(m: Modelo): string {
  return desenharVistaFrontal(m).svg();
}
