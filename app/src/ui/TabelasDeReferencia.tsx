// ═══════════════════════════════════════════════════════════════════════════
//  ui/TabelasDeReferencia.tsx — as tabelas que eram figura (Jose, 12/10)
// ---------------------------------------------------------------------------
//  A régua comum das figuras tirou tabela de dentro do desenho: tabela em
//  imagem não se clica, não acompanha o tema e repete número que a planilha já
//  tem. Agora são tabelas da tela, lidas das MESMAS células da aba Referências
//  (a figura nunca discorda da conta), e clicar preenche a entrada:
//    - Fig. 23: fbk → fpk, fpk*, fgk (ABCP tab. 3.2) — clicar na coluna escolhe o fbk;
//    - Fig. 8: ftk por classe de argamassa (NBR 16868-1 Tab. 3) — clicar na linha escolhe a argamassa;
//    - Fig. 7: αv e αh pela vinculação — clicar no valor preenche o α.
//  Só rótulo e número (painel não explica a si mesmo); a fonte vai na memória.
// ═══════════════════════════════════════════════════════════════════════════

import { mesmoValor } from '@/estado/campos';
import { escreverNumero } from '@/estado/numeros';
import { leitorDoEstado, useApp } from '@/estado/store';
import type { Valor } from '@/motor/tipos';

const num = (v: Valor) => (typeof v === 'number' ? v : null);
const fmt = (v: Valor, casas: number) => {
  const n = num(v);
  return n === null ? '—' : escreverNumero(n, casas);
};

function useTabela() {
  const resultado = useApp((s) => s.resultado);
  const definir = useApp((s) => s.definir);
  const alteracoes = useApp((s) => s.alteracoes);
  const extras = useApp((s) => s.extras);
  const ler = leitorDoEstado({ alteracoes, extras });
  const cel = (ref: string): Valor => (resultado ? resultado.cel(ref) : null);
  return { cel, definir, ler };
}

/** Fig. 23 — bloco de concreto: as linhas 5 a 16 da aba Referências, transpostas (fbk nas colunas). */
function TabelaDoFbk() {
  const { cel, definir, ler } = useTabela();
  const linhas = Array.from({ length: 12 }, (_, i) => 5 + i);
  const atual = ler('fbk_');
  const grandezas: Array<[string, string, number]> = [['fpk', 'I', 1], ['fpk*', 'J', 1], ['fgk', 'K', 0]];
  return (
    <table className="tabela-ref" aria-label="Bloco de concreto: fbk, fpk, fpk*, fgk">
      <thead>
        <tr>
          <th scope="row">fbk</th>
          {linhas.map((r) => {
            const v = cel(`Referências!H${r}`);
            const on = mesmoValor(v, atual);
            return (
              <th key={r} className={on ? 'on' : undefined}>
                <button type="button" onClick={() => definir('fbk_', v)} aria-pressed={on}>{fmt(v, 0)}</button>
              </th>
            );
          })}
          <th className="un">MPa</th>
        </tr>
      </thead>
      <tbody>
        {grandezas.map(([rot, col, casas]) => (
          <tr key={rot}>
            <th scope="row">{rot}</th>
            {linhas.map((r) => (
              <td key={r} className={mesmoValor(cel(`Referências!H${r}`), atual) ? 'on' : undefined}>{fmt(cel(`Referências!${col}${r}`), casas)}</td>
            ))}
            <td className="un">MPa</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Fig. 8 — ftk por classe de argamassa: linhas 16 a 18 da aba Referências. */
function TabelaDaArgamassa() {
  const { cel, definir, ler } = useTabela();
  const atual = ler('arg_cls');
  return (
    <table className="tabela-ref" aria-label="Argamassa: ftk normal e paralela à fiada">
      <thead>
        <tr>
          <th>Argamassa</th>
          <th>ftk ⊥ fiada</th>
          <th>ftk ∥ fiada</th>
          <th className="un" />
        </tr>
      </thead>
      <tbody>
        {[16, 17, 18].map((r) => {
          const cls = cel(`Referências!L${r}`);
          const on = mesmoValor(cls, atual);
          return (
            <tr key={r} className={`clicavel${on ? ' on' : ''}`} onClick={() => definir('arg_cls', cls)}>
              <th scope="row"><button type="button" aria-pressed={on}>{String(cls ?? '—')}</button></th>
              <td>{fmt(cel(`Referências!M${r}`), 2)}</td>
              <td>{fmt(cel(`Referências!N${r}`), 2)}</td>
              <td className="un">MPa</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Fig. 7 — coeficientes de vinculação da altura efetiva (os da figura de antes, que eram texto). */
function TabelaDeAlfa() {
  const { definir, ler } = useTabela();
  const linhas: Array<[string, string, string, number]> = [
    ['αv', 'alfa_v', 'Topo e base travados', 1.0],
    ['αv', 'alfa_v', 'Só a base travada', 2.5],
    ['αh', 'alfa_h', 'Dois lados travados', 1.0],
    ['αh', 'alfa_h', 'Um lado travado', 2.5],
  ];
  return (
    <table className="tabela-ref" aria-label="Coeficientes de vinculação αv e αh">
      <tbody>
        {linhas.map(([sim, nome, rot, v]) => {
          const on = mesmoValor(ler(nome), v);
          return (
            <tr key={`${nome}${v}`} className={`clicavel${on ? ' on' : ''}`} onClick={() => definir(nome, v)}>
              <th scope="row">{sim}</th>
              <td className="esq">{rot}</td>
              <td><button type="button" aria-pressed={on}>{escreverNumero(v, 1)}</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A tabela de referência que acompanha a figura (ou null). fig23 é SÓ a tabela: o desenho dela era a tabela. */
export function TabelaDeReferencia({ figura }: { figura: string | undefined }) {
  if (figura === 'fig23') return <TabelaDoFbk />;
  if (figura === 'fig08') return <TabelaDaArgamassa />;
  if (figura === 'fig07') return <TabelaDeAlfa />;
  return null;
}

/** A figura que virou tabela: não mostra mais o desenho. */
export const SO_TABELA = new Set(['fig23']);
