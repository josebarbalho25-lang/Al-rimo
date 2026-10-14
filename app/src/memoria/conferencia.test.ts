/*
  A CONFERÊNCIA DA MEMÓRIA CONTRA A PLANILHA.

  Para todo autor de cards × todo cenário do gabarito do Excel (dados/golden): cada expressão avaliada tem de dar o
  número da célula (tolerância relativa 1e-6 — a mesma do passo.ts; arredondamento da planilha tem de estar na
  expressão), cada símbolo tem descrição no dicionário, cada linha compila no KaTeX com throwOnError, e o glossário
  sai sempre na mesma ordem. Se alguém mudar a fórmula na planilha e esquecer a memória, é aqui que quebra.
*/
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cenariosDoGabarito, lerGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { calcular } from '@/motor';
import type { Card, Expr, Passo } from './tipos';
import { AUTORES, cardsDaMemoria, verificacoesDe, vereditoDaMemoria } from './cards';
import { figuraDoCard } from './figuraDoCard';
import { avaliar, folhasDe } from './expr';
import { TOLERANCIA, bate } from './passo';
import { texDaLinha } from './linha';
import { SIMBOLOS } from './simbolos';
import { chaveDeOrdem, glossarioDe, ordenarSimbolos, simbolosDoPasso } from './glossario';
import { AVISO_DO_SOLO } from './metaDaPlanilha';

const CENARIOS = cenariosDoGabarito();

// strict 'error': além de não quebrar, a linha não pode depender de "jeitinho" do KaTeX (unicode solto em modo
// matemático etc.) — o que o KaTeX só avisa no console, o Word pode desenhar diferente.
const compila = (tex: string) => katex.renderToString(tex, { throwOnError: true, displayMode: true, strict: 'error' });

const passosDe = (cards: Card[]): { card: Card; p: Passo }[] =>
  cards.flatMap((card) => card.secoes.flatMap((s) => s.passos.map((p) => ({ card, p }))));

const usaCelula = (e: Expr) => folhasDe(e).some((f) => f.nome.includes('!'));

