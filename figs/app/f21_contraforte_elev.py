# Fig. 21 (app, nova) — contraforte enterrado em corte vertical (perpendicular ao muro): barras principais
# na ponta com espera na sapata, construtivas junto ao muro, estribos nas juntas de assentamento a cada s
# (n_est = ROUNDUP(h/s), contrafortes.py), contraforte grauteado (γ próprio na fundação).
# Régua comum (12/10, applib):
#   - corte geral do muro → K_GERAL (era 1,7 px/cm, solto); parede, sapata e solo pelas peças padrão, solo à
#     direita, com o terreno também do lado de fora, no topo da sapata, como na Fig. 1;
#   - símbolos da memória: h_{muro}, t_{enr}, c_{cf}, s_{est}, γ_{cf};
#   - as construtivas também têm espera na sapata (a memória confere a dobra delas, h_dob,cc) e passam a ser aço
#     vermelho como as outras — eram uma linha cinza sem espera; ficam mais finas que as principais;
#   - chamadas de uma palavra, fora do solo; saem "face externa", "muro", "sapata" e "solo" escritos (a hachura
#     e o pontilhado já dizem o que é cada peça).
# A peça "contraforte em corte" não existe na applib: é o retângulo de graute desenhado aqui (graute, como manda
# a régua para contraforte em corte).
from applib import Fig, C, T_SIM, T_TXT, K_GERAL as K

T, TEN, H = 0.19, 0.79, 2.6          # m: parede (bloco 19), t_enr (da lista do bloco 19), h_muro
HS, PONTA, TALAO = 0.35, 0.45, 0.45  # m: altura da sapata; sapata além da face externa e além da ponta
CCF = 0.10                           # m: c_cf, da ponta ao eixo das principais
XCC = T + 0.06                       # m: construtivas, junto à parede
FIADA = 0.20


def desenhar():
    s = Fig(21, 1000, 640)
    xw, yb = 400, 520                # face externa da parede; topo da sapata
    X = lambda v: xw + v * K
    Y = lambda v: yb - v * K
    xr = X(TEN + 0.85)               # fim do solo desenhado, à direita
    ysb = yb + HS * K                # fundo da sapata
    # terreno: um polígono só (dois com a mesma hachura deixam costura na emenda), como na Fig. 1
    s.solo([(X(-PONTA - 0.5), yb), (X(TEN), yb), (X(TEN), Y(H)), (xr, Y(H)), (xr, ysb + 40), (X(-PONTA - 0.5), ysb + 40)])
    s.line(X(TEN), Y(H), xr, Y(H), stroke=C['soil'], sw=2)
    s.line(X(-PONTA - 0.5), yb, X(0), yb, stroke=C['soil'], sw=2)
    s.sapata(X(-PONTA), yb, PONTA + TEN + TALAO, HS)
    s.parede(X(0), yb, T, H, barra=False)
    with s.campo('gama_cf'):
        s.rect(X(T), Y(H), (TEN - T) * K, H * K, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        # no vão entre dois estribos (30 px): em cima de um deles, o halo cortava a linha vermelha
        s.text(X((T + TEN) / 2), Y(1.1) + 2, 'γ_{cf}', size=T_TXT, color=C['grout'], halo=True)
    # juntas de assentamento (a cada fiada), na parede e no contraforte: é nelas que vão os estribos
    n = int(round(H / FIADA))
    for f in range(1, n):
        s.line(X(0), Y(f * FIADA), X(TEN), Y(f * FIADA), stroke=C['block'], sw=0.5)
    with s.campo('phi_est', 's_est'):
        for f in range(0, n):
            yy = Y(f * FIADA) - 2
            s.line(X(T) + 4, yy, X(TEN) - 4, yy, stroke=C['steel'], sw=1.4)
    # principais na ponta e construtivas junto à parede, as duas com espera e gancho para o lado do solo (como a
    # espera da parede na applib); a sapata passa da ponta o bastante para o gancho ficar dentro dela
    ye = ysb - 0.07 * K
    with s.campo('phi_cf', 'n_cf_dir'):
        s.pline([(X(TEN - CCF), Y(H) + 5), (X(TEN - CCF), ye), (X(TEN - CCF + 0.3), ye)], stroke=C['steel'], sw=3)
    with s.campo('phi_cc', 'n_cc'):
        s.pline([(X(XCC), Y(H) + 5), (X(XCC), ye - 6), (X(XCC + 0.2), ye - 6)], stroke=C['steel'], sw=2)
    # cotas
    with s.campo('s_est'):
        s.dim_v(X(TEN) + 26, Y(1.2) - 2, Y(1.4) - 2, 's_{est}', side=1, ext_from=(X(TEN), X(TEN)), halo=True)
    with s.campo('tenr_'):
        s.dim_h(X(0), X(TEN), Y(H) - 44, 't_{enr}', ext_from=(Y(H), Y(H)))
    with s.campo('c_cf_dir'):
        # acima do topo: dentro do contraforte a cota cairia em cima do 1º estribo; curta demais para o rótulo
        # no meio, ele vai ao lado
        s.dim_h(X(TEN - CCF), X(TEN), Y(H) - 14, '', ext_from=(Y(H) + 5, Y(H)))
        s.text(X(TEN) + 10, Y(H) - 8, 'c_{cf}', size=T_SIM, anchor='start', color=C['dim'])
    s.dim_v(X(0) - 32, Y(H), yb, 'h_{muro}', side=-1, ext_from=(X(0), X(0)))
    # chamadas: texto fora do solo, na ordem de cima para baixo (as linhas não se cruzam); a das barras toca no vão
    # entre dois estribos — num cruzamento, não se sabe se aponta a barra ou o estribo
    xt = xr + 22
    with s.campo('phi_cc', 'n_cc'):
        s.chamada(X(XCC), Y(2.1), xt, Y(2.1) + 6, 'construtivas', color=C['steel'])
    with s.campo('phi_est', 's_est'):
        s.chamada(X(TEN - CCF / 2), Y(1.8) - 2, xt, Y(1.7) + 6, 'estribo', color=C['steel'])
    with s.campo('phi_cf', 'n_cf_dir'):
        s.chamada(X(TEN - CCF), Y(0.9), xt, Y(0.9) + 6, 'principais', color=C['steel'])
    return s
