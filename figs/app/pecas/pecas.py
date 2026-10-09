# Figuras das PEÇAS da família 39 (app/public/pecas/<familia>_<peca>.svg): cada peça sozinha em perspectiva
# isométrica, na cor do Jose por tipo, com os furos vazados e cotas das três medidas. Vão no quantitativo (ícone na
# linha da peça; clique abre grande no modal das figuras) e na folha-catálogo (folha.py).
#
# DE ONDE VEM A GEOMETRIA: catalogo.json, exportado do catálogo do app (app/src/modulacao/catalogo.ts) por
# catalogo.mjs — a MESMA régua do 3D, do IFC e do quantitativo: furos medidos no Revit do Jose, raio dos cantos
# do furo e da concordância do fundo da canaleta tirados do volume da família. Nada é redigitado aqui.
#
# A MESMA FIGURA SERVE DE ÍCONE (~50–90 px) E DE AMPLIAÇÃO (modal de ~1200 px). Três recursos do próprio SVG, sem
# código no app:
#   - <view id="icone">: o ícone abre o arquivo com '#icone' e o navegador recorta só a peça (mesma caixa para
#     todas as peças da família → no quantitativo o meio bloco aparece com metade do inteiro, como é);
#   - @media (max-height) dentro do SVG: num <img> o media query mede a IMAGEM. Pequena, as cotas e o papel branco
#     somem (cota de 4 px é sujeira; sem o papel, o ícone fica bom no tema escuro);
#   - vector-effect="non-scaling-stroke" nas arestas: o traço tem 1 px na tela em qualquer tamanho — escalado com
#     o desenho, a aresta sumia no ícone ou engrossava no modal.
#
# DEDUÇÃO (desenho, não medida): o comprimento da canaleta cortada desenhada (CORTE) — a figura vale para qualquer
# corte, por isso a cota dela é o símbolo ℓ e o resto da inteira aparece tracejado até 39.
import json
import math
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(AQUI, '..', 'detalhes')))
from iso import Det, Iso, CO, SI, tom  # noqa: E402
from applib import C, T_SIM  # noqa: E402

CAT = json.load(open(os.path.join(AQUI, 'catalogo.json'), encoding='utf8'))

S = 8.0                      # unidades do viewBox por cm (todas as peças na mesma escala)
TONS = (0.4, 0.0, -0.3)      # topo, face comprida (+y), ponta (+x) — os mesmos do detalhe 2
BORDA = '#262626'
SW = 1.1                     # px na tela (non-scaling-stroke)
NS = 'vector-effect="non-scaling-stroke" stroke-linejoin="round"'
SEG = 8                      # segmentos por quarto de círculo nos cantos (só desenho; o 3D usa 6)
ICONE_MAX = 240              # px: abaixo disto (altura da imagem) a figura vira ícone

# Comprimento desenhado da canaleta cortada (cm). DEDUÇÃO: cortes que existem no Revit do Jose — 14: 19, 20 e 24;
# 19: só 19 ("Canaleta 19 Corte 19cm"). Na 14 fica o de 24 para não parecer a meia canaleta (19).
CORTE = {'14x39': 24.0, '19x39': 19.0}

# (arquivo, chave no catálogo) por família. A ordem é a da folha-catálogo.
PECAS = {
    '14x39': [('inteiro', 'inteiro'), ('meio', 'meio'), ('bloco34', '340'), ('bloco54', '540'),
              ('canaleta', 'canaleta'), ('meia_canaleta', 'meia_canaleta'), ('canaleta_cortada', 'canaleta')],
    '19x39': [('inteiro', 'inteiro'), ('meio', 'meio'),
              ('canaleta', 'canaleta'), ('meia_canaleta', 'meia_canaleta'), ('canaleta_cortada', 'canaleta')],
}
PREFIXO = {'14x39': 'b14', '19x39': 'b19'}
NOME_CURTO = {'inteiro': 'bloco inteiro', 'meio': 'meio bloco', 'bloco34': 'bloco 34', 'bloco54': 'bloco 54',
              'canaleta': 'canaleta', 'meia_canaleta': 'meia canaleta', 'canaleta_cortada': 'canaleta cortada'}


