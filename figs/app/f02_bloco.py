# Fig. 2 (app) — blocos de concreto em planta. As medidas dos blocos e o Aliq/Abr ficam com número: são o
# catálogo que a conta usa (não resultado de exemplo). As cotas t e L viram símbolo, porque são as entradas.
from applib import Fig, C, T_TIT, T_PEQ

BLOCOS = [('14 × 39', 14, 39, 2.7, '0,57'), ('19 × 39', 19, 39, 3.5, '0,54')]   # só a família 39 (09/10)


def desenhar():
    s = Fig(2, 1000, 400)
    S = 6.0
    x = 60
    y0 = 100
    for nome, t, L, hf, rl in BLOCOS:
        X = lambda v: x + v * S
        Y = lambda v: y0 + v * S
        s.text(X(L / 2), y0 - 34, nome, size=T_TIT, weight='bold')
        with s.campo('fbk_'):
            s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
        lh = (L - 3 * hf) / 2
        for a in (hf, 2 * hf + lh):
            s.rect(X(a), Y(hf), lh * S, (t - 2 * hf) * S, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="4"')
        # comprimento: fixo na família 39 (deixou de ser entrada em 09/10) — sem data-campo
        s.dim_h(X(0), X(L), Y(t) + 34, 'L', ext_from=(Y(t), Y(t)))
        with s.campo('t_bloco'):
            s.dim_v(X(0) - 24, Y(0), Y(t), 't', side=-1, ext_from=(X(0), X(0)))
        # parede do bloco (hf): não é entrada, mas é a mesa da seção I
        s.line(X(L), Y(0), X(L) + 28, Y(0), stroke=C['dim'], sw=0.7)
        s.line(X(L), Y(hf), X(L) + 28, Y(hf), stroke=C['dim'], sw=0.7)
        s.add(f'<line x1="{X(L) + 22:.1f}" y1="{Y(0) - 12:.1f}" x2="{X(L) + 22:.1f}" y2="{Y(hf):.1f}" stroke="{C["dim"]}" stroke-width="1" marker-end="{s.u("tick")}"/>')
        s.text(X(L) + 30, Y(hf / 2) + 6, 'h_{f}', size=T_PEQ + 2, anchor='start', color=C['dim'])
        with s.campo('fpk_ref'):
            s.text(X(L / 2), Y(19) + 82, f'A_{{liq}}/A_{{br}} = {rl}', size=T_PEQ + 2)
        x += L * S + 125
    return s
