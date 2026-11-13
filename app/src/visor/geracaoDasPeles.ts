// ═══════════════════════════════════════════════════════════════════════════
//  visor/geracaoDasPeles.ts — a pele do bloco, do concreto e do solo, gerada
// ---------------------------------------------------------------------------
//  O estilo Realista precisa que o bloco pareça bloco: o vibroprensado tem a
//  face ÁSPERA, cheia de poros pequenos e grão de pedrisco aparente — não é o
//  concreto liso de fôrma do A-PORT (`geracaoDoConcreto.ts`, de onde vem o
//  ruído daqui), que tem bolha grande, furo de tirante e junta de painel.
//  Três peles, uma para cada material de obra que o muro mostra:
//    · BLOCO — poros de 0,5 a 2 mm, pedrisco claro e escuro, manchas suaves;
//    · CONCRETO — a sapata: mancha de fôrma, grão fino, bolha rara;
//    · SOLO — o aterro: torrão, mancha de umidade e pedrinha.
//
//  ⚠️ A PELE É UM MODULADOR CINZA (média 0,5), não a cor. A cor média de cada
//  material é a da peça (`estiloVisual.ts`); a pele só a faz variar em torno
//  dela. Assim um mapa serve ao bloco e ao graute, e a seleção (que repinta a
//  cor da peça) continua aparecendo por cima da textura.
//
//  ⚠️ PURO E DETERMINÍSTICO: semente fixa, a mesma pele em toda máquina, e
//  sem `canvas` — o mapa sai como bytes RGBA prontos para a placa de vídeo
//  (`THREE.DataTexture`), o que deixa este arquivo testável no Node.
// ═══════════════════════════════════════════════════════════════════════════

export type Pele = 'bloco' | 'concreto' | 'solo' | 'ceramica';

/** Gerador congruente linear (o do A-PORT): barato e reproduzível. */
function acaso(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ruído de valor LADRILHÁVEL (período `per`): o mapa se repete sem emenda. Porte do A-PORT. */
function ruido(semente: number) {
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  const r = acaso(semente);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const h = (x: number, y: number) => perm[(perm[x & 255]! + y) & 255]!;
  const valor = (x: number, y: number, per: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let xf = x - xi;
    let yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const x0 = xi % per;
    const x1 = (xi + 1) % per;
    const y0 = yi % per;
    const y1 = (yi + 1) % per;
    const a = h(x0, y0);
    const b = h(x1, y0);
    const c = h(x0, y1);
    const d = h(x1, y1);
    return (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) / 255;
  };
  /** Soma de oitavas, −1..1. `f` é a frequência da primeira (inteira, para fechar o ladrilho). */
  return (u: number, v: number, oitavas: number, f: number) => {
    let s = 0;
    let a = 1;
    let n = 0;
    for (let i = 0; i < oitavas; i++) {
      s += a * (valor(u * f, v * f, f) * 2 - 1);
      n += a;
      a *= 0.5;
      f *= 2;
    }
    return s / n;
  };
}

/** Carimbo circular com volta no ladrilho: `fn(d, i)`, d = 0 no centro e 1 na borda. */
function carimbar(S: number, cx: number, cy: number, r: number, fn: (d: number, i: number) => void): void {
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d < 1) fn(d, (((y % S) + S) % S) * S + (((x % S) + S) % S));
    }
  }
}

/**
 * O campo cinza de uma pele, `S × S`, valores ~0..1 com média perto de 0,5.
 * `S` potência de 2 (a placa faz o mipmap; de longe a pele vira média, não chiado).
 */
