# Fig. 8 (app) — tração na flexão da alvenaria, normal e paralela à fiada. Sem ⊥ e ∥: não existem no Arial e
# cairiam em fonte de reserva.
# Régua comum (12/10, applib):
#   - a tabela de f_tk por argamassa saiu (é tabela do app/memória, não desenho); o campo arg_cls ficou na peça que
#     ele governa: a junta de argamassa por onde a fissura passa (as fissuras e a chamada "argamassa");
#   - as frases "fissura na junta horizontal" / "fissura em escada pelas juntas" saíram; a fissura é a fissura()
#     da applib (cinza-escuro — o vermelho é só aço) e a legenda diz o que ela é;
#   - parede a K_GERAL (era 1,6 px/cm solta), trecho de 2,40 × 1,60 m para ocupar a moldura;
#   - títulos pela titulo_vista().
from applib import Fig, C, K_GERAL

K = K_GERAL / 100        # px por cm
W, H = 240, 160          # trecho de parede desenhado (cm): 6 blocos × 8 fiadas


def parede(s, x0, y0):
    """Alvenaria em amarração, vista de frente; (x0, y0) = canto superior esquerdo."""
    for i in range(H // 20):
        y = y0 + H * K - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xs = -off
        while xs < W:
            a = max(xs, 0); b = min(xs + 39, W)
            if b > a:
                s.rect(x0 + a * K, y, (b - a) * K, 19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.8)
            xs += 40


def desenhar():
    s = Fig(8, 1000, 640)
    ya = 150
    yb = ya + H * K
    # (a) normal à fiada: abre a junta horizontal (de assentamento) — fissura reta ao longo dela
    xa = 40
    s.titulo_vista(xa, ya - 66, 'Tração normal à fiada')
    parede(s, xa, ya)
    yc = yb - 40.5 * K               # junta entre a 2ª e a 3ª fiada (meio do 1 cm de argamassa)
    xm = xa + W * K / 2
    s.arrow(xm, ya - 6, xm, ya - 46)
    s.arrow(xm, yb + 6, xm, yb + 46)
    # (b) paralela à fiada: a fissura contorna os blocos, em escada pelas juntas verticais e horizontais
    xb = xa + W * K + 150
    s.titulo_vista(xb, ya - 66, 'Tração paralela à fiada')
    parede(s, xb, ya)
    s.arrow(xb - 6, ya + H / 2 * K, xb - 46, ya + H / 2 * K)
    s.arrow(xb + W * K + 6, ya + H / 2 * K, xb + W * K + 46, ya + H / 2 * K)
    with s.campo('arg_cls'):
        s.fissura(xa, yc, xa + W * K, yc, n=30)
        # escada: em cada fiada desce pela junta vertical (x = 100 cm nas fiadas ímpares, 120 nas pares, contadas
        # de baixo) e anda meio bloco pela junta horizontal até a junta vertical da fiada de baixo
        n = H // 20
        pts = []
        for j in range(n):
            i = n - 1 - j
            xj = xb + (99.5 if i % 2 else 119.5) * K
            pts.append((xj, ya if j == 0 else ya + (j - 0.025) * 20 * K))
            pts.append((xj, ya + (j + 1 - 0.025) * 20 * K))
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            # trecho curto (meio bloco, uma fiada): um dente só — com mais dentes a escada vira serrilha
            s.fissura(x1, y1, x2, y2, n=2)
        # a argamassa é a junta: a chamada aponta uma junta vertical da 1ª fiada de (a), longe da fissura
        s.chamada(xa + 199.5 * K, yb - 10 * K, xa + W * K + 22, yb + 34, 'argamassa', color=C['note'])
    s.legenda(xa, yb + 96, [('fissura', 'fissura')])
    return s
