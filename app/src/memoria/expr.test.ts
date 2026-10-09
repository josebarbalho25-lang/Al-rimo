/*
  O desenho da conta, peça por peça: vírgula colada, negativo entre parênteses, "−0" que não existe, tg²(45° − φ'/2)
  como se escreve à mão, \min com ";" que o Word não reordena — e o .doc montado com BOM e seção A4.
*/
import { describe, expect, it } from 'vitest';
import katex from 'katex';
import type { Resultado, Valor } from '@/motor/tipos';
import { arredBaixo, arredCima, cte, div, inteiro, max, min, mul, neg, nome, pi, pot, rad, raiz, soma, sub, tan, avaliar, texNumerico, texSimbolico, celulasDoIntervalo } from './expr';
import { casasDoFormato, nbr, nt, ntp, texUnidade } from './formato';
import { texDaLinha, textoDoChip } from './linha';
import { passo, verificacao } from './passo';
import { simbolosDoPasso } from './glossario';
import { montarDocumento, nomeDoArquivo } from './word';

/** Resultado de mentira, só com os nomes que o teste usa. */
function falso(nomes: Record<string, Valor>, celulas: Record<string, Valor> = {}): Resultado {
  return {
    v: (n) => {
      if (!(n in nomes)) throw new Error(`nome inexistente: ${n}`);
      return nomes[n];
    },
    num: (n) => (typeof nomes[n] === 'number' ? (nomes[n] as number) : null),
    cel: (ref) => celulas[ref] ?? null,
    alteracoes: {},
  };
}

describe('números no TeX', () => {
  it('vírgula decimal colada ("12{,}34") e casas da célula', () => {
    expect(nt(12.345, 2)).toBe('12{,}35');
    expect(nt(19, 0)).toBe('19');
    expect(nbr(0.4, 3)).toBe('0,400');
  });
  it('sem "−0,00"', () => {
    expect(nbr(-0.001, 2)).toBe('0,00');
    expect(nt(-0.0001, 1)).toBe('0{,}0');
  });
  it('milhar só a partir de 5 dígitos (2687 · 269.849)', () => {
    expect(nbr(2687, 0)).toBe('2687');
    expect(nbr(269849, 0)).toBe('269.849');
  });
  it('negativo entre parênteses na substituição', () => {
    expect(ntp(-5, 1)).toBe('\\left(-5{,}0\\right)');
    expect(ntp(5, 1)).toBe('5{,}0');
  });
  it('casas pelo formato do Excel', () => {
    expect(casasDoFormato('0.000')).toBe(3);
    expect(casasDoFormato('0')).toBe(0);
    expect(casasDoFormato('General')).toBeNull();
  });
  it('unidades', () => {
    expect(texUnidade('kN·m/m')).toBe('\\,\\mathrm{kN\\text{·}m/m}');
    expect(texUnidade('°')).toBe('^{\\circ}');
    expect(texUnidade('golpes')).toBe('\\,\\mathrm{golpes}');
  });
});

