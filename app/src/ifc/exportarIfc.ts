/*
  EXPORTAÇÃO IFC4 (ADD2 TC1) DO MURO — Modelo → texto .ifc. Função pura: o mesmo Modelo com a mesma `info`
  gera o mesmo arquivo, byte a byte (o teste confere).

  ÁRVORE (recomendação do brief scratchpad/entender/ifc.md §2, medida no IFC do Revit 2026 e no importador dele):

    IfcProject → IfcSite 'Terreno' → IfcBuilding 'Muro de arrimo' → IfcBuildingStorey (Z = 0 = topo da sapata)
      contidos no pavimento (SÓ os elementos de topo):
        IfcWall 'Muro T1'          USERDEFINED/'RETAININGWALL', SEM corpo próprio  ─agrega→ blocos, canaletas, graute
        IfcWall 'Contraforte C1'   USERDEFINED/'CONTRAFORTE',   SEM corpo próprio  ─agrega→ blocos e graute da haste
        IfcFooting 'Sapata corrida T1'  STRIP_FOOTING, corpo próprio
        IfcReinforcingBar × n      contidas no pavimento, NÃO agregadas a nada
        (drenagem só se pedida: IfcPipeSegment barbacã, IfcBuildingElementProxy dreno, IfcCovering manta)
      terreno (ATERRO, SOLO_FRENTE): FORA, sempre — é só para ver no 3D.

  POR QUE O MURO É CONTÊINER SEM CORPO E A BARRA FICA FORA DELE:
    O importador do Revit (revit-ifc, IFCImportOptions.CreateDuplicateContainerGeometry = true) dá ao contêiner uma
    CÓPIA da geometria de tudo o que ele agrega. Se o IfcWall tivesse corpo próprio E as partes, o muro apareceria
    duas vezes por cima de si mesmo (o próprio importador avisa "duplicate geometry"). Sem corpo, o Revit mostra a
    parede (categoria Paredes, feita da cópia dos blocos) e os blocos (categoria Partes) — o preço aceito para ter
    bloco a bloco no IFC. A armadura NÃO entra na agregação: se entrasse, cada barra viraria também parte da
    "parede" copiada; contida no pavimento é exatamente como o próprio Revit exporta vergalhão.
    A quem a barra pertence vai na propriedade AlRimo_Barra.Elemento.

  GEOMETRIA COMPARTILHADA: uma IfcRepresentationMap por Geometria do Modelo (dentro do tipo, RepresentationMaps)
  e um IfcMappedItem por peça — é o mesmo desenho do InstancedMesh do 3D e o que o Revit grava. Medido no
  protótipo: 417 B por bloco contra 1.037 B sem o mapa. O IfcProductDefinitionShape NÃO é compartilhado entre
  peças (economizaria mais, mas nenhum exportador grande faz isso e é risco no importador).

  Barras: um IfcReinforcingBarType por POSIÇÃO (N1, N2...), com a curva no mapa do tipo; cada barra que é cópia
  transladada da 1ª da posição vira IfcMappedItem. Curva = IfcIndexedPolyCurve com IfcArcIndex (arco verdadeiro
  nas dobras) varrida por IfcSweptDiskSolid em 'AdvancedSweptSolid' ('SweptSolid' viola CorrectItemsForType).

  Unidades: o Modelo vem em mm; o IFC sai em METRO (o Revit converte sozinho), MPa para pressão.
*/
import type { Barra, Geometria, Modelo, Peca, PapelBarra, TipoPeca, Vec3 } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { $, E, I, STAR, T, criarEscritor, guid, type Arg, type Ref } from './step';
import {
  areaAssinada, areaDoPerfil, caixaDaPeca, direcaoDoGiro, eixoDaBarra, massaLinear, perfilOrientado, pontoDeInsercao,
  posicaoDoSolido, type Caixa,
} from './geometria';

export interface InfoIfc {
  projeto: string;
  autor?: string;
  /** ISO 8601. Vai no cabeçalho e na data de criação. Sem ela, a hora de agora (aí o arquivo muda a cada exportação). */
  data?: string;
  /** Se vier, os Psets ganham os valores da conta (fbk, fgk, fck, fyk, graute...). */
  resultado?: Resultado;
  /**
   * OPCIONAL, acrescentado pela frente IFC: identificador estável do projeto (ex.: UUID criado quando o projeto
   * nasce). Todos os GUIDs saem dele; sem ele, saem do nome do projeto — e renomear o projeto trocaria os GUIDs.
   */
  chave?: string;
  /** OPCIONAL: inclui barbacãs, dreno e manta (padrão: fora — recomendação do brief). */
  drenagem?: boolean;
  /** OPCIONAL: nome que vai no FILE_NAME do cabeçalho. */
  nomeArquivo?: string;
}

export interface RelatorioIfc {
  texto: string;
  entidades: number;
  /** Peças e barras exportadas por classe IFC. */
  contagem: Record<string, number>;
  /** O que não foi exportado e por quê (peça com perfil degenerado, barra sem eixo, id repetido...). */
  avisos: string[];
}

export function exportarIfc(modelo: Modelo, info: InfoIfc): string {
  return gerarIfc(modelo, info).texto;
}

// ── classificação das peças ───────────────────────────────────────────────────────────────────────────────────────
type Classe = 'PARTE' | 'SAPATA' | 'DRENO' | 'MANTA' | 'BARBACA';
type Mat = 'bloco' | 'graute' | 'concreto' | 'brita' | 'areia' | 'manta' | 'pvc';

const CLASSE: Record<TipoPeca, Classe | null> = {
  BLOCO: 'PARTE', MEIO_BLOCO: 'PARTE', BLOCO_JUNCAO: 'PARTE', BLOCO_CORTADO: 'PARTE',
  CANALETA: 'PARTE', MEIA_CANALETA: 'PARTE', CANALETA_CORTADA: 'PARTE',
  GRAUTE_FURO: 'PARTE', GRAUTE_CANALETA: 'PARTE',
  SAPATA: 'SAPATA',
  DRENO: 'DRENO', AREIA: 'DRENO', MANTA: 'MANTA', BARBACA: 'BARBACA', TUBO_DRENO: 'BARBACA',
  ATERRO: null, SOLO_FRENTE: null,
};

