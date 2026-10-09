# Fig. 12 (app) — contraforte em planta: enterrado (seção T) × aparente (retangular). Saem os números da
# aula 12.3 (bm 86,7, 3Ø10, d 52, Ø6,3 c/20) e os fpk do bloco CERÂMICO (6,0 e 9,6): o app é só de concreto.
# Desenho em proporção genérica — não desenha o encaixe dos blocos (na família 14 ele ainda é provisório).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

S = 2.6
T, E, TEN, HALF = 14, 14, 59, 80        # cm (proporção do desenho, não valores de projeto)


def caso(s, x0, enterrado):
    X = lambda v: x0 + v * S
    yw = 150 if enterrado else 150 + (TEN - T) * S
    Yw0, Yw1 = yw, yw + T * S
    s.rect(X(-HALF) - 10, Yw1, 2 * HALF * S + 20, 400 - Yw1, fill=s.SOLO, stroke='none')
    s.text(X(-HALF) + 8, 392, 'solo', size=T_TXT, anchor='start', color=C['soil'], weight='bold', halo=True)
    s.rect(X(-HALF), Yw0, 2 * HALF * S, T * S, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    if enterrado:
        cy0, cy1 = Yw1, Yw0 + TEN * S
    else:
        cy0, cy1 = Yw0 - (TEN - T) * S, Yw0
    s.rect(X(-E / 2), cy0, E * S, cy1 - cy0, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
    with s.campo('pos_cf'):
        s.text(x0, 66, 'Enterrado — seção T' if enterrado else 'Aparente — seção retangular', size=T_TIT, weight='bold', color=C['grout'])
    for k in ((-76, -64, -52) if enterrado else (-70, -50, 50, 70)):
        s.arrow(X(k), Yw1 + 58, X(k), Yw1 + 6)
    lx = X(E / 2) + 16          # coluna dos rótulos à direita do contraforte
    if enterrado:
        bm = 70
        with s.campo('K_cf'):
            s.rect(X(-bm / 2), Yw0, bm * S, T * S, fill=C['mesa'], stroke=C['load'], sw=1.4, extra='fill-opacity="0.6"')
        s.dim_h(X(-bm / 2), X(bm / 2), Yw0 - 16, 'b_{m}')
        yb_ = cy1 - 7 * S
        with s.campo('phi_cf', 'n_cf_dir'):
            for dx in (-3.5, 0, 3.5):
                s.circle(X(dx), yb_, 4.4)
            s.text(lx, yb_ + 6, 'n Ø (tração)', size=T_TXT, anchor='start', color=C['steel'], weight='bold')
        with s.campo('c_cf_dir'):
            s.dim_v(X(-E / 2) - 22, yb_, cy1, 'c', side=-1, ext_from=(X(-3.5), X(-E / 2)), size=T_TXT)
        with s.campo('phi_cc', 'n_cc'):
            s.circle(X(-3.5), cy0 + 6 * S, 3.6, fill=C['block']); s.circle(X(3.5), cy0 + 6 * S, 3.6, fill=C['block'])
            s.text(lx, cy0 + 6 * S + 6, 'construtivas', size=T_TXT, anchor='start', color=C['note'])
        with s.campo('phi_est', 'ramos_est', 's_est'):
            s.rect(X(-3.5) - 6, cy0 + 4.5 * S, 7 * S + 12, (TEN - T - 9) * S + 12, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="5,3"')
            s.text(lx, (cy0 + cy1) / 2 + 6, 'estribo', size=T_TXT, anchor='start', color=C['steel'])
        with s.campo('tenr_'):
            s.dim_v(X(-E / 2) - 62, Yw0, cy1, 't_{enr}', side=-1, ext_from=(X(-E / 2), X(-E / 2)))
        # eenr = t (montagem fechada: deixou de ser entrada em 09/10) — sem data-campo
        s.dim_h(X(-E / 2), X(E / 2), cy1 + 26, 'e_{enr}', ext_from=(cy1, cy1))
    else:
        with s.campo('K_cf'):
            s.rect(X(-E / 2), cy0, E * S, 9 * S, fill=C['mesa'], stroke=C['load'], sw=1.4, extra='fill-opacity="0.6"')
            s.text(lx, cy0 + 4.5 * S + 6, 'ponta comprimida', size=T_TXT, anchor='start', color=C['mesa_txt'], weight='bold')
        yb_ = Yw1 - 7 * S
        with s.campo('phi_cf', 'n_cf_dir'):
            for dx in (-3.5, 0, 3.5):
                s.circle(X(dx), yb_, 4.4)
            s.chamada(X(3.5) + 5, yb_, lx + 6, yb_ - 26, 'n Ø (tração)', color=C['steel'], weight='bold')
        with s.campo('tenr_'):
            s.dim_v(X(-E / 2) - 26, cy0, Yw1, 't_{enr}', side=-1, ext_from=(X(-E / 2), X(-HALF)))
        # eenr = t (montagem fechada) — sem data-campo
        s.dim_h(X(-E / 2), X(E / 2), cy0 - 16, 'e_{enr}', ext_from=(cy0, cy0))
    with s.campo('l_cf', 'tipo_cf'):
        s.dim_h(X(-HALF + 5), X(HALF - 5), 440, 'ℓ (largura de influência)')
        s.line(X(-HALF + 5), 400, X(-HALF + 5), 446, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="3,3"')
        s.line(X(HALF - 5), 400, X(HALF - 5), 446, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="3,3"')


def desenhar():
    s = Fig(12, 1000, 480)
    caso(s, 270, True)
    caso(s, 760, False)
    s.line(515, 40, 515, 450, stroke=C['cinza2'], sw=1)
    return s
