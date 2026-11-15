// Os Recentes do Início no perfil do programa (recentes.js): a ordem, o teto, o
// mesmo arquivo escrito de dois jeitos, o arquivo que sumiu e a foto em PNG ao
// lado — o que o main responde à página pela ponte (15/11).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const r = require('../recentes');

// um PNG de 1 × 1 de verdade (a assinatura é conferida antes de ir para o disco)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function pastaNova() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'alrimo-recentes-'));
}
function muro(pasta, nome) {
  const c = path.join(pasta, nome);
  fs.writeFileSync(c, '{}', 'utf8');
  return c;
}

test('o mais novo primeiro, e o mesmo arquivo (outra maiúscula, outra barra) é um só', () => {
  let l = [];
  l = r.promover(l, { caminho: 'C:\\obra\\A.alrimo', nome: 'A.alrimo' }, 1);
  l = r.promover(l, { caminho: 'C:\\obra\\B.alrimo', nome: 'B.alrimo' }, 2);
  l = r.promover(l, { caminho: 'c:/OBRA/a.alrimo', nome: 'a.alrimo' }, 3);
  assert.deepEqual(l.map((x) => x.nome), ['a.alrimo', 'B.alrimo']);
});

test('o teto é 12', () => {
  let l = [];
  for (let i = 0; i < 20; i++) l = r.promover(l, { caminho: `C:\\m${i}.alrimo`, nome: `m${i}` }, i);
  assert.equal(l.length, r.MAX);
  assert.equal(l[0].nome, 'm19');
  assert.equal(l[11].nome, 'm8');
});

test('lista estragada ou de outra versão vira vazia ou perde só o que não presta', () => {
  assert.deepEqual(r.lerLista('não é json', '.alrimo'), []);
  assert.deepEqual(r.lerLista('null', '.alrimo'), []);
  const l = r.lerLista(JSON.stringify([
    { caminho: 'C:\\x.alrimo', nome: 'x', quando: 5 },
    { caminho: 'C:\\virus.exe', nome: 'v', quando: 9 },
    { caminho: 42, nome: 'y', quando: 1 },
  ]), '.alrimo');
  assert.deepEqual(l.map((x) => x.nome), ['x']);
});

test('só PNG de verdade vai para o disco', () => {
  assert.ok(r.bytesDaFoto(PNG));
  assert.equal(r.bytesDaFoto('data:image/jpeg;base64,AAAA'), null);
  assert.equal(r.bytesDaFoto('data:image/png;base64,' + Buffer.from('GIF89a....').toString('base64')), null);
  assert.equal(r.bytesDaFoto(null), null);
});

test('no disco: lembrar, a foto ao lado, promover sem perder a foto, esquecer', () => {
  const perfil = pastaNova();
  const obra = pastaNova();
  const a = muro(obra, 'Muro A.alrimo');
  const b = muro(obra, 'Muro B.alrimo');
  const rec = r.criarArquivoDeRecentes(perfil, '.alrimo');

  let l = rec.lembrar({ caminho: a, nome: 'Muro A.alrimo', resumo: 'Balanço · bloco 19×39 · h 1,60 m', miniatura: PNG }, 100);
  assert.equal(l.length, 1);
  assert.equal(l[0].miniatura, PNG);
  assert.equal(l[0].resumo, 'Balanço · bloco 19×39 · h 1,60 m');
  assert.equal(fs.readdirSync(path.join(perfil, 'recentes')).length, 1);

  l = rec.lembrar({ caminho: b, nome: 'Muro B.alrimo', resumo: '' }, 200);
  assert.deepEqual(l.map((x) => x.nome), ['Muro B.alrimo', 'Muro A.alrimo']);
  assert.equal(l[0].miniatura, null);

  // A de novo, sem foto nova (o registro sai antes da foto): sobe e guarda a foto que tinha
  l = rec.lembrar({ caminho: a, nome: 'Muro A.alrimo', resumo: 'x' }, 300);
  assert.deepEqual(l.map((x) => x.nome), ['Muro A.alrimo', 'Muro B.alrimo']);
  assert.equal(l[0].miniatura, PNG);

  // uma nova leitura (outra abertura do programa) vê o mesmo
  assert.deepEqual(r.criarArquivoDeRecentes(perfil, '.alrimo').listar().map((x) => x.nome), ['Muro A.alrimo', 'Muro B.alrimo']);

  l = rec.esquecer(a);
  assert.deepEqual(l.map((x) => x.nome), ['Muro B.alrimo']);
  assert.ok(fs.existsSync(a), 'tirar da lista não apaga o arquivo');
  assert.equal(fs.readdirSync(path.join(perfil, 'recentes')).length, 0, 'a foto do que saiu vai embora');
});

test('no disco: o arquivo apagado ou movido sai da lista ao listar', () => {
  const perfil = pastaNova();
  const obra = pastaNova();
  const a = muro(obra, 'A.alrimo');
  const b = muro(obra, 'B.alrimo');
  const rec = r.criarArquivoDeRecentes(perfil, '.alrimo');
  rec.lembrar({ caminho: a, nome: 'A.alrimo', resumo: '', miniatura: PNG }, 1);
  rec.lembrar({ caminho: b, nome: 'B.alrimo', resumo: '' }, 2);
  fs.unlinkSync(a);
  assert.deepEqual(rec.listar().map((x) => x.nome), ['B.alrimo']);
  assert.equal(fs.readdirSync(path.join(perfil, 'recentes')).length, 0);
  const guardado = JSON.parse(fs.readFileSync(path.join(perfil, 'recentes.json'), 'utf8'));
  assert.equal(guardado.length, 1);
});

test('no disco: caminho que não é .alrimo não entra', () => {
  const perfil = pastaNova();
  const rec = r.criarArquivoDeRecentes(perfil, '.alrimo');
  assert.deepEqual(rec.lembrar({ caminho: 'C:\\Windows\\notepad.exe', nome: 'x' }), []);
  assert.deepEqual(rec.lembrar(null), []);
});