const ROTULO: Record<TipoPeca, string> = {
  BLOCO: 'Bloco', MEIO_BLOCO: 'Meio bloco', BLOCO_JUNCAO: 'Bloco de amarração', BLOCO_CORTADO: 'Bloco cortado',
  CANALETA: 'Canaleta', MEIA_CANALETA: 'Meia canaleta', CANALETA_CORTADA: 'Canaleta cortada',
  GRAUTE_FURO: 'Graute do furo', GRAUTE_CANALETA: 'Graute da canaleta',
  SAPATA: 'Sapata corrida', DRENO: 'Dreno (brita)', AREIA: 'Filtro de areia', MANTA: 'Manta geotêxtil', BARBACA: 'Barbacã',
  TUBO_DRENO: 'Dreno de fundo (tubo perfurado)',
  ATERRO: 'Aterro', SOLO_FRENTE: 'Solo',
};

const materialDe = (t: TipoPeca): Mat =>
  t === 'GRAUTE_FURO' || t === 'GRAUTE_CANALETA' ? 'graute'
    : t === 'SAPATA' ? 'concreto'
      : t === 'DRENO' ? 'brita' : t === 'AREIA' ? 'areia' : t === 'MANTA' ? 'manta' : t === 'BARBACA' || t === 'TUBO_DRENO' ? 'pvc' : 'bloco';

// IfcReinforcingBarTypeEnum (IFC4). Estribo e torção fechada = SHEAR; o resto trabalha como armadura principal.
const TIPO_BARRA: Record<PapelBarra, string> = {
  VERT_MURO: 'MAIN', ESPERA: 'MAIN', HORIZ: 'MAIN', CF_PRINCIPAL: 'MAIN', CF_CONSTRUTIVA: 'MAIN', CF_ESTRIBO: 'SHEAR',
  SAP_TRANSV: 'MAIN', SAP_LONG: 'MAIN', SAP_TORCAO: 'MAIN',
};

const COR: Record<Mat | 'aco', [number, number, number]> = {
  bloco: [0.72, 0.72, 0.7], graute: [0.55, 0.62, 0.75], concreto: [0.8, 0.8, 0.8], aco: [0.7, 0.25, 0.2],
  brita: [0.6, 0.55, 0.45], areia: [0.93, 0.89, 0.62], manta: [0.3, 0.3, 0.35], pvc: [0.9, 0.9, 0.9],
};

// ── leitura tolerante do Resultado: Psets são enfeite, nome que falta não pode derrubar a exportação ───────────────
function leitor(r?: Resultado) {
  const num = (nome: string): number | null => {
    try { return r ? r.num(nome) : null; } catch { return null; }
  };
  const txt = (nome: string): string | null => {
    try {
      const v = r ? r.v(nome) : null;
      return typeof v === 'string' && v.trim() !== '' && v !== '—' ? v : null;
    } catch { return null; }
  };
  return { num, txt };
}

/**
 * Data da exportação → texto do cabeçalho ('AAAA-MM-DDThh:mm:ss') e segundos desde 1970 (IfcTimeStamp).
 * Lida À MÃO, sem Date.parse: data sem fuso tem de valer como UTC em qualquer máquina (senão o arquivo muda com o
 * fuso de quem exporta), e '2026-10-08' — que é o que a tela manda — não pode depender de como cada navegador
 * interpreta formato fora do padrão. Data que não se entende derruba a exportação: gravar 1970 em silêncio seria pior.
 */
export function normalizarData(iso: string): { texto: string; segundos: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(iso.trim());
  if (!m) throw new Error(`data inválida para o IFC: '${iso}'`);
  const [a, me, d, h, mi, s] = m.slice(1, 7).map((x) => (x === undefined ? 0 : Number(x)));
  let t = Date.UTC(a, me - 1, d, h, mi, s);
  const fuso = m[7] && m[7].toUpperCase() !== 'Z' ? m[7].replace(':', '') : null;
  if (fuso) t -= (fuso[0] === '-' ? -1 : 1) * (Number(fuso.slice(1, 3)) * 60 + Number(fuso.slice(3, 5))) * 60000;
  const volta = new Date(Date.UTC(a, me - 1, d, h, mi, s));
  if (volta.getUTCMonth() !== me - 1 || volta.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) {
    throw new Error(`data inválida para o IFC: '${iso}'`);
  }
  const p2 = (n: number) => String(n).padStart(2, '0');
  return { texto: `${a}-${p2(me)}-${p2(d)}T${p2(h)}:${p2(mi)}:${p2(s)}`, segundos: Math.floor(t / 1000) };
}

const mm = (v: number) => v / 1000;
/** Sai > 0 no arquivo (o mesmo corte do real() do escritor). */
const positivo = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 5e-7;
const ptm = (p: Vec3): number[] => [mm(p[0]), mm(p[1]), mm(p[2])];

