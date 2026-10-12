// ═══════════════════════════════════════════════════════════════════════════
//  ui/CalculadoraDaTensao.tsx — a calculadora de consulta da Fig. 15
// ---------------------------------------------------------------------------
//  Uma linha embaixo do desenho da sapata: SPT na base → σadm por 20·N e por
//  Mello, cada um com a faixa em que vale (fora dela, em laranja). Mesmas
//  regras da calculadora da Fig. 22: rótulo + valor + controle, sem frase; não
//  escreve no formulário; começa com o SPT que está no formulário.
//  A conta é a da planilha (figuras/calculadoraDaTensao.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { useId, useState } from 'react';
import { tensaoPeloSpt, type RegraDeTensao } from '@/figuras/calculadoraDaTensao';
import { escreverNumero, lerNumero } from '@/estado/numeros';
import { leitorDoEstado, useApp } from '@/estado/store';

const inicial = (v: unknown): string => (typeof v === 'number' ? String(v).replace('.', ',') : '');

function Resultado({ rotulo, r }: { rotulo: string; r: RegraDeTensao | null }) {
  return (
    <span className="calc-res">
      <span className="calc-rot">{rotulo}</span>
      <output className={r && !r.dentro ? 'calc-fora' : undefined} title={r?.faixa}>
        {r ? escreverNumero(r.sadm, 0) : '—'}
      </output>
      <span className="unidade">kPa</span>
      {r && !r.dentro && <span className="calc-fora unidade">fora da faixa</span>}
    </span>
  );
}

export function CalculadoraDaTensao() {
  const alteracoes = useApp((s) => s.alteracoes);
  const extras = useApp((s) => s.extras);
  const [spt, setSpt] = useState(() => inicial(leitorDoEstado({ alteracoes, extras })('SPT_b')));
  const id = useId();

  const l = lerNumero(spt);
  const t = l.tipo === 'numero' ? tensaoPeloSpt(l.valor) : null;
  const errado = l.tipo !== 'vazio' && t === null;

  return (
    <div className="calc-solo">
      <div className="calc-linha">
        <label htmlFor={id}>SPT na base</label>
        <input
          id={id}
          className={`campo${errado ? ' errado' : ''}`}
          type="text"
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          value={spt}
          onChange={(e) => setSpt(e.target.value)}
        />
        <span className="unidade">golpes</span>
        <Resultado rotulo="σadm 20·N" r={t?.regra20N ?? null} />
        <Resultado rotulo="Mello" r={t?.mello ?? null} />
      </div>
    </div>
  );
}