describe('expressão: desenha e avalia a mesma árvore', () => {
  const r = falso({ phi_solo: 30, H_muro: 1.6, q_sobre: 2, gama_solo: 19, Ka_: 1 / 3, x: -2, t_bloco: 19 });
  const phi = nome('phi_solo', "\\varphi'", 1, '°');
  const h = nome('H_muro', 'h', 2, 'm');
  const Ka = nome('Ka_', 'K_a', 3);

  it("tg²(45° − φ'/2), com o grau só nas parcelas", () => {
    const e = pot(tan(rad(sub(cte(45, 0), div(phi, cte(2, 0))))), 2);
    expect(texSimbolico(e)).toBe("\\operatorname{tg}^{2}\\left(45^{\\circ} - \\dfrac{\\varphi'}{2}\\right)");
    expect(texNumerico(e, r)).toBe('\\operatorname{tg}^{2}\\left(45^{\\circ} - \\dfrac{30{,}0^{\\circ}}{2}\\right)');
    expect(avaliar(e, r)).toBeCloseTo(1 / 3, 12);
  });

  it('produto: justaposição no simbólico, × nos números, parênteses na soma', () => {
    const e = mul(Ka, soma(nome('q_sobre', 'q', 1), mul(nome('gama_solo', '\\gamma', 1), h)));
    expect(texSimbolico(e)).toBe('K_a\\left(q + \\gamma\\,h\\right)');
    expect(texNumerico(e, r)).toBe('0{,}333 \\times \\left(2{,}0 + 19{,}0 \\times 1{,}60\\right)');
  });

  it('entre dois números o produto é "·" também no simbólico', () => {
    expect(texSimbolico(mul(cte(0.5, 1), cte(100, 0)))).toBe('0{,}5 \\cdot 100');
  });

  it('negativo à direita vai entre parênteses; "a − (b + c)" mantém os parênteses', () => {
    const x = nome('x', 'x', 1);
    expect(texNumerico(soma(h, x), r)).toBe('1{,}60 + \\left(-2{,}0\\right)');
    expect(texNumerico(mul(h, x), r)).toBe('1{,}60 \\times \\left(-2{,}0\\right)');
    expect(texSimbolico(sub(h, soma(x, h)))).toBe('h - \\left(x + h\\right)');
    expect(texSimbolico(neg(soma(x, h)))).toBe('-\\left(x + h\\right)');
    expect(avaliar(sub(h, soma(x, h)), r)).toBeCloseTo(2, 12);
  });

  it('potência de σ\' leva chaves (senão é expoente duplo no TeX)', () => {
    const s = pot(nome('Ka_', "\\sigma'_{h}", 2), 2);
    expect(texSimbolico(s)).toBe("{\\sigma'_{h}}^{2}");
    expect(() => katex.renderToString(texSimbolico(s), { throwOnError: true })).not.toThrow();
  });

  it('min/max com ";" e raiz', () => {
    const e = min(mul(cte(2.5, 1), h), mul(cte(0.7, 1), raiz(h)));
    expect(texSimbolico(e)).toBe('\\min\\left(2{,}5\\,h\\,;\\,0{,}7\\,\\sqrt{h}\\right)');
    expect(avaliar(max(cte(0, 0), neg(h)), r)).toBe(0);
  });

  it('fator troca a unidade na leitura (t em cm → m)', () => {
    const t = nome('t_bloco', 't', 2, 'm', { fator: 0.01 });
    expect(texNumerico(div(h, t), r)).toBe('\\dfrac{1{,}60}{0{,}19}');
    expect(avaliar(div(h, t), r)).toBeCloseTo(1.6 / 0.19, 12);
  });

  it('endereço e intervalo da planilha (o intervalo é somado, como o SUM)', () => {
    const rc = falso({}, { 'Aba!F1': 1, 'Aba!F2': 2, 'Aba!F3': 'texto', 'Aba!F4': 4 });
    expect(celulasDoIntervalo('Aba!F1:F4')).toEqual(['Aba!F1', 'Aba!F2', 'Aba!F3', 'Aba!F4']);
    expect(avaliar(nome('Aba!F1:F4', '\\sum F', 2), rc)).toBe(7);
    expect(avaliar(nome('Aba!F2', 'F_2', 2), rc)).toBe(2);
  });

  it('nome inexistente LANÇA (defeito do autor, não "—")', () => {
    expect(() => avaliar(nome('nao_existe', 'x', 2), r)).toThrow();
  });
});

describe('π e arredondamentos da planilha', () => {
  const r = falso({ As_: 2.30, phi_: 10, s_calc: 47.3, neg_: -2.5, quase: 2 + 4e-16 });
  const As = nome('As_', 'A_s', 2, 'cm²');
  const phi = nome('phi_', '\\phi', 1, 'mm');
  // área de uma barra: π·Ø²/400 (Ø em mm → cm²), como em Contrafortes!D72
  const a1 = div(mul(pi(), pot(phi, 2)), cte(400, 0));

  it('π escrito como π nas duas linhas e avaliado como PI()', () => {
    expect(texSimbolico(a1)).toBe('\\dfrac{\\pi\\,\\phi^{2}}{400}');
    expect(texNumerico(a1, r)).toBe('\\dfrac{\\pi \\times 10{,}0^{2}}{400}');
    expect(avaliar(a1, r)).toBeCloseTo(Math.PI * 100 / 400, 14);
  });

  it('ROUNDUP(As/a − 0,005; 0) desenha ⌈ ⌉ com a folga escrita', () => {
    const n = arredCima(sub(div(As, a1), cte(0.005, 3)));
    expect(texSimbolico(n)).toBe('\\left\\lceil \\dfrac{A_s}{\\dfrac{\\pi\\,\\phi^{2}}{400}} - 0{,}005 \\right\\rceil');
    expect(avaliar(n, r)).toBe(3);
    expect(() => katex.renderToString(texNumerico(n, r), { throwOnError: true })).not.toThrow();
  });

  it('ROUNDDOWN(s/20; 0)·20 e INT: ⌊ ⌋; ROUNDDOWN corta em direção ao zero, INT desce', () => {
    const s = nome('s_calc', 's', 1, 'cm');
    expect(avaliar(mul(arredBaixo(div(s, cte(20, 0))), cte(20, 0)), r)).toBe(40);
    expect(texSimbolico(arredBaixo(div(s, cte(20, 0))))).toBe('\\left\\lfloor \\dfrac{s}{20} \\right\\rfloor');
    const x = nome('neg_', 'x', 1);
    expect(avaliar(arredBaixo(x), r)).toBe(-2);
    expect(avaliar(inteiro(x), r)).toBe(-3);
    expect(avaliar(arredCima(x), r)).toBe(-3);
  });

  it('arredonda olhando 15 algarismos, como o Excel (2 + 4e-16 não sobe para 3)', () => {
    expect(avaliar(arredCima(nome('quase', 'x', 2)), r)).toBe(2);
  });
});

