# Fig. 7 (app) — altura efetiva e esbeltez. As tabelinhas de αv e αh ficam: são rótulo + valor de norma,
# o que ajuda a escolher a entrada; a citação "planilha 02 do curso" sai.
import math
from applib import Fig, C, T_TIT, T_TXT, T_PEQ


def desenhar():
    s = Fig(7, 1000, 520)
    yb, hpx = 470, 300
    # (a) sem travamento: balanço livre no topo
    x = 150
    with s.campo('Trav_lat'):
        s.text(x + 80, 70, 'Sem travamento lateral', size=T_TIT, weight='bold')
    s.rect(x - 60, yb, 150, 28, fill=s.CONC, stroke=C['line'])
    s.rect(x, yb - hpx, 24, hpx, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    with s.campo('M2d_on'):
        dpts = [(x + 12 + 55 * (1 - math.cos(math.pi / 2 * (yb - y) / hpx)), y) for y in range(yb, int(yb - hpx) - 1, -10)]
        s.pline(dpts, stroke=C['load'], sw=2.2, extra='stroke-dasharray="7,5"')
        s.text(x + 86, yb - hpx + 40, 'M_{2d}', size=T_TXT, anchor='start', color=C['load'])
    with s.campo('peso_par'):
        s.arrow(x + 12, yb - hpx - 62, x + 12, yb - hpx - 6, color=C['load'], sw=2.4)
        s.text(x + 24, yb - hpx - 40, 'peso próprio', size=T_PEQ + 1, anchor='start', color=C['load'])
    s.dim_v(x - 34, yb - hpx, yb, 'h', side=-1, ext_from=(x, x))
    s.text(x + 120, yb - 110, 'h_{e} = 2·h', size=22, weight='bold', color=C['load'], anchor='start')
    # (b) com travamento lateral
    x2, w2 = 510, 420
    with s.campo('Trav_lat'):
        s.text(x2 + w2 / 2, 70, 'Com travamento lateral', size=T_TIT, weight='bold')
    s.rect(x2, yb - hpx, w2, hpx, fill=C['blockfill'], stroke=C['line'], sw=1.2)
    for xx in (x2, x2 + w2):
        s.rect(xx - 10, yb - hpx, 20, hpx, fill=C['cinza'], stroke=C['line'], sw=1.2)
    s.text(x2, yb - hpx - 10, 'travamento', size=T_PEQ, color=C['note'])
    s.text(x2 + w2, yb - hpx - 10, 'travamento', size=T_PEQ, color=C['note'])
    s.rect(x2 - 40, yb, w2 + 80, 28, fill=s.CONC, stroke=C['line'])
    with s.campo('l_trav'):
        s.dim_h(x2, x2 + w2, yb + 58, 'ℓ', ext_from=(yb + 28, yb + 28))
    s.dim_v(x2 - 44, yb - hpx, yb, 'h', side=-1, ext_from=(x2 - 10, x2 - 10))
    with s.campo('alfa_v', 'alfa_h', 'l_trav'):
        s.text(x2 + w2 / 2, yb - hpx + 56, 'h_{e} = mín( α_{v}·h ; 0,7·√(α_{v}·h·α_{h}·ℓ) )', size=20, weight='bold', color=C['load'], halo=True)
    with s.campo('alfa_v'):
        s.text(x2 + 30, yb - hpx + 120, 'α_{v} = 1,0  travada no topo e na base', size=T_TXT, anchor='start', halo=True)
        s.text(x2 + 30, yb - hpx + 146, 'α_{v} = 2,5  travada só na base', size=T_TXT, anchor='start', halo=True)
    with s.campo('alfa_h'):
        s.text(x2 + 30, yb - hpx + 196, 'α_{h} = 1,0  travada nos dois lados', size=T_TXT, anchor='start', halo=True)
        s.text(x2 + 30, yb - hpx + 222, 'α_{h} = 2,5  travada de um lado só', size=T_TXT, anchor='start', halo=True)
    return s
