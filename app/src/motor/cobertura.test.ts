/*
  DIAGNÓSTICO: o que o gabarito do Excel realmente exercita.

  O golden.test.ts prova que o motor bate com o Excel. Este arquivo responde a outra pergunta: QUAIS regras do
  Excel fazem diferença nos números desta planilha — e quais o gabarito nunca toca (essas ficam garantidas só
  pelas sondas de excel/sondas.test.ts). Faz isso de dois jeitos:

  1. "Mutação": troca uma regra do Excel pela versão ingênua (a que um programador escreveria de cabeça), refaz os
     cenários do gabarito e conta quantas células passam a divergir do Excel. Zero = o gabarito não exercita a
     regra. (Os alvo_*.json do tools/golden_alvos.py existem justamente para tirar algumas regras do zero.)
  2. Instrumentação: embrulha cada função do Excel e conta chamadas, ramos avaliados (SE verdadeiro/falso,
     SEERRO que pegou erro...) e os erros que circularam.

  Não reprova nada (é relatório); imprime o resumo no console do vitest.
*/
import { describe, expect, it, vi } from 'vitest';
import { carregarGabarito, igualAoExcel } from './excel/gabarito_prova';
import { aNumero, ERRO, escalar, type Escalar, type FuncaoExcel, type Thunk, type V } from './excel/avaliador';
import { analisar, type No } from './excel/sintaxe';
import dados from './planilha.gerada.json';
import type { PlanilhaExportada } from './tipos';

const cenarios = carregarGabarito();
const planilhaJson = dados as unknown as PlanilhaExportada;
type Motor = typeof import('./index');

async function motorCom(mocks: () => void): Promise<Motor> {
  vi.resetModules();
  mocks();
  const m = await import('./index');
  vi.doUnmock('./excel/numeros');
  vi.doUnmock('./excel/funcoes');
  vi.doUnmock('./excel/avaliador');
  vi.doUnmock('./excel/x87');
  return m;
}

function divergencias(m: Motor): { n: number; celulas: Set<string>; exemplo: string | null; bits: number } {
  let n = 0;
  let bits = 0;
  const celulas = new Set<string>();
  let exemplo: string | null = null;
  for (const g of cenarios) {
    const r = m.calcular(g.alterado);
    for (const [ref, excel] of Object.entries(g.celulas)) {
      const app = r.cel(ref);
      // Fora do último bit, mas dentro da tolerância do golden.test.ts: é onde potência e RADIANS aparecem.
      if (typeof excel === 'number' && typeof app === 'number' && excel !== app) bits++;
      if (igualAoExcel(excel, app)) continue;
      n++;
      celulas.add(ref);
      exemplo ??= `${g.cenario} ${ref}: Excel=${JSON.stringify(excel)}, ingênuo=${JSON.stringify(app)}  ← ${m.planilha.formula(ref)}`;
    }
  }
  return { n, celulas, exemplo, bits };
}

// ───────────── versões ingênuas ─────────────

const milharEn = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function fixoIngenuo(x: number, casas: number, semMilhar: boolean): string {
  // arredonda o DOUBLE (toFixed), sem olhar 15 dígitos e sem "meio para longe do zero" decimal
  const a = Math.abs(x);
  const s = casas >= 0 ? a.toFixed(casas) : String(Math.round(a / 10 ** -casas) * 10 ** -casas);
  const [i, f] = s.split('.');
  const corpo = (semMilhar ? i : milharEn(i)) + (f ? ',' + f : '');
  return (x < 0 && Number(s) !== 0 ? '-' : '') + corpo;
}

function numerica(f: (x: number, d: number) => number): FuncaoExcel {
  return (a, L, local) => {
    const x = aNumero(escalar(a[0]!(L), local, L));
    const d = a[1] ? aNumero(escalar(a[1](L), local, L)) : 0;
    if (typeof x !== 'number') return x;
    if (typeof d !== 'number') return d;
    return f(x, d);
  };
}
const longeDoZero = (x: number) => (x < 0 ? Math.floor(x) : Math.ceil(x));

// ───────────── leitura estática das fórmulas ─────────────

const formulas = Object.entries(planilhaJson.celulas).filter(
  (e): e is [string, string] => typeof e[1] === 'string' && e[1].startsWith('='),
);

