/*
  ESCRITOR STEP (ISO 10303-21) para IFC4 — puro e SÍNCRONO, roda igual no navegador e no Node.

  Veio do protótipo validado no ifcopenshell 0.8.5 (scratchpad/entender/ifc_teste/step.mjs). Diferenças em relação
  ao ifc-writer.js do Pró-Viga, todas de propósito (lá foram medidas 495 violações):
    · GUID DETERMINÍSTICO (UUID v5 de uma chave estável), não Math.random. O mesmo muro gera os mesmos GUIDs, e o
      BIMcollab/Solibri acompanham a peça entre versões. O 1º caractere sai sempre em 0..3 (o aleatório errava 63
      em 64 vezes).
    · Texto fora do ASCII sai como \X2\hhhh\X0\. O STEP só aceita ASCII: UTF-8 cru passa no validador, mas o
      ifcopenshell APAGA a letra em silêncio ("Nível" vira "Nvel").
    · Número com toFixed(6) sem zeros à direita. toFixed é exato pela especificação do JS: o texto não depende da
      máquina, e é isso que deixa a seção DATA idêntica byte a byte.
    · Uma entidade por linha (o leitor de conferência em conferir.ts conta com isso).
*/

// ── tipos de argumento ──────────────────────────────────────────────────────────────────────────────────────────
export class Ref {
  constructor(readonly id: number) {}
  toString(): string { return '#' + this.id; }
}

/** Trecho já escrito em STEP (enumeração, $, *, inteiro, valor tipado). */
class Cru {
  constructor(readonly s: string) {}
}

export type Arg = Ref | Cru | number | string | boolean | null | undefined | Arg[];

export const $ = new Cru('$');
export const STAR = new Cru('*');
/** Enumeração: E('AREA') → .AREA. */
export const E = (v: string): Cru => new Cru('.' + v + '.');
/** INTEGER (IfcLineIndex, IfcTimeStamp, IfcInteger...). Número JS solto vira REAL. */
export const I = (n: number): Cru => {
  if (!Number.isFinite(n)) throw new Error('inteiro inválido no IFC: ' + n);
  return new Cru(String(Math.round(n)));
};
/** Valor tipado de SELECT: T('IFCLABEL', 'N1') → IFCLABEL('N1'). */
export const T = (tipo: string, v: Arg): Cru => new Cru(tipo.toUpperCase() + '(' + enc(v) + ')');

export function real(v: number): string {
  if (!Number.isFinite(v)) throw new Error('número inválido no IFC: ' + v);
  // |v| < 5e-7 seria "-0." ou "0.000000" → um zero só, sempre igual.
  if (Math.abs(v) < 5e-7) return '0.';
  return v.toFixed(6).replace(/0+$/, '');   // "1." e "0.19" são REAL válidos
}

/** Texto STEP: aspa dobra, barra invertida dobra, e tudo fora do ASCII imprimível vira \X2\hhhh\X0\. */
export function str(s: string): string {
  let out = '';
  let buf = '';
  const fecha = () => {
    if (buf) { out += '\\X2\\' + buf + '\\X0\\'; buf = ''; }
  };
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c <= 0x7e) {
      fecha();
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else if (c <= 0xffff) {
      buf += c.toString(16).toUpperCase().padStart(4, '0');
    } else {
      // Fora do plano básico (emoji etc.) — não deve aparecer em português, mas não pode quebrar o arquivo.
      fecha();
      out += '\\X4\\' + c.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\';
    }
  }
  fecha();
  return "'" + out + "'";
}

export function enc(v: Arg): string {
  if (v === null || v === undefined) return '$';
  if (v instanceof Cru) return v.s;
  if (v instanceof Ref) return v.toString();
  if (typeof v === 'number') return real(v);
  if (typeof v === 'string') return str(v);
  if (typeof v === 'boolean') return v ? '.T.' : '.F.';
  if (Array.isArray(v)) return '(' + v.map(enc).join(',') + ')';
  throw new Error('argumento IFC desconhecido: ' + JSON.stringify(v));
}

