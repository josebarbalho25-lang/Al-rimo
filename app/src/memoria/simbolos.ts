/*
  DICIONÁRIO DE SÍMBOLOS — um só, plano: a chave é o TeX EXATO que o card desenha, o valor é a descrição.

  Regras (o teste cobra): descrição com no máximo 70 caracteres, sem ponto final, sem "porque" — glossário é lista
  de consulta, não texto. Todo símbolo que aparece num passo (lado esquerdo) ou dentro de uma fórmula tem de estar
  aqui; foi assim que o glossário do Pró-Viga ficou incompleto (γc, fctm, ρmín nas contas e fora da lista).

  Uma chave = um significado. Quando a mesma letra serve a duas grandezas (δ, γ, ρ), uma delas ganha índice.
  GRAFIA PROVISÓRIA (decisão do Jose pendente): fica sem índice a letra como a AULA escreve a grandeza mais usada;
  as outras ganham índice:
    γ        peso específico do solo (aula 12.1)      × γ_p   relação h/l do painel (Libânio)
    δ        coeficiente do enrijecedor (aula 12.3)   × δ_b   ângulo de atrito solo-base (fundação)
                                                       × δ_0, δ_∞, δ_adm — flecha (já tinham índice)
    ρ        taxa de armadura no cisalhamento (ABCP)  × ρ_{w,mín} estribo mínimo · ρ_1 taxa da sapata (NBR 6118)
*/
import { SIMBOLOS_BALANCO } from './cards/balanco';
import { SIMBOLOS_PAINELELS } from './cards/painelEls';
import { SIMBOLOS_CONTRAFORTE } from './cards/contraforte';
import { SIMBOLOS_PAINELCF } from './cards/painelCf';
import { SIMBOLOS_ESTABILIDADE } from './cards/estabilidade';
import { SIMBOLOS_SAPATA } from './cards/sapata';

const SIMBOLOS_BASE: Readonly<Record<string, string>> = {
  // ── geometria e cargas (Entradas) ──
  // Duas alturas desde 09/10: o solo contido pode ficar abaixo do topo do muro. h_s já é a altura da sapata.
  'h_{solo}': 'altura de solo contido, do topo do solo à base do muro',
  'h_{muro}': 'altura do muro, do topo da sapata ao topo do muro',
  t: 'espessura do bloco',
  q: 'sobrecarga uniforme sobre o terreno contido',
  'z_{NA}': 'profundidade do nível d’água, medida do topo do solo',
  'g_{par}': 'peso próprio da parede por área (o usado: calculado, ou o digitado)',
  // peso próprio calculado (12/10): bloco + graute + reboco — cards/pesoProprio.ts
  'f_{gr}': 'fração dos furos do bloco grauteada',
  'g_{alv}': 'peso da alvenaria por área (bloco + graute)',
  'e_{reb}': 'espessura do reboco em cada face',
  'g_{reb}': 'peso do reboco por área',
  'g_{par,ch}': 'peso da parede com todos os furos grauteados (só no M2d)',
  'g_{par,dig}': 'peso próprio da parede digitado',
  '\\gamma_{cf,dig}':'peso específico do contraforte grauteado, digitado',
  '\\alpha_v': 'coeficiente de vinculação vertical (altura efetiva)',
  '\\alpha_h': 'coeficiente de vinculação horizontal (altura efetiva)',
  '\\ell': 'distância entre travamentos laterais',

  // ── solo e empuxo (aula 12.1) ──
  '\\gamma': 'peso específico do solo',
  '\\gamma_w': 'peso específico da água',
  "\\varphi'": 'ângulo de atrito efetivo do solo',
  "c'": 'coesão efetiva do solo',
  K_a: 'coeficiente de empuxo ativo (Rankine)',
  K_p: 'coeficiente de empuxo passivo (Rankine)',
  '\\sigma_{h,topo}': 'pressão horizontal total no topo do solo',
  '\\sigma_{h,base}': 'pressão horizontal total na base do muro',
  "\\sigma'_{h,topo}": 'pressão horizontal efetiva no topo do solo',
  "\\sigma'_{h,base}": 'pressão horizontal efetiva do solo na base',
  "\\sigma'_{h,i}": 'pressão horizontal efetiva no limite i das fatias',
  'u_{topo}': 'pressão da água no topo',
  'u_{base}': 'pressão da água na base',
  u_i: 'pressão da água no limite i das fatias',
  M_i: 'momento da fatia i em relação à base do muro',
  E_a: 'empuxo ativo do solo por metro de muro',
  E_w: 'empuxo da água por metro de muro',
  V_k: 'força horizontal característica na base, por metro',
  M_k: 'momento característico na base, por metro',

  // ── muro em balanço — esforços (aula 12.2) ──
  h_e: 'altura efetiva da parede',
  '\\lambda': 'índice de esbeltez da parede',
  '\\gamma_f': 'coeficiente de majoração das ações',
  N_d: 'força normal de cálculo na base, por metro',
  'M_{2d}': 'momento de 2ª ordem de cálculo, por metro',
  M_d: 'momento de cálculo na base, por metro',
};

/*
  Cada grupo de cards traz o seu dicionário (cards/<grupo>.ts) para os grupos serem escritos em paralelo. Aqui eles se
  juntam. A mesma chave com DUAS descrições é defeito (uma letra, dois significados no glossário): fica registrada em
  CONFLITOS_DE_SIMBOLO e o teste (simbolos.test.ts) reprova — o app não quebra por isso, vale a primeira descrição.
*/
const GRUPOS: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ['base', SIMBOLOS_BASE],
  ['balanco', SIMBOLOS_BALANCO],
  ['painelEls', SIMBOLOS_PAINELELS],
  ['contraforte', SIMBOLOS_CONTRAFORTE],
  ['painelCf', SIMBOLOS_PAINELCF],
  ['estabilidade', SIMBOLOS_ESTABILIDADE],
  ['sapata', SIMBOLOS_SAPATA],
];

export const CONFLITOS_DE_SIMBOLO: string[] = [];
const juntos: Record<string, string> = {};
const dono: Record<string, string> = {};
for (const [grupo, dic] of GRUPOS) {
  for (const [tex, desc] of Object.entries(dic)) {
    if (tex in juntos) {
      if (juntos[tex] !== desc) CONFLITOS_DE_SIMBOLO.push(`${tex}: "${juntos[tex]}" (${dono[tex]}) × "${desc}" (${grupo})`);
      continue;
    }
    juntos[tex] = desc;
    dono[tex] = grupo;
  }
}
export const SIMBOLOS: Readonly<Record<string, string>> = juntos;

/** Descrição do símbolo; '' quando falta (o teste não deixa faltar). */
export function descricao(tex: string): string {
  return SIMBOLOS[tex] ?? '';
}
