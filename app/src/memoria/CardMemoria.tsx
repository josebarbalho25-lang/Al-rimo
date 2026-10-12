/*
  O CARD DA MEMÓRIA — esqueleto que o Jose padronizou no Pró-Viga (23/jun) e cobra "pra não ter de voltar
  repadronizando": coluna da conta (flex 1 1 450, até 580) + coluna da direita com as figuras; seções "n · título"
  com a referência em cinza; legenda dos símbolos no rodapé SÓ NA TELA (no papel ela vira o glossário único depois
  do índice).

  A COLUNA DA DIREITA (só tela; Jose, 12/10: "olha o tanto de espaço sobrando ... tirando prints pra medir os
  espaços"). Medido no app dele (janela de 1920): a conta tem 580, e a figura saía com 340 × 222 num vão de 470 × a
  altura da conta, a letra do desenho com ~5 px. Agora o card vai a 1320 (memoria.css) e a direita é ocupada:
    - a figura do acervo, recortada na caixa do desenho (figuraDoCard.ts), é o maior desenho que cabe no vão: a
      largura da coluna e a altura da conta que sobra (nunca menos que FIG_MIN);
    - os desenhos gerados para o muro (faixa da flexão, seção do contraforte...) vão para a direita do grupo deles
      quando a coluna tem largura para a letra (LADO_DESENHO); em tela menor voltam à largura cheia, antes do grupo;
    - a direita fica PARADA no alto do grupo. Ela chegou a acompanhar a rolagem (sticky) e o Jose viu as figuras
      "dançando pra baixo e pra cima" ao rolar (12/10: "trava elas"): figura de referência não anda.
  O vão é MEDIDO (ResizeObserver no card e nas colunas da conta), não adivinhado: a conta muda de altura com o muro e
  com a fonte da fórmula. No papel nada disso: a figura vai inteira, da mesma altura em todos os cards (imprimir.tsx),
  e o Word lê a árvore do papel.
*/
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { Resultado } from '@/motor/tipos';
import type { Card, Desenho, Passo, Secao } from './tipos';
import { Tex } from './Tex';
import { LinhaDeDados, LinhaPasso } from './LinhaPasso';
import { useRegua } from './estilos';
import { textoDaRef } from './formato';
import { simbolosDoCard } from './glossario';
import { descricao } from './simbolos';
import { figuraDoCard, urlRecortada, type FiguraDoCard } from './figuraDoCard';

const CONTA = 580;          // px: a coluna da conta, no máximo
const VAO = 30;             // px: entre a conta e a direita
const LADO_DESENHO = 600;   // px: a direita precisa disto para um desenho gerado ir para lá (a letra fica ≥ ~11 px)
const FIG_MIN = 240;        // px: a figura do acervo nunca fica mais baixa que isto, mesmo com a conta curta
const FIG_EMBAIXO = 360;    // px: altura da figura quando a direita quebra para baixo da conta (tela estreita)
const LEGENDA = 20;         // px: a linha "Fig. n — título" em cima do desenho (16 de linha + 4 de folga)
const ENTRE = 16;           // px: entre dois desenhos da direita

