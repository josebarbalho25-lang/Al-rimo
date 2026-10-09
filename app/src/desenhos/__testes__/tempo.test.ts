import { it } from 'vitest';
import { corteLateral, isometrico, planta, vistaFrontal } from '../index';
import { modeloDeExemplo } from './modeloDeExemplo';
it.skipIf(!process.env.DES_TEMPO)('tempo num muro grande', () => {
  const m = modeloDeExemplo({ tipo: 'contrafortes', vaos: 19, celulasPorVao: 8, fiadas: 15 });
  console.log('peças', m.pecas.length, 'barras', m.barras.length, 'L', m.dims.L_real);
  for (const [n, f] of [['frontal', () => vistaFrontal(m)], ['planta', () => planta(m)], ['corte', () => corteLateral(m)], ['iso', () => isometrico(m)], ['isoCorte', () => isometrico(m, { corteX: 15000 })]] as const) {
    const t0 = performance.now(); const s = f(); console.log(n, Math.round(performance.now() - t0), 'ms', Math.round(s.length / 1024), 'kB');
  }
});
