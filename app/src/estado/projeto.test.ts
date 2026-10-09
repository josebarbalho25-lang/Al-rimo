import { describe, expect, it } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import type { EntradaMeta } from '@/motor/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { montarSecoes } from './campos';
import {
  desserializarProjeto,
  nomeDeArquivo,
  recadoDeAbertura,
  serializarProjeto,
  tituloDoArquivo,
  type Projeto,
} from './projeto';

const PLANILHA = (dados as unknown as { entradas: EntradaMeta[]; versao: string }).entradas;
const VERSAO = (dados as unknown as { versao: string }).versao;
const CAMPOS = new Map(
  montarSecoes(PLANILHA, ENTRADAS_DO_MODELO).flatMap((s) => s.campos.map((c) => [c.meta.nome, c] as const)),
);
const abrir = (texto: string, versao = VERSAO) => desserializarProjeto(texto, CAMPOS, versao);

const muro: Projeto = {
  titulo: 'Muro da divisa',
  alteracoes: { H_muro: 2.6, Tipo_muro: 'Contrafortes', t_bloco: 14, s_dir: null, l_cf: 1.6 },
  extras: { L_total: 12, junta_cada: 6, barbaca_on: 'Não' },
};

describe('salvar e abrir — ida e volta', () => {
  it('o que sai é o que volta', () => {
    const texto = serializarProjeto(muro, VERSAO);
    const a = abrir(texto);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.projeto).toEqual(muro);
    expect(a.descartados).toEqual([]);
    expect(a.outraVersao).toBe(false);
  });

  it('o arquivo é JSON legível, com a versão da conta e sem resultado', () => {
    const j = JSON.parse(serializarProjeto(muro, VERSAO));
    expect(j.formato).toBe('alrimo');
    expect(j.versaoDaConta).toBe(VERSAO);
    expect(Object.keys(j).sort()).toEqual(['alteracoes', 'extras', 'formato', 'titulo', 'versaoDaConta', 'versaoDoArquivo']);
  });

  it('nome que a conta de hoje não conhece fica de fora e é contado', () => {
    const texto = serializarProjeto(
      { ...muro, alteracoes: { ...muro.alteracoes, nome_antigo: 3 }, extras: { ...muro.extras, H_muro: 9 } },
      VERSAO,
    );
    const a = abrir(texto);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.projeto.alteracoes).toEqual(muro.alteracoes);
    // H_muro é da planilha: dentro de "extras" ele não vale.
    expect(a.projeto.extras).toEqual(muro.extras);
    expect(a.descartados.sort()).toEqual(['H_muro', 'nome_antigo']);
  });

  it('arquivo salvo com outra versão da conta abre, avisando', () => {
    const a = abrir(serializarProjeto(muro, 'conta-velha'));
    expect(a.ok && a.outraVersao).toBe(true);
    expect(a.ok && a.versaoDaConta).toBe('conta-velha');
  });

  it('valor que não é valor de célula (objeto, NaN) não entra', () => {
    const texto = JSON.stringify({
      formato: 'alrimo',
      versaoDoArquivo: 1,
      versaoDaConta: VERSAO,
      titulo: 'x',
      alteracoes: { H_muro: { a: 1 }, t_bloco: 14 },
      extras: {},
    });
    const a = abrir(texto);
    expect(a.ok && a.projeto.alteracoes).toEqual({ t_bloco: 14 });
  });

  it('o arquivo passa pela mesma porta do campo: corrige o que é inequívoco, recusa o resto', () => {
    // Achado da revisão: "2,6" (texto) ia para a conta como texto, 17 entrava na espessura
    // do bloco, e "contrafortes" em minúscula calculava contraforte com as seções escondidas.
    const texto = serializarProjeto(
      {
        titulo: 'Editado à mão',
        alteracoes: { H_muro: '2,6', t_bloco: 17, Tipo_muro: 'contrafortes', B_sap: -1.4, gama_m: 0, n_cc: 2.5, s_dir: null },
        extras: { barbaca_on: 'não', L_total: '12', barbaca_s: 0 },
      },
      VERSAO,
    );
    const a = abrir(texto);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.projeto.alteracoes).toEqual({ H_muro: 2.6, Tipo_muro: 'Contrafortes', s_dir: null });
    expect(a.projeto.extras).toEqual({ barbaca_on: 'Não', L_total: 12 });
    expect(a.recusados.sort()).toEqual(['B_sap', 'barbaca_s', 'gama_m', 'n_cc', 't_bloco']);
    expect(a.descartados).toEqual([]);
    expect(recadoDeAbertura('Editado.alrimo', a)).toBe('⚠ Editado.alrimo aberto · 5 entradas ignoradas');
  });

  it('a barra de estado diz o que aconteceu ao abrir', () => {
    const limpo = { descartados: [], recusados: [], outraVersao: false };
    expect(recadoDeAbertura('A.alrimo', limpo)).toBe('A.alrimo aberto');
    expect(recadoDeAbertura('A.alrimo', { ...limpo, outraVersao: true })).toBe('⚠ A.alrimo aberto · salvo com outra versão da conta');
    expect(recadoDeAbertura('A.alrimo', { ...limpo, descartados: ['x'] })).toBe('⚠ A.alrimo aberto · 1 entrada ignorada');
  });

  it('arquivo v1 (uma altura só, a do solo): o solo abre na altura gravada; v2 com só o muro deixa o solo no padrão', () => {
    const v1 = JSON.stringify({ formato: 'alrimo', versaoDoArquivo: 1, versaoDaConta: VERSAO, titulo: 'x', alteracoes: { H_muro: 2.6 }, extras: {} });
    const a1 = abrir(v1);
    expect(a1.ok && a1.projeto.alteracoes).toEqual({ H_muro: 2.6, H_solo: 2.6 });
    const a2 = abrir(serializarProjeto({ titulo: 'y', alteracoes: { H_muro: 2.6 }, extras: {} }, VERSAO));
    expect(a2.ok && a2.projeto.alteracoes).toEqual({ H_muro: 2.6 });
  });

  it('arquivo que não é do Al-rimo é recusado com motivo', () => {
    for (const t of ['', 'não é json', '{"formato":"portico"}', '[]', 'null']) {
      const a = abrir(t);
      expect(a.ok, t).toBe(false);
    }
    const futuro = JSON.stringify({ formato: 'alrimo', versaoDoArquivo: 99 });
    expect(abrir(futuro).ok).toBe(false);
  });
});

describe('nomes de arquivo', () => {
  it('título ↔ nome do arquivo', () => {
    expect(tituloDoArquivo('Muro da divisa.alrimo')).toBe('Muro da divisa');
    expect(tituloDoArquivo('.alrimo')).toBe('Sem título');
    expect(nomeDeArquivo('Muro: rua 3/4?', '.ifc')).toBe('Muro rua 3 4.ifc');
    expect(nomeDeArquivo('   ', '.alrimo')).toBe('Sem título.alrimo');
  });
});
