/*
  O "Mostrar" das vistas 2D (Jose, 15/10: "controlar o que aparece ou não, principalmente na vista em planta") — o
  liga/desliga POR TIPO DE VISTA: o que se desliga na planta some de toda planta, na tela e na prancha (PDF e DXF).
  Mesmo jeito do menu do 3D: o botão acende quando há algo desligado.
*/
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ITENS_DA_VISTA, rotuloDoItem, type Graficos, type ItemDaVista, type TipoDeVista } from './graficos';
import { useGraficos } from './useGraficos';

const s = {
  ancora: { position: 'relative', display: 'inline-flex' } as CSSProperties,
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, minWidth: 180, padding: '4px 0',
    background: 'var(--surface, #fff)', border: '1px solid var(--control-stroke-2, #999)', borderRadius: 6,
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  } as CSSProperties,
  linha: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', cursor: 'pointer', whiteSpace: 'nowrap' } as CSSProperties,
};

export function MenuMostrar({ vista, estiloDoBotao }: { vista: TipoDeVista; estiloDoBotao?: CSSProperties }) {
  const ocultos = useGraficos((st) => st.dados.ocultos[vista]);
  const mudar = useGraficos((st) => st.mudar);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // fecha clicando fora, como o menu do 3D
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    window.addEventListener('pointerdown', fora, true);
    return () => window.removeEventListener('pointerdown', fora, true);
  }, [aberto]);

  const alternar = (item: ItemDaVista) =>
    mudar((g): Graficos => {
      const lista = g.ocultos[vista];
      const nova = lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
      return { ...g, ocultos: { ...g.ocultos, [vista]: nova } };
    });

  return (
    <div ref={caixa} style={s.ancora}>
      <button type="button" style={estiloDoBotao} className={aberto || ocultos.length ? 'on' : undefined} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        Mostrar
      </button>
      {aberto && (
        <div style={s.menu} role="menu">
          {ITENS_DA_VISTA[vista].map((item) => (
            <label key={item} style={s.linha} data-item={item}>
              <input type="checkbox" checked={!ocultos.includes(item)} onChange={() => alternar(item)} />
              <span>{rotuloDoItem(item)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
