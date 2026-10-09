import { describe, expect, it } from 'vitest';
import { muroDeExemplo } from './exemploDeModelo';
import { categoriasDaBarra, categoriasDaPeca, montarLotes, visivel, type Categoria } from './lotes';

describe('lotes: um InstancedMesh por forma × grupo de ocultar', () => {
  const m = muroDeExemplo({ blocosPorFiada: 6, fiadas: 8, contraforte: true, terreno: true });
  const { lotes, semGeometria } = montarLotes(m);
  const lote = (chave: string) => lotes.find((l) => l.chave === chave)!;

  it('conta as instâncias de cada chave', () => {
    expect(semGeometria).toEqual([]);
    // 8 fiadas, a última de canaleta: 3 pares de bloco (6 cada) + 4 ímpares (5 inteiros + 2 meios).
    // Fiadas 0..6 de bloco: pares 0,2,4,6 → 4 × 6 = 24; ímpares 1,3,5 → 3 × 5 = 15. Total 39.
    expect(lote('bloco 14x19x39|alvenaria|blocos').ids.length).toBe(39);
    expect(lote('meio bloco 14x19x19|alvenaria|blocos').ids.length).toBe(6);
    // Fiada 7 é ímpar: 5 canaletas + 2 meias.
    expect(lote('canaleta 14x19x39|alvenaria|blocos').ids.length).toBe(5);
    expect(lote('meia canaleta 14x19x19|alvenaria|blocos').ids.length).toBe(2);
    // O MESMO bloco no contraforte cai em lote próprio (ocultar Contrafortes leva só ele).
    expect(lote('bloco 14x19x39|alvenaria|blocos+contrafortes').ids.length).toBe(8);
    // Barras a cada 2 blocos → 3 furos grauteados × 7 fiadas de bloco.
    expect(lote('graute furo 14x39|graute|graute').ids.length).toBe(21);
    expect(lote('graute furo 14x39|graute|graute+contrafortes').ids.length).toBe(8);
    expect(lote('sapata|concreto|fundacao').ids).toEqual(['SAP.T1']);
    const total = lotes.reduce((s, l) => s + l.ids.length, 0);
    expect(total).toBe(m.pecas.length);
  });

  it('instanceId → Peca.id na ordem em que as peças vieram', () => {
    const l = lote('meio bloco 14x19x19|alvenaria|blocos');
    const esperado = m.pecas.filter((p) => p.geometria === 'meio bloco 14x19x19').map((p) => p.id);
    expect(l.ids).toEqual(esperado);
    // E a matriz da instância i é a da peça i: o meio bloco da ponta direita da fiada 1 começa em x = 2200 mm.
    const i = l.ids.indexOf('T1.M.f01.p006');
    expect(l.matrizes[i * 16 + 12]).toBeCloseTo(2.2, 6);
    expect(l.matrizes[i * 16 + 14]).toBeCloseTo(0.21, 6);
  });

  it('caixa do lote em metro', () => {
    const c = lote('sapata|concreto|fundacao').caixa;
    expect(c.min.map((x) => +x.toFixed(4))).toEqual([0, -0.5, -0.55]);
    expect(c.max.map((x) => +x.toFixed(4))).toEqual([2.39, 0.9, 0]);
  });

  it('categorias: peça de duas categorias só aparece com as duas acesas', () => {
    const cf = m.pecas.find((p) => p.grupo === 'contraforte' && p.tipo === 'GRAUTE_FURO')!;
    expect(categoriasDaPeca(cf)).toEqual(['graute', 'contrafortes']);
    const est = m.barras.find((b) => b.papel === 'CF_ESTRIBO')!;
    expect(categoriasDaBarra(est)).toEqual(['armadura', 'contrafortes']);
    expect(categoriasDaBarra(m.barras.find((b) => b.papel === 'SAP_TRANSV')!)).toEqual(['armadura', 'fundacao']);
    const oc = (...c: Categoria[]) => new Set<Categoria>(c);
    expect(visivel(['graute', 'contrafortes'], oc())).toBe(true);
    expect(visivel(['graute', 'contrafortes'], oc('graute'))).toBe(false);
    expect(visivel(['graute', 'contrafortes'], oc('contrafortes'))).toBe(false);
    expect(visivel(['graute'], oc('contrafortes'))).toBe(true);
  });

  it('peça com geometria ausente vai para a lista de defeitos, não derruba o visor', () => {
    const quebrado = { ...m, pecas: [...m.pecas, { ...m.pecas[0]!, id: 'X', geometria: 'não existe' }] };
    expect(montarLotes(quebrado).semGeometria).toEqual(['X']);
  });
});
