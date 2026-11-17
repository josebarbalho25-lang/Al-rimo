/*
  SAPATA FLEXÍVEL CALCULADA E ANCORAGEM DA ESPERA (Jose, 16/11; aba Fundação, seção 14). O que a decisão muda e o que
  ela não pode mudar:
    · a classe só informa — nenhuma verificação 'fundacao.rigidez' no veredito;
    · com o muro centrado a classe é a de antes ((B − t)/3);
    · a flexível leva punção, Ø ≤ h/8 e (com contrafortes) a concentração junto ao contraforte; a rígida não;
    · a ancoragem da espera vale nas duas classes; o nó de cachorro não é julgado;
    · cada verificação nova do card diz o mesmo que a célula da planilha.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { cardsDaMemoria, verificacoesDe } from './cards';
const CENARIOS = cenariosDoGabarito();

const falhas = (c: string) => verificacoesDe(cardsDaMemoria(resultadoDoGabarito(c))).filter((x) => !x.v.passa).map((x) => x.v.chave);
const chaves = (c: string) => verificacoesDe(cardsDaMemoria(resultadoDoGabarito(c))).map((x) => x.v.chave);

describe('sapata flexível calculada (16/11)', () => {
  it('a classe não entra no veredito em cenário nenhum', () => {
    for (const c of CENARIOS) expect(chaves(c).filter((k) => k.startsWith('fundacao.rigidez')), c).toEqual([]);
  }, 60000);

  it('muro centrado: a classe é a de antes, (B − t)/3', () => {
    for (const [c, classe] of [['alvo_classe_centrado_rigida', 'Rígida'], ['alvo_classe_centrado_flexivel', 'Flexível']] as const) {
      const r = resultadoDoGabarito(c);
      expect(r.num('h_rig')!, c).toBeCloseTo((r.num('B_sap')! - r.num('t_bloco')! / 100) / 3, 12);
      expect(String(r.v('chk_rig')), c).toMatch(new RegExp(`^${classe}`));
    }
  });

  it('rígida: sem punção nem Ø ≤ h/8; flexível: com', () => {
    const rig = chaves('alvo_classe_centrado_rigida');
    expect(rig.some((k) => k.startsWith('sapata.puncao') || k === 'sapata.phi8')).toBe(false);
    const flex = chaves('alvo_flex_balanco_h30');
    expect(flex).toEqual(expect.arrayContaining(['sapata.puncao.talao', 'sapata.phi8', 'sapata.ancoragemEspera.muro']));
  });

  it('flexíveis que passam: balanço e contrafortes, h 0,30 e 0,40 — nada da seção 14 reprova', () => {
    for (const c of ['alvo_flex_balanco_h30', 'alvo_flex_balanco_h40', 'alvo_flex_cf_h30', 'alvo_flex_cf_h40', 'alvo_flex_ks_digitado']) {
      const r = resultadoDoGabarito(c);
      expect(r.v('flex_s'), c).toBe('Sim');
      for (const n of ['chk_pun_m', 'chk_pun_c', 'chk_phi8', 'chk_fc_fl', 'chk_fc_v', 'chk_anc_esp']) expect(String(r.v(n)), `${c} ${n}`).not.toMatch(/^NÃO OK/);
      const f = falhas(c).filter((k) => k.startsWith('sapata.puncao') || k.startsWith('sapata.concentracao') || k === 'sapata.phi8' || k.startsWith('sapata.ancoragemEspera'));
      expect(f, c).toEqual([]);
    }
  });

  it('contrafortes: o fator de concentração muda com o ks digitado e vai ao card', () => {
    const auto = resultadoDoGabarito('alvo_flex_cf_h40'), dig = resultadoDoGabarito('alvo_flex_ks_digitado');
    expect(dig.num('ks_us')).toBe(50000);
    expect(dig.num('fcc_s')!).toBeGreaterThan(auto.num('fcc_s')!);
    expect(chaves('alvo_flex_cf_h40')).toEqual(expect.arrayContaining(['sapata.concentracao.flexao', 'sapata.concentracao.cortante', 'sapata.puncao.contraforte']));
  });

  it('reprovações: punção, Ø > h/8 e espera que não ancora', () => {
    const p = resultadoDoGabarito('alvo_flex_puncao_reprova');
    expect(String(p.v('chk_pun_m'))).toMatch(/^NÃO OK/);
    expect(String(p.v('chk_pun_c'))).toMatch(/^NÃO OK/);
    expect(falhas('alvo_flex_puncao_reprova')).toEqual(expect.arrayContaining(['sapata.puncao.contraforte']));
    expect(String(resultadoDoGabarito('alvo_flex_phi_h8').v('chk_phi8'))).toMatch(/^NÃO OK \(Ø25 > h\/8 = 18,8 mm\)/);
    expect(falhas('alvo_flex_phi_h8')).toContain('sapata.phi8');
    const a = resultadoDoGabarito('alvo_espera_nao_ancora');
    expect(String(a.v('chk_anc_esp'))).toMatch(/^NÃO OK \(ℓb,nec 24 > 19,4 cm, faltam 4,6 cm\)/);
    expect(falhas('alvo_espera_nao_ancora')).toContain('sapata.ancoragemEspera.muro');
  });

  it('nó de cachorro: a ancoragem não é julgada', () => {
    const r = resultadoDoGabarito('alvo_espera_no_de_cachorro');
    expect(r.v('chk_anc_esp')).toBe('— (nó de cachorro: ancoragem pela dobra por baixo)');
    expect(chaves('alvo_espera_no_de_cachorro').some((k) => k.startsWith('sapata.ancoragemEspera'))).toBe(false);
  });

  it('card × célula: a verificação nova reprova sse a célula da planilha reprova', () => {
    const CEL: Array<[string, (k: string) => boolean]> = [
      ['chk_pun_m', (k) => k === 'sapata.puncao.ponta' || k === 'sapata.puncao.talao'],
      ['chk_pun_c', (k) => k === 'sapata.puncao.contraforte'],
      ['chk_phi8', (k) => k === 'sapata.phi8'],
      ['chk_fc_fl', (k) => k === 'sapata.concentracao.flexao'],
      ['chk_fc_v', (k) => k === 'sapata.concentracao.cortante'],
      ['chk_anc_esp', (k) => k.startsWith('sapata.ancoragemEspera')],
    ];
    const ruins: string[] = [];
    for (const c of CENARIOS) {
      const r = resultadoDoGabarito(c);
      const vs = verificacoesDe(cardsDaMemoria(r));
      for (const [cel, eh] of CEL) {
        const t = String(r.v(cel));
        const minhas = vs.filter((x) => eh(x.v.chave));
        const reprovaCel = t.startsWith('NÃO OK');
        const reprovaCard = minhas.some((x) => !x.v.passa);
        if (reprovaCel !== reprovaCard) ruins.push(`${c} ${cel}: "${t}" × card ${reprovaCard ? 'reprova' : 'passa'}`);
      }
    }
    expect(ruins).toEqual([]);
  }, 60000);
});