export function campoDaPele(pele: Pele, S = 512): Float32Array {
  const k = S / 512;
  const fbm = ruido(pele === 'bloco' ? 1337 : pele === 'concreto' ? 2718 : pele === 'ceramica' ? 3141 : 4242);
  const rnd = acaso(pele === 'bloco' ? 42 : pele === 'concreto' ? 7 : pele === 'ceramica' ? 23 : 99);
  const g = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const grao = rnd() - 0.5;
      let c: number;
      if (pele === 'bloco') {
        // Ladrilho de 0,5 m (1 px ≈ 1 mm): mancha larga de cura, textura média do vibroprensado e o grão.
        c = 0.5 + 0.06 * fbm(u, v, 3, 2) + 0.06 * fbm(u, v, 3, 16) + 0.08 * fbm(u, v, 2, 128) + 0.14 * grao;
      } else if (pele === 'ceramica') {
        // Tijolo cerâmico (Jose, 13/11: "meio foscos, opacos, porosos e com algumas imperfeições"). Ladrilho de 0,5 m:
        // a mancha de queima do forno (larga e forte — um lado mais escuro, outro mais claro), a ondulação da
        // extrusão e o grão do barro.
        c = 0.5 + 0.1 * fbm(u, v, 4, 2) + 0.05 * fbm(u, v, 3, 12) + 0.05 * fbm(u, v, 2, 96) + 0.1 * grao;
      } else if (pele === 'concreto') {
        // Ladrilho de 1 m: a fôrma deixa mancha grande e superfície fechada; grão pouco.
        c = 0.5 + 0.09 * fbm(u, v, 4, 3) + 0.035 * fbm(u, v, 3, 24) + 0.04 * grao;
      } else {
        // Ladrilho de 1,2 m: o solo tem contraste forte — torrão, sombra entre torrões, umidade.
        const torrao = fbm(u, v, 4, 12);
        c = 0.5 + 0.12 * fbm(u, v, 3, 3) + 0.14 * torrao + 0.05 * fbm(u, v, 2, 96) + 0.08 * grao;
        if (torrao < -0.25) c -= 0.08 * Math.min(1, (-0.25 - torrao) * 6);
      }
      g[y * S + x] = c;
    }
  }

  if (pele === 'bloco') {
    // Poros: o vibroprensado é seco, e o ar fica preso em furinhos de 0,5 a 2 mm por toda a face.
    const poros = Math.round(5200 * k * k);
    for (let n = 0; n < poros; n++) {
      const r = (0.7 + 1.9 * Math.pow(rnd(), 2.2)) * k;
      const escuro = 0.35 + 0.25 * rnd();
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! *= 1 - escuro * (1 - d * d);
      });
    }
    // Pedrisco aflorando: pontos claros e escuros de 1 a 3 mm.
    const pedras = Math.round(2200 * k * k);
    for (let n = 0; n < pedras; n++) {
      const r = (0.7 + 1.4 * rnd()) * k;
      const s = rnd() < 0.55 ? 0.1 + 0.08 * rnd() : -(0.06 + 0.06 * rnd());
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! += s * (1 - d);
      });
    }
  } else if (pele === 'ceramica') {
    // Poros do barro: miúdos e muitos, escurecendo pouco (a cerâmica é fosca, o poro não é buraco fundo).
    const poros = Math.round(6500 * k * k);
    for (let n = 0; n < poros; n++) {
      const r = (0.6 + 1.2 * Math.pow(rnd(), 2.5)) * k;
      const escuro = 0.15 + 0.2 * rnd();
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! *= 1 - escuro * (1 - d * d);
      });
    }
    // Imperfeições: lascas e falhas de 3 a 9 mm, mais escuras (a quina batida, o grumo que soltou).
    const falhas = Math.round(55 * k * k);
    for (let n = 0; n < falhas; n++) {
      const r = (3 + 6 * Math.pow(rnd(), 1.5)) * k;
      const escuro = 0.12 + 0.12 * rnd();
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! *= 1 - escuro * Math.sqrt(1 - d * d);
      });
    }
    // Pintinhas claras de calcário e areia do barro.
    const pintas = Math.round(1400 * k * k);
    for (let n = 0; n < pintas; n++) {
      const r = (0.6 + 0.9 * rnd()) * k;
      const s = 0.06 + 0.08 * rnd();
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! += s * (1 - d);
      });
    }
  } else if (pele === 'concreto') {
    const bolhas = Math.round(160 * k * k);
    for (let n = 0; n < bolhas; n++) {
      const r = (0.8 + 2.2 * Math.pow(rnd(), 2)) * k;
      carimbar(S, rnd() * S, rnd() * S, r, (d, i) => {
        g[i]! *= 1 - 0.3 * Math.sqrt(1 - d * d);
      });
    }
  } else {
    // Pedrinhas: claras, com a borda escura (a sombra dela no chão).
    const pedras = Math.round(420 * k * k);
    for (let n = 0; n < pedras; n++) {
      const r = (1.5 + 4.5 * Math.pow(rnd(), 1.8)) * k;
      const claro = 0.12 + 0.14 * rnd();
      carimbar(S, rnd() * S, rnd() * S, r * 1.25, (d, i) => {
        g[i]! += d < 0.8 ? claro * (1 - (d / 0.8) * 0.4) : -0.08;
      });
    }
    // Matéria escura (raiz, matéria orgânica): pontinhos.
    const pontos = Math.round(2600 * k * k);
    for (let n = 0; n < pontos; n++) {
      const i = Math.floor(rnd() * S * S);
      g[i]! -= 0.12 * rnd();
    }
  }
  return g;
}

/** O campo em bytes RGBA (cinza nos três canais, opaco), pronto para a textura. */
export function bytesDaPele(campo: Float32Array): Uint8Array {
  const out = new Uint8Array(campo.length * 4);
  for (let i = 0, j = 0; i < campo.length; i++, j += 4) {
    const v = Math.round(Math.min(1, Math.max(0, campo[i]!)) * 255);
    out[j] = out[j + 1] = out[j + 2] = v;
    out[j + 3] = 255;
  }
  return out;
}
