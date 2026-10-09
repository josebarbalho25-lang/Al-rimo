/*
  O CARD DA MEMÓRIA — esqueleto que o Jose padronizou no Pró-Viga (23/jun) e cobra "pra não ter de voltar
  repadronizando": coluna da conta (flex 1 1 450, até 580) + figura à direita; seções "n · título" com a referência
  em cinza; legenda dos símbolos no rodapé SÓ NA TELA (no papel ela vira o glossário único depois do índice).
*/
import type { Resultado } from '@/motor/tipos';
import type { Card, Passo } from './tipos';
import { Tex } from './Tex';
import { LinhaDeDados, LinhaPasso } from './LinhaPasso';
import { useRegua } from './estilos';
import { textoDaRef } from './formato';
import { simbolosDoCard } from './glossario';
import { descricao } from './simbolos';
import { figuraDoCard, type FiguraDoCard } from './figuraDoCard';

/** A figura do card: o resolvedor dado (bancada, teste) ou o acervo das entradas. */
function resolverFigura(figura: string | undefined, urlDaFigura?: (figura: string) => string | null): FiguraDoCard | null {
  if (!figura) return null;
  if (urlDaFigura) {
    const url = urlDaFigura(figura);
    return url ? { url, titulo: figuraDoCard(figura)?.titulo ?? figura } : null;
  }
  return figuraDoCard(figura);
}

export interface PropsDoCard {
  card: Card;
  r: Resultado;
  /** Numeração do documento ("4.1"); na tela o card não leva número. */
  numero?: string;
  /** Endereço da figura ('Fig. 11' → url). Sem resolvedor, vale o acervo das entradas (figuras/mapa). */
  urlDaFigura?: (figura: string) => string | null;
}

const ehDado = (p: Passo) => p.origem === 'entrada' && !p.expr && !p.verif;

/** Junta dados de entrada vizinhos numa linha só; o resto vai uma conta por linha. */
function blocos(passos: Passo[]): (Passo | Passo[])[] {
  const out: (Passo | Passo[])[] = [];
  for (const p of passos) {
    const ult = out[out.length - 1];
    if (ehDado(p) && Array.isArray(ult)) ult.push(p);
    else out.push(ehDado(p) ? [p] : p);
  }
  return out;
}

export function CardMemoria({ card, r, numero, urlDaFigura }: PropsDoCard) {
  const { papel, R } = useRegua();
  const fig = resolverFigura(card.figura, urlDaFigura);
  const ref = textoDaRef(card.ref);

  return (
    <section className="mem-card" id={`mem-${card.id}`} style={{ fontFamily: R.fonte, color: R.tinta }}>
      <div className="mem-cab" style={{ marginBottom: papel ? '4pt' : 10 }}>
        <span style={{ fontSize: R.titulo, fontWeight: 700 }}>
          {numero ? `${numero} ` : ''}
          {card.titulo}
        </span>
        {ref && <span style={{ fontSize: R.nota, color: R.apagado }}> · {ref}</span>}
      </div>

      {card.avisos.length > 0 && (
        <div
          className="mem-avisos"
          style={{
            fontSize: R.nota,
            color: R.falha,
            border: `1px solid ${R.falha}`,
            background: papel ? '#FBF0EE' : 'color-mix(in srgb, var(--err, #B33A2C) 11%, transparent)',
            padding: papel ? '3pt 6pt' : '6px 10px',
            margin: papel ? '0 0 4pt' : '0 0 10px',
          }}
        >
          {card.avisos.map((a, i) => (
            <div key={i}>⚠ {a}</div>
          ))}
        </div>
      )}

      {card.desenho && (
        // Figura gerada para ESTE muro (ex.: seção do contraforte cotada): largura cheia, antes da conta — as cotas têm
        // de ser lidas, e na coluna estreita da figura do acervo o texto do desenho ficaria ilegível.
        <figure className="mem-desenho" style={{ margin: papel ? '0 0 4pt' : '0 0 12px', maxWidth: papel ? '150mm' : 660 }}>
          <figcaption style={{ fontSize: R.nota, color: R.apagado, marginBottom: papel ? '2pt' : 4 }}>{card.desenho.titulo}</figcaption>
          <div
            role="img"
            aria-label={card.desenho.titulo}
            style={{
              background: papel ? undefined : 'var(--papel, #ffffff)',
              borderRadius: papel ? undefined : 4,
              lineHeight: 0,
            }}
            dangerouslySetInnerHTML={{ __html: card.desenho.svg }}
          />
        </figure>
      )}

      <div
        className="mem-corpo"
        style={{ display: 'flex', gap: papel ? 18 : 30, alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        <div style={{ flex: '1 1 450px', maxWidth: papel ? undefined : 580, minWidth: 0 }}>
          {card.secoes.map((s, i) => (
            <div key={i} className="mem-secao">
              <div
                className="mem-secao-titulo"
                style={{
                  fontSize: R.secao,
                  fontWeight: 600,
                  color: R.tinta2,
                  marginTop: papel ? (i ? '6pt' : '2pt') : i ? 18 : 6,
                  marginBottom: papel ? '2pt' : 6,
                }}
              >
                {i + 1} · {s.titulo}
                {s.ref && (
                  <span style={{ fontSize: R.nota, fontWeight: 400, color: R.apagado }}> · {textoDaRef(s.ref)}</span>
                )}
              </div>
              {blocos(s.passos).map((b, j) =>
                Array.isArray(b) ? (
                  <LinhaDeDados key={j} passos={b} r={r} />
                ) : (
                  <LinhaPasso key={j} passo={b} r={r} />
                ),
              )}
            </div>
          ))}
        </div>
        {fig && (
          <figure className="mem-fig" style={{ flex: papel ? '0 0 auto' : '0 0 340px', margin: 0, maxWidth: '100%' }}>
            <figcaption style={{ fontSize: R.nota, color: R.apagado, marginBottom: papel ? '2pt' : 4 }}>{fig.titulo}</figcaption>
            <img
              src={fig.url}
              alt={fig.titulo}
              style={{
                display: 'block',
                maxWidth: '100%',
                height: papel ? '42mm' : 'auto',
                width: papel ? 'auto' : '100%',
                // o desenho é de papel (fundo claro, traço escuro): no tema escuro ele fica numa folha, não some
                background: papel ? undefined : 'var(--papel, #ffffff)',
                borderRadius: papel ? undefined : 4,
                padding: papel ? undefined : 6,
                boxSizing: 'border-box',
              }}
            />
          </figure>
        )}
      </div>

      {!papel && <Legenda card={card} />}
    </section>
  );
}

/** Legenda de rodapé do card (só tela): os símbolos que ESTE card desenha. */
function Legenda({ card }: { card: Card }) {
  const { R } = useRegua();
  const simbolos = simbolosDoCard(card);
  if (simbolos.length === 0) return null;
  return (
    <div className="mem-legenda" style={{ marginTop: 18, borderTop: `1px solid ${R.filete}`, paddingTop: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          columnGap: 18,
        }}
      >
        {simbolos.map((s) => (
          <div
            key={s}
            style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: R.nota, color: R.apagado, lineHeight: 1.7 }}
          >
            <span style={{ minWidth: 38, color: R.tinta }}>
              <Tex tex={s} />
            </span>
            <span>{descricao(s)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
