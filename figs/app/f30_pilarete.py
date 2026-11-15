# Fig. 30 (app, 15/11) — O PILARETE do muro de cima (Jose, 13/11: "esses pilares precisam engastar e ter armadura
# contínua com o muro, adentrando no graute").
#   - PLANTA do pilarete de concreto (K_BLOCO, 6 px/cm): b ao longo do muro, h na direção do vento (o vento vem do
#     aterro, em cima nas plantas), as barras em cada face perpendicular ao vento, o estribo com os ganchos de 135°
#     num canto, o cobrimento, e o tijolo do muro de cima dos dois lados;
#   - PLANTA do pilarete de bloco grauteado (mesma escala): as paredes do bloco e o furo cheio de graute com as barras,
#     sem estribo (como o contraforte de bloco);
#   - ELEVAÇÃO da ligação (K_DETALHE, com interrupção em cima): as barras descem ℓ0t no graute do arrimo (no balanço,
#     nos furos do bloco; com contrafortes, na haste) e o estribo a cada s_est no trecho de concreto.
from applib import Fig, C, K_BLOCO, K_DETALHE, T_SIM

KP = K_BLOCO / 100        # px por cm na planta
BP, HP = 20, 25           # pilarete desenhado (cm)
CP = 2.5                  # cobrimento até o estribo (cm)
FE, FL = 0.5, 1.0         # Ø do estribo e da barra (cm)
TM = 11.5                 # tijolo


def tijolo_dos_lados(s, x0, y0, b, h):
    """O muro de cima dos dois lados do pilarete (centrado na altura), cortado em zigue-zague."""
    t = TM * KP
    yc = y0 + h / 2
    for xa, xb in ((x0 - 70, x0), (x0 + b, x0 + b + 70)):
        s.rect(xa, yc - t / 2, xb - xa, t, fill=C['claro'], stroke=C['block'], sw=1)
    for xq in (x0 - 70, x0 + b + 70):
        s.line(xq, yc - t / 2 - 6, xq, yc + t / 2 + 6, stroke=C['dim'], sw=1, extra='stroke-dasharray="5,4"')


def planta_concreto(s, x0, y0):
    b, h = BP * KP, HP * KP
    s.titulo_vista(x0 - 70, y0 - 66, 'Concreto moldado')
    tijolo_dos_lados(s, x0, y0, b, h)
    with s.campo('pil_tipo', 'fck_pil'):
        s.rect(x0, y0, b, h, fill=s.CONC, stroke=C['line'], sw=1.6)
    # estribo: retângulo no eixo, a c + Øe/2 da face, ganchos de 135° no canto de cima à esquerda
    ce = (CP + FE / 2) * KP
    with s.campo('phi_est_pil'):
        s.rect(x0 + ce, y0 + ce, b - 2 * ce, h - 2 * ce, stroke=C['steel'], sw=2.4, extra='rx="5"')
        g = 16
        s.line(x0 + ce + 2, y0 + ce + 2, x0 + ce + 2 + g, y0 + ce + 2 + g, stroke=C['steel'], sw=2.4)
        s.line(x0 + ce + 8, y0 + ce - 1, x0 + ce + 8 + g, y0 + ce - 1 + g, stroke=C['steel'], sw=2.4)
    # barras: duas em cada face perpendicular ao vento (em cima e embaixo), por dentro do estribo
    cb = (CP + FE + FL / 2) * KP
    xs = (x0 + cb, x0 + b - cb)
    with s.campo('phi_pil', 'n_pil'):
        for yy in (y0 + cb, y0 + h - cb):
            for xx in xs:
                s.circle(xx, yy, FL / 2 * KP + 1.5)
    # cotas: b embaixo, h à esquerda, c à direita
    with s.campo('b_pil'):
        s.dim_h(x0, x0 + b, y0 + h + 34, 'b_{pil}', off_text=26, ext_from=(y0 + h, y0 + h))
    with s.campo('hs_pil'):
        s.dim_v(x0 - 90, y0, y0 + h, 'h_{pil}', side=-1, ext_from=(x0 - 70, x0 - 70))
    # o cobrimento no canto de cima à esquerda (à direita ficam as chamadas das barras)
    with s.campo('c_pil'):
        s.dim_h(x0, x0 + CP * KP, y0 - 16, '', ext_from=(y0, y0 + ce))
        s.text(x0 - 8, y0 - 22, 'c_{pil}', size=T_SIM, anchor='end', color=C['dim'])
    # chamadas à direita
    xr = x0 + b + 96
    with s.campo('phi_pil'):
        s.chamada(xs[1], y0 + cb, xr, y0 - 14, 'φ_{pil}', size=T_SIM)
    with s.campo('n_pil'):
        # as barras de uma face: uma chave sobre as duas de baixo
        yk = y0 + h + 8
        s.chamada(xs[1], y0 + h - cb, xr, y0 + h + 22, 'n_{b,pil}', size=T_SIM)
    with s.campo('phi_est_pil'):
        s.chamada(x0 + b - ce, y0 + h / 2, xr, y0 + h / 2 + 6, 'φ_{est}', size=T_SIM)
    # o vento vem do aterro (em cima na planta): h é a altura na direção dele
    s.arrow(x0 + b / 2, y0 - 46, x0 + b / 2, y0 - 6, color=C['water'], sw=1.8, marker='arrA')
    s.text(x0 + b / 2 + 8, y0 - 30, 'vento', size=T_SIM - 3, anchor='start', color=C['water'])
    return y0 + h


