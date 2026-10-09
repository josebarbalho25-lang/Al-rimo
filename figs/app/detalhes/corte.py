# Base dos detalhes em CORTE (det03 espera, det04 drenagem, det05 cinta e junta): desenho 2D em cm, sem
# perspectiva, sobre a applib das figuras do app.
#
# Por que um módulo separado do iso.py: os detalhes 1 e 2 são perspectiva de peças em caixa; estes são corte de
# prancha (bloco cortado pelo furo, canaleta em U, barra dobrada, linha de interrupção). As medidas das peças vêm
# do mesmo lugar que o app usa (app/src/modulacao/catalogo.ts, que copiou as famílias do Revit do Jose) — se o
# catálogo mudar, mudar aqui também.
import math
import os
import sys

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')))
from applib import C  # noqa: E402

ARG = '#bfbfbf'        # argamassa (a mesma do det01)
H_BLOCO = 19.0         # cm
JUNTA = 1.0            # cm

# Famílias (catalogo.ts, medidas do Revit do Jose): parede do bloco inteiro 3,2 nas duas; canaleta com paredes 2,5,
# fundo 3,91 (14) e 2,91 (19); o volume da canaleta (cm³ em 39 cm) dá o raio dos dois cantos do fundo por dentro.
FAMILIA = {
    'b14': dict(t=14.0, parede=3.2, can_par=2.5, can_fundo=3.91, can_vol=5116.0, nome='14'),
    'b19': dict(t=19.0, parede=3.2, can_par=2.5, can_fundo=2.91, can_vol=5333.0, nome='19'),
}

SEG_QUARTO = 6         # perfis.ts: o mesmo polígono do canto arredondado que o 3D usa


def raio_fundo_canaleta(f):
    """Raio dos cantos do fundo da canaleta (por dentro) que fecha a seção com o volume do Revit — a mesma conta de
    catalogo.ts (raioDoFundoDaCanaleta), em cm."""
    c_cantos = 4 - 2 * SEG_QUARTO * math.sin(math.pi / (2 * SEG_QUARTO))
    t, p, fu = f['t'], f['can_par'], f['can_fundo']
    secao = f['can_vol'] / 39.0
    reta = t * H_BLOCO - (t - 2 * p) * (H_BLOCO - fu)
    extra = secao - reta
    if extra <= 0:
        return 0.0
    return min(math.sqrt(2 * extra / c_cantos), (t - 2 * p) / 2, H_BLOCO - fu)


