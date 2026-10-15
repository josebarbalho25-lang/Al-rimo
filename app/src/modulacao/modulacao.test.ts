/*
  PROVA DA MODULAÇÃO — o muro peça a peça contra as regras, em TODOS os cenários do gabarito do Excel.

  As conferências leem só o Modelo (o que o 3D, o IFC e o quantitativo recebem), nunca os intermediários do
  gerador: se o gerador errar, o teste não erra junto.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import type { Resultado, Valor } from '@/motor/tipos';
import type { Modelo, Peca, TipoPeca, Vec2, Vec3 } from '@/modelo/tipos';
import { caixaGlobal, gerarModelo, paraGlobal, padroesDoModelo } from './index';
import { areaPoligono, calibrarFuro, distanciaAoFuro, profundidadeNaPeca, retanguloArredondado } from './perfis';
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
  { L_total: 20, junta_cada: 6, cinta_topo: 'Não', barbaca_on: 'Não', dreno_on: 'Não', drenof_on: 'Não' },
  { L_total: 6, areia_esp: 0, drenof_env: 0.5 },
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
 * (perfil exato) ou miolo da canaleta. Na fiada de canaleta vale a caixa do miolo da fiada toda, ou o graute do furo
 * no fundo dela — o fundo da canaleta é furado onde a barra sobe, e o graute da coluna passa (brief §3.1; desenhado
 * desde 09/10 noite — barrasEmPecaSolida confere que a barra não atravessa o fundo).
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
    if (CANALETAS.has(host!.tipo)) {
      // graute da coluna no FUNDO furado da canaleta (09/10 noite): da junta de baixo até o fundo, e o meio dele cai
      // no furo — com o fundo inteiro, cairia dentro da canaleta
      const c = caixa(m, p);
      const ch = caixa(m, host!);
      expect(c.min[2], `${nome}: ${p.id} começa na junta de baixo`).toBe(ch.min[2] - 10);
      expect(c.max[2], `${nome}: ${p.id} vai até o fundo`).toBeLessThan(ch.min[2] + 45);
      const meio: Vec3 = [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (Math.max(c.min[2], ch.min[2]) + c.max[2]) / 2];
      expect(profundidadeNaPeca(host!, m.geometrias[host!.geometria], meio), `${nome}: ${p.id} no fundo furado de ${hostId}`).toBeLessThanOrEqual(0);
      continue;
    }
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
  // drenagem desligada não desenha peça; só o dreno de fundo ligado: a brita fica na envoltória do tubo
  const DRENAGEM = new Set<TipoPeca>(['DRENO', 'AREIA', 'MANTA', 'TUBO_DRENO']);
  const desligado = (nome: string): boolean => String(m.extras?.[nome] ?? 'Sim').startsWith('N');
  if (desligado('dreno_on') && desligado('drenof_on')) expect(m.pecas.some((p) => DRENAGEM.has(p.tipo))).toBe(false);
  if (desligado('dreno_on') && !desligado('drenof_on')) {
    for (const d of m.pecas.filter((p) => p.tipo === 'DRENO')) expect(caixa(m, d).max[2]).toBeLessThanOrEqual(300 + 1e-6);
  }
  if (desligado('drenof_on')) expect(m.pecas.some((p) => p.tipo === 'TUBO_DRENO')).toBe(false);
  if (Number(m.extras?.areia_esp) === 0) expect(m.pecas.some((p) => p.tipo === 'AREIA')).toBe(false);
  // o pacote do dreno nunca passa do topo do solo, e o tubo fica dentro da brita
  for (const d of m.pecas.filter((p) => DRENAGEM.has(p.tipo))) expect(caixa(m, d).max[2]).toBeLessThanOrEqual(m.dims.H_solo + 1e-6);
  for (const tb of m.pecas.filter((p) => p.tipo === 'TUBO_DRENO')) {
    const c = caixa(m, tb);
    const br = m.pecas.filter((p) => p.tipo === 'DRENO' && p.trecho === tb.trecho).map((p) => caixa(m, p));
    expect(br.some((b) => c.min[0] >= b.min[0] - 1e-6 && c.max[0] <= b.max[0] + 1e-6 && c.min[1] > b.min[1] && c.max[1] < b.max[1] && c.min[2] > b.min[2])).toBe(true);
  }
  // o barbacã sai 5 cm da face e fica todo acima do solo da frente
  for (const b of m.pecas.filter((p) => p.tipo === 'BARBACA')) {
    const c = caixa(m, b);
    expect(c.min[1]).toBeCloseTo(-50, 6);
    expect(c.min[2]).toBeGreaterThanOrEqual(r.num('h_fr') !== null ? (r.num('h_fr') as number) * 1000 - 1e-6 : 0);
  }
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
  it('"→" do comprimento só quando o digitado não é modular; o desenho segue 1 cm menor (a junta da ponta)', () => {
    const seta = (m: Modelo) => m.ajustes.find((a) => a.nome === 'L_total');
    // balanço, bloco 19: 6,00 = 30 células de 20 → sem seta, desenhado 5,99
    const b6 = gerarModelo(resultadoDoGabarito('aula122'), { L_total: 6 });
    expect(b6.familia.nome).toBe('19x39');
    expect(seta(b6)).toBeUndefined();
    expect(b6.dims.L_real).toBe(5990);
    // 6,10 não fecha: vai a 31 células — a seta mostra o modular (6,20), o desenho tem 6,19
    const b61 = gerarModelo(resultadoDoGabarito('aula122'), { L_total: 6.1 });
    expect(seta(b61)).toEqual({ nome: 'L_total', de: 6.1, para: 6.2, unidade: 'm' });
    expect(b61.dims.L_real).toBe(6190);
    expect(seta(gerarModelo(resultadoDoGabarito('aula122'), { L_total: 6.2 }))).toBeUndefined();

    // contrafortes 14x39 (VAL123, vão 1,35 = 15 + 6·20): N vãos + o nó da ponta (15) fecha
    const c14 = resultadoDoGabarito('aula123');
    for (const [L, vaos] of [[2.85, 2], [5.55, 4]] as const) {
      const m = gerarModelo(c14, { L_total: L });
      expect(m.familia.nome).toBe('14x39');
      expect(seta(m), `14x39 ${L}`).toBeUndefined();
      expect(m.dims.contrafortes.length).toBe(vaos + 1);
      expect(m.dims.L_real).toBe(Math.round(L * 1000) - 10);
    }
    expect(seta(gerarModelo(c14, { L_total: 6 }))).toEqual({ nome: 'L_total', de: 6, para: 5.55, unidade: 'm' });

    // contrafortes 19x39 (vão 1,60 = 20 + 7·20): 3 vãos + 20 = 5,00
    const c19 = trocar(c14, { t_bloco: 19, L_bloco: 39, eenr: 19, Ag_furo: 170, hf_bl: 3.5, l_cf: 1.6 });
    const m19 = gerarModelo(c19, { L_total: 5 });
    expect(m19.familia.nome).toBe('19x39');
    expect(seta(m19)).toBeUndefined();
    expect(m19.dims.L_real).toBe(4990);
    expect(seta(gerarModelo(c19, { L_total: 4.99 }))).toEqual({ nome: 'L_total', de: 4.99, para: 5, unidade: 'm' });

    // com junta de controle, digitar o valor da seta faz a seta sumir (o nº de trechos não muda com ele)
    const c19j = trocar(c14, { t_bloco: 19, L_bloco: 39, eenr: 19, Ag_furo: 170, hf_bl: 3.5, l_cf: 2 });
    const antes = seta(gerarModelo(c19j, { L_total: 5.9, junta_cada: 6 }))!;
    expect(antes.para).toBe(6.4);                                   // 2 trechos: 3 vãos de 2,00 + 2 nós de 20
    const depois = gerarModelo(c19j, { L_total: antes.para, junta_cada: 6 });
    expect(seta(depois)).toBeUndefined();
    expect(depois.dims.trechos.length).toBe(2);
  });
});

describe('canaleta cortada da 19: peça própria (Jose, 09/10)', () => {
  const r19 = trocar(resultadoDoGabarito('aula123'), { t_bloco: 19, L_bloco: 39, eenr: 19, Ag_furo: 170, hf_bl: 3.5 });
  // a seção da PEÇA COMPRADA (o envelope): a canaleta furada/quebrada na obra (09/10 noite) é a mesma peça do catálogo
  const secao = (m: Modelo, p: Peca): number => Math.abs(areaPoligono(m.geometrias[p.geometria].perfil.contorno));
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
    for (const g of m.pecas.filter((p) => p.tipo === 'GRAUTE_CANALETA' && p.grupo === 'contraforte' && p.id.endsWith('.gc'))) {
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

// ── peça atravessando peça (revisão do IFC com o muro real, 09/10 noite) ─────

type Solido = { p: Peca; g: Modelo['geometrias'][string]; c: Caixa };

/** As peças de um conjunto de tipos, ordenadas pelo x mínimo, e quem pode conter um ponto (busca binária). */
function indice(m: Modelo, tipos: ReadonlySet<TipoPeca>): (P: Vec3) => Solido[] {
  const sol: Solido[] = m.pecas.filter((p) => tipos.has(p.tipo)).map((p) => ({ p, g: m.geometrias[p.geometria], c: caixa(m, p) }));
  sol.sort((a, b) => a.c.min[0] - b.c.min[0]);
  const largura = Math.max(0, ...sol.map((s) => s.c.max[0] - s.c.min[0]));
  return (P) => {
    let lo = 0;
    let hi = sol.length;
    while (lo < hi) {
      const k = (lo + hi) >> 1;
      if (sol[k].c.min[0] <= P[0]) lo = k + 1;
      else hi = k;
    }
    const out: Solido[] = [];
    for (let k = lo - 1; k >= 0 && sol[k].c.min[0] >= P[0] - largura - 1; k--) {
      const c = sol[k].c;
      if (P[0] <= c.max[0] && P[1] >= c.min[1] && P[1] <= c.max[1] && P[2] >= c.min[2] && P[2] <= c.max[2]) out.push(sol[k]);
    }
    return out;
  };
}