describe('limite da desigualdade lido da planilha', () => {
  const r = falso({ d_inf: 9.8, d_adm: 12.8, FS_: 1.7 });
  const dInf = nome('d_inf', '\\delta_\\infty', 1, 'mm');
  const dAdm = nome('d_adm', '\\delta_{adm}', 1, 'mm');

  it('o lado direito mostra o símbolo e o número da célula; o símbolo vai para o glossário', () => {
    const p = passo(r, 'd_inf', '\\delta_\\infty', null, {
      casas: 1, unidade: 'mm', origem: 'calculado',
      verif: { chave: 'els.flecha', rotulo: 'δ∞ ≤ δadm', limite: dAdm, relacao: '<=' },
    });
    expect(p.verif!.limite).toBe(12.8);
    expect(texDaLinha(p, r)).toBe('\\delta_\\infty = 9{,}8\\,\\mathrm{mm} \\;\\le\\; \\delta_{adm} = 12{,}8\\,\\mathrm{mm}');
    expect(simbolosDoPasso(p)).toEqual(['\\delta_\\infty', '\\delta_{adm}']);
    expect(p.limiteExpr).toBe(dAdm);
    void dInf;
  });

  it('desigualdade que não atende troca o sinal (a escrita nunca mente)', () => {
    const p = passo(r, 'FS_', 'FS', null, {
      casas: 2, origem: 'calculado', verif: { chave: 'f.fs', rotulo: 'FS ≥ 2,0', limite: 2, relacao: '>=', casasLimite: 1 },
    });
    expect(texDaLinha(p, r)).toBe('FS = 1{,}70 \\;<\\; 2{,}0');
    expect(textoDoChip(p.verif!)).toBe('NÃO PASSA · 118%');
  });

  it('limite que é conta é recusado: tem de ser publicado como passo antes', () => {
    expect(() => verificacao(1, { chave: 'x', rotulo: 'x', limite: mul(cte(2, 0), dAdm), relacao: '<=' }, r)).toThrow();
  });
});

describe('passo e linha', () => {
  const r = falso({ he_: 3.2, t_bloco: 19, lambda_: 3.2 / 0.19, Md_: 'não resiste' }, { 'Aba!B1': 'NÃO OK' });
  const he = nome('he_', 'h_e', 2, 'm');
  const t = nome('t_bloco', 't', 2, 'm', { fator: 0.01 });

  it('a linha termina na desigualdade e o chip mostra o uso', () => {
    const p = passo(r, 'lambda_', '\\lambda', div(he, t), {
      casas: 1,
      verif: { chave: 'x.lambda', rotulo: 'λ ≤ 30', limite: 30, relacao: '<=', casasLimite: 0 },
    });
    expect(texDaLinha(p, r)).toBe('\\lambda = \\dfrac{h_e}{t} = \\dfrac{3{,}20}{0{,}19} = 16{,}8 \\;\\le\\; 30');
    expect(textoDoChip(p.verif!)).toBe('OK · 56%');
  });

  it('alternativas: vale a primeira que reproduz a célula', () => {
    const errada = mul(cte(2, 0), he);
    const certa = div(he, t);
    const p = passo(r, 'lambda_', '\\lambda', [errada, certa], { casas: 1 });
    expect(p.expr).toBe(certa);
  });

  it('a célula de veredito da planilha decide o chip; o sinal escrito segue a comparação', () => {
    const v = verificacao(16.8, { chave: 'x', rotulo: 'x', limite: 30, relacao: '<=', celula: 'Aba!B1' }, r);
    expect(v.passa).toBe(false); // a planilha disse NÃO OK (o teste de conferência pega a discordância)
    const v2 = verificacao(40, { chave: 'y', rotulo: 'y', limite: 30, relacao: '>=' });
    expect(v2.passa).toBe(true);
    expect(v2.util).toBeCloseTo(75, 9);
  });

  it('célula com texto: a linha mostra a fórmula e o texto, sem substituição', () => {
    const p = passo(r, 'Md_', 'M_d', mul(cte(1.4, 2), he), { casas: 2, unidade: 'kN·m/m' });
    expect(texDaLinha(p, r)).toBe('M_d = 1{,}40\\,h_e = \\text{não resiste}');
  });
});

describe('Word', () => {
  it('documento com seção A4, equações fora do CSS do KaTeX e prancha em paisagem', () => {
    const d = montarDocumento({ retrato: '<p>a</p>', prancha: '<p>b</p>' }, 'Muro <1>');
    expect(d).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(d).toContain('@page WordSection1 {size:595.3pt 841.9pt');
    expect(d).toContain('<div class=WordSection2>');
    expect(d).toContain('mso-break-type:section-break');
    // equação de exibição alinhada à esquerda (sem isto o Word centra cada linha da conta)
    expect(d).toContain('xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"');
    expect(d).toContain('<m:defJc m:val="left"/>');
    expect(d).toContain('<title>Muro 1</title>');
    expect(d).not.toContain('katex');
  });
  it('nome de arquivo sem acento nem espaço', () => {
    expect(nomeDoArquivo('Muro da divisa — Uberaba')).toBe('Muro_da_divisa_Uberaba_memorial.doc');
    expect(nomeDoArquivo(undefined)).toBe('Arrimo_memorial.doc');
  });
});
