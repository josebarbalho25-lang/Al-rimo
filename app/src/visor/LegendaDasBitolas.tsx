// ═══════════════════════════════════════════════════════════════════════════
//  visor/LegendaDasBitolas.tsx — a legenda da Armadura: bolinha + Ø
// ---------------------------------------------------------------------------
//  Como a "LEGENDA CORES VERGALHÕES" das pranchas do Jose (bolinha de cor e o
//  Ø ao lado). Só os Ø que estão na tela. Mesmo lugar e mesmo estilo da
//  legenda do Cores; com a Armadura ligada é esta que aparece.
//
//  ⚠️ A FOTO LEVA A LEGENDA JUNTO (`desenharLegendaDasBitolas`), como no Cores:
//  a imagem vai para a obra, e cor sem legenda não diz qual é o Ø.
// ═══════════════════════════════════════════════════════════════════════════

import { corDaBitola, rotuloDaBitola } from './coresDasBitolas';
import type { PaletaVisor } from './tema3d';

export function LegendaDasBitolas({ diametros }: { diametros: readonly number[] }) {
  if (!diametros.length) return null;
  return (
    <div className="v3-legenda" data-legenda="bitolas">
      {diametros.map((d) => (
        <div key={d} className="v3-legenda-linha">
          <span className="v3-legenda-cor redonda" style={{ background: corDaBitola(d) }} />
          <span>{rotuloDaBitola(d)}</span>
        </div>
      ))}
    </div>
  );
}

/** A mesma legenda pintada na foto, no canto de cima à direita (`escala` = densidade da foto). */
export function desenharLegendaDasBitolas(g: CanvasRenderingContext2D, largura: number, diametros: readonly number[], paleta: PaletaVisor, escala: number): void {
  if (!diametros.length) return;
  const e = escala;
  const linha = 20 * e;
  const lado = 11 * e;
  const folga = 9 * e;
  g.save();
  g.font = `500 ${12 * e}px "Segoe UI", system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const rotulos = diametros.map(rotuloDaBitola);
  const texto = Math.max(...rotulos.map((t) => g.measureText(t).width));
  const w = folga * 2 + lado + 7 * e + texto;
  const h = folga * 2 + linha * diametros.length - (linha - lado) / 2;
  const x0 = largura - w - 12 * e;
  const y0 = 12 * e;
  g.globalAlpha = 0.92;
  g.fillStyle = paleta.superficie;
  g.fillRect(x0, y0, w, h);
  g.globalAlpha = 1;
  g.strokeStyle = paleta.escuro ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  g.lineWidth = e;
  g.strokeRect(x0 + e / 2, y0 + e / 2, w - e, h - e);
  diametros.forEach((d, i) => {
    const cy = y0 + folga + lado / 2 + i * linha;
    g.beginPath();
    g.arc(x0 + folga + lado / 2, cy, lado / 2, 0, Math.PI * 2);
    g.fillStyle = corDaBitola(d);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.stroke();
    g.fillStyle = paleta.tinta;
    g.fillText(rotulos[i], x0 + folga + lado + 7 * e, cy + e * 0.5);
  });
  g.restore();
}
