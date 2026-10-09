import { describe, expect, it } from 'vitest';
import type { Alteracoes, Resultado, Valor } from '@/motor/tipos';
import type { Modelo } from '@/modelo/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import { resultadoDoGabarito } from '@/motor/resultadoDoGabarito';
import { padroesDe, recalcular } from './recalculo';

const PADROES = padroesDe(ENTRADAS_DO_MODELO);
const r122 = resultadoDoGabarito('aula122');
const calcular = (_a: Alteracoes): Resultado => r122;
const modeloFalso = { versao: 'x' } as unknown as Modelo;

describe('a ordem: conta → modelo → veredito', () => {
  it('sem peças ligadas, só a conta', () => {
    const r = recalcular({ calcular, gerador: null, veredito: null }, {}, {}, PADROES);
    expect(r.resultado).toBe(r122);
    expect(r.erroConta).toBeNull();
    expect(r.modelo).toBeNull();
    expect(r.veredito).toBeNull();
    expect(r.resultado?.num('H_muro')).toBe(1.6);
  });

  it('o gerador recebe as entradas do modelo completas (padrão + alteradas)', () => {
    let recebido: Record<string, Valor> = {};
    const gerador = (_r: Resultado, extras: Record<string, Valor>) => {
      recebido = extras;
      return modeloFalso;
    };
    const r = recalcular({ calcular, gerador, veredito: null }, {}, { L_total: 12 }, PADROES);
    expect(r.modelo).toBe(modeloFalso);
    expect(recebido.L_total).toBe(12);
    expect(recebido.cinta_topo).toBe('Sim');
    expect(Object.keys(recebido).length).toBe(ENTRADAS_DO_MODELO.length);
  });

  it('modelo que falha não derruba a conta nem o veredito', () => {
    const gerador = () => {
      throw new Error('não fecha no módulo');
    };
    const r = recalcular({ calcular, gerador, veredito: () => ({ passa: false, falhas: 2 }) }, {}, {}, PADROES);
    expect(r.resultado).toBe(r122);
    expect(r.modelo).toBeNull();
    expect(r.erroModelo).toBe('não fecha no módulo');
    expect(r.veredito).toEqual({ passa: false, falhas: 2 });
  });

  it('conta que falha não chama o gerador', () => {
    let chamou = false;
    const r = recalcular(
      {
        calcular: () => {
          throw new Error('alteração em nome inexistente: x');
        },
        gerador: () => {
          chamou = true;
          return modeloFalso;
        },
        veredito: null,
      },
      { x: 1 },
      {},
      PADROES,
    );
    expect(r.resultado).toBeNull();
    expect(r.erroConta).toMatch(/inexistente/);
    expect(chamou).toBe(false);
  });
});
