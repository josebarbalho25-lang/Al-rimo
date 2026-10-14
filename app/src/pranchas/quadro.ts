/*
  O QUADRO LATERAL PREENCHIDO SOZINHO (Jose, 14/10: "preenchido e editável") — notas gerais tiradas da conta, a
  legenda das cores dos blocos e o resumo do aço por bitola.

  As notas só dizem o que a conta e o muro desenhado sustentam: material que a conta não respondeu ("—", vazio) não
  vira nota com número inventado — a linha simplesmente não sai; e o que se lê do MODELO (barbacã, dreno) é o que
  está desenhado, não a entrada (o espaçamento do barbacã é o maior que de fato ficou entre dois deles). O
  projetista edita a lista na tela e, a partir daí, a lista é dele (Folha.quadro.notas deixa de ser null e não
  acompanha mais a conta).
*/
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { solidosDoModelo } from '@/desenhos/geometria';
import { tintasPresentes } from '@/desenhos/cores';
import { listaDeFerros, resumoDoAco } from '@/quantitativo/aco';

function leitor(r: Resultado | null) {
  const num = (nome: string): number | null => {
    try { return r ? r.num(nome) : null; } catch { return null; }
  };
  const txt = (nome: string): string | null => {
    try {
      const v = r ? r.v(nome) : null;
      if (typeof v === 'number') return String(v);
      return typeof v === 'string' && v.trim() !== '' && v !== '—' ? v.trim() : null;
    } catch { return null; }
  };
  return { num, txt };
}

const br = (x: number, casas = 0): string => x.toFixed(casas).replace('.', ',');
const brAuto = (x: number): string => br(x, x % 1 ? 1 : 0);

/** Os barbacãs desenhados: o maior afastamento entre dois vizinhos do mesmo trecho, mm (null = menos de dois). */
export function maiorAfastamentoDosBarbacas(m: Modelo): { n: number; maior: number | null } {
  const porTrecho = new Map<number, number[]>();
  for (const p of m.pecas) {
    if (p.tipo !== 'BARBACA') continue;
    const g = m.geometrias[p.geometria];
    // o barbacã vai deitado (giro 90): o diâmetro corre em X a partir da origem
    const d = g ? Math.max(...g.perfil.contorno.map((q) => q[0])) : 0;
    const xs = porTrecho.get(p.trecho) ?? [];
    xs.push(p.origem[0] + d / 2);
    porTrecho.set(p.trecho, xs);
  }
  let n = 0;
  let maior: number | null = null;
  for (const xs of porTrecho.values()) {
    n += xs.length;
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) maior = Math.max(maior ?? 0, xs[i] - xs[i - 1]);
  }
  return { n, maior };
}

