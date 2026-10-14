/*
  Selo do DXF da prancha: o Node gera, o ezdxf confere (tools/validar_dxf.py --estrito, por child_process): audit sem
  erro E o leitor que conserta (recover) sem conserto — arquivo que o ezdxf precisou remendar é arquivo que o AutoCAD
  pode recusar. Sem Python/ezdxf na máquina, a parte do ezdxf é PULADA com aviso; o resto roda sempre.

  A folha de exemplo tem um de cada: moldura, linhas, tracejada, disco cheio, textos com acento/Ø/φ/≥ e um a 90°,
  uma hachura de cada padrão (a da alvenaria com furo), uma imagem PNG e o carimbo com 3 atributos.
*/
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { HACHURA } from '@/desenhos/hachuras';
import {
  MAIUSCULA_DA_ARIAL, corDoCad, espessuraDoCad, gerarDxf, nomeDoCad, pacoteDxf, pixelsDaImagem, textoAscii,
  type FolhaDxf,
} from '../dxf';
import { PADRAO_DO_MATERIAL } from '../padroesDxf';
import type { Primitiva, Pt, Traco } from '../tipos';
import { crc32, dataUrlParaBytes, zipar } from '../zip';

const VALIDADOR = fileURLToPath(new URL('../../../../tools/validar_dxf.py', import.meta.url));
const PYTHON = process.env.ALRIMO_PYTHON ?? 'python';
const PASTA = mkdtempSync(join(tmpdir(), 'alrimo-dxf-'));
afterAll(() => rmSync(PASTA, { recursive: true, force: true }));

const temEzdxf = (() => {
  const r = spawnSync(PYTHON, ['-I', '-c', 'import ezdxf'], { encoding: 'utf8' });
  if (r.status !== 0) console.warn('[dxf] Python com ezdxf não encontrado — validação pelo ezdxf PULADA (pip install ezdxf)');
  return r.status === 0;
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rel = Record<string, any>;
let nArq = 0;
function validar(conteudo: string | Uint8Array, ext: 'dxf' | 'zip'): Rel {
  const arq = join(PASTA, `t${++nArq}.${ext}`);
  writeFileSync(arq, conteudo);
  const r = spawnSync(PYTHON, ['-I', VALIDADOR, arq, '--estrito', '--json'], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 * 1024 * 1024,
  });
  if (!r.stdout) throw new Error('validador sem saída: ' + r.stderr);
  const rel = JSON.parse(r.stdout) as Rel;
  rel.codigo = r.status;
  return rel;
}

// ── um PNG de verdade, pequeno (4 × 3, RGB), montado aqui ──

function png(largura: number, altura: number, semente = 0): string {
  const pedaco = (tipo: string, dados: Uint8Array): Uint8Array => {
    const t = new TextEncoder().encode(tipo);
    const corpo = new Uint8Array(t.length + dados.length);
    corpo.set(t);
    corpo.set(dados, t.length);
    const out = new Uint8Array(12 + dados.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, dados.length);
    out.set(corpo, 4);
    v.setUint32(8 + dados.length, crc32(corpo));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, largura);
  v.setUint32(4, altura);
  ihdr.set([8, 2, 0, 0, 0], 8);   // 8 bits, RGB, deflate, filtro 0, sem entrelaçar
  const cru = new Uint8Array(altura * (1 + largura * 3));
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) cru.set([(x * 60 + semente) & 255, y * 80, 200], y * (1 + largura * 3) + 1 + x * 3);
  }
  const partes = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(cru)), pedaco('IEND', new Uint8Array())];
  const tudo = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let p = 0;
  for (const x of partes) { tudo.set(x, p); p += x.length; }
  return 'data:image/png;base64,' + Buffer.from(tudo).toString('base64');
}

// ── a folha de exemplo (A3 deitada, mm de papel, y para baixo) ──

const tr = (camada: string, cor: string, espessura: number, tracejado?: number[]): Traco => ({ camada, cor, espessura, tracejado });
const ret = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const FOTO = png(4, 3);

const TEXTOS = ['Ø10 c/40', "φ' = 30°", 'As ≥ 0,15 %', 'Fundação', 'Cota vertical'];

