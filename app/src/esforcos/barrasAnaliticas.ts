/*
  AS BARRAS ANALÍTICAS — o muro reduzido a eixos, cada eixo com o MSd e o MRd que a planilha publicou (etapa 1b do
  PLANO_OBRA; os nomes estão na tabela "PUBLICADO (15/11)").

  ⚠️ NADA DE CONTA AQUI. A planilha é a única que calcula (CLAUDE.md, "a conta do app É a planilha"); este arquivo
  só: lê célula por nome, troca unidade (kN·cm → kN·m), interpola entre nós publicados e decide de que lado o
  desenho vai. Onde a planilha só publica o pico (os painéis vêm de tabela de placa, não de barra), a forma entre os
  picos é ilustrativa — a barra sai `esquematico` e a tela desenha tracejado. A única forma "fabricada" aqui é a do
  dente: o trapézio do passivo (p1, p2 publicados) integrado ao longo da altura e escalado para bater com o Md da
  raiz — é a mesma carga que a planilha usa, só descrita ponto a ponto.

  De onde vem a POSIÇÃO de cada barra: do modelo (os contrafortes, as fiadas de canaleta, os pilaretes, a sapata) —
  o diagrama fica em cima da peça que o 3D desenha.

  Sinais (convenção brasileira: o diagrama vai do lado TRACIONADO):
    · balanço, contraforte e pilarete: o solo empurra o muro para fora (−Y) → tração do lado do solo, lado = +Y;
    · painel entre contrafortes, vertical: engaste da base tracionando o lado do solo (+), vão tracionando a face
      de fora (−);
    · canaleta e cinta (horizontais entre contrafortes): vão tracionando a face de fora (lado = −Y), apoio
      engastado tracionando o lado do solo (−);
    · ponta da sapata: o solo empurra para cima → tração embaixo (lado = −Z); talão: o aterro em cima → tração em
      cima (lado = +Z) quando o Md é positivo; negativo, tração embaixo, resistida pela MESMA barra de baixo da ponta;
    · dente: o solo da frente empurra o dente para trás → tração na face voltada para a ponta (−Y).
*/
import dados from '@/motor/planilha.gerada.json';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo, Peca, Vec3 } from '@/modelo/tipos';
import { caixaGlobal } from '@/modulacao/perfis';
import { GRUPO_DO_TIPO, type BarraAnalitica, type Estacao, type Pico, type TipoDeBarra, type UnidadeDoMomento } from './tipos';

const NOMES = (dados as unknown as { nomes: Record<string, string> }).nomes;

/** kN·cm → kN·m. */
const CM = 0.01;
const M = 1000; // m → mm

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

interface No { celula: string; v: number | null }
const coluna = (r: Resultado, nome: string): No[] => celulasDe(nome).map((celula) => ({ celula, v: numero(r.cel(celula)) }));

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

// ───────────────────────────── montagem ─────────────────────────────

const pos = (x: number | null): number | null => (x === null ? null : Math.max(0, x));

interface Montagem {
  id: string;
  tipo: TipoDeBarra;
  nome: string;
  card: string;
  trecho: number;
  de: Vec3;
  ate: Vec3;
  lado: Vec3;
  estacoes: Estacao[];
  unidade: UnidadeDoMomento;
  picos: Pico[];
  aps: string[];
  esquematico: boolean;
}

function fechar(r: Resultado, b: Montagem): BarraAnalitica {
  const { n } = leitor(r);
  const aps = b.aps.map((a) => [a, n(a)] as const).filter((x): x is readonly [string, number] => x[1] !== null);
  const ap = aps.length ? Math.max(...aps.map((x) => x[1])) : null;
  return {
    id: b.id,
    tipo: b.tipo,
    grupo: GRUPO_DO_TIPO[b.tipo],
    nome: b.nome,
    card: b.card,
    trecho: b.trecho,
    de: b.de,
    ate: b.ate,
    lado: b.lado,
    estacoes: b.estacoes,
    unidade: b.unidade,
    picos: b.picos,
    aproveitamento: ap,
    nomesDoAproveitamento: aps.map((x) => x[0]),
    passa: ap === null ? null : ap <= 1,
    semMRd: !b.picos.some((p) => p.qual === 'mrd') && b.estacoes.some((e) => Math.abs(e.msd) > 1e-12),
    esquematico: b.esquematico,
  };
}

