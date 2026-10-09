/*
  Porta de entrada da exportação IFC: o resto do app só importa daqui.

    exportarIfc(modelo, { projeto, autor?, data?, resultado? }) → texto do .ifc (IFC4)

  `gerarIfc` devolve também a contagem e os avisos (peça que não pôde ir para o arquivo e por quê).
  `conferirStep` é a conferência barata do texto (sem Python) — serve para o botão de exportar se recusar a
  baixar um arquivo quebrado.
*/
export { exportarIfc, gerarIfc, nomeDeArquivo, type InfoIfc, type RelatorioIfc } from './exportarIfc';
export { conferirStep } from './conferir';
