// Exporta a geometria das peças (famílias 14x39 e 19x39) do catálogo do APP para figs/app/pecas/catalogo.json.
//
//   node catalogo.mjs          (o gerar.py desta pasta chama sozinho antes de desenhar)
//
// Por que ler o catalogo.ts e não redigitar as medidas aqui: o 3D, o IFC e o quantitativo desenham a peça pelo
// catálogo (furos medidos no Revit do Jose, raio dos cantos tirado do volume da família). Se a figura tivesse a
// sua própria tabela, seriam duas réguas — e na primeira vez que o Jose remodelasse uma peça, a figura do
// quantitativo mostraria um bloco que o 3D não tem.
//
// O Node 24 roda TypeScript direto (só apaga os tipos); faltam só dois detalhes do Vite, resolvidos no gancho
// abaixo: o atalho '@/' (= app/src) e o import sem extensão ('./perfis' → perfis.ts).
import { registerHooks } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, '..', '..', '..', 'app', 'src');

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) spec = pathToFileURL(path.join(SRC, spec.slice(2))).href;
    try {
      return next(spec, ctx);
    } catch (e) {
      const base = spec.startsWith('file:')
        ? fileURLToPath(spec)
        : ctx.parentURL && spec.startsWith('.') ? path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec) : null;
      if (base) for (const ext of ['.ts', '.tsx']) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
      throw e;
    }
  },
});

const cat = await import(pathToFileURL(path.join(SRC, 'modulacao', 'catalogo.ts')).href);
const { CATALOGO, CORES_DO_JOSE, H_BLOCO, furosDaPeca, raioDoFundoDaCanaleta, secaoDaPecaCanaleta } = cat;

// As cores por classe vêm junto: são as do Revit do Jose (código de obra), as mesmas do 3D e da paginação.
const saida = {
  fonte: 'app/src/modulacao/catalogo.ts (gerado por figs/app/pecas/catalogo.mjs — não editar)', unidade: 'mm',
  cores: CORES_DO_JOSE, familias: {},
};
for (const nome of ['14x39', '19x39']) {
  const f = CATALOGO[nome];
  saida.familias[nome] = {
    t: f.t, L: f.L, Lm: f.Lm, h: H_BLOCO,
    canaleta: { parede: f.canaleta.parede, fundo: f.canaleta.fundo, r: raioDoFundoDaCanaleta(f) },
    // a cortada pode ser peça própria, com outro fundo (19x39: 3,91) — a figura dela usa esta seção
    canaleta_cortada: (() => {
      const c = secaoDaPecaCanaleta(f, { tipo: 'CANALETA_CORTADA' });
      return { parede: c.parede, fundo: c.fundo, r: raioDoFundoDaCanaleta(f, c) };
    })(),
    pecas: f.pecas.map((pc) => ({
      chave: pc.chave, classe: pc.classe, tipo: pc.tipo, forma: pc.forma, comprimento: pc.comprimento, nome: pc.nome,
      furos: furosDaPeca(f, pc),
    })),
  };
}
const destino = path.join(AQUI, 'catalogo.json');
writeFileSync(destino, JSON.stringify(saida, null, 1) + '\n', 'utf8');
console.log('catalogo.json  ' + Object.keys(saida.familias).join(', '));
