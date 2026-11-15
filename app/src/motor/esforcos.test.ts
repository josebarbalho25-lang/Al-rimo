/*
  ESFORÇOS AO LONGO DA PEÇA E MOMENTO RESISTENTE (planilha, 15/11 — 1ª metade da etapa 1b do PLANO_OBRA).

  A planilha passou a publicar M e V nó a nó (perfil do solo, vento, pilarete, ponta e talão da sapata) e o MRd de
  cada peça com o aço adotado. Duas promessas que a vista "Esforços" vai usar sem refazer conta:
    1. o ÚLTIMO nó de cada diagrama é o total que a aba já usava (Vk_, Mk_, Mk_w, Md_cf, Mk_toe…) — mesma soma,
       mesma ordem: igual a 1e-9 (no Excel, bit a bit);
    2. MRd ≥ MSd quando, e só quando, as verificações de resistência da aba dizem OK (a seção resiste, x/d e
       As,ef ≥ As do momento — o As,mín é verificação à parte, não resistência).
  Roda pelo motor (calcular), em todos os cenários do gabarito do Excel.
*/
import { describe, expect, it } from 'vitest';
import dados from './planilha.gerada.json';
import { carregarGabarito } from './excel/gabarito_prova';
import { calcular } from './index';
import type { PlanilhaExportada, Resultado } from './tipos';

const P = dados as unknown as PlanilhaExportada;
const cenarios = carregarGabarito();

/** Célula da ponta de um intervalo nomeado de uma coluna ('Aba!O44:O84'): a de cima (0) ou a de baixo (-1). */
function ponta(nome: string, qual: 0 | -1): string {
  const m = /^(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(P.nomes[nome] ?? '');
  if (!m) throw new Error(`intervalo nomeado inexistente: ${nome}`);
  return `${m[1]}!${m[2]}${qual === 0 ? m[3] : m[5]}`;
}
const num = (r: Resultado, ref: string): number | null => {
  const v = r.cel(ref);
  return typeof v === 'number' ? v : null;
};
const ok = (r: Resultado, nome: string) => String(r.v(nome)).startsWith('OK');

describe('esforços ao longo da peça', () => {
  it('o último nó de cada diagrama é o total que a aba já usava', () => {
    const PARES: [string, 0 | -1, string][] = [
      ['perf_V', -1, 'Vk_'], ['perf_M', -1, 'Mk_'], ['perf_Mw', -1, 'Mk_w'], ['perf_Mwc', -1, 'Mk_wcf'],
      ['perf_Mwo', -1, 'Mk_wcfo'], ['perf_Vd', -1, 'Vsd_'], ['perf_Mdc', -1, 'Md_cf'], ['perf_Vdc', -1, 'Vd_cf'],
      ['perf_Mdo', -1, 'Md_cfo'], ['perf_Vdo', -1, 'Vd_cfo'], ['vt_Mw', -1, 'Mk_w'], ['vt_Vw', -1, 'Vk_w'],
      ['vt_Mc', -1, 'Mk_wcf'], ['vt_Vc', -1, 'Vk_wcf'], ['vt_Mo', -1, 'Mk_wcfo'], ['pt_Mk', -1, 'Mk_pil'],
      ['pt_Vk', -1, 'Vk_pil'], ['pt_Md', -1, 'Md_pil'], ['T_Mk', 0, 'Mk_toe'], ['H_Mk', -1, 'Mk_heel'],
    ];
    const difs: string[] = [];
    let conferidos = 0;
    for (const g of cenarios) {
      const r = calcular(g.alterado);
      const pares: [string, number | null, number | null][] = PARES.map(([n, q, total]) => [`${n} × ${total}`, num(r, ponta(n, q)), r.num(total)]);
      const md = num(r, ponta('perf_Md', -1));
      pares.push(['perf_Md + M2d_us × Md_', md === null || r.num('M2d_us') === null ? null : md + (r.num('M2d_us') as number), r.num('Md_')]);
      pares.push(['Md_dec × Md_', r.num('Md_dec'), r.num('Md_')]);
      for (const [rot, a, b] of pares) {
        if (a === null && b === null) continue;
        conferidos++;
        if (a === null || b === null || Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(b))) difs.push(`${g.cenario}: ${rot}  ${a} × ${b}`);
      }
      // o topo do perfil do solo não tem carga acima
      expect(r.cel(ponta('perf_M', 0))).toBe(0);
    }
    expect(difs).toEqual([]);
    expect(conferidos).toBeGreaterThan(1000);
  });
});

