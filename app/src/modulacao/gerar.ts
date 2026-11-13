/*
  O GERADOR: entradas + conta → o muro peça a peça (Modelo).

  Ordem: lê a conta → modula (regra única, modular.ts) → arruma as fiadas (fiadas.ts, com os encaixes da tabela)
  → põe as barras procurando o furo de verdade de cada fiada (armaduras.ts + cavidades.ts; nas fiadas de canaleta,
  a corrida reta do balanço ou o U de cada vão entre contrafortes) → grauteia (furo com barra sempre; a parede na grade do
  graute a cada X — 20 = todos; contraforte: sempre todos) → fura o fundo da canaleta onde a barra sobe e quebra a
  parede dela no encontro com o contraforte, com o graute no lugar (canaletas.ts) → sapata, drenagem e terreno
  (entorno.ts).

  Tudo em mm, X ao longo do muro, Y = 0 na face aparente e +Y para o solo, Z = 0 no topo da sapata (contrato em
  modelo/tipos.ts). Determinístico: a mesma entrada dá o mesmo JSON (sem Map/Set na saída, sem relógio).
*/
import type { Resultado, Valor } from '@/motor/tipos';
import type { Aviso, Modelo, Peca, TipoPeca } from '@/modelo/tipos';
import { H_FIADA, JUNTA, pecaDoCatalogo } from './catalogo';
import { ENCAIXES } from './encaixes';
import { lerParametros } from './leitura';
import { br, modular, type TrechoModulado } from './modular';
import { fiadasDeCanaleta, montarFiadas, tiposDasFiadas, type FiadaMontada } from './fiadas';
import { MapaDeCavidades, type Cavidade } from './cavidades';
import { arred, caixaGlobal, prisma, retanguloArredondado } from './perfis';
import { numerarPosicoes } from './barras';
import { fmt, furosDaPeca, geoBloco, geoCanaleta, geoGrauteCanaleta, pad, secaoCanaleta, zTopoBarra, type Ctx } from './contexto';
import { barrasDoBalanco, barrasDoPainel, barrasDosContrafortes, esperas, horizontais, type Vertical } from './armaduras';
import { conferenciasGerais, drenagem, sapata, temDente, terreno } from './entorno';
import { furarEQuebrarCanaletas } from './canaletas';
import { leitorDoMuroDeCima, lerMuroDeCima, muroDeCima, pilaretesDoTrecho } from './muroDeCima';

// 5: canaleta furada onde sobe a barra, T de graute no contraforte, graute da haste corrido (09/10 noite)
export const VERSAO_MODULACAO = 'modulacao 5';
export { ESPESSURA_MANTA, COB_GRAUTE } from './contexto';

