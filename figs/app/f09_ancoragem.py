# Fig. 9 (app) — ancoragem da espera na sapata e traspasse com a barra do muro. O quadro de fórmulas da
# planilha sai (é memória de cálculo, não figura); entra a cota do traspasse, que agora é entrada do modelo.
from applib import Fig, C, T_TXT, T_PEQ


def desenhar():
    s = Fig(9, 1000, 560)
    xw, yb = 400, 280          # face externa do muro / topo da sapata
    t = 76                     # 19 cm × 4 px
    with s.campo('fck_fund'):
        s.rect(xw - 220, yb, t + 440, 200, fill=s.CONC, stroke=C['line'], sw=1.4)
        s.text(xw - 150, yb + 182, 'sapata', size=T_TXT, color=C['note'], anchor='start')
        s.text(xw - 150, yb + 148, 'f_{ck}', size=20, color=C['line'], anchor='start')
    s.rect(xw, yb - 220, t, 220, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    s.rect(xw + 14, yb - 220, t - 28, 220, fill=C['groutfill'], stroke=C['grout'], sw=1)
    s.text(xw + t + 140, yb - 120, 'solo', size=T_TXT, color=C['soil'], weight='bold', anchor='start')
    s.text(xw - 30, yb - 120, 'face externa', size=T_TXT, color=C['note'], anchor='end')
    xe = xw + t - 22           # espera do lado do solo
    lb = 150
    s.pline([(xe, yb - 170), (xe, yb + lb)], stroke=C['steel'], sw=3.4)
    with s.campo('gancho_'):
        s.pline([(xe, yb + lb - 2), (xe, yb + lb), (xe + 72, yb + lb)], stroke=C['steel'], sw=3.4)
        s.text(xe + 84, yb + lb + 6, 'gancho', size=T_TXT, anchor='start', color=C['steel'])
    # barra do muro (traspasse com a espera)
    s.line(xe - 8, yb - 220, xe - 8, yb - 40, stroke=C['barra2'], sw=3.4)
    with s.campo('traspasse_dir'):
        s.dim_v(xe + 44, yb - 170, yb - 40, 'traspasse', side=1, ext_from=(xe, xe))
    with s.campo('zona_ad', 'fck_fund', 'gancho_'):
        s.dim_v(xw - 44, yb, yb + lb, 'ℓ_{b}', side=-1, ext_from=(xe, xe))
    s.line(xw - 220, yb, xw + t + 220, yb, stroke=C['line'], sw=1.4)
    # legenda
    ly = yb + 240
    s.line(xw - 220, ly - 6, xw - 190, ly - 6, stroke=C['steel'], sw=3.4)
    s.text(xw - 180, ly, 'espera', size=T_PEQ + 1, anchor='start')
    s.line(xw + 40, ly - 6, xw + 70, ly - 6, stroke=C['barra2'], sw=3.4)
    s.text(xw + 80, ly, 'barra do muro', size=T_PEQ + 1, anchor='start')
    return s
