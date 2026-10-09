import { describe, expect, it } from 'vitest';
import { comprimirGuid, criarEscritor, guid, real, str, uuid5, NS_ALRIMO } from './step';
import { decodificar } from './conferir';

describe('escritor STEP', () => {
  it('número: toFixed(6) sem zeros à direita, sem "-0."', () => {
    expect(real(0)).toBe('0.');
    expect(real(-1e-7)).toBe('0.');
    expect(real(1)).toBe('1.');
    expect(real(0.19)).toBe('0.19');
    expect(real(0.1 + 0.2)).toBe('0.3');
    expect(real(-0.355)).toBe('-0.355');
    expect(real(1234.5678904)).toBe('1234.56789');
    expect(() => real(NaN)).toThrow();
  });

  it('texto: acento em \\X2\\, aspa e barra invertida dobradas, e volta igual', () => {
    const s = "Aço — Ø10 'x' c:\\y";
    const e = str(s);
    expect(e).toBe("'A\\X2\\00E7\\X0\\o \\X2\\2014\\X0\\ \\X2\\00D8\\X0\\10 ''x'' c:\\\\y'");
    expect([...e].every((c) => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e)).toBe(true);
    expect(decodificar(e)).toBe(s);
    // vários acentos seguidos ficam num bloco só
    expect(str('ção')).toBe("'\\X2\\00E700E3\\X0\\o'");
  });

  it('GUID: UUID v5 bate com o Python (uuid.uuid5 + ifcopenshell.guid.compress)', () => {
    // valores conferidos no Python 3.13 / ifcopenshell 0.8.5
    expect(uuid5(NS_ALRIMO, 'demo-001|muro/M1')).toBe('e0bf97a878ad57d1ada6a6d747b2d644');
    expect(guid('demo-001|muro/M1')).toBe('3WlvUeUArNqQscfjT7ijP4');
    expect(guid('demo-001|muro/M1/bloco/F01-B001')).toBe('2RY8aETV9UBB7XneKE6qT4');
    expect(guid('x')).toBe('2lidQsdgPH69B7PDCHTveO');
    expect(guid('Bloco çã φ')).toBe('0NY8WxQuvNEOt8ESQ0QTa_');
    expect(guid('teste|projeto')).toBe('17$is08SbPVudiLCFtsIQQ');
    expect(guid('teste|peca/T1.M.f03.p012')).toBe('0SdXj7TprJwOqwZjx3tPPj');
    expect(comprimirGuid('00000000000000000000000000000000')).toBe('0000000000000000000000');
    // 1º caractere sempre em 0..3 (o 1º byte só ocupa 2 bits do 1º caractere)
    for (let i = 0; i < 500; i++) expect('0123').toContain(guid('k' + i)[0]);
  });

  it('escritor: addU não repete entidade idêntica; uma entidade por linha', () => {
    const w = criarEscritor();
    const a = w.addU('IFCCARTESIANPOINT', [[0, 0, 0]]);
    const b = w.addU('IFCCARTESIANPOINT', [[0, 0, 0]]);
    const c = w.add('IFCCARTESIANPOINT', [[0, 0, 0]]);
    expect(a.id).toBe(b.id);
    expect(c.id).not.toBe(a.id);
    const t = w.texto({ nomeArquivo: 'a.ifc', agora: '2026-01-01T00:00:00' });
    expect(t).toContain("FILE_SCHEMA(('IFC4'));");
    expect(t.split('\n').filter((l) => l.startsWith('#'))).toEqual(['#1=IFCCARTESIANPOINT((0.,0.,0.));', '#2=IFCCARTESIANPOINT((0.,0.,0.));']);
  });
});
