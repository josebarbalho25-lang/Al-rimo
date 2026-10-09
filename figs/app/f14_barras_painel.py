# Fig. 14 (app) — barras do painel entre contrafortes: planta do furo (verticais) e corte da canaleta
# (horizontal). A planta da fig14 da planilha era do bloco CERÂMICO 14×29 da aula (parede 2,2; furos 13,6 e 8);
# aqui é bloco de concreto, em proporção genérica. A faixa vermelha e o "Na obra" saem (tutorial).
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

T, HF = 19, 3.5


def planta(s, x0, y0, S, duas, rotulo):
    X = lambda v: x0 + v * S
    Y = lambda v: y0 + v * S
    L = 39
    s.rect(X(0), Y(0), L * S, T * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    lh = (L - 3 * HF) / 2
    s.rect(X(HF), Y(HF), lh * S, (T - 2 * HF) * S, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="5"')
    s.rect(X(2 * HF + lh), Y(HF), lh * S, (T - 2 * HF) * S, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="5"')
    xb = HF + lh / 2
    with s.campo('pos_pv'):
        if duas:
            for yy in (5, T - 5):
                s.circle(X(xb), Y(yy), 0.5 * S + 1.6)
        else:
            s.circle(X(xb), Y(T / 2), 0.5 * S + 1.6)
        s.text(X(L / 2), Y(T) + 58, rotulo, size=T_TXT, weight='bold')
    return X, Y, xb


def desenhar():
    s = Fig(14, 1000, 520)
    # planta: duas barras (padrão) e a alternativa de uma barra centralizada
    S = 7.0
    x0, y0 = 90, 130
    s.text(x0 + 39 * S / 2, 60, 'Planta — barras verticais', size=T_TIT, weight='bold')
    X, Y, xb = planta(s, x0, y0, S, True, '2 barras (uma em cada face)')
    s.text(X(39 / 2), y0 - 14, 'solo', size=T_PEQ + 2, color=C['soil'], weight='bold')
    s.text(X(39 / 2), Y(T) + 26, 'face externa', size=T_PEQ + 2, color=C['note'])
    with s.campo('c_pv'):
        s.dim_v(X(0) - 26, Y(0), Y(5), 'c', side=-1, ext_from=(X(xb), X(0)), size=T_TXT)
        s.dim_v(X(0) - 26, Y(T - 5), Y(T), 'c', side=-1, ext_from=(X(xb), X(0)), size=T_TXT)
    s.dim_v(X(39) + 24, Y(5), Y(T), 'd', side=1, ext_from=(X(xb), X(39)))
    with s.campo('K_pv'):
        s.text(X(39 / 2), Y(T) + 92, 'flexão vertical: K', size=T_TXT, color=C['note'])
    # alternativa: uma barra centralizada (menor)
    S2 = 4.0
    x2, y2 = 440, 160
    planta(s, x2, y2, S2, False, '1 barra centralizada')
    # corte da canaleta com a barra horizontal
    S3 = 7.0
    cx, cy = 700, 130
    Xc = lambda v: cx + v * S3
    Yc = lambda v: cy + v * S3
    s.text(Xc(T / 2), 60, 'Corte — canaleta', size=T_TIT, weight='bold')
    s.poly([(Xc(0), Yc(0)), (Xc(HF), Yc(0)), (Xc(HF), Yc(17)), (Xc(T - HF), Yc(17)), (Xc(T - HF), Yc(0)), (Xc(T), Yc(0)), (Xc(T), Yc(19)), (Xc(0), Yc(19))],
           fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.rect(Xc(HF), Yc(0), (T - 2 * HF) * S3, 17 * S3, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
    with s.campo('pos_ph'):
        s.circle(Xc(T / 2), Yc(10), 0.625 * S3 + 1.6)
        s.circle(Xc(T - 5), Yc(10), 0.625 * S3 + 1.2, fill='none', stroke=C['steel'], sw=1.6)
        s.dim_h(Xc(0), Xc(T / 2), Yc(0) - 10, 't/2', size=T_TXT)
    s.rect(Xc(0), Yc(19), T * S3, 9 * S3, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    s.rect(Xc(HF), Yc(19), (T - 2 * HF) * S3, 9 * S3, fill=C['hollow'], stroke=C['block'], sw=1.0)
    with s.campo('bwh_els'):
        s.dim_v(Xc(T) + 24, Yc(0), Yc(19), 'b_{w}', side=1, ext_from=(Xc(T), Xc(T)))
    s.text(Xc(0) - 10, Yc(10) + 6, 'solo', size=T_PEQ + 2, anchor='end', color=C['soil'], weight='bold')
    s.text(Xc(T) + 12, Yc(24) + 6, 'face externa', size=T_PEQ + 1, anchor='start', color=C['note'])
    with s.campo('K_ph'):
        s.text(Xc(T / 2), Yc(28) + 34, 'flexão horizontal: K', size=T_TXT, color=C['note'])
    return s
