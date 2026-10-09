# Fig. 20 (app, nova) — tipo de muro: em balanço × com contrafortes, em perspectiva oblíqua simples
# (desenhada à mão aqui, não é captura do 3D: a figura precisa existir antes do muro do usuário).
from applib import Fig, C, T_TIT

KX, KD = 0.62, 0.62          # escala ao longo do muro; fator da profundidade (oblíqua a 30°)
COS, SIN = 0.866, 0.5


def proj(ox, oy, x, y, z):
    """x ao longo do muro, y para o lado do solo (para trás), z para cima → tela."""
    return ox + x * KX + y * KD * COS, oy - z * KX - y * KD * SIN


def caixa(s, ox, oy, x0, y0, z0, dx, dy, dz, fill, stroke=C['line']):
    P = lambda x, y, z: proj(ox, oy, x, y, z)
    frente = [P(x0, y0, z0), P(x0 + dx, y0, z0), P(x0 + dx, y0, z0 + dz), P(x0, y0, z0 + dz)]
    topo = [P(x0, y0, z0 + dz), P(x0 + dx, y0, z0 + dz), P(x0 + dx, y0 + dy, z0 + dz), P(x0, y0 + dy, z0 + dz)]
    lado = [P(x0 + dx, y0, z0), P(x0 + dx, y0 + dy, z0), P(x0 + dx, y0 + dy, z0 + dz), P(x0 + dx, y0, z0 + dz)]
    s.poly(lado, fill=fill[2], stroke=stroke, sw=1.1)
    s.poly(topo, fill=fill[1], stroke=stroke, sw=1.1)
    s.poly(frente, fill=fill[0], stroke=stroke, sw=1.1)


BLOCO = (C['blockfill'], C['hollow'], C['cinza2'])
CONC = (C['concreto'], C['hollow'], C['cinza2'])


def muro(s, ox, oy, contrafortes):
    # Vista pelo lado do SOLO: com os contrafortes enterrados na frente do muro, eles aparecem inteiros
    # (vistos de fora, ficariam escondidos atrás do muro e a figura não diria nada).
    L, t, H = 600, 19, 220
    B, tal = 140, 76
    caixa(s, ox, oy, 0, -tal, -30, L, B, 30, CONC)                  # sapata: talão para a frente (solo)
    caixa(s, ox, oy, 0, 0, 0, L, t, H, BLOCO)                       # muro
    if contrafortes:
        for xc in (586, 293, 0):                                     # da direita para a esquerda
            caixa(s, ox, oy, xc, -60, 0, 14, 60, H, BLOCO)


def desenhar():
    s = Fig(20, 1000, 420)
    with s.campo('Tipo_muro'):
        s.text(250, 150, 'Balanço', size=T_TIT, weight='bold')
        s.text(760, 150, 'Contrafortes', size=T_TIT, weight='bold')
    muro(s, 70, 330, False)
    muro(s, 560, 330, True)
    return s
