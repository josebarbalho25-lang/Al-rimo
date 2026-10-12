# Fig. 20 (app, nova) — tipo de muro: em balanço × com contrafortes, em perspectiva oblíqua simples
# (desenhada à mão aqui, não é captura do 3D: a figura precisa existir antes do muro do usuário).
# Régua comum (12/10, applib):
#   - antes a vista era pelo lado do solo e SEM solo: os contrafortes enterrados pareciam aparentes. Agora a vista
#     é de fora (a face do muro que a gente vê na obra) e o solo aparece atrás do muro, cortado na ponta direita;
#     do contraforte enterrado se vê o topo, rente ao terreno, e o da ponta inteiro no corte do solo — como na
#     obra depois do reaterro;
#   - contraforte em vista é C['cinza2'] (a régua: graute azul só em corte/planta); solo pela solo() da applib;
#   - títulos pela titulo_vista();
#   - perspectiva não tem K na régua (não é corte nem planta): a escala é a maior que põe as duas vistas lado a
#     lado na moldura; por isso o muro desenhado tem 4 m (2 vãos), e não 6.
from applib import Fig, C

K3 = 0.76                    # px por cm na perspectiva (x e z); a profundidade usa o mesmo fator, a 30°
COS, SIN = 0.866, 0.5
L, T, H = 400, 19, 220       # muro: comprimento, espessura, altura (cm)
PONTA, TAL, H_SAP = 45, 76, 30   # sapata: ponta (lado de fora), talão (além da face do solo), altura
TEN, E_C = 60, 14            # contraforte: comprimento para dentro do solo (além do muro) e espessura
YS = T + 160                 # até onde o solo é desenhado atrás do muro
CONTRAFORTES = (0, (L - E_C) / 2, L - E_C)

BLOCO = (C['blockfill'], C['hollow'], C['cinza2'])     # frente, topo, lado
CONC = (C['concreto'], C['hollow'], C['cinza2'])


def proj(ox, oy, x, y, z):
    """x ao longo do muro, y para o lado do solo (para trás), z para cima → tela."""
    return ox + x * K3 + y * K3 * COS, oy - z * K3 - y * K3 * SIN


def caixa(s, P, x0, y0, z0, dx, dy, dz, cores):
    """Caixa com as três faces que a vista enxerga (frente, topo e lado direito)."""
    frente = [P(x0, y0, z0), P(x0 + dx, y0, z0), P(x0 + dx, y0, z0 + dz), P(x0, y0, z0 + dz)]
    topo = [P(x0, y0, z0 + dz), P(x0 + dx, y0, z0 + dz), P(x0 + dx, y0 + dy, z0 + dz), P(x0, y0 + dy, z0 + dz)]
    lado = [P(x0 + dx, y0, z0), P(x0 + dx, y0 + dy, z0), P(x0 + dx, y0 + dy, z0 + dz), P(x0 + dx, y0, z0 + dz)]
    s.poly(lado, fill=cores[2], stroke=C['line'], sw=1.1)
    s.poly(topo, fill=cores[1], stroke=C['line'], sw=1.1)
    s.poly(frente, fill=cores[0], stroke=C['line'], sw=1.1)


def muro(s, ox, oy, contrafortes):
    P = lambda x, y, z: proj(ox, oy, x, y, z)
    # ordem de pintura: do fundo para a frente — sapata, solo (tapa o talão), contrafortes, muro
    caixa(s, P, 0, -PONTA, -H_SAP, L, PONTA + T + TAL, H_SAP, CONC)
    # solo atrás do muro, rente ao topo: superfície do terreno e o corte na ponta direita (em L, por cima do
    # talão e descendo além dele até a base da sapata)
    topo = [P(0, T, H), P(L, T, H), P(L, YS, H), P(0, YS, H)]
    corte = [P(L, T, 0), P(L, T, H), P(L, YS, H), P(L, YS, -H_SAP), P(L, T + TAL, -H_SAP), P(L, T + TAL, 0)]
    for pts in (topo, corte):
        s.solo(pts)
        s.pline(pts + [pts[0]], stroke=C['soil'], sw=1.2)
    if contrafortes:
        for xc in CONTRAFORTES:
            # enterrado: do contraforte só aparece o topo, rente ao terreno
            s.poly([P(xc, T, H), P(xc + E_C, T, H), P(xc + E_C, T + TEN, H), P(xc, T + TEN, H)],
                   fill=C['cinza2'], stroke=C['line'], sw=1.1)
        # o da ponta direita coincide com o corte do solo: aparece inteiro
        s.poly([P(L, T, 0), P(L, T + TEN, 0), P(L, T + TEN, H), P(L, T, H)], fill=C['cinza2'], stroke=C['line'], sw=1.1)
    caixa(s, P, 0, 0, 0, L, T, H, BLOCO)
    return P(0, -PONTA, 0)[0], P(0, YS, H)[1]      # canto esquerdo e topo da vista, para o título


def desenhar():
    s = Fig(20, 1000, 640)
    larg = L * K3 + (PONTA + YS) * K3 * COS
    oy = 420
    ox1 = 70
    ox2 = ox1 + larg + 50
    xe1, yt1 = muro(s, ox1, oy, False)
    xe2, yt2 = muro(s, ox2, oy, True)
    with s.campo('Tipo_muro'):
        s.titulo_vista(xe1, yt1 - 22, 'Balanço')
        s.titulo_vista(xe2, yt2 - 22, 'Contrafortes')
    return s