describe('momento resistente com a armadura adotada', () => {
  it('MRd ≥ MSd ⇔ as verificações de resistência da aba', () => {
    const difs: string[] = [];
    let casos = 0;
    const conf = (cen: string, peca: string, mrd: number | null, msd: number | null, verif: boolean) => {
      if (mrd === null || msd === null || msd <= 0) return;
      casos++;
      if (mrd >= msd !== verif) difs.push(`${cen} ${peca}: MRd ${mrd} × MSd ${msd}, verificações ${verif}`);
    };
    for (const g of cenarios) {
      const r = calcular(g.alterado);
      const n = (k: string) => r.num(k);
      const ge = (a: string, b: string, tol: number) => n(a) !== null && n(b) !== null && (n(a) as number) >= (n(b) as number) - tol;
      conf(g.cenario, 'balanço', n('MRd_bal'), n('Md_'), ok(r, 'chk_resiste') && ok(r, 'chk_ductil') && ge('As_ef', 'As_nec', 0.005));
      conf(g.cenario, 'contraforte', n('MRd_cf'), n('Md_cf'), ok(r, 'chk_res_cf') && ok(r, 'chk_duc_cf') && ge('As_cfe', 'As_cfn', 0.005));
      conf(g.cenario, 'painel vertical', n('MRd_pvs'), n('M_pvs'), ge('a_pv', 'As_pvs', 0.0005));
      conf(g.cenario, 'painel horizontal', n('MRd_ph'), n('M_ph'), ge('a_ph', 'As_phc', 0.0005));
      if (r.v('Tipo_muro') === 'Contrafortes') conf(g.cenario, 'canaleta do topo', n('MRd_cin'), n('Msd_cin'), ge('Asb_cin', 'Ast_cin', 0));
      conf(g.cenario, 'ponta', n('MRd_toe'), n('Md_ts'), n('x_ts') !== null && ge('Ase_s', 'As_ts', 0.005));
      conf(g.cenario, 'talão', n('MRd_heel'), n('Md_hs'), n('x_hs') !== null && r.v('sup_s') === 'Sim' && ge('Ase_s', 'As_hs', 0.005));
      if (r.v('tem_den') === 'Sim')
        conf(g.cenario, 'dente', n('MRd_den'), n('Md_den'), n('xln_den') !== null && (n('xd_den') as number) <= 0.45 && ge('Ase_den', 'As_den', 0.005));
      const conc = String(r.v('pil_tipo')).startsWith('Conc');
      conf(g.cenario, 'pilarete', n('MRd_pil'), n('Md_pil'),
        n('xd_pil') !== null && (n('xd_pil') as number) <= 0.45 && ge('As_pile', conc ? 'Asc_pil' : 'Asb_pil', 0));
      conf(g.cenario, 'ligação', n('MRd_lig'), n('Md_pil'), n('xd_lig') !== null && (n('xd_lig') as number) <= 0.45 && ge('As_pile', 'As_lig', 0));
      conf(g.cenario, 'painel não armado ∥', n('MRp_pan'), n('Mpar'), ge('ftd_par', 'st_par', 0));
      conf(g.cenario, 'subpainel ∥', n('MRp_sp'), n('Mpar_sp'), ge('ftdp_sp', 'st_psp', 0));
    }
    expect(difs).toEqual([]);
    expect(casos).toBeGreaterThan(500);
  });
});
