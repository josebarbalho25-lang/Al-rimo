// ═══════════════════════════════════════════════════════════════════════════
//  visor/cena3d.ts — o muro montado em objetos do three, fora do React
// ---------------------------------------------------------------------------
//  Monta TUDO o que se desenha (um InstancedMesh por lote, o traço instanciado
//  de cada lote, um tubo juntado por Ø) e guarda o mapa clique → peça. Fica
//  fora do React de propósito: o Visor3D só pendura o grupo na cena e chama
//  aplicarX(); e o teste no Node monta a mesma cena, conta as chamadas de
//  desenho e dispara o raio de verdade, sem WebGL.
//
//  ⚠️ COR DA INSTÂNCIA CRIADA ANTES DO 1º QUADRO. O three decide o shader
//  pelo `instanceColor !== null` (WebGLPrograms.js); se a cor nascer só no
//  primeiro clique, a seleção não aparece até recompilar. Por isso todas as
//  instâncias ganham a cor de base aqui, e o material fica BRANCO (a cor
//  final é material × instância: com o material branco, o azul da seleção
//  sai exato).
//
//  ⚠️ O RAIO DO three NÃO RESPEITA O CORTE NEM O `visible`. Quem filtra é o
//  `pegar`: só entra no raio o que está aceso, e o acerto do lado cortado é
//  descartado (o clique atravessa o que não se vê).
//
//  ⚠️ O ESTILO (Cores, Realista, Opaco — `estiloVisual.ts`) TROCA SÓ MATERIAL
//  E COR. A malha, a matriz e o mapa do clique são os mesmos: por isso a
//  seleção, a Armadura e o corte valem nos três sem nenhum caso especial.
//
//  ⚠️ ARMADURA (Jose, 14/10 — era o Raio-X): como o "visualizar desobstruído"
//  do Revit. As peças NÃO mudam (o vidro do Raio-X mostrava as arestas de
//  trás de todos os blocos: poluído); a barra sai por cima de bloco, graute e
//  sapata, de qualquer ângulo, na cor da bitola (coresDasBitolas.ts).
//  COMO: depois de tudo, um objeto vazio APAGA a profundidade (`clearDepth`)
//  e as barras vêm em seguida, com teste de profundidade só entre elas e com
//  luz — uma barra esconde a outra direito e o tubo tem volume (Jose: "ficaram
//  muito chapadas"; sem teste nenhum, a barra de trás pintava por cima da da
//  frente). Tudo na fila do transparente, para vir também depois do véu do
//  terreno, que é transparente. Fica melhor no Opaco.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { Barra, ClassePeca, Modelo, Peca, Vec3 } from '@/modelo/tipos';
import { barraDoTriangulo, montarBarras, type LoteDeBarras } from './barras3d';
import { corDaPeca, corDoAco, ESTILO_PADRAO, opacidadeDoTerreno, tracoDoEstilo, type EstiloVisual } from './estiloVisual';
import { materialDoAcabamento, materialDoAco, texturaDaPele, type FonteDasPeles } from './materiaisDoEstilo';
import { caixaDaPeca, caixaLocal, MM, arestasDaGeometria, moldeDaGeometria, type Caixa } from './perfil3d';
import { emMetro, montarLotes, unirCaixas, visivel, type Acabamento, type Categoria, type Lote } from './lotes';
import type { PaletaVisor } from './tema3d';
import { corDaBitola } from './coresDasBitolas';
import { opacidadeDe, type Material } from '@/desenhos/graficos';

/** Acabamentos que levam traço. Graute (empilhado por fiada) riscaria o pilar de linhas a cada 20 cm. */
const COM_ARESTA: ReadonlySet<Acabamento> = new Set(['alvenaria', 'concreto']);
/** Ordem de desenho na Armadura: o apagador da profundidade (9) e as barras (10), depois de tudo (peças 0, traço 2). */
const ORDEM_DA_ARMADURA = 10;

export type Pego = { tipo: 'peca'; peca: Peca } | { tipo: 'barra'; barra: Barra };

type MaterialDaPeca = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

interface MalhaDoLote {
  lote: Lote;
  malha: THREE.InstancedMesh;
  traco: THREE.LineSegments | null;
  /** Só alvenaria: a classe do bloco (pinta no estilo Cores e entra na legenda). */
  classe: ClassePeca | undefined;
}