/** Peças sólidas onde barra não entra: a alvenaria e a drenagem. A sapata é concreto armado (a armadura dela e o pé
 *  da espera moram nela) e o terreno é só para ver. */
const SEM_BARRA = new Set<TipoPeca>([...ALVENARIA, 'DRENO', 'AREIA', 'MANTA', 'BARBACA', 'TUBO_DRENO']);

/**
 * Nenhuma barra atravessa peça sólida que não seja graute. Amostra a cada 5 mm no eixo de cada barra: o ponto do eixo
 * e 4 na superfície (raio − 0,5 mm), contra o sólido de cada peça pelo perfil, furos e pedaços (profundidadeNaPeca;
 * mais de 0,5 mm para dentro = atravessa). Pegava, antes de 09/10 noite, a barra vertical no fundo da canaleta e a barra
 * em L do contraforte na parede do U do muro.
 */
function barrasEmPecaSolida(m: Modelo): string[] {
  const perto = indice(m, SEM_BARRA);
  const out = new Set<string>();
  for (const b of m.barras) {
    const R = b.diametro / 2 - 0.5;
    const e = b.fechada ? [...b.eixo, b.eixo[0]] : b.eixo;
    for (let k = 0; k + 1 < e.length; k++) {
      const [a, c] = [e[k], e[k + 1]];
      const d: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const L = Math.hypot(...d);
      if (L < 1e-9) continue;
      const u = d.map((x) => x / L) as Vec3;
      const q: Vec3 = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const cr = (x: Vec3, y: Vec3): Vec3 => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
      const n1 = cr(u, q);
      const l1 = Math.hypot(...n1);
      const e1 = n1.map((x) => x / l1) as Vec3;
      const e2 = cr(u, e1);
      const n = Math.max(1, Math.ceil(L / 5));
      for (let j = 0; j <= n; j++) {
        const P0: Vec3 = [a[0] + (d[0] * j) / n, a[1] + (d[1] * j) / n, a[2] + (d[2] * j) / n];
        for (const [s1, s2] of [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]]) {
          const P: Vec3 = [P0[0] + s1 * e1[0] + s2 * e2[0], P0[1] + s1 * e1[1] + s2 * e2[1], P0[2] + s1 * e1[2] + s2 * e2[2]];
          for (const s of perto(P)) if (profundidadeNaPeca(s.p, s.g, P) > 0.5) out.add(`${b.id} × ${s.p.id}`);
        }
      }
    }
  }
  return [...out].sort();
}

