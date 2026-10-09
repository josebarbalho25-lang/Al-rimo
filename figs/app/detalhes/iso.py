# Base dos DETALHES TÍPICOS da prancha (app/public/detalhes/detNN_*.svg): perspectiva isométrica de peças
# em caixa (bloco, canaleta, barra) sobre a applib das figuras do app.
#
# Por que caixas e não um modelo 3D de verdade: o detalhe é desenhado sem navegador (como as figuras do app) e
# toda peça de alvenaria é um paralelepípedo (a canaleta é um U = fundo + duas paredes; o furo do bloco é só
# desenho no topo). Com caixas disjuntas, a ordem de pintura da isométrica sai exata: se as projeções de duas
# caixas se cobrem, qualquer eixo que as separe diz qual está na frente (o raio de vista (1,1,1) cruza as duas
# na mesma ordem em x, y e z). Só se testa a ordem entre pares que se cobrem de fato na tela — testar pares
# que não se cobrem pode criar ciclo à toa.
import math
import os
import sys

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')))
from applib import Fig, C  # noqa: E402

CO, SI = math.cos(math.radians(30)), 0.5

# Cores do Jose por tipo de peça (dados/encaixes_revit/cores_jose.json — as mesmas do 3D e da paginação do app).
# Ficam aqui, e não na paleta da applib, porque só os detalhes de amarração as usam (cor nova autorizada por ele
# para estes detalhes: "com as cores do Jose por tipo de peça").
COR_JOSE = {'inteiro': '#787878', 'meio': '#004080', 'canaleta': '#ffff80', 'b34': '#ff8040', 'b54': '#ff0000'}


def tom(cor, f):
    """f > 0 clareia em direção ao branco; f < 0 escurece em direção ao preto (sombreamento das faces)."""
    r, g, b = (int(cor[i:i + 2], 16) for i in (1, 3, 5))
    if f >= 0:
        r, g, b = (v + (255 - v) * f for v in (r, g, b))
    else:
        r, g, b = (v * (1 + f) for v in (r, g, b))
    return '#%02x%02x%02x' % tuple(int(round(min(255, max(0, v)))) for v in (r, g, b))


class Det(Fig):
    """Fig com prefixo de id próprio ('det01b19'...): dois detalhes inline na mesma prancha não podem
    roubar o <marker>/<pattern> um do outro."""

    def __init__(s, pid, w=1000, h=600):
        super().__init__(0, w, h)
        s.defs = [d.replace('fig00-', pid + '-') for d in s.defs]
        s.pid = pid


class Caixa:
    """Paralelepípedo em cm (coordenadas do Revit do Jose). `opac` por face visível ('topo', 'esq', 'dir')
    deixa ver através da face (parede da frente que esconderia a barra). `furos`: retângulos (x0, x1, y0, y1)
    desenhados no topo."""

    def __init__(s, x0, x1, y0, y1, z0, z1, cor, borda='#404040', sw=0.9, opac=None, furos=(), tons=(0.45, 0.0, -0.25),
                 cor_furo=None):
        s.x = (min(x0, x1), max(x0, x1))
        s.y = (min(y0, y1), max(y0, y1))
        s.z = (min(z0, z1), max(z0, z1))
        s.cor, s.borda, s.sw = cor, borda, sw
        s.opac = opac or {}
        s.furos = list(furos)
        s.tons = tons
        s.cor_furo = cor_furo


def _casco(pts):
    pts = sorted(set((round(x, 4), round(y, 4)) for x, y in pts))
    if len(pts) <= 2:
        return pts

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def _cobrem(A, B, tol=0.6):
    """Polígonos convexos A e B se sobrepõem por mais que `tol` px (encostar não conta)."""
    for P in (A, B):
        n = len(P)
        for i in range(n):
            ex, ey = P[(i + 1) % n][0] - P[i][0], P[(i + 1) % n][1] - P[i][1]
            nx, ny = -ey, ex
            L = math.hypot(nx, ny) or 1
            nx, ny = nx / L, ny / L
            a = [x * nx + y * ny for x, y in A]
            b = [x * nx + y * ny for x, y in B]
            if min(max(a), max(b)) - max(min(a), min(b)) <= tol:
                return False
    return True