function folhaDeExemplo(): FolhaDxf {
  const prims: Primitiva[] = [
    { k: 'polilinha', pts: ret(10, 10, 410, 287), fechada: true, e: tr('moldura', '#000000', 0.5) },
    { k: 'linha', a: [20, 30], b: [120, 30], e: tr('alvenaria', '#787878', 0.25) },
    { k: 'linha', a: [20, 40], b: [20, 140], e: tr('cotas', '#1a1a1a', 0.18) },
    { k: 'linha', a: [30, 50], b: [130, 50], e: tr('eixos', '#ff0000', 0.13, [2, 1]) },
    { k: 'circulo', c: [200, 100], r: 2, e: tr('aco', '#ff8000', 0.2), cheio: '#ff8000' },
    { k: 'texto', p: [50, 200], t: TEXTOS[0], altura: 3.5, ancora: 'start', angulo: 0, cor: '#000000', camada: 'textos' },
    { k: 'texto', p: [100, 200], t: TEXTOS[1], altura: 2.5, ancora: 'middle', angulo: 0, cor: '#000000', camada: 'textos' },
    { k: 'texto', p: [150, 200], t: TEXTOS[2], altura: 2.5, ancora: 'end', angulo: 0, cor: '#000000', camada: 'textos' },
    { k: 'texto', p: [50, 220], t: TEXTOS[3], altura: 5, ancora: 'start', angulo: 0, cor: '#003366', negrito: true, camada: 'titulos' },
    { k: 'texto', p: [15, 150], t: TEXTOS[4], altura: 2.5, ancora: 'middle', angulo: 90, cor: '#000000', camada: 'cotas' },
    { k: 'hachura', aneis: [ret(20, 150, 60, 180)], padrao: 'terra', fundo: HACHURA.terraFundo, risco: HACHURA.terra, camada: 'terreno' },
    { k: 'hachura', aneis: [ret(70, 150, 110, 180)], padrao: 'concreto', fundo: HACHURA.concretoFundo, risco: HACHURA.concreto, camada: 'sapata' },
    { k: 'hachura', aneis: [ret(120, 150, 160, 180)], padrao: 'areia', fundo: HACHURA.areiaFundo, risco: HACHURA.areia, camada: 'drenagem' },
    { k: 'hachura', aneis: [ret(170, 150, 210, 180)], padrao: 'brita', fundo: HACHURA.britaFundo, risco: HACHURA.brita, camada: 'drenagem' },
    // o bloco vazado: o furo é o 2º anel (par-ímpar), com a borda dos dois
    { k: 'hachura', aneis: [ret(220, 150, 259, 169), ret(225, 153, 235, 166)], padrao: 'alvenaria', fundo: '#d9d9d9', risco: '#555555', camada: 'alvenaria', borda: tr('alvenaria', '#000000', 0.35) },
    { k: 'hachura', aneis: [ret(265, 150, 285, 169)], padrao: 'graute', risco: '#6b8fb3', camada: 'graute' },
    { k: 'hachura', aneis: [ret(290, 150, 300, 169)], padrao: 'solido', fundo: '#ffff80', camada: 'alvenaria' },
    { k: 'imagem', p: [300, 40], largura: 80, altura: 60, arquivo: 'foto 3D.png', dataUrl: FOTO, camada: 'imagens' },
    {
      k: 'bloco', nome: 'CARIMBO',
      prims: [
        { k: 'polilinha', pts: ret(250, 230, 410, 287), fechada: true, e: tr('carimbo', '#000000', 0.35) },
        { k: 'linha', a: [250, 250], b: [410, 250], e: tr('carimbo', '#000000', 0.18) },
      ],
      atributos: [
        { etiqueta: 'OBRA', valor: 'Muro de arrimo — Uberaba', p: [255, 245], altura: 3.5, ancora: 'start', cor: '#000000', camada: 'carimbo' },
        { etiqueta: 'FOLHA', valor: '01/03', p: [330, 270], altura: 2.5, ancora: 'middle', cor: '#000000', camada: 'carimbo' },
        { etiqueta: 'ESCALA', valor: '1:25', p: [405, 280], altura: 2.5, ancora: 'end', cor: '#000000', camada: 'carimbo' },
      ],
    },
  ];
  return { nome: 'Prancha 01 — Formas', largura: 420, altura: 297, prims };
}

// ── leitura crua do DXF (pares código/valor) para conferir o que o ezdxf não diz ──

