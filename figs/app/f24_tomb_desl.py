# Fig. 24 (app) — tombamento e deslizamento da sapata corrida (roteiro da Fig. 1.116 do Bastos, UNESP, Sapatas de
# Fundação, §1.8). Dois cortes lado a lado: momentos em torno do pé e forças horizontais na base.
# Régua comum (12/10, applib): refeita inteira. Antes era só contorno, menor que as outras (−22 %), com cargas pretas,
# títulos embaixo, "h" na altura da sapata e uma cota "(H + h)/3" com um H que não existe. Agora: o mesmo corte da
# Fig. 15 em K_GERAL com parede(), sapata(), solo() à direita, empuxo() e sobrecarga(); cargas em laranja; título de
# vista em cima; h_s; sem fórmula. Os símbolos são os da memória (N_muro, N_solo, N_sap, E_a, M_est, M_tomb, R_at,
# R_ad, E_p) e o FS fica no grupo das forças que ele compara — FS não é força, não ganha seta.
import math
from applib import Fig, C, T_SIM, K_GERAL as K

B, A, TM, HS, HM = 1.40, 0.95, 0.19, 0.30, 1.6
HSO = HM - 0.2                          # o muro passa um pouco do aterro, como na Fig. 1
FRENTE, FUNDO, ABAIXO = 0.55, 0.85, 0.45  # solo mostrado à esquerda, à direita e abaixo da base (m)
XA = B - A                              # eixo do muro medido da borda da frente (a é medido da borda aterrada)
XW0, XW1 = XA - TM / 2, XA + TM / 2


def arco(s, cx, cy, r, g0, g1, rotulo, lado):
    """Momento em torno do pé: arco laranja de g0 a g1 graus (sentido da tela: g crescente = horário) com a ponta
    em g1. O rótulo vai na cor da linha (régua: rótulo de momento não é carga)."""
    a0, a1 = math.radians(g0), math.radians(g1)
    p0 = (cx + r * math.cos(a0), cy + r * math.sin(a0))
    p1 = (cx + r * math.cos(a1), cy + r * math.sin(a1))
    gm = math.radians((g0 + g1) / 2)
    s.path(f'M{p0[0]:.1f},{p0[1]:.1f} A{r},{r} 0 0 {1 if g1 > g0 else 0} {p1[0]:.1f},{p1[1]:.1f}',
           [p0, p1, (cx + r * math.cos(gm), cy + r * math.sin(gm))],
           stroke=C['load'], sw=2.2, extra=f'marker-end="{s.u("arrL")}"')
    px, py = (p0, p1)[lado]
    s.text(px - 8, py + 6, rotulo, size=T_SIM, anchor='end', color=C['line'], halo=True)


def corte(s, x0, yb, titulo):
    """O corte comum aos dois painéis (o da Fig. 15 sem dente). Devolve as funções X, Y de metro para px."""
    X = lambda v: x0 + v * K
    Y = lambda v: yb - v * K
    # terreno: um polígono só; solo da frente no topo da sapata, aterro à direita até h_solo
    s.solo([(X(-FRENTE), Y(HS)), (X(XW1), Y(HS)), (X(XW1), Y(HS + HSO)), (X(B + FUNDO), Y(HS + HSO)),
            (X(B + FUNDO), Y(-ABAIXO)), (X(-FRENTE), Y(-ABAIXO))])
    s.line(X(XW1), Y(HS + HSO), X(B + FUNDO), Y(HS + HSO), stroke=C['soil'], sw=2)
    s.line(X(-FRENTE), Y(HS), X(XW0), Y(HS), stroke=C['soil'], sw=2)
    # empuxo até a base da sapata, no plano da borda aterrada (o solo sobre o talão entra como peso)
    s.empuxo(X(B), Y(HS + HSO), Y(0), larg=100)
    s.text(X(B) + 100 * 0.62 + 10, Y(HS + HSO * 0.30), 'E_{a}', size=T_SIM, anchor='start', color=C['load'],
           weight='bold', halo=True)
    s.sapata(X(0), Y(HS), B, HS)
    s.parede(X(XW0), Y(HS), TM, HM, barra=False)
    with s.campo('q_est'):
        s.sobrecarga(X(XW1) + 20, X(B + FUNDO) - 12, Y(HS + HSO))
    s.titulo_vista(X(-FRENTE), Y(HS + HM) - 52, titulo)
    return X, Y


