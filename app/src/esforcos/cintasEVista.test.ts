/*
  A VISTA ESFORÇOS (15/11, segunda volta e o aço da 2ª versão): as cintas do muro de cima (duas barras por vão —
  lateral e gravidade — com o As e o cortante das células), o fantasma com o dente e o muro de cima, o reenquadrar quando o muro muda de forma
  e os números que não se encobrem.
*/
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Modelo } from '@/modelo/tipos';
import { gerarModelo, padroesDoModelo } from '@/modulacao';
import { cenariosDoGabarito, resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { barrasAnaliticas } from './barrasAnaliticas';
import { CORES_DO_PAPEL, caixasDoMuro, chaveDoEnquadramento, montarCenaDosEsforcos, sapatasDoMuro } from './cenaDosEsforcos';
import { GRUPOS, GRUPO_DO_TIPO, ehGrupo, filtrarPorGrupo, gruposPresentes, lerGrupos, type BarraAnalitica } from './tipos';

const montar = (c: string): Modelo => gerarModelo(resultadoDoGabarito(c), { ...padroesDoModelo(), L_total: 6 });

describe('cintas do muro de cima na vista Esforços', () => {
  const comCinta = cenariosDoGabarito().filter((c) => {
    const r = resultadoDoGabarito(c);
    return r.v('mc_on') === 'Sim' && r.v('cin_mc') !== 'Nenhuma';
  });

  it('o gabarito tem cintas', () => expect(comCinta.length).toBeGreaterThanOrEqual(6));

  for (const c of comCinta) {
    it(`${c}: lateral e gravidade em cada vão de cada cinta, com o Md e o MRd da planilha`, () => {
      const r = resultadoDoGabarito(c);
      const m = montar(c);
      const bs = barrasAnaliticas(r, m).filter((b) => b.tipo === 'cintaMc');
      const mc = m.dims.muroDeCima!;
      const vaos = m.dims.trechos.reduce((s, tr) => s + Math.max(0, mc.pilaretes.filter((x) => x >= tr.x0 - 1 && x <= tr.x1 + 1).length - 1), 0);
      const vento = (r.num('p_w') ?? 0) > 0;
      expect(bs.length).toBe((mc.cintas ?? []).length * vaos * (vento ? 2 : 1));
      for (const b of bs) {
        const k = b.id.includes('.CMT.') ? 'T' : 'M';
        const lat = b.id.endsWith('.L');
        const md = r.num(lat ? `Mdl_c${k}` : `Mdg_c${k}`)!;
        const mrd = r.num(lat ? 'MRdl_cmc' : 'MRdg_cmc')!;
        // o clique: MSd e MRd da planilha
        expect(b.leitura.msd).toBeCloseTo(Math.abs(md), 12);
        expect(b.leitura.mrd).toBeCloseTo(mrd, 12);
        // o aço: necessário (As do momento) por dentro, o efetivo envolvendo, o mínimo da cinta
        const nec = r.num(lat ? `Aslc_c${k}` : `Asgc_c${k}`);
        if (nec !== null) expect(b.flexao!.picos.find((p) => p.qual === 'nec')!.valor).toBeCloseTo(nec, 12);
        expect(b.flexao!.picos.find((p) => p.qual === 'col')!.valor).toBeCloseTo(r.num(lat ? 'Asl_cmc' : 'Asg_cmc')!, 12);
        expect(b.flexao!.faces[0]!.minimo).toBe(r.num('Asm_cmc'));
        expect(b.flexao!.esquematico).toBe(true);
        // o cortante: Vd × VRd1 da cinta
        expect(b.cortante!.picos.find((p) => p.qual === 'col')!.valor).toBeCloseTo(r.num(lat ? 'VR1l_cmc' : 'VR1g_cmc')!, 12);
        // lateral deitada (tracionando a face de fora), gravidade em pé (tracionando embaixo)
        expect(b.lado).toEqual(lat ? [0, -1, 0] : [0, 0, -1]);
        // o uso é a interação das duas (a pior), e a barra passa ⇔ a interação ≤ 1
        expect(b.aproveitamento).toBeCloseTo(r.num(`ap_c${k}`)!, 12);
        expect(b.passa).toBe(r.num(`ap_c${k}`)! <= 1);
        expect(b.card).toBe('murocima.cintas');
        // a cinta fica no z dela, entre dois pilaretes
        const zc = (mc.cintas ?? []).find((q) => (q.qual === 'topo') === (k === 'T'))!.z;
        expect(b.de[2]).toBe(zc);
        expect(b.ate[2]).toBe(zc);
      }
    });
  }
});

describe('fantasma do muro', () => {
  it('a sapata com dente vai pela seção (com o dente), não pela caixa cheia', () => {
    const c = cenariosDoGabarito().find((x) => resultadoDoGabarito(x).v('tem_den') === 'Sim')!;
    const m = montar(c);
    const sp = sapatasDoMuro(m);
    expect(sp.length).toBe(m.dims.trechos.length);
    // a seção com dente tem mais de 4 vértices (o degrau do dente)
    expect(Math.max(...sp.map((s) => s.contorno.length))).toBeGreaterThan(4);
    expect(caixasDoMuro(m).some((cx) => cx.min[2] < -1)).toBe(false);
  });

  it('com muro de cima, o fantasma tem o muro de cima, os pilaretes e as cintas', () => {
    const m = montar('alvo_cmc_duas');
    const cx = caixasDoMuro(m);
    expect(cx.some((c) => c.max[2] >= m.dims.muroDeCima!.z1 - 1)).toBe(true);
    expect(m.pecas.some((p) => p.tipo === 'CINTA_MC')).toBe(true);
  });
});

describe('a vista acompanha o muro', () => {
  it('trocar balanço por contrafortes muda as barras e a chave do enquadramento; mudar só um número não', () => {
    const bal = montar('aula122');
    const cf = montar('aula123');
    const rb = resultadoDoGabarito('aula122');
    const rc = resultadoDoGabarito('aula123');
    const idsB = barrasAnaliticas(rb, bal).map((b) => b.id);
    const idsC = barrasAnaliticas(rc, cf).map((b) => b.id);
    expect(idsB).toContain('T1.BAL');
    expect(idsC.some((id) => id.startsWith('CF'))).toBe(true);
    expect(idsC).not.toContain('T1.BAL');
    expect(chaveDoEnquadramento(bal)).not.toBe(chaveDoEnquadramento(cf));
    // o mesmo muro montado de novo: a mesma chave (a câmera não pula)
    expect(chaveDoEnquadramento(montar('aula122'))).toBe(chaveDoEnquadramento(bal));
  });
});

describe('os números não se encobrem', () => {
  // duas barras lado a lado (10 cm): com a letra grande os dois números cairiam um em cima do outro
  const barra = (id: string, ap: number, x: number): BarraAnalitica => ({
    id, tipo: 'naoArmado', grupo: 'paineis', nome: id, card: 'x', trecho: 1, de: [x, 0, 0], ate: [x, 0, 1000], lado: [0, -1, 0],
    flexao: {
      unidade: 'kN·m/m', esquematico: true, envolve: true, fimLivre: 0,
      faces: [{ face: 1, necessario: [{ s: 0, v: 0 }, { s: 500, v: 0.5 }, { s: 1000, v: 0 }], naoResiste: [], colocado: [{ s: 0, v: 1 }, { s: 1000, v: 1 }], familias: [], minimo: null }],
      picos: [{ s: 500, valor: 0.5, qual: 'nec', face: 1, nome: 'x', fator: 1 }],
    },
    cortante: null,
    leitura: { msd: 0.5, mrd: 1, unidade: 'kN·m/m', nomes: [], asNec: null, asEf: null },
    aproveitamento: ap, nomesDoAproveitamento: [], passa: true,
  });
  const m = montar('aula122');
  const cena = montarCenaDosEsforcos([barra('A', 0.3, 0), barra('B', 0.9, 100)], m, { modo: 'flexao', escala: 'valor', valores: true, muro: false, cores: CORES_DO_PAPEL });
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, -100, 100);
  camera.position.set(0, -10, 0.5);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0.5);
  const sprites = () => {
    const out: THREE.Sprite[] = [];
    cena.grupo.traverse((o) => { if (o instanceof THREE.Sprite) out.push(o); });
    return out;
  };
  const visivel = (id: string) => sprites().find((s) => s.userData.barra === id)!.visible;

  it('fica o de maior aproveitamento', () => {
    cena.arrumarRotulos(camera, 800, 800, 0.05, []);
    expect(visivel('B')).toBe(true);
    expect(visivel('A')).toBe(false);
  });

  it('a barra do mouse (ou a escolhida) passa para a frente', () => {
    cena.arrumarRotulos(camera, 800, 800, 0.05, [null, 'A']);
    expect(visivel('A')).toBe(true);
    expect(visivel('B')).toBe(false);
  });

  it('longe um do outro, os dois aparecem', () => {
    cena.arrumarRotulos(camera, 800, 800, 0.01, []);
    expect(visivel('A') && visivel('B')).toBe(true);
  });
});

