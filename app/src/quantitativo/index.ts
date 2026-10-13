/*
  QUANTITATIVO — o que comprar para levantar o muro que o Modelo descreve.

  Puro: lê o Modelo (peças, geometrias, barras) e soma. Não modula nem recalcula nada; se o 3D e o IFC mostram
  uma peça, ela entra aqui do mesmo jeito, porque todos leem a mesma lista.

  Quantidades LÍQUIDAS: sem índice de perda (quebra de bloco, sobra de argamassa, ponta de barra). A perda é
  escolha de quem orça — fica para o Jose decidir se entra aqui ou fica na planilha de orçamento dele.

  As peças de terreno (aterro, solo da frente) existem só para ver no 3D e ficam fora.
*/
import type { ClassePeca, Modelo, Peca, TipoPeca, Geometria } from '@/modelo/tipos';
import type { Valor } from '@/motor/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { areaDaFolha, areaDoLaco, areaLiquida, caixaDaPeca, eixoGlobal, recortarAcimaDe, type Caixa } from './geometria';
import { ALVENARIA, medirArgamassa } from './argamassa';
import { listaDeFerros, resumoDoAco, type PosicaoDeFerro, type ResumoPorBitola } from './aco';

export { MASSA_NOMINAL_NBR7480, massaLinear, ROTULO_DO_PAPEL, rotuloDaBarra, type PosicaoDeFerro, type ResumoPorBitola } from './aco';
export { tabelasDoQuantitativo, csvDoQuantitativo, formatarNaTela, formatarNoCsv, type Tabela, type Celula } from './tabelas';
export { figuraDaPeca, arquivoDaPeca, FIGURAS_DAS_PECAS, type FiguraDaPeca } from './pecas';

export interface LinhaDeBloco {
  tipo: TipoPeca;
  rotulo: string;             // 'Bloco inteiro'
  catalogo: string;           // '14x19x39', 'canaleta 19x19x39'...
  quantidade: number;         // un
  classe?: ClassePeca;        // cor do Jose por tipo; acha a figura da peça (pecas.ts)
}

export interface Quantitativo {
  muro: {
    familia: string;
    comprimento: number;      // m
    alturaMuro: number;       // m
    alturaSolo: number;       // m
    fiadas: number;
    contrafortes: number;
    trechos: number;
  };
  blocos: LinhaDeBloco[];
  totalBlocos: number;        // un
  graute: { furos: number; canaletas: number; total: number };          // m³
  argamassa: { horizontal: number; vertical: number; total: number };   // m³
  ferros: PosicaoDeFerro[];
  resumoAco: ResumoPorBitola[];
  massaAco: number;           // kg
  sapata: { concreto: number; forma: number };                          // m³, m²
  drenagem: {
    barbacas: number;         // un
    tubo: number;             // m
    brita: number;            // m³
    manta: number;            // m²
    impermeabilizacao: number | null;   // m²; null = desligada nas entradas
  };
  avisos: string[];
}

export const ROTULO_DA_PECA: Readonly<Partial<Record<TipoPeca, string>>> = {
  BLOCO: 'Bloco inteiro',
  MEIO_BLOCO: 'Meio bloco',
  BLOCO_JUNCAO: 'Bloco de amarração',
  BLOCO_CORTADO: 'Bloco cortado',
  CANALETA: 'Canaleta',
  MEIA_CANALETA: 'Meia canaleta',
  CANALETA_CORTADA: 'Canaleta cortada',
};
const ORDEM_DA_PECA: TipoPeca[] = ['BLOCO', 'MEIO_BLOCO', 'BLOCO_JUNCAO', 'BLOCO_CORTADO', 'CANALETA', 'MEIA_CANALETA', 'CANALETA_CORTADA'];

const MM3 = 1e9;   // mm³ → m³
const MM2 = 1e6;   // mm² → m²

interface Medida { p: Peca; g: Geometria }

function pecasDoTipo(m: Modelo, tipo: TipoPeca): Medida[] {
  const r: Medida[] = [];
  for (const p of m.pecas) {
    if (p.tipo !== tipo) continue;
    const g = m.geometrias[p.geometria];
    if (g) r.push({ p, g });
  }
  return r;
}

const somaVolumes = (lista: Medida[]): number => lista.reduce((s, { g }) => s + g.volume_mm3, 0);

