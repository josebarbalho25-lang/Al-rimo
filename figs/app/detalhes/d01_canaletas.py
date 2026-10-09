# Detalhe 1 — encontro das canaletas no contraforte (fiada de canaleta), em perspectiva isométrica e em planta.
#
# O que vem do Jose (fala, 09/10): na obra "os caras têm que quebrar a canaleta para dar certo" e "geralmente ou
# quebra ou corta pra canaleta fechar um Tzinho" — a parede lateral da canaleta do MURO sai no trecho onde a canaleta
# do CONTRAFORTE encosta, e as duas calhas viram uma calha só em T (graute e barra passam de uma para a outra).
# Também dele (09/10): a barra da canaleta do contraforte entra na canaleta do muro DOBRADA EM L, com a perna deitada
# ao lado da barra da cinta — a forma desenhada aqui é a que ele confirmou, e é a que a modulação do app põe
# (app/src/modulacao/armaduras.ts, barrasDasCanaletasDosContrafortes).
#
# O que vem dos gabaritos medidos no Revit dele (dados/encaixes_revit/*_templates.json, fiada 5 = canaleta):
#   bloco 19 — contraforte de 59 (T): muro com canaleta cortada 19 + canaleta 39 que passa sobre o T; por fora,
#              canaleta 39 girada, com junta de 1 cm até a face do muro. Canaleta 19x19x39: paredes 2,5, fundo 2,91;
#              a cortada é peça própria, com fundo de 3,91 (Jose, 09/10 — "Canaleta 19 Corte 19cm").
#   bloco 14 — contraforte de 54 (T): muro com canaletas 39 corridas (a junta entre duas cai DENTRO do canal do
#              contraforte, por isso o trecho quebrado pega a ponta das duas); por fora, canaleta 14x19x39 girada,
#              junta de 1 cm. Canaleta 14x19x39: paredes 2,5, fundo 3,91.
#   A canaleta da família é um U aberto nas pontas (o volume do Revit só fecha assim), então a ponta da canaleta do
#   contraforte já chega aberta: só a parede do muro precisa sair.
#
# Regras do app que o desenho repete (as mesmas da modulação):
#   - as barras ficam 1,5 cm de graute acima do fundo MAIS ALTO da fiada (COB_GRAUTE) — na 19, o da cortada;
#   - a barra do contraforte começa a 3 cm da ponta dele (COB_PONTA), tem o Ø da cinta e dobra com o pino da NBR
#     (5φ: raio do eixo 3φ); a perna, depois da dobra, encosta na barra da cinta do lado do contraforte.
#
# O app desenha este mesmo T no 3D e no IFC (app/src/modulacao/canaletas.ts, 09/10 noite): a canaleta do muro
# perde a parede no canal, até o fundo, e uma peça de graute enche a parede quebrada e a junta muro × haste, ligando
# o graute das duas calhas. Lá a parede sai junto com o canto arredondado do fundo daquele lado (a canaleta do Revit
# tem os dois cantos do fundo arredondados por dentro; aqui o desenho é de canto vivo — a mesma quebra).
#
# DEDUÇÃO (não veio dos gabaritos nem da fala do Jose):
#   - o trecho removido tem a largura do canal do contraforte (t − 2·parede) e desce até o fundo da canaleta do
#     muro — é o mínimo que fecha o T sem degrau;
#   - o comprimento da perna: no app é o ℓb da conta quando o Ø é o da barra vertical, senão 30φ. A cota da figura
#     diz ℓb; o desenho tem 30φ (PERNA);
#   - na 19 o muro desenhado ganha um pedaço da canaleta seguinte (cortado pela linha de interrupção) para a perna
#     caber inteira.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det, Iso, Caixa, tom  # noqa: E402
from applib import C, T_TIT  # noqa: E402

PHI = 1.0          # Ø da barra no desenho (cm)
COB = 1.5          # graute sob a barra (COB_GRAUTE da modulação)
COB_PONTA = 3.0    # da ponta do contraforte à ponta da barra (COB_PONTA da modulação)
R_DOBRA = 3 * PHI  # raio do eixo na dobra: pino 5φ (NBR 6118, φ < 20) → 2,5φ + φ/2
PERNA = 30 * PHI   # DEDUÇÃO: perna da dobra, trecho reto depois dela (30φ — o app usa o ℓb da conta quando pode)
SOBRA = 7.0        # quanto a barra da cinta passa das pontas do trecho desenhado (mostra que continua)

