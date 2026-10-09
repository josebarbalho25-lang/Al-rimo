/*
  Porta de entrada da memória de cálculo. A tela é '@/memoria/Memoria' (componente); daqui saem os cards (puros),
  a impressão e o Word.
*/
export type { AutorDeCards, Card, Expr, Passo, Ref, Secao, Verificacao } from './tipos';
export { AUTORES, cardsDaMemoria, verificacoesDe, vereditoDaMemoria } from './cards';
export { figuraDoCard } from './figuraDoCard';
export { imprimirMemorial, exportarWord, carregarFontesDoKatex, type OpcoesDoMemorial } from './imprimir';
export type { InfoDoMemorial } from './MemorialImpresso';
export { glossarioDe } from './glossario';
export { texDaLinha } from './linha';
export { nbr, nt } from './formato';
