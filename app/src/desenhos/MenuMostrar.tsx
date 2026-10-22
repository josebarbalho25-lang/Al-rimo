/*
  O "Mostrar" de uma vista 2D (Jose, 15/10: "controlar o que aparece ou não, principalmente na vista em planta") — o
  liga/desliga DA VISTA (16/10: é a parte de visibilidade da sobreposição dela, a mesma da janela de gráficos): o que
  se desliga numa vista some dela, na tela e na prancha (PDF e DXF); as outras vistas não mudam. O botão acende quando
  há algo desligado.
*/
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ITENS_DA_VISTA, rotuloDoItem, type ItemDaVista, type TipoDeVista } from './graficos';
import { ICONES, useNaGrafica } from '@/ui/grafica/Encaixes';

const s = {
  ancora: { position: 'relative', display: 'inline-flex' } as CSSProperties,
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, minWidth: 180, padding: '4px 0',
    background: 'var(--surface, #fff)', border: '1px solid var(--control-stroke-2, #999)', borderRadius: 6,
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  } as CSSProperties,
  linha: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', cursor: 'pointer', whiteSpace: 'nowrap' } as CSSProperties,
};

export function MenuMostrar({ vista, ocultos, aoMudar, estiloDoBotao }: {
  vista: TipoDeVista;
  ocultos: readonly ItemDaVista[];
  aoMudar: (item: ItemDaVista, mostra: boolean) => void;
  estiloDoBotao?: CSSProperties;
}) {
  const [aberto, setAberto] = useState(false);
  // na faixa da Gráfica o botão é o grande (ícone e nome) e o menu abre para a direita, embaixo dele
  const naFaixa = useNaGrafica();
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

  const algum = ITENS_DA_VISTA[vista].some((i) => ocultos.includes(i));
  return (
    <div style={s.ancora} ref={caixa}>
      {naFaixa ? (
        <button type="button" className={`faixa-botao${algum ? ' on' : ''}`} title="O que aparece nesta vista" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          {ICONES.mostrar({ tamanho: 22 })}
          <span>Mostrar</span>
        </button>
      ) : (
        <button type="button" style={estiloDoBotao} className={algum ? 'on' : undefined} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          Mostrar
        </button>
      )}
      {aberto && (
        <div style={naFaixa ? { ...s.menu, right: 'auto', left: 0 } : s.menu} role="menu">
          {ITENS_DA_VISTA[vista].map((item) => (
            <label key={item} style={s.linha}>
              <input type="checkbox" checked={!ocultos.includes(item)} onChange={(e) => aoMudar(item, e.target.checked)} />
              {rotuloDoItem(item)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