describe('o MRd da cinta é a conta do As desfeita (planilha, ida e volta)', () => {
  const comCinta = cenariosDoGabarito().filter((c) => resultadoDoGabarito(c).v('mc_on') === 'Sim' && resultadoDoGabarito(c).v('cin_mc') !== 'Nenhuma');
  for (const c of comCinta) {
    it(c, () => {
      const r = resultadoDoGabarito(c);
      const n = (k: string) => r.num(k)!;
      const fcd = n('fcd_cmc'), fyd = n('fyd_cmc');
      for (const [b, d, As, MRd, xas, xlim] of [
        [n('hc_cmc'), n('dl_cmc'), n('Asl_cmc'), n('MRdl_cmc'), n('xas_cml'), n('xlim_cml')],
        [n('tc_cmc'), n('dg_cmc'), n('Asg_cmc'), n('MRdg_cmc'), n('xas_cmg'), n('xlim_cmg')],
      ]) {
        // com Md = MRd, a conta de As da aba (bloco 0,8x, 0,85fcd) devolve o As adotado — ou menos, no limite do x
        const x = 1.25 * d * (1 - Math.sqrt(1 - (MRd * 100) / (0.425 * b * d * d * (fcd / 10))));
        const AsDaConta = (MRd * 100) / ((fyd / 10) * (d - 0.4 * x));
        if (xas <= xlim) expect(AsDaConta).toBeCloseTo(As, 9);
        else expect(AsDaConta).toBeLessThanOrEqual(As + 1e-9);
      }
      // a barra passa (Md ≤ MRd nas duas) ⇔ a seção resiste, x/d ≤ 0,45 e As,ef ≥ As do momento, em cada direção
      for (const k of ['T', 'M'] as const) {
        if (r.v(`on_c${k}`) !== 'Sim') continue;
        for (const [md, mrd, x, xd, Asc, Asef] of [
          ['Mdl', 'MRdl_cmc', 'xl', 'xdl', 'Aslc', 'Asl_cmc'], ['Mdg', 'MRdg_cmc', 'xg', 'xdg', 'Asgc', 'Asg_cmc'],
        ] as const) {
          const resiste = r.num(`${x}_c${k}`) !== null && n(`${xd}_c${k}`) <= 0.45 && n(Asef) >= n(`${Asc}_c${k}`) - 1e-9;
          expect(n(`${md}_c${k}`) <= n(mrd) + 1e-9, `${k} ${md}`).toBe(resiste);
        }
      }
    });
  }
});

