// ═══════════════════════════════════════════════════════════════════════════
//  figuras/dinamicas/CorteDoMuro.tsx — a Fig. 1 desenhada com os valores
// ---------------------------------------------------------------------------
//  PILOTO da entrada por figuras (Jose, 10/10, como os dados de vento do
//  A-PORT): o corte do muro com a sapata, o solo e as cargas NA PROPORÇÃO
//  digitada. Mudou h muro, h solo, B, h da sapata, a distância da borda
//  aterrada ou o NA, o desenho muda junto. Cada cota é clicável e leva ao
//  campo dela (aoClicar).
//
//  Só desenho: nenhuma conta aqui. Os valores vêm do formulário (ler), em m,
//  exceto t do bloco e tenr (cm). Mesmas cores das figuras fixas (applib.py),
//  em papel claro: no tema escuro a .prancheta inverte como as outras.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import type { Valor } from '@/motor/tipos';
import { escreverNumero } from '@/estado/numeros';

const C = {
  line: '#262626', dim: '#404040', soil: '#8d6e3f', soilfill: '#e8d8b9', load: '#c55a11', empuxo: '#f8cbad',
  water: '#2e75b6', blockfill: '#d9d9d9', groutfill: '#bdd7ee', grout: '#2e75b6', concreto: '#ececec', note: '#595959',
  steel: '#c00000',
};
const W = 1000;
const H = 620;
const FONTE = "Arial,'DejaVu Sans',sans-serif";

