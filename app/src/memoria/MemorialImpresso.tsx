/*
  O MEMORIAL NO PAPEL — documento que se assina. Ordem (regra do dono no Pró-Viga, 25/ago):
    Rosto → Índice → 1 Glossário → 2 Dados de entrada → 3 Resumo das verificações → 4 Memória de cálculo.
  O rosto carrega quem assina, a data, a versão da conta e o AVISO DO SOLO da planilha (palavra por palavra).

  Nada aqui calcula nem redesenha: são os MESMOS cards da tela, com PapelCtx = true (tamanhos em pt, legenda fora).
  A mesma árvore vai para a impressora (imprimirMemorial) e para o Word (exportarWord) — um documento só.
*/
import type { ReactNode } from 'react';
import type { Resultado } from '@/motor/tipos';
import type { Card } from './tipos';
import { PAPEL, PapelCtx } from './estilos';
import { cardsDaMemoria, verificacoesDe } from './cards';
import { CardMemoria } from './CardMemoria';
import { TabelaResumo } from './TabelaResumo';
import { Tex } from './Tex';
import { glossarioDe } from './glossario';
import { AVISO_DO_SOLO, ENTRADAS, VERSAO_DA_CONTA } from './metaDaPlanilha';
import { casasDoFormato, nbr } from './formato';

export interface InfoDoMemorial {
  projeto?: string;
  responsavel?: string;
  crea?: string;
  /** Data de emissão como vai escrita; vazio = hoje. */
  data?: string;
}

export interface PropsDoMemorial {
  resultado: Resultado;
  info?: InfoDoMemorial;
  urlDaFigura?: (figura: string) => string | null;
  /** Cards já montados (quem imprime a partir da tela não monta duas vezes). */
  cards?: Card[];
}

const R = PAPEL;
const td = { padding: '1.5pt 4pt', borderBottom: `1px solid #EEEEEE`, fontSize: R.tabela, verticalAlign: 'baseline' } as const;
const H = ({ children, quebra }: { children: ReactNode; quebra?: boolean }) => (
  <div
    className="mp-titulo"
    style={{
      fontSize: '12pt',
      fontWeight: 700,
      color: R.tinta,
      margin: '10pt 0 5pt',
      pageBreakBefore: quebra ? 'always' : undefined,
      pageBreakAfter: 'avoid',
    }}
  >
    {children}
  </div>
);

/** Texto de um valor de entrada com as casas da célula. */
function valorDaEntrada(v: unknown, formato: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return nbr(v, casasDoFormato(formato) ?? (Number.isInteger(v) ? 0 : 2));
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object' && v && 'erro' in v) return String((v as { erro: string }).erro);
  return String(v);
}

/**
  Faixas da aba Entradas que não pesam neste muro (DEDUÇÃO nossa, para não encher o papel de dado morto): as de
  contraforte num muro em balanço.
*/
function faixaVale(secao: string, r: Resultado): boolean {
  const tipo = r.v('Tipo_muro');
  if (tipo === 'Balanço' && /contraforte/i.test(secao)) return false;
  return true;
}

