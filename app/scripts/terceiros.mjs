// ═══════════════════════════════════════════════════════════════════════════
//  scripts/terceiros.mjs — a relação dos componentes de terceiros (Termo, 10.3)
// ---------------------------------------------------------------------------
//  Gera public/terceiros.txt: nome, versão e licença de cada pacote que o app
//  usa EM PRODUÇÃO, e o texto da licença que vem dentro de cada um (é o texto
//  — com a linha de copyright — que MIT, BSD e ISC mandam acompanhar a cópia;
//  só o nome da licença não cumpre). O arquivo vai junto com o app, e o link
//  "Componentes de terceiros" da janela do termo abre ele.
//
//  QUEM ENTRA: o package-lock, não só as dependências diretas do package.json.
//  O pacote final leva as dependências das dependências (o drei puxa dezenas),
//  e é delas também que a licença exige o aviso. Ficam de fora só as de
//  desenvolvimento (marcadas "dev" no lock: compilador, testes) e os @types
//  (descrição de tipos do TypeScript, que não vão para o navegador). Sobrar
//  um pacote que acabou não indo no pacote final não faz mal; faltar um faz.
//
//  Sem data dentro do arquivo, de propósito: rodar de novo sem mudar nenhuma
//  dependência dá o MESMO arquivo, e o git não acusa mudança à toa.
//
//  Rodar: node scripts/terceiros.mjs   (o "npm run build" já roda antes)
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));
const SAIDA = join(APP, 'public', 'terceiros.txt');

const lerJson = (arq) => JSON.parse(readFileSync(arq, 'utf8'));
const app = lerJson(join(APP, 'package.json'));
const trava = lerJson(join(APP, 'package-lock.json'));

if (!trava.packages) {
  throw new Error('package-lock sem "packages" (lockfileVersion 1): rode "npm install" com npm 7 ou mais novo.');
}

/** A licença como o pacote declara: "MIT", { type: "MIT" } ou o antigo licenses: [...]. */
function licencaDeclarada(p) {
  const l = p.license ?? p.licenses;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => (typeof x === 'string' ? x : x?.type)).filter(Boolean).join(' OR ');
  if (l && typeof l === 'object' && typeof l.type === 'string') return l.type;
  return null;
}

/** Pacote sem o campo license (há alguns): reconhece pelo começo do texto do arquivo. */
function licencaPeloTexto(texto) {
  if (/Permission is hereby granted, free of charge/i.test(texto)) return 'MIT';
  if (/Apache License,?\s+Version 2\.0/i.test(texto)) return 'Apache-2.0';
  if (/Permission to use, copy, modify, and\/or distribute/i.test(texto)) return 'ISC';
  if (/Redistribution and use in source and binary forms/i.test(texto)) return 'BSD';
  return null;
}

const nomeDoAutor = (a) => (typeof a === 'string' ? a : a?.name) ?? '';

/** LICENSE, LICENCE, COPYING, NOTICE (o NOTICE é obrigação à parte da Apache-2.0). */
function arquivosDeLicenca(pasta) {
  return readdirSync(pasta)
    .filter((f) => /^(licen[cs]e|copying|notice)([.-].*)?$/i.test(f))
    .sort()
    .map((f) => ({ arquivo: f, texto: readFileSync(join(pasta, f), 'utf8').replace(/\r\n?/g, '\n').trim() }));
}

