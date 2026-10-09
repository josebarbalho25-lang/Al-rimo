# Fig. 16 (app, nova) — planta e elevação do muro com contrafortes: comprimento total, contraforte nas duas
# pontas (decisão do Jose, 08/10), eixo a eixo, largura de influência do contraforte de extremidade e do
# intermediário, junta de controle entre dois contrafortes encostados (muro e sapata cortados juntos).
# Esquema: não desenha bloco a bloco (a amarração muro × contraforte é da modulação; na família 14 ela
# ainda é provisória).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

K = 1.1          # px por cm
L_V = 150        # vão eixo a eixo (cm) — proporção do desenho
T_M = 14         # espessura do muro no desenho (cm)
E_C, TEN = 14, 50
BAL = 10         # eixo do contraforte de ponta até a ponta do muro (amarração em L)
JUNTA = 3        # abertura da junta (exagerada para aparecer)


def trechos():
    """(x0, x1, eixos) de cada trecho em cm: 3 vãos, junta, 2 vãos."""
    out = []
    x = 0
    for nv in (3, 2):
        eixos = [x + BAL + k * L_V for k in range(nv + 1)]
        x1 = eixos[-1] + BAL
        out.append((x, x1, eixos))
        x = x1 + JUNTA
    return out


def desenhar():
    s = Fig(16, 1000, 760)
    x0 = 80
    X = lambda v: x0 + v * K
    tr = trechos()
    Ltot = tr[-1][1]
    # ---------------- planta ----------------
    yw = 200                         # face aparente do muro (embaixo); solo para cima
    s.text(X(0), 52, 'Planta', size=T_TIT, anchor='start', weight='bold')
    s.rect(X(-10), yw - T_M * K - TEN * K - 30, (Ltot + 20) * K, TEN * K + 30, fill=s.SOLO, stroke='none')
    for xa, xb, eixos in tr:
        s.rect(X(xa), yw - T_M * K, (xb - xa) * K, T_M * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
        for xe in eixos:
            s.rect(X(xe - E_C / 2), yw - (T_M + TEN) * K, E_C * K, TEN * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
            s.line(X(xe), yw - (T_M + TEN) * K - 14, X(xe), yw + 30, stroke=C['dim'], sw=0.7, extra='stroke-dasharray="10,3,2,3"')
    e2 = tr[1][2]
    s.text(X((e2[0] + e2[1]) / 2), yw - T_M * K - 16, 'solo', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    # rótulos dos contrafortes: extremidade × intermediário
    e1 = tr[0][2]
    with s.campo('tipo_cf', 'bal_cf'):
        s.text(X(e1[0]) + 2, yw - (T_M + TEN) * K - 22, 'extremidade', size=T_PEQ, anchor='start', color=C['note'], halo=True)
    with s.campo('tipo_cf', 'l_cf'):
        s.text(X(e1[2]), yw - (T_M + TEN) * K - 22, 'intermediário', size=T_PEQ, color=C['note'], halo=True)
    # junta de controle
    xj = tr[0][1] + JUNTA / 2
    with s.campo('junta_cada'):
        s.line(X(xj), yw - (T_M + TEN) * K - 40, X(xj), yw + 14, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="6,4"')
        s.text(X(xj), yw - (T_M + TEN) * K - 48, 'junta de controle', size=T_PEQ, color=C['steel'], halo=True)
    # cotas sob a planta
    y1 = yw + 52
    mid1 = (e1[0] + e1[1]) / 2
    mid2, mid3 = (e1[1] + e1[2]) / 2, (e1[2] + e1[3]) / 2
    with s.campo('tipo_cf', 'bal_cf'):
        s.dim_h(X(0), X(mid1), y1, 'ℓ/2 + bal', ext_from=(yw, yw), size=T_TXT)
    with s.campo('tipo_cf'):
        s.dim_h(X(mid2), X(mid3), y1, 'ℓ', ext_from=(yw, yw), size=T_TXT)
    with s.campo('l_cf'):
        s.dim_h(X(e2[0]), X(e2[1]), y1, 'ℓ (eixo a eixo)', ext_from=(yw + 40, yw + 40))
    y3 = y1 + 46
    with s.campo('junta_cada'):
        s.dim_h(X(0), X(xj), y3, 'junta a cada', ext_from=(yw, yw + 14), size=T_TXT)
    y4 = y3 + 46
    with s.campo('L_total'):
        s.dim_h(X(0), X(Ltot), y4, 'L', ext_from=(yw, yw))
    # ---------------- elevação (vista de fora) ----------------
    ye = 670                         # topo da sapata
    H_S, H_M, H_SAP = 160, 180, 30   # solo, muro desenhado (fecha a fiada), sapata
    s.text(X(0), ye - H_M * K - 40, 'Elevação', size=T_TIT, anchor='start', weight='bold')
    for xa, xb, eixos in tr:
        s.rect(X(xa), ye, (xb - xa) * K, H_SAP * K, fill=s.CONC, stroke=C['line'], sw=1.2)
        s.rect(X(xa), ye - H_M * K, (xb - xa) * K, H_M * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
        for f in range(1, int(H_M / 20)):
            s.line(X(xa), ye - f * 20 * K, X(xb), ye - f * 20 * K, stroke=C['block'], sw=0.5)
        with s.campo('cinta_topo'):
            s.rect(X(xa), ye - H_M * K, (xb - xa) * K, 20 * K, fill=C['groutfill'], stroke=C['grout'], sw=1)
        for xe in eixos:     # contraforte enterrado: atrás do muro (linha oculta)
            s.rect(X(xe - E_C / 2), ye - H_M * K, E_C * K, H_M * K, stroke=C['line'], sw=1, extra='stroke-dasharray="5,4"')
    # topo do solo atrás do muro (oculto)
    s.line(X(0), ye - H_S * K, X(Ltot), ye - H_S * K, stroke=C['soil'], sw=1.6, extra='stroke-dasharray="12,5"')
    with s.campo('junta_cada'):
        s.line(X(xj), ye - H_M * K - 14, X(xj), ye + H_SAP * K + 14, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="6,4"')
    with s.campo('H_muro'):
        s.dim_v(X(Ltot) + 30, ye - H_S * K, ye, 'h', side=1, ext_from=(X(Ltot), X(Ltot)))
    return s
