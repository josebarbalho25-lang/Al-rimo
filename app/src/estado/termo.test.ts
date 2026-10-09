// O aceite do Termo de Uso sem tela. Cada teste "abre o app" de novo (módulos
// novos) com um localStorage de mentira, que sobrevive à recarga como o de
// verdade — ou com um que recusa tudo, como o da janela anônima bloqueada.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function armazenamento(m: Map<string, string>) {
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

/** O navegador que não deixa gravar nem ler (modo restrito, cota estourada). */
const bloqueado = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

async function abrirApp(armazem: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazem });
  vi.resetModules();
  const termo = await import('./termo');
  const { CHAVES } = await import('./lembrete');
  return { ...termo, CHAVES };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

const ARQUIVO = readFileSync(fileURLToPath(new URL('../../../TERMO_DE_USO.md', import.meta.url)), 'utf8');

describe('o texto e a versão do termo', () => {
  it('mostra o termo até antes de "Fontes consultadas", sem as notas internas', async () => {
    const t = await abrirApp(armazenamento(new Map()));
    expect(t.TEXTO_DO_TERMO.startsWith('# TERMO DE USO')).toBe(true);
    expect(t.TEXTO_DO_TERMO).toContain('DECLARAÇÃO DE ACEITE');
    expect(t.TEXTO_DO_TERMO).not.toContain('Fontes consultadas');
    expect(t.TEXTO_DO_TERMO).not.toContain('NOTAS PARA A PRÓXIMA SESSÃO');
    // termina no texto, não nas réguas "---" que separavam as Fontes
    expect(t.TEXTO_DO_TERMO.trimEnd().endsWith('---')).toBe(false);
  });

  it('a versão é o número declarado no termo mais a digital do texto', async () => {
    const t = await abrirApp(armazenamento(new Map()));
    expect(t.NUMERO_DO_TERMO).toMatch(/^\d+(\.\d+)*$/);
    expect(t.VERSAO_DO_TERMO).toMatch(/^\d+(\.\d+)*\+[0-9a-f]{8}$/);
    expect(t.rotuloDaVersao('1.0+3fa2c19b')).toBe('1.0 (3fa2c19b)');
  });

  it('o mesmo arquivo salvo no Windows (CRLF) dá a mesma versão', async () => {
    const t = await abrirApp(armazenamento(new Map()));
    const lf = t.textoDoTermo(ARQUIVO.replace(/\r\n/g, '\n'));
    const crlf = t.textoDoTermo('﻿' + ARQUIVO.replace(/\r?\n/g, '\r\n'));
    expect(t.impressaoDigital(crlf)).toBe(t.impressaoDigital(lf));
  });

  it('qualquer mudança no texto do termo muda a versão; nas Fontes, não', async () => {
    const t = await abrirApp(armazenamento(new Map()));
    const base = t.impressaoDigital(t.textoDoTermo(ARQUIVO));
    const titulo = ARQUIVO.replace('### Leia antes de usar', '### Leia antes de usar!');
    expect(titulo).not.toBe(ARQUIVO);
    expect(t.impressaoDigital(t.textoDoTermo(titulo))).not.toBe(base);
    const virgula = ARQUIVO.replace('Aplica-se a lei brasileira.', 'Aplica-se, a lei brasileira.');
    expect(virgula).not.toBe(ARQUIVO);
    expect(t.impressaoDigital(t.textoDoTermo(virgula))).not.toBe(base);
    const fontes = ARQUIVO.replace('Pesquisa feita em', 'Pesquisa refeita em');
    expect(fontes).not.toBe(ARQUIVO);
    expect(t.impressaoDigital(t.textoDoTermo(fontes))).toBe(base);
  });
});

describe('o aceite', () => {
  it('primeira abertura: não há aceite, a tela pede', async () => {
    const t = await abrirApp(armazenamento(new Map()));
    expect(t.aceiteGuardado()).toBeNull();
    expect(t.aceiteVigente()).toBeNull();
  });

  it('"Li e aceito" grava data, hora e versão; a próxima abertura já entra', async () => {
    const m = new Map<string, string>();
    const t1 = await abrirApp(armazenamento(m));
    const quando = new Date(2026, 9, 9, 14, 32, 10);
    const a = t1.aceitarTermo(quando);
    expect(a).toEqual({ versao: t1.VERSAO_DO_TERMO, em: quando.toISOString() });
    expect(JSON.parse(m.get(t1.CHAVES.termo)!)).toEqual(a);

    const t2 = await abrirApp(armazenamento(m)); // F5
    expect(t2.aceiteVigente()).toEqual(a);
    expect(t2.dataDoAceite(t2.aceiteVigente()!)).toBe('09/10/2026 14:32');
  });

  it('termo novo (outra versão) pede o aceite de novo', async () => {
    const m = new Map<string, string>();
    const t = await abrirApp(armazenamento(m));
    m.set(t.CHAVES.termo, JSON.stringify({ versao: '0.9+00000000', em: '2026-10-01T12:00:00.000Z' }));
    const t2 = await abrirApp(armazenamento(m));
    expect(t2.aceiteGuardado()?.versao).toBe('0.9+00000000'); // o registro antigo continua lá...
    expect(t2.aceiteVigente()).toBeNull(); // ...mas não libera o termo de agora
    // e a mesma régua vale para qualquer versão pedida
    t2.aceitarTermo();
    expect(t2.aceiteVigente()).not.toBeNull();
    expect(t2.aceiteVigente('2.0+ffffffff')).toBeNull();
  });

  it('registro estragado no navegador vale como "nunca aceitou", sem quebrar', async () => {
    const m = new Map<string, string>();
    const t = await abrirApp(armazenamento(m));
    for (const lixo of ['null', '"sim"', '{"versao":1}', `{"versao":"${t.VERSAO_DO_TERMO}","em":"ontem"}`, '{não é json']) {
      m.set(t.CHAVES.termo, lixo);
      const t2 = await abrirApp(armazenamento(m));
      expect(t2.aceiteVigente()).toBeNull();
    }
  });

  it('localStorage indisponível: não trava, libera a sessão e pede de novo na próxima abertura', async () => {
    const t = await abrirApp(bloqueado);
    expect(t.aceiteVigente()).toBeNull();
    expect(() => t.aceitarTermo()).not.toThrow();
    expect(t.aceiteVigente()).not.toBeNull(); // esta sessão segue (e o memorial tem a data)

    const t2 = await abrirApp(bloqueado); // abriu de novo
    expect(t2.aceiteVigente()).toBeNull();
  });

  it('sem localStorage nenhum (ambiente sem a API) também não trava', async () => {
    const t = await abrirApp(undefined);
    expect(t.aceiteVigente()).toBeNull();
    expect(() => t.aceitarTermo()).not.toThrow();
  });
});
