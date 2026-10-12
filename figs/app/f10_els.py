# Fig. 10 (app) — ELS do balanço: carga de serviço, flecha imediata e diferida, fissura na base do lado do solo e a
# compressão do peso próprio (σsg).
# Régua comum (12/10): a coluna de fórmulas saiu (vai para a memória); o σsg agora é desenhado DENTRO da parede, na
# base — antes a seta ficava fora do muro, sobre a ponta da sapata, e se lia como aterro (Jose, 12/10); a fissura
# é cinza (vermelho é só aço); o solo aparece, à direita, como em todo corte.
from applib import Fig, C, T_TXT, K_GERAL as K


def desenhar():
    s = Fig(10, 1000, 640)
    t, h = 0.19, 2.4
    xw, yb = 420, 500
    tw = t * K
    xs = xw + tw
    yt = yb - h * K
    xr = 820
    s.solo([(xs, yt), (xr, yt), (xr, yb + 70), (xw - 140, yb + 70), (xw - 140, yb), (xs, yb)])
    s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
    s.line(xw - 140, yb, xw, yb, stroke=C['soil'], sw=2)
    s.sapata(xw - 0.6 * K, yb, 0.6 + t + 0.9, 0.3)
    with s.campo('psi_els'):
        s.empuxo(xs, yt, yb, larg=140)
    s.parede(xw, yb, t, h, canaletas=(h - 0.19,))
    # deformadas da face externa: imediata e diferida (o balanço deflete para o lado de fora); saem da face, e não do
    # eixo, para não passar por cima do σsg desenhado dentro da parede
    xe = xw

    def deformada(amp):
        return [(xe - amp * ((yb - y) / (h * K)) ** 2 * (3 - (yb - y) / (h * K)) / 2, y) for y in range(int(yb), int(yt) - 1, -10)]

    s.pline(deformada(45), stroke=C['load'], sw=2, extra='stroke-dasharray="7,5"')
    s.text(xe - 45 + 2, yt - 14, 'δ_{0}', size=20, anchor='middle', color=C['load'])
    with s.campo('dxi'):
        s.pline(deformada(95), stroke=C['dim'], sw=2, extra='stroke-dasharray="3,4"')
        s.text(xe - 95 - 4, yt - 14, 'δ_{∞}', size=20, anchor='middle', color=C['dim'])
    # limite: a linha do δ_adm, além da diferida
    with s.campo('div_adm'):
        xa = xe - 140
        s.line(xa, yt - 4, xa, yt + 70, stroke=C['note'], sw=1.2, extra='stroke-dasharray="2,4"')
        s.text(xa - 6, yt + 40, 'δ_{adm}', size=T_TXT, anchor='end', color=C['note'])
    with s.campo('vao_ref'):
        s.dim_v(xr + 30, yt, yb, 'h', side=1, ext_from=(xr, xr))
    # fissura na base, do lado do solo (face tracionada), e a compressão do peso próprio dentro da parede
    with s.campo('sg_on'):
        s.fissura(xs, yb - 3, xs - tw * 0.55, yb - 24, n=4)
        s.arrow(xw + tw * 0.4, yb - 90, xw + tw * 0.4, yb - 6, color=C['load'], sw=2)
        s.text(xw - 12, yb - 44, 'σ_{sg}', size=T_TXT, anchor='end', color=C['load'], halo=True)
    return s
