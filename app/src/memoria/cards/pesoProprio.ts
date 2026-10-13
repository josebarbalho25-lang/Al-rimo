// ═══════════════════════════════════════════════════════════════════════════
//  memoria/cards/pesoProprio.ts — o peso próprio da parede e o γ do contraforte
// ---------------------------------------------------------------------------
//  Até 12/10 o peso da parede era digitado (3,0 kN/m² para qualquer bloco).
//  Agora a planilha calcula (Entradas, logo abaixo do campo, que ficou
//  opcional): bloco (t, Aliq/Abr), o graute da grade "graute a cada X" (13/10)
//  e o reboco. Estes passos escrevem essa conta para a memória; quem usa o
//  resultado (cargas da fundação, σsg do ELS, M2d) lê `peso_us`/`peso_ch`.
//
//  Os pesos específicos são constantes escritas na fórmula da planilha (22, 24
//  e 21 kN/m³), não nomes: aqui também entram como constantes, cada uma com a
//  fonte na seção.
// ═══════════════════════════════════════════════════════════════════════════

import type { Expr, Passo, Ref } from '../tipos';
import { cte, div, mul, soma, sub } from '../expr';
import type { Memoria } from '../passo';

const NBR_6120: Ref = { fonte: 'NBR 6120' };
const UM = cte(1, 0);
const G_BLOCO = cte(22, 0);   // concreto do bloco — DEDUÇÃO: peso de catálogo ÷ volume de concreto
const G_GRAUTE = cte(24, 0);  // NBR 6120, concreto simples
const G_REBOCO = cte(21, 0);  // NBR 6120, argamassa de cimento e areia

/** 1 − (1 − m/X)·(1 − c/h): o termo de cada lado só entra se a planilha o contou (espaçamento > 0). */
function fracao(fV: Expr | null, fH: Expr | null): Expr {
  const termos = [fV, fH].filter((x): x is Expr => !!x).map((x) => sub(UM, x));
  if (termos.length === 0) return cte(0, 0);
  return sub(UM, termos.length === 1 ? termos[0] : mul(...termos));
}

/** Faces de reboco que a planilha conta: IF(reb_fac="Nas duas faces";2;IF(reb_fac="Só na frente";1;0)). */
export function facesDeReboco(m: Memoria): number {
  const f = m.texto('reb_fac');
  return f === 'Nas duas faces' ? 2 : f === 'Só na frente' ? 1 : 0;
}

/** Os passos do peso próprio da parede (a seção "Peso próprio" do card de cargas da fundação). */
export function passosDoPeso(m: Memoria): (Passo | false)[] {
  const digitado = m.num('peso_par') !== null;
  if (digitado) {
    return [m.entrada('peso_par', 'g_{par,dig}'), m.passo('peso_us', 'g_{par}', m.ent('peso_par', 'g_{par,dig}'), { casas: 2, unidade: 'kN/m²' })];
  }
  const contrafortes = m.texto('Tipo_muro') === 'Contrafortes';
  // graute a cada X (Jose, 13/10): a mesma grade no balanço e no painel; X = 20 (gr_tot = Sim) → todos os furos
  const total = m.texto('gr_tot') === 'Sim';
  const t = m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' });
  const rliq = m.g('r_liq', 'A_{liq}/A_{br}', 2);
  const mmod = m.g('m_mod', 'm', 0, 'cm');
  const fiada = cte(20, 0);
  const pos = (id: string) => (m.valor(id) ?? 0) > 0;
  // furos grauteados de uma fiada comum = m/X; as fiadas de canaleta (20 cm a cada s_h ou h) somam por cima
  const fFuro = m.g('f_furo', 'f_{furo}', 3);
  const f = fracao(
    fFuro,
    contrafortes ? (pos('s_ph') ? div(fiada, m.g('s_ph', 's_h', 0, 'cm')) : null) : div(cte(0.2, 2), m.ent('h_pan', 's_{can}')));
  const fgr = m.g('f_gr', 'f_{gr}', 3);
  const faces = facesDeReboco(m);
  const reb = faces > 0;
  const galv = m.g('g_alv', 'g_{alv}', 2, 'kN/m²');
  const greb = m.g('g_reb', 'g_{reb}', 2, 'kN/m²');
  const esp = m.ent('reb_esp', 'e_{reb}', { fator: 0.01, casas: 3, unidade: 'm' });
  return [
    !total && m.entrada('Graute', 's_{gr}'),
    !total && m.passo('f_furo', 'f_{furo}', div(mmod, m.ent('Graute', 's_{gr}')), { casas: 3 }),
    total ? m.passo('f_gr', 'f_{gr}', null, { casas: 3, origem: 'adotado' }) : m.passo('f_gr', 'f_{gr}', f, { casas: 3 }),
    m.passo('g_alv', 'g_{alv}', mul(t, soma(mul(G_BLOCO, rliq), mul(G_GRAUTE, sub(UM, rliq), fgr))), {
      casas: 2, unidade: 'kN/m²', ref: NBR_6120,
    }),
    reb && m.entrada('reb_esp', 'e_{reb}'),
    reb && m.passo('g_reb', 'g_{reb}', faces === 2 ? mul(G_REBOCO, esp, cte(2, 0)) : mul(G_REBOCO, esp), {
      casas: 2, unidade: 'kN/m²', ref: NBR_6120,
    }),
    m.passo('peso_us', 'g_{par}', reb ? soma(galv, greb) : galv, { casas: 2, unidade: 'kN/m²' }),
  ];
}

/** O γ do contraforte todo grauteado: γbloco·Aliq/Abr + γgraute·(1 − Aliq/Abr), ou o digitado. */
export function passoDoGamaCf(m: Memoria): Passo[] {
  if (m.num('gama_cf') !== null) {
    return [m.passo('gama_cf_us', '\\gamma_{cf}', m.ent('gama_cf', '\\gamma_{cf,dig}'), { casas: 2, unidade: 'kN/m³' })];
  }
  const rliq = m.g('r_liq', 'A_{liq}/A_{br}', 2);
  return [m.passo('gama_cf_us', '\\gamma_{cf}', soma(mul(G_BLOCO, rliq), mul(G_GRAUTE, sub(UM, rliq))), {
    casas: 2, unidade: 'kN/m³', ref: NBR_6120,
  })];
}

/** O peso com todos os furos grauteados, que só o M2d usa (evita a conta circular com o espaçamento automático). */
export function passoDoPesoCheio(m: Memoria): Passo {
  if (m.num('peso_par') !== null) {
    return m.passo('peso_ch', 'g_{par,ch}', m.ent('peso_par', 'g_{par,dig}'), { casas: 2, unidade: 'kN/m²' });
  }
  const t = m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' });
  const rliq = m.g('r_liq', 'A_{liq}/A_{br}', 2);
  const cheio = mul(t, soma(mul(G_BLOCO, rliq), mul(G_GRAUTE, sub(UM, rliq))));
  return m.passo('peso_ch', 'g_{par,ch}', facesDeReboco(m) > 0 ? soma(cheio, m.g('g_reb', 'g_{reb}', 2, 'kN/m²')) : cheio, {
    casas: 2, unidade: 'kN/m²', ref: { fonte: 'Dedução' },
  });
}
