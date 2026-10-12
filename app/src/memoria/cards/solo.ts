/*
  CARDS PILOTO: o começo das abas "Solo e Empuxo" (Ka, pressões, empuxo, momento característico) e "Muro em
  balanço" (altura efetiva, esbeltez, momento de cálculo). Provam a cadeia inteira: planilha → passo → TeX → teste.

  Cada `if` aqui ESPELHA um IF da planilha (Ka digitado ou por φ'; água; coesão; travamento; M2d somado) — a
  memória escolhe qual conta CONTAR, nunca qual número publicar. Quem garante que o espelho está certo é o teste
  (conferencia.test.ts), em todos os cenários do gabarito.
*/
import type { AutorDeCards, Card, Expr } from '../tipos';
import { cte, div, max, min, mul, nome, par, pot, rad, raiz, soma, sub, tan } from '../expr';
import { memoriaDe, secao } from '../passo';
import { passoDoPesoCheio } from './pesoProprio';
import { avisoDaPlanilha } from '@/estado/avisosDaPlanilha';

const ABA = 'Solo e Empuxo';
// A tabela de pressões da aba (40 fatias): linha 44 = topo do solo (z = 0), linha 84 = base do muro (z = h solo).
const TOPO = 44, BASE = 84;
const cel = (col: string, lin: number) => `${ABA}!${col}${lin}`;

const AULA_121 = { fonte: 'Aula 12.1' } as const;
const SLIDE_8 = { fonte: 'Aula 12.1', item: 'slide 8' } as const;

