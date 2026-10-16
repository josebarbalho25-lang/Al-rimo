/*
  AS VISTAS DO PROJETO (Jose, 16/10: "como no Revit") — o que quebraria:
  - abrir uma aba gravar a vista de fábrica (o • de alterado acenderia sem ninguém mexer);
  - a cota feita na folha ir para o item e não para a VISTA (a aba não mostraria; tirar da folha perderia a cota);
  - tirar da folha apagar a vista (não teria como "voltar e mexer de novo");
  - duplicar sem as anotações, ou com o mesmo nome; o nome "(2) (2)";
  - o arquivo de antes de 16/10 perder os desenhos (cada um vira vista) ou guardar o espelho no arquivo.
*/
import { describe, expect, it } from 'vitest';
import { novaFolha, lerPranchas, temPranchas, SEM_PRANCHAS } from '../padrao';
import { naAnotacao, noItem, porVistaNaFolha } from '../acoes';
import {
  acharVista, duplicarVista, excluirVista, itemComVista, naVistaDoProjeto, nomeLivre, novaVista, novaVista3d, ondeEstaAVista,
  pranchasComVistas, pranchasParaArquivo, renomearVista, vistaDeFabrica, vistasDoTipo,
} from '../vistas';
import type { Camera3d, PranchasDoProjeto, VistaDoProjeto } from '../tipos';

const vazio: PranchasDoProjeto = { ...SEM_PRANCHAS, folhas: [novaFolha('A')] };

describe('a lista das vistas', () => {
  it('sem vista guardada, cada tipo 2D tem a de fábrica — virtual: nada entra no arquivo', () => {
    expect(vistasDoTipo(vazio, 'corte').map((v) => [v.id, v.nome, v.escala])).toEqual([['corte', 'Corte', 25]]);
    expect(vistasDoTipo(vazio, 'iso')[0].escala).toBeNull();
    expect(vistasDoTipo(vazio, '3d')).toEqual([]);
    expect(temPranchas({ ...SEM_PRANCHAS })).toBe(false);
  });

  it('a primeira mexida grava a de fábrica com o id dela; a lista passa a ser a guardada', () => {
    const p = naVistaDoProjeto(vazio, 'corte', (v) => ({ ...v, conteudo: { tipo: 'corte', x: 1350 } }));
    expect(p.vistas.map((v) => [v.id, v.conteudo])).toEqual([['corte', { tipo: 'corte', x: 1350 }]]);
    expect(vistasDoTipo(p, 'corte')).toHaveLength(1);
    expect(temPranchas({ ...SEM_PRANCHAS, vistas: p.vistas })).toBe(true);
  });

  it('nome livre: "Corte", "Corte (2)"; duplicar a cópia dá "(3)", não "(2) (2)"', () => {
    const v = (nome: string): VistaDoProjeto => ({ ...vistaDeFabrica('corte'), id: nome, nome });
    expect(nomeLivre([], 'Corte')).toBe('Corte');
    expect(nomeLivre([v('Corte')], 'Corte')).toBe('Corte (2)');
    expect(nomeLivre([v('Corte'), v('Corte (2)')], 'Corte (2)')).toBe('Corte (3)');
  });

  it('duplicar copia tudo, as anotações também, com id e nome novos; a nova parte da pré-definida', () => {
    const comCota = naVistaDoProjeto(vazio, 'vista-frontal', (v) => naAnotacao(v, 'cota:600#0', () => ({ texto: 'L = 6 m' })));
    const d = duplicarVista(comCota, 'vista-frontal')!;
    expect(d.vista.nome).toBe('Vista frontal (2)');
    expect(d.vista.id).not.toBe('vista-frontal');
    expect(d.vista.anotacoes).toEqual({ 'cota:600#0': { texto: 'L = 6 m' } });
    const n = novaVista(d.pranchas, 'frontal');
    expect(n.vista.nome).toBe('Vista frontal (3)');
    expect(n.vista.anotacoes).toBeUndefined();
    expect(vistasDoTipo(n.pranchas, 'frontal')).toHaveLength(3);
  });

  it('a nova de um tipo sem vista guardada leva a de fábrica junto para a lista (ela não some)', () => {
    const n = novaVista(vazio, 'planta');
    expect(vistasDoTipo(n.pranchas, 'planta').map((v) => v.nome)).toEqual(['Planta', 'Planta (2)']);
  });

  it('renomear (vazio não vale) e excluir (sai das folhas junto; a de fábrica volta virtual)', () => {
    const r = porVistaNaFolha(vazio, null, vistaDeFabrica('corte'));
    const p = renomearVista(r.pranchas, 'corte', 'Corte A');
    expect(acharVista(p, 'corte')!.nome).toBe('Corte A');
    expect(renomearVista(p, 'corte', '  ')).toBe(p);
    const sem = excluirVista(p, 'corte');
    expect(sem.vistas).toHaveLength(0);
    expect(sem.folhas[0].itens).toHaveLength(0);
    expect(vistasDoTipo(sem, 'corte')[0].nome).toBe('Corte');
  });
});