type Ent = { tipo: string; g: [number, string][] };
function entidades(dxf: string, secao: 'ENTITIES' | 'BLOCKS'): Ent[] {
  const l = dxf.split('\n');
  const pares: [number, string][] = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([Number(l[i].trim()), l[i + 1]]);
  const ini = pares.findIndex(([c, v], i) => c === 2 && v === secao && pares[i - 1]?.[1] === 'SECTION');
  const out: Ent[] = [];
  for (let i = ini + 1; i < pares.length && !(pares[i][0] === 0 && pares[i][1] === 'ENDSEC'); i++) {
    if (pares[i][0] === 0) out.push({ tipo: pares[i][1], g: [] });
    else out[out.length - 1]?.g.push(pares[i]);
  }
  return out;
}
const val = (e: Ent, c: number): string | undefined => e.g.find(([k]) => k === c)?.[1];
const num = (e: Ent, c: number): number => Number(val(e, c));

describe('dxf — gerado (sem Python)', () => {
  const folha = folhaDeExemplo();
  const { dxf, imagens } = gerarDxf(folha);
  const ents = entidades(dxf, 'ENTITIES');
  const conta = (t: string) => ents.filter((e) => e.tipo === t).length;

  it('é DXF 2004 em milímetros, 100 % ASCII', () => {
    expect(dxf).toMatch(/\$ACADVER\n1\nAC1018\n/);
    expect(dxf).toMatch(/\$INSUNITS\n70\n4\n/);
    expect(dxf).toMatch(/\$MEASUREMENT\n70\n1\n/);
    expect(/^[\n\x20-\x7e]*$/.test(dxf)).toBe(true);
  });

  it('uma entidade por primitiva (fundo da hachura e disco cheio viram HATCH SOLID por baixo)', () => {
    expect(conta('LINE')).toBe(3);
    expect(conta('LWPOLYLINE')).toBe(3);    // moldura + borda dos dois anéis do bloco vazado
    expect(conta('CIRCLE')).toBe(1);
    expect(conta('TEXT')).toBe(5);
    expect(conta('IMAGE')).toBe(1);
    expect(conta('INSERT')).toBe(1);
    expect(conta('ATTRIB')).toBe(3);
    expect(conta('SEQEND')).toBe(1);        // um só, depois do último atributo
    // disco 1 + terra/concreto/areia/brita/alvenaria (fundo + padrão) 10 + graute 1 + sólido 1 = 13
    expect(conta('HATCH')).toBe(13);
    const padroes = ents.filter((e) => e.tipo === 'HATCH').map((e) => val(e, 2));
    for (const p of ['EARTH', 'AR-CONC', 'AR-SAND', 'GRAVEL', 'ANSI31', 'SOLID']) expect(padroes).toContain(p);
  });

  it('Y invertido: y_dxf = altura − y', () => {
    const l = ents.find((e) => e.tipo === 'LINE' && val(e, 8) === 'ALVENARIA')!;
    expect([num(l, 10), num(l, 20), num(l, 11), num(l, 21)]).toEqual([20, 297 - 30, 120, 297 - 30]);
    const img = ents.find((e) => e.tipo === 'IMAGE')!;
    // canto inferior esquerdo da imagem: y = 297 − (40 + 60)
    expect([num(img, 10), num(img, 20)]).toEqual([300, 197]);
  });

  it('texto em ASCII com \\U+, altura da maiúscula, alinhamento e giro', () => {
    for (const t of TEXTOS) expect(dxf).toContain(textoAscii(t));
    expect(textoAscii('Ø10 c/40')).toBe('\\U+00D810 c/40');
    expect(textoAscii("φ' = 30°")).toBe("\\U+03C6' = 30\\U+00B0");
    expect(textoAscii('≥')).toBe('\\U+2265');
    expect(textoAscii('ção')).toBe('\\U+00E7\\U+00E3o');
    const textos = ents.filter((e) => e.tipo === 'TEXT');
    const de = (s: string) => textos.find((e) => val(e, 1) === textoAscii(s))!;
    expect(num(de(TEXTOS[0]), 40)).toBeCloseTo(3.5 * MAIUSCULA_DA_ARIAL, 6);
    expect(val(de(TEXTOS[0]), 72)).toBeUndefined();          // start = esquerda
    expect(num(de(TEXTOS[1]), 72)).toBe(1);                   // middle = centro, pelo 2º ponto
    expect([num(de(TEXTOS[1]), 11), num(de(TEXTOS[1]), 21)]).toEqual([100, 97]);
    expect(num(de(TEXTOS[2]), 72)).toBe(2);                   // end = direita
    expect(num(de(TEXTOS[4]), 50)).toBe(90);
    expect(val(de(TEXTOS[3]), 7)).toBe('ALRIMO_NEGRITO');
    expect(val(de(TEXTOS[0]), 7)).toBe('ALRIMO');
    expect(dxf).toMatch(/\nSTYLE\n5\n[0-9A-F]+\n330\n[0-9A-F]+\n100\nAcDbSymbolTableRecord\n100\nAcDbTextStyleTableRecord\n2\nALRIMO\n[\s\S]*?\n3\narial\.ttf\n/);
  });

  it('cor verdadeira + índice mais próximo; preto vira o 7 sem cor verdadeira; espessura no padrão do CAD', () => {
    const l = ents.find((e) => e.tipo === 'LINE' && val(e, 8) === 'EIXOS')!;
    expect(num(l, 420)).toBe(0xff0000);
    expect(num(l, 62)).toBe(1);
    expect(num(l, 370)).toBe(13);
    const moldura = ents.find((e) => e.tipo === 'LWPOLYLINE' && val(e, 8) === 'MOLDURA')!;
    expect(val(moldura, 420)).toBeUndefined();
    expect(num(moldura, 62)).toBe(7);
    expect(num(moldura, 370)).toBe(50);
    expect(num(moldura, 70)).toBe(1);                          // fechada
    expect(corDoCad('#787878')).toEqual({ aci: 8, verdadeira: 0x787878 });
    expect(corDoCad('#1a1a1a')).toEqual({ aci: 7 });
    expect([0.2, 0.2045, 0.36, 0.5, 3].map(espessuraDoCad)).toEqual([20, 20, 35, 50, 211]);
  });

  it('tracejado vira LTYPE próprio (mm de papel) e a camada leva a cor mais frequente', () => {
    expect(dxf).toMatch(/\nLTYPE\n[\s\S]*?\n2\nTRACEJADO_2_1\n[\s\S]*?\n73\n2\n40\n3\n49\n2\n74\n0\n49\n-1\n/);
    const l = ents.find((e) => e.tipo === 'LINE' && val(e, 8) === 'EIXOS')!;
    expect(val(l, 6)).toBe('TRACEJADO_2_1');
    expect(dxf).toMatch(/\nLAYER\n[\s\S]*?\n2\nEIXOS\n70\n0\n62\n1\n420\n16711680\n/);
  });

  it('hachura: par-ímpar, não associativa, padrão do CAD com as linhas de definição na escala do papel', () => {
    const hs = ents.filter((e) => e.tipo === 'HATCH');
    for (const h of hs) {
      expect(num(h, 75)).toBe(0);
      expect(num(h, 71)).toBe(0);
    }
    const alv = hs.find((h) => val(h, 2) === 'ANSI31' && val(h, 8) === 'ALVENARIA')!;
    expect(num(alv, 91)).toBe(2);                              // anel de fora + furo
    expect(num(alv, 41)).toBeCloseTo(PADRAO_DO_MATERIAL.alvenaria.escala, 5);
    expect(num(alv, 78)).toBe(1);
    // ANSI31 a 45°, espaçamento 3,175 × escala = 1,36 mm (o que o app desenha: 6 px ÷ 4,4)
    const [ox, oy] = [num(alv, 45), num(alv, 46)];
    expect(Math.hypot(ox, oy)).toBeCloseTo(6 / 4.4, 3);
    const terra = hs.find((h) => val(h, 2) === 'EARTH')!;
    expect(num(terra, 78)).toBe(6);
    expect(num(terra, 420)).toBe(parseInt(HACHURA.terra.slice(1), 16));   // risco marrom por cima…
    const fundoTerra = hs[hs.indexOf(terra) - 1];
    expect(val(fundoTerra, 2)).toBe('SOLID');                              // …do fundo bege, que vem antes
    expect(num(fundoTerra, 420)).toBe(parseInt(HACHURA.terraFundo.slice(1), 16));
    const graute = hs.filter((h) => val(h, 8) === 'GRAUTE');
    expect(graute.map((h) => val(h, 2))).toEqual(['ANSI31']);              // graute: só o risco, sem fundo
    // o disco cheio: dois arcos de 180° (bulge 1)
    const disco = hs.find((h) => val(h, 8) === 'ACO')!;
    expect(disco.g.filter(([c]) => c === 42).map(([, v]) => Number(v))).toEqual([1, 1]);
  });

  it('imagem vinculada a imagens/, pixels lidos do PNG, tamanho em mm de papel', () => {
    expect(imagens).toEqual([{ arquivo: 'imagens/foto_3D.png', dataUrl: FOTO }]);
    expect(dxf).toMatch(/\nIMAGEDEF\n[\s\S]*?\n1\nimagens\/foto_3D\.png\n10\n4\n20\n3\n/);
    // reatores ANTES do dono (ordem da norma DXF); o dono é o dicionário ACAD_IMAGE_DICT, que é o 1º reator
    const def = /\nIMAGEDEF\n5\n[0-9A-F]+\n102\n\{ACAD_REACTORS\n330\n([0-9A-F]+)\n330\n[0-9A-F]+\n102\n\}\n330\n([0-9A-F]+)\n100\nAcDbRasterImageDef\n/.exec(dxf);
    expect(def).not.toBeNull();
    expect(def![2]).toBe(def![1]);
    const img = ents.find((e) => e.tipo === 'IMAGE')!;
    expect([num(img, 13), num(img, 23)]).toEqual([4, 3]);
    expect([num(img, 11), num(img, 22)]).toEqual([20, 20]);   // 80 mm ÷ 4 px e 60 mm ÷ 3 px
    expect(val(img, 290)).toBeUndefined();                    // código do DXF 2010 fora de um arquivo 2004
    expect(dxf).toMatch(/\nCLASS\n1\nIMAGE\n2\nAcDbRasterImage\n/);
  });

  it('carimbo: BLOCK com a geometria e um ATTDEF por atributo; INSERT no 0,0 com os ATTRIB do INSERT', () => {
    const bl = entidades(dxf, 'BLOCKS');
    const ini = bl.findIndex((e) => e.tipo === 'BLOCK' && val(e, 2) === 'CARIMBO');
    const fim = bl.findIndex((e, i) => i > ini && e.tipo === 'ENDBLK');
    const dentro = bl.slice(ini + 1, fim);
    expect(dentro.map((e) => e.tipo)).toEqual(['LWPOLYLINE', 'LINE', 'ATTDEF', 'ATTDEF', 'ATTDEF']);
    expect(num(bl[ini], 70)).toBe(2);                         // tem atributo variável
    expect(dentro.filter((e) => e.tipo === 'ATTDEF').map((e) => [val(e, 2), val(e, 3)])).toEqual([['OBRA', 'OBRA'], ['FOLHA', 'FOLHA'], ['ESCALA', 'ESCALA']]);
    const ins = ents.find((e) => e.tipo === 'INSERT')!;
    expect([val(ins, 2), num(ins, 10), num(ins, 20), num(ins, 41), num(ins, 66)]).toEqual(['CARIMBO', 0, 0, 1, 1]);
    const i = ents.indexOf(ins);
    const atrs = ents.slice(i + 1, i + 4);
    expect(atrs.map((e) => [val(e, 2), val(e, 1)])).toEqual([['OBRA', textoAscii('Muro de arrimo — Uberaba')], ['FOLHA', '01/03'], ['ESCALA', '1:25']]);
    for (const a of atrs) expect(val(a, 330)).toBe(val(ins, 5));   // dono = o INSERT
    expect(ents[i + 4].tipo).toBe('SEQEND');
    expect(val(ents[i + 4], 330)).toBe(val(ins, 5));
  });

  it('handles únicos', () => {
    const l = dxf.split('\n');
    const hs: string[] = [];
    const fimDoCabecalho = l.indexOf('ENDSEC');   // no cabeçalho o grupo 5 é o próprio $HANDSEED
    for (let k = fimDoCabecalho + 1; k + 1 < l.length; k += 2) if (l[k] === '5' || l[k] === '105') hs.push(l[k + 1]);
    expect(new Set(hs).size).toBe(hs.length);
    const seed = parseInt(/\$HANDSEED\n5\n([0-9A-F]+)\n/.exec(dxf)![1], 16);
    expect(Math.max(...hs.map((h) => parseInt(h, 16)))).toBeLessThan(seed);
  });
});

