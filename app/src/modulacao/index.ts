/*
  Porta de entrada da modulação: entradas + conta → o muro peça a peça.

  Quem LÊ o Modelo (3D, IFC, desenhos, quantitativo) deve usar `paraGlobal`/`caixaGlobal` para pôr as peças no
  mundo — a regra do perfil local e do giro mora em perfis.ts, uma vez só.
*/
export { gerarModelo, VERSAO_MODULACAO, ESPESSURA_MANTA, COB_GRAUTE } from './gerar';
export { padroesDoModelo } from './leitura';
export { paraGlobal, caixaGlobal, caixaLocal, localDoPerfil, girar, areaPoligono } from './perfis';
export { CATALOGO } from './catalogo';
export { ENCAIXES } from './encaixes';
export { vaoAmarra } from './fiadas';
export { vaosDoContraforte } from './modular';
