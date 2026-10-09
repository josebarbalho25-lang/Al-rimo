from figlib import SVG, C
S = 5.6                      # px por cm
W, H = 1100, 600
s = SVG(W, H)
s.text(30, 34, 'Fig. 3 — Seção / grauteamento (planta de uma fiada)', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Faixa de cálculo bm = espaçamento das barras. A seção da faixa entra na flexão (ELU) e no ELS.', size=13, anchor='start', color=C['note'])

def block(x0, y0, grout_holes, joint=True):
    # bloco 19x39: paredes 3,5; septos 3,5; furos 14,25 x 12
    t, L, hf = 19, 39, 3.5
    X = lambda v: x0 + v * S; Y = lambda v: y0 + v * S
    s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    holes = [(3.5, 17.75), (21.25, 35.5)]
    for i, (a, b) in enumerate(holes):
        fill = C['groutfill'] if i in grout_holes else C['hollow']
        st = C['grout'] if i in grout_holes else C['block']
        s.rect(X(a), Y(hf), (b - a) * S, (t - 2 * hf) * S, fill=fill, stroke=st, sw=1.0, extra='rx="4"')
    if joint:
        s.rect(X(39), Y(0), 1 * S, t * S, fill='#f2f2f2', stroke='none')

def panel(y0, total):
    x0 = 70
    title = 'Total (seção cheia) — todos os furos grauteados' if total else 'Parcial (seção I) — graute só nos furos com barra (furo sim, furo não)'
    s.text(x0 - 40, y0 - 40, title, size=15, anchor='start', weight='bold', color=C['grout'] if total else C['line'])
    # faces
    s.text(x0 + 100 * S, y0 - 14, '▲ SOLO — face tracionada', size=11, color=C['soil'])
    s.text(x0 + 100 * S, y0 + 19 * S + 18, '▼ face externa — comprimida', size=11, color=C['note'])
    for k in range(3):
        g = [0, 1] if total else [0]
        block(x0 + k * 40 * S, y0, g)
        # barra (a 5 cm da face do solo) no 1º furo de cada bloco
        s.circle(x0 + (k * 40 + 10.625) * S, y0 + 5 * S, 0.625 * S + 1.2)
    # faixa bm
    c = 40 + 10.625
    xa, xb = x0 + (c - 20) * S, x0 + (c + 20) * S
    s.rect(xa, y0 - 8, xb - xa, 19 * S + 16, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="6,4"')
    s.dim_h(xa, xb, y0 + 19 * S + 40, 'bm = 40 cm (espaçamento das barras)')
    if not total:
        s.dim_h(x0 + 40 * S, x0 + 61.25 * S, y0 + 19 * S + 66, 'bw = 21,25 (furo grauteado + 2 septos)', size=11)
    # cotas t, hf, d no 1º bloco
    s.dim_v(x0 - 22, y0, y0 + 19 * S, 't = 19', side=-1, ext_from=(x0, x0))
    s.dim_v(x0 - 48, y0 + 5 * S, y0 + 19 * S, 'd = 14', side=-1, ext_from=(x0 + 10.625 * S, x0))
    if not total:
        s.line(x0 + 119 * S, y0, x0 + 119 * S + 30, y0, stroke=C['dim'], sw=0.6); s.line(x0 + 119 * S, y0 + 3.5 * S, x0 + 119 * S + 30, y0 + 3.5 * S, stroke=C['dim'], sw=0.6)
        s.add(f'<line x1="{x0 + 119 * S + 24:.2f}" y1="{y0:.2f}" x2="{x0 + 119 * S + 24:.2f}" y2="{y0 + 3.5 * S:.2f}" stroke="#404040" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>')
        s.text(x0 + 119 * S + 32, y0 + 3.5 * S / 2 + 4, 'hf = 3,5', size=11, anchor='start', color=C['dim'])
    # seção equivalente
    sx = x0 + 128 * S + 40; sy = y0
    s.text(sx + 20 * S, y0 - 16, 'seção de cálculo da faixa', size=12, color=C['note'])
    if total:
        s.rect(sx, sy, 40 * S, 19 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
        s.text(sx + 20 * S, sy + 9.5 * S + 5, 'retangular bm × t', size=12, color=C['grout'])
    else:
        bw = 21.25; o = (40 - bw) / 2
        pts = [(0, 0), (40, 0), (40, 3.5), (40 - o, 3.5), (40 - o, 15.5), (40, 15.5), (40, 19), (0, 19), (0, 15.5), (o, 15.5), (o, 3.5), (0, 3.5)]
        s.poly([(sx + a * S, sy + b * S) for a, b in pts], fill=C['blockfill'], stroke=C['line'], sw=1.4)
        s.rect(sx + (o + 3.5) * S, sy + 3.5 * S, 14.25 * S, 12 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
        s.text(sx + 20 * S, sy + 19 * S + 16, 'seção I: mesas = paredes do bloco', size=11, color=C['note'])
    s.circle(sx + 20 * S, sy + 5 * S, 0.625 * S + 1.2)

panel(135, total=False)
panel(385, total=True)
# legenda
ly = 560
items = [(C['blockfill'], C['block'], 'bloco'), (C['groutfill'], C['grout'], 'graute'), ('#ffffff', C['block'], 'furo vazio')]
x = 70
for f, st, t in items:
    s.rect(x, ly - 11, 18, 12, fill=f, stroke=st); s.text(x + 24, ly, t, size=12, anchor='start'); x += 120
s.circle(x + 6, ly - 5, 4.7); s.text(x + 16, ly, 'barra vertical (a ~5 cm da face do solo)', size=12, anchor='start')
s.text(70, ly + 24, 'Campos das Entradas: "Seção / grauteamento" (B8), "Largura da alma da seção I", "Espaçamento das barras", "d (altura útil)". Exemplo: bloco 19×39, barras a cada 40 cm.', size=11, anchor='start', color=C['note'])
s.save('fig03_secao.svg')
print('ok')
