# Fig. 2 (app) — blocos de concreto em planta. As medidas dos blocos e o Aliq/Abr ficam com número: são o
# catálogo que a conta usa (não resultado de exemplo). As cotas t e L viram símbolo, porque são as entradas.
# Régua comum (12/10, applib): bloco a K_BLOCO (o 19 × 39 tem sempre 114 × 234 px, igual nas Figs. 3, 4 e 14);
# nome do bloco por titulo_vista; a parede do bloco (h_f) por cota normal, não mais por seta desenhada à mão.
from applib import Fig, C, T_PEQ, K_BLOCO

K = K_BLOCO / 100      # px por cm: o catálogo do bloco é em cm
BLOCOS = [('Bloco 14 × 39', 14, 39, 2.7, '0,57'), ('Bloco 19 × 39', 19, 39, 3.5, '0,54')]   # só a família 39 (09/10)


def desenhar():
    s = Fig(2, 1000, 640)
    x = 110
    y0 = 240
    # cotas de L e o Aliq/Abr na MESMA altura nos dois blocos (pela base do mais alto): lado a lado, o olho compara
    # as duas linhas; com cada um na base do seu bloco, as linhas ficariam em degrau
    yL = y0 + 19 * K + 34
    for nome, t, L, hf, rl in BLOCOS:
        X = lambda v: x + v * K
        Y = lambda v: y0 + v * K
        s.titulo_vista(X(0), y0 - 30, nome)
        with s.campo('fbk_'):
            s.rect(X(0), Y(0), L * K, t * K, fill=C['blockfill'], stroke=C['block'], sw=1.4)
        lh = (L - 3 * hf) / 2
        for a in (hf, 2 * hf + lh):
            s.rect(X(a), Y(hf), lh * K, (t - 2 * hf) * K, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="4"')
        # comprimento: fixo na família 39 (deixou de ser entrada em 09/10) — sem data-campo
        s.dim_h(X(0), X(L), yL, 'L', ext_from=(Y(t), Y(t)))
        with s.campo('t_bloco'):
            s.dim_v(X(0) - 24, Y(0), Y(t), 't', side=-1, ext_from=(X(0), X(0)))
        # parede do bloco (h_f): não é entrada, mas é a mesa da seção I (Fig. 3)
        s.dim_v(X(L) + 22, Y(0), Y(hf), 'h_{f}', side=1, ext_from=(X(L), X(L)))
        with s.campo('fpk_ref'):
            s.text(X(L / 2), yL + 50, f'A_{{liq}}/A_{{br}} = {rl}', size=T_PEQ + 2)
        x += L * K + 150
    return s
