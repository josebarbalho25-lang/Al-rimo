# Fig. 1 (app) — muro em balanço, corte. Mesmo desenho da fig01 da planilha, sem os rótulos entre aspas.
# Duas alturas (Jose, 09/10): h_muro (do topo da sapata ao topo do muro) e h_solo (do topo do solo à base do muro,
# no máximo h_muro). O muro passa do solo o bastante para as duas cotas não se confundirem.
from applib import Fig, C, T_TXT, T_PEQ


def desenhar():
    s = Fig(1, 1000, 620)
    K = 150
    xw = 400; t = 0.19 * K; xs = xw + t
    yb = 470; yt = yb - 2.0 * K; ytop = yt - 0.4 * K
    xr = 880
    # terreno
    # um polígono só: dois retângulos com a mesma hachura deixam uma costura visível na emenda
    s.poly([(170, yb), (xs, yb), (xs, yt), (xr, yt), (xr, yb + 95), (170, yb + 95)], fill=s.SOLO, stroke='none')
    s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(170, yb, xw, yb, stroke=C['soil'], sw=2)
    # sapata
    s.rect(xw - 105, yb, 105 + t + 165, 52, fill=s.CONC, stroke=C['line'], sw=1.4)
    s.text(xw - 52, yb + 33, 'sapata', size=T_PEQ, color=C['note'])
    # empuxo (no plano da face do solo)
    with s.campo('Ka_dir'):
        s0, s1 = 8, 150
        s.poly([(xs, yt), (xs + s0, yt), (xs + s1, yb), (xs, yb)], fill=C['empuxo'], stroke=C['load'], sw=1.4, extra='fill-opacity="0.75"')
        for i in range(1, 7):
            y = yt + i * (yb - yt) / 7
            s.arrow(xs + s0 + (s1 - s0) * i / 7 - 2, y, xs + 3, y, sw=1.3)
        s.text(xs + s1 + 12, yb - 12, 'σ\'_{h} = K_{a}·σ\'_{v}', anchor='start', color=C['load'], halo=True)
    # muro + canaletas + cinta
    s.rect(xw, ytop, t, yb - ytop, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    for yc in (yb - 0.8 * K, yb - 1.6 * K, ytop):
        s.rect(xw, yc, t, 28, fill=C['groutfill'], stroke=C['grout'], sw=1)
    # barra com espera e gancho para o lado do solo
    xb = xs - 0.05 * K
    s.pline([(xb, ytop + 6), (xb, yb + 38), (xb + 34, yb + 38)], stroke=C['steel'], sw=2.6)
    # sobrecarga
    with s.campo('q_sobre'):
        for x in range(int(xs) + 24, xr - 10, 36):
            s.arrow(x, yt - 48, x, yt - 3, sw=1.5)
        s.line(xs + 24, yt - 48, xr - 14, yt - 48, stroke=C['load'], sw=1.5)
        s.text(xr - 4, yt - 42, 'q', size=22, anchor='start', color=C['load'], weight='bold')
    # nível d'água
    yNA = yt + 1.0 * K
    with s.campo('z_NA'):
        s.line(xs, yNA, xr, yNA, stroke=C['water'], sw=1.8, extra='stroke-dasharray="9,6"')
        s.poly([(815, yNA - 15), (831, yNA - 15), (823, yNA - 2)], fill=C['water'], stroke='none')
        s.text(836, yNA - 6, 'NA', size=T_TXT, anchor='start', color=C['water'], weight='bold', halo=True)
        s.dim_v(xr + 26, yt, yNA, 'z_{NA}', side=1, ext_from=(xr, xr))
    # solo contido
    with s.campo('Tipo_solo', 'NSPT', 'Umidade', 'Classe_G'):
        s.text(745, yb - 62, 'solo', size=20, color=C['soil'], weight='bold', halo=True)
    with s.campo('gama_solo'):
        s.text(712, yb - 30, 'γ', size=21, color=C['soil'], halo=True)
    with s.campo('phi_solo'):
        s.text(746, yb - 30, 'φ\'', size=21, color=C['soil'], halo=True)
    with s.campo('c_solo'):
        s.text(780, yb - 30, 'c\'', size=21, color=C['soil'], halo=True)
    # cotas: o solo do lado do solo (à direita, junto ao aterro), o muro do lado de fora
    with s.campo('H_muro'):
        s.dim_v(xw - 45, ytop, yb, 'h_{muro}', side=-1, ext_from=(xw, xw))
    with s.campo('H_solo'):
        s.dim_v(xr + 100, yt, yb, 'h_{solo}', side=1, ext_from=(xr, xr))
    with s.campo('h_pan'):
        s.dim_v(xw - 120, yb - 1.6 * K + 14, yb - 0.8 * K + 14, 'h_{p}', side=-1, ext_from=(xw, xw))
    with s.campo('t_bloco'):
        s.dim_h(xw, xs, ytop - 18, 't', ext_from=(ytop, ytop))
    return s
