# Fig. 4 (app) — posição da barra vertical do balanço. A fig04 da planilha é a mais "tutorial" (faixa
# vermelha, "Por que importa", "Como garantir na obra"); aqui sobra só o desenho: o certo e o errado lado a lado,
# com d em cada um. Os sinais de certo/errado são desenhados (✔/✘ não existem no Arial).
from applib import Fig, C, T_TIT, T_PEQ

S = 11.0


def celula(s, x0, y0, bary, ok):
    t, hf, L = 19, 3.5, 21.25
    X = lambda v: x0 + v * S
    Y = lambda v: y0 + v * S
    s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    s.rect(X(3.5), Y(hf), 14.25 * S, 12 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="5"')
    s.circle(X(10.625), Y(bary), 0.625 * S + 1.6)
    s.text(X(L / 2), Y(0) - 14, 'solo', size=T_PEQ + 2, color=C['soil'], weight='bold')
    s.text(X(L / 2), Y(t) + 26, 'face externa', size=T_PEQ + 2, color=C['note'])
    with s.campo('d_dir'):
        s.dim_v(X(0) - 30, Y(bary), Y(t), 'd' if ok else 'd = t/2', side=-1, ext_from=(X(10.625), X(0)))
    if ok:
        s.dim_v(X(L) + 26, Y(0), Y(bary), 'c', side=1, ext_from=(X(10.625), X(L)))
    else:
        s.dim_v(X(L) + 26, Y(0), Y(bary), 't/2', side=1, ext_from=(X(10.625), X(L)))


def desenhar():
    s = Fig(4, 1000, 460)
    # certo
    s.rect(40, 40, 440, 370, fill=C['ok_fill'], stroke=C['ok'], sw=2)
    s.pline([(66, 76), (76, 87), (96, 62)], stroke=C['ok'], sw=4)
    s.text(270, 82, 'encostada no lado do solo', size=T_TIT, weight='bold', color=C['ok'])
    celula(s, 143, 160, 5.0, True)
    # errado
    s.rect(520, 40, 440, 370, fill=C['erro_fill'], stroke=C['erro'], sw=2)
    s.line(548, 62, 570, 86, stroke=C['erro'], sw=4)
    s.line(570, 62, 548, 86, stroke=C['erro'], sw=4)
    s.text(750, 82, 'centralizada', size=T_TIT, weight='bold', color=C['erro'])
    celula(s, 623, 160, 9.5, False)
    return s