/**
 * O graute das canaletas (miolo do muro, da haste, o T e o do furo do fundo) não entra em bloco nem em canaleta:
 * amostra no meio da caixa de cada um e nos pontos a 1/4 dela (o miolo em U tem cantos arredondados — a caixa toda não
 * serve). O graute de furo de bloco já é conferido pela área do furo da peça.
 */
function grauteEmPecaSolida(m: Modelo): string[] {
  const perto = indice(m, ALVENARIA);
  const out: string[] = [];
  for (const p of m.pecas) {
    if (p.tipo !== 'GRAUTE_CANALETA' && !(p.tipo === 'GRAUTE_FURO' && m.geometrias[p.geometria].perfil.contorno.length === 4)) continue;
    const c = caixa(m, p);
    const em = (f: number, k: number): number => c.min[k] + f * (c.max[k] - c.min[k]);
    for (const [fx, fy, fz] of [[0.5, 0.5, 0.5], [0.25, 0.5, 0.5], [0.75, 0.5, 0.5], [0.5, 0.25, 0.75], [0.5, 0.75, 0.75]]) {
      const P: Vec3 = [em(fx, 0), em(fy, 1), em(fz, 2)];
      const s = perto(P).find((q) => profundidadeNaPeca(q.p, q.g, P) > 0.5);
      if (s) {
        out.push(`${p.id} × ${s.p.id}`);
        break;
      }
    }
  }
  return out;
}

/**
 * Graute da canaleta do contraforte contínuo (09/10 noite): em cada fiada de canaleta, do miolo do muro até a ponta da
 * haste, sem fresta — pelas juntas de 10 mm entre as canaletas da haste e pela junta muro × haste (o T).
 */
