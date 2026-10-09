// ═══════════════════════════════════════════════════════════════════════════
//  visor/LegendaDasCores.tsx — a legenda do estilo Cores: quadradinho + nome
// ---------------------------------------------------------------------------
//  Só as classes que estão na tela (muro de balanço não tem bloco 34; ocultar
//  os blocos esvazia a legenda). Rótulo + cor, nada de frase: quem lê é o
//  pedreiro olhando a foto, e "Meio bloco" ao lado do azul basta.
//
//  ⚠️ A FOTO LEVA A LEGENDA JUNTO (`desenharLegenda`). A legenda da tela é HTML
//  por cima do 3D e não sai no PNG; sem ela, a imagem que vai para a obra
//  seria um muro colorido sem dizer o que cada cor é.
// ═══════════════════════════════════════════════════════════════════════════

import type { ClassePeca } from '@/modelo/tipos';
import { COR_DA_CLASSE, ORDEM_DAS_CLASSES, ROTULO_DA_CLASSE } from './estiloVisual';
import type { PaletaVisor } from './tema3d';

/** As classes presentes, na ordem da legenda. */
export function itensDaLegenda(presentes: ReadonlySet<ClassePeca>): ClassePeca[] {
  return ORDEM_DAS_CLASSES.filter((c) => presentes.has(c));
}

export function LegendaDasCores({ classes }: { classes: ReadonlySet<ClassePeca> }) {
  const itens = itensDaLegenda(classes);
  if (!itens.length) return null;
  return (
    <div className="v3-legenda" data-legenda="cores">
      {itens.map((c) => (
        <div key={c} className="v3-legenda-linha">
          <span className="v3-legenda-cor" style={{ background: COR_DA_CLASSE[c] }} />
          <span>{ROTULO_DA_CLASSE[c]}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A mesma legenda pintada na foto, no canto de cima à direita. `escala` é a
 * densidade da foto (2 = o dobro da tela): a legenda cresce junto e sai com
 * o mesmo tamanho relativo que se vê no visor.
 */
export function desenharLegenda(g: CanvasRenderingContext2D, largura: number, classes: ReadonlySet<ClassePeca>, paleta: PaletaVisor, escala: number): void {
  const itens = itensDaLegenda(classes);
  if (!itens.length) return;
  const e = escala;
  const fonte = 12 * e;
  const linha = 20 * e;
  const lado = 11 * e;
  const folga = 9 * e;
  g.save();
  g.font = `500 ${fonte}px "Segoe UI", system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const texto = Math.max(...itens.map((c) => g.measureText(ROTULO_DA_CLASSE[c]).width));
  const w = folga * 2 + lado + 7 * e + texto;
  const h = folga * 2 + linha * itens.length - (linha - lado) / 2;
  const x0 = largura - w - 12 * e;
  const y0 = 12 * e;
  g.globalAlpha = 0.92;
  g.fillStyle = paleta.superficie;
  g.fillRect(x0, y0, w, h);
  g.globalAlpha = 1;
  g.strokeStyle = paleta.escuro ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  g.lineWidth = e;
  g.strokeRect(x0 + e / 2, y0 + e / 2, w - e, h - e);
  itens.forEach((c, i) => {
    const cy = y0 + folga + lado / 2 + i * linha;
    g.fillStyle = COR_DA_CLASSE[c];
    g.fillRect(x0 + folga, cy - lado / 2, lado, lado);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.strokeRect(x0 + folga + e / 2, cy - lado / 2 + e / 2, lado - e, lado - e);
    g.fillStyle = paleta.tinta;
    g.fillText(ROTULO_DA_CLASSE[c], x0 + folga + lado + 7 * e, cy + e * 0.5);
  });
  g.restore();
}
