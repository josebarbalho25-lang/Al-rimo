# Fig. 14 (app) — barras do painel entre contrafortes: planta do furo (verticais) e corte da canaleta
# (horizontal). A planta da fig14 da planilha era do bloco CERÂMICO 14×29 da aula (parede 2,2; furos 13,6 e 8);
# aqui é bloco de concreto 19 × 39. A faixa vermelha e o "Na obra" saem (tutorial).
# Régua comum (12/10, applib):
#   - tudo a K_BLOCO: antes a planta das 2 barras estava a 7 px/cm e a de 1 barra a 4 — a mesma peça em dois
#     tamanhos na mesma figura parecia blocos diferentes;
#   - planta com o solo em cima; corte com o solo à DIREITA (antes estava à esquerda), como todo corte do app;
#   - símbolos da memória do painel: c_{p}, d_{v}, h_{can};
#   - saem as frases "flexão vertical: K" / "flexão horizontal: K": os campos K_pv e K_ph ficam na seção que cada
#     K governa (a planta é a seção da flexão vertical; a canaleta, a da horizontal).
from applib import Fig, C, K_BLOCO

K = K_BLOCO / 100        # px por cm
T, L, HF = 19, 39, 3.5
LH = (L - 3 * HF) / 2
XB = HF + LH / 2         # eixo do furo grauteado
CP = 5                   # c_p: face → eixo da barra (aula 12.3)
R_BARRA = 0.625 * K + 1.5
SOLO = 30                # px: faixa de solo atrás da parede


def planta(s, x0, y0, duas, titulo):
    X = lambda v: x0 + v * K
    Y = lambda v: y0 + v * K
    with s.campo('pos_pv'):
        s.titulo_vista(X(0), y0 - 80, titulo)
    s.solo([(X(0), Y(0) - SOLO), (X(L), Y(0) - SOLO), (X(L), Y(0)), (X(0), Y(0))])
    with s.campo('K_pv'):
        s.rect(X(0), Y(0), L * K, T * K, fill=C['blockfill'], stroke=C['block'], sw=1.4)
        s.rect(X(HF), Y(HF), LH * K, (T - 2 * HF) * K, fill=C['groutfill'], stroke=C['grout'], sw=1.2, extra='rx="4"')
        s.rect(X(2 * HF + LH), Y(HF), LH * K, (T - 2 * HF) * K, fill=C['hollow'], stroke=C['block'], sw=1.0, extra='rx="4"')
    with s.campo('pos_pv'):
        for yy in ((CP, T - CP) if duas else (T / 2,)):
            s.circle(X(XB), Y(yy), R_BARRA)
    return X, Y


def desenhar():
    s = Fig(14, 1000, 640)
    y0 = 250
    # planta: duas barras (padrão: o momento troca de sinal — base traciona o solo, vão traciona o lado de fora)
    X, Y = planta(s, 90, y0, True, 'Planta — 2 barras')
    with s.campo('c_pv'):
        s.dim_v(X(0) - 26, Y(0), Y(CP), 'c_{p}', side=-1, ext_from=(X(0), X(XB)))
        s.dim_v(X(0) - 26, Y(T - CP), Y(T), 'c_{p}', side=-1, ext_from=(X(XB), X(0)))
    s.dim_v(X(L) + 24, Y(CP), Y(T), 'd_{v}', side=1, ext_from=(X(XB), X(L)))
    # a alternativa: uma barra no meio do furo, na mesma escala
    planta(s, 90 + L * K + 110, y0, False, 'Planta — 1 barra')
    # corte da canaleta com a barra horizontal: face externa à esquerda, solo à direita
    cx = 790
    Xc = lambda v: cx + v * K
    Yc = lambda v: y0 + v * K
    s.titulo_vista(Xc(0) - 70, y0 - 80, 'Corte — canaleta')
    s.solo([(Xc(T), Yc(0)), (Xc(T) + SOLO, Yc(0)), (Xc(T) + SOLO, Yc(29)), (Xc(T), Yc(29))])
    with s.campo('K_ph'):
        # canaleta (U) cortada: duas paredes de h_f e o fundo; o graute enche até o topo
        s.poly([(Xc(0), Yc(0)), (Xc(HF), Yc(0)), (Xc(HF), Yc(17)), (Xc(T - HF), Yc(17)), (Xc(T - HF), Yc(0)),
                (Xc(T), Yc(0)), (Xc(T), Yc(19)), (Xc(0), Yc(19))], fill=C['blockfill'], stroke=C['block'], sw=1.4)
        s.rect(Xc(HF), Yc(0), (T - 2 * HF) * K, 17 * K, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
    # bloco vazado da fiada de baixo, cortado (só o começo dele: o que interessa é a canaleta)
    s.rect(Xc(0), Yc(19), T * K, 10 * K, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    s.rect(Xc(HF), Yc(19), (T - 2 * HF) * K, 10 * K, fill=C['hollow'], stroke=C['block'], sw=1.0)
    with s.campo('pos_ph'):
        # cheia: centralizada (padrão, d_h = t/2); vazada: a alternativa, encostada na face externa
        s.circle(Xc(T / 2), Yc(10), R_BARRA)
        s.circle(Xc(CP), Yc(10), R_BARRA - 0.6, fill='none', stroke=C['steel'], sw=1.6)
        s.dim_h(Xc(0), Xc(T / 2), Yc(0) - 44, 't/2', ext_from=(Yc(0), Yc(0)))
        s.dim_h(Xc(0), Xc(CP), Yc(0) - 14, '', ext_from=(Yc(0), Yc(0)))
        s.text(Xc(0) - 8, Yc(0) - 8, 'c_{p}', anchor='end', size=20, color=C['dim'])
    with s.campo('bwh_els'):
        s.dim_v(Xc(0) - 26, Yc(0), Yc(19), 'h_{can}', side=-1, ext_from=(Xc(0), Xc(0)))
    return s