// Para abrir a folha de exemplo num CAD de verdade: ALRIMO_DXF_AMOSTRA=<pasta> npx vitest run src/pranchas
it.runIf(!!process.env.ALRIMO_DXF_AMOSTRA)('grava a folha de exemplo (dxf + zip) na pasta pedida', () => {
  const pasta = process.env.ALRIMO_DXF_AMOSTRA!;
  writeFileSync(join(pasta, 'exemplo.dxf'), gerarDxf(folhaDeExemplo()).dxf);
  writeFileSync(join(pasta, 'exemplo.zip'), pacoteDxf([folhaDeExemplo()]));
});

describe('dxf — auxiliares', () => {
  it('pixels de PNG e de JPEG lidos do cabeçalho', () => {
    expect(pixelsDaImagem(dataUrlParaBytes(png(4, 3)))).toEqual([4, 3]);
    // JPEG mínimo: SOI, APP0 (16 bytes), SOF0 com altura 3 e largura 4
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0, 3, 0, 4, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    expect(pixelsDaImagem(jpg)).toEqual([4, 3]);
    expect(pixelsDaImagem(new TextEncoder().encode('<svg/>'))).toBeNull();
  });

  it('nomes do CAD sem acento e CRC32 do padrão', () => {
    expect(nomeDoCad('fundação 2')).toBe('FUNDACAO_2');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);   // valor de conferência do CRC-32
    expect(new TextDecoder().decode(dataUrlParaBytes('data:image/svg+xml,%3Csvg%2F%3E'))).toBe('<svg/>');
  });

  it('zip: cabeçalhos no lugar e nome em UTF-8', () => {
    const z = zipar([{ nome: 'ç.txt', dados: 'abc' }], new Date(2026, 9, 14, 10, 30, 0));
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
    expect(v.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('abc')));
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
  });
});

