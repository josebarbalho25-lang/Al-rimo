/*
  Selo do IFC: o Node gera, o ifcopenshell confere (tools/validar_ifc.py, por child_process).
  Sem Python/ifcopenshell na máquina, a parte do validador é PULADA com aviso — não falha; a conferência de texto
  (conferirStep) roda sempre.

  Mutações: cada defeito que já derrubou um IFC de verdade (ver scratchpad/entender/ifc.md §8) é injetado no
  arquivo e o validador TEM de reprovar. Se uma mutação passar, o validador perdeu o dente.
*/
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado, Valor } from '@/motor/tipos';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { compararNatural, exportarIfc, gerarIfc, normalizarData, type InfoIfc } from './exportarIfc';
import { conferirStep, decodificar, lerStep, secaoData } from './conferir';
import { guid } from './step';
import { MEDIDAS, muroDeTeste } from './teste/muroDeTeste';

const VALIDADOR = fileURLToPath(new URL('../../../tools/validar_ifc.py', import.meta.url));
const PYTHON = process.env.ALRIMO_PYTHON ?? 'python';
const PASTA = mkdtempSync(join(tmpdir(), 'alrimo-ifc-'));
afterAll(() => rmSync(PASTA, { recursive: true, force: true }));
const INFO: InfoIfc = { projeto: 'Muro de arrimo — teste çã Ø', autor: 'José Barbalho', data: '2026-01-01T00:00:00', chave: 'teste' };

// Quando a modulação existir, o IFC é conferido também com o muro de verdade da aula 12.2 e da 12.3.
const modulacao = import.meta.glob('../modulacao/index.ts');
async function modulacaoDeVerdade(): Promise<((r: Resultado) => Modelo) | null> {
  const f = Object.values(modulacao)[0];
  if (!f) return null;
  const mod = (await f()) as {
    gerarModelo: (r: Resultado, extras: Record<string, Valor>) => Modelo;
    padroesDoModelo: () => Record<string, Valor>;
  };
  return (r) => mod.gerarModelo(r, mod.padroesDoModelo());
}

const temPython = (() => {
  const r = spawnSync(PYTHON, ['-I', '-c', 'import ifcopenshell'], { encoding: 'utf8' });
  if (r.status !== 0) console.warn('[ifc] Python com ifcopenshell não encontrado — validação pelo ifcopenshell PULADA');
  return r.status === 0;
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rel = Record<string, any>;
let nArq = 0;
function validar(texto: string, ...flags: string[]): Rel {
  const arq = join(PASTA, `t${++nArq}.ifc`);
  writeFileSync(arq, texto, 'latin1');   // latin1 = grava byte a byte (para a mutação de UTF-8 cru poder existir)
  const r = spawnSync(PYTHON, ['-I', VALIDADOR, arq, '--json', ...flags], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 64 * 1024 * 1024,
  });
  if (!r.stdout) throw new Error('validador sem saída: ' + r.stderr);
  const rel = JSON.parse(r.stdout) as Rel;
  rel.codigo = r.status;
  return rel;
}

/** Peças que viram IfcBuildingElementPart (alvenaria e graute), por tipo. */
const contaPorTipo = (m: Modelo) => {
  const c: Record<string, number> = {};
  for (const p of m.pecas) {
    if ((p.grupo !== 'muro' && p.grupo !== 'contraforte') || p.tipo === 'SAPATA') continue;
    c[p.tipo] = (c[p.tipo] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : 1)));
};

/** Troca os argumentos de uma entidade, preservando o resto do arquivo. */
function trocarArgs(texto: string, id: number, f: (args: string[]) => string[]): string {
  const { entidades } = lerStep(texto);
  const e = entidades.get(id)!;
  const velho = `#${id}=${e.tipo}(${e.args.join(',')});`;
  expect(texto).toContain(velho);
  return texto.replace(velho, `#${id}=${e.tipo}(${f([...e.args]).join(',')});`);
}
const primeiro = (texto: string, tipo: string) => [...lerStep(texto).entidades.values()].find((e) => e.tipo === tipo)!;

