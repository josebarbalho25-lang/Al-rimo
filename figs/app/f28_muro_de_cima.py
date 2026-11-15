# Fig. 28 (app, 15/11) — O MURO DE CIMA: o muro de vedação que fica em cima do arrimo (Jose, 13/11: "dois clientes
# agora não podem ser só arrimo"). É a figura das entradas do muro em si: altura, espessura, material, peso, reboco,
# argamassa e as resistências da alvenaria dele, as cintas e onde ficam os pilaretes.
#   - CORTE (à esquerda): o topo do arrimo (bloco, solo à direita) e o muro de cima centrado nele, com as cintas de
#     concreto no topo e a meia altura e o reboco nas faces. Escala 220 px/m, como o corte da Fig. 26 (com o K_GERAL
#     o tijolo de 11,5 dá 17 px e o reboco some); o reboco é desenhado mais grosso que a escala, a medida vai na cota;
#   - ELEVAÇÃO (à direita, K_GERAL): os pilaretes a cada s_pil, os painéis A (de baixo) e B (de cima, só com a cinta
#     de meia altura), as setas da tração normal e paralela à fiada e do cisalhamento — sem fórmula, só onde age;
#   - PLANTA dos contrafortes (embaixo): com contrafortes o pilarete fica em cima do contraforte, um a cada n_pil.
# A seção do pilarete e a ligação dele com o arrimo são a Fig. 30; o vento, a Fig. 29; a seção da cinta, a Fig. 31.
from applib import Fig, C, K_GERAL, T_PEQ, T_SIM

KS = 220                 # px por m no corte
TA, TM = 0.19, 0.115     # bloco do arrimo e tijolo do muro de cima (m)
HMC = 1.6                # altura do muro de cima desenhada (m): 8 fiadas
HA = 0.35                # trecho do arrimo mostrado abaixo do muro de cima (m)
NF = 8
CINTAS = (3, 7)          # fiadas em concreto: a de meia altura fecha o painel de baixo (4 fiadas) e a do topo
REB = 6                  # px de reboco no corte (fora de escala)


def interrupcao(s, x0, x1, y):
    """Linha de interrupção embaixo: o arrimo continua para baixo."""
    xm = (x0 + x1) / 2
    zz = [(x0, y), (xm - 8, y), (xm - 3, y - 9), (xm + 3, y + 9), (xm + 8, y), (x1, y)]
    s.poly(zz + [(x1, y + 14), (x0, y + 14)], fill=C['hollow'], stroke='none')
    s.pline(zz, stroke=C['line'], sw=1)


