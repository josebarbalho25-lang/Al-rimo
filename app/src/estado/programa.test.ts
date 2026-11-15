// O disco no programa instalado: a ponte do Electron (instalador/preload.js) entra em estado/arquivo.ts com a mesma
// cara da janela de arquivo do navegador. O que isto segura: o Ctrl+S de um muro aberto pelo Abrir ou pelo duplo
// clique grava POR CIMA do mesmo arquivo (sem perguntar), o "Salvar como" pergunta, e desistir no diálogo do
// Windows é desistência (não erro) — como no navegador.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirDoDisco, alcaDoCaminho, foiCancelado, salvarNoDisco } from './arquivo';
import type { PonteDoPrograma } from './programa';

function ponteDeMentira(disco: Map<string, string>, escolhas: { abrir?: string | null; destino?: string | null }) {
  const ponte: PonteDoPrograma = {
    abrirProjeto: vi.fn(async () => {
      const c = escolhas.abrir;
      return c ? { caminho: c, nome: c.split(/[\\/]/).pop()!, texto: disco.get(c)! } : null;
    }),
    escolherDestino: vi.fn(async () => {
      const c = escolhas.destino;
      return c ? { caminho: c, nome: c.split(/[\\/]/).pop()! } : null;
    }),
    lerArquivo: vi.fn(async (c: string) => disco.get(c)!),
    gravarArquivo: vi.fn(async (c: string, t: string) => void disco.set(c, t)),
    gravarPdf: vi.fn(async () => null),
    aoAbrirArquivo: vi.fn(),
    pronto: vi.fn(),
    informarEstado: vi.fn(),
    aoPedirSalvarEFechar: vi.fn(),
    fechar: vi.fn(),
  };
  (globalThis as { alrimoPrograma?: PonteDoPrograma }).alrimoPrograma = ponte;
  return ponte;
}

afterEach(() => {
  delete (globalThis as { alrimoPrograma?: PonteDoPrograma }).alrimoPrograma;
});

describe('arquivo.ts no programa instalado', () => {
  it('Abrir lê pelo diálogo do Windows e o Ctrl+S seguinte grava no mesmo arquivo, sem perguntar', async () => {
    const disco = new Map([['C:\\obras\\Muro A.alrimo', '{"a":1}']]);
    const ponte = ponteDeMentira(disco, { abrir: 'C:\\obras\\Muro A.alrimo' });
    const lido = await abrirDoDisco();
    expect(lido?.texto).toBe('{"a":1}');
    expect(lido?.nome).toBe('Muro A.alrimo');
    const r = await salvarNoDisco((mesmo) => `{"mesmo":${mesmo}}`, 'Muro A.alrimo', lido!.alca, { alca: lido!.alca, nome: 'Muro A.alrimo' });
    expect(ponte.escolherDestino).not.toHaveBeenCalled();
    expect(disco.get('C:\\obras\\Muro A.alrimo')).toBe('{"mesmo":true}');
    expect(r.nome).toBe('Muro A.alrimo');
  });

  it('Salvar como para outro caminho é outro arquivo (o muro ganha identidade nova lá em cima)', async () => {
    const disco = new Map<string, string>();
    ponteDeMentira(disco, { destino: 'D:\\outra\\Muro B.alrimo' });
    const aberto = alcaDoCaminho('C:\\obras\\Muro A.alrimo', 'Muro A.alrimo');
    const r = await salvarNoDisco((mesmo) => `{"mesmo":${mesmo}}`, 'Muro A.alrimo', null, { alca: aberto, nome: 'Muro A.alrimo' });
    expect(disco.get('D:\\outra\\Muro B.alrimo')).toBe('{"mesmo":false}');
    expect(r.nome).toBe('Muro B.alrimo');
  });

  it('Salvar como por cima do próprio arquivo é o mesmo muro (caminho igual, letra e barra à parte)', async () => {
    const disco = new Map<string, string>();
    ponteDeMentira(disco, { destino: 'c:/OBRAS/muro a.alrimo' });
    const aberto = alcaDoCaminho('C:\\obras\\Muro A.alrimo', 'Muro A.alrimo');
    await salvarNoDisco((mesmo) => `{"mesmo":${mesmo}}`, 'Muro A.alrimo', null, { alca: aberto, nome: 'Muro A.alrimo' });
    expect(disco.get('c:/OBRAS/muro a.alrimo')).toBe('{"mesmo":true}');
  });

  it('desistir no diálogo do Windows é desistência, não erro', async () => {
    ponteDeMentira(new Map(), { abrir: null, destino: null });
    await expect(abrirDoDisco()).rejects.toSatisfy(foiCancelado);
    await expect(salvarNoDisco(() => '{}', 'x.alrimo', null, { alca: null, nome: null })).rejects.toSatisfy(foiCancelado);
  });

  it('sem a ponte (navegador) não há alça por caminho', () => {
    expect(alcaDoCaminho('C:\\x.alrimo', 'x.alrimo')).toBeNull();
  });
});
