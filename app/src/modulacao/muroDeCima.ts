/*
  O MURO DE CIMA PEÇA A PEÇA (Jose, 13/11): o muro de vedação que fica em cima do arrimo — tijolo cerâmico (as peças
  do Revit dele, tijolos.gerado.json), pilaretes e cintas — e as barras do pilarete e da cinta.

  A conta é a da aba "Muro de cima e vento" da planilha; aqui só se monta o que ela verificou:
    - ALTURA: fiadas inteiras de 20 cm (tijolo de 19 + junta de 1), a mais perto de h_mc (a conta usa h_mc; a
      diferença é menor que meia fiada e vira aviso MURO_DE_CIMA_FIADAS);
    - PILARETES: em cima do contraforte (um a cada pil_ncf; as duas pontas sempre) ou, no balanço, a cada s_pil no
      máximo, com as pontas do trecho sempre fechadas por pilarete (painel com borda livre de lado não é o caso que a
      conta verificou). Seção b × h centrada no eixo do muro de cima, da base ao topo;
    - CINTAS: concreto na altura de uma fiada, entre os pilaretes (o pilarete passa direto) — no topo e/ou a meia
      altura, como a entrada cin_mc. Ficam no lugar de uma fiada de tijolo (a conta conta a diferença de peso);
    - TIJOLOS: amarração em meia peça (fiada ímpar começa com 14 cm), junta de 1 cm, cortados no fim do painel.
  Tudo centrado no eixo do arrimo (y = t/2), começando no topo do arrimo (z = H do muro desenhado).

  BARRAS (dedução de detalhamento, para a lista de ferros; a conta só pede o As do pilarete):
    - pilarete: n_pil barras em cada face perpendicular ao vento, descendo ℓ0t (l0t_pil da conta) para dentro do
      arrimo e subindo até 3 cm do topo. Concreto moldado: estribo Ø do modelo a cada mín(20 cm; b; 12φ) — o
      espaçamento máximo de pilar da NBR 6118 18.4.3; bloco grauteado: sem estribo (como o contraforte de bloco,
      o estribo iria na junta — fica para quando o Jose pedir);
    - cinta: 2 barras corridas (Ø do modelo) a 3 cm das faces, no meio da altura da cinta, emendadas com α0t·ℓb do
      concreto quando passam de 12 m.
*/
import type { Valor } from '@/motor/tipos';
import type { Geometria, Peca, Vec2, Vec3 } from '@/modelo/tipos';
import type { Ctx } from './contexto';
import type { TrechoModulado } from './modular';
import { H_FIADA, JUNTA } from './catalogo';
import { arred, prisma, retangulo } from './perfis';
import { corrida, distribuir, estribo, reta } from './barras';
import { comoNumero, comoTexto, lerValor } from './leitura';
import TIJOLOS from './tijolos.gerado.json';

interface PerfilDoTijolo { t: number; h: number; L: number; contorno: Vec2[]; furos: Vec2[][] }
const PERFIS = (TIJOLOS as unknown as { tijolos: Record<string, PerfilDoTijolo> }).tijolos;

/** O tijolo do Revit mais perto da espessura pedida (cm). */
export function tijoloDaEspessura(tCm: number): { nome: string; perfil: PerfilDoTijolo; exato: boolean } {
  let melhor = '';
  for (const [nome, p] of Object.entries(PERFIS)) {
    if (!melhor || Math.abs(p.t - tCm * 10) < Math.abs(PERFIS[melhor].t - tCm * 10)) melhor = nome;
  }
  const perfil = PERFIS[melhor];
  return { nome: melhor, perfil, exato: Math.abs(perfil.t - tCm * 10) < 1 };
}