function hasteSemFresta(m: Modelo): string[] {
  const out: string[] = [];
  const t = m.familia.t;
  m.dims.contrafortes.forEach((cf, k) => {
    const pecasCf = m.pecas.filter((p) => p.contraforte === k + 1);
    const fiadas = [...new Set(pecasCf.filter((p) => CANALETAS.has(p.tipo)).map((p) => p.fiada!))];
    for (const i of fiadas) {
      const can = pecasCf.filter((p) => CANALETAS.has(p.tipo) && p.fiada === i).map((p) => caixa(m, p));
      const enterrado = can.some((c) => c.max[1] > t + 0.5);
      const ponta = enterrado ? Math.max(...can.map((c) => c.max[1])) : Math.min(...can.map((c) => c.min[1]));
      const g = pecasCf.filter((p) => p.tipo === 'GRAUTE_CANALETA' && p.fiada === i).map((p) => caixa(m, p))
        .filter((c) => c.min[0] <= cf.x && c.max[0] >= cf.x)
        .map((c) => (enterrado ? [c.min[1], c.max[1]] : [-c.max[1], -c.min[1]]) as [number, number])
        .sort((a, b) => a[0] - b[0]);
      if (!g.length) {
        out.push(`C${k + 1} fiada ${i}: sem graute`);
        continue;
      }
      for (let j = 1; j < g.length; j++) if (Math.abs(g[j][0] - g[j - 1][1]) > 1e-6) out.push(`C${k + 1} fiada ${i}: fresta de ${g[j - 1][1]} a ${g[j][0]}`);
      // começa dentro da parede do muro (o T), termina na ponta da haste
      const ini = enterrado ? t - 25 : -25;
      if (g[0][0] > ini) out.push(`C${k + 1} fiada ${i}: o graute começa em ${g[0][0]} (o T não chega no miolo do muro)`);
      if (Math.abs(g[g.length - 1][1] - (enterrado ? ponta : -ponta)) > 1e-6) out.push(`C${k + 1} fiada ${i}: o graute não chega na ponta`);
    }
  });
  return out;
}

/** O muro com as canaletas inteiras de antes (sem furo nem quebra) — para provar que as conferências têm dente. */
function semRecortes(m: Modelo): Modelo {
  const geometrias = Object.fromEntries(Object.entries(m.geometrias).map(([k, g]) => {
    if (!g.pedacos) return [k, g];
    const { pedacos: _, ...resto } = g;
    void _;
    return [k, resto];
  }));
  return { ...m, geometrias };
}

