/*
  PROVA DA MODULAÇÃO — o muro peça a peça contra as regras, em TODOS os cenários do gabarito do Excel.

  As conferências leem só o Modelo (o que o 3D, o IFC e o quantitativo recebem), nunca os intermediários do
  gerador: se o gerador errar, o teste não erra junto.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo, Peca, TipoPeca, Vec2 } from '@/modelo/tipos';
import { caixaGlobal, gerarModelo, paraGlobal, padroesDoModelo } from './index';
import { areaPoligono, calibrarFuro, distanciaAoFuro, retanguloArredondado } from './perfis';
import { CATALOGO, conferirCatalogo } from './catalogo';
import { conferirEncaixes, ENCAIXES } from './encaixes';
import { vaoAmarra } from './fiadas';
import { vaosDoContraforte } from './modular';

const ALVENARIA = new Set<TipoPeca>(['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);
const CANALETAS = new Set<TipoPeca>(['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA']);
const VERTICAIS = new Set(['VERT_MURO', 'CF_PRINCIPAL', 'CF_CONSTRUTIVA', 'ESPERA']);

const VARIACOES: Record<string, Valor>[] = [
  { L_total: 1.2 },
  { L_total: 3 },
  { L_total: 6 },
  { L_total: 20 },
  { L_total: 6, junta_cada: 6 },
  { L_total: 20, junta_cada: 6 },
  { L_total: 6, cinta_topo: 'Não' },
  { L_total: 6, barbaca_on: 'Não', dreno_on: 'Não' },
  { L_total: 20, junta_cada: 6, cinta_topo: 'Não', barbaca_on: 'Não', dreno_on: 'Não' },
  { L_total: 12, junta_cada: 2.5, traspasse_dir: 60, phi_cinta: 16 },
];

/*
  A planilha publica valores DERIVADOS da geometria (m_mod, l_cf_adot, tenr_adot, n_fiadas, H_muro_des). trocar() muda
  a entrada sem rodar a conta de novo, e o derivado do gabarito ficaria velho (ex.: H = 1,7 com as 8 fiadas do 1,6).
  Então, quando a troca mexe numa entrada de geometria, os derivados que ela não troca viram null: a regra modular do
  app (a mesma da planilha) faz o ajuste, como fazia antes de a planilha publicar esses nomes.
*/
const DERIVADOS: Record<string, string[]> = {
  H_muro: ['n_fiadas', 'H_muro_des'],
  t_bloco: ['m_mod', 'l_cf_adot', 'tenr_adot'],
  L_bloco: ['m_mod', 'l_cf_adot', 'tenr_adot'],
  l_cf: ['l_cf_adot'],
  tenr_: ['tenr_adot'],
};

/** Resultado com alguns nomes trocados (para provar a regra modular em outras famílias). */
function trocar(r: Resultado, trocaPedida: Record<string, Valor>): Resultado {
  const troca: Record<string, Valor> = { ...trocaPedida };
  for (const [entrada, derivados] of Object.entries(DERIVADOS)) {
    if (entrada in trocaPedida) for (const d of derivados) if (!(d in troca)) troca[d] = null;
  }
  return {
    v: (n) => (n in troca ? troca[n] : r.v(n)),
    num: (n) => {
      const x = n in troca ? troca[n] : r.v(n);
      return typeof x === 'number' ? x : null;
    },
    cel: (ref) => r.cel(ref),
    alteracoes: r.alteracoes,
  };
}

// ── conferências sobre o Modelo ──────────────────────────────────────────────

type Caixa = ReturnType<typeof caixaGlobal>;
const caixa = (m: Modelo, p: Peca): Caixa => caixaGlobal(p, m.geometrias[p.geometria]);

function sobreposicoes(m: Modelo): string[] {
  const alv = m.pecas.filter((p) => ALVENARIA.has(p.tipo)).map((p) => ({ p, c: caixa(m, p) }));
  alv.sort((a, b) => a.c.min[0] - b.c.min[0]);
  const out: string[] = [];
  const tol = 0.5;
  for (let i = 0; i < alv.length; i++) {
    for (let j = i + 1; j < alv.length; j++) {
      const a = alv[i].c;
      const b = alv[j].c;
      if (b.min[0] >= a.max[0] - tol) break;
      if (a.min[1] < b.max[1] - tol && b.min[1] < a.max[1] - tol && a.min[2] < b.max[2] - tol && b.min[2] < a.max[2] - tol) {
        out.push(`${alv[i].p.id} × ${alv[j].p.id}`);
      }
    }
  }
  return out;
}

/**
 * Juntas a prumo: mesma junta vertical em duas fiadas seguidas. Fica de fora só a face do contraforte: a passante da
 * fiada I deixa junta nas duas faces por construção e, na 19x39, a fiada P repete — o Jose: "de 19 é até de boa".
 * Na haste, fora a ponta e fora a fiada de canaleta: o Jose monta a haste dela com a canaleta inteira na ponta e a
 * cortada junto ao muro, e aceita a junta repetida ali (gabarito 19x39, contraforte de 79).
 */