function cardEmpuxo(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);

  const kaDigitado = m.num('Ka_dir') !== null;              // ISNUMBER(Ka_dir)
  const coesao = (m.num('c_solo') ?? 0) > 0;
  const agua = m.texto('Agua') === 'Sim';
  const zNA = m.num('z_NA') ?? 0;
  // O empuxo é da altura de SOLO: o perfil da planilha vai do topo do solo à base do muro.
  const H = m.num('H_solo') ?? 0;
  // água que de fato pesa no muro: NA acima da base. NA no topo ou acima dele deixa a água linear desde o topo.
  const aguaNoMuro = agua && zNA < H;
  const aguaNoTopo = agua && zNA < 0;
  const naNoMeio = agua && zNA > 0 && zNA < H;

  const h = m.ent('H_solo', 'h_{solo}');
  const q = m.ent('q_sobre', 'q');
  const gama = m.ent('gama_solo', '\\gamma');
  const phi = m.ent('phi_solo', "\\varphi'");
  const c = m.ent('c_solo', "c'");
  const gw = m.ent('gama_w', '\\gamma_w');
  const zna = m.ent('z_NA', 'z_{NA}');
  const Ka = m.g('Ka_', 'K_a', 3);
  const shTopo = m.g('sh_topo', '\\sigma_{h,topo}', 2, 'kPa');
  const shBase = m.g('sh_base', '\\sigma_{h,base}', 2, 'kPa');
  const efTopo = nome(cel('F', TOPO), "\\sigma'_{h,topo}", 2, 'kPa');
  const efBase = nome(cel('F', BASE), "\\sigma'_{h,base}", 2, 'kPa');
  const uTopo = nome(cel('D', TOPO), 'u_{topo}', 2, 'kPa');
  const uBase = nome(cel('D', BASE), 'u_{base}', 2, 'kPa');
  const Ea = m.g('Ea_', 'E_a', 2, 'kN/m');
  const Ew = m.g('Ew_', 'E_w', 2, 'kN/m');

  // σ'h = máx(0; Ka·σ'v − 2c'·√Ka): o termo da coesão e o "máx" só aparecem quando a coesão existe
  const efetiva = (sigmaV: Expr): Expr[] => {
    const ativa = mul(Ka, sigmaV);
    if (!coesao) return [ativa, max(cte(0, 0), ativa)];
    return [max(cte(0, 0), sub(ativa, mul(cte(2, 0), c, raiz(Ka))))];
  };

  // ── 1 · Dados ──
  const dados = secao('Dados', [
    m.entrada('H_solo', 'h_{solo}'),
    m.entrada('q_sobre', 'q'),
    m.entrada('gama_solo', '\\gamma'),
    !kaDigitado && m.entrada('phi_solo', "\\varphi'"),
    coesao && m.entrada('c_solo', "c'"),
    agua && m.entrada('z_NA', 'z_{NA}'),
    agua && m.entrada('gama_w', '\\gamma_w'),
  ]);

  // ── 2 · Coeficientes de empuxo ──
  const angulo = (s: '+' | '-') => {
    const meio = div(phi, cte(2, 0));
    return rad(s === '-' ? sub(cte(45, 0), meio) : soma(cte(45, 0), meio));
  };
  const coef = secao('Coeficientes de empuxo', [
    kaDigitado
      ? m.passo('Ka_', 'K_a', null, { casas: 3, origem: 'entrada' })
      : m.passo('Ka_', 'K_a', pot(tan(angulo('-')), 2), { casas: 3 }),
    kaDigitado
      ? m.passo('Kp_', 'K_p', div(cte(1, 0), Ka), { casas: 3 })
      : m.passo('Kp_', 'K_p', pot(tan(angulo('+')), 2), { casas: 3 }),
  ], SLIDE_8);

  // ── 3 · Pressões horizontais no topo (z = 0) e na base (z = h) ──
  // Forma fechada primeiro; a da tabela da planilha (σ'h + u nas células) é a rede, para NA acima do terreno.
  const topoFechada = efetiva(q);
  const topo = m.passo('sh_topo', '\\sigma_{h,topo}', [...topoFechada, soma(efTopo, uTopo)], { casas: 2, unidade: 'kPa' });

  const sigmaVBase = soma(q, mul(gama, h));
  const pressoes = aguaNoMuro
    ? [
        aguaNoTopo && m.passo(cel('D', TOPO), 'u_{topo}', mul(gw, par(sub(cte(0, 0), zna))), { casas: 2, unidade: 'kPa' }),
        aguaNoTopo && m.passo(cel('F', TOPO), "\\sigma'_{h,topo}", efetiva(sub(q, uTopo)), { casas: 2, unidade: 'kPa' }),
        topo,
        m.passo(cel('D', BASE), 'u_{base}', mul(gw, sub(h, zna)), { casas: 2, unidade: 'kPa' }),
        m.passo(cel('F', BASE), "\\sigma'_{h,base}", efetiva(sub(sigmaVBase, uBase)), { casas: 2, unidade: 'kPa' }),
        m.passo('sh_base', '\\sigma_{h,base}', soma(efBase, uBase), { casas: 2, unidade: 'kPa' }),
      ]
    : [
        topo,
        m.passo('sh_base', '\\sigma_{h,base}', efetiva(sigmaVBase), { casas: 2, unidade: 'kPa' }),
      ];
  const secPressoes = secao('Pressões horizontais', pressoes, AULA_121);

  // ── 4 · Empuxo e momento na base ──
  const fatia = div(h, cte(40, 0));
  const somaDasFatias = (col: string, simbolo: string, ponta0: Expr, ponta40: Expr): Expr =>
    mul(fatia, par(soma(div(soma(ponta0, ponta40), cte(2, 0)), nome(`${ABA}!${col}${TOPO + 1}:${col}${BASE - 1}`, `\\sum_{i=1}^{39}${simbolo}`, 2, 'kPa'))));

  const efTopoUsada = aguaNoTopo ? efTopo : shTopo;      // sem água no topo, σ'h,topo = σh,topo
  const efBaseUsada = aguaNoMuro ? efBase : shBase;
  const alternativasEa: Expr[] = [mul(div(soma(efTopoUsada, efBaseUsada), cte(2, 0)), h)];
  if (naNoMeio && !coesao) {
    // diagrama efetivo quebra no NA: dois trapézios (acima do NA, σ'v = q + γz; abaixo, o peso submerso)
    const naNA = mul(Ka, par(soma(q, mul(gama, zna))));
    alternativasEa.push(soma(
      mul(div(soma(shTopo, naNA), cte(2, 0)), zna),
      mul(div(soma(naNA, efBase), cte(2, 0)), par(sub(h, zna))),
    ));
  }
  alternativasEa.push(somaDasFatias('F', "\\sigma'_{h,i}", efTopo, efBase));

  const empuxo = secao('Empuxo e momento na base', [
    m.passo('Ea_', 'E_a', alternativasEa, { casas: 2, unidade: 'kN/m' }),
    aguaNoMuro && m.passo('Ew_', 'E_w', [
      div(mul(uBase, par(sub(h, zna))), cte(2, 0)),
      somaDasFatias('D', 'u_i', uTopo, uBase),
    ], { casas: 2, unidade: 'kN/m' }),
    m.passo('Vk_', 'V_k', aguaNoMuro ? soma(Ea, Ew) : Ea, { casas: 2, unidade: 'kN/m' }),
    m.passo('Mk_', 'M_k', [
      // diagrama total linear (trapézio): M = h²/6·(2σtopo + σbase)
      mul(div(pot(h, 2), cte(6, 0)), par(soma(mul(cte(2, 0), shTopo), shBase))),
      nome(`${ABA}!L${TOPO}:L${BASE - 1}`, '\\sum_{i=1}^{40} M_i', 2, 'kN·m/m'),
    ], { casas: 2, unidade: 'kN·m/m' }),
  ], SLIDE_8);

  return {
    id: 'solo.empuxo',
    titulo: 'Empuxo do solo',
    ref: AULA_121,
    figura: 'Fig. 11',
    secoes: [dados, coef, secPressoes, empuxo],
    // c' > 0 (Jose, 08/10: "coesão liberada, com aviso"): o texto e a condição são os da célula aviso_coesao — a
    // mesma placa do campo e da barra de estado. Aqui não se escreve aviso próprio.
    avisos: [avisoDaPlanilha(r, 'aviso_coesao')].filter((a): a is string => a !== null),
    aplicavel: true,
  };
}