export function gerarModelo(r: Resultado, extras: Record<string, Valor> = {}): Modelo {
  const avisos: Aviso[] = [];
  const p = lerParametros(r, extras, avisos);
  const mod = modular(p, avisos);
  const ctx: Ctx = { p, mod, geos: {}, pecas: [], barras: [], avisos };

  if (p.contrafortes) {
    const enc = ENCAIXES[mod.cat.nome];
    if (enc.provisoria) avisos.push({ codigo: 'ENCAIXE_PROVISORIO', texto: enc.aviso ?? `Encaixe do contraforte em bloco ${mod.cat.nome} provisório` });
    // contraforte mais comprido que os gabaritos do Jose: a haste sai da mesma regra, mas não foi modelada por ele
    if (enc.hastesDoGabarito.length && !enc.hastesDoGabarito.includes(mod.n_haste)) {
      const cms = enc.hastesDoGabarito.map((n) => br((mod.cat.t + n * mod.m) / 10, 0)).join(', ').replace(/, ([^,]*)$/, ' e $1');
      avisos.push({ codigo: 'HASTE_SEM_GABARITO', texto: `Contraforte de ${br(mod.tenr / 10, 0)} cm em bloco ${mod.cat.nome}: haste além dos modelos do Revit (${cms} cm)` });
    }
  }

  const canaleta = fiadasDeCanaleta(mod.n_fiadas, mod.s_can, p.cinta);
  const tipos = tiposDasFiadas(canaleta, ENCAIXES[mod.cat.nome].primeira);
  const Ype = mod.cat.t / 2 + p.a_ater - p.B_sap;
  const mc = lerMuroDeCima(ctx, leitorDoMuroDeCima(ctx, r));
  const YbA = mod.cat.t / 2 + p.a_ater;

  for (const tr of mod.trechos) {
    const fiadas = montarFiadas(tr, { ...mod, aparente: !p.enterrado }, tipos);
    const mapa = new MapaDeCavidades(mod.n_fiadas);
    const inicioAlvenaria = ctx.pecas.length;
    alvenaria(ctx, tr, fiadas, mapa);
    mapa.ordenar();

    const verticais: Vertical[] = [];
    if (p.contrafortes) {
      barrasDoPainel(ctx, tr, mapa, verticais);
      barrasDosContrafortes(ctx, tr, mapa, verticais);
    } else {
      barrasDoBalanco(ctx, tr, mapa, verticais);
    }
    esperas(ctx, tr, mapa, verticais, Ype, YbA);
    horizontais(ctx, tr, fiadas, canaleta);
    graute(ctx, tr, fiadas, mapa, verticais, inicioAlvenaria);
    // depois de TODAS as barras do trecho que sobem pelo muro (verticais e esperas) e do graute das canaletas
    furarEQuebrarCanaletas(ctx, tr, canaleta, mapa, inicioAlvenaria);
    sapata(ctx, tr, Ype, YbA);
    drenagem(ctx, tr, mapa);
    terreno(ctx, tr, Ype, YbA);
    if (mc) muroDeCima(ctx, tr, mc, p.lbphi_c, p.a0t);
  }

  conferenciasGerais(ctx, Ype, YbA);

  const dims: Modelo['dims'] = {
    L_real: mod.L_real,
    H_solo: Math.round(p.H_solo),
    H_muro: mod.H_des,
    n_fiadas: mod.n_fiadas,
    trechos: mod.trechos.map((t) => ({ x0: t.x0, x1: t.x1 })),
    contrafortes: mod.trechos.flatMap((t) => t.nos.map((n) => ({ x: n.xc, trecho: t.indice, ponta: n.tipo !== 'T' }))),
    sapata: { y0: arred(Ype), y1: arred(YbA), z0: -(p.h_sap + (temDente(p) ? p.h_den : 0)), z1: 0 },
  };
  if (mc) dims.muroDeCima = { z0: mod.H_des, z1: mod.H_des + mc.H, t: mc.tijolo.perfil.t, pilaretes: mod.trechos.flatMap((t) => pilaretesDoTrecho(t, p.contrafortes, mc)) };

  // a canaleta furada/quebrada troca de geometria depois de nascer inteira: a inteira que ninguém mais usa sai (quem
  // lê o Modelo percorre as geometrias — o IFC não pode ganhar tipo sem peça, nem o 3D molde sem uso)
  const usadas = new Set(ctx.pecas.map((q) => q.geometria));
  const geometrias = Object.fromEntries(Object.entries(ctx.geos).filter(([k]) => usadas.has(k)));

  const modelo: Modelo = {
    versao: VERSAO_MODULACAO,
    familia: mod.familia,
    geometrias,
    pecas: ctx.pecas,
    barras: numerarPosicoes(ctx.barras),
    ajustes: mod.ajustes,
    avisos: juntarAvisos(avisos),
    dims,
  };
  modelo.extras = { ...p.extras };
  return modelo;
}

/** O mesmo aviso de vários trechos vira um só, com os ids somados (a tela mostra uma linha por problema). */
function juntarAvisos(av: Aviso[]): Aviso[] {
  const out: Aviso[] = [];
  const idx = new Map<string, Aviso>();
  for (const a of av) {
    const k = a.codigo + '|' + a.texto;
    const ja = idx.get(k);
    if (ja) {
      if (a.ids?.length) ja.ids = [...(ja.ids ?? []), ...a.ids];
    } else {
      const novo: Aviso = { codigo: a.codigo, texto: a.texto };
      if (a.ids?.length) novo.ids = [...a.ids];
      idx.set(k, novo);
      out.push(novo);
    }
  }
  return out;
}

// ── alvenaria ────────────────────────────────────────────────────────────────

