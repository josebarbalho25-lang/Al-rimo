/*
  A GRÁFICA NO MOLDE DO A-PORT (etapa 3 da moldura): o navegador lista as vistas e as folhas, abrir traz para a frente
  sem repetir aba, fechar traz a vizinha, excluir vista fecha a aba dela, e o desenho sozinho (sem a Gráfica em volta)
  continua com os botões na barra dele.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { useApp } from '@/estado/store';
import { useEncaixes, useGrafica } from '@/estado/grafica';
import { SEM_PRANCHAS } from '@/pranchas/padrao';
import { usePranchasUi } from '@/pranchas/ui';
import { Desenhos } from '@/desenhos/Desenhos';
import { modeloDeExemplo } from '@/desenhos/__testes__/modeloDeExemplo';
import { pastasDoNavegador } from './Navegador';
import { confirmarNome, criarFolha, criarVista, duplicar, excluir, excluirFolha, fechar, frente, trazer } from './comandos';

const limpar = () => {
  useApp.setState({ pranchas: SEM_PRANCHAS, aba: '3d' });
  usePranchasUi.setState({ ativa: null, vistaAtiva: {} });
  useGrafica.setState({ abertas: [], nadaAberto: false, renomeando: null });
};

describe('Gráfica: navegador, abas abertas e comandos', () => {
  beforeEach(limpar);
  afterEach(() => {
    limpar();
    vi.unstubAllGlobals();
  });

  it('o navegador tem as pastas na ordem do protótipo, com as vistas de fábrica e as folhas', () => {
    const pastas = pastasDoNavegador(SEM_PRANCHAS);
    expect(pastas.map((p) => p.nome)).toEqual(['3D', 'Elevações', 'Cortes', 'Plantas', 'Isométricos', 'Armação', 'Pranchas']);
    expect(pastas[2].itens.map((i) => [i.nome, i.extra])).toEqual([['Corte', '1:25']]);
    expect(pastas[6].itens).toEqual([]);
  });

  it('abrir traz para a frente; abrir de novo não repete a aba', () => {
    trazer({ aba: 'corte', id: 'corte' });
    trazer({ aba: 'frontal', id: 'vista-frontal' });
    trazer({ aba: 'corte', id: 'corte' });
    expect(useGrafica.getState().abertas.map((a) => a.aba)).toEqual(['corte', 'frontal']);
    expect(frente()).toEqual({ aba: 'corte', id: 'corte' });
  });

  it('duplicar abre a cópia; fechar a da frente traz a vizinha; fechar tudo deixa o palco vazio', () => {
    trazer({ aba: 'corte', id: 'corte' });
    duplicar('corte');
    const copia = useApp.getState().pranchas.vistas.find((v) => v.nome === 'Corte (2)')!;
    expect(frente()).toEqual({ aba: 'corte', id: copia.id });
    fechar({ aba: 'corte', id: copia.id });
    expect(frente()).toEqual({ aba: 'corte', id: 'corte' });
    fechar({ aba: 'corte', id: 'corte' });
    expect(frente()).toBeNull();
    trazer({ aba: 'planta', id: 'planta' });
    expect(frente()).toEqual({ aba: 'planta', id: 'planta' });
  });

  it('excluir a vista fecha a aba dela e a aba do tipo volta para outra vista', () => {
    vi.stubGlobal('window', { confirm: () => true });
    criarVista('planta');
    const nova = frente()!;
    expect(nova.id).not.toBe('planta');
    excluir(nova.id!);
    expect(useGrafica.getState().abertas.some((a) => a.id === nova.id)).toBe(false);
    expect(useApp.getState().pranchas.vistas.some((v) => v.id === nova.id)).toBe(false);
  });

  it('nome reescrito: a vista ganha o nome; a folha ganha o conteúdo', () => {
    confirmarNome('corte', 'Corte A');
    expect(useApp.getState().pranchas.vistas.find((v) => v.id === 'corte')?.nome).toBe('Corte A');
    criarFolha();
    const f = useApp.getState().pranchas.folhas[0];
    expect(frente()).toEqual({ aba: 'pranchas', id: f.id });
    confirmarNome(f.id, 'Contrafortes');
    expect(pastasDoNavegador(useApp.getState().pranchas)[6].itens[0].nome).toBe('01 · Contrafortes');
    excluirFolha(f.id);
    expect(useApp.getState().pranchas.folhas).toEqual([]);
    expect(useGrafica.getState().abertas.some((a) => a.id === f.id)).toBe(false);
  });

  it('o desenho sozinho (sem a Gráfica em volta) segue com a lista das vistas e os botões na barra', () => {
    expect(useEncaixes.getState().lugar.anotacao).toBeUndefined();
    const html = renderToString(<Desenhos modelo={modeloDeExemplo({ tipo: 'contrafortes' })} vista="corte" />);
    expect(html).toContain('aria-label="Vista"');
    expect(html).toMatch(/<button[^>]*>Cota<\/button>/);
    expect(html).not.toContain('faixa-botao');
  });
});
