# Fig. 17 (app, nova) — drenagem: corte (dreno de brita com manta no tardoz, terminando abaixo do topo do
# solo; impermeabilização da face do solo até o topo do solo; barbacã na 1ª fiada caindo para fora) e elevação (barbacãs a
# cada s). Tudo configurável (decisão do Jose, 08/10: "cada projetista se vira com isso").
# Régua comum (12/10, applib): as duas vistas em K_GERAL; o corte com parede(), sapata() e solo() à direita, como a
# Fig. 1; títulos pela titulo_vista(). A manta deixou o verde (verde é do passivo) e ficou cinza tracejada; saiu o
# rótulo "face externa" (com o solo sempre à direita, a face de fora é a da esquerda em todas as figuras).
# 14/10 (Jose): dreno de fundo (tubo perfurado numa envoltória de brita no pé do tardoz), areia de filtro entre a brita
# e o solo, manta por fora; barbacã saindo 5 cm da face; hachuras do Revit dele (applib/hachuras.py).
import math

from applib import Fig, C, T_SIM, T_TXT, K_GERAL as K

T, HM, HSO = 0.19, 2.0, 1.8          # m — o muro passa um pouco do solo, como na Fig. 1; 2,0 m = 10 fiadas na elevação
PONTA, TALAO, HS = 0.40, 0.75, 0.30
ESP, FOLGA = 0.20, 0.40              # dreno: espessura da brita e folga até o topo do solo (m, proporção do desenho)
ENV, AREIA, PHI = 0.30, 0.10, 0.10   # dreno de fundo: lado da envoltória de brita, areia do filtro, Ø do tubo (m)
SAI = 0.05                           # o barbacã sai 5 cm da face do muro
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
    # pacote do dreno: a brita em degrau (camada do tardoz + envoltória do tubo no pé), a areia em volta do lado do
    # solo e a manta por fora (tracejada); folga medida do topo do solo até o topo do pacote
    def borda(cresce):
        """Borda de fora da brita engordada `cresce` m, do talão até a face do muro (y da figura cresce para baixo)."""
        e, f = (ESP + cresce) * K, (ENV + cresce) * K
        return [(xs + f, yb), (xs + f, yb - f), (xs + e, yb - f), (xs + e, yd_out + (AREIA - cresce) * K), (xs, yd_out + (AREIA - cresce) * K)]
    yd_out = yt + FOLGA * K
    brita = [(xs, yb)] + borda(0)
    with s.campo('dreno_on', 'drenof_on'):
        s.poly(brita, fill=s.BRITA, stroke=C['dim'], sw=0.8)
        s.pline(borda(AREIA), stroke=C['dim'], sw=2, extra='stroke-dasharray="7,4"')
        # rótulos à direita, um abaixo do outro: manta, areia, brita, tubo
        xr_ = xs + (ESP + AREIA) * K + 50
        s.chamada(xs + (ESP + AREIA) * K, yb - 1.2 * K, xr_, yb - 1.2 * K - 22, 'manta', size=T_TXT)
        s.chamada(xs + ESP * K * 0.5, yb - 0.55 * K, xr_, yb - 0.55 * K - 22, 'brita', size=T_TXT)
    with s.campo('areia_esp'):
        s.poly(borda(AREIA) + borda(0)[::-1], fill=s.AREIA, stroke=C['dim'], sw=0.6)
        s.chamada(xs + (ESP + AREIA / 2) * K, yb - 0.88 * K, xs + (ESP + AREIA) * K + 50, yb - 0.88 * K - 22, 'areia', size=T_TXT)
    with s.campo('imper_on'):
        # só até o topo do solo, como o quantitativo conta (Jose, 15/10): acima dele a parede não encosta em terra
        s.line(xs + 1.5, yt, xs + 1.5, yb, stroke=C['line'], sw=3.4)
        s.chamada(xs + 2, yt + 22, xs + 54, yt - 30, 'impermeabilização', size=T_TXT)
    with s.campo('dreno_esp'):
        s.dim_h(xs, xs + ESP * K, yd_out + AREIA * K - 16, 'e', ext_from=(yd_out + AREIA * K, yd_out + AREIA * K), size=T_SIM, halo=True)
    with s.campo('dreno_folga'):
        s.dim_v(xs + (ESP + AREIA) * K + 26, yt, yd_out, 'folga', side=1, ext_from=(xs + (ESP + AREIA) * K, xs + (ESP + AREIA) * K), size=T_TXT, halo=True)
    # dreno de fundo: o tubo no meio da envoltória
    xc, yc_t = xs + ENV / 2 * K, yb - ENV / 2 * K
    with s.campo('drenof_on', 'drenof_phi'):
        s.circle(xc, yc_t, PHI / 2 * K, fill=C['hollow'], stroke=C['line'], sw=1.6)
        for k in range(6):
            a = k * math.pi / 3
            s.circle(xc + 0.6 * PHI / 2 * K * math.cos(a), yc_t + 0.6 * PHI / 2 * K * math.sin(a), 0.9, fill=C['line'])
    with s.campo('drenof_on'):
        s.chamada(xc + 5, yc_t + 3, xs + (ENV + AREIA) * K + 56, yb - 8, 'tubo perfurado', size=T_TXT)
    with s.campo('drenof_phi'):
        s.text(xc, yc_t - PHI / 2 * K - 5, 'Ø', size=T_SIM, halo=True)
    with s.campo('drenof_env'):
        xe = xs + (ENV + AREIA) * K + 12
        s.dim_v(xe, yb - ENV * K, yb, 'b', side=-1, ext_from=(xs + ENV * K, xs + ENV * K), size=T_SIM, halo=True)
    with s.campo('areia_esp'):
        ya = yb - 1.3 * K
        s.dim_h(xs + ESP * K, xs + (ESP + AREIA) * K, ya, '', ext_from=(ya, ya))
        s.text(xs + (ESP + AREIA) * K + 6, ya + 5, 'a', size=T_SIM, anchor='start', color=C['dim'], halo=True)
    # barbacã: 1ª fiada acima do solo da frente, caindo para fora, saindo 5 cm da face
    yB = yb - 0.10 * K
    with s.campo('barbaca_on', 'barbaca_phi'):
        s.line(xs + 0.05 * K, yB - 4, xw - SAI * K, yB + 3, stroke=C['block'], sw=8)
        s.line(xs + 0.05 * K, yB - 4, xw - SAI * K, yB + 3, stroke=C['hollow'], sw=3.5)
    with s.campo('barbaca_on'):
        s.chamada(xw - SAI * K + 2, yB + 3, xw - 40, yB - 56, 'barbacã', size=T_TXT, anchor='end')

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
