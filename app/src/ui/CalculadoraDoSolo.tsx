// ═══════════════════════════════════════════════════════════════════════════
//  ui/CalculadoraDoSolo.tsx — a calculadora de consulta da Fig. 22
// ---------------------------------------------------------------------------
//  Duas linhas embaixo das tabelas de solo: φ' → Ka e Kp; NSPT de argila →
//  consistência, c', φ' e su de referência. Rótulo + valor + controle, sem
//  frase (regra do Jose). Não escreve no formulário: o campo daqui é rascunho
//  da consulta, e o valor que servir o engenheiro copia à mão. Começa com o
//  φ' e o NSPT que estão no formulário, que é o que ele está olhando.
//  A conta é a da planilha (figuras/calculadoraDoSolo.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { useId, useState } from 'react';
import { argilaPeloNspt, rankine } from '@/figuras/calculadoraDoSolo';
import { escreverNumero, lerNumero } from '@/estado/numeros';
import { leitorDoEstado, useApp } from '@/estado/store';

const inicial = (v: unknown): string => (typeof v === 'number' ? String(v).replace('.', ',') : '');

export function CalculadoraDoSolo() {
  const alteracoes = useApp((s) => s.alteracoes);
  const extras = useApp((s) => s.extras);
  const [phi, setPhi] = useState(() => inicial(leitorDoEstado({ alteracoes, extras })('phi_solo')));
  const [nspt, setNspt] = useState(() => inicial(leitorDoEstado({ alteracoes, extras })('NSPT')));
  const idPhi = useId();
  const idN = useId();

  // calcular() é preguiçoso: cada tecla custa só as poucas células pedidas
  const lPhi = lerNumero(phi);
  const k = lPhi.tipo === 'numero' ? rankine(lPhi.valor) : null;
  const lN = lerNumero(nspt);
  const a = lN.tipo === 'numero' ? argilaPeloNspt(lN.valor) : null;
  const phiErrado = lPhi.tipo !== 'vazio' && k === null;
  const nErrado = lN.tipo !== 'vazio' && a === null;

  return (
    <div className="calc-solo">
      <div className="calc-linha">
        <label htmlFor={idPhi}>φ'</label>
        <input
          id={idPhi}
          className={`campo${phiErrado ? ' errado' : ''}`}
          type="text"
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          value={phi}
          onChange={(e) => setPhi(e.target.value)}
        />
        <span className="unidade">°</span>
        <span className="calc-res">
          <span className="calc-rot">Ka</span>
          <output>{k ? escreverNumero(k.Ka, 3) : '—'}</output>
        </span>
        <span className="calc-res">
          <span className="calc-rot">Kp</span>
          <output>{k ? escreverNumero(k.Kp, 3) : '—'}</output>
        </span>
      </div>
      <div className="calc-linha">
        <label htmlFor={idN}>NSPT argila</label>
        <input
          id={idN}
          className={`campo${nErrado ? ' errado' : ''}`}
          type="text"
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          value={nspt}
          onChange={(e) => setNspt(e.target.value)}
        />
        <span className="unidade">golpes</span>
        <span className="calc-res">
          <output>{a ? a.consistencia : '—'}</output>
        </span>
        <span className="calc-res">
          <span className="calc-rot">c'</span>
          <output>{a ? a.c : '—'}</output>
          <span className="unidade">kPa</span>
        </span>
        <span className="calc-res">
          <span className="calc-rot">φ'</span>
          <output>{a ? a.phi : '—'}</output>
          <span className="unidade">°</span>
        </span>
        <span className="calc-res">
          <span className="calc-rot">su</span>
          <output>{a ? a.su : '—'}</output>
          <span className="unidade">kPa</span>
        </span>
      </div>
    </div>
  );
}
