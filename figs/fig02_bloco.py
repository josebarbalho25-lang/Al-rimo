from figlib import SVG, C
S = 6.0
W, H = 1100, 470
s = SVG(W, H)
s.text(30, 34, 'Fig. 2 — Blocos de concreto: dimensões usadas na planilha (planta)', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Parede do bloco (hf) = parede longitudinal; septos com a mesma espessura. Valores adotados para a família 39.', size=13, anchor='start', color=C['note'])
blocks = [('14 × 39', 14, 39, 2.7, 0.57, 117), ('19 × 39', 19, 39, 3.5, 0.54, 170)]   # só a família 39 (09/10)
x = 140
for nome, t, L, hf, rl, ag in blocks:
    y0 = 170
    X = lambda v: x + v * S; Y = lambda v: y0 + v * S
    s.text(X(L / 2), 120, f'Bloco {nome}', size=15, weight='bold')
    s.rect(X(0), Y(0), L * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.4)
    lh = (L - 3 * hf) / 2
    for a in (hf, 2 * hf + lh):
        s.rect(X(a), Y(hf), lh * S, (t - 2 * hf) * S, fill='#ffffff', stroke=C['block'], sw=1.0, extra='rx="4"')
    s.dim_h(X(0), X(L), Y(t) + 34, f'L = {L} cm', ext_from=(Y(t), Y(t)))
    s.dim_v(X(0) - 22, Y(0), Y(t), f't = {t}', side=-1, ext_from=(X(0), X(0)))
    # hf
    s.line(X(L), Y(0), X(L) + 26, Y(0), stroke=C['dim'], sw=0.6); s.line(X(L), Y(hf), X(L) + 26, Y(hf), stroke=C['dim'], sw=0.6)
    s.add(f'<line x1="{X(L)+20:.1f}" y1="{Y(0):.1f}" x2="{X(L)+20:.1f}" y2="{Y(hf):.1f}" stroke="#404040" stroke-width="0.9" marker-start="url(#tick)" marker-end="url(#tick)"/>')
    s.text(X(L) + 28, Y(hf / 2) + 4, f'hf = {str(hf).replace(".", ",")}', size=11, anchor='start', color=C['dim'])
    # septo
    s.text(X(hf / 2), Y(t / 2) + 4, 'septo', size=10, color=C['note'], rot=-90)
    s.text(X(L / 2), 170 + 19 * S + 78, f'Aliq/Abr = {str(rl).replace(".", ",")}', size=13)
    s.text(X(L / 2), 170 + 19 * S + 98, f'graute por furo ≈ {ag} cm²', size=13)
    x += L * S + 130
s.text(30, 440, 'Campo das Entradas: "Espessura do bloco (t)"; o comprimento é fixo (família 39). A planilha usa hf no ELS (seção I) e no d sugerido, e Aliq/Abr no fpk líquido.', size=11, anchor='start', color=C['note'])
s.save('fig02_bloco.svg'); print('ok')