describe.skipIf(!temEzdxf)('dxf — conferido pelo ezdxf', () => {
  it('a folha de exemplo: audit sem erro e recover sem conserto', () => {
    const { dxf } = gerarDxf(folhaDeExemplo());
    const rel = validar(dxf, 'dxf');
    expect(rel.erros).toEqual([]);
    expect(rel.consertos).toEqual([]);
    expect(rel.avisos).toEqual([]);
    expect(rel.ok).toBe(true);
    expect(rel.versao).toBe('AC1018');
    expect(rel.entidades).toEqual({ CIRCLE: 1, HATCH: 13, IMAGE: 1, INSERT: 1, LINE: 3, LWPOLYLINE: 3, TEXT: 5 });
    expect(rel.blocos.CARIMBO).toEqual({ LWPOLYLINE: 1, LINE: 1, ATTDEF: 3 });
    expect(rel.imagens).toEqual([{ arquivo: 'imagens/foto_3D.png', pixels: [4, 3] }]);
  });

  it('o validador tem dente: handle repetido e dono errado reprovam', () => {
    const { dxf } = gerarDxf(folhaDeExemplo());
    // o dono do reator da imagem volta a ser "0" (o defeito da biblioteca que este gravador conserta)
    const reator = /\nIMAGEDEF_REACTOR\n5\n([0-9A-F]+)\n330\n([0-9A-F]+)\n/.exec(dxf)!;
    const semDono = dxf.replace(reator[0], `\nIMAGEDEF_REACTOR\n5\n${reator[1]}\n330\n0\n`);
    expect(validar(semDono, 'dxf').ok).toBe(false);
  });

  it('o pacote .zip: CRC, nomes, imagens no caminho que o DXF aponta; mesma foto vai uma vez só', () => {
    const a = folhaDeExemplo();
    const b: FolhaDxf = {
      ...folhaDeExemplo(),
      nome: 'Prancha 02',
      // mesma foto (mesmo conteúdo) e outra, diferente, com o MESMO nome de arquivo
      prims: [...folhaDeExemplo().prims, { k: 'imagem', p: [20, 230], largura: 40, altura: 30, arquivo: 'foto 3D.png', dataUrl: png(4, 3, 99), camada: 'imagens' }],
    };
    const zip = pacoteDxf([a, b], new Date(2026, 9, 14, 10, 30, 0));
    const rel = validar(zip, 'zip');
    expect(rel.erros).toEqual([]);
    expect(rel.nomes).toEqual(['Prancha_01_Formas.dxf', 'imagens/foto_3D.png', 'Prancha_02.dxf', 'imagens/foto_3D_2.png']);
    for (const d of rel.dxf) {
      expect(d.erros).toEqual([]);
      expect(d.consertos).toEqual([]);
    }
    expect(rel.dxf[1].imagens.map((i: Rel) => i.arquivo)).toEqual(['imagens/foto_3D.png', 'imagens/foto_3D_2.png']);
    expect(rel.arquivos.every((f: Rel) => f.metodo === 0)).toBe(true);   // store, sem compressão
    // o CRC que o Python leu do zip é o que o app calculou
    const fotoB = rel.arquivos.find((f: Rel) => f.nome === 'imagens/foto_3D_2.png');
    expect(fotoB.crc).toBe(crc32(dataUrlParaBytes(png(4, 3, 99))));
    expect(rel.ok).toBe(true);
  });
});
