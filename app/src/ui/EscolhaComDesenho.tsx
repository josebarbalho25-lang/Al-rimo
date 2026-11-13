// ═══════════════════════════════════════════════════════════════════════════
//  ui/EscolhaComDesenho.tsx — a escolha que se faz olhando o desenho (Jose, 12/10)
// ---------------------------------------------------------------------------
//  Na entrada por figuras, a entrada cujas opções SE DESENHAM (balanço ou
//  contrafortes, bloco 14 ou 19, graute a cada X, contraforte enterrado
//  ou aparente...) vira uma fileira de botões, cada um com o desenhinho da
//  opção e o nome curto embaixo. Na lista da esquerda continua o controle de
//  sempre (botões de texto ou combo): lá é ajuste rápido.
//
//  Os desenhos são autorados em papel CLARO, com as cores das figuras
//  (figs/app/applib.py), e a plaquinha inverte no tema escuro como a
//  `.prancheta` — o mesmo desenho nas duas telas.
//
//  Só desenho, sem texto dentro (o nome da opção vai embaixo, fora da placa).
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import type { Valor } from '@/motor/tipos';
import { mesmoValor, type Opcao } from '@/estado/campos';

const C = {
  linha: '#262626', bloco: '#d9d9d9', graute: '#bdd7ee', grauteLinha: '#2e75b6', aco: '#c00000', solo: '#e8d8b9',
  soloLinha: '#8d6e3f', concreto: '#ececec', apagado: '#a6a6a6', empuxo: '#f8cbad', carga: '#c55a11',
};
const L = { stroke: C.linha, strokeWidth: 1.4, fill: 'none' } as const;

