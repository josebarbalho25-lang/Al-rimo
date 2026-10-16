// ═══════════════════════════════════════════════════════════════════════════
//  pranchas/campos.tsx — os campos do painel da folha e da edição de anotações
// ---------------------------------------------------------------------------
//  Painel = rótulo + valor + controle, sem texto explicativo (regra do Jose).
//  A tela das pranchas e a edição das anotações (na aba e na folha) usam os
//  mesmos — a cota se edita igual nos dois lugares.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, type CSSProperties, type ReactNode } from 'react';

export const estiloDosCampos = {
  grupo: { display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--line, #d9dee4)' } as CSSProperties,
  tituloDoGrupo: { fontWeight: 600, color: 'var(--ink, inherit)' } as CSSProperties,
  linha: { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center', gap: 6 } as CSSProperties,
  rotulo: { color: 'var(--muted, #666)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSProperties,
  botoes: { display: 'flex', flexWrap: 'wrap', gap: 6 } as CSSProperties,
};

export function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label style={estiloDosCampos.linha}>
      <span style={estiloDosCampos.rotulo} title={rotulo}>{rotulo}</span>
      {children}
    </label>
  );
}

export function Texto({ valor, aoMudar, sugestao }: { valor: string; aoMudar: (v: string) => void; sugestao?: string }) {
  return <input className="campo" type="text" value={valor} placeholder={sugestao} onChange={(e) => aoMudar(e.target.value)} />;
}

export function Numero({ valor, aoMudar, min = 0 }: { valor: number; aoMudar: (v: number) => void; min?: number }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <input
      className="campo"
      type="text"
      inputMode="decimal"
      value={rascunho ?? String(Math.round(valor * 10) / 10).replace('.', ',')}
      onChange={(e) => {
        setRascunho(e.target.value);
        const v = Number(e.target.value.replace(',', '.'));
        if (Number.isFinite(v) && v >= min) aoMudar(v);
      }}
      onBlur={() => setRascunho(null)}
    />
  );
}

/** Campo de texto que só manda ao confirmar (Enter ou sair do campo): reescrever uma cota não redesenha a folha a
 *  cada tecla, e o texto criado não some no meio da digitação (vazio apaga). */
export function TextoConfirmado({ valor, aoConfirmar, sugestao }: { valor: string; aoConfirmar: (v: string) => void; sugestao?: string }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const confirmar = () => {
    if (rascunho !== null && rascunho !== valor) aoConfirmar(rascunho);
    setRascunho(null);
  };
  return (
    <input
      className="campo" type="text" value={rascunho ?? valor} placeholder={sugestao}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setRascunho(null);
      }}
    />
  );
}
