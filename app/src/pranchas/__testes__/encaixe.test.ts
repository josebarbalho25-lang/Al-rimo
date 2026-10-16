/*
  O ENCAIXE DOS DESENHOS (Jose, 16/10: "snap pros desenhos na prancha pra conseguir posicionar eles alinhados") — o
  que quebraria: grudar longe demais (o desenho não anda livre), não grudar perto, escolher o par mais longe, ou
  esquecer o meio (alinhar dois cortes pelo eixo).
*/
import { describe, expect, it } from 'vitest';
import { encaixar } from '../encaixe';

describe('encaixar', () => {
  const outro = [100, 50, 80, 40] as const;

  it('a borda de cima gruda na de cima do outro (o mais perto), com a guia na linha', () => {
    const e = encaixar([10, 52, 60, 30], [outro], [], [], 4);
    expect(e.dy).toBeCloseTo(-2, 9);
    expect(e.gy).toBe(50);
  });

  it('o meio gruda no meio (dois desenhos alinhados pelo centro)', () => {
    // meio em x do movido: 10 + 30 = 40 → alinha com o meio do outro (140) se estiver perto
    const e = encaixar([108, 200, 60, 30], [outro], [], [], 3);
    expect(e.dx).toBeCloseTo(2, 9);
    expect(e.gx).toBe(140);
  });

  it('longe de tudo, anda livre (sem guia)', () => {
    const e = encaixar([300, 300, 20, 20], [outro], [20], [20], 3);
    expect(e).toEqual({ dx: 0, dy: 0 });
  });

  it('a moldura também é alvo', () => {
    const e = encaixar([21.5, 300, 20, 20], [], [20, 821], [10, 584], 3);
    expect(e.dx).toBeCloseTo(-1.5, 9);
    expect(e.gx).toBe(20);
  });
});
