/*
  Confere o mapa entrada → figura contra as entradas reais e contra os SVG gerados.
  Se figs/app/gerar.py mudar um desenho e sumir com um data-campo, ou se uma entrada nova aparecer sem
  figura nem motivo, o teste avisa — mapa que diverge em silêncio é o defeito que este JSON veio resolver.
*/
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import planilha from '@/motor/planilha.gerada.json';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { figuraDaEntrada, figuras, motivoSemFigura, _mapa } from './mapa';

const PASTA = fileURLToPath(new URL('../../public/figuras/', import.meta.url));
const svgDe = (arquivo: string) => readFileSync(PASTA + arquivo, 'utf8');

const nomesPlanilha = (planilha as { entradas: { nome: string }[] }).entradas.map((e) => e.nome);
const nomesModelo = ENTRADAS_DO_MODELO.map((e) => e.nome);
const todas = [...nomesPlanilha, ...nomesModelo];

function camposDoSvg(txt: string): Set<string> {
  const s = new Set<string>();
  for (const m of txt.matchAll(/data-campo="([^"]*)"/g)) for (const n of m[1].split(/\s+/)) if (n) s.add(n);
  return s;
}

function textosDoSvg(txt: string): string[] {
  return [...txt.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
}

describe('mapa entrada → figura (dados/figuras.json)', () => {
  it('toda entrada tem figura OU motivo para não ter — nunca as duas, nunca nenhuma', () => {
    const faltando = todas.filter((n) => !(n in _mapa.entradas) && !(n in _mapa.semFigura));
    const duplas = todas.filter((n) => n in _mapa.entradas && n in _mapa.semFigura);
    expect(faltando).toEqual([]);
    expect(duplas).toEqual([]);
  });

  it('o mapa não cita entrada que não existe', () => {
    const conhecidas = new Set(todas);
    const estranhas = [...Object.keys(_mapa.entradas), ...Object.keys(_mapa.semFigura)].filter((n) => !conhecidas.has(n));
    expect(estranhas).toEqual([]);
  });

  it('cada figura citada existe no catálogo e o arquivo existe em public/figuras', () => {
    const ids = new Set(figuras().map((f) => f.id));
    for (const [nome, lig] of Object.entries(_mapa.entradas)) {
      expect(ids.has(lig.figura), `${nome} → ${lig.figura}`).toBe(true);
    }
    for (const f of figuras()) expect(existsSync(PASTA + f.arquivo), f.arquivo).toBe(true);
  });

  it('o campo de cada entrada está desenhado (data-campo) na figura dela', () => {
    const faltam: string[] = [];
    for (const [nome, lig] of Object.entries(_mapa.entradas)) {
      if (!lig.campo) continue;
      const f = figuras().find((x) => x.id === lig.figura)!;
      if (!camposDoSvg(svgDe(f.arquivo)).has(lig.campo)) faltam.push(`${nome} em ${f.arquivo}`);
    }
    expect(faltam).toEqual([]);
  });

  it('todo data-campo dos SVG é nome de entrada de verdade (sem erro de digitação)', () => {
    const conhecidas = new Set(todas);
    const estranhos: string[] = [];
    for (const f of figuras()) for (const c of camposDoSvg(svgDe(f.arquivo))) if (!conhecidas.has(c)) estranhos.push(`${f.arquivo}: ${c}`);
    expect(estranhos).toEqual([]);
  });

  it('as entradas do modelo apontam para a mesma figura que o contrato (EntradaMeta.figura)', () => {
    for (const e of ENTRADAS_DO_MODELO) {
      const f = figuraDaEntrada(e.nome);
      expect(f?.titulo.split(' — ')[0], e.nome).toBe(e.figura ?? undefined);
    }
  });

  it('título do modal sem travessão sobrando ("Fig. N — título" tem um só)', () => {
    for (const f of figuras()) expect(f.titulo, f.id).not.toMatch(/—/);
  });

  it('figuraDaEntrada devolve título do modal e URL pública', () => {
    expect(figuraDaEntrada('H_muro')).toEqual({ id: 'fig01', titulo: 'Fig. 1 — Corte do muro', url: '/figuras/fig01.svg' });
    expect(figuraDaEntrada('H_solo')?.id).toBe('fig01');
    expect(figuraDaEntrada('NSPT')?.id).toBe('fig22');
    expect(figuraDaEntrada('L_total')?.url).toBe('/figuras/fig16.svg');
    expect(figuraDaEntrada('gama_f')).toBeNull();
    expect(figuraDaEntrada('nao_existe')).toBeNull();
    expect(figuraDaEntrada('toString')).toBeNull();
    expect(motivoSemFigura('gama_m')).toMatch(/Jose/);
  });
});

describe('SVG das figuras do app (app/public/figuras)', () => {
  const arquivos = readdirSync(PASTA).filter((a) => a.endsWith('.svg')).sort();

  it('há um SVG por figura do catálogo, e nenhum sobrando', () => {
    expect(arquivos).toEqual(figuras().map((f) => f.arquivo).sort());
  });

  it('ids com o prefixo da figura e sem repetição entre figuras (dois SVG inline no mesmo documento)', () => {
    const vistos = new Map<string, string>();
    for (const a of arquivos) {
      const txt = svgDe(a);
      const id = a.replace('.svg', '');
      expect(txt).toContain(`data-figura="${id}"`);
      for (const m of txt.matchAll(/\bid="([^"]+)"/g)) {
        expect(m[1].startsWith(`${id}-`), `${a}: ${m[1]}`).toBe(true);
        expect(vistos.has(m[1]), `${m[1]} em ${a} e ${vistos.get(m[1])}`).toBe(false);
        vistos.set(m[1], a);
      }
      for (const m of txt.matchAll(/url\(#([^)]+)\)/g)) expect(m[1].startsWith(`${id}-`), `${a}: url(#${m[1]})`).toBe(true);
    }
  });

  it('sem <script>, sem <style>, sem imagem externa (vai para a tela, a impressão e o Word)', () => {
    for (const a of arquivos) {
      const txt = svgDe(a);
      expect(txt, a).not.toMatch(/<script|<style|<image|<foreignObject|href=/i);
    }
  });

  it('sem texto da planilha, da aula ou de software de terceiros, e sem bloco cerâmico', () => {
    const proibido = /\b(planilha|aba|aula|curso|Gilberto|Ftool|SAP|TQS|célula|cerâmico|Fig\.|Entradas)\b/i;
    const achados: string[] = [];
    for (const a of arquivos) for (const t of textosDoSvg(svgDe(a))) if (proibido.test(t)) achados.push(`${a}: ${t}`);
    expect(achados).toEqual([]);
  });

  it('sem prosa: nenhum texto passa de 6 palavras (painel = rótulo + valor)', () => {
    const longos: string[] = [];
    for (const a of arquivos) {
      if (a === 'fig22.svg' || a === 'fig23.svg') continue;      // tabelas: célula de tabela pode ser longa
      for (const t of textosDoSvg(svgDe(a))) if (t.trim().split(/\s+/).length > 6 && !/[=≤]/.test(t)) longos.push(`${a}: ${t}`);
    }
    expect(longos).toEqual([]);
  });
});