function alvenaria(ctx: Ctx, tr: TrechoModulado, fiadas: FiadaMontada[], mapa: MapaDeCavidades): void {
  const { mod, pecas } = ctx;
  const { cat } = mod;
  const t = cat.t;
  const wc = t - 2 * cat.canaleta.parede;     // miolo da canaleta
  const enterrado = ctx.p.enterrado;
  const T = `T${tr.indice}`;

  for (const f of fiadas) {
    const z0 = f.i * H_FIADA + JUNTA;
    let k = 0;
    // Canaletas seguidas são um canal só (o U não tem fundo nas pontas e o graute corre direto pela junta): a
    // cavidade é a corrida inteira, senão a barra que cai numa junta de canaleta — e com a canaleta deslocada 1/4 de
    // bloco as juntas caem justo no meio da célula, onde passa a barra — pareceria fora do graute.
    let corrida: { x0: number; x1: number; ip: number } | null = null;
    const fechaCorrida = (): void => {
      if (corrida) mapa.add(f.i, { tipo: 'canaleta', cx: (corrida.x0 + corrida.x1) / 2, cy: t / 2, a: (corrida.x1 - corrida.x0) / 2, b: wc / 2, r: 0, peca: corrida.ip, furo: -1, grauteada: true });
      corrida = null;
    };
    for (const it of f.linha) {
      const pc = pecaDoCatalogo(cat, it.chave);
      const id = `${T}.M.f${pad(f.i, 2)}.p${pad(++k, 3)}`;
      const canal = pc.forma === 'canaleta';
      // a peça da ponta direita é a da esquerda girada 180° (o 34 cobre o nó e depois a célula)
      const peca: Peca = {
        id, tipo: pc.tipo, grupo: 'muro', geometria: canal ? geoCanaleta(ctx, pc) : geoBloco(ctx, pc),
        origem: [arred(it.x), 0, z0], giro: it.espelhado ? 180 : 0, trecho: tr.indice, fiada: f.i,
      };
      if (it.no) peca.contraforte = it.no.cf;
      const ip = pecas.push(peca) - 1;
      if (canal) {
        if (corrida && it.x - corrida.x1 <= JUNTA + 1e-6) corrida.x1 = it.x + it.comp;
        else {
          fechaCorrida();
          corrida = { x0: it.x, x1: it.x + it.comp, ip };
        }
      } else {
        fechaCorrida();
        furosDaPeca(mod, pc).forEach((h, j) => {
          const cx = it.espelhado ? it.x + it.comp - h.c : it.x + h.c;
          mapa.add(f.i, { tipo: 'furo', cx, cy: t / 2, a: h.l / 2, b: h.w / 2, r: h.r, peca: ip, furo: j, grauteada: false });
        });
      }
    }
    fechaCorrida();
    tr.nos.forEach((no, kn) => {
      let q = 0;
      // na haste, a mesma coisa: canaletas seguidas ao longo de η são um canal só
      const canalDaHaste: { y0: number; y1: number; ip: number }[] = [];
      for (const h of f.hastes[kn]) {
        const pc = pecaDoCatalogo(cat, h.chave);
        const canal = pc.forma === 'canaleta';
        const y0 = enterrado ? h.eta : t - h.eta - h.comp;
        const id = `${T}.CF${no.cf}.f${pad(f.i, 2)}.p${pad(++q, 2)}`;
        const peca: Peca = {
          id, tipo: pc.tipo, grupo: 'contraforte', geometria: canal ? geoCanaleta(ctx, pc) : geoBloco(ctx, pc),
          // 90°: o comprimento da peça vai para +Y, com a ponta local x = 0 na face do muro (η = 0) — é o que põe o
          // furo quadrado do 34 dentro do muro; 270° na haste aparente, que cresce para −Y
          origem: [arred(no.xc - t / 2), arred(y0), z0], giro: enterrado ? 90 : 270,
          trecho: tr.indice, fiada: f.i, contraforte: no.cf,
        };
        const ip = pecas.push(peca) - 1;
        if (canal) {
          // canaleta deitada ao longo da haste (fiada de canaleta): o miolo inteiro é graute
          const c = canalDaHaste[0];
          if (c) [c.y0, c.y1] = [Math.min(c.y0, y0), Math.max(c.y1, y0 + h.comp)];
          else canalDaHaste.push({ y0, y1: y0 + h.comp, ip });
          continue;
        }
        furosDaPeca(mod, pc).forEach((fu, j) => {
          const eta = h.eta + fu.c;
          // contraforte: todos os furos da haste e da passante grauteados (brief §5.6; Vrd2 com fpk* na conta)
          mapa.add(f.i, { tipo: 'furo', cx: no.xc, cy: enterrado ? eta : t - eta, a: fu.w / 2, b: fu.l / 2, r: fu.r, peca: ip, furo: j, grauteada: true });
        });
      }
      for (const c of canalDaHaste) {
        mapa.add(f.i, { tipo: 'canaleta', cx: no.xc, cy: (c.y0 + c.y1) / 2, a: wc / 2, b: (c.y1 - c.y0) / 2, r: 0, peca: c.ip, furo: -1, grauteada: true });
      }
    });
  }
}

// ── graute ───────────────────────────────────────────────────────────────────

