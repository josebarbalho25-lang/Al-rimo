from figlib import SVG, C
W, H = 1180, 580
s = SVG(W, H)
s.text(30, 34, 'Fig. 8 — Tração na flexão da alvenaria: direção em relação à fiada', size=18, anchor='start', weight='bold')
s.text(30, 56, 'ftk depende da argamassa e da direção da tração. Entra no painel não armado e no momento de fissuração (ELS).', size=13, anchor='start', color=C['note'])
def wall(x0, y0, w, h, K=1.7):
    for i in range(int(h / 20)):
        y = y0 + h * K - (i + 1) * 20 * K
        off = 0 if i % 2 == 0 else 20
        xs = -off
        while xs < w:
            a = max(xs, 0); b = min(xs + 39, w)
            if b > a: s.rect(x0 + a * K, y, (b - a) * K, 19 * K, fill=C['blockfill'], stroke=C['block'], sw=0.8)
            xs += 40
K = 1.7
# (a) normal à fiada
xa, ya = 150, 160
s.text(xa + 100 * K, 110, '(a) Tração NORMAL à fiada → ftk ⊥', size=15, weight='bold')
wall(xa, ya, 200, 120)
yc = ya + 120 * K - 40 * K
s.line(xa, yc, xa + 200 * K, yc, stroke=C['steel'], sw=3)
s.arrow(xa + 100 * K, ya - 6, xa + 100 * K, ya - 40, color=C['load']); s.arrow(xa + 100 * K, ya + 120 * K + 6, xa + 100 * K, ya + 120 * K + 40, color=C['load'])
s.text(xa + 100 * K, ya + 120 * K + 66, 'fissura horizontal na junta de assentamento', size=12, color=C['steel'])
s.text(xa + 100 * K, ya + 120 * K + 84, 'ex.: base do muro em balanço (ELS), Md,nor do painel', size=12, color=C['note'])
# (b) paralela à fiada
xb = 700
s.text(xb + 100 * K, 110, '(b) Tração PARALELA à fiada → ftk ∥', size=15, weight='bold')
wall(xb, ya, 200, 120)
# fissura em escada
pts = []; x = xb + 100 * K; y = ya
for i in range(6):
    pts += [(x, y), (x, y + 20 * K)]
    y += 20 * K; x += (20 * K if i % 2 == 0 else -20 * K)
s.pline(pts, stroke=C['steel'], sw=3)
s.arrow(xb - 6, ya + 60 * K, xb - 40, ya + 60 * K, color=C['load']); s.arrow(xb + 200 * K + 6, ya + 60 * K, xb + 200 * K + 40, ya + 60 * K, color=C['load'])
s.text(xb + 100 * K, ya + 120 * K + 66, 'fissura vertical / em escada pelas juntas', size=12, color=C['steel'])
s.text(xb + 100 * K, ya + 120 * K + 84, 'ex.: painel entre barras vencendo na horizontal (Md,par)', size=12, color=C['note'])
# tabela
ty = 500
s.text(80, ty, 'Argamassa (resist. média)', size=13, anchor='start', weight='bold')
for j, h_ in enumerate(['1,5 a 3,4 MPa', '3,5 a 7,0 MPa', 'acima de 7,0 MPa']):
    s.text(330 + j * 170, ty, h_, size=13, weight='bold')
s.text(80, ty + 24, 'ftk ⊥ (MPa)', size=13, anchor='start'); s.text(80, ty + 46, 'ftk ∥ (MPa)', size=13, anchor='start')
for j, (a, b) in enumerate([('0,10', '0,20'), ('0,20', '0,40'), ('0,25', '0,50')]):
    s.text(330 + j * 170, ty + 24, a, size=13); s.text(330 + j * 170, ty + 46, b, size=13)
s.text(860, ty + 24, 'μ = ftk⊥ / ftk∥ = 0,5', size=13, anchor='start', weight='bold')
s.text(860, ty + 46, 'Campo: "Argamassa"', size=12, anchor='start', color=C['note'])
s.save('fig08_tracao.svg'); print('ok')
