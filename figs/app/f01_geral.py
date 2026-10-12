# Fig. 1 (app) — muro em balanço, corte. Duas alturas (Jose, 09/10): h_muro (do topo da sapata ao topo do muro) e
# h_solo (do topo do solo à base do muro, no máximo h_muro). O muro passa do solo o bastante para as duas cotas não
# se confundirem.
# Régua comum (12/10, applib): parede, sapata, solo, empuxo, sobrecarga e NA pelas peças padrão, em K_GERAL; sem
# fórmula dentro da figura (σ'h = Ka·σ'v foi para a memória).
from applib import Fig, C, K_GERAL as K


def desenhar():
    s = Fig(1, 1000, 640)
    t, hm, hso = 0.19, 2.4, 2.0
    xw, yb = 400, 470
    xs = xw + t * K
    yt = yb - hso * K
    xr = 880
    # terreno: um polígono só (dois retângulos com a mesma hachura deixam costura na emenda)
    s.solo([(170, yb), (xs, yb), (xs, yt), (xr, yt), (xr, yb + 95), (170, yb + 95)])
    s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(170, yb, xw, yb, stroke=C['soil'], sw=2)
    s.sapata(xw - 0.7 * K, yb, 0.7 + t + 1.1, 0.35)
    with s.campo('Ka_dir'):
        s.empuxo(xs, yt, yb, larg=150)
    _, _, ytop = s.parede(xw, yb, t, hm, canaletas=(0.8 - 0.19, 1.6 - 0.19, hm - 0.19), espera=0.25)
    with s.campo('q_sobre'):
        s.sobrecarga(xs + 24, xr - 14, yt)
    yNA = yt + 1.0 * K
    with s.campo('z_NA'):
        s.na(xs, xr, yNA)
        s.dim_v(xr + 26, yt, yNA, 'z_{NA}', side=1, ext_from=(xr, xr))
    with s.campo('Tipo_solo', 'NSPT', 'Umidade', 'Classe_G'):
        s.text(745, yb - 62, 'solo', size=20, color=C['soil'], weight='bold', halo=True)
    with s.campo('gama_solo'):
        s.text(712, yb - 30, 'γ', size=21, color=C['soil'], halo=True)
    with s.campo('phi_solo'):
        s.text(746, yb - 30, 'φ\'', size=21, color=C['soil'], halo=True)
    with s.campo('c_solo'):
        s.text(780, yb - 30, 'c\'', size=21, color=C['soil'], halo=True)
    # cotas: o solo do lado do solo (à direita, junto ao aterro), o muro do lado de fora
    with s.campo('H_muro'):
        s.dim_v(xw - 45, ytop, yb, 'h_{muro}', side=-1, ext_from=(xw, xw))
    with s.campo('H_solo'):
        s.dim_v(xr + 100, yt, yb, 'h_{solo}', side=1, ext_from=(xr, xr))
    with s.campo('h_pan'):
        s.dim_v(xw - 120, yb - 1.6 * K, yb - 0.8 * K, 'h_{p}', side=-1, ext_from=(xw, xw))
    with s.campo('t_bloco'):
        s.dim_h(xw, xs, ytop - 18, 't', ext_from=(ytop, ytop))
    return s