interface MalhaDeBarras {
  lote: LoteDeBarras;
  malha: THREE.Mesh;
}

export interface Cena3D {
  /** Pendurar na cena (`<primitive object={grupo} />`). */
  grupo: THREE.Group;
  lotes: readonly MalhaDoLote[];
  barras: readonly MalhaDeBarras[];
  /** Peças sem geometria no modelo (defeito da modulação): não desenhadas. */
  semGeometria: readonly string[];
  /** O que o id é: peça ou barra. */
  achar(id: string): Pego | null;
  aplicarPaleta(p: PaletaVisor): void;
  /** Troca material e cor de tudo (seleção, Armadura, corte e o que está oculto continuam como estavam). */
  aplicarEstilo(e: EstiloVisual): void;
  aplicarVisibilidade(ocultas: ReadonlySet<Categoria>): void;
  /** A armadura por cima de tudo, na cor da bitola (o "desobstruído" do Revit). */
  aplicarArmadura(ligada: boolean): void;
  /** Os Ø das barras acesas com estes grupos ocultos (a legenda da Armadura). */
  diametrosVisiveis(ocultas: ReadonlySet<Categoria>): number[];
  aplicarCorte(planos: readonly THREE.Plane[]): void;
  pintarSelecao(id: string | null): void;
  /** O id do primeiro acerto VISÍVEL do raio (respeita ocultar e corte; na Armadura, a barra vem antes da peça). */
  pegar(raio: THREE.Raycaster): string | null;
  /** Envoltória do que está aceso (sem o terreno), metro. */
  caixaVisivel(): Caixa;
  /** Envoltória de tudo, terreno junto (a câmera da sombra cobre o chão também), metro. */
  caixaTotal(): Caixa;
  /**
   * As classes de bloco que ficam acesas com estes grupos ocultos — a legenda do
   * Cores mostra só estas. Recebe o conjunto (em vez de ler o `visible` das
   * malhas) porque o React pergunta ANTES de a visibilidade nova ser aplicada.
   */
  classesVisiveis(ocultas: ReadonlySet<Categoria>): Set<ClassePeca>;
  /** Centro da peça ou barra, metro — o pivô do giro com Shift. */
  centroDe(id: string): Vec3 | null;
  /**
   * O traço das peças desbota quando o bloco fica miúdo na tela: de longe, 5.000
   * blocos com aresta viram um tecido de linhas (moiré) que esconde o muro.
   * Recebe pixels por metro (o zoom da câmera ortográfica).
   */
  aplicarZoom(pxPorMetro: number): void;
  /** Objetos que viram chamada de desenho agora (malhas e traços acesos). */
  chamadasDeDesenho(): number;
  dispose(): void;
}

/*
  ⚠️ O TRAÇO É INSTANCIADO, COMO O SÓLIDO. As arestas de cada FORMA são tiradas
  uma vez (`arestasDoMolde`) e a placa de vídeo as repete em cada peça com a
  MESMA matriz da instância do sólido (o atributo é literalmente o mesmo
  objeto: um buffer só na placa). Antes o traço era juntado — as arestas de
  todas as 7.000 peças copiadas num buffer só, refeito a cada muro novo; no
  Opaco, em que o traço é o desenho, isso pesava na memória e na montagem.
  O three não tem "LineSegments instanciado" pronto: a linha usa geometria
  instanciada e o material liga o trecho de instância do shader dele mesmo
  (`USE_INSTANCING`, o mesmo que o InstancedMesh liga).
*/
function materialDoTraco(): THREE.LineBasicMaterial {
  const m = new THREE.LineBasicMaterial({ transparent: true });
  m.defines = { USE_INSTANCING: '' };
  return m;
}

function tracoInstanciado(arestas: THREE.BufferAttribute, malha: THREE.InstancedMesh, material: THREE.LineBasicMaterial): THREE.LineSegments {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', arestas);
  g.setAttribute('instanceMatrix', malha.instanceMatrix);
  g.instanceCount = malha.count;
  const traco = new THREE.LineSegments(g, material);
  // A caixa da geometria é a de UMA peça na origem: o corte por enquadramento apagaria o traço do muro inteiro.
  traco.frustumCulled = false;
  traco.renderOrder = 2;
  return traco;
}

