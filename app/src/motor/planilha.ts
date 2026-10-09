/*
  PLANILHA — carrega o planilha.gerada.json, compila todas as fórmulas uma vez e calcula sob demanda.

  calcular(alteracoes) devolve um Resultado PREGUIÇOSO: nenhuma célula é calculada até alguém pedir; quando
  pede, calcula a célula e, por tabela, só o que ela usa — e guarda (memória), para não calcular duas vezes.
  Assim a tela que só mostra o painel não paga a fundação inteira, e a conta completa continua barata.

  Duas portas de entrada, de propósito:
    - calcular(): a porta do APP. Aceita só as entradas da aba Entradas e confere cada valor como o Excel o
      gravaria se o usuário digitasse ou escolhesse na lista (ver converterEntrada). O formulário manda texto
      ("19", "1,6", ""), e a conta não pode mudar em silêncio por causa disso: o Excel grava o NÚMERO 19 quando
      se escolhe "19" na lista, e `t_bloco=19` só dá VERDADEIRO com número — com o texto "19", 78 células mudam.
      Valor que o formulário não deveria mandar (fora da lista, texto em campo numérico, NaN, undefined) faz a
      conta LANÇAR erro, como nome errado: é defeito de quem chamou, e "—" na tela esconderia o defeito.
    - simular(): escreve qualquer nome de célula única do jeito que veio, como o tools/cenarios.aplicar faz pelo
      openpyxl — inclusive por cima de fórmula, como no Excel. Para teste e para "e se" (fixar um resultado
      intermediário e ver o que acontece adiante). O app não usa.
*/
import type { Alteracoes, EntradaMeta, PlanilhaExportada, Resultado, Valor } from './tipos';
import {
  compilarFormula,
  type Ambiente,
  type Escalar,
  type FormulaCompilada,
  type Intervalo,
  type Leitor,
} from './excel/avaliador';
import { celulaDe } from './excel/lexico';
import { numeroDeTexto } from './excel/numeros';
import { FUNCOES, MATRICIAIS } from './excel/funcoes';

// Chave numérica de uma célula: cabe folgado num double (9 abas × 2^20 linhas × 2^14 colunas).
const chave = (aba: number, lin: number, col: number): number => (aba * 1048577 + lin) * 16385 + col;

/** Fórmula que chama a si mesma (direta ou indiretamente). É defeito do gerador: a planilha não tem ciclo. */
export class ErroCiclo extends Error {
  constructor(public readonly caminho: string[]) {
    super(`referência circular: ${caminho.join(' → ')}`);
  }
}

/** 'Aba!B12', "'Aba'!$B$12" ou 'Aba!B2:C5' → partes. */
function separarRef(ref: string): { aba: string; a: string; b: string } {
  const i = ref.lastIndexOf('!');
  if (i < 0) throw new Error(`referência sem aba: ${ref}`);
  let aba = ref.slice(0, i);
  if (aba.startsWith("'") && aba.endsWith("'")) aba = aba.slice(1, -1).replace(/''/g, "'");
  const [a, b] = ref.slice(i + 1).replace(/\$/g, '').split(':');
  return { aba, a, b: b ?? a };
}

/**
 * Texto → valor como o Excel grava quando o usuário DIGITA na célula (ou escolhe na lista, que dá no mesmo):
 * texto que é número no pt-BR ("19", "1,6", "1.234,5", "50%") vira número; texto vazio (ou só espaço) limpa a
 * célula. "1.6" NÃO vira 1,6: no pt-BR o ponto é milhar ("1.600" é 1600), e adivinhar seria pior que recusar.
 */
function comoDigitado(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (v.trim() === '') return null;
  const n = numeroDeTexto(v);
  return n === null ? v : n;
}

/** Lista da validação de dados com o tipo que o Excel grava (as listas literais "14,19" saem do .xlsx como texto). */
function normalizarMeta(m: EntradaMeta): EntradaMeta {
  if (!m.opcoes) return m;
  return { ...m, opcoes: m.opcoes.map((o) => comoDigitado(o) as Valor) };
}

const mostra = (v: unknown): string => (typeof v === 'string' ? `"${v}"` : String(v));

/**
 * Confere e converte UM valor de entrada para a conta (a regra está no cabeçalho do arquivo). Lança erro com
 * mensagem legível quando o valor não pode ir para a planilha.
 */
