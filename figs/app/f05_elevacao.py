# Fig. 5 (app) — elevação do muro (vista de fora): barras verticais, canaletas, cinta do topo e o painel
# não armado. Corrige o defeito da fig05 da planilha: lá o painel estava pintado no 1º vão e a cota l no 2º.
# Aqui o painel, a cota s (entre barras) e a cota h_p (entre canaletas) contam a mesma história.
from applib import Fig, C, T_TXT, T_PEQ


def desenhar():
    s = Fig(5, 1000, 560)
    K = 1.8
    x0, yb = 150, 470
    Lw, Hw = 280, 200
    yt = yb - Hw * K
    X = lambda v: x0 + v * K
    Y = lambda v: yb - v * K
    canaletas = (3, 7, 9)            # fiadas (0 = 1ª) em canaleta: topo a 80, 160 e 200 cm
    for i in range(10):
        y = yb - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xs = -off
        while xs < Lw:
            a = max(xs, 0); b = min(xs + 39, Lw)
            if b > a:
                c = i in canaletas
                s.rect(X(a), y, (b - a) * K, 19 * K, fill=C['groutfill'] if c else C['blockfill'],
                       stroke=C['grout'] if c else C['block'], sw=0.8)
            xs += 40
    barras = [10 + 40 * k for k in range(7)]
    for xb in barras:
        s.rect(X(xb - 6), yt, 12 * K, Hw * K, fill=C['groutfill'], stroke='none', extra='fill-opacity="0.6"')
    # barras horizontais nas canaletas (eixo da canaleta)
    for i in (3, 7):
        yy = Y(i * 20 + 10)
        s.line(X(2), yy, X(Lw - 2), yy, stroke=C['steel'], sw=2)
    with s.campo('cinta_topo', 'phi_cinta'):
        s.line(X(2), Y(190), X(Lw - 2), Y(190), stroke=C['steel'], sw=2.4)
    # barras verticais com espera
    with s.campo('phi_v'):
        for xb in barras:
            s.line(X(xb), yt + 4, X(xb), yb + 30, stroke=C['steel'], sw=2.4)
    s.rect(x0 - 24, yb, Lw * K + 48, 40, fill=s.CONC, stroke=C['line'], sw=1.2)
    s.text(x0 + Lw * K / 2, yb + 27, 'sapata', size=T_PEQ, color=C['note'])
    # painel não armado: 1º vão, da base ao eixo da 1ª canaleta
    pa, pb, ph = 10, 50, 70
    s.rect(X(pa), Y(ph), (pb - pa) * K, ph * K, fill=C['empuxo'], stroke=C['load'], sw=2.6, extra='fill-opacity="0.6"')
    s.text(X((pa + pb) / 2), Y(ph / 2) - 4, 'painel', size=T_PEQ + 1, weight='bold', color=C['load'], halo=True)
    s.text(X((pa + pb) / 2), Y(ph / 2) + 15, 'não armado', size=T_PEQ + 1, weight='bold', color=C['load'], halo=True)
    # cotas
    with s.campo('s_dir'):
        s.dim_h(X(pa), X(pb), yt - 18, 's', ext_from=(yt, yt))
    with s.campo('h_pan'):
        s.dim_v(x0 - 40, Y(150), Y(70), 'h_{p}', side=-1, ext_from=(x0, x0))
    # chamadas à direita
    xr = X(Lw) + 30
    with s.campo('cinta_topo', 'phi_cinta'):
        s.chamada(X(Lw - 12), Y(190), xr, Y(190) + 6, 'cinta (canaleta)', color=C['grout'])
    s.chamada(X(Lw - 12), Y(150), xr, Y(150) + 6, 'canaleta + barra horizontal', color=C['grout'])
    s.chamada(X(Lw - 12), Y(70), xr, Y(70) + 6, 'canaleta + barra horizontal', color=C['grout'])
    with s.campo('phi_v'):
        s.chamada(X(250), Y(40), xr, Y(30) + 6, 'barra vertical Ø', color=C['steel'])
    return s
