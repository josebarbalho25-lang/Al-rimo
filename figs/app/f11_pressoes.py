# Fig. 11 (app) — pressões no muro (Rankine): sem coesão, com coesão e com água. Saem as frases de
# conselho ("use só com ensaio", "drenagem eficiente evita..."): o aviso do solo já está no topo das Entradas.
# Régua comum (12/10, applib): os três diagramas viraram três cortes iguais ao da Fig. 1 — parede(), sapata() e solo
# à direita em K_GERAL, diagrama na face do solo com setas para o muro. Saíram os subtítulos com fórmula (σ'h = ...,
# u = γw·(z − zNA)) e a frase "tração desprezada": a memória mostra a conta. A água deixou a cor do graute: pressão
# d'água em C['pressao'] com traço C['water']; o NA pela na() da applib.
from applib import Fig, C, T_TIT, T_SIM, K_GERAL as K

T, HSO = 0.19, 2.0               # parede e altura de solo (m)
HM = HSO + 0.2                   # o muro passa um pouco do solo, como na Fig. 1
PONTA, TALAO, HS = 0.25, 0.5, 0.30
LARG = 110                       # largura do diagrama na base (px) — a de c' = 0; os outros se medem por ela
YB = 480                         # topo da sapata (pé da parede), igual nas três vistas


def corte(s, x, titulo, campos_titulo):
    """Um corte da régua: parede, sapata, solo à direita (terreno em h_solo) e o solo da frente no topo da sapata.
    Devolve (x da face do solo, y do terreno, x da borda direita do solo)."""
    tw = T * K
    xs = x + tw
    yt = YB - HSO * K
    xl, xr = x - (PONTA + 0.15) * K, xs + LARG + 40
    s.solo([(xl, YB), (xs, YB), (xs, yt), (xr, yt), (xr, YB + 0.45 * K), (xl, YB + 0.45 * K)])
    s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(xl, YB, x, YB, stroke=C['soil'], sw=2)
    s.sapata(x - PONTA * K, YB, PONTA + T + TALAO, HS)
    s.parede(x, YB, T, HM, barra=False)
    with s.campo(*campos_titulo):
        s.titulo_vista(xl, YB - HM * K - 62, titulo)
    return xs, yt, xr


def diagrama(s, xs, perfil, n=6):
    """Diagrama de pressão do solo na face xs, com o mesmo traço e as mesmas setas da empuxo() da applib — que só
    desenha o triângulo cheio. perfil = [(y, largura)] de cima para baixo; seta só onde há pressão."""
    pts = [(xs + w, y) for y, w in perfil]
    s.poly(pts + [(xs, perfil[-1][0]), (xs, perfil[0][0])], fill=C['empuxo'], stroke=C['load'], sw=1.4,
           extra='fill-opacity="0.75"')
    y0, y1 = perfil[0][0], perfil[-1][0]
    for i in range(1, n + 1):
        y = y0 + i / (n + 1) * (y1 - y0)
        for (ya, wa), (yb_, wb) in zip(perfil, perfil[1:]):
            if ya <= y <= yb_:
                w = wa + (wb - wa) * (y - ya) / (yb_ - ya)
                break
        if w > 12:
            s.arrow(xs + w - 2, y, xs + 3, y, sw=1.3)


def desenhar():
    s = Fig(11, 1000, 640)
    hpx = HSO * K

    # ── c' = 0: o triângulo de Rankine com a sobrecarga no terreno ──
    xs, yt, xr = corte(s, 150, "c' = 0", ['c_solo'])
    with s.campo('Ka_dir'):
        s.empuxo(xs, yt, YB, larg=LARG)
    with s.campo('q_sobre'):
        s.sobrecarga(xs + 16, xr - 10, yt)

    # ── c' > 0: pressão nula até z0 (a tração do topo é desprezada), depois cresce até a base ──
    xs, yt, xr = corte(s, 450, "c' > 0", ['c_solo'])
    z0 = 0.35 * hpx
    with s.campo('c_solo'):
        diagrama(s, xs, [(yt + z0, 0), (YB, LARG * 0.68)])
        s.dim_v(xs + 72, yt, yt + z0, 'z_{0}', side=1, ext_from=(xs, xs), halo=True)
        s.text(xr - 34, YB - 30, "c'", size=21, color=C['soil'], halo=True)

    # ── com NA: abaixo do NA a efetiva cresce mais devagar (γ') e soma-se a pressão d'água u ──
    xs, yt, xr = corte(s, 750, 'Com NA', ['Agua'])
    zna = 0.4 * hpx
    w_na = 6 + (LARG - 6) * 0.4
    w_base = w_na + (LARG - 6) * 0.6 * 0.5
    w_u = 0.42 * LARG
    diagrama(s, xs, [(yt, 6), (yt + zna, w_na), (YB, w_base)])
    with s.campo('Agua', 'gama_w'):
        s.poly([(xs + w_na, yt + zna), (xs + w_base + w_u, YB), (xs + w_base, YB)], fill=C['pressao'],
               stroke=C['water'], sw=1.4)
    with s.campo('gama_w'):
        s.text(xs + w_base + w_u * 0.55, YB - 12, 'u', size=T_SIM, color=C['water'], weight='bold', halo=True)
    with s.campo('z_NA', 'Agua'):
        s.na(xs, xr, yt + zna)
        s.dim_v(xr + 26, yt, yt + zna, 'z_{NA}', side=1, ext_from=(xr, xr))
    return s