function conferirEntrada(meta: EntradaMeta, bruto: unknown): Valor {
  if (bruto === undefined) {
    // Chave com undefined vinha virando "em branco" — e branco é outra coisa: H_muro em branco muda 777 células.
    // Para manter o padrão, a chave não vai; para deixar em branco, vai null.
    throw new Error(`${meta.nome}: valor undefined (para manter o padrão, não mande a chave; para deixar em branco, mande null)`);
  }
  const v = comoDigitado(bruto);
  if (typeof v === 'number' && !Number.isFinite(v)) {
    // O Excel não tem NaN nem infinito; aqui eles espalham NaN pela conta ou derrubam a montagem de texto.
    throw new Error(`${meta.nome}: número inválido (${v})`);
  }
  if (v !== null && typeof v !== 'number' && typeof v !== 'string') {
    throw new Error(`${meta.nome}: valor de tipo não aceito (${JSON.stringify(v)})`);
  }
  if (meta.opcoes) {
    const lista = meta.opcoes.map(mostra).join(', ');
    // Lista com célula vazia no intervalo (o "automático" das entradas opcionais, ex.: canaletas dos contrafortes):
    // em branco é uma das opções.
    if (v === null && meta.opcoes.includes(null)) return null;
    if (v === null) throw new Error(`${meta.nome}: em branco, mas é escolha da lista (${lista})`);
    // Texto da lista sem diferenciar maiúscula (a planilha compara assim) e devolvido como está na lista;
    // número só se for exatamente um dos itens. Fora da lista é erro: "Contraforte" sem o s cairia no ramo
    // do balanço sem nenhum aviso (a validação desta planilha não barra — o openpyxl a grava sem alerta de erro).
    const achado = meta.opcoes.find((o) =>
      typeof v === 'number' ? o === v : typeof o === 'string' && o.toLowerCase() === v.toLowerCase(),
    );
    if (achado === undefined) throw new Error(`${meta.nome}: ${mostra(v)} não está na lista (${lista})`);
    return achado;
  }
  if (typeof v === 'string') throw new Error(`${meta.nome}: ${mostra(v)} não é número`);
  return v;
}

/** Até onde cada aba tem alguma coisa (célula ou nome definido): ler além disso é endereço digitado errado. */
interface Limite {
  lin: number;
  col: number;
}

export class Planilha {
  readonly versao: string;
  readonly abas: readonly string[];
  readonly entradas: readonly EntradaMeta[];

  private readonly abaIdx = new Map<string, number>();
  private readonly nomes = new Map<string, Intervalo>();
  private readonly entradaPorNome = new Map<string, EntradaMeta>(); // nome em minúsculas → meta
  private readonly indice = new Map<number, number>(); // chave → posição nos vetores abaixo
  private readonly enderecos: string[] = [];
  private readonly constantes: Escalar[] = [];
  private readonly formulas: (FormulaCompilada | null)[] = [];
  private readonly textos: (string | null)[] = [];
  private readonly limites: Limite[];
  // cel('Aba!B12') é chamado centenas de vezes por tela (memória): decodificar o endereço uma vez só.
  private readonly refs = new Map<string, Intervalo>();

  constructor(dados: PlanilhaExportada) {
    this.versao = dados.versao;
    this.abas = dados.abas;
    // Cópias: o JSON importado é o mesmo objeto para quem mais o importar (testes leem o JSON cru).
    this.entradas = Object.freeze(dados.entradas.map(normalizarMeta));
    for (const m of this.entradas) this.entradaPorNome.set(m.nome.toLowerCase(), m);
    dados.abas.forEach((a, i) => this.abaIdx.set(a.toLowerCase(), i));
    this.limites = dados.abas.map(() => ({ lin: 0, col: 0 }));
    const estende = (r: Intervalo) => {
      const l = this.limites[r.aba];
      if (r.r2 > l.lin) l.lin = r.r2;
      if (r.c2 > l.col) l.col = r.c2;
    };

    // Nome definido no Excel não diferencia maiúscula de minúscula.
    for (const [nome, ref] of Object.entries(dados.nomes)) {
      const r = this.intervalo(ref);
      this.nomes.set(nome.toLowerCase(), r);
      estende(r);
    }

    const amb: Ambiente = {
      aba: (n) => this.abaIdx.get(n.toLowerCase()),
      nome: (n) => this.nomes.get(n.toLowerCase()),
      funcao: (n) => FUNCOES[n],
      matricial: (n) => MATRICIAIS.has(n),
    };

    for (const [ref, v] of Object.entries(dados.celulas)) {
      const r = this.intervalo(ref);
      estende(r);
      const i = this.enderecos.length;
      this.indice.set(chave(r.aba, r.r1, r.c1), i);
      this.enderecos.push(ref);
      if (typeof v === 'string' && v.startsWith('=')) {
        this.constantes.push(null);
        this.textos.push(v);
        try {
          this.formulas.push(compilarFormula(v, { aba: r.aba, lin: r.r1, col: r.c1, matriz: false }, amb));
        } catch (e) {
          throw new Error(`${ref}: ${(e as Error).message}`);
        }
      } else {
        this.constantes.push(v as Escalar);
        this.textos.push(null);
        this.formulas.push(null);
      }
    }
  }