class Iso:
    """Isométrica: X ao longo do muro, Y transversal, Z para cima (cm). (sx, sy) escolhe o canto de onde se olha:
    vê-se a face +X·sx (à direita na tela), a face +Y·sy (à esquerda) e o topo. `ref` = ponto que vai para (ox, oy)."""

    def __init__(s, fig, ox, oy, S, sx=1, sy=1, ref=(0.0, 0.0, 0.0)):
        s.f, s.ox, s.oy, s.S, s.sx, s.sy, s.ref = fig, ox, oy, S, sx, sy, ref

    def p(s, x, y, z):
        X = s.sx * (x - s.ref[0])
        Y = s.sy * (y - s.ref[1])
        Z = z - s.ref[2]
        return s.ox + (X - Y) * CO * s.S, s.oy + ((X + Y) * SI - Z) * s.S

    # intervalos no espaço de vista (maior = mais perto de quem olha)
    def _vx(s, c):
        a, b = s.sx * c.x[0], s.sx * c.x[1]
        return min(a, b), max(a, b)

    def _vy(s, c):
        a, b = s.sy * c.y[0], s.sy * c.y[1]
        return min(a, b), max(a, b)

    def _cantos(s, c):
        return [s.p(x, y, z) for x in c.x for y in c.y for z in c.z]

    def ordem(s, caixas):
        n = len(caixas)
        cas = [_casco(s._cantos(c)) for c in caixas]
        viu = [(s._vx(c), s._vy(c), c.z) for c in caixas]
        antes = [set() for _ in range(n)]       # antes[j] = caixas que pintam antes de j
        eps = 1e-6
        for i in range(n):
            for j in range(i + 1, n):
                if not _cobrem(cas[i], cas[j]):
                    continue
                rel = None
                for k in range(3):
                    a, b = viu[i][k], viu[j][k]
                    if a[1] <= b[0] + eps:
                        rel = (i, j)
                        break
                    if b[1] <= a[0] + eps:
                        rel = (j, i)
                        break
                if rel is None:   # caixas que se interpenetram (não deveria haver): o centro mais perto vai depois
                    di = sum((v[0] + v[1]) for v in viu[i])
                    dj = sum((v[0] + v[1]) for v in viu[j])
                    rel = (i, j) if di <= dj else (j, i)
                antes[rel[1]].add(rel[0])
        prof = [sum((v[0] + v[1]) for v in viu[i]) for i in range(n)]
        feito, saida = set(), []
        while len(saida) < n:
            livres = [i for i in range(n) if i not in feito and antes[i] <= feito]
            if not livres:      # ciclo (não ocorre nas montagens desenhadas): solta o mais distante
                livres = [min((i for i in range(n) if i not in feito), key=lambda i: prof[i])]
            i = min(livres, key=lambda i: prof[i])
            feito.add(i)
            saida.append(caixas[i])
        return saida

    def faces(s, c):
        """Polígonos das três faces visíveis: (nome, pontos)."""
        xf = c.x[1] if s.sx > 0 else c.x[0]
        yf = c.y[1] if s.sy > 0 else c.y[0]
        (x0, x1), (y0, y1), (z0, z1) = c.x, c.y, c.z
        P = s.p
        return [
            ('dir', [P(xf, y0, z0), P(xf, y1, z0), P(xf, y1, z1), P(xf, y0, z1)]),
            ('esq', [P(x0, yf, z0), P(x1, yf, z0), P(x1, yf, z1), P(x0, yf, z1)]),
            ('topo', [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]),
        ]

    def caixa(s, c):
        tons = dict(topo=c.tons[0], esq=c.tons[1], dir=c.tons[2])
        for nome, pts in s.faces(c):
            op = c.opac.get(nome)
            extra = 'stroke-linejoin="round"'
            if op is not None:
                extra += f' fill-opacity="{op}"'
            s.f.poly(pts, fill=tom(c.cor, tons[nome]), stroke=c.borda, sw=c.sw, extra=extra)
            if nome == 'topo':
                cf = c.cor_furo or tom(c.cor, -0.45)
                for fx0, fx1, fy0, fy1 in c.furos:
                    q = [s.p(fx0, fy0, c.z[1]), s.p(fx1, fy0, c.z[1]), s.p(fx1, fy1, c.z[1]), s.p(fx0, fy1, c.z[1])]
                    s.f.poly(q, fill=cf, stroke=c.borda, sw=c.sw * 0.7, extra='stroke-linejoin="round"')

    def desenhar(s, caixas):
        for c in s.ordem(caixas):
            s.caixa(c)

    def tracejado(s, pts, cor=C['line'], sw=1.3, dash='6 4'):
        s.f.pline([s.p(*q) for q in pts], stroke=cor, sw=sw, extra=f'stroke-dasharray="{dash}"')

    def arestas_caixa(s, x0, x1, y0, y1, z0, z1, cor=C['line'], sw=1.3, dash='6 4'):
        """As 12 arestas de uma caixa, tracejadas (peça removida / fantasma)."""
        P = s.p
        cs = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        for a in range(8):
            for b in range(a + 1, 8):
                d = sum(1 for k in range(3) if cs[a][k] != cs[b][k])
                if d == 1:
                    (xa, ya), (xb, yb) = P(*cs[a]), P(*cs[b])
                    s.f.line(xa, ya, xb, yb, stroke=cor, sw=sw, extra=f'stroke-dasharray="{dash}"')


def legenda(fig, x, y, itens, size=17, passo=34, lado=26):
    """Legenda curta: quadradinho da cor + nome."""
    for i, (cor, nome) in enumerate(itens):
        yy = y + i * passo
        fig.rect(x, yy - lado * 0.72, lado, lado * 0.72, fill=cor, stroke='#404040', sw=1)
        fig.text(x + lado + 12, yy - 2, nome, size=size, anchor='start')