describe('a vista na folha', () => {
  const r = porVistaNaFolha(vazio, null, vistaDeFabrica('corte'));
  const item = r.item;

  it('o desenho aponta para a vista, com o primeiro número livre; a vista sabe onde está', () => {
    expect(item.vista).toBe('corte');
    expect(item.numero).toBe('1');
    expect(ondeEstaAVista(r.pranchas, 'corte')).toMatchObject({ numero: 1 });
  });

  it('a cota mexida na folha vai para a VISTA; arrastar o desenho mexe só no item', () => {
    const fid = r.folha;
    const comCota = noItem(r.pranchas, fid, item.id, (i) => naAnotacao(i, 'cota:B = 140#0', () => ({ afastamento: 12 })));
    expect(acharVista(comCota, 'corte')!.anotacoes).toEqual({ 'cota:B = 140#0': { afastamento: 12 } });
    expect(comCota.folhas[0].itens[0].anotacoes).toBeUndefined();
    const movido = noItem(comCota, fid, item.id, (i) => ({ ...i, x: 200, escala: 50 }));
    expect(movido.folhas[0].itens[0].x).toBe(200);
    expect(acharVista(movido, 'corte')!.escala).toBe(50);
    // a folha vê a vista: a cota e a escala nova
    const visto = pranchasComVistas(movido).folhas[0].itens[0];
    expect(visto.anotacoes).toEqual({ 'cota:B = 140#0': { afastamento: 12 } });
    expect(visto.escala).toBe(50);
  });

  it('tirar da folha não apaga a vista (volta pela lista com as anotações)', () => {
    const comCota = noItem(r.pranchas, r.folha, item.id, (i) => naAnotacao(i, 'cota:B = 140#0', () => ({ oculta: true })));
    const tirado = { ...comCota, folhas: comCota.folhas.map((f) => ({ ...f, itens: [] })) };
    expect(acharVista(tirado, 'corte')!.anotacoes).toEqual({ 'cota:B = 140#0': { oculta: true } });
    expect(ondeEstaAVista(tirado, 'corte')).toBeNull();
  });

  it('o 3D enviado vira a vista "3D", sem escala, com o tamanho de partida na proporção da foto', () => {
    const camera = { posicao: [1, 2, 3], alvo: [0, 0, 0], cima: [0, 0, 1], ortografica: true, zoom: 1, fov: 30, estilo: 'opaco', armadura: false, corteX: null, ocultas: [] } as Camera3d;
    const n = novaVista3d(vazio, { tipo: '3d', camera, proporcao: 2 });
    const q = porVistaNaFolha(n.pranchas, null, n.vista);
    expect(n.vista.nome).toBe('3D');
    expect(q.item.escala).toBeNull();
    expect(q.item.largura! / q.item.altura!).toBeCloseTo(2, 6);
  });
});