def cm(v):
    """Rótulo de cota em cm: 39, 14, 7,6."""
    return ('%g' % round(v, 1)).replace('.', ',')


def _peca(fam, chave):
    return next(p for p in CAT['familias'][fam]['pecas'] if p['chave'] == chave)


def medidas(fam, arq):
    """Medidas da peça em cm: (L desenhado, L até onde vai o tracejado, t, h)."""
    F = CAT['familias'][fam]
    chave = dict(PECAS[fam])[arq]
    L = _peca(fam, chave)['comprimento'] / 10
    Lmax = L
    if arq == 'canaleta_cortada':
        L, Lmax = CORTE[fam], F['L'] / 10
    return L, Lmax, F['t'] / 10, F['h'] / 10


# ── geometria auxiliar ──────────────────────────────────────────────────────────────────────────────────────────

def _limpa(pts):
    out = []
    for q in pts:
        if not out or math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) > 1e-9:
            out.append(q)
    if len(out) > 1 and math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) <= 1e-9:
        out.pop()
    return out


def furo_em_planta(c, yc, l, w, r):
    """Contorno do furo (retângulo de cantos arredondados), anti-horário, em cm."""
    r = max(0.0, min(r, l / 2, w / 2))
    if r < 1e-9:
        return [(c - l / 2, yc - w / 2), (c + l / 2, yc - w / 2), (c + l / 2, yc + w / 2), (c - l / 2, yc + w / 2)]
    pts = []
    for cx, cy, a0 in ((c + l / 2 - r, yc - w / 2 + r, -90), (c + l / 2 - r, yc + w / 2 - r, 0),
                       (c - l / 2 + r, yc + w / 2 - r, 90), (c - l / 2 + r, yc - w / 2 + r, 180)):
        for k in range(SEG + 1):
            a = math.radians(a0 + 90 * k / SEG)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return _limpa(pts)


def _arco(cy, cz, r, a0, a1):
    """Pontos (y, z) de um arco de centro (cy, cz), de a0 a a1 graus."""
    if r < 1e-9:
        return [(cy, cz)]
    return [(cy + r * math.cos(math.radians(a0 + (a1 - a0) * k / SEG)),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * k / SEG))) for k in range(SEG + 1)]


def secao_canaleta(t, h, p, f, r):
    """U da canaleta no plano (y, z), anti-horário, cantos do fundo arredondados por dentro (= perfis.ts)."""
    dir_ = _arco(t - p - r, f + r, r, 0, -90) if r > 1e-9 else [(t - p, f)]
    esq = _arco(p + r, f + r, r, -90, -180) if r > 1e-9 else [(p, f)]
    return _limpa([(0, 0), (t, 0), (t, h), (t - p, h)] + dir_ + esq + [(p, h), (0, h)])


def _lerp(a, b, u):
    u = max(0.0, min(1.0, u))
    return a + (b - a) * u


# ── a figura ────────────────────────────────────────────────────────────────────────────────────────────────────

class FigPeca(Det):
    """Det com o recorte do ícone (<view>) e o media query que tira cotas e papel quando a imagem é pequena."""

    def __init__(s, pid):
        super().__init__(pid, 900, 600)
        s.icone = None       # (x, y, w, h) do recorte do ícone
        s.desenho = None     # caixa só da peça (sem cotas), para a folha-catálogo
        s.defs.append(
            f'<linearGradient id="{pid}-fundo" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#000000" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="#000000" stop-opacity="0.38"/></linearGradient>')

    def svg(s, folga=14, larg_min=900):
        txt = super().svg(folga, larg_min)
        x, y, w, h = s.icone
        estilo = (f'<style>@media (max-height: {ICONE_MAX}px) {{ #{s.pid}-cotas, [data-fundo] {{ display: none }} }}'
                  f'</style><view id="icone" viewBox="{x:.1f} {y:.1f} {w:.1f} {h:.1f}"/>')
        return txt.replace('<defs>', estilo + '<defs>', 1)


