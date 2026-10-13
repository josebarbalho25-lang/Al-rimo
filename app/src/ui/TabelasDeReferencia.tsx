// ═══════════════════════════════════════════════════════════════════════════
//  ui/TabelasDeReferencia.tsx — as tabelas que eram figura (Jose, 12/10)
// ---------------------------------------------------------------------------
//  A régua comum das figuras tirou tabela de dentro do desenho: tabela em
//  imagem não se clica, não acompanha o tema e repete número que a planilha já
//  tem. Agora são tabelas da tela, lidas das MESMAS células da aba Referências
//  (a figura nunca discorda da conta), e clicar preenche a entrada:
//    - Fig. 23: fbk → fa, fgk, eficiências, fpk, fpk* (ABCP tab. 3.2 + planilha 01 do curso) — clicar na
//      coluna escolhe o fbk; legenda com desenhos;
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

// ── Desenhos da legenda da Fig. 23 (Jose, 13/10: "ao invés das legendas serem somente texto, figuras
//    representando prisma cheio, oco, bloco e graute") ──────────────────────────────────────────────────────
// Mesma paleta das figuras do acervo (figs/app/applib.py, C): bloco cinza-claro de contorno escuro, graute azul,
// furo branco. Vão dentro de uma .prancheta, então escurecem no tema escuro como as outras figuras.
// Bloco e prismas em perspectiva cavaleira (a cara de cima mostra os furos: vazios no oco, graute no cheio);
// argamassa e graute como o corpo de prova cilíndrico em que a resistência é medida.
const COR = {
  linha: '#262626', bloco: '#d9d9d9', lado: '#bfbfbf', topo: '#ececec', furo: '#ffffff',
  graute: '#bdd7ee', grauteLinha: '#2e75b6', grauteTopo: '#ddebf7', argamassa: '#a6a6a6', argamassaTopo: '#c8c8c8',
};
const L = 46; // comprimento do bloco no desenho
const DX = 14; // fuga da profundidade (cavaleira)
const DY = -10;
const pts = (...p: Array<[number, number]>) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Um bloco em cavaleira com o canto da frente-esquerda-alto em (x, y); `furos` pinta a cara de cima. */
function Bloco({ x, y, h, furos, semTopo }: { x: number; y: number; h: number; furos?: 'vazio' | 'graute'; semTopo?: boolean }) {
  const furo = (a: number, b: number) => {
    const p = (u: number, f: number): [number, number] => [x + u + DX * f, y + DY * f];
    return pts(p(a, 0.22), p(b, 0.22), p(b, 0.78), p(a, 0.78));
  };
  const corFuro = furos === 'graute' ? COR.graute : COR.furo;
  const linhaFuro = furos === 'graute' ? COR.grauteLinha : COR.linha;
  return (
    <g strokeLinejoin="round" strokeWidth={1}>
      <rect x={x} y={y} width={L} height={h} fill={COR.bloco} stroke={COR.linha} />
      <polygon points={pts([x + L, y], [x + L + DX, y + DY], [x + L + DX, y + DY + h], [x + L, y + h])} fill={COR.lado} stroke={COR.linha} />
      {!semTopo && (
        <>
          <polygon points={pts([x, y], [x + L, y], [x + L + DX, y + DY], [x + DX, y + DY])} fill={COR.topo} stroke={COR.linha} />
          {furos && <polygon points={furo(4, 20)} fill={corFuro} stroke={linhaFuro} />}
          {furos && <polygon points={furo(26, 42)} fill={corFuro} stroke={linhaFuro} />}
        </>
      )}
    </g>
  );
}

/** Dois blocos com a junta de argamassa entre eles. */
function Prisma({ cheio }: { cheio: boolean }) {
  const x = 12, h = 17, j = 3, y0 = 24;
  return (
    <>
      <Bloco x={x} y={y0 + h + j} h={h} semTopo />
      <g fill={COR.argamassa} stroke={COR.linha} strokeWidth={0.8} strokeLinejoin="round">
        <rect x={x} y={y0 + h} width={L} height={j} />
        <polygon points={pts([x + L, y0 + h], [x + L + DX, y0 + h + DY], [x + L + DX, y0 + h + DY + j], [x + L, y0 + h + j])} />
      </g>
      <Bloco x={x} y={y0} h={h} furos={cheio ? 'graute' : 'vazio'} />
    </>
  );
}

