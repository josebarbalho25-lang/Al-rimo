/*
  NÚMEROS E UNIDADES NO TEX DA MEMÓRIA (formato.ts — não "tex.ts": no Windows ele colide com o componente Tex.tsx).

  Duas armadilhas medidas no Pró-Viga e que este arquivo existe para não repetir:
  - vírgula decimal crua no KaTeX vira pontuação e ganha um espaço fino depois ("12, 34"). Só "12{,}34" sai colado —
    por isso todo número que entra em TeX passa por nt();
  - "−0,00" na folha: o Intl devolve o sinal do zero negativo, e o papel mostraria uma conta que parece errada.
*/

const FORMATOS = new Map<number, Intl.NumberFormat>();

/** Número em pt-BR com as casas da célula da planilha. Milhar só a partir de 5 dígitos ('min2'): 2687 e 269.849. */
export function nbr(v: number, casas: number): string {
  if (!Number.isFinite(v)) return '—';
  let f = FORMATOS.get(casas);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
      useGrouping: 'min2',
    });
    FORMATOS.set(casas, f);
  }
  const t = f.format(v);
  return /^-0(,0*)?$/.test(t) ? t.slice(1) : t;
}

/** Número dentro do TeX: vírgula sem o espaço que o KaTeX põe depois de pontuação. */
export function nt(v: number, casas: number): string {
  if (!Number.isFinite(v)) return '\\text{—}';
  return nbr(v, casas).replace(',', '{,}');
}

/** Na substituição, negativo vai entre parênteses: "2 × (−5)" e não "2 × −5". */
export function ntp(v: number, casas: number): string {
  const s = nt(v, casas);
  return s.startsWith('-') ? `\\left(${s}\\right)` : s;
}

/** '0.00' → 2 · '0' → 0 · 'General' → null (a planilha não fixou). */
export function casasDoFormato(formato: string | null | undefined): number | null {
  if (!formato) return null;
  const m = /0(?:\.(0+))?/.exec(formato);
  if (!m) return null;
  return m[1] ? m[1].length : 0;
}

// Unidades que a planilha usa (coluna C). Escritas uma vez aqui para que "kN·m/m" saia igual em todo card.
// O ponto do kN·m é TEXTO (\text{·}), não \cdot: o Word lê \cdot como operador e abre espaço dos dois lados —
// saía "kN · m/m" (medido no Word 16 com as quatro grafias; só esta fica colada nos dois destinos).
const UNIDADES: Record<string, string> = {
  '': '',
  '°': '^{\\circ}',
  '%': '\\,\\%',
  m: '\\,\\mathrm{m}',
  cm: '\\,\\mathrm{cm}',
  mm: '\\,\\mathrm{mm}',
  'm²': '\\,\\mathrm{m^2}',
  'cm²': '\\,\\mathrm{cm^2}',
  'cm²/m': '\\,\\mathrm{cm^2/m}',
  'cm³': '\\,\\mathrm{cm^3}',
  'cm⁴': '\\,\\mathrm{cm^4}',
  'cm⁴/m': '\\,\\mathrm{cm^4/m}',
  kN: '\\,\\mathrm{kN}',
  'kN/m': '\\,\\mathrm{kN/m}',
  'kN/m²': '\\,\\mathrm{kN/m^2}',
  'kN/m³': '\\,\\mathrm{kN/m^3}',
  'kN·m': '\\,\\mathrm{kN\\text{·}m}',
  'kN·m/m': '\\,\\mathrm{kN\\text{·}m/m}',
  'kN·cm': '\\,\\mathrm{kN\\text{·}cm}',
  'kN·cm/m': '\\,\\mathrm{kN\\text{·}cm/m}',
  kPa: '\\,\\mathrm{kPa}',
  MPa: '\\,\\mathrm{MPa}',
  'kN/cm²': '\\,\\mathrm{kN/cm^2}',
};

const EXPOENTES: Record<string, string> = { '²': '^2', '³': '^3', '⁴': '^4' };

/** Unidade em TeX, colada no último número. Unidade fora da tabela é montada pelo mesmo molde (não some). */
export function texUnidade(u: string | undefined | null): string {
  if (!u) return '';
  const pronta = UNIDADES[u];
  if (pronta !== undefined) return pronta;
  const corpo = u
    .replace(/[²³⁴]/g, (c) => EXPOENTES[c])
    .replace(/·/g, '\\text{·}')
    .replace(/%/g, '\\%');
  return `\\,\\mathrm{${corpo}}`;
}

/** Texto solto dentro do TeX (resultado que é palavra: "Balanço", "não resiste"). */
export function texTexto(s: string): string {
  return `\\text{${s.replace(/[\\{}$&#^_%~]/g, (c) => '\\' + c)}}`;
}

/** Como a fonte é desenhada, num lugar só: "NBR 16868-1 · 11.2" / "Critério adotado" (sem item). */
export function textoDaRef(ref: { fonte: string; item?: string } | undefined): string {
  if (!ref) return '';
  return ref.item ? `${ref.fonte} · ${ref.item}` : ref.fonte;
}