describe('exportarIfc — texto (sem Python)', () => {
  const balanco = muroDeTeste();
  const completo = muroDeTeste({ contrafortes: true, drenagem: true, trechos: 2 });

  it('balanço: conferência do texto sem erro; contagem bate com o modelo', () => {
    const r = gerarIfc(balanco, INFO);
    const c = conferirStep(r.texto);
    expect(c.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    const partes = balanco.pecas.filter((p) => p.grupo === 'muro').length;
    expect(r.contagem.IfcBuildingElementPart).toBe(partes);
    expect(r.contagem.IfcFooting).toBe(1);
    expect(r.contagem.IfcWall).toBe(1);
    expect(r.contagem.IfcReinforcingBar).toBe(balanco.barras.length);
    // uma geometria por Geometria usada: blocos, meio, canaleta, meia, graute furo, graute canaleta, sapata
    expect(c.contagem.IFCREPRESENTATIONMAP).toBe(7 + 5);   // + 5 posições de barra
    expect(c.contagem.IFCMAPPEDITEM).toBe(partes + 1 + balanco.barras.length);
    expect(r.texto).not.toMatch(/ATERRO/);
  });

  it('completo: contrafortes, drenagem, 2 trechos — sem erro e sem aviso', () => {
    const r = gerarIfc(completo, { ...INFO, drenagem: true });
    expect(conferirStep(r.texto).erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(r.contagem.IfcWall).toBe(2 + 4);   // 2 trechos de muro + 4 contrafortes
    expect(r.contagem.IfcFooting).toBe(2);
    expect(r.contagem.IfcPipeSegment).toBe(2);
    expect(r.contagem.IfcCovering).toBe(2);
    expect(r.contagem.IfcBuildingElementProxy).toBe(2);
    expect(r.texto).not.toMatch(/EncaixeProvisorio/);
    const prov = gerarIfc({ ...completo, familia: { ...completo.familia, provisoria: true } }, INFO);
    expect(prov.texto.match(/'EncaixeProvisorio'/g)?.length).toBe(4);   // um por contraforte
    // sem pedir, a drenagem fica fora
    const s = gerarIfc(completo, INFO);
    expect(s.contagem.IfcPipeSegment).toBeUndefined();
    expect(s.texto).not.toMatch(/IFCPIPESEGMENT|IFCCOVERING|IFCBUILDINGELEMENTPROXY\(/);
  });

  it('determinístico: mesmo muro → mesmo arquivo; GUIDs só dependem da chave do projeto', () => {
    const a = exportarIfc(completo, INFO);
    expect(exportarIfc(completo, INFO)).toBe(a);
    // outra data: a seção DATA só muda na data de criação; os GUIDs não mudam
    const b = exportarIfc(completo, { ...INFO, data: '2027-05-05T12:00:00' });
    const guids = (t: string) => [...t.matchAll(/=IFC[A-Z]+\('([0-3][0-9A-Za-z_$]{21})'/g)].map((m) => m[1]);
    expect(guids(b)).toEqual(guids(a));
    const difs = secaoData(a).split('\n').filter((l, i) => l !== secaoData(b).split('\n')[i]);
    expect(difs.length).toBe(1);
    expect(difs[0]).toMatch(/IFCOWNERHISTORY/);
    // outro projeto (outra chave) → outros GUIDs
    expect(guids(exportarIfc(completo, { ...INFO, chave: 'outro' }))[0]).not.toBe(guids(a)[0]);
    // o GUID da peça vem do id dela
    expect(a).toContain(`'${guid('teste|peca/T1.M.f03.p002')}'`);
    // data sem fuso = UTC (não depende do relógio da máquina): 2026-01-01T00:00:00Z = 1767225600
    expect(a).toMatch(/IFCOWNERHISTORY\(.*,1767225600\);/);
  });

  it('barra repetida da mesma posição vira IfcMappedItem; barra diferente leva curva própria', () => {
    const m = muroDeTeste();
    const desviada = m.barras.filter((b) => b.posicao === 'N4')[1];   // a 2ª: a 1ª é o molde da posição
    desviada.eixo = desviada.eixo.map(([x, y, z], i) => [x, y + (i === 0 ? 5 : 0), z]);   // não é mais cópia transladada
    const t = exportarIfc(m, INFO);
    expect(conferirStep(t).erros).toEqual([]);
    const c = conferirStep(t).contagem;
    expect(c.IFCSWEPTDISKSOLID).toBe(5 + 1);
  });

  it('peça com perfil degenerado ou geometria inexistente: avisa e segue', () => {
    const m = muroDeTeste();
    m.pecas[0] = { ...m.pecas[0], geometria: 'nao-existe' };
    m.geometrias['zero'] = { chave: 'zero', eixo: 'Z', extensao: 100, volume_mm3: 0, perfil: { contorno: [[0, 0], [1, 0], [2, 0]] } };
    m.pecas[1] = { ...m.pecas[1], geometria: 'zero' };
    m.pecas.push({ ...m.pecas[2] });   // id repetido
    const r = gerarIfc(m, INFO);
    expect(conferirStep(r.texto).erros).toEqual([]);
    expect(r.avisos.length).toBe(3);
  });

  // ALRIMO_IFC_SAIDA=<pasta> grava os arquivos de exemplo para abrir no Revit/BIMcollab (conferência a olho)
  it.skipIf(!process.env.ALRIMO_IFC_SAIDA)('grava os exemplos na pasta pedida', async () => {
    const pasta = process.env.ALRIMO_IFC_SAIDA!;
    writeFileSync(join(pasta, 'muro_balanco.ifc'), exportarIfc(balanco, { ...INFO, resultado: resultadoDoGabarito('aula122') }));
    writeFileSync(join(pasta, 'muro_completo.ifc'), exportarIfc(completo, { ...INFO, drenagem: true }));
    const gerar = await modulacaoDeVerdade();
    for (const c of gerar ? ['aula122', 'aula123'] : []) {
      const r = resultadoDoGabarito(c);
      writeFileSync(join(pasta, `${c}.ifc`), exportarIfc(gerar!(r), { ...INFO, projeto: `Al-rimo — ${c}`, resultado: r, drenagem: true }));
    }
  });

  it('tamanho: ≤ 0,5 kB por bloco (meta do brief)', () => {
    // mais fiadas com o mesmo comprimento: só cresce o nº de blocos (graute e barras mudam de altura, não de número)
    const baixo = gerarIfc(muroDeTeste({ blocosPorFiada: 40, fiadas: 10, canaletas: [] }), INFO);
    const alto = gerarIfc(muroDeTeste({ blocosPorFiada: 40, fiadas: 20, canaletas: [] }), INFO);
    const n = (r: typeof baixo) => r.contagem.IfcBuildingElementPart;
    const porBloco = (alto.texto.length - baixo.texto.length) / (n(alto) - n(baixo));
    expect(porBloco).toBeLessThan(512);
    const todo = alto.texto.length / n(alto);
    expect(todo).toBeLessThan(600);   // o arquivo inteiro dividido pelas peças (inclui sapata, barras, tipos)
    console.info(`[ifc] ${porBloco.toFixed(0)} B por bloco; arquivo de ${(alto.texto.length / 1024).toFixed(0)} kB com ${n(alto)} peças (${todo.toFixed(0)} B/peça)`);
  });

  it('data: só o dia (o que a tela manda), com hora, com fuso; sem fuso = UTC; data ruim derruba', () => {
    expect(normalizarData('2026-10-08')).toEqual({ texto: '2026-10-08T00:00:00', segundos: 1791417600 });
    expect(normalizarData('2026-01-01T00:00:00')).toEqual({ texto: '2026-01-01T00:00:00', segundos: 1767225600 });
    expect(normalizarData('2026-10-08T12:00Z').segundos).toBe(1791460800);
    expect(normalizarData('2026-10-08T12:00:00-03:00').segundos).toBe(1791471600);
    expect(normalizarData(new Date(Date.UTC(2026, 9, 8, 15, 4, 5, 678)).toISOString()))
      .toEqual({ texto: '2026-10-08T15:04:05', segundos: 1791471845 });
    expect(() => normalizarData('08/10/2026')).toThrow(/data inválida/);
    expect(() => normalizarData('2026-02-30')).toThrow(/data inválida/);
    const t = exportarIfc(muroDeTeste(), { ...INFO, data: '2026-10-08' });
    expect(t).toContain("FILE_NAME('Muro_de_arrimo_teste_ca.ifc','2026-10-08T00:00:00'");
    expect(t).toMatch(/IFCOWNERHISTORY\(.*,1791417600\);/);
  });

  it('ordem das posições sem Intl: N1 < N2 < N10 (a ordem das entidades não pode depender da máquina)', () => {
    expect(['N10', 'N2', 'N1', 'N1a', 'contraforte/C10', 'contraforte/C2'].sort(compararNatural))
      .toEqual(['N1', 'N1a', 'N2', 'N10', 'contraforte/C2', 'contraforte/C10']);
  });

  it('zero onde o IFC exige positivo não vai para o arquivo (s_adot = 0: nenhum arranjo passou)', () => {
    const base = resultadoDoGabarito('aula122');
    const r: Resultado = {
      ...base,
      v: (n: string) => (n === 's_adot' ? 0 : base.v(n)),
      num: (n: string) => (n === 's_adot' ? 0 : base.num(n)),
    };
    const t = exportarIfc(muroDeTeste(), { ...INFO, resultado: r });
    expect(conferirStep(t).erros).toEqual([]);
    expect(t).not.toMatch(/VerticalBarPitch/);
    expect(t).toMatch(/'HorizontalBarPitch',\$,IFCPOSITIVELENGTHMEASURE\(0\.8\)/);
    // e a conferência do texto pega o zero, se algum escapar
    const ruim = t.replace('IFCPOSITIVELENGTHMEASURE(0.8)', 'IFCPOSITIVELENGTHMEASURE(0.)');
    expect(conferirStep(ruim).erros.join(' ')).toMatch(/medida positiva com 0\./);
    const solido = primeiro(t, 'IFCEXTRUDEDAREASOLID');
    expect(conferirStep(trocarArgs(t, solido.id, (a) => { a[3] = '0.'; return a; })).erros.join(' ')).toMatch(/tem de ser > 0/);
    const q = primeiro(t, 'IFCQUANTITYLENGTH');
    expect(conferirStep(trocarArgs(t, q.id, (a) => { a[3] = '-1.'; return a; })).erros.join(' ')).toMatch(/valor negativo/);
  });
});

describe.skipIf(!temPython)('exportarIfc — validador ifcopenshell', () => {
  it('balanço: esquema + regras WHERE + estrutura + geometria; números do muro lidos de volta', () => {
    const m = muroDeTeste();
    const rel = validar(exportarIfc(m, INFO), '--regras', '--geom-tudo');
    expect(rel.erros).toEqual([]);
    expect(rel.ok).toBe(true);
    expect(rel.codigo).toBe(0);
    expect(rel.schema).toBe('IFC4');
    expect(rel.partes_por_tipo).toEqual(contaPorTipo(m));

    // nomes com acento voltam iguais (UTF-8 cru seria apagado em silêncio)
    expect(rel.nomes.IfcProject).toEqual([INFO.projeto]);
    expect(rel.pessoas).toEqual(['José Barbalho']);
    expect(rel.nomes.IfcMaterial).toEqual(expect.arrayContaining(['Aço CA-50', 'Bloco de concreto', 'Graute', 'Concreto']));
    const n1 = m.barras.find((b) => b.posicao === 'N1')!;
    expect(rel.nomes.IfcTypeObject).toEqual(expect.arrayContaining([`N1 Ø10 C=${Math.round(n1.comprimento / 10)}`, 'Canaleta 19x19x39', 'Bloco 19x19x39', 'Graute do furo']));
    expect(rel.nomes.IfcBuildingStorey).toEqual(['Topo da sapata']);

    // volume do bloco = (L·t − 2·Ag)·h, o da tabela do curso
    const { T, LB, HB, Ag, B, HS, BD, HD, Y_PE } = MEDIDAS;
    const vb = rel.volumes['IfcBuildingElementPart:BLOCO'];
    // 7 casas: o arquivo grava em µm (toFixed(6) em metro) e o furo de 141,667 mm sai 141,667 — 30 mm³ num bloco
    expect(vb.min).toBeCloseTo(((LB * T - 2 * Ag) * HB) / 1e9, 7);
    expect(vb.max).toBeCloseTo(vb.min, 9);
    // graute: soma = soma dos volumes do modelo
    const vg = m.pecas.filter((p) => p.tipo === 'GRAUTE_FURO').reduce((s, p) => s + m.geometrias[p.geometria].volume_mm3, 0) / 1e9;
    expect(rel.volumes['IfcBuildingElementPart:GRAUTE_FURO'].soma / vg).toBeCloseTo(1, 5);
    // muro: do topo da sapata até fechar a fiada; comprimento N·400 − 10
    const cm = rel.caixas['IfcBuildingElementPart:BLOCO'];
    expect(cm[1][2]).toBeCloseTo(m.dims.H_muro / 1000 - 0.2, 5);   // última fiada de bloco é a 6 (7 é canaleta)
    expect(rel.caixas['IfcBuildingElementPart:CANALETA'][1][2]).toBeCloseTo(m.dims.H_muro / 1000, 5);
    expect(cm[0][0]).toBeCloseTo(0, 6);
    expect(cm[0][1]).toBeCloseTo(0, 6);
    expect(cm[0][2]).toBeCloseTo(0.01, 6);
    // sapata: caixa = B × (h + dente), pé em Y_PE; volume = (B·h + bd·hd)·L
    const cs = rel.caixas['IfcFooting:Sapata corrida T1'];
    expect(cs[0][1]).toBeCloseTo(Y_PE / 1000, 5);
    expect(cs[1][1]).toBeCloseTo((Y_PE + B) / 1000, 5);
    expect(cs[0][2]).toBeCloseTo(-(HS + HD) / 1000, 5);
    expect(cs[1][2]).toBeCloseTo(0, 5);
    expect(rel.volumes['IfcFooting:Sapata corrida T1'].min).toBeCloseTo(((B * HS + BD * HD) * m.dims.L_real) / 1e9, 6);

    // barras: diretriz com arco verdadeiro = comprimento desenvolvido do modelo; repetidas = mapeadas
    for (const b of m.barras) {
      const lida = rel.barras[b.id];
      expect(lida, b.id).toBeTruthy();
      expect(lida.comprimento * 1000).toBeCloseTo(b.comprimento, 2);
      expect(lida.raio * 1000).toBeCloseTo(b.diametro / 2, 6);
      expect(lida.mapeada).toBe(true);
    }
    expect(rel.barras['T1.N1.0'].arcos).toBe(1);
    expect(rel.barras['T1.N4.0'].arcos).toBe(2);
    // a espera desce até o fundo da sapata menos o cobrimento, dentro do furo (Y entre as paredes do bloco)
    const cb = rel.por_tag['T1.N1.0'].caixa;
    expect(cb[0][2]).toBeCloseTo((-HS + 40 + 10) / 1000, 4);
    expect(cb[1][1]).toBeCloseTo((140 + 5) / 1000, 4);

    // Psets do muro e do bloco (herdados do tipo)
    const pm = rel.psets.T1;
    expect(pm.AlRimo_Muro.AlturaDeSolo).toBeCloseTo(m.dims.H_solo / 1000, 6);
    expect(pm.AlRimo_Muro.AlturaDoMuro).toBeCloseTo(m.dims.H_muro / 1000, 6);
    expect(pm.AlRimo_Muro.Tipo).toBe('Balanço');
    expect(pm.Pset_WallCommon.LoadBearing).toBe(true);
    expect(pm.Qto_WallBaseQuantities.Length).toBeCloseTo(m.dims.L_real / 1000, 6);
    expect(pm.Qto_WallBaseQuantities.Height).toBeCloseTo(m.dims.H_muro / 1000, 6);
    const pb = rel.psets['T1.M.f00.p000'];
    expect(pb.AlRimo_Bloco.Familia).toBe('19x39');
    expect(pb.AlRimo_Bloco.AreaDoFuro).toBeCloseTo(Ag / 1e6, 8);
    expect(pb.AlRimo_Bloco.AreaLiquidaSobreBruta).toBeCloseTo(1 - (2 * Ag) / (LB * T), 6);   // 0,541 da tabela do curso
  }, 60000);

  it('completo: contraforte girado, barbacã em Y, estribo fechado, dois trechos', () => {
    const m = muroDeTeste({ contrafortes: true, drenagem: true, trechos: 2 });
    const rel = validar(exportarIfc(m, { ...INFO, drenagem: true }), '--regras', '--geom-tudo');
    expect(rel.erros).toEqual([]);
    expect(rel.ok).toBe(true);
    expect(rel.nomes.IfcWall).toEqual(['Muro T1', 'Muro T2', 'Contraforte C1', 'Contraforte C2', 'Contraforte C3', 'Contraforte C4']);
    expect(rel.nomes.IfcPipeSegment).toEqual(['Barbacã']);
    // bloco da haste: giro 90 — X na espessura, Y ao longo da haste
    const cf = rel.por_tag['T1.CF2.f03.p01'].caixa;
    const xc = m.dims.contrafortes.find((c) => c.trecho === 1 && c.x > 1000)!.x / 1000;
    expect(cf[0][0]).toBeCloseTo(xc - 0.095, 5);
    expect(cf[1][0]).toBeCloseTo(xc + 0.095, 5);
    expect(cf[0][1]).toBeCloseTo(0.2, 5);
    expect(cf[1][1]).toBeCloseTo(0.59, 5);
    expect(rel.por_tag['T1.CF2.f03.p01'].volume).toBeCloseTo(rel.por_tag['T1.M.f00.p000'].volume, 9);
    // barbacã: perfil em (x, z), extrusão em +Y pela espessura do muro, sem espelhar
    const bb = rel.por_tag['T1.BBC.1'].caixa;
    expect(bb[0][0]).toBeCloseTo(0.6, 5);
    expect(bb[0][1]).toBeCloseTo(0, 5);
    expect(bb[0][2]).toBeCloseTo(0.075, 5);
    expect(bb[1][1]).toBeCloseTo(0.19, 5);
    expect(rel.por_tag['T2.BBC.1'].caixa[0][0]).toBeCloseTo((m.dims.trechos[1].x0 + 600) / 1000, 5);
    // estribo: 4 arcos, fecha, comprimento certo
    const est = m.barras.find((b) => b.posicao === 'N7')!;
    expect(rel.barras[est.id].arcos).toBe(4);
    expect(rel.barras[est.id].comprimento * 1000).toBeCloseTo(est.comprimento, 2);
    // estribo de cantos vivos (como a modulação desenha hoje): fecha, sem arco, sólido monta
    const vivo = m.barras.find((b) => b.posicao === 'N8')!;
    expect(rel.barras[vivo.id].arcos).toBe(0);
    expect(rel.barras[vivo.id].comprimento * 1000).toBeCloseTo(vivo.comprimento - 140, 2);
    expect(rel.por_tag[vivo.id].volume).toBeGreaterThan(0);
    // a barra sabe de quem é (Elemento), sem estar agregada a ele
    expect(rel.psets[est.id].AlRimo_Barra.Elemento).toBe(`Contraforte C${est.contraforte}`);
    expect(rel.psets['T1.N4.0'].AlRimo_Barra.Elemento).toBe('Sapata corrida T1');
    expect(rel.psets.C1.AlRimo_Contraforte.Ponta).toBe(true);
    expect(rel.psets['T2.SAP'].Qto_FootingBaseQuantities.Width).toBeCloseTo(MEDIDAS.B / 1000, 6);
  }, 60000);

  it('com o Resultado da aula 12.2: materiais e Psets com os números da conta', () => {
    const r = resultadoDoGabarito('aula122');
    const rel = validar(exportarIfc(muroDeTeste(), { ...INFO, resultado: r }), '--geom');
    expect(rel.erros).toEqual([]);
    expect(rel.nomes.IfcMaterial).toEqual(expect.arrayContaining(['Bloco de concreto fbk 8 MPa', 'Graute fgk 20 MPa', 'Concreto C25', 'Aço CA-50']));
    const pm = rel.psets.T1;
    expect(pm.AlRimo_Muro.fbk).toBe(8);
    expect(pm.AlRimo_Muro.Graute).toBe('Parcial (seção I)');
    expect(pm.Pset_ReinforcementBarPitchOfWall.VerticalBarPitch).toBeCloseTo(0.4, 9);
    expect(pm.Pset_ReinforcementBarPitchOfWall.HorizontalBarPitch).toBeCloseTo(0.8, 9);
    expect(rel.psets['T1.GF.c000'].AlRimo_Graute.fgk).toBe(20);
  }, 60000);

  it('Resultado sem algum nome não derruba a exportação', () => {
    const vazio: Resultado = {
      v: (n: string): Valor => { throw new Error('nome inexistente: ' + n); },
      num: () => null, cel: () => null, alteracoes: {},
    };
    expect(conferirStep(exportarIfc(muroDeTeste(), { ...INFO, resultado: vazio })).erros).toEqual([]);
  });

  describe('mutações: cada defeito conhecido TEM de ser reprovado', () => {
    const base = exportarIfc(muroDeTeste(), INFO);

    it('m1 barra em SweptSolid → regra CorrectItemsForType', () => {
      const rel = validar(base.replaceAll("'AdvancedSweptSolid'", "'SweptSolid'"), '--regras');
      expect(rel.ok).toBe(false);
      expect(rel.validate_msgs.join(' ')).toMatch(/CorrectItemsForType/);
    }, 60000);

    it('m2 parte USERDEFINED sem ObjectType', () => {
      const p = primeiro(base, 'IFCBUILDINGELEMENTPART');
      const rel = validar(trocarArgs(base, p.id, (a) => { a[4] = '$'; return a; }), '--regras');
      expect(rel.ok).toBe(false);
      expect(rel.erros.join(' ')).toMatch(/sem ObjectType/);
    }, 60000);

    it('m3 GUID com 1º caractere fora de 0..3', () => {
      const p = primeiro(base, 'IFCPROJECT');
      const rel = validar(trocarArgs(base, p.id, (a) => { a[0] = "'$" + a[0].slice(2); return a; }));
      expect(rel.ok).toBe(false);
    }, 60000);

    it('m4 acento em UTF-8 cru: passa no esquema, mas o nome volta errado', () => {
      const p = primeiro(base, 'IFCPROJECT');
      const cru = trocarArgs(base, p.id, (a) => { a[2] = "'" + decodificar(a[2]) + "'"; return a; });
      expect(conferirStep(cru).erros.join(' ')).toMatch(/fora do ASCII/);
      const bytes = Buffer.from(cru, 'utf8').toString('latin1');   // grava UTF-8 de verdade no disco
      const rel = validar(bytes);
      expect(rel.nomes.IfcProject?.[0]).not.toBe(INFO.projeto);
    }, 60000);

    it('m5 bloco contido no pavimento E agregado ao muro', () => {
      const parte = primeiro(base, 'IFCBUILDINGELEMENTPART');
      const pav = primeiro(base, 'IFCBUILDINGSTOREY');
      const oh = primeiro(base, 'IFCOWNERHISTORY');
      const n = Math.max(...lerStep(base).entidades.keys()) + 1;
      const extra = `#${n}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid('mutacao5')}',#${oh.id},$,$,(#${parte.id}),#${pav.id});\n`;
      const rel = validar(base.replace('ENDSEC;\nEND-ISO', extra + 'ENDSEC;\nEND-ISO'));
      expect(rel.ok).toBe(false);
      expect(rel.erros.join(' ')).toMatch(/contido E agregado/);
    }, 60000);
  });
});


// Todos os cenários do gabarito (aulas, 40 sorteios, alvos de cobertura) passam pela modulação de verdade e pela
// conferência do texto — rápido, sem Python. Foi esta varredura que achou o s_adot = 0 do sorteio18/25.
const partesDoModelo = (m: Modelo) => Object.values(contaPorTipo(m)).reduce((s, n) => s + n, 0);
describe.skipIf(!Object.keys(modulacao).length)('exportarIfc — todos os cenários do gabarito (sem Python)', () => {
  it('nenhum erro de texto, nenhum aviso; toda peça e toda barra no arquivo', async () => {
    const gerar = (await modulacaoDeVerdade())!;
    const cenarios = cenariosDoGabarito();
    expect(cenarios.length).toBeGreaterThan(40);
    for (const c of cenarios) {
      const r = resultadoDoGabarito(c);
      const m = gerar(r);
      const g = gerarIfc(m, { ...INFO, projeto: c, resultado: r, drenagem: true });
      expect(conferirStep(g.texto).erros, c).toEqual([]);
      expect(g.avisos, c).toEqual([]);
      expect(g.contagem.IfcBuildingElementPart ?? 0, c).toBe(partesDoModelo(m));
      expect(g.contagem.IfcReinforcingBar ?? 0, c).toBe(m.barras.length);
    }
  }, 120000);

  // ALRIMO_IFC_VARREDURA=1: todos os cenários também pelo ifcopenshell (regras + geometria de amostra; ~2 min)
  it.skipIf(!temPython || !process.env.ALRIMO_IFC_VARREDURA)('todos os cenários pelo ifcopenshell', async () => {
    const gerar = (await modulacaoDeVerdade())!;
    const falhas: string[] = [];
    for (const c of cenariosDoGabarito()) {
      const r = resultadoDoGabarito(c);
      const rel = validar(exportarIfc(gerar(r), { ...INFO, projeto: c, resultado: r, drenagem: true }), '--regras', '--geom');
      if (!rel.ok) falhas.push(`${c}: ${rel.erros.join('; ')} ${(rel.validate_msgs ?? []).join(' ').slice(0, 300)}`);
    }
    expect(falhas).toEqual([]);
  }, 600000);
});

describe.skipIf(!temPython || !Object.keys(modulacao).length)('exportarIfc — com a modulação de verdade', () => {
  // aulas + um de cada família/tipo; sorteio18 tem s_adot = 0 (nenhum arranjo passou)
  for (const cenario of ['aula122', 'aula123', 'sorteio02', 'sorteio06', 'sorteio18']) {
    it(cenario, async () => {
      const r = resultadoDoGabarito(cenario);
      const m = (await modulacaoDeVerdade())!(r);
      const g = gerarIfc(m, { ...INFO, resultado: r });
      expect(conferirStep(g.texto).erros).toEqual([]);
      const rel = validar(g.texto, '--regras', '--geom');
      expect(rel.erros).toEqual([]);
      expect(rel.partes_por_tipo).toEqual(contaPorTipo(m));
      expect(Object.keys(rel.barras).length).toBe(m.barras.length);
      expect(g.avisos).toEqual([]);
      // Psets com os números da conta: o fpk de quem trabalha, o passo das barras (que some quando s_adot = 0)
      const pm = rel.psets.T1;
      const balanco = /^balan/i.test(String(r.v('Tipo_muro')));
      expect(pm.AlRimo_Muro.fpk).toBeCloseTo(r.num(balanco ? 'fpk_' : 'fpk_pn')!, 5);   // o arquivo grava 6 casas
      expect(pm.AlRimo_Muro.FamiliaDeBlocos).toBe(m.familia.nome);
      if (balanco) {
        const s = r.num('s_adot')!;
        if (s > 0) expect(pm.Pset_ReinforcementBarPitchOfWall.VerticalBarPitch).toBeCloseTo(s / 100, 9);
        else expect(pm.Pset_ReinforcementBarPitchOfWall?.VerticalBarPitch).toBeUndefined();
      } else {
        const c1 = rel.psets.C1.AlRimo_Contraforte;
        expect(c1.fpk).toBeCloseTo(r.num('fpk_cf')!, 5);
        expect(c1.EncaixeProvisorio ?? false).toBe(!!m.familia.provisoria);   // família 14: encaixe provisório
      }
    }, 120000);
  }
});

// A orientação das peças novas dos gabaritos do Revit (09/10): o 34 e o 54 têm furos de tamanhos diferentes, a ponta
// direita é a esquerda girada 180°, a haste gira 90° (enterrada) ou 270° (aparente), a canaleta da haste deita em Y.
// Caixa e volume certos não provam que o furo está do lado certo — o graute no vazio do bloco dono prova.
describe.skipIf(!temPython || !Object.keys(modulacao).length)('exportarIfc — peça a peça no lugar (modulação de verdade)', () => {
  const carregar = async () => {
    const mod = (await Object.values(modulacao)[0]()) as {
      gerarModelo: (r: Resultado, extras: Record<string, Valor>) => Modelo;
      padroesDoModelo: () => Record<string, Valor>;
      caixaGlobal: (p: Modelo['pecas'][number], g: Modelo['geometrias'][string]) => { min: number[]; max: number[] };
    };
    return mod;
  };

  // aula123: 14x39 enterrado com 34 e 54; sorteio11: 14x39 aparente (haste a 270°) com 34
  for (const cenario of ['aula123', 'sorteio11']) {
    it(`${cenario}: caixa e volume de cada peça = Modelo; graute no vazio do bloco; canaleta aberta para cima`, async () => {
      const mod = await carregar();
      const r = resultadoDoGabarito(cenario);
      const m = mod.gerarModelo(r, mod.padroesDoModelo());
      const rel = validar(exportarIfc(m, { ...INFO, resultado: r }), '--geom-tudo', '--furos');
      expect(rel.erros).toEqual([]);
      let n = 0;
      for (const p of m.pecas) {
        if (p.grupo === 'terreno' || p.grupo === 'drenagem') continue;
        const g = m.geometrias[p.geometria];
        const lida = rel.por_tag[p.id];
        expect(lida, p.id).toBeTruthy();
        const c = mod.caixaGlobal(p, g);
        for (let k = 0; k < 3; k++) {
          expect(lida.caixa[0][k] * 1000, `${p.id} min ${k}`).toBeCloseTo(c.min[k], 1);
          expect(lida.caixa[1][k] * 1000, `${p.id} max ${k}`).toBeCloseTo(c.max[k], 1);
        }
        expect(lida.volume * 1e9 / g.volume_mm3, p.id).toBeCloseTo(1, 4);
        n++;
      }
      const graute = m.pecas.filter((p) => p.tipo === 'GRAUTE_FURO').length;
      const canaletas = m.pecas.filter((p) => ['CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA'].includes(p.tipo)).length;
      expect(rel.furos).toEqual({ graute, canaletas });
      expect(n).toBeGreaterThan(300);
    }, 120000);
  }

  it('mutação: o 34 da ponta direita sem o giro de 180° (mesma caixa) — o validador TEM de achar o graute na parede', async () => {
    const mod = await carregar();
    const r = resultadoDoGabarito('aula123');
    const m = mod.gerarModelo(r, mod.padroesDoModelo());
    // o 34 da ponta direita (girado 180°) com os dois furos grauteados: desvirado, o furo de 14,0 cm cai no septo
    const p = m.pecas.find((x) => x.grupo === 'muro' && x.giro === 180 && m.geometrias[x.geometria].classe === 'bloco34' && m.pecas.some((g) => g.id === x.id + '.g2'))!;
    expect(p).toBeTruthy();
    p.giro = 0;
    const rel = validar(exportarIfc(m, INFO), '--furos');
    expect(rel.ok).toBe(false);
    expect(rel.erros.join(' ')).toContain(`cai na parede do bloco ${p.id}`);
  }, 120000);
});
