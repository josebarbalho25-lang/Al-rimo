// O pilarete do muro de cima PRESO ao arrimo (Jose, 13/11: "esses pilares precisam engastar e ter armadura contínua
// com o muro, adentrando no graute; a posição deles é limitada de acordo com os blocos"). Confere, no muro montado:
// as barras descem o traspasse inteiro dentro dos furos (balanço) ou da haste (contrafortes), sem aviso de ligação,
// e o furo onde elas descem sai grauteado.
import { describe, expect, it } from 'vitest';
import { calcular } from '@/motor';
import { alteracoesDoExemplo } from '@/estado/novo';
import { gerarModelo } from './gerar';
import { H_FIADA } from './catalogo';

const MC = {
  mc_on: 'Sim', vento_on: 'Sim', h_mc: 2.0, t_mc: 11.5, g_mc: 1.4, arg_mc: '1,5 a 3,4 MPa', V0_v: 35, S1_v: 1.0,
  cat_v: 'III', cls_v: 'A', S3_v: 0.88, S3_e: 1.0, cin_mc: 'No topo',
};

const CASOS: [string, Record<string, unknown>][] = [
  ['balanço 19, 1,0 m, concreto', { Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.0, H_solo: 1.0 }],
  ['balanço 19, 1,6 m, bloco', { Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 1.6, H_solo: 1.6, pil_tipo: 'Bloco grauteado' }],
  ['balanço 19, 2,4 m, 30 de frente', { Tipo_muro: 'Balanço', t_bloco: 19, H_muro: 2.4, H_solo: 2.4, b_pil: 30, s_pil: 2.0 }],
  ['contrafortes 14·54 enterrado', { Tipo_muro: 'Contrafortes', t_bloco: 14, tenr_: 54, H_muro: 2.6, H_solo: 2.6, l_cf: 1.75 }],
  ['contrafortes 19·59 aparente, bloco', { Tipo_muro: 'Contrafortes', t_bloco: 19, tenr_: 59, H_muro: 2.6, H_solo: 2.6, l_cf: 2.0, pos_cf: 'Aparente (lado de fora)', pil_tipo: 'Bloco grauteado' }],
];

describe('pilarete preso ao arrimo', () => {
  for (const [nome, ex] of CASOS) {
    it(nome, () => {
      const r = calcular({ ...alteracoesDoExemplo(), ...MC, ...ex } as never);
      const m = gerarModelo(r);
      expect(m.avisos.map((a) => a.codigo)).not.toContain('PILARETE_LIGACAO');
      const H = m.dims.H_muro;
      const l0t = (r.num('l0t_pil') ?? 0) * 10;
      const barras = m.barras.filter((b) => b.papel === 'PIL_LONG');
      expect(barras.length).toBeGreaterThan(0);
      for (const b of barras) expect(Math.min(b.eixo[0][2], b.eixo[1][2])).toBeCloseTo(H - l0t, 6);
      if (ex.Tipo_muro !== 'Balanço') return;
      // no balanço, o furo da fiada de baixo da emenda tem graute em cada barra
      const fiada = Math.floor((H - l0t) / H_FIADA);
      const grautes = m.pecas.filter((p) => p.tipo === 'GRAUTE_FURO' && p.fiada === fiada);
      for (const b of barras) {
        const [x, y] = b.eixo[0];
        const g = grautes.find((p) => {
          const geo = m.geometrias[p.geometria];
          const c = geo.perfil.contorno;
          const xs = c.map((q) => q[0] + p.origem[0]);
          const ys = c.map((q) => q[1] + p.origem[1]);
          return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys);
        });
        expect(g, `${b.id} sem graute na fiada ${fiada}`).toBeDefined();
      }
    });
  }

  it('balanço em bloco 14: a conta reprova o muro de cima', () => {
    const r = calcular({ ...alteracoesDoExemplo(), ...MC, Tipo_muro: 'Balanço', t_bloco: 14, H_muro: 1.6, H_solo: 1.6 } as never);
    expect(String(r.v('chk_ligg'))).toMatch(/^NÃO OK — balanço em bloco 14/);
    expect(String(r.v('res_mc'))).toMatch(/^NÃO OK/);
    expect(String(r.v('aviso_mc'))).not.toBe('');
  });
});