describe('canaleta como a obra deixa: fundo furado onde sobe a barra, T de graute no contraforte (09/10 noite)', () => {
  // os muros da revisão do IFC: balanço 19 (aula 12.2), contrafortes 14 enterrado (VAL123), 19 enterrado (sorteio17)
  // e 14 aparente todo em canaleta (sorteio23)
  const MUROS = ['aula122', 'aula123', 'sorteio17', 'sorteio23'];
  for (const c of MUROS) {
    it(`${c}: nenhuma barra atravessa bloco, canaleta ou drenagem; graute fora da alvenaria; haste sem fresta`, () => {
      const r = resultadoDoGabarito(c);
      for (const extras of [padroesDoModelo(), { ...padroesDoModelo(), L_total: 20, junta_cada: 6 }]) {
        const m = gerarModelo(r, extras);
        expect(barrasEmPecaSolida(m), c).toEqual([]);
        expect(grauteEmPecaSolida(m), c).toEqual([]);
        expect(hasteSemFresta(m), c).toEqual([]);
      }
    }, 60_000);
  }

  // estribo com a forma do Pró-Viga (ganchos de 135° e volta em espiral, 15/10) no contraforte e na sapata: Ø16 em
  // sapata de 20 e 30 cm com torção (sorteio01; sorteio31, torção a cada 5 cm), torção a cada 3 cm (sorteio14); e o
  // desenho de antes (Reta) com o arranque em nó de cachorro (o nó desenhado no balanço e no contraforte das aulas)
  it('estribos de gancho, sapata em estribos e nó de cachorro: nenhuma barra atravessa peça sólida', () => {
    for (const c of ['aula122', 'aula123', 'sorteio01', 'sorteio14', 'sorteio31']) {
      const r = resultadoDoGabarito(c);
      for (const [no, extras] of [[false, padroesDoModelo()], [true, { ...padroesDoModelo(), sap_transv: 'Reta', arranque: 'Nó de cachorro' }]] as const) {
        const m = gerarModelo(r, extras);
        if (!no) expect(m.barras.some((b) => b.estribo), c).toBe(true);
        if (no && c.startsWith('aula')) expect(m.barras.filter((b) => b.papel === 'ESPERA').length, c).toBe(m.barras.filter((b) => VERTICAIS.has(b.papel) && b.papel !== 'ESPERA').length);
        expect(barrasEmPecaSolida(m), c).toEqual([]);
      }
    }
  }, 120_000);

  it('as conferências têm dente: com as canaletas inteiras, a barra vertical fura o fundo e a barra em L a parede do muro', () => {
    const m = gerarModelo(resultadoDoGabarito('aula123'), padroesDoModelo());
    const achados = barrasEmPecaSolida(semRecortes(m));
    expect(achados.some((a) => /\.V\.\d+ × T1\.M\.f\d+/.test(a)), 'vertical × fundo').toBe(true);
    expect(achados.some((a) => /\.CF\d+\.H\.f\d+ × T1\.M\.f\d+/.test(a)), 'barra em L × parede').toBe(true);
    expect(grauteEmPecaSolida(semRecortes(m)).some((a) => a.includes('.gT')), 'graute do T × parede').toBe(true);
  });

  it('a canaleta furada é a mesma peça comprada: catálogo, classe e caixa do envelope; volume = o que sobra', () => {
    const m = gerarModelo(resultadoDoGabarito('aula123'), padroesDoModelo());
    const recortadas = m.pecas.filter((p) => m.geometrias[p.geometria].pedacos);
    expect(recortadas.length).toBeGreaterThan(0);
    for (const p of recortadas) {
      const g = m.geometrias[p.geometria];
      const inteira = Object.values(m.geometrias).find((q) => !q.pedacos && q.catalogo === g.catalogo) ?? null;
      expect(g.classe).toBe('canaleta');
      expect(CANALETAS.has(p.tipo)).toBe(true);
      const env = Math.abs(areaPoligono(g.perfil.contorno)) * g.extensao;
      expect(g.volume_mm3).toBeLessThan(env);
      expect(g.volume_mm3).toBeGreaterThan(0.5 * env);   // a cortada curta com furo e parede quebrada fica com ~64 %
      for (const q of g.pedacos!) {
        expect(areaPoligono(q.contorno), `${p.geometria}: pedaço anti-horário`).toBeGreaterThan(0);
        expect(q.de >= 0 && q.ate <= g.extensao && q.ate > q.de).toBe(true);
      }
      if (inteira) expect(inteira.perfil.contorno).toEqual(g.perfil.contorno);
    }
    // canaletas furadas no mesmo lugar dividem a geometria (IfcMappedItem / InstancedMesh)
    expect(new Set(recortadas.map((p) => p.geometria)).size).toBeLessThan(recortadas.length);
  });

  it('T: em cada fiada de canaleta e cada contraforte, a parede do muro quebrada na largura do canal até o fundo', () => {
    for (const c of ['aula123', 'sorteio17', 'sorteio23']) {
      const m = gerarModelo(resultadoDoGabarito(c), padroesDoModelo());
      const t = m.familia.t;
      const parede = CATALOGO[m.familia.nome].canaleta.parede;
      const fiadasC = [...new Set(m.pecas.filter((p) => p.grupo === 'muro' && CANALETAS.has(p.tipo)).map((p) => p.fiada!))];
      const enterrado = m.pecas.some((p) => p.grupo === 'contraforte' && caixa(m, p).max[1] > t + 0.5);
      for (const cf of m.dims.contrafortes) {
        for (const i of fiadasC) {
          // no meio do canal, na altura do meio da parede: vazio (graute do T), e nas paredes do canal ao lado: cheio
          const y = enterrado ? t - parede / 2 : parede / 2;
          const z = i * 200 + 10 + 100;
          const muro = m.pecas.filter((p) => p.grupo === 'muro' && p.fiada === i && CANALETAS.has(p.tipo));
          const dentro = (x: number) => muro.some((p) => profundidadeNaPeca(p, m.geometrias[p.geometria], [x, y, z]) > 0);
          expect(dentro(cf.x), `${c} C(${cf.x}) fiada ${i}: parede quebrada`).toBe(false);
          const fora = t / 2 + 5;
          if (cf.x - fora > 0 && cf.x + fora < m.dims.L_real) expect(dentro(cf.x - fora) && dentro(cf.x + fora), `${c} fiada ${i}: parede fora do canal`).toBe(true);
          expect(m.pecas.some((p) => p.tipo === 'GRAUTE_CANALETA' && p.fiada === i && p.id.includes('.gT') && caixa(m, p).min[0] <= cf.x && caixa(m, p).max[0] >= cf.x), `${c} fiada ${i}: graute do T`).toBe(true);
        }
      }
    }
  });

  it('dreno (Jose, 14/10): brita em degrau com o tubo no meio da envoltória, areia e manta por fora, barbacã 5 cm para fora e acima do solo da frente', () => {
    const r = resultadoDoGabarito('aula122');
    const m = gerarModelo(r, { ...padroesDoModelo(), L_total: 3 });
    const so = (tp: TipoPeca) => m.pecas.filter((p) => p.tipo === tp);
    const t = m.familia.t;
    const [brita] = so('DRENO');
    const g = m.geometrias[brita.geometria];
    // degrau: envoltória 300 × 300 no pé e a camada de 200 subindo; o furo do tubo Ø100 no centro da envoltória
    expect(g.perfil.contorno.map(([u, v]) => [Math.round(u), Math.round(v)])).toEqual([[0, 0], [300, 0], [300, 300], [200, 300], [200, m.dims.H_solo - 300 - 102], [0, m.dims.H_solo - 300 - 102]]);
    expect(g.perfil.furos).toHaveLength(1);
    const [tubo] = so('TUBO_DRENO');
    expect(caixa(m, tubo).min[1]).toBeCloseTo(t + 100, 6);
    expect(caixa(m, tubo).min[2]).toBeCloseTo(100, 6);
    // areia de 10 cm e manta por fora: o topo do pacote fica a dreno_folga do topo do solo
    expect(Math.max(...so('MANTA').map((p) => caixa(m, p).max[2]))).toBeCloseTo(m.dims.H_solo - 300, 6);
    expect(Math.max(...so('AREIA').map((p) => caixa(m, p).max[1]))).toBeCloseTo(t + 400, 6);
    // o aterro não invade o pacote: começa na manta
    const at = so('ATERRO').map((p) => caixa(m, p));
    expect(at.every((c) => c.min[1] <= t + 402 + 1e-6)).toBe(true);
    // barbacã: 1ª fiada, 5 cm para fora da face e 5 cm para dentro da brita
    for (const b of so('BARBACA')) {
      expect(caixa(m, b).min[1]).toBeCloseTo(-50, 6);
      expect(caixa(m, b).max[1]).toBeCloseTo(t + 50, 6);
      expect(b.fiada).toBe(0);
    }
    // aterro sobre a ponta de 50 cm: a 1ª fiada com o tubo todo acima dele é a 3 (610 + 95 − 25 ≥ 500), mas ela é
    // canaleta nesta aula (h_pan 0,80): o barbacã sobe para a 4
    const m2 = gerarModelo(trocar(r, { h_fr: 0.5 }), { ...padroesDoModelo(), L_total: 3 });
    const bbs = m2.pecas.filter((p) => p.tipo === 'BARBACA');
    expect(bbs.length).toBeGreaterThan(0);
    for (const b of bbs) {
      expect(b.fiada).toBe(4);
      expect(caixa(m2, b).min[2]).toBeGreaterThanOrEqual(500);
    }
    expect(m2.avisos.map((a) => a.codigo)).not.toContain('BARBACA_SEM_CELULA');
    // e o solo da frente sobe sobre a ponta até a face do muro
    expect(Math.max(...m2.pecas.filter((p) => p.tipo === 'SOLO_FRENTE').map((p) => caixa(m2, p).max[2]))).toBeCloseTo(500, 6);
    // dreno de fundo desligado: a brita volta a ser a camada reta, sem tubo
    const m3 = gerarModelo(r, { ...padroesDoModelo(), L_total: 3, drenof_on: 'Não' });
    expect(m3.pecas.some((p) => p.tipo === 'TUBO_DRENO')).toBe(false);
    expect(m3.geometrias[m3.pecas.find((p) => p.tipo === 'DRENO')!.geometria].perfil.contorno).toHaveLength(4);
  });

  it('contraforte enterrado: cada vão com o seu dreno e pelo menos um barbacã (Jose, 14/10: não fura o contraforte)', () => {
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      const m = gerarModelo(r, { ...padroesDoModelo(), L_total: 12 });
      const t = m.familia.t;
      const enterrado = m.pecas.some((p) => p.grupo === 'contraforte' && caixa(m, p).max[1] > t + 0.5);
      if (!enterrado || m.avisos.some((a) => a.codigo === 'BARBACA_SEM_CELULA')) continue;
      const drenos = m.pecas.filter((p) => p.tipo === 'DRENO').map((p) => caixa(m, p));
      const bbs = m.pecas.filter((p) => p.tipo === 'BARBACA').map((p) => caixa(m, p));
      expect(drenos.length, c).toBeGreaterThan(1);
      for (const d of drenos) {
        expect(bbs.some((b) => b.min[0] >= d.min[0] - 1e-6 && b.max[0] <= d.max[0] + 1e-6), `${c}: vão ${d.min[0]}–${d.max[0]} sem barbacã`).toBe(true);
      }
      // nenhum pedaço do dreno (brita, areia, manta, tubo) entra no contraforte
      const cfs = m.pecas.filter((p) => p.grupo === 'contraforte').map((p) => caixa(m, p));
      for (const p of m.pecas.filter((q) => ['DRENO', 'AREIA', 'MANTA', 'TUBO_DRENO'].includes(q.tipo))) {
        const k = caixa(m, p);
        for (const f of cfs) {
          const cruza = k.min[0] < f.max[0] - 0.5 && k.max[0] > f.min[0] + 0.5 && k.min[1] < f.max[1] - 0.5 && k.max[1] > f.min[1] + 0.5 && k.min[2] < f.max[2] - 0.5 && k.max[2] > f.min[2] + 0.5;
          expect(cruza, `${c}: ${p.id} dentro do contraforte`).toBe(false);
        }
      }
    }
  }, 120_000);

  it('barbacã: muro todo em canaleta fura a canaleta, no alto do U e acima da barra; nunca numa célula com barra', () => {
    // Jose, 15/10: "muro sem barbacã é pior que canaleta furada" — antes não desenhava e avisava
    const m23 = gerarModelo(resultadoDoGabarito('sorteio23'), padroesDoModelo());
    const bbs = m23.pecas.filter((p) => p.tipo === 'BARBACA');
    expect(bbs.length).toBeGreaterThan(0);
    expect(m23.avisos.map((a) => a.codigo)).not.toContain('BARBACA_SEM_CELULA');
    expect(barrasEmPecaSolida(m23)).toEqual([]);
    for (const b of bbs) {
      const k = caixa(m23, b);
      const base = b.fiada! * 200;
      // dentro da altura da canaleta (junta de 10 + bloco de 190), 2 cm abaixo da borda
      expect(k.max[2]).toBeCloseTo(base + 10 + 190 - 20, 6);
      // acima de toda barra deitada da fiada
      for (const br of m23.barras.filter((x) => x.trecho === b.trecho)) {
        for (let i = 0; i + 1 < br.eixo.length; i++) {
          const [a, c] = [br.eixo[i], br.eixo[i + 1]];
          if (Math.abs(a[2] - c[2]) < 1e-6 && a[2] >= base && a[2] <= base + 200) expect(k.min[2]).toBeGreaterThan(a[2] + br.diametro / 2);
        }
      }
    }
    const m22 = gerarModelo(resultadoDoGabarito('aula122'), padroesDoModelo());
    expect(m22.pecas.filter((p) => p.tipo === 'BARBACA').length).toBeGreaterThan(0);
    expect(m22.avisos.map((a) => a.codigo)).not.toContain('BARBACA_SEM_CELULA');
    // graute total: o tubo vai antes do graute, mas fora das células com barra (barrasEmPecaSolida pega o tubo × barra)
    const total = gerarModelo(trocar(resultadoDoGabarito('aula122'), { Graute: 20, gr_tot: 'Sim' }), padroesDoModelo());
    expect(total.pecas.filter((p) => p.tipo === 'BARBACA').length).toBeGreaterThan(0);
    expect(barrasEmPecaSolida(total)).toEqual([]);
  });
});

