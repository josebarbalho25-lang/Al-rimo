# Fig. 3 (app) — seção e grauteamento (planta de uma fiada, bloco 19 × 39) e a seção de cálculo da faixa.
# Régua comum (12/10, applib):
#   - bloco a K_BLOCO (era 5 px/cm; agora o 19 × 39 tem o mesmo tamanho das Figs. 2, 4 e 14). Nessa escala três
#     blocos e a seção de cálculo não cabem na moldura: ficam dois blocos, o bastante para a faixa b_m centrada na
#     barra do meio caber inteira;
#   - planta com o solo em cima (hachura, não mais a palavra), como toda planta do app;
#   - sai o "K (NBR) = 1,5 / 2,0": era regra da norma escrita na figura; o campo K_dir fica na seção de cálculo,
#     que é o que decide o K (seção I → 1,5; cheia → 2,0);
#   - a faixa tracejada era vermelha: vermelho é só aço, então ela passa à cor de cota;
#   - títulos por titulo_vista e a legenda pela legenda().
from applib import Fig, C, K_BLOCO

K = K_BLOCO / 100        # px por cm
T, L, HF = 19, 39, 3.5   # bloco 19 × 39, parede h_f
LH = (L - 3 * HF) / 2    # comprimento do furo
XB = HF + LH / 2         # eixo do 1º furo, onde passa a barra
YB = 5                   # barra a 5 cm da face do solo (aula 12.2: d = 14)
R_BARRA = 0.625 * K + 1.5
SOLO = 30                # px: faixa de solo atrás da parede, em planta


def bloco(s, x0, y0, grauteados):
    X = lambda v: x0 + v * K
    Y = lambda v: y0 + v * K
    s.rect(X(0), Y(0), L * K, T * K, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    for i, a in enumerate((HF, 2 * HF + LH)):
        g = i in grauteados
        s.rect(X(a), Y(HF), LH * K, (T - 2 * HF) * K, fill=C['groutfill'] if g else C['hollow'],
               stroke=C['grout'] if g else C['block'], sw=1.0, extra='rx="4"')


def linha(s, x0, y0, total):
    """Uma linha da figura: a planta de dois blocos (com o solo) e, à direita, a seção de cálculo da faixa."""
    yt = y0 - SOLO - 16           # base dos títulos: logo acima do solo
    with s.campo('Graute'):
        # graute a cada X (13/10): 20 = todos os furos (seção cheia); 40 = furo sim, furo não com a barra a 40 (seção I)
        s.titulo_vista(x0, yt, 'Graute a cada 20 (todos)' if total else 'Graute a cada 40')
    n = 2
    s.solo([(x0, y0 - SOLO), (x0 + (40 * n - 1) * K, y0 - SOLO), (x0 + (40 * n - 1) * K, y0), (x0, y0)])
    for k in range(n):
        bloco(s, x0 + k * 40 * K, y0, [0, 1] if total else [0])
        if k < n - 1:   # junta vertical de 1 cm entre os blocos
            s.rect(x0 + (k * 40 + L) * K, y0, 1 * K, T * K, fill=C['claro'], stroke='none')
        s.circle(x0 + (k * 40 + XB) * K, y0 + YB * K, R_BARRA)
    # faixa de cálculo: b_m = s, centrada na barra do 2º bloco
    c = 40 + XB
    xa, xb = x0 + (c - 20) * K, x0 + (c + 20) * K
    s.rect(xa, y0 - 6, xb - xa, T * K + 12, stroke=C['dim'], sw=1.4, extra='stroke-dasharray="6,4"')
    yc = y0 + T * K
    with s.campo('s_dir', 'AsMin_crit'):
        s.dim_h(xa, xb, yc + 34, 'b_{m} = s', ext_from=(yc + 6, yc + 6))
    if not total:
        with s.campo('bw_dir', 'bwv_dir'):
            s.dim_h(x0 + 40 * K, x0 + (40 + 2 * HF + LH) * K, yc + 74, 'b_{w}', ext_from=(yc, yc))
        # parede do bloco = mesa da seção I
        xh = x0 + (40 * n - 1) * K
        s.dim_v(xh + 22, y0, y0 + HF * K, 'h_{f}', side=1, ext_from=(xh, xh))
    with s.campo('t_bloco', 'AsMin_crit'):
        s.dim_v(x0 - 22, y0, yc, 't', side=-1, ext_from=(x0, x0))
    with s.campo('d_dir', 'AsMin_crit'):
        s.dim_v(x0 - 58, y0 + YB * K, yc, 'd', side=-1, ext_from=(x0 + XB * K, x0))
    # seção de cálculo da faixa (sem solo: é a seção idealizada, não uma vista da obra)
    sx = xb + 150
    s.titulo_vista(sx, yt, 'Seção cheia' if total else 'Seção I')
    with s.campo('K_dir'):
        if total:
            s.rect(sx, y0, 40 * K, T * K, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        else:
            bw = 2 * HF + LH
            o = (40 - bw) / 2
            pts = [(0, 0), (40, 0), (40, HF), (40 - o, HF), (40 - o, T - HF), (40, T - HF), (40, T), (0, T),
                   (0, T - HF), (o, T - HF), (o, HF), (0, HF)]
            s.poly([(sx + a * K, y0 + b * K) for a, b in pts], fill=C['blockfill'], stroke=C['line'], sw=1.4)
            s.rect(sx + (o + HF) * K, y0 + HF * K, LH * K, (T - 2 * HF) * K, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
        s.circle(sx + 20 * K, y0 + YB * K, R_BARRA)
    with s.campo('s_dir'):
        s.dim_h(sx, sx + 40 * K, yc + 34, 'b_{m}', ext_from=(yc, yc))


def desenhar():
    s = Fig(3, 1000, 640)
    x0 = 100
    linha(s, x0, 110, total=False)
    linha(s, x0, 390, total=True)
    s.legenda(x0 - 58, 610, [('bloco', 'bloco'), ('graute', 'graute'), ('aco', 'barra vertical')])
    return s