export interface MuroDeCimaLido {
  hFiadas: number;           // nº de fiadas de 200 mm
  H: number;                 // altura desenhada, mm
  tijolo: ReturnType<typeof tijoloDaEspessura>;
  cintas: number[];          // índices das fiadas em concreto
  concreto: boolean;
  s: number;                 // eixo a eixo máximo dos pilaretes (balanço), mm
  nCf: number;               // pilarete a cada n contrafortes
  b: number; hs: number;     // seção do pilarete, mm
  phi: number; nPorFace: number; c: number;   // barras do pilarete
  l0t: number;               // traspasse no arrimo, mm
  phiEst: number; sEst: number | null;        // estribo do pilarete (modelo)
  phiCinta: number;          // barras da cinta (modelo)
}

const num = (v: Valor | undefined, padrao: number): number => comoNumero(v) ?? padrao;

/** As entradas do muro de cima, ou null sem muro de cima. */
export function lerMuroDeCima(ctx: Ctx, ler: (n: string) => Valor | undefined): MuroDeCimaLido | null {
  if (comoTexto(ler('mc_on')) !== 'Sim') return null;
  const h = num(ler('h_mc'), 0) * 1000;
  if (!(h > 0)) return null;
  const hFiadas = Math.max(1, Math.round(h / H_FIADA));
  const cin = comoTexto(ler('cin_mc'));
  // a cinta de meia altura fecha em cima o painel de baixo: o topo dela na fiada mais perto de h/2
  const meio = Math.max(0, Math.round(hFiadas / 2) - 1);
  const cintas = cin === 'No topo' ? [hFiadas - 1]
    : cin === 'A meia altura' ? [meio]
      : cin === 'No topo e a meia altura' ? [...new Set([meio, hFiadas - 1])]
        : [];
  const tijolo = tijoloDaEspessura(num(ler('t_mc'), 11.5));
  if (!tijolo.exato) {
    ctx.avisos.push({ codigo: 'TIJOLO_SEM_MODELO', texto: `Muro de cima: tijolo de ${String(num(ler('t_mc'), 0)).replace('.', ',')} cm desenhado com o ${tijolo.nome} do Revit` });
  }
  if (cintas.includes(meio) && cin !== 'No topo' && hFiadas % 2) {
    ctx.avisos.push({ codigo: 'MURO_DE_CIMA_MEIA_ALTURA', texto: `Muro de cima com ${hFiadas} fiadas: a cinta de meia altura não divide o muro em dois painéis iguais` });
  }
  if (Math.abs(hFiadas * H_FIADA - h) > 1) {
    ctx.avisos.push({ codigo: 'MURO_DE_CIMA_FIADAS', texto: `Muro de cima desenhado com ${hFiadas} fiadas de 20 cm (${String(hFiadas * 0.2).replace('.', ',')} m)` });
  }
  const l0tCm = comoNumero(ler('l0t_pil'));
  const sEstCm = comoNumero(ler('s_est_pil'));
  // espaçamento zero ou negativo (campo apagado ou digitado errado) derrubaria o modelo inteiro no distribuir: vale o
  // padrão, com aviso (a planilha já reprova o muro de cima sem espaçamento — chk_dmc)
  let s = num(ler('s_pil'), 2.4) * 1000;
  if (!(s > 0)) {
    ctx.avisos.push({ codigo: 'PILARETE_SEM_ESPACAMENTO', texto: 'Pilaretes sem espaçamento: desenhados a cada 2,40 m' });
    s = 2400;
  }
  return {
    hFiadas, H: hFiadas * H_FIADA, tijolo, cintas,
    concreto: comoTexto(ler('pil_tipo')).startsWith('Conc'),
    s,
    nCf: Math.max(1, Math.round(num(ler('pil_ncf'), 1))),
    b: num(ler('b_pil'), 14) * 10, hs: num(ler('hs_pil'), 25) * 10,
    phi: num(ler('phi_pil'), 10), nPorFace: Math.max(1, Math.round(num(ler('n_pil'), 2))), c: num(ler('c_pil'), 4) * 10,
    l0t: (l0tCm ?? 40) * 10,
    phiEst: num(ler('phi_est_pil'), 5), sEst: sEstCm === null || !(sEstCm > 0) ? null : sEstCm * 10,
    phiCinta: num(ler('phi_cin_mc'), 8),
  };
}