/** O que só a foto refeita muda na montagem (o visor usa o padrão). */
export interface OpcoesDaCena {
  /** De onde vêm as texturas do Realista (ver `pelesProprias` em materiaisDoEstilo.ts). */
  peles?: FonteDasPeles;
}

export function construirCena3D(modelo: Modelo, paleta: PaletaVisor, estiloInicial: EstiloVisual = ESTILO_PADRAO, opcoes: OpcoesDaCena = {}): Cena3D {
  const peles = opcoes.peles ?? texturaDaPele;
  const grupo = new THREE.Group();
  grupo.name = 'muro';
  const { lotes: brutos, semGeometria } = montarLotes(modelo);
  const pecaPorId = new Map<string, Peca>();
  for (const p of modelo.pecas) pecaPorId.set(p.id, p);
  const barraPorId = new Map<string, Barra>();
  for (const b of modelo.barras) barraPorId.set(b.id, b);

  // ── Estado aplicado ──
  let estilo = estiloInicial;
  let paletaAtual = paleta;
  let ocultas: ReadonlySet<Categoria> = new Set();
  let armadura = false;
  let planos: readonly THREE.Plane[] = [];
  let selecionado: string | null = null;

  /*
    ── Materiais: um por estilo × acabamento, criados na primeira vez que o
    estilo aparece e guardados (voltar a um estilo não recompila nada). Quem
    nasce depois já nasce com o corte do momento.
  */
  /*
    Um material por estilo × acabamento × CLASSE do bloco: a transparência da tabela de gráficos do 3D (Jose, 15/10:
    "transparências por vista, igual no A-PORT") é do material, e o inteiro pode ficar transparente com a canaleta
    cheia. A cor do bloco continua por instância (a seleção pinta um bloco só).
  */
  const materiais = new Map<EstiloVisual, Map<string, { m: MaterialDaPeca; a: Acabamento; classe?: ClassePeca }>>();
  const acos = new Map<EstiloVisual, MaterialDaPeca>();
  /**
   * O que multiplica a transparência da linha do material: o véu do terreno (do estilo) e, no bloco de classe, a
   * linha "Alvenaria" — ela vale para todo bloco, como a categoria por cima das subcategorias do A-PORT (sem isso a
   * linha não mexia em nada: todo bloco do catálogo tem classe).
   */
  const veuDe = (e: EstiloVisual, a: Acabamento, classe?: ClassePeca): number =>
    a === 'terreno' ? opacidadeDoTerreno(e) : a === 'alvenaria' && classe ? opacidadeDe('alvenaria', '3d') : 1;
  /** O material da tabela de gráficos de um acabamento (o bloco pela classe). */
  const daTabela = (a: Acabamento, classe?: ClassePeca): Material => (a === 'alvenaria' ? (classe ?? 'alvenaria') : a === 'terreno' ? 'terra' : a);
  /**
   * A transparência do material: a da tabela do 3D, vezes o véu do terreno (o terreno é só referência e nunca tapa o
   * muro, em estilo nenhum — a opacidade dele é a do estilo DONO do material). Transparente não escreve
   * profundidade: o que está atrás aparece. Vale no Realista também (ver através do solo é olhar, não pintar).
   */
  const ajustarTransparencia = (m: THREE.Material, mat: Material, veu = 1) => {
    const op = veu * opacidadeDe(mat, '3d');
    const transparente = op < 1;
    if (m.transparent !== transparente) m.needsUpdate = true;
    m.transparent = transparente;
    m.opacity = op;
    m.depthWrite = !transparente;
  };
  const material = (e: EstiloVisual, a: Acabamento, classe?: ClassePeca): MaterialDaPeca => {
    let doEstilo = materiais.get(e);
    if (!doEstilo) materiais.set(e, (doEstilo = new Map()));
    const chave = `${a}|${classe ?? ''}`;
    let q = doEstilo.get(chave);
    if (!q) {
      doEstilo.set(chave, (q = { m: materialDoAcabamento(e, a, peles), a, classe }));
      q.m.clippingPlanes = planos.length ? [...planos] : null;
      ajustarTransparencia(q.m, daTabela(a, classe), veuDe(e, a, classe));
    }
    return q.m;
  };
  const aco = (e: EstiloVisual): MaterialDaPeca => {
    let m = acos.get(e);
    if (!m) {
      acos.set(e, (m = materialDoAco(e)));
      m.clippingPlanes = planos.length ? [...planos] : null;
      ajustarTransparencia(m, 'aco');
    }
    return m;
  };
  /** A tabela mudou: a transparência de todos os materiais já criados (os de outros estilos também). */
  const reaplicarTransparencias = () => {
    for (const [e, doEstilo] of materiais) {
      for (const q of doEstilo.values()) ajustarTransparencia(q.m, daTabela(q.a, q.classe), veuDe(e, q.a, q.classe));
    }
    for (const m of acos.values()) ajustarTransparencia(m, 'aco');
  };
  const tracoComum = materialDoTraco();
  /*
    O aço da Armadura: com luz (o tubo tem volume) e com profundidade ENTRE as barras; o que está na frente delas não
    conta porque o apagador limpa a profundidade logo antes (ver o cabeçalho). Transparente com opacidade 1 só para
    entrar na fila do transparente, depois do véu do terreno.
  */
  const acoDaArmadura = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 1 });
  const apagador = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true }),
  );
  apagador.name = 'armadura: apaga a profundidade';
  apagador.frustumCulled = false;
  apagador.renderOrder = ORDEM_DA_ARMADURA - 1;
  apagador.visible = false;
  apagador.onBeforeRender = (renderer) => renderer.clearDepth();

  // ── Moldes: um por Geometria usada (o sólido e as arestas dele) ──
  const moldes = new Map<string, { geo: THREE.BufferGeometry; arestas: THREE.BufferAttribute }>();
  const molde = (chave: string) => {
    let m = moldes.get(chave);
    if (!m) {
      const geo = moldeDaGeometria(modelo.geometrias[chave]!);
      moldes.set(chave, (m = { geo, arestas: new THREE.BufferAttribute(arestasDaGeometria(modelo.geometrias[chave]!, geo), 3) }));
    }
    return m;
  };

  const cor = new THREE.Color();
  const indicePorId = new Map<string, { malha: MalhaDoLote; i: number }>();
  const lotes: MalhaDoLote[] = brutos.map((lote) => {
    const m = molde(lote.geometria);
    const n = lote.ids.length;
    const classeDoLote = lote.acabamento === 'alvenaria' ? modelo.geometrias[lote.geometria]?.classe : undefined;
    const malha = new THREE.InstancedMesh(m.geo, material(estilo, lote.acabamento, classeDoLote), n);
    malha.instanceMatrix.array.set(lote.matrizes);
    malha.instanceMatrix.needsUpdate = true;
    // A cor nasce aqui (ver o cabeçalho); o tom certo vem no `aplicarEstilo` logo abaixo.
    for (let i = 0; i < n; i++) malha.setColorAt(i, cor);
    malha.computeBoundingSphere();
    malha.computeBoundingBox();
    malha.name = lote.chave;
    const traco = COM_ARESTA.has(lote.acabamento) && m.arestas.count ? tracoInstanciado(m.arestas, malha, tracoComum) : null;
    if (traco) traco.name = `${lote.chave} traço`;
    const classe = classeDoLote;
    const ml: MalhaDoLote = { lote, malha, traco, classe };
    lote.ids.forEach((id, i) => indicePorId.set(id, { malha: ml, i }));
    grupo.add(malha);
    if (traco) grupo.add(traco);
    return ml;
  });

  const faixaPorId = new Map<string, { malha: MalhaDeBarras; ini: number; fim: number }>();
  const barras: MalhaDeBarras[] = montarBarras(modelo.barras).map((lote) => {
    const nv = lote.geometria.getAttribute('position').count;
    lote.geometria.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    const malha = new THREE.Mesh(lote.geometria, aco(estilo));
    malha.name = `barras ${lote.chave}`;
    const mb: MalhaDeBarras = { lote, malha };
    for (const f of lote.faixas) faixaPorId.set(f.id, { malha: mb, ini: f.vIni, fim: f.vFim });
    grupo.add(malha);
    return mb;
  });
  grupo.add(apagador);

  const corDoLote = (l: MalhaDoLote) => corDaPeca(estilo, paletaAtual, l.lote.acabamento, l.classe);

  const pintarBarra = (id: string, hex: string) => {
    const f = faixaPorId.get(id);
    if (!f) return;
    const a = f.malha.lote.geometria.getAttribute('color') as THREE.BufferAttribute;
    cor.set(hex);
    for (let v = f.ini; v < f.fim; v++) a.setXYZ(v, cor.r, cor.g, cor.b);
    a.needsUpdate = true;
  };
  const pintarPeca = (id: string, hex: string) => {
    const k = indicePorId.get(id);
    if (!k) return;
    cor.set(hex);
    k.malha.malha.setColorAt(k.i, cor);
    k.malha.malha.instanceColor!.needsUpdate = true;
  };
  const corDaBarra = (b: MalhaDeBarras) => (armadura ? corDaBitola(b.lote.diametro) : corDoAco(estilo));
  const corBaseDe = (id: string): string | null => {
    const k = indicePorId.get(id);
    if (k) return corDoLote(k.malha);
    const f = faixaPorId.get(id);
    return f ? corDaBarra(f.malha) : null;
  };
  const pintar = (id: string, hex: string) => {
    if (indicePorId.has(id)) pintarPeca(id, hex);
    else pintarBarra(id, hex);
  };

  /** Repinta TODA a cena com as cores do estilo e da paleta atuais (a seleção volta por cima). */
  const repintar = () => {
    for (const l of lotes) {
      cor.set(corDoLote(l));
      for (let i = 0; i < l.lote.ids.length; i++) l.malha.setColorAt(i, cor);
      l.malha.instanceColor!.needsUpdate = true;
    }
    for (const b of barras) {
      cor.set(corDaBarra(b));
      const a = b.lote.geometria.getAttribute('color') as THREE.BufferAttribute;
      for (let v = 0; v < a.count; v++) a.setXYZ(v, cor.r, cor.g, cor.b);
      a.needsUpdate = true;
    }
    const t = tracoDoEstilo(estilo, paletaAtual);
    if (t) tracoComum.color.set(t.cor);
    if (selecionado) pintar(selecionado, paletaAtual.selecionado);
  };

  /*
    ⚠️ A SOMBRA É SÓ DO REALISTA, e só de quem é sólido de verdade: o terreno é véu (não faz sombra, só a recebe).
    Na Armadura a barra é chapada e fica por cima: nem faz nem recebe sombra.
  */
  /** A peça que a tabela apagou de todo (100 % transparente): some de verdade — sem clique, traço nem sombra. */
  const apagada = (m: THREE.Material | THREE.Material[]): boolean => !Array.isArray(m) && m.opacity <= 0;

  const ajustarSombras = () => {
    const comSombra = estilo === 'realista';
    for (const l of lotes) {
      l.malha.receiveShadow = comSombra;
      // o three faz a sombra pela forma, sem olhar a opacidade: a peça invisível ainda escurecia o chão
      l.malha.castShadow = comSombra && l.lote.acabamento !== 'terreno' && !apagada(l.malha.material);
    }
    for (const b of barras) b.malha.castShadow = b.malha.receiveShadow = comSombra && !armadura && !apagada(b.malha.material);
  };
  /** O traço do lote: com o estilo que tem traço, aceso e não apagado pela tabela. */
  const ajustarTracos = () => {
    const comTraco = !!tracoDoEstilo(estilo, paletaAtual);
    for (const l of lotes) if (l.traco) l.traco.visible = comTraco && l.malha.visible && !apagada(l.malha.material);
  };

  let ultimoZoom: number | null = null;
  const aplicarEstilo = (e: EstiloVisual) => {
    estilo = e;
    for (const l of lotes) l.malha.material = material(e, l.lote.acabamento, l.classe);
    for (const b of barras) b.malha.material = armadura ? acoDaArmadura : aco(e);
    ajustarTracos();
    repintar();
    ajustarSombras();
    // O traço desbota em outra faixa de zoom em cada estilo: refaz com o último zoom visto (antes do
    // primeiro quadro, ainda sem zoom, nasce inteiro).
    fatorDoTraco = -1;
    aplicarZoom(ultimoZoom ?? Infinity);
  };

  /** A paleta do tema ou a tabela de gráficos mudou: as cores e a transparência de tudo. */
  const aplicarPaleta = (p: PaletaVisor) => {
    paletaAtual = p;
    reaplicarTransparencias();
    ajustarTracos();
    ajustarSombras();
    repintar();
  };

  const aplicarVisibilidade = (o: ReadonlySet<Categoria>) => {
    ocultas = o;
    for (const l of lotes) l.malha.visible = visivel(l.lote.categorias, o);
    ajustarTracos();
    for (const b of barras) b.malha.visible = visivel(b.lote.categorias, o);
  };

  const aplicarArmadura = (ligada: boolean) => {
    armadura = ligada;
    apagador.visible = ligada;
    for (const b of barras) {
      b.malha.material = ligada ? acoDaArmadura : aco(estilo);
      b.malha.renderOrder = ligada ? ORDEM_DA_ARMADURA : 0;
    }
    repintar();
    ajustarSombras();
  };

  const diametrosVisiveis = (o: ReadonlySet<Categoria>): number[] =>
    [...new Set(barras.filter((b) => visivel(b.lote.categorias, o)).map((b) => b.lote.diametro))].sort((a, b) => a - b);

  const todosOsMateriais = (): THREE.Material[] => {
    const ms: THREE.Material[] = [tracoComum, acoDaArmadura, apagador.material, ...acos.values()];
    for (const doEstilo of materiais.values()) for (const q of doEstilo.values()) ms.push(q.m);
    return ms;
  };
  const aplicarCorte = (ps: readonly THREE.Plane[]) => {
    const mudouQuantidade = ps.length !== planos.length;
    planos = ps;
    for (const m of todosOsMateriais()) {
      m.clippingPlanes = ps.length ? [...ps] : null;
      // ⚠️ Mudar QUANTOS planos exige recompilar o shader (lição do A-PORT,
      // `MassaDaPeca.tsx`). Arrastar o mesmo plano, não: o three lê a posição a cada quadro.
      if (mudouQuantidade) m.needsUpdate = true;
    }
  };

  let fatorDoTraco = 1;
  const aplicarZoom = (pxPorMetro: number) => {
    if (Number.isFinite(pxPorMetro)) ultimoZoom = pxPorMetro;
    const t = tracoDoEstilo(estilo, paletaAtual);
    if (!t) return;
    // Fiada de 20 cm: o traço some abaixo de `some` px por fiada e volta inteiro a partir de `cheio`.
    const f = Math.min(1, Math.max(0, (pxPorMetro * 0.2 - t.some) / (t.cheio - t.some)));
    if (f === fatorDoTraco) return;
    fatorDoTraco = f;
    tracoComum.opacity = t.opacidade * f;
    // Traço apagado não é desenhado (economiza a chamada de desenho de longe).
    tracoComum.visible = f > 0;
  };

  const pintarSelecao = (id: string | null) => {
    if (selecionado && selecionado !== id) {
      const base = corBaseDe(selecionado);
      if (base) pintar(selecionado, base);
    }
    selecionado = id && corBaseDe(id) ? id : null;
    if (selecionado) pintar(selecionado, paletaAtual.selecionado);
  };

  // a peça 100 % transparente não segura o clique (some da tela, some do mouse)
  const pegavel = (l: MalhaDoLote) => l.malha.visible && l.lote.acabamento !== 'terreno' && !apagada(l.malha.material);
  const barraPegavel = (b: MalhaDeBarras) => b.malha.visible && !apagada(b.malha.material);

  const pegar = (raio: THREE.Raycaster): string | null => {
    // Na Armadura a barra está por cima de tudo na tela: o clique acha a barra antes da peça que está na frente dela.
    if (armadura) {
      const daBarra = pegarEm(raio, barras.filter((b) => b.malha.visible).map((b) => b.malha));  // a Armadura é chapada: nunca apagada
      if (daBarra) return daBarra;
    }
    const alvos: THREE.Object3D[] = [];
    for (const l of lotes) if (pegavel(l)) alvos.push(l.malha);
    for (const b of barras) if (barraPegavel(b)) alvos.push(b.malha);
    return pegarEm(raio, alvos);
  };

  const pegarEm = (raio: THREE.Raycaster, alvos: THREE.Object3D[]): string | null => {
    if (!alvos.length) return null;
    for (const h of raio.intersectObjects(alvos, false)) {
      // O lado cortado não existe para o clique (meio milímetro de tolerância, a folga do corte).
      if (planos.some((p) => p.distanceToPoint(h.point) < -5e-4)) continue;
      if (h.object instanceof THREE.InstancedMesh) {
        const l = lotes.find((x) => x.malha === h.object);
        const id = l && h.instanceId !== undefined ? l.lote.ids[h.instanceId] : undefined;
        if (id) return id;
      } else {
        const b = barras.find((x) => x.malha === h.object);
        const f = b && h.faceIndex != null ? barraDoTriangulo(b.lote.faixas, h.faceIndex) : null;
        if (f) return f.id;
      }
    }
    return null;
  };

  const caixaDasBarras = (b: MalhaDeBarras): Caixa | null => {
    const bb = b.lote.geometria.boundingBox;
    return bb ? { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] } : null;
  };

  const caixaVisivel = (): Caixa => {
    const acesas = (comTerreno: boolean): Caixa[] => {
      const cs: Caixa[] = [];
      for (const l of lotes) if (l.malha.visible && (comTerreno || l.lote.acabamento !== 'terreno')) cs.push(l.lote.caixa);
      for (const b of barras) {
        const c = caixaDasBarras(b);
        if (b.malha.visible && c) cs.push(c);
      }
      return cs;
    };
    // Sem nada aceso (ou só terreno), enquadra o modelo inteiro: a tela não pode ficar mirando o vazio.
    return (
      unirCaixas(acesas(false)) ??
      unirCaixas(acesas(true)) ??
      unirCaixas(lotes.map((l) => l.lote.caixa)) ?? { min: [0, 0, 0], max: [1, 1, 1] }
    );
  };

  const caixaTotal = (): Caixa => {
    const cs: Caixa[] = lotes.map((l) => l.lote.caixa);
    for (const b of barras) {
      const c = caixaDasBarras(b);
      if (c) cs.push(c);
    }
    return unirCaixas(cs) ?? { min: [0, 0, 0], max: [1, 1, 1] };
  };

  const classesVisiveis = (o: ReadonlySet<Categoria>): Set<ClassePeca> => {
    const s = new Set<ClassePeca>();
    for (const l of lotes) if (l.classe && visivel(l.lote.categorias, o)) s.add(l.classe);
    return s;
  };

  const centroDe = (id: string): Vec3 | null => {
    const p = pecaPorId.get(id);
    const g = p && modelo.geometrias[p.geometria];
    if (p && g) {
      const c = emMetro(caixaDaPeca(p, caixaLocal(g)));
      return [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2];
    }
    const b = barraPorId.get(id);
    if (b && b.eixo.length) {
      const s = b.eixo.reduce<Vec3>((a, q) => [a[0] + q[0], a[1] + q[1], a[2] + q[2]], [0, 0, 0]);
      const n = b.eixo.length;
      return [(s[0] / n) * MM, (s[1] / n) * MM, (s[2] / n) * MM];
    }
    return null;
  };

  const achar = (id: string): Pego | null => {
    const p = pecaPorId.get(id);
    if (p) return { tipo: 'peca', peca: p };
    const b = barraPorId.get(id);
    return b ? { tipo: 'barra', barra: b } : null;
  };

  const chamadasDeDesenho = () => {
    let n = 0;
    grupo.traverse((o) => {
      if ((o instanceof THREE.Mesh || o instanceof THREE.LineSegments) && o.visible && (o.material as THREE.Material).visible) n++;
    });
    return n;
  };

  const dispose = () => {
    for (const { geo } of moldes.values()) geo.dispose();
    for (const l of lotes) {
      l.malha.dispose();
      l.traco?.geometry.dispose();
    }
    for (const b of barras) b.lote.geometria.dispose();
    apagador.geometry.dispose();
    for (const m of todosOsMateriais()) m.dispose();
  };

  // Estado inicial coerente: nada oculto, sem Armadura, sem corte, no estilo pedido.
  aplicarVisibilidade(ocultas);
  aplicarEstilo(estilo);

  return {
    grupo,
    lotes,
    barras,
    semGeometria,
    achar,
    aplicarPaleta,
    aplicarEstilo,
    aplicarVisibilidade,
    aplicarArmadura,
    diametrosVisiveis,
    aplicarCorte,
    aplicarZoom,
    pintarSelecao,
    pegar,
    caixaVisivel,
    caixaTotal,
    classesVisiveis,
    centroDe,
    chamadasDeDesenho,
    dispose,
  };
}
