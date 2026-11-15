/*
  O CARD DA ARMADURA DO DENTE (15/11). Que cada linha dá o número da célula em todos os cenários do gabarito já está
  em conferencia.test.ts (o autor entra em AUTORES); aqui, o que é só deste card: só existe com dente, as
  verificações que o veredito do app lê, e os dois desenhos gerados.
*/
import { describe, expect, it } from 'vitest';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { autorDente } from './cards/dente';
import { cardsDaMemoria, verificacoesDe, vereditoDaMemoria } from './cards';
import { desenhoDaSecaoDoDente, desenhoDasForcasNoDente } from './desenhoDaSapata';
import { nbr } from './formato';

const CHAVES = ['dente.largura', 'dente.ductilidade', 'dente.flexao', 'dente.cortante', 'dente.ancoragem', 'dente.sapata'];

describe('card da armadura do dente', () => {
  it('sem dente o card não se aplica e não monta passo; com dente, sempre; altura sem largura com o passivo contando, só a largura', () => {
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      const [card] = autorDente(r);
      expect(card.id).toBe('fundacao.dente');
      const tem = (r.num('b_den') ?? 0) > 0 && (r.num('h_den') ?? 0) > 0;
      const semLargura = !tem && r.v('pass_on') === 'Sim' && (r.num('h_den') ?? 0) > 0;
      expect(card.aplicavel, c).toBe(tem || semLargura);
      if (!tem && !semLargura) expect(card.secoes, c).toEqual([]);
      else expect(card.secoes.length, c).toBeGreaterThan(0);
      if (semLargura) {
        const vs = verificacoesDe([card]);
        expect(vs.map((x) => x.v.chave), c).toEqual(['dente.largura']);
        expect(vs[0].v.passa, c).toBe(false);
        expect(card.avisos, c).toContain('Digitar a largura do dente ou zerar a altura');
      }
    }
  });

  it('altura sem largura (passivo do solo da frente contando o dente): o muro reprova pedindo a largura', () => {
    for (const c of ['alvo_dente_sem_largura', 'alvo_dente_largura_vazia']) {
      const r = resultadoDoGabarito(c);
      expect(r.v('res_den'), c).toBe('NÃO OK — digitar a largura do dente ou zerar a altura');
      expect(vereditoDaMemoria(r, cardsDaMemoria(r))?.passa, c).toBe(false);
    }
  });

  it('a força de cálculo é a maior entre o passivo cheio × 1,4 e o que o deslizamento pede (critério de 15/11)', () => {
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      if (r.v('tem_den') !== 'Sim' || r.num('Fa_den') === null) continue;
      const [Fa, Fd, Md, Vd, y] = ['Fa_den', 'Fd_den', 'Md_den', 'Vd_den', 'y_den'].map((n) => r.num(n)!);
      const Fb = r.num('Fb_den');
      expect(Fa, c).toBeCloseTo(1.4 * r.num('Ek_den')!, 9);
      if (Fb !== null) {
        const esperado = Math.max(0, (r.num('FS_desl')! * r.num('H_k')! - r.num('R_at')! - r.num('R_ad')!) / r.num('Lm')!);
        expect(Fb, c).toBeCloseTo(esperado, 9);
      }
      expect(Fd, c).toBeCloseTo(Math.max(Fa, Fb ?? 0), 9);
      expect(r.v('gov_den'), c).toBe(Fb !== null && Fb > Fa ? 'Deslizamento (b)' : 'Passivo cheio (a)');
      expect(Vd, c).toBe(Fd);
      expect(Md, c).toBeCloseTo(Fd * y, 9);
    }
    // o alvo do atrito fraco: manda o deslizamento, e o desenho do passivo diz a força de cálculo
    const r = resultadoDoGabarito('alvo_dente_deslizamento_manda');
    expect(r.v('gov_den')).toBe('Deslizamento (b)');
    const svg = desenhoDasForcasNoDente(r)!.svg;
    expect(svg).toContain(`Fd = máx(1,4·Ek = ${nbr(r.num('Fa_den')!, 2)}; deslizamento = ${nbr(r.num('Fb_den')!, 2)}) = ${nbr(r.num('Fd_den')!, 2)} kN/m`);
    expect(svg).toContain(`Md = Fd × y = ${nbr(r.num('Md_den')!, 2)} kN·m/m`);
  });

  it('reprovações por regra: largura abaixo do estribo, d ≤ 0, espaçamento abaixo de 5 cm, ponta sem barra em cima', () => {
    const casos: [string, string, string][] = [
      ['alvo_dente_estreito', 'chk_geo_den', 'dente.largura'],
      ['alvo_dente_sem_d', 'chk_geo_den', 'dente.largura'],
      ['alvo_dente_s_abaixo_de_5', 'chk_fl_den', 'dente.flexao'],
      ['alvo_dente_ponta_reta', 'chk_tr_den', 'dente.sapata'],
    ];
    for (const [c, cel, chave] of casos) {
      const r = resultadoDoGabarito(c);
      expect(String(r.v(cel)), c).toMatch(/^NÃO OK/);
      const cards = cardsDaMemoria(r);
      const v = verificacoesDe(cards).find((x) => x.card.id === 'fundacao.dente' && x.v.chave === chave);
      expect(v?.v.passa, c).toBe(false);
      expect(vereditoDaMemoria(r, cards)?.passa, c).toBe(false);
    }
    // d ≤ 0: nenhuma das outras diz OK (o VRd1 de dois negativos dava positivo)
    const r = resultadoDoGabarito('alvo_dente_sem_d');
    expect(r.num('d_den')!).toBeLessThanOrEqual(0);
    for (const n of ['chk_fl_den', 'chk_v_den', 'chk_anc_den', 'chk_tr_den']) expect(String(r.v(n)), n).toMatch(/^NÃO OK/);
    expect(r.v('chk_geo_den')).toBe(`NÃO OK — dente estreito para o estribo: mínimo ${nbr(r.num('bmin_den')!, 1)} cm`);
    expect(resultadoDoGabarito('alvo_dente_s_abaixo_de_5').v('chk_fl_den')).toBe('NÃO OK — espaçamento do estribo abaixo de 5 cm: usar 5 cm ou mais');
    // o motivo em palavras vai para o aviso do card
    const [card] = autorDente(resultadoDoGabarito('alvo_dente_ponta_reta'));
    expect(card.avisos).toContain('Sem armadura em cima da sapata: usar estribo na sapata');
    // com estribo na sapata (o padrão), o mesmo dente na ponta tem a barra de cima e a conta compara os momentos
    expect(String(resultadoDoGabarito('alvo_dente_ponta_digitado').v('chk_tr_den'))).toMatch(/^OK \(/);
  });

  it('exemplo (dente 25 × 50 no centro): as seis verificações entram no veredito e passam', () => {
    const r = resultadoDoGabarito('aula122');
    const vs = verificacoesDe(cardsDaMemoria(r)).filter((x) => x.card.id === 'fundacao.dente');
    expect(vs.map((x) => x.v.chave).sort()).toEqual([...CHAVES].sort());
    for (const x of vs) expect(x.v.passa, x.v.chave).toBe(true);
    // o estribo que a conta adotou, lido da planilha
    expect(r.v('res_den')).toBe('OK — estribo Ø8 c/12,5 + 6 Ø6,3 corridas');
  });

  it('dente estreito e fundo: a flexão, o cortante, a ancoragem e a sapata reprovam — e o muro reprova junto', () => {
    const r = resultadoDoGabarito('alvo_dente_talao_nao_passa');
    const cards = cardsDaMemoria(r);
    const vs = verificacoesDe(cards).filter((x) => x.card.id === 'fundacao.dente');
    const reprovadas = vs.filter((x) => !x.v.passa).map((x) => x.v.chave);
    expect(reprovadas).toContain('dente.flexao');
    expect(reprovadas).toContain('dente.cortante');
    expect(reprovadas).toContain('dente.sapata');
    expect(vereditoDaMemoria(r, cards)?.passa).toBe(false);
  });

  it('o veredito de cada verificação é o da célula da planilha, em todo cenário com dente', () => {
    const CELULA: Record<string, string> = { 'dente.largura': 'chk_geo_den', 'dente.flexao': 'chk_fl_den', 'dente.cortante': 'chk_v_den', 'dente.ancoragem': 'chk_anc_den', 'dente.sapata': 'chk_tr_den' };
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      if (r.v('tem_den') !== 'Sim') continue;
      const vs = verificacoesDe(autorDente(r));
      for (const [chave, cel] of Object.entries(CELULA)) {
        const v = vs.find((x) => x.v.chave === chave);
        const ok = String(r.v(cel)).startsWith('OK');
        // a da flexão nunca some do card (sem o φ' do solo de apoio as outras ficam sem número e saem; ela fica,
        // reprovada pela célula — é ela que o veredito do app lê); as outras, com número, sempre
        if (chave === 'dente.flexao' || (r.num('p2_den') !== null && r.num('d_den')! > 0)) expect(v, `${c} ${chave}`).toBeDefined();
        if (v) expect(v.v.passa, `${c} ${chave}`).toBe(ok);
      }
      // o resumo da planilha diz o mesmo que o conjunto do card
      const todas = vs.filter((x) => x.v.chave !== 'dente.ductilidade').every((x) => x.v.passa);
      expect(String(r.v('res_den')).startsWith('OK'), c).toBe(todas);
    }
  });

  it('os desenhos saem com os números das células (passivo, resultante, braço; seção com d e espaçamento)', () => {
    const r = resultadoDoGabarito('aula122');
    const forcas = desenhoDasForcasNoDente(r)!;
    for (const n of ['p1_den', 'p2_den', 'Ek_den', 'Mk_den']) expect(forcas.svg, n).toContain(nbr(r.num(n)!, 2));
    expect(forcas.svg).toContain(`y = ${nbr(r.num('y_den')!, 3)} m`);
    const secao = desenhoDaSecaoDoDente(r)!;
    expect(secao.svg).toContain(`d = ${nbr(r.num('d_den')!, 1)} cm`);
    expect(secao.svg).toContain('100 cm');
    // sem dente, nenhum dos dois
    const sem = resultadoDoGabarito(cenariosDoGabarito().find((c) => resultadoDoGabarito(c).v('tem_den') !== 'Sim')!);
    expect(desenhoDasForcasNoDente(sem)).toBeNull();
  });
});
