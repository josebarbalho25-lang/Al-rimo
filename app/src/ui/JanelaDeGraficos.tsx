// ═══════════════════════════════════════════════════════════════════════════
//  ui/JanelaDeGraficos.tsx — Visibilidade/Gráficos (a janela do A-PORT)
// ---------------------------------------------------------------------------
//  Jose, 16/10: "a configuração de gráficos do menu da engrenagem fosse a
//  geral e a da vista fosse 'Sobreposição' da vista; também gostaria que você
//  copiasse exatamente o modal de sobreposição de gráficos do A-PORT, que está
//  muito mais bonito e compacto". A mesma janela em três jeitos:
//    · SOBREPOSIÇÃO de uma vista (o "Gráficos" da aba): as células ficam em
//      branco até a vista mudar algo; o que fica em branco segue a geral;
//    · SOBREPOSIÇÃO do 3D do visor (o botão do 3D);
//    · GERAL (a engrenagem): as células mostram o valor de hoje.
//  A tabela é a do A-PORT: Visibilidade | Projeção/Superfície (Linhas,
//  Padrões, Transparência) | Corte (Padrões) | Meio-tom; clique escolhe a
//  linha (Ctrl soma, Shift faz faixa), só a linha principal mostra os
//  controles, e a mudança vale para todas as linhas escolhidas que têm aquela
//  coluna. Linhas e Padrões abrem a janelinha com Primeiro e Segundo plano.
//
//  MUDA NA HORA e o Cancelar (o Esc, o ✕) volta ao que estava quando a janela
//  abriu. O fundo é transparente: a vista aparece mudando atrás, mas o clique
//  nela não passa (como no A-PORT — nada se mexe embaixo com a janela aberta).
//  A janela anda pelo título e lembra onde ficou.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as PE, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ANOTACOES, DESENHOS_DE_HACHURA, GRAFICOS_DE_FABRICA, GRUPOS_DE_MATERIAIS, ITENS_DA_VISTA, MATERIAIS, MATERIAIS_DA_VISTA, MATERIAIS_DE_FABRICA,
  comGeralDaAnotacao, comGeralDoMaterial, comItemDaVista, limparSobreposicao, naAnotacaoDaVista, noMaterialDaVista, rotuloDoItem,
  type Anotacao, type DesenhoDeHachura, type GraficoDoMaterial, type Graficos, type Hachura, type ItemDaVista, type Material,
  type SobreposicaoDaVista, type SobreposicaoDoMaterial, type TipoDeVista,
} from '@/desenhos/graficos';
import { ladrilhoDe, padraoDoLadrilho } from '@/desenhos/hachuras';
import { useGraficos } from '@/desenhos/useGraficos';
import { useJanelaDeGraficos, type AlvoDosGraficos } from '@/desenhos/useJanelaDeGraficos';
import { useApp } from '@/estado/store';
import { acharVista, naVistaDoProjeto } from '@/pranchas/vistas';
import { rotuloDaBitola } from '@/visor/coresDasBitolas';

type Aba = 'modelo' | 'anotacao' | 'bitolas';
type Coluna = 'linhas' | 'padroes' | 'transparencia' | 'corte' | 'meioTom';

/** Uma linha da tabela: uma categoria (o que se liga e desliga) ou um material dela. */
interface Categoria {
  id: string;
  nome: string;
  pai?: string;
  material?: Material;
  item?: ItemDaVista;
  anotacao?: Anotacao;
  colunas: Partial<Record<Coluna, boolean>>;
}

const ABAS: { id: Aba; nome: string; exibir?: string }[] = [
  { id: 'modelo', nome: 'Categorias de modelo', exibir: 'Exibir categorias de modelo nesta vista' },
  { id: 'anotacao', nome: 'Categorias de anotação', exibir: 'Exibir categorias de anotação nesta vista' },
  { id: 'bitolas', nome: 'Bitolas' },
];

const BLOCOS_PINTADOS = new Set<Material>(['inteiro', 'meio', 'canaleta', 'bloco34', 'bloco54']);
const COM_HACHURA = new Set<Material>(['alvenaria', 'graute', 'concreto', 'brita', 'areia', 'manta', 'terra']);
const ROTULO_DO_MATERIAL = Object.fromEntries(MATERIAIS.map((m) => [m.id, m.rotulo])) as Record<Material, string>;

/**
 * As colunas que cada material tem, conforme o que se edita: na vista 2D, a superfície só vale no bloco pintado e no
 * graute (a sombra do furo); a linha, no aço; o corte, nos que têm hachura. No 3D e na geral, a superfície vale em
 * todos (o 3D Cores e o Opaco) e o corte também (o 3D em vetor da prancha corta com a hachura).
 */
function colunasDoMaterial(m: Material, doisD: boolean): Partial<Record<Coluna, boolean>> {
  const c: Partial<Record<Coluna, boolean>> = { transparencia: true, meioTom: true };
  if (m === 'aco') c.linhas = true;
  if (!doisD || BLOCOS_PINTADOS.has(m) || m === 'graute') c.padroes = true;
  if (COM_HACHURA.has(m)) c.corte = true;
  return c;
}

