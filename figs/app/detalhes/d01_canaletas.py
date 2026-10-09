# Detalhe 1 — encontro das canaletas no contraforte (fiada de canaleta), em perspectiva isométrica e em planta.
#
# O que vem do Jose (fala, 09/10): na obra "os caras têm que quebrar a canaleta para dar certo" e "geralmente ou
# quebra ou corta pra canaleta fechar um Tzinho" — a parede lateral da canaleta do MURO sai no trecho onde a canaleta
# do CONTRAFORTE encosta, e as duas calhas viram uma calha só em T (graute e barra passam de uma para a outra).
#
# O que vem dos gabaritos medidos no Revit dele (dados/encaixes_revit/*_templates.json, fiada 5 = canaleta):
#   bloco 19 — contraforte de 59 (T): muro com canaleta cortada 19 + canaleta 39 que passa sobre o T; por fora,
#              canaleta 39 girada, com junta de 1 cm até a face do muro. Canaleta 19x19x39: paredes 2,5, fundo 2,91.
#   bloco 14 — contraforte de 54 (T): muro com canaletas 39 corridas (a junta entre duas cai DENTRO do canal do
#              contraforte, por isso o trecho quebrado pega a ponta das duas); por fora, canaleta 14x19x39 girada,
#              junta de 1 cm. Canaleta 14x19x39: paredes 2,5, fundo 3,91.
#   A canaleta da família é um U aberto nas pontas (o volume do Revit só fecha assim), então a ponta da canaleta do
#   contraforte já chega aberta: só a parede do muro precisa sair.
#
# DEDUÇÃO (não veio dos gabaritos nem da fala do Jose):
#   - o trecho removido tem a largura do canal do contraforte (t − 2·parede) e desce até o fundo da canaleta do
#     muro — é o mínimo que fecha o T sem degrau;
#   - a barra horizontal da canaleta do contraforte, a dobra em L ao lado da barra da cinta e o comprimento dessa
#     perna (PERNA) — a modulação do app não põe barra na canaleta do contraforte; está marcada "esquema";
#   - a altura das barras (fundo + 1,5 cm de graute + Ø/2) é a mesma que a modulação usa na cinta (COB_GRAUTE).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det, Iso, Caixa, tom  # noqa: E402
from applib import C, T_TIT, T_PEQ  # noqa: E402

PHI = 1.0          # Ø da barra no desenho (cm)
COB = 1.5          # graute sob a barra (COB_GRAUTE da modulação)
PERNA = 22.0       # DEDUÇÃO: perna da dobra da barra do contraforte dentro da canaleta do muro
SOBRA = 7.0        # quanto a barra da cinta passa das pontas do trecho desenhado (mostra que continua)

VARIANTES = {
    # muro: peças da fiada 5 em volta do T (x0, x1); yw: faces do muro; cf_*: canaleta girada do contraforte
    'b19': dict(t=19, par=2.5, fundo=2.91, h=19.0, muro=[(-223.6, -204.6), (-203.6, -164.6)], yw=(-27.1, -8.1),
                cf_x=(-203.6, -184.6), cf_y=(-67.1, -28.1)),
    'b14': dict(t=14, par=2.5, fundo=3.91, h=19.0, muro=[(-1592.1, -1553.1), (-1552.1, -1513.1)], yw=(-22.1, -8.1),
                cf_x=(-1562.1, -1548.1), cf_y=(-62.1, -23.1)),
}

COR = C['blockfill']
ARG = '#bfbfbf'      # argamassa das juntas de 1 cm
GHOST = 0.2         # face da frente que esconderia as barras: vista "por transparência"


def _menos(a, b, cortes):
    """Trecho [a, b] sem os intervalos de `cortes` (a parede do muro sem o pedaço quebrado)."""
    out = [(a, b)]
    for c0, c1 in cortes:
        nov = []
        for x0, x1 in out:
            if c1 <= x0 or c0 >= x1:
                nov.append((x0, x1))
                continue
            if c0 > x0:
                nov.append((x0, c0))
            if c1 < x1:
                nov.append((c1, x1))
        out = nov
    return [(x0, x1) for x0, x1 in out if x1 - x0 > 1e-6]