/** Corpo de prova cilíndrico. */
function Cilindro({ corpo, topo, linha }: { corpo: string; topo: string; linha: string }) {
  const cx = 42, rx = 14, ry = 5, y1 = 16, y2 = 54;
  return (
    <g strokeLinejoin="round" strokeWidth={1} stroke={linha}>
      <path d={`M${cx - rx},${y1} L${cx - rx},${y2} A${rx},${ry} 0 0 0 ${cx + rx},${y2} L${cx + rx},${y1} Z`} fill={corpo} />
      <ellipse cx={cx} cy={y1} rx={rx} ry={ry} fill={topo} />
    </g>
  );
}

const DESENHO = {
  bloco: <Bloco x={12} y={30} h={20} furos="vazio" />,
  argamassa: <Cilindro corpo={COR.argamassa} topo={COR.argamassaTopo} linha={COR.linha} />,
  graute: <Cilindro corpo={COR.graute} topo={COR.grauteTopo} linha={COR.grauteLinha} />,
  oco: <Prisma cheio={false} />,
  cheio: <Prisma cheio />,
};

// Legenda dos símbolos (Jose, 13/10: "muito importante"). Legenda é rótulo, não explicação — as mesmas palavras dos
// glossários dos cards da memória (balanco.ts, contraforte.ts), para a tela e o memorial não chamarem a mesma
// grandeza de dois jeitos. Na ordem das linhas da tabela; as eficiências (fpk/fbk, fpk*/fpk) se explicam pelo rótulo.
const LEGENDA_DO_FBK: Array<[string, string, keyof typeof DESENHO]> = [
  ['fbk', 'resistência característica do bloco à compressão', 'bloco'],
  ['fa', 'resistência da argamassa', 'argamassa'],
  ['fgk', 'resistência característica do graute', 'graute'],
  ['fpk', 'resistência característica do prisma oco (área bruta)', 'oco'],
  ['fpk*', 'resistência característica do prisma cheio (grauteado)', 'cheio'],
];

// Fig. 23 — bloco de concreto, transposta (fbk nas colunas): as linhas 5 a 16 da aba Referências. Ordem das linhas
// da planilha 01 do Carini (Jose, 13/10), para conferir lado a lado: fbk, fa, fgk, fpk/fbk, fpk*/fpk, fpk, fpk*.
// H:K = Tab. 3.2 da ABCP + fgk do curso (a conta lê); E:G = fa e eficiências do curso (só consulta).
function TabelaDoFbk() {
  const { cel, definir, ler } = useTabela();
  const linhas = Array.from({ length: 12 }, (_, i) => 5 + i);
  const atual = ler('fbk_');
  const grandezas: Array<[string, string, number, string]> = [
    ['fa', 'E', 0, 'MPa'],
    ['fgk', 'K', 0, 'MPa'],
    ['fpk/fbk', 'F', 2, ''],
    ['fpk*/fpk', 'G', 2, ''],
    ['fpk', 'I', 1, 'MPa'],
    ['fpk*', 'J', 1, 'MPa'],
  ];
  return (
    <div className="tabela-ref-grupo">
      <table className="tabela-ref" aria-label="Bloco de concreto: fbk, fa, fgk, fpk/fbk, fpk*/fpk, fpk, fpk*">
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
          {grandezas.map(([rot, col, casas, un]) => (
            <tr key={rot}>
              <th scope="row">{rot}</th>
              {linhas.map((r) => (
                <td key={r} className={mesmoValor(cel(`Referências!H${r}`), atual) ? 'on' : undefined}>{fmt(cel(`Referências!${col}${r}`), casas)}</td>
              ))}
              <td className="un">{un}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="legenda-desenhos">
        {LEGENDA_DO_FBK.map(([simbolo, nome, desenho]) => (
          <li key={simbolo}>
            <div className="prancheta">
              <svg viewBox="0 0 84 64" aria-hidden="true">{DESENHO[desenho]}</svg>
            </div>
            <b>{simbolo}</b>
            <span>{nome}</span>
          </li>
        ))}
      </ul>
    </div>
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
