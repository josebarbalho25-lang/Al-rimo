/*
  DESENHOS TÉCNICOS 2D — funções puras Modelo → SVG (texto). Quem lê: o componente Desenhos (abas com zoom),
  a impressão do memorial e quem mais quiser a prancha. Nada aqui modula: o muro é o que a modulação entregou.
*/
export { vistaFrontal, desenharVistaFrontal } from './vistaFrontal';
export { corteLateral, desenharCorteLateral, cortesPadrao, barrasNoCorte, type CortePadrao } from './corteLateral';
export { planta, desenharPlanta } from './planta';
export { isometrico, desenharIsometrico, type OpcoesIso, type VistaIso } from './isometrico';
export { Prancha, COR, type OpcoesDaVista } from './prancha';
export { vistaParaPrancha } from './paraPrancha';