describe('o arquivo', () => {
  it('o desenho de antes de 16/10 vira uma vista (o título vira o nome; as anotações vão junto)', () => {
    const p = lerPranchas({
      folhas: [{
        formato: 'A1',
        itens: [
          { id: 'a', conteudo: { tipo: 'corte', x: 900 }, escala: 25, x: 10, y: 10, titulo: 'Corte A', anotacoes: { 'cota:B = 140#0': { oculta: true } } },
          { id: 'b', conteudo: { tipo: 'corte' }, escala: 50, x: 100, y: 10, titulo: '' },
          { id: 't', conteudo: { tipo: 'tabela', id: 'blocos' }, escala: null, x: 300, y: 10, titulo: '' },
        ],
      }],
    });
    expect(p.vistas.map((v) => [v.nome, v.escala, v.titulo])).toEqual([['Corte A', 25, 'Corte A'], ['Corte', 50, '']]);
    expect(p.vistas[0].anotacoes).toEqual({ 'cota:B = 140#0': { oculta: true } });
    const [a, b, t] = p.folhas[0].itens;
    expect([a.vista, b.vista, t.vista]).toEqual([p.vistas[0].id, p.vistas[1].id, undefined]);
    expect(a.anotacoes).toBeUndefined();
    // a folha vê a vista com a cota
    expect(itemComVista(a, p.vistas).anotacoes).toEqual({ 'cota:B = 140#0': { oculta: true } });
  });

  it('vai e volta: no arquivo o desenho de vista guarda a vista, o lugar, o número e o espelho (conteúdo, escala, título) — sem as anotações', () => {
    const r = porVistaNaFolha(vazio, null, vistaDeFabrica('planta'));
    const p = noItem(r.pranchas, r.folha, r.item.id, (i) => naAnotacao(i, 'texto:aterro', () => ({ dx: 3, dy: 4 })));
    const arquivo = JSON.parse(JSON.stringify(pranchasParaArquivo(p)));
    expect(Object.keys(arquivo.folhas[0].itens[0]).sort()).toEqual(['conteudo', 'escala', 'id', 'numero', 'titulo', 'vista', 'x', 'y']);
    const de = lerPranchas(arquivo);
    expect(de.vistas).toEqual(p.vistas);
    expect(pranchasComVistas(de).folhas[0].itens[0]).toEqual(pranchasComVistas(p).folhas[0].itens[0]);
  });

  it('desenho que aponta para uma vista que não veio sai da folha (e entra no recado)', () => {
    const perdidos: string[] = [];
    const p = lerPranchas({ folhas: [{ formato: 'A1', itens: [{ id: 'x', vista: 'nao-existe', x: 1, y: 1 }] }] }, perdidos);
    expect(p.folhas[0].itens).toHaveLength(0);
    expect(perdidos).toHaveLength(1);
  });
});

describe('o título na folha', () => {
  it('a vista com nome dado ("Corte A") tem o nome de título; a de fábrica e a cópia, o título que diz o que mostram', async () => {
    const { nomeDado } = await import('../vistas');
    expect(nomeDado('Corte', 'corte')).toBe(false);
    expect(nomeDado('Corte (2)', 'corte')).toBe(false);
    expect(nomeDado('Corte A', 'corte')).toBe(true);
    expect(nomeDado('3D (3)', '3d')).toBe(false);
    expect(nomeDado('Frontal – graute', 'frontal')).toBe(true);
    const r = porVistaNaFolha(vazio, null, vistaDeFabrica('corte'));
    const p = renomearVista(r.pranchas, 'corte', 'Corte A');
    expect(pranchasComVistas(p).folhas[0].itens[0].nomeDaVista).toBe('Corte A');
    // o nome não vai para o arquivo (é da vista)
    expect(JSON.stringify(pranchasParaArquivo(pranchasComVistas(p)).folhas)).not.toContain('nomeDaVista');
  });
});
