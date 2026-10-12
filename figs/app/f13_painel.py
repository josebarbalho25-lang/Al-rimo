# Fig. 13 (app) — painel entre contrafortes, elevação vista de fora. A coluna de texto da planilha
# (momentos, "armaduras do exemplo", flecha) vira rótulo no próprio desenho: cada momento no lugar onde ele
# acontece. Sem l = 1,50 / h = 2,60 / σ = 20,8 / c/45 / c/80 da aula 12.3.
# Régua comum (12/10, applib):
#   - escala K_GERAL (era 1,9 px/cm solta); canaletas com a altura de uma fiada (19 cm), nos topos 0,8 / 1,6 / 2,4 m
#     como nas Figs. 1 e 5;
#   - o diagrama de σh flutuava ao lado do contraforte, no plano da elevação, e parecia empurrar o contraforte de
#     lado. A pressão age PERPENDICULAR ao painel, então ela foi para uma vista "Corte" ao lado, com parede(),
#     solo() e empuxo() — a mesma leitura da Fig. 1;
#   - não armado em C['sub'] (contorno cheio) e topo pela borda "livre" da Fig. 6, ambos explicados na legenda
#     (saíram "não armado", "topo livre", "sapata (engaste)" escritos no desenho);
#   - rótulos de momento na cor da linha (vermelho é só aço); charneiras em cinza (laranja é só carga);
#   - cotas com os símbolos da memória: ℓ_{cf} (eixo a eixo, das linhas de eixo dos contrafortes) e h_{muro}.
import math
from applib import Fig, C, K_GERAL
from f06_casos import borda

S = K_GERAL / 100            # px por cm
L, H, E = 150, 260, 14       # eixo a eixo, altura do painel e espessura do contraforte (cm)
EIXOS_CAN = (70, 150, 230)   # eixo das canaletas (cm do pé): fiadas 3, 7 e 11