/** Uma forma de 0 a 1 amostrada em `n` estações (para as barras esquemáticas). */
const amostrar = (n: number, f: (xi: number) => number) => Array.from({ length: n + 1 }, (_, i) => ({ xi: i / n, v: f(i / n) }));

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

function faixaEmY(m: Modelo, filtro: (p: Peca) => boolean): [number, number] | null {
  let a = Infinity;
  let b = -Infinity;
  for (const p of m.pecas) {
    if (!filtro(p)) continue;
    const c = caixaDe(m, p);
    if (!c) continue;
    a = Math.min(a, c.min[1]);
    b = Math.max(b, c.max[1]);
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

// ───────────────────────────── as peças ─────────────────────────────

/**
 * MSd ao longo da altura de uma haste engastada na sapata (balanço, contraforte): o perfil do solo de 41 nós
 * (`perfil`, y = `perf_y`) até a altura de solo e, acima dela, a tabela do vento de 11 nós (`vento`, y = `vt_y`), que
 * é a única carga lá em cima. A base (último nó do perfil) recebe `somaNaBase` (o M2d do balanço) para fechar com o
 * MSd da aba.
 */
function hasteEngastada(r: Resultado, perfil: string, vento: string, somaNaBase = 0): { estacoes: { s: number; msd: number; celula: string }[] } {
  const ys = coluna(r, 'perf_y');
  const ms = coluna(r, perfil);
  const out: { s: number; msd: number; celula: string }[] = [];
  let topoDoSolo = -Infinity;
  ys.forEach((y, i) => {
    const mm = ms[i];
    if (y.v === null || !mm || mm.v === null) return;
    const base = i === ys.length - 1;
    out.push({ s: y.v * M, msd: mm.v + (base ? somaNaBase : 0), celula: mm.celula });
    topoDoSolo = Math.max(topoDoSolo, y.v);
  });
  const yv = coluna(r, 'vt_y');
  const mv = coluna(r, vento);
  yv.forEach((y, i) => {
    const mm = mv[i];
    if (y.v === null || !mm || mm.v === null) return;
    // abaixo do solo o perfil já traz o vento (a mesma reta): fica o nó do perfil, que é mais fino
    if (y.v <= topoDoSolo + 1e-9) return;
    out.push({ s: y.v * M, msd: mm.v, celula: mm.celula });
  });
  out.sort((a, b) => a.s - b.s);
  return { estacoes: out };
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

  // ── balanço: a faixa de 1 m no meio de cada trecho ──
  if (!contrafortes) {
    const mrd = n('MRd_bal');
    const M2d = n('M2d_us') ?? 0;
    for (const tr of trechos) {
      const x = (tr.x0 + tr.x1) / 2;
      const { estacoes } = hasteEngastada(r, 'perf_Md', 'vt_Md', M2d);
      if (!estacoes.length) continue;
      const base = estacoes[0]!;
      const picos: Pico[] = [];
      if (n('Md_') !== null) picos.push({ s: base.s, valor: base.msd, qual: 'msd', nome: 'Md_', fator: 1 });
      if (mrd !== null) picos.push({ s: H, valor: mrd, qual: 'mrd', nome: 'MRd_bal', fator: 1 });
      por({
        id: `T${tr.numero}.BAL`, tipo: 'balanco', nome: `Muro em balanço · T${tr.numero}`, card: 'balanco.flexao', trecho: tr.numero,
        de: [x, yMeio, 0], ate: [x, yMeio, H], lado: [0, 1, 0],
        estacoes: estacoes.map((e) => ({ s: e.s, msd: e.msd, mrd, mrdOposto: null })),
        unidade: 'kN·m/m', picos, aps: ['ap_bal'], esquematico: false,
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
        ? { perfil: 'perf_Mdc', vento: 'vt_Mdc', md: 'Md_cf', mrd: 'MRd_cf', ap: ['ap_cf'] }
        : { perfil: 'perf_Mdo', vento: 'vt_Mdo', md: 'Md_cfo', mrd: 'MRd_cfo', ap: ['ap_cfo'] };
    };
    const faixaCf = faixaEmY(modelo, (p) => p.grupo === 'contraforte');
    const yCf = faixaCf ? (faixaCf[0] + faixaCf[1]) / 2 : yMeio;
    cfs.forEach((c, i) => {
      const k = conjuntoDe(c.ponta);
      const { estacoes } = hasteEngastada(r, k.perfil, k.vento);
      if (!estacoes.length) return;
      const mrd = n(k.mrd);
      const base = estacoes[0]!;
      const picos: Pico[] = [];
      if (n(k.md) !== null) picos.push({ s: base.s, valor: base.msd, qual: 'msd', nome: k.md, fator: 1 });
      if (mrd !== null) picos.push({ s: H, valor: mrd, qual: 'mrd', nome: k.mrd, fator: 1 });
      por({
        id: `CF${i + 1}`, tipo: 'contraforte', nome: `Contraforte ${i + 1}${c.ponta ? ' · extremidade' : ''}`, card: 'contraforte.flexao', trecho: c.trecho,
        de: [c.x, yCf, 0], ate: [c.x, yCf, H], lado: [0, 1, 0],
        estacoes: estacoes.map((e) => ({ s: e.s, msd: e.msd, mrd, mrdOposto: null })),
        unidade: 'kN·m', picos, aps: k.ap, esquematico: false,
      });
    });

    const mrdPvs = n('MRd_pvs');
    const mrdPve = n('MRd_pve');
    const mBase = n('Mdyei_p');
    const mVao = n('M_pve');
    const mrdPh = n('MRd_ph');
    const mdx = n('Mdx_p');
    const mdxe = n('Mdxe_p');
    const apoioArmado = t('pos_ph').startsWith('Cent') || n('nb_ph') === 2;
    const msdCin = n('Msd_cin');
    const mrdCin = n('MRd_cin');

    for (const tr of trechos) {
      const apoios = apoiosDo(tr.numero);
      const canaletas = fiadasDeCanaleta(modelo, tr.numero);
      const zCinta = canaletas.length ? canaletas[canaletas.length - 1]! : null;
      vaos(apoios).forEach(([xa, xb], j) => {
        const vao = `vão ${j + 1}${trechos.length > 1 ? ` · T${tr.numero}` : ''}`;
        const xm = (xa + xb) / 2;
        // faixa vertical do painel: engaste na base (lado do solo) e vão (face de fora), zero no topo livre
        if (mBase !== null || mVao !== null) {
          const b0 = (mBase ?? 0) * CM;
          const v0 = (mVao ?? 0) * CM;
          // a forma é só ilustrativa (tabela de placa): passa pelo engaste, cruza a 1/4 da altura, pico a 5/8
          const forma = amostrar(24, (xi) => (xi <= 0.25 ? b0 * Math.cos((Math.PI / 2) * (xi / 0.25)) : -v0 * Math.sin((Math.PI * (xi - 0.25)) / 0.75)));
          const picos: Pico[] = [];
          if (mBase !== null) picos.push({ s: 0, valor: b0, qual: 'msd', nome: 'Mdyei_p', fator: CM });
          if (mVao !== null) picos.push({ s: 0.625 * H, valor: -v0, qual: 'msd', nome: 'M_pve', fator: CM });
          if (mrdPvs !== null) picos.push({ s: H, valor: mrdPvs * CM, qual: 'mrd', nome: 'MRd_pvs', fator: CM });
          if (mrdPve !== null) picos.push({ s: H, valor: -mrdPve * CM, qual: 'mrd', nome: 'MRd_pve', fator: CM });
          por({
            id: `T${tr.numero}.V${j + 1}.PV`, tipo: 'painelVertical', nome: `Painel vertical · ${vao}`, card: 'painelCf.flexaoVertical', trecho: tr.numero,
            de: [xm, yMeio, 0], ate: [xm, yMeio, H], lado: [0, 1, 0],
            estacoes: forma.map((f) => ({ s: f.xi * H, msd: f.v, mrd: mrdPvs === null ? null : mrdPvs * CM, mrdOposto: mrdPve === null ? null : mrdPve * CM })),
            unidade: 'kN·m/m', picos, aps: ['ap_pvs', 'ap_pve'], esquematico: true,
          });
        }
        // as canaletas da conta (todas com o mesmo momento publicado) e a cinta do topo
        const L = xb - xa;
        canaletas.forEach((z) => {
          const cinta = z === zCinta && msdCin !== null;
          if (cinta) {
            const m0 = msdCin * CM;
            const mr = mrdCin === null ? null : mrdCin * CM;
            const picos: Pico[] = [{ s: L / 2, valor: m0, qual: 'msd', nome: 'Msd_cin', fator: CM }];
            if (mr !== null) picos.push({ s: L, valor: mr, qual: 'mrd', nome: 'MRd_cin', fator: CM });
            por({
              id: `T${tr.numero}.V${j + 1}.CIN`, tipo: 'cinta', nome: `Cinta do topo · ${vao}`, card: 'painelCf.flexaoHorizontal', trecho: tr.numero,
              de: [xa, yMeio, z], ate: [xb, yMeio, z], lado: [0, -1, 0],
              estacoes: amostrar(20, (xi) => m0 * 4 * xi * (1 - xi)).map((f) => ({ s: f.xi * L, msd: f.v, mrd: mr, mrdOposto: null })),
              unidade: 'kN·m', picos, aps: ['ap_cin'], esquematico: true,
            });
            return;
          }
          if (mdx === null) return;
          const vaoM = mdx * CM;
          const apoioM = mdxe !== null && mdxe > 0 ? mdxe * CM : 0;
          const mr = mrdPh === null ? null : mrdPh * CM;
          const picos: Pico[] = [{ s: L / 2, valor: vaoM, qual: 'msd', nome: 'Mdx_p', fator: CM }];
          if (apoioM > 0) picos.push({ s: 0, valor: -apoioM, qual: 'msd', nome: 'Mdxe_p', fator: CM });
          if (mr !== null) picos.push({ s: L, valor: mr, qual: 'mrd', nome: 'MRd_ph', fator: CM });
          por({
            id: `T${tr.numero}.V${j + 1}.C${Math.floor(z / 200) + 1}`, tipo: 'canaleta', nome: `Canaleta ${ordinal(z)} · ${vao}`, card: 'painelCf.flexaoHorizontal', trecho: tr.numero,
            de: [xa, yMeio, z], ate: [xb, yMeio, z], lado: [0, -1, 0],
            // o vão segue a parábola da placa até o apoio engastado (ilustrativa entre os picos)
            estacoes: amostrar(20, (xi) => -apoioM + (vaoM + apoioM) * 4 * xi * (1 - xi)).map((f) => ({
              s: f.xi * L, msd: f.v, mrd: mr, mrdOposto: apoioM > 0 && apoioArmado ? mr : null,
            })),
            unidade: 'kN·m/m', picos, aps: ['ap_ph'], esquematico: true,
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
  for (const tr of trechos) {
    const { x } = estacaoDoTrecho(tr.x0, tr.x1, contrafortes ? apoiosDo(tr.numero) : []);
    const T = ` · T${tr.numero}`;
    if (toe !== null && toe > 0) {
      const mr = n('MRd_toe');
      const mrSup = n('MRd_heel');
      const es = coluna(r, 'T_e');
      const ms = coluna(r, 'T_Md');
      const est: { s: number; msd: number; celula: string }[] = [];
      es.forEach((e, i) => {
        const mm = ms[i];
        if (e.v !== null && mm && mm.v !== null) est.push({ s: e.v * M, msd: mm.v, celula: mm.celula });
      });
      if (est.length) {
        // a ponta livre não tem linha na planilha: M = 0 lá (balanço sem carga além da borda)
        est.push({ s: toe * M, msd: 0, celula: '' });
        est.sort((a, b) => a.s - b.s);
        const picos: Pico[] = [];
        const face = est[0]!;
        picos.push({ s: face.s, valor: face.msd, qual: 'msd', nome: 'T_Md', celula: face.celula, fator: 1 });
        if (mr !== null) picos.push({ s: toe * M, valor: mr, qual: 'mrd', nome: 'MRd_toe', fator: 1 });
        por({
          id: `T${tr.numero}.PONTA`, tipo: 'ponta', nome: `Ponta da sapata${T}`, card: 'sapata.flexao.ponta', trecho: tr.numero,
          de: [x, 0, zSap], ate: [x, -toe * M, zSap], lado: [0, 0, -1],
          estacoes: est.map((e) => ({ s: e.s, msd: e.msd, mrd: mr, mrdOposto: mrSup !== null && mrSup > 0 ? mrSup : null })),
          unidade: 'kN·m/m', picos, aps: ['ap_toe'], esquematico: false,
        });
      }
    }
    if (heel !== null && heel > 0) {
      const mrSup = n('MRd_heel');
      const mrInf = n('MRd_toe');
      const es = coluna(r, 'H_e');
      const ms = coluna(r, 'H_Md');
      const est: { s: number; msd: number; celula: string }[] = [];
      es.forEach((e, i) => {
        const mm = ms[i];
        if (e.v !== null && mm && mm.v !== null) est.push({ s: e.v * M, msd: mm.v, celula: mm.celula });
      });
      if (est.length) {
        est.push({ s: heel * M, msd: 0, celula: '' });
        est.sort((a, b) => a.s - b.s);
        const face = est[0]!;
        const picos: Pico[] = [{ s: face.s, valor: face.msd, qual: 'msd', nome: 'H_Md', celula: face.celula, fator: 1 }];
        if (mrSup !== null && mrSup > 0) picos.push({ s: heel * M, valor: mrSup, qual: 'mrd', nome: 'MRd_heel', fator: 1 });
        por({
          id: `T${tr.numero}.TALAO`, tipo: 'talao', nome: `Talão da sapata${T}`, card: 'sapata.flexao.talao', trecho: tr.numero,
          de: [x, tb, zSap], ate: [x, tb + heel * M, zSap], lado: [0, 0, 1],
          estacoes: est.map((e) => ({ s: e.s, msd: e.msd, mrd: mrSup !== null && mrSup > 0 ? mrSup : null, mrdOposto: mrInf })),
          unidade: 'kN·m/m', picos, aps: ['ap_heel'], esquematico: false,
        });
      }
    }
    // dente: da face de baixo da sapata para baixo, no eixo pedido (x_den a partir do centro, + para a ponta)
    if (t('tem_den') === 'Sim') {
      const hDen = n('h_den');
      const p1 = n('p1_den');
      const p2 = n('p2_den');
      const mk = n('Mk_den');
      const md = n('Md_den');
      const B = n('B_sap');
      if (hDen !== null && hDen > 0 && p1 !== null && p2 !== null && mk !== null && mk > 0 && md !== null && hSap !== null && toe !== null && B !== null) {
        const yCentro = -toe * M + (B * M) / 2;
        const y = yCentro - (n('x_den') ?? 0) * M;
        const h = hDen * M;
        // o momento numa seção a ζ da raiz é o do trapézio abaixo dela (a mesma carga de p1_den e p2_den),
        // escalado pelo Md/Mk da raiz — a forma é a do passivo, o valor na raiz é o da planilha
        const Mk = (zeta: number) => {
          const L = hDen - zeta;
          const pz = p1 + ((p2 - p1) * zeta) / hDen;
          return (pz * L * L) / 2 + ((p2 - p1) / hDen) * (L * L * L) / 3;
        };
        const mr = n('MRd_den');
        const picos: Pico[] = [{ s: 0, valor: md, qual: 'msd', nome: 'Md_den', fator: 1 }];
        if (mr !== null) picos.push({ s: h, valor: mr, qual: 'mrd', nome: 'MRd_den', fator: 1 });
        por({
          id: `T${tr.numero}.DENTE`, tipo: 'dente', nome: `Dente${T}`, card: 'fundacao.dente', trecho: tr.numero,
          de: [x, y, -hSap * M], ate: [x, y, -hSap * M - h], lado: [0, -1, 0],
          estacoes: amostrar(12, (xi) => (xi === 0 ? md : (md * Mk(xi * hDen)) / mk)).map((f) => ({ s: f.xi * h, msd: f.v, mrd: mr, mrdOposto: null })),
          unidade: 'kN·m/m', picos, aps: ['ap_den'], esquematico: false,
        });
      }
    }
  }

  // ── muro de cima: pilaretes, a ligação deles no arrimo e os painéis A/B ──
  const mc = modelo.dims.muroDeCima;
  if (mc && t('mc_on') === 'Sim') {
    const hMc = mc.z1 - mc.z0;
    const pils = [...mc.pilaretes].sort((a, b) => a - b);
    const faixaPil = faixaEmY(modelo, (p) => p.tipo === 'PILARETE');
    const yPil = faixaPil ? (faixaPil[0] + faixaPil[1]) / 2 : yMeio;
    const mrPil = n('MRd_pil');
    const mrLig = n('MRd_lig');
    const mdPil = n('Md_pil');
    const ys = coluna(r, 'pt_y');
    const ms = coluna(r, 'pt_Md');
    const est: { s: number; msd: number; celula: string }[] = [];
    ys.forEach((y, i) => {
      const mm = ms[i];
      if (y.v !== null && mm && mm.v !== null) est.push({ s: y.v * M, msd: mm.v, celula: mm.celula });
    });
    est.sort((a, b) => a.s - b.s);
    const l0t = n('l0t_pil');
    pils.forEach((x, i) => {
      const trecho = trechos.find((tr) => x >= tr.x0 - 1 && x <= tr.x1 + 1)?.numero ?? 1;
      if (est.length) {
        const picos: Pico[] = [];
        if (mdPil !== null) picos.push({ s: est[0]!.s, valor: est[0]!.msd, qual: 'msd', nome: 'Md_pil', fator: 1 });
        if (mrPil !== null) picos.push({ s: hMc, valor: mrPil, qual: 'mrd', nome: 'MRd_pil', fator: 1 });
        por({
          id: `PIL${i + 1}`, tipo: 'pilarete', nome: `Pilarete ${i + 1}`, card: 'murocima.pilarete', trecho,
          de: [x, yPil, mc.z0], ate: [x, yPil, mc.z1], lado: [0, 1, 0],
          estacoes: est.map((e) => ({ s: e.s, msd: e.msd, mrd: mrPil, mrdOposto: null })),
          unidade: 'kN·m', picos, aps: ['ap_pil'], esquematico: false,
        });
      }
      // a ligação: o momento da base do pilarete entrando no arrimo, no comprimento do traspasse
      if (mdPil !== null && l0t !== null && l0t > 0) {
        const L = Math.min(l0t * 10, mc.z0);
        const picos: Pico[] = [{ s: 0, valor: mdPil, qual: 'msd', nome: 'Md_pil', fator: 1 }];
        if (mrLig !== null) picos.push({ s: L, valor: mrLig, qual: 'mrd', nome: 'MRd_lig', fator: 1 });
        por({
          id: `PIL${i + 1}.LIG`, tipo: 'ligacao', nome: `Ligação do pilarete ${i + 1}`, card: 'murocima.pilarete', trecho,
          de: [x, yPil, mc.z0], ate: [x, yPil, mc.z0 - L], lado: [0, 1, 0],
          estacoes: [0, 1].map((xi) => ({ s: xi * L, msd: mdPil, mrd: mrLig, mrdOposto: null })),
          unidade: 'kN·m', picos, aps: ['ap_lig'], esquematico: true,
        });
      }
    });
    // cintas do muro de cima (15/11, seção 9 da aba): biapoiadas entre pilaretes, cada uma com DUAS barras no mesmo
    // eixo — a flexão lateral (vento) deitada no plano horizontal, tracionando a face de fora (o vento sopra do
    // aterro, −Y; os dois lados têm a mesma barra, o MRd vale dos dois), e a de gravidade no plano vertical,
    // tracionando embaixo. A curva é a parábola da viga biapoiada com carga uniforme — o próprio modelo da conta, não
    // forma ilustrativa; o pico é o Md da planilha.
    const mrdL = n('MRdl_cmc');
    const mrdG = n('MRdg_cmc');
    for (const c of mc.cintas ?? []) {
      const k = c.qual === 'topo' ? 'T' : 'M';
      if (t(`on_c${k}`) !== 'Sim') continue;
      const mdl = n(`Mdl_c${k}`);
      const mdg = n(`Mdg_c${k}`);
      const rotulo = c.qual === 'topo' ? 'Cinta do topo do muro de cima' : 'Cinta de meia altura do muro de cima';
      for (const tr of trechos) {
        const ps = pils.filter((x) => x >= tr.x0 - 1 && x <= tr.x1 + 1);
        vaos(ps).forEach(([xa, xb], j) => {
          const L = xb - xa;
          if (!(L > 0)) return;
          const vao = `vão ${j + 1}${trechos.length > 1 ? ` · T${tr.numero}` : ''}`;
          const uma = (dir: 'L' | 'G', md: number | null, mr: number | null, lado: Vec3, oposto: boolean) => {
            // sem vento a lateral é zero: não se desenha a barra vazia
            if (md === null || md === 0) return;
            const picos: Pico[] = [{ s: L / 2, valor: md, qual: 'msd', nome: dir === 'L' ? `Mdl_c${k}` : `Mdg_c${k}`, fator: 1 }];
            if (mr !== null) picos.push({ s: L, valor: mr, qual: 'mrd', nome: dir === 'L' ? 'MRdl_cmc' : 'MRdg_cmc', fator: 1 });
            por({
              id: `T${tr.numero}.V${j + 1}.CM${k}.${dir}`, tipo: 'cintaMc', nome: `${rotulo} · ${vao} · ${dir === 'L' ? 'lateral' : 'gravidade'}`,
              card: 'murocima.cintas', trecho: tr.numero,
              de: [xa, yMeio, c.z], ate: [xb, yMeio, c.z], lado,
              estacoes: amostrar(20, (xi) => md * 4 * xi * (1 - xi)).map((f) => ({ s: f.xi * L, msd: f.v, mrd: mr, mrdOposto: oposto ? mr : null })),
              unidade: 'kN·m', picos, aps: [dir === 'L' ? `apl_c${k}` : `apg_c${k}`, `ap_c${k}`], esquematico: false,
            });
          };
          uma('L', mdl, mrdL, [0, -1, 0], true);
          uma('G', mdg, mrdG, [0, 0, -1], false);
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
      // o muro de cima vai centrado no eixo do arrimo (modulacao/muroDeCima.ts)
      const ya = yMeio;
      naoArmado(r, por, {
        id: `T${tr.numero}.MCA`, trecho: tr.numero, card: 'murocima.muro', rotulo: `Painel A do muro de cima · T${tr.numero}`,
        x0: xa, x1: xb, z0: mc.z0, z1: zA, y: ya, par: ['Mpa_pA', 'MRp_pA', 'ap_ppA'], nor: ['Mno_pA', 'MRn_pA', 'ap_npA'], fator: 1, tipo: 'painelMc',
      });
      if (temB && meio !== null) {
        naoArmado(r, por, {
          id: `T${tr.numero}.MCB`, trecho: tr.numero, card: 'murocima.muro', rotulo: `Painel B do muro de cima · T${tr.numero}`,
          x0: xa, x1: xb, z0: meio, z1: mc.z1, y: ya, par: ['Mpa_pB', 'MRp_pB', 'ap_ppB'], nor: ['Mno_pB', 'MRn_pB', 'ap_npB'], fator: 1, tipo: 'painelMc',
        });
      }
    }
  }

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
 * Painel não armado (sem barra; vale a tração na flexão da alvenaria): uma barra vertical (momento normal às
 * juntas de assentamento) e uma horizontal (paralelo às juntas), as duas esquemáticas — a planilha dá o pico do
 * caso de placa (Anexo E), não a curva.
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
    const msd = pos(n(msdN));
    if (msd === null) return;
    const mrd = n(mrdN);
    const L = dir === 'h' ? o.x1 - o.x0 : o.z1 - o.z0;
    if (!(L > 0)) return;
    const m0 = msd * o.fator;
    const mr = mrd === null ? null : mrd * o.fator;
    const de: Vec3 = dir === 'h' ? [o.x0, o.y, (o.z0 + o.z1) / 2] : [(o.x0 + o.x1) / 2, o.y, o.z0];
    const ate: Vec3 = dir === 'h' ? [o.x1, o.y, (o.z0 + o.z1) / 2] : [(o.x0 + o.x1) / 2, o.y, o.z1];
    const picos: Pico[] = [{ s: L / 2, valor: m0, qual: 'msd', nome: msdN, fator: o.fator }];
    if (mr !== null) picos.push({ s: L, valor: mr, qual: 'mrd', nome: mrdN, fator: o.fator });
    por({
      id: `${o.id}.${dir === 'h' ? 'H' : 'V'}`, tipo, nome: `${o.rotulo} · ${dir === 'h' ? 'horizontal' : 'vertical'}`, card: o.card, trecho: o.trecho,
      de, ate, lado: [0, -1, 0],
      estacoes: amostrar(16, (xi) => m0 * 4 * xi * (1 - xi)).map((f) => ({ s: f.xi * L, msd: f.v, mrd: mr, mrdOposto: mr })),
      unidade: 'kN·m/m', picos, aps: [apN], esquematico: true,
    });
  };
  um('v', o.nor);
  um('h', o.par);
}
