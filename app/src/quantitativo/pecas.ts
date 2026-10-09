/*
  A FIGURA DE CADA PEÇA NA TABELA DE BLOCOS — a peça desenhada sozinha, em isométrica, na cor do Jose.

  Os SVG ficam em public/pecas/ e saem de figs/app/pecas/ (gerar.py), que lê as medidas do MESMO catálogo da
  modulação (modulacao/catalogo.ts): o furo do ícone é o furo do 3D. Cada arquivo traz um recorte '#icone' (só a
  peça, na mesma caixa para a família toda) e esconde as cotas sozinho quando a imagem é pequena — por isso o
  ícone e a figura grande do modal são o mesmo arquivo.

  A peça se acha pela CLASSE da geometria (a cor do Jose: inteiro, meio, 34, 54, canaleta) + a família do muro.
  A classe 'canaleta' junta a inteira, a meia e as cortadas; o tipo da peça separa as três. Peça sem figura
  (geometria sem classe) fica sem ícone — a linha continua igual.
*/
import type { ClassePeca, TipoPeca } from '@/modelo/tipos';

export interface FiguraDaPeca {
  titulo: string;   // cabeçalho do modal
  url: string;      // figura inteira (modal)
  icone: string;    // recorte só da peça (tabela)
}

/** Peças desenhadas por família (= figs/app/pecas/pecas.py, PECAS). O teste confere que cada arquivo existe. */
export const FIGURAS_DAS_PECAS: Readonly<Record<string, readonly string[]>> = {
  '14x39': ['inteiro', 'meio', 'bloco34', 'bloco54', 'canaleta', 'meia_canaleta', 'canaleta_cortada'],
  '19x39': ['inteiro', 'meio', 'canaleta', 'meia_canaleta', 'canaleta_cortada'],
};
const PREFIXO: Readonly<Record<string, string>> = { '14x39': 'b14', '19x39': 'b19' };

/** Classe + tipo → peça desenhada. Combinação que a modulação não fabrica hoje (bloco cortado...) não tem figura. */
function pecaDesenhada(classe: ClassePeca, tipo: TipoPeca): string | null {
  switch (classe) {
    case 'inteiro': return tipo === 'BLOCO' ? 'inteiro' : null;
    case 'meio': return tipo === 'MEIO_BLOCO' ? 'meio' : null;
    case 'bloco34': return tipo === 'BLOCO_JUNCAO' ? 'bloco34' : null;
    case 'bloco54': return tipo === 'BLOCO_JUNCAO' ? 'bloco54' : null;
    case 'canaleta':
      return tipo === 'CANALETA' ? 'canaleta' : tipo === 'MEIA_CANALETA' ? 'meia_canaleta' : tipo === 'CANALETA_CORTADA' ? 'canaleta_cortada' : null;
    default: return null;
  }
}

/** Nome do arquivo em public/pecas ('b14_bloco34.svg'), ou null se a peça não tem figura. */
export function arquivoDaPeca(familia: string, classe: ClassePeca | undefined, tipo: TipoPeca): string | null {
  if (!classe) return null;
  const peca = pecaDesenhada(classe, tipo);
  if (!peca || !FIGURAS_DAS_PECAS[familia]?.includes(peca)) return null;
  return `${PREFIXO[familia]}_${peca}.svg`;
}

/** A figura da linha da tabela de blocos. O título é o nome de catálogo da linha ("Bloco 14x19x34 (amarração em L)"). */
export function figuraDaPeca(familia: string, linha: { classe?: ClassePeca; tipo: TipoPeca; catalogo: string }): FiguraDaPeca | null {
  const arq = arquivoDaPeca(familia, linha.classe, linha.tipo);
  if (!arq) return null;
  const url = `${import.meta.env.BASE_URL}pecas/${arq}`;
  const titulo = linha.catalogo ? linha.catalogo[0].toUpperCase() + linha.catalogo.slice(1) : arq;
  return { titulo, url, icone: `${url}#icone` };
}
