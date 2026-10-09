// ═══════════════════════════════════════════════════════════════════════════
//  estado/numeros.ts — o número que se digita e o número que se lê
// ---------------------------------------------------------------------------
//  O Jose digita como digita na planilha: "1,6". O teclado numérico solta
//  ponto: "1.6". Os dois são 1,6 — vírgula e ponto são, os dois, a vírgula
//  decimal. Separador de milhar NÃO existe no campo, nem para ler nem para
//  escrever: "1.500" seria lido como 1,5, e se o campo escrevesse 1500 como
//  "1.500" o próprio app leria de volta outro número. Em muro de arrimo nenhuma
//  entrada passa de quatro dígitos inteiros, então o milhar não faz falta.
// ═══════════════════════════════════════════════════════════════════════════

/** O que sai da leitura de um texto de campo. */
export type Leitura =
  | { tipo: 'numero'; valor: number }
  | { tipo: 'vazio' }
  | { tipo: 'invalido' };

const NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * "1,6" → 1,6 · "1.6" → 1,6 · "" → vazio · "1,2,3" / "abc" / "1e3" / "1 6" → inválido.
 *
 * Só os espaços das PONTAS saem. Espaço no meio é erro de digitação, e
 * juntar os pedaços inventa número: "1 6" virava 16, e a altura do muro
 * passava de 1,6 m para 16 m sem o campo ficar vermelho.
 */
export function lerNumero(texto: string): Leitura {
  const t = texto.trim();
  if (t === '') return { tipo: 'vazio' };
  const p = t.replace(',', '.');
  // Duas vírgulas, ou vírgula e ponto juntos, é número que ninguém quis dizer.
  if (p.includes(',') || !NUMERO.test(p)) return { tipo: 'invalido' };
  const v = Number(p);
  return Number.isFinite(v) ? { tipo: 'numero', valor: v } : { tipo: 'invalido' };
}

/**
 * Casas decimais do formato do Excel da célula ('0.00' → 2, '0' → 0,
 * 'General' → 0). É o número de casas que a planilha MOSTRA — o app mostra o
 * mesmo, para o Jose ler a tela e a planilha lado a lado sem conta de cabeça.
 */
export function casasDoFormato(formato: string): number {
  const m = /0\.(0+)/.exec(formato);
  return m ? m[1].length : 0;
}

const formatadores = new Map<string, Intl.NumberFormat>();

function formatador(minimo: number, maximo: number): Intl.NumberFormat {
  const chave = `${minimo}:${maximo}`;
  let f = formatadores.get(chave);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: minimo,
      maximumFractionDigits: maximo,
      useGrouping: false,
    });
    formatadores.set(chave, f);
  }
  return f;
}

/** Vírgula decimal, casas fixas, sem milhar. */
export function escreverNumero(v: number, casas = 2): string {
  if (!Number.isFinite(v)) return '—';
  return formatador(casas, casas).format(v);
}

/** Teto das casas que o campo mostra: acima disso é ruído de ponto flutuante (1,6000000000000003), não dígito digitado. */
const CASAS_MAXIMAS = 10;

/** Quantas casas decimais o número tem na escrita mais curta que o JS sabe ler de volta (0,33333 → 5). */
function casasDigitadas(v: number): number {
  const s = String(Math.abs(v));
  if (s.includes('e-')) return CASAS_MAXIMAS; // 1e-7: menor do que qualquer entrada do muro; mostra o teto
  const ponto = s.indexOf('.');
  return ponto < 0 ? 0 : s.length - ponto - 1;
}

/**
 * O número como o CAMPO o mostra: no mínimo as casas do formato da planilha
 * ("1,60"), mas sem esconder NENHUMA casa do que foi digitado ("1,625"
 * continua "1,625", "0,33333" continua "0,33333"). Arredondar faria o campo
 * mostrar um número e a conta usar outro.
 */
export function escreverNoCampo(v: number, formato: string): string {
  if (!Number.isFinite(v)) return '';
  const casas = casasDoFormato(formato);
  return formatador(casas, Math.min(CASAS_MAXIMAS, Math.max(casas, casasDigitadas(v)))).format(v);
}
