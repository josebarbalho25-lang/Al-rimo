/*
  AS BARRAS ANALÍTICAS — o muro reduzido a eixos, cada eixo com o AÇO NECESSÁRIO (planilha) e o AÇO COLOCADO (as barras
  do modelo) ao longo dele, e o mesmo par no cortante (2ª versão da vista Esforços, 15/11: o diagrama do Pró-Viga que
  o Jose pediu — "o solicitante de uma cor e o resistente englobando ele"). Os nomes estão no PLANO_OBRA, etapa 1b.

  ⚠️ NADA DE CONTA AQUI. A planilha é a única que calcula (CLAUDE.md, "a conta do app É a planilha"): o As necessário
  em cada nó é célula (perf_As, vt_As, T_As, den_As, pt_As…, a conta de As de cada aba refeita nó a nó NA PLANILHA).
  Este arquivo só: lê célula por nome, troca unidade, decide de que lado o desenho vai e pede ao `acoColocado.ts` a
  soma das barras desenhadas. Onde a planilha só publica o pico (os painéis vêm de tabela de placa, não de barra; a
  canaleta, as cintas, a ligação) a forma entre os picos é ilustrativa — o diagrama sai `esquematico` (tracejado) e o
  colocado é o As efetivo da planilha.

  Sinais (o diagrama vai do lado TRACIONADO, convenção brasileira):
    · balanço, contraforte e pilarete: o solo empurra o muro para fora (−Y) → tração do lado do solo, lado = +Y;
    · painel entre contrafortes, vertical: engaste da base tracionando o lado do solo (face 1), vão a face de fora (−1);
    · canaleta e cinta: vão tracionando a face de fora (lado = −Y);
    · ponta da sapata: tração embaixo (lado = −Z); em cima (face −1) só se o momento troca de sinal; talão: tração em
      cima (lado = +Z), embaixo (face −1) com o momento negativo;
    · dente: tração na face voltada para a ponta (−Y).
*/
import dados from '@/motor/planilha.gerada.json';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Barra, Modelo, Peca, PapelBarra, Vec3 } from '@/modelo/tipos';
import { caixaGlobal } from '@/modulacao/perfis';
import { acoColocado, areaDaBarra, estribosAoLongo, valorEm, type Ancoragens, type PontoDoDiagrama, type Recorte } from './acoColocado';
import {
  GRUPO_DO_TIPO, type BarraAnalitica, type Diagrama, type FaceDoDiagrama, type Pico, type TipoDeBarra, type UnidadeDoDiagrama, type UnidadeDoMomento,
} from './tipos';

const NOMES = (dados as unknown as { nomes: Record<string, string> }).nomes;

/** kN·cm → kN·m. */
const CM = 0.01;
const M = 1000; // m → mm
const CMmm = 10; // cm → mm

// ───────────────────────────── leitura ─────────────────────────────

const numero = (v: Valor): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** As células de um intervalo nomeado de uma coluna, de cima para baixo. */
export function celulasDe(nome: string): string[] {
  const m = /^(.+)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(NOMES[nome] ?? '');
  if (!m) return [];
  const out: string[] = [];
  for (let l = Number(m[3]); l <= Number(m[5]); l++) out.push(`${m[1]}!${m[2]}${l}`);
  return out;
}

interface No { celula: string; v: number | null; texto: boolean }
const coluna = (r: Resultado, nome: string): No[] =>
  celulasDe(nome).map((celula) => {
    const x = r.cel(celula);
    return { celula, v: numero(x), texto: typeof x === 'string' && x !== '' };
  });

/** Leitor com o nome que não existe na planilha tratado como "sem número" (a vista não pode derrubar o app). */
function leitor(r: Resultado) {
  const n = (nome: string): number | null => {
    if (!(nome in NOMES)) return null;
    try {
      return r.num(nome);
    } catch {
      return null;
    }
  };
  const t = (nome: string): string => {
    if (!(nome in NOMES)) return '';
    try {
      return String(r.v(nome) ?? '');
    } catch {
      return '';
    }
  };
  return { n, t };
}

// ───────────────────────────── os diagramas ─────────────────────────────

/** Um nó do necessário: número, ou texto da planilha ("não resiste", "—") = não há aço que dê. */
interface NoNec { s: number; v: number | null; celula?: string }

/** O necessário em pontos e os trechos "não resiste" (do meio para o nó vizinho de cada lado). */
function necessarioDe(nos: NoNec[], L: number): { pontos: PontoDoDiagrama[]; naoResiste: [number, number][] } {
  const ord = [...nos].sort((a, b) => a.s - b.s);
  const pontos: PontoDoDiagrama[] = [];
  const nr: [number, number][] = [];
  ord.forEach((no, i) => {
    if (no.v !== null) {
      pontos.push({ s: no.s, v: Math.max(0, no.v) });
      return;
    }
    const a = i > 0 ? (ord[i - 1]!.s + no.s) / 2 : 0;
    const b = i + 1 < ord.length ? (ord[i + 1]!.s + no.s) / 2 : L;
    const u = nr[nr.length - 1];
    if (u && u[1] >= a - 1e-6) u[1] = Math.max(u[1], b);
    else nr.push([Math.max(0, a), Math.min(L, b)]);
  });
  return { pontos, naoResiste: nr };
}

/** O colocado constante (o As efetivo da planilha, ou uma resistência) ao longo de [a, b]. */
const constante = (v: number | null, a: number, b: number): PontoDoDiagrama[] => (v === null || !(b > a) ? [] : [{ s: a, v: Math.max(0, v) }, { s: b, v: Math.max(0, v) }]);

/** Uma forma de 0 a 1 amostrada em `n` intervalos, escalada para o pico (para as barras esquemáticas). */
const forma = (n: number, L: number, pico: number, f: (xi: number) => number): PontoDoDiagrama[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ s: (i / n) * L, v: Math.max(0, pico * f(i / n)) }));

const parabola = (xi: number) => 4 * xi * (1 - xi);

/** O verde envolve o vermelho? Folga: 0,005 cm² (a da verificação "As,ef ≥ As" das abas); esforço: relativa. */
function envolve(f: FaceDoDiagrama, unidade: UnidadeDoDiagrama, ate: number): boolean {
  if (f.naoResiste.length) return false;
  const tol = unidade === 'cm²' || unidade === 'cm²/m' ? 0.005 : 0;
  const ss = new Set<number>();
  for (const p of f.necessario) ss.add(p.s);
  for (const p of f.colocado) ss.add(p.s);
  const nMax = Math.max(0, ...f.necessario.map((p) => p.v));
  if (nMax <= tol) return true;
  if (!f.colocado.length) return false;
  const c0 = f.colocado[0]!.s;
  const c1 = f.colocado[f.colocado.length - 1]!.s;
  // a ponta das barras do lado livre: dali ao fim, se for só o cobrimento (`ate`), não se compara
  let ultimo = -1;
  f.colocado.forEach((p, i) => { if (p.v > 0) ultimo = i; });
  const fimDasBarras = ultimo >= 0 && ultimo + 1 < f.colocado.length ? f.colocado[ultimo + 1]!.s : Infinity;
  const corte = fimDasBarras >= ate - 1e-6 ? fimDasBarras : Infinity;
  for (const s of ss) {
    if (s >= corte - 1e-6) continue;
    const nv = valorEm(f.necessario, s);
    if (nv <= tol) continue;
    const cv = s < c0 - 1e-6 || s > c1 + 1e-6 ? 0 : valorEm(f.colocado, s);
    if (nv > cv + tol + 1e-9 * Math.max(1, nv)) return false;
  }
  return true;
}