def geometria(v):
    yw0, yw1 = v['yw']
    par, fundo, h = v['par'], v['fundo'], v['h']
    cx0, cx1 = v['cf_x']
    cy0, cy1 = v['cf_y']
    nx0, nx1 = cx0 + par, cx1 - par                  # canal do contraforte = trecho que sai da parede do muro
    xc, yc = (cx0 + cx1) / 2, (yw0 + yw1) / 2
    zb = fundo + COB + PHI / 2
    X0, X1 = v['muro'][0][0], v['muro'][-1][1]
    # trechos ao longo do muro: peças e juntas entre elas
    trechos = []
    for i, (a, b) in enumerate(v['muro']):
        trechos.append((a, b, COR))
        if i + 1 < len(v['muro']):
            trechos.append((b, v['muro'][i + 1][0], ARG))
    cx = []
    for a, b, cor in trechos:
        cx.append(Caixa(a, b, yw0, yw1, 0, fundo, cor))                                   # fundo
        for p0, p1 in _menos(a, b, [(nx0, nx1)]):                                         # parede do lado do contraforte
            cx.append(Caixa(p0, p1, yw0, yw0 + par, fundo, h, cor))
        cx.append(Caixa(a, b, yw1 - par, yw1, fundo, h, cor, opac={'esq': GHOST}))       # parede da frente
    # canaleta do contraforte (corre em Y) e a junta de 1 cm até a face do muro
    for ya, yb, cor in ((cy0, cy1, COR), (cy1, yw0, ARG)):
        if yb - ya < 1e-6:
            continue
        cx.append(Caixa(cx0, cx1, ya, yb, 0, fundo, cor))
        cx.append(Caixa(cx0, cx0 + par, ya, yb, fundo, h, cor))
        cx.append(Caixa(cx1 - par, cx1, ya, yb, fundo, h, cor, opac={'dir': GHOST}))
    # barras: cinta do muro contínua; barra do contraforte entra pelo trecho aberto e dobra ao lado da cinta
    aco = dict(borda=tom(C['steel'], -0.35), sw=0.5, tons=(0.25, 0.0, -0.3))
    aco2 = dict(borda=tom(C['barra2'], -0.4), sw=0.5, tons=(0.25, 0.0, -0.3))
    cx.append(Caixa(X0 - SOBRA, X1 + SOBRA, yc - PHI / 2, yc + PHI / 2, zb - PHI / 2, zb + PHI / 2, C['steel'], **aco))
    yl = yc - 1.5 * PHI                                       # perna encostada na cinta, do lado do contraforte
    cx.append(Caixa(xc - PHI / 2, xc + PHI / 2, cy0 + 3, yl, zb - PHI / 2, zb + PHI / 2, C['barra2'], **aco2))
    cx.append(Caixa(xc - PHI / 2, xc + PERNA, yl, yl + PHI, zb - PHI / 2, zb + PHI / 2, C['barra2'], **aco2))
    return dict(cx=cx, nx=(nx0, nx1), xc=xc, yc=yc, zb=zb, X=(X0, X1), yl=yl)


def perspectiva(s, v, g, ox, oy, S):
    yw0, yw1 = v['yw']
    par, fundo, h = v['par'], v['fundo'], v['h']
    cy0, cy1 = v['cf_y']
    cx0, cx1 = v['cf_x']
    nx0, nx1 = g['nx']
    iso = Iso(s, ox, oy, S, sx=1, sy=1, ref=(g['xc'], g['yc'], 0))
    # o pedaço removido entra na ordem de pintura como caixa translúcida (fica atrás da cinta e na frente do
    # contraforte); as arestas tracejadas vão por cima de tudo
    fantasma = Caixa(nx0, nx1, yw0, yw0 + par, fundo, h, C['erro_fill'], borda='none', sw=0,
                     opac={'topo': 0.75, 'esq': 0.75, 'dir': 0.75}, tons=(0.0, -0.04, -0.1))
    iso.desenhar(g['cx'] + [fantasma])
    iso.arestas_caixa(nx0, nx1, yw0, yw0 + par, fundo, h, cor=C['erro'], sw=1.6, dash='5 3')
    bb = list(s.caixa)                      # só o desenho (rótulos posicionados em volta dele)
    P = iso.p
    X0, X1 = g['X']
    a = P(nx0 + 1.5, yw0 + par / 2, h)
    s.chamada(a[0], a[1], a[0] - 110, bb[1] + 40, 'quebrar ou cortar', color=C['erro'], anchor='end', weight='bold')
    b = P(cx0 + par / 2, cy0 + 0.45 * (cy1 - cy0), h)
    s.chamada(b[0], b[1], b[0] - 40, bb[1] - 18, 'canaleta do contraforte', anchor='end')
    c = P(X0 + 10, yw1, h * 0.6)
    s.chamada(c[0], c[1], c[0] - 60, c[1] + 175, 'canaleta do muro', anchor='start')
    d = P(X1 + SOBRA - 2, g['yc'], g['zb'])
    s.chamada(d[0], d[1], d[0] + 28, d[1] + 52, 'barra da cinta', color=C['steel'], anchor='start')
    e = P(g['xc'], cy0 + 7, g['zb'])
    cor2 = tom(C['barra2'], -0.3)
    s.chamada(e[0], e[1], bb[2] + 18, e[1] + 4, 'barra do contraforte', color=cor2, anchor='start')
    s.text(bb[2] + 18, e[1] + 26, '(esquema)', size=T_PEQ, color=cor2, anchor='start')
    return bb


