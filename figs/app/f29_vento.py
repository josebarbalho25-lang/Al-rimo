# Fig. 29 (app, 15/11) — O VENTO no muro de cima e na parte do arrimo acima do solo (Jose, 13/11: vento só
# perpendicular ao muro, soprando do aterro para a frente — o sentido que soma ao empuxo).
#   - CORTE a K_GERAL, solo à direita: o arrimo com a sapata, o aterro até h_solo, o muro de cima em cima;
#   - a PRESSÃO do vento (retângulo, a pressão do topo vale para a altura inteira — é o que a conta faz) na parte
#     exposta: do topo do aterro ao topo do muro de cima;
#   - z_v medido do terreno da FRENTE ao topo (é o z do S2);
#   - os fatores onde eles moram: V0 nas setas, S1 no terreno, S2 na rugosidade (casas ao longe, do lado de onde vem
#     o vento — categoria e classe), S3 de vedação no muro de cima e S3 de estrutura no arrimo, Cf na pressão.
# Sem fórmula: o q = 0,613·Vk² e a tabela do Cf vão na memória.
from applib import Fig, C, K_GERAL, T_SIM

K = K_GERAL
TA, TM = 0.19, 0.115
HM, HS, HMC = 1.4, 0.9, 1.8       # arrimo, solo contido, muro de cima (m)
B, HSAP, PONTA = 0.9, 0.30, 0.25


def casinha(s, x, y, w, h):
    s.rect(x, y - h, w, h, fill=C['claro'], stroke=C['cinza'], sw=1)
    s.poly([(x - 3, y - h), (x + w / 2, y - h - h * 0.6), (x + w + 3, y - h)], fill=C['claro'], stroke=C['cinza'], sw=1)


def desenhar():
    s = Fig(29, 1000, 640)
    x0, y0 = 260, 560                 # face da frente do arrimo; topo da sapata
    X = lambda v: x0 + v * K
    Y = lambda z: y0 - z * K
    tA, tM = TA * K, TM * K
    xc = x0 + tA / 2
    # terreno da frente (à esquerda) no nível do topo da sapata; aterro à direita até h_solo
    with s.campo('S1_v'):
        s.line(X(-1.3), Y(0), X(-PONTA), Y(0), stroke=C['soil'], sw=2)
        s.text(X(-1.15), Y(0) - 10, 'S_{1}', size=T_SIM, anchor='start', color=C['dim'])
    s.solo([(X(-1.3), Y(0)), (X(-PONTA), Y(0)), (X(-PONTA), Y(-HSAP) + 16), (X(-1.3), Y(-HSAP) + 16)])
    s.solo([(x0 + tA, Y(HS)), (X(2.9), Y(HS)), (X(2.9), Y(-HSAP) + 16), (X(B - PONTA), Y(-HSAP) + 16), (X(B - PONTA), Y(0)), (x0 + tA, Y(0))],
           topo=[(x0 + tA, Y(HS)), (X(2.9), Y(HS))])
    s.solo([(X(-PONTA), Y(-HSAP)), (X(B - PONTA), Y(-HSAP)), (X(B - PONTA), Y(-HSAP) + 16), (X(-PONTA), Y(-HSAP) + 16)])
    s.sapata(X(-PONTA), Y(0), B, HSAP)
    s.parede(x0, Y(0), TA, HM, canaletas=(HM - 0.2,), barra=False)
    # o muro de cima, centrado no arrimo, com as cintas
    hc = 0.2 * K
    s.rect(xc - tM / 2, Y(HM + HMC), tM, HMC * K, fill=C['claro'], stroke=C['block'], sw=1.2)
    for z in (HM + 0.8, HM + HMC - 0.2):
        s.rect(xc - tM / 2, Y(z) - hc, tM, hc, fill=s.CONC, stroke=C['line'], sw=1.1)
    # a pressão do vento: da superfície do aterro ao topo, do lado de onde ele vem
    zt = HM + HMC
    xp0 = x0 + tA + 4
    larg = 110
    with s.campo('vento_on'):
        s.rect(xp0, Y(zt), larg, (zt - HS) * K, fill=C['pressao'], stroke=C['water'], sw=1.4, extra='fill-opacity="0.8"')
        n = 7
        for i in range(n):
            y = Y(zt) + (i + 0.5) * (zt - HS) * K / n
            # acima do topo do arrimo a seta chega no muro de cima; abaixo, na face do arrimo
            xa = xc + tM / 2 + 3 if y < Y(HM) else x0 + tA + 3
            s.arrow(xp0 + larg - 4, y, xa, y, color=C['water'], sw=1.5, marker='arrA')
    with s.campo('V0_v'):
        s.text(xp0 + larg + 14, Y(zt) + 30, 'V_{0}', size=T_SIM + 2, anchor='start', color=C['water'], weight='bold')
    with s.campo('Cf_dir'):
        s.text(xp0 + larg + 14, Y(zt) + 66, 'C_{f}', size=T_SIM, anchor='start', color=C['water'])
    # rugosidade do terreno de onde vem o vento: casas baixas ao longe
    with s.campo('cat_v', 'cls_v'):
        for k, (dx, w, h) in enumerate(((2.05, 26, 22), (2.35, 34, 30), (2.68, 24, 20))):
            casinha(s, X(dx), Y(HS), w, h)
        s.text(X(2.38), Y(HS) - 60, 'S_{2}', size=T_SIM, color=C['dim'])
    # S3: vedação (os painéis do muro de cima) e estrutura (pilarete, arrimo)
    with s.campo('S3_v'):
        s.chamada(xc - tM / 2, Y(HM + 1.2), X(-0.8), Y(HM + 1.2) + 6, 'S_{3,v}', size=T_SIM, anchor='end')
    with s.campo('S3_e'):
        s.chamada(x0, Y(HM - 0.35), X(-0.8), Y(HM - 0.35) + 6, 'S_{3}', size=T_SIM, anchor='end')
    # z do terreno da frente ao topo; a parte exposta (onde o vento pega)
    s.dim_v(X(-1.3) + 6, Y(zt), Y(0), 'z_{v}', side=1, ext_from=(xc - tM / 2, X(-1.3)))
    s.dim_v(xp0 + larg + 70, Y(zt), Y(HS), 'exposta', side=1, ext_from=(xp0 + larg, X(1.0)))
    s.dim_v(x0 - 12, Y(HM + HMC), Y(HM), 'h_{mc}', side=-1)
    s.titulo_vista(X(-1.3), Y(zt) - 40, 'Corte')
    s.legenda(X(-1.3), Y(-HSAP) + 56, [('tijolo', 'muro de cima'), ('concreto', 'concreto'), ('solo', 'solo')])
    return s