function diagrama(unidade: UnidadeDoDiagrama, faces: FaceDoDiagrama[], picos: Pico[], esquematico: boolean, fimLivre = 0): Diagrama {
  const fs = faces.filter((f) => f.necessario.length || f.colocado.length || f.naoResiste.length);
  const L = Math.max(0, ...fs.flatMap((f) => [...f.necessario, ...f.colocado].map((p) => p.s)));
  return { unidade, faces: fs, picos, esquematico, fimLivre, envolve: fs.every((f) => envolve(f, unidade, L - fimLivre)) };
}

/** O fim livre das hastes: o cobrimento de topo da barra (3 cm, modulacao/contexto.ts COB_TOPO) e uma bitola de folga. */
const FIM_DA_HASTE = 60;

const face = (lado: 1 | -1, o: Partial<Omit<FaceDoDiagrama, 'face'>>): FaceDoDiagrama => ({
  face: lado, necessario: o.necessario ?? [], naoResiste: o.naoResiste ?? [], colocado: o.colocado ?? [], familias: o.familias ?? [], minimo: o.minimo ?? null,
});

// ───────────────────────────── montagem ─────────────────────────────

interface Montagem {
  id: string;
  tipo: TipoDeBarra;
  nome: string;
  card: string;
  trecho: number;
  de: Vec3;
  ate: Vec3;
  lado: Vec3;
  flexao: Diagrama | null;
  cortante: Diagrama | null;
  momento: { msd: string | null; mrd: string | null; fator: number; unidade: UnidadeDoMomento };
  aps: string[];
}

function fechar(r: Resultado, b: Montagem): BarraAnalitica {
  const { n } = leitor(r);
  const aps = b.aps.map((a) => [a, n(a)] as const).filter((x): x is readonly [string, number] => x[1] !== null);
  const ap = aps.length ? Math.max(...aps.map((x) => x[1])) : null;
  const nec = b.flexao?.picos.find((p) => p.qual === 'nec') ?? null;
  const col = b.flexao?.picos.find((p) => p.qual === 'col') ?? null;
  const val = (nm: string | null) => (nm === null ? null : n(nm));
  const msd = val(b.momento.msd);
  const mrd = val(b.momento.mrd);
  return {
    id: b.id, tipo: b.tipo, grupo: GRUPO_DO_TIPO[b.tipo], nome: b.nome, card: b.card, trecho: b.trecho, de: b.de, ate: b.ate, lado: b.lado,
    flexao: b.flexao, cortante: b.cortante,
    leitura: {
      msd: msd === null ? null : Math.abs(msd) * b.momento.fator, mrd: mrd === null ? null : mrd * b.momento.fator, unidade: b.momento.unidade,
      nomes: [b.momento.msd, b.momento.mrd].filter((x): x is string => !!x), asNec: nec?.valor ?? null, asEf: col?.valor ?? null,
    },
    aproveitamento: ap,
    nomesDoAproveitamento: aps.map((x) => x[0]),
    passa: ap === null ? null : ap <= 1,
  };
}

const vaos = (xs: number[]): [number, number][] => xs.slice(1).map((x, i) => [xs[i]!, x]);

/** O x de cada trecho onde ficam a faixa da sapata e os painéis não armados: o meio (ou o meio do vão do meio). */
function estacaoDoTrecho(x0: number, x1: number, apoios: number[]): { x: number; vao: [number, number] | null } {
  const meio = (x0 + x1) / 2;
  const vs = vaos(apoios);
  if (!vs.length) return { x: meio, vao: null };
  let melhor = vs[0]!;
  for (const v of vs) if (Math.abs((v[0] + v[1]) / 2 - meio) < Math.abs((melhor[0] + melhor[1]) / 2 - meio)) melhor = v;
  return { x: (melhor[0] + melhor[1]) / 2, vao: melhor };
}

const caixaDe = (m: Modelo, p: Peca) => {
  const g = m.geometrias[p.geometria];
  return g ? caixaGlobal(p, g) : null;
};

function faixaEm(m: Modelo, eixo: 0 | 1 | 2, filtro: (p: Peca) => boolean): [number, number] | null {
  let a = Infinity;
  let b = -Infinity;
  for (const p of m.pecas) {
    if (!filtro(p)) continue;
    const c = caixaDe(m, p);
    if (!c) continue;
    a = Math.min(a, c.min[eixo]);
    b = Math.max(b, c.max[eixo]);
  }
  return Number.isFinite(a) ? [a, b] : null;
}

/** As fiadas de canaleta da parede (z do meio), por trecho. */
function fiadasDeCanaleta(m: Modelo, trecho: number): number[] {
  const zs = new Map<number, number>();
  for (const p of m.pecas) {
    if (p.grupo !== 'muro' || p.trecho !== trecho || p.fiada === undefined) continue;
    if (p.tipo !== 'CANALETA' && p.tipo !== 'MEIA_CANALETA' && p.tipo !== 'CANALETA_CORTADA') continue;
    const c = caixaDe(m, p);
    if (!c) continue;
    zs.set(p.fiada, (c.min[2] + c.max[2]) / 2);
  }
  return [...zs.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

const ordinal = (z: number) => `${Math.floor(z / 200) + 1}ª fiada`;

/**
 * A janela "por metro" de uma peça armada a cada `s` (mm): um número inteiro de espaçamentos (o mais perto de 1 m),
 * com as bordas no MEIO entre duas barras — a janela pega sempre o mesmo número de barras e a espera que fica ao lado
 * da barra dela não cai do outro lado da borda. Centro: a barra mais perto de `xc`.
 */
function janela(barras: readonly Barra[], papeis: readonly PapelBarra[], xc: number, s: number, perto: (b: Barra) => boolean): [number, number] {
  const k = Math.max(1, Math.round(1000 / s));
  const xs = barras.filter((b) => papeis.includes(b.papel) && perto(b)).map((b) => b.eixo.reduce((a, p) => a + p[0], 0) / b.eixo.length);
  let x0 = xc;
  let d = Infinity;
  for (const x of xs) if (Math.abs(x - xc) < d) { d = Math.abs(x - xc); x0 = x; }
  const a = x0 - s / 2 - Math.floor((k - 1) / 2) * s;
  return [a, a + k * s];
}

const unit = (a: Vec3, b: Vec3): { u: Vec3; L: number } => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return { u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L], L };
};

/** As rampas de uma família: ℓb,nec reto, dobrado e o ℓ0t (cm na planilha → mm). */
function ancoragens(r: Resultado, reta: string, dobrada: string, traspasse: string | null): (b: Barra) => Ancoragens {
  const { n } = leitor(r);
  const mm = (x: number | null) => (x === null ? 0 : x * CMmm);
  const l0 = traspasse ? n(traspasse) : null;
  const a: Ancoragens = { reta: mm(n(reta)), dobrada: mm(n(dobrada)), traspasse: l0 === null ? null : l0 * CMmm };
  return () => a;
}

