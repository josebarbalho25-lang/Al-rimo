// ═══════════════════════════════════════════════════════════════════════════
//  ui/Palco.tsx — as abas da Gráfica e o que cada seção mostra
// ---------------------------------------------------------------------------
//  Abas FIXAS (sem ✕) na Gráfica: 3D, as vistas 2D e as Pranchas. A Memória e
//  o Quantitativo eram abas até 20/10 e viraram seção do trilho; o conteúdo
//  continua vindo da mesma tomada (`ligacoes.abas`), o palco só recebe qual.
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
  IconeArmacao,
  IconeMemoria,
  IconePlantaDoMuro,
  IconePranchas,
  IconeQuantitativo,
} from './icones';
import type { IdAba } from '@/estado/ligacoes';
import { ABAS, useApp } from '@/estado/store';

export const ICONE_DA_ABA: Record<IdAba, Icone> = {
  '3d': Icone3D,
  frontal: IconeFrontal,
  corte: IconeCorteDoMuro,
  planta: IconePlantaDoMuro,
  iso: IconeIsometrico,
  armacao: IconeArmacao,
  memoria: IconeMemoria,
  quantitativo: IconeQuantitativo,
  pranchas: IconePranchas,
};

/** As abas que moram na Gráfica (as outras são seção do trilho). */
const FORA_DA_GRAFICA = new Set<IdAba>(['memoria', 'quantitativo']);
export const ABAS_DA_GRAFICA = ABAS.filter((a) => !FORA_DA_GRAFICA.has(a.id));

/** A aba da Gráfica aberta: a lembrada, ou o 3D quando a lembrada era a Memória ou o Quantitativo (antes de 20/10). */
export const abaDaGrafica = (aba: IdAba): IdAba => (FORA_DA_GRAFICA.has(aba) ? '3d' : aba);

export function AbasDoPalco() {
  const aba = useApp((s) => abaDaGrafica(s.aba));
  const escolher = useApp((s) => s.escolherAba);
  return (
    <div className="abas-vista" role="tablist">
      {ABAS_DA_GRAFICA.map(({ id, nome }) => {
        const I = ICONE_DA_ABA[id];
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

export function Palco({ aba }: { aba: IdAba }) {
  const conteudo = useApp((s) => s.ligacoes.abas[aba]);
  const modelo = useApp((s) => s.modelo);
  const resultado = useApp((s) => s.resultado);
  const selecionado = useApp((s) => s.selecionado);
  const selecionar = useApp((s) => s.selecionar);
  const Vazio = ICONE_DA_ABA[aba];

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
