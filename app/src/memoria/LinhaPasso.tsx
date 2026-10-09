/*
  UMA LINHA DA MEMÓRIA: símbolo = fórmula = números = resultado unidade, e — se a linha termina numa desigualdade —
  o chip curto à direita ("OK · 56%" / "NÃO PASSA · 112%"), padrão da memória de pele do Pró-Viga. Nada de frase
  de veredito: a desigualdade já diz.
*/
import { Fragment } from 'react';
import type { Resultado } from '@/motor/tipos';
import type { Passo, Verificacao } from './tipos';
import { Tex } from './Tex';
import { texDaLinha, textoDoChip } from './linha';
import { useRegua } from './estilos';

export function Chip({ v }: { v: Verificacao }) {
  const { R } = useRegua();
  return (
    <span
      className="mem-chip"
      style={{
        fontFamily: R.fonte,
        fontSize: R.chip,
        fontWeight: 600,
        color: v.passa ? R.ok : R.falha,
        whiteSpace: 'nowrap',
        marginLeft: 12,
      }}
    >
      {textoDoChip(v)}
    </span>
  );
}

export function LinhaPasso({ passo, r }: { passo: Passo; r: Resultado }) {
  const { papel, R } = useRegua();
  const adotado = passo.origem === 'adotado';
  // Valor adotado (escolha do projetista sobre a sugestão da planilha) ganha só um filete à esquerda.
  const marca = adotado ? { borderLeft: `2px solid ${R.aviso}`, paddingLeft: 18 } : { paddingLeft: 20 };
  if (papel) {
    // No papel (e no Word) o chip corre na mesma linha do texto: um flex viraria duas linhas no Word.
    return (
      <div className="mem-linha" style={{ margin: '3pt 0', fontSize: R.corpo, color: R.tinta, ...marca }}>
        <Tex tex={texDaLinha(passo, r)} quebra />
        {/* o respiro antes do chip é CARACTERE (espaço eme): margem em <span> o Word joga fora. No Word o chip
            ainda desce para a linha de baixo (word.ts, separaChips), para a equação continuar "de exibição". */}
        {passo.verif && (
          <>
            {'\u2003'}
            <Chip v={passo.verif} />
          </>
        )}
      </div>
    );
  }
  return (
    <div
      className="mem-linha"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        margin: '7px 0',
        fontSize: R.corpo,
        color: R.tinta,
        ...marca,
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        <Tex tex={texDaLinha(passo, r)} quebra />
      </div>
      {passo.verif && <Chip v={passo.verif} />}
    </div>
  );
}

/**
  Dados de entrada lado a lado (h = 1,60 m    q = 2,0 kPa ...), como no Pró-Viga — uma fórmula por dado, para que
  a linha quebre entre eles e não no meio de um.
*/
export function LinhaDeDados({ passos, r }: { passos: Passo[]; r: Resultado }) {
  const { papel, R } = useRegua();
  return (
    <div
      className="mem-linha mem-dados"
      style={{
        display: papel ? 'block' : 'flex',
        flexWrap: 'wrap',
        columnGap: 28,
        rowGap: 2,
        paddingLeft: 20,
        margin: papel ? '3pt 0' : '7px 0',
        fontSize: R.corpo,
        color: R.tinta,
      }}
    >
      {passos.map((p, i) => (
        <Fragment key={p.id + i}>
          {/* papel/Word: o separador é TEXTO (dois espaços eme). Margem em <span> o Word joga fora e as equações
              colavam em "h = 2,00 mq = 5,0 kPa…" (medido abrindo o .doc no Word). */}
          {papel && i > 0 && '\u2003\u2003'}
          <span>
            <Tex tex={texDaLinha(p, r)} />
          </span>
        </Fragment>
      ))}
    </div>
  );
}
