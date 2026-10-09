// ═══════════════════════════════════════════════════════════════════════════
//  ui/Palco.tsx — as abas e o que cada uma mostra
// ---------------------------------------------------------------------------
//  Abas FIXAS (sem ✕): o muro tem sempre as mesmas sete folhas. A barra fica
//  sobre o palco e não sobre a tela inteira — a aba pertence ao desenho, não à
//  janela (como no A-PORT e no Revit).
//
//  O conteúdo de cada aba é ligado pela integração (`ligar({ abas })`). Até
//  lá, o palco mostra só o ícone da aba, apagado. Nome de componente
//  ("Visor3D") não vai para a tela: se uma peça não chegar a tempo, o que o
//  Jose vê é um palco vazio, não código.
// ═══════════════════════════════════════════════════════════════════════════

import type { Icone } from './icones';
import {
  Icone3D,
  IconeCorteDoMuro,
  IconeFrontal,
  IconeIsometrico,
  IconeMemoria,
  IconePlantaDoMuro,
  IconeQuantitativo,
} from './icones';
import type { IdAba } from '@/estado/ligacoes';
import { ABAS, useApp } from '@/estado/store';

const ICONE: Record<IdAba, Icone> = {
  '3d': Icone3D,
  frontal: IconeFrontal,
  corte: IconeCorteDoMuro,
  planta: IconePlantaDoMuro,
  iso: IconeIsometrico,
  memoria: IconeMemoria,
  quantitativo: IconeQuantitativo,
};

export function AbasDoPalco() {
  const aba = useApp((s) => s.aba);
  const escolher = useApp((s) => s.escolherAba);
  return (
    <div className="abas-vista" role="tablist">
      {ABAS.map(({ id, nome }) => {
        const I = ICONE[id];
        return (
          <div
            key={id}
            role="tab"
            tabIndex={0}
            aria-selected={aba === id}
            className={`aba-vista${aba === id ? ' on' : ''}`}
            onClick={() => escolher(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                escolher(id);
              }
            }}
          >
            <I />
            <span className="aba-nome">{nome}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Palco() {
  const aba = useApp((s) => s.aba);
  const conteudo = useApp((s) => s.ligacoes.abas[s.aba]);
  const modelo = useApp((s) => s.modelo);
  const resultado = useApp((s) => s.resultado);
  const selecionado = useApp((s) => s.selecionado);
  const selecionar = useApp((s) => s.selecionar);
  const Vazio = ICONE[aba];

  return (
    <main className="palco" role="tabpanel">
      {conteudo ? (
        conteudo({ modelo, resultado, selecionado, selecionar })
      ) : (
        <div className="marcador-de-lugar" aria-hidden="true">
          <Vazio tamanho={56} />
        </div>
      )}
    </main>
  );
}
