from figlib import SVG, C
W, H = 1180, 600
s = SVG(W, H)
s.text(30, 34, "Fig. 11 — Pressões no muro: sem coesão, com coesão e com água", size=18, anchor='start', weight='bold')
s.text(30, 56, "Rankine, como na aula 12.1. A planilha calcula o perfil em 40 fatias e integra força e momento.", size=13, anchor='start', color=C['note'])
y0, Hp = 130, 360
def axis(x, title, sub):
    s.text(x + 90, y0 - 30, title, size=15, weight='bold')
    s.text(x + 90, y0 - 12, sub, size=11, color=C['note'])
    s.line(x, y0, x, y0 + Hp, stroke=C['line'], sw=2.4)
    s.line(x - 30, y0, x + 220, y0, stroke=C['soil'], sw=1.4)
    s.text(x - 8, y0 + Hp + 18, 'base', size=11, anchor='end', color=C['note'])
    s.text(x - 8, y0 + 4, 'topo', size=11, anchor='end', color=C['note'])
# (a) c' = 0
xa = 90; k = 9.5
axis(xa, "(a) c' = 0 (padrão)", 'σ\'h = Ka·(q + γ·z)')
s.poly([(xa, y0), (xa + 0.8 * k, y0), (xa + 16 * k, y0 + Hp), (xa, y0 + Hp)], fill='#f8cbad', stroke=C['load'], sw=1.4)
s.text(xa + 0.8 * k + 6, y0 + 16, 'Ka·q', size=11, anchor='start', color=C['load'])
# (b) c' > 0
xb = 480
axis(xb, "(b) c' > 0", "σ'h = Ka·σ'v − 2c'·√Ka ≥ 0")
z0 = 0.35 * Hp
s.poly([(xb, y0), (xb - 4 * k, y0), (xb, y0 + z0)], fill='none', stroke=C['load'], sw=1.2, extra='stroke-dasharray="5,4"')
s.poly([(xb, y0 + z0), (xb + 10 * k, y0 + Hp), (xb, y0 + Hp)], fill='#f8cbad', stroke=C['load'], sw=1.4)
s.text(xb - 4 * k - 4, y0 + 60, 'tração', size=11, anchor='end', color=C['load'])
s.text(xb - 4 * k - 4, y0 + 75, 'desprezada', size=11, anchor='end', color=C['load'])
s.dim_v(xb + 120, y0, y0 + z0, 'z0', side=1, size=12)
s.text(xb + 90, y0 + Hp + 40, 'coesão reduz o empuxo: use só com ensaio', size=11, color=C['steel'])
# (c) com água
xc = 860
axis(xc, '(c) com NA', "σh = σ'h (com γ − γw abaixo do NA) + u")
zna = 0.4 * Hp
pts = [(xc, y0), (xc + 0.8 * k, y0), (xc + 7 * k, y0 + zna), (xc + 10.5 * k, y0 + Hp), (xc, y0 + Hp)]
s.poly(pts, fill='#f8cbad', stroke=C['load'], sw=1.4)
s.poly([(xc + 7 * k, y0 + zna), (xc + 10.5 * k, y0 + Hp), (xc + 10.5 * k + 6 * k, y0 + Hp)], fill='#bdd7ee', stroke=C['water'], sw=1.4)
s.line(xc - 30, y0 + zna, xc + 220, y0 + zna, stroke=C['water'], sw=1.4, extra='stroke-dasharray="8,5"')
s.text(xc + 200, y0 + zna - 6, 'NA', size=12, anchor='end', color=C['water'], weight='bold')
s.text(xc + 17 * k, y0 + Hp - 10, 'u = γw·(z − zNA)', size=11, anchor='start', color=C['water'])
s.text(xc + 90, y0 + Hp + 40, 'drenagem eficiente evita esta parcela', size=11, color=C['water'])
s.text(30, 585, 'Campos das Entradas: "c\' adotada", "Considerar água?", "Profundidade do NA", "γw", "Sobrecarga (q)", "γ", "φ\'" ou "Ka direto".', size=11, anchor='start', color=C['note'])
s.save('fig11_pressoes.svg'); print('ok')