export function MemorialImpresso({ resultado: r, info = {}, urlDaFigura, cards: dados }: PropsDoMemorial) {
  const cards = (dados ?? cardsDaMemoria(r)).filter((c) => c.aplicavel);
  const verifs = verificacoesDe(cards);
  const falhas = verifs.filter((x) => !x.v.passa);
  const glossario = glossarioDe(cards);
  const meio = Math.ceil(glossario.length / 2);
  const data = info.data || new Date().toLocaleDateString('pt-BR');
  const faixas: { secao: string; itens: typeof ENTRADAS[number][] }[] = [];
  for (const e of ENTRADAS) {
    if (!faixaVale(e.secao, r)) continue;
    const f = faixas[faixas.length - 1];
    if (f && f.secao === e.secao) f.itens.push(e);
    else faixas.push({ secao: e.secao, itens: [e] });
  }
  const linhaRosto = (rot: string, val: string | undefined) => (
    <tr>
      <td style={{ ...td, color: R.apagado, width: '34%' }}>{rot}</td>
      <td style={{ ...td, fontWeight: 600, color: R.tinta }}>{val || '—'}</td>
    </tr>
  );
  const t = r.v('t_bloco');
  const L = r.v('L_bloco');
  const indice: { n: string; t: string; sub?: boolean }[] = [
    { n: '1', t: 'Glossário de símbolos' },
    { n: '2', t: 'Dados de entrada' },
    { n: '3', t: 'Resumo das verificações' },
    { n: '4', t: 'Memória de cálculo' },
    ...cards.map((c, i) => ({ n: `4.${i + 1}`, t: c.titulo, sub: true })),
  ];

  return (
    <PapelCtx.Provider value={true}>
      <div className="mp-doc" style={{ fontFamily: R.fonte, fontSize: R.corpo, color: R.tinta, background: '#FFFFFF' }}>
        {/* ── Rosto ── */}
        <div className="mp-rosto">
          <div style={{ fontSize: '9pt', letterSpacing: '0.14em', color: R.apagado, textTransform: 'uppercase' }}>
            Memorial de cálculo · muro de arrimo em alvenaria estrutural
          </div>
          <div style={{ fontSize: '14pt', fontWeight: 600, margin: '4pt 0 2pt' }}>{info.projeto || 'Projeto sem nome'}</div>
          <div style={{ borderTop: '2px solid #111111', margin: '10pt 0 6pt' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {linhaRosto('Projeto', info.projeto)}
              {linhaRosto('Tipo de muro', String(r.v('Tipo_muro') ?? ''))}
              {linhaRosto('Altura do muro', `${nbr(Number(r.v('H_muro')), 2)} m`)}
              {linhaRosto('Altura de solo', `${nbr(Number(r.v('H_solo')), 2)} m`)}
              {linhaRosto('Bloco', `${t}×${L} cm`)}
              {linhaRosto('Norma', 'ABNT NBR 16868-1:2020')}
              {linhaRosto('Responsável técnico', info.responsavel)}
              {linhaRosto('CREA', info.crea)}
              {linhaRosto('Emitido em', data)}
              {linhaRosto('Versão da conta', VERSAO_DA_CONTA)}
            </tbody>
          </table>
          {verifs.length > 0 && (
            <div
              style={{
                marginTop: '12pt',
                padding: '6pt 8pt',
                border: `1.5px solid ${falhas.length ? R.falha : R.ok}`,
                background: falhas.length ? '#FBF0EE' : '#F1F7F3',
              }}
            >
              <div style={{ fontWeight: 700, color: falhas.length ? R.falha : R.ok }}>
                {falhas.length ? 'Há verificações que não atendem' : 'Todas as verificações atendem'}
              </div>
              {falhas.length > 0 && (
                <div style={{ fontSize: R.nota, color: R.tinta2, marginTop: '2pt' }}>
                  {falhas.map((x) => x.v.rotulo).join(' · ')}
                </div>
              )}
            </div>
          )}
          {AVISO_DO_SOLO && (
            <div
              className="mp-aviso-solo"
              style={{ marginTop: '12pt', fontSize: '8.5pt', fontWeight: 700, color: '#C00000', lineHeight: 1.35 }}
            >
              {AVISO_DO_SOLO}
            </div>
          )}
          <table style={{ width: '100%', marginTop: '28pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', paddingRight: '20pt', verticalAlign: 'top' }}>
                  <div style={{ borderTop: '1px solid #111111', paddingTop: '3pt', fontSize: R.nota, color: R.tinta2 }}>
                    {info.responsavel || 'Responsável técnico'}
                    {info.crea ? ` · CREA ${info.crea}` : ''}
                  </div>
                </td>
                <td style={{ width: '50%', paddingLeft: '20pt', verticalAlign: 'top' }}>
                  <div style={{ borderTop: '1px solid #111111', paddingTop: '3pt', fontSize: R.nota, color: R.tinta2 }}>
                    Data
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Índice: numera SEÇÕES, sem página (quem pagina é o navegador; o leitor procura "4.2") ── */}
        <div className="mp-indice">
          <H>Índice</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {indice.map((it) => (
                <tr key={it.n}>
                  <td style={{ ...td, width: '30pt', fontWeight: 700, paddingLeft: it.sub ? '14pt' : '4pt' }}>{it.n}</td>
                  <td style={{ ...td, fontWeight: it.sub ? 400 : 600, fontSize: it.sub ? R.tabela : '9pt' }}>{it.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 1 · Glossário (duas colunas, entrelinha justa: lista para consultar) ── */}
        <div className="mp-glossario">
          <H>1 · Glossário de símbolos</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                {[glossario.slice(0, meio), glossario.slice(meio)].map((col, k) => (
                  <td key={k} style={{ width: '50%', verticalAlign: 'top', paddingRight: k ? 0 : '9pt' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {col.map(([s, d]) => (
                          <tr key={s}>
                            <td style={{ padding: '0.5pt 4pt', width: '52pt', fontSize: R.tabela, verticalAlign: 'baseline' }}>
                              <Tex tex={s} />
                            </td>
                            <td style={{ padding: '0.5pt 4pt', fontSize: R.tabela, color: R.tinta2, lineHeight: 1.22, verticalAlign: 'baseline' }}>
                              {d}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 2 · Dados de entrada ── */}
        <div className="mp-entradas">
          <H quebra>2 · Dados de entrada</H>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {faixas.flatMap((f) => [
                <tr key={'s' + f.secao}>
                  <td colSpan={3} style={{ ...td, fontWeight: 700, paddingTop: '5pt', color: R.tinta2 }}>{f.secao}</td>
                </tr>,
                ...f.itens.map((e) => (
                  <tr key={e.nome}>
                    <td style={{ ...td, width: '58%' }}>{e.rotulo}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{valorDaEntrada(r.v(e.nome), e.formato)}</td>
                    <td style={{ ...td, color: R.apagado, width: '14%' }}>{e.unidade}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>

        {/* ── 3 · Resumo ── */}
        <div className="mp-resumo">
          <H quebra>3 · Resumo das verificações</H>
          {verifs.length ? <TabelaResumo cards={cards} /> : <div style={{ fontSize: R.tabela }}>—</div>}
        </div>

        {/* ── 4 · Memória: contas em sequência, sem folha nova por conta ("não pule pra próxima folha") ── */}
        <div className="mp-memoria">
          <H>4 · Memória de cálculo</H>
          {cards.map((c, i) => (
            <div key={c.id} style={{ marginBottom: '10pt' }}>
              <CardMemoria card={c} r={r} numero={`4.${i + 1}`} urlDaFigura={urlDaFigura} />
            </div>
          ))}
        </div>
      </div>
    </PapelCtx.Provider>
  );
}
