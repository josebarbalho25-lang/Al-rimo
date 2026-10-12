# Fig. 7 (app) — altura efetiva e esbeltez: o muro sem travamento (balanço, h_e = 2·h_muro) e o muro travado dos
# dois lados (h_e com αv, αh e ℓ).
# Régua comum (12/10, applib): o "sem travamento" virou corte de verdade — parede(), sapata() e solo à direita em
# K_GERAL, como a Fig. 1 — e o "com travamento" é a elevação do mesmo muro, na mesma escala. Saíram a fórmula de h_e
# e a lista dos αv/αh (vão para a memória, que já mostra a conta com os valores): αv e αh ficam como símbolos
# desenhados na direção a que cada um se aplica, e ℓ e h_muro como cotas.
from applib import Fig, C, T_SIM, K_GERAL as K

T, HM, HSO = 0.19, 2.4, 2.0          # m — as mesmas proporções da Fig. 1 (o muro passa um pouco do solo)
PONTA, TALAO, HS = 0.45, 0.75, 0.30
L = 2.4                              # ℓ desenhado (m): o que cabe na moldura ao lado do corte, em K_GERAL


def seta_dupla(s, x1, y1, x2, y2):
    """Seta de dupla ponta cinza: marca a DIREÇÃO a que o α se aplica. Não é cota (cota tem traço oblíquo) nem
    força (força é laranja) — por isso a cor e a ponta da linha de cota."""
    s.line(x1, y1, x2, y2, stroke=C['dim'], sw=1.2,
           extra=f'marker-start="{s.u("arr")}" marker-end="{s.u("arr")}"')


def desenhar():
    s = Fig(7, 1000, 640)
    yb = 520                                          # topo da sapata (pé da parede), nas duas vistas
    tw = T * K
    yt = yb - HM * K

    # ── Corte — sem travamento: balanço livre no topo ────────────────────────────────────────────────────────
    xw = 190
    xs = xw + tw
    ys = yb - HSO * K
    xl, xr = xw - (PONTA + 0.25) * K, xs + (TALAO + 0.15) * K
    # terreno: um polígono só (duas hachuras emendadas deixam costura), solo da frente no topo da sapata
    s.solo([(xl, yb), (xs, yb), (xs, ys), (xr, ys), (xr, yb + 0.5 * K), (xl, yb + 0.5 * K)])
    s.line(xs, ys, xr, ys, stroke=C['soil'], sw=2)
    s.line(xl, yb, xw, yb, stroke=C['soil'], sw=2)
    s.sapata(xw - PONTA * K, yb, PONTA + T + TALAO, HS)
    s.parede(xw, yb, T, HM, barra=False)
    with s.campo('Trav_lat'):
        s.titulo_vista(xl, yt - 92, 'Corte — sem travamento')
    # deformada do eixo (balanço deflete para fora): é sobre ela que o peso próprio dá o momento de 2ª ordem.
    # Cinza pontilhado, como a deformada diferida da Fig. 10 — deslocamento não é carga.
    xe = xw + tw / 2
    amp = 52

    def deformada(y):
        f = (yb - y) / (HM * K)
        return xe - amp * f * f * (3 - f) / 2

    with s.campo('M2d_on'):
        s.pline([(deformada(y), y) for y in range(int(yb), int(yt) - 1, -10)] + [(deformada(yt), yt)],
                stroke=C['dim'], sw=2, extra='stroke-dasharray="7,5"')
        s.text(deformada(yt + 0.9 * K) - 12, yt + 0.9 * K, 'M_{2d}', size=T_SIM, anchor='end', color=C['line'], halo=True)
    # peso próprio aplicado no topo DESLOCADO: a excentricidade em relação ao pé é o que gera o M_2d
    with s.campo('peso_par'):
        xp = deformada(yt)
        s.arrow(xp, yt - 64, xp, yt - 4, color=C['load'], sw=2.4)
        s.text(xp - 10, yt - 34, 'g_{par}', size=T_SIM, anchor='end', color=C['load'])
    s.dim_v(xl + 6, yt, yb, 'h_{muro}', side=-1, ext_from=(xw, xw))

    # ── Elevação — com travamento lateral: parede vista de fora entre dois travamentos ──────────────────────
    x2 = 535
    xa, xb = x2, x2 + L * K                           # eixos dos travamentos (ℓ é medido eixo a eixo)
    bt = 0.2 * K                                      # largura aparente do travamento na elevação
    # solo cortado abaixo do terreno (a sapata fica enterrada, como no corte ao lado)
    s.solo([(xa - 0.45 * K, yb), (xb + 0.45 * K, yb), (xb + 0.45 * K, yb + 0.5 * K), (xa - 0.45 * K, yb + 0.5 * K)])
    s.sapata(xa - 0.35 * K, yb, L + 0.7, HS)
    s.line(xa - 0.45 * K, yb, xb + 0.45 * K, yb, stroke=C['soil'], sw=2)
    # painel em elevação (não é corte: sem parede(), que desenha a seção) e os travamentos em vista = cinza2
    s.rect(xa, yt, xb - xa, HM * K, fill=C['blockfill'], stroke=C['line'], sw=1.2)
    for x in (xa, xb):
        s.rect(x - bt / 2, yt, bt, HM * K, fill=C['cinza2'], stroke=C['line'], sw=1.2)
    with s.campo('Trav_lat'):
        s.titulo_vista(xa - 0.45 * K, yt - 92, 'Elevação — com travamento')
    with s.campo('l_trav'):
        s.dim_h(xa, xb, yt - 30, 'ℓ', ext_from=(yt, yt))
    s.dim_v(xa - 0.45 * K + 6, yt, yb, 'h_{muro}', side=-1, ext_from=(xa - bt / 2 - 6, xa - bt / 2 - 6))
    # αv na vertical (depende de o topo estar travado ou livre), αh na horizontal (travado de um ou dos dois lados)
    xv = xa + 0.28 * (xb - xa)
    yh = yt + 0.62 * HM * K
    with s.campo('alfa_v'):
        seta_dupla(s, xv, yt + 14, xv, yb - 14)
        s.text(xv + 10, yt + 0.3 * HM * K, 'α_{v}', size=T_SIM, anchor='start', halo=True)
    with s.campo('alfa_h'):
        seta_dupla(s, xa + bt / 2 + 12, yh, xb - bt / 2 - 12, yh)
        s.text(xa + 0.68 * (xb - xa), yh - 10, 'α_{h}', size=T_SIM, halo=True)
    return s
