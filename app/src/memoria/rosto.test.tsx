// O rosto do memorial carrega as três versões que o Termo de Uso manda guardar
// (itens 2.3 e 12.1): a do app, a da conta e a do termo aceito, com a data.
// O Word é tradução desta mesma árvore (word.ts), então vale para os dois.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { calcular } from '@/motor';
import type { Resultado } from '@/motor/tipos';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import pacote from '../../package.json';

function armazenamento(m: Map<string, string>) {
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  };
}

async function abrir() {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(new Map()) });
  vi.resetModules();
  const { MemorialImpresso } = await import('./MemorialImpresso');
  const termo = await import('@/estado/termo');
  const { VERSAO_DA_CONTA } = await import('./metaDaPlanilha');
  const aula = resultadoDoGabarito('aula122');
  const rosto = (r: Resultado = aula) => {
    const html = renderToStaticMarkup(<MemorialImpresso resultado={r} info={{ projeto: 'Muro de teste' }} />);
    return html.slice(0, html.indexOf('mp-indice')); // só o rosto
  };
  return { rosto, termo, VERSAO_DA_CONTA };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

describe('rosto do memorial', () => {
  it('versão do app (a do package.json), da conta e do termo aceito, com a data do aceite', async () => {
    const { rosto, termo, VERSAO_DA_CONTA } = await abrir();
    termo.aceitarTermo(new Date(2026, 9, 9, 14, 32));
    const html = rosto();
    expect(html).toContain('Versão do aplicativo');
    expect(html).toContain(`Al-rimo ${pacote.version}`);
    expect(html).toContain(VERSAO_DA_CONTA);
    expect(html).toContain(`versão ${termo.rotuloDaVersao(termo.VERSAO_DO_TERMO)}, aceito em 09/10/2026 14:32`);
  });

  it('sem aceite registrado sai a versão do termo e nenhuma data inventada', async () => {
    const { rosto, termo } = await abrir();
    const html = rosto();
    expect(html).toContain(`versão ${termo.rotuloDaVersao(termo.VERSAO_DO_TERMO)}`);
    expect(html).not.toContain('aceito em');
  });

  // c' > 0 (Jose, 08/10): o papel assinado diz que a coesão entrou na conta, com o texto da célula aviso_coesao.
  it("aviso da coesão: uma linha com o texto da planilha só quando c' > 0", async () => {
    const { rosto } = await abrir();
    expect(rosto()).not.toContain('mp-aviso-coesao');
    const r = calcular({ c_solo: 10 });
    const texto = r.v('aviso_coesao');
    expect(typeof texto).toBe('string');
    const html = rosto(r);
    expect(html).toContain('mp-aviso-coesao');
    // o React escapa o apóstrofo e o ">" do texto ("c' > 0…")
    expect(html).toContain(String(texto).replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;'));
    // junto do aviso do solo, logo depois dele
    expect(html.indexOf('mp-aviso-solo')).toBeLessThan(html.indexOf('mp-aviso-coesao'));
  });
});
