# Fig. 12 (app) — contraforte em planta: enterrado (seção T) × aparente (retangular). Saem os números da
# aula 12.3 (bm 86,7, 3Ø10, d 52, Ø6,3 c/20) e os fpk do bloco CERÂMICO (6,0 e 9,6): o app é só de concreto.
# Desenho genérico — não desenha o encaixe dos blocos (na família 14 ele ainda é provisório).
# Régua comum (12/10, applib):
#   - PLANTA COM O SOLO EM CIMA (antes embaixo): enterrado, o contraforte sobe para dentro do solo; aparente, desce
#     para o lado de fora. O empuxo empurra a parede para baixo, do solo para fora;
#   - escala K_DETALHE (seção com armadura). Nela o ℓ padrão (1,60 m) daria 640 px por vista e as duas não caberiam
#     lado a lado: o ℓ do desenho é 1,00 m (está na lista, de 0,80 a 4,00) — a cota é só símbolo, não diz o número;
#   - parede 19 e t_{enr} 59 (os padrões do bloco 19), e_{enr} = t;
#   - títulos por titulo_vista; símbolos da memória do contraforte: t_{enr}, e_{enr}, c_{cf}, b_{m,cf}, ℓ_{cf};
#   - todo aço em vermelho (as construtivas eram cinza e liam como furo); a mesa comprimida segue na cor de mesa,
#     com contorno da mesma família (o contorno laranja de carga dizia "força").
# A peça "contraforte em planta" não existe na applib: é desenhada aqui (graute, como manda a régua).
from applib import Fig, C, K_DETALHE

K = K_DETALHE / 100      # px por cm
T, TEN, LCF = 19, 59, 100            # cm: parede (bloco 19), t_enr, ℓ do desenho (ver acima)
E = T                                # e_enr = t (montagem fechada)
CCF = 10                             # c_cf: da face tracionada ao eixo das barras (Revit, bloco 19)
BM = 50                              # b_m,cf do desenho (mesa colaborante, menor que ℓ; estreita o bastante
                                     # para a cota de t_enr passar por fora dela)
MEIO = LCF / 2 + 4                   # meia largura desenhada: o ℓ e um pouco além (a parede continua)
SOLO = (TEN - T) * K + 44            # altura do solo desenhado acima da parede (igual nas duas vistas)
R_PRINC, R_CONS = 4.4, 3.4           # px: principais maiores que as construtivas


def chamada(s, px, py, tx, ty, rotulo, cor):
    """Chamada da applib com o texto em halo branco: aqui o rótulo cai em cima da hachura do solo."""
    s.chamada(px, py, tx, ty, '', color=cor)
    s.text(tx, ty, rotulo, anchor='start', color=cor, halo=True)


