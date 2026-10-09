/*
  PAINEL DO QUANTITATIVO — tabelas rótulo + valor + unidade e o botão do CSV.

  Nada de texto explicativo (regra do Jose): a regra de cada número está no código e no relatório, não na tela.
  As entradas do modelo (drenagem, impermeabilização) vêm dentro do próprio Modelo (`extras`).

  Na tabela de blocos cada linha leva a figura da peça (pecas.ts); o clique abre a figura grande no MESMO modal das
  figuras das entradas (ui/ModalDaFigura) — um modal só no app, com o mesmo Esc, o mesmo ✕ e o mesmo clique fora.
*/
import { useCallback, useMemo, useState } from 'react';
import type { Modelo } from '@/modelo/tipos';
import { ModalDaFigura } from '@/ui/ModalDaFigura';
import {
  quantificar, tabelasDoQuantitativo, csvDoQuantitativo, formatarNaTela, type Celula, type FiguraDaPeca, type Tabela,
} from '@/quantitativo';
import './quantitativo.css';

function baixarCsv(conteudo: string, nome: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar já no mesmo tique cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IconeDaPeca({ f, aoAbrir }: { f: FiguraDaPeca; aoAbrir: (f: FiguraDaPeca) => void }) {
  return (
    <button type="button" className="qtd-peca" title={f.titulo} aria-label={f.titulo} onClick={() => aoAbrir(f)}>
      <img src={f.icone} alt="" draggable={false} />
    </button>
  );
}

function TabelaDoQuantitativo({ t, aoAbrir }: { t: Tabela; aoAbrir: (f: FiguraDaPeca) => void }) {
  const ehNumero = (c: Celula) => c !== null && typeof c === 'object';
  // Coluna de número alinha à direita inteira (cabeçalho e algum texto que caia nela, como a família do bloco);
  // a letra monoespaçada fica só no número, para a vírgula decimal cair sempre no mesmo lugar.
  const direita = t.cabecalho.map((_, j) => t.linhas.some((l) => ehNumero(l[j])));
  const classe = (c: Celula, j: number) =>
    [direita[j] ? 'qtd-dir' : '', ehNumero(c) ? 'qtd-num' : ''].join(' ').trim() || undefined;
  // Linha sem figura numa tabela que tem figuras ganha o vão do ícone: os nomes continuam alinhados.
  const comFiguras = t.figuras?.some(Boolean) ?? false;
  const primeira = (c: Celula, i: number) => {
    if (!comFiguras) return formatarNaTela(c);
    const f = t.figuras?.[i];
    return (
      <span className="qtd-com-peca">
        {f ? <IconeDaPeca f={f} aoAbrir={aoAbrir} /> : <span className="qtd-peca qtd-peca-vazia" />}
        {formatarNaTela(c)}
      </span>
    );
  };
  return (
    <div className="qtd-rolagem">
      <table className="qtd-tabela" data-tabela={t.id}>
        <caption>{t.titulo}</caption>
        <thead>
          <tr>{t.cabecalho.map((h, j) => <th key={j} className={direita[j] ? 'qtd-dir' : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {t.linhas.map((l, i) => (
            <tr key={i}>{l.map((c, j) => <td key={j} className={classe(c, j)}>{j === 0 ? primeira(c, i) : formatarNaTela(c)}</td>)}</tr>
          ))}
        </tbody>
        {t.total && (
          <tfoot>
            <tr>{t.total.map((c, j) => <td key={j} className={classe(c, j)}>{formatarNaTela(c)}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Quantitativo({ modelo }: { modelo: Modelo }) {
  const q = useMemo(() => quantificar(modelo), [modelo]);
  const tabelas = useMemo(() => tabelasDoQuantitativo(q), [q]);
  const [figura, setFigura] = useState<FiguraDaPeca | null>(null);
  // estável: o modal registra o Esc num efeito que depende desta função
  const fechar = useCallback(() => setFigura(null), []);
  return (
    <section className="qtd">
      <div className="qtd-barra">
        <button type="button" onClick={() => baixarCsv(csvDoQuantitativo(q), 'quantitativo.csv')}>Exportar CSV</button>
      </div>
      {q.avisos.length > 0 && (
        <ul className="qtd-avisos">{q.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
      )}
      {tabelas.map((t) => <TabelaDoQuantitativo key={t.id} t={t} aoAbrir={setFigura} />)}
      {figura && <ModalDaFigura figura={figura} aoFechar={fechar} />}
    </section>
  );
}
