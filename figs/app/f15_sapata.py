# Fig. 15 (app) — sapata corrida: corte perpendicular ao muro com todas as entradas da fundação.
# Acrescenta o que faltava na fig15 da planilha (cotas de h da sapata e do dente, a carga P no topo, δ e SPT
# na base) e tira a coluna "Verificações" (é memória de cálculo). As três posições da sapata ficam, sem a
# citação de quem fez o roteiro.
import math
from applib import Fig, C, T_TXT, T_PEQ

S = 150.0                                   # px por metro
B, A, TM, HS, HM, BD, HD = 1.4, 0.95, 0.19, 0.30, 1.6, 0.25, 0.5


def desenhar():
    s = Fig(15, 1000, 760)
    x0, yb = 330, 520                       # x0 = borda aterrada; yb = base da sapata
    X = lambda v: x0 + v * S
    Y = lambda v: yb - v * S
    # terreno
    # um polígono só (a sapata e o dente são pintados por cima): retângulos com a mesma hachura deixam
    # costura visível nas emendas
    s.poly([(X(-0.9), Y(HS + HM)), (X(A - TM / 2), Y(HS + HM)), (X(A - TM / 2), Y(HS)), (X(B + 0.85), Y(HS)),
            (X(B + 0.85), Y(-0.8)), (X(-0.9), Y(-0.8))], fill=s.SOLO, stroke='none')
    s.line(X(-0.9), Y(HS + HM), X(A - TM / 2), Y(HS + HM), stroke=C['soil'], sw=2)
    s.line(X(A + TM / 2), Y(HS), X(B + 0.85), Y(HS), stroke=C['soil'], sw=2)
    s.text(X(0.42), Y(HS + HM / 2) + 30, 'solo', size=20, color=C['soil'], weight='bold', halo=True)
    # sapata + dente
    with s.campo('gama_c'):
        s.rect(X(0), Y(HS), B * S, HS * S, fill=s.CONC, stroke=C['line'], sw=1.4)
        s.rect(X(B / 2 - BD / 2), Y(0), BD * S, HD * S, fill=s.CONC, stroke=C['line'], sw=1.4)
        s.text(X(0.22), Y(HS / 2) + 7, 'γ_{c}', size=20, color=C['line'])
    # muro
    s.rect(X(A - TM / 2), Y(HS + HM), TM * S, HM * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.line(X(A), Y(HS + HM) - 120, X(A), Y(0) + 10, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="6,3"')
    s.text(X(A) + 6, Y(HS + HM) - 104, 'eixo', size=T_PEQ, anchor='start', color=C['dim'])
    # carga no topo
    with s.campo('P_topo'):
        s.arrow(X(A), Y(HS + HM) - 70, X(A), Y(HS + HM) - 4, sw=2.6)
        s.text(X(A) - 10, Y(HS + HM) - 44, 'P', size=22, anchor='end', color=C['load'], weight='bold')
    # sobrecarga sobre o talão e o aterro
    with s.campo('q_est', 'q_sobre'):
        for k in range(7):
            xx = -0.8 + k * 0.27
            if xx < A - TM / 2 - 0.06:
                s.arrow(X(xx), Y(HS + HM) - 40, X(xx), Y(HS + HM) - 4, sw=1.4)
        s.line(X(-0.8), Y(HS + HM) - 40, X(A - TM / 2 - 0.12), Y(HS + HM) - 40, stroke=C['load'], sw=1.4)
        s.text(X(-0.8) - 10, Y(HS + HM) - 30, 'q', size=22, anchor='end', color=C['load'], weight='bold')
    # empuxo até a base da sapata, no plano vertical da borda aterrada (é nele que a conta aplica o empuxo; o
    # solo sobre o talão entra como peso). A fig. 15 da planilha desenhava o diagrama solto, fora desse plano.
    px = X(0)
    s.poly([(px, Y(HS + HM)), (px - 18, Y(HS + HM)), (px - 120, Y(0)), (px, Y(0))], fill=C['empuxo2'], stroke=C['load'], sw=1.2, extra='fill-opacity="0.8"')
    for k in range(1, 6):
        yy = (HS + HM) * k / 6
        w = 18 + 102 * (1 - yy / (HS + HM))
        s.arrow(px - w, Y(yy), px - 3, Y(yy), sw=1.2)
    # passivo na frente
    with s.campo('pass_on'):
        s.poly([(X(B), Y(HS)), (X(B), Y(-HD)), (X(B) + 62, Y(-HD))], fill=C['passivo_fill'], stroke=C['passivo'], sw=1.2)
        for k in (0.35, 0.65, 0.9):
            yy = HS - k * (HS + HD)
            s.arrow(X(B) + 62 * k, Y(yy), X(B) + 3, Y(yy), color=C['passivo'], sw=1.2, marker='arrP')
        s.text(X(B) + 44, Y(0) - 14, 'E_{p}', size=20, anchor='start', color=C['passivo_txt'], weight='bold', halo=True)
    # base: atrito e adesão (resistem ao deslizamento, para o lado do solo)
    yf = Y(0) + 26
    with s.campo('dphi', 'phi_base', 'ades_b', 'FS_desl'):
        s.arrow(X(B / 2 - BD / 2) - 8, yf, X(0.08), yf, color=C['passivo'], sw=2.2, marker='arrP')
    with s.campo('dphi', 'phi_base'):
        s.text(X(0.33), yf + 26, 'N·tg δ', size=T_TXT, color=C['passivo_txt'], halo=True)
    with s.campo('ades_b'):
        s.text(X(0.33), yf + 50, '+ adesão', size=T_TXT, color=C['passivo_txt'], halo=True)
    with s.campo('FS_desl'):
        s.text(X(0.08) - 8, yf + 6, 'FS_{desl}', size=T_TXT, anchor='end', color=C['passivo_txt'], weight='bold', halo=True)
    # solo de apoio
    with s.campo('phi_base'):
        s.text(X(-0.45), Y(0) + 70, 'φ\'', size=20, color=C['soil'], halo=True)
    with s.campo('SPT_b'):
        s.text(X(-0.45), Y(0) + 102, 'SPT', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    # tombamento: giro horário em torno do pé, desenhado por baixo e à direita (fora do passivo)
    with s.campo('FS_tomb'):
        cxp, cyp, r = X(B), Y(0), 105
        a0, a1 = math.radians(14), math.radians(72)
        p0 = (cxp + r * math.cos(a0), cyp + r * math.sin(a0))
        p1 = (cxp + r * math.cos(a1), cyp + r * math.sin(a1))
        s.path(f'M{p0[0]:.1f},{p0[1]:.1f} A{r},{r} 0 0 1 {p1[0]:.1f},{p1[1]:.1f}', [p0, p1, (cxp + r * 0.7, cyp + r * 0.7)],
               stroke=C['load'], sw=2.2, extra=f'marker-end="{s.u("arrL")}"')
        s.circle(cxp, cyp, 4, fill=C['load'])
        s.text(cxp + r * 0.75 + 8, cyp + r * 0.75 + 12, 'FS_{tomb}', size=T_TXT, anchor='start', color=C['load'], weight='bold', halo=True)
    # pressões no solo
    with s.campo('sig_adm_dir'):
        yp = Y(0) + 150
        s.poly([(X(0), yp), (X(B), yp), (X(B), yp + 50), (X(0), yp + 16)], fill=C['pressao'], stroke=C['grout'], sw=1.0)
        s.text(X(B) + 10, yp + 44, 'σ_{máx} ≤ σ_{adm}', size=T_TXT, anchor='start', color=C['grout'])
    # cotas
    with s.campo('a_ater'):
        s.dim_h(X(0), X(A), Y(HS + HM) - 120, 'a', ext_from=(Y(HS), Y(HS + HM) - 120))
    with s.campo('B_sap'):
        s.dim_h(X(0), X(B), yp + 92, 'B', ext_from=(Y(0), Y(0)))
    with s.campo('h_sap'):
        s.dim_v(X(B) + 0.85 * S + 26, Y(HS), Y(0), 'h_{s}', side=1, ext_from=(X(B + 0.85), X(B + 0.85)), size=T_TXT)
    with s.campo('b_den'):
        s.dim_h(X(B / 2 - BD / 2), X(B / 2 + BD / 2), Y(-HD) + 26, 'b_{d}', ext_from=(Y(-HD), Y(-HD)), size=T_TXT, halo=True)
    with s.campo('h_den'):
        s.dim_v(X(B / 2 + BD / 2) + 22, Y(0), Y(-HD), 'h_{d}', side=1, ext_from=(X(B / 2 + BD / 2), X(B / 2 + BD / 2)), size=T_TXT, halo=True)
    s.text(X((A - TM / 2) / 2), Y(HS) - 10, 'talão', size=T_PEQ, color=C['note'], halo=True)
    s.text(X((A + TM / 2 + B) / 2), Y(HS) - 10, 'ponta', size=T_PEQ, color=C['note'], halo=True)
    # posição da sapata (três casos)
    with s.campo('a_ater'):
        mx = X(B) + 0.85 * S + 110
        for i, (aa, lab) in enumerate(((0.095, 'toda para fora'), (0.7, 'mista'), (1.305, 'toda sob o aterro'))):
            my = 130 + i * 175
            sc = 42
            s.rect(mx - 0.5 * sc, my, (aa - 0.095 + 0.5) * sc, 1.3 * sc, fill=s.SOLO, stroke='none')
            s.rect(mx, my + 1.3 * sc, 1.4 * sc, 0.3 * sc, fill=s.CONC, stroke=C['line'], sw=1)
            s.rect(mx + (aa - 0.095) * sc, my, 0.19 * sc, 1.3 * sc, fill=C['blockfill'], stroke=C['block'], sw=1)
            s.text(mx + 0.45 * sc, my + 1.6 * sc + 26, lab, size=T_PEQ + 1)
    return s
