# Fig. 18 (app, nova) — armadura da sapata corrida, corte junto a um contraforte: Ø principal transversal
# nas duas faces (a de cima só quando o talão pede — nota da aba Fundação: "mesma armadura nas duas faces se
# os dois balanços pedirem"), Ø secundária longitudinal, estribo fechado de torção (só com contrafortes),
# cobrimento. O trecho ao longo do muro em que vai o estribo de torção ainda não está definido (pergunta
# Q11 da modulação), por isso a figura não mostra planta.
# Régua comum (12/10, applib): detalhe em K_DETALHE; solo à DIREITA (antes à esquerda) — o talão fica sob o
# aterro —; parede, sapata e espera pelas peças padrão. A espera passou a vermelha e a barra do muro a rosa, como
# na Fig. 9 (vermelho é o aço que a figura trata). Os rótulos em prosa ("Ø principal (transversal)"...) viraram os
# símbolos da memória (φ_s, φ_s2, φ_t, c_s), com a legenda da applib para espera e barra do muro.
from applib import Fig, C, T_SIM, K_DETALHE as K

B, HS, A, TM, BD, HD = 1.4, 0.30, 0.95, 0.19, 0.25, 0.30
HP = 0.42                          # trecho de parede mostrado acima da sapata (m)
C_S, FT, FP = 0.05, 0.010, 0.0125  # cobrimento, Ø torção, Ø principal (m, proporção do desenho)


def interrupcao(s, x0, x1, y):
    """Linha de interrupção (zigue-zague) no alto da parede: o muro continua para cima. A faixa branca por cima
    apaga a aresta do retângulo da parede acima do corte (sem ela, o retângulo se lê como o topo do muro)."""
    xm = (x0 + x1) / 2
    zz = [(x0, y), (xm - 9, y), (xm - 4, y - 10), (xm + 4, y + 10), (xm + 9, y), (x1, y)]
    s.poly(zz + [(x1, y - 16), (x0, y - 16)], fill=C['hollow'], stroke='none')
    s.pline(zz, stroke=C['line'], sw=1)


def desenhar():
    s = Fig(18, 1000, 640)
    x0, yt = 150, 270              # borda da frente (ponta); topo da sapata
    X = lambda v: x0 + v * K
    Y = lambda v: yt + v * K       # v para baixo
    xw0 = B - A - TM / 2           # a é medido da borda aterrada (direita) ao eixo do muro
    xw1 = xw0 + TM
    ycut = Y(0) - HP * K
    # aterro sobre o talão (à direita da parede): é o que diz de que lado está o solo neste detalhe
    s.solo([(X(xw1), Y(0)), (X(B), Y(0)), (X(B), ycut), (X(xw1), ycut)])
    s.sapata(X(0), Y(0), B, HS, K=K)
    s.sapata(X(B / 2 - BD / 2), Y(HS), BD, HD, K=K)
    # parede com a espera (gancho para o lado do solo, logo acima da camada de baixo — desenhado SOBRE as barras
    # de baixo, sumiria nelas) e a barra do muro em rosa AO LADO da espera, parando antes da sapata, como na Fig. 9.
    # A barra da parede() corre na mesma linha da espera até o pé: com as duas juntas se leria uma barra só que
    # muda de cor — por isso a rosa fica à mão, 9 px para dentro.
    s.parede(X(xw0), Y(0), TM, HP + 0.03, K=K, barra=False, espera=0.19)
    xe = X(xw1 - 0.05)
    s.line(xe - 9, ycut, xe - 9, Y(0) - 8, stroke=C['barra2'], sw=2.6)
    interrupcao(s, X(xw0) - 14, X(xw1) + 14, ycut)
    # estribo de torção (mais externo), tracejado: só existe com contrafortes
    with s.campo('phi_tor'):
        s.rect(X(C_S), Y(C_S), (B - 2 * C_S) * K, (HS - 2 * C_S) * K, stroke=C['steel'], sw=2.4,
               extra='rx="6" stroke-dasharray="10,5"')
    # principal transversal: face de baixo e face de cima, com as pernas dobradas
    yi = Y(HS - C_S - FT - FP / 2)
    ys = Y(C_S + FT + FP / 2)
    xi0, xi1 = X(C_S + FT) + 6, X(B - C_S - FT) - 6
    with s.campo('phi_sap'):
        s.pline([(xi0, ys + 26), (xi0, yi), (xi1, yi), (xi1, ys + 26)], stroke=C['steel'], sw=3.4)
        s.pline([(xi0 + 6, yi - 26), (xi0 + 6, ys), (xi1 - 6, ys), (xi1 - 6, yi - 26)], stroke=C['steel'], sw=3.4)
    # secundária longitudinal (pontos), apoiada na principal
    n = 9
    xsec = [X(C_S + FT) + 30 + k * ((B - 2 * C_S - 2 * FT) * K - 60) / (n - 1) for k in range(n)]
    with s.campo('phi_sap2'):
        for xx in xsec:
            s.circle(xx, yi - 7, 5)
            s.circle(xx, ys + 7, 5)
    # cobrimento, nas duas faces, do lado da frente
    with s.campo('cob_sap'):
        s.dim_v(X(0) - 26, Y(0), Y(C_S), 'c_{s}', side=-1, ext_from=(X(C_S), X(0)))
        s.dim_v(X(0) - 26, Y(HS - C_S), Y(HS), 'c_{s}', side=-1, ext_from=(X(C_S), X(0)))
    # símbolos com chamada, do lado de fora da sapata (embaixo, pela frente do dente)
    with s.campo('phi_sap'):
        s.chamada(X(0.22), yi, X(0.30), Y(HS) + 46, 'φ_{s}', size=T_SIM, anchor='end')
    with s.campo('phi_sap2'):
        s.chamada(xsec[2], yi - 7, X(0.40), Y(HS) + 82, 'φ_{s2}', size=T_SIM, anchor='end')
    with s.campo('phi_tor'):
        s.chamada(X(B - C_S), Y(0.20), X(B) + 40, Y(0.20) + 34, 'φ_{t}', size=T_SIM)
    s.dim_h(X(0), X(B), Y(HS + HD) + 44, 'B', ext_from=(Y(HS), Y(HS)))
    s.legenda(X(0), Y(HS + HD) + 96, [('aco', 'espera'), ('aco2', 'barra do muro')])
    return s
