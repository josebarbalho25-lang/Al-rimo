// ═══════════════════════════════════════════════════════════════════════════
//  afterpack-enxuga.js — tira do pacote o que o Al-rimo não usa
// ---------------------------------------------------------------------------
//  Cópia da regra do Pró-Viga (_tools/afterpack-enxuga.js de lá): roda depois
//  que o electron-builder monta a pasta do programa e antes de fechar o
//  instalador — o único lugar onde se mexe no que vem do Electron.
//
//  ⚠️ Só entra aqui o que NÃO desenha caractere nem pixel: cortar idioma ou
//  fonte é o caminho curto para o memorial sair com quadradinho no lugar do Ø,
//  e isso só aparece na máquina do cliente.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const FORA = [
  // Compilador de shader do DirectX 12, do WebGPU. O 3D do Al-rimo é WebGL
  // (three.js), que no Windows passa pelo ANGLE (libGLESv2.dll e
  // d3dcompiler_47.dll, que FICAM).
  { arquivo: 'dxcompiler.dll', porque: 'WebGPU — o 3D é WebGL' },
];

exports.default = async function enxugar(contexto) {
  let total = 0;
  for (const item of FORA) {
    const alvo = path.join(contexto.appOutDir, item.arquivo);
    if (!fs.existsSync(alvo)) {
      console.log(`      · ${item.arquivo} não estava no pacote (nada a cortar)`);
      continue;
    }
    const mb = fs.statSync(alvo).size / 1024 / 1024;
    fs.unlinkSync(alvo);
    total += mb;
    console.log(`      · ${item.arquivo} … −${mb.toFixed(1)} MB (${item.porque})`);
  }
  if (total) console.log(`      pacote ${total.toFixed(1)} MB mais leve`);
};