def desenhar():
    s = Fig(24, 1000, 640)
    yb = 430

    # ── Tombamento: momentos em torno do pé (canto da frente da base) ──────────────────────────────────────
    X, Y = corte(s, 120, yb, 'Tombamento')
    # pesos (estabilizam): o do muro desenhado DENTRO da parede, como o σsg da Fig. 10; o do solo sobre o talão no
    # meio do talão; o da sapata no meio da base
    s.arrow(X(XA), Y(HS + HM * 0.72), X(XA), Y(HS + HM * 0.30), sw=2.2)
    s.text(X(XW0) - 8, Y(HS + HM * 0.52), 'N_{muro}', size=T_SIM, anchor='end', color=C['load'], weight='bold', halo=True)
    xt = (XW1 + B) / 2
    s.arrow(X(xt), Y(HS + HSO * 0.62), X(xt), Y(HS) - 3, sw=2.2)
    s.text(X(xt) + 8, Y(HS + HSO * 0.48), 'N_{solo}', size=T_SIM, anchor='start', color=C['load'], weight='bold', halo=True)
    s.arrow(X(B / 2), Y(HS) + 4, X(B / 2), Y(0) - 3, sw=2.2)
    s.text(X(B / 2), Y(0) + 24, 'N_{sap}', size=T_SIM, color=C['load'], weight='bold', halo=True)
    with s.campo('FS_tomb'):
        # anti-horário na tela = o empuxo virando o muro para fora (arco por cima da ponta, no ar); horário = os
        # pesos segurando (arco por baixo do pé, no solo da frente). Um de cada lado do pé: os dois rótulos não se
        # encostam e o sentido de cada um se lê sem cruzar o outro.
        s.circle(X(0), Y(0), 5, fill=C['load'])
        arco(s, X(0), Y(0), 86, 302, 236, 'M_{tomb}', 1)
        arco(s, X(0), Y(0), 72, 98, 172, 'M_{est}', 1)
    with s.campo('h_sap'):
        s.dim_v(X(B) - 22, Y(HS), Y(0), 'h_{s}', side=-1, halo=True)
    with s.campo('B_sap'):
        s.dim_h(X(0), X(B), Y(-ABAIXO) + 34, 'B', ext_from=(Y(0), Y(0)))

    # ── Deslizamento: forças horizontais na base ─────────────────────────────────────────────────────────────
    X, Y = corte(s, 580, yb, 'Deslizamento')
    with s.campo('FS_desl'):
        # atrito e adesão na base: puxam a sapata de volta para o lado do solo
        yf = Y(0) + 12
        for k in range(5):
            xx = X(0.10 + k * 0.27)
            s.arrow(xx, yf, xx + 30, yf, sw=1.6)
        with s.campo('dphi'):
            s.text(X(B * 0.30), yf + 30, 'R_{at}', size=T_SIM, color=C['load'], weight='bold', halo=True)
        with s.campo('ades_b'):
            s.text(X(B * 0.72), yf + 30, 'R_{ad}', size=T_SIM, color=C['load'], weight='bold', halo=True)
        # passivo na frente da ponta, do topo do solo da frente à base
        with s.campo('pass_on'):
            s.poly([(X(0), Y(HS)), (X(0), Y(0)), (X(0) - 40, Y(0))], fill=C['passivo_fill'], stroke=C['passivo'], sw=1.2)
            for f in (0.45, 0.8):
                s.arrow(X(0) - 40 * f + 2, Y(HS * (1 - f)), X(0) - 3, Y(HS * (1 - f)), color=C['passivo'], sw=1.2,
                        marker='arrP')
            s.text(X(0) - 48, Y(0) - 4, 'E_{p}', size=T_SIM, anchor='end', color=C['passivo_txt'], weight='bold', halo=True)
    return s