/**
 * O que a superfície do material tem de verdade: o bloco de cada classe só tem a cor (o Opaco pinta todo bloco com o
 * da "Alvenaria cortada", que por sua vez não tem cor no Cores — lá cada bloco tem a da classe). Campo que o desenho
 * não lê não se oferece: mudava nada e sumia no F5.
 */
function camposDaSuperficie(m: Material): { cor: boolean; opaco: boolean } {
  return { cor: 'cor' in MATERIAIS_DE_FABRICA[m], opaco: 'opaco' in MATERIAIS_DE_FABRICA[m] };
}

/** A cor de fábrica de um Ø (o "×" da bitola volta a ela: a bitola sempre tem cor). */
const corDeFabricaDaBitola = (d: number): string | undefined => GRAFICOS_DE_FABRICA.bitolas.find(([x]) => x === d)?.[1];

/** As linhas de cada aba, para o que se está editando. */
function categoriasDe(alvo: AlvoDosGraficos, aba: Aba): Categoria[] {
  const tipo: TipoDeVista | null = alvo.tipo === 'vista' ? alvo.tipoDaVista : null;
  const doisD = alvo.tipo === 'vista';
  if (aba === 'modelo') {
    const grupos = tipo ? GRUPOS_DE_MATERIAIS.filter((g) => MATERIAIS_DA_VISTA[tipo].includes(g.item)) : GRUPOS_DE_MATERIAIS;
    const r: Categoria[] = [];
    for (const g of grupos) {
      if (g.materiais.length === 1) {
        const m = g.materiais[0];
        r.push({ id: g.item, nome: rotuloDoItem(g.item), item: g.item, material: m, colunas: colunasDoMaterial(m, doisD) });
        continue;
      }
      r.push({ id: g.item, nome: rotuloDoItem(g.item), item: g.item, colunas: {} });
      for (const m of g.materiais) r.push({ id: m, nome: ROTULO_DO_MATERIAL[m], pai: g.item, material: m, colunas: colunasDoMaterial(m, doisD) });
    }
    return r;
  }
  if (aba === 'anotacao') {
    const tem = (i?: ItemDaVista) => !tipo || !i || ITENS_DA_VISTA[tipo].includes(i);
    const r: Categoria[] = ANOTACOES.filter((a) => tem(a.item) && (a.id !== 'sombras' || !tipo || tipo === 'armacao')).map((a) => ({
      id: a.id, nome: a.rotulo, anotacao: a.id, item: a.item, colunas: { linhas: true },
    }));
    for (const i of ['fiadas', 'legenda'] as const) if (tem(i)) r.push({ id: i, nome: rotuloDoItem(i), item: i, colunas: {} });
    return r;
  }
  return [];
}

const copia = <T,>(x: T): T => (x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soDoControle = (ev: MouseEvent) => ev.stopPropagation();

// ── andar pelo título (o lugar fica para a próxima vez) ──────────────────────
function useArrasteDaJanela() {
  const [lugar, setLugar] = useState<[number, number]>([0, 0]);
  const pegar = (e: PE) => {
    if ((e.target as Element).closest('button')) return;
    const [x0, y0, l0] = [e.clientX, e.clientY, lugar];
    const mover = (m: PointerEvent) => setLugar([l0[0] + m.clientX - x0, l0[1] + m.clientY - y0]);
    const parar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', parar);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', parar);
  };
  return { estilo: { position: 'relative', left: lugar[0], top: lugar[1] } as CSSProperties, pegar };
}

export function JanelaDeGraficos() {
  const alvo = useJanelaDeGraficos((e) => e.alvo);
  const vez = useJanelaDeGraficos((e) => e.vez);
  const arraste = useArrasteDaJanela();
  return alvo ? <Janela key={vez} alvo={alvo} noCorpo {...arraste} /> : null;
}

/** A janela de um alvo, sem o andar pelo título (o teste monta assim, em qualquer aba). */
export function JanelaDoAlvo({ alvo, abaInicial }: { alvo: AlvoDosGraficos; abaInicial?: Aba }) {
  return <Janela alvo={alvo} estilo={{}} pegar={() => undefined} abaInicial={abaInicial} />;
}

let aberturas = 0;

/**
 * O que a janela lê e escreve, conforme o alvo: a sobreposição (da vista ou do visor) ou a geral. Tudo o que UMA
 * abertura da janela mexe numa vista é um passo só de desfazer (`passo`), e o Cancelar, que devolve o "antes", apaga
 * o passo em vez de criar outro (store.ts).
 */