describe('memória × planilha (gabarito do Excel)', () => {
  it('há cenários no gabarito (aula 12.2, aula 12.3 e sorteios)', () => {
    expect(CENARIOS).toContain('aula122');
    expect(CENARIOS).toContain('aula123');
    expect(CENARIOS.filter((c) => c.startsWith('sorteio')).length).toBeGreaterThanOrEqual(40);
  });

  for (const cenario of CENARIOS) {
    describe(cenario, () => {
      const r = resultadoDoGabarito(cenario);

      AUTORES.forEach((autor, i) => {
        it(`autor ${i}: toda expressão dá o número da célula`, () => {
          const cards = autor(r);
          expect(cards.length).toBeGreaterThan(0);
          const falhas: string[] = [];
          for (const { card, p } of passosDe(cards)) {
            if (!p.expr) continue;
            if (typeof p.valor !== 'number') continue; // célula com texto ("não resiste"): nada a provar
            const calc = avaliar(p.expr, r);
            if (!bate(calc, p.valor)) falhas.push(`${card.id} · ${p.id}: memória ${calc} × planilha ${p.valor}`);
          }
          expect(falhas).toEqual([]);
        });

        it(`autor ${i}: todo passo mostrado tem valor (sem vazio, "—" nem erro de Excel)`, () => {
          // o card escolhe o que mostrar: célula que a planilha deixou em "—" não se aplica e não entra no card.
          // Só ENTRADA pode vir vazia (campo apagado no formulário: o dado sai "—" e a conta usa zero, como o Excel).
          for (const { card, p } of passosDe(autor(r))) {
            const onde = `${card.id} · ${p.id}`;
            if (p.origem !== 'entrada') expect(p.valor, onde).not.toBeNull();
            if (typeof p.valor === 'string') {
              expect(p.valor, onde).not.toMatch(/^#/);
              expect(p.valor.trim(), onde).not.toBe('—');
            }
            // conta com resultado em texto não tem o que provar: só número tem fórmula
            if (p.expr) expect(typeof p.valor, `${onde}: fórmula com resultado em texto`).toBe('number');
          }
        });

        it(`autor ${i}: todo símbolo está no dicionário`, () => {
          const faltam = new Set<string>();
          for (const { p } of passosDe(autor(r))) {
            for (const s of simbolosDoPasso(p)) if (!(s in SIMBOLOS)) faltam.add(s);
          }
          expect([...faltam]).toEqual([]);
        });

        it(`autor ${i}: toda linha compila no KaTeX (throwOnError)`, () => {
          for (const { card, p } of passosDe(autor(r))) {
            const tex = texDaLinha(p, r);
            expect(() => compila(tex), `${card.id} · ${p.id}: ${tex}`).not.toThrow();
            expect(tex, `${card.id} · ${p.id}: vírgula crua no TeX`).not.toMatch(/\d,\d/);
          }
        });

        it(`autor ${i}: veredito da planilha e desigualdade escrita concordam`, () => {
          for (const { card, p } of passosDe(autor(r))) {
            const v = p.verif;
            if (!v || v.valor === null || v.limite === null) continue;
            const atende = v.relacao === '<=' ? v.valor <= v.limite : v.valor >= v.limite;
            expect(v.passa, `${card.id} · ${v.chave}`).toBe(atende);
          }
        });
      });
    });
  }
});

describe('régua única entre cenários', () => {
  it('o mesmo nome definido desenha sempre o mesmo símbolo, com as mesmas casas', () => {
    // chave: nome + fator (t em cm e t em m são leituras diferentes do mesmo nome); valor: símbolo e casas
    const visto = new Map<string, string>();
    const conflitos = new Set<string>();
    const anota = (chave: string, assinatura: string) => {
      const antes = visto.get(chave);
      if (antes === undefined) visto.set(chave, assinatura);
      else if (antes !== assinatura) conflitos.add(`${chave}: ${antes} × ${assinatura}`);
    };
    for (const c of CENARIOS) {
      const r = resultadoDoGabarito(c);
      for (const { p } of passosDe(cardsDaMemoria(r))) {
        anota(`${p.id}|1`, `${p.simbolo}|${p.casas}`);
        for (const f of [...(p.expr ? folhasDe(p.expr) : []), ...(p.limiteExpr ? folhasDe(p.limiteExpr) : [])]) {
          if (f.tex.startsWith('\\sum')) continue; // soma de intervalo: não é a grandeza de uma célula
          anota(`${f.nome}|${f.fator ?? 1}`, `${f.tex}|${f.casas}`);
        }
      }
    }
    expect([...conflitos]).toEqual([]);
  });

  it('a conta de mão aparece onde ela é a da planilha (aula 12.2 e 12.3, sem água nem coesão)', () => {
    for (const c of ['aula122', 'aula123']) {
      const r = resultadoDoGabarito(c);
      const p = passosDe(cardsDaMemoria(r)).map((x) => x.p);
      for (const id of ['Ea_', 'Mk_', 'sh_topo', 'sh_base']) {
        const passo = p.find((x) => x.id === id && x.expr);
        expect(passo, `${c} · ${id}`).toBeDefined();
        expect(usaCelula(passo!.expr!), `${c} · ${id} caiu na soma das fatias`).toBe(false);
      }
    }
  });

  it('com o NA fora da divisão das fatias, a memória mostra a soma das fatias (é o número publicado)', () => {
    // sorteio10: h 1,6, NA a 0,5 m (fatia 12,5) — a forma fechada erraria na 4ª casa
    const r = resultadoDoGabarito('sorteio10');
    const ea = passosDe(cardsDaMemoria(r)).find((x) => x.p.id === 'Ea_')!.p;
    expect(usaCelula(ea.expr!)).toBe(true);
  });

  it('aula 12.2: os números da aula saem na linha', () => {
    const r = resultadoDoGabarito('aula122');
    const linhas = new Map(passosDe(cardsDaMemoria(r)).map(({ p }) => [p.id, texDaLinha(p, r)]));
    expect(linhas.get('Ka_')).toBe('K_a = 0{,}400');
    // he é do MURO (duas alturas desde 09/10): h_{muro}
    expect(linhas.get('he_')).toBe('h_e = 2\\,h_{muro} = 2 \\times 1{,}60 = 3{,}20\\,\\mathrm{m}');
    // S_δ com o solo no topo do muro: só a soma das fatias, como na aula (sem a parcela da rotação)
    expect(linhas.get('sum_d')).toMatch(/^S_\{\\delta\} = \\sum_\{i=1\}\^\{40\} D_i = 3\{,\}3110/);
    expect(linhas.get('lambda_')).toBe('\\lambda = \\dfrac{h_e}{t} = \\dfrac{3{,}20}{0{,}19} = 16{,}8 \\;\\le\\; 30');
    expect(linhas.get('Md_')).toBe('M_d = \\gamma_f\\,M_k = 1{,}40 \\times 6{,}21 = 8{,}70\\,\\mathrm{kN\\text{·}m/m}');
  });

  it('solo abaixo do topo do muro (09/10): S_δ mostra a parcela da rotação; empuxo com h_solo, esbeltez com h_muro', () => {
    for (const c of ['alvo_solo_abaixo_balanco', 'alvo_solo_abaixo_cf']) {
      const r = resultadoDoGabarito(c);
      const linhas = new Map(passosDe(cardsDaMemoria(r)).map(({ p }) => [p.id, texDaLinha(p, r)]));
      expect(linhas.get('sum_d'), c).toContain('R_i');
      expect(linhas.get('sum_d'), c).toContain('h_{muro}');
      expect(linhas.get('sum_d'), c).toContain('h_{solo}');
      expect(linhas.get('he_'), c).toContain('h_{muro}');
      expect(linhas.get('Mk_'), c).not.toContain('h_{muro}');
    }
  });

  it('as verificações dos cards aplicáveis formam a tabela-resumo', () => {
    // Com os 7 grupos escritos a lista cresce a cada verificação nova: o teste cobra as PROPRIEDADES, não a lista.
    const v122 = verificacoesDe(cardsDaMemoria(resultadoDoGabarito('aula122')));
    const ch122 = v122.map((x) => x.v.chave);
    expect(ch122).toContain('balanco.esbeltez');
    expect(v122.find((x) => x.v.chave === 'balanco.esbeltez')!.v.passa).toBe(true);
    expect(new Set(ch122).size, 'chave repetida no resumo').toBe(ch122.length);
    // aula 12.2 é balanço: nada de contraforte nem de painel entre contrafortes no resumo
    expect(ch122.filter((k) => /^(contraforte|painelCf)\./.test(k))).toEqual([]);
    // aula 12.3 é contraforte: o balanço não se aplica, o contraforte sim
    const ch123 = verificacoesDe(cardsDaMemoria(resultadoDoGabarito('aula123'))).map((x) => x.v.chave);
    expect(ch123.filter((k) => k.startsWith('balanco.'))).toEqual([]);
    expect(ch123.some((k) => k.startsWith('contraforte.'))).toBe(true);
  });

  it('a figura de cada card existe no acervo das entradas (o mesmo SVG do botão de imagem)', () => {
    const publico = fileURLToPath(new URL('../../public/', import.meta.url));
    const faltam = new Set<string>();
    for (const c of CENARIOS) {
      for (const card of cardsDaMemoria(resultadoDoGabarito(c))) {
        if (!card.figura) continue;
        const f = figuraDoCard(card.figura);
        if (!f || !existsSync(publico + f.url.replace(import.meta.env.BASE_URL, ''))) faltam.add(`${card.id}: ${card.figura}`);
      }
    }
    expect([...faltam]).toEqual([]);
  });

  it('veredito geral = as mesmas verificações do resumo', () => {
    // A aula 12.2 reprova UMA verificação, e é a planilha que diz: o Ø10 c/40 da aula dá As,ef 1,96 < 2,10 do As,mín
    // pelo critério do curso (0,15%·b·d) — a nota da aba Arranjos já registra. Se outra chave reprovar aqui, mudou a conta.
    const r122 = resultadoDoGabarito('aula122');
    const falhas122 = verificacoesDe(cardsDaMemoria(r122)).filter((x) => !x.v.passa).map((x) => x.v.chave);
    // Desde 10/10 (Jose): passivo desligado por padrão (NBR 6122 7.6.3) → a sapata do exemplo não passa ao deslizamento.
    // Desde 14/10 (Jose): a 1ª conta da sapata é a NBR 6118 22.6.1 — a de 0,30 m do exemplo (B 1,40, t 19) é
    // flexível, pede h ≥ (1,40 − 0,19)/3 = 0,40 ("a gente sobe 5 cm na altura").
    expect(falhas122).toEqual(['balanco.flexao.As', 'fundacao.rigidez', 'fundacao.deslizamento']);
    expect(vereditoDaMemoria(r122)).toEqual({ passa: false, falhas: 3 });
    expect(vereditoDaMemoria(resultadoDoGabarito('aula123'))).not.toBeNull();
    for (const c of CENARIOS) {
      const r = resultadoDoGabarito(c);
      const v = vereditoDaMemoria(r);
      const vs = verificacoesDe(cardsDaMemoria(r));
      if (v) expect(v.falhas, c).toBe(vs.filter((x) => !x.v.passa).length);
    }
  });

  it('tolerância da conferência é a combinada (1e-6)', () => {
    expect(TOLERANCIA).toBe(1e-6);
  });
});

describe('memória com o motor do app × memória com o Excel', () => {
  // No app quem entrega o Resultado é o avaliador em TS (calcular). A memória que o Jose lê na tela tem de ser,
  // letra por letra, a mesma que sai do número do Excel — inclusive na escolha da conta (forma fechada × fatias).
  it('as linhas são idênticas em todos os cenários do gabarito', () => {
    const diferentes: string[] = [];
    const linhas = (r: ReturnType<typeof calcular>) =>
      passosDe(cardsDaMemoria(r)).map(({ card, p }) => `${card.id} · ${texDaLinha(p, r)}${p.verif ? ` [${p.verif.passa ? 'OK' : 'NÃO'}]` : ''}`);
    for (const c of CENARIOS) {
      const doMotor = linhas(calcular(lerGabarito(c).alterado));
      const doExcel = linhas(resultadoDoGabarito(c));
      const i = doMotor.findIndex((l, j) => l !== doExcel[j]);
      if (i >= 0 || doMotor.length !== doExcel.length) {
        diferentes.push(`${c}: ${doMotor[i] ?? '(fim)'}  ×  ${doExcel[i] ?? '(fim)'}`);
      }
    }
    expect(diferentes).toEqual([]);
  });
});

describe('dicionário e glossário', () => {
  it('descrições curtas (≤ 70), sem ponto final', () => {
    for (const [s, d] of Object.entries(SIMBOLOS)) {
      expect(d.length, s).toBeLessThanOrEqual(70);
      expect(d.length, s).toBeGreaterThan(0);
      expect(d.endsWith('.'), s).toBe(false);
      expect(() => compila(s), s).not.toThrow();
    }
  });

  it('a ordem do glossário é estável: latinas A→Z, depois gregas na ordem grega', () => {
    // Com os 7 grupos o glossário tem centenas de símbolos: o teste cobra a REGRA (ordenado pela chave, latinas antes
    // das gregas, independente da ordem de entrada); os casos difíceis de ordenação estão no teste seguinte.
    for (const c of ['aula122', 'aula123', 'sorteio06']) {
      const g = glossarioDe(cardsDaMemoria(resultadoDoGabarito(c))).map(([s]) => s);
      expect(g.length, c).toBeGreaterThan(20);
      expect(ordenarSimbolos([...g].reverse()), c).toEqual(g);
      const chaves = g.map(chaveDeOrdem);
      expect([...chaves].sort(), c).toEqual(chaves);
      const primeiraGrega = chaves.findIndex((k) => k.startsWith('2'));
      if (primeiraGrega >= 0) expect(chaves.slice(primeiraGrega).every((k) => k.startsWith('2')), c).toBe(true);
    }
  });

  it('os defeitos de ordenação medidos no Pró-Viga ficam corrigidos', () => {
    const ordem = ordenarSimbolos(['\\ell_b', '\\ell_0', '\\cot\\theta', '(EI)_{sec}', '2A_c/u', 'A_0', 'a', 'b',
      '\\Delta\\sigma', '\\varepsilon_s', '\\delta', 's_{m\\acute{a}x}', 'd', 'e']);
    // pela raiz: "a" < "a0" < "acu"; empate de raiz desempata pelo TeX (maiúscula antes: Δ antes de δ)
    expect(ordem).toEqual(['a', 'A_0', '2A_c/u', 'b', '\\cot\\theta', 'd', 'e', '(EI)_{sec}', '\\ell_0', '\\ell_b',
      's_{m\\acute{a}x}', '\\Delta\\sigma', '\\delta', '\\varepsilon_s']);
    expect(chaveDeOrdem('\\alpha') < chaveDeOrdem('\\beta')).toBe(true);
    expect(chaveDeOrdem('z') < chaveDeOrdem('\\alpha')).toBe(true);
  });

  it('o aviso do solo da planilha está disponível para o rosto', () => {
    expect(AVISO_DO_SOLO.startsWith('AVISO')).toBe(true);
    expect(AVISO_DO_SOLO).toContain('ESCOLHA DO PROJETISTA');
  });
});
