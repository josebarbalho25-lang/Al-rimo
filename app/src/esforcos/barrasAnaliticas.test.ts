/*
  A PROVA DA VISTA "ESFORÇOS" — o que ela não pode fazer: escrever na tela um número que não é o da planilha, mostrar
  uma barra verde que a memória reprova (ou o contrário), desenhar peça que o muro não tem, ou esquecer peça que ele
  tem. Roda em todos os cenários do gabarito do Excel (dados/golden/), com o muro montado pela modulação.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { barrasAnaliticas } from './barrasAnaliticas';
import type { BarraAnalitica } from './tipos';

interface Caso { cenario: string; r: Resultado; m: Modelo | null; barras: BarraAnalitica[] }

const casos: Caso[] = cenariosDoGabarito().map((cenario) => {
  const r = resultadoDoGabarito(cenario);
  let m: Modelo | null = null;
  try {
    m = gerarModelo(r, { ...padroesDoModelo(), L_total: 6 });
  } catch {
    m = null; // muro sem dado (os cenários "vazio"): a vista fica vazia, como as outras
  }
  return { cenario, r, m, barras: barrasAnaliticas(r, m) };
});

const perto = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const ok = (r: Resultado, nome: string) => String(r.v(nome)).startsWith('OK');
const contra = (r: Resultado) => String(r.v('Tipo_muro')).startsWith('Contra');
const doTipo = (c: Caso, t: BarraAnalitica['tipo']) => c.barras.filter((b) => b.tipo === t);

describe('barras analíticas', () => {
  it('todo cenário com muro tem barra, e nenhum número é NaN ou infinito', () => {
    const ruins: string[] = [];
    let comMuro = 0;
    for (const c of casos) {
      if (!c.m) continue;
      comMuro++;
      if (!c.barras.length) ruins.push(`${c.cenario}: sem barra`);
      for (const b of c.barras) {
        const nums = [...b.de, ...b.ate, ...b.lado, ...b.estacoes.flatMap((e) => [e.s, e.msd, e.mrd ?? 0, e.mrdOposto ?? 0]), ...b.picos.flatMap((p) => [p.s, p.valor])];
        if (!nums.every(Number.isFinite)) ruins.push(`${c.cenario} ${b.id}: número não finito`);
        if (b.estacoes.length < 2) ruins.push(`${c.cenario} ${b.id}: menos de duas estações`);
        const L = Math.hypot(b.ate[0] - b.de[0], b.ate[1] - b.de[1], b.ate[2] - b.de[2]);
        if (!(L > 0)) ruins.push(`${c.cenario} ${b.id}: barra sem comprimento`);
        if (b.estacoes.some((e) => e.s < -1e-6 || e.s > L + 1e-6)) ruins.push(`${c.cenario} ${b.id}: estação fora da barra`);
        if (Math.abs(Math.hypot(...b.lado) - 1) > 1e-9) ruins.push(`${c.cenario} ${b.id}: lado não unitário`);
      }
    }
    expect(ruins).toEqual([]);
    expect(comMuro).toBeGreaterThan(60);
  });

  it('cada número escrito na tela é a célula da planilha (na unidade da tela)', () => {
    const difs: string[] = [];
    let conferidos = 0;
    for (const c of casos) {
      for (const b of c.barras) {
        for (const p of b.picos) {
          const v = p.celula ? c.r.cel(p.celula) : c.r.num(p.nome);
          if (typeof v !== 'number') {
            difs.push(`${c.cenario} ${b.id}: ${p.nome} sem número`);
            continue;
          }
          conferidos++;
          if (!perto(Math.abs(p.valor), Math.abs(v * p.fator))) difs.push(`${c.cenario} ${b.id}: ${p.nome} ${p.valor} × ${v * p.fator}`);
          // o pico está numa estação do desenho (o número fica em cima da curva, não solto)
          if (p.qual === 'msd' && !b.estacoes.some((e) => Math.abs(e.s - p.s) < 1e-6 && perto(e.msd, p.valor))) difs.push(`${c.cenario} ${b.id}: ${p.nome} fora da curva`);
        }
      }
    }
    expect(difs).toEqual([]);
    expect(conferidos).toBeGreaterThan(1000);
  });

  it('na base / na face o diagrama é o momento de cálculo da aba', () => {
    const difs: string[] = [];
    let n = 0;
    const conf = (c: Caso, b: BarraAnalitica, nome: string) => {
      const esperado = c.r.num(nome);
      if (esperado === null) return;
      n++;
      const e0 = b.estacoes[0]!;
      if (e0.s !== 0 || !perto(e0.msd, esperado)) difs.push(`${c.cenario} ${b.id}: base ${e0.msd} × ${nome} ${esperado}`);
    };
    for (const c of casos) {
      const inter = String(c.r.v('tipo_cf')).startsWith('Inter');
      for (const b of c.barras) {
        if (b.tipo === 'balanco') conf(c, b, 'Md_');
        if (b.tipo === 'contraforte') conf(c, b, b.nome.includes('extremidade') === !inter ? 'Md_cf' : 'Md_cfo');
        if (b.tipo === 'dente') conf(c, b, 'Md_den');
        if (b.tipo === 'pilarete') conf(c, b, 'Md_pil');
        // a seção 7 da aba Fundação usa máx(0; Md): com Md negativo na face a aba tem 0
        if (b.tipo === 'ponta' && (c.r.num('Md_ts') ?? 0) > 0) conf(c, b, 'Md_ts');
        if (b.tipo === 'talao' && (c.r.num('Md_hs') ?? 0) > 0) conf(c, b, 'Md_hs');
      }
    }
    expect(difs).toEqual([]);
    expect(n).toBeGreaterThan(200);
  });

  it('a barra passa ⇔ aproveitamento ≤ 1, e o MRd da tela cobre o MSd da tela onde passa', () => {
    const difs: string[] = [];
    for (const c of casos) {
      for (const b of c.barras) {
        if (b.aproveitamento === null) {
          if (b.passa !== null) difs.push(`${c.cenario} ${b.id}: veredito sem aproveitamento`);
          continue;
        }
        if (b.passa !== b.aproveitamento <= 1) difs.push(`${c.cenario} ${b.id}: passa ${b.passa} com ${b.aproveitamento}`);
      }
    }
    expect(difs).toEqual([]);
  });

  it('o veredito da barra é o das verificações de resistência da memória', () => {
    // MRd ≥ MSd ⇔ a seção resiste, x/d e As,ef ≥ As do momento (o As,mín é verificação à parte) — esforcos.test.ts
    const difs: string[] = [];
    let n = 0;
    for (const c of casos) {
      const { r } = c;
      const num = (k: string) => r.num(k);
      const ge = (a: string, b: string, tol: number) => num(a) !== null && num(b) !== null && (num(a) as number) >= (num(b) as number) - tol;
      const conf = (b: BarraAnalitica | undefined, verif: boolean, msd: string) => {
        if (!b || b.passa === null || (num(msd) ?? 0) <= 0) return;
        n++;
        if (b.passa !== verif) difs.push(`${c.cenario} ${b.id}: barra ${b.passa ? 'passa' : 'não passa'}, verificações ${verif}`);
      };
      conf(doTipo(c, 'balanco')[0], ok(r, 'chk_resiste') && ok(r, 'chk_ductil') && ge('As_ef', 'As_nec', 0.005), 'Md_');
      const inter = String(r.v('tipo_cf')).startsWith('Inter');
      const desteTipo = doTipo(c, 'contraforte').find((b) => b.nome.includes('extremidade') !== inter);
      conf(desteTipo, ok(r, 'chk_res_cf') && ok(r, 'chk_duc_cf') && ge('As_cfe', 'As_cfn', 0.005), 'Md_cf');
      conf(doTipo(c, 'ponta')[0], num('x_ts') !== null && ge('Ase_s', 'As_ts', 0.005), 'Md_ts');
      if (r.v('tem_den') === 'Sim') conf(doTipo(c, 'dente')[0], num('xln_den') !== null && (num('xd_den') as number) <= 0.45 && ge('Ase_den', 'As_den', 0.005), 'Md_den');
    }
    expect(difs).toEqual([]);
    expect(n).toBeGreaterThan(80);
  });

  it('veredito com nome da aba × barra (informativo: as verificações da aba incluem As,mín e ductilidade)', () => {
    // Não reprova: a barra diz MSd ≤ MRd; o chk_* da aba diz tudo o que a aba confere naquela peça. A diferença é
    // listada para o relatório — esconder seria pior.
    const PARES: [BarraAnalitica['tipo'], string][] = [
      ['painelVertical', 'chk_pvs'], ['canaleta', 'chk_ph'], ['ponta', 'chk_fl_s'], ['dente', 'chk_fl_den'], ['balanco', 'chk_resiste'], ['contraforte', 'chk_res_cf'],
    ];
    const difs: Record<string, string[]> = {};
    for (const c of casos) {
      for (const [tipo, chk] of PARES) {
        const inter = String(c.r.v('tipo_cf')).startsWith('Inter');
        // o chk_res_cf é do contraforte que a aba dimensiona (tipo_cf), não do outro
        const b = tipo === 'contraforte' ? doTipo(c, tipo).find((x) => x.nome.includes('extremidade') !== inter) : doTipo(c, tipo)[0];
        if (!b || b.passa === null) continue;
        const v = String(c.r.v(chk));
        if (v.startsWith('—') || v === '' || v === 'null') continue;
        if (b.passa !== v.startsWith('OK')) (difs[chk] ??= []).push(`${c.cenario}: barra ${b.passa ? 'passa' : 'não passa'} (${(b.aproveitamento ?? 0).toFixed(3)}), ${chk} = ${v}`);
      }
    }
    for (const [k, l] of Object.entries(difs)) console.info(`[esforços] ${k}: ${l.length} diferença(s)\n  ${l.join('\n  ')}`);
    expect(Object.keys(difs).length).toBeGreaterThanOrEqual(0);
  });

  it('uma barra para cada peça que o muro tem — e nada para a que ele não tem', () => {
    const difs: string[] = [];
    const cobertura = { balanco: 0, contrafortes: 0, dente: 0, semDente: 0, mc: 0, semMc: 0 };
    for (const c of casos) {
      if (!c.m) continue;
      const { r, m } = c;
      const nTrechos = m.dims.trechos.length;
      const conta = (t: BarraAnalitica['tipo']) => doTipo(c, t).length;
      const dif = (o: string, a: number, e: number) => a !== e && difs.push(`${c.cenario}: ${o} ${a} × ${e}`);
      if (contra(r)) {
        cobertura.contrafortes++;
        dif('contrafortes', conta('contraforte'), m.dims.contrafortes.length);
        const vaos = m.dims.trechos.reduce((s, _t, i) => s + Math.max(0, m.dims.contrafortes.filter((k) => k.trecho === i + 1).length - 1), 0);
        dif('faixas do painel', conta('painelVertical'), vaos);
        // canaletas: em cada vão, uma barra por fiada de canaleta da parede (a de cima é a cinta)
        const fiadas = (k: number) => new Set(m.pecas.filter((p) => p.grupo === 'muro' && p.trecho === k && /CANALETA/.test(p.tipo)).map((p) => p.fiada)).size;
        const esperadas = m.dims.trechos.reduce((s, _t, i) => s + Math.max(0, m.dims.contrafortes.filter((k) => k.trecho === i + 1).length - 1) * fiadas(i + 1), 0);
        dif('canaletas + cinta', conta('canaleta') + conta('cinta'), esperadas);
        dif('cinta', conta('cinta'), vaos);
        dif('balanço', conta('balanco'), 0);
      } else {
        cobertura.balanco++;
        dif('faixa do balanço', conta('balanco'), nTrechos);
        for (const t of ['contraforte', 'painelVertical', 'canaleta', 'cinta'] as const) dif(t, conta(t), 0);
      }
      // dente sem conta (dado do solo da base faltando): a planilha não tem o Md, a vista não inventa
      const temDente = r.v('tem_den') === 'Sim' && r.num('Md_den') !== null;
      if (temDente) cobertura.dente++;
      else cobertura.semDente++;
      dif('dente', conta('dente'), temDente ? nTrechos : 0);
      dif('ponta', conta('ponta'), (r.num('toe') ?? 0) > 0 ? nTrechos : 0);
      dif('talão', conta('talao'), (r.num('heel') ?? 0) > 0 ? nTrechos : 0);
      const mc = r.v('mc_on') === 'Sim' && m.dims.muroDeCima;
      if (mc) cobertura.mc++;
      else cobertura.semMc++;
      dif('pilaretes', conta('pilarete'), mc ? m.dims.muroDeCima!.pilaretes.length : 0);
      if (!mc) dif('painéis do muro de cima', conta('painelMc'), 0);
    }
    expect(difs).toEqual([]);
    // a prova só vale se o gabarito cobre os dois tipos de muro, com e sem dente, com e sem muro de cima
    for (const [k, v] of Object.entries(cobertura)) expect(v, k).toBeGreaterThan(0);
  });

  it('sem conta ou sem muro, nada', () => {
    expect(barrasAnaliticas(null, null)).toEqual([]);
    const c = casos.find((x) => x.m)!;
    expect(barrasAnaliticas(c.r, null)).toEqual([]);
    expect(barrasAnaliticas(null, c.m)).toEqual([]);
  });
});