class Corte:
    """Corte vertical: y na horizontal (cm, crescendo para a direita), z para cima (cm). `ref` = (y, z) que vai
    para (ox, oy) na tela."""

    def __init__(s, fig, ox, oy, K, ref=(0.0, 0.0)):
        s.f, s.ox, s.oy, s.K, s.ref = fig, ox, oy, K, ref

    def P(s, y, z):
        return s.ox + (y - s.ref[0]) * s.K, s.oy - (z - s.ref[1]) * s.K

    def X(s, y):
        return s.P(y, 0)[0]

    def Y(s, z):
        return s.P(0, z)[1]

    def ret(s, y0, z0, y1, z1, **kw):
        (a, b), (c, d) = s.P(y0, z0), s.P(y1, z1)
        s.f.rect(min(a, c), min(b, d), abs(c - a), abs(d - b), **kw)

    def poly(s, pts, **kw):
        s.f.poly([s.P(y, z) for y, z in pts], **kw)

    def pline(s, pts, **kw):
        s.f.pline([s.P(y, z) for y, z in pts], **kw)

    def line(s, y0, z0, y1, z1, **kw):
        (a, b), (c, d) = s.P(y0, z0), s.P(y1, z1)
        s.f.line(a, b, c, d, **kw)

    # ---- peças ---------------------------------------------------------------------------------------
    def bloco_no_furo(s, f, z0, z1, miolo='graute'):
        """Bloco cortado pelo furo: as duas paredes longitudinais e o miolo (graute ou vazio)."""
        t, p = f['t'], f['parede']
        if miolo == 'graute':
            s.ret(p, z0, t - p, z1, fill=C['groutfill'], stroke='none')
        for a, b in ((0, p), (t - p, t)):
            s.ret(a, z0, b, z1, fill=C['blockfill'], stroke=C['line'], sw=1.1)

    def argamassa(s, f, z0):
        """Junta horizontal de 1 cm: só nas paredes (bloco vazado assenta nas paredes longitudinais)."""
        t, p = f['t'], f['parede']
        for a, b in ((0, p), (t - p, t)):
            s.ret(a, z0, b, z0 + JUNTA, fill=ARG, stroke=C['line'], sw=0.6)

    def canaleta(s, f, z0, graute=True):
        """Canaleta em U cortada (paredes, fundo, cantos de dentro arredondados) com o miolo grauteado."""
        t, p, fu = f['t'], f['can_par'], f['can_fundo']
        r = raio_fundo_canaleta(f)
        zt = z0 + H_BLOCO

        def arco(cy, cz, a0, a1):
            return [(cy + r * math.cos(a0 + (a1 - a0) * k / SEG_QUARTO), cz + r * math.sin(a0 + (a1 - a0) * k / SEG_QUARTO))
                    for k in range(SEG_QUARTO + 1)]
        # miolo: da parede da direita, desce, fundo, sobe pela parede da esquerda
        miolo = [(t - p, zt)] + arco(t - p - r, z0 + fu + r, 0, -math.pi / 2) + arco(p + r, z0 + fu + r, -math.pi / 2, -math.pi) + [(p, zt)]
        U = [(0, z0), (t, z0), (t, zt)] + miolo + [(0, zt)]
        s.poly(U, fill=C['blockfill'], stroke=C['line'], sw=1.1, extra='stroke-linejoin="round"')
        if graute:
            s.poly(miolo, fill=C['groutfill'], stroke=C['grout'], sw=0.8, extra='stroke-linejoin="round"')
        return miolo


def interrupcao(fig, p, q, amp=7.0, sw=1.0, cor=None):
    """Linha de interrupção (o elemento continua) de p a q, em px, com o zigue-zague no meio (estilo do det01)."""
    (x0, y0), (x1, y1) = p, q
    L = math.hypot(x1 - x0, y1 - y0) or 1.0
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = -uy, ux
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    a = amp
    pts = [(x0, y0), (mx - ux * 1.4 * a, my - uy * 1.4 * a), (mx - ux * 0.7 * a + nx * a, my - uy * 0.7 * a + ny * a),
           (mx + ux * 0.7 * a - nx * a, my + uy * 0.7 * a - ny * a), (mx + ux * 1.4 * a, my + uy * 1.4 * a), (x1, y1)]
    fig.pline(pts, stroke=cor or C['line'], sw=sw)


def cota_curta_v(fig, x, y1, y2, label, side=1, size=16, halo=True):
    """Cota vertical pequena (ticks a poucos px) com o rótulo EM PÉ, fora — dim_v giraria '≥ 1,5'."""
    fig._bb(x, y1, x, y2)
    fig.add(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke="{C["dim"]}" stroke-width="1" '
            f'marker-start="{fig.u("tick")}" marker-end="{fig.u("tick")}"/>')
    fig.text(x + side * 8, (y1 + y2) / 2 + size * 0.35, label, size=size, color=C['dim'], anchor='start' if side > 0 else 'end', halo=halo)


def cota_folga_h(fig, x1, x2, y, label, ext=18, size=16, ext_from=None):
    """Cota de uma folga estreita (junta): a linha passa dos dois lados e o rótulo fica em cima, no meio."""
    if ext_from is not None:
        for x, y0 in ((x1, ext_from[0]), (x2, ext_from[1])):
            fig.line(x, y0, x, y + (5 if y > y0 else -5), stroke=C['dim'], sw=0.7)
    fig.line(x1 - ext, y, x1, y, stroke=C['dim'], sw=1)
    fig.line(x2, y, x2 + ext, y, stroke=C['dim'], sw=1)
    fig.dim_h(x1, x2, y, '')
    fig.text((x1 + x2) / 2, y - 8, label, size=size, color=C['dim'], halo=True)
