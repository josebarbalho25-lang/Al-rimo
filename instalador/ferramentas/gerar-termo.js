#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  gerar-termo.js — a folha de licença do instalador, gerada do TERMO_DE_USO.md
// ---------------------------------------------------------------------------
//    node ferramentas/gerar-termo.js   → gerado/termo/TERMO_DE_USO.txt
//
//  Uma fonte só: o TERMO_DE_USO.md da raiz, o mesmo que o app mostra na
//  primeira abertura. O instalador recebe TEXTO PURO, pelo que o Pró-Viga
//  mediu (_tools/build-eula.js de lá): HTML na caixa do instalador sai em
//  corpo enorme e cabem quatro linhas. E três coisas que não são gosto:
//    · BOM de UTF-8 na frente — sem ele o NSIS escreve acento como lixo;
//    · quebra de linha dura em 78 colunas — a caixa não reflui parágrafo;
//    · CRLF, porque quem lê é o Windows.
//  O comentário HTML do fim do .md (anotações internas) não vai para o cliente.
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const INSTALADOR = path.join(__dirname, '..');
const FONTE = path.join(INSTALADOR, '..', 'TERMO_DE_USO.md');
const SAIDA = path.join(INSTALADOR, 'gerado', 'termo', 'TERMO_DE_USO.txt');
const COLUNAS = 78;

function quebra(texto, recuo) {
  const espaco = ' '.repeat(recuo);
  const linhas = [];
  let atual = espaco;
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (atual.trim() && (atual + ' ' + palavra).length > COLUNAS) {
      linhas.push(atual.trimEnd());
      atual = espaco + palavra;
    } else {
      atual = atual.trim() ? `${atual} ${palavra}` : espaco + palavra;
    }
  }
  if (atual.trim()) linhas.push(atual.trimEnd());
  return linhas;
}

/* O termo acaba onde o app diz que acaba (app/src/estado/termo.ts,
   FIM_DO_TERMO): "## Fontes consultadas" em diante é a pesquisa, não cláusula. */
const FIM_DO_TERMO = /^##\s+Fontes consultadas\s*$/m;

function texto(md) {
  let limpo = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const fim = FIM_DO_TERMO.exec(limpo);
  if (fim) limpo = limpo.slice(0, fim.index);
  limpo = limpo.replace(/(\n\s*(-{3,}|\*{3,}|_{3,})?\s*)+$/, '');
  const saida = [];
  const solta = () => { if (saida.length && saida[saida.length - 1] !== '') saida.push(''); };

  for (const bruto of limpo.split(/\r?\n/)) {
    const linha = bruto.replace(/^>\s?/, '');                     // citação vira texto normal
    const nu = linha
      .replace(/\*\*(.+?)\*\*/g, '$1')                            // negrito
      .replace(/\*(.+?)\*/g, '$1')                                // itálico
      .replace(/`(.+?)`/g, '$1')                                  // código
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')             // link: texto (endereço)
      .trimEnd();

    if (!nu.trim()) { solta(); continue; }
    if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(nu)) { solta(); saida.push('-'.repeat(COLUNAS)); saida.push(''); continue; }
    const cab = nu.match(/^(#{1,6})\s+(.*)$/);
    if (cab) { solta(); saida.push(cab[2].toUpperCase()); saida.push(''); continue; }

    const item = nu.match(/^(\s*)([-*]|\d+\.|[a-z]\))\s+(.*)$/);
    if (item) {
      const marca = /^[-*]$/.test(item[2]) ? '- ' : `${item[2]} `;
      const recuo = Math.min(6, item[1].length) + 2;
      const linhas = quebra(item[3], recuo + marca.length);
      linhas[0] = ' '.repeat(recuo) + marca + linhas[0].trimStart();
      saida.push(...linhas);
      continue;
    }
    saida.push(...quebra(nu.trim(), 0));
  }
  return '﻿' + saida.join('\n').replace(/\n{3,}/g, '\n\n').trim().replace(/\n/g, '\r\n') + '\r\n';
}

const md = fs.readFileSync(FONTE, 'utf8');
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, texto(md), 'utf8');
const versao = (md.match(/\*\*Vers[ãa]o do documento:\*\*\s*([0-9][0-9.]*)/i) || [])[1] || '?';
console.log(`      termo de uso … v${versao} → gerado/termo/TERMO_DE_USO.txt`);