def desenhar():
    s = Fig(13, 1000, 640)
    x0, yb = 150, 520
    X = lambda v: x0 + v * S
    Y = lambda v: yb - v * S
    # ---------------- elevação ----------------
    s.titulo_vista(X(-E / 2), Y(H) - 40, 'Elevação')
    s.sapata(X(-20), Y(0), (L + 40) / 100, 0.30)
    with s.campo('lat_pan'):
        for xc in (0, L):
            s.rect(X(xc - E / 2), Y(H), E * S, H * S, fill=C['cinza2'], stroke=C['block'], sw=1.2)
    s.text(X(0), Y(H) - 12, 'contraforte', size=16, color=C['note'])
    s.rect(X(E / 2), Y(H), (L - E) * S, H * S, fill=C['blockfill'], stroke='none')
    xs = [E / 2 + 7.5 + 45 * k for k in range(4) if E / 2 + 7.5 + 45 * k < L - E / 2]
    # painel não armado: entre a 2ª e a 3ª barra vertical, da base ao eixo da 1ª canaleta
    s.rect(X(xs[1]), Y(EIXOS_CAN[0]), (xs[2] - xs[1]) * S, EIXOS_CAN[0] * S, fill=C['sub'], stroke=C['sub_line'], sw=1.2)
    for yc in EIXOS_CAN:
        s.rect(X(E / 2), Y(yc + 9.5), (L - E) * S, 19 * S, fill=C['groutfill'], stroke=C['grout'], sw=0.8)
    borda(s, X(E / 2), Y(H), X(L - E / 2), Y(H), 'livre', (0, -1))
    with s.campo('phi_ph'):
        for yc in EIXOS_CAN:
            s.line(X(E / 2), Y(yc), X(L - E / 2), Y(yc), stroke=C['steel'], sw=2.2)
    with s.campo('phi_pv'):
        for xb in xs:
            s.pline([(X(xb), Y(H) + 4), (X(xb), Y(0) + 24), (X(xb) + 14, Y(0) + 24)], stroke=C['steel'], sw=2.4)
    # charneiras a 60° a partir da base (linha de ruptura: não é carga, por isso cinza e não laranja)
    a = min(L * math.tan(math.radians(60)) / 2, H)
    s.pline([(X(E / 2), Y(0)), (X(L / 2), Y(a)), (X(L - E / 2), Y(0))], stroke=C['note'], sw=1.4, extra='stroke-dasharray="8,4"')
    # momentos no lugar onde acontecem, no eixo do painel: ali as duas charneiras ficam simétricas e o rótulo
    # cabe entre elas e entre a 2ª e a 3ª barra
    xm = X(L / 2)

    def mom(x, y, t, anchor='middle'):
        s.text(x, y, t, size=18, anchor=anchor, color=C['line'], weight='bold', halo=True)
    mom(xm, Y(10), 'M_{dyei}')
    mom(xm, Y(92), 'M_{dy}')
    mom(xm, Y(184), 'M_{dx}')
    mom(xm, Y(H) + 20, 'M_{dxb}')
    with s.campo('lat_pan'):
        mom(X(L - E / 2) - 6, Y(190), 'M_{dxe}', anchor='end')
    # cotas
    with s.campo('l_cf'):
        yl = Y(0) + 0.30 * K_GERAL + 34
        for xc in (0, L):     # linha de eixo do contraforte: é dela que a cota parte
            s.line(X(xc), Y(H) - 4, X(xc), yl + 6, stroke=C['dim'], sw=0.7, extra='stroke-dasharray="10,3,2,3"')
        s.dim_h(X(0), X(L), yl, 'ℓ_{cf}')
    with s.campo('H_muro'):
        s.dim_v(X(-E / 2) - 30, Y(H), Y(0), 'h_{muro}', side=-1, ext_from=(X(-E / 2), X(-20)))
    with s.campo('s_pv_dir'):
        s.dim_h(X(xs[0]), X(xs[1]), Y(200), 's_{v}', halo=True)
    with s.campo('s_ph_dir'):
        s.dim_v(X(L + E / 2) + 22, Y(EIXOS_CAN[1]), Y(EIXOS_CAN[0]), 's_{h}', side=1, ext_from=(X(L - E / 2), X(L - E / 2)))
    # rótulos das barras junto delas (chamada longa cruzaria o contraforte)
    with s.campo('phi_pv'):
        s.text(X(xs[0]) + 8, Y(112), 'Ø_{v}', size=20, anchor='start', color=C['steel'], weight='bold', halo=True)
    with s.campo('phi_ph'):
        s.text(X(xs[2]) + 8, Y(EIXOS_CAN[1]) - 22, 'Ø_{h}', size=20, anchor='start', color=C['steel'], weight='bold', halo=True)
    # ---------------- corte (a pressão age perpendicular ao painel) ----------------
    t = 0.19
    xw = X(L + E / 2) + 150
    xsolo = xw + t * K_GERAL
    yt = Y(H)
    xr = xsolo + 200
    s.titulo_vista(xw - 0.40 * K_GERAL, yt - 40, 'Corte')
    s.solo([(xsolo, yt), (xr, yt), (xr, yb + 60), (xw - 0.40 * K_GERAL - 20, yb + 60), (xw - 0.40 * K_GERAL - 20, yb), (xsolo, yb)])
    s.line(xsolo, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(xw - 0.40 * K_GERAL - 20, yb, xw, yb, stroke=C['soil'], sw=2)
    s.sapata(xw - 0.40 * K_GERAL, yb, 0.40 + t + 1.0, 0.30)
    s.empuxo(xsolo, yt, yb, larg=140)
    s.parede(xw, yb, t, H / 100, canaletas=tuple((yc - 9.5) / 100 for yc in EIXOS_CAN), espera=0.25)
    s.text(xsolo + 148, yb - 8, 'σ_{h}', size=20, anchor='start', color=C['load'], halo=True)
    s.legenda(X(-20), yl + 52, [('naoarmado', 'não armado'), ('livre', 'borda livre')])
    return s