const num = (v: Valor, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const m = (v: number) => escreverNumero(v, 2);

export function CorteDoMuro({ ler, aoClicar, ativo }: {
  ler: (nome: string) => Valor;
  aoClicar: (nome: string) => void;
  /** O campo em foco: a cota dele acende. */
  ativo: string | null;
}) {
  // ── os valores (com piso, para o desenho nunca degenerar) ──
  const hm = Math.max(0.2, num(ler('H_muro'), 1.6));
  const hsolo = Math.min(hm, Math.max(0.05, num(ler('H_solo'), hm)));
  const t = Math.max(0.09, num(ler('t_bloco'), 19) / 100);
  const B = Math.max(t, num(ler('B_sap'), 1.4));
  const hs = Math.max(0.1, num(ler('h_sap'), 0.3));
  const a = Math.min(B, Math.max(0, num(ler('a_ater'), B / 2)));
  const q = num(ler('q_sobre'), 0);
  const agua = ler('Agua') === 'Sim';
  const zNA = num(ler('z_NA'), 1);
  const comCf = ler('Tipo_muro') === 'Contrafortes';
  const tenr = num(ler('tenr_'), 59) / 100;
  const cfEnterrado = String(ler('pos_cf') ?? '').startsWith('Ente');

  // ── o mundo em metros: x = 0 no eixo do muro, + para o solo; y = 0 no topo da sapata, + para cima ──
  const xPe = a - B;          // borda externa (pé)
  const xTalao = a;           // borda aterrada
  const xFace = t / 2;        // face do solo
  const xmin = Math.min(xPe, -t / 2, comCf && !cfEnterrado ? -t / 2 - (tenr - t) : 0) - 0.55;
  const xSolo = Math.max(xTalao, xFace, comCf && cfEnterrado ? xFace + tenr - t : 0) + Math.max(0.6, 0.35 * hm);
  const xmax = xSolo + 0.15;
  const ymin = -hs - 0.25;
  const ymax = Math.max(hm, hsolo + (q > 0 ? 0.35 : 0)) + 0.25;
  // margens do papel para as cotas (px)
  const ME = 120, MD = 150, MC = 50, MB = 95;
  const esc = Math.min((W - ME - MD) / (xmax - xmin), (H - MC - MB) / (ymax - ymin));
  const ox = ME + ((W - ME - MD) - (xmax - xmin) * esc) / 2 - xmin * esc;
  const oy = MC + ((H - MC - MB) - (ymax - ymin) * esc) / 2 + ymax * esc;
  const X = (x: number) => ox + x * esc;
  const Y = (y: number) => oy - y * esc;

  const xW0 = X(-t / 2), xW1 = X(t / 2);
  const yTopoSap = Y(0), yBaseSap = Y(-hs), yTopoMuro = Y(hm), yTopoSolo = Y(hsolo);
  const yFundo = Y(ymin + 0.05);

  // ── cotas clicáveis ──
  const cota = (campo: string, filhos: ReactNode) => (
    <g
      className={`cota-viva${ativo === campo ? ' on' : ''}`}
      onClick={() => aoClicar(campo)}
      role="button"
      aria-label={`Ir para ${campo}`}
    >
      {filhos}
    </g>
  );
  const cotaV = (x: number, y0: number, y1: number, rotulo: string, valor: string, lado: 1 | -1, xRef: number) => (
    <>
      <line x1={xRef} y1={y0} x2={x + lado * 6} y2={y0} stroke={C.dim} strokeWidth={0.7} />
      <line x1={xRef} y1={y1} x2={x + lado * 6} y2={y1} stroke={C.dim} strokeWidth={0.7} />
      <line x1={x} y1={y0} x2={x} y2={y1} stroke={C.dim} strokeWidth={1} markerStart="url(#dm-tick)" markerEnd="url(#dm-tick)" />
      <text x={x + lado * 10} y={(y0 + y1) / 2 - 4} fontSize={19} fill={C.dim} textAnchor={lado < 0 ? 'end' : 'start'} fontStyle="italic">{rotulo}</text>
      <text x={x + lado * 10} y={(y0 + y1) / 2 + 17} fontSize={16} fill={C.dim} textAnchor={lado < 0 ? 'end' : 'start'}>{valor}</text>
      <rect x={Math.min(x, x + lado * 90)} y={Math.min(y0, y1)} width={90} height={Math.abs(y1 - y0)} fill="transparent" />
    </>
  );
  const cotaH = (y: number, x0: number, x1: number, rotulo: string, valor: string, yRef: number) => (
    <>
      <line x1={x0} y1={yRef} x2={x0} y2={y + 6} stroke={C.dim} strokeWidth={0.7} />
      <line x1={x1} y1={yRef} x2={x1} y2={y + 6} stroke={C.dim} strokeWidth={0.7} />
      <line x1={x0} y1={y} x2={x1} y2={y} stroke={C.dim} strokeWidth={1} markerStart="url(#dm-tick)" markerEnd="url(#dm-tick)" />
      <text x={(x0 + x1) / 2} y={y + 22} fontSize={17} fill={C.dim} textAnchor="middle">
        <tspan fontStyle="italic" fontSize={19}>{rotulo}</tspan> = {valor}
      </text>
      <rect x={Math.min(x0, x1)} y={y - 8} width={Math.max(Math.abs(x1 - x0), 60)} height={36} fill="transparent" />
    </>
  );

  // empuxo: triângulo na face do solo, do topo do solo ao topo da sapata (forma, não escala de pressão)
  const larguraEmpuxo = Math.min(150, Math.max(60, 0.45 * (hsolo * esc)));
  const nSetas = Math.max(2, Math.min(7, Math.round((hsolo * esc) / 45)));
  // NA: z medido do topo do solo; desenhado enquanto estiver acima da base da sapata
  const yNA = agua && zNA >= 0 && zNA <= hsolo + hs ? Y(hsolo - zNA) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figura-viva" style={{ fontFamily: FONTE }} role="img" aria-label="Corte do muro com os valores digitados">
      <defs>
        <marker id="dm-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto">
          <path d="M2,8 L8,2" stroke={C.dim} strokeWidth={1.5} />
        </marker>
        <marker id="dm-arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.load} />
        </marker>
        <pattern id="dm-solo" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
          <rect width="12" height="12" fill={C.soilfill} />
          <line x1="0" y1="0" x2="0" y2="12" stroke={C.soil} strokeWidth="1" opacity="0.45" />
        </pattern>
        <pattern id="dm-conc" patternUnits="userSpaceOnUse" width="14" height="14">
          <rect width="14" height="14" fill={C.concreto} />
          <circle cx="3" cy="4" r="1" fill="#9a9a9a" />
          <circle cx="10" cy="9" r="0.8" fill="#9a9a9a" />
          <circle cx="6" cy="12" r="0.6" fill="#9a9a9a" />
        </pattern>
      </defs>

      {/* solo contido (direita) e solo da frente (esquerda, no nível do topo da sapata) */}
      <polygon
        points={`${xW1},${yTopoSolo} ${X(xSolo)},${yTopoSolo} ${X(xSolo)},${yFundo} ${X(xmin + 0.1)},${yFundo} ${X(xmin + 0.1)},${yTopoSap} ${xW0},${yTopoSap} ${xW0},${yTopoSap} ${xW1},${yTopoSap}`}
        fill="url(#dm-solo)"
        stroke="none"
      />
      <line x1={xW1} y1={yTopoSolo} x2={X(xSolo)} y2={yTopoSolo} stroke={C.soil} strokeWidth={2} />
      <line x1={X(xmin + 0.1)} y1={yTopoSap} x2={X(xPe)} y2={yTopoSap} stroke={C.soil} strokeWidth={2} />

      {/* contraforte (atrás do plano do corte) */}
      {comCf && (
        <rect
          x={cfEnterrado ? xW1 : X(-t / 2 - (tenr - t))}
          y={yTopoMuro}
          width={(tenr - t) * esc}
          height={yTopoSap - yTopoMuro}
          fill="none"
          stroke={C.line}
          strokeWidth={1.2}
          strokeDasharray="8,5"
        />
      )}

      {/* sapata */}
      <rect x={X(xPe)} y={yTopoSap} width={B * esc} height={hs * esc} fill="url(#dm-conc)" stroke={C.line} strokeWidth={1.4} />

      {/* empuxo */}
      {hsolo > 0.05 && (
        <g>
          <polygon
            points={`${xW1},${yTopoSolo} ${xW1 + 6},${yTopoSolo} ${xW1 + larguraEmpuxo},${yTopoSap} ${xW1},${yTopoSap}`}
            fill={C.empuxo}
            stroke={C.load}
            strokeWidth={1.4}
            fillOpacity={0.75}
          />
          {Array.from({ length: nSetas }, (_, i) => {
            const f = (i + 1) / (nSetas + 1);
            const y = yTopoSolo + f * (yTopoSap - yTopoSolo);
            return <line key={i} x1={xW1 + 6 + (larguraEmpuxo - 6) * f - 2} y1={y} x2={xW1 + 3} y2={y} stroke={C.load} strokeWidth={1.3} markerEnd="url(#dm-arr)" />;
          })}
        </g>
      )}

      {/* muro, canaleta do topo e barra */}
      <rect x={xW0} y={yTopoMuro} width={t * esc} height={yTopoSap - yTopoMuro} fill={C.blockfill} stroke={C.line} strokeWidth={1.4} />
      <rect x={xW0} y={yTopoMuro} width={t * esc} height={Math.min(0.19 * esc, (yTopoSap - yTopoMuro) / 3)} fill={C.groutfill} stroke={C.grout} strokeWidth={1} />
      <polyline
        points={`${xW1 - 0.05 * esc},${yTopoMuro + 6} ${xW1 - 0.05 * esc},${yBaseSap - 0.05 * esc} ${xW1 - 0.05 * esc + Math.min(0.3, a) * esc},${yBaseSap - 0.05 * esc}`}
        fill="none"
        stroke={C.steel}
        strokeWidth={2.6}
      />

      {/* sobrecarga */}
      {q > 0 &&
        cota('q_sobre', (
          <>
            <line x1={xW1 + 20} y1={yTopoSolo - 45} x2={X(xSolo) - 10} y2={yTopoSolo - 45} stroke={C.load} strokeWidth={1.5} />
            {Array.from({ length: Math.max(2, Math.floor((X(xSolo) - xW1 - 30) / 36)) }, (_, i) => {
              const x = xW1 + 24 + i * 36;
              return <line key={i} x1={x} y1={yTopoSolo - 45} x2={x} y2={yTopoSolo - 3} stroke={C.load} strokeWidth={1.5} markerEnd="url(#dm-arr)" />;
            })}
            <text x={X(xSolo) - 6} y={yTopoSolo - 54} fontSize={18} fill={C.load} textAnchor="end" fontWeight="bold">
              q = {escreverNumero(q, 1)} kPa
            </text>
            <rect x={xW1 + 20} y={yTopoSolo - 70} width={X(xSolo) - xW1 - 30} height={68} fill="transparent" />
          </>
        ))}

      {/* nível d'água */}
      {yNA !== null &&
        cota('z_NA', (
          <>
            <line x1={xW1} y1={yNA} x2={X(xSolo)} y2={yNA} stroke={C.water} strokeWidth={1.8} strokeDasharray="9,6" />
            <text x={X(xSolo) - 8} y={yNA - 7} fontSize={17} fill={C.water} textAnchor="end" fontWeight="bold">NA</text>
            {cotaV(X(xSolo) + 30, yTopoSolo, yNA, 'z_NA', `${m(zNA)} m`, 1, X(xSolo))}
          </>
        ))}

      <text x={X(xSolo) - 70} y={yTopoSap - 20} fontSize={20} fill={C.soil} fontWeight="bold" textAnchor="middle">solo</text>

      {/* cotas */}
      {cota('H_muro', cotaV(xW0 - 50, yTopoMuro, yTopoSap, 'h muro', `${m(hm)} m`, -1, xW0))}
      {cota('H_solo', cotaV(X(xSolo) + (yNA !== null ? 105 : 30), yTopoSolo, yTopoSap, 'h solo', `${m(hsolo)} m`, 1, X(xSolo)))}
      {cota('h_sap', cotaV(X(xPe) - 25, yTopoSap, yBaseSap, 'h', `${m(hs)} m`, -1, X(xPe)))}
      {cota('t_bloco', cotaH(yTopoMuro - 30, xW0, xW1, 't', `${escreverNumero(t * 100, 0)} cm`, yTopoMuro))}
      {cota('B_sap', cotaH(yBaseSap + 22, X(xPe), X(xTalao), 'B', `${m(B)} m`, yBaseSap))}
      {cota('a_ater', cotaH(yBaseSap + 62, X(0), X(xTalao), 'a', `${m(a)} m`, yBaseSap))}
      <line x1={X(0)} y1={yTopoMuro - 8} x2={X(0)} y2={yBaseSap + 70} stroke={C.note} strokeWidth={0.8} strokeDasharray="12,4,2,4" />
    </svg>
  );
}
