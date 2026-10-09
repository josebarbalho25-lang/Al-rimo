# Fig. 8 (app) — tração na flexão da alvenaria, normal e paralela à fiada, e a tabela de ftk por
# argamassa (rótulo + valor de norma; é o que a entrada "Argamassa" escolhe). Sem ⊥ e ∥: não existem no
# Arial e cairiam em fonte de reserva. Faixas e ftk saem das células da planilha (Referências!L16:N18).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ
from tabelas import cel

K = 1.6


def parede(s, x0, y0, w, h):
    for i in range(int(h / 20)):
        y = y0 + h * K - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xs = -off
        while xs < w:
            a = max(xs, 0); b = min(xs + 39, w)
            if b > a:
                s.rect(x0 + a * K, y, (b - a) * K, 19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.8)
            xs += 40


def desenhar():
    s = Fig(8, 1000, 560)
    ya = 110
    # (a) normal à fiada
    xa = 80
    s.text(xa + 100 * K, 66, 'Tração normal à fiada', size=T_TIT, weight='bold')
    parede(s, xa, ya, 200, 120)
    yc = ya + 120 * K - 40 * K
    s.line(xa, yc, xa + 200 * K, yc, stroke=C['steel'], sw=3)
    s.arrow(xa + 100 * K, ya - 6, xa + 100 * K, ya - 40)
    s.arrow(xa + 100 * K, ya + 120 * K + 6, xa + 100 * K, ya + 120 * K + 40)
    s.text(xa + 100 * K, ya + 120 * K + 68, 'fissura na junta horizontal', size=T_TXT, color=C['steel'])
    # (b) paralela à fiada
    xb = 560
    s.text(xb + 100 * K, 66, 'Tração paralela à fiada', size=T_TIT, weight='bold')
    parede(s, xb, ya, 200, 120)
    pts = []; x = xb + 100 * K; y = ya
    for i in range(6):
        pts += [(x, y), (x, y + 20 * K)]
        y += 20 * K; x += (20 * K if i % 2 == 0 else -20 * K)
    s.pline(pts, stroke=C['steel'], sw=3)
    s.arrow(xb - 6, ya + 60 * K, xb - 40, ya + 60 * K)
    s.arrow(xb + 200 * K + 6, ya + 60 * K, xb + 200 * K + 40, ya + 60 * K)
    s.text(xb + 100 * K, ya + 120 * K + 68, 'fissura em escada pelas juntas', size=T_TXT, color=C['steel'])
    # tabela ftk
    with s.campo('arg_cls'):
        ty = 470
        col = [300, 520, 740]
        s.text(80, ty, 'argamassa', size=T_TXT, anchor='start', weight='bold')
        for j in range(3):
            s.text(col[j] + 90, ty, cel(f'Referências!L{16 + j}'), size=T_TXT, weight='bold')
        s.line(80, ty + 10, 920, ty + 10, stroke=C['cinza2'], sw=1)
        s.text(80, ty + 36, 'f_{tk} normal (MPa)', size=T_TXT, anchor='start')
        s.text(80, ty + 64, 'f_{tk} paralela (MPa)', size=T_TXT, anchor='start')
        for j in range(3):
            s.text(col[j] + 90, ty + 36, cel(f'Referências!M{16 + j}', casas=2), size=T_TXT)
            s.text(col[j] + 90, ty + 64, cel(f'Referências!N{16 + j}', casas=2), size=T_TXT)
    return s
