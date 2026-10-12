# Fig. 2 (app) — área BRUTA × área LÍQUIDA do bloco (Jose, 12/10: "a imagem tem de demonstrar o que é e qual a
# diferença"). É a figura do campo "Área de referência do fpk": o fpk da tabela vale para uma das duas áreas, e a
# conta da aula 12.2 divide pelo Aliq/Abr para levar a resistência à área líquida (6/0,54 = 11,1 MPa).
#   - bruta: o retângulo inteiro L × t, furos incluídos;
#   - líquida: só o concreto (paredes e septos), sem os furos.
# A área que conta vai hachurada nas duas; o Aliq/Abr fica com número (é o catálogo que a conta usa, não exemplo).
# A fórmula fpk,liq = fpk/(Aliq/Abr) é da memória, não da figura (régua comum, 12/10).
# Régua: bloco a K_BLOCO (o 19 × 39 tem sempre 114 × 234 px, igual nas Figs. 3, 4 e 14).
from applib import Fig, C, T_PEQ, T_TIT, K_BLOCO

K = K_BLOCO / 100      # px por cm: o catálogo do bloco é em cm
BLOCOS = [('14 × 39', 14, 39, 2.7, '0,57'), ('19 × 39', 19, 39, 3.5, '0,54')]   # só a família 39 (09/10)


def desenhar():
    s = Fig(2, 1000, 640)
    # hachura da área de referência: traço cinza-escuro sobre o cinza do bloco (não é graute nem pressão)
    s.defs.append(f'<pattern id="{s.pid}-area" patternUnits="userSpaceOnUse" width="9" height="9" '
                  f'patternTransform="rotate(45)"><rect width="9" height="9" fill="{C["blockfill"]}"/>'
                  f'<line x1="0" y1="0" x2="0" y2="9" stroke="{C["dim"]}" stroke-width="1.6"/></pattern>')
    AREA = s.u('area')
    xs = (250, 610)                       # colunas: bruta, líquida
    ys = (150, 380)                       # linhas: bloco 14, bloco 19
    s.titulo_vista(xs[0], 92, 'Área bruta  A_{br}')
    s.titulo_vista(xs[1], 92, 'Área líquida  A_{liq}')
    for (nome, t, L, hf, rl), y0 in zip(BLOCOS, ys):
        s.text(xs[0] - 70, y0 + t * K / 2 + 7, nome, size=T_TIT, anchor='end', weight='bold')
        lh = (L - 3 * hf) / 2
        for col, x0 in enumerate(xs):
            X = lambda v, x0=x0: x0 + v * K
            Y = lambda v, y0=y0: y0 + v * K
            bruta = col == 0
            with s.campo('fbk_'):
                s.rect(X(0), Y(0), L * K, t * K, fill=AREA, stroke=C['line'], sw=1.4)
            for a in (hf, 2 * hf + lh):
                # bruta: o furo também é área (hachura passa por cima, só o contorno do furo aparece);
                # líquida: o furo é vazio (branco)
                s.rect(X(a), Y(hf), lh * K, (t - 2 * hf) * K, fill='none' if bruta else C['hollow'],
                       stroke=C['block'], sw=1.0, extra='rx="4"' + (' stroke-dasharray="4,3"' if bruta else ''))
            if bruta:
                s.dim_h(X(0), X(L), Y(t) + 30, 'L', ext_from=(Y(t), Y(t)))
                with s.campo('t_bloco'):
                    s.dim_v(X(0) - 24, Y(0), Y(t), 't', side=-1, ext_from=(X(0), X(0)))
            else:
                # parede do bloco (h_f) na área líquida, onde ela é o que sobra de concreto (Jose, 12/10); não é
                # entrada, mas é a mesa da seção I (Fig. 3)
                s.dim_v(X(L) + 22, Y(0), Y(hf), 'h_{f}', side=1, ext_from=(X(L), X(L)))
                with s.campo('fpk_ref'):
                    s.text(X(L / 2), Y(t) + 44, f'A_{{liq}}/A_{{br}} = {rl}', size=T_PEQ + 2)
    # legenda: o que a hachura quer dizer
    yl = 600
    s.rect(xs[0] - 70, yl - 13, 26, 14, fill=AREA, stroke=C['line'], sw=1)
    s.text(xs[0] - 36, yl, 'área de referência do f_{pk}', size=T_PEQ, anchor='start', color=C['note'])
    return s
