import { describe, expect, it, vi } from 'vitest';
import { enviarParaPrancha, ouvirEnvioParaPrancha, type PedidoParaPrancha } from './envio';
import type { Camera3d } from './tipos';

const camera: Camera3d = {
  posicao: [20, -20, 17],
  alvo: [2, 0.5, 1],
  cima: [0, 0, 1],
  ortografica: true,
  zoom: 1 / 15,
  fov: 30,
  estilo: 'opaco',
  armadura: false,
  corteX: null,
  ocultas: [],
};
const foto: PedidoParaPrancha = { tipo: '3d', dataUrl: 'data:image/png;base64,AAAA', camera, proporcao: 4 / 3 };
const vista: PedidoParaPrancha = { tipo: 'vista', id: 'corte' };

describe('canal "Enviar para a prancha"', () => {
  it('sem prancha ouvindo, o envio não quebra nada (ninguém recebe)', () => {
    expect(enviarParaPrancha(foto)).toBe(0);
  });

  it('quem assina recebe o pedido do 3D e o da vista; cancelado, não recebe mais', () => {
    const recebidos: PedidoParaPrancha[] = [];
    const cancelar = ouvirEnvioParaPrancha((p) => recebidos.push(p));
    expect(enviarParaPrancha(foto)).toBe(1);
    expect(enviarParaPrancha(vista)).toBe(1);
    expect(recebidos).toEqual([foto, vista]);
    cancelar();
    cancelar(); // duas vezes não faz mal
    expect(enviarParaPrancha(foto)).toBe(0);
    expect(recebidos).toHaveLength(2);
  });

  it('a mesma função assinada duas vezes: cada assinatura tem o seu cancelamento', () => {
    const fn = vi.fn();
    const a = ouvirEnvioParaPrancha(fn);
    const b = ouvirEnvioParaPrancha(fn);
    expect(enviarParaPrancha(foto)).toBe(2);
    a();
    expect(enviarParaPrancha(foto)).toBe(1);
    b();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('um ouvinte que falha não impede os outros nem quem enviou', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bom = vi.fn();
    const a = ouvirEnvioParaPrancha(() => {
      throw new Error('tela da prancha com defeito');
    });
    const b = ouvirEnvioParaPrancha(bom);
    expect(() => enviarParaPrancha(foto)).not.toThrow();
    expect(bom).toHaveBeenCalledWith(foto);
    expect(erro).toHaveBeenCalledOnce();
    a();
    b();
    erro.mockRestore();
  });

  it('o ouvinte pode cancelar a si mesmo no meio da entrega', () => {
    const outro = vi.fn();
    const cancelar = ouvirEnvioParaPrancha(() => cancelar());
    const c2 = ouvirEnvioParaPrancha(outro);
    expect(enviarParaPrancha(foto)).toBe(2);
    expect(enviarParaPrancha(foto)).toBe(1);
    expect(outro).toHaveBeenCalledTimes(2);
    c2();
  });
});