function useAlvo(alvo: AlvoDosGraficos) {
  const passoRef = useRef<string | null>(null);
  passoRef.current ??= `graficos:${++aberturas}`;
  const passo = passoRef.current;
  const dados = useGraficos((s) => s.dados);
  const mudarGraficos = useGraficos((s) => s.mudar);
  const pranchas = useApp((s) => s.pranchas);
  const mudarPranchas = useApp((s) => s.mudarPranchas);
  const vista = alvo.tipo === 'vista' ? acharVista(pranchas, alvo.id) : null;
  const sobreposicao: SobreposicaoDaVista | undefined = alvo.tipo === 'vista' ? vista?.graficos : alvo.tipo === 'visor' ? dados.visor : undefined;
  const mudarSobreposicao = (f: (s: SobreposicaoDaVista | undefined) => SobreposicaoDaVista | undefined) => {
    if (alvo.tipo === 'vista') {
      mudarPranchas((p) => naVistaDoProjeto(p, alvo.id, (v) => {
        const g = f(v.graficos);
        const { graficos: _g, ...resto } = v;
        return g ? { ...resto, graficos: g } : resto;
      }), { passo });
    } else if (alvo.tipo === 'visor') mudarGraficos((g) => ({ ...g, visor: f(g.visor) ?? {} }));
  };
  return { dados, mudarGraficos, vista, sobreposicao, mudarSobreposicao };
}