/**
 * Entrada do modelo efetivamente usada pela modulação (`Modelo.extras`); sem ela, o padrão de fábrica. Ler do
 * próprio Modelo, e não de um parâmetro à parte, garante que a quantidade sai do MESMO muro que o 3D desenhou.
 */
function extra(m: Modelo, nome: string): Valor {
  if (m.extras && nome in m.extras) return m.extras[nome];
  return ENTRADAS_DO_MODELO.find((e) => e.nome === nome)?.padrao ?? null;
}

/**
 * Avisos da modulação que mudam a QUANTIDADE (não só o desenho). A barra de estado já mostra todos; estes
 * repetem-se aqui e no CSV porque o CSV vai sozinho para o orçamento, sem a barra de estado junto.
 * Os códigos são os da modulação (gerar.ts); código renomeado lá só faz o aviso sumir daqui, não quebra nada.
 */
const AVISOS_QUE_MUDAM_QUANTIDADE = new Set([
  'TORCAO_LONGITUDINAL',   // aço de torção longitudinal fora do desenho → fora da lista de ferros
  'SAPATA_ESPACAMENTO',    // armadura da sapata num espaçamento adotado, não no da conta
  'TRASPASSE_ADOTADO',     // conta do traspasse sem número → emendas com 50φ, comprimento de barra deduzido
  'CONTA_SEM_VALOR',       // peça desenhada com valor de obra porque a conta não deu número
  // Os de baixo vieram com a modulação dos gabaritos do Revit (09/10) e não chegavam ao CSV:
  'ESTRIBO_RAMOS',         // a conta pede mais ramos que o estribo fechado desenhado → aço de estribo a menos
  'CANALETA_CF',           // barra em L da canaleta do contraforte: Ø e perna deduzidos (a planilha não dimensiona)
  'CANALETA_CF_PERNA',     // perna dessa barra encurtada no vão curto
  'CANALETA_SEM_ESPACAMENTO', // só a cinta do topo: as canaletas intermediárias (peça, graute e aço) ficam fora
  'HASTE_SEM_GABARITO',    // haste mais comprida que os modelos do Revit: peças da haste deduzidas
  'BALANCO_ALEM_DO_CF',    // o balanço da conta além do contraforte da ponta não está no desenho
  'BARBACA_SEM_CELULA',    // barbacã pedido e não desenhado (1ª fiada sem célula livre — muro todo em canaleta)
]);

function contarBlocos(m: Modelo): LinhaDeBloco[] {
  const porChave = new Map<string, LinhaDeBloco>();
  for (const p of m.pecas) {
    if (!ALVENARIA.has(p.tipo)) continue;
    const g = m.geometrias[p.geometria];
    const catalogo = g?.catalogo ?? g?.chave ?? p.geometria;
    const k = `${p.tipo}|${catalogo}`;
    const l = porChave.get(k);
    if (l) l.quantidade += 1;
    else porChave.set(k, { tipo: p.tipo, rotulo: ROTULO_DA_PECA[p.tipo] ?? p.tipo, catalogo, quantidade: 1, ...(g?.classe ? { classe: g.classe } : {}) });
  }
  return [...porChave.values()].sort((a, b) =>
    ORDEM_DA_PECA.indexOf(a.tipo) - ORDEM_DA_PECA.indexOf(b.tipo) || a.catalogo.localeCompare(b.catalogo, 'pt-BR', { numeric: true }));
}

/**
 * Graute dos furos. O normal é a modulação entregar as peças GRAUTE_FURO; se ela só marcar `furosGrauteados`
 * nos blocos (sem peça de graute nenhuma), mede-se pelos furos marcados × altura da fiada (bloco + junta,
 * que é a altura que o graute ocupa). Nunca as duas coisas juntas — seria graute contado em dobro.
 */
function grauteDosFuros(m: Modelo): number {
  const pecas = pecasDoTipo(m, 'GRAUTE_FURO');
  if (pecas.length > 0) return somaVolumes(pecas);
  const altura = m.familia.h + m.familia.junta;
  let v = 0;
  for (const p of m.pecas) {
    if (!p.furosGrauteados?.length) continue;
    const furos = m.geometrias[p.geometria]?.perfil.furos ?? [];
    for (const i of p.furosGrauteados) if (furos[i]) v += areaDoLaco(furos[i]) * altura;
  }
  return v;
}

