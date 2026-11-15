// ═══════════════════════════════════════════════════════════════════════════
//  splashImagem.js — qual imagem o splash mostra primeiro
// ---------------------------------------------------------------------------
//  O programa abre em ~4 s e a troca de imagem do splash é a cada 4,5 s: na
//  prática só a primeira aparece (Jose, 15/11: "só a primeira imagem é vista").
//  Então cada abertura COMEÇA numa imagem diferente, em roda (1 → 2 → 3 → 1):
//  o main guarda a última no programa.json do perfil. Na primeira abertura,
//  sem nada guardado, sorteia — duas máquinas novas não começam iguais.
//  Separado do main.js para ser testado sem o Electron (teste/splash.test.js).
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

/**
 * A imagem desta abertura (0 … total − 1).
 * @param {unknown} ultima  a da abertura anterior, como veio do disco (pode ser lixo)
 * @param {number} total    quantas imagens há
 * @param {() => number} sortear  0 ≤ x < 1 (Math.random; o teste passa o dele)
 */
function imagemDaAbertura(ultima, total, sortear = Math.random) {
  const n = Math.max(1, Math.floor(total) || 1);
  if (Number.isInteger(ultima) && ultima >= 0 && ultima < n) return (ultima + 1) % n;
  // primeira abertura, ou programa.json estragado / de quando eram outras imagens
  return Math.min(n - 1, Math.floor(sortear() * n));
}

module.exports = { imagemDaAbertura };