function Janela({ alvo, estilo, pegar, abaInicial, noCorpo }: { alvo: AlvoDosGraficos; abaInicial?: Aba; noCorpo?: boolean } & ReturnType<typeof useArrasteDaJanela>) {
  const fechar = useJanelaDeGraficos((e) => e.fechar);
  const { dados, mudarGraficos, vista, sobreposicao, mudarSobreposicao } = useAlvo(alvo);
  const geral = alvo.tipo === 'geral';
  const [aba, setAba] = useState<Aba>(abaInicial ?? 'modelo');
  const [busca, setBusca] = useState('');
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [ancora, setAncora] = useState<string | null>(null);

  // o "antes" do Cancelar: a sobreposição da vista, ou os gráficos do app (geral, visor), de quando a janela abriu
  const antes = useRef<{ sob?: SobreposicaoDaVista; graficos: Graficos }>({ sob: copia(sobreposicao), graficos: dados });
  const cancelar = () => {
    if (alvo.tipo === 'vista') mudarSobreposicao(() => copia(antes.current.sob));
    else mudarGraficos(() => antes.current.graficos);
    fechar();
  };
  const cancelarRef = useRef(cancelar);
  cancelarRef.current = cancelar;
  // abriu outro muro com a janela aberta (Ctrl+O): fecha como está. O Cancelar devolveria o "antes" do muro de antes
  // na vista de mesmo id do muro novo (as de fábrica têm o mesmo id em todo muro)
  const carregamento = useApp((st) => st.carregamento);
  const carregamentoAoAbrir = useRef(carregamento);
  useEffect(() => {
    if (carregamento !== carregamentoAoAbrir.current) fechar();
  }, [carregamento, fechar]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.gf-sobrepor')) return;
      e.stopPropagation();
      e.preventDefault();
      cancelarRef.current();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, []);

  const abas = ABAS.filter((a) => (alvo.tipo === 'visor' ? a.id !== 'anotacao' : a.id !== 'bitolas' || geral));
  const daAba = useMemo(() => categoriasDe(alvo, aba), [alvo, aba]);
  const achar = normal(busca.trim());
  const combina = (c: Categoria) => !achar || normal(c.nome).includes(achar);
  const linhas: Categoria[] = [];
  for (const c of daAba) {
    if (c.pai) continue;
    const filhas = daAba.filter((x) => x.pai === c.id);
    const queCombinam = filhas.filter(combina);
    if (!combina(c) && queCombinam.length === 0) continue;
    linhas.push(c);
    if (achar) linhas.push(...queCombinam);
    else if (!recolhidas.has(c.id)) linhas.push(...filhas);
  }
  const ids = linhas.map((c) => c.id);
  const principal = ancora && escolhidas.includes(ancora) ? ancora : (escolhidas[escolhidas.length - 1] ?? null);
  const porId = new Map(daAba.map((c) => [c.id, c]));

  const clicarLinha = (id: string, ev: MouseEvent) => {
    if (ev.shiftKey && ancora && ids.includes(ancora)) {
      const [i, j] = [ids.indexOf(ancora), ids.indexOf(id)];
      setEscolhidas(ids.slice(Math.min(i, j), Math.max(i, j) + 1));
      return;
    }
    if (ev.ctrlKey || ev.metaKey) {
      setEscolhidas((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
      setAncora(id);
      return;
    }
    setEscolhidas([id]);
    setAncora(id);
  };
  /** As linhas que a mudança atinge: as escolhidas que têm a coluna (a de fora da escolha vira a escolha). */
  const alvos = (id: string, coluna: Coluna | null): Categoria[] => {
    const doGrupo = escolhidas.includes(id);
    if (!doGrupo) {
      setEscolhidas([id]);
      setAncora(id);
    }
    return (doGrupo ? escolhidas : [id]).map((x) => porId.get(x)).filter((c): c is Categoria => !!c && (!coluna || !!c.colunas[coluna]));
  };

  // ── ler e mexer ──
  /** O valor de hoje do material na vista (a geral com a sobreposição por cima). */
  const resolvido = (m: Material): GraficoDoMaterial => {
    const base = dados.geral.materiais[m] ?? MATERIAIS_DE_FABRICA[m];
    const o = sobreposicao?.materiais?.[m];
    if (!o) return base;
    const { hachura, ...resto } = o;
    return { ...base, ...resto, ...(hachura && base.hachura ? { hachura: { ...base.hachura, ...hachura } } : {}) };
  };
  /**
   * O valor a guardar: na geral, o neutro (0 %, sem meio-tom) não se escreve; na sobreposição, o igual ao da geral
   * não se escreve (a vista segue a geral) e o DIFERENTE fica, mesmo neutro — é assim que uma vista desfaz a
   * transparência ou o meio-tom que a geral pôs.
   */
  const daVista = <T,>(valor: T, daGeral: T, neutro: T): T | undefined => ((geral ? valor === neutro : valor === daGeral) ? undefined : valor);
  const doMaterial = (m: Material): SobreposicaoDoMaterial | GraficoDoMaterial | undefined => (geral ? dados.geral.materiais[m] : sobreposicao?.materiais?.[m]);
  const mexerNoMaterial = (cs: Categoria[], f: (x: SobreposicaoDoMaterial, m: Material) => SobreposicaoDoMaterial) => {
    const ms = cs.map((c) => c.material).filter((m): m is Material => !!m);
    if (!ms.length) return;
    if (geral) {
      mudarGraficos((g) => ms.reduce((acc, m) => comGeralDoMaterial(acc, m, (x) => {
        const r = f(x as SobreposicaoDoMaterial, m);
        const { hachura, ...resto } = r;
        const novo: GraficoDoMaterial = { ...resto };
        if (x.hachura) novo.hachura = { ...x.hachura, ...hachura };
        return novo;
      }), g));
      return;
    }
    mudarSobreposicao((s) => ms.reduce((acc, m) => noMaterialDaVista(acc, m, (x) => f(x, m)), s));
  };
  const mexerNaAnotacao = (cs: Categoria[], f: (x: { cor?: string; visivel?: boolean }) => { cor?: string; visivel?: boolean }) => {
    const as = cs.map((c) => c.anotacao).filter((a): a is Anotacao => !!a);
    if (geral) {
      mudarGraficos((g) => as.reduce((acc, a) => comGeralDaAnotacao(acc, a, f({ cor: acc.geral.anotacoes[a]?.cor ?? undefined }).cor ?? null), g));
      return;
    }
    mudarSobreposicao((s) => as.reduce((acc, a) => naAnotacaoDaVista(acc, a, f), s));
  };

  // ── a visibilidade (só na sobreposição: a geral mostra tudo) ──
  const visivel = (c: Categoria): boolean => {
    // no 3D a categoria não se apaga inteira (o 3D tem o "Mostrar" dele): ela está à vista se algum material dela está
    if (alvo.tipo === 'visor' && c.item && !c.material) return daAba.some((x) => x.pai === c.id && visivel(x));
    if (c.item && !c.material) return !sobreposicao?.ocultos?.includes(c.item);
    if (c.item && c.material && !sobreposicao?.ocultos?.includes(c.item)) return sobreposicao?.materiais?.[c.material]?.visivel !== false;
    if (c.item) return !sobreposicao?.ocultos?.includes(c.item);
    if (c.material) return sobreposicao?.materiais?.[c.material]?.visivel !== false;
    if (c.anotacao) return sobreposicao?.anotacoes?.[c.anotacao]?.visivel !== false;
    return true;
  };
  const mudarVisivel = (c: Categoria, on: boolean) => {
    const cs = escolhidas.includes(c.id) ? escolhidas.map((x) => porId.get(x)).filter((q): q is Categoria => !!q) : [c];
    mudarSobreposicao((s) => cs.reduce<SobreposicaoDaVista | undefined>((acc, q) => {
      // no 3D a categoria inteira não se apaga por aqui (o 3D tem o "Mostrar" dele): só o material
      if (q.item && alvo.tipo === 'vista') return comItemDaVista(acc, q.item, on);
      if (q.material) return noMaterialDaVista(acc, q.material, (x) => ({ ...x, visivel: on ? undefined : false }));
      if (q.anotacao) return naAnotacaoDaVista(acc, q.anotacao, (x) => ({ ...x, visivel: on ? undefined : false }));
      return acc;
    }, s));
  };
  const abaVisivel = daAba.filter((c) => !c.pai).every((c) => visivel(c));
  const mudarAba = (on: boolean) => mudarSobreposicao((s) => daAba.filter((c) => !c.pai).reduce<SobreposicaoDaVista | undefined>((acc, c) => {
    if (c.item && alvo.tipo === 'vista') return comItemDaVista(acc, c.item, on);
    if (c.anotacao) return naAnotacaoDaVista(acc, c.anotacao, (x) => ({ ...x, visivel: on ? undefined : false }));
    // no 3D, a categoria de vários materiais (blocos, drenagem) vai material a material
    const ms = c.material ? [c.material] : daAba.filter((x) => x.pai === c.id && x.material).map((x) => x.material as Material);
    return ms.reduce((a, m) => noMaterialDaVista(a, m, (x) => ({ ...x, visivel: on ? undefined : false })), acc);
  }, s));

  // ── a janelinha de Linhas e Padrões ──
  const [aberta, setAberta] = useState<{ coluna: 'linhas' | 'padroes' | 'corte'; c: Categoria } | null>(null);

  const titulo = alvo.tipo === 'geral' ? 'Gráficos gerais' : `Visibilidade/Gráficos · ${alvo.tipo === 'visor' ? '3D' : vista?.nome ?? ''}`;
  const sobrepor = geral ? 'Editar…' : 'Sobrepor…';

  // no body, como as Configurações: dentro da barra de cima (que é uma camada própria) o painel da aba, a barra de
  // estado e os campos de escrever ficavam por cima da janela e pegavam o clique. (O teste monta sem o body.)
  const janela = (
    <div className="modal-fundo graficos-fundo">
      <div className="modal-caixa vv" style={estilo} onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="modal-cabeca" onPointerDown={pegar}>
          <h3>{titulo}</h3>
          <button type="button" className="btn-icone" onClick={cancelar} title="Cancelar">✕</button>
        </div>

        <div className="vv-abas">
          {abas.map((a) => (
            <button key={a.id} type="button" className={`vv-aba${a.id === aba ? ' on' : ''}`}
              onClick={() => { setAba(a.id); setEscolhidas([]); setAncora(null); }}>
              {a.nome}
            </button>
          ))}
        </div>

        {aba === 'bitolas' ? (
          <div className="vv-tabela-rolo vv-bitolas">
            {dados.bitolas.map(([d, cor]) => (
              <label key={d} className="vv-bitola">
                <span>{rotuloDaBitola(d)}</span>
                <CampoDeCor cor={cor} aoMudar={(c) => mudarGraficos((g) => ({ ...g, bitolas: g.bitolas.map(([x, y]): [number, string] => [x, x === d ? (c ?? corDeFabricaDaBitola(x) ?? y) : y]) }))} />
              </label>
            ))}
          </div>
        ) : (
          <>
            <div className="vv-topo">
              {!geral ? (
                <label className="vv-exibir">
                  <input type="checkbox" checked={abaVisivel} onChange={(ev) => mudarAba(ev.target.checked)} />
                  {abas.find((a) => a.id === aba)?.exibir}
                </label>
              ) : <span />}
              <label className="vv-busca">
                Pesquisar
                <input className="campo" value={busca} onChange={(ev) => setBusca(ev.target.value)} />
              </label>
            </div>

            <div className="vv-tabela-rolo">
              <table className={`vv-tabela${abaVisivel || geral ? '' : ' apagada'}`}>
                <thead>
                  <tr>
                    <th rowSpan={2} className="vv-col-nome">{geral ? 'Categoria' : 'Visibilidade'}</th>
                    <th colSpan={3}>Projeção/Superfície</th>
                    <th>Corte</th>
                    <th rowSpan={2}>Meio-tom</th>
                  </tr>
                  <tr>
                    <th>Linhas</th><th>Padrões</th><th>Transparência</th><th>Padrões</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((c) => {
                    const filhas = c.pai ? [] : daAba.filter((x) => x.pai === c.id);
                    const pai = c.pai ? porId.get(c.pai) : undefined;
                    const paiApagado = !!pai && !visivel(pai);
                    const comControle = principal === c.id;
                    const m = c.material;
                    const o = m ? doMaterial(m) : undefined;
                    const r = m ? resolvido(m) : undefined;
                    const corDaAnot = c.anotacao ? (geral ? dados.geral.anotacoes[c.anotacao]?.cor ?? undefined : sobreposicao?.anotacoes?.[c.anotacao]?.cor) : undefined;
                    return (
                      <tr key={c.id} className={`${escolhidas.includes(c.id) ? 'on' : ''}${c.pai ? ' filha' : ''}`} onClick={(ev) => clicarLinha(c.id, ev)}>
                        <td className="vv-col-nome">
                          {filhas.length ? (
                            <button type="button" className="vv-abre" onClick={(ev) => {
                              ev.stopPropagation();
                              setRecolhidas((x) => { const n = new Set(x); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
                            }}>
                              {recolhidas.has(c.id) && !achar ? '+' : '−'}
                            </button>
                          ) : <span className="vv-abre" />}
                          {!geral && (
                            <input type="checkbox" checked={visivel(c)} disabled={paiApagado || (alvo.tipo === 'visor' && !c.material)} onClick={soDoControle}
                              onChange={(ev) => mudarVisivel(c, ev.target.checked)} />
                          )}
                          <span>{c.nome}</span>
                        </td>
                        {/* Linhas: o traço do aço; a cor da anotação */}
                        <td className={c.colunas.linhas ? 'vv-cel' : 'vv-cel nada'}>
                          {c.colunas.linhas && (comControle
                            ? <button type="button" className="vv-botao-sobrepor" onClick={(ev) => { ev.stopPropagation(); setAberta({ coluna: 'linhas', c }); }}>{sobrepor}</button>
                            : <AmostraDeCor cor={m ? (geral ? r?.desenho : (o as SobreposicaoDoMaterial | undefined)?.desenho) : corDaAnot} />)}
                        </td>
                        {/* Padrões da superfície: a pintura (e o Opaco no 3D) */}
                        <td className={c.colunas.padroes ? 'vv-cel' : 'vv-cel nada'}>
                          {c.colunas.padroes && (comControle
                            ? <button type="button" className="vv-botao-sobrepor" onClick={(ev) => { ev.stopPropagation(); setAberta({ coluna: 'padroes', c }); }}>{sobrepor}</button>
                            : <span className="vv-sobrepor">
                                {m && camposDaSuperficie(m).cor && <AmostraDeCor cor={geral ? r?.cor ?? undefined : (o as SobreposicaoDoMaterial | undefined)?.cor ?? undefined} />}
                                {alvo.tipo !== 'vista' && m && camposDaSuperficie(m).opaco && <AmostraDeCor cor={geral ? r?.opaco : (o as SobreposicaoDoMaterial | undefined)?.opaco} />}
                              </span>)}
                        </td>
                        <td className={c.colunas.transparencia ? 'vv-cel' : 'vv-cel nada'}>
                          {c.colunas.transparencia && m && (comControle ? (
                            <span className="vv-sobrepor" onClick={soDoControle}>
                              <CampoDeTransparencia valor={r?.transparencia} aoMudar={(t) => mexerNoMaterial(alvos(c.id, 'transparencia'), (x, mat) => ({ ...x, transparencia: daVista(t, dados.geral.materiais[mat]?.transparencia ?? 0, 0) }))} />
                            </span>
                          ) : o?.transparencia !== undefined && (geral ? o.transparencia > 0 : true) ? <span className="vv-valor">{o.transparencia}</span> : null)}
                        </td>
                        <td className={c.colunas.corte ? 'vv-cel' : 'vv-cel nada'}>
                          {c.colunas.corte && (comControle
                            ? <button type="button" className="vv-botao-sobrepor" onClick={(ev) => { ev.stopPropagation(); setAberta({ coluna: 'corte', c }); }}>{sobrepor}</button>
                            : (geral || (o as SobreposicaoDoMaterial | undefined)?.hachura) && r?.hachura ? <AmostraDeHachura h={r.hachura} /> : null)}
                        </td>
                        <td className={c.colunas.meioTom ? 'vv-cel centro' : 'vv-cel nada'}>
                          {c.colunas.meioTom && m && (
                            <input type="checkbox" checked={!!r?.meioTom} onClick={soDoControle}
                              onChange={(ev) => { const on = ev.target.checked; mexerNoMaterial(alvos(c.id, 'meioTom'), (x, mat) => ({ ...x, meioTom: daVista(on, dados.geral.materiais[mat]?.meioTom ?? false, false) })); }} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="vv-botoes">
              <button type="button" className="btn-fantasma" onClick={() => setEscolhidas(ids)}>Todos</button>
              <button type="button" className="btn-fantasma" onClick={() => setEscolhidas([])}>Nenhum</button>
              <button type="button" className="btn-fantasma" onClick={() => setEscolhidas(ids.filter((id) => !escolhidas.includes(id)))}>Inverter</button>
              <button type="button" className="btn-fantasma" onClick={() =>
                setRecolhidas(recolhidas.size ? new Set() : new Set(daAba.filter((c) => daAba.some((x) => x.pai === c.id)).map((c) => c.id)))}>
                {recolhidas.size ? 'Expandir tudo' : 'Recolher tudo'}
              </button>
            </div>
          </>
        )}

        <div className="exibicao-rodape">
          {geral ? (
            <button type="button" className="btn-fantasma vv-esquerda" onClick={() => useGraficos.getState().restaurar(true)}>Restaurar padrão</button>
          ) : (
            <button type="button" className="btn-fantasma vv-esquerda" disabled={!limparSobreposicao(sobreposicao)} onClick={() => mudarSobreposicao(() => undefined)}>Limpar sobreposições</button>
          )}
          <button type="button" className="btn-fantasma" onClick={cancelar}>Cancelar</button>
          <button type="button" className="btn-primario" onClick={fechar}>OK</button>
        </div>
      </div>

      {aberta && (
        <JanelaDeSobreposicao
          titulo={`${aberta.coluna === 'linhas' ? 'Linhas de projeção' : aberta.coluna === 'padroes' ? 'Padrões de superfície' : 'Padrões de corte'} · ${aberta.c.nome}`}
          limpar={geral ? 'Restaurar' : 'Limpar sobreposições'}
          aoCancelar={() => setAberta(null)}
          inicial={() => {
            const m = aberta.c.material;
            if (aberta.c.anotacao && !m) {
              const cor = geral ? dados.geral.anotacoes[aberta.c.anotacao]?.cor ?? undefined : sobreposicao?.anotacoes?.[aberta.c.anotacao]?.cor;
              return { cor };
            }
            const o = m ? doMaterial(m) : undefined;
            const r = m ? resolvido(m) : undefined;
            if (aberta.coluna === 'linhas') return { cor: geral ? r?.desenho : (o as SobreposicaoDoMaterial | undefined)?.desenho };
            if (aberta.coluna === 'padroes') return { cor: (geral ? r?.cor : o?.cor) ?? undefined, opaco: geral ? r?.opaco : o?.opaco };
            return { hachura: geral ? r?.hachura : (o as SobreposicaoDoMaterial | undefined)?.hachura, base: r?.hachura };
          }}
          editor={aberta.coluna === 'linhas' ? 'linhas' : aberta.coluna === 'padroes' ? (alvo.tipo === 'vista' ? 'superficie' : 'superficie3d') : 'corte'}
          campos={aberta.c.material ? camposDaSuperficie(aberta.c.material) : { cor: true, opaco: true }}
          aoConfirmar={(v) => {
            const cs = alvos(aberta.c.id, aberta.c.anotacao ? 'linhas' : aberta.coluna);
            if (aberta.c.anotacao && !aberta.c.material) {
              mexerNaAnotacao(cs, (x) => ({ ...x, cor: v.cor }));
            } else if (aberta.coluna === 'linhas') {
              mexerNoMaterial(cs, (x) => ({ ...x, desenho: v.cor ?? (geral ? MATERIAIS_DE_FABRICA.aco.desenho : undefined) }));
            } else if (aberta.coluna === 'padroes') {
              mexerNoMaterial(cs, (x, mat) => ({
                ...x,
                cor: v.cor ?? (geral ? MATERIAIS_DE_FABRICA[mat].cor : undefined),
                opaco: v.opaco ?? (geral ? MATERIAIS_DE_FABRICA[mat].opaco : undefined),
              }));
            } else {
              mexerNoMaterial(cs, (x, mat) => ({ ...x, hachura: v.hachura ?? (geral ? { ...MATERIAIS_DE_FABRICA[mat].hachura } : undefined) }));
            }
            setAberta(null);
          }}
        />
      )}
    </div>
  );
  return noCorpo ? createPortal(janela, document.body) : janela;
}

// ── a janelinha de Linhas e Padrões ──────────────────────────────────────────

interface ValorDaSobreposicao {
  cor?: string;
  opaco?: string;
  hachura?: Partial<Hachura>;
  /** A hachura de hoje (para mostrar o que vale nos campos que a sobreposição não muda). */
  base?: Hachura;
}

function JanelaDeSobreposicao({ titulo, limpar, editor, campos, inicial, aoConfirmar, aoCancelar }: {
  titulo: string;
  limpar: string;
  editor: 'linhas' | 'superficie' | 'superficie3d' | 'corte';
  campos: { cor: boolean; opaco: boolean };
  inicial: () => ValorDaSobreposicao;
  aoConfirmar: (v: ValorDaSobreposicao) => void;
  aoCancelar: () => void;
}) {
  const [v, setV] = useState<ValorDaSobreposicao>(inicial);
  const cancelar = useRef(aoCancelar);
  cancelar.current = aoCancelar;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      cancelar.current();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, []);
  const h = { ...(v.base ?? { desenho: 'vazio', risco: '#000000', fundo: '#ffffff', escala: 1 }), ...v.hachura } as Hachura;
  const mudarH = (x: Partial<Hachura>) => setV({ ...v, hachura: { ...v.hachura, ...x } });
  return createPortal(
    <div className="modal-fundo graficos-fundo gf-sobrepor" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="modal-caixa exibicao">
        <div className="modal-cabeca">
          <h3>{titulo}</h3>
          <button type="button" className="btn-icone" onClick={aoCancelar} title="Cancelar">✕</button>
        </div>
        <div className="exibicao-corpo">
          {editor === 'linhas' && <Linha rotulo="Cor"><CampoDeCor cor={v.cor} aoMudar={(cor) => setV({ ...v, cor: cor ?? undefined })} /></Linha>}
          {(editor === 'superficie' || editor === 'superficie3d') && (
            <div className="gf-camada">
              <div className="gf-camada-titulo">Primeiro plano</div>
              <Linha rotulo="Padrão"><span className="vv-valor">Sólido</span></Linha>
              {campos.cor && <Linha rotulo="Cor"><CampoDeCor cor={v.cor} aoMudar={(cor) => setV({ ...v, cor: cor ?? undefined })} /></Linha>}
              {editor === 'superficie3d' && campos.opaco && <Linha rotulo="Opaco"><CampoDeCor cor={v.opaco} aoMudar={(opaco) => setV({ ...v, opaco: opaco ?? undefined })} /></Linha>}
            </div>
          )}
          {editor === 'corte' && (
            <>
              <div className="gf-camada">
                <div className="gf-camada-titulo">Primeiro plano</div>
                <Linha rotulo="Padrão"><EscolhaDeHachura valor={h} aoEscolher={(desenho) => mudarH({ desenho })} /></Linha>
                <Linha rotulo="Cor"><CampoDeCor cor={v.hachura?.risco} vale={h.risco} aoMudar={(risco) => mudarH({ risco: risco ?? undefined })} /></Linha>
                <Linha rotulo="Escala">
                  <input className="campo gf-escala" type="number" min={0.1} max={10} step={0.05} value={h.escala}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0.1 && n <= 10) mudarH({ escala: n }); }} />
                </Linha>
              </div>
              <div className="gf-camada">
                <div className="gf-camada-titulo">Segundo plano</div>
                <Linha rotulo="Cor"><CampoDeCor cor={v.hachura?.fundo} vale={h.fundo} aoMudar={(fundo) => mudarH({ fundo: fundo ?? undefined })} /></Linha>
              </div>
            </>
          )}
        </div>
        <div className="exibicao-rodape">
          <button type="button" className="btn-fantasma vv-esquerda" onClick={() => setV({ base: v.base })}>{limpar}</button>
          <button type="button" className="btn-fantasma" onClick={aoCancelar}>Cancelar</button>
          <button type="button" className="btn-primario" onClick={() => aoConfirmar(v)}>OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="prop">
      <label>{rotulo}</label>
      <div>{children}</div>
    </div>
  );
}

// ── os campos ────────────────────────────────────────────────────────────────

/** A cor: amostra que abre o seletor; vazia (risco na diagonal) = sem sobreposição, com o × para voltar a ela. */
function CampoDeCor({ cor, vale, aoMudar }: { cor: string | undefined | null; vale?: string; aoMudar: (c: string | null) => void }) {
  return (
    <span className="gf-cor">
      <label className={`gf-amostra${cor ? '' : ' vazia'}`} style={cor ? { background: cor } : undefined}>
        <input type="color" value={cor ?? vale ?? '#808080'} onChange={(ev) => aoMudar(ev.target.value)} />
      </label>
      {cor && <button type="button" className="gf-limpa" title="Sem sobreposição" onClick={() => aoMudar(null)}>×</button>}
    </span>
  );
}

function AmostraDeCor({ cor }: { cor: string | null | undefined }) {
  if (!cor) return null;
  return <span className="gf-amostra" style={{ background: cor }} />;
}

/** Transparência: régua de 0 a 100 de 5 em 5 e o número (o do A-PORT). */
function CampoDeTransparencia({ valor, aoMudar }: { valor: number | undefined; aoMudar: (t: number) => void }) {
  const ler = (texto: string) => {
    const n = Number(texto.replace(',', '.'));
    if (texto.trim() && Number.isFinite(n)) aoMudar(Math.round(Math.max(0, Math.min(100, n)) / 5) * 5);
  };
  // o número digitado vale no Enter ou ao sair do campo: arredondar de 5 em 5 a cada tecla fazia o "3" virar 5 e o
  // "35" virar 55
  const [digitando, setDigitando] = useState<string | null>(null);
  const confirmar = () => {
    if (digitando !== null) ler(digitando);
    setDigitando(null);
  };
  return (
    <span className="gf-transp">
      <input type="range" min={0} max={100} step={5} value={valor ?? 0} onChange={(ev) => ler(ev.target.value)} aria-label="Transparência" />
      <input className="campo" type="number" min={0} max={100} step={5} value={digitando ?? String(valor ?? 0)}
        onChange={(ev) => setDigitando(ev.target.value)} onBlur={confirmar}
        onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); confirmar(); } }} />
    </span>
  );
}

let contadorDeAmostra = 0;
/** A amostra de uma hachura: o ladrilho dela (o mesmo da tela e do papel) num quadradinho. */
function AmostraDeHachura({ h, lado = 16 }: { h: Hachura; lado?: number }) {
  const id = useMemo(() => `amostra-hachura-${++contadorDeAmostra}`, []);
  const l = ladrilhoDe(h);
  return (
    <svg className="gf-amostra-padrao" width={lado} height={lado} viewBox={`0 0 ${lado * 3} ${lado * 3}`} aria-hidden>
      <defs dangerouslySetInnerHTML={{ __html: padraoDoLadrilho(id, l) }} />
      <rect width={lado * 3} height={lado * 3} fill={l.fundo === 'none' ? '#ffffff' : l.fundo} />
      <rect width={lado * 3} height={lado * 3} fill={`url(#${id})`} />
    </svg>
  );
}

/** O padrão da hachura: o botão com a amostra e o nome; a lista em grade (a do A-PORT, com as nossas hachuras). */
function EscolhaDeHachura({ valor, aoEscolher }: { valor: Hachura; aoEscolher: (d: DesenhoDeHachura) => void }) {
  const [aberta, setAberta] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!aberta) return;
    const fora = () => setAberta(null);
    window.addEventListener('pointerdown', fora);
    return () => window.removeEventListener('pointerdown', fora);
  }, [aberta]);
  const nome = DESENHOS_DE_HACHURA.find((d) => d.id === valor.desenho)?.rotulo ?? valor.desenho;
  return (
    <span className="escolha-textura">
      <button type="button" className="campo escolha-textura-botao" onPointerDown={(ev) => {
        ev.stopPropagation();
        if (aberta) return setAberta(null);
        const r = ev.currentTarget.getBoundingClientRect();
        setAberta({ left: Math.max(8, Math.min(r.left, window.innerWidth - 360 - 8)), top: Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 260 - 8)) });
      }}>
        <AmostraDeHachura h={valor} lado={20} />
        {nome}
      </button>
      {aberta && createPortal(
        <div className="menu-contexto escolha-hachura-lista" style={aberta} onPointerDown={(ev) => ev.stopPropagation()}>
          {DESENHOS_DE_HACHURA.map((d) => (
            <button key={d.id} type="button" className={`escolha-hachura-item${d.id === valor.desenho ? ' on' : ''}`}
              onClick={() => { aoEscolher(d.id); setAberta(null); }}>
              <AmostraDeHachura h={{ ...valor, desenho: d.id }} lado={48} />
              {d.rotulo}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </span>
  );
}
