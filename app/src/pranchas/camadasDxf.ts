/*
  CAMADAS DO DXF — a tabela fixa: cada camada tem a SUA cor (índice do CAD) e a SUA espessura, iguais em todo
  arquivo que o app gera. Antes a cor da camada era "a mais usada pelas entidades dela" e mudava de um muro para
  outro (o GRAUTE saiu 151 num arquivo e 7 no outro): o cadista que monta a tabela de penas (CTB) uma vez não
  pode ter a camada trocando de cor.

  As entidades vão "por camada" (ByLayer) em cor e espessura — quem manda é a camada, e o cadista muda tudo de
  uma vez. A exceção é onde a COR É INFORMAÇÃO, que vai com a cor verdadeira (grupo 420) e o índice mais
  próximo (62):
    · os FUNDOS sólidos — a cor de cada tipo de bloco (as do Revit do José), o bege da terra, o cinza do concreto;
    · as faces do 3D Cores;
    · a barra do 3D com Armadura, na cor da bitola (Traco.corPropria).

  Convenção: a do Pró-Viga do mesmo dono (app/dxf-writer.js, tabela LAYERS): CONCRETO 8, armadura 7, COTAS 8,
  TEXTO 7, referência/eixo 8. O que o Pró-Viga não tem segue a cor do desenho do app no índice básico mais
  próximo (graute azul, terra marrom; a drenagem no cinza das hachuras de brita e areia) — a tela do CAD lembra o PDF, e a plotagem é pela pena.

  Espessuras (mm, as da série do CAD): moldura 0,50; título e aço 0,35; concreto 0,25; contorno, texto, cota e
  quadro 0,18; o resto 0,13 — a menor que a plotadora marca.

  FUNDOS: todo sólido de preenchimento vai para a camada do material com o sufixo -FUNDO (ALVENARIA-FUNDO,
  TERRENO-FUNDO…), e as faces do 3D Cores para 3D-FACES. Plotado em monocromático, sólido colorido sai PRETO e
  apaga o desenho: o cadista congela (ou não plota) as -FUNDO e as 3D-FACES e fica só o traço. O risco da
  hachura (EARTH, AR-CONC, ANSI31…) fica na camada do material, que é desenho.
*/

export interface CamadaDoCad {
  /** Índice de cor do CAD (ACI). 7 = preto no papel, branco na tela. */
  aci: number;
  /** Espessura de linha, mm (uma das que o CAD aceita). */
  espessura: number;
  /** O que vai nela (documentação: a descrição de camada do CAD é XDATA de versão posterior à 2004). */
  conteudo: string;
}

/** A tabela. Nome da camada no CAD (maiúsculo, sem acento) → cor e espessura. */
export const CAMADAS: Readonly<Record<string, CamadaDoCad>> = {
  FOLHA: { aci: 8, espessura: 0.13, conteudo: 'borda do papel (linha de corte da folha)' },
  MOLDURA: { aci: 7, espessura: 0.5, conteudo: 'moldura da folha' },
  CARIMBO: { aci: 7, espessura: 0.18, conteudo: 'carimbo (bloco com atributos) e a logomarca' },
  QUADRO: { aci: 7, espessura: 0.18, conteudo: 'quadro lateral: notas gerais, legenda, resumo do aço' },
  TITULOS: { aci: 7, espessura: 0.35, conteudo: 'título e escala embaixo de cada desenho' },
  TEXTOS: { aci: 7, espessura: 0.18, conteudo: 'rótulos e notas dos desenhos' },
  COTAS: { aci: 8, espessura: 0.18, conteudo: 'cotas: linha, marca oblíqua e número' },
  EIXOS: { aci: 8, espessura: 0.13, conteudo: 'eixo de contraforte e junta de controle (tracejados)' },
  LEGENDA: { aci: 7, espessura: 0.18, conteudo: 'legenda dentro do desenho (cores dos blocos, bitolas)' },
  ALVENARIA: { aci: 7, espessura: 0.18, conteudo: 'blocos: contorno e hachura a 45° no corte' },
  GRAUTE: { aci: 5, espessura: 0.13, conteudo: 'graute: contorno e riscos' },
  CONCRETO: { aci: 8, espessura: 0.25, conteudo: 'sapata: contorno e hachura AR-CONC' },
  SAPATA: { aci: 8, espessura: 0.25, conteudo: 'sapata (o mesmo que CONCRETO)' },
  // vermelho, como nas figuras e nos desenhos do app (Jose: "vermelho só aço"); o Pró-Viga usa 7, mas aqui a barra
  // vermelha é a mesma linguagem do PDF
  ACO: { aci: 1, espessura: 0.35, conteudo: 'barras, estribos e a barra cortada (ponto cheio)' },
  TERRENO: { aci: 33, espessura: 0.18, conteudo: 'terra (hachura EARTH) e linha do terreno' },
  DRENAGEM: { aci: 8, espessura: 0.13, conteudo: 'brita, areia, manta, tubo do dreno e barbacã' },
  IMAGENS: { aci: 7, espessura: 0.13, conteudo: 'foto do 3D Realista (imagem vinculada)' },
  GERAL: { aci: 7, espessura: 0.18, conteudo: 'o que o desenho não classificou' },
  '3D-FACES': { aci: 8, espessura: 0.13, conteudo: 'faces coloridas do 3D Cores, na cor verdadeira' },
};

/** Sufixo das camadas de fundo sólido. */
export const SUFIXO_FUNDO = '-FUNDO';

/** A camada de fundo de cada material: cinza-claro na tabela; as entidades levam a cor verdadeira. */
const DE_FUNDO: CamadaDoCad = { aci: 9, espessura: 0.13, conteudo: 'fundo sólido do material (cor verdadeira)' };

/** Camada que a tabela não conhece (desenho novo que ainda não entrou aqui): preto, traço médio. */
const SEM_TABELA: CamadaDoCad = { aci: 7, espessura: 0.18, conteudo: '' };

/** Cor e espessura de uma camada pelo nome do CAD (as -FUNDO pelo sufixo). */
export function camadaDoCad(nome: string): CamadaDoCad {
  if (CAMADAS[nome]) return CAMADAS[nome];
  if (nome.endsWith(SUFIXO_FUNDO)) return DE_FUNDO;
  return SEM_TABELA;
}

/** A camada do fundo sólido de um material: 'ALVENARIA' → 'ALVENARIA-FUNDO'; as faces do 3D já são fundo. */
export function camadaDeFundo(nome: string): string {
  if (nome === '3D-FACES' || nome.endsWith(SUFIXO_FUNDO)) return nome;
  return nome + SUFIXO_FUNDO;
}