VARIANTES = {
    # muro: peças da fiada 5 em volta do T (x0, x1, fundo); yw: faces do muro; cf_*: canaleta girada do contraforte
    # (inteira, fundo = 'fundo'). Na 19 a 1ª peça é a cortada (fundo 3,91) e a última é um pedaço da canaleta
    # seguinte, para caber a perna.
    'b19': dict(t=19, par=2.5, fundo=2.91, h=19.0, muro=[(-223.6, -204.6, 3.91), (-203.6, -164.6, 2.91), (-163.6, -151.6, 2.91)],
                yw=(-27.1, -8.1), cf_x=(-203.6, -184.6), cf_y=(-67.1, -28.1)),
    'b14': dict(t=14, par=2.5, fundo=3.91, h=19.0, muro=[(-1592.1, -1553.1, 3.91), (-1552.1, -1513.1, 3.91)],
                yw=(-22.1, -8.1), cf_x=(-1562.1, -1548.1), cf_y=(-62.1, -23.1)),
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
    # as barras correm retas por cima de canaletas de fundos diferentes: ficam no mais alto (regra do app)
    zb = max([fundo] + [f for _, _, f in v['muro']]) + COB + PHI / 2
    X0, X1 = v['muro'][0][0], v['muro'][-1][1]
    # trechos ao longo do muro: peças e juntas entre elas (a argamassa da junta é a face comum: o fundo mais fino)
    trechos = []
    for i, (a, b, f) in enumerate(v['muro']):
        trechos.append((a, b, f, COR))
        if i + 1 < len(v['muro']):
            trechos.append((b, v['muro'][i + 1][0], min(f, v['muro'][i + 1][2]), ARG))
    cx = []
    for a, b, f, cor in trechos:
        cx.append(Caixa(a, b, yw0, yw1, 0, f, cor))                                       # fundo
        for p0, p1 in _menos(a, b, [(nx0, nx1)]):                                         # parede do lado do contraforte
            cx.append(Caixa(p0, p1, yw0, yw0 + par, f, h, cor))
        cx.append(Caixa(a, b, yw1 - par, yw1, f, h, cor, opac={'esq': GHOST}))           # parede da frente
    # canaleta do contraforte (corre em Y) e a junta de 1 cm até a face do muro
    for ya, yb, cor in ((cy0, cy1, COR), (cy1, yw0, ARG)):
        if yb - ya < 1e-6:
            continue
        cx.append(Caixa(cx0, cx1, ya, yb, 0, fundo, cor))
        cx.append(Caixa(cx0, cx0 + par, ya, yb, fundo, h, cor))
        cx.append(Caixa(cx1 - par, cx1, ya, yb, fundo, h, cor, opac={'dir': GHOST}))
    # barras: cinta do muro contínua; barra do contraforte entra pelo trecho aberto e dobra em L ao lado da cinta.
    # Na perspectiva a dobra fica em canto vivo (caixas); a planta mostra o raio.
    aco = dict(borda=tom(C['steel'], -0.35), sw=0.5, tons=(0.25, 0.0, -0.3))
    aco2 = dict(borda=tom(C['barra2'], -0.4), sw=0.5, tons=(0.25, 0.0, -0.3))
    cx.append(Caixa(X0 - SOBRA, X1 + SOBRA, yc - PHI / 2, yc + PHI / 2, zb - PHI / 2, zb + PHI / 2, C['steel'], **aco))
    yl = yc - 1.5 * PHI                                       # perna encostada na cinta, do lado do contraforte
    xf = xc + R_DOBRA + PERNA                                 # fim da perna
    cx.append(Caixa(xc - PHI / 2, xc + PHI / 2, cy0 + COB_PONTA, yl, zb - PHI / 2, zb + PHI / 2, C['barra2'], **aco2))
    cx.append(Caixa(xc - PHI / 2, xf, yl, yl + PHI, zb - PHI / 2, zb + PHI / 2, C['barra2'], **aco2))
    return dict(cx=cx, nx=(nx0, nx1), xc=xc, yc=yc, zb=zb, X=(X0, X1), yl=yl, xf=xf)


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
    for a, b, _ in v['muro']:
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
    # barra do contraforte: eixo com a dobra de raio R_DOBRA (centro recuado R no trecho do contraforte e R na perna)
    yl = yc - PHI
    R = R_DOBRA
    arco = [Q(xc + R - R * math.cos(k * math.pi / 16), yl - R + R * math.sin(k * math.pi / 16)) for k in range(9)]
    s.pline([Q(xc, cy0 + COB_PONTA)] + arco + [Q(g['xf'], yl)], stroke=C['barra2'], sw=max(2.6, PHI * S * 0.8))
    # perna: o trecho reto depois da dobra, cotado embaixo do muro (o valor é o da conta — lista de ferros)
    yq = Q(0, yw1 + 6)[1]
    s.dim_h(Q(xc + R, 0)[0], Q(g['xf'], 0)[0], yq, 'ℓ_{b}', off_text=22, ext_from=(Q(0, yl)[1] + 4, Q(0, yl)[1] + 4))
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