export function barrasAnaliticas(r: Resultado | null, modelo: Modelo | null): BarraAnalitica[] {
  if (!r || !modelo) return [];
  try {
    return montar(r, modelo);
  } catch (e) {
    console.error('[esforços] não consegui montar as barras:', e);
    return [];
  }
}

/**
 * Os nós de uma haste engastada (balanço, contraforte): o perfil do solo de 41 nós (`perf_*`, y = `perf_y`) até a
 * altura de solo e, acima dela, a tabela do vento de 11 nós (`vt_*`, y = `vt_y`), que é a única carga lá em cima.
 */
function nosDaHaste(r: Resultado, perfil: string, vento: string): NoNec[] {
  const ys = coluna(r, 'perf_y');
  const vs = coluna(r, perfil);
  const out: NoNec[] = [];
  let topo = -Infinity;
  ys.forEach((y, i) => {
    const c = vs[i];
    if (y.v === null || !c) return;
    if (c.v === null && !c.texto) return;
    out.push({ s: y.v * M, v: c.v, celula: c.celula });
    topo = Math.max(topo, y.v);
  });
  const yv = coluna(r, 'vt_y');
  const vv = coluna(r, vento);
  yv.forEach((y, i) => {
    const c = vv[i];
    if (y.v === null || !c || (c.v === null && !c.texto)) return;
    // abaixo do solo vale o nó do perfil (mais fino, e com o empuxo)
    if (y.v <= topo + 1e-9) return;
    out.push({ s: y.v * M, v: c.v, celula: c.celula });
  });
  return out.sort((a, b) => a.s - b.s);
}

const absNos = (ns: NoNec[]): NoNec[] => ns.map((x) => ({ ...x, v: x.v === null ? null : Math.abs(x.v) }));

