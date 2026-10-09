// ═══════════════════════════════════════════════════════════════════════════
//  visor/PainelDaPeca.tsx — o que é a peça pega: rótulo + valor, e só
// ---------------------------------------------------------------------------
//  Regra do Jose: painel é rótulo + valor + controle; nada de texto que
//  explique. Os nomes dos tipos ficam aqui, em português de obra.
// ═══════════════════════════════════════════════════════════════════════════

import type { Modelo, PapelBarra, TipoPeca } from '@/modelo/tipos';
import type { Pego } from './cena3d';
import { IconeFechar } from './icones';

export const NOME_DO_TIPO: Record<TipoPeca, string> = {
  BLOCO: 'Bloco',
  MEIO_BLOCO: 'Meio bloco',
  BLOCO_JUNCAO: 'Bloco de amarração',
  BLOCO_CORTADO: 'Bloco cortado',
  CANALETA: 'Canaleta',
  MEIA_CANALETA: 'Meia canaleta',
  CANALETA_CORTADA: 'Canaleta cortada',
  GRAUTE_FURO: 'Graute do furo',
  GRAUTE_CANALETA: 'Graute da canaleta',
  SAPATA: 'Sapata',
  DRENO: 'Dreno (brita)',
  MANTA: 'Manta',
  BARBACA: 'Barbacã',
  ATERRO: 'Aterro',
  SOLO_FRENTE: 'Solo da frente',
};

export const NOME_DO_PAPEL: Record<PapelBarra, string> = {
  VERT_MURO: 'Vertical do muro',
  ESPERA: 'Espera',
  HORIZ: 'Horizontal',
  CF_PRINCIPAL: 'Contraforte, principal',
  CF_CONSTRUTIVA: 'Contraforte, construtiva',
  CF_ESTRIBO: 'Contraforte, estribo',
  SAP_TRANSV: 'Sapata, transversal',
  SAP_LONG: 'Sapata, longitudinal',
  SAP_TORCAO: 'Sapata, torção',
};

const num = (v: number, casas: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
/** Bitola como na tabela: 10, 12,5, 6,3. */
const bitola = (d: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(d);

export function linhasDaPeca(pego: Pego, modelo: Modelo): [string, string][] {
  if (pego.tipo === 'barra') {
    const b = pego.barra;
    const l: [string, string][] = [
      ['Barra', b.id],
      ['Posição', b.posicao],
      ['Tipo', NOME_DO_PAPEL[b.papel] ?? b.papel],
      ['Ø', `${bitola(b.diametro)} mm`],
      ['Comprimento', `${num(b.comprimento / 1000, 2)} m`],
      ['Trecho', String(b.trecho)],
    ];
    if (b.contraforte != null) l.push(['Contraforte', String(b.contraforte)]);
    return l;
  }
  const p = pego.peca;
  const g = modelo.geometrias[p.geometria];
  const l: [string, string][] = [
    ['Peça', p.id],
    ['Tipo', NOME_DO_TIPO[p.tipo] ?? p.tipo],
  ];
  if (g?.catalogo) l.push(['Catálogo', g.catalogo]);
  // Fiada contada a partir de 1, como na obra (no modelo a de baixo é 0).
  if (p.fiada != null) l.push(['Fiada', String(p.fiada + 1)]);
  l.push(['Trecho', String(p.trecho)]);
  if (p.contraforte != null) l.push(['Contraforte', String(p.contraforte)]);
  return l;
}

export function PainelDaPeca({ pego, modelo, aoFechar }: { pego: Pego; modelo: Modelo; aoFechar: () => void }) {
  const linhas = linhasDaPeca(pego, modelo);
  // O tipo vai no cabeçalho; no corpo, o resto.
  const tipo = linhas.find(([r]) => r === 'Tipo')?.[1] ?? '';
  return (
    <div className="v3-props" onPointerDown={(e) => e.stopPropagation()}>
      <div className="v3-props-cabeca">
        <span>{tipo}</span>
        <button type="button" className="v3-btn v3-btn-mini" title="Limpar seleção" onClick={aoFechar}>
          <IconeFechar tamanho={13} />
        </button>
      </div>
      <dl className="v3-props-corpo">
        {linhas.filter(([r]) => r !== 'Tipo').map(([r, v]) => (
          <div className="v3-prop" key={r}>
            <dt>{r}</dt>
            <dd className="v3-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