function juntasAPrumo(m: Modelo): string[] {
  const t = m.familia.t;
  const out: string[] = [];
  const porTrechoFiada = new Map<string, Caixa[]>();
  const porCfFiada = new Map<string, Caixa[]>();
  const deCanaleta = new Set(m.pecas.filter((p) => p.grupo === 'muro' && CANALETAS.has(p.tipo)).map((p) => p.fiada));
  for (const p of m.pecas) {
    if (!ALVENARIA.has(p.tipo) || p.fiada === undefined) continue;
    const c = caixa(m, p);
    if (c.min[1] <= 0.5 && c.max[1] >= t - 0.5) {
      const k = `${p.trecho}|${p.fiada}`;
      (porTrechoFiada.get(k) ?? porTrechoFiada.set(k, []).get(k)!).push(c);
    }
    if (p.grupo === 'contraforte') {
      const k = `${p.contraforte}|${p.fiada}`;
      (porCfFiada.get(k) ?? porCfFiada.set(k, []).get(k)!).push(c);
    }
  }
  m.dims.trechos.forEach((tr, kk) => {
    const k = kk + 1;
    const nos = m.dims.contrafortes.filter((c) => c.trecho === k);
    const naFace = (x: number) => nos.some((n) => Math.abs(x - (n.x - t / 2 - 10)) < 0.5 || Math.abs(x - (n.x + t / 2)) < 0.5);
    const juntas: Set<number>[] = [];
    for (let i = 0; i < m.dims.n_fiadas; i++) {
      const s = new Set<number>();
      for (const c of porTrechoFiada.get(`${k}|${i}`) ?? []) if (c.max[0] < tr.x1 - 0.5 && !naFace(c.max[0])) s.add(Math.round(c.max[0]));
      juntas.push(s);
    }
    for (let i = 0; i + 1 < juntas.length; i++) {
      for (const x of juntas[i]) if (juntas[i + 1].has(x)) out.push(`T${k} fiadas ${i}/${i + 1} x=${x}`);
    }
  });
  const cfs = new Set(m.pecas.filter((p) => p.grupo === 'contraforte').map((p) => p.contraforte!));
  for (const cf of cfs) {
    const hj: Set<number>[] = [];
    let ponta = 0;
    for (let i = 0; i < m.dims.n_fiadas; i++) {
      const s = new Set<number>();
      for (const c of porCfFiada.get(`${cf}|${i}`) ?? []) {
        // η: distância à face do muro oposta à haste
        const eta = c.max[1] > t + 0.5 ? c.max[1] : t - c.min[1];
        ponta = Math.max(ponta, eta);
        s.add(Math.round(eta));
      }
      hj.push(s);
    }
    for (let i = 0; i + 1 < hj.length; i++) {
      if (deCanaleta.has(i) || deCanaleta.has(i + 1)) continue;
      for (const e of hj[i]) if (e < ponta - 0.5 && hj[i + 1].has(e)) out.push(`CF${cf} fiadas ${i}/${i + 1} η=${e}`);
    }
  }
  return out;
}

