/*
  O "Enviar para a prancha": o pedido do 3D (ou de uma vista) vira desenho na folha ativa; sem folha, nasce a 01; a
  barra de estado diz para onde foi e o muro fica marcado como alterado.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { useApp } from '@/estado/store';
import { SEM_PRANCHAS, novaFolha } from '../padrao';
import { enviarParaPrancha } from '../envio';
import { ligarEnvioParaPrancha } from '../receber';
import { usePranchasUi } from '../ui';
import type { Camera3d } from '../tipos';

const camera: Camera3d = { posicao: [5, -8, 4], alvo: [3, 0, 1], cima: [0, 0, 1], ortografica: true, zoom: 0.4, fov: 35, estilo: 'opaco', armadura: false, corteX: null, ocultas: [] };

describe('enviar para a prancha', () => {
  let desligar: (() => void) | null = null;
  afterEach(() => {
    desligar?.();
    useApp.setState({ pranchas: SEM_PRANCHAS });
    usePranchasUi.setState({ ativa: null });
  });

  it('sem folha: nasce a 01 com a perspectiva, sem escala, na proporção da foto', () => {
    useApp.setState({ pranchas: SEM_PRANCHAS, sujo: false });
    desligar = ligarEnvioParaPrancha();
    expect(enviarParaPrancha({ tipo: '3d', dataUrl: 'data:image/png;base64,', camera, proporcao: 2 })).toBe(1);
    const p = useApp.getState().pranchas;
    expect(p.folhas).toHaveLength(1);
    const [item] = p.folhas[0].itens;
    expect(item.conteudo).toEqual({ tipo: '3d', camera, proporcao: 2 });
    expect(item.escala).toBeNull();
    expect(item.largura! / item.altura!).toBeCloseTo(2, 6);
    expect(useApp.getState().sujo).toBe(true);
    expect(useApp.getState().recado).toBe('Enviado para a folha 01');
    expect(usePranchasUi.getState().ativa).toBe(p.folhas[0].id);
  });

  it('com folha ativa: o desenho cai nela, e uma vista 2D chega na escala de partida', () => {
    const a = novaFolha('A');
    const b = novaFolha('B');
    useApp.setState({ pranchas: { ...SEM_PRANCHAS, folhas: [a, b] } });
    usePranchasUi.setState({ ativa: a.id });
    desligar = ligarEnvioParaPrancha();
    enviarParaPrancha({ tipo: 'vista', pedido: { tipo: 'corte' } });
    const [fa, fb] = useApp.getState().pranchas.folhas;
    expect(fa.itens.map((i) => [i.conteudo.tipo, i.escala])).toEqual([['corte', 25]]);
    expect(fb.itens).toHaveLength(0);
  });

  it('a tabela do quantitativo cai na folha ativa, sem escala e com o título automático', () => {
    const a = novaFolha('A');
    useApp.setState({ pranchas: { ...SEM_PRANCHAS, folhas: [a] } });
    usePranchasUi.setState({ ativa: a.id });
    desligar = ligarEnvioParaPrancha();
    expect(enviarParaPrancha({ tipo: 'tabela', id: 'blocos' })).toBe(1);
    const [item] = useApp.getState().pranchas.folhas[0].itens;
    expect(item.conteudo).toEqual({ tipo: 'tabela', id: 'blocos' });
    expect(item.escala).toBeNull();
    expect(item.titulo).toBe('');
    expect(useApp.getState().recado).toBe('Enviado para a folha 01');
  });
});
