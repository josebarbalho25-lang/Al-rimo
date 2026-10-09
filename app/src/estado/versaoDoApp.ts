// A versão do app é a do package.json, e só ela: o memorial imprime este
// número (Termo, itens 2.3 e 12.1 — o mesmo muro pode dar outro resultado em
// outra versão), e um número copiado à mão em outro lugar ficaria para trás no
// primeiro "npm version". Importação nomeada: o Vite leva só o campo, não o
// package.json inteiro, para dentro do pacote.
import { version } from '../../package.json';

export const VERSAO_DO_APP: string = version;
