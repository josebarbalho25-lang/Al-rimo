from figlib import SVG, C
W, H = 1220, 600
s = SVG(W, H)
s.text(30, 34, 'Fig. 1 — Muro de arrimo em balanço: visão geral e entradas', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Corte vertical. Entre aspas, os campos da aba Entradas.', size=13, anchor='start', color=C['note'])
K = 150
h = 2.0; t = 0.19; zNA = 1.0; hp = 0.8
xw = 610; xs = xw + t * K
yb = 450; yt = yb - h * K
# Duas alturas (09/10): o muro passa do topo do solo. ytop = topo do muro; yt = topo do solo.
ytop = yt - 0.4 * K
xr = 1170
# terreno contido e da frente
s.rect(xs, yt, xr - xs, 570 - yt, fill='url(#soilh)', stroke='none')
s.rect(470, yb + 70, xr - 470, 500 - yb, fill='url(#soilh)', stroke='none')
s.line(xs, yt, xr, yt, stroke=C['soil'], sw=2)
s.rect(470, yb, 60, 120, fill='url(#soilh)', stroke='none')
s.line(470, yb, 530, yb, stroke=C['soil'], sw=2)
# dreno
s.rect(xs, yt + 20, 22, yb - yt - 20, fill='#f4f4f4', stroke='#a6a6a6', sw=0.8, extra='stroke-dasharray="3,3"')
# fundação
s.rect(530, yb, 230, 70, fill='url(#conc)', stroke=C['line'], sw=1.4)
s.text(575, yb + 42, 'fundação', size=12, color=C['note'])
# muro + canaletas
s.rect(xw, ytop, t * K, yb - ytop, fill=C['blockfill'], stroke=C['line'], sw=1.4)
for yc in (yb - hp * K - 14, yb - 2 * hp * K - 14, ytop):
    s.rect(xw, yc, t * K, 28, fill=C['groutfill'], stroke=C['grout'], sw=1)
# barra com gancho
xb = xs - 0.05 * K
s.pline([(xb, ytop + 6), (xb, yb + 52), (xb + 34, yb + 52)], stroke=C['steel'], sw=2.6)
# barbacã
s.line(xw - 6, yb - 20, xs + 22, yb - 26, stroke='#7f7f7f', sw=4)
# sobrecarga
for x in range(int(xs) + 20, xr - 6, 34):
    s.arrow(x, yt - 46, x, yt - 3, color=C['load'], sw=1.4)
s.line(xs + 20, yt - 46, xr - 20, yt - 46, stroke=C['load'], sw=1.4)
s.text(900, yt - 54, '"Sobrecarga no terreno (q)"', size=13, color=C['load'])
# NA
yNA = yt + zNA * K
s.line(xs + 22, yNA, xr, yNA, stroke=C['water'], sw=1.6, extra='stroke-dasharray="8,5"')
s.poly([(1110, yNA - 2), (1122, yNA - 2), (1116, yNA - 12)], fill=C['water'], stroke='none')
s.text(1128, yNA - 6, 'NA', size=12, anchor='start', color=C['water'], weight='bold')
s.dim_v(xr + 22, yt, yNA, '"Profundidade do NA"', side=1, ext_from=(xr, xr), size=11)
# empuxo
s0, s1 = 0.8, 16.0; kp = 9.0
x0 = xs + 22
s.poly([(x0, yt), (x0 + s0 * kp + 6, yt), (x0 + s1 * kp, yb), (x0, yb)], fill='#f8cbad', stroke=C['load'], sw=1.4, extra='fill-opacity="0.75"')
for i in range(1, 7):
    y = yt + i * (yb - yt) / 7
    s.arrow(x0 + (s0 + (s1 - s0) * i / 7) * kp, y, x0 + 2, y, color=C['load'], sw=1.2)
s.text(x0 + 30, yt + 22, 'σh,topo = Ka·q', size=12, anchor='start', color=C['load'])
s.text(x0 + s1 * kp + 10, yb - 8, 'σh,base', size=12, anchor='start', color=C['load'])
s.text(x0 + 175, yt + 120, 'empuxo de Rankine', size=12, anchor='start', color=C['load'], weight='bold')
s.text(x0 + 175, yt + 138, '(água somada se "Considerar água?" = Sim)', size=11, anchor='start', color=C['load'])
s.text(1010, yb - 70, 'terreno contido', size=13, color=C['soil'], weight='bold')
s.text(1010, yb - 52, '"Tipo de solo", "NSPT", "γ",', size=11, color=C['soil'])
s.text(1010, yb - 37, '"φ\'" ou "Ka direto", "c\'"', size=11, color=C['soil'])
# cotas
s.dim_v(xw - 28, ytop, yb, '"Altura do muro (h muro)"', side=-1, ext_from=(xw, xw), size=12)
s.dim_v(xw - 100, yt, yb, '"Altura de solo contido (h solo)"', side=-1, ext_from=(xs, xw), size=12)
s.dim_v(xw - 62, yb - hp * K, yb, '"Esp. canaletas"', side=-1, ext_from=(xw, xw), size=11)
s.dim_h(xw, xs, ytop - 12, 't', off_text=-6, size=12)
s.dim_v(xb + 52, yb, yb + 52, 'lb', side=1, size=11)
# chamadas (texto à esquerda, linha até o elemento)
def callout(px, py, ty, lines, color=C['line']):
    for i, l in enumerate(lines):
        s.text(30, ty + i * 15, l, size=12, anchor='start', color=color)
    tw = max(len(l) for l in lines) * 6.3
    ly = ty - 4 + (len(lines) - 1) * 7.5
    s.line(30 + tw + 6, ly, px, py, stroke=color, sw=0.9)
    s.circle(px, py, 2.4, fill=color)
callout(xb, yt + 70, yt + 40, ['barra vertical: "Ø armadura vertical" a cada', '"Espaçamento das barras", ~5 cm da face do solo'], color=C['steel'])
callout(xw + 10, yb - hp * K, yt + 130, ['canaleta grauteada com barra horizontal', '(a cada "Espaçamento das canaletas")'], color=C['grout'])
callout(xw + 12, yt + 215, yt + 205, ['bloco: "Espessura do bloco (t)", "Comprimento",', '"fbk", "Seção / grauteamento"'])
callout(xw + 2, yb - 21, yb - 40, ['drenagem: dreno + barbacãs (detalhe de projeto)'], color='#7f7f7f')
callout(xb + 30, yb + 52, yb + 50, ['espera com gancho na fundação: "Concreto da', 'fundação", "Zona de aderência", "Gancho"'], color=C['steel'])
s.save('fig01_geral.svg')
print('ok')