// ── GUID determinístico: UUID v5 (SHA-1) → 22 caracteres do IFC ─────────────────────────────────────────────────
// SHA-1 próprio porque o crypto.subtle do navegador é assíncrono, e um exportador síncrono é bem mais simples de
// usar e de testar. Conferido contra uuid.uuid5 do Python e ifcopenshell.guid.compress (protótipo, 4 chaves).
function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8;
  const comPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  comPad.set(bytes);
  comPad[bytes.length] = 0x80;
  const dv = new DataView(comPad.buffer);
  dv.setUint32(comPad.length - 4, ml >>> 0);
  dv.setUint32(comPad.length - 8, Math.floor(ml / 2 ** 32));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < comPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const o = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => o.setUint32(i * 4, h));
  return out;
}

const hexParaBytes = (h: string): Uint8Array =>
  Uint8Array.from((h.replace(/-/g, '').match(/../g) ?? []).map((x) => parseInt(x, 16)));

/** UUID v5 (RFC 4122) em hexadecimal de 32 dígitos, sem hífens. */
export function uuid5(nsUuid: string, nome: string): string {
  const ns = hexParaBytes(nsUuid);
  const nm = new TextEncoder().encode(nome);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns);
  buf.set(nm, ns.length);
  const h = sha1(buf).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Mesmo algoritmo do ifcopenshell.guid.compress: 1º byte → 2 caracteres, depois 5 grupos de 3 bytes → 4. */
export function comprimirGuid(hex32: string): string {
  const b = hexParaBytes(hex32);
  const enc64 = (v: number, n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) { s = B64[v % 64] + s; v = Math.floor(v / 64); }
    return s;
  };
  let s = enc64(b[0], 2);
  for (let i = 1; i < 16; i += 3) s += enc64((b[i] << 16) + (b[i + 1] << 8) + b[i + 2], 4);
  return s;
}

/** Namespace do Al-rimo: sorteado UMA vez e cravado. Mudar isto muda o GUID de todo arquivo já entregue. */
export const NS_ALRIMO = '6c1b2f0e-4a7d-4c55-9a1e-3f0d2b8c7e41';

export const guid = (chave: string): string => comprimirGuid(uuid5(NS_ALRIMO, chave));

// ── o escritor ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface Escritor {
  /** Acrescenta uma entidade e devolve a referência #n. */
  add(tipo: string, args: Arg[]): Ref;
  /** Igual ao add, mas entidade idêntica (ponto, direção, placement) sai uma vez só. */
  addU(tipo: string, args: Arg[]): Ref;
  readonly total: number;
  texto(cab: Cabecalho): string;
}

export interface Cabecalho {
  nomeArquivo: string;
  agora: string;            // ISO 8601; vai só no HEADER (FILE_NAME)
  autor?: string;
  organizacao?: string;
  app?: string;
  versao?: string;
}

export function criarEscritor(): Escritor {
  const linhas: string[] = [];
  const cache = new Map<string, Ref>();
  let n = 0;
  const add = (tipo: string, args: Arg[]): Ref => {
    n++;
    linhas.push('#' + n + '=' + tipo + '(' + args.map(enc).join(',') + ');');
    return new Ref(n);
  };
  const addU = (tipo: string, args: Arg[]): Ref => {
    const k = tipo + '(' + args.map(enc).join(',') + ')';
    let r = cache.get(k);
    if (!r) { r = add(tipo, args); cache.set(k, r); }
    return r;
  };
  return {
    add,
    addU,
    get total() { return n; },
    texto({ nomeArquivo, agora, autor = '', organizacao = 'Al-rimo', app = 'Al-rimo', versao = '' }) {
      const cab = [
        'ISO-10303-21;',
        'HEADER;',
        // ReferenceView 1.2: o mesmo que o Revit 2026 grava no IFC4 dele (medido no IFC do José).
        "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
        'FILE_NAME(' + [str(nomeArquivo), str(agora), '(' + str(autor) + ')', '(' + str(organizacao) + ')',
          str((app + ' ' + versao).trim()), str(app), "''"].join(',') + ');',
        "FILE_SCHEMA(('IFC4'));",
        'ENDSEC;',
        'DATA;',
      ];
      return cab.concat(linhas, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
    },
  };
}
