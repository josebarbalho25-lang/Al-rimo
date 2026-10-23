// ═══════════════════════════════════════════════════════════════════════════
//  ui/grafica/Navegador.tsx — o navegador de projeto da Gráfica
// ---------------------------------------------------------------------------
//  O do A-PORT (e o do Revit): as vistas do muro em pastas por tipo — 3D,
//  Elevações, Cortes, Plantas, Isométricos, Armação — e as Pranchas. Um clique
//  abre a vista numa aba (ou traz para a frente a que já está aberta); F2 ou
//  "Renomear" na faixa reescreve o nome no lugar. Ao lado do nome, a escala da
//  vista e, se ela já está numa folha, o número da folha.
//
//  Na outra aba do painel, as PROPRIEDADES do que está na frente: quem enche é
//  quem desenha (a aba de desenho põe a escala, o corte, a fiada; a tela das
//  pranchas põe a folha e o desenho escolhido) — o painel só dá o lugar.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useState, type ReactNode } from 'react';
import { useApp } from '@/estado/store';
import type { IdAba } from '@/estado/ligacoes';
import { chaveDaAberta, useEncaixes, useGrafica, type Aberta } from '@/estado/grafica';
import { rotuloDaEscala } from '@/pranchas/formatos';
import { ondeEstaAVista, vistasDoTipo } from '@/pranchas/vistas';
import type { PranchasDoProjeto, VistaDoProjeto } from '@/pranchas/tipos';
import { Chevron } from '@/ui/icones';
import { confirmarNome, excluir, trazer, useFrente } from './comandos';

interface Item {
  aberta: Aberta;
  /** O id que se renomeia (a vista ou a folha); null = não se renomeia (o 3D do visor). */
  id: string | null;
  nome: string;
  extra: string;
}

interface Pasta {
  nome: string;
  itens: Item[];
}

const numero = (n: number) => String(n).padStart(2, '0');

/** A escala e a folha, em miúdo ao lado do nome: "1:25 · 01". */
function extraDaVista(p: PranchasDoProjeto, v: VistaDoProjeto): string {
  const onde = ondeEstaAVista(p, v.id);
  const partes = [v.escala ? rotuloDaEscala(v.escala) : '', onde ? `folha ${numero(onde.numero)}` : ''];
  return partes.filter(Boolean).join(' · ');
}

const PASTAS_2D: ReadonlyArray<[Exclude<IdAba, '3d' | 'pranchas' | 'memoria' | 'quantitativo'>, string]> = [
  ['frontal', 'Elevações'],
  ['corte', 'Cortes'],
  ['planta', 'Plantas'],
  ['iso', 'Isométricos'],
  ['armacao', 'Armação'],
];

/** As pastas do navegador, na ordem do protótipo de 20/10. */
export function pastasDoNavegador(p: PranchasDoProjeto): Pasta[] {
  const vistas3d = vistasDoTipo(p, '3d').map<Item>((v) => ({ aberta: { aba: '3d', id: null }, id: v.id, nome: v.nome, extra: extraDaVista(p, v) }));
  const pastas: Pasta[] = [{ nome: '3D', itens: [{ aberta: { aba: '3d', id: null }, id: null, nome: 'Visor 3D', extra: '' }, ...vistas3d] }];
  for (const [tipo, nome] of PASTAS_2D) {
    pastas.push({ nome, itens: vistasDoTipo(p, tipo).map((v) => ({ aberta: { aba: tipo, id: v.id }, id: v.id, nome: v.nome, extra: extraDaVista(p, v) })) });
  }
  pastas.push({
    nome: 'Pranchas',
    itens: p.folhas.map((f, i) => ({ aberta: { aba: 'pranchas', id: f.id }, id: f.id, nome: f.conteudo ? `${numero(i + 1)} · ${f.conteudo}` : numero(i + 1), extra: `${f.formato}` })),
  });
  return pastas;
}