/** As notas gerais que a conta e o muro desenhado sustentam, na ordem de uma prancha de alvenaria. */
export function notasAutomaticas(r: Resultado | null, m: Modelo | null): string[] {
  const R = leitor(r);
  const notas: string[] = ['Cotas em centímetros, exceto onde indicado.'];

  // premissas: as cargas para as quais o muro foi calculado (a prancha assinada leva a régua junto)
  const premissas: string[] = [];
  const q = R.num('q_sobre');
  if (q !== null) premissas.push(`sobrecarga q = ${br(q, 1)} kPa`);
  const gama = R.num('gama_solo');
  const phi = R.num('phi_solo');
  const ka = R.num('Ka_');
  const solo = [gama !== null ? `γ = ${br(gama, 1)} kN/m³` : null, phi !== null ? `φ' = ${brAuto(phi)}°` : null, ka !== null ? `Ka = ${br(ka, 3)}` : null].filter(Boolean);
  if (solo.length) premissas.push(`solo contido ${solo.join(', ')}`);
  const sadm = R.num('s_adm');
  if (sadm !== null) premissas.push(`σadm = ${br(sadm)} kPa`);
  if (premissas.length) notas.push(`Premissas de cálculo: ${premissas.join('; ')}.`);

  const t = R.num('t_bloco');
  const fbk = R.num('fbk_');
  if (fbk !== null) notas.push(`Blocos de concreto${t !== null ? ` ${br(t)}×39` : ''}, fbk ≥ ${brAuto(fbk)} MPa.`);

  const fgk = R.num('fgk_');
  if (fgk !== null) {
    // onde vai graute é o que o modelo grauteia: a grade da parede, as canaletas e o contraforte inteiro (Jose:
    // "o contraforte é sempre todo grauteado")
    const gr = R.num('Graute');
    const onde: string[] = [];
    if (gr !== null) onde.push(gr <= 20 ? 'em todos os furos da parede' : `na parede, nos furos com armadura e a cada ${br(gr)} cm`);
    if (m?.pecas.some((p) => p.tipo === 'GRAUTE_CANALETA')) onde.push('em todas as canaletas');
    if (m?.dims.contrafortes.length) onde.push('em todos os furos dos contrafortes');
    notas.push(`Graute fgk ≥ ${brAuto(fgk)} MPa${onde.length ? `: ${onde.join('; ')}` : ''}.`);
  }

  const arg = R.txt('arg_cls');
  if (arg) notas.push(`Argamassa de assentamento com resistência média à compressão de ${arg}.`);

  const fyk = R.num('fyk_');
  if (fyk !== null) {
    const temFio = !!m?.barras.some((b) => b.diametro <= 5.01);
    if (fyk === 500) notas.push(temFio ? 'Aço CA-50; Ø5,0 em CA-60.' : 'Aço CA-50.');
    else if (fyk === 600) notas.push('Aço CA-60.');
    else notas.push(`Aço fyk ${br(fyk)} MPa.`);
  }

  const fck = R.txt('fck_fund');
  const cob = R.num('cob_sap');
  if (fck) notas.push(`Sapata em concreto ${fck}${cob !== null ? `, cobrimento ${brAuto(cob)} cm` : ''}.`);

  // o solo da frente que a conta usou (passivo, aterro sobre a ponta) é condição da obra: vai escrito na prancha
  if (R.txt('pass_on') === 'Sim') {
    const hfr = R.num('h_fr');
    const aterro = hfr !== null && hfr > 0 ? ` e o aterro de ${br(hfr * 100)} cm sobre a ponta` : '';
    notas.push(`O cálculo considera o empuxo passivo do solo da frente${aterro}: esse solo não pode ser escavado nem removido durante a vida útil do muro.`);
  }

  if (m) {
    const ex = m.extras ?? {};
    const sim = (k: string) => String(ex[k] ?? 'Sim').trim().toLowerCase().startsWith('s');
    const bb = maiorAfastamentoDosBarbacas(m);
    if (bb.n > 0) {
      const phiB = Number(ex.barbaca_phi ?? 50);
      notas.push(
        bb.maior !== null
          ? `Barbacãs Ø${br(phiB)} mm, no máximo a ${br(bb.maior / 1000, 2)} m um do outro (posições na vista frontal).`
          : `Barbacã Ø${br(phiB)} mm (posição na vista frontal).`,
      );
    }
    const temAreia = m.pecas.some((p) => p.tipo === 'AREIA');
    const filtro = temAreia ? 'areia e manta geotêxtil' : 'manta geotêxtil';
    if (sim('dreno_on') && m.pecas.some((p) => p.tipo === 'DRENO')) notas.push(`Dreno no tardoz em brita, com ${filtro} do lado do solo.`);
    if (m.pecas.some((p) => p.tipo === 'TUBO_DRENO')) {
      notas.push(`Dreno de fundo: tubo perfurado Ø${br(Number(ex.drenof_phi ?? 100))} mm no pé do tardoz, envolto em brita, ${filtro}.`);
    }
    if (sim('imper_on')) notas.push('Impermeabilizar a face do tardoz antes do aterro.');
  }
  return notas;
}

export interface ItemDaLegenda { cor: string; rotulo: string }

/** A legenda das cores dos blocos (as do Revit do Jose), só com os tipos que o muro tem. */
export function legendaDasCores(m: Modelo | null): ItemDaLegenda[] {
  if (!m) return [];
  return tintasPresentes(solidosDoModelo(m)).map((t) => ({ cor: t.cor, rotulo: t.nome }));
}

export interface LinhaDoAco { bitola: string; comprimento: number; massa: number }

/**
 * Resumo do aço por bitola (m e kg), o mesmo do quantitativo, com a categoria de cada bitola: Ø5,0 é fio CA-60
 * (a barra CA-50 começa no 6,3); com fyk 600 na conta, tudo CA-60. A massa vai arredondada a 0,1 kg e o total é a
 * soma das linhas JÁ arredondadas — total que não fecha com as linhas impressas vira desconfiança na obra.
 */
export function quadroDeAco(m: Modelo | null, r: Resultado | null = null): { linhas: LinhaDoAco[]; total: number } {
  if (!m) return { linhas: [], total: 0 };
  const fyk = leitor(r).num('fyk_');
  const resumo = resumoDoAco(listaDeFerros(m.barras).linhas);
  const linhas = resumo.map((x) => {
    const cat = fyk === 600 || x.diametro <= 5.01 ? 'CA-60' : fyk === null || fyk === 500 ? 'CA-50' : `fyk ${br(fyk)}`;
    return {
      bitola: `Ø${br(x.diametro, x.diametro % 1 ? 1 : 0)} ${cat}`,
      comprimento: Math.round(x.comprimento * 10) / 10,
      massa: Math.round(x.massa * 10) / 10,
    };
  });
  return { linhas, total: Math.round(linhas.reduce((s, l) => s + l.massa, 0) * 10) / 10 };
}
