/*
  Números escritos nos desenhos. Cota de prancha de estrutura no Brasil é em centímetro, vírgula decimal,
  sem unidade ao lado (a unidade vai uma vez só, no canto: "cotas em cm").
*/

/** mm → texto em cm: 4990 → "499"; 45 → "4,5"; 495 → "49,5". Uma casa no máximo: o bloco é modular em cm. */
export function cm(mm: number): string {
  const v = Math.round(mm) / 10;
  const r = Math.round(v * 10) / 10;
  if (Object.is(r, -0) || r === 0) return '0';
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

/** mm → texto em m com duas casas: 1050 → "1,05". Usado no título do corte (posição ao longo do muro). */
export function metros(mm: number): string {
  const v = Math.round(mm / 10) / 100;
  return (Object.is(v, -0) ? 0 : v).toFixed(2).replace('.', ',');
}

/** Número curto para atributo de SVG: uma casa decimal basta (o desenho é em px) e o arquivo fica magro. */
export function n(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Texto que vai dentro do XML. */
export function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