describe('o Mostrar por grupo de peça', () => {
  const todas = cenariosDoGabarito().flatMap((c) => {
    try {
      return barrasAnaliticas(resultadoDoGabarito(c), montar(c));
    } catch {
      return [];
    }
  });

  it('toda barra tem grupo, e é o do tipo dela', () => {
    expect(todas.length).toBeGreaterThan(1000);
    for (const b of todas) {
      expect(ehGrupo(b.grupo), b.id).toBe(true);
      expect(b.grupo, b.id).toBe(GRUPO_DO_TIPO[b.tipo]);
    }
    // o gabarito passa por todos os grupos do menu
    expect(new Set(todas.map((b) => b.grupo))).toEqual(new Set(GRUPOS.map((g) => g.id)));
  });

  it('o muro de cima em três grupos: painéis, cintas, pilaretes (com a ligação)', () => {
    const bs = barrasAnaliticas(resultadoDoGabarito('alvo_cmc_duas'), montar('alvo_cmc_duas'));
    const g = gruposPresentes(bs);
    expect(g).toEqual(expect.arrayContaining(['mcPaineis', 'mcCintas', 'mcPilaretes']));
    expect(bs.filter((b) => b.tipo === 'ligacao').every((b) => b.grupo === 'mcPilaretes')).toBe(true);
    expect(GRUPOS.find((x) => x.id === 'mcCintas')!.rotulo).toBe('Muro de cima: cintas');
    // sem muro de cima, nenhum dos três aparece no Mostrar
    const sem = gruposPresentes(barrasAnaliticas(resultadoDoGabarito('aula122'), montar('aula122')));
    expect(sem.some((x) => x.startsWith('mc'))).toBe(false);
  });

  it('o "Muro de cima" desligado de antes vira os três desligados; o que não é grupo some', () => {
    expect(lerGrupos(['muroDeCima', 'sapata', 'xx', 'sapata'])).toEqual(['sapata', 'mcPaineis', 'mcCintas', 'mcPilaretes']);
    expect(lerGrupos(undefined)).toEqual([]);
  });

  it('desligar um grupo tira exatamente as barras dele; isolar deixa só as dele', () => {
    for (const c of ['aula122', 'aula123', 'alvo_cmc_duas', 'alvo_mc_cf_duas']) {
      const bs = barrasAnaliticas(resultadoDoGabarito(c), montar(c));
      const presentes = gruposPresentes(bs);
      expect(presentes.length).toBeGreaterThan(1);
      for (const g of presentes) {
        const sem = filtrarPorGrupo(bs, [g]);
        expect(sem.map((b) => b.id)).toEqual(bs.filter((b) => b.grupo !== g).map((b) => b.id));
        const so = filtrarPorGrupo(bs, presentes.filter((x) => x !== g));
        expect(so.length).toBeGreaterThan(0);
        expect(so.every((b) => b.grupo === g)).toBe(true);
        expect(so.length).toBe(bs.filter((b) => b.grupo === g).length);
      }
      expect(filtrarPorGrupo(bs, [])).toEqual(bs);
      expect(filtrarPorGrupo(bs, presentes)).toEqual([]);
    }
  });
});

