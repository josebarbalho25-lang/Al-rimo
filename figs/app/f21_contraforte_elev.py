# Fig. 21 (app, nova) — contraforte enterrado em corte vertical (perpendicular ao muro): barras principais
# na ponta com espera na sapata, construtivas junto ao muro, estribos nas juntas de assentamento a cada s
# (n_est = ROUNDUP(h/s), contrafortes.py), contraforte grauteado (γ próprio na fundação).
from applib import Fig, C, T_TXT, T_PEQ

K = 1.7          # px por cm


def desenhar():
    s = Fig(21, 1000, 640)
    xw, yb = 260, 540              # face externa do muro; topo da sapata
    t, ten, H = 19, 79, 260        # cm (proporção do desenho)
    X = lambda v: xw + v * K
    Y = lambda v: yb - v * K
    # solo atrás, sapata
    s.rect(X(t), Y(H), (ten - t + 70) * K, H * K, fill=s.SOLO, stroke='none')
    s.line(X(t), Y(H), X(ten + 70), Y(H), stroke=C['soil'], sw=2)
    s.rect(X(-40), Y(0), (ten + 110) * K, 34 * K, fill=s.CONC, stroke=C['line'], sw=1.2)
    s.text(X(-30), Y(0) + 34 * K - 14, 'sapata', size=T_PEQ, anchor='start', color=C['note'])
    # muro + contraforte (grauteado)
    s.rect(X(0), Y(H), t * K, H * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
    with s.campo('gama_cf'):
        s.rect(X(t), Y(H), (ten - t) * K, H * K, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        s.text(X((t + ten) / 2) + 14, Y(H / 2) - 40, 'γ_{cf}', size=20, color=C['grout'], halo=True)
    for f in range(1, int(H / 20)):
        s.line(X(0), Y(f * 20), X(ten), Y(f * 20), stroke=C['block'], sw=0.5)
    # estribos nas juntas (vista lateral: linha horizontal entre o muro e a ponta)
    with s.campo('phi_est', 's_est'):
        for f in range(0, int(H / 20)):
            yy = Y(f * 20) - 0.5 * K
            s.line(X(t) + 6, yy, X(ten) - 6, yy, stroke=C['steel'], sw=1.6)
    # principais na ponta, com espera e gancho para dentro da sapata
    c = 9
    with s.campo('phi_cf', 'n_cf_dir'):
        s.pline([(X(ten - c), Y(H) + 6), (X(ten - c), Y(-26)), (X(ten - c) - 50, Y(-26))], stroke=C['steel'], sw=3.2)
    with s.campo('phi_cc', 'n_cc'):
        s.line(X(t + 6), Y(H) + 6, X(t + 6), Y(0) - 4, stroke=C['block'], sw=2.6)
    # cotas
    with s.campo('s_est'):
        s.dim_v(X(ten) + 30, Y(120), Y(140), 's', side=1, ext_from=(X(ten), X(ten)), size=T_TXT)
    with s.campo('tenr_'):
        s.dim_h(X(0), X(ten), Y(H) - 30, 't_{enr}', ext_from=(Y(H), Y(H)))
    with s.campo('c_cf_dir'):
        # acima do topo: dentro do contraforte a cota cairia em cima do 1º estribo
        s.dim_h(X(ten - c), X(ten), Y(H) - 10, '', ext_from=(Y(H) + 6, Y(H)), size=T_TXT)
        s.text(X(ten) + 10, Y(H) - 10 + 6, 'c', size=T_TXT, anchor='start', color=C['dim'])
    s.dim_v(X(0) - 30, Y(H), Y(0), 'h', side=-1, ext_from=(X(0), X(0)))
    # rótulos
    xr = X(ten + 80)
    with s.campo('phi_cf', 'n_cf_dir'):
        s.chamada(X(ten - c), Y(60), xr, Y(60) + 6, 'n Ø (ponta)', color=C['steel'])
    with s.campo('phi_est', 's_est'):
        s.chamada(X(ten - 20), Y(180) - 0.5 * K, xr, Y(180) + 6, 'estribo Ø (na junta)', color=C['steel'])
    with s.campo('phi_cc', 'n_cc'):
        s.chamada(X(t + 6), Y(220), xr, Y(232), 'construtivas', color=C['note'])
    s.text(X(t / 2), Y(H) - 64, 'muro', size=T_PEQ, color=C['note'])
    s.text(X(ten + 50), Y(H) + 34, 'solo', size=T_TXT, color=C['soil'], weight='bold', halo=True)
    s.text(X(0) - 70, Y(H / 2), 'face externa', size=T_PEQ, color=C['note'], anchor='end')
    return s
