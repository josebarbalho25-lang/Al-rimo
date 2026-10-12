# Fig. 17 (app, nova) — drenagem: corte (dreno de brita com manta no tardoz, terminando abaixo do topo do
# solo; impermeabilização da face do solo; barbacã na 1ª fiada caindo para fora) e elevação (barbacãs a
# cada s). Tudo configurável (decisão do Jose, 08/10: "cada projetista se vira com isso").
# Régua comum (12/10, applib): as duas vistas em K_GERAL; o corte com parede(), sapata() e solo() à direita, como a
# Fig. 1; títulos pela titulo_vista(). A manta deixou o verde (verde é do passivo) e ficou cinza tracejada; saiu o
# rótulo "face externa" (com o solo sempre à direita, a face de fora é a da esquerda em todas as figuras).
from applib import Fig, C, T_SIM, T_TXT, K_GERAL as K

T, HM, HSO = 0.19, 2.0, 1.8          # m — o muro passa um pouco do solo, como na Fig. 1; 2,0 m = 10 fiadas na elevação
PONTA, TALAO, HS = 0.40, 0.75, 0.30
ESP, FOLGA = 0.24, 0.40              # dreno: espessura e folga até o topo do solo (m, proporção do desenho)
LE, HE = 2.6, HM                     # trecho de muro mostrado na elevação (m)
BX, BY = 0.39, 0.19                  # bloco 39 × 19 (m), com a junta de 1 cm no passo de 40 × 20


def alvenaria(s, x0, yb, larg, alt):
    """Parede em elevação com a amarração (fiadas alternadas meio bloco). Não há peça na applib para alvenaria
    vista de frente — a parede() é o corte."""
    nf = int(round(alt / 0.20))
    for i in range(nf):
        y = yb - (i + 1) * 0.20 * K
        xx = -0.20 if i % 2 else 0.0
        while xx < larg:
            a, b = max(xx, 0.0), min(xx + BX, larg)
            if b > a:
                s.rect(x0 + a * K, y, (b - a) * K, BY * K, fill=C['blockfill'], stroke=C['block'], sw=0.7)
            xx += 0.40


def desenhar():
    s = Fig(17, 1000, 640)
    yb = 470                                  # topo da sapata (pé da parede), nas duas vistas

    # ── Corte ─────────────────────────────────────────────────────────────────────────────────────────────────
    xw = 170
    tw = T * K
    xs = xw + tw
    yt = yb - HSO * K
    xl, xr = xw - (PONTA + 0.25) * K, xs + (TALAO + 0.4) * K
    s.solo([(xl, yb), (xs, yb), (xs, yt), (xr, yt), (xr, yb + 0.55 * K), (xl, yb + 0.55 * K)])
    s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(xl, yb, xw, yb, stroke=C['soil'], sw=2)
    s.sapata(xw - PONTA * K, yb, PONTA + T + TALAO, HS)
    s.parede(xw, yb, T, HM, barra=False)
    s.titulo_vista(xl, yb - HM * K - 40, 'Corte')
    # dreno de brita + manta (a manta envolve a brita do lado do solo e por cima)
    xd0, xd1 = xs + 2, xs + 2 + ESP * K
    yd = yt + FOLGA * K
    with s.campo('dreno_on'):
        s.rect(xd0, yd, xd1 - xd0, yb - yd, fill=s.BRITA, stroke='none')
        s.pline([(xd0, yd), (xd1, yd), (xd1, yb)], stroke=C['dim'], sw=2, extra='stroke-dasharray="7,4"')
        s.chamada(xd1 - 12, yb - 0.75 * K, xd1 + 54, yb - 0.75 * K - 22, 'dreno', size=T_TXT)
        s.chamada(xd1, yd + 0.45 * K, xd1 + 54, yd + 0.45 * K - 22, 'manta', size=T_TXT)
    with s.campo('imper_on'):
        s.line(xs + 1.5, yb - HM * K + 10, xs + 1.5, yb, stroke=C['line'], sw=3.4)
        s.chamada(xs + 2, yt + 22, xs + 54, yt - 30, 'impermeabilização', size=T_TXT)
    with s.campo('dreno_esp'):
        s.dim_h(xd0, xd1, yd - 16, 'e', ext_from=(yd, yd), size=T_SIM, halo=True)
    with s.campo('dreno_folga'):
        s.dim_v(xd1 + 26, yt, yd, 'folga', side=1, ext_from=(xd1, xd1), size=T_TXT, halo=True)
    # barbacã: 1ª fiada, caindo para fora (sai acima do solo da frente)
    yB = yb - 0.10 * K
    with s.campo('barbaca_on', 'barbaca_phi'):
        s.line(xd0 + 12, yB - 4, xw - 16, yB + 3, stroke=C['block'], sw=8)
        s.line(xd0 + 12, yB - 4, xw - 16, yB + 3, stroke=C['hollow'], sw=3.5)
    with s.campo('barbaca_on'):
        s.chamada(xw - 12, yB + 3, xw - 40, yB - 56, 'barbacã', size=T_TXT, anchor='end')

    # ── Elevação (vista de fora) ─────────────────────────────────────────────────────────────────────────────
    ex0 = 545
    X = lambda v: ex0 + v * K
    # solo cortado abaixo do terreno e a sapata enterrada, como no corte ao lado
    s.solo([(X(-0.35), yb), (X(LE + 0.35), yb), (X(LE + 0.35), yb + 0.55 * K), (X(-0.35), yb + 0.55 * K)])
    s.sapata(X(-0.2), yb, LE + 0.4, HS)
    s.line(X(-0.35), yb, X(LE + 0.35), yb, stroke=C['soil'], sw=2)
    alvenaria(s, ex0, yb, LE, HE)
    s.titulo_vista(X(-0.35), yb - HM * K - 40, 'Elevação')
    xb = [0.30, 0.30 + 1.6]
    yc = yb - 0.10 * K
    with s.campo('barbaca_on', 'barbaca_phi'):
        for v in xb:
            s.circle(X(v), yc, 7, fill=C['hollow'], stroke=C['line'], sw=2)
    with s.campo('barbaca_phi'):
        s.text(X(xb[0]) - 12, yc + 7, 'Ø', size=T_SIM, anchor='end', halo=True)
    with s.campo('barbaca_s'):
        s.dim_h(X(xb[0]), X(xb[1]), yc - 34, 's', ext_from=(yc - 8, yc - 8), halo=True)
    return s