describe('os esforços não vão para a prancha (Jose, 15/11: "nunca vi um projeto com um diagrama em prancha")', () => {
  it('o item dos esforços de um projeto de antes não se lê: sai da folha e entra no recado de abertura', async () => {
    const { lerConteudo, lerPranchas } = await import('@/pranchas/padrao');
    const camera = { posicao: [1, 1, 1], alvo: [0, 0, 0], cima: [0, 0, 1], zoom: 40 };
    const velho = { tipo: 'esforcos', camera, proporcao: 1.5, escala: 'valor', valores: true, muro: true, ocultos: ['paineis'] };
    expect(lerConteudo(velho)).toBeNull();
    const perdidos: string[] = [];
    const p = lerPranchas({
      folhas: [{ id: 'f1', nome: 'Folha', formato: 'A3', orientacao: 'paisagem', itens: [
        { id: 'i1', conteudo: velho, escala: null, x: 30, y: 30, largura: 120, altura: 80, titulo: '', numero: 1 },
        { id: 'i2', conteudo: { tipo: 'detalhe', id: 'det01' }, escala: null, x: 30, y: 150, titulo: '', numero: 2 },
      ] }],
    }, perdidos);
    expect(perdidos).toEqual(['prancha: esforcos']);
    expect(p.folhas[0]!.itens.map((i) => i.conteudo.tipo)).toEqual(['detalhe']);
  });
});

describe('a cena desenha o par necessário × colocado, nos dois modos', () => {
  const cores = (cena: ReturnType<typeof montarCenaDosEsforcos>) => {
    const cs = new Set<string>();
    cena.grupo.traverse((o) => {
      if (o instanceof THREE.Mesh) cs.add(`#${(o.material as THREE.MeshBasicMaterial).color.getHexString()}`);
    });
    return cs;
  };
  for (const c of ['aula122', 'aula123', 'alvo_cmc_duas']) {
    for (const modo of ['flexao', 'cortante'] as const) {
      it(`${c} · ${modo}: verde (colocado) e vermelho (necessário) com as cores do papel`, () => {
        const bs = barrasAnaliticas(resultadoDoGabarito(c), montar(c));
        const cena = montarCenaDosEsforcos(bs, montar(c), { modo, escala: 'aproveitamento', valores: true, muro: true, cores: CORES_DO_PAPEL });
        const cs = cores(cena);
        expect(cs.has(CORES_DO_PAPEL.colocado)).toBe(true);
        expect(cs.has(CORES_DO_PAPEL.necessario)).toBe(true);
        // a escala só existe na barra escolhida
        const antes = cena.grupo.children.length;
        cena.destacar(null, bs[0]!.id);
        let escalas = 0;
        cena.grupo.traverse((o) => { if (o.userData.escala) escalas++; });
        expect(escalas).toBeGreaterThan(0);
        expect(cena.grupo.children.length).toBe(antes);
        cena.dispose();
      });
    }
  }
});
