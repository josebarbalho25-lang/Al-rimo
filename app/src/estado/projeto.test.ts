import { afterEach, describe, expect, it, vi } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import type { EntradaMeta } from '@/motor/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { montarSecoes } from './campos';
import {
  desserializarProjeto,
  nomeDeArquivo,
  novoIdDeProjeto,
  projetoNovo,
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
  id: '6f1c2e0a-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
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
    expect(a.ganhouId).toBe(false);
  });

  it('o arquivo é JSON legível, com a versão da conta e sem resultado', () => {
    const j = JSON.parse(serializarProjeto(muro, VERSAO));
    expect(j.formato).toBe('alrimo');
    expect(j.versaoDaConta).toBe(VERSAO);
    expect(Object.keys(j).sort()).toEqual(['alteracoes', 'extras', 'formato', 'id', 'titulo', 'versaoDaConta', 'versaoDoArquivo']);
    expect(j.id).toBe(muro.id);
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
        id: muro.id,
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
    const a2 = abrir(serializarProjeto({ id: muro.id, titulo: 'y', alteracoes: { H_muro: 2.6 }, extras: {} }, VERSAO));
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

/*
  A identidade do muro é de onde saem os GUIDs do IFC (estado/projeto.ts). O que estes testes seguram: muro novo
  nasce com uma identidade só dele; ela atravessa salvar/abrir letra por letra; arquivo sem ela ganha uma.
*/
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('identidade do muro', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cada muro novo nasce com a sua (UUID v4)', () => {
    const a = projetoNovo();
    const b = projetoNovo();
    expect(a.id).toMatch(UUID_V4);
    expect(b.id).toMatch(UUID_V4);
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ titulo: 'Sem título', alteracoes: {}, extras: {} });
  });

  it('sem randomUUID (app aberto fora de https/localhost) a reserva ainda dá UUID v4, e diferente a cada vez', () => {
    const sorteio = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    vi.stubGlobal('crypto', { getRandomValues: sorteio });
    const ids = new Set(Array.from({ length: 50 }, novoIdDeProjeto));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    // nem crypto: o último recurso continua no formato (o arquivo tem de aceitar o que o próprio app criou)
    vi.stubGlobal('crypto', undefined);
    const ultimo = novoIdDeProjeto();
    expect(ultimo).toMatch(UUID_V4);
    expect(abrir(serializarProjeto({ ...muro, id: ultimo }, VERSAO))).toMatchObject({ ok: true, ganhouId: false, projeto: { id: ultimo } });
  });

  it('atravessa salvar e abrir sem mudar, e não depende do título', () => {
    const renomeado = abrir(serializarProjeto({ ...muro, titulo: 'Outro nome' }, VERSAO));
    expect(renomeado.ok && renomeado.projeto.id).toBe(muro.id);
    // maiúscula (escrita à mão) fica como veio: é o texto exato que vira GUID
    const maiuscula = muro.id.toUpperCase();
    expect(abrir(serializarProjeto({ ...muro, id: maiuscula }, VERSAO))).toMatchObject({ ok: true, ganhouId: false, projeto: { id: maiuscula } });
  });

  it('arquivo antigo, sem identidade, ganha uma ao abrir — e avisa (ganhouId) para o muro ficar como não salvo', () => {
    const antigo = JSON.stringify({ formato: 'alrimo', versaoDoArquivo: 2, versaoDaConta: VERSAO, titulo: 'Velho', alteracoes: { H_muro: 2.2 }, extras: {} });
    const a = abrir(antigo);
    const b = abrir(antigo);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.ganhouId).toBe(true);
    expect(a.projeto.id).toMatch(UUID_V4);
    // enquanto não for salvo, cada abertura sorteia outra — por isso o "não salvo"
    expect(b.projeto.id).not.toBe(a.projeto.id);
    expect(a.projeto.alteracoes).toEqual({ H_muro: 2.2 });
    // a notícia da abertura não muda: ganhar identidade não é entrada ignorada
    expect(recadoDeAbertura('Velho.alrimo', a)).toBe('Velho.alrimo aberto');
  });

  it('identidade fora do formato (escrita à mão, estragada) é trocada por uma nova', () => {
    for (const id of ['', 'muro 1', 42, null, 'Sem título', `${muro.id}x`]) {
      const a = abrir(JSON.stringify({ ...JSON.parse(serializarProjeto(muro, VERSAO)), id }));
      expect(a.ok && a.ganhouId, String(id)).toBe(true);
      expect(a.ok && a.projeto.id, String(id)).toMatch(UUID_V4);
    }
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