  /** 'Aba!B6' ou 'Aba!L5:L10' → Intervalo (lança erro se a aba ou o endereço não existir). */
  intervalo(ref: string): Intervalo {
    const { aba, a, b } = separarRef(ref);
    const ia = this.abaIdx.get(aba.toLowerCase());
    if (ia === undefined) throw new Error(`aba inexistente em ${ref}`);
    const p = celulaDe(a);
    const q = celulaDe(b);
    if (!p || !q) throw new Error(`endereço inválido: ${ref}`);
    return {
      k: 'ref',
      aba: ia,
      r1: Math.min(p.lin, q.lin),
      c1: Math.min(p.col, q.col),
      r2: Math.max(p.lin, q.lin),
      c2: Math.max(p.col, q.col),
    };
  }

  /**
   * Célula de um endereço lido de FORA da planilha (memória, desenhos). Além do que intervalo() confere, recusa
   * endereço além da última linha/coluna usada da aba: 'Contrafortes!B40000' era lido como célula vazia e
   * aparecia na memória como branco, escondendo o erro de digitação. Célula vazia DENTRO da área usada (entrada
   * opcional em branco, por exemplo) continua valendo null.
   */
  celulaDoEndereco(ref: string): Intervalo {
    let r = this.refs.get(ref);
    if (r) return r;
    r = this.intervalo(ref);
    const l = this.limites[r.aba];
    if (r.r1 > l.lin || r.c1 > l.col) throw new Error(`${ref} está fora da área usada da aba (vai até a linha ${l.lin})`);
    this.refs.set(ref, r);
    return r;
  }

  /** Intervalo de um nome definido (ou undefined). */
  nome(nome: string): Intervalo | undefined {
    return this.nomes.get(nome.toLowerCase());
  }

  /** Lista dos nomes definidos (como estão no arquivo). */
  listaNomes(): string[] {
    return [...this.nomes.keys()];
  }

  /** Texto da fórmula de uma célula (para a memória de cálculo), ou null se for constante/vazia. */
  formula(ref: string): string | null {
    const r = this.intervalo(ref);
    const i = this.indice.get(chave(r.aba, r.r1, r.c1));
    return i === undefined ? null : this.textos[i];
  }

  /** Endereços de todas as células com fórmula, na ordem do arquivo. */
  celulasComFormula(): string[] {
    return this.enderecos.filter((_, i) => this.formulas[i] !== null);
  }

  /**
   * O valor que a conta usaria para esta entrada, ou erro com o motivo. Para o formulário validar o que foi
   * digitado com a MESMA regra do calcular() (texto "19" → 19, "" → em branco, fora da lista → erro).
   */
  converterEntrada(nome: string, bruto: unknown): Valor {
    const meta = this.entradaPorNome.get(nome.toLowerCase());
    if (!meta) {
      if (this.nomes.has(nome.toLowerCase())) throw new Error(`${nome} não é entrada: é resultado da planilha`);
      throw new Error(`entrada inexistente: ${nome}`);
    }
    return conferirEntrada(meta, bruto);
  }

  /** A conta do app: só entradas, conferidas e convertidas como o Excel gravaria (ver cabeçalho). */
  calcular(alteracoes: Alteracoes = {}): Resultado {
    const vistos = new Map<string, string>();
    const conferidas: Record<string, Valor> = {};
    for (const [nome, bruto] of Object.entries(alteracoes)) {
      const k = nome.toLowerCase();
      const antes = vistos.get(k);
      // {H_muro: 2, h_muro: 3} valia o último, sem aviso: o Excel não diferencia maiúscula no nome.
      if (antes !== undefined) throw new Error(`alteração repetida: ${antes} e ${nome} são o mesmo nome`);
      vistos.set(k, nome);
      const meta = this.entradaPorNome.get(k);
      if (!meta) {
        if (this.nomes.has(k)) {
          throw new Error(`alteração em ${nome}, que não é entrada (é resultado da planilha): use simular() para "e se"`);
        }
        throw new Error(`alteração em nome inexistente: ${nome}`);
      }
      // Grava com o nome como está na planilha: quem ler r.alteracoes depois (memória, arquivo) acha pela grafia certa.
      conferidas[meta.nome] = conferirEntrada(meta, bruto);
    }
    return this.nova(conferidas);
  }

