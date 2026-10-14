// ═══════════════════════════════════════════════════════════════════════════
//  visor/tema3d.ts — a ponte CSS → WebGL (porte do A-PORT, enxugado)
// ---------------------------------------------------------------------------
//  Canvas WebGL não herda tema: a cena tem que NASCER com as cores dos tokens
//  e se repintar quando body[data-theme] muda. Mesmo arquivo do A-PORT, só
//  com os papéis que o muro usa (cubo, eixos, seleção, aresta) e as cores de
//  MATERIAL do Al-rimo.
//
//  ⚠️ As cores de material leem tokens que ainda NÃO existem no Al-rimo
//  (--peca-bloco, --peca-graute, --peca-aco-barra, --peca-sapata,
//  --peca-brita, --peca-manta, --peca-tubo, --peca-solo). Enquanto a frente de
//  estilo não os criar, vale a reserva daqui. Reservas: bloco, aço e solo são
//  os hex das figuras do Jose (figs/figlib.py); a sapata é o concreto do tema
//  "papel" do A-PORT (--peca-viga); graute, brita, manta e tubo são DEDUÇÃO
//  minha (graute mais escuro que o bloco, como pedido) — conferir com ele.
// ═══════════════════════════════════════════════════════════════════════════

/** Lê uma variável CSS do body. Devolve string que o THREE.Color aceita. */
export function themeColor(nome: string, reserva: string): string {
  try {
    const v = getComputedStyle(document.body).getPropertyValue(nome).trim();
    return v || reserva;
  } catch {
    // Node (testes) não tem documento: a reserva é a cor.
    return reserva;
  }
}

/** A paleta que a cena usa. Um lugar só — nada de hex solto no visor. */
export interface PaletaVisor {
  fundo: string;
  superficie: string;
  tinta: string;
  enfase: string;
  arestaDoCubo: string;
  eixoX: string;
  eixoY: string;
  eixoZ: string;
  /** O que JÁ foi pego (o mesmo azul do A-PORT: "um azul só, para tudo"). */
  selecionado: string;
  /** Traço das peças (bloco, sapata). Escuro: a massa delas é clara nos três temas. */
  aresta: string;
  /** Cores de MATERIAL — iguais nos temas, porque são a cor da coisa e não tinta de tela. */
  bloco: string;
  graute: string;
  aco: string;
  concreto: string;
  brita: string;
  areia: string;
  manta: string;
  tubo: string;
  solo: string;
  escuro: boolean;
}

/** Luminância aproximada de uma cor CSS, 0 (preto) a 1 (branco). */
function luminancia(css: string): number {
  const m = css.match(/^#?([0-9a-f]{6})$/i);
  if (m?.[1]) {
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  const rgb = css.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) return (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) / 255;
  return 1;
}

export function lerPaleta(): PaletaVisor {
  const fundo = themeColor('--bg', '#121216');
  return {
    fundo,
    superficie: themeColor('--surface', '#17171b'),
    tinta: themeColor('--ink', '#e8e8ee'),
    enfase: themeColor('--accent', '#e4e5ea'),
    // ⚠️ --grid foi autorado para prancheta CLARA e some no escuro; o token de
    // CONTROLE tem contraste nos três temas (mesma escolha do A-PORT).
    arestaDoCubo: themeColor('--control-stroke-2', '#5a5a6c'),
    // Eixos com as cores de DADOS: é o único lugar em que cor é informação.
    eixoX: themeColor('--err', '#e0685a'),
    eixoY: themeColor('--ok', '#55b87d'),
    eixoZ: themeColor('--accent-3', '#3d8bfd'),
    selecionado: themeColor('--accent-3', '#3d8bfd'),
    aresta: themeColor('--aresta', '#1b1d22'),
    bloco: themeColor('--peca-bloco', '#d9d9d9'),
    graute: themeColor('--peca-graute', '#7f7f7f'),
    aco: themeColor('--peca-aco-barra', '#c00000'),
    concreto: themeColor('--peca-sapata', '#a9a69e'),
    brita: themeColor('--peca-brita', '#9a948a'),
    areia: themeColor('--peca-areia', '#ffffb7'),
    manta: themeColor('--peca-manta', '#e9e6dc'),
    tubo: themeColor('--peca-tubo', '#f0f0f0'),
    solo: themeColor('--peca-solo', '#8d6e3f'),
    escuro: luminancia(fundo) < 0.42,
  };
}

/**
 * Avisa quando o tema troca. Sem isto o palco ficaria com as cores do tema
 * anterior até o próximo recálculo — que pode não vir nunca.
 * Devolve a função de desligar.
 */
export function observarTema(aoTrocar: (p: PaletaVisor) => void): () => void {
  const obs = new MutationObserver(() => aoTrocar(lerPaleta()));
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-density', 'data-cores'] });
  return () => obs.disconnect();
}
