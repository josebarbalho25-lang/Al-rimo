# Fig. 3 (app) — seção e grauteamento (planta de uma fiada, bloco 19 × 39) e a seção de cálculo da faixa.
# K: o valor mostrado é o da NBR quando a entrada fica em branco (1,5 parcial; 2,0 total) — é a regra da
# planilha (k_flex), não número de exemplo.
from applib import Fig, C, T_TIT, T_TXT, T_PEQ

S = 5.0


def bloco(s, x0, y0, grauteados):
    t, L, hf = 19, 39, 3.5
    X = lambda v: x0 + v * S
    Y = lambda v: y0 + v * S
    s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    for i, (a, b) in enumerate([(3.5, 17.75), (21.25, 35.5)]):
        g = i in grauteados
        s.rect(X(a), Y(hf), (b - a) * S, (t - 2 * hf) * S, fill=C['groutfill'] if g else C['hollow'],
               stroke=C['grout'] if g else C['block'], sw=1.0, extra='rx="4"')
    s.rect(X(39), Y(0), 1 * S, t * S, fill=C['claro'], stroke='none')


def painel(s, y0, total):
    x0 = 90
    with s.campo('Graute'):
        s.text(x0 - 40, y0 - 50, 'Total — seção cheia' if total else 'Parcial — seção I', size=T_TIT, anchor='start',
               weight='bold', color=C['grout'] if total else C['line'])
    with s.campo('K_dir'):
        s.text(x0 + 225, y0 - 50, 'K (NBR) = 2,0' if total else 'K (NBR) = 1,5', size=T_TXT, anchor='start', color=C['note'])
    s.text(x0, y0 - 16, 'solo', size=T_PEQ + 2, anchor='start', color=C['soil'], weight='bold')
    s.text(x0, y0 + 19 * S + 26, 'face externa', size=T_PEQ + 2, anchor='start', color=C['note'])
    for k in range(3):
        bloco(s, x0 + k * 40 * S, y0, [0, 1] if total else [0])
        s.circle(x0 + (k * 40 + 10.625) * S, y0 + 5 * S, 0.625 * S + 1.4)
    c = 40 + 10.625
    xa, xb = x0 + (c - 20) * S, x0 + (c + 20) * S
    s.rect(xa, y0 - 8, xb - xa, 19 * S + 16, stroke=C['steel'], sw=1.4, extra='stroke-dasharray="6,4"')
    with s.campo('s_dir', 'AsMin_crit'):
        s.dim_h(xa, xb, y0 + 19 * S + 44, 'b_{m} = s')
    if not total:
        with s.campo('bw_dir', 'bwv_dir'):
            s.dim_h(x0 + 40 * S, x0 + 61.25 * S, y0 + 19 * S + 80, 'b_{w}', ext_from=(y0 + 19 * S, y0 + 19 * S))
    with s.campo('t_bloco', 'AsMin_crit'):
        s.dim_v(x0 - 22, y0, y0 + 19 * S, 't', side=-1, ext_from=(x0, x0))
    with s.campo('d_dir', 'AsMin_crit'):
        s.dim_v(x0 - 56, y0 + 5 * S, y0 + 19 * S, 'd', side=-1, ext_from=(x0 + 10.625 * S, x0))
    if not total:
        xh = x0 + 120 * S + 22
        s.line(x0 + 119 * S, y0, xh + 6, y0, stroke=C['dim'], sw=0.7)
        s.line(x0 + 119 * S, y0 + 3.5 * S, xh + 6, y0 + 3.5 * S, stroke=C['dim'], sw=0.7)
        s.add(f'<line x1="{xh:.2f}" y1="{y0 - 12:.2f}" x2="{xh:.2f}" y2="{y0 + 3.5 * S:.2f}" stroke="{C["dim"]}" stroke-width="1" marker-end="{s.u("tick")}"/>')
        s.text(xh + 8, y0 + 3.5 * S / 2 + 6, 'h_{f}', size=T_PEQ + 2, anchor='start', color=C['dim'])
    # seção de cálculo da faixa
    sx = x0 + 120 * S + 90
    s.text(sx + 20 * S, y0 - 16, 'seção de cálculo', size=T_PEQ + 2, color=C['note'])
    if total:
        s.rect(sx, y0, 40 * S, 19 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
    else:
        bw = 21.25; o = (40 - bw) / 2
        pts = [(0, 0), (40, 0), (40, 3.5), (40 - o, 3.5), (40 - o, 15.5), (40, 15.5), (40, 19), (0, 19), (0, 15.5), (o, 15.5), (o, 3.5), (0, 3.5)]
        s.poly([(sx + a * S, y0 + b * S) for a, b in pts], fill=C['blockfill'], stroke=C['line'], sw=1.4)
        s.rect(sx + (o + 3.5) * S, y0 + 3.5 * S, 14.25 * S, 12 * S, fill=C['groutfill'], stroke=C['grout'], sw=1.0)
    s.circle(sx + 20 * S, y0 + 5 * S, 0.625 * S + 1.4)
    with s.campo('s_dir'):
        s.dim_h(sx, sx + 40 * S, y0 + 19 * S + 44, 'b_{m}', ext_from=(y0 + 19 * S, y0 + 19 * S))


def desenhar():
    s = Fig(3, 1000, 640)
    painel(s, 120, total=False)
    painel(s, 420, total=True)
    ly = 640
    x = 90
    for f, st, t in ((C['blockfill'], C['block'], 'bloco'), (C['groutfill'], C['grout'], 'graute'), (C['hollow'], C['block'], 'furo vazio')):
        s.rect(x, ly - 13, 22, 14, fill=f, stroke=st)
        s.text(x + 30, ly, t, size=T_PEQ + 1, anchor='start')
        x += 150
    s.circle(x + 7, ly - 6, 5)
    s.text(x + 20, ly, 'barra vertical', size=T_PEQ + 1, anchor='start')
    return s
