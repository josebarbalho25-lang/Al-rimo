/*
  TABELA-RESUMO DAS VERIFICAÇÕES — vem antes das contas no memorial (regra do dono: quem assina lê o resumo
  primeiro). Lê a MESMA Verificacao do chip da linha: uma régua só para "passa".
*/
import type { Card } from './tipos';
import { verificacoesDe } from './cards';
import { nbr } from './formato';
import { useRegua } from './estilos';

export function TabelaResumo({ cards }: { cards: Card[] }) {
  const { papel, R } = useRegua();
  const linhas = verificacoesDe(cards);
  if (linhas.length === 0) return null;
  const td = {
    padding: papel ? '1.5pt 4pt' : '4px 8px',
    borderBottom: `1px solid ${R.filete}`,
    fontSize: R.tabela,
    color: R.tinta,
  } as const;
  const th = { ...td, fontWeight: 600, color: R.tinta2, textAlign: 'left' as const };
  const num = { ...td, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const };
  return (
    // na tela, 1080 no máximo: o card cresceu por causa das figuras, e a tabela esticada afastava o número do nome
    <table className="mem-resumo" style={{ width: '100%', maxWidth: papel ? undefined : 1080, borderCollapse: 'collapse', fontFamily: R.fonte }}>
      <thead>
        <tr>
          <th style={th}>Verificação</th>
          <th style={{ ...th, textAlign: 'right' }}>Valor</th>
          <th style={{ ...th, textAlign: 'right' }}>Limite</th>
          <th style={{ ...th, textAlign: 'right' }}>Uso</th>
          <th style={th}></th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(({ card, v, casas, unidade }) => (
          <tr key={card.id + v.chave}>
            <td style={td}>
              {v.rotulo}
              <span style={{ color: R.apagado }}> · {card.titulo}</span>
            </td>
            <td style={num}>
              {v.valor === null ? '—' : nbr(v.valor, casas)}
              {unidade ? ` ${unidade}` : ''}
            </td>
            <td style={num}>{v.limite === null ? '—' : nbr(v.limite, Number.isInteger(v.limite) ? 0 : casas)}</td>
            <td style={num}>{v.util === null ? '—' : `${Math.round(v.util)}%`}</td>
            <td style={{ ...td, fontWeight: 600, color: v.passa ? R.ok : R.falha, whiteSpace: 'nowrap' }}>
              {v.passa ? 'OK' : 'NÃO PASSA'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
