# Fig. 16 (app, nova) — planta e elevação do muro com contrafortes: comprimento total, contraforte nas duas
# pontas (decisão do Jose, 08/10), eixo a eixo, largura de influência do contraforte de extremidade e do
# intermediário, junta de controle entre dois contrafortes encostados (muro e sapata cortados juntos).
# Esquema: não desenha bloco a bloco (a amarração muro × contraforte é da modulação; na família 14 ela
# ainda é provisória).
# Régua comum (12/10, applib):
#   - escala K_GERAL nas duas vistas (era 1,1 px/cm e a figura passava da moldura, 1110 × 711). Para caber em
#     1000 × 640 o muro desenhado tem 2 vãos + junta + 1 vão (antes 3 + 2) e 1,40 m de altura;
#   - a cota da altura media o SOLO (160) e não o muro (180): agora h_{muro} vai do topo da sapata ao topo do muro;
#   - o topo do solo (oculto, atrás do muro) fica no meio de uma fiada: na borda da canaleta ele sumia;
#   - junta pela junta() (cinza traço-ponto; vermelho é só aço); contraforte em planta é graute (azul);
#   - sem fórmula na figura: o "ℓ/2 + bal" virou duas cotas com os símbolos da memória — b_{al} (balanço na ponta)
#     e b_{inf} (largura de influência), e o eixo a eixo é ℓ_{cf};
#   - títulos pela titulo_vista(); a cota L subiu para cima da elevação, no vão que o título já ocupava.
from applib import Fig, C, T_TXT, T_SIM, K_GERAL

K = K_GERAL / 100        # px por cm
L_V = 150                # vão eixo a eixo (cm) — o mesmo ℓ_{cf} da Fig. 13
T_M = 14                 # espessura do muro no desenho (cm)
E_C, TEN = 14, 50        # contraforte: espessura e comprimento para dentro do solo (cm)
BAL = 10                 # eixo do contraforte de ponta até a ponta do muro (amarração em L)
JUNTA = 3                # abertura da junta (exagerada para aparecer)
VAOS = (2, 1)            # vãos de cada trecho entre juntas
H_M, H_S, H_SAP = 140, 110, 30   # muro (fecha a fiada), solo (meio de fiada) e sapata (cm)


def trechos():
    """(x0, x1, eixos) de cada trecho em cm."""
    out = []
    x = 0
    for nv in VAOS:
        eixos = [x + BAL + k * L_V for k in range(nv + 1)]
        x1 = eixos[-1] + BAL
        out.append((x, x1, eixos))
        x = x1 + JUNTA
    return out


def desenhar():
    s = Fig(16, 1000, 640)
    x0 = 100
    X = lambda v: x0 + v * K
    tr = trechos()
    Ltot = tr[-1][1]
    e1, e2 = tr[0][2], tr[1][2]
    xj = tr[0][1] + JUNTA / 2
    # ---------------- planta: face aparente embaixo, solo em cima ----------------
    yw = 154
    ycf = yw - (T_M + TEN) * K           # ponta dos contrafortes
    s.titulo_vista(X(0), 0, 'Planta')
    s.solo([(X(-6), ycf - 12), (X(Ltot + 6), ycf - 12), (X(Ltot + 6), yw - T_M * K), (X(-6), yw - T_M * K)])
    for xa, xb, eixos in tr:
        s.rect(X(xa), yw - T_M * K, (xb - xa) * K, T_M * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
        for xe in eixos:
            s.rect(X(xe - E_C / 2), ycf, E_C * K, TEN * K, fill=C['groutfill'], stroke=C['grout'], sw=1.2)
            s.line(X(xe), ycf - 8, X(xe), yw + 8, stroke=C['dim'], sw=0.7, extra='stroke-dasharray="10,3,2,3"')
    s.text(X((e2[0] + e2[1]) / 2), yw - T_M * K - 16, 'solo', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    yl = ycf - 20                        # rótulos acima das pontas dos contrafortes
    with s.campo('tipo_cf', 'bal_cf'):
        s.text(X(e1[0]), yl, 'extremidade', size=16, color=C['note'], halo=True)
    with s.campo('tipo_cf', 'l_cf'):
        s.text(X(e1[1]), yl, 'intermediário', size=16, color=C['note'], halo=True)
    with s.campo('junta_cada'):
        s.junta(X(xj), ycf - 12, yw + 12)
        s.text(X(xj), yl, 'junta', size=16, color=C['dim'], halo=True)
    # cotas sob a planta: 1ª linha balanço + eixo a eixo; 2ª linha as larguras de influência. O eixo a eixo fica
    # no 2º trecho: no 1º, as linhas de chamada das larguras de influência (no meio do vão) cortariam o rótulo dele
    yA = yw + 30
    with s.campo('bal_cf'):
        s.dim_h(X(0), X(e1[0]), yA, '', ext_from=(yw, yw))
        s.text(X(0) - 8, yA + 7, 'b_{al}', size=T_SIM, anchor='end', color=C['dim'])
    with s.campo('l_cf'):
        s.dim_h(X(e2[0]), X(e2[1]), yA, 'ℓ_{cf}', ext_from=(yw, yw))
    yB = yA + 38
    m01, m12 = (e1[0] + e1[1]) / 2, (e1[1] + e1[2]) / 2
    with s.campo('tipo_cf', 'bal_cf'):
        s.dim_h(X(0), X(m01), yB, 'b_{inf}', ext_from=(yw, yw))
    with s.campo('tipo_cf', 'l_cf'):
        s.dim_h(X(m01), X(m12), yB, 'b_{inf}', ext_from=(yw, yw))
    # ---------------- elevação (vista de fora) ----------------
    ytit = yB + 42
    ytop = ytit + 38                     # topo do muro
    ye = ytop + H_M * K                  # topo da sapata
    ysb = ye + H_SAP * K                 # base da sapata
    s.titulo_vista(X(0), ytit, 'Elevação')
    for xa, xb, eixos in tr:
        s.sapata(X(xa), ye, (xb - xa) / 100, H_SAP / 100)
        s.rect(X(xa), ytop, (xb - xa) * K, H_M * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
        for f in range(1, H_M // 20):
            s.line(X(xa), ye - f * 20 * K, X(xb), ye - f * 20 * K, stroke=C['block'], sw=0.5)
        with s.campo('cinta_topo'):
            s.rect(X(xa), ytop, (xb - xa) * K, 20 * K, fill=C['groutfill'], stroke=C['grout'], sw=1)
        for xe in eixos:     # contraforte enterrado: atrás do muro (linha oculta)
            s.rect(X(xe - E_C / 2), ytop, E_C * K, H_M * K, stroke=C['line'], sw=1, extra='stroke-dasharray="5,4"')
    # topo do solo atrás do muro (oculto)
    s.line(X(0), ye - H_S * K, X(Ltot), ye - H_S * K, stroke=C['soil'], sw=1.6, extra='stroke-dasharray="12,5"')
    with s.campo('junta_cada'):
        s.junta(X(xj), ytop - 12, ysb + 12)
    with s.campo('H_muro'):
        s.dim_v(X(Ltot) + 30, ytop, ye, 'h_{muro}', side=1, ext_from=(X(Ltot), X(Ltot)))
    with s.campo('L_total'):
        s.dim_h(X(0), X(Ltot), ytop - 16, 'L', ext_from=(ytop, ytop))
    with s.campo('junta_cada'):
        s.dim_h(X(0), X(xj), ysb + 30, 'junta a cada', ext_from=(ysb, ysb + 12), size=T_TXT)
    return s
