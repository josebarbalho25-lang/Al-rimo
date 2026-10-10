# Fig. 24 (app) — tombamento e deslizamento da sapata corrida, no traço da Fig. 1.116 do Bastos (UNESP,
# Sapatas de Fundação, §1.8). Dois painéis lado a lado: momentos em torno do pé e forças horizontais.
# Desenho de linha (contorno preto, sem hachura), como no Bastos; o solo sobre o talão vai tracejado.
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

S = 115.0
B, A, TM, HS, HM = 1.40, 0.95, 0.19, 0.30, 1.60
K = C['line']


def _painel(s, x0, yb, tomb):
    X = lambda v: x0 + v * S
    Y = lambda v: yb - v * S
    Ht = HS + HM
    s.pline([(X(A - TM / 2), Y(Ht)), (X(A - TM / 2), Y(HS)), (X(0), Y(HS)), (X(0), Y(0)), (X(B), Y(0)), (X(B), Y(HS)),
             (X(A + TM / 2), Y(HS)), (X(A + TM / 2), Y(Ht))], stroke=K, sw=2.4)
    s.line(X(A - TM / 2) - 6, Y(Ht), X(A + TM / 2) + 6, Y(Ht), stroke=K, sw=1.4)
    s.poly([(X(0), Y(HS)), (X(A - TM / 2), Y(HS)), (X(A - TM / 2), Y(Ht)), (X(0), Y(Ht))], stroke=C['soil'], sw=1.1,
           extra='stroke-dasharray="6,4"')
    s.text(X((A - TM / 2) / 2), Y(HS + HM * 0.82), 'solo', size=T_PEQ, color=C['soil'])

    def vert(xv, ytop, ybot, lab):
        s.arrow(xv, ytop, xv, ybot, color=K, sw=2, marker='arr')
        s.text(xv + 8, ytop + 18, lab, size=T_TXT + 2, anchor='start', color=K)
    vert(X(A), Y(Ht) - 52, Y(Ht) - 3, 'P_{muro}')
    vert(X((A - TM / 2) / 2), Y(HS + HM * 0.55), Y(HS + 0.05), 'P_{solo}')
    vert(X(B / 2 + 0.05), Y(HS) + 4, Y(0.04), 'P_{sap}')
    with s.campo('q_est'):
        for k in range(4):
            xx = X(0.06 + k * 0.22)
            s.arrow(xx, Y(Ht) - 34, xx, Y(Ht) - 3, sw=1.3)
        s.text(X(0) - 6, Y(Ht) - 26, 'q', size=T_TXT + 3, anchor='end', color=C['load'], weight='bold')
    px = X(0) - 10
    s.poly([(px, Y(Ht)), (px - 70, Y(0)), (px, Y(0))], stroke=C['load'], sw=1.1, extra='stroke-dasharray="5,3"')
    s.arrow(px - 115, Y(Ht / 3), px - 2, Y(Ht / 3), color=K, sw=2.4, marker='arr')
    s.text(px - 115, Y(Ht / 3) - 10, 'E_{a}', size=T_TXT + 3, anchor='start', color=K)
    s.dim_v(px - 135, Y(Ht / 3), Y(0), '(H + h)/3', side=-1, ext_from=(px - 115, X(0)), size=T_PEQ)
    if tomb:
        with s.campo('FS_tomb'):
            s.circle(X(B), Y(0), 6, fill=K)
            s.text(X(B) + 12, Y(0) + 7, '1', size=T_TIT, anchor='start', color=K, weight='bold')
        yy = Y(0) + 42
        for xv, lab, dy in ((A, 'b_{muro}', 0), ((A - TM / 2) / 2, 'b_{solo}', 32), (B / 2 + 0.05, 'b_{sap}', 64)):
            s.line(X(xv), Y(0) + 4, X(xv), yy + dy + 5, stroke=C['dim'], sw=0.6, extra='stroke-dasharray="2,2"')
            s.dim_h(X(xv), X(B), yy + dy, lab, size=T_PEQ, off_text=-5)
        s.line(X(B), Y(0) + 6, X(B), yy + 70, stroke=C['dim'], sw=0.6)
        with s.campo('B_sap'):
            s.dim_h(X(0), X(B), yy + 102, 'B', off_text=-6)
        with s.campo('h_sap'):
            s.dim_v(X(B) + 44, Y(HS), Y(0), 'h', side=1, ext_from=(X(B), X(B)))
        s.text(X(B / 2) - 60, yy + 150, 'Tombamento (em torno de 1)', size=T_TIT, color=K, weight='bold')
    else:
        with s.campo('dphi', 'FS_desl'):
            for k in range(5):
                xx = X(0.12 + k * 0.28)
                s.arrow(xx, Y(0) + 11, xx + 28, Y(0) + 11, color=K, sw=1.4, marker='arr')
            s.text(X(B / 2), Y(0) + 40, 'N·tg δ', size=T_TXT + 1, color=K)
        with s.campo('ades_b'):
            s.text(X(B / 2), Y(0) + 64, '+ adesão·B', size=T_TXT, color=K)
        with s.campo('pass_on'):
            s.poly([(X(B) + 4, Y(HS)), (X(B) + 4, Y(0)), (X(B) + 50, Y(0))], fill=C['passivo_fill'], stroke=C['passivo'], sw=1.1,
                   extra='stroke-dasharray="5,3"')
            s.arrow(X(B) + 135, Y(HS / 3), X(B) + 6, Y(HS / 3), color=C['passivo'], sw=2, marker='arrP')
            s.text(X(B) + 140, Y(HS / 3) - 8, 'E_{p} ÷ 2,0', size=T_TXT + 2, anchor='start', color=C['passivo_txt'])
            s.text(X(B) + 140, Y(HS / 3) + 16, 'opcional', size=T_PEQ, anchor='start', color=C['passivo_txt'])
        s.text(X(B / 2) - 60, Y(0) + 150 + 42, 'Deslizamento', size=T_TIT, color=K, weight='bold')


def desenhar():
    s = Fig(24, 1200, 700)
    _painel(s, 200, 380, True)
    _painel(s, 780, 380, False)
    s.line(640, 90, 640, 600, stroke=C['cinza2'], sw=1)
    return s