def caso(s, x0, yw, enterrado):
    """Uma vista: x0 = eixo do contraforte; yw = face da parede do lado do solo (o solo fica acima de yw)."""
    X = lambda v: x0 + v * K
    ye = yw + T * K                       # face externa da parede
    with s.campo('pos_cf'):
        s.titulo_vista(X(-MEIO), yw - SOLO - 16, 'Enterrado — seção T' if enterrado else 'Aparente — seção retangular')
    s.solo([(X(-MEIO), yw - SOLO), (X(MEIO), yw - SOLO), (X(MEIO), yw), (X(-MEIO), yw)])
    s.rect(X(-MEIO), yw, 2 * MEIO * K, T * K, fill=C['blockfill'], stroke=C['line'], sw=1.4)
    if enterrado:
        yp = yw - (TEN - T) * K           # ponta do contraforte, dentro do solo
        s.rect(X(-E / 2), yp, E * K, yw - yp, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        # empuxo: a parede é empurrada para fora (para baixo), dos dois lados do contraforte
        for k in (-50, -41, -32, 32, 41, 50):
            s.arrow(X(k), yw - 48, X(k), yw - 4)
        with s.campo('K_cf'):
            # mesa comprimida: a faixa b_m,cf da parede, do lado de fora
            s.rect(X(-BM / 2), yw, BM * K, T * K, fill=C['mesa'], stroke=C['mesa_txt'], sw=1.2, extra='fill-opacity="0.6"')
        s.dim_h(X(-BM / 2), X(BM / 2), ye + 26, 'b_{m,cf}', ext_from=(ye, ye))
        yb = yp + CCF * K                 # principais: na ponta, a c_cf
        yc = yw - 8 * K                   # construtivas: junto à parede
        with s.campo('phi_est', 'ramos_est', 's_est'):
            s.rect(X(-5) - 7, yb - 7, 10 * K + 14, yc - yb + 14, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="5,3"')
        with s.campo('phi_cf', 'n_cf_dir'):
            for dx in (-5, 0, 5):
                s.circle(X(dx), yb, R_PRINC)
        with s.campo('phi_cc', 'n_cc'):
            for dx in (-5, 5):
                s.circle(X(dx), yc, R_CONS)
        # chamadas no solo, à direita, na ordem de cima para baixo (as linhas não se cruzam)
        xt = X(E / 2) + 30
        with s.campo('phi_cf', 'n_cf_dir'):
            chamada(s, X(5) + 4, yb, xt, yp + 6, 'principais', C['steel'])
        with s.campo('phi_est', 'ramos_est', 's_est'):
            chamada(s, X(5) + 7, (yb + yc) / 2, xt, yp + 50, 'estribo', C['steel'])
        with s.campo('phi_cc', 'n_cc'):
            chamada(s, X(5) + 3, yc, xt, yp + 94, 'construtivas', C['steel'])
        # cotas à esquerda: c_cf junto ao contraforte, t_enr (que conta a parede) mais afastada. O rótulo do t_enr
        # sobe para o alto do solo: no meio da cota ele cairia em cima das setas de empuxo
        with s.campo('c_cf_dir'):
            s.dim_v(X(-E / 2) - 16, yp, yb, 'c_{cf}', side=-1, ext_from=(X(-E / 2), X(-5)), halo=True)
        with s.campo('tenr_'):
            xe = X(-E / 2) - 72
            s.dim_v(xe, yp, ye, '', side=-1, ext_from=(X(-E / 2), X(-E / 2)))
            s.text(xe - 8, yp + 82, 't_{enr}', size=20, anchor='end', color=C['dim'], halo=True)
        s.dim_h(X(-E / 2), X(E / 2), yp - 18, 'e_{enr}', ext_from=(yp, yp), halo=True)
        yl = ye + 76
    else:
        yp = yw + TEN * K                 # ponta do contraforte, do lado de fora
        s.rect(X(-E / 2), ye, E * K, yp - ye, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        for k in (-46, -33, -20, -7, 7, 20, 33, 46):
            s.arrow(X(k), yw - 54, X(k), yw - 4)
        with s.campo('K_cf'):
            # ponta comprimida: aparente, a parede é que traciona
            s.rect(X(-E / 2), yp - 9 * K, E * K, 9 * K, fill=C['mesa'], stroke=C['mesa_txt'], sw=1.2, extra='fill-opacity="0.6"')
            s.chamada(X(E / 2) - 4, yp - 4.5 * K, X(E / 2) + 30, yp - 4.5 * K + 6, 'ponta comprimida',
                      color=C['mesa_txt'])
        yb = yw + CCF * K                 # principais: na parede, a c_cf da face do solo (a tracionada)
        with s.campo('phi_cf', 'n_cf_dir'):
            for dx in (-5, 0, 5):
                s.circle(X(dx), yb, R_PRINC)
            s.chamada(X(5) + 4, yb, X(E / 2) + 30, ye + 34, 'principais', color=C['steel'])
        with s.campo('tenr_'):
            s.dim_v(X(-E / 2) - 26, yw, yp, 't_{enr}', side=-1, ext_from=(X(-E / 2), X(-E / 2)))
        s.dim_h(X(-E / 2), X(E / 2), yp + 22, 'e_{enr}', off_text=24, ext_from=(yp, yp))
        yl = yp + 86
    # ℓ: a largura de influência (de meio vão a meio vão); as divisas tracejadas descem da parede até a cota
    with s.campo('l_cf', 'tipo_cf'):
        for v in (-LCF / 2, LCF / 2):
            s.line(X(v), ye + 4, X(v), yl + 6, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="3,3"')
        s.dim_h(X(-LCF / 2), X(LCF / 2), yl, 'ℓ_{cf}')
    return yl


def desenhar():
    s = Fig(12, 1000, 640)
    yw = 270
    caso(s, 265, yw, True)
    yl = caso(s, 750, yw, False)
    s.line(507, yw - SOLO - 34, 507, yl + 10, stroke=C['cinza2'], sw=1)
    return s
