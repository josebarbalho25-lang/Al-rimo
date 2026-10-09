from figlib import SVG, C
W, H = 1180, 560
s = SVG(W, H)
s.text(30, 34, 'Fig. 7 — Altura efetiva (he) e esbeltez λ = he/t', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Entra no momento de 2ª ordem (M2d) e no limite de esbeltez λ ≤ 30 (alvenaria armada).', size=13, anchor='start', color=C['note'])
# (a) sem travamento lateral: balanço livre no topo
x, yb, hpx = 180, 470, 300
s.text(x + 10, 110, '(a) Sem travamento lateral', size=15, weight='bold')
s.text(x + 10, 130, '"Travamento lateral transversal?" = Não', size=12, color=C['note'])
s.rect(x, yb - hpx, 24, hpx, fill=C['blockfill'], stroke=C['line'], sw=1.4)
s.rect(x - 60, yb, 150, 26, fill='url(#conc)', stroke=C['line'])
# deformada de flambagem equivalente (balanço → 2h)
pts = [(x + 12 + 70 * (1 - __import__('math').cos(3.14159 / 2 * (1 - (yb - y) / hpx * 0 - (yb - y) / hpx * 1 + 1 - 1))) * 0, y) for y in range(int(yb - hpx), yb + 1, 10)]
import math
dpts = [(x + 12 + 55 * (1 - math.cos(math.pi / 2 * (yb - y) / hpx)), y) for y in range(yb, int(yb - hpx) - 1, -10)]
s.pline(dpts, stroke=C['load'], sw=2, extra='stroke-dasharray="6,4"')
s.dim_v(x - 30, yb - hpx, yb, 'h', side=-1, ext_from=(x, x), size=13)
s.text(x + 150, yb - hpx / 2 - 10, 'he = 2·h', size=20, weight='bold', color=C['load'])
s.text(x + 150, yb - hpx / 2 + 14, 'balanço livre no topo', size=12, color=C['note'])
s.text(x + 150, yb - hpx / 2 + 30, '(aula 12.2)', size=12, color=C['note'])
# (b) com travamento lateral
x2, w2 = 640, 420
s.text(x2 + w2 / 2, 110, '(b) Com travamento lateral (paredes transversais / enrijecedores)', size=15, weight='bold')
s.text(x2 + w2 / 2, 130, '"Travamento lateral transversal?" = Sim → usa "αv", "αh" e "l"', size=12, color=C['note'])
s.rect(x2, yb - hpx, w2, hpx, fill=C['blockfill'], stroke=C['line'], sw=1.2)
for xx in (x2, x2 + w2):
    s.rect(xx - 10, yb - hpx, 20, hpx, fill='#a6a6a6', stroke=C['line'], sw=1.2)
s.text(x2 - 14, yb - hpx - 8, 'travamento', size=11, color=C['note'], anchor='middle')
s.text(x2 + w2 + 14, yb - hpx - 8, 'travamento', size=11, color=C['note'], anchor='middle')
s.rect(x2 - 40, yb, w2 + 80, 26, fill='url(#conc)', stroke=C['line'])
s.dim_h(x2, x2 + w2, yb + 50, 'l = distância entre travamentos', size=12)
s.dim_v(x2 - 40, yb - hpx, yb, 'h', side=-1, ext_from=(x2 - 10, x2 - 10), size=13)
s.text(x2 + w2 / 2, yb - hpx + 50, 'he = mín( αv·h ;  0,7·√(αv·h·αh·l) )', size=17, weight='bold', color=C['load'])
s.text(x2 + w2 / 2, yb - hpx + 90, 'αv = 1,0 travada no topo e na base;  2,5 só na base', size=13)
s.text(x2 + w2 / 2, yb - hpx + 112, 'αh = 1,0 travada nos dois lados;  2,5 só de um lado', size=13)
s.text(x2 + w2 / 2, yb - hpx + 146, 'planilha 02 do curso (aba Altura Efetiva)', size=12, color=C['note'])
s.save('fig07_he.svg'); print('ok')