function montar(r: Resultado, modelo: Modelo): BarraAnalitica[] {
  const { n, t } = leitor(r);
  const out: BarraAnalitica[] = [];
  const por = (b: Montagem) => out.push(fechar(r, b));
  const contrafortes = t('Tipo_muro').toLowerCase().startsWith('contra');
  const tb = modelo.familia.t;
  const H = modelo.dims.H_muro;
  const yMeio = tb / 2;
  const trechos = modelo.dims.trechos.map((tr, i) => ({ ...tr, numero: i + 1 }));
  const cfs = [...modelo.dims.contrafortes].sort((a, b) => a.x - b.x);
  const apoiosDo = (k: number) => cfs.filter((c) => c.trecho === k).map((c) => c.x);
  const barras = modelo.barras;
  const cel = (c: string | undefined) => (c ? numero(r.cel(c)) : null);

  /** O pico do necessário na seção crítica (o nó `no`) e o colocado lá. */
  const picosNaSecao = (no: NoNec | undefined, f: FaceDoDiagrama, nome: string, planilhaCol: string): Pico[] => {
    if (!no) return [];
    const ps: Pico[] = [];
    if (no.v !== null) ps.push({ s: no.s, valor: Math.max(0, no.v), qual: 'nec', face: f.face, ...(nome ? { nome } : {}), ...(no.celula ? { celula: no.celula } : {}), fator: 1 });
    if (f.colocado.length) ps.push({ s: no.s, valor: valorEm(f.colocado, no.s), qual: 'col', face: f.face, planilha: planilhaCol, fator: 1 });
    return ps;
  };

  // ── balanço: a faixa de 1 m no meio de cada trecho ──
  if (!contrafortes) {
    const sMm = (n('s_adot') ?? 0) * CMmm;
    for (const tr of trechos) {
      const x = (tr.x0 + tr.x1) / 2;
      const de: Vec3 = [x, yMeio, 0];
      const ate: Vec3 = [x, yMeio, H];
      const { u, L } = unit(de, ate);
      const nos = nosDaHaste(r, 'perf_As', 'vt_As');
      if (!nos.length) continue;
      const nec = necessarioDe(nos, L);
      let colocado: PontoDoDiagrama[] = [];
      let familias: FaceDoDiagrama['familias'] = [];
      let largura = 1000;
      if (sMm > 0) {
        const doTrecho = (b: Barra) => b.trecho === tr.numero;
        const [xa, xb] = janela(barras, ['VERT_MURO'], x, sMm, doTrecho);
        largura = xb - xa;
        const rec: Recorte = {
          de, u, L, papeis: ['VERT_MURO', 'ESPERA'], largura,
          dentro: (p) => p[0] >= xa && p[0] < xb && p[1] >= -1 && p[1] <= tb + 1,
          ancoragem: ancoragens(r, 'lbn_v', 'lbg_v', 'l0t_v'),
        };
        ({ pontos: colocado, familias } = acoColocado(barras.filter(doTrecho), rec));
      }
      const f1 = face(1, { necessario: nec.pontos, naoResiste: nec.naoResiste, colocado, familias, minimo: n('As_min') });
      // cortante: VSd ao longo da altura × Va (a resistência sem estribo que a aba compara)
      const vnos = absNos(nosDaHaste(r, 'perf_Vd', 'vt_Vd'));
      const vn = necessarioDe(vnos, L);
      const c1 = face(1, { necessario: vn.pontos, naoResiste: vn.naoResiste, colocado: constante(n('Va_'), 0, L) });
      por({
        id: `T${tr.numero}.BAL`, tipo: 'balanco', nome: `Muro em balanço · T${tr.numero}`, card: 'balanco.flexao', trecho: tr.numero, de, ate, lado: [0, 1, 0],
        flexao: diagrama('cm²/m', [f1], picosNaSecao(nos[0], f1, 'As_nec', 'As_ef'), false, FIM_DA_HASTE),
        cortante: diagrama('kN/m', [c1], vnos[0] && vnos[0].v !== null ? [{ s: vnos[0].s, valor: vnos[0].v, qual: 'nec', face: 1, nome: 'Vsd_', ...(vnos[0].celula ? { celula: vnos[0].celula } : {}), fator: 1 }, ...(n('Va_') !== null ? [{ s: 0, valor: n('Va_')!, qual: 'col' as const, face: 1 as const, nome: 'Va_', fator: 1 }] : [])] : [], false),
        momento: { msd: 'Md_', mrd: 'MRd_bal', fator: 1, unidade: 'kN·m/m' }, aps: ['ap_bal'],
      });
      // painel não armado de baixo, ao lado da faixa (entre ela e a barra vizinha)
      const l = n('l_pan');
      const h = n('h_pan');
      if (l !== null && h !== null && l > 0 && h > 0) {
        const xa = Math.min(x, tr.x1 - l * M);
        naoArmado(r, por, {
          id: `T${tr.numero}.PAN`, trecho: tr.numero, card: 'painelEls.painel', rotulo: `Painel não armado · T${tr.numero}`,
          x0: xa, x1: xa + l * M, z0: 0, z1: Math.min(h * M, H), y: yMeio,
          par: ['Mpar', 'MRp_pan', 'ap_ppan'], nor: ['Mnor', 'MRn_pan', 'ap_npan'], fator: 1,
        });
      }
    }
  }

  // ── contrafortes, painel entre eles, canaletas e cinta ──
  if (contrafortes) {
    const interEhEste = t('tipo_cf').toLowerCase().startsWith('inter');
    const conjuntoDe = (ponta: boolean) => {
      const este = ponta !== interEhEste; // ponta = extremidade
      return este
        ? { as: 'perf_Asc', asv: 'vt_Asc', asw: 'perf_Aswc', aswv: 'vt_Aswc', md: 'Md_cf', mrd: 'MRd_cf', ap: ['ap_cf'], nomeAs: 'As_cfn', nomeAsw: 'Asw_c' }
        : { as: 'perf_Aso', asv: 'vt_Aso', asw: 'perf_Aswo', aswv: 'vt_Aswo', md: 'Md_cfo', mrd: 'MRd_cfo', ap: ['ap_cfo'], nomeAs: '', nomeAsw: '' };
    };
    const faixaCf = faixaEm(modelo, 1, (p) => p.grupo === 'contraforte');
    const yCf = faixaCf ? (faixaCf[0] + faixaCf[1]) / 2 : yMeio;
    const anc = ancoragens(r, 'lbn_cf', 'lbg_cf', 'l0t_cf');
    cfs.forEach((c, i) => {
      const k = conjuntoDe(c.ponta);
      const de: Vec3 = [c.x, yCf, 0];
      const ate: Vec3 = [c.x, yCf, H];
      const { u, L } = unit(de, ate);
      const nos = nosDaHaste(r, k.as, k.asv);
      if (!nos.length) return;
      const nec = necessarioDe(nos, L);
      const doCf = (b: Barra) => b.trecho === c.trecho;
      // a seção do contraforte: as principais (o As da conta) e as esperas DELAS — a espera mais perto de uma
      // principal que de uma construtiva (as das construtivas, do lado comprimido, não entram no As da aba)
      const noCf = (b: Barra) => doCf(b) && Math.abs(b.eixo[0]![0] - c.x) <= tb / 2 + 1;
      const pts = (papel: PapelBarra) => barras.filter((b) => b.papel === papel && noCf(b)).map((b) => b.eixo[0]!);
      const princ = pts('CF_PRINCIPAL');
      const constr = pts('CF_CONSTRUTIVA');
      const dist = (p: Vec3, qs: Vec3[]) => qs.reduce((m, q) => Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])), Infinity);
      const rec: Recorte = {
        de, u, L, papeis: ['CF_PRINCIPAL', 'ESPERA'], largura: null,
        dentro: (p, b) => Math.abs(p[0] - c.x) <= tb / 2 + 1 && (b.papel === 'CF_PRINCIPAL' || dist(p, princ) < dist(p, constr)),
        ancoragem: anc,
      };
      const { pontos: colocado, familias } = acoColocado(barras.filter(doCf), rec);
      const f1 = face(1, { necessario: nec.pontos, naoResiste: nec.naoResiste, colocado, familias, minimo: n('As_cfm') });
      const picos = picosNaSecao(nos[0], f1, k.nomeAs, 'As_cfe');
      // cortante: Asw/s necessário (planilha) × os estribos do modelo (a distância entre dois seguidos)
      const wnos = nosDaHaste(r, k.asw, k.aswv);
      const wn = necessarioDe(wnos, L);
      const ests = barras.filter((b) => b.papel === 'CF_ESTRIBO' && doCf(b) && Math.abs(b.eixo.reduce((a, p) => a + p[0], 0) / b.eixo.length - c.x) <= tb);
      const zs = ests.map((b) => Math.min(...b.eixo.map((p) => p[2])));
      const phiE = ests[0]?.diametro ?? 0;
      const wc = estribosAoLongo(zs, areaDaBarra(phiE), 2, L);
      const c1 = face(1, { necessario: wn.pontos, naoResiste: wn.naoResiste, colocado: wc, minimo: wn.pontos.some((p) => p.v > 0) ? n('Asw_m') : null });
      const w0 = wnos[0];
      por({
        id: `CF${i + 1}`, tipo: 'contraforte', nome: `Contraforte ${i + 1}${c.ponta ? ' · extremidade' : ''}`, card: 'contraforte.flexao', trecho: c.trecho,
        de, ate, lado: [0, 1, 0],
        flexao: diagrama('cm²', [f1], picos, false, FIM_DA_HASTE),
        cortante: diagrama('cm²/m', [c1], w0 && w0.v !== null ? [{ s: w0.s, valor: w0.v, qual: 'nec', face: 1, ...(k.nomeAsw ? { nome: k.nomeAsw } : {}), ...(w0.celula ? { celula: w0.celula } : {}), fator: 1 }, // o colocado no 1º estribo (abaixo dele, na junta da sapata, ainda não há estribo)
          ...(wc.length > 2 ? [{ s: wc[1]!.s, valor: wc[1]!.v, qual: 'col' as const, face: 1 as const, planilha: 'Asw_e', fator: 1 }] : [])] : [], false),
        momento: { msd: k.md, mrd: k.mrd, fator: 1, unidade: 'kN·m' }, aps: k.ap,
      });
    });

    const duasPv = t('pos_pv').startsWith('2');
    const asPvs = n('Amv_s');
    const asPve = n('Amv_e');
    const efPv = n('Amv_ef');
    const asPh = n('Amh_n');
    const efPh = n('Amh_ef');
    const msdCin = n('Msd_cin');

    for (const tr of trechos) {
      const apoios = apoiosDo(tr.numero);
      const canaletas = fiadasDeCanaleta(modelo, tr.numero);
      const zCinta = canaletas.length ? canaletas[canaletas.length - 1]! : null;
      vaos(apoios).forEach(([xa, xb], j) => {
        const vao = `vão ${j + 1}${trechos.length > 1 ? ` · T${tr.numero}` : ''}`;
        const xm = (xa + xb) / 2;
        // faixa vertical do painel: engaste na base (lado do solo) e vão (face de fora), zero no topo livre
        if (asPvs !== null || asPve !== null || t('Amv_s') !== '') {
          const L = H;
          // a forma é só ilustrativa (tabela de placa): o engaste da base até 1/4 da altura, o vão com o pico a 5/8
          const base = (xi: number) => (xi <= 0.25 ? Math.cos((Math.PI / 2) * (xi / 0.25)) : 0);
          const meio = (xi: number) => (xi >= 0.25 ? Math.sin((Math.PI * (xi - 0.25)) / 0.75) : 0);
          const fS = face(1, {
            necessario: asPvs === null ? [] : forma(24, L, asPvs, base), naoResiste: asPvs === null && t('Amv_s') !== '' ? [[0, 0.25 * L]] : [],
            colocado: constante(efPv, 0, L), minimo: n('Amv_m'),
          });
          const fE = face(-1, { necessario: asPve === null ? [] : forma(24, L, asPve, meio), colocado: constante(efPv, 0, L), minimo: duasPv ? n('Amv_m') : null });
          const picos: Pico[] = [];
          if (asPvs !== null && asPvs > 0) picos.push({ s: 0, valor: asPvs, qual: 'nec', face: 1, nome: 'Amv_s', fator: 1 });
          if (asPve !== null && asPve > 0) picos.push({ s: 0.625 * L, valor: asPve, qual: 'nec', face: -1, nome: 'Amv_e', fator: 1 });
          if (efPv !== null) picos.push({ s: 0, valor: efPv, qual: 'col', face: 1, nome: 'Amv_ef', fator: 1 });
          por({
            id: `T${tr.numero}.V${j + 1}.PV`, tipo: 'painelVertical', nome: `Painel vertical · ${vao}`, card: 'painelCf.flexaoVertical', trecho: tr.numero,
            de: [xm, yMeio, 0], ate: [xm, yMeio, H], lado: [0, 1, 0],
            flexao: diagrama('cm²/m', [fS, fE], picos, true), cortante: null,
            momento: { msd: 'M_pvs', mrd: 'MRd_pvs', fator: CM, unidade: 'kN·m/m' }, aps: ['ap_pvs', 'ap_pve'],
          });
        }
        const L = xb - xa;
        canaletas.forEach((z) => {
          const cinta = z === zCinta && msdCin !== null;
          if (cinta) {
            const ast = n('Ast_cin');
            const f = face(1, {
              necessario: ast === null ? [] : forma(20, L, ast, parabola), naoResiste: ast === null ? [[0, L]] : [], colocado: constante(n('Asb_cin'), 0, L),
            });
            const picos: Pico[] = [];
            if (ast !== null) picos.push({ s: L / 2, valor: ast, qual: 'nec', face: 1, nome: 'Ast_cin', fator: 1 });
            if (n('Asb_cin') !== null) picos.push({ s: L / 2, valor: n('Asb_cin')!, qual: 'col', face: 1, nome: 'Asb_cin', fator: 1 });
            por({
              id: `T${tr.numero}.V${j + 1}.CIN`, tipo: 'cinta', nome: `Cinta do topo · ${vao}`, card: 'painelCf.flexaoHorizontal', trecho: tr.numero,
              de: [xa, yMeio, z], ate: [xb, yMeio, z], lado: [0, -1, 0],
              flexao: diagrama('cm²', [f], picos, true), cortante: null,
              momento: { msd: 'Msd_cin', mrd: 'MRd_cin', fator: CM, unidade: 'kN·m' }, aps: ['ap_cin'],
            });
            return;
          }
          if (asPh === null && t('Amh_n') === '') return;
          const f = face(1, {
            necessario: asPh === null ? [] : forma(20, L, asPh, parabola), naoResiste: asPh === null ? [[0, L]] : [], colocado: constante(efPh, 0, L), minimo: n('Amh_m'),
          });
          const picos: Pico[] = [];
          if (asPh !== null) picos.push({ s: L / 2, valor: asPh, qual: 'nec', face: 1, nome: 'Amh_n', fator: 1 });
          if (efPh !== null) picos.push({ s: L / 2, valor: efPh, qual: 'col', face: 1, nome: 'Amh_ef', fator: 1 });
          por({
            id: `T${tr.numero}.V${j + 1}.C${Math.floor(z / 200) + 1}`, tipo: 'canaleta', nome: `Canaleta ${ordinal(z)} · ${vao}`, card: 'painelCf.flexaoHorizontal', trecho: tr.numero,
            de: [xa, yMeio, z], ate: [xb, yMeio, z], lado: [0, -1, 0],
            flexao: diagrama('cm²/m', [f], picos, true), cortante: null,
            momento: { msd: 'M_ph', mrd: 'MRd_ph', fator: CM, unidade: 'kN·m/m' }, aps: ['ap_ph'],
          });
        });
      });
      // subpainel não armado de baixo, no vão do meio do trecho
      const est = estacaoDoTrecho(tr.x0, tr.x1, apoios);
      const l = n('l_sp');
      const h = n('h_sp');
      if (est.vao && l !== null && h !== null && l > 0 && h > 0) {
        const xa = Math.min(est.x, est.vao[1] - l * M);
        naoArmado(r, por, {
          id: `T${tr.numero}.SP`, trecho: tr.numero, card: 'painelCf.naoArmado', rotulo: `Subpainel não armado · T${tr.numero}`,
          x0: xa, x1: xa + l * M, z0: 0, z1: Math.min(h * M, H), y: yMeio,
          par: ['Mpar_sp', 'MRp_sp', 'ap_psp'], nor: ['Mnor_sp', 'MRn_sp', 'ap_nsp'], fator: CM,
        });
      }
    }
  }

  // ── sapata: ponta, talão e dente, uma faixa por trecho ──
  const toe = n('toe');
  const heel = n('heel');
  const hSap = n('h_sap');
  const zSap = hSap !== null ? (-hSap * M) / 2 : (modelo.dims.sapata.z0 + modelo.dims.sapata.z1) / 2;
  const dS = (n('d_s') ?? 0) * CMmm;
  const sPs = (n('s_ps') ?? 0) * CMmm;
  const ancS = ancoragens(r, 'lbn_s', 'lbg_s', null);
  // o fim livre da sapata e do dente: o cobrimento da sapata e a dobra do estribo
  const fimSapata = (n('cob_sap') ?? 4) * CMmm + 60;
  for (const tr of trechos) {
    const { x } = estacaoDoTrecho(tr.x0, tr.x1, contrafortes ? apoiosDo(tr.numero) : []);
    const T = ` · T${tr.numero}`;
    const doTrecho = (b: Barra) => b.trecho === tr.numero;
    const jSap = sPs > 0 ? janela(barras, ['SAP_TRANSV'], x, sPs, doTrecho) : null;
    // as barras transversais da sapata numa face (embaixo: z abaixo do meio da sapata), na janela por metro
    const colocadoNaSapata = (de: Vec3, ate: Vec3, embaixo: boolean) => {
      if (!jSap) return { pontos: [] as PontoDoDiagrama[], familias: [] as FaceDoDiagrama['familias'] };
      const { u, L } = unit(de, ate);
      const rec: Recorte = {
        de, u, L, papeis: ['SAP_TRANSV'], largura: jSap[1] - jSap[0],
        dentro: (p) => p[0] >= jSap[0] && p[0] < jSap[1] && (embaixo ? p[2] < zSap : p[2] > zSap),
        ancoragem: ancS,
      };
      return acoColocado(barras.filter(doTrecho), rec);
    };
    /** O balanço da sapata a partir da face: As das duas faces (fatias da seção 7) e o cortante a partir de d. */
    const balancoDaSapata = (tipo: 'ponta' | 'talao', comp: number, de: Vec3, ate: Vec3, lado: Vec3, tag: 'T' | 'H') => {
      const L = comp * M;
      const es = coluna(r, `${tag}_e`);
      const lerNos = (nome: string): NoNec[] => {
        const vs = coluna(r, nome);
        const out: NoNec[] = [];
        es.forEach((e, i) => {
          const c = vs[i];
          if (e.v === null || !c || (c.v === null && !c.texto)) return;
          out.push({ s: e.v * M, v: c.v, celula: c.celula });
        });
        // a ponta livre não tem linha na planilha: lá não há momento, nem aço
        out.push({ s: L, v: 0 });
        return out.sort((a, b) => a.s - b.s);
      };
      const principal = lerNos(`${tag}_As`);
      const oposta = lerNos(`${tag}_Aso`);
      const n1 = necessarioDe(principal, L);
      const n2 = necessarioDe(oposta, L);
      const minimo = n('As_ms');
      const c1 = colocadoNaSapata(de, ate, tipo === 'ponta');
      const c2 = colocadoNaSapata(de, ate, tipo !== 'ponta');
      const f1 = face(1, { necessario: n1.pontos, naoResiste: n1.naoResiste, colocado: c1.pontos, familias: c1.familias, minimo });
      const temOposta = n2.pontos.some((p) => p.v > 0) || n2.naoResiste.length > 0;
      const f2 = face(-1, { necessario: temOposta ? n2.pontos : [], naoResiste: n2.naoResiste, colocado: temOposta ? c2.pontos : [], familias: temOposta ? c2.familias : [], minimo: temOposta ? minimo : null });
      const picos = picosNaSecao(principal[0], f1, tipo === 'ponta' ? 'As_ts' : 'As_hs', 'Ase_s');
      // cortante: a aba confere a seção a d da face (Vsd_t, Vsd_h); antes de d não se desenha o solicitante
      const vs = coluna(r, `${tag}_Vd`);
      const vnos: NoNec[] = [];
      es.forEach((e, i) => {
        const c = vs[i];
        if (e.v === null || !c || c.v === null) return;
        if (e.v * M >= dS - 1e-6) vnos.push({ s: e.v * M, v: Math.abs(c.v), celula: c.celula });
      });
      vnos.push({ s: L, v: 0 });
      const vn = necessarioDe(vnos, L);
      const vr = n('VRd1_s');
      const cf = face(1, { necessario: vn.pontos, colocado: constante(vr, 0, L) });
      const v0 = [...vnos].sort((a, b) => a.s - b.s)[0];
      por({
        id: `T${tr.numero}.${tipo === 'ponta' ? 'PONTA' : 'TALAO'}`, tipo, nome: `${tipo === 'ponta' ? 'Ponta' : 'Talão'} da sapata${T}`,
        card: tipo === 'ponta' ? 'sapata.flexao.ponta' : 'sapata.flexao.talao', trecho: tr.numero, de, ate, lado,
        flexao: diagrama('cm²/m', [f1, f2], picos, false, fimSapata),
        cortante: diagrama('kN/m', [cf], [...(v0 && v0.v !== null ? [{ s: v0.s, valor: v0.v, qual: 'nec' as const, face: 1 as const, ...(v0.celula ? { celula: v0.celula } : {}), fator: 1 }] : []), ...(vr !== null ? [{ s: L, valor: vr, qual: 'col' as const, face: 1 as const, nome: 'VRd1_s', fator: 1 }] : [])], false),
        momento: tipo === 'ponta' ? { msd: 'Md_ts', mrd: 'MRd_toe', fator: 1, unidade: 'kN·m/m' } : { msd: 'Md_hs', mrd: 'MRd_heel', fator: 1, unidade: 'kN·m/m' },
        aps: [tipo === 'ponta' ? 'ap_toe' : 'ap_heel'],
      });
    };
    if (toe !== null && toe > 0) balancoDaSapata('ponta', toe, [x, 0, zSap], [x, -toe * M, zSap], [0, 0, -1], 'T');
    if (heel !== null && heel > 0) balancoDaSapata('talao', heel, [x, tb, zSap], [x, tb + heel * M, zSap], [0, 0, 1], 'H');

    // dente: da face de baixo da sapata para baixo, no eixo pedido (x_den a partir do centro, + para a ponta)
    if (t('tem_den') === 'Sim' && n('Md_den') !== null) {
      const hDen = n('h_den');
      const B = n('B_sap');
      if (hDen !== null && hDen > 0 && hSap !== null && toe !== null && B !== null) {
        // o centro da sapata desenhada (= −ponta + B/2 quando o muro está sobre ela; o sorteio que põe o eixo do muro
        // além da largura tira a sapata de baixo dele, e o dente vai com ela)
        const yCentro = Number.isFinite(modelo.dims.sapata.y0) ? (modelo.dims.sapata.y0 + modelo.dims.sapata.y1) / 2 : -toe * M + (B * M) / 2;
        const y = yCentro - (n('x_den') ?? 0) * M;
        const L = hDen * M;
        const de: Vec3 = [x, y, -hSap * M];
        const ate: Vec3 = [x, y, -hSap * M - L];
        const { u } = unit(de, ate);
        const zs = coluna(r, 'den_z');
        const lerNos = (nome: string, abs: boolean): NoNec[] => {
          const vs = coluna(r, nome);
          const o: NoNec[] = [];
          zs.forEach((z, i) => {
            const c = vs[i];
            if (z.v === null || !c || (c.v === null && !c.texto)) return;
            o.push({ s: z.v * M, v: c.v === null ? null : abs ? Math.abs(c.v) : c.v, celula: c.celula });
          });
          return o.sort((a, b) => a.s - b.s);
        };
        const nos = lerNos('den_As', false);
        const nec = necessarioDe(nos, L);
        const sDen = (n('s_den') ?? 0) * CMmm;
        let col: ReturnType<typeof acoColocado> | null = null;
        if (sDen > 0) {
          const [xa, xb] = janela(barras, ['DENTE_ESTRIBO'], x, sDen, doTrecho);
          // o ramo da frente do estribo (do lado da ponta, −Y): o que a flexão do dente traciona
          col = acoColocado(barras.filter(doTrecho), {
            de, u, L, papeis: ['DENTE_ESTRIBO'], largura: xb - xa,
            dentro: (p) => p[0] >= xa && p[0] < xb && p[1] < y,
            ancoragem: ancoragens(r, 'lbn_den', 'lbn_den', null),
          });
        }
        const f1 = face(1, { necessario: nec.pontos, naoResiste: nec.naoResiste, colocado: col?.pontos ?? [], familias: col?.familias ?? [], minimo: n('Asm_den') });
        const vnos = lerNos('den_Vd', true);
        const vn = necessarioDe(vnos, L);
        const vr = n('VRd1_den');
        const cf = face(1, { necessario: vn.pontos, naoResiste: vn.naoResiste, colocado: constante(vr, 0, L) });
        const v0 = vnos[0];
        por({
          id: `T${tr.numero}.DENTE`, tipo: 'dente', nome: `Dente${T}`, card: 'fundacao.dente', trecho: tr.numero, de, ate, lado: [0, -1, 0],
          flexao: diagrama('cm²/m', [f1], picosNaSecao(nos[0], f1, 'As_den', 'Ase_den'), false, fimSapata),
          cortante: diagrama('kN/m', [cf], [...(v0 && v0.v !== null ? [{ s: v0.s, valor: v0.v, qual: 'nec' as const, face: 1 as const, nome: 'Vd_den', ...(v0.celula ? { celula: v0.celula } : {}), fator: 1 }] : []), ...(vr !== null ? [{ s: L, valor: vr, qual: 'col' as const, face: 1 as const, nome: 'VRd1_den', fator: 1 }] : [])], false),
          momento: { msd: 'Md_den', mrd: 'MRd_den', fator: 1, unidade: 'kN·m/m' }, aps: ['ap_den'],
        });
      }
    }
  }

  // ── muro de cima: pilaretes, a ligação deles no arrimo, cintas e os painéis A/B ──
  const mc = modelo.dims.muroDeCima;
  if (mc && t('mc_on') === 'Sim') {
    const hMc = mc.z1 - mc.z0;
    const pils = [...mc.pilaretes].sort((a, b) => a - b);
    const faixaPil = faixaEm(modelo, 1, (p) => p.tipo === 'PILARETE');
    const yPil = faixaPil ? (faixaPil[0] + faixaPil[1]) / 2 : yMeio;
    const bPil = (n('b_pila') ?? 0) * CMmm;
    const concreto = t('pil_tipo').startsWith('Conc');
    const nomeAsPil = concreto ? 'Asc_pil' : 'Asb_pil';
    const ys = coluna(r, 'pt_y');
    const lerPt = (nome: string, abs: boolean): NoNec[] => {
      const vs = coluna(r, nome);
      const o: NoNec[] = [];
      ys.forEach((y, i) => {
        const c = vs[i];
        if (y.v === null || !c || (c.v === null && !c.texto)) return;
        o.push({ s: y.v * M, v: c.v === null ? null : abs ? Math.abs(c.v) : c.v, celula: c.celula });
      });
      return o.sort((a, b) => a.s - b.s);
    };
    const nosAs = lerPt('pt_As', false);
    const nosV = lerPt('pt_Vd', true);
    const l0t = n('l0t_pil');
    const mdPil = n('Md_pil');
    const anc = ancoragens(r, 'lbn_pil', 'lbg_pil', 'l0t_pil');
    pils.forEach((x, i) => {
      const trecho = trechos.find((tr) => x >= tr.x0 - 1 && x <= tr.x1 + 1)?.numero ?? 1;
      if (nosAs.length) {
        const de: Vec3 = [x, yPil, mc.z0];
        const ate: Vec3 = [x, yPil, mc.z1];
        const { u, L } = unit(de, ate);
        const nec = necessarioDe(nosAs, L);
        // as barras de UMA face do pilarete (a do lado do solo), na seção inteira dele
        const col = acoColocado(barras.filter((b) => b.trecho === trecho), {
          de, u, L, papeis: ['PIL_LONG'], largura: null,
          dentro: (p) => Math.abs(p[0] - x) <= Math.max(bPil, 1) / 2 + 1 && p[1] > yPil,
          ancoragem: anc,
        });
        const f1 = face(1, { necessario: nec.pontos, naoResiste: nec.naoResiste, colocado: col.pontos, familias: col.familias, minimo: n('Asmu_pil') });
        const vn = necessarioDe(nosV, L);
        const vr = n('VRd_pil');
        const cf = face(1, { necessario: vn.pontos, naoResiste: vn.naoResiste, colocado: constante(vr, 0, L) });
        const v0 = nosV[0];
        por({
          id: `PIL${i + 1}`, tipo: 'pilarete', nome: `Pilarete ${i + 1}`, card: 'murocima.pilarete', trecho, de, ate, lado: [0, 1, 0],
          flexao: diagrama('cm²', [f1], picosNaSecao(nosAs[0], f1, nomeAsPil, 'As_pile'), false, FIM_DA_HASTE),
          cortante: diagrama('kN', [cf], [...(v0 && v0.v !== null ? [{ s: v0.s, valor: v0.v, qual: 'nec' as const, face: 1 as const, nome: 'Vd_pil', ...(v0.celula ? { celula: v0.celula } : {}), fator: 1 }] : []), ...(vr !== null ? [{ s: L, valor: vr, qual: 'col' as const, face: 1 as const, nome: 'VRd_pil', fator: 1 }] : [])], false),
          momento: { msd: 'Md_pil', mrd: 'MRd_pil', fator: 1, unidade: 'kN·m' }, aps: ['ap_pil'],
        });
      }
      // a ligação: o momento da base do pilarete entrando no arrimo, no comprimento do traspasse
      if (mdPil !== null && l0t !== null && l0t > 0) {
        const L = Math.min(l0t * CMmm, mc.z0);
        const asLig = n('As_lig');
        const ef = n('As_pile');
        const f1 = face(1, { necessario: constante(asLig, 0, L), naoResiste: asLig === null ? [[0, L]] : [], colocado: constante(ef, 0, L) });
        const vd = n('Vd_pil');
        const vr = n('VRd_lig');
        const cf = face(1, { necessario: constante(vd === null ? null : Math.abs(vd), 0, L), colocado: constante(vr, 0, L) });
        por({
          id: `PIL${i + 1}.LIG`, tipo: 'ligacao', nome: `Ligação do pilarete ${i + 1}`, card: 'murocima.pilarete', trecho,
          de: [x, yPil, mc.z0], ate: [x, yPil, mc.z0 - L], lado: [0, 1, 0],
          flexao: diagrama('cm²', [f1], [
            ...(asLig !== null ? [{ s: 0, valor: asLig, qual: 'nec' as const, face: 1 as const, nome: 'As_lig', fator: 1 }] : []),
            ...(ef !== null ? [{ s: 0, valor: ef, qual: 'col' as const, face: 1 as const, nome: 'As_pile', fator: 1 }] : []),
          ], true),
          cortante: vd === null ? null : diagrama('kN', [cf], [{ s: 0, valor: Math.abs(vd), qual: 'nec', face: 1, nome: 'Vd_pil', fator: 1 }, ...(vr !== null ? [{ s: L, valor: vr, qual: 'col' as const, face: 1 as const, nome: 'VRd_lig', fator: 1 }] : [])], true),
          momento: { msd: 'Md_pil', mrd: 'MRd_lig', fator: 1, unidade: 'kN·m' }, aps: ['ap_lig'],
        });
      }
    });
    // cintas do muro de cima (seção 9 da aba): biapoiadas entre pilaretes, cada uma com DUAS barras no mesmo eixo — a
    // flexão lateral (vento) deitada, tracionando a face de fora, e a de gravidade em pé, tracionando embaixo. Só os
    // picos são da planilha (As do vão, cortante do apoio): a parábola e o V entre eles são ilustrativos.
    for (const c of mc.cintas ?? []) {
      const k = c.qual === 'topo' ? 'T' : 'M';
      if (t(`on_c${k}`) !== 'Sim') continue;
      const rotulo = c.qual === 'topo' ? 'Cinta do topo do muro de cima' : 'Cinta de meia altura do muro de cima';
      for (const tr of trechos) {
        const ps = pils.filter((x) => x >= tr.x0 - 1 && x <= tr.x1 + 1);
        vaos(ps).forEach(([xa, xb], j) => {
          const L = xb - xa;
          if (!(L > 0)) return;
          const vao = `vão ${j + 1}${trechos.length > 1 ? ` · T${tr.numero}` : ''}`;
          const uma = (dir: 'L' | 'G', lado: Vec3) => {
            const md = n(dir === 'L' ? `Mdl_c${k}` : `Mdg_c${k}`);
            // sem vento a lateral é zero: não se desenha a barra vazia
            if (md === null || md === 0) return;
            const asN = n(dir === 'L' ? `Aslc_c${k}` : `Asgc_c${k}`);
            const ef = n(dir === 'L' ? 'Asl_cmc' : 'Asg_cmc');
            const f1 = face(1, { necessario: asN === null ? [] : forma(20, L, asN, parabola), naoResiste: asN === null ? [[0, L]] : [], colocado: constante(ef, 0, L), minimo: n('Asm_cmc') });
            const vd = n(dir === 'L' ? `Vdl_c${k}` : `Vdg_c${k}`);
            const vr = n(dir === 'L' ? 'VR1l_cmc' : 'VR1g_cmc');
            const cf = face(1, { necessario: vd === null ? [] : forma(20, L, Math.abs(vd), (xi) => Math.abs(1 - 2 * xi)), colocado: constante(vr, 0, L) });
            por({
              id: `T${tr.numero}.V${j + 1}.CM${k}.${dir}`, tipo: 'cintaMc', nome: `${rotulo} · ${vao} · ${dir === 'L' ? 'lateral' : 'gravidade'}`,
              card: 'murocima.cintas', trecho: tr.numero, de: [xa, yMeio, c.z], ate: [xb, yMeio, c.z], lado,
              flexao: diagrama('cm²', [f1], [
                ...(asN !== null ? [{ s: L / 2, valor: asN, qual: 'nec' as const, face: 1 as const, nome: dir === 'L' ? `Aslc_c${k}` : `Asgc_c${k}`, fator: 1 }] : []),
                ...(ef !== null ? [{ s: L / 2, valor: ef, qual: 'col' as const, face: 1 as const, nome: dir === 'L' ? 'Asl_cmc' : 'Asg_cmc', fator: 1 }] : []),
              ], true),
              cortante: vd === null ? null : diagrama('kN', [cf], [{ s: 0, valor: Math.abs(vd), qual: 'nec', face: 1, nome: dir === 'L' ? `Vdl_c${k}` : `Vdg_c${k}`, fator: 1 }, ...(vr !== null ? [{ s: L, valor: vr, qual: 'col' as const, face: 1 as const, nome: dir === 'L' ? 'VR1l_cmc' : 'VR1g_cmc', fator: 1 }] : [])], true),
              momento: { msd: dir === 'L' ? `Mdl_c${k}` : `Mdg_c${k}`, mrd: dir === 'L' ? 'MRdl_cmc' : 'MRdg_cmc', fator: 1, unidade: 'kN·m' },
              aps: [dir === 'L' ? `apl_c${k}` : `apg_c${k}`, `ap_c${k}`],
            });
          };
          uma('L', [0, -1, 0]);
          uma('G', [0, 0, -1]);
        });
      }
    }
    // painéis: A em baixo; B em cima só com a cinta a meia altura (a planilha publica B só então)
    const temB = n('Mpa_pB') !== null && n('MRp_pB') !== null;
    const meio = temB ? (mc.cintas?.find((c) => c.qual === 'meia')?.z ?? cintaDoMeio(modelo, mc.z0, mc.z1)) : null;
    const zA = meio ?? mc.z1;
    for (const tr of trechos) {
      const ps = pils.filter((x) => x >= tr.x0 - 1 && x <= tr.x1 + 1);
      const est2 = estacaoDoTrecho(tr.x0, tr.x1, ps);
      if (!est2.vao) continue;
      const [xa, xb] = est2.vao;
      naoArmado(r, por, {
        id: `T${tr.numero}.MCA`, trecho: tr.numero, card: 'murocima.muro', rotulo: `Painel A do muro de cima · T${tr.numero}`,
        x0: xa, x1: xb, z0: mc.z0, z1: zA, y: yMeio, par: ['Mpa_pA', 'MRp_pA', 'ap_ppA'], nor: ['Mno_pA', 'MRn_pA', 'ap_npA'], fator: 1, tipo: 'painelMc',
      });
      if (temB && meio !== null) {
        naoArmado(r, por, {
          id: `T${tr.numero}.MCB`, trecho: tr.numero, card: 'murocima.muro', rotulo: `Painel B do muro de cima · T${tr.numero}`,
          x0: xa, x1: xb, z0: meio, z1: mc.z1, y: yMeio, par: ['Mpa_pB', 'MRp_pB', 'ap_ppB'], nor: ['Mno_pB', 'MRn_pB', 'ap_npB'], fator: 1, tipo: 'painelMc',
        });
      }
    }
    void hMc;
  }

  void cel;
  return out;
}

