/*
  A PROVA DA VISTA "ESFORÇOS" (2ª versão, 15/11: o aço necessário em vermelho e o colocado em verde envolvendo, como
  o Pró-Viga) — o que ela não pode fazer: escrever na tela um número que não é o da planilha, desenhar um necessário
  na seção crítica diferente do da aba, mostrar o verde envolvendo onde a aba reprova (ou o contrário) sem razão
  conhecida, desenhar peça que o muro não tem, ou esquecer peça que ele tem. Roda em todos os cenários do gabarito do
  Excel (dados/golden/), com o muro montado pela modulação.

  As diferenças MODELO × PLANILHA no aço colocado não são escondidas: cada uma tem de cair numa das razões conhecidas
  (listadas no teste e no PLANO_OBRA, etapa 1b) — uma nova é achado, e o teste para.
*/
import { describe, expect, it } from 'vitest';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { valorEm } from './acoColocado';
import { barrasAnaliticas } from './barrasAnaliticas';
import type { BarraAnalitica, Diagrama } from './tipos';

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
const diagramas = (b: BarraAnalitica): Diagrama[] => [b.flexao, b.cortante].filter((d): d is Diagrama => !!d);

describe('barras analíticas — o aço necessário e o colocado', () => {
  it('todo cenário com muro tem barra, e nenhum número é NaN ou infinito, nos dois modos', () => {
    const ruins: string[] = [];
    let comMuro = 0;
    let comCortante = 0;
    for (const c of casos) {
      if (!c.m) continue;
      comMuro++;
      if (!c.barras.length) ruins.push(`${c.cenario}: sem barra`);
      for (const b of c.barras) {
        const L = Math.hypot(b.ate[0] - b.de[0], b.ate[1] - b.de[1], b.ate[2] - b.de[2]);
        if (!(L > 0)) ruins.push(`${c.cenario} ${b.id}: barra sem comprimento`);
        if (Math.abs(Math.hypot(...b.lado) - 1) > 1e-9) ruins.push(`${c.cenario} ${b.id}: lado não unitário`);
        if (!b.flexao) ruins.push(`${c.cenario} ${b.id}: sem diagrama de flexão`);
        if (b.cortante) comCortante++;
        for (const d of diagramas(b)) {
          for (const f of d.faces) {
            const nums = [...f.necessario, ...f.colocado].flatMap((p) => [p.s, p.v]).concat(f.familias.flatMap((x) => [x.s0, x.s1, x.v]), f.naoResiste.flat(), f.minimo ?? 0);
            if (!nums.every(Number.isFinite)) ruins.push(`${c.cenario} ${b.id}: número não finito`);
            if ([...f.necessario, ...f.colocado].some((p) => p.v < 0 || p.s < -1e-6 || p.s > L + 1e-6)) ruins.push(`${c.cenario} ${b.id}: ponto fora da barra ou negativo`);
          }
          if (!d.picos.every((p) => Number.isFinite(p.valor) && Number.isFinite(p.s))) ruins.push(`${c.cenario} ${b.id}: pico não finito`);
        }
      }
    }
    expect(ruins).toEqual([]);
    expect(comMuro).toBeGreaterThan(60);
    expect(comCortante).toBeGreaterThan(500);
  });

  it('cada número da planilha escrito na tela é a célula (na unidade da tela)', () => {
    const difs: string[] = [];
    let conferidos = 0;
    for (const c of casos) {
      for (const b of c.barras) {
        for (const d of diagramas(b)) {
          for (const p of d.picos) {
            if (!p.nome && !p.celula) continue;
            const v = p.celula ? c.r.cel(p.celula) : c.r.num(p.nome!);
            if (typeof v !== 'number') {
              difs.push(`${c.cenario} ${b.id}: ${p.nome ?? p.celula} sem número`);
              continue;
            }
            conferidos++;
            if (!perto(p.valor, Math.abs(v * p.fator)) && !(p.qual === 'nec' && v < 0 && p.valor === 0)) difs.push(`${c.cenario} ${b.id}: ${p.nome} ${p.valor} × ${v * p.fator}`);
          }
        }
      }
    }
    expect(difs).toEqual([]);
    expect(conferidos).toBeGreaterThan(1500);
  });

  it('na seção crítica o necessário ao longo da peça é o da aba, bit a bit (perf_As = As_nec, T_As = As_ts…)', () => {
    const difs: string[] = [];
    let n = 0;
    for (const c of casos) {
      for (const b of c.barras) {
        for (const d of diagramas(b)) {
          for (const p of d.picos) {
            // o nó do intervalo (celula) e o nome da aba na seção crítica (nome): o MESMO número
            if (!p.celula || !p.nome || p.qual !== 'nec') continue;
            const a = c.r.cel(p.celula);
            const e = c.r.v(p.nome);
            n++;
            if (a !== e) difs.push(`${c.cenario} ${b.id}: ${p.celula} = ${String(a)} × ${p.nome} = ${String(e)}`);
          }
        }
      }
    }
    expect(difs).toEqual([]);
    expect(n).toBeGreaterThan(300);
  });

  it('o aço colocado na seção crítica é o As efetivo da planilha — ou cai numa razão conhecida', () => {
    const conta: Record<string, { iguais: number; razoes: Record<string, number> }> = {};
    const novas: string[] = [];
    for (const c of casos) {
      if (!c.m) continue;
      const avisos = new Set(c.m.avisos.map((a) => a.codigo));
      for (const b of c.barras) {
        const col = b.flexao?.picos.find((p) => p.qual === 'col' && p.planilha);
        if (!col) continue;
        const v = c.r.num(col.planilha!);
        const k = (conta[b.tipo] ??= { iguais: 0, razoes: {} });
        if (v !== null && Math.abs(v - col.valor) <= 0.005 + 1e-6 * v) {
          k.iguais++;
          continue;
        }
        const nec = b.flexao!.picos.find((p) => p.qual === 'nec');
        const ve = v ?? 0;
        let razao: string | null = null;
        // o modelo desvia o estribo do dente das barras da sapata e põe mais que L/s (CLAUDE.md, dente armado)
        if (b.tipo === 'dente' && col.valor > ve) razao = 'dente: estribos a mais no modelo';
        if (b.tipo === 'dente' && col.valor === 0 && avisos.has('DENTE_ESTREITO')) razao = 'dente estreito: o modelo não arma';
        // barras do contraforte em mais de um furo / que não cabem: parte delas fica na outra metade da seção
        if (b.tipo === 'contraforte' && col.valor < ve && (avisos.has('BARRAS_EM_MAIS_FUROS') || avisos.has('BARRAS_NAO_CABEM'))) razao = 'contraforte: barras fora do furo da conta';
        // pilarete cuja barra não desce no arrimo (PILARETE_LIGACAO): na base não há aço ancorado
        if (b.tipo === 'pilarete' && col.valor < ve && avisos.has('PILARETE_LIGACAO')) razao = 'pilarete: barra não desce no arrimo';
        if (b.tipo === 'ponta' || b.tipo === 'talao') {
          const comp = (c.r.num(b.tipo === 'ponta' ? 'toe' : 'heel') ?? 0) * 1000;
          const lbg = (c.r.num('lbg_s') ?? 0) * 10;
          // a barra não alcança a face com a ancoragem inteira (balanço mais curto que a dobra + ℓb), ou o muro fica
          // fora da sapata (sorteio com o eixo do muro além da largura: a planilha conta o talão a partir do muro)
          if (comp < lbg + 100) razao = 'sapata: balanço curto para ancorar na face';
          else if (c.m.dims.sapata.y0 > 1 || c.m.dims.sapata.y1 < c.m.familia.t - 1) razao = 'sapata: o muro fora da sapata';
        }
        if (razao) k.razoes[razao] = (k.razoes[razao] ?? 0) + 1;
        else novas.push(`${c.cenario} ${b.id}: desenho ${col.valor.toFixed(3)} × ${col.planilha} ${String(v)} (nec ${nec?.valor.toFixed(3)})`);
      }
    }
    console.info('[esforços] aço colocado × planilha na seção crítica:\n' + Object.entries(conta).map(([t, x]) => `  ${t}: ${x.iguais} iguais; ${JSON.stringify(x.razoes)}`).join('\n'));
    expect(novas).toEqual([]);
    // o balanço não tem razão para divergir: a faixa sai sempre igual
    expect(Object.keys(conta['balanco']?.razoes ?? {})).toEqual([]);
    expect(conta['balanco']!.iguais).toBeGreaterThan(30);
  });

  it('o verde envolve o vermelho ⇔ a aba diz que o aço resiste (balanço, contraforte, ponta, dente, pilarete)', () => {
    const difs: Record<string, string[]> = {};
    let n = 0;
    for (const c of casos) {
      const { r } = c;
      const num = (k: string) => r.num(k);
      const ge = (a: string, b: string) => num(a) !== null && num(b) !== null && (num(a) as number) >= (num(b) as number) - 0.005;
      const conf = (tipo: string, b: BarraAnalitica | undefined, abaPassa: boolean, md: string) => {
        if (!b?.flexao || (num(md) ?? 0) <= 0) return;
        n++;
        if (b.flexao.envolve !== abaPassa) (difs[tipo] ??= []).push(`${c.cenario} ${b.id}: desenho ${b.flexao.envolve ? 'envolve' : 'não envolve'}, aba ${abaPassa ? 'resiste' : 'não resiste'}`);
      };
      conf('balanco', doTipo(c, 'balanco')[0], ok(r, 'chk_resiste') && ge('As_ef', 'As_nec'), 'Md_');
      const inter = String(r.v('tipo_cf')).startsWith('Inter');
      const desteTipo = doTipo(c, 'contraforte').find((b) => b.nome.includes('extremidade') !== inter);
      conf('contraforte', desteTipo, ok(r, 'chk_res_cf') && ge('As_cfe', 'As_cfn'), 'Md_cf');
      conf('ponta', doTipo(c, 'ponta')[0], num('x_ts') !== null && ge('Ase_s', 'As_ts'), 'Md_ts');
      if (r.v('tem_den') === 'Sim') conf('dente', doTipo(c, 'dente')[0], num('xln_den') !== null && ge('Ase_den', 'As_den'), 'Md_den');
      if (r.v('mc_on') === 'Sim') conf('pilarete', doTipo(c, 'pilarete')[0], typeof r.v('Asn_pil') === 'number' && (num('As_pile') ?? 0) >= (num(String(r.v('pil_tipo')).startsWith('Conc') ? 'Asc_pil' : 'Asb_pil') ?? Infinity) - 0.005, 'Md_pil');
    }
    // As diferenças são as do teste de cima (o modelo arma diferente da planilha) e as das rampas: onde o aço ainda
    // está ancorando (topo da espera de traspasse mais curto, ponta da sapata) e a conta pede. Listadas, não escondidas.
    for (const [k, l] of Object.entries(difs)) console.info(`[esforços] envolve × aba, ${k}: ${l.length}\n  ${l.join('\n  ')}`);
    expect(n).toBeGreaterThan(150);
    // o balanço tem de bater sempre: o modelo é o da conta (barra a cada s, espera com o ℓ0t)
    expect(difs['balanco'] ?? []).toEqual([]);
    expect(difs['contraforte'] ?? []).toEqual([]);
    // as poucas que sobram são as razões do teste de cima (ponta curta, dente estreito, pilarete sem barra no arrimo)
    expect(Object.values(difs).flat().length).toBeLessThan(10);
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
    for (const [k, v] of Object.entries(cobertura)) expect(v, k).toBeGreaterThan(0);
  });

  it('cortante: contraforte com Asw/s × estribos do modelo; sem estribo pela conta, nenhum estribo desenhado', () => {
    const difs: string[] = [];
    let n = 0;
    let n4 = 0;
    for (const c of casos) {
      for (const b of doTipo(c, 'contraforte')) {
        const d = b.cortante!;
        expect(d.unidade).toBe('cm²/m');
        const f = d.faces[0];
        if (!f) continue;
        n++;
        // contraforte dobrado (16/11): estribo sempre, c/20 (s_est_u) — o colocado é o Asw/s do tipo DELE: deste tipo
        // Asw_e; do outro tipo, quando um dos dois é o dobrado, Asw_eo (seção 18)
        const inter = String(c.r.v('tipo_cf')).startsWith('Inter');
        const desteTipo = b.nome.includes('extremidade') !== inter;
        const outroDiferente = c.r.num('dob_cf') === 1 || c.r.num('dob_o') === 1;
        const asw = desteTipo || !outroDiferente ? 'Asw_e' : 'Asw_eo';
        const ehDobrado = (desteTipo && c.r.num('dob_cf') === 1) || (!desteTipo && c.r.num('dob_o') === 1);
        const dispensa = !ehDobrado && (c.r.num(asw) ?? 0) === 0;
        if (dispensa && f.colocado.some((p) => p.v > 0)) difs.push(`${c.cenario} ${b.id}: estribo desenhado com a conta dispensando`);
        if (ehDobrado && !f.colocado.some((p) => p.v > 0)) difs.push(`${c.cenario} ${b.id}: dobrado sem estribo`);
        // com estribo: entre o 1º e o último, o colocado é o Asw/s da planilha quando o modelo segue o s da conta
        // 2 ramos = um estribo; 4 = dois estribos menores na mesma junta (só quando cabem: a planilha conta os ramos
        // que cabem, ram_ef, e o modelo desenha esses) — o colocado bate com o Asw,ef nos dois casos
        if (!dispensa && f.colocado.length) {
          if (c.r.num('ram_ef') === 4) n4++;
          const meio = valorEm(f.colocado, (f.colocado[1]!.s + f.colocado[2]!.s) / 2);
          const sEst = ehDobrado ? 20 : (c.r.num('s_est_u') ?? c.r.num('s_est'))!;
          if (Math.abs(sEst / 20 - Math.round(sEst / 20)) < 1e-9 && Math.abs(meio - c.r.num(asw)!) > 0.01) difs.push(`${c.cenario} ${b.id}: Asw/s ${meio} × ${asw} ${c.r.num(asw)}`);
        }
      }
    }
    expect(difs).toEqual([]);
    expect(n).toBeGreaterThan(20);
    expect(n4).toBeGreaterThan(0);   // há muros do gabarito com 4 ramos que cabem (bloco 19)
  });

  it('peça sem verificação de cortante não desenha nada no modo Cortante', () => {
    for (const c of casos) for (const b of c.barras) if (['painelVertical', 'canaleta', 'cinta', 'naoArmado', 'painelMc'].includes(b.tipo)) expect(b.cortante, b.id).toBeNull();
  });

  it('sem conta ou sem muro, nada', () => {
    expect(barrasAnaliticas(null, null)).toEqual([]);
    const c = casos.find((x) => x.m)!;
    expect(barrasAnaliticas(c.r, null)).toEqual([]);
    expect(barrasAnaliticas(null, c.m)).toEqual([]);
  });
});
