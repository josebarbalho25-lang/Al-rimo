// ═══════════════════════════════════════════════════════════════════════════
//  ui/controles.tsx — os controles de uma linha de entrada
// ---------------------------------------------------------------------------
//  Quatro, e só quatro, como no diálogo de engenharia do A-PORT: o NÚMERO
//  (campo), a ESCOLHA (botões lado a lado, um aceso), o SIM/NÃO (a escolha de
//  dois) e a LISTA (combo). Quem decide qual cada entrada ganha é
//  estado/campos.ts; aqui é só desenho e teclado.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import type { Valor } from '@/motor/tipos';
import { lerDoCampo, mesmoValor, type Campo, type Opcao } from '@/estado/campos';
import { escreverNoCampo } from '@/estado/numeros';

/**
 * O campo numérico.
 *
 * ⚠️ É `type="text"`, não `type="number"`: o campo numérico do navegador
 * recusa a VÍRGULA em boa parte dos sistemas, e o Jose digita "1,6".
 *
 * Enquanto se digita, o texto é do usuário (rascunho) e cada tecla que forma
 * um número válido já vai para a conta — o 3D e a memória acompanham. Texto
 * que não é número pinta a borda de vermelho e a conta fica com o último
 * valor bom. Ao sair do campo (Tab, Enter ou clique fora) o texto volta a ser
 * o valor da conta, já escrito no formato da planilha; Esc desfaz a edição.
 */
export function CampoNumero({
  campo,
  valor,
  aoMudar,
  desabilitado = false,
}: {
  campo: Campo;
  valor: Valor;
  aoMudar: (v: number | null) => void;
  /** Campo travado num valor que vem de outra entrada: mostra, não deixa digitar. */
  desabilitado?: boolean;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const aoEntrar = useRef<Valor>(null);

  const mostrado =
    typeof valor === 'number' ? escreverNoCampo(valor, campo.meta.formato) : valor === null ? '' : String(valor);
  const errado = rascunho !== null && !lerDoCampo(rascunho, campo).ok;

  return (
    <input
      className={`campo${errado ? ' errado' : ''}`}
      type="text"
      inputMode="decimal"
      spellCheck={false}
      autoComplete="off"
      value={rascunho ?? mostrado}
      disabled={desabilitado}
      placeholder={campo.opcional ? 'auto' : undefined}
      aria-label={campo.curto}
      aria-invalid={errado || undefined}
      onFocus={(e) => {
        aoEntrar.current = valor;
        setRascunho(mostrado);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const t = e.target.value;
        setRascunho(t);
        const l = lerDoCampo(t, campo);
        if (l.ok && !mesmoValor(l.valor, valor)) aoMudar(l.valor);
      }}
      onBlur={() => setRascunho(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          const antes = aoEntrar.current;
          if (!mesmoValor(antes, valor)) aoMudar(typeof antes === 'number' ? antes : null);
          setRascunho(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Botões lado a lado, um aceso: o rádio do diálogo de engenharia (`.cad-escolha` do A-PORT). */
export function Escolha({
  opcoes,
  valor,
  rotulo,
  aoEscolher,
}: {
  opcoes: readonly Opcao[];
  valor: Valor;
  rotulo: string;
  aoEscolher: (v: Valor) => void;
}) {
  return (
    <div className="cad-escolha" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => {
        const on = mesmoValor(o.valor, valor);
        return (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'on' : undefined}
            onClick={() => !on && aoEscolher(o.valor)}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A lista (combo). O valor do `<select>` é a POSIÇÃO da opção, não o valor:
 * a lista mistura número e texto (Ø 6,3 / 10 / 12,5), e o `<select>` só
 * guarda texto — 10 e "10" virariam a mesma coisa sem dizer de onde vieram.
 * Valor que não está na lista (arquivo antigo, por exemplo) aparece como uma
 * opção a mais, em vez de o combo mentir mostrando a primeira.
 */
export function Lista({
  opcoes,
  valor,
  rotulo,
  aoEscolher,
  desabilitado = false,
}: {
  opcoes: readonly Opcao[];
  valor: Valor;
  rotulo: string;
  aoEscolher: (v: Valor) => void;
  /** Travado num valor que a situação impõe (estado/campos.ts, valorTravado): mostra, não deixa escolher. */
  desabilitado?: boolean;
}) {
  const i = opcoes.findIndex((o) => mesmoValor(o.valor, valor));
  const mostrado = i >= 0 ? opcoes[i].rotulo : valor === null ? '' : String(valor);
  return (
    <select
      className="campo texto"
      aria-label={rotulo}
      disabled={desabilitado}
      // A coluna corta as opções longas ("Enterrado (lado do s…"); a inteira fica no pairar.
      title={mostrado}
      value={i >= 0 ? String(i) : 'fora'}
      onChange={(e) => {
        const k = Number(e.target.value);
        if (Number.isInteger(k) && opcoes[k]) aoEscolher(opcoes[k].valor);
      }}
    >
      {i < 0 && <option value="fora">{valor === null ? '' : String(valor)}</option>}
      {opcoes.map((o, k) => (
        <option key={k} value={String(k)}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
