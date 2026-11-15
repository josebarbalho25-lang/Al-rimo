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

const CHAVES = ['dente.ductilidade', 'dente.flexao', 'dente.cortante', 'dente.ancoragem', 'dente.sapata'];

describe('card da armadura do dente', () => {
  it('sem dente o card não se aplica e não monta passo; com dente, sempre', () => {
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      const [card] = autorDente(r);
      expect(card.id).toBe('fundacao.dente');
      const tem = (r.num('b_den') ?? 0) > 0 && (r.num('h_den') ?? 0) > 0;
      expect(card.aplicavel, c).toBe(tem);
      if (!tem) expect(card.secoes, c).toEqual([]);
      else expect(card.secoes.length, c).toBeGreaterThan(0);
    }
  });

  it('exemplo (dente 25 × 50 no centro): as cinco verificações entram no veredito e passam', () => {
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
    const CELULA: Record<string, string> = { 'dente.flexao': 'chk_fl_den', 'dente.cortante': 'chk_v_den', 'dente.ancoragem': 'chk_anc_den', 'dente.sapata': 'chk_tr_den' };
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      if (r.v('tem_den') !== 'Sim') continue;
      const vs = verificacoesDe(autorDente(r));
      for (const [chave, cel] of Object.entries(CELULA)) {
        const v = vs.find((x) => x.v.chave === chave);
        const ok = String(r.v(cel)).startsWith('OK');
        // a da flexão nunca some do card (sem o φ' do solo de apoio as outras ficam sem número e saem; ela fica,
        // reprovada pela célula — é ela que o veredito do app lê); as outras, com número, sempre
        if (chave === 'dente.flexao' || r.num('p2_den') !== null) expect(v, `${c} ${chave}`).toBeDefined();
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