/** Eixo dos pilaretes do trecho (mm), da esquerda para a direita. */
export function pilaretesDoTrecho(tr: TrechoModulado, contrafortes: boolean, mc: MuroDeCimaLido): number[] {
  if (contrafortes && tr.nos.length) {
    const xs = tr.nos.filter((_, k) => k % mc.nCf === 0).map((n) => n.xc);
    const ultimo = tr.nos[tr.nos.length - 1].xc;
    if (xs[xs.length - 1] !== ultimo) xs.push(ultimo);
    return xs;
  }
  const a = tr.x0 + mc.b / 2;
  const b = tr.x1 - mc.b / 2;
  return distribuir(a, b, mc.s).map(arred);
}

function geo(ctx: Ctx, chave: string, faz: () => Geometria): string {
  if (!ctx.geos[chave]) ctx.geos[chave] = faz();
  return chave;
}

/** Monta o muro de cima do trecho (peças e barras). */
export function muroDeCima(ctx: Ctx, tr: TrechoModulado, mc: MuroDeCimaLido, lbphiC: number | null, a0t: number | null): void {
  const { mod } = ctx;
  const T = `T${tr.indice}`;
  const Z0 = mod.H_des;
  const yEixo = mod.cat.t / 2;
  const { perfil, nome } = mc.tijolo;
  const tm = perfil.t;
  const y0 = arred(yEixo - tm / 2);
  const xs = pilaretesDoTrecho(tr, ctx.p.contrafortes, mc);
  // Eixo do pilarete em Y. Em cima do contraforte (Jose, 13/11: "falta o transpasse da armadura pros pilaretes") ele
  // fica com a face rente à face aparente do muro e avança sobre a haste do contraforte, que é toda grauteada — as
  // barras descem o traspasse dentro dela. No balanço, centrado no muro (a posição presa aos furos do bloco é a
  // próxima tarefa, anotada no caderno).
  const tA = mod.cat.t;
  const yPil = ctx.p.contrafortes ? (ctx.p.enterrado ? mc.hs / 2 : tA - mc.hs / 2) : yEixo;

  // ── pilaretes ──
  const gPil = geo(ctx, `pilarete ${mc.concreto ? 'concreto' : 'bloco'} ${mc.b}x${mc.hs} h${mc.H}`, () => {
    const g = prisma(`pilarete ${mc.concreto ? 'concreto' : 'bloco'} ${mc.b}x${mc.hs} h${mc.H}`, 'Z', retangulo(mc.b, mc.hs), mc.H, undefined,
      mc.concreto ? `pilarete ${mc.b / 10}×${mc.hs / 10} concreto` : `pilarete ${mc.b / 10}×${mc.hs / 10} bloco grauteado`);
    return g;
  });
  xs.forEach((x, k) => {
    ctx.pecas.push({ id: `${T}.MC.P${String(k + 1).padStart(2, '0')}`, tipo: 'PILARETE', grupo: 'murocima', geometria: gPil,
      origem: [arred(x - mc.b / 2), arred(yPil - mc.hs / 2), Z0], giro: 0, trecho: tr.indice });
  });

  // ── painéis: cintas e tijolos entre pilaretes ──
  const gTij = (L: number): string => {
    const chave = `tijolo ${nome} L${Math.round(L * 10) / 10}`;
    return geo(ctx, chave, () => {
      const g = prisma(chave, 'X', perfil.contorno, L, perfil.furos, L >= perfil.L - 0.5
        ? `${nome.toLowerCase()} (${fmtCm(perfil.t)}×${fmtCm(perfil.h)}×${fmtCm(perfil.L)})`
        : `${nome.toLowerCase()} cortado ${fmtCm(L)}`);
      g.classe = 'tijolo';
      return g;
    });
  };
  for (let v = 0; v + 1 < xs.length; v++) {
    const xa = xs[v] + mc.b / 2;
    const xb = xs[v + 1] - mc.b / 2;
    if (xb - xa < 1) continue;
    for (let f = 0; f < mc.hFiadas; f++) {
      const zf = Z0 + f * H_FIADA;
      if (mc.cintas.includes(f)) {
        const gC = geo(ctx, `cinta mc ${Math.round(tm * 10) / 10}x${H_FIADA} L${arred(xb - xa)}`, () =>
          prisma(`cinta mc ${Math.round(tm * 10) / 10}x${H_FIADA} L${arred(xb - xa)}`, 'X', retangulo(tm, H_FIADA), arred(xb - xa), undefined, `cinta ${fmtCm(tm)}×20 concreto`));
        ctx.pecas.push({ id: `${T}.MC.C.v${String(v + 1).padStart(2, '0')}.f${String(f).padStart(2, '0')}`, tipo: 'CINTA_MC', grupo: 'murocima', geometria: gC,
          origem: [arred(xa), y0, zf], giro: 0, trecho: tr.indice, fiada: f });
        continue;
      }
      // fiada de tijolo: junta de 1 cm nas faces dos pilaretes, meia peça de deslocamento nas fiadas ímpares
      const fim = xb - JUNTA;
      const comps: number[] = [];
      let x = xa + JUNTA;
      let L = f % 2 ? (perfil.L - JUNTA) / 2 : perfil.L;
      while (fim - x > 1) {
        L = Math.min(L, fim - x);
        comps.push(L);
        x += L + JUNTA;
        L = perfil.L;
      }
      // sobra pequena no fim (uma lasca que ninguém corta): ela e a peça de antes viram duas metades iguais
      const n = comps.length;
      if (n >= 2 && comps[n - 1] < CORTE_MINIMO) {
        const meio = (comps[n - 2] + JUNTA + comps[n - 1] - JUNTA) / 2;
        comps.splice(n - 2, 2, meio, meio);
      }
      x = xa + JUNTA;
      comps.forEach((Lp, k) => {
        const inteiro = Lp >= perfil.L - 0.5;
        ctx.pecas.push({
          id: `${T}.MC.v${String(v + 1).padStart(2, '0')}.f${String(f).padStart(2, '0')}.t${String(k + 1).padStart(2, '0')}`,
          tipo: inteiro ? 'TIJOLO' : 'TIJOLO_CORTADO', grupo: 'murocima', geometria: gTij(arred(Lp)),
          origem: [arred(x), y0, arred(zf + JUNTA)], giro: 0, trecho: tr.indice, fiada: f,
        });
        x += Lp + JUNTA;
      });
    }
  }

  // ── barras do pilarete ──
  const zTopo = Z0 + mc.H - 30;
  const zPe = Z0 - mc.l0t;
  let foraDoArrimo = false;
  xs.forEach((xc, k) => {
    const id = `${T}.MC.P${String(k + 1).padStart(2, '0')}`;
    const xsB = mc.nPorFace === 1 ? [xc] : distribuir(xc - mc.b / 2 + mc.c, xc + mc.b / 2 - mc.c, (mc.b - 2 * mc.c) / (mc.nPorFace - 1));
    for (const [lado, y] of [['a', yPil - mc.hs / 2 + mc.c], ['s', yPil + mc.hs / 2 - mc.c]] as const) {
      // a barra só desce no arrimo se cai dentro da parede dele (entre as paredes do bloco); fora disso ela nasce no
      // topo do arrimo e a ligação fica por definir (aviso) — não se desenha barra no ar nem enterrada no aterro
      // dentro de quê a barra desce: com contrafortes, na haste do contraforte (toda grauteada, da face aparente à ponta,
      // na largura dele); no balanço, entre as paredes do bloco do arrimo
      const hf = mod.cat.hf;
      const naHaste = (x: number) => Math.abs(x - xc) + mc.phi / 2 <= tA / 2 - hf
        && (ctx.p.enterrado ? y - mc.phi / 2 >= hf && y + mc.phi / 2 <= mod.tenr - hf : y - mc.phi / 2 >= tA - mod.tenr + hf && y + mc.phi / 2 <= tA - hf);
      const dentro = ctx.p.contrafortes ? xsB.every(naHaste) : y - mc.phi / 2 >= hf && y + mc.phi / 2 <= tA - hf;
      if (!dentro) foraDoArrimo = true;
      xsB.forEach((x, j) => ctx.barras.push(reta(`${id}.L${lado}${j + 1}`, 'PIL_LONG', mc.phi, [arred(x), arred(y), dentro ? zPe : Z0], [arred(x), arred(y), arred(zTopo)], tr.indice)));
    }
    if (!mc.concreto) return;
    // estribo no lado de fora das longitudinais: eixo a c − φl/2 − φt/2 da face
    const ce = mc.c - mc.phi / 2 - mc.phiEst / 2;
    // NBR 6118 18.4.3: o menor entre 20 cm, a MENOR dimensão da seção e 12φ da longitudinal
    const sMax = Math.min(200, mc.b, mc.hs, 12 * mc.phi);
    const s = mc.sEst ?? Math.floor(sMax / 10) * 10;
    for (const [j, z] of distribuir(Z0 + 50, Z0 + mc.H - 50, s).entries()) {
      const zr = arred(z);
      const cantos: [Vec3, Vec3, Vec3, Vec3] = [
        [arred(xc - mc.b / 2 + ce), arred(yPil - mc.hs / 2 + ce), zr],
        [arred(xc + mc.b / 2 - ce), arred(yPil - mc.hs / 2 + ce), zr],
        [arred(xc + mc.b / 2 - ce), arred(yPil + mc.hs / 2 - ce), zr],
        [arred(xc - mc.b / 2 + ce), arred(yPil + mc.hs / 2 - ce), zr],
      ];
      ctx.barras.push(estribo(`${id}.E${String(j + 1).padStart(2, '0')}`, 'PIL_ESTRIBO', mc.phiEst, cantos, tr.indice));
    }
  });

  if (foraDoArrimo) {
    ctx.avisos.push({ codigo: 'PILARETE_LIGACAO', texto: 'Barras do pilarete fora da parede do arrimo: a ligação do pilarete com o arrimo fica por definir', ids: xs.map((_, k) => `${T}.MC.P${String(k + 1).padStart(2, '0')}`) });
  }

  // ── barras da cinta: corridas no trecho todo (passam pelos pilaretes) ──
  const traspasse = lbphiC !== null && lbphiC > 0 && a0t !== null && a0t > 0
    ? Math.ceil(Math.max(a0t * lbphiC * mc.phiCinta, 15 * mc.phiCinta, 200) / 10) * 10
    : 50 * mc.phiCinta;
  for (const f of mc.cintas) {
    const z = arred(Z0 + f * H_FIADA + H_FIADA / 2);
    const x0 = (xs[0] ?? tr.x0) - mc.b / 2 + 30;
    const x1 = (xs[xs.length - 1] ?? tr.x1) + mc.b / 2 - 30;
    for (const [lado, y] of [['a', y0 + 30], ['s', y0 + tm - 30]] as const) {
      ctx.barras.push(...corrida(`${T}.MC.C${f}.${lado}`, 'CINTA_MC', mc.phiCinta, arred(x0), arred(x1), arred(y), z, traspasse, [0, 0, mc.phiCinta], tr.indice));
    }
  }
}

/** Menor pedaço de tijolo que se corta na obra (mm). Abaixo disso, a peça de antes e a sobra viram duas metades. */
const CORTE_MINIMO = 50;

const fmtCm = (mm: number): string => String(Math.round(mm) / 10).replace('.', ',');

/** Peças do muro de cima são deste grupo: quem lê o Modelo filtra por aqui. */
export const ehDoMuroDeCima = (p: Peca): boolean => p.grupo === 'murocima';

/** Leitor das entradas da conta e do modelo para o muro de cima. */
export function leitorDoMuroDeCima(ctx: Ctx, r: Parameters<typeof lerValor>[0]): (n: string) => Valor | undefined {
  return (n) => (Object.prototype.hasOwnProperty.call(ctx.p.extras, n) ? ctx.p.extras[n] : lerValor(r, n));
}