def _face(s, pts, cor, extra=''):
    s.poly(pts, fill=cor, stroke=BORDA, sw=SW, extra=NS + extra)


def _miolo(s, pts, cor):
    """Superfície interna sem aresta própria: o traço da mesma cor fecha a fresta de antialias entre faixas."""
    s.poly(pts, fill=cor, stroke=cor, sw=0.6, extra=NS)


def desenhar_bloco(s, iso, L, t, h, furos, cor):
    P = iso.p
    _face(s, [P(0, t, 0), P(L, t, 0), P(L, t, h), P(0, t, h)], tom(cor, TONS[1]))
    _face(s, [P(L, 0, 0), P(L, t, 0), P(L, t, h), P(L, 0, h)], tom(cor, TONS[2]))
    _face(s, [P(0, 0, h), P(L, 0, h), P(L, t, h), P(0, t, h)], tom(cor, TONS[0]))
    for i, fu in enumerate(furos):
        _furo(s, iso, i, furo_em_planta(fu['c'] / 10, t / 2, fu['l'] / 10, fu['w'] / 10, fu['r'] / 10), h, cor)


def _furo(s, iso, i, planta, h, cor):
    """Furo vazado: dentro da boca, as paredes do fundo do furo (as que olham para quem vê), sombreadas pela
    direção (a que olha para +x, como a ponta do bloco, mais escura que a que olha para +y) e escurecendo com a
    profundidade. O furo atravessa a peça, mas nenhum furo do catálogo tem 19 cm nas duas direções: pela boca só
    se veem paredes, nunca a saída de baixo."""
    P = iso.p
    boca = [P(x, y, h) for x, y in planta]
    cid = f'{s.pid}-furo{i}'
    s.defs.append(f'<clipPath id="{cid}"><polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in boca)}"/></clipPath>')
    s.add(f'<g clip-path="url(#{cid})">')
    s.poly(boca, fill=tom(cor, -0.7), stroke='none', sw=0)
    n = len(planta)
    T_X, T_Y = -0.62, -0.42          # parede que olha para +x / para +y (dentro do furo, na sombra)
    for k in range(n):
        (xa, ya), (xb, yb) = planta[k], planta[(k + 1) % n]
        dx, dy = xb - xa, yb - ya
        nx, ny = -dy, dx               # normal da parede apontando para o vazio (contorno anti-horário)
        if nx * iso.sx + ny * iso.sy <= 1e-9:
            continue                   # parede de costas (a da frente da boca)
        phi = math.degrees(math.atan2(ny, nx))
        _miolo(s, [P(xa, ya, h), P(xb, yb, h), P(xb, yb, 0), P(xa, ya, 0)], tom(cor, _lerp(T_X, T_Y, phi / 90)))
    s.poly(boca, fill=f'url(#{s.pid}-fundo)', stroke='none', sw=0)
    s.add('</g>')
    s.poly(boca, fill='none', stroke=BORDA, sw=SW * 0.8, extra=NS)