export function PainelDaGrafica() {
  const painel = useGrafica((s) => s.painel);
  const verPainel = useGrafica((s) => s.verPainel);
  const recolhido = useGrafica((s) => s.recolhido);
  const alternar = useGrafica((s) => s.alternarPainel);
  const publicar = useEncaixes((s) => s.publicar);
  if (recolhido) {
    return (
      <div className="navegador recolhido">
        <button type="button" className="faixa-entradas" title="Mostrar o navegador" aria-label="Mostrar o navegador" onClick={alternar}>
          <Chevron />
          <span>Navegador</span>
        </button>
        {/* recolhido, as Propriedades continuam com lugar (escondido): sem ele o desenho as punha por cima da vista
            (Jose, 23/10: "quer ver propriedade abre a aba de novo") */}
        <div hidden ref={(el) => publicar('propriedades', el)} />
      </div>
    );
  }
  return (
    <aside className="navegador" aria-label="Navegador">
      <div className="navegador-abas" role="tablist">
        <Aba ligada={painel === 'navegador'} aoClicar={() => verPainel('navegador')}>Navegador</Aba>
        <Aba ligada={painel === 'propriedades'} aoClicar={() => verPainel('propriedades')}>Propriedades</Aba>
        <button type="button" className="btn-icone btn-recolher" title="Recolher" aria-label="Recolher o navegador" onClick={alternar}>
          <Chevron />
        </button>
      </div>
      <div className="navegador-corpo" hidden={painel !== 'navegador'}>
        <Arvore />
      </div>
      {/* sempre montado (escondido): os portais de quem desenha não caem e voltam a cada troca de aba do painel */}
      <div className="navegador-corpo propriedades" hidden={painel !== 'propriedades'} ref={(el) => publicar('propriedades', el)} />
    </aside>
  );
}

function Aba({ ligada, aoClicar, children }: { ligada: boolean; aoClicar: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={ligada} className={`navegador-aba${ligada ? ' on' : ''}`} onClick={aoClicar}>
      {children}
    </button>
  );
}

function Arvore() {
  const pranchas = useApp((s) => s.pranchas);
  const frente = useFrente();
  const renomeando = useGrafica((s) => s.renomeando);
  const renomear = useGrafica((s) => s.renomear);
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(new Set());
  const [escolhido3d, setEscolhido3d] = useState<string | null>(null);
  const pastas = pastasDoNavegador(pranchas);
  const chaveDaFrente = frente ? chaveDaAberta(frente) : null;

  return (
    <div className="arvore" role="tree" aria-label="Vistas e pranchas">
      {pastas.map((pasta) => {
        const fechada = fechadas.has(pasta.nome);
        return (
          <div key={pasta.nome} role="treeitem" aria-expanded={!fechada} aria-selected={false}>
            <button
              type="button" className="arvore-pasta"
              onClick={() => setFechadas((s) => { const n = new Set(s); if (n.has(pasta.nome)) n.delete(pasta.nome); else n.add(pasta.nome); return n; })}
            >
              <span className="arvore-seta" data-fechada={fechada || undefined}><Chevron /></span>
              <span className="arvore-nome">{pasta.nome}</span>
              <span className="arvore-extra">{pasta.itens.length}</span>
            </button>
            {!fechada && (
              <div role="group">
                {pasta.itens.map((it) => {
                  const ligado = it.aberta.aba === '3d' && it.id ? escolhido3d === it.id : chaveDaAberta(it.aberta) === chaveDaFrente && (it.aberta.aba !== '3d' || !escolhido3d);
                  if (it.id && renomeando === it.id) {
                    return <NomeNoLugar key={it.id} inicial={it.nome.replace(/^\d\d · /, '').replace(/^\d\d$/, '')} aoFim={(nome) => { if (nome !== null) confirmarNome(it.id!, nome); renomear(null); }} />;
                  }
                  return (
                    <button
                      key={it.id ?? 'visor'} type="button" role="treeitem" aria-selected={ligado}
                      className={`arvore-item${ligado ? ' on' : ''}`}
                      data-chave={it.id ?? 'visor'}
                      onClick={() => {
                        setEscolhido3d(it.aberta.aba === '3d' ? it.id : null);
                        trazer(it.aberta);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'F2' && it.id) { e.preventDefault(); renomear(it.id); }
                        if (e.key === 'Delete' && it.aberta.aba === '3d' && it.id) { e.preventDefault(); excluir(it.id); }
                      }}
                      onDoubleClick={() => it.id && renomear(it.id)}
                      title={it.nome}
                    >
                      <span className="arvore-nome">{it.nome}</span>
                      <span className="arvore-extra">{it.extra}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** O nome reescrito no lugar do item: Enter confirma, Esc desiste, sair do campo confirma. */
function NomeNoLugar({ inicial, aoFim }: { inicial: string; aoFim: (nome: string | null) => void }) {
  const [texto, setTexto] = useState(inicial);
  // o Enter tira o campo da tela, e a saída do foco viria depois com o mesmo nome: uma vez só
  const feito = useRef(false);
  const fim = (nome: string | null) => {
    if (feito.current) return;
    feito.current = true;
    aoFim(nome);
  };
  return (
    <input
      className="campo arvore-campo" autoFocus aria-label="Nome" value={texto}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => fim(texto)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); fim(texto); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fim(null); }
      }}
    />
  );
}