function pontoNoPoligono(x: number, y: number, pol: Vec2[]): boolean {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i];
    const [xj, yj] = pol[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * Toda barra vertical (e espera, acima da sapata) dentro do graute em toda fiada que atravessa: furo grauteado
 * (perfil exato) ou miolo da canaleta. Na fiada de canaleta vale a caixa do miolo da fiada toda — o fundo da
 * canaleta é quebrado nas células grauteadas para o graute vertical passar (brief §3.1).
 */
function barrasForaDoGraute(m: Modelo): string[] {
  const porFiada = new Map<number, { c: Caixa; pol?: Vec2[] }[]>();
  for (const p of m.pecas) {
    if (p.tipo !== 'GRAUTE_FURO' && p.tipo !== 'GRAUTE_CANALETA') continue;
    const g = m.geometrias[p.geometria];
    const c = caixa(m, p);
    const pol = p.tipo === 'GRAUTE_FURO' ? g.perfil.contorno.map(([u, v]) => {
      const q = paraGlobal(p, g, [u, v, 0]);
      return [q[0], q[1]] as Vec2;
    }) : undefined;
    const i = p.fiada ?? -1;
    (porFiada.get(i) ?? porFiada.set(i, []).get(i)!).push({ c, pol });
  }
  const out: string[] = [];
  for (const b of m.barras) {
    if (!VERTICAIS.has(b.papel)) continue;
    const zs = b.eixo.map((q) => q[2]);
    const x = b.eixo[0][0];
    const y = b.eixo[0][1];
    const z0 = Math.max(0, Math.min(zs[0], zs[1]));
    const z1 = Math.max(zs[0], zs[1]);
    for (let i = 0; i < m.dims.n_fiadas; i++) {
      if (Math.min(z1, (i + 1) * 200) - Math.max(z0, i * 200) < 1) continue;
      const ok = (porFiada.get(i) ?? []).some(({ c: k, pol }) =>
        x >= k.min[0] - 1e-6 && x <= k.max[0] + 1e-6 && y >= k.min[1] - 1e-6 && y <= k.max[1] + 1e-6 && (!pol || pontoNoPoligono(x, y, pol)));
      if (!ok) {
        out.push(`${b.id} fiada ${i}`);
        break;
      }
    }
  }
  return out;
}

/**
 * Barra da canaleta do contraforte (Jose, 09/10 — Detalhe 1): uma por contraforte em cada fiada de canaleta, Ø da
 * barra da canaleta do muro, da ponta do contraforte (cobrimento 3 cm) até a canaleta do muro, dobrada em L e
 * encostada na barra do muro (ao lado ou por cima), com a perna = ℓb da conta (mesmo Ø da vertical) ou 30φ.
 * Mesma forma ⇒ mesma posição, também espelhada (a ponta direita é a esquerda virada).
 */
function canaletasDosContrafortes(m: Modelo, r: Resultado): string[] {
  const out: string[] = [];
  const t = m.familia.t;
  const fiadasC = [...new Set(m.pecas.filter((p) => p.grupo === 'muro' && CANALETAS.has(p.tipo)).map((p) => p.fiada!))];
  const doCf = m.barras.filter((b) => b.papel === 'HORIZ' && b.contraforte !== undefined);
  if (!m.dims.contrafortes.length) return doCf.length ? ['barra de canaleta de contraforte num muro sem contraforte'] : [];
  const cfPecas = m.pecas.filter((p) => p.grupo === 'contraforte' && ALVENARIA.has(p.tipo)).map((p) => caixa(m, p));
  const enterrado = cfPecas.some((c) => c.max[1] > t + 0.5);
  const tenr = enterrado ? Math.max(...cfPecas.map((c) => c.max[1])) : t - Math.min(...cfPecas.map((c) => c.min[1]));
  const yPonta = enterrado ? tenr - 30 : t - tenr + 30;
  const lb = r.num('lb_adot');
  const phiV = r.num('phi_v');
  const curtas = new Set(m.avisos.filter((a) => a.codigo === 'CANALETA_CF_PERNA').flatMap((a) => a.ids ?? []));
  const parede = CATALOGO[m.familia.nome].canaleta.parede;
  const posPorForma = new Map<string, Set<string>>();
  m.dims.contrafortes.forEach((c, k) => {
    for (const i of fiadasC) {
      const bs = doCf.filter((b) => b.contraforte === k + 1 && Math.floor(b.eixo[0][2] / 200) === i);
      if (bs.length !== 1) {
        out.push(`C${k + 1} fiada ${i}: ${bs.length} barras de canaleta`);
        continue;
      }
      const b = bs[0];
      const e = b.eixo;
      const [a, z] = [e[0], e[0][2]];
      const fim = e[e.length - 1];
      const antes = e[e.length - 2];
      // barras do muro da fiada que a perna alcança; a da dobra é onde ela encosta
      const xa = Math.min(a[0], fim[0]);
      const xb = Math.max(a[0], fim[0]);
      const muro = m.barras.filter((q) => q.papel === 'HORIZ' && q.contraforte === undefined && q.trecho === c.trecho
        && Math.floor(q.eixo[0][2] / 200) === i && Math.min(q.eixo[0][0], q.eixo[1][0]) < xb && Math.max(q.eixo[0][0], q.eixo[1][0]) > xa);
      const naDobra = muro.find((q) => Math.min(q.eixo[0][0], q.eixo[1][0]) <= antes[0] + 1e-6 && Math.max(q.eixo[0][0], q.eixo[1][0]) >= antes[0] - 1e-6);
      if (!naDobra) {
        out.push(`${b.id}: sem barra do muro na dobra`);
        continue;
      }
      if (muro.some((q) => q.diametro !== b.diametro)) out.push(`${b.id}: Ø ${b.diametro} ≠ Ø da canaleta do muro`);
      if (Math.abs(a[0] - c.x) > 1e-6 || Math.abs(a[1] - yPonta) > 1e-6) out.push(`${b.id}: não começa na ponta do contraforte`);
      if (e.some((q) => Math.abs(q[2] - z) > 1e-6)) out.push(`${b.id}: não é plana`);
      // perna: reta, ao longo de X, para dentro do trecho, encostada na barra do muro
      if (Math.abs(fim[1] - antes[1]) > 1e-6) out.push(`${b.id}: perna fora de X`);
      const perna = Math.abs(fim[0] - antes[0]);
      const esperada = lb !== null && phiV !== null && Math.abs(b.diametro - phiV) < 1e-9 ? lb * 10 : 30 * b.diametro;
      if (Math.abs(perna - esperada) > 0.01 && !curtas.has(b.id)) out.push(`${b.id}: perna ${perna} ≠ ${esperada}`);
      const contato = (b.diametro + naDobra.diametro) / 2;
      const dist = Math.hypot(naDobra.eixo[0][1] - fim[1], naDobra.eixo[0][2] - fim[2]);
      if (Math.abs(dist - contato) > 0.01) out.push(`${b.id}: perna a ${dist} da barra do muro (encostada = ${contato})`);
      const bate = muro.filter((q) => Math.hypot(q.eixo[0][1] - fim[1], q.eixo[0][2] - fim[2]) < contato - 0.01);
      if (bate.length) out.push(`${b.id}: perna dentro de ${bate.map((q) => q.id).join(', ')}`);
      // ao lado da barra do muro, o graute mínimo dos dois lados; por cima dela, herda o y dela
      const aoLado = Math.abs(naDobra.eixo[0][1] - fim[1]) > 0.01;
      if (aoLado && (fim[1] - b.diametro / 2 < parede + 15 - 1e-6 || fim[1] + b.diametro / 2 > t - parede - 15 + 1e-6)) out.push(`${b.id}: perna sem graute`);
      // comprimento desenvolvido: o da polilinha com a dobra de arco (a polilinha é corda, um pouco menor)
      let L = 0;
      for (let j = 1; j < e.length; j++) L += Math.hypot(e[j][0] - e[j - 1][0], e[j][1] - e[j - 1][1], e[j][2] - e[j - 1][2]);
      if (b.comprimento < L - 0.01 || b.comprimento > L * 1.01) out.push(`${b.id}: comprimento ${b.comprimento} × polilinha ${L}`);
      const forma = `${b.diametro}|${Math.round(b.comprimento)}`;
      (posPorForma.get(forma) ?? posPorForma.set(forma, new Set()).get(forma)!).add(b.posicao);
    }
  });
  if (doCf.length !== m.dims.contrafortes.length * fiadasC.length) out.push(`${doCf.length} barras de canaleta de contraforte`);
  // duas pernas no mesmo lugar (vão curto: a da ponta direita volta contra a do vizinho)
  const pernas = doCf.map((b) => {
    const [u, v] = [b.eixo[b.eixo.length - 2], b.eixo[b.eixo.length - 1]];
    return { b, x0: Math.min(u[0], v[0]), x1: Math.max(u[0], v[0]), y: v[1], z: v[2] };
  });
  for (let i = 0; i < pernas.length; i++) {
    for (let j = i + 1; j < pernas.length; j++) {
      const [a, c] = [pernas[i], pernas[j]];
      const perto = Math.hypot(a.y - c.y, a.z - c.z) < (a.b.diametro + c.b.diametro) / 2 - 0.01;
      if (perto && a.x0 < c.x1 - 0.01 && c.x0 < a.x1 - 0.01) out.push(`${a.b.id} × ${c.b.id}: pernas sobrepostas`);
    }
  }
  for (const [f, ps] of posPorForma) if (ps.size > 1) out.push(`barra ${f} em ${ps.size} posições (${[...ps].join(', ')})`);
  return out;
}

function conferirTudo(m: Modelo, r: Resultado, nome: string): void {
  // ids únicos e geometria existente
  const ids = new Set<string>();
  for (const p of [...m.pecas, ...m.barras]) {
    expect(ids.has(p.id), `${nome}: id repetido ${p.id}`).toBe(false);
    ids.add(p.id);
  }
  for (const p of m.pecas) expect(m.geometrias[p.geometria], `${nome}: ${p.id} → ${p.geometria}`).toBeDefined();
  for (const [k, g] of Object.entries(m.geometrias)) {
    expect(g.chave).toBe(k);
    expect(g.volume_mm3, `${nome}: volume de ${k}`).toBeGreaterThan(0);
    expect(areaPoligono(g.perfil.contorno), `${nome}: contorno anti-horário ${k}`).toBeGreaterThan(0);
    for (const f of g.perfil.furos ?? []) expect(areaPoligono(f), `${nome}: furo horário ${k}`).toBeLessThan(0);
  }

  expect(sobreposicoes(m), `${nome}: blocos sobrepostos`).toEqual([]);
  expect(juntasAPrumo(m), `${nome}: junta a prumo`).toEqual([]);
  expect(barrasForaDoGraute(m), `${nome}: barra fora do graute`).toEqual([]);
  expect(canaletasDosContrafortes(m, r), `${nome}: barra da canaleta do contraforte`).toEqual([]);

  // graute do furo = área do furo da peça × altura; no inteiro e no meio, área = a do bloco desenhado (decisão do Jose,
  // 09/10): a do Revit (volume da família) na 14x39 e na 19x39 — e NÃO o Ag da conta
  void r;
  const fam = CATALOGO[m.familia.nome];
  const areaDoBloco = (chave: string): number => {
    const pc = fam.pecas.find((q) => q.chave === chave)!;
    if (!pc.medido) return fam.agFuro;
    return (fam.t * pc.comprimento - pc.medido.volume / 190) / pc.medido.furos.length;
  };
  const porId = new Map(m.pecas.map((p) => [p.id, p]));
  for (const p of m.pecas) {
    if (p.tipo !== 'GRAUTE_FURO') continue;
    const g = m.geometrias[p.geometria];
    const [hostId, gk] = p.id.split(/\.g(?=\d+$)/);
    const host = porId.get(hostId);
    expect(host, `${nome}: hospedeira de ${p.id}`).toBeDefined();
    const furo = m.geometrias[host!.geometria].perfil.furos![Number(gk) - 1];
    expect(Math.abs(g.volume_mm3 / (Math.abs(areaPoligono(furo)) * g.extensao) - 1)).toBeLessThan(1e-6);
    expect(host!.furosGrauteados).toContain(Number(gk) - 1);
    if (host!.tipo === 'BLOCO' || host!.tipo === 'MEIO_BLOCO') {
      const ag = areaDoBloco(host!.tipo === 'BLOCO' ? 'inteiro' : 'meio');
      expect(Math.abs(g.volume_mm3 / (ag * g.extensao) - 1), `${nome}: furo do bloco × h em ${p.id}`).toBeLessThan(1e-3);
    }
  }

  // trechos: tudo de um trecho dentro dele (o terreno pode avançar até o meio da junta)
  m.dims.trechos.forEach((tr, k) => {
    for (const p of m.pecas) {
      if (p.trecho !== k + 1) continue;
      const c = caixa(m, p);
      const folga = p.grupo === 'terreno' ? 5 : 0;
      expect(c.min[0] >= tr.x0 - folga - 1e-6 && c.max[0] <= tr.x1 + folga + 1e-6, `${nome}: ${p.id} fora do trecho`).toBe(true);
    }
    for (const b of m.barras) {
      if (b.trecho !== k + 1) continue;
      for (const q of b.eixo) expect(q[0] >= tr.x0 - 1e-6 && q[0] <= tr.x1 + 1e-6, `${nome}: barra ${b.id} fora do trecho`).toBe(true);
    }
    if (k > 0) expect(tr.x0 - m.dims.trechos[k - 1].x1, `${nome}: folga da junta`).toBe(10);
  });
  expect(m.dims.trechos[m.dims.trechos.length - 1].x1).toBe(m.dims.L_real);
  // a sapata é cortada junto com o muro
  expect(m.pecas.filter((p) => p.tipo === 'SAPATA').length).toBe(m.dims.trechos.length);

  // contrafortes nas duas pontas de cada trecho
  if (m.dims.contrafortes.length) {
    const t = m.familia.t;
    m.dims.trechos.forEach((tr, k) => {
      const cs = m.dims.contrafortes.filter((c) => c.trecho === k + 1);
      expect(cs[0].x).toBeCloseTo(tr.x0 + t / 2, 6);
      expect(cs[cs.length - 1].x).toBeCloseTo(tr.x1 - t / 2, 6);
      expect(cs[0].ponta && cs[cs.length - 1].ponta).toBe(true);
    });
    const cfsComPeca = new Set(m.pecas.filter((p) => p.grupo === 'contraforte' && ALVENARIA.has(p.tipo)).map((p) => p.contraforte));
    expect(cfsComPeca.size).toBe(m.dims.contrafortes.length);
  }

  // altura (09/10: duas entradas): o muro fecha a fiada; o aterro vai até a altura de solo da planilha, ≤ muro
  expect(m.dims.H_muro).toBe(m.dims.n_fiadas * 200);
  expect(m.dims.H_muro).toBeGreaterThanOrEqual(m.dims.H_solo);
  const hsPl = r.num('H_solo');
  if (hsPl !== null && hsPl > 0 && hsPl * 1000 <= m.dims.H_muro) expect(m.dims.H_solo).toBe(Math.round(hsPl * 1000));
  for (const a of m.pecas.filter((p) => p.tipo === 'ATERRO')) expect(caixa(m, a).max[2]).toBeCloseTo(m.dims.H_solo, 6);
  // drenagem desligada não desenha peça
  if (String(m.extras?.dreno_on).startsWith('N')) expect(m.pecas.some((p) => p.tipo === 'DRENO' || p.tipo === 'MANTA')).toBe(false);
  if (String(m.extras?.barbaca_on).startsWith('N')) expect(m.pecas.some((p) => p.tipo === 'BARBACA')).toBe(false);
}

// ── os testes ────────────────────────────────────────────────────────────────

describe('furo calibrado no Ag da aula', () => {
  it.each([['14x39', 11700], ['19x39', 17000]] as const)('%s → %d mm²', (nome, ag) => {
    const f = CATALOGO[nome];
    const furo = calibrarFuro(f.t, f.L, f.hf, ag);
    const pol = retanguloArredondado(furo.l, furo.w, furo.r);
    expect(Math.abs(Math.abs(areaPoligono(pol)) / ag - 1)).toBeLessThan(1e-6);
    // meia-lua nos blocos de 14 (brief §0.4); o raio sai um pouco menor que w/2 porque a área que bate é a do
    // POLÍGONO desenhado (6 lados por quarto), não a do círculo
    if (f.t === 140) expect(furo.r / (furo.w / 2)).toBeGreaterThan(0.97);
  });
  it('área menor que o retângulo da tabela (o furo encolhe) ainda bate', () => {
    for (const [t, L, hf, ag] of [[190, 390, 22, 8700], [140, 290, 22, 8700], [140, 390, 22, 8700]]) {
      const furo = calibrarFuro(t, L, hf, ag);
      expect(Math.abs(Math.abs(areaPoligono(retanguloArredondado(furo.l, furo.w, furo.r))) / ag - 1)).toBeLessThan(1e-6);
    }
  });
  it('distância à borda do furo (sinal)', () => {
    expect(distanciaAoFuro(0, 0, 50, 20, 5)).toBe(-20);
    expect(distanciaAoFuro(60, 0, 50, 20, 5)).toBeCloseTo(10, 9);
  });
  it('furos alinhados de fiada a fiada (barra reta do pé ao topo)', () => {
    // 19x39 (bloco do Revit): o furo do inteiro fica a 11,25 mm do centro da célula (septos das pontas e do meio
    // iguais) — a barra no centro da célula atravessa todas as fiadas com folga. Na 14x39 a grade anda 5 cm em cada
    // nó de contraforte (t + 10 = 150 ≠ m = 200), então não há uma grade só para medir: lá quem confere é o
    // conferirTudo, barra a barra (barra fora do graute). Até 08/10 a 2ª linha era a aula 12.3 em 14x29.
    for (const [c, L, desvio] of [['aula122', 3, 11.25]] as const) {
      const m = gerarModelo(resultadoDoGabarito(c), { L_total: L });
      const { m: mm } = m.familia;
      for (const p of m.pecas) {
        if (p.tipo !== 'GRAUTE_FURO' || p.grupo !== 'muro') continue;
        const k = caixa(m, p);
        const cx = (k.min[0] + k.max[0]) / 2;
        const r = (((cx - (mm - 10) / 2) % mm) + mm) % mm;
        expect(Math.min(r, mm - r), `${c} ${p.id}`).toBeLessThan(desvio + 1e-6);
      }
    }
  });
});

describe('tabela de encaixes', () => {
  it('fecha com o catálogo', () => {
    expect(conferirCatalogo()).toEqual([]);
    expect(conferirEncaixes()).toEqual([]);
  });
  it('19x39 e 14x39 dos gabaritos do Revit (a 14x29 provisória saiu com o cerâmico, 09/10)', () => {
    expect(ENCAIXES['19x39'].provisoria).toBe(false);
    expect(ENCAIXES['14x39'].provisoria).toBe(false);
    expect(Object.keys(ENCAIXES).sort()).toEqual(['14x39', '19x39']);
  });
  it('o vão que amarra sai da própria receita', () => {
    for (let k = 1; k <= 12; k++) {
      expect(vaoAmarra(CATALOGO['19x39'], k), `19x39 k=${k}`).toBe(true);
    }
    // 54/34: só nº par de células no vão amarra
    for (let k = 2; k <= 12; k++) expect(vaoAmarra(CATALOGO['14x39'], k), `14x39 k=${k}`).toBe(k % 2 === 0);
    // a lista que a tela oferece
    expect(vaosDoContraforte('14x39', 2200)).toEqual([550, 950, 1350, 1750, 2150]);
    expect(vaosDoContraforte('19x39', 1600)).toEqual([400, 600, 800, 1000, 1200, 1400, 1600]);
  });
  it('14x39: 54 no T, 34 na ponta (girado na direita), 34 passante, canaleta cortada na fiada de canaleta', () => {
    const r = resultadoDoGabarito('aula123');                       // VAL123: 14x39, vão 1,35, contraforte 54
    const m = gerarModelo(r, { L_total: 6 });
    const juncoes = m.pecas.filter((p) => p.tipo === 'BLOCO_JUNCAO');
    const cat = (p: Peca) => m.geometrias[p.geometria].catalogo ?? '';
    expect(juncoes.some((p) => cat(p).includes('54'))).toBe(true);
    expect(juncoes.some((p) => cat(p).includes('34') && p.giro === 180)).toBe(true);
    expect(juncoes.some((p) => cat(p).includes('34') && p.grupo === 'contraforte')).toBe(true);
    conferirTudo(m, r, 'aula123 (14x39)');
    // 3 contrafortes: a canaleta precisa de peça cortada para absorver os 5 cm de cada nó (com 4, 4 × 150 = 3 × 200 fecha)
    const m3 = gerarModelo(r, { L_total: 2.9 });
    expect(m3.dims.contrafortes.length).toBe(3);
    expect(m3.pecas.some((p) => p.tipo === 'CANALETA_CORTADA')).toBe(true);
    conferirTudo(m3, r, 'aula123 (14x39), 3 contrafortes');
  });
});

describe('contraforte de duas fileiras (dobrado): fora do app (decisão do Jose, 09/10)', () => {
  it('eenr = 39 na 19x39 continua desenhando o contraforte de uma fileira, com o ajuste à mostra', () => {
    const r = trocar(resultadoDoGabarito('aula123'), { t_bloco: 19, L_bloco: 39, eenr: 39, Ag_furo: 170, hf_bl: 3.5 });
    const m = gerarModelo(r, { L_total: 6 });
    expect(m.ajustes).toContainEqual({ nome: 'eenr', de: 39, para: 19, unidade: 'cm' });
    conferirTudo(m, r, '19x39 com eenr 39');
  });
});

describe('regra modular', () => {
  it('altura do muro fora da fiada (valor que a lista não daria): o muro sobe até fechar a fiada', () => {
    const r = trocar(resultadoDoGabarito('aula122'), { H_muro: 1.7, H_solo: 1.7 });
    const m = gerarModelo(r, { L_total: 3 });
    expect(m.dims.H_solo).toBe(1700);
    expect(m.dims.H_muro).toBe(1800);
    expect(m.ajustes).toContainEqual({ nome: 'H_muro', de: 1.7, para: 1.8, unidade: 'm' });
    const aterro = m.pecas.find((p) => p.tipo === 'ATERRO')!;
    expect(caixa(m, aterro).max[2]).toBe(1700);
  });
  it('solo abaixo do topo do muro (09/10): muro na altura dele, aterro até a altura de solo, sem "→"', () => {
    const r = trocar(resultadoDoGabarito('aula122'), { H_muro: 2.4, H_solo: 1.3 });
    const m = gerarModelo(r, { L_total: 3 });
    expect(m.dims.H_muro).toBe(2400);
    expect(m.dims.n_fiadas).toBe(12);
    expect(m.dims.H_solo).toBe(1300);
    expect(m.ajustes.find((a) => a.nome === 'H_muro')).toBeUndefined();
    for (const a of m.pecas.filter((p) => p.tipo === 'ATERRO')) expect(caixa(m, a).max[2]).toBe(1300);
  });
  it('l_cf e tenr para cima no módulo da família (e num vão que amarra)', () => {
    // valores fora das listas das Entradas (o formulário não deixa; a regra fica como garantia)
    const base = resultadoDoGabarito('aula123');
    const m39 = gerarModelo(trocar(base, { t_bloco: 19, eenr: 19, Ag_furo: 170, hf_bl: 3.5, l_cf: 1.5, tenr_: 59 }), { L_total: 6 });
    expect(m39.ajustes).toContainEqual({ nome: 'l_cf', de: 1.5, para: 1.6, unidade: 'm' });
    expect(m39.ajustes.find((a) => a.nome === 'tenr_')).toBeUndefined();          // 59 = 19 + 2·20 fecha
    const m1439 = gerarModelo(trocar(base, { l_cf: 1.5, tenr_: 59 }), { L_total: 6 });
    // 1,55 fecharia no módulo, mas com o 54/34 deixa junta a prumo no meio do vão: 1,75
    expect(m1439.ajustes).toContainEqual({ nome: 'l_cf', de: 1.5, para: 1.75, unidade: 'm' });
    expect(m1439.avisos.map((a) => a.codigo)).toContain('VAO_AMARRACAO');
    expect(m1439.ajustes).toContainEqual({ nome: 'tenr_', de: 59, para: 74, unidade: 'cm' });
    // com os valores da lista (o VAL123: 1,35 e 54) não há ajuste
    const daLista = gerarModelo(base, { L_total: 6 });
    expect(daLista.ajustes.find((a) => a.nome === 'l_cf' || a.nome === 'tenr_')).toBeUndefined();
  });
  it('espaçamento das barras do balanço para baixo, no meio módulo', () => {
    // fora do módulo só chega aqui por valor que a planilha não daria (a lista das Entradas é de múltiplos de m)
    const r = trocar(resultadoDoGabarito('aula122'), { s_adot: 50 });
    const m = gerarModelo(r, { L_total: 3 });
    expect(m.ajustes).toContainEqual({ nome: 's_adot', de: 50, para: 40, unidade: 'cm' });
  });
  it('usa o nome da planilha quando ele existir (l_cf_adot, n_fiadas)', () => {
    const r = trocar(resultadoDoGabarito('aula123'), { l_cf_adot: 1.75 });   // 14x39: 1,75 amarra (nº par de células)
    const m = gerarModelo(r, { L_total: 6 });
    const xs = m.dims.contrafortes.map((c) => c.x);
    expect(xs[1] - xs[0]).toBe(1750);
    const r2 = trocar(resultadoDoGabarito('aula122'), { n_fiadas: 9, H_muro_des: 1.8 });
    expect(gerarModelo(r2, { L_total: 3 }).dims.H_muro).toBe(1800);
  });
  it('comprimento ao módulo; juntas dividem em trechos iguais', () => {
    const m = gerarModelo(resultadoDoGabarito('aula122'), { L_total: 5 });
    expect(m.dims.L_real).toBe(4990);                                              // 25 células de 20 (brief §5.2)
    const j = gerarModelo(resultadoDoGabarito('aula122'), { L_total: 20, junta_cada: 6 });
    expect(j.dims.trechos.length).toBe(4);
    const c = gerarModelo(resultadoDoGabarito('aula123'), { L_total: 20, junta_cada: 6 });
    expect(c.dims.trechos.length).toBe(4);
    expect(c.dims.contrafortes.filter((k) => k.ponta).length).toBe(8);
    // junta: um contraforte de cada lado, encostados (10 mm entre as faces)
    for (let k = 1; k < c.dims.trechos.length; k++) {
      const a = c.dims.contrafortes.filter((q) => q.trecho === k).pop()!;
      const b = c.dims.contrafortes.find((q) => q.trecho === k + 1)!;
      expect(b.x - a.x).toBe(c.familia.t + 10);
    }
  });
});

describe('canaleta cortada da 19: peça própria (Jose, 09/10)', () => {
  const r19 = trocar(resultadoDoGabarito('aula123'), { t_bloco: 19, L_bloco: 39, eenr: 19, Ag_furo: 170, hf_bl: 3.5 });
  const secao = (m: Modelo, p: Peca): number => m.geometrias[p.geometria].volume_mm3 / m.geometrias[p.geometria].extensao;
  it('19x39: fundo 3,91 e o volume do Revit (2864 cm³ em 19 cm); o graute dela é o miolo dela', () => {
    const m = gerarModelo(r19, { L_total: 6 });
    const cortadas = m.pecas.filter((p) => p.tipo === 'CANALETA_CORTADA');
    expect(cortadas.length).toBeGreaterThan(0);
    for (const p of cortadas) expect(Math.abs(secao(m, p) / (2864e3 / 190) - 1), p.id).toBeLessThan(1e-3);
    const inteira = m.pecas.find((p) => p.tipo === 'CANALETA')!;
    expect(Math.abs(secao(m, inteira) / (5333e3 / 390) - 1)).toBeLessThan(1e-3);
    // o fundo: o miolo começa 39,1 mm acima da base da peça (e o da inteira, 29,1)
    const fundo = (p: Peca): number => {
      const g = m.geometrias[p.geometria];
      const t = m.familia.t;
      const no = g.perfil.contorno.filter(([u]) => u > 30 && u < t - 30).map(([, v]) => v);
      return Math.min(...no.filter((v) => v > 1));
    };
    expect(fundo(cortadas[0])).toBeCloseTo(39.1, 6);
    expect(fundo(inteira)).toBeCloseTo(29.1, 6);
    // graute: U + miolo = seção cheia, peça a peça na haste; na linha do muro o prisma muda de seção junto com a peça
    const t = m.familia.t;
    for (const g of m.pecas.filter((p) => p.tipo === 'GRAUTE_CANALETA' && p.grupo === 'contraforte')) {
      const host = m.pecas.find((p) => p.id === g.id.replace(/\.gc$/, ''))!;
      expect(secao(m, host) + secao(m, g), g.id).toBeCloseTo(t * 190, 3);
    }
    expect(Object.keys(m.geometrias).some((k) => k.startsWith('graute canaleta 19x39 cortada'))).toBe(true);
    // o graute das canaletas da linha do muro cobre a fiada de ponta a ponta, sem buraco nem sobreposição
    for (const i of [...new Set(m.pecas.filter((p) => p.tipo === 'GRAUTE_CANALETA' && p.grupo === 'muro').map((p) => p.fiada!))]) {
      for (const tr of m.dims.trechos) {
        const gs = m.pecas.filter((p) => p.tipo === 'GRAUTE_CANALETA' && p.grupo === 'muro' && p.fiada === i && caixa(m, p).min[0] >= tr.x0 - 1e-6 && caixa(m, p).max[0] <= tr.x1 + 1e-6)
          .map((p) => caixa(m, p)).sort((a, b) => a.min[0] - b.min[0]);
        expect(gs[0].min[0]).toBeCloseTo(tr.x0, 6);
        expect(gs[gs.length - 1].max[0]).toBeCloseTo(tr.x1, 6);
        for (let k = 1; k < gs.length; k++) expect(gs[k].min[0]).toBeCloseTo(gs[k - 1].max[0], 6);
      }
    }
    // a barra da canaleta passa por cima do fundo mais alto da fiada, com o graute mínimo
    for (const b of m.barras.filter((q) => q.papel === 'HORIZ' && q.contraforte === undefined)) {
      const i = Math.floor(b.eixo[0][2] / 200);
      expect(b.eixo[0][2] - b.diametro / 2 - (i * 200 + 10 + 39.1), b.id).toBeCloseTo(15, 6);
    }
  });
  it('14x39: a cortada continua com a seção da inteira (os cortes do Revit têm o volume proporcional)', () => {
    const m = gerarModelo(resultadoDoGabarito('aula123'), { L_total: 2.9 });
    const cortadas = m.pecas.filter((p) => p.tipo === 'CANALETA_CORTADA');
    expect(cortadas.length).toBeGreaterThan(0);
    for (const p of cortadas) expect(Math.abs(secao(m, p) / (5116e3 / 390) - 1), p.id).toBeLessThan(1e-3);
    // e os cortes do gabarito (19, 20 e 24 cm) batem com o volume do Revit
    for (const [L, v] of [[190, 2492e3], [200, 2624e3], [240, 3148e3]]) expect(Math.abs((secao(m, cortadas[0]) * L) / v - 1)).toBeLessThan(2e-3);
  });
});

describe('barra da canaleta do contraforte (Jose, 09/10)', () => {
  it('vão curto: as pernas não se atropelam (encurtam, com aviso)', () => {
    const base = trocar(resultadoDoGabarito('aula123'), { t_bloco: 19, L_bloco: 39, eenr: 19, Ag_furo: 170, hf_bl: 3.5 });
    for (const vao of [0.4, 0.6]) {
      const r = trocar(base, { l_cf: vao, l_cf_adot: vao });
      const m = gerarModelo(r, { L_total: 3 });
      expect(m.dims.contrafortes[1].x - m.dims.contrafortes[0].x).toBe(vao * 1000);
      expect(canaletasDosContrafortes(m, r), `vão ${vao}`).toEqual([]);
      if (vao === 0.4) expect(m.avisos.map((a) => a.codigo)).toContain('CANALETA_CF_PERNA');
    }
  });
  it('a ponta direita é a esquerda espelhada: uma posição só na lista de ferros', () => {
    const r = resultadoDoGabarito('aula123');
    const m = gerarModelo(r, { L_total: 6 });
    const cf = m.barras.filter((b) => b.papel === 'HORIZ' && b.contraforte !== undefined);
    const fiada = (b: (typeof cf)[number]) => Math.floor(b.eixo[0][2] / 200);
    const topo = Math.max(...cf.map(fiada));
    const daCinta = cf.filter((b) => fiada(b) === topo);
    const n = m.dims.contrafortes.length;
    expect(daCinta.length).toBe(n);
    // pernas para dentro do muro: a 1ª para +X, a última para −X
    const dx = (b: (typeof cf)[number]) => b.eixo[b.eixo.length - 1][0] - b.eixo[0][0];
    expect(dx(daCinta.find((b) => b.contraforte === 1)!)).toBeGreaterThan(0);
    expect(dx(daCinta.find((b) => b.contraforte === n)!)).toBeLessThan(0);
    expect(new Set(daCinta.map((b) => b.posicao)).size).toBe(1);
  });
});

describe('comprimento do muro no módulo (Jose, 09/10)', () => {
  // 19 balanço, 14 balanço, 14 contrafortes, 19 contrafortes, 19 contrafortes aparente
  const cenarios = ['aula122', 'sorteio02', 'aula123', 'sorteio00', 'sorteio16'];
  it('nenhuma peça cortada fora das canaletas; o comprimento cai no módulo e a tela recebe o ajuste', () => {
    for (const c of cenarios) {
      const r = resultadoDoGabarito(c);
      for (let L = 1; L <= 25; L += 0.73) {
        const Lt = Math.round(L * 100) / 100;
        const m = gerarModelo(r, { L_total: Lt });
        const nome = `${c} L=${Lt}`;
        const alv = m.pecas.filter((p) => ALVENARIA.has(p.tipo));
        // bloco nunca é cortado: só inteiro, meio e as peças de amarração do catálogo
        expect(alv.filter((p) => !CANALETAS.has(p.tipo) && !['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO'].includes(p.tipo)).map((p) => p.id), nome).toEqual([]);
        if (!m.dims.contrafortes.length) {
          // balanço: nem a canaleta é cortada, e cada trecho é um nº inteiro de meios módulos
          expect(alv.some((p) => p.tipo === 'CANALETA_CORTADA'), nome).toBe(false);
          for (const tr of m.dims.trechos) expect((tr.x1 - tr.x0 + 10) % m.familia.m, nome).toBe(0);
        } else {
          // contrafortes: cada trecho é um nº inteiro de vãos (eixo a eixo) + a largura do contraforte
          const xs = m.dims.contrafortes.map((k) => k.x);
          const vao = xs[1] - xs[0];
          m.dims.trechos.forEach((tr) => expect((tr.x1 - tr.x0 - m.familia.t) % vao, nome).toBe(0));
        }
        const aj = m.ajustes.find((a) => a.nome === 'L_total');
        if (Math.abs(Lt - m.dims.L_real / 1000) > 1e-6) expect(aj, nome).toEqual({ nome: 'L_total', de: Lt, para: Math.round(m.dims.L_real / 10) / 100, unidade: 'm' });
        else expect(aj, nome).toBeUndefined();
      }
    }
  }, 120_000);
});

describe('aulas (brief §8)', () => {
  it('aula 12.2, 5 m: o mesmo arranjo do protótipo', () => {
    const m = gerarModelo(resultadoDoGabarito('aula122'), { L_total: 5 });
    const conta = (tipo: TipoPeca) => m.pecas.filter((p) => p.tipo === tipo).length;
    expect(m.dims.n_fiadas).toBe(8);
    expect(conta('BLOCO')).toBe(72);
    expect(conta('MEIO_BLOCO')).toBe(6);
    expect(conta('CANALETA')).toBe(24);
    expect(conta('MEIA_CANALETA')).toBe(2);
    expect(m.barras.filter((b) => b.papel === 'VERT_MURO').length).toBe(13);
    const canaletas = [...new Set(m.pecas.filter((p) => p.tipo === 'CANALETA').map((p) => p.fiada))];
    expect(canaletas).toEqual([3, 7]);
    // d = 14 no bloco 19 deixa 10 mm de graute (brief §7.2)
    expect(m.avisos.map((a) => a.codigo)).toContain('COBRIMENTO_GRAUTE');
  });
  it('VAL123 (contrafortes em 14x39 com a geometria da aula 12.3), 3 m: regressão da regra dos gabaritos', () => {
    // Até 08/10 aqui era a aula 12.3 em 14x29 (cerâmico, modo validação). O cenário passou a ser a mesma geometria em
    // bloco de concreto 14x39: vão 1,35 (da lista do 14), contraforte de 54, h 2,6 (13 fiadas). Números MEDIDOS no
    // gerador em 09/10 — regressão, não conta de mão.
    const m = gerarModelo(resultadoDoGabarito('aula123'), { L_total: 3 });
    expect(m.familia.nome).toBe('14x39');
    expect(m.dims.L_real).toBe(2840);
    expect(m.dims.n_fiadas).toBe(13);
    expect(m.dims.contrafortes.map((c) => c.x)).toEqual([70, 1420, 2770]);
    const conta = (tipo: TipoPeca, grupo: string) => m.pecas.filter((p) => p.tipo === tipo && p.grupo === grupo).length;
    expect(conta('BLOCO', 'muro')).toBe(44);
    expect(conta('MEIO_BLOCO', 'muro')).toBe(0);
    expect(conta('BLOCO_JUNCAO', 'muro')).toBe(15);
    expect(conta('CANALETA', 'muro')).toBe(24);
    expect(conta('CANALETA_CORTADA', 'muro')).toBe(8);
    expect(conta('BLOCO', 'contraforte')).toBe(15);
    expect(conta('MEIO_BLOCO', 'contraforte')).toBe(12);
    expect(conta('BLOCO_JUNCAO', 'contraforte')).toBe(12);
    expect(conta('CANALETA', 'contraforte')).toBe(12);
    const xs = [...new Set(m.barras.filter((b) => b.papel === 'VERT_MURO').map((b) => b.eixo[0][0]))];
    expect(xs).toEqual([445, 845, 1245, 1795, 2195, 2595]);
    expect(m.barras.filter((b) => b.papel === 'VERT_MURO').length).toBe(12);
    // 3 contrafortes × 4Ø10: desde 09/10 (noite) o d é o da montagem (44,5, furo da ponta a 9,5 cm), e não 47 — o As
    // sobe de 2,28 para 2,42 cm² e passa de 3 para 4 barras
    expect(m.barras.filter((b) => b.papel === 'CF_PRINCIPAL').length).toBe(12);
    expect(m.barras.filter((b) => b.papel === 'CF_ESTRIBO').length).toBe(3 * 13);
    expect(m.familia.provisoria).toBeUndefined();
    expect(m.avisos.map((a) => a.codigo)).not.toContain('ENCAIXE_PROVISORIO');
  });
});

describe('todos os cenários do gabarito × variações', () => {
  const cenarios = cenariosDoGabarito();
  it(`tem cenários (${cenarios.length})`, () => expect(cenarios.length).toBeGreaterThanOrEqual(42));
  for (const c of cenarios) {
    it(c, () => {
      const r = resultadoDoGabarito(c);
      for (const v of VARIACOES) conferirTudo(gerarModelo(r, v), r, `${c} ${JSON.stringify(v)}`);
    }, 60_000);
  }
});

describe('determinismo e tempo', () => {
  it('duas chamadas → o mesmo JSON', () => {
    for (const c of ['aula122', 'aula123', 'sorteio05', 'sorteio19']) {
      const r = resultadoDoGabarito(c);
      expect(JSON.stringify(gerarModelo(r, { L_total: 20, junta_cada: 6 }))).toBe(JSON.stringify(gerarModelo(r, { L_total: 20, junta_cada: 6 })));
    }
  });
  it('padrões do modelo = ENTRADAS_DO_MODELO', () => {
    expect(padroesDoModelo().L_total).toBe(6);
    expect(padroesDoModelo().cinta_topo).toBe('Sim');
  });
  it('muro de 20 m × 3 m em menos de 150 ms', () => {
    for (const c of ['aula122', 'aula123', 'sorteio19']) {
      const r = trocar(resultadoDoGabarito(c), { H_muro: 3 });
      gerarModelo(r, { L_total: 20 });
      const t0 = performance.now();
      const m = gerarModelo(r, { L_total: 20 });
      const dt = performance.now() - t0;
      expect(m.dims.n_fiadas).toBe(15);
      expect(dt, `${c}: ${dt.toFixed(1)} ms`).toBeLessThan(150);
    }
  });
});
