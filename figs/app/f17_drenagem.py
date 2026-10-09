# Fig. 17 (app, nova) — drenagem: corte (dreno de brita com manta no tardoz, terminando abaixo do topo do
# solo; impermeabilização da face do solo; barbacã na 1ª fiada caindo para fora) e elevação (barbacãs a
# cada s). Tudo configurável (decisão do Jose, 08/10: "cada projetista se vira com isso").
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

K = 1.6          # px por cm


def desenhar():
    s = Fig(17, 1000, 640)
    # ---------------- corte ----------------
    xw = 180; t = 19 * K; xs = xw + t
    ye = 520                                 # topo da sapata (base do muro)
    H_S, H_M = 200, 210
    yt = ye - H_S * K
    esp, folga = 24, 42                      # cm, proporção do desenho
    s.text(xw - 100, yt - 80, 'Corte', size=T_TIT, anchor='start', weight='bold')
    # um polígono só: dois retângulos com a mesma hachura deixam uma costura visível na emenda
    s.poly([(xw - 120, ye), (xs, ye), (xs, yt), (xs + 330, yt), (xs + 330, ye + 60), (xw - 120, ye + 60)], fill=s.SOLO, stroke='none')
    s.line(xs, yt, xs + 330, yt, stroke=C['soil'], sw=2)
    s.line(xw - 120, ye, xw, ye, stroke=C['soil'], sw=2)
    s.rect(xw - 60, ye, 60 + t + 170, 40, fill=s.CONC, stroke=C['line'], sw=1.2)
    s.rect(xw, ye - H_M * K, t, H_M * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
    # dreno de brita + manta
    xd0, xd1 = xs + 4, xs + 4 + esp * K
    yd = yt + folga * K
    with s.campo('dreno_on'):
        s.rect(xd0, yd, xd1 - xd0, ye - yd, fill=s.BRITA, stroke='none')
        s.pline([(xd0, yd), (xd1, yd), (xd1, ye)], stroke=C['passivo'], sw=2.2, extra='stroke-dasharray="7,4"')
        s.chamada(xd1 - 10, ye - 130, xd1 + 60, ye - 150, 'dreno (brita)', size=T_TXT)
        s.chamada(xd1, yd + 60, xd1 + 60, yd + 40, 'manta', color=C['passivo_txt'], size=T_TXT)
    with s.campo('imper_on'):
        s.line(xs + 1.5, ye - H_M * K + 10, xs + 1.5, ye, stroke=C['line'], sw=3.4)
        s.chamada(xs + 2, yt + 26, xs + 60, yt - 34, 'impermeabilização', size=T_TXT)
    with s.campo('dreno_esp'):
        s.dim_h(xd0, xd1, yd - 18, 'e', ext_from=(yd, yd), size=T_TXT, halo=True)
    with s.campo('dreno_folga'):
        s.dim_v(xd1 + 26, yt, yd, 'folga', side=1, ext_from=(xd1, xd1), size=T_TXT, halo=True)
    # barbacã: 1ª fiada, caindo para fora
    yB = ye - 10 * K
    with s.campo('barbaca_on', 'barbaca_phi'):
        s.line(xd0 + 10, yB - 4, xw - 18, yB + 3, stroke=C['block'], sw=8)
        s.line(xd0 + 10, yB - 4, xw - 18, yB + 3, stroke=C['hollow'], sw=3.5)
    with s.campo('barbaca_phi'):
        s.chamada(xw - 14, yB + 3, xw - 50, yB - 60, 'barbacã Ø', size=T_TXT, anchor='end')
    s.text(xw - 100, ye - 120, 'face externa', size=T_PEQ, anchor='middle', color=C['note'])
    # ---------------- elevação (vista de fora) ----------------
    ex0, ey = 560, 520
    Lw, Hw = 240, 120                        # cm de muro mostrados
    s.text(ex0, 70 + 230, 'Elevação', size=T_TIT, anchor='start', weight='bold')
    X = lambda v: ex0 + v * K
    for i in range(int(Hw / 20)):
        y = ey - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xx = -off
        while xx < Lw:
            a = max(xx, 0); b = min(xx + 39, Lw)
            if b > a:
                s.rect(X(a), y, (b - a) * K, 19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.7)
            xx += 40
    s.rect(X(-10), ey, (Lw + 20) * K, 40, fill=s.CONC, stroke=C['line'], sw=1.2)
    s.line(X(-10), ey, X(Lw + 10), ey, stroke=C['soil'], sw=2)
    xb = [30, 30 + 150]
    with s.campo('barbaca_on', 'barbaca_phi'):
        for v in xb:
            s.circle(X(v), ey - 10 * K, 7, fill=C['hollow'], stroke=C['line'], sw=2)
    with s.campo('barbaca_s'):
        s.dim_h(X(xb[0]), X(xb[1]), ey - 10 * K - 34, 's', ext_from=(ey - 10 * K - 8, ey - 10 * K - 8), halo=True)
    return s
