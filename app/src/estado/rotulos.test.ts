import { describe, expect, it } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import type { EntradaMeta } from '@/motor/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { LUGAR } from './abas';
import { definicaoDaSecao, ROTULO_CURTO, rotuloCompleto, rotuloCurto, rotuloDeReserva, semCitacao } from './rotulos';

const PLANILHA = (dados as unknown as { entradas: EntradaMeta[] }).entradas;
const TODAS = [...PLANILHA, ...ENTRADAS_DO_MODELO];

// A coluna do rótulo cabe ~22 letras na escala de fábrica (110 %, confortável).
const CABE = 22;

describe('rótulo curto de cada entrada', () => {
  it('toda entrada da planilha e do modelo tem rótulo curto escrito à mão', () => {
    const faltam = TODAS.filter((m) => !ROTULO_CURTO[m.nome]).map((m) => m.nome);
    expect(faltam).toEqual([]);
  });
  it('nenhum rótulo curto passa da coluna, cita fonte ou diz "opcional"', () => {
    for (const m of TODAS) {
      const r = rotuloCurto(m.nome, m.rotulo);
      expect(r.length, `${m.nome}: "${r}"`).toBeLessThanOrEqual(CABE);
      expect(r, m.nome).not.toMatch(/opcional|\baula\b|Gilberto/i);
      expect(r, m.nome).not.toMatch(/Ftool|\bSAP\b|\bTQS\b/);
    }
  });
  it('não há rótulo de sobra (nome que a planilha não tem mais)', () => {
    const nomes = new Set(TODAS.map((m) => m.nome));
    expect(Object.keys(ROTULO_CURTO).filter((n) => !nomes.has(n))).toEqual([]);
  });
  it('dentro de uma seção, dois campos não têm o mesmo rótulo', () => {
    const porSecao = new Map<string, string[]>();
    for (const m of TODAS) {
      // a aba da tela (estado/abas.ts); a da faixa da planilha só para quem a tela ainda não arrumou
      const id = LUGAR.get(m.nome)?.aba.id ?? definicaoDaSecao(m.secao).id;
      porSecao.set(id, [...(porSecao.get(id) ?? []), rotuloCurto(m.nome, m.rotulo)]);
    }
    for (const [id, rotulos] of porSecao) expect(new Set(rotulos).size, id).toBe(rotulos.length);
  });
  it('rótulo de reserva limpa o da planilha', () => {
    expect(rotuloDeReserva('Espaçamento das barras — opcional')).toBe('Espaçamento das barras');
    expect(rotuloDeReserva('Ka direto (opcional)')).toBe('Ka direto');
    expect(rotuloDeReserva('Considerar água?')).toBe('Considerar água');
  });
});

describe('nome completo (pairar) e opções sem citação de fonte', () => {
  it('o parêntese que cita fonte sai; o que diz o que é fica', () => {
    expect(semCitacao('Líquida (curso)')).toBe('Líquida');
    expect(semCitacao('Bruta (NBR)')).toBe('Bruta');
    expect(semCitacao('Classe de solo (Gerscovich, RJ)')).toBe('Classe de solo');
    expect(semCitacao('Contrafortes (aula 12.3)')).toBe('Contrafortes');
    expect(semCitacao('Distância ao eixo (ver Fig. 12)')).toBe('Distância ao eixo');
    expect(semCitacao('fyk (CA-50)')).toBe('fyk (CA-50)');
    expect(semCitacao('Parcial (seção I)')).toBe('Parcial (seção I)');
    expect(semCitacao('Enterrado (lado do solo)')).toBe('Enterrado (lado do solo)');
  });
  it('nenhum pairar da planilha ou do modelo cita fonte, figura ou ferramenta', () => {
    for (const m of TODAS) {
      const r = rotuloCompleto(m.rotulo);
      expect(r.length, m.nome).toBeGreaterThan(0);
      expect(r, m.nome).not.toMatch(/opcional|\baula\b|\bcurso\b|Gilberto|Gerscovich|Fig\.|planilha|\baba\b|conferir/i);
      expect(r, m.nome).not.toMatch(/Ftool|\bSAP\b|\bTQS\b|\?$/);
    }
  });
});