const componentes = [];
for (const [caminho, entrada] of Object.entries(trava.packages)) {
  if (!caminho || entrada.dev || entrada.link) continue; // "" é o próprio app
  const pasta = join(APP, caminho);
  const arqPacote = join(pasta, 'package.json');
  if (!existsSync(arqPacote)) continue; // opcional de outra plataforma, não instalado
  const p = lerJson(arqPacote);
  const nome = p.name ?? caminho.replace(/^.*node_modules\//, '');
  if (nome.startsWith('@types/')) continue;
  const textos = arquivosDeLicenca(pasta);
  const declarada = licencaDeclarada(p);
  const licenca = declarada ?? (textos.length ? licencaPeloTexto(textos[0].texto) : null) ?? 'não declarada';
  componentes.push({ nome, versao: p.version ?? entrada.version ?? '?', licenca, autor: nomeDoAutor(p.author), textos });
}

componentes.sort((a, b) => (a.nome === b.nome ? a.versao.localeCompare(b.versao) : a.nome.localeCompare(b.nome)));

/*
  PACOTE SEM O ARQUIVO DE LICENÇA (o fiber, o maath, o draco3d…): a licença vale assim mesmo, e o texto dela tem de
  acompanhar. Vai UMA vez, no fim, o texto-padrão de cada licença que faltou. A MIT é curta e fixa; a Apache-2.0 é
  copiada do arquivo de um pacote que a traz inteira (não se escreve à mão um texto legal de 11 mil caracteres).
*/
const MIT = `MIT License

Copyright (c) <ano> <titular>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const APACHE = componentes
  .flatMap((c) => c.textos)
  .map((t) => t.texto)
  .find((t) => /Apache License/.test(t) && /END OF TERMS AND CONDITIONS/.test(t))
  // Só até o fim dos termos: o apêndice que vem depois é o modelo já preenchido COM O NOME do pacote de onde se copiou.
  ?.replace(/(END OF TERMS AND CONDITIONS)[\s\S]*$/, '$1');
const PADRAO = { MIT, 'Apache-2.0': APACHE };
const padroesUsados = new Set(componentes.filter((c) => c.textos.length === 0).map((c) => c.licenca));

const larg = (k) => Math.max(...componentes.map((c) => c[k].length));
const [lNome, lVersao] = [Math.max(larg('nome'), 10), Math.max(larg('versao'), 6)];
const linha = (a, b, c) => `${a.padEnd(lNome)}  ${b.padEnd(lVersao)}  ${c}`;
const traco = '='.repeat(78);

const partes = [
  `Al-rimo ${app.version} — componentes de terceiros`,
  traco,
  '',
  'Componentes de código aberto incorporados ao Al-rimo (Termo de Uso, item 10.3).',
  'Cada um é regido pela própria licença, que prevalece somente quanto a ele.',
  '',
  linha('Componente', 'Versão', 'Licença'),
  linha('-'.repeat(lNome), '-'.repeat(lVersao), '-'.repeat(7)),
  ...componentes.map((c) => linha(c.nome, c.versao, c.licenca)),
  '',
  '',
  'TEXTOS DAS LICENÇAS',
  traco,
];
for (const c of componentes) {
  partes.push('', '', `${c.nome} ${c.versao} — ${c.licenca}${c.autor ? ` — ${c.autor}` : ''}`, '-'.repeat(78));
  if (c.textos.length === 0) {
    const titular = c.autor ? `; titular: ${c.autor}` : '';
    partes.push(
      PADRAO[c.licenca]
        ? `(o pacote não traz o arquivo da licença; vale o texto-padrão da ${c.licenca}, no fim deste arquivo${titular})`
        : `(o pacote não traz o arquivo da licença; licença declarada: ${c.licenca}${titular})`,
    );
  }
  for (const t of c.textos) {
    if (c.textos.length > 1) partes.push(`[${t.arquivo}]`);
    partes.push(t.texto, '');
  }
}
const padroes = [...padroesUsados].filter((l) => PADRAO[l]).sort();
if (padroes.length) {
  partes.push('', '', 'TEXTOS-PADRÃO DAS LICENÇAS', traco);
  for (const l of padroes) partes.push('', '', l, '-'.repeat(78), PADRAO[l], '');
}

// BOM na frente: servido como text/plain sem charset (o servidor do Vite, muito
// servidor estático), o navegador lê em Latin-1 e o "ç" vira lixo. O BOM manda ler em UTF-8.
writeFileSync(SAIDA, '﻿' + partes.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n', 'utf8');
console.log(`terceiros.txt: ${componentes.length} componentes → ${SAIDA}`);