describe('aterro encostado no muro acima do dreno (Jose, 15/10: "triângulo perto do topo")', () => {
  it('entre o topo do pacote do dreno e o topo do solo, a terra vai até a face do muro — sem vão', () => {
    const dentro = ([x, y]: [number, number], poli: [number, number][]) => {
      let d = false;
      for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
        const [xi, yi] = poli[i], [xj, yj] = poli[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
      }
      return d;
    };
    for (const c of ['aula122', 'aula123', 'sorteio17']) {
      const m = gerarModelo(resultadoDoGabarito(c), padroesDoModelo());
      const t = m.familia.t;
      const topoDoPacote = Math.max(...m.pecas.filter((p) => p.tipo === 'MANTA').map((p) => caixa(m, p).max[2]));
      for (const a of m.pecas.filter((p) => p.tipo === 'ATERRO')) {
        const g = m.geometrias[a.geometria];
        const poli = g.perfil.contorno.map(([u, v]) => [u + a.origem[1], v + a.origem[2]] as [number, number]);
        // logo acima do pacote, encostado no muro, e a meio caminho até o topo do solo
        for (const z of [topoDoPacote + 5, (topoDoPacote + m.dims.H_solo) / 2]) {
          if (z >= m.dims.H_solo) continue;
          expect(dentro([t + 5, z], poli), `${c} ${a.id} z=${z}`).toBe(true);
        }
      }
    }
  });
});