/** Extremos da caixa ao longo do eixo global e na direção transversal em planta. */
function faixas(c: Caixa, eixo: 'X' | 'Y' | 'Z'): { a0: number; a1: number; t0: number; t1: number } {
  return eixo === 'Y'
    ? { a0: c.y0, a1: c.y1, t0: c.x0, t1: c.x1 }
    : { a0: c.x0, a1: c.x1, t0: c.y0, t1: c.y1 };
}

/**
 * Fôrma da sapata (DEDUÇÃO): as faces verticais do corpo da sapata (as que chegam ao topo) e os topos livres.
 * O dente é escavado e concretado contra o solo — sem fôrma — e o topo da sapata é sarrafeado, também sem.
 * Topo encostado em outra sapata (peças emendadas) não leva fôrma; topo na junta de controle leva.
 */
function formaDaSapata(sapatas: Medida[]): number {
  const caixas = sapatas.map(({ p, g }) => caixaDaPeca(p, g));
  let forma = 0;
  sapatas.forEach(({ p, g }, i) => {
    const contorno = g.perfil.contorno;
    if (g.eixo === 'Z') {                       // sapata desenhada em planta e extrudada para cima
      let lados = 0;
      for (let k = 0; k < contorno.length; k++) {
        const [x1, y1] = contorno[k], [x2, y2] = contorno[(k + 1) % contorno.length];
        lados += Math.hypot(x2 - x1, y2 - y1);
      }
      forma += lados * g.extensao;
      return;
    }
    // Perfil em corte: u horizontal, v = z.
    const vTopo = Math.max(...contorno.map(([, v]) => v));
    let lados = 0, vBase = Infinity;
    for (let k = 0; k < contorno.length; k++) {
      const [u1, v1] = contorno[k], [u2, v2] = contorno[(k + 1) % contorno.length];
      if (Math.abs(u2 - u1) > 0.5) continue;
      if (Math.max(v1, v2) < vTopo - 0.5) continue;   // face do dente
      lados += Math.abs(v2 - v1);
      vBase = Math.min(vBase, v1, v2);
    }
    forma += lados * g.extensao;
    const topo = areaDoLaco(Number.isFinite(vBase) ? recortarAcimaDe(contorno, vBase) : contorno);
    const eixo = eixoGlobal(g, p.giro);
    const a = faixas(caixas[i], eixo);
    const encostada = (ponta: number) => caixas.some((c, j) => {
      if (j === i) return false;
      const b = faixas(c, eixo);
      const toca = Math.abs(b.a1 - ponta) < 1 || Math.abs(b.a0 - ponta) < 1;
      return toca && Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > 1;
    });
    if (!encostada(a.a0)) forma += topo;
    if (!encostada(a.a1)) forma += topo;
  });
  return forma;
}

/**
 * Impermeabilização do tardoz (DEDUÇÃO): face do muro do lado do solo, do topo da sapata até a altura de solo,
 * mais as faces laterais de cada haste de contraforte enterrado (a ponta da haste repõe a faixa que ela cobre
 * no muro). Face de haste que encara outra haste a uma junta de distância (os dois contrafortes encostados da
 * junta de controle) não vê solo e fica fora. A haste aparente fica do lado de fora: não entra.
 */
function areaDoTardoz(m: Modelo): number {
  const H = m.dims.H_solo;
  const comprimento = m.dims.trechos.length
    ? m.dims.trechos.reduce((s, t) => s + (t.x1 - t.x0), 0)
    : m.dims.L_real;
  const t = m.familia.t;
  const caixas: Caixa[] = [];
  for (const p of m.pecas) {
    if (p.grupo !== 'contraforte' || !ALVENARIA.has(p.tipo)) continue;
    const g = m.geometrias[p.geometria];
    if (g) caixas.push(caixaDaPeca(p, g));
  }
  // Haste = o que o contraforte tem além da face do solo do muro (Y > t), na faixa em X do eixo dele.
  const hastes: { x0: number; x1: number; y1: number }[] = [];
  for (const cf of m.dims.contrafortes) {
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of caixas) {
      if (c.x0 > cf.x || cf.x > c.x1 || c.y1 <= t + 1) continue;
      x0 = Math.min(x0, c.x0);
      x1 = Math.max(x1, c.x1);
      y1 = Math.max(y1, c.y1);
    }
    if (y1 - t > 1) hastes.push({ x0, x1, y1 });
  }
  const folga = 2 * m.familia.junta;
  const encara = (h: { x0: number; x1: number }, x: number, lado: -1 | 1) =>
    hastes.some((o) => o !== h && (lado < 0 ? Math.abs(x - o.x1) <= folga && o.x1 <= x + 1 : Math.abs(o.x0 - x) <= folga && o.x0 >= x - 1));
  let area = comprimento * H;
  for (const h of hastes) {
    const prof = h.y1 - t;
    if (!encara(h, h.x0, -1)) area += prof * H;
    if (!encara(h, h.x1, 1)) area += prof * H;
  }
  return area;
}