def planta(s, v, g, ox, oy, S):
    yw0, yw1 = v['yw']
    par = v['par']
    cx0, cx1 = v['cf_x']
    cy0, cy1 = v['cf_y']
    nx0, nx1 = g['nx']
    xc, yc = g['xc'], g['yc']
    X0, X1 = g['X']
    Q = lambda x, y: (ox + (x - xc) * S, oy + (y - yc) * S)      # contraforte para cima na tela
    # graute: o T contínuo (canal do muro + canal do contraforte, passando pela junta e pelo trecho aberto)
    wc0, wc1 = yw0 + par, yw1 - par
    T = [Q(X0, wc0), Q(nx0, wc0), Q(nx0, cy0), Q(nx1, cy0), Q(nx1, wc0), Q(X1, wc0), Q(X1, wc1), Q(X0, wc1)]
    s.poly(T, fill=C['groutfill'], stroke=C['grout'], sw=1.0)

    def ret(x0, y0, x1, y1, **kw):
        (a, b), (c, d) = Q(x0, y0), Q(x1, y1)
        s.rect(min(a, c), min(b, d), abs(c - a), abs(d - b), **kw)
    for a, b in v['muro']:
        for p0, p1 in _menos(a, b, [(nx0, nx1)]):
            ret(p0, yw0, p1, yw0 + par, fill=C['blockfill'], stroke=C['line'], sw=1.1)
        ret(a, yw1 - par, b, yw1, fill=C['blockfill'], stroke=C['line'], sw=1.1)
    ret(cx0, cy0, cx0 + par, cy1, fill=C['blockfill'], stroke=C['line'], sw=1.1)
    ret(cx1 - par, cy0, cx1, cy1, fill=C['blockfill'], stroke=C['line'], sw=1.1)
    # trecho removido da parede do muro
    ret(nx0, yw0, nx1, yw0 + par, fill='none', stroke=C['erro'], sw=1.8, extra='stroke-dasharray="5 3"')
    # largura do canal do contraforte = largura do trecho a quebrar (cota na ponta, onde há espaço; o trecho
    # tracejado embaixo está alinhado com ela). Número de catálogo da canaleta, não resultado de conta.
    ya = Q(0, cy0)[1]
    s.dim_h(Q(nx0, 0)[0], Q(nx1, 0)[0], ya - 24, ('%.1f' % (nx1 - nx0)).replace('.0', '').replace('.', ','),
            ext_from=(ya, ya))
    # linhas de interrupção nas pontas do trecho (o muro continua)
    for xq in (X0 - 2.5, X1 + 2.5):
        y_a, y_b = yw0 - 3, yw1 + 3
        ym = (y_a + y_b) / 2
        pts = [Q(xq, y_a), Q(xq, ym - 2), Q(xq + 1.4, ym - 1), Q(xq - 1.4, ym + 1), Q(xq, ym + 2), Q(xq, y_b)]
        s.pline(pts, stroke=C['line'], sw=1.0)
    # barras
    zl = Q(X0 - SOBRA, yc), Q(X1 + SOBRA, yc)
    s.line(zl[0][0], zl[0][1], zl[1][0], zl[1][1], stroke=C['steel'], sw=max(2.6, PHI * S * 0.8))
    yl = yc - PHI
    s.pline([Q(xc, cy0 + 3), Q(xc, yl), Q(xc + PERNA, yl)], stroke=C['barra2'], sw=max(2.6, PHI * S * 0.8))
    # rótulos: à esquerda o que é da alvenaria/graute, à direita as barras
    xe = Q(X0 - SOBRA, 0)[0] - 10
    xd = Q(cx1, 0)[0] + 70
    a = Q(nx0 + 1.5, yw0 + par / 2)
    s.chamada(a[0], a[1], xe, Q(0, yw0 - 9)[1], 'quebrar ou cortar', color=C['erro'], anchor='end', weight='bold')
    b = Q(nx0 + 1.5, cy0 + 9)
    s.chamada(b[0], b[1], xe, b[1] + 6, 'graute', color=C['grout'], anchor='end')
    d = Q(xc, cy0 + 16)
    cor2 = tom(C['barra2'], -0.3)
    s.chamada(d[0], d[1], xd, d[1] + 6, 'barra do contraforte', color=cor2, anchor='start')
    s.text(xd, d[1] + 28, '(esquema)', size=T_PEQ, color=cor2, anchor='start')
    c = Q(X1 + SOBRA - 1, yc)
    s.chamada(c[0], c[1], c[0] + 16, Q(0, yw1 + 11)[1], 'barra da cinta', color=C['steel'], anchor='start')


def desenhar(var):
    v = VARIANTES[var]
    s = Det('det01' + var, 1000, 600)
    g = geometria(v)
    bb = perspectiva(s, v, g, 0, 0, 7.0)
    xt = s.caixa[0]
    s.text(xt, bb[1] - 50, 'perspectiva', size=T_TIT, anchor='start', weight='bold')
    # planta embaixo da perspectiva, com o eixo do contraforte alinhado ao centro do desenho de cima
    Sp = 6.0
    topo_planta = s.caixa[3] + 70
    oy = topo_planta + (g['yc'] - v['cf_y'][0]) * Sp
    planta(s, v, g, (bb[0] + bb[2]) / 2, oy, Sp)
    s.text(xt, topo_planta - 20, 'planta', size=T_TIT, anchor='start', weight='bold')
    return s


if __name__ == '__main__':
    for k in VARIANTES:
        print(k, len(desenhar(k).svg()))
