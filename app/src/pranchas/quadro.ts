/*
  O QUADRO LATERAL PREENCHIDO SOZINHO (Jose, 14/10: "preenchido e editável") — notas gerais tiradas da conta, a
  legenda das cores dos blocos e o resumo do aço por bitola.

  As notas só dizem o que a conta tem: material que a conta não respondeu ("—", vazio) não vira nota com número
  inventado — a linha simplesmente não sai. O projetista edita a lista na tela e, a partir daí, a lista é dele
  (Folha.quadro.notas deixa de ser null e não acompanha mais a conta).
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

/** As notas gerais que a conta sustenta, na ordem de uma prancha de alvenaria. */
export function notasAutomaticas(r: Resultado | null, m: Modelo | null): string[] {
  const R = leitor(r);
  const notas: string[] = ['Cotas em centímetros, exceto onde indicado.'];
  const t = R.num('t_bloco');
  const fbk = R.num('fbk_');
  if (fbk !== null) notas.push(`Blocos de concreto${t !== null ? ` ${br(t)}×39` : ''}, fbk ≥ ${br(fbk, fbk % 1 ? 1 : 0)} MPa.`);
  const fgk = R.num('fgk_');
  const gr = R.num('Graute');
  if (fgk !== null) {
    const onde = gr === null ? '' : gr <= 20 ? ', em todos os furos' : `, nos furos com armadura e a cada ${br(gr)} cm`;
    notas.push(`Graute fgk ≥ ${br(fgk, fgk % 1 ? 1 : 0)} MPa${onde}.`);
  }
  const arg = R.txt('arg_cls');
  if (arg) notas.push(`Argamassa de assentamento: ${arg}.`);
  const fyk = R.num('fyk_');
  if (fyk !== null) notas.push(fyk === 500 ? 'Aço CA-50.' : fyk === 600 ? 'Aço CA-60.' : `Aço fyk ${br(fyk)} MPa.`);
  const fck = R.txt('fck_fund');
  const cob = R.num('cob_sap');
  if (fck) notas.push(`Sapata em concreto ${fck}${cob !== null ? `, cobrimento ${br(cob, cob % 1 ? 1 : 0)} cm` : ''}.`);
  if (m) {
    const ex = m.extras ?? {};
    const sim = (k: string) => String(ex[k] ?? 'Sim').trim().toLowerCase().startsWith('s');
    const temBarbaca = m.pecas.some((p) => p.tipo === 'BARBACA');
    const temDreno = m.pecas.some((p) => p.tipo === 'DRENO');
    const temTubo = m.pecas.some((p) => p.tipo === 'TUBO_DRENO');
    if (temBarbaca) {
      const phi = Number(ex.barbaca_phi ?? 50);
      const s = Number(ex.barbaca_s ?? 1.5);
      notas.push(`Barbacãs Ø${br(phi)} mm a cada ${br(s, 2)} m, com caimento para fora.`);
    }
    if (temDreno || temTubo) {
      const partes = [temDreno ? 'brita' : null, Number(ex.areia_esp ?? 0.1) > 0 ? 'areia' : null, 'manta geotêxtil'].filter(Boolean);
      notas.push(`Dreno no tardoz em ${partes.join(', ')}${temTubo ? `; tubo perfurado Ø${br(Number(ex.drenof_phi ?? 100))} mm no pé` : ''}.`);
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

/** Resumo do aço por bitola (m e kg), o mesmo do quantitativo. */
export function quadroDeAco(m: Modelo | null): { linhas: LinhaDoAco[]; total: number } {
  if (!m) return { linhas: [], total: 0 };
  const resumo = resumoDoAco(listaDeFerros(m.barras).linhas);
  const linhas = resumo.map((r) => ({ bitola: `Ø${br(r.diametro, r.diametro % 1 ? 1 : 0)}`, comprimento: r.comprimento, massa: r.massa }));
  return { linhas, total: resumo.reduce((s, r) => s + r.massa, 0) };
}