def desenhar_canaleta(s, iso, L, t, h, p, f, r, cor):
    """U aberto nas pontas (como a família do Revit). Ordem de pintura de trás para a frente: fundo e parede de
    trás por dentro, os topos, a face comprida e, por último, a seção na ponta."""
    P = iso.p
    T_FUNDO, T_PAREDE = 0.12, -0.12
    _miolo(s, [P(0, p + r, f), P(L, p + r, f), P(L, t - p - r, f), P(0, t - p - r, f)], tom(cor, T_FUNDO))
    # concordância de trás (normal de +y a +z) e da frente (de +z a −y)
    for (cy, a0, a1, u0, u1) in ((p + r, -180, -90, T_PAREDE, T_FUNDO), (t - p - r, -90, 0, T_FUNDO, T_PAREDE - 0.2)):
        arco = _arco(cy, f + r, r, a0, a1)
        for k in range(len(arco) - 1):
            (ya, za), (yb, zb) = arco[k], arco[k + 1]
            _miolo(s, [P(0, ya, za), P(L, ya, za), P(L, yb, zb), P(0, yb, zb)], tom(cor, _lerp(u0, u1, (k + 0.5) / (len(arco) - 1))))
    _miolo(s, [P(0, p, f + r), P(L, p, f + r), P(L, p, h), P(0, p, h)], tom(cor, T_PAREDE))
    # sombra suave na parede de trás, mais escura perto do fundo
    s.poly([P(0, p, f + r), P(L, p, f + r), P(L, p, h), P(0, p, h)], fill=f'url(#{s.pid}-fundo)', stroke='none', sw=0,
           extra='fill-opacity="0.45"')
    # contorno do vazio na ponta de trás (aberta)
    vazio = [(p, h)] + (_arco(p + r, f + r, r, -180, -90) if r > 1e-9 else [(p, f)]) + \
            (_arco(t - p - r, f + r, r, -90, 0) if r > 1e-9 else [(t - p, f)]) + [(t - p, h)]
    s.pline([P(0, y, z) for y, z in vazio], stroke=BORDA, sw=SW, extra='vector-effect="non-scaling-stroke"')
    _face(s, [P(0, 0, h), P(L, 0, h), P(L, p, h), P(0, p, h)], tom(cor, TONS[0]))
    _face(s, [P(0, t - p, h), P(L, t - p, h), P(L, t, h), P(0, t, h)], tom(cor, TONS[0]))
    _face(s, [P(0, t, 0), P(L, t, 0), P(L, t, h), P(0, t, h)], tom(cor, TONS[1]))
    _face(s, [P(L, y, z) for y, z in secao_canaleta(t, h, p, f, r)], tom(cor, TONS[2]))


def fantasma_canaleta(s, iso, L0, L1, t, h, p, f, r):
    """O resto da canaleta inteira depois do corte, só em arestas tracejadas."""
    P = iso.p
    tr = f'stroke-dasharray="5 4" {NS}'
    cor = C['cinza']
    for y, z in ((t, 0), (t, h), (t - p, h), (p, h), (0, h)):
        a, b = P(L0, y, z), P(L1, y, z)
        s.line(a[0], a[1], b[0], b[1], stroke=cor, sw=1.0, extra=tr)
    U = secao_canaleta(t, h, p, f, r)
    s.poly([P(L1, y, z) for y, z in U], fill='none', stroke=cor, sw=1.0, extra=tr)


# ── cotas ───────────────────────────────────────────────────────────────────────────────────────────────────────

def cota(s, iso, A, B, d, off, rotulo, folga=1.0, passa=1.2):
    """Cota de aresta em isométrica: linhas de chamada na direção 3D `d` (unitária), linha de cota a `off` cm da
    aresta, número em pé ao lado (do lado para onde `d` aponta na tela)."""
    P = iso.p
    desl = lambda Q, k: (Q[0] + d[0] * k, Q[1] + d[1] * k, Q[2] + d[2] * k)
    for Q in (A, B):
        a, b = P(*desl(Q, folga)), P(*desl(Q, off + passa))
        s.line(a[0], a[1], b[0], b[1], stroke=C['dim'], sw=0.8)
    a, b = P(*desl(A, off)), P(*desl(B, off))
    s._bb(a[0], a[1], b[0], b[1])
    s.add(f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{C["dim"]}" stroke-width="1" '
          f'marker-start="{s.u("tick")}" marker-end="{s.u("tick")}"/>')
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    o = P(0, 0, 0)
    q = P(*d)
    ux, uy = q[0] - o[0], q[1] - o[1]
    n = math.hypot(ux, uy) or 1
    ux, uy = ux / n, uy / n
    vertical = abs(a[0] - b[0]) < 1e-6
    if vertical:
        s.text(mx + (12 if ux >= 0 else -12), my + T_SIM * 0.35, rotulo, size=T_SIM, color=C['dim'],
               anchor='start' if ux >= 0 else 'end')
    else:
        anc = 'end' if ux < -0.3 else 'start' if ux > 0.3 else 'middle'
        s.text(mx + ux * 13, my + uy * 13 + T_SIM * 0.55, rotulo, size=T_SIM, color=C['dim'], anchor=anc)


