# Fig. 18 (app, nova) — armadura da sapata corrida, corte junto a um contraforte: Ø principal transversal
# nas duas faces (a de cima só quando o talão pede — nota da aba Fundação: "mesma armadura nas duas faces se
# os dois balanços pedirem"), Ø secundária longitudinal, estribo fechado de torção (só com contrafortes),
# cobrimento. O trecho ao longo do muro em que vai o estribo de torção ainda não está definido (pergunta
# Q11 da modulação), por isso a figura não mostra planta.
from applib import Fig, C, T_TXT, T_PEQ

S = 400.0                          # px por metro
B, HS, A, TM, BD, HD = 1.4, 0.30, 0.95, 0.19, 0.25, 0.30


def desenhar():
    s = Fig(18, 1000, 560)
    x0, yt = 120, 260              # borda aterrada; topo da sapata
    X = lambda v: x0 + v * S
    Y = lambda v: yt + v * S       # v para baixo
    s.rect(X(0), Y(0), B * S, HS * S, fill=s.CONC, stroke=C['line'], sw=1.6)
    s.rect(X(B / 2 - BD / 2), Y(HS), BD * S, HD * S, fill=s.CONC, stroke=C['line'], sw=1.6)
    # muro (cortado) com a espera
    s.rect(X(A - TM / 2), Y(0) - 150, TM * S, 150, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.line(X(A - TM / 2) - 10, Y(0) - 150, X(A + TM / 2) + 10, Y(0) - 150, stroke=C['line'], sw=1, extra='stroke-dasharray="4,4"')
    xe = X(A - TM / 2 + 0.05)          # do lado do solo, como na Fig. 4
    s.pline([(xe, Y(0) - 140), (xe, Y(HS) - 52), (xe - 60, Y(HS) - 52)], stroke=C['barra2'], sw=3)
    c, ft, fp = 0.05, 0.010, 0.0125     # cobrimento, Ø torção, Ø principal (proporção do desenho)
    # estribo de torção (mais externo)
    with s.campo('phi_tor'):
        s.rect(X(c), Y(c), (B - 2 * c) * S, (HS - 2 * c) * S, stroke=C['steel'], sw=2.4, extra='rx="6" stroke-dasharray="10,5"')
    # principal transversal: face de baixo e face de cima
    yi = Y(HS - c - ft - fp / 2)
    ys = Y(c + ft + fp / 2)
    with s.campo('phi_sap'):
        s.pline([(X(c + ft) + 6, ys + 26), (X(c + ft) + 6, yi), (X(B - c - ft) - 6, yi), (X(B - c - ft) - 6, ys + 26)], stroke=C['steel'], sw=3.4)
        s.pline([(X(c + ft) + 12, yi - 26), (X(c + ft) + 12, ys), (X(B - c - ft) - 12, ys), (X(B - c - ft) - 12, yi - 26)], stroke=C['steel'], sw=3.4)
    # secundária longitudinal (pontos), apoiada na principal
    with s.campo('phi_sap2'):
        n = 9
        for k in range(n):
            xx = X(c + ft) + 30 + k * ((B - 2 * c - 2 * ft) * S - 60) / (n - 1)
            s.circle(xx, yi - 7, 5)
            s.circle(xx, ys + 7, 5)
    # cobrimento
    with s.campo('cob_sap'):
        s.dim_v(X(0) - 26, Y(HS - c), Y(HS), 'c', side=-1, ext_from=(X(c), X(0)), size=T_TXT)
        s.dim_v(X(0) - 26, Y(0), Y(c), 'c', side=-1, ext_from=(X(c), X(0)), size=T_TXT)
    # rótulos
    xr = X(B) + 40
    with s.campo('phi_sap'):
        s.chamada(X(1.30), yi, xr, Y(HS) + 30, 'Ø principal (transversal)', color=C['steel'])
    with s.campo('phi_sap2'):
        s.chamada(X(c + ft) + 30 + 6 * ((B - 2 * c - 2 * ft) * S - 60) / 8, yi - 7, xr, Y(HS) + 62, 'Ø secundária (longitudinal)', color=C['steel'])
    with s.campo('phi_tor'):
        s.chamada(X(B - c), Y(0.12), xr, Y(0.12) + 6, 'estribo de torção (contrafortes)', color=C['steel'])
    s.text(X(A + TM / 2) + 14, Y(0) - 110, 'espera', size=T_PEQ, anchor='start', color=C['note'])
    s.text(X(0) + 6, Y(0) - 14, 'solo', size=T_PEQ + 1, anchor='start', color=C['soil'], weight='bold')
    s.text(X(B) - 6, Y(0) - 14, 'face externa', size=T_PEQ, anchor='end', color=C['note'])
    s.dim_h(X(0), X(B), Y(HS + HD) + 40, 'B')
    return s