/*
  GRADE DO GRAUTE DA PAREDE (Jose, 13/10: "graute a cada X"). Furo da parede é grauteado se fica a um múltiplo de X
  da barra MAIS PRÓXIMA (de qualquer lado): as barras caem na grade (a lista do espaçamento só oferece múltiplos de
  X), então entre duas barras a grade é a mesma vista de uma ou da outra. A mais próxima, e não a da esquerda, porque
  o painel recomeça depois de cada contraforte e as barras das pontas (a última do balanço, a do lado do contraforte)
  ficam fora do passo s: cada trecho segue a barra dele. A distância vai em furos: round(Δx/m) — os furos ficam a 195 e 205 mm alternados (bloco de 390
  + junta de 10), e a soma de dois dá 400 exatos, então o arredondamento nunca acumula. Só furo da PAREDE (y entre as
  faces); o contraforte é sempre todo grauteado por conta própria. É a mesma fração m/X do peso da conta.
*/
function grauteDaGrade(fiada: readonly Cavidade[], xsDasBarras: readonly number[], passo: number, t: number, m: number): void {
  const furos = fiada.filter((c) => c.tipo === 'furo' && c.cy > 0 && c.cy < t);
  if (!furos.length) return;
  const ref = (x: number): number => {
    if (!xsDasBarras.length) return furos[0].cx;
    let r = xsDasBarras[0];
    for (const xb of xsDasBarras) if (Math.abs(xb - x) < Math.abs(r - x)) r = xb;
    return r;
  };
  for (const c of furos) {
    const k = Math.round(Math.abs(c.cx - ref(c.cx)) / m);
    if (k % passo === 0) c.grauteada = true;
  }
}