/** A cinta de meia altura do muro de cima (o z do meio dela), pelas peças; sem ela, o meio. */
function cintaDoMeio(m: Modelo, z0: number, z1: number): number {
  let melhor: number | null = null;
  for (const p of m.pecas) {
    if (p.tipo !== 'CINTA_MC') continue;
    const c = caixaDe(m, p);
    if (!c) continue;
    const z = (c.min[2] + c.max[2]) / 2;
    if (z < z1 - 300 && (melhor === null || Math.abs(z - (z0 + z1) / 2) < Math.abs(melhor - (z0 + z1) / 2))) melhor = z;
  }
  return melhor ?? (z0 + z1) / 2;
}

/**
 * Painel não armado (sem barra; vale a tração na flexão da alvenaria): uma barra vertical (momento normal às juntas
 * de assentamento) e uma horizontal (paralelo às juntas), as duas esquemáticas — a planilha dá o pico do caso de placa
 * (Anexo E), não a curva. Sem aço, o par é o momento: Md por dentro, MRd = ftd·W envolvendo.
 */
function naoArmado(
  r: Resultado,
  por: (b: Montagem) => void,
  o: {
    id: string; trecho: number; card: string; rotulo: string; x0: number; x1: number; z0: number; z1: number; y: number;
    par: [string, string, string]; nor: [string, string, string]; fator: number; tipo?: TipoDeBarra;
  },
): void {
  const { n } = leitor(r);
  const tipo = o.tipo ?? 'naoArmado';
  const um = (dir: 'h' | 'v', [msdN, mrdN, apN]: [string, string, string]) => {
    const msd0 = n(msdN);
    if (msd0 === null) return;
    const msd = Math.max(0, msd0);
    const mrd = n(mrdN);
    const L = dir === 'h' ? o.x1 - o.x0 : o.z1 - o.z0;
    if (!(L > 0)) return;
    const m0 = msd * o.fator;
    const mr = mrd === null ? null : mrd * o.fator;
    const de: Vec3 = dir === 'h' ? [o.x0, o.y, (o.z0 + o.z1) / 2] : [(o.x0 + o.x1) / 2, o.y, o.z0];
    const ate: Vec3 = dir === 'h' ? [o.x1, o.y, (o.z0 + o.z1) / 2] : [(o.x0 + o.x1) / 2, o.y, o.z1];
    const f1 = face(1, { necessario: forma(16, L, m0, parabola), naoResiste: mr === null && m0 > 0 ? [[0, L]] : [], colocado: constante(mr, 0, L) });
    const picos: Pico[] = [{ s: L / 2, valor: m0, qual: 'nec', face: 1, nome: msdN, fator: o.fator }];
    if (mr !== null) picos.push({ s: L / 2, valor: mr, qual: 'col', face: 1, nome: mrdN, fator: o.fator });
    por({
      id: `${o.id}.${dir === 'h' ? 'H' : 'V'}`, tipo, nome: `${o.rotulo} · ${dir === 'h' ? 'horizontal' : 'vertical'}`, card: o.card, trecho: o.trecho,
      de, ate, lado: [0, -1, 0],
      flexao: diagrama('kN·m/m', [f1], picos, true), cortante: null,
      momento: { msd: msdN, mrd: mrdN, fator: o.fator, unidade: 'kN·m/m' }, aps: [apN],
    });
  };
  um('v', o.nor);
  um('h', o.par);
}