function filhos(no: No): No[] {
  switch (no.k) {
    case 'fn':
      return no.args.filter((a): a is No => a !== null);
    case 'un':
    case 'par':
      return [no.a];
    case 'bin':
      return [no.a, no.b];
    default:
      return [];
  }
}

function contar(teste: (no: No, pai: No | null, idx: number) => boolean): { n: number; ex: string | null } {
  let n = 0;
  let ex: string | null = null;
  for (const [ref, f] of formulas) {
    const anda = (no: No, pai: No | null, idx: number) => {
      if (teste(no, pai, idx)) {
        n++;
        ex ??= `${ref}: ${f}`;
      }
      filhos(no).forEach((c, i) => anda(c, no, i));
    };
    anda(analisar(f), null, 0);
  }
  return { n, ex };
}

describe('cobertura do gabarito (diagnóstico)', () => {
  it('mutações: quais regras do Excel mudam números desta planilha', async () => {
    const real = await import('./excel/numeros');
    const variantes: [string, () => void][] = [
      [
        'comparação/INT/TETO com double exato (sem os 15 dígitos)',
        () => vi.doMock('./excel/numeros', async (orig) => ({ ...(await orig<typeof real>()), r15: (x: number) => x })),
      ],
      [
        'sem o "zero forçado" da última soma/subtração',
        () =>
          vi.doMock('./excel/numeros', async (orig) => ({
            ...(await orig<typeof real>()),
            zeroForcado: (_a: number, r: number) => r,
          })),
      ],
      [
        'INT/ARRED.PARA.CIMA/BAIXO/TETO ingênuos (Math.floor/ceil no double)',
        () =>
          vi.doMock('./excel/funcoes', async (orig) => {
            const o = await orig<typeof import('./excel/funcoes')>();
            return {
              ...o,
              FUNCOES: {
                ...o.FUNCOES,
                INT: numerica((x) => Math.floor(x)),
                ROUNDUP: numerica((x, d) => longeDoZero(x * 10 ** d) / 10 ** d),
                ROUNDDOWN: numerica((x, d) => Math.trunc(x * 10 ** d) / 10 ** d),
                CEILING: numerica((x, s) => Math.ceil(x / s) * s),
              },
            };
          }),
      ],
      [
        'DEF.NÚM.DEC arredondando o double (toFixed) em vez de 15 dígitos decimais',
        () => vi.doMock('./excel/numeros', async (orig) => ({ ...(await orig<typeof real>()), fixo: fixoIngenuo })),
      ],
      [
        'DEF.NÚM.DEC no formato en-US (ponto decimal)',
        () =>
          vi.doMock('./excel/numeros', async (orig) => ({
            ...(await orig<typeof real>()),
            fixo: (x: number, c: number) => x.toFixed(Math.max(0, c)),
          })),
      ],
      [
        'TEXTO "0%" com Math.round(x*100)',
        () =>
          vi.doMock('./excel/numeros', async (orig) => ({
            ...(await orig<typeof real>()),
            texto: (x: number) => `${Math.round(x * 100)}%`,
          })),
      ],
      [
        'número concatenado (&) com String(x) do JavaScript',
        () =>
          vi.doMock('./excel/numeros', async (orig) => ({
            ...(await orig<typeof real>()),
            textoGeral: (x: number) => String(x),
          })),
      ],
    ];
    variantes.push([
      'texto comparado COM caixa (=, <> e CORRESP/PROCV exatos)',
      () =>
        vi.doMock('./excel/avaliador', async (orig) => {
          // compilar() usa o OPERADORES do próprio módulo: troca dentro do objeto desta instância (nova a cada
          // resetModules, então não vaza para as outras variantes).
          const o = await orig<typeof import('./excel/avaliador')>();
          const eq = o.OPERADORES['='];
          const ne = o.OPERADORES['<>'];
          o.OPERADORES['='] = (x, y) => (typeof x === 'string' && typeof y === 'string' ? x === y : eq(x, y));
          o.OPERADORES['<>'] = (x, y) => (typeof x === 'string' && typeof y === 'string' ? x !== y : ne(x, y));
          return {
            ...o,
            igualExato: (alvo: Escalar, x: Escalar, re: RegExp | null) =>
              typeof alvo === 'string' && typeof x === 'string' && !re ? alvo === x : o.igualExato(alvo, x, re),
          };
        }),
    ]);
    variantes.push([
      'CORRESP/PROCV com procurado vazio dando #N/D (o motor antes da sonda do vazio)',
      () =>
        vi.doMock('./excel/funcoes', async (orig) => {
          const o = await orig<typeof import('./excel/funcoes')>();
          const naoAcha =
            (f: FuncaoExcel): FuncaoExcel =>
            (a, L, local) =>
              a[0] && escalar(a[0](L), local, L) === null ? ERRO.ND : f(a, L, local);
          return { ...o, FUNCOES: { ...o.FUNCOES, MATCH: naoAcha(o.FUNCOES.MATCH), VLOOKUP: naoAcha(o.FUNCOES.VLOOKUP) } };
        }),
    ]);
    variantes.push([
      'potência inteira (x^2, x^3, x^4) com Math.pow e RADIANS = x·π/180',
      () => {
        vi.doMock('./excel/avaliador', async (orig) => {
          // Mesmo truque da variante do texto: troca dentro do OPERADORES desta instância do módulo.
          const o = await orig<typeof import('./excel/avaliador')>();
          const pot = o.OPERADORES['^'];
          o.OPERADORES['^'] = (x, y) => {
            const a = o.aNumero(x);
            const b = o.aNumero(y);
            if (typeof a === 'number' && typeof b === 'number' && (b === 2 || b === 3 || b === 4)) return Math.pow(a, b);
            return pot(x, y);
          };
          return o;
        });
        vi.doMock('./excel/funcoes', async (orig) => {
          const o = await orig<typeof import('./excel/funcoes')>();
          return { ...o, FUNCOES: { ...o.FUNCOES, RADIANS: numerica((x) => (x * Math.PI) / 180) } };
        });
      },
    ]);
    variantes.push([
      'aritmética do JavaScript (sem os 64 bits do x87: +, −, ×, ÷, RAIZ, potência, TAN)',
      () =>
        vi.doMock('./excel/x87', async () => ({
          arred80: (s: number) => s,
          soma80: (a: number, b: number) => a + b,
          mult80: (a: number, b: number) => a * b,
          div80: (a: number, b: number) => a / b,
          raiz80: Math.sqrt,
          tan80: Math.tan,
          ln80: Math.log,
          exp80: Math.exp,
          potencia80: Math.pow,
        })),
    ]);
    const base = divergencias(await motorCom(() => {}));
    const linhas: string[] = [
      `MUTAÇÕES (células divergentes do Excel somando os ${cenarios.length} cenários; entre colchetes, a variação das ` +
        `células numéricas fora do último bit — o motor de verdade tem ${base.bits}):`,
    ];
    for (const [nome, mock] of variantes) {
      const d = divergencias(await motorCom(mock));
      const db = d.bits - base.bits;
      linhas.push(
        `  ${nome}: ${d.n} (${d.celulas.size} células distintas) [bit: ${db >= 0 ? '+' : ''}${db}]` +
          `${d.exemplo ? `\n      ex.: ${d.exemplo}` : ''}`,
      );
    }

    // Leituras estáticas (regras que não dá para "desligar" sem mexer no analisador).
    const menosPot = contar((no) => no.k === 'bin' && no.op === '^' && no.a.k === 'un' && no.a.op === '-');
    linhas.push(`  -x^2 (menos unário antes da potência): ${menosPot.n} ocorrência(s)${menosPot.ex ? ` — ${menosPot.ex}` : ''}`);
    const raizSoma = formulas.filter(([, f]) => {
      const r = analisar(f);
      return r.k === 'bin' && (r.op === '+' || r.op === '-');
    }).length;
    linhas.push(`  fórmulas cuja última operação é + ou − (onde o zero forçado PODE agir): ${raizSoma}`);
    // Interseção implícita: intervalo de várias células onde a fórmula espera UM valor, fora de SOMARPRODUTO.
    const aceita: Record<string, number[] | 'todos'> = {
      SUM: 'todos', MAX: 'todos', MIN: 'todos', AND: 'todos', OR: 'todos', SUMPRODUCT: 'todos',
      INDEX: [0], MATCH: [1], VLOOKUP: [1],
    };
    const repassa: Record<string, (i: number) => boolean> = { IF: (i) => i > 0, CHOOSE: (i) => i > 0, IFERROR: (i) => i === 1 };
    const multi = (no: No) =>
      (no.k === 'ref' && (no.r1 !== no.r2 || no.c1 !== no.c2)) ||
      (no.k === 'nome' && (planilhaJson.nomes[no.v] ?? '').includes(':'));
    let intersecoes = 0;
    let exInter: string | null = null;
    for (const [ref, f] of formulas) {
      const anda = (no: No, ok: boolean, mat: boolean) => {
        if (multi(no) && !ok && !mat) {
          intersecoes++;
          exInter ??= `${ref}: ${f}`;
        }
        if (no.k === 'fn') {
          const lista = aceita[no.nome];
          no.args.forEach((a, i) => {
            if (!a) return;
            const okF = lista === 'todos' || (lista?.includes(i) ?? false) || (ok && (repassa[no.nome]?.(i) ?? false));
            anda(a, okF, mat || no.nome === 'SUMPRODUCT');
          });
        } else if (no.k === 'par') anda(no.a, ok, mat);
        else filhos(no).forEach((c) => anda(c, false, mat));
      };
      anda(analisar(f), false, false);
    }
    linhas.push(`  interseção implícita (intervalo usado como valor único): ${intersecoes}${exInter ? ` — ${exInter}` : ''}`);
    const cmpTexto = contar(
      (no) => no.k === 'bin' && ['=', '<>'].includes(no.op) && (no.a.k === 'str' || no.b.k === 'str'),
    );
    linhas.push(`  comparações com texto literal (caixa ignorada): ${cmpTexto.n}`);
    console.log(linhas.join('\n'));
    expect(variantes.length).toBeGreaterThan(0);
    // Cada variante refaz todos os cenários do gabarito (são ~60): o padrão de 5 s do vitest não basta, e o estouro
    // de tempo deixava um mock pendurado que derrubava o teste seguinte.
  }, 300_000);

  it('instrumentação: chamadas, ramos e erros por função', async () => {
    interface Est {
      chamadas: number;
      args: number[]; // quantas vezes cada argumento foi avaliado
      erros: Map<string, number>; // erros devolvidos pela função
      notas: Map<string, number>;
    }
    const est = new Map<string, Est>();
    const nota = (e: Est, k: string) => e.notas.set(k, (e.notas.get(k) ?? 0) + 1);
    // Ramo a ramo, por SÍTIO de SE (cada SE dentro de cada fórmula): o vetor de argumentos é compilado uma vez por
    // sítio, então serve de identidade. Separa sorteios/aulas dos alvo_*, para medir o que os alvos acrescentaram.
    const sitios = new Map<readonly (Thunk | null)[], { lados: Set<string> }>();
    let ehAlvo = false;
    const m = await motorCom(() =>
      vi.doMock('./excel/funcoes', async (orig) => {
        const o = await orig<typeof import('./excel/funcoes')>();
        const F: Record<string, FuncaoExcel> = {};
        for (const [nome, f] of Object.entries(o.FUNCOES)) {
          F[nome] = (args, L, local) => {
            let e = est.get(nome);
            if (!e) est.set(nome, (e = { chamadas: 0, args: [], erros: new Map(), notas: new Map() }));
            e.chamadas++;
            const vals: (V | undefined)[] = [];
            const emb = args.map((t, i): Thunk | null =>
              t
                ? (L2) => {
                    e.args[i] = (e.args[i] ?? 0) + 1;
                    const v = t(L2);
                    vals[i] = v;
                    return v;
                  }
                : null,
            );
            const r = f(emb, L, local);
            const ver = (i: number): Escalar | undefined => (vals[i] === undefined ? undefined : escalar(vals[i]!, local, L));
            const v0 = ver(0);
            const v1 = ver(1);
            const ehE = (x: unknown): x is { erro: string } => typeof x === 'object' && x !== null && 'erro' in x;
            if (ehE(r)) e.erros.set(r.erro, (e.erros.get(r.erro) ?? 0) + 1);
            if (nome === 'IFERROR' && ehE(v0)) nota(e, `pegou ${v0.erro}`);
            if (nome === 'IF' && args.length === 2 && r === false) nota(e, 'SE de 2 argumentos devolveu FALSO');
            if (nome === 'MATCH') nota(e, `tipo ${args.length > 2 ? String(ver(2)) : '1 (omitido)'}`);
            if (nome === 'VLOOKUP') nota(e, `aproximado=${String(ver(3) ?? 'omitido')}`);
            if (nome === 'INDEX') nota(e, `${typeof vals[0] === 'object' && vals[0] && 'k' in vals[0] ? vals[0].k : 'escalar'}, ${args.length > 2 ? 'linha+coluna' : 'só índice'}`);
            if (nome === 'FIXED' && typeof v0 === 'number') {
              if (Math.abs(v0) >= 1000) nota(e, 'com milhar (≥ 1000)');
              if (v0 < 0) nota(e, 'negativo');
              nota(e, `casas=${String(v1 ?? 2)}`);
            }
            if (['INT', 'ROUNDUP', 'ROUNDDOWN', 'CEILING'].includes(nome) && typeof v0 === 'number') {
              if (v0 < 0) nota(e, 'argumento negativo');
              if (v0 !== 0 && Math.abs(v0 - Math.round(v0)) < 1e-12 && !Number.isInteger(v0))
                nota(e, 'argumento a 1e-12 de um inteiro (15 dígitos decidem)');
            }
            if (nome === 'CHOOSE') nota(e, `índice ${String(v0)}`);
            if (nome === 'TEXT') nota(e, `formato ${JSON.stringify(v1)}`);
            if (nome === 'IF' && ehE(v0)) nota(e, `condição com erro ${v0.erro}`);
            if (nome === 'IF') {
              let s = sitios.get(args);
              if (!s) sitios.set(args, (s = { lados: new Set() }));
              const lado = vals[1] !== undefined ? 'V' : vals[2] !== undefined || (args.length < 3 && r === false) ? 'F' : null;
              if (lado) s.lados.add(`${lado}${ehAlvo ? '+' : ''}`);
            }
            return r;
          };
        }
        return { ...o, FUNCOES: F };
      }),
    );
    for (const g of cenarios) {
      ehAlvo = g.cenario.startsWith('alvo_');
      const r = m.calcular(g.alterado);
      for (const ref of Object.keys(g.celulas)) r.cel(ref);
    }
    const linhas = [`INSTRUMENTAÇÃO (${cenarios.length} cenários):`];
    const faltaLado = (comAlvos: boolean) =>
      [...sitios.values()].filter((s) => {
        const tem = (l: string) => s.lados.has(l) || (comAlvos && s.lados.has(`${l}+`));
        return !tem('V') || !tem('F');
      }).length;
    linhas.push(
      `  SE: ${sitios.size} sítios; com um lado nunca tomado: ${faltaLado(false)} só com aulas e sorteios → ` +
        `${faltaLado(true)} com os alvo_* (o resto é ramo morto por construção ou inalcançável na faixa real)`,
    );
    // Células com fórmula que dão o MESMO valor em todo cenário: ou são constantes por construção, ou o gabarito
    // não mexe no que as move.
    const constantes = (comAlvos: boolean) => {
      const usados = cenarios.filter((g) => comAlvos || !g.cenario.startsWith('alvo_'));
      return Object.keys(usados[0].celulas).filter((ref) => {
        const v0 = JSON.stringify(usados[0].celulas[ref]);
        return usados.every((g) => JSON.stringify(g.celulas[ref]) === v0);
      }).length;
    };
    linhas.push(`  células com fórmula de valor fixo em todos os cenários: ${constantes(false)} só com aulas e sorteios → ${constantes(true)} com os alvo_*`);
    for (const [nome, e] of [...est].sort((a, b) => b[1].chamadas - a[1].chamadas)) {
      const args = e.args.map((n, i) => `a${i + 1}:${n ?? 0}`).join(' ');
      const erros = [...e.erros].map(([k, n]) => `${k}×${n}`).join(' ');
      const notas = [...e.notas].map(([k, n]) => `${k}×${n}`).join('; ');
      linhas.push(`  ${nome.padEnd(10)} ${String(e.chamadas).padStart(6)} chamadas | args avaliados ${args}` +
        `${erros ? ` | erros ${erros}` : ''}${notas ? `\n             ${notas}` : ''}`);
    }
    const usadas = new Set(est.keys());
    const nunca = Object.keys((await import('./excel/funcoes')).FUNCOES).filter((f) => !usadas.has(f));
    linhas.push(`  funções do motor nunca chamadas no gabarito: ${nunca.length ? nunca.join(', ') : 'nenhuma'}`);
    console.log(linhas.join('\n'));
    expect(est.size).toBeGreaterThan(0);
  }, 120_000);
});
