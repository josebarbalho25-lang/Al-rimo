// ═══════════════════════════════════════════════════════════════════════════
//  pranchas/TelaDasPranchas.tsx — a aba Pranchas
// ---------------------------------------------------------------------------
//  Jose, 14/10: "prancha pronta de uma forma bem intuitiva e prática". À
//  esquerda as folhas (01, 02…) e o painel do que está selecionado (folha,
//  desenho, carimbo, quadro lateral); no meio a folha de papel, na mesa cinza.
//  O desenho se ARRASTA pela folha; o 3D (sem escala) e o carimbo e o quadro
//  lateral se REDIMENSIONAM pela alça. Durante o arrasto só a moldura azul se
//  move — o papel se recompõe ao soltar (redesenhar a folha a cada passo do
//  mouse travaria a tela num A0 cheio).
//
//  Painel = rótulo + valor + controle, sem texto explicativo (regra do Jose).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import type { Modelo } from '@/modelo/tipos';
import type { Resultado } from '@/motor/tipos';
import { useApp } from '@/estado/store';
import { comporFolha, type ContextoDaFolha, type FolhaComposta } from './folha';
import { CARIMBO_MIN, ESCALAS, ORDEM_DOS_FORMATOS, quadroLateralPadrao, rotuloDaEscala, tamanhoDaFolha } from './formatos';
import { novaFolha } from './padrao';
import { itemDaVista, naFolha, noItem, NOMES_DO_CONTEUDO, porNaFolha } from './acoes';
import { usePranchasUi } from './ui';
import { legendaDasCores, notasAutomaticas, quadroDeAco } from './quadro';
import { criarDesenhista } from './desenhista';
import { logoEmPng, useEscritorio } from './escritorio';
import { imprimirPranchas } from './pdf';
import type { ConteudoDoItem, DadosDaObra, Folha, Formato, ItemDaFolha, Orientacao } from './tipos';

type Selecao = { tipo: 'item'; id: string } | { tipo: 'carimbo' } | { tipo: 'quadro' } | null;

/** O que está sendo arrastado: só a moldura azul anda; o papel muda ao soltar. */
type Arrasto =
  | { tipo: 'mover'; id: string; x0: number; y0: number; px: number; py: number; dx: number; dy: number }
  | { tipo: 'tamanho'; id: string; px: number; py: number; w0: number; h0: number; dw: number; dh: number }
  | { tipo: 'carimbo'; px: number; py: number; w0: number; h0: number; dw: number; dh: number }
  | { tipo: 'quadro'; px: number; py: number; w0: number; h0: number; dw: number; dh: number };

const AZUL = '#0080ff';

const s = {
  raiz: { position: 'absolute', inset: 0, display: 'flex', minHeight: 0 } as CSSProperties,
  lado: {
    width: 270, flex: '0 0 270px', borderRight: '1px solid var(--line, #d9dee4)', overflow: 'auto',
    padding: 'var(--gap-2, 8px)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-rotulo, 12.5px)',
  } as CSSProperties,
  folhas: { display: 'flex', flexWrap: 'wrap', gap: 6 } as CSSProperties,
  chip: {
    padding: '3px 9px', border: '1px solid var(--line, #d9dee4)', borderRadius: 4, cursor: 'pointer',
    background: 'transparent', color: 'var(--ink-2, inherit)', font: 'inherit',
  } as CSSProperties,
  chipOn: { borderColor: 'var(--accent-3, #3d8bfd)', color: 'var(--ink, inherit)', fontWeight: 600 } as CSSProperties,
  grupo: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--line, #d9dee4)' } as CSSProperties,
  tituloDoGrupo: { fontWeight: 600, color: 'var(--ink, inherit)' } as CSSProperties,
  linha: { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center', gap: 6 } as CSSProperties,
  rotulo: { color: 'var(--muted, #666)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSProperties,
  palco: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } as CSSProperties,
  barra: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--gap-2, 8px)', padding: 'var(--gap-2, 8px)',
    fontSize: 'var(--fs-rotulo, 12.5px)', borderBottom: '1px solid var(--line, #d9dee4)',
  } as CSSProperties,
  mesa: { flex: 1, minHeight: 0, overflow: 'auto', background: '#8f949a', padding: 24 } as CSSProperties,
  botao: { flex: 'none', padding: '0 10px' } as CSSProperties,
};

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label style={s.linha}>
      <span style={s.rotulo} title={rotulo}>{rotulo}</span>
      {children}
    </label>
  );
}