export function gerarIfc(modelo: Modelo, info: InfoIfc): RelatorioIfc {
  const w = criarEscritor();
  const avisos: string[] = [];
  const contagem: Record<string, number> = {};
  const conta = (classe: string, n = 1) => { contagem[classe] = (contagem[classe] ?? 0) + n; };
  const K = (info.chave ?? info.projeto) + '|';
  const G = (k: string) => guid(K + k);
  const R = leitor(info.resultado);
  const fam = modelo.familia;

  // ── primitivas ──────────────────────────────────────────────────────────────────────────────────────────────
  const P = (p: number[]) => w.addU('IFCCARTESIANPOINT', [p]);
  const D = (d: number[]) => w.addU('IFCDIRECTION', [d]);
  const O3 = P([0, 0, 0]);
  const A3 = (p: Ref = O3, z: Ref | null = null, x: Ref | null = null) => w.addU('IFCAXIS2PLACEMENT3D', [p, z, x]);
  const prop = (nome: string, tipo: string, v: Arg) => w.add('IFCPROPERTYSINGLEVALUE', [nome, $, T(tipo, v), $]);
  // Medida "positiva" do IFC (IfcPositiveLengthMeasure, IfcPositiveRatioMeasure) tem a regra WR1: SELF > 0. Zero
  // aparece de verdade — a conta publica s_adot = 0 no sorteio18 e no sorteio25 do gabarito (DEDUÇÃO: nenhum arranjo
  // passou) — e um zero só reprova o arquivo inteiro no validador. Valor que não sai > 0 no texto (real() grava < 5·10⁻⁷
  // como 0.) simplesmente não vai: propriedade ausente é honesta, zero "positivo" é defeito.
  const propPos = (nome: string, tipo: string, v: number | null | undefined) => (positivo(v) ? prop(nome, tipo, v) : null);
  const relProps = (chave: string, objetos: Ref[], def: Ref) =>
    w.add('IFCRELDEFINESBYPROPERTIES', [G('rel/' + chave), oh, $, $, objetos, def]);
  const pset = (chave: string, nome: string, props: (Ref | null)[]): Ref | null => {
    const ps = props.filter((p): p is Ref => p !== null);
    return ps.length ? w.add('IFCPROPERTYSET', [G(chave), oh, nome, $, ps]) : null;
  };
  /** Pset + vínculo com os objetos; Pset que ficou vazio (tudo opcional e nada veio) não é escrito. */
  const ligarPset = (chave: string, nome: string, objetos: Ref[], props: (Ref | null)[]) => {
    const ps = pset(chave, nome, props);
    if (ps) relProps(chave, objetos, ps);
  };
  const qto = (chave: string, nome: string, qs: Ref[]) => w.add('IFCELEMENTQUANTITY', [G(chave), oh, nome, $, $, qs]);
  const qLen = (n: string, v: number) => w.add('IFCQUANTITYLENGTH', [n, $, $, v, $]);
  const qArea = (n: string, v: number) => w.add('IFCQUANTITYAREA', [n, $, $, v, $]);
  const qVol = (n: string, v: number) => w.add('IFCQUANTITYVOLUME', [n, $, $, v, $]);
  const qPeso = (n: string, v: number) => w.add('IFCQUANTITYWEIGHT', [n, $, $, v, $]);
  const seNum = (v: number | null, f: (x: number) => Ref): Ref | null => (v === null ? null : f(v));

  // ── cabeçalho do projeto ────────────────────────────────────────────────────────────────────────────────────
  const quando = normalizarData(info.data ?? new Date().toISOString());
  const pessoa = w.add('IFCPERSON', [$, info.autor?.trim() || 'Al-rimo', $, $, $, $, $, $]);
  const org = w.add('IFCORGANIZATION', [$, 'Al-rimo', $, $, $]);
  const po = w.add('IFCPERSONANDORGANIZATION', [pessoa, org, $]);
  const app = w.add('IFCAPPLICATION', [org, modelo.versao || '0', 'Al-rimo', 'AlRimo']);
  const oh = w.add('IFCOWNERHISTORY', [po, app, $, E('NOCHANGE'), $, $, $, I(quando.segundos)]);
  const unidades = w.add('IFCUNITASSIGNMENT', [[
    w.add('IFCSIUNIT', [STAR, E('LENGTHUNIT'), $, E('METRE')]),
    w.add('IFCSIUNIT', [STAR, E('AREAUNIT'), $, E('SQUARE_METRE')]),
    w.add('IFCSIUNIT', [STAR, E('VOLUMEUNIT'), $, E('CUBIC_METRE')]),
    w.add('IFCSIUNIT', [STAR, E('PLANEANGLEUNIT'), $, E('RADIAN')]),
    w.add('IFCSIUNIT', [STAR, E('MASSUNIT'), E('KILO'), E('GRAM')]),
    // com o MPa declarado, IFCPRESSUREMEASURE(25.) é 25 MPa — o número que o engenheiro lê
    w.add('IFCSIUNIT', [STAR, E('PRESSUREUNIT'), E('MEGA'), E('PASCAL')]),
  ]]);
  const ctx = w.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [$, 'Model', I(3), 1e-5, A3(), D([0, 1])]);
  const body = w.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', ['Body', 'Model', STAR, STAR, STAR, STAR, ctx, $, E('MODEL_VIEW'), $]);
  const projeto = w.add('IFCPROJECT', [G('projeto'), oh, info.projeto, $, $, $, $, [ctx], unidades]);
  const plSite = w.add('IFCLOCALPLACEMENT', [$, A3()]);
  const site = w.add('IFCSITE', [G('site'), oh, 'Terreno', $, $, plSite, $, $, E('ELEMENT'), $, $, $, $, $]);
  const plEd = w.add('IFCLOCALPLACEMENT', [plSite, A3()]);
  const edif = w.add('IFCBUILDING', [G('edificio'), oh, 'Muro de arrimo', $, $, plEd, $, $, E('ELEMENT'), $, $, $]);
  const plPav = w.add('IFCLOCALPLACEMENT', [plEd, A3()]);
  const pav = w.add('IFCBUILDINGSTOREY', [G('pavimento'), oh, 'Topo da sapata', $, $, plPav, $, $, E('ELEMENT'), 0]);
  w.add('IFCRELAGGREGATES', [G('rel/projeto-site'), oh, $, $, projeto, [site]]);
  w.add('IFCRELAGGREGATES', [G('rel/site-edificio'), oh, $, $, site, [edif]]);
  w.add('IFCRELAGGREGATES', [G('rel/edificio-pavimento'), oh, $, $, edif, [pav]]);

  // ── materiais e cores (criados só se alguma peça usa) ──────────────────────────────────────────────────────
  const fbk = R.num('fbk_');
  const fgk = R.num('fgk_');
  const fckTxt = R.txt('fck_fund');
  const fck = fckTxt && /^C\d+/.test(fckTxt) ? Number(fckTxt.slice(1)) : null;
  const fyk = R.num('fyk_');
  const nomeAco = fyk === 500 || fyk === null ? 'Aço CA-50' : fyk === 600 ? 'Aço CA-60' : `Aço fyk ${fyk} MPa`;
  const MATERIAL: Record<Mat | 'aco', [string, string]> = {
    bloco: [fbk !== null ? `Bloco de concreto fbk ${fmt(fbk)} MPa` : 'Bloco de concreto', 'block'],
    graute: [fgk !== null ? `Graute fgk ${fmt(fgk)} MPa` : 'Graute', 'concrete'],
    concreto: [fck !== null ? `Concreto C${fck}` : 'Concreto', 'concrete'],
    aco: [nomeAco, 'steel'],
    brita: ['Brita', 'stone'],
    areia: ['Areia', 'sand'],
    manta: ['Manta geotêxtil', 'plastic'],
    pvc: ['Tubo de PVC', 'plastic'],
  };
  const materiais = new Map<Mat | 'aco', Ref>();
  const estilos = new Map<Mat | 'aco', Ref>();
  const tiposPorMaterial = new Map<Mat | 'aco', Ref[]>();
  const material = (m: Mat | 'aco'): Ref => {
    let r = materiais.get(m);
    if (!r) {
      r = w.add('IFCMATERIAL', [MATERIAL[m][0], $, MATERIAL[m][1]]);
      materiais.set(m, r);
      const resist = m === 'graute' ? fgk : m === 'concreto' ? fck : null;
      if (resist !== null) {
        w.add('IFCMATERIALPROPERTIES', ['Pset_MaterialConcrete', $, [prop('CompressiveStrength', 'IFCPRESSUREMEASURE', resist)], r]);
      }
      if (m === 'aco' && fyk !== null) {
        w.add('IFCMATERIALPROPERTIES', ['Pset_MaterialSteel', $, [prop('YieldStress', 'IFCPRESSUREMEASURE', fyk)], r]);
      }
    }
    return r;
  };
  const estilo = (m: Mat | 'aco'): Ref => {
    let r = estilos.get(m);
    if (!r) {
      const [cr, cg, cb] = COR[m];
      const cor = w.add('IFCCOLOURRGB', [$, cr, cg, cb]);
      r = w.add('IFCSURFACESTYLE', [MATERIAL[m][0], E('BOTH'), [w.add('IFCSURFACESTYLESHADING', [cor, 0])]]);
      estilos.set(m, r);
    }
    return r;
  };
  const associaMaterial = (m: Mat | 'aco', tipo: Ref) => {
    material(m);
    const l = tiposPorMaterial.get(m) ?? [];
    l.push(tipo);
    tiposPorMaterial.set(m, l);
  };
  const alvo = w.addU('IFCCARTESIANTRANSFORMATIONOPERATOR3D', [$, $, O3, 1, $]);

  // ── perfis e sólidos ─────────────────────────────────────────────────────────────────────────────────────────
  const poligono = (pts: number[][]) => {
    // polígono fechado: 1 lista de pontos + 1 curva, voltando ao índice 1
    const lst = w.add('IFCCARTESIANPOINTLIST2D', [pts]);
    const idx = pts.map((_, i) => I(i + 1));
    idx.push(I(1));
    return w.add('IFCINDEXEDPOLYCURVE', [lst, [T('IFCLINEINDEX', idx)], E('F')]);
  };

  const solidoDoPrisma = (geo: Geometria, perfilGeo: Geometria['perfil'], de: number, ate: number): Ref | null => {
    const p = perfilOrientado(perfilGeo);
    if (!p || !positivo(mm(ate - de))) return null;   // Depth é IfcPositiveLengthMeasure
    const m2 = (pts: [number, number][]) => pts.map(([u, v]) => [mm(u), mm(v)]);
    const externo = poligono(m2(p.contorno));
    const perfil = p.furos.length
      ? w.add('IFCARBITRARYPROFILEDEFWITHVOIDS', [E('AREA'), geo.catalogo ?? geo.chave, externo, p.furos.map((f) => poligono(m2(f)))])
      : w.add('IFCARBITRARYCLOSEDPROFILEDEF', [E('AREA'), geo.catalogo ?? geo.chave, externo]);
    const pos = posicaoDoSolido(geo.eixo, ate, de);
    const posicao = A3(P(ptm(pos.local)), pos.axis ? D(pos.axis) : null, pos.ref ? D(pos.ref) : null);
    return w.add('IFCEXTRUDEDAREASOLID', [perfil, posicao, D([0, 0, 1]), mm(ate - de)]);
  };
  /*
    Peça recortada (a canaleta com o fundo furado e a parede quebrada — Geometria.recortes): o U INTEIRO menos uma
    caixa por recorte, em IfcBooleanResult(DIFFERENCE) encadeado, representação 'CSG'. Até 14/10 ia em pedaços (um
    IfcExtrudedAreaSolid por pedaço, 'SweptSolid'), e o Revit desenhava a emenda entre eles — a canaleta aparecia
    segmentada (Jose). A booleana não entra na Reference View: o arquivo se declara Design Transfer View (step.ts).
    Sem recortes (ou recorte que não monta), o de antes.
  */
  const solidosDaGeometria = (geo: Geometria): { itens: Ref[]; tipo: 'SweptSolid' | 'CSG' } => {
    if (geo.recortes?.length) {
      let r: Ref | null = solidoDoPrisma(geo, geo.perfil, 0, geo.extensao);
      for (const q of geo.recortes) {
        const corte = r && solidoDoPrisma(geo, { contorno: q.contorno }, q.de, q.ate);
        r = r && corte ? w.add('IFCBOOLEANRESULT', [E('DIFFERENCE'), r, corte]) : null;
      }
      if (r) return { itens: [r], tipo: 'CSG' };
    }
    if (!geo.pedacos?.length) {
      const s = solidoDoPrisma(geo, geo.perfil, 0, geo.extensao);
      return { itens: s ? [s] : [], tipo: 'SweptSolid' };
    }
    return { itens: geo.pedacos.map((q) => solidoDoPrisma(geo, { contorno: q.contorno }, q.de, q.ate)).filter((s): s is Ref => s !== null), tipo: 'SweptSolid' };
  };

  // ── tipos: um por (Geometria, classe) com a IfcRepresentationMap ─────────────────────────────────────────────
  // A entidade do TIPO só é escrita no fim, depois de todas as peças: o Pset do tipo tem de ir em HasPropertySets — a regra
  // IFC4 NoRelatedTypeObject proíbe ligar Pset a tipo por IfcRelDefinesByProperties — e a quantidade de peças só
  // se conhece depois de passar por todas. O mapa (a geometria) nasce no primeiro uso; o tipo não é preciso antes.
  interface TipoGeo { k: string; classe: Classe; mapa: Ref; ocorrencias: Ref[]; geo: Geometria; tipoPeca: TipoPeca }
  const tiposGeo = new Map<string, TipoGeo | null>();
  const nomeDaPeca = (t: TipoPeca, geo: Geometria): string => {
    const cat = geo.catalogo?.trim();
    if (!cat) return ROTULO[t] + (t.startsWith('GRAUTE') || CLASSE[t] !== 'PARTE' ? '' : ' ' + fam.nome);
    // '14x19x39' é só medida (o 'x' não conta como palavra): ganha o rótulo na frente
    return /[a-zà-ú]{2,}/i.test(cat) ? cat.charAt(0).toUpperCase() + cat.slice(1) : ROTULO[t] + ' ' + cat;
  };
  const tipoDaGeometria = (peca: Peca, geo: Geometria): TipoGeo | null => {
    const classe = CLASSE[peca.tipo]!;
    const k = geo.chave + '|' + classe;
    if (tiposGeo.has(k)) return tiposGeo.get(k)!;
    const { itens: solidos, tipo } = solidosDaGeometria(geo);
    if (!solidos.length) { tiposGeo.set(k, null); return null; }
    for (const solido of solidos) w.add('IFCSTYLEDITEM', [solido, [estilo(materialDe(peca.tipo))], $]);
    const mapa = w.add('IFCREPRESENTATIONMAP', [A3(), w.add('IFCSHAPEREPRESENTATION', [body, 'Body', tipo, solidos])]);
    const t: TipoGeo = { k, classe, mapa, ocorrencias: [], geo, tipoPeca: peca.tipo };
    tiposGeo.set(k, t);
    return t;
  };
  const corpoMapeado = (mapa: Ref) =>
    w.add('IFCPRODUCTDEFINITIONSHAPE', [$, $, [w.add('IFCSHAPEREPRESENTATION', [body, 'Body', 'MappedRepresentation', [w.add('IFCMAPPEDITEM', [mapa, alvo])]])]]);
  const colocacao = (relTo: Ref, peca: Peca, geo: Geometria) => {
    const ref = peca.giro ? D(direcaoDoGiro(peca.giro)) : null;
    return w.add('IFCLOCALPLACEMENT', [relTo, A3(P(ptm(pontoDeInsercao(peca, geo))), ref ? D([0, 0, 1]) : null, ref)]);
  };

  // ── separa as peças pelo dono ────────────────────────────────────────────────────────────────────────────────
  const idsVistos = new Map<string, number>();
  const idUnico = (id: string, o: 'peça' | 'barra') => {
    const n = idsVistos.get(o + id) ?? 0;
    idsVistos.set(o + id, n + 1);
    if (n === 0) return id;
    avisos.push(`${o} com id repetido: ${id} (exportada como ${id}~${n + 1})`);
    return `${id}~${n + 1}`;
  };
  interface Grupo { chave: string; nome: string; tag: string; objectType: string; pecas: Peca[]; trecho: number; contraforte?: number }
  const grupos = new Map<string, Grupo>();
  const soltas: Peca[] = [];
  for (const peca of modelo.pecas) {
    const classe = CLASSE[peca.tipo];
    if (classe === null) continue;                                    // terreno: nunca vai para o IFC
    if ((classe === 'DRENO' || classe === 'MANTA' || classe === 'BARBACA') && !info.drenagem) continue;
    if (classe !== 'PARTE') { soltas.push(peca); continue; }
    const cf = peca.grupo === 'contraforte' && peca.contraforte ? peca.contraforte : undefined;
    const chave = cf ? `contraforte/C${cf}` : `muro/T${peca.trecho}`;
    let g = grupos.get(chave);
    if (!g) {
      g = cf
        ? { chave, nome: `Contraforte C${cf}`, tag: `C${cf}`, objectType: 'CONTRAFORTE', pecas: [], trecho: peca.trecho, contraforte: cf }
        : { chave, nome: `Muro T${peca.trecho}`, tag: `T${peca.trecho}`, objectType: 'RETAININGWALL', pecas: [], trecho: peca.trecho };
      grupos.set(chave, g);
    }
    g.pecas.push(peca);
  }
  // muros antes dos contrafortes, cada um em ordem numérica: a ordem das entidades não pode depender da ordem
  // em que a modulação listou as peças além do necessário
  const ordemGrupo = (a: Grupo, b: Grupo) =>
    (a.contraforte ? 1 : 0) - (b.contraforte ? 1 : 0) || (a.contraforte ?? a.trecho) - (b.contraforte ?? b.trecho);

  const contidos: Ref[] = [];
  const tipoMuro = R.txt('Tipo_muro') ?? (modelo.dims.contrafortes.length ? 'Contrafortes' : 'Balanço');
  const ehBalanco = /^balan/i.test(tipoMuro);
  // graute a cada X cm (13/10): 20 = todos os furos
  const grX = R.num('Graute');
  const graute = grX !== null ? (grX <= 20 ? 'Todos os furos' : `A cada ${grX} cm`) : R.txt('Graute');
  const nomePorDono = new Map<string, string>();     // 'muro/T1' → 'Muro T1' (para AlRimo_Barra.Elemento)
  const contrafortesOrd = [...modelo.dims.contrafortes].sort((a, b) => a.x - b.x);

  const caixaDe = (pecas: Peca[]): Caixa | null => {
    let c: Caixa | null = null;
    for (const p of pecas) {
      const geo = modelo.geometrias[p.geometria];
      if (!geo) continue;
      const b = caixaDaPeca(p, geo);
      c = c ? { min: [0, 1, 2].map((k) => Math.min(c!.min[k], b.min[k])) as Vec3, max: [0, 1, 2].map((k) => Math.max(c!.max[k], b.max[k])) as Vec3 } : b;
    }
    return c;
  };

  for (const g of [...grupos.values()].sort(ordemGrupo)) {
    const pl = w.add('IFCLOCALPLACEMENT', [plPav, A3()]);
    const muro = w.add('IFCWALL', [G(g.chave), oh, g.nome, $, g.objectType, pl, $, g.tag, E('USERDEFINED')]);
    conta('IfcWall');
    contidos.push(muro);
    nomePorDono.set(g.chave, g.nome);

    const partes: Ref[] = [];
    for (const peca of g.pecas) {
      const geo = modelo.geometrias[peca.geometria];
      if (!geo) { avisos.push(`peça ${peca.id}: geometria '${peca.geometria}' não existe no modelo`); continue; }
      const tipo = tipoDaGeometria(peca, geo);
      if (!tipo) { avisos.push(`peça ${peca.id}: perfil ou extensão degenerados`); continue; }
      const id = idUnico(peca.id, 'peça');
      const parte = w.add('IFCBUILDINGELEMENTPART', [G('peca/' + id), oh, nomeDaPeca(peca.tipo, geo), $, peca.tipo,
        colocacao(pl, peca, geo), corpoMapeado(tipo.mapa), id, E('USERDEFINED')]);
      tipo.ocorrencias.push(parte);
      partes.push(parte);
      conta('IfcBuildingElementPart');
    }
    if (partes.length) w.add('IFCRELAGGREGATES', [G('rel/agrega/' + g.chave), oh, $, $, muro, partes]);

    // Psets do contêiner
    const cx = caixaDe(g.pecas);
    ligarPset('pset/' + g.chave + '/comum', 'Pset_WallCommon', [muro], [
      prop('Reference', 'IFCIDENTIFIER', g.contraforte ? 'Contraforte' : ehBalanco ? 'Arrimo em balanço' : 'Arrimo com contrafortes'),
      prop('IsExternal', 'IFCBOOLEAN', true),
      prop('LoadBearing', 'IFCBOOLEAN', true),
    ]);
    if (cx) {
      // altura a partir do topo da sapata (Z = 0), não do 1º bloco: a junta de assentamento da 1ª fiada é muro
      const dx = mm(cx.max[0] - cx.min[0]), dy = mm(cx.max[1] - cx.min[1]), dz = mm(cx.max[2]);
      // contraforte: o comprimento é a haste (Y) e a largura é a espessura (X); no muro é o contrário
      const [comp, larg] = g.contraforte ? [dy, dx] : [dx, mm(fam.t)];
      relProps('qto/' + g.chave, [muro], qto('qto/' + g.chave, 'Qto_WallBaseQuantities', [
        qLen('Length', comp), qLen('Width', larg), qLen('Height', dz), qArea('GrossSideArea', comp * dz), qVol('GrossVolume', comp * larg * dz),
      ]));
    }
    if (g.contraforte) {
      const cf = contrafortesOrd[g.contraforte - 1];
      ligarPset('pset/' + g.chave + '/alrimo', 'AlRimo_Contraforte', [muro], [
        prop('Numero', 'IFCINTEGER', I(g.contraforte)),
        cf ? prop('Ponta', 'IFCBOOLEAN', cf.ponta) : null,
        R.txt('pos_cf') ? prop('Posicao', 'IFCLABEL', R.txt('pos_cf')) : null,
        // o fpk da FLEXÃO do contraforte (vazado na seção T enterrada, prisma cheio na aparente), não o do muro
        seNum(R.num('fpk_cf'), (v) => prop('fpk', 'IFCPRESSUREMEASURE', v)),
        // família 14: o encaixe da haste no muro ainda não foi conferido com os modelos do Revit do José — o
        // arquivo sai dizendo isso, para ninguém tomar o travamento como projeto
        fam.provisoria ? prop('EncaixeProvisorio', 'IFCBOOLEAN', true) : null,
      ]);
    } else {
      ligarPset('pset/' + g.chave + '/alrimo', 'AlRimo_Muro', [muro], [
        prop('Tipo', 'IFCLABEL', tipoMuro),
        propPos('AlturaDeSolo', 'IFCPOSITIVELENGTHMEASURE', mm(modelo.dims.H_solo)),
        propPos('AlturaDoMuro', 'IFCPOSITIVELENGTHMEASURE', mm(modelo.dims.H_muro)),
        prop('Fiadas', 'IFCINTEGER', I(modelo.dims.n_fiadas)),
        prop('FamiliaDeBlocos', 'IFCLABEL', fam.nome),
        graute ? prop('Graute', 'IFCLABEL', graute) : null,
        seNum(fbk, (v) => prop('fbk', 'IFCPRESSUREMEASURE', v)),
        // fpk de quem trabalha: no balanço, o da flexão do muro; com contrafortes, o do painel entre eles
        seNum(R.num(ehBalanco ? 'fpk_' : 'fpk_pn'), (v) => prop('fpk', 'IFCPRESSUREMEASURE', v)),
      ]);
      // espaçamento das barras: só no balanço, onde s_adot e h_pan são exatamente o que foi detalhado
      // (s_adot = 0 sai da conta em alguns cenários: a propriedade fica de fora, ver propPos)
      const s = R.num('s_adot'), hp = R.num('h_pan');
      if (ehBalanco) {
        ligarPset('pset/' + g.chave + '/passo', 'Pset_ReinforcementBarPitchOfWall', [muro], [
          propPos('VerticalBarPitch', 'IFCPOSITIVELENGTHMEASURE', s === null ? null : s / 100),
          propPos('HorizontalBarPitch', 'IFCPOSITIVELENGTHMEASURE', hp),
        ]);
      }
    }
  }

  // ── sapata e drenagem: elementos de topo, com corpo próprio ────────────────────────────────────────────────
  for (const peca of soltas) {
    const geo = modelo.geometrias[peca.geometria];
    if (!geo) { avisos.push(`peça ${peca.id}: geometria '${peca.geometria}' não existe no modelo`); continue; }
    const tipo = tipoDaGeometria(peca, geo);
    if (!tipo) { avisos.push(`peça ${peca.id}: perfil ou extensão degenerados`); continue; }
    const id = idUnico(peca.id, 'peça');
    const pl = colocacao(plPav, peca, geo);
    const corpo = corpoMapeado(tipo.mapa);
    const classe = CLASSE[peca.tipo];
    let el: Ref;
    if (classe === 'SAPATA') {
      const nome = `Sapata corrida T${peca.trecho}`;
      el = w.add('IFCFOOTING', [G('peca/' + id), oh, nome, $, $, pl, corpo, id, E('STRIP_FOOTING')]);
      conta('IfcFooting');
      nomePorDono.set(`sapata/T${peca.trecho}`, nome);
      const area = areaDoPerfil(geo.perfil);
      const cx = caixaDaPeca(peca, geo);
      ligarPset('pset/' + id + '/comum', 'Pset_FootingCommon', [el], [prop('LoadBearing', 'IFCBOOLEAN', true)]);
      relProps('qto/' + id, [el], qto('qto/' + id, 'Qto_FootingBaseQuantities', [
        qLen('Length', mm(geo.extensao)),
        qLen('Width', mm(cx.max[1] - cx.min[1])),
        qLen('Height', mm(cx.max[2] - cx.min[2])),
        qArea('CrossSectionArea', area / 1e6),
        qVol('GrossVolume', geo.volume_mm3 / 1e9),
        qVol('NetVolume', geo.volume_mm3 / 1e9),
      ]));
    } else if (classe === 'BARBACA') {
      el = w.add('IFCPIPESEGMENT', [G('peca/' + id), oh, ROTULO[peca.tipo], $, $, pl, corpo, id, E('RIGIDSEGMENT')]);
      conta('IfcPipeSegment');
    } else if (classe === 'MANTA') {
      el = w.add('IFCCOVERING', [G('peca/' + id), oh, ROTULO[peca.tipo], $, $, pl, corpo, id, E('MEMBRANE')]);
      conta('IfcCovering');
    } else {
      el = w.add('IFCBUILDINGELEMENTPROXY', [G('peca/' + id), oh, ROTULO[peca.tipo], $, peca.tipo, pl, corpo, id, E('USERDEFINED')]);
      conta('IfcBuildingElementProxy');
    }
    tipo.ocorrencias.push(el);
    contidos.push(el);
  }

  // ── tipos de peça: Pset (em HasPropertySets), entidade do tipo, ligação tipo ↔ ocorrências ─────────────────
  for (const t of tiposGeo.values()) {
    if (!t || !t.ocorrencias.length) continue;
    const ehGraute = t.tipoPeca === 'GRAUTE_FURO' || t.tipoPeca === 'GRAUTE_CANALETA';
    const ehAlvenaria = t.classe === 'PARTE' && !ehGraute;
    const props: (Ref | null)[] = [
      prop('Quantidade', 'IFCINTEGER', I(t.ocorrencias.length)),
      prop('VolumePorPeca', 'IFCVOLUMEMEASURE', t.geo.volume_mm3 / 1e9),
    ];
    if (ehAlvenaria) {
      props.push(prop('Familia', 'IFCLABEL', fam.nome));
      if (t.geo.catalogo) props.push(prop('Catalogo', 'IFCLABEL', t.geo.catalogo));
      if (fbk !== null) props.push(prop('fbk', 'IFCPRESSUREMEASURE', fbk));
      // área líquida / bruta e área do furo: só fazem sentido na planta do bloco (extrusão vertical)
      const furos = t.geo.perfil.furos ?? [];
      if (t.geo.eixo === 'Z' && furos.length) {
        const bruta = Math.abs(areaAssinada(t.geo.perfil.contorno));
        props.push(propPos('AreaLiquidaSobreBruta', 'IFCPOSITIVERATIOMEASURE', areaDoPerfil(t.geo.perfil) / bruta));
        props.push(prop('AreaDoFuro', 'IFCAREAMEASURE', Math.max(...furos.map((f) => Math.abs(areaAssinada(f)))) / 1e6));
      }
    }
    if (ehGraute && fgk !== null) props.push(prop('fgk', 'IFCPRESSUREMEASURE', fgk));
    const ps = pset('pset/tipo/geo/' + t.k, ehAlvenaria ? 'AlRimo_Bloco' : ehGraute ? 'AlRimo_Graute' : 'AlRimo_Peca', props)!;
    const gid = G('tipo/geo/' + t.k);
    const nome = nomeDaPeca(t.tipoPeca, t.geo);
    const comum = [gid, oh, nome, $, $, [ps], [t.mapa], $] as Arg[];
    const ref =
      t.classe === 'PARTE' ? w.add('IFCBUILDINGELEMENTPARTTYPE', [...comum, ROTULO[t.tipoPeca], E('USERDEFINED')])
        : t.classe === 'SAPATA' ? w.add('IFCFOOTINGTYPE', [...comum, $, E('STRIP_FOOTING')])
          : t.classe === 'BARBACA' ? w.add('IFCPIPESEGMENTTYPE', [...comum, $, E('RIGIDSEGMENT')])
            : t.classe === 'MANTA' ? w.add('IFCCOVERINGTYPE', [...comum, $, E('MEMBRANE')])
              : w.add('IFCBUILDINGELEMENTPROXYTYPE', [...comum, ROTULO[t.tipoPeca], E('USERDEFINED')]);
    associaMaterial(materialDe(t.tipoPeca), ref);
    w.add('IFCRELDEFINESBYTYPE', [G('rel/tipo/geo/' + t.k), oh, $, $, t.ocorrencias, ref]);
  }

  // ── barras ───────────────────────────────────────────────────────────────────────────────────────────────────
  const porPosicao = new Map<string, Barra[]>();
  for (const b of modelo.barras) {
    const l = porPosicao.get(b.posicao) ?? [];
    l.push(b);
    porPosicao.set(b.posicao, l);
  }
  const barrasPorDono = new Map<string, Ref[]>();
  // barra da sapata é da sapata mesmo que a modulação a marque com o contraforte de cima (torção, por exemplo)
  const donoDaBarra = (b: Barra): string => {
    if (b.papel.startsWith('SAP_')) return `sapata/T${b.trecho}`;
    if (b.contraforte) return `contraforte/C${b.contraforte}`;
    return `muro/T${b.trecho}`;
  };
  const curvaDaBarra = (pts: Vec3[], segs: ReturnType<typeof eixoDaBarra>) => {
    const lst = w.add('IFCCARTESIANPOINTLIST3D', [pts.map(ptm)]);
    const s = segs!.segmentos.map((g) => T(g.tipo === 'linha' ? 'IFCLINEINDEX' : 'IFCARCINDEX', g.idx.map((i) => I(i))));
    return w.add('IFCINDEXEDPOLYCURVE', [lst, s, E('F')]);
  };
  const disco = (b: Barra, relativo: Vec3) => {
    if (!positivo(mm(b.diametro) / 2)) return null;   // Radius é IfcPositiveLengthMeasure
    const pts = b.eixo.map((p) => [p[0] - relativo[0], p[1] - relativo[1], p[2] - relativo[2]] as Vec3);
    const e = eixoDaBarra(pts, b.diametro, b.fechada);
    if (!e) return null;
    const solido = w.add('IFCSWEPTDISKSOLID', [curvaDaBarra(e.pontos, e), mm(b.diametro) / 2, $, $, $]);
    w.add('IFCSTYLEDITEM', [solido, [estilo('aco')], $]);
    return solido;
  };
  // é a mesma barra, só transladada? (mesma bitola, mesmo nº de pontos, mesma diferença ponto a ponto)
  const copiaTransladada = (a: Barra, b: Barra) =>
    a.diametro === b.diametro && !!a.fechada === !!b.fechada && a.eixo.length === b.eixo.length &&
    a.eixo.every((p, i) => [0, 1, 2].every((k) => Math.abs((p[k] - a.eixo[0][k]) - (b.eixo[i][k] - b.eixo[0][k])) <= 0.01));

  for (const [posicao, barras] of [...porPosicao].sort(([a], [b]) => compararNatural(a, b))) {
    // o molde da posição é a 1ª barra que dá sólido; uma barra ruim não derruba a posição inteira
    let mod: Barra | undefined;
    let solido: Ref | null = null;
    for (const b of barras) {
      solido = b.eixo.length >= 2 ? disco(b, b.eixo[0]) : null;
      if (solido) { mod = b; break; }
    }
    if (!mod || !solido) { avisos.push(`posição ${posicao}: nenhuma barra com eixo e Ø válidos`); continue; }
    const mapa = w.add('IFCREPRESENTATIONMAP', [A3(), w.add('IFCSHAPEREPRESENTATION', [body, 'Body', 'AdvancedSweptSolid', [solido]])]);
    const d = mm(mod.diametro);
    const area = (Math.PI * d * d) / 4;
    const comp = mm(mod.comprimento);
    const enumTipo = mod.papel === 'SAP_TORCAO' && mod.fechada ? 'SHEAR' : TIPO_BARRA[mod.papel];
    const nomeTipo = `${posicao} Ø${fmt(mod.diametro)} C=${Math.round(mod.comprimento / 10)}`;
    const kgm = massaLinear(mod.diametro);
    const psTipo = pset('pset/tipo/barra/' + posicao, 'Pset_ReinforcingBarCommon', [
      prop('Reference', 'IFCIDENTIFIER', posicao),
      propPos('NominalDiameter', 'IFCPOSITIVELENGTHMEASURE', d),
      propPos('BarLength', 'IFCPOSITIVELENGTHMEASURE', comp),
    ])!;
    const psAlRimo = pset('pset/tipo/barra/' + posicao + '/alrimo', 'AlRimo_Posicao', [
      prop('Posicao', 'IFCLABEL', posicao),
      // o mesmo N pode servir a mais de um elemento (barra igual = mesma posição, modulacao/barras.ts)
      prop('Papel', 'IFCLABEL', [...new Set(barras.map((b) => b.papel))].join(' + ')),
      prop('Quantidade', 'IFCINTEGER', I(barras.length)),
      prop('PesoTotal', 'IFCMASSMEASURE', kgm * comp * barras.length),
    ])!;
    const qtTipo = qto('qto/tipo/barra/' + posicao, 'Qto_ReinforcingElementBaseQuantities', [
      qLen('Length', comp), qPeso('Weight', kgm * comp),
    ]);
    const tipo = w.add('IFCREINFORCINGBARTYPE', [G('tipo/barra/' + posicao), oh, nomeTipo, $, $, [psTipo, psAlRimo, qtTipo], [mapa], posicao,
      $, E(enumTipo), d, area, positivo(comp) ? comp : null, E('TEXTURED'), $, $]);
    associaMaterial('aco', tipo);

    const ocorrencias: Ref[] = [];
    for (const b of barras) {
      const id = idUnico(b.id, 'barra');
      let corpo: Ref | null;
      let origem: Vec3;
      if (b === mod || copiaTransladada(mod, b)) {
        origem = b.eixo[0];
        corpo = corpoMapeado(mapa);
      } else {
        // barra da mesma posição que não é cópia transladada do molde: leva a própria curva (continua exata)
        if (b.eixo.length < 2) { avisos.push(`barra ${b.id}: sem eixo`); continue; }
        origem = b.eixo[0];
        const s = disco(b, origem);
        if (!s) { avisos.push(`barra ${b.id}: eixo degenerado ou Ø inválido`); continue; }
        corpo = w.add('IFCPRODUCTDEFINITIONSHAPE', [$, $, [w.add('IFCSHAPEREPRESENTATION', [body, 'Body', 'AdvancedSweptSolid', [s]])]]);
      }
      const pl = w.add('IFCLOCALPLACEMENT', [plPav, A3(P(ptm(origem)))]);
      const barra = w.add('IFCREINFORCINGBAR', [G('barra/' + id), oh, `${posicao} Ø${fmt(b.diametro)}`, $, $, pl, corpo, id,
        $, $, $, $, E(enumTipo), $]);
      ocorrencias.push(barra);
      contidos.push(barra);
      conta('IfcReinforcingBar');
      const dono = donoDaBarra(b);
      const l = barrasPorDono.get(dono) ?? [];
      l.push(barra);
      barrasPorDono.set(dono, l);
    }
    if (ocorrencias.length) w.add('IFCRELDEFINESBYTYPE', [G('rel/tipo/barra/' + posicao), oh, $, $, ocorrencias, tipo]);
  }
  // um Pset por dono, listando todas as barras dele: barato (2 linhas por dono, não por barra)
  for (const [dono, barras] of [...barrasPorDono].sort(([a], [b]) => compararNatural(a, b))) {
    // o dono pode não ter virado elemento (contraforte sem peça, sapata ausente): o nome sai do mesmo jeito
    const [cl, n] = dono.split('/');
    const nome = nomePorDono.get(dono) ?? `${cl === 'sapata' ? 'Sapata corrida' : cl === 'contraforte' ? 'Contraforte' : 'Muro'} ${n}`;
    ligarPset('pset/barra/' + dono, 'AlRimo_Barra', barras, [prop('Elemento', 'IFCLABEL', nome)]);
  }

  // ── materiais nos tipos (um vínculo por material, não por peça) ───────────────────────────────────────────
  for (const [m, tipos] of tiposPorMaterial) {
    w.add('IFCRELASSOCIATESMATERIAL', [G('rel/material/' + m), oh, $, $, tipos, material(m)]);
  }

  if (contidos.length) w.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [G('rel/contido'), oh, $, $, contidos, pav]);

  const texto = w.texto({
    nomeArquivo: info.nomeArquivo ?? nomeDeArquivo(info.projeto),
    agora: quando.texto,
    autor: info.autor ?? '',
    versao: modelo.versao,
  });
  return { texto, entidades: w.total, contagem, avisos };
}

/** Número curto para nome: 10 → '10', 12.5 → '12,5' (vírgula: é nome que o engenheiro lê). */
/**
 * Ordem 'N1' < 'N2' < 'N10' sem Intl: localeCompare depende dos dados de idioma de cada navegador/Node, e a ordem
 * das entidades não pode mudar de máquina para máquina (mesmo muro → mesmo arquivo).
 */
export function compararNatural(a: string, b: string): number {
  const ta = a.match(/\d+|\D+/g) ?? [], tb = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    const x = ta[i], y = tb[i];
    const nx = /^\d/.test(x), ny = /^\d/.test(y);
    if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (x !== y) return x < y ? -1 : 1;
  }
  return ta.length - tb.length;
}

function fmt(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace('.', ',');
}

export function nomeDeArquivo(projeto: string): string {
  const base = projeto.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return (base || 'muro') + '.ifc';
}