/** Bloco em planta (39 de comprimento), com os dois furos; `cheios` = furos grauteados. */
function bloco(x: number, y: number, t: number, cheios: readonly boolean[] = [false, false], esc = 1.6): ReactNode {
  const w = 39 * esc, h = t * esc, p = (t === 19 ? 3.5 : 2.7) * esc;
  const fw = (w - 3 * p) / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      {[0, 1].map((i) => (
        <rect key={i} x={x + p + i * (fw + p)} y={y + p} width={fw} height={h - 2 * p}
          fill={cheios[i] ? C.graute : '#ffffff'} stroke={cheios[i] ? C.grauteLinha : C.linha} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Painel em elevação com as bordas: 'a' apoiada (traço cheio), 'e' engastada (hachura), 'l' livre (tracejado). */
function painel(bordas: { topo: string; base: string; esq: string; dir: string }): ReactNode {
  const x0 = 30, y0 = 8, x1 = 90, y1 = 52;
  const lado = (tipo: string, xa: number, ya: number, xb: number, yb: number, k: string) =>
    tipo === 'l' ? (
      <line key={k} x1={xa} y1={ya} x2={xb} y2={yb} stroke={C.apagado} strokeWidth={1.4} strokeDasharray="4 3" />
    ) : (
      <g key={k}>
        <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={C.linha} strokeWidth={2.4} />
        {tipo === 'e' && Array.from({ length: 6 }, (_, i) => {
          const f = (i + 0.5) / 6;
          const x = xa + (xb - xa) * f, y = ya + (yb - ya) * f;
          const vertical = xa === xb;
          const s = xa === x0 || ya === y0 ? -1 : 1;   // hachura para fora do painel
          return vertical
            ? <line key={i} x1={x} y1={y} x2={x + s * 5} y2={y - 4} stroke={C.linha} strokeWidth={1} />
            : <line key={i} x1={x} y1={y} x2={x - 4} y2={y + s * 5} stroke={C.linha} strokeWidth={1} />;
        })}
      </g>
    );
  return (
    <g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={C.empuxo} fillOpacity={0.35} />
      {lado(bordas.topo, x0, y0, x1, y0, 't')}
      {lado(bordas.base, x0, y1, x1, y1, 'b')}
      {lado(bordas.esq, x0, y0, x0, y1, 'e')}
      {lado(bordas.dir, x1, y0, x1, y1, 'd')}
    </g>
  );
}

/** Planta do muro com três contrafortes; `aparente` = para fora; `destaque` = qual é o calculado. */
function plantaCf(aparente: boolean, destaque: number | null): ReactNode {
  const yM = aparente ? 20 : 30;
  return (
    <g>
      <rect x={6} y={aparente ? 6 : 6} width={108} height={aparente ? 14 : 24} fill={C.solo} />
      <rect x={6} y={yM} width={108} height={8} fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      {[14, 56, 98].map((x, i) => (
        <rect key={x} x={x} y={aparente ? yM + 8 : yM - 16} width={8} height={16}
          fill={destaque === i ? C.graute : C.bloco} stroke={destaque === i ? C.grauteLinha : C.linha} strokeWidth={1.2} />
      ))}
    </g>
  );
}

/** Canaleta (U) em corte com a barra: centrada ou junto à face externa. */
function canaleta(posicao: 'centro' | 'face' | 'duas'): ReactNode {
  return (
    <g>
      <path d="M40 8 V52 H80 V8 H74 V46 H46 V8 Z" fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      <rect x={46} y={8} width={28} height={38} fill={C.graute} />
      {(posicao === 'duas' ? [51, 69] : [posicao === 'face' ? 51 : 60]).map((cx) => <circle key={cx} cx={cx} cy={34} r={3.6} fill={C.aco} />)}
      <rect x={82} y={8} width={30} height={44} fill={C.solo} />
    </g>
  );
}

/** Célula do bloco em planta com as barras verticais do painel. */
function celulaPainel(duas: boolean): ReactNode {
  return (
    <g>
      <rect x={22} y={14} width={76} height={34} fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      <rect x={28} y={20} width={64} height={22} fill={C.graute} stroke={C.grauteLinha} strokeWidth={1} />
      {duas ? (
        <>
          <circle cx={60} cy={24} r={3.2} fill={C.aco} />
          <circle cx={60} cy={38} r={3.2} fill={C.aco} />
        </>
      ) : (
        <circle cx={60} cy={31} r={3.2} fill={C.aco} />
      )}
      <rect x={22} y={4} width={76} height={10} fill={C.solo} />
    </g>
  );
}

/*
  O desenho de cada opção, pelo nome da entrada e pelo VALOR da opção (o mesmo valor que vai para a conta). Opção
  sem desenho aqui faz a entrada voltar ao controle de sempre — nada some por falta de figurinha.
*/
const DESENHOS: Record<string, (v: Valor) => ReactNode | null> = {
  Tipo_muro: (v) => v === 'Balanço' ? (
    <g>
      <rect x={6} y={50} width={108} height={7} fill={C.concreto} stroke={C.linha} strokeWidth={1.2} />
      <rect x={46} y={8} width={9} height={42} fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      <path d="M55 8 L55 50 L84 50 Z" fill={C.empuxo} />
      <rect x={55} y={8} width={59} height={42} fill={C.solo} opacity={0.5} />
    </g>
  ) : v === 'Contrafortes' ? (
    <g>
      <rect x={6} y={50} width={108} height={7} fill={C.concreto} stroke={C.linha} strokeWidth={1.2} />
      <rect x={14} y={10} width={92} height={40} fill={C.bloco} stroke={C.linha} strokeWidth={1.2} />
      {[20, 56, 92].map((x) => <rect key={x} x={x} y={10} width={8} height={40} fill={C.apagado} stroke={C.linha} strokeWidth={1.2} />)}
    </g>
  ) : null,
  // área de referência do fpk (Jose, 12/10): bruta = o retângulo todo, furos incluídos; líquida = só o concreto
  fpk_ref: (v) => {
    const s = String(v ?? '');
    const liquida = s.startsWith('Líq');
    if (!liquida && !s.startsWith('Brut')) return null;
    return (
      <g>
        <rect x={29} y={15} width={62} height={30} fill={C.apagado} stroke={C.linha} strokeWidth={1.2} />
        {[33.5, 61.5].map((x) => (
          <rect key={x} x={x} y={20.5} width={25} height={19} rx={2}
            fill={liquida ? '#ffffff' : 'none'} stroke={C.linha} strokeWidth={1} strokeDasharray={liquida ? undefined : '3 2'} />
        ))}
      </g>
    );
  },
  t_bloco: (v) => (Number(v) === 14 || Number(v) === 19 ? bloco(29, 30 - (Number(v) * 1.6) / 2, Number(v)) : null),
  // graute a cada X (Jose, 13/10): uma fiada de 3 blocos em planta (6 furos, a cada 20 cm), o 1º furo grauteado e
  // os outros a cada X — 20 todos, 40 furo sim furo não, 60 um sim dois não… 100 o 1º e o 6º
  Graute: (v) => {
    const x = Number(v);
    if (!Number.isFinite(x) || x < 20 || x % 20 !== 0) return null;
    const passo = x / 20;
    return <g>{[0, 1, 2].map((b) => bloco(0.5 + b * 40, 20.5, 19, [(2 * b) % passo === 0, (2 * b + 1) % passo === 0], 1))}</g>;
  },
  pos_cf: (v) => {
    const s = String(v ?? '');
    return s.startsWith('Ente') ? plantaCf(false, null) : s.startsWith('Apar') ? plantaCf(true, null) : null;
  },
  tipo_cf: (v) => (v === 'Intermediário' ? plantaCf(false, 1) : v === 'Extremidade' ? plantaCf(false, 0) : null),
  lat_pan: (v) => (v === 'Apoiadas'
    ? painel({ topo: 'a', base: 'e', esq: 'a', dir: 'a' })
    : v === 'Engastadas' ? painel({ topo: 'a', base: 'e', esq: 'e', dir: 'e' }) : null),
  caso_pan: (v) => {
    const n = Number(v);
    if (n === 13) return painel({ topo: 'a', base: 'a', esq: 'a', dir: 'a' });
    if (n === 18) return painel({ topo: 'l', base: 'a', esq: 'a', dir: 'a' });
    if (n === 11) return painel({ topo: 'a', base: 'a', esq: 'a', dir: 'l' });
    return null;
  },
  pos_pv: (v) => {
    const s = String(v ?? '');
    return s.startsWith('2 barras') ? celulaPainel(true) : s.startsWith('1 barra') ? celulaPainel(false) : null;
  },
  pos_ph: (v) => {
    const s = String(v ?? '');
    return s.startsWith('Centralizada') ? canaleta('centro') : s.startsWith('Encostada') ? canaleta('face') : s.startsWith('2 barras') ? canaleta('duas') : null;
  },
};

/** A entrada tem desenho para TODAS as opções de agora? (senão fica o controle de sempre) */
export function temDesenho(nome: string, opcoes: readonly Opcao[]): boolean {
  const d = DESENHOS[nome];
  // até 5: o graute a cada X tem 20, 40, 60, 80 e 100 (bloco 19)
  return !!d && opcoes.length > 1 && opcoes.length <= 5 && opcoes.every((o) => o.valor !== null && d(o.valor) !== null);
}

export function EscolhaComDesenho({
  nome,
  rotulo,
  opcoes,
  valor,
  aoEscolher,
}: {
  nome: string;
  rotulo: string;
  opcoes: readonly Opcao[];
  valor: Valor;
  aoEscolher: (v: Valor) => void;
}) {
  const desenhar = DESENHOS[nome];
  return (
    <div className="escolha-desenho" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => {
        const on = mesmoValor(o.valor, valor);
        return (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'on' : undefined}
            title={o.rotulo}
            onClick={() => !on && aoEscolher(o.valor)}
          >
            <svg className="placa" viewBox="0 0 120 60" aria-hidden="true">
              <rect width={120} height={60} fill="#ffffff" />
              {desenhar(o.valor)}
              <rect width={120} height={60} {...L} stroke="none" />
            </svg>
            <span>{o.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
