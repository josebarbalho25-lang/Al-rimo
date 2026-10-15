// ═══════════════════════════════════════════════════════════════════════════
//  ui/TabelaDeGraficos.tsx — cores e hachuras dos desenhos e do 3D (Jose, 15/10)
// ---------------------------------------------------------------------------
//  O "Estilos de objeto" do Revit dele, numa tabela: uma linha por material,
//  a cor do 3D Cores, a do Opaco e a hachura de corte das vistas 2D (desenho,
//  risco, fundo, escala); embaixo, a cor de cada Ø do modo Armadura. Vale na
//  hora para as vistas, a prancha (PDF e DXF) e o 3D, e fica guardada no app
//  (desenhos/useGraficos.ts). Célula vazia = o material não tem aquilo.
//  Linha = rótulo + controle; sem texto explicando (regra do dono).
// ═══════════════════════════════════════════════════════════════════════════

import type { CSSProperties } from 'react';
import { DESENHOS_DE_HACHURA, MATERIAIS, type DesenhoDeHachura, type GraficoDoMaterial, type Graficos, type Hachura, type Material } from '@/desenhos/graficos';
import { useGraficos } from '@/desenhos/useGraficos';
import { lerPaleta, type PaletaVisor } from '@/visor/tema3d';
import { rotuloDaBitola } from '@/visor/coresDasBitolas';

/** A cor do tema que o 3D Cores usa quando o material não tem cor escolhida (null). */
const COR_DO_TEMA: Partial<Record<Material, keyof PaletaVisor>> = {
  concreto: 'concreto', brita: 'brita', areia: 'areia', manta: 'manta', tubo: 'tubo', terra: 'solo',
};

/** O <input type="color"> só aceita #rrggbb. */
function paraHex(css: string): string {
  const c = css.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
  if (curto) return `#${curto[1]}${curto[1]}${curto[2]}${curto[2]}${curto[3]}${curto[3]}`.toLowerCase();
  const rgb = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0')).join('');
  return '#808080';
}

const s = {
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-rotulo, 12.5px)' } as CSSProperties,
  th: { textAlign: 'left', fontWeight: 500, color: 'var(--muted, #777)', padding: '2px 4px', whiteSpace: 'nowrap' } as CSSProperties,
  td: { padding: '2px 4px', verticalAlign: 'middle' } as CSSProperties,
  rotulo: { whiteSpace: 'nowrap' } as CSSProperties,
  escala: { width: 58 } as CSSProperties,
};

function Cor({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  return <input type="color" className="cfg-cor" aria-label={rotulo} value={paraHex(valor)} onChange={(e) => aoMudar(e.target.value)} />;
}

export function TabelaDeGraficos() {
  const g = useGraficos((st) => st.dados);
  const mudar = useGraficos((st) => st.mudar);
  const restaurar = useGraficos((st) => st.restaurar);
  const paleta = lerPaleta();

  const mudarMaterial = (m: Material, parcial: Partial<GraficoDoMaterial>) =>
    mudar((a): Graficos => ({ ...a, materiais: { ...a.materiais, [m]: { ...a.materiais[m], ...parcial } } }));
  const mudarHachura = (m: Material, parcial: Partial<Hachura>) =>
    mudar((a): Graficos => {
      const h = a.materiais[m].hachura;
      return h ? { ...a, materiais: { ...a.materiais, [m]: { ...a.materiais[m], hachura: { ...h, ...parcial } } } } : a;
    });

  return (
    <>
      <table style={s.tabela}>
        <thead>
          <tr>
            <th style={s.th}>Material</th>
            <th style={s.th}>Cores</th>
            <th style={s.th}>Opaco</th>
            <th style={s.th}>Hachura</th>
            <th style={s.th}>Risco</th>
            <th style={s.th}>Fundo</th>
            <th style={s.th}>Escala</th>
          </tr>
        </thead>
        <tbody>
          {MATERIAIS.map(({ id, rotulo }) => {
            const m = g.materiais[id];
            const h = m.hachura;
            const tema = COR_DO_TEMA[id];
            return (
              <tr key={id} data-material={id}>
                <td style={{ ...s.td, ...s.rotulo }}>{rotulo}</td>
                <td style={s.td}>
                  {'cor' in m && (
                    <Cor rotulo={`${rotulo}: Cores`} valor={m.cor ?? (tema ? String(paleta[tema]) : '#808080')} aoMudar={(v) => mudarMaterial(id, { cor: v })} />
                  )}
                </td>
                <td style={s.td}>{m.opaco !== undefined && <Cor rotulo={`${rotulo}: Opaco`} valor={m.opaco} aoMudar={(v) => mudarMaterial(id, { opaco: v })} />}</td>
                <td style={s.td}>
                  {h && (
                    <select className="campo" aria-label={`${rotulo}: hachura`} value={h.desenho} onChange={(e) => mudarHachura(id, { desenho: e.target.value as DesenhoDeHachura })}>
                      {DESENHOS_DE_HACHURA.map((d) => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
                    </select>
                  )}
                </td>
                <td style={s.td}>
                  {h && <Cor rotulo={`${rotulo}: risco`} valor={h.risco} aoMudar={(v) => mudarHachura(id, { risco: v })} />}
                  {!h && m.desenho !== undefined && <Cor rotulo={`${rotulo}: traço`} valor={m.desenho} aoMudar={(v) => mudarMaterial(id, { desenho: v })} />}
                </td>
                <td style={s.td}>{h && <Cor rotulo={`${rotulo}: fundo`} valor={h.fundo} aoMudar={(v) => mudarHachura(id, { fundo: v })} />}</td>
                <td style={s.td}>
                  {h && (
                    <input
                      type="number" className="campo" style={s.escala} aria-label={`${rotulo}: escala`}
                      min={0.25} max={4} step={0.25} value={h.escala}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 0.1 && v <= 10) mudarHachura(id, { escala: v });
                      }}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>Armadura</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {g.bitolas.map(([d, c]) => (
          <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={s.rotulo}>{rotuloDaBitola(d)}</span>
            <Cor rotulo={rotuloDaBitola(d)} valor={c} aoMudar={(v) => mudar((a) => ({ ...a, bitolas: a.bitolas.map(([dd, cc]): [number, string] => [dd, dd === d ? v : cc]) }))} />
          </label>
        ))}
      </div>

      <div className="cfg-linha">
        <span />
        <button type="button" className="btn-caixa" onClick={restaurar}>Restaurar padrão</button>
      </div>
    </>
  );
}