def corte(s, x0, ya):
    """x0 = face da frente do arrimo; ya = topo do arrimo (y para baixo)."""
    K = KS
    tA, tM = TA * K, TM * K
    xc = x0 + tA / 2
    xm0, xm1 = xc - tM / 2, xc + tM / 2
    ytop = ya - HMC * K
    s.titulo_vista(x0 - 70, ytop - 62, 'Corte')
    # solo contido à direita do arrimo, um pouco abaixo do topo dele
    s.solo([(x0 + tA, ya + 0.08 * K), (x0 + tA + 70, ya + 0.08 * K), (x0 + tA + 70, ya + HA * K), (x0 + tA, ya + HA * K)],
           topo=[(x0 + tA, ya + 0.08 * K), (x0 + tA + 70, ya + 0.08 * K)])
    # topo do arrimo: a canaleta da cinta do arrimo e o bloco abaixo
    s.rect(x0, ya, tA, HA * K, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    s.rect(x0, ya, tA, 0.19 * K, fill=C['groutfill'], stroke=C['grout'], sw=1)
    s.line(x0, ya + 0.2 * K, x0 + tA, ya + 0.2 * K, stroke=C['block'], sw=0.6)
    interrupcao(s, x0 - 8, x0 + tA + 8, ya + HA * K)
    with s.campo('mc_on'):
        with s.campo('g_mc'):
            for f in range(NF):
                y1 = ya - f * 0.2 * K
                y0 = y1 - 0.2 * K
                if f in CINTAS:
                    continue
                with s.campo('mat_mc'):
                    s.rect(xm0, y0 + 0.01 * K, tM, 0.19 * K, fill=C['claro'], stroke=C['block'], sw=1)
        with s.campo('cin_mc'):
            for f in CINTAS:
                y1 = ya - f * 0.2 * K
                s.rect(xm0, y1 - 0.2 * K, tM, 0.2 * K, fill=s.CONC, stroke=C['line'], sw=1.2)
        with s.campo('reb_mc'):
            s.rect(xm0 - REB, ytop, REB, HMC * K, fill=C['reboco'], stroke=C['dim'], sw=0.8)
            s.rect(xm1, ytop, REB, HMC * K, fill=C['reboco'], stroke=C['dim'], sw=0.8)
    # cotas: h_mc à esquerda (do topo do arrimo ao topo do muro de cima), t_mc em cima
    with s.campo('h_mc'):
        s.dim_v(x0 - 34, ytop, ya, 'h_{mc}', side=-1, ext_from=(xm0 - REB, x0))
    with s.campo('t_mc'):
        s.dim_h(xm0, xm1, ytop - 22, 't_{mc}', ext_from=(ytop, ytop))
    # chamadas à direita: cintas, bloco, argamassa, reboco
    xr = x0 + tA + 34
    with s.campo('cin_mc'):
        s.chamada(xm1 - 4, ya - 7.5 * 0.2 * K, xr, ya - 7.5 * 0.2 * K + 6, 'cinta')
        s.chamada(xm1 - 4, ya - 3.5 * 0.2 * K, xr, ya - 3.5 * 0.2 * K + 6, 'cinta')
    with s.campo('mat_mc'):
        s.chamada(xm1 - 6, ya - 5.5 * 0.2 * K, xr, ya - 5.5 * 0.2 * K + 6, 'bloco')
    with s.campo('arg_mc'):
        s.chamada(xc, ya - 5 * 0.2 * K - 0.005 * K, xr, ya - 4.6 * 0.2 * K + 6, 'argamassa', color=C['note'])
    with s.campo('reb_mc', 'reb_mc_esp'):
        s.chamada(xm1 + REB / 2, ya - 1.5 * 0.2 * K, xr, ya - 1.5 * 0.2 * K + 6, 'e_{reb,mc}', size=T_SIM)
    # o arrimo, com a chamada embaixo (o muro de cima nasce nele)
    s.chamada(x0 + tA - 6, ya + 0.27 * K, xr + 40, ya + 0.27 * K + 6, 'arrimo', color=C['note'])


def tijolos(s, X, Y, xa, xb, f, K):
    """Uma fiada de tijolo da elevação entre xa e xb (m), meia peça de deslocamento nas ímpares."""
    L = 0.30
    x = xa - (L / 2 if f % 2 else 0)
    while x < xb - 1e-6:
        a, b = max(x, xa) + 0.005, min(x + L, xb) - 0.005
        if b > a:
            s.rect(X(a), Y((f + 1) * 0.2 - 0.005), (b - a) * K, 0.19 * K, fill=C['claro'], stroke=C['block'], sw=0.7)
        x += L


def elevacao(s, x0, ya):
    """x0 = ponta esquerda do muro; ya = topo do arrimo (y para baixo)."""
    K = K_GERAL
    LW = 4.30
    B = 0.20
    pil = (0.10, 2.15, 4.20)
    X = lambda v: x0 + v * K
    Y = lambda z: ya - z * K          # z para cima, a partir do topo do arrimo
    s.titulo_vista(x0, Y(HMC) - 62, 'Elevação')
    # arrimo (bloco 39 × 19, amarração em meio bloco) abaixo, com a interrupção
    for i in range(2):
        zf = -(i + 1) * 0.2
        off = 0 if i % 2 else 0.20
        x = -off
        while x < LW - 1e-6:
            a, b = max(x, 0), min(x + 0.39, LW)
            if b > a:
                s.rect(X(a), Y(zf + 0.19), (b - a) * K, 0.19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.8)
            x += 0.40
    interrupcao(s, X(0) - 8, X(LW) + 8, Y(-HA))
    with s.campo('mc_on'):
        # tijolos e cintas entre os pilaretes
        for v in range(len(pil) - 1):
            xa, xb = pil[v] + B / 2, pil[v + 1] - B / 2
            for f in range(NF):
                if f in CINTAS:
                    with s.campo('cin_mc'):
                        s.rect(X(xa), Y((f + 1) * 0.2), (xb - xa) * K, 0.2 * K, fill=s.CONC, stroke=C['line'], sw=1.1)
                else:
                    tijolos(s, X, Y, xa, xb, f, K)
        with s.campo('pil_tipo'):
            for xp in pil:
                s.rect(X(xp - B / 2), Y(HMC), B * K, HMC * K, fill=s.CONC, stroke=C['line'], sw=1.3)
    # os painéis: A embaixo da cinta de meia altura, B em cima dela
    with s.campo('cin_mc'):
        xm = (pil[0] + pil[1]) / 2
        s.text(X(xm), Y(0.4) + 8, 'A', size=24, weight='bold', halo=True)
        s.text(X(xm), Y(1.2) + 8, 'B', size=24, weight='bold', halo=True)
    # onde a alvenaria do painel trabalha: tração normal à fiada (abre a junta de assentamento), paralela à fiada e
    # cisalhamento na base do painel — só as setas e o nome, a tabela vai na memória
    xm2 = (pil[1] + pil[2]) / 2
    with s.campo('ftkn_mc_dir'):
        xa = X(xm2 - 0.55)
        yj = Y(0.6)
        s.arrow(xa, yj - 5, xa, yj - 34, color=C['dim'], sw=1.6, marker='arr')
        s.arrow(xa, yj + 5, xa, yj + 34, color=C['dim'], sw=1.6, marker='arr')
        s.text(xa + 10, yj - 14, 'f_{tk} normal', size=T_PEQ, anchor='start', halo=True)
    with s.campo('ftkp_mc_dir'):
        yj = Y(1.18)
        xj = X(xm2 + 0.15)
        s.arrow(xj - 5, yj, xj - 36, yj, color=C['dim'], sw=1.6, marker='arr')
        s.arrow(xj + 5, yj, xj + 36, yj, color=C['dim'], sw=1.6, marker='arr')
        s.text(xj, yj - 12, 'f_{tk} paralela', size=T_PEQ, halo=True)
    with s.campo('fvk_mc_dir'):
        # meias setas opostas na junta da base do painel
        yb = Y(0)
        xv = X(xm2 + 0.25)
        s.arrow(xv - 30, yb - 4, xv + 8, yb - 4, color=C['dim'], sw=1.6, marker='arr')
        s.arrow(xv + 30, yb + 4, xv - 8, yb + 4, color=C['dim'], sw=1.6, marker='arr')
        s.text(xv + 40, yb - 8, 'f_{vk}', size=T_SIM, anchor='start', color=C['dim'], halo=True)
    # espaçamento dos pilaretes (balanço), entre eixos
    with s.campo('s_pil'):
        s.dim_h(X(pil[0]), X(pil[1]), Y(HMC) - 20, 's_{pil}', ext_from=(Y(HMC), Y(HMC)))
    with s.campo('pil_tipo'):
        s.chamada(X(pil[2]), Y(1.0), X(LW) + 34, Y(1.0) + 6, 'pilarete')
    return X, LW, pil


def planta(s, x0, yw):
    """Planta com contrafortes, solo em cima: o pilarete fica em cima do contraforte, um a cada n_pil.
    yw = face do muro do lado do solo (y para baixo)."""
    K = K_GERAL
    LW, L = 4.30, 1.0
    TENR, HP = 0.59, 0.25
    tA = TA * K
    X = lambda v: x0 + v * K
    s.titulo_vista(x0, yw - TENR * K - 22, 'Planta (contrafortes)')
    s.solo([(X(0), yw - TENR * K), (X(LW), yw - TENR * K), (X(LW), yw), (X(0), yw)])
    s.rect(X(0), yw, LW * K, tA, fill=C['blockfill'], stroke=C['line'], sw=1.2)
    eixos = [0.095 + k * L for k in range(5)]
    for xc in eixos:
        s.rect(X(xc - TA / 2), yw - TENR * K, tA, TENR * K, fill=C['groutfill'], stroke=C['grout'], sw=1)
    with s.campo('pil_ncf'):
        for xc in eixos[::2]:
            s.rect(X(xc - TA / 2) - 2, yw + tA - HP * K, tA + 4, HP * K, fill=s.CONC, stroke=C['line'], sw=1.3)
        yd = yw + tA + 26
        s.dim_h(X(eixos[0]), X(eixos[2]), yd + 30, 'n_{pil} · l', ext_from=(yw + tA, yw + tA))
    s.dim_h(X(eixos[2]), X(eixos[3]), yw + tA + 26, 'l', ext_from=(yw + tA, yw + tA))
    return yw + tA + 56


def desenhar():
    s = Fig(28, 1000, 640)
    ya = 452
    corte(s, 90, ya)
    elevacao(s, 330, 340)
    yfim = planta(s, 330, 530)
    s.legenda(20, max(ya + HA * KS, yfim) + 40, [('bloco', 'bloco do arrimo'), ('tijolo', 'muro de cima'), ('concreto', 'concreto'), ('graute', 'graute'), ('reboco', 'reboco')])
    return s
