from figlib import SVG, C
import math
S = 1.75                      # px por cm
W, H = 1180, 700
s = SVG(W, H)
s.text(30, 34, 'Fig. 13 — Painel entre contrafortes (elevação, vista de fora)', size=18, anchor='start', weight='bold')
s.text(30, 56, 'Placa com base engastada na sapata corrida, topo livre e laterais nos contrafortes. Exemplo: l = 1,50 m, h = 2,60 m.', size=13, anchor='start', color=C['note'])
l, h, e = 150, 260, 14
x0, yb = 150, 590                 # x do eixo do contraforte esquerdo; y da base do painel
X = lambda v: x0 + v * S
Y = lambda v: yb - v * S
# sapata corrida
s.rect(X(-20), Y(0), (l + 40) * S, 54, fill='url(#conc)', stroke=C['line'], sw=1.2)
s.text(X(l / 2), Y(0) + 46, 'sapata corrida = engaste da base', size=12, color=C['line'], weight='bold')
# contrafortes (em elevação: faixas)
for xc in (0, l):
    s.rect(X(xc - e / 2), Y(h), e * S, h * S, fill='#bfbfbf', stroke=C['block'], sw=1.2)
s.text(X(0), Y(h) - 10, 'contraforte', size=11, color=C['note'])
s.text(X(l), Y(h) - 10, 'contraforte', size=11, color=C['note'])
# painel
s.rect(X(e / 2), Y(h), (l - e) * S, h * S, fill=C['blockfill'], stroke='none')
s.line(X(e / 2), Y(h), X(l - e / 2), Y(h), stroke=C['line'], sw=1.6, extra='stroke-dasharray="7,5"')
s.text(X(l / 2), Y(h) - 10, 'topo LIVRE', size=12, color=C['line'], weight='bold')
# subpainel não armado (de baixo, entre a 1ª e 2ª barra)
xs = [e / 2 + 7.5 + 45 * k for k in range(4) if e / 2 + 7.5 + 45 * k < l - e / 2]
s.rect(X(xs[1]), Y(80), (xs[2] - xs[1]) * S, 80 * S, fill='#fff2cc', stroke='#bf9000', sw=1.0, extra='stroke-dasharray="4,3"')
s.text(X((xs[1] + xs[2]) / 2), Y(40) + 4, 'não armado', size=11, color='#7f6000', weight='bold')
s.text(X((xs[1] + xs[2]) / 2), Y(40) + 18, '0,45 × 0,80', size=11, color='#7f6000')
# canaletas
for hc in (80, 160, 240):
    s.rect(X(e / 2), Y(hc + 10), (l - e) * S, 20 * S * 0.5, fill=C['groutfill'], stroke=C['grout'], sw=0.8)
    s.line(X(e / 2), Y(hc + 5), X(l - e / 2), Y(hc + 5), stroke=C['steel'], sw=2.0)
# barras verticais
for xb in xs:
    s.line(X(xb), Y(h) + 4, X(xb), Y(0) + 26, stroke=C['steel'], sw=2.2)
    s.line(X(xb), Y(0) + 26, X(xb) + 14, Y(0) + 26, stroke=C['steel'], sw=2.2)
# charneiras 60° a partir da base
a = min(l * math.tan(math.radians(60)) / 2, h)
s.pline([(X(e / 2), Y(0)), (X(l / 2), Y(a)), (X(l - e / 2), Y(0))], stroke=C['load'], sw=1.6, extra='stroke-dasharray="8,4"')
s.line(X(l / 2), Y(a), 606, 300, stroke=C['load'], sw=0.8)
s.text(610, 296, '60° (charneiras):', size=11, anchor='start', color=C['load'], weight='bold')
s.text(610, 311, 'triângulo → carga', size=11, anchor='start', color=C['load'])
s.text(610, 326, 'na sapata', size=11, anchor='start', color=C['load'])
# cotas
s.dim_h(X(0), X(l), Y(0) + 74, 'l = 1,50 m (eixo a eixo)', size=12)
s.dim_v(X(-e / 2) - 28, Y(h), Y(0), 'h = 2,60 m', side=-1, size=12)
s.dim_h(X(xs[0]), X(xs[1]), Y(125), 'c/45', size=11)
s.dim_v(X(l - e / 2) + 20, Y(85), Y(165), 'c/80', side=1, size=11)
# diagrama de carga (à direita)
dx = X(l) + 90
pmax = 95
s.poly([(dx, Y(h)), (dx, Y(0)), (dx + pmax, Y(0))], fill='#fbe5d6', stroke=C['load'], sw=1.2)
for k in range(1, 6):
    yy = h * k / 6
    s.arrow(dx + pmax * (1 - yy / h), Y(yy), dx + 3, Y(yy), color=C['load'], sw=1.2)
s.text(dx + pmax + 6, Y(0) - 4, 'σh,base = 20,8 kPa', size=12, anchor='start', color=C['load'])
s.text(dx + 6, Y(h) + 14, 'σh,topo', size=12, anchor='start', color=C['load'])
s.text(dx + 40, Y(h) - 14, 'empuxo (triangular + uniforme)', size=12, color=C['load'])
# legenda / momentos
lx = 730
s.text(lx, 120, 'Momentos (tabelas de Libânio, γ = h/l)', size=15, anchor='start', weight='bold')
items = [('Mdyei', 'vertical, na base (engaste): traciona a face do SOLO'),
         ('Mdy', 'vertical, no vão: traciona a face EXTERNA'),
         ('Mdx', 'horizontal, no vão'),
         ('Mdxb', 'horizontal, na borda livre (topo)'),
         ("Mdxe", 'horizontal, no contraforte (só lateral engastada)')]
for i, (k, t) in enumerate(items):
    s.text(lx, 148 + i * 22, k, size=13, anchor='start', weight='bold', color=C['steel'])
    s.text(lx + 62, 148 + i * 22, t, size=13, anchor='start')
s.text(lx, 275, 'Armaduras do exemplo', size=15, anchor='start', weight='bold')
arm = ['• Vertical: Ø10 c/45 em CADA face (2 barras por furo)', '   → o momento troca de sinal entre a base e o vão',
       '• Horizontal: Ø12,5 c/80 na canaleta, centralizada', '   → K = 0,5 (seção horizontal sem graute)',
       '• Entre barras e canaletas: painel não armado (caso 13)', '• Contraforte recebe a carga da área de influência']
for i, t in enumerate(arm):
    s.text(lx, 302 + i * 21, t, size=13, anchor='start', color=C['line'] if t.startswith('•') else C['note'])
s.text(lx, 445, 'Flecha', size=15, anchor='start', weight='bold')
fl = ['heq vertical e horizontal (seção I, estádio II)', 'flecha pela tabela com cada heq; vale a pior', 'δ∞ = 2·δ0 ≤ menor vão/250']
for i, t in enumerate(fl):
    s.text(lx, 470 + i * 21, '• ' + t, size=13, anchor='start')
s.text(30, 690, 'Campos das Entradas: Bordas laterais do painel, Ø e espaçamento vertical/horizontal, Posição das barras, K vertical/horizontal, ELS (almas da seção I).', size=11, anchor='start', color=C['note'])
s.save('fig13_painel.svg'); print('ok')
