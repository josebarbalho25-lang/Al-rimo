// A roda das imagens do splash (splashImagem.js). O defeito que isto guarda:
// o programa abre antes da primeira troca de imagem, e sem a roda o Jose só
// via a imagem 1, sempre (15/11).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { imagemDaAbertura } = require('../splashImagem');

test('cada abertura começa na imagem seguinte, e a 3ª volta à 1ª', () => {
  assert.equal(imagemDaAbertura(0, 3), 1);
  assert.equal(imagemDaAbertura(1, 3), 2);
  assert.equal(imagemDaAbertura(2, 3), 0);
});

test('três aberturas seguidas passam pelas três imagens', () => {
  let ultima = null;
  const vistas = [];
  for (let i = 0; i < 3; i++) vistas.push((ultima = imagemDaAbertura(ultima, 3, () => 0.5)));
  assert.deepEqual([...vistas].sort(), [0, 1, 2]);
});

test('primeira abertura (nada guardado): sorteia entre as três', () => {
  assert.equal(imagemDaAbertura(null, 3, () => 0), 0);
  assert.equal(imagemDaAbertura(undefined, 3, () => 0.5), 1);
  assert.equal(imagemDaAbertura(undefined, 3, () => 0.9999), 2);
});

test('programa.json estragado ou de outra época cai no sorteio, sem sair da faixa', () => {
  for (const lixo of ['1', -1, 3, 7, 1.5, NaN, {}, true]) {
    const i = imagemDaAbertura(lixo, 3, () => 0.4);
    assert.ok(Number.isInteger(i) && i >= 0 && i < 3, `lixo ${String(lixo)} deu ${i}`);
  }
  // um sorteio que devolvesse 1 (fora do [0, 1)) não pode dar a imagem 4
  assert.equal(imagemDaAbertura(null, 3, () => 1), 2);
});