describe('barbacã nunca acima do aterro', () => {
  it('nem pela canaleta nem pela 1ª fiada acima do solo da frente: o tubo inteiro fica abaixo da altura de solo', () => {
    // os cenários em que o solo da frente fica alto perto do topo do aterro (revisão de 15/10)
    for (const c of ['sorteio07', 'sorteio10', 'sorteio11', 'sorteio18', 'sorteio28', 'sorteio34', 'sorteio23', 'aula122']) {
      const m = gerarModelo(resultadoDoGabarito(c), padroesDoModelo());
      for (const b of m.pecas.filter((p) => p.tipo === 'BARBACA')) expect(caixa(m, b).max[2], `${c} ${b.id}`).toBeLessThanOrEqual(m.dims.H_solo + 1e-6);
    }
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
        // a seta compara com o MODULAR (desenhado + a junta da ponta) e mostra ele; digitado de volta, ela some
        const modular = m.dims.L_real + 10;
        const aj = m.ajustes.find((a) => a.nome === 'L_total');
        if (Math.abs(Lt - modular / 1000) > 1e-6) {
          expect(aj, nome).toEqual({ nome: 'L_total', de: Lt, para: Math.round(modular / 10) / 100, unidade: 'm' });
          const deNovo = gerarModelo(r, { L_total: aj!.para });
          expect(deNovo.ajustes.find((a) => a.nome === 'L_total'), `${nome} → ${aj!.para}`).toBeUndefined();
          expect(deNovo.dims.L_real, `${nome} → ${aj!.para}`).toBe(m.dims.L_real);
        } else {
          expect(aj, nome).toBeUndefined();
        }
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

describe('grade do graute da parede (Jose, 13/10: graute a cada X)', () => {
  // fração dos furos grauteados nos blocos da parede, fora das fiadas de canaleta — a m/X da conta (peso, f_furo)
  const fracao = (m: Modelo) => {
    let furos = 0;
    let grauteados = 0;
    for (const p of m.pecas) {
      if (p.grupo !== 'muro' || (p.tipo !== 'BLOCO' && p.tipo !== 'MEIO_BLOCO')) continue;
      furos += m.geometrias[p.geometria].perfil.furos?.length ?? 0;
      grauteados += p.furosGrauteados?.length ?? 0;
    }
    return grauteados / furos;
  };
  const r = resultadoDoGabarito('aula122');
  it('aula 12.2 (graute a cada 40, barras a 40): metade dos furos — a mesma fração da conta', () => {
    expect(r.num('Graute')).toBe(40);
    expect(fracao(gerarModelo(r, { L_total: 6 }))).toBeCloseTo(r.num('f_furo') ?? 0, 1);
  });
  it('a cada 80 com barras a 80: um quarto; a cada 20 (todos): tudo', () => {
    const a80 = gerarModelo(trocar(r, { Graute: 80, s_adot: 80, gr_tot: 'Não' }), { L_total: 6 });
    expect(fracao(a80)).toBeCloseTo(0.25, 1);
    expect(barrasForaDoGraute(a80)).toEqual([]);
    const todos = gerarModelo(trocar(r, { Graute: 20, gr_tot: 'Sim' }), { L_total: 6 });
    expect(fracao(todos)).toBe(1);
  });
  it('graute a cada 40 com barras a 80: o furo do meio entre as barras também leva graute', () => {
    const m = gerarModelo(trocar(r, { Graute: 40, s_adot: 80 }), { L_total: 6 });
    expect(fracao(m)).toBeCloseTo(0.5, 1);
    expect(barrasForaDoGraute(m)).toEqual([]);
  });
});

describe('estribo do contraforte só quando a conta pede (Jose, 13/10; planilha 05 do Carini)', () => {
  const estribos = (m: Modelo) => m.barras.filter((b) => b.papel === 'CF_ESTRIBO').length;
  const contrafortes = cenariosDoGabarito().filter((c) => {
    const r = resultadoDoGabarito(c);
    return String(r.v('Tipo_muro') ?? '').startsWith('Contra');
  });
  it(`há cenários com contrafortes nos dois lados da regra (${contrafortes.length})`, () => {
    const asw = contrafortes.map((c) => resultadoDoGabarito(c).num('Asw_c'));
    expect(asw.some((a) => a === 0), 'algum dispensa').toBe(true);
    expect(asw.some((a) => a !== null && a > 0), 'algum pede').toBe(true);
  });
  for (const c of contrafortes) {
    it(c, () => {
      const r = resultadoDoGabarito(c);
      const m = gerarModelo(r, { L_total: 6 });
      if (r.num('Asw_c') === 0) {
        expect(estribos(m)).toBe(0);
        expect(m.avisos.map((a) => a.codigo).filter((k) => k.includes('ESTRIBO'))).toEqual([]);
      } else {
        expect(estribos(m)).toBeGreaterThan(0);
      }
    }, 60_000);
  }
  it('a regra tem dente: o mesmo muro com Asw/s = 0 perde os estribos, e com Asw/s > 0 os ganha', () => {
    const r = resultadoDoGabarito('aula123');
    expect(estribos(gerarModelo(trocar(r, { Asw_c: 0 }), { L_total: 3 }))).toBe(0);
    expect(estribos(gerarModelo(trocar(r, { Asw_c: 1 }), { L_total: 3 }))).toBe(3 * 13);
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
