// ═══════════════════════════════════════════════════════════════════════════
//  ui/barraDaJanela.tsx — no programa instalado, o cabeçalho É a barra de título
// ---------------------------------------------------------------------------
//  O jeito do Pró-Viga 3D e do All Sec (Jose, 15/11: "igual em todos os outros
//  já instaláveis"): a barra branca do Windows sai, o cabeçalho do app sobe
//  até o alto e vira a área de arrastar a janela; os três botões (minimizar,
//  maximizar, fechar) são os do PRÓPRIO Windows, desenhados por cima do canto
//  direito do cabeçalho (titleBarOverlay, instalador/main.js). Por serem os do
//  Windows, vêm de graça: o vermelho do fechar, o encaixe pelo Win+setas e
//  arrastando ao topo, o duplo clique que maximiza, a borda que redimensiona.
//  Aqui a página só diz a COR (a do cabeçalho no tema atual) e a ALTURA dele.
//
//  ⚠️ A ALTURA É A DO CABEÇALHO SEM A LINHA DE BAIXO (clientHeight): com a
//  linha, os botões cobririam o fio que separa o cabeçalho do resto.
//  ⚠️ O cabeçalho muda de altura com o Tamanho (escala) e de cor com o tema:
//  as duas coisas reenviam.
//
//  No navegador `alrimoPrograma.barraDaJanela` não existe e nada disto roda.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { ponteDoPrograma } from '@/estado/programa';
import { usePreferencias } from '@/estilo/preferenciasDaInterface';

/** rgb(23, 23, 27) → #17171b: o Electron quer a cor em hexadecimal. */
export function corHex(cor: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cor);
  return m ? '#' + m.slice(1, 4).map((c) => Number(c).toString(16).padStart(2, '0')).join('') : cor.trim();
}

/** Programa instalado com a barra própria (o preload novo). O de antes de 15/11 não tem `barraDaJanela`. */
export function temBarraPropria(): boolean {
  return typeof ponteDoPrograma()?.barraDaJanela === 'function';
}

/**
 * Pinta os botões do Windows com a cor do elemento que faz de barra (`seletor`) e na altura dele. Chamado pela
 * casca (o cabeçalho) e pela porta do termo (a faixa da janela), cada um com o seu.
 */
export function usarBarraDaJanela(seletor: string): void {
  const { tema, escala, densidade } = usePreferencias();
  useEffect(() => {
    const ponte = ponteDoPrograma();
    if (!ponte?.barraDaJanela) return;
    // a marca no <html>: as regras de arrastar e a folga dos botões (layout.css)
    document.documentElement.classList.add('programa');
    const el = document.querySelector<HTMLElement>(seletor);
    if (!el) return;
    let quadro = 0;
    let antes = '';
    const enviar = () => {
      cancelAnimationFrame(quadro);
      // um quadro depois: o tema novo já pintou e a escala nova já mediu
      quadro = requestAnimationFrame(() => {
        const estilo = getComputedStyle(el);
        const corpo = getComputedStyle(document.body);
        const b = {
          color: corHex(estilo.backgroundColor),
          symbolColor: corHex(corpo.getPropertyValue('--ink') || estilo.color),
          height: el.clientHeight,
          fundo: corHex(corpo.getPropertyValue('--bg') || corpo.backgroundColor),
        };
        const chave = JSON.stringify(b);
        if (chave === antes || b.height <= 0) return;
        antes = chave;
        ponte.barraDaJanela?.(b);
      });
    };
    enviar();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(enviar);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(quadro);
      ro?.disconnect();
    };
  }, [seletor, tema, escala, densidade]);
}

/**
 * Antes do aceite do termo a casca não monta, e sem o cabeçalho a janela não teria por onde arrastar: esta faixa,
 * da altura do cabeçalho, faz o papel dele. No navegador não existe.
 */
export function FaixaDaJanela() {
  usarBarraDaJanela('.faixa-da-janela');
  if (!temBarraPropria()) return null;
  return (
    <div className="faixa-da-janela">
      <span>Al-rimo</span>
    </div>
  );
}