/**
  A figura do card: o resolvedor dado (o app, a bancada) ou o acervo das entradas. O recorte vem sempre do acervo:
  é a caixa do desenho no próprio SVG, vale para qualquer endereço do mesmo arquivo.
*/
function resolverFigura(figura: string | undefined, urlDaFigura?: (figura: string) => string | null): FiguraDoCard | null {
  if (!figura) return null;
  const acervo = figuraDoCard(figura);
  if (urlDaFigura) {
    const url = urlDaFigura(figura);
    if (!url) return null;
    return { url, titulo: acervo?.titulo ?? figura, ...(acervo?.recorte && /\.svg$/i.test(url) ? { recorte: acervo.recorte } : {}) };
  }
  return acervo;
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

/** A largura da direita num card de largura W — a mesma conta do flex (conta 450 + 30 + direita 340, a conta até 580). */
function larguraDoLado(W: number): { lado: number; embaixo: boolean } {
  if (W < 450 + VAO + 340) return { lado: W, embaixo: true };
  const conta = Math.min(CONTA, 450 + (W - VAO - 450 - 340) / 2);   // o flex reparte a sobra meio a meio
  return { lado: W - VAO - conta, embaixo: false };
}

/** Mede o card (largura) e a coluna da conta de cada grupo (altura). Só na tela. */
function useMedidas(ativo: boolean, chave: string) {
  const card = useRef<HTMLElement | null>(null);
  const contas = useRef<(HTMLDivElement | null)[]>([]);
  const [m, setM] = useState<{ W: number; alturas: number[] } | null>(null);
  useLayoutEffect(() => {
    const el = card.current;
    if (!ativo || !el || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const W = el.clientWidth;
      const alturas = contas.current.map((c) => c?.offsetHeight ?? 0);
      setM((a) => (a && a.W === W && a.alturas.join() === alturas.join() ? a : { W, alturas }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    for (const c of contas.current) if (c) ro.observe(c);
    return () => ro.disconnect();
  }, [ativo, chave]);
  return { card, contas, m };
}

export function CardMemoria({ card, r, numero, urlDaFigura }: PropsDoCard) {
  const { papel, R } = useRegua();
  const fig = resolverFigura(card.figura, urlDaFigura);
  const ref = textoDaRef(card.ref);
  const gs = grupos(card.secoes);
  const medidas = useMedidas(!papel, `${card.id}|${gs.map((g) => `${g.inicio}:${g.secoes.length}`).join(',')}`);
  medidas.contas.current.length = gs.length;
  const geo = !papel && medidas.m ? larguraDoLado(medidas.m.W) : null;
  // desenho gerado à direita só com largura para a letra; antes de medir (e no papel), largura cheia como antes
  const desenhosAoLado = geo !== null && !geo.embaixo && geo.lado >= LADO_DESENHO;

  return (
    <section ref={medidas.card} className="mem-card" id={`mem-${card.id}`} style={{ fontFamily: R.fonte, color: R.tinta }}>
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

      {card.desenho && !desenhosAoLado && <FiguraGerada desenho={card.desenho} entreContas={false} />}

      {gs.map((g, gi) => {
        const doGrupo = [gi === 0 ? card.desenho : undefined, g.secoes[0]?.desenho].filter((d): d is Desenho => !!d);
        const aDireita = desenhosAoLado ? doGrupo : [];
        const figAqui = gi === 0 ? fig : null;
        // a primeira seção encosta no que está em cima dela: o começo do card ou o desenho em largura cheia
        const encosta = gi === 0 || !desenhosAoLado;
        return (
          <Fragment key={g.inicio}>
            {!desenhosAoLado && g.secoes[0]?.desenho && <FiguraGerada desenho={g.secoes[0].desenho} entreContas />}
            <div
              className="mem-corpo"
              style={{ display: 'flex', gap: papel ? 18 : VAO, alignItems: 'flex-start', flexWrap: 'wrap' }}
            >
              <div
                ref={(el) => {
                  medidas.contas.current[gi] = el;
                }}
                style={{ flex: '1 1 450px', maxWidth: papel ? undefined : CONTA, minWidth: 0 }}
              >
                {g.secoes.map((s, j) => (
                  <div key={j} className="mem-secao">
                    <div
                      className="mem-secao-titulo"
                      style={{
                        fontSize: R.secao,
                        fontWeight: 600,
                        color: R.tinta2,
                        marginTop: papel ? (j || !encosta ? '6pt' : '2pt') : j || !encosta ? 18 : 6,
                        marginBottom: papel ? '2pt' : 6,
                      }}
                    >
                      {g.inicio + j + 1} · {s.titulo}
                      {s.ref && (
                        <span style={{ fontSize: R.nota, fontWeight: 400, color: R.apagado }}> · {textoDaRef(s.ref)}</span>
                      )}
                    </div>
                    {blocos(s.passos).map((b, k) =>
                      Array.isArray(b) ? (
                        <LinhaDeDados key={k} passos={b} r={r} />
                      ) : (
                        <LinhaPasso key={k} passo={b} r={r} />
                      ),
                    )}
                  </div>
                ))}
              </div>
              {papel && figAqui && (
                // no papel a figura é inteira e da mesma altura em todos os cards (imprimir.tsx); o Word lê esta árvore
                <figure className="mem-fig" style={{ flex: '0 0 auto', margin: 0, maxWidth: '100%' }}>
                  <figcaption style={{ fontSize: R.nota, color: R.apagado, marginBottom: '2pt' }}>{figAqui.titulo}</figcaption>
                  <img
                    src={figAqui.url}
                    alt={figAqui.titulo}
                    style={{ display: 'block', maxWidth: '100%', height: '42mm', width: 'auto', boxSizing: 'border-box' }}
                  />
                </figure>
              )}
              {!papel && (aDireita.length > 0 || figAqui) && (
                <ColunaDaDireita
                  desenhos={aDireita}
                  fig={figAqui}
                  geo={geo}
                  alturaDaConta={medidas.m?.alturas[gi] ?? null}
                />
              )}
            </div>
          </Fragment>
        );
      })}

      {!papel && <Legenda card={card} />}
    </section>
  );
}

/**
  As seções em grupos: a seção que tem desenho próprio abre um grupo novo (Jose, 12/10: "distribui os desenhos"), e o
  desenho vai à direita dela ou, sem largura para isso, em largura cheia antes do título. A figura do acervo fica só
  no primeiro grupo, ao lado das primeiras contas, como sempre. A numeração continua a do card.
*/
function grupos(secoes: Secao[]): { inicio: number; secoes: Secao[] }[] {
  const out: { inicio: number; secoes: Secao[] }[] = [];
  secoes.forEach((s, i) => {
    if (!out.length || s.desenho) out.push({ inicio: i, secoes: [s] });
    else out[out.length - 1].secoes.push(s);
  });
  // card sem conta ainda mostra a figura do acervo
  return out.length ? out : [{ inicio: 0, secoes: [] }];
}

/** Largura e altura do viewBox de um desenho gerado (todos começam o viewBox em 0 0). */
function caixaDoSvg(svg: string): [number, number] {
  const v = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  return v ? [Number(v[1]), Number(v[2])] : [660, 400];
}

/** A coluna da direita de um grupo: os desenhos gerados dele e, no primeiro grupo, a figura do acervo. */
function ColunaDaDireita({ desenhos, fig, geo, alturaDaConta }: {
  desenhos: Desenho[];
  fig: FiguraDoCard | null;
  geo: { lado: number; embaixo: boolean } | null;
  alturaDaConta: number | null;
}) {
  const { R } = useRegua();
  // a altura que os desenhos gerados tomam (na largura da coluna, até a largura deles): a figura fica com o resto
  const tomada = desenhos.reduce((soma, d) => {
    const [w, h] = caixaDoSvg(d.svg);
    const larg = Math.min(geo?.lado ?? Infinity, d.largura ?? 660);
    return soma + LEGENDA + (larg * h) / w + ENTRE;
  }, 0);
  let larguraDaFigura: number | null = null;
  let razao = 1000 / 640;
  if (fig) {
    const [, , w, h] = fig.recorte ?? [0, 0, 1000, 640];
    razao = w / h;
    if (geo) {
      const altura = geo.embaixo ? FIG_EMBAIXO : Math.max(FIG_MIN, (alturaDaConta ?? 0) - tomada - LEGENDA);
      larguraDaFigura = Math.min(geo.lado, altura * razao);
    }
  }
  return (
    <div className="mem-lado" style={{ flex: '1 1 340px', minWidth: 0, alignSelf: 'stretch' }}>
      <div>
        {desenhos.map((d, i) => (
          <figure key={i} className="mem-desenho" style={{ margin: `0 auto ${ENTRE}px`, maxWidth: d.largura ?? 660 }}>
            <figcaption style={{ fontSize: R.nota, lineHeight: '16px', color: R.apagado, marginBottom: 4 }}>{d.titulo}</figcaption>
            <div
              role="img"
              aria-label={d.titulo}
              style={{ background: 'var(--papel, #ffffff)', borderRadius: 4, lineHeight: 0 }}
              dangerouslySetInnerHTML={{ __html: d.svg }}
            />
          </figure>
        ))}
        {fig && (
          // antes de medir: a largura da coluna; medido: o maior desenho que cabe no vão
          <figure className="mem-fig" style={{ margin: '0 auto', width: larguraDaFigura ?? '100%', maxWidth: '100%' }}>
            <figcaption
              style={{ fontSize: R.nota, lineHeight: '16px', color: R.apagado, marginBottom: 4, whiteSpace: 'nowrap' }}
            >
              {fig.titulo}
            </figcaption>
            <img
              src={urlRecortada(fig)}
              alt={fig.titulo}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                aspectRatio: `${razao}`,
                // o desenho é de papel (fundo claro, traço escuro): no tema escuro ele fica numa folha, não some
                background: 'var(--papel, #ffffff)',
                borderRadius: 4,
              }}
            />
          </figure>
        )}
      </div>
    </div>
  );
}

/**
  Figura gerada para ESTE muro em largura cheia (quando a direita não tem largura para ela, e no papel) — as cotas
  têm de ser lidas. No meio do card ela ganha folga em cima, para não colar na conta de antes.
*/
function FiguraGerada({ desenho, entreContas }: { desenho: Desenho; entreContas: boolean }) {
  const { papel, R } = useRegua();
  return (
    <figure
      className="mem-desenho"
      style={{
        margin: papel ? (entreContas ? '6pt 0 2pt' : '0 0 4pt') : entreContas ? '20px 0 4px' : '0 0 12px',
        maxWidth: papel ? '150mm' : desenho.largura ?? 660,
      }}
    >
      <figcaption style={{ fontSize: R.nota, color: R.apagado, marginBottom: papel ? '2pt' : 4 }}>{desenho.titulo}</figcaption>
      <div
        role="img"
        aria-label={desenho.titulo}
        style={{
          background: papel ? undefined : 'var(--papel, #ffffff)',
          borderRadius: papel ? undefined : 4,
          lineHeight: 0,
        }}
        dangerouslySetInnerHTML={{ __html: desenho.svg }}
      />
    </figure>
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