/** O quantitativo do muro que o Modelo descreve. */
export function quantificar(m: Modelo): Quantitativo {
  const avisos: string[] = [];

  const blocos = contarBlocos(m);
  const totalBlocos = blocos.reduce((s, l) => s + l.quantidade, 0);
  if (m.familia.provisoria && m.pecas.some((p) => p.grupo === 'contraforte' && ALVENARIA.has(p.tipo))) {
    avisos.push(`Peças do contraforte provisórias (família ${m.familia.nome})`);
  }
  for (const a of m.avisos) if (AVISOS_QUE_MUDAM_QUANTIDADE.has(a.codigo)) avisos.push(a.texto);

  const furos = grauteDosFuros(m) / MM3;
  const canaletas = somaVolumes(pecasDoTipo(m, 'GRAUTE_CANALETA')) / MM3;

  const arg = medirArgamassa(m);

  const ferros = listaDeFerros(m.barras);
  avisos.push(...ferros.avisos);
  const resumoAco = resumoDoAco(ferros.linhas);

  const sapatas = pecasDoTipo(m, 'SAPATA');
  const barbacas = pecasDoTipo(m, 'BARBACA');
  const imperLigada = extra(m, 'imper_on') !== 'Não';

  return {
    muro: {
      familia: m.familia.nome,
      comprimento: m.dims.L_real / 1000,
      alturaMuro: m.dims.H_muro / 1000,
      alturaSolo: m.dims.H_solo / 1000,
      fiadas: m.dims.n_fiadas,
      contrafortes: m.dims.contrafortes.length,
      trechos: Math.max(1, m.dims.trechos.length),
    },
    blocos,
    totalBlocos,
    graute: { furos, canaletas, total: furos + canaletas },
    argamassa: { horizontal: arg.horizontal / MM3, vertical: arg.vertical / MM3, total: (arg.horizontal + arg.vertical) / MM3 },
    ferros: ferros.linhas,
    resumoAco,
    massaAco: resumoAco.reduce((s, r) => s + r.massa, 0),
    sapata: { concreto: somaVolumes(sapatas) / MM3, forma: formaDaSapata(sapatas) / MM2 },
    drenagem: {
      barbacas: barbacas.length,
      tubo: barbacas.reduce((s, { g }) => s + g.extensao, 0) / 1000,
      brita: somaVolumes(pecasDoTipo(m, 'DRENO')) / MM3,
      manta: pecasDoTipo(m, 'MANTA').reduce((s, { g }) => s + areaDaFolha(g), 0) / MM2,
      impermeabilizacao: imperLigada ? areaDoTardoz(m) / MM2 : null,
    },
    avisos,
  };
}

/**
 * Confere o Modelo contra o próprio contrato: volume declarado = perfil × extensão, e toda peça com geometria.
 * Não vai para a tela — é a rede de segurança do teste de integração com a modulação: o quantitativo confia no
 * `volume_mm3`, e um volume errado lá viraria graute ou concreto errado aqui sem ninguém ver.
 */
export function conferirGeometrias(m: Modelo): string[] {
  const erros: string[] = [];
  for (const [k, g] of Object.entries(m.geometrias)) {
    // peça em pedaços (a canaleta furada/quebrada — Geometria.pedacos, modulação 09/10 noite): o volume é o da união
    const v = g.pedacos?.length
      ? g.pedacos.reduce((s, q) => s + Math.abs(areaDoLaco(q.contorno)) * (q.ate - q.de), 0)
      : areaLiquida(g) * g.extensao;
    if (Math.abs(v - g.volume_mm3) > 0.005 * Math.max(v, g.volume_mm3, 1)) {
      erros.push(`${k}: volume ${g.volume_mm3.toFixed(0)} × perfil·extensão ${v.toFixed(0)} mm³`);
    }
  }
  for (const p of m.pecas) if (!m.geometrias[p.geometria]) erros.push(`${p.id}: geometria '${p.geometria}' inexistente`);
  return erros;
}