  /**
   * Escreve qualquer nome de célula única com o valor como veio (sem conversão nem lista), inclusive por cima de
   * fórmula — é o que o openpyxl faz no tools/cenarios.aplicar. Para teste e "e se"; o app usa calcular().
   */
  simular(alteracoes: Alteracoes = {}): Resultado {
    const vistos = new Map<string, string>();
    for (const [nome, v] of Object.entries(alteracoes)) {
      const k = nome.toLowerCase();
      const antes = vistos.get(k);
      if (antes !== undefined) throw new Error(`alteração repetida: ${antes} e ${nome} são o mesmo nome`);
      vistos.set(k, nome);
      if (v === undefined) throw new Error(`${nome}: valor undefined (para deixar em branco, mande null)`);
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`${nome}: número inválido (${v})`);
    }
    return this.nova({ ...alteracoes });
  }

  private nova(alteracoes: Record<string, Valor>): Resultado {
    // Cópia congelada: se quem chamou mexer no objeto dele depois, r.alteracoes continua dizendo o que entrou na conta.
    return new Calculo(this, this.indice, this.constantes, this.formulas, this.enderecos, Object.freeze(alteracoes));
  }
}

const NAO_CALCULADA = 0;
const CALCULANDO = 1;
const PRONTA = 2;

class Calculo implements Leitor, Resultado {
  private readonly valores: Escalar[];
  private readonly estado: Uint8Array;
  private readonly extras = new Map<number, Escalar>(); // células vazias no arquivo que receberam valor
  private readonly pilha: number[] = [];

  constructor(
    private readonly p: Planilha,
    private readonly indice: ReadonlyMap<number, number>,
    constantes: readonly Escalar[],
    private readonly formulas: readonly (FormulaCompilada | null)[],
    private readonly enderecos: readonly string[],
    readonly alteracoes: Alteracoes,
  ) {
    this.valores = constantes.slice();
    this.estado = new Uint8Array(this.valores.length);
    for (let i = 0; i < this.formulas.length; i++) if (this.formulas[i] === null) this.estado[i] = PRONTA;

    for (const [nome, v] of Object.entries(alteracoes)) {
      const r = p.nome(nome);
      if (!r) throw new Error(`alteração em nome inexistente: ${nome}`);
      if (r.r1 !== r.r2 || r.c1 !== r.c2) throw new Error(`alteração em nome de intervalo: ${nome}`);
      const ch = chave(r.aba, r.r1, r.c1);
      const i = this.indice.get(ch);
      if (i === undefined) this.extras.set(ch, v);
      else {
        this.valores[i] = v;
        this.estado[i] = PRONTA;
      }
    }
  }

  celula(aba: number, lin: number, col: number): Escalar {
    const ch = chave(aba, lin, col);
    const i = this.indice.get(ch);
    if (i === undefined) {
      const x = this.extras.get(ch);
      return x === undefined ? null : x;
    }
    const st = this.estado[i];
    if (st === PRONTA) return this.valores[i];
    if (st === CALCULANDO) {
      const k = this.pilha.indexOf(i);
      throw new ErroCiclo([...this.pilha.slice(k), i].map((j) => this.enderecos[j]));
    }
    this.estado[i] = CALCULANDO;
    this.pilha.push(i);
    let terminou = false;
    try {
      const v = this.formulas[i]!(this);
      this.valores[i] = v;
      this.estado[i] = PRONTA;
      terminou = true;
      return v;
    } finally {
      // Se a fórmula lançou (ciclo, ou defeito do motor), a célula volta a "não calculada" e sai da pilha. Sem
      // isto ela ficava presa em CALCULANDO, e a próxima leitura do mesmo Resultado acusava um ciclo que não existe.
      this.pilha.pop();
      if (!terminou) this.estado[i] = NAO_CALCULADA;
    }
  }

  v(nome: string): Valor {
    const r = this.p.nome(nome);
    if (!r) throw new Error(`nome definido inexistente: ${nome}`);
    if (r.r1 !== r.r2 || r.c1 !== r.c2) throw new Error(`${nome} é intervalo, não célula única: use cel() em cada célula`);
    return this.celula(r.aba, r.r1, r.c1);
  }

  num(nome: string): number | null {
    const x = this.v(nome);
    return typeof x === 'number' ? x : null;
  }

  cel(ref: string): Valor {
    const r = this.p.celulaDoEndereco(ref);
    return this.celula(r.aba, r.r1, r.c1);
  }
}