function graute(ctx: Ctx, tr: TrechoModulado, fiadas: FiadaMontada[], mapa: MapaDeCavidades, vs: Vertical[], ini: number): void {
  const { mod, p, pecas } = ctx;
  const t = mod.cat.t;
  for (const v of vs) mapa.marcar(v.x, v.y, 0, zTopoBarra(ctx));
  // grade do graute da parede (graute a cada X, Jose 13/10): contada a partir das barras da parede, que caem nela
  const xsDasBarras = [...new Set(vs.filter((v) => v.y > 0 && v.y < t).map((v) => v.x))].sort((a, b) => a - b);
  const passo = Math.max(1, Math.round(p.s_graute / mod.m));
  for (let i = 0; i < mapa.nFiadas; i++) {
    // o furo do muro na célula do contraforte também leva graute (brief §5.6)
    for (const no of tr.nos) {
      const a = mapa.achar(i, no.xc, t / 2);
      if (a && a.cav.tipo === 'furo') a.cav.grauteada = true;
    }
    if (p.grauteTotal) for (const c of mapa.fiada(i)) c.grauteada = true;
    else grauteDaGrade(mapa.fiada(i), xsDasBarras, passo, t, mod.m);
  }

  const porPeca = new Map<number, Cavidade[]>();
  for (let i = 0; i < mapa.nFiadas; i++) {
    for (const c of mapa.fiada(i)) {
      if (c.tipo !== 'furo' || !c.grauteada) continue;
      const l = porPeca.get(c.peca) ?? [];
      l.push(c);
      porPeca.set(c.peca, l);
    }
  }
  const fim = pecas.length;
  const daHaste = new Map<string, Peca[]>();
  for (let ip = ini; ip < fim; ip++) {
    const host = pecas[ip];
    // canaleta deitada na haste (fiada de canaleta): o graute vai por corrida, logo abaixo
    if (host.grupo === 'contraforte' && ctx.geos[host.geometria]?.eixo === 'X') {
      const k = `${host.contraforte}|${host.fiada}`;
      (daHaste.get(k) ?? daHaste.set(k, []).get(k)!).push(host);
      continue;
    }
    const cavs = porPeca.get(ip);
    if (!cavs) continue;
    cavs.sort((u, v) => u.furo - v.furo);
    host.furosGrauteados = cavs.map((c) => c.furo);
    const fi = host.fiada ?? 0;
    for (const c of cavs) {
      const deitado = host.giro === 90 || host.giro === 270;
      const l = deitado ? 2 * c.b : 2 * c.a;
      const w = deitado ? 2 * c.a : 2 * c.b;
      // graute do furo: bloco + junta de baixo (200), para a coluna fechar sem fresta entre fiadas
      const chave = `graute furo ${fmt(l)}x${fmt(w)} r${fmt(c.r)} h${H_FIADA}`;
      if (!ctx.geos[chave]) ctx.geos[chave] = prisma(chave, 'Z', retanguloArredondado(l, w, c.r), H_FIADA);
      const g: Peca = {
        id: `${host.id}.g${c.furo + 1}`, tipo: 'GRAUTE_FURO', grupo: host.grupo, geometria: chave,
        origem: [arred(c.cx - c.a), arred(c.cy - c.b), fi * H_FIADA], giro: host.giro === 180 ? 0 : host.giro, trecho: tr.indice, fiada: fi,
      };
      if (host.contraforte !== undefined) g.contraforte = host.contraforte;
      pecas.push(g);
    }
  }

  // Canaletas da haste: um prisma por corrida da MESMA seção, com o miolo dela, cobrindo as juntas de 10 mm entre
  // elas (antes era um por peça e as juntas ficavam sem graute — revisão do IFC, 09/10 noite). A regra é a do muro,
  // logo abaixo: onde a seção muda (a cortada da 19 tem fundo mais grosso), a junta fica com a corrida de antes —
  // aqui, a mais perto do muro. A junta muro × haste é do graute do T (canaletas.ts).
  const sg = p.enterrado ? 1 : -1;     // η cresce para +Y no enterrado e para −Y no aparente
  for (const lista of daHaste.values()) {
    const it = lista.map((host) => {
      const c = caixaGlobal(host, ctx.geos[host.geometria]);
      return { host, a: sg > 0 ? c.min[1] : -c.max[1], b: sg > 0 ? c.max[1] : -c.min[1], x0: c.min[0], z0: c.min[2] };
    }).sort((u, v) => u.a - v.a);
    let k = 0;
    while (k < it.length) {
      const ini0 = it[k];
      const secao = secaoCanaleta(mod, ini0.host);
      let j = k;
      while (j + 1 < it.length && it[j + 1].a - it[j].b <= JUNTA + 1e-6 && secaoCanaleta(mod, it[j + 1].host).propria === secao.propria) j++;
      // a junta com a corrida seguinte (seção diferente) vai com esta
      const prox = it[j + 1];
      const b = prox && prox.a - it[j].b <= JUNTA + 1e-6 ? prox.a : it[j].b;
      const comp = b - ini0.a;
      const host = ini0.host;
      const g: Peca = {
        id: `${host.id}.gc`, tipo: 'GRAUTE_CANALETA', grupo: 'contraforte', geometria: geoGrauteCanaleta(ctx, comp, host),
        origem: [arred(ini0.x0 + secao.parede), arred(sg > 0 ? ini0.a : -b), arred(ini0.z0 + secao.fundo)], giro: host.giro, trecho: tr.indice, fiada: host.fiada,
      };
      if (host.contraforte !== undefined) g.contraforte = host.contraforte;
      pecas.push(g);
      k = j + 1;
    }
  }

  // canaleta: um prisma de graute por corrida contínua de canaletas da MESMA seção (inclui as juntas verticais), com
  // o miolo dela (o vazio do U — o graute do quantitativo sai daqui). Onde a seção muda (a cortada da 19 tem fundo
  // mais grosso), o prisma fecha no começo da peça seguinte: a junta entre as duas fica com o prisma de antes.
  for (const f of fiadas) {
    let ini0: number | null = null;
    let fimC = 0;
    let secao: { tipo: TipoPeca } | null = null;
    let k = 0;
    const fecha = (ate = fimC): void => {
      if (ini0 === null || !secao) return;
      const s = secaoCanaleta(mod, secao);
      pecas.push({
        id: `T${tr.indice}.GC.f${pad(f.i, 2)}.${++k}`, tipo: 'GRAUTE_CANALETA', grupo: 'muro', geometria: geoGrauteCanaleta(ctx, ate - ini0, secao),
        origem: [arred(ini0), arred(s.parede), arred(f.i * H_FIADA + JUNTA + s.fundo)], giro: 0, trecho: tr.indice, fiada: f.i,
      });
      ini0 = null;
    };
    for (const it of f.linha) {
      const pc = pecaDoCatalogo(mod.cat, it.chave);
      if (pc.forma !== 'canaleta') {
        fecha();
        continue;
      }
      const seguida = ini0 !== null && it.x - fimC <= JUNTA + 1e-6;
      if (seguida && secaoCanaleta(mod, pc).propria === secaoCanaleta(mod, secao!).propria) {
        fimC = it.x + it.comp;
        continue;
      }
      fecha(seguida ? it.x : fimC);
      ini0 = it.x;
      fimC = it.x + it.comp;
      secao = { tipo: pc.tipo };
    }
    fecha();
  }
}