function cardEsforcosBalanco(r: Parameters<AutorDeCards>[0]): Card {
  const m = memoriaDe(r);
  const travado = m.texto('Trav_lat') === 'Sim';
  const somaM2d = m.texto('M2d_on') !== 'Não';           // IF(M2d_on="Não";0;M2d_)

  // Esbeltez e peso próprio são do MURO inteiro: o balanço vai até o topo do muro, com ou sem solo atrás.
  const h = m.ent('H_muro', 'h_{muro}');
  const tM = m.ent('t_bloco', 't', { fator: 0.01, casas: 2, unidade: 'm' });   // a planilha guarda t em cm
  const av = m.ent('alfa_v', '\\alpha_v');
  const ah = m.ent('alfa_h', '\\alpha_h');
  // Com contrafortes o travamento é o próprio contraforte: l = espaçamento adotado (planilha, he_; Jose 12/10)
  const comCf = m.texto('Tipo_muro') === 'Contrafortes';
  const l = comCf ? m.g('l_cf_adot', '\\ell_{cf}', 2, 'm') : m.ent('l_trav', '\\ell');
  const gf = m.ent('gama_f', '\\gamma_f');
  // o M2d usa o peso com TODOS os furos grauteados (planilha, peso_ch): sem conta circular com o espaçamento automático
  const gpar = m.g('peso_ch', 'g_{par,ch}', 2, 'kN/m²');
  const he = m.g('he_', 'h_e', 2, 'm');
  const Mk = m.g('Mk_', 'M_k', 2, 'kN·m/m');
  const Nd = m.g('Nd_', 'N_d', 2, 'kN/m');
  const M2d = m.g('M2d_', 'M_{2d}', 3, 'kN·m/m');

  const esbeltez = secao('Altura efetiva e esbeltez', [
    m.entrada('H_muro', 'h_{muro}'),
    m.entrada('t_bloco', 't'),
    travado && m.entrada('alfa_v', '\\alpha_v'),
    travado && m.entrada('alfa_h', '\\alpha_h'),
    travado && !comCf && m.entrada('l_trav', '\\ell'),
    travado && comCf && m.passo('l_cf_adot', '\\ell_{cf}', null, { casas: 2, unidade: 'm', origem: 'adotado' }),
    m.passo('he_', 'h_e', travado
      ? min(mul(av, h), mul(cte(0.7, 1), raiz(mul(av, h, ah, l))))
      : mul(cte(2, 0), h), { casas: 2, unidade: 'm' }),
    m.passo('lambda_', '\\lambda', div(he, tM), {
      casas: 1,
      ref: { fonte: 'ABCP', item: '3.2' },
      verif: { chave: 'balanco.esbeltez', rotulo: 'Esbeltez λ ≤ 30', limite: 30, relacao: '<=', celula: 'chk_esb', casasLimite: 0 },
    }),
  ], { fonte: 'Aula 12.2' });

  const momento = secao('Momento de cálculo na base', [
    m.passo('Mk_', 'M_k', null, { casas: 2, unidade: 'kN·m/m', origem: 'calculado' }),
    m.entrada('gama_f', '\\gamma_f'),
    somaM2d && passoDoPesoCheio(m),
    somaM2d && m.passo('Nd_', 'N_d', mul(gf, gpar, h), { casas: 2, unidade: 'kN/m' }),
    somaM2d && m.passo('M2d_', 'M_{2d}', div(mul(Nd, pot(he, 2)), mul(cte(3600, 0), tM)), {
      casas: 3, unidade: 'kN·m/m', ref: { fonte: 'ABCP', item: '3.6.3.2' },
    }),
    m.passo('Md_', 'M_d', somaM2d ? soma(mul(gf, Mk), M2d) : mul(gf, Mk), { casas: 2, unidade: 'kN·m/m' }),
  ], { fonte: 'Aula 12.2' });

  return {
    id: 'balanco.esforcos',
    titulo: 'Esforços · muro em balanço',
    ref: { fonte: 'Aula 12.2' },
    figura: 'Fig. 7',
    secoes: [esbeltez, momento],
    avisos: [],
    aplicavel: m.texto('Tipo_muro') === 'Balanço',
  };
}

/** Autor piloto: empuxo (vale para os dois tipos de muro) e esforços do muro em balanço. */
export const autorSolo: AutorDeCards = (r) => [cardEmpuxo(r), cardEsforcosBalanco(r)];
