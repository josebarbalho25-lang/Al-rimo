import { describe, expect, it } from 'vitest';
import { casasDoFormato, escreverNoCampo, escreverNumero, lerNumero } from './numeros';

describe('lerNumero — o que se digita no campo', () => {
  it('vírgula decimal, como na planilha', () => {
    expect(lerNumero('1,6')).toEqual({ tipo: 'numero', valor: 1.6 });
    expect(lerNumero('0,67')).toEqual({ tipo: 'numero', valor: 0.67 });
    expect(lerNumero(',5')).toEqual({ tipo: 'numero', valor: 0.5 });
  });
  it('ponto do teclado numérico também é vírgula decimal', () => {
    expect(lerNumero('1.6')).toEqual({ tipo: 'numero', valor: 1.6 });
    expect(lerNumero('1.500')).toEqual({ tipo: 'numero', valor: 1.5 });
  });
  it('espaços em volta não contam; número inteiro e negativo são lidos', () => {
    expect(lerNumero('  19 ')).toEqual({ tipo: 'numero', valor: 19 });
    expect(lerNumero('-2')).toEqual({ tipo: 'numero', valor: -2 });
    expect(lerNumero('1,')).toEqual({ tipo: 'numero', valor: 1 });
  });
  it('vazio é vazio, não zero', () => {
    expect(lerNumero('')).toEqual({ tipo: 'vazio' });
    expect(lerNumero('   ')).toEqual({ tipo: 'vazio' });
  });
  it('o que não é número é recusado', () => {
    for (const t of ['abc', '1,2,3', '1.2.3', '1,2.3', '1e3', '-', ',', '2 m', 'NaN', 'Infinity', '1 6', '1, 6', '- 2']) {
      expect(lerNumero(t), t).toEqual({ tipo: 'invalido' });
    }
  });
});

describe('escrever — o número como a tela mostra', () => {
  it('casas do formato do Excel', () => {
    expect(casasDoFormato('0.00')).toBe(2);
    expect(casasDoFormato('0.0')).toBe(1);
    expect(casasDoFormato('0.0000')).toBe(4);
    expect(casasDoFormato('0')).toBe(0);
    expect(casasDoFormato('General')).toBe(0);
  });
  it('vírgula decimal e sem separador de milhar (o campo lê de volta o que escreve)', () => {
    expect(escreverNumero(1.6, 2)).toBe('1,60');
    expect(escreverNumero(1500, 0)).toBe('1500');
    expect(lerNumero(escreverNumero(1500.25, 2))).toEqual({ tipo: 'numero', valor: 1500.25 });
  });
  it('no campo: as casas do formato, sem esconder o que foi digitado a mais', () => {
    expect(escreverNoCampo(1.6, '0.00')).toBe('1,60');
    expect(escreverNoCampo(1.625, '0.00')).toBe('1,625');
    expect(escreverNoCampo(19, '0')).toBe('19');
    expect(escreverNoCampo(0.4, '0.000')).toBe('0,400');
    expect(escreverNoCampo(Number.NaN, '0.00')).toBe('');
  });
  it('a 5ª casa digitada aparece no campo (a conta usa o número inteiro)', () => {
    expect(escreverNoCampo(0.33333, '0.00')).toBe('0,33333');
    expect(escreverNoCampo(1.234567, '0')).toBe('1,234567');
    expect(lerNumero(escreverNoCampo(0.33333, '0.00'))).toEqual({ tipo: 'numero', valor: 0.33333 });
    // ruído de conta de ponto flutuante não vira dígito na tela
    expect(escreverNoCampo(1.6000000000000003, '0.00')).toBe('1,60');
    expect(escreverNoCampo(0.1 + 0.2, '0.0')).toBe('0,3');
  });
});
