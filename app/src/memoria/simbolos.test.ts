import { describe, expect, it } from 'vitest';
import { CONFLITOS_DE_SIMBOLO } from './simbolos';

describe('dicionário de símbolos', () => {
  // Uma letra, um significado: dois grupos não podem descrever o mesmo símbolo de jeitos diferentes no glossário.
  it('nenhum símbolo com duas descrições entre os grupos', () => {
    expect(CONFLITOS_DE_SIMBOLO).toEqual([]);
  });
});
