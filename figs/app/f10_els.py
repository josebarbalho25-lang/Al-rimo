# Fig. 10 (app) — ELS do balanço: carga de serviço, flecha imediata e diferida, fissura na base. A coluna
# "Roteiro" da planilha (14 linhas) é passo a passo de cálculo: o lugar dela é a memória, não a figura.
# Ficam só as relações curtas que dizem o que cada entrada muda.
from applib import Fig, C, T_TXT, T_PEQ


def desenhar():
    s = Fig(10, 1000, 560)
    xw, yb, hp = 240, 470, 380
    s.rect(xw - 70, yb, 180, 32, fill=s.CONC, stroke=C['line'])
    s.rect(xw, yb - hp, 26, hp, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    # carga de serviço (empuxo)
    with s.campo('psi_els'):
        s.poly([(xw + 26, yb - hp), (xw + 38, yb - hp), (xw + 140, yb), (xw + 26, yb)], fill=C['empuxo'], stroke=C['load'], sw=1.2, extra='fill-opacity="0.55"')
        for i in range(1, 6):
            y = yb - hp + i * hp / 6
            s.arrow(xw + 36 + 102 * i / 6, y, xw + 29, y, sw=1.3)
    # deformadas: imediata e diferida (o balanço deflete para o lado de fora)
    def deformada(amp):
        return [(xw + 13 - amp * ((yb - y) / hp) ** 2 * (3 - (yb - y) / hp) / 2, y) for y in range(yb, yb - hp - 1, -10)]
    s.pline(deformada(45), stroke=C['load'], sw=2, extra='stroke-dasharray="7,5"')
    with s.campo('dxi'):
        s.pline(deformada(95), stroke=C['steel'], sw=2, extra='stroke-dasharray="3,4"')
        s.text(xw + 13 - 95 - 10, yb - hp - 34, 'δ_{∞}', size=20, anchor='middle', color=C['steel'])
    s.text(xw + 13 - 45 + 4, yb - hp - 34, 'δ_{0}', size=20, anchor='start', color=C['load'])
    with s.campo('vao_ref'):
        s.dim_v(xw + 190, yb - hp, yb, 'h', side=1, ext_from=(xw + 26, xw + 26))
    # fissura na base, face do solo, e a compressão do peso próprio
    with s.campo('sg_on'):
        s.line(xw + 12, yb - 2, xw + 26, yb - 2, stroke=C['steel'], sw=3)
        s.arrow(xw - 26, yb - 70, xw - 26, yb - 8, color=C['load'], sw=2)
        s.text(xw - 34, yb - 34, 'σ_{sg}', size=T_TXT, anchor='end', color=C['load'])
    # relações (rótulo curto)
    lx = 520
    with s.campo('psi_els'):
        s.text(lx, 100, 'M_{a} = (M_{a}/M_{k})·M_{k}', size=20, anchor='start', color=C['load'])
    with s.campo('vao_ref'):
        s.text(lx, 150, 'vão = h  ou  2h', size=20, anchor='start')
    with s.campo('div_adm', 'vao_ref'):
        s.text(lx, 200, 'δ_{adm} = vão / limite', size=20, anchor='start')
    with s.campo('dxi'):
        s.text(lx, 250, 'δ_{∞} = δ_{0}·(1 + Δξ) ≤ δ_{adm}', size=20, anchor='start')
    with s.campo('sg_on'):
        s.text(lx, 300, 'M_{r} = (f_{tk} + σ_{sg})·I/y_{t}', size=20, anchor='start')
    s.text(lx, 350, 'M_{a} > M_{r}  →  estádio II', size=20, anchor='start')
    return s
