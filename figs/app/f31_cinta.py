# Fig. 31 (app, 15/11) — A CINTA do muro de cima (aba Muro de cima e vento, seção 9): viga de concreto da altura de
# uma fiada, entre os pilaretes, no topo e/ou a meia altura.
#   - SEÇÃO com 2 barras (uma em cada face, no meio da altura) e com 4 (duas em cada face, em cima e embaixo), a
#     K_BLOCO (6 px/cm), o tijolo embaixo (e em cima, na de meia altura), as barras com o eixo a c das faces;
#   - as duas flexões que ela resiste, só pelas setas: o peso do painel de cima (de cima para baixo) e o vento (de
#     lado, vindo do aterro — à direita nos cortes).
from applib import Fig, C, K_BLOCO, T_SIM, T_PEQ

KP = K_BLOCO / 100
T, H = 11.5, 20          # cinta (cm)
CE = 3                   # eixo da barra à face (cm)
FB = 1.0                 # Ø desenhado


def secao(s, x0, y0, n, titulo, meia):
    t, h = T * KP, H * KP
    with s.campo('n_cin_mc'):
        s.titulo_vista(x0 - 30, y0 - 120, titulo)
    # tijolo embaixo (e em cima, na cinta de meia altura), cortado
    s.rect(x0, y0 + h, t, 60, fill=C['claro'], stroke=C['block'], sw=1)
    s.line(x0 - 6, y0 + h + 60, x0 + t + 6, y0 + h + 60, stroke=C['dim'], sw=1, extra='stroke-dasharray="5,4"')
    if meia:
        s.rect(x0, y0 - 60, t, 60, fill=C['claro'], stroke=C['block'], sw=1)
        s.line(x0 - 6, y0 - 60, x0 + t + 6, y0 - 60, stroke=C['dim'], sw=1, extra='stroke-dasharray="5,4"')
    with s.campo('cin_mc', 'fck_pil'):
        s.rect(x0, y0, t, h, fill=s.CONC, stroke=C['line'], sw=1.6)
    zs = (H / 2,) if n == 2 else (CE, H - CE)
    with s.campo('phi_cin_mc', 'n_cin_mc'):
        for z in zs:
            for xx in (CE, T - CE):
                s.circle(x0 + xx * KP, y0 + z * KP, FB / 2 * KP + 2)
    return t, h


def desenhar():
    s = Fig(31, 1000, 640)
    y0 = 260
    xa, xb = 200, 560
    t, h = secao(s, xa, y0, 2, '2 barras', False)
    secao(s, xb, y0, 4, '4 barras', True)
    # cotas na de 2 barras: t embaixo, h à esquerda, c (eixo à face) em cima
    s.dim_h(xa, xa + t, y0 + h + 92, 't_{mc}', ext_from=(y0 + h + 60, y0 + h + 60))
    s.dim_v(xa - 34, y0, y0 + h, 'h_{cin}', side=-1, ext_from=(xa, xa))
    s.dim_h(xa, xa + CE * KP, y0 - 18, '', ext_from=(y0, y0 + h / 2))
    s.text(xa - 8, y0 - 24, 'c', size=T_SIM, anchor='end', color=C['dim'])
    with s.campo('phi_cin_mc'):
        s.chamada(xa + t - CE * KP, y0 + h / 2, xa + t + 70, y0 + h / 2 + 40, 'φ_{cin}', size=T_SIM)
    # as duas flexões da cinta, na de 4 barras: o peso de cima e o vento do aterro
    xm = xb + t / 2
    s.arrow(xm, y0 - 110, xm, y0 - 66, color=C['load'], sw=2)
    s.text(xm + 10, y0 - 92, 'peso', size=T_PEQ, anchor='start', color=C['load'])
    s.arrow(xb + t + 70, y0 + h / 2, xb + t + 6, y0 + h / 2, color=C['water'], sw=2, marker='arrA')
    s.text(xb + t + 76, y0 + h / 2 + 6, 'vento', size=T_PEQ, anchor='start', color=C['water'])
    s.legenda(xa - 30, y0 + h + 160, [('concreto', 'cinta'), ('tijolo', 'muro de cima'), ('aco', 'aço')])
    return s