def cotas(s, iso, L, Lmax, t, h, cortada):
    s.add(f'<g id="{s.pid}-cotas">')
    OFF = 5.0
    if cortada:
        cota(s, iso, (0, t, 0), (L, t, 0), (0, 1, 0), OFF, 'ℓ')
        cota(s, iso, (0, t, 0), (Lmax, t, 0), (0, 1, 0), 2 * OFF + 1, cm(Lmax), folga=OFF + 2.5)
    else:
        cota(s, iso, (0, t, 0), (L, t, 0), (0, 1, 0), OFF, cm(L))
    cota(s, iso, (Lmax, 0, 0), (Lmax, t, 0), (1, 0, 0), OFF, cm(t))
    cota(s, iso, (Lmax, 0, 0), (Lmax, 0, h), (0, -1, 0), OFF, cm(h))
    s.add('</g>')


# ── montagem ────────────────────────────────────────────────────────────────────────────────────────────────────

def _caixa_tela(iso, x1, t, h):
    pts = [iso.p(x, y, z) for x in (0, x1) for y in (0, t) for z in (0, h)]
    xs, ys = [q[0] for q in pts], [q[1] for q in pts]
    return min(xs), min(ys), max(xs), max(ys)


def tamanho_icone(fam):
    """Caixa comum do ícone na família: a da maior peça, com margem (todas na mesma escala)."""
    W = H = 0.0
    for arq, _ in PECAS[fam]:
        _, Lmax, t, h = medidas(fam, arq)
        W = max(W, (Lmax + t) * CO * S)
        H = max(H, ((Lmax + t) * SI + h) * S)
    m = 0.05 * max(W, H)
    return W + 2 * m, H + 2 * m


def pid(fam, arq):
    return 'pc' + PREFIXO[fam] + arq.replace('_', '')


def desenhar(fam, arq):
    F = CAT['familias'][fam]
    chave = dict(PECAS[fam])[arq]
    pc = _peca(fam, chave)
    cor = CAT['cores'][pc['classe']]
    L, Lmax, t, h = medidas(fam, arq)
    s = FigPeca(pid(fam, arq))
    iso = Iso(s, 0, 0, S, sx=1, sy=1)
    if pc['forma'] == 'bloco':
        desenhar_bloco(s, iso, L, t, h, pc['furos'], cor)
    else:
        k = F['canaleta']
        p, f, r = k['parede'] / 10, k['fundo'] / 10, k['r'] / 10
        desenhar_canaleta(s, iso, L, t, h, p, f, r, cor)
        if Lmax > L:
            fantasma_canaleta(s, iso, L, Lmax, t, h, p, f, r)
    x0, y0, x1, y1 = _caixa_tela(iso, Lmax, t, h)
    s.desenho = (x0, y0, x1, y1)
    W, H = tamanho_icone(fam)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s.icone = (cx - W / 2, cy - H / 2, W, H)
    cotas(s, iso, L, Lmax, t, h, arq == 'canaleta_cortada')
    return s


def todas():
    for fam in PECAS:
        for arq, _ in PECAS[fam]:
            yield fam, arq


if __name__ == '__main__':
    for fam, arq in todas():
        print(fam, arq, len(desenhar(fam, arq).svg()))