def planta_bloco(s, x0, y0):
    """Pilarete de bloco grauteado: paredes do bloco (3 cm) e o furo cheio, barras no furo."""
    b, h = BP * KP, 19 * KP
    hf = 3 * KP
    s.titulo_vista(x0 - 70, y0 - 30, 'Bloco grauteado')
    tijolo_dos_lados(s, x0, y0, b, h)
    with s.campo('pil_tipo', 'fbk_pil'):
        s.rect(x0, y0, b, h, fill=C['blockfill'], stroke=C['line'], sw=1.6)
        s.rect(x0 + hf, y0 + hf, b - 2 * hf, h - 2 * hf, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="4"')
    cb = hf + FL / 2 * KP + 8
    with s.campo('phi_pil', 'n_pil'):
        for yy in (y0 + cb, y0 + h - cb):
            for xx in (x0 + cb, x0 + b - cb):
                s.circle(xx, yy, FL / 2 * KP + 1.5)
    return y0 + h


def elevacao(s, x0, ya):
    """Elevação do pilarete sobre o arrimo. x0 = face esquerda do pilarete; ya = topo do arrimo."""
    K = K_DETALHE
    b = 0.20 * K
    L0 = 0.55                     # traspasse desenhado (m)
    HV = 0.75                     # trecho do pilarete mostrado acima do arrimo (m)
    s.titulo_vista(x0 - 120, ya - HV * K - 40, 'Elevação')
    # arrimo: blocos 39 × 19 cortados pelas bordas do desenho, o furo grauteado onde as barras descem
    xa0, xa1 = x0 - 120, x0 + b + 120
    for i in range(3):
        y1 = ya + (i + 1) * 0.2 * K
        off = 0 if i % 2 else 0.2 * K
        x = xa0 - off
        while x < xa1:
            a, c = max(x, xa0), min(x + 0.39 * K, xa1)
            if c > a:
                s.rect(a, y1 - 0.19 * K, c - a, 0.19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.8)
            x += 0.40 * K
    s.rect(x0 + 8, ya, b - 16, 0.6 * K, fill=C['groutfill'], stroke=C['grout'], sw=0.8)
    # pilarete e o muro de cima dos lados (o tijolo vai até a borda do desenho)
    for xa, xb in ((xa0, x0), (x0 + b, xa1)):
        for f in range(4):
            y1 = ya - f * 0.2 * K
            s.rect(xa, y1 - 0.19 * K, xb - xa, 0.19 * K, fill=C['claro'], stroke=C['block'], sw=0.8)
    with s.campo('pil_tipo'):
        s.rect(x0, ya - HV * K, b, HV * K, fill=s.CONC, stroke=C['line'], sw=1.5)
    # interrupção em cima: o pilarete continua até o topo do muro de cima
    yi = ya - HV * K
    s.poly([(xa0 - 4, yi - 2), (xa1 + 4, yi - 2), (xa1 + 4, yi - 30), (xa0 - 4, yi - 30)], fill=C['hollow'], stroke='none')
    xm = x0 + b / 2
    s.pline([(xa0, yi), (xm - 9, yi), (xm - 4, yi - 9), (xm + 4, yi + 9), (xm + 9, yi), (xa1, yi)], stroke=C['line'], sw=1)
    # barras: descem L0 no graute do arrimo
    cb = (CP + FE + FL / 2) / 100 * K
    with s.campo('phi_pil'):
        for xx in (x0 + cb, x0 + b - cb):
            s.line(xx, yi + 3, xx, ya + L0 * K, stroke=C['steel'], sw=3)
    # estribos a cada s_est no trecho de concreto
    ys = [ya - 0.05 * K - k * 0.15 * K for k in range(5) if 0.05 + k * 0.15 < HV - 0.02]
    ce = (CP + FE / 2) / 100 * K
    with s.campo('phi_est_pil'):
        for yy in ys:
            s.line(x0 + ce, yy, x0 + b - ce, yy, stroke=C['steel'], sw=2)
    with s.campo('s_est_pil'):
        s.dim_v(x0 + b + 30, ys[2], ys[1], 's_{est}', side=1, ext_from=(x0 + b - ce, x0 + b - ce))
    s.dim_v(x0 - 26, ya, ya + L0 * K, 'ℓ_{0t}', side=-1, ext_from=(x0 + cb, x0 + cb))
    s.chamada(xa1 - 20, ya + 0.5 * K, xa1 + 40, ya + 0.5 * K + 6, 'arrimo', color=C['note'])
    s.chamada(x0 + b - 12, ya + 0.3 * K, xa1 + 40, ya + 0.3 * K + 6, 'graute', color=C['grout'])


def desenhar():
    s = Fig(30, 1000, 640)
    y1 = planta_concreto(s, 130, 130)
    planta_bloco(s, 130, y1 + 160)
    elevacao(s, 700, 360)
    s.legenda(20, 640, [('concreto', 'concreto'), ('tijolo', 'muro de cima'), ('bloco', 'bloco'), ('graute', 'graute'), ('aco', 'aço')])
    return s