function Texto({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return <input className="campo" type="text" value={valor} onChange={(e) => aoMudar(e.target.value)} />;
}

function Numero({ valor, aoMudar, min = 0 }: { valor: number; aoMudar: (v: number) => void; min?: number }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <input
      className="campo"
      type="text"
      inputMode="decimal"
      value={rascunho ?? String(Math.round(valor * 10) / 10).replace('.', ',')}
      onChange={(e) => {
        setRascunho(e.target.value);
        const v = Number(e.target.value.replace(',', '.'));
        if (Number.isFinite(v) && v >= min) aoMudar(v);
      }}
      onBlur={() => setRascunho(null)}
    />
  );
}

export function TelaDasPranchas({ modelo, resultado }: { modelo: Modelo | null; resultado: Resultado | null }) {
  const pranchas = useApp((st) => st.pranchas);
  const mudar = useApp((st) => st.mudarPranchas);
  const escritorio = useEscritorio((st) => st.dados);
  const mudarEscritorio = useEscritorio((st) => st.mudar);
  const ativa = usePranchasUi((st) => st.ativa);
  const setAtiva = usePranchasUi((st) => st.definirAtiva);
  const [sel, setSel] = useState<Selecao>(null);
  const [zoom, setZoom] = useState(1);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const mesaRef = useRef<HTMLDivElement>(null);
  const [mesa, setMesa] = useState<[number, number]>([900, 600]);

  const folha = pranchas.folhas.find((f) => f.id === ativa) ?? pranchas.folhas[0] ?? null;
  const numero = folha ? pranchas.folhas.indexOf(folha) + 1 : 0;

  // o tamanho da mesa: no zoom 1 a folha INTEIRA cabe (carimbo à vista, como o "ajustar à janela" do CAD) e o zoom
  // amplia a partir daí
  useEffect(() => {
    const el = mesaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMesa([Math.max(300, el.clientWidth - 48), Math.max(200, el.clientHeight - 48)]));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a foto do 3D chega depois: quando chega, `versao` sobe e a folha se recompõe
  const [versao, setVersao] = useState(0);
  const desenhista = useMemo(() => criarDesenhista(modelo, () => setVersao((v) => v + 1)), [modelo]);
  useEffect(() => () => desenhista.descartar(), [desenhista]);
  const base = useMemo(
    () => ({
      escritorio,
      notasAutomaticas: notasAutomaticas(resultado, modelo),
      legenda: legendaDasCores(modelo),
      aco: quadroDeAco(modelo),
    }),
    [escritorio, resultado, modelo],
  );
  const contexto = useCallback(
    (n: number, total: number, obra: DadosDaObra): ContextoDaFolha => ({ ...base, numero: n, total, obra, desenhar: desenhista.desenhar }),
    // `versao` entra para a folha se recompor quando a foto do 3D chega
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, desenhista, versao],
  );
  const composta: FolhaComposta | null = useMemo(
    () => (folha ? comporFolha(folha, contexto(numero, pranchas.folhas.length, pranchas.obra)) : null),
    [folha, numero, pranchas.folhas.length, pranchas.obra, contexto],
  );

  const mudarObra = (parcial: Partial<DadosDaObra>) => mudar((p) => ({ ...p, obra: { ...p.obra, ...parcial } }));
  const mudarFolha = (f: (x: Folha) => Folha) => folha && mudar((p) => naFolha(p, folha.id, f));

  const adicionarFolha = () => {
    const f = novaFolha('');
    mudar((p) => ({ ...p, folhas: [...p.folhas, f] }));
    setAtiva(f.id);
    setSel(null);
  };
  const excluirFolha = () => {
    if (!folha) return;
    mudar((p) => ({ ...p, folhas: p.folhas.filter((f) => f.id !== folha.id) }));
    setAtiva(null);
    setSel(null);
  };
  const adicionarVista = (tipo: 'frontal' | 'corte' | 'planta' | 'iso') => {
    const pedido = tipo === 'planta' ? { tipo, fiada: 0 } : tipo === 'iso' ? { tipo, vista: 'frente-direita' as const, corteX: null } : { tipo };
    const r = porNaFolha(pranchas, folha?.id ?? null, (f) => itemDaVista(f, pedido));
    mudar(() => r.pranchas);
    setAtiva(r.folha);
    setSel({ tipo: 'item', id: r.item.id });
  };
  const excluirItem = useCallback(
    (id: string) => {
      if (!folha) return;
      mudar((p) => naFolha(p, folha.id, (f) => ({ ...f, itens: f.itens.filter((i) => i.id !== id) })));
      setSel(null);
    },
    [folha, mudar],
  );

  // Delete apaga o desenho selecionado (fora de campo de texto)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.tipo === 'item') {
        e.preventDefault();
        excluirItem(sel.id);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [sel, excluirItem]);

  // ── arrastar no papel ─────────────────────────────────────────────────────
  const capaRef = useRef<SVGSVGElement>(null);
  const mm = (e: PE): [number, number] => {
    const svg = capaRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const apertar = (e: PE, a: Arrasto) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setArrasto(a);
  };
  const mover = (e: PE) => {
    if (!arrasto) return;
    const [x, y] = mm(e);
    const dx = Math.round((x - arrasto.px) * 2) / 2;
    const dy = Math.round((y - arrasto.py) * 2) / 2;
    if (arrasto.tipo === 'mover') setArrasto({ ...arrasto, dx, dy });
    else setArrasto({ ...arrasto, dw: dx, dh: dy });
  };
  const soltar = () => {
    const a = arrasto;
    setArrasto(null);
    if (!a || !folha) return;
    if (a.tipo === 'mover' && (a.dx || a.dy)) mudar((p) => noItem(p, folha.id, a.id, (i) => ({ ...i, x: a.x0 + a.dx, y: a.y0 + a.dy })));
    if (a.tipo === 'tamanho' && (a.dw || a.dh)) {
      // o 3D mantém a proporção: vale o lado que mais andou
      mudar((p) => noItem(p, folha.id, a.id, (i) => {
        const prop = a.w0 / Math.max(1, a.h0);
        const w = Math.max(20, Math.abs(a.dw) >= Math.abs(a.dh) * prop ? a.w0 + a.dw : (a.h0 + a.dh) * prop);
        return { ...i, largura: w, altura: w / prop };
      }));
    }
    if (a.tipo === 'carimbo' && (a.dw || a.dh)) {
      // a alça fica no canto de cima à esquerda: puxar para a esquerda/para cima aumenta
      mudarFolha((f) => ({ ...f, carimbo: { largura: Math.max(CARIMBO_MIN.largura, a.w0 - a.dw), altura: Math.max(CARIMBO_MIN.altura, a.h0 - a.dh) } }));
    }
    if (a.tipo === 'quadro' && (a.dw || a.dh)) {
      mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, largura: Math.max(40, a.w0 - a.dw), altura: Math.max(0, a.h0 - a.dh) } }));
    }
  };

  // ── o painel do que está selecionado ──────────────────────────────────────
  const itemSel = folha && sel?.tipo === 'item' ? folha.itens.find((i) => i.id === sel.id) ?? null : null;
  const mudarItem = (f: (i: ItemDaFolha) => ItemDaFolha) => folha && itemSel && mudar((p) => noItem(p, folha.id, itemSel.id, f));

  const subirLogo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    logoEmPng(arquivo).then((logo) => mudarEscritorio({ logo }), () => useApp.getState().dizer('Imagem da logo não reconhecida'));
  };

  const [W, H] = folha ? tamanhoDaFolha(folha.formato, folha.orientacao) : [841, 594];
  const larguraPx = Math.min(mesa[0], (mesa[1] * W) / H) * zoom;

  return (
    <div style={s.raiz} data-frente="pranchas">
      <aside style={s.lado}>
        <div style={s.folhas}>
          {pranchas.folhas.map((f, i) => (
            <button key={f.id} type="button" style={{ ...s.chip, ...(f === folha ? s.chipOn : null) }} onClick={() => { setAtiva(f.id); setSel(null); }} title={f.conteudo || undefined}>
              {String(i + 1).padStart(2, '0')}{f.conteudo ? ` · ${f.conteudo}` : ''}
            </button>
          ))}
          <button type="button" style={s.chip} onClick={adicionarFolha} title="Nova folha">+</button>
        </div>

        {folha && !sel && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Folha {String(numero).padStart(2, '0')}</span>
            <Linha rotulo="Conteúdo"><Texto valor={folha.conteudo} aoMudar={(v) => mudarFolha((f) => ({ ...f, conteudo: v }))} /></Linha>
            <Linha rotulo="Formato">
              <select className="campo" value={folha.formato} onChange={(e) => {
                const formato = e.target.value as Formato;
                mudarFolha((f) => ({ ...f, formato, quadro: { ...f.quadro, ...quadroLateralPadrao(formato, f.orientacao, f.carimbo) } }));
              }}>
                {ORDEM_DOS_FORMATOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Linha>
            <Linha rotulo="Orientação">
              <select className="campo" value={folha.orientacao} onChange={(e) => {
                const orientacao = e.target.value as Orientacao;
                mudarFolha((f) => ({ ...f, orientacao, quadro: { ...f.quadro, ...quadroLateralPadrao(f.formato, orientacao, f.carimbo) } }));
              }}>
                <option value="deitada">Deitada</option>
                <option value="em_pe">Em pé</option>
              </select>
            </Linha>
            <button type="button" className="btn-caixa" onClick={excluirFolha}>Excluir folha</button>
          </div>
        )}

        {itemSel && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>{NOMES_DO_CONTEUDO[itemSel.conteudo.tipo]}</span>
            <Linha rotulo="Título"><Texto valor={itemSel.titulo} aoMudar={(v) => mudarItem((i) => ({ ...i, titulo: v }))} /></Linha>
            {itemSel.conteudo.tipo !== '3d' ? (
              <Linha rotulo="Escala">
                <select className="campo" value={String(itemSel.escala ?? '')} onChange={(e) => mudarItem((i) => ({ ...i, escala: Number(e.target.value) }))}>
                  {ESCALAS.map((x) => <option key={x} value={x}>{rotuloDaEscala(x)}</option>)}
                </select>
              </Linha>
            ) : (
              <Linha rotulo="Largura (mm)"><Numero valor={itemSel.largura ?? 150} min={20} aoMudar={(v) => mudarItem((i) => ({ ...i, largura: v, altura: v / ((i.conteudo.tipo === '3d' && i.conteudo.proporcao) || 1.5) }))} /></Linha>
            )}
            {itemSel.conteudo.tipo === 'planta' && modelo && (
              <Linha rotulo="Fiada">
                <select className="campo" value={itemSel.conteudo.fiada} onChange={(e) => mudarItem((i) => ({ ...i, conteudo: { tipo: 'planta', fiada: Number(e.target.value) } }))}>
                  {Array.from({ length: modelo.dims.n_fiadas }, (_, k) => <option key={k} value={k}>{k + 1}ª</option>)}
                </select>
              </Linha>
            )}
            {itemSel.conteudo.tipo === 'iso' && (
              <Linha rotulo="Vista">
                <select className="campo" value={itemSel.conteudo.vista ?? 'frente-direita'} onChange={(e) => mudarItem((i) => ({ ...i, conteudo: { ...(i.conteudo as Extract<ConteudoDoItem, { tipo: 'iso' }>), vista: e.target.value as 'frente-direita' } }))}>
                  <option value="frente-direita">Frente, pela direita</option>
                  <option value="frente-esquerda">Frente, pela esquerda</option>
                  <option value="fundo-direita">Fundo, pela direita</option>
                  <option value="fundo-esquerda">Fundo, pela esquerda</option>
                </select>
              </Linha>
            )}
            <button type="button" className="btn-caixa" onClick={() => excluirItem(itemSel.id)}>Excluir da folha</button>
          </div>
        )}

        {folha && sel?.tipo === 'carimbo' && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Carimbo</span>
            <Linha rotulo="Obra"><Texto valor={pranchas.obra.obra} aoMudar={(v) => mudarObra({ obra: v })} /></Linha>
            <Linha rotulo="Endereço"><Texto valor={pranchas.obra.endereco} aoMudar={(v) => mudarObra({ endereco: v })} /></Linha>
            <Linha rotulo="Proprietário"><Texto valor={pranchas.obra.proprietario} aoMudar={(v) => mudarObra({ proprietario: v })} /></Linha>
            <Linha rotulo="ART"><Texto valor={pranchas.obra.art} aoMudar={(v) => mudarObra({ art: v })} /></Linha>
            <Linha rotulo="Data"><Texto valor={pranchas.obra.data} aoMudar={(v) => mudarObra({ data: v })} /></Linha>
            <Linha rotulo="Revisão"><Texto valor={pranchas.obra.revisao} aoMudar={(v) => mudarObra({ revisao: v })} /></Linha>
            <span style={{ ...s.tituloDoGrupo, marginTop: 6 }}>Escritório</span>
            <Linha rotulo="Empresa"><Texto valor={escritorio.empresa} aoMudar={(v) => mudarEscritorio({ empresa: v })} /></Linha>
            <Linha rotulo="Responsável"><Texto valor={escritorio.responsavel} aoMudar={(v) => mudarEscritorio({ responsavel: v })} /></Linha>
            <Linha rotulo="CREA"><Texto valor={escritorio.crea} aoMudar={(v) => mudarEscritorio({ crea: v })} /></Linha>
            <Linha rotulo="Logomarca">
              <span style={{ display: 'flex', gap: 6 }}>
                <label className="btn-caixa" style={{ cursor: 'pointer' }}>
                  {escritorio.logo ? 'Trocar' : 'Carregar'}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={(e) => subirLogo(e.target.files?.[0])} />
                </label>
                {escritorio.logo && <button type="button" className="btn-caixa" onClick={() => mudarEscritorio({ logo: null })}>Tirar</button>}
              </span>
            </Linha>
            {escritorio.logo && <Linha rotulo="Largura da logo"><Numero valor={escritorio.logoLargura} min={5} aoMudar={(v) => mudarEscritorio({ logoLargura: v })} /></Linha>}
            <Linha rotulo="Largura (mm)"><Numero valor={folha.carimbo.largura} min={CARIMBO_MIN.largura} aoMudar={(v) => mudarFolha((f) => ({ ...f, carimbo: { ...f.carimbo, largura: v } }))} /></Linha>
            <Linha rotulo="Altura (mm)"><Numero valor={folha.carimbo.altura} min={CARIMBO_MIN.altura} aoMudar={(v) => mudarFolha((f) => ({ ...f, carimbo: { ...f.carimbo, altura: v } }))} /></Linha>
          </div>
        )}

        {folha && sel?.tipo === 'quadro' && (
          <div style={s.grupo}>
            <span style={s.tituloDoGrupo}>Quadro lateral</span>
            <Linha rotulo="Largura (mm)"><Numero valor={folha.quadro.largura} min={40} aoMudar={(v) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, largura: v } }))} /></Linha>
            <Linha rotulo="Altura (mm)"><Numero valor={folha.quadro.altura} aoMudar={(v) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, altura: v } }))} /></Linha>
            <Linha rotulo="Legenda"><input type="checkbox" checked={folha.quadro.legenda} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, legenda: e.target.checked } }))} /></Linha>
            <Linha rotulo="Resumo do aço"><input type="checkbox" checked={folha.quadro.quadroDeAco} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, quadroDeAco: e.target.checked } }))} /></Linha>
            <Linha rotulo="Notas">
              <select className="campo" value={folha.quadro.notas === null ? 'auto' : 'proprias'} onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, notas: e.target.value === 'auto' ? null : [...base.notasAutomaticas] } }))}>
                <option value="auto">Automáticas</option>
                <option value="proprias">Editadas</option>
              </select>
            </Linha>
            {folha.quadro.notas !== null && (
              <textarea
                className="campo"
                rows={10}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                value={folha.quadro.notas.join('\n')}
                onChange={(e) => mudarFolha((f) => ({ ...f, quadro: { ...f.quadro, notas: e.target.value.split('\n') } }))}
              />
            )}
          </div>
        )}
      </aside>

      <div style={s.palco}>
        <div style={s.barra}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <span style={{ ...s.rotulo, overflow: 'visible' }}>Adicionar</span>
            <select className="campo" value="" onChange={(e) => e.target.value && adicionarVista(e.target.value as 'frontal')} disabled={!modelo}>
              <option value="">—</option>
              <option value="frontal">Vista frontal</option>
              <option value="corte">Corte</option>
              <option value="planta">Planta</option>
              <option value="iso">Isométrico</option>
            </select>
          </label>
          <span style={{ flex: 1 }} />
          <div className="cad-escolha">
            <button type="button" style={s.botao} onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} title="Diminuir">−</button>
            <button type="button" style={s.botao} onClick={() => setZoom(1)}>Ajustar</button>
            <button type="button" style={s.botao} onClick={() => setZoom((z) => Math.min(6, z * 1.25))} title="Aumentar">+</button>
          </div>
          <div className="cad-escolha">
            <button
              type="button"
              style={s.botao}
              disabled={!pranchas.folhas.length}
              onClick={() => void imprimirPranchas(pranchas.folhas.map((f, i) => comporFolha(f, contexto(i + 1, pranchas.folhas.length, pranchas.obra))))}
            >
              PDF
            </button>
          </div>
        </div>

        <div ref={mesaRef} style={s.mesa} onPointerDown={() => setSel(null)}>
          {composta && folha ? (
            <div style={{ position: 'relative', width: larguraPx, height: (larguraPx * H) / W, margin: '0 auto', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
              <div style={{ position: 'absolute', inset: 0, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: composta.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"') }} />
              <svg
                ref={capaRef}
                viewBox={`0 0 ${W} ${H}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
              >
                {/* os desenhos: clicar seleciona, arrastar move */}
                {composta.itens.map((it) => {
                  const item = folha.itens.find((i) => i.id === it.id);
                  if (!item) return null;
                  const ligado = sel?.tipo === 'item' && sel.id === it.id;
                  const a = arrasto && 'id' in arrasto && arrasto.id === it.id ? arrasto : null;
                  const dx = a?.tipo === 'mover' ? a.dx : 0;
                  const dy = a?.tipo === 'mover' ? a.dy : 0;
                  const [x, y, w, h] = it.caixa;
                  const ww = a?.tipo === 'tamanho' ? Math.max(20, w + a.dw) : w;
                  const hh = a?.tipo === 'tamanho' ? Math.max(15, h + a.dh) : h;
                  return (
                    <g key={it.id}>
                      <rect
                        x={x + dx} y={y + dy} width={ww} height={hh}
                        fill="transparent"
                        stroke={ligado || a ? AZUL : 'transparent'}
                        strokeWidth={0.6}
                        style={{ cursor: 'move' }}
                        onPointerDown={(e) => {
                          setSel({ tipo: 'item', id: it.id });
                          const [px, py] = mm(e);
                          apertar(e, { tipo: 'mover', id: it.id, x0: item.x, y0: item.y, px, py, dx: 0, dy: 0 });
                        }}
                      />
                      {pendenteRotulo(it.pendente, x + dx, y + dy, ww, hh, NOMES_DO_CONTEUDO[item.conteudo.tipo])}
                      {ligado && item.escala === null && (
                        <rect
                          x={x + ww - 2.5} y={y + hh - 2.5} width={5} height={5} fill={AZUL}
                          style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'tamanho', id: it.id, px, py, w0: w, h0: h, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })}
                {/* quadro lateral: a alça no canto de cima à esquerda puxa largura e altura */}
                {composta.quadro && (() => {
                  const [qx, qy, qw, qh] = composta.quadro;
                  const a = arrasto?.tipo === 'quadro' ? arrasto : null;
                  const ligado = sel?.tipo === 'quadro';
                  return (
                    <g>
                      <rect
                        x={qx + (a?.dw ?? 0)} y={qy + (a?.dh ?? 0)} width={qw - (a?.dw ?? 0)} height={qh - (a?.dh ?? 0)}
                        fill="transparent" stroke={ligado || a ? AZUL : composta.quadroEstourou ? '#e0685a' : 'transparent'} strokeWidth={0.6}
                        onPointerDown={(e) => { e.stopPropagation(); setSel({ tipo: 'quadro' }); }}
                      />
                      {ligado && (
                        <rect
                          x={qx + (a?.dw ?? 0) - 2.5} y={qy + (a?.dh ?? 0) - 2.5} width={5} height={5} fill={AZUL} style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'quadro', px, py, w0: folha.quadro.largura, h0: qh, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })()}
                {/* carimbo: mesma alça, no canto de cima à esquerda */}
                {(() => {
                  const [cx, cy, cw, ch] = composta.carimbo;
                  const a = arrasto?.tipo === 'carimbo' ? arrasto : null;
                  const ligado = sel?.tipo === 'carimbo';
                  return (
                    <g>
                      <rect
                        x={cx + (a?.dw ?? 0)} y={cy + (a?.dh ?? 0)} width={cw - (a?.dw ?? 0)} height={ch - (a?.dh ?? 0)}
                        fill="transparent" stroke={ligado || a ? AZUL : 'transparent'} strokeWidth={0.6}
                        onPointerDown={(e) => { e.stopPropagation(); setSel({ tipo: 'carimbo' }); }}
                      />
                      {ligado && (
                        <rect
                          x={cx + (a?.dw ?? 0) - 2.5} y={cy + (a?.dh ?? 0) - 2.5} width={5} height={5} fill={AZUL} style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            const [px, py] = mm(e);
                            apertar(e, { tipo: 'carimbo', px, py, w0: cw, h0: ch, dw: 0, dh: 0 });
                          }}
                        />
                      )}
                    </g>
                  );
                })()}
              </svg>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <button type="button" className="btn-caixa" onClick={adicionarFolha}>Nova folha</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** O lugar de um desenho que ainda não chegou: o nome no meio do quadro tracejado. */
function pendenteRotulo(pendente: boolean, x: number, y: number, w: number, h: number, nome: string) {
  if (!pendente) return null;
  return (
    <text x={x + w / 2} y={y + h / 2} textAnchor="middle" fontSize={Math.min(6, h / 6)} fill="#8a8a8a" style={{ pointerEvents: 'none', fontFamily: 'Arial, sans-serif' }}>
      {nome}
    </text>
  );
}
