# Fig. 13 (app) — painel entre contrafortes, elevação vista de fora. A coluna de texto da planilha
# (momentos, "armaduras do exemplo", flecha) vira rótulo no próprio desenho: cada momento no lugar onde ele
# acontece. Sem l = 1,50 / h = 2,60 / σ = 20,8 / c/45 / c/80 da aula 12.3.
import math
from applib import Fig, C, T_TXT, T_PEQ


def desenhar():
    s = Fig(13, 1000, 680)
    S = 1.9
    l, h, e = 150, 260, 14
    x0, yb = 150, 590
    X = lambda v: x0 + v * S
    Y = lambda v: yb - v * S
    s.rect(X(-20), Y(0), (l + 40) * S, 50, fill=s.CONC, stroke=C['line'], sw=1.2)
    s.text(X(l / 2), Y(0) + 45, 'sapata (engaste)', size=T_TXT, color=C['line'], halo=True)
    with s.campo('lat_pan'):
        for xc in (0, l):
            s.rect(X(xc - e / 2), Y(h), e * S, h * S, fill=C['cinza2'], stroke=C['block'], sw=1.2)
    s.text(X(0), Y(h) - 12, 'contraforte', size=T_PEQ, color=C['note'])
    s.text(X(l), Y(h) - 12, 'contraforte', size=T_PEQ, color=C['note'])
    s.rect(X(e / 2), Y(h), (l - e) * S, h * S, fill=C['blockfill'], stroke='none')
    s.line(X(e / 2), Y(h), X(l - e / 2), Y(h), stroke=C['line'], sw=1.8, extra='stroke-dasharray="8,6"')
    s.text(X(l / 2), Y(h) - 12, 'topo livre', size=T_TXT, color=C['line'], weight='bold')
    xs = [e / 2 + 7.5 + 45 * k for k in range(4) if e / 2 + 7.5 + 45 * k < l - e / 2]
    s.rect(X(xs[1]), Y(80), (xs[2] - xs[1]) * S, 80 * S, fill=C['sub'], stroke=C['sub_line'], sw=1.2, extra='stroke-dasharray="5,3"')
    s.text(X((xs[1] + xs[2]) / 2), Y(46), 'não', size=T_PEQ, color=C['sub_txt'], weight='bold', halo=True)
    s.text(X((xs[1] + xs[2]) / 2), Y(46) + 19, 'armado', size=T_PEQ, color=C['sub_txt'], weight='bold', halo=True)
    for hc in (80, 160, 240):
        s.rect(X(e / 2), Y(hc + 10), (l - e) * S, 10 * S, fill=C['groutfill'], stroke=C['grout'], sw=0.8)
    with s.campo('phi_ph'):
        for hc in (80, 160, 240):
            s.line(X(e / 2), Y(hc + 5), X(l - e / 2), Y(hc + 5), stroke=C['steel'], sw=2.2)
    with s.campo('phi_pv'):
        for xb in xs:
            s.line(X(xb), Y(h) + 4, X(xb), Y(0) + 24, stroke=C['steel'], sw=2.4)
            s.line(X(xb), Y(0) + 24, X(xb) + 14, Y(0) + 24, stroke=C['steel'], sw=2.4)
    # charneiras a 60° a partir da base
    a = min(l * math.tan(math.radians(60)) / 2, h)
    s.pline([(X(e / 2), Y(0)), (X(l / 2), Y(a)), (X(l - e / 2), Y(0))], stroke=C['load'], sw=1.6, extra='stroke-dasharray="8,4"')
    # momentos no lugar onde acontecem
    def mom(x, y, t, campo=None):
        s.text(x, y, t, size=T_TXT, color=C['steel'], weight='bold', halo=True)
    mom(X(l / 2), Y(8), 'M_{dyei}')
    mom(X(l / 2) + 2, Y(118), 'M_{dy}')
    mom(X(l / 2) + 2, Y(200), 'M_{dx}')
    mom(X(l / 2), Y(h) + 26, 'M_{dxb}')
    with s.campo('lat_pan'):
        s.text(X(e / 2) + 6, Y(200) + 6, 'M_{dxe}', size=T_TXT, color=C['steel'], weight='bold', anchor='start', halo=True)
    # cotas
    with s.campo('l_cf'):
        s.dim_h(X(0), X(l), Y(0) + 86, 'ℓ (eixo a eixo)', ext_from=(Y(0) + 50, Y(0) + 50))
    with s.campo('H_muro'):
        s.dim_v(X(-e / 2) - 30, Y(h), Y(0), 'h', side=-1, ext_from=(X(-e / 2), X(-20)))
    with s.campo('s_pv_dir'):
        s.dim_h(X(xs[0]), X(xs[1]), Y(150) - 4, 's_{v}', halo=True)
    with s.campo('s_ph_dir'):
        s.dim_v(X(l - e / 2) + 24, Y(165), Y(85), 's_{h}', side=1)
    # empuxo (triangular + uniforme)
    dx = X(l) + 90
    pmax = 110
    s.poly([(dx, Y(h)), (dx + 12, Y(h)), (dx + pmax, Y(0)), (dx, Y(0))], fill=C['empuxo2'], stroke=C['load'], sw=1.2)
    for k in range(1, 6):
        yy = h * k / 6
        s.arrow(dx + 12 + (pmax - 12) * (1 - yy / h), Y(yy), dx + 3, Y(yy), sw=1.3)
    s.text(dx + pmax + 8, Y(0) - 6, 'σ_{h}', size=20, anchor='start', color=C['load'])
    # rótulos das barras junto delas (chamada longa cruzaria o contraforte e o empuxo)
    with s.campo('phi_pv'):
        s.text(X(xs[0]) + 8, Y(122), 'Ø_{v}', size=20, anchor='start', color=C['steel'], weight='bold', halo=True)
    with s.campo('phi_ph'):
        s.text(X(124), Y(165) - 9, 'Ø_{h}', size=20, color=C['steel'], weight='bold', halo=True)
    return s
